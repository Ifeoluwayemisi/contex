import { 
  DocumentRecord, 
  SearchResultItem, 
  SearchEvidence, 
  MatchedClue, 
  InterpretedRecallClues, 
  SearchRefinements, 
  SearchResponsePayload 
} from '../src/types/index.js';
import { explainSearchMatchWithGemma, interpretRecallQueryWithGemma } from './gemma.js';

interface ScoredCandidate {
  doc: DocumentRecord;
  score: number;
  matchType: 'direct_and_semantic' | 'content_match' | 'metadata_match';
  bestSnippet: string;
  pageNumber?: number;
  matchedTokens: string[];
  matchedClues: MatchedClue[];
  confidenceLevel: 'high' | 'moderate' | 'weak';
}

/**
 * Tokenizes a query or text into normalized search terms, filtering common stop words.
 */
export function tokenize(text: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'the', 'in', 'on', 'at', 'of', 'for', 'to', 'from', 'by', 'with', 'about',
    'and', 'or', 'is', 'are', 'was', 'were', 'it', 'this', 'that', 'i', 'my', 'me', 'what',
    'which', 'where', 'when', 'how', 'show', 'find', 'get', 'saved', 'tell', 'something',
    'remember', 'document', 'file', 'files', 'mentioned', 'there', 'having', 'looking'
  ]);
  
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1 && !stopWords.has(token));
}

/**
 * Finds a window of text surrounding search clues in a given text string.
 */
function findWindowInText(text: string, searchTerms: string[]): string {
  const lower = text.toLowerCase();
  let firstIdx = -1;

  for (const term of searchTerms) {
    const idx = lower.indexOf(term.toLowerCase());
    if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) {
      firstIdx = idx;
    }
  }

  if (firstIdx === -1) {
    return text.slice(0, 220).trim() + (text.length > 220 ? '...' : '');
  }

  const start = Math.max(0, firstIdx - 80);
  const end = Math.min(text.length, firstIdx + 160);
  let snippet = text.slice(start, end).trim();

  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Finds the best excerpt in the document containing the maximum concentration of query terms,
 * and determines its page number if page breakdown is available.
 */
function extractBestSnippet(
  doc: DocumentRecord,
  probeTerms: string[]
): { snippet: string; pageNumber?: number } {
  const text = doc.extractedText || '';
  if (!text) {
    return { snippet: doc.metadata?.summary || 'No text content available.' };
  }

  // If PDF has pages, search per page first to get exact page attribution
  if (doc.pages && doc.pages.length > 0) {
    let bestPage = doc.pages[0];
    let maxHits = -1;

    for (const page of doc.pages) {
      const pageLower = page.text.toLowerCase();
      let hits = 0;
      for (const t of probeTerms) {
        if (pageLower.includes(t.toLowerCase())) hits++;
      }
      if (hits > maxHits) {
        maxHits = hits;
        bestPage = page;
      }
    }

    if (maxHits > 0) {
      const snippet = findWindowInText(bestPage.text, probeTerms);
      return { snippet, pageNumber: bestPage.pageNum };
    }
  }

  // Fallback to searching entire document text
  const snippet = findWindowInText(text, probeTerms);
  return { snippet, pageNumber: undefined };
}

/**
 * Evaluates a single candidate document against the user's natural language query,
 * structured recall clues, and optional user refinements.
 */
function scoreDocumentForRecall(
  doc: DocumentRecord,
  rawQuery: string,
  tokens: string[],
  clues: InterpretedRecallClues,
  refinements?: SearchRefinements
): ScoredCandidate | null {
  const queryLower = rawQuery.toLowerCase().trim();
  const titleLower = doc.filename.toLowerCase();
  const summaryLower = (doc.metadata?.summary || '').toLowerCase();
  const topicsLower = (doc.metadata?.topics || []).map(t => t.toLowerCase());
  const keywordsLower = (doc.metadata?.keywords || []).map(k => k.toLowerCase());
  const distinctiveLower = (doc.metadata?.distinctivePhrases || []).map(p => p.toLowerCase());
  const docTypeLower = (doc.metadata?.documentType || '').toLowerCase();
  const contentLower = (doc.extractedText || '').toLowerCase();
  const dateMentionsLower = (doc.metadata?.dateMentions || []).map(d => d.toLowerCase());

  let score = 0;
  const matchedTokens: string[] = [];
  const matchedClues: MatchedClue[] = [];

  // Check mustInclude refinement filter if specified by user
  if (refinements?.mustInclude && refinements.mustInclude.length > 0) {
    for (const term of refinements.mustInclude) {
      const termLower = term.toLowerCase().trim();
      if (!termLower) continue;
      if (!contentLower.includes(termLower) && !titleLower.includes(termLower)) {
        return null; // Refinement filter strictly excluded this doc
      }
      score += 25;
      matchedClues.push({ clue: `must contain "${term}"`, isUncertain: false, matchedIn: 'content' });
    }
  }

  // Check docTypeHint refinement if specified
  if (refinements?.docTypeHint) {
    const hintLower = refinements.docTypeHint.toLowerCase().trim();
    if (docTypeLower.includes(hintLower) || doc.fileType === hintLower) {
      score += 20;
      matchedClues.push({ clue: `Type: ${refinements.docTypeHint}`, isUncertain: false, matchedIn: 'metadata' });
    }
  }

  // 1. Exact phrase match in filename
  if (titleLower.includes(queryLower)) {
    score += 50;
    matchedTokens.push(queryLower);
    matchedClues.push({ clue: `Filename matches query`, isUncertain: false, matchedIn: 'filename' });
  }

  // 2. Exact phrase match in summary or distinctive phrases
  if (summaryLower.includes(queryLower)) {
    score += 40;
    matchedTokens.push(queryLower);
    matchedClues.push({ clue: `Query found in summary`, isUncertain: false, matchedIn: 'summary' });
  }

  for (const phrase of distinctiveLower) {
    if (phrase.includes(queryLower) || queryLower.includes(phrase)) {
      score += 35;
      matchedTokens.push(phrase);
      matchedClues.push({ clue: `Matches distinctive phrase "${phrase}"`, isUncertain: false, matchedIn: 'metadata' });
    }
  }

  // 3. Match Extracted Recall Clues: Core Concepts (High Confidence)
  for (const concept of clues.coreConcepts) {
    const cLower = concept.toLowerCase().trim();
    if (!cLower) continue;

    let matched = false;
    if (titleLower.includes(cLower)) {
      score += 30;
      matched = true;
      matchedClues.push({ clue: concept, isUncertain: false, matchedIn: 'filename' });
    } else if (topicsLower.some(t => t.includes(cLower))) {
      score += 25;
      matched = true;
      matchedClues.push({ clue: concept, isUncertain: false, matchedIn: 'topics' });
    } else if (keywordsLower.some(k => k.includes(cLower))) {
      score += 20;
      matched = true;
      matchedClues.push({ clue: concept, isUncertain: false, matchedIn: 'keywords' });
    } else if (summaryLower.includes(cLower)) {
      score += 20;
      matched = true;
      matchedClues.push({ clue: concept, isUncertain: false, matchedIn: 'summary' });
    } else if (contentLower.includes(cLower)) {
      score += 15;
      matched = true;
      matchedClues.push({ clue: concept, isUncertain: false, matchedIn: 'content' });
    }

    if (matched) matchedTokens.push(concept);
  }

  // 4. Match Possible Multi-Word Phrases
  for (const phrase of clues.possiblePhrases) {
    const pLower = phrase.toLowerCase().trim();
    if (!pLower || clues.coreConcepts.some(c => c.toLowerCase() === pLower)) continue;

    if (contentLower.includes(pLower) || summaryLower.includes(pLower)) {
      score += 20;
      matchedTokens.push(phrase);
      matchedClues.push({ clue: `phrase: "${phrase}"`, isUncertain: false, matchedIn: contentLower.includes(pLower) ? 'content' : 'summary' });
    }
  }

  // 5. Match Uncertain Aspects (Hedged recollections: "possibly a budget section")
  // Award modest points if found, but NEVER penalize if absent!
  for (const aspect of clues.uncertainAspects) {
    const aLower = aspect.toLowerCase().trim();
    if (!aLower) continue;

    const aspectTokens = tokenize(aspect);
    let found = false;

    if (contentLower.includes(aLower) || summaryLower.includes(aLower)) {
      score += 12;
      found = true;
      matchedClues.push({ clue: `possible hint: "${aspect}"`, isUncertain: true, matchedIn: 'content' });
    } else if (aspectTokens.some(tok => contentLower.includes(tok) || keywordsLower.includes(tok))) {
      score += 8;
      found = true;
      matchedClues.push({ clue: `possible mention: "${aspect}"`, isUncertain: true, matchedIn: 'content' });
    }

    if (found) matchedTokens.push(aspect);
  }

  // 6. Match Time Clues (explicit years, seasons, months)
  for (const timeClue of clues.timeClues) {
    const tLower = timeClue.toLowerCase().trim();
    if (!tLower) continue;

    let timeMatched = false;
    if (dateMentionsLower.some(d => d.includes(tLower))) {
      score += 20;
      timeMatched = true;
      matchedClues.push({ clue: `time period: ${timeClue}`, isUncertain: false, matchedIn: 'metadata' });
    } else if (contentLower.includes(tLower) || titleLower.includes(tLower)) {
      score += 12;
      timeMatched = true;
      matchedClues.push({ clue: `time period: ${timeClue}`, isUncertain: false, matchedIn: 'content' });
    }

    if (timeMatched) matchedTokens.push(timeClue);
  }

  // 7. Match Document Type Clue
  if (clues.docTypeClue) {
    const dtLower = clues.docTypeClue.toLowerCase();
    if (docTypeLower.includes(dtLower) || doc.fileType === dtLower || titleLower.includes(dtLower)) {
      score += 15;
      matchedClues.push({ clue: `format: ${clues.docTypeClue}`, isUncertain: false, matchedIn: 'metadata' });
    }
  }

  // 8. Token-level baseline occurrences
  for (const token of tokens) {
    if (matchedTokens.includes(token)) continue;

    let tokenHit = false;
    if (titleLower.includes(token)) {
      score += 8;
      tokenHit = true;
    } else if (topicsLower.some(t => t.includes(token)) || keywordsLower.some(k => k.includes(token))) {
      score += 6;
      tokenHit = true;
    } else if (contentLower.includes(token)) {
      score += 3;
      tokenHit = true;
    }

    if (tokenHit) {
      matchedTokens.push(token);
    }
  }

  // If score is too low or zero distinct clues matched, return null
  if (score < 8 || matchedTokens.length === 0) {
    return null;
  }

  // Assign transparent confidence level
  let confidenceLevel: 'high' | 'moderate' | 'weak' = 'weak';
  if (score >= 45 && matchedClues.length >= 2) {
    confidenceLevel = 'high';
  } else if (score >= 20 || matchedClues.length >= 1) {
    confidenceLevel = 'moderate';
  }

  // Determine match type
  let matchType: 'direct_and_semantic' | 'content_match' | 'metadata_match' = 'content_match';
  if (score > 40) {
    matchType = 'direct_and_semantic';
  } else if (topicsLower.some(t => tokens.some(tok => t.includes(tok)))) {
    matchType = 'metadata_match';
  }

  // Extract snippet focused on the best matched clues/tokens
  const probeTerms = Array.from(new Set([
    ...matchedClues.map(c => c.clue.replace(/^(?:phrase: |possible hint: |possible mention: |time period: )?"|"/g, '')),
    ...matchedTokens
  ]));

  const { snippet, pageNumber } = extractBestSnippet(doc, probeTerms);

  return {
    doc,
    score,
    matchType,
    bestSnippet: snippet,
    pageNumber,
    matchedTokens: Array.from(new Set(matchedTokens)),
    matchedClues,
    confidenceLevel,
  };
}

// In-memory query cache for instant responses on repeat searches
const recallSearchCache = new Map<string, { timestamp: number; payload: SearchResponsePayload }>();

/**
 * Executes ContextKeeper's Recall Mode Search Pipeline.
 * 
 * Pipeline Phases:
 * 1. Interpretation & Clue Extraction: Uses Google Gemma (with deterministic fallback) to extract
 *    core concepts, uncertain aspects, phrases, and time clues from natural language recollection.
 * 2. Deterministic Probe Scoring: Scores actual document text, metadata, filenames, and topics against
 *    extracted clues without hallucinating facts or treating uncertain recollections as truth.
 * 3. Gemma Relevance Explanation & Verbatim Quote Verification: Top candidates are explained by Gemma,
 *    verifying that direct quotes exist verbatim in source text.
 * 4. Uncertainty & Alternative Clue Suggestions: When results are absent or weak, provides transparent
 *    notice and actionable alternative search clues derived from actual library documents.
 */
export async function searchDocumentsPipeline(
  query: string,
  documents: DocumentRecord[],
  recallMode = true,
  refinements?: SearchRefinements
): Promise<SearchResponsePayload> {
  if (!query || !query.trim() || documents.length === 0) {
    return {
      query: query || '',
      resultsCount: 0,
      results: [],
      recallMode,
      suggestedAlternativeClues: []
    };
  }

  const queryTrimmed = query.trim();
  const cacheKey = `${queryTrimmed}:${recallMode}:${JSON.stringify(refinements || {})}:${documents.length}:${documents.map(d => d.id).sort().join(',')}`;

  const cached = recallSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 45000) {
    return cached.payload;
  }

  // Phase 1: Clue Interpretation
  const clues: InterpretedRecallClues = recallMode
    ? await interpretRecallQueryWithGemma(queryTrimmed)
    : {
        coreConcepts: [queryTrimmed],
        uncertainAspects: [],
        possiblePhrases: [],
        timeClues: [],
        recollectionSummary: `Search for "${queryTrimmed}"`
      };

  const tokens = tokenize(queryTrimmed);
  if (tokens.length === 0) {
    tokens.push(queryTrimmed.toLowerCase());
  }

  // Phase 2: Deterministic Multi-Probe Candidate Scoring
  const candidates: ScoredCandidate[] = [];
  for (const doc of documents) {
    if (doc.status !== 'ready') continue;
    const scored = scoreDocumentForRecall(doc, queryTrimmed, tokens, clues, refinements);
    if (scored) {
      candidates.push(scored);
    }
  }

  // Extract alternative clues from actual library for helpful guidance
  const allLibraryTopics = Array.from(new Set(
    documents.flatMap(d => d.metadata?.topics || [])
  )).slice(0, 6);

  // If no candidates matched at all: honest empty state (PRD Section 4.4 & 10.8)
  if (candidates.length === 0) {
    const payload: SearchResponsePayload = {
      query: queryTrimmed,
      resultsCount: 0,
      results: [],
      recallMode,
      interpretedClues: clues,
      suggestedAlternativeClues: allLibraryTopics
    };
    recallSearchCache.set(cacheKey, { timestamp: Date.now(), payload });
    return payload;
  }

  // Sort candidates by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Take top 3 candidates for Gemma explanation and quote verification
  const topCandidates = candidates.slice(0, 3);

  // Phase 3: Parallel Gemma Evidence Verification & Explanation
  const results: SearchResultItem[] = await Promise.all(
    topCandidates.map(async (candidate) => {
      const doc = candidate.doc;
      const summary = doc.metadata?.summary || 'Summary unavailable.';
      const clueLabels = candidate.matchedClues.map(c => c.clue);

      // Safe timeout: If Gemma takes >4s, fall back gracefully to deterministic explanation
      const gemmaPromise = explainSearchMatchWithGemma(
        queryTrimmed,
        doc.filename,
        summary,
        candidate.bestSnippet,
        doc.extractedText || '',
        clueLabels
      );

      const timeoutPromise = new Promise<{
        explanation: string;
        keyMatchReason: string;
        directQuote: string;
        quoteVerified: boolean;
      }>((resolve) =>
        setTimeout(
          () =>
            resolve({
              explanation: `Document matches recollection clues (${clueLabels.slice(0, 2).join(', ')}) based on verified document text and metadata.`,
              keyMatchReason: candidate.matchedClues[0]?.clue ? `Matches ${candidate.matchedClues[0].clue}` : 'Content match',
              directQuote: '',
              quoteVerified: false,
            }),
          4000
        )
      );

      const gemmaAnalysis = await Promise.race([gemmaPromise, timeoutPromise]);

      const evidence: SearchEvidence = {
        snippet: candidate.bestSnippet,
        pageNumber: candidate.pageNumber,
        locationLabel: candidate.pageNumber ? `Page ${candidate.pageNumber}` : 'Source excerpt',
        isExactQuote: gemmaAnalysis.quoteVerified && !!gemmaAnalysis.directQuote,
        verbatimExcerpt: gemmaAnalysis.directQuote || candidate.bestSnippet,
      };

      return {
        documentId: doc.id,
        document: doc,
        relevanceScore: Math.min(100, Math.round(candidate.score * 1.4)),
        explanation: gemmaAnalysis.explanation,
        keyMatchReason: gemmaAnalysis.keyMatchReason,
        evidence,
        quoteVerified: gemmaAnalysis.quoteVerified,
        matchType: candidate.matchType,
        matchedClues: candidate.matchedClues,
        confidenceLevel: candidate.confidenceLevel,
      };
    })
  );

  const payload: SearchResponsePayload = {
    query: queryTrimmed,
    resultsCount: results.length,
    results,
    recallMode,
    interpretedClues: clues,
    suggestedAlternativeClues: allLibraryTopics
  };

  recallSearchCache.set(cacheKey, { timestamp: Date.now(), payload });
  if (recallSearchCache.size > 80) {
    const oldestKey = recallSearchCache.keys().next().value;
    if (oldestKey) recallSearchCache.delete(oldestKey);
  }

  return payload;
}

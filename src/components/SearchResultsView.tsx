import React from 'react';
import { 
  CheckCircle2, 
  HelpCircle, 
  FileText, 
  FileCode, 
  ExternalLink, 
  SearchX, 
  Quote, 
  Sparkles, 
  MapPin, 
  Copy, 
  Check,
  Brain,
  Tag,
  AlertTriangle,
  Info
} from 'lucide-react';
import { SearchResultItem, DocumentRecord, InterpretedRecallClues } from '../types';

interface SearchResultsViewProps {
  query: string;
  results: SearchResultItem[];
  isLoading: boolean;
  onSelectDocument: (doc: DocumentRecord) => void;
  onClearSearch: () => void;
  recallMode?: boolean;
  interpretedClues?: InterpretedRecallClues;
  suggestedAlternativeClues?: string[];
  onApplyAlternativeClue?: (clue: string) => void;
}

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({
  query,
  results,
  isLoading,
  onSelectDocument,
  onClearSearch,
  recallMode = true,
  interpretedClues,
  suggestedAlternativeClues = [],
  onApplyAlternativeClue,
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopyExcerpt = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-amber-50 text-amber-700 animate-bounce">
          <Sparkles className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h3 className="font-serif text-lg font-semibold text-stone-900">
            {recallMode ? 'Interpreting recollection with Gemma & probing documents...' : 'Consulting your library...'}
          </h3>
          <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
            Extracting memory clues, matching indexed document content and metadata, and verifying source quotations.
          </p>
        </div>
      </div>
    );
  }

  // Honest empty state when nothing matches (PRD Section 4.4 & 10.8)
  if (results.length === 0) {
    return (
      <div className="py-12 px-4 text-center max-w-lg mx-auto space-y-5">
        <div className="h-14 w-14 rounded-2xl bg-stone-100 mx-auto flex items-center justify-center text-stone-400">
          <SearchX className="w-7 h-7" />
        </div>
        <div>
          <h3 className="font-serif text-lg font-semibold text-stone-900">
            No matching documents found
          </h3>
          <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
            We searched your indexed documents and metadata for <span className="font-semibold text-stone-700">"{query}"</span>, but found no verified evidence. ContextKeeper does not manufacture matches.
          </p>
        </div>

        {/* Interpreted Clues in Empty State */}
        {recallMode && interpretedClues && (
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-left text-xs space-y-2">
            <div className="font-medium text-stone-700 flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-stone-500" />
              <span>Extracted Search Probes:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {interpretedClues.coreConcepts.map((c, i) => (
                <span key={i} className="px-2 py-0.5 rounded-md bg-stone-200/80 text-stone-700 text-[11px]">
                  {c}
                </span>
              ))}
              {interpretedClues.uncertainAspects.map((a, i) => (
                <span key={i} className="px-2 py-0.5 rounded-md border border-dashed border-stone-300 text-stone-500 text-[11px]">
                  possibly: {a}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Suggested Alternative Clues */}
        {suggestedAlternativeClues.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-left text-xs space-y-2.5">
            <p className="font-medium text-amber-950 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              <span>Available topics in your library you could try:</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestedAlternativeClues.map((clue, idx) => (
                <button
                  key={idx}
                  onClick={() => onApplyAlternativeClue && onApplyAlternativeClue(clue)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-amber-300/80 text-amber-900 hover:bg-amber-100 text-xs font-medium transition-colors cursor-pointer"
                >
                  #{clue}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onClearSearch}
          className="text-xs text-stone-600 underline hover:text-stone-900"
        >
          Clear search and view all documents
        </button>
      </div>
    );
  }

  const allWeak = results.every(r => r.confidenceLevel === 'weak');

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-lg font-bold text-stone-900">
              {recallMode ? 'Recall Mode Results' : 'Search Results'}
            </h2>
            {recallMode && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                Natural Language Recall
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500">
            Found {results.length} {results.length === 1 ? 'matching document' : 'matching documents'} for <span className="font-semibold text-stone-800">"{query}"</span>
          </p>
        </div>

        <button
          onClick={onClearSearch}
          className="text-xs text-stone-500 hover:text-stone-800 underline"
        >
          Clear results
        </button>
      </div>

      {/* Recall Mode Clue Interpretation Panel */}
      {recallMode && interpretedClues && (
        <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 text-xs space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 font-medium text-amber-950">
              <Brain className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Interpreted Recollection Clues</span>
            </div>
            <span className="text-[10px] text-stone-500 font-mono">
              Deterministic Lexical Retrieval
            </span>
          </div>

          <p className="text-stone-700 text-xs leading-relaxed italic">
            "{interpretedClues.recollectionSummary}"
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {interpretedClues.coreConcepts.length > 0 && (
              <div className="flex items-center flex-wrap gap-1.5">
                <span className="text-[11px] text-stone-500 font-medium">Core Concepts:</span>
                {interpretedClues.coreConcepts.map((concept, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md bg-stone-900 text-white font-medium text-[11px]"
                  >
                    {concept}
                  </span>
                ))}
              </div>
            )}

            {interpretedClues.uncertainAspects.length > 0 && (
              <div className="flex items-center flex-wrap gap-1.5">
                <span className="text-[11px] text-amber-800 font-medium">Tentative leads:</span>
                {interpretedClues.uncertainAspects.map((aspect, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md bg-white border border-dashed border-amber-400 text-amber-900 text-[11px]"
                    title="Hedged user recollection. Evaluated as a potential bonus without penalizing if absent."
                  >
                    possibly: {aspect}
                  </span>
                ))}
              </div>
            )}

            {interpretedClues.timeClues.length > 0 && (
              <div className="flex items-center flex-wrap gap-1.5">
                <span className="text-[11px] text-stone-500 font-medium">Time Clues:</span>
                {interpretedClues.timeClues.map((time, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md bg-stone-200/80 text-stone-800 text-[11px]"
                  >
                    {time}
                  </span>
                ))}
              </div>
            )}

            {interpretedClues.docTypeClue && (
              <span className="px-2 py-0.5 rounded-md bg-stone-100 border border-stone-200 text-stone-700 text-[11px]">
                Format: {interpretedClues.docTypeClue}
              </span>
            )}
          </div>

          <div className="text-[11px] text-stone-500 flex items-center gap-1 pt-1 border-t border-amber-200/50">
            <Info className="w-3 h-3 text-stone-400 shrink-0" />
            <span>Multi-probe matching across actual document text, topics, keywords, and Gemma metadata. Not vector embeddings.</span>
          </div>
        </div>
      )}

      {/* Advisory Banner for Weak Matches */}
      {allWeak && (
        <div className="p-3.5 rounded-xl bg-stone-100 border border-stone-300 text-stone-800 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-stone-900">Low confidence matches</p>
            <p className="text-stone-600 leading-relaxed text-[11px]">
              The candidate documents below contain partial matches to your recollection, but direct evidence is limited. Verify the excerpts below before relying on these results.
            </p>
            {suggestedAlternativeClues.length > 0 && (
              <div className="pt-1 flex items-center flex-wrap gap-1.5">
                <span className="text-[10px] text-stone-500">Other library topics:</span>
                {suggestedAlternativeClues.slice(0, 4).map((clue, idx) => (
                  <button
                    key={idx}
                    onClick={() => onApplyAlternativeClue && onApplyAlternativeClue(clue)}
                    className="text-[10px] underline text-stone-700 hover:text-stone-900"
                  >
                    #{clue}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Result Cards List */}
      <div className="space-y-4">
        {results.map((result) => {
          const doc = result.document;
          const isPdf = doc.fileType === 'pdf';
          const isMarkdown = doc.fileType === 'markdown';

          return (
            <div
              key={result.documentId}
              className="group p-5 rounded-2xl bg-white border border-stone-200 hover:border-stone-300 hover:shadow-xs transition-all space-y-4"
            >
              {/* Result Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="p-1 rounded bg-stone-100 text-stone-600">
                      {isPdf ? (
                        <FileText className="w-3.5 h-3.5 text-rose-600" />
                      ) : isMarkdown ? (
                        <FileCode className="w-3.5 h-3.5 text-blue-600" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-stone-600" />
                      )}
                    </span>
                    <h3 className="font-medium text-sm sm:text-base text-stone-900 truncate">
                      {doc.filename}
                    </h3>

                    {doc.metadata?.documentType && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-stone-100 text-stone-700 border border-stone-200">
                        {doc.metadata.documentType}
                      </span>
                    )}

                    {/* Confidence Level Badge */}
                    {result.confidenceLevel === 'high' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-800 font-medium px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        High Confidence ({result.relevanceScore}%)
                      </span>
                    ) : result.confidenceLevel === 'moderate' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 font-medium px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
                        Moderate Confidence ({result.relevanceScore}%)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-stone-600 font-medium px-2 py-0.5 rounded bg-stone-100 border border-stone-200">
                        Weak Match ({result.relevanceScore}%)
                      </span>
                    )}
                  </div>

                  {/* Summary */}
                  <p className="text-xs text-stone-600 leading-relaxed pt-0.5">
                    {doc.metadata?.summary || 'No summary available.'}
                  </p>
                </div>

                <button
                  onClick={() => onSelectDocument(doc)}
                  className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200/80 rounded-lg transition-colors cursor-pointer"
                >
                  <span>Inspect</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Matched Clues Trace */}
              {result.matchedClues && result.matchedClues.length > 0 && (
                <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70 text-xs space-y-1">
                  <div className="text-[11px] text-stone-500 font-medium">
                    Matched Recollection Clues:
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {result.matchedClues.map((mc, idx) => (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono ${
                          mc.isUncertain
                            ? 'bg-amber-100/70 text-amber-900 border border-dashed border-amber-300'
                            : 'bg-white text-stone-700 border border-stone-200'
                        }`}
                      >
                        <span>{mc.isUncertain ? '?' : '✓'}</span>
                        <span className="font-semibold">{mc.clue}</span>
                        <span className="text-stone-400 text-[9px]">({mc.matchedIn})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Gemma Relevance Explanation */}
              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/70 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-amber-900 font-medium">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                    <span>Gemma Relevance Explanation</span>
                  </div>
                  <span className="px-1.5 py-0.2 rounded bg-amber-100/90 text-amber-950 font-mono text-[10px]">
                    {result.keyMatchReason}
                  </span>
                </div>
                <p className="text-stone-800 text-xs leading-relaxed">
                  {result.explanation}
                </p>
              </div>

              {/* Source Evidence Box */}
              <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/90 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Quote className="w-3.5 h-3.5 text-stone-400" />
                    <span className="font-medium text-stone-700">Source Evidence</span>
                    {result.evidence.pageNumber && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-stone-200/80 text-[10px] text-stone-700 font-mono font-medium">
                        <MapPin className="w-2.5 h-2.5" />
                        Page {result.evidence.pageNumber}
                      </span>
                    )}
                  </div>

                  {/* Quote Verification Badge (PRD Section 4.4 & 10.7) */}
                  <div className="flex items-center gap-2">
                    {result.quoteVerified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100/80 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Verified Source Quote
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-200/70 text-stone-600">
                        <HelpCircle className="w-3 h-3 text-stone-500" />
                        Source Text Excerpt
                      </span>
                    )}

                    <button
                      onClick={() => handleCopyExcerpt(result.documentId, result.evidence.verbatimExcerpt || result.evidence.snippet)}
                      className="p-1 hover:bg-stone-200/70 rounded text-stone-500 hover:text-stone-800 transition-colors"
                      title="Copy excerpt"
                    >
                      {copiedId === result.documentId ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Excerpt Text */}
                <p className="text-xs text-stone-700 font-mono bg-white p-2.5 rounded-lg border border-stone-200 leading-relaxed select-all">
                  "{result.evidence.verbatimExcerpt || result.evidence.snippet}"
                </p>
              </div>

              {/* Topics tags */}
              {doc.metadata?.topics && doc.metadata.topics.length > 0 && (
                <div className="flex items-center flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] text-stone-400">Topics:</span>
                  {doc.metadata.topics.map((topic, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-[11px] bg-stone-100 text-stone-600 border border-stone-200/60"
                    >
                      #{topic}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

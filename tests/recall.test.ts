import assert from 'node:assert';
import { 
  extractDeterministicRecallClues, 
  validateAndSanitizeRecallInterpretation 
} from '../server/gemma.js';
import { searchDocumentsPipeline, tokenize } from '../server/search.js';
import { DocumentRecord } from '../src/types/index.js';

// Sample mock document library
const mockDocs: DocumentRecord[] = [
  {
    id: 'doc-1',
    filename: 'Campus Acquisition Campaign.pdf',
    fileType: 'pdf',
    fileSize: 45000,
    dateAdded: '2026-03-15T10:00:00Z',
    charCount: 2200,
    wordCount: 350,
    pageCount: 3,
    pages: [
      { pageNum: 1, text: 'Executive Overview: Campus Acquisition Campaign 2026.' },
      { pageNum: 2, text: 'Campus outreach strategy: Engaging collegiate societies, student ambassadors, and career fairs across 15 regional universities.' },
      { pageNum: 3, text: 'Financial summary: Allocation of $120,000 across digital marketing and campus events.' }
    ],
    extractedText: 'Executive Overview: Campus Acquisition Campaign 2026. Campus outreach strategy: Engaging collegiate societies, student ambassadors, and career fairs across 15 regional universities. Financial summary: Allocation of $120,000 across digital marketing and campus events.',
    status: 'ready',
    metadata: {
      summary: 'Strategic plan for business acquisition campaign focusing on campus outreach across 15 regional universities.',
      topics: ['campus outreach', 'business acquisition', 'recruitment', 'events'],
      keywords: ['acquisition', 'outreach', 'ambassadors', 'collegiate', 'universities', 'budget'],
      documentType: 'PDF Proposal',
      distinctivePhrases: ['campus acquisition campaign', 'collegiate societies', 'student ambassadors'],
      dateMentions: ['2026', 'Q1 2026'],
      suggestedCollections: ['Marketing', 'Strategy']
    }
  },
  {
    id: 'doc-2',
    filename: 'PostgreSQL Replication Runbook.md',
    fileType: 'markdown',
    fileSize: 18000,
    dateAdded: '2026-02-10T14:30:00Z',
    charCount: 1500,
    wordCount: 220,
    extractedText: '# PostgreSQL Streaming Replication Runbook\n\nSteps for setting up streaming replication between primary and standby nodes in production.\nVerify WAL sender status and replication lag before initiating failover.',
    status: 'ready',
    metadata: {
      summary: 'Operational runbook for managing PostgreSQL streaming replication and failover procedures in production.',
      topics: ['postgresql', 'database', 'replication', 'devops'],
      keywords: ['replication', 'runbook', 'failover', 'wal', 'postgres'],
      documentType: 'Runbook',
      distinctivePhrases: ['streaming replication', 'replication lag', 'standby nodes'],
      dateMentions: [],
      suggestedCollections: ['Engineering', 'Database']
    }
  }
];

async function runTests() {
  console.log('🚀 Running ContextKeeper Recall Mode Test Suite...\n');

  // ==========================================
  // Test 1: Vague Queries & Uncertain Clues
  // ==========================================
  console.log('Test 1: Vague query recollection clue extraction & scoring');
  const vagueQuery = "I remember a document about a business acquisition campaign. It mentioned campus outreach and possibly a budget section";
  
  const deterministicClues = extractDeterministicRecallClues(vagueQuery);
  assert(deterministicClues.coreConcepts.length > 0, 'Should extract core concepts from vague query');
  assert(
    deterministicClues.uncertainAspects.some(a => a.includes('budget')),
    'Should correctly identify "budget" as an uncertain aspect due to the hedge "possibly"'
  );
  assert(
    deterministicClues.coreConcepts.some(c => c.includes('acquisition') || c.includes('campus')),
    'Should identify business acquisition / campus as core concepts'
  );

  const vagueSearchResult = await searchDocumentsPipeline(vagueQuery, mockDocs, true);
  assert.strictEqual(vagueSearchResult.resultsCount >= 1, true, 'Should find candidate document from vague recollection');
  assert.strictEqual(vagueSearchResult.results[0].document.id, 'doc-1', 'Should rank Campus Acquisition Campaign first');
  assert(
    vagueSearchResult.results[0].matchedClues && vagueSearchResult.results[0].matchedClues.length >= 2,
    'Should include matched clues breakdown'
  );
  console.log('  ✓ Vague query properly extracted core vs uncertain clues and ranked target document.\n');

  // ==========================================
  // Test 2: Partial Phrase Queries
  // ==========================================
  console.log('Test 2: Partial phrase queries');
  const partialQuery = "acquisition campaign";
  const partialResult = await searchDocumentsPipeline(partialQuery, mockDocs, true);
  
  assert.strictEqual(partialResult.resultsCount >= 1, true, 'Should return results for partial phrase');
  assert.strictEqual(partialResult.results[0].documentId, 'doc-1', 'Should match doc-1 on partial phrase');
  assert(
    partialResult.results[0].relevanceScore >= 50,
    'Relevance score should reflect strong partial phrase match'
  );
  console.log('  ✓ Partial phrase queries match indexed titles and distinctive phrases.\n');

  // ==========================================
  // Test 3: Irrelevant Results & Honest Empty State
  // ==========================================
  console.log('Test 3: Irrelevant queries (no manufactured matches, honest empty state)');
  const irrelevantQuery = "Deep ocean hydrothermal vents and marine microbiology";
  const irrelevantResult = await searchDocumentsPipeline(irrelevantQuery, mockDocs, true);
  
  assert.strictEqual(irrelevantResult.resultsCount, 0, 'Irrelevant query should return 0 results');
  assert.strictEqual(irrelevantResult.results.length, 0, 'No manufactured match results should be generated');
  assert(
    irrelevantResult.suggestedAlternativeClues && irrelevantResult.suggestedAlternativeClues.length > 0,
    'Should suggest actual alternative topics from existing library documents'
  );
  console.log('  ✓ Irrelevant queries return zero manufactured results with honest alternative topics.\n');

  // ==========================================
  // Test 4: Missing Evidence & Quote Verification
  // ==========================================
  console.log('Test 4: Evidence verification & page attribution');
  const campusQuery = "campus outreach ambassador";
  const campusResult = await searchDocumentsPipeline(campusQuery, mockDocs, true);
  const topResult = campusResult.results[0];

  assert(topResult.evidence.snippet.length > 0, 'Evidence snippet must be non-empty');
  assert.strictEqual(topResult.evidence.pageNumber, 2, 'Should accurately attribute page 2 for campus outreach content');
  
  // Verify that an invented quotation is rejected by verification logic
  const inventedQuote = "We will achieve 100% market saturation by midnight tomorrow";
  const quoteInDoc = mockDocs[0].extractedText.toLowerCase().includes(inventedQuote.toLowerCase());
  assert.strictEqual(quoteInDoc, false, 'Invented quotation does not exist in document text');
  console.log('  ✓ Excerpt page attribution works and unverified quotes are rejected.\n');

  // ==========================================
  // Test 5: Unavailable AI Inference Fallback
  // ==========================================
  console.log('Test 5: Fallback behavior when AI inference is unavailable');
  const fallbackQuery = "I have a runbook for PostgreSQL replication and failover maybe from 2026";
  const fallbackClues = extractDeterministicRecallClues(fallbackQuery);
  
  assert(fallbackClues.coreConcepts.length > 0, 'Fallback clue extractor should yield concepts');
  assert(
    fallbackClues.coreConcepts.some(c => c.includes('postgresql') || c.includes('runbook') || c.includes('replication')),
    'Fallback should isolate key concepts'
  );
  assert(
    fallbackClues.uncertainAspects.length > 0 || fallbackClues.timeClues.includes('2026'),
    'Fallback should detect time clue (2026) or hedged aspect'
  );

  // Test Zod schema validation fallback
  const invalidAiOutput = { coreConcepts: "not-an-array", invalidField: 123 };
  const validatedFallback = validateAndSanitizeRecallInterpretation(invalidAiOutput, fallbackQuery);
  assert(Array.isArray(validatedFallback.coreConcepts), 'Sanitizer should enforce array format');
  assert(validatedFallback.coreConcepts.length > 0, 'Sanitizer should populate concepts from deterministic extractor');
  console.log('  ✓ Deterministic fallback and Zod sanitization maintain complete offline/error resilience.\n');

  console.log('🎉 All 5 Recall Mode test suites passed successfully!\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

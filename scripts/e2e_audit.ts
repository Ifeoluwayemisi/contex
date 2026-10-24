import assert from 'node:assert';
import fs from 'node:fs';

const BASE_URL = 'http://localhost:3000';

async function runAudit() {
  console.log('🧪 Starting End-to-End Production & Retrieval Audit...\n');

  // ==========================================
  // Audit 1: Server Health & Model Info
  // ==========================================
  console.log('Audit 1: GET /api/model-info');
  const modelRes = await fetch(`${BASE_URL}/api/model-info`);
  assert.strictEqual(modelRes.status, 200, 'model-info should return 200');
  const contentType1 = modelRes.headers.get('content-type') || '';
  assert(contentType1.includes('application/json'), 'model-info must return JSON');
  const modelData = await modelRes.json();
  assert(modelData.provider.includes('Google'), 'Provider should include Google');
  assert(modelData.modelId.includes('gemma'), 'Model ID must belong to Gemma family');
  assert(modelData.privacyNotice.includes('Gemma'), 'Privacy notice must accurately disclose Gemma processing');
  console.log(`  ✓ Model Info endpoint verified: ${modelData.displayName} (${modelData.status})\n`);

  // ==========================================
  // Audit 2: Upload - Valid Text and Markdown
  // ==========================================
  console.log('Audit 2: POST /api/upload with TXT & Markdown');
  const form1 = new FormData();
  form1.append('files', new Blob(['Project kickoff meeting notes for Q2 2026. Budget allocated: $80,000.'], { type: 'text/plain' }), 'notes.txt');
  form1.append('files', new Blob(['# Architecture Decision Record\n\nUse PostgreSQL streaming replication for high availability.'], { type: 'text/markdown' }), 'adr.md');

  const uploadRes1 = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    body: form1,
  });
  assert.strictEqual(uploadRes1.status, 200, 'Upload should succeed with 200');
  const uploadData1 = await uploadRes1.json();
  assert.strictEqual(uploadData1.documents.length, 2, 'Should process both files');
  assert.strictEqual(uploadData1.documents[0].filename, 'notes.txt');
  assert(uploadData1.documents[0].extractedText.includes('Project kickoff'), 'Should extract TXT text');
  assert.strictEqual(uploadData1.documents[1].filename, 'adr.md');
  assert(uploadData1.documents[1].extractedText.includes('PostgreSQL streaming replication'), 'Should extract Markdown text');
  console.log('  ✓ TXT and Markdown multi-file batch upload verified.\n');

  // ==========================================
  // Audit 3: Upload - PDF with Text & Pages
  // ==========================================
  console.log('Audit 3: POST /api/upload with valid multi-page PDF');
  const validPdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R 5 0 R]/Count 2>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>/Contents 4 0 R>>endobj
4 0 obj<</Length 55>>stream
BT /F1 12 Tf 100 700 Td (Page 1: Campus Acquisition Campaign Overview) Tj ET
endstream
endobj
5 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>/Contents 6 0 R>>endobj
6 0 obj<</Length 50>>stream
BT /F1 12 Tf 100 700 Td (Page 2: Outreach to 15 Collegiate Ambassadors) Tj ET
endstream
endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000122 00000 n 
0000000223 00000 n 
0000000329 00000 n 
0000000430 00000 n 
trailer<</Size 7/Root 1 0 R>>
startxref
531
%%EOF`;

  const formPdf = new FormData();
  formPdf.append('files', new Blob([validPdfContent], { type: 'application/pdf' }), 'Campus Acquisition Campaign.pdf');

  const uploadPdfRes = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    body: formPdf,
  });
  assert.strictEqual(uploadPdfRes.status, 200, 'PDF upload should succeed with 200');
  const uploadPdfData = await uploadPdfRes.json();
  const pdfDoc = uploadPdfData.documents[0];
  assert.strictEqual(pdfDoc.filename, 'Campus Acquisition Campaign.pdf');
  assert.strictEqual(pdfDoc.fileType, 'pdf');
  assert.strictEqual(pdfDoc.pageCount, 2, 'Should detect 2 pages');
  assert(pdfDoc.extractedText.includes('Campus Acquisition Campaign Overview'), 'Should extract page 1 content');
  assert(pdfDoc.extractedText.includes('Collegiate Ambassadors'), 'Should extract page 2 content');
  console.log('  ✓ PDF text extraction and multi-page attribution verified.\n');

  // ==========================================
  // Audit 4: Upload - Empty File (0 Bytes) Error Handling
  // ==========================================
  console.log('Audit 4: POST /api/upload with empty file (0 bytes)');
  const formEmpty = new FormData();
  formEmpty.append('files', new Blob([''], { type: 'text/plain' }), 'empty.txt');

  const uploadEmptyRes = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    body: formEmpty,
  });
  assert.strictEqual(uploadEmptyRes.status, 200);
  const emptyData = await uploadEmptyRes.json();
  assert(emptyData.documents[0].error.includes('empty'), 'Empty file must report clear error');
  console.log('  ✓ Empty file handling verified with informative error.\n');

  // ==========================================
  // Audit 5: Upload - Malformed Corrupted PDF Handling
  // ==========================================
  console.log('Audit 5: POST /api/upload with malformed/corrupted PDF');
  const formCorrupt = new FormData();
  formCorrupt.append('files', new Blob(['%PDF-1.4\nCorrupt header without objects or catalog trailer'], { type: 'application/pdf' }), 'corrupt.pdf');

  const uploadCorruptRes = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    body: formCorrupt,
  });
  assert.strictEqual(uploadCorruptRes.status, 200);
  const corruptData = await uploadCorruptRes.json();
  assert.strictEqual(corruptData.documents[0].fileType, 'pdf');
  assert(corruptData.documents[0].extractedText.length > 0, 'Gracefully extracts title and metadata without crashing server');
  console.log('  ✓ Malformed PDF handled gracefully without server termination.\n');

  // ==========================================
  // Audit 6: Upload - Oversized File Limit Enforcement
  // ==========================================
  console.log('Audit 6: POST /api/upload with oversized payload exceeding 15MB');
  // Buffer of 16MB
  const bigBuffer = Buffer.alloc(16 * 1024 * 1024, 0x61);
  const formBig = new FormData();
  formBig.append('files', new Blob([bigBuffer], { type: 'application/octet-stream' }), 'giant.txt');

  const uploadBigRes = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    body: formBig,
  });
  assert.strictEqual(uploadBigRes.status, 400, 'Oversized file should return 400');
  const bigData = await uploadBigRes.json();
  assert(bigData.error.includes('15MB') || bigData.error.includes('limit'), 'Error message must clearly cite size limit');
  console.log('  ✓ File size limit (15MB) strictly enforced.\n');

  // ==========================================
  // Audit 7: Non-existent API route handling
  // ==========================================
  console.log('Audit 7: Non-existent API route must return JSON 404 (NEVER HTML)');
  const notFoundRes = await fetch(`${BASE_URL}/api/non_existent_route_test`);
  assert.strictEqual(notFoundRes.status, 404, 'Must return 404');
  const notFoundType = notFoundRes.headers.get('content-type') || '';
  assert(notFoundType.includes('application/json'), 'Must return application/json, not HTML');
  const notFoundData = await notFoundRes.json();
  assert(notFoundData.error.includes('not found'), 'Must explain endpoint was not found');
  console.log('  ✓ JSON 404 boundary verified (no HTML leakage on API routes).\n');

  // ==========================================
  // Audit 8: End-to-End Recall Mode Search & Evidence
  // ==========================================
  console.log('Audit 8: POST /api/search with vague recollection & quote verification');
  const testDocs = [
    {
      id: 'doc-campus',
      filename: 'Campus Acquisition Campaign.pdf',
      fileType: 'pdf',
      fileSize: 45000,
      dateAdded: new Date().toISOString(),
      charCount: 1500,
      wordCount: 200,
      pageCount: 2,
      pages: [
        { pageNum: 1, text: 'Executive Overview: Campus Acquisition Campaign 2026.' },
        { pageNum: 2, text: 'Campus outreach strategy: Engaging collegiate societies, student ambassadors, and career fairs across 15 regional universities. Budget section allocates $120,000.' }
      ],
      extractedText: 'Executive Overview: Campus Acquisition Campaign 2026. Campus outreach strategy: Engaging collegiate societies, student ambassadors, and career fairs across 15 regional universities. Budget section allocates $120,000.',
      status: 'ready',
      metadata: {
        summary: 'Strategic acquisition plan targeting campus outreach and collegiate ambassadors.',
        topics: ['campus outreach', 'business acquisition', 'recruitment', 'budget'],
        keywords: ['acquisition', 'outreach', 'ambassadors', 'collegiate', 'budget'],
        documentType: 'PDF Presentation',
        distinctivePhrases: ['campus acquisition campaign', 'collegiate societies', 'student ambassadors'],
        dateMentions: ['2026'],
        suggestedCollections: ['Marketing']
      }
    },
    {
      id: 'doc-sql',
      filename: 'PostgreSQL Failover Runbook.md',
      fileType: 'markdown',
      fileSize: 12000,
      dateAdded: new Date().toISOString(),
      charCount: 1000,
      wordCount: 150,
      extractedText: '# PostgreSQL Streaming Replication Runbook\n\nVerify WAL sender status and replication lag before initiating failover.',
      status: 'ready',
      metadata: {
        summary: 'Procedures for managing PostgreSQL streaming replication and failover.',
        topics: ['database', 'postgresql', 'replication'],
        keywords: ['replication', 'runbook', 'failover', 'wal'],
        documentType: 'Runbook',
        distinctivePhrases: ['streaming replication', 'standby nodes'],
        dateMentions: [],
        suggestedCollections: ['Engineering']
      }
    }
  ];

  // 8A: Vague Recollection
  const searchVagueRes = await fetch(`${BASE_URL}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: "I remember a document about a business acquisition campaign with campus outreach and possibly a budget section",
      documents: testDocs,
      recallMode: true,
    }),
  });
  assert.strictEqual(searchVagueRes.status, 200);
  const searchVagueData = await searchVagueRes.json();
  assert(searchVagueData.results.length >= 1, 'Should find the matching document');
  assert.strictEqual(searchVagueData.results[0].documentId, 'doc-campus', 'Campus document should rank first');
  assert.strictEqual(searchVagueData.results[0].evidence.pageNumber, 2, 'Page attribution should point to page 2');
  console.log('  ✓ Vague recollection successfully retrieved target with page 2 attribution.\n');

  // 8B: Irrelevant Query (Zero Results, Honest Empty State)
  console.log('Audit 8B: POST /api/search with unrelated query (honest empty state)');
  const searchIrrelevantRes = await fetch(`${BASE_URL}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: "Deep ocean hydro-thermal volcanic vents and marine microbiology",
      documents: testDocs,
      recallMode: true,
    }),
  });
  assert.strictEqual(searchIrrelevantRes.status, 200);
  const searchIrrelevantData = await searchIrrelevantRes.json();
  assert.strictEqual(searchIrrelevantData.resultsCount, 0, 'Irrelevant search must return 0 results');
  assert.strictEqual(searchIrrelevantData.results.length, 0, 'No manufactured matches allowed');
  assert(
    searchIrrelevantData.suggestedAlternativeClues && searchIrrelevantData.suggestedAlternativeClues.length > 0,
    'Should suggest actual alternative topics from existing library'
  );
  console.log('  ✓ Honest empty state verified: 0 manufactured results with library topic suggestions.\n');

  // 8C: Refinement Filtering
  console.log('Audit 8C: POST /api/search with mustInclude refinement filter');
  const searchRefinedRes = await fetch(`${BASE_URL}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: "document about database",
      documents: testDocs,
      recallMode: true,
      refinements: {
        mustInclude: ['replication']
      }
    }),
  });
  assert.strictEqual(searchRefinedRes.status, 200);
  const searchRefinedData = await searchRefinedRes.json();
  assert.strictEqual(searchRefinedData.results.length, 1);
  assert.strictEqual(searchRefinedData.results[0].documentId, 'doc-sql');
  console.log('  ✓ Refinement filter strictly applied.\n');

  console.log('🎉 End-to-End Audit Completed Successfully! All assertions passed.\n');
}

runAudit().catch((err) => {
  console.error('❌ E2E Audit Failure:', err);
  process.exit(1);
});

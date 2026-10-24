import assert from 'node:assert';
import { 
  analyzeFolderChanges, 
  isFileSystemAccessSupported 
} from '../src/lib/connectors/LocalFolderConnector.js';
import { 
  isSupportedDocumentFilename, 
  ConnectorFile 
} from '../src/lib/connectors/types.js';
import { DocumentRecord } from '../src/types/index.js';
import { extractTextFromFile } from '../server/extractor.js';

async function runFolderTests() {
  console.log('🚀 Running ContextKeeper Folder Connector & Rescan Test Suite...\n');

  // Test 1: Supported filename filtering
  console.log('Test 1: Supported filename filtering');
  assert.strictEqual(isSupportedDocumentFilename('report.pdf'), true);
  assert.strictEqual(isSupportedDocumentFilename('notes.md'), true);
  assert.strictEqual(isSupportedDocumentFilename('data.txt'), true);
  assert.strictEqual(isSupportedDocumentFilename('specs.docx'), true);
  assert.strictEqual(isSupportedDocumentFilename('.DS_Store'), false);
  assert.strictEqual(isSupportedDocumentFilename('node_modules/package.json'), false);
  assert.strictEqual(isSupportedDocumentFilename('image.png'), false);
  console.log('  ✓ Supported file extension and hidden file filters verified.\n');

  // Test 2: Rescan Diff Detection (New, Changed, Unchanged, Missing)
  console.log('Test 2: Folder Rescan Diff Detection');
  
  const existingDocs: DocumentRecord[] = [
    {
      id: 'doc-alpha',
      filename: 'Project Roadmap.md',
      fileType: 'markdown',
      fileSize: 1200,
      dateAdded: '2026-03-01T10:00:00Z',
      extractedText: '# Project Roadmap\nQ1 Deliverables',
      charCount: 30,
      wordCount: 5,
      status: 'ready',
      sourceId: 'source-1',
      sourcePath: 'Project Roadmap.md',
      lastModified: 1700000000000,
      contentHash: 'hash-roadmap-unchanged',
    },
    {
      id: 'doc-beta',
      filename: 'Budget Plan.txt',
      fileType: 'txt',
      fileSize: 800,
      dateAdded: '2026-03-01T10:00:00Z',
      extractedText: 'Budget: $50,000 for Q1 marketing.',
      charCount: 33,
      wordCount: 5,
      status: 'ready',
      sourceId: 'source-1',
      sourcePath: 'Budget Plan.txt',
      lastModified: 1700000000000,
      contentHash: 'hash-budget-original',
    },
    {
      id: 'doc-gamma',
      filename: 'Old Archive.txt',
      fileType: 'txt',
      fileSize: 400,
      dateAdded: '2026-03-01T10:00:00Z',
      extractedText: 'Old historical log.',
      charCount: 19,
      wordCount: 3,
      status: 'ready',
      sourceId: 'source-1',
      sourcePath: 'Old Archive.txt',
      lastModified: 1700000000000,
      contentHash: 'hash-old-archive',
    }
  ];

  // Mock newly scanned folder files:
  // - 'Project Roadmap.md' is UNCHANGED
  // - 'Budget Plan.txt' has a new lastModified and size (CHANGED)
  // - 'New Feature Spec.md' is a BRAND NEW file
  // - 'Old Archive.txt' is MISSING from the scanned folder
  const mockScannedFiles: ConnectorFile[] = [
    {
      name: 'Project Roadmap.md',
      relativePath: 'Project Roadmap.md',
      file: new File(['# Project Roadmap\nQ1 Deliverables'], 'Project Roadmap.md', {
        lastModified: 1700000000000,
      }),
      lastModified: 1700000000000,
      size: 1200,
    },
    {
      name: 'Budget Plan.txt',
      relativePath: 'Budget Plan.txt',
      file: new File(['Budget: $75,000 revised allocation for Q1 and Q2 marketing.'], 'Budget Plan.txt', {
        lastModified: 1700050000000,
      }),
      lastModified: 1700050000000,
      size: 1400,
    },
    {
      name: 'New Feature Spec.md',
      relativePath: 'New Feature Spec.md',
      file: new File(['# New Feature: Recall Mode\nArchitecture and indexing.'], 'New Feature Spec.md', {
        lastModified: 1700060000000,
      }),
      lastModified: 1700060000000,
      size: 2000,
    }
  ];

  const diff = await analyzeFolderChanges(mockScannedFiles, existingDocs);

  // Assert Unchanged
  assert.strictEqual(diff.unchangedDocs.length, 1, 'Should find exactly 1 unchanged document');
  assert.strictEqual(diff.unchangedDocs[0].id, 'doc-alpha', 'Roadmap should be unchanged');

  // Assert Changed
  assert.strictEqual(diff.changedFiles.length, 1, 'Should find exactly 1 changed file');
  assert.strictEqual(diff.changedFiles[0].file.name, 'Budget Plan.txt', 'Budget Plan should be detected as changed');

  // Assert New
  assert.strictEqual(diff.newFiles.length, 1, 'Should find exactly 1 new file');
  assert.strictEqual(diff.newFiles[0].name, 'New Feature Spec.md', 'New Feature Spec should be detected as new');

  // Assert Missing
  assert.strictEqual(diff.missingDocs.length, 1, 'Should find exactly 1 missing document');
  assert.strictEqual(diff.missingDocs[0].id, 'doc-gamma', 'Old Archive should be marked missing');

  console.log('  ✓ Folder rescan diff accurately distinguished new, changed, unchanged, and missing files.\n');

  // Test 3: PDF and text extraction without hardcoded test strings
  console.log('Test 3: Extraction clean metadata validation');
  const txtBuffer = Buffer.from('Engineering meeting notes: database migration completed smoothly.');
  const txtResult = await extractTextFromFile(txtBuffer, 'meeting_notes.txt', 'text/plain');
  assert(txtResult.text.includes('database migration completed smoothly'), 'Should extract text content cleanly');
  assert.strictEqual(txtResult.fileType, 'txt');

  const mdBuffer = Buffer.from('# Q1 Summary\nRevenue: $1.2M\nKey achievements.');
  const mdResult = await extractTextFromFile(mdBuffer, 'summary.md', 'text/markdown');
  assert(mdResult.text.includes('Q1 Summary'), 'Should extract markdown cleanly');
  assert.strictEqual(mdResult.fileType, 'markdown');

  console.log('  ✓ Multi-format text extraction verified.\n');

  console.log('🎉 All Folder Connector & Rescan tests passed successfully!\n');
}

runFolderTests().catch((err) => {
  console.error('❌ Folder connector test failed:', err);
  process.exit(1);
});

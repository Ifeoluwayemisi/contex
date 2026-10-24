export interface GemmaMetadata {
  summary: string;
  topics: string[];
  keywords: string[];
  documentType: string;
  distinctivePhrases: string[];
  dateMentions: string[];
  suggestedCollections: string[];
}

export interface DocumentPage {
  pageNum: number;
  text: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface UserSearchHistory {
  id: string;
  userId: string;
  query: string;
  recallMode: boolean;
  resultsCount: number;
  timestamp: string;
  matchedTitles?: string[];
}

export interface UserSavedSearch {
  id: string;
  userId: string;
  query: string;
  label: string;
  recallMode: boolean;
  timestamp: string;
}

export interface SourceRecord {
  id: string;
  name: string;
  type: 'local_folder' | 'file_upload' | 'cloud_drive';
  folderPath?: string;
  lastScanned?: string;
  fileCount: number;
  status: 'connected' | 'permission_required' | 'missing' | 'syncing';
}

export interface FolderRescanResult {
  sourceId: string;
  newCount: number;
  changedCount: number;
  unchangedCount: number;
  missingCount: number;
  errors: { filename: string; error: string }[];
}

export interface DocumentRecord {
  id: string;
  filename: string;
  fileType: 'pdf' | 'docx' | 'txt' | 'markdown' | 'csv' | 'json' | 'code' | 'other';
  fileSize: number;
  dateAdded: string;
  extractedText: string;
  charCount: number;
  wordCount: number;
  pageCount?: number;
  pages?: DocumentPage[];
  status: 'uploading' | 'extracting' | 'indexing' | 'ready' | 'error';
  errorMessage?: string;
  aiIndexingFailed?: boolean;
  metadata?: GemmaMetadata;
  customCollections?: string[];
  sourceId?: string;
  sourceType?: 'local_folder' | 'file_upload' | 'sample_pack';
  sourcePath?: string;
  lastModified?: number;
  contentHash?: string;
  isMissing?: boolean;
}

export interface MatchedClue {
  clue: string;
  isUncertain: boolean;
  matchedIn: 'filename' | 'summary' | 'topics' | 'keywords' | 'content' | 'metadata';
}

export interface InterpretedRecallClues {
  coreConcepts: string[];
  uncertainAspects: string[];
  possiblePhrases: string[];
  timeClues: string[];
  docTypeClue?: string;
  recollectionSummary: string;
}

export interface SearchRefinements {
  mustInclude?: string[];
  docTypeHint?: string;
  timeHint?: string;
}

export interface SearchEvidence {
  snippet: string;
  pageNumber?: number;
  locationLabel?: string;
  isExactQuote: boolean;
  verbatimExcerpt: string;
}

export interface SearchResultItem {
  documentId: string;
  document: DocumentRecord;
  relevanceScore: number;
  explanation: string;
  keyMatchReason: string;
  evidence: SearchEvidence;
  quoteVerified: boolean;
  matchType: 'direct_and_semantic' | 'content_match' | 'metadata_match';
  matchedClues?: MatchedClue[];
  confidenceLevel?: 'high' | 'moderate' | 'weak';
}

export interface SearchResponsePayload {
  query: string;
  resultsCount: number;
  results: SearchResultItem[];
  recallMode: boolean;
  interpretedClues?: InterpretedRecallClues;
  suggestedAlternativeClues?: string[];
}

export interface SmartCollection {
  id: string;
  name: string;
  documentCount: number;
  documentIds: string[];
  isAutoSuggested: boolean;
  sampleTopics: string[];
}

export interface RelatedDocumentResult {
  targetDocId: string;
  targetDocFilename: string;
  similarityScore: number;
  explanation: string;
  sharedTopics: string[];
}

export interface ModelInfo {
  modelId: string;
  displayName: string;
  provider: string;
  status: 'available' | 'error' | 'checking';
  inferenceEndpoint: string;
  privacyNotice: string;
  latencyMs?: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface UserSearchHistory {
  id: string;
  userId: string;
  query: string;
  recallMode: boolean;
  resultsCount: number;
  timestamp: string;
  matchedTitles?: string[];
  filters?: {
    fileType?: string;
    topic?: string;
  };
}

export interface UserSavedSearch {
  id: string;
  userId: string;
  query: string;
  label: string;
  notes?: string;
  recallMode: boolean;
  timestamp: string;
  filters?: {
    fileType?: string;
    topic?: string;
  };
}

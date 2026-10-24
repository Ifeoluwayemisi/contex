/**
 * ContextKeeper Model and Backend Configuration
 * 
 * Mandatory requirement: Google Gemma is the runtime model.
 * Never substitute Gemini for Gemma in runtime AI tasks.
 */

export const CONFIG = {
  // Primary Gemma open-weight model accessed via Google AI Studio API
  GEMMA_MODEL_ID: process.env.GEMMA_MODEL_ID || 'gemma-4-26b-a4b-it',
  FALLBACK_GEMMA_MODEL_ID: 'gemma-4-31b-it',
  
  // File processing limits
  MAX_FILE_SIZE_BYTES: 15 * 1024 * 1024, // 15MB
  ALLOWED_EXTENSIONS: ['.pdf', '.txt', '.md', '.markdown'],
  MAX_INDEXING_CHARS: 12000, // Optimal token context window for fast, reliable Gemma inference without server timeouts
  
  // Inference settings
  TEMPERATURE: 0.1, // Low temperature for high factual accuracy and zero hallucination
  
  // Service provider info
  PROVIDER_NAME: 'Google AI Studio (Gemma Open-Weight Inference)',
  PRIVACY_DISCLOSURE: 'Documents are processed via hosted Google Gemma inference. Extracted text is transmitted strictly for indexing and summarization. Your personal document library, extracted text, and generated metadata are stored locally in your browser (IndexedDB).'
};

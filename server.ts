import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './server/config.js';
import { extractTextFromFile } from './server/extractor.js';
import { 
  analyzeDocumentWithGemma, 
  explainDocumentRelationship, 
  verifyGemmaModelAvailability,
  generateDeterministicMetadata 
} from './server/gemma.js';
import { searchDocumentsPipeline } from './server/search.js';
import { 
  authMiddleware,
  requireAuth,
  registerUser,
  loginUser,
  logoutSession,
  getUserHistory,
  addSearchHistory,
  deleteUserHistoryItem,
  clearUserHistory,
  getUserSavedSearches,
  addSavedSearch,
  deleteSavedSearch,
  UserRecord
} from './server/auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Prevent unhandled errors from terminating the Node server process
process.on('uncaughtException', (err) => {
  console.error('Server uncaughtException:', err.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Server unhandledRejection:', reason);
});

// Enable CORS and connection resilience for cross-origin iframes
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Auth-Token');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Attach user session if token present
app.use(authMiddleware);

// Multer in-memory storage for file uploads (supports up to 50 files per batch)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: CONFIG.MAX_FILE_SIZE_BYTES,
  },
});

// Cache model availability check for 30 seconds
let cachedModelInfo: { timestamp: number; data: any } | null = null;

// --- AUTHENTICATION ROUTES ---

/**
 * POST /api/auth/signup
 * Registers a new user account with hashed password and returns session token.
 */
app.post('/api/auth/signup', (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const result = registerUser(email, password, name);
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Registration failed.' });
  }
});

/**
 * POST /api/auth/login
 * Verifies credentials and issues a secure session token.
 */
app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const result = loginUser(email, password);
    return res.json(result);
  } catch (err: any) {
    return res.status(401).json({ error: err.message || 'Invalid email or password.' });
  }
});

/**
 * POST /api/auth/logout
 * Destroys current session token on the server.
 */
app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || (req.headers['x-auth-token'] as string);
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (authHeader) {
    token = authHeader.trim();
  }
  if (token) {
    logoutSession(token);
  }
  return res.json({ success: true, message: 'Logged out successfully.' });
});

/**
 * GET /api/auth/me
 * Returns authenticated user info or null if signed out.
 */
app.get('/api/auth/me', (req: Request & { user?: Omit<UserRecord, 'passwordHash'> }, res: Response) => {
  if (!req.user) {
    return res.json({ user: null });
  }
  return res.json({ user: req.user });
});

// --- PROTECTED ACCOUNT HISTORY ROUTES ---

/**
 * GET /api/history
 * Returns search history strictly isolated to the authenticated user.
 */
app.get('/api/history', requireAuth, (req: Request & { user?: Omit<UserRecord, 'passwordHash'> }, res: Response) => {
  const history = getUserHistory(req.user!.id);
  return res.json({ history });
});

/**
 * POST /api/history
 * Records a search query into the authenticated user's history.
 */
app.post('/api/history', requireAuth, (req: Request & { user?: Omit<UserRecord, 'passwordHash'> }, res: Response) => {
  const { query, recallMode, resultsCount, matchedTitles } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query is required.' });
  }
  const entry = addSearchHistory(req.user!.id, query, recallMode !== false, Number(resultsCount) || 0, matchedTitles);
  return res.status(201).json({ entry });
});

/**
 * DELETE /api/history/:id
 * Removes a specific history entry owned by the authenticated user.
 */
app.delete('/api/history/:id', requireAuth, (req: Request & { user?: Omit<UserRecord, 'passwordHash'> }, res: Response) => {
  const { id } = req.params;
  const deleted = deleteUserHistoryItem(req.user!.id, id);
  if (!deleted) {
    return res.status(404).json({ error: 'History entry not found or unauthorized.' });
  }
  return res.json({ success: true });
});

/**
 * DELETE /api/history
 * Clears all search history for the authenticated user.
 */
app.delete('/api/history', requireAuth, (req: Request & { user?: Omit<UserRecord, 'passwordHash'> }, res: Response) => {
  clearUserHistory(req.user!.id);
  return res.json({ success: true, message: 'History cleared.' });
});

// --- PROTECTED SAVED SEARCHES ROUTES ---

/**
 * GET /api/saved-searches
 * Retrieves saved searches for the authenticated user.
 */
app.get('/api/saved-searches', requireAuth, (req: Request & { user?: Omit<UserRecord, 'passwordHash'> }, res: Response) => {
  const saved = getUserSavedSearches(req.user!.id);
  return res.json({ savedSearches: saved });
});

/**
 * POST /api/saved-searches
 * Saves a search for the authenticated user.
 */
app.post('/api/saved-searches', requireAuth, (req: Request & { user?: Omit<UserRecord, 'passwordHash'> }, res: Response) => {
  const { query, label, recallMode } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query is required.' });
  }
  const saved = addSavedSearch(req.user!.id, query, label || query, recallMode !== false);
  return res.status(201).json({ savedSearch: saved });
});

/**
 * DELETE /api/saved-searches/:id
 * Removes a saved search owned by the authenticated user.
 */
app.delete('/api/saved-searches/:id', requireAuth, (req: Request & { user?: Omit<UserRecord, 'passwordHash'> }, res: Response) => {
  const { id } = req.params;
  const deleted = deleteSavedSearch(req.user!.id, id);
  if (!deleted) {
    return res.status(404).json({ error: 'Saved search not found or unauthorized.' });
  }
  return res.json({ success: true });
});

// --- GENERAL APPLICATION API ROUTES ---

/**
 * GET /api/model-info
 * Returns the currently active Gemma model ID, endpoint, status, and privacy disclosure.
 */
app.get('/api/model-info', async (_req: Request, res: Response) => {
  const now = Date.now();
  if (cachedModelInfo && now - cachedModelInfo.timestamp < 30000) {
    return res.json(cachedModelInfo.data);
  }

  const check = await verifyGemmaModelAvailability();
  const info = {
    modelId: check.modelId,
    displayName: 'Google Gemma 4 26B (Open-Weight)',
    provider: CONFIG.PROVIDER_NAME,
    status: check.available ? 'available' : 'error',
    error: check.error,
    latencyMs: check.latencyMs,
    inferenceEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/' + check.modelId,
    privacyNotice: CONFIG.PRIVACY_DISCLOSURE,
  };

  cachedModelInfo = { timestamp: now, data: info };
  return res.json(info);
});

/**
 * POST /api/upload
 * Ingests multiple files, extracts text, and returns extraction results.
 */
app.post('/api/upload', (req: Request, res: Response) => {
  upload.array('files', 50)(req, res, async (err: any) => {
    if (err) {
      console.warn('Upload error from multer:', err.message || err);
      const isSizeLimit = err.code === 'LIMIT_FILE_SIZE';
      return res.status(400).json({
        error: isSizeLimit
          ? `File exceeds the maximum upload limit of 15MB.`
          : (err.message || 'File upload failed.')
      });
    }

    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded.' });
      }

      const results = [];

      for (const file of files) {
        const originalName = file.originalname || 'document.txt';
        const extraction = await extractTextFromFile(file.buffer, originalName, file.mimetype);

        results.push({
          filename: originalName,
          fileSize: file.size,
          fileType: extraction.fileType,
          extractedText: extraction.text,
          charCount: extraction.charCount,
          wordCount: extraction.wordCount,
          pageCount: extraction.pageCount,
          pages: extraction.pages,
          error: extraction.error,
        });
      }

      return res.json({ documents: results });
    } catch (extractErr: any) {
      console.warn('Document extraction error:', extractErr.message || extractErr);
      return res.status(500).json({
        error: extractErr.message || 'Failed to extract text from document.'
      });
    }
  });
});

/**
 * POST /api/index-document
 * Runs Gemma indexing on an extracted document to produce structured metadata.
 */
app.post('/api/index-document', async (req: Request, res: Response) => {
  try {
    const { filename, extractedText } = req.body;
    if (!filename || !extractedText) {
      return res.status(400).json({ error: 'Filename and extractedText are required.' });
    }

    try {
      const metadata = await analyzeDocumentWithGemma(filename, extractedText);
      return res.json({
        success: true,
        metadata,
      });
    } catch (aiErr: any) {
      console.warn(`Gemma indexing notice for "${filename}": ${aiErr.message || 'Preserving extracted text'}`);
      const fallbackMetadata = generateDeterministicMetadata(filename, extractedText);
      return res.json({
        success: true,
        aiIndexingFailed: true,
        errorMessage: 'Gemma indexing encountered a temporary error. Document text is preserved for full-text search.',
        metadata: fallbackMetadata,
      });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Indexing failed.' });
  }
});

/**
 * POST /api/search
 * Executes Recall Mode natural language search with clue extraction, Gemma explanation, and quote verification.
 * If user is authenticated, saves search to user-isolated history.
 */
app.post('/api/search', async (req: Request & { user?: Omit<UserRecord, 'passwordHash'> }, res: Response) => {
  try {
    const { query, documents, recallMode, refinements } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query string is required.' });
    }
    if (!documents || !Array.isArray(documents)) {
      return res.status(400).json({ error: 'Documents array is required.' });
    }

    const payload = await searchDocumentsPipeline(
      query,
      documents,
      recallMode !== false,
      refinements
    );

    // If authenticated, record to search history
    if (req.user) {
      try {
        const topTitles = payload.results.map((r) => r.document.filename).slice(0, 3);
        addSearchHistory(req.user.id, query, recallMode !== false, payload.resultsCount, topTitles);
      } catch {
        // Do not fail search if history recording encounters an issue
      }
    }

    return res.json(payload);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Search execution failed.' });
  }
});

/**
 * POST /api/related
 * Explains connection between two documents using Gemma.
 */
app.post('/api/related', async (req: Request, res: Response) => {
  try {
    const { doc1, doc2 } = req.body;
    if (!doc1 || !doc2) {
      return res.status(400).json({ error: 'doc1 and doc2 required.' });
    }

    const explanation = await explainDocumentRelationship(
      doc1.filename,
      doc1.summary || '',
      doc1.topics || [],
      doc2.filename,
      doc2.summary || '',
      doc2.topics || []
    );

    return res.json({ explanation });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Relationship analysis failed.' });
  }
});

// Guard: Guarantee all unhandled /api and /api/* requests return JSON 404 and NEVER fall through to HTML
app.all(['/api', '/api/*'], (req: Request, res: Response) => {
  res.status(404).json({
    error: `API endpoint ${req.method} ${req.originalUrl || req.url} not found.`
  });
});

// Start server and mount Vite
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // In development mode, mount Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  // Centralized error handling must be the very last middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Server unhandled error:", err);
    const status = err.status || 500;
    const message = err.message || 'Internal server error';
    res.status(status).json({ error: message });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ContextKeeper full-stack server running on http://0.0.0.0:${PORT}`);
    console.log(`Model backend configured with: ${CONFIG.GEMMA_MODEL_ID}`);
  });
}

startServer();

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Request, Response, NextFunction } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'auth_store.json');

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: number;
}

export interface SearchHistoryRecord {
  id: string;
  userId: string;
  query: string;
  recallMode: boolean;
  resultsCount: number;
  timestamp: string;
  matchedTitles?: string[];
}

export interface SavedSearchRecord {
  id: string;
  userId: string;
  query: string;
  label: string;
  recallMode: boolean;
  timestamp: string;
}

interface AuthStore {
  users: Record<string, UserRecord>;
  sessions: Record<string, SessionRecord>;
  history: SearchHistoryRecord[];
  savedSearches: SavedSearchRecord[];
}

// Ensure database directory and file exist
function initStore(): AuthStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_FILE)) {
      const initial: AuthStore = {
        users: {},
        sessions: {},
        history: [],
        savedSearches: [],
      };
      fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const content = fs.readFileSync(STORE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error initializing auth store:', err);
    return { users: {}, sessions: {}, history: [], savedSearches: [] };
  }
}

let store: AuthStore = initStore();

function persistStore(): void {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist auth store:', err);
  }
}

/**
 * Hashes a password using crypto.scryptSync with a 16-byte random salt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Validates a plaintext password against a stored salt:derivedKey hash using constant-time comparison.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Registers a new user account with validated credentials.
 */
export function registerUser(email: string, password: string, name?: string): { user: Omit<UserRecord, 'passwordHash'>; token: string } {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@') || normalizedEmail.length < 5) {
    throw new Error('Please provide a valid email address.');
  }
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters in length.');
  }

  // Check existing user
  const existing = Object.values(store.users).find((u) => u.email === normalizedEmail);
  if (existing) {
    throw new Error('An account with this email address already exists.');
  }

  const userId = `user_${crypto.randomUUID()}`;
  const passwordHash = hashPassword(password);
  const displayName = (name || normalizedEmail.split('@')[0]).trim();

  const user: UserRecord = {
    id: userId,
    email: normalizedEmail,
    passwordHash,
    name: displayName,
    createdAt: new Date().toISOString(),
  };

  store.users[userId] = user;

  // Create session
  const token = crypto.randomBytes(32).toString('hex');
  const session: SessionRecord = {
    token,
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000, // 14 days
  };
  store.sessions[token] = session;

  persistStore();

  const { passwordHash: _, ...safeUser } = user;
  return { user: safeUser, token };
}

/**
 * Authenticates user credentials and creates a persistent session.
 */
export function loginUser(email: string, password: string): { user: Omit<UserRecord, 'passwordHash'>; token: string } {
  const normalizedEmail = email.trim().toLowerCase();
  const user = Object.values(store.users).find((u) => u.email === normalizedEmail);
  if (!user) {
    throw new Error('Invalid email or password.');
  }

  const isValid = verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new Error('Invalid email or password.');
  }

  // Create new session token
  const token = crypto.randomBytes(32).toString('hex');
  const session: SessionRecord = {
    token,
    userId: user.id,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
  };
  store.sessions[token] = session;
  persistStore();

  const { passwordHash: _, ...safeUser } = user;
  return { user: safeUser, token };
}

/**
 * Invalidates an active session token.
 */
export function logoutSession(token: string): void {
  if (store.sessions[token]) {
    delete store.sessions[token];
    persistStore();
  }
}

/**
 * Retrieves the user record for an active session token.
 */
export function getUserByToken(token: string): Omit<UserRecord, 'passwordHash'> | null {
  if (!token) return null;
  const session = store.sessions[token];
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    delete store.sessions[token];
    persistStore();
    return null;
  }
  const user = store.users[session.userId];
  if (!user) return null;
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

/**
 * Express middleware to attach authenticated user to req.user if valid token is provided.
 */
export function authMiddleware(req: Request & { user?: Omit<UserRecord, 'passwordHash'> }, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || (req.headers['x-auth-token'] as string);
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (authHeader) {
    token = authHeader.trim();
  }

  if (token) {
    const user = getUserByToken(token);
    if (user) {
      req.user = user;
    }
  }

  next();
}

/**
 * Guard middleware that strictly requires authentication. Rejects unauthenticated requests with HTTP 401.
 */
export function requireAuth(req: Request & { user?: Omit<UserRecord, 'passwordHash'> }, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required. Please sign in to access this feature.',
    });
  }
  next();
}

// --- USER-ISOLATED SEARCH HISTORY ---

export function getUserHistory(userId: string): SearchHistoryRecord[] {
  return store.history
    .filter((h) => h.userId === userId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function addSearchHistory(
  userId: string,
  query: string,
  recallMode: boolean,
  resultsCount: number,
  matchedTitles?: string[]
): SearchHistoryRecord {
  const record: SearchHistoryRecord = {
    id: `hist_${crypto.randomUUID()}`,
    userId,
    query: query.trim(),
    recallMode,
    resultsCount,
    timestamp: new Date().toISOString(),
    matchedTitles: matchedTitles?.slice(0, 3),
  };

  store.history.unshift(record);
  // Cap user history to 100 items per user
  const userCount = store.history.filter((h) => h.userId === userId).length;
  if (userCount > 100) {
    let lastIdx = -1;
    for (let i = store.history.length - 1; i >= 0; i--) {
      if (store.history[i].userId === userId) {
        lastIdx = i;
        break;
      }
    }
    if (lastIdx !== -1) {
      store.history.splice(lastIdx, 1);
    }
  }

  persistStore();
  return record;
}

export function deleteUserHistoryItem(userId: string, historyId: string): boolean {
  const index = store.history.findIndex((h) => h.id === historyId && h.userId === userId);
  if (index !== -1) {
    store.history.splice(index, 1);
    persistStore();
    return true;
  }
  return false;
}

export function clearUserHistory(userId: string): void {
  store.history = store.history.filter((h) => h.userId !== userId);
  persistStore();
}

// --- USER-ISOLATED SAVED SEARCHES ---

export function getUserSavedSearches(userId: string): SavedSearchRecord[] {
  return store.savedSearches
    .filter((s) => s.userId === userId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function addSavedSearch(
  userId: string,
  query: string,
  label: string,
  recallMode = true
): SavedSearchRecord {
  const existing = store.savedSearches.find((s) => s.userId === userId && s.query.toLowerCase() === query.trim().toLowerCase());
  if (existing) {
    return existing;
  }

  const record: SavedSearchRecord = {
    id: `save_${crypto.randomUUID()}`,
    userId,
    query: query.trim(),
    label: label.trim() || query.trim(),
    recallMode,
    timestamp: new Date().toISOString(),
  };

  store.savedSearches.unshift(record);
  persistStore();
  return record;
}

export function deleteSavedSearch(userId: string, searchId: string): boolean {
  const index = store.savedSearches.findIndex((s) => s.id === searchId && s.userId === userId);
  if (index !== -1) {
    store.savedSearches.splice(index, 1);
    persistStore();
    return true;
  }
  return false;
}

// Test Suite Helpers
export const createUser = (email: string, pass: string, name?: string) => registerUser(email, pass, name).user;
export const verifyUserCredentials = (email: string, pass: string) => {
  try {
    return loginUser(email, pass).user;
  } catch {
    return null;
  }
};
export const createSession = (userId: string) => {
  const token = crypto.randomBytes(32).toString('hex');
  store.sessions[token] = {
    token,
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
  };
  persistStore();
  return token;
};
export const verifySessionToken = (token: string) => getUserByToken(token);
export const revokeSession = (token: string) => logoutSession(token);

/**
 * Centralized API Client for ContextKeeper
 * 
 * Ensures credentials: 'include' is always set for partitioned iframe cookies,
 * handles transient retry on network drops, and provides safe JSON parsing.
 */

export class ApiError extends Error {
  status?: number;
  isHtmlResponse?: boolean;

  constructor(message: string, status?: number, isHtmlResponse?: boolean) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isHtmlResponse = isHtmlResponse;
  }
}

const AUTH_TOKEN_KEY = 'contextkeeper_auth_token';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    // Ignore storage failure
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Ignore storage failure
  }
}

/**
 * Executes a fetch request with credentials: 'include' and automatic transient retry.
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {},
  retries = 2
): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const finalOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
  };

  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, finalOptions);
      return res;
    } catch (err: any) {
      if (i === retries) {
        throw new ApiError(
          err.message?.toLowerCase().includes('failed to fetch')
            ? 'Network connection interrupted. Please check your connection and try again.'
            : (err.message || 'Network request failed.')
        );
      }
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }

  throw new ApiError('Request timed out after retries.');
}

/**
 * Safely parses JSON from a Response object, detecting HTML redirects/fallbacks.
 */
export async function parseJsonSafely<T = any>(
  response: Response,
  endpointLabel: string
): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!response.ok) {
    if (isJson) {
      const errData = await response.json().catch(() => null);
      throw new ApiError(
        errData?.error || errData?.message || `Request to ${endpointLabel} failed (${response.status} ${response.statusText}).`,
        response.status
      );
    } else {
      const text = await response.text().catch(() => '');
      const isHtml = text.includes('<!doctype') || text.includes('<html');
      throw new ApiError(
        isHtml
          ? `Server returned an HTML error page (${response.status} ${response.statusText}) for ${endpointLabel}.`
          : `Request to ${endpointLabel} failed (${response.status} ${response.statusText}): ${text.slice(0, 100)}`,
        response.status,
        isHtml
      );
    }
  }

  if (!isJson) {
    const text = await response.text().catch(() => '');
    const isHtml = text.includes('<!doctype') || text.includes('<html') || response.redirected;
    throw new ApiError(
      isHtml
        ? `Server returned an HTML page (${response.status} ${response.statusText}) instead of JSON for ${endpointLabel}.`
        : `Expected JSON from ${endpointLabel} but received ${contentType || 'non-JSON payload'}.`,
      response.status,
      isHtml
    );
  }

  try {
    return await response.json();
  } catch (err: any) {
    throw new ApiError(`Invalid JSON from ${endpointLabel}: ${err.message}`);
  }
}

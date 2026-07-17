/**
 * Token storage: memory + sessionStorage fallback.
 *
 * - Module-level variable for fast access (XSS-resistant during page lifetime)
 * - sessionStorage persistence for refresh survival (cleared on tab close)
 */

const KEY = 'aiops_token';
let _token: string | null = null;

export function getToken(): string | null {
  if (_token) return _token;
  try {
    const stored = sessionStorage.getItem(KEY);
    if (stored) {
      _token = stored;
      return _token;
    }
  } catch {}
  return null;
}

export function setToken(token: string): void {
  _token = token;
  try { sessionStorage.setItem(KEY, token); } catch {}
}

export function clearToken(): void {
  _token = null;
  try { sessionStorage.removeItem(KEY); } catch {}
}

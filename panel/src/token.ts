/**
 * Memory-based token storage (replaces localStorage for XSS resistance).
 *
 * Before: JWT lived in localStorage — vulnerable to XSS token theft.
 * After:  Token lives in a module-level variable; invisible to `window`-based attacks.
 */

let _token: string | null = null;

export function getToken(): string | null {
  return _token;
}

export function setToken(token: string): void {
  _token = token;
}

export function clearToken(): void {
  _token = null;
}

const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || '';

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

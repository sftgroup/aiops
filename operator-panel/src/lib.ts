const BASE = (import.meta as any).env?.VITE_OPERATOR_API || '';

export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('operator_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init?.headers as Record<string, string>) || {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

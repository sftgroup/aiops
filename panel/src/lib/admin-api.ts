export const ADMIN_BASE = '/api/operator';

export async function adminGet(path: string, params?: Record<string, string>): Promise<any> {
  const token = localStorage.getItem('operator_token');
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  const res = await fetch(`${ADMIN_BASE}${path}${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) { localStorage.removeItem('operator_token'); window.location.href = '/operator/login'; }
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || res.statusText); }
  return res.json();
}

export async function adminPost(path: string, body: any): Promise<any> {
  const token = localStorage.getItem('operator_token');
  const res = await fetch(`${ADMIN_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (res.status === 401) { localStorage.removeItem('operator_token'); window.location.href = '/operator/login'; }
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || res.statusText); }
  return res.json();
}

export async function adminPut(path: string, body: any): Promise<any> {
  const token = localStorage.getItem('operator_token');
  const res = await fetch(`${ADMIN_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (res.status === 401) { localStorage.removeItem('operator_token'); window.location.href = '/operator/login'; }
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || res.statusText); }
  return res.json();
}

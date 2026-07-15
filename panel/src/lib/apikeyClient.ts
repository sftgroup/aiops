import { apiUrl } from './api';
import { getToken } from '../token';
const API = '/api/settings';

async function request(method: string, path: string, body?: any) {
  const token = getToken();
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(apiUrl(`${API}${path}`), opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export interface ApiKeys {
  [service: string]: { configured: boolean };
}

export async function fetchApiKeys(): Promise<ApiKeys> {
  return request('GET', '/keys');
}

export async function saveApiKey(service: string, key: string): Promise<void> {
  await request('PUT', '/keys', { service, key });
}

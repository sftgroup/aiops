import { apiUrl } from './api';
import { getToken } from '../token';

async function request(method: string, path: string, body?: any) {
  const token = getToken();
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(apiUrl(`/api/profile${path}`), opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Profile update failed');
  return data;
}

export interface ProfileData {
  user: { id: string; username: string; email: string; name: string; walletAddress?: string; avatarUrl?: string };
  tenant: { id: string; name: string; plan: string; status: string };
}

export async function fetchProfile(): Promise<ProfileData> {
  return request('GET', '');
}

export async function updateProfile(data: { name?: string; email?: string }): Promise<ProfileData> {
  return request('PUT', '', data);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await request('PUT', '/password', { currentPassword, newPassword });
}

export async function setEmailPassword(email: string, password: string): Promise<void> {
  await request('POST', '/bind-email', { email, password });
}

export async function deleteAccount(password: string): Promise<void> {
  await request('DELETE', '', { password });
}

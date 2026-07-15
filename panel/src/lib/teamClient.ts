import { apiUrl } from './api';
import { getToken } from '../token';

async function request(method: string, path: string, body?: any) {
  const token = getToken();
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(apiUrl(`/api/team${path}`), opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Team request failed');
  return data;
}

export interface TeamMember {
  id: string;
  tenantId: string;
  userId: string;
  role: string;
  status: string;
  email: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  joinedAt: string;
}

export async function fetchMembers(): Promise<TeamMember[]> {
  const result = await request('GET', '/members');
  return result.items || result;
}

export async function inviteMember(email: string, role: string): Promise<void> {
  await request('POST', '/invite', { email, role });
}

export async function removeMember(id: string): Promise<void> {
  await request('DELETE', `/${id}`);
}

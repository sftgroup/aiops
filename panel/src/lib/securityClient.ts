import { apiUrl } from './api';
import { getToken } from '../token';

async function request(method: string, path: string, body?: any) {
  const token = getToken();
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(apiUrl(`/api/settings${path}`), opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export interface IpWhitelistConfig {
  enabled: boolean;
  ips: string[];
}

export async function fetchIpWhitelist(): Promise<IpWhitelistConfig> {
  return request('GET', '/ip-whitelist');
}

export async function saveIpWhitelist(config: IpWhitelistConfig): Promise<IpWhitelistConfig> {
  return request('PUT', '/ip-whitelist', config);
}

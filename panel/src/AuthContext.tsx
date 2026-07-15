import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getToken, setToken as setMemToken, clearToken } from './token';

const API = '/api';

interface User { id: string; username: string; name?: string; walletAddress?: string | null; }
interface AuthCtx {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  walletLogin: (address: string, signature: string, message: string, nonce?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(d => { setUser({ ...d.user, username: d.user.username || d.user.name || d.user.email }); })
        .catch(() => { clearToken(); setToken(null); setUser(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = useCallback(async (username: string, password: string) => {
    const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: username, password }) });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error || '登录失败'); }
    const d = await r.json();
    setMemToken(d.token);
    setToken(d.token);
    setUser({ ...d.user, username: d.user.username || d.user.name || d.user.email });
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const r = await fetch(`${API}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, email, password }) });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error || '注册失败'); }
    const d = await r.json();
    setMemToken(d.token);
    setToken(d.token);
    setUser({ ...d.user, username: d.user.username || d.user.name || d.user.email });
  }, []);

  const walletLogin = useCallback(async (address: string, signature: string, message: string, nonce?: string) => {
    const r = await fetch(`${API}/auth/wallet-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, signature, message, nonce }),
    });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error || '钱包登录失败'); }
    const d = await r.json();
    setMemToken(d.token);
    setToken(d.token);
    setUser({ ...d.user, username: d.user.username || d.user.name || d.user.email });
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setToken(null);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, token, loading, login, register, walletLogin, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }

export function api(token: string | null) {
  return {
    get: async (url: string, signal?: AbortSignal) => {
      const r = await fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${token}` }, signal });
      if (!r.ok) throw new Error((await r.json()).error || '请求失败');
      return r.json();
    },
    post: async (url: string, body?: Record<string, unknown>) => {
      const r = await fetch(`${API}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
      if (!r.ok) throw new Error((await r.json()).error || '请求失败');
      return r.json();
    },
    put: async (url: string, body?: Record<string, unknown>) => {
      const r = await fetch(`${API}${url}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
      if (!r.ok) throw new Error((await r.json()).error || '请求失败');
      return r.json();
    },
    del: async (url: string) => {
      const r = await fetch(`${API}${url}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error((await r.json()).error || '请求失败');
      return r.json();
    },
  };
}

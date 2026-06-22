import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API = '/api';

interface User { id: string; username: string; }
interface AuthCtx {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(d => { setUser(d.user); })
        .catch(() => { localStorage.removeItem('token'); setToken(null); setUser(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = useCallback(async (username: string, password: string) => {
    const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error || '登录失败'); }
    const d = await r.json();
    localStorage.setItem('token', d.token);
    setToken(d.token);
    setUser(d.user);
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const r = await fetch(`${API}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error || '注册失败'); }
    const d = await r.json();
    localStorage.setItem('token', d.token);
    setToken(d.token);
    setUser(d.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }

export function api(token: string | null) {
  return {
    get: async (url: string, signal?: AbortSignal) => {
      const r = await fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${token}` }, signal });
      if (!r.ok) throw new Error((await r.json()).error || '请求失败');
      return r.json();
    },
    post: async (url: string, body?: any) => {
      const r = await fetch(`${API}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
      if (!r.ok) throw new Error((await r.json()).error || '请求失败');
      return r.json();
    },
    put: async (url: string, body?: any) => {
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

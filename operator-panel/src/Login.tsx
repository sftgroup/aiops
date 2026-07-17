import { useState } from 'react';
import { Shield } from 'lucide-react';
import { api } from './lib';

export default function Login({ onLogin }: { onLogin: (token: string, admin: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api<{ token: string; admin: any }>('/api/operator/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      onLogin(res.token, res.admin);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a14 0%, #111133 100%)',
    }}>
      <div style={{
        width: 400, background: '#111122', borderRadius: 16, border: '1px solid #1e1e3a',
        padding: 40, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <Shield size={28} color="white" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e5e7eb' }}>Aiops Operator</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>管理后台登录</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#9ca3af', marginBottom: 6 }}>邮箱</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@aiops.dev"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #2a2a3e',
                background: '#0a0a14', color: '#e5e7eb', fontSize: 14, outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = '#6366f1'; }}
              onBlur={e => { e.target.style.borderColor = '#2a2a3e'; }}
              required
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#9ca3af', marginBottom: 6 }}>密码</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #2a2a3e',
                background: '#0a0a14', color: '#e5e7eb', fontSize: 14, outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = '#6366f1'; }}
              onBlur={e => { e.target.style.borderColor = '#2a2a3e'; }}
              required
            />
          </div>
          {error && (
            <div style={{
              background: '#3b1010', border: '1px solid #5c1a1a', borderRadius: 8,
              padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 16,
            }}>{error}</div>
          )}
          <button type="submit" disabled={loading}
            style={{
              width: '100%', padding: '12px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white', fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s',
            }}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}

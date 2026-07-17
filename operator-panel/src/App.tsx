import { useState, useEffect } from 'react';
import { Layout, Shield, Key, Users, Building2, Settings, Package } from 'lucide-react';
import Dashboard from './Dashboard';
import ApiKeys from './ApiKeys';
import Tenants from './Tenants';
import UsersPage from './Users';
import SystemSettings from './SystemSettings';
import PlansPage from './Plans';
import Login from './Login';
import { api } from './lib';

type Tab = 'dashboard' | 'apikeys' | 'tenants' | 'users' | 'plans' | 'settings';

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [admin, setAdmin] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('operator_token');
    if (!token) {
      setLoading(false);
      return;
    }
    // Verify token is still valid
    api('/api/operator/dashboard')
      .then(() => { setAuthed(true); setLoading(false); })
      .catch(() => { localStorage.removeItem('operator_token'); setLoading(false); });
  }, []);

  const handleLogin = (token: string, adminData: any) => {
    localStorage.setItem('operator_token', token);
    setAdmin(adminData);
    setAuthed(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('operator_token');
    setAuthed(false);
    setAdmin(null);
  };

  if (loading) return <div className="loading-screen">Loading...</div>;

  if (!authed) return <Login onLogin={handleLogin} />;

  const nav: { key: Tab; label: string; icon: any }[] = [
    { key: 'dashboard', label: '总览', icon: Layout },
    { key: 'apikeys', label: 'API Key', icon: Key },
    { key: 'tenants', label: '租户', icon: Building2 },
    { key: 'users', label: '用户', icon: Users },
    { key: 'plans', label: '套餐', icon: Package },
    { key: 'settings', label: '系统设置', icon: Settings },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a14' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, background: '#111122', borderRight: '1px solid #1e1e3a',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #1e1e3a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={22} color="#818cf8" />
            <span style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb' }}>Aiops Admin</span>
          </div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>运营管理后台</div>
        </div>

        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {nav.map(item => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 12px', borderRadius: 8, border: 'none',
                background: tab === item.key ? '#1e1e3a' : 'transparent',
                color: tab === item.key ? '#e5e7eb' : '#6b7280',
                fontSize: 15, fontWeight: tab === item.key ? 600 : 400,
                cursor: 'pointer', marginBottom: 2,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (tab !== item.key) { e.currentTarget.style.background = '#16162b'; e.currentTarget.style.color = '#d1d5db'; } }}
              onMouseLeave={e => { if (tab !== item.key) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b7280'; } }}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #1e1e3a' }}>
          <div style={{ fontSize: 14, color: '#e5e7eb', fontWeight: 500 }}>{admin?.name || 'Admin'}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{admin?.email || ''}</div>
          <button onClick={handleLogout}
            style={{
              marginTop: 8, background: 'transparent', border: '1px solid #2a2a3e',
              color: '#9ca3af', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer',
            }}
          >退出登录</button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto', padding: '32px 40px' }}>
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'apikeys' && <ApiKeys />}
        {tab === 'tenants' && <Tenants />}
        {tab === 'users' && <UsersPage />}
        {tab === 'plans' && <PlansPage />}
        {tab === 'settings' && <SystemSettings />}
      </main>
    </div>
  );
}

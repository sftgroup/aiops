import { useState, useEffect } from 'react';
import { Users, Zap, Building2, TrendingUp } from 'lucide-react';
import { api } from './lib';

interface DashboardData {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  todayApiCalls: number;
  todayTokens: number;
}

interface TrendPoint {
  date: string;
  calls: number;
  tokens: number;
}

interface Supplier {
  key: string;
  label: string;
  icon: string;
  calls: number;
  tokens: number;
}

interface Balance {
  key: string;
  label: string;
  icon: string;
  status: string;
  balance: string | number;
  unit: string;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<{ data: DashboardData }>('/api/operator/dashboard'),
      api<{ data: TrendPoint[] }>('/api/operator/dashboard/trend?days=30'),
      api<{ data: Supplier[] }>('/api/operator/dashboard/suppliers'),
      api<{ data: Balance[] }>('/api/operator/dashboard/balances'),
    ]).then(([d, t, s, b]) => {
      setData(d.data);
      setTrend(t.data);
      setSuppliers(s.data);
      setBalances(b.data);
    }).finally(() => setLoading(false));
  }, []);

  const stats = [
    { label: '总租户', value: data?.totalTenants ?? '-', sub: `${data?.activeTenants ?? '-'} 活跃`, icon: Building2, color: '#6366f1' },
    { label: '总用户', value: data?.totalUsers ?? '-', sub: '注册用户', icon: Users, color: '#8b5cf6' },
    { label: '今日 API 调用', value: data?.todayApiCalls?.toLocaleString() ?? '-', sub: '过去24小时', icon: Zap, color: '#10b981' },
    { label: '今日 Token', value: `${((data?.todayTokens ?? 0) / 1000).toFixed(1)}K`, sub: '过去24小时', icon: TrendingUp, color: '#f59e0b' },
  ];

  const maxCalls = Math.max(...trend.map(t => t.calls), 1);
  const maxSupplier = Math.max(...suppliers.map(s => s.calls), ...suppliers.map(s => s.tokens), 1);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af', fontSize: 13 }}>加载中...</div>;
  }

  return (
    <div>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 8 }}>运营总览</h1>
      <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 32 }}>全局使用数据和趋势</p>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
        {stats.map((s, i) => (
          <div key={i} style={{
            background: '#111122', border: '1px solid #1e1e3a', borderRadius: 12, padding: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: '#9ca3af' }}>{s.label}</span>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon size={18} color={s.color} />
              </div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb' }}>{s.value}</div>
            <div style={{ fontSize: 18, color: '#9ca3af', marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Supplier Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, marginBottom: 32 }}>
        {/* Supplier API Calls */}
        <div style={{ background: '#111122', border: '1px solid #1e1e3a', borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#e5e7eb', marginBottom: 20 }}>今日供应商用量</h2>
          {suppliers.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13 }}>暂无数据</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {suppliers.map(s => (
                <div key={s.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: '#9ca3af' }}>{s.icon} {s.label}</span>
                    <span style={{ fontSize: 13, color: '#e5e7eb', fontFamily: 'monospace' }}>
                      {s.calls.toLocaleString()} calls / {s.tokens.toLocaleString()} tokens
                    </span>
                  </div>
                  <div style={{ height: 6, background: '#1e1e3a', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      width: `${Math.max((s.calls / maxSupplier) * 100, 2)}%`,
                      background: s.key === 'deepseek' ? '#6366f1' : s.key === 'ark' ? '#f59e0b' : s.key === 'tts' ? '#10b981' : '#6b7280',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* API Key Balances */}
        <div style={{ background: '#111122', border: '1px solid #1e1e3a', borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#e5e7eb', marginBottom: 20 }}>供应商余额</h2>
          {balances.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13 }}>暂无配置</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {balances.map(b => (
                <div key={b.key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#0a0a14', borderRadius: 10, padding: '14px 16px',
                  border: '1px solid #1e1e3a',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{b.icon}</span>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 500, color: '#e5e7eb' }}>{b.label}</div>
                      <div style={{ fontSize: 13, color: '#9ca3af' }}>
                        {b.status === 'active'
                          ? <span style={{ color: '#6ee7b7' }}>● 已连接</span>
                          : b.status === 'unknown'
                          ? <span style={{ color: '#fbbf24' }}>● 未知</span>
                          : <span style={{ color: '#9ca3af' }}>● {b.status}</span>
                        }
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 600, color: '#fbbf24', fontFamily: 'monospace' }}>
                      {typeof b.balance === 'number' ? b.balance.toLocaleString() : b.balance}
                    </div>
                    <div style={{ fontSize: 13, color: '#9ca3af' }}>{b.unit}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trend Chart */}
      <div style={{
        background: '#111122', border: '1px solid #1e1e3a', borderRadius: 12, padding: 24,
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#e5e7eb', marginBottom: 24 }}>30 天趋势</h2>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 180 }}>
          {trend.map((t, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: '100%', maxWidth: 20,
                height: `${Math.max((t.calls / maxCalls) * 160, 2)}px`,
                background: 'linear-gradient(180deg, #6366f1, #312e81)',
                borderRadius: '3px 3px 0 0', transition: 'height 0.3s',
              }} title={`${t.date}: ${t.calls} calls`} />
              {i % 5 === 0 && <span style={{ fontSize: 18, color: '#9ca3af', marginTop: 4 }}>{t.date.slice(5)}</span>}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontSize: 18, color: '#9ca3af' }}>
          <span>30 天前</span>
          <span>今日</span>
        </div>
      </div>
    </div>
  );
}

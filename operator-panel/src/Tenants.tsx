import { useState, useEffect } from 'react';
import { Building2, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { api } from './lib';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  memberCount: number;
  totalCalls: number;
  createdAt: string;
}

interface TenantDetail {
  tenant: any;
  members: any[];
  usage: { monthCalls: number; monthTokens: number; totalCalls: number };
  recentAudit: any[];
}

export default function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TenantDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const fetchTenants = (page = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '15' });
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (planFilter) params.set('plan', planFilter);
    api<{ data: Tenant[]; pagination: any }>(`/api/operator/tenants?${params}`)
      .then(res => { setTenants(res.data); setPagination(res.pagination); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTenants(); }, []);

  const handleSearch = () => fetchTenants(1);

  const openDetail = (id: string) => {
    setDetailLoading(true);
    api<{ data: TenantDetail }>(`/api/operator/tenants/${id}`)
      .then(res => setSelected(res.data as any))
      .finally(() => setDetailLoading(false));
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api(`/api/operator/tenants/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      fetchTenants(pagination.page);
    } catch (e: any) {
      setToast({ msg: e.message, type: 'error' });
      setTimeout(() => setToast(null), 2000);
    }
  };

  const updatePlan = async (id: string, plan: string) => {
    try {
      await api(`/api/operator/tenants/${id}/plan`, { method: 'PUT', body: JSON.stringify({ plan }) });
      fetchTenants(pagination.page);
    } catch (e: any) {
      setToast({ msg: e.message, type: 'error' });
      setTimeout(() => setToast(null), 2000);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 8 }}>租户管理</h1>
      <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 24 }}>{pagination.total} 个租户</p>

      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 100, padding: '10px 20px', borderRadius: 8, background: '#3b1010', border: '1px solid #5c1a1a', color: '#fca5a5', fontSize: 13 }}>{toast.msg}</div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, display: 'flex', gap: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索租户名称..."
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{
              flex: 1, padding: '9px 14px', borderRadius: 8, border: '1px solid #2a2a3e',
              background: '#111122', color: '#e5e7eb', fontSize: 13, outline: 'none',
            }}
          />
          <button onClick={handleSearch}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', borderRadius: 8, border: 'none',
              background: '#6366f1', color: 'white', fontSize: 13, cursor: 'pointer',
            }}
          ><Search size={14} />搜索</button>
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); }}
          style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #2a2a3e', background: '#111122', color: '#e5e7eb', fontSize: 13 }}>
          <option value="">全部状态</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); }}
          style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #2a2a3e', background: '#111122', color: '#e5e7eb', fontSize: 13 }}>
          <option value="">全部方案</option>
          <option value="free">Free</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Table */}
      <div style={{
        background: '#111122', border: '1px solid #1e1e3a', borderRadius: 12, overflow: 'hidden',
      }}>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e1e3a', textAlign: 'left' }}>
              {['租户名称', '方案', '状态', '成员', 'API 调用', '创建时间', '操作'].map(h => (
                <th key={h} style={{ padding: '12px 16px', color: '#9ca3af', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>加载中...</td></tr>
            ) : tenants.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>暂无数据</td></tr>
            ) : (
              tenants.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid #1e1e3a' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 500, color: '#e5e7eb' }}>{t.name}</div>
                    <div style={{ fontSize: 13, color: '#9ca3af' }}>{t.slug}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 12, fontSize: 13, fontWeight: 500,
                      background: t.plan === 'pro' ? '#6366f120' : t.plan === 'enterprise' ? '#f59e0b20' : '#6b728020',
                      color: t.plan === 'pro' ? '#818cf8' : t.plan === 'enterprise' ? '#fbbf24' : '#9ca3af',
                    }}>{t.plan}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      color: t.status === 'active' ? '#6ee7b7' : '#fca5a5', fontSize: 13,
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: t.status === 'active' ? '#10b981' : '#ef4444',
                      }} />
                      {t.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#9ca3af' }}>{t.memberCount}</td>
                  <td style={{ padding: '12px 16px', color: '#9ca3af' }}>{t.totalCalls}</td>
                  <td style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 13 }}>
                    {new Date(t.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
                    <button onClick={() => openDetail(t.id)}
                      style={{
                        padding: '4px 12px', borderRadius: 6, border: '1px solid #2a2a3e',
                        background: 'transparent', color: '#9ca3af', fontSize: 13, cursor: 'pointer',
                      }}>详情</button>
                    {t.status === 'active' ? (
                      <button onClick={() => updateStatus(t.id, 'suspended')}
                        style={{
                          padding: '4px 12px', borderRadius: 6, border: '1px solid #5c1a1a',
                          background: 'transparent', color: '#f87171', fontSize: 13, cursor: 'pointer',
                        }}>禁用</button>
                    ) : (
                      <button onClick={() => updateStatus(t.id, 'active')}
                        style={{
                          padding: '4px 12px', borderRadius: 6, border: '1px solid #065f46',
                          background: 'transparent', color: '#6ee7b7', fontSize: 13, cursor: 'pointer',
                        }}>启用</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20 }}>
          <button onClick={() => fetchTenants(pagination.page - 1)} disabled={pagination.page <= 1}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #2a2a3e', background: '#111122', color: pagination.page <= 1 ? '#374151' : '#9ca3af', cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer' }}>
            <ChevronLeft size={14} />
          </button>
          <span style={{ color: '#9ca3af', fontSize: 13 }}>{pagination.page} / {pagination.totalPages}</span>
          <button onClick={() => fetchTenants(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #2a2a3e', background: '#111122', color: pagination.page >= pagination.totalPages ? '#374151' : '#9ca3af', cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer' }}>
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Detail Modal */}
      { (selected || detailLoading) && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setSelected(null)}>
          <div style={{
            background: '#111122', border: '1px solid #1e1e3a', borderRadius: 16,
            width: 640, maxHeight: '80vh', overflow: 'auto', padding: 28,
          }} onClick={e => e.stopPropagation()}>
            {detailLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>加载中...</div>
            ) : selected && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                  <div>
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: '#e5e7eb' }}>{selected.tenant.name}</h2>
                    <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{selected.tenant.slug}</div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}><X size={20} /></button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                  {[
                    { label: '方案', value: selected.tenant.plan },
                    { label: '状态', value: selected.tenant.status },
                    { label: '本月调用', value: String(selected.usage.monthCalls) },
                    { label: '总调用', value: String(selected.usage.totalCalls) },
                    { label: '创建时间', value: new Date(selected.tenant.createdAt).toLocaleDateString('zh-CN') },
                  ].map(item => (
                    <div key={item.label} style={{ background: '#0a0a14', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 2 }}>{item.label}</div>
                      <div style={{ fontSize: 13, color: '#e5e7eb', fontWeight: 500 }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                <h3 style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 12 }}>成员 ({selected.members.length})</h3>
                <div style={{ marginBottom: 24 }}>
                  {selected.members.map((m: any) => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1e1e3a', fontSize: 13 }}>
                      <span style={{ color: '#e5e7eb' }}>{m.name || m.email}</span>
                      <span style={{ color: '#9ca3af' }}>{m.role}</span>
                    </div>
                  ))}
                </div>

                <h3 style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 12 }}>操作</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select onChange={e => updatePlan(selected.tenant.id, e.target.value)}
                    style={{
                      padding: '8px 12px', borderRadius: 8, border: '1px solid #2a2a3e',
                      background: '#0a0a14', color: '#e5e7eb', fontSize: 13, cursor: 'pointer',
                    }}>
                    <option value="">切换方案...</option>
                    <option value="free">Free</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Users, Search, ChevronLeft, ChevronRight, Shield, Ban, UserCheck } from 'lucide-react';
import { api } from './lib';

interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  role: string;
  status: string;
  tenantName: string | null;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const fetchUsers = (page = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '15' });
    if (search) params.set('search', search);
    if (roleFilter) params.set('role', roleFilter);
    if (statusFilter) params.set('status', statusFilter);
    api<{ data: User[]; pagination: any }>(`/api/operator/users?${params}`)
      .then(res => { setUsers(res.data); setPagination(res.pagination); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSearch = () => fetchUsers(1);

  const updateStatus = async (id: string, status: string) => {
    try {
      await api(`/api/operator/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      fetchUsers(pagination.page);
      setToast({ msg: `用户已${status === 'suspended' ? '禁用' : '启用'}`, type: 'success' });
      setTimeout(() => setToast(null), 2000);
    } catch (e: any) {
      setToast({ msg: e.message, type: 'error' });
      setTimeout(() => setToast(null), 2000);
    }
  };

  const updateRole = async (id: string, role: string) => {
    try {
      await api(`/api/operator/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) });
      fetchUsers(pagination.page);
      setToast({ msg: `角色已更新为 ${role}`, type: 'success' });
      setTimeout(() => setToast(null), 2000);
    } catch (e: any) {
      setToast({ msg: e.message, type: 'error' });
      setTimeout(() => setToast(null), 2000);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 8 }}>用户管理</h1>
      <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 24 }}>{pagination.total} 个用户</p>

      {toast && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 100, padding: '10px 20px', borderRadius: 8,
          background: toast.type === 'success' ? '#064e3b' : '#3b1010',
          border: `1px solid ${toast.type === 'success' ? '#065f46' : '#5c1a1a'}`,
          color: toast.type === 'success' ? '#6ee7b7' : '#fca5a5', fontSize: 13,
        }}>{toast.msg}</div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, display: 'flex', gap: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索邮箱/用户名..."
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
            }}><Search size={14} />搜索</button>
        </div>
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); }}
          style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #2a2a3e', background: '#111122', color: '#e5e7eb', fontSize: 13 }}>
          <option value="">全部角色</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="operator">Operator</option>
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); }}
          style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #2a2a3e', background: '#111122', color: '#e5e7eb', fontSize: 13 }}>
          <option value="">全部状态</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: '#111122', border: '1px solid #1e1e3a', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e1e3a', textAlign: 'left' }}>
              {['用户', '邮箱', '角色', '状态', '租户', '注册时间', '操作'].map(h => (
                <th key={h} style={{ padding: '12px 16px', color: '#9ca3af', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>加载中...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>暂无数据</td></tr>
            ) : (
              users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #1e1e3a' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: u.role === 'admin' ? '#6366f120' : u.role === 'operator' ? '#f59e0b20' : '#1e1e3a',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: u.role === 'admin' ? '#818cf8' : u.role === 'operator' ? '#fbbf24' : '#9ca3af',
                        fontSize: 13, fontWeight: 600,
                      }}>{(u.name || u.username || '?')[0].toUpperCase()}</div>
                      <div>
                        <div style={{ fontWeight: 500, color: '#e5e7eb' }}>{u.name || u.username}</div>
                        {u.name && u.username && u.name !== u.username && (
                          <div style={{ fontSize: 13, color: '#9ca3af' }}>@{u.username}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 13 }}>{u.email || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <select value={u.role} onChange={e => updateRole(u.id, e.target.value)}
                      style={{
                        padding: '3px 8px', borderRadius: 6, border: '1px solid #2a2a3e',
                        background: '#0a0a14', color: '#e5e7eb', fontSize: 13, cursor: 'pointer',
                      }}>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="operator">Operator</option>
                    </select>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13,
                      color: u.status === 'active' ? '#6ee7b7' : '#fca5a5',
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: u.status === 'active' ? '#10b981' : '#ef4444' }} />
                      {u.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 13 }}>{u.tenantName || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 13 }}>
                    {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {u.role !== 'admin' && (
                      u.status === 'active' ? (
                        <button onClick={() => updateStatus(u.id, 'suspended')}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '4px 10px', borderRadius: 6, border: '1px solid #5c1a1a',
                            background: 'transparent', color: '#f87171', fontSize: 13, cursor: 'pointer',
                          }}><Ban size={12} />禁用</button>
                      ) : (
                        <button onClick={() => updateStatus(u.id, 'active')}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '4px 10px', borderRadius: 6, border: '1px solid #065f46',
                            background: 'transparent', color: '#6ee7b7', fontSize: 13, cursor: 'pointer',
                          }}><UserCheck size={12} />启用</button>
                      )
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
          <button onClick={() => fetchUsers(pagination.page - 1)} disabled={pagination.page <= 1}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #2a2a3e', background: '#111122', color: pagination.page <= 1 ? '#374151' : '#9ca3af', cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer' }}>
            <ChevronLeft size={14} />
          </button>
          <span style={{ color: '#9ca3af', fontSize: 13 }}>{pagination.page} / {pagination.totalPages}</span>
          <button onClick={() => fetchUsers(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #2a2a3e', background: '#111122', color: pagination.page >= pagination.totalPages ? '#374151' : '#9ca3af', cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer' }}>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Search, RotateCw, UserX, UserCheck, UserCog, X } from 'lucide-react';
import { adminGet, adminPut } from '../../lib/admin-api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  tenantName?: string;
  registeredAt: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const ROLE_CLASS: Record<string, string> = {
  admin: 'bg-[#6366f1]/10 text-[#818cf8] border-[#6366f1]/20',
  operator: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  user: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const STATUS_CLASS: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400 border-green-500/20',
  disabled: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const STATUSES = ['active', 'disabled'];
const ROLES = ['user', 'admin', 'operator'];

export default function OperatorUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  // Role modal
  const [roleModal, setRoleModal] = useState<{ user: User } | null>(null);
  const [newRole, setNewRole] = useState('user');
  const [actionLoading, setActionLoading] = useState(false);

  const loadUsers = async (p = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(p), pageSize: '20' };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (roleFilter) params.role = roleFilter;
      const data = await adminGet('/users', params);
      setUsers(data.items || []);
      setPagination(data.pagination || { page: p, pageSize: 20, total: 0, totalPages: 0 });
      setPage(p);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers(1);
  }, [statusFilter, roleFilter]);

  const handleSearch = () => {
    loadUsers(1);
  };

  const handleStatusToggle = async (userId: string, currentStatus: string) => {
    setActionLoading(true);
    try {
      const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
      await adminPut(`/users/${userId}`, { status: newStatus });
      loadUsers(page);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRoleChange = async () => {
    if (!roleModal) return;
    setActionLoading(true);
    try {
      await adminPut(`/users/${roleModal.user.id}`, { role: newRole });
      setRoleModal(null);
      loadUsers(page);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((w) => w.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const avatarGradient = (role: string) => {
    const gradients: Record<string, string> = {
      admin: 'from-[#6366f1] to-purple-600',
      operator: 'from-purple-400 to-purple-700',
      user: 'from-blue-500 to-cyan-500',
    };
    return gradients[role] || 'from-blue-500 to-cyan-500';
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold">Users</h2>
          <p className="text-sm text-gray-500 mt-1">Manage all platform user accounts</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="bg-[#1a1a2e] border border-[#2a2a3e] px-2 py-1 rounded-lg">
            Total: <strong className="text-white">{pagination.total}</strong>
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-gray-600" />
            </div>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0f0f1a] border border-[#2a2a3e] rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#6366f1]/50 transition-all"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0f0f1a] border border-[#2a2a3e] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#6366f1]/50 min-w-[130px]"
          >
            <option value="">All Status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-[#0f0f1a] border border-[#2a2a3e] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#6366f1]/50 min-w-[130px]"
          >
            <option value="">All Roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setRoleFilter(''); loadUsers(1); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0f0f1a] border border-[#2a2a3e] rounded-xl text-sm text-gray-400 hover:text-white transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a3e] text-left">
                <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Registered</th>
                <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a3e]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-500 text-sm">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className={`hover:bg-[#252540]/50 transition-colors ${
                      user.status === 'disabled' ? 'bg-red-500/5' : ''
                    }`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradient(user.role)} flex items-center justify-center text-white text-xs font-bold`}
                        >
                          {getInitials(user.name)}
                        </div>
                        <span
                          className={`text-sm font-medium ${
                            user.status === 'disabled' ? 'text-white/60' : 'text-white'
                          }`}
                        >
                          {user.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-gray-400">{user.email}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs ${user.status === 'disabled' ? 'text-gray-500' : 'text-gray-300'}`}>
                        {user.tenantName || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                          ROLE_CLASS[user.role] || ROLE_CLASS.user
                        }`}
                      >
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                          STATUS_CLASS[user.status] || STATUS_CLASS.active
                        }`}
                      >
                        {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-gray-500">
                        {new Date(user.registeredAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleStatusToggle(user.id, user.status)}
                          className="p-1.5 rounded-lg text-gray-500 transition-colors"
                          title={user.status === 'active' ? 'Disable' : 'Enable'}
                        >
                          {user.status === 'active' ? (
                            <UserX className="w-3.5 h-3.5 hover:text-red-400 hover:bg-red-400/10" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5 hover:text-green-400 hover:bg-green-400/10" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setRoleModal({ user });
                            setNewRole(user.role);
                          }}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-[#6366f1] hover:bg-[#6366f1]/10 transition-colors"
                          title="Change Role"
                        >
                          <UserCog className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-[#2a2a3e] flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => loadUsers(page - 1)}
                disabled={page <= 1}
                className="px-2.5 py-1.5 rounded-lg text-xs text-gray-500 border border-[#2a2a3e] hover:bg-[#252540] transition-colors disabled:opacity-30"
              >
                ← Prev
              </button>
              <span className="px-2.5 py-1.5 text-xs text-gray-400">{page}</span>
              <button
                onClick={() => loadUsers(page + 1)}
                disabled={page >= pagination.totalPages}
                className="px-2.5 py-1.5 rounded-lg text-xs text-gray-400 border border-[#2a2a3e] hover:bg-[#252540] transition-colors disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Change Role Modal */}
      {roleModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a2e] rounded-2xl border border-[#2a2a3e] w-full max-w-md shadow-2xl">
            <div className="px-5 py-4 border-b border-[#2a2a3e] flex items-center justify-between">
              <h3 className="font-semibold text-white">Change Role</h3>
              <button
                onClick={() => setRoleModal(null)}
                className="text-gray-600 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-400">
                Change role for <strong className="text-white">{roleModal.user.name}</strong>
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">New Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0f0f1a] border border-[#2a2a3e] rounded-xl text-white text-sm focus:outline-none focus:border-[#6366f1]/50 transition-all"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setRoleModal(null)}
                  className="px-4 py-2.5 border border-[#2a2a3e] rounded-xl text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRoleChange}
                  disabled={actionLoading}
                  className="px-4 py-2.5 bg-[#6366f1] rounded-xl text-sm font-medium text-white hover:bg-[#5558e6] transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

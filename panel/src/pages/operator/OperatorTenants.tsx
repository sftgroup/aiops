import { useState, useEffect } from 'react';
import { Search, RotateCw, Eye, Ban, SlidersHorizontal, PlayCircle, CheckCircle, X } from 'lucide-react';
import { adminGet, adminPut } from '../../lib/admin-api';

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

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const PLAN_TAG = 'bg-gray-500/10 text-gray-400 border-gray-500/20';
const PLAN_CLASS: Record<string, string> = {
  free: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  pro: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  enterprise: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

const STATUS_CLASS: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400 border-green-500/20',
  suspended: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  banned: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const PLANS = ['free', 'pro', 'enterprise'];
const STATUSES = ['active', 'suspended', 'banned'];

export default function OperatorTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Change plan modal
  const [planModal, setPlanModal] = useState<{ tenant: Tenant } | null>(null);
  const [newPlan, setNewPlan] = useState('free');
  const [actionLoading, setActionLoading] = useState(false);

  const loadTenants = async (p = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(p), pageSize: '20' };
      if (search) params.search = search;
      if (planFilter) params.plan = planFilter;
      if (statusFilter) params.status = statusFilter;
      const data = await adminGet('/tenants', params);
      setTenants(data.items || []);
      setPagination(data.pagination || { page: p, pageSize: 20, total: 0, totalPages: 0 });
      setPage(p);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants(1);
  }, [planFilter, statusFilter]);

  const handleSearch = () => {
    loadTenants(1);
  };

  const handleStatusChange = async (tenantId: string, status: string) => {
    setActionLoading(true);
    try {
      await adminPut(`/tenants/${tenantId}`, { status });
      loadTenants(page);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePlanChange = async () => {
    if (!planModal) return;
    setActionLoading(true);
    try {
      await adminPut(`/tenants/${planModal.tenant.id}`, { plan: newPlan });
      setPlanModal(null);
      loadTenants(page);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const renderStatusBtn = (tenant: Tenant) => {
    if (tenant.status === 'active') {
      return (
        <button
          onClick={() => handleStatusChange(tenant.id, 'suspended')}
          className="p-1.5 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
          title="Suspend"
        >
          <Ban className="w-3.5 h-3.5" />
        </button>
      );
    }
    if (tenant.status === 'suspended') {
      return (
        <button
          onClick={() => handleStatusChange(tenant.id, 'active')}
          className="p-1.5 rounded-lg text-gray-500 hover:text-green-400 hover:bg-green-400/10 transition-colors"
          title="Reactivate"
        >
          <PlayCircle className="w-3.5 h-3.5" />
        </button>
      );
    }
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold">Tenants</h2>
          <p className="text-sm text-gray-500 mt-1">Manage all platform tenants</p>
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
              placeholder="Search by name or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0f0f1a] border border-[#2a2a3e] rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#6366f1]/50 transition-all"
            />
          </div>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="bg-[#0f0f1a] border border-[#2a2a3e] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#6366f1]/50 min-w-[130px]"
          >
            <option value="">All Plans</option>
            {PLANS.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
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
          <button
            onClick={() => { setSearch(''); setPlanFilter(''); setStatusFilter(''); loadTenants(1); }}
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
                <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant Name</th>
                <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
                <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Members</th>
                <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">API Calls</th>
                <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a3e]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center">
                    <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-gray-500 text-sm">
                    No tenants found
                  </td>
                </tr>
              ) : (
                tenants.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className={`hover:bg-[#252540]/50 transition-colors ${
                      tenant.status === 'banned'
                        ? 'bg-red-500/5'
                        : tenant.status === 'suspended'
                        ? 'bg-amber-500/5'
                        : ''
                    }`}
                  >
                    <td className="px-5 py-4">
                      <p className={`text-sm font-medium ${tenant.status === 'banned' ? 'text-white/70' : 'text-white'}`}>
                        {tenant.name}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-mono text-gray-400 bg-[#0f0f1a] px-2 py-1 rounded">
                        {tenant.slug}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                          PLAN_CLASS[tenant.plan] || PLAN_TAG
                        }`}
                      >
                        {tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-300">{tenant.memberCount ?? '-'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-mono text-gray-300">
                        {(tenant.totalCalls ?? 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                          STATUS_CLASS[tenant.status] || STATUS_CLASS.active
                        }`}
                      >
                        {tenant.status.charAt(0).toUpperCase() + tenant.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-gray-500">
                        {new Date(tenant.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-gray-600" />
                        {renderStatusBtn(tenant)}
                        {tenant.status !== 'banned' && (
                          <>
                            <button
                              onClick={() => {
                                setPlanModal({ tenant });
                                setNewPlan(tenant.plan);
                              }}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-[#6366f1] hover:bg-[#6366f1]/10 transition-colors"
                              title="Change Plan"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleStatusChange(tenant.id, 'banned')}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                              title="Ban"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {tenant.status === 'banned' && (
                          <button
                            onClick={() => handleStatusChange(tenant.id, 'active')}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-green-400 hover:bg-green-400/10 transition-colors"
                            title="Unban"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
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
                onClick={() => loadTenants(page - 1)}
                disabled={page <= 1}
                className="px-2.5 py-1.5 rounded-lg text-xs text-gray-500 border border-[#2a2a3e] hover:bg-[#252540] transition-colors disabled:opacity-30"
              >
                ← Prev
              </button>
              <span className="px-2.5 py-1.5 text-xs text-gray-400">{page}</span>
              <button
                onClick={() => loadTenants(page + 1)}
                disabled={page >= pagination.totalPages}
                className="px-2.5 py-1.5 rounded-lg text-xs text-gray-400 border border-[#2a2a3e] hover:bg-[#252540] transition-colors disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Change Plan Modal */}
      {planModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a2e] rounded-2xl border border-[#2a2a3e] w-full max-w-md shadow-2xl">
            <div className="px-5 py-4 border-b border-[#2a2a3e] flex items-center justify-between">
              <h3 className="font-semibold text-white">Change Plan</h3>
              <button
                onClick={() => setPlanModal(null)}
                className="text-gray-600 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-400">
                Change plan for <strong className="text-white">{planModal.tenant.name}</strong>
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">New Plan</label>
                <select
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0f0f1a] border border-[#2a2a3e] rounded-xl text-white text-sm focus:outline-none focus:border-[#6366f1]/50 transition-all"
                >
                  {PLANS.map((p) => (
                    <option key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setPlanModal(null)}
                  className="px-4 py-2.5 border border-[#2a2a3e] rounded-xl text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePlanChange}
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

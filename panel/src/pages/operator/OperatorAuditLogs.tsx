import { useState, useEffect } from 'react';
import { Search, RotateCw } from 'lucide-react';
import { adminGet } from '../../lib/admin-api';

interface AuditItem {
  id: string;
  action: string;
  detail?: Record<string, any>;
  userId?: string;
  tenantId?: string;
  ip?: string;
  createdAt: string;
  admin?: { name: string; email: string };
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function OperatorAuditLogs() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const loadAudit = async (p = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(p), pageSize: '20' };
      if (search) params.event = search;
      const data = await adminGet('/audit', params);
      setItems(data.items || []);
      setPagination(data.pagination || { page: p, pageSize: 20, total: 0, totalPages: 0 });
      setPage(p);
    } catch (e) {
      console.error(e);
      // Fallback demo data
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudit(1);
  }, []);

  const handleSearch = () => {
    loadAudit(1);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold">Audit Log</h2>
          <p className="text-sm text-gray-500 mt-1">Track operator actions across the platform</p>
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
              placeholder="Search by action or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0f0f1a] border border-[#2a2a3e] rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#6366f1]/50 transition-all"
            />
          </div>
          <button
            onClick={() => { setSearch(''); loadAudit(1); }}
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
                <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a3e]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-gray-500 text-sm">No audit logs yet</p>
                      <p className="text-xs text-gray-600">
                        Audit logs will appear here when operators perform actions
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-[#252540]/50 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-xs text-gray-500">
                        {new Date(item.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-medium text-gray-300 bg-[#0f0f1a] px-2.5 py-1 rounded-full border border-[#2a2a3e]">
                        {item.action}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div>
                        <span className="text-sm text-white">{item.admin?.name || item.userId || '-'}</span>
                        {item.admin?.email && (
                          <span className="text-[10px] text-gray-600 block">{item.admin.email}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-gray-400">{item.tenantId || '-'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-gray-400 max-w-xs truncate block">
                        {item.detail ? JSON.stringify(item.detail).slice(0, 80) + (JSON.stringify(item.detail).length > 80 ? '...' : '') : '-'}
                      </span>
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
                onClick={() => loadAudit(page - 1)}
                disabled={page <= 1}
                className="px-2.5 py-1.5 rounded-lg text-xs text-gray-500 border border-[#2a2a3e] hover:bg-[#252540] transition-colors disabled:opacity-30"
              >
                ← Prev
              </button>
              <span className="px-2.5 py-1.5 text-xs text-gray-400">{page}</span>
              <button
                onClick={() => loadAudit(page + 1)}
                disabled={page >= pagination.totalPages}
                className="px-2.5 py-1.5 rounded-lg text-xs text-gray-400 border border-[#2a2a3e] hover:bg-[#252540] transition-colors disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, XCircle, Clock, RefreshCw, ExternalLink } from 'lucide-react';

const API = '/api/operator';

interface CryptoOrder {
  orderId: string;
  planId: string;
  tenantName: string;
  userEmail: string;
  amount: number;
  baseAmount: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'expired';
  txHash: string | null;
  confirmations: number;
  buyerAddress: string | null;
  paymentAddress: string;
  createdAt: string;
  expiresAt: string;
}

export default function CryptoOrdersPage() {
  const [orders, setOrders] = useState<CryptoOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'expired'>('all');

  const token = localStorage.getItem('operator_token');

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API}/crypto-orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setOrders(data.orders || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const id = setInterval(fetchOrders, 30000); // poll every 30s
    return () => clearInterval(id);
  }, [token]);

  const handleConfirm = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      const res = await fetch(`${API}/crypto-orders/${orderId}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchOrders();
    } finally {
      setActionLoading(null);
    }
  };

  const handleExpire = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      const res = await fetch(`${API}/crypto-orders/${orderId}/expire`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchOrders();
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
      confirmed: 'bg-green-500/10 text-green-400 border-green-500/30',
      expired: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
    };
    const icons: Record<string, JSX.Element> = {
      pending: <Clock className="w-3 h-3" />,
      confirmed: <CheckCircle className="w-3 h-3" />,
      expired: <XCircle className="w-3 h-3" />,
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${styles[status] || ''}`}>
        {icons[status]}
        {status}
      </span>
    );
  };

  const formatAmount = (order: CryptoOrder) => {
    if (order.amount && order.baseAmount) {
      return `${order.amount.toFixed(6)} ${order.currency}`;
    }
    return `${order.amount?.toFixed(2) || '?'} ${order.currency}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Crypto Payments</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor and manage cryptocurrency payment orders</p>
        </div>
        <button
          onClick={fetchOrders}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#2a2a3e] text-gray-400 hover:text-white hover:bg-[#252540] transition-colors text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'pending', 'confirmed', 'expired'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === tab
                ? 'bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/30'
                : 'text-gray-500 border border-[#2a2a3e] hover:text-gray-300'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total" value={orders.length} icon={<CreditCard className="w-4 h-4" />} color="blue" />
        <StatCard label="Pending" value={orders.filter(o => o.status === 'pending').length} icon={<Clock className="w-4 h-4" />} color="yellow" />
        <StatCard label="Confirmed" value={orders.filter(o => o.status === 'confirmed').length} icon={<CheckCircle className="w-4 h-4" />} color="green" />
        <StatCard label="Expired" value={orders.filter(o => o.status === 'expired').length} icon={<XCircle className="w-4 h-4" />} color="gray" />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-[#1a1a2e] rounded-xl border border-[#2a2a3e]">
          <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">No crypto payment orders yet</p>
          <p className="text-xs text-gray-600 mt-1">Orders appear when users initiate crypto checkouts</p>
        </div>
      ) : (
        <div className="bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a3e] text-left text-gray-500 text-xs uppercase">
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Tenant / User</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tx / Buyer</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a3e]">
                {filtered.map(order => (
                  <tr key={order.orderId} className="hover:bg-[#252540]/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">
                      {order.orderId.slice(0, 16)}...
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white text-sm">{order.tenantName}</p>
                      <p className="text-gray-500 text-xs">{order.userEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs bg-[#6366f1]/10 text-[#6366f1]">
                        {order.planId}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white font-mono text-sm">
                      {formatAmount(order)}
                    </td>
                    <td className="px-4 py-3">{statusBadge(order.status)}</td>
                    <td className="px-4 py-3">
                      {order.txHash ? (
                        <a
                          href={`https://etherscan.io/tx/${order.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#6366f1] hover:underline text-xs flex items-center gap-1"
                        >
                          {order.txHash.slice(0, 10)}...
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : order.buyerAddress ? (
                        <span className="text-gray-500 text-xs font-mono">{order.buyerAddress.slice(0, 10)}...</span>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {order.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleConfirm(order.orderId)}
                              disabled={actionLoading === order.orderId}
                              className="px-2 py-1 rounded text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => handleExpire(order.orderId)}
                              disabled={actionLoading === order.orderId}
                              className="px-2 py-1 rounded text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                            >
                              Expire
                            </button>
                          </>
                        )}
                        {order.status !== 'pending' && (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: JSX.Element; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400',
    yellow: 'bg-yellow-500/10 text-yellow-400',
    green: 'bg-green-500/10 text-green-400',
    gray: 'bg-gray-500/10 text-gray-400',
  };

  return (
    <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase">{label}</span>
        <span className={`p-1 rounded ${colorMap[color]}`}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

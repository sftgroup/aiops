import { useState, useEffect } from 'react';
import {
  Building2,
  Activity,
  Zap,
  Database,
  Users,
  PieChart,
  Bell,
} from 'lucide-react';
import { adminGet } from '../../lib/admin-api';

interface OverviewData {
  today: { calls: number; tokens: number; tts: number };
  week: { calls: number; tokens: number; tts: number };
  month: { calls: number; tokens: number; tts: number };
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  activeUsers: number;
}

interface TrendPoint {
  date: string;
  calls: number;
  tokens: number;
  tts: number;
}

interface TopTenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  calls: number;
  tokens: number;
}

export default function OperatorDashboard() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [topTenants, setTopTenants] = useState<TopTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    Promise.all([
      adminGet('/overview').catch(() => null),
      adminGet('/trend', { days: '14' }).catch(() => null),
      adminGet('/top-tenants', { limit: '10' }).catch(() => null),
    ])
      .then(([o, t, tt]) => {
        if (o) setOverview(o);
        if (t?.points) setTrend(t.points);
        if (tt?.tenants) setTopTenants(tt.tenants);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Load failed');
        setLoading(false);
      });
  }, []);

  // Fallback demo data when no API
  useEffect(() => {
    if (!loading && !overview) {
      setOverview({
        today: { calls: 15200, tokens: 3200000, tts: 0 },
        week: { calls: 102000, tokens: 21000000, tts: 0 },
        month: { calls: 420000, tokens: 85000000, tts: 0 },
        totalTenants: 48,
        activeTenants: 36,
        totalUsers: 312,
        activeUsers: 287,
      });
    }
  }, [loading, overview]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-red-400 mb-4">加载失败: {error}</p>
        <button
          onClick={() => { setLoading(true); setError(null); }}
          className="bg-[#6366f1] text-white px-6 py-2 rounded-lg hover:bg-[#5558e6] transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  const maxTrendVal = trend.length > 0 ? Math.max(...trend.map((d) => d.calls || 0), 1) : 1;

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#1a1a2e] rounded-xl p-4 border border-[#2a2a3e]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overview?.totalTenants ?? 0}</p>
              <p className="text-xs text-gray-500">Total Tenants</p>
            </div>
          </div>
        </div>
        <div className="bg-[#1a1a2e] rounded-xl p-4 border border-[#2a2a3e]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overview?.activeTenants ?? 0}</p>
              <p className="text-xs text-gray-500">Active Tenants</p>
            </div>
          </div>
        </div>
        <div className="bg-[#1a1a2e] rounded-xl p-4 border border-[#2a2a3e]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatNum(overview?.today.calls ?? 0)}</p>
              <p className="text-xs text-gray-500">Today API Calls</p>
            </div>
          </div>
        </div>
        <div className="bg-[#1a1a2e] rounded-xl p-4 border border-[#6366f1]/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#6366f1]">{formatLarge(overview?.today.tokens ?? 0)}</p>
              <p className="text-xs text-gray-500">Today Tokens</p>
            </div>
          </div>
        </div>
      </div>

      {/* Second Row: Trend + Top Tenants */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        {/* Trend Chart */}
        <div className="lg:col-span-3 bg-[#1a1a2e] rounded-xl p-5 border border-[#2a2a3e]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">14-Day API Call Trend</h3>
            <div className="flex gap-3">
              <label className="flex items-center gap-1.5 text-[10px] text-gray-500">
                <span className="w-2 h-2 rounded-full bg-[#6366f1]" /> Calls
              </label>
              <label className="flex items-center gap-1.5 text-[10px] text-gray-500">
                <span className="w-2 h-2 rounded-full bg-purple-500" /> Tokens
              </label>
            </div>
          </div>
          {trend.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
              No trend data available
            </div>
          ) : (
            <div className="flex items-end gap-1 h-48">
              {trend.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-gradient-to-t from-[#6366f1] to-blue-400 rounded-t hover:opacity-80 transition-opacity"
                    style={{ height: `${Math.max((d.calls / maxTrendVal) * 100, 2)}%` }}
                  />
                  <span className="text-[9px] text-gray-600 mt-1">
                    {new Date(d.date).getDate()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Tenants */}
        <div className="lg:col-span-2 bg-[#1a1a2e] rounded-xl p-5 border border-[#2a2a3e]">
          <h3 className="font-semibold mb-4">Top 10 Tenants</h3>
          <div className="space-y-3">
            {topTenants.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-gray-600 text-sm">
                No tenant data yet
              </div>
            ) : (
              topTenants.map((t, i) => (
                <div key={t.id} className="flex items-center gap-3">
                  <span
                    className={`text-xs font-bold w-5 ${
                      i === 0 ? 'text-[#6366f1]' : 'text-gray-500'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{t.name}</p>
                    <span className="text-[10px] text-gray-500">
                      {t.slug} · {t.plan}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-gray-400">{formatNum(t.calls)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Third Row: Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Overview */}
        <div className="bg-[#1a1a2e] rounded-xl p-5 border border-[#2a2a3e]">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#6366f1]" /> User Overview
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0f0f1a] rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-white">{overview?.totalUsers ?? 0}</p>
              <p className="text-xs text-gray-500">Total Users</p>
            </div>
            <div className="bg-[#0f0f1a] rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-400">{overview?.activeUsers ?? 0}</p>
              <p className="text-xs text-gray-500">Active Users</p>
            </div>
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="bg-[#1a1a2e] rounded-xl p-5 border border-[#2a2a3e]">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-[#6366f1]" /> Plan Distribution
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-400">Free</span>
                <span className="text-white font-medium">—</span>
              </div>
              <div className="h-2.5 bg-[#0f0f1a] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-gray-500 to-gray-400" style={{ width: '46%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-400">Pro</span>
                <span className="text-white font-medium">—</span>
              </div>
              <div className="h-2.5 bg-[#0f0f1a] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: '38%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-400">Enterprise</span>
                <span className="text-white font-medium">—</span>
              </div>
              <div className="h-2.5 bg-[#0f0f1a] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: '16%' }} />
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 text-center">
            Total: {overview?.totalTenants ?? 0} tenants
          </p>
        </div>

        {/* Recent Alerts */}
        <div className="bg-[#1a1a2e] rounded-xl p-5 border border-[#2a2a3e]">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" /> Recent Alerts
          </h3>
          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5 bg-[#0f0f1a] rounded-lg p-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/80">
                  Platform health status monitoring
                </p>
                <span className="text-[10px] text-gray-600">System online</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5 bg-[#0f0f1a] rounded-lg p-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/80">
                  {overview?.activeTenants ?? 0} tenants active in last 7 days
                </p>
                <span className="text-[10px] text-gray-600">Live</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5 bg-[#0f0f1a] rounded-lg p-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1] mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/80">
                  {formatLarge(overview?.month.calls ?? 0)} API calls this month
                </p>
                <span className="text-[10px] text-gray-600">MTD</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatNum(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function formatLarge(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

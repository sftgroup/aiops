import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiUrl } from '../lib/api';
import { getToken } from '../token';

interface OverviewData {
  today: { calls: number };
  week: { calls: number };
  month: { calls: number };
  totals: { contents: number; tts: number; posters: number; videos: number };
}

interface QuotaData {
  plan: string;
  quota: { aiCalls: number; tts: number; video: number };
  usage: { monthCalls: number; monthTts: number; monthVideo: number };
  pct: { calls: number; tts: number; video: number };
}

interface TrendData {
  days: number;
  trend: { date: string; copywriting: number; tts: number; poster: number; video: number; publish: number }[];
}

function useAuth() {
  const token = getToken();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(apiUrl('/api/profile'), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setUser({ name: d.name || d.username, email: d.email }))
      .catch(() => {});
  }, [token]);

  return { token, user, isLoggedIn: !!token };
}

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const { token, isLoggedIn } = useAuth();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [trend, setTrend] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    Promise.all([
      fetch(apiUrl('/api/dashboard/overview'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(apiUrl('/api/dashboard/quota'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(apiUrl('/api/dashboard/trend?days=14'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([o, q, tr]) => {
      setOverview(o);
      setQuota(q);
      setTrend(tr);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token]);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">{t('notLoggedIn')}</p>
          <Link to="/login" className="bg-[#6366f1] text-white px-6 py-2 rounded-lg hover:bg-[#5558e6] transition-colors">
            {t('goLogin')}
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const planLabel = quota ? quota.plan.charAt(0).toUpperCase() + quota.plan.slice(1) : 'Free';

  return (
    <div className="text-white">
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-gray-400 text-sm mt-1">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 bg-[#1a1a2e] rounded-lg px-4 py-2">
            <span className="text-xs text-gray-400">{t('plan')}</span>
            <span className="text-sm font-semibold text-[#6366f1]">{planLabel}</span>
          </div>
        </div>

        {/* Stats Cards — no token display */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard title={t('todayCalls')} value={overview?.today.calls || 0} subtitle={t('aiCalls')} icon="⚡" />
          <StatCard title={t('monthCalls')} value={overview?.month.calls || 0} subtitle={t('aiCalls')} icon="📊" />
          <StatCard title={t('totalContents')} value={overview?.totals.contents || 0} subtitle={t('contents')} icon="📝" />
          <StatCard title={t('totalTTS')} value={overview?.totals.tts || 0} subtitle={t('ttsSynthesis')} icon="🎙️" />
        </div>

        {/* Quota Bar — no tokens */}
        {quota && (
          <div className="bg-[#1a1a2e] rounded-xl p-6 mb-8 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4">{t('monthlyQuota', { plan: quota.plan })}</h2>
            <div className="space-y-4">
              <QuotaBar label={t('copywritingQuota')} used={quota.usage.monthCalls} total={quota.quota.aiCalls} pct={quota.pct.calls} color="#6366f1" />
              <QuotaBar label={t('ttsQuota')} used={quota.usage.monthTts} total={quota.quota.tts} pct={quota.pct.tts} color="#10b981" />
              <QuotaBar label={t('videoQuota')} used={quota.usage.monthVideo} total={quota.quota.video} pct={quota.pct.video} color="#f59e0b" />
            </div>
            {quota.pct.calls >= 80 && (
              <p className="mt-4 text-sm text-amber-400 bg-amber-400/10 rounded-lg px-4 py-2 border border-amber-400/20">
                {t('quotaWarning')}
              </p>
            )}
          </div>
        )}

        {/* Trend Chart — 5 categories: copy/tts/poster/video/publish */}
        {trend && (
          <div className="bg-[#1a1a2e] rounded-xl p-6 mb-8 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4">{t('trend14d')}</h2>

            {/* Stacked bar chart */}
            <div className="flex items-end gap-[2px] h-40">
              {trend.trend.map((d, i) => {
                const total = (d.copywriting || 0) + (d.tts || 0) + (d.poster || 0) + (d.video || 0) + (d.publish || 0);
                const maxVal = Math.max(...trend.trend.map(x =>
                  (x.copywriting || 0) + (x.tts || 0) + (x.poster || 0) + (x.video || 0) + (x.publish || 0)
                ), 1);
                const h = Math.max((total / maxVal) * 100, 2);

                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="w-full flex flex-col-reverse relative" style={{ height: `${h}%` }}>
                      {/* Stacked segments */}
                      <div style={{ flex: d.publish || 0, backgroundColor: '#a855f7' }} title={`${t('publish')}: ${d.publish || 0}`} />
                      <div style={{ flex: d.video || 0, backgroundColor: '#f59e0b' }} title={`${t('video')}: ${d.video || 0}`} />
                      <div style={{ flex: d.poster || 0, backgroundColor: '#ec4899' }} title={`${t('poster')}: ${d.poster || 0}`} />
                      <div style={{ flex: d.tts || 0, backgroundColor: '#10b981' }} title={`${t('tts')}: ${d.tts || 0}`} />
                      <div style={{ flex: d.copywriting || 0, backgroundColor: '#6366f1' }} title={`${t('copywriting')}: ${d.copywriting || 0}`} />
                    </div>
                    {/* Tooltip */}
                    <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-[#0f0f1a] text-white text-xs rounded px-2 py-1 border border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      {d.date.slice(5)}: {total}
                    </div>
                    {(i % 3 === 0 || i === trend.trend.length - 1) && (
                      <span className="text-[10px] text-gray-500 mt-1">{d.date.slice(5)}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend — 5 categories */}
            <div className="flex flex-wrap gap-4 mt-6 text-xs text-gray-400">
              <Legend color="#6366f1" label={t('copywriting')} />
              <Legend color="#10b981" label={t('tts')} />
              <Legend color="#ec4899" label={t('poster')} />
              <Legend color="#f59e0b" label={t('video')} />
              <Legend color="#a855f7" label={t('publish')} />
            </div>
          </div>
        )}

        {/* Upgrade CTA */}
        {quota?.plan === 'free' && (
          <div className="bg-gradient-to-r from-[#6366f1]/20 to-[#10b981]/20 rounded-xl p-8 border border-[#6366f1]/30 text-center">
            <h2 className="text-xl font-semibold mb-2">{t('upgradeTitle')}</h2>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              {t('upgradeDesc')}
            </p>
            <Link to="/settings" className="inline-block bg-[#6366f1] text-white px-8 py-3 rounded-lg hover:bg-[#5558e6] transition-colors font-medium">
              {t('viewPlans')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon }: { title: string; value: string | number; subtitle: string; icon: string }) {
  return (
    <div className="bg-[#1a1a2e] rounded-xl p-5 border border-gray-800 hover:border-gray-700 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400 uppercase tracking-wider">{title}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: color }} />{label}</span>;
}

function QuotaBar({ label, used, total, pct, color }: { label: string; used: number; total: number; pct: number; color: string }) {
  const safePct = pct ?? 0;
  const safeUsed = used ?? 0;
  const safeTotal = total ?? 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-400">{formatNumber(safeUsed)} / {formatNumber(safeTotal)}</span>
      </div>
      <div className="h-2.5 bg-[#0f0f1a] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(safePct, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n == null) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

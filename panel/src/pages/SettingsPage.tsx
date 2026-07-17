import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import PricingCard from './components/PricingCard';
import { fetchProfile, updateProfile, changePassword, setEmailPassword, deleteAccount, type ProfileData } from '../lib/profileClient';
import { fetchMembers, inviteMember, removeMember, type TeamMember } from '../lib/teamClient';
import { getToken } from '../token';
import { apiUrl } from '../lib/api';
import SecurityTab from '../components/SecurityTab';

interface TrendData {
  days: number;
  trend: { date: string; copywriting: number; tts: number; poster: number; video: number; publish: number }[];
}

type Tab = 'profile' | 'billing' | 'team' | 'history' | 'security';

export default function SettingsPage() {
  const { t } = useTranslation('settings');
  const [tab, setTab] = useState<Tab>('profile');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [quotaSummary, setQuotaSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  // Fetch usage history and audit log when history tab active
  useEffect(() => {
    if (tab === 'history') {
      const token = getToken();
      if (!token) return;
      Promise.all([
        fetch(apiUrl('/api/dashboard/trend?days=30'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null),
      ]).then(([trendData]) => {
        setTrendData(trendData);
      });
    }
  }, [tab]);

  // Profile form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currPw, setCurrPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [delPw, setDelPw] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  // Wallet bind state
  const [showBind, setShowBind] = useState(false);
  const [bindEmail, setBindEmail] = useState('');
  const [bindPw, setBindPw] = useState('');
  const [bindPw2, setBindPw2] = useState('');

  // History tab data
  const [trendData, setTrendData] = useState<TrendData | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  // Team invite
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [p, m] = await Promise.all([fetchProfile(), fetchMembers()]);
        setProfile(p);
        setName(p.user.name || '');
        setEmail(p.user.email || '');
        setMembers(m);
      } catch {
        // Not logged in
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Fetch plans from DB when billing tab active
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    if (tab === 'billing') {
      fetch(apiUrl('/api/plans'))
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(d => setPlans(d.plans || d))
        .catch(() => setPlans([]));
    }
  }, [tab]);
  useEffect(() => {
    if (tab === 'billing') {
      fetch('/api/quota/summary', { headers: { Authorization: `Bearer ${getToken()}` } })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(d => setQuotaSummary(d))
        .catch(() => setQuotaSummary(null));
    }
  }, [tab]);

  const handleUpdateProfile = async () => {
    try {
      const updated = await updateProfile({ name, email });
      setProfile(updated);
      showToast(t('toast.profileUpdated'), 'success');
    } catch (e: any) {
      showToast(e.message || t('toast.failed'), 'error');
    }
  };

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) { showToast(t('toast.pwMismatch'), 'error'); return; }
    try {
      await changePassword(currPw, newPw);
      setCurrPw(''); setNewPw(''); setConfirmPw('');
      showToast(t('toast.pwChanged'), 'success');
    } catch (e: any) {
      showToast(e.message || t('toast.failed'), 'error');
    }
  };

  const handleBindEmailPassword = async () => {
    if (bindPw !== bindPw2) { showToast(t('toast.pwMismatch'), 'error'); return; }
    try {
      await setEmailPassword(bindEmail, bindPw);
      setShowBind(false);
      setBindEmail(''); setBindPw(''); setBindPw2('');
      showToast(t('toast.bindSuccess'), 'success');
      // Refresh profile
      const updated = await fetchProfile();
      setProfile(updated);
    } catch (e: any) {
      showToast(e.message || t('toast.failed'), 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAccount(delPw);
      localStorage.clear();
      window.location.href = '/';
    } catch (e: any) {
      showToast(e.message || t('toast.failed'), 'error');
    }
  };

  const handleInvite = async () => {
    try {
      await inviteMember(inviteEmail, inviteRole);
      const updated = await fetchMembers();
      setMembers(updated);
      setInviteEmail('');
      setShowInvite(false);
      showToast(t('toast.invited'), 'success');
    } catch (e: any) {
      showToast(e.message || t('toast.failed'), 'error');
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeMember(id);
      setMembers(prev => prev.filter(m => m.id !== id));
      showToast(t('toast.memberRemoved'), 'success');
    } catch (e: any) {
      showToast(e.message || t('toast.failed'), 'error');
    }
  };

  const isWalletUser = !!profile?.user.walletAddress;

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400">{t('loading')}</div>;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profile', label: t('tabs.profile') },
    { key: 'billing', label: t('tabs.billing') },
    { key: 'team', label: t('tabs.team') },
    { key: 'history', label: t('tabs.history') },
    { key: 'security', label: t('tabs.security') },
  ];

  return (
    <div className="text-white">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg text-sm font-medium ${toast.type === 'success' ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
          {toast.msg}
        </div>
      )}

      <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border-b border-dark-border overflow-x-auto">
        {tabs.map((t: { key: Tab; label: string }) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              tab === t.key
                ? 'text-white border-accent-primary'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PROFILE ── */}
      {tab === 'profile' && profile && (
        <div className="space-y-6">
          <div className="bg-dark-card border border-dark-border rounded-xl p-6 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-accent-primary flex items-center justify-center text-2xl font-bold">
              {(profile.user.name || profile.user.username)[0].toUpperCase()}
            </div>
            <div>
              <div className="text-lg font-bold">{profile.user.username}</div>
              <div className="text-sm text-gray-400">{profile.tenant.plan} · {profile.tenant.name}</div>
            </div>
          </div>

          {/* Personal Info */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold">{t('profile.personalInfo')}</h2>
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('profile.name')}</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent-primary transition-colors" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('profile.email')}</label>
              <input value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent-primary transition-colors" />
            </div>
            <button onClick={handleUpdateProfile}
              className="bg-accent-primary hover:bg-accent-primary/80 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
              {t('profile.save')}
            </button>
          </div>

          {/* Wallet */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-6">
            <h2 className="text-lg font-bold mb-2">{t('profile.wallet')}</h2>
            <code className="text-sm text-gray-400 break-all">
              {profile.user.walletAddress || t('profile.noWallet')}
            </code>
            {!isWalletUser && (
              <button onClick={async () => {
                const eth = (window as any).ethereum;
                if (!eth) { showToast(t('toast.noWallet'), 'error'); return; }
                try {
                  const accounts = await eth.request({ method: 'eth_requestAccounts' });
                  const address = accounts[0].toLowerCase();
                  const message = `Connect wallet to Aiops\nAddress: ${address}\nNonce: ${Date.now()}`;
                  const signature = await eth.request({ method: 'personal_sign', params: [message, address] });
                  const token = getToken();
                  const r = await fetch(apiUrl('/api/auth/wallet-bind'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ walletAddress: address, message, signature }),
                  });
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.error || 'Binding failed');
                  showToast(t('toast.bindWalletSuccess'), 'success');
                  const updated = await fetchProfile();
                  setProfile(updated);
                } catch (e: any) { showToast(e.message, 'error'); }
              }}
                className="mt-3 bg-[#f59e0b] hover:bg-[#d97706] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                🦊 {t('profile.connectWallet')}
              </button>
            )}
          </div>

          {/* Wallet bind email + password */}
          {isWalletUser && (
            <div className="bg-dark-card border border-dark-border rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold">{t('profile.bindTitle')}</h2>
              <p className="text-sm text-gray-400">{t('profile.bindDesc')}</p>
              {!showBind ? (
                <button onClick={() => setShowBind(true)}
                  className="bg-accent-primary hover:bg-accent-primary/80 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
                  {t('profile.bindBtn')}
                </button>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">{t('profile.email')}</label>
                    <input value={bindEmail} onChange={e => setBindEmail(e.target.value)} placeholder={t('profile.emailPlaceholder')}
                      className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent-primary" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">{t('profile.newPassword')}</label>
                    <input type="password" value={bindPw} onChange={e => setBindPw(e.target.value)}
                      className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent-primary" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">{t('profile.confirmPassword')}</label>
                    <input type="password" value={bindPw2} onChange={e => setBindPw2(e.target.value)}
                      className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent-primary" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleBindEmailPassword}
                      className="bg-accent-primary hover:bg-accent-primary/80 text-white px-6 py-2 rounded-lg text-sm font-medium">
                      {t('profile.bindConfirm')}
                    </button>
                    <button onClick={() => { setShowBind(false); setBindEmail(''); setBindPw(''); setBindPw2(''); }}
                      className="bg-dark-hover hover:bg-dark-border text-white px-6 py-2 rounded-lg text-sm font-medium">
                      {t('profile.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Change Password */}
          {!isWalletUser && (
            <div className="bg-dark-card border border-dark-border rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold">{t('profile.changePassword')}</h2>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('profile.currentPassword')}</label>
                <input type="password" value={currPw} onChange={e => setCurrPw(e.target.value)}
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent-primary" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('profile.newPassword')}</label>
                <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent-primary" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('profile.confirmPassword')}</label>
                <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent-primary" />
              </div>
              <button onClick={handleChangePassword}
                className="bg-accent-primary hover:bg-accent-primary/80 text-white px-6 py-2 rounded-lg text-sm font-medium">
                {t('profile.updatePassword')}
              </button>
            </div>
          )}

          {/* Danger Zone */}
          <div className="bg-dark-card border border-red-500/30 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-red-400">{t('profile.dangerZone')}</h2>
            <p className="text-sm text-gray-400">{t('profile.dangerDesc')}</p>
            {!showDelete ? (
              <button onClick={() => setShowDelete(true)}
                className="bg-red-500/10 border border-red-500/30 text-red-400 px-6 py-2 rounded-lg text-sm font-medium hover:bg-red-500/20">
                {t('profile.deleteAccount')}
              </button>
            ) : (
              <div className="space-y-3">
                <input type="password" value={delPw} onChange={e => setDelPw(e.target.value)} placeholder={t('profile.deleteConfirm')}
                  className="w-full bg-dark-bg border border-red-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500" />
                <div className="flex gap-3">
                  <button onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg text-sm font-medium">
                    {t('profile.confirmDelete')}
                  </button>
                  <button onClick={() => { setShowDelete(false); setDelPw(''); }} className="bg-dark-hover hover:bg-dark-border text-white px-6 py-2 rounded-lg text-sm font-medium">
                    {t('profile.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── BILLING ── */}
      {tab === 'billing' && profile && (
        <div className="space-y-6">
          <div className="bg-dark-card border border-dark-border rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4">{t('billing.currentPlan')}</h2>
            <div className="flex flex-wrap gap-4 text-sm">
              <div><span className="text-gray-400">{t('billing.plan')}: </span><span className="font-bold capitalize">{profile.tenant.plan}</span></div>
            </div>
          </div>

          {/* Usage Stats */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4">{t('billing.usageStats')}</h2>
            {quotaSummary ? (() => {
              const qs = quotaSummary.quotas;
              const makeItem = (key: string) => {
                const val = qs[key];
                if (!val || val.limit === null || val.limit <= 0) return null;
                const pct = Math.round((val.used / val.limit) * 100);
                const name: Record<string, string> = {
                  content: t('billing.copywriting'),
                  tts: t('billing.voice'),
                  video: t('billing.video'),
                };
                return { key, label: name[key] || key, used: val.used, limit: val.limit, pct };
              };
              const items = ['content','tts','video'].map(makeItem).filter(Boolean) as any[];
              return items.map((item: any) => (
                <div key={item.key} className="mb-4 last:mb-0">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{item.label}</span>
                    <span className={`font-medium ${item.pct > 80 ? 'text-red-400' : item.pct > 50 ? 'text-amber-400' : 'text-green-400'}`}>
                      {item.pct}% — {item.used}/{item.limit}
                    </span>
                  </div>
                  <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${item.pct > 80 ? 'bg-red-500' : item.pct > 50 ? 'bg-amber-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(item.pct, 100)}%` }} />
                  </div>
                </div>
              ));
            })() : (
              <div className="text-sm text-gray-400">{t('loading')}</div>
            )}
          </div>

          {/* Pricing — from Plans DB */}
          <h2 className="text-lg font-bold">{t('billing.upgradePlan')}</h2>
          {plans.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((plan: any) => {
                const isCurrent = profile.tenant.plan === plan.name;
                const features = [
                  `${plan.contentPerMonth || 0} ${t('billing.copywriting')}/月`,
                  `${plan.ttsPerMonth || 0} ${t('billing.voice')}/月`,
                  `${plan.videoPerMonth || 0} ${t('billing.video')}/月`,
                  `${plan.tokensPerMonth ? (plan.tokensPerMonth / 1000).toFixed(0) + 'K Token' : t('billing.basicSupport')}/月`,
                ];
                return (
                  <PricingCard
                    key={plan.name}
                    name={plan.displayName || plan.name}
                    price={`${plan.price?.toLocaleString() || plan.price} USDC`}
                    features={features}
                    ctaText={isCurrent ? t('billing.currentPlan') : plan.name === 'enterprise' ? t('billing.contact') : t('billing.upgrade')}
                    planId={plan.name}
                    highlighted={plan.name === 'starter'}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-4">{t('loading')}</p>
          )}
        </div>
      )}

      {/* ── TEAM ── */}
      {tab === 'team' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{t('team.title')}</h2>
            <button onClick={() => setShowInvite(true)}
              className="bg-accent-primary hover:bg-accent-primary/80 text-white px-4 py-2 rounded-lg text-sm font-medium">
              + {t('team.invite')}
            </button>
          </div>

          {showInvite && (
            <div className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-3">
              <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder={t('team.emailPlaceholder')}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-accent-primary" />
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-accent-primary">
                <option value="editor">{t('team.roles.editor')}</option>
                <option value="reviewer">{t('team.roles.reviewer')}</option>
                <option value="viewer">{t('team.roles.viewer')}</option>
              </select>
              <div className="flex gap-3">
                <button onClick={handleInvite} className="bg-accent-primary hover:bg-accent-primary/80 text-white px-4 py-2 rounded-lg text-sm">
                  {t('team.sendInvite')}
                </button>
                <button onClick={() => setShowInvite(false)} className="bg-dark-hover hover:bg-dark-border text-white px-4 py-2 rounded-lg text-sm">
                  {t('team.cancel')}
                </button>
              </div>
            </div>
          )}

          <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-400 border-b border-dark-border">
                <th className="text-left py-3 px-4">{t('team.member')}</th>
                <th className="text-left py-3 px-4">{t('team.role')}</th>
                <th className="text-left py-3 px-4">{t('team.status')}</th>
                <th className="text-right py-3 px-4">{t('team.action')}</th>
              </tr></thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} className="border-b border-dark-border last:border-0">
                    <td className="py-3 px-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent-primary flex items-center justify-center text-xs font-bold">
                        {(m.name || m.username || m.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{m.name || m.username}</div>
                        <div className="text-xs text-gray-400">{m.email}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        m.role === 'owner' ? 'bg-accent-primary/20 text-accent-primary' :
                        m.role === 'admin' ? 'bg-amber-500/10 text-amber-400' :
                        m.role === 'editor' ? 'bg-green-500/10 text-green-400' :
                        'bg-dark-hover text-gray-400'
                      }`}>{t(`team.roles.${m.role}`, m.role)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs ${m.status === 'active' ? 'text-green-400' : 'text-gray-400'}`}>
                        {t(`team.statuses.${m.status}`, m.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {m.role !== 'owner' && (
                        <button onClick={() => handleRemove(m.id)} className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-red-500/10">
                          {t('team.remove')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── HISTORY ── */}
      {tab === 'history' && (
        <div className="space-y-6">
          <div className="bg-dark-card border border-dark-border rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4">{t('history.usageTitle')}</h2>
            {trendData && trendData.trend && trendData.trend.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-gray-400 border-b border-dark-border">
                    <th className="text-left py-2 pr-4">{t('history.date')}</th>
                    <th className="text-right py-2 pr-4">{t('history.copywriting')}</th>
                    <th className="text-right py-2 pr-4">{t('history.tts')}</th>
                    <th className="text-right py-2 pr-4">{t('history.poster')}</th>
                    <th className="text-right py-2 pr-4">{t('history.video')}</th>
                    <th className="text-right py-2">{t('history.publish')}</th>
                  </tr></thead>
                  <tbody className="text-gray-200">
                    {trendData.trend.filter(d =>
                      (d.copywriting || 0) + (d.tts || 0) + (d.poster || 0) + (d.video || 0) + (d.publish || 0) > 0
                    ).slice(0, 30).map((d, i) => (
                      <tr key={i} className="border-b border-dark-border last:border-0">
                        <td className="py-2 pr-4">{d.date}</td>
                        <td className="py-2 pr-4 text-right">{d.copywriting || 0}</td>
                        <td className="py-2 pr-4 text-right">{d.tts || 0}</td>
                        <td className="py-2 pr-4 text-right">{d.poster || 0}</td>
                        <td className="py-2 pr-4 text-right">{d.video || 0}</td>
                        <td className="py-2 text-right">{d.publish || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {trendData.trend.every(d => (d.copywriting || 0) + (d.tts || 0) + (d.poster || 0) + (d.video || 0) + (d.publish || 0) === 0) && (
                  <p className="text-gray-500 text-center py-8">{t('history.noData')}</p>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">{t('history.noData')}</p>
            )}
          </div>
        </div>
      )}

      {/* ── SECURITY ── */}
      {tab === 'security' && <SecurityTab />}
    </div>
  );
}

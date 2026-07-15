import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { apiUrl } from '../lib/api';
import { getToken } from '../token';
import { ExternalLink, CheckCircle2, X, Trash2, Loader2 } from 'lucide-react';

interface Account {
  id: string;
  tenantId: string;
  userId: string | null;
  platform: string;
  name: string;
  platformUserId: string | null;
  screenName: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

const PLATFORM_ICONS: Record<string, string> = {
  twitter: '🐦', facebook: '📘', instagram: '📷', xiaohongshu: '📕',
  tiktok: '🎵', linkedin: '💼',
};

const PLATFORM_NAMES: Record<string, string> = {
  twitter: 'Twitter/X', facebook: 'Facebook', instagram: 'Instagram',
  xiaohongshu: '小红书', tiktok: 'TikTok', linkedin: 'LinkedIn',
};

const PLATFORM_COLORS: Record<string, string> = {
  twitter: 'bg-blue-500/20', facebook: 'bg-blue-600/20', instagram: 'bg-pink-500/20',
  xiaohongshu: 'bg-red-500/20', tiktok: 'bg-gray-400/20', linkedin: 'bg-blue-700/20',
};

function useAuth() {
  const [token] = useState<string | null>(getToken());
  return { token, isLoggedIn: !!token };
}

async function apiGet(token: string, path: string) {
  const res = await fetch(apiUrl(path), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost(token: string, path: string, body?: any) {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiDel(token: string, path: string) {
  const res = await fetch(apiUrl(path), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function AccountsPage() {
  const { t } = useTranslation(['accounts', 'common']);
  const { token } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Twitter binding modal
  const [showTwitterModal, setShowTwitterModal] = useState(false);
  const [authUrl, setAuthUrl] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [bindingStep, setBindingStep] = useState<'idle' | 'loading' | 'auth' | 'done'>('idle');
  const [twitterOauthToken, setTwitterOauthToken] = useState('');
  const [confirmUnbind, setConfirmUnbind] = useState<{ id: string; name: string } | null>(null);

  const loadAccounts = async () => {
    if (!token) { setLoading(false); return; }
    try {
      const data = await apiGet(token, '/api/accounts');
      setAccounts(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAccounts(); }, [token]);

  const getAccountsByPlatform = (platform: string) =>
    accounts.filter(a => a.platform === platform);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  // ── Twitter PIN Flow ──
  const handleStartTwitterAuth = async () => {
    setBindingStep('loading');
    try {
      const resp = await apiPost(token!, '/api/accounts/twitter/request-token');
      setAuthUrl(resp.authUrl);
      setTwitterOauthToken(resp.oauth_token);
      setBindingStep('auth');
      window.open(resp.authUrl, '_blank');
    } catch (e: any) {
      setError(e.message);
      setBindingStep('idle');
    }
  };

  const handleSubmitPin = async () => {
    if (!pinCode.trim()) return;
    setBindingStep('loading');
    try {
      await apiPost(token!, '/api/accounts/twitter/access-token', {
        oauth_token: twitterOauthToken,
        oauth_verifier: pinCode.trim(),
      });
      setBindingStep('done');
      setTimeout(() => {
        setShowTwitterModal(false);
        setPinCode(''); setAuthUrl(''); setTwitterOauthToken('');
        setBindingStep('idle');
      }, 1500);
      loadAccounts();
    } catch (e: any) {
      setError(e.message);
      setBindingStep('auth');
    }
  };

  // ── Unbind ──
  const handleUnbind = async () => {
    if (!confirmUnbind) return;
    const { id } = confirmUnbind;
    setConfirmUnbind(null);
    try {
      await apiDel(token!, `/api/accounts/${id}`);
      loadAccounts();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-[#6366f1]" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">👤 {t('accounts:title', 'Social Accounts')}</h2>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 hover:text-red-300"><X size={14} /></button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Twitter — OAuth 1.0a PIN Flow */}
        <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-2xl">🐦</div>
              <div>
                <h3 className="font-semibold text-white">Twitter/X</h3>
                <p className="text-xs text-[#9ca3af]">OAuth 1.0a PIN flow</p>
              </div>
            </div>
            {getAccountsByPlatform('twitter').map(acc => (
              <div key={acc.id} className="flex items-center gap-3 bg-[#0f0f1a] rounded-lg p-3 mb-3 border border-[#2a2a3e]">
                <CheckCircle2 size={18} className="text-green-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">@{acc.screenName || acc.name}</p>
                  <p className="text-xs text-[#9ca3af]">{formatDate(acc.createdAt)}</p>
                </div>
                <button
                  onClick={() => setConfirmUnbind({ id: acc.id, name: `@${acc.screenName || acc.name}` })}
                  className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button
              onClick={() => { setShowTwitterModal(true); setBindingStep('idle'); setPinCode(''); setAuthUrl(''); }}
              className="w-full py-2 bg-[#6366f1]/20 text-[#6366f1] rounded-lg text-sm font-medium hover:bg-[#6366f1]/30 transition-colors"
            >
              {getAccountsByPlatform('twitter').length ? 'Bind Another' : 'Connect Twitter'}
            </button>
          </div>
        </div>

        {/* Other platforms — direct credential entry */}
        {['facebook', 'instagram', 'xiaohongshu', 'tiktok', 'linkedin'].map(platform => (
          <div key={platform} className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl overflow-hidden">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 ${PLATFORM_COLORS[platform]} rounded-xl flex items-center justify-center text-2xl`}>
                  {PLATFORM_ICONS[platform] || '🔗'}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{PLATFORM_NAMES[platform]}</h3>
                  <p className="text-xs text-[#9ca3af]">Manual setup</p>
                </div>
              </div>
              {getAccountsByPlatform(platform).map(acc => (
                <div key={acc.id} className="flex items-center gap-3 bg-[#0f0f1a] rounded-lg p-3 mb-3 border border-[#2a2a3e]">
                  <CheckCircle2 size={18} className="text-green-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{acc.name}</p>
                    <p className="text-xs text-[#9ca3af]">{formatDate(acc.createdAt)}</p>
                  </div>
                  <button
                    onClick={() => setConfirmUnbind({ id: acc.id, name: acc.name })}
                    className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <AddAccountButton platform={platform} token={token!} onAdded={loadAccounts} />
            </div>
          </div>
        ))}

        {/* Coming soon */}
        {['douyin', 'bilibili', 'youtube'].map(p => (
          <div key={p} className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl overflow-hidden opacity-40">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gray-500/20 rounded-xl flex items-center justify-center text-2xl">
                  {PLATFORM_ICONS[p] || '🔗'}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{PLATFORM_NAMES[p] || p}</h3>
                  <p className="text-xs text-[#9ca3af]">Coming soon</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Twitter Binding Modal */}
      {showTwitterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#2a2a3e]">
              <h3 className="font-semibold text-white">🐦 Connect Twitter</h3>
              <button onClick={() => setShowTwitterModal(false)} className="p-1 text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {bindingStep === 'idle' && (
                <div className="text-center py-4">
                  <p className="text-sm text-[#9ca3af] mb-4">
                    Authorize via Twitter OAuth PIN flow. You'll get a PIN code from Twitter.
                  </p>
                  <button onClick={handleStartTwitterAuth}
                    className="px-5 py-2.5 bg-[#6366f1] rounded-lg font-medium hover:bg-[#5558e6] text-white transition-colors">
                    Get Authorization Link
                  </button>
                </div>
              )}
              {bindingStep === 'loading' && (
                <div className="text-center py-8">
                  <Loader2 size={32} className="mx-auto animate-spin text-[#6366f1] mb-3" />
                  <p className="text-sm text-[#9ca3af]">Processing...</p>
                </div>
              )}
              {bindingStep === 'auth' && (
                <>
                  <div className="bg-[#0f0f1a] rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium text-white">Step 1: Open authorization page</p>
                    <a href={authUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-[#6366f1] hover:underline">
                      <ExternalLink size={14} /> Open Twitter Auth
                    </a>
                  </div>
                  <div className="bg-[#0f0f1a] rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium text-white">Step 2: Enter PIN</p>
                    <input
                      type="text"
                      placeholder="Paste PIN code here"
                      value={pinCode}
                      onChange={e => setPinCode(e.target.value)}
                      className="w-full px-3 py-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg text-white text-center text-lg tracking-widest focus:outline-none focus:border-[#6366f1]"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={handleSubmitPin}
                    disabled={!pinCode.trim()}
                    className="w-full py-2.5 bg-[#6366f1] rounded-lg font-medium hover:bg-[#5558e6] disabled:opacity-50 text-white transition-colors">
                    Confirm & Bind
                  </button>
                </>
              )}
              {bindingStep === 'done' && (
                <div className="text-center py-4">
                  <CheckCircle2 size={48} className="mx-auto text-green-400 mb-3" />
                  <p className="text-green-400 font-medium">Successfully connected!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Unbind Confirmation Dialog */}
      {confirmUnbind && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Remove Account</h3>
            <p className="text-[#9ca3af] text-sm mb-6">
              Are you sure you want to remove <span className="text-white font-medium">{confirmUnbind.name}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmUnbind(null)}
                className="px-4 py-2 bg-[#2a2a3e] text-white rounded-lg hover:bg-[#3a3a4e] transition-colors text-sm">
                Cancel
              </button>
              <button onClick={handleUnbind}
                className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm">
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Add Account button for non-Twitter platforms
function AddAccountButton({ platform, token, onAdded }: { platform: string; token: string; onAdded: () => void }) {
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');

  const handleAdd = async () => {
    if (!name.trim()) return;
    try {
      await apiPost(token, '/api/accounts', { platform, name });
      setShow(false);
      setName('');
      onAdded();
    } catch { /* error handled by parent */ }
  };

  return (
    <>
      <button
        onClick={() => setShow(true)}
        className="w-full py-2 bg-[#6366f1]/20 text-[#6366f1] rounded-lg text-sm font-medium hover:bg-[#6366f1]/30 transition-colors">
        Connect {PLATFORM_NAMES[platform]}
      </button>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              {PLATFORM_ICONS[platform]} Connect {PLATFORM_NAMES[platform]}
            </h3>
            <input
              type="text"
              placeholder="Account name or handle"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg text-white mb-4 focus:outline-none focus:border-[#6366f1]"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShow(false)}
                className="px-4 py-2 bg-[#2a2a3e] text-white rounded-lg hover:bg-[#3a3a4e] transition-colors text-sm">
                Cancel
              </button>
              <button onClick={handleAdd}
                className="px-4 py-2 bg-[#6366f1] text-white rounded-lg hover:bg-[#5558e6] transition-colors text-sm">
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

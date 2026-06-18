import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../AuthContext';
import { ExternalLink, CheckCircle2, Globe, X, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const PLATFORM_ICONS: Record<string, string> = {
  twitter: '🐦', youtube: '▶️', meta: '📱', reddit: '🔴',
  tiktok: '🎵', bilibili: '📺', douyin: '🎬', kwai: '🎥',
  pinterest: '📌', threads: '🧵',
};

const PLATFORM_NAMES: Record<string, string> = {
  twitter: 'Twitter/X', youtube: 'YouTube', meta: 'Facebook/Instagram',
  reddit: 'Reddit', tiktok: 'TikTok', bilibili: 'B站', douyin: '抖音',
  kwai: '快手', pinterest: 'Pinterest', threads: 'Threads',
};

// Platforms that use OAuth 2.0 callback flow (vs PIN mode)
const OAUTH2_PLATFORMS = ['youtube', 'meta', 'reddit'];

export default function AccountsPage() {
  const { token } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Twitter binding modal
  const [showTwitterModal, setShowTwitterModal] = useState(false);
  const [authUrl, setAuthUrl] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [bindingStep, setBindingStep] = useState<'idle' | 'loading' | 'auth' | 'done'>('idle');

  const loadAccounts = async () => {
    if (!token) return;
    try {
      const resp = await api(token).get('/accounts');
      setAccounts(resp);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    loadAccounts();
    // Check for OAuth success/error from URL params (redirected back)
    const params = new URLSearchParams(window.location.search);
    const oauthSuccess = params.get('oauth_success');
    const oauthError = params.get('oauth_error');
    if (oauthSuccess) {
      toast.success(`${PLATFORM_NAMES[oauthSuccess] || oauthSuccess} 绑定成功！`);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      loadAccounts();
    }
    if (oauthError) {
      const msgs: Record<string, string> = {
        expired: '授权已过期，请重试',
        missing_params: '回调参数不完整',
        token_exchange_failed: '获取 Token 失败',
        invalid_state: '无效的授权状态，请重试',
      };
      toast.error(msgs[oauthError] || `授权失败: ${oauthError}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [token]);

  // ── Twitter PIN Flow ──
  const handleStartTwitterAuth = async () => {
    setBindingStep('loading');
    try {
      const resp = await api(token!).post('/oauth/twitter/request-token', {});
      setAuthUrl(resp.authUrl);
      setBindingStep('auth');
      window.open(resp.authUrl, '_blank');
    } catch (e: any) {
      toast.error(e.message || '获取授权链接失败');
      setBindingStep('idle');
    }
  };

  const handleSubmitPin = async () => {
    if (!pinCode.trim()) return toast.error('请输入 PIN 码');
    setBindingStep('loading');
    try {
      const oauthToken = new URL(authUrl).searchParams.get('oauth_token') || '';
      await api(token!).post('/oauth/twitter/access-token', {
        oauth_token: oauthToken,
        oauth_verifier: pinCode.trim(),
      });
      toast.success('Twitter 账号绑定成功！');
      setBindingStep('done');
      setTimeout(() => {
        setShowTwitterModal(false);
        setPinCode(''); setAuthUrl('');
        setBindingStep('idle');
      }, 1500);
      loadAccounts();
    } catch (e: any) {
      toast.error(e.message || '绑定失败，请重试');
      setBindingStep('auth');
    }
  };

  // ── OAuth 2.0 Flow ──
  const handleOAuth2Auth = async (platform: string) => {
    try {
      const resp = await api(token!).post(`/oauth/${platform}/auth-url`, {});
      // Redirect user to the platform's auth page
      window.location.href = resp.authUrl;
    } catch (e: any) {
      toast.error(e.message || `获取 ${PLATFORM_NAMES[platform] || platform} 授权链接失败`);
    }
  };

  // ── Unbind ──
  const handleUnbind = async (id: string, name: string) => {
    if (!confirm(`确定解除绑定 ${name}？`)) return;
    try {
      await api(token!).del('/accounts/' + id);
      toast.success(`已解除绑定`);
      loadAccounts();
    } catch (e: any) { toast.error(e.message || '解除绑定失败'); }
  };

  const getAccountsByPlatform = (platform: string) =>
    accounts.filter(a => a.platform === platform);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">👤 账号管理</h2>
      </div>

      {/* Supported Platforms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Twitter */}
        <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-2xl">🐦</div>
              <div>
                <h3 className="font-semibold">Twitter/X</h3>
                <p className="text-xs text-gray-500">OAuth 1.0a PIN 模式</p>
              </div>
            </div>
            {getAccountsByPlatform('twitter').map(acc => (
              <div key={acc.id} className="flex items-center gap-3 bg-dark-bg rounded-lg p-3 mb-3 border border-dark-border">
                <CheckCircle2 size={18} className="text-green-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">@{acc.screenName}</p>
                  <p className="text-xs text-gray-500">{new Date(acc.createdAt).toLocaleDateString('zh-CN')} 绑定</p>
                </div>
                <button onClick={() => handleUnbind(acc.id, '@' + acc.screenName)} className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button onClick={() => { setShowTwitterModal(true); setBindingStep('idle'); setPinCode(''); setAuthUrl(''); }}
              className="w-full py-2 bg-blue-500 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
              {getAccountsByPlatform('twitter').length ? '+ 绑定另一个' : '绑定 Twitter'}
            </button>
          </div>
        </div>

        {/* YouTube */}
        <PlatformCard platform="youtube" icon="▶️" label="YouTube" desc="OAuth 2.0 PKCE" accounts={getAccountsByPlatform('youtube')}
          onBind={() => handleOAuth2Auth('youtube')} onUnbind={handleUnbind} color="bg-red-500/20" />

        {/* Facebook/Meta */}
        <PlatformCard platform="meta" icon="📱" label="Facebook / Instagram" desc="OAuth 2.0 PKCE" accounts={getAccountsByPlatform('meta')}
          onBind={() => handleOAuth2Auth('meta')} onUnbind={handleUnbind} color="bg-blue-500/20" />

        {/* Reddit */}
        <PlatformCard platform="reddit" icon="🔴" label="Reddit" desc="OAuth 2.0 PKCE" accounts={getAccountsByPlatform('reddit')}
          onBind={() => handleOAuth2Auth('reddit')} onUnbind={handleUnbind} color="bg-orange-500/20" />

        {/* Other platforms - coming soon */}
        {['tiktok', 'bilibili', 'douyin', 'kwai', 'pinterest', 'threads'].map(p => (
          <div key={p} className="bg-dark-card rounded-xl border border-dark-border overflow-hidden opacity-40">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gray-500/20 rounded-xl flex items-center justify-center text-2xl">
                  {PLATFORM_ICONS[p] || '🔗'}
                </div>
                <div>
                  <h3 className="font-semibold">{PLATFORM_NAMES[p] || p}</h3>
                  <p className="text-xs text-gray-500">即将支持</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Twitter Binding Modal */}
      {showTwitterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-card rounded-xl border border-dark-border w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-dark-border">
              <h3 className="font-semibold">🐦 绑定 Twitter 账号</h3>
              <button onClick={() => setShowTwitterModal(false)} className="p-1 text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              {bindingStep === 'idle' && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-400 mb-4">点击下方按钮，获取 Twitter 授权链接</p>
                  <button onClick={handleStartTwitterAuth} className="px-5 py-2.5 bg-blue-500 rounded-lg font-medium hover:bg-blue-600">获取授权链接</button>
                </div>
              )}
              {bindingStep === 'loading' && (
                <div className="text-center py-8">
                  <Loader2 size={32} className="mx-auto animate-spin text-blue-400 mb-3" />
                  <p className="text-sm text-gray-400">处理中...</p>
                </div>
              )}
              {bindingStep === 'auth' && (
                <>
                  <div className="bg-dark-bg rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium">第 1 步：打开 Twitter 授权页面</p>
                    <a href={authUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:underline">
                      <ExternalLink size={14} /> 点击此处打开（已弹窗）
                    </a>
                  </div>
                  <div className="bg-dark-bg rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium">第 2 步：输入 PIN 码</p>
                    <input type="text" placeholder="输入 7 位 PIN 码..." value={pinCode}
                      onChange={e => setPinCode(e.target.value)}
                      className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-white text-center text-lg tracking-widest" autoFocus />
                  </div>
                  <button onClick={handleSubmitPin} disabled={!pinCode.trim()}
                    className="w-full py-2.5 bg-blue-500 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50">确认绑定</button>
                </>
              )}
              {bindingStep === 'done' && (
                <div className="text-center py-4">
                  <CheckCircle2 size={48} className="mx-auto text-green-400 mb-3" />
                  <p className="text-green-400 font-medium">绑定成功！</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable platform card component
function PlatformCard({ platform, icon, label, desc, accounts, onBind, onUnbind, color }: {
  platform: string; icon: string; label: string; desc: string;
  accounts: any[]; onBind: () => void; onUnbind: (id: string, name: string) => void; color: string;
}) {
  return (
    <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center text-2xl`}>{icon}</div>
          <div>
            <h3 className="font-semibold">{label}</h3>
            <p className="text-xs text-gray-500">{desc}</p>
          </div>
        </div>
        {accounts.map(acc => (
          <div key={acc.id} className="flex items-center gap-3 bg-dark-bg rounded-lg p-3 mb-3 border border-dark-border">
            <CheckCircle2 size={18} className="text-green-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{acc.name}</p>
              <p className="text-xs text-gray-500">{new Date(acc.createdAt).toLocaleDateString('zh-CN')} 绑定</p>
            </div>
            <button onClick={() => onUnbind(acc.id, acc.name)} className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        <button onClick={onBind}
          className="w-full py-2 bg-accent-primary/50 rounded-lg text-sm font-medium hover:bg-accent-primary/70 transition-colors">
          {accounts.length ? '+ 绑定另一个' : `绑定 ${label}`}
        </button>
      </div>
    </div>
  );
}

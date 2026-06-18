import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../AuthContext';
import { ExternalLink, CheckCircle2, Globe, X, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const PLATFORM_ICONS: Record<string, string> = {
  twitter: '🐦', youtube: '▶️', tiktok: '🎵', meta: '📱',
  bilibili: '📺', douyin: '🎬', kwai: '🎥', pinterest: '📌',
  threads: '🧵', 'wx-gzh': '💬',
};

const PLATFORM_NAMES: Record<string, string> = {
  twitter: 'Twitter/X', youtube: 'YouTube', tiktok: 'TikTok',
  meta: 'Instagram/Facebook', bilibili: 'B站', douyin: '抖音',
  kwai: '快手', pinterest: 'Pinterest', threads: 'Threads',
};

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

  useEffect(() => { loadAccounts(); }, [token]);

  // Step 1: Get authorization URL
  const handleStartTwitterAuth = async () => {
    setBindingStep('loading');
    try {
      const resp = await api(token!).post('/oauth/twitter/request-token', {});
      setAuthUrl(resp.authUrl);
      setBindingStep('auth');
      // Open in new tab
      window.open(resp.authUrl, '_blank');
    } catch (e: any) {
      toast.error(e.message || '获取授权链接失败');
      setBindingStep('idle');
    }
  };

  // Step 2: Exchange PIN for access token
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
        setPinCode('');
        setAuthUrl('');
        setBindingStep('idle');
      }, 1500);
      loadAccounts();
    } catch (e: any) {
      toast.error(e.message || '绑定失败，请重试');
      setBindingStep('auth');
    }
  };

  // Unbind account
  const handleUnbind = async (id: string) => {
    if (!confirm('确定解除绑定？')) return;
    try {
      await api(token!).del('/accounts/' + id);
      toast.success('已解除绑定');
      loadAccounts();
    } catch (e: any) {
      toast.error(e.message || '解除绑定失败');
    }
  };

  const twitterAccounts = accounts.filter(a => a.platform === 'twitter');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">👤 账号管理</h2>
      </div>

      {/* Twitter Account Card */}
      <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden mb-6">
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🐦</span>
            </div>
            <div>
              <h3 className="font-semibold text-lg">Twitter/X</h3>
              <p className="text-sm text-gray-400">通过 OAuth 1.0a PIN 模式绑定账号</p>
            </div>
          </div>

          {/* Bound accounts */}
          {twitterAccounts.length > 0 && (
            <div className="mb-4 space-y-2">
              {twitterAccounts.map(acc => (
                <div key={acc.id} className="flex items-center gap-3 bg-dark-bg rounded-lg p-3 border border-dark-border">
                  <CheckCircle2 size={18} className="text-green-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{acc.screenName ? `@${acc.screenName}` : acc.name}</p>
                    <p className="text-xs text-gray-500">已绑定 • {new Date(acc.createdAt).toLocaleDateString('zh-CN')}</p>
                  </div>
                  <button
                    onClick={() => handleUnbind(acc.id)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => { setShowTwitterModal(true); setBindingStep('idle'); setPinCode(''); setAuthUrl(''); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-500 rounded-lg font-medium hover:bg-blue-600 transition-colors"
          >
            <ExternalLink size={16} />
            {twitterAccounts.length > 0 ? '绑定另一个账号' : '绑定 Twitter 账号'}
          </button>
        </div>
      </div>

      {/* Other platforms placeholder */}
      <h3 className="font-semibold mb-3">其他平台（即将支持）</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.entries(PLATFORM_NAMES).filter(([k]) => k !== 'twitter').map(([type, name]) => (
          <div key={type} className="bg-dark-card rounded-lg p-3 border border-dark-border flex items-center gap-2 opacity-50">
            <span className="text-lg">{PLATFORM_ICONS[type] || '🔗'}</span>
            <span className="text-sm">{name}</span>
          </div>
        ))}
      </div>

      {/* Twitter Binding Modal */}
      {showTwitterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-card rounded-xl border border-dark-border w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-dark-border">
              <h3 className="font-semibold">🐦 绑定 Twitter 账号</h3>
              <button onClick={() => setShowTwitterModal(false)} className="p-1 text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {bindingStep === 'idle' && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-400 mb-4">
                    点击下方按钮，获取 Twitter 授权链接
                  </p>
                  <button
                    onClick={handleStartTwitterAuth}
                    className="px-5 py-2.5 bg-blue-500 rounded-lg font-medium hover:bg-blue-600 transition-colors"
                  >
                    获取授权链接
                  </button>
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
                    <a
                      href={authUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:underline"
                    >
                      <ExternalLink size={14} />
                      点击此处打开授权页（已在新标签页打开）
                    </a>
                  </div>

                  <div className="bg-dark-bg rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium">第 2 步：输入 PIN 码</p>
                    <p className="text-xs text-gray-500">授权完成后，Twitter 会给你一个 7 位数的 PIN 码，复制粘贴到下面：</p>
                    <input
                      type="text"
                      placeholder="输入 PIN 码（如 1234567）"
                      value={pinCode}
                      onChange={e => setPinCode(e.target.value)}
                      className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-white text-center text-lg tracking-widest"
                      autoFocus
                    />
                  </div>

                  <button
                    onClick={handleSubmitPin}
                    disabled={!pinCode.trim()}
                    className="w-full py-2.5 bg-blue-500 rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    确认绑定
                  </button>
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

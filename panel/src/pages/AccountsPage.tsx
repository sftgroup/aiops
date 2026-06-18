import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../AuthContext';
import toast from 'react-hot-toast';
import { Plus, Trash2, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';

interface Platform {
  type: string;
  name: string;
}

interface Account {
  platform: string;
  id?: string;
  name?: string;
  username?: string;
  avatar?: string;
  status?: string;
}

const PLATFORM_ICONS: Record<string, string> = {
  twitter: '🐦', youtube: '▶️', tiktok: '🎵', meta: '📱',
  bilibili: '📺', douyin: '🎬', kwai: '🎥', pinterest: '📌',
  threads: '🧵', 'wx-gzh': '💬',
};

export default function AccountsPage() {
  const { token } = useAuth();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState<string | null>(null);

  const loadAll = async () => {
    if (!token) return;
    try {
      const [p, a] = await Promise.all([
        api(token).get('/aiops/platforms'),
        api(token).get('/aiops/accounts'),
      ]);
      setPlatforms(p);
      setAccounts(a);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, [token]);

  const handleAddAccount = async (platform: string) => {
    setAuthLoading(platform);
    try {
      const resp = await api(token!).post(`/aiops/platforms/${platform}/auth-url`, {
        callbackUrl: window.location.origin + '/api/aiops/oauth/callback',
      });
      const authUrl = resp?.data?.url;
      if (!authUrl) {
        toast.error('获取授权链接失败');
        setAuthLoading(null);
        return;
      }

      // Open OAuth popup
      const w = window.open(authUrl, `auth-${platform}`, 'width=600,height=700');
      if (!w) {
        toast.error('弹窗被浏览器拦截，请允许弹窗');
        setAuthLoading(null);
        return;
      }

      // Poll for completion (popup closes after auth)
      const pollTimer = setInterval(() => {
        if (w.closed) {
          clearInterval(pollTimer);
          toast.success(`账号授权完成`);
          loadAll();
          setAuthLoading(null);
        }
      }, 500);
    } catch (e: any) {
      toast.error(e.message || '授权失败');
      setAuthLoading(null);
    }
  };

  const getPlatformAccounts = (platform: string) =>
    accounts.filter(a => a.platform === platform);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">👤 账号管理</h2>
      </div>

      {loading ? (
        <div className="text-gray-500">加载中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {platforms.map(p => (
            <div key={p.type} className="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
              <div className="p-4 border-b border-dark-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{PLATFORM_ICONS[p.type] || '🔗'}</span>
                  <span className="font-medium">{p.name}</span>
                </div>
                <button
                  onClick={() => handleAddAccount(p.type)}
                  disabled={authLoading === p.type}
                  className="flex items-center gap-1 px-3 py-1.5 bg-accent-primary/20 text-accent-primary rounded-lg text-sm hover:bg-accent-primary/30 transition-colors disabled:opacity-50"
                >
                  {authLoading === p.type ? (
                    '授权中...'
                  ) : (
                    <><Plus size={14} /> 添加</>
                  )}
                </button>
              </div>
              <div className="p-3">
                {getPlatformAccounts(p.type).length > 0 ? (
                  <div className="space-y-2">
                    {getPlatformAccounts(p.type).map((acct, i) => (
                      <div key={i} className="flex items-center gap-3 bg-dark-bg rounded-lg p-2">
                        {acct.avatar && (
                          <img src={acct.avatar} className="w-8 h-8 rounded-full" alt="" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{acct.name || acct.username || '未命名'}</p>
                          <p className="text-xs text-gray-500 truncate">@{acct.username || acct.id}</p>
                        </div>
                        {(acct.status === 'active' || !acct.status) ? (
                          <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                        ) : (
                          <XCircle size={14} className="text-red-400 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-3">暂未绑定</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info card */}
      <div className="mt-6 bg-dark-card rounded-xl p-4 border border-dark-border">
        <p className="text-sm text-gray-400">
          <strong className="text-white">授权流程说明：</strong>点「添加」弹出新窗口，在对应平台登录并授权，
          完成后窗口自动关闭，账号即出现在列表中。
        </p>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../AuthContext';
import { ExternalLink, CheckCircle2, Globe } from 'lucide-react';

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
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [accountUiUrl, setAccountUiUrl] = useState('');

  const load = async () => {
    if (!token) return;
    try {
      const [pResp, uiResp] = await Promise.all([
        api(token).get('/aiops/platforms'),
        api(token).get('/aiops/account-ui'),
      ]);
      setAccountUiUrl(uiResp?.url || 'http://43.156.78.59:8090');
      if (Array.isArray(pResp)) {
        setPlatforms(pResp.map((p: any) => p.type || p.id || p.platform).filter(Boolean));
      }
    } catch {}
  };

  useEffect(() => { load(); }, [token]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">👤 账号管理</h2>
      </div>

      {/* Main card - direct to AiToEarn Web UI */}
      <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden mb-6">
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-accent-primary/20 rounded-xl flex items-center justify-center">
              <Globe size={24} className="text-accent-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">AiToEarn 账号管理</h3>
              <p className="text-sm text-gray-400">在 AiToEarn Web 界面绑定各平台账号</p>
            </div>
          </div>

          <p className="text-sm text-gray-400 mb-4 bg-dark-bg rounded-lg p-3">
            AiToEarn 的 Web 管理界面提供完整的账号绑定、授权管理和发布功能。
            请在新窗口登录后，在「账号管理」中绑定你的各平台账号。
          </p>

          <a
            href={accountUiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-primary rounded-lg font-medium hover:bg-accent-primary/80 transition-colors"
          >
            <ExternalLink size={16} />
            打开 AiToEarn 管理界面
          </a>
        </div>
      </div>

      {/* Platform cards */}
      <h3 className="font-semibold mb-3">支持平台</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.entries(PLATFORM_NAMES).map(([type, name]) => (
          <div key={type} className="bg-dark-card rounded-lg p-3 border border-dark-border flex items-center gap-2">
            <span className="text-lg">{PLATFORM_ICONS[type] || '🔗'}</span>
            <span className="text-sm">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../AuthContext';
import toast from 'react-hot-toast';
import { Send, Loader2 } from 'lucide-react';
import type { Account, PublishResult } from '../types';

interface Props {
  /** 要发布的文字内容 */
  text: string;
  /** 要发布的媒体 URL（可选） */
  mediaUrl?: string;
  /** 完成后回调 */
  onPublished?: () => void;
}

export default function PublishSection({ text, mediaUrl, onPublished }: Props) {
  const { token } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!token) return;
    api(token).get('/accounts').then(a => setAccounts(a)).catch(() => {});
  }, [token]);

  const toggleAccount = (id: string) => {
    setSelectedAccounts(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const handlePublish = async () => {
    if (!text) return toast.error('没有内容可发布');
    if (selectedAccounts.length === 0) return toast.error('请选择至少一个发布账号');
    setPublishing(true);
    try {
      const results = await api(token!).post('/publish', {
        text,
        accountIds: selectedAccounts,
      });
      const ok = results.filter((r: PublishResult) => r.status === 'published').length;
      const fail = results.filter((r: PublishResult) => r.status === 'failed').length;
      if (ok > 0) toast.success(`✅ 发布成功: ${ok} 个账号`);
      if (fail > 0) toast.error(`❌ ${fail} 个账号发布失败`);
      onPublished?.();
    } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || '发布失败');
    } finally {
      setPublishing(false);
    }
  };

  const PLATFORM_ICONS: Record<string, string> = {
    twitter: '🐦', youtube: '▶️', tiktok: '🎵', meta: '📱',
    bilibili: '📺', douyin: '🎬',
  };

  // Group by platform
  const groups = accounts.reduce<Record<string, Account[]>>((g, a) => {
    (g[a.platform] = g[a.platform] || []).push(a);
    return g;
  }, {});

  return (
    <div className="border-t border-dark-border pt-4 space-y-3" role="region" aria-label="发布到社交媒体">
      <h4 className="text-sm font-medium flex items-center gap-1">
        <Send size={14} aria-hidden="true" /> 发布到社交媒体
      </h4>

      {/* Account Picker */}
      {Object.keys(groups).length === 0 ? (
        <p className="text-xs text-gray-500">暂无绑定账号，去「账号管理」绑定</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(groups).flatMap(([platform, accs]) =>
            accs.map(acc => (
              <button
                key={acc.id}
                onClick={() => toggleAccount(acc.id)}
                className={`inline-flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs border transition-colors ${
                  selectedAccounts.includes(acc.id)
                    ? 'bg-accent-primary/20 border-accent-primary text-accent-primary'
                    : 'bg-dark-bg border-dark-border text-gray-400 hover:border-gray-500'
                }`}
                style={{ minHeight: 44 }}
              >
                {PLATFORM_ICONS[acc.platform] || '🔗'}
                @{acc.screenName || acc.name}
              </button>
            ))
          )}
        </div>
      )}

      {/* Publish Button */}
      <button
        onClick={handlePublish}
        disabled={publishing || selectedAccounts.length === 0}
        className="flex items-center gap-1.5 px-5 py-3 bg-accent-primary/60 hover:bg-accent-primary rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
        style={{ minHeight: 44 }}
        aria-label={publishing ? '正在发布...' : `发布到 ${selectedAccounts.length} 个账号`}
      >
        {publishing ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
        {publishing ? '发布中...' : `发布到 ${selectedAccounts.length} 个账号`}
      </button>
    </div>
  );
}

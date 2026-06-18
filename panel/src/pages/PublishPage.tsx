import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../AuthContext';
import toast from 'react-hot-toast';
import { Send, CheckCircle2, Globe, X, Loader2, Users, ExternalLink, FileText } from 'lucide-react';

export default function PublishPage() {
  const { token } = useAuth();
  const [contents, setContents] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [publishes, setPublishes] = useState<any[]>([]);
  const [selectedContent, setSelectedContent] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [customText, setCustomText] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!token) return;
    try {
      const [c, a, p] = await Promise.all([
        api(token).get('/contents'),
        api(token).get('/accounts'),
        api(token).get('/publishes/direct'),
      ]);
      setContents(c);
      setAccounts(a);
      setPublishes(p);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [token]);

  const toggleAccount = (id: string) => {
    setSelectedAccounts(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const selectedContentObj = contents.find(c => c.id === selectedContent);

  const handlePublish = async () => {
    if (!selectedContent && !customText.trim()) return toast.error('请选择内容或输入发布文案');
    if (selectedAccounts.length === 0) return toast.error('请选择至少一个发布账号');
    setPublishing(true);
    try {
      const results = await api(token!).post('/publish/direct', {
        contentId: selectedContent || undefined,
        accountIds: selectedAccounts,
        text: customText.trim() || undefined,
      });
      const ok = results.filter((r: any) => r.status === 'published').length;
      const fail = results.filter((r: any) => r.status === 'failed').length;
      toast.success(`发布完成: ${ok} 成功${fail ? `, ${fail} 失败` : ''}`);
      load();
      setSelectedContent('');
      setSelectedAccounts([]);
      setCustomText('');
    } catch (e: any) { toast.error(e.message || '发布失败'); }
    finally { setPublishing(false); }
  };

  // Group accounts by platform
  const platformGroups = accounts.reduce((groups: any, acc: any) => {
    if (!groups[acc.platform]) groups[acc.platform] = [];
    groups[acc.platform].push(acc);
    return groups;
  }, {} as Record<string, any[]>);

  const PLATFORM_ICONS: Record<string, string> = {
    twitter: '🐦', youtube: '▶️', tiktok: '🎵', meta: '📱',
    bilibili: '📺', douyin: '🎬', kwai: '🎥', pinterest: '📌',
    threads: '🧵',
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">📤 发布管理</h2>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        {/* Left: Publish Form */}
        <div className="xl:col-span-2 bg-dark-card rounded-xl p-5 border border-dark-border space-y-4">
          <h3 className="font-semibold">新建发布</h3>

          {/* Content selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">选择已有内容（可选）</label>
            <select
              className="w-full px-3 py-2.5 bg-dark-bg border border-dark-border rounded-lg text-white"
              value={selectedContent}
              onChange={e => { setSelectedContent(e.target.value); setCustomText(''); }}
            >
              <option value="">-- 不使用已有内容，手动输入 --</option>
              {contents.filter(c => c.status !== 'published').map(c => (
                <option key={c.id} value={c.id}>
                  {(c.subject || c.title || '无标题').slice(0, 40)} ({c.type === 'video' ? '🎬' : '📝'})
                </option>
              ))}
            </select>
          </div>

          {/* Custom text */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              {selectedContentObj ? '覆盖发布内容（可选，留空使用原内容）' : '发布文案'}
            </label>
            <textarea
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white h-28 resize-none"
              placeholder={selectedContentObj ? '留空即使用选中内容，也可在此覆盖...' : '输入要发布的文案...'}
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              maxLength={280}
            />
            <p className="text-xs text-gray-500 text-right mt-1">{customText.length}/280</p>
          </div>

          {/* Account selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">选择发布账号</label>
            {Object.keys(platformGroups).length === 0 ? (
              <div className="text-sm text-gray-500 py-2">
                还没有绑定任何账号，请先去「账号管理」绑定
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(platformGroups).map(([platform, accs]) => (
                  <div key={platform} className="bg-dark-bg rounded-lg p-3 border border-dark-border">
                    <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                      {PLATFORM_ICONS[platform] || '🔗'} {platform}
                      <span className="text-gray-600">({accs.length}个)</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(accs as any[]).map(acc => (
                        <button
                          key={acc.id}
                          onClick={() => toggleAccount(acc.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                            selectedAccounts.includes(acc.id)
                              ? 'bg-accent-primary/20 border-accent-primary text-accent-primary'
                              : 'bg-dark-card border-dark-border text-gray-400 hover:border-gray-500'
                          }`}
                        >
                          {selectedAccounts.includes(acc.id) ? '✓' : ''}
                          @{acc.screenName || acc.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handlePublish}
            disabled={publishing || (!selectedContent && !customText.trim()) || selectedAccounts.length === 0}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-accent-primary rounded-lg font-medium hover:bg-accent-primary/80 transition-colors disabled:opacity-50"
          >
            {publishing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            {publishing
              ? '发布中...'
              : `发布到 ${selectedAccounts.length} 个账号`}
          </button>
        </div>

        {/* Right: Info panel */}
        <div className="bg-dark-card rounded-xl p-5 border border-dark-border space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><Users size={16} /> 账号概览</h3>
          {Object.keys(platformGroups).length === 0 ? (
            <p className="text-sm text-gray-500">暂无绑定账号</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(platformGroups).map(([platform, accs]) => (
                <div key={platform} className="flex items-center justify-between text-sm">
                  <span>{PLATFORM_ICONS[platform] || '🔗'} {platform}</span>
                  <span className="text-gray-400">{accs.length} 个</span>
                </div>
              ))}
              <div className="pt-2 border-t border-dark-border">
                <a href="#/accounts" className="text-accent-primary text-sm hover:underline inline-flex items-center gap-1">
                  <ExternalLink size={12} /> 管理账号
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Publish History */}
      <h3 className="font-semibold mb-3">发布记录</h3>
      {loading ? (
        <div className="text-gray-500">加载中...</div>
      ) : publishes.length === 0 ? (
        <div className="bg-dark-card rounded-xl p-8 border border-dark-border text-center text-gray-500">暂无发布记录</div>
      ) : (
        <div className="space-y-2">
          {publishes.slice(0, 20).map(p => (
            <div key={p.id} className="bg-dark-card rounded-lg p-3 border border-dark-border flex items-start gap-3">
              {p.status === 'published' ? (
                <CheckCircle2 size={18} className="text-green-400 shrink-0 mt-0.5" />
              ) : (
                <X size={18} className="text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  🐦 @{p.screenName}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{p.text || '(无文本)'}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(p.createdAt).toLocaleString('zh-CN')}
                  {p.result?.data?.id ? ` · tweet ID: ${p.result.data.id}` : ''}
                  {p.result?.error ? ` · ❌ ${p.result.error}` : ''}
                </p>
              </div>
            </div>
          ))}
          {publishes.length > 20 && (
            <p className="text-center text-xs text-gray-500">...还有 {publishes.length - 20} 条</p>
          )}
        </div>
      )}
    </div>
  );
}

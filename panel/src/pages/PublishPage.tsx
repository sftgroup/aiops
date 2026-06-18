import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../AuthContext';
import toast from 'react-hot-toast';
import { Send, CheckCircle2, Globe, ExternalLink } from 'lucide-react';

const PLATFORMS = [
  { id: 'twitter', label: 'Twitter/X', icon: '🐦' },
  { id: 'youtube', label: 'YouTube', icon: '▶️' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
  { id: 'meta', label: 'Instagram/Facebook', icon: '📱' },
  { id: 'bilibili', label: 'B站', icon: '📺' },
  { id: 'douyin', label: '抖音', icon: '🎬' },
];

export default function PublishPage() {
  const { token } = useAuth();
  const [contents, setContents] = useState<any[]>([]);
  const [publishes, setPublishes] = useState<any[]>([]);
  const [selectedContent, setSelectedContent] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!token) return;
    try {
      const [c, p] = await Promise.all([
        api(token).get('/contents'),
        api(token).get('/aiops/publishes'),
      ]);
      setContents(c);
      setPublishes(p);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [token]);

  const togglePlatform = (id: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handlePublish = async () => {
    if (!selectedContent) return toast.error('请选择内容');
    if (selectedPlatforms.length === 0) return toast.error('请选择至少一个平台');
    setPublishing(true);
    try {
      const result = await api(token!).post('/aiops/publish', {
        contentId: selectedContent,
        platforms: selectedPlatforms,
      });
      toast.success('发布任务已提交到 AiToEarn');
      load();
      setSelectedContent('');
      setSelectedPlatforms([]);
    } catch (e: any) { toast.error(e.message || '发布失败'); }
    finally { setPublishing(false); }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">📤 发布管理</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-dark-card rounded-xl p-5 border border-dark-border space-y-4">
          <h3 className="font-semibold">新建发布</h3>

          <div>
            <label className="block text-sm text-gray-400 mb-1">选择内容</label>
            <select
              className="w-full px-3 py-2.5 bg-dark-bg border border-dark-border rounded-lg text-white"
              value={selectedContent}
              onChange={e => setSelectedContent(e.target.value)}
            >
              <option value="">-- 请选择 --</option>
              {contents.filter(c => c.status !== 'published').map(c => (
                <option key={c.id} value={c.id}>
                  {c.subject || c.title || '无标题'} ({c.type === 'video' ? '🎬' : '📝'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">选择平台</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    selectedPlatforms.includes(p.id)
                      ? 'bg-accent-primary/20 border-accent-primary text-accent-primary'
                      : 'bg-dark-bg border-dark-border text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-500">
            ⚠️ 发布前请先在「账号管理」中绑定目标平台账号
          </p>

          <button
            onClick={handlePublish}
            disabled={publishing || selectedPlatforms.length === 0}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-accent-primary rounded-lg font-medium hover:bg-accent-primary/80 transition-colors disabled:opacity-50"
          >
            <Send size={16} />
            {publishing ? '提交到 AiToEarn...' : `提交发布到 ${selectedPlatforms.length} 个平台`}
          </button>
        </div>

        <div className="bg-dark-card rounded-xl p-5 border border-dark-border">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Globe size={16} /> 发布方式</h3>
          <p className="text-sm text-gray-400 mb-3">
            内容通过 <strong className="text-white">AiToEarn</strong> 的 MCP API 分发到各平台。
          </p>
          <div className="text-xs text-gray-500 space-y-2">
            <p>🔹 发布任务提交到 AiToEarn 后会在后台异步推送</p>
            <p>🔹 支持：定时发布、内容管理、互动分析</p>
            <p>🔹 AiToEarn 管理界面：
              <a href="http://43.156.78.59:8090" target="_blank" className="text-accent-primary hover:underline ml-1 inline-flex items-center gap-1">
                <ExternalLink size={12} /> 43.156.78.59:8090
              </a>
            </p>
          </div>
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
          {publishes.map(p => (
            <div key={p.id} className="bg-dark-card rounded-lg p-3 border border-dark-border flex items-center gap-3">
              <CheckCircle2 size={18} className="text-green-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  发布到 {p.platforms?.join(', ') || '未知'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(p.createdAt).toLocaleString('zh-CN')}
                  {p.mcpResult?.result && ' ✓ (已提交)'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

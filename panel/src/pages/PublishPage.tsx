import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../AuthContext';
import toast from 'react-hot-toast';
import { Send, CheckCircle2, Clock, Globe } from 'lucide-react';

const PLATFORMS = [
  { id: 'twitter', label: 'Twitter/X' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
];

export default function PublishPage() {
  const { token } = useAuth();
  const [contents, setContents] = useState<any[]>([]);
  const [publishes, setPublishes] = useState<any[]>([]);
  const [selectedContent, setSelectedContent] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);

  const load = async () => {
    if (!token) return;
    try {
      setContents(await api(token).get('/contents'));
      setPublishes(await api(token).get('/publishes'));
    } catch {}
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
      await api(token!).post('/publish', { contentId: selectedContent, platforms: selectedPlatforms });
      toast.success('发布成功');
      load();
      setSelectedContent('');
      setSelectedPlatforms([]);
    } catch (e: any) { toast.error(e.message); }
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
              className="w-full px-3 py-2.5 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none"
              value={selectedContent}
              onChange={e => setSelectedContent(e.target.value)}
            >
              <option value="">-- 请选择 --</option>
              {contents.filter(c => c.status !== 'published').map(c => (
                <option key={c.id} value={c.id}>
                  {c.subject || c.title || '无标题'} ({c.type === 'video' ? '视频' : '文案'})
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
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-accent-primary rounded-lg font-medium hover:bg-accent-primary/80 transition-colors disabled:opacity-50"
          >
            <Send size={16} />
            {publishing ? '发布中...' : `发布到 ${selectedPlatforms.length} 个平台`}
          </button>
        </div>

        {/* AI To Earn info */}
        <div className="bg-dark-card rounded-xl p-5 border border-dark-border">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Globe size={16} /> AiToEarn 集成</h3>
          <p className="text-sm text-gray-400 mb-3">
            通过 AiToEarn MCP 协议自动分发到各平台。
            需在服务器配置 `AITO_EARN_KEY` 环境变量。
          </p>
          <div className="text-xs text-gray-500 space-y-1">
            <p>🔹 支持平台：Twitter/X、YouTube、TikTok、Instagram、Facebook、LinkedIn 等</p>
            <p>🔹 未配置 AiToEarn Key 时为模拟发布</p>
          </div>
        </div>
      </div>

      {/* Publish History */}
      <h3 className="font-semibold mb-3">发布记录</h3>
      {publishes.length === 0 ? (
        <div className="bg-dark-card rounded-xl p-8 border border-dark-border text-center text-gray-500">暂无发布记录</div>
      ) : (
        <div className="space-y-2">
          {publishes.map(p => (
            <div key={p.id} className="bg-dark-card rounded-lg p-3 border border-dark-border flex items-center gap-3">
              {p.status === 'published' ? <CheckCircle2 size={18} className="text-green-400" /> : <Clock size={18} className="text-yellow-400" />}
              <div className="flex-1">
                <p className="text-sm font-medium">
                  发布到 {p.platforms?.join(', ')}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(p.createdAt).toLocaleString('zh-CN')} · {p.status === 'published' ? '已发布' : '模拟'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

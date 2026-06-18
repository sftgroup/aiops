import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../AuthContext';
import toast from 'react-hot-toast';
import { FileText, Video, Trash2, Send, Loader2 } from 'lucide-react';

export default function ContentPage() {
  const { token } = useAuth();
  const [contents, setContents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);

  const load = async () => {
    if (!token) return;
    try { setContents(await api(token).get('/contents')); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [token]);

  const handleSaveText = async () => {
    if (!textContent) return toast.error('请输入内容');
    setSaving(true);
    try {
      await api(token!).post('/contents/text', { title: textTitle, text: textContent });
      toast.success('保存成功');
      setTextTitle(''); setTextContent('');
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt) return toast.error('请输入提示词');
    setGeneratingAI(true);
    try {
      const d = await api(token!).post('/ai/generate', { prompt: aiPrompt, platform: 'twitter' });
      setTextContent(d.text);
      toast.success('AI 生成完成');
    } catch (e: any) { toast.error(e.message); }
    finally { setGeneratingAI(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await api(token!).del(`/contents/${id}`);
      toast.success('已删除');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">📝 内容管理</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Create Text */}
        <div className="bg-dark-card rounded-xl p-5 border border-dark-border space-y-3">
          <h3 className="font-semibold">新建文案</h3>
          <input
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none"
            placeholder="标题（可选）"
            value={textTitle}
            onChange={e => setTextTitle(e.target.value)}
          />
          <textarea
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none h-32 resize-none"
            placeholder="输入文案内容..."
            value={textContent}
            onChange={e => setTextContent(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={handleSaveText} disabled={saving} className="px-4 py-2 bg-accent-primary rounded-lg text-sm font-medium hover:bg-accent-primary/80 transition-colors disabled:opacity-50">
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        {/* AI Generate */}
        <div className="bg-dark-card rounded-xl p-5 border border-dark-border space-y-3">
          <h3 className="font-semibold">AI 生成文案</h3>
          <textarea
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none h-20 resize-none"
            placeholder="描述你想要的内容，例如：写一条关于AI创业的Twitter帖子"
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
          />
          <button onClick={handleAIGenerate} disabled={generatingAI} className="px-4 py-2 bg-accent-primary/50 rounded-lg text-sm font-medium hover:bg-accent-primary/70 transition-colors disabled:opacity-50">
            {generatingAI ? <Loader2 size={16} className="animate-spin inline" /> : null} AI 生成
          </button>
        </div>
      </div>

      {/* Content List */}
      <h3 className="font-semibold mb-3">内容列表</h3>
      {loading ? (
        <div className="text-gray-500">加载中...</div>
      ) : contents.length === 0 ? (
        <div className="bg-dark-card rounded-xl p-8 border border-dark-border text-center text-gray-500">暂无内容</div>
      ) : (
        <div className="space-y-2">
          {contents.map(c => (
            <div key={c.id} className="bg-dark-card rounded-lg p-3 border border-dark-border flex items-start gap-3">
              {c.type === 'video' ? <Video size={20} className="text-accent-primary shrink-0 mt-0.5" /> : <FileText size={20} className="text-green-400 shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.subject || c.title || '无标题'}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {c.type === 'video' ? '视频' : '文案'} · {new Date(c.createdAt).toLocaleString('zh-CN')}
                  {c.urls?.length ? ` · ${c.urls.length}个文件` : ''}
                </p>
                {c.status && (
                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${
                    c.status === 'completed' ? 'bg-green-900/50 text-green-400' :
                    c.status === 'published' ? 'bg-blue-900/50 text-blue-400' :
                    c.status === 'processing' ? 'bg-yellow-900/50 text-yellow-400' :
                    'bg-gray-800 text-gray-400'
                  }`}>{c.status}</span>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleDelete(c.id)} className="p-1.5 text-gray-600 hover:text-red-400 transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

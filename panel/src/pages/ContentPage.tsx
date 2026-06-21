import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../AuthContext';
import toast from 'react-hot-toast';
import { FileText, Image, Trash2, Loader2, Sparkles, Download } from 'lucide-react';

export default function ContentPage() {
  const { token } = useAuth();
  const [contents, setContents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [generatedImage, setGeneratedImage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!token) return;
    try { setContents(await api(token).get('/contents')); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [token]);

  const handleGenerate = async () => {
    if (!aiPrompt) return toast.error('请输入提示词');
    setGenerating(true);
    setGeneratedText('');
    setGeneratedImage('');
    try {
      // Step 1: Generate text
      const textResult = await api(token!).post('/ai/generate', {
        prompt: aiPrompt,
        platform: 'twitter',
      });
      setGeneratedText(textResult.text);

      // Step 2: Generate matching image
      const imgResult = await api(token!).post('/ai/image', {
        subject: aiPrompt,
        style: 'general',
      });
      if (imgResult?.url) setGeneratedImage(imgResult.url);

      toast.success('文案+配图生成完成');
    } catch (e: any) {
      toast.error(e.message || '生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedText) return toast.error('没有内容可保存');
    setSaving(true);
    try {
      await api(token!).post('/contents/text', {
        title: aiPrompt,
        text: generatedText,
        imageUrl: generatedImage,
      });
      toast.success('保存成功');
      setAiPrompt('');
      setGeneratedText('');
      setGeneratedImage('');
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
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
      <h2 className="text-2xl font-bold mb-6">📝 文案生成</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Generate: Text + Image */}
        <div className="bg-dark-card rounded-xl p-5 border border-dark-border space-y-4">
          <h3 className="font-semibold">AI 生成文案 + 配图</h3>

          {/* Prompt Input */}
          <textarea
            className="w-full px-3 py-2.5 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none h-20 resize-none"
            placeholder="描述你想要的内容，例如：写一条关于AI创业的Twitter帖子"
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
          />

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !aiPrompt}
            className="flex items-center gap-2 px-4 py-2 bg-accent-primary rounded-lg text-sm font-medium hover:bg-accent-primary/80 transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {generating ? '生成中...' : 'AI 生成'}
          </button>

          {/* Loading */}
          {generating && (
            <div className="text-center py-6 text-gray-500 text-sm">
              <Loader2 size={24} className="animate-spin mx-auto mb-2" />
              <p>正在生成文案...</p>
              <p className="text-xs text-gray-600 mt-1">同时也在生成配图</p>
            </div>
          )}

          {/* Generated Result */}
          {generatedText && (
            <div className="space-y-4 pt-2 border-t border-dark-border">
              {/* Text */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">生成文案</label>
                <div className="bg-dark-bg rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {generatedText}
                </div>
              </div>

              {/* Image */}
              {generatedImage && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">配图</label>
                  <div className="bg-dark-bg rounded-lg overflow-hidden">
                    <img
                      src={generatedImage}
                      alt="配图"
                      className="w-full max-h-64 object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Save */}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-accent-primary rounded-lg text-sm font-medium hover:bg-accent-primary/80 transition-colors disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                {generatedImage && (
                  <a
                    href={generatedImage}
                    download
                    className="px-4 py-2 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-800 transition-colors flex items-center gap-1"
                  >
                    <Download size={14} /> 下载配图
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Content List */}
        <div className="bg-dark-card rounded-xl p-5 border border-dark-border space-y-3">
          <h3 className="font-semibold">历史记录</h3>

          {loading ? (
            <div className="text-gray-500 text-sm py-8 text-center">加载中...</div>
          ) : contents.length === 0 ? (
            <div className="text-gray-500 text-sm py-8 text-center">暂无生成记录</div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto">
              {contents.map(c => (
                <div key={c.id} className="bg-dark-bg rounded-lg p-3 flex items-start gap-3">
                  <FileText size={18} className="text-green-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.title || c.subject || '无标题'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {c.imageUrl ? '📷 含配图' : '📝 仅文案'}
                      {' · '}
                      {new Date(c.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(c.id)} className="p-1 text-gray-600 hover:text-red-400 transition-colors shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

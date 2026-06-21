import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../AuthContext';
import toast from 'react-hot-toast';
import { FileText, Image, Trash2, Loader2, Sparkles, Download } from 'lucide-react';
import PublishSection from '../components/PublishSection';

export default function ContentPage() {
  const { token } = useAuth();
  const [contents, setContents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [generatedImage, setGeneratedImage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [progressStep, setProgressStep] = useState('');
  const [progressBar, setProgressBar] = useState({ step: '', progress: 0, message: '' });
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
    setProgressStep('正在调用 DeepSeek 生成文案...');
    setProgressBar({ step: 'text', progress: 10, message: '调用 DeepSeek API...' });
    setGeneratedText('');
    setGeneratedImage('');
    try {
      // Step 1: Generate text via DeepSeek
      const textResult = await api(token!).post('/ai/generate', {
        prompt: aiPrompt,
        platform: 'twitter',
      });
      setGeneratedText(textResult.text);
      setProgressBar({ step: 'text', progress: 50, message: '文案生成完成' });

      // Step 2: Generate matching image (async with polling)
      setProgressStep('正在生成配图...');
      setProgressBar({ step: 'image-start', progress: 55, message: '提交配图任务...' });
      const taskResult = await api(token!).post('/ai/image', {
        subject: aiPrompt,
        style: 'general',
      });
      const taskId = taskResult.taskId;
      if (!taskId) throw new Error('配图任务创建失败');

      // Poll for progress
      setProgressStep('正在生成配图，等待 LibTV...');
      const poll = setInterval(async () => {
        try {
          const status = await api(token!).get('/ai/image/status/' + taskId);
          if (status.step === 'completed') {
            clearInterval(poll);
            if (status.url) setGeneratedImage(status.url);
            setProgressBar({ step: 'completed', progress: 100, message: '配图完成' });
            setProgressStep('');

            // Auto-save
            try {
              await api(token!).post('/contents/text', {
                title: aiPrompt,
                text: textResult.text,
                imageUrl: status.url || '',
              });
              toast.success('已自动保存');
              load();
            } catch {}
            setGenerating(false);
            return;
          }
          if (status.step === 'failed' || status.error) {
            clearInterval(poll);
            setProgressBar({ step: 'failed', progress: 0, message: status.error || '配图生成失败' });
            toast.error('配图生成失败，文案已显示');
            setGenerating(false);
            // Still auto-save text even if image failed
            try {
              await api(token!).post('/contents/text', {
                title: aiPrompt,
                text: textResult.text,
              });
              toast.success('文案已保存');
              load();
            } catch {}
            return;
          }
          // Update progress bar
          setProgressBar({ step: status.step, progress: status.progress || 0, message: status.message || '' });
          setProgressStep(status.step === 'polling'
            ? `配图生成中 (${status.iteration || '?'}/${status.total || 30})...`
            : status.message || '生成中...');
        } catch (e: any) {
          // Ignore poll errors
        }
      }, 2000);

      // Safety timeout
      setTimeout(() => {
        clearInterval(poll);
        setGenerating(false);
        setProgressStep('');
      }, 180000);

    } catch (e: any) {
      toast.error(e.message || '生成失败');
      setGenerating(false);
    }
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
            disabled={generating}
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

          {/* Progress Bar */}
          {generating && (
            <div className="space-y-2">
              <div className="w-full h-2 bg-dark-bg rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    progressBar.progress < 50 ? 'bg-blue-500' :
                    progressBar.progress < 90 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: progressBar.progress + '%' }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-gray-400">
                  <Loader2 size={10} className="animate-spin" />
                  {progressStep}
                </span>
                <span className="text-gray-600">{progressBar.progress}%</span>
              </div>
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
                  <a
                    href={generatedImage}
                    download
                    className="inline-flex items-center gap-1 mt-2 text-xs text-blue-400 hover:underline"
                  >
                    <Download size={12} /> 下载配图
                  </a>
                </div>
              )}

              {/* Publish */}
              {generatedText && <PublishSection text={generatedText} />}
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

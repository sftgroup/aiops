import React, { useState, useEffect, useRef } from 'react';
import { useAuth, api } from '../AuthContext';
import toast from 'react-hot-toast';
import { FileText, Trash2, Loader2, Sparkles, Download } from 'lucide-react';
import PublishSection from '../components/PublishSection';

const LS_KEY = 'aiops_image_task';

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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const autoSave = async (text: string, imgUrl: string, prompt: string) => {
    if (!token) return;
    try {
      const body: any = { title: prompt, text };
      if (imgUrl) body.imageUrl = imgUrl;
      await api(token).post('/contents/text', body);
      load();
    } catch {}
  };

  const startPolling = (taskId: string, text: string, prompt: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (!token) return;
      try {
        const status = await api(token).get('/ai/image/status/' + taskId);
        if (status.step === 'completed') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          if (status.url) setGeneratedImage(status.url);
          setProgressBar({ step: 'completed', progress: 100, message: '配图完成' });
          setProgressStep('');
          localStorage.removeItem(LS_KEY);
          // 配图完成了，更新保存的记录（带上图片）
          await autoSave(text, status.url || '', prompt);
          load();
          toast.success('已自动保存');
          setGenerating(false);
          return;
        }
        if (status.step === 'failed' || status.error) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setProgressBar({ step: 'failed', progress: 0, message: status.error || '配图生成失败' });
          toast('配图生成失败，文案已保存', { icon: '⚠️' });
          localStorage.removeItem(LS_KEY);
          setGenerating(false);
          load();
          return;
        }
        setProgressBar({ step: status.step, progress: status.progress || 0, message: status.message || '' });
        setProgressStep(status.step === 'polling'
          ? `配图生成中 (${status.iteration || '?'}/${status.total || 30})...`
          : status.message || '生成中...');
      } catch (e: any) {
        const errText = String(e.message || e);
        if (errText.includes('404') || errText.includes('不存在') || errText.includes('过期')) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          localStorage.removeItem(LS_KEY);
          setProgressBar({ step: 'completed', progress: 100, message: '配图任务已结束' });
          setProgressStep('');
          setGenerating(false);
        }
      }
    }, 2000);
  };

  // Restore pending task from localStorage on mount
  useEffect(() => {
    if (!token) return;
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      try {
        const task = JSON.parse(saved);
        if (Date.now() - task.startedAt > 300000) {
          localStorage.removeItem(LS_KEY);
          return;
        }
        // 至少有 prompt 就恢复
        if (task.prompt) setAiPrompt(task.prompt);
        if (task.text) setGeneratedText(task.text);

        if (task.step === 'image' && task.taskId) {
          // 配图轮询中 → 恢复轮询
          setGenerating(true);
          setProgressStep('恢复生成中...');
          startPolling(task.taskId, task.text, task.prompt);
        } else if (task.text) {
          // 文案已生成，配图未提交 → 重新提交配图任务
          setGenerating(true);
          setProgressStep('恢复生成：提交配图任务...');
          setProgressBar({ step: 'image-start', progress: 55, message: '重新连接 LibTV...' });
          setTimeout(() => {
            api(token).post('/ai/image', { subject: task.prompt, style: 'general' })
              .then((r: any) => {
                if (r.taskId) {
                  task.step = 'image';
                  task.taskId = r.taskId;
                  localStorage.setItem(LS_KEY, JSON.stringify(task));
                  startPolling(r.taskId, task.text, task.prompt);
                }
              }).catch(() => {
                setGenerating(false);
                localStorage.removeItem(LS_KEY);
              });
          }, 100);
        } else if (task.step === 'text') {
          // 只点了生成但还没等回来，重新触发完整流程
          setGenerating(true);
          setProgressStep('恢复生成中...');
          setProgressBar({ step: 'text', progress: 10, message: '重新生成...' });
          setTimeout(() => generateFlow(task.prompt, task), 100);
        }
      } catch {
        localStorage.removeItem(LS_KEY);
      }
    }
  }, [token]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const load = async () => {
    if (!token) return;
    try { setContents(await api(token).get('/contents')); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [token]);

  const handleGenerate = async () => {
    if (!aiPrompt) return toast.error('请输入提示词');
    const prompt = aiPrompt;

    // 立即写入 localStorage，不管 API 调不调得完
    const entry = { step: 'text', prompt, text: '', taskId: '', startedAt: Date.now() };
    localStorage.setItem(LS_KEY, JSON.stringify(entry));

    setGenerating(true);
    setProgressStep('正在调用 DeepSeek 生成文案...');
    setProgressBar({ step: 'text', progress: 10, message: '调用 DeepSeek API...' });
    setGeneratedText('');
    setGeneratedImage('');
    generateFlow(prompt, entry);
  };

  const generateFlow = async (prompt: string, entry: any) => {
    try {
      // Step 1: Generate text via DeepSeek
      const textResult = await api(token!).post('/ai/generate', { prompt, platform: 'twitter' });
      setGeneratedText(textResult.text);
      setProgressBar({ step: 'text', progress: 50, message: '文案生成完成' });

      // 文案一拿到就自动保存，不等配图
      await autoSave(textResult.text, '', prompt);
      toast.success('文案已保存');

      // 更新 localStorage（文案已保存）
      entry.text = textResult.text;
      entry.step = 'text-saved';
      localStorage.setItem(LS_KEY, JSON.stringify(entry));

      // Step 2: Submit image generation task
      setProgressStep('提交配图任务...');
      setProgressBar({ step: 'image-start', progress: 55, message: '正在连接 LibTV...' });
      const taskResult = await api(token!).post('/ai/image', { subject: prompt, style: 'general' });
      const taskId = taskResult.taskId;
      if (!taskId) throw new Error('配图任务创建失败');

      // 更新 localStorage（含 taskId，切回来可轮询）
      entry.step = 'image';
      entry.taskId = taskId;
      localStorage.setItem(LS_KEY, JSON.stringify(entry));

      // Start polling
      startPolling(taskId, textResult.text, prompt);
    } catch (e: any) {
      toast.error(e.message || '生成失败');
      localStorage.removeItem(LS_KEY);
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
        {/* Left: Generate */}
        <div className="bg-dark-card rounded-xl p-5 border border-dark-border space-y-4">
          <h3 className="font-semibold">AI 生成文案 + 配图</h3>

          <textarea
            className="w-full px-3 py-2.5 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none h-20 resize-none"
            placeholder="描述你想要的内容，例如：写一条关于AI创业的Twitter帖子"
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            disabled={generating}
          />

          <button
            onClick={handleGenerate}
            disabled={generating || !aiPrompt}
            className="flex items-center gap-2 px-4 py-2 bg-accent-primary rounded-lg text-sm font-medium hover:bg-accent-primary/80 transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {generating ? '生成中...' : 'AI 生成'}
          </button>

          {/* Progress */}
          {generating && (
            <div className="space-y-2">
              <div className="w-full h-2 bg-dark-bg rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
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
          {(generatedText || generating) && (
            <div className={`space-y-4 pt-2 border-t border-dark-border ${!generatedText ? 'opacity-50' : ''}`}>
              {generatedText && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">生成文案</label>
                  <div className="bg-dark-bg rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap">
                    {generatedText}
                  </div>
                </div>
              )}

              {generatedImage && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">配图</label>
                  <div className="bg-dark-bg rounded-lg overflow-hidden">
                    <img src={generatedImage} alt="配图" className="w-full max-h-64 object-contain" />
                  </div>
                  <a href={generatedImage} download className="inline-flex items-center gap-1 mt-2 text-xs text-blue-400 hover:underline">
                    <Download size={12} /> 下载配图
                  </a>
                </div>
              )}

              {generatedText && <PublishSection text={generatedText} />}
            </div>
          )}
        </div>

        {/* Right: History */}
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

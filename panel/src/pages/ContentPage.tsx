import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, api } from '../AuthContext';
import toast from 'react-hot-toast';
import { FileText, Trash2, Loader2, Sparkles, Download, Eye } from 'lucide-react';
import PostPreviewModal from '../components/PostPreviewModal';

const LS_KEY = '***';
const DRAFT_KEY = '***';

/** WebSocket 连接地址（自动拼接） */
function wsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

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
  const [showPreview, setShowPreview] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingTaskId = useRef<string | null>(null);

  // ─── WebSocket 连接 ───────────────────────────────
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      try {
        ws = new WebSocket(wsUrl());
        wsRef.current = ws;

        ws.onopen = () => {
          // 如果有进行中的任务，重新订阅
          if (pendingTaskId.current) {
            ws!.send(JSON.stringify({ type: 'subscribe', taskId: pendingTaskId.current }));
          }
        };

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'task' && msg.taskId === pendingTaskId.current) {
              handleWsMessage(msg);
            }
          } catch {}
        };

        ws.onclose = () => {
          wsRef.current = null;
          // 3 秒后重连
          reconnectTimer = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {}
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  // 如果有 pending taskId，重连后自动订阅
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && pendingTaskId.current) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', taskId: pendingTaskId.current }));
    }
  }, [wsRef.current?.readyState]);

  // ─── WebSocket 消息处理 ───────────────────────────
  const handleWsMessage = useCallback((msg: any) => {
    const { step, progress, message, iteration, total, url, error } = msg;

    if (step === 'completed') {
      pendingTaskId.current = null;
      const imgUrl = url ? '/api/file/' + (url.replace('/api/file/', '') || '') : '';
      if (imgUrl) setGeneratedImage(imgUrl);
      setProgressBar({ step: 'completed', progress: 100, message: '配图完成' });
      setProgressStep('');
      localStorage.removeItem(LS_KEY);

      // 更新保存的记录
      if (generatedTextRef.current && aiPromptRef.current) {
        autoSaveRef.current(generatedTextRef.current, imgUrl, aiPromptRef.current);
        saveDraftRef.current(aiPromptRef.current, generatedTextRef.current, imgUrl);
      }
      loadRef.current();
      toast.success('已自动保存');
      setGenerating(false);
      return;
    }

    if (step === 'failed' || error) {
      pendingTaskId.current = null;
      setProgressBar({ step: 'failed', progress: 0, message: error || '配图生成失败' });
      toast('配图生成失败，文案已保存', { icon: '⚠️' });
      localStorage.removeItem(LS_KEY);
      if (generatedTextRef.current && aiPromptRef.current) {
        autoSaveRef.current(generatedTextRef.current, '', aiPromptRef.current);
        saveDraftRef.current(aiPromptRef.current, generatedTextRef.current, '');
      }
      setGenerating(false);
      loadRef.current();
      return;
    }

    // 进度更新（使用 libtv 实时进度）
    const realProgress = msg.libtvProgress != null && msg.libtvProgress > 0
      ? 20 + Math.round((msg.libtvProgress / 100) * 75)
      : (progress || 0);
    setProgressBar({ step: progress || step, progress: realProgress, message: message || '' });
    setProgressStep(
      step === 'polling' && msg.libtvProgress != null
        ? `配图生成中 ${msg.libtvProgress}%`
        : step === 'polling'
          ? `配图生成中 (${iteration || '?'}/${total || 200})...`
          : message || '生成中...'
    );
  }, []);

  // ─── 草稿持久化 ─────────────────────────────
  const saveDraft = useCallback((prompt: string, text: string, imageUrl: string) => {
    try {
      const draft = { prompt, text, imageUrl, savedAt: Date.now() };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
  }, []);

  const autoSave = useCallback(async (text: string, imgUrl: string, prompt: string) => {
    if (!token) return;
    try {
      const body: any = { title: prompt, text };
      if (imgUrl) body.imageUrl = imgUrl;
      await api(token).post('/contents/text', body);
      load();
    } catch (e) {
      console.error('[autoSave] Failed:', e);
    }
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    try { setContents(await api(token).get('/contents')); }
    catch {} finally { setLoading(false); }
  }, [token]);

  // ─── 用 ref 存最新值（避免 closure 过期） ────────
  const generatedTextRef = useRef(generatedText);
  const aiPromptRef = useRef(aiPrompt);
  const autoSaveRef = useRef(autoSave);
  const saveDraftRef = useRef(saveDraft);
  const loadRef = useRef(load);

  useEffect(() => { generatedTextRef.current = generatedText; }, [generatedText]);
  useEffect(() => { aiPromptRef.current = aiPrompt; }, [aiPrompt]);
  useEffect(() => { autoSaveRef.current = autoSave; }, [autoSave]);
  useEffect(() => { saveDraftRef.current = saveDraft; }, [saveDraft]);
  useEffect(() => { loadRef.current = load; }, [load]);

  // 切换页面/刷新时从 localStorage 恢复草稿
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (Date.now() - draft.savedAt > 7 * 24 * 3600 * 1000) {
          localStorage.removeItem(DRAFT_KEY);
          return;
        }
        if (draft.prompt) setAiPrompt(draft.prompt);
        if (draft.text) setGeneratedText(draft.text);
        if (draft.imageUrl) setGeneratedImage(draft.imageUrl);
      }
    } catch {}
  }, []);

  // 切页面时保存草稿
  useEffect(() => {
    if (generatedText) {
      saveDraft(aiPrompt, generatedText, generatedImage);
    }
  }, [generatedText, generatedImage, aiPrompt, saveDraft]);

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
        if (task.prompt) setAiPrompt(task.prompt);
        if (task.text) setGeneratedText(task.text);

        if (task.taskId && task.step === 'image') {
          pendingTaskId.current = task.taskId;
          // 重连后 ws.onopen 会自动订阅
          setGenerating(true);
          setProgressStep('恢复生成中...');
          setProgressBar({ step: 'polling', progress: 55, message: '等待 WebSocket 通知...' });

          // 也留一手 REST 降级
          restorePolling(task.taskId, task.text, task.prompt);
        } else if (task.text) {
          // 文案已有，配图未提交
          setGenerating(true);
          setProgressStep('恢复生成：提交配图任务...');
          setProgressBar({ step: 'image-start', progress: 55, message: '重新连接 LibTV...' });
          setTimeout(() => {
            api(token).post('/ai/image', { subject: task.prompt, style: 'general' })
              .then((r: any) => {
                if (r.taskId) {
                  pendingTaskId.current = r.taskId;
                  task.taskId = r.taskId;
                  task.step = 'image';
                  localStorage.setItem(LS_KEY, JSON.stringify(task));
                  restorePolling(r.taskId, task.text, task.prompt);
                }
              }).catch(() => {
                setGenerating(false);
                localStorage.removeItem(LS_KEY);
              });
          }, 100);
        } else if (task.step === 'text') {
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

  useEffect(() => { load(); }, [token, load]);

  const handleGenerate = async () => {
    if (!aiPrompt) return toast.error('请输入提示词');
    const prompt = aiPrompt;

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
      const textResult = await api(token!).post('/ai/generate', { prompt, platform: 'twitter' });
      setGeneratedText(textResult.text);
      setProgressBar({ step: 'text', progress: 50, message: '文案生成完成' });
      saveDraft(prompt, textResult.text, '');

      await autoSave(textResult.text, '', prompt);
      toast.success('文案已保存');

      entry.text = textResult.text;
      entry.step = 'text-saved';
      localStorage.setItem(LS_KEY, JSON.stringify(entry));

      setProgressStep('提交配图任务...');
      setProgressBar({ step: 'image-start', progress: 55, message: '正在连接 LibTV...' });
      const taskResult = await api(token!).post('/ai/image', { subject: prompt, style: 'general' });
      const taskId = taskResult.taskId;
      if (!taskId) throw new Error('配图任务创建失败');

      pendingTaskId.current = taskId;
      entry.step = 'image';
      entry.taskId = taskId;
      localStorage.setItem(LS_KEY, JSON.stringify(entry));

      // WebSocket 为主，同时启动 REST 降级轮询兜底
      setProgressStep('排队中...');
      setProgressBar({ step: 'queued', progress: 55, message: '已提交，等待队列处理...' });
      restorePolling(taskId, textResult.text, prompt);
    } catch (e: any) {
      toast.error(e.message || '生成失败');
      localStorage.removeItem(LS_KEY);
      setGenerating(false);
    }
  };

  // ─── REST 降级轮询（以防 WebSocket 断连） ─────────
  const restorePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const restorePolling = (taskId: string, text: string, prompt: string) => {
    if (restorePollingRef.current) clearInterval(restorePollingRef.current);
    restorePollingRef.current = setInterval(async () => {
      if (!token) return;
      try {
        const status = await api(token).get('/ai/image/status/' + taskId);
        if (status.step === 'completed') {
          clearInterval(restorePollingRef.current!);
          restorePollingRef.current = null;
          pendingTaskId.current = null;
          const url = '/api/file/' + (status.url?.replace('/api/file/', '') || '');
          if (url) setGeneratedImage(url);
          setProgressBar({ step: 'completed', progress: 100, message: '配图完成' });
          setProgressStep('');
          localStorage.removeItem(LS_KEY);
          await autoSave(text, url || '', prompt);
          saveDraft(prompt, text, url || '');
          load();
          toast.success('已自动保存');
          setGenerating(false);
          return;
        }
        if (status.step === 'failed' || status.error) {
          clearInterval(restorePollingRef.current!);
          restorePollingRef.current = null;
          pendingTaskId.current = null;
          setProgressBar({ step: 'failed', progress: 0, message: status.error || '配图生成失败' });
          toast('配图生成失败，文案已保存', { icon: '⚠️' });
          localStorage.removeItem(LS_KEY);
          await autoSave(text, '', prompt);
          saveDraft(prompt, text, '');
          setGenerating(false);
          load();
          return;
        }
        setProgressBar({ step: status.step, progress: status.progress || 0, message: status.message || '' });
        const realPct = status.libtvProgress != null && status.libtvProgress > 0
          ? `配图生成中 ${status.libtvProgress}%`
          : `配图生成中 (${status.iteration || '?'}/${status.total || 200})...`;
        setProgressStep(status.step === 'polling' ? realPct : (status.message || '生成中...'));
      } catch (e: any) {
        const errText = String(e.message || e);
        if (errText.includes('404') || errText.includes('不存在') || errText.includes('过期')) {
          clearInterval(restorePollingRef.current!);
          restorePollingRef.current = null;
          localStorage.removeItem(LS_KEY);
          setProgressBar({ step: 'completed', progress: 100, message: '配图任务已结束' });
          setProgressStep('');
          setGenerating(false);
        }
      }
    }, 5000); // 降级轮询 5s 一次，减少请求
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (restorePollingRef.current) clearInterval(restorePollingRef.current);
    };
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await api(token!).del(`/contents/${id}`);
      toast.success('已删除');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handlePreviewClose = () => {
    setShowPreview(false);
  };

  const handlePreviewSaved = (newText: string) => {
    setGeneratedText(newText);
    saveDraft(aiPrompt, newText, generatedImage);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">📝 文案生成</h2>

      {showPreview && (
        <PostPreviewModal
          text={generatedText}
          imageUrl={generatedImage}
          prompt={aiPrompt}
          onClose={handlePreviewClose}
          onSaved={handlePreviewSaved}
        />
      )}

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

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating || !aiPrompt}
              className="flex items-center gap-2 px-4 py-2 bg-accent-primary rounded-lg text-sm font-medium hover:bg-accent-primary/80 transition-colors disabled:opacity-50"
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {generating ? '生成中...' : 'AI 生成'}
            </button>

            {generatedText && !generating && (
              <button
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-1.5 px-3 py-2 border border-accent-primary/50 text-accent-primary rounded-lg text-xs hover:bg-accent-primary/10 transition-colors"
              >
                <Eye size={15} />
                预览发布
              </button>
            )}
          </div>

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

          {/* Generated Result Summary */}
          {(generatedText || generating) && (
            <div className={`space-y-3 pt-2 border-t border-dark-border ${!generatedText ? 'opacity-50' : ''}`}>
              {generatedText && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">生成文案</label>
                  <div className="bg-dark-bg rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {generatedText}
                  </div>
                </div>
              )}

              {generatedImage && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">配图</label>
                  <div className="bg-dark-bg rounded-lg overflow-hidden max-h-40">
                    <img src={generatedImage} alt="配图" className="w-full h-full object-contain" />
                  </div>
                  <a href={generatedImage} download className="inline-flex items-center gap-1 mt-2 text-xs text-blue-400 hover:underline">
                    <Download size={12} /> 下载配图
                  </a>
                </div>
              )}

              {generatedText && !generating && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Eye size={11} />
                  点击「预览发布」查看帖子效果、编辑文案、发布到社交媒体
                </p>
              )}
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

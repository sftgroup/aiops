import React, { useEffect, useRef, useCallback } from 'react';
import { useAuth, api } from '../AuthContext';
import toast from 'react-hot-toast';
import { FileText, Trash2, Loader2, Sparkles, Download, Eye } from 'lucide-react';
import PostPreviewModal from '../components/PostPreviewModal';
import ContentCardSkeleton from '../components/skeleton/ContentCardSkeleton';
import { useContentStore } from '../store/contentStore';
import type { WsTaskMessage, GenerationEntry, Content } from '../types';

const LS_KEY = '***';
const DRAFT_KEY = '***';

/** WebSocket 连接地址（自动拼接） */
function wsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

export default function ContentPage() {
  const { token } = useAuth();

  // ── All state from contentStore ─────────────────────
  const contents = useContentStore((s) => s.contents);
  const setContents = useContentStore((s) => s.setContents);
  const loading = useContentStore((s) => s.loading);
  const setLoading = useContentStore((s) => s.setLoading);
  const aiPrompt = useContentStore((s) => s.aiPrompt);
  const setAiPrompt = useContentStore((s) => s.setAiPrompt);
  const generatedText = useContentStore((s) => s.generatedText);
  const setGeneratedText = useContentStore((s) => s.setGeneratedText);
  const generatedImage = useContentStore((s) => s.generatedImage);
  const setGeneratedImage = useContentStore((s) => s.setGeneratedImage);
  const generating = useContentStore((s) => s.generating);
  const setGenerating = useContentStore((s) => s.setGenerating);
  const progressStep = useContentStore((s) => s.progressStep);
  const setProgressStep = useContentStore((s) => s.setProgressStep);
  const progressBar = useContentStore((s) => s.progressBar);
  const setProgressBar = useContentStore((s) => s.setProgressBar);
  const showPreview = useContentStore((s) => s.showPreview);
  const setShowPreview = useContentStore((s) => s.setShowPreview);

  const wsRef = useRef<WebSocket | null>(null);
  const pendingTaskId = useRef<string | null>(null);

  // ─── Refs to hold latest values for async callbacks ──
  const generatedTextRef = useRef(generatedText);
  const aiPromptRef = useRef(aiPrompt);
  const autoSaveRef = useRef<((text: string, imgUrl: string, prompt: string) => Promise<void>) | null>(null);
  const saveDraftRef = useRef<((prompt: string, text: string, imageUrl: string) => void) | null>(null);
  const loadRef = useRef<(() => void) | null>(null);

  // Sync refs with store values
  useEffect(() => { generatedTextRef.current = generatedText; }, [generatedText]);
  useEffect(() => { aiPromptRef.current = aiPrompt; }, [aiPrompt]);

  // ─── WebSocket 连接 ───────────────────────────────
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      try {
        ws = new WebSocket(wsUrl());
        wsRef.current = ws;

        ws.onopen = () => {
          const tk = localStorage.getItem('token');
          if (tk) {
            ws!.send(JSON.stringify({ type: 'auth', token: tk }));
          }
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
    // handleWsMessage intentionally omitted to avoid re-creating WS on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 如果有 pending taskId，重连后自动订阅
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && pendingTaskId.current) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', taskId: pendingTaskId.current }));
    }
  }, [wsRef.current?.readyState]);

  // ─── WebSocket 消息处理 ───────────────────────────
  const handleWsMessage = useCallback((msg: WsTaskMessage) => {
    const { step, progress, message, iteration, total, url, error } = msg;

    if (step === 'completed') {
      pendingTaskId.current = null;
      const imgUrl = url ? '/api/file/' + (url.replace('/api/file/', '') || '') : '';
      if (imgUrl) setGeneratedImage(imgUrl);
      setProgressBar({ step: 'completed', progress: 100, message: '配图完成' });
      setProgressStep('');
      localStorage.removeItem(LS_KEY);

      if (generatedTextRef.current && aiPromptRef.current) {
        autoSaveRef.current?.(generatedTextRef.current, imgUrl, aiPromptRef.current);
        saveDraftRef.current?.(aiPromptRef.current, generatedTextRef.current, imgUrl);
      }
      loadRef.current?.();
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
        autoSaveRef.current?.(generatedTextRef.current, '', aiPromptRef.current);
        saveDraftRef.current?.(aiPromptRef.current, generatedTextRef.current, '');
      }
      setGenerating(false);
      loadRef.current?.();
      return;
    }

    const realProgress = msg.libtvProgress != null && msg.libtvProgress > 0
      ? 20 + Math.round((msg.libtvProgress / 100) * 75)
      : (progress || 0);
    setProgressBar({ step: String(progress || step || ''), progress: realProgress, message: message || '' });
    setProgressStep(
      step === 'polling' && msg.libtvProgress != null
        ? `配图生成中 ${msg.libtvProgress}%`
        : step === 'polling'
          ? `配图生成中 (${iteration || '?'}/${total || 200})...`
          : message || '生成中...'
    );
  }, [setGeneratedImage, setProgressBar, setProgressStep, setGenerating]);

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
      const body: Record<string, unknown> = { title: prompt, text };
      if (imgUrl) body.imageUrl = imgUrl;
      await api(token).post('/contents/text', body);
      load();
    } catch (e) {
      console.error('[autoSave] Failed:', e);
    }
  // load is intentionally omitted from deps — we use loadRef for latest version and it's not recreated
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    try { setContents(await api(token).get('/contents')); }
    catch {} finally { setLoading(false); }
  }, [token, setContents, setLoading]);

  // ─── Wire up refs ────────────────────────────────
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
        localStorage.removeItem(LS_KEY);
      }
    } catch {}
  // Only on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          setGenerating(true);
          setProgressStep('恢复生成中...');
          setProgressBar({ step: 'polling', progress: 55, message: '等待 WebSocket 通知...' });

          restorePolling(task.taskId, task.text, task.prompt);
        } else if (task.text) {
          setGenerating(true);
          setProgressStep('恢复生成：提交配图任务...');
          setProgressBar({ step: 'image-start', progress: 55, message: '重新连接 LibTV...' });
          setTimeout(() => {
            api(token).post('/ai/image', { subject: task.prompt, style: 'general' })
              .then((r: { taskId?: string }) => {
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
  // Only on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ─── 单独重新生成文案 ────────────────────────────
  const handleRegenText = async () => {
    if (!aiPrompt) return toast.error('请输入提示词');
    setGenerating(true);
    setProgressStep('重新生成文案...');
    setProgressBar({ step: 'text', progress: 10, message: '调用 DeepSeek API...' });
    try {
      const textResult = await api(token!).post('/ai/generate', { prompt: aiPrompt, platform: 'twitter' });
      setGeneratedText(textResult.text);
      saveDraft(aiPrompt, textResult.text, generatedImage);
      toast.success('文案已更新');
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || '文案生成失败');
    }
    setGenerating(false);
  };

  // ─── 单独重新生成配图 ────────────────────────────
  const handleRegenImage = async () => {
    if (!aiPrompt) return toast.error('请输入提示词');
    setGenerating(true);
    setProgressStep('重新生成配图...');
    setProgressBar({ step: 'image-start', progress: 55, message: '正在连接 LibTV...' });
    try {
      const taskResult = await api(token!).post('/ai/image', { subject: aiPrompt, style: 'general' });
      const taskId = taskResult.taskId;
      if (!taskId) throw new Error('配图任务创建失败');
      pendingTaskId.current = taskId;
      setProgressStep('排队中...');
      setProgressBar({ step: 'queued', progress: 55, message: '已提交，等待队列处理...' });

      const poll = setInterval(async () => {
        if (!token) { clearInterval(poll); return; }
        try {
          const status = await api(token).get('/ai/image/status/' + taskId);
          if (status.step === 'completed') {
            clearInterval(poll);
            pendingTaskId.current = null;
            const url = '/api/file/' + (status.url?.replace('/api/file/', '') || '');
            if (url) setGeneratedImage(url);
            saveDraft(aiPrompt, generatedText || '', url || '');
            setProgressBar({ step: 'completed', progress: 100, message: '配图已完成' });
            toast.success('配图已更新');
            setGenerating(false);
            return;
          }
          if (status.step === 'failed' || status.error) {
            clearInterval(poll);
            pendingTaskId.current = null;
            toast('配图生成失败', { icon: '⚠️' });
            setGenerating(false);
            return;
          }
        } catch { /* 继续轮询 */ }
      }, 3000);
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || '配图生成失败');
      setGenerating(false);
    }
  };

  const generateFlow = async (prompt: string, entry: GenerationEntry) => {
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

      setProgressStep('排队中...');
      setProgressBar({ step: 'queued', progress: 55, message: '已提交，等待队列处理...' });
      restorePolling(taskId, textResult.text, prompt);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e) || '生成失败');
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
      } catch (e: unknown) {
        const errText = e instanceof Error ? e.message : String(e);
        if (errText.includes('404') || errText.includes('不存在') || errText.includes('过期')) {
          clearInterval(restorePollingRef.current!);
          restorePollingRef.current = null;
          localStorage.removeItem(LS_KEY);
          setProgressBar({ step: 'completed', progress: 100, message: '配图任务已结束' });
          setProgressStep('');
          setGenerating(false);
        }
      }
    }, 5000);
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
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)); }
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
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">📝 内容创作</h2>
        <p className="text-sm text-gray-500 mt-1">输入主题，AI 自动生成文案和配图，一键预览发布</p>
      </div>

      {showPreview && (
        <PostPreviewModal
          text={generatedText}
          imageUrl={generatedImage}
          prompt={aiPrompt}
          onClose={handlePreviewClose}
          onSaved={handlePreviewSaved}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        {/* Left: Generate (3/5) */}
        <div className="lg:col-span-3">
          <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
            {/* Card header */}
            <div className="px-5 py-4 border-b border-dark-border flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-accent-primary/20 flex items-center justify-center">
                  <Sparkles size={14} className="text-accent-primary" />
                </span>
                AI 生成
              </h3>
              {generatedText && !generating && (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  已生成
                </span>
              )}
            </div>

            <div className="p-5 space-y-4">
              {/* Input */}
              <div className="relative">
                <textarea
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-xl text-white focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20 transition-all h-24 resize-none text-sm leading-relaxed placeholder:text-gray-600"
                  placeholder="描述你想要的内容，例如：一条关于AI改变生活的Twitter帖子…"
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  disabled={generating}
                  aria-label="AI 生成提示词"
                />
                <div className="absolute bottom-2 right-3 text-xs text-gray-600">
                  {aiPrompt.length}/200
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={generating || !aiPrompt.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-accent-primary hover:bg-accent-primary/80 rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                >
                  {generating ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  {generating ? '生成中...' : 'AI 一键生成'}
                </button>
                {generatedText && !generating && (
                  <span className="text-xs text-gray-600 ml-1">
                    点击「AI 一键生成」重新生成全套
                  </span>
                )}
              </div>

              {/* Progress */}
              {generating && (
                <div className="bg-dark-bg rounded-xl p-4 space-y-3" role="progressbar" aria-label={progressStep} aria-busy="true" aria-live="polite">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center">
                      <Loader2 size={14} className="animate-spin text-accent-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-300">
                          {progressStep}
                        </span>
                        <span className={`text-xs font-mono ${
                          progressBar.progress < 50 ? 'text-blue-400' :
                          progressBar.progress < 90 ? 'text-yellow-400' :
                          'text-green-400'
                        }`}>
                          {progressBar.progress}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-dark-card rounded-full overflow-hidden mt-1.5">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${
                            progressBar.progress < 50 ? 'bg-blue-500' :
                            progressBar.progress < 90 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: progressBar.progress + '%' }}
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 pl-11">
                    {progressBar.message}
                  </p>
                </div>
              )}

              {/* Generated Result */}
              {(generatedText || generating) && (
                <div className={`pt-2 ${!generatedText ? 'opacity-50' : ''}`}>
                  {/* Text preview card */}
                  {generatedText && (
                    <div className="bg-dark-bg rounded-xl border border-dark-border overflow-hidden mb-3">
                      <div className="px-4 pt-3 pb-1 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-primary to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                          AI
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold text-white truncate">AI 运营助手</span>
                            <svg viewBox="0 0 22 22" className="w-4 h-4 text-blue-400 shrink-0" fill="currentColor">
                              <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.1-.47.156-.958.156-1.462 0-2.41-1.648-4.443-3.934-5.04-.443-.117-.906-.182-1.382-.182-.414 0-.826.045-1.23.13C10.728 1.5 9.168 2.494 8.1 3.916c-.522.668-.928 1.456-1.158 2.338-.264-.09-.544-.138-.828-.138-.89 0-1.727.353-2.325.934-.598.58-.95 1.385-.95 2.248 0 .338.06.668.16.984-1.476.726-2.59 2.07-2.88 3.697-.396 2.21.796 4.416 2.9 5.386.285.131.59.223.906.287.303.793.83 1.54 1.57 2.09.736.55 1.614.86 2.54.86h8.25c.926 0 1.804-.31 2.54-.86.74-.55 1.267-1.297 1.57-2.09.316-.064.62-.156.905-.287 2.104-.97 3.296-3.177 2.9-5.386z"/>
                            </svg>
                          </div>
                          <span className="text-xs text-gray-500">@ai_ops</span>
                        </div>
                      </div>
                      <div className="px-4 py-1.5">
                        <p className="text-sm leading-relaxed text-white/90 whitespace-pre-wrap">
                          {generatedText.slice(0, 200)}{generatedText.length > 200 ? '...' : ''}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Image */}
                  {generatedImage && (
                    <div className="mb-3">
                      <div className="bg-dark-bg rounded-xl overflow-hidden border border-dark-border">
                        <img src={generatedImage} alt="配图" className="w-full object-contain" style={{ maxHeight: 288 }} />
                      </div>
                      <a href={generatedImage} download className="inline-flex items-center gap-1 mt-2 text-xs text-blue-400 hover:underline">
                        <Download size={12} /> 下载原图
                      </a>
                    </div>
                  )}

                  {/* Action buttons */}
                  {generatedText && !generating && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={handleRegenText}
                        className="flex items-center gap-1.5 px-3 py-2 border border-dark-border rounded-lg text-xs text-gray-400 hover:text-white hover:border-gray-600 transition-all hover:bg-dark-hover"
                      >
                        🔄 文案
                      </button>
                      <button
                        onClick={handleRegenImage}
                        disabled={!generatedImage}
                        className="flex items-center gap-1.5 px-3 py-2 border border-dark-border rounded-lg text-xs text-gray-400 hover:text-white hover:border-gray-600 transition-all disabled:opacity-30 hover:bg-dark-hover disabled:cursor-not-allowed"
                      >
                        🎨 配图
                      </button>
                      <button
                        onClick={() => setShowPreview(true)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-accent-primary/15 text-accent-primary border border-accent-primary/25 rounded-lg text-xs hover:bg-accent-primary/25 transition-all font-medium"
                      >
                        <Eye size={13} />
                        预览发布
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: History (2/5) */}
        <div className="lg:col-span-2">
          <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
            <div className="px-5 py-4 border-b border-dark-border flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <FileText size={14} className="text-green-400" />
                </span>
                历史记录
              </h3>
              {contents.length > 0 && (
                <span className="text-xs text-gray-500">{contents.length} 条</span>
              )}
            </div>

            <div className="p-4">
              {loading ? (
                <ContentCardSkeleton count={5} />
              ) : contents.length === 0 ? (
                <div className="text-center py-12">
                  <FileText size={32} className="mx-auto text-gray-700 mb-3" />
                  <p className="text-sm text-gray-500">暂无生成记录</p>
                  <p className="text-xs text-gray-600 mt-1">点击「AI 一键生成」开始创作</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1 scrollbar-thin animate-fade-in">
                  {contents.map(c => (
                    <div key={c.id} className="group bg-dark-bg rounded-xl p-3.5 hover:bg-dark-hover transition-colors cursor-pointer border border-transparent hover:border-dark-border">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          c.imageUrl ? 'bg-purple-500/20' : 'bg-blue-500/20'
                        }`}>
                          <span className="text-xs">{c.imageUrl ? '📷' : '📝'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white/80 truncate leading-snug">
                            {(c.title || c.subject || '无标题')?.slice(0, 40)}
                          </p>
                          {c.text && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                              {c.text.slice(0, 80)}
                            </p>
                          )}
                          <p className="text-[11px] text-gray-600 mt-1.5">
                            {new Date(c.createdAt).toLocaleDateString('zh-CN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                          className="p-1.5 rounded-lg text-gray-600 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                          aria-label="删除内容"
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

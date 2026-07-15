import React, { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, api } from '../AuthContext';
import { getToken } from '../token';
import { LS_KEY, DRAFT_KEY } from '../constants';
import toast from 'react-hot-toast';
import { FileText, Trash2, Loader2, Sparkles, Download, Eye, Palette, Image as ImageIcon } from 'lucide-react';
import PostPreviewModal from '../components/PostPreviewModal';
import ContentCardSkeleton from '../components/skeleton/ContentCardSkeleton';
import { useContentStore } from '../store/contentStore';
import type { WsTaskMessage, GenerationEntry, Content } from '../types';

/** WebSocket 连接地址 */
function wsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

/** 海报风格选项 */
const POSTER_STYLES = [
  { value: 'default', labelKey: 'style.default' },
  { value: 'general', labelKey: 'style.general' },
  { value: 'tech', labelKey: 'style.tech' },
  { value: 'minimal', labelKey: 'style.minimal' },
  { value: 'western', labelKey: 'style.western' },
  { value: 'festive', labelKey: 'style.festive' },
  { value: 'promo', labelKey: 'style.promo' },
  { value: 'handdrawn', labelKey: 'style.handdrawn' },
];

export default function ContentPage() {
  const { t } = useTranslation(['content', 'common']);
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
  const posterPrompt = useContentStore((s) => s.posterPrompt);
  const setPosterPrompt = useContentStore((s) => s.setPosterPrompt);
  const posterStyle = useContentStore((s) => s.posterStyle);
  const setPosterStyle = useContentStore((s) => s.setPosterStyle);
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

  useEffect(() => { generatedTextRef.current = generatedText; }, [generatedText]);
  useEffect(() => { aiPromptRef.current = aiPrompt; }, [aiPrompt]);

  // ─── WebSocket ─────────────────────────────────────
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      try {
        ws = new WebSocket(wsUrl());
        wsRef.current = ws;

        ws.onopen = () => {
          const tk = getToken();
          if (tk) ws!.send(JSON.stringify({ type: 'auth', token: tk }));
          if (pendingTaskId.current) ws!.send(JSON.stringify({ type: 'subscribe', taskId: pendingTaskId.current }));
        };

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'task' && msg.taskId === pendingTaskId.current) handleWsMessage(msg);
          } catch { /* ignore */ }
        };

        ws.onclose = () => { wsRef.current = null; reconnectTimer = setTimeout(connect, 3000); };
        ws.onerror = () => ws?.close();
      } catch { /* ignore */ }
    }

    connect();
    return () => { clearTimeout(reconnectTimer); ws?.close(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && pendingTaskId.current) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', taskId: pendingTaskId.current }));
    }
  }, [wsRef.current?.readyState]);

  // ─── WS message handler ────────────────────────────
  const handleWsMessage = useCallback((msg: WsTaskMessage) => {
    const { step, progress, message, url, error } = msg;

    if (step === 'completed') {
      pendingTaskId.current = null;
      const imgUrl = url ? '/api/file/' + (url.replace('/api/file/', '') || '') : '';
      if (imgUrl) setGeneratedImage(imgUrl);
      setProgressBar({ step: 'completed', progress: 100, message: t('progress.posterDone') });
      setProgressStep('');
      localStorage.removeItem(LS_KEY);
      if (generatedTextRef.current && aiPromptRef.current) {
        autoSaveRef.current?.(generatedTextRef.current, imgUrl, aiPromptRef.current);
        saveDraftRef.current?.(aiPromptRef.current, generatedTextRef.current, imgUrl);
      }
      loadRef.current?.();
      toast.success(t('generate.posterSaved'));
      setGenerating(false);
      return;
    }

    if (step === 'failed' || error) {
      pendingTaskId.current = null;
      setProgressBar({ step: 'failed', progress: 0, message: error || t('progress.posterFailed') });
      toast(t('generate.posterFailed'), { icon: '⚠️' });
      localStorage.removeItem(LS_KEY);
      if (generatedTextRef.current && aiPromptRef.current) {
        autoSaveRef.current?.(generatedTextRef.current, '', aiPromptRef.current);
        saveDraftRef.current?.(aiPromptRef.current, generatedTextRef.current, '');
      }
      setGenerating(false);
      loadRef.current?.();
      return;
    }

    setProgressBar({ step: String(step || ''), progress: progress || 0, message: message || '' });
    setProgressStep(message || t('progress.generating'));
  }, [t, setGeneratedImage, setProgressBar, setProgressStep, setGenerating]);

  // ─── Draft persistence ─────────────────────────────
  const saveDraft = useCallback((prompt: string, text: string, imageUrl: string) => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ prompt, text, imageUrl, savedAt: Date.now() }));
    } catch { /* ignore */ }
  }, []);

  const autoSave = useCallback(async (text: string, imgUrl: string, prompt: string) => {
    if (!token) return;
    try {
      const body: Record<string, unknown> = { title: prompt, text };
      if (imgUrl) body.imageUrl = imgUrl;
      await api(token).post('/contents/text', body);
      load();
    } catch (e) { console.error('[autoSave] Failed:', e); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    try { setContents(await api(token).get('/contents')); }
    catch { /* ignore */ } finally { setLoading(false); }
  }, [token, setContents, setLoading]);

  useEffect(() => { autoSaveRef.current = autoSave; }, [autoSave]);
  useEffect(() => { saveDraftRef.current = saveDraft; }, [saveDraft]);
  useEffect(() => { loadRef.current = load; }, [load]);

  // Restore draft from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (Date.now() - draft.savedAt > 7 * 24 * 3600 * 1000) { localStorage.removeItem(DRAFT_KEY); return; }
        if (draft.prompt) setAiPrompt(draft.prompt);
        if (draft.text) setGeneratedText(draft.text);
        if (draft.imageUrl) setGeneratedImage(draft.imageUrl);
        localStorage.removeItem(LS_KEY);
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (generatedText) saveDraft(aiPrompt, generatedText, generatedImage);
  }, [generatedText, generatedImage, aiPrompt, saveDraft]);

  // Restore pending task
  useEffect(() => {
    if (!token) return;
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      try {
        const task = JSON.parse(saved);
        if (Date.now() - task.startedAt > 300000) { localStorage.removeItem(LS_KEY); return; }
        if (task.prompt) setAiPrompt(task.prompt);
        if (task.text) setGeneratedText(task.text);
        if (task.posterPrompt) setPosterPrompt(task.posterPrompt);

        if (task.taskId && task.step === 'poster') {
          pendingTaskId.current = task.taskId;
          setGenerating(true);
          setProgressStep(t('progress.restoring'));
          setProgressBar({ step: 'polling', progress: 55, message: t('progress.waitingWs') });
          restorePolling(task.taskId, task.text, task.prompt);
        } else if (task.text) {
          setGenerating(false);
        } else if (task.step === 'text') {
          setGenerating(true);
          setProgressStep(t('progress.restoring'));
          setProgressBar({ step: 'text', progress: 10, message: t('progress.restoringText') });
          setTimeout(() => generateFlow(task.prompt, task), 100);
        }
      } catch { localStorage.removeItem(LS_KEY); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { load(); }, [token, load]);

  // ─── Generate social text ──────────────────────────
  const handleGenerateText = async () => {
    if (!aiPrompt) return toast.error(t('generate.promptRequired'));
    const prompt = aiPrompt;
    const entry = { step: 'text', prompt, text: '', taskId: '', startedAt: Date.now() };
    localStorage.setItem(LS_KEY, JSON.stringify(entry));
    setGenerating(true);
    setProgressStep(t('progress.callingDeepseek'));
    setProgressBar({ step: 'text', progress: 10, message: t('progress.callingDeepseekMsg') });
    setGeneratedText('');
    setGeneratedImage('');
    generateFlow(prompt, entry);
  };

  const generateFlow = async (prompt: string, entry: GenerationEntry) => {
    try {
      const textResult = await api(token!).post('/ai/generate', { prompt, platform: 'twitter' });
      setGeneratedText(textResult.text);
      setProgressBar({ step: 'text', progress: 50, message: t('progress.textDone') });
      saveDraft(prompt, textResult.text, '');
      await autoSave(textResult.text, '', prompt);
      toast.success(t('generate.textSaved'));
      entry.text = textResult.text;
      entry.step = 'text-saved';
      localStorage.setItem(LS_KEY, JSON.stringify(entry));
      setGenerating(false);
      setProgressStep('');
      setProgressBar({ step: 'done', progress: 100, message: t('progress.textDone') });
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e) || t('generate.generateFailed'));
      localStorage.removeItem(LS_KEY);
      setGenerating(false);
    }
  };

  // ─── Generate poster prompt ────────────────────────
  const handleGeneratePosterPrompt = async () => {
    if (!aiPrompt) return toast.error(t('generate.promptRequired'));
    setGenerating(true);
    setProgressStep(t('generate.genPosterPrompt'));
    setProgressBar({ step: 'text', progress: 10, message: t('progress.posterPromptGen') });
    try {
      const textResult = await api(token!).post('/ai/generate', {
        prompt: aiPrompt,
        platform: 'poster', // special platform for poster copy
      });
      setPosterPrompt(textResult.text);
      setProgressBar({ step: 'done', progress: 100, message: t('progress.posterPromptDone') });
      setProgressStep('');
      toast.success(t('generate.posterPromptReady'));
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || t('generate.generateFailed'));
    }
    setGenerating(false);
  };

  // ─── Poster logo upload ───────────────────────────
  const posterLogoInputRef = useRef<HTMLInputElement>(null);
  const handlePosterLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: form });
      const data = await res.json();
      if (data.url) {
        await api(token).post('/settings', { poster_logo_url: data.url });
        toast.success('海报 Logo 已上传');
      }
    } catch { toast.error('上传失败'); }
    e.target.value = '';
  };

  // ─── Submit poster generation ──────────────────────
  const handleSubmitPoster = useCallback(async () => {
    const subject = (posterPrompt || aiPrompt).trim();
    if (!subject) return toast.error(t('generate.promptRequired'));
    setGenerating(true);
    setProgressStep(t('generate.genPoster'));
    setProgressBar({ step: 'poster-start', progress: 5, message: t('progress.posterStart') });
    try {
      const taskResult = await api(token!).post('/ai/poster', { subject, style: posterStyle });
      const taskId = taskResult.taskId;
      if (!taskId) throw new Error(t('generate.generateFailed'));
      pendingTaskId.current = taskId;
      localStorage.setItem(LS_KEY, JSON.stringify({
        step: 'poster', prompt: aiPrompt, text: generatedText, posterPrompt, taskId, startedAt: Date.now(),
      }));
      setProgressStep(t('progress.queued'));
      setProgressBar({ step: 'queued', progress: 10, message: t('progress.queuedMsg') });
      restorePolling(taskId, generatedText || posterPrompt || '', aiPrompt);
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || t('generate.posterFailed'));
      setGenerating(false);
    }
  }, [posterPrompt, aiPrompt, posterStyle, generatedText, token, t]);

  // ─── Regenerate text ───────────────────────────────
  const handleRegenText = async () => {
    if (!aiPrompt) return toast.error(t('generate.promptRequired'));
    setGenerating(true);
    setProgressStep(t('generate.regenText'));
    setProgressBar({ step: 'text', progress: 10, message: t('progress.callingDeepseekMsg') });
    try {
      const textResult = await api(token!).post('/ai/generate', { prompt: aiPrompt, platform: 'twitter' });
      setGeneratedText(textResult.text);
      saveDraft(aiPrompt, textResult.text, generatedImage);
      toast.success(t('generate.textUpdated'));
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || t('generate.textFailed'));
    }
    setGenerating(false);
  };

  // ─── REST polling fallback ─────────────────────────
  const restorePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const restorePolling = (taskId: string, text: string, prompt: string) => {
    if (restorePollingRef.current) clearInterval(restorePollingRef.current);
    restorePollingRef.current = setInterval(async () => {
      if (!token) return;
      try {
        const status = await api(token).get('/ai/poster/status/' + taskId);
        if (status.step === 'completed') {
          clearInterval(restorePollingRef.current!);
          restorePollingRef.current = null;
          pendingTaskId.current = null;
          if (status.url) setGeneratedImage(status.url);
          setProgressBar({ step: 'completed', progress: 100, message: t('progress.posterDone') });
          setProgressStep('');
          localStorage.removeItem(LS_KEY);
          await autoSave(text, status.url || '', prompt);
          saveDraft(prompt, text, status.url || '');
          load();
          toast.success(t('generate.posterSaved'));
          setGenerating(false);
          return;
        }
        if (status.step === 'failed' || status.error) {
          clearInterval(restorePollingRef.current!);
          restorePollingRef.current = null;
          pendingTaskId.current = null;
          setProgressBar({ step: 'failed', progress: 0, message: status.error || t('progress.posterFailed') });
          toast(t('generate.posterFailed'), { icon: '⚠️' });
          localStorage.removeItem(LS_KEY);
          await autoSave(text, '', prompt);
          saveDraft(prompt, text, '');
          setGenerating(false);
          load();
          return;
        }
        setProgressBar({ step: status.step, progress: status.progress || 0, message: status.message || '' });
        setProgressStep(status.message || t('progress.generating'));
      } catch (e: unknown) {
        const errText = e instanceof Error ? e.message : String(e);
        if (errText.includes('404') || errText.includes('不存在') || errText.includes('过期')) {
          clearInterval(restorePollingRef.current!);
          restorePollingRef.current = null;
          localStorage.removeItem(LS_KEY);
          setProgressBar({ step: 'completed', progress: 100, message: t('progress.taskEndedMsg') });
          setProgressStep('');
          setGenerating(false);
        }
      }
    }, 5000);
  };

  useEffect(() => () => { if (restorePollingRef.current) clearInterval(restorePollingRef.current); }, []);

  // ─── Delete ────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try { await api(token!).del(`/contents/${id}`); toast.success(t('history.deleted')); load(); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)); }
  };

  const handlePreviewClose = () => setShowPreview(false);
  const handlePreviewSaved = (newText: string) => {
    setGeneratedText(newText);
    saveDraft(aiPrompt, newText, generatedImage);
  };

  const handleClearAll = () => {
    setAiPrompt('');
    setGeneratedText('');
    setGeneratedImage('');
    setPosterPrompt('');
    setPosterStyle('general');
    setProgressBar({ step: '', progress: 0, message: '' });
    setProgressStep('');
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(LS_KEY);
    if (restorePollingRef.current) clearInterval(restorePollingRef.current);
    pendingTaskId.current = null;
    toast.success(t('generate.cleared'));
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('page.title')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('page.subtitle')}</p>
        </div>
        <button
          onClick={handleClearAll}
          disabled={generating}
          className="flex items-center gap-1.5 px-3 py-2 border border-dark-border rounded-lg text-xs text-gray-400 hover:text-red-400 hover:border-red-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Trash2 size={13} />
          {t('generate.clear')}
        </button>
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
                {t('generate.cardTitle')}
              </h3>
              {generatedText && (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  {t('generate.generated')}
                </span>
              )}
            </div>

            <div className="p-5 space-y-4">
              {/* Input */}
              <div className="relative">
                <textarea
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-xl text-white focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20 transition-all h-24 resize-none text-sm leading-relaxed placeholder:text-gray-600"
                  placeholder={t('generate.placeholder')}
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  disabled={generating}
                  aria-label={t('generate.ariaLabel')}
                />
                <div className="absolute bottom-2 right-3 text-xs text-gray-600">
                  {t('generate.charCount', { count: aiPrompt.length })}
                </div>
              </div>

              {/* Main Actions + Progress (inline) */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleGenerateText}
                  disabled={generating || !aiPrompt.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-accent-primary hover:bg-accent-primary/80 rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                >
                  {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {generating ? t('generate.btnGenerating') : t('generate.btnGenerate')}
                </button>
                <button
                  onClick={handleGeneratePosterPrompt}
                  disabled={generating || !aiPrompt.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 border border-accent-primary/50 rounded-xl text-sm text-accent-primary hover:bg-accent-primary/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                >
                  <Palette size={16} />
                  {t('generate.genPosterPrompt')}
                </button>
                {generating && (
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-xs text-gray-500 truncate">{progressStep}</span>
                    <span className="text-xs font-mono shrink-0">{progressBar.progress}%</span>
                  </div>
                )}
              </div>

              {/* ── Social Text Result ── */}
              {generatedText && (
                <div className={`pt-2 space-y-3 ${generating ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="bg-dark-bg rounded-xl border border-dark-border overflow-hidden">
                    <div className="px-4 pt-3 pb-1 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-primary to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0">AI</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-white truncate">{t('result.authorName')}</span>
                          <svg viewBox="0 0 22 22" className="w-4 h-4 text-blue-400 shrink-0" fill="currentColor">
                            <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.1-.47.156-.958.156-1.462 0-2.41-1.648-4.443-3.934-5.04-.443-.117-.906-.182-1.382-.182-.414 0-.826.045-1.23.13C10.728 1.5 9.168 2.494 8.1 3.916c-.522.668-.928 1.456-1.158 2.338-.264-.09-.544-.138-.828-.138-.89 0-1.727.353-2.325.934-.598.58-.95 1.385-.95 2.248 0 .338.06.668.16.984-1.476.726-2.59 2.07-2.88 3.697-.396 2.21.796 4.416 2.9 5.386.285.131.59.223.906.287.303.793.83 1.54 1.57 2.09.736.55 1.614.86 2.54.86h8.25c.926 0 1.804-.31 2.54-.86.74-.55 1.267-1.297 1.57-2.09.316-.064.62-.156.905-.287 2.104-.97 3.296-3.177 2.9-5.386z"/>
                          </svg>
                        </div>
                        <span className="text-xs text-gray-500">{t('result.authorHandle')}</span>
                      </div>
                    </div>
                    <div className="px-4 py-1.5">
                      <p className="text-sm leading-relaxed text-white/90 whitespace-pre-wrap">
                        {generatedText.slice(0, 200)}{generatedText.length > 200 ? '...' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={handleRegenText} className="flex items-center gap-1.5 px-3 py-2 border border-dark-border rounded-lg text-xs text-gray-400 hover:text-white hover:border-gray-600 transition-all hover:bg-dark-hover">
                      {t('generate.regenText')}
                    </button>
                    <button onClick={() => setShowPreview(true)} className="flex items-center gap-1.5 px-4 py-2 bg-accent-primary/15 text-accent-primary border border-accent-primary/25 rounded-lg text-xs hover:bg-accent-primary/25 transition-all font-medium">
                      <Eye size={13} />
                      {t('generate.btnPreview')}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Poster Prompt Result ── */}
              {posterPrompt && (
                <div className={`pt-2 space-y-3 ${generating ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="bg-dark-bg rounded-xl border border-amber-500/30 overflow-hidden">
                    <div className="px-4 pt-3 pb-1 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                        <Palette size={14} className="text-amber-400" />
                      </div>
                      <span className="text-xs font-bold text-amber-300">{t('generate.posterPrompt')}</span>
                    </div>
                    <div className="px-4 py-1.5">
                      <textarea
                        className="w-full bg-transparent text-sm leading-relaxed text-white/90 whitespace-pre-wrap resize-none border-0 outline-none min-h-[60px]"
                        value={posterPrompt}
                        onChange={e => setPosterPrompt(e.target.value)}
                        placeholder={t('generate.posterPromptPlaceholder')}
                      />
                    </div>
                  </div>

                  {/* Style selector */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">{t('style.label')}</span>
                    {POSTER_STYLES.map(s => (
                      <button
                        key={s.value}
                        onClick={() => setPosterStyle(s.value)}
                        className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                          posterStyle === s.value
                            ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/40'
                            : 'bg-dark-bg border border-dark-border text-gray-400 hover:text-white hover:border-gray-600'
                        }`}
                      >
                        {t(s.labelKey)}
                      </button>
                    ))}
                  </div>

                  {/* Translate */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">{t('style.translate')}</span>
                    {[
                      { lang: '中文', code: 'zh' },
                      { lang: 'English', code: 'en' },
                      { lang: '日本語', code: 'ja' },
                      { lang: '한국어', code: 'ko' },
                      { lang: 'العربية', code: 'ar' },
                    ].map(l => (
                      <button
                        key={l.code}
                        onClick={async () => {
                          if (!token) return;
                          setGenerating(true);
                          try {
                            const r = await api(token).post('/ai/generate', {
                              prompt: `Translate the following poster description to ${l.lang}. Keep the visual details, composition, colors, elements. Output only the translation, no explanation.\n\n${posterPrompt}`,
                              platform: 'poster',
                            });
                            setPosterPrompt(r.text);
                            toast.success(`已翻译为 ${l.lang}`);
                          } catch { toast.error('翻译失败'); }
                          setGenerating(false);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs bg-dark-bg border border-dark-border text-gray-400 hover:text-white hover:border-gray-600 transition-all"
                      >
                        {l.lang}
                      </button>
                    ))}
                  </div>

                  {/* Logo upload + Generate */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={handleSubmitPoster}
                      disabled={generating}
                      className="flex items-center gap-2 px-5 py-2.5 bg-accent-primary hover:bg-accent-primary/80 rounded-xl text-sm font-medium transition-all disabled:opacity-40 enabled:active:scale-95"
                    >
                      <Sparkles size={16} />
                      {t('generate.genPoster')}
                    </button>
                    <button
                      onClick={handleGeneratePosterPrompt}
                      disabled={generating || !aiPrompt.trim()}
                      className="flex items-center gap-1.5 px-3 py-2 border border-dark-border rounded-lg text-xs text-gray-400 hover:text-white hover:border-gray-600 transition-all"
                    >
                      <Sparkles size={12} />
                      {t('generate.regenPosterPrompt')}
                    </button>
                    <label className="flex items-center gap-1.5 px-3 py-2.5 border border-dark-border rounded-xl text-xs text-gray-400 hover:text-white hover:border-gray-600 cursor-pointer transition-all">
                      <ImageIcon size={14} />
                      {t('style.posterLogo')}
                      <input type="file" accept="image/*" className="hidden" onChange={handlePosterLogoUpload} ref={posterLogoInputRef} />
                    </label>
                  </div>
                </div>
              )}

              {/* ── Generated Poster (image) ── */}
              {generatedImage && !generating && (
                <div className="pt-2">
                  <div className="bg-dark-bg rounded-xl overflow-hidden border border-dark-border">
                    <img src={generatedImage} alt="Generated poster" className="w-full object-contain" style={{ maxHeight: 288 }} />
                  </div>
                  <a href={generatedImage} download className="inline-flex items-center gap-1 mt-2 text-xs text-blue-400 hover:underline">
                    <Download size={12} /> {t('result.download')}
                  </a>
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
                {t('history.title')}
              </h3>
              {contents.length > 0 && (
                <span className="text-xs text-gray-500">{t('history.count', { count: contents.length })}</span>
              )}
            </div>

            <div className="p-4">
              {loading ? (
                <ContentCardSkeleton count={5} />
              ) : contents.length === 0 ? (
                <div className="text-center py-12">
                  <FileText size={32} className="mx-auto text-gray-700 mb-3" />
                  <p className="text-sm text-gray-500">{t('history.empty')}</p>
                  <p className="text-xs text-gray-600 mt-1">{t('history.emptyHint')}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1 scrollbar-thin animate-fade-in">
                  {contents.map(c => (
                    <div key={c.id} className="group bg-dark-bg rounded-xl p-3.5 hover:bg-dark-hover transition-colors cursor-pointer border border-transparent hover:border-dark-border"
                      onClick={() => {
                        setAiPrompt(c.title || c.subject || '');
                        setGeneratedText(c.text || '');
                        if (c.imageUrl) setGeneratedImage(c.imageUrl);
                        setPosterPrompt('');
                        setShowPreview(false);
                        toast.success(t('history.restored'));
                      }}>
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c.imageUrl ? 'bg-purple-500/20' : 'bg-blue-500/20'}`}>
                          <span className="text-xs">{c.imageUrl ? '📷' : '📝'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white/80 truncate leading-snug">
                            {(c.title || c.subject || t('history.noTitle'))?.slice(0, 40)}
                          </p>
                          {c.text && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                              {c.text.slice(0, 80)}
                            </p>
                          )}
                          <p className="text-[11px] text-gray-600 mt-1.5">
                            {new Date(c.createdAt).toLocaleDateString('zh-CN', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                          className="p-1.5 rounded-lg text-gray-600 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                          aria-label={t('history.delete')}
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

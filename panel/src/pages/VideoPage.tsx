import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, api } from '../AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import toast from 'react-hot-toast';
import { Video } from 'lucide-react';
import VideoCard from '../components/video/VideoCard';
import VideoCardSkeleton from '../components/skeleton/VideoCardSkeleton';
import VideoSubjectForm from '../components/video/VideoSubjectForm';
import VideoScriptCard from '../components/video/VideoScriptCard';
import VideoErrorBanner from '../components/video/VideoErrorBanner';
import VideoGeneratePanel from '../components/video/VideoGeneratePanel';
import KeyboardShortcutsHelp from '../components/KeyboardShortcutsHelp';
import { useVideoStore } from '../store/videoStore';
import type { VideoItem } from '../store/videoStore';

// Lazy-load the video player modal
const VideoPlayerModal = React.lazy(() => import('../components/video/VideoPlayerModal'));

export default function VideoPage() {
  const { t } = useTranslation(['video', 'common']);
  const { token } = useAuth();

  // ── Form state from store ──────────────────────────
  const subject = useVideoStore((s) => s.subject);
  const setSubject = useVideoStore((s) => s.setSubject);
  const script = useVideoStore((s) => s.script);
  const setScript = useVideoStore((s) => s.setScript);
  const duration = useVideoStore((s) => s.duration);
  const setDuration = useVideoStore((s) => s.setDuration);
  const customDuration = useVideoStore((s) => s.customDuration);
  const setCustomDuration = useVideoStore((s) => s.setCustomDuration);
  const showCustomDuration = useVideoStore((s) => s.showCustomDuration);
  const setShowCustomDuration = useVideoStore((s) => s.setShowCustomDuration);

  // ── Generation / progress state from store ────────
  const generatingScript = useVideoStore((s) => s.generatingScript);
  const setGeneratingScript = useVideoStore((s) => s.setGeneratingScript);
  const generating = useVideoStore((s) => s.generating);
  const setGenerating = useVideoStore((s) => s.setGenerating);
  const progressMsg = useVideoStore((s) => s.progressMsg);
  const setProgressMsg = useVideoStore((s) => s.setProgressMsg);
  const errorMsg = useVideoStore((s) => s.errorMsg);
  const setErrorMsg = useVideoStore((s) => s.setErrorMsg);
  const videos = useVideoStore((s) => s.videos);
  const setVideos = useVideoStore((s) => s.setVideos);
  const loadingVideos = useVideoStore((s) => s.loadingVideos);
  const setLoadingVideos = useVideoStore((s) => s.setLoadingVideos);
  const wsFallback = useVideoStore((s) => s.wsFallback);
  const setWsFallback = useVideoStore((s) => s.setWsFallback);

  // ── Video player modal state ──────────────────────
  const [playingVideo, setPlayingVideo] = React.useState<VideoItem | null>(null);
  const [helpOpen, setHelpOpen] = React.useState(false);


  const pollRef = useRef<number | null>(null);

  const videoDoneRef = useRef<string | null>(null);

  const timeoutRef = useRef<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const wsActiveTaskRef = useRef<string | null>(null);

  // WebSocket setup
  const wsUrl = useCallback(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }, []);
  const tRef = useRef(t);
  tRef.current = t;
  const ws = useWebSocket({
    wsUrl: wsUrl(),
    onProgress(data) {
      if (data.taskId === wsActiveTaskRef.current) {
        if (data.status === 'running') {
          const stepLabels = [
            tRef.current('page.progress.step1', '准备素材...'),
            tRef.current('page.progress.step2', '生成视频片段...'),
            tRef.current('page.progress.step3', '合成最终视频...'),
            tRef.current('page.progress.step4', '即将完成...'),
          ];
          const idx = ['copywriter','imagegen','videomaker','stitcher'].indexOf(data.step);
          setProgressMsg(idx >= 0 ? stepLabels[Math.min(idx, stepLabels.length-1)] : data.step);
        } else if (data.status === 'done') {
          setProgressMsg(tRef.current('page.progress.done', '合成完成'));
        } else if (data.status === 'error') {
          setGenerating(false);
          setProgressMsg('');
          setErrorMsg(data.errorMsg || tRef.current('page.progress.failed', '视频生成失败，请重试'));
          clearPollAndTimeout();
          wsActiveTaskRef.current = null;
        }
      }
    },
    onVideoReady(data) {
        clearPollAndTimeout();
        wsActiveTaskRef.current = null;
        loadVideos();
        setProgressMsg('');
        setGenerating(false);
        toast.success(tRef.current('page.videoReady', '🎬 视频生成完成！'));
    },
    onConnectionChange(connected) {
      setWsFallback(!connected);
    },
  });

  const clearPollAndTimeout = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  const loadVideos = useCallback(async () => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const data = await api(token!).get('/content/list?type=video', abort.signal) as { items: VideoItem[] };
      if (data?.items) {
        setVideos(prev => {
          const updated = [...prev];
          for (const v of data.items) {
            const idx = updated.findIndex(p => p.id === v.id);
            if (idx >= 0) {
              if (v.videoUrl && !updated[idx].videoUrl) {
                videoDoneRef.current = v.id;
                setTimeout(() => { videoDoneRef.current = null; }, 2000);
              }
              updated[idx] = v;
            } else {
              updated.push(v);
            }
          }
          return updated;
        });
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      /* ignore */
    }
    setLoadingVideos(false);
  }, [token, generating, setVideos, setErrorMsg, setLoadingVideos]);

  useEffect(() => {
    loadVideos();
    return () => {
      clearPollAndTimeout();
      abortRef.current?.abort();
    };
  }, [token, loadVideos, clearPollAndTimeout]);

  // ── Stable handler: generate script ──────────────
  const handleGenerateScript = useCallback(async () => {
    if (!subject.trim()) return toast.error(t('page.subjectRequired', '请输入视频主题'));
    setGeneratingScript(true);
    try {
      const d = await api(token!).post('/ai-media/video/script', { subject, duration });
      setScript(d.script);
      toast.success(t('page.scriptGenerated', '文案生成成功'));
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setGeneratingScript(false); }
  }, [subject, token, duration, setScript, setGeneratingScript, t]);

  // ── Stable handler: generate video ───────────────
  const handleGenerateVideo = useCallback(async () => {
    if (!subject.trim()) return toast.error(t('page.subjectRequired', '请输入视频主题'));
    setGenerating(true);
    setProgressMsg(t('page.progress.connecting', '连接中...'));
    try {
      const d = await api(token!).post('/ai-media/video', {
        subject: script || subject, duration,
      });
      const taskId = d.taskId;
      wsActiveTaskRef.current = taskId;
      toast.success(t('page.videoSubmitted', '📽️ 视频已提交生成...'));
      setProgressMsg(t('page.progress.queued', '已提交，等待生成...'));

      // Poll for task status
      let stepTimer = 0;
      const steps = [
        t('page.progress.step1', '准备素材...'),
        t('page.progress.step2', '生成视频片段...'),
        t('page.progress.step3', '合成最终视频...'),
        t('page.progress.step4', '即将完成...'),
      ];

      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = window.setInterval(async () => {
        try {
          const status = await api(token!).get(`/ai-media/video/status/${taskId}`);

          if (status.step === 'completed') {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
            wsActiveTaskRef.current = null;
            setProgressMsg('');
            setGenerating(false);
            loadVideos();
            toast.success(t('page.videoReady', '🎬 视频生成完成！'));
            return;
          }

          if (status.step === 'failed') {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
            wsActiveTaskRef.current = null;
            setGenerating(false);
            setErrorMsg(status.error || t('page.progress.failed', '视频生成失败，请重试'));
            return;
          }

          // Update progress message
          if (status.step === 'generating' || status.step === 'processing') {
            stepTimer = Math.min(stepTimer + 1, steps.length - 1);
            setProgressMsg(status.message || steps[stepTimer]);
          } else {
            setProgressMsg(status.message || steps[0]);
          }
        } catch (e2: unknown) {
          if (!(e2 instanceof DOMException && e2.name === 'AbortError')) return;
        }
      }, 5000);

      timeoutRef.current = window.setTimeout(() => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        timeoutRef.current = null;
        setGenerating(false);
        loadVideos();
        toast.error(t('page.progress.timeout', '生成超时，请重试'));
      }, 600000);

    } catch (e: unknown) {
      setGenerating(false);
      toast.error(e instanceof Error ? e.message : t('page.progress.failed', '视频生成失败'));
    }
  }, [subject, script, duration, token, setVideos, setGenerating, setProgressMsg, setErrorMsg, loadVideos, t]);

  // ── Stable handler: retry / dismiss errors ───────
  const handleRetryVideo = useCallback(() => {
    setErrorMsg(null);
    handleGenerateVideo();
  }, [setErrorMsg, handleGenerateVideo]);

  const handleDismissError = useCallback(() => {
    setErrorMsg(null);
  }, [setErrorMsg]);

  // ── Stable handler: delete video ─────────────────
  const handleDeleteVideo = useCallback(async (videoId: string) => {
    try {
      await api(token!).del('/team-tasks/today/video/' + videoId);
      setVideos(prev => prev.filter(v => v.id !== videoId));
      toast.success(t('page.videoDeleted', '已删除'));
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e) || t('page.deleteFailed', '删除失败')); }
  }, [token, setVideos, t]);

  // ── Stable handler: play video ───────────────────
  const handlePlay = useCallback((v: VideoItem) => {
    if (v.videoUrl) setPlayingVideo(v);
  }, []);

  // ── Stable handler: download video ──────────────
  const handleDownload = useCallback((v: VideoItem) => {
    window.open(v.videoUrl, '_blank');
  }, []);

  // ── Stable handler: close player ───────────────
  const handleClosePlayer = useCallback(() => {
    setPlayingVideo(null);
  }, []);

  // ── Stable handler: close help ─────────────────
  const handleCloseHelp = useCallback(() => {
    setHelpOpen(false);
  }, []);

  // ── Derived: video count text (useMemo) ──────────
  const videoCountText = useMemo(() => `${videos.length} ${t('page:count', '条')}`, [videos.length, t]);

  // ── Global keyboard shortcuts ──────────────────
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag) || target.isContentEditable) return;

      if (helpOpen || playingVideo) return;

      const key = e.key.toLowerCase();

      if (key === '?' || (key === '/' && e.shiftKey)) {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && key === 'k') {
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>('[data-search-input]');
        el?.focus();
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [helpOpen, playingVideo]);

  return (
    <div>
      {/* Header */}
      <div className="mb-5 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold">{t('page.title')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('page.description')}</p>
      </div>

      <div className="space-y-4 mb-8">
        <VideoSubjectForm
          subject={subject}
          setSubject={setSubject}
          duration={duration}
          setDuration={setDuration}
          customDuration={customDuration}
          setCustomDuration={setCustomDuration}
          showCustomDuration={showCustomDuration}
          setShowCustomDuration={setShowCustomDuration}
          generating={generating}
        />

        <VideoScriptCard
          script={script}
          setScript={setScript}
          generatingScript={generatingScript}
          generating={generating}
          subject={subject}
          onGenerateScript={handleGenerateScript}
        />

        {errorMsg && (
          <VideoErrorBanner
            errorMsg={errorMsg}
            onRetry={handleRetryVideo}
            onDismiss={handleDismissError}
          />
        )}

        <VideoGeneratePanel
          generating={generating}
          wsFallback={wsFallback}
          subject={subject}
          progressMsg={progressMsg}
          onGenerate={handleGenerateVideo}
        />
      </div>

      {/* Video Gallery */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Video size={14} className="text-purple-400" />
            </span>
            {t('gallery.heading')}
          </h3>
          <span className="text-xs text-gray-500">{videoCountText}</span>
        </div>

        {loadingVideos ? (
          <VideoCardSkeleton count={8} />
        ) : videos.length === 0 ? (
          <div className="text-center py-16 bg-dark-card rounded-xl border border-dark-border">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🎬</span>
            </div>
            <p className="text-base text-gray-400 font-medium">{t('gallery.emptyTitle')}</p>
            <p className="text-sm text-gray-600 mt-1 max-w-xs mx-auto">
              {t('gallery.emptyHint')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-fade-in">
            {videos.map(vid => (
              <VideoCard
                key={vid.id}
                video={vid}
                isNewComplete={videoDoneRef.current === vid.id}
                onPlay={handlePlay}
                onDelete={handleDeleteVideo}
                onDownload={handleDownload}
              />
            ))}
          </div>
        )}
      </div>

      {/* Video player modal (lazy loaded) */}
      {playingVideo && (
        <React.Suspense fallback={null}>
          <VideoPlayerModal
            src={playingVideo.videoUrl}
            title={playingVideo.subject}
            onClose={handleClosePlayer}
          />
        </React.Suspense>
      )}

      {/* Keyboard shortcuts help panel */}
      <KeyboardShortcutsHelp
        open={helpOpen}
        onClose={handleCloseHelp}
      />
    </div>
  );
}

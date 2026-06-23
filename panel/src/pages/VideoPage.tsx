import React, { useEffect, useRef, useCallback, useMemo } from 'react';
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

interface TeamTask {
  videos: import('../store/videoStore').VideoItem[];
  progress?: {
    videomaker?: string;
    errorMessage?: string;
    [key: string]: string | undefined;
  };
}

export default function VideoPage() {
  const { token } = useAuth();

  // ── Form state from store ──────────────────────────
  const subject = useVideoStore((s) => s.subject);
  const setSubject = useVideoStore((s) => s.setSubject);
  const script = useVideoStore((s) => s.script);
  const setScript = useVideoStore((s) => s.setScript);
  const duration = useVideoStore((s) => s.duration);
  const setDuration = useVideoStore((s) => s.setDuration);
  const cameraMovement = useVideoStore((s) => s.cameraMovement);
  const setCameraMovement = useVideoStore((s) => s.setCameraMovement);
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
  const ws = useWebSocket({
    wsUrl: wsUrl(),
    onProgress(data) {
      if (data.taskId === wsActiveTaskRef.current) {
        if (data.status === 'running') {
          const stepLabels = ['准备素材...', '生成视频片段...', '合成最终视频...', '即将完成...'];
          const idx = ['copywriter','imagegen','videomaker','stitcher'].indexOf(data.step);
          setProgressMsg(idx >= 0 ? stepLabels[Math.min(idx, stepLabels.length-1)] : data.step);
        } else if (data.status === 'done') {
          setProgressMsg('合成完成');
        } else if (data.status === 'error') {
          setGenerating(false);
          setProgressMsg('');
          setErrorMsg(data.errorMsg || '视频生成失败，请重试');
          clearPollAndTimeout();
          wsActiveTaskRef.current = null;
        }
      }
    },
    onVideoReady(data) {
      if (data.taskId === wsActiveTaskRef.current) {
        clearPollAndTimeout();
        wsActiveTaskRef.current = null;
        loadVideos();
        setProgressMsg('');
        setGenerating(false);
        toast.success('🎬 视频生成完成！');
      }
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
      const t = await api(token!).get('/team-tasks/today', abort.signal) as TeamTask;
      if (t?.videos) {
        if (t.progress?.videomaker === 'error' && !generating) {
          setErrorMsg(t.progress?.errorMessage || '视频生成失败，请重试');
        }

        setVideos(prev => {
          const updated = [...prev];
          for (const v of t.videos) {
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
    if (!subject.trim()) return toast.error('请输入视频主题');
    setGeneratingScript(true);
    try {
      const d = await api(token!).post('/videos/scripts', { subject, duration });
      setScript(d.script);
      toast.success('文案生成成功');
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setGeneratingScript(false); }
  }, [subject, token, duration, setScript, setGeneratingScript]);

  // ── Stable handler: generate video ───────────────
  const handleGenerateVideo = useCallback(async () => {
    if (!subject.trim()) return toast.error('请输入视频主题');
    setGenerating(true);
    setProgressMsg('连接 LibTV...');
    try {
      const d = await api(token!).post('/team-tasks/today/video', {
        subject, script, duration, cameraMovement: cameraMovement || undefined,
      });
      toast.success('📽️ 视频已提交，实时追踪中...');
      const tempVideo: VideoItem = {
        id: d.id, subject, script, videoUrl: '', duration, createdAt: new Date().toISOString(),
      };
      setVideos(prev => [...prev, tempVideo]);
      setProgressMsg('已提交，等待队列...');

      wsActiveTaskRef.current = d.id;

      let stepTimer = 0;
      const steps = ['准备素材...', '生成视频片段...', '合成最终视频...', '即将完成...'];

      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = window.setInterval(async () => {
        abortRef.current?.abort();
        const pollAbort = new AbortController();
        abortRef.current = pollAbort;

        if (ws.isAuthenticated) return;

        try {
          const t = await api(token!).get('/team-tasks/today', pollAbort.signal) as TeamTask;

          const prog = t.progress?.videomaker;
          if (prog === 'running') {
            stepTimer = Math.min(stepTimer + 1, steps.length - 1);
            setProgressMsg(steps[stepTimer]);
          } else if (prog === 'done') {
            setProgressMsg('合成完成');
          } else if (prog === 'error') {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            wsActiveTaskRef.current = null;
            setGenerating(false);
            setErrorMsg(t.progress?.errorMessage || '视频生成失败，请重试');
            return;
          }

          const vid = t?.videos?.find((v: VideoItem) => v.id === d.id);
          if (vid?.videoUrl) {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            wsActiveTaskRef.current = null;
            loadVideos();
            setProgressMsg('');
            setGenerating(false);
            toast.success('🎬 视频生成完成！');
            return;
          }
        } catch (e2: unknown) {
          if (e2 instanceof DOMException && e2.name === 'AbortError') return;
        }
      }, 4000);

      timeoutRef.current = window.setTimeout(() => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        timeoutRef.current = null;
        setGenerating(false);
        loadVideos();
        toast.error('生成超时，请重试');
      }, 600000);

    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)); setGenerating(false); }
  }, [subject, script, duration, cameraMovement, token, setVideos, setGenerating, setProgressMsg, setErrorMsg, loadVideos, ws.isAuthenticated]);

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
      await api(token!).del('team-tasks/today/video/' + videoId);
      setVideos(prev => prev.filter(v => v.id !== videoId));
      toast.success('已删除');
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e) || '删除失败'); }
  }, [token, setVideos]);

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
  const videoCountText = useMemo(() => `${videos.length} 条`, [videos.length]);

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
        <h2 className="text-xl sm:text-2xl font-bold">🎬 视频制作</h2>
        <p className="text-sm text-gray-500 mt-1">输入主题，AI 自动生成脚本和视频，一键发布到社交媒体</p>
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
          cameraMovement={cameraMovement}
          setCameraMovement={setCameraMovement}
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
            已生成的视频
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
            <p className="text-base text-gray-400 font-medium">还没有视频</p>
            <p className="text-sm text-gray-600 mt-1 max-w-xs mx-auto">
              输入主题，点击「LibTV 生成视频」开始创作
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

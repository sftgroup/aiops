import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, api } from '../AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import toast from 'react-hot-toast';
import {
  Loader2, Sparkles, Video, Play, Clock, Timer,
  FileText, Trash2, Download, CheckCircle2
} from 'lucide-react';
import PublishSection from '../components/PublishSection';

interface VideoItem {
  id: string;
  subject: string;
  script: string;
  videoUrl: string;
  duration: number;
  createdAt: string;
}

interface TeamTask {
  videos: VideoItem[];
  progress?: {
    videomaker?: string;
    errorMessage?: string;
    [key: string]: string | undefined;
  };
}

export default function VideoPage() {
  const { token } = useAuth();
  const [subject, setSubject] = useState('');
  const [script, setScript] = useState('');
  const [duration, setDuration] = useState(5);
  const [cameraMovement, setCameraMovement] = useState('');
  const [customDuration, setCustomDuration] = useState('');
  const [showCustomDuration, setShowCustomDuration] = useState(false);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const pollRef = useRef<number | null>(null);
  const videoDoneRef = useRef<string | null>(null);
  const timeoutRef = useRef<number | null>(null);       // stores the 10min timeout
  const abortRef = useRef<AbortController | null>(null); // cancels in-flight fetch on unmount
  const [wsFallback, setWsFallback] = useState(false);
  const wsActiveTaskRef = useRef<string | null>(null);

  // WebSocket setup — dynamic URL matching ContentPage pattern
  const wsUrl = () => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  };
  const ws = useWebSocket({
    wsUrl: wsUrl(),
    onProgress(data) {
      // Handle team_progress messages
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

  const loadVideos = useCallback(async () => {
    // Cancel any previous in-flight request (e.g. if called while another is pending)
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const t = await api(token!).get('/team-tasks/today', abort.signal) as TeamTask;
      if (t?.videos) {
        // Check if any video-maker is in error state (persistent error display)
        if (t.progress?.videomaker === 'error' && !generating) {
          setErrorMsg(t.progress?.errorMessage || '视频生成失败，请重试');
        }

        // Merge backend data with local state — don't replace, so generating items stay visible
        setVideos(prev => {
          const updated = [...prev];
          for (const v of t.videos) {
            const idx = updated.findIndex(p => p.id === v.id);
            if (idx >= 0) {
              // Check if videoUrl just became available
              if (v.videoUrl && !updated[idx].videoUrl) {
                videoDoneRef.current = v.id;
                setTimeout(() => { videoDoneRef.current = null; }, 2000);
              }
              updated[idx] = v; // update with server data
            } else {
              updated.push(v);
            }
          }
          return updated;
        });
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return; // component unmounted, skip setState
      /* ignore */
    }
    setLoadingVideos(false);
  }, [token]);

  // Helper: clear polling + timeout
  const clearPollAndTimeout = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  useEffect(() => {
    loadVideos();
    return () => {
      clearPollAndTimeout();
      abortRef.current?.abort();
    };
  }, [token, loadVideos, clearPollAndTimeout]);

  const handleGenerateScript = async () => {
    if (!subject.trim()) return toast.error('请输入视频主题');
    setGeneratingScript(true);
    try {
      const d = await api(token!).post('/videos/scripts', { subject, duration });
      setScript(d.script);
      toast.success('文案生成成功');
    } catch (e: any) { toast.error(e.message); }
    finally { setGeneratingScript(false); }
  };

  const handleGenerateVideo = async () => {
    if (!subject.trim()) return toast.error('请输入视频主题');
    setGenerating(true);
    setProgressMsg('连接 LibTV...');
    try {
      const d = await api(token!).post('/team-tasks/today/video', {
        subject, script, duration, cameraMovement: cameraMovement || undefined,
      });
      toast.success('📽️ 视频已提交，实时追踪中...');
      // Add new video to list with generating status (don't filter out incomplete ones)
      const tempVideo: VideoItem = {
        id: d.id,
        subject,
        script,
        videoUrl: '',
        duration,
        createdAt: new Date().toISOString(),
      };
      setVideos(prev => [...prev, tempVideo]);
      setProgressMsg('已提交，等待队列...');

      // Register this task for WS events
      wsActiveTaskRef.current = d.id;

      // 实时轮询 progress (fallback when WS not available)
      let stepTimer = 0;
      const steps = ['准备素材...', '生成视频片段...', '合成最终视频...', '即将完成...'];

      if (pollRef.current) clearInterval(pollRef.current);
      // Only start polling if WS is not connected, or as safety backup
      pollRef.current = window.setInterval(async () => {
        // Cancel previous polling fetch before starting a new one
        abortRef.current?.abort();
        const pollAbort = new AbortController();
        abortRef.current = pollAbort;

        // If WS is connected, skip polling (rely on WS events)
        if (ws.isAuthenticated) return;

        try {
          const t = await api(token!).get('/team-tasks/today', pollAbort.signal) as TeamTask;
          
          // 更新进度
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

          // 检测视频完成
          const vid = t?.videos?.find((v: any) => v.id === d.id);
          if (vid?.videoUrl) {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            if (timeoutRef.current) { // cancel the 10min guard since we're done
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            wsActiveTaskRef.current = null;
            loadVideos(); // 刷新全列表
            setProgressMsg('');
            setGenerating(false);
            toast.success('🎬 视频生成完成！');
            return;
          }
        } catch (e: any) {
          if (e.name === 'AbortError') return; // component unmounted
        }
      }, 4000);

      // 超时保护（10分钟）— stored in ref so cleanup can clear it
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

    } catch (e: any) { toast.error(e.message); setGenerating(false); }
  };

  const handleRetryVideo = () => {
    setErrorMsg(null);
    handleGenerateVideo();
  };

  const handleDismissError = () => {
    setErrorMsg(null);
  };

  const handleDeleteVideo = async (videoId: string) => {
    try {
      await api(token!).del('team-tasks/today/video/' + videoId);
      setVideos(prev => prev.filter(v => v.id !== videoId));
      toast.success('已删除');
    } catch (e: any) { toast.error(e.message || '删除失败'); }
  };

  if (loadingVideos) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-gray-500" />
          <span className="text-sm text-gray-500">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">🎬 视频制作</h2>
        <p className="text-sm text-gray-500 mt-1">输入主题，AI 自动生成脚本和视频，一键发布到社交媒体</p>
      </div>

      <div className="space-y-4 mb-8">
        {/* Subject Card */}
        <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-border flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <span className="text-xs">🎯</span>
            </span>
            <h3 className="font-semibold">视频主题</h3>
          </div>
          <div className="p-5 space-y-4">
            <input
              className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-xl text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="例如：AI 改变生活、未来科技展望…"
              disabled={generating}
            />

            {/* Duration Selector */}
            <div>
              <label className="flex items-center gap-1.5 text-sm text-gray-400 mb-2.5">
                <Timer size={14} />
                视频时长
              </label>
              <div className="flex items-center gap-2 mb-2">
                {[
                  { value: 5, label: '5s', desc: 'Happy Horse' },
                  { value: 6, label: '6s', desc: '有镜头→Hailuo' },
                  { value: 10, label: '10s', desc: 'Wan 2.6 / Hailuo' },
                  { value: 15, label: '15s', desc: 'Wan 2.6' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setDuration(opt.value); setShowCustomDuration(false); setCustomDuration(''); }}
                    disabled={generating}
                    className={`relative flex-1 px-4 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                      duration === opt.value && !showCustomDuration
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-sm'
                        : 'bg-dark-bg border-dark-border text-gray-400 hover:border-gray-600 hover:text-gray-300'
                    } disabled:opacity-50`}
                  >
                    <span className="block">{opt.label}</span>
                    <span className={`block mt-0.5 text-[10px] ${
                      duration === opt.value && !showCustomDuration ? 'text-purple-400/60' : 'text-gray-600'
                    }`}>
                      {opt.desc}
                    </span>
                  </button>
                ))}
                {/* Custom Button */}
                <button
                  onClick={() => { setShowCustomDuration(true); setDuration(0); }}
                  disabled={generating}
                  className={`relative flex-1 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                    showCustomDuration
                      ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-sm'
                      : 'bg-dark-bg border-dark-border text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  } disabled:opacity-50`}
                >
                  <span className="block">自定义</span>
                </button>
              </div>
              {showCustomDuration && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="300"
                    value={customDuration}
                    onChange={e => {
                      setCustomDuration(e.target.value);
                      const v = parseInt(e.target.value);
                      if (v > 0 && v <= 300) setDuration(v);
                    }}
                    placeholder="3~300秒"
                    disabled={generating}
                    className="flex-1 px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white text-xs focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
                  />
                  <span className="text-xs text-gray-500">秒</span>
                </div>
              )}
            </div>

            {/* Camera Movement Selector */}
            <div>
              <label className="flex items-center gap-1.5 text-sm text-gray-400 mb-2.5">
                <span>🎥</span>
                镜头运动
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { value: '', label: '默认', desc: 'Happy Horse' },
                  { value: 'auto', label: '✨ 自动多镜头', desc: 'Wan 2.6' },
                  { value: '拉近', label: '拉近', desc: 'Hailuo' },
                  { value: '拉远', label: '拉远', desc: 'Hailuo' },
                  { value: '左摇', label: '左摇', desc: 'Hailuo' },
                  { value: '右摇', label: '右摇', desc: 'Hailuo' },
                  { value: '仰摄', label: '仰摄', desc: 'Hailuo' },
                  { value: '俯摄', label: '俯摄', desc: 'Hailuo' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setCameraMovement(opt.value)}
                    disabled={generating}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      cameraMovement === opt.value
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                        : 'bg-dark-bg border-dark-border text-gray-400 hover:border-gray-600 hover:text-gray-300'
                    } disabled:opacity-50`}
                  >
                    {opt.label}
                    {opt.desc && (
                      <span className={`ml-1 text-[9px] ${
                        cameraMovement === opt.value ? 'text-blue-400/50' : 'text-gray-600'
                      }`}>
                        {opt.desc}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Script Card */}
        <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <FileText size={14} className="text-blue-400" />
              </span>
              <h3 className="font-semibold">视频文案 / 提示词</h3>
            </div>
            <button
              onClick={handleGenerateScript}
              disabled={generatingScript || !subject.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-all disabled:opacity-40"
            >
              {generatingScript ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {generatingScript ? '生成中...' : 'AI 生成文案'}
            </button>
          </div>
          <div className="p-5">
            <textarea
              className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-xl text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all h-36 resize-none text-sm leading-relaxed placeholder:text-gray-600"
              value={script}
              onChange={e => setScript(e.target.value)}
              placeholder="AI 自动生成或手动输入提示词。LibTV 会根据文案生成匹配视频..."
              disabled={generating}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-600">
                {script.length > 0 ? `${script.length} 字` : ''}
              </span>
              {script && (
                <button
                  onClick={() => setScript('')}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  清空
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-red-400 text-lg leading-none mt-0.5">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-300">生成失败</p>
                <p className="text-xs text-red-400/80 mt-1 break-words">{errorMsg}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRetryVideo}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-all"
              >
                <span>↻</span> 重试
              </button>
              <button
                onClick={handleDismissError}
                className="px-3 py-2 text-xs font-medium text-gray-400 border border-dark-border rounded-lg hover:text-gray-300 hover:bg-dark-bg transition-all"
              >
                关闭
              </button>
            </div>
          </div>
        )}

        {/* WS fallback banner */}
        {wsFallback && generating && (
          <div className="flex items-center gap-2 px-3 py-1.5 mb-2 text-xs text-yellow-400 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
            <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
            实时推送不可用，已切换轮询模式
          </div>
        )}

        {/* Generate Button & Progress */}
        <button
          onClick={handleGenerateVideo}
          disabled={generating || !subject.trim()}
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl font-medium transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-purple-900/30"
        >
          {generating ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Play size={18} />
          )}
          {generating ? '生成中...' : '🎬 LibTV 生成视频'}
        </button>

        {/* Real-time Progress */}
        {generating && (
          <div className="bg-dark-card rounded-xl border border-dark-border p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Loader2 size={16} className="animate-spin text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-200">
                    {progressMsg}
                  </span>
                </div>
                <div className="w-full h-2 bg-dark-bg rounded-full overflow-hidden mt-2">
                  <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500 animate-pulse" style={{ width: '35%' }} />
                </div>
                <p className="text-xs text-gray-600 mt-1">通常 30 秒~2 分钟完成，请勿关闭页面</p>
              </div>
            </div>
          </div>
        )}
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
          <span className="text-xs text-gray-500">{videos.length} 条</span>
        </div>

        {videos.length === 0 ? (
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {videos.map(vid => (
              <div
                key={vid.id}
                className={`group bg-dark-card rounded-xl border overflow-hidden transition-all hover:shadow-lg hover:shadow-purple-900/10 ${
                  videoDoneRef.current === vid.id
                    ? 'border-green-500/50 ring-1 ring-green-500/20'
                    : 'border-dark-border'
                }`}
              >
                {/* Video player */}
                <div className="relative">
                  {vid.videoUrl ? (
                    <video
                      src={vid.videoUrl}
                      controls
                      className="w-full aspect-video bg-black object-cover"
                      preload="metadata"
                    />
                  ) : (
                    <div className="w-full aspect-video bg-gradient-to-br from-dark-bg to-purple-950/20 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-12 h-12 mx-auto rounded-full bg-purple-500/10 flex items-center justify-center animate-pulse">
                          <Loader2 size={22} className="text-purple-400 animate-spin" />
                        </div>
                        <div className="space-y-1.5 mt-3">
                          <div className="h-2.5 w-28 bg-gray-700/50 rounded-full animate-pulse mx-auto" />
                          <div className="h-2 w-20 bg-gray-700/30 rounded-full animate-pulse mx-auto" />
                        </div>
                        <p className="text-xs text-gray-500 mt-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
                            AI 生成中...
                            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
                  {videoDoneRef.current === vid.id && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg">
                      <CheckCircle2 size={10} />
                      新完成
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium text-white/90 line-clamp-1">
                      {vid.subject || '未命名'}
                    </h4>
                  </div>

                  {vid.script && (
                    <p className="text-xs text-gray-500 line-clamp-2 mt-1.5 leading-relaxed">
                      {vid.script}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {vid.duration && (
                        <span className="text-[10px] text-gray-500 flex items-center gap-1 bg-dark-bg px-1.5 py-0.5 rounded">
                          <Clock size={9} /> {vid.duration}s
                        </span>
                      )}
                      {vid.createdAt && (
                        <span className="text-[10px] text-gray-600 flex items-center gap-1">
                          {new Date(vid.createdAt).toLocaleDateString('zh-CN', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {vid.videoUrl && (
                        <a
                          href={vid.videoUrl}
                          download
                          className="p-1.5 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 transition-all opacity-0 group-hover:opacity-100"
                          title="下载视频"
                        >
                          <Download size={13} />
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteVideo(vid.id)}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                        title="删除"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Publish */}
                  <div className="mt-3">
                    <PublishSection text={vid.subject || vid.script || ''} mediaUrl={vid.videoUrl} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

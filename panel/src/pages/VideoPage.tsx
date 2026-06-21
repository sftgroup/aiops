import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../AuthContext';
import toast from 'react-hot-toast';
import { Loader2, Sparkles, Video, Play, Clock } from 'lucide-react';
import PublishSection from '../components/PublishSection';

interface VideoItem {
  id: string;
  subject: string;
  script: string;
  videoUrl: string;
  createdAt: string;
}

export default function VideoPage() {
  const { token } = useAuth();
  const [subject, setSubject] = useState('');
  const [script, setScript] = useState('');
  const [generatingScript, setGeneratingScript] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);

  useEffect(() => {
    loadVideos();
  }, [token]);

  const loadVideos = async () => {
    try {
      const t = await api(token!).get('/team-tasks/today');
      if (t?.videos) setVideos(t.videos);
    } catch { /* ignore */ }
    setLoadingVideos(false);
  };

  const handleGenerateScript = async () => {
    if (!subject) return toast.error('请输入视频主题');
    setGeneratingScript(true);
    try {
      const d = await api(token!).post('/videos/scripts', { subject });
      setScript(d.script);
      toast.success('文案生成成功');
    } catch (e: any) { toast.error(e.message); }
    finally { setGeneratingScript(false); }
  };

  const handleGenerateVideo = async () => {
    if (!subject) return toast.error('请输入视频主题');
    setGenerating(true);
    try {
      const d = await api(token!).post('/team-tasks/today/video', {
        subject, script,
      });
      toast.success('LibTV 视频生成中...');

      const poll = setInterval(async () => {
        try {
          const t = await api(token!).get('/team-tasks/today');
          const vid = t?.videos?.find((v: any) => v.id === d.id);
          if (vid?.videoUrl) {
            clearInterval(poll);
            setVideos(t.videos);
            toast.success('🎬 视频生成完成！');
            setGenerating(false);
          }
          if (vid?.videoUrl === '' || vid?.videoUrl === null) {
            // still generating
          }
        } catch { clearInterval(poll); setGenerating(false); }
      }, 5000);

      setTimeout(() => { clearInterval(poll); setGenerating(false); loadVideos(); }, 600000);

    } catch (e: any) { toast.error(e.message); setGenerating(false); }
  };

  if (loadingVideos) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-gray-400" /></div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">🎬 视频制作</h2>

      <div className="space-y-4 mb-8">
          {/* Video Subject */}
          <div className="bg-dark-card rounded-xl p-5 border border-dark-border space-y-3">
            <h3 className="font-semibold">视频主题</h3>
            <input
              className="w-full px-3 py-2.5 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="例如：AI 改变生活"
            />
          </div>

          {/* Script / Prompt */}
          <div className="bg-dark-card rounded-xl p-5 border border-dark-border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">视频文案 / 提示词</h3>
              <button
                onClick={handleGenerateScript}
                disabled={generatingScript || !subject}
                className="text-xs text-accent-primary hover:underline disabled:opacity-50 flex items-center gap-1"
              >
                {generatingScript ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {generatingScript ? '生成中...' : 'AI 生成文案'}
              </button>
            </div>
            <textarea
              className="w-full px-3 py-2.5 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none h-40 resize-none"
              value={script}
              onChange={e => setScript(e.target.value)}
              placeholder="AI 自动生成或手动输入提示词。LibTV 会根据文案生成匹配视频..."
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerateVideo}
            disabled={generating || !subject}
            className="flex items-center justify-center gap-2 w-full py-3 bg-accent-primary hover:bg-accent-primary/80 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
            {generating ? '生成中...' : '🎬 LibTV 生成视频'}
          </button>

          {generating && (
            <div className="text-center text-sm text-yellow-400 py-4 bg-dark-card rounded-lg border border-dark-border">
              <Loader2 size={20} className="animate-spin mx-auto mb-2" />
              <p>视频生成中，请稍候...</p>
              <p className="text-xs text-gray-500 mt-1">通常 30 秒~2 分钟完成</p>
            </div>
          )}
        </div>

      {/* Video List / Gallery */}
      <div className="mt-8">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Video size={18} /> 已生成的视频
          <span className="text-xs text-gray-500 font-normal">({videos.length} 条)</span>
        </h3>

        {videos.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-dark-card rounded-xl border border-dark-border">
            <Video size={48} className="mx-auto mb-3 opacity-30" />
            <p>还没有视频，输入主题生成吧</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {videos.map(vid => (
              <div key={vid.id} className="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
                {vid.videoUrl ? (
                  <video src={vid.videoUrl} controls className="w-full aspect-video bg-black" />
                ) : (
                  <div className="w-full aspect-video bg-dark-bg flex items-center justify-center">
                    <Video size={40} className="text-gray-700" />
                  </div>
                )}
                <div className="p-3">
                  <h4 className="text-sm font-medium truncate">{vid.subject || '未命名'}</h4>
                  {vid.script && <p className="text-xs text-gray-500 line-clamp-2 mt-1">{vid.script}</p>}
                  {vid.createdAt && (
                    <p className="text-[10px] text-gray-600 mt-2 flex items-center gap-1">
                      <Clock size={10} /> {new Date(vid.createdAt).toLocaleString('zh-CN')}
                    </p>
                  )}
                  <PublishSection text={vid.subject || vid.script || ''} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

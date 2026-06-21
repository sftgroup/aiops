import React, { useState, useEffect, useRef } from 'react';
import { useAuth, api } from '../AuthContext';
import toast from 'react-hot-toast';
import {
  Play, CheckCircle2, XCircle, Loader2, Users, FileText, Video,
  Send, Settings, ThumbsUp, ThumbsDown, PauseCircle, Layers
} from 'lucide-react';
import TeamWorkflowConfig from '../components/TeamWorkflowConfig';
import TeamProgressBar from '../components/TeamProgressBar';
import ReviewPanel from '../components/ReviewPanel';
import PublishLog from '../components/PublishLog';

interface TeamTask {
  _id: string; date: string; subject: string;
  config: { articles: number; videos: number; publishTargets: Record<string, boolean>; publishAccounts: Record<string, string[]>; schedule: { publishAt: string; intervalMinutes: number } };
  articles: ArticleItem[]; videos: VideoItem[]; publishLog: any[];
  progress: Record<string, string>;
  status: 'idle' | 'running' | 'done';
  stitchedVideoUrl?: string;
}

interface ArticleItem {
  id: string; title: string; body: string; imageUrl: string;
  platformVariants: Record<string, string>;
  review: { status: 'pending' | 'pass' | 'reject'; reason: string };
  publishedTo: string[]; createdAt: string;
}

interface VideoItem {
  id: string; subject: string; script: string; videoUrl: string;
  platformVariants: Record<string, string>;
  review: { status: 'pending' | 'pass' | 'reject'; reason: string };
  publishedTo: string[]; createdAt: string;
}

export default function TeamWorkflowPage() {
  const { token } = useAuth();
  const [task, setTask] = useState<TeamTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [publishing, setPublishing] = useState(false);

  // Config form fields
  const [subject, setSubject] = useState('');
  const [articleCount, setArticleCount] = useState(3);
  const [videoCount, setVideoCount] = useState(2);
  const [publishTargets, setPublishTargets] = useState<Record<string, boolean>>({});
  const [publishAccounts, setPublishAccounts] = useState<Record<string, string[]>>({});
  const [publishAt, setPublishAt] = useState('');
  const [intervalMinutes, setIntervalMinutes] = useState(5);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const publishPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadTask = async () => {
    try {
      const [t, accs] = await Promise.all([
        api(token!).get('/team-tasks/today'),
        api(token!).get('/accounts'),
      ]);
      setTask(t);
      setAccounts(accs || []);
      setSubject(t.subject || '');
      setArticleCount(t.config?.articles || 3);
      setVideoCount(t.config?.videos || 2);
      setPublishTargets(t.config?.publishTargets || {});
      setPublishAccounts(t.config?.publishAccounts || {});
      setPublishAt(t.config?.schedule?.publishAt || '');
      setIntervalMinutes(t.config?.schedule?.intervalMinutes || 5);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadTask(); }, [token]);

  // Polling for progress updates (FE-02: properly cleanup on unmount and when done)
  useEffect(() => {
    if (!task || task.status !== 'running') return;

    const poll = setInterval(async () => {
      try {
        const t = await api(token!).get(`/team-tasks/${task._id}`);
        setTask(t);
        if (t.status === 'done') {
          clearInterval(poll);
          if (pollRef.current === poll) pollRef.current = null;
          toast.success('✅ 全部生成完成！');
        }
      } catch { /* ignore */ }
    }, 3000);
    pollRef.current = poll;

    return () => {
      clearInterval(poll);
      if (pollRef.current === poll) pollRef.current = null;
    };
  }, [task?._id, task?.status, token]);

  const clearPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const clearPublishPoll = () => {
    if (publishPollRef.current) {
      clearInterval(publishPollRef.current);
      publishPollRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPoll();
      clearPublishPoll();
    };
  }, []);

  const saveConfig = async () => {
    if (!task) return;
    if (!subject) return toast.error('请输入今日主题');
    try {
      const updated = await api(token!).post(`/team-tasks/${task._id}/config`, {
        subject, articles: articleCount, videos: videoCount,
        publishTargets, publishAccounts,
        schedule: { publishAt, intervalMinutes },
      });
      setTask(updated);
      setShowConfig(false);
      toast.success('配置已保存！');
    } catch (e: any) { toast.error(e.message); }
  };

  const runTask = async () => {
    if (!task) return;
    try {
      await api(token!).post(`/team-tasks/${task._id}/run`);
      toast.success('🏢 团队已开工！');
      const t = await api(token!).get(`/team-tasks/${task._id}`);
      setTask(t);
    } catch (e: any) { toast.error(e.message); }
  };

  const stopTask = async () => {
    if (!task) return;
    try {
      await api(token!).post(`/team-tasks/${task._id}/stop`);
      toast.success('⏹️ 已停止');
      const t = await api(token!).get(`/team-tasks/${task._id}`);
      setTask(t);
    } catch (e: any) { toast.error(e.message); }
  };

  const reviewBatch = async (action: 'approve' | 'reject') => {
    if (!task) return;
    const pendArts = task.articles.filter(a => a.review.status === 'pending').map(a => a.id);
    const pendVids = task.videos.filter(v => v.review.status === 'pending').map(v => v.id);
    if (pendArts.length === 0 && pendVids.length === 0) return toast('没有待审核内容');
    try {
      await api(token!).post(`/team-tasks/${task._id}/review`, {
        action, articleIds: pendArts, videoIds: pendVids,
      });
      const t = await api(token!).get(`/team-tasks/${task._id}`);
      setTask(t);
      toast.success(action === 'approve' ? `全部通过 ${pendArts.length + pendVids.length} 条` : `已打回 ${pendArts.length + pendVids.length} 条`);
    } catch (e: any) { toast.error(e.message); }
  };

  const publishAll = async () => {
    if (!task) return;
    setPublishing(true);
    try {
      const r = await api(token!).post(`/team-tasks/${task._id}/publish`);
      toast.success(`发布队列已构建！共 ${r.total} 条，间隔 ${intervalMinutes} 分钟`);
      // Start polling for progress with ref tracking
      const poll = setInterval(async () => {
        try {
          const t = await api(token!).get(`/team-tasks/${task._id}`);
          setTask(t);
          const prog = t.progress?.publisher || '';
          const progParts = prog.match(/发中 (\d+)\/(\d+)/);
          if (!progParts && t.publishLog?.length > 0) {
            const done = t.publishLog.filter((l: any) => l.status === 'done').length;
            const fail = t.publishLog.filter((l: any) => l.status === 'fail').length;
            if (done + fail > 0) {
              toast(`发完 ${done} 条，失败 ${fail} 条`);
              clearInterval(poll);
              if (publishPollRef.current === poll) publishPollRef.current = null;
              setPublishing(false);
            }
          }
        } catch {
          clearInterval(poll);
          if (publishPollRef.current === poll) publishPollRef.current = null;
          setPublishing(false);
        }
      }, 10000);
      publishPollRef.current = poll;
    } catch (e: any) { toast.error(e.message); setPublishing(false); }
  };

  const reviewItem = async (type: 'article' | 'video', id: string, action: 'approve' | 'reject') => {
    if (!task) return;
    const ids = type === 'article' ? { articleIds: [id] } : { videoIds: [id] };
    try {
      await api(token!).post(`/team-tasks/${task._id}/review`, { action, ...ids });
      const t = await api(token!).get(`/team-tasks/${task._id}`);
      setTask(t);
      toast.success(action === 'approve' ? '已通过' : '已打回');
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-gray-400" /></div>;

  // Computed values
  const pendArts = task?.articles.filter(a => a.review.status === 'pending') || [];
  const passArts = task?.articles.filter(a => a.review.status === 'pass') || [];
  const pendVids = task?.videos.filter(v => v.review.status === 'pending') || [];
  const passVids = task?.videos.filter(v => v.review.status === 'pass') || [];
  const isRunning = task?.status === 'running';

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Users size={24} /> 虚拟团队
        <span className="text-sm font-normal text-gray-500 ml-2">{task?.date}</span>
        {task?.subject && <span className="text-sm font-normal text-accent-primary ml-1">· {task.subject}</span>}
      </h2>

      {/* ========== Progress Bars Section ========== */}
      {task && <TeamProgressBar progress={task.progress} />}

      {/* ========== Config Section ========== */}
      {(showConfig || !task?.subject) && task && (
        <TeamWorkflowConfig
          subject={subject}
          onSubjectChange={setSubject}
          articleCount={articleCount}
          onArticleCountChange={setArticleCount}
          videoCount={videoCount}
          onVideoCountChange={setVideoCount}
          publishTargets={publishTargets}
          onPublishTargetsChange={setPublishTargets}
          publishAccounts={publishAccounts}
          onPublishAccountsChange={setPublishAccounts}
          publishAt={publishAt}
          onPublishAtChange={setPublishAt}
          intervalMinutes={intervalMinutes}
          onIntervalMinutesChange={setIntervalMinutes}
          accounts={accounts}
          onSave={saveConfig}
          onClose={() => setShowConfig(false)}
          hasSubject={!!task?.subject}
        />
      )}

      {!showConfig && task?.subject && (
        <button onClick={() => setShowConfig(true)} className="text-sm text-gray-400 hover:text-white mb-4 flex items-center gap-1">
          <Settings size={14} /> 修改今日配置
        </button>
      )}

      {/* ========== Action Buttons ========== */}
      {task?.subject && (
        <div className="flex gap-3 mb-6 flex-wrap">
          {(task.status === 'idle' || task.status === 'done') && task.articles.length === 0 && (
            <button onClick={runTask}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent-primary/50 hover:bg-accent-primary/70 rounded-lg text-sm transition-colors">
              <Play size={16} /> 🏢 让团队开工！
            </button>
          )}
          {(task.status === 'idle' || task.status === 'done') && task.articles.length > 0 && (
            <button onClick={runTask}
              className="flex items-center gap-2 px-5 py-2.5 bg-yellow-500/30 hover:bg-yellow-500/50 rounded-lg text-sm transition-colors">
              <Play size={16} /> 🔄 重新生成
            </button>
          )}
          {task.status === 'running' && (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 text-sm text-yellow-400">
                <Loader2 size={16} className="animate-spin" /> 团队工作中...
              </span>
              <button onClick={stopTask}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg text-xs transition-colors">
                <PauseCircle size={14} /> 停止
              </button>
            </div>
          )}
          {task.status === 'done' && (
            <>
              {/* Batch review buttons */}
              {(pendArts.length > 0 || pendVids.length > 0) && (
                <div className="flex gap-2">
                  <button onClick={() => reviewBatch('approve')}
                    className="flex items-center gap-1 px-4 py-2 bg-green-500/20 hover:bg-green-500/40 rounded-lg text-sm transition-colors">
                    <ThumbsUp size={14} /> 批量通过 ({pendArts.length + pendVids.length})
                  </button>
                  <button onClick={() => reviewBatch('reject')}
                    className="flex items-center gap-1 px-4 py-2 bg-red-500/20 hover:bg-red-500/40 rounded-lg text-sm transition-colors">
                    <ThumbsDown size={14} /> 批量打回
                  </button>
                </div>
              )}
              {/* Publish button */}
              {passArts.length + passVids.length > 0 && !publishing && (
                <button onClick={publishAll}
                  className="flex items-center gap-2 px-5 py-2.5 bg-green-500/30 hover:bg-green-500/50 rounded-lg text-sm transition-colors">
                  <Send size={16} /> 📤 发布通过内容 ({passArts.length + passVids.length} 条)
                </button>
              )}
              {publishing && (
                <span className="flex items-center gap-2 text-sm text-blue-400">
                  <Loader2 size={16} className="animate-spin" /> 发布中（间隔 {intervalMinutes} 分钟）...
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* ========== Content Grid (done state) ========== */}
      {task?.status === 'done' && (
        <>
          {/* Stitched Video */}
          {task.stitchedVideoUrl && (
            <div className="mb-6 bg-dark-card rounded-xl p-4 border border-accent-primary/30">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-accent-primary">
                <Layers size={16} /> 拼接完成视频
                <span className="text-xs text-gray-500 font-normal ml-2">({task.videos.length}段合成)</span>
              </h3>
              <video src={task.stitchedVideoUrl} controls className="w-full max-w-2xl rounded-lg bg-black" />
            </div>
          )}

          <ReviewPanel
            articles={task.articles}
            videos={task.videos}
            onReviewBatch={reviewBatch}
            onReviewItem={reviewItem}
            pendingArticles={pendArts}
            passedArticles={passArts}
            pendingVideos={pendVids}
            passedVideos={passVids}
            onPublishAll={publishAll}
            publishing={publishing}
            intervalMinutes={intervalMinutes}
          />
        </>
      )}

      {/* ========== Publish Log ========== */}
      {task && <PublishLog logs={task.publishLog} />}

      {/* Empty state */}
      {(!task?.subject || task.articles.length === 0) && (
        <div className="text-center py-12 text-gray-500">
          <Users size={48} className="mx-auto mb-3 opacity-30" />
          <p className="mb-2">配置好今日主题和产量，让 AI 团队开工</p>
          <p className="text-xs">文案·配图·视频·审核·发布 · 全自动流水线</p>
        </div>
      )}
    </div>
  );
}

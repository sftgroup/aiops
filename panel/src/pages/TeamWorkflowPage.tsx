import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../AuthContext';
import toast from 'react-hot-toast';
import {
  Play, CheckCircle2, XCircle, Loader2, Users, FileText, Video,
  Send, Settings, ThumbsUp, ThumbsDown, Clock, Globe, ChevronDown, ChevronUp,
  UserCheck, Copy, Image, Eye, Smartphone, Layers, PauseCircle
} from 'lucide-react';

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

const EMPLOYEES = [
  { key: 'copywriter', icon: Copy, label: '文案员工', color: 'bg-blue-500', desc: 'DeepSeek 生成图文' },
  { key: 'imagegen', icon: Image, label: '配图员工', color: 'bg-purple-500', desc: 'LibTV AI 配图' },
  { key: 'videomaker', icon: Video, label: '视频员工', color: 'bg-orange-500', desc: 'Seedance 短视频' },
  { key: 'stitcher', icon: Layers, label: '拼接员工', color: 'bg-pink-500', desc: '多段合成长视频' },
  { key: 'reviewer', icon: Eye, label: '审核员工', color: 'bg-teal-500', desc: 'AI 内容审核' },
  { key: 'publisher', icon: Send, label: '发布员工', color: 'bg-green-500', desc: '排程+多账号发布' },
];

const PLATFORM_META: Record<string, { label: string; color: string; icon: string }> = {
  twitter: { label: 'Twitter/X', color: '#1DA1F2', icon: '𝕏' },
  facebook: { label: 'Facebook', color: '#1877F2', icon: 'f' },
  youtube: { label: 'YouTube', color: '#FF0000', icon: '▶' },
  reddit: { label: 'Reddit', color: '#FF4500', icon: 'r' },
};

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

  // Polling for progress updates
  useEffect(() => {
    if (!task || task.status !== 'running') return;
    const poll = setInterval(async () => {
      try {
        const t = await api(token!).get(`/team-tasks/${task._id}`);
        setTask(t);
        if (t.status === 'done') {
          clearInterval(poll);
          toast.success('✅ 全部生成完成！');
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(poll);
  }, [task?._id, task?.status, token]);

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
      // Polling handled by useEffect
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

  const toggleAccount = (platform: string, accountId: string) => {
    setPublishAccounts(prev => {
      const current = prev[platform] || [];
      const next = current.includes(accountId)
        ? current.filter(id => id !== accountId)
        : [...current, accountId];
      return { ...prev, [platform]: next };
    });
  };

  const publishAll = async () => {
    if (!task) return;
    setPublishing(true);
    try {
      const r = await api(token!).post(`/team-tasks/${task._id}/publish`);
      toast.success(`发布队列已构建！共 ${r.total} 条，间隔 ${intervalMinutes} 分钟`);
      // Start polling for progress
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
              setPublishing(false);
            }
          }
        } catch { clearInterval(poll); setPublishing(false); }
      }, 10000);
    } catch (e: any) { toast.error(e.message); setPublishing(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-gray-400" /></div>;

  // Computed values
  const pendArts = task?.articles.filter(a => a.review.status === 'pending') || [];
  const passArts = task?.articles.filter(a => a.review.status === 'pass') || [];
  const pendVids = task?.videos.filter(v => v.review.status === 'pending') || [];
  const passVids = task?.videos.filter(v => v.review.status === 'pass') || [];
  const isRunning = task?.status === 'running';

  const progValue = (key: string): number => {
    if (!task?.progress) return 0;
    const v = task.progress[key] || 'idle';
    if (v === 'done' || v === 'skip') return 100;
    if (v === 'running') return 50;
    if (typeof v === 'string' && v.startsWith('发中')) return 70;
    return 0;
  };

  const progLabel = (key: string) => {
    if (!task?.progress) return '⏸️ 待开始';
    const v = task.progress[key] || 'idle';
    const m: Record<string, string> = {
      idle: '⏸️ 待开始', pending: '⏳ 排队中', running: '🔄 工作中',
      done: '✅ 已完成', skip: '⏭️ 已跳过',
    };
    return m[v] || v;
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Users size={24} /> 虚拟团队
        <span className="text-sm font-normal text-gray-500 ml-2">{task?.date}</span>
        {task?.subject && <span className="text-sm font-normal text-accent-primary ml-1">· {task.subject}</span>}
      </h2>

      {/* ========== Progress Bars Section ========== */}
      {task?.subject && (
        <div className="bg-dark-card rounded-xl p-4 border border-dark-border mb-6">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Layers size={14} /> 团队进度
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {EMPLOYEES.map(emp => {
              const val = progValue(emp.key);
              const label = progLabel(emp.key);
              return (
                <div key={emp.key} className="bg-dark-bg rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <emp.icon size={14} className="text-gray-400" />
                    <span className="text-xs font-medium">{emp.label}</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-1">
                    <div className={`h-full rounded-full transition-all duration-500 ${emp.color}`}
                      style={{ width: val + '%' }} />
                  </div>
                  <div className={`text-[10px] ${val === 100 ? 'text-green-400' : val > 0 ? 'text-yellow-400' : 'text-gray-600'}`}>
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========== Config Section ========== */}
      {(showConfig || !task?.subject) && (
        <div className="bg-dark-card rounded-xl p-5 border border-dark-border mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Settings size={16} /> 今日配置</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">📝 今日主题</label>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="例如：AI 与未来生活" className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400 block mb-1">📄 图文篇数</label>
                <select value={articleCount} onChange={e => setArticleCount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm">
                  {[0,1,2,3,5,10].map(n => <option key={n} value={n}>{n} 篇</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">🎬 短视频条数</label>
                <select value={videoCount} onChange={e => setVideoCount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm">
                  {[0,1,2,3,5].map(n => <option key={n} value={n}>{n} 条</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Publish Targets: Platform + Account Selection */}
          <div className="mt-4">
            <label className="text-sm text-gray-400 block mb-2">📤 发布到以下平台 + 选择账号</label>
            <div className="space-y-2">
              {Object.entries(PLATFORM_META).map(([pk, pv]) => {
                const enabled = publishTargets[pk] || false;
                const platAccounts = accounts.filter(a => a.platform?.toLowerCase() === pk);
                const selectedIds = publishAccounts[pk] || [];
                return (
                  <div key={pk} className={`rounded-lg border ${enabled ? 'border-accent-primary/30 bg-accent-primary/5' : 'border-dark-border bg-dark-bg'} transition-colors`}>
                    <label className="flex items-center gap-2 px-3 py-2 cursor-pointer">
                      <input type="checkbox" checked={enabled}
                        onChange={() => setPublishTargets(p => ({ ...p, [pk]: !p[pk] }))}
                        className="form-checkbox accent-accent-primary" />
                      <span className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold"
                        style={{ background: pv.color, color: '#fff' }}>{pv.icon}</span>
                      <span className="text-sm font-medium">{pv.label}</span>
                      <span className="text-xs text-gray-500">
                        {platAccounts.length > 0 ? `${platAccounts.length} 个账号` : '未绑定'}
                      </span>
                      {enabled && selectedIds.length > 0 && (
                        <span className="text-xs text-green-400">已选 {selectedIds.length} 个</span>
                      )}
                    </label>
                    {/* Account sub-list */}
                    {enabled && platAccounts.length > 0 && (
                      <div className="px-3 pb-2 pt-0 flex flex-wrap gap-1.5 border-t border-dark-border/50 mt-0">
                        {platAccounts.map(acc => {
                          const accId = acc._id || acc.id;
                          const selected = selectedIds.includes(accId);
                          return (
                            <label key={accId}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer border transition-colors
                                ${selected ? 'bg-accent-primary/20 border-accent-primary/40 text-accent-primary' : 'bg-dark-card border-dark-border text-gray-500 hover:border-gray-500'}`}>
                              <input type="checkbox" checked={selected}
                                onChange={() => toggleAccount(pk, accId)}
                                className="hidden" />
                              <span>{acc.screenName || acc.username || '#' + accId.slice(-6)}</span>
                              {selected && <UserCheck size={12} />}
                            </label>
                          );
                        })}
                        {/* Select all / None */}
                        {platAccounts.length > 1 && (
                          <div className="flex gap-1 items-center">
                            <button onClick={() => setPublishAccounts(prev => ({ ...prev, [pk]: platAccounts.map((a: any) => a._id || a.id) }))}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-dark-card border border-dark-border text-gray-600 hover:text-gray-400">
                              全选
                            </button>
                            <button onClick={() => setPublishAccounts(prev => ({ ...prev, [pk]: [] }))}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-dark-card border border-dark-border text-gray-600 hover:text-gray-400">
                              清空
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scheduling */}
          <div className="mt-4 p-3 bg-dark-bg rounded-lg border border-dark-border">
            <label className="text-sm text-gray-400 block mb-2 flex items-center gap-1">
              <Clock size={14} /> 定时发布
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">开始时间</label>
                <input type="datetime-local" value={publishAt}
                  onChange={e => setPublishAt(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">间隔分钟</label>
                <select value={intervalMinutes} onChange={e => setIntervalMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-sm">
                  {[0,1,2,5,10,15,20,30,60].map(n => (
                    <option key={n} value={n}>{n === 0 ? '同时发' : n + ' 分钟'}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-[10px] text-gray-600 mt-1">💡 多条内容按间隔错开发布，避免被平台判为垃圾</p>
          </div>

          <div className="flex gap-3 mt-5">
            <button onClick={saveConfig} className="px-5 py-2.5 bg-accent-primary/50 hover:bg-accent-primary/70 rounded-lg text-sm transition-colors">
              保存配置
            </button>
            {task?.subject && <button onClick={() => setShowConfig(false)} className="px-5 py-2.5 bg-dark-border hover:bg-dark-hover rounded-lg text-sm transition-colors">收起配置</button>}
          </div>
        </div>
      )}

      {!showConfig && task?.subject && (
        <button onClick={() => setShowConfig(true)} className="text-sm text-gray-400 hover:text-white mb-4 flex items-center gap-1">
          <Settings size={14} /> 修改今日配置
        </button>
      )}

      {/* ========== Action Buttons ========== */}
      {task?.subject && (
        <div className="flex gap-3 mb-6">
          {!isRunning && task.articles.length === 0 && (
            <button onClick={runTask} disabled={isRunning}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent-primary/50 hover:bg-accent-primary/70 rounded-lg text-sm transition-colors disabled:opacity-50">
              {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              🏢 让团队开工！
            </button>
          )}
          {isRunning && (
            <span className="flex items-center gap-2 text-sm text-yellow-400">
              <Loader2 size={16} className="animate-spin" /> 团队工作中...
            </span>
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

      {/* ========== Content Grid ========== */}
      {task?.status === 'done' && (
        <div className="space-y-6">
          {/* Articles */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FileText size={16} /> 图文内容
              <span className="text-xs text-gray-500 font-normal">({task.articles.length}篇)</span>
              {pendArts.length > 0 && <span className="text-xs text-yellow-400 font-normal">待审{pendArts.length}</span>}
              {passArts.length > 0 && <span className="text-xs text-green-400 font-normal">已过{passArts.length}</span>}
            </h3>
            <div className="grid gap-3">
              {task.articles.map(art => (
                <div key={art.id} className="bg-dark-card rounded-xl p-4 border border-dark-border">
                  <div className="flex items-start gap-4">
                    {art.imageUrl && (
                      <img src={art.imageUrl} alt="" className="w-20 h-20 rounded-lg object-cover shrink-0 bg-dark-bg" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{art.title}</h4>
                        {art.review.status === 'pass' && <CheckCircle2 size={14} className="text-accent-success shrink-0" />}
                        {art.review.status === 'reject' && <XCircle size={14} className="text-red-400 shrink-0" />}
                        {art.review.status === 'pending' && <Loader2 size={14} className="animate-spin text-yellow-400 shrink-0" />}
                        {art.publishedTo.length > 0 && <Send size={14} className="text-blue-400 shrink-0" />}
                      </div>
                      <p className="text-sm text-gray-400 line-clamp-2">{art.body}</p>

                      {/* Platform variants + Published accounts */}
                      {Object.keys(art.platformVariants).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {Object.entries(art.platformVariants).map(([p, t]) => (
                            <span key={p} title={t} className="text-xs px-2 py-0.5 rounded bg-dark-bg text-gray-500 flex items-center gap-1 max-w-[200px] truncate">
                              <Globe size={10} /> {p}: {t.slice(0, 40)}...
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Published to */}
                      {art.publishedTo.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          <span className="text-[10px] text-blue-400">已发布:</span>
                          {art.publishedTo.map((s: string, i: number) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded">{s}</span>
                          ))}
                        </div>
                      )}

                      {/* Review controls */}
                      {art.review.status === 'pending' && (
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => reviewItem('article', art.id, 'approve')}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/40 rounded-lg text-xs transition-colors">
                            <ThumbsUp size={12} /> 通过
                          </button>
                          <button onClick={() => reviewItem('article', art.id, 'reject')}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/40 rounded-lg text-xs transition-colors">
                            <ThumbsDown size={12} /> 打回
                          </button>
                        </div>
                      )}
                      {art.review.status === 'reject' && art.review.reason && (
                        <p className="text-xs text-red-400 mt-2">原因：{art.review.reason}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

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

      {/* Videos */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Video size={16} /> 视频内容
              <span className="text-xs text-gray-500 font-normal">({task.videos.length}条)</span>
              {pendVids.length > 0 && <span className="text-xs text-yellow-400 font-normal">待审{pendVids.length}</span>}
              {passVids.length > 0 && <span className="text-xs text-green-400 font-normal">已过{passVids.length}</span>}
            </h3>
            <div className="grid gap-3">
              {task.videos.map(vid => (
                <div key={vid.id} className="bg-dark-card rounded-xl p-4 border border-dark-border">
                  <div className="flex items-start gap-4">
                    {vid.videoUrl ? (
                      <video src={vid.videoUrl} controls className="w-28 h-20 rounded-lg object-cover shrink-0 bg-dark-bg" />
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-dark-bg flex items-center justify-center shrink-0">
                        <Video size={24} className="text-gray-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{vid.subject}</h4>
                        {vid.review.status === 'pass' && <CheckCircle2 size={14} className="text-accent-success shrink-0" />}
                        {vid.review.status === 'reject' && <XCircle size={14} className="text-red-400 shrink-0" />}
                        {vid.review.status === 'pending' && <Loader2 size={14} className="animate-spin text-yellow-400 shrink-0" />}
                        {vid.publishedTo.length > 0 && <Send size={14} className="text-blue-400 shrink-0" />}
                      </div>
                      {vid.script && <p className="text-sm text-gray-400 line-clamp-2">{vid.script}</p>}

                      {vid.review.status === 'pending' && (
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => reviewItem('video', vid.id, 'approve')}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/40 rounded-lg text-xs transition-colors">
                            <ThumbsUp size={12} /> 通过
                          </button>
                          <button onClick={() => reviewItem('video', vid.id, 'reject')}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/40 rounded-lg text-xs transition-colors">
                            <ThumbsDown size={12} /> 打回
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========== Publish Log ========== */}
      {task?.publishLog && task.publishLog.length > 0 && (
        <div className="mt-6 bg-dark-card rounded-xl p-4 border border-dark-border">
          <h3 className="font-semibold mb-2 text-sm">📋 发布记录</h3>
          <div className="space-y-1">
            {task.publishLog.slice(-10).reverse().map((log: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-dark-border/50 last:border-0">
                {log.status === 'done' ? <CheckCircle2 size={12} className="text-green-400 shrink-0" /> :
                 log.status === 'fail' ? <XCircle size={12} className="text-red-400 shrink-0" /> :
                 <Clock size={12} className="text-yellow-400 shrink-0" />}
                <span className="text-gray-400">{log.type}</span>
                <span className="text-gray-500">{log.platform}</span>
                {log.account && <span className="text-gray-600">@{log.account}</span>}
                <span className={`${log.status === 'done' ? 'text-green-400' : log.status === 'fail' ? 'text-red-400' : 'text-yellow-400'}`}>
                  {log.status === 'done' ? '✅' : log.status === 'fail' ? `❌ ${log.error?.slice(0, 60)}` : '⏳'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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

  // Helper for single item review (used in the content grid)
  async function reviewItem(type: 'article' | 'video', id: string, action: 'approve' | 'reject') {
    if (!task) return;
    const ids = type === 'article' ? { articleIds: [id] } : { videoIds: [id] };
    try {
      await api(token!).post(`/team-tasks/${task._id}/review`, { action, ...ids });
      const t = await api(token!).get(`/team-tasks/${task._id}`);
      setTask(t);
      toast.success(action === 'approve' ? '已通过' : '已打回');
    } catch (e: any) { toast.error(e.message); }
  }
}

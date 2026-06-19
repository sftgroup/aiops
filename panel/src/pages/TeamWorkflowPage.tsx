import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../AuthContext';
import toast from 'react-hot-toast';
import {
  Play, CheckCircle2, XCircle, Loader2, Users, FileText, Video,
  Send, Settings, AlertTriangle, ThumbsUp, ThumbsDown, RefreshCw,
  ExternalLink, Image, Globe
} from 'lucide-react';

interface TeamTask {
  _id: string;
  date: string;
  subject: string;
  config: { articles: number; videos: number; publishTargets: Record<string, boolean> };
  articles: ArticleItem[];
  videos: VideoItem[];
  publishLog: any[];
  status: 'idle' | 'running' | 'done';
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

  // Config form
  const [subject, setSubject] = useState('');
  const [articleCount, setArticleCount] = useState(3);
  const [videoCount, setVideoCount] = useState(2);
  const [publishTargets, setPublishTargets] = useState<Record<string, boolean>>({});

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
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadTask(); }, [token]);

  const saveConfig = async () => {
    if (!task) return;
    if (!subject) return toast.error('请输入今日主题');
    try {
      const updated = await api(token!).post(`/team-tasks/${task._id}/config`, {
        subject, articles: articleCount, videos: videoCount, publishTargets
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
      toast.success('🏢 团队已开工！生成需要一些时间...');
      // Poll for completion
      let tries = 0;
      const poll = setInterval(async () => {
        try {
          const t = await api(token!).get(`/team-tasks/${task._id}`);
          if (t.status === 'done') {
            setTask(t);
            clearInterval(poll);
            toast.success('✅ 全部生成完成！');
          }
          tries++;
          if (tries > 30) { clearInterval(poll); toast.error('生成超时'); }
        } catch { tries++; if (tries > 30) clearInterval(poll); }
      }, 5000);
    } catch (e: any) { toast.error(e.message); }
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

  const publishAll = async () => {
    if (!task) return;
    try {
      const r = await api(token!).post(`/team-tasks/${task._id}/publish`);
      const t = await api(token!).get(`/team-tasks/${task._id}`);
      setTask(t);
      toast.success(`发布完成！已发 ${r.log?.filter((l: any) => l.status === 'done').length || 0} 条`);
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-gray-400" /></div>;

  const pendingArticles = task?.articles.filter(a => a.review.status === 'pending') || [];
  const approvedArticles = task?.articles.filter(a => a.review.status === 'pass') || [];
  const pendingVideos = task?.videos.filter(v => v.review.status === 'pending') || [];
  const approvedVideos = task?.videos.filter(v => v.review.status === 'pass') || [];

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Users size={24} /> 虚拟团队
        <span className="text-sm font-normal text-gray-500 ml-2">{task?.date}</span>
      </h2>

      {/* Config Section */}
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

          {/* Publish targets */}
          <div className="mt-4">
            <label className="text-sm text-gray-400 block mb-2">📤 发布到以下平台</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PLATFORM_META).map(([k, v]) => {
                const hasAccount = accounts.some(a => a.platform?.toLowerCase() === k);
                return (
                  <label key={k} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors
                    ${publishTargets[k] ? 'bg-accent-primary/20 border-accent-primary/30' : 'bg-dark-bg border-dark-border'}
                    ${!hasAccount ? 'opacity-50 cursor-not-allowed' : 'hover:bg-dark-hover'}`}>
                    <input type="checkbox" checked={publishTargets[k] || false}
                      onChange={() => setPublishTargets(p => ({ ...p, [k]: !p[k] }))}
                      disabled={!hasAccount} className="hidden" />
                    <span>{v.icon}</span>
                    <span>{v.label}</span>
                    {hasAccount ? <span className="text-xs text-green-400">✓</span> : <span className="text-xs text-gray-600">未绑定</span>}
                  </label>
                );
              })}
            </div>
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

      {/* Team Status */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`px-3 py-1.5 rounded-lg text-xs ${task?.status === 'done' ? 'bg-green-500/20 text-green-400' : task?.status === 'running' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}`}>
          {task?.status === 'done' ? '✅ 已完成' : task?.status === 'running' ? '⏳ 进行中' : '⏸️ 待开始'}
        </div>

        {task?.subject && <span className="text-sm text-gray-400">主题：{task.subject}</span>}
      </div>

      {/* Action Buttons */}
      {task?.subject && (
        <div className="flex gap-3 mb-6">
          {task.status !== 'running' && task.articles.length === 0 && (
            <button onClick={runTask} className="flex items-center gap-2 px-5 py-2.5 bg-accent-primary/50 hover:bg-accent-primary/70 rounded-lg text-sm transition-colors">
              <Play size={16} /> 🏢 让团队开工！
            </button>
          )}
          {task.status === 'done' && (approvedArticles.length > 0 || approvedVideos.length > 0) && (
            <button onClick={publishAll} className="flex items-center gap-2 px-5 py-2.5 bg-green-500/30 hover:bg-green-500/50 rounded-lg text-sm transition-colors">
              <Send size={16} /> 📤 发布已通过的内容 ({approvedArticles.length + approvedVideos.length})
            </button>
          )}
          {task.status === 'done' && pendingArticles.length === 0 && pendingVideos.length === 0 && approvedArticles.length === 0 && approvedVideos.length === 0 && (
            <p className="text-sm text-gray-500 italic">所有内容已审核或已发布，明天再接再厉 🎉</p>
          )}
        </div>
      )}

      {/* Content Grid */}
      {task?.status === 'done' && (
        <div className="space-y-6">
          {/* Articles Section */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FileText size={16} /> 图文内容
              <span className="text-xs text-gray-500 font-normal">({task.articles.length}篇)</span>
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
                      
                      {/* Platform variants */}
                      {Object.keys(art.platformVariants).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {Object.entries(art.platformVariants).map(([p, t]) => (
                            <span key={p} title={t.slice(0, 100)} className="text-xs px-2 py-0.5 rounded bg-dark-bg text-gray-500 flex items-center gap-1">
                              <Globe size={10} /> {p}: {t.slice(0, 30)}...
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Review actions */}
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
                      {art.publishedTo.length > 0 && (
                        <p className="text-xs text-blue-400 mt-2">已发布到：{art.publishedTo.join(', ')}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Videos Section */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Video size={16} /> 视频内容
              <span className="text-xs text-gray-500 font-normal">({task.videos.length}条)</span>
            </h3>
            <div className="grid gap-3">
              {task.videos.map(vid => (
                <div key={vid.id} className="bg-dark-card rounded-xl p-4 border border-dark-border">
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-20 rounded-lg bg-dark-bg flex items-center justify-center shrink-0">
                      <Video size={24} className="text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{vid.subject}</h4>
                        {vid.review.status === 'pass' && <CheckCircle2 size={14} className="text-accent-success shrink-0" />}
                        {vid.review.status === 'pending' && <Loader2 size={14} className="animate-spin text-yellow-400 shrink-0" />}
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

      {/* Publish Log */}
      {task?.publishLog && task.publishLog.length > 0 && (
        <div className="mt-6 bg-dark-card rounded-xl p-4 border border-dark-border">
          <h3 className="font-semibold mb-2 text-sm">📋 发布记录</h3>
          {task.publishLog.slice(-5).map((log: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-400 py-1">
              {log.status === 'done' ? <CheckCircle2 size={12} className="text-accent-success" /> : <XCircle size={12} className="text-red-400" />}
              <span>{log.type} → {log.platform || log.status}</span>
              {log.error && <span className="text-red-400">: {log.error.slice(0, 50)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

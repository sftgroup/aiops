import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../AuthContext';
import toast from 'react-hot-toast';
import { Plus, Play, Clock, CheckCircle, XCircle, Loader2, Trash2, GitBranch, Sparkles, Send, FileText, Video } from 'lucide-react';

interface WorkflowStep {
  type: 'script' | 'video' | 'publish';
  config: Record<string, any>;
}

interface Workflow {
  _id: string;
  name: string;
  subject: string;
  schedule: 'manual' | 'daily' | 'weekly';
  steps: WorkflowStep[];
  created_at: string;
  last_run?: string;
  last_status?: 'success' | 'failed' | 'running';
}

interface WorkflowRun {
  id: string;
  started_at: string;
  status: 'running' | 'success' | 'failed';
  steps: { type: string; status: string; message?: string }[];
}

const STEP_META: Record<string, { label: string; icon: any; desc: string }> = {
  script: { label: '生成文案', icon: FileText, desc: 'AI 根据主题自动生成视频文案' },
  video: { label: '生成视频', icon: Video, desc: 'Seedance 生成视频 + 配音' },
  publish: { label: '自动发布', icon: Send, desc: '发布到绑定的社交账号' },
};

export default function WorkflowPage() {
  const { token } = useAuth();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<Record<string, WorkflowRun[]>>({});
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // New workflow form
  const [newName, setNewName] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newSchedule, setNewSchedule] = useState<'manual' | 'daily' | 'weekly'>('manual');
  const [activeSteps, setActiveSteps] = useState<string[]>(['script', 'video', 'publish']);

  const loadWorkflows = async () => {
    try {
      const data = await api(token!).get('/workflows');
      setWorkflows(data || []);
    } catch (e: any) { /* empty */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadWorkflows(); }, []);

  const createWorkflow = async () => {
    if (!newName) return toast.error('请输入工作流名称');
    if (!newSubject) return toast.error('请输入视频主题');
    const steps: WorkflowStep[] = activeSteps.map(type => ({
      type: type as any,
      config: type === 'script' ? {} : type === 'video' ? { aspect: '9:16', duration: 15, resolution: '720p' } : {}
    }));
    try {
      await api(token!).post('/workflows', { name: newName, subject: newSubject, schedule: newSchedule, steps });
      toast.success('工作流已创建');
      setShowModal(false);
      setNewName(''); setNewSubject(''); setNewSchedule('manual');
      loadWorkflows();
    } catch (e: any) { toast.error(e.message); }
  };

  const runWorkflow = async (id: string) => {
    try {
      await api(token!).post(`/workflows/${id}/run`);
      toast.success('工作流已启动');
      loadWorkflows();
    } catch (e: any) { toast.error(e.message); }
  };

  const deleteWorkflow = async (id: string) => {
    try {
      await api(token!).del(`/workflows/${id}`);
      toast.success('已删除');
      loadWorkflows();
    } catch (e: any) { toast.error(e.message); }
  };

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!runs[id]) {
      try {
        const data = await api(token!).get(`/workflows/${id}/runs`);
        setRuns(prev => ({ ...prev, [id]: data || [] }));
      } catch { /* empty */ }
    }
  };

  const toggleStep = (step: string) => {
    setActiveSteps(prev =>
      prev.includes(step) ? prev.filter(s => s !== step) : [...prev, step]
    );
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-gray-400" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2"><GitBranch size={24} /> 工作流</h2>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-accent-primary/50 hover:bg-accent-primary/70 rounded-lg text-sm transition-colors">
          <Plus size={16} /> 新建工作流
        </button>
      </div>

      {workflows.length === 0 ? (
        <div className="bg-dark-card rounded-xl p-12 text-center border border-dark-border">
          <GitBranch size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400">还没有工作流</p>
          <p className="text-sm text-gray-600 mt-1">创建后自动执行：生成文案 → 生成视频 → 发布到社交账号</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {workflows.map(w => (
            <div key={w._id} className="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{w.name}</h3>
                    {w.last_status === 'running' && <Loader2 size={14} className="animate-spin text-yellow-400" />}
                    {w.last_status === 'success' && <CheckCircle size={14} className="text-accent-success" />}
                    {w.last_status === 'failed' && <XCircle size={14} className="text-red-400" />}
                    <span className="text-xs px-2 py-0.5 rounded bg-dark-bg text-gray-500">{w.schedule}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{w.subject}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => runWorkflow(w._id)} disabled={w.last_status === 'running'} className="flex items-center gap-1 px-3 py-1.5 bg-accent-primary/40 hover:bg-accent-primary/60 rounded-lg text-xs transition-colors disabled:opacity-50">
                    <Play size={13} /> 运行
                  </button>
                  <button onClick={() => toggleExpand(w._id)} className="px-3 py-1.5 bg-dark-bg hover:bg-dark-hover rounded-lg text-xs text-gray-400 transition-colors">
                    {expanded === w._id ? '收起' : '历史'}
                  </button>
                  <button onClick={() => deleteWorkflow(w._id)} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>

              {/* Steps bar */}
              <div className="px-4 pb-4 flex items-center gap-2 text-xs text-gray-500">
                {w.steps.map((s, i) => {
                  const meta = STEP_META[s.type];
                  const Icon = meta?.icon || Sparkles;
                  return (
                    <React.Fragment key={s.type}>
                      {i > 0 && <span className="text-gray-700">→</span>}
                      <span className="flex items-center gap-1 px-2 py-1 rounded bg-dark-bg">
                        <Icon size={12} /> {meta?.label || s.type}
                      </span>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Run history */}
              {expanded === w._id && (
                <div className="border-t border-dark-border px-4 py-3">
                  <p className="text-xs text-gray-500 mb-2">运行历史</p>
                  {(!runs[w._id] || runs[w._id].length === 0) ? (
                    <p className="text-xs text-gray-600 italic">暂无运行记录</p>
                  ) : (
                    <div className="space-y-2">
                      {runs[w._id].slice(0, 10).map(r => (
                        <div key={r.id} className="flex items-center gap-3 text-xs p-2 bg-dark-bg rounded-lg">
                          <span className="text-gray-500 shrink-0">{new Date(r.started_at).toLocaleString('zh-CN')}</span>
                          {r.status === 'running' && <Loader2 size={12} className="animate-spin text-yellow-400 shrink-0" />}
                          {r.status === 'success' && <CheckCircle size={12} className="text-accent-success shrink-0" />}
                          {r.status === 'failed' && <XCircle size={12} className="text-red-400 shrink-0" />}
                          <div className="flex gap-2 flex-wrap">
                            {r.steps.map(s => (
                              <span key={s.type} className={`px-1.5 py-0.5 rounded ${s.status === 'done' ? 'bg-green-900/30 text-green-400' : s.status === 'fail' ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                                {s.type}: {s.status}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-dark-card rounded-xl p-6 border border-dark-border w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">新建工作流</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">工作流名称</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="每日 AI 视频" className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">视频主题</label>
                <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="AI 改变生活" className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">执行方式</label>
                <select value={newSchedule} onChange={e => setNewSchedule(e.target.value as any)} className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm">
                  <option value="manual">手动触发</option>
                  <option value="daily">每天一次</option>
                  <option value="weekly">每周一次</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-2">执行步骤</label>
                <div className="flex gap-2">
                  {Object.entries(STEP_META).map(([k, v]) => {
                    const Icon = v.icon;
                    return (
                      <button key={k} onClick={() => toggleStep(k)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-colors ${
                          activeSteps.includes(k) ? 'bg-accent-primary/20 border-accent-primary/30 text-accent-primary' : 'bg-dark-bg border-dark-border text-gray-500'
                        }`}
                      ><Icon size={13} /> {v.label}</button>
                    );
                  })}
                </div>
              </div>
              <button onClick={createWorkflow} className="w-full py-2.5 bg-accent-primary/50 hover:bg-accent-primary/70 rounded-lg text-sm font-medium transition-colors mt-2">
                创建工作流
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

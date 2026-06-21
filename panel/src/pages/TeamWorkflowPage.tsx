import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth, api } from '../AuthContext';

// ─── Types ─────────────────────────────────────────────
type ContentType = 'text_image' | 'video';
type TeamStatus = 'running' | 'paused';

interface ScheduleItem {
  time: string;
  delayMin: number;
}

interface Team {
  _id?: string;
  name: string;
  subjects: string[];
  schedule: ScheduleItem[];
  publishAccounts: Record<string, string[]>;
  contentTypes: ContentType[];
  libtvModel: string;
  enabled: boolean;
}

interface TeamCard extends Team {
  _id: string;
  status: TeamStatus;
  todayProgress?: Record<string, string>;
}

// ─── Empty State ──────────────────────────────────────
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-6xl mb-4 opacity-30">👥</div>
      <h3 className="text-lg font-medium text-gray-300 mb-2">还没有运营团队</h3>
      <p className="text-gray-500 text-sm mb-6 max-w-md">
        创建一个运营团队，设定主题和发布时间，系统将自动生成内容并发布到各平台。
      </p>
      <button
        onClick={onCreate}
        className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-medium transition-colors"
      >
        + 创建运营团队
      </button>
    </div>
  );
}

// ─── Schedule Badge ────────────────────────────────────
function ScheduleBadge({ time, delayMin, status }: ScheduleItem & { status?: string }) {
  const statusIcon = status === 'done' ? '✅' : status === 'running' ? '⏳' : '📋';
  const statusClass = status === 'done'
    ? 'bg-green-900/30 text-green-400'
    : status === 'running'
      ? 'bg-yellow-900/30 text-yellow-400 animate-pulse'
      : 'bg-gray-800 text-gray-400';

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs ${statusClass}`}>
      <span>{statusIcon}</span>
      <span>{time}</span>
      {delayMin > 0 && <span className="text-gray-500 ml-0.5">· {delayMin}min</span>}
    </div>
  );
}

// ─── Team Card ─────────────────────────────────────────
function TeamCard({
  team,
  onEdit,
  onToggle,
  onDelete,
  onDuplicate,
  onRunNow,
}: {
  team: TeamCard;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRunNow: () => void;
}) {
  const isRunning = team.status === 'running';
  const platformNames: Record<string, string> = {
    twitter: '𝕏 Twitter',
    youtube: '▶ YouTube',
    tiktok: '🎵 TikTok',
    bilibili: '📺 Bilibili',
  };

  // Count accounts per platform
  const platformCounts = Object.entries(team.publishAccounts).map(
    ([p, ids]) => `${platformNames[p] || p} ×${ids.length}`
  );

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-gray-600 transition-all">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">{team.name}</h3>
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
              isRunning
                ? 'bg-green-900/40 text-green-400 border border-green-700/50'
                : 'bg-red-900/30 text-red-400 border border-red-700/30'
            }`}
          >
            ● {isRunning ? '运行中' : '已暂停'}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRunNow}
            className="px-3 py-1.5 text-xs bg-purple-600/70 hover:bg-purple-600 rounded-md text-white transition-colors"
            title="立即执行"
          >
            ▶ 执行
          </button>
          <button
            onClick={onToggle}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
              isRunning
                ? 'border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/20'
                : 'border-green-700/50 text-green-400 hover:bg-green-900/20'
            }`}
          >
            {isRunning ? '⏸ 暂停' : '▶ 启动'}
          </button>
          <button onClick={onEdit} className="px-3 py-1.5 text-xs border border-gray-600 rounded-md text-gray-400 hover:text-white hover:border-gray-500 transition-colors">
            编辑
          </button>
          <button onClick={onDuplicate} className="px-3 py-1.5 text-xs border border-gray-600 rounded-md text-gray-400 hover:text-white transition-colors">
            📋 复制
          </button>
          <button onClick={onDelete} className="px-3 py-1.5 text-xs border border-gray-600 rounded-md text-red-400 hover:text-red-300 transition-colors">
            删除
          </button>
        </div>
      </div>

      {/* Info Row */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">主题</span>
          <div className="flex gap-1.5 flex-wrap">
            {team.subjects.map((s, i) => (
              <span key={i} className="px-2 py-0.5 bg-purple-900/30 text-purple-300 rounded text-xs">
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">平台</span>
          {platformCounts.map((pc, i) => (
            <span key={i} className="text-blue-300 text-xs">{pc}</span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">内容</span>
          <span className="text-xs text-gray-300">
            {team.contentTypes.map(ct => ct === 'text_image' ? '📝 文案+图片' : '🎬 短视频').join(' & ')}
          </span>
        </div>
      </div>

      {/* Schedule Bar */}
      <div className="flex items-center gap-3 pt-3 border-t border-gray-700/60">
        <span className="text-xs text-gray-500 min-w-[60px]">今日排程</span>
        <div className="flex gap-2 flex-wrap">
          {team.schedule.map((s, i) => (
            <ScheduleBadge key={i} {...s} status={team.todayProgress?.[s.time]} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────
function EditTeamModal({
  team,
  allAccounts,
  onSave,
  onClose,
  isNew,
}: {
  team: Partial<Team>;
  allAccounts: any[];
  onSave: (data: Partial<Team>) => void;
  onClose: () => void;
  isNew?: boolean;
}) {
  const [name, setName] = useState(team.name || '');
  const [subjects, setSubjects] = useState<string[]>(team.subjects || ['']);
  const [schedule, setSchedule] = useState<ScheduleItem[]>(
    team.schedule?.length ? team.schedule : [{ time: '09:00', delayMin: 15 }]
  );
  const [publishAccounts, setPublishAccounts] = useState<Record<string, string[]>>(
    team.publishAccounts || {}
  );
  const [contentTypes, setContentTypes] = useState<ContentType[]>(
    team.contentTypes?.length ? team.contentTypes : ['text_image']
  );
  const [libtvModel, setLibtvModel] = useState(team.libtvModel || 'Seedance 2.0');
  const [subjectInput, setSubjectInput] = useState('');

  const addSubject = () => {
    const s = subjectInput.trim();
    if (s && !subjects.includes(s)) {
      setSubjects([...subjects.filter(Boolean), s]);
      setSubjectInput('');
    }
  };

  const removeSubject = (index: number) => {
    setSubjects(subjects.filter((_, i) => i !== index));
  };

  const addSchedule = () => {
    setSchedule([...schedule, { time: '12:00', delayMin: 0 }]);
  };

  const updateSchedule = (index: number, field: keyof ScheduleItem, value: string | number) => {
    const updated = schedule.map((s, i) =>
      i === index ? { ...s, [field]: field === 'delayMin' ? Number(value) : value } : s
    );
    setSchedule(updated);
  };

  const removeSchedule = (index: number) => {
    setSchedule(schedule.filter((_, i) => i !== index));
  };

  const toggleAccount = (platform: string, accountId: string) => {
    const current = publishAccounts[platform] || [];
    if (current.includes(accountId)) {
      setPublishAccounts({ ...publishAccounts, [platform]: current.filter(id => id !== accountId) });
    } else {
      setPublishAccounts({ ...publishAccounts, [platform]: [...current, accountId] });
    }
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      subjects: subjects.filter(Boolean),
      schedule,
      publishAccounts,
      contentTypes: contentTypes.length ? contentTypes : ['text_image'],
      libtvModel: contentTypes.includes('video') ? libtvModel : undefined,
      enabled: true,
    });
  };

  // Group accounts by platform
  const accountsByPlatform: Record<string, any[]> = {};
  allAccounts.forEach(acc => {
    const p = (acc.platform || 'twitter').toLowerCase();
    if (!accountsByPlatform[p]) accountsByPlatform[p] = [];
    accountsByPlatform[p].push(acc);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-850 border border-gray-700 rounded-2xl w-[720px] max-h-[90vh] overflow-y-auto p-8 shadow-2xl">
        <h2 className="text-xl font-semibold text-white mb-6">
          {isNew ? '创建运营团队' : '编辑运营团队'}
        </h2>

        {/* Name */}
        <div className="mb-5">
          <label className="block text-sm text-gray-400 mb-1.5 font-medium">团队名称</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
            placeholder="如：科技资讯"
          />
        </div>

        {/* Subjects */}
        <div className="mb-5">
          <label className="block text-sm text-gray-400 mb-1.5 font-medium">内容主题</label>
          <p className="text-xs text-gray-600 mb-2">用户设定主题，系统自动匹配生成规则</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {subjects.filter(Boolean).map((s, i) => (
              <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-900/30 text-purple-300 rounded-lg text-sm">
                {s}
                <button onClick={() => removeSubject(i)} className="text-gray-500 hover:text-white">✕</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={subjectInput}
              onChange={e => setSubjectInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSubject()}
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
              placeholder="输入主题后按回车"
            />
            <button onClick={addSubject} className="px-4 py-2 bg-gray-700 rounded-lg text-gray-300 text-sm hover:bg-gray-600">
              添加
            </button>
          </div>
        </div>

        {/* Content Type */}
        <div className="mb-5">
          <label className="block text-sm text-gray-400 mb-1.5 font-medium">内容类型</label>
          <div className="flex gap-3">
            <button
              onClick={() => setContentTypes(prev => prev.includes('text_image') ? prev : [...prev, 'text_image'])}
              className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                contentTypes.includes('text_image')
                  ? 'bg-purple-900/40 border-purple-600 text-purple-300'
                  : 'border-gray-600 text-gray-400 hover:border-gray-500'
              }`}
            >
              📝 文案+图片
            </button>
            <button
              onClick={() => setContentTypes(prev => prev.includes('video') ? prev : [...prev, 'video'])}
              className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                contentTypes.includes('video')
                  ? 'bg-purple-900/40 border-purple-600 text-purple-300'
                  : 'border-gray-600 text-gray-400 hover:border-gray-500'
              }`}
            >
              🎬 短视频
            </button>
          </div>
          {contentTypes.includes('video') && (
            <div className="mt-3">
              <label className="block text-sm text-gray-400 mb-1.5">LibTV 视频模型</label>
              <select
                value={libtvModel}
                onChange={e => setLibtvModel(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
              >
                <option value="Seedance 2.0">Seedance 2.0（推荐）</option>
                <option value="Kling 3.0">Kling 3.0</option>
                <option value="Wan 2.6">Wan 2.6</option>
                <option value="NanoBanana">NanoBanana</option>
                <option value="Happy Horse 1.0">Happy Horse 1.0</option>
              </select>
            </div>
          )}
        </div>

        {/* Schedule */}
        <div className="mb-5">
          <label className="block text-sm text-gray-400 mb-1.5 font-medium">每日发布时间</label>
          {schedule.map((s, i) => (
            <div key={i} className="flex items-center gap-3 mb-2">
              <input
                type="time"
                value={s.time}
                onChange={e => updateSchedule(i, 'time', e.target.value)}
                className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm w-[130px] focus:outline-none focus:border-purple-500"
              />
              <span className="text-gray-500 text-sm">间隔</span>
              <input
                type="number"
                min={0}
                value={s.delayMin}
                onChange={e => updateSchedule(i, 'delayMin', e.target.value)}
                className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm w-[80px] focus:outline-none focus:border-purple-500"
              />
              <span className="text-gray-500 text-sm">分钟</span>
              <button onClick={() => removeSchedule(i)} className="text-red-400 hover:text-red-300 text-sm ml-auto">
                删除
              </button>
            </div>
          ))}
          <button onClick={addSchedule} className="text-purple-400 hover:text-purple-300 text-sm mt-1">
            + 添加发布时间
          </button>
        </div>

        {/* Accounts */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-1.5 font-medium">发布账号</label>
          <p className="text-xs text-gray-600 mb-2">去重规则：同一天同一主题只按平台各发一次</p>
          {Object.entries(accountsByPlatform).length === 0 ? (
            <p className="text-gray-500 text-sm">暂无绑定账号，请先到设置页面绑定</p>
          ) : (
            Object.entries(accountsByPlatform).map(([platform, accounts]) => (
              <div key={platform} className="mb-2">
                <div className="text-xs text-gray-500 mb-1 uppercase">{platform}</div>
                <div className="flex flex-wrap gap-2">
                  {accounts.map(acc => (
                    <label
                      key={acc._id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                        (publishAccounts[platform] || []).includes(acc._id)
                          ? 'bg-purple-900/30 border-purple-600 text-purple-300'
                          : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={(publishAccounts[platform] || []).includes(acc._id)}
                        onChange={() => toggleAccount(platform, acc._id)}
                        className="accent-purple-500"
                      />
                      {(acc.screenName || acc.name || acc.username || acc.id)}
                    </label>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
          <button onClick={onClose} className="px-5 py-2.5 border border-gray-600 rounded-lg text-gray-400 hover:text-white transition-colors">
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !subjects.filter(Boolean).length}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:text-gray-500 rounded-lg text-white transition-colors"
          >
            {isNew ? '创建' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────
export default function TeamWorkflowPage() {
  const { token } = useAuth();
  const [teams, setTeams] = useState<TeamCard[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTeam, setEditingTeam] = useState<TeamCard | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadTeams = useCallback(async () => {
    try {
      const [t, a] = await Promise.all([
        api(token!).get('/teams'),
        api(token!).get('/accounts'),
      ]);
      setTeams(t.data || t || []);
      setAccounts(a.data || a || []);
    } catch (e: any) {
      showToast('加载失败: ' + (e.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  }, [token, api]);

  useEffect(() => { loadTeams(); }, [loadTeams]);

  const handleSave = async (data: Partial<Team>) => {
    try {
      if (editingTeam && !showCreate) {
        await api(token!).put(`/teams/${editingTeam._id}`, data);
        showToast('保存成功');
      } else {
        await api(token!).post('/teams', data);
        showToast('创建成功');
      }
      setEditingTeam(null);
      setShowCreate(false);
      loadTeams();
    } catch (e: any) {
      showToast('操作失败: ' + (e.message || ''), 'error');
    }
  };

  const handleToggle = async (team: TeamCard) => {
    try {
      await api(token!).post(`/teams/${team._id}/toggle`);
      loadTeams();
    } catch (e: any) {
      showToast('操作失败', 'error');
    }
  };

  const handleDelete = async (team: TeamCard) => {
    if (!confirm(`确定删除「${team.name}」？`)) return;
    try {
      await api(token!).del(`/teams/${team._id}`);
      showToast('已删除');
      loadTeams();
    } catch (e: any) {
      showToast('删除失败', 'error');
    }
  };

  const handleDuplicate = async (team: TeamCard) => {
    try {
      const { _id, status, todayProgress, ...rest } = team;
      await api(token!).post('/teams', { ...rest, name: rest.name + ' (副本)' });
      showToast('已复制');
      loadTeams();
    } catch (e: any) {
      showToast('复制失败', 'error');
    }
  };

  const handleRunNow = async (team: TeamCard) => {
    try {
      await api(token!).post(`/teams/${team._id}/run`);
      showToast('已触发执行');
      loadTeams();
    } catch (e: any) {
      showToast('触发失败', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">运营团队</h1>
          <p className="text-sm text-gray-500 mt-1">
            创建内容运营团队，系统按计划自动生成内容并发布到各平台
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.open('/exec-logs', '_self')}
            className="px-4 py-2 border border-gray-600 rounded-lg text-gray-400 text-sm hover:text-white transition-colors"
          >
            ⏰ 执行日志
          </button>
          <button
            onClick={() => { setShowCreate(true); setEditingTeam(null); }}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-medium transition-colors"
          >
            + 创建团队
          </button>
        </div>
      </div>

      {/* Team List or Empty */}
      {teams.length === 0 ? (
        <EmptyState onCreate={() => { setShowCreate(true); setEditingTeam(null); }} />
      ) : (
        <div className="space-y-4">
          {teams.map(t => (
            <TeamCard
              key={t._id}
              team={t}
              onEdit={() => { setEditingTeam(t); setShowCreate(false); }}
              onToggle={() => handleToggle(t)}
              onDelete={() => handleDelete(t)}
              onDuplicate={() => handleDuplicate(t)}
              onRunNow={() => handleRunNow(t)}
            />
          ))}
        </div>
      )}

      {/* Edit / Create Modal */}
      {(editingTeam || showCreate) && (
        <EditTeamModal
          team={editingTeam || {}}
          allAccounts={accounts}
          onSave={handleSave}
          onClose={() => { setEditingTeam(null); setShowCreate(false); }}
          isNew={showCreate}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success' ? 'bg-green-800 text-green-200' : 'bg-red-800 text-red-200'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

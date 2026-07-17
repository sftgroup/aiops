import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth, api } from '../AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { Account } from '../types';

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
  wanVideoModel: string;
  generatePosters?: boolean;
  enabled: boolean;
}

interface TeamCard extends Team {
  _id: string;
  status: TeamStatus;
  todayProgress?: Record<string, string>;
}

// ─── Empty State ──────────────────────────────────────
function EmptyState({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation('team');
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-6xl mb-4 opacity-30">👥</div>
      <h3 className="text-lg font-medium text-gray-300 mb-2">{t('empty.title')}</h3>
      <p className="text-gray-500 text-sm mb-6 max-w-md">
        {t('empty.description')}
      </p>
      <button
        onClick={onCreate}
        className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-medium transition-colors"
      >
        {t('empty.createButton')}
      </button>
    </div>
  );
}

// ─── Schedule Badge ────────────────────────────────────
function ScheduleBadge({ time, delayMin, status }: ScheduleItem & { status?: string }) {
  const { t } = useTranslation('team');
  const statusIcon = status === 'done' ? '✅' : status === 'running' ? '⏳' : '📋';
  const statusClass = status === 'done'
    ? 'bg-green-900/30 text-green-400'
    : status === 'running'
      ? 'bg-yellow-900/30 text-yellow-400 animate-pulse'
      : 'bg-dark-bg text-gray-400';

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs ${statusClass}`}>
      <span>{statusIcon}</span>
      <span>{time}</span>
      {delayMin > 0 && <span className="text-gray-500 ml-0.5">· {t('schedule.delayMin', { min: delayMin })}</span>}
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
  const { t } = useTranslation(['team', 'common']);
  const isRunning = team.status === 'running';
  const platformNames: Record<string, string> = {
    twitter: t('platform.twitter'),
    youtube: t('platform.youtube'),
    tiktok: t('platform.tiktok'),
    bilibili: t('platform.bilibili'),
  };

  // Count accounts per platform
  const platformCounts = Object.entries(team.publishAccounts).map(
    ([p, ids]) => `${platformNames[p] || p} ×${ids.length}`
  );

  return (
    <div className="bg-dark-bg border border-gray-700 rounded-xl p-5 hover:border-gray-600 transition-all">
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
            ● {isRunning ? t('teamCard.statusRunning') : t('teamCard.statusPaused')}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRunNow}
            className="px-3 py-1.5 text-xs bg-purple-600/70 hover:bg-purple-600 rounded-md text-white transition-colors"
            title={t('teamCard.runNow')}
          >
            {t('teamCard.runButton')}
          </button>
          <button
            onClick={onToggle}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
              isRunning
                ? 'border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/20'
                : 'border-green-700/50 text-green-400 hover:bg-green-900/20'
            }`}
          >
            {isRunning ? t('teamCard.pauseButton') : t('teamCard.startButton')}
          </button>
          <button onClick={onEdit} className="px-3 py-1.5 text-xs border border-gray-600 rounded-md text-gray-400 hover:text-white hover:border-gray-500 transition-colors">
            {t('teamCard.editButton')}
          </button>
          <button onClick={onDuplicate} className="px-3 py-1.5 text-xs border border-gray-600 rounded-md text-gray-400 hover:text-white transition-colors">
            {t('teamCard.duplicateButton')}
          </button>
          <button onClick={onDelete} className="px-3 py-1.5 text-xs border border-gray-600 rounded-md text-red-400 hover:text-red-300 transition-colors">
            {t('teamCard.deleteButton')}
          </button>
        </div>
      </div>

      {/* Info Row */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{t('teamCard.subjectLabel')}</span>
          <div className="flex gap-1.5 flex-wrap">
            {team.subjects.map((s, i) => (
              <span key={i} className="px-2 py-0.5 bg-purple-900/30 text-purple-300 rounded text-xs">
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{t('teamCard.platformLabel')}</span>
          {platformCounts.map((pc, i) => (
            <span key={i} className="text-blue-300 text-xs">{pc}</span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{t('teamCard.contentLabel')}</span>
          <span className="text-xs text-gray-300">
            {team.contentTypes.map(ct => ct === 'text_image' ? t('teamCard.contentTextImage') : t('teamCard.contentVideo')).join(' & ')}
          </span>
        </div>
      </div>

      {/* Schedule Bar */}
      <div className="flex items-center gap-3 pt-3 border-t border-gray-700/60">
        <span className="text-xs text-gray-500 min-w-[60px]">{t('teamCard.todaySchedule')}</span>
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
  allAccounts: Account[];
  onSave: (data: Partial<Team>) => void;
  onClose: () => void;
  isNew?: boolean;
}) {
  const { t } = useTranslation(['team', 'common']);
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
  const [wanVideoModel, setWanVideoModel] = useState(team.wanVideoModel || 'wanx2.1-t2v-turbo');
  const [generatePosters, setGeneratePosters] = useState(team.generatePosters === true);
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
      wanVideoModel: contentTypes.includes('video') ? wanVideoModel : undefined,
      generatePosters: contentTypes.includes('text_image') ? generatePosters : false,
      enabled: true,
    });
  };

  // Group accounts by platform
  const accountsByPlatform: Record<string, Account[]> = {};
  allAccounts.forEach(acc => {
    const p = (acc.platform || 'twitter').toLowerCase();
    if (!accountsByPlatform[p]) accountsByPlatform[p] = [];
    accountsByPlatform[p].push(acc);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-dark-card border border-gray-700 rounded-2xl w-[720px] max-h-[90vh] shadow-2xl flex flex-col">
        <h2 className="text-xl font-semibold text-white mb-6 shrink-0 px-8 pt-8">
          {isNew ? t('modal.createTitle') : t('modal.editTitle')}
        </h2>
        <div className="overflow-y-auto px-8 flex-1 min-h-0">

        {/* Name */}
        <div className="mb-5">
          <label className="block text-sm text-gray-400 mb-1.5 font-medium">{t('modal.nameLabel')}</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-2.5 bg-dark-bg border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
            placeholder={t('modal.namePlaceholder')}
          />
        </div>

        {/* Subjects */}
        <div className="mb-5">
          <label className="block text-sm text-gray-400 mb-1.5 font-medium">{t('modal.subjectLabel')}</label>
          <p className="text-xs text-gray-600 mb-2">{t('modal.subjectHint')}</p>
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
              className="flex-1 px-4 py-2 bg-dark-bg border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
              placeholder={t('modal.subjectPlaceholder')}
            />
            <button onClick={addSubject} className="px-4 py-2 bg-gray-700 rounded-lg text-gray-300 text-sm hover:bg-gray-600">
              {t('modal.subjectAddButton')}
            </button>
          </div>
        </div>

        {/* Content Type */}
        <div className="mb-5">
          <label className="block text-sm text-gray-400 mb-1.5 font-medium">{t('modal.contentTypeLabel')}</label>
          <div className="flex gap-3">
            <button
              onClick={() => setContentTypes(prev => prev.includes('text_image') ? prev.filter(t => t !== 'text_image') : [...prev, 'text_image'])}
              className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                contentTypes.includes('text_image')
                  ? 'bg-purple-900/40 border-purple-600 text-purple-300'
                  : 'border-gray-600 text-gray-400 hover:border-gray-500'
              }`}
            >
              {t('teamCard.contentTextImage')}
            </button>
            <button
              onClick={() => setContentTypes(prev => prev.includes('video') ? prev.filter(t => t !== 'video') : [...prev, 'video'])}
              className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                contentTypes.includes('video')
                  ? 'bg-purple-900/40 border-purple-600 text-purple-300'
                  : 'border-gray-600 text-gray-400 hover:border-gray-500'
              }`}
            >
              {t('teamCard.contentVideo')}
            </button>
          </div>
          {contentTypes.includes('text_image') && (
            <div className="mt-3 flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={generatePosters}
                  onChange={e => setGeneratePosters(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-400">{t('modal.generatePosters')}</span>
              </label>
            </div>
          )}
          {contentTypes.includes('video') && (
            <div className="mt-3">
              <label className="block text-sm text-gray-400 mb-1.5">{t('modal.videoModelLabel')}</label>
              <select
                value={wanVideoModel}
                onChange={e => setWanVideoModel(e.target.value)}
                className="w-full px-4 py-2.5 bg-dark-bg border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
              >
                <option value="wanx2.1-t2v-turbo">WAN 2.1 Turbo — 文生视频（快速）</option>
                <option value="wan2.6-t2v">WAN 2.6 — 文生视频</option>
                <option value="wan2.7-t2v">WAN 2.7 T2V — 文生视频</option>
                <option value="wan2.7-i2v">WAN 2.7 I2V — 图生视频</option>
              </select>
            </div>
          )}
        </div>

        {/* Schedule */}
        <div className="mb-5">
          <label className="block text-sm text-gray-400 mb-1.5 font-medium">{t('modal.scheduleLabel')}</label>
          {schedule.map((s, i) => (
            <div key={i} className="flex items-center gap-3 mb-2">
              <input
                type="time"
                value={s.time}
                onChange={e => updateSchedule(i, 'time', e.target.value)}
                className="px-3 py-2 bg-dark-bg border border-gray-600 rounded-lg text-white text-sm w-[130px] focus:outline-none focus:border-purple-500"
              />
              <span className="text-gray-500 text-sm">{t('modal.scheduleIntervalLabel')}</span>
              <input
                type="number"
                min={0}
                value={s.delayMin}
                onChange={e => updateSchedule(i, 'delayMin', e.target.value)}
                className="px-3 py-2 bg-dark-bg border border-gray-600 rounded-lg text-white text-sm w-[80px] focus:outline-none focus:border-purple-500"
              />
              <span className="text-gray-500 text-sm">{t('modal.scheduleMinuteLabel')}</span>
              <button onClick={() => removeSchedule(i)} className="text-red-400 hover:text-red-300 text-sm ml-auto">
                {t('modal.scheduleDeleteButton')}
              </button>
            </div>
          ))}
          <button onClick={addSchedule} className="text-purple-400 hover:text-purple-300 text-sm mt-1">
            {t('modal.scheduleAddButton')}
          </button>
        </div>

        {/* Accounts */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-1.5 font-medium">{t('modal.accountLabel')}</label>
          <p className="text-xs text-gray-600 mb-2">{t('modal.accountHint')}</p>
          {Object.entries(accountsByPlatform).length === 0 ? (
            <p className="text-gray-500 text-sm">{t('modal.accountEmpty')}</p>
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
                          : 'bg-dark-bg border-gray-600 text-gray-400 hover:border-gray-500'
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

        </div>
        {/* Actions */}
        <div className="flex justify-end gap-3 px-8 py-4 border-t border-gray-700 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 border border-gray-600 rounded-lg text-gray-400 hover:text-white transition-colors">
            {t('modal.cancelButton')}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !subjects.filter(Boolean).length}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:text-gray-500 rounded-lg text-white transition-colors"
          >
            {isNew ? t('modal.createButton') : t('modal.saveButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────
export default function TeamWorkflowPage() {
  const { t } = useTranslation(['team', 'common']);
  const { token } = useAuth();
  const [teams, setTeams] = useState<TeamCard[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTeam, setEditingTeam] = useState<TeamCard | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TeamCard | null>(null);

  const loadTeams = useCallback(async () => {
    try {
      const [t, a] = await Promise.all([
        api(token!).get('/teams'),
        api(token!).get('/accounts'),
      ]);
      setTeams(t.data || t || []);
      setAccounts(a.data || a || []);
    } catch (e: unknown) {
      toast.error(t('team:toast.loadFailed') + ': ' + ((e instanceof Error ? e.message : String(e)) || ''));
    } finally {
      setLoading(false);
    }
  }, [token, api, t]);

  useEffect(() => { loadTeams(); }, [loadTeams]);

  const handleSave = async (data: Partial<Team>) => {
    try {
      if (editingTeam && !showCreate) {
        await api(token!).put(`/teams/${editingTeam._id}`, data);
        toast.success(t('team:toast.saveSuccess'));
      } else {
        await api(token!).post('/teams', data);
        toast.success(t('team:toast.createSuccess'));
      }
      setEditingTeam(null);
      setShowCreate(false);
      loadTeams();
    } catch (e: unknown) {
      toast.error(t('team:toast.operationFailed') + ': ' + ((e instanceof Error ? e.message : String(e)) || ''));
    }
  };

  const handleToggle = async (team: TeamCard) => {
    try {
      await api(token!).post(`/teams/${team._id}/toggle`);
      loadTeams();
    } catch (e: unknown) {
      toast.error(t('team:toast.operationFailed'));
    }
  };

  const handleDelete = async (team: TeamCard) => {
    setConfirmDelete(team);
  };

  const confirmDeleteTeam = async () => {
    if (!confirmDelete) return;
    const team = confirmDelete;
    setConfirmDelete(null);
    try {
      await api(token!).del(`/teams/${team._id}`);
      toast.success(t('team:toast.deleteSuccess'));
      loadTeams();
    } catch (e: unknown) {
      toast.error(t('team:toast.deleteFailed'));
    }
  };

  const handleDuplicate = async (team: TeamCard) => {
    try {
      const { _id, status, todayProgress, ...rest } = team;
      await api(token!).post('/teams', { ...rest, name: rest.name + ' ' + t('team:duplicateSuffix') });
      toast.success(t('team:toast.duplicateSuccess'));
      loadTeams();
    } catch (e: unknown) {
      toast.error(t('team:toast.duplicateFailed'));
    }
  };

  const handleRunNow = async (team: TeamCard) => {
    try {
      await api(token!).post(`/teams/${team._id}/run`);
      toast.success(t('team:toast.runTriggered'));
      loadTeams();
    } catch (e: unknown) {
      toast.error(t('team:toast.runFailed'));
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
          <h1 className="text-2xl font-bold text-white">{t('team:page.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('team:page.description')}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.open('/exec-logs', '_self')}
            className="px-4 py-2 border border-gray-600 rounded-lg text-gray-400 text-sm hover:text-white transition-colors"
          >
            {t('team:page.execLogs')}
          </button>
          <button
            onClick={() => { setShowCreate(true); setEditingTeam(null); }}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-medium transition-colors"
          >
            {t('team:page.createTeam')}
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
      <ConfirmDialog
        open={!!confirmDelete}
        title={t('team:confirmDelete.title')}
        message={t('team:confirmDelete.message', { name: confirmDelete?.name })}
        confirmLabel={t('team:confirmDelete.confirmLabel')}
        variant="danger"
        onConfirm={confirmDeleteTeam}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

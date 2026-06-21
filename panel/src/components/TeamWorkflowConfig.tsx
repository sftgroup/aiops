import React from 'react';
import { Settings } from 'lucide-react';

const PLATFORM_META: Record<string, { label: string; color: string; icon: string }> = {
  twitter: { label: 'Twitter/X', color: '#1DA1F2', icon: '𝕏' },
  facebook: { label: 'Facebook', color: '#1877F2', icon: 'f' },
  youtube: { label: 'YouTube', color: '#FF0000', icon: '▶' },
  reddit: { label: 'Reddit', color: '#FF4500', icon: 'r' },
};

interface TeamWorkflowConfigProps {
  subject: string;
  onSubjectChange: (v: string) => void;
  articleCount: number;
  onArticleCountChange: (v: number) => void;
  videoCount: number;
  onVideoCountChange: (v: number) => void;
  publishTargets: Record<string, boolean>;
  onPublishTargetsChange: (v: Record<string, boolean>) => void;
  publishAccounts: Record<string, string[]>;
  onPublishAccountsChange: (v: Record<string, string[]>) => void;
  publishAt: string;
  onPublishAtChange: (v: string) => void;
  intervalMinutes: number;
  onIntervalMinutesChange: (v: number) => void;
  accounts: any[];
  onSave: () => void;
  onClose: () => void;
  hasSubject: boolean;
}

export default function TeamWorkflowConfig({
  subject, onSubjectChange,
  articleCount, onArticleCountChange,
  videoCount, onVideoCountChange,
  publishTargets, onPublishTargetsChange,
  publishAccounts, onPublishAccountsChange,
  publishAt, onPublishAtChange,
  intervalMinutes, onIntervalMinutesChange,
  accounts,
  onSave, onClose, hasSubject,
}: TeamWorkflowConfigProps) {

  const toggleAccount = (platform: string, accountId: string) => {
    const current = publishAccounts[platform] || [];
    const next = current.includes(accountId)
      ? current.filter(id => id !== accountId)
      : [...current, accountId];
    onPublishAccountsChange({ ...publishAccounts, [platform]: next });
  };

  return (
    <div className="bg-dark-card rounded-xl p-5 border border-dark-border mb-6">
      <h3 className="font-semibold mb-4 flex items-center gap-2"><Settings size={16} /> 今日配置</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-gray-400 block mb-1">📝 今日主题</label>
          <input value={subject} onChange={e => onSubjectChange(e.target.value)}
            placeholder="例如：AI 与未来生活" className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-400 block mb-1">📄 图文篇数</label>
            <select value={articleCount} onChange={e => onArticleCountChange(Number(e.target.value))}
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm">
              {[0,1,2,3,5,10].map(n => <option key={n} value={n}>{n} 篇</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">🎬 短视频条数</label>
            <select value={videoCount} onChange={e => onVideoCountChange(Number(e.target.value))}
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm">
              {[0,1,2,3,5].map(n => <option key={n} value={n}>{n} 条</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Publish Targets: Platform + Account Selection */}
      <div className="mt-4">
        <label className="text-sm text-gray-400 block mb-2">📤 发布到以下平台 + 选择账号</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.entries(PLATFORM_META).map(([pk, pv]) => {
            const enabled = publishTargets[pk] || false;
            const platAccounts = accounts.filter(a => a.platform?.toLowerCase() === pk);
            const selectedIds = publishAccounts[pk] || [];
            return (
              <div key={pk} className={`rounded-lg border ${enabled ? 'border-accent-primary/30 bg-accent-primary/5' : 'border-dark-border bg-dark-bg'} transition-colors`}>
                <label className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none">
                  <input type="checkbox" checked={enabled}
                    onChange={() => onPublishTargetsChange({ ...publishTargets, [pk]: !publishTargets[pk] })}
                    className="form-checkbox accent-accent-primary" />
                  <span className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold"
                    style={{ background: pv.color, color: '#fff' }}>{pv.icon}</span>
                  <span className="text-sm font-medium">{pv.label}</span>
                  <span className="text-xs text-gray-500 ml-auto">
                    {platAccounts.length > 0 ? `${platAccounts.length} 个账号` : '未绑定'}
                  </span>
                  {enabled && selectedIds.length > 0 && (
                    <span className="text-xs text-green-400">已选 {selectedIds.length}</span>
                  )}
                </label>
                {/* Account sub-list */}
                {enabled && platAccounts.length > 0 && (
                  <div className="px-3 pb-3 pt-0 flex flex-wrap gap-1.5 border-t border-dark-border/50 mt-0">
                    {platAccounts.map(acc => {
                      const accId = acc._id || acc.id;
                      const selected = selectedIds.includes(accId);
                      return (
                        <label key={accId}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs cursor-pointer border transition-colors
                            ${selected ? 'bg-accent-primary/20 border-accent-primary/40 text-accent-primary' : 'bg-dark-card border-dark-border text-gray-500 hover:border-gray-500'}`}>
                          <input type="checkbox" checked={selected}
                            onChange={() => toggleAccount(pk, accId)}
                            className="hidden" />
                          <span>{acc.screenName || acc.username || '#' + accId.slice(-6)}</span>
                        </label>
                      );
                    })}
                    {/* Select all / None */}
                    {platAccounts.length > 1 && (
                      <div className="flex gap-1 items-center w-full pt-1">
                        <button
                          onClick={() => onPublishAccountsChange({ ...publishAccounts, [pk]: platAccounts.map((a: any) => a._id || a.id) })}
                          className="text-[10px] px-2 py-1 rounded bg-dark-card border border-dark-border text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors"
                        >
                          全选
                        </button>
                        <button
                          onClick={() => onPublishAccountsChange({ ...publishAccounts, [pk]: [] })}
                          className="text-[10px] px-2 py-1 rounded bg-dark-card border border-dark-border text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors"
                        >
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
          <span>⏰</span> 定时发布
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">开始时间</label>
            <input type="datetime-local" value={publishAt}
              onChange={e => onPublishAtChange(e.target.value)}
              className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">间隔分钟</label>
            <select value={intervalMinutes} onChange={e => onIntervalMinutesChange(Number(e.target.value))}
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
        <button onClick={onSave} className="px-5 py-2.5 bg-accent-primary/50 hover:bg-accent-primary/70 rounded-lg text-sm transition-colors">
          保存配置
        </button>
        {hasSubject && <button onClick={onClose} className="px-5 py-2.5 bg-dark-border hover:bg-dark-hover rounded-lg text-sm transition-colors">收起配置</button>}
      </div>
    </div>
  );
}

import React from 'react';
import { Layers, Copy, Image, Video, Eye, Send } from 'lucide-react';

const EMPLOYEES = [
  { key: 'copywriter', icon: Copy, label: '文案员工', color: 'bg-blue-500', desc: 'DeepSeek 生成图文' },
  { key: 'imagegen', icon: Image, label: '配图员工', color: 'bg-purple-500', desc: 'LibTV AI 配图' },
  { key: 'videomaker', icon: Video, label: '视频员工', color: 'bg-orange-500', desc: 'Seedance 短视频' },
  { key: 'stitcher', icon: Layers, label: '拼接员工', color: 'bg-pink-500', desc: '多段合成长视频' },
  { key: 'reviewer', icon: Eye, label: '审核员工', color: 'bg-teal-500', desc: 'AI 内容审核' },
  { key: 'publisher', icon: Send, label: '发布员工', color: 'bg-green-500', desc: '排程+多账号发布' },
];

interface TeamProgressBarProps {
  progress?: Record<string, string>;
}

function progValue(progress?: Record<string, string>, key?: string): number {
  if (!progress || !key) return 0;
  const v = progress[key] || 'idle';
  if (v === 'done' || v === 'skip') return 100;
  if (v === 'running') return 50;
  if (typeof v === 'string' && v.startsWith('发中')) return 70;
  return 0;
}

function progLabel(progress?: Record<string, string>, key?: string): string {
  if (!progress || !key) return '⏸️ 待开始';
  const v = progress[key] || 'idle';
  const m: Record<string, string> = {
    idle: '⏸️ 待开始', pending: '⏳ 排队中', running: '🔄 工作中',
    done: '✅ 已完成', skip: '⏭️ 已跳过',
  };
  return m[v] || v;
}

export default function TeamProgressBar({ progress }: TeamProgressBarProps) {
  return (
    <div className="bg-dark-card rounded-xl p-4 border border-dark-border mb-6">
      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <Layers size={14} /> 团队进度
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {EMPLOYEES.map(emp => {
          const val = progValue(progress, emp.key);
          const label = progLabel(progress, emp.key);
          const Icon = emp.icon;
          return (
            <div key={emp.key} className="bg-dark-bg rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={14} className="text-gray-400" />
                <span className="text-xs font-medium">{emp.label}</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${emp.color}`}
                  style={{ width: val + '%' }}
                />
              </div>
              <div className={`text-[10px] ${val === 100 ? 'text-green-400' : val > 0 ? 'text-yellow-400' : 'text-gray-600'}`}>
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import React from 'react';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

interface PublishLogEntry {
  status: string;
  type?: string;
  platform?: string;
  account?: string;
  error?: string;
}

interface PublishLogProps {
  logs: PublishLogEntry[];
}

export default function PublishLog({ logs }: PublishLogProps) {
  if (!logs || logs.length === 0) return null;

  return (
    <div className="mt-6 bg-dark-card rounded-xl p-4 border border-dark-border">
      <h3 className="font-semibold mb-2 text-sm">📋 发布记录</h3>
      <div className="space-y-1">
        {logs.slice(-10).reverse().map((log: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-dark-border/50 last:border-0">
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
  );
}

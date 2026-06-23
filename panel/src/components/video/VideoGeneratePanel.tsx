import React from 'react';
import { Loader2, Play } from 'lucide-react';

interface VideoGeneratePanelProps {
  generating: boolean;
  wsFallback: boolean;
  subject: string;
  progressMsg: string;
  onGenerate: () => void;
}

export default function VideoGeneratePanel({
  generating, wsFallback, subject, progressMsg, onGenerate,
}: VideoGeneratePanelProps) {
  return (
    <div role="region" aria-label="视频生成控制">
      {/* WS fallback banner */}
      {wsFallback && generating && (
        <div
          className="flex items-center gap-2 px-3 py-2 mb-2 text-xs text-yellow-400 bg-yellow-500/5 border border-yellow-500/20 rounded-lg"
          role="alert"
          aria-live="polite"
        >
          <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" aria-hidden="true" />
          实时推送不可用，已切换轮询模式
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        disabled={generating || !subject.trim()}
        className="flex items-center justify-center gap-2 w-full py-4 sm:py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl font-medium transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-purple-900/30 text-sm sm:text-base"
        style={{ minHeight: 52 }}
        aria-label={generating ? '正在生成视频...' : '生成视频'}
      >
        {generating ? (
          <Loader2 size={20} className="animate-spin" aria-hidden="true" />
        ) : (
          <Play size={20} aria-hidden="true" />
        )}
        {generating ? '生成中...' : '🎬 LibTV 生成视频'}
      </button>

      {/* Real-time Progress */}
      {generating && (
        <div
          className="bg-dark-card rounded-xl border border-dark-border p-4 sm:p-5 space-y-3"
          role="progressbar"
          aria-label={progressMsg}
          aria-busy="true"
          aria-live="polite"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0" aria-hidden="true">
              <Loader2 size={18} className="animate-spin text-purple-400" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-200">
                  {progressMsg}
                </span>
              </div>
              <div className="w-full h-2 bg-dark-bg rounded-full overflow-hidden mt-2">
                <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500 animate-pulse" style={{ width: '35%' }} />
              </div>
              <p className="text-xs text-gray-600 mt-1">通常 30 秒~2 分钟完成，请勿关闭页面</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

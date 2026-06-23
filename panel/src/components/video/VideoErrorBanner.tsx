import React from 'react';

interface VideoErrorBannerProps {
  errorMsg: string;
  onRetry: () => void;
  onDismiss: () => void;
}

export default function VideoErrorBanner({ errorMsg, onRetry, onDismiss }: VideoErrorBannerProps) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-3" role="alert" aria-live="assertive" aria-label="视频生成错误">
      <div className="flex items-start gap-3">
        <span className="text-red-400 text-lg leading-none mt-0.5 shrink-0" aria-hidden="true">⚠️</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-300">生成失败</p>
          <p className="text-xs text-red-400/80 mt-1 break-words">{errorMsg}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl hover:bg-red-500/30 transition-all"
          style={{ minHeight: 44 }}
          aria-label="重试生成视频"
        >
          <span aria-hidden="true">↻</span> 重试
        </button>
        <button
          onClick={onDismiss}
          className="px-4 py-2.5 text-xs font-medium text-gray-400 border border-dark-border rounded-xl hover:text-gray-300 hover:bg-dark-bg transition-all"
          style={{ minHeight: 44 }}
          aria-label="关闭错误提示"
        >
          关闭
        </button>
      </div>
    </div>
  );
}

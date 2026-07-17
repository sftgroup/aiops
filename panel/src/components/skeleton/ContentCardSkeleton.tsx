import React from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export interface ContentCardSkeletonProps {
  count?: number;
}

/**
 * 内容历史记录列表的骨架屏
 * 匹配 ContentPage 右侧历史记录中的单个条目布局
 */
export default function ContentCardSkeleton({ count = 5 }: ContentCardSkeletonProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1 scrollbar-thin" role="status" aria-label="加载中" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`bg-dark-bg rounded-xl p-3.5 border border-transparent ${reducedMotion ? '' : 'animate-pulse'}`}
          aria-hidden="true"
        >
          <div className="flex items-start gap-3">
            {/* 图标骨架 */}
            <div className="w-8 h-8 rounded-lg bg-gray-700/50 shrink-0" />

            <div className="flex-1 min-w-0 space-y-2">
              {/* 标题 */}
              <div className="h-4 bg-gray-700/50 rounded w-3/4" />
              {/* 文本摘要 */}
              <div className="h-3 bg-gray-700/50 rounded w-full" />
              <div className="h-3 bg-gray-700/50 rounded w-2/3" />
              {/* 日期 */}
              <div className="h-3 bg-gray-700/50 rounded w-24" />
            </div>

            {/* 删除按钮骨架 */}
            <div className="w-7 h-7 bg-gray-700/50 rounded-lg shrink-0" />
          </div>
        </div>
      ))}
      <span className="sr-only">正在加载历史记录...</span>
    </div>
  );
}

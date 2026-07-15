import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export interface VideoCardSkeletonProps {
  count?: number;
}

export default function VideoCardSkeleton({ count = 8 }: VideoCardSkeletonProps) {
  const { t } = useTranslation(['video', 'common']);
  const reducedMotion = useReducedMotion();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" role="status" aria-label={t('gallery.loadingAria')} aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`bg-dark-card rounded-xl border border-dark-border overflow-hidden ${reducedMotion ? '' : 'animate-pulse'}`}
          aria-hidden="true"
        >
          {/* 缩略图区域 */}
          <div className="aspect-video bg-gray-700/50" />

          {/* 内容区域 — 模拟 VideoCard p-4 内部 */}
          <div className="p-4 space-y-3">
            {/* VideoInfo 骨架：标题 + 副标题/状态 */}
            <div className="space-y-2">
              <div className="h-4 bg-gray-700/50 rounded w-3/4" />
              <div className="h-3 bg-gray-700/50 rounded w-1/2" />
            </div>

            {/* 时长 + 日期行 — 参考 VideoCard 中的 flex */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="h-5 bg-gray-700/50 rounded w-12 flex items-center gap-1 px-1.5 py-0.5">
                  <Clock size={9} className="text-gray-700/50" />
                </span>
                <div className="h-3 bg-gray-700/50 rounded w-20" />
              </div>
              {/* VideoActions 骨架：两个小按钮 */}
              <div className="flex gap-1.5">
                <div className="h-8 w-8 bg-gray-700/50 rounded-lg" />
                <div className="h-8 w-8 bg-gray-700/50 rounded-lg" />
              </div>
            </div>

            {/* PublishSection 骨架 */}
            <div className="mt-3 h-9 bg-gray-700/50 rounded-lg" />
          </div>
        </div>
      ))}
      <span className="sr-only">{t('gallery.loadingSrOnly')}</span>
    </div>
  );
}

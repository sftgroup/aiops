import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { VideoItem } from '../../store/videoStore';

interface VideoThumbnailProps {
  video: VideoItem;
  isNewComplete?: boolean;
}

const VideoThumbnail: React.FC<VideoThumbnailProps> = ({ video, isNewComplete }) => {
  const { t } = useTranslation(['video', 'common']);
  return (
    <div className="relative" role="img" aria-label={video.videoUrl
      ? t('videoCard.thumbnailAria', { subject: video.subject || t('videoCard.unlabeled') })
      : t('videoCard.generatingAria', { subject: video.subject || t('videoCard.unlabeled') })
    }>
      {video.videoUrl ? (
        <video
          src={video.videoUrl}
          controls
          className="w-full aspect-video bg-black object-cover"
          preload="metadata"
          aria-label={video.subject || t('videoCard.unlabeled')}
        />
      ) : (
        <div className="w-full aspect-video bg-gradient-to-br from-dark-bg to-purple-950/20 flex items-center justify-center" aria-busy="true">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-purple-500/10 flex items-center justify-center animate-pulse" aria-hidden="true">
              <Loader2 size={22} className="text-purple-400 animate-spin" aria-hidden="true" />
            </div>
            <div className="space-y-1.5 mt-3" aria-hidden="true">
              <div className="h-2.5 w-28 bg-gray-700/50 rounded-full animate-pulse mx-auto" />
              <div className="h-2 w-20 bg-gray-700/30 rounded-full animate-pulse mx-auto" />
            </div>
            <p className="text-xs text-gray-500 mt-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" aria-hidden="true" />
                {t('page.progress.step1', 'AI 生成中...')}
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" aria-hidden="true" />
              </span>
            </p>
          </div>
        </div>
      )}
      {isNewComplete && (
        <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1 shadow-lg" style={{ minHeight: 24 }} role="status" aria-label={t('videoCard.newComplete')}>
          <CheckCircle2 size={12} aria-hidden="true" />
          {t('videoCard.newComplete')}
        </div>
      )}
    </div>
  );
};

export default React.memo(VideoThumbnail);

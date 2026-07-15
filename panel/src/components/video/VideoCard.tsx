import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { VideoItem } from '../../store/videoStore';
import PublishSection from '../PublishSection';
import VideoThumbnail from './VideoThumbnail';
import VideoInfo from './VideoInfo';
import VideoActions from './VideoActions';

export interface VideoCardProps {
  video: VideoItem;
  isNewComplete?: boolean;
  onPlay?: (v: VideoItem) => void;
  onDelete: (id: string) => void;
  onDownload: (v: VideoItem) => void;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, isNewComplete, onPlay, onDelete, onDownload }) => {
  const { t } = useTranslation(['video', 'common']);
  const handlePlay = React.useCallback(() => {
    onPlay?.(video);
  }, [onPlay, video]);

  return (
    <div
      className={`group bg-dark-card rounded-xl border overflow-hidden transition-all hover:shadow-lg hover:shadow-purple-900/10 ${
        isNewComplete
          ? 'border-green-500/50 ring-1 ring-green-500/20'
          : 'border-dark-border'
      }`}
    >
      <VideoThumbnail video={video} isNewComplete={isNewComplete} />
      <div className="p-4">
        <VideoInfo video={video} />

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {video.duration ? (
              <span className="text-[10px] text-gray-500 flex items-center gap-1 bg-dark-bg px-1.5 py-0.5 rounded">
                <Clock size={9} /> {video.duration}s
              </span>
            ) : null}
            {video.createdAt ? (
              <span className="text-[10px] text-gray-600 flex items-center gap-1">
                {new Date(video.createdAt).toLocaleDateString([], {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </span>
            ) : null}
          </div>
          <VideoActions video={video} onDownload={onDownload} onDelete={onDelete} />
        </div>

        <div className="mt-3">
          <PublishSection text={video.subject || video.script || ''} mediaUrl={video.videoUrl} />
        </div>
      </div>
    </div>
  );
};

export default React.memo(VideoCard);

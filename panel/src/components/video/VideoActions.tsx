import React from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Trash2 } from 'lucide-react';
import { VideoItem } from '../../store/videoStore';

interface VideoActionsProps {
  video: VideoItem;
  onDownload: (v: VideoItem) => void;
  onDelete: (id: string) => void;
}

const VideoActions: React.FC<VideoActionsProps> = ({ video, onDownload, onDelete }) => {
  const { t } = useTranslation(['video', 'common']);
  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('videoCard.downloadAria')}>
      {video.videoUrl && (
        <a
          href={video.videoUrl}
          download
          onClick={() => onDownload(video)}
          className="p-2 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all md:opacity-0 md:group-hover:opacity-100"
          title={t('videoCard.downloadTitle')}
          aria-label={t('videoCard.downloadAria')}
          style={{ minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Download size={18} aria-hidden="true" />
        </a>
      )}
      <button
        onClick={() => onDelete(video.id)}
        className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all md:opacity-0 md:group-hover:opacity-100"
        title={t('videoCard.deleteTitle')}
        aria-label={t('videoCard.deleteAria')}
        style={{ minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </div>
  );
};

export default React.memo(VideoActions);

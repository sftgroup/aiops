import React from 'react';
import { VideoItem } from '../../store/videoStore';

interface VideoInfoProps {
  video: VideoItem;
}

const VideoInfo: React.FC<VideoInfoProps> = ({ video }) => {
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-white/90 line-clamp-1">
          {video.subject || '未命名'}
        </h4>
      </div>
      {video.script && (
        <p className="text-xs text-gray-500 line-clamp-2 mt-1.5 leading-relaxed">
          {video.script}
        </p>
      )}
    </div>
  );
};

export default React.memo(VideoInfo);

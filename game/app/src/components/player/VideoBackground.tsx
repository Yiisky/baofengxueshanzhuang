// src/components/player/VideoBackground.tsx
import React, { useRef, useEffect } from 'react';

interface VideoBackgroundProps {
  videoPath?: string;
}

export const VideoBackground: React.FC<VideoBackgroundProps> = ({ 
  videoPath = '/images/Snow.mp4' 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.play().catch(err => {
        console.log('视频自动播放被阻止:', err);
      });
    }
  }, []);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <video
        ref={videoRef}
        src={videoPath}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ 
          opacity: 0.4,
          mixBlendMode: 'screen'
        }}
      />
      <div 
        className="absolute inset-0 bg-black/40"
        style={{ pointerEvents: 'none' }}
      />
    </div>
  );
};

export default VideoBackground;
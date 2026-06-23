import React, { useRef, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export interface VideoPlayerModalProps {
  /** Video URL to play */
  src: string;
  /** Video title shown in the header */
  title?: string;
  /** Called when the user wants to close the modal */
  onClose: () => void;
}

export default function VideoPlayerModal({ src, title, onClose }: VideoPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const outerRef = useFocusTrap(true);
  const innerRef = useRef<HTMLDivElement>(null);

  // ── Playback helpers ─────────────────────────────────
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  }, []);

  const seekRelative = useCallback((deltaSec: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + deltaSec));
  }, []);

  const adjustVolume = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = Math.max(0, Math.min(1, v.volume + delta));
    if (v.volume > 0) v.muted = false;
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  }, []);

  // ── Keyboard shortcuts for this modal ──────────────
  const shortcutMap = {
    ' ': togglePlay,
    'arrowleft': () => seekRelative(-5),
    'arrowright': () => seekRelative(5),
    'arrowup': () => adjustVolume(0.1),
    'arrowdown': () => adjustVolume(-0.1),
    'm': toggleMute,
    'f': toggleFullscreen,
    'escape': onClose,
  };
  useKeyboardShortcuts(shortcutMap);

  // ── Escape-fullscreen on F11 or native escape ──────
  useEffect(() => {
    const onFsChange = () => {
      /* noop – fullscreen state is reflected naturally */
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  return (
    <div
      ref={outerRef}
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title || '视频播放'}
    >
      <div
        ref={innerRef}
        className="relative bg-black rounded-2xl overflow-hidden shadow-2xl max-w-5xl w-full mx-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        style={{ aspectRatio: '16 / 9' }}
        role="document"
        aria-label={title || '视频播放器'}
      >
        {/* ── Header overlay ───────────────────────── */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
          <span className="text-sm text-white/90 truncate pointer-events-auto">
            {title || '视频播放'}
          </span>
          <button
            onClick={onClose}
            className="pointer-events-auto p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="关闭视频播放 (ESC)"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Video element ────────────────────────── */}
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-contain cursor-pointer"
          controls
          preload="metadata"
          onClick={togglePlay}
        />

        {/* ── Bottom hint bar ──────────────────────── */}
        <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-3 px-4 py-2 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
          <span className="text-[10px] text-white/50 pointer-events-auto flex items-center gap-1">
            <span className="inline-flex items-center gap-0.5 bg-white/10 px-1.5 py-0.5 rounded text-[9px]">Space</span> 播放/暂停
          </span>
          <span className="text-[10px] text-white/50 pointer-events-auto flex items-center gap-1">
            <span className="inline-flex items-center gap-0.5 bg-white/10 px-1.5 py-0.5 rounded text-[9px]">← →</span> 快进/快退
          </span>
          <span className="text-[10px] text-white/50 pointer-events-auto flex items-center gap-1">
            <span className="inline-flex items-center gap-0.5 bg-white/10 px-1.5 py-0.5 rounded text-[9px]">↑ ↓</span> 音量
          </span>
          <span className="text-[10px] text-white/50 pointer-events-auto flex items-center gap-1">
            <span className="inline-flex items-center gap-0.5 bg-white/10 px-1.5 py-0.5 rounded text-[9px]">M</span> 静音
          </span>
          <span className="text-[10px] text-white/50 pointer-events-auto flex items-center gap-1">
            <span className="inline-flex items-center gap-0.5 bg-white/10 px-1.5 py-0.5 rounded text-[9px]">F</span> 全屏
          </span>
        </div>
      </div>
    </div>
  );
}

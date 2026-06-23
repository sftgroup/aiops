import React from 'react';
import { Timer } from 'lucide-react';

interface VideoSubjectFormProps {
  subject: string;
  setSubject: (v: string) => void;
  duration: number;
  setDuration: (v: number) => void;
  customDuration: string;
  setCustomDuration: (v: string) => void;
  showCustomDuration: boolean;
  setShowCustomDuration: (v: boolean) => void;
  cameraMovement: string;
  setCameraMovement: (v: string) => void;
  generating: boolean;
}

export default function VideoSubjectForm({
  subject, setSubject,
  duration, setDuration,
  customDuration, setCustomDuration,
  showCustomDuration, setShowCustomDuration,
  cameraMovement, setCameraMovement,
  generating,
}: VideoSubjectFormProps) {
  return (
    <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden" role="region" aria-label="视频主题设置">
      <div className="px-5 py-4 border-b border-dark-border flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0" aria-hidden="true">
          <span className="text-xs">🎯</span>
        </span>
        <h3 className="font-semibold sm:text-base text-sm">视频主题</h3>
      </div>
      <div className="p-4 sm:p-5 space-y-5">
        <input
          className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-xl text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all text-base"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="例如：AI 改变生活、未来科技展望…"
          disabled={generating}
          aria-label="视频主题"
        />

        {/* Duration Selector */}
        <div role="radiogroup" aria-label="视频时长">
          <label className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-400 mb-3">
            <Timer size={16} />
            视频时长
          </label>
          {/* Duration buttons scrollable on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            {[
              { value: 5, label: '5s', desc: 'Happy Horse' },
              { value: 6, label: '6s', desc: '有镜头→Hailuo' },
              { value: 10, label: '10s', desc: 'Wan 2.6 / Hailuo' },
              { value: 15, label: '15s', desc: 'Wan 2.6' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => { setDuration(opt.value); setShowCustomDuration(false); setCustomDuration(''); }}
                disabled={generating}
                role="radio"
                aria-checked={duration === opt.value && !showCustomDuration}
                aria-label={`${opt.label} - ${opt.desc}`}
                className={`relative flex-1 min-w-[80px] px-4 py-3 rounded-xl text-xs font-medium border transition-all ${
                  duration === opt.value && !showCustomDuration
                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-sm'
                    : 'bg-dark-bg border-dark-border text-gray-400 hover:border-gray-600 hover:text-gray-300'
                } disabled:opacity-50`}
              >
                <span className="block">{opt.label}</span>
                <span className={`block mt-0.5 text-[10px] ${
                  duration === opt.value && !showCustomDuration ? 'text-purple-400/60' : 'text-gray-600'
                }`}>
                  {opt.desc}
                </span>
              </button>
            ))}
            <button
              onClick={() => { setShowCustomDuration(true); setDuration(0); }}
              disabled={generating}
              role="radio"
              aria-checked={showCustomDuration}
              aria-label="自定义时长"
              className={`relative min-w-[80px] px-4 py-3 rounded-xl text-xs font-medium border transition-all ${
                showCustomDuration
                  ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-sm'
                  : 'bg-dark-bg border-dark-border text-gray-400 hover:border-gray-600 hover:text-gray-300'
              } disabled:opacity-50`}
            >
              <span className="block">自定义</span>
            </button>
          </div>
          {showCustomDuration && (
            <div className="flex items-center gap-2 mt-3">
              <input
                type="number"
                min="1"
                max="300"
                value={customDuration}
                onChange={e => {
                  setCustomDuration(e.target.value);
                  const v = parseInt(e.target.value);
                  if (v > 0 && v <= 300) setDuration(v);
                }}
                placeholder="3~300秒"
                disabled={generating}
                className="flex-1 px-4 py-3 bg-dark-bg border border-dark-border rounded-xl text-white text-sm focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
                aria-label="自定义时长秒数"
              />
              <span className="text-sm text-gray-500">秒</span>
            </div>
          )}
        </div>

        {/* Camera Movement Selector */}
        <div role="radiogroup" aria-label="镜头运动">
          <label className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-400 mb-3">
            <span className="text-base" aria-hidden="true">🎥</span>
            镜头运动
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { value: '', label: '默认', desc: 'Happy Horse' },
              { value: 'auto', label: '✨ 自动多镜头', desc: 'Wan 2.6' },
              { value: '拉近', label: '拉近', desc: 'Hailuo' },
              { value: '拉远', label: '拉远', desc: 'Hailuo' },
              { value: '左摇', label: '左摇', desc: 'Hailuo' },
              { value: '右摇', label: '右摇', desc: 'Hailuo' },
              { value: '仰摄', label: '仰摄', desc: 'Hailuo' },
              { value: '俯摄', label: '俯摄', desc: 'Hailuo' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setCameraMovement(opt.value)}
                disabled={generating}
                role="radio"
                aria-checked={cameraMovement === opt.value}
                aria-label={`${opt.label}${opt.desc ? ` - ${opt.desc}` : ''}`}
                className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all bg-dark-bg border-dark-border text-gray-400 hover:border-gray-600 hover:text-gray-300 disabled:opacity-50"
                style={cameraMovement === opt.value
                  ? { background: 'rgba(59,130,246,0.2)', borderColor: 'rgba(59,130,246,0.5)', color: '#93c5fd' }
                  : undefined}
              >
                {opt.label}
                {opt.desc && (
                  <span className={`ml-0.5 text-[10px] ${
                    cameraMovement === opt.value ? 'text-blue-400/50' : 'text-gray-600'
                  }`}>
                    {opt.desc}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

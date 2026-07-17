import React from 'react';
import { Loader2, Play, User, UserCheck } from 'lucide-react';

interface Voice {
  id: string;
  name: string;
  nameEn?: string;
  gender: string;
  category?: string;
  personality?: string;
}

interface Props {
  voices: Record<string, Voice[]>;
  lang: string;
  value: string;
  onChange: (voiceId: string) => void;
  onPreview: (voiceId: string) => void;
  previewLoadingId: string | null;
}

function VoiceIcon({ gender }: { gender: string }) {
  const isFemale = gender?.toLowerCase() === 'female';
  return (
    <span className={`w-7 h-7 rounded-full flex items-center justify-center ${
      isFemale ? 'bg-pink-500/20 text-pink-400' : 'bg-blue-500/20 text-blue-400'
    }`}>
      {isFemale ? <UserCheck size={13} /> : <User size={13} />}
    </span>
  );
}

function getLangLabel(code: string) {
  const LANG_MAP: Record<string, string> = {
    'zh-CN': '🇨🇳 中文', 'zh-TW': '🇹🇼 繁體中文',
    'en-US': '🇺🇸 English (US)', 'en-GB': '🇬🇧 English (UK)',
    'ja-JP': '🇯🇵 日本語', 'ko-KR': '🇰🇷 한국어',
    'es-ES': '🇪🇸 Español (ES)', 'es-MX': '🇲🇽 Español (MX)',
    'fr-FR': '🇫🇷 Français', 'fr-CA': '🇨🇦 Français (CA)',
    'de-DE': '🇩🇪 Deutsch', 'pt-BR': '🇧🇷 Português (BR)',
    'pt-PT': '🇵🇹 Português (PT)', 'it-IT': '🇮🇹 Italiano',
    'ru-RU': '🇷🇺 Русский', 'ar-SA': '🇸🇦 العربية',
    'hi-IN': '🇮🇳 हिन्दी', 'th-TH': '🇹🇭 ไทย',
    'vi-VN': '🇻🇳 Tiếng Việt',
  };
  return LANG_MAP[code] || code;
}

export default function VoiceSelector({ voices, lang, value, onChange, onPreview, previewLoadingId }: Props) {
  const list = voices[lang] || [];

  // No language selected
  if (!lang) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <User size={40} className="mb-3 opacity-30" />
        <p className="text-sm">请先选择目标语言</p>
      </div>
    );
  }

  // Language has no voices
  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <User size={40} className="mb-3 opacity-30" />
        <p className="text-sm">该语言暂无音色</p>
        <p className="text-xs text-slate-600 mt-1">{getLangLabel(lang)}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {list.map((v) => {
        const isSelected = value === v.id;
        const isPreviewLoading = previewLoadingId === v.id;

        return (
          <div
            key={v.id}
            className={`relative rounded-xl p-3.5 cursor-pointer transition-all ${
              isSelected
                ? 'bg-slate-800 border-2 border-blue-500 ring-1 ring-blue-500/30'
                : 'bg-slate-800/60 border border-slate-700 hover:border-slate-600 hover:bg-slate-800'
            }`}
            onClick={() => onChange(v.id)}
          >
            {/* Voice info */}
            <div className="flex items-start gap-3">
              <VoiceIcon gender={v.gender} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${
                  isSelected ? 'text-white' : 'text-slate-200'
                }`}>
                  {v.name}
                </p>
                {v.nameEn && (
                  <p className="text-xs text-slate-500 truncate mt-0.5">{v.nameEn}</p>
                )}
                {/* Tags: category + personality */}
                {(v.category || v.personality) && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {v.category && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {v.category}
                      </span>
                    )}
                    {v.personality && v.personality.split(',').slice(0, 2).map((p, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        {p.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Preview button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPreview(v.id);
              }}
              disabled={isPreviewLoading}
              className={`mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white hover:bg-blue-500'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isPreviewLoading ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  试听中
                </>
              ) : (
                <>
                  <Play size={12} />
                  试听
                </>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

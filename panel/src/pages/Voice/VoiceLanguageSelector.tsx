import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface Voice {
  id: string;
  name: string;
  nameEn?: string;
  gender: string;
}

interface Props {
  voices: Record<string, Voice[]>;
  value: string;
  onChange: (code: string) => void;
}

const RECENT_LANGS_KEY = 'tts_recent_langs';
const MAX_RECENT = 5;

const QUICK_LANGS = [
  { code: 'zh-CN', flag: '🇨🇳', label: '中文' },
  { code: 'en-US', flag: '🇺🇸', label: 'English' },
  { code: 'ja-JP', flag: '🇯🇵', label: '日本語' },
  { code: 'ko-KR', flag: '🇰🇷', label: '한국어' },
  { code: 'fr-FR', flag: '🇫🇷', label: 'Français' },
  { code: 'de-DE', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'es-ES', flag: '🇪🇸', label: 'Español' },
  { code: 'ru-RU', flag: '🇷🇺', label: 'Русский' },
  { code: 'pt-BR', flag: '🇧🇷', label: 'Português' },
  { code: 'it-IT', flag: '🇮🇹', label: 'Italiano' },
];

function getRecentLangs(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_LANGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.slice(0, MAX_RECENT);
    }
  } catch {
    // ignore
  }
  return [];
}

function saveRecentLangs(code: string) {
  try {
    const existing = getRecentLangs();
    const updated = [code, ...existing.filter((c) => c !== code)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_LANGS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

const LANG_FLAG_MAP: Record<string, string> = {
  'zh-CN': '🇨🇳', 'zh-TW': '🇹🇼', 'en-US': '🇺🇸', 'en-GB': '🇬🇧',
  'ja-JP': '🇯🇵', 'ko-KR': '🇰🇷', 'es-ES': '🇪🇸', 'es-MX': '🇲🇽',
  'fr-FR': '🇫🇷', 'fr-CA': '🇨🇦', 'de-DE': '🇩🇪', 'pt-BR': '🇧🇷',
  'pt-PT': '🇵🇹', 'it-IT': '🇮🇹', 'ru-RU': '🇷🇺', 'ar-SA': '🇸🇦',
  'hi-IN': '🇮🇳', 'th-TH': '🇹🇭', 'vi-VN': '🇻🇳',
};

export default function VoiceLanguageSelector({ voices, value, onChange }: Props) {
  const [searchText, setSearchText] = useState('');
  const [recentLangs, setRecentLangs] = useState<string[]>(getRecentLangs);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allLangCodes = useMemo(() => Object.keys(voices), [voices]);

  const filteredCodes = useMemo(() => {
    if (!searchText.trim()) return allLangCodes;
    const q = searchText.trim().toLowerCase();
    return allLangCodes.filter((code) => code.toLowerCase().includes(q));
  }, [allLangCodes, searchText]);

  const handleSelect = (code: string) => {
    onChange(code);
    setSearchText('');
    setShowDropdown(false);
  };

  const getVoiceCount = (code: string) => voices[code]?.length ?? 0;

  // Quick lang label resolve
  const quickLangMap = useMemo(() => {
    const m: Record<string, { flag: string; label: string }> = {};
    QUICK_LANGS.forEach((l) => {
      m[l.code] = { flag: l.flag, label: l.label };
    });
    return m;
  }, []);

  const currentLangLabel = useMemo(() => {
    const ql = quickLangMap[value];
    if (ql) return `${ql.flag} ${ql.label} (${value})`;
    const flag = LANG_FLAG_MAP[value] || '';
    return `${flag} ${value}`;
  }, [value, quickLangMap]);

  return (
    <div ref={containerRef} className="relative">
      {/* Search input */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          placeholder={searchText ? '搜索语言...' : currentLangLabel}
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          className="w-full pl-8 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
        />
        {searchText && (
          <button
            onClick={() => { setSearchText(''); inputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Quick access: always visible (fixed order) */}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {QUICK_LANGS.map((l) => (
          <button
            key={l.code}
            onClick={() => handleSelect(l.code)}
            className={`px-2 py-1 rounded-lg text-xs transition-all ${
              value === l.code
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            {l.flag} {l.label}
          </button>
        ))}
      </div>

      {/* Dropdown: search results + all languages */}
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
          {searchText && (
            <div className="px-3 pt-2 pb-2">
              <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">
                搜索结果 ({filteredCodes.length})
              </p>
            </div>
          )}
          <div className="max-h-48 overflow-y-auto">
            {(searchText ? filteredCodes : allLangCodes).map((code) => {
              const ql = quickLangMap[code];
              const flag = ql?.flag || LANG_FLAG_MAP[code] || '';
              const count = getVoiceCount(code);
              return (
                <button
                  key={code}
                  onClick={() => handleSelect(code)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                    value === code
                      ? 'bg-blue-600/20 text-blue-300 border-l-2 border-blue-500'
                      : 'text-slate-300 hover:bg-slate-800 border-l-2 border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-base">{flag}</span>
                    <span>{code}</span>
                  </span>
                  <span className="text-xs text-slate-500">{count} 个音色</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

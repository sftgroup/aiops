import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, api } from '../AuthContext';
import toast from 'react-hot-toast';
import { Mic, Download, Loader2, Volume2, Copy, Languages, Upload, FileText, X, Globe, Sparkles, Wand2, CornerDownLeft, Info, Settings2, ChevronDown, ChevronUp, Play } from 'lucide-react';
import VoiceLanguageSelector from './Voice/VoiceLanguageSelector';
import VoiceSelector from './Voice/VoiceSelector';

interface Voice {
  id: string;
  name: string;
  nameEn?: string;
  gender: string;
}

interface LangOption {
  code: string;
  label: string;
  flag: string;
}

interface TtsResult {
  id: string;
  original: string;
  translated: string;
  lang: string;
  voice: string;
  url: string;
  createdAt?: number;
}

interface TranslationResult {
  original: string;
  translated: string;
  targetLang: string;
}

interface OptimizeResult {
  original: string;
  optimized: string;
}

interface VoiceRecommendation {
  tone: string;
  recommendations: Array<{ id: string; name: string; reason: string }>;
}

interface TtsHistoryItem {
  id: string;
  text: string;
  translatedText: string;
  language: string;
  voice: string;
  audioPath: string;
  createdAt: string;
}

const LANGUAGES: LangOption[] = [
  { code: 'zh-CN', label: '中文', flag: '🇨🇳' },
  { code: 'zh-TW', label: '繁體中文', flag: '🇹🇼' },
  { code: 'en-US', label: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', label: 'English (UK)', flag: '🇬🇧' },
  { code: 'ja-JP', label: '日本語', flag: '🇯🇵' },
  { code: 'ko-KR', label: '한국어', flag: '🇰🇷' },
  { code: 'es-ES', label: 'Español (ES)', flag: '🇪🇸' },
  { code: 'es-MX', label: 'Español (MX)', flag: '🇲🇽' },
  { code: 'fr-FR', label: 'Français', flag: '🇫🇷' },
  { code: 'fr-CA', label: 'Français (CA)', flag: '🇨🇦' },
  { code: 'de-DE', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt-BR', label: 'Português (BR)', flag: '🇧🇷' },
  { code: 'pt-PT', label: 'Português (PT)', flag: '🇵🇹' },
  { code: 'it-IT', label: 'Italiano', flag: '🇮🇹' },
  { code: 'ru-RU', label: 'Русский', flag: '🇷🇺' },
  { code: 'ar-SA', label: 'العربية', flag: '🇸🇦' },
  { code: 'hi-IN', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'th-TH', label: 'ไทย', flag: '🇹🇭' },
  { code: 'vi-VN', label: 'Tiếng Việt', flag: '🇻🇳' },
];

function getLangLabel(code: string) {
  const l = LANGUAGES.find(x => x.code === code);
  return l ? `${l.flag} ${l.label}` : code;
}

export default function TtsPage() {
  const { t, i18n } = useTranslation(['tts', 'common']);
  const { token } = useAuth();
  const [text, setText] = useState('');
  const [targetLang, setTargetLang] = useState('zh-CN');
  const [voice, setVoice] = useState('en-US-JennyNeural');
  const [voices, setVoices] = useState<Record<string, Voice[]>>({});
  const [speed, setSpeed] = useState('+0%');
  const [fileName, setFileName] = useState('');
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Loading flags — mutually exclusive in practice
  const [generating, setGenerating] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [recommendPanelOpen, setRecommendPanelOpen] = useState(false);
  const [recommendInstructions, setRecommendInstructions] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);

  // Results
  const [ttsResult, setTtsResult] = useState<TtsResult | null>(null);
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(null);
  const [voiceRecommendation, setVoiceRecommendation] = useState<VoiceRecommendation | null>(null);
  const [ttsHistory, setTtsHistory] = useState<TtsHistoryItem[]>([]);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // ─── Load voices ──────────────────────────────
  useEffect(() => {
    if (!token) return;
    api(token).get('/tts/voices').then((r: { voices: Record<string, Voice[]>; langs: string[] }) => {
      setVoices(r.voices);
    }).catch(() => {});
  }, [token]);

  // ─── Load TTS history ─────────────────────────
  useEffect(() => {
    if (!token) return;
    setHistoryLoading(true);
    api(token).get('/tts/history?limit=20')
      .then((r: { history: TtsHistoryItem[] }) => setTtsHistory(r.history || []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [token]);

  // ─── Persist/restore results via sessionStorage ──
  const PERSIST_KEY = 'tts_v2_state';
  // Restore on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(PERSIST_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        if (state.ttsResult) setTtsResult(state.ttsResult);
        if (state.optimizeResult) setOptimizeResult(state.optimizeResult);
        if (state.translationResult) setTranslationResult(state.translationResult);
        if (state.voiceRecommendation) setVoiceRecommendation(state.voiceRecommendation);
        if (state.recommendInstructions) setRecommendInstructions(state.recommendInstructions);
        if (state.text) setText(state.text);
        if (state.targetLang) setTargetLang(state.targetLang);
        if (state.voice) setVoice(state.voice);
        if (state.speed) setSpeed(state.speed);
      }
    } catch {}
  }, []);
  // Persist on result changes
  useEffect(() => {
    try {
      sessionStorage.setItem(PERSIST_KEY, JSON.stringify({
        ttsResult, optimizeResult, translationResult, voiceRecommendation, recommendInstructions, text, targetLang, voice, speed,
      }));
    } catch {}
  }, [ttsResult, optimizeResult, translationResult, voiceRecommendation, recommendInstructions, text, targetLang, voice, speed]);

  // ─── Friendly error messages (B6) ─────────────
  const friendlyError = useCallback((e: unknown, fallback: string) => {
    const raw = (e instanceof Error ? e.message : String(e)) || fallback;
    const MAP: Record<string, string> = {
      ENOENT: t('errorMap.edgeTtsNotFound'),
      ETIMEDOUT: t('errorMap.edgeTtsInstallHint'),
      ECONNREFUSED: t('errorMap.generateFailed'),
      NoAudioReceived: t('errorMap.noAudio'),
    };
    for (const [key, msg] of Object.entries(MAP)) {
      if (raw.includes(key)) return msg;
    }
    return raw.includes('失败') || raw.includes('错误') ? raw : `${fallback}: ${raw}`;
  }, []);

  // ─── Audio play ───────────────────────────────
  const handlePlay = useCallback((url: string, id?: string) => {
    // If same stream is already loaded, toggle play/pause
    if (id && playingId === id && audioRef.current) {
      if (!audioRef.current.paused) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      return;
    }
    // Stop previous and start new
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (id) setPlayingId(id);
    // Add token auth for history files served behind auth middleware
    const resolvedUrl = token ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : url;
    const audio = new Audio(resolvedUrl);
    audioRef.current = audio;
    audio.onplay = () => setAudioPlaying(true);
    audio.onended = () => { setAudioPlaying(false); setPlayingId(null); };
    audio.onpause = () => { if (audio.currentTime >= audio.duration) return; setAudioPlaying(false); };
    audio.onerror = () => { setAudioPlaying(false); setPlayingId(null); toast.error(t('toast.playFailed')); };
    audio.play();
  }, [token, playingId]);

  // ─── File download helper ─────────────────────
  const downloadFile = useCallback((content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // ─── Generate TTS ─────────────────────────────
  const handleGenerate = useCallback(async (customText?: string, skipTranslation?: boolean) => {
    const sourceText = (customText || text).trim();
    if (!sourceText) return toast.error(t('toast.pleaseEnterContent'));
    if (!token) return;

    setGenerating(true);
    try {
      const body: Record<string, unknown> = {
        text: sourceText,
        targetLang,
        voice: voice || (voices[targetLang]?.[0]?.id || 'en-US-JennyNeural'),
        speed,
      };
      if (skipTranslation) body.skipTranslation = true;
      const res = await api(token).post('/tts/synthesize', body);
      setTtsResult({ id: res.id, url: `/api/tts/audio/${res.audioPath}`, original: res.text, translated: res.translatedText, lang: res.language, voice: res.voice, createdAt: res.createdAt } as TtsResult);
      toast.success(t('toast.voiceGenerated'));
      // Refresh history
      api(token).get('/tts/history?limit=20')
        .then((r: { history: TtsHistoryItem[] }) => setTtsHistory(r.history || []))
        .catch(() => {});
    } catch (e: unknown) {
      toast.error(friendlyError(e, t('errorMap.generateFailed')));
    } finally {
      setGenerating(false);
    }
  }, [text, targetLang, voice, voices, speed, token]);

  // ─── Translate only ────────────────────────────
  const handleTranslateOnly = useCallback(async () => {
    if (!text.trim()) return toast.error(t('toast.pleaseEnterContent'));
    if (!token) return;
    setTranslating(true);
    try {
      // Default to English when current language is Chinese (translating to same lang is no-op)
      const lang = targetLang === 'zh-CN' ? 'en' : targetLang;
      const res = await api(token).post('/tts/translate', { text: text.trim(), targetLang: lang });
      setTranslationResult(res as TranslationResult);
      toast.success(t('toast.translationComplete'));
    } catch (e: unknown) {
      toast.error(friendlyError(e, t('errorMap.translateFailed')));
    } finally {
      setTranslating(false);
    }
  }, [text, targetLang, token]);

  // ─── Optimize text ─────────────────────────────
  const handleOptimize = useCallback(async () => {
    if (!text.trim()) return toast.error(t('toast.pleaseEnterContent'));
    if (!token) return;
    setOptimizing(true);
    try {
      const res = await api(token).post('/tts/optimize', { text: text.trim(), targetLang });
      setOptimizeResult(res as OptimizeResult);
      toast.success(t('toast.contentOptimized'));
    } catch (e: unknown) {
      toast.error(friendlyError(e, t('errorMap.optimizeFailed')));
    } finally {
      setOptimizing(false);
    }
  }, [text, token, friendlyError]);

  // ─── Recommend voice ───────────────────────────
  const handleRecommendVoice = useCallback(async () => {
    if (!text.trim()) return toast.error(t('toast.pleaseEnterContent'));
    if (!token) return;
    setRecommending(true);
    try {
      const body: Record<string, unknown> = { text: text.trim(), targetLang };
      if (recommendInstructions.trim()) body.instructions = recommendInstructions.trim();
      const res = await api(token).post('/tts/recommend-voice', body);
      setVoiceRecommendation(res as VoiceRecommendation);
      toast.success(t('toast.voiceRecommendComplete'));
    } catch (e: unknown) {
      toast.error(friendlyError(e, t('errorMap.recommendFailed')));
    } finally {
      setRecommending(false);
    }
  }, [text, targetLang, token, recommendInstructions]);

  // ─── File upload ──────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['txt', 'md', 'docx'].includes(ext)) {
      toast.error(t('toast.fileTypeError'));
      return;
    }
    if (!token) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const resp = await fetch('/api/tts/parse-file', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setText(data.text);
      setFileName(data.fileName);
      // Reset all results when new file is uploaded
      setTtsResult(null);
      setOptimizeResult(null);
      setTranslationResult(null);
      setVoiceRecommendation(null);
      setAutoTranslatePreview(null);
      toast.success(t('page.parsedFile', { fileName: data.fileName, size: data.size }));
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || t('page.parseFileFailed'));
    }
  };

  const handleClearFile = () => {
    setFileName('');
    setText('');
    setTtsResult(null);
    setOptimizeResult(null);
    setTranslationResult(null);
    setVoiceRecommendation(null);
    setAutoTranslatePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  // ─── B3: Auto-translate on language change ─────
  const [autoTranslatePreview, setAutoTranslatePreview] = useState<{ text: string; lang: string } | null>(null);
  const [autoTranslating, setAutoTranslating] = useState(false);
  const langDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTranslatedText = useRef<string>('');
  const lastTranslatedLang = useRef<string>('');

  // ─── B5: Optimize panel state ──────────────────
  const [optimizePanelOpen, setOptimizePanelOpen] = useState(false);
  const [optimizeInstructions, setOptimizeInstructions] = useState('');
  const [optimizeStyle, setOptimizeStyle] = useState('');
  const [editOptimizeText, setEditOptimizeText] = useState('');
  const [optimizeResultExpanded, setOptimizeResultExpanded] = useState(true);
  const [translationResultExpanded, setTranslationResultExpanded] = useState(true);

  const STYLE_TAGS = [
    { key: 'douyin', label: t('styleTags.douyin'), icon: '🎬' },
    { key: 'news', label: t('styleTags.news'), icon: '📰' },
    { key: 'storytelling', label: t('styleTags.storytelling'), icon: '📖' },
    { key: 'product', label: t('styleTags.product'), icon: '🛍️' },
    { key: 'business', label: t('styleTags.business'), icon: '💼' },
  ];

  const anyLoading = generating || translating || optimizing || recommending;


  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold">{t('page.title')}</h2>
        <p className="text-base text-gray-500 mt-1">{t('page.description')}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* LEFT: 4-Step Flow */}
        <div className="flex-1 space-y-5">

          {/* ─── Reset all ── */}
          {(text || fileName || ttsResult || optimizeResult || translationResult || voiceRecommendation) && (
            <div className="flex items-center justify-end">
              <button
                onClick={() => {
                  setText(''); setFileName(''); setTtsResult(null); setOptimizeResult(null);
                  setTranslationResult(null); setVoiceRecommendation(null); setAutoTranslatePreview(null);
                  setOptimizePanelOpen(false); setRecommendPanelOpen(false);
                  if (fileRef.current) fileRef.current.value = '';
                  if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
                  setAudioPlaying(false);
                  toast.success(t('page.clearedAll'));
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-[13px] text-gray-500 hover:text-red-400 border border-transparent hover:border-red-500/30 rounded-lg transition-all"
              >
                <X size={12} /> {t('toolbar.clearAll')}
              </button>
            </div>
          )}

          {/* ===== STEP 1: 输入文案 ===== */}
          <section className="bg-dark-card rounded-2xl p-6 border border-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-full bg-accent-primary flex items-center justify-center text-sm font-bold text-white">1</span>
              <h2 className="text-lg font-semibold text-white">{t('settings.stepInput')}</h2>
            </div>
            <textarea
              className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-xl text-white focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20 transition-all h-32 resize-none text-base leading-relaxed placeholder:text-gray-500"
              placeholder={t('toolbar.contentPlaceholder')}
              value={text}
              onChange={e => setText(e.target.value)}
              disabled={anyLoading}
            />
            <div className="flex items-center justify-between mt-1 mb-3">
              <span className="text-[13px] text-gray-600">{t('page.characterCount', { count: text.length })}</span>
              <button onClick={() => setText('')} className="text-[13px] text-gray-500 hover:text-gray-300 transition-colors">
                {t('toolbar.clear')}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <input ref={fileRef} type="file" accept=".txt,.md,.docx" onChange={handleFileChange} className="hidden" />
              {fileName ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-accent-primary/10 border border-accent-primary/20 rounded-lg flex-1">
                  <FileText size={14} className="text-accent-primary" />
                  <span className="text-[13px] text-accent-primary flex-1 truncate">{fileName}</span>
                  <button onClick={handleClearFile} className="p-0.5 hover:bg-dark-border rounded">
                    <X size={12} className="text-gray-400" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-dark-bg border border-dark-border rounded-xl text-[13px] text-gray-400 hover:text-gray-300 hover:border-gray-600 transition-colors"
                >
                  <Upload size={14} /> {t('toolbar.uploadBtn')}
                </button>
              )}
            </div>
          </section>

          {/* ===== STEP 2: 选择语言 & AI 辅助 ===== */}
          <section className="bg-dark-card rounded-2xl p-6 border border-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-full bg-purple-500/60 flex items-center justify-center text-sm font-bold text-white">2</span>
              <h2 className="text-lg font-semibold text-white">{t('settings.stepAi')}</h2>
            </div>

            {/* Language selector */}
            <div className="mb-4">
              <label className="text-[13px] text-gray-500 font-medium mb-1.5 block">{t('settings.targetLanguage')}:</label>
              <VoiceLanguageSelector
                voices={voices}
                value={targetLang}
                onChange={(code) => {
                  setTargetLang(code);
                  const firstVoice = voices[code]?.[0]?.id || '';
                  if (firstVoice) setVoice(firstVoice);
                  setVoiceRecommendation(null);
                  // Clear previous translation/optimize results when switching language
                  setTranslationResult(null);
                  setOptimizeResult(null);
                  if (code !== 'zh-CN' && text.trim()) {
                    if (langDebounceRef.current) clearTimeout(langDebounceRef.current);
                    setAutoTranslating(true);
                    setAutoTranslatePreview(null);
                    langDebounceRef.current = setTimeout(async () => {
                      try {
                        const res = await api(token!).post('/tts/translate', { text: text.trim(), targetLang: code });
                        setAutoTranslatePreview({ text: (res as TranslationResult).translated, lang: code });
                        lastTranslatedText.current = text.trim();
                        lastTranslatedLang.current = code;
                      } catch { } finally { setAutoTranslating(false); }
                    }, 500);
                  } else if (code === 'zh-CN') { setAutoTranslatePreview(null); setAutoTranslating(false); }
                }}
              />
              {autoTranslating && <Loader2 size={10} className="animate-spin inline-block ml-1 mt-1 text-accent-primary" />}
            </div>

            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <button onClick={() => { setOptimizeStyle(''); setOptimizeInstructions(''); setEditOptimizeText(text); setOptimizePanelOpen(!optimizePanelOpen); }}
                disabled={anyLoading}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] transition-all ${optimizePanelOpen ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-dark-bg border border-dark-border text-gray-400 hover:text-gray-300 hover:border-gray-600'} disabled:opacity-40 disabled:cursor-not-allowed`}>
                <Wand2 size={13} /> {t('toolbar.customOptimize')}
              </button>
              <button onClick={handleOptimize} disabled={!text.trim() || anyLoading}
                className="flex items-center gap-1.5 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-dark-bg rounded-lg text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-sm shadow-amber-500/25">
                <Sparkles size={13} /> {optimizing ? t('toolbar.optimizingStatus') : t('toolbar.oneClickOptimize')}
              </button>
              <button onClick={handleTranslateOnly} disabled={translating || !text.trim() || anyLoading}
                className="flex items-center gap-1.5 px-5 py-2 bg-dark-bg border border-dark-border hover:border-green-500/40 hover:bg-green-500/5 rounded-lg text-[13px] text-gray-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95">
                <Globe size={13} /> {translating ? t('toolbar.translatingStatus') : t('toolbar.translateOnly')}
              </button>
            </div>

            {/* Optimize settings panel */}
            {optimizePanelOpen && (
              <div className="bg-dark-bg rounded-xl border border-amber-500/20 overflow-hidden animate-fade-in p-4 space-y-4 mb-3">
                <div className="flex items-center gap-2">
                  <Settings2 size={14} className="text-amber-400" />
                  <span className="text-[13px] font-semibold text-amber-400">{t('settings.advancedSettings')}</span>
                </div>
                <div>
                  <label className="block text-[13px] text-gray-500 mb-1.5 font-medium">{t('settings.editSourceLabel')}</label>
                  <textarea
                    className="w-full px-3 py-2.5 bg-dark-card border border-dark-border rounded-lg text-white text-[13px] focus:outline-none focus:border-amber-500/30 resize-none h-20 placeholder:text-gray-500"
                    value={editOptimizeText}
                    onChange={e => setEditOptimizeText(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[13px] text-gray-500 mb-1.5 font-medium">{t('settings.optimizationInstructions')}</label>
                  <textarea
                    className="w-full px-3 py-2.5 bg-dark-card border border-dark-border rounded-lg text-white text-[13px] focus:outline-none focus:border-amber-500/30 resize-none h-16 placeholder:text-gray-500"
                    placeholder={t('settings.optimizationPlaceholder')}
                    value={optimizeInstructions}
                    onChange={e => setOptimizeInstructions(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[13px] text-gray-500 mb-1.5 font-medium">{t('settings.presetStyles')}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {STYLE_TAGS.map(s => (
                      <button key={s.key}
                        onClick={() => {
                          const styleMap: Record<string, string> = {
                            douyin: t('styleTags.douyin'), news: t('styleTags.news'),
                            storytelling: t('styleTags.storytelling'), product: t('styleTags.product'), business: t('styleTags.business'),
                          };
                          setOptimizeStyle(s.key); setOptimizeInstructions(styleMap[s.key] || '');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[13px] font-medium transition-all ${optimizeStyle === s.key ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-dark-card text-gray-400 border border-dark-border hover:border-gray-600'}`}>
                        {s.icon} {s.label}
                      </button>
                    ))}
                    {optimizeStyle && (
                      <button onClick={() => { setOptimizeStyle(''); setOptimizeInstructions(''); }}
                        className="px-2 py-1 rounded-lg text-xs text-gray-600 hover:text-gray-400 transition-colors">
                        <X size={12} /> {t('settings.clearStyle')}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const sourceText = editOptimizeText.trim();
                      if (!sourceText) return toast.error(t('settings.confirmEdit'));
                      if (!token) return;
                      setOptimizing(true);
                      try {
                        const body: Record<string, unknown> = { text: sourceText, targetLang };
                        if (optimizeInstructions.trim()) body.instructions = optimizeInstructions.trim();
                        if (optimizeStyle) body.style = optimizeStyle;
                        const res = await api(token).post('/tts/optimize', body);
                        setOptimizeResult(res as OptimizeResult);
                        toast.success(t('toast.contentOptimized'));
                      } catch (e: unknown) { toast.error(friendlyError(e, t('errorMap.optimizeFailed'))); }
                      finally { setOptimizing(false); }
                    }}
                    disabled={optimizing || !editOptimizeText.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-dark-bg rounded-lg text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                  >
                    {optimizing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                    {optimizing ? t('toolbar.optimizingStatus') : t('settings.applyCustomInstructions')}
                  </button>
                  <button onClick={() => { setOptimizePanelOpen(false); setOptimizeInstructions(''); setOptimizeStyle(''); }}
                    className="px-4 py-2 bg-dark-card border border-dark-border hover:border-gray-600 rounded-lg text-[13px] text-gray-400 transition-all">
                    {t('toolbar.cancel')}
                  </button>
                </div>
              </div>
            )}

            {/* Auto-translate preview */}
            {autoTranslatePreview && targetLang !== 'zh-CN' && (
              <div className="bg-dark-bg rounded-xl border border-green-500/15 overflow-hidden animate-fade-in mb-3">
                <div className="px-4 py-2.5 flex items-center gap-2">
                  <Globe size={13} className="text-green-400 flex-shrink-0" />
                  <span className="text-[13px] text-green-400/80 font-semibold">{t('preview.translatePreview')}</span>
                  <span className="text-[13px] text-gray-500">{getLangLabel(autoTranslatePreview.lang)}</span>
                  <button onClick={() => setTranslationResult({ original: text, translated: autoTranslatePreview.text, targetLang: autoTranslatePreview.lang })}
                    className="ml-auto text-xs text-gray-500 hover:text-green-400 transition-colors flex items-center gap-1">
                    {t('toolbar.viewDetails')} <Info size={10} />
                  </button>
                </div>
                <div className="px-4 pb-3 text-sm text-white/80 leading-relaxed max-h-24 overflow-y-auto">{autoTranslatePreview.text}</div>
              </div>
            )}

            {/* Translation result */}
            {translationResult && (
              <div className="bg-dark-bg rounded-xl border border-green-500/20 overflow-hidden animate-fade-in">
                <button onClick={() => setTranslationResultExpanded(!translationResultExpanded)}
                  className="w-full px-4 py-3 flex items-center gap-2 hover:bg-white/5 transition-colors">
                  <Globe size={14} className="text-green-400 flex-shrink-0" />
                  <span className="text-[13px] font-semibold text-green-400">{t('status.translationResult')}</span>
                  <span className="text-[13px] text-gray-500">{getLangLabel(translationResult.targetLang)}</span>
                  <span className="text-[13px] text-gray-500 ml-auto">{translationResult.translated.slice(0, 30)}…</span>
                  {translationResultExpanded ? <ChevronUp size={14} className="text-gray-500 flex-shrink-0" /> : <ChevronDown size={14} className="text-gray-500 flex-shrink-0" />}
                </button>
                {translationResultExpanded && (
                  <div className="p-4 space-y-3 border-t border-dark-border/50">
                    <div>
                      <span className="text-[13px] text-gray-500 uppercase tracking-wider">{t('translationResult.original')}</span>
                      <div className="text-[13px] text-white/70 bg-dark-card rounded-lg p-3 mt-1 leading-relaxed max-h-40 overflow-y-auto">{translationResult.original}</div>
                    </div>
                    <div>
                      <span className="text-xs text-green-400 uppercase tracking-wider">{t('translationResult.translated')}</span>
                      <div className="text-[13px] text-white/90 bg-dark-card rounded-lg p-3 mt-1 leading-relaxed border-l-2 border-green-500/30 max-h-40 overflow-y-auto">{translationResult.translated}</div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <button onClick={() => { navigator.clipboard.writeText(translationResult.translated); toast.success(t('page.copiedTranslation')); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-dark-card border border-dark-border rounded-lg text-[13px] text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-all">
                        <Copy size={11} /> {t('toolbar.copyTranslation')}
                      </button>
                      <button onClick={() => downloadFile(translationResult.translated, `translation_${translationResult.targetLang}_${Date.now()}.txt`, 'text/plain;charset=utf-8')}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-500/15 text-green-400 border border-green-500/25 rounded-lg text-xs font-medium hover:bg-green-500/25 transition-all">
                        <Download size={11} /> {t('toolbar.downloadTxt')}
                      </button>
                      <button onClick={() => { setText(translationResult.translated); toast.success(t('page.filledTranslation')); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-accent-primary/15 text-accent-primary border border-accent-primary/25 rounded-lg text-xs font-medium hover:bg-accent-primary/25 transition-all">
                        <CornerDownLeft size={11} /> {t('toolbar.useThis')}
                      </button>
                      <button onClick={() => handleGenerate(translationResult.translated, true)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-accent-primary text-white rounded-lg text-xs font-semibold hover:bg-accent-primary/80 transition-all active:scale-95 shadow-sm shadow-accent-primary/25">
                        <Mic size={11} /> {t('toolbar.synthesizeDirectly')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

            {/* Optimize result */}
            {optimizeResult && (
              <div className="bg-dark-bg rounded-lg border border-amber-500/20 overflow-hidden animate-fade-in mb-3">
                <button onClick={() => setOptimizeResultExpanded(!optimizeResultExpanded)}
                  className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-white/5 transition-colors">
                  <Wand2 size={14} className="text-amber-400" />
                  <span className="text-[13px] font-semibold text-amber-400">{t('status.optimizeResult')}</span>
                  <span className="text-[13px] text-gray-500 ml-auto">{optimizeResult.optimized.slice(0, 30)}…</span>
                  {optimizeResultExpanded ? <ChevronUp size={14} className="text-gray-500 flex-shrink-0" /> : <ChevronDown size={14} className="text-gray-500 flex-shrink-0" />}
                </button>
                {optimizeResultExpanded && (
                  <div className="p-4 space-y-3">
                    <div>
                      <span className="text-[13px] text-gray-500 uppercase tracking-wider">{t('optimizeResult.before')}</span>
                      <div className="text-[13px] text-white/70 bg-dark-card rounded-lg p-3 mt-1 leading-relaxed max-h-32 overflow-y-auto">{optimizeResult.original}</div>
                    </div>
                    <div>
                      <span className="text-xs text-amber-400 uppercase tracking-wider">{t('optimizeResult.after')}</span>
                      <div className="text-[13px] text-white/90 bg-dark-card rounded-lg p-3 mt-1 leading-relaxed border-l-2 border-amber-500/40 max-h-32 overflow-y-auto">{optimizeResult.optimized}</div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <button onClick={() => { navigator.clipboard.writeText(optimizeResult.optimized); toast.success(t('page.copiedOptimized')); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-dark-card border border-dark-border rounded-lg text-[13px] text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-all">
                        <Copy size={11} /> {t('toolbar.copyOptimized')}
                      </button>
                      <button onClick={() => { setText(optimizeResult.optimized); toast.success(t('page.filledOptimized')); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-accent-primary/15 text-accent-primary border border-accent-primary/25 rounded-lg text-xs font-medium hover:bg-accent-primary/25 transition-all">
                        <CornerDownLeft size={11} /> {t('toolbar.useThis')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          {/* ===== STEP 3: 选择音色 ===== */}
          <section className="bg-dark-card rounded-2xl p-6 border border-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-full bg-accent-primary flex items-center justify-center text-sm font-bold text-white">3</span>
              <h2 className="text-lg font-semibold text-white">{t('settings.stepVoice')}</h2>
            </div>

            {/* Voice cards with AI recommend */}
            {Object.keys(voices).length > 0 && voices[targetLang] && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[13px] text-gray-500 font-medium">{t('toolbar.voiceRole')}</label>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => { setRecommendPanelOpen(!recommendPanelOpen); setRecommendInstructions(''); }}
                      disabled={anyLoading}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[13px] transition-all ${recommendPanelOpen ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-gray-500 hover:text-gray-300'} disabled:opacity-40 disabled:cursor-not-allowed`}>
                      <Settings2 size={11} /> {recommendPanelOpen ? t('toolbar.collapsePreferences') : t('toolbar.recommendPreferences')}
                    </button>
                    <button onClick={handleRecommendVoice} disabled={recommending || !text.trim() || anyLoading}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[13px] font-semibold transition-all bg-purple-500 hover:bg-purple-400 text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-95">
                      {recommending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      {recommending ? t('toolbar.recommendingStatus') : t('toolbar.aiRecommendVoice')}
                    </button>
                  </div>
                </div>
                {recommendPanelOpen && (
                  <div className="bg-dark-bg rounded-lg border border-purple-500/15 p-3 mb-2 animate-fade-in space-y-3">
                    <textarea
                      className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-white text-xs focus:outline-none focus:border-purple-500/30 resize-none h-14 placeholder:text-gray-500"
                      placeholder={t('toolbar.recommendPreferencesPlaceholder')}
                      value={recommendInstructions}
                      onChange={e => setRecommendInstructions(e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <button onClick={handleRecommendVoice} disabled={recommending || !text.trim() || anyLoading}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-500 hover:bg-purple-400 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95">
                        <Sparkles size={12} /> {t('toolbar.recommendByPreference')}
                      </button>
                      <button onClick={() => { setRecommendPanelOpen(false); setRecommendInstructions(''); }}
                        className="px-3 py-1.5 bg-dark-card border border-dark-border rounded-lg text-xs text-gray-400 hover:text-gray-300 transition-all">
                        {t('toolbar.cancel')}
                      </button>
                    </div>
                  </div>
                )}
                <VoiceSelector
                  voices={voices} lang={targetLang} value={voice}
                  onChange={(voiceId) => setVoice(voiceId)}
                  onPreview={async (voiceId) => {
                    if (!token || previewLoadingId) return;
                    setPreviewLoadingId(voiceId);
                    try {
                      if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null; }
                      const url = `/api/tts/preview/${voiceId}?token=${encodeURIComponent(token)}`;
                      const audio = new Audio(url);
                      audio.volume = 0.8;
                      previewAudioRef.current = audio;
                      await audio.play();
                      audio.addEventListener('ended', () => { previewAudioRef.current = null; setPreviewLoadingId(null); });
                    } catch (e: unknown) {
                      toast.error(friendlyError(e, t('errorMap.previewFailed') || 'Preview failed'));
                      setPreviewLoadingId(null);
                      previewAudioRef.current = null;
                    }
                  }}
                  previewLoadingId={previewLoadingId}
                />
              </div>
            )}

            {/* Voice recommendation card */}
            {voiceRecommendation && (
              <div className="bg-dark-bg rounded-xl border border-purple-500/20 overflow-hidden animate-fade-in mb-4">
                <div className="px-4 py-3 border-b border-dark-border flex items-center gap-2">
                  <Sparkles size={14} className="text-purple-400" />
                  <span className="text-xs font-medium text-purple-400">{t('status.aiVoiceRecommendations')}</span>
                  {voiceRecommendation.tone && <span className="text-xs text-gray-500 ml-auto">{t('status.baseTone')}：{voiceRecommendation.tone}</span>}
                </div>
                <div className="p-3 space-y-2">
                  {voiceRecommendation.recommendations.map((rec, i) => (
                    <div key={rec.id} className="flex items-center gap-3 bg-dark-card rounded-lg p-3">
                      <span className="text-xs text-purple-400 font-bold">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/90">{rec.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{rec.reason}</p>
                      </div>
                      <button onClick={() => setVoice(rec.id)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${voice === rec.id ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20'}`}>
                        {voice === rec.id ? t('toolbar.selectedVoice') : t('toolbar.selectThisVoice')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Speed slider */}
            <div>
              <label className="block text-[13px] text-gray-500 mb-1.5 font-medium">{t('page.speedLabel')}: {speed}</label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-600">{t('page.speedSlow')}</span>
                <input type="range" min="-50" max="100" step="10"
                  value={parseInt(speed)}
                  onChange={e => { const v = parseInt(e.target.value); setSpeed((v >= 0 ? '+' : '') + v + '%'); }}
                  className="flex-1 accent-accent-primary h-1.5" />
                <span className="text-xs text-gray-600">{t('page.speedFast')}</span>
              </div>
            </div>
          </section>

          {/* ===== STEP 4: 生成 & 下载 ===== */}
          <section className="bg-dark-card rounded-2xl p-6 border border-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-full bg-green-500/60 flex items-center justify-center text-sm font-bold text-white">4</span>
              <h2 className="text-lg font-semibold text-white">{t('settings.stepGenerate')}</h2>
            </div>

            <button onClick={() => handleGenerate()} disabled={generating || !text.trim() || anyLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-accent-primary to-blue-600 rounded-xl text-base font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shadow-sm shadow-accent-primary/25">
              {generating ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} />}
              {generating ? t('toolbar.generatingStatus') : t('toolbar.generateVoice')}
            </button>

            {/* Audio player */}
            {ttsResult && (
              <div className="mt-4 bg-dark-bg rounded-xl border border-dark-border p-4 animate-fade-in">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">🎧</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/90 truncate">tts_{ttsResult.id}.mp3</p>
                    <p className="text-xs text-gray-500">{getLangLabel(ttsResult.lang)} · {ttsResult.voice}</p>
                  </div>
                  <button onClick={() => handlePlay(ttsResult.url, 'ttsResult')}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${playingId === 'ttsResult' && audioPlaying ? 'bg-accent-primary text-white' : 'bg-dark-card border border-dark-border text-gray-400 hover:text-white hover:border-gray-500'}`}>
                    {playingId === 'ttsResult' && audioPlaying ? <Volume2 size={16} /> : <Play size={16} />}
                  </button>
                </div>
                <button
                  onClick={() => downloadFile(JSON.stringify(ttsResult, null, 2), `tts_result_${Date.now()}.json`, 'application/json')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-sm font-semibold hover:bg-green-500/20 transition-colors">
                  <Download size={14} /> {t('toolbar.downloadMp3')}
                </button>
              </div>
            )}
          </section>

        </div>

        {/* RIGHT: History sidebar */}
        <aside className="lg:w-80 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">{t('history.title')}</h3>
            <span className="text-xs text-gray-500">{t('history.tip')}</span>
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-gray-500" />
            </div>
          ) : ttsHistory.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <p className="text-sm">{t('history.empty')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ttsHistory.map((item) => (
                <div key={item.id} className="bg-dark-card border border-dark-border rounded-xl p-3.5 space-y-2.5">
                  <p className="text-[13px] text-white/80 line-clamp-2 leading-relaxed">{item.text}</p>
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500 flex-wrap">
                    <span>{getLangLabel(item.language)}</span>
                    <span>·</span>
                    <span>{item.voice}</span>
                    {item.createdAt && (
                      <>
                        <span>·</span>
                        <span>{new Date(item.createdAt).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric' })} {new Date(item.createdAt).toLocaleTimeString(i18n.language === 'en' ? 'en-US' : 'zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 pt-1.5 border-t border-dark-border">
                    <button onClick={() => setText(item.text)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs bg-dark-bg/50 text-gray-400 hover:text-white transition-colors">
                      <Languages size={11} /> {t('history.fill')}
                    </button>
                    <button
                      onClick={() => handlePlay(`/api/tts/audio/${item.audioPath}`, item.id)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs transition-colors ${playingId === item.id ? (audioPlaying ? 'bg-accent-primary/20 text-accent-primary' : 'bg-yellow-400/10 text-yellow-400') : 'bg-dark-bg/50 text-gray-400 hover:text-white'}`}>
                      {playingId === item.id && audioPlaying ? '⏸' : '▶️'} {playingId === item.id ? (audioPlaying ? t('history.pause') : t('history.resume')) : t('history.play')}
                    </button>
                    <a href={`/api/tts/audio/${item.audioPath}?token=${encodeURIComponent(token || '')}`} download={`tts_${item.id}.mp3`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs bg-dark-bg/50 text-gray-400 hover:text-green-400 transition-colors"
                      onClick={(e) => { e.currentTarget.target = '_blank'; }}>
                      ⬇️ {t('history.download')}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      <audio id="tts-history-player" className="hidden" />
    </div>
  );
}

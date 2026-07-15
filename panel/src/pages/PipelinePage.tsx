import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getPipelineStatus,
  generateContent,
  synthesizeSpeech,
  fetchVoices,
  type PipelineStatus,
  type Voice,
} from '../lib/pipelineClient';
import { getToken } from '../token';

type Tab = 'copywriting' | 'tts';

const PLATFORMS = ['Twitter', 'WeChat', 'Instagram', 'Xiaohongshu', 'LinkedIn'];
const STYLES = ['Professional', 'Casual', 'Humorous', 'Inspirational', 'Technical'];

export default function PipelinePage() {
  const [tab, setTab] = useState<Tab>('copywriting');
  const { t } = useTranslation('pipeline');
  const [pipeline, setPipeline] = useState<PipelineStatus | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Copywriting
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState('Twitter');
  const [style, setStyle] = useState('Professional');
  const [result, setResult] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // TTS
  const [ttsText, setTtsText] = useState('');
  const [voiceId, setVoiceId] = useState('zh-CN-XiaoxiaoNeural');
  const [audioUrl, setAudioUrl] = useState('');
  const [synthesizing, setSynthesizing] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const token = getToken();
        const [p, v] = await Promise.all([
          getPipelineStatus(token).catch(() => null),
          fetchVoices(token).then((data: any) => Array.isArray(data) ? data : (data?.voices || [])).catch(() => []),
        ]);
        setPipeline(p);
        setVoices(v);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleGenerate = async () => {
    if (!topic.trim()) { showToast('Please enter a topic', 'error'); return; }
    setGenerating(true);
    setResult('');
    try {
      const token = getToken();
      const { content } = await generateContent(token, { topic, platform, style });
      setResult(content);
    } catch (e: any) {
      showToast(e.message || 'Generation failed', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSynthesize = async () => {
    if (!ttsText.trim()) { showToast('Please enter text', 'error'); return; }
    setSynthesizing(true);
    try {
      const token = getToken();
      const { audioUrl: url } = await synthesizeSpeech(token, { text: ttsText, voice: voiceId });
      setAudioUrl(url);
    } catch (e: any) {
      showToast(e.message || 'Synthesis failed', 'error');
    } finally {
      setSynthesizing(false);
    }
  };

  const groupedVoices: Record<string, Voice[]> = {};
  voices.forEach(v => {
    const lang = v.id.startsWith('zh') ? '中文' : 'English';
    if (!groupedVoices[lang]) groupedVoices[lang] = [];
    groupedVoices[lang].push(v);
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center text-[#9ca3af]">
        <div className="animate-pulse">Loading AI Pipeline...</div>
      </div>
    );
  }

  return (
    <div className="text-white">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg text-sm font-medium ${toast.type === 'success' ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <Link to="/dashboard" className="text-[#9ca3af] hover:text-white text-sm mb-4 inline-block">← Back to Dashboard</Link>
        <h1 className="text-3xl font-bold mb-2">{t('pipeline:page.title', 'AI Pipeline')}</h1>
        <p className="text-[#9ca3af] text-sm mb-6">Generate content and speech with your own API keys</p>

        {/* Key Status Bar */}
        <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-4 mb-6 flex flex-wrap gap-4 items-center">
          <span className="text-xs text-[#9ca3af] uppercase tracking-wider">Key Status</span>
          {pipeline?.keys && Object.entries(pipeline.keys).map(([service, info]) => (
            <span key={service} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${info.valid ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${info.valid ? 'bg-green-400' : 'bg-red-400'}`} />
              {info.label || service}
            </span>
          ))}
          {(!pipeline?.keys || Object.keys(pipeline.keys).length === 0) && (
            <span className="text-xs text-[#9ca3af]">Please configure API keys in Settings</span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[#2a2a3e]">
          {(['copywriting', 'tts'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px capitalize ${
                tab === t ? 'text-white border-[#6366f1]' : 'text-[#9ca3af] border-transparent hover:text-white'
              }`}>
              {t === 'copywriting' ? '✍️ Copywriting' : '🔊 TTS'}
            </button>
          ))}
        </div>

        {/* ──────── COPYWRITING TAB ──────── */}
        {tab === 'copywriting' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-6 space-y-4">
              <div>
                <label className="block text-sm text-[#9ca3af] mb-1">Topic</label>
                <textarea value={topic} onChange={e => setTopic(e.target.value)}
                  placeholder="What do you want to write about?"
                  rows={3}
                  className="w-full bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#6366f1] transition-colors resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[#9ca3af] mb-1">Platform</label>
                  <select value={platform} onChange={e => setPlatform(e.target.value)}
                    className="w-full bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#6366f1]">
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[#9ca3af] mb-1">Style</label>
                  <select value={style} onChange={e => setStyle(e.target.value)}
                    className="w-full bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#6366f1]">
                    {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={handleGenerate} disabled={generating}
                className="w-full bg-[#6366f1] hover:bg-[#5558e6] disabled:opacity-50 text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                {generating ? (
                  <><span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Generating...</>
                ) : 'Generate Content'}
              </button>
            </div>

            <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-6 min-h-[200px]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-[#9ca3af]">Result</h3>
                {result && (
                  <button onClick={handleCopy}
                    className="text-xs px-3 py-1 rounded bg-[#2a2a3e] hover:bg-[#3a3a4e] text-[#9ca3af] hover:text-white transition-colors">
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                )}
              </div>
              {generating ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-3 bg-[#2a2a3e] rounded w-3/4" />
                  <div className="h-3 bg-[#2a2a3e] rounded w-full" />
                  <div className="h-3 bg-[#2a2a3e] rounded w-5/6" />
                  <div className="h-3 bg-[#2a2a3e] rounded w-2/3" />
                </div>
              ) : result ? (
                <div className="text-sm leading-relaxed whitespace-pre-wrap text-[#e5e7eb]">{result}</div>
              ) : (
                <div className="text-sm text-[#6b7280] text-center py-12">
                  Generated content will appear here
                </div>
              )}
            </div>
          </div>
        )}

        {/* ──────── TTS TAB ──────── */}
        {tab === 'tts' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-6 space-y-4">
              <div>
                <label className="block text-sm text-[#9ca3af] mb-1">
                  Text <span className="text-xs">({ttsText.length}/500)</span>
                </label>
                <textarea value={ttsText} onChange={e => setTtsText(e.target.value.slice(0, 500))}
                  placeholder="Enter text to convert to speech..."
                  rows={4}
                  className="w-full bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#6366f1] transition-colors resize-none" />
              </div>
              <div>
                <label className="block text-sm text-[#9ca3af] mb-1">Voice</label>
                <select value={voiceId} onChange={e => setVoiceId(e.target.value)}
                  className="w-full bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#6366f1]">
                  {Object.entries(groupedVoices).map(([lang, vs]) => (
                    <optgroup key={lang} label={lang}>
                      {vs.map(v => <option key={v.id} value={v.id}>{v.name} ({v.gender})</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <button onClick={handleSynthesize} disabled={synthesizing}
                className="w-full bg-[#6366f1] hover:bg-[#5558e6] disabled:opacity-50 text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                {synthesizing ? (
                  <><span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Synthesizing...</>
                ) : 'Synthesize Speech'}
              </button>
            </div>

            <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-6 min-h-[200px] flex flex-col items-center justify-center">
              <h3 className="text-sm font-medium text-[#9ca3af] mb-4">Player</h3>
              {synthesizing ? (
                <div className="animate-pulse text-sm text-[#6b7280]">Synthesizing audio...</div>
              ) : audioUrl ? (
                <div className="w-full">
                  <audio ref={audioRef} controls className="w-full" src={audioUrl}>
                    Your browser does not support audio.
                  </audio>
                  <a href={audioUrl} download
                    className="inline-block mt-3 text-xs text-[#6366f1] hover:underline">
                    Download MP3
                  </a>
                </div>
              ) : (
                <div className="text-sm text-[#6b7280] text-center py-12">
                  🔊 Synthesized audio will play here
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

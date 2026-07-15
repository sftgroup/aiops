import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Play } from 'lucide-react';

interface VideoGeneratePanelProps {
  generating: boolean;
  wsFallback: boolean;
  subject: string;
  progressMsg: string;
  onGenerate: () => void;
}

export default function VideoGeneratePanel({
  generating, wsFallback, subject, progressMsg, onGenerate,
}: VideoGeneratePanelProps) {
  const { t } = useTranslation(['video', 'common']);
  return (
    <div role="region" aria-label={t('generatePanel.progressLabel')}>
      {/* WS fallback banner */}
      {wsFallback && generating && (
        <div
          className="flex items-center gap-2 px-3 py-2 mb-2 text-xs text-yellow-400 bg-yellow-500/5 border border-yellow-500/20 rounded-lg"
          role="alert"
          aria-live="polite"
        >
          <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" aria-hidden="true" />
          {t('generatePanel.wsFallback')}
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        disabled={generating || !subject.trim()}
        className="flex items-center justify-center gap-2 w-full py-4 sm:py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl font-medium transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-purple-900/30 text-sm sm:text-base"
        style={{ minHeight: 52 }}
        aria-label={generating ? t('generatePanel.ariaLabelGenerating') : t('generatePanel.ariaLabelGenerate')}
      >
        {generating ? (
          <Loader2 size={20} className="animate-spin" aria-hidden="true" />
        ) : (
          <Play size={20} aria-hidden="true" />
        )}
        {generating ? t('generatePanel.generating') : t('generatePanel.generateButton')}
      </button>

      {/* Disabled reason hints */}
      {!generating && !subject.trim() && (
        <p className="text-[11px] text-gray-500 mt-1.5 px-1">{t('generatePanel.subjectHint')}</p>
      )}

      {/* Real-time Progress */}
      {generating && (
        <div
          className="flex items-center gap-3 mt-3 px-2 py-2.5 bg-blue-500/5 border border-blue-500/20 rounded-lg animate-fade-in"
          aria-live="polite"
        >
          <div className="w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin flex-shrink-0" aria-hidden="true" />
          <span className="text-sm text-blue-300">{progressMsg}</span>
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Sparkles, FileText } from 'lucide-react';

interface VideoScriptCardProps {
  script: string;
  setScript: (v: string) => void;
  generatingScript: boolean;
  generating: boolean;
  subject: string;
  onGenerateScript: () => void;
}

export default function VideoScriptCard({
  script, setScript,
  generatingScript, generating,
  subject,
  onGenerateScript,
}: VideoScriptCardProps) {
  const { t } = useTranslation(['video', 'common']);
  return (
    <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden" role="region" aria-label={t('scriptCard.ariaLabel')}>
      <div className="px-5 py-4 border-b border-dark-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0" aria-hidden="true">
            <FileText size={16} className="text-blue-400" aria-hidden="true" />
          </span>
          <h3 className="font-semibold sm:text-base text-sm truncate">{t('scriptCard.heading')}</h3>
        </div>
        <button
          onClick={onGenerateScript}
          disabled={generatingScript || !subject.trim()}
          className="flex items-center gap-1.5 px-3 py-2.5 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl hover:bg-blue-500/20 transition-all disabled:opacity-40 shrink-0"
          style={{ minHeight: 44 }}
          aria-label={generatingScript ? t('scriptCard.generatingAriaLabel') : t('scriptCard.generateAriaLabel')}
        >
          {generatingScript ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
          {generatingScript ? t('scriptCard.generating') : t('scriptCard.generateButton')}
        </button>
      </div>
      <div className="p-4 sm:p-5">
        <textarea
          className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-xl text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all h-36 resize-none text-sm leading-relaxed placeholder:text-gray-600"
          value={script}
          onChange={e => setScript(e.target.value)}
          placeholder={t('scriptCard.placeholder')}
          disabled={generating}
          aria-label={t('scriptCard.heading')}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-600">
            {script.length > 0 ? t('scriptCard.charCount', { count: script.length }) : ''}
          </span>
          {script && (
            <button
              onClick={() => setScript('')}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors rounded-lg hover:bg-dark-hover"
              style={{ minHeight: 44, minWidth: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label={t('scriptCard.clearAriaLabel')}
            >
              {t('scriptCard.clearButton')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

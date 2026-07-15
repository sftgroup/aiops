import React from 'react';
import { useTranslation } from 'react-i18next';

interface VideoErrorBannerProps {
  errorMsg: string;
  onRetry: () => void;
  onDismiss: () => void;
}

export default function VideoErrorBanner({ errorMsg, onRetry, onDismiss }: VideoErrorBannerProps) {
  const { t } = useTranslation(['video', 'common']);

  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-3" role="alert" aria-live="assertive" aria-label={t('errorBanner.ariaLabel')}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-red-400">{errorMsg}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={onRetry}
            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm text-red-400 transition-colors"
          >
            {t('common:retry', '重试')}
          </button>
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 bg-dark-border hover:bg-gray-600 rounded-lg text-sm text-gray-400 transition-colors"
          >
            {t('common:dismiss', '忽略')}
          </button>
        </div>
      </div>
    </div>
  );
}

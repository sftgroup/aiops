import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ShortcutGroup {
  titleKey: string;
  items: { keys: string; descKey: string }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 bg-dark-bg border border-dark-border rounded text-[11px] font-mono text-gray-300 leading-none">
      {children}
    </kbd>
  );
}

export default function KeyboardShortcutsHelp({ open, onClose }: Props) {
  const { t } = useTranslation(['video', 'common']);
  const containerRef = useFocusTrap(open);

  const GROUPS: ShortcutGroup[] = [
    {
      titleKey: 'keyboardShortcuts.videoGroup',
      items: [
        { keys: 'Space', descKey: 'keyboardShortcuts.spaceDesc' },
        { keys: '← / →', descKey: 'keyboardShortcuts.seekDesc' },
        { keys: '↑ / ↓', descKey: 'keyboardShortcuts.volumeDesc' },
        { keys: 'M', descKey: 'keyboardShortcuts.muteDesc' },
        { keys: 'F', descKey: 'keyboardShortcuts.fullscreenDesc' },
        { keys: 'ESC', descKey: 'keyboardShortcuts.closeVideoDesc' },
      ],
    },
    {
      titleKey: 'keyboardShortcuts.globalGroup',
      items: [
        { keys: '? / Shift+/', descKey: 'keyboardShortcuts.helpDesc' },
        { keys: 'ESC', descKey: 'keyboardShortcuts.closeModalDesc' },
        { keys: 'Ctrl/Cmd + K', descKey: 'keyboardShortcuts.searchDesc' },
      ],
    },
  ];

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('keyboardShortcuts.ariaLabel')}
    >
      <div
        className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border shrink-0">
          <h3 className="font-semibold text-white flex items-center gap-2">
            {t('keyboardShortcuts.heading')}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-dark-hover transition-colors"
            aria-label={t('keyboardShortcuts.closeAria')}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Shortcut list ────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {GROUPS.map((group) => (
            <section key={group.titleKey}>
              <h4 className="text-xs font-medium text-gray-400 mb-2">{t(group.titleKey)}</h4>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <div
                    key={item.keys}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-300">{t(item.descKey)}</span>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      {item.keys.split(' / ').map((k, i) => (
                        <React.Fragment key={k}>
                          {i > 0 && <span className="text-gray-600 text-xs">/</span>}
                          <Kbd>{k}</Kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <p className="text-[11px] text-gray-600 leading-relaxed border-t border-dark-border pt-3">
            {t('keyboardShortcuts.tip')}
          </p>
        </div>
      </div>
    </div>
  );
}

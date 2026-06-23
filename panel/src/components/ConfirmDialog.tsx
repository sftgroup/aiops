import { useState, useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * ConfirmDialog — a non-blocking replacement for `window.confirm()`.
 * Desktop: centered modal. Mobile (<640px): bottom sheet.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '确定',
  cancelLabel = '取消',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [visible, setVisible] = useState(false);
  const [animIn, setAnimIn] = useState(false);
  const containerRef = useFocusTrap(open && visible);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimIn(true)));
    } else {
      setAnimIn(false);
      const t = setTimeout(() => setVisible(false), 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Auto-focus the confirm button when dialog opens (for desktop modal)
  useEffect(() => {
    if (open && visible) {
      // Small delay to ensure DOM is rendered
      const raf = requestAnimationFrame(() => {
        confirmBtnRef.current?.focus();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [open, visible]);

  if (!visible) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      {/* Overlay — shared */}
      <div
        className={`fixed inset-0 z-[9999] transition-opacity duration-200 ${
          animIn ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onCancel}
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      </div>

      {/* Desktop: centered modal */}
      <div className="hidden sm:block" role="dialog" aria-modal="true" aria-label={title}>
        {visible && (
          <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center transition-all duration-200 ${
              animIn ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
            onClick={onCancel}
          >
            <div
              className="bg-dark-card border border-dark-border rounded-xl w-full max-w-sm mx-4 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    variant === 'danger' ? 'bg-red-500/20' : 'bg-accent-primary/20'
                  }`}
                  aria-hidden="true"
                >
                  <AlertTriangle
                    size={20}
                    className={variant === 'danger' ? 'text-red-400' : 'text-accent-primary'}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-white" id="confirm-dialog-title">{title}</h3>
                  <p className="text-sm text-gray-400 mt-1.5" id="confirm-dialog-message">{message}</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={onCancel}
                  className="px-4 py-2 text-sm text-gray-400 border border-dark-border rounded-lg hover:text-white hover:bg-dark-hover transition-colors"
                  aria-label={cancelLabel}
                >
                  {cancelLabel}
                </button>
                <button
                  ref={confirmBtnRef}
                  onClick={onConfirm}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    variant === 'danger'
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-accent-primary hover:bg-accent-primary/80 text-white'
                  }`}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile (<640px): bottom sheet */}
      <div className="sm:hidden" role="dialog" aria-modal="true" aria-label={title}>
        {visible && (
          <div
            className={`fixed inset-0 z-[9999] flex flex-col justify-end transition-all duration-200`}
            onClick={onCancel}
          >
            <div
              className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
                animIn ? 'opacity-100' : 'opacity-0'
              }`}
              onClick={onCancel}
              aria-hidden="true"
            />
            <div
              className={`relative bg-dark-card border border-dark-border rounded-t-2xl px-5 pb-8 pt-6 animate-slide-up safe-bottom transition-transform duration-200 ${
                animIn ? 'translate-y-0' : 'translate-y-full'
              }`}
              onClick={(e) => e.stopPropagation()}
              style={{ maxHeight: '80vh' }}
            >
              <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-5" aria-hidden="true" />
              <div className="flex items-start gap-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    variant === 'danger' ? 'bg-red-500/20' : 'bg-accent-primary/20'
                  }`}
                  aria-hidden="true"
                >
                  <AlertTriangle
                    size={20}
                    className={variant === 'danger' ? 'text-red-400' : 'text-accent-primary'}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-white">{title}</h3>
                  <p className="text-sm text-gray-400 mt-1.5">{message}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-6">
                <button
                  ref={confirmBtnRef}
                  onClick={onConfirm}
                  className={`w-full py-3.5 px-4 text-sm font-medium rounded-xl transition-colors ${
                    variant === 'danger'
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-accent-primary hover:bg-accent-primary/80 text-white'
                  }`}
                >
                  {confirmLabel}
                </button>
                <button
                  onClick={onCancel}
                  className="w-full py-3.5 px-4 text-sm text-gray-400 border border-dark-border rounded-xl hover:text-white hover:bg-dark-hover transition-colors"
                  aria-label={cancelLabel}
                >
                  {cancelLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

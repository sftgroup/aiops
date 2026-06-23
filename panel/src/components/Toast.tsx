import { useEffect } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning';
}

interface ToastProps {
  toast: ToastItem;
  onClose: (id: string) => void;
}

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
};

const COLORS = {
  success: {
    bg: 'bg-green-600',
    border: 'border-green-500',
    icon: 'text-green-200',
  },
  error: {
    bg: 'bg-red-600',
    border: 'border-red-500',
    icon: 'text-red-200',
  },
  warning: {
    bg: 'bg-yellow-600',
    border: 'border-yellow-500',
    icon: 'text-yellow-200',
  },
};

export function Toast({ toast, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(toast.id), 3000);
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  const Icon = ICONS[toast.type];
  const colors = COLORS[toast.type];

  return (
    <div
      className={`${colors.bg} ${colors.border} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2.5 animate-slide-in min-w-[280px] max-w-md border`}
      role="alert"
    >
      <Icon size={18} className={`shrink-0 ${colors.icon}`} />
      <span className="flex-1 text-sm font-medium">{toast.message}</span>
      <button
        onClick={() => onClose(toast.id)}
        className="shrink-0 text-white/70 hover:text-white transition-colors p-0.5 rounded hover:bg-white/10"
        aria-label="关闭"
      >
        <X size={16} />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" aria-live="polite" aria-label="通知区域" role="status">
      <div className="flex flex-col gap-2 pointer-events-auto">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onClose={onClose} />
        ))}
      </div>
    </div>
  );
}

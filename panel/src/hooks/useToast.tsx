import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { ToastContainer, type ToastItem } from '../components/Toast';

interface ToastContextValue {
  /** All active toasts */
  toasts: ToastItem[];
  /** Show a success toast */
  success: (message: string) => void;
  /** Show an error toast */
  error: (message: string) => void;
  /** Show a warning toast */
  warning: (message: string) => void;
  /** Manually remove a toast by id */
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastItem['type']) => {
    const id = `toast-${++toastIdCounter}-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const success = useCallback((message: string) => addToast(message, 'success'), [addToast]);
  const error = useCallback((message: string) => addToast(message, 'error'), [addToast]);
  const warning = useCallback((message: string) => addToast(message, 'warning'), [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, success, error, warning, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within <ToastProvider>');
  }
  return ctx;
}

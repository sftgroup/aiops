import { create } from 'zustand';

interface ToastInfo {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface UIStore {
  // Toast queue (for cases where we want to manage UI state, though react-hot-toast is used directly)
  toasts: ToastInfo[];

  // Global loading overlay (e.g. page-level loading)
  globalLoading: boolean;
  globalLoadingMessage: string;

  // Modal state (generic)
  modalOpen: boolean;
  modalContent: React.ReactNode | null;

  // Actions
  addToast: (toast: Omit<ToastInfo, 'id'>) => void;
  removeToast: (id: string) => void;
  setGlobalLoading: (loading: boolean) => void;
  setGlobalLoadingMessage: (msg: string) => void;
  openModal: (content: React.ReactNode) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  toasts: [],
  globalLoading: false,
  globalLoadingMessage: '',
  modalOpen: false,
  modalContent: null,

  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: Date.now().toString() }],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  setGlobalLoading: (loading) => set({ globalLoading: loading }),
  setGlobalLoadingMessage: (msg) => set({ globalLoadingMessage: msg }),
  openModal: (content) => set({ modalOpen: true, modalContent: content }),
  closeModal: () => set({ modalOpen: false, modalContent: null }),
}));

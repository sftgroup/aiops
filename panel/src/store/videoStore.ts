import { create } from 'zustand';

export interface VideoItem {
  id: string;
  subject: string;
  script: string;
  videoUrl: string;
  duration: number;
  createdAt: string;
}

type Updater<T> = T | ((prev: T) => T);

function resolveUpdater<T>(updater: Updater<T>, prev: T): T {
  return typeof updater === 'function' ? (updater as (prev: T) => T)(prev) : updater;
}

interface VideoStore {
  // Data
  videos: VideoItem[];
  loadingVideos: boolean;

  // Form fields
  subject: string;
  script: string;
  duration: number;
  customDuration: string;
  showCustomDuration: boolean;

  // Generation / progress state
  generatingScript: boolean;
  generating: boolean;
  progressMsg: string;
  errorMsg: string | null;
  wsFallback: boolean;

  // Actions
  setVideos: (action: Updater<VideoItem[]>) => void;
  setLoadingVideos: (v: boolean) => void;
  setSubject: (v: string) => void;
  setScript: (v: string) => void;
  setDuration: (v: number) => void;
  setCustomDuration: (v: string) => void;
  setShowCustomDuration: (v: boolean) => void;
  setGeneratingScript: (v: boolean) => void;
  setGenerating: (v: boolean) => void;
  setProgressMsg: (v: string) => void;
  setErrorMsg: (v: string | null) => void;
  setWsFallback: (v: boolean) => void;
}

export const useVideoStore = create<VideoStore>((set) => ({
  // Data
  videos: [],
  loadingVideos: true,

  // Form
  subject: '',
  script: '',
  duration: 5,
  customDuration: '',
  showCustomDuration: false,

  // Generation state
  generatingScript: false,
  generating: false,
  progressMsg: '',
  errorMsg: null,
  wsFallback: false,

  // Actions
  setVideos: (action) =>
    set((state) => ({ videos: resolveUpdater(action, state.videos) })),
  setLoadingVideos: (v) => set({ loadingVideos: v }),
  setSubject: (v) => set({ subject: v }),
  setScript: (v) => set({ script: v }),
  setDuration: (v) => set({ duration: v }),
  setCustomDuration: (v) => set({ customDuration: v }),
  setShowCustomDuration: (v) => set({ showCustomDuration: v }),
  setGeneratingScript: (v) => set({ generatingScript: v }),
  setGenerating: (v) => set({ generating: v }),
  setProgressMsg: (v) => set({ progressMsg: v }),
  setErrorMsg: (v) => set({ errorMsg: v }),
  setWsFallback: (v) => set({ wsFallback: v }),
}));

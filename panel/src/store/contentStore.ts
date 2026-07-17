import { create } from 'zustand';
import type { Content } from '../types';

interface ProgressBar {
  step: string;
  progress: number;
  message: string;
}

interface ContentStore {
  // Data
  contents: Content[];
  loading: boolean;

  // Form / generation
  aiPrompt: string;
  generatedText: string;
  generatedImage: string;
  posterPrompt: string;
  posterStyle: string;
  generating: boolean;
  progressStep: string;
  progressBar: ProgressBar;
  showPreview: boolean;

  // Refs exposed via store (so callbacks can read latest values)
  generatedTextRef: string;
  aiPromptRef: string;

  // Actions
  setContents: (v: Content[]) => void;
  setLoading: (v: boolean) => void;
  setAiPrompt: (v: string) => void;
  setGeneratedText: (v: string) => void;
  setGeneratedImage: (v: string) => void;
  setPosterPrompt: (v: string) => void;
  setPosterStyle: (v: string) => void;
  setGenerating: (v: boolean) => void;
  setProgressStep: (v: string) => void;
  setProgressBar: (v: ProgressBar) => void;
  setShowPreview: (v: boolean) => void;
  setGeneratedTextRef: (v: string) => void;
  setAiPromptRef: (v: string) => void;
}

export const useContentStore = create<ContentStore>((set) => (({
  contents: [],
  loading: true,
  aiPrompt: '',
  generatedText: '',
  generatedImage: '',
  posterPrompt: '',
  posterStyle: 'general',
  generating: false,
  progressStep: '',
  progressBar: { step: '', progress: 0, message: '' },
  showPreview: false,
  generatedTextRef: '',
  aiPromptRef: '',

  // Actions
  setContents: (v) => set({ contents: v }),
  setLoading: (v) => set({ loading: v }),
  setAiPrompt: (v) => set({ aiPrompt: v }),
  setGeneratedText: (v) => set({ generatedText: v }),
  setGeneratedImage: (v) => set({ generatedImage: v }),
  setPosterPrompt: (v) => set({ posterPrompt: v }),
  setPosterStyle: (v) => set({ posterStyle: v }),
  setGenerating: (v) => set({ generating: v }),
  setProgressStep: (v) => set({ progressStep: v }),
  setProgressBar: (v) => set({ progressBar: v }),
  setShowPreview: (v) => set({ showPreview: v }),
  setGeneratedTextRef: (v) => set({ generatedTextRef: v }),
  setAiPromptRef: (v) => set({ aiPromptRef: v }),
})));

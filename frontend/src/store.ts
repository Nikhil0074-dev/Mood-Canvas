import { create } from 'zustand';
import type { El, Emotion, LayerName, Tool, VisualFeatures } from './types';

export interface Project {
  id: string; name: string; updated: number; bg: string; elements: El[];
  note: string; emotion: Emotion | 'auto'; seed: number;
}
interface S {
  elements: El[]; past: El[][]; future: El[][];
  tool: Tool; color: string; size: number; opacity: number; bg: string;
  note: string; emotion: Emotion | 'auto'; seed: number;
  tempoOverride: number | null;
  userLayers: Record<LayerName, boolean>;
  visual: VisualFeatures | null;
  playing: boolean;
  projectName: string; projectId: string;
  patch: (p: Partial<S>) => void;
  addElement: (e: El) => void;
  undo: () => void; redo: () => void; clear: () => void;
}
export const useStore = create<S>((set) => ({
  elements: [], past: [], future: [],
  tool: 'brush', color: '#6a5cf0', size: 8, opacity: 0.85, bg: '#0f1020',
  note: '', emotion: 'auto', seed: 1, tempoOverride: null,
  userLayers: { pad: true, piano: true, bass: true, perc: true },
  visual: null, playing: false, projectName: 'Untitled', projectId: crypto.randomUUID(),
  patch: (p) => set(p),
  addElement: (e) => set((s) => ({ past: [...s.past, s.elements], future: [], elements: [...s.elements, e] })),
  undo: () => set((s) => (s.past.length ? { future: [s.elements, ...s.future], elements: s.past[s.past.length - 1], past: s.past.slice(0, -1) } : s)),
  redo: () => set((s) => (s.future.length ? { past: [...s.past, s.elements], elements: s.future[0], future: s.future.slice(1) } : s)),
  clear: () => set((s) => ({ past: [...s.past, s.elements], future: [], elements: [] })),
}));

export type Tool = 'brush' | 'circle' | 'rect' | 'line' | 'text' | 'eraser';
export type Emotion = 'calm' | 'happy' | 'sad' | 'energetic' | 'dreamy' | 'mysterious' | 'focused';
export interface El {
  id: string;
  type: 'stroke' | 'circle' | 'rect' | 'line' | 'text';
  color: string;
  size: number;
  opacity: number;
  points: [number, number][];
  text?: string;
  erase?: boolean;
}
export interface VisualFeatures {
  brightness: number; saturation: number; warmth: number; contrast: number;
  diversity: number; emptiness: number; hue: number; dominant: string[];
  balanceX: number; balanceY: number; roundness: number; complexity: number;
}
export interface TextMood {
  emotion: Emotion | null; sentiment: number; intensity: number; confidence: number;
  keywords: string[]; scores: Record<Emotion, number>;
}
export type LayerName = 'pad' | 'piano' | 'bass' | 'perc';
export interface MusicConfig {
  mood: string; tempo: number; key: string; scale: 'major' | 'minor' | 'dorian' | 'lydian';
  density: number; energy: number; brightness: number; reverb: number; delay: number;
  filterHz: number; progression: number[]; layers: Record<LayerName, boolean>; seed: number;
}

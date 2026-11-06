import type { Emotion, MusicConfig, TextMood, VisualFeatures } from '../types';
import { EMOTIONS } from './text';

export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

interface Profile { valence: number; energy: number; dream: number }
export const PROFILES: Record<Emotion, Profile> = {
  calm: { valence: 0.6, energy: 0.1, dream: 0.3 },
  happy: { valence: 0.9, energy: 0.5, dream: 0.1 },
  sad: { valence: 0.15, energy: 0.2, dream: 0.2 },
  energetic: { valence: 0.7, energy: 0.95, dream: 0 },
  dreamy: { valence: 0.6, energy: 0.2, dream: 0.9 },
  mysterious: { valence: 0.3, energy: 0.3, dream: 0.6 },
  focused: { valence: 0.5, energy: 0.4, dream: 0 },
};

export const DEFAULT_VISUAL: VisualFeatures = {
  brightness: 0.1, saturation: 0, warmth: 0.5, contrast: 0, diversity: 0, emptiness: 1, hue: 240,
  dominant: [], balanceX: 0, balanceY: 0, roundness: 0.5, complexity: 0,
};

/** Configurable rules: visual and text signals are blended, then mapped to musical parameters. */
export function toMusicConfig(
  v: VisualFeatures,
  t: TextMood | null,
  override: Emotion | 'auto' = 'auto',
  seed = 1,
): MusicConfig {
  const valenceV = 0.5 * v.brightness + 0.3 * v.warmth + 0.2 * v.saturation;
  const energyV = 0.35 * v.saturation + 0.25 * v.contrast + 0.2 * (1 - v.roundness) + 0.2 * v.complexity;
  const dreamV = 0.5 * v.roundness * (1 - v.contrast) + 0.2;

  const emotion: Emotion | null = override !== 'auto' ? override : t?.emotion ?? null;
  const w = !emotion ? 0 : override !== 'auto' ? 0.5 : 0.35 * Math.max(t?.confidence ?? 0, 0.4);
  const p = emotion ? PROFILES[emotion] : { valence: valenceV, energy: energyV, dream: dreamV };

  const valence = clamp((1 - w) * valenceV + w * p.valence);
  const energy = clamp((1 - w) * energyV + w * p.energy);
  const dream = clamp((1 - w) * dreamV + w * p.dream);

  const scale = valence < 0.35 ? 'minor' : valence < 0.55 ? 'dorian' : valence < 0.78 ? 'major' : 'lydian';
  const density = clamp(0.15 + 0.45 * energy + 0.2 * v.complexity, 0.1, 0.8);
  const progression = valence < 0.45 ? [0, 5, 3, 6] : valence < 0.7 ? [0, 3, 6, 4] : [0, 4, 5, 3];
  const dist = (e: Emotion) =>
    Math.abs(PROFILES[e].valence - valence) + Math.abs(PROFILES[e].energy - energy) + Math.abs(PROFILES[e].dream - dream);
  const nearest = EMOTIONS.reduce((a, b) => (dist(b) < dist(a) ? b : a));

  return {
    mood: emotion ?? nearest,
    tempo: Math.round(56 + energy * 56),
    key: NOTES[Math.floor((((v.hue % 360) + 360) % 360) / 30) % 12],
    scale,
    density,
    energy,
    brightness: v.brightness,
    reverb: clamp(0.3 + 0.4 * dream + 0.2 * (1 - energy)),
    delay: clamp(0.12 + 0.4 * dream),
    filterHz: Math.round(500 + clamp(0.6 * v.brightness + 0.4 * valence) * 5500),
    progression,
    layers: { pad: true, piano: density > 0.12, bass: v.brightness < 0.85, perc: energy > 0.45 },
    seed,
  };
}

import { describe, expect, it } from 'vitest';
import { analyzeColors } from '../analysis/color';
import { analyzeShapes, meanTurn } from '../analysis/shape';
import { analyzeText } from '../analysis/text';
import { toMusicConfig, DEFAULT_VISUAL } from '../analysis/mood';
import { exportMidi, generateBar, SCALES, scaleMidi } from '../engine/composer';
import type { El } from '../types';

function solid(w: number, h: number, rgb: [number, number, number], bgRgb: [number, number, number], inkFrac = 1) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const c = p < w * h * inkFrac ? rgb : bgRgb;
    d.set([c[0], c[1], c[2], 255], p * 4);
  }
  return d;
}

describe('colour analysis', () => {
  it('finds a blue dominant colour and a cool palette', () => {
    const f = analyzeColors(solid(100, 100, [20, 40, 220], [15, 16, 32], 0.5), 100, 100, '#0f1020');
    expect(f.dominant[0]).toMatch(/^#/);
    expect(f.warmth).toBeLessThan(0.5);
    expect(f.hue).toBeGreaterThan(200); expect(f.hue).toBeLessThan(260);
    expect(f.emptiness).toBeCloseTo(0.5, 1);
  });
  it('reports warm colours as warm and bright', () => {
    const f = analyzeColors(solid(100, 100, [255, 200, 40], [15, 16, 32], 1), 100, 100, '#0f1020');
    expect(f.warmth).toBeGreaterThan(0.6);
    expect(f.brightness).toBeGreaterThan(0.5);
  });
  it('handles an empty canvas', () => {
    const f = analyzeColors(solid(50, 50, [15, 16, 32], [15, 16, 32], 0), 50, 50, '#0f1020');
    expect(f.emptiness).toBe(1); expect(f.saturation).toBe(0);
  });
});

describe('shape analysis', () => {
  const zig: [number, number][] = Array.from({ length: 40 }, (_, i) => [i * 10, i % 2 ? 0 : 40]);
  const arc: [number, number][] = Array.from({ length: 60 }, (_, i) => [200 + 100 * Math.cos(i / 10), 200 + 100 * Math.sin(i / 10)]);
  it('tells zigzags from curves', () => { expect(meanTurn(zig)).toBeGreaterThan(1); expect(meanTurn(arc)).toBeLessThan(0.5); });
  it('scores roundness', () => {
    const mk = (type: El['type']): El => ({ id: type, type, color: '#fff', size: 4, opacity: 1, points: [[0, 0], [10, 10]] });
    expect(analyzeShapes([mk('circle')]).roundness).toBe(1);
    expect(analyzeShapes([mk('rect')]).roundness).toBe(0);
  });
});

describe('text analysis', () => {
  it('detects calm text', () => {
    const t = analyzeText('Today feels peaceful. I want something soft, warm and relaxing.');
    expect(t.emotion).toBe('calm'); expect(t.confidence).toBeGreaterThan(0.3);
  });
  it('returns null emotion for neutral text', () => { expect(analyzeText('table chair').emotion).toBeNull(); });
  it('handles negation', () => { expect(analyzeText('not happy').scores.happy).toBe(0); });
});

describe('mood mapping', () => {
  const dark = { ...DEFAULT_VISUAL, brightness: 0.1, saturation: 0.4, warmth: 0.2, roundness: 0.9 };
  const bright = { ...DEFAULT_VISUAL, brightness: 0.7, saturation: 0.9, warmth: 0.9, contrast: 0.8, roundness: 0.1, complexity: 0.8 };
  it('is slower and darker for dark rounded boards', () => {
    const a = toMusicConfig(dark, null), b = toMusicConfig(bright, null);
    expect(a.tempo).toBeLessThan(b.tempo);
    expect(a.filterHz).toBeLessThan(b.filterHz);
    expect(a.scale).toBe('minor');
  });
  it('produces valid ranges', () => {
    const c = toMusicConfig(bright, analyzeText('wild fast dance'), 'auto', 3);
    expect(c.tempo).toBeGreaterThanOrEqual(56); expect(c.tempo).toBeLessThanOrEqual(112);
    for (const k of ['density', 'reverb', 'delay', 'energy'] as const) { expect(c[k]).toBeGreaterThanOrEqual(0); expect(c[k]).toBeLessThanOrEqual(1); }
  });
  it('lets the user override the text mood', () => { expect(toMusicConfig(dark, null, 'energetic').mood).toBe('energetic'); });
});

describe('composer', () => {
  const cfg = toMusicConfig({ ...DEFAULT_VISUAL, brightness: 0.5, complexity: 0.6, saturation: 0.6 }, null, 'auto', 7);
  it('is deterministic for a seed', () => { expect(generateBar(cfg, 3)).toEqual(generateBar(cfg, 3)); });
  it('keeps pad and piano notes inside the scale', () => {
    const allowed = new Set<number>(SCALES[cfg.scale]);
    const root = scaleMidi(0, cfg.scale, 0);
    expect(root).toBe(0);
    for (let b = 0; b < 8; b++) for (const e of generateBar(cfg, b)) {
      if (e.layer === 'pad' || e.layer === 'piano' || e.layer === 'bass') {
        const keyIdx = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(cfg.key);
        expect(allowed.has((((e.midi - keyIdx) % 12) + 12) % 12)).toBe(true);
      }
    }
  });
  it('writes a valid MIDI header', () => {
    const m = exportMidi(cfg, 4);
    expect(String.fromCharCode(...m.slice(0, 4))).toBe('MThd');
    expect(String.fromCharCode(...m.slice(14, 18))).toBe('MTrk');
    expect(m.slice(-3)).toEqual(new Uint8Array([0xff, 0x2f, 0]));
  });
});

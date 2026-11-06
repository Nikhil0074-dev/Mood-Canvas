import type { VisualFeatures } from '../types';

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

type ColorFeatures = Pick<VisualFeatures,
  'brightness' | 'saturation' | 'warmth' | 'contrast' | 'diversity' | 'emptiness' | 'hue' | 'dominant' | 'balanceX' | 'balanceY'>;

/** Analyse RGBA pixel data. Samples pixels to stay fast on large canvases. */
export function analyzeColors(data: Uint8ClampedArray, width: number, height: number, bg: string): ColorFeatures {
  const [br, bgc, bb] = hexToRgb(bg);
  const total = data.length / 4;
  const stride = Math.max(1, Math.floor(total / 60000));
  let n = 0, lumSum = 0, lumSq = 0, ink = 0, satSum = 0, warmSum = 0, cx = 0, cy = 0;
  const buckets = new Map<number, { c: number; r: number; g: number; b: number }>();
  for (let p = 0; p < total; p += stride) {
    const i = p * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    n++; lumSum += lum; lumSq += lum * lum;
    if (Math.abs(r - br) + Math.abs(g - bgc) + Math.abs(b - bb) > 30) {
      ink++;
      satSum += rgbToHsv(r, g, b)[1];
      warmSum += (r - b) / 255;
      cx += p % width; cy += Math.floor(p / width);
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const e = buckets.get(key) ?? { c: 0, r: 0, g: 0, b: 0 };
      e.c++; e.r += r; e.g += g; e.b += b;
      buckets.set(key, e);
    }
  }
  const mean = lumSum / n;
  const contrast = Math.min(1, Math.sqrt(Math.max(0, lumSq / n - mean * mean)) * 2.5);
  const sorted = [...buckets.values()].sort((a, b) => b.c - a.c);
  const dominant: { hex: string; rgb: [number, number, number] }[] = [];
  for (const e of sorted) {
    const rgb: [number, number, number] = [e.r / e.c, e.g / e.c, e.b / e.c];
    if (dominant.every((d) => Math.abs(d.rgb[0] - rgb[0]) + Math.abs(d.rgb[1] - rgb[1]) + Math.abs(d.rgb[2] - rgb[2]) > 90)) {
      dominant.push({ hex: toHex(...rgb), rgb });
    }
    if (dominant.length === 5) break;
  }
  if (dominant.length === 0) dominant.push({ hex: bg, rgb: [br, bgc, bb] });
  const hue = rgbToHsv(...dominant[0].rgb)[0];
  const significant = sorted.filter((e) => ink > 0 && e.c / ink > 0.02).length;
  return {
    brightness: mean,
    saturation: ink > 0 ? satSum / ink : 0,
    warmth: ink > 0 ? Math.min(1, Math.max(0, (warmSum / ink + 1) / 2)) : 0.5,
    contrast,
    diversity: Math.min(1, significant / 8),
    emptiness: 1 - ink / n,
    hue,
    dominant: dominant.map((d) => d.hex),
    balanceX: ink > 0 ? (cx / ink / width - 0.5) * 2 : 0,
    balanceY: ink > 0 ? (cy / ink / height - 0.5) * 2 : 0,
  };
}

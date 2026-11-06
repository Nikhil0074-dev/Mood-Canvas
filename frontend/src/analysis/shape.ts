import type { El } from '../types';

function downsample(pts: [number, number][], minDist = 8): [number, number][] {
  const out: [number, number][] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= minDist) out.push(p);
  }
  return out;
}

/** Mean absolute turning angle (radians). Zigzags are high, smooth curves low. */
export function meanTurn(points: [number, number][]): number {
  const p = downsample(points);
  if (p.length < 3) return 0;
  let sum = 0, cnt = 0;
  for (let i = 2; i < p.length; i++) {
    const a1 = Math.atan2(p[i - 1][1] - p[i - 2][1], p[i - 1][0] - p[i - 2][0]);
    const a2 = Math.atan2(p[i][1] - p[i - 1][1], p[i][0] - p[i - 1][0]);
    let d = Math.abs(a2 - a1);
    if (d > Math.PI) d = 2 * Math.PI - d;
    sum += d; cnt++;
  }
  return sum / cnt;
}

export function analyzeShapes(els: El[]): { roundness: number; complexity: number } {
  let round = 0, ang = 0, pts = 0;
  for (const e of els) {
    if (e.erase) continue;
    if (e.type === 'circle') round += 3;
    else if (e.type === 'rect' || e.type === 'line') ang += 3;
    else if (e.type === 'stroke' && e.points.length >= 4) {
      pts += e.points.length;
      if (meanTurn(e.points) > 0.6) ang += 1.5; else round += 1.5;
    }
  }
  const roundness = round + ang > 0 ? round / (round + ang) : 0.5;
  return { roundness, complexity: Math.min(1, els.length / 25 + pts / 4000) };
}

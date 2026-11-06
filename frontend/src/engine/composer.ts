import type { LayerName, MusicConfig } from '../types';
import { NOTES } from '../analysis/mood';

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
} as const;

export interface NoteEvent { t: number; dur: number; midi: number; vel: number; layer: LayerName }

export function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rootMidi = (key: string, octave: number) => 12 * (octave + 1) + Math.max(0, NOTES.indexOf(key));

export function scaleMidi(root: number, scale: keyof typeof SCALES, degree: number): number {
  const s = SCALES[scale];
  return root + s[((degree % 7) + 7) % 7] + 12 * Math.floor(degree / 7);
}

/** Pure, seeded generator: the same config and bar index always give the same notes. */
export function generateBar(cfg: MusicConfig, bar: number): NoteEvent[] {
  const rng = mulberry32(cfg.seed * 7919 + bar);
  const ev: NoteEvent[] = [];
  const chordRoot = cfg.progression[bar % cfg.progression.length];
  const chord = [chordRoot, chordRoot + 2, chordRoot + 4];
  const padBase = rootMidi(cfg.key, 4);
  chord.forEach((d) => ev.push({ t: 0, dur: 4, midi: scaleMidi(padBase, cfg.scale, d), vel: 0.3, layer: 'pad' }));

  const bassBase = rootMidi(cfg.key, 2);
  ev.push({ t: 0, dur: 2, midi: scaleMidi(bassBase, cfg.scale, chordRoot), vel: 0.5, layer: 'bass' });
  if (cfg.density > 0.4) ev.push({ t: 2, dur: 2, midi: scaleMidi(bassBase, cfg.scale, chordRoot + 4), vel: 0.4, layer: 'bass' });

  const lead = rootMidi(cfg.key, 5);
  for (let i = 0; i < 8; i++) {
    if (rng() < cfg.density * (i % 2 === 0 ? 1.1 : 0.7)) {
      const deg = rng() < 0.7 ? chord[Math.floor(rng() * 3)] : chordRoot + [1, 3, 5][Math.floor(rng() * 3)];
      ev.push({ t: i * 0.5, dur: 0.5, midi: scaleMidi(lead, cfg.scale, deg), vel: 0.3 + rng() * 0.2, layer: 'piano' });
    }
  }
  for (let i = 0; i < 8; i++) {
    if (i % 4 === 0) ev.push({ t: i * 0.5, dur: 0.25, midi: 36, vel: 0.6, layer: 'perc' });
    else if (i % 2 === 1 && rng() < 0.5 + cfg.energy * 0.4) ev.push({ t: i * 0.5, dur: 0.1, midi: 42, vel: 0.25, layer: 'perc' });
  }
  return ev;
}

function vlq(n: number): number[] {
  const out = [n & 0x7f];
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
  return out;
}

/** Minimal Standard MIDI File (format 0, 480 ticks per beat). */
export function exportMidi(cfg: MusicConfig, bars = 16): Uint8Array {
  const TPB = 480;
  const events: { tick: number; data: number[] }[] = [];
  const chan: Record<LayerName, number> = { pad: 0, bass: 1, piano: 2, perc: 9 };
  for (let b = 0; b < bars; b++) {
    for (const e of generateBar(cfg, b)) {
      if (!cfg.layers[e.layer]) continue;
      const on = Math.round((b * 4 + e.t) * TPB);
      const off = on + Math.max(1, Math.round(e.dur * TPB));
      const c = chan[e.layer], v = Math.max(1, Math.min(127, Math.round(e.vel * 127)));
      events.push({ tick: on, data: [0x90 | c, e.midi, v] }, { tick: off, data: [0x80 | c, e.midi, 0] });
    }
  }
  events.sort((a, b) => a.tick - b.tick || (a.data[0] & 0xf0) - (b.data[0] & 0xf0));
  const mpqn = Math.round(60000000 / cfg.tempo);
  const track: number[] = [0, 0xff, 0x51, 3, (mpqn >> 16) & 255, (mpqn >> 8) & 255, mpqn & 255];
  let last = 0;
  for (const e of events) { track.push(...vlq(e.tick - last), ...e.data); last = e.tick; }
  track.push(0, 0xff, 0x2f, 0);
  const len = track.length;
  return new Uint8Array([
    0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, TPB >> 8, TPB & 255,
    0x4d, 0x54, 0x72, 0x6b, (len >> 24) & 255, (len >> 16) & 255, (len >> 8) & 255, len & 255,
    ...track,
  ]);
}

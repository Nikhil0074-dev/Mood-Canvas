import * as Tone from 'tone';
import type { MusicConfig } from '../types';
import { generateBar } from './composer';

/** Framework-free audio engine. Config changes apply at the next bar; effects ramp smoothly. */
export class AudioEngine {
  private built = false;
  private cfg: MusicConfig | null = null;
  private bar = 0;
  private midiOut: MIDIOutput | null = null;
  private master!: Tone.Volume;
  private wave!: Tone.Analyser;
  private fft!: Tone.Analyser;
  private filter!: Tone.Filter;
  private delay!: Tone.FeedbackDelay;
  private reverb!: Tone.Reverb;
  private pad!: Tone.PolySynth;
  private piano!: Tone.PolySynth;
  private bass!: Tone.Synth;
  private kick!: Tone.MembraneSynth;
  private hat!: Tone.NoiseSynth;
  private loop: Tone.Loop | null = null;
  playing = false;

  private async build() {
    if (this.built) return;
    this.master = new Tone.Volume(-6).toDestination();
    this.wave = new Tone.Analyser('waveform', 512);
    this.fft = new Tone.Analyser('fft', 128);
    this.master.connect(this.wave); this.master.connect(this.fft);
    this.reverb = new Tone.Reverb({ decay: 7, wet: 0.5 }).connect(this.master);
    this.delay = new Tone.FeedbackDelay('8n.', 0.35).connect(this.reverb);
    this.filter = new Tone.Filter(1800, 'lowpass').connect(this.delay);
    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' }, envelope: { attack: 1.4, decay: 0.5, sustain: 0.8, release: 3 },
    }).connect(this.filter);
    this.pad.volume.value = -16;
    this.piano = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.4, sustain: 0.1, release: 1.6 },
    }).connect(this.filter);
    this.piano.volume.value = -12;
    this.bass = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.05, decay: 0.3, sustain: 0.6, release: 1 } }).connect(this.filter);
    this.bass.volume.value = -8;
    this.kick = new Tone.MembraneSynth().connect(this.master);
    this.kick.volume.value = -16;
    this.hat = new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.05, sustain: 0 } }).connect(this.master);
    this.hat.volume.value = -30;
    await this.reverb.ready;
    this.built = true;
  }

  private beat() { return 60 / Tone.getTransport().bpm.value; }

  private onBar = (time: number) => {
    const cfg = this.cfg;
    if (!cfg) return;
    const bs = this.beat();
    for (const e of generateBar(cfg, this.bar)) {
      if (!cfg.layers[e.layer]) continue;
      const t = time + e.t * bs;
      const f = Tone.Frequency(e.midi, 'midi').toFrequency();
      if (e.layer === 'pad') this.pad.triggerAttackRelease(f, e.dur * bs, t, e.vel);
      else if (e.layer === 'piano') this.piano.triggerAttackRelease(f, e.dur * bs, t, e.vel);
      else if (e.layer === 'bass') this.bass.triggerAttackRelease(f, e.dur * bs, t, e.vel);
      else if (e.midi === 36) this.kick.triggerAttackRelease('C1', '8n', t, e.vel);
      else this.hat.triggerAttackRelease('32n', t, e.vel);
      if (this.midiOut) {
        const stamp = performance.now() + (t - Tone.now()) * 1000;
        const ch = e.layer === 'perc' ? 9 : e.layer === 'pad' ? 0 : e.layer === 'bass' ? 1 : 2;
        this.midiOut.send([0x90 | ch, e.midi, Math.round(e.vel * 127)], stamp);
        this.midiOut.send([0x80 | ch, e.midi, 0], stamp + e.dur * bs * 1000);
      }
    }
    this.bar++;
  };

  async start(cfg: MusicConfig) {
    await Tone.start(); // must follow a user gesture
    await this.build();
    this.cfg = cfg; this.bar = 0;
    this.applyEffects(cfg, 0.1);
    Tone.getTransport().bpm.value = cfg.tempo;
    this.loop?.dispose();
    this.loop = new Tone.Loop(this.onBar, '1m').start(0);
    Tone.getTransport().start('+0.1');
    this.playing = true;
  }

  private applyEffects(cfg: MusicConfig, ramp: number) {
    this.filter.frequency.rampTo(cfg.filterHz, ramp);
    this.delay.wet.rampTo(cfg.delay, ramp);
    this.reverb.wet.rampTo(cfg.reverb, ramp);
  }

  update(cfg: MusicConfig) {
    this.cfg = cfg; // notes change at the next bar boundary
    if (!this.built) return;
    this.applyEffects(cfg, 4);
    Tone.getTransport().bpm.rampTo(cfg.tempo, 8);
  }

  stop() {
    if (!this.built) return;
    Tone.getTransport().stop();
    this.loop?.dispose(); this.loop = null;
    this.pad.releaseAll(); this.piano.releaseAll();
    this.playing = false;
  }

  setVolume(db: number) { if (this.built) this.master.volume.rampTo(db, 0.1); }
  setMidiOut(o: MIDIOutput | null) { this.midiOut = o; }
  noteOn(midi: number, vel: number) { if (this.built) this.piano.triggerAttack(Tone.Frequency(midi, 'midi').toFrequency(), undefined, vel); }
  noteOff(midi: number) { if (this.built) this.piano.triggerRelease(Tone.Frequency(midi, 'midi').toFrequency()); }
  getWave(): Float32Array { return this.built ? (this.wave.getValue() as Float32Array) : new Float32Array(0); }
  getFft(): Float32Array { return this.built ? (this.fft.getValue() as Float32Array) : new Float32Array(0); }
}

export const engine = new AudioEngine();

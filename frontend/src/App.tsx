import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from './store';
import { MoodCanvas } from './components/MoodCanvas';
import { Visualizer } from './components/Visualizer';
import { analyzeText, EMOTIONS } from './analysis/text';
import { DEFAULT_VISUAL, toMusicConfig } from './analysis/mood';
import { engine } from './engine/audioEngine';
import { exportMidi } from './engine/composer';
import { openMidi } from './midi/midi';
import { deleteProject, download, duplicateProject, listProjects, saveProject } from './export/projects';
import type { Emotion, LayerName, MusicConfig, Tool } from './types';

const TOOLS: Tool[] = ['brush', 'circle', 'rect', 'line', 'text', 'eraser'];
const PALETTE = ['#6a5cf0', '#2a4bd7', '#1fb5a8', '#f0a35c', '#f5d547', '#e5566d', '#f2eef9', '#1c1c2e'];
const LAYERS: LayerName[] = ['pad', 'piano', 'bass', 'perc'];
const pct = (v: number) => `${Math.round(v * 100)}%`;

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="meter"><span>{label}</span>
      <div className="track"><div style={{ width: pct(value) }} /></div><b>{pct(value)}</b></div>
  );
}

export function App() {
  const s = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [outputs, setOutputs] = useState<MIDIOutput[]>([]);
  const [midiMsg, setMidiMsg] = useState('MIDI not connected');
  const [projects, setProjects] = useState(listProjects());
  const [volume, setVolume] = useState(-6);

  const fullText = useMemo(
    () => [s.note, ...s.elements.filter((e) => e.type === 'text').map((e) => e.text)].join(' '),
    [s.note, s.elements],
  );
  const textMood = useMemo(() => analyzeText(fullText), [fullText]);

  const config: MusicConfig = useMemo(() => {
    const auto = toMusicConfig(s.visual ?? DEFAULT_VISUAL, textMood, s.emotion, s.seed);
    const layers = { ...auto.layers };
    LAYERS.forEach((l) => { layers[l] = auto.layers[l] && s.userLayers[l]; });
    return { ...auto, layers, tempo: s.tempoOverride ?? auto.tempo };
  }, [s.visual, textMood, s.emotion, s.seed, s.tempoOverride, s.userLayers]);

  useEffect(() => { if (s.playing) engine.update(config); }, [config, s.playing]);
  useEffect(() => () => engine.stop(), []);

  const toggle = async () => {
    if (s.playing) { engine.stop(); s.patch({ playing: false }); return; }
    await engine.start(config);
    s.patch({ playing: true });
  };

  const connectMidi = async () => {
    const r = await openMidi((on, n, v) => (on ? engine.noteOn(n, v) : engine.noteOff(n)));
    setOutputs(r.outputs);
    setMidiMsg(r.supported ? `${r.outputs.length} output(s) found` : 'Web MIDI is not available in this browser');
  };

  const snapshot = () => ({
    id: s.projectId, name: s.projectName, updated: Date.now(), bg: s.bg,
    elements: s.elements, note: s.note, emotion: s.emotion, seed: s.seed,
  });
  const load = (id: string) => {
    const p = listProjects().find((x) => x.id === id); if (!p) return;
    s.patch({ elements: p.elements, bg: p.bg, note: p.note, emotion: p.emotion, seed: p.seed, projectId: p.id, projectName: p.name, past: [], future: [] });
  };
  const refresh = () => setProjects(listProjects());
  const vis = s.visual ?? DEFAULT_VISUAL;

  return (
    <div className="app">
      <aside className="panel left">
        <h1>Mood Canvas</h1>
        <section aria-label="Tools">
          <h2>Tools</h2>
          <div className="grid2">
            {TOOLS.map((t) => (
              <button key={t} className={s.tool === t ? 'on' : ''} onClick={() => s.patch({ tool: t })}>{t}</button>
            ))}
          </div>
        </section>
        <section>
          <h2>Colour</h2>
          <div className="swatches">
            {PALETTE.map((c) => (
              <button key={c} aria-label={`Colour ${c}`} className={s.color === c ? 'sw on' : 'sw'} style={{ background: c }} onClick={() => s.patch({ color: c })} />
            ))}
          </div>
          <label>Custom <input type="color" value={s.color} onChange={(e) => s.patch({ color: e.target.value })} /></label>
          <label>Size {s.size}<input type="range" min={1} max={40} value={s.size} onChange={(e) => s.patch({ size: +e.target.value })} /></label>
          <label>Opacity {pct(s.opacity)}<input type="range" min={0.1} max={1} step={0.05} value={s.opacity} onChange={(e) => s.patch({ opacity: +e.target.value })} /></label>
          <label>Background <input type="color" value={s.bg} onChange={(e) => s.patch({ bg: e.target.value })} /></label>
        </section>
        <section>
          <h2>Edit</h2>
          <div className="grid2">
            <button onClick={s.undo} disabled={!s.past.length}>undo</button>
            <button onClick={s.redo} disabled={!s.future.length}>redo</button>
            <button onClick={s.clear}>clear</button>
            <button onClick={() => canvasRef.current?.toBlob((b) => b && download(`${s.projectName}.png`, b, 'image/png'))}>save PNG</button>
          </div>
        </section>
        <section>
          <h2>Project</h2>
          <input aria-label="Project name" value={s.projectName} onChange={(e) => s.patch({ projectName: e.target.value })} />
          <div className="grid2">
            <button onClick={() => { saveProject(snapshot()); refresh(); }}>save</button>
            <button onClick={() => { s.patch({ elements: [], past: [], future: [], projectId: crypto.randomUUID(), projectName: 'Untitled', note: '' }); }}>new</button>
          </div>
          <ul className="projects">
            {projects.length === 0 && <li className="muted">Nothing saved yet. Save to keep this board.</li>}
            {projects.map((p) => (
              <li key={p.id}>
                <button className="link" onClick={() => load(p.id)}>{p.name}</button>
                <button className="mini" aria-label="Duplicate" onClick={() => { duplicateProject(p.id); refresh(); }}>copy</button>
                <button className="mini" aria-label="Delete" onClick={() => { deleteProject(p.id); refresh(); }}>del</button>
              </li>
            ))}
          </ul>
        </section>
      </aside>

      <main className="stage">
        <MoodCanvas canvasRef={canvasRef} />
        <textarea aria-label="Mood note" placeholder="Describe how you feel. For example: I want something soft, warm and relaxing."
          value={s.note} onChange={(e) => s.patch({ note: e.target.value })} />
      </main>

      <aside className="panel right">
        <h2>What the canvas says</h2>
        <div className="dom">
          {vis.dominant.length === 0 ? <span className="muted">Draw something to see its palette.</span>
            : vis.dominant.map((c) => <i key={c} title={c} style={{ background: c }} />)}
        </div>
        <Meter label="Brightness" value={vis.brightness} />
        <Meter label="Saturation" value={vis.saturation} />
        <Meter label="Warmth" value={vis.warmth} />
        <Meter label="Contrast" value={vis.contrast} />
        <Meter label="Roundness" value={vis.roundness} />
        <Meter label="Complexity" value={vis.complexity} />
        <Meter label="Empty space" value={vis.emptiness} />
        <h2>What the words say</h2>
        <p className="muted">
          {textMood.emotion ? `${textMood.emotion}, ${pct(textMood.confidence)} sure. Keywords: ${textMood.keywords.join(', ')}` : 'No mood words found yet.'}
        </p>
        <label>Override mood
          <select value={s.emotion} onChange={(e) => s.patch({ emotion: e.target.value as Emotion | 'auto' })}>
            <option value="auto">auto</option>
            {EMOTIONS.map((e) => <option key={e}>{e}</option>)}
          </select>
        </label>
        <h2>Music</h2>
        <dl className="params">
          <dt>Mood</dt><dd>{config.mood}</dd>
          <dt>Key</dt><dd>{config.key} {config.scale}</dd>
          <dt>Tempo</dt><dd>{config.tempo} BPM</dd>
          <dt>Density</dt><dd>{pct(config.density)}</dd>
          <dt>Reverb</dt><dd>{pct(config.reverb)}</dd>
          <dt>Seed</dt><dd>{config.seed}</dd>
        </dl>
        <button onClick={() => s.patch({ seed: Math.floor(Math.random() * 99999) + 1 })}>new variation</button>
      </aside>

      <footer className="player">
        <button className="play" onClick={toggle} aria-label={s.playing ? 'Pause' : 'Play'}>{s.playing ? 'Pause' : 'Play'}</button>
        <Visualizer />
        <label>Volume<input type="range" min={-40} max={0} value={volume} onChange={(e) => { setVolume(+e.target.value); engine.setVolume(+e.target.value); }} /></label>
        <label>Tempo {config.tempo}
          <input type="range" min={50} max={120} value={config.tempo} onChange={(e) => s.patch({ tempoOverride: +e.target.value })} />
        </label>
        {s.tempoOverride !== null && <button className="mini" onClick={() => s.patch({ tempoOverride: null })}>auto tempo</button>}
        <div className="layers" role="group" aria-label="Instrument layers">
          {LAYERS.map((l) => (
            <button key={l} className={config.layers[l] ? 'on' : ''} onClick={() => s.patch({ userLayers: { ...s.userLayers, [l]: !s.userLayers[l] } })}>{l}</button>
          ))}
        </div>
        <div className="midi">
          <button onClick={connectMidi}>connect MIDI</button>
          <select aria-label="MIDI output" onChange={(e) => engine.setMidiOut(outputs.find((o) => o.id === e.target.value) ?? null)}>
            <option value="">no output</option>
            {outputs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <small>{midiMsg}</small>
        </div>
        <div className="exports">
          <button onClick={() => download(`${s.projectName}.mid`, exportMidi(config) as unknown as BlobPart, 'audio/midi')}>export MIDI</button>
          <button onClick={() => download(`${s.projectName}.json`, JSON.stringify(config, null, 2), 'application/json')}>export JSON</button>
        </div>
      </footer>
    </div>
  );
}

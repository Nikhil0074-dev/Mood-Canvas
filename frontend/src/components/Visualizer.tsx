import { useEffect, useRef } from 'react';
import { engine } from '../engine/audioEngine';

export function Visualizer() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = ref.current; if (!c) return;
      const ctx = c.getContext('2d')!;
      const w = c.width, h = c.height;
      ctx.clearRect(0, 0, w, h);
      const fft = engine.getFft(), wave = engine.getWave();
      const cx = w / 2, cy = h / 2, r0 = h * 0.22;
      for (let i = 0; i < fft.length; i++) {
        const v = Math.max(0, (fft[i] + 100) / 100);
        const a = (i / fft.length) * Math.PI * 2 - Math.PI / 2;
        ctx.strokeStyle = `hsl(${250 + (i / fft.length) * 110}, 80%, 65%)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * (r0 + v * h * 0.28), cy + Math.sin(a) * (r0 + v * h * 0.28));
        ctx.stroke();
      }
      ctx.strokeStyle = '#f0a35c'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = 0; i < wave.length; i++) {
        const x = (i / wave.length) * w, y = cy + wave[i] * h * 0.4;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      if (wave.length) ctx.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} width={320} height={72} className="viz" aria-label="Audio visualizer" />;
}

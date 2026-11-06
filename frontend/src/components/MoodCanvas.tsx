import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { analyzeColors } from '../analysis/color';
import { analyzeShapes } from '../analysis/shape';
import type { El } from '../types';

export const W = 960, H = 560;

export function drawEl(ctx: CanvasRenderingContext2D, e: El, bg: string) {
  ctx.save();
  ctx.globalAlpha = e.erase ? 1 : e.opacity;
  const col = e.erase ? bg : e.color;
  ctx.strokeStyle = col; ctx.fillStyle = col;
  ctx.lineWidth = e.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const [a, b] = [e.points[0], e.points[e.points.length - 1]];
  if (e.type === 'stroke') {
    ctx.beginPath(); ctx.moveTo(a[0], a[1]);
    if (e.points.length === 1) ctx.lineTo(a[0] + 0.01, a[1]);
    for (const p of e.points) ctx.lineTo(p[0], p[1]);
    ctx.stroke();
  } else if (e.type === 'line') {
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  } else if (e.type === 'circle') {
    ctx.beginPath(); ctx.arc(a[0], a[1], Math.hypot(b[0] - a[0], b[1] - a[1]), 0, Math.PI * 2); ctx.fill();
  } else if (e.type === 'rect') {
    ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
  } else if (e.type === 'text') {
    ctx.font = `${e.size * 3 + 12}px system-ui, sans-serif`;
    ctx.fillText(e.text ?? '', a[0], a[1]);
  }
  ctx.restore();
}

export function paintAll(canvas: HTMLCanvasElement, els: El[], bg: string) {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  els.forEach((e) => drawEl(ctx, e, bg));
}

export function MoodCanvas({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement> }) {
  const draft = useRef<El | null>(null);
  const { elements, bg, tool, color, size, opacity, addElement, patch } = useStore();

  const render = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    paintAll(c, elements, bg);
    if (draft.current) drawEl(c.getContext('2d')!, draft.current, bg);
  }, [elements, bg, canvasRef]);

  useEffect(render, [render]);

  // Debounced analysis: runs after drawing pauses, never on every pointer event.
  useEffect(() => {
    const id = setTimeout(() => {
      const c = canvasRef.current; if (!c) return;
      const img = c.getContext('2d')!.getImageData(0, 0, W, H);
      patch({ visual: { ...analyzeColors(img.data, W, H, bg), ...analyzeShapes(elements) } });
    }, 400);
    return () => clearTimeout(id);
  }, [elements, bg, canvasRef, patch]);

  const pos = (e: React.PointerEvent): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pos(e);
    if (tool === 'text') {
      const t = window.prompt('Write a note on the canvas');
      if (t) addElement({ id: crypto.randomUUID(), type: 'text', color, size, opacity, points: [p], text: t });
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    draft.current = {
      id: crypto.randomUUID(), color, size: tool === 'eraser' ? size * 2 : size, opacity, points: [p],
      type: tool === 'brush' || tool === 'eraser' ? 'stroke' : tool, erase: tool === 'eraser',
    };
    render();
  };
  const move = (e: React.PointerEvent) => {
    const d = draft.current; if (!d) return;
    const p = pos(e);
    if (d.type === 'stroke') d.points.push(p); else d.points = [d.points[0], p];
    render();
  };
  const up = () => {
    const d = draft.current; draft.current = null;
    if (d) addElement(d);
  };

  return (
    <canvas ref={canvasRef} width={W} height={H} className="paper" aria-label="Mood canvas"
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
  );
}

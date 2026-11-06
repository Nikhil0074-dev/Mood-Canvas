import type { Project } from '../store';

const KEY = 'mmc.projects';
export function listProjects(): Project[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}
function write(p: Project[]) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked or full */ } }
export function saveProject(p: Project) {
  const all = listProjects().filter((x) => x.id !== p.id);
  write([{ ...p, updated: Date.now() }, ...all]);
}
export function deleteProject(id: string) { write(listProjects().filter((p) => p.id !== id)); }
export function duplicateProject(id: string): Project | null {
  const src = listProjects().find((p) => p.id === id);
  if (!src) return null;
  const copy = { ...src, id: crypto.randomUUID(), name: src.name + ' copy', updated: Date.now() };
  write([copy, ...listProjects()]);
  return copy;
}
export function download(name: string, data: BlobPart | Uint8Array, type: string) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

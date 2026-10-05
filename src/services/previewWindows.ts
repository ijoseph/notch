import { getCurrentWindow } from '@tauri-apps/api/window';
import { emitTo, listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { message } from '@tauri-apps/plugin-dialog';
import { useStore, flushPendingChanges } from '../store';
import { loadResourcesForNote, retainResourcesForNote } from './resources';
import { createPrintRenderer } from './export';
import { resourceScope } from './resourceInvalidation';
import { previewUpdate, type PreviewContent } from './previewContent';

type Snapshot = PreviewContent;
const renderer = createPrintRenderer();
const snapshots = new Map<string, Snapshot>();
let revision = 0;
async function snapshot(): Promise<Snapshot | null> {
  const state = useStore.getState();
  const id = state.selectedNoteId;
  if (!id) return null;
  await state.loadNoteBody(id);
  const note = useStore.getState().notes.find(n => n.id === id);
  if (!note) return null;
  const release = retainResourcesForNote(id);
  try {
    await loadResourcesForNote(id);
    const content = await renderer.render(note);
    return { ...content, noteId: `${resourceScope()}:${id}` };
  } finally { release(); }
}
const previewLabel = (mode: string) => `${getCurrentWindow().label === 'main' ? '' : getCurrentWindow().label + '-'}${mode}-preview`;
export async function openPreview(printing: boolean | 'presentation' | 'image' = false): Promise<void> {
  try {
    await flushPendingChanges();
    const content = await snapshot();
    if (!content) return;
    const mode = typeof printing === 'string' ? printing : printing ? 'pdf' : 'floating';
    const label = previewLabel(mode);
    snapshots.set(label, content);
    await invoke('open_preview', { mode });
    await emitTo(label, 'preview-content', previewUpdate(content));
  } catch (error) { await message(String(error), { title: 'Preview failed', kind: 'error' }); }
}
export function connectPreviewWindows(): () => void {
  const floating = previewLabel('floating');
  let stopped = false;
  let unlisten: (() => void) | undefined;
  let unlistenClosed: (() => void) | undefined;
  let unlistenNavigate: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  void listen<string>('preview-ready', async event => {
    if (!snapshots.has(event.payload)) return;
    const content = snapshots.get(event.payload);
    if (content) await emitTo(event.payload, 'preview-content', previewUpdate(content));
  }).then(fn => { if (stopped) fn(); else unlisten = fn; });
  void listen<string>('preview-closed', event => {
    snapshots.delete(event.payload);
    if (event.payload === floating) { clearTimeout(timer); revision++; renderer.clear(); }
  }).then(fn => { if (stopped) fn(); else unlistenClosed = fn; });
  void listen<string>('preview-navigate', event => {
    window.dispatchEvent(new CustomEvent('notch-navigate', { detail: { href: event.payload } }));
  }).then(fn => { if (stopped) fn(); else unlistenNavigate = fn; });
  const unsubscribe = useStore.subscribe((state, previous) => {
    if (!snapshots.has(floating)) return;
    const note = state.notes.find(n => n.id === state.selectedNoteId);
    const old = previous.notes.find(n => n.id === previous.selectedNoteId);
    if (note === old) return;
    const current = ++revision;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const content = await snapshot() ?? { noteId: '', title: 'Preview', headerHtml: '<p>No note selected</p>', cells: [] };
        if (stopped || current !== revision) return;
        const update = previewUpdate(content, snapshots.get(floating));
        snapshots.set(floating, content);
        await emitTo(floating, 'preview-content', update);
      } catch (error) { console.warn('Preview update failed:', error); }
    }, 200);
  });
  return () => { stopped = true; clearTimeout(timer); unlisten?.(); unlistenClosed?.(); unlistenNavigate?.(); unsubscribe(); };
}

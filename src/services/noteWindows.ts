import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { message } from '@tauri-apps/plugin-dialog';
import { useStore, flushPendingChanges, libraryPath } from '../store';
import { reconcileNotes } from './noteWindowSync';
import { getNote, getAllNotebooks, getAllTags } from './database';
import { loadResourcesForNote, getResourceDataUrl } from './resources';
import { invalidateResources } from './resourceInvalidation';

export async function openNoteWindow() {
  const id = useStore.getState().selectedNoteId;
  const path = libraryPath();
  if (!id || !path) return;
  await flushPendingChanges();
  await invoke('open_note_window', { noteId: id, databasePath: path });
}

/** Share committed changes only. Never write a received snapshot back to disk. */
export function connectNoteWindows(): () => void {
  const origin = getCurrentWindow().label;
  let applying = false, stopped = false;
  const peers = new Set<string>();
  const presence = listen<{ label: string; open: boolean }>('editor-presence', event => {
    if (event.payload.open) peers.add(event.payload.label); else peers.delete(event.payload.label);
  });
  if (origin !== 'main') void presence.then(() => emit('editor-presence', { label: origin, open: true }));
  else void invoke<string[]>('note_window_labels').then(labels => labels.forEach(label => peers.add(label)));
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const publish = async () => {
    clearTimeout(timer);
    const path = libraryPath();
    const ids = [...pending]; pending.clear();
    if (!path || !ids.length) return;
    try { await flushPendingChanges(); await emit('notes-committed', { origin, path, ids }); }
    catch (error) { ids.forEach(id => pending.add(id)); await message(String(error), { title: 'Could not save note', kind: 'error' }); }
  };
  const unsubscribe = useStore.subscribe((state, previous) => {
    if ((origin === 'main' && !peers.size) || applying || !libraryPath() || state.notes === previous.notes) return;
    const beforeById = new Map(previous.notes.map(note => [note.id, note]));
    const ids = new Set(state.notes.map(note => note.id));
    for (const note of state.notes) {
      const before = beforeById.get(note.id);
      if (!before || (note !== before && note.bodyLoaded === before.bodyLoaded)) pending.add(note.id);
    }
    for (const note of previous.notes) if (!ids.has(note.id)) pending.add(note.id);
    clearTimeout(timer); timer = setTimeout(() => void publish(), 150);
  });
  const unlisten = listen<{ origin: string; path: string; ids: string[] }>('notes-committed', async event => {
    if (event.payload.origin === origin || event.payload.path !== libraryPath()) return;
    // Finish local writes before reconciling, so a delayed foreign event cannot
    // replace the user's latest local edit with an older disk snapshot.
    while (!stopped && event.payload.path === libraryPath()) {
    await flushPendingChanges();
    const beforeRead = useStore.getState().notes;
    const path = libraryPath();
    const [notes, notebooks, tags] = await Promise.all([Promise.all(event.payload.ids.map(getNote)), getAllNotebooks(), getAllTags()]);
    if (stopped || path !== libraryPath()) return;
    if (beforeRead !== useStore.getState().notes) continue;
    applying = true;
    useStore.setState(state => ({ notebooks, tags, notes: reconcileNotes(state.notes, event.payload.ids, notes) }));
    applying = false;
    for (const note of notes) {
      if (!note || useStore.getState().selectedNoteId !== note.id) continue;
      const missing = note.cells.some(cell => Array.from(cell.data.matchAll(/notch-resource:\/\/([\w-]+)/g)).some(match => !getResourceDataUrl(match[1]!)));
      if (missing) { invalidateResources(note.id); await loadResourcesForNote(note.id); }
    }
    break;
    }
  });
  const blur = () => { void publish(); };
  window.addEventListener('blur', blur);
  return () => { stopped = true; clearTimeout(timer); unsubscribe(); void unlisten.then(fn => fn()); void presence.then(fn => fn()); if (origin !== 'main') void emit('editor-presence', { label: origin, open: false }); window.removeEventListener('blur', blur); };
}

/** Quit waits for every editor, including notes from another open library. */
export async function flushNoteWindows(): Promise<void> {
  const labels = await invoke<string[]>('note_window_labels');
  if (!labels.length) return;
  const request = crypto.randomUUID();
  const waiting = new Set(labels);
  let cleanup: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('A note window has not finished saving. Close it and try again.')), 15000);
      void listen<{ request: string; label: string; error?: string }>('editors-flushed', event => {
        if (event.payload.request !== request) return;
        if (event.payload.error) { reject(new Error(event.payload.error)); return; }
        waiting.delete(event.payload.label);
        if (!waiting.size) resolve();
      }).then(async unlisten => { cleanup = unlisten; await emit('flush-editors', request); }).catch(reject);
    });
  } finally { clearTimeout(timer); cleanup?.(); }
}

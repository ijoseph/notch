import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen, emit } from '@tauri-apps/api/event';
import { message } from '@tauri-apps/plugin-dialog';
import { useStore, flushPendingChanges, hasCellHistory } from '../../store';
import { connectNoteWindows } from '../../services/noteWindows';
import { connectNoteCommands, runNoteCommand } from '../../services/noteCommands';
import { connectPreviewWindows, openPreview } from '../../services/previewWindows';
import NoteEditor from './NoteEditor';
import SettingsModal from '../Settings/SettingsModal';

export default function NoteWindow({ id, path }: { id: string; path: string }) {
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [find, setFind] = useState(false);
  const note = useStore(state => state.notes.find(n => n.id === id));
  useEffect(() => {
    let stopped = false;
    void useStore.getState().loadData(path).then(async () => {
      await useStore.getState().selectNote(id);
      if (!stopped) setReady(true);
    }).catch(error => setError(String(error)));
    return () => { stopped = true; };
  }, [id, path]);
  useEffect(() => {
    if (!ready) return;
    const win = getCurrentWindow();
    const disconnect = connectNoteWindows(), commands = connectNoteCommands(), previews = connectPreviewWindows();
    const flush = listen<string>('flush-editors', async event => {
      try { await flushPendingChanges(); await emit('editors-flushed', { request: event.payload, label: win.label }); }
      catch (error) { await emit('editors-flushed', { request: event.payload, label: win.label, error: String(error) }); }
    });
    const close = listen('notch-close-note', async () => {
      try { await flushPendingChanges(); await emit('notes-committed', { origin: win.label, path, ids: [id] }); await emit('editor-presence', { label: win.label, open: false }); await win.destroy(); }
      catch (error) { await message(String(error), { title: 'Could not save note', kind: 'error' }); }
    });
    const key = (event: KeyboardEvent) => {
      const command = /Mac/.test(navigator.platform) ? event.metaKey : event.ctrlKey;
      if (!command) return;
      if (event.key === 'f') { event.preventDefault(); setFind(true); }
      if (event.key === ',') { event.preventDefault(); useStore.getState().setSettingsOpen(true); }
      if (['4','5','6'].includes(event.key)) { event.preventDefault(); useStore.getState().setEditorViewMode(event.key === '4' ? 'editor' : event.key === '5' ? 'preview' : 'split'); }
      if (event.key === 'z' && useStore.getState().lastChangeWasStructural && hasCellHistory(id, event.shiftKey)) {
        event.preventDefault(); event.stopImmediatePropagation(); void useStore.getState().undoCellChange(event.shiftKey);
      }
    };
    const menu = (event: Event) => {
      const action = (event as CustomEvent<string>).detail;
      if (action === 'export') void runNoteCommand('export_note');
      if (action === 'duplicate_note') void useStore.getState().duplicateNote(id).then(() => useStore.getState().selectNote(id));
      if (action === 'trash_note') void useStore.getState().deleteNote(id);
      if (action === 'restore_note') void useStore.getState().restoreNote(id);
      if (action === 'scroll_sync') useStore.getState().toggleScrollSync();
      if (action === 'find_in_note') setFind(true);
      if (action === 'settings') useStore.getState().setSettingsOpen(true);
      if (['editor_only','preview_only','split_view'].includes(action)) useStore.getState().setEditorViewMode(action === 'editor_only' ? 'editor' : action === 'preview_only' ? 'preview' : 'split');
    };
    const preview = (event: Event) => void openPreview((event as CustomEvent).detail === 'print');
    window.addEventListener('keydown', key, true); window.addEventListener('notch-note-menu', menu); window.addEventListener('notch-open-preview', preview);
    return () => { disconnect(); commands(); previews(); void close.then(fn => fn()); void flush.then(fn => fn()); window.removeEventListener('keydown', key, true); window.removeEventListener('notch-note-menu', menu); window.removeEventListener('notch-open-preview', preview); };
  }, [ready, id, path]);
  useEffect(() => {
    const win = getCurrentWindow();
    if (note) void win.setTitle(note.title || 'Untitled');
    const updateMenu = () => { void invoke('set_note_menu_state', { hasNote: Boolean(note), isTrashed: note?.isTrashed ?? false }); };
    void win.isFocused().then(focused => { if (focused) updateMenu(); });
    const listener = win.onFocusChanged(event => { if (event.payload) updateMenu(); });
    return () => { void listener.then(fn => fn()); };
  }, [note?.title, note?.isTrashed, Boolean(note)]);
  if (error) return <p role="alert">{error}</p>;
  if (!ready) return <p>Opening note…</p>;
  if (!note || note.isTrashed) return <p>This note is no longer available. You can restore deleted notes from Trash in the library.</p>;
  return <div className="note-window"><NoteEditor showFindBar={find} onCloseFindBar={() => setFind(false)} /><SettingsModal /></div>;
}

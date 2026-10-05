import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { save, message } from '@tauri-apps/plugin-dialog';
import { useStore, flushPendingChanges } from '../store';
import { loadResourcesForNote, retainResourcesForNote } from './resources';
import { exportNoteToHTML, exportNoteToMarkdown, exportNoteToJSON, saveToFile } from './export';
import { noteCodeOnly, notePlainText } from './noteFormats';
import { openNoteWindow } from './noteWindows';
import { openPreview } from './previewWindows';
export async function runNoteCommand(action: string): Promise<void> {
  if (action === 'open_note_window') { await openNoteWindow(); return; }
  if (action === 'present_note' || action === 'export_png') { await openPreview(action === 'present_note' ? 'presentation' : 'image'); return; }
  const state = useStore.getState(), id = state.selectedNoteId;
  if (!id) return;
  await flushPendingChanges(); await state.loadNoteBody(id);
  const note = useStore.getState().notes.find(n => n.id === id);
  if (!note) return;
  const release = retainResourcesForNote(id);
  try {
    await loadResourcesForNote(id);
    const text = action === 'copy_html' ? exportNoteToHTML(note) : action === 'copy_markdown' ? exportNoteToMarkdown(note) : action === 'copy_code' ? noteCodeOnly(note) : notePlainText(note);
    if (action === 'export_note') {
      const path = await save({ title: 'Export Note', defaultPath: `${note.title.replace(/[^a-zA-Z0-9 -]/g, '_') || 'Untitled'}.md`, filters: [{name:'Markdown',extensions:['md']},{name:'HTML',extensions:['html']},{name:'JSON',extensions:['json']},{name:'Plain Text',extensions:['txt']}] });
      if (path) await saveToFile(path, path.endsWith('.html') ? exportNoteToHTML(note) : path.endsWith('.json') ? exportNoteToJSON(note) : path.endsWith('.txt') ? notePlainText(note) : exportNoteToMarkdown(note));
    } else if (action === 'export_text') {
      const path = await save({ title: 'Export Plain Text', defaultPath: `${note.title.replace(/[^a-zA-Z0-9 -]/g, '_') || 'Untitled'}.txt`, filters: [{ name: 'Plain Text', extensions: ['txt'] }] });
      if (path) await saveToFile(path, text);
    } else await writeText(text);
  } finally { release(); }
}
export function connectNoteCommands() {
  const listener = (event: Event) => { void runNoteCommand((event as CustomEvent<string>).detail).catch(error => message(String(error), { title: 'Note command failed', kind: 'error' })); };
  window.addEventListener('notch-note-command', listener);
  return () => window.removeEventListener('notch-note-command', listener);
}

import { Database } from 'bun:sqlite';
import { mock } from 'bun:test';
const sql = new Database(':memory:');
let recording = false;
const calls: Record<string, number> = {};
let indexedBytes = 0;
const record = (query: string, values: any[]) => {
  if (!recording) return;
  const key = query.replace(/\s+/g, ' ').trim();
  calls[key] = (calls[key] ?? 0) + 1;
  if (key.startsWith('INSERT OR REPLACE INTO notes_fts')) indexedBytes += new TextEncoder().encode(String(values[0])).length;
};
mock.module('@tauri-apps/plugin-sql', () => ({ default: { load: async () => ({
  execute: async (query: string, values: any[] = []) => { record(query, values); return sql.query(query).run(...values); },
  select: async (query: string, values: any[] = []) => { record(query, values); return sql.query(query).all(...values); },
  close: async () => {},
}) } }));
const db = await import('../../src/services/database');
await db.initDatabase('sqlite:round4-probe');
const book = await db.createNotebook('Synthetic performance probe');
const note = await db.createNote(book.id, 'Large code note');
const code = Array.from({length:1000}, (_,i) => `const item${i} = { index: ${i}, label: "performance sample ${i}" };`).join('\n');
await db.updateCell(note.id, note.cells[0].id, { data: code });
await db.flushSearchIndex();
recording = true;
const start = performance.now();
for(let i=1;i<=30;i++) await db.updateCell(note.id,note.cells[0].id,{data: code+'x'.repeat(i)});
await db.flushSearchIndex();
const sequential = {edits:30,initialBytes:new TextEncoder().encode(code).length,totalSqlCalls:Object.values(calls).reduce((a,b)=>a+b,0),indexedBytes,sqliteOnlyElapsedMs:performance.now()-start,calls};
recording = false;
await Promise.all(Array.from({length:30},(_,i)=>db.updateCell(note.id,note.cells[0].id,{data:code+'z'.repeat(i+1)})));
await db.flushSearchIndex();
const concurrent = {concurrentEdits:30,indexRows:sql.query('SELECT count(*) AS count FROM notes_fts WHERE note_id = ?').get(note.id),searchResults:(await db.searchNotes('performance')).length};
console.log(JSON.stringify({sequential,concurrent},null,2));

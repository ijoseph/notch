import { Database } from 'bun:sqlite';
import { expect, mock, spyOn } from 'bun:test';
import hljs from 'highlight.js';
const sql = new Database(':memory:');
let cellRows = 0, resourceReads = 0, failResourceRead = false, failMigration = false;
let blockResourceRead: Promise<void> | undefined;
mock.module('@tauri-apps/plugin-sql', () => ({ default: { load: async () => ({
  execute: async (query: string, values: any[] = []) => {
    if (failMigration && query.includes('FROM json_each(?) j JOIN notes')) { failMigration = false; throw new Error('Synthetic migration failure'); }
    return sql.query(query).run(...values);
  },
  select: async (query: string, values: any[] = []) => {
    const rows = sql.query(query).all(...values);
    if (query.includes('SELECT * FROM cells')) cellRows += rows.length;
    if (query.includes('SELECT * FROM resources')) {
      resourceReads++;
      if (failResourceRead) { failResourceRead = false; throw new Error('Synthetic read failure'); }
      if (blockResourceRead) await blockResourceRead;
    }
    return rows;
  }, close: async () => {},
}) } }));
const db = await import('../src/services/database');
const resources = await import('../src/services/resources');
const { createPrintRenderer } = await import('../src/services/export');
await db.initDatabase('sqlite:performance-regression');
const book = await db.createNotebook('Primary');
const other = await db.createNotebook('Other');
sql.transaction(() => {
  for (let i = 0; i < 120; i++) {
    const id = `n${String(i).padStart(3, '0')}`;
    sql.query('INSERT INTO notes (id,notebook_id,title,is_trashed) VALUES (?,?,?,?)').run(id, i < 60 ? book.id : other.id, 'Common title', i === 0 ? 1 : 0);
    sql.query('INSERT INTO cells (id,note_id,type,data,sort_order) VALUES (?,?,?,?,0)').run(`c${i}`, id, 'code', 'common body');
    sql.query('INSERT INTO notes_fts (rowid,note_id,title,content) SELECT rowid,id,title,? FROM notes WHERE id=?').run('common body', id);
  }
})();
cellRows = 0;
const first = await db.searchNotes('common', {limit: 50});
expect(first).toHaveLength(50); expect(cellRows).toBe(50);
const second = await db.searchNotes('common', {limit: 50, offset: 50});
expect(second).toHaveLength(50); expect(new Set([...first, ...second].map(n => n.id)).size).toBe(100);
expect(await db.searchNotes('common', {limit: 50, offset: 100})).toHaveLength(19);
const filtered = await db.searchNotes('common', {notebookId: other.id, limit: 50});
expect(filtered).toHaveLength(50); expect(filtered.every(n => n.notebookId === other.id && !n.isTrashed)).toBe(true);
expect((await db.searchNotes('common', {includeTrash:true, limit:1}))[0].id).toBe('n000');
console.log('PASS bounded search, filtering and stable pagination');

const image = await db.createResource('n001', 'image.png', 'image/png', 'AAAA');
resourceReads = 0;
await Promise.all([resources.loadResourcesForNote('n001'), resources.loadResourcesForNote('n001')]);
await resources.loadResourcesForNote('n001');
expect(resourceReads).toBe(1); expect(resources.getResourceDataUrl(image.id)).toBe('data:image/png;base64,AAAA');
await db.createResource('n001', 'new.png', 'image/png', 'BBBB');
expect(resources.getResourceDataUrl(image.id)).toBe('data:image/png;base64,AAAA');
await resources.loadResourcesForNote('n001'); expect(resourceReads).toBe(2);
await Promise.all([resources.loadResourcesForNote('n002'), resources.loadResourcesForNote('n002')]);
await resources.loadResourcesForNote('n002'); expect(resourceReads).toBe(3);
failResourceRead = true;
await expect(resources.loadResourcesForNote('n003')).rejects.toThrow('Synthetic read failure');
await resources.loadResourcesForNote('n003'); expect(resourceReads).toBe(5);
console.log('PASS cached, concurrent, empty, mutated and failed attachment reads');

let release!: () => void;
blockResourceRead = new Promise<void>(resolve => {release = resolve;});
const stale = resources.loadResourcesForNote('n004');
await db.initDatabase('sqlite:another-library');
release(); await stale; blockResourceRead = undefined;
expect(resources.getResourceDataUrl(image.id)).toBeUndefined();
const before = resourceReads;
await resources.loadResourcesForNote('n004'); expect(resourceReads).toBe(before + 1);
console.log('PASS library switch discards cached and in-flight attachment state');

const note = (await db.getNote('n001'))!;
note.cells = [{id:'a',type:'code',language:'javascript',data:'const a = 1',sortOrder:0}, {id:'b',type:'code',language:'javascript',data:'const b = 2',sortOrder:1}];
const highlight = spyOn(hljs, 'highlight');
const renderer = createPrintRenderer();
const original = await renderer.render(note); expect(highlight).toHaveBeenCalledTimes(2);
const renamed = await renderer.render({...note,title:'Changed title'}); expect(highlight).toHaveBeenCalledTimes(2); expect(renamed.headerHtml).toContain('Changed title');
const edited = {...note,cells:[{...note.cells[0],data:'const a = 3'},note.cells[1]]};
await renderer.render(edited); expect(highlight).toHaveBeenCalledTimes(3);
await renderer.render({...edited,cells:[...edited.cells].reverse()}); expect(highlight).toHaveBeenCalledTimes(3);
expect((await renderer.render(note)).cells).toEqual(original.cells); expect(highlight).toHaveBeenCalledTimes(4);
await db.createResource(note.id,'invalidate.png','image/png','CCCC');
await renderer.render(note); expect(highlight).toHaveBeenCalledTimes(6);
renderer.clear(); await renderer.render(note); expect(highlight).toHaveBeenCalledTimes(8);
highlight.mockRestore();
console.log('PASS incremental print rendering, content undo, reorder and invalidation');

const rich = await db.createNote(book.id, 'Rich search');
await db.updateCell(rich.id, rich.cells[0].id, {type:'text',data:'<p>Visible &amp; searchable <b>richneedle</b></p><script>hiddenScriptNeedle</script>'});
await db.flushSearchIndex();
cellRows = 0;
const richResults = await db.searchNoteSummaries('richneedle');
expect(richResults[0].excerpt).toContain('Visible & searchable richneedle');
expect(richResults[0].excerpt).not.toContain('<b>');
expect(cellRows).toBe(0);
expect(await db.searchNoteSummaries('hiddenScriptNeedle')).toHaveLength(0);
const late = await db.createNote(book.id, 'Late match');
await db.updateCell(late.id, late.cells[0].id, {type:'code',data:'prefix '.repeat(200000)+' lateUniqueNeedle std::vector<int> C++'});
await db.flushSearchIndex(); cellRows = 0;
const lateResults = await db.searchNoteSummaries('lateUniqueNeedle');
expect(lateResults[0].excerpt).toContain('lateUniqueNeedle');
expect(lateResults[0].excerpt).toContain('std::vector<int>');
expect(lateResults[0].excerpt.length).toBeLessThanOrEqual(1024); expect(cellRows).toBe(0);
expect((await db.searchNoteSummaries('Rich search')).some(n=>n.id===rich.id)).toBe(true);
// Simulate an old library whose index still contains markup, then upgrade it.
sql.query('UPDATE notes_fts SET content = ? WHERE note_id = ?').run('<b>staleMarkupOnly</b>',rich.id);
sql.query('DELETE FROM search_migrations WHERE version = 2').run();
failMigration = true;
await expect(db.initDatabase('sqlite:migrated-library')).rejects.toThrow('Synthetic migration failure');
await db.initDatabase('sqlite:migrated-library');
expect((await db.searchNoteSummaries('richneedle'))[0].excerpt).not.toContain('<b>');
expect(await db.searchNoteSummaries('staleMarkupOnly')).toHaveLength(0);
console.log('PASS compact excerpts, late/code/title matches and old-index migration');

const active = await db.createResource('n001','active.png','image/png',Buffer.alloc(2*1024*1024).toString('base64'));
const releaseActive = resources.retainResourcesForNote('n001');
await resources.loadResourcesForNote('n001');
const retainedIds:string[]=[];
for(let i=0;i<25;i++) {
 const id=`n${String(i+2).padStart(3,'0')}`;
 const r=await db.createResource(id,'budget.png','image/png',Buffer.alloc(2*1024*1024,i).toString('base64'));
 retainedIds.push(r.id); await resources.loadResourcesForNote(id);
}
expect(resources.resourceCacheStats().estimatedBytes).toBeLessThanOrEqual(resources.resourceCacheStats().budget);
expect(resources.getResourceDataUrl(active.id)).toBeDefined();
expect(resources.getResourceDataUrl(retainedIds[0])).toBeUndefined();
const readsBeforeReload=resourceReads;
await resources.loadResourcesForNote('n002');
expect(resourceReads).toBe(readsBeforeReload+1); expect(resources.getResourceDataUrl(retainedIds[0])).toBeDefined();
// Active oversized notes are allowed over budget and are evicted upon release.
const releaseHuge = resources.retainResourcesForNote('n050');
const huge=await db.createResource('n050','huge.png','image/png','A'.repeat(34*1024*1024));
await resources.loadResourcesForNote('n050'); expect(resources.getResourceDataUrl(huge.id)).toBeDefined();
releaseHuge(); releaseActive();
expect(resources.resourceCacheStats().estimatedBytes).toBeLessThanOrEqual(resources.resourceCacheStats().budget);
console.log('PASS byte-budget eviction, active protection, reload and oversized-note release');

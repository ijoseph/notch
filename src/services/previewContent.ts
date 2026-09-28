export interface PreviewCell { id: string; html: string }
export interface PreviewContent {
  noteId: string;
  title: string;
  headerHtml: string;
  cells: PreviewCell[];
}
export interface PreviewUpdate extends Omit<PreviewContent, 'cells'> {
  order: string[];
  cells: PreviewCell[];
}

/** A full initial snapshot, then only changed cells (including image data). */
export function previewUpdate(next: PreviewContent, previous?: PreviewContent): PreviewUpdate {
  const old = new Map(previous?.noteId === next.noteId ? previous.cells.map(cell => [cell.id, cell.html]) : []);
  return { ...next, order: next.cells.map(cell => cell.id), cells: next.cells.filter(cell => old.get(cell.id) !== cell.html) };
}
export function applyPreviewUpdate(previous: PreviewContent | null, update: PreviewUpdate): PreviewContent {
  const cells = new Map(previous?.noteId === update.noteId ? previous.cells.map(cell => [cell.id, cell]) : []);
  for (const cell of update.cells) cells.set(cell.id, cell);
  return { noteId: update.noteId, title: update.title, headerHtml: update.headerHtml,
    cells: update.order.flatMap(id => cells.has(id) ? [cells.get(id)!] : []) };
}

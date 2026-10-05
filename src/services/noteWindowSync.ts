import type { Note } from '../types';
/** Replace only acknowledged note IDs; retain unrelated local state and order. */
export function reconcileNotes(current: Note[], ids: string[], committed: (Note | null)[]): Note[] {
  const changes = new Map(ids.map((id, index) => [id, committed[index] ?? null]));
  const existing = new Set(current.map(note => note.id));
  return current.flatMap(note => changes.has(note.id) ? changes.get(note.id) ? [changes.get(note.id)!] : [] : [note])
    .concat(committed.filter((note): note is Note => Boolean(note && !existing.has(note.id))));
}

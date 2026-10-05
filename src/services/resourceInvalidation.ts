// Shared by database writes and resource readers, without a database/cache cycle.
let scope = 0;
const revisions = new Map<string, number>();
const listeners = new Set<(noteId?: string, remove?: boolean) => void>();
export function resourceScope(): number { return scope; }
export function resourceRevision(noteId: string): string {
  return `${scope}:${revisions.get(noteId) ?? 0}`;
}
export function invalidateResources(noteId?: string, remove = false): void {
  if (noteId === undefined) { scope++; revisions.clear(); }
  else revisions.set(noteId, (revisions.get(noteId) ?? 0) + 1);
  for (const listener of listeners) listener(noteId, remove);
}
export function onResourcesInvalidated(listener: (noteId?: string, remove?: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

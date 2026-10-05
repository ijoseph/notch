import { useSyncExternalStore } from 'react';
import * as db from './database';
import { onResourcesInvalidated, resourceRevision } from './resourceInvalidation';

// In-memory cache mapping resource id -> a ready-to-use data: URL. Resources are
// stored in SQLite as base64 text (see database.ts) and resolved to data URLs on
// demand so cell content only ever holds a stable `notch-resource://<id>` ref.
interface CachedResource {
  noteId: string;
  dataUrl: string;
  mimeType: string;
  filename: string;
}

const cache = new Map<string, CachedResource>();

// Simple version counter so React components re-render when the cache changes
// (e.g. after a note's resources finish loading, or a new image is inserted).
let version = 0;
const listeners = new Set<() => void>();

function bump(): void {
  version += 1;
  for (const listener of listeners) listener();
}

export const RESOURCE_PROTOCOL = 'notch-resource://';

function toDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType || 'application/octet-stream'};base64,${base64}`;
}

const loadedNotes = new Set<string>();
const loadingNotes = new Map<string, Promise<void>>();
// Conservative UTF-16 estimate; active consumers may exceed the budget until
// they release their leases. Evict whole notes so a reload cannot be partial.
const CACHE_BUDGET = 64 * 1024 * 1024;
const noteUsage = new Map<string, number>();
const leases = new Map<symbol, string>();
let cachedBytes = 0;
function touch(noteId: string): void {
  const bytes = noteUsage.get(noteId) ?? 0;
  noteUsage.delete(noteId); noteUsage.set(noteId, bytes);
}
function removeNote(noteId: string): void {
  cachedBytes -= noteUsage.get(noteId) ?? 0;
  noteUsage.delete(noteId); loadedNotes.delete(noteId);
  for (const [id, resource] of cache) if (resource.noteId === noteId) cache.delete(id);
}
function trim(protectedNote?: string): void {
  const active = new Set(leases.values());
  for (const noteId of noteUsage.keys()) {
    if (cachedBytes <= CACHE_BUDGET && noteUsage.size <= 256) break;
    if (noteId !== protectedNote && !active.has(noteId) && !loadingNotes.has(noteId)) removeNote(noteId);
  }
}
function cacheResource(id: string, resource: CachedResource): void {
  const prior = cache.get(id);
  const delta = (resource.dataUrl.length - (prior?.dataUrl.length ?? 0)) * 2;
  cache.set(id, resource);
  cachedBytes += delta;
  noteUsage.set(resource.noteId, (noteUsage.get(resource.noteId) ?? 0) + delta);
  touch(resource.noteId);
}
export function retainResourcesForNote(noteId: string): () => void {
  const lease = Symbol(noteId); leases.set(lease, noteId); touch(noteId);
  return () => { leases.delete(lease); trim(); };
}
export function resourceCacheStats() {
  return { estimatedBytes: cachedBytes, budget: CACHE_BUDGET, notes: noteUsage.size, resources: cache.size };
}

onResourcesInvalidated((noteId, remove) => {
  if (noteId === undefined) { cache.clear(); loadedNotes.clear(); loadingNotes.clear(); noteUsage.clear(); cachedBytes = 0; }
  else {
    loadedNotes.delete(noteId); loadingNotes.delete(noteId);
    // Resource creation is append-only: existing cached images remain valid.
    if (remove) removeNote(noteId);
  }
  bump();
});

/** Share concurrent reads, including empty notes; writes invalidate this state. */
export function loadResourcesForNote(noteId: string): Promise<void> {
  touch(noteId);
  if (loadedNotes.has(noteId)) return Promise.resolve();
  const pending = loadingNotes.get(noteId);
  if (pending) return pending;
  const revision = resourceRevision(noteId);
  const work = (async () => {
    const resources = await db.getResourcesByNote(noteId);
    // An old library read must never populate the new library's cache.
    if (revision !== resourceRevision(noteId)) return;
    let changed = false;
    for (const resource of resources) {
      if (!cache.has(resource.id)) {
        cacheResource(resource.id, {
          noteId,
          dataUrl: toDataUrl(resource.data, resource.mimeType ?? ''),
          mimeType: resource.mimeType ?? '',
          filename: resource.filename,
        });
        changed = true;
      }
    }
    loadedNotes.add(noteId);
    trim(noteId);
    if (changed) bump();
  })();
  loadingNotes.set(noteId, work);
  void work.finally(() => {
    if (loadingNotes.get(noteId) === work) loadingNotes.delete(noteId);
  }).catch(() => {});
  return work;
}

export function getResourceVersion(): number { return version; }

export function getResourceDataUrl(id: string): string | undefined {
  const resource = cache.get(id);
  if (resource) touch(resource.noteId);
  return resource?.dataUrl;
}

/** Resolve a single href/src: `notch-resource://<id>` -> data URL, else unchanged. */
export function resolveResourceUrl(href: string): string {
  if (href.startsWith(RESOURCE_PROTOCOL)) {
    const id = href.slice(RESOURCE_PROTOCOL.length);
    return getResourceDataUrl(id) ?? href;
  }
  return href;
}

/** Persist a new image resource (base64) and warm the cache. Returns its id. */
export async function createResourceFromBase64(
  noteId: string,
  filename: string,
  mimeType: string,
  base64: string
): Promise<string> {
  const resource = await db.createResource(noteId, filename, mimeType, base64);
  cacheResource(resource.id, { noteId, dataUrl: toDataUrl(base64, mimeType), mimeType, filename });
  trim(noteId);
  bump();
  return resource.id;
}

/** Read a browser File into base64 + mime, then store it as a resource. */
export async function createResourceFromFile(noteId: string, file: File): Promise<string> {
  const { base64, mimeType } = await readFileAsBase64(file);
  return createResourceFromBase64(noteId, file.name || 'image', mimeType, base64);
}

function readFileAsBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(',');
      const meta = result.slice(0, comma);
      const base64 = result.slice(comma + 1);
      const mimeMatch = meta.match(/^data:([^;]+)/);
      resolve({ base64, mimeType: mimeMatch?.[1] || file.type || 'application/octet-stream' });
    };
    reader.readAsDataURL(file);
  });
}

/** Convert raw bytes (e.g. from Tauri fs.readFile) to base64. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// ---- Rich-text (contentEditable) hydration helpers ----
// Stored form keeps `notch-resource://<id>` in img src; the live DOM needs a real
// data URL. These swap between the two using a DOM template so we never mangle
// attributes with regexes.

export function resolveResourceHtml(html: string): string {
  if (!html.includes(RESOURCE_PROTOCOL)) return html;
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  tpl.content.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') ?? '';
    if (src.startsWith(RESOURCE_PROTOCOL)) {
      const id = src.slice(RESOURCE_PROTOCOL.length);
      img.setAttribute('data-resource-id', id);
      const url = getResourceDataUrl(id);
      if (url) img.setAttribute('src', url);
    }
  });
  return tpl.innerHTML;
}

export function dehydrateResourceHtml(html: string): string {
  if (!html.includes('data-resource-id')) return html;
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  tpl.content.querySelectorAll('img[data-resource-id]').forEach(img => {
    const id = img.getAttribute('data-resource-id');
    if (id) img.setAttribute('src', `${RESOURCE_PROTOCOL}${id}`);
  });
  return tpl.innerHTML;
}

/** Replace resource refs in plain text/markdown with inline data URLs (for export). */
export function inlineResourceRefs(text: string): string {
  return text.replace(/notch-resource:\/\/([\w-]+)/g, (match, id) => getResourceDataUrl(id) ?? match);
}

// ---- React binding ----

export function useResourceVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

import { appConfigDir, join } from '@tauri-apps/api/path';
import { mkdir, writeFile, exists } from '@tauri-apps/plugin-fs';
import { v4 as uuid } from 'uuid';
import { setImageBaseDir } from '../utils/markdown';

// Images are stored alongside the SQLite database (which tauri-plugin-sql
// places in the app config dir) under an `images/` subdirectory. The markdown
// stores a relative path like `images/<uuid>.png`, kept portable and readable.
const IMAGES_SUBDIR = 'images';

// Default display width appended to imported images so they render at a
// reasonable size instead of their full (often huge) intrinsic resolution.
export const DEFAULT_IMAGE_WIDTH = 800;

let dataDir: string | null = null;
let initialized = false;

export async function initImageStore(): Promise<void> {
  if (initialized) return;
  dataDir = await appConfigDir();
  setImageBaseDir(dataDir);
  const dir = await join(dataDir, IMAGES_SUBDIR);
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  initialized = true;
}

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/x-icon': 'ico',
  'image/heic': 'heic',
};

// Pick a sensible file extension from the dropped/pasted file's MIME type,
// falling back to the original filename's extension, then to "png".
export function extForFile(file: File): string {
  const fromMime = MIME_EXT[file.type.toLowerCase()];
  if (fromMime) return fromMime;
  const dot = file.name.lastIndexOf('.');
  if (dot >= 0 && dot < file.name.length - 1) {
    return file.name.slice(dot + 1).toLowerCase();
  }
  return 'png';
}

// Persist raw image bytes to the images directory and return the relative path
// (e.g. "images/<uuid>.png") suitable for embedding in markdown.
export async function saveImageBytes(bytes: Uint8Array, ext: string): Promise<string> {
  await initImageStore();
  const filename = `${uuid()}.${ext}`;
  const full = await join(dataDir!, IMAGES_SUBDIR, filename);
  await writeFile(full, bytes);
  return `${IMAGES_SUBDIR}/${filename}`;
}

// Save an image File and return the markdown snippet to insert, including the
// default `=800x` sizing suffix.
export async function importImageFile(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const relPath = await saveImageBytes(bytes, extForFile(file));
  return `![](${relPath} =${DEFAULT_IMAGE_WIDTH}x)`;
}

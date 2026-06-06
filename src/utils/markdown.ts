import { marked, type Tokens } from 'marked';
import { convertFileSrc } from '@tauri-apps/api/core';

// Base directory that relative image paths (e.g. "images/foo.png") are
// resolved against. Set once at startup via setImageBaseDir() to the same
// directory that holds the SQLite database (the app config dir).
let imageBaseDir: string | null = null;

export function setImageBaseDir(dir: string): void {
  imageBaseDir = dir;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * Resolve an image `src` for rendering inside the Tauri webview.
 * - Remote/data/blob/asset URLs (anything with a scheme) are returned as-is.
 * - Absolute and relative local paths are resolved against the app data dir
 *   and converted to an `asset://` URL the webview is allowed to load.
 */
export function resolveImageSrc(href: string): string {
  if (!href) return href;
  // Any URI scheme (http:, https:, data:, blob:, asset:, file:, notch:, ...)
  if (/^[a-z][a-z0-9+.\-]*:/i.test(href)) return href;
  if (href.startsWith('/')) return convertFileSrc(href);
  if (!imageBaseDir) return href; // base dir not ready yet
  const base = imageBaseDir.replace(/[/\\]+$/, '');
  const rel = href.replace(/^[/\\]+/, '');
  return convertFileSrc(`${base}/${rel}`);
}

interface SizedImageToken extends Tokens.Generic {
  type: 'sizedImage';
  text: string;
  href: string;
  title: string;
  width: string;
  height: string;
}

// Custom inline extension that handles standard `![alt](url)` images *and* the
// Quiver/Typora-style sizing suffix `![alt](url =WIDTHxHEIGHT)`. Plain `marked`
// drops the whole image when the `=800x` suffix is present (the space breaks its
// image rule), so we parse images ourselves and emit width/height attributes.
const sizedImage = {
  name: 'sizedImage',
  level: 'inline' as const,
  start(src: string) {
    return src.indexOf('![');
  },
  tokenizer(src: string): SizedImageToken | undefined {
    const rule = /^!\[([^\]]*)\]\(\s*<?([^\s>]+)>?(?:\s+=(\d*)x(\d*))?(?:\s+"([^"]*)")?\s*\)/;
    const match = rule.exec(src);
    if (!match) return undefined;
    return {
      type: 'sizedImage',
      raw: match[0],
      text: match[1] ?? '',
      href: match[2] ?? '',
      width: match[3] ?? '',
      height: match[4] ?? '',
      title: match[5] ?? '',
    };
  },
  renderer(token: Tokens.Generic) {
    const t = token as SizedImageToken;
    const src = resolveImageSrc(t.href);
    const alt = ` alt="${escapeAttr(t.text)}"`;
    const width = t.width ? ` width="${t.width}"` : '';
    const height = t.height ? ` height="${t.height}"` : '';
    const title = t.title ? ` title="${escapeAttr(t.title)}"` : '';
    return `<img src="${escapeAttr(src)}"${alt}${width}${height}${title}>`;
  },
};

// Register the extension exactly once on the shared marked singleton. Both
// MarkdownCell and NotePreview import this module, so guard against double
// registration (which would render every image twice).
let registered = false;
export function installMarkdownImageExtension(): void {
  if (registered) return;
  marked.use({ extensions: [sizedImage] });
  registered = true;
}

installMarkdownImageExtension();

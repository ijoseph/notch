import { marked } from 'marked';
import type { Note } from '../types';
import { cellText } from '../utils/searchExcerpt';

function htmlPlainText(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/gi, '\n[Image: $1]\n')
    .replace(/<br\s*\/?>|<\/(?:p|div|li|h[1-6]|tr|blockquote|pre)>/gi, '\n')
    .split('\n').map(line => cellText({ type: 'text', data: line })).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
export function notePlainText(note: Note): string {
  return [note.title, note.tags.length ? note.tags.map(tag => '#' + tag).join(' ') : '', ...note.cells.map(cell => {
    if (cell.type === 'text') return htmlPlainText(cell.data);
    if (cell.type === 'markdown') return htmlPlainText(marked.parse(cell.data, { async: false }) as string);
    return cell.data;
  })].filter(Boolean).join('\n\n');
}
export function noteCodeOnly(note: Note): string { return note.cells.filter(cell => cell.type === 'code').map(cell => cell.data).join('\n\n'); }

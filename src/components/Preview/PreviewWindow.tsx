import { useEffect, useState, useRef } from 'react';
import { emitTo, listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import { applyPreviewUpdate, type PreviewContent, type PreviewUpdate } from '../../services/previewContent';

export default function PreviewWindow({ label }: { label: string }) {
  const [content, setContent] = useState<PreviewContent | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let stopped = false;
    let unlisten: (() => void) | undefined;
    void listen<PreviewUpdate>('preview-content', event => {
      setReady(false); setContent(previous => applyPreviewUpdate(previous, event.payload)); document.title = event.payload.title || 'Preview';
    }).then(async fn => {
      if (stopped) { fn(); return; }
      unlisten = fn;
      await emitTo('main', 'preview-ready', label);
    }).catch(err => setError(String(err)));
    return () => { stopped = true; unlisten?.(); };
  }, [label]);
  useEffect(() => {
    let stopped = false;
    if (!content) return;
    void Promise.all([
      document.fonts.ready,
      ...Array.from(ref.current?.querySelectorAll('img') ?? []).map(image => image.decode().catch(() => {})),
    ]).then(() => { if (!stopped) setReady(true); });
    return () => { stopped = true; };
  }, [content]);
  return <div className="standalone-preview">
    <div className="preview-window-toolbar">
      <span>{label === 'pdf-preview' ? 'PDF Preview' : 'Live Preview'}</span>
      <button disabled={!ready} onClick={() => void invoke('print_preview').catch(err => setError(String(err)))}>Save as PDF…</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {label === 'pdf-preview' && <p className="pdf-instructions">Choose PDF → Save as PDF in the print dialog.</p>}
    {!content && <p>Loading preview…</p>}
    <div ref={ref} className="print-content" onClick={event => {
      const anchor = (event.target as Element).closest('a');
      const href = anchor?.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      event.preventDefault();
      if (/^(notch:\/\/note\/|quiver-note-url[:/])/i.test(href)) {
        void emitTo('main', 'preview-navigate', href);
      } else if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) {
        void open(href).catch(err => setError(String(err)));
      }
    }}>
      {content && <div dangerouslySetInnerHTML={{ __html: content.headerHtml }} />}
      {content?.cells.map(cell => <div key={cell.id} dangerouslySetInnerHTML={{ __html: cell.html }} />)}
    </div>
  </div>;
}

import { memo, useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import katex from 'katex';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';
import type { Config } from 'dompurify';
import type { Cell, Note } from '../../types';
// Side-effect import: registers the shared image extension (handles `=800x`
// sizing and resolves local image paths) on the marked singleton.
import '../../utils/markdown';

// Configure DOMPurify for text cells
const sanitizeConfig: Config = {
  ALLOWED_TAGS: [
    'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'span', 'div',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'hr', 'sub', 'sup',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
  ALLOW_DATA_ATTR: false,
  RETURN_TRUSTED_TYPE: false,
  // Allow custom protocols for internal links
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|notch|quiver-note-url):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

interface NotePreviewProps {
  note: Note;
}

// Add line numbers to code
function addLineNumbers(code: string, highlighted: string): string {
  const lines = code.split('\n');
  const lineCount = lines.length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');
  return `<div class="code-with-lines"><div class="line-numbers">${lineNumbers}</div><code>${highlighted}</code></div>`;
}

// Configure marked with highlight.js
marked.use({
  gfm: true,
  breaks: true,
  // Disable auto-linking of raw URLs - only explicit [text](url) links should work
  tokenizer: {
    url() { return undefined; },
  },
  renderer: {
    // Custom link renderer to preserve notch:// and quiver-note-url:// protocols
    link(href: string, title: string | null | undefined, text: string) {
      const titleAttr = title ? ` title="${title}"` : '';
      return `<a href="${href}"${titleAttr}>${text}</a>`;
    },
    code(code: string, infostring?: string) {
      const lang = infostring || '';
      let highlighted = code;
      if (lang && hljs.getLanguage(lang)) {
        try {
          highlighted = hljs.highlight(code, { language: lang }).value;
        } catch {
          // Fall through
        }
      }
      return `<pre class="hljs language-${lang || 'plaintext'}">${addLineNumbers(code, highlighted)}</pre>`;
    },
  },
});

// Renders a single mermaid diagram, re-rendering only when its source changes.
function DiagramPreview({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    const el = ref.current;
    if (!el) return;
    if (!code.trim()) {
      el.innerHTML = '';
      return;
    }
    const id = `mermaid-preview-${Math.random().toString(36).slice(2, 11)}`;
    mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      })
      .catch(() => {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = '<span style="color: var(--danger-color)">Invalid diagram</span>';
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code]);
  return <div className="preview-cell diagram-preview" ref={ref} />;
}

// Renders one cell. Memoized so that editing one cell doesn't re-parse every
// other cell in the note (the store preserves object identity for unchanged
// cells, so React.memo skips them).
const PreviewCell = memo(function PreviewCell({ cell }: { cell: Cell }) {
  switch (cell.type) {
    case 'text':
      return (
        <div
          className="preview-cell preview-text cell-richtext"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(cell.data, sanitizeConfig) }}
        />
      );

    case 'code': {
      const highlighted =
        cell.language && hljs.getLanguage(cell.language)
          ? hljs.highlight(cell.data, { language: cell.language }).value
          : cell.data;
      return (
        <div className="preview-cell preview-code">
          <pre
            className={`hljs language-${cell.language || 'plaintext'}`}
            dangerouslySetInnerHTML={{ __html: addLineNumbers(cell.data, highlighted) }}
          />
        </div>
      );
    }

    case 'markdown':
      try {
        const html = marked.parse(cell.data) as string;
        return (
          <div
            className="preview-cell markdown-preview"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } catch {
        return (
          <div className="preview-cell preview-text">
            <p>{cell.data}</p>
          </div>
        );
      }

    case 'latex':
      try {
        const latexHtml = katex.renderToString(cell.data, {
          displayMode: true,
          throwOnError: false,
          output: 'html',
        });
        return (
          <div
            className="preview-cell latex-preview"
            dangerouslySetInnerHTML={{ __html: latexHtml }}
          />
        );
      } catch {
        return (
          <div className="preview-cell preview-text">
            <p style={{ color: 'var(--danger-color)' }}>Invalid LaTeX</p>
          </div>
        );
      }

    case 'diagram':
      return <DiagramPreview code={cell.data} />;

    default:
      return (
        <div className="preview-cell preview-text">
          <p>{cell.data}</p>
        </div>
      );
  }
});

export default function NotePreview({ note }: NotePreviewProps) {
  const tags = useMemo(() => note.tags, [note.tags]);

  return (
    <div className="note-preview-content">
      <h1 style={{ marginBottom: '24px' }}>{note.title || 'Untitled'}</h1>
      {tags.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          {tags.map(tag => (
            <span
              key={tag}
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                marginRight: '8px',
                marginBottom: '4px',
                background: 'var(--bg-tertiary)',
                borderRadius: '4px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
      <div className="preview-cells">
        {note.cells.map(cell => (
          <PreviewCell key={cell.id} cell={cell} />
        ))}
      </div>
    </div>
  );
}

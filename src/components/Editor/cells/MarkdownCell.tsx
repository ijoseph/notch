import { useMemo } from 'react';
import { EditorView } from '@codemirror/view';
import { importImageFile } from '../../../services/images';
import CmEditor from '../cm/CmEditor';
import { markdownExtension } from '../cm/languages';

interface MarkdownCellProps {
  data: string;
  onChange: (data: string) => void;
  onFocus: () => void;
  isFocused?: boolean;
  onBackspaceEmpty?: () => void;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
}

// Collect image files from a paste/drop DataTransfer.
function imageFilesFrom(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const out: File[] = [];
  for (const f of Array.from(dt.files)) {
    if (f.type.startsWith('image/')) out.push(f);
  }
  if (out.length === 0 && dt.items) {
    for (const item of Array.from(dt.items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) out.push(f);
      }
    }
  }
  return out;
}

// Save image files and insert their markdown (with default `=800x` sizing) into
// the editor at the given position.
async function insertImages(view: EditorView, files: File[], pos: number) {
  const snippets: string[] = [];
  for (const file of files) {
    try {
      snippets.push(await importImageFile(file));
    } catch (err) {
      console.error('Failed to import image:', err);
    }
  }
  if (snippets.length === 0) return;
  const text = snippets.join('\n') + '\n';
  view.dispatch({
    changes: { from: pos, insert: text },
    selection: { anchor: pos + text.length },
  });
}

// CodeMirror handler that imports images pasted or dropped into a markdown cell.
const imageInputHandler = EditorView.domEventHandlers({
  paste(event, view) {
    const files = imageFilesFrom(event.clipboardData);
    if (files.length === 0) return false;
    event.preventDefault();
    void insertImages(view, files, view.state.selection.main.from);
    return true;
  },
  drop(event, view) {
    const files = imageFilesFrom(event.dataTransfer);
    if (files.length === 0) return false;
    event.preventDefault();
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.from;
    void insertImages(view, files, pos);
    return true;
  },
});

// The markdown cell always shows the raw markdown source (with live syntax
// highlighting). The rendered output appears in the preview pane.
export default function MarkdownCell({ data, onChange, onFocus, isFocused, onBackspaceEmpty, onNavigatePrev, onNavigateNext }: MarkdownCellProps) {
  const language = useMemo(() => markdownExtension(), []);
  const extraExtensions = useMemo(() => [imageInputHandler], []);

  return (
    <CmEditor
      value={data}
      onChange={onChange}
      onFocus={onFocus}
      isFocused={isFocused}
      language={language}
      placeholder="Write markdown…"
      onBackspaceEmpty={onBackspaceEmpty}
      onNavigatePrev={onNavigatePrev}
      onNavigateNext={onNavigateNext}
      extraExtensions={extraExtensions}
    />
  );
}

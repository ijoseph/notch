import { useEffect, useRef } from 'react';
import { EditorState, Compartment, Annotation, Prec, type Extension } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightSpecialChars,
  drawSelection,
  placeholder as cmPlaceholder,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, indentOnInput, bracketMatching } from '@codemirror/language';
import { useEditorKeymap } from '../../../store';
import { keymapModeExtension } from './keymap';
import { editorTheme, colorfulHighlightStyle } from './theme';

// Marks transactions that sync external value changes into the editor, so the
// update listener can skip re-reporting them as user edits.
const External = Annotation.define<boolean>();

interface CmEditorProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  isFocused?: boolean;
  language?: Extension | null;
  showLineNumbers?: boolean;
  maxHeight?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onBackspaceEmpty?: () => void;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  extraExtensions?: Extension[];
}

export default function CmEditor({
  value,
  onChange,
  onFocus,
  onBlur,
  isFocused,
  language,
  showLineNumbers = false,
  maxHeight,
  placeholder,
  autoFocus = false,
  onBackspaceEmpty,
  onNavigatePrev,
  onNavigateNext,
  extraExtensions,
}: CmEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const keymapMode = useEditorKeymap();

  // Keep the latest callbacks in a ref so the (create-once) editor's keymap
  // closures always call the current handlers without rebuilding the editor.
  const cb = useRef({ onChange, onFocus, onBlur, onBackspaceEmpty, onNavigatePrev, onNavigateNext });
  cb.current = { onChange, onFocus, onBlur, onBackspaceEmpty, onNavigatePrev, onNavigateNext };

  const keymapCompartment = useRef(new Compartment());
  const languageCompartment = useRef(new Compartment());

  // Create the editor once.
  useEffect(() => {
    if (!containerRef.current) return;

    // Boundary navigation: arrow past the first/last line jumps cells, and
    // backspace in an empty cell deletes it. Returns false otherwise so normal
    // editing (and vim/emacs) handle the keys.
    const navKeymap = Prec.high(
      keymap.of([
        {
          key: 'ArrowUp',
          run: (view) => {
            const head = view.state.selection.main.head;
            if (view.state.doc.lineAt(head).number === 1 && cb.current.onNavigatePrev) {
              cb.current.onNavigatePrev();
              return true;
            }
            return false;
          },
        },
        {
          key: 'ArrowDown',
          run: (view) => {
            const head = view.state.selection.main.head;
            if (view.state.doc.lineAt(head).number === view.state.doc.lines && cb.current.onNavigateNext) {
              cb.current.onNavigateNext();
              return true;
            }
            return false;
          },
        },
        {
          key: 'Backspace',
          run: (view) => {
            if (view.state.doc.length === 0 && cb.current.onBackspaceEmpty) {
              cb.current.onBackspaceEmpty();
              return true;
            }
            return false;
          },
        },
        // Consume Shift-Enter so CM doesn't insert a newline; the keydown still
        // bubbles to NoteEditor, which uses it to add a new cell.
        { key: 'Shift-Enter', run: () => true },
      ])
    );

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const isExternal = update.transactions.some((tr) => tr.annotation(External));
        if (!isExternal) cb.current.onChange(update.state.doc.toString());
      }
    });

    const domHandlers = EditorView.domEventHandlers({
      focus: () => cb.current.onFocus?.(),
      blur: () => cb.current.onBlur?.(),
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        keymapCompartment.current.of(keymapModeExtension(keymapMode)),
        navKeymap,
        history(),
        drawSelection(),
        highlightSpecialChars(),
        indentOnInput(),
        bracketMatching(),
        syntaxHighlighting(colorfulHighlightStyle),
        languageCompartment.current.of(language ?? []),
        EditorView.lineWrapping,
        showLineNumbers ? lineNumbers() : [],
        showLineNumbers ? highlightActiveLine() : [],
        placeholder ? cmPlaceholder(placeholder) : [],
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        editorTheme,
        maxHeight
          ? EditorView.theme({ '&': { maxHeight }, '.cm-scroller': { overflow: 'auto' } })
          : [],
        updateListener,
        domHandlers,
        ...(extraExtensions ?? []),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    if (autoFocus || isFocused) {
      view.focus();
    }
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (e.g. another pane editing the same cell).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (value !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
        annotations: External.of(true),
      });
    }
  }, [value]);

  // Live-reconfigure the language (code cells can change language).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: languageCompartment.current.reconfigure(language ?? []) });
  }, [language]);

  // Live-reconfigure keybindings when the user switches default/vim/emacs.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: keymapCompartment.current.reconfigure(keymapModeExtension(keymapMode)) });
  }, [keymapMode]);

  // Focus when this cell becomes the focused cell.
  useEffect(() => {
    const view = viewRef.current;
    if (view && isFocused && !view.hasFocus) {
      view.focus();
    }
  }, [isFocused]);

  return <div ref={containerRef} className="cm-editor-host" />;
}

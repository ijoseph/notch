import { EditorView } from '@codemirror/view';
import { HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// A deliberately vivid palette so code — shell in particular — is colorful.
const palette = {
  fg: '#e6e6e6',
  comment: '#7f8c98',
  keyword: '#ff7ab2', // pink
  operator: '#89ddff', // light blue
  string: '#a5e075', // green
  number: '#ffb86c', // orange
  func: '#82aaff', // blue
  type: '#ffd866', // yellow
  prop: '#78dce8', // cyan
  variable: '#e6e6e6',
  tagName: '#ff6188', // red/pink
  attr: '#ffb86c', // orange
  meta: '#ab9df2', // purple
  link: '#82aaff',
  heading: '#ff7ab2',
  invalid: '#ff5370',
  punctuation: '#abb2bf',
};

// Editor chrome: transparent background so it inherits the app surface, a
// monospace content area, and tidy gutters/cursor/selection styling. Includes
// the vim block-cursor (`.cm-fat-cursor`) treatment.
export const editorTheme = EditorView.theme(
  {
    '&': {
      color: palette.fg,
      backgroundColor: 'transparent',
      fontSize: '13px',
    },
    '.cm-content': {
      fontFamily: "'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace",
      padding: '12px 0',
      caretColor: '#fff',
    },
    '.cm-scroller': {
      fontFamily: "'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace",
      lineHeight: '1.5',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#fff' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      { backgroundColor: 'rgba(120, 170, 255, 0.25)' },
    '.cm-activeLine': { backgroundColor: 'rgba(255, 255, 255, 0.04)' },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: '#5c6370',
      border: 'none',
    },
    '.cm-activeLineGutter': { backgroundColor: 'transparent' },
    // vim block cursor
    '.cm-fat-cursor': { background: '#82aaff', color: '#000' },
    '&:not(.cm-focused) .cm-fat-cursor': {
      background: 'none',
      outline: 'solid 1px #82aaff',
      color: 'transparent',
    },
  },
  { dark: true }
);

export const colorfulHighlightStyle = HighlightStyle.define([
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: palette.comment, fontStyle: 'italic' },
  { tag: [t.keyword, t.modifier, t.controlKeyword, t.moduleKeyword, t.definitionKeyword], color: palette.keyword },
  { tag: [t.operator, t.operatorKeyword, t.compareOperator, t.logicOperator, t.arithmeticOperator], color: palette.operator },
  { tag: [t.string, t.special(t.string), t.character], color: palette.string },
  { tag: [t.regexp], color: palette.string },
  { tag: [t.escape, t.special(t.brace)], color: palette.operator },
  { tag: [t.number, t.integer, t.float], color: palette.number },
  { tag: [t.bool, t.null, t.atom], color: palette.number },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: palette.func },
  { tag: [t.definition(t.function(t.variableName))], color: palette.func, fontWeight: 'bold' },
  { tag: [t.propertyName, t.attributeName], color: palette.prop },
  { tag: [t.typeName, t.className, t.namespace], color: palette.type },
  { tag: [t.variableName, t.definition(t.variableName)], color: palette.variable },
  { tag: [t.tagName, t.angleBracket], color: palette.tagName },
  { tag: [t.attributeValue], color: palette.string },
  { tag: [t.meta, t.annotation], color: palette.meta },
  { tag: [t.labelName], color: palette.func },
  { tag: [t.punctuation, t.separator, t.bracket, t.paren, t.squareBracket, t.brace], color: palette.punctuation },
  { tag: [t.invalid], color: palette.invalid },
  // Markdown
  { tag: [t.heading], color: palette.heading, fontWeight: 'bold' },
  { tag: [t.heading1], color: palette.heading, fontWeight: 'bold', fontSize: '1.4em' },
  { tag: [t.heading2], color: palette.heading, fontWeight: 'bold', fontSize: '1.25em' },
  { tag: [t.heading3], color: palette.heading, fontWeight: 'bold', fontSize: '1.1em' },
  { tag: [t.strong], fontWeight: 'bold', color: palette.fg },
  { tag: [t.emphasis], fontStyle: 'italic', color: palette.fg },
  { tag: [t.strikethrough], textDecoration: 'line-through' },
  { tag: [t.link, t.url], color: palette.link, textDecoration: 'underline' },
  { tag: [t.monospace], color: palette.prop },
  { tag: [t.quote], color: palette.comment, fontStyle: 'italic' },
  { tag: [t.contentSeparator], color: palette.comment },
  // Markdown markup punctuation (#, list markers, *, >, `, []) — muted so only
  // the heading text and inline emphasis stand out, not whole list items.
  { tag: [t.processingInstruction], color: palette.comment },
]);

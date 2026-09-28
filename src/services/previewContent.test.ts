import { expect, test } from 'bun:test';
import { applyPreviewUpdate, previewUpdate, type PreviewContent } from './previewContent';

const original: PreviewContent = {noteId:'one',title:'Note',headerHtml:'<h1>Note</h1>',cells:[
  {id:'a',html:'<p>First</p>'},{id:'image',html:'<img src="data:image/png;base64,AAAA">'},
]};
test('preview patches omit unchanged image data and preserve reordered cells', () => {
  const initial = applyPreviewUpdate(null, previewUpdate(original));
  const next = {...original, cells:[original.cells[1],{...original.cells[0],html:'<p>Edited</p>'}]};
  const update = previewUpdate(next, original);
  expect(update.cells).toEqual([next.cells[1]]);
  expect(applyPreviewUpdate(initial, update)).toEqual(next);
});
test('preview handles deletion, structural undo, empty notes and switching notes', () => {
  const removed = {...original,cells:original.cells.slice(1)};
  expect(applyPreviewUpdate(original,previewUpdate(removed,original))).toEqual(removed);
  expect(applyPreviewUpdate(removed,previewUpdate(original,removed))).toEqual(original);
  const empty = {...original,cells:[]};
  expect(applyPreviewUpdate(original,previewUpdate(empty,original))).toEqual(empty);
  const other = {...original,noteId:'two'};
  expect(previewUpdate(other,original).cells).toEqual(original.cells);
  expect(applyPreviewUpdate(original,previewUpdate(other,original))).toEqual(other);
});

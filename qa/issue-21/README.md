# Issue #21: Markdown highlighting flicker

The Markdown overlay previously switched to escaped plain text whenever its
80 ms debounced highlight result lagged behind the source. This removed all
existing token styles on each keystroke. The fix computes the current overlay
in the same render as the input value and memoizes it by source. The existing
50,000-character plain-text fallback remains in place.

## Reproducible browser regression

Run `bun qa/issue-21/server.ts`, open http://127.0.0.1:1457, and click **Run regression**.
The harness renders the real MarkdownCell with production React. It inspects
both the committed DOM and the next animation frame, so waiting for the
highlighter to settle cannot mask a flash. It exercises slow and fast edits,
deletions, pasted formatting and HTML characters, fenced code, newlines, and
crossing the large-cell fallback boundary in both directions.

- Before the fix: failed; unchanged quotes lost styling during edits.
- After the fix: **92 checks passed**, no stale text or missing quote styles.
- Browser render median: **0.5 ms**; maximum **28.6 ms** including the roughly
  48,000-character formatted fixture. These measure synchronous component
  updates, not native input latency. Large-cell highlighting is still bounded,
  not incremental.

## Native verification

Built the optimized Notch QA app and tested in **Notch Daily**, using a new
synthetic note named **QA Issue 21 — Stable Markdown**. Existing note contents
were not edited.

- Typed below two blockquotes, including individual keys and a typing burst.
- Backspaced and confirmed current text and gray italic blockquote styling.
- Pasted multiline bold, emphasis, and fenced code; inspected source and preview.
- Native Undo removed the paste and restored the prior text.

Native screenshots confirm the rendered appearance; the browser regression
provides the checks for transient styling between edits.

## Other checks

- `bun test`: **123 passed, 0 failed**.
- `bunx tsc --noEmit`: passed.
- Optimized macOS QA build: passed (`main-ax3sfg1x.js`).
- `git diff --check`: passed.

Separate editor/keybinding changes arrived in the workspace during this work.
They were preserved. This issue's production change is limited to removal of
the debounced plain-text transition in MarkdownCell.

# Quiver parity fixes — October 4, 2026

Implements the remaining issues identified in [Quiver round 7](QA-QUIVER-ROUND-7.md). The preceding round-6 fixes remain included in the working tree.

## Changes

- **In-note Find:** matches refer to a cell and source offsets. Monaco decorations and explicit outer scrolling reveal matches outside its rendered viewport. Rich-text and Markdown highlights use measured ranges without inserting text into editable content. Find opens the editor when invoked from preview-only mode, retains keyboard focus while editors mount, and wraps Next/Previous through one consistent match sequence. Source views open for LaTeX/diagram matches.
- **Independent editable note windows:** Note → Open in New Window creates one window per note/library pair, with the existing editor, split preview, cell operations, tags, image support, Find and preferences. Repeating the command raises the existing window. Committed changes synchronize by library; received updates do not write back to disk. Reconciliation retries if local edits arrive during a read. Database pools remain available for detached notes when the main window changes libraries. Closing a note waits for its writes; quitting waits for every detached editor.
- **Presentation:** Note → Present Note opens a dedicated full-screen presentation with a large centered title. Close and Escape exit it. Preview windows identify their owning editor, so a detached note's preview uses that note.
- **Code preferences:** Settings now exposes theme (Dark, Light, High Contrast), tab size, line numbers, invisibles, indent guides, soft tabs and Standard/Vim/Emacs bindings. Preferences persist and update editors live. Keyboard extensions load from bundled local assets through the existing Monaco runtime, avoiding another editor copy in the application bundle. Cursor movement scrolls the enclosing note when needed.
- **Whole-note copy and export:** Note → Copy Note supports HTML source, Markdown, plain text and code only. Plain text strips rich/Markdown formatting while retaining paragraph boundaries and code indentation. Plain-text files are available from Note and the general export chooser. PNG export uses a rendered image preview and the macOS WebKit snapshot API, including embedded images, rendered math and diagrams.

PNG export is implemented for macOS. To bound image allocation, exports above 24 million logical pixels or 30,000 points tall return a clear message recommending PDF. This is an explicit size limit, not silent cropping.

## Automated validation

- `bun test`: **123 passed, 0 failed**, 251 top-level assertions across 20 files (the existing integration test also invokes its isolated regression script).
- TypeScript check passed.
- Rust `cargo check --offline` passed during implementation. The final optimized application build succeeded, was relaunched, and completed native PNG/plain-text export checks.
- Added coverage for late source matches, literal punctuation/Unicode offsets, blank queries, whole-note text/code formatting, preference validation and cross-window reconciliation of updates, additions and deletions.
- Existing global-search, resource-cache, structural-editing, export and preview tests remain passing.

## Native validation

Used the optimized `Notch QA.app` and **Notch Daily**, with existing synthetic QA fixtures.

- Find `item999` in the 1,000-line fixture visibly reached line 1000 and highlighted the matching identifier; the search field retained focus.
- Opened **QA Native Rich Text** in a detached editor. Appended ` WINDOW7`; the editor, split preview and main window all reflected it. Changed the main selection and raised the existing detached editor again. Undo restored the original text. Closing the detached editor returned to the main window with the original text and both images intact.
- Presentation opened with the note title/body/images; Escape returned to the main window.
- PNG export completed through the native save dialog. Inspected the saved image: title, rich-text styling and both embedded images were present, with no application toolbar included. Artifacts: `qa/feature-round-7/rich-note-export.png` and `mixed-note-export.png`. The latter was exported from the final build and visually verified with Markdown, syntax-colored code, rendered math and a complete Start → Finish diagram.
- Whole-note plain-text copy was pasted into Find (not into note content) and inspected. Plain-text export completed through the save dialog and its file was inspected. Re-exported and inspected the updated plain-text conversion after the formatting regression fix: paragraphs remain separate and Markdown image syntax is removed.
- Vim mode loaded and displayed its normal-mode status; `G` visibly scrolled the enclosing note to its final line. Emacs selection persisted and its mark/forward-character commands were exercised without editing. Code line-number toggling worked. Light theme was visually verified after correcting fixed dark-background CSS. Restored Dark, Standard bindings, and line numbers on.
- Quit with a detached editor open after verifying the complete ` QUIT7` marker was visible. Reopening the app retained the full marker; removed it and verified the original text and images were restored.
- Repeated Find from preview-only mode: the editor opened and `item999` appeared at line 1000. Searching `item99`, Shift-Return wrapped to **11 of 11** and Return wrapped back to **1 of 11**.

No native input-to-paint or comparative frame-rate measurement was made. Temporary edits to synthetic fixtures were undone; their modified dates may have changed. No original user note content was edited.

Final QA app was left open in **Notch Daily**, on **QA Native Rich Text**. Test windows and dialogs are closed.

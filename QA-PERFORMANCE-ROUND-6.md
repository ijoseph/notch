# Performance and polish audit — round 6

October 4, 2026. Tested commit `670431d` with a clean working tree at the start. Native app: optimized Notch QA build from September 27, using **Notch Daily**. Quiver comparison: installed Quiver 3.2.7. This pass made no application changes and did not edit note content.

## Findings

### P1: Search excerpts still cause substantial work for large notes

The result-count limit fixed the many-small-notes case, but a page still retrieves full bodies and `searchExcerpt` normalizes/scans them synchronously during rendering. Memoization avoids repeating the scan on hover; it does not eliminate the initial scan.

Synthetic workload using the actual database/search/excerpt services, in-memory SQLite transport, five iterations:

| Workload | Body bytes retrieved | SQL reads | Database + mapping median | Excerpt generation median / maximum |
| --- | ---: | ---: | ---: | ---: |
| 50 matching notes, each 1,140,026 bytes | 57,001,300 | 3 | 18.37 ms | 201.59 / 222.10 ms |

The fixture uses ASCII code-like content with the matching term near the beginning. The whole body is still processed. The UI asks for 51 rows to detect another page, so the real overlay's maximum count is one higher than this probe.

These are Bun/SQLite/service timings, not measured native input-to-paint latency. They exclude disk and Tauri serialization/IPC. The synchronous excerpt work is nevertheless directly on the UI render path. This is a remaining limitation of the preceding fix, not a return of unlimited result-count hydration.

Suggested fix: return compact, bounded excerpts from the search layer and hydrate a complete note only when opened. Prefer an index designed for plain-text snippets so rich text, code, punctuation, and late-in-note matches remain correct. Measure transferred bytes as well as elapsed time.

### P2: Keyboard search selection disappears below the visible list

Native reproduction:

1. Open global search and enter `QA`.
2. After results load, press Down eleven times.
3. The list remains scrolled to its beginning. No selected result is visible.
4. Press Return: **QA Release 0.3.1 — Larger Note** opens, confirming selection had moved to an offscreen result.

The overlay changes `selectedIndex` but does not scroll its selected row into view. This makes keyboard navigation unreliable from the user's perspective even though the correct internal index changes.

Suggested fix: scroll the newly selected row into view with nearest alignment on keyboard navigation, preserve pointer behavior, and expose proper result/selection semantics to accessibility. Test the top/bottom boundaries and paginated results.

### P2: Floating preview carries scroll position into a different note

Native reproduction:

1. Open floating preview for **QA Feature Pass 4 — 1000 lines**.
2. Scroll to its end; `item969`–`item999` and `END-PROBE` are visible.
3. Minimize preview, switch to **QA Release 0.3.1 — Larger Note**, and restore preview through Window → Floating Preview.
4. The new note appears near its bottom (`third48`–`third79`), with its heading offscreen.

Content changes correctly, but the previous scroll offset is retained/clamped to the new document. The preview component has no note-identity scroll reset.

Quiver comparison: scrolled its split preview of the large fixture to approximately 18%, then selected **QA Release Round 3**. Its preview scrollbar reset to 0. This comparison used Quiver's split preview, not its floating window.

Suggested fix: reset floating-preview scrolling when the note identity changes; preserve position for edits within the same note. Include empty selection and library switching in regression checks.

### P2 opportunity: Attachment cache has no within-library eviction budget

An isolated resource-service probe visited 30 synthetic notes, each with a 2 MiB attachment. After the last note was loaded, all **30 data URLs** remained available from the cache: **83,886,780 characters** in total. Switching the database scope cleared all of them, as intended.

This confirms retention of every visited attachment until library switch/deletion, not an OS-memory measurement or a proven leak. The synthetic bytes were not decoded as images. Note bodies are also cached separately; this probe does not measure their contribution.

Suggested improvement: a byte-budgeted cache that retains currently displayed/editor/preview resources and evicts older inactive entries. Avoid evicting in-use images or reintroducing repeated reads while typing.

## Checks that passed

- Fresh automated run: **117 passed, 0 failed**, 230 assertions across 19 files.
- Native Notch completed three cycles through the 1,000-line code note, small Markdown note, and image-rich note (nine switches). Correct titles and both existing images remained visible; no hang observed.
- Floating preview rendered complete long-note content and updated to the selected note. Its remaining issue was scroll position.
- Quiver changed between its large and small QA notes and reset split-preview scrolling on note change. Its search control did not expose a search panel during this session's attempts, so no new Quiver search-parity claim is made.
- Existing ordinary-search benchmark, 5,000 matching 11,426-byte notes, request for 50: **50 hydrated cells, 571,300 body bytes, 3 SQL reads**, median **11.23 ms** in SQLite/mapping.
- Ten repeated warmed resource loads: **0 queries, 0 transferred resource bytes**.
- Existing write/index stress probe retained **62 SQL calls and one final index write for 30 edits**; overlapping edits retained one FTS row/result.

No native frame-rate, precise end-to-end latency, process-tree memory, or cold-launch comparison was measured. Automation tool duration is not application latency. No content edits were needed in either app. The floating preview was closed after testing.

## Evidence and reproduction

New probes and raw results are in `qa/performance-round-6/`:

```sh
bun run qa/performance-round-6/large-search.ts
bun run qa/performance-round-6/resource-retention.ts
```

Both use synthetic in-memory databases and do not touch user libraries. Ordinary-search, cached-resource, and write checks reused the corresponding scripts from `qa/performance-round-5/`; their fresh outputs are retained in round 6.

Recommended next work: compact search excerpts first; then keyboard-result scrolling and preview scroll reset. Treat attachment eviction as a separate memory-management improvement with explicit active-resource protection.

## Fix implementation — October 4, 2026

- Added a compact search-summary query: SQL returns note identity/title and an FTS snippet capped at 1,024 characters. Global search no longer retrieves matching cell bodies. Full note loading occurs when the result is opened. Existing full-note search remains available to callers that need body content.
- Indexes now store visible rich-text content (entities decoded, tags/scripts removed), while preserving code angle brackets. Existing libraries upgrade in bounded batches with a completion marker; a failed upgrade can be retried, including against the same database path. Backup restoration also normalizes its search index.
- Keyboard result selection scrolls with nearest alignment, and results expose combobox/listbox/option selection semantics. Search disables autocorrection and automatic capitalization.
- Floating preview resets both scroll axes on note/library identity changes, using a layout effect. Edits within one note preserve scroll position.
- Added a 64 MiB attachment-cache budget, estimated conservatively as two bytes per data-URL character, with whole-note LRU eviction. Editor, preview rendering and export hold leases that protect their images. Oversized active notes may exceed the budget until released. Evicted notes reload on demand. Empty-note bookkeeping is also capped.

Measured with the same large-note fixture:

| Measurement | Before | After |
| --- | ---: | ---: |
| Matching bodies hydrated | 50 / 57,001,300 bytes | 0 / 0 bytes |
| Complete compact-summary response | Not applicable | 13,881 bytes |
| Excerpt formatting median | 201.59 ms | 0.27 ms |
| SQLite/search-service median | 18.37 ms | 116.87 ms |

Snippet generation moved to SQLite, increasing its work while removing large body transfers and synchronous full-body formatting from the UI. These are isolated measurements; they are not native input-to-paint figures. SQLite does not run this query in the editor's JavaScript thread.

The 30-attachment retention probe now retains 11 data URLs (30,758,486 characters), down from 30 (83,886,780 characters). Library switching still clears all of them. This is cache accounting, not process RSS.

Fresh automated run: 117 tests passed. The isolated regression script now additionally covers compact rich-text snippets, late matches, code punctuation, title matches, interrupted migration retry, cache-budget enforcement, active-image protection, evicted-note reload, and release of an oversized active note. TypeScript checks and `git diff --check` pass.

### Native verification after rebuilding

Rebuilt the optimized `Notch QA.app` with bundle identifier `com.notch.qa` and tested the **Notch Daily** library (27 notes).

- Global search for `QA`, followed by eleven Down presses, kept the selected **QA Release 0.3.1 — Larger Note** visibly highlighted in the scrolled results. Return opened the correct full note.
- Opened the floating preview of **QA Feature Pass 4 — 1000 lines**, scrolled to its end, minimized it, selected **QA Release 0.3.1 — Larger Note**, and restored it through Window → Floating Preview. The new note's heading and `sample0` appeared at the top. Closed the preview afterward.
- The existing library completed its search-index upgrade and opened normally. **QA Native Rich Text** still displayed its existing images, including after the subsequent comparison session.
- No Notch note content was edited. Large-cache eviction and failed-migration retry were exercised by isolated automated tests, not by injecting synthetic resources into the user's library.

The subsequent native Quiver comparison is recorded in [QA-QUIVER-ROUND-7.md](QA-QUIVER-ROUND-7.md). It found a separate in-note Find navigation defect; the global-search scrolling fix above does not address that distinct code path.

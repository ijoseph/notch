# Performance audit — round 5

Date: September 27, 2026. Source: `894ce197a602f43ef8ad0de707457bb5c61ed575`.

Fresh native sessions of the optimized **Notch QA.app** and **Quiver 3.2.7** were tested. Notch used **Notch Daily**, with edits restricted to existing synthetic QA notes. No application fixes were made during this audit.

## Findings

### 1. Floating preview repeats expensive rendering of unchanged cells

**Priority: high for large notes. Confirmed by an isolated measurement of production code.**

`previewWindows.ts` schedules a complete snapshot after 200 ms without edits. Each snapshot invokes `exportNoteToPrintHTML`, which highlights every code cell again. This work runs in the editor's JavaScript context. The snapshot sends the whole HTML string to the preview, which replaces its rendered HTML.

A production React/browser harness changed only one small Markdown cell while leaving all code cells unchanged. Three rounds of 30 edits, with an initial warm-up, produced:

| Fixture | Inline preview update median | Floating HTML generation median | Floating p95 | HTML per update |
| --- | ---: | ---: | ---: | ---: |
| 20 code cells × 40 lines | 0.2 ms | 9.2–10.3 ms | 10.5–11.0 ms | 188,415 bytes |
| 100 code cells × 40 lines | 0.2 ms | 44.5–45.5 ms | 47.4–50.9 ms | 941,695 bytes |

The large fixture's longest samples were 69–74 ms. These figures exclude IPC, resource queries, and repainting the separate preview window. Inline figures measure the synchronous React update, not full frame presentation. Browser engine was Chromium 152; these are **not native WebKit timings or a measured speed ratio against Quiver**.

Native verification also confirmed that a minimized floating preview continues receiving edits. Restoring it through Window → Floating Preview showed the new sentinel without explicitly regenerating the preview. Closing it clears its snapshot subscription state in the implementation.

Suggested fix: cache rendered cells by content/type/language, update only changed preview sections, and avoid background snapshot work while minimized unless needed for restoration.

### 2. Broad searches load every matching note body before applying a result limit

**Priority: high as libraries grow. Confirmed through the actual database/search services with synthetic SQLite data.**

`database.searchNotes` has no SQL limit and hydrates all matching cells. `services/search.ts` applies `limit` only afterward. The native search overlay requests no limit at all and renders every result, recomputing excerpts on each render.

Five warm runs per fixture; each note contained 11,426 ASCII bytes, one cell, and the common search term. The service was explicitly asked for only 50 results:

| Matching notes | Returned results | Hydrated cells | Body bytes read | SQL reads | Median SQLite + mapping time |
| --- | ---: | ---: | ---: | ---: | ---: |
| 100 | 50 | 100 | 1,142,600 | 3 | 0.80 ms |
| 1,000 | 50 | 1,000 | 11,426,000 | 5 | 8.29 ms |
| 5,000 | 50 | 5,000 | 57,130,000 | 21 | 37.43 ms |

The 5,000-note maximum was 42.43 ms. A no-match query used one read, no body hydration, and 0.03–0.04 ms median. The transport used Bun's in-memory SQLite in place of Tauri SQL; disk, native serialization, IPC, result rendering, and user-perceived latency are excluded. The body-byte counts directly establish the avoidable work.

The overlay also starts a search on every change, with no debounce or stale-response check. This is a source-confirmed risk of redundant work and stale results; stale results were **not reproduced in the small native library** in this round.

Suggested fix: apply filtering/limits in SQL, return compact search excerpts instead of full bodies, paginate/virtualize results, debounce requests, and discard responses for superseded queries.

### 3. Floating preview repeatedly retrieves attachments already in memory

**Priority: medium; potentially high for image-heavy notes. Confirmed with actual resource-loading code.**

`loadResourcesForNote` queries every resource before checking its cache. Floating preview invokes it for every snapshot. A warmed synthetic 2 MiB resource, loaded another ten times, caused **10 resource queries and 27,962,040 bytes of base64 data returned**. The resource bytes are synthetic; no image decoding or native IPC was timed.

Caching avoids rebuilding the data URL, but does not avoid reading/transferring the attachment. Full preview HTML can also contain inline image data.

Suggested fix: track which note resources are loaded and invalidate on mutations/library changes; avoid resending unchanged attachment data with every preview update.

## Fresh native checks

| Workflow | Notch | Quiver |
| --- | --- | --- |
| Quit and relaunch | Opened Notch Daily | Opened QA notebook |
| 1,000-line code fixture, side-by-side layout | Rendered successfully | Rendered successfully |
| Short edit beside code, followed by undo | Edit appeared; original text restored | Edit appeared; original text restored |
| Three small/large note-switch cycles | Completed, correct titles/content | Completed, correct selection/content |
| Long-note scrolling | Responded; synchronized preview moved when enabled | Responded in split layout |
| Global search for `performance` | Found matching QA fixture | Found matching QA fixture |
| Clear search after a no-match query | Cleared results correctly | Not repeated |
| Floating preview open/minimize/live update/restore/close | Completed; minimized preview had updated content | Not repeated |

No hang, missing typed text, or failed undo was observed in these sampled native workflows. Notch's scroll-sync option was returned to its original off state. All inserted test sentinels were undone; QA note modification timestamps changed. Original Daily Notes/Dev content was not edited.

These native checks are functional/qualitative. Automation round-trip duration was not used as application latency. There is **no defensible numerical native Notch-versus-Quiver speed ranking from this run**. Cold-launch latency, frame pacing, complete process-tree memory, and long-duration memory growth remain unmeasured.

## Checks that still pass

- Fresh `bun test`: **114 passed, 0 failed**, 221 assertions across 17 files.
- Thirty edits to a 64,669-byte note: **62 SQL calls**, one final full-text index write, **64,699 indexed bytes**. The index batching improvement remains effective.
- Thirty overlapping edits: **one index row and one matching search result**.
- Unchanged inline preview cells remain inexpensive in the isolated workload above.

## Reproduction artifacts

Scripts and raw results: [`qa/performance-round-5`](qa/performance-round-5).

From repository root:

```sh
bun run qa/performance-round-5/search-work.ts
bun run qa/performance-round-5/resource-work.ts
bun run qa/performance-round-5/write-work.ts
bun run qa/performance-round-5/serve.ts
```

The last command serves a local-only rendering harness at `http://127.0.0.1:1449`. Open it in a browser; it runs automatically and writes `render-results.json` beside the script. Wait until the page title reads “Round 5 complete.” The SQL probes create only in-memory synthetic databases. The resource probe counts retrieval bytes; its synthetic payload is not a valid image and is not decoded.

Recommended implementation order: bound search work, cache floating-preview cell rendering, then eliminate repeated attachment reads. Retest these exact workloads and measure native input-to-paint latency before claiming parity with Quiver.

## Fixes implemented and retested

September 27, 2026: implemented all three measured fixes.

- Search now applies notebook/trash filters, limits and offsets in SQL before body hydration. The overlay requests 51 results to display 50 and detect another page. It debounces queries by 150 ms, ignores superseded responses, and memoizes excerpts so keyboard/hover selection does not rescan bodies. Previous/Next keeps the whole result set accessible. The service defaults to 50 and caps individual requests at 100.
- Print rendering caches the current note's cells by their content, type, language, diagram type and resource version. Floating preview sends changed cells plus their order; the receiving window preserves unchanged cell DOM, including images. Initial windows and PDF previews still receive complete snapshots. Cached rendering is invalidated on resource changes and cleared when floating preview closes.
- Resource loading now shares in-flight requests and remembers completed loads, including empty notes. Creation invalidates the note's loaded status while preserving its existing immutable images; permanent deletion removes its cached images. Library switches and backup restoration clear cache state. Superseded in-flight reads cannot refill a new library's cache, and failed reads can be retried.

| Identical isolated workload | Before | After |
| --- | ---: | ---: |
| 4,000-line print HTML generation, median across three rounds | 44.5–45.5 ms | 1.5–1.9 ms |
| 4,000-line print HTML generation, p95 | 47.4–50.9 ms | 1.8–3.0 ms |
| Search 5,000 matches, requesting 50: hydrated bytes | 57,130,000 | 571,300 |
| Same search: median SQLite + mapping time | 37.43 ms | 9.71 ms |
| Same search: SQL reads | 21 | 3 |
| Ten warmed attachment reloads: queries / returned bytes | 10 / 27,962,040 | 0 / 0 |

The print benchmark still assembles the entire HTML string for the original comparison. The live preview additionally omits unchanged HTML/image data from subsequent messages. These remain isolated workload measurements, not native input-to-paint timings. Search still loads full bodies for the bounded page; a single very large result can therefore remain expensive. Floating preview continues to update while minimized, using the cheaper incremental path.

Validation:

- **117 tests passed**, including isolated real-SQLite regression checks for bounded search, stable pagination, filter ordering, resource invalidation, concurrent/empty/failed loads, stale loads across library changes, and cached print rendering through edits/undo/reorder. Preview-message tests cover unchanged images, deletions, structural undo and note switching.
- TypeScript check, whitespace checks and optimized macOS QA build passed.
- The actual search component was exercised in a browser with a synthetic transport: pages 1–3 contained results 1–50, 51–100 and 101–125; Next disabled on the last page. A 3-second stale response did not overwrite a later fast response or refill a cleared query.
- Rebuilt native Notch QA opened Notch Daily. Its 1,000-line floating preview showed a live edit and its undo, retained unchanged code, switched to the rich-text fixture with both images visible, and opened the native print dialog. The print dialog was canceled without printing. Native search found the large fixture and opened its full editor. The inserted test text was undone.

After measurements are in `qa/performance-round-5/*-results-after.json`. To rerun the browser comparison while retaining the baseline file:

```sh
RESULTS_FILE=render-results-after.json bun run qa/performance-round-5/serve.ts
```

`bun run qa/performance-round-5/search-ui-server.ts` serves the actual search component with synthetic results and controlled response delays on port 1450. `common` returns 125 results; `slow` delays for three seconds; other queries respond quickly. This harness never reads or modifies a library.

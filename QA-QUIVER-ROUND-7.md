# Quiver comparison, round 7 — October 4, 2026

Compared the installed **Quiver 3.2.7** at `/Applications/Quiver.app` with the rebuilt optimized **Notch QA.app**, using Notch's **Notch Daily** library and existing synthetic QA fixtures in both apps. This pass followed implementation and native verification of the four issues in [round 6](QA-PERFORMANCE-ROUND-6.md).

## Highest-priority remaining defect: in-note Find cannot reveal an offscreen code match

**Reproduced in both native apps, with screenshots inspected.**

1. In Quiver, open **QA Quiver Feature Pass 4**, which contains a 1,000-line code cell.
2. Invoke Edit → Find → Find Within Note (or Command-F), search `item999`, and press Return.
3. Quiver reports **1 of 1**, scrolls the editor to its end (AX scrollbar approximately 0.984), and visibly highlights `item999` on line 1000. The separate preview remains at its prior position when scrolling is not synchronized.
4. In Notch, open **QA Feature Pass 4 — 1000 lines**, invoke Command-F, enter `item999`, and press Return.
5. Notch reports **1 of 1**, but the editor remains around lines 489–514, with the match out of view. Another Return does not reveal it. The preview remains near its beginning.

Likely cause, confirmed by source inspection: `src/components/Search/FindBar.tsx` counts matches from all stored cell data but navigates by inserting and looking up spans in currently rendered `.editor-content` text nodes. Monaco does not render every line of a long code cell. The match count therefore refers to text for which no navigable DOM highlight exists.

Recommended fix: maintain match locations by cell and source offset, then reveal/decorate through the owning editor API. Use the same match sequence for the counter and navigation. Cover offscreen code, mixed cell types, wrapping Next/Previous, and matches split across rich-text formatting. This is separate from global search, which passed the round-6 native checks.

## Remaining feature gaps

| Gap | Quiver evidence | Current Notch equivalent | Validation depth |
| --- | --- | --- | --- |
| Editable independent note windows | Note → Open in New Window opened **QA Release Round 3** with editing and split preview. Appended ` WINDOW-PROBE` to `First cell`; both editor and preview updated. Command-Z restored the exact original text. | One main editor plus read-only floating/PDF preview windows. | Exercised edit, undo and close in Quiver; checked Notch window construction and menus. |
| Presentation mode | Present Note opened a clean full-window white presentation with a large centered note title and body. Escape returned to the main window. | Editor, preview, split view and ordinary fullscreen; no dedicated presentation command. | Exercised in Quiver; inspected Notch view/menu implementation. |
| Code-editor configuration | Preferences → Cells → Code Cell exposes theme, tab size, line numbers, invisibles, indent guides, key binding and soft tabs. | Code options are largely fixed in `src/components/Editor/cells/CodeCell.tsx`, including `vs-dark`, line numbers on and tab size 2; no corresponding settings panel. | Inspected the native Quiver preferences without modifying them; checked Notch source. |
| Additional copy/export formats | Note → Copy Note offers HTML source, Markdown, plain text and code only. Export Note additionally offers plain text and PNG. | Note-link and cell clipboard commands; Markdown/HTML/JSON and PDF export. No equivalent whole-note format clipboard commands or PNG/plain-text export choices. | Menus inspected. PNG export reached a native save panel, but file creation could not be verified; do not treat it as an end-to-end export pass. Clipboard formats were not pasted or otherwise validated. |

The first three feature gaps were identified in prior comparisons as well; this pass reconfirmed them against the current build and exercised editable windows and presentation directly. In-note Find is the new concrete defect from this pass.

## Scope and cleanup

- No new claim about relative input latency, frame rate, cold launch or process memory: native automation duration is not an app performance measurement.
- No Notch note content was edited. The temporary Quiver window edit was undone and verified in both its editor and preview; Quiver may still update that synthetic note's modified timestamp.
- Closed the extra note window, presentation, preferences and Find panels. No email actions were invoked and no preferences changed. Final Notch selection is **QA Native Rich Text**, with images visible.
- Native search checks, window workflows and preference/menu inspections are distinguished above from unverified export completion. The expected PNG was not found at the presumed temporary path after the save-panel attempts.
- Follow-up: the Find defect and feature gaps were subsequently implemented; see [the implementation and validation report](QA-FEATURE-IMPLEMENTATION-ROUND-7.md). The observations above describe the build before those fixes.

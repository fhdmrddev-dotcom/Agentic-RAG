---
phase: 087-panel-ui
plan: 03
subsystem: ui
tags: [react, typescript, vitest, panel, workspace, file-preview, csv, shiki, markdown, a11y, css-keyframe]

# Dependency graph
requires:
  - phase: 087-panel-ui (plan 01)
    provides: "getWorkspaceFileContent api fn + WorkspaceFileContent inline|bucket union + FilePreview/CsvTablePreview it.todo test skeletons + fixtures.ts (mockContentInline/Bucket, mockCsvValid/Malformed)"
  - phase: 086-streamsprovider-extension-panel-hooks
    provides: "useWorkspaceFiles + useViewingThread reactive hooks ({data,isLoading,error,reconcile}; data never undefined)"
provides:
  - "FilesSection — keyboard-operable workspace-file list (icon + mono name + formatBytes·v{n} meta) with fresh-write green flash + click/Enter full-replace drill-in"
  - "FilePreview — per-type drill-in router: inline md→MarkdownRenderer, code→ShikiCode, csv→CsvTablePreview, text→<pre>; bucket image→<img>; null-url/binary/too-large→calm fallback; ‹ Files back + Escape; AbortController cancels stale content fetches"
  - "CsvTablePreview — minimal in-panel <table> from a CSV string (quote-aware splitter, no new dependency); malformed/ragged→'No preview available · Download', ≥2000 rows or >256KB→'File too large to preview'; all cells React-escaped"
  - "index.css .animate-fileFlash keyframe (green 1.4s success-dim→transparent fade; prefers-reduced-motion guarded)"
affects: [087-02 panel-shell (mounts FilesSection in the Files section), 087-04 version-diff (Compare entry sits on the FilePreview header surface)]

# Tech tracking
tech-stack:
  added: []  # zero new dependencies (SC#3) — reused MarkdownRenderer, ShikiCode, lucide icons, formatBytes
  patterns:
    - "Per-type preview routing: classifyInline(mime, path) → {markdown|code|csv|text|fallback}; bucket branch checks image mime + non-null signed_url before <img>, else calm fallback"
    - "Content fetch keyed by (threadId, file.id) with AbortController teardown (mirrors Phase 086 reconcile-abort) — split FilePreviewContent from the static back-button header so the header stays mounted across file changes"
    - "Quote-aware CSV splitter (no diff/CSV lib): char-scan toggling inQuotes, '' escape, ragged-row + unterminated-quote + size-cap guards all return calm fallback, never throw"
    - "Roving-tabindex listbox: active row tabIndex=0, others -1; ArrowUp/Down move focus + activeIndex; Enter/Space open; focus restored to originating row on back via rowRefs Map + requestAnimationFrame"
    - "Fresh-write flash: prevVersions ref diff (new key OR bumped version) → flashKey for 1.4s → .animate-fileFlash"

key-files:
  created:
    - frontend/src/components/panel/CsvTablePreview.tsx
    - frontend/src/components/panel/FilePreview.tsx
    - frontend/src/components/panel/FilesSection.tsx
    - frontend/src/components/panel/__tests__/FilesSection.test.tsx
  modified:
    - frontend/src/components/panel/__tests__/CsvTablePreview.test.tsx
    - frontend/src/components/panel/__tests__/FilePreview.test.tsx
    - frontend/src/index.css

key-decisions:
  - "ShikiCode reused for code preview (A1) — the LIVE highlighter; the UI-SPEC's literal 'react-syntax-highlighter' mention is superseded per A1/Pitfall 2 (RSH is in package.json but not the active path). No new dep either way."
  - "CSV parsed with a hand-rolled quote-aware char-scanner (no PapaParse/CSV dep) per D-01; ragged rows, unterminated quotes, empty content, ≥2000 rows, and >256KB all short-circuit to the calm fallback before any DOM build (T-087-07 DoS guard)."
  - "fileFlash implemented as an index.css keyframe + .animate-fileFlash utility (success-dim 0.18 alpha → transparent over 1.4s) rather than a Tailwind config animation, mirroring the existing brandPulse/checkPop keyframe pattern; wrapped in prefers-reduced-motion:reduce → animation:none."
  - "FilePreview split into a static header (back button, never re-fetches) + FilePreviewContent (fetch keyed by threadId+file.id) so AbortController teardown on file change is clean (T-087-06 cross-thread/stale-fetch guard)."

requirements-completed: [PANEL-03]

# Metrics
duration: 6min
completed: 2026-05-29
---

# Phase 087 Plan 03: File Browser + Preview Drill-in Summary

**The panel's file browser: `FilesSection` lists thread workspace files (icon + mono name + size·version meta, green flash on fresh write) and full-replaces into `FilePreview` — a per-type router that reuses MarkdownRenderer for md, ShikiCode for code, the new dependency-free `CsvTablePreview` `<table>` for csv, framed `<img>` for bucket images, and a calm "No preview available · Download" / "File too large to preview" fallback for null-url / binary / malformed / too-large content. All raw content is React-escaped or routed through sanitizing renderers — zero raw-HTML injection.**

## Performance

- **Duration:** ~6 min
- **Completed:** 2026-05-29
- **Tasks:** 3
- **Files:** 7 (4 created, 3 modified)

## Accomplishments
- **CsvTablePreview** (D-01, the one component with no analog): a quote-aware CSV splitter renders `<thead>`/`<tbody>` from the CSV string with no new dependency. Quoted commas stay one cell; `""` escapes resolve to `"`. Malformed/ragged/empty → "No preview available · Download"; ≥2000 rows or >256KB → "File too large to preview" (short-circuits before DOM build). Every cell is a React text child — an `<img onerror>` payload renders as literal text.
- **FilePreview** (D-02): fetches `getWorkspaceFileContent(threadId, file.id, signal)` on mount with AbortController teardown, then routes by `storage_type` + mime/ext. inline md→MarkdownRenderer, code→ShikiCode (`langFromPath` maps py→python, ts/tsx→typescript, json→json, …), csv→CsvTablePreview, plain text→`<pre>`; bucket image + non-null signed_url→`<img>`; null-url / binary / too-large→calm fallback. `‹ Files` back button + Escape both return to the list; focus lands on the back button on mount.
- **FilesSection** (PANEL-03): consumes `useWorkspaceFiles` + `useViewingThread` (no refresh). Rows render a lucide type icon + mono filename + `formatBytes(size) · v{version}`. Fresh-write rows get the green `.animate-fileFlash`. Full a11y: `role=listbox`/`option`, roving tabindex, Arrow nav, Enter/Space open — no mouse-only path. Click/Enter full-replaces the list with `<FilePreview>`; back restores focus to the originating row.
- Flipped both Wave 0 `it.todo` skeletons to live GREEN tests (CsvTablePreview 6, FilePreview 10) and added FilesSection.test.tsx (5). Panel suite: 21 live tests pass + 39 remaining todos from other waves; `tsc --noEmit` clean.

## Task Commits

1. **Task 1: CsvTablePreview** — `f57f096b` (feat)
2. **Task 2: FilePreview** — `db09b0d3` (feat)
3. **Task 3: FilesSection + fileFlash keyframe** — `61e86ce0` (feat)

## Decisions Made
- **ShikiCode over react-syntax-highlighter (A1):** reused the live in-repo highlighter (`tool-bodies/ShikiCode.tsx`, Phase 075.8) for code-file parity with chat code blocks. The UI-SPEC's literal "react-syntax-highlighter" is superseded per A1/Pitfall 2; RSH stays unused. No new dependency either way.
- **Hand-rolled CSV parser (D-01):** a char-scanning quote-aware splitter — no PapaParse/CSV library — with ragged-row, unterminated-quote, empty, ≥2000-row, and >256KB guards that all return the calm fallback before building any DOM (T-087-07).
- **fileFlash as a CSS keyframe:** added `@keyframes fileFlash` + `.animate-fileFlash` to index.css mirroring the existing `brandPulse`/`checkPop` pattern, with a `prefers-reduced-motion:reduce → animation:none` block (UI-SPEC A11Y) — no Tailwind config change needed.
- **FilePreview header/body split:** the `‹ Files` header never re-fetches; `FilePreviewContent` owns the fetch keyed by `(threadId, file.id)` so the AbortController cleanly cancels stale content fetches on file/thread change (T-087-06).

## Deviations from Plan

### Auto-fixed / additive (within plan latitude)

**1. [Rule 2 - Missing critical] Added `@keyframes fileFlash` + `.animate-fileFlash` to index.css**
- **Found during:** Task 3
- **Issue:** Task 3 requires the green fresh-write flash (`fileFlash` 1.4s, file-browser-and-diff.md:41), but no `fileFlash` keyframe existed in `index.css` (Plan 01 added the `--warning`/dim tokens, not this animation).
- **Fix:** Added the keyframe + utility class following the established `brandPulse`/`checkPop` pattern, plus a `prefers-reduced-motion:reduce` guard (UI-SPEC A11Y requirement for the flash).
- **Files modified:** `frontend/src/index.css`
- **Verification:** `tsc --noEmit` clean; FilesSection applies `animate-fileFlash` on the fresh-write key; reduced-motion block disables it.
- **Commit:** `61e86ce0`

**2. [Additive] Added FilesSection.test.tsx (not in the Wave 0 scaffold set)**
- **Found during:** Task 3
- **Issue:** Wave 0 (Plan 01) created `it.todo` skeletons for CsvTablePreview + FilePreview but not FilesSection; the plan's Task 3 verify runs the whole `src/components/panel/` dir.
- **Fix:** Added a live test file (5 tests: rows render, size·version meta, mouse + keyboard drill-in, back-to-list) mocking the two Phase 086 hooks + FilePreview. Pure addition — no existing test changed.
- **Files modified:** `frontend/src/components/panel/__tests__/FilesSection.test.tsx` (new)
- **Verification:** panel suite GREEN (21 live).
- **Commit:** `61e86ce0`

**Total deviations:** 2 (1 Rule-2 missing-critical CSS keyframe, 1 additive test). **Impact:** none negative — both are additive; no existing behavior changed, zero new dependency.

## Issues Encountered
None. `tsc --noEmit` clean after every task; panel suite GREEN. One self-correction during authoring: an early `useMemo` sat after a conditional `return` in FilesSection (rules-of-hooks violation) — removed before the first test run (`files` is already a stable Phase-086 ref, so the memo was unnecessary). A leftover dead `PreviewBody` draft in FilePreview was deleted before commit.

## Threat Surface
No new threat surface beyond the plan's `<threat_model>`. All four registered threats are mitigated:
- **T-087-04 (XSS via file content):** md→MarkdownRenderer (DOMPurify), code→ShikiCode (HTML-escapes; passed RAW text), csv/text→React text children / `<pre>`. `grep -c dangerouslySetInnerHTML` = 0 in both CsvTablePreview.tsx and FilePreview.tsx (verified). XSS-payload CSV test confirms literal-text render.
- **T-087-05 (signed-url leak / broken render):** `signed_url===null` routes to the calm fallback (no broken `<img>`, no leak); the url is never persisted client-side.
- **T-087-06 (cross-thread file bleed):** content fetch keyed by `useViewingThread()` threadId + AbortController cancels stale fetches on file/thread change.
- **T-087-07 (huge CSV DoS):** >256KB / ≥2000-row caps short-circuit to the fallback before any DOM build.

## Known Stubs
None. FilesSection renders live `useWorkspaceFiles` data; FilePreview fetches real content via `getWorkspaceFileContent`. The remaining `it.todo` placeholders in the panel `__tests__` dir belong to Plans 02/04/05 (WorkspacePanel, VersionDiff, PendingAskCard, Seam, TodosSection), not PANEL-03.

## Next Phase Readiness
- **087-02 (panel shell):** mounts `<FilesSection />` inside its Files accordion section (default-or-named export both available).
- **087-04 (version diff):** the `Compare` entry will sit on the FilePreview header surface; `VersionDiff` reuses `getWorkspaceFileVersions`/`getWorkspaceFileDiff` (Plan 01) — independent of this plan's components.
- No blockers. `tsc --noEmit` clean; panel suite GREEN (21 live / 39 cross-wave todo / 0 fail).

## Self-Check: PASSED

All 4 created files verified present on disk; all 3 task commit hashes verified in git log (`f57f096b`, `db09b0d3`, `61e86ce0`). Acceptance-criteria greps re-run: `<table` present, ShikiCode present, react-syntax-highlighter=0, dangerouslySetInnerHTML=0 (both components), role=listbox/option present, `tsc --noEmit` exit 0, panel suite GREEN.

---
*Phase: 087-panel-ui*
*Completed: 2026-05-29*

---
phase: 087-panel-ui
plan: 04
subsystem: ui
tags: [react, typescript, vitest, radix-dialog, tailwind, panel, workspace, diff, version-compare, unified-diff]

# Dependency graph
requires:
  - phase: 087-panel-ui (Plan 01 / Wave 0)
    provides: "getWorkspaceFileVersions/getWorkspaceFileDiff api.ts fns + WorkspaceVersion/WorkspaceDiff wire types + --warning/--muted-foreground-dim tokens + VersionDiff.test.tsx it.todo skeleton + fixtures (mockVersions, mockDiffString, mockDiffNonTruncated, mockDiffTruncated)"
provides:
  - "parseUnifiedDiff(diff: string): DiffLine[] — pure, React/fetch-free unified-diff string parser (frontend/src/lib/diffParse.ts) classifying hunk/add/del/context/header"
  - "DiffLine type (kind + text + optional sign) — the parsed-line contract shared by VersionDiff + DiffExpandOverlay"
  - "DiffLines — shared presentational in-column +/- diff renderer (fixed 16px sign gutter, scroll-x never-wrap, truncation notice)"
  - "DiffExpandOverlay — opt-in wide diff in a shadcn Radix dialog (focus-trap/Escape/restore free), shows the SAME parsed payload, no second fetch"
  - "VersionDiff — version-pills (red-base/green-target, text+aria) + default Compare v{n-1}<->v{n} + in-column diff + +N/-M summary + truncation + expand"
affects: [087-02 panel-shell, FilesSection (mounts VersionDiff as the Versions section body), 088 a11y gate]

# Tech tracking
tech-stack:
  added: []  # zero new dependencies — Radix Dialog reused via existing shadcn ui/dialog.tsx; no diff library (SC#3)
  patterns:
    - "Client-side unified-diff parse (Pattern 2): split delta.diff on \\n, classify by prefix — no diff lib; backend already emits the ready difflib string"
    - "Parse-once / render-twice: parseUnifiedDiff result memoized in VersionDiff and passed to BOTH the in-column DiffLines and the ⤢ overlay — the overlay never re-fetches/re-parses (D4)"
    - "Shared presentational sub-component (DiffLines) so the in-column and wide-overlay diffs are byte-identical render paths"
    - "AbortController keyed on (threadId, fileId, pair) for both versions + diff fetches — stale cancellation, no cross-thread bleed (T-087-09)"
    - "Two-click version endpoint pick: lo=base(red), hi=target(green); default = latest two from the DESC versions list"

key-files:
  created:
    - frontend/src/lib/diffParse.ts
    - frontend/src/components/panel/DiffLines.tsx
    - frontend/src/components/panel/DiffExpandOverlay.tsx
    - frontend/src/components/panel/VersionDiff.tsx
  modified:
    - frontend/src/components/panel/__tests__/VersionDiff.test.tsx

key-decisions:
  - "Extracted a shared DiffLines presentational component (not in the plan's file list) so VersionDiff + DiffExpandOverlay render the identical diff markup — the plan explicitly allowed 'extract a shared <DiffLines> sub-component, or co-locate and import it'"
  - "Unicode minus (U+2212 '−') for deletion signs per UI-SPEC, not ASCII hyphen; parser emits sign:'−' and DiffLines renders it in the fixed 16px gutter"
  - "Default comparison = latest two versions (vs[1].version -> vs[0].version since the list is DESC); base is the lower version (red), target the higher (green)"
  - "parseUnifiedDiff drops a single trailing empty segment from a trailing newline so difflib's '\\n'-terminated output doesn't render a spurious blank context row"
  - "⤢ expand button aria-label='Expand diff to a wide view' (test matches /expand diff/i); disabled when there are no parsed lines"

requirements-completed: [PANEL-07]

# Metrics
duration: ~4min
completed: 2026-05-29
---

# Phase 087 Plan 04: Version Diff Viewer Summary

**The PANEL-07 version-diff viewer: a pure client-side `parseUnifiedDiff` (no diff lib), a shared in-column `DiffLines` renderer (fixed 16px sign gutter, honest truncation notice), an opt-in `DiffExpandOverlay` in the existing Radix dialog (same payload, no second fetch), and `VersionDiff` with red-base/green-target accessible pills defaulting to Compare v{n-1}↔v{n} — 14 live tests GREEN (7 parser + 7 component).**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-29T01:21:22Z
- **Completed:** 2026-05-29
- **Tasks:** 3 (Task 1 TDD, Task 2, Task 3 TDD)
- **Files:** 5 (4 created, 1 modified)

## Accomplishments

- **Task 1 — `parseUnifiedDiff` (pure, TDD):** `frontend/src/lib/diffParse.ts` exports `DiffLine` + a React/fetch-free `parseUnifiedDiff(diff)` that splits on `\n` and classifies each line: `@@`→hunk, `--- `/`+++ `→header, `+`(not `+++`)→add (sign `+`), `-`(not `---`)→del (Unicode minus `−`), else→context (one leading space stripped). Empty string → `[]`. RED confirmed before writing (import-resolution failure), GREEN after.
- **Task 2 — `DiffExpandOverlay` + shared `DiffLines`:** `DiffLines.tsx` is the shared presentational renderer (16px sign gutter, `overflow-x-auto` never-wrap, hunk=primary / add=green / del=red / context=dim, the "diff truncated at 500 lines" notice). `DiffExpandOverlay.tsx` reuses the repo's shadcn `Dialog` (Radix → focus-trap + Escape + restore free), renders the SAME passed-in `DiffLine[]` (no second fetch), `role="region" aria-label`. The panel never auto-widens — this overlay is the only wide affordance.
- **Task 3 — `VersionDiff` (TDD):** loads the version list, defaults to the latest two (`Compare v{n-1}↔v{n}`), fetches + parses `delta.diff` client-side, renders the in-column diff via `DiffLines`, a `+N/−M` summary from `delta.stats`, the truncation notice, and a `⤢` button opening the overlay with the same parsed lines. Red-base/green-target pills carry `aria-label="base version N"` / `"target version N"` (not color-only). AbortController aborts stale fetches on version/file/thread change.

## Task Commits

1. **Task 1: parseUnifiedDiff parser + flip parser tests** — `82032543` (feat)
2. **Task 2: DiffExpandOverlay + shared DiffLines** — `721f0efd` (feat)
3. **Task 3: VersionDiff (pills + in-column diff + truncation + ⤢)** — `536e6ae7` (feat)

## Files Created/Modified

- `frontend/src/lib/diffParse.ts` — NEW pure parser: `DiffLine` type + `parseUnifiedDiff`.
- `frontend/src/components/panel/DiffLines.tsx` — NEW shared in-column diff renderer + truncation notice.
- `frontend/src/components/panel/DiffExpandOverlay.tsx` — NEW opt-in wide diff dialog (Radix reuse).
- `frontend/src/components/panel/VersionDiff.tsx` — NEW version pills + in-column diff + summary + ⤢ + abort.
- `frontend/src/components/panel/__tests__/VersionDiff.test.tsx` — MODIFIED: 11 `it.todo` skeleton flipped to 14 live tests (7 pure-parser + 7 component).

## Decisions Made

- **Shared `DiffLines` extraction:** the plan permitted extracting a shared `<DiffLines>` sub-component; doing so guarantees the in-column diff and the ⤢ overlay are pixel-identical render paths and that the overlay genuinely consumes the same parsed payload. Added beyond the plan's 4 named files but explicitly sanctioned by Task 2's action text.
- **Unicode minus (`−`, U+2212)** for deletion signs per UI-SPEC (not ASCII hyphen). The parser emits it and the gutter renders it.
- **Default = latest two:** versions arrive DESC, so `from = vs[1].version` (base/red), `to = vs[0].version` (target/green). Two-click endpoint picking sets `lo→base`, `hi→target`.
- **Trailing-newline handling:** a single trailing empty segment from difflib's `\n`-terminated string is dropped so no spurious blank context row renders.

## Deviations from Plan

**1. [Rule 3 — Blocking issue] Extracted a shared `DiffLines.tsx` (5th file, not in `files_modified`)**
- **Found during:** Task 2.
- **Issue:** The plan's `files_modified` lists 4 files, but Task 2's action explicitly says to "extract a shared `<DiffLines lines truncated/>` presentational sub-component, or co-locate and import it" so VersionDiff and the overlay share one renderer. Co-locating would have duplicated ~70 lines across two files.
- **Fix:** Created `frontend/src/components/panel/DiffLines.tsx` as the single shared renderer; both `VersionDiff` and `DiffExpandOverlay` import it. This satisfies the must-have "the ⤢ overlay shows the SAME payload" structurally.
- **Files modified:** `frontend/src/components/panel/DiffLines.tsx` (new).
- **Commit:** `721f0efd`.

## Issues Encountered

- Task 1's plan verify command (`vitest -t "parse"`) cannot run in isolation because the single shared `VersionDiff.test.tsx` imports `../VersionDiff` at the top level, so the file fails to collect until the component exists (Task 3). Resolution: the parser was typecheck-verified at Task 1 commit time (`tsc --noEmit` clean for `diffParse.ts`), and the full suite (parser + component) ran GREEN after Task 3 — 14/14. This is an artifact of Wave 0 placing all PANEL-07 contracts in one test file, not a defect.

## Threat Surface

No new threat surface beyond the plan's `<threat_model>`. T-087-08 (XSS via diff content) mitigated: every diff line is a React text child (`{line.text}`) inside styled spans — grep-verified **zero** `dangerouslySetInnerHTML` across `VersionDiff.tsx`, `DiffExpandOverlay.tsx`, `DiffLines.tsx` (the only matches are negative-assertion doc comments). T-087-09 (cross-thread diff bleed) mitigated: both fetches keyed by `threadId` + AbortController cancels stale fetches on version/file/thread change. T-087-10 (huge-diff DoS) accepted: backend truncates at 500 lines; the client renders a bounded payload and surfaces the cap.

## Known Stubs

None. `VersionDiff` is wired to the live `getWorkspaceFileVersions`/`getWorkspaceFileDiff` client fns; no hardcoded/mock data in app code. It awaits mounting as the Versions section body by `FilesSection`/`WorkspacePanel` (Plans 02/03 surface) — a wiring step owned by the panel-shell plan, not a stub.

## User Setup Required

None — frontend-only, zero new dependencies, no env/config.

## Verification

- `node node_modules/typescript/bin/tsc --noEmit` — clean (full project, exit 0).
- `npx vitest run src/components/panel/__tests__/VersionDiff.test.tsx` — **14 passed** (7 parser + 7 component).
- `npx vitest run src/components/panel/` — **35 passed, 28 todo, 0 fail** (no regression; the 28 todo are other Wave 0 contracts for plans not yet executed).
- grep: zero real `dangerouslySetInnerHTML`, zero `getWorkspaceFileDiff`/`fetch` in `DiffExpandOverlay` (comment-only mentions), zero `react`/`fetch` code in `diffParse.ts`.

## Next Phase Readiness

- **087-02 / 087-03 (panel shell + file browser):** mount `<VersionDiff threadId={...} file={...} />` as the Versions section body (FilesSection already drills into FilePreview; add a Compare affordance that swaps to VersionDiff for the selected file).
- No blockers. Full project `tsc --noEmit` clean; panel suite GREEN.
- **Carry-forward (UAT, Phase verification):** exercise live diff against a real multi-version file (truncated + non-truncated), confirm the ⤢ overlay focus-trap + Escape + restore via Chrome MCP, and confirm pills read correctly with a screen reader (text+aria, not color-only). Cross-provider not applicable (diff payload is provider-agnostic backend output).

## Self-Check: PASSED

All 5 files verified present; all 3 task commit hashes verified in git log (`82032543`, `721f0efd`, `536e6ae7`).

---
*Phase: 087-panel-ui*
*Completed: 2026-05-29*

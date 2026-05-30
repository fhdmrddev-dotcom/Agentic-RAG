---
phase: 087-panel-ui
plan: 01
subsystem: ui
tags: [react, typescript, vitest, radix-dialog, tailwind, panel, workspace, ask_user, diff, css-tokens]

# Dependency graph
requires:
  - phase: 086-streamsprovider-extension-panel-hooks
    provides: "4 reactive panel hooks (useTodos/useWorkspaceFiles/useAskUserPrompt/useViewingThread) + Todo/WorkspaceFile/PendingAsk wire types + SSE demux into 4 Zustand Maps"
provides:
  - "4 typed api.ts client fns: getWorkspaceFileContent, getWorkspaceFileVersions, getWorkspaceFileDiff (GET), answerAskUser (POST /runs/{id}/ask_user_response)"
  - "Wire-mirror types: WorkspaceFileContent (inline|bucket union), WorkspaceVersion, WorkspaceDiff (raw unified-diff string shape), AskUserAnswerBody"
  - "CSS design tokens in index.css :.dark — --warning, --warning-foreground (amber needs-you, ≥4.5:1 ink), --muted-foreground-dim"
  - "Sheet bottom-sheet primitive (frontend/src/components/ui/sheet.tsx) on @radix-ui/react-dialog — zero new npm dependency"
  - "Wave 0 test scaffolding: shared fixtures.ts + 7 panel test files (52 it.todo assertion contracts) — Nyquist Dimension 8 satisfied"
affects: [087-02 panel-shell, 087-03 file-preview, 087-04 version-diff, 087-05 pending-ask, seam-renderers]

# Tech tracking
tech-stack:
  added: []  # zero new dependencies — Sheet hand-authored on installed Radix Dialog (A3)
  patterns:
    - "Workspace GET helper = getThreadTodos shape verbatim (getAuthHeaders + fetch + optional AbortSignal + non-OK throw)"
    - "POST helper = method POST + JSON.stringify body + non-OK throw with status in message"
    - "Wire-mirror types are snake_case byte-for-byte; storage_type discriminated union routes FilePreview"
    - "Wave 0 GREEN-only test contract: it.todo() assertion strings per VALIDATION per-req map; downstream plan flips its own todos to live tests when the component lands"

key-files:
  created:
    - frontend/src/components/ui/sheet.tsx
    - frontend/src/components/panel/__tests__/fixtures.ts
    - frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx
    - frontend/src/components/panel/__tests__/TodosSection.test.tsx
    - frontend/src/components/panel/__tests__/FilePreview.test.tsx
    - frontend/src/components/panel/__tests__/CsvTablePreview.test.tsx
    - frontend/src/components/panel/__tests__/PendingAskCard.test.tsx
    - frontend/src/components/panel/__tests__/VersionDiff.test.tsx
    - frontend/src/components/panel/__tests__/Seam.test.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/types/index.ts
    - frontend/src/index.css

key-decisions:
  - "Sheet hand-authored on installed @radix-ui/react-dialog (side=bottom variant) — NOT npx shadcn add sheet (avoids vaul, A3)"
  - "--warning-foreground darkened (240 60% 8% deep-midnight ink) rather than text lightened, to hit ≥4.5:1 on the amber background per UI-SPEC Color section"
  - "WorkspaceFileContent modeled as a discriminated union over storage_type so FilePreview routing (Plan 03) is type-safe"
  - "Wave 0 tests are GREEN-only it.todo placeholders (52) — components do not exist yet; suite must not regress past the known 086 baseline"

patterns-established:
  - "Pattern: new workspace api fns mirror the Phase 086 GET helper shape exactly (no new fetch library, optional AbortSignal everywhere)"
  - "Pattern: panel test fixtures live in one shared fixtures.ts; mockPendingAskWithRunId vs mockPendingAskNoRunId encode the A2/Pitfall-1 run_id contract"
  - "Pattern: makeHookReturn() factory returns the {data,isLoading,error,reconcile} 086 hook contract so downstream plans mock hooks without re-deriving the shape"

requirements-completed: [PANEL-01, PANEL-03, PANEL-04, PANEL-07]

# Metrics
duration: 3min
completed: 2026-05-29
---

# Phase 087 Plan 01: Wave 0 Panel Foundation Summary

**The shared 087 foundation: 4 typed workspace api.ts client fns (content/versions/diff/answer), amber `--warning` + dim-text CSS tokens, a zero-dependency Radix-Dialog bottom-sheet primitive, and 7 GREEN-only panel test files (52 it.todo contracts) so every downstream wave builds against fixed signatures.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-29T05:03:40+04:00
- **Completed:** 2026-05-29T05:06:36+04:00
- **Tasks:** 3
- **Files modified:** 12 (3 modified, 9 created)

## Accomplishments
- 4 typed client fns added to `api.ts` mirroring the established `getAuthHeaders + fetch + non-OK throw` pattern; `answerAskUser` POSTs to `/runs/{runId}/ask_user_response`.
- 5 wire-mirror types added (`WorkspaceFileContent` inline|bucket union, `WorkspaceVersion`, `WorkspaceDiff`, `AskUserAnswerBody`) — all snake_case byte-for-byte against the backend.
- Amber `--warning`/`--warning-foreground` + `--muted-foreground-dim` tokens added to `index.css :.dark`, following the existing `--success` channel-var convention.
- `Sheet` bottom-sheet primitive hand-authored on the already-installed Radix Dialog — focus-trap/Escape/restore for free, `.sheet-grip` dismiss handle, max-h-70vh so it never occludes the composer. **No new npm dependency.**
- 7 panel test files + shared `fixtures.ts` establish the Wave 0 contract (52 `it.todo` assertions mapped to the VALIDATION per-req map); panel suite runs GREEN (7 files / 52 todo / 0 fail).

## Task Commits

1. **Task 1: design tokens + 4 api.ts fns + wire types** — `03861bad` (feat)
2. **Task 2: hand-author Sheet bottom-sheet primitive** — `d0ee86b2` (feat)
3. **Task 3: Wave 0 fixtures + 7 panel test files** — `12cf738a` (test)

## Files Created/Modified
- `frontend/src/lib/api.ts` — +4 client fns (getWorkspaceFileContent/Versions/Diff, answerAskUser) + type import.
- `frontend/src/types/index.ts` — +5 wire-mirror interfaces for content/versions/diff/answer.
- `frontend/src/index.css` — +3 tokens in `.dark` (`--warning`, `--warning-foreground`, `--muted-foreground-dim`).
- `frontend/src/components/ui/sheet.tsx` — NEW bottom-sheet primitive on Radix Dialog.
- `frontend/src/components/panel/__tests__/fixtures.ts` — NEW shared mock payloads + hook-return factory.
- `frontend/src/components/panel/__tests__/{WorkspacePanel,TodosSection,FilePreview,CsvTablePreview,PendingAskCard,VersionDiff,Seam}.test.tsx` — NEW 7 GREEN-only contract files.

## Decisions Made
- Sheet hand-authored (Radix Dialog `side="bottom"`) rather than `npx shadcn add sheet`, which can pull `vaul` — keeps the zero-new-dep constraint (Research A3).
- `--warning-foreground` set to deep-midnight ink (`240 60% 8%`) — darkening the foreground hits ≥4.5:1 on the amber background without lightening the amber, per UI-SPEC Color guidance.
- `WorkspaceFileContent` is a discriminated union over `storage_type` (`inline` | `bucket`) so Plan 03's per-type preview routing is type-checked, not stringly-typed.
- Wave 0 tests use `it.todo()` (not `.skip`/`describe.todo`) so each appears as an explicit unfilled contract in the Vitest report; `void <fixture>` statements anchor the imports without asserting against unbuilt components (keeps the suite GREEN, no baseline regression).

## Deviations from Plan

None - plan executed exactly as written.

The plan offered `it.skip` OR `it.todo`; `it.todo` was chosen (both are GREEN; `it.todo` reports as an explicit pending contract, which better serves downstream plans). This is within the plan's stated latitude, not a deviation.

## Issues Encountered
None. `tsc --noEmit` clean after every task; panel suite GREEN on first run.

## Threat Surface
No new threat surface beyond the plan's `<threat_model>`. The 4 new fetches all call `getAuthHeaders()` (bearer token); endpoints enforce `_verify_thread_ownership` server-side (T-087-01 mitigated). `answerAskUser` sends free-text as JSON, rendered as text downstream — no `dangerouslySetInnerHTML` introduced (T-087-02 accept). `sheet.tsx` is purely presentational (T-087-03 accept).

## Known Stubs
None that block the plan goal. The 7 test files contain `it.todo()` placeholders by design — they are the Wave 0 contract for components built in Plans 02–05, not stubbed app behavior. No app component renders empty/mock data.

## User Setup Required
None - no external service configuration required. Zero new dependencies; nothing to install.

## Next Phase Readiness
- **087-02 (panel shell):** consumes `Sheet` (<768px), the 4 hooks, and the `WorkspacePanel.test.tsx` contract.
- **087-03 (file preview):** consumes `getWorkspaceFileContent` + `WorkspaceFileContent` union + `FilePreview`/`CsvTablePreview` contracts.
- **087-04 (version diff):** consumes `getWorkspaceFileDiff`/`getWorkspaceFileVersions` + `WorkspaceDiff` + `VersionDiff` contract.
- **087-05 (pending ask):** consumes `answerAskUser` + `AskUserAnswerBody` + the `mockPendingAskNoRunId` A2 gate contract.
- No blockers. Full-frontend `tsc --noEmit` is clean; panel suite GREEN.

## Self-Check: PASSED

All 9 created files verified present; all 3 task commit hashes verified in git log (`03861bad`, `d0ee86b2`, `12cf738a`).

---
*Phase: 087-panel-ui*
*Completed: 2026-05-29*

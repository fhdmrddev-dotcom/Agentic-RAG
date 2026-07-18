---
phase: 138-run-end-honesty-stretch
plan: 04
subsystem: ui
tags: [react, zustand, sse, streams-provider, todos-panel, run-honesty, reconcile]

# Dependency graph
requires:
  - phase: 138-run-end-honesty-stretch (plan 02)
    provides: "backend run-end finalizer that commits the '(run ended — not completed)' marker to the todos table BEFORE the clean terminal sentinel (DB-verified)"
  - phase: 086 (PANEL-05)
    provides: "getThreadTodos GET helper + the thread-switch usePanelReconcile pattern this fix mirrors at run-terminal"
provides:
  - "_reconcileTodosOnTerminal(threadId, kind) — exported fetch-on-clean-terminal helper that reconciles the Workspace TODOS panel LIVE at run-end"
  - "two fire-and-forget call sites (reconcile-path + sendMessage-path onTerminal) that surface the run-end marker with no thread-switch/refresh"
affects: [138-05, run-honesty, streams-provider, todos-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fetch-on-clean-terminal panel reconcile (D-v2.5-03): the GET is the source of truth, re-fetch always on a clean terminal rather than trusting the best-effort todo_updated SSE"
    - "export-for-tests module-level helper beside _isTransientStreamEnd / _reattachAfterTransient (unit-drivable without the full SSE-replay path)"

key-files:
  created: []
  modified:
    - "frontend/src/providers/StreamsProvider.tsx — added _reconcileTodosOnTerminal helper + two fire-and-forget call sites"
    - "frontend/src/providers/StreamsProvider.test.tsx — 5 new Vitest cases locking the helper contract"

key-decisions:
  - "Clean-completion gate lives INSIDE the helper (both call sites pass kind unconditionally) — mirrors the 138-02 two-clause backend finalizer gate and prevents copy-paste drift on the G-5 hot file"
  - "ALWAYS re-fetch on a clean terminal (never gated on a non-empty local store or whether the SSE landed) — CLAUDE.md D-v2.5-03: Realtime is a best-effort hint, the GET is the source of truth"
  - "No AbortController: the write is thread-keyed by the captured owning threadId, so a post-thread-switch resolve updates its OWN slot (Pitfall 6), matching the onRunCompleted workspace-refetch analog"

patterns-established:
  - "Pattern 1: fire-and-forget best-effort panel reconcile on the TRUE-terminal path (post transient-reattach return), never awaited so it cannot block or reorder terminal teardown"
  - "Pattern 2: reuse-only run-honesty surfacing — the marker rides on todo.content (D-01), so no new fetch machinery, route, component, or package; TodosSection untouched"

requirements-completed: [RUN-01]

# Metrics
duration: 5min
completed: 2026-07-06
---

# Phase 138 Plan 04: RUN-01 Live-Surfacing (Todos Terminal Reconcile) Summary

**On a genuinely-clean Deep run terminal, the Workspace TODOS panel now reconciles LIVE via a fetch-on-terminal so the backend-committed `(run ended — not completed)` marker appears at run-end with no thread-switch and no refresh.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-06T08:56:39Z
- **Completed:** 2026-07-06T09:01:10Z
- **Tasks:** 2 (Task 1 TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Closed the ONE live-surfacing gap from Phase 138's live UAT (Scenario B / VERIFICATION.md must-have #5): the 138-02 marker was committed to the DB but never surfaced live in the panel — it now reconciles on the run terminal.
- Added `_reconcileTodosOnTerminal(threadId, kind)` — a tiny exported, best-effort, clean-completion-gated helper that reuses the existing `getThreadTodos` GET + `replaceTodosForThread` store action (zero new fetch machinery, route, component, or package).
- Wired the shared helper into BOTH onTerminal handlers (reconcile-path + sendMessage-path) as fire-and-forget calls on the true-terminal path — additive-only (13 insertions, 0 deletions) on the G-5 hot file.
- Locked the contract with 5 focused Vitest cases (done/reader_done → fetch+replace; cancelled/error → no-op; rejected fetch → never throws).

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing cases for _reconcileTodosOnTerminal** - `e84035bb` (test)
2. **Task 1 (GREEN): _reconcileTodosOnTerminal helper** - `1defa46d` (feat)
3. **Task 2: wire helper into both onTerminal handlers** - `6968f87f` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

_Note: Task 1 is TDD (tdd="true") — RED test commit then GREEN feat commit._

## Files Created/Modified
- `frontend/src/providers/StreamsProvider.tsx` - Added the `_reconcileTodosOnTerminal` module-level export beside the existing terminal helpers, plus two fire-and-forget call sites (one per onTerminal handler) after the runStatus flip + subscription cleanup on the true-terminal path.
- `frontend/src/providers/StreamsProvider.test.tsx` - Added `_reconcileTodosOnTerminal` to the existing import and a `Phase 138-04` describe block with 5 cases covering the clean-completion gate, the fetch+replace path, and the best-effort never-throws contract.

## Decisions Made
None new beyond the plan — followed the plan as specified. The three key design choices (gate inside the helper, always-fetch per D-v2.5-03, no AbortController via thread-keyed write) were all prescribed by the plan's `<interfaces>` and `<action>` and are recorded in the frontmatter for downstream context.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. RED confirmed the expected failure (5 new fail with `_reconcileTodosOnTerminal is not a function`, 6 pre-existing green — matching the confirmed 6/6 baseline). GREEN flipped all 11 to green. Task 2 verify confirmed exactly 2 non-comment call sites and an additive-only (0-deletion) diff on the G-5 file.

## User Setup Required
None - no external service configuration required. This is a pure frontend data-reconcile change; the backend (138-02) is unchanged.

## Next Phase Readiness
- Plan 138-05 (checkpoint) owns the live confirmation: the marker surfaces in the Workspace TODOS panel at run-end with NO refresh (Scenario B) plus the D-14 red-line re-confirm (a normal Deep run with no open todos shows no marker text and no panel change — the clean-terminal GET returns the empty/unchanged list, replaceTodosForThread is a no-op empty→empty).
- No blockers. Backend correctness (138-02) and this frontend surfacing are now both in place; only live UAT remains.

---
*Phase: 138-run-end-honesty-stretch*
*Completed: 2026-07-06*

## Self-Check: PASSED

- Files: `StreamsProvider.tsx` FOUND, `StreamsProvider.test.tsx` FOUND, `138-04-SUMMARY.md` FOUND.
- Commits: `e84035bb` (test RED) FOUND, `1defa46d` (feat helper) FOUND, `6968f87f` (feat wire) FOUND.
- Helper export `_reconcileTodosOnTerminal` present (1 match); exactly 2 non-comment call sites; `npx vitest run src/providers/StreamsProvider.test.tsx` → 11/11 green; diff additive-only (0 deletions); no backend files modified.

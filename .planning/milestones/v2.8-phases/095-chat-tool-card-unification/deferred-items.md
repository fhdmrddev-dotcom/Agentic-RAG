# Phase 095 — Deferred Items

Out-of-scope discoveries logged during execution. NOT fixed in-plan (scope boundary —
only auto-fix issues DIRECTLY caused by the current task's changes).

## Plan 095-03 (D-05 sub-agent root fix + ToolCallPanel unification)

### DI-095-03-01 — Pre-existing dedup test failures (075.2 wire-shape drift)

- **File:** `frontend/src/__tests__/providers/StreamsProvider.dedup.test.ts`
- **Failing cases (2):**
  - `D-075.2-01: replayed tool_start after preparing->running is a no-op` — asserts
    `tool_calls[0].id === "preparing-0"` but the current reducer assigns
    `preparing-0-0` (the `preparing-${currentIteration}-${index}` id shape from a
    later change; the test still expects the old `preparing-${index}` shape).
  - `D-075.2-04: onToolEnd(name, result, id) flips the entry whose tc.id === id` —
    passes `id="preparing-0"` but the entry id is `preparing-0-0`, so the id-match
    misses and the entry stays `running`.
- **Proven PRE-EXISTING:** `git stash` of this plan's three files → the SAME 2 cases
  fail on the clean baseline (2 failed / 3 passed of the original 5). This plan adds
  4 new passing D-05 cases and regresses NONE of the original 3 passing cases.
- **Root cause:** test-fixture drift vs the `preparing-${currentIteration}-${index}`
  id shape — a stale assertion, NOT a backend/reducer regression. The dedup behaviour
  itself is correct (the transient suite proves it).
- **Disposition:** DEFERRED — unrelated to the D-05 sub-agent root fix; out of this
  plan's scope. Fix = retarget the two `preparing-0` id assertions to the current
  `preparing-0-0` shape (a 2-line test-only change).

### DI-095-03-02 — Pre-existing `getActiveRuns` unused-import (tsc baseline)

- **File:** `frontend/src/providers/StreamsProvider.tsx:73`
- **Error:** `TS6133: 'getActiveRuns' is declared but its value is never read.`
- **Proven PRE-EXISTING:** present on the clean baseline (part of the documented
  37-error tsc baseline from Plans 01/02). Not introduced by this plan.
- **Disposition:** DEFERRED — part of the standing 37-error tsc baseline; out of scope.

## Plan 095-05 (D-08 backend hero tag + D-07 OutputFileCard hero/working split)

### DI-095-05-01 — Pre-existing Plan04 "Atom C" terminal-styling test failure

- **File:** `frontend/src/__tests__/components/Plan04.frontend.test.tsx`
- **Failing case (1):** `Atom C — stdout/stderr terminal-output styling routes by
  channel > stdout lines use the emerald-400 class; stderr lines use red-400` —
  asserts a rendered terminal line's `className` contains `emerald-400`; the
  ExecuteCodeBody line styling has since drifted (the class lookup at L131-133 no
  longer finds the expected node).
- **Proven PRE-EXISTING:** `git stash` of this plan's 7 files → the SAME single case
  fails identically on the clean baseline (1 failed / 7 skipped when run in
  isolation). This plan's two OWN Plan04 final-outputs cases (relabeled "Final
  outputs" → "Generated files" + testid empty-state) PASS; this plan regresses NONE
  of the Plan04 passing cases.
- **Root cause:** stale terminal-line-styling assertion vs the current ExecuteCodeBody
  render — unrelated to OutputFileCard / the hero-working split. NOT a regression.
- **Disposition:** DEFERRED — out of this plan's scope (terminal stdout/stderr styling,
  not output-files). Part of the documented pre-existing ~17-failure full-suite cluster.

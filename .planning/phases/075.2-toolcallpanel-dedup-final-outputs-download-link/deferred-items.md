# Phase 075.2 — Deferred Items

## Pre-existing test debt (out of scope per SCOPE BOUNDARY rule)

### `streamsProvider.test.tsx` — `mockGetActiveRuns` expectations no longer hold

**Discovered during:** Phase 075.2 Plan 01 Task 3 verification.

**Status:** Pre-existing failure, NOT introduced by this phase. Last touched
at Phase 068.5 (commit `a1a2490`); Phase 075 D-075-02 atomic-swap replaced
reconcile's `getActiveRuns + loadMessages` chain with a single `getSnapshot`
call, but the legacy test assertions in `streamsProvider.test.tsx` still mock
`getActiveRuns` and `getMessages` and expect them to be called by reconcile.

**Symptom:** 7 tests fail with `expected "vi.fn()" to be called 1 times,
but got 0 times` on `mockGetActiveRuns` / `mockGetMessages`. Affected blocks:
- `Phase 068 — L-068-02 concurrent reconcile lock`
- `Phase 068 — L-068-05 runId-match dedup`
- `Phase 068 — setViewingThread reconcile-fire contract`
- `Phase 068 — listener migration (D-068-07 / D-068-08 / SC#1)` (2 cases)
- `Phase 068.5 — L-068.5-02 MERGE 3-clause filter survives`
- `Phase 068.5 — L-068.5-05 cross-state precedence`

**Why deferred:**
- All failures reference `mockGetActiveRuns` / `mockGetMessages` assertions
  that became obsolete when Phase 075 D-075-02 collapsed reconcile to a
  single `getSnapshot()` call. The production code is correct; the test
  expectations are stale.
- Phase 075.2 scope is bounded by CONTEXT.md `<domain>` to two surgical
  defect closes (BUG-260521-01 + BUG-260521-02) plus three WR-* polish
  items in `StreamsProvider.tsx` + `ToolCallPanel.tsx` + `MessageItem.tsx`.
  A full `streamsProvider.test.tsx` modernization to the snapshot-based
  reconcile shape is a separate, larger pass (estimated 7+ tests rewritten).
- This phase's targeted unit coverage
  (`StreamsProvider.transient.test.ts`, `StreamsProvider.dedup.test.ts`,
  `StreamsProvider.anthropic-ordering.test.ts`) — 19 tests across 3 files —
  all GREEN.

**Re-open trigger:** Standalone test-modernization pass on
`streamsProvider.test.tsx` (replace `mockGetActiveRuns + mockGetMessages`
assertions with `mockGetSnapshot` assertions); could be folded into a future
"test-debt sweep" mini-phase.

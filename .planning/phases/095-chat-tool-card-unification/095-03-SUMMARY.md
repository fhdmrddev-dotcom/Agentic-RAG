---
phase: 095-chat-tool-card-unification
plan: 03
subsystem: ui
tags: [react, vitest, typescript, sse-reducer, dedup, sub-agent, step-rail, cross-provider]

# Dependency graph
requires:
  - phase: 095-01
    provides: "dedupToolCalls(toolCalls) — the ONE shared dedup home; ToolCallPanel imports it here instead of its inline useMemo copy"
  - phase: 075.9
    provides: "makeToolKey / clientKey stamping — mirrored onto the sub-agent owner path for stable frame-1 identity"
  - phase: 075.2
    provides: "_isTransientStreamEnd / _reattachAfterTransient transient-id fix — left fully frozen (separate D-05 root)"
provides:
  - "D-05 root fix: the legacy analyze_document sub-agent stamps onto its OWNING tool_call (tc.sub_agent) — the dual render source `tc.sub_agent ?? subAgent` is collapsed, so a sub-agent body can never render twice (closes BUG-260529-02 #3)"
  - "ToolCallPanel imports the shared dedupToolCalls — panel count and RunCard headline count cannot drift (D-04)"
  - "StepRail/StepRow — the borderless step-numbered status-node rail (sketch 014) wrapping the EXISTING per-tool bodies (no second body system, G4)"
  - "the in-panel iteration divider relabeled 'Step N' -> 'Round N' so 'Step' means exactly one visible action everywhere after D-04"
affects: [095-04, 095-05, ToolCallPanel, StreamsProvider, RunCard, StepRail]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sub-agent identity discipline: a streamed sub-agent attaches to its OWNING tool_call (makeToolKey/clientKey), never a separate single-slot message field — one stable identity from frame 1 (the D-05 structural fix)"
    - "Single-dedup-home consumption: ToolCallPanel imports dedupToolCalls from @/lib/stepCount rather than forking an inline copy — the panel count and headline count share one derivation"
    - "Borderless numbered status-node rail (StepRail/StepRow) as PRESENTATION over the deduped tool_calls — changes layout, not data; reuses the existing TOOL_BODIES bodies (G4: forbid a second body renderer)"
    - "Additive/derivation-only changes in the shared makeStreamCallbacks closure: m.content + the four terminal kinds untouched; closure scoped to the OWNING threadId (per-thread demux)"

key-files:
  created: []
  modified:
    - "frontend/src/providers/StreamsProvider.tsx — onSubAgentStart/Delta/Done restructured to stamp onto the owning analyze_document tool_call (clientKey/makeToolKey discipline) instead of message.sub_agent"
    - "frontend/src/components/chat/ToolCallPanel.tsx — dual source collapsed to tc.sub_agent; shared dedupToolCalls import; StepRail/StepRow numbered rail; 'Round N' divider"
    - "frontend/src/__tests__/providers/StreamsProvider.dedup.test.ts — 4 new D-05 cases (one-block stamp / start-before-tool_start / content-append invariant / THREAD_A→THREAD_B isolation)"
    - "frontend/src/__tests__/components/ToolCallPanel.test.tsx — 3 new cases (Round-N label / numbered rail snum+node / rail dedup one-row)"

key-decisions:
  - "Collapsed the dual render source to tc.sub_agent ALONE (drop the ?? subAgent message-scoped fallback) — the sub-agent now lives only on its owning tool_call, the structural D-05 fix per RESEARCH option 1 + the (b) contribution"
  - "Kept the subAgent prop on ToolCallPanel's Props (RunCard still passes message.sub_agent) but stopped reading it — minimizes the prop-drill change surface; documented as back-compat-accepted-but-unused"
  - "StepRail wraps the EXISTING per-tool head + body verbatim (no second body system, G4); the rail is a 2-col grid (28px rail column + main), node state derived from (status): running/preparing=active, done/interrupted=done, else=queued"
  - "Test files live at frontend/src/__tests__/... not the plan-stated frontend/__tests__/... — used the real layout (the planned paths do not exist)"
  - "snum = 1-based ordinal among deduped tools, keyed on the SAME clientKey>id>composite key dedupToolCalls uses — makes D-04 count + D-05 zero-dup structural (a dup = two same-numbered rows)"

patterns-established:
  - "A streamed sub-agent record belongs to a tool_call, not the message — single stable identity, no dual-source double-render"
  - "Presentation-only rail wrappers reuse the canonical per-tool body registry; layout changes never fork the body renderer"

requirements-completed: [CHAT-04]

# Metrics
duration: 16min
completed: 2026-06-05
---

# Phase 095 Plan 03: D-05 Sub-Agent Zero-Duplicate Root Fix + ToolCallPanel Unification Summary

**The read/summarize (analyze_document) sub-agent now stamps onto its OWNING tool_call (one stable clientKey identity from frame 1) instead of a separate single-slot `message.sub_agent` — collapsing the `tc.sub_agent ?? subAgent` dual render source that doubled it (D-05, closes BUG-260529-02 #3); plus ToolCallPanel imports the ONE shared dedup, renders rows on a borderless step-numbered status-node rail reusing the existing bodies, and relabels the divider "Round N".**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-06-05T19:23:24Z
- **Completed:** 2026-06-05T19:40:17Z
- **Tasks:** 2 (both `type=auto`)
- **Files modified:** 4 (2 source + 2 test)

## Accomplishments

- **D-05 root fix (Task 1):** `StreamsProvider.makeStreamCallbacks` `onSubAgentStart/Delta/Done` restructured — the legacy analyze_document sub-agent now stamps onto its OWNING tool_call's `tc.sub_agent` (preserving the owner's `clientKey`, or creating a stable `makeToolKey` owner from frame 1 when `sub_agent_start` arrives before `tool_start`). The single-slot `message.sub_agent` live-write is GONE (`grep m.sub_agent` = 0). ToolCallPanel's `tc.sub_agent ?? subAgent` dual source collapsed to `tc.sub_agent` alone (`grep` = 0). A sub-agent body can no longer render twice — exactly ONE `SubAgentBlock`, never the "self-heals in 10-15s" doubling.
- **Shared dedup (Task 2):** ToolCallPanel imports `dedupToolCalls` from `@/lib/stepCount` (Plan 01), replacing the inline `useMemo`/`const seen = new Set` copy (`grep` = 0). Panel count and the RunCard headline count (which also reads `unifiedStepCount` → `dedupToolCalls`) can no longer drift.
- **StepRail numbered rail (Task 2, sketch 014):** each deduped tool's existing head + body is wrapped — reused verbatim, no second body renderer (G4) — in a borderless 2-column rail (status node + connecting spine + `snum`). Node state derives from `(status)`: running/preparing = active (pulsing-primary, `animate-pulseGlow`), done/interrupted = done (filled-success), else queued. Numbering makes the D-04 count and D-05 zero-dup structural. Reuse-only CSS, no new keyframes.
- **"Round N" relabel (Task 2):** the in-panel iteration divider `Step {tc.iteration + 1}` → `Round {tc.iteration + 1}` (`grep "Step {tc.iteration"` = 0, `"Round {tc.iteration"` = 1) so "Step" means exactly one visible action everywhere after D-04.
- **Cross-provider safety held:** all changes are additive/derivation-only in the shared `makeStreamCallbacks` closure — `m.content` (onDelta content-append invariant) and the four terminal kinds untouched; the 075.2 `_isTransientStreamEnd`/`_reattachAfterTransient` transient fix frozen (`grep` = 14, baseline-unchanged); the closure stays scoped to the OWNING `threadId` (proven by the THREAD_A→THREAD_B isolation test). PANEL-06 held (zero panel-store reads added by either file's diff).

## Task Commits

Each task was committed atomically:

1. **Task 1: D-05 sub-agent zero-duplicate root fix — stamp onto owning tool_call** — `32290cad` (fix)
2. **Task 2: ToolCallPanel shared dedup + StepRail numbered rail + Round-N divider** — `c12cad43` (feat)

**Plan metadata:** (this commit — docs: complete plan)

## Files Created/Modified

- `frontend/src/providers/StreamsProvider.tsx` — `onSubAgentStart` finds (or creates with a stable `makeToolKey` identity) the running analyze_document owner and sets `tc.sub_agent` on THAT entry; `onSubAgentDelta` appends to the owner's `sub_agent.content` (immutable copy-then-mutate, never `m.content`); `onSubAgentDone` flips the owner's `sub_agent.status` → done. No `message.sub_agent` single-slot writes remain on the live path.
- `frontend/src/components/chat/ToolCallPanel.tsx` — `dedupToolCalls` import + `useMemo(() => dedupToolCalls(toolCalls), [toolCalls])`; `StepRow` presentational rail wrapper (node + spine + snum) co-located; `agentState = tc.sub_agent` (dual source collapsed); `subAgent` prop kept on Props (back-compat) but no longer destructured/read; divider relabeled "Round N".
- `frontend/src/__tests__/providers/StreamsProvider.dedup.test.ts` — 4 new D-05 cases.
- `frontend/src/__tests__/components/ToolCallPanel.test.tsx` — 3 new rail/Round-N cases.

## Decisions Made

- **Collapse to `tc.sub_agent` alone** (drop `?? subAgent`) — the sub-agent now lives only on its owning tool_call, the structural fix (not a 5-line stamp). RESEARCH option 1 + the (b) clientKey contribution.
- **Keep but don't read the `subAgent` prop** — RunCard still passes `message.sub_agent`; removing the prop entirely would require a RunCard edit outside this plan's `files_modified` for the prop drill. Documented as accepted-but-unused (minimal surface, no behavior).
- **StepRail reuses the existing bodies verbatim** — the rail is presentation over the deduped tool_calls; it changes layout, not data. G4 (forbid a second body system) honored.
- **Used the real test-file layout** (`frontend/src/__tests__/...`) — the plan's `frontend/__tests__/...` paths do not exist on disk (Rule 3 blocking-issue resolution).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test files live under `frontend/src/__tests__/`, not the plan-stated `frontend/__tests__/`**
- **Found during:** Task 1 (locating the dedup test to extend)
- **Issue:** The plan `files_modified` listed `frontend/__tests__/providers/StreamsProvider.dedup.test.ts` and `frontend/__tests__/components/chat/ToolCallPanel.test.tsx`; neither exists. The real files are `frontend/src/__tests__/providers/StreamsProvider.dedup.test.ts` and `frontend/src/__tests__/components/ToolCallPanel.test.tsx`.
- **Fix:** Extended the actual files under `src/__tests__/`. No new files created at the non-existent paths.
- **Verification:** Both extended files run green for the new cases (4 + 3 new, all pass).
- **Committed in:** `32290cad` (Task 1) + `c12cad43` (Task 2).

---

**Total deviations:** 1 auto-fixed (1 blocking — wrong test path corrected to the real layout).
**Impact on plan:** Path correction only; the test content and behavior match the plan's acceptance criteria exactly. No scope creep.

## Issues Encountered

- **A `git stash`/`checkout HEAD~1` during the pre-existing-failure baseline check transiently reverted Task 1's ToolCallPanel dual-source collapse** (the stash captured a working tree that had been checked out to the pre-Task-1 state). Caught immediately by re-running the acceptance greps (`tc.sub_agent ?? subAgent` reappeared at 1). Re-applied the three Task-1 ToolCallPanel edits (dual-source collapse + destructure + Props comment), re-verified all greps clean (0/0/14), and re-confirmed the targeted suites green before committing Task 2. Final committed state is correct.

## Deferred Issues

Logged to `.planning/phases/095-chat-tool-card-unification/deferred-items.md` (out-of-scope, PROVEN pre-existing via `git stash`):

- **DI-095-03-01** — 2 pre-existing `StreamsProvider.dedup.test.ts` failures (`D-075.2-01` replayed-tool_start id assertion + `D-075.2-04` onToolEnd id-match) — stale fixture assertions vs the current `preparing-${iteration}-${index}` id shape; the dedup behaviour itself is correct (transient suite 14/14). NOT caused by this plan (clean baseline = same 2 failures).
- **DI-095-03-02** — pre-existing `StreamsProvider.tsx:73` `getActiveRuns` unused-import (TS6133) — part of the standing 37-error tsc baseline.

## Verification Results

- **D-05 sub-agent dedup tests:** 4 new cases green (one-block stamp / start-before-tool_start / content-append invariant / per-thread THREAD_A→THREAD_B isolation).
- **ToolCallPanel tests:** 8/8 green (5 existing Focus-Mode/divider + 3 new Round-N/rail/dedup).
- **Transient suite (075.2 fix proof):** 14/14 green — no regression of the transient-id fix.
- **RunCard suite:** 23/23 green (no regression from the shared-dedup/sub-agent changes).
- **Full frontend suite:** 17 failed / 474 passed (491) — the 17 failures match the documented pre-existing baseline (all 7 failing files PROVEN pre-existing by clean-baseline rerun; this plan adds ZERO net-new failures and 7 new passing tests).
- **tsc -b:** 37 (baseline unchanged; zero net-new — the lone touched-file error, `getActiveRuns` unused-import at StreamsProvider.tsx:73, is pre-existing).
- **vite build:** exit 0 (built in 1.85s).
- **Acceptance greps (all pass):** `tc.sub_agent ?? subAgent`=0 · `m.sub_agent`=0 · `_isTransientStreamEnd|_reattachAfterTransient`=14 (frozen) · `makeToolKey`=7 (≥baseline+1) · `dedupToolCalls`=4 · `const seen = new Set`=0 · `Step {tc.iteration`=0 · `Round {tc.iteration`=1 · `step-node`/rail present · `dangerouslySetInnerHTML`=0.
- **PANEL-06 isolation:** zero panel-store reads added by either file's diff (grep on the diff = 0).

## Known Stubs

None. The `subAgent` prop on ToolCallPanel's Props is intentionally accepted-but-unused (RunCard back-compat) — documented, not a stub. The StepRail is fully wired over the live deduped tool_calls.

## Threat Surface

No new security-relevant surface vs the plan's `<threat_model>`. T-095-03-01 (XSS) mitigated — all sub-agent content / tool summaries render as React text children, `dangerouslySetInnerHTML`=0. T-095-03-02 (cross-provider regression) mitigated — additive/derivation-only, onDelta invariant + four terminal kinds + 075.2 fix all held. T-095-03-03 (cross-thread bleed) mitigated — per-thread closure proven by the THREAD_A/THREAD_B isolation test. T-095-03-04 (PANEL-06) mitigated — no panel-store read added.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Wave 2 complete:** 095-02 (RunCard timer/count + RunStatusStrip) ‖ 095-03 (this plan) both shipped. The chat tool-card surface now has the honest timer (D-06), the unified step count (D-04), the zero-duplicate sub-agent (D-05), the shared dedup, the numbered rail, and the "Round N" divider.
- **Wave 3 unblocked:** 095-04 (D-03 follow-but-release scroll + JumpToLive / the RunStatusStrip floating chip Plan 02 provided) and 095-05 (D-07/D-08 output-files hero/working split + fileIcon + the backend hero tag) can proceed.
- **Live UAT owed at phase verify:** the 4 Chrome-DevTools MCP lived-experience scenarios (G-4 / SC#10 4-axis) — especially UAT #1 (read/summarize sub-agent never doubles, cross-provider) which this plan's D-05 fix targets.

## Self-Check: PASSED

- **Files:** all 4 modified source/test files + 095-03-SUMMARY.md + deferred-items.md FOUND on disk.
- **Commits:** `32290cad` (Task 1) + `c12cad43` (Task 2) FOUND in git log.
- **Tests:** 4 new dedup D-05 cases + 3 new ToolCallPanel cases green; transient 14/14, RunCard 23/23, ToolCallPanel 8/8.
- **tsc -b** = 37 (baseline unchanged); **vite build** exit 0.
- **Full suite:** 17 failed / 474 passed (491) — all 17 PROVEN pre-existing (zero net-new).
- **Acceptance greps:** all pass (dual source 0, m.sub_agent 0, transient 14 frozen, dedupToolCalls 4, inline-dedup 0, Step-divider 0, Round-divider 1, dangerouslySetInnerHTML 0, rail present).

---
*Phase: 095-chat-tool-card-unification*
*Completed: 2026-06-05*

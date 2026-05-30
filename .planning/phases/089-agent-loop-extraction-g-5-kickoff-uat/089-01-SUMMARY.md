---
phase: 089-agent-loop-extraction-g-5-kickoff-uat
plan: 01
subsystem: api
tags: [agent-loop, refactor, g-5, dataclass, streaming, threads]

# Dependency graph
requires:
  - phase: 088
    provides: tool_dispatcher.py module-header + ToolContext/ToolResult dataclass house style mirrored by the new skeleton
provides:
  - backend/app/services/agent_loop.py module skeleton (frozen RunContext, plain AgentLoopResult, run_agent_loop stub)
  - The three pure helpers (drain_step, _drain_stream_with_close_on_cancel, _strip_nul) moved verbatim to agent_loop.py
  - backend/app/services/SEAM.md — the operator-APPROVED extraction seam contract (B1 + co-located _reconstruct_history)
affects: [089-03, 089-04, 091, 092]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Seam-first review: propose run_agent_loop signature + RunContext/AgentLoopResult + boundary in SEAM.md, gate the verbatim move on operator sign-off (D-089-04)"
    - "Callables passed (emit/emit_terminal/spawn) not imported — breaks the threads<->agent_loop circular import (Pitfall 4)"
    - "frozen RunContext (inputs only) + plain AgentLoopResult (return bag) mirrors tool_dispatcher.py ToolContext/ToolResult"

key-files:
  created:
    - backend/app/services/agent_loop.py
    - backend/app/services/SEAM.md
  modified:
    - backend/app/api/threads.py
    - backend/tests/integration/test_061_hard_timeout.py

key-decisions:
  - "Seam APPROVED by operator: B1 boundary (L1470-1627 setup moves into run_agent_loop) + _reconstruct_history co-located in agent_loop.py (cycle-free)"
  - "_strip_nul un-nested to module scope in agent_loop.py; threads.py re-imports all 3 moved helpers (its persist fns still call _strip_nul until they move in Plan 03)"

patterns-established:
  - "Pattern 1: keyword-only callable injection (emit/emit_terminal/spawn) keeps the import one-directional"
  - "Pattern 2: SEAM.md as the operator-locked contract Plan 03 follows exactly"

requirements-completed: [FOUND-03]

# Metrics
duration: 26min
completed: 2026-05-30
---

# Phase 089 Plan 01: Extraction Foundation + Seam Review Summary

**`agent_loop.py` skeleton (frozen RunContext, plain AgentLoopResult, run_agent_loop stub) + 3 pure helpers moved verbatim + an operator-approved SEAM.md contract — no loop body moved, suite shows zero net regression.**

## Performance

- **Duration:** ~26 min (executor) + seam-review checkpoint
- **Completed:** 2026-05-30
- **Tasks:** 4 (3 auto + 1 blocking human-verify checkpoint, approved)
- **Files modified:** 4

## Accomplishments
- Created `backend/app/services/agent_loop.py`: G-5 provenance header, `@dataclass(frozen=True) RunContext` (9 Category-A input fields), plain `@dataclass AgentLoopResult` (5 Category-E finalizer outputs), and a `run_agent_loop(ctx, *, emit, emit_terminal, spawn) -> AgentLoopResult` stub raising `NotImplementedError` — **no loop body moved**.
- Moved the three pure helpers (`drain_step`, `_drain_stream_with_close_on_cancel`, `_strip_nul`) verbatim to `agent_loop.py`; `threads.py` re-imports them (`t.drain_step is a.drain_step` holds; no circular import; `import app.services.agent_loop` exits 0).
- Authored `backend/app/services/SEAM.md` — the full proposed seam — and obtained operator sign-off at the Task 4 checkpoint.

## Task Commits

1. **Task 1: scaffold agent_loop.py skeleton** - `334b9d96` (feat)
2. **Task 2: move 3 pure helpers verbatim, re-import in threads.py** - `bc0f8bb1` (refactor)
3. **Task 2 deviation: point _drain_stream source-grep guard at agent_loop.py** - `0fb49bae` (test)
4. **Task 3: write the proposed extraction seam (SEAM.md)** - `9db11e4d` (docs)

## Files Created/Modified
- `backend/app/services/agent_loop.py` - New module skeleton (RunContext, AgentLoopResult, run_agent_loop stub, 3 pure helpers)
- `backend/app/services/SEAM.md` - Operator-approved extraction seam contract (B1 + co-located _reconstruct_history)
- `backend/app/api/threads.py` - Removed the 3 helper definitions, added re-import from agent_loop
- `backend/tests/integration/test_061_hard_timeout.py` - Source-grep guard repointed at agent_loop.py (intent-preserving)

## Decisions Made
- **Seam APPROVED (operator, 2026-05-30):** B1 boundary — the L1470-1627 setup block (folder-scope, General/Explorer prompt+tool selection, history rebuild + trim) moves into `run_agent_loop`; `RunContext` stays the 9 raw inputs. `_reconstruct_history` co-located in `agent_loop.py` (keep-and-import rejected because `agent_loop → threads` reintroduces the cycle).
- Signature, RunContext (9 fields), AgentLoopResult (5 fields) confirmed as proposed — no operator changes requested.

## Deviations from Plan

### Auto-fixed Issues

**1. [Test guard] Repointed `_drain_stream` source-grep at agent_loop.py**
- **Found during:** Task 2 (helper move)
- **Issue:** `test_061_hard_timeout.py::test_per_call_timer_replacements_present` asserts via source-grep that the helper definition lives in `threads.py`; after the verbatim move the definition is in `agent_loop.py`, so the grep failed.
- **Fix:** Repointed the grep at `agent_loop.py` for the definition; call-site checks unchanged (calls stay in threads.py). Test-side, intent-preserving.
- **Files modified:** backend/tests/integration/test_061_hard_timeout.py
- **Committed in:** `0fb49bae`

---

**Total deviations:** 1 auto-fixed (test guard re-target)
**Impact on plan:** Necessary to keep the suite delta at zero net regression after a verbatim relocation. No scope creep — no behavior change.

## Issues Encountered
- **Suite has 102 pre-existing failures (no local Supabase/Redis up).** Documented live-DB test-infra debt (STATE.md → `075.4-TEST-TRIAGE.md`, routed to Phases 076/077): integration tests fail at `User-message INSERT did not return id` before the loop runs. The move was proven behavior-preserving by a **before/after-identical** comparison against baseline `bfd795b0` (102 failed / 877 passed both before and after). The true byte-identical bar is the operator's live-key SSE diff in Plan 04.

## User Setup Required
None - no external service configuration required for this plan.

## Next Phase Readiness
- **Plan 089-03 is unblocked** — the seam is locked. Plan 03 does the full verbatim move onto this exact contract (B1 + co-located `_reconstruct_history`).
- **Operator action before Wave 2:** capture the SSE *before*-baseline against the pre-move loop using the runbook + capture helper from Plan 089-02 (live native-7 keys). The "before" snapshot must be taken while the loop is still un-moved.

---
*Phase: 089-agent-loop-extraction-g-5-kickoff-uat*
*Completed: 2026-05-30*

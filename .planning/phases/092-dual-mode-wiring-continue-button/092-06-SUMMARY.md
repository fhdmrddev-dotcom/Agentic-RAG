---
phase: 092-dual-mode-wiring-continue-button
plan: 06
subsystem: ui
tags: [react, streams-provider, message-input, chat-area, api-error, 409, workflow-lock, sse]

# Dependency graph
requires:
  - phase: 092-05
    provides: F1/F2 closed backend (workflow_runs.user_id, write_audit owner, failure-path terminalize, lock_is_stale self-heal) — a Harness workflow run is created + persisted so the lock UX has a real lock to honor
  - phase: 092-04
    provides: per-thread keyed workflow-lock state (Map) + Deep/Harness toggle + picker + inline Continue card + mount-time reconcile (the F3 surface this plan hardens)
  - phase: 092-02
    provides: server-side 409 lock refusal (the status code the typed ApiError carries) + GET /threads/{id}/workflow ThreadWorkflowState
provides:
  - "F3 (frontend lock-UX) code-complete: typed status-carrying 409 ApiError; per-thread workflow lock SEEDED at Harness kickoff + SEEDED/CLEARED on the mount-time getThreadWorkflow reconcile (D-v2.5-03, F2 self-heal); textarea + Send + canSend gate on workflowLocked with the D-05 running hint; a 409 ApiError rolls back BOTH optimistic bubbles (user + orphaned assistant placeholder) and surfaces a fixed per-thread lock banner (no internals leaked)"
affects: [092-07, 092-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Status-carrying ApiError (explicit field, not a TS parameter-property — tsc -b erasableSyntaxOnly safe) lets the SSE send path branch on 409 vs other failures without parsing strings"
    - "Per-thread workflow lock seeded at two write points (Harness kickoff + mount reconcile) and cleared on stale/terminal anchor — the client mirror of the server-authoritative lock, reconciled-not-trusted (D-v2.5-03)"
    - "409 dual-bubble rollback: both optimistic bubbles (user + orphaned assistant placeholder) removed; error surfaced via the existing per-thread reconcileErrors Map (no new global state)"

key-files:
  created: []
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/components/chat/MessageInput.tsx
    - frontend/src/components/chat/ChatArea.tsx

key-decisions:
  - "ApiError uses an explicit class field (not a TS constructor parameter-property) so tsc -b under erasableSyntaxOnly accepts it"
  - "Lock is seeded at BOTH kickoff and the mount-time reconcile, and cleared on a stale/terminal anchor — the client never trusts its own lock as source of truth; the GET reconcile is authoritative (D-v2.5-03)"
  - "A 409 rolls back BOTH optimistic bubbles and surfaces a fixed lock banner (Dismiss only); reconcile-failure keeps the cached-version copy + Retry — two distinct per-thread banner shapes off one Map"
  - "All changes per-thread keyed + additive; no provider streaming branch touched (SC#3 / BUG-260523-01 / 075.x cascade rules honored)"

patterns-established:
  - "Client lock-UX is reconciled-not-trusted: seed on optimistic action, but the mount-time GET /threads/{id}/workflow is the authority that seeds OR clears (stale anchor = unlocked)"

requirements-completed: []  # MODE-01/MODE-02/CONT-01 stay OPEN — phase verification is gaps_found (F4); see below

# Metrics
duration: ~30min (Tasks 1-2; Task 3 UAT operator/orchestrator-owned)
completed: 2026-05-31
---

# Phase 092 Plan 06: Gap-Closure (F3 client lock-UX) + UAT Gate Summary

**Shipped the F3 frontend lock-UX (typed 409 ApiError, per-thread lock seeded at kickoff + reconcile, textarea/Send disable-while-locked, 409 dual-bubble rollback + per-thread lock banner) — tsc -b + vite build clean; the F1-unblocked lived-experience UAT then verified F1 & F2 CLOSED live and SC#2 (failure path) PASS, but surfaced a NEW blocker F4 (harness sub-agent parent_run_id FK mismatch) that prevents any Harness workflow from running end-to-end → phase verification is gaps_found, MODE-01/MODE-02/CONT-01 stay OPEN, routed to gap plan 092-07.**

## Performance

- **Duration:** ~30 min (Tasks 1-2 code; Task 3 = operator + orchestrator UAT gate, separate session)
- **Completed:** 2026-05-31
- **Tasks:** 2 code tasks shipped + 1 UAT gate (Task 3) resolved by orchestrator/operator
- **Files modified:** 4

## Accomplishments

- **F3 (MEDIUM, UX) code-complete** — the composer is now honest about the lock: textarea + Send + `canSend` gate on `workflowLocked` (the toggle + agent-selector already did), the locked textarea shows the D-05 "Workflow running — Cancel to switch back" hint, and a server 409 rolls back BOTH optimistic bubbles and shows a fixed per-thread lock banner. tsc -b = exactly 54 baseline (ZERO net-new), vite build clean.
- **Typed 409 path** — `api.ts` gained a status-carrying `ApiError`; `StreamsProvider.sendMessage`'s catch branches on the 409 to do the dual-bubble rollback + per-thread error surface (via the existing `reconcileErrors` Map), so the MODE-02 server-side refusal degrades gracefully in the UI instead of leaving an orphaned assistant placeholder.
- **Reconciled-not-trusted client lock** — the per-thread workflow lock is SEEDED at Harness kickoff and SEEDED/CLEARED on the mount-time `getThreadWorkflow` reconcile (D-v2.5-03), so a stale/terminal anchor self-heals to unlocked (the F2 client mirror).
- **UAT gate resolved (Task 3, gaps_found)** — see `092-06-UAT-FINDINGS.md`: F1 & F2 VERIFIED CLOSED live, SC#2 PASS (failure path), F3 code-complete but live-blocked, and a NEW blocker F4 found + routed to 092-07.

## Task Commits

1. **Task 1: typed 409 ApiError + seed per-thread workflow lock at kickoff & reconcile (F3)** - `3b21f230` (feat)
2. **Task 2: disable textarea+Send while locked + 409 rollback of both bubbles + per-thread error (F3)** - `4546b5bb` (feat)

_Task 3 was a `checkpoint:human-action` UAT gate (Chrome DevTools MCP + live Supabase + uvicorn console), executed by the orchestrator + operator — no source commit; results recorded in `092-06-UAT-FINDINGS.md`._

## Files Created/Modified

- `frontend/src/lib/api.ts` - `ApiError` with an explicit status field (not a TS parameter-property — erasableSyntaxOnly safe) so the SSE send path can branch on 409
- `frontend/src/providers/StreamsProvider.tsx` - per-thread workflow lock seeded at Harness kickoff + seeded/cleared on the mount-time `getThreadWorkflow` reconcile (D-v2.5-03 / F2 self-heal); `sendMessage` catch rolls back BOTH optimistic bubbles on a 409 ApiError and surfaces a fixed per-thread error via the existing `reconcileErrors` Map
- `frontend/src/components/chat/MessageInput.tsx` - textarea + Send + `canSend` gate on `workflowLocked`; locked textarea shows the D-05 "Workflow running — Cancel to switch back" hint
- `frontend/src/components/chat/ChatArea.tsx` - per-thread banner is message-aware: a 409 renders fixed lock copy (`data-testid=workflow-lock-error-banner`, Dismiss only); reconcile-failure keeps the cached-version copy + Retry

## Decisions Made

- `ApiError` uses an explicit class field (not a TS constructor parameter-property) so `tsc -b` under `erasableSyntaxOnly` accepts it.
- The client lock is reconciled-not-trusted: seeded on optimistic action, but the mount-time `GET /threads/{id}/workflow` is authoritative and seeds OR clears (stale anchor = unlocked).
- A 409 rolls back BOTH optimistic bubbles and surfaces a fixed lock banner (Dismiss only); reconcile-failure keeps the cached-version copy + Retry — two distinct per-thread banner shapes off one Map.
- All changes are per-thread keyed + additive; no provider streaming branch touched (SC#3 / BUG-260523-01 / 075.x cascade rules honored).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ApiError field shape under erasableSyntaxOnly**
- **Found during:** Task 1 / Task 2 (typed 409 ApiError)
- **Issue:** `tsc -b` runs under `erasableSyntaxOnly`, which rejects TypeScript constructor parameter-properties — the natural `constructor(public status: number)` form would have broken the build.
- **Fix:** Declared `status` as an explicit class field and assigned it in the constructor body, so the emitted JS is plain and `tsc -b` stays at exactly the 54 pre-existing baseline errors (ZERO net-new).
- **Files modified:** frontend/src/lib/api.ts
- **Verification:** `tsc -b` = 54 baseline (0 net-new); `vite build` clean.
- **Committed in:** `3b21f230` / `4546b5bb` (task commits)

---

**Total deviations:** 1 auto-fixed (1 blocking, type-correction)
**Impact on plan:** Required for the build to stay green; no scope creep. (This is the type-correction deviation already noted at the Task 1-2 checkpoint.)

## Issues Encountered

- **F3 live behavior could not be observed (blocked by F4, NOT a Task 1-2 defect).** The composer's disable-while-locked + 409-rollback paths are code-complete and build-clean, but the lived-experience UAT could not exercise them against a live lock because every Harness workflow dies in ~2s (F4 below) so no thread stays locked long enough to observe. The composer correctly showed **unlocked** for the already-terminal run (anchor NULL) — consistent with the reconciled-not-trusted design, not a defect.

## UAT Gate (Task 3) — gaps_found

Full detail in [`092-06-UAT-FINDINGS.md`](./092-06-UAT-FINDINGS.md). Verdict summary:

| Row | Verdict |
|-----|---------|
| **F1 — harness audit user_id (CRITICAL, 092-05)** | ✅ VERIFIED CLOSED live — `workflow_runs` row created with non-null `user_id`; `harness_audit` `phase_started` row has non-null user_id; no `NotNullViolationError` |
| **F2 — wedged lock (HIGH, 092-05)** | ✅ VERIFIED CLOSED live — failed run → `workflow_runs.status='failed'` + `threads.active_workflow_run_id=NULL`; no wedged lock |
| **SC#2 — anchor → NULL** | ✅ PASS (failure path); natural-completion + explicit-Cancel variants still owed once F4 lets a workflow finish |
| **F3 — composer disable + 409 (this plan)** | ⚠️ CODE-COMPLETE, LIVE-UNVERIFIED — tsc + build clean; live lock-honored / 409-rollback unobservable because the workflow dies in ~2s (F4); composer correctly showed unlocked for the terminal run (consistent) |
| **SC#3 / SC#5 / CONT-01 / SC#10 native-7 / Deep byte-identical** | ⛔ BLOCKED by F4 (downstream rows need a workflow that runs end-to-end) |

### NEW BLOCKER — F4 (routed to gap plan 092-07; OUT OF SCOPE for 092-05/092-06)

The first harness LLM-agent phase sub-agent insert fails with `asyncpg.ForeignKeyViolationError: runs_parent_run_id_fkey` because the engine `ctx.run_id` is the **workflow_run** id (`threads.py:1158`), which is not a `runs` row, yet `run_task_sub_agent` (`task_service.py:272`) uses it as `runs.parent_run_id`. The workflow cannot execute its phases → it is marked `failed` within ~2s. This is Phase 091's parked harness-execution path, exposed only now that F1 let the run advance past the first audit write. Fix shape (for 092-07, NOT applied here): thread the producer-shell `runs` id into the engine ctx as a distinct field (e.g. `producer_run_id`) and use THAT for `runs.parent_run_id`, keeping `ctx.run_id = workflow_run id` for audit/SSE/resume — covering BOTH the live producer ctx (`threads.py` harness branch) AND the resume ctx (`harness_engine._build_resume_context`). It is cross-provider + agent-loop-adjacent → needs its own scoped UAT (the rows blocked above become its gate).

## Phase Verification Status

**gaps_found.** This plan's own deliverable (F3 frontend lock-UX code) is DONE — Tasks 1-2 shipped, tsc + build clean. But the PHASE 092 verification is **NOT complete**: the binding criterion "a Harness workflow runs end-to-end" is not met because of F4. Accordingly:

- **MODE-01 / MODE-02 / CONT-01 REMAIN OPEN** (not marked validated).
- **Phase 092 is NOT complete.**
- **Next action: plan gap-closure 092-07** for F4 (harness sub-agent `parent_run_id`), whose verification re-runs UAT rows 4–10 (+ the SC#2 natural-completion / Cancel variants + SC#10 native-7 4-axis scoreboard + Deep byte-identical).

## TDD Gate Compliance

This is a frontend `type: execute` plan (not `type: tdd`); the plan-level RED/GREEN/REFACTOR gate sequence does not apply. The Task 3 UAT gate is the lived-experience verification per VALIDATION manual-only rows.

## Known Stubs

None — the F3 lock-UX is wired end-to-end (typed ApiError → 409 branch → dual-bubble rollback → per-thread banner; lock seeded at kickoff + reconciled on mount). The reason it could not be live-verified is the unrelated F4 backend FK blocker, not a stub.

## Next Phase Readiness

- **092-07 (NEXT)** — gap-closure for F4 (harness sub-agent `parent_run_id` FK mismatch). Once shipped, its UAT re-runs the rows blocked here (SC#3, SC#5, CONT-01, SC#10 native-7, Deep byte-identical) plus the SC#2 natural-completion/Cancel variants and the F3 live lock-honored / 409-rollback observation.
- **Phase 092 stays open** until 092-07 ships AND the re-run UAT is GREEN; only then do MODE-01/MODE-02/CONT-01 close.

## Self-Check: PASSED

- Modified files verified present: `frontend/src/lib/api.ts`, `frontend/src/providers/StreamsProvider.tsx`, `frontend/src/components/chat/MessageInput.tsx`, `frontend/src/components/chat/ChatArea.tsx`
- Task commits verified in git log: `3b21f230`, `4546b5bb`
- UAT findings referenced: `092-06-UAT-FINDINGS.md` present in phase directory

---
*Phase: 092-dual-mode-wiring-continue-button*
*Completed: 2026-05-31 (code); UAT gate gaps_found — phase verification deferred to 092-07*

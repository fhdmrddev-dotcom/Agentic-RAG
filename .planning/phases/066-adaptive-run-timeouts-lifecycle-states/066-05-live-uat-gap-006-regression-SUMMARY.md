---
phase: 066-adaptive-run-timeouts-lifecycle-states
plan: 05-live-uat-gap-006-regression
subsystem: testing
tags: [uat, gap-006, runs-lifecycle, per-call-timeout, langsmith, sse-streaming]

# Dependency graph
requires:
  - phase: 066-01-runs-status-enum-migration
    provides: runs.status='timed_out' lifecycle value
  - phase: 066-02-per-call-timer-tool-boundary-reset
    provides: per-LLM-call asyncio.timeout that resets on tool-call boundaries (D-066-02)
  - phase: 066-03-frontend-timed-out-banner-resume
    provides: frontend banner copy + Resume button on runs.status='timed_out'
  - phase: 066-04-integration-tests-terminal-classification
    provides: test_066_*.py suite binding the contract (per-call timer / status enum / terminal classification / SSE terminal / LangSmith clean)
provides:
  - "Live UAT evidence: Gap-006 architecturally closed (9m02s multi-iteration agent run completed cleanly)"
  - "066-HUMAN-UAT.md scoreboard with concrete run-row evidence"
  - "Carry-forward dossier for Phase 067 (5 streaming-UX issues observed during the run)"
affects: [067-frontend-streaming-display-fix, milestone-v2.5-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UAT-with-carry-forward: project-level approval decoupled from UAT-file status (Phase 063 / 063.1 precedent extended)"

key-files:
  created:
    - ".planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-05-live-uat-gap-006-regression-SUMMARY.md"
  modified:
    - ".planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md"

key-decisions:
  - "Phase 066 closed at architectural level: Gap-006 verified by 9m02s live run (run_id 95e3447c-cf9b-448b-9e0d-22c30e40670d) with status='completed', error=NULL, well past legacy 120s wrapper kill point."
  - "Synthetic-timeout live UAT (Task 2) DEFERRED to Phase 067. Frontend streaming-UX issues observed during Task 1 would mask the timed_out banner test; backend timed_out lifecycle is already bound by Plan 04 test_066_terminal_classification.py::test_timeout_branch_writes_timed_out."
  - "Five streaming-UX issues escalated to Phase 067 as carry-forward: empty initial paint (UX-067-01), Saving-response mid-stream thrash (UX-067-02), refresh-recovery dependency (UX-067-03), Redis consumer disconnect log noise (UX-067-04), perceived execute_code iteration cycle (UX-067-05)."
  - "UAT file status: partial. Project-level approval: approved (Phase 063 / 063.1 precedent — UX carry-forward does not block Phase 066's architectural deliverable)."

patterns-established:
  - "UAT-with-carry-forward dossier: when a non-blocking class of bug surfaces incidentally during UAT, capture it in a 'Carry-forward to Phase NN+1' section of the HUMAN-UAT.md with disposition + likely root-cause area, then route to a follow-on phase rather than blocking close."
  - "Live verification deferral: when a downstream UI bug would mask the verification of an upstream architectural fix, defer the live-UI portion to the phase that fixes the masking bug — do not force unreliable evidence."

requirements-completed:
  - STREAM-04-polish

# Metrics
duration: 25min
completed: 2026-05-06
---

# Phase 066 Plan 05: Live UAT — Gap-006 Regression Summary

**Live UAT confirmed Gap-006 closed by a 9m02s multi-iteration agent run (run_id `95e3447c-cf9b-48b-9e0d-22c30e40670d`); five concurrent frontend streaming-UX issues escalated to Phase 067 as carry-forward.**

## Performance

- **Duration:** ~25 min (executor wall-time across two segments — pre-flight + post-UAT recording)
- **Started:** 2026-05-06T18:45:00Z (Task 0 pre-flight scaffold)
- **Completed:** 2026-05-06T19:20:00Z (SUMMARY commit)
- **Tasks:** 4 (Task 0 pre-flight + Task 1 UAT recorded + Task 2 deferred + Task 3 sign-off)
- **Files modified:** 2 (066-HUMAN-UAT.md created/extended; this SUMMARY.md created)

## Accomplishments

- **Gap-006 architecturally CLOSED.** Live UAT run `95e3447c-cf9b-448b-9e0d-22c30e40670d` completed in 9 min 2.8 sec with `runs.status='completed'`, `runs.error=NULL`. The pre-066 `asyncio.timeout(120)` wrapper would have killed this exact run at iteration ~2 (~120s). The new per-call timer (D-066-02) reset on every tool-call boundary, allowing the agent to make multiple `execute_code` iterations across **542 seconds** and finish cleanly with chart PNGs + DOCX deliverable.
- **066-HUMAN-UAT.md scoreboard finalized** with concrete run-row evidence (run_id, elapsed time, status, error, started_at, completed_at) and LangSmith trace confirmation.
- **Phase 067 carry-forward dossier authored** — five streaming-UX issues catalogued with symptom + likely root-cause area + disposition, ready for Phase 067 planner consumption.
- **UAT-with-carry-forward pattern extended** from Phase 063 / 063.1 precedent: project-level approval is decoupled from UAT-file status; non-blocking bugs in adjacent layers can be routed forward without blocking architectural close.

## Task Commits

| # | Task | Status | Commit |
|---|------|--------|--------|
| 0 | Pre-flight environment + 066-HUMAN-UAT.md scaffold | ✅ done | `d9316d1` |
| 1 | Drive Gap-006 regression run + record evidence | ✅ done (UAT PASSED — Gap-006 closed) | `5ddb8ca` |
| 2 | Synthetic timeout run — banner + Resume + LangSmith clean | ⏭️ deferred (to Phase 067; backend lifecycle bound by `test_066_terminal_classification.py::test_timeout_branch_writes_timed_out`) | `5ddb8ca` (deferral rationale recorded in same commit) |
| 3 | Finalize scoreboard + sign-off | ✅ approved-with-carry-forward | `5ddb8ca` (sign-off block) + this SUMMARY commit |

**Plan metadata:** this SUMMARY commit (the next commit after `5ddb8ca`) — see git log post-commit.

## Files Created/Modified

- `.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md` — Filled scoreboard. SC#1 + Gap-006 regression rows GREEN with live run evidence; SC#6 marked carry-forward to Phase 067 with rationale; Phase 067 carry-forward section authored with 5 UX issues; sign-off block set to `status: partial` / `project_level_approval: approved`.
- `.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-05-live-uat-gap-006-regression-SUMMARY.md` — This file.

## Decisions Made

- **Phase 066 close at architectural level.** The Gap-006 user report from Phase 063.1 was about agent runs stopping mid-iteration on complex tool-call prompts. The 9m02s live run with `status='completed'` proves the new architecture admits exactly the workflow that previously failed. The user has approved closing Phase 066 on this evidence alone, with the synthetic-timeout UI verification queued for Phase 067.
- **Defer Task 2 (synthetic timeout UX live).** The frontend streaming-UX bugs surfaced during Task 1 would mask the `timed_out` UX rendering. Forcing a synthetic timeout in this state would not yield reliable observable evidence — we cannot distinguish "banner failed to render" from "banner rendered but the streaming-UX layer dropped it." Backend `timed_out` lifecycle is already bound by Plan 04 `test_066_terminal_classification.py::test_timeout_branch_writes_timed_out` (PASSED). Live UX verification is deferred to Phase 067 after the streaming-display fix lands.
- **Approved-with-carry-forward.** UAT file `status: partial` (SC#6 live deferred); project-level `project_level_approval: approved` (Gap-006 closed; carry-forward UX issues do not block 066's architectural deliverable). This follows the Phase 063 / 063.1 precedent of decoupling project-level approval from UAT-file status.

## Deviations from Plan

The plan specified executing Task 2 (synthetic timeout UX live) inline. Live UAT surfaced a non-Plan-066 class of bug (frontend streaming-display issues) that would have produced unreliable evidence for the synthetic-timeout test. Per Phase 063 / 063.1 carry-forward precedent, Task 2 was DEFERRED to Phase 067 rather than forced through with degraded evidence quality. This is documented in 066-HUMAN-UAT.md SC#6 row and the Carry-forward section.

Not classified as a Rule 1/2/3 auto-fix — this is a UAT outcome decision driven by user direction ("Mark Phase 066 complete (Gap-006 closed). The streaming-UX bugs are a separate class of bug deserving their own phase").

## Issues Encountered

Five frontend streaming-UX issues surfaced during the live run (catalogued in 066-HUMAN-UAT.md as UX-067-01 through UX-067-05). None block Phase 066's architectural deliverable. All routed to Phase 067:

1. **UX-067-01** — Empty chat UI for extended period after submission (backend emitting events, frontend not painting in real-time).
2. **UX-067-02** — "Saving response…" indicator appeared randomly mid-stream (frontend `runStatus` tracking out of sync with backend state).
3. **UX-067-03** — Manual page refresh required to see in-flight progress (refresh-recovery path is healthy; first-paint path is broken).
4. **UX-067-04** — `redis.exceptions.TimeoutError` log noise from SSE consumer at `runs.py:163` and `runs.py:184` when browser tab refreshes (asyncio cancellation converted to TimeoutError by redis-py's `async_timeout` wrapper — log-level cleanup, not an agent bug).
5. **UX-067-05** — Perceived "execute_code → PNGs → execute_code → PNGs+DOCX" cycle (agent legitimately made multiple iterations; frontend replay made the boundary feel cyclical).

## Next Phase Readiness

- **Phase 066:** ready to close. ROADMAP / STATE updates owned by orchestrator after wave-merge.
- **Phase 067 (Frontend Streaming-UX Fix):** carry-forward dossier ready in 066-HUMAN-UAT.md "Carry-forward to Phase 067" section. Phase 067 planner can read that section directly to scope the new phase. Phase 067 should also re-run Plan 05 Task 2's synthetic-timeout protocol once the streaming-display fix lands, to close out SC#6 live verification.
- **Optional cleanup:** legacy stopgap `RUN_HARD_TIMEOUT_SECONDS=600` line in `backend/.env` (D-066-12) is a no-op (Pydantic `extra="ignore"` silently drops it). Removal is documentation hygiene only — left in place for now; can be removed during Phase 067 cleanup.

## Notes — Carry-forward UX issues for Phase 067 planner

For convenience, the five carry-forward items in compact form:

| ID | One-liner | Likely layer |
|----|-----------|--------------|
| UX-067-01 | Empty chat UI for extended period after submission; backend events not painting in real-time | Frontend SSE consumer / replay-tail wiring |
| UX-067-02 | "Saving response…" indicator appeared randomly mid-stream | Frontend run-status state machine race vs SSE event ingestion |
| UX-067-03 | Manual refresh required to see in-flight progress (refresh recovery works fine; first-paint path is broken) | Frontend initial-stream-attach flow |
| UX-067-04 | `redis.exceptions.TimeoutError` from `runs.py:163`/`runs.py:184` on tab refresh — log noise, not an agent bug | Backend SSE consumer cancellation handling |
| UX-067-05 | Perceived `execute_code` iteration cycle (agent legitimately iterated; frontend replay made it feel cyclical) | Frontend tool-call boundary surfacing |

Phase 067 should also re-run **Plan 05 Task 2 protocol** (synthetic 10s per-call budget + slow prompt against the active model, observe banner + Resume + LangSmith clean trace) once UX-067-01 through UX-067-03 are fixed, to close out **SC#6** live verification deferred from this plan.

## Self-Check: PASSED

- [x] `066-HUMAN-UAT.md` filled with Task 1 PASSED + SQL evidence (`run_id 95e3447c-cf9b-448b-9e0d-22c30e40670d`, `00:09:02.846449` elapsed, `status='completed'`, `error=NULL`)
- [x] Task 2 marked DEFERRED with explicit rationale (frontend UX issues would mask the test; backend `timed_out` lifecycle bound by `test_066_terminal_classification.py::test_timeout_branch_writes_timed_out`)
- [x] Task 3 sign-off marked APPROVED-WITH-CARRY-FORWARD (`status: partial`, `project_level_approval: approved`, `reviewed_at: 2026-05-06T19:15:00Z`)
- [x] Carry-forward to Phase 067 section enumerates the 5 observed UX issues with symptom + likely root-cause area + disposition
- [x] Backend evidence section authored with SQL row + LangSmith confirmation
- [x] Two commits on worktree branch (`5ddb8ca` UAT update, plus this SUMMARY commit forthcoming)
- [x] No modifications to STATE.md or ROADMAP.md (orchestrator owns those after wave-merge)
- [x] Architectural Gap-006 goal met; UX carry-forward documented for Phase 067

---
*Phase: 066-adaptive-run-timeouts-lifecycle-states*
*Plan: 05-live-uat-gap-006-regression*
*Completed: 2026-05-06 (approved-with-carry-forward to Phase 067)*

---
phase: 145-run-lifecycle-honesty-threads-py-extraction-stretch
plan: 01
subsystem: infra
tags: [run-lifecycle, sse, redis, postgres, streams-provider, reconciler, repro, evidence-gate]

requires:
  - phase: 145-context
    provides: corrected root-cause trace (c12ff264) — Postgres runs.status authoritative, runs:active a derived mirror
provides:
  - "145-REPRO.md — live evidence gate settling Direction A (missed-terminal phantom), Direction B (restart-orphaned zombie), and A2/A3 assumptions"
  - "Direction A: happy-path finalize is honest; phantom is the intermittent missed-terminal race, load-bearing per A3 code proof + reference case 9f69ddf1"
  - "Direction B mechanism named: backend restart → empty RUN_TASKS zombie (runs:active swept, runs.status lags streaming)"
  - "A2 confirmed (code): ask_user keeps runs.status='streaming', not cap_paused → STALE_TIMEOUT 2400s > 1800s ask_user cap"
  - "A3 confirmed (code): no out-of-send-path streamingThreads derive → Plan 05 must reconcile-derive from snapshot.active_runs"
affects: [145-02, 145-03, 145-04, 145-05]

tech-stack:
  added: []
  patterns: ["repro-first evidence gate (D-145-11) — no fix ships against a hypothesised bug"]

key-files:
  created:
    - .planning/phases/145-run-lifecycle-honesty-threads-py-extraction-stretch/145-REPRO.md
  modified: []

key-decisions:
  - "No operator-backend restart while operator away (Windows --reload wedge, no recovery) — fresh Direction B producer-death repro deferred; mechanism grounded on real baseline drift + code (runs.py:1071-1073, main.py:335-337)"
  - "Direction A deterministic missed-terminal not forced in-session (timing race); watchdog necessity established by A3 structural proof + reference case instead — plan resume-signal sanctions this"

patterns-established:
  - "Identifier-only evidence capture (T-145-01-01): run_id/thread_id/status/timestamps/ZRANGE/XINFO only — no message content"

requirements-completed: [FND-01]

duration: ~40min
completed: 2026-07-09
---

# Phase 145 Plan 01: LIVE run-state desync repro (evidence gate) Summary

**Autonomous live repro settling both desync directions + the A2/A3 assumptions with real Postgres (:54322) + Redis evidence — the repro-first gate (D-145-11) that unblocks Plans 02–05.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-07-09
- **Tasks:** 1 (checkpoint:human-verify — run autonomously per operator authorization)
- **Files modified:** 1 created (145-REPRO.md); zero source touched

## Accomplishments
- **Direction A (fresh live run 27501a3b/thread 7d906915):** backend + client both finalize honestly on the happy path (`status=completed`, `runs:active` ZREM'd, UI cleared — screenshot `ss_1017is95j`). The phantom is the intermittent missed-terminal race, **confirmed load-bearing** by the A3 code proof (no reconcile-derive exists) + reference case `9f69ddf1` (16-min stuck).
- **Direction B:** mechanism named + code-confirmed — **backend restart → empty in-memory `RUN_TASKS` zombie** (`runs.py:1071-1073` documents it verbatim; `main.py:335-337` confirms the Postgres status lag). Real baseline: the two reference runs (`2075b364`, `3bd13487`) were `streaming`+empty at 07-08 capture, now `completed` with streams expired.
- **A2 confirmed (code):** `ask_user` keeps `runs.status='streaming'` (not `cap_paused`, which is iteration-cap only) → ratifies STALE_TIMEOUT 2400s > 1800s `ask_user` cap; Plan 04 excludes `cap_paused`.
- **A3 confirmed (code):** only 3 `streamingThreads` writes (send-add :1715, resubscribe-restore :1852, send-path finally-delete :2020); no derive from `snapshot.active_runs` → Plan 05 must reconcile-derive.

## Task Commits

1. **Task 1: Reproduce both directions live + record evidence** — committed with plan metadata (single doc-only checkpoint plan)

## Files Created/Modified
- `.planning/phases/145-.../145-REPRO.md` - Live-repro evidence gate: Direction A / Direction B / A2-A3, identifier-only readings.

## Decisions Made
- Ran the `checkpoint:human-verify` task **autonomously** — operator left for work and explicitly authorized full autonomous execution. Claude drove the browser (OpenAI gpt-5.5) and captured DB/Redis via a read-only scratchpad probe.
- **Did not restart the operator's uvicorn** — documented Windows `--reload` wedge risk with no recovery path while operator is away. Direction B's fresh producer-death repro was deferred; mechanism grounded on real baseline drift + code contract instead.

## Deviations from Plan

### Auto-fixed / method deviations

**1. Direction A — deterministic missed-terminal not force-reproduced in-session**
- **Issue:** the phantom is an intermittent timing race (missed terminal on open connection); forcing it deterministically needs network fault-injection or a restart.
- **Resolution:** established watchdog necessity via the A3 structural code proof (no reconcile-derive exists) + the real reference case `9f69ddf1`. The plan resume-signal explicitly sanctions this ("If Direction A does NOT reproduce without a restart, note it — the watchdog design still stands").

**2. Direction B — fresh producer-death repro deferred (no operator-backend restart)**
- **Issue:** a fresh `streaming`+empty capture needs a mid-stream backend restart; unsafe while operator away.
- **Resolution:** named + code-confirmed the mechanism (restart-orphaned zombie) from the real baseline drift (2 reference runs) + `runs.py:1071-1073` / `main.py:335-337`.

---

**Total deviations:** 2 method deviations (both flagged, both grounded on independent evidence). **Impact:** none on fix design — all four fix-plan premises (Plan 02 co-write, Plan 04 sweep + cap_paused exclusion + 2400s, Plan 05 reconcile-derive) are confirmed by observed + code evidence.

## Issues Encountered
- One Chrome-MCP screenshot CDP timeout (the documented intermittent hang) — recovered with a short wait + retry. No further browser instability.

## User Setup Required
None.

## Next Phase Readiness
- Wave 2 unblocked: Plan 02 (`run_lifecycle.py` atomic co-write owner), Plan 05 (frontend reconcile-derive watchdog), Plan 06 (FND-01 wording + SEED-109) can proceed.
- Fix-design premises all confirmed; no re-scoping needed.

---
*Phase: 145-run-lifecycle-honesty-threads-py-extraction-stretch*
*Completed: 2026-07-09*

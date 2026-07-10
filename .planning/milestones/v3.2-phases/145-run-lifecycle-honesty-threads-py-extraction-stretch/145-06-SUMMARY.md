---
phase: 145-run-lifecycle-honesty-threads-py-extraction-stretch
plan: 06
subsystem: docs
tags: [requirements, governance, seed, run-lifecycle, runs-active, deferred-work]

# Dependency graph
requires:
  - phase: 145-01
    provides: LIVE repro (145-REPRO.md) confirming the corrected authority model — Postgres runs.status authoritative, runs:active a restart-swept derived mirror
  - phase: 145-02
    provides: run_lifecycle.py (the atomic co-write owner) whose docstring names the deferred writers the seed cross-references
provides:
  - FND-01 requirement text corrected to the runs.status-authoritative / runs:active-derived-mirror model (no longer self-contradictory with the locked design)
  - SEED-109 — the deferred 5-writer eval/tuner/eval_runner migration onto the shared run_lifecycle owner, plus the cross-worker-cancel gap and the rejected last_heartbeat column, each with a concrete re-open trigger
affects: [145-verify-work, v3.3-foundation-followups, eval-tuner-run-lifecycle-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Adopt-later single-owner: ship the atomic owner chat-scoped this phase, plant a seed to migrate the remaining writers (red-line-safe, no shipped-surface fork)"
    - "Every deferred idea gets a concrete re_open_trigger (project seed convention)"

key-files:
  created:
    - .planning/seeds/SEED-109-migrate-eval-tuner-runs-active-writers-to-run-lifecycle.md
  modified:
    - .planning/REQUIREMENTS.md

key-decisions:
  - "D-145-01: FND-01 now names Postgres runs.status authoritative and runs:active a derived mirror (superseding the pre-trace runs:active-is-source-of-truth wording that c12ff264 corrected)"
  - "D-145-12: the 5-writer migration is deferred (not done this phase) to keep the shipped eval/tuner surfaces unforked — captured as SEED-109"
  - "runs.py :1247 zombie-heal excluded from SEED-109 — already migrated in Plan 03"

patterns-established:
  - "Requirement-layer honesty: when the root cause is corrected mid-milestone, the REQUIREMENTS.md text is corrected too, not just the code"

requirements-completed: [FND-01]

# Metrics
duration: 12min
completed: 2026-07-09
---

# Phase 145 Plan 06: FND-01 wording correction + SEED-109 deferred-work capture Summary

**Corrected the FND-01 requirement to the runs.status-authoritative / runs:active-derived-mirror model (matching the c12ff264 root-cause trace + the shipped run_lifecycle owner) and planted SEED-109 capturing every deliberately-deferred item — the 5-writer eval/tuner migration, the cross-worker cancel gap, and the rejected last_heartbeat column — each with a concrete re-open trigger.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-09
- **Completed:** 2026-07-09
- **Tasks:** 2
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments
- FND-01 no longer contradicts the locked design: the self-contradictory "Redis `runs:active` is the single source of truth … the frontend derives running/Stop deterministically from it" clause is replaced with "Postgres `runs.status` is authoritative; Redis `runs:active` is a derived mirror co-written with the status on every transition … the frontend derives running/Stop from `runs.status` (via get_snapshot)" — grounded in 145-REPRO.md (Direction B: restart-swept `runs:active` while `runs.status` lagged) and the `run_lifecycle.py` authority-model docstring (D-145-01/02, c12ff264).
- The rest of the FND-01 sentence (both-directions honesty, "Stop actually cancels", the `threads.py` extraction, BUG-260709-01 / BUG-260702-02 references) is intact — a single-line-region change, no other requirement touched.
- SEED-109 planted with valid frontmatter (id SEED-109, status planted, a 5-writer `re_open_trigger`) — names all five deferred writer sites (`api/evals.py` :315/:1915/:2624, `skill_tuner.py` :643/:738, `eval_runner_service.py` :864), states the chat-scoped-not-global invariant, cross-references the shared `run_lifecycle` owner, and explicitly excludes `runs.py` :1247 (zombie-heal, already migrated in Plan 03).
- SEED-109 also records the two adjacent deferred gaps — the cross-worker cancel gap (Open Q1: in-process `task.cancel()`, `finalize_run` has no CAS) and the rejected `last_heartbeat` schema column — each with its own concrete re-open trigger.

## Task Commits

Each task was committed atomically:

1. **Task 1: Correct the FND-01 requirement wording** - `8a757205` (docs)
2. **Task 2: Plant SEED-109 (5-writer migration + cross-worker cancel + last_heartbeat)** - `4c25bbe4` (docs)

## Files Created/Modified
- `.planning/REQUIREMENTS.md` - FND-01 bullet corrected to runs.status-authoritative / runs:active-derived-mirror (single-line-region change)
- `.planning/seeds/SEED-109-migrate-eval-tuner-runs-active-writers-to-run-lifecycle.md` - the deferred 5-writer migration seed + cross-worker-cancel + last_heartbeat re-open triggers

## Decisions Made
None beyond the plan — the corrected FND-01 wording and the SEED-109 content were both specified verbatim in the plan (Task 1 `<action>` and the `<deferred_items_to_record>` block) and grounded against 145-REPRO.md, run_lifecycle.py, and 145-CONTEXT/RESEARCH (D-145-01/02/09/12, U4, Open Q1).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The `grep`-based verifications in both tasks passed on the first run:
- Task 1: `runs.status` present; the "`runs:active` is the single source of truth" clause is gone; `git diff --stat` shows 1 file / 1 insertion / 1 deletion (single-line-region change).
- Task 2: SEED-109 file present; `re_open_trigger` present (frontmatter + body); all three writer files (`evals.py` / `skill_tuner.py` / `eval_runner_service.py`) named; both additional deferred items present.

## Threat Model
Documentation-only plan — no runtime surface, no request path, no trust boundary crossed (threat register T-145-06-01 disposition = accept; no package installs, so T-145-SC n/a). No new threat surface introduced.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FND-01 is now consistent with the locked design and the shipped `run_lifecycle` owner — ready for `/gsd:verify-work 145`.
- SEED-109 preserves the full deferred-work ledger for the next foundation follow-up (v3.3+): the global single-owner end-state, the cross-worker cancel fix, and the heartbeat fallback.
- No blockers.

## Self-Check: PASSED
- `FOUND` .planning/REQUIREMENTS.md (FND-01 contains "Postgres `runs.status` is authoritative" + "derived mirror"; stale "single source of truth" clause absent)
- `FOUND` .planning/seeds/SEED-109-migrate-eval-tuner-runs-active-writers-to-run-lifecycle.md
- `FOUND` commit 8a757205 (Task 1)
- `FOUND` commit 4c25bbe4 (Task 2)
- No modifications to .planning/STATE.md or .planning/ROADMAP.md (orchestrator-owned — left untouched)

---
*Phase: 145-run-lifecycle-honesty-threads-py-extraction-stretch*
*Completed: 2026-07-09*

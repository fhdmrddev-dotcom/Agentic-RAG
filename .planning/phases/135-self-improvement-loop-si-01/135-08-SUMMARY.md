---
phase: 135-self-improvement-loop-si-01
plan: 08
subsystem: api
tags: [self-improvement, skill-eval, fastapi, redis, reconcile, cross-worker, idor, pydantic]

# Dependency graph
requires:
  - phase: 135 (plans 04/05)
    provides: skill_proposals lifecycle (propose/approve/reconcile/promote/force-promote), _launch_reeval, promotion gate
provides:
  - Body-less HTTP force-promote (ForcePromoteBody optional) — 200 not 422 (CR-01 backend half)
  - Cross-worker reconcile liveness — eval_inflight Redis-claim check before declaring a running re-eval orphaned (CR-02)
  - Approve launch-failure recovery — CAS-guarded revert approved→proposed + stale-approved self-heal on read (CR-03 backend half)
  - Re-eval override map keyed on the draft version name the catalog injects (WR-02)
affects: [135-09 (frontend halves of CR-01/CR-03/WR-04), 135 re-verification, 136 skill publish gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-worker liveness via shared Redis claim value compare (not per-process dict) under WORKER_COUNT=2"
    - "CAS-guarded status revert (.eq('status','approved')) so concurrent transitions are never clobbered"
    - "Grace-window self-heal: reconcile-on-read heals a wedged status only past a discretionary staleness threshold"

key-files:
  created:
    - .planning/phases/135-self-improvement-loop-si-01/135-08-SUMMARY.md
  modified:
    - backend/app/api/evals.py
    - backend/tests/test_skill_proposals_router.py
    - backend/tests/test_skill_proposals.py

key-decisions:
  - "Override map keyed on the SET of {skill.name, draft_version.name} (non-empty) — collapses to one key when unchanged, covers both keys on rename (WR-02)"
  - "Revert unlinks new_skill_version_id (=None) on launch failure; the inserted self_improve draft version row is harmless and left in place"
  - "_APPROVED_STALE_GRACE_S = 120s — well beyond a normal approve request so a legitimately in-flight approve is never clobbered"
  - "reconcile early-return restructured into an if/elif chain routing stale-approved through the SHARED _persist path (no duplicate persist)"

patterns-established:
  - "Reconcile read triggers fire on ('re_evaling','approved') so a wedged approved proposal self-heals on the next GET"
  - "Redis claim decode-if-bytes then value-compare to str(re_eval_run_id) — presence alone is insufficient (a foreign/stale value must not mask an orphan)"

requirements-completed: [SI-01]

# Metrics
duration: 30min
completed: 2026-07-02
---

# Phase 135 Plan 08: Self-Improvement Gap-Closure (Backend) Summary

**Closed the three backend BLOCKER gaps + the WR-02 warning in the shared self-improvement proposal/eval path — body-less force-promote returns 200, a running re-eval survives a cross-worker reconcile via its Redis claim, an approve launch-failure reverts to `proposed` and a stale `approved` row self-heals to `interrupted`, and the re-eval override now measures the DRAFT after a rename.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-02
- **Completed:** 2026-07-02
- **Tasks:** 3
- **Files modified:** 3 (1 source, 2 test)

## Accomplishments
- **CR-01 (Truth 4):** `force_promote_skill_proposal` body → `ForcePromoteBody | None = None`, so the exact body-less `POST .../force-promote` the shipped frontend sent returns 200 with `override_forced=true` instead of a 422 `missing body` error. Owner-verify, the `not_promoted` 409 guard, the single `skills.instructions` UPDATE, and the FAILED-gate attach are all untouched (T-135-08).
- **CR-02 (Truth 3):** `reconcile_proposal`'s `running` branch now cross-checks the shared `eval_inflight:{skill_id}` Redis claim before declaring an orphan. A claim still naming `str(re_eval_run_id)` proves a healthy in-flight re-eval on the OTHER worker (WORKER_COUNT=2) → left `re_evaling`; only task-absent-here AND claim-not-ours → `interrupted`. Stops the false `interrupted` that silently skipped the promotion gate.
- **CR-03 (Truth 2):** `approve_skill_proposal` wraps the step-8 `_launch_reeval` in try/except — on failure (reachable case: the shared-eval 409) it reverts the proposal to `proposed` with a CAS-guarded `.eq('status','approved')` UPDATE (+ unlinks the draft) and re-raises. Plus `reconcile_proposal` self-heals a stale `approved` row (no `re_eval_run_id`, `updated_at` past `_APPROVED_STALE_GRACE_S`) to `interrupted`, reachable via extended reconcile triggers on both `list_skill_proposals` and `get_skill_proposal`.
- **WR-02:** `_launch_reeval`'s `skill_instructions_override` is now keyed on BOTH `skill.name` and `draft_version.name` — the WITH-arm catalog injects the draft version name and `_handle_load_skill` looks the override up by it, so a rename between propose and approve still measures the DRAFT (no silent no-op gate).
- Four new automated regression tests (all green) lock each fix; the pre-existing 14 proposal/gate tests still pass (21 total across the 3 files).

## Task Commits

Each task was committed atomically:

1. **Task 1: Force-promote optional body (CR-01) + override-map draft-name key (WR-02)** — `36bdbf60` (fix)
2. **Task 2: Reconcile cross-worker liveness (CR-02) + approve failure recovery (CR-03 backend)** — `959ab873` (fix)
3. **Task 3: Backend regression tests (HTTP force-promote, reconcile running-branch, approve revert, stale-approved self-heal)** — `13d718dc` (test)

_Note: the `datetime` import + `_APPROVED_STALE_GRACE_S` constant + `_approved_is_stale` helper (CR-03 scaffolding) landed in the Task 1 commit as setup; they are wired into behavior by Task 2._

## Files Created/Modified
- `backend/app/api/evals.py` — force-promote optional body; `_launch_reeval` override map on both names; reconcile `running`-branch Redis-claim liveness; approve except/revert (CAS); reconcile stale-`approved` self-heal + extended read triggers; `_APPROVED_STALE_GRACE_S` + `_approved_is_stale` + `datetime` import.
- `backend/tests/test_skill_proposals_router.py` — `test_force_promote_over_http` (body-less wire contract, 200 + override_forced + live-skill write + FAILED gate).
- `backend/tests/test_skill_proposals.py` — `test_reconcile_running_cross_worker`, `test_approve_reverts_on_launch_failure`, `test_reconcile_self_heals_stale_approved` (+ a `_ClaimRedis` async fake).

## Decisions Made
- **Override map = SET of non-empty {skill.name, draft_version.name}** — identical names collapse to one key (no-rename case), distinct names produce two keys (rename case). No new DB read (`draft_version` is already a `_launch_reeval` param).
- **Revert unlinks `new_skill_version_id`** on launch failure; the already-inserted `self_improve` draft version row is left in place (harmless, per plan).
- **`_APPROVED_STALE_GRACE_S = 120s`** — discretionary staleness threshold comfortably beyond a normal approve request, so a fresh `approved` row whose launch is legitimately in flight is never clobbered.
- **Reconcile early-return restructured** into an `if/elif` chain so the stale-`approved` self-heal routes through the SHARED `_persist` path (no duplicate persist logic); the existing `re_evaling` run-status branch is preserved byte-for-byte under the final `else`.

## Deviations from Plan

None — plan executed exactly as written. No auto-fixes (Rules 1–3) were needed; no architectural decisions (Rule 4) arose. All edits were surgical and confined to the planned file set.

## Issues Encountered
- The worktree spawned on a STALE base and had no `backend/venv`. Resolved per the branch-check: `git reset --hard` to the plan base `a2f6c1e6`, and ran pytest with the main checkout's venv (`C:/Vibe Apps/Agentic RAG/backend/venv/Scripts/python.exe`) from the worktree's `backend/` cwd so `app`/`tests` resolve against the worktree code. All tests green.

## Cross-provider / red line
All edits are in the shared, provider-agnostic proposal/eval path — NO provider-specific forks. The re-eval reuses the existing gateway routing verbatim (the D-11 `override_provider` + `llm_model` pin in `_launch_reeval` is unchanged). No new packages (pure in-repo fix — supply-chain surface unchanged, T-135-SC).

## User Setup Required
None — no external service configuration, no migration, no new dependency.

## Next Phase Readiness
- Backend halves of CR-01/CR-02/CR-03 + WR-02 are closed and test-locked — `135-VERIFICATION.md` Truths 2, 3, 4 are re-verifiable.
- The frontend halves of CR-01/CR-03 and WR-04 ship in the parallel plan `135-09` (no file overlap → same wave).
- Live SC#10 UAT (U1–U11) still owed at phase re-verification; `135-SECURITY.md` (`/gsd:secure-phase 135`) still owed.

## Self-Check: PASSED
- Files verified present: `backend/app/api/evals.py`, `backend/tests/test_skill_proposals_router.py`, `backend/tests/test_skill_proposals.py`.
- Commits verified present: `36bdbf60`, `959ab873`, `13d718dc`.
- Tests: 21 passed across `test_skill_proposals_router.py` + `test_skill_proposals.py` + `test_promotion_gate.py` (4 new + 17 pre-existing).

---
*Phase: 135-self-improvement-loop-si-01*
*Completed: 2026-07-02*

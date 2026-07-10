---
phase: 135-self-improvement-loop-si-01
plan: 05
subsystem: api
tags: [self-improvement, si-01, approval, re-eval, promotion-gate, d-13, d-14, owner-scoping, reconcile-on-read]

# Dependency graph
requires:
  - phase: 135-self-improvement-loop-si-01
    plan: 01
    provides: "public.skill_proposals table (mig 083) — 7-value lifecycle status + new/re_eval/source run FKs"
  - phase: 135-self-improvement-loop-si-01
    plan: 02
    provides: "additive default-off skill_instructions_override seam threaded into run_eval_job's WITH arm — the DRAFT re-eval measures proposed instructions, not the live skills row (Pitfall #1)"
  - phase: 135-self-improvement-loop-si-01
    plan: 04
    provides: "LOCKED SkillProposalResponse (nullable gate) + ForcePromoteBody + PromotionGate (8 D-13 keys); the propose/list/get/reject routes on the /skills router"
  - phase: 133-eval-runner
    provides: "evals.py start_eval_run companion-run machinery (SET NX inflight + eval_runs + public.runs + ZADD + seed-before-return + provider override + RUN_TASKS spawn) reused verbatim; run_eval_job (D-12)"
provides:
  - "POST approve — INSERTs a source='self_improve' draft version WITHOUT touching the live skill (D-05), launches a both-arms re-eval on the SOURCE run's provider/model (D-11) with the draft override (Pitfall #1)"
  - "promotion_gate() — the D-13 case-matched no-regression + improvement math (intersection-only; not_measured excluded from both sides; keys == PromotionGate.model_fields)"
  - "reconcile_proposal() + _compute_gate() — reconcile-on-read self-heal: completed->promote(pass)/not_promoted(fail); terminal-or-orphaned->interrupted (D-14); honest counts hydrated onto SkillProposalResponse.gate for promoted AND not_promoted (D-13 always displayed)"
  - "POST rerun (D-14 re-run affordance) + POST force-promote (D-06 override-with-evidence, override_forced=true)"
affects: [135-06-frontend, 135-07-display, 136-skill-publish-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reconcile-on-read self-heal: a GET reconciles a 're_evaling' proposal to its terminal state (never a schema-persisted gate) — the honest D-13 counts are RECOMPUTED from the two runs' eval_results on every read so they render on promoted AND not_promoted and survive reloads (no gate column)"
    - "In-flight status is set together with re_eval_run_id AFTER a successful launch (approved -> re_evaling only once the run id exists) so a concurrent reconcile can never race a run-less 're_evaling' to interrupted"
    - "The single live-skill write happens ONLY after a human approval + a passing promotion_gate, or an explicit human force-promote (override_forced recorded) — no code path promotes without a human action (T-135-04)"
    - "Reuse start_eval_run's companion machinery verbatim in _launch_reeval (no fork of run_eval_job — D-12); the WITH arm measures the DRAFT via the Plan-02 skill_instructions_override seam keyed on the skill name"

key-files:
  created:
    - backend/tests/test_promotion_gate.py
    - backend/tests/test_skill_proposals.py
  modified:
    - backend/app/api/evals.py

key-decisions:
  - "In-flight status split: approve sets status='approved' + new_skill_version_id BEFORE the launch, then 're_evaling' + re_eval_run_id in ONE write AFTER the launch succeeds — closing the race where a reconcile sees 're_evaling' with no run id and wrongly finalizes it to interrupted (Rule 2 defensive refinement of the plan's 'approved then re_evaling' ordering)"
  - "reconcile_proposal uses RUN_TASKS membership as the liveness signal for a 'running' re-eval: a running run absent from the in-process RUN_TASKS registry (a backend restart lost the task) is orphaned -> interrupted (D-14); a running run still in RUN_TASKS is left 're_evaling' (genuinely in-flight). No heartbeat column needed."
  - "_compute_gate returns None whenever the re-eval run is not 'completed' (or has no results) — so interrupted / in-flight proposals honestly carry gate=None, and promoted/not_promoted carry the recomputed counts, with NO schema change (recompute-on-read)."
  - "Approve + rerun add a defensive empty-fan-out guard (400 if the skill has no test cases) mirroring start_eval_run's T-133-02 — never launch a re-eval with nothing to A/B."

patterns-established:
  - "The whole SI-01 approve->re-eval->gate->promote/interrupt loop lands as additive routes + module functions on the existing net-new /skills eval router (skill_tuner precedent) — no G-5 hot file touched, no fork of the shared agent loop / provider gateway (SC#10 red line holds)"

requirements-worked: [SI-01]

# Metrics
duration: 35min
completed: 2026-07-02
---

# Phase 135 Plan 05: Approval + Auto Re-Eval + Honest Promotion Gate Summary

**Closes the self-improvement loop: POST approve INSERTs an immutable `skill_versions(source='self_improve')` draft WITHOUT touching the live skill (D-05), then launches a both-arms re-eval reusing the `start_eval_run` machinery + `run_eval_job` on the SOURCE run's provider/model (D-11/D-12) with the Plan-02 `skill_instructions_override` seam so the WITH arm measures the DRAFT (Pitfall #1); when the re-eval terminates, `promotion_gate()` (D-13 case-matched no-regression + improvement) decides promote (the single `skills.instructions` UPDATE, accepting the 079 trigger's benign `manual` dup per Pitfall #2) / not_promoted (force-promotable with evidence, D-06) / interrupted (re-runnable, D-14) — with the honest counts recomputed-on-read onto the LOCKED `SkillProposalResponse.gate` for BOTH promoted AND not_promoted (D-13 "always displayed"), no schema change, the human-always-in-the-loop never-auto-applies contract made real.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-02
- **Tasks:** 3
- **Files:** 3 (1 modified, 2 created)

## Accomplishments

- **POST approve (Task 1):** owner-verifies the proposal on `id AND user_id AND skill_id` (404 not 403) and requires `status=='proposed'` (409); reads the base version (name/description) + the SOURCE run's provider/model (D-11); service-role INSERTs a `skill_versions` row with `source='self_improve'` and `version_number = COALESCE(MAX)+1` (a DIRECT INSERT bypasses the 079 append-only trigger — only UPDATE is blocked) WITHOUT any live-skill write (D-05); then launches the re-eval via `_launch_reeval` and links `re_eval_run_id` + `status='re_evaling'`.
- **`_launch_reeval` helper:** REUSES the `start_eval_run` companion machinery verbatim (mint run_id → Redis `SET NX` inflight claim → INSERT `eval_runs`(skill_version_id=draft, provider/model=source) + companion `public.runs` row → ZADD → seed the buffer via `EVENT_RUN_STARTED` BEFORE returning (the d0c0c10a race fix) → `override_provider` + `model_copy` (D-11) → spawn `run_eval_job(skill_instructions_override={skill.name: proposed})`), registers the task in `RUN_TASKS` for cancel parity + a done-callback that reconciles the proposal in-process. No fork of `run_eval_job` (D-12).
- **`promotion_gate()` (Task 2):** lifts the RESEARCH § Code Examples gate verbatim — joins the SOURCE × RE-EVAL runs on `test_case_id` (with_skill arm), intersection-only, `not_measured` excluded from BOTH sides; `passed = no_regression AND improved`; returns the 8 honest counts whose keys are asserted `== PromotionGate.model_fields`.
- **`_compute_gate()` + `reconcile_proposal()` (Task 2):** recompute-on-read maps `promotion_gate()` onto `PromotionGate` and hydrates `SkillProposalResponse.gate`; reconcile self-heals a `re_evaling` proposal — a completed re-eval promotes on a passing gate (the SINGLE `skills.instructions` UPDATE, accepting the 079 trigger dup — Pitfall #2) else `not_promoted`; a terminal-but-not-completed OR running-but-orphaned re-eval → `interrupted` (D-14, never stuck). Wired into GET single + list so the state self-heals and the counts render on read (survives a backend restart).
- **POST rerun (Task 3, D-14):** reconciles a stale `re_evaling` first, then (from `interrupted`) re-launches the re-eval against the EXISTING draft version. **POST force-promote (Task 3, D-06):** from `not_promoted` only, applies the promotion write, records `override_forced=true` + `status='promoted'`, and attaches the FAILED gate counts (override-with-evidence).

## Task Commits

Each task committed atomically:

1. **Task 1+2+3 source — approve/rerun/force-promote routes + promotion_gate + reconcile/_compute_gate + gate wiring (evals.py)** — `fa367a38` (feat)
2. **Task 2 test — D-13 promotion_gate math, exhaustive edges** — `773d1d74` (test)
3. **Task 3 test — approve/promote/force/interrupted lifecycle (service-level fakes)** — `553f9aab` (test)

> Note: all Plan-05 `evals.py` source (the routes + gate + reconcile) is one cohesive file change committed once (`fa367a38`); the two test deliverables (Tasks 2 and 3) are committed separately so each is atomic per file.

## Files Created/Modified

- `backend/app/api/evals.py` — added `promotion_gate()` (pure), `_read_arm_results()`, `_compute_gate()`, `reconcile_proposal()`, `_launch_reeval()`, `_read_skill_cases()`, `_RECONCILE_TASKS`, and the 3 routes (`approve` / `rerun` / `force-promote`); wired `reconcile_proposal` + `_compute_gate` into the GET single + list handlers (added `redis` dep to both); imported `ForcePromoteBody` + `PromotionGate` from `eval_run.py` (NOT modified — Plan 04 owns it).
- `backend/tests/test_promotion_gate.py` — 9 pure-function tests over `promotion_gate` (pass/regression/no-improvement/all-pass/not_measured-excluded/without_skill-ignored/changed-case-set/empty/keys==model_fields).
- `backend/tests/test_skill_proposals.py` — 5 service-level lifecycle tests (approve self_improve version; reject pure audit; promotion pass+fail paths with gate on both; force-promote override; interrupted + rerun) over the in-memory `_FilterSupabase` fake with `_launch_reeval` patched.

## Decisions Made

- **In-flight status split (race close).** Approve sets `status='approved'` + `new_skill_version_id` BEFORE the launch, then `re_evaling` + `re_eval_run_id` in ONE write AFTER a successful launch — so a concurrent reconcile can never observe `re_evaling` without a run id and wrongly finalize it to `interrupted`. The plan named "approved then re_evaling"; this makes the transition ordering race-safe.
- **RUN_TASKS membership = liveness (no heartbeat column).** A `running` re-eval absent from the in-process `RUN_TASKS` registry (a backend restart lost the task) is orphaned → `interrupted`; still in `RUN_TASKS` → left `re_evaling`. The eval_runs table has no heartbeat column, so in-process task presence is the honest liveness signal.
- **Recompute-on-read gate (no schema change).** `_compute_gate` returns `None` unless the re-eval run is `completed` with results, so `interrupted`/in-flight proposals honestly carry `gate=None`, and `promoted`/`not_promoted` carry the counts recomputed from the two runs' `eval_results` on every read (D-13 "always displayed").

## Deviations from Plan

### Auto-added / refined (no behavior loss)

**1. [Rule 2 — Defensive] In-flight status set together with `re_eval_run_id` after launch (race close)**
- **Found during:** Task 1 (approve transition ordering).
- **Issue:** Setting `status='re_evaling'` before the launch links `re_eval_run_id` opens a window where a concurrent GET/reconcile sees `re_evaling` with no run id → wrongly finalizes to `interrupted`, orphaning a running re-eval.
- **Fix:** approve marks `approved` (+ draft link) before the launch and transitions to `re_evaling` (+ `re_eval_run_id`) in one write after `_launch_reeval` returns. `reconcile_proposal` only acts on `re_evaling`, so `approved` is left alone during the window.
- **Files:** `backend/app/api/evals.py` (`approve_skill_proposal`).
- **Commit:** `fa367a38`

**2. [Rule 2 — Defensive] Empty-fan-out guard on approve + rerun (400 if no test cases)**
- **Found during:** Task 1/3 (re-eval launch corpus).
- **Issue:** The plan did not explicitly guard a re-eval launched against zero test cases (the cases could have been deleted after the source run).
- **Fix:** approve + rerun 400 when the skill has no test cases (mirrors `start_eval_run`'s T-133-02 no-empty-fan-out invariant).
- **Files:** `backend/app/api/evals.py` (`approve_skill_proposal`, `rerun_skill_proposal`).
- **Commit:** `fa367a38`

## Issues Encountered

- **Worktree has no venv/.env** (same as Wave 1/2). Ran the test gates with the MAIN checkout's venv Python (`C:/Vibe Apps/Agentic RAG/backend/venv/Scripts/python.exe`) executed FROM the worktree `backend/` dir so `import app...` resolves to the WORKTREE source (verified the resolved `evals.py` path is under the worktree). Copied the gitignored `backend/.env` into the worktree backend for the app-import env; `git check-ignore` confirmed it is ignored and it was never staged/committed (clean `git status`).

## Known Stubs

None — the routes call the real machinery (Plan-02 override seam, Plan-04 models, Plan-03/133 re-eval engine). Tests patch only `_launch_reeval` (the async spawn) so the lifecycle assertions are deterministic; the launch machinery is exercised by the router integration + the Task-1 source assertion, and the gate math by `test_promotion_gate.py`.

## Threat Flags

None — no NEW security surface beyond the plan's threat register. All 3 new routes are owner-scoped (`.eq("user_id", …)`) with a state guard (approve requires `proposed`; force-promote requires `not_promoted`); request bodies carry no owner/skill ids (`ForcePromoteBody` is empty — T-135-02); the single live-skill write happens ONLY after a human approval + a passing gate OR an explicit human force-promote with `override_forced` recorded (T-135-04). The re-eval reuses the shared `run_eval_job` unchanged (T-135-08). T-135-01/-04/-06/-08 all mitigated as planned.

## Verification

- `pytest tests/test_promotion_gate.py -x` — **9 passed** (D-13 math, exhaustive edges, keys == `PromotionGate.model_fields`).
- `pytest tests/test_skill_proposals.py -x` — **5 passed** (approve/promote/force/interrupted lifecycle + gate on promoted AND not_promoted).
- Task 1 source assertion prints `APPROVE_OK` (approve route registered; `self_improve` + `skill_instructions_override` present in `evals.py`); `ROUTES_OK` (approve/rerun/force-promote all registered; `promotion_gate()` keys == `PromotionGate.model_fields`).
- Eval-domain regression sweep (`test_promotion_gate` + `test_skill_proposals` + `test_skill_proposals_router` + `test_evals_router` + `test_eval_runner` + `test_skill_proposer` + `test_load_skill_override`) — **38 passed**.
- `app.main` mounts all 7 proposal routes (`APP_MOUNT_OK`).
- SC#10 4-axis loop (U1–U11) executed LIVE at `/gsd:verify-work` per 135-VALIDATION.md (D-15) — NOT a plan task.

## Next Phase Readiness

- Plan 06 (frontend) has the LOCKED endpoint contracts: `POST approve` / `rerun` → `{proposal, re_eval_run_id}`; `POST force-promote` → `SkillProposalResponse`; GET single/list now reconcile `re_evaling` and carry `gate` for terminal proposals (recompute-on-read). The `re_eval_run_id` doubles as the companion `runs.run_id` so the existing chat-run stream/reattach machinery renders the re-eval progress with zero new stream code.
- Phase 136 (GATE-01) can consume `re_eval_run_id` + the proposal lifecycle status; the D-07 per-run rollup (Phase 134) stays stored untouched.

## Self-Check: PASSED

- FOUND: `backend/app/api/evals.py`
- FOUND: `backend/tests/test_promotion_gate.py`
- FOUND: `backend/tests/test_skill_proposals.py`
- FOUND commit: `fa367a38` (feat — routes + gate + reconcile)
- FOUND commit: `773d1d74` (test — promotion_gate math)
- FOUND commit: `553f9aab` (test — lifecycle)

---
*Phase: 135-self-improvement-loop-si-01*
*Completed: 2026-07-02*

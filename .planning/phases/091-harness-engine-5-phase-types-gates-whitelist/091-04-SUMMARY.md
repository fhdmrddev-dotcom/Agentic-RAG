---
phase: 091-harness-engine-5-phase-types-gates-whitelist
plan: 04
subsystem: harness-engine
tags: [harness, resumability, startup-sweep, ask-user, claim-cas, subscribe-before-emit, multi-worker]

# Dependency graph
requires:
  - phase: 091-harness-engine-5-phase-types-gates-whitelist
    plan: 02
    provides: claim_run CAS + run_workflow resume-aware load (idempotent skip of completed/skipped, re-run active from top) + load_run_phases keyed by workflow_run_id
  - phase: 091-harness-engine-5-phase-types-gates-whitelist
    plan: 03
    provides: _exec_llm_human_input stores tool_call_id in its output + durable ask_user_prompt row; ask_user subscribe->advertise->emit->block substrate
  - phase: 091-harness-engine-5-phase-types-gates-whitelist
    plan: 01
    provides: shared pytest fixtures (mock_asyncpg_pool UPDATE-order recorder, fake_redis pub/sub + events log)
provides:
  - "harness_engine.resume_stranded_workflows — startup sweep that CLAIMS each stranded run (CAS) then re-drives it via run_workflow; answered ask_user -> proceed, pending -> re-subscribe+re-emit"
  - "db/workflows.py — find_resumable_runs / get_active_phase / ask_user_response_exists / get_pending_ask_user (the /pending-style answered-vs-pending query, workflow_run_id-keyed)"
  - "ask_user_service.resume_pending_prompt — re-subscribe + re-sadd + re-emit (subscribe-before-emit, Pitfall 2) sharing _subscribe_and_block with the live handler"
affects: [096 EVAL-02 live kill-and-resume, 092 publish endpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Startup sweep claims each run before re-running (claim_run CAS) so WORKER_COUNT=2 never double-executes — rides the existing run_workflow machinery, no separate unclaimed re-run loop (the OQ6 anti-pattern avoided)"
    - "subscribe-before-emit on resume (Pitfall 2): _subscribe_and_block exposes an on_subscribed hook so resume_pending_prompt re-emits the pending prompt INSIDE the subscribed window — a fast answer can't be published into a no-subscriber gap"
    - "answered-vs-pending detection mirrors panel.py /pending raw query INVERTED: scan role='system' rows for an ask_user_response kind matched by tool_call_id; answered -> skip re-ask"
    - "single-sourced block primitive (_subscribe_and_block) shared by the live subscribe_for_response and resume_pending_prompt so the two can never drift (DRY)"
    - "all run-keyed workflow_phases reads use workflow_run_id (migration 058:16) — no bare run_id predicate (would raise Postgres 42703)"

key-files:
  created: []
  modified:
    - backend/app/db/workflows.py
    - backend/app/services/ask_user_service.py
    - backend/app/services/harness_engine.py
    - backend/app/main.py
    - backend/tests/test_harness_resume.py

key-decisions:
  - "resume_pending_prompt re-emits inside an on_subscribed hook of a shared _subscribe_and_block primitive (extracted from subscribe_for_response) — enforces subscribe-before-emit structurally AND keeps the block/cleanup logic single-sourced so resume can't drift from the live path"
  - "ask_user_response_exists scans role='system' rows the /pending way (NOT the Phase-086-filtered /snapshot path); the distinguishing key is tool_calls @> '[{kind: ask_user_response}]' matched by tool_calls->0->>'tool_call_id' (the exact runs.py /ask_user_response durable shape)"
  - "the sweep determines llm_human_input via the active-phase row's config.phase_type, falling back to a stored tool_call_id in the output (the Plan-03 executor stores it) — so the answered/pending branch only runs for genuine ask_user phases"
  - "resume wired into the FastAPI lifespan as a BACKGROUND task (asyncio.create_task) after pool+redis are ready — a slow resume never blocks startup; best-effort with logged failure"
  - "_load_run_definition joins workflow_runs.definition_id -> workflow_definitions.definition jsonb and model_validate()s it (the same shape the seed migration 056 ships) — the run's published definition is the dispatch source on resume"

requirements-completed: [HARNESS-03]

# Metrics
duration: 5min
completed: 2026-05-31
---

# Phase 091 Plan 04: Resumability (HARNESS-03) Summary

**Built the resumability surface — the trickiest correctness boundary in the phase: a startup sweep finds runs left `active` by a uvicorn restart, CLAIMS each one via the Plan-02 `claim_run` CAS so two workers never double-execute, and re-drives it through `run_workflow` (which idempotently skips completed phases and re-runs the active one from the top); a mid-`ask_user` phase resumes correctly — durably-answered prompts proceed without re-asking, still-pending prompts re-subscribe THEN re-emit (subscribe-before-emit, Pitfall 2) and block on the answer.**

## Performance
- **Duration:** ~5 min
- **Started:** 2026-05-31T05:49:54Z
- **Completed:** 2026-05-31T05:55:09Z
- **Tasks:** 3
- **Files modified:** 5 (0 created, 5 modified)

## Accomplishments
- **Task 1 — `db/workflows.py` resume queries (OQ2):** `find_resumable_runs` returns stranded runs anchored on the per-thread `threads.active_workflow_run_id = wr.id` with the `workflow_phases` EXISTS join keyed by `workflow_run_id` (NOT a bare `run_id` — Postgres 42703 guard); `get_active_phase` reads the single `status='active'` phase row run-keyed; `ask_user_response_exists` MIRRORS the panel.py `/pending` raw scan INVERTED — `role='system'` rows with `tool_calls @> '[{"kind": "ask_user_response"}]'` matched by `tool_call_id` (answered → True/skip; pending → False/re-ask); `get_pending_ask_user` returns the durable prompt's `tool_calls[0]` payload for re-emit. 4 live tests.
- **Task 2 — `ask_user_service.resume_pending_prompt` (subscribe-before-emit):** extracted a shared `_subscribe_and_block(redis, run_id, tool_call_id, timeout, *, on_subscribed=None)` primitive from the live `subscribe_for_response` body (so the SUBSCRIBE → SADD → block → cleanup logic is single-sourced and resume can't drift). `resume_pending_prompt` re-subscribes, re-sadds, then re-emits the `ask_user_prompt` event in the `on_subscribed` window (guaranteeing the re-emit happens AFTER the subscribe registers — Pitfall 2) WITHOUT re-inserting the durable prompt row (it already exists). `subscribe_for_response` now delegates to the shared primitive with externally-observable behavior unchanged (32 existing ask_user tests still green). 1 live test asserts subscribe-event-index < re-emit-XADD-index in the fake_redis unified log.
- **Task 3 — `harness_engine.resume_stranded_workflows` + lifespan wiring (OQ6 / Pitfall 7):** the sweep iterates `find_resumable_runs`, `claim_run`-CAS-claims each (loser worker skips — multi-worker safe), and for an `llm_human_input` active phase branches answered (proceed) vs pending (`resume_pending_prompt` then block) before re-driving via `_resume_run` → `run_workflow` (riding the existing engine machinery; the completion/failure path inside `run_workflow` already mirrors `_shielded_finalize`). `_load_run_definition` parses the run's published `WorkflowDefinition` from `workflow_definitions.definition`. Wired into the FastAPI lifespan as a non-blocking background task after pool+redis are ready. 3 live tests (sweep claims-before-runs + loser-skipped; answered-not-reasked).

## Task Commits
1. **Task 1: find_resumable_runs + ask_user answered-vs-pending queries** — `5d95f46d` (feat)
2. **Task 2: resume_pending_prompt — re-subscribe + re-sadd + re-emit (subscribe-before-emit)** — `be885f95` (feat)
3. **Task 3: resume_stranded_workflows startup sweep + lifespan wiring** — `420350e7` (feat)

## Files Created/Modified
- `backend/app/db/workflows.py` — `find_resumable_runs` / `get_active_phase` / `ask_user_response_exists` / `get_pending_ask_user` (4 new helpers, no bare run_id against workflow_phases)
- `backend/app/services/ask_user_service.py` — `_subscribe_and_block` shared primitive + `_emit_ask_user_prompt` + `resume_pending_prompt`; `subscribe_for_response` delegates to the primitive (behavior unchanged)
- `backend/app/services/harness_engine.py` — `resume_stranded_workflows` + `_resume_run` + `_load_run_definition` + `_build_resume_context` + `_is_llm_human_input` / `_active_tool_call_id` helpers; resume imports added
- `backend/app/main.py` — lifespan wiring (background `_resume_stranded` task after pool+redis ready)
- `backend/tests/test_harness_resume.py` — flipped 3 Wave-0 skips live + added 4 Task-1 DB-helper tests + 1 Task-2 resume test (10 tests total, 0 skips)

## Decisions Made
- **`resume_pending_prompt` re-emits inside `_subscribe_and_block`'s `on_subscribed` hook:** rather than re-emitting in `resume_pending_prompt` and hoping the ordering holds, the shared primitive runs the caller's user-visible signal INSIDE the subscribed window — making subscribe-before-emit a structural guarantee of the primitive, not a convention the caller must remember. The fake_redis test asserts `subscribe` event index < `ask_user_prompt` XADD event index.
- **answered-vs-pending uses the `/pending` raw scan style, not `/snapshot`:** Phase 086 filters `role='system'` rows out of `/snapshot`/`/messages`; the durable ask_user prompt/response rows are system rows, so the query scans them directly the way panel.py `/pending` does. The response row is distinguished by `kind='ask_user_response'` (vs `ask_user_prompt`) matched by `tool_call_id` — the exact shape runs.py `/ask_user_response` persists.
- **llm_human_input detection is config-first with a stored-tool_call_id fallback:** the active-phase row carries the phase config (`phase_type`); when present we branch on it, else fall back to a `tool_call_id` in the stored output (which the Plan-03 executor writes) — so the answered/pending branch only fires for genuine ask_user phases.
- **resume runs as a background lifespan task:** spawned via `asyncio.create_task` after pool+redis init so a slow sweep (many stranded runs, a blocked ask_user re-emit) never wedges uvicorn startup; failures are logged and the app continues.

## Deviations from Plan
None — plan executed exactly as written. No Rule 1-3 auto-fixes were required (the Plan-02 `claim_run`/`run_workflow` substrate and the Plan-03 ask_user `tool_call_id` storage composed cleanly on first run). The shared `_subscribe_and_block` extraction is the DRY refactor the plan explicitly requested ("prefer extracting a shared `_subscribe_and_block` helper called by BOTH the original handler and resume").

## Threat Model Compliance
- **T-091-20 (DoS/integrity — double-execution across workers):** mitigated. `resume_stranded_workflows` calls `claim_run` (CAS `UPDATE ... WHERE status IN ('active','paused') RETURNING`) BEFORE re-running; the loser worker's claim returns False and skips. Tested by `test_sweep_reruns_active_phase` (2-worker sim: won re-runs, lost skipped, claim precedes run).
- **T-091-21 (integrity — re-emit before re-subscribe / lost answer):** mitigated. `resume_pending_prompt` re-emits inside the `on_subscribed` window of `_subscribe_and_block` (subscribe → sadd → emit → block); answered prompts are detected first via `ask_user_response_exists` and never re-asked. Tested by `test_ask_user_pending_resubscribes_and_reemits` (subscribe index < emit index) + `test_ask_user_answered_not_reasked` (resume_pending_prompt NOT called).
- **T-091-22 (integrity — re-run double side-effects):** mitigated. `run_workflow` skips `completed`/`skipped` phases and re-runs the `active` one from the top; an active phase's output was never durable (2-phase write), so re-running is the correct resume point (an llm_agent re-run forks a fresh sub_run_id; the old partial orphans harmlessly — Pitfall 5).
- **T-091-23 (info disclosure — resume reads another user's run):** mitigated. `find_resumable_runs` joins through `threads` (owner FK) and the `workflow_phases` EXISTS join is keyed by `workflow_run_id`; the engine never resumes a run outside the owning thread.

## Cross-Provider Safety
Zero edits to any `*_service.py` provider streaming branch or `agent_loop.py`. The resume path re-drives `run_workflow` (which dispatches via the existing `PHASE_TYPE_REGISTRY` executors — already cross-provider-safe) and re-uses the ask_user pub/sub substrate unchanged. All four providers inherit the existing machinery on resume.

## Verification
- `pytest tests/test_harness_resume.py -q` → **10 passed, 0 skipped** (all HARNESS-03 contracts now live — the 3 previously-skipped sweep/ask_user contracts flipped + 4 Task-1 helper + 1 Task-2 resume tests added).
- `pytest tests/test_harness_engine.py tests/test_harness_resume.py tests/test_harness_reachability.py tests/test_harness_whitelist.py tests/test_tool_budget.py tests/unit/test_085_task_service.py -q` → **91 passed, 0 skipped** — no collateral breakage.
- `pytest -k "ask_user or subscribe_for_response"` → **32 passed** (the `_subscribe_and_block` refactor preserved `subscribe_for_response` behavior).
- Import smoke (plan verification): `from app.services.harness_engine import resume_stranded_workflows; from app.services.ask_user_service import resume_pending_prompt; from app.db.workflows import find_resumable_runs, ask_user_response_exists` → **ok**.
- `import app.main` → **ok** (lifespan wiring imports cleanly).
- `grep -nE "workflow_phases[^;]*[^_]run_id" app/db/workflows.py` → **CLEAN** (no bare run_id predicate; the 42703 guard holds).

## TDD Gate Compliance
This plan is `type: execute` (not a plan-level `type: tdd` gate). Each task flipped its Wave-0 skeleton contracts to live tests in the same `feat` commit as the implementation (the Wave-0 skeletons + new tests were the RED; the implementation makes them GREEN). Per-task verification gates passed before each commit.

## User Setup Required
None — no migrations, no schema changes, no external service config. This plan operates over the Phase 090 tables (already live in the DB).

## Next Phase Readiness
- **Phase 096 (EVAL-02):** owns the LIVE kill-and-resume proof (real uvicorn restart + cross-worker). This plan provides the deterministic UNIT proof (claimed re-run, no double side-effect, completed phase skipped, subscribe-before-emit ordering, answered-not-reasked). The `resume_stranded_workflows` entry + lifespan wiring are the surface 096 exercises under a real kill.
- **Phase 092 (publish endpoint):** unaffected; the resume sweep reads whatever `workflow_runs` exist.

## Self-Check: PASSED
- All 5 modified files verified on disk.
- All 3 task commits (`5d95f46d`, `be885f95`, `420350e7`) present in git history.
- No accidental file deletions in any commit.

---
*Phase: 091-harness-engine-5-phase-types-gates-whitelist*
*Completed: 2026-05-31*

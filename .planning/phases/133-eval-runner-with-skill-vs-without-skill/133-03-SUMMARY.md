---
phase: 133-eval-runner-with-skill-vs-without-skill
plan: 03
subsystem: eval-runner / agent-loop-consumer
tags: [eval, EVAL-02, agent-loop, background-job, no-op-emit, redis, run_in_threadpool, TDD]
requires:
  - "RunContext.skill_catalog_override — additive default-off A/B catalog field (Plan 02)"
  - "public.eval_runs + public.eval_results tables + Pydantic models (Plan 01, migration 080)"
  - "run_agent_loop / AgentLoopResult (agent_loop.py); finalize_run (db/runs.py)"
provides:
  - "eval_runner_service.run_eval_job — bounded background eval job driving 2xN agent-loop completions, persisting per-arm eval_results, emitting eval_* progress, finalizing the companion runs row"
affects:
  - "backend/app/services/ (net-new service module — no existing file mutated)"
tech-stack:
  added: []
  patterns:
    - "NO-OP emit on the inner run_agent_loop so its done/error terminals never reach the shared eval buffer (Pattern 2 / T-133-07)"
    - "Outcome from AgentLoopResult return value, not the stream (full_content_final + token totals)"
    - "Tuner bounded-job envelope: try/except->terminal + finally->CAS-release+ZREM (skill_tuner._run_tuner_job precedent)"
    - "One ephemeral eval thread per run, sequential arms, clean single-turn isolation per case (Pattern 4)"
    - "Every supabase-py call wrapped in run_in_threadpool (D-v2.5-01) — not the skill_test_cases inline-sync tech-debt"
key-files:
  created:
    - "backend/app/services/eval_runner_service.py"
    - "backend/tests/test_eval_runner.py"
  modified: []
decisions:
  - "D-03/D-10: WITH arm sources name/description from the skill_version SNAPSHOT passed in, NOT the live skills row — version-pinned traceability"
  - "D-04: WITHOUT arm injects skill_catalog_override=() (empty catalog)"
  - "D-05: emit per-case/per-variant status events (eval_case_started/eval_case_done/eval_complete), NOT token-by-token"
  - "D-06: per-arm exception records status=failed/timed_out + <=200char error and the job continues — partials stay readable"
  - "D-01/V5: provider validated from model via get_model_capability; unknown model rejected with a terminal error before any completion"
metrics:
  duration: ~20 min
  completed: 2026-06-30
  tasks: 2
  files: 2
---

# Phase 133 Plan 03: Eval Runner Engine Summary

The EVAL-02 engine: a bounded background job that drives the SHARED agent loop twice per owner-scoped test case (WITH = target-skill-only catalog from the version snapshot, WITHOUT = empty catalog), persists an `eval_results` row the instant each arm finishes, and emits additive `eval_*` progress over the shared `run:{run_id}` buffer — with a NO-OP emit so the inner loop's own `done`/`error` terminals never corrupt the eval stream.

## What Shipped

- **`backend/app/services/eval_runner_service.py`** — `run_eval_job(*, run_id, skill_id, skill_version, cases, provider, model, current_user, user_settings, redis, supabase, pool)`:
  - **NO-OP emit (the load-bearing point, T-133-07):** the inner `run_agent_loop(ctx, emit=_noop, emit_terminal=_noop, spawn=_spawn)` is driven with no-op emit/emit_terminal so the loop's own `done`/`error` (both `TERMINAL_TYPES`) never reach `run:{run_id}` — a real emit would break `replay_tail_consumer` on completion #1. The completion text + token totals are read from the RETURN value (`AgentLoopResult.full_content_final` / `input_tokens_total` / `output_tokens_total`), never the stream.
  - **Honest A/B (D-03/D-04/D-10):** the WITH arm injects `skill_catalog_override=({"name": <snapshot name>, "description": <snapshot description>},)` sourced from the `skill_version` SNAPSHOT passed in (NOT the live skills row); the WITHOUT arm injects `skill_catalog_override=()`. Both ride Plan 02's additive default-off field.
  - **Per-case isolation (Pattern 4):** one ephemeral eval thread per run; for each case the thread is reset (delete prior messages → insert only this prompt) so case i+1 never sees case i and both arms read the same single prompt. Sequential arms (D-01 single-provider — concurrency would hit the same rate-limit bucket).
  - **Per-arm failure handling (D-06):** each completion is wrapped in try/except — `asyncio.TimeoutError` → `status=timed_out`, any other exception → `status=failed`, both with a `<=200`-char truncated error (T-133-04); the row is still persisted and the job continues.
  - **Progress vocabulary (D-05):** `eval_case_started` / `eval_case_done` per arm, one `eval_complete`, then the single closing terminal (`done`/`error`).
  - **State discipline:** every supabase-py call wrapped in `run_in_threadpool`; owner-stamped writes (`user_id` from `current_user`, `.eq("user_id", …)` on the eval_runs update); provider validated from `model` via `get_model_capability` (unknown → terminal error). Finally block: `finalize_run` closes the companion `runs` row, CAS-releases the `eval_inflight:{skill_id}` claim, and ZREMs the active sorted sets. `_spawn` defined locally to avoid a threads↔services import cycle.
- **`backend/tests/test_eval_runner.py`** (TDD RED→GREEN) — `_FakeRedis` + recording `_FakeSupabase` + a patched `run_agent_loop` returning a fake `AgentLoopResult` (no live LLM / no live DB):
  - `test_two_results_per_case` (SC#1): 2 cases → exactly 4 `eval_results` (with_skill + without_skill each), owner-stamped + provider-keyed; the WITH arm's captured override carries the version-snapshot name/description, the WITHOUT arm's is `()`; `finalize_run` ran (`pool.execute` awaited).
  - `test_sse_vocabulary` (SC#2): the buffer carries ordered `eval_*` events with `eval_complete` last; the test deliberately drives the handed emit/emit_terminal with a fake `done` and asserts NO terminal leaks before `eval_complete` — proving the NO-OP emit swallows the inner loop's terminals; exactly one `done` terminal closes the run.

## Tasks & Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | RED — eval-runner service tests (two-results-per-case + sse-vocabulary) | `e228afb7` |
| 2 | GREEN — eval_runner_service.run_eval_job bounded background job | `ff8ba4c6` |

## Verification

- RED confirmed: `from app.services import eval_runner_service` → `ImportError` before Task 2 (both tests failed).
- GREEN: `pytest tests/test_eval_runner.py -k "two_results_per_case or sse_vocabulary" -x` → **2 passed**.
- Acceptance greps on `eval_runner_service.py`: `run_agent_loop`=5 (≥1), `skill_catalog_override`=5 (≥2 — both arms), `run_in_threadpool`=8 (≥1), `result.persist|_shielded_finalize`=0 (==0), `_noop|lambda`=2 (≥1), `finalize_run`=4 (≥1).

## Deviations from Plan

**1. [Rule 3 — Blocking issue] Test-file path / harness-source paths corrected**
- **Found during:** Task 1.
- **Issue:** The plan's `read_first` cited `backend/tests/test_skill_tuner_routes.py` and `backend/tests/test_132_test_cases.py`, but those files live under `backend/tests/integration/`. The plan's `files_modified` + acceptance command both use `backend/tests/test_eval_runner.py`.
- **Fix:** Read the harness precedents from their real `tests/integration/` locations (`_FakeRedis`, `_build_mock_supabase`, OWNER/OTHER_USER dicts) and created the new test file at the plan-specified path `backend/tests/test_eval_runner.py`. No behavior impact — the file is self-contained (copies `_FakeRedis` + a tailored recording `_FakeSupabase` rather than importing the integration helpers).
- **Files modified:** `backend/tests/test_eval_runner.py`.
- **Commit:** `e228afb7`.

Otherwise executed as written (TDD RED→GREEN, NO-OP emit, version-snapshot WITH arm, empty WITHOUT arm, per-arm failure handling, run_in_threadpool discipline, finalize_run companion close).

## Threat Surface

No new threat surface beyond the plan's `<threat_model>`. All five `mitigate` dispositions are honored: T-133-02 (bounded — single provider/run, cancel checkpoints, model validation), T-133-04 (every error truncated `<=200` chars), T-133-03 (user_id from `current_user`; version snapshot owner-scoped upstream), T-133-07 (NO-OP emit isolates the inner loop's terminals — proven by `test_sse_vocabulary`). T-133-SC (no package installs) holds.

## Known Stubs

None. The engine is fully wired against the Plan 01 tables + Plan 02 field. The POST/stream/results ROUTER (which mints `run_id`, takes the in-flight `SET NX` claim, inserts the companion `runs` row, fetches the owner-scoped latest version snapshot + cases, and spawns this job) lands in Plan 04 — this service exposes the exact `run_eval_job` entrypoint that router will call.

## Self-Check: PASSED

- FOUND: `backend/app/services/eval_runner_service.py`
- FOUND: `backend/tests/test_eval_runner.py`
- FOUND commit: `e228afb7` (test RED)
- FOUND commit: `ff8ba4c6` (feat GREEN)

---
phase: 133-eval-runner-with-skill-vs-without-skill
plan: 04
subsystem: eval-runner / control-surface
tags: [eval, EVAL-02, router, owner-scoped, companion-runs-row, reattach, cancel, redis, run_in_threadpool]
requires:
  - "eval_runner_service.run_eval_job — bounded background eval job (Plan 03)"
  - "public.eval_runs + public.eval_results tables (Plan 01, migration 080)"
  - "skill_versions + skill_test_cases (Phase 132, migration 079)"
  - "db/runs.py insert_run; runs.py GET /runs/{id}/stream + DELETE /runs/{id}; replay_tail_consumer"
provides:
  - "evals.router — POST /skills/{id}/evals/runs kickoff (202, non-blocking), GET results (durable DB readout), GET list (owner-scoped newest-first)"
  - "companion public.runs row keyed by the eval run_id so reattach + cancel reuse the chat-run machinery verbatim (Pattern 3)"
affects:
  - "backend/app/api/ (net-new router — no G-5 hot file mutated)"
  - "backend/app/main.py (one import + one include_router line)"
tech-stack:
  added: []
  patterns:
    - "One run_id = eval_runs.id = public.runs.run_id = run:{run_id} buffer key (Pattern 3 — reattach/cancel for free, zero new frontend stream code)"
    - "Atomic Redis SET NX in-flight claim (one eval per skill -> 409); CAS-release on pre-spawn failure"
    - "Owner-scoping is the SOLE gate: .eq(user_id) on every read/launch; 404-not-403 on cross-user miss; user_id from current_user never body"
    - "Model validation via get_model_capability -> capability_source == 'registry' (reject unknown; provider must agree)"
    - "Every supabase-py call wrapped in run_in_threadpool (D-v2.5-01); RUN_TASKS[run_id] registered for DELETE-cancel parity"
key-files:
  created:
    - "backend/app/api/evals.py"
  modified:
    - "backend/app/main.py"
    - "backend/tests/test_eval_runner.py"
decisions:
  - "D-06: POST returns {run_id} immediately (202) after inserting eval_runs + companion runs row + spawning the job — never blocks on the run"
  - "Pattern 3: a companion public.runs row (same UUID) is inserted so GET /runs/{id}/stream + DELETE /runs/{id} (runs.py) owner-check and serve the eval run unchanged — NO bespoke stream/cancel route in evals.py"
  - "D-01/V5: only a registry-known model is accepted; an inferred/unknown model 400s before any provider call"
  - "list_eval_runs owner-verifies the skill FIRST so a cross-user caller 404s (never silently returns []) — uniform 404 leak-safety across all three routes"
  - "The router creates one ephemeral eval thread to satisfy the companion runs row's NOT-NULL FK thread_id; the Plan-03 job creates its OWN working thread for the agent-loop completions"
metrics:
  duration: ~35 min
  completed: 2026-06-30
  tasks: 2
  files: 3
---

# Phase 133 Plan 04: Eval Runner Control Surface Summary

The EVAL-02 launch + readout API: an owner-scoped router (modeled on `skill_tuner.py`, touching no G-5 hot file) whose POST mints ONE `run_id` that doubles as `eval_runs.id`, the companion `public.runs.run_id`, and the `run:{run_id}` Redis buffer key — so the existing chat-run machinery (`getActiveRuns` / `subscribeToRun` / `GET /runs/{id}/stream` / `DELETE /runs/{id}`) reattaches and cancels an eval run with zero new frontend stream code (RESEARCH Pattern 3). GET endpoints expose the durable DB readout that survives the Redis buffer TTL.

## What Shipped

- **`backend/app/api/evals.py`** — `router = APIRouter(prefix="/skills", tags=["skill-evals"])`:
  - **POST `/skills/{skill_id}/evals/runs`** (202, non-blocking — D-06): owner-verify the skill (owned-only, 404 cross-user) → validate `body.model` against the registry (`get_model_capability` → `capability_source == "registry"`; provider must agree — D-01/V5) → resolve the LATEST owner-scoped `skill_versions` snapshot (max `version_number`, pinned for the WITH arm — D-03/D-10) → read owner-scoped `skill_test_cases` (reject zero — T-133-02) → mint `run_id` → atomic `SET NX` `eval_inflight:{skill_id}` claim (409 on contention) → create one ephemeral eval thread → insert the `eval_runs` row → insert the **companion `public.runs` row** via `insert_run` keyed by the SAME `run_id` (Pattern 3) → ZADD `runs:active` + `runs_by_thread:eval:{skill_id}` → load the caller's settings → spawn `run_eval_job` via `asyncio.create_task`, register `RUN_TASKS[run_id]` (DELETE-cancel parity) → return `{run_id}` immediately. A pre-spawn failure CAS-releases the claim so a transient error can't wedge the skill.
  - **GET `/skills/{skill_id}/evals/runs/{run_id}`**: the DURABLE readout — reads `eval_runs` + `eval_results` from Postgres (owner-scoped on both), so it stays readable AFTER the Redis buffer TTL-expires (SC#3). 404 on a cross-user miss.
  - **GET `/skills/{skill_id}/evals/runs`**: owner-verify the skill FIRST (404 cross-user), then list owner-scoped runs newest-first.
  - **No bespoke stream/cancel route** — `GET /runs/{id}/stream` + `DELETE /runs/{id}` (runs.py) are reused verbatim; the companion runs row's `(run_id, user_id)` owner-check (runs.py) covers them.
  - Every supabase-py call wrapped in `run_in_threadpool` (D-v2.5-01); `user_id`/`skill_id` from the caller + path, never the body (T-133-03); errors never leak (404-not-403 throughout).
- **`backend/app/main.py`** — `evals` appended to the `from app.api import (...)` tuple + `app.include_router(evals.router)` after `skill_test_cases.router`.
- **`backend/tests/test_eval_runner.py`** — three route/integration tests (plus `_FakeRedis` gains `xread`/`exists`, and a filtering `_FilterSupabase` that honors `.eq()` owner-scoping):
  - `test_results_persist_after_buffer_expiry` (SC#3): with `run:{run_id}` absent from Redis, GET results still returns all 4 `eval_results` from the DB.
  - `test_reattach_via_runs_row` (SC#3): the companion `public.runs` row makes `GET /runs/{run_id}/stream?since=0` owner-check pass and replay the buffered `eval_*` events (proving the reused stream path).
  - `test_cross_user_404` (SC#4): OTHER_USER gets 404 (never 403) on POST / GET-results / GET-list.

## Tasks & Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | evals.py router + companion runs row + main.py mount | `0dabb3eb` |
| 2 | integration tests — persist-after-expiry, reattach, cross-user 404 | `7be9b066` |

## Verification

- Task 1 automated: `python -c "from app.main import app; ... '/evals/runs' in p"` → **mounted**.
- Task 1 acceptance greps: `insert_run`=2 (≥1), `get_model_capability`=3 (≥1), `evals.router`=1 (≥1, main.py), 404 markers=4 (≥1), bespoke `EventSourceResponse|@router.delete`=0 (==0 — stream/cancel reused).
- Task 2 automated: `pytest tests/test_eval_runner.py -x` → **5 passed** (two_results_per_case, sse_vocabulary, results_persist_after_buffer_expiry, reattach_via_runs_row, cross_user_404).

## Deviations from Plan

**1. [Rule 2 — Missing critical functionality] `list_eval_runs` owner-verifies the skill first**
- **Found during:** Task 2 (writing `test_cross_user_404`).
- **Issue:** The plan's acceptance criterion requires all THREE eval routes to 404 for OTHER_USER, but a plain owner-scoped list naturally returns an empty `[]` (200) for a cross-user caller — leaking nothing but failing the uniform 404 contract (must_haves truth #4: every route 404s on a cross-user miss).
- **Fix:** Added `await _verify_owned_skill(...)` at the top of `list_eval_runs` so a non-owner 404s (never even probes the skill's existence) — consistent with the POST gate.
- **Files modified:** `backend/app/api/evals.py`.
- **Commit:** `7be9b066`.

**2. [Rule 3 — Blocking issue] Router creates its own ephemeral eval thread for the companion runs row**
- **Found during:** Task 1.
- **Issue:** `public.runs.thread_id` is NOT NULL with an FK to `threads(id)`, so the companion runs row needs a valid thread_id at `insert_run` time — but the Plan-03 `run_eval_job` creates its OWN eval thread INTERNALLY (after spawn) and its signature (frozen — not in this plan's `files_modified`) does not accept a thread_id.
- **Fix:** The router creates one ephemeral eval thread (`[eval] skill A/B run`) purely to anchor the companion runs row; the job's own thread carries the agent-loop completions. Two threads per run — harmless (the companion row only needs a valid FK target so the reused stream/cancel owner-check works); the reattach UX keys on `run_id`, not the thread.
- **Files modified:** `backend/app/api/evals.py`.
- **Commit:** `0dabb3eb`.

Otherwise executed as written (POST kickoff with SET NX claim + companion runs row + spawn, GET durable readout + list, no bespoke stream/cancel route, model validation, owner-scoping with 404-not-403, run_in_threadpool discipline).

## Threat Surface

No new threat surface beyond the plan's `<threat_model>`. All five `mitigate` dispositions are honored: T-133-01 (every route `.eq(user_id)` + 404-not-403; companion runs row 404s cross-user in runs.py — proven by `test_cross_user_404`), T-133-03 (`user_id`/`skill_id` from `current_user`+path, never the body; `skill_version_id` resolved owner-scoped), T-133-02 (atomic `SET NX` one-eval-per-skill claim → 409; zero-case runs rejected), T-133-08 (model validated against the registry; unknown → 400). T-133-SC (no package installs) holds.

## Known Stubs

None. The router is fully wired against the Plan 01 tables, the Plan 02 catalog-override field (via the Plan 03 engine), and the Phase 132 version/case tables. The reused `GET /runs/{id}/stream` + `DELETE /runs/{id}` require no eval-specific code (Pattern 3).

## Self-Check: PASSED

- FOUND: `backend/app/api/evals.py`
- FOUND: `backend/tests/test_eval_runner.py`
- FOUND: `backend/app/main.py` mount (`evals.router`)
- FOUND commit: `0dabb3eb` (feat — router + mount)
- FOUND commit: `7be9b066` (test — integration tests)

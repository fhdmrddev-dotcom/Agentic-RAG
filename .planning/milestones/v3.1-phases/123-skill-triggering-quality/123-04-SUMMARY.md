---
phase: 123-skill-triggering-quality
plan: 04
subsystem: api
tags: [skills, trigger-tuning, background-job, run-buffer, sse, owner-scoping, bounded-run, redis]

# Dependency graph
requires:
  - phase: 123-03 skill_tuner_service core
    provides: "build_candidates / classify_fires / split_held_out / build_cell / cell_score / pick_winner / configured_targets / fetch_owner_scoped_siblings / auto_seed_cases / resolve_skill_builder_model"
  - phase: 061+ run-buffer transport
    provides: "run:{id} stream + runs_by_thread + runs:active + replay_tail_consumer SSE consumer"
provides:
  - "backend/app/api/skill_tuner.py — owner-scoped APIRouter(prefix='/skills') with POST .../tuner/runs (bounded background job kickoff), GET .../tuner/runs/{id}/stream (tuner_* SSE), GET .../tuner/runs/{id} (held-out scoreboard)"
  - "Tuner-specific SSE event vocabulary (tuner_progress / tuner_provider_done / tuner_complete) on the shared run-buffer transport — never overloads chat event types"
  - "Bounded background tuner run: MAX_CASES=40 / MAX_TARGETS=8 / MAX_ITERATIONS=5 / per-call timeout / one job per skill"
affects: [123-05 Tuner UI scoreboard (consumes the start/stream/results contract + the cell shape), 123-06 inline lint + Tune-this handoff]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Net-new owner-scoped router mirroring document_governance.py: service-role get_supabase() + app-code .or_(own,global) scoping is the SOLE leak gate; 404 (never 403) on a cross-user miss"
    - "Background job kickoff over the Phase-061+ run-buffer (ZADD runs:active + a per-skill sorted set) returning a run id immediately (non-blocking, D-06) via asyncio.create_task"
    - "Tuner-specific SSE event vocab on the run:{id} stream + a single terminal done/error sentinel so the SHARED replay_tail_consumer breaks cleanly (Open-Q4 — chat event types never reused)"
    - "Bounded run on every axis (capped cases/targets/iterations + per-call get_per_call_timeout + one job per skill) — DoS guard, no unbounded LLM fan-out"
    - "run_in_threadpool wrapping every blocking supabase-py call inside the async handlers (D-v2.5-01)"
    - "Classifier catalog line mirrors the production firing surface ('- **{name}**: {description}') so the Tuner measures the REAL load_skill policy (Pitfall 1 fidelity)"

key-files:
  created:
    - backend/app/api/skill_tuner.py
    - backend/tests/integration/test_skill_tuner_routes.py
  modified:
    - backend/app/main.py

key-decisions:
  - "A tuner run is NOT anchored to a chat thread, so the per-skill sorted set runs_by_thread:tuner:{skill_id} carries it (alongside runs:active) — NOT a chat thread's runs_by_thread:{thread_id}; the run-buffer keys stay disjoint from chat runs."
  - "The benchmark cases + the final scoreboard are EPHEMERAL/client-held (A2 / Open-Q5) — no DB schema change. The scoreboard is stashed at the run-buffer key tuner_result:{run_id} with a TTL so GET results can return it; only the winning description persists later via the owner-scoped PATCH (Plan 05)."
  - "The CURRENT description is always prepended as a baseline candidate so the run produces a comparison even when the builder honest-fails; the candidate set is de-duped and capped at MAX_ITERATIONS (<=5)."
  - "Winner is picked by HELD-OUT score (split_held_out -> classify only the held-out cases) per the Plan-03 contract; 3 repeats per (target, case) aggregated by majority-fired."
  - "tuner_complete is a NON-terminal progress event carrying the scoreboard; the run is closed with a separate terminal 'done' (or 'error') sentinel so the shared replay_tail_consumer (which breaks on threads.TERMINAL_TYPES) terminates cleanly without adding a new terminal type."

requirements-completed: [TRIG-01]

# Metrics
duration: 8min
completed: 2026-06-23
---

# Phase 123 Plan 04: Skill Trigger Tuner — Background Job + Routes Summary

**Wraps the Plan-03 service in the network surface: a net-new owner-scoped `skill_tuner.py` router (start/stream/results) that kicks off a BOUNDED background tuning run over the Phase-061+ Redis run-buffer, streams tuner-specific SSE progress, and returns the held-out scoreboard — service-role-client owner-scoping is the sole leak gate, the run is capped on every axis, and chat event types are never overloaded.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-23T18:07:02Z
- **Completed:** 2026-06-23T18:15:04Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- **The owner-scoped tuner router (Task 1):** `backend/app/api/skill_tuner.py` — `APIRouter(prefix="/skills", tags=["skill-tuner"])` with three routes:
  - `POST /skills/{skill_id}/tuner/runs` — owner-verifies the skill (`.or_(user_id.eq, is_global.eq.true)`, 404 on cross-user/not-global), bounds the inputs (default to `configured_targets(settings)` + owner-scoped `auto_seed_cases`; cap at `MAX_TARGETS`/`MAX_CASES`), ZADDs the run-buffer, spawns the bounded background job via `asyncio.create_task`, and returns the `run_id` IMMEDIATELY (202, non-blocking — D-06).
  - `GET /skills/{skill_id}/tuner/runs/{run_id}/stream` — owner-verify, then `EventSourceResponse` over the SHARED `replay_tail_consumer(redis, run_id, since, settings)` from `runs.py` (reuse, no fork).
  - `GET /skills/{skill_id}/tuner/runs/{run_id}` — owner-verify, return the held-out scoreboard (per-provider cells carrying BOTH `fires`/`no_false` sub-scores + candidate descriptions + winner) read from the ephemeral `tuner_result:{run_id}` run-buffer key.
- **The bounded background run (`_run_tuner_job`):** for each candidate × target × held-out case × 3 repeats, calls ONLY the Plan-03 service functions (thin orchestration over `forced_emit` — D-14 red line held), scores with the pure 60/40 held-out math, and emits `tuner_progress`/`tuner_provider_done`/`tuner_complete` events on `run:{id}`. Bounded on every axis: `MAX_CASES=40`, `MAX_TARGETS=8`, `MAX_ITERATIONS=5`, each provider call wrapped with `get_per_call_timeout(model)`, and exactly ONE in-flight job per skill (`_INFLIGHT_SKILLS` guard → 409 on a duplicate concurrent start).
- **Registered in `main.py`** (`app.include_router(skill_tuner.router)`); all three routes resolve under `/skills/{skill_id}/tuner/...`.
- **Integration coverage (Task 2):** `test_skill_tuner_routes.py` — 6 tests, all GREEN without a live LLM (Plan-03 service mocked) or live Redis (in-memory fake): owner start returns a run id + ZADDs the run-buffer; cross-user start AND results both 404 (the load-bearing leak gate); results carry BOTH `fires`+`no_false` per cell; the target list is capped (no unbounded fan-out); a duplicate concurrent run 409s.

## Task Commits

1. **Task 1: owner-scoped tuner router (start/stream/results) + main.py registration** — `05ea5fea` (feat)
2. **Task 2: tuner route integration coverage** — `c65d06fc` (test)

**Plan metadata:** (final docs commit — this SUMMARY, STATE.md, ROADMAP.md, REQUIREMENTS.md, deferred-items.md)

## Files Created/Modified

- `backend/app/api/skill_tuner.py` (created) — the owner-scoped router + the bounded `_run_tuner_job` background task + the tuner-specific emit helpers.
- `backend/app/main.py` (modified) — import + `app.include_router(skill_tuner.router)` (Phase 123 TRIG-01 comment).
- `backend/tests/integration/test_skill_tuner_routes.py` (created) — owner-scope / cross-user-404 / non-blocking-start+ZADD / both-sub-scores / bounded-target-cap / one-job-per-skill coverage (6 tests).

## Decisions Made

- **Run-buffer key for an un-threaded run:** a tuner run has no chat thread, so it ZADDs `runs_by_thread:tuner:{skill_id}` (+ `runs:active`) instead of a chat thread's `runs_by_thread:{thread_id}`. This keeps tuner runs cleanly separable from chat runs at cleanup time.
- **Ephemeral scoreboard, no schema change:** cases are client-held (A2/Open-Q5); the final scoreboard is stashed at the TTL-bound `tuner_result:{run_id}` run-buffer key for GET results to read. Only the winning description persists later via the owner-scoped PATCH (Plan 05). Zero DB migration, zero new package.
- **Baseline candidate:** the current description is always prepended as candidate index 0 so the scoreboard shows a real before/after comparison even when the builder honest-fails to `[]`.
- **`tuner_complete` is progress, `done` is terminal:** rather than add a new entry to `threads.TERMINAL_TYPES`, the job emits the scoreboard-carrying `tuner_complete` progress event and then a standard `done` sentinel, so the shared `replay_tail_consumer` breaks without any change to the runs module (red-line / reuse discipline).
- **Classifier catalog fidelity (Pitfall 1):** the background task builds the classifier `catalog_lines` as `- **{name}**: {description}` — byte-for-byte the shape `agent_loop.py` injects — so the Tuner measures the REAL production firing surface.

## Deviations from Plan

None — plan executed exactly as written. No bugs, no missing-critical functionality, no blocking issues, no architectural changes. No packages installed. No schema migration.

(One implementation choice worth noting, not a deviation: the plan's acceptance grep gate counts `tuner/runs` ≥ 2 and the tuner-event set ≥ 3; the shipped router has 6 `tuner/runs` route/path references and 4 tuner-event references. The bounded-run integration test asserts the cap via BOTH the route's capped response AND the background job's received target list, with an event-loop yield so the fire-and-forget `asyncio.create_task` job is observed before asserting.)

## Threat Surface

All four trust boundaries from the plan's `<threat_model>` are mitigated in the shipped code:

- **T-123-04-01 (cross-user start/stream/read):** every route calls `_fetch_owned_or_global_skill` (the `.eq("id", skill_id).or_(user_id.eq, is_global.eq.true)` owner-scope read) BEFORE doing anything; a miss raises 404 (never 403 — no existence leak). `get_supabase()` is service-role, so this app-code scoping is the SOLE gate. Proven NON-VACUOUS by `test_start_cross_user_returns_404` + `test_get_results_cross_user_returns_404`.
- **T-123-04-02 (DoS / unbounded fan-out):** the run is capped on every axis — `MAX_CASES`/`MAX_TARGETS`/`MAX_ITERATIONS(<=5)`, a per-call `get_per_call_timeout` deadline (`asyncio.wait_for`) on EVERY provider call, and one job per skill (`_INFLIGHT_SKILLS` → 409). Proven by `test_start_caps_targets_no_unbounded_fanout` + `test_duplicate_concurrent_run_returns_409`.
- **T-123-04-03 (chat-event overload):** the router emits ONLY `tuner_progress`/`tuner_provider_done`/`tuner_complete` (+ the generic `done`/`error` terminal sentinel); a grep confirms no chat event types (`delta`/`tool_start`/`tool_result`/`tool_args_progress`/`code_so_far`/...) are emitted by this module.
- **T-123-04-04 (cross-user run state):** the run-buffer key carries only this run's progress + scoreboard; cases are client-held; only the winning description persists later via the owner-scoped PATCH. No other user's data ever lands in `run:{id}` or `tuner_result:{id}`.

No new security surface introduced beyond the plan's threat model. No threat flags.

## Issues Encountered

- `test_062_stream_replay.py::test_replay_then_tail_to_terminal` fails with an `asyncpg.ForeignKeyViolationError` (inserting a `runs` row whose `thread_id` is not seeded in the live `threads` table). **Verified NOT caused by this plan** — it is a live-infra/UAT-class test that drives the full `POST /threads/{id}/messages` → `GET /runs/{id}/stream` flow against a REAL Redis (`localhost:6379`) + asyncpg pool and needs the local Supabase stack with seeded data. Plan 04 only ADDS `skill_tuner.py` (which imports the unmodified module-level `replay_tail_consumer`) + a `main.py` registration; the import resolved cleanly and the other 31 tests in the same run (incl. `test_062_cross_user_404.py` and the three Plan-03 service suites) passed. Logged to `deferred-items.md` per the scope boundary; NOT fixed (requires live infra, not a code defect). **Net-new failures vs base: 0.**

## User Setup Required

None — no external service configuration, no schema migration, no new packages. The tuner runs over the existing local Redis run-buffer; the `skill_builder_model` setting (Plan 03) defaults to a strong registry model when unset.

## Next Phase Readiness

- **Plan 05** (Tuner UI scoreboard) can drive the full contract: `POST /skills/{id}/tuner/runs` to start, `GET /skills/{id}/tuner/runs/{id}/stream` for live `tuner_*` SSE progress (the `LiveRunCard`), and `GET /skills/{id}/tuner/runs/{id}` for the held-out scoreboard. The per-provider cell shape (`{provider, model, axes: {fires, no_false}, score}`) is the `ProviderScoreboard` render input (042-A — both sub-scores present).
- **Plan 06** (inline lint + "Tune this" handoff) navigates into the tuner surface with a `skillId`; the start route accepts client-held cases/targets so the UI can supply edited cases.
- **SC#10 cross-provider UAT** (the D-01 firing-policy fidelity + no-false-fire rail) remains the MANDATORY dev gate authored in `123-VALIDATION.md`, exercised at phase verification with the local stack up — including a live full-loop spot-check that the classifier measures the same policy production fires (Pitfall 1).

## Self-Check: PASSED

- Both created files (`backend/app/api/skill_tuner.py`, `backend/tests/integration/test_skill_tuner_routes.py`) + the modified `main.py` + this SUMMARY exist on disk.
- Both task commits present in git history (`05ea5fea`, `c65d06fc`).
- All 6 tuner route tests GREEN; all Task 1 acceptance grep gates pass; the three routes resolve under `/skills/{skill_id}/tuner/...`; net-new regression failures vs base: 0.

---
*Phase: 123-skill-triggering-quality*
*Completed: 2026-06-23*

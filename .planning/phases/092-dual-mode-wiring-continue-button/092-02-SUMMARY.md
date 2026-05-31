---
phase: 092-dual-mode-wiring-continue-button
plan: 02
subsystem: api
tags: [fastapi, asyncpg, harness, workflow-runs, dual-mode, pydantic, rls, mode-lock]

# Dependency graph
requires:
  - phase: 091-harness-engine-5-phase-types-gates-whitelist
    provides: harness engine (run_workflow), _load_run_definition, _build_resume_context ctx shape, db/workflows.py helpers, conftest fixtures (mock_asyncpg_pool, fake_redis, build_workflow_definition, make_run_context)
  - phase: 092-01 (Wave 1)
    provides: migration 063 (workflow_runs.inputs/model/continues_used, runs.continues_used, cap_paused status), Wave-0 contract scaffolds in test_dual_mode_wiring.py / test_thread_workflow_endpoint.py
provides:
  - "create_workflow_run: the ONLY live-app atomic run-creation transaction (INSERT workflow_runs + one workflow_phases per PhaseSpec + threads anchor UPDATE, FK-ordered) — persists inputs+model (SEED-047)"
  - "list_published_workflows: RLS-mirroring picker feed (published AND owned-or-global)"
  - "MessageCreate.workflow_definition_id kickoff field (D-02)"
  - "send_message producer mode-branch (harness->run_workflow, Deep else byte-identical) ABOVE the loop"
  - "server-side 409 workflow-lock refusal on a non-terminal anchor (MODE-02 authoritative backstop)"
  - "ThreadWorkflowState model + GET /threads/{id}/workflow pure-read reconcile endpoint (SC#5)"
  - "GET /workflows/published list endpoint (new workflows.py router)"
affects: [092-03, 092-04, 096-eval-verify, SEED-047]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Net-new asyncpg multi-write transaction (acquire() -> con.transaction()) — no in-file precedent in db/workflows.py; the three writes go through the acquired connection, FK-ordered run-before-anchor (Landmine 9)"
    - "Producer mode-branch is ONE additive if/else above run_agent_loop; harness builds a loose SimpleNamespace engine ctx (NEVER RunContext — Landmine 7); Deep else byte-identical (075.x cascade rule)"
    - "Authoritative server-side authz lock: a non-terminal anchor refuses a Deep/different-workflow send 409 at run creation (the grayed client button is courtesy only — D-05)"
    - "Pure-read reconcile endpoint (D-v2.5-03): GET /threads/{id}/workflow never writes; lock_is_stale is a diagnostic self-heal signal, the clear is owned by cancel/terminal (Plan 03)"

key-files:
  created:
    - backend/app/api/workflows.py
  modified:
    - backend/app/db/workflows.py
    - backend/app/api/threads.py
    - backend/app/models/message.py
    - backend/app/models/thread.py
    - backend/app/main.py
    - backend/tests/conftest.py
    - backend/tests/test_dual_mode_wiring.py
    - backend/tests/test_thread_workflow_endpoint.py

key-decisions:
  - "Two-row model retained (RESEARCH A2): the producer-shell `runs` row stays for SSE-terminal consistency, the new `workflow_runs` row is the engine's row. The producer mode-branch drives run_workflow on the workflow_runs id; the Deep run_id continues to back _shielded_finalize. The lock-clear (single site) is Plan 03's concern — this plan only SETS the anchor."
  - "A locked-thread send is refused 409 BEFORE the user-message INSERT, so a refused send persists nothing. Any kickoff against a live-locked thread is a different-workflow attempt (kickoff carries a definition id, not the active run id) → 409."
  - "A stale anchor (set but its run terminal/absent) is NOT cleared by send_message — a fresh kickoff re-points it atomically via create_workflow_run; the GET reports lock_is_stale; cancel/terminal owns the clear."
  - "GET reconcile reports cap_paused/continues_* from whichever run holds the pause: workflow_runs for a Harness run, else the latest cap_paused `runs` row for the Deep-run cap case (RESEARCH Q3)."
  - "Published-workflows list lives in a NEW dedicated workflows.py router at /workflows/published (not under /threads) to avoid colliding with the /{thread_id}/workflow param path — Claude's discretion per the plan (A4)."
  - "_MAX_CONTINUES_PER_RUN = 3 is a module constant in threads.py for the GET's continues_remaining math (mirror of D-06); Plan 03 wires the real config.max_continues_per_run knob into the Continue enforcement."

patterns-established:
  - "Wave-0 contract flip: each downstream plan removes its OWN @pytest.mark.skip; this plan flipped create_workflow_run/inputs-model/producer-branch/lock + all 3 ThreadWorkflowState contracts; the cancel/terminal lock-clear contract stays skipped (Plan 03)."
  - "Mock-asyncpg test-infra extensions (Rule 3): _TransactionCtx no-op CM on the recording connection (con.transaction()) + a per-call fetchrow result queue (set_fetchrow_results) so a test can return DIFFERENT rows for successive joins."

requirements-completed: []  # SKIPPED on purpose — see Deviations (MODE-01/MODE-02 left OPEN for phase verification per the requirements_note)

# Metrics
duration: ~40min
completed: 2026-05-31
---

# Phase 092 Plan 02: Dual-Mode Wiring (MODE-01 + MODE-02 server-side half) Summary

**Wires the harness substrate into the live app: a kickoff send atomically creates a workflow run (persists inputs+model — SEED-047), the producer branches to `run_workflow` when the thread holds a live anchor (Deep byte-identical), a locked-thread Deep send is refused 409 server-side, and `GET /threads/{id}/workflow` reconciles mode/lock/phase/Continue state as a pure read — plus a published-workflows picker endpoint.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-05-31
- **Tasks:** 3 (all autonomous)
- **Files created:** 1
- **Files modified:** 8

## Accomplishments
- **`create_workflow_run`** — the first and only live-app path that creates a workflow run. One atomic transaction: INSERT `workflow_runs` (status='active', persists `inputs`={"kickoff_prompt": …} + `model` — closes SEED-047) → one `workflow_phases` row per PhaseSpec in `phase_index` order → UPDATE `threads.active_workflow_run_id`. FK-ordered (run before anchor, Landmine 9). This unblocks 091's persisted cross-provider workflow UAT (a `workflow_runs` row now exists).
- **Producer mode-branch** in `agent_runner` ABOVE `run_agent_loop` (SC#1): `if _active_workflow_run_id is not None:` drives `run_workflow` with a loose SimpleNamespace engine ctx (never `RunContext` — Landmine 7); the Deep `else` is byte-identical to the pre-092 call. The surrounding except + `finally: _shielded_finalize` are untouched (mode-agnostic). Zero provider-branch edits.
- **Authoritative server-side lock** (MODE-02): `send_message` reads the thread anchor and, if its `workflow_runs` row is non-terminal, refuses a Deep / different-workflow send with HTTP 409 BEFORE persisting anything. The grayed client toggle is courtesy only (D-05).
- **`GET /threads/{id}/workflow`** (SC#5) — a pure-read `ThreadWorkflowState` reconcile (mode/locked/lock_is_stale/current phase/cap_paused/continues_*), ownership-gated 404 (T-092-04), joined run→definition→phase read + a latest-`cap_paused`-runs probe for the Deep-run Continue case. Never writes.
- **Published-workflows picker feed** — new `backend/app/api/workflows.py` router exposing `GET /workflows/published` (owner-scoped via the RLS-mirroring predicate, T-092-07), feeding the Plan 04 picker.

## Task Commits

1. **Task 1: create_workflow_run + list_published_workflows** — `582df3fa` (feat)
2. **Task 2: MessageCreate kickoff field + producer mode-branch + server-side 409 lock** — `e5574e6b` (feat)
3. **Task 3: GET /threads/{id}/workflow reconcile + ThreadWorkflowState + published-workflows list** — `bdb28251` (feat)

**Plan metadata:** (this commit — docs: complete plan)

## Files Created/Modified
- `backend/app/db/workflows.py` — Added `create_workflow_run` (net-new atomic 3-write transaction, json.dumps+$3::jsonb for inputs, FK-ordered) + `list_published_workflows` (published AND owned-or-global). Imports `WorkflowDefinition`.
- `backend/app/api/threads.py` — `send_message`: ownership SELECT now fetches `active_workflow_run_id`; server-side 409 lock check + RLS-scoped published-definition resolve + `create_workflow_run` kickoff (sets `_active_workflow_run_id` before producer spawn). `agent_runner`: producer mode-branch (harness `run_workflow` / Deep `run_agent_loop` byte-identical). New `GET /{thread_id}/workflow` pure-read reconcile endpoint.
- `backend/app/api/workflows.py` — **Created.** New `/workflows` router; `GET /workflows/published` → `PublishedWorkflow[]` (id/slug/name), owner-scoped.
- `backend/app/main.py` — Registered the `workflows` router.
- `backend/app/models/message.py` — `MessageCreate.workflow_definition_id: UUID | None` kickoff field (D-02).
- `backend/app/models/thread.py` — `ThreadWorkflowState` BaseModel (14 fields, SC#5).
- `backend/tests/conftest.py` — Rule-3 test-infra: `_TransactionCtx` no-op `con.transaction()` CM + per-call `set_fetchrow_results` queue on the mock asyncpg pool.
- `backend/tests/test_dual_mode_wiring.py` — Flipped create_workflow_run / inputs-model / producer-branch / 409-lock contracts live; added list-endpoint + scoping tests.
- `backend/tests/test_thread_workflow_endpoint.py` — Flipped all 3 ThreadWorkflowState contracts live (shape, lock_is_stale heal, pure-read).

## Decisions Made
See the `key-decisions` frontmatter block above — the load-bearing calls: two-row model retained (Landmine 5 — single lock-clear deferred to Plan 03), 409-before-INSERT, stale-anchor not auto-cleared on send, GET reports cap_paused from whichever run holds the pause, dedicated `/workflows` router for the picker, `_MAX_CONTINUES_PER_RUN=3` constant (Plan 03 wires the config knob).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Mock asyncpg connection lacked `transaction()`**
- **Found during:** Task 1 (create_workflow_run contract tests)
- **Issue:** `create_workflow_run` uses `async with con.transaction():` (the plan's prescribed net-new mechanic) but the 091 Wave-0 `_RecordingConnection` fixture had no `transaction()` method → `AttributeError`, blocking the contract.
- **Fix:** Added a `_TransactionCtx` no-op async-context-manager returned by `con.transaction()` that records `transaction_enter`/`transaction_exit` span markers on `pool.calls`.
- **Files modified:** backend/tests/conftest.py
- **Verification:** All 3 create_workflow_run contracts pass.
- **Committed in:** `582df3fa` (Task 1 commit)

**2. [Rule 3 - Blocking] Mock asyncpg pool returned one sticky fetchrow value for all calls**
- **Found during:** Task 3 (GET reconcile contract tests)
- **Issue:** The GET makes successive `fetchrow` calls (workflow_runs join, then the latest-cap_paused `runs` probe). The fixture's single `set_fetchrow_result` returns the same value for both, so a test couldn't return distinct rows.
- **Fix:** Added a per-call `set_fetchrow_results([...])` queue that takes precedence and falls back to the sticky value.
- **Files modified:** backend/tests/conftest.py
- **Verification:** All 3 ThreadWorkflowState contracts pass.
- **Committed in:** `bdb28251` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — test-infra blocking on the 091 Wave-0 fixtures, which predate this plan's transaction + multi-fetchrow needs). No source-behavior deviation; the production code matches the plan exactly. No scope creep.

### Requirement closure SKIPPED (per the requirements_note in the execution prompt)
The standard execute-plan protocol marks requirements complete, but the prompt explicitly instructed: do NOT run `requirements.mark-complete` for MODE-01/MODE-02. MODE-02 also depends on Plan 03 (the cancel/terminal lock-clear half) and the user-facing wiring lands in Plan 04; the SDK verb is known to mangle REQUIREMENTS.md. Both requirements are left OPEN for phase verification. `requirements-completed: []` in the frontmatter reflects this.

## Issues Encountered
- Full backend suite shows 102 failures — **all pre-existing baseline** (verified by re-running a sample on a stashed clean tree: `test_phase56_iteration_start` + `test_sql_service` fail identically without my changes). They live in unrelated files (retrieval/sandbox/sql_service/multimodal/streaming-reliability) requiring live infra, and match the documented "identical 102-failure set" from 089-03. My changes introduced ZERO new failures. The harness + 092 suites are fully green (84 passed / 6 skipped — the skips are downstream-plan contracts).

## Authentication Gates
None.

## User Setup Required
None — no external service configuration required. (Migration 063 was applied live in Plan 01.)

## Next Phase Readiness
- **Plan 03 (Wave 3)** can now wire the MODE-02 cancel/terminal lock-clear half (the single lock-clear site) + CONT-01 Continue. It owns: the remaining skipped contract `test_cancel_clears_anchor_in_same_transaction` (test_dual_mode_wiring.py) + all of test_continue.py. The two-row model + the producer-shell `runs` finalize path are documented above for its single-clear-site analysis. The `_MAX_CONTINUES_PER_RUN=3` constant should be replaced with `config.max_continues_per_run`.
- **Plan 04 (Wave 4, frontend)** consumes the contracts produced here: `ThreadWorkflowState` shape, `MessageCreate.workflow_definition_id` kickoff field, `GET /threads/{id}/workflow`, `GET /workflows/published`. `POST /runs/{id}/continue` is Plan 03's.
- **SEED-047** substrate is now WIRED: run-creation persists `workflow_runs.inputs`+`model`. Phase 096 EVAL-02 (live kill-and-resume) remains the proof gate; the resume-ctx rehydration of these columns is the remaining step.
- **091 cross-provider workflow UAT** is UNBLOCKED — a `workflow_runs` row can now be created via a real kickoff send.

## Self-Check: PASSED
(see below)

---
*Phase: 092-dual-mode-wiring-continue-button*
*Completed: 2026-05-31*

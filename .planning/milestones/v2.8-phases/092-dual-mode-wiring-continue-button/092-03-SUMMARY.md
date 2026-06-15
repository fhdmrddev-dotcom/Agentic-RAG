---
phase: 092-dual-mode-wiring-continue-button
plan: 03
subsystem: api
tags: [fastapi, asyncpg, agent-loop, harness, continue, cap-paused, mode-lock, sse, dual-mode]

# Dependency graph
requires:
  - phase: 092-01 (Wave 1)
    provides: "migration 063 — workflow_runs.inputs/model/continues_used, runs.continues_used, cap_paused non-terminal status on both CHECKs"
  - phase: 092-02 (Wave 2)
    provides: "create_workflow_run atomic txn, producer mode-branch (harness/Deep byte-identical), server-side 409 lock, GET /threads/{id}/workflow + GET /workflows/published, two-row model (single lock-clear deferred here)"
  - phase: 091
    provides: "run_workflow, _load_run_definition, get_active_phase, db/workflows.finish_run, conftest mock_asyncpg_pool + _TransactionCtx"
provides:
  - "agent_loop cap site PERSISTS the buffered tool calls (consume, not destroy — SC#4) to a durable role='system' carrier (kind='iteration_cap_paused') BEFORE clearing the buffer; finalizes cap_paused (non-terminal) ONLY for the cap-with-buffer case; emits a distinct NON-terminal cap_paused SSE event (Landmine 6)"
  - "RunContext.resume_dropped_tool_calls + dropped_tool_calls (ADDITIVE, OFF by default → Deep byte-identical); the loop CONSUMES the dropped calls as a pre-loop dispatch round when ON"
  - "POST /runs/{run_id}/continue — ownership 404, Deep-vs-Harness detection, durable continues_used increment, 4th-continue server-side refusal (D-06), Deep CONSUME branch + Harness re-drive branch (re-reads available_tools from the parsed definition, D-08)"
  - "config.max_continues_per_run = 3 (D-06) — replaces the 092-02 _MAX_CONTINUES_PER_RUN module constant downstream"
  - "spawn_continuation_run (threads.py) — NET-NEW Deep-run continuation shell (re-pauses on a repeat cap, no terminal sentinel for cap_paused)"
  - "db/runs.load_cap_paused_tool_calls — reads the durable carrier payload back"
  - "db/workflows.finish_run clears threads.active_workflow_run_id in the SAME transaction as the workflow_runs terminal write — the SINGLE authoritative lock-clear site (SC#2, Landmine 5); cancel zombie-heal clears the anchor as the cancel-path sibling"
affects: [092-04, 096-eval-verify, SEED-047]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cap PERSIST-then-pause (SC#4): durable carrier row FIRST, then non-terminal cap_paused SSE event, then clear the in-memory buffer — replaces the 075.4 DROP. Scoped STRICTLY to force_no_tools WITH a non-empty buffer (Landmine 8); a clean force_no_tools text answer stays byte-identical"
    - "ADDITIVE RunContext resume flag (resume_dropped_tool_calls/dropped_tool_calls) OFF at every existing call site → Deep Mode byte-identical (075.x cascade rule); the continuation re-executes the EXACT persisted calls as a pre-loop dispatch round, feeding results back into `messages`"
    - "Single authoritative lock-clear site (Landmine 5): db/workflows.finish_run owns the workflow_runs-side clear in ONE transaction (terminal status UPDATE + threads anchor NULL); the producer's runs-row finalize_run does NOT also clear for a harness send (anchor FKs to workflow_runs.id). The cancel zombie-heal clears keyed by thread_id as the cancel-path sibling"
    - "cap_paused is NON-terminal end-to-end: not in TERMINAL_TYPES, not in _RUN_STATUS_TO_TERMINAL_TYPE, not in the cancel idempotency set (stays cancellable), keeps the run in the active sorted sets (re-attachable for Continue)"

key-files:
  created: []
  modified:
    - backend/app/services/agent_loop.py
    - backend/app/api/runs.py
    - backend/app/api/threads.py
    - backend/app/db/runs.py
    - backend/app/db/workflows.py
    - backend/app/config.py
    - backend/tests/test_continue.py
    - backend/tests/test_dual_mode_wiring.py
    - backend/tests/unit/test_075_4_iteration_cap_drop.py

key-decisions:
  - "SINGLE lock-clear site = db/workflows.finish_run (workflow_runs-side), inside one transaction (Landmine 5). The anchor FKs to workflow_runs.id, so a Deep run never sets it — the producer's finalize_run is NOT extended (no double-clear). The cancel zombie-heal path adds a best-effort thread-keyed anchor-clear so a cancelled Harness/cap_paused run never strands the thread."
  - "cap_paused finalize is scoped STRICTLY to the force_no_tools-with-non-empty-buffer case (Landmine 8). A force_no_tools run that produced a clean text answer with no buffered tools finalizes byte-identically (no cap_paused, no carrier, no resume flag)."
  - "Deep continuation re-executes the persisted dropped calls as a pre-loop dispatch round (injects an assistant tool-call message + dispatches each call + appends tool results) so the model's FIRST iteration continues from the dropped work — consume, NOT restart, NOT re-drop (SC#4). This is the PATTERNS.md 'No Analog Found' net-new piece."
  - "continues_used read/increment is DURABLE (migration 063 column) on the carrying row — runs.continues_used for Deep, workflow_runs.continues_used for Harness — never an in-memory count (WORKER_COUNT=2 safe). The 4th continue is refused server-side with a clean 200 refusal payload (no spawn)."
  - "Harness Continue re-reads available_tools from the PARSED definition (resolve_phase_available_tools over definition.phases[active_slug].config.available_tools), NOT from a workflow_phases column (D-08), then re-drives run_workflow (091 idempotent-resume)."

patterns-established:
  - "Wave-0 contract flip: this plan removed ITS skips — all 5 CONT-01 contracts in test_continue.py + the cancel-clear contract in test_dual_mode_wiring.py are now live and passing."
  - "Obsolete-by-design test update (Rule 1, in-scope): the 075.4 iteration-cap DROP source-text tests (test_075_4_iteration_cap_drop.py) were rewritten to assert the 092 SC#4 PERSIST contract — the exact behavior this plan was tasked to replace."

requirements-completed: []  # SKIPPED on purpose — see Deviations (MODE-02/CONT-01 left OPEN for phase verification per the requirements_note)

# Metrics
duration: ~75min
completed: 2026-05-31
---

# Phase 092 Plan 03: MODE-02 Cancel/Terminal Lock-Clear + CONT-01 Continue Summary

**Turns the iteration cap from DESTROY into PERSIST-then-pause (SC#4): buffered tool calls are persisted to a durable carrier row before the buffer is cleared, the run finalizes the non-terminal `cap_paused`, and `POST /runs/{id}/continue` resumes the SAME run with a fresh bounded budget that CONSUMES the dropped calls (Deep) or re-reads `available_tools` + re-drives the phase (Harness) — refusing the 4th continue; cancel and natural terminal clear `threads.active_workflow_run_id` in the same transaction exactly once (SC#2). Deep Mode stays byte-identical when no cap-drop occurs.**

## Performance

- **Duration:** ~75 min
- **Completed:** 2026-05-31
- **Tasks:** 3 (all autonomous, all TDD)
- **Files created:** 0
- **Files modified:** 9 (6 source + 3 test)

## Accomplishments

- **Cap PERSIST (SC#4)** — `agent_loop.py` at the iteration cap (`force_no_tools and tool_calls_buffer`) now reads the DURABLE `runs.continues_used`, calls `persist_cap_paused` (durable `role='system'` carrier row with `kind='iteration_cap_paused'` + the EXACT name/args/id of every dropped call, then a distinct NON-terminal `cap_paused` SSE event carrying `tool_names`/`continues_used`/`continues_remaining`) BEFORE clearing the buffer. Surfaces a `cap_paused` disposition via `result_sink["cap_disposition"]` + `AgentLoopResult.cap_disposition`.
- **Additive Continue inputs** — `RunContext.resume_dropped_tool_calls` (bool, default False) + `dropped_tool_calls` (tuple, default `()`). OFF at every existing call site → Deep byte-identical (075.x cascade rule). When ON, a pre-loop CONSUME block re-executes the persisted calls (assistant tool-call message + per-call `dispatch_tool` + tool-result append) so the model's first iteration continues from the dropped work.
- **`POST /runs/{run_id}/continue`** (CONT-01) — ownership SELECT → 404 (T-092-09); Deep-vs-Harness detection via the thread anchor; durable `continues_used` increment on the carrying row; **server-side refusal** (clean 200 refusal payload, no spawn) when `continues_used >= settings.max_continues_per_run` (D-06 / T-092-10); **Deep branch** loads the carrier (`load_cap_paused_tool_calls`) → `spawn_continuation_run`; **Harness branch** re-reads `available_tools` from the parsed definition (`resolve_phase_available_tools`, D-08) → re-drives `run_workflow`.
- **Single lock-clear (SC#2, Landmine 5)** — `db/workflows.finish_run` now wraps the workflow_runs terminal UPDATE + the `threads.active_workflow_run_id = NULL` clear in ONE transaction (the authoritative workflow_runs-side site, fires exactly once). The cancel zombie-heal path clears the thread anchor as the cancel-path sibling. `cap_paused` stays out of the cancel idempotency terminal set (remains cancellable).
- **`config.max_continues_per_run = 3`** (D-06) — the real knob the endpoint reads (replaces 092-02's `_MAX_CONTINUES_PER_RUN` constant downstream).

## Task Commits

1. **Task 1 RED:** flip CONT-01 contracts live — `bf5dd1a4` (test)
2. **Task 1 GREEN:** persist-at-cap + cap_paused + RunContext flag + config knob — `f3d1cc32` (feat)
3. **Task 2 GREEN:** POST /continue + load_cap_paused_tool_calls + resolve_phase_available_tools + spawn_continuation_run + consume block — `3bdc5384` (feat)
4. **Task 3 RED:** flip MODE-02 cancel/terminal lock-clear contract live — `ee14c7c7` (test)
5. **Task 3 GREEN:** finish_run single-transaction anchor clear + cancel anchor-clear sibling — `35bb52c5` (feat)
6. **Test repair (Rule 1):** update 075.4 cap-drop source-text tests to the SC#4 PERSIST contract — `84ced873` (test)

**Plan metadata:** (this commit — docs: complete plan)

## Files Created/Modified

- `backend/app/services/agent_loop.py` — `build_cap_paused_carrier_tool_calls` + `persist_cap_paused` pure helpers; RunContext additive fields; AgentLoopResult + result_sink `cap_disposition`; the cap site PERSISTS instead of DROPs; the pre-loop CONSUME block that re-executes the dropped calls when the resume flag is ON.
- `backend/app/api/runs.py` — `POST /{run_id}/continue` (`continue_run`) + `resolve_phase_available_tools` (D-08); cancel zombie-heal thread-anchor clear (SC#2 sibling).
- `backend/app/api/threads.py` — `spawn_continuation_run` Deep-run continuation shell (re-pauses on repeat cap; no terminal sentinel for cap_paused; keeps cap_paused runs in the active sorted sets).
- `backend/app/db/runs.py` — `load_cap_paused_tool_calls` (reads the durable carrier payload back).
- `backend/app/db/workflows.py` — `finish_run` wraps the terminal UPDATE + anchor clear in ONE transaction (SC#2 single authoritative site).
- `backend/app/config.py` — `max_continues_per_run: int = 3` (D-06).
- `backend/tests/test_continue.py` — flipped all 5 CONT-01 contracts live + added carrier-shape / cap_paused-not-terminal / consume / harness-resolver assertions.
- `backend/tests/test_dual_mode_wiring.py` — flipped `test_cancel_clears_anchor_in_same_transaction` live (transaction-span assertion against `mock_asyncpg_pool.calls`) + a cap_paused-stays-cancellable negative test.
- `backend/tests/unit/test_075_4_iteration_cap_drop.py` — rewritten for the 092 SC#4 PERSIST contract (Rule 1, see Deviations).

## Decisions Made

See the `key-decisions` frontmatter block — the load-bearing calls: single lock-clear at `finish_run` (Landmine 5), cap_paused scoped strictly to the cap-with-buffer case (Landmine 8), the consume-as-pre-loop-dispatch design for the Deep continuation (the PATTERNS.md net-new piece), durable continues_used (WORKER_COUNT=2 safe), Harness re-reads available_tools from the parsed definition (D-08).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test correctness] Updated the 075.4 iteration-cap DROP source-text tests to the 092 SC#4 PERSIST contract**
- **Found during:** post-Task-3 full-suite baseline diff.
- **Issue:** `tests/unit/test_075_4_iteration_cap_drop.py` asserted the OLD drop behavior (`iteration_cap_dropped_tool_calls` kind, the legacy log format, drop-then-clear). Plan 03 (SC#4) deliberately REPLACES that DROP with PERSIST — so those source-text assertions broke by design (they cover the exact code this plan was tasked to change).
- **Fix:** rewrote both tests to assert the SC#4 contract — `iteration_cap_paused` kind, a `persist_cap_paused(...)` call in the guard region, and persist-BEFORE-clear ordering. In-scope (directly covers the changed code, not an unrelated file).
- **Files modified:** backend/tests/unit/test_075_4_iteration_cap_drop.py
- **Verification:** `pytest tests/unit/test_075_4_iteration_cap_drop.py` → 2 passed.
- **Committed in:** `84ced873`.

**Total deviations:** 1 auto-fixed (Rule 1 — obsolete-by-design test update). No source-behavior deviation beyond the planned SC#4 change. No scope creep.

### Requirement closure SKIPPED (per the requirements_note in the execution prompt)
The standard execute-plan protocol marks requirements complete, but the prompt explicitly instructed: do NOT run `requirements.mark-complete` for MODE-02/CONT-01. The SDK verb is known to mangle REQUIREMENTS.md; the user-facing wiring lands in Plan 04, and MODE-02/CONT-01 closure is left to phase verification. `requirements-completed: []` reflects this.

## Known Stubs
None. No hardcoded empty UI-bound values, no placeholder text, no unwired data sources introduced by this plan. (The `spawn_continuation_run` harness branch builds `wf_ctx` with `user_settings=None`, mirroring the 092-02 producer harness branch — the engine resolves effective settings itself; this is the established harness-ctx shape, not a stub.)

## Issues Encountered

- **Full backend suite: 104 failures vs the documented ~102 baseline — ZERO NEW failures from this plan.** Proven by direct HEAD-vs-baseline comparison (baseline worktree at the 092-02 tip `87c86126`, shared venv):
  - **Deterministic unit suite is BYTE-IDENTICAL:** 54 failed / 569 passed at BOTH HEAD and baseline.
  - The only "new" integration failures (`test_075_code_stdout_progressive.py` ×4) are `@_SANDBOX_REQUIRED` live-Docker tests that **SKIP-or-fail nondeterministically** on `runs_thread_id_fkey` FK violations depending on leftover Docker/Postgres state — at baseline the same 4 tests SKIP (4 skipped) when re-run in isolation. They touch the sandbox stdout-drain path, NOT any code this plan changed. The documented baseline FK-violation cluster (test_db_runs / test_061 / test_066 / test_075) is live-infra-dependent and run-to-run nondeterministic.
  - The harness + 092 contract suites are fully green: `test_continue.py` + `test_dual_mode_wiring.py` = 17 passed.
- Mid-execution a `git checkout <baseline> -- ../backend` (run to capture baseline failures) briefly reverted working-tree files; immediately restored via `git checkout HEAD -- .` (all Plan-03 work was already committed, so nothing was lost) + popped the pre-existing working-tree drift back from stash. No commits affected.

## Authentication Gates
None.

## User Setup Required
None — no external service configuration. (Migration 063 was applied live in Plan 01.)

## Next Phase Readiness

- **Plan 04 (Wave 4, frontend)** consumes the contracts produced here: `POST /runs/{id}/continue` (refusal payload shape + `continues_remaining`), the non-terminal `cap_paused` SSE event (`tool_names`/`continues_used`/`continues_remaining`), and the `GET /threads/{id}/workflow` cap_paused/continues_* fields (092-02). The frontend Continue card + per-thread workflow-lock Map (SC#3) + Deep/Harness toggle ride those.
- **SEED-047** substrate stays wired (092-01/02 persist `workflow_runs.inputs`+`model`); Phase 096 EVAL-02 (live kill-and-resume) is the proof gate; resume-ctx rehydration of those columns is the remaining step.
- **VALIDATION.md live gates owed (manual/live, not automated here):** SC#2 Supabase query `SELECT active_workflow_run_id FROM threads WHERE id=...` IS NULL after BOTH cancel and natural terminal; SC#4 cross-provider Continue UAT (the cap fires → Continue → the dropped tools execute → no re-drop); the 4-axis cross-provider scoreboard (the cap-pause + Continue exercised across providers).
- **MODE-02 + CONT-01 are now wired server-side end-to-end** (the cancel/terminal lock-clear half + Continue); left OPEN for phase verification per the requirements_note.

## Self-Check: PASSED
(see below)

---
*Phase: 092-dual-mode-wiring-continue-button*
*Completed: 2026-05-31*

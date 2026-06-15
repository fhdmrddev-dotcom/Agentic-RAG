---
phase: 091-harness-engine-5-phase-types-gates-whitelist
plan: 03
subsystem: harness-engine
tags: [harness, phase-types, executors, composition, sub-agent, ask-user, whitelist, batch]

# Dependency graph
requires:
  - phase: 091-harness-engine-5-phase-types-gates-whitelist
    plan: 01
    provides: the 5 finalized PhaseConfig models (ProgrammaticPhaseConfig.fn/input_keys, LlmAgentPhaseConfig.available_tools/max_steps, LlmBatchAgentsPhaseConfig.max_parallel_agents/merge_strategy, LlmHumanInputPhaseConfig.options/timeout_seconds)
  - phase: 091-harness-engine-5-phase-types-gates-whitelist
    plan: 02
    provides: PHASE_TYPE_REGISTRY dispatch seam + run_workflow + _execute_phase(phase, accumulated_outputs, ctx) call contract
  - phase: 091-harness-engine-5-phase-types-gates-whitelist
    plan: 06
    provides: apply_tool_budget(schemas, model, whitelist) + ToolContext.phase_whitelist (both D-05 layers)
provides:
  - "harness/phase_types.py — the 5 phase-type executors wrapping shipped substrate, registered into the engine PHASE_TYPE_REGISTRY dispatch seam"
  - "harness/programmatic.py — closed PROGRAMMATIC_PHASE_REGISTRY + register_programmatic decorator + idempotent split_topic"
  - "task_service.run_task_sub_agent additive keyword-only system_prompt_override param (OQ1 — phase prompt reaches the model verbatim)"
affects: [091-04 resume (ask_user tool_call_id re-subscribe), 091-05 gates (retry_feedback producer), 091-07 seeds (split_topic + 4 seed shapes), 092 publish endpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "~80% composition: each phase type is a THIN WRAPPER over already-shipped, cross-provider-tested substrate (_stream_one_iteration / run_task_sub_agent / ask_user pub-sub / programmatic registry) — no loop reimplementation, no provider-branch edits"
    - "Closed registry (T-091-12): PROGRAMMATIC_PHASE_REGISTRY mirrors _TOOL_REGISTRY — an unknown fn name raises, never eval'd / dynamically imported"
    - "Additive keyword-only override (T-091-13): system_prompt_override=None is byte-identical for every existing run_task_sub_agent caller; set => REPLACES the helper-built framing for that call only; byte-frozen helpers untouched"
    - "Both D-05 layers per LLM-agent phase: apply_tool_budget builds the per-phase tools_override (model only SEES allowed) + ToolContext.phase_whitelist is the dispatch-time backstop"
    - "max_parallel_agents Semaphore COMPOSES with (never replaces) the shipped per-run Semaphore(3)/Redis-Lua(20) caps — fair-share sizing deferred to 096/CONC-01"
    - "Producer/consumer split: LLM executors CONSUME ctx.retry_feedback (append to prompt); Plan 05's gate-retry loop is the PRODUCER; round-trip jointly proven in 07-T2"

key-files:
  created:
    - backend/app/services/harness/programmatic.py
    - backend/app/services/harness/phase_types.py
  modified:
    - backend/app/services/task_service.py
    - backend/app/services/harness/__init__.py
    - backend/tests/test_harness_engine.py
    - backend/tests/unit/test_085_task_service.py

key-decisions:
  - "split_topic is pure-Python (NO LLM): deterministic clause split on ;/newline/' and '/' vs ' with first-seen dedup + single-topic fallback — idempotent so re-running the phase on resume is safe (Pattern 3)"
  - "llm_agent step cap clamps to Explorer=8 ONLY when config carries the LOCKED model default (max_steps==10); an explicit non-default max_steps is honored verbatim (D-12)"
  - "system_prompt_override carries phase.config.prompt + retry_suffix (the retry-feedback CONSUMER append) — the phase prompt reaches the model verbatim when no retry feedback is set; the test asserts the verbatim path"
  - "executors read substrate off the harness ctx bag via getattr with safe defaults (redis/pool/supabase/user/thread/emit/model/retry_feedback/inputs) so the engine ctx stays a flexible identity bag and unit tests inject stub ctx + mocked substrate"
  - "registration happens at phase_types import time via register_all(); harness/__init__ imports phase_types last so any use of the harness package (and therefore the engine) populates PHASE_TYPE_REGISTRY"

requirements-completed: [HARNESS-01]

# Metrics
duration: 7min
completed: 2026-05-31
---

# Phase 091 Plan 03: 5 Phase-Type Executors + Registry Registration Summary

**All 5 workflow phase types now execute end-to-end by wrapping already-shipped, cross-provider-tested substrate — `programmatic` runs a closed-registry pure fn, `llm_single` calls `_stream_one_iteration`, `llm_agent` and `llm_batch_agents` drive `run_task_sub_agent` (wiring both D-05 whitelist layers + the phase prompt via an additive `system_prompt_override` + the Explorer=8 / max_parallel caps), and `llm_human_input` blocks on the ask_user pub/sub flow — all five registered into the engine's `PHASE_TYPE_REGISTRY` dispatch seam, with zero edits to any provider streaming branch or the agent loop.**

## Performance
- **Duration:** ~7 min
- **Started:** 2026-05-31T05:27:42Z
- **Completed:** 2026-05-31T05:34:51Z
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- **Task 1 — programmatic registry (`harness/programmatic.py`):** A closed `PROGRAMMATIC_PHASE_REGISTRY` dict mirroring `tool_dispatcher._TOOL_REGISTRY` (T-091-12 — an unknown `fn` name raises in the executor, never `eval`'d / dynamically imported), a `register_programmatic(name)` decorator, and the v1 consumer `split_topic` — a PURE, deterministic clause splitter (no LLM) over `;` / newline / `" and "` / `" vs "` with first-seen dedup and a single-topic fallback. Idempotency is asserted in a test (same input twice → identical `sub_questions`), satisfying the Pattern 3 resume-safety contract.
- **Task 2 — additive `system_prompt_override` on `run_task_sub_agent`:** ONE keyword-only param, default `None`. `None` is byte-identical to every existing caller (the helper-built "focused sub-agent" framing is used unchanged); a string REPLACES it for that call only. `_build_sub_agent_system_prompt` and `resolve_sub_agent_model_safely` (D-085-16 replicated footgun) are untouched. Two tests pin it: the None path produces the SAME assembled prompt as the helper (byte-identical), and the override path replaces the framing verbatim.
- **Task 3 — the 5 executors (`harness/phase_types.py`) + registration:** Each `async def _exec_<type>(phase, accumulated_outputs, ctx) -> dict` returns a `text`-keyed chat-ready output (the final phase's `text` becomes the assistant message per D-10). `llm_agent`/`llm_batch_agents` wire BOTH D-05 layers (apply_tool_budget per-phase `tools_override` + `ToolContext.phase_whitelist=frozenset(...)` backstop), pass the phase prompt verbatim via `system_prompt_override` (OQ1), clamp the step cap to Explorer=8 when the config carries the model default (D-12), and the batch executor bounds fan-out with an `asyncio.Semaphore(max_parallel_agents)` that COMPOSES with the shipped per-run/Redis-Lua caps, merging by `concat` / `concat_numbered`. `llm_human_input` reuses the ask_user subscribe → advertise → durable-prompt-row → emit → block ordering (clamping the per-call timeout to the 1800s hard cap) and stores the `tool_call_id` in its output so Plan 04's resume can re-subscribe. The LLM executors CONSUME `ctx.retry_feedback` (appended to the prompt; producer is Plan 05, round-trip proven in 07-T2). All 5 registered into the engine seam via a module-level `register_all()` triggered by `harness/__init__` importing `phase_types`. The previously-skipped `test_phase_dispatch_routes_each_of_5_types` is now live, plus 13 executor unit tests.

## Task Commits
1. **Task 1: closed PROGRAMMATIC_PHASE_REGISTRY + decorator + idempotent split_topic** — `46035e28` (feat)
2. **Task 2: additive system_prompt_override on run_task_sub_agent (OQ1)** — `a140c455` (feat)
3. **Task 3: 5 phase-type executors + PHASE_TYPE_REGISTRY registration** — `59f2261c` (feat)

## Files Created/Modified
- `backend/app/services/harness/programmatic.py` — closed registry + `register_programmatic` + `split_topic` (created)
- `backend/app/services/harness/phase_types.py` — 5 executors + helpers + `register_all()` (created)
- `backend/app/services/task_service.py` — additive keyword-only `system_prompt_override` param on `run_task_sub_agent` (the ONLY change; byte-frozen helpers untouched)
- `backend/app/services/harness/__init__.py` — imports `phase_types` (registration side-effect)
- `backend/tests/test_harness_engine.py` — flipped `test_phase_dispatch_routes_each_of_5_types` live + `TestProgrammaticRegistry` (6) + `TestPhaseExecutors` (13)
- `backend/tests/unit/test_085_task_service.py` — 2 OQ1 tests (None-path byte-identical + override-replaces-framing)

## Decisions Made
- **`split_topic` is pure-Python, not an LLM call:** the plan permitted a bounded `_stream_one_iteration` call only if a deterministic split were impossible. A clause-boundary heuristic IS deterministic and therefore idempotent, which is the resume-safety requirement — chosen over the paid/non-idempotent LLM path.
- **`system_prompt_override` carries `phase.config.prompt + _retry_suffix(ctx)`:** the plan's literal grep target was `system_prompt_override=phase.config.prompt`, but the retry-feedback CONSUMER contract requires the prompt to be appendable. The verbatim path (no retry feedback) is preserved and asserted by `test_llm_agent_wires_whitelist_prompt_and_explorer_cap` (`system_prompt_override == "Research it."`); the suffix is empty unless Plan 05 sets `ctx.retry_feedback`. Functionally equivalent to the must-have, with the producer/consumer wiring in place.
- **`phase_whitelist=frozenset(phase.config.available_tools)` is built inline at the `ToolContext(...)` call** (rather than a passed-in variable) to match the must-have grep `phase_whitelist=frozenset` exactly while keeping the D-05 layer-2 wiring obvious.
- **Executors read the harness `ctx` bag via `getattr` with safe defaults:** the engine's `ctx` is a flexible run-identity bag (Plan 02 sets `ctx.final_output` and tolerates immutable stubs). The executors pull `redis/pool/supabase/current_user/thread_id/emit/model/retry_feedback/inputs` defensively so both the real production ctx and stub unit-test ctx work without a rigid dataclass coupling.

## Deviations from Plan
None — plan executed exactly as written. The two notes above (retry-suffix on the override string; inline frozenset) are wiring choices that satisfy the must-have contracts and acceptance greps, not scope or behavior deviations. No Rule 1-3 auto-fixes were required (the substrate composed cleanly on first run).

## Threat Model Compliance
- **T-091-12 (Tampering — fn name injection):** mitigated. `PROGRAMMATIC_PHASE_REGISTRY` is a closed dict; `_exec_programmatic` raises `KeyError` on an unregistered `fn`, never resolving it dynamically. Tested by `test_programmatic_unknown_fn_raises`.
- **T-091-13 (Integrity — byte-frozen path edited):** mitigated. `system_prompt_override` is additive keyword-only (None = byte-identical); `_build_sub_agent_system_prompt` + `resolve_sub_agent_model_safely` bodies untouched (verified by diff grep). Tested by `test_sub_agent_prompt_none_path_byte_identical`.
- **T-091-14 (DoS — batch fan-out):** accepted (this phase). `max_parallel_agents` (default 5) Semaphore composes with the shipped Semaphore(3)/Redis-Lua(20) caps; fair-share sizing transferred to 096/CONC-01 (documented in the module docstring).
- **T-091-15 (EoP — LLM phase reaches a blocked tool):** mitigated. Both D-05 layers wired per LLM-agent phase (`apply_tool_budget` filter + `ToolContext.phase_whitelist` backstop). Tested by `test_llm_agent_wires_whitelist_prompt_and_explorer_cap`.

## Cross-Provider Safety
Zero edits to any `*_service.py` provider streaming branch or `agent_loop.py`. The executors CALL `run_task_sub_agent` (an already cross-provider-safe bounded loop that resolves the model via `resolve_sub_agent_model_safely`) and `_stream_one_iteration` (the threadpool-drained OpenAI-shaped path). The only `task_service.py` change is the additive `system_prompt_override` param. All four providers inherit the existing sub-agent model-safety + SSE-vocabulary machinery unchanged.

## Verification
- `pytest tests/test_harness_engine.py -q` → **34 passed** (incl. the now-live `test_phase_dispatch_routes_each_of_5_types`, `test_engine_drives_ordered_transitions`, `TestProgrammaticRegistry` ×6, `TestPhaseExecutors` ×13).
- `pytest tests/test_harness_engine.py tests/test_harness_resume.py tests/test_harness_reachability.py tests/test_harness_whitelist.py tests/test_tool_budget.py tests/unit/test_085_task_service.py -q` → **84 passed, 3 skipped** (the 3 skips are Plan 04 resume contracts) — no collateral breakage.
- `import app.services.harness; from app.services.harness_engine import PHASE_TYPE_REGISTRY; assert set(PHASE_TYPE_REGISTRY) == {'programmatic','llm_single','llm_agent','llm_batch_agents','llm_human_input'}` → **ok** (all 5 resolve).
- Diff to `task_service.py` is the single additive `system_prompt_override` param + its guarded use; byte-frozen helper bodies unchanged (verified by `git diff` grep).
- No file deletions in any of the 3 commits.

## Next Phase Readiness
- **Plan 04 (resume):** `_exec_llm_human_input` stores `tool_call_id` in its output and persists the durable `ask_user_prompt` messages row in the same ordered flow the dispatcher uses — Plan 04's startup sweep can re-subscribe against that `tool_call_id`.
- **Plan 05 (gates):** the LLM executors are the CONSUMER half of the retry-feedback pair (they read + append `ctx.retry_feedback`). Plan 05's gate-retry loop is the PRODUCER (it SETS `ctx.retry_feedback` before re-running). The full round-trip is jointly verified in 07-T2.
- **Plan 07 (seeds):** `split_topic` is registered for the Literature-review batch seed; the 4 seed shapes already parse + lint clean (Plan 01/02). The batch executor reads the upstream `sub_questions` list and fans out.

## Self-Check: PASSED
- Both created files (`programmatic.py`, `phase_types.py`) verified on disk.
- All 3 task commits (`46035e28`, `a140c455`, `59f2261c`) present in git history.
- No accidental file deletions.

---
*Phase: 091-harness-engine-5-phase-types-gates-whitelist*
*Completed: 2026-05-31*

---
phase: 091-harness-engine-5-phase-types-gates-whitelist
verified: 2026-05-31T12:00:00Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "SC#10 4-axis cross-provider UAT: run the plan_execute_verify seed on each of the 6 native providers (OpenAI, Anthropic, Google, DeepSeek, Moonshot, GLM/MiniMax) and confirm tool refusals are clean tool_results (no 400, no crash), gates fire, and the final output becomes the assistant chat message."
    expected: "All 6 providers complete the 3-phase workflow, the regex_match gate fires and retries on failure (emitting gate_failed SSE), the final phase output appears in the chat window — no provider-specific crash or silent drop."
    why_human: "Cross-provider live LLM calls cannot be driven programmatically in CI without live API keys; Chrome MCP UAT is required to exercise the real provider streaming branches end-to-end."
  - test: "SC#10 parallel-thread UAT: start a workflow run on Thread A (any seed), then immediately open Thread B and send a Deep-Mode message; confirm Thread B's chat is fully responsive and its mode toggle is not locked."
    expected: "Thread A is workflow-locked; Thread B's composer is enabled and responds normally (no global isStreaming lockout — BUG-260523-01 pattern)."
    why_human: "Thread isolation requires a live browser session with two threads open simultaneously; cannot be verified by grep or unit test."
  - test: "SC#10 long-message UAT: send a prompt with >= 50 prior messages in a thread that has an active workflow run, or a >= 5 KB user prompt, and confirm the engine drives the workflow phase to completion without truncation or timeout."
    expected: "Engine completes the phase, accumulated_outputs carries the full prior context, no wall-clock timeout triggered prematurely."
    why_human: "Context-length behavior requires a live session with real token counts; cannot be verified by mock."
  - test: "ask_user resume live smoke: start the doc_qa_human seed, close/restart the backend mid-ask, verify the ask_user prompt re-appears in the frontend after restart."
    expected: "After restart, the llm_human_input phase re-subscribes and re-emits the pending prompt; the user sees it in the panel and can answer; the workflow continues to the finalize phase."
    why_human: "Phase 096 (EVAL-02) owns the full kill-and-resume proof gate; this is a smoke check. Cannot be verified without a live uvicorn restart and Chrome MCP."
deferred:
  - truth: "A resumed workflow run has full inputs and model/user_settings available for programmatic + LLM phases (not just a run-identity ctx bag)"
    addressed_in: "Phase 092"
    evidence: "Phase 092 goal: 'Dual-Mode Wiring + Continue Button' owns workflow_runs creation + per-run context construction; WR-01 (resume ctx missing inputs) and WR-02 (resume ctx missing model/user_settings) are planted as SEED-047 with re_open_trigger: Phase 092 persists workflow_runs.inputs+model; Phase 096 EVAL-02 is the proof gate."
---

# Phase 091: Harness Engine + 5 Phase Types + Gates + Whitelist — Verification Report

**Phase Goal:** A user can run an agent through an ordered, locked workflow the LLM cannot escape — 5 phase types execute end-to-end, validation gates pass/fail with bounded retry, per-phase tool whitelists are enforced at the dispatcher, and phase state is durably resumable.
**Verified:** 2026-05-31
**Status:** human_needed — all automated checks GREEN (95/95 tests, 0 skips); 4 items require live cross-provider + parallel-thread + restart UAT per SC#10.
**Re-verification:** No — initial verification.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | **HARNESS-01**: Engine drives ordered transitions through all 5 phase types; LLM cannot reorder or skip | VERIFIED | `run_workflow` (harness_engine.py:359) iterates `phase_index` order; `PHASE_TYPE_REGISTRY` registered with all 5 executors at import time (phase_types.py:393–401); 95/95 tests GREEN including `test_engine_drives_ordered_transitions`, `test_phase_dispatch_routes_each_of_5_types`, and `test_each_seed_runs_end_to_end_mocked_llm` (4 seeds × parametrize). |
| 2 | **HARNESS-03**: 2-phase write (active-before-work, completed-after-durable-output); crash leaves phase `active`; startup sweep with CAS claim | VERIFIED | `mark_phase_active` called before `_run_phase_with_gates`; `complete_phase` single atomic UPDATE after `_persist_output`; `claim_run` is a real CAS via `claimed_at` lease (CR-01 fix: migration 062, workflows.py:298–341); `resume_stranded_workflows` wired into lifespan (main.py); `test_two_phase_write_active_before_completed`, `test_sweep_reruns_active_phase`, `test_claim_prevents_double_run` all pass. |
| 3 | **HARNESS-04**: 4 validator kinds, bounded retry ≤3 attempts, consecutive-identical short-circuit, validator error fed back, on_failure routing | VERIFIED | `validators.py` implements `json_schema`/`regex_match`/`workspace_file_exists`/`programmatic`; `_run_phase_with_gates` bounded loop (harness_engine.py:259–330); `GateResult.validator_index` threads the failing validator index (WR-03 fix); `ctx.retry_feedback` producer wiring confirmed; `test_bounded_retry_reaches_failed_after_3_attempts`, `test_consecutive_identical_short_circuits`, `test_retry_feeds_error_into_prompt` all pass. |
| 4 | **HARNESS-05**: Per-phase tool-whitelist at dispatch_tool; out-of-whitelist refused with clean tool_result; Deep Mode literal no-op | VERIFIED | `ToolContext.phase_whitelist` field added (tool_dispatcher.py:97); guard at top of `dispatch_tool` before `_TOOL_REGISTRY.get` (line 1531); `phase_whitelist is None` branch explicitly skips guard (byte-identical to pre-091); `_spawn_tool_refused_audit` fire-and-forgets the `tool_refused` audit row; `test_out_of_whitelist_refused_clean_tool_result`, `test_deep_mode_none_is_noop`, `test_refusal_audited` pass. |
| 5 | **HARNESS-07**: 4 seed templates ship as migration 061 (global, published, is_global=true); collectively exercise all 5 phase types; each parses + lints clean | VERIFIED | `supabase/migrations/061_harness_seed_templates.sql` exists; 4 INSERTs with `ON CONFLICT (id) DO NOTHING`; `grep -cE "programmatic|llm_single|llm_agent|llm_batch_agents|llm_human_input"` covers all 5; `test_each_seed_parses_via_model_validate`, `test_seeds_cover_all_5_phase_types`, `test_migration_061_definitions_match_four_seed_defs`, `test_4_seeds_lint_clean` pass. Full-schema.sql regenerated (operator checkpoint confirmed: `claimed_at` column present in full-schema.sql, consistent with migration 062 applied). |
| 6 | **TOOL-05**: `apply_tool_budget` filters by whitelist then caps at `max_tools`; whitelist tools always retained; absent model = no cap; Google rows populated; harness-path only | VERIFIED | `apply_tool_budget` in openai_service.py:787; `max_tools` key in `ModelCapability` TypedDict (config.py:161); 6 Google/Gemini model rows carry `max_tools=16` (config.py:220–234); `run_task_sub_agent` gains `tools_override` param (task_service.py:204); WR-04 fix wires `tools_override` in `_exec_llm_agent` + `_exec_llm_batch_agents` (phase_types.py:213, 255); no Deep-Mode `get_tools()` call site rewired; `test_budget_caps_at_max_tools`, `test_whitelist_tools_always_retained`, `test_no_cap_when_max_tools_absent` pass. |

**Score:** 6/6 truths verified (automated)

---

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Resume ctx includes run `inputs` for programmatic phases | Phase 092 | Phase 092 SC#1 owns workflow_runs creation; WR-01 planted as SEED-047 with re_open_trigger: workflow_runs.inputs persisted at creation → rehydrated into resume ctx; Phase 096 EVAL-02 is the proof gate. |
| 2 | Resume ctx includes `model`/`user_settings` for LLM phases | Phase 092 | WR-02 planted as SEED-047 alongside WR-01; same re_open_trigger. Deterministic unit proof for resume mechanics stands; live kill-and-resume deferred to Phase 096. |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/harness.py` | Finalized PhaseConfig discriminated union + all engine-read fields | VERIFIED | All 5 phase_type literals; `input_keys`, `wall_clock_seconds`, `options`/`timeout_seconds`, `model`/`temperature` overrides present; `extra="forbid"` on `_StrictBase`; `final_output` absent (D-11). |
| `backend/app/services/harness_engine.py` | `run_workflow` + `resume_stranded_workflows` + PHASE_TYPE_REGISTRY seam | VERIFIED | Both functions present; `mark_phase_active` before `complete_phase`; `_persist_output` stores inline (CR-02 fix); `PHASE_TYPE_REGISTRY` exported; `_run_phase_with_gates` bounded loop with WR-03 validator-index routing. |
| `backend/app/db/workflows.py` | Typed asyncpg helpers + `claim_run` lease CAS | VERIFIED | 9 helpers present; `workflow_run_id` column used in all workflow_phases reads (not bare `run_id`); `claimed_at` CAS in `claim_run`; `_AUDIT_EVENT_TYPES` frozenset validates at call site; `find_resumable_runs` + `ask_user_response_exists` (WR-06) + `get_pending_ask_user` (WR-05) all run-scoped. |
| `backend/app/services/harness/phase_types.py` | 5 executors registered in PHASE_TYPE_REGISTRY | VERIFIED | `PHASE_TYPE_REGISTRY_ENTRIES` with all 5 keys; `register_all()` called at module import; `tools_override` passed to `run_task_sub_agent` (WR-04); `phase_whitelist=frozenset(...)` on ToolContext; `system_prompt_override=phase.config.prompt`; `_retry_suffix(ctx)` consumer. |
| `backend/app/services/harness/validators.py` | VALIDATOR_REGISTRY (4 kinds) + GateResult + run_gates | VERIFIED | 4 kinds registered; `GateResult` namedtuple with `validator_index` field (WR-03); `jsonschema.validate` used (no hand-rolled); `run_gates` returns first failure with `_replace(validator_index=idx)`. |
| `backend/app/services/harness/reachability.py` | `lint_workflow` pure function; flags orphan/unsatisfiable-skip/no-terminal | VERIFIED | `lint_workflow` + `LintError` + `parse_skip_target` all present; 4 checks: BAD_INDEX + UNSATISFIABLE_SKIP + ORPHAN_PHASE + NO_TERMINAL; pure (no I/O). |
| `backend/app/services/harness/programmatic.py` | `PROGRAMMATIC_PHASE_REGISTRY` + `register_programmatic` + `split_topic` | VERIFIED | Closed dict; `split_topic` registered; idempotent (deterministic regex split, no LLM). |
| `backend/app/services/tool_dispatcher.py` | `ToolContext.phase_whitelist` + dispatch guard | VERIFIED | `phase_whitelist: "frozenset[str] | None" = None` on ToolContext; guard at top of `dispatch_tool` before `_TOOL_REGISTRY.get`; refusal is `ToolResult` with D-04 wording; `_spawn_tool_refused_audit` fire-and-forgets `tool_refused` audit. |
| `backend/app/services/openai_service.py` | `apply_tool_budget` helper | VERIFIED | Pure function at line 787; whitelist filter → budget cap; whitelist tools always retained; `SEED-035` comment present. |
| `backend/app/services/ask_user_service.py` | `resume_pending_prompt` (subscribe-before-emit) | VERIFIED | `resume_pending_prompt` present; uses `_subscribe_and_block` with `on_subscribed=_reemit` — subscribe happens BEFORE the emit hook fires; no duplicate durable row insert; single-sourced block primitive. |
| `backend/app/services/task_service.py` | Additive `system_prompt_override` + `tools_override` params | VERIFIED | Both keyword-only params with `None` defaults; `tools_override is not None` branch replaces sub-agent schema list; `_build_sub_agent_system_prompt` body unchanged; `resolve_sub_agent_model_safely` untouched. |
| `backend/app/config.py` | `harness_phase_max_steps`, `harness_phase_wall_clock_seconds`, `harness_resume_lease_seconds`, `max_tools` on ModelCapability | VERIFIED | `harness_phase_max_steps = 8` (Explorer alignment); `harness_phase_wall_clock_seconds = DEFAULT_LLM_CALL_TIMEOUT_SECONDS * 8 = 2400`; `harness_resume_lease_seconds = 300`; `max_tools: int` in ModelCapability TypedDict; 6 Gemini rows carry `max_tools: 16`. |
| `supabase/migrations/061_harness_seed_templates.sql` | 4 idempotent seed INSERTs; global+published | VERIFIED | 4 INSERTs, 4 `ON CONFLICT (id) DO NOTHING`, all 5 phase_type literals present, `is_global = true`, `status = 'published'`, seed system user `'00000000-0000-0000-0000-000000000001'`. |
| `supabase/migrations/062_workflow_run_claim_lease.sql` | `claimed_at timestamptz` lease column (CR-01) | VERIFIED | `ADD COLUMN IF NOT EXISTS claimed_at timestamptz`; idempotent; applied (confirmed by `claimed_at` present in `supabase/full-schema.sql` at line 748). |
| `backend/tests/test_harness_engine.py` + 6 other test files | All harness contracts live (0 skips) | VERIFIED | 95/95 tests passed, 0 skips, 1.29s runtime (run against live DB with migrations 060+061+062 applied). |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `harness_engine.run_workflow` | `db/workflows.mark_phase_active` | Called before `_run_phase_with_gates` | WIRED | harness_engine.py:413 |
| `harness_engine.run_workflow` | `db/workflows.complete_phase` | Called after `_persist_output` | WIRED | harness_engine.py:482 |
| `harness_engine.run_workflow` | `run:{run_id}` via `_emit` | `phase_started`/`phase_completed`/`phase_transition`/`run_completed` events | WIRED | harness_engine.py:421–530 |
| `harness_engine.resume_stranded_workflows` | `db/workflows.claim_run` | CAS claim before re-running | WIRED | harness_engine.py:625; claim before `_resume_run` |
| `harness/phase_types._exec_llm_agent` | `task_service.run_task_sub_agent` | `allowed_tools` + `system_prompt_override` + `tools_override` | WIRED | phase_types.py:225–233 |
| `harness/phase_types._exec_llm_batch_agents` | `task_service.run_task_sub_agent` | Semaphore-bounded gather with `tools_override` | WIRED | phase_types.py:266–277 |
| `harness/phase_types` | `harness_engine.PHASE_TYPE_REGISTRY` | `register_all()` at module import | WIRED | phase_types.py:393–405 |
| `tool_dispatcher.dispatch_tool` | `harness_audit` (tool_refused) | `_spawn_tool_refused_audit` fire-and-forget | WIRED | tool_dispatcher.py:1533 |
| `openai_service.apply_tool_budget` | `MODEL_CAPABILITIES[model].max_tools` | Budget guard reads per-provider ceiling | WIRED | openai_service.py:823 |
| `harness_engine.resume_stranded_workflows` | `app.main` lifespan startup | Background task after pool + redis ready | WIRED | main.py:218–224 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `harness_engine.run_workflow` | `accumulated_outputs` | `load_run_phases` + phase executor return | Yes — durable `workflow_phases.output` rows + executor output dicts | FLOWING |
| `harness_engine.run_workflow` | `ctx.final_output` | Last phase's `output` dict (D-10, no synthesis LLM) | Yes — the real executor output | FLOWING |
| `harness/phase_types._exec_llm_single` | `content` | `_stream_one_iteration` return | Real LLM call (mocked in tests, real in prod) | FLOWING |
| `harness/phase_types._exec_llm_agent` | `result["summary"]` | `run_task_sub_agent` return | Real sub-agent run | FLOWING |
| `tool_dispatcher.dispatch_tool` | guard branch | `ctx.phase_whitelist` | Set by harness executor `_build_phase_tool_context` | FLOWING (None in Deep Mode → no-op) |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| harness models import | `cd backend && venv/Scripts/python -c "from app.models.harness import WorkflowDefinition; print('ok')"` | `ok` | PASS |
| PHASE_TYPE_REGISTRY has all 5 keys | `cd backend && venv/Scripts/python -c "import app.services.harness; from app.services.harness_engine import PHASE_TYPE_REGISTRY; assert set(PHASE_TYPE_REGISTRY) == {'programmatic','llm_single','llm_agent','llm_batch_agents','llm_human_input'}; print('ok')"` | `ok` | PASS |
| ToolContext has phase_whitelist | `cd backend && venv/Scripts/python -c "from app.services.tool_dispatcher import ToolContext; assert 'phase_whitelist' in ToolContext.__dataclass_fields__; print('ok')"` | `ok` | PASS |
| apply_tool_budget importable | `cd backend && venv/Scripts/python -c "from app.services.openai_service import apply_tool_budget; print('ok')"` | `ok` | PASS |
| Full harness test suite | `cd backend && venv/Scripts/python -m pytest tests/test_harness_*.py tests/test_tool_budget.py -q` | `95 passed, 1 warning in 1.29s` | PASS |

---

### Requirements Coverage

| Requirement | Plans | Description | Status | Evidence |
|------------|-------|-------------|--------|----------|
| HARNESS-01 | 01, 02, 03 | Ordered locked workflow, 5 phase types, LLM cannot reorder | SATISFIED | 5 executors registered in PHASE_TYPE_REGISTRY; engine drives transitions by `phase_index`; `test_phase_dispatch_routes_each_of_5_types` + `test_engine_drives_ordered_transitions` GREEN |
| HARNESS-03 | 01, 02, 04, 08 | Resumable run; 2-phase write; startup sweep + claim | SATISFIED | `mark_phase_active` before `complete_phase`; `claim_run` lease CAS (CR-01); `resume_stranded_workflows` lifespan-wired; all resume test contracts GREEN (WR-01/WR-02 deferred to Phase 092 — known limitation documented as SEED-047) |
| HARNESS-04 | 01, 05 | Validation gates; bounded retry; on_failure routing; caps | SATISFIED | 4 validator kinds in VALIDATOR_REGISTRY; `_run_phase_with_gates` ≤3 attempts; consecutive-identical short-circuit; `gate_failed` audit+emit; `skip_to_phase`/`fail_run` routing; `asyncio.wait_for` wall-clock cap; step cap inside executors |
| HARNESS-05 | 01, 06, 08 | Per-phase tool-whitelist in dispatch_tool; Deep Mode no-op | SATISFIED | `ToolContext.phase_whitelist` field; guard at top of `dispatch_tool`; `phase_whitelist is None` is literal no-op; `tool_refused` audit; all whitelist test contracts GREEN |
| HARNESS-07 | 01, 07 | 2–3 seed workflow templates (shipped 4); global + published; end-to-end | SATISFIED | Migration 061 (4 seeds, all 5 phase types, ON CONFLICT idempotent); all 4 seeds run end-to-end through the engine (mocked LLM); `test_each_seed_runs_end_to_end_mocked_llm` parametrized over 4 seeds GREEN; operator checkpoint confirmed (migration applied, full-schema.sql regenerated) |
| TOOL-05 | 01, 06, 08 | Tool-count budget at get_tools; max_tools on ModelCapability; Google populated | SATISFIED | `apply_tool_budget` pure helper; `max_tools: int` on TypedDict; 6 Gemini rows carry `max_tools: 16`; `tools_override` wired through `run_task_sub_agent` (WR-04); not wired into Deep-Mode `get_tools()` call sites (SC#2 preserved) |

**No orphaned requirements:** HARNESS-02 (Phase 090) and HARNESS-06 (Phase 090 substrate, Phase 091 audit trail via `write_audit` at every transition) are not claimed by Phase 091 plans and are not blocked by this phase.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `harness_engine.py` | 559–579 | `_build_resume_context` creates a `SimpleNamespace` without `inputs`/`model`/`user_settings` | Warning | WR-01/WR-02 — known limitation; deferred to Phase 092. Documented in docstring and SEED-047. No correctness impact on the resume mechanics unit proof. |
| `harness/phase_types.py` | 75–92 | `_prior_output_text` concatenates ALL prior phases (IN-03) | Info | When `len(texts) > 1`, the user-turn is a join of all phase texts, not just the latest. Docstring is imprecise. No correctness impact; intentional running-context behavior. |

**No blockers found.** The WR-01/WR-02 limitation is a known deferral with a concrete re-open trigger (Phase 092) documented in SEED-047 and the phase deferred-items file. It does not affect the deterministic unit proofs.

---

### Human Verification Required

The automated harness suite is fully GREEN (95/95, 0 skips). The following items require live cross-provider + multi-thread + restart testing per SC#10:

#### 1. SC#10 Cross-Provider Workflow UAT (6 native providers)

**Test:** Start the `plan_execute_verify` seed on each of the 6 native providers (OpenAI, Anthropic, Google/Gemini, DeepSeek, Moonshot/Kimi, GLM). On each provider, submit a prompt that should trigger the execute phase's `execute_code`/`write` tools, confirm the regex_match gate fires, and the final output appears in the chat window.
**Expected:** All 6 providers complete the 3-phase workflow. Tool refusals (if a tool outside the phase whitelist is hallucinated) return a clean tool_result with no 400. The gate_failed event appears in the panel on a failing attempt; gate_passed on success. The final llm_single output becomes the assistant message.
**Why human:** Live LLM calls required; provider-specific streaming primitives must be validated end-to-end; Chrome MCP drives the UI verification.

#### 2. SC#10 Parallel-Thread UAT (Thread A workflow, Thread B Deep Mode)

**Test:** Start a long-running `research_summarize` workflow on Thread A. While it is streaming, open Thread B, send a Deep-Mode prompt, and attempt to toggle Thread B's mode.
**Expected:** Thread A's workflow runs uninterrupted. Thread B's composer is fully functional; its mode toggle is not locked by Thread A's workflow state. Thread B's Deep-Mode response streams normally.
**Why human:** Thread isolation under live concurrent streaming cannot be verified by unit test; requires Chrome MCP with two active threads.

#### 3. SC#10 Long-Message UAT

**Test:** In a thread with >= 50 prior messages, start a `literature_review` seed workflow. Confirm the programmatic split_topic phase processes the topic correctly and the batch phase fans out.
**Expected:** The engine drives all 3 phases to completion without wall-clock timeout, accumulated_outputs is populated from the durable rows, and the final merge output appears as the assistant message.
**Why human:** Context-length behavior requires a live session with real prior messages.

#### 4. ask_user Resume Smoke (live restart)

**Test:** Start the `doc_qa_human` seed. When it reaches the `llm_human_input` phase and the ask_user prompt appears, restart the uvicorn backend. After restart, confirm the ask_user prompt re-appears in the frontend.
**Expected:** After the startup sweep runs, the pending ask_user prompt is re-emitted; the user can answer and the workflow continues to the `finalize` phase.
**Why human:** Requires a live uvicorn restart; Phase 096 EVAL-02 owns the full kill-and-resume proof gate. This is a smoke check.

---

### Gaps Summary

No gaps blocking goal achievement. All 6 requirements (HARNESS-01, HARNESS-03, HARNESS-04, HARNESS-05, HARNESS-07, TOOL-05) are satisfied by the implemented code. The code-review defects (CR-01, CR-02, WR-03, WR-04, WR-05, WR-06) were all fixed in Plan 091-08. The known WR-01/WR-02 resume-context limitations are intentional deferrals to Phase 092 (documented in SEED-047 with a concrete re-open trigger).

The `status: human_needed` reflects the SC#10 4-axis cross-provider UAT requirement (CLAUDE.md mandatory rule), which by definition cannot be satisfied by the automated harness alone.

---

_Verified: 2026-05-31_
_Verifier: Claude (gsd-verifier)_

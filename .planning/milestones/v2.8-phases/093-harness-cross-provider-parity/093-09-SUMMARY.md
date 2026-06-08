---
phase: 093-harness-cross-provider-parity
plan: 09
subsystem: api
tags: [harness, sub-agent, max_steps, glm, zhipu, cross-provider, force-synthesis, step-cap]

# Dependency graph
requires:
  - phase: 093-06
    provides: "D-20 log-sink (logs/backend.log) — the per-iteration evidence trail used to scan the live GLM run"
  - phase: 093-07
    provides: "finish-event consumption + reasoning_content/thought_signature round-trip + runs.usage persist (S4) — ruled out the 'softer reasoning manifestation' hypothesis (GLM still hit the cap after 093-07)"
  - phase: 093-08
    provides: "intentional sub-agent model resolution — confirmed the GLM run recorded model=glm-4.6 (NOT gpt-4o), so the diagnosis read the RIGHT provider"
provides:
  - "Force-synthesis fallback on sub-agent max_steps exhaustion — ANY provider's sub-agent that runs out of steps while still researching now writes a real answer instead of returning a placeholder (closes the general silent-failure class)"
  - "Effective harness per-phase step cap raised 8 -> 12 (genuine 12 via the three-knob lockstep) — headroom for thorough sub-agents to finish naturally"
  - "Regression test backstop (test_093_glm_max_steps.py) — exhaustion synthesizes, convergence is byte-identical, synthesis-failure is graceful"
affects: [093-VALIDATION (D-21 re-UAT), 094, 096-eval]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Force-synthesis-on-exhaustion: a bounded agent loop's else-branch makes ONE final tools=[] turn so it always returns a synthesized answer (vs a useless placeholder)"
    - "Sentinel-equality step-cap substitution must be raised in LOCKSTEP across all three knobs (Settings cap + phase_types sentinel + Pydantic config default) to change the EFFECTIVE cap"

key-files:
  created:
    - "backend/tests/test_093_glm_max_steps.py"
  modified:
    - "backend/app/services/task_service.py"
    - "backend/app/config.py"
    - "backend/app/services/harness/phase_types.py"
    - "backend/app/models/harness.py"
    - "backend/tests/test_harness_engine.py"
    - "backend/tests/test_harness_gates.py"

key-decisions:
  - "Root cause = Branch B (step-cap too low) + a GENERAL silent-failure gap — pinned with a LIVE GLM literature_review run + LangSmith trace + DB runs rows + the D-20 log-sink, NOT guessed"
  - "Authorized branch = hybrid B+: PRIMARY force-synthesis fallback (the guarantee, all providers) + COMPLEMENT effective cap raise to 12 (the headroom)"
  - "The step-cap clamp is a sentinel-EQUALITY substitution (not min()), so all THREE knobs raised in lockstep to make the effective cap genuinely 12"
  - "093 closes 7/7 (NOT 6/7) — GLM now converges via the fallback; no provider deferred"

patterns-established:
  - "When a bounded agent loop exhausts its budget, synthesize a final answer from accumulated context instead of returning a placeholder — provider-agnostic reliability fix"

requirements-completed: [PARITY-02]

# Metrics
duration: ~30min
completed: 2026-06-02
---

# Phase 093 Plan 09: GLM Sub-Agent max_steps Convergence (D-19) Summary

**Force-synthesize on sub-agent max_steps exhaustion (ANY provider) + raise the effective harness per-phase step cap 8 -> 12 — closes the LIVE-UAT GLM silent-failure (a thorough batch sub-agent hit the cap WHILE STILL RESEARCHING and leaked a placeholder into the merged review); 093 closes 7/7.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-06-02T21:20:00Z (approx)
- **Completed:** 2026-06-02T21:50:04Z
- **Tasks:** 1 executed (Task 2; Task 1 diagnosis was operator-resolved before this run)
- **Files modified:** 6 (4 source/test source, 1 new test, 2 repinned test-knob assertions)

## Pinned Root Cause (Task 1 — operator-resolved with live evidence)

DO-NOT-re-investigate: settled before this executor ran. **Branch B (step-cap too low), confirmed via a LIVE GLM literature_review run** (thread `71502600-4c65-4ab9-9f6c-42b51ef93940`, workflow_run `f3cffe56`, run `7db77efa`) + LangSmith trace (project `agentic-rag-module2`) + DB `runs` rows + the D-20 log-sink:

- The workflow **SUCCEEDED end-to-end** (merge produced a full ~8,118-char literature review). But the `review` phase (a 3-way `llm_batch_agents` fan-out) had ONE sub-agent — the "RPA integration challenges" sub-question — hit the 8-step cap WITHOUT writing its section, returning the placeholder `"Sub-agent reached max_steps without producing a final answer."` (leaked into the merged review as a thin "Result 1"). The other two GLM sub-agents converged.
- **DB `runs` rows** (all `model=glm-4.6` — 093-08 verified working, NOT gpt-4o; all non-null tokens — 093-07/S4 verified working): the looping sub-agent = 64,060 in / 210 out (searched the most, never wrote); converged ones = 16,705/1,789 and 60,636/2,139.
- **LangSmith:** the looping sub-agent issued 8 DISTINCT, progressively-refined search queries (broad theme → technical → organizational → academic authors → specific mechanisms) — genuine thorough research, NOT a stuck repetitive loop. `finish_reason: tool_calls` throughout → GLM uses NATIVE tool calls (glm-4.6 is registry `native_tools:True`), so the STRUCTURED post-parse is NOT the loop path → rules out **Branch C** (structured re-loop) AND **Branch D** (deep provider defect). The CSF sub-agent converged at EXACTLY step 8 (the cap edge); digital-maturity at ~step 5 — proving GLM knows how to stop and write; the budget just sat on the knife's edge.
- This is really a **GENERAL reliability gap**: any thorough sub-agent (any provider) still searching at the cap returns that useless placeholder. GLM trips it most because it searches more granularly.
- Read-only diagnostic scripts (in `scripts/`, NOT under `backend/`): `scripts/diag_093_09_glm.py` (DB run tree) + `scripts/diag_093_09_langsmith.py` (trace). Left in place.

## Authorized Branch (hybrid B+)

1. **PRIMARY — force-synthesize on exhaustion.** The `for step in range(max_steps): ... else:` block in `run_task_sub_agent` now makes ONE final TOOL-FREE synthesis turn so the sub-agent ALWAYS returns a real answer. Closes the silent-failure class for ALL providers.
2. **COMPLEMENT — effective cap raise to 12** so thorough agents usually finish naturally before the fallback fires.

## Accomplishments

- **Force-synthesis fallback** (`task_service.py` `run_task_sub_agent` else-branch): on max_steps exhaustion, append a no-more-tools nudge to the accumulated `messages` and make ONE more `_stream_one_iteration(... tools=[] ...)` call. The `tools=[]` is load-bearing — the 093-05 WR-01 gate (`_has_tools = bool(tools)`) SKIPS the STRUCTURED inject + `parse_structured_tool_calls` post-parse, so the synthesized answer is never blanked. Same `_sub_usage` box (tokens keep accumulating, S4/D-17); fresh `reasoning_box`. Wrapped in try/except + `logger.exception` → never crashes; falls back to last content then the original placeholder (T-093-09-DOS). Additive + fires ONLY in the exhaustion branch → byte-identical for converging agents.
- **Effective per-phase step cap 8 -> 12** raised in LOCKSTEP across the three knobs (the clamp is a sentinel-EQUALITY substitution `if config.max_steps == _MODEL_DEFAULT_MAX_STEPS: -> _EXPLORER_STEP_CAP`, NOT a `min()` — so all three must move together):
  - `config.py`: `harness_phase_max_steps` 8 -> 12 (drives `_EXPLORER_STEP_CAP`); `harness_phase_wall_clock_seconds` kept coupled 300×8=2400 -> 300×12=3600
  - `phase_types.py`: `_MODEL_DEFAULT_MAX_STEPS` 10 -> 12
  - `models/harness.py`: `LlmAgentPhaseConfig.max_steps` + `LlmBatchAgentsPhaseConfig.max_steps` default 10 -> 12
- **Regression test** (`test_093_glm_max_steps.py`, 3 cases, all network mocked).

### Clamp-math note (the genuine effective 12)

The plan's implementation_guidance assumed a `min(config.max_steps or _MODEL_DEFAULT_MAX_STEPS, _EXPLORER_STEP_CAP)` clamp. The ACTUAL code is a **sentinel-equality substitution**: `max_steps = phase.config.max_steps; if max_steps == _MODEL_DEFAULT_MAX_STEPS: max_steps = _EXPLORER_STEP_CAP` (phase_types.py:265-267 / :327-329). Implications I verified directly:
- The seed templates do NOT set `max_steps`, so Pydantic applies the model default at parse time → `phase.config.max_steps` equals the model default → the sentinel substitution fires → effective cap = `_EXPLORER_STEP_CAP`.
- Raising ONLY `_MODEL_DEFAULT_MAX_STEPS` 10 -> 12 (per the guidance's literal instruction) WITHOUT also raising the Pydantic model defaults would STOP the substitution (the parsed config would still be 10, != 12) and pin the effective cap at 10.
- Correct fix for a genuine effective 12: raise all THREE (Settings cap + sentinel + the two Pydantic config defaults) in lockstep, so `config-default(12) == _MODEL_DEFAULT_MAX_STEPS(12) -> _EXPLORER_STEP_CAP(12)`. Verified live: `_DEFAULT_PHASE_MAX_STEPS == 12`, `LlmAgentPhaseConfig().max_steps == 12`, and `_exec_llm_agent` threads `max_steps == 12` to the sub-agent.

## Task Commits

1. **Task 2 (PRIMARY): force-synthesis fallback** - `4e4eb27f` (fix)
2. **Task 2 (COMPLEMENT): effective cap raise 8 -> 12** - `725525d0` (feat)
3. **Task 2 (test): GLM max_steps regression + cap-default repins** - `28ad5dff` (test)

**Plan metadata:** (final docs commit — see below)

## Files Created/Modified

- `backend/app/services/task_service.py` - force-synthesis turn in `run_task_sub_agent`'s exhaustion else-branch (the silent-failure fix)
- `backend/app/config.py` - `harness_phase_max_steps` 8 -> 12 + `harness_phase_wall_clock_seconds` 2400 -> 3600
- `backend/app/services/harness/phase_types.py` - `_MODEL_DEFAULT_MAX_STEPS` 10 -> 12 + clamp-math doc
- `backend/app/models/harness.py` - `LlmAgentPhaseConfig` / `LlmBatchAgentsPhaseConfig` `max_steps` default 10 -> 12 (lockstep)
- `backend/tests/test_093_glm_max_steps.py` (new) - 3 regression cases
- `backend/tests/test_harness_engine.py` - LOCKED-default assertions repinned 10/8 -> 12
- `backend/tests/test_harness_gates.py` - `_DEFAULT_PHASE_MAX_STEPS` sanity assertion 8 -> 12

## Decisions Made

- **7/7 close posture (NOT 6/7).** The fix is bounded + in-phase: GLM now converges via the force-synthesis fallback (and usually finishes naturally within the raised cap). No provider is deferred. OpenAI/Anthropic/DeepSeek/MiniMax (the 4 already-passing) + Google + Moonshot (093-07) + GLM all GREEN on the deterministic surface; the LIVE D-21 re-UAT (verifier-owned, 093-VALIDATION.md) is the BINDING gate.
- **Provider-agnostic, not GLM-scoped.** The force-synthesis fallback fires for ANY provider on exhaustion. This is intended — it closes the silent-failure class generally. No provider-specific branching added.
- **No SEED needed.** Branch D (defer-with-trigger) was NOT taken, so no `SEED-051-glm-zhipu-max-steps.md`. (Note: `SEED-051` is already in use for an unrelated NL→workflow-authoring concept per recent commits — irrelevant here since we did not defer.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Raised the two Pydantic config `max_steps` defaults (models/harness.py) in lockstep**
- **Found during:** Task 2 (effective cap raise)
- **Issue:** The plan's `files_modified` listed only `phase_types.py` + `config.py` + the test. But the actual step-cap clamp is a sentinel-EQUALITY substitution (NOT the `min()` the guidance assumed). Raising `_MODEL_DEFAULT_MAX_STEPS` 10 -> 12 WITHOUT also raising `LlmAgentPhaseConfig.max_steps` / `LlmBatchAgentsPhaseConfig.max_steps` (which Pydantic applies as the parsed default for seed phases) would have STOPPED the substitution and silently pinned the effective cap at 10 — the exact trap the guidance flagged ("make the effective cap genuinely 12").
- **Fix:** Raised both Pydantic model `max_steps` defaults 10 -> 12 so `config-default == _MODEL_DEFAULT_MAX_STEPS` and the substitution keeps firing → genuine effective cap 12.
- **Files modified:** `backend/app/models/harness.py`
- **Verification:** `_DEFAULT_PHASE_MAX_STEPS == 12`, `LlmAgentPhaseConfig().max_steps == 12`, `_exec_llm_agent` threads `max_steps == 12`; the omitted-max_steps clamp test asserts 12 GREEN.
- **Committed in:** `725525d0` (Task 2 cap-raise commit)

**2. [Rule 1 - Test maintenance] Repinned three test assertions to the new cap values**
- **Found during:** Task 2 (cap raise)
- **Issue:** Three tests pinned the OLD cap defaults — `test_harness_engine.py:90` (`cfg.max_steps == 10`), `test_harness_engine.py:604` (omitted-max_steps clamp `== 8`), `test_harness_gates.py:314` (`_DEFAULT_PHASE_MAX_STEPS == 8`). These directly assert the exact knobs the plan intentionally changes.
- **Fix:** Repinned all three to 12. (The EXPLICIT-`max_steps:8` round-trip test at `test_harness_engine.py:78` was left UNCHANGED — an explicit non-default value still passes through, correctly.)
- **Files modified:** `backend/tests/test_harness_engine.py`, `backend/tests/test_harness_gates.py`
- **Verification:** all repinned tests GREEN.
- **Committed in:** `28ad5dff` (Task 2 test commit)

---

**Total deviations:** 2 auto-fixed (1 blocking [the lockstep model-default raise — required for the documented effective-12 intent], 1 test maintenance).
**Impact on plan:** Both essential. The lockstep raise is the correct way to achieve the plan's stated effective-cap-12 intent given the real (sentinel-substitution) clamp. No scope creep — confined to the harness step-cap surface + its tests.

## Issues Encountered

- **Full-suite baseline noise (NOT regressions).** Full backend suite = 112 failed / 1121 passed (vs the 093-08-documented baseline 111/1119). The touched-surface failures are all PRE-EXISTING and confirmed unrelated to this change:
  - 4× `test_085_sub_agent_cross_provider::test_cross_provider_default_path_no_footgun[anthropic/google/deepseek/moonshot]` — stale `llm_models` CSV fixture from the 093-03 `available_models` migration. **Confirmed reproduce on baseline** (ran the file before any edit: 4 failed). KNOWN/deferred.
  - 1× `test_harness_gates::test_bounded_retry_reaches_failed_after_3_attempts` — cross-file registry pollution. **Confirmed reproduce both in isolation AND on a `git stash` baseline** (1 failed / 10 passed). Documented in 093-05 SUMMARY + deferred-items.md.
  - 1× `test_093_log_sink::test_opt_in_no_env_returns_none_and_installs_no_handler` — the +1 vs the 093-08 baseline. **Confirmed reproduce on a `git stash` baseline.** Root cause: the operator set `LOG_FILE_PATH=logs/backend.log` in `backend/.env` to activate the D-20 log-sink for the D-21 re-UAT (exactly per the 093-06 SUMMARY instruction); the opt-in test asserts "no env → no handler" and the loaded `.env` value makes that assertion fail. Pure environment-state artifact, nothing to do with this plan.
  - The remaining ~106 failures are the documented flaky baseline cluster (`test_retrieval_service`, `test_sandbox_service`, `test_sql_service`, `test_phase56`, `test_streaming_reliability`) — all outside the harness/task_service surface.
- **Net-new failures attributable to 093-09 = ZERO.**

## Verification

- `pytest backend/tests/test_093_glm_max_steps.py -x` → **3 passed** (GREEN).
- Touched-surface suite (`test_harness_engine` + `test_085_task_service` + `test_sub_agent_routing` + `test_093_glm_max_steps` + `test_harness_templates` + `test_harness_resume`) → **134 passed, 0 failed**.
- Full harness suite (`test_harness_gates` + `test_harness_templates` + `test_harness_engine` + `test_harness_resume` + `test_tool_budget` + `test_093_glm_max_steps`) → **86 passed, 1 failed** (the single KNOWN `test_bounded_retry` pollution failure).
- `py_compile` clean on all 4 touched source files + the new test.
- **D-14 byte-identical-Deep guard:** `git diff --stat backend/app/services/sub_agent_service.py backend/app/services/agent_loop.py` → **NO output** (zero diff). RED LINE held.
- Post-commit deletion check on all 3 commits → no deletions.

## TDD Gate Compliance

This is a `type: execute` gap-closure plan (not `type: tdd`). The regression test + the impl shipped across discrete commits: `fix(...)` (4e4eb27f) + `feat(...)` (725525d0) + `test(...)` (28ad5dff). The test was authored after the impl in the same task; both were verified GREEN together. No discrete RED commit — consistent with the 093-06/07/08 gap-closure convention.

## User Setup Required

None — no external service configuration. (Note: the operator's existing `LOG_FILE_PATH=logs/backend.log` in `backend/.env`, set for the D-21 re-UAT, causes one pre-existing log-sink opt-in test to fail; harmless, see Issues Encountered.)

## Next Phase Readiness

- 093-09 is the LAST gap-closure plan. With it shipped, the deterministic half of all 093 gap-closures (D-16..D-21) is complete.
- **NEXT:** the verifier-owned D-21 re-UAT (093-VALIDATION.md) — the BINDING gate. Drive the native-7 × 5-phase-type × 4-workflow LIVE UAT (especially the GLM literature_review cell) and confirm: (1) the looping sub-agent now writes a real section (no placeholder leak); (2) thorough agents finish within the raised 12-step cap; (3) Deep stays byte-identical across all 7. PARITY-02 closes 7/7 when the LIVE UAT passes.

## Self-Check: PASSED

- Created files verified present: `backend/tests/test_093_glm_max_steps.py`, `093-09-SUMMARY.md`, and all 4 modified source files.
- Commits verified in git log: `4e4eb27f` (fix), `725525d0` (feat), `28ad5dff` (test).

---
*Phase: 093-harness-cross-provider-parity*
*Completed: 2026-06-02*

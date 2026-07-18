---
phase: 129-minimax-openrouter-arg-repair
verified: 2026-06-27T00:00:00Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: null
  note: "Initial verification — no prior VERIFICATION.md existed."
---

# Phase 129: MiniMax/OpenRouter Arg Repair Verification Report

**Phase Goal:** Broader provider robustness — MiniMax malformed tool-call args are repaired/recovered at the OpenAI-compat adapter boundary (run continues via a single-shot re-ask, or fails honestly — never a silent swallow or fabricated/partial dispatch) + OpenRouter requests carry `require_parameters` so routed models honor the tool schema. Backend-only, provider-scoped, off the shared path (D-14 red line).
**Verified:** 2026-06-27
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

This phase delivers its goal. Both halves of MP-04 are implemented at the exact seams the locked decisions (D-01/D-02/D-03) specify, the code is genuinely provider-gated (D-14 RED LINE proven additive: 176 insertions / 0 deletions in `agent_loop.py`), the unit coverage is real and green (12 passed), and the load-bearing SC#10 live scoreboard was operator-run and signed off. The two repair *firing* rungs (recovered / honest-fail) were not live-observed because the bug's trigger (the MiniMax-M3 8192 output-token cap) is now dormant (ran to 9987 tok live with zero truncation) — this is an honest, documented dormancy of the trigger, NOT a missing implementation: the repair logic exists and is unit-proven. Per the verification context, this is correctly assessed as a non-gap.

### Observable Truths

| #   | Truth (must-have) | Status     | Evidence |
| --- | ----------------- | ---------- | -------- |
| 1   | **SC#2 / D-02:** OpenRouter quality-strategy request carries `extra_body['provider']={'require_parameters': True}` alongside `response-healing` plugin + `:exacto` suffix | ✓ VERIFIED | `openai_service.py:1631` inside the `provider=="openrouter"` (1619) ∩ `openrouter_tool_strategy=="quality"` (1611) double-gate. Live R9 run `993435f5` — full tool round-trip, NO 404/422 (OpenRouter API accepts the field). `test_require_parameters_quality_only` green. |
| 2   | **D-02:** native/xml strategy → NO `provider` key (opt-in only) | ✓ VERIFIED | Blocked by the strategy guard at 1611. `test_native_strategy_has_no_provider_key` + `test_xml_strategy_has_no_provider_key` assert absence; both green. R8 baseline (native) routes cleanly with flag ABSENT. |
| 3   | **D-02 / D-14:** non-OpenRouter provider (openai/anthropic/google) is byte-identical — injection never fires for the shared path | ✓ VERIFIED | Blocked by the `provider=="openrouter"` gate at 1619. `test_non_openrouter_provider_unaffected` (openai+quality → no `provider`/`plugins`/`:exacto`) green. Grep: exactly ONE executable `require_parameters` at 1631. Live R1/R2/R3 (openai/anthropic/google) completed with no change. |
| 4   | **D-02:** `config.py` D-15 directive comment reconciled to the now-wired state | ✓ VERIFIED | `config.py:344-348` now reads "WIRED in Phase 129 (D-02 / MP-04) … at openai_service.py"; D-15 reference + registry rows preserved (comment-only). |
| 5   | **SC#1 / D-01 / D-03:** invalid-JSON MiniMax tool-args DETECTED at the assistant-message build seam (after `tool_calls = list(...)` @2118, before `messages.append` @2215) via `json.loads`, independent of `finish_reason` | ✓ VERIFIED | `_minimax_args_all_valid` @108 does `json.loads(tc["arguments"])` in try/except, no `finish_reason` dependency (Pitfall 2). Seam delegates via `minimax_argrepair_decision` @2148, gated on `_resolved_provider`. `test_truncated_args_detected` green + behavioral spot-check. |
| 6   | **D-03 / D-14:** validity guard provider-gated to MiniMax (resolved provider, not model string); non-MiniMax round-trip byte-identical | ✓ VERIFIED | Helper @154: `if resolved_provider != "minimax": return "ok"`. Diff is purely additive (176 ins / 0 del) → round-trip block byte-identical. `test_non_minimax_unaffected` parametrized over openai/anthropic/google green. Live R1-R3 inert. |
| 7   | **D-01:** invalid args → bad turn NOT appended → single bounded re-ask on a SEPARATE counter not consuming `_provider_retries` | ✓ VERIFIED | `reask` branch @2154: increments `_minimax_argrepair_retries` (init @1302, distinct from `_provider_retries` @1589), injects `MINIMAX_ARGREPAIR_NUDGE`, `continue` — bad turn never appended. Cap=1 via `argrepair_retries < 1` @159. `test_reask_bounded_separate_counter` green. |
| 8   | **D-01:** still-malformed re-ask → honest `message_for_kind("bad_request")` copy; never silent swallow / fabricated / partial dispatch (no brace-balancing) | ✓ VERIFIED | `honest_fail` branch @2176-2196: emits the verbatim copy "Model parameter error — this model may not support the current configuration." (`errors.py:188`), error event, `break`. No brace-balancing anywhere (helper docstring + `test_still_malformed_honest_fail` asserts absence of `rstrip('}')` / `+ '}'`). |
| 9   | **D-01:** successful re-ask emits ONE quiet `tool_args_recovered` via Deep-side `_emit(redis, run_id, ...)` — NOT harness `forced_emit` | ✓ VERIFIED | `recovered` branch @2197-2211: single `_emit(redis, run_id, 'tool_args_recovered', ...)`, no delta/error. `test_recovered_signal_emitted` asserts exactly-one emit + no `forced_emit(`/`_emit_audit(`. Quiet (Phase-122 family). |
| 10  | **MP-04:** BUG-260607-03 frontmatter `status: folded`, `folded_into: 129`; guard addresses the bug class | ✓ VERIFIED | `.planning/reported-bugs/minimax-m3-invalid-tool-args-400.md` frontmatter: `status: folded`, `folded_into: 129`; body "## Fix" points at commit `876996c7`. |
| 11  | **D-14 RED LINE (live):** shared `messages.append` round-trip byte-identical for non-MiniMax; change purely additive | ✓ VERIFIED | `git show 876996c7 --numstat` → `176  0  agent_loop.py` (0 deletions). Deletion grep on the diff returns 0. Live R1-R3 confirm no recovered signal / no error on openai/anthropic/google. |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `backend/app/services/openai_service.py` | `require_parameters` injection in quality block | ✓ VERIFIED | Line 1631, inside double-gate; substantive, wired, fires only on openrouter+quality |
| `backend/app/config.py` | D-15 comment reconciled | ✓ VERIFIED | Lines 344-348 reconciled to "WIRED in Phase 129"; no registry value changed |
| `backend/app/services/agent_loop.py` | MiniMax-gated guard + ladder at round-trip seam | ✓ VERIFIED | Helpers @100-159, counter @1302, seam @2118-2213; provider-gated, additive |
| `backend/tests/test_129_openrouter_require_params.py` | 4 unit tests on assembled extra_body shape | ✓ VERIFIED | Real (drives `create_adaptive_streaming_chat` via spy); 4 passed |
| `backend/tests/test_129_minimax_argrepair.py` | unit coverage of the D-01 ladder | ✓ VERIFIED | Real (imports the actual helpers); 8 passed; covers all 4 branches + D-14 + no-brace-balance |
| `.planning/reported-bugs/minimax-m3-invalid-tool-args-400.md` | folded bug record | ✓ VERIFIED | `status: folded`, `folded_into: 129` |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `openai_service.py` | `extra_body['provider']` | injection inside `if provider=="openrouter"` | ✓ WIRED | Line 1631; single occurrence; correctly gated |
| `agent_loop.py` | `json.loads(tc['arguments'])` | MiniMax validity guard before `messages.append` | ✓ WIRED | `_minimax_args_all_valid` @122 delegated from seam @2148 |
| `agent_loop.py` | `_emit(... 'tool_args_recovered' ...)` | quiet recovered signal on successful re-ask | ✓ WIRED | recovered branch @2208-2211 |
| `agent_loop.py` | `message_for_kind('bad_request')` | honest-fail on exhausted re-ask | ✓ WIRED | honest_fail branch @2183; real import @67; verbatim copy confirmed |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| D-01 ladder via real helpers | `python -c "import minimax_argrepair_decision; assert ladder paths"` | invalid+budget→reask, exhausted→honest_fail, valid+pending→recovered, valid→ok; non-minimax×3→ok | ✓ PASS |
| Phase 129 unit suite green | `pytest tests/test_129_minimax_argrepair.py tests/test_129_openrouter_require_params.py -q` | 12 passed, 1 (unrelated) warning | ✓ PASS |
| Honest-fail copy verbatim | grep `errors.py` `bad_request` message | "Model parameter error — this model may not support the current configuration." matches VALIDATION | ✓ PASS |
| D-14 additive diff | `git show 876996c7 --numstat` | `176  0  agent_loop.py` (0 deletions) | ✓ PASS |

### Probe Execution

No project `scripts/*/tests/probe-*.sh` declared for this phase; the load-bearing verification is the SC#10 live scoreboard (operator-run) + the Wave-0 unit suites. N/A.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| MP-04 | 129-01, 129-02, 129-03 | MiniMax malformed-args boundary repair + OpenRouter `require_parameters` | ✓ SATISFIED | Both halves wired + unit-proven + live-proven (D-02); D-01 ladder unit-proven with documented-dormant trigger |

No orphaned requirements — MP-04 is the sole requirement and is fully claimed/covered.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | No TBD/FIXME/XXX/TODO/HACK/placeholder in the Phase 129 added regions | — | Clean — completion is auditable |

### Pre-existing Rot (NOT a Phase 129 gap)

| Test | Behavior | Determination |
| ---- | -------- | ------------- |
| `tests/integration/test_075_tool_args_progress.py::test_openrouter_independent_buffer_from_openai` | Fails on a cross-run `tool_args_progress` emit-boundary assertion (`got 1024`, expected `5120`) | **Pre-existing rot** — fails IDENTICALLY with `agent_loop.py` reverted to `876996c7~1` (pre-129 baseline). Phase 129's diff is purely additive (0 deletions) and provider-gated to MiniMax; it does not touch the OpenAI/OpenRouter buffering boundary this test exercises. Consistent with documented known partial backend-suite rot. Not introduced by, and not a regression of, Phase 129. |

### Human Verification Required

None outstanding. The load-bearing SC#10 4-axis cross-provider live scoreboard was already operator-run on 2026-06-27 (Chrome MCP + Supabase `runs` + Redis `run:{run_id}` cross-check), recorded with run_ids in `129-VALIDATION.md`, and operator-accepted-with-documented-caveat. 7/9 rows PASS (R1-R3 D-14 shared-path inert; R4 long-message happy-path; R6 multi-tool; R7 parallel-thread structural; R8/R9 OpenRouter before/after — D-02 live-proven no 404/422). The two repair firing rungs (R4-recovered / R5-honest-fail) were not live-observed because the trigger is dormant; forcing it (backend restart with lowered `LLM_MAX_OUTPUT_TOKENS`) was explicitly declined as gold-plating. There is no defect to reproduce and the repair logic is unit-proven.

### Gaps Summary

No gaps. Both halves of MP-04 are implemented at the locked seams, genuinely provider-gated (D-14 proven additive), real-and-green unit-tested (12 passed), and the load-bearing live scoreboard is operator-signed-off. The `nyquist_compliant: false` flag in VALIDATION.md is an honest record of an unobservable-because-dormant trigger (the original 8192 output-cap moved to 9987+, RESEARCH Open-Q2 confirmed live) — per the verification context this is the CORRECT posture (honesty over a false-green), not a goal gap, because the boundary hardening exists and is unit-proven and there is no live defect to reproduce. The one failing full-suite test is confirmed pre-existing rot, independently reproduced at the pre-129 baseline. Phase goal achieved.

---

_Verified: 2026-06-27_
_Verifier: Claude (gsd-verifier)_

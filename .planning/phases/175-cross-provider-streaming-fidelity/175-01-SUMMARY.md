---
phase: 175-cross-provider-streaming-fidelity
plan: 01
subsystem: infra
tags: [model-capabilities, cross-provider, reasoning, sub-agent-routing, registry, config]

# Dependency graph
requires:
  - phase: 162.5-threads-producer-extraction
    provides: "thread_title.py extracted service (the per-MODEL reasoning_off consumer, root-cause of the D-05 per-model widening)"
  - phase: 093-sub-agent-model-resolver
    provides: "resolve_sub_agent_model_safely + _SUB_AGENT_MODEL_DEFAULTS (the shared resolver the folded gate extends)"
provides:
  - "reasoning_first capability marker on the 3 gpt-5.6-class rows (XPROV-01 D-01) — the Plan-03 STRUCTURED routing gate reads it"
  - "reasoning_off capability marker on the FULL docs-confirmed-SAFE set (11 thinking_disabled + 2 effort_none) (XPROV-04 D-05) — the Plan-04 title-call injection reads it"
  - "provider_safe_utility_model pure helper (XPROV-03 D-03) — the explicit-call guard for Plan-04 thread_title + suggestion sites"
  - "folded inferred-provider gate in resolve_sub_agent_model_safely — closes the empty-available_models blind spot for task_service's shared resolver call"
  - "ModelCapability TypedDict gains reasoning_first + reasoning_off optional fields"
affects: [175-03-routing-gate, 175-04-title-injection-and-guard-application, thread_title, task_service]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Capability-keyed markers, never a hardcoded id-list in code (D-122-04) — routing/injection reads MODEL_CAPABILITIES data"
    - "Per-MODEL reasoning_off across the whole docs-confirmed-SAFE set (NOT per-provider-default) — driven by thread_title's ACTIVE-chat_model resolution"
    - "Inferred-provider guard as the cross-provider safety mechanism (beats list-membership; fires even on an empty available_models list)"

key-files:
  created:
    - backend/tests/unit/test_reasoning_capability_markers.py
    - backend/tests/unit/test_utility_model_guard.py
  modified:
    - backend/app/config.py
    - backend/app/services/sub_agent_models.py
    - backend/tests/unit/test_085_task_service.py

key-decisions:
  - "D-01: reasoning_first marks ONLY the 3 gpt-5.6 rows; native_tools:True left intact (Plan-03 gate short-circuits STRUCTURED above the native-tools read)"
  - "D-05: reasoning_off marked per-MODEL across the whole SAFE set (13 rows), UNSAFE negatives (M2.x, gemini-2.5-pro, all 3.x, glm-4.5/-air, moonshot-v1-8k, all OpenRouter) stay unmarked"
  - "D-03: the folded gate fires ONLY on a CONFIDENT known-provider mismatch — an unrecognised id (fallback bucket) still passes through, preserving D-14 for the existing empty-list-unknown contract"
  - "D-03 coverage stated PRECISELY: 3/4 sites closed via the shared inferred-provider mechanism; sub_agent_service.py (byte-frozen D-085-16) keeps its populated-list-only inline guard"

patterns-established:
  - "Marker-matrix regression guard: assert the exact SAFE/UNSAFE registry matrix directly against MODEL_CAPABILITIES (tamper-regression guard for T-175-01-01)"
  - "TDD RED->GREEN for the guard: failing guard test committed first, then the helper + folded gate"

requirements-completed: [XPROV-01, XPROV-03, XPROV-04]

# Metrics
duration: ~35min
completed: 2026-07-22
---

# Phase 175 Plan 01: Cross-Provider Streaming Fidelity — Shared Substrate Summary

**Capability-keyed reasoning markers (XPROV-01 `reasoning_first` on 3 gpt-5.6 rows + XPROV-04 `reasoning_off` on the full 13-row docs-confirmed-SAFE set) and a shared inferred-provider utility-model guard (`provider_safe_utility_model` + a folded gate closing the empty-`available_models` blind spot) — all additive data + one pure helper, no request-path fork.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-22T16:17:00Z (approx)
- **Completed:** 2026-07-22T16:52:06Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- **XPROV-01 (D-01):** `reasoning_first: True` on `gpt-5.6-sol` / `gpt-5.6-terra` / `gpt-5.6-luna` only; their existing `native_tools: True` untouched.
- **XPROV-04 (D-05):** `reasoning_off` on the FULL docs-confirmed-SAFE set — `"thinking_disabled"` on 11 rows (deepseek-v4-flash/-pro, kimi-k2.6/k2.5, glm-4.6/4.7/5/5-turbo/5.1/5.2, MiniMax-M3) and `"effort_none"` on gemini-2.5-flash + gemini-2.5-flash-lite. Every UNSAFE negative stays unmarked (no regression; default-inert).
- **XPROV-03 (D-03):** `provider_safe_utility_model` pure helper (drops a cross-provider override before any provider call; flexible/openrouter+ollama passthrough; None on empty) + a folded inferred-provider gate inside `resolve_sub_agent_model_safely` that closes the empty-`available_models` blind spot for `task_service`'s shared resolver call.
- **Registry safety:** `ModelCapability` TypedDict gains `reasoning_first` + `reasoning_off` optional fields (keeps the additive keys type-clean under `total=False`).
- **Regression guards:** 52-assertion marker matrix + 12-case guard test; full `tests/unit` shows **zero net-new failures** vs the phase-start baseline (63 pre-existing rot, identical set).

## Task Commits

1. **Task 1: Capability markers (XPROV-01 D-01 + XPROV-04 D-05)** — `fe7c1dcd` (feat)
2. **Task 2 (TDD RED): failing guard tests (XPROV-03)** — `aae339c7` (test)
3. **Task 2 (TDD GREEN): shared inferred-provider guard (XPROV-03 D-03)** — `84abcd2b` (feat)
4. **Task 2 (test contract update): 2 superseded test_085 cases** — `6af52e2e` (test)

**Plan metadata:** _(final docs commit — SUMMARY + STATE + ROADMAP + REQUIREMENTS)_

## Files Created/Modified
- `backend/app/config.py` — 16 marked rows (3 `reasoning_first` + 11 `thinking_disabled` + 2 `effort_none`) + 2 new `ModelCapability` TypedDict fields. No existing key altered; `git diff` touches only the marked rows + the TypedDict block.
- `backend/app/services/sub_agent_models.py` — new `provider_safe_utility_model` helper + folded inferred-provider gate before the list-membership branch; imports `_infer_provider_for` + `_INFERENCE_FALLBACK_PROVIDER`.
- `backend/tests/unit/test_reasoning_capability_markers.py` — SAFE/UNSAFE marker matrix (52 assertions).
- `backend/tests/unit/test_utility_model_guard.py` — helper + folded-gate unit proofs (12 cases).
- `backend/tests/unit/test_085_task_service.py` — 2 pre-existing cases updated to the D-03 contract (see Deviations).

## D-03 Coverage — PRECISE (per acceptance criteria)
The XPROV-03 inferred-provider mechanism closes **3 of the 4** documented cross-provider utility-model sites:
- **thread_title** + **suggestion** — closed via explicit `provider_safe_utility_model(...)` calls **in Plan 04** (this plan lands the helper they call).
- **task_service** — closed **now** by the folded gate inside `resolve_sub_agent_model_safely` (its existing caller), which ALSO closes that call's empty-`available_models` blind spot.
- **sub_agent_service.py (4th site)** — **NOT** reached by the inferred-provider gate; it is byte-frozen per D-085-16 and RETAINS its existing populated-list-only inline guard (its empty-`llm_models` blind spot remains, mitigated in practice by its provider-correct default). `git diff` confirms `sub_agent_service.py` is absent from this plan.

## Decisions Made
- **Fold fires only on a CONFIDENT known-provider mismatch.** The gate excludes the `_INFERENCE_FALLBACK_PROVIDER` bucket, so an unrecognised id (e.g. `some-unknown-model` → fallback) still passes through unchanged. This is the only way to satisfy BOTH the plan's blind-spot-closure requirement AND D-14 (the existing `test_empty_available_models_returns_candidate_unchanged` stays green). A genuine cross-provider id (`gpt-4o` → openai on a google-active user) IS caught.
- **`ModelCapability` TypedDict extended** with the two new optional fields (rather than leaving them undeclared) — consistent with how every other optional capability key (`uses_max_completion_tokens`, `supports_assistant_prefill`, `deprecated`, …) is declared; keeps the additive markers type-clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 2 `test_085_task_service.py` cases that encoded the now-superseded empty-list blind-spot**
- **Found during:** Task 2 (GREEN — full `tests/unit` differential vs phase-start baseline `f872bf8f`)
- **Issue:** `test_resolve_empty_llm_models_list_lets_override_pass_through` and `test_resolve_with_empty_active_models_list_skips_validation` asserted the OLD empty-`available_models` passthrough for CONFIDENT cross-provider ids (`claude-3`→anthropic on openai-active; `gpt-4.1`→openai on anthropic-active). That passthrough is EXACTLY the blind spot XPROV-03/D-03 intentionally closes — so the folded gate correctly changed their result to the active provider's default. These 2 tests documented the superseded contract.
- **Fix:** Rewrote both to assert the new blind-spot-closed behavior (confident cross-provider → provider default), with a Phase-175 XPROV-03 docstring noting the supersession and pointing to `test_utility_model_guard.py` for the unrecognised-id passthrough. No production code changed for this fix.
- **Files modified:** `backend/tests/unit/test_085_task_service.py`
- **Verification:** `test_085_task_service.py` 43/43 green; full `tests/unit` failing set now IDENTICAL to the phase-start baseline (63 pre-existing rot, 0 net-new).
- **Committed in:** `6af52e2e`

---

**Total deviations:** 1 auto-fixed (1 test-contract update caused by the task's intended behavior change).
**Impact on plan:** No scope creep — the update reflects XPROV-03's intended blind-spot closure; `test_085_task_service.py` was not in the plan's `files_modified` but is the direct downstream contract of the changed resolver. Production surface unchanged beyond the plan's two source files.

## Issues Encountered
- **Full `tests/unit` has 63 pre-existing failures** (test_sql_service, test_retrieval_service, test_sandbox_service, test_multimodal_query, test_explorer_agent, test_lifespan, test_db_runs, test_extraction_service, test_111_1_reembed_kickoff, test_module7_tools, test_061_consumer, test_071_1, test_075_4, test_103, test_phase56, test_forced_emit, test_get_model_capability_inference, test_streaming_reliability). Proven pre-existing by a source-reverted differential against `f872bf8f` (63 failed both sides after excluding the 2 new test files). Documented rot per 075.4-TEST-TRIAGE (routed to Phases 076/077) — OUT OF SCOPE (scope boundary), not touched.

## Security
- No new untrusted-input boundary (MODEL_CAPABILITIES is operator/code-controlled — T-175-01-01 accept; the marker-matrix test is the tamper-regression guard).
- The guard changes only WHICH utility model id is sent; it never touches the caller's request-scoped RLS/auth context (T-175-01-02 accept).
- **No package installs** — `git diff` shows zero changes to `requirements.txt` / `Dockerfile.sandbox` (T-175-01-SC).

## Threat Flags
None — no new network endpoint, auth path, file-access pattern, or schema change introduced.

## Known Stubs
None — all markers are live registry data; the helper + folded gate are fully wired to their existing caller (task_service). The explicit `provider_safe_utility_model` call sites (thread_title + suggestion) land in Plan 04 by design (this plan provides the substrate).

## Next Phase Readiness
- **Plan 03 (routing gate)** can read `reasoning_first` to short-circuit the 3 gpt-5.6 rows to STRUCTURED.
- **Plan 04 (title-call injection + guard application)** can read `reasoning_off` (full SAFE set) for the title-call injection and call `provider_safe_utility_model` at the thread_title + suggestion sites.
- Deep Mode byte-identical (default-inert markers; same-provider + unrecognised-id resolver paths unchanged, D-14).

## Self-Check: PASSED
- `backend/app/config.py` — FOUND (16 marked rows + TypedDict fields)
- `backend/app/services/sub_agent_models.py` — FOUND (`provider_safe_utility_model` + folded gate)
- `backend/tests/unit/test_reasoning_capability_markers.py` — FOUND (52 passed)
- `backend/tests/unit/test_utility_model_guard.py` — FOUND (12 passed)
- `backend/tests/unit/test_085_task_service.py` — FOUND (43 passed)
- Commits `fe7c1dcd`, `aae339c7`, `84abcd2b`, `6af52e2e` — all present in `git log`

---
*Phase: 175-cross-provider-streaming-fidelity*
*Completed: 2026-07-22*

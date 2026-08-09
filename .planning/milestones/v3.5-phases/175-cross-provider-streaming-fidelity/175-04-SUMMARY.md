---
phase: 175-cross-provider-streaming-fidelity
plan: 04
subsystem: backend-utility-model-seam
tags: [cross-provider, title-generation, suggestions, reasoning-off, utility-model-guard, fallback-honesty]

# Dependency graph
requires:
  - phase: 175-01-shared-substrate
    provides: "provider_safe_utility_model helper + the reasoning_off capability marker on the full docs-confirmed-SAFE set (13 rows) read via get_model_capability"
  - phase: 162.5-threads-producer-extraction
    provides: "thread_title.py extracted service (the D-05 per-MODEL reasoning-off consumer + the guarded multi-model override site)"
provides:
  - "XPROV-03 (D-03/D-04) — the shared provider-safe guard applied at BOTH explicit utility-model sites (thread_title + suggestion): a cross-provider/unrecognised sub_agent_model is dropped before the call so no 404 → no fallback_model emit → no misleading banner; a genuine same-provider 404 still emits fallback_model honestly"
  - "XPROV-04 (D-05) — the per-MODEL reasoning-off param on the title call, keyed generically off get_model_capability(model).reasoning_off (thinking_disabled → extra_body thinking:disabled; effort_none → reasoning_effort none), covering the full Plan-01 SAFE set with NO hardcoded id list; UNSAFE models inject nothing (byte-identical)"
affects: [thread_title, suggestion_service, title-generation-quality, fallback-banner-honesty]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Capability-keyed reasoning-off injection (get_model_capability marker), never a hardcoded id list — the whole SAFE set is covered generically (D-122-04 discipline)"
    - "Shared cross-provider utility-model guard threaded onto the explicit call sites (provider_safe_utility_model) — the pure-helper twin of task_service's folded gate"
    - "Additive **kwargs spread on the existing create() call — UNSAFE path stays byte-identical (D-14)"

key-files:
  created:
    - backend/tests/unit/test_title_reasoning_off.py
  modified:
    - backend/app/services/thread_title.py
    - backend/app/services/suggestion_service.py
    - backend/tests/unit/test_threads_title_gen.py
    - backend/tests/unit/test_suggestions.py

key-decisions:
  - "D-03: the multi-model override at thread_title + the override at suggestion are wrapped with provider_safe_utility_model; on a cross-provider mismatch the guard returns None and the existing fall-through to _SUB_AGENT_MODEL_DEFAULTS[provider] runs → no 404 → no fallback_model emit (suppress-when-fine is automatic, no new branch)"
  - "D-04: the 404 fallback branch + the fallback_model/title ordering invariant are left untouched — a genuine same-provider 404 still emits fallback_model honestly"
  - "D-05: reasoning-off injected via get_model_capability(model).get('reasoning_off') at the title-call request build — thinking_disabled → extra_body={'thinking':{'type':'disabled'}} (DISABLE mirror of the DeepSeek ENABLE block), effort_none → reasoning_effort='none'; the ENTIRE Plan-01 SAFE set (11 + 2) injects with zero id branches; UNSAFE rows inject an empty dict"
  - "D-14: title budget (30 / Google 160), token_param, messages, stream=False, and the inline-await ordering (maybe_autotitle_thread) are byte-identical; empty/refusal on a SAFE provider still derives a real title"

requirements-completed: [XPROV-03]

# Metrics
duration: ~7min
completed: 2026-07-22
---

# Phase 175 Plan 04: Cross-Provider Utility-Model Honesty + Reasoning-Provider Title Quality Summary

**The shared provider-safe guard is now applied at both explicit utility-model sites (thread_title + suggestion) so a stale cross-provider `sub_agent_model` is dropped before the call — killing the false fallback banner at its root (XPROV-03/D-03/D-04) — and the title call injects a per-MODEL reasoning-off param driven generically off the Plan-01 `reasoning_off` marker so every docs-confirmed-SAFE reasoning provider produces a real 4-6 word title instead of the degenerate first-few-words fallback (XPROV-04/D-05), all additive with the tiny budget + inline-await ordering byte-identical.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-07-22T17:20:17Z
- **Completed:** 2026-07-22T17:28:00Z (approx)
- **Tasks:** 2 (both TDD RED→GREEN)
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- **XPROV-03 (D-03/D-04) — thread_title.py:** the multi-model override (`:125-137`) is wrapped with `provider_safe_utility_model(user_settings, (user_settings.sub_agent_model or settings.sub_agent_model))`. On a cross-provider mismatch the guard returns `None` and the existing fall-through to `_SUB_AGENT_MODEL_DEFAULTS[provider]` runs — so no wrong-provider call → no `openai.NotFoundError` → no `fallback_model` emit → no misleading banner. The 404 fallback branch (`:163-190`) and the `fallback_model`→`title` ordering invariant (`maybe_autotitle_thread` `:256-262`) are untouched: a genuine same-provider 404 still emits `fallback_model` honestly.
- **XPROV-03 (D-03) — suggestion_service.py:** the twin unguarded override (`:74-87`) gets the identical wrap; a cross-provider mismatch falls through to the active provider's default resolution.
- **XPROV-04 (D-05) — thread_title.py title call:** after `model`/`_title_max_tokens`/`token_param` resolve and before `client.chat.completions.create`, `_reasoning_off = get_model_capability(model).get("reasoning_off")` builds an additive kwargs dict — `thinking_disabled` → `{"extra_body": {"thinking": {"type": "disabled"}}}` (the DISABLE mirror of the proven DeepSeek ENABLE block at `openai_service.py:1826-1831`); `effort_none` → `{"reasoning_effort": "none"}`; otherwise `{}` — spread via `**_reasoning_off_kwargs`. Marker-driven, so the full Plan-01 SAFE set (11 `thinking_disabled` + 2 `effort_none` Google rows) injects with **no hardcoded id list**; a future SAFE row needs no change here.
- **D-14 byte-identical:** budget stays `160 if google else 30`; token_param, messages, `stream=False`, and the inline-await ordering are unchanged. UNSAFE models get an empty kwargs dict → the create call is identical to today → `_clean_llm_title` still derives on empty content (no regression of the closed `title-generation-broken` fix).
- **Proofs:** the reasoning-off matrix proves the injection with **2 distinct** `thinking_disabled` models (`deepseek-v4-flash` AND `glm-5.2`) — so the param can't be a one/few-id special case — plus a Google `effort_none` model, 2 UNSAFE controls (`MiniMax-M2.7-highspeed`, `gemini-2.5-pro`), budget invariance (30/160), and empty-on-SAFE-still-derives. The guard suite proves cross-provider-drop (no banner), same-provider-preserve (byte-identical), genuine-404-still-honest, and the suggestion twin.

## Task Commits

1. **Task 1 (TDD RED): failing cross-provider guard tests (XPROV-03 D-03)** — `b277d17d` (test)
2. **Task 1 (TDD GREEN): provider-safe guard at title-gen + suggestion (XPROV-03 D-03)** — `f33f6707` (feat)
3. **Task 2 (TDD RED): failing per-MODEL reasoning-off title-call tests (XPROV-04 D-05)** — `663865a1` (test)
4. **Task 2 (TDD GREEN): inject per-MODEL reasoning-off on the title call (XPROV-04 D-05)** — `1826e87e` (feat)
5. **Deviation (Rule 1): update superseded suggestion-override test to the guard contract** — `d69f8df1` (test)

**Plan metadata:** _(final docs commit — SUMMARY + STATE + ROADMAP)_

## Files Created/Modified

- `backend/app/services/thread_title.py` — added `get_model_capability` + `provider_safe_utility_model` imports; wrapped the multi-model override with the guard (D-03); inserted the additive reasoning-off kwargs build + `**` spread on the title `create` call (D-05). The single-model branch, 404 fallback branch, budget, and ordering are untouched.
- `backend/app/services/suggestion_service.py` — added the `provider_safe_utility_model` import; wrapped the `override_model` resolution with the guard (D-03). Fall-through to provider-default resolution unchanged.
- `backend/tests/unit/test_title_reasoning_off.py` (created) — 8 cases: 2 distinct SAFE `thinking_disabled` (deepseek + glm) → `extra_body` thinking:disabled; SAFE `effort_none` (gemini-2.5-flash) → `reasoning_effort=none`; 2 UNSAFE → nothing; budget 30/160; empty-on-SAFE derives.
- `backend/tests/unit/test_threads_title_gen.py` — 5 new guard cases (cross-provider drop no-banner, same-provider preserve, genuine-404 still-honest, suggestion twin drop + preserve) + recording-mock helpers.
- `backend/tests/unit/test_suggestions.py` — 1 superseded case updated to the D-03 guard contract (see Deviations).

## D-03 / D-04 Suppress-When-Fine (how the banner dies at its root)

The false banner used to fire because a stale cross-provider `sub_agent_model` was sent verbatim → the wrong-provider client raised `openai.NotFoundError` → the 404 branch emitted `fallback_model` (the banner). Dropping the cross-provider candidate **before** the call means the 404 never happens, so the emit never runs — **no new suppress logic, no branch on the banner path**. The honest case is preserved by leaving the 404 branch intact: a candidate that survives the guard (same-provider) and then genuinely 404s still emits `fallback_model`.

## Decisions Made

- **The pure helper is stricter than the folded gate — by design (Plan 01).** `provider_safe_utility_model` drops ANY candidate whose inferred provider != active (including an unrecognised id that infers to the `ollama` fallback bucket) for a non-flexible provider; the folded gate inside `resolve_sub_agent_model_safely` deliberately excludes the fallback bucket to preserve task_service's D-14 empty-list contract. The explicit call sites here use the pure helper, so an unrecognised `sub_agent_model` on a non-flexible provider now falls to the provider default (the safe behavior — it would have 404'd otherwise).
- **Reasoning-off keyed off the marker, never an id list.** The single `get_model_capability(model).get("reasoning_off")` read covers the entire SAFE set and auto-covers any future SAFE row; UNSAFE rows fall to the empty-dict branch with zero code change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated the superseded `test_generate_suggestions_uses_sub_agent_model_override` case**
- **Found during:** Task 1 GREEN (full `tests/unit` differential vs the Plan-01 baseline)
- **Issue:** the test asserted the pre-guard contract — an arbitrary env `settings.sub_agent_model = "custom-model"` used verbatim on an **anthropic-active** user. With the D-03 guard, `"custom-model"` infers to the `ollama` fallback bucket (≠ anthropic, non-flexible) so `provider_safe_utility_model` correctly drops it to the anthropic provider default. This is exactly the wrong-provider call the guard exists to prevent — the test documented the superseded behavior (the direct analog of Plan-01's `test_085_task_service.py` update).
- **Fix:** rewrote the case to use a **provider-safe** override (anthropic-active + a `claude-*` id → inferred anthropic → kept), proving the override-wins path stays intact under the guard, with a docstring noting the XPROV-03 supersession and pointing to `test_threads_title_gen.py::test_suggestion_cross_provider_override_dropped` for the cross-provider-drop proof. No production code changed for this fix.
- **Files modified:** `backend/tests/unit/test_suggestions.py`
- **Verification:** `test_suggestions.py` 8/8 green; full `tests/unit` failing set now **IDENTICAL** to the phase-start baseline (63 pre-existing rot, 0 net-new).
- **Committed in:** `d69f8df1`

---

**Total deviations:** 1 auto-fixed (a test-contract update caused by the task's intended guard behavior).
**Impact on plan:** No scope creep — the update reflects XPROV-03's intended behavior; `test_suggestions.py` is the direct downstream contract of the guarded `suggestion_service` override. Production surface unchanged beyond the plan's two source files.

## Issues Encountered

- **Full `tests/unit` carries 63 pre-existing failures** (test_sql_service, test_retrieval_service, test_sandbox_service, test_multimodal_query, test_explorer_agent, test_lifespan, test_db_runs, test_extraction_service, test_111_1_reembed_kickoff, test_module7_tools, test_061_consumer, test_071_1, test_075_4, test_103, test_phase56, test_forced_emit, test_get_model_capability_inference, test_streaming_reliability). Proven pre-existing — the identical set the Plan-01 SUMMARY documented (routed to Phases 076/077 per 075.4-TEST-TRIAGE). OUT OF SCOPE (scope boundary), untouched. After this plan: **63 failed / 1370 passed — 0 net-new.**
- **gsd-sdk `state.*` positional-arg verbs (`record-metric`, `add-decision`) don't receive args in this environment** (known verb gap — memory `reference_gsd_sdk_verb_gaps`). `state.advance-plan`/`state.update-progress` (arg-less) and `roadmap.update-plan-progress <phase>` work. The metrics row + decisions were hand-added to STATE.md (balloon-mitigation: minimal edits).

## Security

- **No new untrusted-input boundary.** `MODEL_CAPABILITIES` is operator/code-controlled (T-175-04-03 accept — additive `extra_body`/`reasoning_effort` kwarg on a SAFE-marked model's own title call; no new input surface, no authz change).
- **The guard changes only WHICH utility-model id is sent** — it never touches the caller's request-scoped RLS/auth context (T-175-04-01 mitigate, per Phase-163 D-03; `maybe_autotitle_thread` stays request-scoped under the caller's `get_user_supabase_client`).
- **Fallback-banner honesty** (T-175-04-02 accept): suppressing the false banner reduces misleading UI; a genuine substitution still emits `fallback_model`. No secret/detail exposure.
- **No package installs** — `git diff` shows zero changes to `requirements.txt` / `Dockerfile.sandbox` (T-175-04-SC).

## Threat Flags

None — no new network endpoint, auth path, file-access pattern, or schema change introduced.

## Known Stubs

None — both changes are fully wired: the guard is called at both explicit sites, and the reasoning-off injection reads live registry markers on the actual title call.

## Verification vs Success Criteria

- **Cross-provider fallback banner suppressed at its root; genuine substitutions stay honest** — `test_threads_title_gen.py` guard suite 6/6 (drop no-banner, same-provider preserve, genuine-404 still-honest, suggestion twin). PASS.
- **SAFE reasoning providers (full Plan-01 marked set) emit real titles via the reasoning-off param; UNSAFE keep the derived fallback** — `test_title_reasoning_off.py` 8/8 (2 distinct SAFE thinking_disabled + Google effort_none + 2 UNSAFE controls). PASS.
- **Budget + inline-await ordering byte-identical; both unit proofs green; full unit suite has only pre-existing rot** — budget 30/160 asserted; 14/14 plan proofs green; `tests/unit` 63 failed / 1370 passed = 0 net-new. PASS.
- **SC#10 cross-provider axis** (a SAFE reasoning provider produces a real title; Google 3.x / MiniMax M2.x UNSAFE controls derive; parallel-thread isolation) is authored in `175-VALIDATION.md` (manual — real per-provider title quality can't be mocked). Not duplicated here.

## Self-Check: PASSED
- `backend/app/services/thread_title.py` — FOUND (guard + reasoning-off injection)
- `backend/app/services/suggestion_service.py` — FOUND (guard)
- `backend/tests/unit/test_title_reasoning_off.py` — FOUND (8 passed)
- `backend/tests/unit/test_threads_title_gen.py` — FOUND (6 passed)
- `backend/tests/unit/test_suggestions.py` — FOUND (8 passed)
- Commits `b277d17d`, `f33f6707`, `663865a1`, `1826e87e`, `d69f8df1` — all present in `git log`

---
*Phase: 175-cross-provider-streaming-fidelity*
*Completed: 2026-07-22*

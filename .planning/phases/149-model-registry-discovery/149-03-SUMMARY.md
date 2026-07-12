---
phase: 149-model-registry-discovery
plan: 03
subsystem: api
tags: [max_output_tokens, clamp, model-registry, provider-gateway, openai, anthropic, google, db-overlay]

# Dependency graph
requires:
  - phase: 074
    provides: "single max_output_tokens clamp chokepoint (D-074-01/02) in _resolve_max_tokens"
  - phase: 081.1
    provides: "model_capabilities_overrides DB overlay + 30s-TTL _model_overrides_cache + get_model_capability_async"
  - phase: 092.5
    provides: "provider_gateway adapters (anthropic.py / google.py) that call _resolve_max_tokens"
provides:
  - "Effective-model + DB-aware max_output_tokens clamp (BUG-260620-01 closed)"
  - "_resolve_db_max_output_cap sync helper — warm-cache read of an operator's DB-edited max_output_tokens"
  - "Uniform DB-aware clamping across openai-compat + Anthropic + Google (single chokepoint preserved)"
affects: [149-06 enabled-enforcement seam, 149-07 SC#10 UAT, model-registry write UI honesty]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-resolved DB cap threaded into a SYNC clamp (Open Q3) — no await in the sync-generator hot path (D-14 red line intact)"
    - "Warm-cache sync read: the async request path (get_model_capability_async at agent_loop.py:2023) warms _model_overrides_cache; the sync clamp reads it — the cap is resolved async, consumed sync"

key-files:
  created:
    - backend/tests/test_149_clamp.py
    - .planning/phases/149-model-registry-discovery/deferred-items.md
  modified:
    - backend/app/services/openai_service.py
    - backend/app/services/provider_gateway/anthropic.py
    - backend/app/services/provider_gateway/google.py

key-decisions:
  - "Resolve the DB cap via a SYNC read of the warm _model_overrides_cache (not an await get_model_capability_async in the sync caller) — the plan's literal await is incompatible with the sync-generator boundary; the warm cache is populated by the same async call at agent_loop.py:2023 immediately before open_stream, so semantics match (cap resolved async, passed in via the module cache)"
  - "Thread effective_model + a cheap sync DB cap into the Anthropic + Google gateway adapters too, so DB-aware clamping is uniform across all providers with NO per-provider fork and NO second clamp"

patterns-established:
  - "Optional effective_model + db_max_output_cap params keep every legacy caller byte-behavior-identical (degrade to pre-149 static-dict-against-user_settings)"

requirements-completed: [MODEL-01]

# Metrics
duration: 18min
completed: 2026-07-12
---

# Phase 149 Plan 03: Effective-Model + DB-Aware max_output_tokens Clamp Summary

**The `max_output_tokens` clamp now fires against the EFFECTIVE model actually sent and honors an operator's DB-edited cap — closing BUG-260620-01 (gpt-4o `32768 > 16384 → 400`) and making the registry's `max_output_tokens` edit honest, while preserving the Phase-074 single chokepoint and the targeted `:exacto` strip.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-12T10:46:17Z (RED commit)
- **Completed:** 2026-07-12T10:58Z
- **Tasks:** 2
- **Files modified:** 3 source + 1 test + 1 deferred-log

## Accomplishments
- `_resolve_max_tokens` gained optional `effective_model` + `db_max_output_cap` params: the clamp lookup now uses the effective model actually sent (never `user_settings.llm_model`), and the ceiling honors a DB override, falling back to the static registry cap. Both optional → every legacy caller degrades safely to pre-149 behavior.
- Added `_resolve_db_max_output_cap` — a cheap SYNC read of the warm `_model_overrides_cache` (Open Q3: no `await` in the sync-generator hot path). `create_adaptive_streaming_chat` resolves it + threads the effective model.
- Threaded `effective_model=request.model` + the sync DB cap into BOTH gateway adapters (`anthropic.py`, `google.py`), so a sub-agent / explicit-model call clamps against its own model — DB-aware clamping is now uniform across openai-compat + Anthropic + Google with no per-provider fork and no second clamp.
- Targeted `.removesuffix(":exacto")` preserved (Pitfall 4 anti-regression); the `split(":")[0]` anti-pattern is absent from source (the explanatory comment reworded so the literal no longer appears).

## Task Commits

Each task committed atomically (Task 1 is TDD — test → feat):

1. **Task 1 (RED): failing clamp effective-model + DB-cap tests** - `463d2a63` (test)
2. **Task 1 (GREEN): clamp against effective model + DB cap** - `dd31ef51` (feat)
3. **Task 2: thread effective model + DB cap into all clamp callers** - `2c59ae59` (feat)

_Task 1 is `tdd="true"` → RED then GREEN. No refactor commit was needed (implementation was already clean)._

## Files Created/Modified
- `backend/app/services/openai_service.py` — `_resolve_max_tokens` effective-model + DB-cap clamp gate; new `_resolve_db_max_output_cap` sync warm-cache helper; `create_adaptive_streaming_chat` resolves + threads both.
- `backend/app/services/provider_gateway/anthropic.py` — clamp call threads `effective_model=request.model` + sync DB cap.
- `backend/app/services/provider_gateway/google.py` — same threading for the Gemini adapter.
- `backend/tests/test_149_clamp.py` (new) — 12 cases: gpt-4o 32768→16384, DB override→8000 (direct + via mocked `get_model_capability_async`), effective≠user_settings, effective cap 4096, `:exacto` stripped / `:free` preserved, no-cap pass-through, legacy 2-arg fallback, sub-agent own-cap regression, warm-cache DB override, cold-cache None.
- `.planning/phases/149-model-registry-discovery/deferred-items.md` (new) — logs 17 pre-existing backend test-rot failures (out of scope).

## Decisions Made
- **Sync warm-cache DB-cap read instead of the plan's literal `await get_model_capability_async` in the caller.** The named caller (`create_adaptive_streaming_chat`, and the two gateway adapters) are SYNC generators sitting on the D-14 byte-identical boundary — awaiting there would force them async (a large, red-line-violating change) or block. Instead `_resolve_db_max_output_cap` reads the same 30s-TTL `_model_overrides_cache` that `agent_loop.py:2023` warms via `get_model_capability_async(effective_model)` immediately before `open_stream`. Net semantics are exactly the plan's intent ("resolve the cap on the async request path, pass it in"), honored via the module cache rather than a function return — kept fully within the `files_modified` scope and honoring Open Q3 (function stays sync, no await in the hot path). See Deviation 1.
- **Extended the fix to the Anthropic + Google adapters (Task 2).** They had `request.model` in scope but clamped against `user_settings.llm_model`; threading the effective model + a cheap sync DB cap makes clamping uniform and closes the wrong-model mechanism on every provider — single chokepoint preserved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] DB cap resolved via sync warm-cache read, not `await get_model_capability_async` in a sync caller**
- **Found during:** Task 1 (wiring the request-path caller)
- **Issue:** The plan's Task-1 action says to resolve `db_cap = (await get_model_capability_async(effective_model)...)` in "the request-path caller (~:1506-1507)". That caller is `create_adaptive_streaming_chat`, a SYNC generator on the D-14 byte-identical provider boundary — it cannot `await`. Making it async would fork the red-line sync-generator path (a large, out-of-scope architectural change) and contradicts Open Q3 ("keep it sync, do not await deep in the hot path").
- **Fix:** Added `_resolve_db_max_output_cap(model_id)` — a sync read of the warm `_model_overrides_cache` that the async request path (`agent_loop.py:2023` → `get_model_capability_async`) populates immediately before `open_stream` (and `_load_model_overrides` loads ALL enabled override rows). The cap is thus resolved on the async path and consumed synchronously; a cold/absent cache returns `None` → safe static-registry fallback (D-074-02).
- **Files modified:** `backend/app/services/openai_service.py`
- **Verification:** `test_db_cap_resolved_through_capability_read` (mocked async read), `test_sub_agent_db_override_honored_via_warm_cache`, `test_resolve_db_cap_cold_cache_returns_none` all green.
- **Committed in:** `dd31ef51` (Task 1 GREEN)

**2. [Rule 2 - Missing Critical] Reword the `split(":")[0]` anti-pattern comment so the literal is absent from source**
- **Found during:** Task 2 (anti-pattern grep gate)
- **Issue:** The Task-2 acceptance requires `grep "split(\":\")\[0\]" openai_service.py` to return nothing, but the explanatory guard comment contained the exact literal — a false positive that would flag at verification.
- **Fix:** Reworded the comment to "a generic colon-split that keeps only the pre-colon head"; the Pitfall-4 guard intent is preserved, the literal is gone.
- **Files modified:** `backend/app/services/openai_service.py`
- **Verification:** gate prints `NO_SPLIT_ANTIPATTERN`.
- **Committed in:** `2c59ae59` (Task 2)

**3. [Scope boundary] Gateway adapter files edited (outside the frontmatter `files_modified` list)**
- **Found during:** Task 2 (audit every clamp caller)
- **Issue:** The plan frontmatter lists only `openai_service.py` + the test, but Task 2's action explicitly directs threading `effective_model` into every caller with an in-scope effective model — the real callers live in `provider_gateway/anthropic.py` + `google.py` (the plan interface named `anthropic_service.py`/`google_service.py`, but the actual `_resolve_max_tokens` call sites are in the gateway adapters).
- **Fix:** Edited the two gateway adapters as the task body directs; the task-body instruction is authoritative over the frontmatter file list.
- **Files modified:** `backend/app/services/provider_gateway/anthropic.py`, `backend/app/services/provider_gateway/google.py`
- **Verification:** both import cleanly with `_resolve_db_max_output_cap`; clamp regression green.
- **Committed in:** `2c59ae59` (Task 2)

---

**Total deviations:** 3 (1 blocking sync-vs-async resolution, 1 missing-critical verification-gate fix, 1 scope-boundary file adjustment mandated by the task body)
**Impact on plan:** All necessary to honor the plan's intent within the sync-generator red line. No scope creep — the fix stayed surgical to the clamp chokepoint; no new packages, no schema, no new endpoint, no forked provider path.

## Issues Encountered
- **17 pre-existing backend test failures** surfaced during the regression sweep (`test_provider_router.py`, `test_mdl_verification.py`, `test_085_sub_agent_cross_provider.py`, `test_threads.py::TestSendMessageDispatchAttribution`, `test_075_4_unknown_provider_error.py`, `test_eval_runner.py`). Verified IDENTICAL at the phase base commit `a3b3df48` in a throwaway worktree — pre-existing mock/registry rot (e.g. patching `app.api.threads.insert_run`, a symbol moved by the overdue `threads.py` G-5 extraction), unrelated to this change. Logged to `deferred-items.md`; NOT fixed (out of scope).

## Threat Model Coverage
- **T-149-06 (self-inflicted 400 / DoS)** — mitigated: the clamp now enforces the effective model's DB-overridable cap; gpt-4o's hard cap cannot be exceeded (test `test_gpt4o_over_cap_clamps_to_16384`).
- **T-149-07 (silent clamp loss via suffix mishandling)** — mitigated: `.removesuffix(":exacto")` preserved, `split(":")[0]` absent from source; `:free` pass-through proven (`test_free_suffix_preserved_on_effective_model`).
- **T-149-SC (package installs)** — accept: zero new packages.

## User Setup Required
None - no external service configuration required (no schema, no env, no provider config in this plan).

## Next Phase Readiness
- SC#1 (an operator-edited `max_output_tokens` visibly changes the clamped value on the request path) is proven in tests; Plan 149-07's SC#10 rows will prove it live cross-provider.
- No blockers introduced. The overdue `threads.py` G-5 extraction (re-open trigger for the 17 rotted tests) remains due, tracked in `deferred-items.md`.

---
*Phase: 149-model-registry-discovery*
*Completed: 2026-07-12*

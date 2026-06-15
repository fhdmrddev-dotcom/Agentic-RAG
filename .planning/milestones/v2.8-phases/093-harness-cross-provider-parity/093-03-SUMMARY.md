---
phase: 093-harness-cross-provider-parity
plan: 03
subsystem: api
tags: [sub-agent-routing, model-resolver, cross-provider, gemini, harness, provider-defaults]

# Dependency graph
requires:
  - phase: 093-01
    provides: "Test093ModelResolver RED scaffold (skipped) in test_sub_agent_routing.py — the named D-13 Layer-1 contract this plan flips GREEN"
  - phase: 085
    provides: "resolve_sub_agent_model_safely safety-net shape + _SUB_AGENT_MODEL_DEFAULTS (the dead field this plan revives)"
provides:
  - "resolve_sub_agent_model_safely reads the REAL field available_models (list[str]) — the cross-provider safety net is no longer dead (D-06)"
  - "resolve_workflow_ctx_model(user_settings) -> str — the resolve-never-mutate ctx-model wrapper (D-04/D-05) the Wave-2 plans (093-04/05) thread onto wf_ctx.model"
  - "Google sub-agent default locked to gemini-3.5-flash (live-probe confirmed, Open Q1)"
affects: [093-04, 093-05, harness, task_service, threads.py-ctx-build, runs.py-continue, harness_engine-resume]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Resolve-never-mutate (D-05): a ctx-model resolver reads settings and returns a string, never writes saved llm_model/override_provider/available_models"
    - "Cross-provider safety net fires ONLY on a genuine mismatch (a non-empty available_models list that excludes the candidate); empty list passes through (backward compatible)"

key-files:
  created:
    - .planning/phases/093-harness-cross-provider-parity/deferred-items.md
  modified:
    - backend/app/services/sub_agent_models.py
    - backend/app/config.py
    - backend/tests/unit/test_sub_agent_routing.py
    - backend/tests/unit/test_085_task_service.py
    - backend/tests/unit/test_sub_agent_intelligence.py

key-decisions:
  - "Google sub-agent default -> gemini-3.5-flash: live /models probe 2026-06-02 confirmed BOTH 2.5 and 3.5 serve; locked the newer 3.x+ representative (matches eval/registry representative + newest-first; gemini-2.5 narrates tools without emitting, D-03)"
  - "Updated 2 now-stale Phase-085 tests (Rule 1) that were green for the WRONG reason — they passed the model list as the never-read llm_models string; switched the stub to the real available_models field so they exercise the genuinely-fixed safety net"

patterns-established:
  - "resolve_workflow_ctx_model: thin precedence wrapper (override_model=None, fallback_model=llm_model) over resolve_sub_agent_model_safely; None -> '' for the resume/Continue user_settings=None case (Open Q2)"
  - "Field-fix-reveals-false-passing-tests: when a dead-field read is corrected, audit every test that exercised the dead path — they were validating nothing"

requirements-completed: []  # PARITY-02 stays OPEN — phase verification owns closure (corrected post-093 adversarial review: previously read [PARITY-02], contradicting the REQUIREMENTS.md ledger + the other 4 plans)

# Metrics
duration: ~22min
completed: 2026-06-02
---

# Phase 093 Plan 03: Sub-Agent Model-Resolver Field Fix + Ctx-Model Wrapper Summary

**Revived the cross-provider sub-agent safety net (dead since Phase 085) by reading the real `available_models` field, added the resolve-never-mutate `resolve_workflow_ctx_model` wrapper for Wave-2, and locked Google's sub-agent default to the live-confirmed `gemini-3.5-flash`.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-06-02T14:19Z (approx)
- **Completed:** 2026-06-02T14:41:02Z
- **Tasks:** 2
- **Files modified:** 5 (+1 created: deferred-items.md)

## Accomplishments
- **The dead safety net now fires.** `resolve_sub_agent_model_safely` read `user_settings.llm_models` — a field that does NOT exist on `UserEffectiveSettings` — so `getattr` always returned `None`, `_active_models_list` was always `[]`, the validation branch at the `if _active_models_list and candidate not in _active_models_list` line never executed, and `_SUB_AGENT_MODEL_DEFAULTS` never engaged. It now reads the real `available_models: list[str]` (D-06), so a stale cross-provider `llm_model` (e.g. a `gpt-*` id saved under `active_provider=anthropic`) falls back to the provider default (`claude-haiku-4-5-20251001`) instead of leaking to the wrong client.
- **`resolve_workflow_ctx_model` wrapper added** (D-04/D-05) — a clean, importable resolve-never-mutate function the Wave-2 ctx-build sites thread onto `wf_ctx.model`.
- **Google sub-agent default locked to `gemini-3.5-flash`** via a live `/models` probe (Open Q1).
- **`Test093ModelResolver` flipped GREEN** and expanded from 2 to 7 cases (16/16 in the file pass).

## Before / After (the load-bearing evidence)

### The dead-field fix (`sub_agent_models.py`)

| | Before (dead since Phase 085) | After (this plan) |
|---|---|---|
| Field read | `user_settings.llm_models` (does not exist → always `None`) | `user_settings.available_models` (the real `list[str]`, `user_settings.py:100`) |
| `_active_models_list` | always `[]` | the real active-provider model list |
| Validation branch | never fired | fires on a genuine cross-provider mismatch |
| `_SUB_AGENT_MODEL_DEFAULTS` | never engaged | engages — stale cross-provider id → provider default |

**Fallback fires ONLY on a genuine mismatch** — i.e. a *non-empty* `available_models` list that does NOT contain the candidate. An empty `available_models` (fresh settings row) passes the candidate through unchanged (backward compatible), and a flexible provider (openrouter/ollama, empty default) keeps the candidate as best-effort. This is exactly the constraint in the plan's context note: re-activating the net must not mis-route a valid same-provider model or an unrecognised id with no list to check against.

### `resolve_workflow_ctx_model` — exact signature + return contract (for the Wave-2 verifier)

```python
def resolve_workflow_ctx_model(user_settings: "UserEffectiveSettings | None") -> str:
```

- **Location:** `backend/app/services/sub_agent_models.py` (bottom of file, after `resolve_sub_agent_model_safely`). The non-frozen helper module (`sub_agent_service.py` stays byte-frozen, D-085-16).
- **Returns:** a safely-resolved model name string, or `""` when `user_settings is None`.
- **Behavior:** `None` → `""` (the resume/Continue `user_settings=None` case — Open Q2, deferred to Wave 2; only `phase.config.model` applies there). Otherwise delegates to `resolve_sub_agent_model_safely(user_settings, override_model=None, fallback_model=getattr(user_settings, "llm_model", None))`, so a stale cross-provider `llm_model` resolves to the active provider's default.
- **Resolve, NEVER mutate (D-05):** it only *reads* `active_provider` / `llm_model` / `available_models`; it never writes saved `llm_model` / `override_provider` / `available_models`. Proven by `test_resolve_workflow_ctx_model_resolves_without_mutating` (captures all three attrs before/after — unchanged).
- **Wave-2 contract:** 093-04 (live kickoff) and 093-05 (resume + Continue) import this and assign its return onto `wf_ctx.model` at the 3 ctx-build sites. Phase-level precedence downstream stays `phase.config.model or ctx.model` — this resolves `ctx.model` itself.

### Google default (Open Q1)

Live `/models` probe (`https://generativelanguage.googleapis.com/v1beta/models`, key read by name only from `.env`, never printed) on **2026-06-02**:
- `gemini-2.5-flash` — **served** (exact id present)
- `gemini-3.5-flash` — **served** (exact id present)

Both serve (neither 404s), so flipping to `gemini-3.5-flash` is a safe, non-404 change. Locked to `gemini-3.5-flash` because it is the eval/registry representative (`eval_cross_provider.py` `PROVIDERS`, `config.py:231`), the eval comment explicitly requires 3.x+ ("gemini-2.5 is known-degraded — narrates a todo list without emitting the tool call — D-03"), and project memory `feedback_prioritize_newest_models` (newest served = default). `_SUB_AGENT_MODEL_DEFAULTS` stays well-formed — all 7 native providers non-empty; verify command prints `SUB_AGENT_DEFAULTS_OK gemini-3.5-flash`.

## Task Commits

Each task was committed atomically (with hooks, single-repo):

1. **Task 1: Fix the dead field read + add resolve_workflow_ctx_model + flip the RED tests** - `8355f144` (fix)
2. **Task 2: Lock the Google sub-agent default against a live /models probe (Open Q1)** - `1247896d` (fix)

_Note: this is a `type=tdd` Task 1 structured as a single combined fix+test commit (the plan's `<action>` flips the existing 093-01 RED scaffold GREEN rather than authoring a fresh `test(...)` cycle). See TDD Gate Compliance below._

## Files Created/Modified
- `backend/app/services/sub_agent_models.py` - read `available_models` (was the non-existent `llm_models`); add `resolve_workflow_ctx_model` resolve-never-mutate wrapper; docstring updated (stale `llm_models comma-separated` wording removed)
- `backend/app/config.py` - `_SUB_AGENT_MODEL_DEFAULTS["google"]` → `gemini-3.5-flash` (live-probe-confirmed, dated comment)
- `backend/tests/unit/test_sub_agent_routing.py` - `Test093ModelResolver` un-skipped + expanded (2→7 cases: stale fallback, in-list passthrough, empty-list passthrough, flexible-provider best-effort, ctx-resolver None/no-mutation/valid-passthrough); google-default assertion → `gemini-3.5-flash`
- `backend/tests/unit/test_085_task_service.py` - `_StubUserSettings` now populates the real `available_models` field (Rule 1 — see Deviations)
- `backend/tests/unit/test_sub_agent_intelligence.py` - google-default assertion → `gemini-3.5-flash`
- `.planning/phases/093-harness-cross-provider-parity/deferred-items.md` - logged the pre-existing out-of-scope failure

## Decisions Made
- **Google default → `gemini-3.5-flash`** (not deferred): the live `/models` probe was runnable in this context (the key is in `.env`), both ids serve, and the evidence (eval representative + D-03 + newest-first) all point to 3.5. No guessing — this is an evidence-gated flip, not an unverified one.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two Phase-085 tests were green for the WRONG reason and broke when the field fix landed**
- **Found during:** Task 1 (broader test-surface re-run after the field fix)
- **Issue:** `test_085_task_service.py` built `_StubUserSettings` with `llm_models="<comma,list>"` — the dead field the resolver never actually read. The two cross-provider-fallback tests (`test_resolve_override_cross_provider_falls_back`, `test_resolve_falls_back_when_user_settings_llm_model_is_cross_provider`) passed pre-fix only because the validation never fired and the candidate happened to pass through; after the fix the resolver reads `available_models` (which the stub didn't set), so the safety net still couldn't fire and the stale id leaked → the `result != "gpt-4.1"` assertion failed. These tests gave the exact false confidence D-06 describes.
- **Fix:** Updated `_StubUserSettings.__init__` to split the supplied list into the real `available_models: list[str]` field (kept the `llm_models` keyword + attribute for back-compat / no call-site churn). Both tests now exercise the genuinely-working safety net and pass.
- **Files modified:** backend/tests/unit/test_085_task_service.py
- **Verification:** `test_085_task_service.py` 30/30 pass; full sub-agent surface 63/63.
- **Committed in:** `1247896d` (Task 2 commit)

**2. [Rule 1 - Bug] Two google-default assertions hard-pinned the old `gemini-2.5-flash`**
- **Found during:** Task 2 (config flip)
- **Issue:** `test_sub_agent_intelligence.py::test_sub_agent_model_provider_default_google` and `test_sub_agent_routing.py::test_google_sub_agent_uses_flash` asserted `== "gemini-2.5-flash"`, which the Open-Q1 config flip correctly invalidates.
- **Fix:** Updated both assertions to `gemini-3.5-flash` with a comment citing the live probe + D-03.
- **Files modified:** backend/tests/unit/test_sub_agent_intelligence.py, backend/tests/unit/test_sub_agent_routing.py
- **Verification:** both pass; full surface 63/63.
- **Committed in:** `1247896d` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — stale tests directly invalidated by the in-scope fixes). **Impact on plan:** Both are within the directly-caused-by-this-task scope boundary (they test the exact function/dict this plan changed). No scope creep — no source behavior beyond the plan's spec was touched.

## Issues Encountered
- **Pre-existing, out-of-scope failure (NOT caused by this plan):** `test_get_model_capability_inference.py::test_infer_openai_from_gpt_prefix` fails (`llm_call_timeout_seconds` 300 vs pinned 90). Confirmed failing in the very first baseline run *before any edit*. It is in `config.py`'s capability-inference defaults — not in `_SUB_AGENT_MODEL_DEFAULTS` or the resolver. Logged to `deferred-items.md`; left untouched per the executor scope boundary. Candidate for a `/gsd:quick` test-pin update. **Net-new failures from this plan: zero.**

## TDD Gate Compliance
Task 1 is `tdd="true"` but the plan's `<action>` is a *RED-scaffold flip* (the failing `Test093ModelResolver` was authored in 093-01 as the named RED contract), not a fresh RED→GREEN authoring cycle. I confirmed RED first (4 of the 7 cases failed against the unfixed source — the stale-fallback case and all 3 `resolve_workflow_ctx_model` cases — including an `ImportError` for the not-yet-existent wrapper), then made them GREEN with the source fix in the same commit per the plan's combined-action instruction. No separate `test(...)` then `feat(...)` commits were required by this plan shape.

## Self-Check: PASSED

- File `backend/app/services/sub_agent_models.py` — modified, FOUND (`available_models` read x1, `llm_models` x0, `def resolve_workflow_ctx_model` x1)
- File `backend/app/config.py` — modified, FOUND (`_SUB_AGENT_MODEL_DEFAULTS["google"] == "gemini-3.5-flash"`, all native-7 non-empty)
- File `backend/tests/unit/test_sub_agent_routing.py` — modified, FOUND (`Test093ModelResolver` un-skipped, 16/16 pass)
- File `.planning/phases/093-harness-cross-provider-parity/deferred-items.md` — created, FOUND
- Commit `8355f144` — FOUND in `git log`
- Commit `1247896d` — FOUND in `git log`
- Gate: `pytest test_sub_agent_routing.py` → 16 passed; broader sub-agent surface → 63 passed; net-new failures = 0
- Verify cmd: `SUB_AGENT_DEFAULTS_OK gemini-3.5-flash`

## Next Phase Readiness
- **Wave-2 (093-04 / 093-05) is unblocked:** `resolve_workflow_ctx_model(user_settings) -> str` is defined, importable from `app.services.sub_agent_models`, and contract-stable (`None` → `""`; otherwise resolve-never-mutate). Thread its return onto `wf_ctx.model` at the live-kickoff (`threads.py`), resume (`harness_engine._build_resume_context`), and Continue (`runs.py`) build sites. Open Q2 (load owner settings on resume/Continue so the resolver fires there) is 093-05 Task 2's call.
- `task_service.py` was correctly NOT touched (093-02 owns it; not in this plan's `files_modified`).

---
*Phase: 093-harness-cross-provider-parity*
*Completed: 2026-06-02*

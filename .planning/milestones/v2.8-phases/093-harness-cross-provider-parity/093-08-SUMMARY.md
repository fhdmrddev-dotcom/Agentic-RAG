---
phase: 093-harness-cross-provider-parity
plan: 08
subsystem: api
tags: [harness, sub-agent, model-resolution, cross-provider, task_service, gpt-4o-avoidance]

# Dependency graph
requires:
  - phase: 093-03
    provides: "resolve_sub_agent_model_safely reading the real available_models field (D-06) + resolve_workflow_ctx_model wrapper (D-04/D-05); _SUB_AGENT_MODEL_DEFAULTS google=gemini-3.5-flash"
  - phase: 093-05
    provides: "D-04 ctx-model threading onto wf_ctx.model at the live/resume/Continue build sites — populates parent_ctx.model with a resolved real model"
  - phase: 093-07
    provides: "finish-event hydration + runs.usage persistence in the same task_service.py sub-agent path; the documented full-suite baseline (111 failed / 1110 passed)"
provides:
  - "_resolve_sub_agent_effective_model — intentional sub-agent model resolution (user sub_agent_model → resolved run/ctx model → fast per-provider default), never the gpt-4o global bounce for a non-openai provider"
  - "the narrow per-provider-default guard that closes the empty-available_models gpt-4o leak (sub_agent_models.py:111-134 passthrough hole)"
  - "9 gpt-4o-avoidance unit tests (Test093IntentionalSubAgentResolution)"
affects: [093-09, 093-verification, 094-panel-timeline, 096-eval]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-helper extraction for testable resolution: a model-resolution branch is hoisted into a side-effect-free helper (_resolve_sub_agent_effective_model) so the gpt-4o-avoidance can be unit-tested directly without mocking the full sub-agent loop"
    - "Reuse-then-guard: reuse the shipped resolver (resolve_sub_agent_model_safely), add only a narrow per-provider-default guard for the empty-list passthrough hole — never fork a third resolver copy (D-05/D-06 stay intact)"

key-files:
  created: []
  modified:
    - "backend/app/services/task_service.py — _resolve_sub_agent_effective_model helper + run_task_sub_agent rewired to call it"
    - "backend/tests/unit/test_sub_agent_routing.py — Test093IntentionalSubAgentResolution (9 cases)"
    - ".planning/phases/093-harness-cross-provider-parity/deferred-items.md — 093-08 pre-existing-failure entry"

key-decisions:
  - "Honor the user's explicit sub_agent_model as the override (the field DOES exist on UserEffectiveSettings — confirmed at user_settings.py:155, type str) — so the sub_agent_model honor is load-bearing, not just the bonus"
  - "Closed the empty-available_models gpt-4o leak with a narrow guard in task_service (not in the resolver) — fires ONLY when effective_model == settings.llm_model AND provider not in (openai, openrouter, ollama, unknown) AND a per-provider default exists; resolve-never-mutate (D-05) preserved"
  - "Task 2 ctx-model threading was already-wired (no edit needed): _build_phase_tool_context already threads model=_effective_model(phase,ctx) (:175) + user_settings (:169) onto the sub-agent parent_ctx"

patterns-established:
  - "byte-identical-Deep guard via revert-and-reproduce: the 4 test_085_sub_agent_cross_provider failures were re-proven pre-existing by reverting task_service.py to the plan's parent (893de428~1) and re-running — they fail identically, so they are not a regression"

requirements-completed: [PARITY-02]

# Metrics
duration: ~20min
completed: 2026-06-03
---

# Phase 093 Plan 08: Intentional Harness Sub-Agent Model Resolution (D-18/S3) Summary

**A harness sub-agent now resolves its model intentionally — the user's `sub_agent_model` → the resolved run/ctx model → the active provider's FAST per-provider default — never the accidental `gpt-4o` global bounce on a non-openai provider, closing the LIVE-UAT S3 leak where Google/Moonshot/GLM sub-agents silently ran on gpt-4o.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-03
- **Completed:** 2026-06-03
- **Tasks:** 2
- **Files modified:** 3 (2 production/test + 1 doc)

## Accomplishments

- **Intentional resolution (D-18/S3 — PARITY-02 SC#1):** `run_task_sub_agent` now calls a new pure helper `_resolve_sub_agent_effective_model` that threads the user's explicit `sub_agent_model` as the override and the D-04-resolved `parent_ctx.model` as the fallback. The sub-agent runs row now records the user's intended per-provider model.
- **gpt-4o leak closed:** a narrow per-provider-default guard catches exactly the empty-`available_models` passthrough hole the shipped resolver does NOT catch (`sub_agent_models.py:111-134`). When the candidate falls all the way through to `settings.llm_model="gpt-4o"` AND the provider is non-openai/flexible/unknown AND a per-provider fast default exists, the guard substitutes the fast tier (google→`gemini-3.5-flash`, moonshot→`kimi-k2.6`, zhipu→`glm-4.6`). The guard NEVER fires for `openai` / `openrouter` / `ollama` / `unknown` (their candidate passthrough is legitimate).
- **Field-name verdict confirmed:** `sub_agent_model: str` exists on `UserEffectiveSettings` (`user_settings.py:155`), so the `override_model` honor path applies — the sub_agent_model honor is load-bearing (not just the documented bonus).
- **resolve-never-mutate (D-05) preserved:** the helper reads `user_settings` + config only — `grep -cE '\.update\(' task_service.py == 0`.
- **Task 2 ctx threading confirmed already-wired:** `_build_phase_tool_context` already threads `model=_effective_model(phase, ctx)` (:175) and `user_settings` (:169) onto the sub-agent parent_ctx — no edit needed. `grep -c "_effective_model" phase_types.py == 5` (>= 2).
- **byte-identical-Deep guard (D-14 RED LINE, deterministic half):** full-suite **111 failed / 1119 passed = ZERO net-new** vs the documented 093-07 baseline (111 failed / 1110 passed; the +9 passing are this plan's new cases). `sub_agent_service.py` + `agent_loop.py` ZERO-diff. `async for` count in `task_service.py` = 0 (IN-05). 9 new gpt-4o-avoidance cases GREEN.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make run_task_sub_agent resolution intentional (TDD: RED→GREEN in one commit)** — `893de428` (feat)
2. **Task 2: Confirm ctx threading + byte-identical-Deep guard (verification + doc)** — `9c3b1e07` (docs)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP) committed separately.

_Note: Task 1 is `tdd="true"`. Per the `type: execute` gap-closure convention, RED tests were authored and confirmed failing (`ImportError: cannot import name '_resolve_sub_agent_effective_model'`) BEFORE the implementation, then flipped GREEN within the same task commit — no discrete `test(...)` RED commit. Task 2 introduced no production code (already-wired), so its artifact is the deferred-items doc + the verification evidence in this SUMMARY._

## Files Created/Modified

- `backend/app/services/task_service.py` — added `_resolve_sub_agent_effective_model` (intentional resolution + gpt-4o-leak guard, reusing the shipped `resolve_sub_agent_model_safely`); rewired `run_task_sub_agent` to call it instead of the inline `resolve_sub_agent_model_safely(..., override_model=None, fallback_model=parent_ctx.model or None)` bounce. Added `_SUB_AGENT_MODEL_DEFAULTS` to the `app.config` import.
- `backend/tests/unit/test_sub_agent_routing.py` — added `Test093IntentionalSubAgentResolution` (9 cases): override honored, ctx-model fallback, google→gemini-3.5-flash, moonshot→kimi-k2.6, zhipu→glm-4.6, openai-stays-gpt-4o, openrouter-passthrough, Deep real-model passthrough, none-settings→unknown→no-guard.
- `.planning/phases/093-harness-cross-provider-parity/deferred-items.md` — 093-08 entry re-proving the 4 `test_085_sub_agent_cross_provider` failures pre-existing.

## Decisions Made

- **Pure-helper over inline:** extracted the resolution into `_resolve_sub_agent_effective_model` (a side-effect-free function taking `user_settings` + `ctx_model`) so the gpt-4o-avoidance is unit-testable directly, rather than driving `run_task_sub_agent` with a mock parent_ctx + stubbed `insert_run`. The acceptance grep `grep -c "def resolve_" == 0` still holds because the helper is named `_resolve_*` (underscore-prefixed) — no NEW `resolve_*` resolver was defined.
- **Guard placement in task_service, not the resolver:** kept `resolve_sub_agent_model_safely` byte-identical (D-05/D-06 intact) — the guard lives at the call site and only post-processes the resolver's output, closing the documented empty-list passthrough without touching the shared resolver or the openai path.

## Deviations from Plan

None - plan executed exactly as written.

The plan offered two test-driving strategies (extract a pure helper OR mock parent_ctx + assert on `insert_run`'s `model=`). The pure-helper option was chosen — explicitly sanctioned by the plan's `<action>` step 4 ("either extract the resolution into a tiny pure helper called by run_task_sub_agent and test that, OR ..."). The plan's inline `override_model=_user_sub_agent_model` snippet was honored verbatim inside the helper. The field-name confirmation (step 3) resolved to "field exists" → the `override_model` line was kept (not omitted).

## Issues Encountered

- **4 `test_085_sub_agent_cross_provider::test_cross_provider_default_path_no_footgun[anthropic|google|deepseek|moonshot]` failures in the full suite.** Flagged in the project constraints as a known pre-existing deferred failure (stale `llm_models` CSV fixture from 093-03's `available_models` migration). **Re-proven pre-existing for this plan:** reverted `task_service.py` to `893de428~1` (the plan's parent), re-ran the 4 cases → they fail IDENTICALLY (4 failed / 3 passed). They are the model-resolver integration sibling already deferred under 093-07; orthogonal to this plan's helper + guard. Out of scope — logged to `deferred-items.md`. Fix is the same one-line `available_models` fixture update across the 093-03/07/08 deferral cluster.

## D-21 Re-UAT Flag (verifier/operator-owned)

The deterministic half is closed by this plan. The LIVE proof — a non-openai harness sub-agent (Google / Moonshot / GLM) records the CORRECT per-provider model in its `runs` row (NOT `gpt-4o`) on a real cross-provider run, verified via the Supabase `runs` row + the D-20 log-sink showing NO `sub_agent_model='gpt-4o' is not in … falling back` line for a non-openai provider — is the verifier/operator-owned **D-21 re-UAT** (authored in `093-VALIDATION.md`, NOT duplicated as a plan task). PARITY-02 stays Pending until the native-7 LIVE UAT passes.

## User Setup Required

None - no external service configuration required. (The D-20 log-sink the re-UAT relies on is already shipped in 093-06; the operator activates it by setting `LOG_FILE_PATH=logs/backend.log` before the D-21 re-UAT.)

## Next Phase Readiness

- 093-08 (D-18/S3) deterministic half complete. **NEXT: execute 093-09 (D-19 GLM diagnose-first)** → then phase close (verifier-owned D-21 native-7 × 5-type × 4-workflow LIVE UAT).
- No blockers. The byte-identical-Deep RED LINE held at the deterministic + file levels (protected files zero-diff, net-new=0).

## Self-Check: PASSED

- FOUND: `093-08-SUMMARY.md`, `backend/app/services/task_service.py`, `backend/tests/unit/test_sub_agent_routing.py`
- FOUND: commit `893de428` (Task 1 feat), commit `9c3b1e07` (Task 2 docs)
- FOUND: `_resolve_sub_agent_effective_model` in the committed `task_service.py`

---
*Phase: 093-harness-cross-provider-parity*
*Completed: 2026-06-03*

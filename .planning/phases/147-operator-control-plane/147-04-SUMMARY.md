---
phase: 147-operator-control-plane
plan: 04
subsystem: api
tags: [fastapi, feature-flags, kill-switch, tool-dispatch, cross-provider, fail-closed, tdd]

# Dependency graph
requires:
  - phase: 147-01
    provides: "self_improve_enabled() / workflows_enabled() TTL-cached flag-read helpers + migration-097 app_settings columns (D-Q4 polarity)"
provides:
  - "Two-layer fail-closed capability kill-switch (HIDE from get_tools schema + REFUSE at dispatch_tool) for web_search / execute_code / save_skill"
  - "Provider-agnostic in-flight capability refusal (plain capability_disabled ToolResult) that fails closed uniformly for OpenAI / Anthropic / Google / OpenRouter"
  - "self-improvement proposer entry (skill_proposer_service.propose) fail-closed guard — the second self-improve seam"
  - "D-05 workflow-launch block at the send_message kickoff seam (blocks NEW launches; in-flight runs finish)"
affects: [147-05, 147-06, operator-control-plane, capability-grid, maintenance-mode]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-layer fail-closed capability gate: hide (schema) + refuse (dispatch), both no-op when flag on/absent (091 whitelist no-op precedent)"
    - "Provider-agnostic refuse: plain ToolResult string; agent loop attaches tool_call_id → zero provider branches, one shared path"
    - "Kill-switch guard at the NEW-work seam only (D-05): switches stop new work, Kill handles in-flight"

key-files:
  created:
    - backend/tests/test_147_flag_hide.py
    - backend/tests/test_147_flag_refuse.py
    - backend/tests/test_147_workflows_flag.py
  modified:
    - backend/app/services/openai_service.py
    - backend/app/services/tool_dispatcher.py
    - backend/app/services/skill_proposer_service.py
    - backend/app/api/threads.py

key-decisions:
  - "A1/Q5 resolved: self-improve has TWO seams — the save_skill tool (hidden + refused) AND skill_proposer_service.propose (the eval→instruction-proposal draft route at evals.py:837, a user-triggered route, NOT an autonomous background job). Both guarded."
  - "effective-None fallback for self_improve reads the plan-01 TTL helper (NOT settings.self_improve_enabled — app.config.settings has no such attribute; self_improve is app_settings-only by Wave-1 design)."
  - "Workflows block returns 403 Forbidden with plain admin copy — a deliberate policy refusal, not an outage."

patterns-established:
  - "Capability refuse gate: _CAPABILITY_FLAG_TOOLS map + _capability_disabled_message() sibling of the 091 whitelist no-op; fail-closed toward last-known-good (default-ON on a read blip)."
  - "getattr default-ON for a newly-added effective-settings field (resilient to legacy/partial settings objects while honoring D-Q4 polarity)."

requirements-completed: [FLAG-01]

# Metrics
duration: 22min
completed: 2026-07-11
---

# Phase 147 Plan 04: FLAG-01 Capability Kill-Switch Enforcement Summary

**Two-layer fail-closed capability kill-switches (hide-from-schema + refuse-at-dispatch) for web/sandbox/self-improve plus the proposer entry, and a D-05 workflow-launch block at the kickoff seam — every gate a literal no-op when its flag is on, so Deep Mode stays byte-identical and enforcement is uniform across all providers.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-07-11T13:33:31+04:00
- **Completed:** 2026-07-11T13:55:52+04:00
- **Tasks:** 2 (both TDD)
- **Files modified:** 4 source + 3 tests created + 1 deferred-items appended

## Accomplishments
- **Layer 1 HIDE** (`openai_service.get_tools`): `SAVE_SKILL_TOOL` moved from the always-on list to a `self_improve`-gated conditional append — a disabled self-improve capability is never advertised to any model. Set-identical to the pre-147 toolbox when on.
- **Layer 2 REFUSE** (`tool_dispatcher.dispatch_tool`): a sibling of the Phase-091 whitelist no-op — when `web_search` / `execute_code` / `save_skill` is called in-flight while its operator kill-switch is OFF, dispatch returns a plain `capability_disabled` ToolResult the agent can relay. Provider-agnostic (no `provider ==` branch — verified), so it fails closed identically for OpenAI, Anthropic, Google, and OpenRouter. Literal no-op when the flag is on/absent.
- **Second self-improve seam** (`skill_proposer_service.propose`): fail-closed `self_improve_enabled()` guard at entry — drafts nothing (honest `None`) when self-improvement is off.
- **D-05 workflow-launch block** (`threads.py` send_message kickoff): one surgical, additive guard inside the NEW-launch branch, fired before any definition resolve / user-message insert / `create_workflow_run` — a blocked launch leaves no partial run row and no blank message; in-flight runs and Deep chat are untouched.
- Fail-closed toward last-known-good throughout: a settings-read blip returns the prior value (capability default-ON, D-Q4), never a spurious refusal or outage.

## Task Commits

TDD tasks (test → feat):

1. **Task 1: Two-layer capability gate + proposer guard**
   - `817c01bd` — test (RED: hide + refuse failing tests)
   - `6ad019f9` — feat (GREEN: hide + refuse + proposer guard)
2. **Task 2: D-05 workflow-launch block**
   - `edb344f0` — test (RED: kickoff-block failing tests)
   - `9cd0c050` — feat (GREEN: kickoff guard)

## Files Created/Modified
- `backend/app/services/openai_service.py` — HIDE layer: `SAVE_SKILL_TOOL` conditional append gated by self_improve (getattr default-ON; effective-None → TTL helper).
- `backend/app/services/tool_dispatcher.py` — REFUSE layer: `_CAPABILITY_FLAG_TOOLS` map + `_capability_disabled_message()` + a dispatch branch (module-level `load_app_settings` import).
- `backend/app/services/skill_proposer_service.py` — `propose()` fail-closed `self_improve_enabled()` guard at entry.
- `backend/app/api/threads.py` — D-05 `workflows_enabled()` guard at the kickoff seam (+ import extension).
- `backend/tests/test_147_flag_hide.py` — get_tools omits save_skill when off; set-equal baseline when on.
- `backend/tests/test_147_flag_refuse.py` — dispatch refuses each of the 3 tools when off; no-op passthrough when on; last-known-good on a read blip.
- `backend/tests/test_147_workflows_flag.py` — kickoff off→403-before-insert; on→proceeds; Deep unaffected.

## Decisions Made
- **A1/Q5 verified & resolved:** self-improvement has two seams. The `save_skill` tool is the primary (Deep-chat) surface — hidden + refused. The other is `skill_proposer_service.propose`, invoked from the eval → instruction-proposal draft route (`evals.py:837`) — a **user-triggered route**, not an autonomous background trigger. Both are now fail-closed guarded. The route already maps a `None` proposal to a clean refusal, so the guard degrades gracefully.
- **Workflows refusal = 403 Forbidden** with plain "Workflows are currently disabled by the administrator" copy — a deliberate policy refusal (fits D-05), not a 503 outage.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] self_improve effective-None fallback could not read `settings.self_improve_enabled`**
- **Found during:** Task 1 (HIDE layer)
- **Issue:** The plan's action said to resolve self_improve "effective-settings-first, then module settings" (mirroring web/sandbox). But `app.config.settings` has **no** `self_improve_enabled` attribute — Wave 1 deliberately made the three new flags app_settings-only (`env_attr=None`), unlike web/sandbox which do exist on the env settings. Following the literal instruction would raise `AttributeError` on any `get_tools(None)` call. Additionally, several existing tests pass partial effective mocks lacking the new field.
- **Fix:** effective branch reads `getattr(effective, "self_improve_enabled", True)` (default-ON, honoring D-Q4 polarity and resilient to legacy/partial settings objects); the effective-None branch reads the plan-01 TTL helper `self_improve_enabled()` (the correct app_settings source). Web/sandbox reads left unchanged.
- **Files modified:** `backend/app/services/openai_service.py`
- **Verification:** `test_147_flag_hide.py` (3/3) + the previously-failing `test_openai_service.py` effective-mock tests now green.
- **Committed in:** `6ad019f9`

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Necessary for correctness (prevents a production `AttributeError` and honors the fail-closed default-ON polarity). No scope creep — the enforcement shape and seams are exactly as planned.

## Issues Encountered
- **Two pre-existing test-rot clusters surfaced (out of scope, logged to `deferred-items.md`, NOT fixed):**
  - `test_085_tool_registration.py::test_get_tools_returns_22_tools_with_no_conditional_enabled` — hardcoded `22`/`24` counts are stale; the base list grew to **24** via Phase 115/116 (`query_documents_by_view` + `get_related_documents`) before this test's counts were written. Verified pre-existing via `git show HEAD` (base = 24). Plan 147-04's `get_tools` change is exactly count-neutral (removes `SAVE_SKILL_TOOL`, re-appends via default-ON conditional).
  - `test_threads.py` streaming + dispatch-attribution tests — patch a removed symbol `app.api.threads.create_streaming_chat` (0 references at HEAD and in this plan's diff; removed in the Phase-089 agent_loop extraction). Unrelated to the additive D-05 guard.

## Known Stubs
None — every gate is wired to a live plan-01 TTL flag helper (`self_improve_enabled`, `workflows_enabled`) or the app_settings snapshot (`load_app_settings`). No placeholder/mock data paths.

## User Setup Required
None — no external service configuration. The three flag columns + TTL helpers shipped in Wave 1 (migration 097); this plan is pure enforcement.

## Next Phase Readiness
- FLAG-01 backend enforcement is complete for web / sandbox / self-improve (both seams + proposer) and workflows (kickoff block). The operator `/flags` PUT + Capability Grid UI (other 147 plans) can flip these and the enforcement takes effect within the ~30s TTL window, uniformly across providers.
- Maintenance/read-only mode (D-06) is a separate seam (middleware) owned by another 147 plan — not touched here.
- Concern: the two pre-existing test-rot clusters in `deferred-items.md` should be repaired in a cleanup pass (bump stale counts; re-point the `create_streaming_chat` patch to `agent_loop`).

## Self-Check: PASSED

All 4 modified source files + 3 created test files + the SUMMARY exist on disk; all 4 task commits (`817c01bd`, `6ad019f9`, `edb344f0`, `9cd0c050`) present in git. Plan verification suite green: `pytest tests/test_147_flag_hide.py tests/test_147_flag_refuse.py tests/test_147_workflows_flag.py` → 14 passed. Provider-branch acceptance grep over the added capability-gate + dispatch region → NONE.

---
*Phase: 147-operator-control-plane*
*Completed: 2026-07-11*

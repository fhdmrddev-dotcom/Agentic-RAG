---
phase: 054-reliable-agentic-generation
plan: "04"
subsystem: api
tags: [anthropic, streaming, dispatch, react, settings, provider]

# Dependency graph
requires:
  - phase: 054-02
    provides: NATIVE_PROVIDERS bypass and _resolve_max_tokens without cap for native providers
  - phase: 054-03
    provides: stream_anthropic() normalized event generator in anthropic_service.py
provides:
  - Anthropic native SDK dispatch branch in threads.py agent loop
  - Provider-conditional slider visibility in SettingsPage.tsx for native providers
affects:
  - 054-05
  - any future provider additions to threads.py dispatch

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Provider dispatch in agent loop: if active_provider == X -> specialized path, else -> OpenAI compat path"
    - "isNativeProvider React constant: derives from activeProvider state to conditionally render UI elements"

key-files:
  created: []
  modified:
    - backend/app/api/threads.py
    - frontend/src/pages/SettingsPage.tsx

key-decisions:
  - "Dispatch detects provider from getattr(user_settings, 'active_provider', '') — not from request body — preventing spoofing"
  - "AnthropicAPIError caught alongside openai.APIError in the retry/raise except clause for uniform error handling"
  - "Worktree base (d2aa849) uses create_streaming_chat, not create_adaptive_streaming_chat — dispatch wraps the correct function"
  - "SettingsPage.tsx worktree has 2 sliders (Context depth, Sub-agent output tokens), not 3 — wrapped both; no Main model slider existed"

patterns-established:
  - "Anthropic dispatch: active_provider_name guard before stream call, normalized event processing into tool_calls_buffer"
  - "isNativeProvider ternary: hides sliders, shows read-only info row, preserves state variables for round-trip"

requirements-completed:
  - GEN-02
  - GEN-05

# Metrics
duration: 25min
completed: 2026-04-26
---

# Phase 054 Plan 04: Anthropic Dispatch + Native Provider Slider Hide Summary

**Anthropic native SDK dispatch wired into threads.py agent loop; Settings sliders hidden for native providers (openai, anthropic, google) with read-only info rows**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-26T14:43:00Z
- **Completed:** 2026-04-26T15:08:21Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- threads.py now routes Anthropic API calls through stream_anthropic() from anthropic_service.py when active_provider == "anthropic"
- The OpenAI/Google/OpenRouter/Ollama path (create_streaming_chat) is preserved unchanged in the else branch
- AnthropicAPIError added to the retry except clause for uniform transient-error handling
- SettingsPage.tsx isNativeProvider constant gates slider visibility; sliders replaced with read-only info rows for native providers
- State variables (contextWindowMaxTokens, subAgentMaxOutputTokens) preserved — values round-trip when user switches back to OpenRouter

## Task Commits

1. **Task 1: Anthropic dispatch in threads.py** - `eb42799` (feat)
2. **Task 2: Slider hide in SettingsPage.tsx** - `3e60aa1` (feat)

## Files Created/Modified

- `backend/app/api/threads.py` - Added stream_anthropic import, AnthropicAPIError import, provider dispatch branch inside agent while-loop
- `frontend/src/pages/SettingsPage.tsx` - Added isNativeProvider constant, wrapped two slider FieldRows in conditional renders

## Decisions Made

- Detected provider from `getattr(user_settings, "active_provider", "")` rather than request body to prevent client-side spoofing (T-054-04-01 mitigated)
- Used `getattr(provider_err, "status_code", "unknown")` in the retry logger — AnthropicAPIError may not have `.status_code` attribute, so safe fallback
- Worktree's threads.py uses `create_streaming_chat` (not `create_adaptive_streaming_chat`) — kept the actual function name in the else branch; plan was written for a different commit state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan expected create_adaptive_streaming_chat but worktree has create_streaming_chat**
- **Found during:** Task 1 (threads.py dispatch)
- **Issue:** The plan was written referencing `create_adaptive_streaming_chat` in the else branch, but the worktree's base commit (d2aa849) uses `create_streaming_chat`. The two functions differ: create_adaptive_streaming_chat returns a (stream, calling_mode) tuple and handles CallingMode.STRUCTURED; create_streaming_chat returns only a stream
- **Fix:** Wrapped the actual existing `create_streaming_chat` call (and its surrounding logic) in the else branch — behavior unchanged, just indented inside else
- **Files modified:** backend/app/api/threads.py
- **Verification:** Pre-existing test failures (27 total) are identical before and after changes — no new failures introduced
- **Committed in:** eb42799

**2. [Rule 1 - Bug] Plan expected 3 sliders but worktree has 2**
- **Found during:** Task 2 (SettingsPage.tsx slider hide)
- **Issue:** The plan specified wrapping "Main model output tokens" slider, but this slider does not exist in the worktree's SettingsPage.tsx. The worktree has only "Context depth" and "Sub-agent output tokens". No llmMaxOutputTokens state variable existed.
- **Fix:** Wrapped the two sliders that actually exist; skipped the non-existent third slider
- **Files modified:** frontend/src/pages/SettingsPage.tsx
- **Verification:** TypeScript check passes; grep -c "isNativeProvider" returns 3 (1 def + 2 usages)
- **Committed in:** 3e60aa1

---

**Total deviations:** 2 auto-fixed (both Rule 1 — adapting plan to actual worktree state)
**Impact on plan:** Both adaptations necessary for correctness. Core objectives fully achieved: Anthropic dispatch is live; sliders hidden for native providers. No scope creep.

## Issues Encountered

- The worktree's base commit (d2aa849) differs structurally from the newer main repo code used to write the plan. The worktree uses create_streaming_chat; the main repo uses create_adaptive_streaming_chat. This is expected — worktree was branched before phase 053 changes were merged into master.
- 27 pre-existing test failures exist on the base commit; my changes introduce zero new failures. Pre-existing failures are in: test_explorer_agent.py (6 — mock patching wrong function name), test_openai_service.py (5 — import errors from non-existent functions), test_sub_agent_intelligence.py (1), test_suggestions.py (5), and integration tests (10).

## Known Stubs

None — both changes are fully functional implementations, not stubs.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced beyond what was planned in the threat model.

## Next Phase Readiness

- Anthropic streaming dispatch is fully wired; 054-05 can build on top of this
- The provider-conditional UI is complete; any new native providers just require adding the provider ID to the isNativeProvider array

## Self-Check

- [x] `backend/app/api/threads.py` exists and contains `from app.services.anthropic_service import stream_anthropic`
- [x] `frontend/src/pages/SettingsPage.tsx` exists and contains `isNativeProvider`
- [x] Task 1 commit `eb42799` exists
- [x] Task 2 commit `3e60aa1` exists
- [x] 27 test failures are all pre-existing (no new failures introduced)
- [x] TypeScript build clean (tsc --noEmit exits 0)

## Self-Check: PASSED

---
*Phase: 054-reliable-agentic-generation*
*Completed: 2026-04-26*

---
phase: 083-foundation-tool-dispatch-extraction-bug-fixes
plan: 03
subsystem: api
tags: [bug-fix, streaming, chunk-handler, title-generation, kimi, deepseek, moonshot, google, provider-gating]
dependency_graph:
  requires:
    - phase: 083-01
      provides: "tool_dispatcher.py extracted -- threads.py reduced to ~3068 lines"
  provides:
    - "Provider-gated Kimi/Moonshot thinking content filter in _on_chunk_openai"
    - "Fixed generate_thread_title with single-model-provider routing and Google max_tokens bump"
    - "_SINGLE_MODEL_PROVIDERS constant for provider tier classification"
  affects: [cross-provider-UAT, provider-routing]
tech_stack:
  added: []
  patterns:
    - "State-machine tag filter for provider-specific content gating in streaming chunks"
    - "Provider tier classification via _SINGLE_MODEL_PROVIDERS frozenset"
key_files:
  created: []
  modified:
    - backend/app/api/threads.py
decisions:
  - "D-06: Kimi thinking filter uses state-machine approach with _in_think_block nonlocal flag; handles tags split across chunks except at character boundaries within the tag name itself"
  - "D-08: _SINGLE_MODEL_PROVIDERS frozenset at module level includes deepseek, moonshot, minimax, zhipu, ollama; Google remains multi-model (has cheaper gemini-2.5-flash for title gen)"
  - "No changes to backend/app/config.py -- _SUB_AGENT_MODEL_DEFAULTS stays as-is; bypassed by _SINGLE_MODEL_PROVIDERS check"
patterns-established:
  - "Provider-gated content filtering in _on_chunk_openai: check active_provider_name before applying provider-specific delta.content transformations"
  - "Single-model vs multi-model provider classification for sub-agent model routing decisions"
requirements-completed: [FOUND-02]
metrics:
  duration: 9min
  completed: 2026-05-28
---

# Phase 083 Plan 03: Backend Bug Fixes (Kimi Thinking + Title Generation) Summary

**Provider-gated Kimi thinking content filter strips <think> tags from visible chat + title generation fixed for DeepSeek/Moonshot/MiniMax/GLM/Google with tier-aware model routing**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-27T21:13:30Z
- **Completed:** 2026-05-27T21:22:24Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added state-machine thinking content filter in `_on_chunk_openai` that strips `<think>...</think>` tags from Kimi/Moonshot delta.content and routes reasoning text to `full_reasoning_content` for the collapsible thinking panel (BUG-260526-02 closed)
- Fixed `generate_thread_title` to use user's main model for single-model providers (DeepSeek, Moonshot, MiniMax, GLM, Ollama) instead of attempting sub-agent model routing to non-existent cheaper tiers (BUG-260527-01 closed)
- Bumped Google title generation max_tokens from 30 to 60 to prevent title truncation
- Applied consistent `_title_max_tokens` in both primary and NotFoundError fallback paths (was hardcoded 20 in fallback)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add provider-gated Kimi thinking content filter in _on_chunk_openai** - `f69c073` (fix)
2. **Task 2: Fix title generation for single-model providers + Google truncation** - `6a7fdbf` (fix)

## Files Created/Modified

- `backend/app/api/threads.py` - Added `_in_think_block` state variable + state-machine filter in `_on_chunk_openai` for Kimi/DeepSeek thinking tags; added `_SINGLE_MODEL_PROVIDERS` frozenset + rewrote `generate_thread_title` model resolution with tier-aware routing + variable token budget

## Decisions Made

- **D-06 implementation:** State-machine approach with `_in_think_block` nonlocal flag. The filter activates for both "moonshot" and "deepseek" providers (defense-in-depth -- DeepSeek's native `reasoning_content` field handler remains unchanged as a separate code path). In practice, Kimi sends `<think>` tags as atomic tokens so cross-chunk tag splitting is extremely unlikely, but the state machine handles it correctly if it occurs.
- **D-08 implementation:** `_SINGLE_MODEL_PROVIDERS` defined as a module-level `frozenset` near `generate_thread_title`. Google is NOT included because it has cheaper models (gemini-2.5-flash) for sub-agent routing. Ollama IS included since users manage their own local models and there's no concept of a cheaper tier.
- **No config.py changes:** `_SUB_AGENT_MODEL_DEFAULTS` stays as-is. The single-model entries (deepseek, moonshot, minimax, zhipu) are bypassed by the new `_SINGLE_MODEL_PROVIDERS` check before the defaults dict is ever consulted.

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None -- both tasks applied cleanly to the post-Plan-01 threads.py (tool dispatch extraction had removed ~775 LOC from a different section, so the chunk handler and title generation sections were unaffected).

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- BUG-260526-02 (Kimi thinking leak) and BUG-260527-01 (title generation) are closed at the code level; live UAT confirmation with actual Kimi/DeepSeek/Google API calls recommended during Phase 083 verification
- The `_SINGLE_MODEL_PROVIDERS` frozenset is reusable by suggestion_service and sub_agent_service if they need the same tier classification in future phases
- threads.py is now at ~3100 lines (post-extraction + bug fixes); the G-5 refactor from Plan 01 keeps the file manageable

## Self-Check: PASSED

- [x] backend/app/api/threads.py exists and contains all expected patterns
- [x] Commit f69c073 found in git log
- [x] Commit 6a7fdbf found in git log

---
*Phase: 083-foundation-tool-dispatch-extraction-bug-fixes*
*Completed: 2026-05-28*

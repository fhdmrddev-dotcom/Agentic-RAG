---
phase: "052-multi-provider-model-routing"
plan: "01"
subsystem: "backend"
tags: ["model-routing", "fallback", "settings", "sub-agent", "sse"]
dependency_graph:
  requires: []
  provides:
    - "_SUB_AGENT_MODEL_DEFAULTS in config.py (canonical location)"
    - "resolve_sub_agent_model() helper in user_settings.py"
    - "run_sub_agent() 404 fallback with sentinel yield"
    - "generate_suggestions() returns (list[str], dict | None) tuple"
    - "generate_thread_title() returns (str, dict | None) tuple"
    - "event_stream() emits fallback_model SSE event"
    - "GET /api/settings includes resolved_sub_agent_model"
    - "PATCH /api/settings returns 422 when sub_agent_model invalid for provider"
  affects:
    - "backend/app/config.py"
    - "backend/app/services/sub_agent_service.py"
    - "backend/app/services/suggestion_service.py"
    - "backend/app/models/user_settings.py"
    - "backend/app/api/threads.py"
    - "backend/app/api/settings.py"
tech_stack:
  added: []
  patterns:
    - "Sentinel JSON string yield from generator for cross-type event propagation"
    - "Tuple return pattern for (result, fallback_info) in non-streaming LLM callers"
    - "openai.NotFoundError caught BEFORE openai.APIError in same try block"
    - "Local import inside function body to avoid circular import"
key_files:
  created: []
  modified:
    - "backend/app/config.py"
    - "backend/app/services/sub_agent_service.py"
    - "backend/app/services/suggestion_service.py"
    - "backend/app/models/user_settings.py"
    - "backend/app/api/threads.py"
    - "backend/app/api/settings.py"
decisions:
  - "Move _SUB_AGENT_MODEL_DEFAULTS to config.py to break circular import chain (user_settings -> sub_agent_service -> user_settings)"
  - "Use local import inside resolve_sub_agent_model() body for _SUB_AGENT_MODEL_DEFAULTS to avoid any remaining import ordering issues"
  - "Sentinel string design: generator yields JSON string with __type key; event_stream detects via startswith check before treating as content"
  - "HTTPException added to settings.py imports (was missing) to enable 422 validation"
metrics:
  duration: "~20 minutes"
  completed: "2026-04-25"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 6
  files_created: 0
---

# Phase 052 Plan 01: Sub-Agent 404 Fallback and Settings Validation Summary

Backend foundation for multi-provider model routing: moved `_SUB_AGENT_MODEL_DEFAULTS` to `config.py`, added `openai.NotFoundError` fallback with `fallback_model` SSE event notification across all three sub-agent callers, and exposed `resolved_sub_agent_model` in Settings GET with save-time validation in Settings PATCH.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Move _SUB_AGENT_MODEL_DEFAULTS to config.py and add resolve_sub_agent_model | 1d76a1d | config.py, sub_agent_service.py, user_settings.py |
| 2 | Add openai.NotFoundError 404 fallback to run_sub_agent, generate_suggestions, generate_thread_title | cb75498 | sub_agent_service.py, suggestion_service.py, threads.py |
| 3 | Add resolved_sub_agent_model to Settings GET and sub_agent_model validation to PATCH | 8da8f08 | settings.py |

## What Was Built

### Task 1: Constants Consolidation
- `_SUB_AGENT_MODEL_DEFAULTS` dict moved from `sub_agent_service.py` to `config.py` (after `MODEL_CONTEXT_DEFAULTS`)
- `sub_agent_service.py` now imports it: `from app.config import settings, _SUB_AGENT_MODEL_DEFAULTS`
- `suggestion_service.py` import updated: from `sub_agent_service._SUB_AGENT_MODEL_DEFAULTS` to `app.config._SUB_AGENT_MODEL_DEFAULTS` (eliminates circular import risk)
- `resolve_sub_agent_model(s: UserEffectiveSettings) -> str` added to bottom of `user_settings.py`; uses local import to avoid circular dependency

### Task 2: 404 Fallback Pattern
- `run_sub_agent()`: wraps streaming create in `try/except openai.NotFoundError`; on 404, derives fallback model from provider defaults, yields JSON sentinel string (`{"__type": "fallback_model", ...}`), then retries with fallback
- `generate_suggestions()`: wraps non-streaming create; on 404, retries with fallback; return type changed from `list[str]` to `tuple[list[str], dict | None]`
- `generate_thread_title()`: wraps non-streaming create; on 404, retries with fallback; return type changed from `str` to `tuple[str, dict | None]`; `except openai.NotFoundError` placed BEFORE `except Exception` in same try block
- `event_stream()` in threads.py: sub-agent streaming loop detects sentinel via `startswith('{"__type": "fallback_model"')`, parses it, re-yields as `fallback_model` SSE event without polluting `sub_agent_content`; suggestions and title calls updated to unpack tuple returns and emit `fallback_model` SSE events when fallback occurred

### Task 3: Settings API
- `FullSettingsResponse` model gains `resolved_sub_agent_model: str` field
- `_build_response()` populates it via `resolve_sub_agent_model(s)`
- `HTTPException` added to `settings.py` imports
- `resolve_sub_agent_model` imported from `user_settings`
- PATCH/PUT handler: before `save_override(updates)`, validates `body.sub_agent_model` against the active provider's `models` list; raises `HTTPException(422, detail=f"Model '...' is not available for provider '...'.")` if invalid

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Import] HTTPException not imported in settings.py**
- **Found during:** Task 3
- **Issue:** `settings.py` imported from `fastapi` as `APIRouter, BackgroundTasks, Depends` but did not include `HTTPException`, which is needed for the 422 validation
- **Fix:** Added `HTTPException` to the fastapi import line
- **Files modified:** `backend/app/api/settings.py`
- **Commit:** 8da8f08

**2. [Rule 1 - Bug] suggestion_service.py imported _SUB_AGENT_MODEL_DEFAULTS from sub_agent_service**
- **Found during:** Task 2 (pre-existing, surfaced when moving dict)
- **Issue:** `suggestion_service.py` imported `_SUB_AGENT_MODEL_DEFAULTS` from `sub_agent_service`, creating an implicit cross-service dependency; after move to config.py this needed updating
- **Fix:** Changed import to `from app.config import settings, _SUB_AGENT_MODEL_DEFAULTS`
- **Files modified:** `backend/app/services/suggestion_service.py`
- **Commit:** cb75498

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: input-validation | backend/app/api/settings.py | New HTTPException 422 validation for sub_agent_model — correctly placed before save_override(); validated against dynamic provider model list |

No new network endpoints introduced. The PATCH validation is additive (blocks invalid input). All threat mitigations from the plan's threat register were applied: T-052-01 (PATCH validation), T-052-02 (sentinel startswith check with JSON parse error catch), T-052-04 (fallback == original_model guard prevents retry loop).

## Known Stubs

None — all data flows are wired. `resolved_sub_agent_model` is populated from live settings on each GET request. The frontend consumption of this field (labels in SettingsPage.tsx) and the `fallback_model` SSE event handling are addressed in plans 052-02 and 052-03.

## Self-Check: PASSED

- `backend/app/config.py` contains `_SUB_AGENT_MODEL_DEFAULTS` — verified
- `backend/app/services/sub_agent_service.py` imports from config, not local dict — verified
- `backend/app/services/suggestion_service.py` imports from config — verified
- `backend/app/models/user_settings.py` contains `resolve_sub_agent_model` — verified
- `backend/app/api/settings.py` contains `resolved_sub_agent_model` field and validation — verified
- Commits 1d76a1d, cb75498, 8da8f08 exist in git log — verified
- All Python imports succeed without circular dependency errors — verified
- `FullSettingsResponse.model_fields` includes `resolved_sub_agent_model` — verified

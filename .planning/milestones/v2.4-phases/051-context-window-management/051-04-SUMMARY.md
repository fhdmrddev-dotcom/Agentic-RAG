---
plan: 051-04
phase: 051-context-window-management
status: complete
completed: 2026-04-23
executor: inline (orchestrator)
---

# Plan 051-04: Settings Stack for sub_agent_max_output_tokens

## What Was Built

Threaded `sub_agent_max_output_tokens` (and `context_window_max_tokens`) through all six layers of the settings stack, and added a "Context & Sub-Agent" SectionCard with two SliderInput controls to the AI Model settings tab.

## Key Files

### Created
- (none — all modifications to existing files)

### Modified
- `backend/app/models/user_settings.py` — added `context_window_max_tokens: int` and `sub_agent_max_output_tokens: int` to `UserEffectiveSettings`; `load_app_settings()` populates both via `_int()` override helper
- `backend/app/api/settings.py` — added `Field` import; added both fields to `FullSettingsResponse`; added `sub_agent_max_output_tokens: int | None = Field(default=None, ge=4096, le=65536)` to `SettingsUpdate`; updated `_build_response()` and `update_settings()` handler
- `frontend/src/lib/api.ts` — added `context_window_max_tokens: number` and `sub_agent_max_output_tokens: number` to `FullAppSettings`; added optional variants to `SettingsUpdate`
- `frontend/src/pages/SettingsPage.tsx` — added `SliderInput` component; added state vars; updated `hydrate()` and `handleSaveAIModel()`; inserted "Context & Sub-Agent" SectionCard between Active Model and Save button

## Verification

- `python -m pytest backend/tests/unit/test_settings.py` — 3/3 passed
  - `test_sub_agent_output_tokens_field_range` — Field(ge=4096, le=65536) blocks 4095 and 65537 with ValidationError ✓
  - `test_sub_agent_settings_roundtrip` — field present in FullSettingsResponse ✓
  - `test_sub_agent_default_in_config` — default is 8192 ✓
- `npm run build` — no new TypeScript errors from modified files ✓

## Commits

- `3a2f6e6` — feat(051-04): thread sub_agent_max_output_tokens through backend settings stack
- `90e9dea` — feat(051-04): add SliderInput + Context & Sub-Agent SectionCard to settings UI

## Self-Check: PASSED

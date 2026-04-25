---
phase: 48-settings-navigation-polish
plan: "01"
subsystem: backend-settings
tags: [settings, web-search, feedback, backend]
dependency_graph:
  requires: []
  provides:
    - UserEffectiveSettings.web_search_enabled stored bool field
    - POST /api/settings accepts and persists web_search_enabled
    - GET /api/settings returns web_search_enabled from stored value (not key-derived)
    - GET /api/feedback/stats returns positive_count and negative_count
  affects:
    - backend/app/services/openai_service.py (get_tools() gate at line 503 now works correctly via UserEffectiveSettings.web_search_enabled)
tech_stack:
  added: []
  patterns:
    - _bool() loader call pattern for bool fields in UserEffectiveSettings
    - bool | None = None pattern in SettingsUpdate with conditional save block
key_files:
  created: []
  modified:
    - backend/app/models/user_settings.py
    - backend/app/api/settings.py
    - backend/app/api/feedback.py
decisions:
  - web_search_enabled defaults to bool(env_settings.tavily_api_key) so existing users with a key configured see no change in behavior
  - _build_response() now uses s.web_search_enabled (stored) instead of bool(s.tavily_api_key) (derived) — stored preference is authoritative
  - positive_count and negative_count derived from existing local variables; no new DB queries required
metrics:
  duration_minutes: 12
  completed_date: "2026-04-25"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 48 Plan 01: Backend Settings & Feedback API Summary

Backend-only plan: `web_search_enabled` stored bool added to the settings stack from model through API, and `positive_count`/`negative_count` added to the feedback stats response.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add web_search_enabled to UserEffectiveSettings and load_app_settings() | d7ba8d5 | backend/app/models/user_settings.py |
| 2 | Wire web_search_enabled into SettingsUpdate, save handler, GET response + feedback counts | 23590ee | backend/app/api/settings.py, backend/app/api/feedback.py |

## What Was Built

### Task 1 — UserEffectiveSettings model

Added `web_search_enabled: bool` field to `UserEffectiveSettings` class (after `web_search_max_results`, before `sandbox_enabled`). Added `_bool()` loader call in `load_app_settings()` return statement with backward-compatible default `bool(env_settings.tavily_api_key)` — True when a Tavily key is present, False when not. The `_bool()` helper handles string-to-bool coercion from the JSON override file automatically.

No changes to `openai_service.py` — the existing `if settings.web_search_enabled:` gate at line 503 in `get_tools()` now works correctly once `UserEffectiveSettings` has the field.

### Task 2 — Settings API and Feedback API

Three changes in `settings.py`:
1. `web_search_enabled: bool | None = None` added to `SettingsUpdate` request model
2. Conditional save block `if body.web_search_enabled is not None: updates["web_search_enabled"] = body.web_search_enabled` added in `update_settings()` after the `web_search_max_results` block
3. `_build_response()` changed from `web_search_enabled=bool(s.tavily_api_key)` to `web_search_enabled=s.web_search_enabled` — stored user preference is now authoritative

One change in `feedback.py`:
- Return dict in `get_feedback_stats()` extended with `"positive_count": positive_count` and `"negative_count": total_ratings - positive_count`. Both values are derived from variables already in scope at the return site; no new DB queries added.

## Verification Results

1. `grep "web_search_enabled" backend/app/models/user_settings.py` — shows field declaration (line 78) AND `_bool()` loader call (line 260)
2. `grep "web_search_enabled" backend/app/api/settings.py` — shows SettingsUpdate field (line 98), save block (lines 224-225), and `s.web_search_enabled` in GET response (line 143)
3. `grep "positive_count\|negative_count" backend/app/api/feedback.py` — shows both keys in return dict (lines 187-188)
4. AST parse of `UserEffectiveSettings` confirms `web_search_enabled` present after `web_search_max_results` and before `sandbox_enabled`
5. No `bool(s.tavily_api_key)` pattern remains in `settings.py`

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Compliance

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-48-01-01 | Pydantic type validation on SettingsUpdate ensures `bool \| None` — non-bool values rejected | Applied — `web_search_enabled: bool \| None = None` in SettingsUpdate |
| T-48-01-02 | Feedback stats returns only aggregate counts — no PII | Accepted — only counts returned |
| T-48-01-03 | Existing auth middleware protects /api/settings; user_id scoping unchanged | Accepted — no new auth surface |

## Known Stubs

None. All fields wired end-to-end through the backend stack.

## Self-Check: PASSED

- `backend/app/models/user_settings.py` modified and committed (d7ba8d5)
- `backend/app/api/settings.py` modified and committed (23590ee)
- `backend/app/api/feedback.py` modified and committed (23590ee)
- Both commits verified present in git log
- No file deletions in either commit

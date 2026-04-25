---
phase: "052-multi-provider-model-routing"
plan: "03"
subsystem: "backend"
tags: ["model-routing", "sub-agent", "verification", "tests", "MDL-02", "MDL-03"]
dependency_graph:
  requires:
    - "052-01 — _SUB_AGENT_MODEL_DEFAULTS in config.py (canonical location)"
    - "052-01 — generate_suggestions() returns (list[str], dict | None) tuple"
    - "052-01 — generate_thread_title() returns (str, dict | None) tuple"
  provides:
    - "MDL-02 verification: both sub-agent callers confirmed to use _SUB_AGENT_MODEL_DEFAULTS[active_provider]"
    - "MDL-03 verification: threads.py confirmed to not filter messages by model column"
    - "backend/tests/test_mdl_verification.py with 12 passing tests (5 test functions)"
  affects:
    - "backend/app/api/threads.py"
    - "backend/tests/test_mdl_verification.py"
tech_stack:
  added: []
  patterns:
    - "pytest.mark.parametrize for multi-provider model routing assertions"
    - "patch at module-level import site (app.api.threads.get_llm_client) to capture model arg"
    - "Path(__file__).parent for robust file-path resolution in structural tests"
key_files:
  created:
    - "backend/tests/test_mdl_verification.py"
  modified:
    - "backend/app/api/threads.py"
decisions:
  - "Fix threads.py to import _SUB_AGENT_MODEL_DEFAULTS from app.config directly (Plan 01 moved the dict but didn't update the threads.py import)"
  - "Use Path(__file__)-relative path in structural test rather than repo-root-relative string for robustness"
  - "Parametrize over all 5 providers (openai, anthropic, google, openrouter, ollama) for generate_thread_title and 4 for generate_suggestions to maximize coverage"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-25"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
  files_created: 1
---

# Phase 052 Plan 03: MDL-02 and MDL-03 Verification Summary

Confirmed provider-aware model resolution in both sub-agent callers; fixed threads.py import to source `_SUB_AGENT_MODEL_DEFAULTS` directly from `app.config`; wrote 12 passing tests covering all 5 providers for title/suggestion model selection and message-history persistence guarantees.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Inspect and verify MDL-02 — provider-aware model resolution in suggestion_service and generate_thread_title | 7753087 | backend/app/api/threads.py |
| 2 | Write verification tests for MDL-02 and MDL-03 | c8c94dd | backend/tests/test_mdl_verification.py |

## What Was Built

### Task 1: Import Fix and MDL-02 Verification

Inspection confirmed:
- `suggestion_service.py`: uses `_SUB_AGENT_MODEL_DEFAULTS.get(provider, "")` at both the primary resolution path (line 55) and the 404 fallback path (line 75). Import correctly sourced from `app.config`. No action needed.
- `threads.py` (generate_thread_title): uses `_SUB_AGENT_MODEL_DEFAULTS.get(provider, "")` at both the primary path (line 281) and the 404 fallback path (line 302). **However**, the import was still `from app.services.sub_agent_service import run_sub_agent, _SUB_AGENT_MODEL_DEFAULTS` — indirectly coupling threads.py to sub_agent_service rather than importing from the canonical location.

**Fix applied:** Changed `threads.py` to import `_SUB_AGENT_MODEL_DEFAULTS` from `app.config` directly:
```python
# Before:
from app.config import settings
from app.services.sub_agent_service import run_sub_agent, _SUB_AGENT_MODEL_DEFAULTS

# After:
from app.config import settings, _SUB_AGENT_MODEL_DEFAULTS
from app.services.sub_agent_service import run_sub_agent
```

### Task 2: MDL Verification Tests

Created `backend/tests/test_mdl_verification.py` with 5 test functions (12 tests collected via parametrize):

**MDL-02 tests (TestMDL02ProviderAwareModelResolution):**
- `test_generate_thread_title_uses_provider_default` — parametrized over 5 providers; patches `get_llm_client`, captures `model=` kwarg, asserts it matches `_SUB_AGENT_MODEL_DEFAULTS[provider]` or falls through to `llm_model` for empty-default providers
- `test_generate_suggestions_uses_provider_default` — same pattern for 4 providers
- `test_sub_agent_model_defaults_dict_keys_match_known_providers` — asserts `_SUB_AGENT_MODEL_DEFAULTS.keys() == KNOWN_PROVIDERS.keys()`

**MDL-03 tests (TestMDL03MessageHistoryPersistence):**
- `test_no_model_keyed_message_lookup_in_threads_py` — reads threads.py source, asserts no `.eq("model"` filter patterns exist
- `test_user_effective_settings_llm_model_change_does_not_affect_thread_id` — asserts `UserEffectiveSettings` has `llm_model` but no `thread_id` field

All 12 tests pass. No real API calls triggered (all tests patch `get_llm_client`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] threads.py imported _SUB_AGENT_MODEL_DEFAULTS from sub_agent_service instead of config.py**
- **Found during:** Task 1 inspection
- **Issue:** Plan 01 moved `_SUB_AGENT_MODEL_DEFAULTS` to `app.config` and updated `sub_agent_service.py` to import from there, but `threads.py` still imported the dict from `sub_agent_service`. This worked at runtime (Python allows re-import of names) but created an indirect dependency that contradicts Plan 01's design intent of sourcing from the canonical location.
- **Fix:** Updated `threads.py` to import from `app.config` directly; removed the name from the `sub_agent_service` import line.
- **Files modified:** `backend/app/api/threads.py`
- **Commit:** 7753087

## Threat Surface Scan

No new network endpoints introduced. All tests patch `get_llm_client` before calling functions under test — T-052-10 mitigation (no accidental real API calls) confirmed.

## Known Stubs

None.

## Self-Check: PASSED

- `backend/tests/test_mdl_verification.py` exists and contains 5 test functions — verified
- `python -m pytest tests/test_mdl_verification.py -v` exits 0 (12 passed) — verified
- `grep "_SUB_AGENT_MODEL_DEFAULTS.get" threads.py` returns hits at lines 281 and 302 — verified
- `grep "_SUB_AGENT_MODEL_DEFAULTS.get" suggestion_service.py` returns hits at lines 55 and 75 — verified
- No hardcoded model strings in either file (outside dicts/comments) — verified
- Commits 7753087 and c8c94dd exist in git log — verified

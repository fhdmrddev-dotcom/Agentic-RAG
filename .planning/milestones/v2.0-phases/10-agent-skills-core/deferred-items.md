# Deferred Items — Phase 10 Agent Skills Core

## Pre-existing Test Failures

Discovered during 10-03 full test suite run. These failures existed before Plan 10-03 changes (confirmed by git stash verification).

**28 pre-existing failing tests in:**
- `tests/integration/test_folders.py` — `TestCreateFolder::test_create_root_folder` returns 409 instead of 201
- `tests/integration/test_threads.py` — SSE stream tests fail with `AttributeError: 'list' object has no attribute 'get'` in `threads.py:269`
- `tests/unit/test_explorer_agent.py` — All `TestSendMessageAgentModeBranching` tests fail
- `tests/unit/test_module7_tools.py` — `TestGetTools` tests fail
- `tests/unit/test_openai_service.py` — `TestGetEmbeddingClient` tests fail
- `tests/unit/test_retrieval_service.py` — `TestSearchDocuments` tests fail
- `tests/unit/test_sql_service.py` — `TestQueryDocumentsRpcCall` tests fail

**Root cause (threads.py):** `thread_data.data.get("folder_id")` called on list instead of dict — indicates a mock compatibility issue similar to the skills maybe_single() pattern.

**Recommendation:** Dedicate a quick fix task to patch `isinstance(thread_data.data, list)` guard in threads.py (same pattern as skills.py toggle endpoints).

*Logged: 2026-03-31 during 10-03 execution*

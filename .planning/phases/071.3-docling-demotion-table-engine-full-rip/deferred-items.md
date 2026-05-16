# Phase 071.3 — Deferred Items (Out-of-Scope Findings)

Per `<deviation_rules>` SCOPE BOUNDARY: pre-existing test failures unrelated
to the current task are logged here, not fixed in Plan 04. Verified pre-existing
by stashing Plan 04 changes and re-running each test against the Phase 071.3
Plan 03 baseline (commit `9b6fabb` minus Plan 04 changes).

## Pre-existing test failures (NOT introduced by Plan 04)

1. **`tests/integration/test_documents.py::TestUploadDocument::test_upload_with_valid_folder_id_returns_201`**
   - Error: `KeyError: 'user_id'` in folder ownership check.
   - Root cause: mock builder fixture returns `{'id': ..., 'user_id': None}` but
     test sets `'user_id'` to be filtered. Fixture mock contract mismatch.
   - Verified pre-existing 2026-05-16 (failed on stashed working tree before Plan 04 changes).

2. **`tests/integration/test_documents.py::TestReextractDocument::test_reextract_explicit_pymupdf_timeout_does_NOT_fallback`**
   - Error: `NameError: name 'mock_get_extractor' is not defined`.
   - Root cause: test uses `mock_get_extractor.call_count` without defining the
     mock in scope. Pre-existing test authoring bug.

3. **`tests/integration/test_documents.py::TestFullMarkdown::test_ingest_stores_full_markdown`**
   - Pre-existing failure.

4. **`tests/unit/test_extraction_service.py::test_legacy_extractor_pdf_matches_golden`**
   - Error: dict comparison includes `'equations': []` in the actual output but
     not in the golden expected dict.
   - Root cause: Phase 071.2 added `equations` to `ExtractedDocument` but the
     legacy-golden fixture was never updated.

5. **`tests/unit/test_extraction_service.py::test_legacy_extractor_docx_matches_golden`**
   - Same root cause as #4 (golden fixture pre-dates `equations` field).

6. **`tests/integration/test_threads.py::TestGetMessages::test_returns_message_list`**
   **`tests/integration/test_threads.py::TestSendMessage::test_sse_stream_contains_delta_events`**
   **`tests/integration/test_threads.py::TestSendMessage::test_sse_stream_delta_events_are_valid_json`**
   - Error: `AttributeError: <module 'app.api.threads'> does not have the attribute 'create_streaming_chat'`
   - Root cause: tests reference a function `create_streaming_chat` that was
     renamed/removed in the Phase 061+ run-backed streaming refactor; mock
     patch points stale.
   - Verified pre-existing 2026-05-16 via stash baseline.

7. **Pre-existing async/sync test failures (~40 tests across multiple modules)**
   - `tests/unit/test_retrieval_service.py` — 14 failures
     (RuntimeWarning: coroutine `search_documents` was never awaited;
      tests are synchronous but the function is async)
   - `tests/unit/test_sql_service.py` — 10 failures (`query_documents` coroutine
     never awaited)
   - `tests/unit/test_sandbox_service.py::TestHarvestOutputFiles` — 2 failures
   - `tests/unit/test_streaming_reliability.py::TestAsyncioShield` — 1 failure
   - `tests/unit/test_multimodal_query.py` — 4 failures (TypeError)
   - `tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching` — 6 failures
   - `tests/integration/test_059_disconnect.py` — 1 failure
   - `tests/integration/test_061_producer_survives_disconnect.py` — 1 failure
   - `tests/unit/test_061_consumer.py` — 1 ImportError
   - `tests/unit/test_phase56_iteration_start.py` — 1 failure
   - `tests/test_knowledge_health.py::test_never_retrieved_excludes_retrieved_docs` — 1
   - `tests/test_mdl_verification.py::TestMDL02ProviderAwareModelResolution` — 2 failures
   - Verified pre-existing 2026-05-16 via stash baseline (30 failures land
     even without Plan 04 changes on the retrieval/sql/sandbox/streaming
     modules tested in isolation).
   - Plan 04-touched modules (test_aspect_engines_*, test_extract_composable,
     test_extraction_dispatcher, test_documents, test_pymupdf_in_process)
     are clean — no Plan 04-introduced failures.

These belong in a separate hygiene phase (e.g. a "test fixture refresh"
follow-on after Plan 05). Plan 04 leaves them untouched.

## Notes

- Tests scoped to Plan 04 changes pass cleanly:
  - `tests/unit/test_aspect_engines_*.py` (12 passed)
  - `tests/unit/test_extract_composable.py`
  - `tests/integration/test_extraction_dispatcher.py` (6 passed)
- The pre-existing failures listed above also fail on the stashed baseline,
  confirming they pre-date Plan 04.

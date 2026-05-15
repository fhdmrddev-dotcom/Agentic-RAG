# Phase 071.2 Deferred Items

Pre-existing test failures observed during Plan 01 execution but out of Plan 01 scope
(per execute-plan.md SCOPE BOUNDARY rule — only auto-fix issues DIRECTLY caused by the
current task's changes).

## Pre-existing failures in `tests/integration/test_documents.py`

Confirmed pre-existing via `git stash` round-trip on commit `edf13e7` (071.2-01 RED).

### 1. `TestUploadDocument::test_upload_with_valid_folder_id_returns_201`

- **Symptom:** `KeyError: 'user_id'` at `documents.py` folder ownership check.
- **Cause:** Test's `_make_result({"id": FOLDER_ID})` mock for folder validation lacks
  `"user_id"`, which the route reads as part of ownership enforcement.
- **Pre-existing:** Yes — fails before Plan 01 changes are applied. Plan 01 only
  threadpool-wrapped the same call site; it did not change the `.data["user_id"]`
  read.
- **Severity:** Test-data drift; production code is correct.
- **Recommendation:** Update the test fixture to `{"id": FOLDER_ID, "user_id": USER_ID}`
  in a follow-up test-fixup commit. Not a Plan 01 concern.

### 2. `TestFullMarkdown::test_ingest_stores_full_markdown`

- **Symptom:** `StopIteration` inside `ingest_document` at the
  `update({"ingestion_step": "embedding"})` call site.
- **Cause:** Test supplies 3 `execute.side_effect` entries but `ingest_document` now
  emits 6+ `ingestion_step` UPDATEs (Phase 056 D-10/D-11 granular badge writes plus
  Phase 071 D-071-08 telemetry). The test was authored against a pre-056 shape.
- **Pre-existing:** Yes — fails before Plan 01 changes are applied. Plan 01 did not
  touch `ingest_document`.
- **Severity:** Stale test mock; production code is correct.
- **Recommendation:** Re-author the mock side_effect queue to include every step the
  current `ingest_document` writes, or refactor to assert against an aggregated
  `mock_builder.update.call_args_list` (current strategy at lines 698-702 of the test
  is partially correct — just under-supplies side_effects). Not a Plan 01 concern.

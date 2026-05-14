# Phase 071 — Deferred Items

Out-of-scope discoveries surfaced during Phase 071 execution. Each entry is a pre-existing failure verified by `git stash` round-trip (failure reproduces on baseline without the current plan's changes).

## Pre-existing test_documents.py failures (verified 2026-05-14, Plan 04 Task 2)

Two test cases in `backend/tests/integration/test_documents.py` were already failing on the Plan 03 baseline (`8ae4fa3`) before Plan 04 touched the file. Confirmed via `git stash` round-trip — both failures reproduce when the Plan 04 Tasks 1+2 diff is stashed away. Outside Plan 04's auto-fix scope per the SCOPE BOUNDARY rule (these test failures are not caused by Plan 04's changes; they are stale mock fixtures from earlier phases).

### D-071-04-DEFER-1: `TestUploadDocument::test_upload_with_valid_folder_id_returns_201`

- **Status:** Pre-existing failure on Plan 03 baseline
- **Symptom:** `KeyError: 'user_id'` at `app/api/documents.py:191` (post-Task-1; was `:178` pre-Task-1) — the folder-ownership check reads `folder_check.data["user_id"]` but the test mock returns `{"id": FOLDER_ID}` with no `user_id` key.
- **Root cause:** The folder-ownership check at `documents.py` was tightened in an earlier phase (likely Phase 047 / DOC-04..06 era based on git history) but the test mock at `tests/integration/test_documents.py:258` was never updated to include `user_id` in the folder validation `_make_result`.
- **Fix:** One-line test mock change — `_make_result({"id": FOLDER_ID})` → `_make_result({"id": FOLDER_ID, "user_id": USER_ID})`.
- **Out-of-scope for Plan 04 because:** The failure is in a test that exercises the upload flow (TestUploadDocument), not the `/reextract` flow Plan 04 introduces. Plan 04's `TestReextractDocument` is 4/4 GREEN.
- **Re-open trigger:** Any phase that adds a new upload-folder integration test, or a backend test-debt phase analogous to Phase 065.

### D-071-04-DEFER-2: `TestFullMarkdown::test_ingest_stores_full_markdown`

- **Status:** Pre-existing failure on Plan 03 baseline
- **Symptom:** `StopIteration` at `app/api/documents.py:842` (the `supabase.table("documents").update({"ingestion_step": "embedding"})` call) — `mock_builder.execute.side_effect` runs out of entries.
- **Root cause:** The test mocks only 3 execute calls (status→processing, insert chunks, status→completed) but Phase 056 added intermediate `ingestion_step` UPDATEs (extracting / chunking / embedding / extracting_tables / extracting_images / metadata) and Plan 02 added `pdf_extraction_runs` INSERT. The test was never refreshed when those phases shipped.
- **Fix:** Add ~7 more `_make_result([])` entries to the `side_effect` list to cover the new UPDATE calls, OR rewrite the test to use `mock_builder.execute.return_value` (no side_effect chain).
- **Out-of-scope for Plan 04 because:** The test exercises `ingest_document` internals (Phase 056 / Phase 071 Plan 02 territory), not the `/reextract` route Plan 04 introduces.
- **Re-open trigger:** Phase 072 (RAG-MM-LIFT-01/02) refactors `ingest_document` and will need to refresh this test mock anyway, or a backend test-debt phase analogous to Phase 065.

## Verification

```bash
# Both failures reproduce on baseline (without Plan 04 diff):
cd backend
git stash push app/api/documents.py tests/integration/test_documents.py
./venv/Scripts/python -m pytest \
  tests/integration/test_documents.py::TestUploadDocument::test_upload_with_valid_folder_id_returns_201 \
  tests/integration/test_documents.py::TestFullMarkdown::test_ingest_stores_full_markdown \
  --tb=line
# → 2 FAILED on baseline
git stash pop
```

Plan 04 Task 2 acceptance criteria (TestReextractDocument 4/4 GREEN) is independent of these pre-existing failures.

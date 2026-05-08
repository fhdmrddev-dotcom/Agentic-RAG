# Phase 067.4 deferred items

These items were observed during plan execution but are out of scope per the
SCOPE BOUNDARY rule (only auto-fix issues DIRECTLY caused by the current
plan's changes).

## Pre-existing unit-test failures observed during Plan 01

Confirmed pre-existing by running `pytest tests/unit/` against the master
baseline (Plan 01 changes stashed) — 41 failures present before any Plan 01
edit lands. Plan 01 introduces ZERO regressions; these are queued for a
follow-up cleanup phase.

| File | Surface | Failure type | Notes |
|------|---------|--------------|-------|
| `tests/unit/test_061_consumer.py` | imports `event_consumer` from `app.api.threads` | `ImportError` | `event_consumer` was deleted in Phase 063 hard cutover (commit 97786ad). Test never updated. |
| `tests/unit/test_sql_service.py` | mocks `query_user_documents` RPC | 13 assertion failures | RPC mock contract drift; predates v2.5. |
| `tests/unit/test_sandbox_service.py::TestHarvestOutputFiles::test_harvest_files_storage_path_format` | sandbox storage path | 1 failure | Format mismatch; predates v2.5. |
| `tests/unit/test_streaming_reliability.py::TestAsyncioShield::test_persist_assistant_message_is_sync` | `_persist_assistant_message` interface | 1 failure | Phase 061 changed the function to async; test never updated. |
| (other) | mixed | ~25 more | Inspect `pytest tests/unit/ --no-header -q` for full list. |

**Reproduction:**

```bash
cd backend && venv/Scripts/python -m pytest tests/unit/ --no-header -q --ignore=tests/unit/test_061_consumer.py
# Reports ~41 failures, all unrelated to Plan 01's surfaces
# (suggestion_service.py, threads.py emit block).
```

**Plan 01 surfaces are clean** (12/12 GREEN):

```bash
cd backend && venv/Scripts/python -m pytest \
    tests/unit/test_suggestions.py \
    tests/unit/test_threads_suggestions_threadpool.py \
    tests/integration/test_067_4_suggestion_emit.py \
    --no-header
# 12 passed
```

## Future phase recommendation

Once R-3, R-4, R-5 are all closed, queue a "Test-Suite Hygiene" side-phase
to walk through the 41 failures and either fix the test (if the production
code is correct) or fix the production code (if the test caught a real
regression). The `event_consumer` ImportError in particular is a 30-second
fix (delete the stale test file or update its imports).

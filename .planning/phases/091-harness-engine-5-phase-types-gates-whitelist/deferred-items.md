# Deferred items — Phase 091

Out-of-scope discoveries logged during execution (NOT fixed — they predate this
phase and are unrelated to the harness surface). Per the GSD SCOPE BOUNDARY rule:
only auto-fix issues DIRECTLY caused by the current task's changes.

## Pre-existing test failures (unrelated to Phase 091 harness)

Discovered during Plan 07 full-suite run (`pytest tests/ -q`). Verified
pre-existing by stashing the Plan 07 changes (conftest `four_seed_defs` +
`test_harness_templates.py`) and re-running the clusters — they fail IDENTICALLY
on the clean baseline. Root causes are stale tests that were never updated when
their services went async / changed signatures (e.g. `coroutine 'query_documents'
was never awaited`). None touch the harness.

| Cluster | Failing tests | Symptom |
|---------|---------------|---------|
| `tests/unit/test_sql_service.py` | TestQueryDocuments* (≈12) | `query_documents` is async; tests call it without `await` → "DID NOT RAISE" / "coroutine never awaited" |
| `tests/unit/test_sandbox_service.py` | TestHarvestOutputFiles (3) | harvest signature/mock drift |
| `tests/unit/test_retrieval_service.py` | TestSearchDocuments* / TestEnrich* (≈12) | search/enrich signature drift |
| `tests/unit/test_streaming_reliability.py` | test_persist_assistant_message_is_sync (1) | async/sync drift |
| `tests/integration/test_077_cross_cancel.py` | test_cross_worker_cancel_via_zombie_heal | ERROR (integration env / Redis) |
| (misc) | remaining of the 107 | same stale-test family |

Total: 107 failed, 970 passed, 6 skipped, 3 xfailed, 1 error on baseline+Plan07 —
the SAME failures present before Plan 07. The 101 harness tests
(test_harness_*.py + test_tool_budget.py + test_085_task_service.py) are 100%
green.

**Disposition:** defer to a dedicated test-hygiene pass (these stale unit tests
should be updated to the current async service signatures). Not a Phase 091
regression; do NOT block the harness milestone on them.

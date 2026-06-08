# Phase 090 — Deferred / Out-of-Scope Discoveries

Logged during execution per the executor scope boundary. These are pre-existing
failures in files NOT touched by phase 090 — they are NOT fixed here.

## Pre-existing full-suite failures (unrelated to 090-01)

**Discovered during:** Plan 090-01 full-suite sampling (`pytest -q` after the new
additive files were committed).

**Observation:** Full backend suite reports `98 failed, 882 passed, 14 skipped,
3 xfailed, 2 errors`. The new phase-090 files (`backend/app/models/harness.py`,
`backend/tests/unit/test_harness_models.py`) are purely additive and import-clean
— `test_harness_models.py` passes 8/8 and collection succeeds across the suite
(no import breakage). If `harness.py` had broken imports, collection would fail
suite-wide, not yield 882 passes.

**Representative root cause (sampled):**
`tests/unit/test_sql_service.py::TestQueryDocumentsValidation::test_rejects_update_query`
fails with `DID NOT RAISE ValueError` + `RuntimeWarning: coroutine
'query_documents' was never awaited`. The production `query_documents` is now an
async coroutine; the test calls it without `await`, so the validation branch
never runs. This is stale-test-vs-async-code drift in `app/services/sql_service`
(or its callers) — a module phase 090 does not touch.

**Disposition:** OUT OF SCOPE for 090-01. Not fixed (would violate the executor
scope boundary — only fix issues directly caused by the current task's changes).
Surface to the orchestrator / a future test-maintenance pass. The pre-existing
red baseline is independent of phase 090.

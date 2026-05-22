# Phase 075.3 — Deferred Items

Items discovered during Plan 01 execution that are OUT OF SCOPE for this plan.
Logged per GSD executor SCOPE BOUNDARY rule.

## Pre-existing backend unit-test failures (NOT caused by Plan 01 changes)

Total: 44 failed (382 passed) on full `backend/tests/unit` suite as of HEAD = `86616f8`
(Plan 01 Task 2 scaffold; Task 3 helper not yet committed). Same 44 failures
reproduce with Task 3 changes applied — i.e., **Plan 01 introduces zero regressions**.

Empirical verification (stash → re-run):
- Without my changes: 29 + 15 = 44 failures across 9 files.
- With my changes: 44 failures across same 9 files.

Files affected (none touched by Plan 01):

| File | Failures | Likely root cause (cursory inspection — NOT triaged here) |
|------|----------|------------------------------------------------------------|
| `tests/unit/test_phase56_iteration_start.py` | 1 | Looks for literal `'type': 'iteration_start'` string that no longer appears in `threads.py` — likely from a Phase 075 refactor that renamed/restructured the SSE emit. |
| `tests/unit/test_retrieval_service.py` | 14 | Class-fixture mismatch — tests appear to mock an older retrieval signature. |
| `tests/unit/test_sql_service.py` | 11 | Likely tied to an older `query_documents` shape. |
| `tests/unit/test_streaming_reliability.py` | 1 | Looking for sync `persist_assistant_message` that's now async. |
| `tests/unit/test_061_consumer.py` | 1 | ImportError on something. |
| `tests/unit/test_071_1_threadpool_sweep.py` | 1 | Source-grep test against a `extract_composable_*` helper. |
| `tests/unit/test_explorer_agent.py` | 6 | Send-message branching — likely tied to an older `send_message` shape. |
| `tests/unit/test_extraction_service.py` | 2 | Legacy extractor golden mismatch — known SEED tail. |
| `tests/unit/test_multimodal_query.py` | 7 | `RuntimeWarning: coroutine 'handle_query_tables' was never awaited` — async handler not awaited in tests. |

**Decision:** Do NOT fix in Plan 01 — these are orthogonal stale-test failures
from prior phases. Should be triaged in a dedicated "test-suite-hygiene" mini
phase, or rolled into the next phase that touches the affected service.

**Action item:** Flag to user during SUMMARY.md compose step. Do NOT block
Plan 01 completion on this — Plan 01's own 7-test suite is GREEN.

# Phase 132 — Deferred / Out-of-Scope Items

## Pre-existing backend test rot (NOT introduced by Plan 02)

The full backend suite (`venv/Scripts/python -m pytest tests/ -q`) reports **124 failed, 1970 passed, 7 skipped, 5 xfailed, 9 xpassed** as of Plan 02 execution (2026-06-30). These failures are pre-existing rot in subsystems **unrelated** to the Plan 02 net-new router:

- `tests/integration/test_threads_skills.py` — `AssertionError: Expected exactly 22 tools in base; got 24` (agent-loop tool registry). Driven by the **pre-existing working-tree modifications** to `backend/app/api/threads.py` + `backend/app/models/thread.py` (present at session start, NOT touched by Plan 02), which add two tools beyond the test's hardcoded `22` expectation.
- `tests/unit/test_sql_service.py` — `query_documents` coroutine-never-awaited / RPC-mock failures.
- `tests/unit/test_sandbox_service.py::TestHarvestOutputFiles` — storage-path / empty-output expectations.
- `tests/unit/test_retrieval_service.py` — document chunk `version_number` enrichment (document versioning, NOT skill versioning).
- `tests/unit/test_streaming_reliability.py` — `_persist_assistant_message` sync assertion.
- `tests/integration/test_077_cross_cancel.py` — zombie-heal collection error.

**Rationale for deferral (SCOPE BOUNDARY rule):** Plan 02 is purely additive — one new module (`backend/app/api/skill_test_cases.py`) + two registration lines in `main.py`. The app boots cleanly (1970 tests pass, including all Plan 02 + adjacent skill-router tests), and none of the 124 failures reference `skill_test_cases` or `skill_versions`. These are tracked under the project's existing rot ledger (`075.4-TEST-TRIAGE.md` ~98 backend failures, SEED-056 frontend rot) and the in-flight working-tree edits to `threads.py`. They are NOT Plan 02 regressions and are out of this plan's scope to fix.

**Plan 02 evidence of green where it counts:**
`pytest tests/integration/test_132_test_cases.py tests/integration/test_skill_tuner_routes.py tests/integration/test_132_skill_versions.py -q` → **51 passed**.

"""asyncpg-backed DB helpers (Phase 073 — D-073-05).

The ``app.db`` namespace owns typed SQL helpers that replace the SC-named
aexec() call sites in ``backend/app/api/threads.py``. All cold-path call
sites (kb.py, runs.py, sandbox_outputs.py, test_fixtures.py, threads.py
non-hot calls) STAY on aexec per D-073-04 — this package is additive.
"""

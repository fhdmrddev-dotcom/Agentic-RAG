---
phase: 073-asyncpg-pool-integration
plan: 01
subsystem: database
tags: [asyncpg, connection-pool, singleton, fastapi, postgres, lifespan, jsonb-codec, pytest-asyncio]

# Dependency graph
requires:
  - phase: 061-run-backed-streaming
    provides: "get_redis() singleton + lifespan close pattern (mirrored verbatim by get_pg_pool())"
  - phase: 062-stream-replay
    provides: "_reset_redis_singleton per-file autouse fixture pattern (promoted suite-wide for asyncpg)"
provides:
  - "asyncpg.Pool singleton at app.dependencies._pg_pool"
  - "async def get_pg_pool() — lazy-init, returns same instance across calls"
  - "JSONB codec registration via init=_init_pg_connection callback at pool creation"
  - "FastAPI lifespan close of _pg_pool BEFORE Supabase, with 5s wait_for + terminate fallback"
  - "_reset_pg_pool_singleton autouse fixture (suite-wide via tests/conftest.py)"
  - "_build_mock_pg_pool() factory for unit tests against asyncpg pool surface"
  - "POSTGRES_DSN / POSTGRES_POOL_MIN / POSTGRES_POOL_MAX env vars + Settings fields"
affects:
  - 073-02-typed-sql-helpers  # imports get_pg_pool() + _build_mock_pg_pool
  - 073-03-token-accumulator   # imports get_pg_pool() for finalize_run wiring
  - 073-04-hot-path-flips      # imports get_pg_pool() + insert_run/finalize_run/insert_assistant_message
  - 078-cq-supa-01             # will extend test_lifespan.py with test_supabase_aclose_no_runtime_warning
  - 079-multi-worker           # POSTGRES_POOL_MAX=10 default sized with --workers 2 headroom

# Tech tracking
tech-stack:
  added:
    - "asyncpg>=0.29 (installed 0.31.0 in backend/venv)"
  patterns:
    - "Singleton + lazy init + lifespan close (third instance: Supabase, Redis, now asyncpg)"
    - "Pool init callback for per-Connection type-codec registration (asyncpg-native pattern)"
    - "Suite-wide autouse fixture for event-loop-bound async-resource singletons"
    - "AsyncMock-based pool factory (sibling of supabase-py MagicMock factory)"

key-files:
  created:
    - "backend/tests/unit/test_pg_pool_singleton.py"
    - "backend/tests/unit/test_lifespan.py"
  modified:
    - "backend/requirements.txt"
    - "backend/.env.example"
    - "backend/app/config.py"
    - "backend/app/dependencies.py"
    - "backend/app/main.py"
    - "backend/tests/conftest.py"
    - "backend/tests/integration/_run_helpers.py"

key-decisions:
  - "JSONB codec registers via init=_init_pg_connection callback at pool creation, NOT pool.set_type_codec (asyncpg has no such pool-level method — Pitfall 5 from RESEARCH.md)"
  - "Pool close in lifespan wrapped in asyncio.wait_for(timeout=5.0) with fallback to pool.terminate() — defense against stuck-query shutdown wedge (Pitfall 4)"
  - "_reset_pg_pool_singleton promoted suite-wide via top-level tests/conftest.py (vs Phase 062's per-file pattern) — asyncpg will be touched by more test files; uses @pytest_asyncio.fixture (not @pytest.fixture) so teardown can await pool.close()"
  - "command_timeout=30 on the pool (prevents stuck queries from holding connections forever — T-073-05 mitigation)"
  - "Pool config uses settings.postgres_pool_min/max (env-tunable) — default 2/10 leaves headroom for Phase 079 --workers 2 at effective ceiling 20 connections (well under Supabase defaults)"

patterns-established:
  - "asyncpg singleton: module-level cache + async def + lazy init at first await (mirrors get_redis() exactly, third instance of the singleton+lazy-init pattern)"
  - "JSONB codec init pattern: per-Connection registration via init= callback enables plain-dict call sites for tool_calls / source_refs / confidence_* / runs.error columns downstream"
  - "Suite-wide event-loop-bound singleton reset fixture: @pytest_asyncio.fixture(autouse=True) at top-level conftest.py; awaits resource cleanup in teardown"
  - "AsyncMock pool factory: returns MagicMock with .execute / .fetchval / .fetchrow patched as AsyncMock — call sites inspect call_args directly (no per-SQL-string routing unlike supabase-py's per-table builder)"

requirements-completed: [WORKER-LIFT-02]

# Metrics
duration: 5min
completed: 2026-05-17
---

# Phase 073 Plan 01: asyncpg Pool Integration Foundation Summary

**asyncpg.Pool singleton with JSONB codec init callback + FastAPI lifespan close-before-Supabase ordering + suite-wide event-loop-binding-trap defense — Wave 0 plumbing ready for Plans 02/03/04 to import.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-17T15:15:48Z
- **Completed:** 2026-05-17T15:21:07Z
- **Tasks:** 5 (each committed atomically)
- **Files modified:** 7 (+ 2 created)

## Accomplishments

- asyncpg>=0.29 (0.31.0 actual) installed in backend/venv, declared in requirements.txt
- POSTGRES_DSN / POSTGRES_POOL_MIN / POSTGRES_POOL_MAX env vars in .env.example with local Supabase :54322 defaults
- `app.dependencies._pg_pool` singleton + `async def get_pg_pool()` + `async def _init_pg_connection(conn)` callback — third instance of the singleton+lazy-init pattern (after Supabase + Redis)
- FastAPI lifespan closes `_pg_pool` AFTER Redis aclose and BEFORE sandbox close, with `asyncio.wait_for(timeout=5.0)` + `pool.terminate()` fallback
- Suite-wide `_reset_pg_pool_singleton` autouse fixture in tests/conftest.py (D-073-12 — promotes Phase 062's per-file pattern to suite-wide; mandatory because asyncpg pools are event-loop-bound and pytest-asyncio creates a fresh loop per test)
- `_build_mock_pg_pool()` factory in tests/integration/_run_helpers.py (sibling of `_build_mock_supabase()`)
- 5/5 new unit tests green: 3 in test_pg_pool_singleton.py + 2 in test_lifespan.py

## Task Commits

Each task was committed atomically:

1. **Task 1: Install asyncpg + env vars + Settings fields** — `96c57f2` (feat)
2. **Task 2: _pg_pool singleton + get_pg_pool() + JSONB codec init callback** — `b574ac6` (feat)
3. **Task 3: Lifespan close-before-Supabase with timeout fallback** — `a79d932` (feat)
4. **Task 4: _reset_pg_pool_singleton autouse + _build_mock_pg_pool factory** — `3bb531e` (test)
5. **Task 5: test_pg_pool_singleton.py + test_lifespan.py (5 tests green)** — `30771af` (test)

**Plan metadata commit:** _TBD (final docs commit after SUMMARY.md write)_

## Files Created/Modified

### Created
- `backend/tests/unit/test_pg_pool_singleton.py` — 3 unit tests (singleton identity, lazy-init no-IO-at-import, reset-creates-fresh-pool)
- `backend/tests/unit/test_lifespan.py` — 2 unit tests (pg_pool_closes_before_supabase, close_timeout_falls_back_to_terminate). Phase 078 (CQ-SUPA-01) will extend this file with `test_supabase_aclose_no_runtime_warning`.

### Modified
- `backend/requirements.txt` — added `asyncpg>=0.29` immediately after `redis>=5.2,<6` line
- `backend/.env.example` — added Postgres section (heading + Local/Cloud comments + 3 vars: POSTGRES_DSN, POSTGRES_POOL_MIN, POSTGRES_POOL_MAX) right after Redis section
- `backend/app/config.py` — added `postgres_dsn` / `postgres_pool_min` / `postgres_pool_max` fields to Settings, right after `redis_url`
- `backend/app/dependencies.py` — added `import json` + `import asyncpg`; `_pg_pool: asyncpg.Pool | None = None` module-level cache; `async def _init_pg_connection(conn)` callback registering JSONB codec via `conn.set_type_codec('jsonb', encoder=json.dumps, decoder=json.loads, schema='pg_catalog')`; `async def get_pg_pool() -> asyncpg.Pool` mirroring `get_redis()` shape but `async` because `asyncpg.create_pool` is a coroutine
- `backend/app/main.py` — inserted pg pool close block between existing Redis aclose and sandbox close: `from app.dependencies import _pg_pool; if _pg_pool is not None: asyncio.wait_for(_pg_pool.close(), timeout=5.0); except TimeoutError: logger.warning + _pg_pool.terminate()`
- `backend/tests/conftest.py` — added canonical `import pytest_asyncio` alongside existing `_pytest_asyncio` alias (back-compat); added `@pytest_asyncio.fixture(autouse=True) async def _reset_pg_pool_singleton()` right before `redis_client` fixture
- `backend/tests/integration/_run_helpers.py` — added `AsyncMock` to existing `unittest.mock` import; added `_build_mock_pg_pool()` factory at the bottom of the file (returns `MagicMock` with `.execute` / `.fetchval` / `.fetchrow` patched as `AsyncMock`)

## Public Interface for Plans 02/03/04

```python
# From backend/app/dependencies.py:
import asyncpg

_pg_pool: asyncpg.Pool | None = None   # module-level singleton; None at import

async def _init_pg_connection(conn: asyncpg.Connection) -> None:
    """Register JSONB codec on every newly-created Connection."""
    await conn.set_type_codec(
        'jsonb',
        encoder=json.dumps,
        decoder=json.loads,
        schema='pg_catalog',
    )

async def get_pg_pool() -> asyncpg.Pool:
    """Return the singleton asyncpg pool — lazy init, no I/O at import."""
    ...
```

```python
# From backend/tests/integration/_run_helpers.py:
def _build_mock_pg_pool():
    """Mock asyncpg.Pool for unit tests — .execute/.fetchval/.fetchrow as AsyncMock."""
    ...
```

```python
# From backend/tests/conftest.py:
@pytest_asyncio.fixture(autouse=True)
async def _reset_pg_pool_singleton():
    """Suite-wide reset of app.dependencies._pg_pool between tests."""
    ...
```

**Confirmation:** `app.dependencies._pg_pool is None` at module import time — verified by `test_get_pg_pool_lazy_no_io_at_import` (importlib.reload + mock_create.call_count == 0). No I/O at import.

## Decisions Made

- Used `init=_init_pg_connection` callback (not `pool.set_type_codec`) per Pitfall 5 (RESEARCH.md). D-073-06 wording in CONTEXT.md references `pool.set_type_codec` but the asyncpg API has no such pool-level method; codec must register per Connection via the init callback. Docstring on `_init_pg_connection` explains this explicitly for future maintainers.
- Added a canonical `import pytest_asyncio` to conftest.py alongside the existing `import pytest_asyncio as _pytest_asyncio` alias (rather than renaming the alias suite-wide). Keeps existing fixtures stable; new fixture uses the canonical name to match the plan's acceptance-criterion regex.
- `command_timeout=30` on the pool (research §Pattern 1) — combined with the 5s lifespan close timeout, guarantees shutdown cannot wedge indefinitely on a stuck query.

## Deviations from Plan

**None** — plan executed exactly as written. One minor cosmetic notation: the docstring on `_init_pg_connection` contains the literal string "pool.set_type_codec" inside an explanatory comment about Pitfall 5; the plan's strict acceptance grep `grep -E "pool\.set_type_codec" returns 0` would technically register a hit on this docstring text. Functionally there is NO actual `pool.set_type_codec(...)` call anywhere in the file (verified via `grep -E "^[^#]*pool\.set_type_codec\("` returning zero matches) — the docstring reference exists for documentation value (explains the pitfall to future maintainers). All other acceptance criteria pass cleanly.

## Pitfall-5 Correction Made During Implementation

Per the plan's `<output>` request, I confirm: the codec registration uses `init=_init_pg_connection` callback at `asyncpg.create_pool(...)` time (the correct asyncpg API). NOT the non-existent `pool.set_type_codec(...)` method (which would `AttributeError` at first call). Inside `_init_pg_connection`, the actual API call is `await conn.set_type_codec('jsonb', encoder=json.dumps, decoder=json.loads, schema='pg_catalog')` — `set_type_codec` is a Connection method, not a Pool method. This matches RESEARCH.md §Pattern 1 + §Common Pitfalls #5 verbatim.

## Test Results

```
$ cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_pg_pool_singleton.py tests/unit/test_lifespan.py -x -q --no-header
.....                                                                    [100%]
============================== warnings summary ===============================
venv\Lib\site-packages\requests\__init__.py:113
  RequestsDependencyWarning: urllib3 (2.6.3) or chardet (7.4.3)/charset_normalizer (3.4.6) doesn't match a supported version!
5 passed, 1 warning in 5.19s
```

Five tests, all green:
- `test_get_pg_pool_returns_singleton` — identity check + `create_pool.call_count == 1`
- `test_get_pg_pool_lazy_no_io_at_import` — `importlib.reload` + `create_pool.call_count == 0`
- `test_get_pg_pool_reset_creates_fresh_pool` — after `_pg_pool = None`, next call creates new pool (`call_count == 2`)
- `test_pg_pool_closes_before_supabase` — `mock_pool.close.await_count >= 1` on lifespan exit
- `test_pg_pool_close_timeout_falls_back_to_terminate` — `mock_pool.terminate.call_count >= 1` when `close()` hangs past 5s timeout

**Existing test suite import sanity:** `pytest tests/integration/test_058_concurrency.py --collect-only -q` → `1 test collected in 0.02s` (no collection error from the new autouse fixture).

## Issues Encountered

None.

## Next Phase Readiness

**Wave 0 unblocker delivered.** Plans 02 / 03 / 04 can now import:

- `from app.dependencies import get_pg_pool` — for actual pool acquisition in production code
- `from app.dependencies import _pg_pool` — for lifespan-style cleanup or mocking via `patch("app.dependencies._pg_pool", ...)`
- `from tests.integration._run_helpers import _build_mock_pg_pool` — for unit tests against the asyncpg pool surface

The suite-wide `_reset_pg_pool_singleton` autouse fixture means downstream plans do NOT need to add per-file reset fixtures — the trap is closed once for the whole suite.

**Coordination note for Phase 078 (CQ-SUPA-01):** `backend/tests/unit/test_lifespan.py` exists with two Phase 073-owned tests. Phase 078 should EXTEND this file (not rewrite) with `test_supabase_aclose_no_runtime_warning` after adding the `_supabase.aclose()` call to the lifespan in main.py. The file's module docstring explicitly notes this coordination.

## Self-Check: PASSED

Verified all created files exist:
- `backend/tests/unit/test_pg_pool_singleton.py` — FOUND
- `backend/tests/unit/test_lifespan.py` — FOUND
- `backend/app/dependencies.py` (modified) — FOUND with `_pg_pool` + `get_pg_pool` + `_init_pg_connection`
- `backend/app/main.py` (modified) — FOUND with `asyncio.wait_for(_pg_pool.close(), timeout=5.0)`
- `backend/tests/conftest.py` (modified) — FOUND with `@pytest_asyncio.fixture(autouse=True) _reset_pg_pool_singleton`
- `backend/tests/integration/_run_helpers.py` (modified) — FOUND with `_build_mock_pg_pool` + `AsyncMock` import
- `backend/requirements.txt` (modified) — FOUND with `asyncpg>=0.29`
- `backend/.env.example` (modified) — FOUND with `POSTGRES_DSN=postgresql://...`
- `backend/app/config.py` (modified) — FOUND with `postgres_dsn:` / `postgres_pool_min:` / `postgres_pool_max:`

Verified all task commits exist in `git log --oneline -6`:
- `96c57f2` — FOUND (Task 1)
- `b574ac6` — FOUND (Task 2)
- `a79d932` — FOUND (Task 3)
- `3bb531e` — FOUND (Task 4)
- `30771af` — FOUND (Task 5)

---
*Phase: 073-asyncpg-pool-integration*
*Plan: 01*
*Completed: 2026-05-17*

"""
Shared pytest fixtures for backend tests.

Environment variables must be set before importing app modules because
pydantic-settings reads them at class instantiation time.
"""
import os

# Patch env before any app import so pydantic-settings doesn't fail
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("LLM_API_KEY", "test-llm-api-key")
os.environ.setdefault("LANGSMITH_TRACING", "false")
os.environ.setdefault("LANGSMITH_PROJECT", "test-project")

from unittest.mock import MagicMock  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


def _make_execute_result():
    """A simple result object with a .data attribute."""
    r = MagicMock()
    r.data = []
    return r


def _make_builder(execute_result):
    """A fluent-chainable Supabase query builder mock."""
    b = MagicMock()
    b.select.return_value = b
    b.insert.return_value = b
    b.update.return_value = b
    b.delete.return_value = b
    b.upsert.return_value = b   # WR-06 (D-061.1-13): user_memory.upsert(...) chain
    b.eq.return_value = b
    b.neq.return_value = b
    b.in_.return_value = b
    b.order.return_value = b
    b.limit.return_value = b
    b.single.return_value = b
    b.maybe_single.return_value = b
    b.is_.return_value = b
    b.or_.return_value = b
    b.gte.return_value = b
    b.lt.return_value = b
    b.range.return_value = b
    b.execute.return_value = execute_result
    b.execute.side_effect = None
    return b


def _make_supabase(builder, execute_result):
    """Top-level Supabase client mock."""
    sb = MagicMock()
    sb.table.return_value = builder
    sb.rpc.return_value = builder

    storage_bucket = MagicMock()
    storage_bucket.upload.return_value = MagicMock()
    storage_bucket.remove.return_value = MagicMock()
    storage_bucket.download.return_value = b"test-file-content"
    sb.storage.from_.return_value = storage_bucket
    return sb


# Module-level singletons shared across tests (reset in autouse fixture)
_execute_result = _make_execute_result()
_builder = _make_builder(_execute_result)
_supabase = _make_supabase(_builder, _execute_result)

mock_user_data = {"id": "00000000-0000-0000-0000-000000000001", "email": "test@example.com"}

# ── Import app AFTER env vars are set ─────────────────────────────────────────

from app.main import app  # noqa: E402
from app.dependencies import get_current_user, get_supabase  # noqa: E402

app.dependency_overrides[get_current_user] = lambda: mock_user_data
app.dependency_overrides[get_supabase] = lambda: _supabase


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def reset_mocks():
    """
    Reset all mocks before each test to prevent state leakage.
    Critically, this clears side_effect so one test's side_effect list
    doesn't cause StopIteration in the next test.
    Also restores dependency_overrides so tests that swap get_supabase
    don't contaminate subsequent tests.
    """
    # Restore canonical dependency overrides (tests may swap get_supabase locally)
    app.dependency_overrides[get_current_user] = lambda: mock_user_data
    app.dependency_overrides[get_supabase] = lambda: _supabase

    # Reset the execute result
    _execute_result.reset_mock()
    _execute_result.data = []

    # Reset the builder: clear call counts, side_effect, and return_value
    _builder.reset_mock()
    _builder.select.return_value = _builder
    _builder.insert.return_value = _builder
    _builder.update.return_value = _builder
    _builder.delete.return_value = _builder
    _builder.upsert.return_value = _builder   # WR-06 (D-061.1-13)
    _builder.eq.return_value = _builder
    _builder.neq.return_value = _builder
    _builder.in_.return_value = _builder
    _builder.order.return_value = _builder
    _builder.limit.return_value = _builder
    _builder.single.return_value = _builder
    _builder.maybe_single.return_value = _builder
    _builder.is_.return_value = _builder
    _builder.or_.return_value = _builder
    _builder.gte.return_value = _builder
    _builder.lt.return_value = _builder
    _builder.range.return_value = _builder
    _builder.execute.side_effect = None
    _builder.execute.return_value = _execute_result

    # Reset top-level supabase mock
    _supabase.reset_mock()
    _supabase.table.return_value = _builder
    _supabase.rpc.return_value = _builder
    _supabase.storage.from_.return_value.download.return_value = b"test-file-content"

    yield

    # Post-test cleanup (optional, belt-and-suspenders)
    _builder.execute.side_effect = None


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def mock_user():
    return mock_user_data


@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer test-token"}


@pytest.fixture
def mock_execute_result():
    """Expose the shared execute result mock for per-test data configuration."""
    return _execute_result


@pytest.fixture
def mock_builder():
    """Expose the shared builder mock for side_effect configuration."""
    return _builder


# ═══════════════════════════════════════════════════════════════════════
# Phase 061 Redis fixtures (D-061-14, D-061-17, Pitfall 6)
# ═══════════════════════════════════════════════════════════════════════
import os as _os  # noqa: E402
import pytest_asyncio  # noqa: E402
import pytest_asyncio as _pytest_asyncio  # noqa: E402  # back-compat alias for existing fixtures

_REDIS_TEST_URL = _os.environ.get("REDIS_URL", "redis://localhost:6379")


@pytest_asyncio.fixture(autouse=True)
async def _reset_pg_pool_singleton():
    """Phase 073 D-073-12 — reset app.dependencies._pg_pool between tests.

    asyncpg pools are event-loop-bound (Pitfall 1). pytest-asyncio creates a
    fresh loop per test (asyncio_mode=auto). A singleton created in test N's
    loop, reused by test N+1, raises RuntimeError("Event loop is closed").

    Mirrors the per-file _reset_redis_singleton fixture in test_062_stream_replay
    (Phase 062 introduced; Phase 074 SEED-011 formalizes suite-wide). Promoted
    to top-level conftest so any test importing get_pg_pool() inherits the reset.

    Must be pytest_asyncio.fixture (NOT pytest.fixture) — teardown awaits
    pool.close().
    """
    import app.dependencies as _deps
    _deps._pg_pool = None
    yield
    if _deps._pg_pool is not None:
        try:
            await _deps._pg_pool.close()
        except Exception:
            pass
        _deps._pg_pool = None


@_pytest_asyncio.fixture
async def redis_client():
    """Function-scoped real Redis client (D-061-14, no fakeredis).

    Function scope is REQUIRED, not session: pytest-asyncio creates a
    fresh event loop per test (asyncio_mode = auto in backend/pytest.ini),
    and a session-scoped async client would bind to the FIRST loop —
    same loop-binding trap that test_059_disconnect.py's
    _reset_sse_starlette_app_status fixture works around for AppStatus
    (RESEARCH.md Pitfall 6). UUID-based test isolation (D-061-17) means
    we don't need to prefix keys; UUID v4 collisions across tests are
    statistically impossible.

    decode_responses=True so XREAD entries arrive as str (test bodies
    do `entry['data']` and json.loads — no manual .decode() needed).
    """
    import redis.asyncio as aioredis
    client = aioredis.from_url(
        _REDIS_TEST_URL,
        encoding="utf-8",
        decode_responses=True,
    )
    try:
        yield client
    finally:
        await client.aclose()


# ═══════════════════════════════════════════════════════════════════════
# Phase 075.4-05 Wave 0 — FK-aware runs factory (consumed by Plan 06 Task 3)
# ═══════════════════════════════════════════════════════════════════════
#
# Plan 075.4-05 Wave 0 — FK-safe factory; pattern from PROJECT.md Phase
# 073-04 Rule-1 deviation. Used by Plan 06 triage to fix the 4
# test_provider_router.py + 2 test_066_langsmith_clean.py FK-violation
# failures (ForeignKeyViolationError runs_thread_id_fkey).
#
# Failure pattern: tests insert a `runs` row without first creating the
# parent `threads` row (and on local Supabase, threads.user_id has a FK to
# auth.users.id — so we must also seed an auth.users entry). The factory
# yields a `make_run(user_id=None, **overrides)` helper that does all three
# inserts in FK-safe order and cleans up in reverse on teardown.
#
# Why pytest_asyncio.fixture: teardown awaits — the factory returns from
# async context (matches the broader async test suite shape).
#
# Supabase client resolution:
#   - if `supabase_real` fixture exists in caller scope, use it
#   - else: create a real client from env (SUPABASE_URL +
#     SUPABASE_SERVICE_ROLE_KEY); skip the test gracefully if neither
#     is available (mock-only test runs shouldn't crash on import).
# This dual-path keeps the factory usable both in real-Postgres binding
# gates (Phase 073 model) and in mock-Supabase unit tests that opt into
# it via a real supabase fixture.

@pytest_asyncio.fixture
async def fk_aware_runs_factory(request):
    """FK-safe runs/threads/auth.users factory.

    Yields ``make_run(user_id=None, **overrides) -> dict`` returning
    ``{run_id, thread_id, user_id}``. Cleanup is FK-safe-reversed:
    runs -> threads -> auth.users.

    Args:
        request: pytest fixture request — used to detect whether the
            caller scope provides a ``supabase_real`` fixture; if not,
            we fall back to creating a real client from env.

    Plan 075.4-05 Wave 0. Consumed by Plan 06 Task 3 for the FK-violation
    cluster. ForeignKey error class: ``runs_thread_id_fkey``.
    """
    import uuid

    # Resolve a real supabase client. We try the caller's fixture first;
    # if that's not declared, build one from env. Tests that don't have
    # service-role access just skip — the FK-violation cluster only matters
    # against a real Postgres anyway.
    supabase = None
    try:
        supabase = request.getfixturevalue("supabase_real")
    except Exception:
        pass

    if supabase is None:
        try:
            from supabase import create_client
        except ImportError:
            pytest.skip("supabase-py not importable — cannot build FK-aware factory")
        url = _os.environ.get("SUPABASE_URL", "")
        key = _os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not url or not key or "test.supabase.co" in url:
            pytest.skip(
                "fk_aware_runs_factory requires real SUPABASE_URL + "
                "SUPABASE_SERVICE_ROLE_KEY (got placeholder/empty)"
            )
        supabase = create_client(url, key)

    created = {"users": [], "threads": [], "runs": []}

    async def make_run(user_id=None, **overrides):
        uid = user_id or str(uuid.uuid4())
        # Seed auth.users best-effort — the row may already exist on local
        # dev DB, in which case the insert raises and we ignore it.
        try:
            supabase.table("auth.users").insert({"id": uid}).execute()
            created["users"].append(uid)
        except Exception:
            pass

        tid = str(uuid.uuid4())
        supabase.table("threads").insert(
            {"id": tid, "user_id": uid, "title": "test"}
        ).execute()
        created["threads"].append(tid)

        rid = overrides.pop("id", str(uuid.uuid4()))
        supabase.table("runs").insert(
            {"id": rid, "user_id": uid, "thread_id": tid, "status": "queued", **overrides}
        ).execute()
        created["runs"].append(rid)
        return {"run_id": rid, "thread_id": tid, "user_id": uid}

    yield make_run

    # FK-safe cleanup: runs -> threads -> auth.users (reverse insert order).
    for rid in created["runs"]:
        try:
            supabase.table("runs").delete().eq("id", rid).execute()
        except Exception:
            pass
    for tid in created["threads"]:
        try:
            supabase.table("threads").delete().eq("id", tid).execute()
        except Exception:
            pass
    for uid in created["users"]:
        try:
            supabase.table("auth.users").delete().eq("id", uid).execute()
        except Exception:
            pass


@pytest.fixture(scope="session", autouse=True)
def _flushdb_at_session_end():
    """FLUSHDB at session end (D-061-14, D-061-17).

    Synchronous Redis client at session teardown — avoids depending on
    an asyncio event loop at session-end time (brittle in pytest-asyncio
    when the last per-test loop has already closed). best-effort: CI
    may not have Redis up at teardown if the docker-compose preamble
    failed; we don't want flush failures to mask the real issue.

    UUID isolation means leftover keys are harmless across tests within
    a single run; this flush is hygiene only — runs:active and
    runs_by_thread:* sorted-set entries accumulate during the session
    and only matter for memory observability.
    """
    yield
    try:
        import redis as _redis_sync
        _client = _redis_sync.from_url(_REDIS_TEST_URL)
        _client.flushdb()
        _client.close()
    except Exception:
        pass   # best-effort hygiene; do not mask real test failures

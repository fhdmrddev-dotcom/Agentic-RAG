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
# Phase 146 (ADMIN-01 / WR-04): neutralize the operator bootstrap seed for the
# unit suite. The `client` fixture runs TestClient(app) as a context manager,
# which executes the full lifespan — including seed_operators_from_env(). Settings
# reads backend/.env and postgres_dsn defaults to the LIVE local Postgres
# (127.0.0.1:54322), so without this guard, on a dev machine with the local stack
# up and OPERATOR_EMAILS populated in .env, every TestClient startup would INSERT
# real role-granting operator_users rows as a side effect of running unit tests.
# A real env var takes precedence over .env in pydantic-settings, so the seed
# short-circuits at the empty-list check with zero pool activity (exactly what
# test_seed_noop_when_no_emails pins).
os.environ.setdefault("OPERATOR_EMAILS", "")

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

    # Phase 146 (ADMIN-01): clear any leaked require_operator override so the
    # operator-present branch of one test never contaminates the next. Guarded —
    # require_operator lands in Plan 02; before then the import is absent (RED).
    try:
        from app.dependencies import require_operator as _require_operator
        app.dependency_overrides.pop(_require_operator, None)
    except Exception:
        pass

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


@pytest.fixture
def operator_override():
    """Phase 146 (ADMIN-01) — force the operator-present branch of the /admin gate.

    Overrides ``require_operator`` -> a fake operator identity so a test reaches a
    gated endpoint without a live ``operator_users`` row. Yields the identity; pops
    the override on teardown so it never contaminates a later test (belt-and-braces
    with the guarded pop in ``reset_mocks``).

    NOTE: overriding ``require_operator`` bypasses ``request.state.operator = ...``, so
    the audit floor teardown sees no operator and writes nothing. To exercise the
    real gate + floor write path, drive the operator branch via the asyncpg pool mock
    (``set_fetchrow_result({...})``) instead of this override.
    """
    from app.dependencies import require_operator

    identity = {"id": "op-1", "email": "op@x.co"}
    app.dependency_overrides[require_operator] = lambda: identity
    try:
        yield identity
    finally:
        app.dependency_overrides.pop(require_operator, None)


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


# ═══════════════════════════════════════════════════════════════════════
# Phase 091 Wave-0 harness fixtures (Plan 01 Task 2)
# ═══════════════════════════════════════════════════════════════════════
#
# These five fixtures are the shared substrate every test_harness_*.py file
# (and test_tool_budget.py) consumes. They are PURE-PYTHON — no live Redis or
# Postgres — so the deterministic proofs (2-phase write UPDATE order, ask_user
# subscribe-before-emit, whitelist refusal) run offline and fast.
#
# Owning plans flip their own contracts live:
#   mock_asyncpg_pool  -> Plan 02/04 (2-phase write order, crash-leaves-active)
#   fake_redis         -> Plan 02 (_emit XADD) + Plan 04 (ask_user pub/sub)
#   make_tool_context  -> Plan 06 (whitelist guard; phase_whitelist kwarg)
#   make_run_context   -> Plan 02 (engine run-identity bag)
#   build_workflow_definition / four_seed_defs -> Plan 02/03/07

from types import SimpleNamespace  # noqa: E402


class _RecordingConnection:
    """asyncpg connection stand-in that records every SQL call in order.

    Every ``execute``/``fetchrow``/``fetch`` appends ``(sql, args)`` to the
    public ``.calls`` list on the owning pool, IN ORDER. This is the
    UPDATE-ORDER RECORDER the 2-phase-write proof needs: assert the
    ``status='active'`` UPDATE index < the ``status='completed'`` UPDATE index.
    """

    def __init__(self, pool: "_MockAsyncpgPool"):
        self._pool = pool

    def transaction(self):
        """No-op async-context transaction (Phase 092 — create_workflow_run uses
        ``async with con.transaction():`` to wrap its 3-write atomic INSERT/UPDATE).

        Records ``transaction_enter`` / ``transaction_exit`` markers on the owning
        pool's ``.calls`` so a test can assert the run/phase/anchor writes all land
        INSIDE one transaction span if it wants to.
        """
        return _TransactionCtx(self._pool)

    async def execute(self, sql, *args):
        self._pool.calls.append((sql, args))
        return self._pool._execute_result

    async def fetchrow(self, sql, *args):
        self._pool.calls.append((sql, args))
        # Phase 092: a queued sequence takes precedence so a test can return
        # DIFFERENT rows for successive fetchrow calls (e.g. the GET reconcile's
        # workflow_runs join then the latest cap_paused `runs` row). Falls back to
        # the single sticky value when the queue is empty/unset.
        if self._pool._fetchrow_results:
            return self._pool._fetchrow_results.pop(0)
        return self._pool._fetchrow_result

    async def fetch(self, sql, *args):
        self._pool.calls.append((sql, args))
        # Phase 096: a queued sequence takes precedence so a test can return
        # DIFFERENT row sets for successive fetch calls (e.g. load_run_phases
        # then the terminal-site ask_user pending-prompt SELECT). Falls back to
        # the single sticky value when the queue is empty/unset.
        if self._pool._fetch_results:
            return self._pool._fetch_results.pop(0)
        return self._pool._fetch_result

    async def fetchval(self, sql, *args):
        self._pool.calls.append((sql, args))
        return self._pool._fetchval_result


class _TransactionCtx:
    """No-op async-context-manager returned by ``con.transaction()``.

    Phase 092 — ``create_workflow_run`` wraps its INSERT workflow_runs + INSERT
    workflow_phases + UPDATE threads in one transaction. The mock connection
    records the writes on ``pool.calls`` regardless of transaction state, so this
    CM just appends span markers (``transaction_enter``/``transaction_exit``) and
    otherwise no-ops.
    """

    def __init__(self, pool: "_MockAsyncpgPool"):
        self._pool = pool

    async def __aenter__(self):
        self._pool.calls.append(("transaction_enter", ()))
        return self

    async def __aexit__(self, *exc):
        self._pool.calls.append(("transaction_exit", ()))
        return False


class _AcquireCtx:
    """Async-context-manager returned by ``pool.acquire()``."""

    def __init__(self, conn):
        self._conn = conn

    async def __aenter__(self):
        return self._conn

    async def __aexit__(self, *exc):
        return False


class _MockAsyncpgPool:
    """Minimal asyncpg pool whose ``.acquire()`` yields a recording connection.

    Public surface:
      - ``.calls``  -> ordered list of ``(sql, args)`` tuples across all calls
      - ``.set_fetchrow_result(v)`` / ``.set_fetch_result(v)`` /
        ``.set_fetchval_result(v)`` -> per-test return-value injection
      - ``execute`` returns ``"UPDATE 1"`` by default
    """

    def __init__(self):
        self.calls: list[tuple] = []
        self._execute_result = "UPDATE 1"
        self._fetchrow_result = None
        self._fetchrow_results: list = []  # Phase 092 — per-call fetchrow queue
        self._fetch_result = []
        self._fetch_results: list = []  # Phase 096 — per-call fetch queue
        self._fetchval_result = None
        self._conn = _RecordingConnection(self)

    def acquire(self):
        return _AcquireCtx(self._conn)

    # Some call sites use the pool's convenience methods directly (pool.execute
    # delegates to a transiently-acquired connection in asyncpg). Mirror that.
    async def execute(self, sql, *args):
        return await self._conn.execute(sql, *args)

    async def fetchrow(self, sql, *args):
        return await self._conn.fetchrow(sql, *args)

    async def fetch(self, sql, *args):
        return await self._conn.fetch(sql, *args)

    async def fetchval(self, sql, *args):
        return await self._conn.fetchval(sql, *args)

    def set_execute_result(self, v):
        self._execute_result = v

    def set_fetchrow_result(self, v):
        self._fetchrow_result = v

    def set_fetchrow_results(self, seq):
        """Queue per-call fetchrow return values (Phase 092 — successive joins)."""
        self._fetchrow_results = list(seq)

    def set_fetch_result(self, v):
        self._fetch_result = v

    def set_fetch_results(self, seq):
        """Queue per-call fetch return values (Phase 096 — successive SELECTs)."""
        self._fetch_results = list(seq)

    def set_fetchval_result(self, v):
        self._fetchval_result = v


@pytest.fixture
def mock_asyncpg_pool():
    """UPDATE-order recorder (HARNESS-03 2-phase-write proof).

    Yields a pool whose ``.calls`` lists every ``(sql, args)`` in execution
    order. Per-test return values via ``set_fetchrow_result`` / ``set_fetch_result``.
    """
    return _MockAsyncpgPool()


class _FakePubSub:
    """Awaitable pub/sub stand-in for the ask_user resume flow (Plan 04).

    Records ``subscribe``/``unsubscribe``/``close`` channel calls on the owning
    fake-redis lists so the subscribe-before-emit ordering can be asserted, and
    drains a test-settable inbound queue via ``get_message``.
    """

    def __init__(self, fr: "_FakeRedis"):
        self._fr = fr
        self._queue: list = []

    async def subscribe(self, *channels):
        self._fr.subscribes.append(("subscribe", channels))
        self._fr.events.append(("subscribe", channels))

    async def unsubscribe(self, *channels):
        self._fr.unsubscribes.append(("unsubscribe", channels))
        self._fr.events.append(("unsubscribe", channels))

    async def get_message(self, ignore_subscribe_messages=True, timeout=None):
        if self._queue:
            return self._queue.pop(0)
        return None

    async def close(self):
        self._fr.events.append(("pubsub_close", None))

    # alias used by some redis-py versions
    aclose = close

    def _push(self, message):
        self._queue.append(message)


class _FakeRedis:
    """Fake Redis recording XADD / sadd / expire / publish + pub/sub.

    Drives BOTH the workflow ``_emit`` (XADD to ``run:{run_id}``) and the
    ask_user subscribe -> sadd -> emit -> block flow (Plan 04). Everything is
    recorded on public lists in call order for deterministic assertions.

    Public surface:
      - ``.xadds``  -> list of ``(stream, decoded_fields_dict)``
      - ``.sadds`` / ``.expires`` / ``.publishes`` -> recorded calls
      - ``.events`` -> unified ordered log (xadd / subscribe / publish / ...) so
        tests can assert subscribe happens BEFORE the re-emit XADD (Pitfall 2)
      - ``.push_message(msg)`` -> enqueue an inbound pub/sub message
    """

    def __init__(self):
        self.xadds: list = []
        self.sadds: list = []
        self.expires: list = []
        self.publishes: list = []
        self.subscribes: list = []
        self.unsubscribes: list = []
        self.events: list = []
        self._pubsub = _FakePubSub(self)

    @staticmethod
    def _decode_fields(fields):
        out = {}
        for k, v in (fields or {}).items():
            key = k.decode() if isinstance(k, (bytes, bytearray)) else k
            val = v.decode() if isinstance(v, (bytes, bytearray)) else v
            out[key] = val
        return out

    async def xadd(self, stream, fields, *args, **kwargs):
        decoded = self._decode_fields(fields)
        self.xadds.append((stream, decoded))
        self.events.append(("xadd", stream, decoded))
        return f"{len(self.xadds)}-0"

    async def sadd(self, key, *members):
        self.sadds.append((key, members))
        self.events.append(("sadd", key, members))
        return len(members)

    async def expire(self, key, seconds, *args, **kwargs):
        self.expires.append((key, seconds))
        self.events.append(("expire", key, seconds))
        return True

    async def publish(self, channel, message):
        self.publishes.append((channel, message))
        self.events.append(("publish", channel, message))
        return 1

    def pubsub(self, *args, **kwargs):
        return self._pubsub

    def push_message(self, message):
        """Enqueue an inbound pub/sub message for get_message to drain."""
        self._pubsub._push(message)


@pytest.fixture
def fake_redis():
    """Fake Redis: XADD + pub/sub recorder (HARNESS-03 _emit + ask_user resume)."""
    return _FakeRedis()


@pytest.fixture
def make_tool_context(fake_redis, mock_asyncpg_pool):
    """Factory for a minimal harness ToolContext bag.

    Returns a ``SimpleNamespace`` carrying every field the real
    ``app.services.tool_dispatcher.ToolContext`` exposes PLUS ``phase_whitelist``
    (default None) — the kwarg Plan 06's whitelist guard reads. A namespace is
    used (not the real dataclass) so this Wave-0 factory already carries
    ``phase_whitelist`` before Plan 06 adds the field to the dataclass; Plan 06
    swaps to the real dataclass once the field lands.

    Usage (Plan 06):
        ctx = make_tool_context(phase_whitelist=frozenset({"search_documents"}))
    """
    import uuid as _uuid

    async def _noop_emit(*args, **kwargs):
        return None

    def _factory(**overrides):
        defaults = dict(
            redis=fake_redis,
            run_id=_uuid.uuid4(),
            thread_id=str(_uuid.uuid4()),
            supabase=_supabase,
            pool=mock_asyncpg_pool,
            user_settings=SimpleNamespace(),
            current_user=dict(mock_user_data),
            folder_subtree_ids=None,
            scoped_folder_path=None,
            emit=_noop_emit,
            spawn=lambda *a, **k: None,
            model="",
            previous_files_in_run=None,
            tool_index=0,
            iteration=0,
            parent_run_id=None,
            per_run_task_semaphore=None,
            available_tools=[],
            tool_call_id="",
            # Phase 091 HARNESS-05 — None = Deep Mode (guard is a no-op).
            phase_whitelist=None,
        )
        defaults.update(overrides)
        return SimpleNamespace(**defaults)

    return _factory


@pytest.fixture
def make_run_context(fake_redis, mock_asyncpg_pool):
    """Factory for the minimal run-identity bag the engine threads through."""
    import uuid as _uuid

    def _factory(**overrides):
        defaults = dict(
            run_id=_uuid.uuid4(),
            thread_id=str(_uuid.uuid4()),
            user_id=mock_user_data["id"],
            redis=fake_redis,
            pool=mock_asyncpg_pool,
        )
        defaults.update(overrides)
        return SimpleNamespace(**defaults)

    return _factory


@pytest.fixture
def build_workflow_definition():
    """Builder: a list of phase dicts -> parsed ``WorkflowDefinition``.

    Each phase dict may supply ``slug`` / ``phase_index`` / ``config`` /
    ``validators``; missing ``slug``/``phase_index`` are auto-filled by position
    so tests can pass bare ``config`` dicts. Exposes ``.single_phase(config, ...)``
    and ``.four_seed_defs()`` helpers as attributes on the returned callable.
    """
    from app.models.harness import WorkflowDefinition

    def _build(phases, *, slug="wf", version=1, name="Test Workflow", status="draft"):
        norm = []
        for i, p in enumerate(phases):
            if "config" in p and ("slug" in p or "phase_index" in p):
                phase = dict(p)
            elif "config" in p:
                phase = {"slug": f"p{i}", "phase_index": i, **p}
            else:
                # bare config dict
                phase = {"slug": f"p{i}", "phase_index": i, "config": p}
            phase.setdefault("slug", f"p{i}")
            phase.setdefault("phase_index", i)
            norm.append(phase)
        return WorkflowDefinition.model_validate(
            {
                "slug": slug,
                "version": version,
                "name": name,
                "status": status,
                "phases": norm,
            }
        )

    def _single_phase(config, *, slug="wf", validators=None):
        phase = {"slug": "p0", "phase_index": 0, "config": config}
        if validators is not None:
            phase["validators"] = validators
        return _build([phase], slug=slug)

    def _four_seed_defs():
        """The 4 canonical seed shapes (parsed). SINGLE SOURCE OF TRUTH for the
        definition JSONB shipped as migration 061 (Plan 07 Task 1 — the migration's
        ``definition`` column is byte-equal in shape to these dicts; the test asserts
        parity). Each is TERMINAL-by-design (D-10 — the last phase output is the chat
        answer) and lints clean (reachability).

        Covers all 5 phase types across the 4 seeds (SC#1):
          1. research_summarize  : llm_agent -> llm_single                         (PRIMARY)
          2. plan_execute_verify : llm_single -> llm_agent -> llm_single + gate    (PRIMARY)
          3. literature_review   : programmatic -> llm_batch_agents -> llm_single  (COVERAGE)
          4. doc_qa_human        : llm_agent -> llm_human_input -> llm_single       (COVERAGE)
        Union across all 4 = {programmatic, llm_single, llm_agent, llm_batch_agents,
        llm_human_input} = all 5 phase types.
        """
        research_summarize = _build(
            [
                {"slug": "research", "phase_index": 0,
                 "config": {"phase_type": "llm_agent",
                            "prompt": "Research the user's topic. Search the knowledge "
                                      "base and the web for the most relevant sources.",
                            "available_tools": ["search_documents", "web_search"]}},
                {"slug": "summarize", "phase_index": 1,
                 "config": {"phase_type": "llm_single",
                            "prompt": "Write a clear, cited summary of the prior research "
                                      "findings for the user."}},
            ],
            slug="research_summarize",
            name="Research -> Summarize",
        )
        plan_execute_verify = _build(
            [
                {"slug": "plan", "phase_index": 0,
                 "config": {"phase_type": "llm_single",
                            "prompt": "Draft a concise step-by-step plan for the user's "
                                      "request."}},
                {"slug": "execute", "phase_index": 1,
                 "config": {"phase_type": "llm_agent",
                            "prompt": "Execute the plan. Run code and gather results as "
                                      "needed.",
                            "available_tools": ["search_documents", "execute_code"]}},
                {"slug": "verify", "phase_index": 2,
                 "config": {"phase_type": "llm_single",
                            "prompt": "Verify the executed result satisfies the plan. "
                                      "If it does, include the word VERIFIED in your "
                                      "answer to the user."},
                 "validators": [
                     {"kind": "regex_match",
                      "config": {"pattern": "VERIFIED"},
                      "on_failure": "retry",
                      "max_retries": 2}
                 ]},
            ],
            slug="plan_execute_verify",
            name="Plan -> Execute -> Verify",
        )
        literature_review = _build(
            [
                {"slug": "split", "phase_index": 0,
                 "config": {"phase_type": "programmatic", "fn": "split_topic",
                            "input_keys": ["topic"]}},
                {"slug": "review", "phase_index": 1,
                 "config": {"phase_type": "llm_batch_agents",
                            "prompt": "Review the literature for this subtopic and "
                                      "summarize the key findings.",
                            "available_tools": ["search_documents"],
                            "max_parallel_agents": 5,
                            "merge_strategy": "concat_numbered"}},
                {"slug": "merge", "phase_index": 2,
                 "config": {"phase_type": "llm_single",
                            "prompt": "Merge the per-subtopic reviews into one coherent "
                                      "literature review for the user."}},
            ],
            slug="literature_review",
            name="Literature review",
        )
        doc_qa_human = _build(
            [
                {"slug": "draft", "phase_index": 0,
                 "config": {"phase_type": "llm_agent",
                            "prompt": "Draft an answer to the user's question using the "
                                      "knowledge base.",
                            "available_tools": ["search_documents"]}},
                {"slug": "confirm", "phase_index": 1,
                 "config": {"phase_type": "llm_human_input",
                            "prompt": "Does this draft answer your question? Add any "
                                      "corrections.",
                            "options": ["Looks good", "Needs changes"]}},
                {"slug": "finalize", "phase_index": 2,
                 "config": {"phase_type": "llm_single",
                            "prompt": "Finalize the answer for the user, incorporating "
                                      "the human's input."}},
            ],
            slug="doc_qa_human",
            name="Doc Q&A",
        )
        return [
            research_summarize,
            plan_execute_verify,
            literature_review,
            doc_qa_human,
        ]

    _build.single_phase = _single_phase
    _build.four_seed_defs = _four_seed_defs
    return _build


@pytest.fixture
def four_seed_defs(build_workflow_definition):
    """Convenience fixture exposing the 4 canonical seed builders directly."""
    return build_workflow_definition.four_seed_defs


@pytest.fixture
def single_phase(build_workflow_definition):
    """Convenience fixture exposing the single-phase builder directly."""
    return build_workflow_definition.single_phase


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


# ═══════════════════════════════════════════════════════════════════════
# Phase 100 Wave-0 — Ephemeral template OOXML byte fixtures (Plan 01 Task 1)
# ═══════════════════════════════════════════════════════════════════════
#
# Deterministic, dependency-free OOXML containers for the TMPL-01 validation
# tests (test_workspace_template.py). Built in-memory with stdlib `zipfile`
# (NOT python-docx) so they stay tiny + reproducible + never touch a real
# bucket (T-100-01-01 — synthetic bytes only, no untrusted input).
#
# An OOXML file (.docx/.pptx/.xlsx) is just a ZIP whose first entry is
# `[Content_Types].xml` plus a part under a format-specific prefix
# (`word/`, `ppt/`, `xl/`). The magic-byte validator Plan 100-04 builds
# (`validate_ooxml`) checks `zipfile.is_zipfile` + the `[Content_Types].xml`
# + the prefix part — these fixtures satisfy that contract; the renamed-binary
# fixture deliberately FAILS the ZIP check (the bad-file-rejection path).
#
# Owning tests:
#   valid_docx/pptx/xlsx_bytes -> test_valid_ooxml_accepted (Plan 100-04)
#   renamed_binary_bytes       -> test_bad_file_rejected     (Plan 100-04)
#   oversized_ooxml_bytes      -> test_oversized_rejected    (Plan 100-04)
#   DISTINCTIVE_TEMPLATE_TEXT  -> the never-in-search UAT (G-4 row 2)
import io as _io  # noqa: E402
import zipfile as _zipfile  # noqa: E402

# Same byte budget the workspace `workspace_files_size_limit` CHECK enforces
# (workspace_service.MAX_FILE_SIZE = 10 MB). Kept local so the fixture stays
# import-light (no app import needed for a pure-stdlib byte builder).
_TEMPLATE_MAX_FILE_SIZE = 10 * 1024 * 1024

# The literal a real uploaded template embeds so the SC#2 never-in-search UAT
# (G-4 row 2) can assert it never appears in `search_documents` / KB search.
# The same literal is used by the manual UAT instructions in 100-VALIDATION.md.
DISTINCTIVE_TEMPLATE_TEXT = "ZZ-TMPL-MARKER-100"


def _make_ooxml(part_prefix: str, content_types_extra: str = "") -> bytes:
    """Build a minimal-but-real OOXML ZIP container in memory.

    Returns bytes that pass ``zipfile.is_zipfile`` AND contain a
    ``[Content_Types].xml`` entry AND a part under ``{part_prefix}/`` —
    the three things the Plan 100-04 ``validate_ooxml`` magic-byte gate
    checks. ``part_prefix`` selects the format: ``word`` (docx),
    ``ppt`` (pptx), ``xl`` (xlsx).
    """
    bio = _io.BytesIO()
    with _zipfile.ZipFile(bio, "w", _zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/'
            'package/2006/content-types">'
            + content_types_extra
            + "</Types>",
        )
        # Embed the distinctive marker inside the document part so the
        # never-in-search UAT (G-4 row 2) has a real literal to probe.
        zf.writestr(
            f"{part_prefix}/document_marker.xml",
            f"<x>{DISTINCTIVE_TEMPLATE_TEXT}</x>",
        )
    return bio.getvalue()


@pytest.fixture
def valid_docx_bytes() -> bytes:
    """A real (tiny) .docx OOXML container: `[Content_Types].xml` + `word/` part."""
    return _make_ooxml("word")


@pytest.fixture
def valid_pptx_bytes() -> bytes:
    """A real (tiny) .pptx OOXML container: `[Content_Types].xml` + `ppt/` part."""
    return _make_ooxml("ppt")


@pytest.fixture
def valid_xlsx_bytes() -> bytes:
    """A real (tiny) .xlsx OOXML container: `[Content_Types].xml` + `xl/` part."""
    return _make_ooxml("xl")


@pytest.fixture
def renamed_binary_bytes() -> bytes:
    """A fake PE/EXE header renamed to .docx — MUST FAIL ``zipfile.is_zipfile``.

    Drives the bad-file-rejection path (Plan 100-04 ``validate_ooxml`` -> 422):
    the bytes start with the ``MZ`` DOS/PE signature, not a ZIP ``PK`` header,
    so the magic-byte gate rejects them before any persistence.
    """
    return b"MZ\x90\x00\x03\x00\x00\x00" + b"\x00" * 64


@pytest.fixture
def oversized_ooxml_bytes() -> bytes:
    """A valid ZIP container padded one byte PAST the 10 MB size limit.

    Valid OOXML magic, but ``len == _TEMPLATE_MAX_FILE_SIZE + 1`` so the
    upload size guard (Plan 100-04 -> 422) rejects it. Padding is appended
    AFTER the ZIP end-of-central-directory record so ``is_zipfile`` still
    returns True (the magic check passes; only the size guard trips).
    """
    base = _make_ooxml("word")
    pad = _TEMPLATE_MAX_FILE_SIZE + 1 - len(base)
    return base + b"\x00" * pad

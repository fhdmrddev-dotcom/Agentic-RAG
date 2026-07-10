"""Phase 145 Plan 03 (FND-01 / D-145-13 / D-145-14) — cancel-parity + zombie-heal-routing tests.

Proves the two load-bearing cancel behaviors of the extraction:

  1. ``test_cancel_finalizes_and_zrems``: the cancel TERMINAL co-writes
     ``runs.status='cancelled'`` (via ``db.runs.finalize_run`` → ``pool.execute``
     UPDATE) AND removes the run from BOTH ``runs:active`` + ``runs_by_thread:{tid}``
     mirrors — one ``finalize_run_terminal`` call, same ``run_id`` (D-145-13 cancel
     axis). This is the SAME atomicity recipe as ``test_run_lifecycle.py``, pinned to
     the cancel status the ``runs.py`` zombie-heal now writes. Because the owner
     already exists (Plan 02), this is a GREEN parity/characterization test — it locks
     the ``status='cancelled'`` + ZREM co-write the handler routes onto, and asserts the
     short-identifier error (``cancelled_by_user``, never a traceback — T-145-03-04).

  2. ``test_cancel_handler_routes_zombie_heal_through_owner``: drives the REAL
     ``runs.cancel_run`` DELETE handler through its zombie-heal branch (RUN_TASKS empty
     + ``runs.status='streaming'``) with fakes, and asserts it routes the terminal write
     through ``finalize_run_terminal(status='cancelled', ...)`` — proving the writer swap
     (D-145-14, no new cancel logic). This is the RED→GREEN gate: before Plan 03's
     ``runs.py`` change the zombie-heal wrote a supabase UPDATE and never called the
     owner, so the spy stays uncalled (RED); after the swap it fires exactly once.

No live DB / no live Redis (CLAUDE.md / the operator's dev :54322 + :6379 are LIVE and
MUST NOT be touched): the ``pool`` is an in-memory ``_FakePool`` (records each
``pool.execute`` status write), ``redis`` is an in-memory ``_FakeRedis``/
``_FakeRedisCancel`` honoring the sorted-set + cancel-op surface, and the supabase
client is a tiny recording ``_FakeSupabase`` chain. The fakes mirror
``test_run_lifecycle.py`` (copied, not imported, to keep this module self-contained).
"""
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.services.run_lifecycle import finalize_run_terminal


# ── A tiny asyncpg.Pool stand-in — execute() records the status write ──────────────
class _FakePool:
    """Records every ``pool.execute(sql, *params)`` the shared writer issues, so a test
    can assert the terminal UPDATE fired with the right positional bindings
    (``finalize_run`` binds ``run_id`` $1, ``status`` $2, ``error`` $3, ``completed_at`` $4)."""

    def __init__(self):
        self.executed: list[tuple] = []   # (sql, params) recorded per finalize_run

    async def execute(self, sql, *params):
        self.executed.append((sql, params))
        return None


# ── A tiny in-memory async fake Redis (runs:active + runs_by_thread membership) ─────
class _FakeRedis:
    """In-memory sorted-set doubles for the two mirrors the owner co-writes. ``zrem``
    routes to ``self.active`` for the ``runs:active`` key, else to a per-
    ``runs_by_thread:{tid}`` bucket. Async so ``await redis.<op>(...)`` works."""

    def __init__(self, *, active=None, by_thread=None):
        self.active = {str(k): v for k, v in (active or {}).items()}
        self.by_thread = {k: dict(v) for k, v in (by_thread or {}).items()}

    def _bucket(self, key):
        if key == "runs:active":
            return self.active
        return self.by_thread.setdefault(key, {})

    async def zadd(self, key, mapping, *a, **k):
        z = self._bucket(key)
        z.update({str(m): s for m, s in mapping.items()})
        return len(mapping)

    async def zrem(self, key, *members):
        z = self._bucket(key)
        n = 0
        for m in members:
            if z.pop(str(m), None) is not None:
                n += 1
        return n


@pytest.mark.asyncio
async def test_cancel_finalizes_and_zrems():
    """D-145-13 cancel axis: ONE finalize_run_terminal('cancelled') → finalize_run
    UPDATE(status='cancelled') AND ZREM runs:active AND ZREM runs_by_thread — same
    run_id, one call. This is the exact co-write the runs.py zombie-heal routes onto."""
    run_id = uuid4()
    thread_id = uuid4()
    tkey = f"runs_by_thread:{thread_id}"
    # Pre-seed the run as LIVE in BOTH mirrors (as register_run_start would have left it).
    redis = _FakeRedis(active={run_id: 1.0}, by_thread={tkey: {str(run_id): 1.0}})
    pool = _FakePool()

    await finalize_run_terminal(
        pool=pool,
        redis=redis,
        run_id=run_id,
        thread_id=thread_id,
        status="cancelled",
        error="cancelled_by_user",
        completed_at=datetime.now(timezone.utc),
        message_id=None,
        input_tokens=None,
        output_tokens=None,
    )

    # (1) the terminal status write fired: finalize_run → pool.execute UPDATE.
    # finalize_run binds run_id $1, status $2, error $3, completed_at $4 — db/runs.py:91-101.
    assert len(pool.executed) == 1
    sql, params = pool.executed[-1]
    assert "UPDATE runs" in sql
    assert params[0] == run_id
    assert params[1] == "cancelled"
    # (2) short-identifier error, never a traceback (T-145-03-04 / T-073-04).
    assert params[2] == "cancelled_by_user"
    # (3) completed_at is a real datetime — the WR-01-correct form, NOT the legacy
    # supabase "now()" string the zombie-heal used to write.
    assert isinstance(params[3], datetime)
    # (4) the SAME run_id left the runs:active mirror ...
    assert str(run_id) not in redis.active
    # (5) ... AND the runs_by_thread mirror — one call, both mirrors.
    assert str(run_id) not in redis.by_thread[tkey]


# ── Handler-driving fakes (supabase chain + cancel-path redis + owner spy) ─────────
class _Resp:
    """Mimic the supabase APIResponse contract aexec() consumers read (.data)."""

    def __init__(self, data):
        self.data = data
        self.count = None


class _Chain:
    """Chainable supabase query-builder double: every filter/mutation returns self,
    ``.execute()`` returns the configured response. Covers both the ownership SELECT
    (``.select().eq().eq().maybe_single().execute()``) and the anchor-clear
    (``.update().eq().execute()``)."""

    def __init__(self, resp):
        self._resp = resp

    def select(self, *a, **k):
        return self

    def update(self, *a, **k):
        return self

    def insert(self, *a, **k):
        return self

    def eq(self, *a, **k):
        return self

    def maybe_single(self):
        return self

    def execute(self):
        return self._resp


class _FakeSupabase:
    """Per-table routing: the ``runs`` table serves the streaming ownership row; every
    other table (``threads`` anchor-clear) serves an empty result. Records table names."""

    def __init__(self, run_row):
        self._run_row = run_row
        self.tables_seen: list[str] = []

    def table(self, name):
        self.tables_seen.append(name)
        if name == "runs":
            return _Chain(_Resp(self._run_row))
        return _Chain(_Resp([]))


class _FakeRedisCancel:
    """In-memory double for the zombie-heal Redis surface: SETNX cancel_lock, the
    buffer-existence probe (``exists`` → 0 so the synthetic sentinel XADD is skipped —
    keeps the test off ``_emit_terminal``), EXPIRE, and ZREM (only reached on the
    pre-Plan-03 path)."""

    def __init__(self):
        self.set_calls: list[tuple] = []
        self.expired: list[tuple] = []
        self.zrem_calls: list[tuple] = []

    async def set(self, key, value, *a, nx=False, ex=None, **k):
        self.set_calls.append((key, value, nx, ex))
        return True

    async def exists(self, key):
        return 0

    async def expire(self, key, ttl):
        self.expired.append((key, ttl))
        return True

    async def zrem(self, key, *members):
        self.zrem_calls.append((key, members))
        return len(members)


class _OwnerSpy:
    """Records every finalize_run_terminal(**kwargs) the handler routes to it."""

    def __init__(self):
        self.calls: list[dict] = []

    async def __call__(self, **kwargs):
        self.calls.append(kwargs)


@pytest.mark.asyncio
async def test_cancel_handler_routes_zombie_heal_through_owner(monkeypatch):
    """D-145-14 writer parity: the runs.py cancel zombie-heal (RUN_TASKS empty +
    status='streaming') routes its terminal write through finalize_run_terminal(
    status='cancelled', error='cancelled_by_user') — proving the swap off the supabase
    UPDATE, with NO new cancel logic. cancel_lock SETNX is still exercised (control
    preserved)."""
    import app.api.runs as runs_module
    import app.services.run_lifecycle as rl_module
    import app.dependencies as deps_module
    from app.api.threads import RUN_TASKS

    run_id = uuid4()
    thread_id = uuid4()
    user_id = uuid4()

    # Zombie precondition: no in-memory producer task (else this would be the happy path).
    assert run_id not in RUN_TASKS, f"precondition broken: {run_id} unexpectedly in RUN_TASKS"

    spy = _OwnerSpy()
    # The handler uses a call-time import of the owner from run_lifecycle — patch the
    # source module so the local `from app.services.run_lifecycle import ...` re-resolves.
    monkeypatch.setattr(rl_module, "finalize_run_terminal", spy)

    async def _fake_pool():
        return object()   # sentinel; the owner is spied, so the pool is never used.
    monkeypatch.setattr(deps_module, "get_pg_pool", _fake_pool)

    supabase = _FakeSupabase(
        {"run_id": str(run_id), "status": "streaming", "thread_id": str(thread_id)}
    )
    redis = _FakeRedisCancel()

    resp = await runs_module.cancel_run(
        run_id=run_id,
        current_user={"id": str(user_id)},
        supabase=supabase,
        redis=redis,
    )

    # Idempotent 204 (D-062-13) — best-effort cancel always succeeds for the owner.
    assert resp.status_code == 204

    # The terminal write routed through the owner EXACTLY once, as a cancel.
    assert len(spy.calls) == 1, (
        f"zombie-heal must call finalize_run_terminal once; got {spy.calls}"
    )
    call = spy.calls[0]
    assert call["status"] == "cancelled"
    assert call["error"] == "cancelled_by_user"
    assert call["run_id"] == run_id
    # thread_id from the ownership-SELECT row, coerced to UUID for the owner.
    assert str(call["thread_id"]) == str(thread_id)

    # Control preserved: the WR-04 cancel_lock SETNX still fires (not weakened by the swap).
    assert any(str(k).endswith(":cancel_lock") for (k, *_rest) in redis.set_calls), (
        f"cancel_lock SETNX must still be exercised; got set_calls={redis.set_calls}"
    )

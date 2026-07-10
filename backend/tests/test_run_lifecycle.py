"""Phase 145 Plan 02 (FND-01 / D-145-02 / D-145-09) — atomic run-lifecycle co-writer tests.

Proves the TWO load-bearing behaviors of the anti-drift owner
(``backend/app/services/run_lifecycle.py``) — the single module that co-writes
Postgres ``runs.status`` and its derived ``runs:active`` mirror together, so the
mirror can never drift from the truth (the drift that lives in ``threads.py`` today,
where the ZADD/ZREM run in different code paths than the status writes):

  1. ``test_register_cowrites_status_and_active``: ONE ``register_run_start`` call
     fires the status write (``db.runs.insert_run`` → ``pool.execute`` INSERT with
     ``status='streaming'``) AND the ``ZADD runs:active`` mirror AND the
     ``ZADD runs_by_thread:{tid}`` mirror — all for the SAME ``run_id``.
  2. ``test_finalize_cowrites_terminal_and_zrem``: ONE ``finalize_run_terminal`` call
     fires the terminal status write (``db.runs.finalize_run`` → ``pool.execute``
     UPDATE with ``status='completed'``) AND the ``ZREM runs:active`` +
     ``ZREM runs_by_thread:{tid}`` mirror removals — same ``run_id``, one call.

No live DB / no live Redis: the ``pool`` is an in-memory ``_FakePool`` honoring
``execute`` (recording ``(sql, params)`` per DB write), and ``redis`` is an in-memory
``_FakeRedis`` honoring ``zadd``/``zrem`` and distinguishing the ``runs:active`` set
from the ``runs_by_thread:*`` sets — mirroring the fakes in
``backend/tests/test_run_reconciler.py`` (the existing analog), extended with the
``zadd`` recorder the reconciler fake lacks.
"""
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.services.run_lifecycle import finalize_run_terminal, register_run_start


# ── A tiny asyncpg.Pool stand-in — execute() records the status write ──────────────
class _FakePool:
    """Records every ``pool.execute(sql, *params)`` the shared writers issue, so a test
    can assert the status INSERT/UPDATE fired with the right positional bindings
    (``insert_run``/``finalize_run`` bind ``run_id`` as $1)."""

    def __init__(self):
        self.executed: list[tuple] = []   # (sql, params) recorded per insert_run/finalize_run

    async def execute(self, sql, *params):
        self.executed.append((sql, params))
        return None


# ── A tiny in-memory async fake Redis (runs:active + runs_by_thread membership) ─────
class _FakeRedis:
    """In-memory sorted-set doubles for the two mirrors the owner co-writes. ``zadd``
    (the recorder the reconciler fake lacks) and ``zrem`` route to ``self.active`` for
    the ``runs:active`` key, else to a per-``runs_by_thread:{tid}`` bucket. Async so
    ``await redis.<op>(...)`` works."""

    def __init__(self, *, active=None, by_thread=None):
        # runs:active membership {run_id_str: score}. Presence == genuinely streaming.
        self.active = {str(k): v for k, v in (active or {}).items()}
        # per-thread buckets {"runs_by_thread:{tid}": {run_id_str: score}}
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


class _FailingZaddRedis(_FakeRedis):
    """A redis double whose ``zadd`` ALWAYS raises — to prove the mirror write is
    best-effort (CR-01). ``zrem`` is inherited unchanged; only the START ZADD path is
    exercised here."""

    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self.zadd_attempts = 0

    async def zadd(self, key, mapping, *a, **k):
        self.zadd_attempts += 1
        raise ConnectionError("simulated transient Redis failure")


@pytest.mark.asyncio
async def test_register_run_start_mirror_zadd_failure_is_best_effort():
    """CR-01 (Phase 145 review): a transient ``redis.zadd`` failure AFTER the
    authoritative Postgres INSERT must NOT propagate. ``runs:active`` is a DERIVED
    mirror (D-145-01) — a mirror blip is best-effort, never fatal, so the run stays
    ``streaming`` in Postgres and the send is never turned into a 500 / ``failed`` run.
    Pre-fix, the un-wrapped ZADD raised straight out of ``register_run_start`` →
    spawn-failure → user-facing 500."""
    run_id = uuid4()
    thread_id = uuid4()
    user_id = uuid4()
    pool = _FakePool()
    redis = _FailingZaddRedis()

    # Must NOT raise despite the ZADD failure (the whole point of CR-01).
    await register_run_start(
        pool=pool,
        redis=redis,
        run_id=run_id,
        thread_id=thread_id,
        user_id=user_id,
        model="gpt-x",
        provider="openai",
    )

    # The authoritative status write still fired with status='streaming'.
    assert len(pool.executed) == 1
    sql, params = pool.executed[-1]
    assert "INSERT INTO runs" in sql
    assert params[0] == run_id
    assert params[3] == "streaming"
    # The mirror ZADD was ATTEMPTED (and raised) — proving best-effort swallow, not skip.
    assert redis.zadd_attempts >= 1


@pytest.mark.asyncio
async def test_register_cowrites_status_and_active():
    """ONE register_run_start → insert_run(status='streaming') AND ZADD runs:active AND
    ZADD runs_by_thread — all for the SAME run_id (the atomic START co-write, D-145-02)."""
    run_id = uuid4()
    thread_id = uuid4()
    user_id = uuid4()
    pool = _FakePool()
    redis = _FakeRedis()

    n_before = len(pool.executed)
    await register_run_start(
        pool=pool,
        redis=redis,
        run_id=run_id,
        thread_id=thread_id,
        user_id=user_id,
        model="gpt-x",
        provider="openai",
    )

    # (1) the status write fired: insert_run → pool.execute INSERT, status='streaming'.
    # insert_run binds (run_id $1, thread_id $2, user_id $3, status $4, ...) — db/runs.py:52-66.
    assert len(pool.executed) == n_before + 1
    sql, params = pool.executed[-1]
    assert "INSERT INTO runs" in sql
    assert params[0] == run_id
    assert params[3] == "streaming"
    # (2) the runs:active mirror gained the SAME run_id ...
    assert str(run_id) in redis.active
    # (3) ... AND the runs_by_thread mirror gained it — all in the one call.
    assert str(run_id) in redis.by_thread[f"runs_by_thread:{thread_id}"]


@pytest.mark.asyncio
async def test_finalize_cowrites_terminal_and_zrem():
    """ONE finalize_run_terminal → finalize_run(status=terminal) AND ZREM runs:active AND
    ZREM runs_by_thread — same run_id, one call (the atomic TERMINAL co-write, D-145-02)."""
    run_id = uuid4()
    thread_id = uuid4()
    tkey = f"runs_by_thread:{thread_id}"
    # Pre-seed the run as LIVE in BOTH mirrors (as register_run_start would have left it).
    redis = _FakeRedis(active={run_id: 1.0}, by_thread={tkey: {str(run_id): 1.0}})
    pool = _FakePool()

    n_before = len(pool.executed)
    await finalize_run_terminal(
        pool=pool,
        redis=redis,
        run_id=run_id,
        thread_id=thread_id,
        status="completed",
        error=None,
        completed_at=datetime.now(timezone.utc),
        message_id=None,
        input_tokens=None,
        output_tokens=None,
    )

    # (1) the terminal status write fired: finalize_run → pool.execute UPDATE, status='completed'.
    # finalize_run binds run_id as $1 and status as $2 — db/runs.py:91-101 → params[0], params[1].
    assert len(pool.executed) == n_before + 1
    sql, params = pool.executed[-1]
    assert "UPDATE runs" in sql
    assert params[0] == run_id
    assert params[1] == "completed"
    # (2) the SAME run_id was removed from the runs:active mirror ...
    assert str(run_id) not in redis.active
    # (3) ... AND from the runs_by_thread mirror — one call, both mirrors.
    assert str(run_id) not in redis.by_thread[tkey]

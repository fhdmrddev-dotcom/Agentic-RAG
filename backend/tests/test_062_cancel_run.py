"""Phase 147 Plan 03 Task 1 (D-02 refactor-to-share) — cancel/zombie-heal shared-helper
regression backstop.

Proves the D-062 cancel discipline survives the extract into
``run_lifecycle._cancel_run_internals`` (the helper the operator Kill reuses WITHOUT
the ownership filter):

  - ``cancel_run`` still 404s an owner-missing / cross-user run — Step 1's ownership
    SELECT with ``.eq(user_id)`` stays in the CALLER (the helper never checks ownership);
  - the shared helper reports the correct sub-path outcome discriminator for each of
    the three internal paths (``terminal_noop`` / ``task_cancelled`` / ``zombie_healed``)
    so a caller can pick the audit verb (064-B honesty);
  - the zombie-heal path routes the terminal co-write through ``finalize_run_terminal``
    with ``status='cancelled'`` + ``error='cancelled_by_user'`` (the load-bearing atomic
    co-write, D-145-14) and still SETNX-gates + EXPIREs the stream buffer best-effort.

Mocking matches the DATA-ACCESS layer (MEMORY lesson, Phase 146): the ownership SELECT
is supabase (``aexec`` builder) — driven via a ``get_supabase`` override; the zombie-heal
finalize is the asyncpg pool + ``run_lifecycle.finalize_run_terminal`` — patched directly;
Redis best-effort ops use a tiny in-file async fake. We do NOT assert against the stale
supabase ``runs.update`` layer the 145-03 co-write refactor retired.
"""
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from app.dependencies import get_supabase
from app.main import app
from app.services.run_lifecycle import _cancel_run_internals


class _FakeRedis:
    """Minimal async Redis for the zombie best-effort ops (set / exists / expire / zrem).

    ``exists`` defaults to 0 so the synthetic-sentinel ``_emit_terminal`` branch is
    skipped (the buffer is treated as already gone) — the discriminator + finalize
    co-write are what this suite asserts, not the SSE sentinel transport.
    """

    def __init__(self, exists=0):
        self._exists = exists
        self.calls: list = []

    async def set(self, *a, **k):
        self.calls.append(("set", a, k))
        return True

    async def exists(self, *a, **k):
        self.calls.append(("exists", a, k))
        return self._exists

    async def expire(self, *a, **k):
        self.calls.append(("expire", a, k))
        return True

    async def zrem(self, *a, **k):
        self.calls.append(("zrem", a, k))
        return 1


def _chainable(execute_result):
    b = MagicMock()
    for m in (
        "select", "insert", "update", "delete", "eq", "neq", "in_", "or_",
        "is_", "order", "limit", "single", "maybe_single", "gte", "lt", "range",
    ):
        getattr(b, m).return_value = b
    b.execute.return_value = execute_result
    b.execute.side_effect = None
    return b


def _mock_supabase_runs_returns(data):
    result = MagicMock()
    result.data = data
    result.count = None
    b = _chainable(result)
    sb = MagicMock()
    sb.table.return_value = b
    return sb


# ── cancel_run owner-path: Step 1 ownership SELECT stays in the caller ─────────

def test_cancel_run_owner_missing_row_404s(client, auth_headers):
    """cancel_run 404s when the ownership SELECT returns no row (cross-user / missing).

    The ownership filter (``.eq(user_id)``) lives in the CALLER, not the shared
    helper — a run the caller doesn't own is byte-identically 404 (D-062-12 /
    T-062-01), and the response detail is the route's ``Run not found`` (never
    FastAPI's default) so this fails loudly if the DELETE route regresses away.
    """
    sb = _mock_supabase_runs_returns(None)
    app.dependency_overrides[get_supabase] = lambda: sb
    try:
        res = client.delete(f"/runs/{uuid4()}", headers=auth_headers)
        assert res.status_code == 404, f"expected 404; got {res.status_code} {res.text}"
        assert res.json()["detail"] == "Run not found"
    finally:
        app.dependency_overrides.pop(get_supabase, None)


# ── the shared helper reports the right outcome discriminator per sub-path ─────

async def test_internals_terminal_noop_short_circuits():
    """An already-terminal run → 'terminal_noop', no Redis/pool touch (D-062-09)."""
    fr = _FakeRedis()
    out = await _cancel_run_internals(
        run_id=uuid4(),
        status="completed",
        thread_id=str(uuid4()),
        redis=fr,
        supabase=MagicMock(),
    )
    assert out == "terminal_noop"
    assert fr.calls == [], "terminal short-circuit must not touch Redis"


async def test_internals_task_cancelled_when_producer_alive():
    """A live producer in RUN_TASKS → PUBLISH-first sentinel then task.cancel() →
    'task_cancelled' (D-062-10 / D-085-04)."""
    from app.api.threads import RUN_TASKS

    rid = uuid4()
    fake_task = MagicMock()
    fake_task.done.return_value = False
    RUN_TASKS[rid] = fake_task
    try:
        out = await _cancel_run_internals(
            run_id=rid,
            status="streaming",
            thread_id=str(uuid4()),
            redis=_FakeRedis(),
            supabase=MagicMock(),
        )
        assert out == "task_cancelled"
        fake_task.cancel.assert_called_once()
    finally:
        RUN_TASKS.pop(rid, None)


async def test_internals_zombie_heal_routes_finalize_run_terminal(mock_asyncpg_pool, monkeypatch):
    """A streaming run with NO live producer → zombie heal (D-062-11).

    Asserts the load-bearing atomic terminal co-write goes through
    ``finalize_run_terminal(status='cancelled', error='cancelled_by_user')`` (D-145-14)
    and the discriminator is 'zombie_healed' so the operator Kill can pick the
    "Recovered a stuck run" audit verb (064-B).
    """
    from app.api.threads import RUN_TASKS

    rid = uuid4()
    RUN_TASKS.pop(rid, None)  # ensure the happy path can't fire

    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    fake_finalize = AsyncMock()
    monkeypatch.setattr("app.services.run_lifecycle.finalize_run_terminal", fake_finalize)

    fr = _FakeRedis(exists=0)
    out = await _cancel_run_internals(
        run_id=rid,
        status="streaming",
        thread_id=str(uuid4()),
        redis=fr,
        supabase=MagicMock(),
    )

    assert out == "zombie_healed"
    fake_finalize.assert_awaited_once()
    kwargs = fake_finalize.await_args.kwargs
    assert kwargs["status"] == "cancelled"
    assert kwargs["error"] == "cancelled_by_user"
    # best-effort SETNX cancel-lock + EXPIRE still fire on the zombie path
    assert any(c[0] == "set" for c in fr.calls), "zombie heal must SETNX the cancel-lock"
    assert any(c[0] == "expire" for c in fr.calls), "zombie heal must EXPIRE the stream buffer"

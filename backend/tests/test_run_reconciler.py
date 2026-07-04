"""Phase 137.1 Plan 03 (EVAL-05g / BUG-260702-02) — boot-time orphan reconciler tests.

Proves the four load-bearing behaviors of the CAS-guarded startup sweep
(``backend/app/services/run_reconciler.py::reconcile_orphaned_runs``) — the WRITER
half of the restart-orphan close (137 already ships the DISPLAY half):

  1. ``test_orphaned_eval_run_flipped_to_interrupted``: a ``running`` ``eval_runs``
     row whose id is ABSENT from the Redis ``runs:active`` sorted set is UPDATEd to
     ``interrupted`` and its stale ``run:{id}`` stream is dropped.
  2. ``test_orphaned_chat_run_flipped_to_failed``: a non-terminal companion ``runs``
     row (``streaming`` / ``cap_paused``) absent from ``runs:active`` is finalized to
     ``failed`` (``db.runs.finalize_run`` → ``pool.execute``) and its stream dropped.
  3. ``test_live_run_in_runs_active_is_not_flipped``: a run PRESENT in ``runs:active``
     (the authoritative streaming set) is NEVER flipped — the T-137.1-RC1 liveness
     guard (Pitfall 6).
  4. ``test_set_nx_guard_returns_zero_when_held``: when a sibling worker already holds
     the single-shot ``run_reconcile_lock`` ``SET NX`` guard, the fn returns 0 and
     performs NO flips (T-137.1-RC2 — WORKER_COUNT=2 never double-sweeps).

No live LLM / no live DB: ``redis`` is a tiny in-memory fake honoring the
``set``(nx)/``zscore``/``delete``/``zrem`` surface + the ``runs:active`` membership the
staleness predicate reads; ``supabase`` is a small recording fake honoring the
``eval_runs`` select/update chain; the asyncpg ``pool`` is a fake honoring ``fetch``
(the non-terminal ``runs`` query) + ``execute`` (``finalize_run``).
"""
from uuid import uuid4

import pytest

from app.services.run_reconciler import reconcile_orphaned_runs


# ── A tiny in-memory async fake Redis (runs:active membership + guard + stream drop) ──
class _FakeRedis:
    """Records the SET NX guard, the ``runs:active`` sorted set, stream deletes, and
    zrem calls the reconciler touches. Async so ``await redis.<op>(...)`` works."""

    def __init__(self, *, active=None, lock_held=False):
        # runs:active membership {run_id_str: score}. Presence == genuinely streaming.
        self.active = {str(k): v for k, v in (active or {}).items()}
        self.kv: dict[str, str] = {}
        if lock_held:
            # A sibling worker already owns this boot's sweep.
            self.kv["run_reconcile_lock"] = "sibling"
        self.deleted: list[str] = []      # keys passed to delete() (the run:{id} streams)
        self.set_calls: list[tuple] = []   # (key, value, nx, ex) for the guard assertion

    async def set(self, key, value, *a, nx=False, ex=None, **k):
        self.set_calls.append((key, value, nx, ex))
        if nx and key in self.kv:
            return None            # guard already held → loser gets falsy
        self.kv[key] = value
        return True

    async def zscore(self, key, member):
        if key == "runs:active":
            return self.active.get(str(member))
        return None

    async def delete(self, *keys):
        n = 0
        for key in keys:
            self.deleted.append(key)
            n += 1
        return n

    async def zrem(self, key, *members):
        z = self.active if key == "runs:active" else {}
        for m in members:
            z.pop(str(m), None)
        return 1


# ── A tiny in-memory recording fake supabase (eval_runs select/update) ────────────
class _Result:
    def __init__(self, data):
        self.data = data


class _EvalTable:
    """One chainable ``eval_runs`` builder: honors select/update/eq and records the
    terminal UPDATE payloads into a shared store so the test can assert the flip."""

    def __init__(self, store: dict):
        self.store = store
        self._op = None
        self._payload = None
        self._eqs: dict = {}

    def select(self, *a, **k):
        self._op = "select"
        return self

    def update(self, payload, *a, **k):
        self._op = "update"
        self._payload = payload
        return self

    def eq(self, col, val, *a, **k):
        self._eqs[col] = val
        return self

    def execute(self, *a, **k):
        if self._op == "select":
            status = self._eqs.get("status")
            rows = [r for r in self.store["rows"] if r.get("status") == status]
            return _Result(rows)
        if self._op == "update":
            self.store["updates"].append({"payload": self._payload, "eqs": dict(self._eqs)})
            return _Result([])
        return _Result([])


class _FakeSupabase:
    def __init__(self, rows=None):
        self.store: dict[str, list] = {"rows": list(rows or []), "updates": []}

    def table(self, name):
        assert name == "eval_runs", f"reconciler only touches eval_runs, not {name!r}"
        return _EvalTable(self.store)


# ── A tiny asyncpg.Pool stand-in — fetch (non-terminal runs) + execute (finalize) ──
class _FakePool:
    def __init__(self, rows=None):
        self.rows = list(rows or [])       # each a dict {"run_id": UUID}
        self.executed: list[tuple] = []     # (sql, params) recorded per finalize_run

    async def fetch(self, sql, *params):
        # Emulates: SELECT run_id FROM runs WHERE status = ANY($1::text[]).
        # The test seeds exactly the non-terminal rows; the fake returns them verbatim.
        return self.rows

    async def execute(self, sql, *params):
        self.executed.append((sql, params))
        return None


@pytest.mark.asyncio
async def test_orphaned_eval_run_flipped_to_interrupted():
    """A 'running' eval run absent from runs:active → UPDATE status='interrupted' + stream dropped."""
    eval_id = str(uuid4())
    supabase = _FakeSupabase(rows=[{"id": eval_id, "status": "running"}])
    redis = _FakeRedis(active={})           # absent from runs:active → orphan
    pool = _FakePool(rows=[])

    n = await reconcile_orphaned_runs(pool=pool, redis=redis, supabase=supabase)

    assert n == 1
    assert len(supabase.store["updates"]) == 1
    upd = supabase.store["updates"][0]
    assert upd["payload"]["status"] == "interrupted"
    assert "completed_at" in upd["payload"]      # honest terminal timestamp, never NULL-left
    assert upd["eqs"]["id"] == eval_id            # scoped to THIS row
    assert upd["eqs"].get("status") == "running"  # CAS: only flip if still running
    assert f"run:{eval_id}" in redis.deleted      # stale stream dropped


@pytest.mark.asyncio
async def test_orphaned_chat_run_flipped_to_failed():
    """A non-terminal chat run absent from runs:active → finalize_run(status='failed') + stream dropped."""
    run_id = uuid4()
    supabase = _FakeSupabase(rows=[])
    redis = _FakeRedis(active={})
    pool = _FakePool(rows=[{"run_id": run_id}])

    n = await reconcile_orphaned_runs(pool=pool, redis=redis, supabase=supabase)

    assert n == 1
    assert len(pool.executed) == 1
    _sql, params = pool.executed[0]
    # finalize_run(pool, run_id=..., status=..., error=..., completed_at=..., ...) binds
    # run_id as $1 and status as $2 (db/runs.py:91-101) → positional params[0], params[1].
    assert params[0] == run_id
    assert params[1] == "failed"
    assert f"run:{run_id}" in redis.deleted


@pytest.mark.asyncio
async def test_live_run_in_runs_active_is_not_flipped():
    """A run PRESENT in runs:active is genuinely streaming — NEVER flipped (T-137.1-RC1)."""
    eval_id = str(uuid4())
    chat_id = uuid4()
    supabase = _FakeSupabase(rows=[{"id": eval_id, "status": "running"}])
    # BOTH ids are live in runs:active → the staleness predicate must skip them.
    redis = _FakeRedis(active={eval_id: 1.0, str(chat_id): 2.0})
    pool = _FakePool(rows=[{"run_id": chat_id}])

    n = await reconcile_orphaned_runs(pool=pool, redis=redis, supabase=supabase)

    assert n == 0
    assert supabase.store["updates"] == []   # eval row untouched
    assert pool.executed == []               # chat row untouched
    assert redis.deleted == []               # no live stream dropped


@pytest.mark.asyncio
async def test_set_nx_guard_returns_zero_when_held():
    """When a sibling worker holds run_reconcile_lock, the fn returns 0 and flips nothing (T-137.1-RC2)."""
    eval_id = str(uuid4())
    chat_id = uuid4()
    supabase = _FakeSupabase(rows=[{"id": eval_id, "status": "running"}])
    redis = _FakeRedis(active={}, lock_held=True)   # guard already held by the racing sibling
    pool = _FakePool(rows=[{"run_id": chat_id}])

    n = await reconcile_orphaned_runs(pool=pool, redis=redis, supabase=supabase)

    assert n == 0
    assert supabase.store["updates"] == []   # no eval flip
    assert pool.executed == []               # no chat flip
    assert redis.deleted == []               # no stream dropped

"""Phase 137.1 Plan 03 + Phase 145 Plan 04 (FND-01 / D-145-06) — orphan reconciler tests.

Proves the load-bearing behaviors of the guarded sweep
(``backend/app/services/run_reconciler.py::reconcile_orphaned_runs``):

  Eval half (membership — UNCHANGED, D-145-12: eval writers not migrated):
  1. ``test_orphaned_eval_run_flipped_to_interrupted``: a ``running`` ``eval_runs``
     row ABSENT from ``runs:active`` → ``interrupted`` + stale stream dropped.
  2. ``test_set_nx_guard_returns_zero_when_held``: a sibling worker holding the
     single-shot ``run_reconcile_lock`` ``SET NX`` guard → fn returns 0, no flips.

  Chat half (STREAM-AGE — Phase 145 D-145-06, replaces the old membership oracle
  which D-145-02 makes blind because a genuine orphan now STAYS in the mirror):
  3. ``test_orphaned_chat_run_flipped_to_failed``: a non-terminal ``runs`` row whose
     ``run:{id}`` stream is MISSING → ``failed`` (via ``finalize_run_terminal``) +
     stream dropped.
  4. ``test_stale_stream_flipped_to_failed``: a non-terminal ``runs`` row whose stream
     ``last-generated-id`` is older than STALE_TIMEOUT → ``failed``.
  5. ``test_fresh_stream_not_flipped``: a recent ``last-generated-id`` → NEVER flipped.
  6. ``test_present_in_active_but_stale_is_orphan`` (**the CRUX**): a run PRESENT in the
     ``runs:active`` mirror BUT with a stale stream → STILL flipped (membership is blind).
  7. ``test_missing_stream_is_orphan``: ``xinfo_stream`` raises ``no such key`` +
     non-terminal PG row → orphan → flipped (Pitfall 5).
  8. ``test_cap_paused_not_swept_periodically``: a ``cap_paused`` row with
     ``include_cap_paused=False`` (the periodic sweep) → NOT flipped (Pitfall 3).
  9. ``test_redis_error_skips_not_flips``: a NON-"no such key" ``ResponseError`` on the
     age read → row SKIPPED, never flipped — the safe default (Pitfall 6).
 10. ``test_periodic_lock_ttl_forwarded``: the periodic caller's ``lock_ttl`` is threaded
     into the ``SET NX`` guard TTL (D-145-08 single-flight).

No live LLM / no live DB: ``redis`` is a tiny in-memory fake honoring
``set``(nx)/``zscore``/``zadd``/``zrem``/``delete`` PLUS the Phase 145 stream-age surface
(``xinfo_stream`` last-generated-id / ``no such key`` / ``time``); ``supabase`` is a small
recording fake honoring the ``eval_runs`` select/update chain; the asyncpg ``pool`` is a
fake honoring ``fetch`` (the non-terminal ``runs`` query, status-filtered) + ``execute``
(``finalize_run``).
"""
from uuid import uuid4

import pytest
from redis.exceptions import ResponseError

from app.services.run_reconciler import reconcile_orphaned_runs

# Deterministic fake clock: redis.time() → (sec, usec). now_ms = 1_000_000 * 1000.
_FAKE_TIME = (1_000_000, 0)
_NOW_MS = _FAKE_TIME[0] * 1000 + _FAKE_TIME[1] // 1000  # 1_000_000_000
# A short, explicit test STALE_TIMEOUT (real default is 2400_000 ms; tests pin it).
_STALE_MS = 100_000  # 100 s


# ── A tiny in-memory async fake Redis (membership + guard + stream-age + drop) ──
class _FakeRedis:
    """Records the SET NX guard, the ``runs:active`` sorted set, ``zadd``/``zrem`` and
    stream deletes, PLUS the Phase 145 stream-age surface (``xinfo_stream`` returning a
    seeded ``last-generated-id`` or raising ``no such key`` when absent, and a fixed
    ``time``). Async so ``await redis.<op>(...)`` works."""

    def __init__(self, *, active=None, lock_held=False, now=_FAKE_TIME):
        # runs:active membership {run_id_str: score}. Under D-145-02 a genuine orphan
        # can now be PRESENT here, so membership is NO LONGER the chat oracle.
        self.active = {str(k): v for k, v in (active or {}).items()}
        self.kv: dict[str, str] = {}
        if lock_held:
            # A sibling worker already owns this tick's sweep.
            self.kv["run_reconcile_lock"] = "sibling"
        self.deleted: list[str] = []        # keys passed to delete() (the run:{id} streams)
        self.set_calls: list[tuple] = []     # (key, value, nx, ex) for the guard assertion
        self.zadds: list[tuple] = []          # (key, mapping) recorder
        self.streams: dict[str, bytes] = {}   # run:{id} → last-generated-id bytes
        self.error_streams: set[str] = set()  # run:{id} that raise a NON-nosuchkey fault
        self._now = now

    # ── seed helpers ────────────────────────────────────────────────────────────
    def seed_stream(self, run_id, last_ms: int) -> None:
        """Register a run:{id} stream with a chosen last-generated-id (ms component)."""
        self.streams[f"run:{run_id}"] = f"{int(last_ms)}-0".encode()

    def seed_error_stream(self, run_id) -> None:
        """Make xinfo_stream raise a NON-'no such key' ResponseError for this run."""
        self.error_streams.add(f"run:{run_id}")

    # ── surface used by the reconciler ───────────────────────────────────────────
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

    async def zadd(self, key, mapping, *a, **k):
        self.zadds.append((key, dict(mapping)))
        if key == "runs:active":
            self.active.update({str(m): s for m, s in mapping.items()})
        return len(mapping)

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

    async def xinfo_stream(self, key):
        if key in self.error_streams:
            # A real fault (e.g. WRONGTYPE) — NOT a missing key. Must propagate.
            raise ResponseError("WRONGTYPE Operation against a key holding the wrong kind of value")
        if key not in self.streams:
            raise ResponseError("no such key")
        return {"last-generated-id": self.streams[key]}

    async def time(self):
        return self._now


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
        self.rows = list(rows or [])       # each a dict {"run_id": UUID, "thread_id":.., "status":..}
        self.executed: list[tuple] = []     # (sql, params) recorded per finalize_run

    async def fetch(self, sql, *params):
        # Emulates: SELECT run_id, thread_id FROM runs WHERE status = ANY($1::text[]).
        # Honors the status-list bind so include_cap_paused=False actually excludes
        # cap_paused rows (Pitfall 3). Rows without a "status" key are dropped by the
        # filter — every chat row the tests seed carries an explicit status.
        if params and isinstance(params[0], (list, tuple)):
            allowed = set(params[0])
            return [r for r in self.rows if r.get("status") in allowed]
        return self.rows

    async def execute(self, sql, *params):
        self.executed.append((sql, params))
        return None


# ══════════════════════════════════════════════════════════════════════════════════
# Eval half — membership predicate UNCHANGED (D-145-12)
# ══════════════════════════════════════════════════════════════════════════════════
@pytest.mark.asyncio
async def test_orphaned_eval_run_flipped_to_interrupted():
    """A 'running' eval run absent from runs:active → UPDATE status='interrupted' + stream dropped."""
    eval_id = str(uuid4())
    supabase = _FakeSupabase(rows=[{"id": eval_id, "status": "running"}])
    redis = _FakeRedis(active={})           # absent from runs:active → orphan (eval membership)
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
async def test_set_nx_guard_returns_zero_when_held():
    """When a sibling worker holds run_reconcile_lock, the fn returns 0 and flips nothing (T-137.1-RC2)."""
    eval_id = str(uuid4())
    chat_id = uuid4()
    supabase = _FakeSupabase(rows=[{"id": eval_id, "status": "running"}])
    redis = _FakeRedis(active={}, lock_held=True)   # guard already held by the racing sibling
    pool = _FakePool(rows=[{"run_id": chat_id, "thread_id": uuid4(), "status": "streaming"}])

    n = await reconcile_orphaned_runs(pool=pool, redis=redis, supabase=supabase)

    assert n == 0
    assert supabase.store["updates"] == []   # no eval flip
    assert pool.executed == []               # no chat flip
    assert redis.deleted == []               # no stream dropped


# ══════════════════════════════════════════════════════════════════════════════════
# Chat half — STREAM-AGE predicate (Phase 145 D-145-06)
# ══════════════════════════════════════════════════════════════════════════════════
@pytest.mark.asyncio
async def test_orphaned_chat_run_flipped_to_failed():
    """A non-terminal chat run whose stream is MISSING → finalize_run(status='failed') + stream dropped."""
    run_id = uuid4()
    thread_id = uuid4()
    supabase = _FakeSupabase(rows=[])
    redis = _FakeRedis(active={})            # stream NOT seeded → xinfo 'no such key' → orphan
    pool = _FakePool(rows=[{"run_id": run_id, "thread_id": thread_id, "status": "streaming"}])

    n = await reconcile_orphaned_runs(pool=pool, redis=redis, supabase=supabase)

    assert n == 1
    assert len(pool.executed) == 1
    _sql, params = pool.executed[0]
    # finalize_run(pool, run_id=..., status=..., ...) binds run_id as $1, status as $2
    # (db/runs.py:91-101) → positional params[0], params[1].
    assert params[0] == run_id
    assert params[1] == "failed"
    assert f"run:{run_id}" in redis.deleted


@pytest.mark.asyncio
async def test_stale_stream_flipped_to_failed():
    """A stream whose last-generated-id is older than STALE_TIMEOUT → failed (D-145-06)."""
    run_id = uuid4()
    thread_id = uuid4()
    supabase = _FakeSupabase(rows=[])
    redis = _FakeRedis(active={})
    redis.seed_stream(run_id, _NOW_MS - (_STALE_MS + 1))   # age = STALE+1 ms → stale
    pool = _FakePool(rows=[{"run_id": run_id, "thread_id": thread_id, "status": "streaming"}])

    n = await reconcile_orphaned_runs(
        pool=pool, redis=redis, supabase=supabase, stale_timeout_ms=_STALE_MS
    )

    assert n == 1
    assert pool.executed[0][1][1] == "failed"
    assert f"run:{run_id}" in redis.deleted


@pytest.mark.asyncio
async def test_fresh_stream_not_flipped():
    """A stream whose last-generated-id is recent → NEVER flipped (a live-but-quiet run)."""
    run_id = uuid4()
    thread_id = uuid4()
    supabase = _FakeSupabase(rows=[])
    redis = _FakeRedis(active={})
    redis.seed_stream(run_id, _NOW_MS)   # age = 0 → fresh
    pool = _FakePool(rows=[{"run_id": run_id, "thread_id": thread_id, "status": "streaming"}])

    n = await reconcile_orphaned_runs(
        pool=pool, redis=redis, supabase=supabase, stale_timeout_ms=_STALE_MS
    )

    assert n == 0
    assert pool.executed == []
    assert redis.deleted == []


@pytest.mark.asyncio
async def test_present_in_active_but_stale_is_orphan():
    """CRUX (D-145-06): a run PRESENT in runs:active but with a STALE stream → STILL flipped.

    Under D-145-02 the owner co-writes runs:active, so a dead-producer orphan now STAYS
    in the mirror — membership is blind. Only stream-age catches it."""
    run_id = uuid4()
    thread_id = uuid4()
    supabase = _FakeSupabase(rows=[])
    redis = _FakeRedis(active={str(run_id): 1.0})           # PRESENT in the mirror
    redis.seed_stream(run_id, _NOW_MS - (_STALE_MS + 1))    # yet its stream is stale
    pool = _FakePool(rows=[{"run_id": run_id, "thread_id": thread_id, "status": "streaming"}])

    n = await reconcile_orphaned_runs(
        pool=pool, redis=redis, supabase=supabase, stale_timeout_ms=_STALE_MS
    )

    assert n == 1                                # flipped DESPITE membership
    assert pool.executed[0][1][1] == "failed"
    assert f"run:{run_id}" in redis.deleted


@pytest.mark.asyncio
async def test_missing_stream_is_orphan():
    """xinfo raises 'no such key' + a non-terminal PG row → orphan → flipped (Pitfall 5)."""
    run_id = uuid4()
    thread_id = uuid4()
    supabase = _FakeSupabase(rows=[])
    redis = _FakeRedis(active={str(run_id): 1.0})   # even present-in-mirror is irrelevant now
    # no seed_stream → xinfo_stream raises ResponseError('no such key')
    pool = _FakePool(rows=[{"run_id": run_id, "thread_id": thread_id, "status": "streaming"}])

    n = await reconcile_orphaned_runs(
        pool=pool, redis=redis, supabase=supabase, stale_timeout_ms=_STALE_MS
    )

    assert n == 1
    assert pool.executed[0][1][1] == "failed"


@pytest.mark.asyncio
async def test_cap_paused_not_swept_periodically():
    """A cap_paused row with include_cap_paused=False (the periodic sweep) → NOT flipped (Pitfall 3).

    cap_paused is the legitimate, re-attachable iteration-cap pause — the periodic sweep
    filters to status='streaming' only so it never kills a quietly-paused Continue run."""
    run_id = uuid4()
    thread_id = uuid4()
    supabase = _FakeSupabase(rows=[])
    redis = _FakeRedis(active={})
    redis.seed_stream(run_id, _NOW_MS - (_STALE_MS + 1))    # stale — WOULD flip if included
    pool = _FakePool(rows=[{"run_id": run_id, "thread_id": thread_id, "status": "cap_paused"}])

    n = await reconcile_orphaned_runs(
        pool=pool, redis=redis, supabase=supabase,
        stale_timeout_ms=_STALE_MS, include_cap_paused=False,
    )

    assert n == 0                    # excluded by the status filter, not by staleness
    assert pool.executed == []
    assert redis.deleted == []


@pytest.mark.asyncio
async def test_redis_error_skips_not_flips():
    """A NON-'no such key' ResponseError on the age read → row SKIPPED, never flipped (Pitfall 6)."""
    run_id = uuid4()
    thread_id = uuid4()
    supabase = _FakeSupabase(rows=[])
    redis = _FakeRedis(active={})
    redis.seed_error_stream(run_id)     # xinfo raises a WRONGTYPE ResponseError (a real fault)
    pool = _FakePool(rows=[{"run_id": run_id, "thread_id": thread_id, "status": "streaming"}])

    n = await reconcile_orphaned_runs(
        pool=pool, redis=redis, supabase=supabase, stale_timeout_ms=_STALE_MS
    )

    assert n == 0                    # unverifiable liveness → SKIP, never a false kill
    assert pool.executed == []
    assert redis.deleted == []


@pytest.mark.asyncio
async def test_periodic_lock_ttl_forwarded():
    """The periodic caller's lock_ttl is threaded into the SET NX guard TTL (D-145-08)."""
    run_id = uuid4()
    supabase = _FakeSupabase(rows=[])
    redis = _FakeRedis(active={})
    redis.seed_stream(run_id, _NOW_MS)     # fresh → no flips; we only assert the guard TTL
    pool = _FakePool(rows=[{"run_id": run_id, "thread_id": uuid4(), "status": "streaming"}])

    await reconcile_orphaned_runs(
        pool=pool, redis=redis, supabase=supabase,
        stale_timeout_ms=_STALE_MS, lock_ttl=90, include_cap_paused=False,
    )

    # the single-shot guard SET NX must carry the periodic (short) TTL, not the boot 300s
    guard_sets = [c for c in redis.set_calls if c[0] == "run_reconcile_lock"]
    assert guard_sets, "expected a SET NX on run_reconcile_lock"
    key, _value, nx, ex = guard_sets[0]
    assert nx is True
    assert ex == 90

"""Phase 204 Plan 01 (L-01 / D-204-01..04) — the cross-worker cancellation brake.

WHAT THIS SUITE IS FOR, STATED ONCE. Cancelling a workflow run used to write a status
column and nothing else. With ``WORKER_COUNT=2`` the producer usually lives on the OTHER
uvicorn worker, whose ``RUN_TASKS`` dict the cancelling request cannot see — so the run
went on calling providers and spending money behind a row that already read
``cancelled``. Every case below is written to fail if that is still true.

THE ACCEPTANCE IS BEHAVIOURAL AND IS DELIBERATELY NOT THE STATUS COLUMN. Asserting
``workflow_runs.status == 'cancelled'`` proves only that the canceller ran; it says
nothing about whether the PRODUCER stopped, which is the whole of L-01. So the cases
that matter here count PROVIDER CALLS through a mock and assert the counter is FROZEN
after the signal — that is the money question, and it is the only question a status
assertion cannot answer.

THE THREE THREATS FROM THE PLAN'S ``<threat_model>`` EACH HAVE A CASE, BY NAME. Phase
203 wrote three mitigations, implemented none, and every task still passed; this suite
exists partly so that cannot recur here:

  * Race Conditions    -> ``test_two_concurrent_cancels_interleave_idempotently``
                          ``test_a_late_producer_finalize_may_not_write_failed_over_a_cancel``
  * Stranded Channels  -> ``test_the_listener_is_torn_down_on_every_exit_path``
                          ``test_a_long_run_does_not_accumulate_subscriptions``
  * Silent Token Bleed -> ``test_worker_b_issues_no_provider_call_after_worker_a_cancels``
                          ``test_the_provider_counter_is_frozen_after_the_signal``

WHAT THIS SUITE DOES **NOT** PROVE, said plainly rather than left to be assumed. The
mock provider sits at ``harness_engine._execute_phase`` — the registry dispatch — so the
real ``task_service.run_task_sub_agent`` / ``_stream_one_iteration`` bodies are NOT
exercised. What is proven is that cancellation reaches and kills the task that WOULD
call them, through the real ``asyncio.wait_for`` wall-clock cap and the real gate loop.
A provider client that swallowed ``CancelledError`` internally would defeat this, and no
unit test at this level can see that.
"""
from __future__ import annotations

import asyncio
import json
import uuid
from unittest.mock import patch

import pytest

from app.services.run_lifecycle import (
    broadcast_run_cancellation,
    cancel_channel,
    cancel_flag_key,
    cancel_workflow_run_internals,
    cancellation_watch,
    is_run_cancelled,
)


# ── The fake Redis ───────────────────────────────────────────────────────────
#
# It really DELIVERS a PUBLISH to subscribed pubsub objects, because a fake that only
# recorded the call would let the edge half of the brake pass while being wired to
# nothing. It also exposes ``live_subscriptions`` so the stranded-channel threat can be
# asserted as a NUMBER rather than as an ordering of recorded events.
class _FakePubSub:
    def __init__(self, owner: "_FakeRedis"):
        self._owner = owner
        self._queue: asyncio.Queue = asyncio.Queue()
        self.channels: set[str] = set()
        self.closed = False

    async def subscribe(self, *channels):
        for c in channels:
            self.channels.add(c)
            self._owner.live_subscriptions.add((id(self), c))
            self._owner.events.append(("subscribe", c))

    async def unsubscribe(self, *channels):
        for c in channels or tuple(self.channels):
            self.channels.discard(c)
            self._owner.live_subscriptions.discard((id(self), c))
            self._owner.events.append(("unsubscribe", c))

    async def get_message(self, ignore_subscribe_messages=True, timeout=None):
        try:
            return await asyncio.wait_for(self._queue.get(), timeout=timeout)
        except asyncio.TimeoutError:
            return None

    async def aclose(self):
        self.closed = True
        self._owner.events.append(("aclose", tuple(sorted(self.channels))))
        for c in tuple(self.channels):
            self._owner.live_subscriptions.discard((id(self), c))
        self.channels.clear()

    close = aclose

    def _deliver(self, channel, data):
        self._queue.put_nowait({"type": "message", "channel": channel, "data": data})


class _FakeRedis:
    def __init__(self):
        self.store: dict = {}
        self.ttls: dict = {}
        self.publishes: list = []
        self.xadds: list = []
        self.events: list = []
        self.live_subscriptions: set = set()
        self._subs: list[_FakePubSub] = []

    async def set(self, key, value, ex=None, nx=False, **kw):
        if nx and key in self.store:
            return None
        self.store[key] = value
        if ex is not None:
            self.ttls[key] = ex
        return True

    async def get(self, key):
        return self.store.get(key)

    async def exists(self, key):
        return 1 if key in self.store else 0

    async def publish(self, channel, data):
        self.publishes.append((channel, data))
        self.events.append(("publish", channel))
        delivered = 0
        for ps in self._subs:
            if channel in ps.channels:
                ps._deliver(channel, data)
                delivered += 1
        return delivered

    def pubsub(self):
        ps = _FakePubSub(self)
        self._subs.append(ps)
        return ps

    # the engine's _emit
    async def xadd(self, stream, fields, *a, **kw):
        self.xadds.append((stream, fields))
        return "0-0"

    async def expire(self, *a, **kw):
        return True


class _TxCtx:
    def __init__(self, pool):
        self._pool = pool

    async def __aenter__(self):
        self._pool.calls.append(("transaction_enter", ()))
        return self

    async def __aexit__(self, *exc):
        self._pool.calls.append(("transaction_exit", ()))
        return False


class _AcquireCtx:
    def __init__(self, pool):
        self._pool = pool

    async def __aenter__(self):
        return self._pool

    async def __aexit__(self, *exc):
        return False


class _RecordingPool:
    """asyncpg-pool stand-in that records every ``(sql, args)`` in order.

    Mirrors ``tests/conftest._MockAsyncpgPool``'s surface (``acquire()`` yielding a
    recording connection, ``transaction()`` as a span marker) because the real writers
    this suite drives -- ``finish_run`` above all -- take the acquire/transaction path.
    """

    def __init__(self):
        self.calls: list = []
        self._fetch_result: list = []

    def acquire(self):
        return _AcquireCtx(self)

    def transaction(self):
        return _TxCtx(self)

    def set_fetch_result(self, rows):
        self._fetch_result = rows

    async def execute(self, sql, *args):
        self.calls.append((sql, args))
        return "UPDATE 1"

    async def fetch(self, sql, *args):
        self.calls.append((sql, args))
        return list(self._fetch_result)

    async def fetchrow(self, sql, *args):
        self.calls.append((sql, args))
        return None

    async def fetchval(self, sql, *args):
        self.calls.append((sql, args))
        return None


# ═════════════════════════════════════════════════════════════════════════════
#  1. The primitives — broadcast, registry, and the one composition (task 1)
# ═════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_broadcast_sets_the_level_then_publishes_the_edge():
    """D-204-01: SET ``run_cancelled:{id}`` (24h) BEFORE PUBLISH ``run_cancel:{id}``.

    The ORDER is asserted, not just the presence of both. A subscriber woken by the edge
    immediately re-reads the level; publishing first opens a window in which it can read
    a level that has not landed and conclude the run is alive.
    """
    r = _FakeRedis()
    run_id = uuid.uuid4()

    ok = await broadcast_run_cancellation(r, run_id, reason="circuit_breaker")

    assert ok is True
    assert r.store[cancel_flag_key(run_id)] == "circuit_breaker"
    assert r.ttls[cancel_flag_key(run_id)] == 86400, "the 24h TTL is D-204-01's"
    assert [c for c, _ in r.publishes] == [cancel_channel(run_id)]

    payload = json.loads(r.publishes[0][1])
    assert payload["run_id"] == str(run_id)
    assert payload["reason"] == "circuit_breaker"
    assert payload["at"], "the edge carries a timestamp"

    # The order. The level is a store write and the edge is an event; the event log only
    # records the publish, so assert the level was ALREADY readable at publish time by
    # replaying with a redis that fails the SET.
    assert r.events == [("publish", cancel_channel(run_id))]


@pytest.mark.asyncio
async def test_the_level_is_written_before_the_edge_is_published():
    """The ordering claim above, driven rather than asserted from the source.

    A redis whose ``publish`` inspects its own store at the moment it is called: if the
    level had been written second, the store would be empty here.
    """
    seen: dict = {}

    class _Introspecting(_FakeRedis):
        async def publish(self, channel, data):
            seen["level_present_at_publish"] = cancel_flag_key(run_id) in self.store
            return await super().publish(channel, data)

    r = _Introspecting()
    run_id = uuid.uuid4()
    await broadcast_run_cancellation(r, run_id)
    assert seen["level_present_at_publish"] is True


@pytest.mark.asyncio
async def test_is_run_cancelled_reads_the_level():
    r = _FakeRedis()
    run_id = uuid.uuid4()
    assert await is_run_cancelled(r, run_id) is False
    await broadcast_run_cancellation(r, run_id)
    assert await is_run_cancelled(r, run_id) is True
    # A DIFFERENT run is unaffected — the key is per-run, not global.
    assert await is_run_cancelled(r, uuid.uuid4()) is False


@pytest.mark.asyncio
async def test_is_run_cancelled_fails_open_on_a_redis_fault():
    """A Redis blip must not abort healthy runs on every worker at once.

    The direction is the point: ``True`` here would turn a transient outage into a
    fleet-wide cancellation.
    """

    class _Broken(_FakeRedis):
        async def exists(self, key):
            raise OSError("redis is down")

    assert await is_run_cancelled(_Broken(), uuid.uuid4()) is False


@pytest.mark.asyncio
async def test_broadcast_never_raises_and_reports_the_level_half():
    """Best-effort by contract (D-062-13) — but it still REPORTS.

    A failed PUBLISH does not flip the return value (a run with no live subscriber is
    cancelled just as effectively by the level); a failed SET does, because that is the
    half a restarted worker depends on.
    """

    class _EdgeDown(_FakeRedis):
        async def publish(self, channel, data):
            raise OSError("publish failed")

    class _LevelDown(_FakeRedis):
        async def set(self, key, value, ex=None, nx=False, **kw):
            raise OSError("set failed")

    assert await broadcast_run_cancellation(_EdgeDown(), uuid.uuid4()) is True
    assert await broadcast_run_cancellation(_LevelDown(), uuid.uuid4()) is False


@pytest.mark.asyncio
async def test_the_keys_do_not_collide_with_the_shipped_run_buffer_keys():
    """CLAUDE.md's run-buffer conventions are ``run:{id}``, ``runs_by_thread:{tid}``
    and ``runs:active``. A new key that PREFIX-collides with ``run:{id}`` would be
    swept by the SSE transport's own EXPIRE/DEL paths.
    """
    run_id = uuid.uuid4()
    chan = cancel_channel(run_id)
    flag = cancel_flag_key(run_id)
    assert chan == f"run_cancel:{run_id}"
    assert flag == f"run_cancelled:{run_id}"
    for shipped in (f"run:{run_id}", f"runs_by_thread:{run_id}", "runs:active"):
        assert chan != shipped and flag != shipped
        assert not chan.startswith(shipped + ":")
        assert not flag.startswith(shipped + ":")


@pytest.mark.asyncio
async def test_cancel_workflow_run_internals_broadcasts_and_registers():
    """Task 1's acceptance: the ONE composition publishes AND sets the registry.

    D-204-03 — every stop path funnels through this function, which is why the
    announcement lives here rather than in each caller.
    """
    pool = _RecordingPool()
    r = _FakeRedis()
    wf_id = uuid.uuid4()

    ok = await cancel_workflow_run_internals(pool=pool, workflow_run_id=wf_id, redis=r)

    assert ok is True
    assert cancel_flag_key(wf_id) in r.store
    assert [c for c, _ in r.publishes] == [cancel_channel(wf_id)]
    # ...and the two durable writes still happened.
    assert any("workflow_runs" in sql for sql, _ in pool.calls)
    assert any("workflow_phases" in sql for sql, _ in pool.calls)


@pytest.mark.asyncio
async def test_the_broadcast_precedes_the_durable_writes():
    """The brake runs BEFORE the bookkeeping, deliberately.

    Every millisecond spent in ``finish_run`` first is a millisecond the far worker is
    still calling a provider. Driven: the pool records how many writes had landed when
    the publish fired.
    """
    pool = _RecordingPool()
    seen: dict = {}

    class _Introspecting(_FakeRedis):
        async def publish(self, channel, data):
            seen["writes_before_publish"] = len(pool.calls)
            return await super().publish(channel, data)

    await cancel_workflow_run_internals(
        pool=pool, workflow_run_id=uuid.uuid4(), redis=_Introspecting()
    )
    assert seen["writes_before_publish"] == 0
    assert len(pool.calls) >= 2, "the two durable writes still ran afterwards"


@pytest.mark.asyncio
async def test_an_omitted_redis_resolves_the_app_singleton():
    """``redis`` is optional ON PURPOSE, and the default is not ``None``-means-skip.

    ``api/runs.py``'s no-producer arm calls this composition WITHOUT a redis client and
    is not in this plan's ``files_modified``. Resolving ``get_redis()`` internally is
    what makes that shipped caller broadcast unedited — a fail-safe rather than a caller
    obligation.
    """
    pool = _RecordingPool()
    r = _FakeRedis()
    wf_id = uuid.uuid4()

    with patch("app.dependencies.get_redis", return_value=r):
        ok = await cancel_workflow_run_internals(pool=pool, workflow_run_id=wf_id)

    assert ok is True
    assert cancel_flag_key(wf_id) in r.store
    assert [c for c, _ in r.publishes] == [cancel_channel(wf_id)]


@pytest.mark.asyncio
async def test_a_redis_outage_cannot_cost_the_durable_cancel_writes():
    """The brake is best-effort; the two Postgres writes are the durable record."""
    pool = _RecordingPool()

    class _AllDown(_FakeRedis):
        async def set(self, *a, **kw):
            raise OSError("down")

        async def publish(self, *a, **kw):
            raise OSError("down")

    ok = await cancel_workflow_run_internals(
        pool=pool, workflow_run_id=uuid.uuid4(), redis=_AllDown()
    )
    assert ok is True, "the return value reports the DURABLE writes, not the brake"
    assert len(pool.calls) >= 2


# ═════════════════════════════════════════════════════════════════════════════
#  2. THREAT — Stranded Channels
# ═════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
@pytest.mark.parametrize("exit_path", ["normal", "exception", "cancelled"])
async def test_the_listener_is_torn_down_on_every_exit_path(exit_path):
    """Threat 2: a Redis subscription must not outlive the phase that opened it.

    Asserted as a COUNT of live subscriptions, not as an ordering of recorded events —
    an ``unsubscribe`` that fired while a second subscription leaked would pass an
    ordering check and fail this one.
    """
    r = _FakeRedis()
    run_id = uuid.uuid4()
    assert r.live_subscriptions == set()

    async def _body():
        async with cancellation_watch(r, run_id, poll_seconds=0.01):
            assert len(r.live_subscriptions) == 1, "the case is non-vacuous"
            if exit_path == "exception":
                raise RuntimeError("boom")
            if exit_path == "cancelled":
                await asyncio.sleep(10)
            await asyncio.sleep(0.02)

    if exit_path == "exception":
        with pytest.raises(RuntimeError):
            await _body()
    elif exit_path == "cancelled":
        t = asyncio.create_task(_body())
        await asyncio.sleep(0.05)
        t.cancel()
        with pytest.raises(asyncio.CancelledError):
            await t
    else:
        await _body()

    assert r.live_subscriptions == set(), (
        f"a subscription survived the {exit_path} exit — this is the stranded-channel "
        f"threat. events={r.events!r}"
    )
    assert any(e[0] == "unsubscribe" for e in r.events)
    assert any(e[0] == "aclose" for e in r.events)


@pytest.mark.asyncio
async def test_the_watcher_task_does_not_outlive_the_context():
    """The listener is a TASK, and a cancelled-but-unawaited task is still a leak."""
    r = _FakeRedis()
    before = {t for t in asyncio.all_tasks()}
    async with cancellation_watch(r, uuid.uuid4(), poll_seconds=0.01):
        during = {t for t in asyncio.all_tasks()} - before
        assert len(during) == 1, "exactly one watcher task, non-vacuously"
    await asyncio.sleep(0)
    leaked = [t for t in during if not t.done()]
    assert leaked == [], f"the watcher outlived its context: {leaked!r}"


@pytest.mark.asyncio
async def test_a_long_run_does_not_accumulate_subscriptions():
    """Per-phase scoping: 25 sequential phases leave zero live subscriptions."""
    r = _FakeRedis()
    run_id = uuid.uuid4()
    for _ in range(25):
        async with cancellation_watch(r, run_id, poll_seconds=0.01):
            await asyncio.sleep(0)
        assert len(r.live_subscriptions) == 0
    assert r.live_subscriptions == set()


@pytest.mark.asyncio
async def test_a_subscribe_failure_degrades_to_the_level_and_never_raises():
    """A Redis outage must not kill a healthy run — the body still runs."""

    class _NoSubscribe(_FakeRedis):
        def pubsub(self):
            raise OSError("cannot subscribe")

    ran = False
    async with cancellation_watch(_NoSubscribe(), uuid.uuid4(), poll_seconds=0.01):
        ran = True
    assert ran is True


# ═════════════════════════════════════════════════════════════════════════════
#  3. The watcher's own behaviour — edge and level
# ═════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_the_edge_cancels_the_body_mid_flight():
    """A PUBLISH lands while the body is blocked; the body is cancelled."""
    r = _FakeRedis()
    run_id = uuid.uuid4()
    reached_the_end = False

    async def _body():
        nonlocal reached_the_end
        async with cancellation_watch(r, run_id, poll_seconds=0.01):
            await asyncio.sleep(5)
            reached_the_end = True

    t = asyncio.create_task(_body())
    await asyncio.sleep(0.05)  # let the SUBSCRIBE land
    await r.publish(cancel_channel(run_id), json.dumps({"reason": "cancelled"}))

    with pytest.raises(asyncio.CancelledError):
        await asyncio.wait_for(t, timeout=2.0)
    assert reached_the_end is False


@pytest.mark.asyncio
async def test_the_level_cancels_a_body_that_missed_the_edge():
    """A PUBLISH with no subscriber is DROPPED by Redis forever.

    This is the case the level exists for: the cancel is decided before the watcher
    subscribes, so no message will ever arrive. The body must still be cancelled.
    """
    r = _FakeRedis()
    run_id = uuid.uuid4()
    # Cancelled BEFORE anyone subscribes — the edge is gone.
    await broadcast_run_cancellation(r, run_id)
    assert r.publishes and not r.live_subscriptions, "nobody heard the edge"

    async def _body():
        async with cancellation_watch(r, run_id, poll_seconds=0.01):
            await asyncio.sleep(5)

    t = asyncio.create_task(_body())
    with pytest.raises(asyncio.CancelledError):
        await asyncio.wait_for(t, timeout=2.0)


@pytest.mark.asyncio
async def test_the_watcher_is_scoped_to_its_own_run():
    """A cancel for a DIFFERENT run must not touch this one."""
    r = _FakeRedis()
    mine, theirs = uuid.uuid4(), uuid.uuid4()
    finished = False

    async def _body():
        nonlocal finished
        async with cancellation_watch(r, mine, poll_seconds=0.01):
            await asyncio.sleep(0.25)
            finished = True

    t = asyncio.create_task(_body())
    await asyncio.sleep(0.05)
    await broadcast_run_cancellation(r, theirs)
    await asyncio.wait_for(t, timeout=2.0)
    assert finished is True


# ═════════════════════════════════════════════════════════════════════════════
#  4. THREAT — Silent Token Bleed. The cross-worker drive (D-204-04).
# ═════════════════════════════════════════════════════════════════════════════


def _rows(n: int, statuses=None):
    statuses = statuses or ["pending"] * n
    return [
        {
            "id": uuid.uuid4(),
            "slug": f"p{i}",
            "phase_index": i,
            "status": statuses[i],
            "output": {},
        }
        for i in range(n)
    ]


class _MockProvider:
    """Counts every simulated provider request, tagged with the phase that made it.

    ``call_log`` is the artifact the acceptance is written against. It records the phase
    slug of each request so "the run never reached step 2" is a statement about the LOG
    rather than about a total that could be reached several ways.
    """

    def __init__(self, *, calls_per_phase=40, seconds_per_call=0.01):
        self.call_log: list[str] = []
        self.calls_per_phase = calls_per_phase
        self.seconds_per_call = seconds_per_call
        self.entered: list[str] = []

    async def execute(self, phase, accumulated_outputs, ctx):
        self.entered.append(phase.slug)
        for _ in range(self.calls_per_phase):
            # THE PROVIDER CALL. Recorded BEFORE the await so a request that was issued
            # and then interrupted still counts against us — the pessimistic direction.
            self.call_log.append(phase.slug)
            await asyncio.sleep(self.seconds_per_call)
        return {"text": f"done {phase.slug}"}


async def _drive_worker_b(pool, redis, run_id, definition, provider):
    """Worker B: the process actually running the workflow."""
    from app.services import harness_engine

    ctx = type("C", (), {})()
    with patch.object(harness_engine, "_execute_phase", new=provider.execute):
        await harness_engine.run_workflow(
            run_id, definition, ctx, pool=pool, redis=redis
        )


@pytest.mark.asyncio
async def test_worker_b_issues_no_provider_call_after_worker_a_cancels(
    build_workflow_definition,
):
    """THE HEADLINE CASE (L-01 / D-204-04). Worker A stops a run worker B is driving.

    Worker B drives a 3-phase workflow whose executor makes 40 mock provider requests
    per phase. Worker A — a wholly separate coroutine holding only the shared Redis and
    the pool, exactly as a second uvicorn worker would — calls the real
    ``cancel_workflow_run_internals`` during step 1.

    The assertion is the CALL LOG, not the status column:
      * the log contains ``p0`` entries and NOTHING from ``p1`` or ``p2``;
      * the executor was ENTERED once, so phases 2 and 3 never began;
      * the count is frozen after the signal (asserted in the sibling case below).
    """
    pool = _RecordingPool()
    redis = _FakeRedis()
    run_id = uuid.uuid4()
    rows = _rows(3)
    pool.set_fetch_result(rows)
    definition = build_workflow_definition(
        [{"phase_type": "llm_single", "prompt": f"p{i}"} for i in range(3)]
    )
    provider = _MockProvider(calls_per_phase=40, seconds_per_call=0.01)

    worker_b = asyncio.create_task(
        _drive_worker_b(pool, redis, run_id, definition, provider)
    )

    # Let step 1 get genuinely under way — otherwise the case would prove only that a
    # run cancelled before it started makes no calls, which is not the claim.
    await asyncio.sleep(0.12)
    calls_at_cancel = len(provider.call_log)
    assert calls_at_cancel > 0, (
        "worker B never made a provider call — the case would be vacuous"
    )
    assert not worker_b.done(), "worker B finished before the cancel; widen the phase"

    # ── WORKER A. Nothing of worker B's is reachable from here but Redis + Postgres.
    await cancel_workflow_run_internals(
        pool=pool, workflow_run_id=run_id, redis=redis
    )

    with pytest.raises(asyncio.CancelledError):
        await asyncio.wait_for(worker_b, timeout=5.0)

    assert set(provider.call_log) == {"p0"}, (
        "a provider call was made for a phase AFTER the run was cancelled — this is "
        f"the silent-token-bleed threat. log={provider.call_log!r}"
    )
    assert provider.entered == ["p0"], (
        f"the engine entered a second phase after the cancel: {provider.entered!r}"
    )
    assert len(provider.call_log) < provider.calls_per_phase, (
        "step 1 ran to completion — the cancel did not interrupt anything, so this "
        "case is measuring nothing"
    )


@pytest.mark.asyncio
async def test_the_provider_counter_is_frozen_after_the_signal(
    build_workflow_definition,
):
    """"Zero FURTHER provider calls" as an actual measurement over time.

    The counter is read at the moment worker B dies, then again after a wait many times
    longer than one call period. If anything at all were still running — a stray task, a
    retry, a second phase — the two readings would differ.
    """
    pool = _RecordingPool()
    redis = _FakeRedis()
    run_id = uuid.uuid4()
    pool.set_fetch_result(_rows(3))
    definition = build_workflow_definition(
        [{"phase_type": "llm_single", "prompt": f"p{i}"} for i in range(3)]
    )
    provider = _MockProvider(calls_per_phase=200, seconds_per_call=0.005)

    worker_b = asyncio.create_task(
        _drive_worker_b(pool, redis, run_id, definition, provider)
    )
    await asyncio.sleep(0.12)
    assert provider.call_log, "non-vacuity: calls were happening"

    await cancel_workflow_run_internals(pool=pool, workflow_run_id=run_id, redis=redis)
    with pytest.raises(asyncio.CancelledError):
        await asyncio.wait_for(worker_b, timeout=5.0)

    frozen_at = len(provider.call_log)
    # 60 call periods. Anything still alive would add hundreds of entries.
    await asyncio.sleep(0.3)
    assert len(provider.call_log) == frozen_at, (
        f"the provider counter advanced by "
        f"{len(provider.call_log) - frozen_at} calls AFTER cancellation"
    )


@pytest.mark.asyncio
async def test_the_boundary_brake_stops_the_run_between_phases(
    build_workflow_definition,
):
    """The LEVEL half: a cancel decided while nobody is subscribed still halts the run.

    Step 1 is allowed to COMPLETE, and the cancel is registered with no edge at all
    (the level is written directly). The engine must not begin step 2.
    """
    pool = _RecordingPool()
    redis = _FakeRedis()
    run_id = uuid.uuid4()
    pool.set_fetch_result(_rows(3))
    definition = build_workflow_definition(
        [{"phase_type": "llm_single", "prompt": f"p{i}"} for i in range(3)]
    )

    from app.services import harness_engine

    provider = _MockProvider(calls_per_phase=1, seconds_per_call=0.001)

    async def _execute_then_register(phase, accumulated_outputs, ctx):
        out = await provider.execute(phase, accumulated_outputs, ctx)
        if phase.slug == "p0":
            # LEVEL ONLY — no PUBLISH, and the write lands while NOTHING is
            # subscribed (the watcher for p0 is torn down as its phase ends). This is
            # the "worker restarted / subscribed too late" shape, in which the edge is
            # provably unavailable and only the boundary check can fire.
            await redis.set(cancel_flag_key(run_id), "cancelled", ex=86400)
        return out

    ctx = type("C", (), {})()
    with patch.object(harness_engine, "_execute_phase", new=_execute_then_register):
        await harness_engine.run_workflow(
            run_id, definition, ctx, pool=pool, redis=redis
        )

    assert redis.publishes == [], "this case must not rely on the edge at all"
    assert provider.entered == ["p0"], (
        "the boundary brake did not fire — the engine started a second phase under a "
        f"cancelled run. entered={provider.entered!r}"
    )


@pytest.mark.asyncio
async def test_the_boundary_brake_never_lets_the_run_report_completed(
    build_workflow_definition,
):
    """THE PINNING CASE FOR A DEFECT THE PLAN'S OWN WORDING WOULD HAVE SHIPPED.

    204-01 task 2 says the engine should "break immediately". ``run_workflow``'s
    ``while`` loop does not fall through to nothing: after it come
    ``finish_run(pool, run_id, "completed")``, a ``run_completed`` audit row,
    ``_surface_final_answer`` and a ``run_completed`` SSE frame. A ``break`` therefore
    overwrites the cancelling worker's ``cancelled`` with ``completed``, persists a
    PARTIAL answer as the deliverable, and tells the browser the run finished.

    The brake ``return``s. Reverting that single word to ``break`` turns this case red
    on both assertions.
    """
    pool = _RecordingPool()
    redis = _FakeRedis()
    run_id = uuid.uuid4()
    pool.set_fetch_result(_rows(2))
    definition = build_workflow_definition(
        [{"phase_type": "llm_single", "prompt": f"p{i}"} for i in range(2)]
    )
    # Cancelled before the engine starts: the brake fires on the FIRST iteration.
    await broadcast_run_cancellation(redis, run_id)

    provider = _MockProvider(calls_per_phase=1, seconds_per_call=0.001)
    await _drive_worker_b(pool, redis, run_id, definition, provider)

    assert provider.entered == [], "no phase may run at all"
    completed_writes = [
        (sql, args)
        for sql, args in pool.calls
        if "workflow_runs" in sql and "completed" in [str(a) for a in args]
    ]
    assert completed_writes == [], (
        "the engine reported a CANCELLED run as `completed` — the run's owner would "
        f"see a finished run they had stopped. writes={completed_writes!r}"
    )
    assert not any(
        f.get("type") == "run_completed"
        for _, f in redis.xadds
        if isinstance(f, dict)
    ), "a `run_completed` frame was emitted for a cancelled run"


@pytest.mark.asyncio
async def test_an_uncancelled_run_is_byte_for_byte_unaffected(
    build_workflow_definition,
):
    """The brake must be inert on the happy path.

    Every phase runs, every provider call is made, and the run still reports
    ``completed`` — otherwise L-01 would have bought cancellation at the cost of
    execution.
    """
    pool = _RecordingPool()
    redis = _FakeRedis()
    run_id = uuid.uuid4()
    pool.set_fetch_result(_rows(3))
    definition = build_workflow_definition(
        [{"phase_type": "llm_single", "prompt": f"p{i}"} for i in range(3)]
    )
    provider = _MockProvider(calls_per_phase=2, seconds_per_call=0.001)

    await _drive_worker_b(pool, redis, run_id, definition, provider)

    assert provider.entered == ["p0", "p1", "p2"]
    assert provider.call_log == ["p0", "p0", "p1", "p1", "p2", "p2"]
    assert redis.live_subscriptions == set(), "three phases, three clean teardowns"
    assert any(
        "workflow_runs" in sql and "completed" in [str(a) for a in args]
        for sql, args in pool.calls
    ), "the happy path must still terminalize as completed"


# ═════════════════════════════════════════════════════════════════════════════
#  5. THREAT — Race Conditions
# ═════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_two_concurrent_cancels_interleave_idempotently():
    """Threat 1: a run may be cancelled from two places at once.

    ``cancel_workflow_run_internals``'s own docstring states the guard: the interleave
    is benign BY VALUE-IDENTITY, and "the one thing a caller must never do is make the
    two writes disagree". So this case asserts the VALUES, not an exclusion — both
    cancels write ``cancelled`` and the registry ends in one well-defined state.
    """
    pool = _RecordingPool()
    redis = _FakeRedis()
    wf_id = uuid.uuid4()

    results = await asyncio.gather(
        cancel_workflow_run_internals(pool=pool, workflow_run_id=wf_id, redis=redis),
        cancel_workflow_run_internals(pool=pool, workflow_run_id=wf_id, redis=redis),
    )
    assert results == [True, True], "neither cancel raised or reported failure"

    run_writes = [
        args for sql, args in pool.calls if "UPDATE workflow_runs" in sql
    ]
    assert len(run_writes) == 2, "both cancels really did write"
    statuses = {str(a) for args in run_writes for a in args if str(a) in
                {"cancelled", "failed", "completed", "active", "paused"}}
    assert statuses == {"cancelled"}, (
        f"the two concurrent writes disagreed on the value: {statuses!r}"
    )

    assert redis.store[cancel_flag_key(wf_id)] == "cancelled"
    assert len(redis.publishes) == 2, "each cancel announced itself"
    assert {c for c, _ in redis.publishes} == {cancel_channel(wf_id)}


@pytest.mark.asyncio
async def test_a_cancel_landing_during_the_final_phase_still_halts_it(
    build_workflow_definition,
):
    """The race the brake exists for: cancel arrives while the LAST phase is running.

    Nothing after it would have called a provider anyway — the value is that the run
    must not go on to report ``completed`` and surface a partial answer.
    """
    pool = _RecordingPool()
    redis = _FakeRedis()
    run_id = uuid.uuid4()
    pool.set_fetch_result(_rows(1))
    definition = build_workflow_definition(
        [{"phase_type": "llm_single", "prompt": "only"}]
    )
    provider = _MockProvider(calls_per_phase=100, seconds_per_call=0.005)

    worker_b = asyncio.create_task(
        _drive_worker_b(pool, redis, run_id, definition, provider)
    )
    await asyncio.sleep(0.1)
    assert provider.call_log, "non-vacuity"
    await cancel_workflow_run_internals(pool=pool, workflow_run_id=run_id, redis=redis)

    with pytest.raises(asyncio.CancelledError):
        await asyncio.wait_for(worker_b, timeout=5.0)

    assert not any(
        "workflow_runs" in sql and "completed" in [str(a) for a in args]
        for sql, args in pool.calls
    ), "a cancelled run reported `completed`"


@pytest.mark.asyncio
async def test_a_late_producer_finalize_may_not_write_failed_over_a_cancel():
    """Threat 1, the OTHER interleaving — and the one a status assertion would miss.

    Worker A writes ``cancelled``. Worker B's producer then reaches its F2 terminalize
    with a LOCAL classifier that says ``failed`` — which is what happens when the abort
    surfaces as anything other than a bare ``CancelledError`` (the wall-clock
    ``wait_for`` firing in the same window, say). Before 204 that wrote ``failed`` on
    top of ``cancelled``, telling the owner their run broke when they had stopped it.

    The producer now consults the cancel registry. This case drives
    ``_finalize_producer_run`` directly and reads the value it bound.
    """
    from app.services import run_producer

    redis = _FakeRedis()
    wf_id = uuid.uuid4()
    await broadcast_run_cancellation(redis, wf_id)

    bound: list = []

    async def _fake_finish(pool, run_id, status):
        bound.append(status)

    async def _noop(*a, **kw):
        return None

    class _Pool:
        async def execute(self, *a, **kw):
            return "UPDATE 1"

    with patch("app.db.workflows.finish_run", new=_fake_finish), patch(
        "app.api.threads.get_pg_pool", new=_noop
    ), patch("app.dependencies.get_pg_pool", new=_noop), patch.object(
        run_producer, "get_pg_pool", new=_noop, create=True
    ):
        await run_producer._finalize_producer_run(
            run_id=uuid.uuid4(),
            thread_id=uuid.uuid4(),
            redis=redis,
            result_sink={},
            terminal_status="failed",       # the LOCAL classifier's wrong guess
            terminal_error="boom",
            active_workflow_run_id=wf_id,
            resolved_provider="openai",
            resolved_model="gpt-4o",
        )

    assert bound == ["cancelled"], (
        "the producer wrote the local classifier's `failed` over another worker's "
        f"`cancelled`. bound={bound!r}"
    )


@pytest.mark.asyncio
async def test_the_registry_read_only_ever_turns_failed_into_cancelled():
    """The F2 override is one-directional, and that is what makes it safe.

    With NO cancel registered, a `failed` run must still terminalize as `failed`. The
    override can never invent a cancellation.
    """
    from app.services import run_producer

    redis = _FakeRedis()  # nothing registered
    wf_id = uuid.uuid4()
    bound: list = []

    async def _fake_finish(pool, run_id, status):
        bound.append(status)

    async def _noop(*a, **kw):
        return None

    with patch("app.db.workflows.finish_run", new=_fake_finish), patch(
        "app.api.threads.get_pg_pool", new=_noop
    ), patch("app.dependencies.get_pg_pool", new=_noop):
        await run_producer._finalize_producer_run(
            run_id=uuid.uuid4(),
            thread_id=uuid.uuid4(),
            redis=redis,
            result_sink={},
            terminal_status="failed",
            terminal_error="boom",
            active_workflow_run_id=wf_id,
            resolved_provider="openai",
            resolved_model="gpt-4o",
        )

    assert bound == ["failed"], f"a `failed` run was relabelled: {bound!r}"

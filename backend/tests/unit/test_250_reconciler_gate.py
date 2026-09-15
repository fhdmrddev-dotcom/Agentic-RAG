"""Phase 250 — HONEST-03's data half: which runs reconcile their open todos.

`BUG-260902-01` reports a timed-out run leaving `⊙ Search knowledge base for report data` reading
`IN PROGRESS` forever, and diagnoses it as *"there is no reconciliation at all"*.

⭐ **That diagnosis is REFUTED.** `reconcile_open_todos_on_run_end` exists, ships, and has exactly
ONE call site — step 3 of `_finalize_producer_run`. What is true is narrower and fixable: its gate
admitted only `terminal_status == "completed"`, so a run that timed out, was cancelled or failed
reconciled nothing. `250-MEASUREMENT.md` measured the consequence directly — 4 unmarked open todos
on 2 threads, and **not one of those threads' runs ever reached `completed`**.

⛔ The one thing this must not break is the D-05 trap: a **cap-paused** run is NON-TERMINAL and
re-attachable, so marking its todos *"not completed"* would lie about a run that is still going.
The old gate spent a second clause on that. The new gate gets it from set membership
(`cap_paused` is absent from `_RUN_STATUS_TO_TERMINAL_TYPE`), and §5 proves the equivalence in
both orderings rather than arguing it.
"""
import asyncio
import uuid
from unittest.mock import patch

import pytest


# ---------------------------------------------------------------------------
# Harness — mirrors tests/unit/test_cross_worker_cancellation.py's shape
# ---------------------------------------------------------------------------

class _FakeRedis:
    def __init__(self, zsets: dict | None = None):
        self.store: dict = {}
        self.xadds: list = []
        # key -> list[member]; WR-01 models `runs_by_thread:{tid}` live membership.
        self.zsets: dict = zsets or {}

    async def set(self, key, value, ex=None, nx=False, **kw):
        self.store[key] = value
        return True

    async def get(self, key):
        return self.store.get(key)

    async def exists(self, key):
        return 1 if key in self.store else 0

    async def xadd(self, key, fields, **kw):
        self.xadds.append((key, fields))
        return b"1-1"

    async def expire(self, key, ttl):
        return True

    async def zrem(self, key, *members):
        return 1

    # ⚠ WR-01 — this fake had NO sorted-set READ at all, which is exactly why the §1-4
    # fences could not see that step 3 is thread-scoped: they asserted only WHETHER the
    # reconciler was called, never against what live state.
    async def zrange(self, key, start, end, **kw):
        return list(self.zsets.get(key, []))

    async def publish(self, channel, data):
        return 1


async def _noop(*a, **kw):
    return None


async def _drive(
    terminal_status: str,
    result_sink: dict | None = None,
    *,
    also_live: int = 0,
    self_registered: bool = True,
    redis_raises: bool = False,
) -> dict:
    """Run `_finalize_producer_run` once and report what step 3 and step 5 did.

    Returns ``{"reconciled": bool, "order": [...], "thread_id": UUID}``.
    """
    from app.services import run_producer
    from app.services import todos_service

    order: list[str] = []
    thread_id = uuid.uuid4()
    seen_thread: list = []
    run_id = uuid.uuid4()

    # WR-01: step 3 runs BEFORE step 4's ZREM, so this run is still a member here.
    _members: list = [str(run_id)] if self_registered else []
    _members += [str(uuid.uuid4()) for _ in range(also_live)]
    _redis = _FakeRedis({f"runs_by_thread:{thread_id}": _members})
    if redis_raises:
        async def _boom_zrange(*a, **kw):
            raise RuntimeError("redis down")
        _redis.zrange = _boom_zrange

    async def _fake_reconcile(pool, tid, **kw):
        order.append("reconcile")
        seen_thread.append(tid)

    async def _fake_finalize_terminal(*a, **kw):
        order.append("finalize")

    async def _fake_finalize(*a, **kw):
        order.append("finalize")

    async def _fake_emit_terminal(*a, **kw):
        order.append("sentinel")

    with patch.object(
        todos_service, "reconcile_open_todos_on_run_end", new=_fake_reconcile
    ), patch("app.api.threads.get_pg_pool", new=_noop), patch(
        "app.dependencies.get_pg_pool", new=_noop
    ), patch(
        "app.api.threads.finalize_run_terminal", new=_fake_finalize_terminal
    ), patch(
        "app.api.threads.finalize_run", new=_fake_finalize
    ), patch(
        "app.api.threads._emit_terminal", new=_fake_emit_terminal
    ):
        await run_producer._finalize_producer_run(
            run_id=run_id,
            thread_id=thread_id,
            redis=_redis,
            result_sink=result_sink if result_sink is not None else {},
            terminal_status=terminal_status,
            terminal_error=None,
            active_workflow_run_id=None,
            resolved_provider="openai",
            resolved_model="gpt-4o",
        )

    return {
        "reconciled": "reconcile" in order,
        "order": order,
        "thread_id": thread_id,
        "seen_thread": seen_thread,
    }


# ===========================================================================
# §1-4 — every TRUE terminal status reconciles
# ===========================================================================

@pytest.mark.asyncio
async def test_1_completed_reconciles():
    """✅ Passes before AND after — the regression fence for the shipped behaviour."""
    assert (await _drive("completed"))["reconciled"]


@pytest.mark.asyncio
async def test_2_timed_out_reconciles():
    """⛔ RED before the fix — and this is BUG-260902-01's own thread (`cfa60ada`)."""
    assert (await _drive("timed_out"))["reconciled"], (
        "HONEST-03: a run that reached its time limit is terminal. Its open todos must "
        "be reconciled, or the panel claims it is still working forever."
    )


@pytest.mark.asyncio
async def test_3_cancelled_reconciles():
    """⛔ RED before the fix. 5 of the 26 measured threads sit behind a cancelled run."""
    assert (await _drive("cancelled"))["reconciled"]


@pytest.mark.asyncio
async def test_4_failed_reconciles():
    """⛔ RED before the fix. A failure is terminal too — nothing will resume it."""
    assert (await _drive("failed"))["reconciled"]


# ===========================================================================
# §5 — the D-05 trap, driven BOTH ways
# ===========================================================================

@pytest.mark.asyncio
async def test_5a_cap_paused_continuation_ordering_does_not_reconcile():
    """A continuation whose cap re-fired sets `terminal_status = "cap_paused"` itself."""
    assert not (await _drive("cap_paused"))["reconciled"], (
        "D-05: a cap-paused run is NON-TERMINAL and re-attachable. Marking its todos "
        "'not completed' lies about a run the user can still continue."
    )


@pytest.mark.asyncio
async def test_5b_cap_paused_producer_ordering_does_not_reconcile():
    """⭐ THE ONE THAT PROVES THE EQUIVALENCE.

    The producer path arrives as `terminal_status == "completed"` carrying
    `result_sink["cap_disposition"] == "cap_paused"`. The OLD gate excluded it with an
    explicit second clause; the NEW gate must still exclude it — and if it does not, the
    clause was load-bearing and removing it was a regression.
    """
    got = await _drive("completed", {"cap_disposition": "cap_paused"})
    assert not got["reconciled"], (
        "the `cap_disposition != cap_paused` clause was load-bearing after all — the "
        "producer's cap-paused run reached the reconciler and would be marked "
        "'not completed' while it is still resumable (the D-05 trap)"
    )


# ===========================================================================
# §6-7 — the invariants the widening must not disturb
# ===========================================================================

@pytest.mark.asyncio
async def test_6_reconciler_runs_before_finalize_and_before_the_sentinel():
    """Invariant S5, asserted by recorded CALL ORDER.

    Against mocks the real consequence — the `todo_updated` emit reaching a live SSE
    consumer ahead of the terminal sentinel — does not reproduce, so the ORDER is the
    only thing that can be pinned here. It is also the thing a careless refactor breaks.
    """
    order = (await _drive("timed_out"))["order"]
    assert order.index("reconcile") < order.index("finalize"), order
    assert order.index("finalize") < order.index("sentinel"), order


@pytest.mark.asyncio
async def test_7_a_reconciler_failure_never_raises_into_the_finalizer():
    """The run must still reach a terminal status even if reconciliation explodes."""
    from app.services import run_producer
    from app.services import todos_service

    order: list[str] = []

    async def _boom(*a, **kw):
        raise RuntimeError("reconciler exploded")

    async def _rec_finalize(*a, **kw):
        order.append("finalize")

    async def _rec_sentinel(*a, **kw):
        order.append("sentinel")

    with patch.object(
        todos_service, "reconcile_open_todos_on_run_end", new=_boom
    ), patch("app.api.threads.get_pg_pool", new=_noop), patch(
        "app.dependencies.get_pg_pool", new=_noop
    ), patch(
        "app.api.threads.finalize_run_terminal", new=_rec_finalize
    ), patch(
        "app.api.threads.finalize_run", new=_rec_finalize
    ), patch(
        "app.api.threads._emit_terminal", new=_rec_sentinel
    ):
        await run_producer._finalize_producer_run(
            run_id=uuid.uuid4(),
            thread_id=uuid.uuid4(),
            redis=_FakeRedis(),
            result_sink={},
            terminal_status="cancelled",
            terminal_error=None,
            active_workflow_run_id=None,
            resolved_provider="openai",
            resolved_model="gpt-4o",
        )

    assert order == ["finalize", "sentinel"], (
        "a reconciler failure must be swallowed and logged, never raised into the "
        f"byte-locked finalizer. order={order!r}"
    )


# ===========================================================================
# §8 — the gate reads the NAMED set, not a hand-typed list
# ===========================================================================

def test_8_the_gate_reuses_the_named_terminal_set():
    """The predicate must be the one step 5 already uses, eleven lines below.

    A hand-typed `in ("completed", "failed", "cancelled", "timed_out")` would pass every
    behavioural fence above and then drift the day a sixth status is added — which is
    exactly how `cap_paused` would silently start being reconciled.
    """
    from pathlib import Path

    src = (
        Path(__file__).resolve().parents[2]
        / "app"
        / "services"
        / "run_producer.py"
    ).read_text(encoding="utf-8")

    start = src.index("# 3. Phase 138 RUN-01b")
    end = src.index("reconcile_open_todos_on_run_end(", start)
    gate = src[start:end]

    assert "_RUN_STATUS_TO_TERMINAL_TYPE" in gate, (
        "the step-3 gate must read the named terminal set — cap_paused is excluded by "
        "its ABSENCE from that map, which is a fact a hand-typed tuple cannot inherit"
    )

    from app.services.run_transport import _RUN_STATUS_TO_TERMINAL_TYPE

    assert "cap_paused" not in _RUN_STATUS_TO_TERMINAL_TYPE, (
        "if cap_paused is ever added to this map, the step-3 gate silently starts "
        "marking resumable runs 'not completed' — add an explicit exclusion first"
    )


# ===========================================================================
# §9 — WR-01: the gate is thread-scoped, so it must refuse while another
#      run is still live on that thread
# ===========================================================================

@pytest.mark.asyncio
async def test_9_1_a_second_live_run_on_the_thread_blocks_reconciliation():
    """WR-01 — `cancelled` is exactly the status followed by an immediate re-prompt.

    `reconcile_open_todos_on_run_end` selects `WHERE thread_id = $1`: it marks every
    open todo on the THREAD, not the todos of the run that ended. Its docstring claims
    *"Forward-only (D-06) — this only affects the run that just ended"*, and that is
    false whenever a second run is live on the same thread.

    Nothing refuses a second Deep run while one is live (the 409 in `threads.py` is the
    workflow-anchor lock), and step 3 runs BEFORE step 4's `runs_by_thread` ZREM. So a
    user who hits Stop and re-prompts can have the dying run append
    `" (run ended — not completed)"` to the NEW run's still-open todos — `BUG-260913-02`
    re-created by the fix for `BUG-260902-01`.
    """
    r = await _drive("cancelled", also_live=1)

    assert r["reconciled"] is False, (
        "WR-01: a run that ended while another run is still live on the thread must NOT "
        "mark that thread's open todos — they may belong to the live run"
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["completed", "failed", "cancelled", "timed_out"])
async def test_9_2_the_block_applies_to_every_terminal_status(status: str):
    """The hazard is thread scope, not a particular status — all four must refuse."""
    r = await _drive(status, also_live=2)
    assert r["reconciled"] is False, f"{status}: reconciled with 2 other live runs"


@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["completed", "failed", "cancelled", "timed_out"])
async def test_9_3_the_lone_run_still_reconciles(status: str):
    """⛔ The guard must not silently undo HONEST-03.

    When this run is the only member of `runs_by_thread`, every true terminal status
    still reconciles — which is the whole point of the phase and what
    `250-MEASUREMENT.md` measured 4 stuck todos against.
    """
    r = await _drive(status, also_live=0)
    assert r["reconciled"] is True, f"{status}: the lone-run path must still reconcile"


@pytest.mark.asyncio
async def test_9_4_an_unregistered_self_with_a_live_sibling_refuses():
    """Fail-closed on the ambiguous shape, and this is why the check is not `zcard <= 1`.

    A count cannot tell "only me" from "only someone else". If this run is already gone
    from the registry while a DIFFERENT run is live, `zcard` reads 1 and a count-based
    guard would ALLOW the very write it exists to prevent. Comparing MEMBERS refuses.
    """
    r = await _drive("cancelled", also_live=1, self_registered=False)
    assert r["reconciled"] is False, (
        "WR-01: the set held one member and it was NOT this run — a count-based guard "
        "would have read 1 and allowed the cross-run write"
    )


@pytest.mark.asyncio
async def test_9_5_a_redis_failure_does_not_disable_honest_03():
    """Stated trade-off, recorded rather than defaulted into.

    Step 3 is best-effort by contract and must never raise into the byte-locked
    finalizer. On a registry read failure the guard fails OPEN: a stuck todo is a
    permanent honesty defect (`BUG-260902-01`), whereas a stray marker needs a
    simultaneous second run AND a broken Redis, and is overwritten by that run's own
    next todo write.
    """
    r = await _drive("cancelled", redis_raises=True)
    assert r["reconciled"] is True, (
        "a Redis outage must not silently switch HONEST-03 back off"
    )

"""Phase 204 Plan 02 (SCHED-02 / D-204-05..07) — the spend-cap + duration breaker.

WHAT THIS SUITE IS FOR, STATED ONCE. A scheduled run has nobody watching it. The two
things that can go wrong without anyone noticing are money (a loop, a growing context)
and wall-clock (a provider that never answers). Every case below is written to fail if
either ceiling is decorative.

⚠ THE ACCEPTANCE IS BEHAVIOURAL, NOT THE STATUS COLUMN — inherited verbatim from 204-01's
argument, because the same trap applies one plan over. Asserting ``status == 'cancelled'``
proves only that the breaker's writer ran; it says nothing about whether the ENGINE
stopped, which is the whole of SCHED-02. So the cases that matter count PHASE EXECUTIONS
and PROVIDER CALLS through a mock and assert the counter is frozen. A status assertion
cannot answer the money question.

THE THREE THREATS FROM THE PLAN'S ``<threat_model>`` EACH HAVE A CASE, BY NAME. This is
the phase's standing criterion: Phase 203 wrote three mitigations, implemented none, and
every task still passed.

  * Runaway Cost in Unattended Execution
      -> ``test_the_token_ceiling_stops_the_next_phase_from_executing``
      -> ``test_the_ceiling_cannot_be_bypassed_by_a_phase_that_reports_no_usage``
      -> ``test_the_token_ceiling_is_reached_through_the_real_executor_seam``
  * Wall-Clock Stalls
      -> ``test_the_duration_watch_kills_a_hung_phase_mid_flight``
      -> ``test_a_boundary_only_check_could_not_have_killed_the_hung_phase``
  * Audit Evasion
      -> ``test_the_trip_record_is_written_before_the_run_is_terminalized``
      -> ``test_the_trip_record_carries_the_exact_measurements``
      -> ``test_the_halt_survives_a_failed_trip_record``

⚠ AND ONE CASE THAT IS NOT A THREAT BUT IS THE THING MOST LIKELY TO BE GOT WRONG:
``test_a_tripped_run_never_reports_completed``. 204-01 measured that ``break`` at a stop
boundary in ``run_workflow`` falls straight into ``finish_run(…, "completed")``,
``_surface_final_answer`` and a ``run_completed`` frame. A breaker that used ``break``
would kill a run for overspending and then tell the user it succeeded.

WHAT THIS SUITE DOES **NOT** PROVE, said plainly rather than left to be assumed:

  * The engine-level cases mock at ``harness_engine._execute_phase`` (the registry
    dispatch), so the real ``task_service`` / provider bodies are not exercised there.
    ``test_the_token_ceiling_is_reached_through_the_real_executor_seam`` closes half of
    that by driving the REAL ``phase_types._exec_llm_agent`` against a patched
    ``run_task_sub_agent``, which is the exact seam 204-02 widened.
  * ``llm_emit`` phases contribute ZERO tokens and there is no case asserting otherwise,
    because ``forced_emit`` measures no usage anywhere in its own module. That is a
    stated gap in the SUMMARY, not an oversight here.
  * No live Postgres. Migration 125 (``workflow_runs.metadata`` + the 25th audit kind) is
    authored but UNAPPLIED; ``tests/unit/test_audit_event_registration.py`` G2 pins the
    two vocabulary layers equal, which is the check that would catch a half-registration.
"""
from __future__ import annotations

import asyncio
import ast
import inspect
import textwrap
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest

from app.services.circuit_breaker import (
    REASON_MAX_DURATION,
    REASON_TOKEN_BUDGET,
    CircuitBreaker,
    CircuitBreakerTrippedError,
)


# ═════════════════════════════════════════════════════════════════════════════
#  Fakes. Deliberately NOT imported from 204-01's module — a suite that shares a
#  fixture with the suite it is meant to be independent of can go green together
#  with it for the wrong reason.
# ═════════════════════════════════════════════════════════════════════════════


class _FakePubSub:
    def __init__(self, redis):
        self._redis = redis
        self._queue: list[dict] = []
        self.channels: set[str] = set()

    async def subscribe(self, channel):
        self.channels.add(channel)
        self._redis.live_subscriptions.add(self)

    async def unsubscribe(self, channel=None):
        self.channels.clear()
        self._redis.live_subscriptions.discard(self)

    async def aclose(self):
        self._redis.live_subscriptions.discard(self)

    async def close(self):
        await self.aclose()

    async def get_message(self, ignore_subscribe_messages=True, timeout=1.0):
        if self._queue:
            return self._queue.pop(0)
        await asyncio.sleep(min(timeout, 0.01))
        return None

    def deliver(self, channel, data):
        if channel in self.channels:
            self._queue.append({"type": "message", "channel": channel, "data": data})


class _FakeRedis:
    """Really delivers a PUBLISH to subscribed pubsub objects (204-01's discipline).

    A fake that merely RECORDED the publish would let the edge half of the brake pass
    while wired to nothing — and the duration watch's whole design is that it trips and
    lets the EDGE do the killing.
    """

    def __init__(self):
        self.store: dict[str, str] = {}
        self.live_subscriptions: set[_FakePubSub] = set()
        self._subs: list[_FakePubSub] = []

    async def set(self, key, value, ex=None):
        self.store[key] = value
        return True

    async def exists(self, key):
        return 1 if key in self.store else 0

    async def publish(self, channel, data):
        for ps in list(self._subs):
            ps.deliver(channel, data)
        return 1

    def pubsub(self):
        ps = _FakePubSub(self)
        self._subs.append(ps)
        return ps

    async def xadd(self, *a, **k):
        return "0-0"

    async def zadd(self, *a, **k):
        return 1

    async def zrem(self, *a, **k):
        return 1

    async def expire(self, *a, **k):
        return True


class _AcquireCtx:
    def __init__(self, pool):
        self._pool = pool

    async def __aenter__(self):
        return self._pool

    async def __aexit__(self, *exc):
        return False


class _TxCtx:
    def __init__(self, pool):
        self._pool = pool

    async def __aenter__(self):
        self._pool.calls.append(("BEGIN", ()))
        return self

    async def __aexit__(self, *exc):
        self._pool.calls.append(("COMMIT", ()))
        return False


class _RecordingPool:
    """asyncpg-pool stand-in recording every ``(sql, args)`` IN ORDER.

    ⚠ THE ORDER IS THE ARTIFACT, not a convenience. The audit-evasion threat is about
    the trip record landing BEFORE the terminalize, and "before" is only checkable
    against a sequence.

    ``budget`` seeds the ``workflow_runs`` row ``load_run_budget`` reads.
    """

    def __init__(self, *, budget: dict | None = None, rows=None):
        self.calls: list = []
        self._fetch_result = rows or []
        self._budget = budget
        self.fail_on: str | None = None

    def acquire(self):
        return _AcquireCtx(self)

    def transaction(self):
        return _TxCtx(self)

    def set_fetch_result(self, rows):
        self._fetch_result = rows

    def _maybe_fail(self, sql):
        if self.fail_on and self.fail_on in sql:
            raise RuntimeError(f"simulated database failure on: {self.fail_on}")

    async def execute(self, sql, *args):
        self._maybe_fail(sql)
        self.calls.append((sql, args))
        return "UPDATE 1"

    async def fetch(self, sql, *args):
        self.calls.append((sql, args))
        return list(self._fetch_result)

    async def fetchrow(self, sql, *args):
        self.calls.append((sql, args))
        if "SELECT metadata" in sql and self._budget is not None:
            return {
                "metadata": self._budget.get("metadata"),
                "claimed_at": self._budget.get("claimed_at"),
                "created_at": self._budget.get(
                    "created_at", datetime.now(timezone.utc)
                ),
            }
        return None

    async def fetchval(self, sql, *args):
        self.calls.append((sql, args))
        return None

    # ── readers the assertions are written against ──────────────────────────
    def sql_log(self) -> list[str]:
        return [sql for sql, _ in self.calls]

    def index_of(self, needle: str) -> int:
        for i, sql in enumerate(self.sql_log()):
            if needle in sql:
                return i
        return -1

    def audit_rows(self) -> list[tuple]:
        return [args for sql, args in self.calls if "INSERT INTO harness_audit" in sql]

    def audit_kinds(self) -> list[str]:
        return [a[2] for a in self.audit_rows()]

    def finish_run_statuses(self) -> list[str]:
        """Every status literal bound by a ``workflow_runs`` status UPDATE."""
        out = []
        for sql, args in self.calls:
            if "workflow_runs" in sql and "status" in sql and "SET" in sql.upper():
                out.extend(a for a in args if isinstance(a, str))
        return out


def _rows(n: int):
    return [
        {
            "id": uuid.uuid4(),
            "slug": f"p{i}",
            "phase_index": i,
            "status": "pending",
            "output": {},
        }
        for i in range(n)
    ]


class _MeteredProvider:
    """A phase executor that BILLS. Every entry adds tokens to the run-level box.

    ⚠ IT WRITES INTO ``ctx.run_usage_box`` — THE REAL CHANNEL, NOT A TEST-ONLY ONE. The
    engine sets that box and the shipped executors thread it into the substrate; a fake
    that reported its usage some other way would prove the breaker works against a pipe
    that does not exist in production.
    """

    def __init__(self, *, tokens_per_phase=300, seconds_per_phase=0.01):
        self.entered: list[str] = []
        self.tokens_per_phase = tokens_per_phase
        self.seconds_per_phase = seconds_per_phase

    async def execute(self, phase, accumulated_outputs, ctx):
        self.entered.append(phase.slug)
        await asyncio.sleep(self.seconds_per_phase)
        box = getattr(ctx, "run_usage_box", None)
        if isinstance(box, dict):
            half = self.tokens_per_phase // 2
            box["input_tokens"] = (box.get("input_tokens") or 0) + half
            box["output_tokens"] = (
                box.get("output_tokens") or 0
            ) + (self.tokens_per_phase - half)
        return {"text": f"done {phase.slug}"}


async def _drive(pool, redis, run_id, definition, execute, ctx=None):
    from app.services import harness_engine

    ctx = ctx if ctx is not None else type("C", (), {})()
    with patch.object(harness_engine, "_execute_phase", new=execute):
        await harness_engine.run_workflow(
            run_id, definition, ctx, pool=pool, redis=redis
        )


# ═════════════════════════════════════════════════════════════════════════════
#  1. The breaker leaf — arithmetic and the decision
# ═════════════════════════════════════════════════════════════════════════════


def test_a_breaker_with_no_limits_is_disarmed_and_can_never_trip():
    """THE COMMON CASE. Every run that exists today passes no limits."""
    b = CircuitBreaker()
    assert b.armed is False
    b.record_tokens(10**9, 10**9)
    assert b.check_limits() == (False, None)
    assert b.remaining_seconds() is None


def test_record_tokens_accumulates_input_and_output_separately():
    b = CircuitBreaker(max_tokens=1000)
    b.record_tokens(100, 50)
    b.record_tokens(200, 25)
    assert (b.input_tokens, b.output_tokens) == (300, 75)
    assert b.cumulative_tokens == 375


def test_none_usage_adds_nothing_and_is_not_read_as_zero_error():
    """A provider that emitted no usage must not crash the counter."""
    b = CircuitBreaker(max_tokens=100)
    b.record_tokens(None, None)
    assert b.cumulative_tokens == 0
    assert b.check_limits() == (False, None)


def test_the_ceiling_is_inclusive():
    """⚠ ``>=``, NOT ``>``. Spending exactly the allowance has spent it."""
    b = CircuitBreaker(max_tokens=500)
    b.record_tokens(300, 199)
    assert b.check_limits() == (False, None)
    b.record_tokens(0, 1)
    assert b.cumulative_tokens == 500
    assert b.check_limits() == (True, REASON_TOKEN_BUDGET)


def test_absorb_usage_box_treats_the_box_as_cumulative():
    """The box holds RUN totals; ``record_tokens`` is additive. One subtraction, here."""
    b = CircuitBreaker(max_tokens=10_000)
    b.absorb_usage_box({"input_tokens": 100, "output_tokens": 40})
    assert b.cumulative_tokens == 140
    # The SAME box, grown — absorbing again must add the DELTA, never the total.
    b.absorb_usage_box({"input_tokens": 250, "output_tokens": 90})
    assert (b.input_tokens, b.output_tokens) == (250, 90)
    assert b.cumulative_tokens == 340


def test_absorb_usage_box_never_decreases_the_counter():
    """A box that went BACKWARDS must not refund a spend cap."""
    b = CircuitBreaker(max_tokens=10_000)
    b.absorb_usage_box({"input_tokens": 500, "output_tokens": 500})
    b.absorb_usage_box({"input_tokens": 1, "output_tokens": 1})
    assert b.cumulative_tokens == 1000


def test_an_empty_or_absent_box_is_a_no_op():
    b = CircuitBreaker(max_tokens=10)
    b.absorb_usage_box(None)
    b.absorb_usage_box({})
    assert b.cumulative_tokens == 0


def test_the_duration_limit_is_measured_from_the_supplied_anchor():
    """⚠ NOT FROM THE OBJECT'S BIRTHDAY. A resume must not refill the wall clock."""
    anchor = datetime.now(timezone.utc) - timedelta(seconds=120)
    b = CircuitBreaker(max_duration_seconds=60, started_at=anchor)
    assert b.elapsed_seconds() >= 120
    assert b.check_limits() == (True, REASON_MAX_DURATION)
    assert b.remaining_seconds() < 0


def test_a_naive_anchor_is_read_as_utc_rather_than_raising():
    b = CircuitBreaker(
        max_duration_seconds=60,
        started_at=datetime.utcnow() - timedelta(seconds=120),  # noqa: DTZ003
    )
    assert b.check_limits() == (True, REASON_MAX_DURATION)


def test_tokens_win_when_both_ceilings_breach_at_once():
    """Fixed order, so the reported reason is deterministic rather than incidental."""
    b = CircuitBreaker(
        max_tokens=10,
        max_duration_seconds=1,
        started_at=datetime.now(timezone.utc) - timedelta(seconds=600),
    )
    b.record_tokens(50, 50)
    assert b.check_limits() == (True, REASON_TOKEN_BUDGET)


@pytest.mark.parametrize("value", [0, None, -5])
def test_a_nonpositive_limit_disarms_that_ceiling(value):
    """``0`` as a budget means "unset", never "kill immediately"."""
    b = CircuitBreaker(max_tokens=value, max_duration_seconds=value)
    assert b.armed is False
    assert b.check_limits() == (False, None)


# ═════════════════════════════════════════════════════════════════════════════
#  2. THREAT — Audit Evasion. The trip record.
# ═════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_the_trip_record_is_written_before_the_run_is_terminalized():
    """THE AUDIT-EVASION MITIGATION, asserted as an ORDER over the SQL log.

    The threat entry says durable records are written "before terminating the run". A
    case that only asserted both writes HAPPENED would pass on the wrong order, which is
    exactly the arrangement in which a crash between them loses the evidence and keeps
    the cancellation.
    """
    pool, redis, run_id = _RecordingPool(), _FakeRedis(), uuid.uuid4()
    b = CircuitBreaker(max_tokens=500)
    b.record_tokens(400, 200)

    assert await b.trip_breaker(
        pool, redis, run_id, REASON_TOKEN_BUDGET, user_id=uuid.uuid4()
    ) is True

    audit_at = pool.index_of("INSERT INTO harness_audit")
    meta_at = pool.index_of("SET metadata")
    cancel_at = pool.index_of("workflow_runs SET status")
    if cancel_at == -1:  # finish_run's SQL shape may differ — find any status write
        cancel_at = next(
            i for i, s in enumerate(pool.sql_log())
            if "workflow_runs" in s and "status" in s
        )

    assert audit_at != -1, f"no audit row written. log={pool.sql_log()!r}"
    assert meta_at != -1, f"no metadata row written. log={pool.sql_log()!r}"
    assert audit_at < cancel_at, (
        "the run was terminalized BEFORE its trip was recorded — audit evasion. "
        f"log={pool.sql_log()!r}"
    )
    assert meta_at < cancel_at, (
        "the trip detail landed after the terminalize. " f"log={pool.sql_log()!r}"
    )


@pytest.mark.asyncio
async def test_the_trip_record_carries_the_exact_measurements():
    """"with exact token and timing measurements" — the threat's own words."""
    pool, redis, run_id = _RecordingPool(), _FakeRedis(), uuid.uuid4()
    b = CircuitBreaker(
        max_tokens=500,
        started_at=datetime.now(timezone.utc) - timedelta(seconds=30),
    )
    b.record_tokens(400, 150)

    await b.trip_breaker(pool, redis, run_id, REASON_TOKEN_BUDGET)

    (audit_args,) = pool.audit_rows()
    kind, payload = audit_args[2], audit_args[3]
    assert kind == "circuit_breaker_tripped"
    import json as _json

    record = _json.loads(payload)
    assert record["reason"] == REASON_TOKEN_BUDGET
    assert record["input_tokens"] == 400
    assert record["output_tokens"] == 150
    assert record["cumulative_tokens"] == 550
    assert record["max_tokens"] == 500
    assert record["elapsed_seconds"] >= 30


@pytest.mark.asyncio
async def test_the_metadata_write_hands_the_codec_a_plain_dict():
    """⚠ NEVER A PRE-DUMPED STRING (200.1 / D-200.1-01(b)).

    The pool installs a jsonb codec whose encoder IS ``json.dumps``, so a pre-encoded
    string is encoded a SECOND time and lands as a jsonb STRING SCALAR — measured at 484
    of 484 ``completed`` rows on ``workflow_phases.output`` before it was fixed. The
    parameter, not the cast, is what must be right.
    """
    pool, redis, run_id = _RecordingPool(), _FakeRedis(), uuid.uuid4()
    b = CircuitBreaker(max_tokens=1)
    b.record_tokens(5, 5)
    await b.trip_breaker(pool, redis, run_id, REASON_TOKEN_BUDGET)

    bound = [
        args for sql, args in pool.calls if "SET metadata" in sql
    ]
    assert bound, "no metadata write at all"
    payload = bound[0][1]
    assert isinstance(payload, dict), (
        f"the metadata parameter is a {type(payload).__name__}, not a dict — this is "
        "the migration-122 string-scalar shape, one column over."
    )
    assert payload["circuit_breaker"]["reason"] == REASON_TOKEN_BUDGET


def test_the_writer_does_not_pre_encode_its_jsonb_parameter():
    """The same property as a STRUCTURAL fence over the shipped source.

    ⚠ AST, NEVER A REGEX. ``db/workflows.py``'s docstrings discuss ``json.dumps`` at
    length — that discussion IS the recorded root cause — and a naive ``src.count``
    reads that prose as live code. This repo has recorded that trap (187-24) firing
    six times.
    """
    from app.db.workflows import create_workflow_run, record_circuit_breaker_trip

    def _dumps_calls(func) -> int:
        tree = ast.parse(textwrap.dedent(inspect.getsource(func)))
        return sum(
            1
            for n in ast.walk(tree)
            if isinstance(n, ast.Call)
            and isinstance(n.func, ast.Attribute)
            and n.func.attr == "dumps"
            and isinstance(n.func.value, ast.Name)
            and n.func.value.id == "json"
        )

    assert _dumps_calls(record_circuit_breaker_trip) == 0
    # ⚠ POSITIVE CONTROL — without it the zero above proves nothing (a typo'd attribute
    # name or a walk over the wrong tree passes too). `create_workflow_run` still
    # pre-encodes `inputs`, the honoured sibling deferral, so it is a LIVE control.
    assert _dumps_calls(create_workflow_run) >= 1


@pytest.mark.asyncio
async def test_the_halt_survives_a_failed_trip_record():
    """⚠ THE BOOKKEEPING IS BEST-EFFORT AND THE HALT IS NOT.

    An unapplied migration 125 makes the audit INSERT raise a Postgres 23514 and the
    metadata UPDATE an UndefinedColumnError. BUG-260731-02 is this project's recorded
    case of an audit write killing the very run it was describing. A safety mechanism
    that its own paperwork can disable is worse than none, because it reads as armed.
    """
    pool, redis, run_id = _RecordingPool(), _FakeRedis(), uuid.uuid4()
    pool.fail_on = "harness_audit"
    b = CircuitBreaker(max_tokens=1)
    b.record_tokens(5, 5)

    assert await b.trip_breaker(pool, redis, run_id, REASON_TOKEN_BUDGET) is True

    from app.services.run_lifecycle import cancel_flag_key

    assert cancel_flag_key(run_id) in redis.store, (
        "the cancel was not broadcast — a failed audit write disabled the brake"
    )
    assert any(
        "workflow_runs" in s and "status" in s for s in pool.sql_log()
    ), "the run was never terminalized after the audit write failed"


@pytest.mark.asyncio
async def test_a_breaker_trips_exactly_once():
    """The boundary check and the duration sentinel can observe one breach together."""
    pool, redis, run_id = _RecordingPool(), _FakeRedis(), uuid.uuid4()
    b = CircuitBreaker(max_tokens=1)
    b.record_tokens(5, 5)

    first, second = await asyncio.gather(
        b.trip_breaker(pool, redis, run_id, REASON_TOKEN_BUDGET),
        b.trip_breaker(pool, redis, run_id, REASON_MAX_DURATION),
    )
    assert sorted([first, second]) == [False, True]
    assert pool.audit_kinds() == ["circuit_breaker_tripped"], (
        f"one breach produced {len(pool.audit_kinds())} trip records — the ledger now "
        "reports two different reasons for one event."
    )


# ═════════════════════════════════════════════════════════════════════════════
#  3. THREAT — Runaway Cost. The token ceiling, driven through the real engine.
# ═════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_the_token_ceiling_stops_the_next_phase_from_executing(
    build_workflow_definition,
):
    """THE HEADLINE CASE. ``max_tokens_per_run=500``; phase 1 spends 600.

    The assertion is the EXECUTOR ENTRY LOG, not the status column: a breaker that wrote
    ``cancelled`` and let phase 2 run would pass a status assertion and fail this one.
    """
    run_id = uuid.uuid4()
    pool = _RecordingPool(
        budget={"metadata": {"max_tokens_per_run": 500}}, rows=_rows(3)
    )
    redis = _FakeRedis()
    definition = build_workflow_definition(
        [{"phase_type": "llm_single", "prompt": f"p{i}"} for i in range(3)]
    )
    provider = _MeteredProvider(tokens_per_phase=600)

    with pytest.raises(CircuitBreakerTrippedError) as exc:
        await _drive(pool, redis, run_id, definition, provider.execute)

    assert exc.value.reason == REASON_TOKEN_BUDGET
    assert provider.entered == ["p0"], (
        "a phase executed AFTER the budget was exhausted — this is the runaway-cost "
        f"threat. entered={provider.entered!r}"
    )
    assert exc.value.details["cumulative_tokens"] == 600
    assert "circuit_breaker_tripped" in pool.audit_kinds()


@pytest.mark.asyncio
async def test_a_run_inside_its_budget_completes_all_phases_untouched(
    build_workflow_definition,
):
    """NON-VACUITY FOR THE WHOLE SECTION.

    Without this, every case above would pass on an engine that refused to run anything.
    """
    run_id = uuid.uuid4()
    pool = _RecordingPool(
        budget={"metadata": {"max_tokens_per_run": 100_000}}, rows=_rows(3)
    )
    definition = build_workflow_definition(
        [{"phase_type": "llm_single", "prompt": f"p{i}"} for i in range(3)]
    )
    provider = _MeteredProvider(tokens_per_phase=600)

    await _drive(pool, _FakeRedis(), run_id, definition, provider.execute)

    assert provider.entered == ["p0", "p1", "p2"]
    assert "circuit_breaker_tripped" not in pool.audit_kinds()
    assert "completed" in pool.finish_run_statuses()


@pytest.mark.asyncio
async def test_an_unarmed_run_is_byte_identical_to_the_shipped_path(
    build_workflow_definition,
):
    """NO metadata at all — every interactive run in the product today.

    A run with no limits must reach the success terminal having written no trip record
    and consulted no ceiling.
    """
    run_id = uuid.uuid4()
    pool = _RecordingPool(rows=_rows(2))  # fetchrow -> None, so no budget
    definition = build_workflow_definition(
        [{"phase_type": "llm_single", "prompt": f"p{i}"} for i in range(2)]
    )
    provider = _MeteredProvider(tokens_per_phase=10**7)

    await _drive(pool, _FakeRedis(), run_id, definition, provider.execute)

    assert provider.entered == ["p0", "p1"]
    assert pool.audit_kinds().count("circuit_breaker_tripped") == 0
    assert "completed" in pool.finish_run_statuses()


@pytest.mark.asyncio
async def test_the_ceiling_cannot_be_bypassed_by_a_phase_that_reports_no_usage(
    build_workflow_definition,
):
    """⚠ "UN-BYPASSABLE" IS THE THREAT'S OWN WORD, AND THIS IS ITS HONEST LIMIT.

    A phase that reports no usage cannot be BILLED — nothing measured it. What must
    still hold is that spend already recorded is not forgotten by a silent phase, and
    that the ceiling still fires the moment the total crosses. So: phase 1 bills 400
    against a 500 cap (under), phase 2 bills NOTHING (the silent one), phase 3 bills 400.
    The run must stop before phase 4 — the silent phase must not have reset anything.
    """
    run_id = uuid.uuid4()
    pool = _RecordingPool(
        budget={"metadata": {"max_tokens_per_run": 500}}, rows=_rows(4)
    )
    definition = build_workflow_definition(
        [{"phase_type": "llm_single", "prompt": f"p{i}"} for i in range(4)]
    )

    entered: list[str] = []

    async def _execute(phase, accumulated_outputs, ctx):
        entered.append(phase.slug)
        box = ctx.run_usage_box
        if phase.slug != "p1":  # p1 is the SILENT phase
            box["input_tokens"] = (box.get("input_tokens") or 0) + 200
            box["output_tokens"] = (box.get("output_tokens") or 0) + 200
        return {"text": "x"}

    with pytest.raises(CircuitBreakerTrippedError):
        await _drive(pool, _FakeRedis(), run_id, definition, _execute)

    assert entered == ["p0", "p1", "p2"], (
        "the silent phase reset the counter, or the ceiling did not fire on the "
        f"crossing. entered={entered!r}"
    )


@pytest.mark.asyncio
async def test_a_resumed_run_whose_budget_was_already_blown_executes_nothing(
    build_workflow_definition,
):
    """The boundary check is a HARD FLOOR, reached before any work on iteration one.

    ``max_duration_seconds=1`` with an anchor two hours old is the resume shape: the run
    has already used its whole wall clock, so nothing may execute at all.
    """
    run_id = uuid.uuid4()
    pool = _RecordingPool(
        budget={
            "metadata": {"max_duration_seconds": 1},
            "claimed_at": datetime.now(timezone.utc) - timedelta(hours=2),
        },
        rows=_rows(3),
    )
    definition = build_workflow_definition(
        [{"phase_type": "llm_single", "prompt": f"p{i}"} for i in range(3)]
    )
    provider = _MeteredProvider()

    with pytest.raises(CircuitBreakerTrippedError) as exc:
        await _drive(pool, _FakeRedis(), run_id, definition, provider.execute)

    assert exc.value.reason == REASON_MAX_DURATION
    assert provider.entered == [], (
        "a phase executed on a run whose wall clock had already expired before the "
        f"restart. entered={provider.entered!r}"
    )


@pytest.mark.asyncio
async def test_the_token_ceiling_is_reached_through_the_real_executor_seam(
    build_workflow_definition,
):
    """⚠ THE ONE CASE THAT DRIVES THE REAL EXECUTOR — the seam 204-02 widened.

    The engine cases above mock at ``_execute_phase``, so they prove the breaker acts on
    the box but not that anything FILLS it in production. This drives the shipped
    ``phase_types._exec_llm_agent`` against a patched ``run_task_sub_agent``, asserting
    the two ends of the new hand-off actually meet: the sub-agent RETURNS its totals
    (they were accumulated and persisted but never returned before this plan) and the
    executor folds them into ``ctx.run_usage_box``.
    """
    from app.services.harness import phase_types

    async def _fake_sub_agent(**kwargs):
        return {
            "sub_run_id": uuid.uuid4(),
            "summary": "the answer",
            "status": "completed",
            "source_refs": [],
            "citations": [],
            "similarity_scores": [],
            "input_tokens": 700,
            "output_tokens": 250,
        }

    ctx = type("C", (), {})()
    ctx.run_usage_box = {}
    ctx.user_settings = None
    ctx.thread_id = uuid.uuid4()
    ctx.redis = _FakeRedis()

    # ⚠ A REAL PARSED PhaseSpec, NOT A HAND-ROLLED STUB. The executor reads config
    # fields a stub silently lacks (`available_tools` among them), and a stub that
    # happened to satisfy today's reads would go stale the moment the executor grew one.
    definition = build_workflow_definition(
        [
            {
                "phase_type": "llm_agent",
                "prompt": "research the topic",
                "max_steps": 3,
                "available_tools": ["search_documents"],
            }
        ]
    )
    phase = definition.phases[0]

    with patch.object(phase_types, "run_task_sub_agent", _fake_sub_agent), \
         patch.object(phase_types, "_effective_model_checked", _amodel), \
         patch.object(phase_types, "_build_phase_tool_context", lambda *a, **k: ctx), \
         patch.object(phase_types, "_phase_tools_override", lambda *a, **k: None):
        await phase_types._exec_llm_agent(phase, {}, ctx)

    assert ctx.run_usage_box == {"input_tokens": 700, "output_tokens": 250}, (
        "the sub-agent's token totals did not reach the run-level box — the token half "
        f"of SCHED-02 is a ceiling nothing can raise. box={ctx.run_usage_box!r}"
    )

    b = CircuitBreaker(max_tokens=900)
    b.absorb_usage_box(ctx.run_usage_box)
    assert b.check_limits() == (True, REASON_TOKEN_BUDGET)


async def _amodel(*a, **k):
    return "gpt-4o-mini"


def test_run_task_sub_agent_returns_the_counts_it_has_always_measured():
    """A STRUCTURAL pin on the return-dict widening (the F7 precedent, same function).

    ⚠ ASSERTED OVER THE AST OF THE RETURN STATEMENT, not by calling the function — the
    real body needs a provider, a pool and a stream. What matters is that the two keys
    are in the returned mapping at all; before this plan the totals were accumulated and
    persisted to ``runs.input_tokens`` and then DISCARDED at the boundary.
    """
    from app.services import task_service

    tree = ast.parse(
        textwrap.dedent(inspect.getsource(task_service.run_task_sub_agent))
    )
    returns = [n for n in ast.walk(tree) if isinstance(n, ast.Return)]
    assert len(returns) == 1, f"expected one return, found {len(returns)}"
    keys = {
        k.value
        for k in returns[0].value.keys
        if isinstance(k, ast.Constant) and isinstance(k.value, str)
    }
    assert {"input_tokens", "output_tokens"} <= keys, (
        f"run_task_sub_agent does not hand back its token totals. keys={sorted(keys)}"
    )
    # NON-VACUITY: the extractor really is reading the shipped dict.
    assert "sub_run_id" in keys and "summary" in keys


# ═════════════════════════════════════════════════════════════════════════════
#  4. THREAT — Wall-Clock Stalls. The in-flight duration kill.
# ═════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_the_duration_watch_kills_a_hung_phase_mid_flight(
    build_workflow_definition,
):
    """THE THREAT'S OWN SCENARIO: a hanging request that never returns.

    Phase 1 sleeps for 60 seconds against a 1-second cap. The run must die WHILE that
    phase is blocked — not at a boundary it will never reach.

    ⚠ THE KILL ARRIVES THROUGH 204-01's BRAKE, NOT THROUGH THE SENTINEL. The sentinel
    trips; ``trip_breaker`` composes ``cancel_workflow_run_internals``; that broadcasts;
    the ``cancellation_watch`` on the same ``async with`` cancels the task. This case
    passes only if that whole chain is really connected — a fake Redis that recorded
    publishes without delivering them would fail it.
    """
    run_id = uuid.uuid4()
    pool = _RecordingPool(
        budget={
            "metadata": {"max_duration_seconds": 1},
            "claimed_at": datetime.now(timezone.utc),
        },
        rows=_rows(2),
    )
    redis = _FakeRedis()
    definition = build_workflow_definition(
        [{"phase_type": "llm_single", "prompt": f"p{i}"} for i in range(2)]
    )

    entered: list[str] = []
    finished: list[str] = []

    async def _hang(phase, accumulated_outputs, ctx):
        entered.append(phase.slug)
        await asyncio.sleep(60)
        finished.append(phase.slug)
        return {"text": "never"}

    with pytest.raises(asyncio.CancelledError):
        await asyncio.wait_for(
            _drive(pool, redis, run_id, definition, _hang), timeout=20.0
        )

    assert entered == ["p0"], f"entered={entered!r}"
    assert finished == [], (
        "the hung phase ran to completion — the wall-clock cap did not kill it"
    )
    assert "circuit_breaker_tripped" in pool.audit_kinds(), (
        f"no trip record for the duration kill. kinds={pool.audit_kinds()!r}"
    )
    from app.services.run_lifecycle import cancel_flag_key

    assert cancel_flag_key(run_id) in redis.store


@pytest.mark.asyncio
async def test_a_boundary_only_check_could_not_have_killed_the_hung_phase():
    """⚠ THE COUNTERFACTUAL, AS A CASE — why the sentinel is not optional.

    Driven directly against the primitive rather than the engine, so it states the
    property without depending on any of the engine wiring: with the sentinel absent, a
    body that outlives the deadline runs to completion and the breaker never trips. That
    is the "built, gated, green, structurally unreachable" shape a boundary-only cap has.
    """
    pool, redis, run_id = _RecordingPool(), _FakeRedis(), uuid.uuid4()
    b = CircuitBreaker(max_duration_seconds=1)

    # WITHOUT the watch: the body finishes and nothing has tripped.
    await asyncio.sleep(1.2)
    assert b.tripped is False
    assert pool.audit_kinds() == []
    # ...and a boundary check performed only AFTERWARDS would report the breach far too
    # late to have prevented anything.
    assert b.check_limits() == (True, REASON_MAX_DURATION)

    # WITH the watch, on a fresh breaker: the trip lands DURING the body.
    b2 = CircuitBreaker(max_duration_seconds=1)
    async with b2.duration_watch(pool, redis, run_id):
        await asyncio.sleep(2.0)
    assert b2.tripped is True, "the sentinel did not trip inside the body"


@pytest.mark.asyncio
async def test_the_duration_sentinel_is_torn_down_on_every_exit_path():
    """Threat: stranded tasks. Inherited discipline from ``cancellation_watch``."""
    pool, redis, run_id = _RecordingPool(), _FakeRedis(), uuid.uuid4()

    for path in ("normal", "exception", "cancelled"):
        b = CircuitBreaker(max_duration_seconds=300)
        before = set(asyncio.all_tasks())

        async def _body(_b=b):
            async with _b.duration_watch(pool, redis, run_id):
                during = set(asyncio.all_tasks()) - before
                assert len(during) >= 1, "no sentinel task — the case is vacuous"
                if path == "exception":
                    raise ValueError("boom")
                await asyncio.sleep(0.02)

        if path == "exception":
            with pytest.raises(ValueError):
                await _body()
        elif path == "cancelled":
            t = asyncio.create_task(_body())
            await asyncio.sleep(0.01)
            t.cancel()
            with pytest.raises(asyncio.CancelledError):
                await t
        else:
            await _body()

        await asyncio.sleep(0)
        leaked = [
            t for t in set(asyncio.all_tasks()) - before
            if not t.done() and "sentinel" in repr(t)
        ]
        assert leaked == [], f"a sentinel survived the {path} exit: {leaked!r}"


@pytest.mark.asyncio
async def test_a_disarmed_breaker_creates_no_sentinel_task():
    """A long run must not pay one task per phase for a cap nobody set."""
    pool, redis, run_id = _RecordingPool(), _FakeRedis(), uuid.uuid4()
    b = CircuitBreaker()
    before = set(asyncio.all_tasks())
    async with b.duration_watch(pool, redis, run_id):
        assert set(asyncio.all_tasks()) - before == set()


@pytest.mark.asyncio
async def test_the_deadline_is_absolute_across_phases_not_a_per_phase_timer():
    """⚠ A PER-PHASE TIMER WOULD LET AN N-PHASE RUN OUTLIVE AN N-TIMES DEADLINE.

    The context manager is re-entered every phase. Three consecutive entries, each
    shorter than the cap, must still trip once the CUMULATIVE elapsed crosses it.
    """
    pool, redis, run_id = _RecordingPool(), _FakeRedis(), uuid.uuid4()
    b = CircuitBreaker(max_duration_seconds=1)
    for _ in range(3):
        if b.tripped:
            break
        async with b.duration_watch(pool, redis, run_id):
            await asyncio.sleep(0.5)
    assert b.tripped is True, (
        "three 0.5s phases under a 1s run cap did not trip — the deadline is being "
        "restarted per phase instead of measured from the run's anchor"
    )


# ═════════════════════════════════════════════════════════════════════════════
#  5. The lie a trip must never tell
# ═════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_a_tripped_run_never_reports_completed(build_workflow_definition):
    """⚠ THE 204-01 FINDING, ENFORCED ONE PLAN OVER.

    ``run_workflow``'s ``while`` loop does not fall through to nothing: after it come
    ``finish_run(pool, run_id, "completed")``, a ``run_completed`` audit row,
    ``_surface_final_answer`` and a ``run_completed`` SSE frame. A breaker that used
    ``break`` would kill a run for overspending and then tell the browser it succeeded —
    the Phase-200 "a paused run claimed it had finished" shape, introduced by the fix for
    exactly that class of lie.
    """
    run_id = uuid.uuid4()
    pool = _RecordingPool(
        budget={"metadata": {"max_tokens_per_run": 100}}, rows=_rows(2)
    )
    definition = build_workflow_definition(
        [{"phase_type": "llm_single", "prompt": f"p{i}"} for i in range(2)]
    )

    with pytest.raises(CircuitBreakerTrippedError):
        await _drive(pool, _FakeRedis(), run_id, definition, _MeteredProvider().execute)

    statuses = pool.finish_run_statuses()
    assert "cancelled" in statuses, f"the run was never cancelled. statuses={statuses!r}"
    assert "completed" not in statuses, (
        "a run killed by its circuit breaker reported COMPLETED — this is the exact lie "
        f"204-01 measured `break` producing. statuses={statuses!r}"
    )
    assert "run_completed" not in pool.audit_kinds(), (
        f"a run_completed audit row was written for a tripped run: {pool.audit_kinds()!r}"
    )


@pytest.mark.asyncio
async def test_the_trip_raises_from_outside_the_phase_escape_arm(
    build_workflow_definition,
):
    """⚠ THE SHIPPED 194 FENCE COUNTS ``cancel_phase`` CALL SITES AND REQUIRES ONE.

    If the breaker raised from INSIDE the phase ``try``, the escape arm would run — and
    204-01 measured that adding a second ``cancel_phase`` call turns
    ``test_the_cancel_arm_is_the_harness_engines_alone_and_deep_never_enters_it`` red. It
    also flips a phase row that legitimately COMPLETED to ``cancelled``.

    Asserted behaviourally: the completed phase keeps its ``completed`` write and no
    ``workflow_phases`` cancel is issued for it.
    """
    run_id = uuid.uuid4()
    pool = _RecordingPool(
        budget={"metadata": {"max_tokens_per_run": 100}}, rows=_rows(2)
    )
    definition = build_workflow_definition(
        [{"phase_type": "llm_single", "prompt": f"p{i}"} for i in range(2)]
    )

    with pytest.raises(CircuitBreakerTrippedError):
        await _drive(pool, _FakeRedis(), run_id, definition, _MeteredProvider().execute)

    phase_sql = [s for s in pool.sql_log() if "workflow_phases SET" in s]
    assert any("status='completed'" in s for s in phase_sql), (
        f"the phase that ran was not completed. sql={phase_sql!r}"
    )
    # The run-KEYED terminalize (cancel_active_phases) is expected and correct — it is
    # what `cancel_workflow_run_internals` owns. What must NOT appear is a second,
    # phase-keyed cancel from the escape arm.
    assert not any(
        "status='cancelled'" in s and "WHERE id = $1" in s for s in phase_sql
    ), (
        "a phase-keyed cancel_phase write was issued — the trip took the escape arm and "
        f"the 194 fence is now at 2 call sites. sql={phase_sql!r}"
    )


def test_the_engine_raises_the_breaker_error_and_does_not_break(
):
    """A STRUCTURAL pin on the keyword, because the behavioural case above cannot see it.

    ⚠ ``break`` AND ``return`` BOTH PRODUCE A GREEN BEHAVIOURAL RUN IN SOME SHAPES. The
    engine's budget helper must ``raise``; asserted over the AST of the helper itself so
    a later edit that softened it to a ``return`` is caught at author time.
    """
    from app.services import harness_engine

    tree = ast.parse(
        textwrap.dedent(inspect.getsource(harness_engine.run_workflow))
    )
    helper = next(
        n
        for n in ast.walk(tree)
        if isinstance(n, ast.AsyncFunctionDef) and n.name == "_enforce_budget"
    )
    raises = [
        n
        for n in ast.walk(helper)
        if isinstance(n, ast.Raise)
        and isinstance(n.exc, ast.Call)
        and getattr(n.exc.func, "id", None) == "CircuitBreakerTrippedError"
    ]
    assert len(raises) == 1, (
        "the budget helper no longer raises CircuitBreakerTrippedError — a `break` here "
        "runs straight into the success terminal (204-01, measured)."
    )
    assert not [n for n in ast.walk(helper) if isinstance(n, ast.Break)]


def test_the_breaker_error_is_not_a_cancelled_error():
    """It must not be catchable by the phase escape arm's CancelledError branch."""
    err = CircuitBreakerTrippedError(REASON_TOKEN_BUDGET, {"cumulative_tokens": 1})
    assert not isinstance(err, asyncio.CancelledError)
    assert err.reason == REASON_TOKEN_BUDGET
    assert err.details["cumulative_tokens"] == 1


# ═════════════════════════════════════════════════════════════════════════════
#  6. D-204-03 — one unified stop path, asserted structurally
# ═════════════════════════════════════════════════════════════════════════════


def test_the_breaker_composes_the_one_cancel_path_and_writes_no_status_of_its_own():
    """⚠ A BREAKER THAT CALLED ``finish_run`` WOULD GET THE COLUMN AND NONE OF THE HALT.

    The halt is the Redis broadcast + the producer brake, all of which live inside
    ``cancel_workflow_run_internals``. Asserted over the AST so the property is checked
    at author time rather than inferred from a passing behavioural run.
    """
    from app.services import circuit_breaker

    src = inspect.getsource(circuit_breaker)
    tree = ast.parse(src)
    called = {
        getattr(n.func, "id", None) or getattr(n.func, "attr", None)
        for n in ast.walk(tree)
        if isinstance(n, ast.Call)
    }
    assert "cancel_workflow_run_internals" in called, (
        "the breaker no longer composes the one cancel path (D-204-03)"
    )
    for forbidden in ("finish_run", "cancel_active_phases", "cancel_phase"):
        assert forbidden not in called, (
            f"the breaker calls {forbidden} directly — that is a SECOND stop path, and "
            "the two will drift (D-204-03)."
        )


@pytest.mark.asyncio
async def test_the_trip_broadcasts_on_the_same_redis_keys_a_human_stop_uses():
    """A cross-worker producer must not need to know a breaker exists."""
    from app.services.run_lifecycle import cancel_channel, cancel_flag_key

    pool, redis, run_id = _RecordingPool(), _FakeRedis(), uuid.uuid4()
    b = CircuitBreaker(max_tokens=1)
    b.record_tokens(9, 9)
    await b.trip_breaker(pool, redis, run_id, REASON_TOKEN_BUDGET)

    assert cancel_flag_key(run_id) in redis.store
    ps = redis.pubsub()
    await ps.subscribe(cancel_channel(run_id))  # the channel exists and is the same one
    assert cancel_channel(run_id) in ps.channels

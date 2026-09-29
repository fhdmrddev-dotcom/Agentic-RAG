"""Phase 268 (METER-08 / D-268-20 / SEED-297 trigger (d) FOLDED) — a Deep Continue ADDS, never replaces.

A Deep run that hits the iteration cap is finalized ``cap_paused`` with the paused segment's
tokens. ``POST /runs/{id}/continue`` re-drives the SAME ``run_id`` (no new row), and at base the
continuation's finalize wrote ONLY the continuation segment's totals — ``finalize_run``'s SQL is
an unconditional ``SET input_tokens = $6`` — so the paused segment's spend was ERASED. SC#1
names "paused/continued runs", so per-Expert spend would silently under-count every one.

The fix lives in ``spawn_continuation_run``: read the row's prior totals before the loop, and
fold them into the sink before ``_finalize_producer_run``. ``finalize_run``'s SQL is NOT edited
(that is SEED-297 trigger (a), a different decision).

Semantics (D-256-06): NULL + NULL stays NULL ("never measured" is not "zero"); otherwise a
missing half counts as 0.

Driven RED first against base, which finalizes the continuation's 30 / 10 alone.
"""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

import app.api.threads as threads_mod
import app.services.run_producer as rp

THREAD_ID = "33333333-3333-3333-3333-333333333333"


class _Pool:
    def __init__(self, prior):
        self.prior = prior
        self.reads: list[tuple] = []

    async def fetchrow(self, sql, *args):
        self.reads.append((sql, args))
        return self.prior


async def _drive(prior: dict | None, segment: tuple[int | None, int | None]) -> dict:
    """Run one continuation segment; return the kwargs the runs row was finalized with."""
    captured: dict = {}
    pool = _Pool(prior)
    tasks: dict = {}

    async def _loop(ctx, *, result_sink, **_kw):
        result_sink["input_tokens_total"] = segment[0]
        result_sink["output_tokens_total"] = segment[1]

    async def _terminal(**kw):
        captured.update(kw)

    async def _plain(_pool, **kw):
        captured.update(kw)

    redis = MagicMock()
    redis.zrange = AsyncMock(return_value=[])
    redis.expire = AsyncMock(return_value=True)

    settings = SimpleNamespace(llm_model="gpt-4o", active_provider="openai")
    with patch.object(threads_mod, "run_agent_loop", _loop), \
            patch.object(threads_mod, "get_pg_pool", AsyncMock(return_value=pool)), \
            patch.object(threads_mod, "load_user_settings", MagicMock(return_value=settings)), \
            patch.object(threads_mod, "finalize_run_terminal", _terminal), \
            patch.object(threads_mod, "finalize_run", _plain), \
            patch.object(threads_mod, "_emit", AsyncMock()), \
            patch.object(threads_mod, "_emit_terminal", AsyncMock()), \
            patch.object(threads_mod, "RUN_TASKS", tasks), \
            patch("app.services.todos_service.reconcile_open_todos_on_run_end", AsyncMock()), \
            patch.object(rp, "_resolve_thread_scoping",
                         AsyncMock(return_value=rp.ThreadScoping(None, None, None, None, None))):
        run_id = uuid4()
        await rp.spawn_continuation_run(
            run_id=run_id,
            thread_id=THREAD_ID,
            current_user={"id": "11111111-1111-1111-1111-111111111111"},
            redis=redis,
            supabase=MagicMock(),
            dropped_tool_calls=[],
        )
        await tasks[run_id]
    captured["_reads"] = pool.reads
    return captured


@pytest.mark.asyncio
async def test_a_continued_run_finalizes_the_SUM_of_both_segments():
    got = await _drive({"input_tokens": 100, "output_tokens": 40}, (30, 10))
    assert (got["input_tokens"], got["output_tokens"]) == (130, 50), (
        "the paused segment's tokens were erased — the continuation wrote only its own"
    )


@pytest.mark.asyncio
async def test_an_unmeasured_paused_segment_counts_as_zero_when_the_continuation_measured():
    got = await _drive({"input_tokens": None, "output_tokens": None}, (30, None))
    assert (got["input_tokens"], got["output_tokens"]) == (30, 0)


@pytest.mark.asyncio
async def test_null_plus_null_stays_null_never_zero():
    """D-256-06: 'never measured' must not be written as a measured zero."""
    got = await _drive({"input_tokens": None, "output_tokens": None}, (None, None))
    assert (got["input_tokens"], got["output_tokens"]) == (None, None)


@pytest.mark.asyncio
async def test_the_prior_totals_are_read_by_run_id_with_a_bound_parameter():
    got = await _drive({"input_tokens": 1, "output_tokens": 2}, (3, 4))
    reads = [r for r in got["_reads"] if "input_tokens" in r[0]]
    assert len(reads) == 1, "read the prior totals ONCE"
    sql, args = reads[0]
    assert "$1" in sql and "FROM runs" in " ".join(sql.split())
    assert len(args) == 1


def test_the_accumulation_rule_in_isolation():
    add = rp._accumulate_segment_tokens
    assert add(100, 40, 30, 10) == (130, 50)
    assert add(None, None, 30, None) == (30, 0)
    assert add(None, None, None, None) == (None, None)
    assert add(5, None, None, None) == (5, 0)

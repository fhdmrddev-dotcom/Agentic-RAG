"""Phase 292.1 UAT (2026-10-24, deepseek-v4-flash, run 5549031c) — a Deep Continue shows its progress.

The continuation XADDs to the SAME ``run:{run_id}`` buffer as the paused first segment, and that
buffer still holds the first segment's events AND its ``done`` sentinel (a first-turn pause
finalizes ``completed`` → sentinel → EXPIRE 600). ``replay_tail_consumer`` returns at the first
terminal it reads, and the stream wire carries no ``id:`` lines, so the browser has no offset of its
own: re-subscribing from ``0`` would replay the first segment and stop at its old ``done``.

So ``continue_run`` reads the buffer's tail id BEFORE it spawns the continuation and returns it as
``stream_since`` — every continuation event is XADDed after it. A buffer that already EXPIREd
answers ``"0"`` (the continuation re-creates the key). A failed read omits the field, which leaves
the browser exactly where it was before (no re-subscribe), and never fails the Continue.
The typed-continue door passes the same field through.
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest

import app.api.runs as runs_mod
from tests.unit.test_2921_continue_same_model import USER_ID, _Db, _row
from tests.unit.test_2921_typed_continue import RUN_ID, _paused, _send, _SendHarness


async def _deep_continue(tail):
    """One Deep Continue against a redis whose ``run:{id}`` tail read answers ``tail`` (a list of
    entries, or an exception). Returns (response, the order of tail-read vs spawn, redis)."""
    seen: list[str] = []
    redis = MagicMock(name="redis")

    async def _read(*_a, **_k):
        seen.append("read")
        if isinstance(tail, Exception):
            raise tail
        return tail

    redis.xrevrange = AsyncMock(side_effect=_read)
    spawn = AsyncMock(side_effect=lambda **_k: seen.append("spawn"))
    row = _row()
    db = _Db({"runs": row, "threads": {"active_workflow_run_id": None}})
    sb = db.client()
    with patch.object(runs_mod, "aexec", db.aexec), \
            patch.object(runs_mod.settings, "max_continues_per_run", 3), \
            patch("app.services.run_producer.spawn_continuation_run", spawn), \
            patch("app.db.runs.load_cap_paused_tool_calls", AsyncMock(return_value=[])), \
            patch("app.dependencies.get_pg_pool", AsyncMock(return_value=MagicMock())):
        res = await runs_mod.continue_run(
            run_id=UUID(row["run_id"]),
            current_user={"id": USER_ID},
            supabase=sb,
            service_supabase=sb,
            redis=redis,
        )
    return res, seen, redis


@pytest.mark.asyncio
async def test_a_deep_continue_returns_the_buffer_tail_read_before_the_spawn():
    res, seen, redis = await _deep_continue([(b"1729765841000-7", {b"data": b'{"type": "done"}'})])
    assert res["status"] == "ok"
    assert res["stream_since"] == "1729765841000-7"
    assert seen == ["read", "spawn"], "the tail is read BEFORE the continuation can XADD"
    args, kwargs = redis.xrevrange.await_args
    assert args[0] == f"run:{res['run_id']}"
    assert kwargs.get("count") == 1


@pytest.mark.asyncio
async def test_a_str_entry_id_is_returned_as_is():
    res, _seen, _redis = await _deep_continue([("1729765841000-0", {"data": "{}"})])
    assert res["stream_since"] == "1729765841000-0"


@pytest.mark.asyncio
async def test_an_expired_buffer_answers_zero():
    res, _seen, _redis = await _deep_continue([])
    assert res["stream_since"] == "0"


@pytest.mark.asyncio
async def test_a_failed_tail_read_omits_the_field_and_still_continues():
    res, seen, _redis = await _deep_continue(RuntimeError("redis down"))
    assert res["status"] == "ok"
    assert "stream_since" not in res
    assert seen == ["read", "spawn"]


# ── the typed-continue door passes it through ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_typed_continue_carries_stream_since():
    h = _SendHarness(latest_run=_paused(1), continue_result={
        "status": "ok", "run_id": RUN_ID, "continues_used": 2, "continues_remaining": 1,
        "stream_since": "1729765841000-7",
    })
    resp, *_ = await _send(h, "continue")
    assert resp.status_code == 200
    assert json.loads(resp.body)["stream_since"] == "1729765841000-7"


@pytest.mark.asyncio
async def test_a_typed_continue_without_it_stays_byte_identical():
    h = _SendHarness(latest_run=_paused(1))
    resp, *_ = await _send(h, "continue")
    assert "stream_since" not in json.loads(resp.body)

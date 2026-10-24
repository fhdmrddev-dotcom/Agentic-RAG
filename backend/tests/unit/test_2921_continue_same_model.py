"""Phase 292.1 (BUG-261024-03, orchestrator ruling 4 + SEED-324 folded) — a Continue resumes the
SAME run, on its OWN model and provider.

Before: ``spawn_continuation_run`` rebuilt the loop body from ``user_settings.llm_model`` /
``active_provider`` — the operator default — so a run started on DeepSeek via OpenRouter resumed
on whatever the default was, replaying a DeepSeek-parsed tool call to another provider.

Now ``continue_run`` reads ``model`` / ``provider`` off the run row and hands them to
``spawn_continuation_run``. A row without them (and the synthesized harness row) continues exactly
as before. A stored pair that can no longer be resolved (provider gone / no key, capability lookup
raising, registry row disabled) falls back to the settings pair with ONE warning — a Continue never
fails mid-run for this reason.

SEED-324: ``POST /runs/{id}/continue`` on a Deep run already in a terminal status is a 409 that
spawns nothing and counts nothing. ``cap_paused`` AND ``streaming`` are still accepted — the
cap_paused SSE event precedes the finalizer's status write, so a fast press legitimately sees
``streaming``.

292.1-REVIEW CR-01: a FIRST-turn pause finalizes as ``completed`` by design, so ``completed`` is a
409 only when the carrier-aware predicate (``app.db.runs.run_is_cap_paused``) says it is not paused.
"""
from __future__ import annotations

import asyncio
import logging
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

import app.api.runs as runs_mod
import app.api.threads as threads_mod
import app.services.run_producer as rp

THREAD_ID = "33333333-3333-3333-3333-333333333333"
USER_ID = "11111111-1111-1111-1111-111111111111"


# ── spawn_continuation_run ────────────────────────────────────────────────────────────────────


class _Pool:
    async def fetchrow(self, sql, *args):
        return {"input_tokens": None, "output_tokens": None}


def _settings(provider="openai", model="gpt-4o"):
    return SimpleNamespace(llm_model=model, active_provider=provider)


async def _spawn(*, override=None, capability=None, overrides=None, **kw) -> dict:
    """Run one continuation; return the RunContext the loop received + the mocks."""
    seen: dict = {}
    tasks: dict = {}

    async def _loop(ctx, *, result_sink, **_kw):
        seen["ctx"] = ctx

    redis = MagicMock()
    redis.zrange = AsyncMock(return_value=[])
    redis.expire = AsyncMock(return_value=True)

    base = _settings()
    override = override if override is not None else MagicMock(
        side_effect=lambda s, pid: SimpleNamespace(llm_model=s.llm_model, active_provider=pid))
    capability = capability if capability is not None else AsyncMock(return_value={"provider": "openrouter"})
    overrides = overrides if overrides is not None else AsyncMock(return_value={})
    with patch.object(threads_mod, "run_agent_loop", _loop), \
            patch.object(threads_mod, "get_pg_pool", AsyncMock(return_value=_Pool())), \
            patch.object(threads_mod, "load_user_settings", MagicMock(return_value=base)), \
            patch.object(threads_mod, "override_provider", override), \
            patch.object(threads_mod, "get_model_capability_async", capability), \
            patch.object(threads_mod, "load_all_model_overrides", overrides), \
            patch.object(threads_mod, "finalize_run_terminal", AsyncMock()), \
            patch.object(threads_mod, "finalize_run", AsyncMock()), \
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
            current_user={"id": USER_ID},
            redis=redis,
            supabase=MagicMock(),
            dropped_tool_calls=[],
            **kw,
        )
        await tasks[run_id]
    seen.update(run_id=run_id, override=override, capability=capability)
    return seen


@pytest.mark.asyncio
async def test_a_continuation_runs_on_the_runs_own_model_and_provider():
    got = await _spawn(model="deepseek/deepseek-v4-pro", provider="openrouter")
    ctx = got["ctx"]
    assert (ctx.body.model, ctx.body.provider) == ("deepseek/deepseek-v4-pro", "openrouter")
    assert (ctx.resolved_model, ctx.resolved_provider) == ("deepseek/deepseek-v4-pro", "openrouter")
    got["override"].assert_called_once()
    assert got["override"].call_args.args[1] == "openrouter"
    assert ctx.user_settings.active_provider == "openrouter"


@pytest.mark.asyncio
async def test_without_a_stored_pair_the_continuation_is_byte_identical():
    got = await _spawn()
    ctx = got["ctx"]
    assert (ctx.body.model, ctx.body.provider) == ("gpt-4o", "openai")
    assert (ctx.resolved_model, ctx.resolved_provider) == ("gpt-4o", "openai")
    got["override"].assert_not_called()
    got["capability"].assert_not_awaited()


@pytest.mark.asyncio
async def test_same_provider_does_not_override():
    got = await _spawn(model="gpt-5.5", provider="openai")
    ctx = got["ctx"]
    assert (ctx.resolved_model, ctx.resolved_provider) == ("gpt-5.5", "openai")
    got["override"].assert_not_called()


def _fallback_warnings(caplog):
    return [r for r in caplog.records
            if r.levelno == logging.WARNING and "cannot be resolved; continuing on" in r.getMessage()]


@pytest.mark.asyncio
async def test_an_unresolvable_provider_falls_back_with_one_warning(caplog):
    # override_provider returns its input unchanged: the provider is gone or has no key.
    with caplog.at_level(logging.WARNING):
        got = await _spawn(model="deepseek/deepseek-v4-pro", provider="openrouter",
                           override=MagicMock(side_effect=lambda s, pid: s))
    ctx = got["ctx"]
    assert (ctx.resolved_model, ctx.resolved_provider) == ("gpt-4o", "openai")
    assert (ctx.body.model, ctx.body.provider) == ("gpt-4o", "openai")
    warns = _fallback_warnings(caplog)
    assert len(warns) == 1
    msg = warns[0].getMessage()
    assert str(got["run_id"]) in msg and "openrouter" in msg and "openai" in msg


@pytest.mark.asyncio
async def test_a_model_whose_capability_lookup_raises_falls_back(caplog):
    with caplog.at_level(logging.WARNING):
        got = await _spawn(model="deepseek/deepseek-v4-pro", provider="openrouter",
                           capability=AsyncMock(side_effect=RuntimeError("gone")))
    ctx = got["ctx"]
    assert (ctx.resolved_model, ctx.resolved_provider) == ("gpt-4o", "openai")
    assert len(_fallback_warnings(caplog)) == 1


@pytest.mark.asyncio
async def test_a_model_disabled_in_the_registry_falls_back(caplog):
    disabled = AsyncMock(return_value={"deepseek/deepseek-v4-pro": {"enabled": False}})
    with caplog.at_level(logging.WARNING):
        got = await _spawn(model="deepseek/deepseek-v4-pro", provider="openrouter", overrides=disabled)
    ctx = got["ctx"]
    assert (ctx.resolved_model, ctx.resolved_provider) == ("gpt-4o", "openai")
    assert len(_fallback_warnings(caplog)) == 1


# ── continue_run: the carry + SEED-324 ────────────────────────────────────────────────────────


class _Builder:
    def __init__(self, table):
        self.table = table
        self.update_payload = None

    def select(self, *_a, **_k):
        return self

    def update(self, payload):
        self.update_payload = payload
        return self

    def eq(self, col=None, val=None, *_a, **_k):
        self.filters = {**getattr(self, "filters", {}), col: val}
        return self

    def maybe_single(self):
        return self

    def single(self):
        return self


class _Db:
    def __init__(self, data: dict):
        self.data = data
        self.updates: list[tuple[str, dict]] = []

    def client(self):
        db = self
        c = MagicMock()
        c.table.side_effect = lambda name: _Builder(name)
        c._db = db
        return c

    async def aexec(self, builder):
        await asyncio.sleep(0)  # a real round trip yields: lets two requests interleave
        if builder.update_payload is not None:
            stored = self.data.get(builder.table)
            filters = getattr(builder, "filters", {})
            # A filter on a column the stored row carries must match it (the CAS on the counter).
            if isinstance(stored, dict) and any(
                    k in stored and stored[k] != v for k, v in filters.items() if k == "continues_used"):
                return SimpleNamespace(data=[])
            self.updates.append((builder.table, builder.update_payload))
            if isinstance(stored, dict):
                stored.update(builder.update_payload)
            return SimpleNamespace(data=[{}])
        stored = self.data.get(builder.table)
        return SimpleNamespace(data=dict(stored) if isinstance(stored, dict) else stored)


async def _continue(run_row: dict, *, paused: bool = False,
                    paused_mock: AsyncMock | None = None, presses: int = 1):
    """``paused`` is what the ONE pause predicate (``app.db.runs.run_is_cap_paused``) answers for
    the row — the carrier-aware read a first-turn ``completed`` pause needs (292.1-REVIEW CR-01).
    ``presses`` > 1 drives that many Continues for the SAME run CONCURRENTLY (292.1-REVIEW WR-03);
    ``res`` is then the list of results."""
    db = _Db({"runs": run_row, "threads": {"active_workflow_run_id": None}})
    spawn = AsyncMock(return_value=None)
    sb = db.client()
    pred = paused_mock if paused_mock is not None else AsyncMock(return_value=paused)

    async def _one():
        try:
            return await runs_mod.continue_run(
                run_id=UUID(run_row["run_id"]),
                current_user={"id": USER_ID},
                supabase=sb,
                service_supabase=sb,
                redis=MagicMock(),
            )
        except HTTPException as exc:
            return exc

    with patch.object(runs_mod, "aexec", db.aexec), \
            patch("app.db.runs.run_is_cap_paused", pred), \
            patch.object(runs_mod.settings, "max_continues_per_run", 3), \
            patch("app.services.run_producer.spawn_continuation_run", spawn), \
            patch("app.db.runs.load_cap_paused_tool_calls", AsyncMock(return_value=[])), \
            patch("app.dependencies.get_pg_pool", AsyncMock(return_value=MagicMock())):
        if presses == 1:
            res = await _one()
        else:
            res = list(await asyncio.gather(*(_one() for _ in range(presses))))
    return spawn, db, res


def _row(status="cap_paused", **extra):
    return {"run_id": str(uuid4()), "status": status, "thread_id": THREAD_ID, "continues_used": 0,
            "org_id": None, **extra}


@pytest.mark.asyncio
async def test_continue_run_carries_the_rows_model_and_provider():
    spawn, _db, res = await _continue(_row(model="deepseek/deepseek-v4-pro", provider="openrouter"))
    spawn.assert_awaited_once()
    kw = spawn.await_args.kwargs
    assert (kw["model"], kw["provider"]) == ("deepseek/deepseek-v4-pro", "openrouter")
    assert res["status"] == "ok"


@pytest.mark.asyncio
async def test_a_row_without_model_passes_none():
    spawn, _db, _res = await _continue(_row())
    kw = spawn.await_args.kwargs
    assert kw["model"] is None and kw["provider"] is None


@pytest.mark.parametrize("status", ["failed", "completed", "cancelled", "timed_out"])
@pytest.mark.asyncio
async def test_a_finished_deep_run_is_refused_with_409_and_spawns_nothing(status):
    # ``completed`` here is a run that FINISHED: no cap carrier was written during it.
    spawn, db, res = await _continue(_row(status=status), paused=False)
    assert isinstance(res, HTTPException) and res.status_code == 409
    spawn.assert_not_awaited()
    assert db.updates == [], "a refused Continue must not count"


# ── 292.1-REVIEW CR-01: a FIRST-turn pause finalizes as ``completed`` BY DESIGN ───────────────
# (run_producer: the pause fact lives in result_sink["cap_disposition"] + the carrier row; Phase
# 250 LOCK-2 pins that). Measured locally: 0 rows ever read ``cap_paused``; every carrier-bearing
# first-turn run reads ``completed``. So the 409 must ask the carrier-aware predicate.


@pytest.mark.asyncio
async def test_a_first_turn_pause_finalized_completed_with_its_carrier_is_accepted():
    row = _row(status="completed", org_id="77777777-7777-7777-7777-777777777777")
    pred = AsyncMock(return_value=True)
    spawn, db, res = await _continue(row, paused_mock=pred)
    spawn.assert_awaited_once()
    assert res["status"] == "ok"
    assert db.updates and db.updates[0][1]["continues_used"] == 1
    pred.assert_awaited_once()
    args, kwargs = pred.await_args
    assert str(args[1]) == row["run_id"]
    assert str(kwargs["org_id"]) == row["org_id"], "the carrier read is org-scoped like the consume"


@pytest.mark.asyncio
async def test_a_completed_run_with_no_carrier_or_an_older_one_is_still_refused():
    spawn, db, res = await _continue(_row(status="completed"), paused=False)
    assert isinstance(res, HTTPException) and res.status_code == 409
    spawn.assert_not_awaited()
    assert db.updates == []


@pytest.mark.parametrize("status", ["failed", "cancelled", "timed_out"])
@pytest.mark.asyncio
async def test_a_failed_or_stopped_run_is_refused_without_asking_the_predicate(status):
    pred = AsyncMock(return_value=True)
    spawn, db, res = await _continue(_row(status=status), paused_mock=pred)
    assert isinstance(res, HTTPException) and res.status_code == 409
    pred.assert_not_awaited()
    spawn.assert_not_awaited()


@pytest.mark.parametrize("status", ["cap_paused", "streaming"])
@pytest.mark.asyncio
async def test_a_paused_or_still_finalizing_run_is_accepted(status):
    spawn, db, res = await _continue(_row(status=status))
    spawn.assert_awaited_once()
    assert res["status"] == "ok"
    assert db.updates and db.updates[0][1]["continues_used"] == 1


# ── 292.1-REVIEW WR-03: the Continue claim is a compare-and-set ───────────────────────────────


@pytest.mark.parametrize("status", ["cap_paused", "streaming"])
@pytest.mark.asyncio
async def test_two_concurrent_continues_on_one_pause_spawn_exactly_one_continuation(status):
    """The button and a typed "continue" (or a double press) for the SAME pause both read
    ``continues_used = 0``. Before: both UPDATEs matched, both spawned a loop on one run_id (the
    queued calls ran twice) and the counter advanced by 1, not 2."""
    row = _row(status=status)
    spawn, db, results = await _continue(row, presses=2)
    spawn.assert_awaited_once()
    oks = [r for r in results if isinstance(r, dict) and r.get("status") == "ok"]
    lost = [r for r in results if isinstance(r, HTTPException)]
    assert len(oks) == 1 and len(lost) == 1
    assert lost[0].status_code == 409 and lost[0].detail == runs_mod.CONTINUE_ALREADY_CLAIMED
    assert [u[1]["continues_used"] for u in db.updates] == [1], "ONE counted claim"


@pytest.mark.asyncio
async def test_the_counter_write_is_conditioned_on_the_value_it_read():
    import inspect
    src = inspect.getsource(runs_mod.continue_run)
    assert '.eq("continues_used", continues_used)' in src

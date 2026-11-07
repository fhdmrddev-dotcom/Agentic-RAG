"""Phase 308.1-03 (BUG-261107-01, D-11..D-15 / D-17) — the golden sweep: a golden run whose worker
died is re-driven or closed with a named cause, and a tail a dead worker never finished is finished
exactly once.

``resume_stranded_golden_runs`` runs FIRST inside the existing boot and late resume passes
(``main.py``), never through the generic resume path (``find_resumable_runs`` /
``_build_resume_context`` — the Phase 190 A4 fence, which stays green and unedited):

* arm A — every stranded ``active`` golden run is first claimed with ``claim_run`` (the same CAS
  the generic sweep uses). A lost claim does nothing. A run with no publish record (a pre-308.1
  orphan) is closed ``failed`` with words plus ONE ``publish_blocked`` receipt; one older than the
  publish budget is closed with the timeout words and gets the ``golden_run_timeout`` verdict;
  anything else is re-driven through ``spawn_attempt`` (never awaited by the sweep).
* arm B — each stranded tail is a spawned ``finish_attempt_tail(run_id, recovered=True)``.

A recovered tail reads ROWS, never in-memory drive state: after a flip that already happened it
records the success (Pitfall 7, never a false ``already_published``); a failed or cancelled run
with no failed step gets ``golden_run_error`` carrying the run's own recorded end reason
(Pitfall 8, never a fabricated exception text).

Database helpers, ``end_run`` and ``run_workflow`` are patched at their SOURCE modules (the code
under test imports them function-locally). The SQL is proven in ``test_308_1_golden_finders.py``.
"""

from __future__ import annotations

import ast
import asyncio
import contextlib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from app.services.harness import publish_service
from tests.unit.test_308_1_background_publish import _DEF_ID, _USER, _Env, _attempt

_MAIN = Path(__file__).resolve().parents[2] / "app" / "main.py"
_ATTEMPT = (
    Path(__file__).resolve().parents[2] / "app" / "services" / "harness" / "publish_attempt.py"
)


def _stranded(run_id, *, has_publish=True, created_ago=60.0) -> dict:
    return {
        "run_id": run_id,
        "definition_id": _DEF_ID,
        "user_id": UUID(_USER["id"]),
        "created_at": datetime.now(timezone.utc) - timedelta(seconds=created_ago),
        "has_publish": has_publish,
    }


@contextlib.contextmanager
def _sweep(stranded=(), tails=(), *, claim=True, order=None):
    """Patch the sweep's own reads and its claim; yield the mocks."""
    order = order if order is not None else []

    async def _claim(pool, run_id, lease):
        order.append(("claim_run", run_id))
        return claim

    with (
        patch("app.db.workflows.find_stranded_golden_runs",
              AsyncMock(return_value=list(stranded))) as f_runs,
        patch("app.db.workflows.find_stranded_publish_tails",
              AsyncMock(return_value=list(tails))) as f_tails,
        patch("app.db.workflows.claim_run", AsyncMock(side_effect=_claim)) as claim_run,
        patch("app.db.workflows.find_resumable_runs",
              AsyncMock(side_effect=AssertionError("generic resume finder used"))) as generic,
    ):
        yield {"runs": f_runs, "tails": f_tails, "claim_run": claim_run, "generic": generic,
               "order": order}


async def _drain():
    from app.services.harness import publish_attempt

    tasks = list(publish_attempt._BACKGROUND_TASKS)
    if tasks:
        await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), 3)
    return tasks


# ── arm A: claim first ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_lost_claim_does_nothing():
    from app.services.harness import publish_attempt

    run_id = uuid4()
    with (
        _sweep([_stranded(run_id), _stranded(uuid4(), has_publish=False)], claim=False) as m,
        patch("app.services.harness.run_handoff.end_run", AsyncMock(return_value=True)) as end,
        patch("app.db.workflows.write_audit", AsyncMock()) as audit,
        patch.object(publish_attempt, "spawn_attempt", MagicMock()) as spawn,
    ):
        acted = await publish_attempt.resume_stranded_golden_runs(pool=AsyncMock(), redis=None)
    assert acted == 0
    assert m["claim_run"].await_count == 2
    end.assert_not_awaited()
    audit.assert_not_awaited()
    spawn.assert_not_called()


@pytest.mark.asyncio
async def test_every_claim_uses_the_resume_lease():
    from app.config import settings
    from app.services.harness import publish_attempt

    run_id = uuid4()
    pool = AsyncMock()
    with (
        _sweep([_stranded(run_id)]) as m,
        patch.object(publish_attempt, "spawn_attempt", MagicMock()),
    ):
        await publish_attempt.resume_stranded_golden_runs(pool=pool, redis=None)
    assert m["claim_run"].await_args.args == (pool, run_id, settings.harness_resume_lease_seconds)
    assert m["runs"].await_args.args == (pool, settings.harness_resume_lease_seconds)


@pytest.mark.asyncio
async def test_an_orphan_with_no_record_is_closed_failed_with_words_and_one_receipt():
    """D-14: a pre-308.1 orphan is never left active — and the receipt names the run."""
    from app.services.harness import publish_attempt

    run_id = uuid4()
    order: list = []

    async def _end(pool, rid, status, **kw):
        order.append(("end_run", rid))
        return True

    with (
        _sweep([_stranded(run_id, has_publish=False)], order=order),
        patch("app.services.harness.run_handoff.end_run", AsyncMock(side_effect=_end)) as end,
        patch("app.db.workflows.write_audit", AsyncMock()) as audit,
        patch.object(publish_attempt, "spawn_attempt", MagicMock()) as spawn,
    ):
        acted = await publish_attempt.resume_stranded_golden_runs(pool=AsyncMock(), redis=None)
    assert acted == 1
    assert order == [("claim_run", run_id), ("end_run", run_id)]  # claimed BEFORE it is closed
    end.assert_awaited_once()
    assert end.await_args.args[1:] == (run_id, "failed")
    assert end.await_args.kwargs["reason"] == publish_attempt.NO_RECORD_WORDS
    assert end.await_args.kwargs["fail_active_phase"] is True
    assert "server restart" in publish_attempt.NO_RECORD_WORDS
    assert publish_attempt.NO_RECORD_WORDS.endswith("publish again")
    audit.assert_awaited_once()
    kw = audit.await_args.kwargs
    assert kw["event_type"] == "publish_blocked"
    assert audit.await_args.args[1] == run_id
    assert kw["metadata"]["blocked_stage"] == "golden_run_error"
    assert kw["metadata"]["golden_run_id"] == str(run_id)
    assert kw["metadata"]["named_failures"] == [publish_attempt.NO_RECORD_WORDS]
    spawn.assert_not_called()


@pytest.mark.asyncio
async def test_an_orphan_another_writer_already_ended_gets_no_receipt():
    from app.services.harness import publish_attempt

    with (
        _sweep([_stranded(uuid4(), has_publish=False)]),
        patch("app.services.harness.run_handoff.end_run", AsyncMock(return_value=False)),
        patch("app.db.workflows.write_audit", AsyncMock()) as audit,
    ):
        await publish_attempt.resume_stranded_golden_runs(pool=AsyncMock(), redis=None)
    audit.assert_not_awaited()


@pytest.mark.asyncio
async def test_an_attempt_past_the_publish_budget_is_closed_with_the_timeout_words():
    from app.config import settings
    from app.services.harness import publish_attempt
    from app.services.harness.run_handoff import golden_end_reason

    run_id = uuid4()
    with (
        patch.object(settings, "harness_publish_max_seconds", 60),
        _sweep([_stranded(run_id, created_ago=120)]),
        _Env(run_id, attempt=_attempt(run_id, created_ago=120)) as env,
        patch.object(publish_attempt, "spawn_attempt", MagicMock()) as spawn,
    ):
        acted = await publish_attempt.resume_stranded_golden_runs(pool=AsyncMock(), redis=None)
    assert acted == 1
    spawn.assert_not_called()
    env.run_workflow.assert_not_awaited()
    env.end_run.assert_awaited_once()
    assert env.end_run.await_args.kwargs["reason"] == golden_end_reason(asyncio.TimeoutError())
    verdict = env.verdict_written()  # recorded ON THE ROW, once
    assert verdict["blocked_stage"] == "golden_run_timeout"
    assert verdict["named_failures"] == [
        "the golden run exceeded the publish budget (60s) and was abandoned"
    ]
    assert verdict["golden_run_id"] == str(run_id)


@pytest.mark.asyncio
async def test_a_stranded_attempt_is_re_driven_and_the_sweep_never_awaits_it():
    from app.services.harness import publish_attempt

    run_id = uuid4()
    pool, redis = AsyncMock(), object()
    with (
        _sweep([_stranded(run_id)]),
        patch("app.services.harness.run_handoff.end_run", AsyncMock()) as end,
        patch.object(publish_attempt, "spawn_attempt", MagicMock()) as spawn,
    ):
        acted = await publish_attempt.resume_stranded_golden_runs(pool=pool, redis=redis)
    assert acted == 1
    spawn.assert_called_once_with(run_id, pool=pool, redis=redis)
    end.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_re_driven_attempt_runs_through_the_golden_ctx_with_no_org():
    """D-15 / T-308.1-12: the re-drive's ctx is THE golden ctx — an external action records,
    never sends. Driven end to end through the REAL spawn_attempt -> _attempt_task."""
    from app.services.harness import publish_attempt

    run_id = uuid4()
    order: list = []
    with _Env(run_id) as env, _sweep([_stranded(run_id)], order=order) as m:
        original = env.run_workflow.side_effect

        async def _record_order(*a, **kw):
            order.append(("run_workflow", run_id))
            return await original(*a, **kw)

        env.run_workflow.side_effect = _record_order
        acted = await publish_attempt.resume_stranded_golden_runs(pool=AsyncMock(), redis=None)
        assert acted == 1
        assert len(await _drain()) == 1
    ctx = env.captured_ctx
    assert ctx is not None
    assert ctx.is_golden_run is True
    assert not hasattr(ctx, "org_id")
    assert order == [("claim_run", run_id), ("run_workflow", run_id)]
    m["generic"].assert_not_awaited()
    env.tail.assert_awaited_once()  # the re-drive finishes its own publish


@pytest.mark.asyncio
async def test_one_failing_run_does_not_stop_the_sweep():
    from app.services.harness import publish_attempt

    bad, good = uuid4(), uuid4()
    with (
        _sweep([_stranded(bad, has_publish=False), _stranded(good)]),
        patch("app.services.harness.run_handoff.end_run",
              AsyncMock(side_effect=RuntimeError("db down"))),
        patch.object(publish_attempt, "spawn_attempt", MagicMock()) as spawn,
    ):
        await publish_attempt.resume_stranded_golden_runs(pool=AsyncMock(), redis=None)
    spawn.assert_called_once()
    assert spawn.call_args.args == (good,)


# ── arm B: stranded tails ───────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_stranded_tail_is_a_spawned_recovered_tail():
    from app.services.harness import publish_attempt

    run_id = uuid4()
    pool = AsyncMock()
    with (
        _sweep(tails=[{"run_id": run_id, "status": "completed", "state": "running"}]) as m,
        patch.object(publish_attempt, "finish_attempt_tail", AsyncMock()) as tail,
    ):
        acted = await publish_attempt.resume_stranded_golden_runs(pool=pool, redis=None)
        assert acted == 1
        assert len(await _drain()) == 1
    tail.assert_awaited_once_with(run_id, pool=pool, recovered=True)
    m["claim_run"].assert_not_awaited()  # a terminal run is never claim_run'd


@pytest.mark.asyncio
async def test_the_sweep_never_touches_the_generic_resume_path():
    from app.services import harness_engine
    from app.services.harness import publish_attempt

    with (
        _sweep([_stranded(uuid4())], tails=[{"run_id": uuid4()}]) as m,
        patch.object(harness_engine, "_build_resume_context",
                     MagicMock(side_effect=AssertionError("generic ctx builder used"))) as ctx,
        patch.object(publish_attempt, "spawn_attempt", MagicMock()),
        patch.object(publish_attempt, "finish_attempt_tail", AsyncMock()),
    ):
        await publish_attempt.resume_stranded_golden_runs(pool=AsyncMock(), redis=None)
        await _drain()
    m["generic"].assert_not_awaited()
    ctx.assert_not_called()
    # The module docstring NAMES them to forbid them; no code may call them.
    calls = [
        n for n in ast.walk(ast.parse(_ATTEMPT.read_text(encoding="utf-8")))
        if isinstance(n, ast.Call)
        and getattr(n.func, "id", getattr(n.func, "attr", None))
        in ("find_resumable_runs", "_build_resume_context")
    ]
    assert calls == []


# ── recovered tails read rows (Pitfall 7 / Pitfall 8) ───────────────────────────────────────────


@contextlib.contextmanager
def _recovered(run_id, *, status="completed", phases=None, definition=None, receipts=None):
    attempt = _attempt(run_id)
    attempt["status"] = status
    receipts = receipts or {}

    async def _receipt(pool, rid, event_type):
        return receipts.get(event_type)

    with (
        _Env(run_id, attempt=attempt, phases=phases) as env,
        patch("app.db.workflows.get_definition",
              AsyncMock(return_value=definition or {"status": "draft", "version": 1,
                                                    "created_by": UUID(_USER["id"])})) as get_def,
        patch("app.db.workflows.find_publish_receipt",
              AsyncMock(side_effect=_receipt)) as find_receipt,
        patch("app.db.workflows.publish_definition", AsyncMock(return_value=-1)) as flip,
        patch.object(publish_service, "_judge_golden_output", AsyncMock()) as judge,
    ):
        env.get_def, env.find_receipt, env.flip, env.judge = get_def, find_receipt, flip, judge
        yield env


@pytest.mark.asyncio
async def test_a_recovered_tail_after_the_flip_records_the_success_not_already_published():
    """Pitfall 7 / T-308.1-15: the dead worker flipped the draft and wrote its receipt, then died
    before recording ``done``. Re-judging would flip again, get -1 and record a FALSE
    ``already_published`` for a publish this very attempt made."""
    from app.services.harness import publish_attempt

    run_id = uuid4()
    with _recovered(
        run_id,
        definition={"status": "published", "version": 7, "created_by": UUID(_USER["id"])},
        receipts={"publish_succeeded": {"version": 4, "golden_run_id": "x"}},
    ) as env:
        verdict = await publish_attempt.finish_attempt_tail(
            run_id, pool=AsyncMock(), recovered=True
        )
    assert verdict == {"published": True, "version": 4, "golden_run_id": run_id}
    assert env.verdict_written() == {"published": True, "version": 4, "golden_run_id": str(run_id)}
    env.tail.assert_not_awaited()
    env.judge.assert_not_awaited()
    env.flip.assert_not_awaited()
    env.write_audit.assert_not_awaited()  # no second receipt
    assert env.get_def.await_args.kwargs["user_id"] == UUID(_USER["id"])  # the record's author
    assert env.find_receipt.await_args.args[1:] == (run_id, "publish_succeeded")


@pytest.mark.asyncio
async def test_a_published_draft_without_this_runs_receipt_is_re_tailed_normally():
    from app.services.harness import publish_attempt

    run_id = uuid4()
    with _recovered(
        run_id, definition={"status": "published", "version": 7, "created_by": UUID(_USER["id"])}
    ) as env:
        await publish_attempt.finish_attempt_tail(run_id, pool=AsyncMock(), recovered=True)
    env.tail.assert_awaited_once()


@pytest.mark.asyncio
async def test_a_recovered_failed_run_with_no_failed_step_carries_its_recorded_end_reason():
    """Pitfall 8: no exception object survives a dead worker; the words are the run's own."""
    from app.services.harness import publish_attempt

    run_id = uuid4()
    reason = "The trial run stopped because of an error (ConnectionResetError)."
    phases = [{"phase_index": 0, "status": "active", "slug": "answer", "output": None}]
    with _recovered(
        run_id, status="failed", phases=phases, receipts={"run_failed": {"reason": reason}}
    ) as env:
        await publish_attempt.finish_attempt_tail(run_id, pool=AsyncMock(), recovered=True)
    verdict = env.verdict_written()
    assert verdict["blocked_stage"] == "golden_run_error"
    assert len(verdict["named_failures"]) == 1 and reason in verdict["named_failures"][0]
    assert verdict["golden_run_id"] == str(run_id)
    assert verdict["blocked_step"] is None
    env.tail.assert_not_awaited()
    env.judge.assert_not_awaited()
    env.flip.assert_not_awaited()
    assert env.find_receipt.await_args.args[1:] == (run_id, "run_failed")


@pytest.mark.asyncio
async def test_a_recovered_cancelled_run_with_nothing_recorded_never_invents_an_exception():
    from app.services.harness import publish_attempt
    from app.services.harness.run_handoff import golden_end_reason

    run_id = uuid4()
    with _recovered(run_id, status="cancelled", phases=[]) as env:
        await publish_attempt.finish_attempt_tail(run_id, pool=AsyncMock(), recovered=True)
    verdict = env.verdict_written()
    assert verdict["blocked_stage"] == "golden_run_error"
    assert golden_end_reason(None) in verdict["named_failures"][0]
    assert "Error:" not in verdict["named_failures"][0]


@pytest.mark.asyncio
async def test_a_recovered_run_ended_by_its_time_limit_is_a_timeout_verdict():
    from app.config import settings
    from app.services.harness import publish_attempt
    from app.services.harness.run_handoff import golden_end_reason

    run_id = uuid4()
    with (
        patch.object(settings, "harness_publish_max_seconds", 90),
        _recovered(run_id, status="failed", phases=[],
                   receipts={"run_failed": {"reason": golden_end_reason(asyncio.TimeoutError())}})
        as env,
    ):
        await publish_attempt.finish_attempt_tail(run_id, pool=AsyncMock(), recovered=True)
    verdict = env.verdict_written()
    assert verdict["blocked_stage"] == "golden_run_timeout"
    assert verdict["named_failures"] == [
        "the golden run exceeded the publish budget (90s) and was abandoned"
    ]


@pytest.mark.asyncio
async def test_a_recovered_failed_run_with_a_failed_step_takes_the_structural_gate_path():
    from app.services.harness import publish_attempt

    run_id = uuid4()
    phases = [{"phase_index": 0, "status": "failed", "slug": "answer",
               "output": {"_failure_reason": "gate failed"}}]
    with _recovered(run_id, status="failed", phases=phases) as env:
        await publish_attempt.finish_attempt_tail(run_id, pool=AsyncMock(), recovered=True)
    env.tail.assert_awaited_once()
    assert env.tail.await_args.kwargs["terminal_status"] == "failed"
    env.find_receipt.assert_not_awaited()  # not published, so no receipt read is needed


@pytest.mark.asyncio
async def test_a_recovered_tail_whose_claim_is_lost_runs_nothing():
    from app.services.harness import publish_attempt

    run_id = uuid4()
    with _recovered(run_id) as env:
        env.claim.return_value = None
        assert await publish_attempt.finish_attempt_tail(
            run_id, pool=AsyncMock(), recovered=True
        ) is None
    env.get_def.assert_not_awaited()
    env.tail.assert_not_awaited()
    env.finish_attempt.assert_not_awaited()


# ── wiring: FIRST inside the existing boot + late passes, in its own try (D-13) ─────────────────


def _nested_function(tree, name):
    found = [
        n for n in ast.walk(tree) if isinstance(n, ast.AsyncFunctionDef) and n.name == name
    ]
    assert len(found) == 1, f"{name} must exist exactly once in main.py"
    return found[0]


def _call_names(node):
    return [
        getattr(n.func, "id", getattr(n.func, "attr", None))
        for n in ast.walk(node)
        if isinstance(n, ast.Call)
    ]


@pytest.mark.parametrize("pass_name", ["_resume_stranded", "_resume_stranded_late"])
def test_the_golden_sweep_runs_first_in_both_resume_passes_in_its_own_try(pass_name):
    tree = ast.parse(_MAIN.read_text(encoding="utf-8"))
    fn = _nested_function(tree, pass_name)
    src = ast.unparse(fn)
    golden = src.find("resume_stranded_golden_runs(")
    generic = src.find("resume_stranded_workflows(")
    assert golden != -1 and generic != -1, src
    assert golden < generic, "the golden sweep must run BEFORE the generic resume"
    # Its own try/except: a golden-sweep exception is logged and the generic resume still runs.
    own_try = [
        t for t in ast.walk(fn)
        if isinstance(t, ast.Try)
        and "resume_stranded_golden_runs" in _call_names(ast.Module(body=t.body, type_ignores=[]))
    ]
    assert len(own_try) == 1
    inner = own_try[0]
    assert "resume_stranded_workflows" not in _call_names(
        ast.Module(body=inner.body, type_ignores=[])
    )
    assert any(
        isinstance(h.type, ast.Name) and h.type.id == "Exception" for h in inner.handlers
    )
    assert any("exception" in _call_names(h) for h in inner.handlers)

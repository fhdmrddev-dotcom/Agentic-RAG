"""Phase 308.1-02 (BUG-261107-01, D-08 / D-09 / D-10 / D-15 / D-16 / D-17 / D-18) — the golden run
runs in the background, and exactly one worker finishes the publish when it ends.

Before this phase ``POST /workflows/{id}/publish`` held the request open for the whole golden run
(minutes, up to ``harness_publish_max_seconds``). A worker killed mid-run took the request, the
run and the verdict down together ("Failed to fetch", production 2026-11-07). Now:

* ``start_publish`` runs stages 0-2.6 exactly as the inline path, creates the golden run, records
  the attempt on the run row (``metadata.publish``), spawns the drive as a strong-referenced task
  and answers at once with a ``running`` handle (SC#1);
* the task re-reads everything it needs from that RECORD (never from request memory), drives the
  run through the ONE golden ctx builder, and on the way out claims the tail with the Postgres CAS;
  only the winner judges, flips and records the verdict (D-16 / D-17 / D-18);
* a graceful shutdown (deploy) leaves the run untouched for the next boot (Pitfall 9).

Every database helper and ``run_workflow`` is patched at its SOURCE module, which is where the code
under test imports it from (function-local imports). The SQL of the helpers is proven against a
real Postgres in ``test_308_1_publish_tail_claim.py``.
"""

from __future__ import annotations

import asyncio
import contextlib
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from app.services.harness import publish_service, publish_tail

_USER = {"id": str(uuid4())}
_DEF_ID = uuid4()


def _definition_dict(*, lint_clean: bool = True) -> dict:
    return {
        "slug": "qual-test",
        "version": 1,
        "name": "Quality Test Workflow",
        "status": "draft",
        "phases": [
            {
                "slug": "answer",
                "phase_index": 0 if lint_clean else 5,
                "config": {"phase_type": "llm_single", "prompt": "Answer the question."},
                "validators": [],
            }
        ],
        "business_requirement": "Deliver a cited answer.",
    }


def _definition_row(*, lint_clean: bool = True) -> dict:
    return {
        "id": _DEF_ID,
        "status": "draft",
        "token": "tok-STAGE0",
        "definition": _definition_dict(lint_clean=lint_clean),
        "created_by": UUID(_USER["id"]),
    }


def _attempt(run_id, *, created_ago: float = 0.0, token: str = "tok-REC") -> dict:
    return {
        "run_id": run_id,
        "thread_id": uuid4(),
        "definition_id": _DEF_ID,
        "user_id": UUID(_USER["id"]),
        "status": "active",
        "created_at": datetime.now(timezone.utc) - timedelta(seconds=created_ago),
        "inputs": {"kickoff_prompt": "AFM-0431"},
        "definition_snapshot": _definition_dict(),
        "publish": {
            "state": "running",
            "stage0_token": token,
            "golden_input": "AFM-0431",
            "definition_id": str(_DEF_ID),
            "requested_by": _USER["id"],
            "finishing_at": None,
            "verdict": None,
        },
    }


_PHASES = [{"phase_index": 0, "status": "completed", "output": {"text": "a grounded answer"}}]


def _fake_supabase():
    sb = MagicMock()
    sb.table.return_value.insert.return_value.execute.return_value = SimpleNamespace(
        data=[{"id": str(uuid4())}]
    )
    return sb


@contextlib.asynccontextmanager
async def _recording_lock(state: dict):
    state["held"] = True
    try:
        yield
    finally:
        state["held"] = False


class _Env:
    """The patch set shared by the attempt tests. ``run_workflow`` is replaced by ``drive``."""

    def __init__(self, run_id, *, drive=None, attempt=None, claim=True, phases=None):
        self.run_id = run_id
        self.captured_ctx = None
        self.drive = drive
        self.attempt = attempt or _attempt(run_id)
        self.claim_result = dict(self.attempt["publish"], state="finishing") if claim else None
        self.phases = _PHASES if phases is None else phases
        self.stack = contextlib.ExitStack()

    async def _run_workflow(self, run_id, definition, ctx, **kw):
        self.captured_ctx = ctx
        if self.drive is not None:
            await self.drive()

    def __enter__(self):
        p = self.stack.enter_context
        self.load = p(patch("app.db.workflows.load_publish_attempt",
                            AsyncMock(return_value=self.attempt)))
        self.resolve = p(patch.object(publish_service, "_resolve_publish_supabase",
                                      AsyncMock(return_value=(_fake_supabase(), uuid4()))))
        p(patch("app.models.user_settings.load_user_settings", MagicMock(return_value=None)))
        self.insert_run = p(patch("app.db.runs.insert_run", AsyncMock()))
        self.finalize_run = p(patch("app.db.runs.finalize_run", AsyncMock()))
        self.run_workflow = p(patch("app.services.harness_engine.run_workflow",
                                    AsyncMock(side_effect=self._run_workflow)))
        self.load_phases = p(patch("app.db.workflows.load_run_phases",
                                   AsyncMock(return_value=self.phases)))
        self.finish_golden = p(patch("app.services.harness.run_handoff.finish_golden_run",
                                     AsyncMock(return_value=True)))
        self.end_run = p(patch("app.services.harness.run_handoff.end_run",
                               AsyncMock(return_value=True)))
        self.claim = p(patch("app.db.workflows.claim_publish_tail",
                             AsyncMock(return_value=self.claim_result)))
        self.finish_attempt = p(patch("app.db.workflows.finish_publish_attempt",
                                      AsyncMock(return_value=True)))
        self.write_audit = p(patch("app.db.workflows.write_audit", AsyncMock()))
        self.tool_schemas = p(patch.object(publish_service, "_bound_tool_schemas",
                                           AsyncMock(return_value={})))
        self.tail = p(patch.object(publish_service, "run_tail_stages", AsyncMock(
            return_value={"published": True, "version": 3, "golden_run_id": self.run_id})))
        self.shutting = p(patch("app.services.harness_engine.is_app_shutting_down",
                                MagicMock(return_value=False)))
        return self

    def __exit__(self, *exc):
        return self.stack.__exit__(*exc)

    def verdict_written(self) -> dict:
        assert self.finish_attempt.await_count == 1
        args = self.finish_attempt.await_args
        return args.args[2] if len(args.args) > 2 else args.kwargs["verdict"]


# ── start_publish: the pre-run answers are untouched (D-07) ─────────────────────────────────────


@pytest.mark.asyncio
async def test_a_pre_run_block_is_returned_as_is_and_starts_nothing():
    from app.services.harness import publish_attempt

    before = set(publish_attempt._BACKGROUND_TASKS)
    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=_definition_row(lint_clean=False))),
        patch("app.db.workflows.write_audit", AsyncMock()),
        patch("app.db.workflows.create_workflow_run", AsyncMock()) as create,
        patch.object(publish_attempt, "begin_background_attempt", AsyncMock()) as begin,
    ):
        result = await publish_service.start_publish(
            definition_id=_DEF_ID, golden_input="x", user=_USER, pool=AsyncMock(), redis=AsyncMock()
        )
    assert result["blocked_stage"] == "lint"
    assert "state" not in result
    create.assert_not_awaited()
    begin.assert_not_awaited()
    assert set(publish_attempt._BACKGROUND_TASKS) == before


@pytest.mark.asyncio
async def test_not_found_is_returned_as_is():
    with patch("app.db.workflows.get_definition", AsyncMock(return_value=None)):
        result = await publish_service.start_publish(
            definition_id=_DEF_ID, golden_input="x", user=_USER, pool=AsyncMock(), redis=AsyncMock()
        )
    assert result == {
        "published": False,
        "blocked_stage": "not_found",
        "named_failures": ["workflow not found"],
        "golden_run_id": None,
    }


# ── start_publish: the happy path answers at once with a handle (SC#1, D-08, D-09) ─────────────


@pytest.mark.asyncio
async def test_start_publish_answers_running_at_once_and_spawns_one_task():
    from app.services.harness import publish_attempt

    run_id = uuid4()
    never = asyncio.Event()
    lock_state: dict = {}
    with (
        _Env(run_id, drive=never.wait) as env,
        patch("app.db.workflows.get_definition", AsyncMock(return_value=_definition_row())),
        patch.object(publish_service, "_grounding_fidelity_failures", AsyncMock(return_value=[])),
        patch("app.db.workflows.publish_attempt_lock", lambda pool, d: _recording_lock(lock_state)),
        patch("app.db.workflows.active_publish_attempt", AsyncMock(return_value=None)),
        patch("app.db.workflows.create_workflow_run", AsyncMock(return_value=run_id)) as create,
        patch("app.db.workflows.write_publish_attempt", AsyncMock()) as write,
    ):
        result = await asyncio.wait_for(
            publish_service.start_publish(
                definition_id=_DEF_ID, golden_input="AFM-0431", user=_USER,
                pool=AsyncMock(), redis=AsyncMock(),
            ),
            timeout=1.0,
        )
        assert result == {
            "published": False,
            "blocked_stage": None,
            "named_failures": [],
            "golden_run_id": run_id,
            "state": "running",
        }
        create.assert_awaited_once()
        assert create.await_args.kwargs["is_golden_run"] is True
        write.assert_awaited_once()
        rec = write.await_args.args[2]
        assert write.await_args.args[1] == run_id
        assert rec == {
            "state": "running",
            "stage0_token": "tok-STAGE0",
            "golden_input": "AFM-0431",
            "definition_id": str(_DEF_ID),
            "requested_by": _USER["id"],
            "finishing_at": None,
            "verdict": None,
        }
        for v in rec.values():
            assert v is None or isinstance(v, (str, int, float, bool)), v

        tasks = [t for t in publish_attempt._BACKGROUND_TASKS if t.get_name() == f"publish-attempt-{run_id}"]
        assert len(tasks) == 1
        await asyncio.sleep(0.05)
        assert not tasks[0].done()  # the run is still going; the request did not wait for it
        env.claim.assert_not_awaited()
        # cleanup: stop the never-ending drive as a deploy would
        env.shutting.return_value = True
        tasks[0].cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await tasks[0]
    assert tasks[0] not in publish_attempt._BACKGROUND_TASKS  # the done-callback discarded it


@pytest.mark.asyncio
async def test_a_second_post_returns_the_running_attempt_and_creates_nothing():
    """D-10: one attempt per draft per user; the check ran inside the advisory lock."""
    existing = uuid4()
    lock_state: dict = {}
    seen_inside_lock: list = []

    async def _active(pool, **kw):
        seen_inside_lock.append(lock_state.get("held"))
        return {"run_id": existing, "state": "finishing", "created_at": datetime.now(timezone.utc)}

    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=_definition_row())),
        patch("app.db.workflows.write_audit", AsyncMock()),
        patch.object(publish_service, "_grounding_fidelity_failures", AsyncMock(return_value=[])),
        patch("app.db.workflows.publish_attempt_lock", lambda pool, d: _recording_lock(lock_state)),
        patch("app.db.workflows.active_publish_attempt", AsyncMock(side_effect=_active)),
        patch("app.db.workflows.create_workflow_run", AsyncMock()) as create,
        patch("app.db.workflows.write_publish_attempt", AsyncMock()) as write,
        patch.object(publish_tail, "_create_golden_run", AsyncMock()) as create_golden,
    ):
        result = await publish_service.start_publish(
            definition_id=_DEF_ID, golden_input="x", user=_USER, pool=AsyncMock(), redis=AsyncMock()
        )
    assert result == {
        "published": False,
        "blocked_stage": None,
        "named_failures": [],
        "golden_run_id": existing,
        "state": "finishing",
    }
    assert seen_inside_lock == [True]
    create.assert_not_awaited()
    create_golden.assert_not_awaited()
    write.assert_not_awaited()


# ── the attempt task ───────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_completed_drive_claims_the_tail_and_records_the_verdict_from_the_record():
    from app.models.harness import WorkflowDefinition
    from app.services.harness import publish_attempt

    run_id = uuid4()
    with _Env(run_id) as env:
        await asyncio.wait_for(
            publish_attempt._attempt_task(run_id, pool=AsyncMock(), redis=AsyncMock()), 2
        )
    env.claim.assert_awaited_once()
    env.tail.assert_awaited_once()
    kw = env.tail.await_args.kwargs
    assert kw["stage0_token"] == "tok-REC"  # from the RECORD, never request memory
    assert kw["golden_input"] == "AFM-0431"
    assert kw["user_id"] == UUID(_USER["id"])
    assert kw["definition_id"] == _DEF_ID
    assert isinstance(kw["definition"], WorkflowDefinition)
    assert kw["definition"].name == "Quality Test Workflow"
    assert kw["golden_run_id"] == run_id
    assert kw["final_output"] == publish_tail._deliverable_output(_PHASES)
    assert kw["terminal_status"] == "completed"
    assert kw["tool_schemas"] == {}
    verdict = env.verdict_written()
    assert verdict == {"published": True, "version": 3, "golden_run_id": str(run_id)}  # JSON-safe
    env.finish_golden.assert_awaited_once()  # the drive's own finally still ends the run row


@pytest.mark.asyncio
async def test_a_failed_phase_is_harvested_as_a_failed_terminal_status():
    from app.services.harness import publish_attempt

    run_id = uuid4()
    phases = [{"phase_index": 0, "status": "failed", "output": {"_failure_reason": "gate failed"}}]
    with _Env(run_id, phases=phases) as env:
        await publish_attempt._attempt_task(run_id, pool=AsyncMock(), redis=AsyncMock())
    assert env.tail.await_args.kwargs["terminal_status"] == "failed"
    assert env.tail.await_args.kwargs["final_output"] == {"_failure_reason": "gate failed"}


@pytest.mark.asyncio
async def test_a_lost_claim_runs_no_tail_and_writes_nothing():
    from app.services.harness import publish_attempt

    run_id = uuid4()
    with _Env(run_id, claim=False) as env:
        await publish_attempt._attempt_task(run_id, pool=AsyncMock(), redis=AsyncMock())
    env.claim.assert_awaited_once()
    env.tail.assert_not_awaited()
    env.write_audit.assert_not_awaited()
    env.finish_attempt.assert_not_awaited()


@pytest.mark.asyncio
async def test_the_first_drive_ctx_is_the_golden_ctx_with_no_org():
    """D-15 / T-308.1-05: the background drive builds its ctx through the ONE golden builder."""
    from app.services.harness import publish_attempt

    run_id = uuid4()
    with _Env(run_id) as env:
        await publish_attempt._attempt_task(run_id, pool=AsyncMock(), redis=AsyncMock())
    ctx = env.captured_ctx
    assert ctx is not None
    assert ctx.is_golden_run is True
    assert not hasattr(ctx, "org_id")
    assert ctx.run_id == run_id
    assert ctx.inputs == {"kickoff_prompt": "AFM-0431"}  # the stored inputs, decoded


@pytest.mark.asyncio
async def test_a_drive_error_records_golden_run_error_with_the_exception_type_and_run_id():
    from app.services.harness import publish_attempt

    run_id = uuid4()

    async def _boom():
        raise RuntimeError("boom")

    with _Env(run_id, drive=_boom) as env:
        await publish_attempt._attempt_task(run_id, pool=AsyncMock(), redis=AsyncMock())
    env.tail.assert_not_awaited()
    verdict = env.verdict_written()
    assert verdict["blocked_stage"] == "golden_run_error"
    assert any("RuntimeError: boom" in str(f) for f in verdict["named_failures"])
    assert verdict["golden_run_id"] == str(run_id)  # preserved on every failure (ledger invariant)
    env.finish_golden.assert_awaited_once()


@pytest.mark.asyncio
async def test_the_drive_is_bounded_by_the_remaining_publish_budget():
    from app.config import settings
    from app.services.harness import publish_attempt

    run_id = uuid4()
    never = asyncio.Event()
    with (
        _Env(run_id, drive=never.wait) as env,
        patch.object(settings, "harness_publish_max_seconds", 1),
    ):
        await asyncio.wait_for(
            publish_attempt._attempt_task(run_id, pool=AsyncMock(), redis=AsyncMock()), 3
        )
    verdict = env.verdict_written()
    assert verdict["blocked_stage"] == "golden_run_timeout"
    assert verdict["named_failures"] == [
        "the golden run exceeded the publish budget (1s) and was abandoned"
    ]
    assert verdict["golden_run_id"] == str(run_id)
    env.tail.assert_not_awaited()
    env.finish_golden.assert_awaited_once()  # the timeout cancel is NOT a shutdown


@pytest.mark.asyncio
async def test_an_attempt_already_past_its_budget_is_not_driven_at_all():
    from app.config import settings
    from app.services.harness import publish_attempt

    run_id = uuid4()
    with (
        _Env(run_id, attempt=_attempt(run_id, created_ago=120)) as env,
        patch.object(settings, "harness_publish_max_seconds", 60),
    ):
        env.attempt["run_id"] = run_id
        await publish_attempt._attempt_task(run_id, pool=AsyncMock(), redis=AsyncMock())
    env.run_workflow.assert_not_awaited()
    env.end_run.assert_awaited_once()  # the run row is ended with words, not left active
    assert env.verdict_written()["blocked_stage"] == "golden_run_timeout"


# ── graceful shutdown never writes the wrong ending (Pitfall 9 / T-308.1-11) ────────────────────


@pytest.mark.asyncio
async def test_a_shutdown_cancel_leaves_the_run_alone_and_runs_no_tail():
    from app.services.harness import publish_attempt

    run_id = uuid4()
    started = asyncio.Event()

    async def _drive():
        started.set()
        await asyncio.Event().wait()

    with _Env(run_id, drive=_drive) as env:
        task = asyncio.create_task(publish_attempt._attempt_task(run_id, pool=AsyncMock(), redis=AsyncMock()))
        await asyncio.wait_for(started.wait(), 1)
        env.shutting.return_value = True
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
    env.finish_golden.assert_not_awaited()
    env.claim.assert_not_awaited()
    env.tail.assert_not_awaited()
    env.finish_attempt.assert_not_awaited()


@pytest.mark.asyncio
async def test_drive_created_ends_the_run_on_a_cancel_that_is_not_a_shutdown():
    run_id = uuid4()

    async def _cancel():
        raise asyncio.CancelledError()

    with _Env(run_id, drive=_cancel) as env:
        ctx = SimpleNamespace(run_usage_box=None)
        with pytest.raises(asyncio.CancelledError):
            await publish_tail._drive_created(
                run_id=run_id, definition=MagicMock(), ctx=ctx, producer_id=uuid4(),
                user_id=UUID(_USER["id"]), pool=AsyncMock(), redis=AsyncMock(),
            )
        env.finish_golden.assert_awaited_once()
        env.finalize_run.assert_awaited_once()


@pytest.mark.asyncio
async def test_drive_created_skips_finish_golden_run_during_shutdown():
    run_id = uuid4()

    async def _cancel():
        raise asyncio.CancelledError()

    with _Env(run_id, drive=_cancel) as env:
        env.shutting.return_value = True
        ctx = SimpleNamespace(run_usage_box=None)
        with pytest.raises(asyncio.CancelledError):
            await publish_tail._drive_created(
                run_id=run_id, definition=MagicMock(), ctx=ctx, producer_id=uuid4(),
                user_id=UUID(_USER["id"]), pool=AsyncMock(), redis=AsyncMock(),
            )
        env.finish_golden.assert_not_awaited()
        env.finalize_run.assert_awaited_once()  # the producer shell is still terminalized


# ── D-18: one version on a pass, none on a judge failure ────────────────────────────────────────


async def _run_real_tail(judge_verdict):
    from app.services.harness import publish_attempt

    run_id = uuid4()
    with (
        _Env(run_id) as env,
        patch.object(publish_service, "_judge_golden_output", AsyncMock(return_value=judge_verdict)),
        patch("app.db.workflows.publish_definition", AsyncMock(return_value=4)) as flip,
    ):
        env.stack.enter_context(patch.object(publish_service, "run_tail_stages", publish_tail.run_tail_stages))
        await publish_attempt._attempt_task(run_id, pool=AsyncMock(), redis=AsyncMock())
    kinds = [c.kwargs["event_type"] for c in env.write_audit.await_args_list]
    return env, flip, kinds, run_id


@pytest.mark.asyncio
async def test_a_passing_tail_flips_exactly_once_with_the_recorded_token():
    env, flip, kinds, run_id = await _run_real_tail(
        {"overall_passed": True, "overall_score": 95, "summary": "good", "criteria": []}
    )
    flip.assert_awaited_once()
    assert flip.await_args.kwargs["token"] == "tok-REC"
    assert kinds.count("publish_succeeded") == 1
    assert kinds.count("publish_blocked") == 0
    verdict = env.verdict_written()
    assert verdict["published"] is True and verdict["version"] == 4
    assert verdict["golden_run_id"] == str(run_id)


@pytest.mark.asyncio
async def test_a_judge_failure_never_flips():
    env, flip, kinds, _ = await _run_real_tail(
        {"overall_passed": False, "overall_score": 10, "summary": "bad",
         "criteria": [{"criterion": "c", "passed": False, "score": 0, "evidence": "e"}]}
    )
    flip.assert_not_awaited()
    assert kinds.count("publish_blocked") == 1
    assert kinds.count("publish_succeeded") == 0
    assert env.verdict_written()["blocked_stage"] == "judge"


# ── the module's own fences ─────────────────────────────────────────────────────────────────────


def test_the_background_task_set_is_a_strong_reference_set():
    from app.services.harness import publish_attempt

    assert isinstance(publish_attempt._BACKGROUND_TASKS, set)


def test_publish_tail_never_imports_publish_attempt():
    """No cycle: publish_attempt imports publish_tail, never the other way round."""
    import ast
    import inspect

    tree = ast.parse(inspect.getsource(publish_tail))
    imported = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported |= {a.name for a in node.names}
        elif isinstance(node, ast.ImportFrom):
            imported.add(node.module or "")
            imported |= {f"{node.module}.{a.name}" for a in node.names}
    assert not any("publish_attempt" in name for name in imported), imported

"""Phase 300-01 Task 2 (FIX-05 / D-17, D-33, D-26; BUG-261027-05).

An API-key or scheduled run records the model and provider it STARTED on — the owner's resolved
pair at launch, through ONE helper (``resolve_owner_run_model``) — on ``workflow_runs.metadata``
and in the first drive's ctx dict, so the existing resume reader (``harness_engine``, never
edited here) continues on that provider. And a scheduled drive that ends with its run PAUSED
records ``waiting`` on the schedule, never ``completed`` (D-26).

Stubbed throughout: settings, the writer and the pool are fakes; nothing reaches Postgres.
"""
from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

BACKEND = Path(__file__).resolve().parents[2]


# ── resolve_owner_run_model ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_the_helper_returns_the_owners_model_and_active_provider():
    from app.services import run_model_resolution as rmr

    settings = SimpleNamespace(active_provider="anthropic")
    owner = uuid4()
    with (
        patch("app.models.user_settings.load_user_settings", return_value=settings) as load,
        patch("app.services.sub_agent_models.resolve_workflow_ctx_model",
              return_value="claude-opus-4-7") as ctx_model,
    ):
        out = await rmr.resolve_owner_run_model(owner)
    assert out == ("claude-opus-4-7", "anthropic")
    load.assert_called_once_with(str(owner))
    ctx_model.assert_called_once_with(settings)


@pytest.mark.asyncio
async def test_blank_values_read_none():
    from app.services import run_model_resolution as rmr

    with (
        patch("app.models.user_settings.load_user_settings",
              return_value=SimpleNamespace(active_provider="")),
        patch("app.services.sub_agent_models.resolve_workflow_ctx_model", return_value=""),
    ):
        assert await rmr.resolve_owner_run_model(uuid4()) == (None, None)


@pytest.mark.asyncio
async def test_a_failed_settings_load_is_none_none_and_never_raises(caplog):
    from app.services import run_model_resolution as rmr

    with patch("app.models.user_settings.load_user_settings",
               side_effect=RuntimeError("db down secret")):
        assert await rmr.resolve_owner_run_model(uuid4()) == (None, None)
    assert caplog.records, "the failure is logged"


def test_the_helper_is_exported():
    from app.services import run_model_resolution as rmr

    assert "resolve_owner_run_model" in rmr.__all__


# ── launch_unattended_run records the pair ──────────────────────────────────────────────────


async def _launch(pair):
    from app.services import unattended_launch

    supabase = MagicMock()
    supabase.table.return_value.insert.return_value.execute.return_value.data = [
        {"id": str(uuid4())}
    ]
    resolve = AsyncMock(return_value=pair)
    drive = AsyncMock()
    with (
        patch("app.dependencies.get_service_role_supabase", return_value=supabase),
        patch("app.db.workflows.create_workflow_run", AsyncMock(return_value=uuid4())) as create,
        patch("app.db.workflows.arm_run_budget", AsyncMock()),
        patch("app.services.run_model_resolution.resolve_owner_run_model", resolve),
        patch.object(unattended_launch, "_drive_run", drive),
    ):
        await unattended_launch.launch_unattended_run(
            owner_id=uuid4(), org_id=uuid4(), workflow_id=uuid4(), definition=MagicMock(),
            inputs={}, title="t", max_tokens=500_000, max_duration=1_800,
            pool=MagicMock(), redis=MagicMock(), origin_kind="key",
        )
    return resolve, create, drive


@pytest.mark.asyncio
async def test_the_launch_records_the_resolved_model_and_provider():
    resolve, create, drive = await _launch(("claude-opus-4-7", "anthropic"))
    resolve.assert_awaited_once()
    kw = create.call_args.kwargs
    assert (kw["model"], kw["provider"]) == ("claude-opus-4-7", "anthropic")
    dkw = drive.call_args.kwargs
    assert (dkw["model"], dkw["provider"]) == ("claude-opus-4-7", "anthropic")


@pytest.mark.asyncio
async def test_with_nothing_resolved_the_writer_call_is_todays():
    _, create, _ = await _launch((None, None))
    kw = create.call_args.kwargs
    assert kw["model"] is None
    assert kw.get("provider") is None


def test_the_helper_is_called_once_in_the_core_source():
    src = (BACKEND / "app" / "services" / "unattended_launch.py").read_text(encoding="utf-8")
    assert src.count("resolve_owner_run_model(") == 1
    assert "model=None," not in src


# ── the first drive's ctx dict ──────────────────────────────────────────────────────────────


async def _drive(model, provider):
    from app.services import unattended_launch

    build = AsyncMock(side_effect=RuntimeError("stop after the dict is captured"))
    finished = AsyncMock()
    with patch("app.services.harness_engine._build_resume_context", build):
        await unattended_launch._drive_run(
            run_id=uuid4(), thread_id=uuid4(), owner_id=uuid4(), org_id=None, inputs={},
            definition=object(), pool=MagicMock(), redis=MagicMock(), on_finish=finished,
            model=model, provider=provider,
        )
    return build.call_args.args[0], finished


@pytest.mark.asyncio
async def test_the_drive_dict_carries_the_model_and_the_provider():
    run, _ = await _drive("claude-opus-4-7", "anthropic")
    assert run["model"] == "claude-opus-4-7"
    assert run["metadata"] == {"provider": "anthropic"}


@pytest.mark.asyncio
async def test_no_provider_adds_no_metadata_key():
    run, finished = await _drive(None, None)
    assert "metadata" not in run
    assert not run.get("model")
    finished.assert_awaited_once_with("failed")


# ── D-26: a paused scheduled run reads "waiting" ────────────────────────────────────────────


class _StatusPool:
    def __init__(self, status=None, exc=None):
        self.status, self.exc, self.calls = status, exc, []

    async def fetchval(self, sql, *args):
        self.calls.append((sql, args))
        if self.exc:
            raise self.exc
        return self.status


async def _outcome(drive_status: str, pool) -> tuple[list, AsyncMock]:
    """Run launch_scheduled_run with a fake core that calls on_finish(drive_status)."""
    from app.services import scheduler_service
    from app.services.entitlement_service import EntitlementResult

    async def _core(**kw):
        await kw["on_finish"](drive_status)
        return uuid4()

    allowed = EntitlementResult(allowed=True, capability="workflows", current_tier="enterprise")
    schedule = {"id": uuid4(), "user_id": str(uuid4()), "workflow_id": str(uuid4()),
                "org_id": str(uuid4()), "name": "Weekly", "inputs": {}}
    with (
        patch("app.db.workflows.get_definition", new_callable=AsyncMock, return_value={
            "definition": {"slug": "s", "version": 1, "name": "W", "phases": []}}),
        patch("app.db.schedules.record_schedule_outcome", new_callable=AsyncMock) as record,
        patch("app.services.unattended_launch.launch_unattended_run", _core),
        patch("app.services.unattended_launch.workflows_disabled", return_value=False),
        patch("app.services.foreign_folder_refusal.foreign_binding_refusal",
              new_callable=AsyncMock, return_value=None),
        patch("app.services.entitlement_service.check_entitlement", new_callable=AsyncMock,
              return_value=allowed),
    ):
        await scheduler_service.launch_scheduled_run(schedule, pool=pool, redis=MagicMock())
    return [c.kwargs["status"] for c in record.await_args_list], schedule


@pytest.mark.asyncio
async def test_a_drive_that_ends_paused_records_waiting():
    pool = _StatusPool("paused")
    statuses, schedule = await _outcome("completed", pool)
    assert statuses == ["waiting"]
    sql, args = pool.calls[0]
    assert "inputs->>'_schedule_id'" in sql and "ORDER BY created_at DESC" in sql
    assert args == (str(schedule["id"]),)


@pytest.mark.asyncio
async def test_a_drive_that_ends_completed_records_completed():
    statuses, _ = await _outcome("completed", _StatusPool("completed"))
    assert statuses == ["completed"]


@pytest.mark.asyncio
async def test_a_failed_status_read_records_completed():
    statuses, _ = await _outcome("completed", _StatusPool(exc=RuntimeError("boom")))
    assert statuses == ["completed"]


@pytest.mark.asyncio
async def test_failed_is_recorded_as_is_with_no_read():
    pool = _StatusPool("paused")
    statuses, _ = await _outcome("failed", pool)
    assert statuses == ["failed"]
    assert pool.calls == []


# ── the API-key door inherits the fix, unedited ─────────────────────────────────────────────


def test_the_key_door_calls_the_shared_core():
    """The key door inherits the fix by calling the same core. That inbound.py, run_lifecycle.py,
    run_producer.py and harness_engine.py carry no 300-01 edit is checked once, at plan close,
    by ``git diff <plan-base> --stat`` (recorded in 300-01-SUMMARY.md) — a test pinned to a base
    SHA would go red on the next legitimate edit."""
    src = (BACKEND / "app" / "api" / "inbound.py").read_text(encoding="utf-8")
    assert "launch_unattended_run(" in src

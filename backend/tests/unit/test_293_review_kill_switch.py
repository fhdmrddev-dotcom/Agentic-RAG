"""293-REVIEW CR-01 — the operator's workflows kill switch stops BOTH unattended doors.

``workflows_enabled`` (FLAG-01, ``PUT /admin/flags``) gates NEW launches. Until this fix it was
enforced only at the in-app kickoff seam, so a key holder (n8n, Zapier, cron) and every schedule
kept starting runs after an operator flipped it off.

Pinned here:
  * the inbound start answers the in-app kickoff's own 403 sentence, writes ONE
    ``api_key.refused`` row (reason ``workflows_disabled``), and never reaches the core;
  * the shared core refuses BEFORE its thread insert, so any future unattended door inherits it;
  * a scheduled launch is refused with the sentence recorded on the schedule, and nothing is
    written (no thread, no run).

The flag is patched where the in-app seam reads it, ``app.api.threads.workflows_enabled``
(test_147's seam), so ONE patch covers every launch door.
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.db import api_keys as api_keys_db
from tests.unit.phase293_inbound_fakes import (
    DEFINITION,
    WF_ID,
    FakePool,
    FakeRedis,
    all_audits,
    audit_spies,
    build_app,
    make_key,
)

DISABLED = "Workflows are currently disabled by the administrator"
URL = f"/inbound/workflows/{WF_ID}/runs"


@pytest.fixture
def flag_off():
    with patch("app.api.threads.workflows_enabled", return_value=False) as p:
        yield p


def test_an_inbound_start_is_refused_403_and_audited_when_workflows_are_off(
    monkeypatch, flag_off,
):
    events: list = []
    pool = FakePool(events)
    now, later, _limiter = audit_spies(monkeypatch, events)

    async def _key_workflows(_pool, **_kw):
        return [{"id": UUID(WF_ID), "readable": True, "name": "Weekly digest",
                 "status": "published", "definition": json.dumps(DEFINITION)}]

    monkeypatch.setattr(api_keys_db, "get_key_workflows", _key_workflows)
    launch = AsyncMock(return_value=uuid4())
    monkeypatch.setattr("app.services.unattended_launch.launch_unattended_run", launch)
    monkeypatch.setattr(
        "app.services.entitlement_service.enforce_entitlement", AsyncMock(return_value=None)
    )
    client = TestClient(build_app(key=make_key(), pool=pool, redis=FakeRedis()))

    r = client.post(URL, json={"inputs": {"topic": "x"}})

    assert r.status_code == 403, r.text
    assert r.json() == {"detail": DISABLED}
    launch.assert_not_awaited()
    refusals = [a for a in all_audits(now, later) if a[0] == "api_key.refused"]
    assert len(refusals) == 1, refusals
    assert refusals[0][1]["reason"] == "workflows_disabled"
    assert refusals[0][1]["call"] == "start"


@pytest.mark.asyncio
async def test_the_shared_core_refuses_before_its_thread_insert(flag_off):
    from app.services import unattended_launch

    supabase = MagicMock()
    create = AsyncMock(return_value=uuid4())
    with (
        patch("app.dependencies.get_service_role_supabase", return_value=supabase),
        patch("app.db.workflows.create_workflow_run", create),
        patch("app.db.workflows.arm_run_budget", AsyncMock()),
        patch.object(unattended_launch, "_drive_run", AsyncMock()),
    ):
        with pytest.raises(unattended_launch.UnattendedLaunchDisabled) as info:
            await unattended_launch.launch_unattended_run(
                owner_id=uuid4(), org_id=uuid4(), workflow_id=uuid4(),
                definition=MagicMock(), inputs={}, title="t",
                max_tokens=500_000, max_duration=1_800,
                pool=MagicMock(), redis=MagicMock(),
            )
    assert str(info.value) == DISABLED
    supabase.table.assert_not_called()
    create.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_scheduled_launch_is_refused_with_the_sentence_and_writes_nothing(flag_off):
    from app.services import scheduler_service, unattended_launch

    schedule = {
        "id": str(uuid4()), "user_id": str(uuid4()), "org_id": str(uuid4()),
        "workflow_id": str(uuid4()), "name": "Nightly", "inputs": {},
        "max_tokens_per_run": 500_000, "max_duration_seconds": 1_800,
    }
    record = AsyncMock()
    core = AsyncMock(return_value=uuid4())
    get_def = AsyncMock(return_value={"definition": DEFINITION, "org_id": schedule["org_id"]})
    with (
        patch("app.db.schedules.record_schedule_outcome", record),
        patch("app.db.workflows.get_definition", get_def),
        patch.object(unattended_launch, "launch_unattended_run", core),
    ):
        with pytest.raises(scheduler_service.ScheduledLaunchRefused) as info:
            await scheduler_service.launch_scheduled_run(
                schedule, pool=MagicMock(), redis=MagicMock()
            )
    assert str(info.value) == DISABLED
    core.assert_not_awaited()
    get_def.assert_not_awaited()  # refused before any read of the workflow, like the in-app seam
    assert record.await_args.kwargs["status"] == DISABLED


@pytest.mark.asyncio
async def test_a_tick_with_workflows_off_launches_nothing_and_continues(flag_off, monkeypatch):
    from app.db import schedules as db_schedules
    from app.services import scheduler_service, unattended_launch

    claimed = [
        {"id": str(uuid4()), "user_id": str(uuid4()), "org_id": str(uuid4()),
         "workflow_id": str(uuid4()), "name": f"s{i}", "inputs": {}}
        for i in range(2)
    ]
    monkeypatch.setattr(db_schedules, "claim_due_schedules", AsyncMock(return_value=claimed))
    record = AsyncMock()
    monkeypatch.setattr(db_schedules, "record_schedule_outcome", record)
    core = AsyncMock(return_value=uuid4())
    monkeypatch.setattr(unattended_launch, "launch_unattended_run", core)

    svc = scheduler_service.SchedulerService(pool=MagicMock(), redis=MagicMock())
    assert await svc.tick() == 0
    core.assert_not_awaited()
    # Each refusal keeps its words; the tick never overwrites them with launch_failed.
    statuses = [c.kwargs["status"] for c in record.await_args_list]
    assert statuses == [DISABLED, DISABLED]

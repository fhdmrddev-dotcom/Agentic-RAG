"""Phase 210 Plan 02 unit tests — CONN-10 & CONN-11.

Verifies:
1. String-scalar definition deserialization guard in `launch_scheduled_run` (CONN-11).
2. Fallback to `row.org_id` when `schedule.org_id` is missing/null (CONN-11).
3. Legacy default budget lift (50k -> 500k, 600s -> 1800s) and custom budget preservation (CONN-10).
"""
import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.models.harness import WorkflowDefinition
from app.models.schedule import ScheduleTriggerResult, WorkflowScheduleCreate
from app.services.scheduler_service import launch_scheduled_run


@pytest.fixture(autouse=True)
def _entitled_org():
    """258 F-2: launch_scheduled_run now checks the workflows entitlement first; these
    tests exercise what happens AFTER an entitled launch, so the org is entitled here.
    The refusal arm is covered by test_258_workflow_execution_entitlement.py."""
    from app.services.entitlement_service import EntitlementResult
    with patch(
        "app.services.entitlement_service.check_entitlement",
        new_callable=AsyncMock,
        return_value=EntitlementResult(allowed=True, capability="workflows"),
    ):
        yield


def test_schedule_create_default_budgets():
    """WorkflowScheduleCreate defaults to 500k tokens and 1800s."""
    sched = WorkflowScheduleCreate(
        name="Nightly Sync",
        cron_expression="0 0 * * *",
    )
    assert sched.max_tokens_per_run == 500_000
    assert sched.max_duration_seconds == 1_800


@pytest.mark.asyncio
async def test_launch_scheduled_run_parses_string_scalar_definition():
    """launch_scheduled_run un-wraps jsonb string-scalar definitions."""
    owner_id = uuid4()
    workflow_id = uuid4()
    schedule_id = uuid4()
    org_id = uuid4()

    valid_def = {
        "name": "String Def Workflow",
        "slug": "string-def-workflow",
        "version": 1,
        "phases": [],
    }

    schedule_row = {
        "id": schedule_id,
        "user_id": str(owner_id),
        "workflow_id": str(workflow_id),
        "org_id": None,  # Will fallback to row["org_id"]
        "name": "Nightly Run",
        "inputs": {},
        "max_tokens_per_run": 50_000,  # Legacy default -> should lift to 500_000
        "max_duration_seconds": 600,   # Legacy default -> should lift to 1800
    }

    mock_pool = MagicMock()
    mock_redis = MagicMock()

    mock_supabase = MagicMock()
    mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [
        {"id": str(uuid4())}
    ]

    mock_def_row = {
        "id": workflow_id,
        "org_id": str(org_id),
        "definition": json.dumps(valid_def),
    }

    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=mock_def_row)),
        patch("app.dependencies.get_service_role_supabase", return_value=mock_supabase) as mock_get_sb,
        patch("app.db.workflows.create_workflow_run", AsyncMock(return_value=uuid4())) as mock_create_run,
        patch("app.db.workflows.arm_run_budget", AsyncMock()) as mock_arm_budget,
        patch("app.services.scheduler_service._drive_run", AsyncMock()),
    ):
        run_id = await launch_scheduled_run(schedule_row, pool=mock_pool, redis=mock_redis)
        assert run_id is not None

        # Verify org_id fallback
        mock_get_sb.assert_called_once_with(str(org_id))

        # Verify legacy budget was lifted in run inputs
        create_call_args = mock_create_run.call_args
        inputs_passed = create_call_args.kwargs["inputs"]
        assert inputs_passed["_schedule_max_tokens_per_run"] == 500_000
        assert inputs_passed["_schedule_max_duration_seconds"] == 1_800

        # Verify arm_run_budget received lifted budgets
        mock_arm_budget.assert_called_once_with(
            mock_pool,
            run_id,
            max_tokens_per_run=500_000,
            max_duration_seconds=1_800,
        )


@pytest.mark.asyncio
async def test_launch_scheduled_run_preserves_custom_low_budgets():
    """Custom low budgets (e.g. 10k) are not overridden."""
    owner_id = uuid4()
    workflow_id = uuid4()
    schedule_id = uuid4()

    valid_def = {
        "name": "Custom Budget Workflow",
        "slug": "custom-budget-workflow",
        "version": 1,
        "phases": [],
    }

    schedule_row = {
        "id": schedule_id,
        "user_id": str(owner_id),
        "workflow_id": str(workflow_id),
        "org_id": str(uuid4()),  # workflow_schedules.org_id is NOT NULL; the 258 gate reads it
        "name": "Nightly Run",
        "inputs": {},
        "max_tokens_per_run": 10_000,   # Deliberate custom budget
        "max_duration_seconds": 120,    # Deliberate custom budget
    }

    mock_pool = MagicMock()
    mock_redis = MagicMock()
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [
        {"id": str(uuid4())}
    ]

    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value={"definition": valid_def})),
        patch("app.dependencies.get_service_role_supabase", return_value=mock_supabase),
        patch("app.db.workflows.create_workflow_run", AsyncMock(return_value=uuid4())) as mock_create_run,
        patch("app.db.workflows.arm_run_budget", AsyncMock()) as mock_arm_budget,
        patch("app.services.scheduler_service._drive_run", AsyncMock()),
    ):
        run_id = await launch_scheduled_run(schedule_row, pool=mock_pool, redis=mock_redis)
        assert run_id is not None

        inputs_passed = mock_create_run.call_args.kwargs["inputs"]
        assert inputs_passed["_schedule_max_tokens_per_run"] == 10_000
        assert inputs_passed["_schedule_max_duration_seconds"] == 120

        mock_arm_budget.assert_called_once_with(
            mock_pool,
            run_id,
            max_tokens_per_run=10_000,
            max_duration_seconds=120,
        )

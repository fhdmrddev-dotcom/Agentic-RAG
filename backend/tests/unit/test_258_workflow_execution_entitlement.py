"""TIER-01 / 258 F-2 — workflow EXECUTION is gated, not only authoring.

Phase 258 gated create_draft / publish but left the run path open: a Standard org could not
author a workflow yet could run any published one through POST /threads/{id}/messages, which
is the half that spends tokens. The gate lives in ``preflight_workflow_kickoff`` — the one
seam every chat-launched workflow kickoff passes — and runs BEFORE the definition resolve,
so a refused launch writes nothing.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.services.entitlement_service import EntitlementResult
from app.services.workflow_kickoff import preflight_workflow_kickoff


class _StopAtResolve(Exception):
    """Raised by the supabase mock: reaching the definition resolve means the gate admitted."""


def _supabase_that_stops():
    sb = MagicMock()
    sb.table.side_effect = _StopAtResolve("definition resolve reached")
    return sb


def _denied():
    return EntitlementResult(
        allowed=False, capability="workflows", current_tier="standard",
        required_tier="enterprise", reason="Capability not enabled for tier",
        upgrade_hint="Upgrade to Enterprise to use workflows.",
    )


def _allowed():
    return EntitlementResult(allowed=True, capability="workflows", current_tier="enterprise")


async def _kickoff(user, supabase, ent_result=None, ent_side_effect=None):
    body = SimpleNamespace(workflow_definition_id=uuid4())
    with patch("app.api.threads.workflows_enabled", return_value=True), \
         patch("app.api.threads.get_pg_pool", new_callable=AsyncMock, return_value=MagicMock()), \
         patch("app.services.entitlement_service.check_entitlement", new_callable=AsyncMock,
               return_value=ent_result, side_effect=ent_side_effect) as check:
        try:
            return await preflight_workflow_kickoff(
                request=MagicMock(), body=body, thread_id=str(uuid4()),
                thread_row={"active_workflow_run_id": None}, supabase=supabase,
                current_user=user,
            ), check
        except BaseException as exc:  # noqa: BLE001 — surfaced to the assertion
            exc.check = check  # type: ignore[attr-defined]
            raise


@pytest.mark.asyncio
async def test_standard_org_cannot_run_a_workflow_and_nothing_is_resolved():
    user = {"id": str(uuid4()), "org_id": str(uuid4())}
    sb = _supabase_that_stops()
    with pytest.raises(HTTPException) as ei:
        await _kickoff(user, sb, ent_result=_denied())
    assert ei.value.status_code == 403
    assert ei.value.detail["error"] == "entitlement_required"
    assert ei.value.detail["required_tier"] == "enterprise"
    ei.value.check.assert_awaited_once()
    assert ei.value.check.await_args.args[1:] == (user["org_id"], "workflows")
    sb.table.assert_not_called()  # refused BEFORE the definition resolve — writes nothing


@pytest.mark.asyncio
async def test_entitled_org_passes_the_gate():
    user = {"id": str(uuid4()), "org_id": str(uuid4())}
    with pytest.raises(_StopAtResolve):
        await _kickoff(user, _supabase_that_stops(), ent_result=_allowed())


@pytest.mark.asyncio
async def test_no_resolvable_org_fails_closed():
    user = {"id": str(uuid4())}  # resolve_active_org_or_none found nothing
    sb = _supabase_that_stops()
    with pytest.raises(HTTPException) as ei:
        await _kickoff(user, sb, ent_result=_allowed())
    assert ei.value.status_code == 403
    sb.table.assert_not_called()


@pytest.mark.asyncio
async def test_entitlement_db_error_is_503_not_upgrade():
    user = {"id": str(uuid4()), "org_id": str(uuid4())}
    down = EntitlementResult(allowed=False, capability="workflows",
                             reason="Database error during entitlement resolution")
    with pytest.raises(HTTPException) as ei:
        await _kickoff(user, _supabase_that_stops(), ent_result=down)
    assert ei.value.status_code == 503


@pytest.mark.asyncio
async def test_plain_deep_send_never_consults_the_entitlement_check():
    user = {"id": str(uuid4()), "org_id": str(uuid4())}
    body = SimpleNamespace(workflow_definition_id=None)
    with patch("app.services.entitlement_service.check_entitlement", new_callable=AsyncMock) as check:
        out = await preflight_workflow_kickoff(
            request=MagicMock(), body=body, thread_id=str(uuid4()),
            thread_row={"active_workflow_run_id": None}, supabase=MagicMock(),
            current_user=user,
        )
    assert out == (None, None)
    check.assert_not_called()


# ── the scheduled path is execution too ─────────────────────────────────────────────

def _schedule(org_id):
    return {"id": uuid4(), "user_id": str(uuid4()), "workflow_id": str(uuid4()),
            "org_id": org_id, "name": "Nightly", "inputs": {}}


def _definition_row():
    return {"definition": {"name": "W", "slug": "w", "version": 1, "phases": []}, "org_id": None}


@pytest.mark.asyncio
@pytest.mark.parametrize("org_id,ent", [
    (str(uuid4()), _denied()),   # Standard org
    (None, _allowed()),          # no resolvable org — fail closed
])
async def test_unentitled_schedule_is_not_launched_and_writes_nothing(org_id, ent):
    from app.services.scheduler_service import launch_scheduled_run
    with patch("app.db.workflows.get_definition", new_callable=AsyncMock, return_value=_definition_row()), \
         patch("app.db.workflows.create_workflow_run", new_callable=AsyncMock) as create_run, \
         patch("app.dependencies.get_service_role_supabase") as sr, \
         patch("app.services.entitlement_service.check_entitlement", new_callable=AsyncMock, return_value=ent):
        out = await launch_scheduled_run(_schedule(org_id), pool=MagicMock(), redis=MagicMock())
    assert out is None
    create_run.assert_not_called()
    sr.assert_not_called()  # no thread inserted

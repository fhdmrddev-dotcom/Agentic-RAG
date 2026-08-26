"""Phase 204 (SCHED-01 / D-204-11) — the schedule CRUD + manual-trigger surface.

Six routes across two prefixes, because a schedule has two natural addresses: it belongs to a
workflow (``/workflows/{id}/schedules`` — create and list) and it is a thing in its own right
(``/schedules/...`` — read-all, patch, delete, trigger). Two routers in one module rather than
one router with an awkward prefix; ``main.py`` mounts both.

**Security posture — the primary deliverable of this module.**

  * ⚠ **THE MALFORMED-CRON REFUSAL HAPPENS BEFORE ANY WRITE, AND IT HAPPENS IN PYDANTIC.**
    ``WorkflowScheduleCreate`` parses the expression with ``croniter`` in a field validator, so
    a bad cron is a **422 from FastAPI's own validation layer** — the handler body never runs
    and the database is never touched. This is deliberate: a cron validated *after* an INSERT
    would leave a row that the poller can never advance, and the poller's own repair
    (deactivate + ``cadence_error``) exists as a backstop for rows that arrive some other way,
    not as the primary gate.
  * **Every route is OWNER-SCOPED and every miss is a 404, never a 403.** A 403 on a foreign id
    confirms the id exists, which is exactly the disclosure the 404 posture closes. The owner
    predicate is enforced twice — in the SQL (``db/schedules.py``, because the asyncpg pool is
    ``BYPASSRLS``) and by the RLS policies migration 124 installs.
  * **Creating a schedule requires the caller to be able to LOAD the workflow.** The check is
    ``get_definition(..., user_id=caller)`` — the same owner-scoped read the publish path uses
    — so a caller cannot schedule a workflow they cannot see.
  * ⚠ **ONLY A PUBLISHED WORKFLOW CAN BE SCHEDULED, and that is a DECISION.** A draft is
    mutable by definition; an unattended run of a mutable document is a run whose behaviour
    nobody agreed to, firing at 03:00, spending money. The publish gauntlet is the moment a
    human asserts the workflow does what it claims, and a schedule is precisely the situation
    where nobody is present to notice that it does not. A caller gets a 400 with the reason.

**The visibility gate is ``workflow_authoring``** — the shipped key, not a new one. It is the
narrower of the plausible choices (a user who may run but not author cannot schedule), which is
the right direction for a capability that spends unattended. Applied PER-ROUTE rather than at
router level, matching ``workflows.py``'s own choice, so a future read here cannot inherit or
lose a gate by accident.
"""
from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.db.schedules import (
    create_schedule,
    delete_schedule,
    get_schedule,
    get_schedule_for_launch,
    list_schedules_by_org,
    list_schedules_by_workflow,
    update_schedule,
)
from app.db.workflows import get_definition
from app.dependencies import get_current_user, get_pg_pool, get_redis, require_visible
from app.models.schedule import (
    ScheduleTriggerResult,
    WorkflowScheduleCreate,
    WorkflowScheduleRead,
    WorkflowScheduleUpdate,
)

logger = logging.getLogger(__name__)

# The schedule's own address space.
router = APIRouter(prefix="/schedules", tags=["schedules"])
# The workflow-anchored half. Shares the `/workflows` prefix with `api/workflows.py`; the paths
# do not collide (nothing there ends in `/schedules`).
workflow_router = APIRouter(prefix="/workflows", tags=["schedules"])

_NOT_FOUND = "schedule not found"


def _coerce_user_id(current_user: dict) -> UUID:
    """The trusted owner id as a UUID — `api/workflows.py`'s helper, same shape."""
    user_id = current_user["id"]
    return UUID(user_id) if isinstance(user_id, str) else user_id


def _serialize(row: dict) -> WorkflowScheduleRead:
    """Row -> wire model.

    ⚠ ONE of the three places the projection lives (with ``_SCHEDULE_COLUMNS`` and
    ``WorkflowScheduleRead``). ``response_model`` drops undeclared keys SILENTLY, so all three
    move in one commit or a new column reaches the database and nowhere else.
    """
    return WorkflowScheduleRead(**row)


@workflow_router.post(
    "/{workflow_id}/schedules",
    response_model=WorkflowScheduleRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_visible("workflow_authoring"))],
)
async def create_workflow_schedule(
    workflow_id: UUID,
    body: WorkflowScheduleCreate,
    current_user: dict = Depends(get_current_user),
) -> WorkflowScheduleRead:
    """Schedule a published workflow. 404 if the caller cannot load it, 400 if it is a draft.

    The cron string has ALREADY been parsed by ``croniter`` and the timezone resolved by
    ``zoneinfo`` before this body runs — see the module docblock. Nothing malformed reaches
    the INSERT.
    """
    user_id = _coerce_user_id(current_user)
    pool = await get_pg_pool()

    definition_row = await get_definition(pool, workflow_id, user_id=user_id)
    if definition_row is None:
        # Not-found AND not-yours collapse to one 404 (no existence leak).
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="workflow not found")
    if definition_row.get("status") != "published":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "only a published workflow can be scheduled — a draft is still mutable, and "
                "an unattended run of a mutable workflow is one nobody agreed to"
            ),
        )

    row = await create_schedule(
        pool,
        workflow_id=workflow_id,
        user_id=user_id,
        name=body.name,
        cron_expression=body.cron_expression,
        interval_seconds=body.interval_seconds,
        timezone=body.timezone,
        is_active=body.is_active,
        max_tokens_per_run=body.max_tokens_per_run,
        max_duration_seconds=body.max_duration_seconds,
        inputs=body.inputs,
    )
    return _serialize(row)


@workflow_router.get(
    "/{workflow_id}/schedules",
    response_model=list[WorkflowScheduleRead],
    dependencies=[Depends(require_visible("workflow_authoring"))],
)
async def list_workflow_schedules(
    workflow_id: UUID,
    current_user: dict = Depends(get_current_user),
) -> list[WorkflowScheduleRead]:
    """Every schedule the caller owns on one workflow.

    ⚠ No existence check on the workflow, deliberately: the read is owner-scoped on the
    SCHEDULE, so a foreign or absent workflow id simply returns ``[]``. Adding a 404 here would
    turn this route into an existence oracle for workflow ids.
    """
    user_id = _coerce_user_id(current_user)
    pool = await get_pg_pool()
    rows = await list_schedules_by_workflow(pool, workflow_id, user_id=user_id)
    return [_serialize(r) for r in rows]


@router.get(
    "",
    response_model=list[WorkflowScheduleRead],
    dependencies=[Depends(require_visible("workflow_authoring"))],
)
async def list_schedules(
    current_user: dict = Depends(get_current_user),
) -> list[WorkflowScheduleRead]:
    """Every schedule the caller owns, across every workflow, soonest-due first."""
    user_id = _coerce_user_id(current_user)
    pool = await get_pg_pool()
    rows = await list_schedules_by_org(pool, user_id=user_id)
    return [_serialize(r) for r in rows]


@router.patch(
    "/{schedule_id}",
    response_model=WorkflowScheduleRead,
    dependencies=[Depends(require_visible("workflow_authoring"))],
)
async def patch_schedule(
    schedule_id: UUID,
    body: WorkflowScheduleUpdate,
    current_user: dict = Depends(get_current_user),
) -> WorkflowScheduleRead:
    """Patch or toggle a schedule. ``exclude_unset`` — an absent key means "leave it alone".

    ⚠ ``exclude_unset=True`` rather than ``exclude_none=True``: ``inputs: null`` and an absent
    ``inputs`` are different requests, and the writer's allow-list is what decides which keys
    can move at all.
    """
    user_id = _coerce_user_id(current_user)
    pool = await get_pg_pool()
    row = await update_schedule(
        pool,
        schedule_id,
        user_id=user_id,
        fields=body.model_dump(exclude_unset=True),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND)
    return _serialize(row)


@router.delete(
    "/{schedule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    # `response_model=None` is REQUIRED, not tidiness: FastAPI infers a response model from
    # the `-> None` return annotation and then asserts that a 204 may not carry a body, which
    # fails at IMPORT time (`AssertionError: Status code 204 must not have a response body`).
    response_model=None,
    dependencies=[Depends(require_visible("workflow_authoring"))],
)
async def remove_schedule(
    schedule_id: UUID,
    current_user: dict = Depends(get_current_user),
) -> None:
    """Delete a schedule. 404 for a miss and for a foreign row alike.

    ⚠ Deleting a schedule does NOT cancel runs it already launched. Those are ordinary runs
    with their own Stop control; silently killing live work because its trigger was removed
    would be a surprise, and the run's owner may well want its output.
    """
    user_id = _coerce_user_id(current_user)
    pool = await get_pg_pool()
    if not await delete_schedule(pool, schedule_id, user_id=user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND)


@router.post(
    "/{schedule_id}/trigger",
    response_model=ScheduleTriggerResult,
    dependencies=[Depends(require_visible("workflow_authoring"))],
)
async def trigger_schedule(
    schedule_id: UUID,
    current_user: dict = Depends(get_current_user),
) -> ScheduleTriggerResult:
    """Run this schedule NOW, without disturbing its cadence.

    ⚠ **``next_run_at`` IS NOT ADVANCED.** A manual trigger is "show me what this does",
    not "consider this cadence satisfied" — advancing it would silently skip the next real
    firing, which is the opposite of what someone testing a schedule wants.

    ⚠ The ownership check and the launch read are two separate statements ON PURPOSE:
    ``get_schedule`` is owner-scoped and answers *may this caller act on this row*;
    ``get_schedule_for_launch`` is owner-AGNOSTIC and carries the identity columns the launcher
    needs. Collapsing them into one owner-agnostic read is how the gate would go missing.
    """
    user_id = _coerce_user_id(current_user)
    pool = await get_pg_pool()

    if await get_schedule(pool, schedule_id, user_id=user_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND)

    launch_row = await get_schedule_for_launch(pool, schedule_id)
    if launch_row is None:  # deleted between the two reads
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND)

    from app.services.scheduler_service import launch_scheduled_run

    run_id = await launch_scheduled_run(launch_row, pool=pool, redis=get_redis())
    if run_id is None:
        return ScheduleTriggerResult(
            launched=False,
            detail="the scheduled workflow could not be loaded (deleted, or no longer yours)",
        )
    return ScheduleTriggerResult(launched=True, workflow_run_id=run_id)


# ⚠ `claim_due_schedules` is DELIBERATELY NOT IMPORTED HERE AND HAS NO ROUTE, and the absence
# is the decision. It is the poller's OWNER-AGNOSTIC claim: it advances `next_run_at` on every
# due row on the install regardless of who owns it. Behind any HTTP door it would let one
# authenticated caller fire every other tenant's schedules — so it is not merely unrouted, it is
# not reachable from this module's namespace at all. `test_workflow_scheduler.py` asserts both.
__all__ = ["router", "workflow_router"]

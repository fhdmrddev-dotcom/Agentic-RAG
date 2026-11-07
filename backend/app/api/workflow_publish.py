"""Phase 308.1-03 (BUG-261107-01, D-04 / D-20) — ``GET /workflows/{definition_id}/publish``.

THE CONCERN. Since 308.1-02 the publish POST answers ``202`` with a handle once the cheap stages
pass, and the golden run continues in the background (on whichever worker is alive, and after a
restart through the golden sweep). This is the ONE read that follows it: the caller's latest
publish attempt on a draft, with where it is and, once finished, what it concluded::

    {"state": "none" | "running" | "finishing" | "done",
     "golden_run_id": uuid | null,
     "verdict": PublishVerdict | null,          # set once state is "done"
     "progress": {"step_index": int | null,     # 1-based position of the ACTIVE step
                  "step_count": int,
                  "step_name": str | null,      # the AUTHORED name, never the slug
                  "started_at": datetime}       # the run's created_at
                 | null}

WHY ITS OWN ROUTER (D-04). ``api/workflows.py`` fires G-5 and its split is OWED; a new read joins
the ``/workflows`` prefix from a module of its own, exactly as ``schedules.workflow_router`` does.
No path collides (``workflows.router`` has only the POST on this path).

OWNER-SCOPED LIKE THE POST (T-308.1-13). ``get_definition`` returns the caller's own rows AND any
GLOBAL PUBLISHED row to anyone, so the owner check is ``created_by == user_id``, not "the read
returned a row". A missing draft, another user's draft and another user's global published row
are all the POST's uniform ``404 "workflow not found"`` (no existence leak). An owner with no
attempt gets ``200 {state: "none"}``: they own the row, so nothing leaks. The attempt read itself
filters on the caller's ``user_id`` too (``db.workflows.latest_publish_attempt``).

NEVER THE RECORD'S SECRETS. The publish record also holds the golden input and the stage-0 token;
``latest_publish_attempt`` does not select them and the response model has no field for them.

DECISIONS RECORDED HERE:

* ``started_at`` is the run's ``created_at``, not ``claimed_at``: a re-drive re-stamps
  ``claimed_at`` and would reset the elapsed clock.
* NOT flagged UI-internal in the public API reference (RESEARCH A4, resolved): the public POST
  now answers 202 and this GET is how any API caller follows it; ``build-public-openapi.cjs``
  flags by PATH, so flagging this would also badge the public POST.
* No ``stale`` / "resuming" field (RESEARCH Open Q3): the approved UI-SPEC has no words for it, and
  the progress line stays truthful while the late resume pass picks a stranded run up.

Database reads are imported function-locally from ``app.db.workflows`` (tests patch them there).
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.workflow_wire import PublishVerdict
from app.dependencies import get_current_user, get_pg_pool, require_visible
from app.services.entitlement_service import require_capability

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflows", tags=["workflows"])

_NOT_FOUND = "workflow not found"  # the POST's detail, verbatim
_STATES = ("running", "finishing", "done")


class PublishProgress(BaseModel):
    """Where a publish attempt's golden run is. ``step_index`` is 1-based and ``None`` between
    steps; ``step_name`` is the author's name for the step, ``None`` when they gave none."""

    step_index: int | None = None
    step_count: int
    step_name: str | None = None
    started_at: datetime


class PublishAttempt(BaseModel):
    """The caller's latest publish attempt on a draft (D-20). Every field is declared: the
    response model drops anything undeclared."""

    state: Literal["none", "running", "finishing", "done"]
    golden_run_id: UUID | None = None
    verdict: PublishVerdict | None = None
    progress: PublishProgress | None = None


def _coerce_user_id(current_user: dict) -> UUID:
    """The trusted owner id as a UUID (``schedules.py``'s helper, same shape)."""
    user_id = current_user["id"]
    return UUID(user_id) if isinstance(user_id, str) else user_id


def _progress(attempt: dict, phases: list[dict]) -> PublishProgress:
    """Position, count and authored name of the active step, from the run's phase rows."""
    from app.models.harness import WorkflowDefinition  # noqa: PLC0415
    from app.services.harness import publish_service as _ps  # noqa: PLC0415

    snapshot = attempt.get("definition_snapshot") or {}
    ordered = sorted(phases or [], key=lambda r: r.get("phase_index") or 0)
    step_count = len(ordered) or len(snapshot.get("phases") or [])
    position, active = next(
        ((i, row) for i, row in enumerate(ordered, start=1) if row.get("status") == "active"),
        (None, None),
    )
    step_name = None
    if active is not None:
        try:
            definition = WorkflowDefinition.model_validate(snapshot)
        except Exception:  # noqa: BLE001 — an unreadable snapshot has no name to show
            definition = None
        if definition is not None:
            step_name = _ps._authored_step_name(
                definition, slug=active.get("slug"), index=active.get("phase_index")
            )
    return PublishProgress(
        step_index=position,
        step_count=step_count,
        step_name=step_name,
        started_at=attempt["created_at"],
    )


@router.get(
    "/{definition_id}/publish",
    response_model=PublishAttempt,
    dependencies=[
        Depends(require_visible("workflow_authoring")),  # the POST's authoring gate
        Depends(require_capability("workflows")),  # the POST's commercial tier gate
    ],
)
async def get_publish_attempt(
    definition_id: UUID,
    current_user: dict = Depends(get_current_user),
) -> PublishAttempt:
    """The caller's latest publish attempt on this draft: state, golden run, verdict, progress.

    ``404 "workflow not found"`` for a missing draft or one the caller does not own (the POST's
    answer, byte for byte); ``200 {state: "none"}`` when the owner has never published it in the
    background. ``definition_id`` is a path ``UUID`` (422 on a malformed id).
    """
    from app.db.workflows import (  # noqa: PLC0415
        get_definition,
        latest_publish_attempt,
        load_run_phases,
    )

    user_id = _coerce_user_id(current_user)
    pool = await get_pg_pool()
    row = await get_definition(pool, definition_id, user_id=user_id)
    if row is None or str(row.get("created_by")) != str(user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND)

    from app.config import settings  # noqa: PLC0415

    attempt = await latest_publish_attempt(
        pool,
        definition_id=definition_id,
        user_id=user_id,
        lease_seconds=settings.harness_resume_lease_seconds,
        max_age_seconds=settings.harness_publish_max_seconds,
    )
    if attempt is None:
        return PublishAttempt(state="none")

    if attempt.get("tail_stranded"):
        # 308.1 review CR-02: a record left ``running`` on an ENDED run, or a dead ``finishing``
        # claim, used to wait for the next worker boot (the screen polled until then). The read
        # that notices it spawns the recovered tail (the CAS keeps it exactly-once) and answers
        # what it found; the next poll reads the verdict. Never a failed read because of it.
        try:
            from app.services.harness.publish_attempt import (  # noqa: PLC0415
                recover_publish_tail,
            )

            # WR-06: past the publish budget it records the timeout and is never judged.
            recover_publish_tail(
                attempt["run_id"], pool=pool, expired=bool(attempt.get("tail_expired"))
            )
        except Exception:  # noqa: BLE001 — the golden sweep is the second net
            logger.exception("publish: could not recover the tail of %s", attempt["run_id"])

    state = attempt.get("state")
    verdict = attempt.get("verdict")
    if state not in _STATES:  # a record is only ever written with these three
        state = "done" if isinstance(verdict, dict) else "running"
    phases = await load_run_phases(pool, attempt["run_id"])
    return PublishAttempt(
        state=state,
        golden_run_id=attempt["run_id"],
        verdict=PublishVerdict(**verdict) if state == "done" and isinstance(verdict, dict) else None,
        progress=_progress(attempt, phases),
    )

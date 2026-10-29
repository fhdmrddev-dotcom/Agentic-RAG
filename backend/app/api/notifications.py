"""Phase 301 (NOTE-01 / NOTE-05; D-10, D-15, D-27, D-28) — ``GET /notifications``: what is waiting on me?

Lists the workflow runs that are waiting on the signed-in person — a question to answer or an
approval to give — across EVERY organization they belong to, the run that has waited longest first.
Each notice names its organization and its workflow, and says how the run was started (``app``,
``schedule`` or ``key``; null for runs from before that was recorded). ``total`` counts every open
notice, even when the list stops at 50. A notice is written by the database when a run starts
waiting and closed when it is answered or the run ends; nothing here writes.

**Security posture.**

  * Every route here answers **401** with ``WWW-Authenticate: Bearer`` without a credential
    (``_require_bearer``, a router dependency, so a route later added to this router inherits it)
    — before any read.
  * The read runs on the shared asyncpg pool, which bypasses RLS. The access wall is the statement
    itself (``app.db.notifications.LIST_OPEN_SQL``): the caller id from the verified session is
    bound as ``$1`` in BOTH the recipient predicate and the org-membership join, so another
    person's notices and the notices of an org the caller has left are never selected.
  * ``X-Org-Id`` is never read: the answer spans every org the caller belongs to (D-15).
  * A run that is no longer active or paused is never listed, even if its notice was not closed.
  * The text of a question is never read or returned.
  * Read-only by construction. All I/O is async asyncpg — no blocking client in this handler.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.db.notifications import list_open_notices
from app.dependencies import get_current_user, get_pg_pool

_optional_bearer = HTTPBearer(auto_error=False)

#: D-10: the list stops here; ``total`` still counts every open notice.
LIST_LIMIT = 50


async def _require_bearer(
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
) -> None:
    """D-15: no credential is a 401 with ``WWW-Authenticate: Bearer`` — checked before any read."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )


router = APIRouter(
    prefix="/notifications", tags=["notifications"], dependencies=[Depends(_require_bearer)]
)


class WaitingNotice(BaseModel):
    """One workflow run that is waiting on you."""

    id: UUID
    run_id: UUID
    org_id: UUID
    org_name: str
    workflow_name: str
    kind: Literal["question", "approval"]
    origin: Literal["app", "schedule", "key"] | None
    created_at: datetime


class WaitingNotices(BaseModel):
    """Your open notices (at most 50, waited-longest first) and how many are open in total."""

    notices: list[WaitingNotice]
    total: int


@router.get("", response_model=WaitingNotices)
async def list_waiting_notices(current_user: dict = Depends(get_current_user)) -> WaitingNotices:
    """The workflow runs waiting on you, across every organization you belong to.

    Oldest wait first, at most 50 rows. Each names its organization, its workflow, whether it needs
    an answer (`question`) or an approval (`approval`), and how the run was started. `total` counts
    every open notice, including any beyond the first 50. A run that has ended is never listed.
    """
    caller = UUID(str(current_user["id"]))
    pool = await get_pg_pool()
    async with pool.acquire() as conn:
        rows, total = await list_open_notices(conn, caller, LIST_LIMIT)
    return WaitingNotices(
        notices=[
            WaitingNotice(
                id=r["id"],
                run_id=r["run_id"],
                org_id=r["org_id"],
                org_name=r["org_name"],
                workflow_name=r["workflow_name"],
                kind=r["kind"],
                origin=r["origin"],
                created_at=r["created_at"],
            )
            for r in rows
        ],
        total=total,
    )

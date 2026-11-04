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
from pydantic import BaseModel, model_serializer

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


#: Phase 308: the keys only a webhook notice carries. A run notice omits them, so it serialises
#: exactly as it did before 308.
_WEBHOOK_ONLY_KEYS = ("endpoint_id", "reason", "title", "title_is_address")


class WaitingNotice(BaseModel):
    """One thing waiting on you: a workflow run (a question or an approval), or one of your webhooks
    that was turned off because it kept failing (``webhook_disabled``)."""

    id: UUID
    run_id: UUID | None  # 308 (D-48): null on a webhook notice
    org_id: UUID
    org_name: str
    workflow_name: str | None = None  # 308: null on a webhook notice
    kind: Literal["question", "approval", "webhook_disabled"]
    origin: Literal["app", "schedule", "key", "mcp"] | None  # 306-04 (D-31): + mcp
    created_at: datetime
    # Phase 308 (D-48 / D-56) — a webhook notice only:
    endpoint_id: UUID | None = None
    reason: Literal["failing", "gone"] | None = None
    title: str | None = None  # the endpoint's description, else host + path (no query)
    title_is_address: bool | None = None  # true when ``title`` is the host + path

    @model_serializer(mode="wrap")
    def _omit_webhook_keys_on_a_run_notice(self, handler):
        data = handler(self)
        if self.kind != "webhook_disabled":
            for key in _WEBHOOK_ONLY_KEYS:
                data.pop(key, None)
        return data


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
                endpoint_id=r["endpoint_id"],
                reason=r["reason"],
                title=r["title"],
                title_is_address=r["title_is_address"],
            )
            for r in rows
        ],
        total=total,
    )

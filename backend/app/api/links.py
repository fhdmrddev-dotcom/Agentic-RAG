"""Phase 299 (LINK-04 / D-06..D-11) — ``GET /links/{kind}/{item_id}``: may I open this, and where?

The client asks this before it shows a pasted or shared link to a thread, workflow, run or Expert.
The answer is the item's org (so the client can offer to switch to it), its title, a workflow's
draft/published state and who a link to it opens for — or ONE refusal.

**Security posture** (the ``org_items`` posture; the rule per kind lives in
``app.services.link_resolver``, whose docblock records why run and Expert are pool kinds).

  * ONE answer for every refusal: ``404 {"detail": "Not found"}`` (``NOT_FOUND_DETAIL``). A
    malformed id, an unknown kind, a nonexistent id and an id the caller may not open are the same
    status, the same body bytes and the same headers. Malformed input is refused BEFORE any I/O.
  * The path parameters are typed ``str`` and validated in the handler: a ``UUID``-typed parameter
    would answer a malformed id with a different status than a missing one.
  * Membership is evaluated server-side in the statement; ``X-Org-Id`` is never consulted. No
    active-org gate, capability gate or visibility gate is attached — each would answer some
    callers with a different status, which is shape.
  * Every route here answers **401** without a bearer (``_require_bearer``, a router dependency,
    so a route later added to this router inherits it).
  * Read-only by construction. All I/O is async asyncpg — no blocking client in this handler.
"""
from __future__ import annotations

import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.dependencies import get_current_user, get_pg_pool, get_user_pg_connection
from app.services import link_resolver
from app.services.link_resolver import LinkTarget

_optional_bearer = HTTPBearer(auto_error=False)

#: The ONE refusal body, for every arm (never ``str(exc)``, never a per-kind sentence).
NOT_FOUND_DETAIL = "Not found"


async def _require_bearer(
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
) -> None:
    """D-11: no credential is a 401 with ``WWW-Authenticate: Bearer`` — checked before any read."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )


router = APIRouter(prefix="/links", tags=["links"], dependencies=[Depends(_require_bearer)])

_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def _not_found() -> HTTPException:
    return HTTPException(status_code=404, detail=NOT_FOUND_DETAIL)


@router.get(
    "/{kind}/{item_id}",
    response_model=LinkTarget,
    responses={404: {"description": "Not found — the one answer for every item you cannot open."}},
)
async def resolve_link(
    kind: str,
    item_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> LinkTarget:
    """Whether you can open a thread, workflow, run or Expert, and in which of your organizations.

    `kind` is `thread`, `workflow`, `run` or `expert`. The answer names the item's organization
    (null for items every signed-in user can open), its title, a workflow's state and who a link
    to it opens for. An item that does not exist and one you cannot open give the same 404.
    """
    if kind not in link_resolver.KINDS or not _UUID_RE.match(item_id):
        raise _not_found()
    item = UUID(item_id)
    caller = UUID(str(current_user["id"]))
    if kind in link_resolver.POOL_KINDS:
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            row = await link_resolver.lookup(conn, kind, item, caller)
    else:
        async with get_user_pg_connection(request, current_user) as conn:
            row = await link_resolver.lookup(conn, kind, item, caller)
    if row is None:
        raise _not_found()
    return link_resolver.to_target(kind, row)

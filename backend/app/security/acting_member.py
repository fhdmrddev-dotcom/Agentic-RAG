"""Phase 304 (D-13, D-14, D-38) — act as a member in ONE org on an RLS connection.

A personal MCP key acts as its owner, but only in the org the key belongs to. Today
``current_user_org_ids()`` returns every org the member is in; migration 221 lets the transaction-
local GUC ``app.acting_org_id`` narrow that set to one org (and to NOTHING for an org they are not
in — it can never widen). This module is the one place that states which org.

  · ``acting_org_scope(org_id)`` — validate with ``uuid.UUID`` (``ValueError`` before anything is
    set), set the acting-org ContextVar to the canonical string, and reset the token in ``finally``
    so the previous value (normally ``None``) comes back even when the body raises.
  · ``acting_as(principal)`` — the same, reading ``principal.org_id``. Duck-typed on purpose: this
    module does not import the MCP principal type, so it does not depend on plan 304-02.
  · ``acting_member_connection(user_id=, org_id=)`` — the acting connection itself:
    ``acting_org_scope`` + ``get_user_pg_connection(None, {"id": user_id})``. RLS runs as the user
    (``SET LOCAL ROLE authenticated`` + claims) and ``_apply_rls_user_context`` adds the GUC because
    the ContextVar is set. Every narrowed read in ``app/services/acting_member_reads.py`` runs here.

The org NEVER comes from a client header or request value: callers pass the org recorded on the
resolved key row.

⚠ CONTEXTVARS PROPAGATE. ``asyncio.create_task`` / ``gather`` copy the context at creation, so
anything spawned inside a scope inherits the acting org. That is wanted for retrieval's internal
fan-out; it is a hazard for anything long-lived. 304 spawns nothing inside a scope — 306
(``ask_agent``) must decide this deliberately.

⚠ THE GUC NARROWS ONLY THE asyncpg ACTING CONNECTION. A supabase-py call (PostgREST) never sees it,
so no visibility decision on the MCP path may be made through supabase-py or the service role.
"""

from __future__ import annotations

import uuid
from contextlib import asynccontextmanager, contextmanager
from typing import Any, AsyncIterator, Iterator

from app.dependencies import get_user_pg_connection
from app.security.acting_org import _acting_org


@contextmanager
def acting_org_scope(org_id: str) -> Iterator[str]:
    """Act in ``org_id`` for the duration of the block. Raises ``ValueError`` on a non-UUID."""
    canonical = str(uuid.UUID(str(org_id)))
    token = _acting_org.set(canonical)
    try:
        yield canonical
    finally:
        _acting_org.reset(token)


@contextmanager
def acting_as(principal: Any) -> Iterator[str]:
    """Act in the org recorded on a resolved principal (anything with an ``org_id``)."""
    with acting_org_scope(principal.org_id) as canonical:
        yield canonical


@asynccontextmanager
async def acting_member_connection(*, user_id: str, org_id: str) -> AsyncIterator[Any]:
    """An RLS connection for ``user_id`` narrowed to ``org_id`` (one transaction)."""
    with acting_org_scope(org_id):
        async with get_user_pg_connection(None, {"id": user_id}) as conn:
            yield conn

"""Phase 280 (D-11 / D-12 / D-31) — the ONE purge body both watch doors share.

``api/sources.py`` had two copies of the same purge block — ``DELETE /sources/watches/{id}``
(``purge_documents=true``) and ``POST /sources/watches/{id}/purge``. Both now call
``purge_documents`` here; this is the G-5 "extraction FIRST" ``sources.py``'s ledger section
demanded since the 275 close (D-12).

⛔ THE ORDER IS BINDING (275 D-38 / T-275-12): check the hold → delete the rows → remove the bytes.
A refusal — the guard's own 409, or a ``PT409`` racing past it inside ``map_hold_refusal`` —
never costs a byte, and any other database error PROPAGATES unchanged (never logged-and-continued).

⛔ D-31: the hold guard is called THROUGH THE MODULE ATTRIBUTE (``hold_guard.assert_none_held``).
The unit tests monkeypatch ``hold_guard.assert_none_held``; a ``from … import assert_none_held``
here would bind the real function at import time and make every one of those tests vacuous.
"""
from __future__ import annotations

from typing import Sequence

from starlette.concurrency import run_in_threadpool

from app.services.retention import hold_guard  # D-31: module attribute, never a by-name import


async def purge_documents(
    request,
    current_user: dict,
    doc_ids: Sequence[str],
    *,
    kind: hold_guard.HoldKind,
    supabase,
    service_supabase,
) -> list[dict]:
    """Delete ``doc_ids`` under the user-JWT ``supabase`` client after the hold check.

    Returns the rows the DELETE returned (PostgREST ``return=representation`` is the default).
    """
    ids = list(doc_ids)
    await hold_guard.assert_none_held(
        request, current_user, ids, kind=kind, service_supabase=service_supabase,
    )
    with hold_guard.map_hold_refusal(kind=kind):
        resp = await run_in_threadpool(
            lambda: supabase.table("documents")
            .delete()
            .in_("id", ids)
            .execute()
        )
    return (resp.data if resp is not None else None) or []

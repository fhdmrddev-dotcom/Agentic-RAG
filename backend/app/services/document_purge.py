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

⭐ DEBT-10 / BUG-261012-01: both doors used to delete the rows and leave every stored file behind.
The bytes step is ``remove_document_bytes`` — LIFTED byte-identical from
``retention/disposition.py::_remove_bytes`` (D-11: one bytes step, not a third copy; disposition
now imports it). The paths come ONLY from the rows the DELETE returned (PostgREST
``return=representation`` is the default), so a row the caller could not delete — RLS-filtered, or
gone — never loses its bytes, and there is no pre-SELECT to race (D-31, no TOCTOU). The remove runs
under the same user-JWT client as the row delete; migration 206's ``storage.objects`` DELETE policy
is defence-in-depth behind the order.
"""
from __future__ import annotations

import logging
from typing import Sequence

from starlette.concurrency import run_in_threadpool

from app.services.retention import hold_guard  # D-31: module attribute, never a by-name import

logger = logging.getLogger(__name__)

STORAGE_BUCKET = "documents"


async def purge_documents(
    request,
    current_user: dict,
    doc_ids: Sequence[str],
    *,
    kind: hold_guard.HoldKind,
    supabase,
    service_supabase,
) -> list[dict]:
    """Hold check → delete ``doc_ids`` under the user-JWT ``supabase`` client → remove their bytes.

    Returns the rows the DELETE returned. A storage failure is logged, never raised: the rows are
    already gone, so the caller's own post-purge steps still run.
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
    deleted = (resp.data if resp is not None else None) or []

    # D-11 / D-31: bytes AFTER the rows, and only for the rows actually deleted.
    removed: list[str] = []
    not_removed: list[str] = []
    paths = [r["file_path"] for r in deleted if r.get("file_path")]
    await remove_document_bytes(supabase, paths, removed, not_removed)
    if not_removed:
        logger.warning(
            "purge_documents(%s): %d stored file(s) were not removed after the row delete",
            kind, len(not_removed),
        )
    return deleted


async def remove_document_bytes(storage, paths: list[str], removed: list[str], not_removed: list[str]) -> None:
    """Remove ``paths`` from the documents bucket; split them by what Storage CONFIRMED deleted.

    Phase 285 D-10 / BUG-261014-05: storage3 2.29's ``remove()`` returns the objects it actually
    deleted and silently omits a path that did not exist (measured against local storage, RESEARCH
    §9). A path Storage did not confirm is reported in ``not_removed`` — never assumed removed.

    ⚠ Accepted effect on the other caller, retention disposition (orchestrator ruling 7): a path
    that was ALREADY absent from storage (e.g. a BUG-260905-08 row whose bytes never landed) now
    lands in ``bytes_not_removed``. That over-reports in the safe direction: Storage did not
    confirm a deletion, so none is claimed.
    """
    if not paths or storage is None:
        return
    try:
        res = await run_in_threadpool(lambda: storage.storage.from_(STORAGE_BUCKET).remove(paths))
        confirmed = {o.get("name") for o in (res or []) if isinstance(o, dict)}
        removed.extend(p for p in paths if p in confirmed)
        not_removed.extend(p for p in paths if p not in confirmed)
    except Exception:
        # 280-REVIEW IN-04: a NEUTRAL prefix — this step is shared by retention disposition and both
        # watch purge doors, so "retention:" misattributed every watch-purge failure. (The lift was
        # byte-identical until this line; the caller's own warning, if any, names the caller.)
        logger.exception(
            "remove_document_bytes: removing %d stored file(s) after a confirmed row delete failed", len(paths)
        )
        not_removed.extend(paths)

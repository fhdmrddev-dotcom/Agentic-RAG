"""The questions that found a document — Phase 217 (LIB-04, D-217-06 / D-217-07).

Phase 217 (LIB-04) — SERVICE-ROLE, classified exception (NOT the user-JWT client).
This surface reads ``audit_log`` (the ``search.query`` events the retrieval path already writes,
carrying ``document_ids`` and usually ``query_text``) — a table whose RLS is INSERT-only for
``authenticated`` (mig 108 adds **no authenticated SELECT policy**), so a user-JWT client would
silently read back an EMPTY set and the panel would render "no questions yet" for a document that
has been retrieved a hundred times. Like ``knowledge_health.py`` and ``governance_service.py``,
this is the plan's "aggregate/analytics call that legitimately needs service-role" carve-out:
every query stays owner-scoped in app code via ``.eq("user_id", user_id)`` (D-217-07 — the SOLE
gate, because RLS is bypassed by construction here), parameterized, and read-only. The
``document_id`` in the path is a SELECTOR, never an authorization claim; a caller passing another
user's document id gets ``[]``, because their own audit rows never reference it.

The module is kept uniformly service-role, and holds exactly one route, so that this surface has
ONE auditable rationale rather than a per-handler split — that is why the route does NOT live in
the otherwise user-JWT ``api/documents.py``.

Read-only by construction: no INSERT, no UPDATE, no DELETE, and no audit event of its own
(T-217-12 — recorded so the absence is a decision, not an oversight).
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from app.dependencies import get_current_user, get_supabase
# D-217-06 / sketch fence A6e: the "30 days" label on every retrieval count is pinned to ONE
# constant. Import it (and the shipped cutoff helper beside it) rather than redeclaring 30 here —
# a second literal is exactly how the label and the query drift apart.
from app.api.knowledge_health import WINDOW_DAYS, _window_cutoff
from app.utils.db import aexec

router = APIRouter(prefix="/documents", tags=["documents"])

# T-217-13: `audit_log.metadata` has no GIN index. The read is window-bounded (WINDOW_DAYS) and
# user-scoped before containment; this cap bounds the worst case for a heavily-retrieved document.
MAX_ROWS = 100


class DocumentQueryRow(BaseModel):
    """One search that returned this document.

    Deliberately defined HERE and not in ``app/models/document.py``: the row exists only because of
    this module's service-role carve-out, and keeping it local keeps the exception self-contained.

    ``query_text`` is ``None`` on rows written by the D-115-10 view/filter path
    (``tool_dispatcher.py:958-965``), which records ``via`` and no question text. The client renders
    an honest sentence for that case — this route never invents a placeholder question and never
    emits the string "undefined".
    """

    query_text: str | None = None
    asked_at: datetime
    via: str | None = None  # "view" | "filter" | None (a plain semantic search records no `via`)


@router.get("/{document_id}/queries", response_model=list[DocumentQueryRow])
async def list_document_queries(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),  # SERVICE-ROLE (classified): reads audit_log (no authenticated SELECT policy) — see module docstring
):
    """Return the caller's own searches that returned this document, within WINDOW_DAYS."""
    user_id = current_user["id"]
    try:
        res = await aexec(
            supabase.table("audit_log")
            .select("metadata, created_at")
            .eq("user_id", user_id)          # D-217-07: the SOLE gate, and the FIRST filter
            .eq("action_type", "search.query")
            .gte("created_at", _window_cutoff(WINDOW_DAYS))
            .contains("metadata", {"document_ids": [document_id]})
            .order("created_at", desc=True)
            .limit(MAX_ROWS)
        )

        rows: list[DocumentQueryRow] = []
        for row in (res.data or []):
            meta = row.get("metadata") or {}
            # Belt-and-braces beside the jsonb containment filter: the shipped
            # knowledge_health fetch-then-filter shape, so a containment miss can never
            # widen the result to another document's searches.
            if document_id not in (meta.get("document_ids") or []):
                continue
            rows.append(
                DocumentQueryRow(
                    query_text=meta.get("query_text") or None,
                    asked_at=row.get("created_at"),
                    via=meta.get("via") or None,
                )
            )
        return rows
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="The questions that found this document are temporarily unavailable",
        ) from exc

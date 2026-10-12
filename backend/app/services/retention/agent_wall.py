"""Phase 275 (RET-04 / D-18 / D-36) — the agent's document-read wall for archived and source-gone documents.

Migration 205 takes a non-retrievable document out of both search arms and out of model-written SQL.
The agent's OTHER doors name a document directly — ``read_document``, ``fetch_document_file``,
``attach_skill_file`` (by id) and ``analyze_document`` (by a resolved id). Each calls
``unretrievable`` once, beside the existing folder wall (``tool_dispatcher._doc_out_of_scope``), and
refuses with ``not_retrievable_result``.

⛔ THE CONTRACT.
  * One predicate: the STORED generated column ``RETRIEVABLE_COLUMN`` (migration 205). This module
    never restates the rule — it reads the column.
  * One batched read per call. An id the caller cannot see, or that does not exist, is NOT refused:
    the normal not-found path speaks (the ``_doc_out_of_scope`` shape).
  * A model-typed id that is not a UUID cannot name a document, so it costs no read.
  * A failed read fails CLOSED (every requested id is refused, and the failure is logged): an agent
    that cannot learn whether a document is archived must not read it.
  * The Library is untouched: this module is called from agent tool handlers only.
"""
from __future__ import annotations

import logging
from typing import Sequence
from uuid import UUID

from app.services.retrieval_scope import RETRIEVABLE_COLUMN
from app.utils.db import aexec

logger = logging.getLogger(__name__)

NOT_RETRIEVABLE_KIND = "not_retrievable"
NOT_RETRIEVABLE_ERROR = (
    "Document {id} is archived or no longer available at its source, so it can't be read here."
)


def _uuid_ids(ids: Sequence[str]) -> list[str]:
    out: dict[str, None] = {}
    for raw in ids or ():
        try:
            out.setdefault(str(UUID(str(raw))), None)
        except (ValueError, TypeError, AttributeError):
            continue  # not a document id — the normal not-found path speaks
    return list(out)


async def unretrievable(supabase, ids: Sequence[str]) -> set[str]:
    """The subset of ``ids`` the caller can see that is NOT retrievable (archived or source-gone)."""
    wanted = _uuid_ids(ids)
    if not wanted:
        return set()
    try:
        resp = await aexec(
            supabase.table("documents").select(f"id, {RETRIEVABLE_COLUMN}").in_("id", wanted)
        )
    except Exception as exc:  # noqa: BLE001 — fail CLOSED, never let an unknown state read content
        logger.warning("agent_wall: retrievability read failed for %s (%s); refusing", wanted, exc)
        return set(wanted)
    rows = getattr(resp, "data", None) or []
    return {str(r["id"]) for r in rows if isinstance(r, dict) and r.get(RETRIEVABLE_COLUMN) is False}


def not_retrievable_result(doc_id) -> dict:
    """The readable refusal, in the tool-result dict shape the other walls use."""
    return {"error": NOT_RETRIEVABLE_ERROR.format(id=doc_id), "error_kind": NOT_RETRIEVABLE_KIND}

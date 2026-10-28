"""Phase 299 (D-18 / D-38) — a write started from an item page lands in that item's org, or is
refused in words that name the org.

A link can open an item in another of the caller's orgs. If the caller then switches orgs by hand
while that page is open, a write the page starts would otherwise be stamped with the NEW active org
while the item lives in the old one. Three writes cannot take their org from a row, so they are
refused here instead: send / Continue on a chat, a workflow kickoff, and a Tweak (fork). The other
writes in the inventory (ask answer, new schedule, Deep Continue, Stop, Save draft, Expert
start-chat, Install, Handoff) already resolve their org from the row.

POLARITY (298 D-03): no active org resolved → no-op. A header-less caller is byte-identical to
today; this guard only ever narrows a request that named an org.

THIS IS A SEPARATE HELPER FROM ``threads._require_thread_org`` and never a widening of it. That one
gates an Expert thread and fails CLOSED when no org resolves; this one gates every other item and
fails OPEN when no org resolves. The send door calls both, the Expert one first.

299-REVIEW WR-01: the run sentence says to start the workflow from a NEW chat in its org, never
"switch to run it": refused on a chat in X, switching to Y and sending again on that SAME chat is
refused by the chat guard ("This chat is in X"), so that remedy could never succeed.

THE WORDS (UI-SPEC S8) name the org, then say what to do — never a status number or a status
word (the test lists the banned words). The org name is read only on a mismatch, with one statement on the pool;
the caller is a member of that org (the row is theirs, read under RLS), so naming it leaks nothing
(T-299-10). When the name cannot be read the sentence still says what to do.
"""
from __future__ import annotations

import inspect
import logging
from typing import Any

from fastapi import HTTPException

logger = logging.getLogger(__name__)

#: The org-named sentences, by the write they refuse.
REFUSALS = {
    "chat": "This chat is in {org}. Switch to {org} to keep chatting.",
    "run": "This workflow is in {org}. Switch to {org} and start it from a new chat there.",
    "tweak": "This workflow is in {org}. Switch to {org} to make your own copy.",
}

#: The same sentences when the org's name cannot be read.
REFUSALS_UNNAMED = {
    "chat": "This chat is in another of your organizations. Switch to it to keep chatting.",
    "run": "This workflow is in another of your organizations. Switch to it and start it from a new chat there.",
    "tweak": "This workflow is in another of your organizations. Switch to it to make your own copy.",
}

ORG_NAME_SQL = "SELECT name FROM public.organizations WHERE id = $1"


def _norm(value: Any) -> str:
    return str(value or "").strip().lower()


async def refuse_if_other_org(row_org_id: Any, active_org_id: Any, *, kind: str, pool: Any) -> None:
    """Raise the kind's worded refusal when the item's org differs from the resolved active org.

    No-op (and no I/O) when either id is empty. ``pool`` is an asyncpg pool, or a zero-argument
    async factory for one (``get_pg_pool``) — the factory is awaited only on a mismatch, so the
    no-op path never touches the database.
    """
    row, active = _norm(row_org_id), _norm(active_org_id)
    if not row or not active or row == active:
        return
    from uuid import UUID

    name = None
    try:
        if inspect.iscoroutinefunction(pool):
            pool = await pool()
        name = await pool.fetchval(ORG_NAME_SQL, UUID(row))
    except Exception:  # the refusal stands; only its wording degrades
        logger.warning("item_org_guard: org name unreadable for the %s refusal", kind, exc_info=True)
    detail = REFUSALS[kind].format(org=name) if name else REFUSALS_UNNAMED[kind]
    raise HTTPException(status_code=409, detail=detail)

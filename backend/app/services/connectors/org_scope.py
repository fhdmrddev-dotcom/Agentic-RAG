"""The one place chat resolves WHICH ORG a connector call is scoped to.

── ⚠ WHY THIS FILE EXISTS (2026-08-31) ────────────────────────────────────────────────
Two call sites — ``agent_loop.py`` (which tools the model is offered) and
``tool_dispatcher.py`` (which connection a call resolves against) — each carried their
own copy of the same twenty lines, and both copies ended the same two ways:

    except Exception:
        pass
    if not org_id:
        org_id = str(user_id)

Both arms are silent, and each one turns a DIFFERENT fault into the SAME innocent
outcome. A user id is not an org id, so it matches no ``connector_connections`` row —
which means "the membership read raised", "you belong to no org" and "this org has no
connections" all arrive at the person as **"Connector service 'google' is not connected
or not found."** The one thing a refusal owes the reader is which of those it was.

⚠ AND IT IS NOT A SECURITY HOLE, WHICH IS EXACTLY WHY IT SURVIVED. The fallback cannot
read another org's rows — it reads NOTHING. So no test failed, no log fired, and the
only symptom was a feature that looked switched off. Recorded here so the next reader
does not "simplify" the honest version back into the quiet one.

── WHAT THIS MODULE DOES NOT DECIDE ───────────────────────────────────────────────────
⚠ A PERSON IN TWO ORGS GETS THE FIRST ONE, AND THAT IS UNCHANGED BEHAVIOUR, NOT A
VERDICT. One account here is org-admin of one org and a member of another; the ordered read
below hands chat the OLDEST membership, so connections living in the second are
invisible in chat with no sentence anywhere saying so. Picking a
different one, or offering both, is a product decision (an org switcher already exists
for the REST surface — ``get_active_org_id`` reads ``X-Org-Id``, which a streaming chat
turn does not carry). This module makes the situation VISIBLE via
``OrgScope.membership_count`` and changes nothing about it.

This module opens no client of its own and constructs no connection: it is handed the
caller's supabase client and returns a value.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from app.utils.db import aexec

logger = logging.getLogger(__name__)

__all__ = ["OrgScope", "resolve_connector_org"]


@dataclass(frozen=True)
class OrgScope:
    """The resolved org for a connector call, or a sentence saying why there isn't one.

    Exactly one of ``org_id`` / ``problem`` is set. ``problem`` is written to be read by
    a person in a chat transcript, so it names the fault rather than the symptom.
    """

    org_id: str | None
    problem: str | None
    #: How many org memberships the caller has. ``0`` when unknown (the read failed).
    #: Only meaningful alongside a resolved ``org_id`` — see the module docstring.
    membership_count: int = 0

    @property
    def ok(self) -> bool:
        return self.org_id is not None


async def resolve_connector_org(current_user: dict | None, supabase) -> OrgScope:
    """Resolve the org whose connections this chat turn may see.

    Never falls back to the user id. A failure is returned AS a failure — the caller
    decides whether that means "offer no connector tools" (the agent loop, which still
    has its built-in tools) or "refuse this call in words" (the dispatcher).
    """
    user_id = (current_user or {}).get("id")
    if not user_id:
        return OrgScope(None, "there is no authenticated user on this request")

    # An org already resolved upstream wins — no second read, and no chance of the two
    # disagreeing. (Today's chat path does not populate it; a future one may.)
    upstream = (current_user or {}).get("org_id")
    if upstream:
        return OrgScope(str(upstream), None, membership_count=1)

    if getattr(supabase, "table", None) is None:
        return OrgScope(
            None,
            "the database client this request was given cannot read organisation "
            "membership",
        )

    try:
        res = await aexec(
            supabase.table("org_members")
            .select("org_id")
            .eq("user_id", str(user_id))
            .order("created_at")
        )
    except Exception as exc:  # noqa: BLE001 — a DB/RLS boundary, and the whole point
        # ⚠ NAMED, NOT SWALLOWED. An RLS denial and a dropped connection look identical
        # from here, but neither of them is "you have no connections".
        logger.warning(
            "connector org scope: reading org_members for user %s failed", user_id,
            exc_info=True,
        )
        return OrgScope(
            None,
            "your organisation membership could not be read "
            f"({exc.__class__.__name__}), so no connected service can be resolved",
        )

    rows = getattr(res, "data", None) or []
    if not rows:
        return OrgScope(
            None, "you are not a member of any organisation, so there are no connections"
        )

    first = rows[0].get("org_id")
    if not first:
        return OrgScope(
            None, "your organisation membership row carries no organisation id"
        )
    return OrgScope(str(first), None, membership_count=len(rows))

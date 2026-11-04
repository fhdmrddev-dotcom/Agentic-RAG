"""Phase 304 (KEY-05, KEY-06; D-18; T-304-13, T-304-18) — the ONE liveness predicate.

Every credential this app accepts on someone's behalf re-checks the same live facts on EVERY call,
in this order, with no cache:

    not revoked -> not expired -> owner still a member of the key's org -> owner not banned
    -> (MCP keys only) the org row exists -> the deployment's MCP switch is on
    -> the org's MCP switch is on

The first failing fact names the refusal. The two switches are checked deployment first (D-30,
304-REVIEW WR-03), the order the key screen uses, so a refused tool call and the screen name the
same switch when both are off. The key resolver core (``authenticate_presented_key``)
calls ``principal_still_allowed`` after its credential checks; 306/307/308 call
``recheck_principal`` at the start of each tool call so a key revoked mid-session stops on the
next call, not the next connection.

⚠ **A LEAF ON PURPOSE.** This module never imports the key resolver's module — the MCP server, the tool
runners and the long-running chat path import the predicate without pulling in the inbound door.

⚠ **MODULE-ATTRIBUTE CALLS, NOT NAME IMPORTS.** ``api_keys_db.is_org_member(...)`` and
``deps._is_banned(...)`` are looked up on their modules at call time, so the 293 suites'
monkeypatches of those attributes drive this predicate exactly as they drove the inline checks.

⚠ **THE SWITCHES ARE READ LIVE, NEVER THROUGH THE APP-SETTINGS CACHE** (304-RESEARCH R-09). That
cache is a 30 s per-worker TTL, which would break "refused on the next call". A missing org row,
a missing ``app_settings('global')`` row or a NULL switch REFUSES — an access gate fails CLOSED,
the opposite polarity to ``workflows_enabled()``'s default-ON capability toggle. A read that
raises propagates and admits nothing.

⚠ ``_is_banned`` fails OPEN by design (a DB blip must not lock out every user). That is safe only
because the membership check before it does not — never make the ban the only gate.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Mapping

from app import dependencies as deps
from app.db import api_keys as api_keys_db

MCP_OFF_ORG_SENTENCE = "MCP access is switched off for this organisation by an admin."
MCP_OFF_DEPLOYMENT_SENTENCE = "MCP access is switched off for this deployment by the operator."


@dataclass(frozen=True)
class Refusal:
    """Why a credential is no longer allowed. ``reason`` is the ``api_key.refused`` audit reason;
    ``sentence`` is set only where the caller may say it out loud (a switched-off org or
    deployment, D-19) — every credential failure otherwise answers the one identical 401."""

    reason: str
    sentence: str | None = None


async def principal_still_allowed(pool: Any, *, key_row: Mapping[str, Any]) -> Refusal | None:
    """``None`` when the key may act right now; otherwise the FIRST failing fact (D-18 order).

    ``key_row`` is an ``api_keys`` row (the auth lookup's, or ``get_key_row``'s). A row with no
    ``kind`` is a workflow key (pre-mig-220 shape) and never reads the MCP switches.
    """
    if key_row.get("revoked_at") is not None:
        return Refusal("revoked")
    expires_at = key_row.get("expires_at")
    if expires_at is not None and expires_at <= datetime.now(timezone.utc):
        return Refusal("expired")
    if not await api_keys_db.is_org_member(
        pool, org_id=key_row["org_id"], user_id=key_row["user_id"]
    ):
        return Refusal("not_member")
    if await deps._is_banned(str(key_row["user_id"])):
        return Refusal("banned")

    if key_row.get("kind", "workflow") != "mcp":
        return None

    switches = await api_keys_db.mcp_switches(pool, key_row["org_id"])
    if switches is None:  # no organisations row: refuse before reading either switch
        return Refusal("mcp_off_org", MCP_OFF_ORG_SENTENCE)
    # 304-REVIEW WR-03: the deployment's switch wins (D-30) — the same order the key screen's
    # ``api_keys._mcp_off`` applies, so a refused call and the card name the same switch.
    if switches.get("deploy_on") is not True:
        return Refusal("mcp_off_deployment", MCP_OFF_DEPLOYMENT_SENTENCE)
    if switches.get("org_on") is not True:
        return Refusal("mcp_off_org", MCP_OFF_ORG_SENTENCE)
    return None


async def recheck_principal(pool: Any, principal: Any) -> Refusal | None:
    """Re-read the principal's key row by id (in its org) and ask ``principal_still_allowed``.

    ``principal`` is anything with ``key_id`` and ``org_id`` (``mcp_principal.McpPrincipal``) —
    duck-typed so this leaf never imports the key module. A row that has vanished is refused as
    ``revoked``: a key nobody can find is a key nobody may use.
    """
    row = await api_keys_db.get_key_row(pool, key_id=principal.key_id, org_id=principal.org_id)
    if row is None:
        return Refusal("revoked")
    return await principal_still_allowed(pool, key_row=row)

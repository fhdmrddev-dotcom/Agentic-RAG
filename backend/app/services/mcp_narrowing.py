"""Phase 307-03 (D-13 / D-36 / T-307-25) — the ONE MCP narrowing validator.

An MCP credential — a personal key (Phase 304) or an OAuth grant (Phase 307) — is refused BEFORE
anything is minted when:

  1. the deployment or the org switch is off, or their state cannot be read (403, the
     ``principal_liveness`` sentences; the deployment's switch wins, D-30);
  2. the tool selection is empty, names an unknown tool, or ticks a companion without its lead
     (422, ``normalise_tool_selection``'s one sentence);
  3. a picked folder is not visible to the member in that org (422, one sentence for a foreign, a
     deleted and an unknown folder, so the refusal confirms nothing — T-304-28).

The block moved here VERBATIM from ``api/api_keys.py::_create_mcp_key``, in the same order, so the
key form and the consent page refuse by exactly the same rules (the move fence is
``test_307_narrowing_move.py``). No tier capability is checked: an MCP credential needs none
(304 D-41 / 307 D-36).

⛔ Folders are judged on the member's OWN acting visibility (RLS + the acting-org GUC), never the
service role. A caller may inject the reader (``visible_folders``): the key route passes its own so
its module-level seams stay the ones its suites patch.

A service, not a route: it imports no FastAPI and returns a value; each caller maps a refusal to its
own HTTP answer.
"""
from __future__ import annotations

from collections.abc import Awaitable, Callable, Iterable
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from app.db import api_keys as api_keys_db
from app.security.acting_member import acting_member_connection
from app.security.principal_liveness import MCP_OFF_DEPLOYMENT_SENTENCE, MCP_OFF_ORG_SENTENCE
from app.services.acting_member_reads import list_acting_folders
from app.services.mcp_tool_catalogue import normalise_tool_selection

__all__ = [
    "MCP_OFF_DEPLOYMENT_SENTENCE",
    "MCP_OFF_ORG_SENTENCE",
    "MCP_STATE_UNKNOWN_SENTENCE",
    "NarrowingOk",
    "NarrowingRefusal",
    "acting_visible_folder_ids",
    "mcp_off",
    "validate_mcp_narrowing",
]

# Phase 304 — a foreign, a deleted and an unknown folder all read this one sentence (T-304-28).
_FOLDER_NOT_VISIBLE = "One of the picked folders can't be found, or you can't see it."

# 304-REVIEW WR-02: the switches could not be read (a failed read, or no organisations row).
# Said in place of a switch's sentence, so the screen never names an off switch nobody read.
MCP_STATE_UNKNOWN_SENTENCE = "Couldn't check whether AI tool access is on. Reload to try again."


def mcp_off(switches: dict | None) -> str | None:
    """Which MCP switch is off — the deployment's wins (D-30), the order
    ``principal_still_allowed`` uses too. Anything not read as ``True`` is off (fail closed).
    No switch state at all (``None``) is ``"unknown"`` (WR-02): still off, but naming no switch."""
    if switches is None:
        return "unknown"
    if switches.get("deploy_on") is not True:
        return "deployment"
    if switches.get("org_on") is not True:
        return "org"
    return None


@dataclass(frozen=True)
class NarrowingOk:
    """The pick is allowed: the normalised tools (catalogue order, companions added), the folder
    ids as strings (``None`` = not narrowed by folder), and the switch row that was read."""

    tools: tuple[str, ...]
    folder_ids: list[str] | None
    switches: dict | None


@dataclass(frozen=True)
class NarrowingRefusal:
    """Refused: the HTTP status the caller answers with and its one plain sentence."""

    status: int
    detail: str


VisibleFolders = Callable[[str, str], Awaitable[set[str]]]


async def acting_visible_folder_ids(user_id: str, org_id: str) -> set[str]:
    """The ids of every folder the member can see in ``org_id``, on their OWN acting connection."""
    async with acting_member_connection(user_id=user_id, org_id=org_id) as conn:
        return {f["id"] for f in await list_acting_folders(conn)}


async def validate_mcp_narrowing(
    pool: Any,
    *,
    caller: UUID | str,
    org: UUID | str,
    tools: Iterable[str],
    folder_ids: Iterable[UUID | str] | None,
    visible_folders: VisibleFolders | None = None,
) -> NarrowingOk | NarrowingRefusal:
    """Switches (403) -> tools (422) -> folders (422), read live; see the module docblock."""
    switches = await api_keys_db.mcp_switches(pool, org)   # live, never the settings cache
    off = mcp_off(switches)
    if off == "unknown":   # no organisations row: refuse (fail closed) without naming a switch
        return NarrowingRefusal(status=403, detail=MCP_STATE_UNKNOWN_SENTENCE)
    if off == "deployment":
        return NarrowingRefusal(status=403, detail=MCP_OFF_DEPLOYMENT_SENTENCE)
    if off == "org":
        return NarrowingRefusal(status=403, detail=MCP_OFF_ORG_SENTENCE)

    selection = normalise_tool_selection(tools)
    if selection.refusal is not None or selection.tools is None:
        return NarrowingRefusal(status=422, detail=selection.refusal or "")

    picked: list[str] | None = None
    if folder_ids is not None:
        reader = visible_folders or acting_visible_folder_ids
        visible = await reader(str(caller), str(org))
        picked = [str(f) for f in folder_ids]
        if any(f not in visible for f in picked):
            return NarrowingRefusal(status=422, detail=_FOLDER_NOT_VISIBLE)

    return NarrowingOk(tools=tuple(selection.tools), folder_ids=picked, switches=switches)

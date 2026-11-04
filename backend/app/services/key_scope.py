"""Phase 304 (KEY-03, KEY-04; D-21, D-22, D-40; T-304-16) — the ONE composition of an MCP key's scope.

PURE: plain data in, a frozen value out. No I/O, no ``app.`` imports, never raises — the
``expert_scope.compose_expert_scope`` contract. Every MCP read (305/306/307) composes its scope
here, per call, from the member's CURRENTLY visible folders; nothing re-derives it elsewhere.

``KeyScope.folder_ids`` has three meanings, and two of them must never be confused:

* ``None`` — the key is NOT narrowed by folder: everything the member sees in the key's org
  (RLS + the acting-org GUC decide), global folders included (D-22).
* a non-empty tuple — the visible subtrees of the ticked folders. Resolved per call, so a subfolder
  created after the key was minted is included (D-21). A ticked folder the member can no longer
  see is dropped. An org-shared or global folder is in scope only when it is itself ticked or sits
  under a ticked folder; root documents (no folder) are out.
* ``()`` — narrowed, and nothing survived. It matches NOTHING. ⛔ It is never turned into the
  "not narrowed" value: that is the 266 CR-01 / 272 D-18 class, where nothing silently became
  everything. The retrieval RPC wrappers already answer ``()`` with no rows and no DB call.

Connector-fed content (D-40, refining D-23) has ONE home, here: a document is connector-fed when
``documents.source_connection_id IS NOT NULL`` — stamped by every connector path (watched sync,
one-off import, preview, splice, mail attachments, which inherit the parent's). ``EXTERNAL_SQL``
is the SQL fragment and ``is_external`` the Python predicate over the same column.
``connector_watches.library_folder_id`` is a UI hint on the key screen only, never a server rule.
Search applies the predicate as a POST-filter on returned rows, never as a ``document_ids``
allow-list (that switches retrieval into filtered mode and changes ranking).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Sequence

EXTERNAL_COLUMN = "source_connection_id"
EXTERNAL_SQL = f"{EXTERNAL_COLUMN} IS NOT NULL"


def is_external(row: Mapping[str, Any]) -> bool:
    """Is this document row connector-fed? (``source_connection_id`` set; missing = no.)"""
    return row.get(EXTERNAL_COLUMN) is not None


@dataclass(frozen=True)
class KeyScope:
    folder_ids: tuple[str, ...] | None   # None = not narrowed; () = nothing (see the docblock)
    exclude_external: bool
    tools: frozenset[str]


def _visible_subtrees(roots: list[str], visible_folders: Sequence[Mapping[str, Any]]) -> tuple[str, ...]:
    """Every visible folder at or under ``roots``, sorted and unique. Mirrors
    ``expert_scope._get_subtree`` with a visited set, so a parent cycle terminates."""
    children: dict[str, list[str]] = {}
    for folder in visible_folders:
        fid = folder.get("id")
        if fid is None:
            continue
        parent = folder.get("parent_id")
        if parent is not None:
            children.setdefault(str(parent), []).append(str(fid))

    seen: set[str] = set()
    stack = list(roots)
    while stack:
        current = stack.pop()
        if current in seen:
            continue
        seen.add(current)
        stack.extend(children.get(current, ()))
    return tuple(sorted(seen))


def compose_key_scope(
    *,
    key_folder_ids: Sequence[str] | None,
    include_external: bool,
    tools: Sequence[str],
    visible_folders: Sequence[Mapping[str, Any]],
) -> KeyScope:
    """Compose one MCP key's scope from plain data. Pure; never raises; no I/O.

    ``visible_folders`` is the member's folders as read on the ACTING connection (RLS + the
    acting-org GUC), never ``fetch_visible_folders`` on the service role.
    """
    tool_set = frozenset(str(t) for t in tools)
    exclude_external = not include_external
    if key_folder_ids is None:
        return KeyScope(folder_ids=None, exclude_external=exclude_external, tools=tool_set)

    visible_ids = {str(f["id"]) for f in visible_folders if f.get("id") is not None}
    kept_roots = [str(fid) for fid in key_folder_ids if str(fid) in visible_ids]
    return KeyScope(
        folder_ids=_visible_subtrees(kept_roots, visible_folders),
        exclude_external=exclude_external,
        tools=tool_set,
    )

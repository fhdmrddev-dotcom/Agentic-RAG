"""Phase 304 (D-38) — the narrowed reads an MCP key makes, as its owner, in ONE org.

THE RULE: every read here runs on the acting connection
(``app.security.acting_member.acting_member_connection``), and RLS + the ``app.acting_org_id`` GUC
is the ONLY visibility rule. Concretely:

  · one SQL statement on the passed connection — the table's own RLS policy decides what the
    member sees, and ``current_user_org_ids()`` (mig 221) narrows it to the acting org;
  · never the service role for visibility, and never ``org_members`` or a Python org predicate —
    a second visibility rule is how a narrowed read silently re-widens;
  · never supabase-py (PostgREST never sees the GUC), except the two sanctioned calls plan 304-03
    adds, each of which only enriches or proposes ids an acting-connection statement already
    decided.

A static fence (``tests/unit/test_304_acting_reads_fence.py``) holds this module to those rules.
This plan ships one read (folders); 304-03 adds the rest.
"""

from __future__ import annotations

from typing import Any

from app.utils.folder_utils import _null_foreign_global_owner

_FOLDERS_SQL = (
    "SELECT id, name, parent_id, is_org_shared, org_id, user_id, auth.uid() AS caller_id "
    "FROM public.folders ORDER BY name, id"
)


def _s(value: Any) -> str | None:
    return None if value is None else str(value)


async def list_acting_folders(conn: Any) -> list[dict]:
    """Every folder the member can see in the acting org (RLS decides), owner-masked.

    The caller is read from the connection's own claims (``auth.uid()``) in the same statement, so
    no argument can name a different user. Ids are returned as strings.
    """
    records = await conn.fetch(_FOLDERS_SQL)
    if not records:
        return []
    caller = _s(records[0]["caller_id"])
    rows = [
        {
            "id": _s(r["id"]),
            "name": r["name"],
            "parent_id": _s(r["parent_id"]),
            "is_org_shared": bool(r["is_org_shared"]),
            "org_id": _s(r["org_id"]),
            "user_id": _s(r["user_id"]),
        }
        for r in records
    ]
    return _null_foreign_global_owner(rows, caller)

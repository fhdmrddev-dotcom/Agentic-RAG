"""Phase 304 (D-38) — the narrowed reads an MCP key makes, as its owner, in ONE org.

THE RULE: every read here runs on the acting connection
(``app.security.acting_member.acting_member_connection``), and RLS + the ``app.acting_org_id`` GUC
is the ONLY visibility rule. Concretely:

  · one SQL statement on the passed connection — the table's own RLS policy decides what the
    member sees, and ``current_user_org_ids()`` (mig 221) narrows it to the acting org;
  · never the service role for visibility, and never the membership table or a Python org
    predicate — a second visibility rule is how a narrowed read silently re-widens;
  · never supabase-py (PostgREST never sees the GUC), except the two sanctioned calls plan 304-03
    adds, each of which only enriches or proposes ids an acting-connection statement already
    decided.

On top of RLS sits the key's own narrowing, ``KeyScope`` (``app.services.key_scope``), composed PER
CALL from the folders the member can see right now (D-21: a subfolder created after the key is in
scope on the next call). It can only remove: a folder subtree (``()`` matches nothing and returns
before any SQL — never "everything") and connector-fed documents (``EXTERNAL_SQL``, D-40).

Each read first checks that the key carries the catalogue tool it serves (KEY-03, ``READ_TOOL``);
a key without it is refused with ``ToolNotGranted`` before anything is read.

A static fence (``tests/unit/test_304_acting_reads_fence.py``) holds this module to those rules;
the live proof is ``tests/integration/test_304_two_org_parity_live.py`` (parity with the app's
active-org reads, as a non-owner member of two orgs) and ``test_304_narrowed_key_live.py``.
"""

from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from app.db.workflows import list_published_workflows
from app.security.acting_member import acting_member_connection
from app.services.key_scope import EXTERNAL_SQL, KeyScope, compose_key_scope
from app.utils.folder_utils import _null_foreign_global_owner

_FOLDERS_SQL = (
    "SELECT id, name, parent_id, is_org_shared, org_id, user_id, auth.uid() AS caller_id "
    "FROM public.folders ORDER BY name, id"
)

#: Which catalogue tool (``mcp_tool_catalogue.MCP_TOOLS``) each read serves (KEY-03).
READ_TOOL: dict[str, str] = {
    "list_folders": "list_documents",
    "list_documents": "list_documents",
    "list_views": "list_documents",
    "view_documents": "list_documents",
    "read_document": "read_document",
    "related_documents": "read_document",
    "search": "search_knowledge_base",
    "list_workflows": "list_workflows",
}

#: ``GET /documents``'s LIST_SELECT, as SQL over ``public.library_documents`` (mig 207: own
#: documents ∪ documents in org-shared folders, security_invoker, so RLS applies beneath it).
#: The two embedded counts become scalar subqueries; RLS on those tables is owner-only, the same
#: asymmetry the route documents.
_LIST_COLUMNS = (
    "d.id, d.user_id, d.folder_id, d.filename, d.file_path, d.file_size, d.mime_type, d.status, "
    "d.error_message, d.chunk_count, d.content_hash, d.version_number, d.is_latest, d.metadata, "
    "d.created_at, d.updated_at, d.extractor, d.source_connection_id, d.ingestion_step, "
    "d.page_count, d.source_created_at, d.source_modified_at, d.source_author, d.archived_at, "
    "d.archived_policy_id, d.archived_policy_name, d.retrievable, "
    "(SELECT count(*)::int FROM public.document_tables t WHERE t.document_id = d.id) AS table_count, "
    "(SELECT count(*)::int FROM public.document_images i WHERE i.document_id = d.id) AS image_count"
)

_READ_COLUMNS = (
    "d.id, d.user_id, d.org_id, d.folder_id, d.filename, d.mime_type, d.status, d.metadata, "
    "d.version_number, d.source_connection_id, d.created_at, d.updated_at, d.page_count, "
    "d.full_markdown"
)


class ToolNotGranted(Exception):
    """The key does not carry the catalogue tool this read serves (KEY-03)."""

    def __init__(self, tool: str):
        super().__init__(tool)
        self.tool = tool


def _s(value: Any) -> str | None:
    return None if value is None else str(value)


def _uuid_or_none(value: Any) -> str | None:
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        return None


def _require(principal: Any, read: str) -> None:
    tool = READ_TOOL[read]
    if tool not in tuple(principal.tools or ()):
        raise ToolNotGranted(tool)


def _plain(record: Any) -> dict:
    """A record as a dict with every UUID as a string (the JSON shape a tool returns)."""
    return {k: (str(v) if isinstance(v, uuid.UUID) else v) for k, v in dict(record).items()}


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


def _scope_from(principal: Any, folders: list[dict]) -> KeyScope:
    return compose_key_scope(
        key_folder_ids=principal.folder_ids,
        include_external=principal.include_external,
        tools=principal.tools,
        visible_folders=folders,
    )


@asynccontextmanager
async def _acting(principal: Any) -> AsyncIterator[tuple[Any, KeyScope, list[dict]]]:
    """The acting connection, the member's visible folders in the key's org, and the key's scope
    composed from them — per call, so later subfolders count and vanished ones drop (D-21)."""
    async with acting_member_connection(user_id=principal.user_id, org_id=principal.org_id) as conn:
        folders = await list_acting_folders(conn)
        yield conn, _scope_from(principal, folders), folders


def _scope_clauses(scope: KeyScope, args: list, *, alias: str = "d") -> list[str]:
    """The key's narrowing as SQL. Values are bound as ``$N``; only placeholder indices are built."""
    clauses: list[str] = []
    if scope.folder_ids is not None:
        args.append(list(scope.folder_ids))
        clauses.append(f"{alias}.folder_id = ANY(${len(args)}::uuid[])")
    if scope.exclude_external:
        clauses.append(f"NOT ({alias}.{EXTERNAL_SQL})")
    return clauses


def _nothing(scope: KeyScope) -> bool:
    """Narrowed, and nothing survived: answer empty with no SQL (``()`` is never "everything")."""
    return scope.folder_ids is not None and len(scope.folder_ids) == 0


async def _page(conn: Any, scope: KeyScope, *, limit: int, offset: int, ids: list[str] | None = None) -> dict:
    """One page of the Library list (``GET /documents``'s order and page contract) + exact total."""
    args: list = []
    where = ["d.is_latest", "d.archived_at IS NULL"]
    if ids is not None:
        args.append(ids)
        where.append(f"d.id = ANY(${len(args)}::uuid[])")
    where += _scope_clauses(scope, args)
    predicate = " AND ".join(where)
    total = await conn.fetchval(f"SELECT count(*) FROM public.library_documents d WHERE {predicate}", *args)
    args += [int(limit), int(offset)]
    rows = await conn.fetch(
        f"SELECT {_LIST_COLUMNS} FROM public.library_documents d WHERE {predicate} "
        f"ORDER BY d.created_at DESC, d.id DESC LIMIT ${len(args) - 1} OFFSET ${len(args)}",
        *args,
    )
    return {"items": [_plain(r) for r in rows], "total": int(total or 0)}


# ── the reads ──────────────────────────────────────────────────────────────────────────────────


async def list_folders(principal: Any) -> list[dict]:
    """The folders the key can see: the member's folders in the key's org, cut to the key's
    subtrees when it is narrowed."""
    _require(principal, "list_folders")
    async with _acting(principal) as (_conn, scope, folders):
        if scope.folder_ids is None:
            return folders
        keep = set(scope.folder_ids)
        return [f for f in folders if f["id"] in keep]


async def list_documents(principal: Any, *, limit: int = 50, offset: int = 0) -> dict:
    """``{items, total}`` — the Library's latest, unarchived documents in the key's org, newest
    first; narrowed keys see only their subtrees (Root documents are out), connector-fed
    documents only with ``include_external``."""
    _require(principal, "list_documents")
    async with _acting(principal) as (conn, scope, _folders):
        if _nothing(scope):
            return {"items": [], "total": 0}
        return await _page(conn, scope, limit=limit, offset=offset)


async def read_document(principal: Any, document_id: Any) -> dict | None:
    """One document with its full text, or ``None``. Unreadable, foreign (another org), out of the
    key's scope, superseded and malformed ids all return the SAME ``None`` (one not-found)."""
    _require(principal, "read_document")
    doc_id = _uuid_or_none(document_id)
    if doc_id is None:
        return None
    async with _acting(principal) as (conn, scope, _folders):
        if _nothing(scope):
            return None
        args: list = [doc_id]
        where = ["d.id = $1::uuid", "d.is_latest"] + _scope_clauses(scope, args)
        row = await conn.fetchrow(
            f"SELECT {_READ_COLUMNS} FROM public.documents d WHERE {' AND '.join(where)}", *args
        )
    return _plain(row) if row is not None else None


async def list_workflows(principal: Any) -> list[dict]:
    """The published workflows the member may start in the key's org (system globals included) —
    the app's own feed (``db.workflows.list_published_workflows``), run on the acting connection
    so RLS and the GUC apply too. ``created_by`` is reduced to the app's one bit, ``is_mine``."""
    _require(principal, "list_workflows")
    async with acting_member_connection(user_id=principal.user_id, org_id=principal.org_id) as conn:
        rows = await list_published_workflows(
            conn, user_id=uuid.UUID(principal.user_id), org_id=uuid.UUID(principal.org_id)
        )
    out = []
    for r in rows:
        row = _plain(r)
        row["is_mine"] = row.pop("created_by", None) == str(principal.user_id)
        out.append(row)
    return out

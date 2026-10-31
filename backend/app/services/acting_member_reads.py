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

The MCP reader is an AGENT, so every document read here applies mig 205's agent rule,
``documents.retrievable`` (archived and source-gone documents leave every agent read) — the same
rule search's RPCs apply (D-46, 304-REVIEW WR-01; it supersedes D-31's Library parity for archived
and source-gone documents on this path only).

Each read first checks that the key carries the catalogue tool it serves (KEY-03, ``READ_TOOL``);
a key without it is refused with ``ToolNotGranted`` before anything is read.

A static fence (``tests/unit/test_304_acting_reads_fence.py``) holds this module to those rules;
the live proof is ``tests/integration/test_304_two_org_parity_live.py`` (parity with the app's
active-org reads, as a non-owner member of two orgs) and ``test_304_narrowed_key_live.py``.
"""

from __future__ import annotations

import json
import uuid
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from starlette.concurrency import run_in_threadpool

from app.db.workflows import list_published_workflows
from app.dependencies import get_service_role_supabase
from app.models.user_settings import load_user_settings
from app.security.acting_member import acting_as, acting_member_connection
from app.services import retrieval_scope, retrieval_service
from app.services.document_relationship_service import _INVERSE_LABEL, _NO_ACCESS_MASK
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


async def _page(
    conn: Any, scope: KeyScope, *, limit: int, offset: int, ids: list[str] | None = None,
    folder_id: str | None = None, root_only: bool = False,
) -> dict:
    """One page of the Library list (``GET /documents``'s order and page contract) + exact total.

    305-02 (D-51): ``folder_id`` (already validated) narrows to one folder, ``root_only`` to the
    documents in no folder. Both are predicates NARROWER than RLS, appended after the key's scope
    clauses, so the ``KeyScope`` still applies; the value is bound as ``$N``, never interpolated."""
    args: list = []
    where = ["d.is_latest", "d.retrievable"]  # D-46: the agent rule (mig 205), not Library parity
    if ids is not None:
        args.append(ids)
        where.append(f"d.id = ANY(${len(args)}::uuid[])")
    where += _scope_clauses(scope, args)
    if folder_id is not None:
        args.append(folder_id)
        where.append(f"d.folder_id = ${len(args)}::uuid")
    elif root_only:
        where.append("d.folder_id IS NULL")
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


async def list_documents(
    principal: Any, *, limit: int = 50, offset: int = 0, folder_id: str | None = None,
    root_only: bool = False,
) -> dict:
    """``{items, total}`` — the Library's latest, RETRIEVABLE documents in the key's org (D-46:
    archived and source-gone ones are out, as for every agent read), newest first; narrowed keys
    see only their subtrees (Root documents are out), connector-fed documents only with
    ``include_external``.

    305-02 (D-51, one additive change): ``folder_id`` lists one folder's documents and
    ``root_only`` the documents in no folder — the MCP ``list_documents`` tool pages through
    folders with them. A malformed ``folder_id`` is an empty page before any SQL. The defaults keep
    every existing caller byte-identical."""
    _require(principal, "list_documents")
    fid = None
    if folder_id is not None:
        fid = _uuid_or_none(folder_id)
        if fid is None:
            return {"items": [], "total": 0}
    async with _acting(principal) as (conn, scope, _folders):
        if _nothing(scope):
            return {"items": [], "total": 0}
        return await _page(conn, scope, limit=limit, offset=offset, folder_id=fid, root_only=root_only)


async def read_document(principal: Any, document_id: Any) -> dict | None:
    """One document with its full text, or ``None``. Unreadable, foreign (another org), out of the
    key's scope, superseded, archived or source-gone (D-46) and malformed ids all return the SAME
    ``None`` (one not-found)."""
    _require(principal, "read_document")
    doc_id = _uuid_or_none(document_id)
    if doc_id is None:
        return None
    async with _acting(principal) as (conn, scope, _folders):
        if _nothing(scope):
            return None
        args: list = [doc_id]
        where = ["d.id = $1::uuid", "d.is_latest", "d.retrievable"] + _scope_clauses(scope, args)
        row = await conn.fetchrow(
            f"SELECT {_READ_COLUMNS} FROM public.documents d WHERE {' AND '.join(where)}", *args
        )
    return _plain(row) if row is not None else None


async def _compose(principal: Any) -> tuple[KeyScope, list[dict]]:
    async with _acting(principal) as (_conn, scope, folders):
        return scope, folders


async def search(principal: Any, query: str, *, user_settings: Any = None) -> list[dict]:
    """The app's own retrieval (``retrieval_service.search_documents``), run inside
    ``acting_as(principal)`` so its RPCs open GUC-narrowed RLS connections, with the key's folder
    subtrees as ``folder_ids``.

    Connector-fed rows are dropped AFTERWARDS (D-40): one statement on the acting connection keeps
    the returned documents that are visible and not connector-fed. Never an allow-list into
    retrieval — that would switch it into filtered mode and rank differently from the app. The
    cost is under-return (fewer than ``top_k`` rows when connector-fed rows ranked high), which is
    safe and is exactly ``[r for r in app_result if not external(r)]``.

    The service-role client handed in is used by retrieval ONLY to enrich filenames of rows the
    acting connection's RPC already returned. 305-02 (D-57, 304-REVIEW IN-03): it is built with
    ``await run_in_threadpool(...)`` — building a supabase-py client is blocking I/O and must stay
    off the event loop (D-v2.5-01); the 304 fence pins the threadpooled variable as the argument.
    """
    _require(principal, "search")
    scope, _folders = await _compose(principal)
    if _nothing(scope):
        return []
    if user_settings is None:
        # the member's effective settings, loaded the way the app's own search path loads them
        user_settings = await run_in_threadpool(load_user_settings, principal.user_id)
    folder_ids = list(scope.folder_ids) if scope.folder_ids is not None else None
    client = await run_in_threadpool(get_service_role_supabase, principal.org_id)
    with acting_as(principal):
        rows, _avg = await retrieval_service.search_documents(
            query, principal.user_id, client,
            user_settings=user_settings, folder_ids=folder_ids,
        )
    if not rows or not scope.exclude_external:
        return rows
    returned = sorted({str(r.get("document_id")) for r in rows if _uuid_or_none(r.get("document_id"))})
    async with acting_member_connection(user_id=principal.user_id, org_id=principal.org_id) as conn:
        kept = {str(r["id"]) for r in await conn.fetch(
            f"SELECT d.id FROM public.documents d WHERE d.id = ANY($1::uuid[]) AND NOT (d.{EXTERNAL_SQL})",
            returned,
        )}
    return [r for r in rows if str(r.get("document_id")) in kept]


async def list_views(principal: Any) -> list[dict]:
    """The member's saved views in the key's org plus the system-global ones (RLS decides). A
    global view's seeding owner and its folder scope are masked, as the app's list masks them.

    D-47 (304-REVIEW WR-04): a NARROWED key lists only views whose own folder scope lies inside
    the key's subtrees (``scope.folder_ids`` is already the expanded subtree set ``list_folders``
    uses). A view with NO folder scope is hidden from a narrowed key — fail closed, since view
    names and filters are member-authored free text (D-22: a narrowed key sees only its ticked
    folders' subtrees). An all-folders key is unchanged."""
    _require(principal, "list_views")
    async with _acting(principal) as (conn, scope, _folders):
        if _nothing(scope):
            return []
        records = await conn.fetch(
            "SELECT v.id, v.user_id, v.name, v.filter_expr, v.folder_scope, v.is_system_global, "
            "auth.uid() AS caller_id FROM public.document_views v ORDER BY v.name, v.id"
        )
    keep = set(scope.folder_ids) if scope.folder_ids is not None else None
    out = []
    for r in records:
        row = _plain(r)
        if keep is not None and _s(row.get("folder_scope")) not in keep:
            continue  # outside the key's subtrees, or unscoped (``None`` is never in ``keep``)
        caller = row.pop("caller_id", None)
        if row.get("is_system_global") and row.get("user_id") != caller:
            row["user_id"] = None
            row["folder_scope"] = None
        out.append(row)
    return out


def _view_folders(view_scope: Any, scope: KeyScope, folders: list[dict]) -> list[str] | None:
    """The folder ids a view resolves over through this key: the view's own folder scope (its
    visible subtree) intersected with the key's subtrees. ``None`` = no folder restriction.

    The view's scope mirrors the app's rule (D-113-5): a view folder the member cannot see narrows
    nothing. The KEY's scope is never relaxed that way — it still applies, and an empty
    intersection is ``[]`` (matches nothing)."""
    view_subtree: tuple[str, ...] | None = None
    if view_scope is not None:
        reachable = compose_key_scope(
            key_folder_ids=[str(view_scope)], include_external=True, tools=(), visible_folders=folders
        ).folder_ids
        if reachable:
            view_subtree = reachable
    if scope.folder_ids is None:
        return list(view_subtree) if view_subtree is not None else None
    if view_subtree is None:
        return list(scope.folder_ids)
    keep = set(scope.folder_ids)
    return [fid for fid in view_subtree if fid in keep]


async def view_documents(principal: Any, view_id: Any, *, limit: int = 50, offset: int = 0) -> dict:
    """``{items, total}`` — one page of a saved view's documents through this key.

    The view row is read on the acting connection (another org's view, or one the member cannot
    see, is empty). Its conditions resolve through the app's ``retrieval_scope.resolve_document_scope``
    inside ``acting_as``: step 1 (service role) only PROPOSES ids, step 2 on the GUC-narrowed RLS
    connection DECIDES. The decided ids are then paged through the same Library list SQL, with the
    key's scope applied again."""
    _require(principal, "view_documents")
    empty = {"items": [], "total": 0}
    vid = _uuid_or_none(view_id)
    if vid is None:
        return empty
    async with _acting(principal) as (conn, scope, folders):
        view = await conn.fetchrow(
            "SELECT v.filter_expr, v.folder_scope FROM public.document_views v WHERE v.id = $1::uuid", vid
        )
    if view is None or _nothing(scope):
        return empty
    flt = view["filter_expr"]
    if isinstance(flt, str):
        flt = json.loads(flt)
    conditions = list((flt or {}).get("conditions") or [])
    folder_ids = _view_folders(view["folder_scope"], scope, folders)
    if folder_ids is not None and len(folder_ids) == 0:
        return empty
    with acting_as(principal):
        resolved = await retrieval_scope.resolve_document_scope(
            user_id=principal.user_id, conditions=conditions, folder_ids=folder_ids,
            supabase=get_service_role_supabase(principal.org_id),
        )
    ids = list(resolved.document_ids)
    if not ids:
        return empty
    async with acting_member_connection(user_id=principal.user_id, org_id=principal.org_id) as conn:
        return await _page(conn, scope, limit=limit, offset=offset, ids=ids)


async def related_documents(principal: Any, document_id: Any) -> dict | None:
    """A document's typed links, outgoing then incoming, or ``None`` when the subject is not
    readable through this key (the same not-found as ``read_document``).

    Edges are the member's own (RLS) over the subject's whole version lineage. Each other endpoint
    is followed to its latest version and shown only when that version is readable through the
    key (RLS + the key's scope); otherwise it renders as the app's no-access mask, with no id and
    no filename. Incoming edges carry the app's inverse label."""
    _require(principal, "related_documents")
    doc_id = _uuid_or_none(document_id)
    if doc_id is None:
        return None
    async with _acting(principal) as (conn, scope, _folders):
        if _nothing(scope):
            return None
        args: list = [doc_id]
        where = ["d.id = $1::uuid", "d.is_latest", "d.retrievable"] + _scope_clauses(scope, args)
        subject = await conn.fetchrow(
            f"SELECT d.id, d.user_id, d.filename FROM public.documents d WHERE {' AND '.join(where)}", *args
        )
        if subject is None:
            return None
        versions = [r["id"] for r in await conn.fetch(
            "SELECT d.id FROM public.documents d WHERE d.user_id = $1 AND d.filename = $2",
            subject["user_id"], subject["filename"],
        )] or [subject["id"]]
        edges = await conn.fetch(
            "SELECT r.id, r.source_doc_id, r.target_doc_id, r.rel_type FROM public.document_relationships r "
            "WHERE r.source_doc_id = ANY($1::uuid[]) OR r.target_doc_id = ANY($1::uuid[]) "
            "ORDER BY r.created_at, r.id",
            versions,
        )
        lineage = {str(v) for v in versions}
        links: list[tuple[Any, str, str]] = []
        for direction, mine, other in (("outgoing", "source_doc_id", "target_doc_id"),
                                       ("incoming", "target_doc_id", "source_doc_id")):
            links += [(e, direction, str(e[other])) for e in edges if str(e[mine]) in lineage]
        endpoints: dict[str, dict] = {}
        others = sorted({other for _e, _d, other in links})
        if others:
            end_args: list = [others]
            end_where = ["d.id = ANY($1::uuid[])"] + _scope_clauses(scope, end_args, alias="l")
            for r in await conn.fetch(
                "SELECT d.id AS asked_id, l.id, l.filename FROM public.documents d "
                "JOIN LATERAL (SELECT e.id, e.filename, e.folder_id, e.source_connection_id "
                "FROM public.documents e WHERE e.user_id = d.user_id AND e.filename = d.filename "
                "AND e.is_latest AND e.retrievable ORDER BY e.version_number DESC LIMIT 1) l ON true "
                f"WHERE {' AND '.join(end_where)}",
                *end_args,
            ):
                endpoints[str(r["asked_id"])] = {"id": str(r["id"]), "filename": r["filename"]}

    compact: list[dict] = []
    source_refs: list[dict] = []
    for edge, direction, other in links:
        rel_type = edge["rel_type"]
        label = rel_type if direction == "outgoing" else _INVERSE_LABEL.get(rel_type, rel_type)
        seen = endpoints.get(other)
        compact.append({
            "document_id": seen["id"] if seen else None,
            "filename": seen["filename"] if seen else _NO_ACCESS_MASK,
            "rel_type": rel_type,
            "direction": direction,
            "label": label,
            "relationship_id": str(edge["id"]),
        })
        if seen:
            source_refs.append({"document_id": seen["id"], "filename": seen["filename"]})
    return {
        "subject": {"document_id": str(subject["id"]), "filename": subject["filename"]},
        "total": len(compact),
        "documents": compact,
        "source_refs": source_refs,
    }


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

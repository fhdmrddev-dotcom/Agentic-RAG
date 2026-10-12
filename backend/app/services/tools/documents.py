"""Knowledge-base document tools: ``ls`` / ``tree`` / ``grep`` / ``glob`` / ``read_document``,
``fetch_document_file``, ``query_documents``, ``query_documents_by_view``,
``get_related_documents``, ``web_search`` and ``analyze_document`` — plus the 262-UAT folder
wall every one of them applies, and the lazily bound view-resolver sentinels.

Moved VERBATIM out of ``tool_dispatcher.py`` in Phase 278 (SEAM-03, a pure move): every binding
here is AST-identical to its PHASE_BASE source, proven by ``tests/unit/test_278_pure_move.py``.
``tool_dispatcher.py`` keeps the registry: it imports the handlers below BY NAME into its static
``_TOOL_REGISTRY`` literal (Extension Contract — never registered dynamically).

⚠ PATCH-WHERE-USED: the bodies in this module resolve these names from THIS module's globals —
``run_in_threadpool``, ``aexec``, ``ls_path``, ``tree_path``, ``grep_path``, ``glob_path``,
``read_path``, ``get_globally_visible_folder_ids``, ``resolve_document_id``,
``fetch_full_document``, ``not_retrievable_result``, ``unretrievable``, ``web_search``,
``run_sub_agent``, ``write_audit_entry``, ``sandbox_manager``, ``settings``,
``_SUB_AGENT_MODEL_DEFAULTS``, ``query_documents``, ``ViewFilter``, ``document_view_service``,
``document_relationship_service``, ``_normalize_optional_int``. Patch
``app.services.tools.documents.<name>``; a patch of the same name on ``tool_dispatcher`` no longer
reaches the code that calls it (and, because the registry module no longer imports them, raises
``AttributeError`` instead of silently patching nothing).

⚠ ``_ensure_resolver`` binds ``resolve_filter`` / ``ResolveError`` / ``_build_field_meta`` into
THIS module's globals (it reads ``globals()``), so a test patches
``app.services.tools.documents.resolve_filter`` — the name the view handler calls.

⛔ Import-cycle rule: no module-level import of ``app.services.tool_dispatcher`` here (the
dispatcher imports this module at load). Cross-family helpers are imported BY NAME from their
``app.services.tools.<family>`` home, never through the dispatcher.
"""
from __future__ import annotations

import json
import logging

from starlette.concurrency import run_in_threadpool

from app.utils.db import aexec
from app.api.kb import ls_path, tree_path, grep_path, glob_path, read_path
# Phase 151 (FILE-02) — owner→global doc-scope fallback (mirrors read_path). Module-level
# (patch-where-used friendly) and cycle-safe: folder_utils imports only dependencies/db,
# never tool_dispatcher.
from app.utils.folder_utils import get_globally_visible_folder_ids
from app.services.retrieval_service import resolve_document_id, fetch_full_document
# Phase 275 (D-18 / D-36) — the archived / source-gone wall, one call beside each folder wall
from app.services.retention.agent_wall import not_retrievable_result, unretrievable
from app.services.web_search_service import web_search
from app.services.sub_agent_service import run_sub_agent
from app.services.audit_service import write_audit_entry
from app.services.sandbox_service import sandbox_manager
from app.config import settings, _SUB_AGENT_MODEL_DEFAULTS
from app.services.sql_service import query_documents
# Phase 115 (VIEW-07) — the query_documents_by_view handler reuses the 113/114 leak-safe
# resolve core IN-PROCESS (no FastAPI self-call). ``ViewFilter`` + the two view/field
# services are cycle-safe at module level (they import only pydantic/dependencies/db).
# ``resolve_filter`` / ``ResolveError`` / ``_build_field_meta`` live in
# ``document_view_resolver``, which transitively imports ``harness.scope`` →
# ``task_service`` → back to THIS module — a real import cycle if pulled at module load.
# They are bound LAZILY via ``_ensure_resolver()`` into THESE module globals (sentinels
# below) so (a) the cycle is broken and (b) the unit-test ``monkeypatch.setattr(td,
# "resolve_filter", ...)`` still targets the exact name the handler calls (patch-where-used:
# a non-None monkeypatched value is preserved, never re-imported).
from app.models.document_view import ViewFilter
from app.services import document_view_service
# Phase 116 (REL-04) — get_related_documents reuses the SAME shared resolver
# (_resolve_readable_latest) IN-PROCESS for leak-safe per-viewer masking. The
# relationship service imports only pydantic/dependencies/db/folder_utils → cycle-safe
# at module level (unlike document_view_resolver, which transitively pulls harness).
from app.services import document_relationship_service
from app.services.tools.base import ToolContext, ToolResult
from app.services.tools.workspace import _normalize_optional_int

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Phase 115 (VIEW-07) — lazy resolver binding (cycle-break + monkeypatch-friendly)
# ---------------------------------------------------------------------------
# Sentinels: bound on first use by _ensure_resolver(). Declared at module scope so a
# test can `monkeypatch.setattr(td, "resolve_filter", spy)` and the handler picks up the
# spy (a non-None value is NEVER overwritten by the lazy import — patch-where-used).
resolve_filter = None  # type: ignore[assignment]
ResolveError = None  # type: ignore[assignment]
_build_field_meta = None  # type: ignore[assignment]


def _ensure_resolver() -> None:
    """Bind the document_view_resolver symbols into THIS module's globals on first use.

    Deferred (not a top-level import) to break the cycle:
    tool_dispatcher → document_view_resolver → harness.scope → harness/__init__ →
    phase_types → task_service → tool_dispatcher. Only assigns a global that is still the
    ``None`` sentinel, so a test's monkeypatched ``resolve_filter`` survives untouched.
    """
    g = globals()
    if g.get("resolve_filter") is None or g.get("ResolveError") is None or g.get("_build_field_meta") is None:
        from app.services.document_view_resolver import (
            ResolveError as _RE,
            _build_field_meta as _bfm,
            resolve_filter as _rf,
        )
        if g.get("resolve_filter") is None:
            g["resolve_filter"] = _rf
        if g.get("ResolveError") is None:
            g["ResolveError"] = _RE
        if g.get("_build_field_meta") is None:
            g["_build_field_meta"] = _bfm


# ---------------------------------------------------------------------------
# Tool handlers -- one async function per tool
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# 262-UAT 3.5 — THE FOLDER WALL. `folder_subtree_ids` is the one scope channel every
# folder-limited run shares (Restricted + Union Experts, folder-pinned chats). search and
# glob already honoured it; ls / tree / grep / read_document / analyze_document did not,
# and a model-supplied `path: "/"` or document id walked straight past the default path.
# Operator ruling 2026-09-23: the wall applies to EVERY folder-limited run.
# ⛔ `folder_subtree_ids is None` (an unscoped chat) must stay byte-identical — every helper
# below returns early on None and issues no query.
# ---------------------------------------------------------------------------
_OUT_OF_SCOPE = "is outside the folders this chat is limited to"


def _scope_set(ctx: ToolContext) -> set[str] | None:
    ids = ctx.folder_subtree_ids
    return None if ids is None else {str(f) for f in ids}


async def _document_folder_ids(ctx: ToolContext, doc_ids: list[str]) -> dict[str, str | None]:
    """One RLS-scoped read: document id -> folder id, for ids the caller can see."""
    if not doc_ids:
        return {}
    resp = await aexec(
        ctx.supabase.table("documents").select("id, folder_id").in_("id", list(doc_ids))
    )
    return {str(r["id"]): (str(r["folder_id"]) if r.get("folder_id") else None) for r in (resp.data or [])}


async def _doc_out_of_scope(ctx: ToolContext, doc_id: str) -> bool:
    scope = _scope_set(ctx)
    if scope is None:
        return False
    folders = await _document_folder_ids(ctx, [doc_id])
    if doc_id not in folders:
        return False  # unknown to the caller — the normal path reports not-found
    return folders[doc_id] not in scope


def _prune_tree(node: dict, scope: set[str]) -> dict | None:
    children = [c for c in (_prune_tree(ch, scope) for ch in node.get("children", [])) if c]
    in_scope = str(node.get("id")) in scope
    if not in_scope and not children:
        return None
    # An ancestor survives only as the PATH to an in-scope folder; its own documents do not.
    return {**node, "children": children, "documents": node.get("documents", []) if in_scope else []}


async def _handle_ls(args: dict, ctx: ToolContext) -> ToolResult:
    path = args.get("path") or (ctx.scoped_folder_path if ctx.scoped_folder_path else "/")
    result = await ls_path(path, ctx.current_user["id"], ctx.supabase)
    scope = _scope_set(ctx)
    if scope is not None and "error" not in result:
        result["folders"] = [f for f in result.get("folders", []) if str(f.get("id")) in scope]
        docs = result.get("documents") or []
        folders = await _document_folder_ids(ctx, [str(d["id"]) for d in docs])
        result["documents"] = [d for d in docs if folders.get(str(d["id"])) in scope]
    return ToolResult(result=json.dumps(result))


async def _handle_tree(args: dict, ctx: ToolContext) -> ToolResult:
    path = args.get("path") or (ctx.scoped_folder_path if ctx.scoped_folder_path else "/")
    result = await tree_path(path, args.get("depth"), ctx.current_user["id"], ctx.supabase)
    scope = _scope_set(ctx)
    if scope is not None and "tree" in result:
        result["tree"] = [n for n in (_prune_tree(t, scope) for t in result["tree"]) if n]
    return ToolResult(result=json.dumps(result))


async def _handle_grep(args: dict, ctx: ToolContext) -> ToolResult:
    path = args.get("path") or ctx.scoped_folder_path
    result = await grep_path(args.get("pattern", ""), path, ctx.current_user["id"], ctx.supabase)
    scope = _scope_set(ctx)
    if scope is not None and "matches" in result:
        result["matches"] = [m for m in result["matches"] if str(m.get("folder_id")) in scope]
        result["total"] = len(result["matches"])
    return ToolResult(result=json.dumps(result))


async def _handle_glob(args: dict, ctx: ToolContext) -> ToolResult:
    result = await glob_path(args.get("pattern", ""), ctx.current_user["id"], ctx.supabase)
    # Scope glob results to folder subtree if thread is folder-scoped
    if ctx.folder_subtree_ids is not None and "matches" in result:
        result["matches"] = [
            m for m in result["matches"]
            if m.get("folder_id") in ctx.folder_subtree_ids
        ]
        result["total"] = len(result["matches"])
    return ToolResult(result=json.dumps(result))


async def _handle_read_document(args: dict, ctx: ToolContext) -> ToolResult:
    if await _doc_out_of_scope(ctx, str(args["document_id"])):
        return ToolResult(result=json.dumps({
            "error": f"Document {args['document_id']} {_OUT_OF_SCOPE}.",
            "error_kind": "out_of_scope",
        }))
    if await unretrievable(ctx.supabase, [str(args["document_id"])]):
        return ToolResult(result=json.dumps(not_retrievable_result(args["document_id"])))
    result = await read_path(
        args["document_id"],
        ctx.current_user["id"],
        ctx.supabase,
        args.get("start_line"),
        args.get("end_line"),
    )
    return ToolResult(result=json.dumps(result))


# ---------------------------------------------------------------------------
# Phase 151 (FILE-02) — fetch_document_file: KB document original bytes → sandbox
# ---------------------------------------------------------------------------
async def _fetch_owned_document_bytes(
    ctx: ToolContext, document_id: str
) -> "tuple[str, bytes, str] | dict":
    """Resolve a KB document's ORIGINAL bytes, owner→global scoped (D-04).

    Mirrors ``read_path``'s owner→global two-step (kb.py:395-416) but SELECTs the
    storage columns instead of ``full_markdown``. Returns EITHER:

      * ``{"error": ...}`` — not found / access denied (D-04 / SC#4), no original file
        stored (D-01), or over the operator cap (D-02, computed PRE-download so a
        too-large file is NEVER partially fetched — refuse-never-truncate); OR
      * ``(filename, file_bytes, mime_type)`` on success.

    Owner-scope is load-bearing: service-role reads have NO RLS backstop, so the
    ``.eq(user_id)`` gate runs FIRST and a non-owner id yields empty ``.data``.

    This is the FILE-01 source #4 contract — Plan 04 imports THIS symbol to attach an
    owned KB document's original bytes onto a skill. Keep the ``(filename, bytes, mime)``
    tuple / ``{"error": ...}`` dict return shape stable for that reuse.
    """
    # The folder wall (262-UAT 3.5 ruling) — BEFORE any owner/global lookup, so both callers
    # (fetch_document_file, attach_skill_file) refuse an out-of-scope id. Found by the v4.3
    # milestone audit: this byte path was the one document read the 3.5 fix did not reach.
    if await _doc_out_of_scope(ctx, str(document_id)):
        return {
            "error": f"Document {document_id} {_OUT_OF_SCOPE}.",
            "error_kind": "out_of_scope",
        }
    if await unretrievable(ctx.supabase, [str(document_id)]):
        return not_retrievable_result(document_id)
    uid = ctx.current_user["id"]
    _cols = "id, filename, file_path, file_size, mime_type"

    # WR-01 — mirror read_path's honest-failure wrapper (kb.py:395-418). document_id is
    # model-supplied and routinely a non-UUID / filename / free text; PostgREST rejects the
    # `id = eq.<garbage>` uuid cast (400) and .maybe_single() re-raises it as an APIError
    # (only the PGRST116 "0 rows" case is swallowed). Wrap BOTH SELECTs so that failure — or
    # any transient DB blip — collapses to the calm honest refusal, never a raw PostgREST/DB
    # error string leaked out into the agent loop.
    try:
        res = await aexec(
            ctx.supabase.table("documents").select(_cols)
            .eq("id", document_id).eq("user_id", uid).maybe_single()
        )
        row = res.data if res else None
        if not row:
            # Owner miss → globally-visible-folder fallback (matches read_document scope, D-04).
            gfids = await get_globally_visible_folder_ids(ctx.supabase, uid)
            if gfids:
                res = await aexec(
                    ctx.supabase.table("documents").select(_cols)
                    .eq("id", document_id).in_("folder_id", gfids).maybe_single()
                )
                row = res.data if res else None
    except Exception:  # noqa: BLE001 — honest refusal on ANY DB failure, never raise raw DB text
        return {"error": f"Document '{document_id}' not found or access denied."}
    if not row:
        return {"error": f"Document '{document_id}' not found or access denied."}

    # D-01: never silently write extracted text as a file — the contract is always
    # REAL bytes. An older text-only ingest (or a doc with no stored original) gets an
    # honest error; the agent decides on its own whether to fall back to read_document.
    if not row.get("file_path"):
        return {"error": (
            "No original file stored for this document — use read_document/"
            "analyze_document for its text."
        )}

    # D-02 / WR-03: size gate PRE-download. Bytes go to disk via copy_to_runtime, never into
    # the ToolResult / model context; an over-cap file is refused with an honest size error
    # and NOTHING is downloaded (no partial binary is ever fetched).
    cap_bytes = settings.fetch_document_file_max_mb * 1024 * 1024
    file_size = row.get("file_size")
    # WR-03: a NULL/0 file_size is NOT "unlimited". The prior `row.get("file_size") or 0`
    # collapsed a missing byte-count (older text-only ingests / any row that never recorded
    # one) to 0, which is never > cap — the gate was skipped and the full file streamed into
    # backend RAM regardless of its true size (a memory-exhaustion vector under WORKER_COUNT=2).
    # Treat unknown size as untrusted and refuse PRE-download rather than fetch unbounded.
    if not file_size:
        return {"error": (
            "This document has no recorded size, so its original bytes cannot be safely "
            "fetched. Use read_document/analyze_document for its text instead."
        )}
    if file_size > cap_bytes:
        return {"error": (
            f"File is {file_size // 1024 // 1024} MB, over the "
            f"{cap_bytes // 1024 // 1024} MB fetch limit."
        )}

    # Pull the real bytes — threadpool-wrapped (D-v2.5-01, Pitfall 1). NOT the un-wrapped
    # storage.download at :1114 — that idiom freezes the event loop under WORKER_COUNT=2.
    file_bytes = await run_in_threadpool(
        ctx.supabase.storage.from_("documents").download, row["file_path"]
    )
    # WR-03 metadata-drift backstop: the pre-download gate trusts documents.file_size, which
    # can under-count the real payload. Re-check the ACTUAL byte length and refuse if it
    # exceeds the cap — the bytes never enter the ToolResult / model context on this path.
    if len(file_bytes) > cap_bytes:
        return {"error": (
            f"File is {len(file_bytes) // 1024 // 1024} MB, over the "
            f"{cap_bytes // 1024 // 1024} MB fetch limit."
        )}
    filename = row.get("filename") or "document"
    mime_type = row.get("mime_type") or "application/octet-stream"
    return (filename, file_bytes, mime_type)


async def _handle_fetch_document_file(args: dict, ctx: ToolContext) -> ToolResult:
    """FILE-02 — materialize a KB document's ORIGINAL bytes into the sandbox (D-03).

    G-5: handler + one ``_TOOL_REGISTRY`` line + one ``get_tools()`` schema; threads.py
    untouched, no ``provider ==`` fork. Sandbox-gated (D-11) in ``get_tools()`` AND refused
    in-flight via ``_CAPABILITY_FLAG_TOOLS``. Honesty is the point (D-01): a text
    reconstruction is NEVER presented as the real file — this tool only ships REAL bytes,
    else an honest error via the shared honest-failure convention.
    """
    import re as _re_local
    import os as _os_local
    import tempfile as _tempfile_local

    document_id = (args.get("document_id") or "").strip()
    if not document_id:
        return ToolResult(result=json.dumps({"error": "document_id is required."}))

    resolved = await _fetch_owned_document_bytes(ctx, document_id)
    if isinstance(resolved, dict):  # honest-failure convention (D-01 / D-02 / D-04)
        return ToolResult(result=json.dumps(resolved))
    filename, doc_bytes, mime_type = resolved

    # T-01 path-traversal defense — os.path.basename + the workspace.py:184 charset scrub.
    # NEVER trust documents.filename (user-set at upload): a crafted "../../etc/x" must land
    # as a scrubbed basename UNDER /sandbox/input/, with no ".." segment.
    stem = _os_local.path.basename(filename or "document")
    safe = _re_local.sub(r"[^a-zA-Z0-9._\- ]", "_", stem)
    safe = _re_local.sub(r"\.{2,}", ".", safe).strip() or "document"
    container_path = f"/sandbox/input/{safe}"

    def _ship() -> None:
        """Synchronous sandbox interaction (run in a threadpool — blocking I/O)."""
        session = sandbox_manager.get_or_create(ctx.thread_id)
        try:
            session.execute_command("mkdir -p /sandbox/input")  # D-03 landing dir
        except Exception:
            pass
        # Clone the render_template copy-in (tool_dispatcher.py:2549-2568): local
        # NamedTemporaryFile → copy_to_runtime (put_archive handles a large binary; a
        # base64-in-source injection does not — do NOT copy the :1114-1122 path).
        with _tempfile_local.NamedTemporaryFile(mode="wb", delete=False) as _tmp:
            _tmp.write(doc_bytes)
            _local = _tmp.name
        try:
            session.copy_to_runtime(_local, container_path)
        finally:
            try:
                _os_local.unlink(_local)
            except OSError:
                pass

    try:
        await run_in_threadpool(_ship)  # D-v2.5-01 — ALL container/Storage I/O off-loop
    except Exception as exc:  # noqa: BLE001 — honest tool-result error, never raise into the loop
        logger.exception("fetch_document_file ship failed for doc %s", document_id)
        return ToolResult(result=json.dumps({
            "error": f"Failed to materialize the file into the sandbox: {exc}"
        }))

    return ToolResult(result=json.dumps({
        "status": "ok",
        "path": container_path,
        "size_bytes": len(doc_bytes),
        "mime_type": mime_type,
    }))


async def _handle_query_documents(args: dict, ctx: ToolContext) -> ToolResult:
    tool_result = await query_documents(
        args["query"], ctx.current_user["id"], ctx.supabase,
        folder_ids=ctx.folder_subtree_ids,
    )
    return ToolResult(result=tool_result)


async def _handle_query_documents_by_view(args: dict, ctx: ToolContext) -> ToolResult:
    """Phase 115 (VIEW-07) — the conversational mouth of the 113/114 virtual-folders work.

    Three modes off a single flat, polymorphic arg set (``view`` XOR ``filter`` + an
    optional ``limit`` — D-115 / RESEARCH §"State of the Art": NO anyOf/oneOf, the only
    cross-provider-safe shape for function-calling):

      * CATALOG  — neither ``view`` nor ``filter`` (or an UNKNOWN ``view`` name): return
        the caller's saved views + the filterable fields. The ``filterable_fields`` list
        is IDENTICAL to the whitelist the compiler validates against (``_build_field_meta``
        — no drift). No resolve, so NO audit.
      * SAVED-VIEW — a ``view`` NAME → own-or-global ``get_view_by_name`` (the model never
        sees a UUID) → resolve. An unknown name falls through to CATALOG (D-115-6 — never a
        distinguishable 403/existence leak).
      * INLINE-FILTER — a ``filter`` object → ``ViewFilter.model_validate`` → resolve. A
        malformed shape (Pydantic ``ValidationError``) is mapped to a calm tool-result.

    Honesty is load-bearing: the TRUE total comes from ``resolve_filter(count_only=True)``
    (NEVER ``len(shown_rows)`` — the silent-undercount trap); a truncation note + a
    ``truncated`` flag are emitted when ``total > shown``; rows + ``source_refs`` are the
    CALLER's only (VIEW-06 — ``resolve_filter`` caller-scopes own+global). A VIEW listing
    has no chunk passage, so the citable channel is ``source_refs`` only (citations=[],
    D-115-4); ``source_refs`` is ALSO embedded in the JSON ``result`` the model reads so it
    can cite by id+filename.

    Errors NEVER escape into the agent loop (T-115-02-05): a ``ResolveError`` (bad field) or
    a Pydantic ``ValidationError`` (malformed inline filter) becomes a calm ``ToolResult``
    JSON string that points the model back at the catalog. Pitfall 4: ``ctx.folder_subtree_ids``
    is NEVER threaded into ``resolve_filter`` — the view owns its own ``folder_scope``.

    D-115-10: every concrete resolve fires the EXISTING ``search.query`` audit tagged
    ``via:"view"``/``via:"filter"`` (no new audit enum, no migration); fire-and-forget so a
    write failure never breaks the answer.
    """
    from pydantic import ValidationError

    _ensure_resolver()  # bind resolve_filter / ResolveError / _build_field_meta (cycle-break)

    view_name = (args.get("view") or "").strip()
    inline = args.get("filter")
    caller = ctx.current_user["id"]

    async def _catalog() -> ToolResult:
        # CATALOG — saved views + the filterable-field whitelist. The whitelist is the
        # SAME source the compiler validates against (_build_field_meta) so the catalog
        # advertises exactly what resolve accepts (no drift). Counts are omitted (lazy —
        # RESEARCH §A3: a catalog call should be cheap, not N resolves).
        # WR-03: catalog is the FIRST path the model is told to call; a transient DB error in
        # list_views/_build_field_meta must stay a calm ToolResult, never raise into the loop
        # (T-115-02-05 — the same contract the resolve path already honors).
        try:
            views = await document_view_service.list_views(caller, supabase=ctx.supabase)
            whitelist, _ = await _build_field_meta(caller, ctx.supabase)
        except Exception as e:  # noqa: BLE001 — calm-string contract; never raise into the loop
            return ToolResult(result=json.dumps({
                "status": "catalog_unavailable",
                "message": f"could not load saved views / fields right now: {e}",
                "hint": "try again, or call with a concrete `view` name or `filter`",
            }))
        return ToolResult(result=json.dumps({
            "mode": "catalog",
            "views": [{"name": v["name"]} for v in views],
            "filterable_fields": sorted(whitelist),
            "hint": "Call again with `view` (a name above) or `filter` (using a field above).",
        }))

    if not view_name and inline is None:
        return await _catalog()

    # ---- resolve the filter_expr: saved view by name, or inline ----
    if view_name:
        view = await document_view_service.get_view_by_name(
            view_name, caller, supabase=ctx.supabase
        )
        if view is None:
            return await _catalog()  # unknown view → catalog, NEVER an existence leak (D-115-6)
        try:
            flt = ViewFilter.model_validate(
                view.get("filter_expr") or {"op": "and", "conditions": []}
            )
        except (ValidationError, ValueError) as e:
            # A stored view row whose filter_expr no longer parses (e.g. a future-shape
            # drift) — calm string, never a raise into the loop.
            return ToolResult(result=json.dumps({
                "status": "invalid_filter",
                "message": f"saved view {view['name']!r} could not be parsed: {e}",
                "hint": "call with no arguments to see your saved views and filterable fields",
            }))
        folder_scope = view.get("folder_scope")
        via_meta = {"via": "view", "view_id": view["id"], "view_name": view["name"]}
    else:
        try:
            flt = ViewFilter.model_validate(inline)
        except (ValidationError, ValueError) as e:
            return ToolResult(result=json.dumps({
                "status": "invalid_filter",
                "message": f"the filter shape is invalid: {e}",
                "hint": "call with no arguments to see filterable fields",
            }))
        folder_scope = None
        via_meta = {"via": "filter", "filter": inline}

    # WR-01: a non-numeric `limit` (e.g. {"limit": "twenty"}) must NOT raise into the agent
    # loop — _normalize_optional_int coerces or returns None (→ default 20). T-115-02-05 contract.
    _norm_limit = _normalize_optional_int(args.get("limit"))
    limit = max(1, min(_norm_limit if _norm_limit is not None else 20, 50))  # default 20, hard cap 50 (D-115-3)

    try:
        # Phase 275 (D-36, revision B-2): the agent's listing omits archived / source-gone
        # documents AT THE QUERY, and the total counts the same filtered set (honest total).
        total = (await resolve_filter(
            caller=caller, flt=flt, folder_scope=folder_scope,
            count_only=True, supabase=ctx.supabase, retrievable_only=True,
        ))["total"]
        full = await resolve_filter(
            caller=caller, flt=flt, folder_scope=folder_scope,
            count_only=False, supabase=ctx.supabase, retrievable_only=True,
        )
    except ResolveError as e:  # the extracted core raises this, NOT HTTPException
        return ToolResult(result=json.dumps({
            "status": "invalid_filter",
            "message": e.detail,
            "hint": "call with no arguments to see filterable fields",
        }))

    rows = (full.get("documents") or [])[:limit]
    compact = [{
        "document_id": d["id"],
        "filename": d["filename"],
        "document_type": (d.get("metadata") or {}).get("document_type"),
        "date": (d.get("metadata") or {}).get("date"),
        "author": (d.get("metadata") or {}).get("author"),
    } for d in rows]
    source_refs = [{"document_id": d["id"], "filename": d["filename"]} for d in rows]

    # D-115-10: reuse the existing search.query audit (no new enum, no migration), tagged
    # via:"view"/"filter". Fire-and-forget — a write failure never breaks the answer.
    # getattr-guard: a duck-typed test/duck ctx may omit `spawn`; a missing hook must not
    # turn a clean answer into an exception (the answer is the point).
    _spawn = getattr(ctx, "spawn", None)
    if callable(_spawn):
        try:
            _spawn(write_audit_entry(
                user_id=caller,
                action_type="search.query",
                metadata={**via_meta, "document_ids": [d["id"] for d in rows]},
                supabase=ctx.supabase,
            ))
        except Exception:  # noqa: BLE001 — audit is best-effort; never block the answer
            logger.exception("query_documents_by_view audit spawn failed for caller=%s", caller)

    shown = len(compact)
    note = (
        f"{total} match; {shown} newest shown." if total > shown
        else f"{total} match."
    )
    return ToolResult(
        result=json.dumps({
            "mode": "results",
            "total": total,
            "shown": shown,
            "truncated": total > shown,
            "note": note,
            "documents": compact,
            "source_refs": source_refs,  # citable channel, also embedded so the model can cite
        }),
        source_refs=source_refs,
    )


async def _handle_get_related_documents(args: dict, ctx: ToolContext) -> ToolResult:
    """Phase 116 (REL-04) — traverse the human-curated relationship graph (D-116-8).

    The leak-safe read tool over the directional ``document_relationships`` edges. Clone
    of ``_handle_query_documents_by_view``'s contract: compact rows + ``source_refs``,
    every failure path a calm ``ToolResult`` JSON string (NEVER a raise into the agent
    loop — the 115 WR-01/WR-03 lesson; ``agent_loop.py`` catches ValueError as a backstop
    but this handler must not depend on it).

    Phase 117 (D-117-7): the leak-safe outgoing+incoming TRAVERSAL was extracted into the
    SHARED, FastAPI-free ``document_relationship_service.get_related_documents`` so the new
    GET route (Plan 02) and this agent tool call ONE source of truth — there is no fork
    that could drift and re-open the SC#1 leak (the 115 ``resolve_filter`` precedent). This
    handler is now a THIN caller: parse the subject identifier, delegate the traversal,
    then package the shared dict into the calm ``ToolResult`` (the ``mode``/``note`` framing
    + ``source_refs`` the agent expects — byte-identical to before the extraction, plus the
    additive per-row ``relationship_id`` the shared fn now carries, which the agent ignores).

    Flow:
      1. Parse the subject identifier (``document_id`` preferred; else exact ``filename``).
         Neither arg → a calm "no_subject" string.
      2. Delegate the leak-safe traversal to the shared fn (subject resolve via
         ``_resolve_readable_latest``, edge queries over the full version-id set, per-edge
         other-endpoint readability re-check → masked unseeable endpoints). A ``None`` return
         (unreadable/unknown subject) → the calm "not_found" string. Any unexpected
         exception → the calm "unavailable" string (the handler never raises into the loop).
      3. Package the shared dict into the ``ToolResult`` JSON: re-add the agent-facing
         ``mode`` + ``note`` framing around the shared ``subject``/``total``/``documents``/
         ``source_refs``.

    Read-audit policy (RESEARCH OQ1 / A2, Claude's discretion): NO read audit — D-116-12
    mandates an audit only for create/remove, no SC requires a read receipt, and adding
    one would need a new enum value. A read is a pure traversal of the caller's own graph.
    Pitfall: ``ctx.folder_subtree_ids`` is NEVER threaded — relationships are whole-KB,
    own-scoped, and the per-endpoint readability re-check (inside the shared fn) is the SOLE
    access gate.
    """
    caller = ctx.current_user["id"]
    doc_id = (args.get("document_id") or "").strip()
    filename = (args.get("filename") or "").strip()

    # ── 1. parse the subject identifier (calm string when neither arg given) ─────
    if not doc_id and not filename:
        return ToolResult(result=json.dumps({
            "status": "no_subject",
            "message": "Provide exactly one of `document_id` or `filename` to identify the document.",
            "hint": "Pass the subject document's id (preferred) or its exact filename.",
        }))

    # ── 2. delegate the leak-safe traversal to the SHARED fn (D-117-7 — one core) ──
    try:
        result = await document_relationship_service.get_related_documents(
            caller,
            document_id=doc_id or None,
            filename=filename or None,
            supabase=ctx.supabase,
            retrievable_only=True,  # Phase 275 (D-36, B-2): omit archived / source-gone endpoints
        )
    except Exception as e:  # noqa: BLE001 — calm-string contract; never raise into the loop
        logger.exception("get_related_documents traversal failed for caller=%s", caller)
        return ToolResult(result=json.dumps({
            "status": "unavailable",
            "message": f"could not load this document's relationships right now: {e}",
            "hint": "try again, or identify the document a different way (id vs filename)",
        }))

    # A None return = an unreadable/unknown subject (no leak) → the calm "not_found" string.
    if result is None:
        which = f"document_id {doc_id!r}" if doc_id else f"filename {filename!r}"
        return ToolResult(result=json.dumps({
            "status": "not_found",
            "message": f"No document you can access matches {which}.",
            "hint": "Check the id/filename, or use search_documents / query_documents_by_view to find it first.",
        }))

    # ── 3. package the shared dict into the agent-facing ToolResult (mode + note framing) ──
    subject = result["subject"]
    total = result["total"]
    source_refs = result["source_refs"]
    note = (
        f"{total} related document(s) for {subject['filename']!r}." if total
        else f"No relationships found for {subject['filename']!r}."
    )
    return ToolResult(
        result=json.dumps({
            "mode": "relationships",
            "subject": subject,
            "total": total,
            "note": note,
            "documents": result["documents"],
            "source_refs": source_refs,  # seeable endpoints only; also embedded so the model can cite
        }),
        source_refs=source_refs,
    )


async def _handle_web_search(args: dict, ctx: ToolContext) -> ToolResult:
    tool_result = web_search(args["query"], settings.tavily_api_key, settings.web_search_max_results)
    return ToolResult(result=tool_result)


async def _handle_analyze_document(args: dict, ctx: ToolContext) -> ToolResult:
    doc_id = await resolve_document_id(args["filename"], ctx.current_user["id"], ctx.supabase)
    if not doc_id:
        return ToolResult(result=f"Document '{args['filename']}' not found.")
    if await _doc_out_of_scope(ctx, str(doc_id)):
        return ToolResult(result=f"Document '{args['filename']}' {_OUT_OF_SCOPE}.")
    if await unretrievable(ctx.supabase, [str(doc_id)]):
        return ToolResult(result=json.dumps(not_retrievable_result(doc_id)))

    doc = await fetch_full_document(doc_id, ctx.current_user["id"], ctx.supabase)
    if not doc:
        return ToolResult(result=f"Could not retrieve content for '{args['filename']}'.")

    source_refs = [{"document_id": doc_id, "filename": doc["filename"]}]
    citations = [{
        "document_id": doc_id,
        "filename": doc["filename"],
        "chunk_index": None,
        "passage": None,
        "similarity": None,
        "is_full_doc": True,
        "version_number": doc.get("version_number", 1),
        # Phase 231 TRUST-04 — the SAME two keys as the search-hit citation above. A citation
        # shape that carries provenance on one path and not the other is how a reader learns to
        # distrust the mark rather than the document.
        "source_connection_id": doc.get("source_connection_id"),
        "source_connection_name": doc.get("source_connection_name"),
    }]

    await ctx.emit(ctx.redis, ctx.run_id, 'sub_agent_start', filename=doc['filename'], task=args['task'])
    sub_agent_content = ""

    # Phase 075.1 Plan 04 (B-260519-05) -- capture the effective model
    _sub_agent_effective_model = (
        (ctx.user_settings.sub_agent_model if ctx.user_settings else "")
        or settings.sub_agent_model
        or _SUB_AGENT_MODEL_DEFAULTS.get(
            getattr(ctx.user_settings, "active_provider", "") or "",
            "",
        )
        or (ctx.user_settings.llm_model if ctx.user_settings else "")
        or ctx.model
        or settings.llm_model
    )

    try:
        for text_chunk in run_sub_agent(
            doc["content"], doc["filename"], args["task"],
            model=ctx.model, user_settings=ctx.user_settings,
        ):
            # Detect fallback sentinel emitted by sub_agent_service
            if text_chunk.startswith('{"__type": "fallback_model"'):
                try:
                    sentinel = json.loads(text_chunk)
                    await ctx.emit(
                        ctx.redis, ctx.run_id, 'fallback_model',
                        original_model=sentinel['original_model'],
                        fallback_model=sentinel['fallback_model'],
                    )
                    _sub_agent_effective_model = sentinel.get('fallback_model', _sub_agent_effective_model)
                except (json.JSONDecodeError, KeyError):
                    pass
                continue
            sub_agent_content += text_chunk
            await ctx.emit(ctx.redis, ctx.run_id, 'sub_agent_delta', content=text_chunk)
    except Exception as sa_err:
        logger.error("Sub-agent failed: %s", sa_err)
        if not sub_agent_content:
            sub_agent_content = f"Sub-agent analysis failed: {sa_err}"

    await ctx.emit(ctx.redis, ctx.run_id, 'sub_agent_done')

    sub_agent_record = {
        "filename": doc["filename"],
        "task": args["task"],
        "content": sub_agent_content,
        "effective_model": _sub_agent_effective_model,
    }

    # Strip signed URLs from LLM context
    return ToolResult(
        result=sub_agent_content,
        llm_content=sub_agent_content,
        source_refs=source_refs,
        citations=citations,
        sub_agent_record=sub_agent_record,
    )

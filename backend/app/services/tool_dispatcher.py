"""Tool dispatch registry for the agent_runner loop.

Extracted from threads.py (Phase 083, G-5 mandated refactor). Each tool has a
handler function that receives (args, ctx) and returns a ToolResult. The caller
in threads.py constructs a ToolContext once per iteration and delegates all
tool-specific logic through dispatch_tool().

Adding a new tool requires only:
  1. Write an async _handle_<name>(args, ctx) -> ToolResult
  2. Register it in _TOOL_REGISTRY
  3. threads.py is untouched.
"""
from __future__ import annotations

import asyncio
import base64
import io
import json
import logging
import os
import time as time_mod
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Callable, Awaitable
from uuid import UUID

from starlette.concurrency import run_in_threadpool

from app.utils.db import aexec
from app.api.kb import ls_path, tree_path, grep_path, glob_path, read_path
from app.services.retrieval_service import search_documents, resolve_document_id, fetch_full_document
from app.services.web_search_service import web_search
from app.services.sub_agent_service import run_sub_agent
from app.services.audit_service import write_audit_entry
from app.services.sandbox_service import sandbox_manager, harvest_output_files, snapshot_output_baseline
from app.config import settings, _SUB_AGENT_MODEL_DEFAULTS
# Phase 147 (FLAG-01 / D-04 layer 2 REFUSE) — the refuse gate reads the SAME
# last-known-good TTL settings cache the get_tools hide layer reads. Module-level
# (patch-where-used friendly) and cycle-safe: user_settings imports only app.config.
from app.models.user_settings import load_app_settings
from app.services.sql_service import query_documents
from app.services.skill_lint import lint_description
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
from app.services import document_view_service, metadata_field_service
# Phase 116 (REL-04) — get_related_documents reuses the SAME shared resolver
# (_resolve_readable_latest) IN-PROCESS for leak-safe per-viewer masking. The
# relationship service imports only pydantic/dependencies/db/folder_utils → cycle-safe
# at module level (unlike document_view_resolver, which transitively pulls harness).
from app.services import document_relationship_service
from app.services.workspace_service import (
    write_file as ws_write_file,
    read_file as ws_read_file,
    list_files as ws_list_files,
    delete_file as ws_delete_file,
    get_diff as ws_get_diff,
    WorkspaceError,
)

if TYPE_CHECKING:
    import asyncpg
    import redis.asyncio as aioredis
    from supabase import Client
    from app.models.user_settings import UserEffectiveSettings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class ToolContext:
    """Carries all dependencies a tool handler needs from the agent_runner scope."""
    redis: Any  # redis.asyncio client
    run_id: UUID
    thread_id: str
    supabase: Any  # supabase Client
    pool: Any  # asyncpg pool
    user_settings: Any  # UserEffectiveSettings
    current_user: dict  # {"id": str, ...}
    folder_subtree_ids: list[str] | None  # list, NOT set — p_folder_ids is json.dumps'd (Pitfall 1)
    scoped_folder_path: str | None
    emit: Callable[..., Awaitable[None]]  # reference to _emit
    spawn: Callable  # reference to _spawn
    model: str = ""  # user's selected model (for sub-agent routing)
    previous_files_in_run: dict | None = None  # sandbox output file tracking across execute_code calls
    new_file_hashes_in_run: set | None = None  # RUN-01a — content-hashes genuinely new to THIS run (run-scoped accumulator)
    # Phase 142 (SRH-01 / D-06) — run-scoped repeat-guard. The set of KNOWN_MISSING
    # gap tokens (soffice / markitdown / a lost `scripts/office/*` path / a JS
    # marker) that have already FAILED this run with a PERMANENT runtime gap.
    # By-reference run-scoped accumulator (mirrors new_file_hashes_in_run): init
    # once in agent_loop.py, threaded into BOTH ToolContext builds, FRESH set() for
    # sub-agents (task_service — a sub-agent's dead call must not block the parent).
    # None on EVERY unwired (harness/eval/test/duck-typed) caller => the reshape
    # `.add` and the pre-flight membership check are literal no-ops (D-14
    # byte-identical Deep). Binary/module/JS tokens are bounded by the fixed
    # allowlist; a G-A entry is a NARROWED bundled-skill-tree path (a
    # `scripts/`|`assets/`|`resources/`-prefixed relative miss — WR-01), so the set
    # grows only with genuinely-lost helper paths, never arbitrary model input (T-142-04).
    dead_gap_tokens_in_run: set | None = None
    tool_index: int = 0  # current index in the tool_calls list (used by execute_code heartbeat)
    iteration: int = 0  # current agent loop iteration (used by harvest_output_files)
    # Phase 085 — D-085-09 / D-085-12 / D-085-15 / D-085-01
    # parent_run_id: non-null inside a sub-agent's ToolContext — _handle_task short-circuits
    #   to enforce the 1-level nesting cap (D-085-12).
    # per_run_task_semaphore: in-process asyncio.Semaphore initialized once per top-level
    #   run in agent_runner; gates the number of simultaneous task() spawns (D-085-15).
    # available_tools: list of tool-name strings exposed to the parent agent — used by
    #   _handle_task to enforce the sub-agent toolset-subset rule (D-085-09).
    # tool_call_id: LLM-supplied id for the current tool call; populated per-dispatch by
    #   agent_runner (mirrors tool_index). Used by ask_user channel naming (D-085-01).
    parent_run_id: "UUID | None" = None
    per_run_task_semaphore: Any = None  # asyncio.Semaphore | None — keep Any to avoid module-level asyncio import surface
    available_tools: list[str] = field(default_factory=list)
    tool_call_id: str = ""
    # Phase 091 HARNESS-05 — the active workflow phase's allowed tool set.
    #   None  => Deep Mode (no active workflow): the dispatch guard is a literal
    #            no-op so Explorer/General stay byte-identical (Phase 089 invariant).
    #   set   => a locked workflow phase: a tool name NOT in this set is refused at
    #            dispatch_tool() with the D-04 guiding tool_result + a D-06 tool_refused
    #            audit. Set once per phase by the harness executor (Plan 03), never
    #            queried per tool call.
    phase_whitelist: "frozenset[str] | None" = None
    # 096 review WR-03 — the workflow_runs.id of the active harness run. Every
    # other harness_audit row (phase_started / gate_failed / phase_completed /
    # run_completed) is keyed on workflow_runs.id, but on the harness path
    # ctx.run_id / ctx.parent_run_id carry PRODUCER `runs` ids (Facet A,
    # phase_types.py) — so the tool_refused audit needs this field to land in the
    # same per-run namespace the audit readers query. Set ONLY by
    # _build_phase_tool_context (+ propagated onto sub_ctx in task_service);
    # None on every Deep-Mode / tasks caller => byte-identical Deep dispatch.
    workflow_run_id: "UUID | None" = None
    # 099 WFSKILL-01 (D-04) — the materialized skill snapshot for a skill-bearing
    # workflow phase. None on EVERY Deep-mode / non-skill-phase caller => the gated
    # read branch in _handle_read_skill_file (Plan 03) is a literal no-op =>
    # byte-identical Deep behavior (SC#3). Set ONLY by _build_phase_tool_context
    # (Plan 02) when the phase config carries a skill_snapshot. Kept Any (like
    # per_run_task_semaphore) to avoid importing the harness model on the
    # dispatcher hot path.
    skill_snapshot: Any = None  # SkillSnapshot | None — kept Any to avoid a model import on the dispatcher hot path
    # Phase 135 (135-02 / SI-01) — ADDITIVE default-off skill-INSTRUCTIONS override
    # for the honest DRAFT re-eval (RESEARCH Pitfall #1). None on EVERY Deep-mode /
    # normal caller => _handle_load_skill returns row["instructions"] byte-identical.
    # A map {skill_name: instructions} (set ONLY by the re-eval WITH-arm RunContext,
    # threaded through both agent_loop ToolContext builds + the task_service sub_ctx)
    # => _handle_load_skill returns the DRAFT instructions for that skill WITHOUT
    # touching the live skills row. Same additive-default-off discipline as
    # phase_whitelist / workflow_run_id / skill_snapshot above.
    skill_instructions_override: dict[str, str] | None = None


@dataclass
class ToolResult:
    """Structured return from a tool handler."""
    result: str  # The tool_result string for persistence + LLM context
    llm_content: str | None = None  # If set, sent to LLM instead of result
    source_refs: list[dict] = field(default_factory=list)  # New source references
    citations: list[dict] = field(default_factory=list)  # New citation objects
    similarity_score: float | None = None  # Avg similarity to accumulate
    sub_agent_record: dict | None = None  # Sub-agent metadata (analyze_document)


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

async def _handle_ls(args: dict, ctx: ToolContext) -> ToolResult:
    path = args.get("path") or (ctx.scoped_folder_path if ctx.scoped_folder_path else "/")
    result = await ls_path(path, ctx.current_user["id"], ctx.supabase)
    return ToolResult(result=json.dumps(result))


async def _handle_tree(args: dict, ctx: ToolContext) -> ToolResult:
    path = args.get("path") or (ctx.scoped_folder_path if ctx.scoped_folder_path else "/")
    result = await tree_path(path, args.get("depth"), ctx.current_user["id"], ctx.supabase)
    return ToolResult(result=json.dumps(result))


async def _handle_grep(args: dict, ctx: ToolContext) -> ToolResult:
    path = args.get("path") or ctx.scoped_folder_path
    result = await grep_path(args.get("pattern", ""), path, ctx.current_user["id"], ctx.supabase)
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
    result = await read_path(
        args["document_id"],
        ctx.current_user["id"],
        ctx.supabase,
        args.get("start_line"),
        args.get("end_line"),
    )
    return ToolResult(result=json.dumps(result))


async def _handle_search_documents(args: dict, ctx: ToolContext) -> ToolResult:
    metadata_filter = args.get("metadata_filter") or None
    results, avg_sim = await search_documents(
        args["query"], ctx.current_user["id"], ctx.supabase,
        metadata_filter=metadata_filter,
        user_settings=ctx.user_settings,
        folder_ids=ctx.folder_subtree_ids,
    )
    # Phase 098 GOV-01 (SC#3 ⊆ assert + SC#4 clip + observable) — the loud runtime
    # backstop. The RPC p_folder_ids filter is the PRIMARY enforcement; this post-query
    # clip is the in-app guard for bugs / future tool paths (D-05/D-06). Gated on
    # `folder_subtree_ids is not None` so the shared search path is byte-identical for
    # Deep whole-KB (D-05a — mirrors _handle_glob:145); the additive folder_id enrich
    # key is inert when this block is skipped.
    if ctx.folder_subtree_ids is not None:
        _scope = set(map(str, ctx.folder_subtree_ids))   # Pitfall 1: set()-ify LOCALLY; the ctx channel stays a list
        _kept = [h for h in (results or []) if str(h.get("folder_id")) in _scope]
        _dropped = [h for h in (results or []) if str(h.get("folder_id")) not in _scope]
        if _dropped:   # RPC p_folder_ids is the primary filter → ~always empty in a healthy run (Pitfall 4)
            results = _kept
            try:
                await ctx.emit(
                    ctx.redis, ctx.run_id, "scope_violation",
                    dropped=len(_dropped),
                    out_of_scope_folders=sorted({str(h.get("folder_id")) for h in _dropped}),
                    query=args["query"],
                )
            except Exception:   # best-effort (D-06) — an emit failure must NOT break a clean retrieval
                logger.exception("scope_violation emit failed for run %s", getattr(ctx, "run_id", None))
    tool_result = json.dumps(results) if results else "No relevant documents found."

    source_refs: list[dict] = []
    citations: list[dict] = []
    similarity_score: float | None = None

    # Accumulate full citation objects for citations event (D-04, D-14)
    if results and isinstance(results, list):
        for hit in results:
            doc_id = hit.get("document_id") or hit.get("id")
            filename = hit.get("filename") or hit.get("document_name")
            if doc_id and filename:
                source_refs.append({"document_id": doc_id, "filename": filename})
                citations.append({
                    "document_id": doc_id,
                    "filename": filename,
                    "chunk_index": hit.get("chunk_index"),
                    "passage": hit.get("content"),  # Full text for persistence
                    "similarity": hit.get("similarity"),
                    "is_full_doc": False,
                    "version_number": hit.get("version_number", 1),
                })
        if avg_sim > 0.0:
            similarity_score = avg_sim

    # Audit: fire-and-forget inside async generator (AUDIT-02)
    _audit_doc_ids = list({
        h.get("document_id") or h.get("id")
        for h in (results or [])
        if h.get("document_id") or h.get("id")
    })
    ctx.spawn(write_audit_entry(
        user_id=ctx.current_user["id"],
        action_type="search.query",
        metadata={"query_text": args["query"], "document_ids": _audit_doc_ids},
        supabase=ctx.supabase,
    ))

    return ToolResult(
        result=tool_result,
        source_refs=source_refs,
        citations=citations,
        similarity_score=similarity_score,
    )


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
        total = (await resolve_filter(
            caller=caller, flt=flt, folder_scope=folder_scope,
            count_only=True, supabase=ctx.supabase,
        ))["total"]
        full = await resolve_filter(
            caller=caller, flt=flt, folder_scope=folder_scope,
            count_only=False, supabase=ctx.supabase,
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


# Phase 142 (SRH-01 / D-05 / D-05b) — the proactive per-skill runtime note ridden
# along the load_skill RESULT (the load_skill-flag half of the D-05 proactive home).
# Names the non-Python script file(s) a skill bundles that the Python-only sandbox
# cannot run. Model-facing, advisory only — mirrors save_skill's lint_warnings.
_SKILL_RUNTIME_NOTE = (
    "This skill bundles non-Python script file(s) ({names}) that this Python-only "
    "sandbox cannot execute. Their content may still guide you; do not try to run "
    "them as programs."
)


def _skill_runtime_note(file_names: list[str]) -> str | None:
    """Return an advisory note naming any bundled non-Python script files, else None.

    Pure: scans each filename's extension against the shared Plan-01 ``SCRIPT_EXTS``
    allowlist. Non-blocking by contract — the caller computes this defensively and
    NEVER lets it fail a load (the ``lint_warnings`` posture). Returns ``None`` when
    the file list is all-Python / non-script (nothing to warn about).
    """
    offending = [
        name for name in file_names
        if os.path.splitext(name)[1].lstrip(".").lower() in SCRIPT_EXTS
    ]
    if not offending:
        return None
    return _SKILL_RUNTIME_NOTE.format(names=", ".join(offending))


async def _handle_load_skill(args: dict, ctx: ToolContext) -> ToolResult:
    skill_name = args.get("skill_name", "")
    # Emit skill_activated SSE event immediately (SKIL-12)
    await ctx.emit(ctx.redis, ctx.run_id, 'skill_activated', skill_name=skill_name)
    # Resolve skill -- on a name collision the most-authoritative row wins:
    # system > global > owned (SEED-102). is_system DESC pins a protected built-in
    # above any same-named owned row; is_global DESC is the secondary tie-break.
    _skill_resp = await aexec(
        ctx.supabase.table("skills")
        .select("id, name, description, instructions, user_id")
        .or_(f"user_id.eq.{ctx.current_user['id']},is_global.eq.true")
        .eq("name", skill_name)
        .eq("is_enabled", True)
        .order("is_system", desc=True).order("is_global", desc=True)
    )
    skill_row = _skill_resp.data
    if not skill_row:
        return ToolResult(result=json.dumps({"error": f"Skill '{skill_name}' not found or not enabled."}))

    row = skill_row[0] if isinstance(skill_row, list) else skill_row

    # Phase 067.1 Plan 04: follow-up emit with skill description
    if row.get("description"):
        await ctx.emit(
            ctx.redis,
            ctx.run_id,
            'skill_loaded',
            skill_name=skill_name,
            description=row["description"],
        )
    ctx.spawn(write_audit_entry(
        user_id=ctx.current_user["id"],
        action_type="skill.load",
        metadata={"skill_id": row["id"], "skill_name": row["name"]},
        supabase=ctx.supabase,
    ))
    # Fetch attached filenames (FILE-04)
    _files_resp = await aexec(
        ctx.supabase.table("skill_files")
        .select("filename")
        .eq("skill_id", row["id"])
        .order("filename")
    )
    files_data = _files_resp.data or []
    file_names = [f["filename"] for f in files_data]
    # Phase 135 (135-02 / SI-01) — Pitfall #1 fix: return the DRAFT instructions
    # when the re-eval passed a skill_instructions_override map containing THIS
    # skill's name; else the live DB row's body (byte-identical Deep). getattr so a
    # duck-typed ctx stub predating the field still works (096 workflow_run_id
    # precedent). Keyed on skill_name — the SAME value `.eq("name", ...)` looked up.
    override = getattr(ctx, "skill_instructions_override", None)
    instructions = row["instructions"]
    if override is not None and skill_name in override:
        instructions = override[skill_name]
    result_payload = {
        "name": row["name"],
        "instructions": instructions,
        "files": file_names,
    }
    # D-05b — attach a non-blocking runtime note when the skill bundles a script the
    # Python-only sandbox cannot execute. Computed defensively (the save_skill
    # lint_warnings posture): any failure degrades to no note, and the key is added
    # ONLY when present so the all-Python result stays byte-identical. Never blocks.
    try:
        runtime_note = _skill_runtime_note(file_names)
    except Exception:
        runtime_note = None
    if runtime_note is not None:
        result_payload["runtime_note"] = runtime_note
    return ToolResult(result=json.dumps(result_payload))


async def _handle_save_skill(args: dict, ctx: ToolContext) -> ToolResult:
    name = args.get("name", "").strip()
    description = args.get("description", "")
    instructions = args.get("instructions", "")
    if not name:
        return ToolResult(result=json.dumps({"error": "Skill name is required."}))

    # Check if user already owns a skill with this name
    existing_resp = await aexec(
        ctx.supabase.table("skills")
        .select("id")
        .eq("user_id", ctx.current_user["id"])
        .eq("name", name)
        .limit(1)
    )
    existing = existing_resp.data[0] if existing_resp.data else None

    # TRIG-03 (D-09/D-10/Pitfall 6): lint the description, owner-scoped, NEVER block.
    # The save always proceeds; warnings ride along as a non-fatal note so the agent
    # can mention them. A read failure degrades to an empty sibling list.
    lint_warnings: list[dict] = []
    try:
        siblings_resp = await aexec(
            ctx.supabase.table("skills")
            .select("id, description")
            .or_(f"user_id.eq.{ctx.current_user['id']},is_global.eq.true")
        )
        siblings = [
            r.get("description", "")
            for r in (siblings_resp.data or [])
            if not existing or str(r.get("id")) != str(existing["id"])
        ]
        lint_warnings = lint_description(name, description, siblings)
    except Exception:
        lint_warnings = []

    if existing:
        row = existing
        await aexec(
            ctx.supabase.table("skills").update({
                "description": description,
                "instructions": instructions,
            }).eq("id", row["id"]).eq("user_id", ctx.current_user["id"])
        )
        return ToolResult(result=json.dumps(
            {"status": "updated", "name": name, "lint_warnings": lint_warnings}
        ))
    else:
        await aexec(
            ctx.supabase.table("skills").insert({
                "user_id": ctx.current_user["id"],
                "name": name,
                "description": description,
                "instructions": instructions,
            })
        )
        return ToolResult(result=json.dumps(
            {"status": "created", "name": name, "lint_warnings": lint_warnings}
        ))


# Phase 142 (SRH-01 / SC#3 / D-11) — the honest caveat prepended to a decoded
# non-Python script (an ext in the shared SCRIPT_EXTS). read_skill_file stops
# mislabeling script text as unreadable "binary"; the model is told the file is
# reference-only, not runnable here. PLAIN TEXT (not json) — matches the .py/.md
# text-return contract so the model reads it as source, not an error object.
_SCRIPT_REF_CAVEAT = (
    "[reference only — '{filename}' is a {ext} script; this sandbox runs Python only "
    "and cannot execute it. Read it for reference; do not attempt to run it.]\n\n"
)


def _decode_skill_file_bytes(filename: str, raw_bytes: bytes) -> str:
    """Decode skill-file bytes to a text tool_result by extension.

    PURE EXTRACTION (099 Plan 03) of the ext-decode block that lived inline in
    ``_handle_read_skill_file`` — byte-identical behavior (docx/xlsx/pptx/text/binary).
    Shared by BOTH the live-skill read path (the SC#3 red line — unchanged behavior)
    AND the 099 snapshot-routing branch, so the snapshot read decodes exactly as the
    live read does. Behavior here MUST stay identical to the pre-099 inline block.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "docx":
        import docx as _docx  # python-docx
        doc = _docx.Document(io.BytesIO(raw_bytes))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    elif ext == "xlsx":
        import openpyxl as _openpyxl
        wb = _openpyxl.load_workbook(io.BytesIO(raw_bytes), read_only=True, data_only=True)
        rows = []
        for sheet in wb.worksheets:
            for row_data in sheet.iter_rows(values_only=True):
                line = "\t".join(str(c) if c is not None else "" for c in row_data)
                if line.strip():
                    rows.append(line)
        return "\n".join(rows)
    elif ext == "pptx":
        from pptx import Presentation as _Presentation  # python-pptx
        prs = _Presentation(io.BytesIO(raw_bytes))
        slides = []
        for slide in prs.slides:
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    slides.append(shape.text)
        return "\n".join(slides)
    elif ext in {"txt", "md", "py", "csv", "json", "yaml", "yml", "toml", "html", "xml", "rst", "log"}:
        return raw_bytes.decode("utf-8", errors="replace").replace('\x00', '')
    elif ext in SCRIPT_EXTS:
        # SC#3 / D-11 — non-Python scripts (.js/.sh/...) ARE text: decode them as
        # honest reference source with a "not executable in this sandbox" caveat,
        # replacing the misleading "binary — upload a text version" else-branch below.
        # This lives in the SHARED decoder, so the live read (_handle_read_skill_file
        # live path) and the 099 snapshot read inherit the identical string for free
        # (byte-symmetry / Pitfall 3). SCRIPT_EXTS is the Plan-01 single source.
        source = raw_bytes.decode("utf-8", errors="replace").replace('\x00', '')
        return _SCRIPT_REF_CAVEAT.format(filename=filename, ext=ext) + source
    else:
        # Unrecognized or binary type
        return json.dumps({
            "error": f"File '{filename}' is a binary file that cannot be read as text. "
                     "Upload a text-based version instead."
        })


async def _handle_read_skill_file(args: dict, ctx: ToolContext) -> ToolResult:
    filename = args.get("filename", "")
    # 099 D-04 GATE (mirrors the 098 search-scope gate at :187) — when a workflow
    # phase carries a materialized skill snapshot, read from the IMMUTABLE snapshot
    # copies, NOT the live skill. None (Deep mode + non-skill phases) => this branch
    # is skipped and the live path below runs BYTE-IDENTICAL (SC#3 red line / Pitfall 4).
    snapshot = getattr(ctx, "skill_snapshot", None)
    if snapshot is not None:
        if filename not in getattr(snapshot, "files", []):
            return ToolResult(result=json.dumps(
                {"error": f"File '{filename}' not in the workflow's skill snapshot."}
            ))
        storage_path = f"{snapshot.storage_prefix}/{filename}"
        try:
            # Un-wrapped .download() for byte-symmetry with the live path (Open Question 4 —
            # single small file; only the multi-file WRITE materializer is threadpool-wrapped).
            raw_bytes = ctx.supabase.storage.from_("skill-files").download(storage_path)
            tool_result = _decode_skill_file_bytes(filename, raw_bytes)
        except Exception as e:
            tool_result = json.dumps({"error": f"File '{filename}' not found in snapshot: {e}"})
        return ToolResult(result=tool_result)

    # ── live-skill resolution below — UNCHANGED (the SC#3 red line; Pitfall 4) ──
    skill_name = args.get("skill_name", "")
    # Resolve skill to get owner's user_id for storage path
    _sr_resp = await aexec(
        ctx.supabase.table("skills")
        .select("id, user_id")
        .or_(f"user_id.eq.{ctx.current_user['id']},is_global.eq.true")
        .eq("name", skill_name)
        .maybe_single()
    )
    skill_row = _sr_resp.data if _sr_resp is not None else None
    if not skill_row:
        # Retry with normalized name for agent display-name mismatches
        _sr_norm = skill_name.lower().replace(" ", "-")
        if _sr_norm != skill_name:
            _sr_resp2 = await aexec(
                ctx.supabase.table("skills")
                .select("id, user_id")
                .or_(f"user_id.eq.{ctx.current_user['id']},is_global.eq.true")
                .eq("name", _sr_norm)
                .maybe_single()
            )
            skill_row = _sr_resp2.data if _sr_resp2 is not None else None
    if not skill_row:
        return ToolResult(result=json.dumps({"error": f"Skill '{skill_name}' not found."}))

    row = skill_row[0] if isinstance(skill_row, list) else skill_row
    storage_path = f"{row['user_id']}/{row['id']}/{filename}"
    try:
        raw_bytes = ctx.supabase.storage.from_("skill-files").download(storage_path)
        tool_result = _decode_skill_file_bytes(filename, raw_bytes)
    except Exception as e:
        tool_result = json.dumps({"error": f"File '{filename}' not found: {e}"})

    return ToolResult(result=tool_result)


async def _handle_execute_code(args: dict, ctx: ToolContext) -> ToolResult:
    """Execute code in the sandbox container.

    This is the largest handler (~385 lines in threads.py). It manages the
    sandbox session lifecycle, queue drain loop, file harvesting, and all
    sandbox SSE events.
    """
    # Import drain_step from threads module (it's a pure function at module scope)
    from app.api.threads import drain_step  # noqa: PLC0415

    import uuid as _uuid_mod
    import tempfile as _tempfile_local
    import os as _os_local

    code = args.get("code", "")
    libraries = args.get("libraries") or []

    # Phase 142 (SRH-01 / D-06) — PRE-FLIGHT repeat-guard. If a PERMANENT runtime
    # gap already fired on a token THIS run and the incoming code references it
    # again, short-circuit BEFORE acquiring the sandbox. This structurally caps the
    # BUG-260707-02 soffice/markitdown retry loop at <=1 real dead sandbox call per
    # token, even for a weak model that ignores the honest framing. Guarded
    # `is not None` => a literal no-op for every unwired (Deep/harness/eval/test)
    # caller, so no sandbox event fires and Deep behavior stays byte-identical.
    # Tokens are drawn only from the fixed KNOWN_MISSING allowlist (or a narrowed
    # bundled-tree G-A path captured from stderr). CR-02: binary/module IDENTIFIERS
    # (`node`, `soffice`, `markitdown`) are matched at WORD BOUNDARIES and JS/path
    # tokens by containment via `_code_references_dead_token` — a bare substring
    # inside a larger word (`annotate`, `node_list`, `network_xyz`) never re-blocks
    # legitimate code for the rest of the run.
    if ctx.dead_gap_tokens_in_run is not None:
        _dead_token = next(
            (t for t in ctx.dead_gap_tokens_in_run
             if t and _code_references_dead_token(code, t)),
            None,
        )
        if _dead_token is not None:
            # WR-02: bracket the short-circuit with the SAME code_execution
            # start/complete SSE pair the normal path emits (:998 / :1335), so the
            # UI code-card for this call RESOLVES instead of spinning forever with
            # no matching complete event. Every other exit path from this handler
            # (timeout abort, exception) already emits a complete. Safe for unwired
            # callers — the whole block is gated on `dead_gap_tokens_in_run is not
            # None`, so Deep/eval/duck-typed ctx never reach it (byte-identical D-14).
            await ctx.emit(ctx.redis, ctx.run_id, 'code_execution_start',
                           code_preview=code[:200])
            await ctx.emit(ctx.redis, ctx.run_id, 'code_execution_complete',
                           exit_code=1, duration_ms=0, output_files=[])
            _short_circuit = _repeat_blocked_result(_dead_token)
            return ToolResult(result=_short_circuit, llm_content=_short_circuit)

    # Emit start event (SAND-04)
    await ctx.emit(ctx.redis, ctx.run_id, 'code_execution_start', code_preview=code[:200])
    # SAND (silence fix): setup-window clock for the honest phase labels below
    # ('starting sandbox' / 'installing libraries'). Everything between here and
    # the drain loop (container bring-up + pip install) used to run blocking on
    # the event loop and emit NOTHING — the real dead-air the user perceived.
    _setup_started = time_mod.time()

    # Use the previous_files_in_run dict from ctx for cross-call file tracking
    _previous_files_in_run = ctx.previous_files_in_run if ctx.previous_files_in_run is not None else {}

    try:
        # SAND (silence fix): honest 'starting sandbox' phase for the container
        # spin-up window + threadpool the blocking create/attach so it never
        # freezes the event loop (D-v2.5-01). A NEW-thread container build is
        # 15-22s that used to be silent dead-air, also stalling SSE flush for
        # every run on the worker.
        await ctx.emit(ctx.redis, ctx.run_id, 'code_executing',
                       tool_index=ctx.tool_index,
                       elapsed_seconds=round(time_mod.time() - _setup_started, 1),
                       phase='starting_sandbox')
        session = await run_in_threadpool(sandbox_manager.get_or_create, ctx.thread_id)

        # Phase 120 (COLL-01) — run-scope the harvest by SEEDING the per-run
        # dedup baseline ONCE with a SHA-256 snapshot of every file already in
        # /sandbox/output/ at run start. This excludes any pre-existing file
        # (e.g. a prior workflow's leftover .docx) from this run's emitted
        # delta — the harvest's existing `if h in previous_files: continue`
        # dedup does the rest. D-120-01: per-RUN scope, NOT per-cell — guard so
        # a multi-cell run seeds only on the FIRST cell (the per-cell
        # accumulation `_previous_files_in_run.update(_iter_files)` below stays
        # unchanged). D-120-02: NO /sandbox/output/ clear — we only stop
        # re-emitting, never destroy files. D-v2.5-01: run_in_threadpool is
        # MANDATORY — the snapshot does blocking container I/O. The same handler
        # serves BOTH Deep and Harness, so this one seed site covers both.
        if not getattr(ctx, "_output_baseline_seeded", False):
            _baseline = await run_in_threadpool(snapshot_output_baseline, session)
            _previous_files_in_run.update(_baseline)
            ctx._output_baseline_seeded = True

        loop = asyncio.get_running_loop()
        sandbox_queue: asyncio.Queue = asyncio.Queue()

        # Phase 075 D-075-05/06: callbacks carry captured_at
        def on_stdout(chunk: str):
            loop.call_soon_threadsafe(
                sandbox_queue.put_nowait,
                {"type": "stdout_chunk", "content": chunk, "captured_at": time_mod.time()}
            )

        def on_stderr(chunk: str):
            loop.call_soon_threadsafe(
                sandbox_queue.put_nowait,
                {"type": "stderr_chunk", "content": chunk, "captured_at": time_mod.time()}
            )

        # Ensure /sandbox/output exists (threadpool — blocking container I/O, D-v2.5-01)
        try:
            await run_in_threadpool(session.execute_command, "mkdir -p /sandbox/output")
        except Exception:
            pass

        # Inject skill files into sandbox
        skill_files_req = args.get("skill_files") or []
        file_preamble = ""
        for sf in skill_files_req:
            sf_skill_name = sf.get("skill_name", "")
            sf_filename = sf.get("filename", "")
            if not sf_skill_name or not sf_filename:
                continue
            _sf_resp = await aexec(
                ctx.supabase.table("skills")
                .select("id, user_id")
                .or_(f"user_id.eq.{ctx.current_user['id']},is_global.eq.true")
                .eq("name", sf_skill_name)
                .maybe_single()
            )
            sf_skill = _sf_resp.data if _sf_resp is not None else None
            if not sf_skill:
                # Retry with normalized name
                _sf_norm = sf_skill_name.lower().replace(" ", "-")
                if _sf_norm != sf_skill_name:
                    _sf_resp2 = await aexec(
                        ctx.supabase.table("skills")
                        .select("id, user_id")
                        .or_(f"user_id.eq.{ctx.current_user['id']},is_global.eq.true")
                        .eq("name", _sf_norm)
                        .maybe_single()
                    )
                    sf_skill = _sf_resp2.data if _sf_resp2 is not None else None
            if not sf_skill:
                logger.warning("Skill file injection: skill '%s' not found", sf_skill_name)
                continue
            sf_row = sf_skill[0] if isinstance(sf_skill, list) else sf_skill
            sf_storage_path = f"{sf_row['user_id']}/{sf_row['id']}/{sf_filename}"
            try:
                sf_bytes = ctx.supabase.storage.from_("skill-files").download(sf_storage_path)
                b64 = base64.b64encode(sf_bytes).decode("ascii")
                safe_name = sf_filename.replace("'", "\\'")
                file_preamble += (
                    f"import base64 as _b64, os as _os\n"
                    f"_os.makedirs('/sandbox', exist_ok=True)\n"
                    f"with open('/sandbox/{safe_name}', 'wb') as _f:\n"
                    f"    _f.write(_b64.b64decode('{b64}'))\n"
                    f"print('Injected skill file: {safe_name}')\n"
                )
            except Exception as sf_err:
                logger.warning("Failed to inject skill file %s/%s: %s", sf_skill_name, sf_filename, sf_err)

        wrapped_code = "import os; os.chdir('/sandbox/output')\n" + file_preamble + code

        # Write user code to a uniquely-named file inside the container
        code_file = f"/tmp/run-{_uuid_mod.uuid4().hex}.py"
        with _tempfile_local.NamedTemporaryFile(
            mode="w", encoding="utf-8", suffix=".py", delete=False
        ) as _tmp_fp:
            _tmp_fp.write(wrapped_code)
            _local_tmp_path = _tmp_fp.name
        try:
            await run_in_threadpool(session.copy_to_runtime, _local_tmp_path, code_file)
        finally:
            try:
                _os_local.unlink(_local_tmp_path)
            except OSError:
                pass

        # Install libraries
        if libraries:
            # SAND (silence fix): honest 'installing libraries' phase for the pip
            # window + threadpool the blocking install (matplotlib/pandas/etc.
            # can be many seconds) so it never freezes the event loop (D-v2.5-01).
            await ctx.emit(ctx.redis, ctx.run_id, 'code_executing',
                           tool_index=ctx.tool_index,
                           elapsed_seconds=round(time_mod.time() - _setup_started, 1),
                           phase='installing_libraries')
            try:
                await run_in_threadpool(session.install, libraries=libraries)
            except Exception as _install_err:
                logger.warning(
                    "sandbox library install failed thread=%s err=%s",
                    ctx.thread_id, type(_install_err).__name__,
                )

        start_time = time_mod.time()

        def _run_sync():
            exec_result = session.execute_command(
                f"python -u {code_file}",
                on_stdout=on_stdout,
                on_stderr=on_stderr,
            )
            loop.call_soon_threadsafe(
                sandbox_queue.put_nowait,
                {"type": "_done", "result": exec_result, "captured_at": time_mod.time()}
            )
            return exec_result

        fut = loop.run_in_executor(None, _run_sync)

        # Drain sandbox_queue, forwarding SSE events
        _drain_state: dict = {"stdout_partial": "", "stderr_partial": ""}
        _emitted_stdout_line_count = 0
        _emitted_stderr_line_count = 0
        _last_output_at = time_mod.time()
        _heartbeat_last = time_mod.time()
        _HEARTBEAT_INTERVAL_S = 1.0

        _tool_index = ctx.tool_index
        # 096 / SEED-063 — wall-clock ceiling for THIS execution. A runaway /
        # non-terminating script must not wedge the run forever (UAT Test 3).
        _exec_timeout_s = settings.sandbox_exec_timeout_seconds

        while True:
            try:
                item = await asyncio.wait_for(sandbox_queue.get(), timeout=_HEARTBEAT_INTERVAL_S)
            except asyncio.TimeoutError:
                now = time_mod.time()
                elapsed = now - start_time
                # ── 096 / SEED-063 wall-clock abort ─────────────────────────────
                # The _run_sync thread is blocked in session.execute_command and a
                # Python thread cannot be cancelled — kill+remove the container to
                # free it, surface the abort to the user + the model, and return a
                # tool-result error so the agent loop continues cleanly (never a
                # 40-minute zombie). 0/negative disables the cap (operator escape
                # hatch).
                if _exec_timeout_s > 0 and elapsed > _exec_timeout_s:
                    logger.warning(
                        "execute_code wall-clock timeout (%.0fs > %ds) thread=%s — "
                        "killing sandbox container", elapsed, _exec_timeout_s, ctx.thread_id,
                    )
                    try:
                        await run_in_threadpool(sandbox_manager.kill_session, ctx.thread_id)
                    except Exception:  # noqa: BLE001 — abort path never raises
                        logger.exception(
                            "kill_session failed after exec timeout thread=%s", ctx.thread_id,
                        )
                    # The blocked _run_sync thread will raise once the container is
                    # gone; we've abandoned `fut`. Retrieve its exception in a
                    # done-callback so Python doesn't log "exception never retrieved".
                    fut.add_done_callback(
                        lambda f: f.cancelled() or f.exception()
                    )
                    _msg = (
                        f"[execution aborted: exceeded the {_exec_timeout_s}s "
                        f"wall-clock limit]"
                    )
                    try:
                        await ctx.emit(ctx.redis, ctx.run_id, 'code_stderr',
                                       content=_msg, captured_at=now)
                        await ctx.emit(ctx.redis, ctx.run_id, 'code_execution_complete',
                                       exit_code=124, error=_msg,
                                       duration_ms=int(elapsed * 1000), output_files=[])
                    except Exception:  # noqa: BLE001
                        logger.exception("exec-timeout SSE emit failed thread=%s", ctx.thread_id)
                    return ToolResult(result=json.dumps({
                        "status": "error",
                        "error": "execution_timeout",
                        "exit_code": 124,
                        "message": (
                            f"Code execution exceeded the {_exec_timeout_s}s wall-clock "
                            f"limit and was aborted. Reduce the input size, use a more "
                            f"efficient approach, or split the work into smaller steps."
                        ),
                        "elapsed_seconds": round(elapsed, 1),
                    }))
                if now - _last_output_at >= _HEARTBEAT_INTERVAL_S:
                    await ctx.emit(ctx.redis, ctx.run_id, 'code_executing',
                                   tool_index=_tool_index, elapsed_seconds=round(elapsed, 1),
                                   phase='running')
                if now - _heartbeat_last >= 10.0:
                    await ctx.emit(ctx.redis, ctx.run_id, 'keepalive')
                    _heartbeat_last = now
                continue

            if item["type"] == "_done":
                # Flush trailing partial lines
                if _drain_state["stdout_partial"]:
                    await ctx.emit(ctx.redis, ctx.run_id, "code_stdout",
                                   content=_drain_state["stdout_partial"],
                                   captured_at=time_mod.time())
                    _emitted_stdout_line_count += 1
                    _drain_state["stdout_partial"] = ""
                if _drain_state["stderr_partial"]:
                    await ctx.emit(ctx.redis, ctx.run_id, "code_stderr",
                                   content=_drain_state["stderr_partial"],
                                   captured_at=time_mod.time())
                    _emitted_stderr_line_count += 1
                    _drain_state["stderr_partial"] = ""
                # Post-completion safety-net
                _exec_result = item.get("result")
                if _exec_result is not None:
                    _final_stdout = (getattr(_exec_result, "stdout", "") or "").strip()
                    _final_stderr = (getattr(_exec_result, "stderr", "") or "").strip()
                    if _emitted_stdout_line_count == 0 and _final_stdout:
                        await ctx.emit(ctx.redis, ctx.run_id, "code_stdout",
                                       content=_final_stdout,
                                       captured_at=time_mod.time())
                    if _emitted_stderr_line_count == 0 and _final_stderr:
                        await ctx.emit(ctx.redis, ctx.run_id, "code_stderr",
                                       content=_final_stderr,
                                       captured_at=time_mod.time())
                break

            if item["type"] in ("stdout_chunk", "stderr_chunk"):
                _last_output_at = item["captured_at"]
                emit_calls, _drain_state = drain_step(item, _drain_state)
                for evt_type, content, captured_at in emit_calls:
                    await ctx.emit(ctx.redis, ctx.run_id, evt_type,
                                   content=content, captured_at=captured_at)
                    if evt_type == "code_stdout":
                        _emitted_stdout_line_count += 1
                    else:
                        _emitted_stderr_line_count += 1
            else:
                await ctx.emit(ctx.redis, ctx.run_id, item['type'],
                               **{k: v for k, v in item.items() if k != 'type'})

        exec_result = await fut
        end_time = time_mod.time()
        duration_ms = int((end_time - start_time) * 1000)

        # Derive actual exit code
        actual_exit_code = getattr(exec_result, "exit_code", None) or 0
        if actual_exit_code == 0:
            stdout_text = exec_result.stdout or ""
            _error_markers = (
                "Traceback (most recent call last)",
                "Error:",
                "Exception:",
                "ModuleNotFoundError",
                "ImportError",
                "SyntaxError",
                "NameError",
                "TypeError",
                "ValueError",
                "RuntimeError",
                "AttributeError",
                "KeyError",
                "IndexError",
            )
            if any(m in stdout_text for m in _error_markers):
                actual_exit_code = 1

        # Log execution to DB (SAND-09)
        exec_row = await aexec(
            ctx.supabase.table("code_executions").insert({
                "thread_id": ctx.thread_id,
                "user_id": ctx.current_user["id"],
                "code": code,
                "exit_code": actual_exit_code,
                "duration_ms": duration_ms,
            })
        )
        execution_id = exec_row.data[0]["id"] if exec_row.data else None

        # Harvest output files from container
        output_file_list: list[dict] = []
        if execution_id and actual_exit_code == 0:
            delta_files, _iter_files = await run_in_threadpool(
                harvest_output_files,
                session, execution_id, ctx.current_user["id"], ctx.supabase,
                _previous_files_in_run,
                ctx.iteration,
            )
            # RUN-01a: content-hashes present THIS cell that weren't already tracked
            # are genuinely new to the run. Compute the set difference BEFORE the
            # .update() below so (a) baseline hashes seeded at ~929 (already in
            # _previous_files_in_run.keys() because the baseline seed runs earlier
            # in this same handler on the first cell) are excluded, and (b) cross-cell
            # regenerations (a hash already tracked from an earlier cell) are excluded —
            # matching the per-cell delta_files "not new" semantics. Guarded on the
            # None default so sub-agent/harness ctx builds stay byte-identical (D-14).
            if ctx.new_file_hashes_in_run is not None:
                ctx.new_file_hashes_in_run |= (set(_iter_files) - _previous_files_in_run.keys())
            _previous_files_in_run.update(_iter_files)
            output_file_list = delta_files

        # Emit completion event (SAND-06)
        await ctx.emit(ctx.redis, ctx.run_id, 'code_execution_complete',
                       exit_code=actual_exit_code, duration_ms=duration_ms,
                       execution_id=execution_id, output_files=output_file_list)

        exec_status = "completed" if actual_exit_code == 0 else "error"
        tool_result = json.dumps({
            "status": exec_status,
            "exit_code": actual_exit_code,
            "duration_ms": duration_ms,
            "execution_id": execution_id,
            "output_files": output_file_list,
            "stdout": exec_result.stdout or "",
            "stderr": exec_result.stderr or "",
        })
        # Strip signed URLs from LLM context
        _llm_payload = {
            "status": exec_status,
            "exit_code": actual_exit_code,
            "duration_ms": duration_ms,
            "output_files": [{"filename": f["filename"], "size": f["size"]} for f in output_file_list],
            "stdout": exec_result.stdout or "",
            "stderr": exec_result.stderr or "",
        }
        # Phase 142 (SRH-01 / D-06) — POST-HOC reshape. Classify the completed
        # failure against the fixed KNOWN_MISSING allowlist; on a HIT append a
        # PERMANENT-framed `runtime_gap` note to the MODEL-facing llm_content (so a
        # weak model can't misread a bare stderr as transient) AND record the token
        # in the run-scoped repeat-guard set (guarded `is not None` => no-op when
        # unwired). On a MISS (T-142-01) stdout/stderr pass through UNCHANGED — a
        # real error still reaches the model. `tool_result` (the persisted/UI copy)
        # is left untouched: only the model-facing view carries the honest note.
        # CR-01(1a): classify ONLY an actual FAILURE. A successful exit-0 run is
        # NEVER reshaped and NEVER records a repeat-guard token — even if its stdout
        # happens to print a string like "node not found". All three real gap
        # classes always exit non-zero (or get bumped to 1 above when an exit-0 run
        # prints a Python error marker to stdout), so gating on failure loses no
        # true positive while removing the successful-run false-reshape path.
        _gap = None
        if actual_exit_code != 0:
            _gap = _classify_runtime_gap(
                code, exec_result.stdout or "", exec_result.stderr or "", actual_exit_code
            )
        if _gap is not None:
            _llm_payload["runtime_gap"] = _gap
            if ctx.dead_gap_tokens_in_run is not None:
                ctx.dead_gap_tokens_in_run.add(_gap["token"])
        llm_content = json.dumps(_llm_payload)
        ctx.spawn(write_audit_entry(
            user_id=ctx.current_user["id"],
            action_type="code.execute",
            metadata={"thread_id": ctx.thread_id, "language": args.get("language", "python")},
            supabase=ctx.supabase,
        ))

        return ToolResult(result=tool_result, llm_content=llm_content)

    except Exception as exec_err:
        logger.error("execute_code failed: %s", exec_err)
        await ctx.emit(ctx.redis, ctx.run_id, 'code_execution_complete',
                       exit_code=1, error=str(exec_err), duration_ms=0, output_files=[])
        return ToolResult(result=json.dumps({"status": "error", "error": str(exec_err)}))


async def _handle_remember(args: dict, ctx: ToolContext) -> ToolResult:
    # Phase 33 MEM-01: store user preference/fact across threads
    key = (args.get("key", "") or "").strip().lower()
    value = args.get("value", "") or ""

    if not key:
        return ToolResult(result=json.dumps({"error": "key cannot be empty"}))

    tool_result = json.dumps({"status": "remembered", "key": key})

    async def _write_memory(
        _key: str = key,
        _value: str = value,
        _uid: str = ctx.current_user["id"],
    ) -> None:
        try:
            await aexec(
                ctx.supabase.table("user_memory").upsert(
                    {
                        "user_id": _uid,
                        "key": _key,
                        "value": _value,
                    },
                    on_conflict="user_id,key",
                )
            )
        except Exception as exc:
            logger.warning(
                "memory.remember write failed [user=%s key=%s]: %s",
                _uid, _key, exc,
            )

    ctx.spawn(_write_memory())
    ctx.spawn(write_audit_entry(
        user_id=ctx.current_user["id"],
        action_type="memory.remember",
        metadata={"key": key, "value": value, "action": "upsert"},
        supabase=ctx.supabase,
    ))

    return ToolResult(result=tool_result)


async def _handle_recall(args: dict, ctx: ToolContext) -> ToolResult:
    # Phase 33 MEM-01: retrieve stored memory entries
    key = (args.get("key", "") or "").strip().lower()

    if key:
        resp = await aexec(
            ctx.supabase.table("user_memory")
            .select("value")
            .eq("user_id", ctx.current_user["id"])
            .eq("key", key)
            .maybe_single()
        )
        row = resp.data if resp else None
        # Pitfall 5: maybe_single() mock compatibility
        if isinstance(row, list):
            row = row[0] if row else None
        if row:
            tool_result = row["value"]
        else:
            tool_result = f"No memory entry found for key: {key}"
    else:
        _rows_resp = await aexec(
            ctx.supabase.table("user_memory")
            .select("key, value")
            .eq("user_id", ctx.current_user["id"])
            .order("updated_at", desc=True)
        )
        rows = _rows_resp.data or []
        if rows:
            tool_result = "\n".join(
                f"- {r['key']}: {r['value']}" for r in rows
            )
        else:
            tool_result = "No memories stored yet."

    ctx.spawn(write_audit_entry(
        user_id=ctx.current_user["id"],
        action_type="memory.recall",
        metadata={"key": key or None},
        supabase=ctx.supabase,
    ))

    return ToolResult(result=tool_result)


async def _handle_query_tables(args: dict, ctx: ToolContext) -> ToolResult:
    # MODAL-03 Phase 36: query structured table data from documents
    from app.services.multimodal_service import handle_query_tables  # noqa: PLC0415
    tool_result = await handle_query_tables(args, ctx.current_user["id"], ctx.supabase)
    return ToolResult(result=tool_result)


# ---------------------------------------------------------------------------
# Workspace tool handlers (Phase 084)
# ---------------------------------------------------------------------------

# -- Phase 084 Plan 05: weak-model defensive normalization --------------
# Some weak OpenRouter models (e.g. llama-3.3-70b-instruct) stringify
# JSON null and integer values for optional tool args, e.g.
#   {"prefix": "null"}  or  {"start_line": "1"}
# The 5 native providers (OpenAI/Anthropic/Google/deepseek/moonshot) emit
# proper JSON types so these normalizers are no-ops for them. Additive
# defensive coding -- cannot regress any native provider's code path.
_NULL_STRINGS = frozenset({"null", "None", ""})


def _normalize_optional(value):
    """Treat string ``null``/``None``/`` `` as Python None. Pass through everything else."""
    if isinstance(value, str) and value in _NULL_STRINGS:
        return None
    return value


def _normalize_optional_int(value):
    """Normalize null-strings to None and coerce string integers to int.
    Returns None for None / null-strings / un-coercible values.
    Pass-through for genuine ints."""
    value = _normalize_optional(value)
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        try:
            return int(value.strip())
        except (ValueError, AttributeError):
            return None
    return None


async def _handle_workspace_write(args: dict, ctx: ToolContext) -> ToolResult:
    """Write or update a file in the thread workspace (D-13, WS-01)."""
    path = args.get("path", "")
    content_str = args.get("content", "")
    content = content_str.encode("utf-8")
    try:
        result = await ws_write_file(
            ctx.pool, ctx.supabase,
            thread_id=UUID(ctx.thread_id),
            user_id=UUID(ctx.current_user["id"]),
            path=path,
            content=content,
        )
        await ctx.emit(
            ctx.redis, ctx.run_id, 'workspace_file_written',
            # Phase 088-05 (D-16): emit the persisted workspace_files row id so the
            # live (no-refresh) panel can fetch content/versions/diff by id (those
            # endpoints are id-keyed — workspace.py:124/202/238). Without it the FE
            # upserts the file id-less and fetches `/files//content` → 404 until a
            # page reload re-hydrates via the GET listing. ADDITIVE only: no field
            # renamed/removed, same event name, same shared SSE vocabulary for every
            # provider (no per-provider branch). result["file_id"] is already a str.
            id=result["file_id"],
            path=result["path"],
            version=result["version"],
            size_bytes=result["size_bytes"],
            mime_type=result["mime_type"],
        )
        warning = result.get("warning")
        summary = {
            "status": "ok",
            "path": result["path"],
            "version": result["version"],
            "size_bytes": result["size_bytes"],
        }
        if warning:
            return ToolResult(result=f"{warning}\n\n{json.dumps(summary)}")
        return ToolResult(result=json.dumps(summary))
    except WorkspaceError as e:
        return ToolResult(result=json.dumps({"error": str(e)}))


async def _handle_workspace_read(args: dict, ctx: ToolContext) -> ToolResult:
    """Read a file from the thread workspace (D-13, WS-02)."""
    path = args.get("path", "")
    # Phase 084 Plan 05: weak OpenRouter models stringify integer optionals
    # (`"start_line": "1"` and `"end_line": "null"`); normalize defensively.
    # No-op for the 5 native providers which emit proper int/None.
    start_line = _normalize_optional_int(args.get("start_line"))
    end_line = _normalize_optional_int(args.get("end_line"))
    try:
        result = await ws_read_file(
            ctx.pool, ctx.supabase,
            thread_id=UUID(ctx.thread_id),
            path=path,
            start_line=start_line,
            end_line=end_line,
        )
        if result.get("is_binary"):
            return ToolResult(result=json.dumps({
                "path": result["path"],
                "mime_type": result["mime_type"],
                "size_bytes": result["size_bytes"],
                "note": result["note"],
            }))

        output = result.get("content", "")
        if result.get("is_truncated"):
            output += (
                f"\n\n[Truncated at {len(output)} chars. "
                f"Full file is {result['total_chars']} chars. "
                "Use start_line/end_line for specific sections.]"
            )
        return ToolResult(result=output)
    except WorkspaceError as e:
        return ToolResult(result=json.dumps({"error": str(e)}))


async def _handle_workspace_list(args: dict, ctx: ToolContext) -> ToolResult:
    """List files in the thread workspace (D-13, WS-03)."""
    # Phase 084 Plan 05: weak OpenRouter models emit `"prefix": "null"` as a
    # JSON STRING; the previous `if prefix:` truthy-check ran the prefix
    # branch with literal "null" → `WHERE path LIKE 'null%'` → 0 rows →
    # "Workspace is empty." Normalize so the string "null"/"None"/"" all
    # collapse to None. No-op for properly-typed args from native providers.
    prefix = _normalize_optional(args.get("prefix"))
    try:
        files = await ws_list_files(
            ctx.pool,
            thread_id=UUID(ctx.thread_id),
            prefix=prefix,
        )
        if not files:
            return ToolResult(result="Workspace is empty.")
        lines = []
        for f in files:
            size = f.get("size_bytes", 0)
            mime = f.get("mime_type", "unknown")
            lines.append(f"  {f['path']}  ({size:,} bytes, {mime})")
        header = f"{len(files)} file(s) in workspace"
        if prefix:
            header += f" (prefix: {prefix})"
        return ToolResult(result=f"{header}:\n" + "\n".join(lines))
    except WorkspaceError as e:
        return ToolResult(result=json.dumps({"error": str(e)}))


async def _handle_workspace_delete(args: dict, ctx: ToolContext) -> ToolResult:
    """Delete a file from the thread workspace (D-13, WS-03)."""
    path = args.get("path", "")
    try:
        await ws_delete_file(
            ctx.pool, ctx.supabase,
            thread_id=UUID(ctx.thread_id),
            path=path,
        )
        await ctx.emit(
            ctx.redis, ctx.run_id, 'workspace_file_deleted',
            path=path,
        )
        return ToolResult(result=json.dumps({"status": "deleted", "path": path}))
    except WorkspaceError as e:
        return ToolResult(result=json.dumps({"error": str(e)}))


async def _handle_workspace_diff(args: dict, ctx: ToolContext) -> ToolResult:
    """Show diff between two versions of a workspace file (D-13, WS-04)."""
    path = args.get("path", "")
    # Phase 084 Plan 05: same weak-model defensive coercion as workspace_read.
    from_version = _normalize_optional_int(args.get("from_version"))
    to_version = _normalize_optional_int(args.get("to_version"))
    try:
        result = await ws_get_diff(
            ctx.pool, ctx.supabase,
            thread_id=UUID(ctx.thread_id),
            path=path,
            from_version=from_version,
            to_version=to_version,
        )
        delta = result.get("delta", {})
        stats = result.get("stats", {})
        diff_text = delta.get("diff", "")
        output = f"Diff: {path} v{result['from_version']} -> v{result['to_version']}\n"
        output += f"+{stats.get('additions', 0)} -{stats.get('deletions', 0)}\n\n"
        output += diff_text
        if delta.get("truncated"):
            output += "\n[Diff truncated -- very large change]"
        return ToolResult(result=output)
    except WorkspaceError as e:
        return ToolResult(result=json.dumps({"error": str(e)}))


# ---------------------------------------------------------------------------
# Phase 101 (TMPL-02 / TMPL-03) — render_template tool
#
# The G-5 extension contract: a new agent tool is a handler + ONE _TOOL_REGISTRY
# line; threads.py is never touched. This composes Plan 02's deterministic core
# (template_render_service) + Plan 03's byte resolution (template_asset_service)
# + the existing sandbox substrate (sandbox_service) + the existing workspace
# persist (workspace_service / workspace_file_written SSE) into a single handler.
#
# Pitfall 4 (the security boundary): the render functions run INSIDE the sealed,
# network-less Docker sandbox. The LLM produces DATA (the cited field-map, the
# tool's typed argument); deterministic code in the sandbox produces the FILE.
# There is NO docxtpl import in backend/app/** — the render driver below is a
# self-contained Python SOURCE STRING shipped into the container via
# copy_to_runtime and run by `python -u`, exactly like _handle_execute_code
# ships the user-code file.
# ---------------------------------------------------------------------------

# The render driver — a SELF-CONTAINED script shipped INTO the sandbox container.
#
# It imports ONLY libraries present in the sandbox image (docxtpl / python-docx /
# python-pptx / openpyxl / jinja2). It must NOT import `app.*` (the container has
# no backend/app on its path). It INLINES the small set of Plan-02 pure functions
# it needs (build_context / render_docx_template / run_replace_docx /
# residual_tags_in / assert_integrity), so the driver is dependency-free w.r.t.
# the backend package. It NEVER crashes — every exit path prints exactly ONE JSON
# verdict line as its FINAL stdout so the handler can parse the verdict back.
_RENDER_DRIVER_SRC = r'''
"""Phase 101 sandbox render driver (shipped INTO the container by tool_dispatcher).

argv: <engine> <template_path> <field_map_json_path> <out_path>
  engine: "docxtpl" (trusted/library, Jinja row-growth) | "run_replace"
          (arbitrary upload, non-Jinja scalar replace).

Prints exactly ONE JSON line as the LAST stdout line:
  {"rendered":bool, "opened":bool, "residual_clean":bool, "residual_tags":[...],
   "documented_limit":str|None, "rows":int, "error":str|None}
The handler treats a missing / non-`opened` verdict as a FAILURE (never persists).
"""
import json
import os
import re
import sys

_PLACEHOLDER_TOKEN_RE = re.compile(r"\{\{\s*[A-Za-z_][\w.]*\s*\}\}")
_RESIDUAL_TOKENS = ("{{", "}}", "{%", "%}")


def _cell(cited):
    cited = cited or {}
    v = cited.get("value") if isinstance(cited, dict) else None
    return {
        "value": "" if v is None else v,
        "source_chunk_id": cited.get("source_chunk_id") if isinstance(cited, dict) else None,
        "source_doc": cited.get("source_doc") if isinstance(cited, dict) else None,
        "source_page": cited.get("source_page") if isinstance(cited, dict) else None,
    }


def _build_row(row):
    row = row or {}
    r = {col: _cell(cited) for col, cited in row.items()}
    r.setdefault("score", "")
    return r


def build_context(field_map_dict):
    ctx = {}
    scalars = field_map_dict.get("scalars")
    collections = field_map_dict.get("collections")
    if scalars is not None or collections is not None:
        for key, cited in (scalars or {}).items():
            ctx[key] = _cell(cited)
        for cname, rows in (collections or {}).items():
            ctx[cname] = [_build_row(row) for row in (rows or [])]
        return ctx
    for key, val in field_map_dict.items():
        if isinstance(val, list):
            ctx[key] = [_build_row(row) for row in val]
        else:
            ctx[key] = _cell(val)
    return ctx


def _flat_scalars(field_map_dict):
    """Flatten a field-map into {token_key: str_value} for the run-replace engine.

    Accepts the generic envelope (scalars bucket) OR a flat {key: cited} dict.
    """
    src = field_map_dict.get("scalars")
    if src is None and field_map_dict.get("collections") is None:
        src = field_map_dict  # flat shape
    flat = {}
    for key, raw in (src or {}).items():
        if isinstance(raw, dict):
            v = raw.get("value")
        else:
            v = raw
        flat[key] = "" if v is None else str(v)
    return flat


def render_docx_template(template_path, context, out_path):
    from docxtpl import DocxTemplate
    from jinja2 import TemplateSyntaxError
    from jinja2.sandbox import SandboxedEnvironment

    doc = DocxTemplate(template_path)
    jenv = SandboxedEnvironment(autoescape=True)  # SSTI containment + XML-safe (&<>)
    try:
        doc.render(context, jinja_env=jenv)  # docxtpl owns the bytes; the LLM never does
    except TemplateSyntaxError as exc:
        return {"rendered": False, "error": "TemplateSyntaxError: %s" % exc}
    doc.save(out_path)
    return {"rendered": True, "error": None}


def _replace_in_paragraph(paragraph, flat_scalars):
    # 101-06 WR-04 / IR-01: this is a VERBATIM mirror of the audited production helper
    # (template_render_service._replace_in_paragraph) so the two copies cannot diverge.
    # The OLD driver guard `if blanked_text == full: return` compared the BLANKED text to
    # the ORIGINAL — so a matched token whose net text equals the original was SKIPPED and
    # the token could survive in a later run fragment (a silent non-fill WR-03 then shipped).
    # Production tracks `matched` and uses `touched = matched or (blanked_text != replaced_text)`.
    runs = paragraph.runs
    if not runs:
        return
    full = paragraph.text
    matched = set()
    replaced_text = full
    for key, value in flat_scalars.items():
        token = "{{" + key + "}}"
        if token in replaced_text:
            matched.add(key)
            replaced_text = replaced_text.replace(token, value)
    # Blank any remaining placeholder-shaped token (unmatched intended placeholders).
    blanked_text = _PLACEHOLDER_TOKEN_RE.sub("", replaced_text)
    touched = matched or (blanked_text != replaced_text)
    replaced_text = blanked_text
    if not touched:
        return  # no token here -> leave runs (and their formatting) intact
    # Coalesce: whole replaced text into run[0], clear the rest.
    runs[0].text = replaced_text
    for r in runs[1:]:
        r.text = ""


def run_replace_docx(template_path, flat_scalars, out_path):
    from docx import Document

    doc = Document(template_path)

    def _walk(paragraphs):
        for p in paragraphs:
            _replace_in_paragraph(p, flat_scalars)

    _walk(doc.paragraphs)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                _walk(cell.paragraphs)
    for section in doc.sections:
        _walk(section.header.paragraphs)
        _walk(section.footer.paragraphs)
    doc.save(out_path)
    return {"rendered": True, "error": None}


def _hits(texts):
    out = []
    for txt in texts:
        if txt and any(tok in txt for tok in _RESIDUAL_TOKENS):
            out.append(txt.strip()[:80])
    return out


def residual_tags_in(out_path, fmt):
    fmt = fmt.lower()
    if fmt == "docx":
        from docx import Document

        doc = Document(out_path)
        texts = [p.text for p in doc.paragraphs]
        for t in doc.tables:
            for row in t.rows:
                for cell in row.cells:
                    texts.append(cell.text)
        return _hits(texts)
    if fmt == "pptx":
        from pptx import Presentation

        prs = Presentation(out_path)
        texts = []
        for slide in prs.slides:
            for shape in slide.shapes:
                if shape.has_text_frame:
                    for para in shape.text_frame.paragraphs:
                        for run in para.runs:
                            texts.append(run.text)
                if shape.has_table:
                    for row in shape.table.rows:
                        for cell in row.cells:
                            texts.append(cell.text)
        return _hits(texts)
    if fmt == "xlsx":
        from openpyxl import load_workbook

        wb = load_workbook(out_path)
        texts = []
        for ws in wb.worksheets:
            for row in ws.iter_rows(values_only=True):
                for val in row:
                    if isinstance(val, str):
                        texts.append(val)
        return _hits(texts)
    raise ValueError("residual_tags_in: unsupported fmt %r" % fmt)


def assert_integrity(out_path, fmt):
    """Re-open the produced file with the SAME library — the corruption oracle.

    Each loader RAISES on a corrupt/unopenable file; the caller catches it and
    sets opened=False so the file is NEVER delivered.
    """
    fmt = fmt.lower()
    residuals = residual_tags_in(out_path, fmt)
    documented_limit = None
    rows = 0
    if fmt == "docx":
        from docx import Document

        doc = Document(out_path)  # raises if corrupt / won't open
        rows = sum(len(t.rows) for t in doc.tables)
    elif fmt == "pptx":
        from pptx import Presentation

        prs = Presentation(out_path)  # raises if corrupt / won't open
        has_table = any(
            getattr(shape, "has_table", False)
            for slide in prs.slides for shape in slide.shapes
        )
        if has_table:
            documented_limit = "pptx cannot grow tables (python-pptx >=1.0.0)"
    elif fmt == "xlsx":
        from openpyxl import load_workbook

        wb = load_workbook(out_path)  # raises if corrupt / won't open
        has_chart = any(getattr(ws, "_charts", None) for ws in wb.worksheets)
        if has_chart:
            documented_limit = "openpyxl drops charts on save"
    else:
        raise ValueError("assert_integrity: unsupported fmt %r" % fmt)
    return {
        "opened": True,
        "rows": rows,
        "residual_tags": residuals,
        "residual_clean": len(residuals) == 0,
        "documented_limit": documented_limit,
    }


def _fmt_from_path(path):
    ext = os.path.splitext(path)[1].lstrip(".").lower()
    return ext or "docx"


def main():
    engine = sys.argv[1]
    template_path = sys.argv[2]
    field_map_json_path = sys.argv[3]
    out_path = sys.argv[4]
    fmt = _fmt_from_path(out_path)

    verdict = {
        "rendered": False,
        "opened": False,
        "residual_clean": False,
        "residual_tags": [],
        "documented_limit": None,
        "rows": 0,
        "error": None,
    }

    try:
        with open(field_map_json_path, "r", encoding="utf-8") as f:
            field_map = json.load(f)

        if engine == "docxtpl":
            context = build_context(field_map)
            render_res = render_docx_template(template_path, context, out_path)
        elif engine == "run_replace":
            flat = _flat_scalars(field_map)
            render_res = run_replace_docx(template_path, flat, out_path)
        else:
            verdict["error"] = "unknown engine %r" % engine
            print(json.dumps(verdict))
            return

        verdict["rendered"] = bool(render_res.get("rendered"))
        if not verdict["rendered"]:
            verdict["error"] = render_res.get("error") or "render failed"
            print(json.dumps(verdict))
            return

        # Integrity re-open with the SAME library — raises if the file won't open.
        try:
            integ = assert_integrity(out_path, fmt)
            verdict["opened"] = bool(integ.get("opened"))
            verdict["residual_clean"] = bool(integ.get("residual_clean"))
            verdict["residual_tags"] = integ.get("residual_tags") or []
            verdict["documented_limit"] = integ.get("documented_limit")
            verdict["rows"] = integ.get("rows", 0)
        except Exception as exc:  # produced file is corrupt / won't re-open
            verdict["opened"] = False
            verdict["error"] = "integrity re-open failed: %s" % exc
    except Exception as exc:  # never crash — the handler reads the verdict
        verdict["error"] = "%s: %s" % (type(exc).__name__, exc)

    print(json.dumps(verdict))


if __name__ == "__main__":
    main()
'''


# 101-06 CR-01 — out_filename is MODEL-controlled (prompt-injectable via untrusted
# document content) and was interpolated unquoted into the sandbox shell command. A
# strict single-basename allow-list (OOXML extension only, no path separators / shell
# metacharacters) is the FIRST line of defense; argv-quoting in the handler is the
# structural second. A bad name falls back to a safe default so the happy path keeps
# working (least-surprising — documented in _handle_render_template's docstring).
import re as _re_filename

_SAFE_OUT_FILENAME_RE = _re_filename.compile(r"^[A-Za-z0-9._ -]+\.(docx|pptx|xlsx)$")
# The engine token is server-generated (select_engine) but we whitelist it before
# interpolation anyway (defense-in-depth — CR-01 step 3).
_VALID_RENDER_ENGINES = frozenset({"docxtpl", "run_replace"})


def _safe_out_filename(raw: str | None, template_ext: str) -> str:
    """101-06 CR-01 — coerce a model-supplied out_filename to a SAFE OOXML basename.

    Accepts a single basename matching ``^[A-Za-z0-9._ -]+\\.(docx|pptx|xlsx)$`` (no
    ``/`` ``\\`` ``..`` and no shell metacharacters ``; | & $ ( ) ` < > * ? '"``).
    On reject, falls back to ``deliverable.<ext>`` using the TEMPLATE's extension
    (always one of docx/pptx/xlsx; defaults to docx) so the happy path keeps working
    rather than failing the whole render on a cosmetic filename.
    """
    candidate = (raw or "").strip()
    if candidate and _SAFE_OUT_FILENAME_RE.match(candidate):
        return candidate
    ext = template_ext if template_ext in ("docx", "pptx", "xlsx") else "docx"
    return f"deliverable.{ext}"


# ---------------------------------------------------------------------------
# Phase 142 (SRH-01) — non-Python skill-script runtime-gap honesty.
#
# `_classify_runtime_gap` is the single correctness-critical piece of Phase 142:
# it decides WHETHER a completed sandbox failure is one of three KNOWN runtime
# gaps (G-A missing bundled file / G-B non-Python script / G-C missing binary or
# module) and, if so, WHICH permanent-framed honest message to surface. It is a
# PURE function (four string/int args -> dict | None). Nothing calls it in this
# plan — Plan 02 wires it into the completed-run result builder + the per-run
# repeat-guard; on its own it changes no runtime behavior.
#
# DESIGN LAW (threat T-142-01 — the most important property in the phase):
# NEVER reshape on error-type or exit-code ALONE. A hit requires a token from a
# FIXED allowlist NAMED by the shell as missing (`<tok>: not found` / a
# FileNotFoundError exec of it), or present with a 124/127 exit, OR a
# `No module named '<mod>'` for a known module, OR a JS-exclusive token on a
# NON-COMMENT `code` line together with a Python SyntaxError, OR a missing
# RELATIVE path under a known skill-bundle subdir (`scripts/`|`assets/`|`resources/`).
# The POST-HOC caller additionally gates on a NON-ZERO exit so a successful run is
# never reshaped. Everything else returns None so a genuine ValueError / a genuine
# missing /sandbox/output file / a real SyntaxError / a recoverable relative miss
# still reaches the model unchanged.
# Proven by test_142_runtime_gap.py::test_non_gap_passthrough. This mirrors the
# "distrust a model/sandbox string, match a FIXED set, safe default on non-match"
# posture of _safe_out_filename above.

# Fixed allowlists (single source — Plans 02/03/05 import these). Tokens are the
# bounded key space for GAP_MESSAGES and the repeat-guard set, so there is no
# attacker-controlled key growth (threat T-142-04).
KNOWN_MISSING_BINARIES = frozenset({
    "soffice", "libreoffice", "pandoc", "pdftoppm", "pdfinfo",
    "node", "npm", "npx", "extract-text",
})
KNOWN_MISSING_MODULES = frozenset({"markitdown"})
# CR-01(1c): JS-exclusive markers for the G-B (non-Python script) branch. `"let "`
# was REMOVED — Python has no `let`, but the substring is too common in ordinary
# English inside comments/strings ("let me…", "let's…") to be a safe JS signal and
# collided with the repeat-guard. The remaining markers are JS-only constructs.
JS_TOKENS = ("const ", "=>", "require(", "console.log",
             "export default", "function*")

# WR-01: the ONLY missing-path shape that classifies as a lost, flattened
# skill-tree helper (G-A). A relative path under one of these known skill-bundle
# subdirs (e.g. `scripts/office/convert.py`) is the flattened-tree signal. ANY
# other relative miss (`data/input.json`, `config/settings.yaml`) is a RECOVERABLE
# user error and passes through (None) so the model can create the dir / fix it.
_SKILL_BUNDLE_DIRS = ("scripts/", "assets/", "resources/")

# Shared script-extension set — consumed by D-11 decode (Plan 03), the D-05b
# load_skill flag (Plan 03), and the SC#1 import note (Plan 05). Single source;
# import from here.
SCRIPT_EXTS = frozenset({
    "js", "ts", "jsx", "tsx", "mjs", "cjs", "sh", "bash",
    "rb", "go", "rs", "php", "pl", "lua", "ps1", "bat",
})

# Permanent-framed reshape wording per gap. Each: names the gap, says it cannot
# become available, says do NOT retry, and offers the in-sandbox forward action
# (tone modeled on BUG-260707-02-pptx-skill-instructions-sandbox-aware.md).
_MSG_SOFFICE = ("LibreOffice (`soffice`) is not installed in this sandbox and cannot be "
    "installed here. Do NOT retry. Build or QA the presentation/document in-memory with "
    "python-pptx / python-docx / openpyxl, or tell the user this conversion is unavailable.")
_MSG_NODE = ("This sandbox runs Python only — Node.js/npm/npx are not installed and cannot "
    "be installed here. Do NOT retry as JavaScript. Re-implement the step in Python, or tell "
    "the user JavaScript execution is unavailable.")
GAP_MESSAGES = {
    "soffice": _MSG_SOFFICE,
    "libreoffice": _MSG_SOFFICE,
    "node": _MSG_NODE,
    "npm": _MSG_NODE,
    "npx": _MSG_NODE,
    "pandoc": ("pandoc is not installed in this sandbox and cannot be installed here. Do NOT "
        "retry. Work with the source format directly using python-docx / pypdf / openpyxl, or "
        "tell the user document conversion is unavailable."),
    "pdftoppm": ("Poppler (`pdftoppm`) is not installed in this sandbox and cannot be installed "
        "here. Do NOT retry. Read PDF text with pypdf instead of rasterizing pages, or tell the "
        "user PDF-to-image rendering is unavailable."),
    "pdfinfo": ("Poppler (`pdfinfo`) is not installed in this sandbox and cannot be installed "
        "here. Do NOT retry. Inspect the PDF with pypdf, or tell the user this is unavailable."),
    "extract-text": ("The `extract-text` helper is not installed in this sandbox and cannot be "
        "installed here. Do NOT retry. Extract text in-memory with pypdf / python-docx / "
        "python-pptx, or tell the user."),
    "markitdown": ("`markitdown` is not installed in this sandbox and cannot be installed here. "
        "Do NOT retry. Read the document in-memory with python-docx / python-pptx / openpyxl / "
        "pypdf, or tell the user this conversion is unavailable."),
}
# Class-level messages for G-B (JS) and G-A (missing bundled file), keyed by class not token:
GAP_MESSAGES_JS = _MSG_NODE
GAP_MESSAGES_MISSING_FILE = ("A bundled skill script at '{path}' was not found in the sandbox. "
    "Nested helper scripts (e.g. `scripts/office/*`) do not resolve here — the skill's folder "
    "tree is flattened on import. Do NOT retry the same path. Do the equivalent work in-memory "
    "with the Python libraries available, or tell the user.")

# Precompiled extractors (reuse the module-level `re` alias bound above). The
# module regex runs on a lowercased haystack; the path regex runs on the ORIGINAL
# stderr (IGNORECASE) so the captured path keeps its real case for the message.
_NO_MODULE_RE = _re_filename.compile(r"no module named ['\"]?([\w\.\-]+)")
_MISSING_PATH_RE = _re_filename.compile(
    r"no such file or directory:\s*['\"]([^'\"]+)['\"]", _re_filename.IGNORECASE
)

# CR-01(1b): a MISSING BINARY only classifies as G-C when the shell NAMES it as
# missing — `<tok>: not found`, `<tok>: command not found`, or a FileNotFoundError
# exec of EXACTLY that token — anchored to a left token boundary. A bare
# co-occurrence of the token with the words "not found" (a `ValueError` printing
# `config node 'db' not found`, which yields `node 'db' not found` NOT
# `node: not found`) is NOT a gap and passes through (None). One precompiled regex
# per fixed-allowlist token — no attacker-controlled key growth (T-142-04).
_BINARY_GAP_RES = {
    _btok: _re_filename.compile(
        rf"(?<![\w/-]){_re_filename.escape(_btok)}:\s*(?:command\s+)?not found"
        rf"|no such file or directory:\s*['\"]{_re_filename.escape(_btok)}['\"]",
        _re_filename.IGNORECASE,
    )
    for _btok in KNOWN_MISSING_BINARIES
}


def _strip_py_line_comments(code: str) -> str:
    """CR-01(1c) — drop each line's unquoted ``#…`` tail so a Python COMMENT can
    never supply a JS token to the G-B check (``# let me handle a => b``). Quote
    tracking is per-line and deliberately simple: on the rare edge it over-strips
    (a ``#`` inside a triple-quoted string spanning lines), it only removes MORE
    text, which can only SUPPRESS a G-B hit — the safe-default (pass-through)
    direction, so it never causes a false reshape."""
    out_lines: list[str] = []
    for line in code.splitlines():
        quote: str | None = None
        cut = len(line)
        i = 0
        n = len(line)
        while i < n:
            ch = line[i]
            if quote is not None:
                if ch == "\\":
                    i += 2
                    continue
                if ch == quote:
                    quote = None
            elif ch in ("'", '"'):
                quote = ch
            elif ch == "#":
                cut = i
                break
            i += 1
        out_lines.append(line[:cut])
    return "\n".join(out_lines)


def _classify_runtime_gap(
    code: str, stdout: str, stderr: str, exit_code: int
) -> dict | None:
    """Classify a completed sandbox failure as one of the three known runtime
    gaps, or None (pass-through — a real error the model must still see).

    Returns ``{"class": "G-A"|"G-B"|"G-C", "token": <str>, "message": <str>}``
    on a hit; ``None`` otherwise. Pure — no I/O. See the DESIGN LAW comment above:
    a hit ALWAYS requires a fixed-allowlist token NAMED as missing (or the
    JS-token+SyntaxError combination, or a bundled-skill-tree missing path) —
    never error-type or exit code alone. Safe default (``None``) on any non-match,
    exactly like ``_safe_out_filename`` returns ``deliverable.<ext>`` on a bad name.
    """
    code_s = code or ""
    out_l = f"{stdout or ''}\n{stderr or ''}".lower()
    all_l = f"{code_s.lower()}\n{out_l}"
    shell_exit = exit_code in (124, 127)

    # (a) G-C missing binary. Two disjoint signals, BOTH requiring a fixed-
    #     allowlist token — NEVER exit code alone:
    #       * a 124/127 exit with the token anywhere in code+output — a hung/killed
    #         binary leaves its name only in the executed code (the timeout stderr
    #         is our own abort message); OR
    #       * the shell NAMING the token as missing — `<tok>: not found`,
    #         `<tok>: command not found`, or a FileNotFoundError exec of EXACTLY
    #         that token — via the precise per-token regex (CR-01 1b). A bare
    #         co-occurrence of the token with the words "not found"
    #         (`config node 'db' not found`) is NOT a gap → falls through to None.
    for tok in sorted(KNOWN_MISSING_BINARIES):
        if shell_exit and tok in all_l:
            return {"class": "G-C", "token": tok, "message": GAP_MESSAGES[tok]}
        if _BINARY_GAP_RES[tok].search(out_l):
            return {"class": "G-C", "token": tok, "message": GAP_MESSAGES[tok]}

    # (b) G-C missing module — `No module named '<mod>'` for a KNOWN module only
    #     (a genuine `No module named some_pip_pkg` the user could install via
    #     libraries=[...] is NOT reshaped as permanent).
    m = _NO_MODULE_RE.search(out_l)
    if m:
        mod = m.group(1)
        if mod in KNOWN_MISSING_MODULES:
            return {"class": "G-C", "token": mod, "message": GAP_MESSAGES[mod]}

    # (c) G-B non-Python script — a JS-exclusive token on a NON-COMMENT `code`
    #     line AND a Python SyntaxError in stderr. Both required (a bare
    #     SyntaxError passes through). CR-01 1c: line-comments are stripped first
    #     so a `# let me handle a => b` note cannot masquerade as JS, and `"let "`
    #     is no longer a token (so `print("let there be light")` + SyntaxError
    #     passes through as None).
    if "syntaxerror" in out_l:
        code_no_comments = _strip_py_line_comments(code_s)
        for jtok in JS_TOKENS:
            if jtok in code_no_comments:
                return {"class": "G-B", "token": jtok, "message": GAP_MESSAGES_JS}

    # (d) G-A missing BUNDLED skill helper — a not-found RELATIVE path under a
    #     known skill-bundle subdir (`scripts/` | `assets/` | `resources/`): the
    #     lost flattened skill-tree signal. WR-01: a genuine missing relative USER
    #     path (`data/input.json`, `config/settings.yaml`) is RECOVERABLE — create
    #     the dir / fix the path — so it passes through (None); only bundle-prefixed
    #     relative paths are reshaped as a permanent lost-tree gap. A genuine
    #     absolute /sandbox/output/*.csv (starts with '/') also passes through.
    #     Recording only these narrowed paths keeps the repeat-guard set from
    #     growing on arbitrary model-supplied paths (T-142-04 reconciliation).
    pm = _MISSING_PATH_RE.search(stderr or "")
    if pm:
        path = pm.group(1).strip()
        if not path.startswith("/") and any(
            path.startswith(prefix) for prefix in _SKILL_BUNDLE_DIRS
        ):
            return {
                "class": "G-A",
                "token": path,
                "message": GAP_MESSAGES_MISSING_FILE.format(path=path),
            }

    return None


# Phase 142 (SRH-01 / D-06) — pre-flight repeat-guard support. A recorded dead
# token is one of: a KNOWN_MISSING binary/module (keys GAP_MESSAGES), a JS marker
# (GAP_MESSAGES_JS), or a lost flattened-tree G-A path (GAP_MESSAGES_MISSING_FILE).
# Map it back to its permanent-framed wording without re-running the classifier.
def _message_for_dead_token(token: str) -> str:
    if token in GAP_MESSAGES:
        return GAP_MESSAGES[token]
    if token in JS_TOKENS:
        return GAP_MESSAGES_JS
    return GAP_MESSAGES_MISSING_FILE.format(path=token)


# Phase 142 (SRH-01 / D-06) — pre-flight repeat-guard MATCH (CR-02). Decide whether
# a newly-submitted `code` re-references an already-dead token this run. A binary/
# module IDENTIFIER (`node`, `soffice`, `markitdown`, `extract-text`) is matched at
# WORD BOUNDARIES so a substring inside a larger word (`annotate`, `node_list`,
# `network_xyz`) never re-blocks legitimate code; a JS marker (`const `, `=>`, …) or
# a G-A bundled-tree path (contains `/`) is distinctive enough to keep containment.
# RESIDUAL ACCEPTED EDGE: a later cell that uses a variable literally named after a
# missing binary at a real word boundary (e.g. `node = 1`) is still blocked — rare,
# and the cost is one blocked benign cell, not the multi-round retry loop this guard
# exists to cap.
def _code_references_dead_token(code: str, token: str) -> bool:
    if token in KNOWN_MISSING_BINARIES or token in KNOWN_MISSING_MODULES:
        return _re_filename.search(
            rf"\b{_re_filename.escape(token)}\b", code, _re_filename.IGNORECASE
        ) is not None
    return token.lower() in code.lower()


_REPEAT_BLOCKED_NOTE = (
    "You already attempted this in the current run and it failed with a PERMANENT "
    "runtime gap — it will not succeed on retry. Stop retrying; use the in-sandbox "
    "alternative described above, or tell the user this is unavailable."
)


def _repeat_blocked_result(token: str) -> str:
    """Build the short-circuit tool-result JSON for the pre-flight repeat-guard.

    Error-shaped (``status='error'`` + non-zero ``exit_code``) so the model treats
    it as a failed call, carrying the same permanent-framed message plus the
    "already attempted this run" line. No sandbox is touched to produce it.
    """
    return json.dumps({
        "status": "error",
        "exit_code": 1,
        "duration_ms": 0,
        "output_files": [],
        "stdout": "",
        "stderr": "",
        "runtime_gap": {
            "token": token,
            "message": _message_for_dead_token(token),
            "repeat_blocked": True,
            "note": _REPEAT_BLOCKED_NOTE,
        },
    })


async def _handle_render_template(args: dict, ctx: ToolContext) -> ToolResult:
    """Phase 101 (TMPL-02 / TMPL-03) — fill a template into a real deliverable.

    The integration piece. The LLM emits the cited field-map as this tool's typed
    argument; the handler:
      1. truncation-guards the emission (D-08 — never accept a truncated empty map),
      2. runs the citation/coverage gate BEFORE render (D-08 failure class 1 —
         reject an uncited/invented field-map without rendering),
      3. resolves template bytes by provenance (Plan 03) + selects the engine (Plan 02),
      4. ships the bytes + field-map JSON + the render driver into the SEALED sandbox
         (Pitfall 4 / D-12) and harvests the produced file + integrity verdict,
      5. runs the integrity gate AFTER render (D-08 failure class 2 — a non-opening
         file is NEVER persisted; the cited field-map is preserved as fallback),
      6. persists the deliverable + reuses the workspace_file_written SSE → OutputFileCard
         ONLY when BOTH gates pass (no new UI).

    Inert unless the model calls render_template — Deep stays byte-identical.

    Security (101-06 CR-01): ``out_filename`` is MODEL-controlled (prompt-injectable via
    untrusted document content). It is coerced to a strict OOXML basename
    (``_safe_out_filename`` — path-separator / shell-metachar reject → SAFE DEFAULT
    ``deliverable.<ext>``; the least-surprising choice — a cosmetic bad name never fails
    the whole render). The sandbox command is then built argv-safely (``shlex.quote``
    EVERY token) so no derived value can break out of the shell string.

    Tool argument schema::

        {
          "asset": {asset_id, filename, kind, mime} | null,  # null => ephemeral upload
          "field_map": {"scalars": {...}, "collections": {...}},
          "retrieved_ids": [...],   # the spotlight ids the citation check validates against
          "out_filename": "...",     # sanitized to a safe OOXML basename (CR-01)
          "emission_meta": {stop_reason | finish_reason}  # optional truncation meta
        }
    """
    # The deterministic core (Plan 02) + the byte resolver (Plan 03). These import
    # CLEAN in the backend venv — the heavy libs (docxtpl/...) are only SHIPPED into
    # the sandbox via _RENDER_DRIVER_SRC, never executed in-process here (Pitfall 4).
    from app.services.template_render_service import check_coverage, select_engine
    from app.services.template_asset_service import own_claim_for_ctx, resolve_template_source

    import json as _json_local
    import os as _os_local
    import tempfile as _tempfile_local
    import uuid as _uuid_mod

    field_map = args.get("field_map")
    retrieved_ids = set(args.get("retrieved_ids") or [])
    # 101-06 CR-01: the RAW model-supplied name — used only as a benign fallback for
    # src_name below. The SANITIZED basename (_safe_out_filename) is derived AFTER the
    # template extension is known and is what reaches the sandbox command / harvest /
    # persist. NEVER interpolate raw_out_filename into a shell string or a path.
    raw_out_filename = (args.get("out_filename") or "").strip()

    # ── 1. Truncation guard (D-08) ──────────────────────────────────────────────
    # A truncated tool-JSON emission silently drops collections — never treat it as a
    # valid empty field-map. is_truncated lives in template_render_service; import it
    # lazily alongside the other pure helpers to keep the module-top surface clean.
    from app.services.template_render_service import is_truncated

    emission_meta = args.get("emission_meta") or {}
    if is_truncated(emission_meta):
        return ToolResult(result=_json_local.dumps({
            "status": "rejected",
            "reason": "truncated_emission",
            "message": (
                "The field-map emission was truncated (max_tokens / length). "
                "Re-emit the render_template field-map with a higher output budget."
            ),
        }))

    if not isinstance(field_map, dict) or not field_map:
        return ToolResult(result=_json_local.dumps({
            "status": "rejected",
            "reason": "empty_field_map",
            "message": "render_template requires a non-empty `field_map` argument.",
        }))

    # ── 2. Citation / coverage gate — BEFORE render (D-08 failure class 1) ───────
    # placeholder_keys: the field-map's own scalar+collection (or flat) keys. The
    # template's exact key set is verified at render time by docxtpl; here we only
    # need a key list for the coverage stat shape — the load-bearing assertion is the
    # uncited/invented counts, which are key-list-independent.
    scalars = field_map.get("scalars")
    collections = field_map.get("collections")
    if scalars is not None or collections is not None:
        placeholder_keys = list((scalars or {}).keys()) + list((collections or {}).keys())
    else:
        placeholder_keys = list(field_map.keys())

    stats = check_coverage(field_map, retrieved_ids, placeholder_keys)
    # CR-02 (102-08): the gate is POLICY-AWARE. When a non-strict citation_policy
    # (flag/partial/draft) was applied UPSTREAM (the executor's _exec_llm_emit non-strict
    # branch set citation_policy_applied — a server-set value, never the model/definition
    # JSONB), the map was DELIBERATELY marked/blanked/labeled and the policy decision was
    # already made + receipted (policy_applied) + surfaced-on-success. The gate no longer
    # re-rejects that policy-modified map. The STRICT path (no citation_policy_applied)
    # rejects an uncited/invented map exactly as today — the default trust bar holds
    # byte-identical (T-102-08-01).
    if (stats["uncited_value_count"] > 0 or stats["invented_citation_count"] > 0) \
            and not args.get("citation_policy_applied"):
        return ToolResult(result=_json_local.dumps({
            "status": "rejected",
            "reason": "uncited_or_invented",
            "message": (
                "The field-map has uncited or invented values — every non-null value "
                "must cite a source_chunk_id that was actually retrieved. "
                "Re-emit with valid citations or set unsupported values to null."
            ),
            "stats": stats,
        }))

    # ── 3. Resolve template bytes by provenance (Plan 03) + select engine (Plan 02) ─
    asset = args.get("asset")
    asset_ref = None
    if asset:
        try:
            from app.models.harness import AssetRef
            asset_ref = AssetRef.model_validate(asset)
        except Exception as exc:  # malformed asset ref — honest error, never a raw raise
            return ToolResult(result=_json_local.dumps({
                "status": "error",
                "reason": "bad_asset_ref",
                "message": f"Invalid `asset` reference: {exc}",
            }))

    # Phase 141 (COLL-02): run-scope the ephemeral (Branch 2) resolve. own_claim is
    # SERVER-DERIVED from ctx.workflow_run_id (None→'deep', else str(W)) — NEVER from the
    # model's tool args (D-141 / Tampering). Correct for all three ctx shapes that reach
    # here: Deep (None→'deep'), workflow sub-agent (inherited W→str(W)), and the emit
    # re-dispatch (_ProducerStreamCtx whose workflow_run_id is stamped in the harness).
    own_claim = own_claim_for_ctx(ctx)
    src = await resolve_template_source(
        pool=ctx.pool,
        supabase=ctx.supabase,
        thread_id=ctx.thread_id,
        user_id=ctx.current_user["id"],
        asset_ref=asset_ref,
        own_claim=own_claim,
    )
    if src.get("error"):
        # Run-honesty (D-05/D-10): relay the clean resolver error, never a traceback.
        return ToolResult(result=_json_local.dumps({
            "status": "error",
            "reason": "template_resolution",
            "message": src["error"],
        }))

    template_bytes = src.get("bytes")
    if not template_bytes:
        return ToolResult(result=_json_local.dumps({
            "status": "error",
            "reason": "no_template_bytes",
            "message": "Template resolved without bytes — nothing to render.",
        }))

    engine = select_engine(src["provenance"])
    # 101-06 CR-01 step 3 — defense-in-depth: the engine token is server-generated by
    # select_engine, but whitelist it before it is ever interpolated into the command.
    if engine not in _VALID_RENDER_ENGINES:
        return ToolResult(result=_json_local.dumps({
            "status": "error",
            "reason": "bad_engine",
            "message": f"select_engine returned an unexpected engine {engine!r}.",
        }))

    # The template extension drives the in-container temp path + the driver fmt.
    src_name = src.get("filename") or raw_out_filename or "deliverable.docx"
    template_ext = (_os_local.path.splitext(src_name)[1] or ".docx").lstrip(".").lower() or "docx"

    # 101-06 CR-01: coerce the model-supplied name to a SAFE OOXML basename (strict
    # allow-list; path-separator / shell-metachar reject → safe default). From here on
    # `out_filename` is the SANITIZED value — it is what reaches the sandbox command,
    # the harvest match, and the workspace persist path.
    out_filename = _safe_out_filename(raw_out_filename, template_ext)

    # ── 4. Render in the SEALED sandbox (Pitfall 4 / D-12 / D-13) ────────────────
    # No local-venv fallback — that would breach TMPL-03 (render MUST be sandboxed).
    if not settings.sandbox_enabled:
        return ToolResult(result=_json_local.dumps({
            "status": "error",
            "reason": "sandbox_disabled",
            "message": (
                "Template render requires the sandbox (SANDBOX_ENABLED=false). "
                "Enable the sandbox to render templates — there is no in-process fallback."
            ),
        }))

    container_template = f"/tmp/template-{_uuid_mod.uuid4().hex}.{template_ext}"
    container_field_map = f"/tmp/field_map-{_uuid_mod.uuid4().hex}.json"
    container_driver = f"/tmp/render_driver-{_uuid_mod.uuid4().hex}.py"
    container_out = f"/sandbox/output/{out_filename}"

    def _ship_and_run() -> dict:
        """Synchronous sandbox interaction (run in a threadpool — blocking I/O)."""
        session = sandbox_manager.get_or_create(ctx.thread_id)
        try:
            session.execute_command("mkdir -p /sandbox/output")
        except Exception:
            pass

        # Ship: template bytes, field-map JSON, the render driver — each via a local
        # NamedTemporaryFile then copy_to_runtime (mirrors _handle_execute_code:627-634).
        def _copy_in(local_bytes: bytes, container_path: str, *, text: bool):
            mode = "w" if text else "wb"
            suffix = ".py" if container_path.endswith(".py") else None
            kwargs: dict = {"mode": mode, "delete": False}
            if text:
                kwargs["encoding"] = "utf-8"
            if suffix:
                kwargs["suffix"] = suffix
            with _tempfile_local.NamedTemporaryFile(**kwargs) as _tmp:
                _tmp.write(local_bytes.decode("utf-8") if text else local_bytes)
                _local = _tmp.name
            try:
                session.copy_to_runtime(_local, container_path)
            finally:
                try:
                    _os_local.unlink(_local)
                except OSError:
                    pass

        _copy_in(template_bytes, container_template, text=False)
        _copy_in(_json_local.dumps(field_map).encode("utf-8"), container_field_map, text=False)
        _copy_in(_RENDER_DRIVER_SRC.encode("utf-8"), container_driver, text=False)

        # 101-06 CR-01: build the command argv-safely — shlex.quote EVERY token rather
        # than f-string-concatenating into one shell string. The three UUID paths are
        # server-generated (safe), the engine is whitelisted (_VALID_RENDER_ENGINES),
        # and out_filename is already a sanitized basename (_safe_out_filename) — but we
        # quote uniformly so no model/derived value can ever break out of the command
        # even if a future code path relaxes an upstream check (defense-in-depth).
        import shlex as _shlex_local

        cmd = " ".join(
            _shlex_local.quote(tok)
            for tok in (
                "python", "-u", container_driver, engine,
                container_template, container_field_map, container_out,
            )
        )
        exec_result = session.execute_command(cmd)
        stdout = getattr(exec_result, "stdout", None)
        if stdout is None:
            stdout = str(exec_result)

        # Parse the LAST JSON line of stdout (the driver prints exactly one verdict line).
        verdict_parsed = None
        for line in reversed([ln for ln in stdout.splitlines() if ln.strip()]):
            try:
                verdict_parsed = _json_local.loads(line)
                break
            except (ValueError, TypeError):
                continue

        produced: bytes | None = None
        if verdict_parsed and verdict_parsed.get("rendered") and verdict_parsed.get("opened"):
            # Harvest the single produced file (mirror harvest_output_files:261-273).
            with _tempfile_local.TemporaryDirectory() as _td:
                session.copy_from_runtime("/sandbox/output", _td)
                for _root, _dirs, _files in _os_local.walk(_td):
                    for _fn in _files:
                        if _fn == out_filename:
                            with open(_os_local.path.join(_root, _fn), "rb") as _fp:
                                produced = _fp.read()
                            break
                    if produced is not None:
                        break

        return {"verdict": verdict_parsed, "stdout": stdout, "produced": produced}

    try:
        run_out = await run_in_threadpool(_ship_and_run)
    except Exception as exc:  # noqa: BLE001 — honest error, never a raw raise to the loop
        msg = str(exc)
        if "ModuleNotFoundError" in type(exc).__name__ or "docxtpl" in msg:
            return ToolResult(result=_json_local.dumps({
                "status": "error",
                "reason": "sandbox_image_stale",
                "message": (
                    "The sandbox image is missing docxtpl. Rebuild it "
                    "(docker build -f backend/Dockerfile.sandbox ...), bump SANDBOX_IMAGE, "
                    "and start a NEW chat (cached sessions keep the old image)."
                ),
            }))
        logger.warning("render_template sandbox run failed thread=%s err=%s", ctx.thread_id, msg)
        return ToolResult(result=_json_local.dumps({
            "status": "error",
            "reason": "sandbox_error",
            "message": f"Template render failed in the sandbox: {msg}",
        }))

    verdict = run_out.get("verdict")
    produced = run_out.get("produced")

    if not verdict:
        # A missing/garbled verdict is a FAILURE — never persist (T-101-04-05).
        return ToolResult(result=_json_local.dumps({
            "status": "failed",
            "reason": "no_verdict",
            "message": "The sandbox render produced no parseable verdict — not delivering.",
            "field_map": field_map,
        }))

    # ── 5. Integrity gate — AFTER render (D-08 failure class 2) ──────────────────
    # 101-06 WR-03: the gate must ALSO consult residual_clean. A file that opens cleanly
    # but still contains unsubstituted placeholder markup ({{token}} survivors — a silent
    # non-fill, T-101-02-05) was previously delivered. The VALIDATION contract (SC#4 #1)
    # makes residual-scan == [] the PASS signal. Default residual_clean=True so an OLDER
    # driver verdict missing the key doesn't hard-fail (back-compat); the CURRENT driver
    # always emits it. residual_tags surfaces in the failure payload so the harness
    # bounded-retry loop can re-render rather than ship a half-filled file.
    residual_clean = verdict.get("residual_clean", True)
    if not (verdict.get("rendered") and verdict.get("opened") and residual_clean):
        # A corrupt / non-opening / residual-tainted file is NEVER delivered (SC#4 #3).
        # Preserve the cited field-map as fallback output so the extracted data isn't
        # lost (D-08), and the harness bounded-retry loop re-renders.
        reason = "residual_tokens" if (verdict.get("rendered") and verdict.get("opened")) else "integrity"
        msg = (
            "The rendered file opened but still contains unsubstituted placeholder tokens "
            "(a silent non-fill) and was NOT delivered. The cited field-map is preserved "
            "below as fallback."
            if reason == "residual_tokens"
            else "The rendered file failed the integrity re-open and was NOT delivered. "
                 "The cited field-map is preserved below as fallback."
        )
        return ToolResult(result=_json_local.dumps({
            "status": "failed",
            "reason": reason,
            "message": msg,
            "residual_tags": verdict.get("residual_tags") or [],
            "verdict": verdict,
            "field_map": field_map,
        }))

    if produced is None:
        return ToolResult(result=_json_local.dumps({
            "status": "failed",
            "reason": "harvest_failed",
            "message": "The rendered file passed integrity but could not be harvested.",
            "verdict": verdict,
            "field_map": field_map,
        }))

    # ── 6. Persist + SSE — only when BOTH gates pass ────────────────────────────
    # 101-06 WR-02: workspace_service.validate_path REQUIRES a leading "/". out_filename
    # is a bare basename (e.g. "deliverable.docx"), so a bare path raised
    # PathValidationError → caught → persist_failed → a deliverable that passed BOTH
    # gates was silently dropped (the exact data-loss the gates prevent, on the SUCCESS
    # branch). Normalize to a leading-slash workspace path here. NOTE: the harvest loop
    # above keys on the bare basename `out_filename` (the file in /sandbox/output) — only
    # the WORKSPACE persist path gets the leading slash.
    ws_path = out_filename if out_filename.startswith("/") else "/" + out_filename
    try:
        result = await ws_write_file(
            ctx.pool, ctx.supabase,
            thread_id=UUID(ctx.thread_id),
            user_id=UUID(ctx.current_user["id"]),
            path=ws_path,
            content=produced,
        )
    except WorkspaceError as e:
        return ToolResult(result=_json_local.dumps({
            "status": "failed",
            "reason": "persist_failed",
            "message": str(e),
            "verdict": verdict,
            "field_map": field_map,
        }))

    # VERBATIM reuse of the workspace_file_written event so OutputFileCard renders it
    # (no new UI). Same shared SSE vocabulary for every provider — no per-provider branch.
    await ctx.emit(
        ctx.redis, ctx.run_id, 'workspace_file_written',
        id=result["file_id"],
        path=result["path"],
        version=result["version"],
        size_bytes=result["size_bytes"],
        mime_type=result["mime_type"],
    )

    # Success: carry the verdict (incl. documented_limit — "no silent caps", D-06) +
    # the coverage stats (D-10: citations live in run OUTPUT only; the delivered file
    # stays clean — no citation markup is written into the file itself).
    return ToolResult(result=_json_local.dumps({
        "status": "ok",
        "path": result["path"],
        "version": result["version"],
        "size_bytes": result["size_bytes"],
        "provenance": src["provenance"],
        "engine": engine,
        "verdict": verdict,
        "coverage": stats,
    }))


# ---------------------------------------------------------------------------
# Phase 085 — sub-agent toolset constants (D-085-09)
# ---------------------------------------------------------------------------

# Default sub-agent toolset when the parent agent calls task() without a `tools`
# arg — the read-only KB + workspace surface. NB the intersection with the
# parent's available_tools is what actually gets passed to the sub-agent: this
# frozenset is the upper bound, not the floor.
_SUB_AGENT_DEFAULT_READ_ONLY: frozenset[str] = frozenset({
    "search_documents", "query_documents", "read_document",
    "web_search", "ls", "tree", "grep", "glob",
    "analyze_document", "query_tables",
    "workspace_read", "workspace_list",
})

# Tools the LLM is NEVER allowed to grant to a sub-agent. task() itself is the
# nesting-cap belt; ask_user inside a sub-agent has no UI surface (sub-agents
# don't own a panel slot); write_todos is the parent's UI hook, not the
# sub-agent's. Defense-in-depth: also enforced in run_task_sub_agent's
# sub_ctx.available_tools (which dispatch_tool reads on every call).
_SUB_AGENT_EXCLUDED: frozenset[str] = frozenset({"task", "ask_user", "write_todos"})


async def _handle_task(args: dict, ctx: ToolContext) -> ToolResult:
    """Phase 085 D-085-08..16 — task() spawns a sub-agent.

    Gate sequence (each gate returns a friendly LLM-readable error on refusal):
      1. parent_run_id != None — 1-level nesting cap (D-085-12).
      2. description empty/missing.
      3. requested tools (if any) violate the subset rule or include
         task/ask_user/write_todos (D-085-09).
      4. max_steps non-integer.
      5. per-run concurrency cap saturated (D-085-15, in-process Semaphore).
      6. global concurrency cap saturated (D-085-15, Redis Lua counter).

    On success: spawn run_task_sub_agent, await summary, return
    ToolResult(result=<summary>). Per D-085-13 the LLM sees ONLY the summary
    text — the full sub-agent transcript lives on run:{sub_run_id} for the
    Phase 086 demuxer to surface.

    Concurrency invariant: both slots (per-run + global) are released in a
    finally block. If global acquire fails AFTER per-run was acquired, we
    release per-run before returning the refusal — otherwise a single
    blocked spawn would permanently consume one of the 3 per-run slots.
    """
    # Gate 1: nesting cap (D-085-12) — HARD GATE, runs first to short-circuit
    # before any other work happens.
    if ctx.parent_run_id is not None:
        return ToolResult(
            result="task() unavailable inside a sub-agent — 1-level nesting cap"
        )

    description = (args.get("description") or "").strip()
    if not description:
        return ToolResult(result="task() requires a non-empty description argument")

    instructions = args.get("instructions")
    requested_tools = args.get("tools")
    max_steps_arg = args.get("max_steps")

    # Gate 2: toolset subset validation (D-085-09)
    available = set(ctx.available_tools or [])
    if requested_tools is None:
        # No tools arg — use the default read-only set, intersected with
        # what the parent actually has available (sanitizes case where the
        # parent's toolset is itself restricted, e.g. explorer mode).
        sub_tools = sorted(available & _SUB_AGENT_DEFAULT_READ_ONLY)
    else:
        invalid = [
            t for t in requested_tools
            if t not in available or t in _SUB_AGENT_EXCLUDED
        ]
        if invalid:
            return ToolResult(
                result=(
                    f"task() refused: tools {invalid} not available to sub-agent "
                    "(must be subset of parent's available_tools, excluding "
                    "task/ask_user/write_todos)"
                )
            )
        sub_tools = [t for t in requested_tools if t not in _SUB_AGENT_EXCLUDED]

    if not sub_tools:
        return ToolResult(
            result="task() refused: no usable tools after subset filter"
        )

    # Gate 3: max_steps clamping (D-085-10)
    if max_steps_arg is None:
        max_steps = 5  # default-when-omitted per D-085-10
    else:
        try:
            max_steps = max(1, min(int(max_steps_arg), settings.task_max_steps))
        except (TypeError, ValueError):
            return ToolResult(
                result="task() max_steps must be a positive integer"
            )

    # Gate 4: per-run concurrency cap (D-085-15) — non-blocking try-acquire.
    # asyncio.Semaphore exposes `.locked()` which returns True iff the internal
    # counter has reached zero (no slots free). `locked()` is synchronous and
    # the subsequent `acquire()` won't yield to the event loop when a slot IS
    # available — so the check + acquire pair is atomic within a single
    # coroutine step. asyncio.wait_for(timeout=0) is NOT a viable alternative
    # because it cancels the acquire coroutine before it gets to run at all
    # (verified in Python 3.12). The locked-then-acquire idiom is the
    # canonical non-blocking try-acquire for asyncio.Semaphore.
    sem = ctx.per_run_task_semaphore
    if sem is None:
        return ToolResult(
            result="task() unavailable: per-run semaphore not initialized"
        )
    if sem.locked():
        return ToolResult(result="task() per-run concurrency limit reached")
    # Guaranteed immediate acquire (value > 0); no yield point between
    # locked() and acquire() in single-threaded asyncio.
    await sem.acquire()

    # Gate 5: global concurrency cap (D-085-15)
    # Lazy import to keep the dispatcher module load-cheap and avoid the
    # task_service ↔ tool_dispatcher load-time cycle (task_service imports
    # ToolContext + dispatch_tool from this module).
    from app.services.task_service import (  # noqa: PLC0415
        acquire_global_task_slot,
        release_global_task_slot,
        run_task_sub_agent,
    )

    global_acquired = await acquire_global_task_slot(
        ctx.redis, settings.task_global_concurrency,
    )
    if not global_acquired:
        # Release per-run slot we acquired above — otherwise the LLM's failed
        # task() call would permanently consume one of the 3 per-run slots.
        try:
            sem.release()
        except (ValueError, RuntimeError):
            logger.exception(
                "per-run semaphore release failed on global-cap refusal"
            )
        return ToolResult(
            result=(
                f"task() concurrency limit reached — global cap of "
                f"{settings.task_global_concurrency} active sub-agents"
            )
        )

    # Both slots acquired — spawn the sub-agent. finally block guarantees
    # release of BOTH no matter how the spawn ends (success, exception,
    # cancellation).
    try:
        result = await run_task_sub_agent(
            parent_ctx=ctx,
            description=description,
            instructions=instructions,
            allowed_tools=sub_tools,
            max_steps=max_steps,
        )
    finally:
        try:
            sem.release()
        except (ValueError, RuntimeError):
            logger.exception("per-run semaphore release failed in spawn finally")
        try:
            await release_global_task_slot(ctx.redis)
        except Exception:  # noqa: BLE001
            logger.exception("global task slot release failed in spawn finally")

    # D-085-13 — return only the sub-agent's final summary text to the LLM.
    # Full transcript is reachable via the sub_run_id we emitted on the
    # parent stream (Phase 086 panel will drill into it).
    return ToolResult(result=result.get("summary") or "")


async def _handle_write_todos(args: dict, ctx: ToolContext) -> ToolResult:
    """Phase 085 D-085-17..21 — write_todos handler.

    Full-state-replace of the thread's todo list. Validates payload pre-DB
    (mitigates T-085-T1), calls replace_todos in a single asyncpg transaction
    (mitigates T-085-T4 race), re-SELECTs the canonical list, emits a
    ``todo_updated`` SSE event carrying the FULL list (per D-085-21), and
    returns ``{"accepted": N, "version": <ms>}`` JSON to the LLM.

    Lazy import of replace_todos mirrors the workspace handlers' style.
    """
    todos_in = args.get("todos") or []
    # BUG-260529-01: some models (e.g. free OpenRouter llama-3.3-70b) serialize the
    # nested `todos` arg as a JSON string. Coerce + guard so valid stringified
    # payloads succeed and bad shapes return a self-correcting error (not a crash).
    if isinstance(todos_in, str):
        try:
            todos_in = json.loads(todos_in)
        except (ValueError, TypeError):
            return ToolResult(
                result="write_todos: 'todos' must be a JSON array of objects, not a string"
            )
    if not isinstance(todos_in, list):
        return ToolResult(result="write_todos: 'todos' must be a list of objects")

    # Pre-DB validation — fast-fail with a friendly LLM-readable error before
    # any pool acquire so a malformed payload never trips the transaction.
    for t in todos_in:
        if not isinstance(t, dict):
            return ToolResult(
                result="write_todos: each todo must be an object with id, content, status"
            )
        if not t.get("id") or not t.get("content"):
            return ToolResult(result="write_todos: each todo requires id and content")
        if t.get("status") not in ("pending", "in_progress", "completed"):
            return ToolResult(
                result=f"write_todos: invalid status {t.get('status')!r}; "
                "must be pending|in_progress|completed"
            )

    from app.services.todos_service import replace_todos  # noqa: PLC0415

    try:
        result = await replace_todos(ctx.pool, UUID(ctx.thread_id), todos_in)
    except Exception as e:  # noqa: BLE001
        logger.exception(
            "write_todos: replace_todos failed for thread=%s", ctx.thread_id
        )
        return ToolResult(result=json.dumps({"error": f"write_todos failed: {e}"}))

    # Re-SELECT canonical list for the SSE payload (RESEARCH §C.3 — D-085-21)
    rows = await ctx.pool.fetch(
        "SELECT todo_id AS id, content, status, parent_id, order_index "
        "FROM todos WHERE thread_id = $1 ORDER BY order_index, created_at",
        UUID(ctx.thread_id),
    )
    todos_payload = [dict(r) for r in rows]

    await ctx.emit(
        ctx.redis, ctx.run_id, 'todo_updated',
        todos=todos_payload,
    )

    return ToolResult(result=json.dumps({
        "accepted": result["accepted"],
        "version": result["version"],
    }))


async def _handle_ask_user(args: dict, ctx: ToolContext) -> ToolResult:
    """Phase 085 D-085-01..07 — ask_user pause/resume via Redis pub/sub.

    Blocks the agent loop on a Redis SUBSCRIBE until either the user POSTs a
    response (PUBLISH wakes us), the Stop button is hit (PUBLISH cancel
    sentinel), uvicorn shuts down (PUBLISH shutdown sentinel), or the
    configured timeout fires. Returns a normal ``ToolResult`` so the existing
    agent_runner loop continues — no run-state machinery.

    ORDER IS LOAD-BEARING (RESEARCH §A.3 — PUBLISH-before-SUBSCRIBE race
    mitigation):
      1. pubsub.subscribe(channel)              # SUBSCRIBE first — Redis acks
      2. SADD ask_user:channels:{run_id}        # advertise to cancel/shutdown sweeps
      3. messages row insert (kind='ask_user_prompt')   # durable for reload (D-085-05)
      4. emit ask_user_prompt SSE event         # frontend now knows to ask the user
      5. block on get_message                   # NOW we can safely wait

    Steps 1-2 register the subscriber BEFORE the user has any way to know there
    is a question pending. A fast user response can't PUBLISH before step 4,
    by which point the subscription is already alive.

    This handler does NOT use ``ask_user_service.subscribe_for_response`` for
    the full flow because the SSE emit + messages row insert must happen
    BETWEEN the SADD and the block-on-message — see the ordering invariant
    above. ``ask_user_service`` exports the helper for tests and for the
    cancel + shutdown paths that don't need the persistence step.

    Wake payload kinds (RESEARCH §A wire format):
      - {"kind": "response", "response_text": str, "choice_index": int|null}
      - {"kind": "cancel"}    — Stop button or zombie heal
      - {"kind": "shutdown"}  — uvicorn lifespan shutdown

    Empty prompt is a tool error (RESEARCH §A.8 discretion resolution — less
    surprising than rendering "(no prompt)" in the panel).
    """
    prompt = (args.get("prompt") or "").strip()
    if not prompt:
        return ToolResult(result="ask_user requires a non-empty prompt")

    # Per-call timeout override; server clamps to settings.ask_user_max_timeout_seconds
    # (default 1800s = 30min). Default when omitted is 300s (D-085-03).
    timeout_arg = args.get("timeout_seconds")
    if timeout_arg is None:
        timeout_seconds = 300
    else:
        try:
            timeout_seconds = max(
                1, min(int(timeout_arg), settings.ask_user_max_timeout_seconds)
            )
        except (TypeError, ValueError):
            return ToolResult(
                result="ask_user timeout_seconds must be a positive integer"
            )

    options = args.get("options")

    # tool_call_id is the LLM-supplied id for the current tool call; populated
    # per-dispatch by agent_runner. Without it, we can't name the channel.
    tool_call_id = ctx.tool_call_id or ""
    if not tool_call_id:
        return ToolResult(
            result=(
                "ask_user requires a tool_call_id (internal: "
                "ToolContext.tool_call_id was empty)"
            )
        )

    run_id = ctx.run_id
    channel = f"ask_user:{run_id}:{tool_call_id}"
    channels_set_key = f"ask_user:channels:{run_id}"

    pubsub = ctx.redis.pubsub()

    try:
        # ── Step 1: SUBSCRIBE first ───────────────────────────────────────
        await pubsub.subscribe(channel)
        # ── Step 2: advertise to cancel + shutdown sweep paths ────────────
        await ctx.redis.sadd(channels_set_key, channel)
        await ctx.redis.expire(channels_set_key, 3600)  # safety TTL

        # ── Step 3: persist messages row with kind='ask_user_prompt' ──────
        # D-085-05 — durable for reload survival (RESEARCH §A.7). Wrapped in
        # try/except: if the insert fails (Postgres hiccup, etc.) we still
        # let the handler proceed so the user can answer — the missing row
        # only affects the GET /pending replay surface, not the live flow.
        try:
            await aexec(
                ctx.supabase.table("messages").insert({
                    "thread_id": ctx.thread_id,
                    "user_id": ctx.current_user["id"],
                    "role": "system",
                    "content": prompt,
                    "tool_calls": [{
                        "kind": "ask_user_prompt",
                        "tool_call_id": tool_call_id,
                        "prompt": prompt,
                        "options": options,
                        "timeout_seconds": timeout_seconds,
                        "run_id": str(run_id),
                    }],
                })
            )
        except Exception:  # noqa: BLE001
            logger.exception(
                "ask_user: messages row insert failed for run %s tcid %s",
                run_id, tool_call_id,
            )

        # ── Step 4: emit ask_user_prompt SSE event ────────────────────────
        try:
            await ctx.emit(
                ctx.redis, run_id, 'ask_user_prompt',
                tool_call_id=tool_call_id,
                prompt=prompt,
                options=options,
                timeout_seconds=timeout_seconds,
            )
        except Exception:  # noqa: BLE001
            logger.exception(
                "ask_user: SSE emit failed for run %s tcid %s",
                run_id, tool_call_id,
            )

        # ── Step 5: block on get_message ──────────────────────────────────
        async def _wait():
            while True:
                msg = await pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0,                      # Pitfall 1 — never 0
                )
                if msg is not None and msg.get("type") == "message":
                    try:
                        return json.loads(msg["data"])
                    except (TypeError, ValueError):
                        logger.warning(
                            "ask_user: unparseable PUBLISH payload on %s", channel
                        )
                        return None

        try:
            payload = await asyncio.wait_for(_wait(), timeout=timeout_seconds)
        except asyncio.TimeoutError:
            return ToolResult(
                result=f"ask_user timed out — no response received within {timeout_seconds}s"
            )

        if not payload:
            return ToolResult(
                result="ask_user received unparseable payload — treating as timeout"
            )

        kind = payload.get("kind")
        if kind == "response":
            # BUG-260607-01: a choice-click answer arrives as
            # {response_text: "", choice_index: N} — resolving the chosen
            # option text here is the authoritative defense (the frontend
            # also sends the resolved text now, but the server must never
            # hand the model an empty answer when the user actually chose).
            _resp = (payload.get("response_text") or "").strip()
            if not _resp and isinstance(options, list):
                _ci = payload.get("choice_index")
                try:
                    _ci = int(_ci)
                    if 0 <= _ci < len(options):
                        _resp = str(options[_ci])
                except (TypeError, ValueError):
                    pass
            return ToolResult(result=_resp)
        elif kind == "cancel":
            return ToolResult(result="ask_user cancelled by user stop")
        elif kind == "shutdown":
            return ToolResult(result="ask_user interrupted by server shutdown")
        else:
            return ToolResult(
                result=f"ask_user received unknown payload kind: {kind!r}"
            )
    finally:
        # Cleanup discipline — Pitfall 3 + R2 (Redis SUBSCRIBE client leaks).
        # Each step in its own try/except so a single failure doesn't mask
        # the others. SREM keeps the channels:set honest (only LIVE
        # subscribers should be there); the safety TTL above is the
        # eventual-consistency safety net.
        try:
            await pubsub.unsubscribe(channel)
        except Exception:  # noqa: BLE001
            logger.exception(
                "ask_user: unsubscribe failed for %s", channel
            )
        try:
            await asyncio.wait_for(pubsub.aclose(), timeout=2.0)
        except Exception:  # noqa: BLE001
            logger.exception(
                "ask_user: pubsub.aclose failed for %s", channel
            )
        try:
            await ctx.redis.srem(channels_set_key, channel)
        except Exception:  # noqa: BLE001
            logger.exception(
                "ask_user: SREM failed for %s", channels_set_key
            )


# ---------------------------------------------------------------------------
# Registry + dispatch entry point
# ---------------------------------------------------------------------------

_TOOL_REGISTRY: dict[str, Callable] = {
    "ls": _handle_ls,
    "tree": _handle_tree,
    "grep": _handle_grep,
    "glob": _handle_glob,
    "read_document": _handle_read_document,
    "search_documents": _handle_search_documents,
    "query_documents": _handle_query_documents,
    "web_search": _handle_web_search,
    "analyze_document": _handle_analyze_document,
    "load_skill": _handle_load_skill,
    "save_skill": _handle_save_skill,
    "read_skill_file": _handle_read_skill_file,
    "execute_code": _handle_execute_code,
    "remember": _handle_remember,
    "recall": _handle_recall,
    "query_tables": _handle_query_tables,
    # Phase 084: Workspace tools
    "workspace_write": _handle_workspace_write,
    "workspace_read": _handle_workspace_read,
    "workspace_list": _handle_workspace_list,
    "workspace_delete": _handle_workspace_delete,
    "workspace_diff": _handle_workspace_diff,
    # Phase 085 — D-085 new tools (write_todos = Plan 01; task = Plan 02; ask_user = Plan 03)
    "write_todos": _handle_write_todos,
    "task": _handle_task,
    "ask_user": _handle_ask_user,
    # Phase 101 (TMPL-02 / TMPL-03) — template fill (G-5: handler + one line; threads.py untouched)
    "render_template": _handle_render_template,
    # Phase 115 (VIEW-07) — registry + get_tools BOTH (the inverse of render_template); threads.py untouched (G-5)
    "query_documents_by_view": _handle_query_documents_by_view,
    # Phase 116 (REL-04) — registry + get_tools BOTH (SC#1 dual-wiring); G-5: handler + one line, threads.py untouched
    "get_related_documents": _handle_get_related_documents,
}


def _spawn_tool_refused_audit(ctx: ToolContext, tool_name: str, allowed: list[str]) -> None:
    """D-06: fire-and-forget a harness_audit ``tool_refused`` row on a whitelist refusal.

    Mirrors the existing handler audit pattern (``ctx.spawn(<coro>)``). NEVER blocks
    dispatch on the write: a missing pool/run_id, an unset spawn hook, or a failing
    spawn must not turn a clean refusal into an exception (the refusal is the point).
    Only reached when ``ctx.phase_whitelist is not None`` (a workflow is active), so
    in pure Deep-Mode calls this is never invoked.

    096 review WR-03: prefer ``ctx.workflow_run_id`` (the workflow_runs.id) so the
    refusal row lands in the SAME run namespace as every other harness_audit row —
    ``parent_run_id``/``run_id`` are producer ``runs`` ids on the harness path, and
    a row keyed there is invisible to per-workflow-run audit readers.
    """
    # getattr: ctx may be a duck-typed stub predating the 096 workflow_run_id field —
    # per this function's contract, a missing attribute must never break a clean refusal.
    run_id = getattr(ctx, "workflow_run_id", None) or ctx.parent_run_id or ctx.run_id
    if ctx.pool is None or run_id is None:
        return  # no harness substrate on this ctx — nothing to audit against
    # Phase 092-05 F1: harness_audit.user_id is NOT NULL — bind the run-owner
    # (the dispatching user). asyncpg coerces the str id to uuid on the bind.
    _owner_id = (ctx.current_user or {}).get("id") if ctx.current_user else None
    try:
        from app.db.workflows import write_audit  # local import: avoid load-time cycle
        ctx.spawn(write_audit(
            ctx.pool, run_id, user_id=_owner_id,
            event_type="tool_refused", metadata={"tool": tool_name, "allowed": allowed},
        ))
    except Exception:  # noqa: BLE001 — audit is best-effort; never block the refusal
        logger.exception("tool_refused audit spawn failed for tool=%s", tool_name)


# ---------------------------------------------------------------------------
# Phase 147 (FLAG-01 / D-04 layer 2 — fail-closed capability REFUSE)
# ---------------------------------------------------------------------------
# The fail-closed sibling of the 091 whitelist no-op below. When an operator flips a
# capability kill-switch OFF, an in-flight call to that capability tool gets a plain
# ToolResult refusal the agent can relay and work around. It is:
#   * provider-agnostic — a plain ``ToolResult.result`` string; the agent loop attaches
#     the matching tool_call_id itself, so NO ``provider ==`` branch is ever touched
#     (T-147-14 / the red line: the shared path never forks under a flag), and the
#     refusal is IDENTICAL for OpenAI / Anthropic / Google / OpenRouter.
#   * a literal no-op when every gated flag is ON/absent — skipped exactly like the
#     ``phase_whitelist is None`` Deep-Mode branch, so Deep dispatch is byte-identical.
#   * defense-in-depth with the get_tools HIDE layer: a disabled tool is BOTH omitted
#     from the schema AND refused here if a model calls it anyway (D-04).
_CAPABILITY_FLAG_TOOLS: dict[str, tuple[str, str]] = {
    # tool_name -> (app_settings flag attribute, human label for the plain refusal copy)
    "web_search": ("web_search_enabled", "Web search"),
    "execute_code": ("sandbox_enabled", "Code execution"),
    "save_skill": ("self_improve_enabled", "Self-improvement (skill saving)"),
}


def _capability_disabled_message(tool_name: str) -> "str | None":
    """Return a plain admin refusal message if ``tool_name`` is a capability tool whose
    operator kill-switch is currently OFF, else ``None``.

    ``None`` for any non-gated tool (the common case, a fast dict-miss) AND for a gated
    tool whose flag is ON/absent → the caller's branch is skipped and dispatch proceeds
    byte-identically. Fail-closed toward last-known-good: a ``load_app_settings()``
    exception (cold cache / DB blip) returns ``None`` (treat as ON) so a transient blip
    NEVER silently disables a capability (D-Q4 default-ON polarity / T-147-02). The
    settings read itself already returns the STALE cache on a DB failure — this except is
    the belt-and-braces second line."""
    gate = _CAPABILITY_FLAG_TOOLS.get(tool_name)
    if gate is None:
        return None  # not a gated capability tool → fast no-op (the overwhelming common case)
    flag_attr, label = gate
    try:
        flag_on = getattr(load_app_settings(), flag_attr)
    except Exception:  # noqa: BLE001 — defensive: cold cache / read blip → treat as ON (D-Q4)
        return None
    if flag_on:
        return None  # capability ON/absent → literal no-op (Deep byte-identical)
    return f"{label} is currently disabled by the administrator"


async def dispatch_tool(tool_name: str, args: dict, ctx: ToolContext) -> ToolResult:
    """Route a tool call to its handler. Unknown tools return an error string."""
    # Phase 091 HARNESS-05 (D-05 layer 2 — hard backstop for hallucinated names).
    # phase_whitelist is None in Deep Mode → this branch is skipped → byte-identical
    # to pre-091 dispatch. The refusal is a normal ToolResult.result string (the most
    # provider-agnostic surface); the agent loop attaches the matching tool_call_id
    # itself, so NO provider branch is ever touched (Pitfall 3/4).
    if ctx.phase_whitelist is not None and tool_name not in ctx.phase_whitelist:
        allowed = sorted(ctx.phase_whitelist)
        _spawn_tool_refused_audit(ctx, tool_name, allowed)  # D-06 (fire-and-forget)
        return ToolResult(result=json.dumps({
            "error": "tool_not_available_in_phase",
            "tool": tool_name,
            "message": (
                f"Tool `{tool_name}` is not available in this phase. "
                f"Available tools here: {allowed}"
            ),
            "allowed": allowed,
        }))
    # Phase 147 FLAG-01 (D-04 layer 2 REFUSE) — a disabled capability tool called
    # in-flight gets a plain refusal ToolResult the agent can relay. Literal no-op when
    # the flag is ON/absent (Deep byte-identical); provider-agnostic (no provider branch).
    _disabled_msg = _capability_disabled_message(tool_name)
    if _disabled_msg is not None:
        return ToolResult(result=json.dumps({
            "error": "capability_disabled",
            "tool": tool_name,
            "message": _disabled_msg,
        }))
    handler = _TOOL_REGISTRY.get(tool_name)
    if handler is None:
        return ToolResult(result=f"Unknown tool: {tool_name}")
    return await handler(args, ctx)

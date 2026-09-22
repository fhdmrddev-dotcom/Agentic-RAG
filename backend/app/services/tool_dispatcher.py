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
import shlex
import time as time_mod
import weakref
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Callable, Awaitable
from uuid import UUID

# Phase 224 Plan 02 (BUG-260902-04 / D-224-01):
# Single authority for the connector tool approval timeout.
# Consumed by both the asyncio.wait_for pause and the wire deadline/duration emit.
_APPROVAL_TIMEOUT_SECONDS: float = 120.0

from starlette.concurrency import run_in_threadpool

from app.utils.db import aexec
from app.api.kb import ls_path, tree_path, grep_path, glob_path, read_path
# Phase 151 (FILE-02) — owner→global doc-scope fallback (mirrors read_path). Module-level
# (patch-where-used friendly) and cycle-safe: folder_utils imports only dependencies/db,
# never tool_dispatcher.
# SEED-125 (CR-01) — the same fail-closed caller-org resolver the SEED-124 folder fix uses,
# reused here to org-gate service-role skill resolution (see _resolve_skill_visibility_or).
from app.utils.folder_utils import get_globally_visible_folder_ids, _resolve_caller_org_ids
# SEED-125 (CR-01) / Phase 182 (CR-01) — the ONE org-gated skill-visibility predicate, hoisted
# to a shared import-light home so the grounding/canvas seam reuses it instead of copying it.
from app.utils.skill_visibility import build_skill_visibility_or
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
    # Phase 151 (FILE-01) — attach_skill_file source #1 (workspace) bytes reader +
    # filename mime guess. get_file_by_path is a workspace_service re-export of the
    # db.workspace fetch (cycle-safe at module level; patch-where-used friendly for tests).
    _get_file_content,
    get_file_by_path,
    guess_mime_type,
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
    # Phase 234 TRUST-03: Run-scoped tracking flag indicating external connection-sourced
    # knowledge was retrieved in this run's context (disarms write tools without explicit confirmation).
    has_connection_retrieval: bool = False
    # Phase 264 (264-01 / PACK-17 / D-264-03) — ADDITIVE default-off born-for scope id.
    # None on EVERY Deep-mode / harness / eval / normal caller => the skill-visibility
    # predicate this dispatcher builds is byte-identical to base. A UUID (set ONLY by
    # the two agent_loop ToolContext builds, off a RunContext whose value came from
    # `_resolve_thread_scoping`'s ACCESS-CHECKED `ResolvedExpertBundle.bundle_id`, plus
    # the task_service sub_ctx propagation) => the run has a consultant active and the
    # load path may additionally admit the skills born for it (mig 191's
    # `skills.born_for_expert_bundle_id`). Same additive-default-off discipline as
    # phase_whitelist / workflow_run_id / skill_snapshot / skill_instructions_override
    # above. ⛔ NOTHING reads this in 264-01 — the consumer lands in 264-03.
    born_for_bundle_id: UUID | None = None


@dataclass
class ToolResult:
    """Structured return from a tool handler."""
    result: str  # The tool_result string for persistence + LLM context
    llm_content: str | None = None  # If set, sent to LLM instead of result
    source_refs: list[dict] = field(default_factory=list)  # New source references
    citations: list[dict] = field(default_factory=list)  # New citation objects
    similarity_score: float | None = None  # Avg similarity to accumulate
    sub_agent_record: dict | None = None  # Sub-agent metadata (analyze_document)
    retrieval_error: dict | None = None  # Phase 210 (RAG-09) provider outage details


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


# ---------------------------------------------------------------------------
# Phase 151 (FILE-01) — attach_skill_file: save a file onto an OWNED skill from
# one of four sources (workspace / sandbox_output / inline / kb_document, D-05)
# ---------------------------------------------------------------------------
# Inline (source #3) size bound — the weak-model guard. Inline is for small text/config/
# scripts; a model that mangles a large/binary file into a huge `content` string is
# refused here (use the workspace or sandbox_output source for real files). 5 MB is
# generous for text while capping accidental context blow-ups.
_ATTACH_INLINE_MAX_BYTES = 5 * 1024 * 1024


async def _resolve_attach_source_bytes(
    args: dict, ctx: ToolContext, source: str, filename: str
) -> "tuple[bytes, str] | dict":
    """Resolve ``(file_bytes, mime_type)`` from one of the four D-05 sources.

    Returns EITHER ``(bytes, mime)`` on success OR ``{"error": ...}`` (the shared
    honest-failure convention — the caller relays it as a ToolResult error). Every
    blocking Storage/DB/container call is threadpool-wrapped (Pitfall 1).
    """
    import os as _os_local
    import tempfile as _tempfile_local

    # ── #1 workspace: a thread workspace file, read via the shared inline-vs-Storage
    #    reader (`_get_file_content`, already threadpool-safe). ──
    if source == "workspace":
        wpath = (args.get("workspace_path") or "").strip()
        if not wpath:
            return {"error": "source='workspace' requires 'workspace_path'."}
        try:
            file_row = await get_file_by_path(ctx.pool, UUID(ctx.thread_id), wpath)
        except Exception:  # noqa: BLE001 — a bad path/uuid is an honest not-found, never a 500
            file_row = None
        if not file_row:
            return {"error": f"No workspace file at '{wpath}'."}
        try:
            file_bytes = await _get_file_content(ctx.pool, ctx.supabase, file_row)
        except Exception as exc:  # noqa: BLE001
            return {"error": f"Could not read workspace file '{wpath}': {exc}"}
        mime = file_row.get("mime_type") or guess_mime_type(filename)
        return (file_bytes, mime)

    # ── #2 sandbox_output: harvest a named file the agent produced in /sandbox/output,
    #    reusing the harvest idiom (copy the dir out, walk, match basename). ──
    if source == "sandbox_output":
        spath = (args.get("sandbox_path") or "").strip()
        if not spath:
            return {"error": "source='sandbox_output' requires 'sandbox_path'."}
        want = _os_local.path.basename(spath) or spath

        def _harvest() -> "bytes | None":
            session = sandbox_manager.get_or_create(ctx.thread_id)
            try:
                session.execute_command("mkdir -p /sandbox/output")
            except Exception:
                pass  # best-effort; copy_from_runtime 404s if it truly doesn't exist
            with _tempfile_local.TemporaryDirectory() as tmpdir:
                # No trailing slash — Docker's get_archive is strict (sandbox_service.py:264).
                session.copy_from_runtime("/sandbox/output", tmpdir)
                for root, _dirs, files in _os_local.walk(tmpdir):
                    for fn in files:
                        if fn == want:
                            with open(_os_local.path.join(root, fn), "rb") as f:
                                return f.read()
            return None

        try:
            data = await run_in_threadpool(_harvest)
        except Exception as exc:  # noqa: BLE001
            return {"error": f"Could not read sandbox output '{spath}': {exc}"}
        if data is None:
            return {"error": f"No sandbox output file named '{want}' in /sandbox/output."}
        # WR-02 — cap the harvested bytes BEFORE the Storage upload. sandbox_output is the
        # largest, least-trustworthy source (agent-generated bytes) and was the ONLY source
        # with no ceiling; a model can trivially write a huge artifact to /sandbox/output and
        # attach it uncapped (read into backend RAM, then uploaded with no limit). Enforce the
        # shared 5 MB attach ceiling (_ATTACH_INLINE_MAX_BYTES — no new magic number); refuse
        # over-cap with an honest error, no partial upload.
        if len(data) > _ATTACH_INLINE_MAX_BYTES:
            return {"error": (
                f"Sandbox file '{want}' is {len(data) // 1024 // 1024} MB, over the "
                f"{_ATTACH_INLINE_MAX_BYTES // 1024 // 1024} MB attach limit."
            )}
        return (data, guess_mime_type(filename))

    # ── #3 inline: content passed directly as a tool arg (utf-8 text). Weak-model
    #    guards: a non-str / empty / oversized `content` is an honest error, never a
    #    silent empty or context-blowing write. ──
    if source == "inline":
        content = args.get("content")
        if not isinstance(content, str) or content == "":
            return {"error": "source='inline' requires non-empty 'content'."}
        file_bytes = content.encode("utf-8")
        if len(file_bytes) > _ATTACH_INLINE_MAX_BYTES:
            return {"error": (
                f"Inline content is {len(file_bytes) // 1024} KB, over the "
                f"{_ATTACH_INLINE_MAX_BYTES // 1024 // 1024} MB inline limit — attach a "
                "large file via the 'workspace' or 'sandbox_output' source instead."
            )}
        return (file_bytes, guess_mime_type(filename))

    # ── #4 kb_document: REUSE FILE-02's owner-scope resolver (T-03). The doc→skill
    #    data-movement path is owner-scoped on BOTH ends — the resolver's owner→global
    #    gate here, the owner-only skill gate in the caller. Its {"error"} propagates. ──
    if source == "kb_document":
        document_id = (args.get("document_id") or "").strip()
        if not document_id:
            return {"error": "source='kb_document' requires 'document_id'."}
        resolved = await _fetch_owned_document_bytes(ctx, document_id)
        if isinstance(resolved, dict):  # owner-scope refusal (T-03) → propagate honestly
            return resolved
        _fname, doc_bytes, mime = resolved
        return (doc_bytes, mime)

    return {"error": (
        f"Unknown source '{source}'. Use one of: workspace, sandbox_output, inline, "
        "kb_document."
    )}


async def _handle_attach_skill_file(args: dict, ctx: ToolContext) -> ToolResult:
    """FILE-01 — attach a file onto a skill the caller OWNS, from four sources (D-05).

    G-5: handler + one ``_TOOL_REGISTRY`` line + one ``get_tools()`` schema; threads.py
    untouched, no ``provider ==`` fork. self_improve-gated (D-11) in ``get_tools()`` AND
    refused in-flight via ``_CAPABILITY_FLAG_TOOLS``. Owner-only WRITE gate (D-06/T-04):
    the target skill is resolved by name under ``.eq("user_id")`` — NEVER the
    ``.or_(is_org_shared.eq.true)`` READ filter — and ``is_system`` skills are also rejected;
    service-role has no RLS backstop so this app gate is load-bearing. A colliding filename
    overwrites in place via a race-immune upsert (D-07, Plan 02 unique index). Reuses the
    existing ``skill_files`` table + ``skill-files`` bucket (D-08) — no new table/bucket.
    """
    import os as _os_local
    import re as _re_local

    uid = ctx.current_user["id"]
    target_skill_name = (args.get("target_skill_name") or "").strip()
    filename_raw = (args.get("filename") or "").strip()
    source = (args.get("source") or "").strip()

    if not target_skill_name:
        return ToolResult(result=json.dumps({"error": "target_skill_name is required."}))
    if not filename_raw:
        return ToolResult(result=json.dumps({"error": "filename is required."}))

    # T-02 / Pitfall 4 — sanitize the MODEL-supplied filename to a safe basename so it can
    # never carry a "../" traversal segment out of the owner-prefixed Storage path. For a
    # normal filename this is a no-op (basename + charset scrub, matching FILE-02's stem).
    stem = _os_local.path.basename(filename_raw)
    filename = _re_local.sub(r"[^a-zA-Z0-9._\- ]", "_", stem)
    filename = _re_local.sub(r"\.{2,}", ".", filename).strip() or "attachment"

    # ── D-06 / T-04 / SC#4 — resolve the target skill OWNER-ONLY. Empty .data (not owned
    #    / not found) OR is_system → refuse. NEVER the .or_(is_org_shared.eq.true) READ filter.
    #    WR-04: the gate intentionally does NOT reject is_org_shared — an org-shared skill the
    #    caller OWNS is writable BY DESIGN (T-03: attach-to-owned-skill then owner later toggles it
    #    global is a documented, owner-driven data-movement path, not blocked). The refusal
    #    copy below is therefore scoped to built-in (is_system) skills only, so it never
    #    overstates the enforcement (auditors: owner-scope on user_id is the load-bearing gate). ──
    try:
        skill_res = await aexec(
            ctx.supabase.table("skills").select("id, is_system")
            .eq("name", target_skill_name).eq("user_id", uid).maybe_single()
        )
        skill_row = skill_res.data if skill_res else None
    except Exception:  # noqa: BLE001 — WR-01: honest refusal on a bad-arg/transient DB failure, no raw DB text leak
        skill_row = None
    if not skill_row or skill_row.get("is_system"):
        return ToolResult(result=json.dumps({"error": (
            f"No skill named '{target_skill_name}' that you own — you can only attach "
            "files to a skill you own (built-in skills are never writable)."
        )}))
    skill_id = skill_row["id"]

    # ── Resolve file_bytes + mime by the source discriminator (D-05) ──
    resolved = await _resolve_attach_source_bytes(args, ctx, source, filename)
    if isinstance(resolved, dict):  # honest-failure convention (weak-model guard / T-03)
        return ToolResult(result=json.dumps(resolved))
    file_bytes, mime = resolved

    # ── T-02 — owner-prefixed Storage path. skill_id from the RESOLVED owned skill, uid
    #    from ctx, filename sanitized above — no segment is ever a raw model arg. ──
    storage_path = f"{uid}/{skill_id}/{filename}"

    # ── D-07 pre-check drives the created/updated REPORT only (informational). Write
    #    correctness is the race-immune upsert below (Plan 02 unique index), so even if two
    #    concurrent same-name attaches both read "not present" the DB still collapses to one
    #    row — the report may say "created" twice but the state stays consistent. ──
    exist_res = await aexec(
        ctx.supabase.table("skill_files").select("id")
        .eq("skill_id", skill_id).eq("filename", filename).maybe_single()
    )
    pre_existed = bool(exist_res and exist_res.data)

    # ── D-07 overwrite-in-place — Storage upsert (Pitfall 2: bare .upload() 409s on a
    #    colliding path) + race-immune DB upsert on the (skill_id, filename) unique index.
    #    Both blocking calls are off-loop (Pitfall 1). ──
    uploaded = False
    try:
        await run_in_threadpool(lambda: ctx.supabase.storage.from_("skill-files").upload(
            path=storage_path, file=file_bytes,
            file_options={"content-type": mime, "upsert": "true"},
        ))
        uploaded = True
        await aexec(ctx.supabase.table("skill_files").upsert(
            {
                "skill_id": skill_id, "user_id": uid, "filename": filename,
                "file_path": storage_path, "file_size": len(file_bytes), "mime_type": mime,
            },
            on_conflict="skill_id,filename",
        ))
    except Exception as exc:  # noqa: BLE001 — honest tool-result error, never raise into the loop
        logger.exception(
            "attach_skill_file write failed (skill=%s file=%s)", skill_id, filename
        )
        # IN-01 — the object may already be committed to the bucket while the skill_files
        # upsert failed (e.g. migration 101's unique index not yet applied → ON CONFLICT
        # error 42P10, or any transient DB blip). Best-effort remove the just-uploaded object
        # so a failed attach does not accrete an untracked orphan (the tool hard-depends on
        # migration 101; until it lands on cloud every attach would otherwise leave one behind).
        if uploaded:
            try:
                await run_in_threadpool(
                    lambda: ctx.supabase.storage.from_("skill-files").remove([storage_path])
                )
            except Exception:  # noqa: BLE001 — cleanup is best-effort; never mask the original error
                logger.warning(
                    "attach_skill_file: could not remove orphaned object %s", storage_path
                )
        return ToolResult(result=json.dumps({
            "error": f"Failed to attach the file to the skill: {exc}"
        }))

    status = "updated" if pre_existed else "created"

    # Optional additive SSE — provider-uniform (no provider== fork), best-effort no-op when
    # the run/emit substrate is absent (mirrors workspace_file_written).
    try:
        if getattr(ctx, "emit", None) and getattr(ctx, "run_id", None):
            await ctx.emit(
                ctx.redis, ctx.run_id, "skill_file_attached",
                skill=target_skill_name, filename=filename, status=status,
            )
    except Exception:  # noqa: BLE001 — an emit failure must never break a clean attach
        logger.exception("skill_file_attached emit failed for run %s", getattr(ctx, "run_id", None))

    return ToolResult(result=json.dumps({
        "status": status, "filename": filename, "skill": target_skill_name,
    }))


async def _handle_search_documents(args: dict, ctx: ToolContext) -> ToolResult:
    metadata_filter = args.get("metadata_filter") or None
    try:
        results, avg_sim = await search_documents(
            args["query"], ctx.current_user["id"], ctx.supabase,
            metadata_filter=metadata_filter,
            user_settings=ctx.user_settings,
            folder_ids=ctx.folder_subtree_ids,
        )
    except Exception as exc:  # noqa: BLE001 — honest tool-result error, never raise into the loop
        # BUG-260815-05 — A SEARCH THAT COULD NOT RUN MUST NOT READ AS A SEARCH THAT
        # FOUND NOTHING. Measured 2026-08-15: the OpenAI balance hit zero, every
        # `search_documents` raised `RateLimitError insufficient_quota` from the QUERY
        # embedding (`retrieval_service._vector_search:73` -> `openai_service.embed_texts`),
        # and the operator was told, three golden runs in a row and by the only surface
        # they had, *"citations_required: nothing was retrieved (0 sources) — this step
        # reads your documents and must show where its answer came from"*. That sentence
        # sent them to re-check their documents, their folder and their prompt, all of
        # which were correct: 5 docs, 18 chunks, 0 null embeddings, matching org_id.
        #
        # ⚠ EVERY document in this product is embedded with an OpenAI model, so EVERY
        # search must embed its query at retrieval time. Embedding is the one path with
        # no provider fallback (chat routes across seven providers; embedding does not).
        # A zero balance therefore silently zeroes retrieval for the WHOLE knowledge
        # base — the blast radius is not one workflow.
        #
        # ⚠ THIS IS THE `resolve_template_placeholders` SHAPE (Phase 193.1, D-26), NOT a
        # new invention: *could not read* and *nothing to read* must never share a
        # message. The value here is the honest third state.
        #
        # ⚠ The exception is CONVERTED, never re-raised. `agent_loop`'s generic
        # `except Exception -> "Tool error: ..."` (`agent_loop.py:2598`) already caught
        # it, but that string is addressed to the MODEL; it is not a retrieval verdict
        # and it does not reach the phase record the author reads. Returning an explicit
        # unavailable result puts the reason where a person will meet it.
        logger.error("search_documents failed for run %s: %s", getattr(ctx, "run_id", None), exc)
        from app.services.openai_service import resolve_effective_embedding_provider
        provider = resolve_effective_embedding_provider(getattr(ctx, "user_settings", None))
        # BE-4 (217.1 / LIB-06 / D-217.1-34): a provider outage must be VISIBLE in the
        # analytics. Without this write, a failed search is indistinguishable from "your
        # library had no answer" — every `search.query` reader would count it (or not)
        # exactly like a real search that found nothing. The row carries `document_ids: []`
        # and the classified `retrieval_status: "provider_error"` literal — NEVER `str(exc)`,
        # which stays in the ToolResult.retrieval_error response object (T-217.1-15b).
        # THE WRITE IS FIRE-AND-FORGET DIAGNOSTICS AND MUST NOT BE ABLE TO KILL THE
        # HONEST RESULT BELOW - which is exactly what it did. 217.1-11 added this call
        # and the four Phase 210 tests that guard RAG-09 went RED with
        # "'ToolContext' object has no attribute 'spawn'", raised from INSIDE the
        # except arm: the AttributeError propagated past the `return`, so a provider
        # outage stopped producing `retrieval_unavailable` at all and raised into the
        # agent loop instead - the precise outcome the test named
        # `..._does_not_raise_into_the_agent_loop` exists to forbid.
        #
        # The ordering is the fix: an analytics row is worth having, and it is worth
        # strictly less than the sentence that tells a person their library could not be
        # searched. So the failure is logged and swallowed HERE, and nowhere else.
        try:
            ctx.spawn(write_audit_entry(
                user_id=ctx.current_user["id"],
                action_type="search.query",
                metadata={
                    "query_text": args["query"],
                    "document_ids": [],
                    "retrieval_status": "provider_error",
                },
                supabase=ctx.supabase,
            ))
        except Exception:  # noqa: BLE001 - diagnostics may never mask the outage
            logger.warning(
                "search_documents: the provider-error audit row could not be scheduled; "
                "the retrieval failure itself is still reported", exc_info=True,
            )
        return ToolResult(
            result=json.dumps({
                "error": "retrieval_unavailable",
                "provider": provider,
                "detail": (
                    f"The document search could not run — the search provider ({provider}) returned: {exc}. "
                    "This is NOT a result of zero matches: your documents were never queried. "
                    "Say plainly that document search is unavailable; do not state or imply "
                    "that the knowledge base contains no relevant information."
                ),
            }),
            citations=[],
            source_refs=[],
            retrieval_error={
                "provider": provider,
                "detail": str(exc),
                "retrieval_status": "provider_error",
            },
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
                    # Phase 231 TRUST-04 — a reader can tell machine-placed knowledge from
                    # knowledge somebody chose to upload. Both keys travel: the name is what
                    # gets rendered, the id is what survives a rename.
                    "source_connection_id": hit.get("source_connection_id"),
                    "source_connection_name": hit.get("source_connection_name"),
                })
        if avg_sim > 0.0:
            similarity_score = avg_sim

    # Phase 234 TRUST-03: Track if any returned citation came from an external connection
    if any(bool(c.get("source_connection_id")) for c in citations):
        try:
            ctx.has_connection_retrieval = True
        except Exception:
            pass

    # Audit: fire-and-forget inside async generator (AUDIT-02)
    _audit_doc_ids = list({
        h.get("document_id") or h.get("id")
        for h in (results or [])
        if h.get("document_id") or h.get("id")
    })
    # BE-5 (217.1 / LIB-07): persist the per-hit similarity the retrieval ALREADY returns
    # (retrieval_service.py:173 — it was being thrown away before reaching audit_log.metadata,
    # so `Average relevance` could only lie about a value the system has). Max similarity per
    # document (a document can contribute several chunks), rounded to 3 dp — matching
    # _fetch_low_confidence_queries' existing convention (knowledge_health.py:302).
    _sims: dict[str, float] = {}
    for h in (results or []):
        _did = h.get("document_id") or h.get("id")
        _s = h.get("similarity")
        if _did and isinstance(_s, (int, float)):
            _sims[_did] = max(_sims.get(_did, 0.0), round(float(_s), 3))
    ctx.spawn(write_audit_entry(
        user_id=ctx.current_user["id"],
        action_type="search.query",
        metadata={
            "query_text": args["query"],
            "document_ids": _audit_doc_ids,
            "similarities": _sims,
        },
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
    if await _doc_out_of_scope(ctx, str(doc_id)):
        return ToolResult(result=f"Document '{args['filename']}' {_OUT_OF_SCOPE}.")

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


# ─────────────────────────────────────────────────────────────────────────────
# SEED-125 (CR-01) — org-gated skill resolution on the service-role client.
#
# The agent's skill tools (load_skill / read_skill_file / save_skill sibling-lint /
# execute_code skill-file injection) resolve skills on the BYPASSRLS service-role
# producer client (``ctx.supabase``), so the membership org gate that RLS + the mig-110
# DEFINER fns enforce on EVERY request path never applies here. Without an org predicate
# the legacy ``.or_(user_id.eq.<caller>,is_org_shared.eq.true)`` filter matched ANY org's
# ``is_org_shared`` skill → a disjoint-org caller's agent could load another org's skill
# instructions + pull its bundled file bytes. This is the SKILLS analog of the SEED-124
# folder leak Phase 165 closed on the same service-role seam.
#
# Phase 182 (CR-01) HOISTED the predicate itself to ``app.utils.skill_visibility`` — the
# grounding/canvas seam needs the SAME rule but cannot import this module (a real
# harness.scope → task_service → tool_dispatcher cycle), and a second copy is exactly the
# drift the one-source red line forbids. The rule, the RLS shape it mirrors and the
# fail-closed reasoning all live in that module's docstring. This module keeps only the
# ToolContext-shaped resolver below.
# ─────────────────────────────────────────────────────────────────────────────

async def _resolve_skill_visibility_or(ctx: ToolContext, *, born_for: bool = False) -> str:
    """Resolve the caller's org set + build the org-gated skill-visibility ``.or_()``.

    The service-role client bypasses RLS so ``auth.uid()`` / ``current_user_org_ids()``
    never resolve here — the org set MUST be resolved from the threaded ``user_id`` via
    ``org_members`` (fail-closed on an empty membership), exactly as ``folder_utils`` does
    for the folder analog (SEED-124). One await per handler; handlers with two resolution
    sites (read_skill_file / execute_code) resolve ONCE and reuse the returned string so
    the injection loop never fires N membership round-trips.

    ⭐ **Phase 264 (PACK-17 / D-264-04) — ``born_for`` IS THE DECISION, NOT A CONVENIENCE.**
    When true, the caller's ACTIVE Expert bundle (the ``born_for_bundle_id`` field on ``ctx``,
    set only by the agent-loop ToolContext builds off an ACCESS-CHECKED
    ``ResolvedExpertBundle.bundle_id``) is
    forwarded to ``build_skill_visibility_or``, which nests a
    ``born_for_expert_bundle_id = <bundle> AND is_enabled`` disjunct INSIDE the org gate. A
    resolver that simply read ``ctx`` unconditionally would have widened **all four** call
    sites by OMISSION — including ``_handle_save_skill``'s lint corpus, which D-264-04
    deliberately refuses. The explicit keyword makes every site's decision readable at the
    site, and a widening therefore cannot happen by silence. The per-site reasons are written
    beside each of the four calls below; the count is fenced at exactly three opting-in call
    sites by ``tests/unit/test_264_load_skill_born_for.py`` — as an AST count, because a
    comment quoting the keyword satisfies a grep and wires nothing.

    ⛔ The field is read through ``getattr`` with a ``None`` default, never as a bare attribute
    on ``ctx`` (the one read in this module is the line below) — three
    existing suites build duck-typed ``ToolContext``-shaped stubs that predate this field, and
    an ``AttributeError`` here would be swallowed by the ``save_skill`` lint wrapper and the
    ``execute_code`` outer guard rather than surfacing. The same ``getattr`` precedent guards
    ``skill_instructions_override`` and ``skill_snapshot`` in this module.

    ⛔ The bundle is coerced with ``str(...)`` at THIS seam: ``ToolContext`` types the field
    ``UUID | None`` while ``app.utils.skill_visibility`` annotates its parameter ``str | None``
    (264-02's zero-new-imports convention — that module imports nothing but ``coerce_uid``).
    Never re-derive the predicate term here; pass the bundle THROUGH, or the one-home count
    fence in ``tests/unit/test_264_one_home_born_for_predicate.py`` names this module.
    """
    org_ids = await _resolve_caller_org_ids(ctx.supabase, ctx.current_user["id"])
    _bundle = getattr(ctx, "born_for_bundle_id", None) if born_for else None
    return build_skill_visibility_or(
        ctx.current_user["id"],
        org_ids,
        expert_bundle_id=str(_bundle) if _bundle is not None else None,
    )


async def _handle_load_skill(args: dict, ctx: ToolContext) -> ToolResult:
    skill_name = args.get("skill_name", "")
    # Emit skill_activated SSE event immediately (SKIL-12)
    await ctx.emit(ctx.redis, ctx.run_id, 'skill_activated', skill_name=skill_name)
    # Resolve skill -- on a name collision the most-authoritative row wins:
    # system > global > owned (SEED-102). is_system DESC pins a protected built-in
    # above any same-named owned row; is_org_shared DESC is the secondary tie-break.
    # SEED-125 (CR-01): the visibility filter is org-gated (is_system universal escape
    # OR org_id ∈ caller_org_ids AND (owner OR is_org_shared)) — a disjoint-org caller no
    # longer resolves another org's is_org_shared skill on the BYPASSRLS service client.
    #
    # Phase 264 (PACK-17 / D-264-04) — ⭐ WIDEN. THIS SITE IS THE DEFECT. `load_skill` is in
    # `EXPERT_CORE_TOOLS`, and Phase 263 already admits a colleague's born-for skill at
    # RESOLVE time — but that result is the CATALOG only (names + descriptions). The
    # instruction BODY is fetched here, through a predicate that had never heard of
    # `born_for_expert_bundle_id`, so for every org member but the author the prompt promised
    # a skill the load path then refused. The opt-in below closes exactly that.
    # ⛔ Resolved ONCE and reused at the miss branch below, which is what keeps the
    # `available_skills` listing built from the SAME filter as the primary query — it can
    # never name a set the query would not admit (RESEARCH §8.8 / T-264-14). Re-deriving the
    # filter there would silently re-open half the defect while every outcome test stayed green.
    _skill_filter = await _resolve_skill_visibility_or(ctx, born_for=True)
    _skill_resp = await aexec(
        ctx.supabase.table("skills")
        .select("id, name, description, instructions, user_id")
        .or_(_skill_filter)
        .eq("name", skill_name)
        .eq("is_enabled", True)
        .order("is_system", desc=True).order("is_org_shared", desc=True)
    )
    skill_row = _skill_resp.data

    if not skill_row:
        # Exact-name miss. Weaker models -- local ones especially -- emit the skill's
        # HUMAN-READABLE title ("Weekly Report Writer") where the registry stores a slug
        # ("weekly-report-writer"). Measured 2026-08-18 on openai/gpt-oss-20b: the run
        # completed but told the operator to upload a template that WAS already attached,
        # because the miss above returned a dead end -- an error naming no valid
        # alternative, so the model could not self-correct and reasoned on from a false
        # premise. A stronger cloud model emits the slug first try and never reaches this
        # branch, which is exactly why the gap read as "local models are broken".
        #
        # Two additive recoveries, both reached ONLY where the code above already failed:
        #   1. normalised match (casefold, separators unified) -- resolves the title form
        #   2. an error that LISTS the loadable names, so one retry can succeed
        import re as _re_local   # module-local idiom used elsewhere in this file

        def _norm(v: str) -> str:
            return _re_local.sub(r"[\s_-]+", "-", (v or "").strip().casefold())

        _all_resp = await aexec(
            ctx.supabase.table("skills")
            .select("id, name, description, instructions, user_id")
            .or_(_skill_filter)
            .eq("is_enabled", True)
            .order("is_system", desc=True).order("is_org_shared", desc=True)
        )
        _candidates = _all_resp.data or []
        if not isinstance(_candidates, list):
            _candidates = [_candidates]

        _target = _norm(skill_name)
        # First match wins: the query keeps the is_system > is_org_shared precedence
        # the exact-match path relies on (SEED-102 / SEED-125), so iteration order IS
        # the authority order. Never re-sort here.
        _match = next((c for c in _candidates if _norm(c.get("name")) == _target), None)

        if _match is None:
            _available = sorted({c.get("name") for c in _candidates if c.get("name")})
            return ToolResult(result=json.dumps({
                "error": f"Skill '{skill_name}' not found or not enabled.",
                "available_skills": _available,
                "hint": "Call load_skill again with one of the names in available_skills, exactly as written.",
            }))

        logger.info(
            "load_skill: resolved '%s' to '%s' by normalised name", skill_name, _match.get("name"),
        )
        skill_row = _match

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
    # 2026-08-18: the normalised-name fallback above means `skill_name` (what the MODEL
    # typed) may differ from `row["name"]` (what actually resolved). This map is keyed by
    # the REAL skill name, so check the resolved name too -- checking only the caller's
    # string would silently serve LIVE instructions to a re-eval that asked for DRAFT
    # ones, and the eval would score the wrong text while reporting success.
    override = getattr(ctx, "skill_instructions_override", None)
    instructions = row["instructions"]
    if override is not None:
        for _key in (skill_name, row.get("name")):
            if _key is not None and _key in override:
                instructions = override[_key]
                break
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
        # SEED-125 (CR-01): org-gate the sibling set so the lint never reads (or echoes
        # the description of) another org's is_org_shared skill on the service client.
        #
        # Phase 264 (PACK-17 / D-264-04) — ⛔ DELIBERATELY **NOT** WIDENED. This is the one
        # resolver call in this module that keeps the default `born_for=False`, and the
        # decision is written here rather than left as an omission. Three measured reasons:
        #   1. `save_skill` is in NEITHER `EXPERT_CORE_TOOLS` nor `EXPERT_DELIVERABLE_TOOLS`
        #      (:4585-4609), so it is **not advertised** to an Expert run. ⚠ "not advertised",
        #      NOT "unreachable" — `effective_tools` is a SCHEMA filter, and `dispatch_tool`'s
        #      only refusal backstop is `ctx.phase_whitelist`, which is `None` on a chat run,
        #      so a hallucinated call could still dispatch here.
        #   2. The read feeds a non-blocking description **lint** corpus and produces NO
        #      user-visible capability. Widening it would only let an Expert's borrowed skills
        #      influence another user's save-time warnings — a widening with no upside.
        #   3. It is a WRITE handler's helper, while PACK-17's axis is *read the body you were
        #      promised*.
        # Driven, not merely asserted: `tests/unit/test_264_unchanged_sites_fenced.py` resolves
        # this filter on a ctx that DOES carry a bundle and pins it to the base literal.
        _sibling_filter = await _resolve_skill_visibility_or(ctx)
        siblings_resp = await aexec(
            ctx.supabase.table("skills")
            .select("id, description")
            .or_(_sibling_filter)
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

    # ── live-skill resolution below — SC#3 red line preserved (Pitfall 4); only the
    #    visibility filter is org-gated per SEED-125 (CR-01). Resolve the caller's org
    #    set ONCE and reuse it for the normalized-name retry (no double round-trip). ──
    skill_name = args.get("skill_name", "")
    # Phase 264 (PACK-17 / D-264-04) — ⭐ WIDEN. `read_skill_file` is in `EXPERT_CORE_TOOLS`,
    # and `load_skill` returns `files: [...]` (:1405) — so a body that loads while its bundled
    # files 404 is the SAME defect one layer down: the model is told the files exist and then
    # cannot read them. ⚠ This handler applies NO `is_enabled` filter of its own, which is why
    # the born-for disjunct carries its own `is_enabled.is.true` term (264-02, Form 2 /
    # T-264-15) — a bare arm here would admit a DISABLED born-for skill's bundled bytes.
    # Resolved ONCE and reused by the normalised-name retry below.
    _skill_filter = await _resolve_skill_visibility_or(ctx, born_for=True)
    # Resolve skill to get owner's user_id for storage path
    _sr_resp = await aexec(
        ctx.supabase.table("skills")
        .select("id, user_id")
        .or_(_skill_filter)
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
                .or_(_skill_filter)
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


# ---------------------------------------------------------------------------
# EXEC-01 (Phase 176-03 / D-01..D-04) — reliable declared-library install +
# bounded ModuleNotFound auto-heal, ENTIRELY inside the tool dispatcher (below the
# provider adapter boundary → provider-uniform, Deep byte-identical). See
# `_handle_execute_code` for the wiring; the run-scoped heal-bound helpers live at
# `_heal_bound_seen` / `_heal_bound_record` alongside `_NO_MODULE_RE`.
# ---------------------------------------------------------------------------
def _pip_install(session, libs: "list[str]"):
    """Install `libs` into the SANDBOX SYSTEM interpreter via `python -m pip`.

    Deliberately NOT `session.install(...)`: (A) `session.install` swallows pip
    failures (returns None on a non-zero exit — our try/except was dead code) and
    (B) it targets the venv pip, whose site-packages are invisible to the code run
    (`python -u <file>` = the SYSTEM interpreter). Running `python -m pip` here
    matches the run interpreter AND — with NO on_stdout/on_stderr callbacks — makes
    `session.execute_command` NON-streaming, so `ConsoleOutput.exit_code` and
    `.stderr` are RELIABLE. SYNCHRONOUS/blocking → call via `run_in_threadpool`.
    """
    joined = " ".join(shlex.quote(lib) for lib in libs)
    return session.execute_command(
        f"python -m pip install --disable-pip-version-check {joined}"
    )


class _SandboxCommandTimeout(Exception):
    """A bounded blocking sandbox call exceeded its wall-clock ceiling and the
    container was killed to free the wedged (uncancellable) thread (096/SEED-063).
    Carries the ceiling so the caller can build an honest aborted message."""

    def __init__(self, timeout_s):
        self.timeout_s = timeout_s
        super().__init__(f"sandbox command exceeded {timeout_s}s wall-clock limit")


async def _run_bounded_sandbox(func, *args, thread_id, timeout_s):
    """Run a BLOCKING sandbox call ``func(*args)`` off the event loop, bounded by a
    wall-clock ``timeout_s`` (``None``/``<=0`` disables the cap — operator escape hatch,
    mirrors the primary run at ``:1784``).

    A Python thread blocked in ``session.execute_command`` cannot be cancelled, so on
    overrun this KILLS the sandbox container (the only way to free the thread — 096 /
    SEED-063), abandons the orphaned future (retrieving its eventual exception in a
    done-callback so asyncio doesn't log "exception never retrieved"), and raises
    ``_SandboxCommandTimeout``. Uses ``asyncio.wait`` (which never cancels the future
    itself) rather than ``asyncio.wait_for`` so the abandoned thread keeps running
    harmlessly until the kill lands, exactly like the primary drain loop. Returns the
    call's result when it completes within the ceiling.
    """
    loop = asyncio.get_running_loop()
    fut = loop.run_in_executor(None, func, *args)
    if not timeout_s or timeout_s <= 0:
        return await fut
    done, _pending = await asyncio.wait({fut}, timeout=timeout_s)
    if not done:
        logger.warning(
            "bounded sandbox command wall-clock timeout (%ss) thread=%s — "
            "killing sandbox container", timeout_s, thread_id,
        )
        try:
            await run_in_threadpool(sandbox_manager.kill_session, thread_id)
        except Exception:  # noqa: BLE001 — abort path never raises
            logger.exception(
                "kill_session failed after bounded-command timeout thread=%s", thread_id,
            )
        fut.add_done_callback(lambda f: f.cancelled() or f.exception())
        raise _SandboxCommandTimeout(timeout_s)
    return fut.result()


async def _install_declared_libraries(
    session, libraries: "list[str]", *, thread_id=None, timeout_s=None,
) -> str:
    """Install declared `libraries` deterministically; retry ONCE on a non-zero exit.

    Returns the pip stderr IFF the install STILL failed after the retry (else "") so
    the caller can carry the honest reason into the tool result — NEVER silently
    swallowed (D-01/D-02.1). A thread-side raise is surfaced as the reason too.

    CR-01 (176): each blocking `pip install` is routed through `_run_bounded_sandbox`
    so a hung install (network stall) can't wedge the run forever — a wall-clock
    overrun kills the container and surfaces an honest aborted reason, mirroring the
    primary run's wall-clock abort. `thread_id`/`timeout_s` default to no-bound so
    unit callers stay unchanged.
    """
    try:
        res = await _run_bounded_sandbox(
            _pip_install, session, libraries, thread_id=thread_id, timeout_s=timeout_s)
        if getattr(res, "exit_code", 0):
            res = await _run_bounded_sandbox(  # retry once
                _pip_install, session, libraries, thread_id=thread_id, timeout_s=timeout_s)
        if getattr(res, "exit_code", 0):
            return (getattr(res, "stderr", "") or "") or "pip install exited non-zero"
        return ""
    except _SandboxCommandTimeout as _t:  # CR-01 — hung install killed + surfaced honestly
        logger.warning("declared pip install exceeded wall-clock limit: %s", _t)
        return (
            f"pip install exceeded the {_t.timeout_s}s wall-clock limit and was "
            "aborted (the sandbox container was killed to free it)."
        )
    except Exception as _e:  # noqa: BLE001 — surface, never swallow (D-01)
        logger.warning("declared pip install raised thread-side: %s", _e)
        return f"{type(_e).__name__}: {_e}"


# Error markers that force a stdout-only "success" to be reclassified as a failure
# (the streamed exit code from a bare `python -u` run is always 0 — Defect C). Hoisted
# to module scope so both the initial derivation and the post-heal re-derivation share
# one definition.
_EXEC_ERROR_MARKERS = (
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


def _derive_actual_exit_code(exec_result) -> int:
    """Derive the effective exit code: a bare `python -u` run streams exit_code 0
    even on a Python traceback (Defect C), so an exit-0 run whose stdout carries a
    Python error marker is bumped to 1."""
    code = getattr(exec_result, "exit_code", None) or 0
    if code == 0:
        stdout_text = getattr(exec_result, "stdout", "") or ""
        if any(m in stdout_text for m in _EXEC_ERROR_MARKERS):
            return 1
    return code


# ── Phase 244 (SHELL-04 / C-9) — thread attachments reach the sandbox ─────────
#
# WHY THIS EXISTS. `244-CONTEXT.md` said "nothing new is needed on the tool side". Measured at
# this base that is TRUE FOR TEXT and FALSE FOR BINARY: `workspace_service.read_file` returns the
# literal "Content available via REST API." for any binary MIME (:391-402), and the sandbox had NO
# workspace reach at all (`grep -rn "workspace" sandbox_service.py` -> no matches). EIGHT of the
# sixteen accepted extensions are binary, and sketch 236's headline scenario file is an .xlsx — so
# SHELL-04's "and the agent can use it" clause was unsatisfied for the MOST LIKELY attachments.
#
# ⛔ `workspace_read`'s binary branch is DELIBERATELY LEFT ALONE. Its note is honest for a
# text-reading tool; this is a SECOND, correct route rather than making the first one lie.
_ATTACHMENTS_DIR = "/sandbox/attachments"

# A bound on container I/O per session. The 10 MB per-file cap is enforced at the upload door
# (three times, including before body materialisation — WR-04), but nothing caps the COUNT of
# workspace rows a thread can accumulate, and the agent writes here too. A truncation is NAMED in
# the tool result, never silent (the `confirm_preview` refusal discipline).
_ATTACHMENT_HYDRATION_MAX_FILES = 50

# A bound on the BASENAME. ⚠ Found by the Task-3 prompt fence, not by this task's own tests: a
# 4,000-character filename produced a 4,000-character container path AND flooded the turn's system
# prompt, because nothing here capped length. Most filesystems refuse a component over 255 bytes,
# so an unbounded name is also an ENOENT the agent cannot diagnose. The tail is cut, never the
# head — workspace paths carry a `uuid8-` prefix, so truncation keeps names distinguishable.
_ATTACHMENT_NAME_MAX = 120

# WR-02 (244-07) / L-5 defect 6b (244-10). A per-session record of WHICH workspace paths were
# copied — not merely THAT hydration ran — keyed on the SANDBOX SESSION rather than on the
# per-iteration `ToolContext`.
#
# ⛔ WHY THE TYPE CHANGED, measured in a real browser and not reasoned about. `244-07` closed
# WR-02 with a `weakref.WeakSet` of sessions: hydration ran ONCE, on the call that created the
# entry. That is right for the DoS arm WR-02 named and WRONG for this one, because
# `SandboxSessionManager` caches the session per `thread_id` until idle eviction — so once a
# session was marked, NO LATER ATTACHMENT WAS EVER COPIED INTO IT. The agent's own round-4
# output is the evidence:
#       /sandbox/attachments [] ['c679b991-Meridian-Q4-pricing.xlsx']
# — the directory holds only the first file. It recovered the second at round 10 via the
# `workspace_read` fallback, ~49 s and ~10 wasted rounds later. ⛔ "The SECOND attachment did not
# hydrate", never ".pdf does not hydrate": that run attached .xlsx first and .pdf second, so
# ordering is confounded with file type and the type-specific claim is NOT established.
#
# ⭐ THE RECORD NOW SAYS WHICH FILES, so a claim about hydration can never again outlive the
# files it was about. WR-02's DoS arm survives at per-FILE granularity: an already-copied path is
# still never copied twice.
#
# ⚠ THREE PROPERTIES ARE INHERITED FROM WR-02 RATHER THAN RE-ARGUED HERE:
#   1. **keyed by the SESSION**, so the record's lifetime is exactly the lifetime of the
#      `/sandbox/attachments` directory it describes — a new container (worker bounce, idle
#      eviction) is a new key with an empty set and re-hydrates, correct rather than incidental;
#   2. **weak**, so the record cannot pin a session alive;
#   3. **membership/keying, NEVER `getattr`** — `setattr(session, flag, True)` works on the real
#      object but `getattr(mock, flag, False)` on a `MagicMock` returns an auto-created child
#      mock, which is TRUTHY, so an attribute-based guard reads "already hydrated" on the very
#      first call and cannot be fenced at all.
_hydrated_files: "weakref.WeakKeyDictionary[object, set[str]]" = weakref.WeakKeyDictionary()

# ⭐ 244-14 (review WR-03) — THE SECOND HALF OF THE RECORD: how many times each path has FAILED
# in this session. `_hydrated_files` above is now strictly *"do not attempt this path again"*
# (succeeded, or deliberately given up on); this one is *"attempted and failed, N times"*.
#
# ⛔ WHY BOTH ARE NEEDED, rather than one set recorded before the attempt. `244-10` added the
# path to `already` BEFORE the try, so a file that failed ONCE was treated as copied for the
# life of the ~30-minute cached session. Its justification — *"its failure is already named
# individually below, so nothing is lost"* — is only true of the call the failure happened in:
# every LATER call filters the path out before the loop, so no note is produced and the model is
# told nothing at all. And the `except` catches EVERY exception, while the realistic failure set
# here is dominated by transients (Supabase Storage, the pg pool, the Docker daemon).
#
# ⛔ THE DoS BOUND THE DEVIATION WAS PROTECTING IS KEPT — it just comes from a CAP instead of
# from never retrying. A permanently-broken file costs at most `_ATTACHMENT_HYDRATION_MAX_ATTEMPTS`
# attempts per SESSION, then enters `_hydrated_files` and is never touched again.
#
# ⚠ Same three properties as `_hydrated_files`, for the same reasons: keyed by the SESSION (so
# the record's lifetime is the container's), WEAK (it cannot pin a session alive), and by
# MEMBERSHIP rather than `getattr` (a `MagicMock` auto-creates truthy children).
_hydration_failures: "weakref.WeakKeyDictionary[object, dict[str, int]]" = weakref.WeakKeyDictionary()

# ⛔ How many times one path may be attempted in a session before it is given up on. 2 is
# deliberate and minimal: it converts "a single blip costs the file for 30 minutes" into "a
# single blip costs one extra attempt", without turning a genuinely broken row into an unbounded
# per-call DB read plus container write. Driven by case F2.
_ATTACHMENT_HYDRATION_MAX_ATTEMPTS = 2


def _session_hydration_records(session) -> "tuple[set[str], dict[str, int]]":
    """The two per-session hydration records for ``session``, created on first use.

    ⭐ ONE resolver for BOTH records, so the caller cannot acquire one and forget the other, and
    so the ``TypeError`` degradation for a non-weak-referenceable session lives in one place.
    That degradation returns throw-away records, which reproduces the pre-244-10 behaviour
    (re-copy every call) rather than breaking the turn — over-copying, never under-.
    """
    try:
        copied = _hydrated_files.get(session)
        if copied is None:
            copied = set()
            _hydrated_files[session] = copied
        failed = _hydration_failures.get(session)
        if failed is None:
            failed = {}
            _hydration_failures[session] = failed
        return copied, failed
    except TypeError:  # pragma: no cover — a session that cannot be weak-referenced
        logger.warning("attachment hydration: session is not weak-referenceable")
        return set(), {}


def _attachment_container_path(path: str) -> str:
    """Reduce an attacker-controlled workspace path to a BASENAME under ``_ATTACHMENTS_DIR``.

    ⛔ T-244-02-02. A filename is attacker-controlled text and this value becomes a CONTAINER
    PATH; an f-string of the raw path writes wherever the caller likes. Four reductions, in
    order, each load-bearing:

      1. backslashes are normalised so a Windows-style separator cannot hide a segment;
      2. ``os.path.basename`` discards every directory segment — ``../../etc/passwd`` -> ``passwd``;
      3. the charset is narrowed to ``validate_path``'s own set, so nothing shell- or
         path-significant survives even if a future basename implementation changed;
      4. leading dots are stripped, so ``..`` cannot survive as a name in its own right, and an
         empty residue falls back to a fixed literal rather than producing the directory itself;
      5. the length is capped (``_ATTACHMENT_NAME_MAX``) — an unbounded component is an ENOENT on
         most filesystems and, since Task 3 announces this exact path, a prompt flood.
    """
    import re as _re_attach  # module-local idiom (see _handle_load_skill / the exec hint)

    candidate = (path or "").replace("\\", "/").rstrip("/")
    base = os.path.basename(candidate)
    base = _re_attach.sub(r"[^A-Za-z0-9._\- ]", "_", base)
    base = base.lstrip(".").strip()
    if len(base) > _ATTACHMENT_NAME_MAX:
        base = base[:_ATTACHMENT_NAME_MAX].strip()
    if not base:
        base = "attachment"
    return f"{_ATTACHMENTS_DIR}/{base}"


async def _hydrate_thread_attachments(
    ctx: ToolContext, session, already: set[str], failed: dict[str, int]
) -> list[str]:
    """Copy this thread's not-yet-copied, non-expired workspace files into ``/sandbox/attachments/``.

    Returns a list of NAMED failure/truncation notes (empty on a clean run) for the caller to
    surface in the tool result. ⛔ T-244-02-07: a file the user attached is never dropped
    silently — a per-file failure is logged AND named, the way `preview_service.confirm_preview`
    names a refusal.

    ⭐ ``already`` IS THE CALLER'S OWN SET (244-10), mutated in place rather than returned and
    re-unioned — the two are equivalent, and passing the live object is what keeps the record
    keyed to the container it describes. ``failed`` is its companion (244-14), and both come from
    ``_session_hydration_records``.

    ⚠ ⛔ CORRECTED BY 244-14 (review WR-03), AND THE ORIGINAL IS KEPT BECAUSE IT WAS CONFIDENTLY
    WRONG. This paragraph used to read: *"A path is recorded the moment it is CLAIMED, so a
    permanently-broken file costs one attempt per SESSION and not one per `execute_code` call;
    its failure is already named individually below, so nothing is lost."* The first clause was
    true. **The second was only true of the call the failure happened in** — every later call
    filters the path out before the loop, so no note is produced and the model is told NOTHING.
    And the ``except`` catches every exception, while the realistic failure set here is dominated
    by TRANSIENTS. One Supabase blip therefore cost the person's file for the whole ~30-minute
    session, in silence: the identical shape of the defect 6b this function was rewritten to fix.

    ⭐ SO: ``already`` is written on SUCCESS, or on the give-up arm after
    ``_ATTACHMENT_HYDRATION_MAX_ATTEMPTS`` failures. The DoS bound the original was protecting is
    kept — it is now paid for by a CAP rather than by never retrying — and the failure is NAMED
    on every attempt. Driven by cases F1/F2/F3 in ``test_244_attachment_hydration.py``.

    ⚠ THE COST THIS ADDS, named rather than discovered later: hydration used to run
    ``ws_list_files`` ONCE PER SESSION and now runs it ONCE PER ``execute_code`` CALL. That is
    one bounded, thread-scoped DB listing on a handler that already awaits container I/O —
    accepted deliberately, because the alternative (an invalidation signal from the upload door
    into the dispatcher) is a SECOND mechanism that can go out of sync, and a marker that went
    out of sync with the container is exactly how this hole was made.

    ⚠ ONE EXPIRY GATE, TWO READERS (D-244-04). `ws_list_files` -> `list_files_in_thread` applies
    ``expires_at IS NULL OR expires_at > now()`` IN SQL, so WHICH files exist is decided there and
    nowhere else. `get_file_by_path` is used only to fetch the content columns the listing does
    not select, and it is deliberately UNFILTERED on expiry — which is exactly why it must never
    be the thing that decides membership.

    ⚠ The copy shape is `render_template`'s `_copy_in` (:3580-3601): NamedTemporaryFile ->
    `copy_to_runtime` -> unlink. ⛔ NOT the skill-file loop's base64-in-source preamble — that
    inflates the generated code file by 33% and would be catastrophic on a 10 MB attachment.

    ⚠ D-v2.5-01: every blocking call goes through `run_in_threadpool`.
    """
    import tempfile as _tempfile_local
    import os as _os_local

    notes: list[str] = []
    try:
        rows = await ws_list_files(ctx.pool, thread_id=UUID(ctx.thread_id))
    except Exception:
        logger.warning("attachment hydration: listing failed for thread %s", ctx.thread_id,
                       exc_info=True)
        return notes
    if not rows:
        return notes  # S-2: empty => do nothing at all. No mkdir, no note, no event.

    # ⭐ 244-10. Only the rows this session has not already received, and the filter is applied
    # to THE GATED LISTING'S OUTPUT — it adds no second expiry rule (D-244-04: `ws_list_files`'
    # SQL is the one home of `expires_at IS NULL OR expires_at > now()`).
    rows = [r for r in rows if (r.get("path") or "") not in already]
    if not rows:
        # ⛔ The STEADY STATE, and it is the common one: a run calling execute_code eight times
        # reaches here seven times. No mkdir, no copy, no note — the same nothing the
        # zero-attachment path costs, which Deep and Harness both share.
        return notes

    # ⛔ T-244-10-01 — THE CAP IS A SESSION TOTAL, NEVER A PER-CALL COUNT. Making the copy
    # incremental is exactly what would turn this into a per-call budget, letting a thread
    # exceed it by attaching across several calls — the DoS arm of T-244-02-05, re-opened by the
    # fix that closes defect 6b.
    if len(already) + len(rows) > _ATTACHMENT_HYDRATION_MAX_FILES:
        notes.append(
            f"Only the first {_ATTACHMENT_HYDRATION_MAX_FILES} of "
            f"{len(already) + len(rows)} workspace files were copied into "
            f"{_ATTACHMENTS_DIR}/. Read the rest with workspace_read."
        )
        rows = rows[:max(_ATTACHMENT_HYDRATION_MAX_FILES - len(already), 0)]
    if not rows:
        return notes  # budget exhausted — NAMED above, never silent.

    try:
        await run_in_threadpool(session.execute_command, f"mkdir -p {_ATTACHMENTS_DIR}")
    except Exception:
        logger.warning("attachment hydration: mkdir failed", exc_info=True)

    def _copy_in(local_bytes: bytes, container_path: str) -> None:
        with _tempfile_local.NamedTemporaryFile(mode="wb", delete=False) as _tmp:
            _tmp.write(local_bytes)
            _local = _tmp.name
        try:
            session.copy_to_runtime(_local, container_path)
        finally:
            try:
                _os_local.unlink(_local)
            except OSError:
                pass

    for row in rows:
        src_path = row.get("path") or ""
        dest = _attachment_container_path(src_path)
        try:
            file_row = await get_file_by_path(ctx.pool, UUID(ctx.thread_id), src_path)
            if file_row is None:
                raise WorkspaceError(f"row vanished between listing and read: {src_path}")
            content = await _get_file_content(ctx.pool, ctx.supabase, file_row)
            await run_in_threadpool(_copy_in, content, dest)
            # ⭐ 244-14 (WR-03) — RECORDED ON SUCCESS. `244-10` recorded it before the attempt,
            # which made ONE Supabase blip cost the file for the whole ~30-minute session, with
            # no note on any later call. `already` now means *"do not attempt this again"* and
            # is written by exactly two places: here, and the give-up arm below.
            already.add(src_path)
        except Exception as e:
            attempts = failed.get(src_path, 0) + 1
            failed[src_path] = attempts
            if attempts >= _ATTACHMENT_HYDRATION_MAX_ATTEMPTS:
                # ⛔ GIVEN UP ON, ONCE AND DELIBERATELY — this is the DoS bound `244-10`'s
                # deviation was protecting, kept but paid for with a CAP rather than with never
                # retrying. A genuinely broken row costs at most two attempts per session, not
                # one DB read plus one container write on every execute_code call for 30 minutes.
                already.add(src_path)
            logger.warning(
                "attachment hydration: %s failed (attempt %d/%d): %s",
                src_path, attempts, _ATTACHMENT_HYDRATION_MAX_ATTEMPTS, e, exc_info=True,
            )
            # ⛔ NAMED ON EVERY ATTEMPT, never once. T-244-02-07: a file the user attached is
            # never dropped silently, and the silence UAT L-5 measured was not the first note
            # going missing — it was every note AFTER it.
            notes.append(
                f"Could not load the attached file {os.path.basename(src_path)} into "
                f"{_ATTACHMENTS_DIR}/ ({type(e).__name__}). It is still readable with "
                f"workspace_read if it is a text file."
            )
    return notes


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

        # Phase 244 (SHELL-04 / C-9) — hydrate this thread's attachments into
        # /sandbox/attachments/ so a binary attachment is USABLE, not merely present.
        #
        # ⛔ ONCE PER FILE PER SANDBOX SESSION — AND THE RECORD LIVES ON THE SESSION, WHICH IS
        # THE ONLY OBJECT THAT SURVIVES LONG ENOUGH TO MEAN IT (WR-02 / 244-07). It was on `ctx`
        # "in the exact shape of the `_output_baseline_seeded` guard", and that shape is wrong
        # for this claim: `agent_loop.py` constructs a **new ToolContext on every iteration**
        # (its own comment says so — *"Phase 083 D-01: construct ToolContext once per
        # iteration"*), so a fresh object meant a fresh `getattr` default and the guard only
        # ever suppressed re-copies among PARALLEL tool calls inside one iteration. Measured
        # cost of that: a run calling execute_code in eight iterations copied the same 10 MB
        # attachment eight times — the DoS arm of T-244-02-05, still open behind a comment
        # saying it was closed.
        #
        # ⭐ THE MARKER IS `_hydrated_files` (see its definition), AND ITS TYPE CHANGED AT 244-10
        # BECAUSE A BOOLEAN WAS THE DEFECT. A `WeakSet` of sessions said only THAT hydration had
        # run, so a file attached AFTER the sandbox existed was never copied — the session is
        # cached per `thread_id` until idle eviction, so "already hydrated" stayed true for the
        # whole 30 minutes while the container's contents were provably stale. The record now
        # says WHICH paths arrived, and the helper is consulted on EVERY call rather than once.
        # ⚠ `_output_baseline_seeded` above is left alone deliberately: it is a different claim
        # on a different cadence, and moving it is not this defect.
        # ⚠ ⛔ THIS COMMENT USED TO SAY *"Each path is recorded BEFORE its copy is attempted,
        # inside the helper: a hard failure must not re-attempt container I/O on every subsequent
        # execute_code call. Per-FILE failures are already handled and named individually there,
        # so nothing is lost by it."* — CORRECTED BY 244-14 (review WR-03), and kept rather than
        # overwritten because the second sentence was false and confident. Naming a failure in
        # the call it happened in is NOT naming it: every later call filtered the path out, so
        # the model heard nothing, and one transient Supabase blip cost the file for the whole
        # ~30-minute session. A path is now recorded on SUCCESS, or after
        # `_ATTACHMENT_HYDRATION_MAX_ATTEMPTS` failures — the DoS bound survives as a CAP.
        # ⛔ A thread with no NEW attachments performs no mkdir, no copy and adds no note — Deep
        # and Harness share this handler, so the steady state must cost exactly nothing.
        _already_copied, _failed_attempts = _session_hydration_records(session)
        _attachment_notes = await _hydrate_thread_attachments(
            ctx, session, _already_copied, _failed_attempts
        )

        # Inject skill files into sandbox
        skill_files_req = args.get("skill_files") or []
        file_preamble = ""
        # SEED-125 (CR-01): resolve the caller's org-gated skill-visibility filter ONCE
        # before the injection loop (not per file) so a disjoint-org caller cannot pull
        # another org's is_org_shared skill files into the sandbox on the service client.
        #
        # Phase 264 (PACK-17 / D-264-04) — ⭐ WIDEN. `execute_code` is in
        # `EXPERT_DELIVERABLE_TOOLS`, unioned in whenever `tool_floor_enabled` (the default).
        # Same class as `read_skill_file`, one layer further out, and the failure is QUIETER:
        # an unresolved skill here is a `logger.warning` plus a silently-skipped file below, so
        # the sandbox runs WITHOUT the helper and the model reasons on from a false premise.
        # ⚠ This handler applies no `is_enabled` filter either — see the born-for disjunct's
        # own enablement term (T-264-15). Resolved ONCE, before the loop, never per file.
        _sf_filter = (
            await _resolve_skill_visibility_or(ctx, born_for=True) if skill_files_req else None
        )
        for sf in skill_files_req:
            sf_skill_name = sf.get("skill_name", "")
            sf_filename = sf.get("filename", "")
            if not sf_skill_name or not sf_filename:
                continue
            _sf_resp = await aexec(
                ctx.supabase.table("skills")
                .select("id, user_id")
                .or_(_sf_filter)
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
                        .or_(_sf_filter)
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

        # EXEC-01 (D-01/D-02.1): declared-install hardening + per-run heal bookkeeping.
        # `_declared_install_stderr` carries a persistent declared-install failure
        # forward to the honest tool result (never swallowed); `_healed_modules_fallback`
        # is the call-local heal bound used only when Redis is unavailable (graceful
        # degrade — a Redis hiccup must never break execute_code).
        _declared_install_stderr = ""
        _healed_modules_fallback: set[str] = set()

        # Install libraries
        if libraries:
            # SAND (silence fix): honest 'installing libraries' phase for the pip
            # window + threadpool the blocking install (matplotlib/pandas/etc.
            # can be many seconds) so it never freezes the event loop (D-v2.5-01).
            await ctx.emit(ctx.redis, ctx.run_id, 'code_executing',
                           tool_index=ctx.tool_index,
                           elapsed_seconds=round(time_mod.time() - _setup_started, 1),
                           phase='installing_libraries')
            # EXEC-01: `python -m pip install` (system interpreter → visible to the
            # `python -u` code run; non-stream → reliable exit_code), retry once. A
            # persistent failure surfaces via the honest tool result below — NEVER
            # silently swallowed as it was with the venv-targeted `session.install`.
            _declared_install_stderr = await _install_declared_libraries(
                session, libraries,
                thread_id=ctx.thread_id,
                timeout_s=settings.sandbox_exec_timeout_seconds,
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

        # Derive actual exit code (Defect C: a bare `python -u` streams exit 0 even on a
        # traceback → bump to 1 on a stdout error marker).
        actual_exit_code = _derive_actual_exit_code(exec_result)

        # EXEC-01 (D-02.2 / D-03) — bounded, RUN-SCOPED ModuleNotFound auto-heal. On a
        # FAILED run, install the missing module (system interpreter) + re-run the code
        # ONCE, bounded 1-per-module-per-RUN via a per-run Redis key on ctx.run_id (with
        # a graceful call-local fallback). A successful heal adopts the re-run result and
        # flows through the normal DB-log / harvest / completion path below; a persistent
        # failure attaches an honest `install_failed` note to the MODEL-facing llm_content
        # (never a raw traceback under a 'completed' status). Provider-uniform, no
        # `provider ==` fork; a clean run never enters here (Deep byte-identical — D-04).
        _install_failed_note: "dict | None" = None
        # WR-02 (176): True once a heal RE-RUN produced a new result. The re-run runs
        # WITHOUT on_stdout/on_stderr, so its output never streamed as code_stdout/
        # code_stderr deltas — the live card still holds the FIRST run's pre-heal error
        # text. This flag drives the corrective stdout/stderr carried on the completion
        # event below so the live card reflects the run of record, not a stale error
        # under a success badge.
        _healed_rerun = False
        if actual_exit_code != 0:
            _heal = await _autoheal_missing_module(
                session=session, ctx=ctx, code_file=code_file,
                stdout=exec_result.stdout or "", stderr=exec_result.stderr or "",
                declared_install_stderr=_declared_install_stderr,
                healed_fallback=_healed_modules_fallback,
            )
            if _heal is not None:
                if _heal.get("exec_result") is not None:
                    exec_result = _heal["exec_result"]
                    duration_ms = int((time_mod.time() - start_time) * 1000)
                    actual_exit_code = _derive_actual_exit_code(exec_result)
                    _healed_rerun = True
                if _heal.get("install_failed") is not None:
                    _install_failed_note = _heal["install_failed"]

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
        _complete_kwargs: dict = dict(
            exit_code=actual_exit_code, duration_ms=duration_ms,
            execution_id=execution_id, output_files=output_file_list,
        )
        # WR-02 (176): on a heal re-run, carry the HEALED run's authoritative
        # stdout/stderr + a `healed` marker so the client REPLACES the stale pre-heal
        # delta text (which never got superseded — the re-run had no stream callbacks)
        # with the real output of record. Guarded on `_healed_rerun` → the normal
        # (non-heal) completion is byte-identical (D-14); a clean run never sets it.
        if _healed_rerun:
            _complete_kwargs["healed"] = True
            _complete_kwargs["stdout"] = exec_result.stdout or ""
            _complete_kwargs["stderr"] = exec_result.stderr or ""
        await ctx.emit(ctx.redis, ctx.run_id, 'code_execution_complete', **_complete_kwargs)

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
        # Phase 244 (T-244-02-07) — a file the user attached that could NOT be loaded is NAMED
        # to the model, never silently dropped. Guarded on a non-empty list, so a clean run (and
        # every zero-attachment run) carries no new key and stays byte-identical.
        if _attachment_notes:
            _llm_payload["attachments"] = _attachment_notes
        # 2026-08-19 — SELF-REPAIR for the single most expensive authoring mistake
        # observed: the model writes correct code that opens `/sandbox/<file>` but
        # omits the `skill_files` argument, so the file is never injected. The raw
        # error it gets back is `PackageNotFoundError` / `FileNotFoundError` naming a
        # path — which says nothing about the argument it forgot, so it cannot
        # self-correct. Measured: a local 20B model burned FOUR attempts and 26
        # minutes on exactly this; a frontier model read the tool schema and got it
        # right first try. Naming the missing argument turns a dead end into one
        # retry. Fires ONLY on a failing run that referenced an un-injected
        # /sandbox path, so a correct call is byte-identical.
        import re as _re_hint   # module-local idiom (see _handle_load_skill)
        _stderr_txt = exec_result.stderr or ""
        if actual_exit_code != 0 or "Traceback" in _stderr_txt:
            _injected = {
                (sf.get("filename") or "") for sf in (skill_files_req or [])
            }
            _referenced = set(_re_hint.findall(r"/sandbox/([A-Za-z0-9._-]+)", _stderr_txt))
            # /sandbox/output/<name> is the OUTPUT dir, never an injected input.
            _missing = {f for f in _referenced if f and f != "output" and f not in _injected}
            if _missing:
                _names = ", ".join(sorted(_missing))
                _llm_payload["missing_skill_file"] = (
                    f"The code referenced /sandbox/{_names} but that file was NOT injected "
                    f"into the sandbox, because this execute_code call did not pass a "
                    f"`skill_files` argument for it. Retry the SAME call with "
                    f'`skill_files: [{{"skill_name": "<skill name as returned by '
                    f'load_skill>", "filename": "{sorted(_missing)[0]}"}}]` added. '
                    f"Do not change the code."
                )
                logger.info(
                    "execute_code: missing_skill_file hint emitted for %s (injected=%s)",
                    _names, sorted(_injected),
                )

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
        # EXEC-01 (D-03) — honest install-failure note on the MODEL-facing llm_content
        # only (the persisted/UI `tool_result` stays a normal error). Mirrors the
        # runtime_gap injection above; only set on a FAILED run, so `status` is already
        # "error". Mutually exclusive with runtime_gap (KNOWN_MISSING modules are never
        # healed, unknown modules are never classified as a permanent gap).
        if _install_failed_note is not None:
            _llm_payload["install_failed"] = _install_failed_note
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


# ---------------------------------------------------------------------------
# EXEC-01 (Phase 176-03 / D-02.2 / D-03) — run-scoped ModuleNotFound auto-heal.
# Reuses `_NO_MODULE_RE` for extraction and `_pip_install` (system interpreter) for
# the install; the 1-per-module-per-RUN bound lives in a per-run Redis SET keyed on
# `ctx.run_id` (`heal_attempted:{run_id}`, SADD/SISMEMBER + EXPIRE 600 — same run-buffer
# TTL discipline as `run:{run_id}` / eval_runner_service / skill_tuner) with a graceful
# call-local fallback when Redis is unavailable. Entirely below the provider boundary
# → provider-uniform, and a literal no-op for any run where the code succeeds (a clean
# run never enters the heal), so Deep behavior stays byte-identical (D-04/D-14).
# ---------------------------------------------------------------------------
_PREINSTALLED_HINT_LIBS = (
    "reportlab, pandas, matplotlib, python-docx, python-pptx, openpyxl, "
    "docxtpl, numpy, scipy, seaborn, plotly, pypdf"
)
_HEAL_BOUND_TTL_S = 600  # run-buffer TTL (eval_runner_service:79 / skill_tuner:114)


def _extract_missing_module(stdout: str, stderr: str) -> "str | None":
    """Extract the missing module from a ModuleNotFoundError via the shared
    `_NO_MODULE_RE`, scanning stdout+stderr lowercased (mirrors `_classify_runtime_gap`
    `out_l`). None when there is no `No module named 'X'` signal."""
    out_l = f"{stdout or ''}\n{stderr or ''}".lower()
    m = _NO_MODULE_RE.search(out_l)
    return m.group(1) if m else None


def _install_failed_detail(module: str, reason: str) -> dict:
    """Model-facing honest payload for a persistent install/heal failure. The reason
    (pip stderr) is truncated ~300 chars; the hint points at the preinstalled set so
    the model can pivot instead of blindly retrying (D-03)."""
    return {
        "module": module,
        "reason": (reason or "").strip()[:300],
        "hint": (
            f"Could not install {module}. Use a preinstalled library "
            f"({_PREINSTALLED_HINT_LIBS}) or tell the user this package is "
            "unavailable. Do not retry the same install."
        ),
    }


async def _heal_bound_seen(ctx, healed_fallback: set, module: str) -> bool:
    """True if `module` was already heal-attempted anywhere in THIS run. Consults the
    per-run Redis set (`heal_attempted:{ctx.run_id}`); on ANY Redis error/unavailability
    falls back to the call-local set. `ctx.redis` is a redis.asyncio client so sismember
    is awaited directly (NO run_in_threadpool — that wraps only the blocking sandbox
    session.* calls; D-v2.5-01)."""
    redis = getattr(ctx, "redis", None)
    run_id = getattr(ctx, "run_id", None)
    if redis is not None and run_id is not None:
        try:
            return bool(await redis.sismember(f"heal_attempted:{run_id}", module))
        except Exception as _e:  # noqa: BLE001 — a Redis hiccup must never break execute_code
            logger.warning("heal-bound sismember failed (call-local fallback): %s", _e)
    return module in healed_fallback


async def _heal_bound_record(ctx, healed_fallback: set, module: str) -> None:
    """Record `module` as heal-attempted for THIS run in the per-run Redis set (SADD +
    EXPIRE so it self-expires with the run buffer); falls back to the call-local set on
    any Redis error/unavailability."""
    redis = getattr(ctx, "redis", None)
    run_id = getattr(ctx, "run_id", None)
    if redis is not None and run_id is not None:
        try:
            key = f"heal_attempted:{run_id}"
            await redis.sadd(key, module)
            await redis.expire(key, _HEAL_BOUND_TTL_S)
            return
        except Exception as _e:  # noqa: BLE001 — degrade gracefully
            logger.warning("heal-bound sadd failed (call-local fallback): %s", _e)
    healed_fallback.add(module)


async def _autoheal_missing_module(
    *, session, ctx, code_file: str, stdout: str, stderr: str,
    declared_install_stderr: str, healed_fallback: set,
) -> "dict | None":
    """Bounded ModuleNotFound auto-heal for a FAILED execute_code run (D-02.2 / D-03).

    Returns one of:
      * ``None`` — nothing to heal (no ModuleNotFound + no declared failure, or a
        KNOWN_MISSING permanent gap → left to ``_classify_runtime_gap``).
      * ``{"install_failed": {...}}`` — honest note for ``llm_content`` (no re-run).
      * ``{"exec_result": <ConsoleOutput>}`` — the code was re-run clean; adopt it.
      * ``{"exec_result": <ConsoleOutput>, "install_failed": {...}}`` — re-ran but still
        missing → adopt the new result AND attach the honest note.
    """
    module = _extract_missing_module(stdout, stderr)
    if module is None:
        # No ModuleNotFound signal — but a persistent DECLARED install failure must
        # still surface honestly rather than be swallowed (D-01).
        if declared_install_stderr:
            return {"install_failed": _install_failed_detail(
                "the declared libraries", declared_install_stderr)}
        return None

    # KNOWN_MISSING permanent gaps (e.g. markitdown) are reshaped by _classify_runtime_gap
    # — never install/heal them here.
    if module in KNOWN_MISSING_MODULES:
        return None

    # Run-scoped 1-per-module bound: a module already heal-attempted anywhere in this
    # run (INCLUDING a prior execute_code call — the actual BUG-260708-02 behavior, which
    # a call-local set cannot bound) goes straight to the honest result, no re-install.
    if await _heal_bound_seen(ctx, healed_fallback, module):
        return {"install_failed": _install_failed_detail(
            module, declared_install_stderr or "Already attempted to install this module "
            "earlier in this run; it did not resolve.")}

    await _heal_bound_record(ctx, healed_fallback, module)

    # CR-01 (176): both the heal install and the re-run are bounded by the SAME
    # wall-clock ceiling the primary run uses (096/SEED-063) so a healed-then-runaway
    # script — or a hung `pip install` — can never wedge the run into a 40-minute
    # zombie. `thread_id` is what `_run_bounded_sandbox`/`kill_session` need to free
    # the container on overrun; absent (unit ctx) → no bound.
    _thread_id = getattr(ctx, "thread_id", None)
    _exec_timeout_s = settings.sandbox_exec_timeout_seconds

    # Install the missing module into the SYSTEM interpreter (python -m pip, retry once).
    _install_stderr = await _install_declared_libraries(
        session, [module], thread_id=_thread_id, timeout_s=_exec_timeout_s)
    if _install_stderr:
        return {"install_failed": _install_failed_detail(module, _install_stderr)}

    # Install OK — re-run the code ONCE, bounded by the wall-clock ceiling (a blocking
    # session.execute_command in a threadpool thread cannot be cancelled — D-v2.5-01),
    # reusing the container-resident code_file. Do NOT re-enter the async drain
    # (Pitfall 1). On overrun `_run_bounded_sandbox` has already killed the container;
    # surface an honest aborted note (never a silent zombie), mirroring the primary
    # run's `[execution aborted]` / 124 completion.
    try:
        new_result = await _run_bounded_sandbox(
            session.execute_command, f"python -u {code_file}",
            thread_id=_thread_id, timeout_s=_exec_timeout_s)
    except _SandboxCommandTimeout as _t:
        logger.warning(
            "auto-heal re-run wall-clock timeout (%ss) thread=%s module=%s — "
            "container killed", _t.timeout_s, _thread_id, module,
        )
        return {"install_failed": _install_failed_detail(
            module,
            f"installed, but the re-run exceeded the {_t.timeout_s}s wall-clock "
            "execution limit and was aborted.",
        )}
    still_missing = _extract_missing_module(
        getattr(new_result, "stdout", "") or "", getattr(new_result, "stderr", "") or ""
    )
    if still_missing is not None:
        return {"exec_result": new_result,
                "install_failed": _install_failed_detail(still_missing, "")}
    return {"exec_result": new_result}


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
    # Phase 151 (FILE-02) — registry + get_tools BOTH (sandbox-gated); G-5: handler + one line, threads.py untouched
    "fetch_document_file": _handle_fetch_document_file,
    # Phase 151 (FILE-01) — registry + get_tools BOTH (self_improve-gated); G-5: handler + one line, threads.py untouched
    "attach_skill_file": _handle_attach_skill_file,
}

# Phase 260 (PACK-02 / F-3) — Canonical core tools allowed for consultant experts
# Derived strictly from _TOOL_REGISTRY keys to prevent second-registry drift.
EXPERT_CORE_TOOLS: frozenset[str] = frozenset({
    "search_documents",
    "query_documents",
    "read_document",
    "analyze_document",
    "ls",
    "tree",
    "grep",
    "glob",
    "load_skill",
    "read_skill_file",
})

assert EXPERT_CORE_TOOLS.issubset(_TOOL_REGISTRY.keys()), (
    f"EXPERT_CORE_TOOLS contains tools not registered in _TOOL_REGISTRY: "
    f"{EXPERT_CORE_TOOLS - set(_TOOL_REGISTRY.keys())}"
)

# Phase 261 (PACK-02 / D-v4.3-02 / SEED-303 S6) — Additive tool floor preserving deliverable-producing tools
EXPERT_DELIVERABLE_TOOLS: frozenset[str] = frozenset({
    "execute_code",
    "workspace_write",
    "render_template",
    "ask_user",
})

assert EXPERT_DELIVERABLE_TOOLS.issubset(_TOOL_REGISTRY.keys()), (
    f"EXPERT_DELIVERABLE_TOOLS contains tools not registered in _TOOL_REGISTRY: "
    f"{EXPERT_DELIVERABLE_TOOLS - set(_TOOL_REGISTRY.keys())}"
)



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
    # Phase 151 (FILE-02 / D-11) — fetch_document_file materializes bytes INTO the
    # sandbox, so the sandbox kill-switch also refuses it in-flight (fail-closed,
    # provider-uniform — the get_tools HIDE layer's defense-in-depth sibling).
    "fetch_document_file": ("sandbox_enabled", "Document file fetch"),
    # Phase 151 (FILE-01 / D-11) — attach_skill_file is a self-improvement WRITE (it saves a
    # file onto an owned skill), so the self-improve kill-switch also refuses it in-flight
    # (fail-closed, provider-uniform — the get_tools HIDE layer's defense-in-depth sibling).
    "attach_skill_file": ("self_improve_enabled", "Self-improvement (skill file attach)"),
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


async def _handle_connector_chat_tool(
    service_id: str,
    action_tool_name: str,
    args: dict,
    ctx: ToolContext,
) -> ToolResult:
    """Phase 216 (CHAT-05 / CHAT-07 / GRANT-03 / D-216-04): Dispatches namespaced connector tool."""
    from uuid import UUID
    from app.services.connector_service import list_connections
    from app.services.connectors.grants import resolve_effective_posture
    from app.services.connectors.chat_tools import wrap_untrusted_tool_result
    from app.services.connectors.org_scope import resolve_connector_org

    user_id = (ctx.current_user or {}).get("id")
    if not user_id:
        logger.warning(
            "connector chat tool %s: no authenticated user in context (audit_log.user_id is NOT NULL)",
            action_tool_name,
        )
        return ToolResult(result=f"Cannot execute {action_tool_name}: no authenticated user in context.")

    # ── ⚠ THREE DIFFERENT FAULTS USED TO ARRIVE AS ONE INNOCENT SENTENCE ──────────────
    # This function resolved the org with a swallowed `except: pass` followed by
    # `org_id = str(user_id)`, and then listed connections under `except: conns = []`.
    # A user id matches no `connector_connections.org_id`, so an RLS denial, a dropped
    # connection, an org-less account and a genuinely absent connection ALL ended at
    # `"Connector service 'x' is not connected or not found."` — a refusal that names
    # the wrong cause is worse than one that says it does not know, because the model
    # then relays the wrong remedy to the person. (Measured 2026-08-31 one level up:
    # given only `HTTP 403`, the model told the operator to re-consent scopes that were
    # already granted.) Each arm below now says which one it was.
    scope = await resolve_connector_org(ctx.current_user, getattr(ctx, "supabase", None))
    if not scope.ok:
        return ToolResult(result=json.dumps({
            "error": "connector_scope_unresolved",
            "tool": action_tool_name,
            "message": (
                f"{action_tool_name} was NOT performed: {scope.problem}. This is not the "
                f"same as {service_id!r} being disconnected — the connection was never "
                "looked up."
            ),
        }))
    org_id = scope.org_id

    # Look up connection matching service_id
    try:
        conns = await list_connections(org_id=str(org_id), supabase=ctx.supabase)
    except Exception as exc:  # noqa: BLE001 — a DB/RLS boundary
        # ⚠ NOT `conns = []`. An unreadable list is not an empty one, and only this arm
        # can tell them apart.
        logger.warning(
            "connector chat tool %s: listing connections for org %s failed",
            action_tool_name, org_id, exc_info=True,
        )
        return ToolResult(result=json.dumps({
            "error": "connector_lookup_failed",
            "tool": action_tool_name,
            "message": (
                f"{action_tool_name} was NOT performed: your connected services could "
                f"not be read ({exc.__class__.__name__}). {service_id!r} may well be "
                "connected — this is a lookup failure, not a missing connection."
            ),
        }))
    matched_conn = next(
        (c for c in conns if (c.service_id == service_id or (c.name and c.name.lower().replace(" ", "_") == service_id.lower()))),
        None,
    )
    if not matched_conn:
        # Reached ONLY after a successful read of a resolved org — so this sentence is
        # now true when it is said, which it was not before.
        return ToolResult(result=f"Connector service '{service_id}' is not connected or not found.")

    # Phase 223 (GRANT-05 / SC#1 / D-223-01..04): Audit all outbound connector tool execution attempts & outcomes.
    def _record_connector_audit(outcome: str, failure_reason: str | None = None) -> None:
        arg_keys = list(args.keys()) if isinstance(args, dict) else []
        audit_meta = {
            "connection_id": str(matched_conn.id),
            "service_id": service_id,
            "service_name": matched_conn.name,
            "tool_name": action_tool_name,
            "outcome": outcome,
            "arg_keys": arg_keys,
            "failure_reason": failure_reason,
        }
        actor_user_id = (ctx.current_user or {}).get("id")
        if not actor_user_id:
            logger.warning("Cannot audit connector call: user_id is missing (audit_log.user_id is NOT NULL)")
            return
        entry_coro = write_audit_entry(
            user_id=actor_user_id,
            action_type="connector.call",
            metadata=audit_meta,
            supabase=ctx.supabase,
            org_id=str(org_id) if org_id else None,
        )
        if getattr(ctx, "spawn", None) is not None:
            ctx.spawn(entry_coro)
        else:
            asyncio.create_task(entry_coro)

    # Phase 221 (D-221-05 / D-221-06) — the APPLICATION rung, resolved from the spec table.
    # ⚠ Without these two keywords the middle rung is a no-op and the write cap CANNOT FIRE:
    # `application` defaults to None, so `app:drive` is never consulted and an application
    # `allow` would arm a write. The cap shipped tested-and-unreachable; this is the wire.
    from app.services.connectors.service_tools import tool_facet

    _application, _is_write = tool_facet(getattr(matched_conn, "service_id", None), action_tool_name)
    posture = resolve_effective_posture(
        matched_conn, action_tool_name, application=_application, is_write=_is_write
    )

    # ── TRUST-03: Trifecta Anti-Injection Fence ───────────────────────────────
    # If this is a mutating / write tool and connection-sourced knowledge was retrieved
    # into prompt context, disarm automated execution and force human approval ('ask').
    # Prevents untrusted external content (e.g. prompt injection in a watched document)
    # from triggering unauthorized outbound write actions without explicit operator consent.
    has_conn_in_context = getattr(ctx, "has_connection_retrieval", False)
    if not has_conn_in_context:
        for cit in getattr(ctx, "citations", []) or []:
            if isinstance(cit, dict) and (cit.get("source_connection_id") or cit.get("source_state")):
                has_conn_in_context = True
                break

    if _is_write and has_conn_in_context and posture != "deny":
        posture = "ask"

    if posture == "deny":
        _record_connector_audit("policy_denial", "Denied by tool posture policy")
        return ToolResult(
            result=json.dumps({
                "error": "tool_refused",
                "message": f"Action '{action_tool_name}' on {matched_conn.name} was denied by policy.",
            })
        )

    if posture == "ask" and getattr(ctx, "redis", None) is not None:
        call_id = getattr(ctx, "tool_call_id", None) or f"call_{int(datetime.now(timezone.utc).timestamp() * 1000)}"
        now_utc = datetime.now(timezone.utc)
        deadline_utc = now_utc + timedelta(seconds=_APPROVAL_TIMEOUT_SECONDS)
        expires_at_iso = deadline_utc.isoformat()
        if getattr(ctx, "emit", None) is not None:
            await ctx.emit(
                ctx.redis,
                getattr(ctx, "run_id", None),
                "tool_approval_required",
                # ⚠ THE CONNECTION ID, NOT ONLY THE SERVICE ID. Two rows can share a
                # service — this install has two `slack` connections in different orgs —
                # so a client that resolved "which connection is this" from `service_id`
                # would sometimes write a grant onto the wrong one. It is also the only
                # way the card's "Always allow" can name what it is changing: without it,
                # that button could not exist, which is a reachability defect of exactly
                # the shape this repo keeps finding.
                connection_id=str(matched_conn.id),
                service_id=service_id,
                service_name=matched_conn.name,
                tool_name=action_tool_name,
                args=args,
                expires_at=expires_at_iso,
                timeout_seconds=_APPROVAL_TIMEOUT_SECONDS,
            )

        approval_channel = f"tool_approval:{ctx.thread_id}:{call_id}"
        pubsub = ctx.redis.pubsub()
        await pubsub.subscribe(approval_channel)
        try:
            async def _wait_for_decision():
                while True:
                    msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                    if msg is not None and msg.get("type") == "message":
                        try:
                            return json.loads(msg["data"])
                        except Exception:
                            return None

            decision_payload = await asyncio.wait_for(_wait_for_decision(), timeout=_APPROVAL_TIMEOUT_SECONDS)
            if not decision_payload or decision_payload.get("decision") != "allow":
                _record_connector_audit("user_rejected", "User rejected execution")
                return ToolResult(
                    result=json.dumps({
                        "status": "rejected",
                        "message": f"User rejected execution of tool '{action_tool_name}' on {matched_conn.name}. Do not retry this action unless explicitly requested by the user.",
                    })
                )
        except asyncio.TimeoutError:
            _record_connector_audit("timeout", f"Approval request timed out after {int(_APPROVAL_TIMEOUT_SECONDS)}s")
            return ToolResult(
                result=json.dumps({
                    "status": "timeout",
                    "message": f"Tool execution '{action_tool_name}' on {matched_conn.name} timed out waiting for human approval in the chat. Nobody answered in time. Do not advise the user to check a workspace panel or re-authenticate; if the user still wants this action, ask them in this chat if they would like to try again.",
                })
            )
        finally:
            try:
                await pubsub.unsubscribe(approval_channel)
                await pubsub.aclose()
            except Exception:
                pass

    # ══════════════════════════════════════════════════════════════════════════════════
    # Execute the action — THREE SHAPES, ONE HONEST FAILURE
    # ══════════════════════════════════════════════════════════════════════════════════
    #
    # ⚠ THE VERSION THIS REPLACES TOLD THE MODEL EVERY FAILURE HAD SUCCEEDED. It caught
    # `Exception` and answered `f"Executed {tool} on {name} with result/note: {exc}"`, so an
    # expired token, a 404 and a timeout all reached the model as a COMPLETED ACTION with a
    # note attached — and the model then reported to the person that the message was posted.
    # Its `if not raw_output` fallback said "successfully." for the same reason. A refusal
    # must READ as a refusal: the phase executor's own contract (`phase_types.py:2865`) is
    # that only the adapter's verdict produces `completed`, and this path now matches it.
    #
    # ⚠ AND THE NATIVE BRANCH COULD NEVER HAVE RUN. It called
    # `adapter.send(matched_conn, args, user_id=...)` against a protocol whose `send` is
    # KEYWORD-ONLY (`args`, `credential`, `config`, `capability`) — an immediate `TypeError`,
    # swallowed by the same handler into an "Executed …" sentence. Slack, Jira and SMTP have
    # never once been callable from chat, and nothing failed, because the lie caught the
    # evidence.
    raw_output = ""
    failure: str | None = None

    try:
        from app.services.connector_service import resolve_connection

        # ONE resolve for all three shapes. It is also the org-scoping gate and the D-11
        # credential read, so no branch below can reach a wire without passing it.
        resolved_conn = await resolve_connection(matched_conn.id, matched_conn.org_id)

        if getattr(matched_conn, "mcp_server_url", None):
            from app.services import mcp_client

            tool_res = await mcp_client.call_tool(
                resolved_conn.mcp_server_url,
                tool_name=action_tool_name,
                arguments=args,
                secret=resolved_conn.secret,
                # Resolved, not guessed — see ResolvedConnection.auth_scheme.
                auth_scheme=resolved_conn.auth_scheme,
            )
            # ⚠ `isError` IS THE SERVER SAYING NO, and reading only `text` treats its refusal
            # as its answer — the same shape as the "Executed …" lie one level up.
            if isinstance(tool_res, dict) and tool_res.get("isError"):
                failure = str(tool_res.get("text") or "the server refused the call")
            else:
                raw_output = tool_res.get("text") or json.dumps(
                    tool_res.get("content") or tool_res
                )
        else:
            from app.services.connectors.service_tools import (
                ServiceToolError,
                execute_service_tool,
                spec_for,
            )

            spec = spec_for(getattr(matched_conn, "service_id", "") or "", action_tool_name)
            if spec is not None:
                # One of the SERVICE's advertised actions (Phase 216 follow-up). Same host and
                # same egress key as the capability it hangs off; no allow-list is widened.
                try:
                    result = await execute_service_tool(
                        matched_conn.service_id,
                        action_tool_name,
                        args,
                        secret=resolved_conn.secret,
                        config=resolved_conn.config,
                        # The OAuth arm mints its own access token from the row; it cannot
                        # use `secret`, which for an oauth_byo connection is None.
                        connection_id=str(matched_conn.id),
                    )
                    raw_output = json.dumps(result)
                except ServiceToolError as exc:
                    failure = str(exc)
            elif getattr(matched_conn, "capability", None) == action_tool_name:
                # The row's own capability verb — the ONE action with a first-party adapter.
                from app.services.connectors.registry import get_adapter

                adapter = get_adapter(action_tool_name)
                send_args = {
                    key: value
                    for key, value in args.items()
                    if key in adapter.INPUT_SCHEMA.get("properties", {})
                }
                result = await adapter.send(
                    args=send_args,
                    credential=resolved_conn,
                    config=resolved_conn.config,
                    capability=action_tool_name,
                )
                # ⚠ ONLY THE ADAPTER'S OWN VERDICT MEANS DONE. Slack answers HTTP 200 with
                # `{"ok": false}` for a message nobody received; `phase_types.py` states this
                # at length and chat must not disagree with the canvas about the same send.
                if not getattr(result, "ok", False):
                    failure = (
                        getattr(result, "provider_message", "")
                        or getattr(result, "detail", "")
                        or "the destination refused it"
                    )
                else:
                    raw_output = json.dumps(
                        {
                            "performed": action_tool_name,
                            "detail": getattr(result, "detail", "") or "",
                            "provider_message": getattr(result, "provider_message", "") or "",
                        }
                    )
            else:
                failure = (
                    f"{matched_conn.name} does not advertise an action called "
                    f"{action_tool_name!r}"
                )
    except Exception as exc:  # noqa: BLE001 — a transport/credential boundary
        logger.warning(
            "connector chat tool %s on %s failed", action_tool_name, matched_conn.name,
            exc_info=True,
        )
        failure = str(exc) or exc.__class__.__name__

    if failure is not None:
        _record_connector_audit("execution_failure", failure)
        # Not wrapped: this sentence is OURS, not third-party text, and putting our own words
        # inside the untrusted-content envelope would teach the model to distrust them.
        return ToolResult(
            result=json.dumps(
                {
                    "error": "tool_failed",
                    "service": matched_conn.name,
                    "tool": action_tool_name,
                    "message": (
                        f"{action_tool_name} on {matched_conn.name} was NOT performed: "
                        f"{failure}"
                    ),
                }
            )
        )

    if not raw_output:
        # A success with no body is still a success, and saying so is not the old lie: this
        # line is now reachable ONLY when no failure was recorded.
        raw_output = json.dumps({"performed": action_tool_name, "detail": ""})

    _record_connector_audit("success", None)
    wrapped = wrap_untrusted_tool_result(matched_conn.name, action_tool_name, raw_output)
    return ToolResult(result=wrapped)


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
        if "__" in tool_name:
            service_id, action_tool_name = tool_name.split("__", 1)
            return await _handle_connector_chat_tool(service_id, action_tool_name, args, ctx)
        return ToolResult(result=f"Unknown tool: {tool_name}")
    return await handler(args, ctx)

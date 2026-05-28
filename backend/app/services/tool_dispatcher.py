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
from app.services.sandbox_service import sandbox_manager, harvest_output_files
from app.config import settings, _SUB_AGENT_MODEL_DEFAULTS
from app.services.sql_service import query_documents
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
    folder_subtree_ids: set[str] | None
    scoped_folder_path: str | None
    emit: Callable[..., Awaitable[None]]  # reference to _emit
    spawn: Callable  # reference to _spawn
    model: str = ""  # user's selected model (for sub-agent routing)
    previous_files_in_run: dict | None = None  # sandbox output file tracking across execute_code calls
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


async def _handle_load_skill(args: dict, ctx: ToolContext) -> ToolResult:
    skill_name = args.get("skill_name", "")
    # Emit skill_activated SSE event immediately (SKIL-12)
    await ctx.emit(ctx.redis, ctx.run_id, 'skill_activated', skill_name=skill_name)
    # Resolve skill -- prefer user-owned over global when names conflict
    _skill_resp = await aexec(
        ctx.supabase.table("skills")
        .select("id, name, description, instructions, user_id")
        .or_(f"user_id.eq.{ctx.current_user['id']},is_global.eq.true")
        .eq("name", skill_name)
        .eq("is_enabled", True)
        .order("is_global")
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
    return ToolResult(result=json.dumps({
        "name": row["name"],
        "instructions": row["instructions"],
        "files": file_names,
    }))


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
    if existing:
        row = existing
        await aexec(
            ctx.supabase.table("skills").update({
                "description": description,
                "instructions": instructions,
            }).eq("id", row["id"]).eq("user_id", ctx.current_user["id"])
        )
        return ToolResult(result=json.dumps({"status": "updated", "name": name}))
    else:
        await aexec(
            ctx.supabase.table("skills").insert({
                "user_id": ctx.current_user["id"],
                "name": name,
                "description": description,
                "instructions": instructions,
            })
        )
        return ToolResult(result=json.dumps({"status": "created", "name": name}))


async def _handle_read_skill_file(args: dict, ctx: ToolContext) -> ToolResult:
    skill_name = args.get("skill_name", "")
    filename = args.get("filename", "")
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
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

        if ext == "docx":
            import docx as _docx  # python-docx
            doc = _docx.Document(io.BytesIO(raw_bytes))
            tool_result = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        elif ext == "xlsx":
            import openpyxl as _openpyxl
            wb = _openpyxl.load_workbook(io.BytesIO(raw_bytes), read_only=True, data_only=True)
            rows = []
            for sheet in wb.worksheets:
                for row_data in sheet.iter_rows(values_only=True):
                    line = "\t".join(str(c) if c is not None else "" for c in row_data)
                    if line.strip():
                        rows.append(line)
            tool_result = "\n".join(rows)
        elif ext == "pptx":
            from pptx import Presentation as _Presentation  # python-pptx
            prs = _Presentation(io.BytesIO(raw_bytes))
            slides = []
            for slide in prs.slides:
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text.strip():
                        slides.append(shape.text)
            tool_result = "\n".join(slides)
        elif ext in {"txt", "md", "py", "csv", "json", "yaml", "yml", "toml", "html", "xml", "rst", "log"}:
            tool_result = raw_bytes.decode("utf-8", errors="replace").replace('\x00', '')
        else:
            # Unrecognized or binary type
            tool_result = json.dumps({
                "error": f"File '{filename}' is a binary file that cannot be read as text. "
                         "Upload a text-based version instead."
            })
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
    # Emit start event (SAND-04)
    await ctx.emit(ctx.redis, ctx.run_id, 'code_execution_start', code_preview=code[:200])

    # Use the previous_files_in_run dict from ctx for cross-call file tracking
    _previous_files_in_run = ctx.previous_files_in_run if ctx.previous_files_in_run is not None else {}

    try:
        session = sandbox_manager.get_or_create(ctx.thread_id)
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

        # Ensure /sandbox/output exists
        try:
            session.execute_command("mkdir -p /sandbox/output")
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
            session.copy_to_runtime(_local_tmp_path, code_file)
        finally:
            try:
                _os_local.unlink(_local_tmp_path)
            except OSError:
                pass

        # Install libraries
        if libraries:
            try:
                session.install(libraries=libraries)
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

        while True:
            try:
                item = await asyncio.wait_for(sandbox_queue.get(), timeout=_HEARTBEAT_INTERVAL_S)
            except asyncio.TimeoutError:
                now = time_mod.time()
                if now - _last_output_at >= _HEARTBEAT_INTERVAL_S:
                    elapsed = now - start_time
                    await ctx.emit(ctx.redis, ctx.run_id, 'code_executing',
                                   tool_index=_tool_index, elapsed_seconds=round(elapsed, 1))
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
        llm_content = json.dumps({
            "status": exec_status,
            "exit_code": actual_exit_code,
            "duration_ms": duration_ms,
            "output_files": [{"filename": f["filename"], "size": f["size"]} for f in output_file_list],
            "stdout": exec_result.stdout or "",
            "stderr": exec_result.stderr or "",
        })
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

    # Pre-DB validation — fast-fail with a friendly LLM-readable error before
    # any pool acquire so a malformed payload never trips the transaction.
    for t in todos_in:
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
    # Phase 085 — D-085 new tools (write_todos = Plan 01; task + ask_user = Plans 02/03)
    "write_todos": _handle_write_todos,
}


async def dispatch_tool(tool_name: str, args: dict, ctx: ToolContext) -> ToolResult:
    """Route a tool call to its handler. Unknown tools return an error string."""
    handler = _TOOL_REGISTRY.get(tool_name)
    if handler is None:
        return ToolResult(result=f"Unknown tool: {tool_name}")
    return await handler(args, ctx)

"""Phase 084 workspace tools: ``workspace_write`` / ``read`` / ``list`` / ``delete`` / ``diff``, plus
the ``_normalize_optional*`` argument normalisers (``tools/documents.py`` imports
``_normalize_optional_int`` by name).

Moved VERBATIM out of ``tool_dispatcher.py`` in Phase 278 (SEAM-03, a pure move): every binding
here is AST-identical to its PHASE_BASE source, proven by ``tests/unit/test_278_pure_move.py``.
``tool_dispatcher.py`` keeps the registry: it imports the handlers below BY NAME into its static
``_TOOL_REGISTRY`` literal (Extension Contract — never registered dynamically).

⚠ PATCH-WHERE-USED: the bodies in this module resolve these names from THIS module's globals —
``ws_write_file``, ``ws_read_file``, ``ws_list_files``, ``ws_delete_file``, ``ws_get_diff``,
``WorkspaceError``. Patch ``app.services.tools.workspace.<name>``; a patch of the same name on
``tool_dispatcher`` no longer reaches the code that calls it (and, because the registry module no
longer imports them, raises ``AttributeError`` instead of silently patching nothing).

⛔ Import-cycle rule: no module-level import of ``app.services.tool_dispatcher`` here (the
dispatcher imports this module at load). Cross-family helpers are imported BY NAME from their
``app.services.tools.<family>`` home, never through the dispatcher.
"""
from __future__ import annotations

import json
from uuid import UUID

from app.services.workspace_service import (
    write_file as ws_write_file,
    read_file as ws_read_file,
    list_files as ws_list_files,
    delete_file as ws_delete_file,
    get_diff as ws_get_diff,
    WorkspaceError,
)
from app.services.tools.base import ToolContext, ToolResult


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

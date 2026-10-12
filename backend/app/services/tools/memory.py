"""Memory tools: ``remember``, ``recall`` and ``query_tables``.

Moved VERBATIM out of ``tool_dispatcher.py`` in Phase 278 (SEAM-03, a pure move): every binding
here is AST-identical to its PHASE_BASE source, proven by ``tests/unit/test_278_pure_move.py``.
``tool_dispatcher.py`` keeps the registry: it imports the handlers below BY NAME into its static
``_TOOL_REGISTRY`` literal (Extension Contract — never registered dynamically).

⚠ PATCH-WHERE-USED: the bodies in this module resolve these names from THIS module's globals —
``aexec``, ``write_audit_entry``. Patch ``app.services.tools.memory.<name>``; a patch of the same
name on ``tool_dispatcher`` no longer reaches the code that calls it (and, because the registry
module no longer imports them, raises ``AttributeError`` instead of silently patching nothing).

⛔ Import-cycle rule: no module-level import of ``app.services.tool_dispatcher`` here (the
dispatcher imports this module at load). Cross-family helpers are imported BY NAME from their
``app.services.tools.<family>`` home, never through the dispatcher.
"""
from __future__ import annotations

import json
import logging

from app.utils.db import aexec
from app.services.audit_service import write_audit_entry
from app.services.tools.base import ToolContext, ToolResult

logger = logging.getLogger(__name__)


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

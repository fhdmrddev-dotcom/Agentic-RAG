"""Tool dispatch registry for the agent_runner loop.

Extracted from threads.py (Phase 083, G-5 mandated refactor). Each tool has a
handler function that receives (args, ctx) and returns a ToolResult. The caller
in threads.py constructs a ToolContext once per iteration and delegates all
tool-specific logic through dispatch_tool().

Adding a new tool requires only:
  1. Write an async _handle_<name>(args, ctx) -> ToolResult
  2. Register it in _TOOL_REGISTRY
  3. threads.py is untouched.

Phase 278 (SEAM-03, 2026-10-13) — the registry/handler split is DONE. This module is now the
registry only: the back-compat re-exports, the handler imports, the static ``_TOOL_REGISTRY``
literal, the whitelist refusal audit, the capability gate and ``dispatch_tool``. Every handler
moved VERBATIM into ``app/services/tools/<family>.py`` (``tests/unit/test_278_pure_move.py``), so
step 1 above now means: write the handler in the ``tools/`` family module it belongs to, then
import it BY NAME here. The registry stays a static dict literal (Extension Contract — never
built by import order, mutation or dynamic registration; ``tests/unit/test_278_registry_pin.py``).
"""
from __future__ import annotations

import json
import logging
from typing import Callable

# Phase 147 (FLAG-01 / D-04 layer 2 REFUSE) — the refuse gate reads the SAME
# last-known-good TTL settings cache the get_tools hide layer reads. Module-level
# (patch-where-used friendly) and cycle-safe: user_settings imports only app.config.
from app.models.user_settings import load_app_settings

# ── Back-compat re-exports (Phase 278, D-04) ─────────────────────────────────────────────────
# These names moved; measured importers still read them from HERE, so they stay importable and are
# the SAME objects as in their new homes (pinned by test_278_pure_move::test_back_compat_reexports_are_the_same_objects):
#   agent_loop / threads / task_service / harness/phase_types / models/harness   ToolContext, ToolResult
#   app/api/skills.py:37                                                          SCRIPT_EXTS
#   agent_loop.py:82                                                              _attachment_container_path
# ⚠ A PATCH of one of these names HERE no longer reaches the code that calls it — patch the
#   tools/<family> module that now resolves it (patch-where-used).
from app.services.tools.base import ToolContext, ToolResult  # noqa: F401 — re-export (and used below)
from app.services.tools.runtime_gap import SCRIPT_EXTS  # noqa: F401 — re-export only (app/api/skills.py)
from app.services.tools.sandbox import _attachment_container_path  # noqa: F401 — re-export only (agent_loop.py)

# Handlers, imported BY NAME so the `_TOOL_REGISTRY` dict literal below stays byte-identical
# to PHASE_BASE (Extension Contract: a static literal, never built by import order or mutation).
from app.services.tools.documents import (
    _handle_ls,
    _handle_tree,
    _handle_grep,
    _handle_glob,
    _handle_read_document,
    _handle_query_documents,
    _handle_web_search,
    _handle_analyze_document,
    _handle_query_documents_by_view,
    _handle_get_related_documents,
    _handle_fetch_document_file,
)
from app.services.tools.skills import (
    _handle_load_skill,
    _handle_save_skill,
    _handle_read_skill_file,
    _handle_attach_skill_file,
)
from app.services.tools.sandbox import _handle_execute_code
from app.services.tools.render_template import _handle_render_template
from app.services.tools.workspace import (
    _handle_workspace_write,
    _handle_workspace_read,
    _handle_workspace_list,
    _handle_workspace_delete,
    _handle_workspace_diff,
)
from app.services.tools.memory import (
    _handle_remember,
    _handle_recall,
    _handle_query_tables,
)
from app.services.tools.agent_control import (
    _handle_write_todos,
    _handle_task,
    _handle_ask_user,
)
# Phase 272 (D-15) — handler moved to search_documents_tool.py; registry/handler split still OWED (→273)
# ⚠ CORRECTED 2026-10-13 (Phase 278, SEAM-03): the split is no longer owed — every other handler now
#   lives in app/services/tools/<family>.py; this module is unchanged.
from app.services.search_documents_tool import handle_search_documents as _handle_search_documents
# Phase 273 (D-14) — show_artifact handler in its own module; registry/handler split still OWED (OV-273-02)
# ⚠ CORRECTED 2026-10-13 (Phase 278, SEAM-03): OV-273-02 is discharged — the registry/handler split
#   is done (app/services/tools/); this import is unchanged.
from app.services.show_artifact_tool import handle_show_artifact as _handle_show_artifact
# dispatch_tool resolves the namespaced-connector fallback as a module global of THIS module.
from app.services.tools.connector import _handle_connector_chat_tool

logger = logging.getLogger(__name__)


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
    # Phase 273 (D-01 / D-14) — registry + get_tools BOTH; handler in show_artifact_tool.py, one line here
    "show_artifact": _handle_show_artifact,
}

# Phase 267 (PACK-21 / D-267-01) — `EXPERT_CORE_TOOLS` and `EXPERT_DELIVERABLE_TOOLS` were DELETED
# here, with their module-scope registry asserts. They were a second encoding of the tool set that
# `run_producer` used to FILTER an Expert thread's advertised tools (15 of 28 chat tools stripped,
# and every connector schema dropped by a bare-slug vs namespaced-name mismatch). An Expert now only
# ever ADDS: it gets the plain thread's tools plus its own approved connections and skills. Deleted
# rather than kept as documentation, so no dead constant can look live.
# ⚠ OWED, NOT BUILT: chat has no dispatch-side whitelist — `dispatch_tool`'s only refusal backstop
# is `ctx.phase_whitelist`, which is None on a chat run. Deferred to SEED-303 (267-CONTEXT).


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

"""Phase 306 (D-26 / D-27 / D-28 / D-02) — the tool set of an OUTSIDE-started run. A LEAF.

An outside run is one started by an AI tool through a member's MCP key (``ask_agent``). It may
only search and read documents, on every provider path, and it stays that way for every later turn
on its thread (a member's in-app Continue of a cap-paused ask included).

Two seams read this module, and neither edits the agent loop:
  · Seam A — ``search_vocabulary.with_search_vocabulary`` calls ``narrow_schemas`` first, so the
    schemas a provider is OFFERED are the allow-listed ones (OpenAI-compatible, Anthropic, Google
    and the STRUCTURED prose list all read ``active_tools``).
  · Seam B — ``tool_dispatcher.dispatch_tool`` calls ``outside_allowlist_for`` first, so a name the
    model was never offered (a hallucinated name, a power tool, a ``svc__tool`` connector, an
    unknown name) is REFUSED before any handler or registry lookup runs.

This module imports nothing from ``app.`` at module level, on purpose: ``tool_dispatcher`` and
``search_vocabulary`` both import it, and ``narrow_schemas`` imports ``get_tools`` function-locally
(the search_vocabulary idiom), so no cycle can form.

THE RULES
  · ``ASK_TOOL_ALLOWLIST`` is an ALLOW-list and a code constant (D-27, D-02). A tool added to the
    product later is OUT of an outside run until someone adds it here on purpose.
  · The ONLY setter of ``_allow`` is ``outside_run_context``, which builds a FRESH
    ``contextvars.Context`` (never a copy of the caller's): nothing from the MCP request context (the
    usage collector, the edge principal, LangSmith state) rides into a long-lived run. A static
    fence (``tests/unit/test_306_outside_run_scope.py``) fails if any other module names ``_allow``.
  · The narrowed list is NEVER empty: ``active_tools or get_tools(...)`` downstream reads ``[]`` as
    "every tool" (Pitfall 2), so an empty narrowing raises ``OutsideToolsetEmpty`` instead.
  · ``get_tools`` is never filtered (Pitfall 1): ``tool_parser._KNOWN_TOOLS`` and
    ``context_window._TOOL_SCHEMA_TOKENS`` are built from the first ``get_tools()`` call of a
    worker, and narrowing there would poison them for every in-app run on that worker.
  · The DURABLE half (D-28): with the ContextVar unset, a chat-run dispatch (``phase_whitelist`` is
    None) of a non-listed name on a thread whose ``threads.origin_kind`` is ``'mcp'`` is refused too.
    The origin is frozen at INSERT by migration 223's trigger, so the answer is cached per thread id
    (safe across uvicorn workers: every worker reads the same immutable fact — D-PRD-12). A read
    ERROR refuses (fail closed) and is NOT cached; no pool, or a thread id that is not a UUID, is a
    literal no-op (no read, no refusal).
"""

from __future__ import annotations

import json
import logging
import uuid
from contextvars import Context, ContextVar
from typing import Any

logger = logging.getLogger(__name__)

# D-27. Six walled read tools. ``search_documents`` is the citation and confidence source; ``ls`` /
# ``tree`` / ``grep`` / ``glob`` / ``read_document`` read through the folder wall.
#   OUT on evidence: ``get_related_documents`` ignores the folder scope (``ctx.folder_subtree_ids``
#   is never threaded into it), so it would read past a narrowed key; ``analyze_document`` makes an
#   LLM sub-call whose tokens are recorded nowhere, so its spend would be missing (D-18). Every
#   other registry name writes, reaches out, pauses for a person or steers toward other tools.
ASK_TOOL_ALLOWLIST: frozenset[str] = frozenset(
    {"search_documents", "ls", "tree", "grep", "glob", "read_document"}
)
assert ASK_TOOL_ALLOWLIST, "an empty allow-list reads as EVERY tool downstream (Pitfall 2)"

_allow: ContextVar[frozenset[str] | None] = ContextVar("outside_run_tool_allowlist", default=None)

OUTSIDE_TOOL_REFUSAL = (
    "This chat was started from an AI tool, so the agent can only search and read documents "
    "here. {tool} isn't available."
)
REFUSAL_ERROR = "tool_not_available_for_outside_ask"

# D-28: thread id (canonical str) -> "this thread's frozen origin is 'mcp'". Bounded; cleared when
# full. Only SUCCESSFUL reads are stored.
_ORIGIN_CACHE_MAX = 4096
_origin_is_mcp: dict[str, bool] = {}


class OutsideToolsetEmpty(RuntimeError):
    """A narrowing left no tool. Raised rather than returning ``[]`` (which means EVERY tool)."""


def outside_run_context(allow: frozenset[str] | set[str]) -> Context:
    """A FRESH context carrying only the allow-list — the ONLY setter of ``_allow``.

    Pass it as ``asyncio.create_task(..., context=outside_run_context(...))``: the producer, its
    child tasks and ``run_in_threadpool`` / ``to_thread`` hops all see the value; the caller does not.
    """
    frozen = frozenset(allow)
    if not frozen:
        raise OutsideToolsetEmpty("an outside run needs at least one allowed tool")
    ctx = Context()
    ctx.run(_allow.set, frozen)
    return ctx


def current_allowlist() -> frozenset[str] | None:
    """The allow-list of the current outside run, or None (= not an outside run; a literal no-op)."""
    return _allow.get()


def _schema_name(tool: Any) -> str | None:
    fn = tool.get("function") if isinstance(tool, dict) else None
    name = fn.get("name") if isinstance(fn, dict) else None
    return name if isinstance(name, str) else None


def narrow_schemas(active_tools: list | None, user_settings: Any) -> list | None:
    """Seam A. None when not an outside run (the caller keeps its list, byte-identical).

    Otherwise the allow-listed schemas of ``active_tools`` (or of ``get_tools(user_settings)`` when
    it is None), order kept, every kept entry the same object. Never ``[]``.
    """
    allow = _allow.get()
    if allow is None:
        return None
    if active_tools is None:
        from app.services.openai_service import get_tools  # noqa: PLC0415 — leaf: no module-level app import

        base = list(get_tools(user_settings))
    else:
        base = list(active_tools)
    out = [t for t in base if _schema_name(t) in allow]
    if not out:
        raise OutsideToolsetEmpty("no allow-listed tool is offered to this outside run")
    return out


def refusal_payload(tool_name: str) -> str:
    """The plain refusal ``ToolResult.result`` string (provider-agnostic, like the phase refusal)."""
    return json.dumps({
        "error": REFUSAL_ERROR,
        "tool": tool_name,
        "message": OUTSIDE_TOOL_REFUSAL.format(tool=tool_name),
    })


def _canonical_thread_id(thread_id: Any) -> str | None:
    if thread_id is None:
        return None
    try:
        return str(uuid.UUID(str(thread_id)))
    except (ValueError, TypeError, AttributeError):
        return None


async def _read_origin_kind(pool: Any, thread_id: str) -> str | None:
    """One read of the frozen origin (mig 223). Raises on any failure — the caller fails closed."""
    return await pool.fetchval(
        "SELECT origin_kind FROM public.threads WHERE id = $1", uuid.UUID(thread_id)
    )


async def outside_allowlist_for(ctx: Any, tool_name: str) -> frozenset[str] | None:
    """Seam B. The allow-list that binds this dispatch, or None (= no outside restriction).

    The ContextVar wins when set. Otherwise only a chat-run dispatch (``phase_whitelist`` None) of a
    NON-listed name, with a pool and a UUID thread id, reads the thread's frozen origin (D-28).
    """
    allow = _allow.get()
    if allow is not None:
        return allow
    if tool_name in ASK_TOOL_ALLOWLIST:
        return None  # a listed name is never refused, so it never needs the read
    if getattr(ctx, "phase_whitelist", None) is not None:
        return None  # a workflow phase has its own whitelist branch; unchanged
    pool = getattr(ctx, "pool", None)
    thread_id = _canonical_thread_id(getattr(ctx, "thread_id", None))
    if pool is None or thread_id is None:
        return None
    cached = _origin_is_mcp.get(thread_id)
    if cached is None:
        try:
            origin = await _read_origin_kind(pool, thread_id)
        except Exception:  # noqa: BLE001 — fail closed; never cached
            logger.warning(
                "outside_run_scope: the thread origin could not be read; refusing %s (fail closed)",
                tool_name, exc_info=True,
            )
            return ASK_TOOL_ALLOWLIST
        cached = origin == "mcp"
        if len(_origin_is_mcp) >= _ORIGIN_CACHE_MAX:
            _origin_is_mcp.clear()
        _origin_is_mcp[thread_id] = cached
    return ASK_TOOL_ALLOWLIST if cached else None

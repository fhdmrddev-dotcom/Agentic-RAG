"""Phase 304 (KEY-03, KEY-04; D-11, D-12, D-28) — the MCP tool catalogue and the MCP URL.

ONE backend code constant names every tool an MCP key can be granted, its group, its label and the
tools that travel with it. The frontend reads it through ``GET /api-keys`` and never retypes it;
305's server registers exactly these names; a key's ``tools`` column holds a normalised subset.
Static and code-authored: no user text reaches a tool name, label or description.

Groups (D-11): **read** — ``search_knowledge_base``, ``list_documents``, ``read_document``;
**ask** — ``ask_agent``, ``get_answer``; **run** — ``list_workflows``, ``run_workflow``,
``get_workflow_run``. Companions (D-12): ``get_answer`` travels with ``ask_agent`` (an answer is
fetched for a question the key asked); ``list_workflows`` and ``get_workflow_run`` travel with
``run_workflow`` (you cannot start what you cannot list, or follow what you started).

Presets (D-12): Read only (the default, pre-selected), Read and ask, Read, ask and run workflows.
Ask and run are never ticked by default (KEY-04).

``mcp_url()`` (D-28) is the one place the MCP endpoint address is built: ``BACKEND_PUBLIC_URL`` +
``MCP_PATH``. 305 confirms the canonical path per deployment topology and edits ONLY ``MCP_PATH``.

Pure: nothing from ``app.`` at import time; ``mcp_url`` reads settings lazily (the
``inbound._public_api_base`` idiom).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Literal

ToolGroup = Literal["read", "ask", "run"]


@dataclass(frozen=True)
class McpTool:
    name: str
    group: ToolGroup
    label: str
    travels_with: str | None = None   # the lead tool this one is granted with, if any


MCP_TOOLS: tuple[McpTool, ...] = (
    McpTool("search_knowledge_base", "read", "Search your knowledge base"),
    McpTool("list_documents", "read", "List documents and folders"),
    McpTool("read_document", "read", "Read a document"),
    McpTool("ask_agent", "ask", "Ask the agent a question"),
    McpTool("get_answer", "ask", "Fetch the agent's answer", travels_with="ask_agent"),
    McpTool("list_workflows", "run", "List your workflows", travels_with="run_workflow"),
    McpTool("run_workflow", "run", "Start a workflow run"),
    McpTool("get_workflow_run", "run", "Check a workflow run", travels_with="run_workflow"),
)

MCP_TOOL_NAMES: frozenset[str] = frozenset(t.name for t in MCP_TOOLS)

_ORDER = {t.name: i for i, t in enumerate(MCP_TOOLS)}
_LEAD = {t.name: t.travels_with for t in MCP_TOOLS if t.travels_with}
_COMPANIONS: dict[str, tuple[str, ...]] = {
    lead: tuple(t.name for t in MCP_TOOLS if t.travels_with == lead) for lead in set(_LEAD.values())
}


@dataclass(frozen=True)
class Preset:
    key: str
    label: str
    tools: tuple[str, ...]


def _group_tools(*groups: ToolGroup) -> tuple[str, ...]:
    return tuple(t.name for t in MCP_TOOLS if t.group in groups)


PRESETS: dict[str, Preset] = {
    "read": Preset("read", "Read only", _group_tools("read")),
    "ask": Preset("ask", "Read and ask", _group_tools("read", "ask")),
    "run": Preset("run", "Read, ask and run workflows", _group_tools("read", "ask", "run")),
}
DEFAULT_PRESET = "read"

EMPTY_SELECTION_SENTENCE = "Tick at least one tool."


@dataclass(frozen=True)
class ToolSelection:
    """``tools`` (catalogue order, companions added) when the selection is valid; otherwise
    ``refusal``, one plain sentence the key form shows as-is."""

    tools: tuple[str, ...] | None
    refusal: str | None = None


def normalise_tool_selection(names: Iterable[str]) -> ToolSelection:
    """Validate a ticked tool list and add each present lead's companions (D-12).

    Refused, each with one sentence: an empty list, a name the catalogue does not have, and a
    companion ticked without its lead (it would grant a tool with nothing to act on).
    """
    picked = list(dict.fromkeys(str(n) for n in names))
    if not picked:
        return ToolSelection(tools=None, refusal=EMPTY_SELECTION_SENTENCE)
    unknown = [n for n in picked if n not in MCP_TOOL_NAMES]
    if unknown:
        return ToolSelection(
            tools=None, refusal=f"There is no tool called {unknown[0]!r}. Pick from the list."
        )
    chosen = set(picked)
    for name in picked:
        lead = _LEAD.get(name)
        if lead is not None and lead not in chosen:
            return ToolSelection(
                tools=None,
                refusal=f"{name!r} only works with {lead!r}. Tick {lead!r} as well, or untick it.",
            )
    for name in list(chosen):
        chosen.update(_COMPANIONS.get(name, ()))
    return ToolSelection(tools=tuple(sorted(chosen, key=_ORDER.__getitem__)))


MCP_PATH = "/mcp"


def mcp_public_base() -> str | None:
    """The public base MCP is served under, or ``None`` when this deployment must not serve it.

    Phase 305 (D-49 / R-08 / T-305-20) — the ONE refuse-mount predicate. ``register_mcp`` mounts
    nothing (and logs CRITICAL) when it returns ``None``, and ``mcp_url()`` returns ``None`` through
    it, so the key screen shows "no address" rather than an address that answers 404.

    ``None`` when ``BACKEND_PUBLIC_URL`` is unset — and, in production only, when its host is
    loopback or its scheme is not ``https`` (an AI tool on another machine cannot reach a loopback
    base, and a key must never travel over plain http). Outside production a loopback base is
    served as-is (the 304 pin in ``test_304_tool_catalogue``).
    """
    from urllib.parse import urlsplit  # noqa: PLC0415

    from app.config import settings  # noqa: PLC0415 — lazy: this module stays importable bare

    base = str(getattr(settings, "backend_public_url", "") or "").strip().rstrip("/")
    if not base:
        return None
    from app.api.api_docs import is_production_environment  # noqa: PLC0415

    if is_production_environment():
        from app.api.inbound import _is_loopback  # noqa: PLC0415

        if _is_loopback(base) or urlsplit(base).scheme.lower() != "https":
            return None
    return base


def mcp_url() -> str | None:
    """The address an MCP client connects to, or ``None`` when this deployment does not serve MCP.

    Decision (pinned in ``test_304_tool_catalogue``): outside production a LOOPBACK base is served
    as-is. Unlike ``inbound._public_api_base`` there is no request here to swap it for, and on a
    local stack a client on the same machine reaches exactly that address. A deployed stack sets
    ``BACKEND_PUBLIC_URL`` (it is also the OAuth redirect base). Phase 305: built through
    ``mcp_public_base()``, the same predicate that decides whether ``/mcp`` is mounted at all.
    """
    base = mcp_public_base()
    if base is None:
        return None
    return base + MCP_PATH

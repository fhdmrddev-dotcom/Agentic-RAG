"""Phase 305 (MCP-01; D-20 / D-23 / D-47) — what the MCP server can serve.

A ``ToolSpec`` is one tool: its static, code-authored definition (name, title, description,
annotations, input schema), the Pydantic model its arguments are validated against, the handler
that runs it, and the per-key limit bucket it counts against. No user text reaches a tool's name,
title or description.

``REGISTERED`` is the only registry the server reads, built from ``_SPECS``. 305-01 ships it empty
(the transport, edge and pipeline are proven with test-registered specs); 305-02 adds the three
read tools (``search_knowledge_base``, ``list_documents``, ``read_document``) to ``_SPECS``. It is
NOT the chat agent's tool registry (``tool_dispatcher``) and never imports it (D-03 / D-45).

``READ_ONLY`` is the annotation every read tool carries. The maintenance guard in ``dispatch``
refuses any tool whose annotations are not read-only while maintenance is on (D-25).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Literal

from mcp import types
from pydantic import BaseModel

Bucket = Literal["cheap", "expensive"]

READ_ONLY = types.ToolAnnotations(
    read_only_hint=True,
    destructive_hint=False,
    idempotent_hint=True,
    open_world_hint=False,
)


@dataclass(frozen=True)
class ToolSpec:
    tool: types.Tool
    args_model: type[BaseModel]
    handler: Callable[[Any, BaseModel], Awaitable[types.CallToolResult]]
    bucket: Bucket = "cheap"


def is_read_only(spec: ToolSpec) -> bool:
    """True only when the tool's own annotations say read-only (a missing hint is NOT read-only)."""
    annotations = spec.tool.annotations
    return bool(annotations is not None and annotations.read_only_hint is True)


_SPECS: tuple[ToolSpec, ...] = ()

REGISTERED: dict[str, ToolSpec] = {spec.tool.name: spec for spec in _SPECS}

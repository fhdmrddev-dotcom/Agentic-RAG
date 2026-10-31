"""Phase 305 (MCP-01, MCP-07; D-21 / D-24 / D-25 / D-47) — the ``tools/call`` pipeline.

Every branch returns a ``CallToolResult`` with one plain sentence, except the maintenance refusal,
which is a JSON-RPC error (``MCPError``) carrying ``MAINTENANCE_SENTENCE``. Exceptions are caught
one level up, in ``server.on_call_tool``, and become ``GENERIC_FAILURE_SENTENCE`` — never
``str(exc)`` (T-305-16).

The FINAL order, once 305-02..305-04 have inserted their stages (305-RESEARCH's diagram, a..l):

    a. unknown / unregistered name -> JSON-RPC -32602         (server.on_call_tool)
    b. not granted                 -> isError "This key can't use ..."          [305-01]
    c. maintenance + not read-only -> MCPError(MAINTENANCE_SENTENCE)            [305-01]
    d. argument validation         -> isError plain sentence                     [305-01]
    e. per-key bucket (cheap/expensive) -> isError "...too many..."              [305-03]
    f. the service call (acting_member_reads on the acting connection)          [305-02]
    g. shape (Pydantic result model)                                             [305-02]
    h. hygiene (defang)                                                          [305-02]
    i. outbound guard (redaction; fail closed)                                   [305-04]
    j. render text from the redacted model                                       [305-02]
    k. audit (api_key.read / api_key.refused, throttled)                         [305-03]
    l. catch-all -> GENERIC_FAILURE_SENTENCE                  (server.on_call_tool)

305-01 ships b, c and d, then calls the spec's handler.

The grant is re-checked HERE, at call time (D-21): ``tools/list`` already hides an ungranted tool,
but a client can call a name it never listed. The maintenance flag is read through
``middleware.maintenance._read_maintenance`` — the HTTP write-block's own reader, never a second one.
"""
from __future__ import annotations

from typing import Any

from mcp import types
from mcp.shared.exceptions import MCPError
from pydantic import ValidationError

from app.mcp import tools as _tools
from app.middleware import maintenance as _maintenance

GENERIC_FAILURE_SENTENCE = "Something went wrong reading your documents. Try again."
MAINTENANCE_SENTENCE = (
    "Syrel is in maintenance mode, so this tool can't start anything right now. "
    "Searching and reading still work."
)
MAINTENANCE_ERROR_CODE = -32000


def tool_error(sentence: str) -> types.CallToolResult:
    """The one shape of a tool-level refusal: one text block, ``isError`` true."""
    return types.CallToolResult(content=[types.TextContent(type="text", text=sentence)], is_error=True)


async def dispatch(principal: Any, name: str, arguments: dict | None) -> types.CallToolResult:
    """Run one granted, registered tool for ``principal``. ``name`` is a registered code constant
    by the time it reaches here (``server.on_call_tool`` refuses anything else)."""
    spec = _tools.REGISTERED[name]
    if name not in principal.tools:
        return tool_error(f"This key can't use {name}.")
    if not _tools.is_read_only(spec) and _maintenance._read_maintenance():
        raise MCPError(code=MAINTENANCE_ERROR_CODE, message=MAINTENANCE_SENTENCE)
    try:
        args = spec.args_model.model_validate(arguments or {})
    except ValidationError:
        return tool_error(f"Those arguments don't fit {name}. Check the tool's inputs and try again.")
    return await spec.handler(principal, args)

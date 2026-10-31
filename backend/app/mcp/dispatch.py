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

305-01 ships b, c and d, then calls the spec's handler. 305-02 ships f, g, h and j: the handler
(``app.mcp.read_tools``) returns a result MODEL (already shaped and defanged) or a refusal
SENTENCE; ``_finish`` turns a sentence into one ``isError`` block and a model into
``structuredContent`` (validated against the same model, D-18) plus the text rendered FROM the
model (``results.render``). The slots the later plans fill, in this function:

    305-03 limits  -> before ``spec.handler(...)``
    305-04 outbound guard (redaction, fail closed) -> between the handler and ``_finish``
    305-03 audit   -> after ``_finish`` produced the result

The grant is re-checked HERE, at call time (D-21): ``tools/list`` already hides an ungranted tool,
but a client can call a name it never listed. The maintenance flag is read through
``middleware.maintenance._read_maintenance`` — the HTTP write-block's own reader, never a second one.

305-03 (D-26 / D-27 / D-28 / D-53 / T-305-12) fills e and k. **Exactly one audit row per call, on
every exit path**: each stage sets the row it would write in ``audit`` and the ``finally`` writes it
once — refused (grant, maintenance, limit) through ``app.mcp.audit.audit_refused`` (throttled), an
answered call (a model or a handler's refusal sentence) as ``outcome: ok``, and bad arguments or a
handler that raised as ``outcome: error`` (the exception still propagates to the catch-all). The
limit stage counts the spec's bucket (``app.mcp.limits``) and answers over the limit with a
relayable sentence, never an HTTP 429. The per-key counters and the refusal throttle share the
app's Redis (``get_redis``); a caller may pass its own.
"""
from __future__ import annotations

from typing import Any

from mcp import types
from mcp.shared.exceptions import MCPError
from pydantic import BaseModel, ValidationError

from app.dependencies import get_redis
from app.mcp import audit as _audit
from app.mcp import limits as _limits
from app.mcp import results as _results
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


async def dispatch(
    principal: Any, name: str, arguments: dict | None, *, redis: Any = None
) -> types.CallToolResult:
    """Run one granted, registered tool for ``principal``. ``name`` is a registered code constant
    by the time it reaches here (``server.on_call_tool`` refuses anything else)."""
    redis = redis if redis is not None else get_redis()
    spec = _tools.REGISTERED[name]
    # The ONE row this call writes; a stage that exits sets it. Anything that raises before a stage
    # sets it (the handler, the render) leaves ``error``.
    audit: dict = {"refused": False, "outcome": "error"}
    try:
        if name not in principal.tools:
            audit = {"refused": True, "reason": "tool_not_granted"}
            return tool_error(f"This key can't use {name}.")
        if not _tools.is_read_only(spec) and _maintenance._read_maintenance():
            audit = {"refused": True, "reason": "maintenance"}
            raise MCPError(code=MAINTENANCE_ERROR_CODE, message=MAINTENANCE_SENTENCE)
        try:
            args = spec.args_model.model_validate(arguments or {})
        except ValidationError:
            return tool_error(f"Those arguments don't fit {name}. Check the tool's inputs and try again.")
        limited = await _limits.check_limit(principal, spec, redis)
        if limited is not None:
            audit = {"refused": True, "reason": limited.reason,
                     "detail": {"limit": limited.limit} if limited.limit is not None else None}
            return tool_error(limited.sentence)
        outcome = await spec.handler(principal, args)
        # [305-04 outbound guard slot: redact ``outcome`` here, before anything is rendered]
        result = _finish(outcome)
        audit = {"refused": False, "outcome": "ok"}
        return result
    finally:
        if audit["refused"]:
            await _audit.audit_refused(principal, tool=name, reason=audit["reason"], redis=redis,
                                       detail=audit.get("detail"))
        else:
            await _audit.audit_answered(principal, tool=name, outcome=audit["outcome"])


def _finish(outcome: Any) -> types.CallToolResult:
    if isinstance(outcome, types.CallToolResult):
        return outcome
    if isinstance(outcome, str):
        return tool_error(outcome)
    if isinstance(outcome, BaseModel):
        structured = outcome.model_dump(mode="json")
        type(outcome).model_validate(structured)  # structuredContent MUST conform to outputSchema
        return types.CallToolResult(
            content=[types.TextContent(type="text", text=_results.render(outcome))],
            structured_content=structured,
            is_error=False,
        )
    raise TypeError(f"a tool handler returned {type(outcome).__name__}")

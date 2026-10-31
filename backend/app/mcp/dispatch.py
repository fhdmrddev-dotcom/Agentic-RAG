"""Phase 305 (MCP-01, MCP-07; D-21 / D-24 / D-25 / D-47) — the ``tools/call`` pipeline.

Every branch returns a ``CallToolResult`` with one plain sentence, except the maintenance refusal,
which is a JSON-RPC error (``MCPError``) carrying ``MAINTENANCE_SENTENCE``. Exceptions are caught
one level up, in ``server.on_call_tool``, and become ``GENERIC_FAILURE_SENTENCE`` — never
``str(exc)`` (T-305-16).

The FINAL order, once 305-02..305-04 have inserted their stages (305-RESEARCH's diagram, a..l):

    a. unknown / unregistered name -> JSON-RPC -32602         (server.on_call_tool)
    b. not granted                 -> isError "This key can't use ..."          [305-01]
    c. maintenance + not read-only -> MCPError(MAINTENANCE_SENTENCE)            [305-01]
    d. per-key bucket (cheap/expensive) -> isError "...too many..."              [305-03]
    e. argument validation         -> isError plain sentence                     [305-01]
       (305-REVIEW WR-01: counted BEFORE validation, so bad-argument calls cost their bucket)
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

305-03 (D-29 / D-55 / GUARD-02 / T-305-14) — spend. An ``expensive`` tool (the search) runs inside
``usage_sink.collecting()``; whatever the provider calls measured (``embed_texts`` records the
query embedding, ``read_tools`` an unmeasured rerank) becomes one ``mcp_usage`` row each, written
on the service-role pool with the principal's org (``db/mcp_usage``). A search that recorded
nothing still writes ONE row, with the member's embedding model and provider and NULL tokens, so
search-only usage is never missing from spend and never priced at zero. ``failed`` when the
handler raised. A write failure is logged and never fails the call.

305-04 (D-32 / D-34 / D-35 / D-56 / GUARD-03) fills i. Every handler MODEL passes
``services.outbound_guard.guard`` — the one choke point — with the org's switch read live per call
(``_pii_on``, the principal's org, the service-role pool). Off: the model is untouched. On: only
``RedactableText`` fields are rewritten and the text is rendered FROM the redacted model, so the
structure and the text cannot diverge; a read chunk carries its 128-char overlap window
(``results.window_of``). ``WITHHELD`` (the redactor raised or ran past 2 s) answers the D-35
sentence as a tool error and audits ``outcome: redaction_blocked``. A handler's refusal SENTENCE is
a fixed string and is not guarded.
"""
from __future__ import annotations

import logging
from typing import Any

from mcp import types
from mcp.shared.exceptions import MCPError
from pydantic import BaseModel, ValidationError
from starlette.concurrency import run_in_threadpool

from app.db import outbound_policy
from app.db.mcp_usage import insert_usage
from app.dependencies import get_pg_pool, get_redis
from app.models.user_settings import load_user_settings
from app.services import outbound_guard, usage_sink
from app.services.openai_service import resolve_effective_embedding_provider
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

logger = logging.getLogger("app.mcp")


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
        # 305-REVIEW WR-01: the limit counts BEFORE the arguments are validated, so every granted
        # call — bad arguments included — costs one unit of its bucket. A loop of bad-argument
        # calls is then stopped by the per-key limit and its refusals go through the CR-02 throttle.
        limited = await _limits.check_limit(principal, spec, redis)
        if limited is not None:
            audit = {"refused": True, "reason": limited.reason,
                     "detail": {"limit": limited.limit} if limited.limit is not None else None}
            return tool_error(limited.sentence)
        try:
            args = spec.args_model.model_validate(arguments or {})
        except ValidationError:
            return tool_error(f"Those arguments don't fit {name}. Check the tool's inputs and try again.")
        outcome = await _run(spec, principal, name, args)
        if isinstance(outcome, BaseModel):
            # 305-04 (D-32 / D-35 / D-56): the ONE outbound choke point, before anything is rendered.
            outcome = await outbound_guard.guard(
                outcome, org_id=principal.org_id, is_on=_pii_on, window=_results.window_of(outcome)
            )
            if outcome is outbound_guard.WITHHELD:
                audit = {"refused": False, "outcome": "redaction_blocked"}
                return tool_error(outbound_guard.WITHHELD_SENTENCE)
        result = _finish(outcome)
        audit = {"refused": False, "outcome": "ok"}
        return result
    finally:
        if audit["refused"]:
            await _audit.audit_refused(principal, tool=name, reason=audit["reason"], redis=redis,
                                       detail=audit.get("detail"))
        else:
            await _audit.audit_answered(principal, tool=name, outcome=audit["outcome"])


async def _pii_on(org_id: str) -> bool | None:
    """The org's redaction switch, read LIVE on the service-role pool for every call (305-04).
    Any failure here propagates into ``outbound_guard.guard``, which treats it as ON."""
    return await outbound_policy.pii_redaction_enabled(await get_pg_pool(), org_id)


async def _run(spec: Any, principal: Any, name: str, args: BaseModel) -> Any:
    """Run the handler; an ``expensive`` one inside a usage collection that is written to spend."""
    if spec.bucket != "expensive":
        return await spec.handler(principal, args)
    status = "failed"
    with usage_sink.collecting() as entries:
        try:
            outcome = await spec.handler(principal, args)
            status = "completed"
            return outcome
        finally:
            await _write_usage(principal, name, list(entries), status)


async def _write_usage(principal: Any, name: str, entries: list[dict], status: str) -> None:
    try:
        settings = None
        if not entries or any(e.get("model") is None or e.get("provider") is None for e in entries):
            settings = await run_in_threadpool(load_user_settings, principal.user_id)
        if not entries:  # nothing was measured: one honest unmeasured row, never a missing one
            entries = [{"model": None, "provider": None, "prompt_tokens": None}]
        pool = await get_pg_pool()
        for entry in entries:
            model = entry.get("model") or (settings.embedding_model if settings else None) or "unknown"
            provider = entry.get("provider") or (
                resolve_effective_embedding_provider(settings) if settings else None
            ) or "unknown"
            await insert_usage(
                pool, org_id=principal.org_id, user_id=principal.user_id,
                api_key_id=principal.key_id, tool=name, model=model, provider=provider,
                input_tokens=entry.get("prompt_tokens"), status=status,
            )
    except Exception:  # noqa: BLE001 — a spend write must never fail the call
        logger.warning("mcp usage write failed (tool=%s)", name, exc_info=True)


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

"""Google provider-gateway adapter (Phase 092.5 Wave 2, GATEWAY-01 / D-01).

CLEAN MOVE — mirrors anthropic.py exactly (the live ``_on_chunk_google`` is
documented as "structurally a copy of the Anthropic branch", agent_loop.py
:1566-1573). ``stream_google`` (google_service.py:381) ALREADY yields the
canonical event dicts, INCLUDING the base64 ``thought_signature`` on
``finish.tool_calls[]`` (google_service.py:510-517 / :611-615) — the I2 / D-07
Gemini-3 round-trip invariant.

This adapter is a stream-CONSTRUCTION move: it lifts the inline kwargs-assembly
from agent_loop.py:1537-1561 VERBATIM and returns the bare ``stream_google``
generator UNTOUCHED. DO NOT re-shape the events (RESEARCH anti-pattern —
skeleton-diff risk for no gain).

I2 / D-07 SEAM (preserved by leaving it consumer-side): the
``thought_signature`` HYDRATION onto ``tool_calls_buffer`` (agent_loop.py
:1638-1647) mutates a CONSUMER accumulator, so it STAYS in the consumer's shared
``_on_chunk`` finish-branch (Task 2). This adapter only EMITS the ``finish``
event carrying ``tool_calls[].thought_signature`` — which ``stream_google``
already does. Do NOT move the buffer mutation here.

Sync-generator boundary (byte-identical RED LINE): ``stream_google`` is a SYNC
generator; the consumer drains it via ``_drain_stream_with_close_on_cancel`` and
closes it via ``close_fn=stream.close`` (agent_loop.py:1649-1655). This adapter
returns the bare generator so the close semantics are identical.

SC#3 — NO IMPORT CYCLE: imports only from ``google_service`` / ``openai_service``
(BELOW the gateway). NEVER imports ``agent_loop`` / ``threads.py``.
``stream_google`` is imported into THIS module's namespace so tests patch it HERE
(``app.services.provider_gateway.google.stream_google``) — the monkeypatch
repoint off ``app.services.agent_loop.stream_google`` (Task 3).
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Generator

# The raw-SDK boundary this adapter WRAPS (does not reimplement). Imported into
# this namespace so the seam + integration tests patch it HERE (Task 3 repoint).
from app.services.google_service import stream_google

# Phase 101.1 (D-05): the Gemini forcing shape (mode=ANY) is built from the SAME
# ``types`` module google_service uses — import it here so the forcing translation
# is self-contained at the adapter boundary.
from google.genai import types

# Inline at agent_loop.py:1537 today — SAME source, moves with the construction.
from app.services.openai_service import _resolve_max_tokens, get_tools

from app.config import settings

if TYPE_CHECKING:  # pragma: no cover
    from .dispatcher import GatewayRequest


def open_google_stream(request: "GatewayRequest") -> Generator[dict, None, None]:
    """Assemble the ``stream_google`` kwargs from the request envelope and return
    its (sync) canonical-event generator VERBATIM.

    The body is the inline assembly lifted from agent_loop.py:1537-1561:
      - ``_resolve_max_tokens(None, user_settings)``
      - api_key = ``user_settings.llm_api_key or settings.llm_api_key or ""``
      - tools  = ``active_tools if active_tools is not None else get_tools(user_settings)``
    """
    user_settings = request.user_settings
    _g_max_tokens = _resolve_max_tokens(None, user_settings)
    _g_api_key = (
        (getattr(user_settings, "llm_api_key", None) or "")
        or settings.llm_api_key
        or ""
    )
    _g_tools = request.tools if request.tools is not None else get_tools(user_settings)
    # Phase 101.1 (D-05 — TIER-FORCE): a forced emit injects function_calling_config
    # mode=ANY + allowed_function_names=[<emitter>] so Gemini MUST call the named tool.
    # ADDITIVE — when ``force_tool_name`` is unset, ``tool_config=None`` keeps the auto
    # path byte-identical (automatic_function_calling stays disabled either way).
    _g_tool_config = (
        types.ToolConfig(
            function_calling_config=types.FunctionCallingConfig(
                mode="ANY",
                allowed_function_names=[request.force_tool_name],
            )
        )
        if request.force_tool_name
        else None
    )
    return stream_google(
        messages=request.messages,
        tools=_g_tools,
        system_prompt=request.system_prompt,
        model=request.model,
        api_key=_g_api_key,
        max_tokens=_g_max_tokens,
        force_no_tools=request.force_no_tools,
        tool_config=_g_tool_config,
    )

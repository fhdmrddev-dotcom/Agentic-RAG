"""Anthropic provider-gateway adapter (Phase 092.5 Wave 2, GATEWAY-01 / D-01).

CLEAN MOVE — ``stream_anthropic`` (anthropic_service.py:152) ALREADY yields the
canonical event dicts (its docstring :6-14 IS the schema). This adapter is a
stream-CONSTRUCTION move: it lifts the inline kwargs-assembly that lived at
agent_loop.py:1398-1422 (api_key resolution + ``_resolve_max_tokens`` +
tool-select) VERBATIM and returns the bare ``stream_anthropic`` generator.

DO NOT re-shape the events "for consistency" (RESEARCH anti-pattern — they are
already the canonical template; touching them risks a Wave-3 SSE skeleton diff
for no gain). The adapter passes the generator straight through.

Sync-generator boundary (byte-identical RED LINE): ``stream_anthropic`` is a
SYNC generator (``Generator[dict, None, None]``); the consumer's
``_drain_stream_with_close_on_cancel`` drives it with ``for chunk in stream:``
in a threadpool and closes it via ``close_fn=stream.close`` on timeout (the
load-bearing sync-generator close, agent_loop.py:1522-1527). This adapter
returns the bare ``stream_anthropic`` generator UNTOUCHED so the consumer binds
``close_fn`` to the SAME ``.close`` it does today — the close semantics are
identical.

SC#3 — NO IMPORT CYCLE: imports only from ``anthropic_service`` /
``openai_service`` (BELOW the gateway in the dep graph) and the dispatcher's
``GatewayRequest``. NEVER imports ``agent_loop`` / ``threads.py``.

``stream_anthropic`` is imported into THIS module's namespace so tests patch it
HERE (``app.services.provider_gateway.anthropic.stream_anthropic``) — the
monkeypatch-target repoint off ``app.services.agent_loop.stream_anthropic``
(Task 3).
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Generator

# The raw-SDK boundary this adapter WRAPS (does not reimplement). Imported into
# this namespace so the seam + integration tests patch it HERE (Task 3 repoint).
from app.services.anthropic_service import stream_anthropic

# Inline at agent_loop.py:1398 today — SAME source, moves with the construction.
from app.services.openai_service import _resolve_max_tokens, get_tools

from app.config import settings

if TYPE_CHECKING:  # pragma: no cover
    from .dispatcher import GatewayRequest


def open_anthropic_stream(request: "GatewayRequest") -> Generator[dict, None, None]:
    """Assemble the ``stream_anthropic`` kwargs from the request envelope and
    return its (sync) canonical-event generator VERBATIM.

    The body is the inline assembly lifted from agent_loop.py:1398-1422:
      - ``_resolve_max_tokens(None, user_settings)`` (Anthropic max_tokens, GEN-02)
      - api_key = ``user_settings.llm_api_key or settings.llm_api_key or ""``
      - tools  = ``active_tools if active_tools is not None else get_tools(user_settings)``
    """
    user_settings = request.user_settings
    _ant_max_tokens = _resolve_max_tokens(None, user_settings)
    _ant_api_key = (
        (getattr(user_settings, "llm_api_key", None) or "")
        or settings.llm_api_key
        or ""
    )
    _ant_tools = request.tools if request.tools is not None else get_tools(user_settings)
    # Phase 101.1 (D-05 — TIER-FORCE-NOTHINK): a forced emit names the emitter tool so
    # Anthropic MUST call it (``{"type":"tool","name":<emitter>}``). emit forces
    # thinking OFF — forcing ERRORS under extended thinking (D-05); this adapter never
    # enables thinking, so the resting state is already correct. When ``force_tool_name``
    # is unset, ``tool_choice=None`` is passed and ``stream_anthropic`` keeps its :177
    # force_no_tools/auto resolution byte-identically (Deep unchanged).
    _ant_tool_choice = (
        {"type": "tool", "name": request.force_tool_name}
        if request.force_tool_name
        else None
    )
    return stream_anthropic(
        messages=request.messages,
        tools=_ant_tools,
        system_prompt=request.system_prompt,
        model=request.model,
        api_key=_ant_api_key,
        max_tokens=_ant_max_tokens,
        force_no_tools=request.force_no_tools,
        tool_choice=_ant_tool_choice,
    )

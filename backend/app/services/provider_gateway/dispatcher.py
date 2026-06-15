"""Thin provider-gateway dispatcher entrypoint (D-01 / D-02).

``open_stream(provider, request) -> (AsyncIterator[GatewayEvent], CallingMode)``
mirrors ``create_adaptive_streaming_chat``'s existing ``(stream, calling_mode)``
contract (openai_service.py:1197-1205) so the consumer destructures the same
shape it does today (Pitfall 3 / L-3: ``calling_mode`` rides ALONGSIDE the
stream, never as an event — dropping it is the exact bug that makes the harness
OpenAI-only).

This plan (092.5-01) ships the SIGNATURE + the provider->adapter routing
skeleton + the ``GatewayRequest`` envelope ONLY. The adapter bodies land in
later waves:
  - Wave 2: anthropic + google adapters (clean stream-construction moves)
  - Wave 4: openai_compat adapter (the high-risk entangled unit, D-04)
Until then the routing branches raise ``NotImplementedError`` — the seam test
(Task 3) asserts against this SHAPE and the wave adapters fill the bodies.

DO NOT wire ``agent_loop`` to call this yet (that is Wave 2).

SC#3 — NO IMPORT CYCLE: this module re-exports ``CallingMode`` from
``app.services.openai_service`` (BELOW it in the dep graph) and will import the
raw-SDK service modules in later waves. It MUST NEVER import ``agent_loop`` /
``threads.py`` (the callable-injection seam stays intact; ``_emit`` / ``spawn``
stay passed-in callables consumer-side).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, AsyncIterator

# Re-export the EXISTING CallingMode enum — do NOT define a new one (Pitfall 3).
# openai_service is below the gateway in the dependency graph (no cycle).
from app.services.openai_service import CallingMode

from .events import GatewayEvent

if TYPE_CHECKING:  # consumer-side type only; never imported at runtime (no cycle)
    from app.models.user_settings import UserEffectiveSettings


@dataclass
class GatewayRequest:
    """The request envelope the consumer fills; Waves 2/4 destructure it inside
    each adapter.

    Carries the union of fields the 3 stream constructions need today:
      - Anthropic: agent_loop.py:1415-1422 (messages, tools, system_prompt,
        model, api_key, max_tokens, force_no_tools)
      - Google:    agent_loop.py:1553-1561 (same shape)
      - OpenAI:    agent_loop.py:1659-1665 (messages, model, user_settings,
        tool_choice, tools_override) -> create_adaptive_streaming_chat

    ``active_provider_name`` is the routing/usage/boundary-dict key the OpenAI
    adapter keys on (agent_loop.py:1747-1748).
    """

    messages: list[dict]
    model: str
    active_provider_name: str
    # ``tools`` carries the consumer's ``active_tools`` value VERBATIM — including
    # its ``None`` signal ("no override → fall back to get_tools(user_settings)").
    # The Anthropic/Google adapters do the exact live select
    # ``active_tools if active_tools is not None else get_tools(user_settings)``
    # (agent_loop.py:1401 / :1540) so the tool-select moves with the construction
    # byte-identically.
    tools: list[dict] | None = None
    system_prompt: str = ""
    force_no_tools: bool = False
    max_tokens: int | None = None
    api_key: str = ""
    user_settings: "UserEffectiveSettings | None" = None
    tool_choice: str = "auto"
    # Phase 101.1 (D-05 / D-14) — capability-tiered FORCING rides BESIDE tool_choice.
    # ADDITIVE: the SAFE defaults (force_tool_name=None, strict_schema=False) preserve
    # the byte-identical "auto" path — a consumer that does not set them (Deep, every
    # pre-101.1 caller) is unchanged. When ``force_tool_name`` is set, each native
    # adapter translates it to its provider's named-tool-forcing shape (RESEARCH §2);
    # ``strict_schema`` additionally requests a token-level guaranteed schema where the
    # provider supports it (OpenAI-compat strict ``response_format``). The forcing
    # translation lives ONLY in the 3 adapters — NEVER in the shared chunk/SSE path
    # (the D-14 RED LINE; the guard test asserts no ``if provider ==`` forcing branch
    # leaks into the consumer).
    force_tool_name: str | None = None
    strict_schema: bool = False


async def open_stream(
    provider: str,
    request: GatewayRequest,
) -> tuple[AsyncIterator[GatewayEvent], CallingMode]:
    """Pick the adapter by ``provider`` and return its canonical event stream +
    the ``calling_mode`` the consumer needs post-drain.

    Routing mirrors the live branch logic at agent_loop.py:1396 / :1530 / :1657
    — ``anthropic`` and ``google`` are explicit branches; everything else is the
    OpenAI-compat ``else`` (OpenAI / OpenRouter / Ollama / native-7 fallbacks).
    Anthropic/Google return ``CallingMode.NATIVE``; the OpenAI-compat adapter
    surfaces the ``calling_mode`` ``create_adaptive_streaming_chat`` returns.

    Wave 2 (this plan): the anthropic + google adapters are live (clean
    stream-construction moves; they return the bare ``stream_*`` SYNC generator
    so the consumer's ``_drain_stream_with_close_on_cancel`` drives + closes it
    byte-identically). The openai_compat ``else`` branch stays a stub until
    Wave 4.
    """
    if provider == "anthropic":
        # Lazy import: keep the raw-SDK service module out of the dispatcher's
        # import-time graph (matches the consumer's inline-import pattern; the
        # adapter module imports anthropic_service, which is BELOW the gateway).
        from .anthropic import open_anthropic_stream

        return open_anthropic_stream(request), CallingMode.NATIVE
    elif provider == "google":
        from .google import open_google_stream

        return open_google_stream(request), CallingMode.NATIVE
    else:
        # OpenAI-compat else-branch (OpenAI / OpenRouter / Ollama / native-7
        # fallbacks) — Phase 092.5 Wave 4 (D-04, the entangled unit). The adapter
        # wraps create_adaptive_streaming_chat and SURFACES the calling_mode it
        # returns (Pitfall 3 / L-3 — never buried). It keys its internal
        # <think>/usage/boundary logic on ``request.active_provider_name`` (the
        # consumer populates that with the registry-derived provider for this
        # branch — agent_loop.py:1667-1668 — so the move is byte-identical).
        from .openai_compat import open_openai_compat_stream

        return open_openai_compat_stream(request)

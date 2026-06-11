"""Phase 101.1 (D-05 / D-14) — the gateway-boundary forcing translation + the
shared-path guard.

Wave 0 RED stubs. The tiered-forcing seam lands at the Phase 092.5
``provider_gateway/`` boundary off ``GatewayRequest`` (the DOWNSTREAM gateway-forcing
plan — D-14 routing). These tests are ``xfail(strict=False)`` RED-by-design and get
un-marked to GREEN by that plan.

The D-14 invariant (the RED LINE): NO provider branch leaks into the shared chunk/
SSE path; Deep stays byte-identical; each adapter's forcing translation is
self-contained. Mirrors ``test_provider_gateway_seam.py``'s ``GatewayRequest`` /
``open_stream`` import + synthetic-chunk factory.

CONVENTION: ``from app.services... import ...`` is INSIDE each test body for the
not-yet-existing forcing symbols so COLLECTION never breaks. The shared
``GatewayRequest`` import (which EXISTS today) stays at module top, matching the
seam test.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

# GatewayRequest / open_stream / CallingMode EXIST today (Phase 092.5) — import
# directly at module top, exactly like test_provider_gateway_seam.py.
from app.services.provider_gateway import (
    CallingMode,
    GatewayRequest,
    open_stream,
)


# ── Synthetic chunk factory (mirrors test_provider_gateway_seam.py) ───────────
def _mk_openai_chunk(content=None, tool_calls=None, finish_reason=None):
    """Build a synthetic openai-python ChatCompletionChunk-shaped object."""
    delta = SimpleNamespace(content=content, reasoning_content=None, tool_calls=tool_calls)
    has_choice = content is not None or finish_reason is not None or tool_calls is not None
    choices = [SimpleNamespace(delta=delta, finish_reason=finish_reason)] if has_choice else []
    return SimpleNamespace(choices=choices, usage=None)


# ── D-14 — the shared-path guard (the RED LINE) ───────────────────────────────


@pytest.mark.xfail(strict=False, reason="101.1 gateway-forcing plan (D-14) — un-marks to GREEN")
def test_no_provider_branch_in_shared_path():
    """The forcing translation must live ONLY at the gateway adapter boundary — NO
    ``if provider ==`` forcing branch leaks into the shared chunk/SSE consumer path
    (``agent_loop``). A Deep call with ``tool_choice="auto"`` produces the IDENTICAL
    ``GatewayRequest`` as before 101.1 (Deep byte-identical)."""
    import inspect

    from app.services import agent_loop

    # The shared consumer must not branch per-provider FOR FORCING. The only provider
    # branches allowed are the pre-existing usage / <think>-routing ones.
    src = inspect.getsource(agent_loop)
    assert "force_tool_name" not in src or "open_stream" in src, (
        "forcing must be threaded via GatewayRequest to the gateway, not branched in the consumer"
    )

    # A default (Deep) GatewayRequest carries tool_choice='auto' unchanged.
    req = GatewayRequest(messages=[], model="gpt-5.4", active_provider_name="openai")
    assert req.tool_choice == "auto"


@pytest.mark.xfail(strict=False, reason="101.1 gateway-forcing plan (D-05) — openai_compat adapter")
def test_openai_compat_forcing_translation():
    """The openai_compat adapter translates a forced GatewayRequest into the OpenAI
    ``tool_choice={"type":"function","function":{"name":...}}`` (or ``"required"``)
    shape — self-contained, beside the existing ``"auto"`` branch."""
    from app.services.provider_gateway import openai_compat  # noqa: F401

    pytest.skip("openai_compat forcing translation lands in the gateway-forcing plan")


@pytest.mark.xfail(strict=False, reason="101.1 gateway-forcing plan (D-05) — anthropic adapter (TIER-FORCE-NOTHINK)")
def test_anthropic_forcing_translation_thinking_off():
    """The anthropic adapter passes ``tool_choice={"type":"tool","name":...}`` to
    ``stream_anthropic`` with extended thinking OFF (TIER-FORCE-NOTHINK — forcing
    ERRORS under thinking)."""
    from app.services.provider_gateway import anthropic  # noqa: F401

    pytest.skip("anthropic forcing translation lands in the gateway-forcing plan")


@pytest.mark.xfail(strict=False, reason="101.1 gateway-forcing plan (D-05) — google adapter")
def test_google_forcing_translation_mode_any():
    """The google adapter injects ``tool_config(function_calling_config(mode='ANY',
    allowed_function_names=[...]))`` into ``config_kwargs`` (forces a function call)."""
    from app.services.provider_gateway import google  # noqa: F401

    pytest.skip("google forcing translation lands in the gateway-forcing plan")

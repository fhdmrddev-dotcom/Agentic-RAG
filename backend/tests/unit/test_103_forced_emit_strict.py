"""Phase 103 (REQ-2 / WFAUTH-02 / Pitfall 1) — the additive ``strict`` override on
``forced_emit`` is DEFAULT-PRESERVING (byte-identical for emit/judge) and lets the
authoring shot force strict OFF on a strict-capable provider.

RESEARCH Pitfall 1 / Open Q1 (RESOLVED → this task): ``forced_emit`` derives the
gateway ``strict_schema`` flag from ``cap.get("strict_json_schema")``. For OpenAI /
DeepSeek (``strict_json_schema:True``) the openai-compat adapter sets ``"strict":
true`` on the function def, which requires EVERY property in ``required`` — but the
``WorkflowDefinition`` authoring schema is optional-heavy, so a strict forced shot
would 400. The fix is an ADDITIVE ``strict: bool | None = None`` kwarg:

  - ``strict=None`` (default) → the existing cap-derived value, BYTE-IDENTICAL for
    every existing caller (the emit deliverable + the judge never pass it).
  - ``strict=False`` → the gateway is told NOT to set ``"strict": true`` (the
    forcing-without-strict path the authoring shot uses).
  - ``strict=True`` → reserved (not used by 103).

These assert at the GATEWAY BOUNDARY: ``open_stream`` is patched (the substrate
drives it ONCE) and the ``GatewayRequest.strict_schema`` the substrate built is
captured. No live provider, no agent loop (D-01 / feedback_mock_completeness).

CONVENTION (Phase 102 posture): ``from app.services...`` imports INSIDE each test body.
"""

from __future__ import annotations

import json

import pytest


def _tool_call_stream(emitter: str, field_map: dict):
    """A NATIVE stream that committed the forced tool call (the happy path)."""
    return [
        {
            "type": "finish",
            "finish_reason": "tool_calls",
            "tool_calls": [
                {"id": "call_1", "name": emitter, "arguments": json.dumps(field_map)}
            ],
        },
        {"type": "usage", "input_tokens": 10, "output_tokens": 20},
    ]


# A minimal valid EmitFieldMap (the default schema_model the substrate validates
# against when schema_model=None) — so the happy path yields emitted != None and the
# strict_schema we captured is the value that REACHED the gateway.
_VALID_FM = {
    "scalars": [
        {
            "key": "project_name",
            "value": "Meridian",
            "source_chunk_id": "chunk-1",
            "source_doc": "brief.docx",
            "source_page": 1,
        }
    ],
    "rows": [],
}


@pytest.fixture()
def _patch_gateway(monkeypatch):
    """Patch the gateway ``open_stream`` the substrate drives so the forced shot is a
    deterministic synthetic stream; capture the ``GatewayRequest`` it built (so we can
    read ``request.strict_schema``). Mirrors ``test_forced_emit._patch_gateway``."""
    import app.services.forced_emit as fe

    state: dict = {"events": [], "request": None, "provider": None, "calling_mode": None}

    async def _fake_open_stream(provider, request):
        from app.services.provider_gateway import CallingMode

        state["request"] = request
        state["provider"] = provider
        cm = state["calling_mode"] or CallingMode.NATIVE
        return iter(state["events"]), cm

    monkeypatch.setattr(fe, "open_stream", _fake_open_stream)
    return state


def _patch_strict_capable(monkeypatch):
    """Mock a STRICT-capable FORCE-tier model cap (the OpenAI/DeepSeek shape): the
    cap-derived strict is True, so strict=None must propagate True and strict=False
    must override it to False."""
    import app.services.forced_emit as fe

    monkeypatch.setattr(
        fe,
        "get_model_capability",
        lambda model: {
            "forced_emission": True,
            "strict_json_schema": True,
            "provider": "openai",
        },
    )


async def _run(state, *, strict, emitter="render_template", model="gpt-5.4"):
    from app.services.forced_emit import forced_emit

    state["events"] = _tool_call_stream(emitter, _VALID_FM)
    return await forced_emit(
        messages=[{"role": "user", "content": "fill the template"}],
        model=model,
        provider="openai",
        emitter=emitter,
        tools=[{"function": {"name": emitter, "parameters": {}}}],
        user_settings=None,
        strict=strict,
    )


@pytest.mark.asyncio
async def test_strict_none_byte_identical(_patch_gateway, monkeypatch):
    """strict=None (the default) yields the SAME strict_schema value the cap-derived
    path produced before this change — byte-identical for every existing caller.

    With a strict-capable cap (strict_json_schema:True), the gateway must receive
    strict_schema=True — exactly what ``bool(cap.get("strict_json_schema", False))``
    yielded pre-change."""
    _patch_strict_capable(monkeypatch)
    res = await _run(_patch_gateway, strict=None)
    assert res["emitted"] is not None  # the shot succeeded → the captured request is the real one
    # The cap-derived strict (True) reached the gateway, unchanged by the None default.
    assert _patch_gateway["request"].strict_schema is True


@pytest.mark.asyncio
async def test_strict_false_overrides(_patch_gateway, monkeypatch):
    """strict=False on a strict-capable model overrides the cap → strict_schema=False
    reaches the gateway (no ``"strict": true`` on the function def — the authoring shot
    path that avoids the OpenAI/DeepSeek 400)."""
    _patch_strict_capable(monkeypatch)
    res = await _run(_patch_gateway, strict=False)
    assert res["emitted"] is not None
    assert _patch_gateway["request"].strict_schema is False


@pytest.mark.asyncio
async def test_strict_true_overrides(_patch_gateway, monkeypatch):
    """strict=True forces strict ON even when the cap derives False (reserved; proves
    the override is symmetric and not merely a one-way disable)."""
    import app.services.forced_emit as fe

    # A FORCE-tier model whose cap-derived strict is FALSE.
    monkeypatch.setattr(
        fe,
        "get_model_capability",
        lambda model: {
            "forced_emission": True,
            "strict_json_schema": False,
            "provider": "openai",
        },
    )
    res = await _run(_patch_gateway, strict=True)
    assert res["emitted"] is not None
    assert _patch_gateway["request"].strict_schema is True


@pytest.mark.asyncio
async def test_emit_caller_unchanged(_patch_gateway, monkeypatch):
    """A representative EXISTING emit caller (which never passes ``strict``) is
    unaffected: the default arg means the cap-derived strict flows to the gateway
    exactly as today (the byte-identical posture for the emit deliverable + the judge).
    """
    _patch_strict_capable(monkeypatch)
    from app.services.forced_emit import forced_emit

    _patch_gateway["events"] = _tool_call_stream("render_template", _VALID_FM)
    # Call WITHOUT the strict kwarg — exactly how phase_types / publish_service call it.
    res = await forced_emit(
        messages=[{"role": "user", "content": "fill the template"}],
        model="gpt-5.4",
        provider="openai",
        emitter="render_template",
        tools=[{"function": {"name": "render_template", "parameters": {}}}],
        user_settings=None,
    )
    assert res["emitted"] is not None
    # The cap-derived strict (True) reached the gateway — no behavior change for callers
    # that do not pass the new kwarg.
    assert _patch_gateway["request"].strict_schema is True

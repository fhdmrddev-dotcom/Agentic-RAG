"""Phase 101.1 (TMPL-02 / D-06 / D-08) — the forced-emit substrate contract.

Plan 101.1-02 (Wave 2) un-marks these from the Wave-0 RED stubs to GREEN. The
production substrate (``backend/app/services/forced_emit.py``) runs a SEALED single
forced shot through the provider gateway (NEVER the open agent loop — D-01 /
Pitfall 5), recovers a still-narrated emission on the NATIVE path (D-06), and
rejects a truncated half-object (D-08 layer 4).

D-06: a still-NARRATED emission on the NATIVE path is parsed back (a fenced object
matching the schema) OR the run fails HONESTLY — NEVER silently dropped (the GAP-D
fix). D-08 layer 4: a truncated emission (``stop_reason=max_tokens`` /
``finish_reason=length``) is rejected BEFORE acceptance (never a "valid" empty
field-map masquerading as "no data found").

CONVENTION: ``from app.services... import ...`` is INSIDE each test body so a
not-yet-existing symbol never breaks COLLECTION.
"""

from __future__ import annotations

import json

import pytest


# ── synthetic forced-shot streams (one sealed call → a list of gateway events) ─


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


def _narrated_stream(field_map: dict):
    """A NATIVE stream where the model NARRATED the field-map as fenced JSON instead
    of committing the tool call (the GAP-D reasoning-native failure)."""
    narrated = "Here is the field map:\n\n```json\n" + json.dumps(field_map) + "\n```\n"
    return [
        {"type": "delta", "content": narrated},
        {"type": "finish", "finish_reason": "stop", "tool_calls": []},
    ]


def _unrecoverable_stream():
    """A NATIVE stream with prose that has NO fenced object — must fail honestly."""
    return [
        {"type": "delta", "content": "I cannot produce that from the provided sources."},
        {"type": "finish", "finish_reason": "stop", "tool_calls": []},
    ]


def _truncated_stream():
    """A forced shot cut off at the output-token limit (half-object)."""
    return [
        {"type": "delta", "content": '{"scalars": [{"key": "a", "value": "b"'},
        {"type": "finish", "finish_reason": "length", "tool_calls": []},
    ]


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


# ── D-06 narrated-JSON recovery (the unit the substrate composes) ─────────────


def test_native_recovery_or_honest_fail():
    """On the NATIVE path, when the model NARRATES a fenced JSON object instead of
    committing the forced tool call, the substrate parses it back into a validated
    ``EmitFieldMap`` (D-06 recovery) OR fails honestly — it is NEVER silently dropped.
    """
    from app.services.forced_emit import recover_narrated_emission

    narrated = "Here is the field map you asked for:\n\n```json\n" + json.dumps(_VALID_FM) + "\n```\n"

    recovered = recover_narrated_emission(narrated)
    # Recovered into the validated flat shape (D-06) — NOT silently dropped.
    assert recovered is not None
    assert recovered.scalars[0].value == "Meridian"

    # An un-recoverable narration (no fenced object) must fail honestly, not return
    # an empty "success" field-map.
    assert recover_narrated_emission("I cannot produce that.") is None
    # A fenced object that does NOT validate as an EmitFieldMap is also a clean None
    # (never a half-built object masquerading as success).
    assert recover_narrated_emission("```json\n{\"not\": \"a field map\"}\n```") is None


def test_truncation_rejected():
    """A forced emission cut off at the output-token limit (``stop_reason=max_tokens``
    / ``finish_reason=length``) is REJECTED before acceptance — never accepted as a
    valid (but half-empty) field-map. Reuses the shipped ``is_truncated`` guard."""
    from app.services.template_render_service import is_truncated

    assert is_truncated(stop_reason="max_tokens") is True
    assert is_truncated(finish_reason="length") is True
    assert is_truncated(stop_reason="tool_use") is False
    assert is_truncated(finish_reason="tool_calls") is False


# ── the sealed forced shot (forced_emit) — drives open_stream ONCE ────────────


@pytest.fixture()
def _patch_gateway(monkeypatch):
    """Patch the gateway ``open_stream`` the substrate drives so the forced shot is a
    deterministic synthetic stream. Returns a setter for the per-test event list +
    a recorder of the GatewayRequest the substrate built."""
    import app.services.forced_emit as fe

    state: dict = {"events": [], "request": None, "provider": None, "calling_mode": None}

    async def _fake_open_stream(provider, request):
        from app.services.provider_gateway import CallingMode

        state["request"] = request
        state["provider"] = provider
        cm = state["calling_mode"] or CallingMode.NATIVE
        return iter(state["events"]), cm

    monkeypatch.setattr(fe, "open_stream", _fake_open_stream)
    # Phase 122 (MP-01): the tier is registry-driven via ``emit_tier``; force a
    # deterministic force_strict tier for the happy path (first rung = strict_force)
    # unless a test overrides it. ``forced_emission``/``strict_json_schema`` are kept
    # for the Phase-103 strict tests that still read the cap shape — but ``emit_tier``
    # is now what the ladder resolves on (the old bools are deprecated-unread, 122-01).
    monkeypatch.setattr(
        fe,
        "get_model_capability",
        lambda model: {
            "forced_emission": True,
            "strict_json_schema": True,
            "emit_tier": "force_strict",
            "provider": "openai",
        },
    )
    return state


async def _run(emitter="render_template", model="gpt-5.4"):
    from app.services.forced_emit import forced_emit

    return await forced_emit(
        messages=[{"role": "user", "content": "fill the template"}],
        model=model,
        provider="openai",
        emitter=emitter,
        tools=[{"function": {"name": emitter, "parameters": {}}}],
        user_settings=None,
    )


async def test_forced_emit_happy_path_tool_call(_patch_gateway):
    """A TIER-FORCE provider that committed the forced tool call yields a validated
    EmitFieldMap with forced=True, recovered_from_narration=False, no failure."""
    _patch_gateway["events"] = _tool_call_stream("render_template", _VALID_FM)
    res = await _run()
    assert res["emitted"] is not None
    assert res["emitted"].scalars[0].value == "Meridian"
    assert res["forced"] is True
    assert res["recovered_from_narration"] is False
    assert res["truncated"] is False
    assert res["failure"] is None
    # Phase 122 (MP-01): the success dict names the winning rung. A force_strict-tier
    # model that commits the tool call on the FIRST shot wins on the strict_force rung.
    assert res["emit_rung"] == "strict_force"
    # The forced shot named the tool — NOT tool_choice='auto' (Pitfall 5 / D-01).
    assert _patch_gateway["request"].force_tool_name == "render_template"


async def test_forced_emit_native_narration_recovered(_patch_gateway):
    """A reasoning-native that narrated the field-map (no tool call) is RECOVERED via
    the D-06 fenced-object parse — recovered_from_narration=True, not dropped."""
    _patch_gateway["events"] = _narrated_stream(_VALID_FM)
    res = await _run()
    assert res["emitted"] is not None
    assert res["emitted"].scalars[0].value == "Meridian"
    assert res["recovered_from_narration"] is True
    assert res["failure"] is None


async def test_forced_emit_unrecoverable_narration_honest_fail(_patch_gateway):
    """Narration with no fenced object fails HONESTLY (model_failed_to_emit) — never a
    silent empty field-map, never the prose accepted as the artifact (D-06 / GAP-D)."""
    _patch_gateway["events"] = _unrecoverable_stream()
    res = await _run()
    assert res["emitted"] is None
    assert res["failure"] == "model_failed_to_emit"


async def test_forced_emit_truncation_rejected(_patch_gateway):
    """A truncated forced shot (finish_reason=length) is rejected BEFORE acceptance
    (D-08 layer 4) — truncated=True, failure=model_failed_to_emit, never half-object."""
    _patch_gateway["events"] = _truncated_stream()
    res = await _run()
    assert res["truncated"] is True
    assert res["emitted"] is None
    assert res["failure"] == "model_failed_to_emit"


async def test_forced_emit_coerce_tier_no_force(_patch_gateway, monkeypatch):
    """A TIER-COERCE model (forced_emission absent / registry-miss) does NOT force —
    it sets tool_choice='auto' + a directive and hard-validates (D-05 TIER-COERCE).
    Even so, a committed tool call still validates (best-effort)."""
    import app.services.forced_emit as fe

    monkeypatch.setattr(
        fe, "get_model_capability", lambda model: {"emit_tier": "coerce", "provider": "moonshot"}
    )
    _patch_gateway["events"] = _tool_call_stream("render_template", _VALID_FM)
    res = await _run(model="kimi-k2.5")
    assert res["forced"] is False  # TIER-COERCE — never wrongly forces
    # The forced-tool field is NOT set on a coerce provider (tool_choice='auto').
    assert _patch_gateway["request"].force_tool_name is None
    assert _patch_gateway["request"].tool_choice == "auto"
    # A committed tool call still validates on the coerce path.
    assert res["emitted"] is not None
    # Phase 122 (MP-01): the only rung a coerce-tier model runs is "coerce".
    assert res["emit_rung"] == "coerce"


def test_forced_emit_never_calls_open_loop():
    """The substrate MUST NOT reference the open agent loop (run_task_sub_agent /
    run_agent_loop) — the emit is a sealed single shot (D-01 / Pitfall 5 / GAP-A)."""
    import inspect

    import app.services.forced_emit as fe

    src = inspect.getsource(fe)
    assert "run_task_sub_agent" not in src
    assert "run_agent_loop" not in src


# ── Phase 101.1-07 (gap 1b, layer 6 substrate half) — provider-error backstop ──
# A provider 400 (e.g. DeepSeek thinking+tool_choice) raised from open_stream/_drain
# must be CAUGHT and converted to an honest provider_error failure dict — never
# propagate as a silent escape to threads.py agent_runner (D-08 layer 6).


async def test_forced_emit_open_stream_raise_provider_error(monkeypatch):
    """When open_stream RAISES (a provider 400), forced_emit returns an honest
    provider_error failure dict — no exception escapes."""
    import app.services.forced_emit as fe

    async def _boom(provider, request):
        raise RuntimeError("400 Thinking mode does not support this tool_choice")

    monkeypatch.setattr(fe, "open_stream", _boom)
    monkeypatch.setattr(
        fe,
        "get_model_capability",
        lambda model: {"forced_emission": True, "emit_tier": "force", "provider": "deepseek"},
    )
    res = await _run(model="deepseek-v4")
    # Phase 122 (MP-01): a force-tier model whose EVERY rung (non_strict_force, coerce)
    # raises exhausts the ladder and lands on the honest provider_error floor — never
    # a silent escape.
    assert res["emitted"] is None
    assert res["failure"] == "provider_error"


async def test_forced_emit_drain_raise_provider_error(_patch_gateway, monkeypatch):
    """When the drain RAISES (provider stream error mid-flight), forced_emit likewise
    returns provider_error — never raises."""
    import app.services.forced_emit as fe

    def _boom(stream):
        raise RuntimeError("stream chunk decode error")

    monkeypatch.setattr(fe, "_drain", _boom)
    _patch_gateway["events"] = _tool_call_stream("render_template", _VALID_FM)
    res = await _run()
    assert res["emitted"] is None
    assert res["failure"] == "provider_error"


async def test_forced_emit_happy_path_unchanged(_patch_gateway):
    """The happy path (a clean forced shot) is UNCHANGED — still returns a validated
    EmitFieldMap with failure=None (the backstop only fires on a RAISED exception)."""
    _patch_gateway["events"] = _tool_call_stream("render_template", _VALID_FM)
    res = await _run()
    assert res["emitted"] is not None
    assert res["failure"] is None


# ── Phase 102-06 (CR-01) — the additive schema_model seam, driven UN-MOCKED ─────
# These tests do NOT mock _validate_args / recover_narrated_emission / the validate
# loop — only open_stream (via _patch_gateway). They prove the previously-hollow live
# judge path now flows a real verdict, AND that the default path is byte-identical.


_VALID_JUDGE_VERDICT = {
    "overall_passed": True,
    "overall_score": 88,
    "grounded_in_evidence": True,
    "answers_business_requirement": True,
    "did_the_work_not_delegated": True,
    "criteria": [
        {"criterion": "grounded", "passed": True, "score": 90, "evidence": "doc-1"}
    ],
    "summary": "Meets the requirement.",
}


def _judge_verdict_stream(field_map: dict):
    """A NATIVE stream that committed the forced `judge_verdict` tool call (the happy
    path) — mirrors `_tool_call_stream` but names the judge emitter + a JudgeVerdict
    payload."""
    return [
        {
            "type": "finish",
            "finish_reason": "tool_calls",
            "tool_calls": [
                {"id": "call_j", "name": "judge_verdict", "arguments": json.dumps(field_map)}
            ],
        },
        {"type": "usage", "input_tokens": 10, "output_tokens": 20},
    ]


async def test_forced_emit_judge_verdict_unmocked(_patch_gateway):
    """CR-01: a JudgeVerdict-shaped forced shot driven through forced_emit's REAL
    validate loop (Task 1's `_model.model_validate`) with `schema_model=JudgeVerdict`
    yields a non-None JudgeVerdict — the previously-hollow live judge path now flows a
    verdict. Only open_stream is mocked; the validate loop runs un-mocked."""
    from app.services.forced_emit import forced_emit
    from app.services.harness.validator_kinds import JudgeVerdict

    _patch_gateway["events"] = _judge_verdict_stream(_VALID_JUDGE_VERDICT)
    judge_tool = [
        {
            "type": "function",
            "function": {
                "name": "judge_verdict",
                "description": "Emit the structured quality verdict.",
                "parameters": JudgeVerdict.model_json_schema(),
            },
        }
    ]
    result = await forced_emit(
        messages=[{"role": "user", "content": "grade this output"}],
        model="gpt-5.5",
        provider="openai",
        emitter="judge_verdict",
        tools=judge_tool,
        user_settings=None,
        schema_model=JudgeVerdict,
    )
    assert result["emitted"] is not None
    assert isinstance(result["emitted"], JudgeVerdict)
    assert result["emitted"].overall_passed is True
    assert result["failure"] is None


async def test_forced_emit_default_still_emitfieldmap(_patch_gateway):
    """REGRESSION (CR-01 default byte-identity): with NO `schema_model`, a valid
    EmitFieldMap stream still validates to an EmitFieldMap (failure=None) — AND a
    JudgeVerdict-shaped payload with NO schema_model yields `emitted is None` (the OLD
    broken behavior is the CORRECT default — EmitFieldMap rejects a JudgeVerdict).
    Drives the real validate loop un-mocked."""
    from app.services.forced_emit import forced_emit
    from app.services.template_render_service import EmitFieldMap

    # 1. Default path: a valid EmitFieldMap stream validates byte-identically.
    _patch_gateway["events"] = _tool_call_stream("render_template", _VALID_FM)
    res = await forced_emit(
        messages=[{"role": "user", "content": "fill the template"}],
        model="gpt-5.5",
        provider="openai",
        emitter="render_template",
        tools=[{"function": {"name": "render_template", "parameters": {}}}],
        user_settings=None,
    )
    assert isinstance(res["emitted"], EmitFieldMap)
    assert res["failure"] is None

    # 2. A JudgeVerdict-shaped payload with NO schema_model is REJECTED by the default
    #    EmitFieldMap validation → emitted is None (the correct default behavior).
    _patch_gateway["events"] = _judge_verdict_stream(_VALID_JUDGE_VERDICT)
    res2 = await forced_emit(
        messages=[{"role": "user", "content": "grade this output"}],
        model="gpt-5.5",
        provider="openai",
        emitter="judge_verdict",
        tools=[{"function": {"name": "judge_verdict", "parameters": {}}}],
        user_settings=None,
    )
    assert res2["emitted"] is None
    assert res2["failure"] == "model_failed_to_emit"

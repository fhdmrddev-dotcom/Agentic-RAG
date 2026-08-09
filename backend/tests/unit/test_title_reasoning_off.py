"""Phase 175 Plan 04 — XPROV-04 (D-05): per-MODEL reasoning-off on the title call.

The title-gen call gets a tiny token budget (30 / Google 160) that a reasoning
provider would otherwise burn on hidden chain-of-thought, leaving content empty and
forcing the degenerate first-few-words derived fallback (BUG-260722-01). This suite
proves ``generate_thread_title`` injects the correct reasoning-DISABLE param on the
title call for ANY model carrying the Plan-01 ``reasoning_off`` capability marker —
driven GENERICALLY off ``get_model_capability``, NOT a hardcoded id list:

- ``reasoning_off == "thinking_disabled"`` → ``extra_body={"thinking":{"type":"disabled"}}``
  (the DISABLE mirror of the proven DeepSeek ENABLE block at openai_service.py:1826).
  Proven with TWO distinct SAFE models (deepseek-v4-flash AND glm-5.2) so the injection
  can't be a one/three-id special-case.
- ``reasoning_off == "effort_none"`` (Google) → ``reasoning_effort="none"``.
- UNSAFE models (no marker — MiniMax-M2.7-highspeed, gemini-2.5-pro) inject NOTHING; the
  call is byte-identical to today.

Plus the D-14 invariants: budget stays 30 (non-google) / 160 (google); an empty/refusal
response on a SAFE provider STILL derives a real title (no regression of the closed
title-generation-broken fix).

Patch surface mirrors test_threads_title_gen.py: patch("app.api.threads.get_llm_client")
and drive generate_thread_title directly; assert on the recorded create(...) kwargs.
"""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch


def _make_completion(text: str):
    resp = MagicMock()
    resp.choices[0].message.content = text
    return resp


def _make_client(text: str = "A Real Title"):
    client = MagicMock()
    client.chat.completions.create.return_value = _make_completion(text)
    return client


def _settings(provider, sub_agent_model="", llm_model="fallback-llm", available_models=None):
    return SimpleNamespace(
        active_provider=provider,
        sub_agent_model=sub_agent_model,
        llm_model=llm_model,
        available_models=available_models or [],
    )


def _create_kwargs(client) -> dict:
    return client.chat.completions.create.call_args.kwargs


def _run_title(us, chat_model="", first_message="How do I deploy the release?", text="A Real Title"):
    """Drive generate_thread_title with a recording mock client; return (title, fb, kwargs)."""
    from app.services.thread_title import generate_thread_title

    client = _make_client(text)
    with patch("app.api.threads.get_llm_client", return_value=client):
        title, fallback_info = generate_thread_title(first_message, us, chat_model)
    return title, fallback_info, _create_kwargs(client)


# ===========================================================================
# SAFE thinking_disabled → extra_body thinking:disabled (≥2 distinct models)
# ===========================================================================
def test_safe_deepseek_injects_extra_body_thinking_disabled():
    """A SAFE deepseek model (single-model provider path via chat_model) → the title
    call carries extra_body={"thinking":{"type":"disabled"}}."""
    us = _settings(provider="deepseek")
    _title, _fb, kwargs = _run_title(us, chat_model="deepseek-v4-flash")
    assert kwargs.get("extra_body") == {"thinking": {"type": "disabled"}}
    assert "reasoning_effort" not in kwargs


def test_safe_glm_injects_extra_body_thinking_disabled():
    """A SECOND distinct SAFE thinking_disabled model (glm-5.2) → same injection.
    Proves the param is marker-driven, NOT hardcoded to a single/few ids."""
    us = _settings(provider="zhipu")
    _title, _fb, kwargs = _run_title(us, chat_model="glm-5.2")
    assert kwargs.get("extra_body") == {"thinking": {"type": "disabled"}}
    assert "reasoning_effort" not in kwargs


# ===========================================================================
# SAFE effort_none (Google) → reasoning_effort="none"
# ===========================================================================
def test_safe_gemini_flash_injects_reasoning_effort_none():
    """A SAFE effort_none Google model (multi-model provider, same-provider override
    survives the XPROV-03 guard) → the title call carries reasoning_effort="none"
    and NO extra_body."""
    us = _settings(provider="google", sub_agent_model="gemini-2.5-flash")
    _title, _fb, kwargs = _run_title(us)
    assert kwargs.get("reasoning_effort") == "none"
    assert "extra_body" not in kwargs


# ===========================================================================
# UNSAFE (no marker) → inject NOTHING (byte-identical call)
# ===========================================================================
def test_unsafe_minimax_injects_no_reasoning_off_param():
    """An UNSAFE MiniMax model (no reasoning_off marker) injects NOTHING — no
    extra_body reasoning key, no reasoning_effort (identical call to today)."""
    us = _settings(provider="minimax")
    _title, _fb, kwargs = _run_title(us, chat_model="MiniMax-M2.7-highspeed")
    assert "extra_body" not in kwargs
    assert "reasoning_effort" not in kwargs


def test_unsafe_gemini_pro_injects_no_reasoning_off_param():
    """An UNSAFE Google model (gemini-2.5-pro — no marker) injects NOTHING even
    though its SAFE sibling gemini-2.5-flash does (per-MODEL, not per-provider)."""
    us = _settings(provider="google", sub_agent_model="gemini-2.5-pro")
    _title, _fb, kwargs = _run_title(us)
    assert "extra_body" not in kwargs
    assert "reasoning_effort" not in kwargs


# ===========================================================================
# D-05/D-14 budget invariance (30 non-google / 160 google) — byte-identical
# ===========================================================================
def test_budget_30_for_non_google_safe_model():
    """A non-google SAFE model keeps the 30-token title budget (byte-identical)."""
    us = _settings(provider="deepseek")
    _title, _fb, kwargs = _run_title(us, chat_model="deepseek-v4-flash")
    assert kwargs.get("max_tokens") == 30


def test_budget_160_for_google_safe_model():
    """A google SAFE model keeps the 160-token title budget (byte-identical)."""
    us = _settings(provider="google", sub_agent_model="gemini-2.5-flash")
    _title, _fb, kwargs = _run_title(us)
    assert kwargs.get("max_tokens") == 160


# ===========================================================================
# No-regression: empty/refusal on a SAFE provider still derives a real title
# ===========================================================================
def test_empty_response_on_safe_provider_still_derives_title():
    """An empty content response on a SAFE provider (reasoning-off injected but the
    model still returned nothing) still returns a DERIVED title (non-empty, not the
    bare 'New Chat' sentinel) — no regression of the closed title-generation-broken fix."""
    us = _settings(provider="deepseek")
    title, fallback_info, _kwargs = _run_title(
        us, chat_model="deepseek-v4-flash",
        first_message="Ship the release notes for v3.5",
        text="",  # empty content → derive path
    )
    assert title
    assert title != "New Chat"
    assert fallback_info is None

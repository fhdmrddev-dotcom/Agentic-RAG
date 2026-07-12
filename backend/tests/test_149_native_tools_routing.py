"""Phase 149 Plan 08 Task 1 (SC#1 / D-149-16) — DB-aware calling-mode resolution.

The exact UAT Test-1 failure: an operator flipped ``native_tools`` OFF for gpt-5.4-mini in
``model_capabilities_overrides``, but ``resolve_calling_mode`` drove the native-vs-structured
decision off the SYNC ``get_model_capability`` (static ``MODEL_CAPABILITIES`` dict only, no DB
tier), so the toggle had ZERO effect on the next request's routing.

The fix makes ``resolve_calling_mode`` consult the operator's DB override via the SAME 30s-TTL
warm ``_model_overrides_cache`` read the max_output clamp already uses
(``_resolve_db_max_output_cap``) — no ``await`` on the hot path, so ``resolve_calling_mode``
stays SYNC (the D-14 byte-identical boundary). These tests monkeypatch the warm cache directly
(no DB), so they exercise the sync read in isolation.
"""
import types

import app.models.user_settings as us_mod
from app.services.openai_service import CallingMode, resolve_calling_mode
from app.services.agent_loop import _should_pre_inject_structured


def _warm_cache(monkeypatch, cache: dict) -> None:
    """Replace the warm ``_model_overrides_cache`` the sync read consults (auto-restored)."""
    monkeypatch.setattr(us_mod, "_model_overrides_cache", cache)


def test_db_native_false_forces_structured(monkeypatch):
    """The reproduced UAT Test-1 failure: an operator native_tools=False override forces the
    STRUCTURED (prompt-injected) path for the next request, even though the STATIC cap for
    gpt-5.4-mini says native_tools=True (which returned NATIVE pre-fix)."""
    _warm_cache(monkeypatch, {
        "gpt-5.4-mini": {"model_id": "gpt-5.4-mini", "native_tools": False,
                         "enabled": True, "provider": "openai"},
    })
    assert resolve_calling_mode("gpt-5.4-mini", user_settings=None) is CallingMode.STRUCTURED


def test_no_override_is_byte_identical(monkeypatch):
    """No override present (empty/cold cache) → a known-native model resolves NATIVE, exactly
    as it does today. The shared path is byte-identical when no operator edit exists (D-14)."""
    _warm_cache(monkeypatch, {})
    assert resolve_calling_mode("gpt-4o", user_settings=None) is CallingMode.NATIVE


def test_db_native_true_flips_static_false_model(monkeypatch):
    """An operator explicitly turning native tools ON (override native_tools=True) on a model
    whose STATIC cap is native_tools=False → NATIVE (the operator's ON wins). deepseek-chat is
    a real registry row with static native_tools=False; user_settings=None keeps the OpenRouter
    strategy branch out of the way so the effective-value decision is under test."""
    _warm_cache(monkeypatch, {
        "deepseek/deepseek-chat": {"model_id": "deepseek/deepseek-chat", "native_tools": True,
                                   "enabled": True, "provider": "openrouter"},
    })
    assert resolve_calling_mode("deepseek/deepseek-chat", user_settings=None) is CallingMode.NATIVE


def test_null_native_tools_column_falls_back(monkeypatch):
    """An override row present but ``native_tools`` is None (operator edited only, say,
    max_output) → treated as NO native_tools override → byte-identical fallback to the static
    cap (gpt-4o static native_tools=True → NATIVE)."""
    _warm_cache(monkeypatch, {
        "gpt-4o": {"model_id": "gpt-4o", "native_tools": None,
                   "max_output_tokens": 4096, "enabled": True, "provider": "openai"},
    })
    assert resolve_calling_mode("gpt-4o", user_settings=None) is CallingMode.NATIVE


def test_resolve_calling_mode_is_sync():
    """D-14: the warm-cache read must not turn the hot-path function async. ``resolve_calling_mode``
    stays a plain ``def`` (no coroutine) — mirroring _resolve_db_max_output_cap."""
    import inspect
    assert not inspect.iscoroutinefunction(resolve_calling_mode)


# ---------------------------------------------------------------------------
# Phase 149 Plan 11 (SC#1 second half / WR-05) — the STRUCTURED pre-injection gate.
#
# The round-1 fix (56945cca) made resolve_calling_mode DB-aware, so an operator native_tools=False
# OVR now routes STRUCTURED. But agent_loop's pre-injection gate only fired for OpenRouter+xml, so a
# DB-flipped model on any OTHER compat provider got NO TOOL_USAGE_INSTRUCTIONS before the first
# stream — and the STRUCTURED branch omits the native `tools` param, leaving the model with no tool
# mechanism at all (hallucinated non-answer, zero tool calls). `_should_pre_inject_structured` is the
# pure gate that closes that gap while preserving the OpenRouter/xml, no-override, and
# anthropic/google-native boundaries byte-identically.
# ---------------------------------------------------------------------------


def _settings_stub(active_provider="openai", openrouter_tool_strategy="quality",
                   llm_model="gpt-4o"):
    """A minimal UserEffectiveSettings-shaped stub — the gate only reads these three attrs via
    getattr, never the DB directly (D-14; the warm cache carries the operator override)."""
    return types.SimpleNamespace(
        active_provider=active_provider,
        openrouter_tool_strategy=openrouter_tool_strategy,
        llm_model=llm_model,
    )


def test_gate_openai_native_false_pre_injects_structured(monkeypatch):
    """Test A — the reproduced UAT Test-1 failure. An operator native_tools=False OVR on an
    OpenAI compat-path model resolves STRUCTURED, so the gate MUST pre-inject the structured tool
    instructions before the first stream (row 1 'list folders' can then fire a tool instead of
    hallucinating)."""
    _warm_cache(monkeypatch, {
        "gpt-5.4-mini": {"model_id": "gpt-5.4-mini", "native_tools": False,
                         "enabled": True, "provider": "openai"},
    })
    stub = _settings_stub(active_provider="openai", llm_model="gpt-5.4-mini")
    # the seam the gate depends on — the round-1 DB-aware routing:
    assert resolve_calling_mode("gpt-5.4-mini", stub) is CallingMode.STRUCTURED
    assert _should_pre_inject_structured("openai", "gpt-5.4-mini", stub) is True


def test_gate_no_override_byte_identical(monkeypatch):
    """Test B — D-14 byte-identical no-override path. A native model with no DB override resolves
    NATIVE, so the gate does NOT pre-inject (never inject on the fast path)."""
    _warm_cache(monkeypatch, {})
    stub = _settings_stub(active_provider="openai", llm_model="gpt-4o")
    assert resolve_calling_mode("gpt-4o", stub) is CallingMode.NATIVE
    assert _should_pre_inject_structured("openai", "gpt-4o", stub) is False


def test_gate_excludes_anthropic_and_google(monkeypatch):
    """Test C — WR-05 boundary. Even with a native_tools=False OVR present, the anthropic and
    google native-SDK branches are NEVER structured-injected — a stray OVR must not reroute a real
    native tool-carrying request through structured injection."""
    _warm_cache(monkeypatch, {
        "claude-opus-4-8": {"model_id": "claude-opus-4-8", "native_tools": False,
                            "enabled": True, "provider": "anthropic"},
        "gemini-3-pro": {"model_id": "gemini-3-pro", "native_tools": False,
                         "enabled": True, "provider": "google"},
    })
    stub = _settings_stub(active_provider="anthropic", llm_model="claude-opus-4-8")
    # the OVR really WOULD flip the compat resolver to STRUCTURED — proving the exclusion (not the
    # absence of an override) is what holds the boundary:
    assert resolve_calling_mode("claude-opus-4-8", stub) is CallingMode.STRUCTURED
    assert _should_pre_inject_structured("anthropic", "claude-opus-4-8", stub) is False
    assert _should_pre_inject_structured("google", "gemini-3-pro", stub) is False


def test_gate_openrouter_xml_preserved(monkeypatch):
    """Test D — the existing OpenRouter XML pre-injection is preserved byte-identically; the native
    and quality strategies still do NOT pre-inject."""
    _warm_cache(monkeypatch, {})
    xml = _settings_stub(active_provider="openrouter", openrouter_tool_strategy="xml",
                         llm_model="gpt-4o")
    native = _settings_stub(active_provider="openrouter", openrouter_tool_strategy="native",
                            llm_model="gpt-4o")
    quality = _settings_stub(active_provider="openrouter", openrouter_tool_strategy="quality",
                             llm_model="gpt-4o")
    assert _should_pre_inject_structured("openrouter", "gpt-4o", xml) is True
    assert _should_pre_inject_structured("openrouter", "gpt-4o", native) is False
    assert _should_pre_inject_structured("openrouter", "gpt-4o", quality) is False

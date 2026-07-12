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
import app.models.user_settings as us_mod
from app.services.openai_service import CallingMode, resolve_calling_mode


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

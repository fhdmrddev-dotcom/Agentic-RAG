"""Phase 075.4 Plan 02 Task 2 — 6-site registry-or-inference coverage.

Covers (per 075.4-02-PLAN.md <behavior>):
  Test 1: _uses_max_completion_tokens("o1") returns True via registry hit
          (MODEL_CAPABILITIES["o1"]["uses_max_completion_tokens"] == True).
  Test 2: _uses_max_completion_tokens("gpt-5.5-future") (unregistered) returns
          True via inferred startswith fallback.
  Test 3: _uses_max_completion_tokens("claude-sonnet-4-6") returns False
          (registry hit — no uses_max_completion_tokens key → fallback path,
          startswith heuristic returns False).
  Test 4: estimate_tokens("hello world", model="gpt-5.4-mini") returns
          tiktoken-based count (NOT chars/4) because the registry says
          provider="openai".
  Test 5: estimate_tokens("hello world", model="claude-sonnet-4-6") returns
          the chars/4 heuristic (provider="anthropic").
  Test 6: parallel-tools gate consults cap.get("supports_parallel_tools", True);
          gemini-3-pro models with supports_parallel_tools=False do NOT get
          parallel_tool_calls set in kwargs.
  Test 7: Anthropic-native gate at threads.py:1679 is operator-controlled via
          active_provider; verify the audit comment is in place.

Conventions mirror backend/tests/unit/test_075_1_observability.py — pure
unit tests against pure helpers.
"""
from __future__ import annotations

import inspect

import pytest


# ── Test 1 + 2 + 3: _uses_max_completion_tokens registry-or-inference ────────


def test_uses_max_completion_tokens_registry_hit_o1() -> None:
    """Test 1: o1 is in MODEL_CAPABILITIES with uses_max_completion_tokens=True."""
    from app.config import MODEL_CAPABILITIES
    from app.services.openai_service import _uses_max_completion_tokens

    # Registry guard: confirms Task 1 populated the field on the registered row.
    assert MODEL_CAPABILITIES["o1"]["uses_max_completion_tokens"] is True
    assert _uses_max_completion_tokens("o1") is True


def test_uses_max_completion_tokens_registry_hit_gpt5() -> None:
    """Bonus: every gpt-5+ registered row carries the flag (D-075.4-NN scope)."""
    from app.config import MODEL_CAPABILITIES
    from app.services.openai_service import _uses_max_completion_tokens

    for model_id in ("gpt-5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.5", "o3", "o4"):
        assert MODEL_CAPABILITIES[model_id].get("uses_max_completion_tokens") is True
        assert _uses_max_completion_tokens(model_id) is True


def test_uses_max_completion_tokens_inferred_fallback_for_unregistered_gpt5() -> None:
    """Test 2: unregistered gpt-5.5-future routes through the startswith fallback."""
    from app.config import MODEL_CAPABILITIES
    from app.services.openai_service import _uses_max_completion_tokens

    # Sanity — model is not in the registry.
    assert "gpt-5.5-future" not in MODEL_CAPABILITIES
    assert _uses_max_completion_tokens("gpt-5.5-future") is True


def test_uses_max_completion_tokens_false_for_anthropic() -> None:
    """Test 3: claude-sonnet-4-6 is registered as anthropic, has no
    uses_max_completion_tokens flag → fallback startswith check → False."""
    from app.services.openai_service import _uses_max_completion_tokens

    assert _uses_max_completion_tokens("claude-sonnet-4-6") is False


def test_uses_max_completion_tokens_empty_input_safe() -> None:
    """Defensive: empty / None model id falls through to safe default (False)."""
    from app.services.openai_service import _uses_max_completion_tokens

    assert _uses_max_completion_tokens("") is False
    assert _uses_max_completion_tokens(None) is False  # type: ignore[arg-type]


# ── Test 4 + 5: estimate_tokens registry-driven gate ──────────────────────────


def test_estimate_tokens_uses_tiktoken_for_openai_via_registry() -> None:
    """Test 4: estimate_tokens with a registered OpenAI model resolves through
    the registry path (provider=='openai') and uses tiktoken when available."""
    from app.services.context_window import _get_cl100k, estimate_tokens

    enc = _get_cl100k()
    if enc is None:
        pytest.skip("tiktoken unavailable in test env")

    # tiktoken result is deterministic; assert it matches the encoder directly.
    expected = max(1, len(enc.encode("hello world")))
    assert estimate_tokens("hello world", model="gpt-5.4-mini") == expected

    # Sanity — chars/4 fallback would yield 11//4 == 2, which differs from
    # tiktoken's count for "hello world" (typically 2 tokens). To make the
    # assertion meaningful we compare to a longer string where the two diverge.
    long_text = "The quick brown fox jumps over the lazy dog. " * 10
    tiktoken_count = max(1, len(enc.encode(long_text)))
    chars_4_count = max(1, len(long_text) // 4)
    # The two methods MUST disagree for the test to be load-bearing.
    assert tiktoken_count != chars_4_count
    assert estimate_tokens(long_text, model="gpt-5.4-mini") == tiktoken_count


def test_estimate_tokens_falls_back_to_chars4_for_anthropic() -> None:
    """Test 5: estimate_tokens with an anthropic-registered model uses the
    chars/4 heuristic (does NOT hit tiktoken)."""
    from app.services.context_window import estimate_tokens

    text = "hello world"  # 11 chars → 11//4 == 2
    assert estimate_tokens(text, model="claude-sonnet-4-6") == max(1, len(text) // 4)


def test_estimate_tokens_falls_back_to_chars4_for_unregistered_non_openai() -> None:
    """An unregistered openrouter-style model (slash-namespaced) falls through
    to chars/4 because its inferred provider is 'openrouter', not 'openai'."""
    from app.services.context_window import estimate_tokens

    text = "the quick brown fox"  # 19 chars → 19//4 == 4
    assert estimate_tokens(text, model="someproject/unknown-model") == max(1, len(text) // 4)


# ── Test 6: parallel-tools gate consults supports_parallel_tools ─────────────


def test_parallel_tool_calls_gate_uses_registry_for_google() -> None:
    """Test 6: Google rows carry supports_parallel_tools=False; the new gate
    at openai_service.py reads it via cap.get() before falling back to the
    legacy _NO_PARALLEL_TOOL_CALLS frozenset.

    Audit-style: confirms the registry value, the gate-source shape, AND that
    the new code path is wired before the legacy frozenset fallback.
    """
    from app.config import MODEL_CAPABILITIES, get_model_capability
    from app.services import openai_service

    # Registry guard.
    for model_id in (
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-3-flash-preview",
        "gemini-3.1-pro-preview",
        "gemini-3.5-flash",
    ):
        assert MODEL_CAPABILITIES[model_id].get("supports_parallel_tools") is False
        # And via the public helper (which is what the gate consumes):
        assert get_model_capability(model_id).get("supports_parallel_tools") is False

    # Gate-source audit: the new registry-first branch is present.
    src = inspect.getsource(openai_service.create_adaptive_streaming_chat)
    assert "supports_parallel_tools" in src
    assert "cap.get(\"supports_parallel_tools\")" in src
    # And the legacy frozenset stays as inferred fallback.
    assert "_NO_PARALLEL_TOOL_CALLS" in src


def test_parallel_tool_calls_gate_defaults_to_supported_for_openai() -> None:
    """A registered OpenAI model has no supports_parallel_tools key → falls
    through to legacy provider-prefix check → provider 'openai' is NOT in
    _NO_PARALLEL_TOOL_CALLS so parallel-tool-calls remains supported."""
    from app.config import get_model_capability
    from app.services.openai_service import _NO_PARALLEL_TOOL_CALLS

    cap = get_model_capability("gpt-5.4-mini")
    # The registry row has no supports_parallel_tools key by design (only google
    # rows do — D-075.4-NN scope: explicit False where the API rejects it).
    assert cap.get("supports_parallel_tools") is None
    # Legacy fallback path: provider="openai" NOT in the frozenset → parallel ok.
    assert (cap.get("provider", "") or "").lower() not in _NO_PARALLEL_TOOL_CALLS


# ── Test 7: Anthropic-native gate audit (Site 4) ─────────────────────────────


def test_anthropic_native_gate_carries_audit_comment() -> None:
    """Test 7: the native-path gate is operator-controlled via active_provider.
    Audit-only: confirm the Plan 075.4-02 audit comment is present near the gate
    so future maintainers don't accidentally refactor it into a registry-based
    check (which would route OpenRouter-Claude variants through the native path
    and lose the operator's routing/billing/fallback intent).

    Phase 089-03 (G-5 verbatim move): the provider gate + the audit comment
    moved with the loop body from threads.py into agent_loop.py.

    Phase 092.5 Wave 2: the two clean branches (Anthropic + Google) collapsed
    into ONE gateway-dispatched native branch, so the gate is now
    ``active_provider_name in ("anthropic", "google")`` — STILL operator-controlled
    via active_provider (NOT a registry check), preserving Test 7's intent."""
    from app.services import agent_loop as agent_loop_mod

    src = inspect.getsource(agent_loop_mod)
    # Both the audit comment AND the operator-controlled gate must be present.
    assert "Plan 075.4-02 audit (Site 4)" in src
    assert 'active_provider_name in ("anthropic", "google")' in src

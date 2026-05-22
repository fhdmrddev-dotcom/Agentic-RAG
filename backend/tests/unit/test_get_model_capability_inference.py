"""Phase 075.3 Plan 02 — unit tests for pattern-based provider inference + safe defaults
+ warn-once dedup in `get_model_capability` (D-075.3-06/07/08/09/17).

Covers:
- 5-bucket inference patterns (gpt-* / o1-9 / claude-* / gemini-* / */* / fallback ollama)
- Safe-default table per provider (D-075.3-07)
- Warn-once dedup via module-level `_WARNED_UNKNOWN_MODEL_IDS` set (D-075.3-09)
- Registered model regression (registry hit still returns verified caps unchanged)
- Threat-model regressions: T-075.3-02-01 (ReDoS), T-075.3-02-02 (log injection),
  T-075.3-02-05 (long-input crash).

Until Task 2 lands, these tests fail with AttributeError on
`config._WARNED_UNKNOWN_MODEL_IDS` — the desired RED state.
"""
from __future__ import annotations

import logging
import time

import pytest

from app import config
from app.config import MODEL_CAPABILITIES, get_model_capability


# ── Autouse fixture: reset module-level warn dedup between tests ──
# Per RESEARCH.md §5 lines 313-319 — explicit, deterministic, rolls back
# automatically via monkeypatch.setattr, composes cleanly with caplog.
@pytest.fixture(autouse=True)
def _reset_warn_dedup(monkeypatch):
    """Reset module-level warn dedup before every test to make
    warn-once assertions deterministic regardless of test ordering."""
    monkeypatch.setattr(config, "_WARNED_UNKNOWN_MODEL_IDS", set())
    yield


# ────────────────────────────────────────────────────────────────────
# 1-2. Registry regression — verified caps must pass through unchanged
# ────────────────────────────────────────────────────────────────────

def test_registered_gpt_4o_returns_verified_caps_unchanged():
    cap = get_model_capability("gpt-4o")
    expected = MODEL_CAPABILITIES["gpt-4o"]
    # Every existing field round-trips
    assert cap["native_tools"] == expected["native_tools"]
    assert cap["provider"] == expected["provider"]
    assert cap["llm_call_timeout_seconds"] == expected["llm_call_timeout_seconds"]
    assert cap["max_output_tokens"] == expected["max_output_tokens"]
    # capability_source flag is "registry"
    assert cap["capability_source"] == "registry"


def test_registered_claude_sonnet_4_6_returns_verified_caps_unchanged():
    cap = get_model_capability("claude-sonnet-4-6")
    expected = MODEL_CAPABILITIES["claude-sonnet-4-6"]
    assert cap["native_tools"] == expected["native_tools"]
    assert cap["provider"] == expected["provider"]
    assert cap["llm_call_timeout_seconds"] == expected["llm_call_timeout_seconds"]
    assert cap["max_output_tokens"] == expected["max_output_tokens"]
    assert cap["capability_source"] == "registry"


# ────────────────────────────────────────────────────────────────────
# 3-5. OpenAI inference (gpt-* + o-series)
# ────────────────────────────────────────────────────────────────────

def test_infer_openai_from_gpt_prefix():
    cap = get_model_capability("gpt-99")
    assert cap["provider"] == "openai"
    assert cap["native_tools"] is True
    assert cap["llm_call_timeout_seconds"] == 90
    assert cap["max_output_tokens"] == 8192
    assert cap["capability_source"] == "inferred"


def test_infer_openai_from_o_series():
    cap = get_model_capability("o5")
    assert cap["provider"] == "openai"
    assert cap["native_tools"] is True
    assert cap["max_output_tokens"] == 8192
    assert cap["capability_source"] == "inferred"


def test_infer_openai_from_o3_dash_variant():
    cap = get_model_capability("o3-mini-future")
    assert cap["provider"] == "openai"
    assert cap["capability_source"] == "inferred"


# ────────────────────────────────────────────────────────────────────
# 6. o10 must NOT match the o-series pattern (D-075.3-06: explicit o1-o9)
# ────────────────────────────────────────────────────────────────────

def test_o10_does_not_match_o_series_pattern():
    cap = get_model_capability("o10")
    # Pattern `^o[1-9](-|$)` does not match `o10` (3rd char is `0`, not `-` or end)
    # Falls through to ollama bucket.
    assert cap["provider"] == "ollama"
    assert cap["capability_source"] == "inferred"


# ────────────────────────────────────────────────────────────────────
# 7. Anthropic inference (claude-*)
# ────────────────────────────────────────────────────────────────────

def test_infer_anthropic_from_claude_prefix():
    cap = get_model_capability("claude-future-5")
    assert cap["provider"] == "anthropic"
    assert cap["native_tools"] is True
    assert cap["max_output_tokens"] == 8192
    assert cap["capability_source"] == "inferred"


# ────────────────────────────────────────────────────────────────────
# 8. Google inference (gemini-*) — the negative-test ID for Wave 4 UAT
# ────────────────────────────────────────────────────────────────────

def test_infer_google_from_gemini_prefix():
    cap = get_model_capability("gemini-99-flash")
    assert cap["provider"] == "google"
    assert cap["native_tools"] is True
    assert cap["max_output_tokens"] == 8192
    assert cap["capability_source"] == "inferred"


# ────────────────────────────────────────────────────────────────────
# 9-10. OpenRouter inference (any slash-bearing model_id)
# ────────────────────────────────────────────────────────────────────

def test_infer_openrouter_from_slash():
    cap = get_model_capability("nodelta/some-model")
    assert cap["provider"] == "openrouter"
    assert cap["native_tools"] is False
    assert cap["max_output_tokens"] == 4096
    assert cap["capability_source"] == "inferred"


def test_infer_openrouter_with_colon_suffix():
    cap = get_model_capability("vendor/model:free")
    assert cap["provider"] == "openrouter"
    assert cap["capability_source"] == "inferred"


# ────────────────────────────────────────────────────────────────────
# 11-13. Ollama fallback bucket — no prefix, empty, None
# ────────────────────────────────────────────────────────────────────

def test_fallback_to_ollama_no_prefix():
    cap = get_model_capability("unknown-no-slash-no-prefix")
    assert cap["provider"] == "ollama"
    assert cap["native_tools"] is False
    assert cap["max_output_tokens"] == 8192
    assert cap["capability_source"] == "inferred"


def test_fallback_to_ollama_empty_string():
    cap = get_model_capability("")
    assert cap["provider"] == "ollama"
    assert cap["capability_source"] == "inferred"


def test_fallback_to_ollama_none():
    # Must coerce None to "" before inference — no crash.
    cap = get_model_capability(None)  # type: ignore[arg-type]
    assert cap["provider"] == "ollama"
    assert cap["capability_source"] == "inferred"


# ────────────────────────────────────────────────────────────────────
# 14-15. Case-insensitive matching
# ────────────────────────────────────────────────────────────────────

def test_case_insensitive_GPT_uppercase():
    cap = get_model_capability("GPT-4o-future")
    assert cap["provider"] == "openai"
    assert cap["capability_source"] == "inferred"


def test_case_insensitive_Claude_capitalized():
    cap = get_model_capability("Claude-future")
    assert cap["provider"] == "anthropic"
    assert cap["capability_source"] == "inferred"


# ────────────────────────────────────────────────────────────────────
# 16-18. Warn-once dedup matrix
# ────────────────────────────────────────────────────────────────────

def test_warn_once_per_model_id_three_calls(caplog):
    with caplog.at_level(logging.WARNING, logger="app.config"):
        for _ in range(3):
            cap = get_model_capability("gemini-99-flash")
    warns = [r for r in caplog.records if "model_capability_unknown" in r.getMessage()]
    assert len(warns) == 1, f"expected exactly 1 warning, got {len(warns)}"
    assert cap["provider"] == "google"
    assert cap["capability_source"] == "inferred"


def test_warn_fires_separately_for_distinct_unknown_ids(caplog):
    with caplog.at_level(logging.WARNING, logger="app.config"):
        get_model_capability("gemini-99-flash")
        get_model_capability("gpt-99")
        get_model_capability("gemini-99-flash")  # dedup'd
    warns = [r for r in caplog.records if "model_capability_unknown" in r.getMessage()]
    assert len(warns) == 2, f"expected 2 warnings (one per distinct id), got {len(warns)}"


def test_warn_does_not_fire_for_registered_models(caplog):
    with caplog.at_level(logging.WARNING, logger="app.config"):
        get_model_capability("gpt-4o")
    warns = [r for r in caplog.records if "model_capability_unknown" in r.getMessage()]
    assert len(warns) == 0, f"expected 0 warnings for registered model, got {len(warns)}"


# ────────────────────────────────────────────────────────────────────
# 19-21. Threat-model regressions (T-075.3-02-01/02/05)
# ────────────────────────────────────────────────────────────────────

def test_redos_safe_against_long_input():
    """T-075.3-02-01: anchored patterns + bounded char classes complete in <100ms
    against a 10KB input string."""
    t0 = time.monotonic()
    cap = get_model_capability("a" * 10000)
    elapsed = time.monotonic() - t0
    assert elapsed < 0.1, f"Inference regex took {elapsed*1000:.1f}ms; ReDoS suspected"
    assert cap["provider"] == "ollama"


def test_log_no_injection_newline(caplog):
    """T-075.3-02-02: parameterized logging escapes newlines in model_id rather than
    creating a new log record."""
    with caplog.at_level(logging.WARNING, logger="app.config"):
        get_model_capability("evil\n[ADMIN] fake-log")
    warns = [r for r in caplog.records if "model_capability_unknown" in r.getMessage()]
    assert len(warns) == 1, f"expected exactly 1 warning record, got {len(warns)}"
    # Newline + payload appear as part of the SAME message (not a new log entry)
    msg = warns[0].getMessage()
    assert "evil" in msg
    assert "[ADMIN]" in msg
    assert "fake-log" in msg


def test_long_model_id_no_crash():
    """T-075.3-02-05: 100KB input doesn't crash or take pathologically long."""
    t0 = time.monotonic()
    cap = get_model_capability("x" * 100000)
    elapsed = time.monotonic() - t0
    assert elapsed < 0.5, f"100KB input took {elapsed*1000:.1f}ms"
    assert cap["provider"] == "ollama"

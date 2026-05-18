"""Unit test for SEED-009 (Phase 074): _resolve_max_tokens clamps against
MODEL_CAPABILITIES[model]["max_output_tokens"] when entry exists; passes
through unchanged when entry missing.

Covers POLISH-SEED-009-01:
  - SC#2 boundary cases (under/at/over 64K haiku cap)
  - D-074-02 pass-through for unknown models
  - D-074-02 pass-through for models WITH a registry entry but WITHOUT max_output_tokens
  - RESEARCH.md Open Question 2 — `:exacto` suffix strip for clamp lookup
"""
from __future__ import annotations

import logging
from unittest.mock import MagicMock

import pytest

from app.services.openai_service import _resolve_max_tokens


@pytest.fixture
def haiku_settings():
    """UserEffectiveSettings configured for claude-haiku-4-5-20251001 (cap=64000)."""
    s = MagicMock()
    s.active_provider = "anthropic"
    s.llm_model = "claude-haiku-4-5-20251001"
    s.llm_max_output_tokens = 0
    s.llm_api_key = "test-key"
    return s


@pytest.mark.parametrize("explicit,expected_returned,should_clamp", [
    (32000, 32000, False),   # under cap — pass through
    (64000, 64000, False),   # at cap — strict > comparison, pass through
    (65536, 64000, True),    # over cap — CLAMP fires (the SEED-009 bug case)
])
def test_clamp_haiku_4_5(haiku_settings, caplog, explicit, expected_returned, should_clamp):
    """SEED-009 SC#2 — clamp boundary cases for haiku-4-5 (cap=64000)."""
    with caplog.at_level(logging.INFO, logger="app.services.openai_service"):
        result = _resolve_max_tokens(explicit, haiku_settings)
    assert result == expected_returned, (
        f"explicit={explicit} should resolve to {expected_returned}, got {result}"
    )
    clamp_logs = [r for r in caplog.records if "clamped max_tokens" in r.getMessage()]
    if should_clamp:
        assert len(clamp_logs) == 1, f"expected 1 clamp log, got {len(clamp_logs)}: {[r.getMessage() for r in clamp_logs]}"
        msg = clamp_logs[0].getMessage()
        assert "claude-haiku-4-5-20251001" in msg
        assert "65536" in msg
        assert "64000" in msg
    else:
        assert len(clamp_logs) == 0, f"expected no clamp log, got: {[r.getMessage() for r in clamp_logs]}"


def test_unknown_model_passthrough(caplog):
    """D-074-02 — unknown model (no registry entry) passes through unchanged, no clamp log."""
    s = MagicMock()
    s.active_provider = "anthropic"
    s.llm_model = "claude-haiku-9-9-some-future-snapshot"  # not in registry
    s.llm_max_output_tokens = 0
    s.llm_api_key = "test-key"
    with caplog.at_level(logging.INFO, logger="app.services.openai_service"):
        result = _resolve_max_tokens(999999, s)
    assert result == 999999
    assert not any("clamped" in r.getMessage() for r in caplog.records)


def test_known_model_without_max_output_tokens_passthrough(caplog):
    """D-074-02 + RESEARCH.md OQ1 — model has registry entry but max_output_tokens
    field is intentionally omitted (e.g., gemini-3-flash-preview, minimax/minimax-01)
    → clamp must pass through unchanged."""
    s = MagicMock()
    s.active_provider = "google"
    s.llm_model = "gemini-3-flash-preview"  # exists in registry but no max_output_tokens
    s.llm_max_output_tokens = 0
    s.llm_api_key = "test-key"
    with caplog.at_level(logging.INFO, logger="app.services.openai_service"):
        result = _resolve_max_tokens(999999, s)
    assert result == 999999
    assert not any("clamped" in r.getMessage() for r in caplog.records)


def test_exacto_suffix_stripped_for_clamp_lookup(caplog):
    """RESEARCH.md OQ2 — `:exacto` OpenRouter routing suffix is stripped before
    MODEL_CAPABILITIES lookup. The clamp must still fire against the base model id."""
    s = MagicMock()
    s.active_provider = "openrouter"
    s.llm_model = "minimax/minimax-m2.7:exacto"  # base entry is minimax/minimax-m2.7 with cap=131072
    s.llm_max_output_tokens = 0
    s.llm_api_key = "test-key"
    with caplog.at_level(logging.INFO, logger="app.services.openai_service"):
        result = _resolve_max_tokens(999999, s)
    assert result == 131072, f"expected clamp to 131072 (minimax-m2.7 cap), got {result}"
    clamp_logs = [r for r in caplog.records if "clamped max_tokens" in r.getMessage()]
    assert len(clamp_logs) == 1
    # Log MUST reference the registry-key form (base), NOT the :exacto variant.
    msg = clamp_logs[0].getMessage()
    assert "minimax/minimax-m2.7" in msg
    assert ":exacto" not in msg, f"clamp log leaked :exacto suffix: {msg!r}"


def test_free_suffix_NOT_stripped(caplog):
    """Defensive sanity — `:free` is part of the upstream model card (not a routing
    suffix) and MUST NOT be stripped. `minimax/minimax-m2.5:free` has its own
    registry entry with cap=16384 — the clamp resolves against that entry, not a
    nonexistent `minimax/minimax-m2.5`."""
    s = MagicMock()
    s.active_provider = "openrouter"
    s.llm_model = "minimax/minimax-m2.5:free"
    s.llm_max_output_tokens = 0
    s.llm_api_key = "test-key"
    with caplog.at_level(logging.INFO, logger="app.services.openai_service"):
        result = _resolve_max_tokens(999999, s)
    assert result == 16384, f"expected clamp to 16384 (m2.5:free cap), got {result}"
    clamp_logs = [r for r in caplog.records if "clamped max_tokens" in r.getMessage()]
    assert len(clamp_logs) == 1
    assert "minimax/minimax-m2.5:free" in clamp_logs[0].getMessage()

"""Phase 149 Plan 03 (D-149-15) — the ``max_output_tokens`` clamp must honor the
EFFECTIVE model actually sent AND an operator's DB-edited ``max_output_tokens``.

Closes the folded bug BUG-260620-01 (gpt-4o ``32768 > 16384 → 400``). Before this
plan, ``_resolve_max_tokens`` clamped against the STATIC ``MODEL_CAPABILITIES``
dict keyed by ``user_settings.llm_model`` — the WRONG model on a sub-agent /
explicit-model call, AND blind to an operator's DB override. See
``149-RESEARCH.md`` Pitfall 4 (the exact mechanism) + Open Q3 (keep the function
sync; thread a pre-resolved DB cap in from the async request path).

Pitfall-4 anti-regression: the targeted ``.removesuffix(":exacto")`` must survive;
a generic ``split(":")[0]`` would strip a legitimate ``:free`` upstream model card
and silently drop clamp protection.
"""
from __future__ import annotations

import logging
from unittest.mock import MagicMock

import pytest

import app.config
from app.services.openai_service import _resolve_max_tokens


def _settings(model: str, provider: str = "openai"):
    """UserEffectiveSettings stub with the user's *default* model set to ``model``.

    ``llm_max_output_tokens = 0`` disables the user-slider priority branch so the
    tests isolate the clamp gate against an explicit resolved value.
    """
    s = MagicMock()
    s.active_provider = provider
    s.llm_model = model
    s.llm_max_output_tokens = 0
    s.llm_api_key = "test-key"
    return s


def _clamp_logs(caplog):
    return [r for r in caplog.records if "clamped max_tokens" in r.getMessage()]


# ---------------------------------------------------------------------------
# Behavior 1 — gpt-4o over its static cap clamps to 16384 (BUG-260620-01 closed)
# ---------------------------------------------------------------------------
def test_gpt4o_over_cap_clamps_to_16384(caplog):
    s = _settings("gpt-4o")
    with caplog.at_level(logging.INFO, logger="app.services.openai_service"):
        result = _resolve_max_tokens(32768, s, effective_model="gpt-4o")
    assert result == 16384, f"gpt-4o must clamp 32768 → 16384, got {result}"
    logs = _clamp_logs(caplog)
    assert len(logs) == 1 and "gpt-4o" in logs[0].getMessage()


# ---------------------------------------------------------------------------
# Behavior 2 — an operator DB override wins over the static cap (SC#1 honest edit)
# ---------------------------------------------------------------------------
def test_db_override_lowers_cap_to_8000():
    """A pre-resolved DB cap of 8000 (threaded in) clamps below the static 16384."""
    s = _settings("gpt-4o")
    result = _resolve_max_tokens(
        32768, s, effective_model="gpt-4o", db_max_output_cap=8000
    )
    assert result == 8000, f"DB override to 8000 must win over static 16384, got {result}"


async def test_db_cap_resolved_through_capability_read(monkeypatch):
    """The request-path wiring pattern: resolve the DB-overridable cap via
    ``get_model_capability_async`` (mocked here) and thread it into the sync clamp
    — proving the edit reaches the request path (Open Q3 — no await in the hot
    path, the cap is pre-resolved)."""
    async def fake_cap(model_id):
        assert model_id == "gpt-4o"
        return {"max_output_tokens": 8000}

    monkeypatch.setattr(app.config, "get_model_capability_async", fake_cap)
    s = _settings("gpt-4o")
    db_cap = (await app.config.get_model_capability_async("gpt-4o") or {}).get(
        "max_output_tokens"
    )
    result = _resolve_max_tokens(
        32768, s, effective_model="gpt-4o", db_max_output_cap=db_cap
    )
    assert result == 8000


# ---------------------------------------------------------------------------
# Behavior 3 — the clamp uses the EFFECTIVE model, never user_settings.llm_model
# ---------------------------------------------------------------------------
def test_uses_effective_model_not_user_settings_llm_model():
    """user_settings.llm_model=gpt-4o (cap 16384) but the effective model sent is
    haiku-4-5 (cap 64000). 32768 < 64000 → pass-through. If the clamp still read
    user_settings.llm_model it would wrongly clamp to 16384 — so a 32768 result
    proves the effective model is consulted."""
    s = _settings("gpt-4o")
    result = _resolve_max_tokens(
        32768, s, effective_model="claude-haiku-4-5-20251001"
    )
    assert result == 32768, (
        f"must use effective model (haiku cap 64000 → pass-through 32768), not "
        f"user_settings gpt-4o (would clamp to 16384); got {result}"
    )


def test_effective_model_cap_4096_clamps():
    """Explicit-cap variant of Behavior 3 — an effective (e.g. sub-agent) model
    whose cap is 4096 clamps a 32768 request to 4096, not the user's gpt-4o
    16384."""
    s = _settings("gpt-4o")
    result = _resolve_max_tokens(
        32768, s, effective_model="some-sub-agent-model", db_max_output_cap=4096
    )
    assert result == 4096, f"effective model cap 4096 must clamp 32768 → 4096, got {result}"


# ---------------------------------------------------------------------------
# Behavior 4 — :exacto is stripped for the lookup; :free is preserved (Pitfall 4)
# ---------------------------------------------------------------------------
def test_exacto_suffix_stripped_on_effective_model(caplog):
    """minimax/minimax-m2.7:exacto → the :exacto routing suffix is stripped so the
    base card (cap 131072) is found; the clamp log references the base, never
    :exacto."""
    s = _settings("minimax/minimax-m2.7:exacto", provider="openrouter")
    with caplog.at_level(logging.INFO, logger="app.services.openai_service"):
        result = _resolve_max_tokens(
            999999, s, effective_model="minimax/minimax-m2.7:exacto"
        )
    assert result == 131072, f"expected clamp to base cap 131072, got {result}"
    logs = _clamp_logs(caplog)
    assert len(logs) == 1
    assert ":exacto" not in logs[0].getMessage()


def test_free_suffix_preserved_on_effective_model():
    """:free is a real upstream model card (NOT a routing suffix) and MUST NOT be
    stripped. The unregistered :free variant → pass-through; a wrong split(":")[0]
    would clamp to the base's 131072 and silently lose the :free tier's protection.
    """
    s = _settings("minimax/minimax-m2.7:free", provider="openrouter")
    result = _resolve_max_tokens(
        999999, s, effective_model="minimax/minimax-m2.7:free"
    )
    assert result == 999999, (
        f"unregistered :free variant must pass through (clamping means :free was "
        f"wrongly stripped to the base card); got {result}"
    )


# ---------------------------------------------------------------------------
# Behavior 5 — no registry/DB cap → pass-through (D-074-02)
# ---------------------------------------------------------------------------
def test_no_cap_passthrough():
    s = _settings("brand-new-unregistered-model")
    result = _resolve_max_tokens(
        32768, s, effective_model="brand-new-unregistered-model"
    )
    assert result == 32768


# ---------------------------------------------------------------------------
# Backward-compat — legacy callers (no effective_model) still clamp against
# user_settings.llm_model exactly as before (Phase 074 behavior preserved).
# ---------------------------------------------------------------------------
def test_legacy_call_without_effective_model_falls_back(caplog):
    s = _settings("gpt-4o")
    with caplog.at_level(logging.INFO, logger="app.services.openai_service"):
        result = _resolve_max_tokens(32768, s)  # no effective_model / db cap
    assert result == 16384, "legacy 2-arg call must still clamp via user_settings.llm_model"
    assert len(_clamp_logs(caplog)) == 1

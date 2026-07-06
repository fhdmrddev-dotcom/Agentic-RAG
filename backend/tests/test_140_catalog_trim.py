"""Phase 140 Plan 03 (TRIG-02) — DB-free unit tests for the skill-catalog pre-filter.

These prove the CONTRACTS Plan 04 wires into the hot path, with NO DB and NO LLM:

  * ``resolve_skill_catalog_budget`` — bounds-checked global budget (SC#2 / D-04 kill
    switch; T-140-05 hardens the untrusted admin value).
  * ``build_skill_catalog_block`` — the pure trim function:
      - fits budget       → BYTE-IDENTICAL to today's ``## Available Skills`` block, no
                            marker (D-03 fast path, SC#1).
      - over budget       → least-relevant cut first, higher-sim kept, honest
                            ``_CATALOG_TRIM_MARKER`` with the real N-cut (SC#1 + SC#3 / D-14).
      - pinned/recent     → always kept even at lowest similarity (D-02), capped so pins
                            can't starve the whole menu (PIN_BUDGET_FRACTION mirror).
      - ``sim_by_id=None``→ fail-open: trim by name order only, never crash (D-05).
      - MIXED sim (real floats + ``None``) → None-safe: the ``None`` score sorts LAST and
                            never raises ``-(None)`` TypeError (Blocker-3; this fn runs
                            OUTSIDE Plan 04's try/except, so a crash here breaks D-05).
  * ``_recently_loaded_skill_names`` — scans history rows' ``load_skill`` tool_calls for
    ``args.skill_name`` (D-02 pin provenance).

Pure logic → the tests drive the functions directly; no mocks, no network.
"""
from __future__ import annotations

from types import SimpleNamespace

from app.services.skill_catalog_filter import resolve_skill_catalog_budget


# ── Task 1: budget knob (bounds-checked) ─────────────────────────────────────

def _settings_with(**kw):
    """A minimal app_settings-like object (only the attrs we set)."""
    return SimpleNamespace(**kw)


def test_budget_resolves_configured_value():
    """A configured 1500 resolves to 1500 (SC#2 happy path)."""
    assert resolve_skill_catalog_budget(_settings_with(skill_catalog_max_tokens=1500)) == 1500
    assert resolve_skill_catalog_budget(_settings_with(skill_catalog_max_tokens=800)) == 800


def test_budget_zero_is_kill_switch():
    """0 resolves to 0 — the caller treats 0 as inject-all (D-04 kill switch)."""
    assert resolve_skill_catalog_budget(_settings_with(skill_catalog_max_tokens=0)) == 0


def test_budget_negative_or_invalid_clamps_to_zero():
    """A negative / non-int admin value clamps to 0 — never negative/NaN token math (T-140-05)."""
    assert resolve_skill_catalog_budget(_settings_with(skill_catalog_max_tokens=-500)) == 0
    assert resolve_skill_catalog_budget(_settings_with(skill_catalog_max_tokens="not-an-int")) == 0
    assert resolve_skill_catalog_budget(_settings_with(skill_catalog_max_tokens=None)) == 0
    assert resolve_skill_catalog_budget(_settings_with(skill_catalog_max_tokens=float("nan"))) == 0


def test_budget_missing_attr_defaults_to_1500():
    """A settings object missing the attr resolves to the 1500 default (D-04)."""
    assert resolve_skill_catalog_budget(_settings_with()) == 1500
    # A string-typed integer coerces cleanly (DB rows can round-trip as text).
    assert resolve_skill_catalog_budget(_settings_with(skill_catalog_max_tokens="1500")) == 1500

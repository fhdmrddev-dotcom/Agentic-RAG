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

from app.services.context_window import PIN_BUDGET_FRACTION, estimate_tokens
from app.services.skill_lint import LOAD_SKILL_POLICY
from app.services.skill_catalog_filter import (
    _CATALOG_TRIM_MARKER_TMPL,
    _recently_loaded_skill_names,
    build_skill_catalog_block,
    resolve_skill_catalog_budget,
)


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


# ── Task 2: build_skill_catalog_block pure fn ────────────────────────────────

_MODEL = ""  # chars/4 heuristic → deterministic token math (no tiktoken dependency)
_HEADER = f"\n\n## Available Skills\nThe following skills are available. {LOAD_SKILL_POLICY}\n"


def _skill(sid: str, name: str, desc_len: int = 300) -> dict:
    """A skill row shaped like today's `.select('id, name, description')` result."""
    return {"id": sid, "name": name, "description": name[0] * desc_len}


def _today_block(enabled: list[dict]) -> str:
    """Reproduce agent_loop.py:1216-1224's EXACT catalog note, independently of the
    module under test — the byte-identity source of truth."""
    lines = "\n".join(
        f"- **{s['name']}**: {s['description']}"
        for s in sorted(enabled, key=lambda s: s["name"])
    )
    return f"\n\n## Available Skills\nThe following skills are available. {LOAD_SKILL_POLICY}\n{lines}"


def _line(s: dict) -> str:
    return f"- **{s['name']}**: {s['description']}"


_MARKER_PHRASE = "additional skill(s) exist"


def test_fits_budget_byte_identical():
    """SC#1 / D-03: a small catalog under budget returns BYTE-IDENTICAL to today's block,
    with NO trim marker and no dependence on sim_by_id (fast path takes no embedding)."""
    enabled = [
        _skill("b", "Bravo", 40),
        _skill("a", "Alpha", 40),
        _skill("c", "Charlie", 40),
    ]
    out = build_skill_catalog_block(enabled, 100_000, _MODEL, set(), None)
    assert out == _today_block(enabled)
    assert _MARKER_PHRASE not in out
    # Even with a populated sim_by_id, the fits path stays byte-identical.
    out2 = build_skill_catalog_block(enabled, 100_000, _MODEL, set(), {"a": 0.1, "b": 0.9, "c": 0.5})
    assert out2 == _today_block(enabled)


def test_over_budget_cuts_least_relevant():
    """SC#1: over budget → the lowest-similarity skill is cut, higher-sim kept, ≤ budget."""
    skills = [
        _skill("a", "Alpha"),
        _skill("b", "Bravo"),
        _skill("c", "Charlie"),
        _skill("d", "Delta"),
        _skill("e", "Echo"),
    ]
    sim = {"a": 0.9, "b": 0.8, "c": 0.7, "d": 0.6, "e": 0.05}  # Echo clearly least relevant
    two_keep = _HEADER + _line(skills[0]) + "\n" + _line(skills[1])
    budget = estimate_tokens(two_keep, _MODEL) + 40  # fits ~2 lines + marker, not all 5
    out = build_skill_catalog_block(skills, budget, _MODEL, set(), sim)
    assert "Echo" not in out          # lowest-sim cut first
    assert "Alpha" in out             # highest-sim retained
    assert estimate_tokens(out, _MODEL) <= budget


def test_marker_appended_with_count():
    """SC#3 / D-14: any cut appends the honest marker carrying the real N-cut count."""
    skills = [_skill(c, c.capitalize()) for c in ("alpha", "bravo", "charlie", "delta", "echo")]
    sim = {"alpha": 0.9, "bravo": 0.8, "charlie": 0.7, "delta": 0.6, "echo": 0.5}
    two_keep = _HEADER + _line(skills[0]) + "\n" + _line(skills[1])
    budget = estimate_tokens(two_keep, _MODEL) + 40
    out = build_skill_catalog_block(skills, budget, _MODEL, set(), sim)
    # 5 enabled, 2 kept → 3 cut.
    assert out.endswith(_CATALOG_TRIM_MARKER_TMPL.format(n=3))
    assert "3 additional skill(s) exist" in out


def test_pinned_always_kept():
    """D-02: a pinned/recent skill at the LOWEST similarity is retained over-budget,
    while a non-pinned low-sim skill is cut."""
    skills = [
        _skill("a", "Alpha"),
        _skill("b", "Bravo"),
        _skill("c", "Charlie"),
        _skill("d", "Delta"),
        _skill("e", "Echo"),
    ]
    sim = {"a": 0.9, "b": 0.8, "c": 0.7, "d": 0.1, "e": 0.02}  # Echo lowest, but pinned
    two_keep = _HEADER + _line(skills[0]) + "\n" + _line(skills[1])
    budget = estimate_tokens(two_keep, _MODEL) + 40
    out = build_skill_catalog_block(skills, budget, _MODEL, {"e"}, sim)
    assert "Echo" in out              # pinned, lowest sim, still kept (D-02)
    assert "Delta" not in out         # non-pinned low-sim cut


def test_budget_zero_injects_all():
    """SC#2 / D-04: budget <= 0 returns the full byte-identical block (kill switch)."""
    skills = [_skill("a", "Alpha"), _skill("b", "Bravo"), _skill("c", "Charlie")]
    out = build_skill_catalog_block(skills, 0, _MODEL, set(), {"a": 0.1})
    assert out == _today_block(skills)
    assert _MARKER_PHRASE not in out
    # A negative budget resolves upstream to 0, but guard here too.
    assert build_skill_catalog_block(skills, -10, _MODEL, set(), None) == _today_block(skills)


def test_fail_open_on_none_sim():
    """D-05: sim_by_id=None over budget → trim by name order only, never raise, marker present."""
    skills = [
        _skill("a", "Alpha"),
        _skill("b", "Bravo"),
        _skill("c", "Charlie"),
        _skill("d", "Delta"),
        _skill("e", "Echo"),
    ]
    two_keep = _HEADER + _line(skills[0]) + "\n" + _line(skills[1])
    budget = estimate_tokens(two_keep, _MODEL) + 40
    out = build_skill_catalog_block(skills, budget, _MODEL, set(), None)  # no exception
    assert "Alpha" in out             # name-first kept under fail-open
    assert _MARKER_PHRASE in out      # honest marker still appended
    assert estimate_tokens(out, _MODEL) <= budget


def test_pin_cap_does_not_starve_menu():
    """D-02 pin cap: pins beyond PIN_BUDGET_FRACTION of the budget are dropped so a
    high-relevance non-pinned skill still reaches the menu."""
    skills = [
        _skill("p1", "Pin1"),
        _skill("p2", "Pin2"),
        _skill("p3", "Pin3"),
        _skill("h", "Hero"),
    ]
    sim = {"p1": 0.01, "p2": 0.01, "p3": 0.01, "h": 0.99}  # Hero is the relevant one
    # Budget big enough for ~1 pin + Hero; pin cap (1/3 budget) fits only ONE pin line.
    one_pin_plus_hero = _HEADER + _line(skills[0]) + "\n" + _line(skills[3])
    budget = estimate_tokens(one_pin_plus_hero, _MODEL) + 60
    assert estimate_tokens(_line(skills[0]), _MODEL) <= int(budget * PIN_BUDGET_FRACTION)
    assert estimate_tokens(_line(skills[0]) + "\n" + _line(skills[1]), _MODEL) > int(budget * PIN_BUDGET_FRACTION)
    out = build_skill_catalog_block(skills, budget, _MODEL, {"p1", "p2", "p3"}, sim)
    assert "Hero" in out              # non-pinned relevant skill not starved by pins
    # At least two of the three pins were capped out (only ~1 fits the pin budget).
    kept_pins = sum(1 for n in ("Pin1", "Pin2", "Pin3") if n in out)
    assert kept_pins <= 1


def test_recently_loaded_skill_names_scan():
    """D-02 provenance: collect args.skill_name from history load_skill tool-calls."""
    rows = [
        {"tool_calls": [{"name": "load_skill", "args": {"skill_name": "pdf-tools"}}]},
        {"tool_calls": [{"name": "search_documents", "args": {"query": "x"}}]},
        {"tool_calls": [
            {"name": "load_skill", "args": {"skill_name": "excel"}},
            {"name": "load_skill", "args": {"skill_name": "pdf-tools"}},
        ]},
        {"tool_calls": None},
        {},
    ]
    assert _recently_loaded_skill_names(rows) == {"pdf-tools", "excel"}
    assert _recently_loaded_skill_names(None) == set()
    assert _recently_loaded_skill_names([]) == set()
    # load_skill with missing/empty skill_name contributes nothing.
    rows2 = [
        {"tool_calls": [{"name": "load_skill", "args": {}}]},
        {"tool_calls": [{"name": "load_skill"}]},
        {"tool_calls": [{"name": "load_skill", "args": {"skill_name": ""}}]},
    ]
    assert _recently_loaded_skill_names(rows2) == set()


def test_mixed_sim_none_safe_sorts_last():
    """Blocker-3 / T-140-14: a MIXED sim_by_id (real floats + None — the real LEFT-JOIN
    shape) must NOT raise, and the None-scored skill sorts LAST (cut before real-scored)."""
    skills = [
        _skill("a", "Alpha"),
        _skill("b", "Bravo"),
        _skill("c", "Charlie"),
    ]
    # Charlie has NO vector (None) alongside real floats. -(None) would TypeError if the
    # score resolver used dict.get(id, -1.0) — the present-but-None trap (Blocker-3).
    sim = {"a": 0.9, "b": 0.5, "c": None}
    partial = _HEADER + _line(skills[0]) + "\n" + _line(skills[1])
    budget = estimate_tokens(partial, _MODEL) + estimate_tokens(
        _CATALOG_TRIM_MARKER_TMPL.format(n=1), _MODEL
    ) + 3  # fits exactly 2 skills + marker
    out = build_skill_catalog_block(skills, budget, _MODEL, set(), sim)  # must not raise
    assert "Charlie" not in out       # None-scored sorts last → cut first
    assert "Alpha" in out             # highest real sim kept
    assert "Bravo" in out             # low-but-real sim kept over the None one


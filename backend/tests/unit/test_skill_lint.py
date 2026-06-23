"""Unit tests for the deterministic skill-description lint (TRIG-03 / D-09 / D-11).

These exercise `skill_lint.lint_description` — a PURE, no-LLM, no-I/O heuristic that
returns a list of {code, message} warnings (EMPTY = healthy) and NEVER raises. Each
test also confirms the never-block contract: malformed input returns a list, not an
exception. Plus a structural assertion that the shared D-01 policy constant exists so
the Tuner (Plan 03) and the agent_loop catalog note import ONE source of truth.
"""
from __future__ import annotations

import pytest

from app.services.skill_lint import (
    GENERIC_PHRASES,
    LOAD_SKILL_POLICY,
    MAX_DESCRIPTION_CHARS,
    MIN_DESCRIPTION_CHARS,
    NAME_ECHO_RATIO,
    TRIGGER_VERBS,
    lint_description,
)


def _codes(warnings: list[dict]) -> set[str]:
    return {w["code"] for w in warnings}


def _assert_well_formed(warnings: list[dict]) -> None:
    """Every warning is a {code, message} dict with non-empty, specific message."""
    assert isinstance(warnings, list)
    for w in warnings:
        assert isinstance(w, dict)
        assert "code" in w and "message" in w
        assert isinstance(w["code"], str) and w["code"]
        assert isinstance(w["message"], str) and w["message"].strip()
        # Never a generic "weak description" — message must name the specific reason.
        assert w["message"].strip().lower() != "weak description"


# ── empty ────────────────────────────────────────────────────────────────────

def test_empty_description_warns_empty():
    assert "empty" in _codes(lint_description("My Skill", "", []))


def test_whitespace_only_description_warns_empty():
    warnings = lint_description("My Skill", "   \n\t  ", [])
    assert "empty" in _codes(warnings)
    _assert_well_formed(warnings)


# ── too_short ──────────────────────────────────────────────────────────────────

def test_short_nonempty_description_warns_too_short():
    short = "Use to draft"  # non-empty, < MIN_DESCRIPTION_CHARS (25)
    assert len(short) < MIN_DESCRIPTION_CHARS
    warnings = lint_description("Drafter", short, [])
    assert "too_short" in _codes(warnings)


def test_empty_does_not_also_warn_too_short():
    # An empty description is "empty", not "too_short" — only one length verdict.
    assert "too_short" not in _codes(lint_description("X", "", []))


# ── too_long (STD-01 free hint) ─────────────────────────────────────────────────

def test_overlong_description_warns_too_long():
    long = "Use to generate reports. " * 100  # well over MAX_DESCRIPTION_CHARS
    assert len(long) > MAX_DESCRIPTION_CHARS
    warnings = lint_description("Reporter", long, [])
    assert "too_long" in _codes(warnings)


# ── name_echo ──────────────────────────────────────────────────────────────────

def test_description_echoing_name_warns_name_echo():
    # >60% of the description tokens are just the skill name.
    warnings = lint_description(
        "Quarterly Risk Register",
        "Quarterly Risk Register risk register quarterly",
        [],
    )
    assert "name_echo" in _codes(warnings)


def test_healthy_description_does_not_warn_name_echo():
    warnings = lint_description(
        "Quarterly Risk Register",
        "Use to generate a quarterly risk register from KB documents",
        [],
    )
    assert "name_echo" not in _codes(warnings)


# ── no_trigger_verb ─────────────────────────────────────────────────────────────

def test_description_without_trigger_verb_warns():
    # A long-enough, non-generic description that contains none of TRIGGER_VERBS.
    desc = "Quarterly financial reporting spreadsheet metadata fields columns."
    warnings = lint_description("Sheet Fields", desc, [])
    assert "no_trigger_verb" in _codes(warnings)


def test_description_with_trigger_verb_does_not_warn():
    desc = "Use to generate a quarterly risk register from KB documents"
    assert "no_trigger_verb" not in _codes(lint_description("RR", desc, []))


# ── generic ────────────────────────────────────────────────────────────────────

def test_generic_phrase_description_warns_generic():
    desc = "This skill helps with various tasks and is useful for general purpose work."
    warnings = lint_description("Helper", desc, [])
    assert "generic" in _codes(warnings)


def test_specific_description_does_not_warn_generic():
    desc = "Use to generate a quarterly risk register from KB documents"
    assert "generic" not in _codes(lint_description("RR", desc, []))


# ── duplicate ──────────────────────────────────────────────────────────────────

def test_duplicate_sibling_description_warns_duplicate():
    desc = "Use to generate a quarterly risk register from KB documents"
    siblings = ["use to GENERATE a Quarterly Risk Register from KB documents"]  # case/space variant
    warnings = lint_description("RR2", desc, siblings)
    assert "duplicate" in _codes(warnings)


def test_unique_description_does_not_warn_duplicate():
    desc = "Use to generate a quarterly risk register from KB documents"
    siblings = ["Use to draft a board meeting agenda from calendar entries"]
    assert "duplicate" not in _codes(lint_description("RR", desc, siblings))


# ── healthy ────────────────────────────────────────────────────────────────────

def test_healthy_description_returns_empty_list():
    desc = "Use to generate a quarterly risk register from KB documents"
    warnings = lint_description("Quarterly Risk Register", desc, [])
    assert warnings == []


# ── never-raises contract (D-09 / D-11 / T-123-01-03) ───────────────────────────

@pytest.mark.parametrize(
    "case_id",
    ["none", "ints", "huge", "unicode", "bad_siblings", "wrong_types", "empty"],
)
def test_lint_description_never_raises(case_id):
    # Built indirectly (not embedded in the param id) so the "huge" case does not
    # blow past Windows' 32767-char PYTEST_CURRENT_TEST env-var limit.
    cases = {
        "none": (None, None, None),
        "ints": (123, 456, 789),
        "huge": ("X", "Use to " + "y" * 50_000, []),  # >> MAX_DESCRIPTION_CHARS
        "unicode": ("名前", "説明文 🚀 émojî ünïcödé ☃", ["déjà vu"]),
        "bad_siblings": ("X", "ok", [None, 5, {"not": "a str"}]),
        "wrong_types": ([], {}, "not-a-list"),
        "empty": ("", "", []),
    }
    name, description, siblings = cases[case_id]
    result = lint_description(name, description, siblings)
    assert isinstance(result, list)
    _assert_well_formed(result)


# ── shared D-01 policy constant (Pitfall 1 fidelity guard) ──────────────────────

def test_load_skill_policy_constant_exists_and_is_relaxed():
    assert isinstance(LOAD_SKILL_POLICY, str) and LOAD_SKILL_POLICY.strip()
    # The relaxed policy tells the model to fire on description match...
    assert "load_skill" in LOAD_SKILL_POLICY
    # ...and must NOT carry the old over-conservative wording.
    assert "ONLY call" not in LOAD_SKILL_POLICY
    assert "Never auto-load" not in LOAD_SKILL_POLICY


def test_tunable_constants_have_expected_defaults():
    assert MIN_DESCRIPTION_CHARS == 25
    assert MAX_DESCRIPTION_CHARS == 1024
    assert NAME_ECHO_RATIO == 0.6
    assert isinstance(TRIGGER_VERBS, set) and TRIGGER_VERBS
    assert isinstance(GENERIC_PHRASES, set) and GENERIC_PHRASES

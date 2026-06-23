"""Deterministic, no-LLM skill-description lint (TRIG-03 / D-09 / D-11).

A PURE module: no I/O, no LLM, no DB, and it NEVER raises. ``lint_description``
returns a list of ``{"code", "message"}`` warnings — an EMPTY list means the
description is healthy. Every caller (the human Skills form POST/PATCH and the
agent's ``save_skill`` tool) decides what to do with the warnings; per D-09 none
of them block the save. The defensive wrapping mirrors
``context_window._parse_model_limits``: malformed input yields partial/empty
results rather than an exception.

This module also owns ``LOAD_SKILL_POLICY`` — the relaxed D-01 ``## Available
Skills`` catalog-note policy string. ``agent_loop.py`` imports it for the runtime
catalog note and the Plan 03 Tuner classifier imports the SAME constant, so both
surfaces measure ONE source of truth (Pitfall 1 fidelity guard).
"""
from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

# ── Tunable heuristic constants (Claude's-discretion defaults, D-11) ────────────
MIN_DESCRIPTION_CHARS = 25          # below this (and non-empty) = "too_short"
MAX_DESCRIPTION_CHARS = 1024        # STD-01 ≤1024 hint — free length-bound
NAME_ECHO_RATIO = 0.6               # > this fraction of desc tokens are just the name = "name_echo"

# A trigger verb signals an actionable description ("Use to generate…", "Convert…").
TRIGGER_VERBS: set[str] = {
    "use", "when", "for", "to", "generate", "create", "analyze", "analyse",
    "summarize", "summarise", "convert", "build", "extract", "format", "draft",
    "produce", "compute", "calculate", "render", "transform", "fill", "compose",
    "write", "compile", "parse", "translate", "classify", "score", "review",
    "validate", "plan", "schedule", "track", "search", "find", "answer",
    "explain", "describe", "compare", "evaluate", "rank", "filter", "map",
}

# Filler phrases that describe nothing concrete.
GENERIC_PHRASES: set[str] = {
    "a skill", "this skill", "helps with", "various tasks", "general purpose",
    "useful for", "does things", "do things", "all kinds", "many things",
    "lots of things", "different tasks", "any task", "general use", "misc",
    "miscellaneous", "stuff", "things in general", "and more", "etc",
}

# ── The relaxed D-01 catalog-note policy (Pitfall 1 fidelity guard) ─────────────
# This is the SINGLE source of truth for the production load_skill firing policy.
# agent_loop.py interpolates it into the "## Available Skills" note and the Plan 03
# Tuner classifier imports it so it measures the REAL production policy. It must
# reconcile with LOAD_SKILL_TOOL.description ("Use when the user's request matches
# a skill in the catalog.") — both surfaces tell ONE story (D-01).
LOAD_SKILL_POLICY: str = (
    "Call `load_skill(skill_name)` when the user's request clearly matches one of "
    "these skill descriptions. Match on intent, not just exact names. Do not load a "
    "skill for an unrelated request."
)

_WORD_RE = re.compile(r"[^\W_]+", re.UNICODE)


def _safe_str(value: object) -> str:
    """Coerce any input to a stripped string; never raises."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    try:
        return str(value).strip()
    except Exception:  # pragma: no cover — defensive
        return ""


def _tokens(text: str) -> list[str]:
    """Lowercased word tokens (unicode-aware); never raises."""
    try:
        return [t.lower() for t in _WORD_RE.findall(text)]
    except Exception:  # pragma: no cover — defensive
        return []


def _normalize(text: str) -> str:
    """Collapse whitespace + lowercase for case-insensitive comparison."""
    return " ".join(_safe_str(text).lower().split())


def _name_echo_ratio(name: str, description: str) -> float:
    """Fraction of description tokens that are also tokens of the skill name."""
    desc_tokens = _tokens(description)
    if not desc_tokens:
        return 0.0
    name_tokens = set(_tokens(name))
    if not name_tokens:
        return 0.0
    echoed = sum(1 for t in desc_tokens if t in name_tokens)
    return echoed / len(desc_tokens)


def _has_trigger_verb(description: str) -> bool:
    return any(t in TRIGGER_VERBS for t in _tokens(description))


def _is_generic(description: str) -> bool:
    low = _normalize(description)
    return any(phrase in low for phrase in GENERIC_PHRASES)


def _is_duplicate(description: str, sibling_descriptions: object) -> bool:
    target = _normalize(description)
    if not target:
        return False
    try:
        siblings = list(sibling_descriptions) if sibling_descriptions else []
    except TypeError:
        return False
    for sib in siblings:
        if _normalize(_safe_str(sib)) == target:
            return True
    return False


def lint_description(
    name: str,
    description: str,
    sibling_descriptions: list[str],
) -> list[dict]:
    """Lint a skill description; return a list of ``{code, message}`` warnings.

    EMPTY list = healthy. NEVER raises (D-09/D-11/T-123-01-03) — malformed input
    degrades to partial/empty warnings. Each message names the SPECIFIC reason
    (never a generic "weak description"). Callers never block on the result.
    """
    warnings: list[dict] = []
    try:
        n = _safe_str(name)
        d = _safe_str(description)

        # Length verdict — exactly one of empty / too_short / too_long (length-wise).
        if not d:
            warnings.append({
                "code": "empty",
                "message": (
                    "Description is empty. Add one sentence describing what the skill "
                    "does so the agent knows when to load it."
                ),
            })
        else:
            if len(d) < MIN_DESCRIPTION_CHARS:
                warnings.append({
                    "code": "too_short",
                    "message": (
                        f"Description is very short ({len(d)} chars). Aim for at least "
                        f"{MIN_DESCRIPTION_CHARS} characters so the trigger is specific."
                    ),
                })
            if len(d) > MAX_DESCRIPTION_CHARS:
                warnings.append({
                    "code": "too_long",
                    "message": (
                        f"Description is long ({len(d)} chars, over {MAX_DESCRIPTION_CHARS}). "
                        "Keep it to one focused sentence; move detail into the instructions."
                    ),
                })

        # Quality checks only when there is something to inspect.
        if d:
            if _name_echo_ratio(n, d) > NAME_ECHO_RATIO:
                warnings.append({
                    "code": "name_echo",
                    "message": (
                        "Description mostly repeats the skill name. Describe what it does "
                        "and when to use it, not just the name."
                    ),
                })
            if not _has_trigger_verb(d):
                warnings.append({
                    "code": "no_trigger_verb",
                    "message": (
                        "Description has no action/trigger verb (e.g. 'Use to…', "
                        "'Generate…', 'Convert…'). Add one so the agent knows when to fire it."
                    ),
                })
            if _is_generic(d):
                warnings.append({
                    "code": "generic",
                    "message": (
                        "Description is generic ('helps with various tasks'). Name the "
                        "concrete task and inputs so the trigger is distinctive."
                    ),
                })
            if _is_duplicate(d, sibling_descriptions):
                warnings.append({
                    "code": "duplicate",
                    "message": (
                        "Description duplicates another of your skills. Make it distinct so "
                        "the agent can tell them apart."
                    ),
                })
    except Exception:  # pragma: no cover — D-09: lint must never raise
        logger.debug("lint_description swallowed an unexpected error", exc_info=True)
    return warnings

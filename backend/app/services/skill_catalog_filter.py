"""Phase 140 (TRIG-02) — the DB-free heart of the skill-catalog pre-filter.

This module owns the *pure* logic Plan 04 wires into the agent hot path
(``agent_loop.py`` ``skill_catalog_override is None`` branch, D-06):

  * ``resolve_skill_catalog_budget`` — resolve the global, admin-tunable token budget
    for the ``## Available Skills`` block from ``app_settings`` and bounds-check it
    (0/negative/invalid => 0 = inject-all kill switch; D-04 / T-140-05).
  * ``build_skill_catalog_block`` — deterministic string builder. Fits budget =>
    BYTE-IDENTICAL to today's catalog note (D-03 fast path). Over budget => keep
    pinned/recent + top-similarity, name-sorted display, honest ``_CATALOG_TRIM_MARKER``
    (SC#1 + SC#3 / D-14). Never crashes (D-05 fail-open, Blocker-3 None-safe sort).
  * ``_recently_loaded_skill_names`` — derive the always-keep pin set from history
    ``load_skill`` tool-calls (D-02 pin provenance).

Deliberately has NO DB and NO LLM dependency: the embedding + ``match_skills`` RPC live
in Plan 04's hot-path wiring; this file is unit-testable in isolation so SC#1/SC#2/SC#3
+ fail-open + Blocker-3 are proven deterministically before any hot-path risk.
"""
from __future__ import annotations


def resolve_skill_catalog_budget(app_settings) -> int:
    """Return the global token budget for the ``## Available Skills`` block.

    The value lives in ``app_settings.skill_catalog_max_tokens`` (a global, admin-tunable
    knob — D-04). It is UNTRUSTED input into hot-path token math (T-140-05), so it is
    bounds-checked here:

      * a valid positive int => that int,
      * ``0`` or negative => ``0`` (clean disable = today's inject-all kill switch),
      * a non-int / ``None`` / ``NaN`` => ``0`` (fail safe to inject-all, never negative/NaN
        token math).

    A missing attribute resolves to the ``1500`` default (D-04 default-ON, safe by
    construction because ``build_skill_catalog_block`` leaves small catalogs byte-identical).
    """
    raw = getattr(app_settings, "skill_catalog_max_tokens", 1500)
    try:
        budget = int(raw)
    except (TypeError, ValueError):
        return 0  # invalid admin value => disable, never corrupt token accounting
    return budget if budget > 0 else 0

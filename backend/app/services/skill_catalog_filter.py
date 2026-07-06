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

from app.services.context_window import PIN_BUDGET_FRACTION, estimate_tokens
from app.services.skill_lint import LOAD_SKILL_POLICY


# The honest, never-silent truncation marker (mirrors context_window.py `_TRIM_MARKER`,
# CTX-03 D-14 / D-02). The escape hatch it advertises is REAL: `load_skill` loads any
# enabled skill by exact name even when it was trimmed out of the menu
# (tool_dispatcher.py `_handle_load_skill` — name + is_enabled, catalog-independent).
_CATALOG_TRIM_MARKER_TMPL = (
    "\n- _[{n} additional skill(s) exist that weren't listed here to fit the catalog "
    "budget. Ask me to list all skills, or name one directly and I'll load it.]_"
)

# The header the fits-budget fast path MUST reproduce BYTE-IDENTICALLY (agent_loop.py
# :1216-1224). A whitespace/format drift here silently regresses every provider's catalog.
_CATALOG_HEADER = (
    f"\n\n## Available Skills\nThe following skills are available. {LOAD_SKILL_POLICY}\n"
)


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


def _recently_loaded_skill_names(history_rows: list[dict] | None) -> set[str]:
    """Derive the always-keep pin set (D-02) from raw history rows.

    Scans each row's ``tool_calls`` for a ``load_skill`` call and collects its
    ``args.skill_name`` (mirrors the ``_pinned_skill`` provenance at
    ``agent_loop.py:915-917``). Returns skill NAMES; Plan 04 maps them to ids against
    the enabled set (id-keyed pins avoid the owner/global name-collision, SEED-102).

    Runs BEFORE ``_reconstruct_history`` (the catalog is injected before history is
    rebuilt into messages), so it reads the raw ``history_resp.data`` row shape.
    """
    names: set[str] = set()
    for row in history_rows or []:
        for tc in (row.get("tool_calls") or []):
            if tc.get("name") == "load_skill":
                nm = (tc.get("args") or {}).get("skill_name")
                if nm:
                    names.add(nm)
    return names


def _line(s: dict) -> str:
    """Today's exact catalog line format (agent_loop.py:1217)."""
    return f"- **{s['name']}**: {s['description']}"


def _block(rows: list[dict]) -> str:
    """Header + name-order lines — byte-identical to today's catalog note."""
    return _CATALOG_HEADER + "\n".join(_line(s) for s in rows)


def _score(sim_by_id: dict | None, sid: str) -> float:
    """None-SAFE similarity resolver (Blocker-3 / T-140-14).

    A present-but-``None`` value (the normal LEFT-JOIN shape when a skill has no current
    vector) resolves to the SAME ``-1.0`` sentinel as a missing key — so it sorts last but
    stays eligible (fail-open keep). Critically NOT ``(sim_by_id or {}).get(sid, -1.0)``:
    ``dict.get`` returns the stored ``None`` when the key IS present, and ``-(None)`` would
    raise ``TypeError`` and crash the turn — a D-05 violation, because this function runs
    OUTSIDE Plan 04's try/except.
    """
    raw = (sim_by_id or {}).get(sid)
    return raw if raw is not None else -1.0


def _cap_pins(pinned: list[dict], budget: int, model: str) -> list[dict]:
    """Keep as many pinned/recent skills as fit within ``PIN_BUDGET_FRACTION`` of the
    budget (name order), dropping the overflow so pins can never starve the whole menu
    (D-02 pin cap, mirrors context_window.py PIN_BUDGET_FRACTION). Dropped pins are still
    disclosed via the honest marker + remain loadable by name (escape hatch)."""
    pin_budget = max(0, int(budget * PIN_BUDGET_FRACTION))
    capped: list[dict] = []
    for s in sorted(pinned, key=lambda x: x["name"]):
        trial_lines = "\n".join(_line(x) for x in capped + [s])
        if estimate_tokens(trial_lines, model) <= pin_budget:
            capped.append(s)
        # else: this pin overflows the pin cap → drop (disclosed via the marker)
    return capped


def build_skill_catalog_block(
    enabled: list[dict],
    budget: int,
    model: str,
    pinned_recent_ids: set[str] | None,
    sim_by_id: dict[str, float | None] | None,
) -> str:
    """Assemble the ``## Available Skills`` note (pure — no DB, no LLM).

    Args:
        enabled: ``[{id, name, description}]`` — today's owner+global enabled skill set.
        budget: ``resolve_skill_catalog_budget(...)``; ``<= 0`` => inject-all (kill switch).
        model: for ``estimate_tokens`` (tiktoken for OpenAI, chars/4 otherwise).
        pinned_recent_ids: id set force-kept even at low similarity (D-02 always-keep).
        sim_by_id: ``match_skills`` similarities (``None`` per-id or whole-dict => fail-open).

    Fits budget => BYTE-IDENTICAL to today's block, no marker (D-03 fast path, SC#1).
    Over budget => force-keep capped pins + greedily fill by similarity desc, cut the
    least-relevant first, name-sorted DISPLAY, and append the honest ``_CATALOG_TRIM_MARKER``
    with the real N-cut (SC#1 + SC#3 / D-14). Never raises (D-05, Blocker-3).
    """
    pinned_recent_ids = pinned_recent_ids or set()
    by_name = sorted(enabled, key=lambda s: s["name"])
    full = _block(by_name)

    # D-03 fast path: budget disabled OR the full catalog fits → byte-identical, no marker.
    # (Plan 04 also skips the embedding call entirely on this branch.)
    if budget <= 0 or estimate_tokens(full, model) <= budget:
        return full

    # Over budget: force-keep pinned/recent (capped), then greedy by similarity desc.
    # DISPLAY order is name-sorted in BOTH paths — selection is by relevance, presentation
    # is stable (keeps the fast-path byte-identity clean, hides the ranking from the model).
    pinned = [s for s in enabled if s["id"] in pinned_recent_ids]
    rest = [s for s in enabled if s["id"] not in pinned_recent_ids]
    rest.sort(key=lambda s: (-_score(sim_by_id, s["id"]), s["name"]))  # None-safe; name tiebreak

    kept: list[dict] = []
    for s in _cap_pins(pinned, budget, model) + rest:
        trial = kept + [s]
        n_cut = len(enabled) - len(trial)
        candidate = _block(sorted(trial, key=lambda x: x["name"]))
        if n_cut > 0:
            candidate += _CATALOG_TRIM_MARKER_TMPL.format(n=n_cut)
        # Pins are force-kept (D-02); non-pins keep only while the block (incl. marker) fits.
        if estimate_tokens(candidate, model) <= budget or s["id"] in pinned_recent_ids:
            kept.append(s)
        # else: skip this skill (least-relevant cut first — SC#1)

    n_cut = len(enabled) - len(kept)
    out = _block(sorted(kept, key=lambda s: s["name"]))
    if n_cut > 0:
        out += _CATALOG_TRIM_MARKER_TMPL.format(n=n_cut)  # never silent (D-14)
    return out

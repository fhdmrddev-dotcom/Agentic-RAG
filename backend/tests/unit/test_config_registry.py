"""Phase 122 (MP-02 / D-122-04) — MODEL_CAPABILITIES registry invariants for the
single explicit ``emit_tier`` enum.

This replaces the implicit two-bool forcing guess (``forced_emission`` +
``strict_json_schema``) with ONE doc-verified ``emit_tier`` on every registry row:
``force_strict | force | coerce``. The invariants below are the load-bearing trust
property — a wrong tier could over-claim a forcing/strict path a provider cannot
reach (T-122-01-03 / Spoofing). The exact counts (14 force_strict / 2 deepseek-force /
34 force / 5 coerce) lock the locked migration mapping (122-PATTERNS.md table).

The registry symbols EXIST today, so a module-top import is fine (mirrors
``test_gateway_forcing.py:1-33`` style — unlike the in-body convention used for
not-yet-existing symbols).
"""

from __future__ import annotations

from app.config import MODEL_CAPABILITIES, get_model_capability

_VALID_TIERS = ("force_strict", "force", "coerce")


def test_every_row_has_emit_tier():
    """Every MODEL_CAPABILITIES row carries an explicit emit_tier in the enum
    (D-122-04, SC#2). No row may rely on the implicit default at the registry layer —
    the migration makes the tier the single source of truth on every row."""
    for model_id, cap in MODEL_CAPABILITIES.items():
        assert cap.get("emit_tier") in _VALID_TIERS, (
            f"{model_id} has emit_tier={cap.get('emit_tier')!r}, expected one of {_VALID_TIERS}"
        )


def test_force_strict_is_openai_only():
    """Every emit_tier==force_strict row is provider==openai, and there are EXACTLY
    14 such rows (D-122-04, SC#2). force_strict means 'OpenAI by measurement, not by
    name' — a token-level strict json_schema guarantee that only OpenAI actually
    honors (DeepSeek's strict is inert without a /beta base_url we never set)."""
    force_strict_ids = [
        model_id
        for model_id, cap in MODEL_CAPABILITIES.items()
        if cap.get("emit_tier") == "force_strict"
    ]
    for model_id in force_strict_ids:
        assert MODEL_CAPABILITIES[model_id].get("provider") == "openai", (
            f"{model_id} is force_strict but provider != openai"
        )
    assert len(force_strict_ids) == 14, (
        f"expected exactly 14 force_strict rows, found {len(force_strict_ids)}: {force_strict_ids}"
    )


def test_no_non_openai_force_strict():
    """0 rows with emit_tier==force_strict and provider!=openai (D-122-04, SC#2).
    The complement of test_force_strict_is_openai_only — asserts the leak direction
    explicitly so a non-OpenAI row can never claim token-level strict it cannot reach."""
    leaks = [
        model_id
        for model_id, cap in MODEL_CAPABILITIES.items()
        if cap.get("emit_tier") == "force_strict" and cap.get("provider") != "openai"
    ]
    assert leaks == [], f"non-OpenAI rows wrongly tagged force_strict: {leaks}"


def test_deepseek_is_force():
    """Every provider==deepseek row is emit_tier==force (never force_strict) —
    DeepSeek strict is INERT without the /beta base_url we never set (D-122-04,
    Pitfall 3). The 2 DeepSeek rows are DEMOTED from their old strict_json_schema:True."""
    deepseek_ids = [
        model_id
        for model_id, cap in MODEL_CAPABILITIES.items()
        if cap.get("provider") == "deepseek"
    ]
    assert len(deepseek_ids) == 2, f"expected 2 deepseek rows, found {deepseek_ids}"
    for model_id in deepseek_ids:
        assert MODEL_CAPABILITIES[model_id].get("emit_tier") == "force", (
            f"{model_id} (deepseek) must be emit_tier=force (strict is inert), "
            f"got {MODEL_CAPABILITIES[model_id].get('emit_tier')!r}"
        )


def test_glm_zhipu_is_force():
    """provider==zhipu (GLM) rows resolve to emit_tier==force — kept, intentional,
    non-strict (D-122-04, SC#2). GLM forcing stays; only strict was never verified."""
    zhipu_ids = [
        model_id
        for model_id, cap in MODEL_CAPABILITIES.items()
        if cap.get("provider") == "zhipu"
    ]
    assert zhipu_ids, "expected GLM/Zhipu rows to be present in the registry"
    for model_id in zhipu_ids:
        assert MODEL_CAPABILITIES[model_id].get("emit_tier") == "force", (
            f"{model_id} (zhipu/GLM) must be emit_tier=force (kept, non-strict), "
            f"got {MODEL_CAPABILITIES[model_id].get('emit_tier')!r}"
        )


def test_emit_tier_counts_match_locked_migration():
    """The 55-row migration mapping is exactly 14 force_strict / 41 force / 5 coerce
    (122-PATTERNS.md table: 14 OpenAI force_strict; 2 deepseek + 34 other = 36...
    no — 14 + 2 + 34 = 50 forced; the 2 deepseek-force + 34 other-force = 36 force,
    plus 5 coerce). Lock the totals so a future row-add can't silently skew the split."""
    counts = {tier: 0 for tier in _VALID_TIERS}
    for cap in MODEL_CAPABILITIES.values():
        tier = cap.get("emit_tier")
        if tier in counts:
            counts[tier] += 1
    # 14 OpenAI force_strict; 2 deepseek (demoted) + 34 other forced = 36 force; 5 coerce.
    assert counts["force_strict"] == 14, counts
    assert counts["force"] == 36, counts
    assert counts["coerce"] == 5, counts
    assert sum(counts.values()) == 55, counts


def test_emit_tier_registry_miss_defaults_coerce():
    """A registry-miss / un-doc-verified model resolves emit_tier=coerce via the
    default-SAFE .get(..., 'coerce') read (D-122-05). The lookup never assumes
    forcing/strict it hasn't verified — a case-sensitivity miss SAFELY degrades."""
    cap = get_model_capability("totally-made-up-model-xyz")
    assert cap.get("emit_tier", "coerce") == "coerce"

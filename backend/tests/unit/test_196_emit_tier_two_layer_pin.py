"""A7 — the ``emit_tier`` vocabulary, pinned EQUAL across THREE layers.

WHY THIS FILE EXISTS (do not mistake it for ceremony and delete it).

Phase 196 makes ``emit_tier`` operator-settable. The value the operator writes then has to
survive three separate gates, and each one carries its own copy of the same three words:

  1. the SQL CHECK ``model_capabilities_overrides_emit_tier_check`` (migration 120) — the
     database's closed vocabulary, raising ``23514`` on anything else.
  2. ``app.services.forced_emit._RUNGS_BY_TIER`` — the recovery ladder actually keyed by the
     value at emission time.
  3. ``app.api.admin._MODEL_CAP_ENUM_COLUMNS["emit_tier"]`` — the PATCH allow-list, raising
     422 BEFORE any DB touch.

⚠ THE FAILURE MODE HERE IS SILENT, WHICH IS WHY IT IS A TEST AND NOT A COMMENT. Migration
114's sibling guard (``test_audit_event_registration.py``, BUG-260731-02) protects a vocabulary
whose drift at least KILLS a run loudly — a ``ValueError`` or a Postgres ``23514``. This one
does not. ``forced_emit.py:376-378`` reads::

    emit_tier = cap.get("emit_tier", "coerce")
    if emit_tier not in _RUNGS_BY_TIER:   # boundary guard
        emit_tier = "coerce"

so a tier layer 1 ACCEPTS and layer 2 does not recognise is silently rewritten to ``coerce``.
The operator sets "guaranteed format", the database stores it, the PATCH allows it, and the run
quietly degrades to best-effort with nobody told. There is no exception, no audit row and no log
line to find afterwards. Equality in BOTH directions is the only thing standing between an
operator's assertion and a lie.

Layer 3 is the one that can drift furthest without anyone noticing: a value refused at PATCH but
present in the other two layers is merely an unreachable feature, whereas a value ACCEPTED at
PATCH and absent from the ladder is the silent degradation above.

This guard carries a POSITIVE CONTROL exercising THE SAME extractor over an inline fixture known
to be broken — a guard whose control was never observed red is not evidence — and a NON-VACUITY
floor, because a regex that silently stopped matching would otherwise pass forever while
checking absolutely nothing.
"""

from __future__ import annotations

import re
from pathlib import Path

# backend/tests/unit/<this file> → parents[2] == backend/, parents[3] == repo root.
_BACKEND_DIR = Path(__file__).resolve().parents[2]
_REPO_ROOT = Path(__file__).resolve().parents[3]
_MIGRATIONS_DIR = _REPO_ROOT / "supabase" / "migrations"

_CONSTRAINT_NAME = "model_capabilities_overrides_emit_tier_check"

# The tier vocabulary is deliberately SMALL, so the non-vacuity floor is the full size. If a
# fourth rung is ever added, this floor rises with it — it may never be LOWERED to make a
# stopped parser pass.
_EXPECTED_TIER_COUNT = 3

# The named CHECK body, in the inline-``ADD COLUMN``-constraint form migration 120 uses and in
# the standalone ``ADD CONSTRAINT`` form a future widening would use. ``[^)]*`` spans the
# ``emit_tier IS NULL OR`` prefix (which contains no parenthesis) so the NULL-permitting form
# parses identically to a bare ``IN`` form.
_CHECK_BODY_RE = re.compile(
    r"CONSTRAINT\s+" + _CONSTRAINT_NAME + r"\s+CHECK\s*\("
    r"[^)]*emit_tier\s+IN\s*\(([^)]*)\)",
    re.IGNORECASE,
)
_SQL_LINE_COMMENT_RE = re.compile(r"--[^\n]*")
_SQL_LITERAL_RE = re.compile(r"'([^']+)'")


def _extract_check_literals(sql: str) -> list[str] | None:
    """The quoted literals of the ``emit_tier`` CHECK body, or ``None`` if absent.

    SQL line comments are stripped FIRST. Migration 120's own header prose contains the words
    ``CONSTRAINT ... CHECK (...)`` inside a ``--`` comment discussing idempotence; without
    stripping, that comment is a candidate match and the parser would report the literals of a
    sentence rather than of a constraint. The same ordering bug (parenthesised grouping
    comments terminating the body match early) was observed and recorded while authoring the
    migration-114 sibling of this guard.
    """
    stripped = _SQL_LINE_COMMENT_RE.sub("", sql)
    match = _CHECK_BODY_RE.search(stripped)
    if match is None:
        return None
    return _SQL_LITERAL_RE.findall(match.group(1))


def _migration_number(path: Path) -> int:
    leading = re.match(r"(\d+)", path.name)
    return int(leading.group(1)) if leading else -1


def _highest_numbered_check_migration() -> tuple[Path, list[str]]:
    """The CHECK literal set from the HIGHEST-numbered migration that defines it.

    Highest-wins so the pin never goes stale: a later migration widening the vocabulary becomes
    the source of truth automatically, without this file being edited.
    """
    candidates: list[tuple[int, Path, list[str]]] = []
    for path in sorted(_MIGRATIONS_DIR.glob("*.sql")):
        literals = _extract_check_literals(path.read_text(encoding="utf-8"))
        if literals is not None:
            candidates.append((_migration_number(path), path, literals))
    assert candidates, (
        f"NON-VACUITY FAILURE: no migration under {_MIGRATIONS_DIR} defines "
        f"{_CONSTRAINT_NAME}. The parser matched nothing — fix the parser or ship the "
        f"migration; do NOT weaken this assertion."
    )
    _, path, literals = max(candidates, key=lambda c: c[0])
    return path, literals


def _ladder_layer() -> set[str]:
    """Layer 2 — the tiers the forced-emission recovery ladder actually keys on."""
    from app.services.forced_emit import _RUNGS_BY_TIER

    return set(_RUNGS_BY_TIER)


def _patch_allowlist_layer() -> set[str] | None:
    """Layer 3 — the PATCH enum allow-list, or ``None`` while it does not yet exist.

    Returned as ``None`` rather than raised so the RED failure NAMES the missing layer instead
    of surfacing as a bare ``ImportError`` collected before any assertion runs.
    """
    try:
        from app.api.admin import _MODEL_CAP_ENUM_COLUMNS
    except ImportError:
        return None
    allowed = _MODEL_CAP_ENUM_COLUMNS.get("emit_tier")
    if allowed is None:
        return None
    return set(allowed)


# ── the load-bearing three-way equality ──────────────────────────────────────────


def test_a7_emit_tier_vocabulary_is_equal_across_three_layers():
    """SQL CHECK == ``_RUNGS_BY_TIER`` == ``_MODEL_CAP_ENUM_COLUMNS['emit_tier']``.

    All directions are asserted separately, each with its own actionable sentence, because the
    three drifts have three different consequences and a single ``==`` would hide which one
    happened.
    """
    migration_path, sql_literals = _highest_numbered_check_migration()

    # NON-VACUITY: a parser that matched an empty group would otherwise pass forever.
    assert sql_literals, (
        f"NON-VACUITY FAILURE: parsed an EMPTY literal set out of {migration_path.name}."
    )
    assert len(sql_literals) == len(set(sql_literals)), (
        f"{migration_path.name} lists a duplicate literal: {sorted(sql_literals)}"
    )
    assert len(sql_literals) >= _EXPECTED_TIER_COUNT, (
        f"NON-VACUITY FAILURE: parsed only {len(sql_literals)} literal(s) out of "
        f"{migration_path.name} (expected >= {_EXPECTED_TIER_COUNT}: {sorted(sql_literals)}). "
        f"The extractor has stopped matching the full body — fix it, do not lower the floor."
    )

    sql_set = set(sql_literals)
    ladder_set = _ladder_layer()
    patch_set = _patch_allowlist_layer()

    assert patch_set is not None, (
        "LAYER 3 IS MISSING: app.api.admin._MODEL_CAP_ENUM_COLUMNS['emit_tier'] does not "
        "exist, so the PATCH path has no enum guard at all. Every value the database's CHECK "
        f"({migration_path.name}) would reject reaches Postgres as a raw 23514 instead of a "
        "422, and every value it ACCEPTS is written unvalidated against the ladder in "
        "forced_emit._RUNGS_BY_TIER. Add the constant beside _MODEL_CAP_INT_COLUMNS / "
        "_MODEL_CAP_BOOL_COLUMNS and validate it in set_model_capability's guard loop."
    )

    assert ladder_set - sql_set == set(), (
        f"Tier(s) {sorted(ladder_set - sql_set)} exist in forced_emit._RUNGS_BY_TIER but are "
        f"ABSENT from {migration_path.name}'s CHECK. The ladder can run a rung the database "
        f"will not let an operator store — the tier is unreachable through the registry. Widen "
        f"the CHECK in a NEW migration."
    )
    assert sql_set - ladder_set == set(), (
        f"Tier(s) {sorted(sql_set - ladder_set)} are accepted by {migration_path.name}'s CHECK "
        f"but ABSENT from forced_emit._RUNGS_BY_TIER. THIS IS THE SILENT ONE: the boundary "
        f"guard at forced_emit.py:377 rewrites an unknown tier to 'coerce' with no exception, "
        f"no audit row and no log line, so an operator's asserted 'guaranteed format' would "
        f"degrade to best-effort and nobody would ever be told."
    )
    assert patch_set - sql_set == set(), (
        f"Tier(s) {sorted(patch_set - sql_set)} are accepted by the PATCH enum guard but "
        f"ABSENT from {migration_path.name}'s CHECK. The 422 that should have fired before any "
        f"DB touch does not, and the write dies on a raw Postgres 23514 instead."
    )
    assert sql_set - patch_set == set(), (
        f"Tier(s) {sorted(sql_set - patch_set)} are accepted by {migration_path.name}'s CHECK "
        f"but REFUSED by the PATCH enum guard — a tier the database supports that no operator "
        f"can ever set. Benign compared with the silent direction above, but still drift."
    )

    assert sql_set == ladder_set == patch_set


def test_a7_positive_control_detects_a_missing_literal():
    """POSITIVE CONTROL, over the SAME extractor.

    An inline SQL fixture missing one literal must be detected in the direction that matters:
    the ladder knows a tier the CHECK does not list. If this control ever passes vacuously, the
    real pin above proves nothing.
    """
    sql_missing_a_literal = """
    -- A decoy comment mentioning CONSTRAINT model_capabilities_overrides_emit_tier_check
    -- CHECK (emit_tier IN ('decoy_tier')) — comment stripping must drop this entirely.
    ALTER TABLE public.model_capabilities_overrides
      ADD COLUMN IF NOT EXISTS emit_tier text
        CONSTRAINT model_capabilities_overrides_emit_tier_check
        CHECK (emit_tier IS NULL OR emit_tier IN ('force_strict', 'coerce'));
    """

    parsed = _extract_check_literals(sql_missing_a_literal)
    assert parsed is not None, (
        "The extractor failed to find the constraint in a fixture that plainly defines it — "
        "the real pin above is therefore not evidence of anything."
    )
    # The decoy lives only in a stripped comment; if it appears here, comment stripping ran
    # after the body match and the parser is reading prose.
    assert "decoy_tier" not in parsed, parsed
    assert parsed == ["force_strict", "coerce"], parsed

    missing_from_sql = _ladder_layer() - set(parsed)
    assert missing_from_sql == {"force"}, (
        "The extractor failed to detect a tier present in the ladder and absent from the "
        "CHECK — the silent-degradation direction of the real pin is unproven."
    )


def test_a7_read_time_default_is_still_a_member_of_the_vocabulary():
    """``coerce`` — the read-time default at ``forced_emit.py:376`` — must remain storable.

    Named explicitly so a future reader sees the concrete case: if a widening ever dropped
    ``coerce``, every NULL row (all 37 that ship today) would resolve to a tier the database
    itself refuses, and the mismatch would be invisible until an operator tried to write it
    back.
    """
    _, sql_literals = _highest_numbered_check_migration()
    assert "coerce" in sql_literals
    assert "coerce" in _ladder_layer()

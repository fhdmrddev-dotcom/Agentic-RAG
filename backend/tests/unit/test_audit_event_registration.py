"""Structural guards for the harness_audit event vocabulary — TWO layers, kept equal.

WHY THIS FILE EXISTS (do not mistake it for ceremony and delete it).

BUG-260731-02 (Phase 185): ``action_risk_pending`` was emitted at
``harness_engine.py:712-716`` while registered in NEITHER layer that admits an audit
kind. The armed action-risk checkpoint — GOVERN-03's entire deliverable — therefore
did not park, it KILLED the run (``workflow_runs.id = 80c8823d``: ``retrieve``
completed, ``emit`` reached its pre-gate, then ``ValueError: write_audit event_type
must be one of the 22 harness_audit kinds``, leaving a phase permanently ``active``
under a run marked ``failed``, and nobody ever asked).

The two layers are:

  1. ``app.db.workflows._AUDIT_EVENT_TYPES`` — raises ``ValueError`` BEFORE the INSERT.
  2. the Postgres ``harness_audit_event_type_check`` CHECK — raises ``23514`` DURING it.

Registering a kind in only layer 1 does not fix anything; it MOVES the failure from a
ValueError to a mid-run Postgres error. So ``G2`` (the two sets are equal) is the
load-bearing guard here — it is the check that would have caught this at author time.

This is the SECOND mock-invisible audit-write death in the same function. ``write_audit``'s
own docstring already records the first (Phase 092-05 F1): *"the first audit write of any
live run raised NotNullViolationError and killed the run before any phase executed (the bug
was mock-only-invisible until the first live run in Phase 092)."* Twice in one function, for
two different reasons, argues for a structural guard rather than another careful review.

Both guards carry a POSITIVE CONTROL that exercises THE SAME extractor over an inline
fixture known to be broken. A guard whose control was never observed red is not evidence.
Both guards also assert NON-VACUITY: a regex that silently matched nothing would otherwise
pass forever while checking absolutely nothing.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

# backend/tests/unit/<this file> → parents[2] == backend/, parents[3] == repo root.
_BACKEND_DIR = Path(__file__).resolve().parents[2]
_REPO_ROOT = Path(__file__).resolve().parents[3]
_APP_DIR = _BACKEND_DIR / "app"
_MIGRATIONS_DIR = _REPO_ROOT / "supabase" / "migrations"

# The scan must find at least this many distinct literals. Measured 2026-07-31: 22
# distinct ``event_type="..."`` literals across ``backend/app/**/*.py``. The floor is
# deliberately below the reading so ordinary churn does not trip it, but far enough
# above zero that a regex which stopped matching fails loudly.
_MIN_SCANNED_LITERALS = 20

# ``event_type=`` as a KEYWORD ARGUMENT with a string literal.
#   - ``(?<![=!<>])`` and ``(?!=)`` exclude comparisons (``event_type == "message_start"``),
#     which ``anthropic_service.py`` uses for a completely unrelated local variable
#     holding Anthropic SSE event names. Those are not audit kinds and must not be scanned.
#   - Forwarded variables (``event_type=event_type`` in ``phase_types.py`` /
#     ``publish_service.py``) are out of static reach by construction; the literals that
#     feed them are themselves literal call sites elsewhere in ``app/`` and ARE scanned.
_EVENT_TYPE_KWARG_RE = re.compile(
    r"""(?<![=!<>])event_type\s*=(?!=)\s*(["'])([A-Za-z0-9_]+)\1"""
)

# The CHECK body, in every form the migrations use:
#   059 → ``CONSTRAINT harness_audit_event_type_check CHECK (`` inside a CREATE TABLE
#   069/070/114 → ``ALTER TABLE ... ADD CONSTRAINT ... CHECK (``
# The DROP line in 069/070/114 names the constraint but is not followed by ``CHECK``,
# so it cannot match.
_CHECK_BODY_RE = re.compile(
    r"CONSTRAINT\s+harness_audit_event_type_check\s+CHECK\s*\(\s*"
    r"event_type\s+IN\s*\(([^)]*)\)",
    re.IGNORECASE,
)
_SQL_LINE_COMMENT_RE = re.compile(r"--[^\n]*")
_SQL_LITERAL_RE = re.compile(r"'([^']+)'")


def _extract_event_type_literals(source: str) -> list[str]:
    """Every ``event_type="literal"`` keyword argument in one Python source string."""
    return [m.group(2) for m in _EVENT_TYPE_KWARG_RE.finditer(source)]


def _extract_check_literals(sql: str) -> list[str] | None:
    """The quoted literals of the ``harness_audit_event_type_check`` body, or ``None``.

    SQL line comments are stripped FIRST: the grouping comments inside the CHECK body
    contain parentheses (``-- 069 (Phase 101.1) emit transitions:``) which would
    otherwise terminate the body match early and silently under-report the literal set.
    That exact mis-parse was observed while authoring this guard.
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
    """The CHECK literal set from the HIGHEST-numbered migration that defines it."""
    candidates: list[tuple[int, Path, list[str]]] = []
    for path in sorted(_MIGRATIONS_DIR.glob("*.sql")):
        literals = _extract_check_literals(path.read_text(encoding="utf-8"))
        if literals is not None:
            candidates.append((_migration_number(path), path, literals))
    assert candidates, (
        f"NON-VACUITY FAILURE: no migration under {_MIGRATIONS_DIR} defines "
        f"harness_audit_event_type_check. The parser matched nothing — fix the parser, "
        f"do not weaken this assertion."
    )
    _, path, literals = max(candidates, key=lambda c: c[0])
    return path, literals


# ── G1 — every EMITTED kind is REGISTERED ────────────────────────────────────────


def test_g1_every_emitted_event_type_is_registered():
    """Every ``event_type="..."`` literal in ``backend/app/`` is in ``_AUDIT_EVENT_TYPES``.

    One direction only, deliberately: registered-but-never-emitted is benign
    (``run_started`` has been dead vocabulary since 059 and breaks nothing), whereas
    emitted-but-unregistered kills live runs. Do not "tidy" this into an equality.
    """
    from app.db.workflows import _AUDIT_EVENT_TYPES

    found: dict[str, list[str]] = {}
    for py_file in sorted(_APP_DIR.rglob("*.py")):
        if "__pycache__" in py_file.parts:
            continue
        for literal in _extract_event_type_literals(
            py_file.read_text(encoding="utf-8")
        ):
            found.setdefault(literal, []).append(
                str(py_file.relative_to(_BACKEND_DIR))
            )

    # NON-VACUITY: without this, a regex that matched nothing would pass silently.
    assert len(found) >= _MIN_SCANNED_LITERALS, (
        f"NON-VACUITY FAILURE: scanned only {len(found)} distinct event_type literals "
        f"under {_APP_DIR} (expected >= {_MIN_SCANNED_LITERALS}). The extractor has "
        f"stopped matching — fix it, do not lower the floor."
    )

    unregistered = {k: v for k, v in found.items() if k not in _AUDIT_EVENT_TYPES}
    assert not unregistered, (
        "BUG-260731-02 CLASS: these event_type kinds are EMITTED but NOT registered in "
        "_AUDIT_EVENT_TYPES. write_audit raises ValueError before the INSERT, which "
        "kills the live run at the moment it fires:\n"
        + "\n".join(f"  {k!r} at {', '.join(v)}" for k, v in sorted(unregistered.items()))
        + "\nFix BOTH layers: add the kind to _AUDIT_EVENT_TYPES *and* ship a migration "
        "extending harness_audit_event_type_check (see G2)."
    )


def test_g1_positive_control_flags_a_bogus_kind():
    """POSITIVE CONTROL for G1, over the SAME extractor.

    An inline source fixture carrying an unregistered kind must be flagged. If this
    test ever passes vacuously, G1 above proves nothing.
    """
    from app.db.workflows import _AUDIT_EVENT_TYPES

    bogus_source = '''
        await write_audit(
            pool, run_id, user_id=uid,
            event_type="not_a_real_kind",
            metadata={"phase": "emit"},
        )
        await write_audit(pool, run_id, user_id=uid, event_type="gate_passed", metadata={})
        # A comparison on an UNRELATED local variable must NOT be picked up:
        if event_type == "message_start":
            pass
    '''

    literals = _extract_event_type_literals(bogus_source)

    # The extractor sees exactly the two keyword arguments, never the comparison.
    assert literals == ["not_a_real_kind", "gate_passed"], literals

    unregistered = [lit for lit in literals if lit not in _AUDIT_EVENT_TYPES]
    assert unregistered == ["not_a_real_kind"], (
        "G1's extractor failed to flag a bogus kind — the real G1 scan above is "
        "therefore not evidence of anything."
    )


# ── G2 — the Python set and the SQL CHECK set are EQUAL ──────────────────────────


def test_g2_python_allow_list_equals_sql_check():
    """``_AUDIT_EVENT_TYPES`` == the highest-numbered migration's CHECK literal set.

    THE LOAD-BEARING GUARD. Both directions are checked: a literal in Python but not in
    SQL is a mid-run Postgres 23514, and a literal in SQL but not in Python is a
    ValueError — equally broken, just at a different layer.
    """
    from app.db.workflows import _AUDIT_EVENT_TYPES

    migration_path, sql_literals = _highest_numbered_check_migration()

    assert sql_literals, (
        f"NON-VACUITY FAILURE: parsed an EMPTY literal set out of {migration_path.name}."
    )
    assert len(sql_literals) == len(set(sql_literals)), (
        f"{migration_path.name} lists a duplicate literal: {sorted(sql_literals)}"
    )

    sql_set = set(sql_literals)
    python_set = set(_AUDIT_EVENT_TYPES)

    missing_from_sql = python_set - sql_set
    missing_from_python = sql_set - python_set

    assert not missing_from_sql, (
        f"Registered in Python but ABSENT from {migration_path.name}'s CHECK: "
        f"{sorted(missing_from_sql)}. write_audit would pass its allow-list and then "
        f"die on a Postgres 23514 MID-RUN. Ship a migration extending "
        f"harness_audit_event_type_check."
    )
    assert not missing_from_python, (
        f"Present in {migration_path.name}'s CHECK but ABSENT from _AUDIT_EVENT_TYPES: "
        f"{sorted(missing_from_python)}. write_audit would raise ValueError for a kind "
        f"the database happily accepts."
    )
    assert python_set == sql_set


def test_g2_positive_control_detects_a_missing_literal():
    """POSITIVE CONTROL for G2, over the SAME parser.

    An inline SQL fixture missing one literal must be detected in the direction that
    matters (Python has it, SQL does not) — the exact shape of BUG-260731-02.

    ⚠ THIS CONTROL MOVES EVERY TIME A KIND IS ADDED, BY CONSTRUCTION, and that is the
    point: the fixture is the CHECK body as the PREVIOUS migration left it, so the one
    literal it lacks is always the newest one. It is a MIRROR of the guard, not a
    second copy of the vocabulary — if it stopped moving, it would have stopped
    exercising the shape it exists for.

    Phase 190 (plan 190-03, migration 117) moved it for the first time: the fixture was
    the 22-literal 070 body missing ``action_risk_pending``; it is now the 23-literal
    114 body missing ``external_action_sent``. Phase 189 kept this file passing
    UNCHANGED — 190 is the phase that deliberately moves it (CONTEXT D-20).
    """
    from app.db.workflows import _AUDIT_EVENT_TYPES

    sql_missing_a_literal = """
    ALTER TABLE public.harness_audit DROP CONSTRAINT harness_audit_event_type_check;
    ALTER TABLE public.harness_audit ADD CONSTRAINT harness_audit_event_type_check CHECK (
        event_type IN (
            'phase_started','phase_completed','phase_transition',
            'gate_passed','gate_failed','tool_refused',
            'run_started','run_completed','run_failed',
            -- 069 (Phase 101.1) emit transitions:
            'emit_forced','emit_recovered','emit_validated','emit_rejected',
            'emit_rendered','emit_integrity_failed','emit_failed',
            -- 102 (GATE-01/QUAL-01) — judge / publish / policy / ask_user-approval receipts:
            'judge_verdict','publish_attempted','publish_blocked','publish_succeeded',
            'policy_applied','validator_ask_user_approved',
            -- 185 (GOVERN-03 / BUG-260731-02) — the armed action-risk pause:
            'action_risk_pending'
        )
    );
    """

    parsed = _extract_check_literals(sql_missing_a_literal)
    assert parsed is not None

    # NON-VACUITY of the control itself: the parser must survive the parenthesised
    # grouping comments, which is exactly where a naive parser under-reports. 23 = the
    # CHECK as migration 114 left it (measured at full-schema.sql:1124 before 117).
    assert len(parsed) == 23, parsed

    # ⚠ THIS EXPECTATION GAINS A MEMBER EVERY TIME A KIND IS ADDED, BY DESIGN — the
    # fixture above is a FROZEN historical snapshot (the CHECK exactly as migration 114
    # left it), so every kind registered after 114 is legitimately "missing from SQL"
    # here. Updating it is the established discipline, not a re-baseline: 190-03 did
    # exactly this when `external_action_sent` landed, and 204-02 does it for
    # `circuit_breaker_tripped` (migration 125). The PROPERTY under test — that the
    # parser detects a kind registered in Python and absent from a CHECK — is preserved
    # and is now exercised on two detections rather than one.
    # ⚠ DO NOT "FIX" THE STALENESS BY LOOSENING THIS TO A MEMBERSHIP TEST. `==` is what
    # makes the control fail when the parser OVER-reports; `in` would pass on a parser
    # that returned the empty CHECK set, which is the exact false green the whole file
    # exists to prevent.
    missing_from_sql = set(_AUDIT_EVENT_TYPES) - set(parsed)
    assert missing_from_sql == {"external_action_sent", "circuit_breaker_tripped"}, (
        "G2's parser failed to detect the BUG-260731-02 shape (a kind registered in "
        "Python but absent from the CHECK) — the real G2 above is therefore not "
        "evidence of anything."
    )


def test_g2_parser_survives_parenthesised_grouping_comments():
    """A regression pin on the mis-parse observed while authoring this guard.

    Stripping SQL line comments must happen BEFORE the body match. The comment
    ``-- 069 (Phase 101.1) emit transitions:`` contains a ``)``; without stripping,
    the body match terminates there and reports 9 literals instead of the full set — a
    false GREEN in the direction that hides drift. The comparison below is deliberately
    ``<`` rather than a pinned number, so it does not go stale when a kind is added
    (measured: 9 naive vs 24 real at migration 117).
    """
    naive = re.search(
        r"CONSTRAINT\s+harness_audit_event_type_check\s+CHECK\s*\(\s*"
        r"event_type\s+IN\s*\(([^)]*)\)",
        (_MIGRATIONS_DIR / "114_harness_audit_action_risk_pending.sql").read_text(
            encoding="utf-8"
        ),
    )
    assert naive is not None
    naive_literals = _SQL_LITERAL_RE.findall(naive.group(1))

    _, real_literals = _highest_numbered_check_migration()

    assert len(naive_literals) < len(real_literals), (
        "The naive (comment-blind) parse no longer under-reports; if the migration's "
        "comment style changed, re-confirm the real parser is still comment-safe."
    )
    assert "action_risk_pending" in real_literals


# ── the specific kind this file was born from ────────────────────────────────────


@pytest.mark.parametrize("kind", ["action_risk_pending"])
def test_armed_pause_kind_is_registered_at_both_layers(kind: str):
    """BUG-260731-02 by name, so a future reader sees the concrete case."""
    from app.db.workflows import _AUDIT_EVENT_TYPES

    _, sql_literals = _highest_numbered_check_migration()
    assert kind in _AUDIT_EVENT_TYPES, f"{kind} missing from the Python allow-list"
    assert kind in sql_literals, f"{kind} missing from the SQL CHECK"

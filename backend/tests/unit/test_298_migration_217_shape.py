"""Phase 298-03 (D-18 / D-20 / D-31) — migration 217's SHAPE, pinned against text.

Migration 217 does ONE thing: it re-states ``audit_log_action_type_check`` with every literal the
live CHECK already carries, plus ``'org.item.move'`` — the receipt the per-item org move writes
inside its own transaction (D-35). ``VALID_ACTION_TYPES`` gains the same literal in the same commit,
because the boot guard ``assert_action_types_synced`` hard-fails when the code names a type the
database lacks.

What 217 must NOT do:
  * repair data (D-18: no bulk re-stamp ever ships) — no INSERT / UPDATE / DELETE;
  * add or replace a function (D-31: published moves are descoped, so the publish-lock trigger is
    left alone) — no CREATE FUNCTION, so no PUBLIC EXECUTE grant can appear (T-298-22);
  * touch privileges — no GRANT / REVOKE.

The "every live literal" set is derived from the LAST earlier migration that replaced the CHECK
(found by scanning, never a hard-coded number), so a later migration that adds a type before 217
lands would be caught here rather than silently dropped by 217's DROP + ADD.

⚠ Every assertion runs over the SQL with ``--`` comments STRIPPED, so header prose can neither
satisfy nor break an assertion. The applied state is proven live by
``tests/integration/test_110_audit_drift_guard.py`` and ``test_298_org_move_live.py``.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"
CHECK = "audit_log_action_type_check"
NEW_TYPE = "org.item.move"


def _migration(prefix: str) -> Path:
    matches = sorted(MIGRATIONS.glob(f"{prefix}_*.sql"))
    assert len(matches) == 1, matches
    return matches[0]


def _strip_comments(sql: str) -> str:
    out = []
    for line in sql.splitlines():
        idx = line.find("--")
        if idx != -1:
            line = line[:idx]
        if line.strip():
            out.append(line)
    return "\n".join(out)


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def _code(path: Path) -> str:
    return _strip_comments(path.read_text(encoding="utf-8"))


def _check_literals(code: str) -> set[str]:
    """The literals inside the ``ADD CONSTRAINT audit_log_action_type_check … ARRAY[…]`` clause."""
    m = re.search(
        rf"ADD\s+CONSTRAINT\s+{CHECK}\s+CHECK\s*\(\s*action_type\s*=\s*ANY\s*\(\s*ARRAY\s*\[(.*?)\]",
        code, re.IGNORECASE | re.DOTALL,
    )
    assert m, "no ADD CONSTRAINT audit_log_action_type_check … ARRAY[…] clause"
    return set(re.findall(r"'([^']+)'", m.group(1)))


def _number(path: Path) -> int:
    return int(path.name.split("_", 1)[0])


def _previous_check_literals() -> set[str]:
    """The literal set of the LAST migration before 217 that re-stated the CHECK."""
    target = _number(_migration("217"))
    earlier = [
        p for p in MIGRATIONS.glob("*.sql")
        if re.match(r"^\d+_", p.name) and _number(p) < target
        and re.search(rf"ADD\s+CONSTRAINT\s+{CHECK}", _code(p), re.IGNORECASE)
    ]
    assert earlier, "no earlier migration re-states the audit CHECK"
    last = max(earlier, key=_number)
    return _check_literals(_code(last))


def test_exactly_one_217_file_with_a_cli_safe_name():
    path = _migration("217")
    assert re.match(r"^\d+_[a-z0-9_]+\.sql$", path.name), path.name


def test_217_drops_and_re_adds_the_audit_check():
    code = _norm(_code(_migration("217")))
    assert re.search(
        rf"ALTER TABLE public\.audit_log DROP CONSTRAINT IF EXISTS {CHECK}", code, re.IGNORECASE
    )
    assert re.search(rf"ALTER TABLE public\.audit_log ADD CONSTRAINT {CHECK}", code, re.IGNORECASE)


def test_217_keeps_every_earlier_literal_and_adds_the_move_type():
    previous = _previous_check_literals()
    assert len(previous) >= 39, sorted(previous)  # non-vacuity: 215 carries 39
    now = _check_literals(_code(_migration("217")))
    assert previous - now == set(), f"217 would DROP: {sorted(previous - now)}"
    assert now - previous == {NEW_TYPE}, f"217 adds more than the move type: {sorted(now - previous)}"


def test_217_repairs_no_data_adds_no_function_and_changes_no_privilege():
    # Quoted literals out first: 'connector.grant' is an action type, not a GRANT statement.
    code = re.sub(r"'[^']*'", "''", _code(_migration("217")))
    for pattern in (
        r"\bCREATE\s+(OR\s+REPLACE\s+)?FUNCTION\b",
        r"\bGRANT\b",
        r"\bREVOKE\b",
        r"\bINSERT\s+INTO\b",
        r"\bUPDATE\s+\w",
        r"\bDELETE\s+FROM\b",
        r"\bCREATE\s+TRIGGER\b",
    ):
        assert not re.search(pattern, code, re.IGNORECASE), pattern


def test_the_code_names_the_move_type_and_stays_a_subset_of_217():
    from app.services.audit_service import VALID_ACTION_TYPES

    assert NEW_TYPE in VALID_ACTION_TYPES
    now = _check_literals(_code(_migration("217")))
    assert VALID_ACTION_TYPES <= now, sorted(VALID_ACTION_TYPES - now)

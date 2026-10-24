"""Phase 292-01 — migration 213's SHAPE, pinned against its text (I-1, D-12, D-13, T-292-07).

213 widens ``public.message_artifacts``' ``component`` CHECK and ``label`` regex from 202's three
names to the six in ``ARTIFACT_COMPONENTS``, and nothing else. The live-equality assertion that 202's
shape test used to make (202's CHECK == the Literal) lives HERE now; 202's test pins its own frozen
historical three.

⚠ Every assertion runs over the migration text with ``--`` comments STRIPPED, so the header prose
cannot satisfy or break one. The applied state is measured by the file's own VERIFY block through
``scripts/apply_migration_213.py`` (292-01 Task 3, quoted in the SUMMARY).
"""
from __future__ import annotations

import re
from pathlib import Path

from app.models.artifact import ARTIFACT_COMPONENTS, ARTIFACT_LABEL_RE

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"
FULL_SCHEMA = REPO_ROOT / "supabase" / "full-schema.sql"
APPLY_SCRIPT = REPO_ROOT / "scripts" / "apply_migration_213.py"
TABLE = "public.message_artifacts"


def _migration() -> Path:
    matches = sorted(MIGRATIONS.glob("213_*.sql"))
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


def _code() -> str:
    return _strip_comments(_migration().read_text(encoding="utf-8"))


def _statements() -> list[str]:
    """Top-level statements, with string literals blanked so a `;` inside a COMMENT cannot split one."""
    code = re.sub(r"'(?:[^']|'')*'", "'…'", _code())
    return [_norm(s) for s in code.split(";") if s.strip()]


def test_exactly_one_213_migration_with_a_digits_only_prefix():
    assert re.fullmatch(r"213_[a-z0-9_]+\.sql", _migration().name)


def test_component_check_equals_the_models_literal():
    m = re.search(
        r"ADD CONSTRAINT message_artifacts_component_check CHECK \(component IN \(([^)]*)\)\)", _norm(_code())
    )
    assert m, "component CHECK missing"
    names = re.findall(r"'([^']*)'", m.group(1))
    assert set(names) == set(ARTIFACT_COMPONENTS)
    assert tuple(names) == ARTIFACT_COMPONENTS, "same order as the Literal, so a reader can diff them"


def test_label_regex_names_all_six_and_matches_the_models_regex():
    m = re.search(r"ADD CONSTRAINT message_artifacts_label_check CHECK \(label ~ '([^']*)'\)", _norm(_code()))
    assert m, "label CHECK missing"
    assert m.group(1) == ARTIFACT_LABEL_RE.pattern
    for comp in ARTIFACT_COMPONENTS:
        assert re.fullmatch(m.group(1), f"{comp} 7")
    assert not re.fullmatch(m.group(1), "steps 1")


def test_each_check_is_dropped_by_name_before_it_is_added():
    stmts = _statements()
    for name in ("message_artifacts_component_check", "message_artifacts_label_check"):
        drop = f"ALTER TABLE {TABLE} DROP CONSTRAINT IF EXISTS {name}"
        add = [i for i, s in enumerate(stmts) if s.startswith(f"ALTER TABLE {TABLE} ADD CONSTRAINT {name} ")]
        assert drop in stmts, drop
        assert len(add) == 1 and stmts.index(drop) < add[0]


def test_nothing_but_the_two_checks_and_comments():
    stmts = _statements()
    allowed = ("BEGIN", "COMMIT", f"ALTER TABLE {TABLE} DROP CONSTRAINT IF EXISTS ",
               f"ALTER TABLE {TABLE} ADD CONSTRAINT ", f"COMMENT ON TABLE {TABLE} IS",
               f"COMMENT ON COLUMN {TABLE}.")
    for s in stmts:
        assert s.startswith(allowed), s
    code = re.sub(r"'(?:[^']|'')*'", "''", _code()).upper()
    for banned in ("CREATE TABLE", "CREATE FUNCTION", "CREATE OR REPLACE FUNCTION", "GRANT ", "REVOKE ",
                   "CREATE POLICY", "INSERT INTO", "UPDATE ", "DELETE FROM", "ADD COLUMN"):
        assert banned not in code, banned


def test_one_transaction():
    stmts = _statements()
    assert stmts[0] == "BEGIN" and stmts[-1] == "COMMIT"


def test_verify_block_counts_one_check_per_column():
    raw = _migration().read_text(encoding="utf-8")
    assert "-- VERIFY" in raw
    assert "exactly one CHECK mentions component" in raw
    assert "exactly one CHECK mentions label" in raw


def test_apply_script_is_local_only():
    src = APPLY_SCRIPT.read_text(encoding="utf-8")
    assert "127.0.0.1:54322" in src
    assert not re.search(r"os\.environ|getenv", src)
    assert "213_message_artifacts_more_components.sql" in src


def test_full_schema_carries_the_six_name_checks():
    text = FULL_SCHEMA.read_text(encoding="utf-8")
    m = re.search(r"CONSTRAINT message_artifacts_component_check CHECK \(\(component = ANY \(ARRAY\[([^\]]*)\]",
                  text)
    assert m, "the regenerated full-schema.sql has no component CHECK"
    assert set(re.findall(r"'([^']*)'::text", m.group(1))) == set(ARTIFACT_COMPONENTS)
    assert f"CONSTRAINT message_artifacts_label_check CHECK ((label ~ '{ARTIFACT_LABEL_RE.pattern}'::text))" in text

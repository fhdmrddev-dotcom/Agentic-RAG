"""Phase 274-01 — migration 203's SHAPE, pinned against its text (D-28, T-274-05, T-274-06).

Migration 203 adds the `In Library` mark to ``public.workspace_files``: ``library_document_id``
(which Library document this attachment became or already was) and ``library_link`` (``saved`` |
``already``). Plan 274-02 stamps them.

⛔ THE TWO PROPERTIES THAT MATTER, and the plant that turns each red:
  * ``ON DELETE SET NULL`` — PLANT: drop it. A NO ACTION FK makes every promoted document
    undeletable, because the attachment row still points at it.
  * NO CHECK pairing the two columns — PLANT: add ``CHECK ((library_document_id IS NULL) =
    (library_link IS NULL))``. SET NULL nulls only the FK column, so that CHECK would REJECT the
    document delete it was meant to tolerate.

⚠ Every assertion runs over the migration text with ``--`` comments STRIPPED, so the header prose
cannot satisfy or break an assertion. This checks TEXT, not a live database; the applied state is
measured by SQL in 274-01 Task 3 and quoted in ``274-BASELINES.md`` §Migration 203.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"
TABLE = "public.workspace_files"


def _migration() -> Path:
    matches = sorted(MIGRATIONS.glob("203_*.sql"))
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
    return _norm(_strip_comments(_migration().read_text(encoding="utf-8")))


def _checks(code: str) -> list[str]:
    """Every CHECK expression, by balanced parentheses (a CHECK holds nested parens)."""
    out = []
    for m in re.finditer(r"CHECK\s*\(", code, re.I):
        depth, i = 1, m.end()
        while depth and i < len(code):
            depth += code[i] == "("
            depth -= code[i] == ")"
            i += 1
        out.append(code[m.end() : i - 1])
    return out


def test_exactly_one_203_migration_with_a_digits_only_prefix():
    p = _migration()
    assert re.fullmatch(r"203_[a-z0-9_]+\.sql", p.name), p.name


def test_transaction_wrapped():
    code = _code()
    assert "BEGIN;" in code
    assert "COMMIT;" in code
    assert code.index("BEGIN;") < code.index("COMMIT;")


def test_the_fk_column_sets_null_on_document_delete():
    code = _code()
    assert re.search(
        r"ADD COLUMN IF NOT EXISTS library_document_id uuid REFERENCES public\.documents\(id\) "
        r"ON DELETE SET NULL",
        code,
    ), "library_document_id must be `uuid REFERENCES public.documents(id) ON DELETE SET NULL`"


def test_the_link_column_and_its_named_null_tolerant_check():
    code = _code()
    assert "ADD COLUMN IF NOT EXISTS library_link text" in code
    assert f"ALTER TABLE {TABLE} DROP CONSTRAINT IF EXISTS workspace_files_library_link_check" in code
    assert re.search(
        r"ADD CONSTRAINT workspace_files_library_link_check CHECK \(library_link IS NULL OR "
        r"library_link IN \('saved', 'already'\)\)",
        code,
    )


def test_no_check_pairs_the_two_columns():
    checks = _checks(_code())
    assert checks, "no CHECK found — a vacuous scan must not pass"
    for expr in checks:
        assert not ("library_document_id" in expr and "library_link" in expr), (
            f"a CHECK pairs the two columns and would reject the document delete: {expr}"
        )


def test_partial_index_on_the_fk():
    code = _code()
    assert re.search(
        r"CREATE INDEX IF NOT EXISTS idx_workspace_files_library_document_id ON "
        r"public\.workspace_files \(library_document_id\) WHERE library_document_id IS NOT NULL",
        code,
    )


def test_no_grant_no_anon_no_rls_change():
    code = _code()
    assert not re.search(r"\bGRANT\b", code, re.I)
    assert not re.search(r"\banon\b", code, re.I)
    assert "DISABLE ROW LEVEL SECURITY" not in code.upper()
    assert "CREATE POLICY" not in code.upper() and "DROP POLICY" not in code.upper()


def test_no_backfill():
    code = _code()
    assert not re.search(r"^UPDATE\b|; UPDATE\b", code, re.I), "203 is schema-only — no data work"

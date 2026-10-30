"""Phase 301-01 (D-16 / D-33 / T-301-07) — migration 219's SHAPE, pinned against text.

Migration 219 does ONE thing: it adds ``public.notifications`` to the ``supabase_realtime``
publication, idempotently (a ``DO`` block that swallows ``duplicate_object``), so a browser
subscribed to its own notices gets a HINT when one opens or closes. The client refetches
``GET /notifications`` and never trusts the payload (D-v2.5-03, D-17).

What 219 must NOT do:
  * change REPLICA IDENTITY (only DELETE filtering needs FULL; the client ignores payloads);
  * touch privileges or policies — 218's owner-only SELECT policy governs what Realtime delivers;
  * add a function, or write any row.

``scripts/full-schema-supplement.sql`` §4 carries the same idempotent line (D-33), because
``pg_dump`` of the public schema does not emit publication membership.

⚠ Every assertion on 219 runs over the SQL with ``--`` comments STRIPPED, so header prose can
neither satisfy nor break an assertion. The applied state is proven live by
``tests/integration/test_301_notifications_live.py``.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"
SUPPLEMENT = REPO_ROOT / "scripts" / "full-schema-supplement.sql"


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


_ADD_IN_HANDLER = re.compile(
    r"DO \$\$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public\.notifications ?; "
    r"EXCEPTION WHEN duplicate_object THEN NULL ?; END ?\$\$",
    re.IGNORECASE,
)


def test_exactly_one_219_file_with_a_cli_safe_name():
    path = _migration("219")
    assert re.match(r"^\d+_[a-z0-9_]+\.sql$", path.name), path.name


def test_219_adds_notifications_to_the_publication_inside_a_duplicate_object_handler():
    code = _norm(_code(_migration("219")))
    assert _ADD_IN_HANDLER.search(code), code


def test_219_changes_nothing_else():
    code = re.sub(r"'[^']*'", "''", _code(_migration("219")))
    for pattern in (
        r"\bREPLICA\s+IDENTITY\b",
        r"\bGRANT\b",
        r"\bREVOKE\b",
        r"\bCREATE\s+(OR\s+REPLACE\s+)?FUNCTION\b",
        r"\bCREATE\s+POLICY\b",
        r"\bINSERT\b",
        r"\bUPDATE\b",
        r"\bDELETE\b",
    ):
        assert not re.search(pattern, code, re.IGNORECASE), pattern


def test_219_ends_with_a_read_only_verify_select():
    code = _code(_migration("219"))
    statements = [s.strip() for s in code.split(";") if s.strip()]
    last = _norm(statements[-1])
    assert last.upper().startswith("SELECT"), last
    assert re.search(r"\bAS migration_219_verify$", last), last
    assert "pg_publication_tables" in last
    assert "'PASS'" in last and "'FAIL'" in last


def test_the_supplement_carries_the_same_idempotent_line_and_names_219():
    raw = SUPPLEMENT.read_text(encoding="utf-8")
    code = _norm(_code(SUPPLEMENT))
    assert _ADD_IN_HANDLER.search(code), "supplement §4 lacks the notifications publication block"
    assert raw.count("ADD TABLE public.notifications") == 1
    assert "219 (notifications)" in raw

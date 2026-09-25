"""266 review WR-04 — migration 196 org-scopes ``documents_dedup_idx``, pinned against its text.

D-266-18 widened ``documents_completed_hash_unique_idx`` to ``(org_id, user_id, content_hash)`` in
migration 195 and made ``mint_document_row``'s dedup and link re-query org-scoped. The SECOND
user-scoped unique index, ``documents_dedup_idx``, was left per-user. For an org-scoped caller
(import_service, watch_service, email_attachments) minting into the ROOT (folder_id NULL — also what
a watch gets after its folder is deleted, FK ``SET NULL``) when the same user holds those bytes at
root in ANOTHER org: the org-scoped check misses, the insert 23505s on documents_dedup_idx, the
org-scoped link re-query finds nothing, and the call raises a false ``409 File already exists in this
folder`` — on every watch cycle.

⚠ Comments are stripped before any assertion (the header prose names the old key). This checks TEXT;
the applied index is measured after the operator's paste and read back from ``full-schema.sql``.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"


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


def _migration() -> Path:
    matches = sorted(MIGRATIONS.glob("196_*.sql"))
    assert len(matches) == 1, [p.name for p in matches]
    return matches[0]


def _statements() -> list[str]:
    code = _strip_comments(_migration().read_text(encoding="utf-8"))
    return [_norm(s) for s in code.split(";") if s.strip()]


def test_exactly_one_196_migration_with_a_digits_only_prefix():
    assert re.fullmatch(r"196_[a-z0-9_]+\.sql", _migration().name)


def test_dedup_index_is_rebuilt_org_scoped_with_its_predicate_unchanged():
    creates = [s for s in _statements() if "CREATE UNIQUE INDEX documents_dedup_idx" in s]
    assert len(creates) == 1, creates
    create = creates[0]
    cols = re.search(r"USING btree \((.*)\) WHERE", create)
    assert cols, create
    assert _norm(cols.group(1)) == (
        "org_id, user_id, content_hash, COALESCE(folder_id, '00000000-0000-0000-0000-000000000000'::uuid)"
    )
    # The partial predicate is byte-identical to the index it replaces — only the key widens.
    assert create.endswith("WHERE (status <> 'failed'::text)"), create


def test_old_index_dropped_first_and_nothing_else_touched():
    stmts = _statements()
    assert "DROP INDEX IF EXISTS public.documents_dedup_idx" in stmts
    drop_at = stmts.index("DROP INDEX IF EXISTS public.documents_dedup_idx")
    create_at = next(i for i, s in enumerate(stmts) if "CREATE UNIQUE INDEX documents_dedup_idx" in s)
    assert drop_at < create_at
    body = [s for s in stmts if s not in ("BEGIN", "COMMIT")]
    assert len(body) == 2, body


def test_not_concurrent_so_it_can_run_inside_the_editor_transaction():
    code = _strip_comments(_migration().read_text(encoding="utf-8")).upper()
    assert "CONCURRENTLY" not in code
    assert "BEGIN" in code and "COMMIT" in code

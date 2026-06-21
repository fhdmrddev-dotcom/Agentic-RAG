"""Throwaway apply script for Phase 116 Plan 04 (BLOCKING checkpoint).

Applies migration 075 (the additive partial unique index for typed-link
idempotency) to the live local Supabase DB (:54322) via psycopg2-direct
in ONE transaction, then runs a read-back assertion. NEVER db push/db reset.
Idempotent (CREATE UNIQUE INDEX IF NOT EXISTS) — safe to re-run.

Before apply: capture document_relationships + documents row counts.
After apply:  assert those counts are UNCHANGED (no wipe) and the index exists.

If the CREATE UNIQUE INDEX fails because of pre-existing duplicate rows, the
transaction rolls back, the index is NOT created, and the script reports the
duplicates instead of deleting any data.

Run: backend/venv/Scripts/python scripts/apply_migration_075.py
"""
import sys
from pathlib import Path

import psycopg2

DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
MIGRATION = (
    Path(__file__).resolve().parent.parent
    / "supabase"
    / "migrations"
    / "075_document_relationships_idempotency_index.sql"
)
INDEX = "document_relationships_idempotency_idx"


def _report_duplicates(cur) -> str:
    """Return a human-readable list of duplicate tuples blocking the unique index."""
    cur.execute(
        """
        select user_id, source_doc_id, target_doc_id, rel_type, count(*) as n
        from public.document_relationships
        group by user_id, source_doc_id, target_doc_id, rel_type
        having count(*) > 1
        order by n desc
        """
    )
    dups = cur.fetchall()
    if not dups:
        return "(no duplicate tuples found — the failure was NOT a uniqueness conflict)"
    lines = ["DUPLICATE TUPLES (block the unique index — NOT deleting any data):"]
    for user_id, src, tgt, rel, n in dups:
        lines.append(f"  user={user_id} src={src} tgt={tgt} rel={rel} count={n}")
    return "\n".join(lines)


def main() -> int:
    sql = MIGRATION.read_text(encoding="utf-8")

    conn = psycopg2.connect(DSN, connect_timeout=8)
    try:
        # pre-apply dev-data baseline (proves no reset)
        with conn.cursor() as cur:
            cur.execute("select count(*) from public.document_relationships")
            rels_before = cur.fetchone()[0]
            cur.execute("select count(*) from public.documents")
            docs_before = cur.fetchone()[0]

        # apply in ONE transaction; commits on clean exit, rolls back on error
        try:
            with conn:  # transaction
                with conn.cursor() as cur:
                    cur.execute(sql)
        except psycopg2.errors.UniqueViolation as e:  # pre-existing duplicates
            conn.rollback()
            with conn.cursor() as cur:
                dup_report = _report_duplicates(cur)
            print("FAILED: CREATE UNIQUE INDEX hit a uniqueness conflict.", file=sys.stderr)
            print(str(e).strip(), file=sys.stderr)
            print(dup_report, file=sys.stderr)
            return 2

        # read-back (fresh txn)
        with conn.cursor() as cur:
            cur.execute(
                "select indexdef from pg_indexes "
                "where schemaname='public' and indexname=%s",
                (INDEX,),
            )
            idx_row = cur.fetchone()

            cur.execute("select count(*) from public.document_relationships")
            rels_after = cur.fetchone()[0]
            cur.execute("select count(*) from public.documents")
            docs_after = cur.fetchone()[0]
    finally:
        conn.close()

    # assertions
    assert idx_row is not None, f"index {INDEX!r} missing after apply"
    indexdef = idx_row[0]
    assert "UNIQUE" in indexdef.upper(), f"index is not UNIQUE: {indexdef!r}"
    for col in ("user_id", "source_doc_id", "target_doc_id", "rel_type"):
        assert col in indexdef, f"index missing column {col!r}: {indexdef!r}"
    assert rels_after == rels_before, (
        f"DEV DATA CHANGED — document_relationships {rels_before} -> {rels_after} "
        "(a reset would zero this)"
    )
    assert docs_after == docs_before, (
        f"DEV DATA CHANGED — documents {docs_before} -> {docs_after} "
        "(a reset would zero this)"
    )

    print(f"index def: {indexdef}")
    print(
        f"document_relationships count: {rels_before} (before) -> {rels_after} (after) — preserved"
    )
    print(f"documents count: {docs_before} (before) -> {docs_after} (after) — preserved")
    print("OK migration 075 live")
    return 0


if __name__ == "__main__":
    sys.exit(main())

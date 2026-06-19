"""Throwaway apply script for Phase 114 Plan 03 (BLOCKING checkpoint).

Applies migration 074 to the live local Supabase DB (:54322) via psycopg2-direct
in ONE transaction, then runs a read-back assertion. NEVER db push/db reset.

Mirrors scripts/apply_migration_072.py / 073.py exactly:
- pre/post documents-count read-back proving NO reset happened (dev data preserved),
- one transaction (commits on clean exit, rolls back on error).

The migration adds two GENERATED ALWAYS AS (...) STORED columns
(document_type_norm = lower(metadata->>'document_type'); date_typed =
ISO-regex-guarded (metadata->>'date')::date) + two btree indexes. STORED
generated columns AUTO-BACKFILL every existing row at ALTER TABLE time — this
script asserts that backfill landed and the bad-date CASE guard yields NULL
(never raises) against the FULL existing dataset (R-114-B).

Run: backend/venv/Scripts/python scripts/apply_migration_074.py
"""
import sys
from pathlib import Path

import psycopg2

DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
MIGRATION = (
    Path(__file__).resolve().parent.parent
    / "supabase"
    / "migrations"
    / "074_view_typed_columns.sql"
)


def main() -> int:
    sql = MIGRATION.read_text(encoding="utf-8")

    conn = psycopg2.connect(DSN, connect_timeout=8)
    try:
        with conn:  # one transaction; commits on clean exit, rolls back on error
            with conn.cursor() as cur:
                # pre-apply dev-data baseline (proves no reset)
                cur.execute("select count(*) from documents")
                docs_before = cur.fetchone()[0]

                # Idempotency guard: if the columns already exist (early apply),
                # skip the ALTER/CREATE (the migration is plain ADD COLUMN, not
                # IF NOT EXISTS) — read-back below still asserts the live state.
                cur.execute(
                    """
                    select count(*) from information_schema.columns
                    where table_name = 'documents'
                      and column_name in ('document_type_norm', 'date_typed')
                    """
                )
                already = cur.fetchone()[0]
                if already == 0:
                    cur.execute(sql)
                else:
                    print(f"typed columns already present ({already}/2) — skipping ALTER (idempotent)")

        # read-back (fresh txn)
        with conn.cursor() as cur:
            cur.execute(
                """
                select column_name, is_generated
                from information_schema.columns
                where table_name = 'documents'
                  and column_name in ('document_type_norm', 'date_typed')
                order by column_name
                """
            )
            cols = {r[0]: r[1] for r in cur.fetchall()}

            cur.execute(
                """
                select indexname
                from pg_indexes
                where tablename = 'documents'
                  and indexname in ('idx_documents_document_type_norm', 'idx_documents_date_typed')
                order by indexname
                """
            )
            idxs = sorted(r[0] for r in cur.fetchall())

            # auto-backfill verification (R-114-B): generated STORED cols are computed
            # for every existing row at ALTER time — no backfill job. Also proves the
            # bad-date CASE guard yields NULL (never raised) across the full dataset.
            cur.execute(
                """
                select
                  count(*) filter (where document_type_norm is not null) as typed_dt,
                  count(*) filter (where date_typed is not null)          as typed_date,
                  count(*) filter (where metadata->>'document_type' is not null) as has_dt_raw,
                  count(*) filter (where metadata->>'date' is not null)          as has_date_raw,
                  count(*)                                                 as total
                from documents
                """
            )
            typed_dt, typed_date, has_dt_raw, has_date_raw, total = cur.fetchone()

            # case-insensitive correctness: document_type_norm == lower(raw)
            cur.execute(
                """
                select count(*)
                from documents
                where metadata->>'document_type' is not null
                  and document_type_norm is distinct from lower(metadata->>'document_type')
                """
            )
            lower_mismatch = cur.fetchone()[0]

            cur.execute("select count(*) from documents")
            docs_after = cur.fetchone()[0]
    finally:
        conn.close()

    # assertions
    assert set(cols) == {"document_type_norm", "date_typed"}, (
        f"missing typed columns: got {sorted(cols)}"
    )
    assert cols["document_type_norm"] == "ALWAYS", (
        f"document_type_norm is_generated={cols['document_type_norm']!r} (expected ALWAYS)"
    )
    assert cols["date_typed"] == "ALWAYS", (
        f"date_typed is_generated={cols['date_typed']!r} (expected ALWAYS)"
    )
    assert idxs == ["idx_documents_date_typed", "idx_documents_document_type_norm"], (
        f"missing btree indexes: got {idxs}"
    )
    assert lower_mismatch == 0, (
        f"{lower_mismatch} rows where document_type_norm != lower(raw) — generated expr wrong"
    )
    assert docs_after == docs_before and docs_after > 0, (
        f"DEV DATA CHANGED — documents {docs_before} -> {docs_after} (a reset would zero this)"
    )

    print(f"typed columns:     {cols}  (is_generated = ALWAYS)")
    print(f"btree indexes:     {idxs}")
    print(f"auto-backfill:     document_type_norm not-null {typed_dt}/{has_dt_raw} raw; "
          f"date_typed not-null {typed_date}/{has_date_raw} raw; total {total}")
    print(f"lower() correctness mismatches: {lower_mismatch} (0 = perfect)")
    print(f"documents count:   {docs_before} (before) -> {docs_after} (after) — preserved")
    print("OK migration 074 live")
    return 0


if __name__ == "__main__":
    sys.exit(main())

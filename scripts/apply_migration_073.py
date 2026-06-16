"""Throwaway apply script for Phase 111.1 Plan 04 (BLOCKING checkpoint).

Applies migration 073 to the live local Supabase DB (:54322) via psycopg2-direct
in ONE transaction, then runs a read-back assertion. NEVER db push/db reset.
Idempotent (ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE FUNCTION) — safe to re-run.

Mirrors scripts/apply_migration_072.py (Phase 111 Plan 05 precedent) exactly:
- pre/post documents-count read-back proving NO reset happened (dev data preserved),
- one transaction (commits on clean exit, rolls back on error).

Run: backend/venv/Scripts/python scripts/apply_migration_073.py
"""
import sys
from pathlib import Path

import psycopg2

DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
MIGRATION = (
    Path(__file__).resolve().parent.parent
    / "supabase"
    / "migrations"
    / "073_embedding_provider_and_chunk_tags.sql"
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

                cur.execute(sql)

        # read-back (fresh txn)
        with conn.cursor() as cur:
            cur.execute(
                """
                select column_name
                from information_schema.columns
                where table_name = 'app_settings'
                  and column_name in ('embedding_provider', 'extraction_provider',
                                      'confidence_bucket_high', 'confidence_bucket_medium')
                order by column_name
                """
            )
            app_cols = sorted(r[0] for r in cur.fetchall())

            cur.execute(
                """
                select column_name
                from information_schema.columns
                where table_name = 'document_chunks'
                  and column_name in ('embedding_model', 'embedding_dimensions')
                order by column_name
                """
            )
            chunk_cols = sorted(r[0] for r in cur.fetchall())

            cur.execute(
                "select count(*) from document_chunks where embedding_model is null"
            )
            null_model = cur.fetchone()[0]

            cur.execute("select count(*) from documents")
            docs_after = cur.fetchone()[0]

            # match_document_chunks signature carries p_embedding_model
            cur.execute(
                """
                select pg_get_function_arguments(p.oid)
                from pg_proc p
                join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = 'match_document_chunks'
                """
            )
            match_sigs = [r[0] for r in cur.fetchall()]

            # resize_embedding_column resolves (callable)
            cur.execute("select 'public.resize_embedding_column'::regproc::text")
            resize_regproc = cur.fetchone()[0]
    finally:
        conn.close()

    # assertions
    assert app_cols == [
        "confidence_bucket_high",
        "confidence_bucket_medium",
        "embedding_provider",
        "extraction_provider",
    ], f"missing app_settings cols: got {app_cols}"
    assert chunk_cols == ["embedding_dimensions", "embedding_model"], (
        f"missing document_chunks cols: got {chunk_cols}"
    )
    assert null_model == 0, (
        f"backfill incomplete: {null_model} chunk rows still have NULL embedding_model"
    )
    assert docs_after == docs_before and docs_after > 0, (
        f"DEV DATA CHANGED — documents {docs_before} -> {docs_after} (a reset would zero this)"
    )
    assert any("p_embedding_model" in s for s in match_sigs), (
        f"match_document_chunks signature missing p_embedding_model: {match_sigs!r}"
    )
    assert resize_regproc and "resize_embedding_column" in resize_regproc, (
        f"resize_embedding_column does not resolve: {resize_regproc!r}"
    )

    print(f"app_settings 073 cols:    {app_cols}")
    print(f"document_chunks 073 cols: {chunk_cols}")
    print(f"chunks with NULL embedding_model: {null_model} (backfill complete)")
    print(f"documents count: {docs_before} (before) -> {docs_after} (after) — preserved")
    print(f"match_document_chunks sig: {match_sigs}")
    print(f"resize_embedding_column:   {resize_regproc} (callable)")
    print("OK migration 073 live")
    return 0


if __name__ == "__main__":
    sys.exit(main())

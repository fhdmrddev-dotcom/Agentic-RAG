"""Throwaway apply script for Phase 111 Plan 05 (BLOCKING checkpoint).

Applies migration 072 to the live local Supabase DB (:54322) via psycopg2-direct
in ONE transaction, then runs a read-back assertion. NEVER db push/db reset.
Idempotent (ADD COLUMN IF NOT EXISTS) — safe to re-run.

Run: backend/venv/Scripts/python scripts/apply_migration_072.py
"""
import sys
from pathlib import Path

import psycopg2

DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
MIGRATION = Path(__file__).resolve().parent.parent / "supabase" / "migrations" / "072_app_settings_extraction_model.sql"


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
                select column_name, column_default
                from information_schema.columns
                where table_name = 'app_settings'
                  and column_name in ('extraction_model', 'extraction_window_cap', 'metadata_enrichment_mode')
                order by column_name
                """
            )
            app_cols = {r[0]: r[1] for r in cur.fetchall()}

            cur.execute(
                """
                select column_name, data_type, column_default
                from information_schema.columns
                where table_name = 'metadata_field_definitions' and column_name = 'options'
                """
            )
            opt = cur.fetchall()

            cur.execute("select count(*) from documents")
            docs_after = cur.fetchone()[0]
    finally:
        conn.close()

    # assertions
    assert set(app_cols) == {"extraction_model", "extraction_window_cap", "metadata_enrichment_mode"}, (
        f"missing app_settings cols: got {sorted(app_cols)}"
    )
    assert app_cols["extraction_window_cap"] is not None and "32000" in str(app_cols["extraction_window_cap"]), (
        f"extraction_window_cap default wrong: {app_cols['extraction_window_cap']!r}"
    )
    assert "enriched" in str(app_cols["metadata_enrichment_mode"]), (
        f"metadata_enrichment_mode default wrong: {app_cols['metadata_enrichment_mode']!r}"
    )
    assert opt and opt[0][1] == "jsonb", f"options column missing/wrong type: {opt!r}"
    assert docs_after == docs_before and docs_after > 0, (
        f"DEV DATA CHANGED — documents {docs_before} -> {docs_after} (a reset would zero this)"
    )

    print(f"app_settings cols:           {app_cols}")
    print(f"metadata_field_definitions.options: {opt}")
    print(f"documents count: {docs_before} (before) -> {docs_after} (after) — preserved")
    print("OK migration 072 live")
    return 0


if __name__ == "__main__":
    sys.exit(main())

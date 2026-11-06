"""BUG-261106-04 (tester report BUG-31) — every email was invisible to date filters.

Runs migration 226 against the real local Postgres INSIDE A TRANSACTION THAT IS ROLLED BACK, so
the shared local database is never changed by the test.
"""

from __future__ import annotations

import asyncio
import os
from datetime import date
from pathlib import Path

import pytest

_DSN = os.environ.get("POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
_MIGRATION = Path(__file__).resolve().parents[3] / "supabase" / "migrations" / "226_email_dates_typed.sql"


async def _conn():
    import asyncpg

    try:
        return await asyncio.wait_for(asyncpg.connect(_DSN), timeout=2.0)
    except Exception:  # noqa: BLE001
        pytest.skip(f"local Postgres not reachable on {_DSN}")


@pytest.mark.asyncio
async def test_the_function_reads_a_send_time_as_its_written_date():
    conn = await _conn()
    tx = conn.transaction()
    await tx.start()
    try:
        before = await conn.fetchval("SELECT public.view_iso_to_date('2025-12-15T09:12:00+04:00')")
        assert before is None  # the bug, as it stands before the migration
        await conn.execute(_MIGRATION.read_text(encoding="utf-8"))
        cases = {
            "2025-12-15T09:12:00+04:00": date(2025, 12, 15),   # HR-22's announcement email
            "2025-12-15T23:30:00+04:00": date(2025, 12, 15),   # never shifted to UTC
            "2026-11-04 10:41": date(2026, 11, 4),
            "2026-01-01": date(2026, 1, 1),                    # 074 behaviour unchanged
            "2026-02-31T10:00:00Z": None,                      # calendar-invalid → NULL
            "December 2025": None,
            "2025-12-15garbage": None,                         # no T/space after the date
        }
        for raw, want in cases.items():
            got = await conn.fetchval("SELECT public.view_iso_to_date($1)", raw)
            assert got == want, raw
    finally:
        await tx.rollback()
        await conn.close()


@pytest.mark.asyncio
async def test_the_migration_types_every_dated_email_and_leaves_plain_dates_alone():
    conn = await _conn()
    tx = conn.transaction()
    await tx.start()
    try:
        plain_before = await conn.fetchval(
            "SELECT count(*) FROM public.documents WHERE metadata->>'date' ~ '^\\d{4}-\\d{2}-\\d{2}$' AND date_typed IS NOT NULL"
        )
        await conn.execute(_MIGRATION.read_text(encoding="utf-8"))
        untyped = await conn.fetchval(
            "SELECT count(*) FROM public.documents WHERE metadata->>'date' ~ '^\\d{4}-\\d{2}-\\d{2}[T ]' AND date_typed IS NULL"
        )
        mismatched = await conn.fetchval(
            "SELECT count(*) FROM public.documents WHERE metadata->>'date' ~ '^\\d{4}-\\d{2}-\\d{2}[T ]'"
            " AND date_typed <> left(metadata->>'date', 10)::date"
        )
        plain_after = await conn.fetchval(
            "SELECT count(*) FROM public.documents WHERE metadata->>'date' ~ '^\\d{4}-\\d{2}-\\d{2}$' AND date_typed IS NOT NULL"
        )
        assert untyped == 0
        assert mismatched == 0
        assert plain_after == plain_before
        # Idempotent: a second run rewrites nothing.
        assert (await conn.execute(_MIGRATION.read_text(encoding="utf-8"))).endswith("UPDATE 0")
    finally:
        await tx.rollback()
        await conn.close()


def test_the_migration_is_numbered_after_every_other():
    numbers = sorted(int(p.name.split("_", 1)[0]) for p in _MIGRATION.parent.glob("[0-9]*_*.sql"))
    assert numbers[-1] == 226
    assert numbers.count(226) == 1

"""Phase 114 Plan 03 — live typed-column auto-backfill + bad-date safety (R-114-B).

Drives the LIVE local DB on :54322 to prove migration 074's two GENERATED STORED
columns behave correctly against the FULL dataset and on every future insert:

  - AUTO-BACKFILL: `document_type_norm` is the lowercased `document_type` and
    `date_typed` is the parsed ISO date for every existing row — computed at
    ALTER TABLE time, no backfill job (STORED generated columns are materialized).
  - lower() CORRECTNESS: `document_type_norm` === lower(metadata->>'document_type')
    for every row with a document_type (case-insensitivity by construction, Pitfall 3).
  - BAD-DATE SAFETY (R-114-B / Pitfall 2 / Open Q2): inserting a row whose
    `metadata->>'date'` is a NON-ISO string, a regex-passing-but-calendar-invalid
    string (`2026-13-99`, `2026-02-31`), or absent SUCCEEDS with `date_typed` NULL —
    the IMMUTABLE `view_iso_to_date` helper's EXCEPTION block yields NULL, never
    raising. A bad stored date NEVER blocks a write.

The original authored migration used `(metadata->>'date')::date`, which PG15 rejects
in a generation expression ("not immutable" — the text→date cast is STABLE). Plan 03
replaced it with `public.view_iso_to_date(text)` (IMMUTABLE plpgsql, regex + make_date
+ EXCEPTION→NULL). These tests gate that the live column is the safe variant.

Live-DB harness copied verbatim from test_113_view_resolve.py / test_114_resolve_range_date.py
(skips cleanly when :54322 is unreachable; FK-safe throwaway-user teardown).
"""

import asyncio
import json
import os
from datetime import datetime, timezone
from uuid import uuid4

import asyncpg
import pytest
import pytest_asyncio


_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)


async def _pg_reachable(dsn: str = _POSTGRES_TEST_DSN) -> bool:
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn), timeout=2.0)
        await conn.close()
        return True
    except Exception:
        return False


def _check_pg_available_sync() -> bool:
    import asyncio as _a
    try:
        loop = _a.new_event_loop()
        try:
            return loop.run_until_complete(_pg_reachable())
        finally:
            loop.close()
    except Exception:
        return False


PG_AVAILABLE = _check_pg_available_sync()
pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 114 typed-column tests",
)


async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


async def _column_exists(pool, table: str, column: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name=$1 AND column_name=$2)",
        table, column,
    ))


def _require_migration_074(pool_has_col):
    """Plan 03 owns the migration — if the columns are missing the apply step failed."""
    if not pool_has_col:
        pytest.fail(
            "migration 074 not applied (document_type_norm / date_typed absent) — "
            "run scripts/apply_migration_074.py first (Plan 03 [BLOCKING] step)"
        )


@pytest_asyncio.fixture
async def pg_pool():
    async def _init(conn):
        await conn.set_type_codec(
            "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog",
        )
    pool = await asyncpg.create_pool(
        _POSTGRES_TEST_DSN, min_size=1, max_size=4, init=_init,
    )
    try:
        yield pool
    finally:
        await pool.close()


@pytest_asyncio.fixture
async def test_user(pg_pool):
    """Throwaway auth.users row; FK-safe teardown (docs + user)."""
    user_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-114-typed-{user_id}@test.local",
        )
    except Exception as e:
        pytest.skip(f"test_user fixture setup failed: {type(e).__name__}: {e}")
    yield user_id
    for sql in (
        ("DELETE FROM public.documents WHERE user_id = $1", user_id),
        ("DELETE FROM audit_log WHERE user_id = $1", user_id),
        ("DELETE FROM auth.users WHERE id = $1", user_id),
    ):
        try:
            await pg_pool.execute(*sql)
        except Exception:
            pass


async def _seed_doc(pool, user_id, *, metadata, created_at, is_latest=True, version=1):
    doc_id = uuid4()
    await pool.execute(
        "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, "
        "status, metadata, created_at, is_latest, version_number) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
        doc_id, user_id, f"{metadata.get('title', 'doc')}-{doc_id}.txt",
        f"{user_id}/{doc_id}.txt", 100, "text/plain", "completed",
        metadata, created_at, is_latest, version,
    )
    return doc_id


# ── AUTO-BACKFILL (the FULL existing dataset, not just freshly-seeded rows) ──────

@pytest.mark.asyncio
async def test_auto_backfill_document_type_norm_full_dataset(pg_pool):
    """Every existing row with a document_type has document_type_norm = lower(raw)."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")
    _require_migration_074(await _column_exists(pg_pool, "documents", "document_type_norm"))

    # The generated column auto-backfilled at ALTER time — assert across the WHOLE table.
    mismatch = await pg_pool.fetchval(
        "SELECT count(*) FROM documents "
        "WHERE metadata->>'document_type' IS NOT NULL "
        "  AND document_type_norm IS DISTINCT FROM lower(metadata->>'document_type')"
    )
    assert mismatch == 0, f"{mismatch} rows where document_type_norm != lower(raw)"

    # And document_type_norm is NULL exactly when there's no raw document_type.
    null_with_raw = await pg_pool.fetchval(
        "SELECT count(*) FROM documents "
        "WHERE metadata->>'document_type' IS NOT NULL AND document_type_norm IS NULL"
    )
    assert null_with_raw == 0, "a row WITH a raw document_type must have a non-null norm"


@pytest.mark.asyncio
async def test_auto_backfill_date_typed_full_dataset(pg_pool):
    """date_typed parses every existing ISO date; NULL only on absent/non-ISO/invalid."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")
    _require_migration_074(await _column_exists(pg_pool, "documents", "date_typed"))

    # Every row whose stored date is a VALID ISO YYYY-MM-DD must have a non-null date_typed
    # equal to that parsed date. (Uses the same immutable helper to compute the oracle.)
    bad = await pg_pool.fetchval(
        "SELECT count(*) FROM documents "
        "WHERE metadata->>'date' ~ '^\\d{4}-\\d{2}-\\d{2}$' "
        "  AND date_typed IS DISTINCT FROM public.view_iso_to_date(metadata->>'date')"
    )
    assert bad == 0, f"{bad} rows where date_typed != view_iso_to_date(raw)"

    # No row errored the backfill — the count query above ran over the full dataset
    # without raising, which is itself the R-114-B proof on existing data.
    total = await pg_pool.fetchval("SELECT count(*) FROM documents")
    assert total > 0, "expected the real dev dataset to be present (no reset happened)"


@pytest.mark.asyncio
async def test_freshly_seeded_lower_and_date_roundtrip(pg_pool, test_user):
    """A new insert auto-derives document_type_norm (lowercased) + date_typed (parsed)."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")
    _require_migration_074(await _column_exists(pg_pool, "documents", "date_typed"))

    base = datetime(2025, 8, 1, tzinfo=timezone.utc)
    doc_id = await _seed_doc(
        pg_pool, test_user,
        metadata={"document_type": "Invoice", "date": "2026-03-15"},  # mixed-case type
        created_at=base,
    )
    row = await pg_pool.fetchrow(
        "SELECT document_type_norm, date_typed FROM documents WHERE id = $1", doc_id
    )
    assert row["document_type_norm"] == "invoice", "document_type lowercased by the generated col"
    assert row["date_typed"].isoformat() == "2026-03-15", "ISO date parsed into date_typed"


# ── BAD-DATE SAFETY (R-114-B / Pitfall 2 / Open Q2) ──────────────────────────────

@pytest.mark.asyncio
async def test_bad_date_non_iso_yields_null_insert_succeeds(pg_pool, test_user):
    """A NON-ISO stored date inserts fine with date_typed NULL — never raises (R-114-B)."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")
    _require_migration_074(await _column_exists(pg_pool, "documents", "date_typed"))

    base = datetime(2025, 8, 2, tzinfo=timezone.utc)
    # A free-form non-ISO date string. The insert MUST succeed (no generated-col error).
    doc_id = await _seed_doc(
        pg_pool, test_user, metadata={"date": "March 15th, 2026"}, created_at=base
    )
    date_typed = await pg_pool.fetchval(
        "SELECT date_typed FROM documents WHERE id = $1", doc_id
    )
    assert date_typed is None, "a non-ISO date yields NULL (regex guard), insert still succeeds"


@pytest.mark.asyncio
async def test_bad_date_regex_passing_but_calendar_invalid_yields_null(pg_pool, test_user):
    """Regex-passing-but-INVALID dates (2026-13-99, 2026-02-31) → NULL, insert succeeds.

    This is the Pitfall-2 / Open-Q2 edge: the shape regex `^\\d{4}-\\d{2}-\\d{2}$`
    accepts these, but they are not real calendar dates. The original
    `(metadata->>'date')::date` would have ERRORED the write; the immutable
    `view_iso_to_date` helper traps the overflow in its EXCEPTION block → NULL.
    """
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")
    _require_migration_074(await _column_exists(pg_pool, "documents", "date_typed"))

    base = datetime(2025, 8, 3, tzinfo=timezone.utc)
    for bad in ("2026-13-99", "2026-02-31", "0000-00-00"):
        # The INSERT itself is the assertion — a raising generated column would
        # propagate the error here and fail the test.
        doc_id = await _seed_doc(pg_pool, test_user, metadata={"date": bad}, created_at=base)
        date_typed = await pg_pool.fetchval(
            "SELECT date_typed FROM documents WHERE id = $1", doc_id
        )
        assert date_typed is None, (
            f"calendar-invalid {bad!r} must yield NULL (EXCEPTION→NULL), never raise"
        )


@pytest.mark.asyncio
async def test_helper_iso_to_date_is_immutable_and_safe(pg_pool):
    """The view_iso_to_date helper is declared IMMUTABLE and NULLs every bad input."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")
    _require_migration_074(await _column_exists(pg_pool, "documents", "date_typed"))

    # Declared IMMUTABLE (provolatile 'i') — the load-bearing fact that lets it sit in a
    # generation expression at all. (pg_proc.provolatile is the "char" type → asyncpg
    # decodes it to bytes, so normalize before comparing.)
    volatility = await pg_pool.fetchval(
        "SELECT provolatile::text FROM pg_proc WHERE proname = 'view_iso_to_date'"
    )
    assert volatility == "i", f"view_iso_to_date must be IMMUTABLE, got provolatile={volatility!r}"

    # Behavioral matrix.
    assert (await pg_pool.fetchval("SELECT public.view_iso_to_date('2026-06-15')")).isoformat() == "2026-06-15"
    for bad in ("2026-13-99", "2026-02-31", "15/06/2026", "not-a-date", "2026-6-5", ""):
        got = await pg_pool.fetchval("SELECT public.view_iso_to_date($1)", bad)
        assert got is None, f"view_iso_to_date({bad!r}) must be NULL, got {got!r}"
    assert (await pg_pool.fetchval("SELECT public.view_iso_to_date(NULL)")) is None

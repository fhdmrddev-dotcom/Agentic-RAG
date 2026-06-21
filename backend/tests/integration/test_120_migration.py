"""Phase 120 / CTX-01 (SC#3) — LIVE-DB migration-semantics gate for
``messages.origin`` (migration 076).

This is the APPLY GATE for Plan 03's blocking human-action step. It runs against
the live local Postgres (:54322) and proves the load-bearing semantics of
migration ``076_messages_origin.sql``:

  1. ZERO NULL origin (the NULL-trap guard — Pitfall 1). The migration's
     ``NOT NULL DEFAULT 'deep'`` must have FILLED every pre-existing row, so the
     Deep-side ``neq('origin','harness')`` history filter replays legacy rows
     instead of silently dropping them under three-valued logic.
  2. The column exists with ``is_nullable = 'NO'`` and ``column_default`` of
     ``'deep'`` (queried from ``information_schema.columns``).
  3. The CHECK (``messages_origin_check``) accepts ``'deep'`` and ``'harness'``
     and REJECTS any out-of-domain value (probed by an INSERT inside a
     transaction that ROLLS BACK — the live ``messages`` corpus is never
     mutated).

APPLY-GATE SEMANTICS (deliberately different from the 110/111.1 schema tests,
which *skip* when their migration is unapplied): this plan APPLIES migration 076
as Task 2, so an absent column is a HARD FAILURE here, not a skip — the failing
test is the signal that the migration has not yet been pasted into the live DB.
The ONLY clean skip is when :54322 itself is unreachable (no live DB to gate).

DB writes occur ONLY inside a rolled-back transaction (no dev-data mutation).
Modeled on test_111_1_resize_column.py (the live-DB asyncpg + rollback idiom).
"""

import asyncio
import json
import os

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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 120 migration gate",
)


@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool against local Postgres :54322."""
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


async def _origin_column(pool):
    """Return the information_schema row for public.messages.origin, or None.

    None means the column does not exist (migration 076 not applied) — the
    APPLY GATE: callers HARD-FAIL on None, they do NOT skip.
    """
    return await pool.fetchrow(
        "SELECT is_nullable, column_default, data_type "
        "FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name='messages' "
        "AND column_name='origin'",
    )


# ---------------------------------------------------------------------------
# (1) The load-bearing NULL-trap guard — zero NULL origin (Pitfall 1)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_zero_null_origin(pg_pool):
    """Every pre-existing messages row has a non-NULL origin.

    The migration's NOT NULL DEFAULT 'deep' FILLS legacy rows; a single NULL
    would be silently dropped by the Deep neq('origin','harness') filter
    (three-valued logic). This is the load-bearing post-apply invariant.
    """
    col = await _origin_column(pg_pool)
    assert col is not None, (
        "messages.origin does not exist — migration 076 NOT applied. "
        "Apply supabase/migrations/076_messages_origin.sql to the live DB "
        "(SQL-editor paste / psycopg2 to :54322; NEVER db push/reset) — "
        "this failing test IS the apply gate."
    )
    null_count = await pg_pool.fetchval(
        "SELECT count(*) FROM public.messages WHERE origin IS NULL"
    )
    assert null_count == 0, (
        f"{null_count} messages row(s) have NULL origin — the NOT NULL DEFAULT "
        "'deep' backfill (Pitfall 1) is the load-bearing guard; any NULL is "
        "silently dropped by the Deep neq('origin','harness') replay filter."
    )


# ---------------------------------------------------------------------------
# (2) The column shape — NOT NULL + DEFAULT 'deep'
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_origin_not_null_default_deep(pg_pool):
    """messages.origin is NOT NULL with a server DEFAULT of 'deep'."""
    col = await _origin_column(pg_pool)
    assert col is not None, (
        "messages.origin does not exist — migration 076 NOT applied "
        "(this failing test IS the apply gate)."
    )
    assert col["is_nullable"] == "NO", (
        f"messages.origin must be NOT NULL (got is_nullable={col['is_nullable']!r})"
    )
    # column_default is rendered like "'deep'::text" — assert the 'deep' literal.
    default = col["column_default"] or ""
    assert "'deep'" in default, (
        f"messages.origin must DEFAULT 'deep' (the legacy backfill value); "
        f"got column_default={default!r}"
    )


# ---------------------------------------------------------------------------
# (3) The CHECK — accepts deep/harness, rejects out-of-domain (rolled back)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_check_accepts_valid_rejects_other(pg_pool):
    """messages_origin_check accepts 'deep'/'harness' and rejects any other value.

    Probed by ALTER TABLE ... ADD CONSTRAINT-free direct INSERTs inside a
    transaction that ROLLS BACK, so the live messages corpus is never mutated.
    We need a real thread to satisfy the messages->threads FK, so a throwaway
    auth.users + threads row are created INSIDE the same rolled-back tx.
    """
    col = await _origin_column(pg_pool)
    assert col is not None, (
        "messages.origin does not exist — migration 076 NOT applied "
        "(this failing test IS the apply gate)."
    )
    # The named CHECK constraint must exist on public.messages.
    check_exists = await pg_pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM pg_constraint "
        "WHERE conname = 'messages_origin_check' "
        "AND conrelid = 'public.messages'::regclass)"
    )
    assert check_exists, "messages_origin_check CHECK constraint is missing"

    import uuid

    async with pg_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            uid = uuid.uuid4()
            tid = uuid.uuid4()
            # FK parents, created inside the rolled-back tx.
            await conn.execute(
                "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
                uid, f"phase-120-origin-{uid}@test.local",
            )
            await conn.execute(
                "INSERT INTO public.threads (id, user_id, title) VALUES ($1, $2, $3)",
                tid, uid, "phase-120-origin-probe",
            )

            # 'deep' and 'harness' are ACCEPTED.
            for ok_value in ("deep", "harness"):
                await conn.execute(
                    "INSERT INTO public.messages (thread_id, role, content, origin) "
                    "VALUES ($1, $2, $3, $4)",
                    tid, "user", "probe", ok_value,
                )

            # Any out-of-domain value is REJECTED by messages_origin_check.
            with pytest.raises(asyncpg.exceptions.CheckViolationError):
                await conn.execute(
                    "INSERT INTO public.messages (thread_id, role, content, origin) "
                    "VALUES ($1, $2, $3, $4)",
                    tid, "user", "probe", "other",
                )
        finally:
            await tx.rollback()  # never mutate the live corpus

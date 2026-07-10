"""Phase 123.1 (WR-07) — LIVE-DB cast gate for the ``tuner_runs.updated_at`` durable upsert.

The D-07 durable persistence upsert (``_run_tuner_job`` -> ``tuner_runs``) writes
``updated_at`` as a value that PostgREST/Postgres must accept as ``timestamptz``. The
WR-07 regression was that the payload set ``"updated_at": "now()"`` — a JSON STRING.
PostgREST sends it literally and Postgres casts text -> timestamptz; the documented special
literal is the bare ``'now'`` (only that is guaranteed), so relying on ``'now()'`` (parens)
is fragile + version-dependent. Worse, even WHERE ``'now()'``/``'now'`` is accepted it
resolves to the time the DB EXECUTES the cast — NOT the application-emitted instant — so the
persisted ``updated_at`` is an undocumented quirk-value rather than the run's actual
completion time. Because the upsert is inside a best-effort try/except that logs + swallows,
any reject would also SILENTLY drop the D-07 durable write.

The mock-store integration tests (``test_skill_tuner_routes.py``) assert the payload's
``updated_at`` parses as ISO-8601 — that catches the literal ``"now()"`` regression on the
mock. This file is the LIVE-DB companion: it proves the exact value our code emits
(``datetime.now(timezone.utc).isoformat()``) casts cleanly into the real ``tuner_runs``
column AND round-trips to the SAME instant it sent — i.e. it is a real literal timestamp,
not a server-evaluated ``'now()'`` quirk-value that would drift from the app-emitted time.

All DB writes occur INSIDE a transaction that ROLLS BACK (no dev-data mutation). FK parents
(``auth.users`` + ``public.skills``) are seeded inside the same rolled-back tx (mirrors the
test_120_migration.py live-DB + rollback idiom). The ONLY clean skip is when :54322 is
unreachable (no live DB to gate) or migration 077 is unapplied.
"""

import asyncio
import json
import os
import uuid
from datetime import datetime, timezone

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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 123.1 timestamp gate",
)


@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool against local Postgres :54322 (jsonb codec)."""
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


async def _tuner_runs_exists(pool) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name='tuner_runs')"
    ))


@pytest.mark.asyncio
async def test_iso_updated_at_casts_and_roundtrips_as_literal(pg_pool):
    """The ISO value our code emits upserts cleanly into ``tuner_runs.updated_at`` AND
    round-trips to the SAME instant — proving it is a real literal timestamp, not a
    server-evaluated ``'now()'`` quirk-value that drifts from the app-emitted time.

    This is the WR-07 regression gate at the real-Postgres layer: a full rolled-back upsert
    that proves (a) ``datetime.now(timezone.utc).isoformat()`` casts fine through the live
    column, and (b) the stored value equals the value we sent (down to a millisecond) — which
    ``'now()'`` / the special ``'now'`` literal can NOT satisfy (they resolve to DB-execution
    time). The matching mock-store ISO-parse assertions live in test_skill_tuner_routes.py.
    """
    assert await _tuner_runs_exists(pg_pool), (
        "public.tuner_runs does not exist — migration 077 NOT applied. "
        "Apply supabase/migrations/077_tuner_runs.sql to the live DB "
        "(SQL-editor paste / psycopg2 to :54322; NEVER db push/reset)."
    )

    # A FIXED instant well in the past — distinguishable from any DB-execution "now".
    sent = datetime(2020, 1, 2, 3, 4, 5, 123000, tzinfo=timezone.utc)
    iso_value = sent.isoformat()

    async with pg_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            uid = uuid.uuid4()
            sid = uuid.uuid4()
            rid = uuid.uuid4()
            # FK parents, created inside the rolled-back tx (auth.users <- skills <- tuner_runs).
            await conn.execute(
                "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
                uid, f"phase-123-1-wr07-{uid}@test.local",
            )
            await conn.execute(
                "INSERT INTO public.skills (id, user_id, name, description, is_global) "
                "VALUES ($1, $2, $3, $4, false)",
                sid, uid, "WR-07 probe skill", "probe",
            )

            # (a) The ISO value our code emits casts cleanly through the live column.
            # PostgREST sends the JSON value as TEXT over the wire and Postgres casts
            # text -> timestamptz; faithfully reproduce that by binding the value as a ``text``
            # param ($8::text) and casting in SQL (NOT an asyncpg-native datetime bind, which
            # would bypass the very text-cast path production exercises).
            await conn.execute(
                "INSERT INTO public.tuner_runs "
                "(skill_id, user_id, run_id, scoreboard, builder_model, target_count, "
                " case_count, updated_at) "
                "VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::text::timestamptz)",
                sid, uid, rid, "{}", "gpt-5.4-mini", 1, 4, iso_value,
            )
            stored = await conn.fetchval(
                "SELECT updated_at FROM public.tuner_runs WHERE skill_id = $1", sid
            )
            assert stored is not None, "expected the ISO updated_at to persist into tuner_runs"

            # (b) The stored value is the SAME instant we sent — a real literal timestamp, NOT
            # a server-evaluated ``'now()'`` value (which would equal DB-execution time and so
            # be ~minutes-to-years off this fixed 2020 instant). This is what makes the ISO
            # fix correct beyond "merely casts": it persists the run's actual completion time.
            assert stored == sent, (
                f"stored updated_at {stored!r} must equal the app-emitted instant {sent!r}; "
                "a 'now()' / 'now' value would resolve to DB-execution time and drift"
            )
        finally:
            await tx.rollback()  # NEVER mutate live dev data

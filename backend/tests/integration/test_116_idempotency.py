"""Phase 116 Plan 02 — SC#1 idempotency LIVE test (D-116-6).

The duplicate-create guarantee against live :54322. ``create_relationship`` inserts
then catches a 23505 unique-violation and RE-FETCHES the existing edge (D-116-6) — no
409, no error.

TWO regimes, gated on whether migration 075's partial unique index is live:

  * Index ABSENT (today / pre-Plan 04): there is no unique constraint, so a second
    identical create INSERTs a SECOND row — the 23505-catch never fires. This plan
    (Plan 02) only ships the APP CODE, so the strongest claim we can make TODAY is that
    a duplicate create does NOT raise and returns a well-formed edge. The strict
    "exactly one row / returns the SAME id" race-immune guarantee is xfail-marked here
    until Plan 04 applies the index (per 116-02-PLAN.md). We clean up the duplicate row
    so teardown stays FK-safe.

  * Index PRESENT (post-Plan 04): the second create hits the index → 23505 →
    re-fetch → the EXISTING edge (same id), ONE row. The strict assertion is enforced.

This file runs the SAME test body under both regimes via a runtime index probe, so it
auto-strengthens the moment Plan 04 lands without a code change here.

Live-DB harness copied verbatim from test_113_view_global_leak.py. Imports inside the
test bodies.
"""

import asyncio
import json
import os
from uuid import uuid4

import asyncpg
import pytest
import pytest_asyncio


_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)

_IDEM_INDEX = "document_relationships_idempotency_idx"


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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 116 idempotency test",
)


async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


async def _index_exists(pool, index: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM pg_indexes "
        "WHERE schemaname='public' AND indexname=$1)",
        index,
    ))


def _read_local_supabase_env():
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if not os.path.exists(env_path):
        return None
    url = key = None
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k == "SUPABASE_URL":
                    url = v
                elif k == "SUPABASE_SERVICE_ROLE_KEY":
                    key = v
    except OSError:
        return None
    if not url or not key:
        return None
    return url, key


def _supabase_or_skip():
    creds = _read_local_supabase_env()
    if creds is None:
        pytest.skip("local SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found in backend/.env")
    url, key = creds
    try:
        from supabase import create_client
        client = create_client(url, key)
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"supabase service-role client unavailable: {type(e).__name__}: {e}")
    try:
        client.table("document_relationships").select("id").limit(1).execute()
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"local Supabase REST gate unreachable: {type(e).__name__}: {e}")
    return client


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


async def _seed_user(pool, label):
    user_id = uuid4()
    await pool.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        user_id, f"phase-116-idem-{label}-{user_id}@test.local",
    )
    return user_id


async def _seed_doc(pool, user_id, *, title):
    from datetime import datetime, timezone

    doc_id = uuid4()
    await pool.execute(
        "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, "
        "status, metadata, created_at, is_latest, version_number) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
        doc_id, user_id, f"{title}-{doc_id}.txt",
        f"{user_id}/{doc_id}.txt", 100, "text/plain", "completed",
        {"title": title}, datetime(2025, 6, 1, tzinfo=timezone.utc), True, 1,
    )
    return str(doc_id)


@pytest_asyncio.fixture
async def one_user_two_docs(pg_pool):
    user = await _seed_user(pg_pool, "i")
    src = await _seed_doc(pg_pool, user, title="idem-src")
    tgt = await _seed_doc(pg_pool, user, title="idem-tgt")
    ctx = {"user": user, "src": src, "tgt": tgt}
    try:
        yield ctx
    finally:
        for sql in (
            ("DELETE FROM public.document_relationships WHERE user_id = $1", user),
            ("DELETE FROM public.documents WHERE user_id = $1", user),
            ("DELETE FROM audit_log WHERE user_id = $1", user),
            ("DELETE FROM auth.users WHERE id = $1", user),
        ):
            try:
                await pg_pool.execute(*sql)
            except Exception:
                pass


@pytest.mark.asyncio
async def test_duplicate_create_does_not_raise(pg_pool, one_user_two_docs):
    """A duplicate create returns a well-formed edge without raising (no 409, no error).

    This is the app-code claim Plan 02 ships TODAY (it holds with or without the index).
    The strict one-row guarantee is asserted in
    test_duplicate_create_returns_existing_one_row (index-gated).
    """
    if not await _table_exists(pg_pool, "document_relationships"):
        pytest.skip("migration 071 not applied (document_relationships absent)")

    from app.services import document_relationship_service as svc

    sb = _supabase_or_skip()
    ctx = one_user_two_docs

    first = await svc.create_relationship(
        user_id=ctx["user"], source_doc_id=ctx["src"], target_doc_id=ctx["tgt"],
        rel_type="references", supabase=sb,
    )
    second = await svc.create_relationship(
        user_id=ctx["user"], source_doc_id=ctx["src"], target_doc_id=ctx["tgt"],
        rel_type="references", supabase=sb,
    )
    # Both calls return a well-formed edge with the same tuple — neither raised.
    for edge in (first, second):
        assert edge["source_doc_id"] == ctx["src"]
        assert edge["target_doc_id"] == ctx["tgt"]
        assert edge["rel_type"] == "references"


@pytest.mark.asyncio
async def test_duplicate_create_returns_existing_one_row(pg_pool, one_user_two_docs):
    """Same (source,target,rel_type) twice → ONE row, returns the existing edge (D-116-6).

    Race-immune guarantee, UN-MARKED in Plan 04: migration 075's partial unique index
    `document_relationships_idempotency_idx` is now live, so a duplicate create hits the
    23505 unique-violation → `create_relationship` re-fetches → returns the EXISTING edge
    (same id) and the table holds exactly ONE row. The index is the only race-immune
    guarantee (the app-code 23505-catch needs the constraint to throw). If the index is
    ever missing, this test FAILS LOUDLY (regression signal) rather than silently xfailing.
    """
    if not await _table_exists(pg_pool, "document_relationships"):
        pytest.skip("migration 071 not applied (document_relationships absent)")

    from app.services import document_relationship_service as svc

    sb = _supabase_or_skip()
    ctx = one_user_two_docs

    # Plan 04 applied migration 075 — the index MUST be live for the race-immune
    # guarantee to hold. A missing index is a regression, not an xfail.
    assert await _index_exists(pg_pool, _IDEM_INDEX), (
        f"migration 075 index '{_IDEM_INDEX}' is NOT live on the DB — apply "
        "supabase/migrations/075_document_relationships_idempotency_index.sql "
        "(psycopg2-direct / SQL editor; NEVER db push/reset). The race-immune "
        "one-row idempotency guarantee depends on it."
    )

    first = await svc.create_relationship(
        user_id=ctx["user"], source_doc_id=ctx["src"], target_doc_id=ctx["tgt"],
        rel_type="amends", supabase=sb,
    )
    second = await svc.create_relationship(
        user_id=ctx["user"], source_doc_id=ctx["src"], target_doc_id=ctx["tgt"],
        rel_type="amends", supabase=sb,
    )

    rows = await pg_pool.fetch(
        "SELECT id FROM document_relationships WHERE user_id = $1 "
        "AND source_doc_id = $2 AND target_doc_id = $3 AND rel_type = 'amends'",
        ctx["user"], uuid4().__class__(ctx["src"]), uuid4().__class__(ctx["tgt"]),
    )

    # The index makes the second create idempotent — one row, same id.
    assert len(rows) == 1, "with the index live, a duplicate create must yield ONE row"
    assert str(second["id"]) == str(first["id"]), "the second create must return the existing edge"

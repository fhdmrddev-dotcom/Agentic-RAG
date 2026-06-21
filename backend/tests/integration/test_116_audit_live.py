"""Phase 116 Plan 02 — SC#1 audit LIVE test (DMF-01).

The ``relationship.create`` audit row lands on create AND the ``relationship.delete``
row lands on remove — the async round-trip IS the proof. Both action types are already
in ``VALID_ACTION_TYPES`` + the live audit_log CHECK (migration 071) — NO migration, NO
frozenset-sync needed (D-116-12). ``write_audit_entry`` SWALLOWS errors, so only a live
read of the row proves the writer actually fired.

Live-DB harness copied verbatim from test_113_view_global_leak.py (skips cleanly when
:54322 is unreachable; FK-safe teardown). Imports inside the test bodies.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 116 audit test",
)


async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
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
        user_id, f"phase-116-audit-{label}-{user_id}@test.local",
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
    user = await _seed_user(pg_pool, "x")
    src = await _seed_doc(pg_pool, user, title="audit-src")
    tgt = await _seed_doc(pg_pool, user, title="audit-tgt")
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


def test_action_types_are_live_enum():
    """relationship.create / .delete are in VALID_ACTION_TYPES (no migration, D-116-12)."""
    from app.services.audit_service import VALID_ACTION_TYPES

    assert "relationship.create" in VALID_ACTION_TYPES
    assert "relationship.delete" in VALID_ACTION_TYPES


@pytest.mark.asyncio
async def test_create_and_delete_audit_rows_land(pg_pool, one_user_two_docs):
    """A relationship.create row lands on create AND a relationship.delete row on remove."""
    if not await _table_exists(pg_pool, "document_relationships"):
        pytest.skip("migration 071 not applied (document_relationships absent)")
    if not await _table_exists(pg_pool, "audit_log"):
        pytest.skip("audit_log table absent")

    from app.api.document_relationships import create_relationship, delete_relationship
    from app.models.document_relationship import RelationshipCreate

    sb = _supabase_or_skip()
    ctx = one_user_two_docs
    uid = str(ctx["user"])

    created = await create_relationship(
        body=RelationshipCreate(
            source_doc_id=ctx["src"], target_doc_id=ctx["tgt"], rel_type="supersedes"
        ),
        current_user={"id": uid},
        supabase=sb,
    )
    rel_id = created["id"]

    # The relationship.create audit row landed live, scoped to this user, with the rel id.
    create_rows = await pg_pool.fetch(
        "SELECT action_type, metadata FROM audit_log "
        "WHERE user_id = $1 AND action_type = 'relationship.create'",
        ctx["user"],
    )
    assert len(create_rows) >= 1, "a relationship.create audit row must land on create"
    meta = create_rows[0]["metadata"]
    if isinstance(meta, str):
        meta = json.loads(meta)
    assert str(meta.get("relationship_id")) == str(rel_id)
    assert meta.get("rel_type") == "supersedes"

    # Now delete it — the relationship.delete row must land too.
    await delete_relationship(
        relationship_id=rel_id, current_user={"id": uid}, supabase=sb
    )
    delete_rows = await pg_pool.fetch(
        "SELECT action_type, metadata FROM audit_log "
        "WHERE user_id = $1 AND action_type = 'relationship.delete'",
        ctx["user"],
    )
    assert len(delete_rows) >= 1, "a relationship.delete audit row must land on delete"
    dmeta = delete_rows[0]["metadata"]
    if isinstance(dmeta, str):
        dmeta = json.loads(dmeta)
    assert str(dmeta.get("relationship_id")) == str(rel_id)

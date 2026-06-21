"""Phase 116 Plan 02 — SC#1 relationship CRUD LIVE test (REL-01 create / REL-03 remove).

Drives the REAL ``POST`` / ``DELETE`` router coroutines against live :54322:
  * POST creates a typed link between two visible-to-caller docs → 201, row lands.
  * The VISIBLE-BOTH gate rejects an UNSEEABLE endpoint (422) — checked BEFORE the
    self-link / CHECK so there is no ordering oracle (a probe can't distinguish
    "unseeable endpoint" from "self-link" by error shape).
  * Self-link (source == target) rejected (422, the same uniform detail).
  * DELETE removes the owned row; a cross-user / absent id → 404-not-403 (own-scoped
    delete collapses a miss to False → 404, never 403).

Live-DB harness copied verbatim from test_113_view_global_leak.py (skips cleanly when
:54322 is unreachable; FK-safe teardown of documents + document_relationships +
audit_log + auth.users for both seeded users). Imports are inside the test bodies so
collection never errors if the router/service is unavailable.
"""

import asyncio
import json
import os
from uuid import uuid4

import asyncpg
import pytest
import pytest_asyncio
from fastapi import HTTPException


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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 116 CRUD test",
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
    """Build a service-role supabase client against the REAL local Supabase, or skip."""
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


async def _seed_user(pool, label):
    user_id = uuid4()
    await pool.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        user_id, f"phase-116-crud-{label}-{user_id}@test.local",
    )
    return user_id


async def _seed_doc(pool, user_id, *, title, is_latest=True, version=1):
    """Insert one latest documents row owned by user_id. Returns its id (str)."""
    from datetime import datetime, timezone

    doc_id = uuid4()
    await pool.execute(
        "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, "
        "status, metadata, created_at, is_latest, version_number) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
        doc_id, user_id, f"{title}-{doc_id}.txt",
        f"{user_id}/{doc_id}.txt", 100, "text/plain", "completed",
        {"title": title}, datetime(2025, 6, 1, tzinfo=timezone.utc), is_latest, version,
    )
    return str(doc_id)


@pytest_asyncio.fixture
async def two_users_with_docs(pg_pool):
    """Seed User A (2 docs), User B (1 private doc), FK-safe teardown."""
    user_a = await _seed_user(pg_pool, "a")
    user_b = await _seed_user(pg_pool, "b")
    a_src = await _seed_doc(pg_pool, user_a, title="A-source")
    a_tgt = await _seed_doc(pg_pool, user_a, title="A-target")
    b_doc = await _seed_doc(pg_pool, user_b, title="B-private")
    ctx = {
        "user_a": user_a, "user_b": user_b,
        "a_src": a_src, "a_tgt": a_tgt, "b_doc": b_doc,
    }
    try:
        yield ctx
    finally:
        for uid in (user_a, user_b):
            for sql in (
                ("DELETE FROM public.document_relationships WHERE user_id = $1", uid),
                ("DELETE FROM public.documents WHERE user_id = $1", uid),
                ("DELETE FROM audit_log WHERE user_id = $1", uid),
                ("DELETE FROM auth.users WHERE id = $1", uid),
            ):
                try:
                    await pg_pool.execute(*sql)
                except Exception:
                    pass


@pytest.mark.asyncio
async def test_create_between_two_readable_docs_returns_201(pg_pool, two_users_with_docs):
    """POST two caller-readable docs → 201 with the persisted edge (REL-01)."""
    if not await _table_exists(pg_pool, "document_relationships"):
        pytest.skip("migration 071 not applied (document_relationships absent)")

    from app.api.document_relationships import create_relationship
    from app.models.document_relationship import RelationshipCreate

    sb = _supabase_or_skip()
    ctx = two_users_with_docs

    created = await create_relationship(
        body=RelationshipCreate(
            source_doc_id=ctx["a_src"], target_doc_id=ctx["a_tgt"], rel_type="references"
        ),
        current_user={"id": str(ctx["user_a"])},
        supabase=sb,
    )
    assert created["source_doc_id"] == ctx["a_src"]
    assert created["target_doc_id"] == ctx["a_tgt"]
    assert created["rel_type"] == "references"
    assert str(created["user_id"]) == str(ctx["user_a"])

    # The row actually landed in the live table.
    row = await pg_pool.fetchrow(
        "SELECT * FROM document_relationships WHERE id = $1", uuid4().__class__(created["id"])
    )
    assert row is not None, "the created edge must exist in the live table"
    assert str(row["user_id"]) == str(ctx["user_a"])


@pytest.mark.asyncio
async def test_unseeable_endpoint_rejected_uniform_422(pg_pool, two_users_with_docs):
    """POST where the TARGET is User B's private doc → 422 (visible-both gate, no oracle)."""
    if not await _table_exists(pg_pool, "document_relationships"):
        pytest.skip("migration 071 not applied (document_relationships absent)")

    from app.api.document_relationships import _INVALID_LINK_DETAIL, create_relationship
    from app.models.document_relationship import RelationshipCreate

    sb = _supabase_or_skip()
    ctx = two_users_with_docs

    # User A tries to link their own source to User B's PRIVATE doc (unseeable to A).
    with pytest.raises(HTTPException) as ei:
        await create_relationship(
            body=RelationshipCreate(
                source_doc_id=ctx["a_src"], target_doc_id=ctx["b_doc"], rel_type="references"
            ),
            current_user={"id": str(ctx["user_a"])},
            supabase=sb,
        )
    assert ei.value.status_code == 422, "an unseeable endpoint must be a 422"
    # No ordering oracle: the same uniform detail as a self-link — names neither which
    # endpoint failed nor whether it exists.
    assert ei.value.detail == _INVALID_LINK_DETAIL

    # And a nonexistent random id is ALSO a uniform 422 (indistinguishable from above).
    with pytest.raises(HTTPException) as ei2:
        await create_relationship(
            body=RelationshipCreate(
                source_doc_id=ctx["a_src"], target_doc_id=str(uuid4()), rel_type="references"
            ),
            current_user={"id": str(ctx["user_a"])},
            supabase=sb,
        )
    assert ei2.value.status_code == 422
    assert ei2.value.detail == _INVALID_LINK_DETAIL


@pytest.mark.asyncio
async def test_self_link_rejected_422(pg_pool, two_users_with_docs):
    """POST source == target → 422 (the no_self_rel guard), same uniform detail."""
    if not await _table_exists(pg_pool, "document_relationships"):
        pytest.skip("migration 071 not applied (document_relationships absent)")

    from app.api.document_relationships import _INVALID_LINK_DETAIL, create_relationship
    from app.models.document_relationship import RelationshipCreate

    sb = _supabase_or_skip()
    ctx = two_users_with_docs

    with pytest.raises(HTTPException) as ei:
        await create_relationship(
            body=RelationshipCreate(
                source_doc_id=ctx["a_src"], target_doc_id=ctx["a_src"], rel_type="references"
            ),
            current_user={"id": str(ctx["user_a"])},
            supabase=sb,
        )
    assert ei.value.status_code == 422, "a self-link must be a 422"
    # Same uniform detail as the unseeable-endpoint case → no ordering oracle.
    assert ei.value.detail == _INVALID_LINK_DETAIL


@pytest.mark.asyncio
async def test_delete_owned_then_cross_user_404_not_403(pg_pool, two_users_with_docs):
    """DELETE an owned edge succeeds; a cross-user / absent id → 404-not-403 (REL-03)."""
    if not await _table_exists(pg_pool, "document_relationships"):
        pytest.skip("migration 071 not applied (document_relationships absent)")

    from app.api.document_relationships import create_relationship, delete_relationship
    from app.models.document_relationship import RelationshipCreate

    sb = _supabase_or_skip()
    ctx = two_users_with_docs

    created = await create_relationship(
        body=RelationshipCreate(
            source_doc_id=ctx["a_src"], target_doc_id=ctx["a_tgt"], rel_type="amends"
        ),
        current_user={"id": str(ctx["user_a"])},
        supabase=sb,
    )
    rel_id = created["id"]

    # (1) User B (NOT the owner) cannot delete A's edge → 404, never 403.
    with pytest.raises(HTTPException) as ei_cross:
        await delete_relationship(
            relationship_id=rel_id,
            current_user={"id": str(ctx["user_b"])},
            supabase=sb,
        )
    assert ei_cross.value.status_code == 404, "a cross-user delete must be 404, not 403"
    # The edge still exists (B's attempt was a no-op).
    still = await pg_pool.fetchrow(
        "SELECT id FROM document_relationships WHERE id = $1", uuid4().__class__(rel_id)
    )
    assert still is not None, "a cross-user delete must NOT remove the owner's edge"

    # (2) The OWNER deletes it → returns None (204), row gone.
    out = await delete_relationship(
        relationship_id=rel_id,
        current_user={"id": str(ctx["user_a"])},
        supabase=sb,
    )
    assert out is None, "a 204 delete returns no body"
    gone = await pg_pool.fetchrow(
        "SELECT id FROM document_relationships WHERE id = $1", uuid4().__class__(rel_id)
    )
    assert gone is None, "the owner's delete must remove the edge"

    # (3) An absent id → 404 (own-scoped miss collapses to False → 404).
    with pytest.raises(HTTPException) as ei_absent:
        await delete_relationship(
            relationship_id=str(uuid4()),
            current_user={"id": str(ctx["user_a"])},
            supabase=sb,
        )
    assert ei_absent.value.status_code == 404, "an absent id must be 404, not 403"

"""Phase 116 Plan 02 — SC#1 version-stability LIVE test (REL-01 read-time resolution).

Read-time follow-to-latest (D-116-1a): a relationship stored against a creation-time
doc id RESOLVES to the LATEST accessible version at read time, so after a re-upload (a
new version row, old ``is_latest=False``) OR a restore (an old version re-promoted to
``is_latest=True``), ``_resolve_readable_latest`` still maps the link to the CURRENT
document. The link is resolved via ``(user_id, filename, is_latest=True)`` rather than
pinned to a frozen id — the filename+is_latest tuple is the stable handle.

The re-upload mechanism (documents.py:441-486): a new upload of the same filename
INSERTs a NEW id (version N+1, is_latest=True) and flips the prior versions
is_latest=False. The restore mechanism (documents.py:628-669): retire all siblings,
re-promote the target id to is_latest=True. This test simulates both directly via
asyncpg (the same row mutations the live endpoints perform).

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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 116 version-stability test",
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
        client.table("documents").select("id").limit(1).execute()
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
        user_id, f"phase-116-vstable-{label}-{user_id}@test.local",
    )
    return user_id


async def _seed_doc_version(pool, user_id, *, filename, version, is_latest):
    """Insert one documents row sharing a filename (a distinct version). Returns its id (str)."""
    from datetime import datetime, timezone

    doc_id = uuid4()
    await pool.execute(
        "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, "
        "status, metadata, created_at, is_latest, version_number) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
        doc_id, user_id, filename,
        f"{user_id}/{doc_id}.txt", 100, "text/plain", "completed",
        {"v": version}, datetime(2025, 6, version, tzinfo=timezone.utc), is_latest, version,
    )
    return str(doc_id)


@pytest_asyncio.fixture
async def user_with_versioned_doc(pg_pool):
    """Seed a user + one document at v1 (is_latest). FK-safe teardown."""
    user = await _seed_user(pg_pool, "v")
    filename = f"contract-{uuid4()}.txt"
    v1 = await _seed_doc_version(pg_pool, user, filename=filename, version=1, is_latest=True)
    ctx = {"user": user, "filename": filename, "v1": v1}
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
async def test_link_follows_latest_after_reupload(pg_pool, user_with_versioned_doc):
    """A creation-time v1 id resolves to the v2 row after a re-upload (REL-01)."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    from app.services import document_relationship_service as svc

    sb = _supabase_or_skip()
    ctx = user_with_versioned_doc
    caller = str(ctx["user"])

    # Before any new version: resolving the v1 id returns v1 (it IS latest).
    pre = await svc._resolve_readable_latest(ctx["v1"], caller, supabase=sb)
    assert pre is not None and str(pre["id"]) == ctx["v1"], "v1 resolves to itself while latest"

    # Re-upload: a NEW v2 row (is_latest=True) + flip v1 to is_latest=False (the
    # documents.py:441-486 mechanism, performed directly here).
    await pg_pool.execute(
        "UPDATE documents SET is_latest = false WHERE user_id = $1 AND filename = $2",
        ctx["user"], ctx["filename"],
    )
    v2 = await _seed_doc_version(
        pg_pool, ctx["user"], filename=ctx["filename"], version=2, is_latest=True
    )

    # Resolving the SAME creation-time v1 id now follows forward to v2 (the latest).
    post = await svc._resolve_readable_latest(ctx["v1"], caller, supabase=sb)
    assert post is not None, "the link must still resolve after a re-upload"
    assert str(post["id"]) == v2, "the v1 id must follow forward to the v2 (latest) row"
    assert post["is_latest"] is True


@pytest.mark.asyncio
async def test_link_follows_latest_after_restore(pg_pool, user_with_versioned_doc):
    """After a restore re-promotes v1, the link resolves to v1 again (REL-01)."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    from app.services import document_relationship_service as svc

    sb = _supabase_or_skip()
    ctx = user_with_versioned_doc
    caller = str(ctx["user"])

    # Create v2 as latest, v1 retired (post-re-upload state).
    await pg_pool.execute(
        "UPDATE documents SET is_latest = false WHERE user_id = $1 AND filename = $2",
        ctx["user"], ctx["filename"],
    )
    v2 = await _seed_doc_version(
        pg_pool, ctx["user"], filename=ctx["filename"], version=2, is_latest=True
    )
    # Sanity: the v2 id currently resolves to v2.
    mid = await svc._resolve_readable_latest(v2, caller, supabase=sb)
    assert str(mid["id"]) == v2

    # Restore v1: retire all siblings, re-promote v1 to is_latest=True (the
    # documents.py:628-669 mechanism).
    await pg_pool.execute(
        "UPDATE documents SET is_latest = false WHERE user_id = $1 AND filename = $2",
        ctx["user"], ctx["filename"],
    )
    await pg_pool.execute(
        "UPDATE documents SET is_latest = true WHERE id = $1",
        uuid4().__class__(ctx["v1"]),
    )

    # The creation-time v2 id now follows forward to v1 (the restored latest).
    out = await svc._resolve_readable_latest(v2, caller, supabase=sb)
    assert out is not None, "the link must still resolve after a restore"
    assert str(out["id"]) == ctx["v1"], "the v2 id must follow to the restored v1 (latest) row"
    assert out["is_latest"] is True

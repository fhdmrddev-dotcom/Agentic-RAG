"""Phase 119 — DGOV-01 — low-confidence-metadata detection (D-119-5) live on :54322.

A low-confidence document has ANY extracted field with ``metadata._confidence[field] < 0.5``
(the ConfidenceChip TIER.MED low cutoff, Phase 111/112). A doc with ALL fields >= 0.5 is NOT
low-confidence. `0.0` is a legitimate low value (the unit scan in `test_119_low_conf_scan.py`
pins the `0.0` / missing-key / non-numeric guards; this file pins the LIVE end-to-end signal).

Drives the REAL `GET /document-governance/low-confidence` route via a TestClient with
`get_current_user` / `get_supabase` overridden. Imports inside test bodies.
"""
import asyncio
import json
import os
from uuid import uuid4

import pytest
import pytest_asyncio

try:
    import asyncpg
except ImportError:  # pragma: no cover
    asyncpg = None


_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)


async def _pg_reachable(dsn: str = _POSTGRES_TEST_DSN) -> bool:
    if asyncpg is None:
        return False
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 119 low-conf test",
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
    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=4, init=_init)
    try:
        yield pool
    finally:
        await pool.close()


async def _seed_user(pool, label):
    user_id = uuid4()
    await pool.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        user_id, f"phase-119-lowconf-{label}-{user_id}@test.local",
    )
    return user_id


async def _seed_doc(pool, user_id, *, title, metadata, folder_id=None, is_latest=True, version=1):
    doc_id = uuid4()
    await pool.execute(
        "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, "
        "status, metadata, created_at, is_latest, version_number, folder_id) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9, $10, $11)",
        doc_id, user_id, f"{title}-{doc_id}.txt",
        f"{user_id}/{doc_id}.txt", 100, "text/plain", "completed",
        metadata, is_latest, version, folder_id,
    )
    return doc_id


def _route_client(caller_id: str, sb):
    from fastapi.testclient import TestClient

    from app.dependencies import get_current_user, get_supabase
    from app.main import app

    prev = dict(app.dependency_overrides)
    app.dependency_overrides[get_current_user] = lambda: {"id": caller_id, "email": f"{caller_id}@test.local"}
    app.dependency_overrides[get_supabase] = lambda: sb

    def _teardown():
        app.dependency_overrides.clear()
        app.dependency_overrides.update(prev)

    return TestClient(app), _teardown


async def _cleanup(pg_pool, uid):
    for sql in (
        "DELETE FROM public.documents WHERE user_id = $1",
        "DELETE FROM audit_log WHERE user_id = $1",
        "DELETE FROM auth.users WHERE id = $1",
    ):
        try:
            await pg_pool.execute(sql, uid)
        except Exception:
            pass


def _ids(body):
    return {it.get("document_id") for it in body.get("items", [])}


@pytest.mark.asyncio
async def test_any_field_below_cutoff_surfaces(pg_pool):
    """A doc with ANY `_confidence[field] < 0.5` surfaces; a doc with all fields >= 0.5
    does NOT (non-vacuity twin)."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    sb = _supabase_or_skip()
    uid = await _seed_user(pg_pool, "a")
    try:
        low = await _seed_doc(
            pg_pool, uid, title="low",
            metadata={"title": "low", "_confidence": {"document_type": 0.9, "author": 0.4}},
        )
        high = await _seed_doc(
            pg_pool, uid, title="high",
            metadata={"title": "high", "_confidence": {"document_type": 0.9, "author": 0.75}},
        )

        client, teardown = _route_client(str(uid), sb)
        try:
            resp = client.get("/document-governance/low-confidence")
        finally:
            teardown()

        assert resp.status_code == 200, f"{resp.status_code}: {resp.text}"
        ids = _ids(resp.json())
        assert str(low) in ids, "a doc with any field < 0.5 must surface as low-confidence"
        assert str(high) not in ids, "a doc with all fields >= 0.5 must NOT surface (non-vacuity)"
    finally:
        await _cleanup(pg_pool, uid)


@pytest.mark.asyncio
async def test_zero_point_zero_field_surfaces_live(pg_pool):
    """`0.0` is a legitimate low value end-to-end (never truthiness-skipped) — a doc whose
    only confidence field is 0.0 surfaces live."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    sb = _supabase_or_skip()
    uid = await _seed_user(pg_pool, "z")
    try:
        zero = await _seed_doc(
            pg_pool, uid, title="zero",
            metadata={"title": "zero", "_confidence": {"document_type": 0.0}},
        )

        client, teardown = _route_client(str(uid), sb)
        try:
            resp = client.get("/document-governance/low-confidence")
        finally:
            teardown()

        assert resp.status_code == 200, f"{resp.status_code}: {resp.text}"
        assert str(zero) in _ids(resp.json()), "a 0.0 confidence field must surface as low live"
    finally:
        await _cleanup(pg_pool, uid)

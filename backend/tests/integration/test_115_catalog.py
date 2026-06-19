"""Phase 115 Wave-0 — catalog-mode integration RED scaffold (Plan 02 target, LIVE :54322).

The catalog mode of `_handle_query_documents_by_view({}, ctx)` returns the live
filterable-field whitelist so the model can discover what it can filter on. The
`filterable_fields` MUST equal the compiler whitelist (built-in metadata keys ∪ the
caller's ENABLED custom field defs) — the SAME whitelist `view_filter_compiler`
validates against (no drift between "what the catalog advertises" and "what resolve
accepts").

Live-DB harness cloned from test_113_view_global_leak.py: PG_AVAILABLE skipif +
function-scoped pg_pool + seeded auth.users with FK-safe teardown. Skips cleanly
(never collection-errors) when :54322 is unreachable.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 115 catalog test",
)


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
        client.table("document_views").select("id").limit(1).execute()
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
        user_id, f"phase-115-catalog-{label}-{user_id}@test.local",
    )
    return user_id


@pytest_asyncio.fixture
async def seeded_user(pg_pool):
    """One seeded user with FK-safe teardown."""
    uid = await _seed_user(pg_pool, "a")
    try:
        yield uid
    finally:
        for sql in (
            ("DELETE FROM public.documents WHERE user_id = $1", uid),
            ("DELETE FROM public.document_views WHERE user_id = $1", uid),
            ("DELETE FROM public.metadata_field_definitions WHERE user_id = $1", uid),
            ("DELETE FROM audit_log WHERE user_id = $1", uid),
            ("DELETE FROM auth.users WHERE id = $1", uid),
        ):
            try:
                await pg_pool.execute(*sql)
            except Exception:
                pass


@pytest.mark.xfail(strict=False, reason="Plan 02 builds catalog mode + the handler")
@pytest.mark.asyncio
async def test_catalog_filterable_fields_equals_compiler_whitelist(pg_pool, seeded_user):
    """Catalog `filterable_fields` ≡ the compiler whitelist (built-ins ∪ enabled custom defs)."""
    from types import SimpleNamespace

    from app.api.document_views import _build_whitelist
    from app.services.tool_dispatcher import _handle_query_documents_by_view

    sb = _supabase_or_skip()
    caller = str(seeded_user)

    ctx = SimpleNamespace(supabase=sb, current_user={"id": caller}, phase_whitelist=None)
    result = await _handle_query_documents_by_view({}, ctx)
    payload = json.loads(result.result)

    catalog_fields = set(payload.get("filterable_fields") or [])
    expected = await _build_whitelist(caller, sb)
    assert catalog_fields == set(expected), (
        f"catalog filterable_fields {sorted(catalog_fields)} must equal the "
        f"compiler whitelist {sorted(expected)} (no drift)"
    )

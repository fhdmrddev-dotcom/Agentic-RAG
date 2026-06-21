"""Phase 116 — SC#2 tool read LIVE proof (Plan 03).

`get_related_documents` returns BOTH directions (outgoing edges where the subject is
the source, and incoming edges where it is the target) with correct inverse labels,
compact rows, and a `source_refs` list — driven through the real handler against live
:54322. The handler scopes every documents leg from the CALLER (the dispatching user)
via the shared `_resolve_readable_latest`.

This drives the REAL `_handle_get_related_documents` against live data (the handler
shipped in Plan 03 Task 1). Skips cleanly when local Postgres is unreachable. Imports
are inside the test bodies. Companion to `test_116_tool_leak.py` (the two-user mask
proof); this one proves the happy path — all endpoints readable by ONE caller, both
directions present, inverse labels correct, source_refs for every seeable endpoint.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 116 tool-read test",
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
        user_id, f"phase-116-tool-read-{label}-{user_id}@test.local",
    )
    return user_id


async def _seed_doc(pool, user_id, *, title):
    doc_id = uuid4()
    await pool.execute(
        "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, "
        "status, metadata, created_at, is_latest, version_number) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), true, 1)",
        doc_id, user_id, f"{title}-{doc_id}.txt",
        f"{user_id}/{doc_id}.txt", 100, "text/plain", "completed", {"title": title},
    )
    return doc_id


async def _seed_relationship(pool, owner_id, source_id, target_id, rel_type):
    rel_id = uuid4()
    await pool.execute(
        "INSERT INTO public.document_relationships "
        "(id, user_id, source_doc_id, target_doc_id, rel_type) VALUES ($1, $2, $3, $4, $5)",
        rel_id, owner_id, source_id, target_id, rel_type,
    )
    return rel_id


@pytest_asyncio.fixture
async def one_user_both_directions(pg_pool):
    """Seed one user, a SUBJECT, an OUTGOING edge (subject supersedes a doc), and an
    INCOMING edge (another doc references the subject). All three docs are the user's
    own → all readable → no masking. FK-safe teardown."""
    user = await _seed_user(pg_pool, "u")

    subject = await _seed_doc(pg_pool, user, title="subject")
    superseded = await _seed_doc(pg_pool, user, title="old-version")     # outgoing target
    referer = await _seed_doc(pg_pool, user, title="citing-doc")         # incoming source

    # subject SUPERSEDES superseded (outgoing); referer REFERENCES subject (incoming).
    await _seed_relationship(pg_pool, user, subject, superseded, "supersedes")
    await _seed_relationship(pg_pool, user, referer, subject, "references")

    ctx = {
        "user": user, "subject": str(subject),
        "superseded": str(superseded), "referer": str(referer),
    }
    try:
        yield ctx
    finally:
        for sql in (
            "DELETE FROM public.document_relationships WHERE user_id = $1",
            "DELETE FROM public.documents WHERE user_id = $1",
            "DELETE FROM auth.users WHERE id = $1",
        ):
            try:
                await pg_pool.execute(sql, user)
            except Exception:
                pass


def _make_ctx(sb, caller):
    from types import SimpleNamespace

    return SimpleNamespace(supabase=sb, current_user={"id": caller}, phase_whitelist=None)


@pytest.mark.asyncio
async def test_handler_returns_both_directions_with_source_refs(pg_pool, one_user_both_directions):
    """The handler returns outgoing + incoming edges with inverse labels + source_refs (LIVE)."""
    if not await _table_exists(pg_pool, "document_relationships"):
        pytest.skip("document_relationships table absent")

    from app.services.tool_dispatcher import _handle_get_related_documents

    sb = _supabase_or_skip()
    ctx = one_user_both_directions

    out = json.loads((await _handle_get_related_documents(
        {"document_id": ctx["subject"]}, _make_ctx(sb, str(ctx["user"])))).result)

    assert out.get("total") == 2, f"expected 2 related docs (1 outgoing + 1 incoming), got {out}"

    by_dir = {(r["direction"], r["label"]): r for r in out["documents"]}
    # OUTGOING keeps the verb: subject SUPERSEDES the old version.
    assert ("outgoing", "supersedes") in by_dir, f"missing outgoing supersedes edge: {out}"
    assert by_dir[("outgoing", "supersedes")]["document_id"] == ctx["superseded"]
    # INCOMING flips to the inverse: a doc REFERENCES subject → subject is "referenced_by".
    assert ("incoming", "referenced_by") in by_dir, f"missing incoming referenced_by edge: {out}"
    assert by_dir[("incoming", "referenced_by")]["document_id"] == ctx["referer"]

    # source_refs carries BOTH seeable endpoints (nothing is masked here).
    ref_ids = {r["document_id"] for r in out.get("source_refs", [])}
    assert ref_ids == {ctx["superseded"], ctx["referer"]}, (
        f"source_refs must carry both seeable endpoints, got {ref_ids}"
    )


@pytest.mark.asyncio
async def test_handler_resolves_subject_by_filename(pg_pool, one_user_both_directions):
    """Identifying the subject by exact filename resolves the same edges (the filename path)."""
    if not await _table_exists(pg_pool, "document_relationships"):
        pytest.skip("document_relationships table absent")

    from app.services.tool_dispatcher import _handle_get_related_documents

    sb = _supabase_or_skip()
    ctx = one_user_both_directions

    # Read the subject's real filename back, then drive the handler by filename.
    row = sb.table("documents").select("filename").eq("id", ctx["subject"]).limit(1).execute()
    fname = row.data[0]["filename"]

    out = json.loads((await _handle_get_related_documents(
        {"filename": fname}, _make_ctx(sb, str(ctx["user"])))).result)

    assert out.get("total") == 2, f"by-filename subject resolution must find the same 2 edges: {out}"
    assert out["subject"]["document_id"] == ctx["subject"]

"""Phase 117 Wave-0 — the two-user cross-viewer leak proof at the SHARED-FN boundary.

THE mandatory live proof of REL-02 / SC#1 / D-117-8 leak-safe masking at the boundary
the NEW GET route (Plan 02) will inherit. The panel cannot call an agent tool, so D-117-7
extracts the leak-safe outgoing+incoming traversal into the shared
``document_relationship_service.get_related_documents`` (Task 2). This file drives THAT
shared fn directly with two real callers — proving the masking holds in the extracted
core, so the route that wraps it (Plan 02) cannot leak. Plan 02 adds the test that drives
the HTTP route itself; the shared-core boundary proven here is what the route inherits.

This clones ``test_116_tool_leak.py``'s harness VERBATIM (asyncpg pool, ``_supabase_or_skip``,
FK-safe seed/teardown, OWN-scoped per-user edges, GLOBAL-folder subject both read, PRIVATE
target only owner reads) but exercises the SHARED FN instead of the tool handler:

  * SUBJECT — A's GLOBAL-folder doc → BOTH A and B can read it (so both resolve the
    subject; the masking is genuinely on the TARGET, not "B can't read the subject").
  * TARGET — A's PRIVATE doc (folder_id=NULL, owned by A) → only A can read it.
  * A's edge   subject→target  → A (who reads the target) sees its REAL filename.
  * B's edge   subject→target  → B (who can NOT read the target) sees the MASK
    ``"linked document (no access)"`` with ``document_id is None`` — never the private
    id / filename / metadata.

Marked for secure-phase confirmation (the LIVE two-user proof — D-117-8): the RLS label /
caller-scope comment is NOT proof (the D-102 / D-110-5 "static would false-green" lesson);
only two real callers driving the REAL shared fn against live :54322 closes this threat.

Imports are inside the test bodies so collection never errors while the shared fn is still
unbuilt (RED until Task 2). The masked-row assertion is xfail(strict=False) until then.
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

_MASK = "linked document (no access)"


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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 117 route-leak test",
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
        user_id, f"phase-117-route-leak-{label}-{user_id}@test.local",
    )
    return user_id


async def _seed_global_folder(pool, owner_id, *, name):
    """A folder owned by `owner_id` with is_global=true → its docs are visible to EVERYONE.
    The SUBJECT lives here so user B can read it even though A owns it."""
    folder_id = uuid4()
    await pool.execute(
        "INSERT INTO public.folders (id, user_id, name, is_global) VALUES ($1, $2, $3, true)",
        folder_id, owner_id, name,
    )
    return folder_id


async def _seed_doc(pool, user_id, *, title, folder_id=None, is_latest=True, version=1):
    doc_id = uuid4()
    await pool.execute(
        "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, "
        "status, metadata, created_at, is_latest, version_number, folder_id) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9, $10, $11)",
        doc_id, user_id, f"{title}-{doc_id}.txt",
        f"{user_id}/{doc_id}.txt", 100, "text/plain", "completed",
        {"title": title}, is_latest, version, folder_id,
    )
    return doc_id


async def _seed_relationship(pool, owner_id, source_id, target_id, rel_type="references"):
    rel_id = uuid4()
    await pool.execute(
        "INSERT INTO public.document_relationships "
        "(id, user_id, source_doc_id, target_doc_id, rel_type) VALUES ($1, $2, $3, $4, $5)",
        rel_id, owner_id, source_id, target_id, rel_type,
    )
    return rel_id


@pytest_asyncio.fixture
async def two_users_with_link(pg_pool):
    """Seed the NON-VACUOUS per-viewer masking scenario over OWN-SCOPED edges (mirrors 116).

    The ``document_relationships`` table is user-scoped, so the shared fn returns the
    CALLER's OWN edges. The leak is that a TARGET on one of the caller's own edges may be a
    doc that caller can no longer read. The shared fn must mask THAT target's identity for
    that caller while still showing it un-masked to a caller who CAN read it.

    BOTH users get their OWN edge to the SAME target (each owns an own-scoped row → each
    sees it via the shared fn), where the target is readable to A (A owns it, private
    folder) but NOT to B:

      * SUBJECT — A's GLOBAL-folder doc → BOTH A and B can read it.
      * TARGET — A's PRIVATE doc (folder_id=NULL, owned by A) → only A can read it.
      * A's edge subject→target → A sees the target's REAL filename.
      * B's edge subject→target → B sees the MASK.

    Each user owns ONLY their own edge (own-scoped), so the mask demonstrably triggers for
    B but not A — the "static would false-green" lesson honored.
    """
    if not await _table_exists(pg_pool, "folders"):
        pytest.skip("folders table absent")

    user_a = await _seed_user(pg_pool, "a")
    user_b = await _seed_user(pg_pool, "b")

    # SUBJECT — in A's GLOBAL folder, so BOTH A and B can read it.
    global_folder = await _seed_global_folder(pg_pool, user_a, name="A-shared")
    subject = await _seed_doc(pg_pool, user_a, title="A-subject", folder_id=global_folder)
    # TARGET — A's PRIVATE scope (folder_id=NULL, not global, owned by A): only A reads it.
    target = await _seed_doc(pg_pool, user_a, title="A-secret-target", folder_id=None)

    # OWN-SCOPED edges: A owns A's edge, B owns B's edge — both subject→target.
    rel_a = await _seed_relationship(pg_pool, user_a, subject, target, "references")
    rel_b = await _seed_relationship(pg_pool, user_b, subject, target, "references")

    ctx = {
        "user_a": user_a, "user_b": user_b, "global_folder": global_folder,
        "subject": str(subject), "target": str(target),
        "rel_a": str(rel_a), "rel_b": str(rel_b),
        "target_real_title": "A-secret-target",
    }
    try:
        yield ctx
    finally:
        for uid in (user_a, user_b):
            for sql in (
                ("DELETE FROM public.document_relationships WHERE user_id = $1", uid),
                ("DELETE FROM public.documents WHERE user_id = $1", uid),
                ("DELETE FROM public.folders WHERE user_id = $1", uid),
                ("DELETE FROM audit_log WHERE user_id = $1", uid),
                ("DELETE FROM auth.users WHERE id = $1", uid),
            ):
                try:
                    await pg_pool.execute(*sql)
                except Exception:
                    pass


@pytest.mark.xfail(
    strict=False,
    reason="Task 2 ships the shared get_related_documents; the masked-row proof is GREEN once it lands.",
)
@pytest.mark.asyncio
async def test_shared_fn_masks_unreadable_endpoint_for_other_viewer(pg_pool, two_users_with_link):
    """B (who shares the subject but not the target) sees the mask via the SHARED fn,
    document_id is None, never the real target id/filename/metadata (D-117-8 / SC#1).

    [SECURE-PHASE: the LIVE two-user leak proof at the shared-core boundary the route
    inherits — confirm non-vacuous on :54322, not via the RLS label.]"""
    if not await _table_exists(pg_pool, "document_relationships"):
        pytest.skip("document_relationships table absent")

    from app.services import document_relationship_service as svc

    sb = _supabase_or_skip()
    ctx = two_users_with_link

    out_b = await svc.get_related_documents(
        str(ctx["user_b"]), document_id=ctx["subject"], supabase=sb
    )

    # NON-VACUITY GUARD 1: B genuinely resolved the SUBJECT (it's in A's global folder),
    # so this is a real traversal — not "B sees nothing because B can't read the subject".
    assert out_b is not None, "B must resolve the global-folder SUBJECT (non-vacuous setup)"
    # NON-VACUITY GUARD 2: the edge EXISTS for B (the masked row is present), so the mask
    # demonstrably triggered — B is not simply seeing an empty relationship list.
    assert out_b.get("total", 0) >= 1, (
        f"B must see the related-edge ROW (masked), proving the mask path ran; got {out_b}"
    )

    masked = [r for r in out_b["documents"] if r["filename"] == _MASK]
    assert masked, f"an unreadable endpoint must render as {_MASK!r}; got {out_b}"
    # The masked row carries document_id=None — never the real id (D-117-8).
    assert all(r["document_id"] is None for r in masked), (
        "a masked row must carry document_id=None — never the unreadable target's id"
    )

    blob = json.dumps(out_b)
    assert ctx["target_real_title"] not in blob, (
        "B must NEVER see the unreadable target's real filename / metadata"
    )
    assert ctx["target"] not in blob, "B must NEVER see the unreadable target's id"
    assert ctx["target"] not in {r.get("document_id") for r in out_b.get("source_refs", [])}, (
        "the masked endpoint must contribute NO citable source_ref for B"
    )


@pytest.mark.xfail(
    strict=False,
    reason="Task 2 ships the shared get_related_documents; the per-viewer real-filename proof is GREEN once it lands.",
)
@pytest.mark.asyncio
async def test_shared_fn_shows_real_filename_for_owner(pg_pool, two_users_with_link):
    """A (who CAN read the target) sees the target's REAL filename via the SHARED fn — the
    mask is per-viewer, not a blanket hide (the non-vacuity twin of the mask proof)."""
    if not await _table_exists(pg_pool, "document_relationships"):
        pytest.skip("document_relationships table absent")

    from app.services import document_relationship_service as svc

    sb = _supabase_or_skip()
    ctx = two_users_with_link

    out_a = await svc.get_related_documents(
        str(ctx["user_a"]), document_id=ctx["subject"], supabase=sb
    )
    assert out_a is not None and out_a.get("total", 0) >= 1, f"A must see its own edge; got {out_a}"

    blob_a = json.dumps(out_a)
    assert ctx["target_real_title"] in blob_a, (
        "A (who can read the target) MUST see its real filename — the mask is per-viewer"
    )
    assert _MASK not in blob_a, "A must NOT see the mask for a target A can read"
    assert ctx["target"] in {r.get("document_id") for r in out_a.get("source_refs", [])}, (
        "A (who can read the target) must get a citable source_ref for it"
    )

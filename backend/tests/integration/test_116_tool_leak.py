"""Phase 116 SECURE — the two-user cross-viewer leak proof via the TOOL HANDLER.

THE mandatory live proof of REL-04 / SC#2 leak-safe masking at the AGENT-TOOL
boundary. A relationship links two documents; the SUBJECT is readable by the caller,
but the LINKED endpoint may NOT be (a user can link to a doc that later becomes
unseeable to another viewer of the subject, or the link reaches a doc the second
viewer never had access to). When `get_related_documents` renders the related rows,
an endpoint the CALLER cannot currently read MUST appear as the literal mask string
`"linked document (no access)"` — NEVER its real filename or metadata. The handler
re-checks per-viewer readability at READ time via the shared `_resolve_readable_latest`
(scoping from the CALLER, never the link owner). The RLS policy label / the caller-
scope code comment is NOT proof (the D-102 / D-110-5 "static would false-green"
lesson); only two real callers driving the REAL handler against live :54322 closes
this threat.

This clones `test_115_tool_global_leak.py`'s harness VERBATIM (asyncpg pool,
`_supabase_or_skip`, FK-safe seed/teardown) but exercises the NEW Phase-116 surface:
seed a target visible to A → link it (A's subject → target) → make the target
unseeable to B → assert:
  (a) User A (who can read the target) sees the target's REAL filename in source_refs.
  (b) User B (who shares visibility of the SUBJECT but NOT the target) sees the mask
      `"linked document (no access)"` for that endpoint — and NEVER the target's real
      filename or metadata.
  (c) The masked row still appears (the EXISTENCE of a link is not hidden — only the
      unreadable endpoint's identity is), so B learns "there is a related doc you
      can't see", not its contents.

Encoded as xfail until the handler ships in Plan 03 (the handler is the new in-process
surface; the leak must be re-proven there). Skips cleanly when local Postgres is
unreachable. Imports are inside the test bodies so collection never errors on the
not-yet-built handler.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 116 tool-leak test",
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
        user_id, f"phase-116-tool-leak-{label}-{user_id}@test.local",
    )
    return user_id


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
    """Seed User A, User B, a SUBJECT both can see (a global-folder doc), and a TARGET
    only A can see, linked subject→target. FK-safe teardown of everything seeded.

    Plan 03 fills the real "make the subject visible to both / the target visible only
    to A" wiring against the live global-folder model (a global folder for the subject;
    A's private folder for the target). The scaffold records the intent.
    """
    user_a = await _seed_user(pg_pool, "a")
    user_b = await _seed_user(pg_pool, "b")

    # SUBJECT — Plan 03 places it in a global folder so BOTH A and B can read it.
    subject = await _seed_doc(pg_pool, user_a, title="A-subject")
    # TARGET — stays in A's private scope, so B can NOT read it (the masked endpoint).
    target = await _seed_doc(pg_pool, user_a, title="A-secret-target")

    rel_id = await _seed_relationship(pg_pool, user_a, subject, target, "references")

    ctx = {
        "user_a": user_a, "user_b": user_b,
        "subject": str(subject), "target": str(target), "rel_id": str(rel_id),
        "target_real_title": "A-secret-target",
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


def _make_ctx(sb, caller):
    """Minimal handler ctx bag — supabase + the dispatching user + Deep-Mode whitelist."""
    from types import SimpleNamespace

    return SimpleNamespace(supabase=sb, current_user={"id": caller}, phase_whitelist=None)


def _ref_filenames(payload):
    refs = payload.get("source_refs") or payload.get("documents") or []
    return {r.get("filename") for r in refs}


@pytest.mark.xfail(strict=False, reason="Plan 03 ships the masking handler")
@pytest.mark.asyncio
async def test_unreadable_endpoint_is_masked_for_other_viewer(pg_pool, two_users_with_link):
    """B (who shares the subject but not the target) sees the mask, never the real target."""
    if not await _table_exists(pg_pool, "document_relationships"):
        pytest.skip("document_relationships table absent")

    from app.services.tool_dispatcher import _handle_get_related_documents

    sb = _supabase_or_skip()
    ctx = two_users_with_link

    out_b = json.loads((await _handle_get_related_documents(
        {"document_id": ctx["subject"]}, _make_ctx(sb, str(ctx["user_b"])))).result)

    blob = json.dumps(out_b)
    # (b) B NEVER sees the target's real filename or metadata title.
    assert ctx["target_real_title"] not in blob, (
        "B must NEVER see the unreadable target's real filename / metadata"
    )
    assert ctx["target"] not in blob, "B must NEVER see the unreadable target's id"
    # (c) The masked row still appears — existence of a link is not hidden, identity is.
    assert _MASK in blob, (
        f"an unreadable linked endpoint must render as {_MASK!r} (the existence is shown, "
        "the identity masked)"
    )


@pytest.mark.xfail(strict=False, reason="Plan 03 ships the masking handler")
@pytest.mark.asyncio
async def test_readable_endpoint_shows_real_filename_for_owner(pg_pool, two_users_with_link):
    """A (who CAN read the target) sees the target's REAL filename — the mask is per-viewer."""
    if not await _table_exists(pg_pool, "document_relationships"):
        pytest.skip("document_relationships table absent")

    from app.services.tool_dispatcher import _handle_get_related_documents

    sb = _supabase_or_skip()
    ctx = two_users_with_link

    out_a = json.loads((await _handle_get_related_documents(
        {"document_id": ctx["subject"]}, _make_ctx(sb, str(ctx["user_a"])))).result)

    files_a = _ref_filenames(out_a)
    blob_a = json.dumps(out_a)
    # (a) A sees the target's real filename (NON-vacuous: the mask is genuinely per-viewer,
    # not a blanket hide that would also hide it from the owner).
    assert any(ctx["target_real_title"] in (f or "") for f in files_a) or (
        ctx["target_real_title"] in blob_a
    ), "A (who can read the target) MUST see its real filename — the mask is per-viewer"
    assert _MASK not in blob_a, "A must NOT see the mask for a target A can read"

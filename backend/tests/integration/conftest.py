"""Shared integration-test fixtures.

Phase 074 D-074-11: hoists ``_reset_redis_singleton`` from per-file copies in
``test_062_stream_replay.py`` (canonical at :36-51) and
``test_063_post_then_subscribe.py`` (verbatim copy at :45-62). The two local
copies were deleted in this commit; ``test_059_disconnect.py`` now inherits
the same protection that fixes the original SEED-011 fixture-teardown bug
(``RuntimeError: Event loop is closed`` on the second / third test in the file).

Phase 073's ``_reset_pg_pool_singleton`` (lives in ``backend/tests/conftest.py``)
is intentionally NOT hoisted here - Phase 074 D-074-13 keeps it at root scope
because asyncpg pools matter to unit + integration tests alike. Both autouse
fixtures stack additively on every integration test (root -> integration -> file).

``_reset_sse_starlette_app_status`` stays in test_059_disconnect.py per D-074-12
(sse-starlette-specific; co-located version-pin assertion at 2.4.x; already
cross-imported by test_062 and test_063 - moving it would break the import path).
"""
import json
from uuid import uuid4

import pytest
import pytest_asyncio

try:
    import asyncpg
except ImportError:  # pragma: no cover
    asyncpg = None

from tests.integration._rls_harness import (
    PG_AVAILABLE,
    PG_TEST_DSN,
    probe_auth_uid_variant,
)


@pytest.fixture(autouse=True)
def _reset_redis_singleton():
    """Reset app.dependencies._redis so each test gets a Redis client bound to
    its own per-test event loop (pytest-asyncio function-scope creates a fresh
    loop per test). Without this, a singleton created in test N's loop is
    invoked by test N+1 against a closed loop -> RuntimeError("Event loop is closed").

    Mirrors the rationale of test_059_disconnect's _reset_sse_starlette_app_status
    fixture (RESEARCH.md Pitfall 6) - same loop-binding trap, different module.
    Required for any test that hits the real `get_redis()` singleton (no Redis
    dependency override). Hoisted from per-file copies per Phase 074 D-074-11.
    """
    import app.dependencies as _deps
    _deps._redis = None
    yield
    _deps._redis = None


# ═══════════════════════════════════════════════════════════════════════
# Phase 163 (TEN-01/TEN-02) — two-user/two-org RLS scaffold (Plan 163-01 Task 2)
# ═══════════════════════════════════════════════════════════════════════
#
# The shared live-DB fixtures every downstream test_163_* file consumes: a dedicated
# asyncpg pool, two seeded users in two DISJOINT orgs each carrying >=1 owned row
# (non-vacuity — a blanket-empty bug cannot false-green a leak test), and the
# auth.uid() live-variant probe that records which GUC form THIS DB reads (D-02).
# Skip-guarded on the local Postgres :54322 via the _rls_harness DSN.


async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


@pytest_asyncio.fixture
async def pg_pool():
    """A dedicated asyncpg pool (JSONB codec registered) against the local Postgres.

    Separate from the app singleton pool (``get_pg_pool``) so seeding/teardown never
    entangles with the autouse ``_reset_pg_pool_singleton`` reset — both point at the
    same :54322 DB, so rows committed here are visible to ``get_user_pg_connection``.
    """
    if not PG_AVAILABLE or asyncpg is None:
        pytest.skip(f"Local Postgres on {PG_TEST_DSN} not reachable")

    async def _init(conn):
        await conn.set_type_codec(
            "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog",
        )

    pool = await asyncpg.create_pool(PG_TEST_DSN, min_size=1, max_size=4, init=_init)
    try:
        yield pool
    finally:
        await pool.close()


@pytest_asyncio.fixture
async def two_orgs_two_users(pg_pool):
    """Seed user A in Org X and user B in Org Y — two DISJOINT orgs — each owning >=1
    row in a shared table set (documents / folders / threads / skills).

    Membership comes from the mig-105 ``handle_new_user`` personal-org trigger when
    present; falls back to an explicit org + membership so the seed is deterministic on
    any DB. Content rows get ``org_id`` auto-filled by the mig-106 BEFORE-INSERT trigger
    (which reads the user's membership) — so the membership MUST exist first.

    Non-vacuity: every user owns real positives, so a later "A sees 0 of B's rows"
    cannot false-green on an all-empty DB. FK-safe teardown: content rows, then the org
    (CASCADE cleans departments/org_members), then profile, then the auth user.
    """
    for tbl in ("organizations", "org_members", "documents"):
        if not await _table_exists(pg_pool, tbl):
            pytest.skip(f"{tbl} table absent — org schema (mig 104/105/106) not applied")

    ctx: dict = {}
    for label in ("a", "b"):
        uid = uuid4()
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            uid, f"phase-163-{label}-{uid}@test.local",
        )

        # mig-105 handle_new_user auto-provisions a personal org + org_members row.
        row = await pg_pool.fetchrow(
            "SELECT org_id FROM public.org_members WHERE user_id = $1 LIMIT 1", uid
        )
        if row is None:
            # Fallback — trigger absent or its personal-org creation swallowed a WARNING.
            org_id = uuid4()
            await pg_pool.execute(
                "INSERT INTO public.organizations (id, name) VALUES ($1, $2)",
                org_id, f"163-test-org-{label}-{org_id}",
            )
            await pg_pool.execute(
                "INSERT INTO public.org_members (org_id, user_id, role) "
                "VALUES ($1, $2, 'member')",
                org_id, uid,
            )
        else:
            org_id = row["org_id"]

        # Representative owned rows — org_id auto-filled from the membership by the trigger.
        doc_id = uuid4()
        await pg_pool.execute(
            "INSERT INTO public.documents (id, user_id, filename, file_path, file_size, "
            "mime_type, status, is_latest, version_number) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, true, 1)",
            doc_id, uid, f"163-{label}-{doc_id}.txt", f"{uid}/{doc_id}.txt", 100,
            "text/plain", "completed",
        )
        folder_id = uuid4()
        await pg_pool.execute(
            "INSERT INTO public.folders (id, user_id, name) VALUES ($1, $2, $3)",
            folder_id, uid, f"163-{label}-folder",
        )
        thread_id = uuid4()
        await pg_pool.execute(
            "INSERT INTO public.threads (id, user_id, title) VALUES ($1, $2, $3)",
            thread_id, uid, f"163-{label}-thread",
        )
        skill_id = uuid4()
        await pg_pool.execute(
            "INSERT INTO public.skills (id, user_id, name) VALUES ($1, $2, $3)",
            skill_id, uid, f"163-{label}-skill",
        )

        ctx[label] = {
            "uid": str(uid),
            "org_id": str(org_id),
            "doc_id": str(doc_id),
            "folder_id": str(folder_id),
            "thread_id": str(thread_id),
            "skill_id": str(skill_id),
        }

    try:
        yield ctx
    finally:
        for label in ("a", "b"):
            uid = ctx[label]["uid"]
            org_id = ctx[label]["org_id"]
            for sql, arg in (
                ("DELETE FROM public.skills WHERE user_id = $1", uid),
                ("DELETE FROM public.threads WHERE user_id = $1", uid),
                ("DELETE FROM public.documents WHERE user_id = $1", uid),
                ("DELETE FROM public.folders WHERE user_id = $1", uid),
                ("DELETE FROM public.org_members WHERE user_id = $1", uid),
                # org delete CASCADEs departments / dept_members / any residual org_members.
                ("DELETE FROM public.organizations WHERE id = $1", org_id),
                ("DELETE FROM public.profiles WHERE id = $1", uid),
                ("DELETE FROM auth.users WHERE id = $1", uid),
            ):
                try:
                    await pg_pool.execute(sql, arg)
                except Exception:
                    pass


@pytest_asyncio.fixture
async def auth_uid_variant(pg_pool):
    """Record which GUC form(s) THIS local DB's ``auth.uid()`` reads (D-02 arbitration).

    Returns ``{"reads_legacy": bool, "reads_json": bool, "definition": str}``. Both-forms
    is why ``get_user_pg_connection`` sets both unconditionally — variant-independent by
    construction; this fixture makes the live variant observable for the leak tests.
    """
    return await probe_auth_uid_variant(pg_pool)

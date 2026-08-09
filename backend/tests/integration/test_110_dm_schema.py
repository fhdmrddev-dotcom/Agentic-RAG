"""Phase 110 SC#1 — schema shape + live 2-user RLS sample for the 4 DM tables.

Asserts (via pg_class/pg_constraint/information_schema):
  - all 4 tables exist with rowsecurity = true;
  - each org_id is nullable AND has NO FK (F7 forward-compat trap);
  - the SELECT policy shape: user_id for all 4 tables, plus is_system_global for the
    3 library/config tables (document_views, classification_rules,
    metadata_field_definitions). document_relationships is USER-SCOPED ONLY (no
    is_system_global column by design — see 110-RESEARCH.md §3.2 / ARCHITECTURE.md §2).
Plus a LIVE 2-user RLS sample on >=2 of the 4 tables + the nullable-user_id
global-field path on metadata_field_definitions.

RLS predicates evaluate auth.uid(), and a raw SUPERUSER asyncpg pool BYPASSES
RLS — so each user's queries run inside a transaction that does
``SET LOCAL ROLE authenticated`` + ``set_config('request.jwt.claim.sub', <uid>, true)``
so auth.uid() resolves to that user. (A1/A4 note: Plan 02 pins this exact
role-switch incantation against the live DB; this is the documented approach.)

Live-DB harness modeled on test_092_harness_audit_live.py. Skips cleanly when
:54322 is unreachable.

NOTE: until migration 071 is applied (Plan 02) the 4 tables do not exist — the
schema assertions RED/skip. That is expected for THIS plan; GREEN in Plan 02.
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

_DM_TABLES = (
    "document_views",
    "document_relationships",
    "classification_rules",
    "metadata_field_definitions",
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live DM schema/RLS tests",
)


def _migration_applied_skip(pool_has_table: bool) -> None:
    if not pool_has_table:
        pytest.skip("migration 071 not applied (DM tables absent) — Plan 02 applies it")


@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool against local Postgres :54322."""
    async def _init(conn):
        await conn.set_type_codec(
            "jsonb",
            encoder=json.dumps,
            decoder=json.loads,
            schema="pg_catalog",
        )
    pool = await asyncpg.create_pool(
        _POSTGRES_TEST_DSN,
        min_size=1,
        max_size=4,
        init=_init,
    )
    try:
        yield pool
    finally:
        await pool.close()


@pytest_asyncio.fixture
async def two_users(pg_pool):
    """Seed TWO throwaway auth.users rows (A + B) for the cross-user RLS sample.

    Yields (user_a, user_b). FK-safe teardown removes any rows the test wrote in
    the 4 DM tables, then the users.
    """
    user_a = uuid4()
    user_b = uuid4()
    try:
        for uid in (user_a, user_b):
            await pg_pool.execute(
                "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
                uid, f"phase-110-rls-{uid}@test.local",
            )
    except Exception as e:
        pytest.skip(f"two_users fixture setup failed: {type(e).__name__}: {e}")
    yield (user_a, user_b)
    for table in _DM_TABLES:
        for uid in (user_a, user_b):
            try:
                await pg_pool.execute(
                    f"DELETE FROM public.{table} WHERE user_id = $1", uid
                )
            except Exception:
                pass
    # global metadata fields seeded by the test (user_id NULL) are removed by field_key
    try:
        await pg_pool.execute(
            "DELETE FROM public.metadata_field_definitions WHERE field_key = $1",
            "phase110_global_probe",
        )
    except Exception:
        pass
    for uid in (user_a, user_b):
        try:
            await pg_pool.execute("DELETE FROM auth.users WHERE id = $1", uid)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# SC#1 — schema shape (rowsecurity, org_id nullable + no FK, SELECT policy)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.parametrize("table", _DM_TABLES)
async def test_dm_table_has_rls_enabled(pg_pool, table):
    """Each of the 4 DM tables exists with rowsecurity = true."""
    rowsecurity = await pg_pool.fetchval(
        "SELECT relrowsecurity FROM pg_class "
        "WHERE oid = ('public.' || $1)::regclass",
        table,
    ) if await _table_exists(pg_pool, table) else None
    _migration_applied_skip(rowsecurity is not None)
    assert rowsecurity is True, f"{table} does not have RLS enabled"


@pytest.mark.asyncio
@pytest.mark.parametrize("table", _DM_TABLES)
async def test_dm_table_org_id_nullable_no_fk(pg_pool, table):
    """org_id is nullable AND has NO foreign key (F7 forward-compat trap)."""
    _migration_applied_skip(await _table_exists(pg_pool, table))
    is_nullable = await pg_pool.fetchval(
        "SELECT is_nullable FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name=$1 AND column_name='org_id'",
        table,
    )
    assert is_nullable == "YES", f"{table}.org_id must be nullable (got {is_nullable})"
    # No FK referencing org_id.
    fk_count = await pg_pool.fetchval(
        "SELECT count(*) FROM pg_constraint con "
        "JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey) "
        "WHERE con.contype = 'f' AND con.conrelid = ('public.' || $1)::regclass "
        "AND att.attname = 'org_id'",
        table,
    )
    assert fk_count == 0, f"{table}.org_id must NOT have a foreign key (found {fk_count})"


# The 3 library/config tables carry is_system_global (user_id + is_system_global RLS). By
# design, document_relationships does NOT have an is_system_global column — a
# relationship is an inherently user-owned link between a user's own documents,
# never a global/admin-seeded shareable object. Its SELECT policy is user-scoped
# only. (Authoritative per-table DDL: 110-RESEARCH.md §3.2 / 110-PATTERNS.md §3.2,
# both citing ARCHITECTURE.md §2.) Asserting is_system_global on it would embed the wrong
# uniform-template assumption and fail correctly — so we assert per-table shape.
_IS_GLOBAL_TABLES = frozenset(
    {"document_views", "classification_rules", "metadata_field_definitions"}
)


@pytest.mark.asyncio
@pytest.mark.parametrize("table", _DM_TABLES)
async def test_dm_table_select_policy_shape(pg_pool, table):
    """The SELECT policy USING clause carries user_id for every table, and
    is_system_global ONLY for the 3 library tables (NOT document_relationships, which
    is user-scoped by design)."""
    _migration_applied_skip(await _table_exists(pg_pool, table))
    quals = await pg_pool.fetch(
        "SELECT qual FROM pg_policies WHERE schemaname='public' AND tablename=$1 AND cmd='SELECT'",
        table,
    )
    assert quals, f"{table} has no SELECT policy"
    joined = " ".join((r["qual"] or "") for r in quals)
    assert "user_id" in joined, (
        f"{table} SELECT policy missing user_id: {joined!r}"
    )
    if table in _IS_GLOBAL_TABLES:
        assert "is_system_global" in joined, (
            f"{table} SELECT policy missing is_system_global (library table): {joined!r}"
        )
    else:
        # document_relationships: user-scoped only, NO is_system_global.
        assert "is_system_global" not in joined, (
            f"{table} SELECT policy must be user-scoped only (no is_system_global): {joined!r}"
        )


# ---------------------------------------------------------------------------
# SC#1 — live 2-user RLS sample (cross-user isolation + global visibility)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rls_cross_user_isolation_document_views(pg_pool, two_users):
    """User B cannot SELECT user A's private document_views row."""
    _migration_applied_skip(await _table_exists(pg_pool, "document_views"))
    user_a, user_b = two_users
    row_id = uuid4()
    # Service-role/superuser INSERT of A's private row (RLS bypassed at insert).
    await pg_pool.execute(
        "INSERT INTO public.document_views (id, user_id, name) VALUES ($1, $2, $3)",
        row_id, user_a, "A private view",
    )
    # User B reads under RLS — must see 0 of A's private rows.
    count_b = await _select_count_as_user(
        pg_pool, user_b,
        "SELECT count(*) FROM public.document_views WHERE id = $1", row_id,
    )
    assert count_b == 0, "RLS leak: user B sees user A's private document_views row"
    # User A reads under RLS — sees their own.
    count_a = await _select_count_as_user(
        pg_pool, user_a,
        "SELECT count(*) FROM public.document_views WHERE id = $1", row_id,
    )
    assert count_a == 1, "RLS over-restricts: user A cannot see their own row"


@pytest.mark.asyncio
async def test_rls_cross_user_isolation_classification_rules(pg_pool, two_users):
    """User B cannot SELECT user A's private classification_rules row (2nd table)."""
    _migration_applied_skip(await _table_exists(pg_pool, "classification_rules"))
    user_a, user_b = two_users
    row_id = uuid4()
    await pg_pool.execute(
        "INSERT INTO public.classification_rules (id, user_id, name, match_expr) "
        "VALUES ($1, $2, $3, $4::jsonb)",
        row_id, user_a, "A rule", json.dumps({"k": "v"}),
    )
    count_b = await _select_count_as_user(
        pg_pool, user_b,
        "SELECT count(*) FROM public.classification_rules WHERE id = $1", row_id,
    )
    assert count_b == 0, "RLS leak: user B sees user A's private classification_rules row"


@pytest.mark.asyncio
async def test_rls_global_metadata_field_visible_to_other_user(pg_pool, two_users):
    """The nullable-user_id global-field path: a user_id=NULL is_system_global=true
    metadata_field_definitions row is visible to a second user (B)."""
    _migration_applied_skip(await _table_exists(pg_pool, "metadata_field_definitions"))
    _user_a, user_b = two_users
    row_id = uuid4()
    # Global field: user_id NULL, is_system_global true (allowed by mfd_reachable CHECK).
    await pg_pool.execute(
        "INSERT INTO public.metadata_field_definitions (id, user_id, field_key, is_system_global) "
        "VALUES ($1, NULL, $2, true)",
        row_id, "phase110_global_probe",
    )
    count_b = await _select_count_as_user(
        pg_pool, user_b,
        "SELECT count(*) FROM public.metadata_field_definitions WHERE id = $1", row_id,
    )
    assert count_b == 1, "global metadata field not visible to user B via is_system_global path"


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


async def _select_count_as_user(pool, user_id, sql: str, *args) -> int:
    """Run a SELECT under RLS as the given user (authenticated role + JWT sub).

    A superuser pool bypasses RLS; SET LOCAL ROLE authenticated + the JWT-sub
    config make auth.uid() resolve to user_id for the duration of the tx.
    """
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("SET LOCAL ROLE authenticated")
            await conn.execute(
                "SELECT set_config('request.jwt.claim.sub', $1, true)", str(user_id)
            )
            return await conn.fetchval(sql, *args)

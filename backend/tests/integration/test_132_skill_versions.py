"""Phase 132 Plan 01 (VER-01 / EVAL-01) — LIVE-DB coverage for the skill version-capture
trigger, append-only immutability, toggle-skip, the version-number race guard, and the v1
backfill semantics defined in supabase/migrations/079_skill_versions_and_test_cases.sql.

VER-01 is implemented as a ZERO-APP-CODE Postgres trigger (capture_skill_version, AFTER INSERT
OR UPDATE ON public.skills), so the only honest proof is exercising the REAL trigger against the
REAL local DB — a mock store cannot reproduce trigger firing, IS DISTINCT FROM trifecta skipping,
or the BEFORE UPDATE append-only block. This file is therefore the live-DB gate.

All DB writes occur INSIDE a transaction that ROLLS BACK (no dev-data mutation). FK parents
(auth.users + public.skills) are seeded inside the same rolled-back tx (mirrors the
test_123_1_tuner_runs_timestamp.py idiom). The ONLY clean skips are when :54322 is unreachable
(no live DB to gate) OR migration 079 is unapplied (to_regclass('public.skill_versions') IS NULL).
The six tests are EXPECTED to green-skip until Task 3 applies 079; once applied they MUST PASS.
"""

import asyncio
import json
import os
import uuid

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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 132 VER-01 gate",
)


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


async def _skill_versions_applied(pool) -> bool:
    """True when migration 079 is applied (skill_versions table physically present)."""
    return bool(await pool.fetchval("SELECT to_regclass('public.skill_versions')"))


_SKIP_UNAPPLIED = (
    "migration 079 NOT applied — public.skill_versions absent. Apply "
    "supabase/migrations/079_skill_versions_and_test_cases.sql to the live DB "
    "(SQL-editor paste to :54322; NEVER db push/reset)."
)


async def _seed_skill(conn, *, name="probe", description="d", instructions="i",
                      is_org_shared=False):
    """Seed an auth.users + public.skills FK chain inside the caller's rolled-back tx.

    Returns (user_id, skill_id). The skill INSERT fires the capture trigger → a v1 row.
    """
    uid = uuid.uuid4()
    sid = uuid.uuid4()
    await conn.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        uid, f"phase-132-{uid}@test.local",
    )
    await conn.execute(
        "INSERT INTO public.skills (id, user_id, name, description, instructions, is_org_shared) "
        "VALUES ($1, $2, $3, $4, $5, $6)",
        sid, uid, name, description, instructions, is_org_shared,
    )
    return uid, sid


@pytest.mark.asyncio
async def test_insert_captures_v1(pg_pool):
    """INSERT a skill → exactly one skill_versions row: version_number=1, source='manual',
    content columns mirror the skill, user_id = skill.user_id (NOT NULL)."""
    async with pg_pool.acquire() as conn:
        if not await _skill_versions_applied(conn):
            pytest.skip(_SKIP_UNAPPLIED)
        tx = conn.transaction()
        await tx.start()
        try:
            uid, sid = await _seed_skill(
                conn, name="v1 skill", description="desc", instructions="instr",
            )
            rows = await conn.fetch(
                "SELECT version_number, source, name, description, instructions, user_id "
                "FROM public.skill_versions WHERE skill_id = $1", sid,
            )
            assert len(rows) == 1, "INSERT must capture exactly one version row"
            r = rows[0]
            assert r["version_number"] == 1
            assert r["source"] == "manual"
            assert r["name"] == "v1 skill"
            assert r["description"] == "desc"
            assert r["instructions"] == "instr"
            assert r["user_id"] == uid, "user_id must come from NEW.user_id (not NULL auth.uid)"
        finally:
            await tx.rollback()


@pytest.mark.asyncio
async def test_content_change_captures_new_version(pg_pool):
    """UPDATE the skill's instructions → a new row with version_number=2 (D-02 content change)."""
    async with pg_pool.acquire() as conn:
        if not await _skill_versions_applied(conn):
            pytest.skip(_SKIP_UNAPPLIED)
        tx = conn.transaction()
        await tx.start()
        try:
            _uid, sid = await _seed_skill(conn, instructions="original")
            await conn.execute(
                "UPDATE public.skills SET instructions = $2 WHERE id = $1",
                sid, "revised instructions",
            )
            nums = [r["version_number"] for r in await conn.fetch(
                "SELECT version_number FROM public.skill_versions "
                "WHERE skill_id = $1 ORDER BY version_number", sid,
            )]
            assert nums == [1, 2], f"content change must append v2; got {nums}"
        finally:
            await tx.rollback()


@pytest.mark.asyncio
async def test_toggle_does_not_version(pg_pool):
    """UPDATE only is_enabled (then is_org_shared) → version count unchanged (D-02)."""
    async with pg_pool.acquire() as conn:
        if not await _skill_versions_applied(conn):
            pytest.skip(_SKIP_UNAPPLIED)
        tx = conn.transaction()
        await tx.start()
        try:
            _uid, sid = await _seed_skill(conn)

            async def _count():
                return await conn.fetchval(
                    "SELECT count(*) FROM public.skill_versions WHERE skill_id = $1", sid,
                )

            assert await _count() == 1
            await conn.execute(
                "UPDATE public.skills SET is_enabled = NOT is_enabled WHERE id = $1", sid,
            )
            assert await _count() == 1, "is_enabled toggle must NOT capture a version"
            await conn.execute(
                "UPDATE public.skills SET is_org_shared = NOT is_org_shared WHERE id = $1", sid,
            )
            assert await _count() == 1, "is_org_shared toggle must NOT capture a version"
        finally:
            await tx.rollback()


@pytest.mark.asyncio
async def test_version_update_blocked(pg_pool):
    """UPDATE an existing skill_versions row → raises (append-only, SQLSTATE 23514)."""
    async with pg_pool.acquire() as conn:
        if not await _skill_versions_applied(conn):
            pytest.skip(_SKIP_UNAPPLIED)
        tx = conn.transaction()
        await tx.start()
        try:
            _uid, sid = await _seed_skill(conn)
            ver_id = await conn.fetchval(
                "SELECT id FROM public.skill_versions WHERE skill_id = $1", sid,
            )
            with pytest.raises(asyncpg.PostgresError) as exc:
                await conn.execute(
                    "UPDATE public.skill_versions SET name = $2 WHERE id = $1",
                    ver_id, "mutated",
                )
            assert exc.value.sqlstate == "23514", (
                f"append-only block must raise 23514; got {exc.value.sqlstate}"
            )
        finally:
            await tx.rollback()


@pytest.mark.asyncio
async def test_backfill_v1(pg_pool):
    """The backfill INSERT path: a directly-inserted v1 'backfill' row coexists with monotonic
    trigger-captured versions (assert source value + version_number monotonicity)."""
    async with pg_pool.acquire() as conn:
        if not await _skill_versions_applied(conn):
            pytest.skip(_SKIP_UNAPPLIED)
        tx = conn.transaction()
        await tx.start()
        try:
            # Seed a skill via direct insert that BYPASSES the capture trigger, to simulate a
            # pre-079 skill, then replay the migration's backfill INSERT … SELECT for that skill.
            uid = uuid.uuid4()
            sid = uuid.uuid4()
            await conn.execute(
                "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
                uid, f"phase-132-backfill-{uid}@test.local",
            )
            await conn.execute("ALTER TABLE public.skills DISABLE TRIGGER skills_capture_version")
            try:
                await conn.execute(
                    "INSERT INTO public.skills (id, user_id, name, description, instructions) "
                    "VALUES ($1, $2, $3, $4, $5)",
                    sid, uid, "legacy skill", "legacy desc", "legacy instr",
                )
            finally:
                await conn.execute("ALTER TABLE public.skills ENABLE TRIGGER skills_capture_version")

            assert await conn.fetchval(
                "SELECT count(*) FROM public.skill_versions WHERE skill_id = $1", sid,
            ) == 0, "the trigger-disabled insert must leave no version row (pre-backfill state)"

            # Replay the migration backfill for this one skill.
            await conn.execute(
                "INSERT INTO public.skill_versions "
                "(skill_id, user_id, version_number, name, description, instructions, source) "
                "SELECT id, user_id, 1, name, description, instructions, 'backfill' "
                "FROM public.skills WHERE id = $1", sid,
            )
            row = await conn.fetchrow(
                "SELECT version_number, source, name FROM public.skill_versions "
                "WHERE skill_id = $1", sid,
            )
            assert row["version_number"] == 1
            assert row["source"] == "backfill"
            assert row["name"] == "legacy skill"

            # A subsequent content change appends a monotonic v2 (proves backfill seeds the max).
            await conn.execute(
                "UPDATE public.skills SET instructions = 'changed' WHERE id = $1", sid,
            )
            nums = [r["version_number"] for r in await conn.fetch(
                "SELECT version_number FROM public.skill_versions "
                "WHERE skill_id = $1 ORDER BY version_number", sid,
            )]
            assert nums == [1, 2], f"backfilled v1 must seed the max so the next version is v2; got {nums}"
        finally:
            await tx.rollback()


@pytest.mark.asyncio
async def test_version_number_unique(pg_pool):
    """Two rows with the same (skill_id, version_number) violate skill_versions_skill_num_unique
    (SQLSTATE 23505) — the max+1 race guard (D-03-R3 / T-132-04)."""
    async with pg_pool.acquire() as conn:
        if not await _skill_versions_applied(conn):
            pytest.skip(_SKIP_UNAPPLIED)
        tx = conn.transaction()
        await tx.start()
        try:
            uid, sid = await _seed_skill(conn)  # capture trigger already wrote v1
            with pytest.raises(asyncpg.UniqueViolationError) as exc:
                await conn.execute(
                    "INSERT INTO public.skill_versions "
                    "(skill_id, user_id, version_number, name, description, instructions, source) "
                    "VALUES ($1, $2, 1, 'dup', '', '', 'manual')",
                    sid, uid,
                )
            assert exc.value.sqlstate == "23505"
        finally:
            await tx.rollback()

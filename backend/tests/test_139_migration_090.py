"""Phase 139 Plan 03 (SI-02) — LIVE-DB gate for the kind-discriminated skill_proposals
extension defined in supabase/migrations/090_skill_proposals_description_kind.sql.

SI-02 REUSES the SI-01 substrate (D-11): the single ``public.skill_proposals`` table now
carries a ``kind`` discriminator ('instruction' | 'description'). Migration 090 (a) relaxes
``proposed_instructions`` to NULLABLE so a description proposal (no instructions) can persist,
and (b) installs the kind-gated partial CHECK ``skill_proposals_kind_fields`` so EXACTLY ONE
of (proposed_instructions | proposed_description) is present per row. Those are DB-level
integrity gates below the route validation — the only honest proof is exercising the REAL
constraint against the REAL local DB (a mock store cannot reproduce a CHECK firing or the
relaxed NOT NULL). This file is therefore the live-DB gate.

All DB writes occur INSIDE a transaction that ROLLS BACK (no dev-data mutation). FK parents
(auth.users + public.skills, whose INSERT fires the capture trigger → a base v1 skill_versions
row) are seeded inside the same rolled-back tx (mirrors the test_132_skill_versions.py idiom).
The two rejection/acceptance branches run in nested savepoints so the failing INSERT does not
abort the outer tx. The ONLY clean skips are when :54322 is unreachable (no live DB to gate)
OR migration 090 is unapplied (the skill_proposals_kind_fields constraint is absent). The test
is EXPECTED to green-skip until Plan 139-03 Task 2 applies 090 to the live DB; once applied it
MUST PASS.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 139 migration-090 gate",
)


@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool against local Postgres :54322 (jsonb codec)."""
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


async def _migration_090_applied(conn) -> bool:
    """True when migration 090 is applied — the kind-gated CHECK physically exists.

    The constraint is the definitive gate: it is added LAST in the migration, after the
    additive columns + the proposed_instructions NOT-NULL relax, so its presence proves the
    whole migration ran.
    """
    return bool(await conn.fetchval(
        "SELECT 1 FROM pg_constraint WHERE conname = 'skill_proposals_kind_fields'"
    ))


_SKIP_UNAPPLIED = (
    "migration 090 NOT applied — the skill_proposals_kind_fields CHECK is absent. Apply "
    "supabase/migrations/090_skill_proposals_description_kind.sql to the live DB "
    "(SQL-editor paste / psycopg2 to :54322; NEVER db push/reset)."
)


async def _seed_proposal_parents(conn):
    """Seed the auth.users → public.skills FK chain inside the caller's rolled-back tx.

    The skills INSERT fires the capture_skill_version trigger (migration 079) → a base v1
    public.skill_versions row, which satisfies skill_proposals.base_skill_version_id (NOT NULL).
    Returns (user_id, skill_id, base_skill_version_id).
    """
    uid = uuid.uuid4()
    sid = uuid.uuid4()
    await conn.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        uid, f"phase-139-{uid}@test.local",
    )
    await conn.execute(
        "INSERT INTO public.skills (id, user_id, name, description, instructions, is_org_shared) "
        "VALUES ($1, $2, $3, $4, $5, false)",
        sid, uid, "si-02 probe", "old description", "live instructions",
    )
    base_version_id = await conn.fetchval(
        "SELECT id FROM public.skill_versions WHERE skill_id = $1 "
        "ORDER BY version_number LIMIT 1", sid,
    )
    assert base_version_id is not None, (
        "the skills INSERT must fire capture_skill_version → a base v1 row "
        "(migration 079 must be applied for base_skill_version_id to resolve)"
    )
    return uid, sid, base_version_id


@pytest.mark.asyncio
async def test_kind_check_constraint(pg_pool):
    """The kind-gated CHECK is the DB's second gate (D-11), and proposed_instructions is nullable.

    Branch A (rejected): a kind='description' row with proposed_description=NULL (and no
      instructions) violates skill_proposals_kind_fields — Postgres raises a check_violation
      (SQLSTATE 23514), NOT a NOT-NULL violation (proving the CHECK, not a column constraint,
      is the gate).
    Branch B (accepted): a kind='description' row WITH proposed_description set and
      proposed_instructions=NULL INSERTs successfully — proving proposed_instructions was
      relaxed to nullable so a description proposal can persist without instructions.
    """
    async with pg_pool.acquire() as conn:
        if not await _migration_090_applied(conn):
            pytest.skip(_SKIP_UNAPPLIED)

        tx = conn.transaction()
        await tx.start()
        try:
            uid, sid, base_vid = await _seed_proposal_parents(conn)

            # ── Branch A: NULL proposed_description on a description row is REJECTED ──
            # Runs in a nested savepoint so the deliberate failure does not abort the outer tx.
            inner = conn.transaction()
            await inner.start()
            with pytest.raises(asyncpg.PostgresError) as exc:
                await conn.execute(
                    "INSERT INTO public.skill_proposals "
                    "(skill_id, base_skill_version_id, user_id, kind, "
                    " proposed_description, proposed_instructions) "
                    "VALUES ($1, $2, $3, 'description', NULL, NULL)",
                    sid, base_vid, uid,
                )
            assert exc.value.sqlstate == "23514", (
                "a description row with NULL proposed_description must raise the "
                f"skill_proposals_kind_fields CHECK (23514); got {exc.value.sqlstate}"
            )
            await inner.rollback()  # discard the aborted savepoint; keep the seeded outer tx

            # ── Branch B: description row with proposed_instructions=NULL is ACCEPTED ──
            proposal_id = await conn.fetchval(
                "INSERT INTO public.skill_proposals "
                "(skill_id, base_skill_version_id, user_id, kind, "
                " proposed_description, proposed_instructions) "
                "VALUES ($1, $2, $3, 'description', $4, NULL) "
                "RETURNING id",
                sid, base_vid, uid, "the held-out per-provider winning description",
            )
            assert proposal_id is not None, (
                "a description row with proposed_description set and proposed_instructions=NULL "
                "must INSERT (proposed_instructions relaxed to nullable by migration 090)"
            )

            row = await conn.fetchrow(
                "SELECT kind, proposed_description, proposed_instructions "
                "FROM public.skill_proposals WHERE id = $1", proposal_id,
            )
            assert row["kind"] == "description"
            assert row["proposed_description"] == "the held-out per-provider winning description"
            assert row["proposed_instructions"] is None, (
                "proposed_instructions must persist as NULL on a description proposal"
            )
        finally:
            await tx.rollback()  # NEVER mutate live dev data

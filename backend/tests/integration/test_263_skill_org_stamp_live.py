"""Phase 263 (PACK-17, structural half / D-263-08) — LIVE-DB drive of the skills org stamp.

WHY A LIVE TEST AND NOT A MOCK. PACK-17 has three axes and only two of them are
reachable offline:

  1. RESOLUTION — does the new born-for arm let a foreign-org row through?
     Driven in ``tests/unit/test_263_expert_born_skill_resolution.py``.
  2. VISIBILITY — does the new column widen the agent-side rule?
     Driven in ``tests/unit/test_seed125_skill_visibility_filter.py``.
  3. CREATION — is ``public.skills.org_id`` derived rather than supplied?
     THAT LIVES IN THE DATABASE. It is a ``BEFORE INSERT`` trigger
     (``skills_autofill_org_id`` -> ``public.autofill_org_id_by_owner('user_id')``)
     plus an INSERT RLS policy. No mock can prove a trigger fires, and asserting
     that ``POST /skills`` omits ``org_id`` from its payload proves only what the
     application intends — not what the database does when something else inserts.

This file is axis 3, driven against the real local Postgres.

WHAT IT ALSO DOCUMENTS, deliberately. The trigger has a NO-OP arm: ``IF NEW.org_id
IS NOT NULL THEN RETURN NEW``. So a caller that DOES supply ``org_id`` keeps its
value verbatim — the stamp is a default, not an enforcement. That is precisely why
``POST /skills`` must never place ``org_id`` in its insert payload, and the second
case here pins that fact rather than leaving it as folklore. The enforcement half
is the INSERT RLS policy, which a service-role connection (this test, and every
service-role call site in the app) bypasses — which is the whole reason SEED-125
exists.

APPLY-GATE SEMANTICS (the ``test_137_2_skill_creator_seed_content.py`` convention,
deliberately different from schema tests that skip cleanly pre-apply): migration 191
is applied to this environment by the time this runs, so an ABSENT column or an
absent ``org_members`` row is a HARD FAILURE naming the setup step — never a clean
skip. ⛔ A skip here would be indistinguishable from a pass, which is the failure
mode this convention exists to prevent. The ONLY clean skip is :54322 itself being
unreachable (no live DB to gate against at all).

⛔ THIS MODULE MUTATES ``public.skills``. It inserts two rows and deletes them in a
``finally``, then asserts the table's row count returned to its pre-test value.
Worktrees isolate files, not Postgres — this is why plan 263-01 is marked
un-parallelisable and must run with the local DB to itself.
"""

import asyncio
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 263 skills org-stamp gate",
)


@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool against local Postgres :54322."""
    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=4)
    try:
        yield pool
    finally:
        await pool.close()


@pytest.mark.asyncio
async def test_migration_191_column_exists_and_is_nullable(pg_pool):
    """Migration 191's column is present, uuid, nullable — and nothing was backfilled.

    ⛔ HARD FAILURE, not a skip: 191 is applied to this environment. An absent column
    means the migration was never pasted, and a clean skip would hide that.
    """
    col = await pg_pool.fetchrow(
        """
        SELECT data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'skills'
          AND column_name = 'born_for_expert_bundle_id';
        """
    )
    assert col is not None, (
        "public.skills.born_for_expert_bundle_id is ABSENT. Apply "
        "supabase/migrations/191_skill_expert_provenance.sql via the Supabase SQL editor "
        "(never `supabase db push` / `db reset`), then re-run."
    )
    assert col["data_type"] == "uuid"
    assert col["is_nullable"] == "YES"


@pytest.mark.asyncio
async def test_skills_org_id_is_derived_by_trigger_not_supplied(pg_pool):
    """PACK-17 creation axis: the org stamp comes from org_members, never from the payload.

    Two inserts, one test, because the pair is the point:
      * OMITTING org_id  -> the trigger derives it from the owner's org_members row.
      * SUPPLYING org_id -> the trigger's NO-OP arm keeps the supplied value verbatim.

    The second case is not a bug report — it is the documented forward-compat arm. It is
    pinned here because it is exactly WHY ``POST /skills`` must never place ``org_id`` in
    its insert payload: on a service-role connection (which bypasses the INSERT RLS policy)
    a caller-supplied org_id would stand, and the derivation that makes the stamp
    trustworthy would never run.
    """
    member = await pg_pool.fetchrow(
        "SELECT user_id, org_id FROM public.org_members LIMIT 1;"
    )
    assert member is not None, (
        "No row in public.org_members — cannot drive the org-derivation trigger. "
        "Seed at least one membership (any user in any org) and re-run. "
        "⛔ This is a HARD FAILURE rather than a skip: a skip here is indistinguishable "
        "from a pass."
    )
    owner_id = member["user_id"]
    expected_org = member["org_id"]

    count_before = await pg_pool.fetchval("SELECT count(*) FROM public.skills;")

    marker = uuid.uuid4().hex[:12]
    derived_name = f"test_263_org_stamp_derived_{marker}"
    supplied_name = f"test_263_org_stamp_supplied_{marker}"
    foreign_org = uuid.uuid4()
    inserted_ids: list[uuid.UUID] = []

    try:
        # CASE 1 — org_id deliberately OMITTED. The trigger is the thing under test.
        derived = await pg_pool.fetchrow(
            """
            INSERT INTO public.skills (user_id, name, description, instructions)
            VALUES ($1, $2, $3, $4)
            RETURNING id, org_id, born_for_expert_bundle_id;
            """,
            owner_id,
            derived_name,
            "Phase 263 live org-stamp drive (derived arm).",
            "Transient test row. Deleted in the same test.",
        )
        inserted_ids.append(derived["id"])

        assert derived["org_id"] == expected_org, (
            f"org_id was not derived from org_members: got {derived['org_id']}, "
            f"expected {expected_org}"
        )
        assert derived["born_for_expert_bundle_id"] is None, (
            "A freshly created skill must carry a NULL provenance marker — D-263-08 says "
            "NULL for every skill not born from Expert authoring."
        )

        # CASE 2 — org_id SUPPLIED, and foreign. The trigger's NO-OP arm keeps it verbatim.
        supplied = await pg_pool.fetchrow(
            """
            INSERT INTO public.skills (user_id, org_id, name, description, instructions)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, org_id;
            """,
            owner_id,
            foreign_org,
            supplied_name,
            "Phase 263 live org-stamp drive (no-op arm).",
            "Transient test row. Deleted in the same test.",
        )
        inserted_ids.append(supplied["id"])

        assert supplied["org_id"] == foreign_org, (
            "The trigger's forward-compat NO-OP arm (IF NEW.org_id IS NOT NULL THEN "
            "RETURN NEW) did not keep the supplied value — the trigger body changed."
        )
        assert supplied["org_id"] != expected_org, (
            "A supplied foreign org_id survived as the owner's org, which would mean the "
            "derivation overwrote it. That is not what the shipped trigger does."
        )
    finally:
        if inserted_ids:
            await pg_pool.execute(
                "DELETE FROM public.skills WHERE id = ANY($1::uuid[]);", inserted_ids
            )

    count_after = await pg_pool.fetchval("SELECT count(*) FROM public.skills;")
    assert count_after == count_before, (
        f"public.skills row count drifted: {count_before} -> {count_after}. "
        "This test must leave the local database exactly as it found it."
    )

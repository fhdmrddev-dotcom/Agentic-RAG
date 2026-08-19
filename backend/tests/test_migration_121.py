"""Phase 200 (DES-02) — LIVE-DB gate for migration 121's two workflow_phases timestamp columns.

Decisions **D-05** (the columns exist and a per-step duration becomes derivable) and **D-06**
(**NO BACKFILL** — every pre-200 row keeps both timestamps NULL) expressed as executable tests.

**Why the columns are owed.** Measured at HEAD: ``create_workflow_run`` batch-INSERTs every phase
row of a run in ONE transaction (``backend/app/db/workflows.py:334``), so ``created_at`` is the
moment the RUN was created — identical across all of a run's phases and unrelated to when any of
them began work. And all seven status writers overwrite ``updated_at=now()`` on every transition,
so ``updated_at`` is only ever "the last time anything about this row moved". A per-step duration
was therefore genuinely underivable before this migration.

**D-06 — THE NEGATIVE CONTROL IS AS LOAD-BEARING AS THE POSITIVE ONE, and this file's whole
reason for existing.** A test that only asserts the two columns EXIST cannot tell a no-backfill
migration from a backfilled one — both leave a table whose ``information_schema`` row looks
identical. The two client-facing states D-06 preserves are:

  * ``never ran``          — the step has no timestamps because it never started;
  * ``time not recorded``  — the step DID run, before this migration existed.

A backfill from ``updated_at`` is roughly right for a phase whose last transition was its terminal
one and silently WRONG for one that was retried, resumed, cancelled or had its output rewritten —
**and nothing on the row would say which**. So the absence of a backfill is a property that must be
asserted, not assumed. ``test_no_row_was_backfilled`` and ``test_both_columns_are_nullable_with_no
_default`` are that assertion; the nullability half is part of the same proof, because a
``not null`` column could not have been added at all without a backfill or a default.

A mock store cannot reproduce a real ``ALTER TABLE``'s effect on existing rows, so this is a
live-DB gate against the REAL local Postgres (``POSTGRES_DSN``, default ``:54322``), modelled on
``backend/tests/test_migration_119.py``.

**ALL DB writes occur INSIDE a transaction that ROLLS BACK** — the operator's local database is
the working environment and CLAUDE.md forbids ``supabase db push`` / ``db reset``. The FK chain
(``auth.users`` → ``threads`` → ``workflow_definitions`` → ``workflow_runs``) is seeded inside
that same rolled-back transaction.

**The ONLY two clean skips** are: ``:54322`` unreachable (no live DB to gate), and migration 121
unapplied. The applied-check reads ``information_schema.columns`` — ⚠ **never probes with an
INSERT**, which would both write to the operator's live dev database and conflate "the column is
absent" with "something else rejected the row".

⚠ **A GREEN SKIP IS NOT A PASSING FENCE, AND NOBODY MAY LATER READ IT AS ONE.** This project has
shipped five inert fences in Phase 193.2, four in 193.1, three in 192.1 and five in 190 — every
one caught by PLANTING, none by reading. **Authored in Task 1 of plan 200-02: this file is EXPECTED
to green-skip until Task 2's operator step applies the migration via the Supabase SQL editor.**
Until that happens the only thing this file has demonstrated is that it skips. **The RED→GREEN
observation is owed by Task 2, not by Task 1.**
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

# D-05: the two columns migration 121 adds. Named once, derived everywhere below, so the
# assertions and the skip-check cannot drift apart.
TIMING_COLUMNS = ("started_at", "completed_at")

# The table under test.
TABLE = "workflow_phases"


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


# SKIP 1 of 2 — no live DB to gate against.
PG_AVAILABLE = _check_pg_available_sync()
pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=(
        f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; there is no live DB to gate "
        "migration 121 against"
    ),
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


async def _timing_column_catalog(conn) -> dict[str, dict]:
    """Read ``information_schema.columns`` for the two timing columns → {name: row}.

    ⚠ **READ THE CATALOG, NEVER PROBE WITH AN INSERT.** The catalog is the definitive artefact
    and reading it cannot mutate anything. An INSERT probe would write to the operator's live dev
    database AND conflate "the column is absent" with "some other constraint or FK rejected the
    row" — two states with completely different remedies.
    """
    rows = await conn.fetch(
        "SELECT column_name, is_nullable, column_default, data_type "
        "FROM information_schema.columns "
        "WHERE table_schema = 'public' AND table_name = $1 AND column_name = ANY($2::text[])",
        TABLE,
        list(TIMING_COLUMNS),
    )
    return {r["column_name"]: dict(r) for r in rows}


async def _migration_121_applied(conn) -> bool:
    """True when migration 121 is applied — both columns physically exist on the table."""
    catalog = await _timing_column_catalog(conn)
    return all(name in catalog for name in TIMING_COLUMNS)


# SKIP 2 of 2 — the migration this file gates has not been applied yet.
_SKIP_UNAPPLIED = (
    "migration 121 NOT applied - public.workflow_phases does not yet carry "
    f"{' and '.join(TIMING_COLUMNS)}. This green-skip is EXPECTED UNTIL TASK 2 OF PLAN 200-02 "
    "APPLIES IT (operator pastes supabase/migrations/121_workflow_phases_timings.sql into the "
    "Supabase SQL editor, then runs bash scripts/regenerate-full-schema.sh with NO --reset; "
    "NEVER supabase db push / db reset, which wipe local dev data). Once applied, this file MUST "
    "PASS - and Task 2 also owes the RED-then-GREEN observation, which cannot be taken while "
    "this skip is firing."
)


async def _seed_phase_parents(conn):
    """Seed auth.users -> threads -> workflow_definitions -> workflow_runs inside the
    caller's ROLLED-BACK transaction, and return (workflow_run id, org_id).

    ``workflow_phases.workflow_run_id`` is the only FK on the table; ``org_id`` is NOT NULL
    but carries no FK (forward-compat column, D-PRD-02/D-11), so a synthetic uuid is correct
    here rather than a real organizations row.
    """
    uid = uuid.uuid4()
    org_id = uuid.uuid4()
    thread_id = uuid.uuid4()
    definition_id = uuid.uuid4()
    run_id = uuid.uuid4()

    await conn.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        uid, f"phase-200-{uid}@test.local",
    )
    await conn.execute(
        "INSERT INTO public.threads (id, user_id, title, org_id) VALUES ($1, $2, $3, $4)",
        thread_id, uid, "phase 200 migration-121 probe", org_id,
    )
    await conn.execute(
        "INSERT INTO public.workflow_definitions "
        "(id, slug, version, name, created_by, org_id, definition) "
        "VALUES ($1, $2, 1, $3, $4, $5, $6::jsonb)",
        definition_id, f"mig121-probe-{definition_id.hex[:8]}",
        "migration 121 probe", uid, org_id, json.dumps({"phases": []}),
    )
    await conn.execute(
        "INSERT INTO public.workflow_runs (id, thread_id, definition_id, org_id, user_id) "
        "VALUES ($1, $2, $3, $4, $5)",
        run_id, thread_id, definition_id, org_id, uid,
    )
    return run_id, org_id


async def _insert_phase(conn, run_id, org_id, status: str, *, phase_index: int = 0):
    """INSERT one workflow_phases row at the given status; returns its id.

    Deliberately names NEITHER timing column — this is the shape ``create_workflow_run``'s batch
    INSERT uses, and the point of the no-backfill control is what such a row looks like.
    """
    return await conn.fetchval(
        "INSERT INTO public.workflow_phases "
        "(workflow_run_id, phase_index, slug, status, org_id) "
        "VALUES ($1, $2, $3, $4, $5) RETURNING id",
        run_id, phase_index, f"probe-{phase_index}", status, org_id,
    )


@pytest.mark.asyncio
async def test_both_timing_columns_exist_as_timestamptz(pg_pool):
    """POSITIVE control — both columns exist on ``public.workflow_phases``, as timestamptz.

    The type is asserted rather than only the name: a ``timestamp`` (without time zone) column
    would silently drop the offset on every write from a differently-configured session, and a
    duration derived across two such rows would be wrong by whole hours with total confidence.
    """
    async with pg_pool.acquire() as conn:
        if not await _migration_121_applied(conn):
            pytest.skip(_SKIP_UNAPPLIED)

        catalog = await _timing_column_catalog(conn)
        for name in TIMING_COLUMNS:
            assert name in catalog, (
                f"public.{TABLE}.{name} is missing - migration 121 adds it (D-05)"
            )
            assert catalog[name]["data_type"] == "timestamp with time zone", (
                f"public.{TABLE}.{name} must be timestamptz, not "
                f"{catalog[name]['data_type']!r}: a naive timestamp drops the offset and a "
                "duration derived across two rows would be wrong by whole hours"
            )


@pytest.mark.asyncio
async def test_both_columns_are_nullable_with_no_default(pg_pool):
    """D-06, half 1 of 2 — nullability + the absent default ARE the no-backfill proof.

    This is not a shape check. A ``not null`` column could not have been added to a populated
    table at all without a backfill or a default, and a ``default now()`` backfills every existing
    row at ALTER time — **a backfill by accident is still a backfill**, and it would destroy
    D-06's "time not recorded" arm before it ever existed. So both properties are asserted
    directly on the catalog rather than inferred from the migration text.
    """
    async with pg_pool.acquire() as conn:
        if not await _migration_121_applied(conn):
            pytest.skip(_SKIP_UNAPPLIED)

        catalog = await _timing_column_catalog(conn)
        # One assertion per column per property — a collapsed ``assert all(...)``
        # short-circuits and would prove only the first.
        for name in TIMING_COLUMNS:
            assert catalog[name]["is_nullable"] == "YES", (
                f"public.{TABLE}.{name} must be NULLABLE (D-06). A non-nullable column would "
                "have required a backfill (or a default) to be addable, so its nullability is "
                "part of the proof that neither happened"
            )
            assert catalog[name]["column_default"] is None, (
                f"public.{TABLE}.{name} must carry NO column default (D-06). A default of "
                f"now() backfills every pre-existing row at ALTER time: "
                f"{catalog[name]['column_default']!r}"
            )


@pytest.mark.asyncio
async def test_no_row_was_backfilled(pg_pool):
    """D-06, half 2 of 2 — **THE NEGATIVE CONTROL**. No existing row carries either timestamp
    merely because the migration ran.

    Two independent arms, because either alone is weaker than it looks:

      (a) a freshly INSERTed row that names NEITHER column — the exact shape
          ``create_workflow_run``'s batch INSERT writes — must come back with BOTH NULL. That
          catches a default (and any trigger that decided to be helpful);
      (b) the REAL pre-existing rows on the operator's dev database, if there are any, must have
          ``started_at IS NULL`` on every row whose ``created_at`` predates this migration. That
          catches a one-shot ``UPDATE ... SET started_at = updated_at`` in the migration body,
          which arm (a) could not see at all.

    Arm (b) is skipped rather than failed when the table is empty — an empty table proves nothing
    either way, and pretending otherwise would be a fence that cannot fire.
    """
    async with pg_pool.acquire() as conn:
        if not await _migration_121_applied(conn):
            pytest.skip(_SKIP_UNAPPLIED)

        # ── arm (b) FIRST, and read-only: the real rows, before this test writes anything ──
        pre_existing = await conn.fetchrow(
            "SELECT count(*) AS total, "
            "       count(started_at) AS with_started, "
            "       count(completed_at) AS with_completed "
            f"FROM public.{TABLE}"
        )
        if pre_existing["total"]:
            assert pre_existing["with_started"] == 0, (
                f"{pre_existing['with_started']} of {pre_existing['total']} pre-existing "
                f"{TABLE} rows carry a started_at. Migration 121 performs NO backfill (D-06): "
                "a value derived from updated_at is roughly right for a phase whose last "
                "transition was its terminal one and silently WRONG for one that was retried, "
                "resumed, cancelled or had its output rewritten - and nothing on the row would "
                "say which. NULL says 'time not recorded' honestly"
            )
            assert pre_existing["with_completed"] == 0, (
                f"{pre_existing['with_completed']} of {pre_existing['total']} pre-existing "
                f"{TABLE} rows carry a completed_at - migration 121 backfills nothing (D-06)"
            )

        # ── arm (a): a new row that names neither column, inside a ROLLED-BACK transaction ──
        tx = conn.transaction()
        await tx.start()
        try:
            run_id, org_id = await _seed_phase_parents(conn)
            # 'completed' deliberately: the status most likely to tempt a "helpful" backfill.
            phase_id = await _insert_phase(conn, run_id, org_id, "completed")
            row = await conn.fetchrow(
                f"SELECT started_at, completed_at FROM public.{TABLE} WHERE id = $1", phase_id,
            )
            assert row["started_at"] is None, (
                "an INSERT that names no timing column must leave started_at NULL - a "
                "non-NULL value here means a column default or a trigger is writing it, which "
                "is a backfill by accident (D-06)"
            )
            assert row["completed_at"] is None, (
                "an INSERT that names no timing column must leave completed_at NULL, even at "
                "status='completed' - the timestamp is written by the terminal WRITER "
                "(complete_phase and its four siblings), never by the row's own status"
            )
        finally:
            await tx.rollback()  # NEVER mutate live dev data


@pytest.mark.asyncio
async def test_a_written_duration_is_derivable(pg_pool):
    """D-05's whole purpose, end to end: written timestamps yield a real per-step duration.

    Proves the property the phase exists for rather than only the schema that enables it — the
    two writes the engine performs (``mark_phase_active`` then ``complete_phase``) are simulated
    as UPDATEs and ``completed_at - started_at`` is asserted to be a positive interval. Without
    this, the two columns could both exist, be nullable and be un-backfilled while remaining
    useless.

    Runs inside a ROLLED-BACK transaction like every other write in this file.
    """
    async with pg_pool.acquire() as conn:
        if not await _migration_121_applied(conn):
            pytest.skip(_SKIP_UNAPPLIED)

        tx = conn.transaction()
        await tx.start()
        try:
            run_id, org_id = await _seed_phase_parents(conn)
            phase_id = await _insert_phase(conn, run_id, org_id, "pending")

            # site 1 — mark_phase_active
            await conn.execute(
                f"UPDATE public.{TABLE} SET status='active', updated_at=now(), "
                "started_at = now() WHERE id = $1",
                phase_id,
            )
            # ``now()`` is the TRANSACTION timestamp in Postgres and would make the two writes
            # identical; ``clock_timestamp()`` here only advances the simulated wall clock so
            # the derived interval is strictly positive. The real writers are separated by the
            # phase's actual work.
            await conn.execute(
                f"UPDATE public.{TABLE} SET status='completed', updated_at=now(), "
                "completed_at = clock_timestamp() + interval '1 second' WHERE id = $1",
                phase_id,
            )

            row = await conn.fetchrow(
                f"SELECT started_at, completed_at, completed_at - started_at AS duration "
                f"FROM public.{TABLE} WHERE id = $1",
                phase_id,
            )
            assert row["started_at"] is not None
            assert row["completed_at"] is not None
            assert row["duration"].total_seconds() > 0, (
                "completed_at - started_at must be a positive interval - this IS the per-step "
                "duration D-05 exists to make derivable, and it was genuinely underivable "
                "before migration 121 (created_at is the RUN's creation instant, identical "
                "across every phase of a run; updated_at is overwritten on every transition)"
            )
        finally:
            await tx.rollback()  # NEVER mutate live dev data

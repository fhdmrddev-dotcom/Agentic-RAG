"""Phase 189 (CONN-01) — LIVE-DB gate for migration 115's widened workflow_phases CHECK.

Covers validation row **V13**, and is decision **D-17** expressed as a test.

**D-08** amends the phase's zero-migration promise: ``workflow_phases_status_check`` caps
``status`` at exactly five values (``pending, active, completed, failed, skipped``), so the
honestly-worded not-sent state needs a sixth literal —
``supabase/migrations/115_workflow_phases_recorded_not_sent.sql`` adds exactly ONE and
changes nothing else. The precedent is Phase 185's migration 114, whose reasoning transfers
verbatim: an honest word is a correctness property, not a scoping convenience.

**D-17 — THE STORED VALUE AND THE RENDERED WORD ARE DIFFERENT THINGS.** The constraint takes
the lowercase snake_case SLUG ``recorded_not_sent``, in the shape of the five that already
exist. The sentence *"Not sent — recorded"* (D-16) is what the client's vocabulary layer
RENDERS for that slug; it lives a whole language away. Putting display prose inside a
database constraint would make the wording un-editable without a second migration, would put
an em-dash in a CHECK, and would break the shape of the column. **A plan that adds
``'Not sent — recorded'`` to ``workflow_phases_status_check`` has misread D-17** — the
negative control below is what catches that, and it is as load-bearing as the positive one.

A mock store cannot reproduce a CHECK firing, so this is a live-DB gate against the REAL
local Postgres (``POSTGRES_DSN``, default ``:54322``), modelled on
``backend/tests/test_139_migration_090.py``.

**ALL DB writes occur INSIDE a transaction that ROLLS BACK** — the operator's local database
is the working environment and CLAUDE.md forbids ``supabase db push`` / ``db reset``. The
rejection branch runs in a nested savepoint so its deliberate failure does not abort the
outer transaction. The FK chain (``auth.users`` → ``threads`` → ``workflow_definitions`` →
``workflow_runs``) is seeded inside that same rolled-back transaction.

**The ONLY two clean skips** are: ``:54322`` unreachable (no live DB to gate), and migration
115 unapplied. **Authored in Wave 0: this file is EXPECTED to green-skip until plan 189-06
Task 2 applies the migration via the Supabase SQL editor; once applied it MUST PASS.**
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

# D-17: the SLUG the CHECK admits. Lowercase snake_case, the shape of the five shipped ones.
NOT_SENT_SLUG = "recorded_not_sent"

# D-16 / D-17: the DISPLAY SENTENCE, em-dash included. It belongs to the client's vocabulary
# layer and must NEVER be a stored value. The negative control proves the CHECK refuses it.
NOT_SENT_DISPLAY_SENTENCE = "Not sent — recorded"

# The five statuses the column already admits. Migration 115 "adds exactly ONE literal and
# changes nothing else" — these must all still be accepted afterwards.
SHIPPED_STATUSES = ("pending", "active", "completed", "failed", "skipped")


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
    reason=(
        f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; there is no live DB to gate "
        "migration 115 against"
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


async def _migration_115_applied(conn) -> bool:
    """True when migration 115 is applied — the CHECK physically names the new slug.

    Read from ``pg_constraint`` rather than probed by an INSERT: the constraint definition is
    the definitive artefact, and reading it cannot mutate anything.
    """
    definition = await conn.fetchval(
        "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
        "WHERE conname = 'workflow_phases_status_check'"
    )
    return bool(definition) and NOT_SENT_SLUG in definition


_SKIP_UNAPPLIED = (
    f"migration 115 NOT applied - workflow_phases_status_check does not yet admit "
    f"'{NOT_SENT_SLUG}'. This green-skip is EXPECTED UNTIL PLAN 189-06 TASK 2 APPLIES IT "
    "(operator pastes supabase/migrations/115_workflow_phases_recorded_not_sent.sql into "
    "the Supabase SQL editor, then runs scripts/regenerate-full-schema.sh with no --reset; "
    "NEVER db push / db reset). Once applied, this file MUST PASS."
)


async def _seed_phase_parents(conn):
    """Seed auth.users -> threads -> workflow_definitions -> workflow_runs inside the
    caller's ROLLED-BACK transaction, and return the workflow_run id.

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
        uid, f"phase-189-{uid}@test.local",
    )
    await conn.execute(
        "INSERT INTO public.threads (id, user_id, title, org_id) VALUES ($1, $2, $3, $4)",
        thread_id, uid, "phase 189 migration-115 probe", org_id,
    )
    await conn.execute(
        "INSERT INTO public.workflow_definitions "
        "(id, slug, version, name, created_by, org_id, definition) "
        "VALUES ($1, $2, 1, $3, $4, $5, $6::jsonb)",
        definition_id, f"mig115-probe-{definition_id.hex[:8]}",
        "migration 115 probe", uid, org_id, json.dumps({"phases": []}),
    )
    await conn.execute(
        "INSERT INTO public.workflow_runs (id, thread_id, definition_id, org_id, user_id) "
        "VALUES ($1, $2, $3, $4, $5)",
        run_id, thread_id, definition_id, org_id, uid,
    )
    return run_id, org_id


async def _insert_phase(conn, run_id, org_id, status: str, *, phase_index: int = 0):
    """INSERT one workflow_phases row at the given status; returns its id."""
    return await conn.fetchval(
        "INSERT INTO public.workflow_phases "
        "(workflow_run_id, phase_index, slug, status, org_id) "
        "VALUES ($1, $2, $3, $4, $5) RETURNING id",
        run_id, phase_index, f"probe-{phase_index}", status, org_id,
    )


@pytest.mark.asyncio
async def test_recorded_not_sent_is_admitted(pg_pool):
    """V13a — the POSITIVE control: the D-17 SLUG is admitted by the widened CHECK.

    Both write paths are exercised, because the engine uses both: an INSERT at the new
    status, and an UPDATE of an existing row into it (which is what
    ``record_phase_not_sent`` will actually do after a phase records its intent).
    """
    async with pg_pool.acquire() as conn:
        if not await _migration_115_applied(conn):
            pytest.skip(_SKIP_UNAPPLIED)

        tx = conn.transaction()
        await tx.start()
        try:
            run_id, org_id = await _seed_phase_parents(conn)

            inserted = await _insert_phase(conn, run_id, org_id, NOT_SENT_SLUG)
            assert inserted is not None, (
                f"an INSERT at status={NOT_SENT_SLUG!r} must be admitted by "
                "workflow_phases_status_check after migration 115"
            )

            updated = await _insert_phase(conn, run_id, org_id, "active", phase_index=1)
            await conn.execute(
                "UPDATE public.workflow_phases SET status = $2 WHERE id = $1",
                updated, NOT_SENT_SLUG,
            )
            assert await conn.fetchval(
                "SELECT status FROM public.workflow_phases WHERE id = $1", updated,
            ) == NOT_SENT_SLUG, (
                "an active phase must be able to transition INTO recorded_not_sent - that "
                "is the write the executor performs once a human approves (D-05)"
            )
        finally:
            await tx.rollback()  # NEVER mutate live dev data


@pytest.mark.asyncio
async def test_the_display_sentence_is_rejected(pg_pool):
    """V13b — the NEGATIVE control, and D-17 stated as a test.

    The CHECK takes the lowercase snake_case SLUG. The display sentence "Not sent — recorded"
    (em-dash included) lives in the client's vocabulary layer, a whole language away, and
    must be REJECTED by Postgres with a check violation (SQLSTATE 23514) naming
    workflow_phases_status_check.

    Without this control, a migration that put the SENTENCE in the constraint would make the
    positive control above green for entirely the wrong reason - the column would then admit
    display prose, the wording could not be edited without a second migration, and the shape
    of the column would be broken.

    Runs in a nested savepoint so the deliberate failure does not abort the outer tx.
    """
    async with pg_pool.acquire() as conn:
        if not await _migration_115_applied(conn):
            pytest.skip(_SKIP_UNAPPLIED)

        tx = conn.transaction()
        await tx.start()
        try:
            run_id, org_id = await _seed_phase_parents(conn)

            inner = conn.transaction()
            await inner.start()
            with pytest.raises(asyncpg.PostgresError) as exc:
                await _insert_phase(conn, run_id, org_id, NOT_SENT_DISPLAY_SENTENCE)
            assert exc.value.sqlstate == "23514", (
                f"storing the display sentence {NOT_SENT_DISPLAY_SENTENCE!r} must raise the "
                f"workflow_phases_status_check CHECK (23514); got {exc.value.sqlstate}"
            )
            assert "workflow_phases_status_check" in str(
                getattr(exc.value, "constraint_name", "") or exc.value
            ), (
                "the rejection must come from workflow_phases_status_check, not from some "
                f"other constraint; asyncpg reported {exc.value!r}"
            )
            await inner.rollback()  # discard the aborted savepoint; keep the seeded outer tx
        finally:
            await tx.rollback()  # NEVER mutate live dev data


@pytest.mark.asyncio
async def test_the_five_shipped_statuses_are_all_still_admitted(pg_pool):
    """D-08 — "adds exactly ONE literal and changes nothing else", asserted rather than assumed.

    Migration 115 DROPs and re-ADDs the constraint. A re-typed ARRAY is exactly where a
    shipped literal gets silently dropped or misspelled, which would strand every existing
    row of that status the next time it was written. All five are re-inserted here, plus a
    still-refused nonsense value so the CHECK is proved to be enforcing at all rather than
    having been widened into a free-text column.
    """
    async with pg_pool.acquire() as conn:
        if not await _migration_115_applied(conn):
            pytest.skip(_SKIP_UNAPPLIED)

        tx = conn.transaction()
        await tx.start()
        try:
            run_id, org_id = await _seed_phase_parents(conn)

            for idx, status in enumerate(SHIPPED_STATUSES):
                row_id = await _insert_phase(conn, run_id, org_id, status, phase_index=idx)
                assert row_id is not None, (
                    f"the shipped status {status!r} must still be admitted after migration "
                    "115 re-adds the constraint"
                )

            inner = conn.transaction()
            await inner.start()
            with pytest.raises(asyncpg.PostgresError) as exc:
                await _insert_phase(
                    conn, run_id, org_id, "definitely_not_a_status", phase_index=99,
                )
            assert exc.value.sqlstate == "23514", (
                "the CHECK must still refuse an unknown status - a constraint that admits "
                "anything is not a closed vocabulary"
            )
            await inner.rollback()
        finally:
            await tx.rollback()  # NEVER mutate live dev data

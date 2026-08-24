"""Phase 194 (RUN-01) — LIVE-DB gate for migration 119's widened workflow_phases CHECK.

Covers validation rows **V-14** (positive, looped) and **V-15** (negative), and is decision
**D-17** — inherited verbatim from migration 115 — expressed as a test.

**D-04** adds the seventh literal. Measured: ``finish_run`` writes the ``workflow_runs`` row plus
the thread anchor and NOTHING else, so the in-flight ``workflow_phases`` row on a cancelled run
stays ``active`` forever; and ``workflow_phases_status_check`` admits exactly six values
(``pending, active, completed, failed, skipped, recorded_not_sent``) with no ``cancelled``.
Reusing ``failed`` or ``skipped`` was OFFERED AND REJECTED as dishonest: the phase did not fail
and it was not skipped — it ran and was interrupted.
``supabase/migrations/119_workflow_phases_cancelled.sql`` adds exactly ONE literal (6 → 7) and
changes nothing else.

**D-17 — THE STORED VALUE AND THE RENDERED WORD ARE DIFFERENT THINGS.** The constraint takes the
lowercase SLUG ``cancelled``, in the shape of the six that already exist. The sentence
*"Run cancelled — no deliverable produced"* is what the client's vocabulary layer RENDERS for
that slug; it lives a whole language away. Putting display prose inside a database constraint
would make the wording un-editable without a second migration, would put an em-dash in a CHECK,
and would break the shape of the column. **A plan that adds
``'Run cancelled — no deliverable produced'`` to ``workflow_phases_status_check`` has misread
D-17** — the negative control below is what catches that, and it is as load-bearing as the
positive one.

A mock store cannot reproduce a CHECK firing, so this is a live-DB gate against the REAL local
Postgres (``POSTGRES_DSN``, default ``:54322``), modelled on
``backend/tests/test_migration_115.py``.

**ALL DB writes occur INSIDE a transaction that ROLLS BACK** — the operator's local database is
the working environment and CLAUDE.md forbids ``supabase db push`` / ``db reset``. The rejection
branches run in a nested savepoint so a deliberate failure does not abort the outer transaction.
The FK chain (``auth.users`` → ``threads`` → ``workflow_definitions`` → ``workflow_runs``) is
seeded inside that same rolled-back transaction.

**The ONLY two clean skips** are: ``:54322`` unreachable (no live DB to gate), and migration 119
unapplied. **Authored in Wave 2 by plan 194-02: this file is EXPECTED to green-skip until plan
194-12 applies the migration via the Supabase SQL editor; once applied it MUST PASS.**

⚠ **A GREEN-SKIP IS NOT A PASSING FENCE, AND NOBODY MAY LATER READ IT AS ONE.** This project has
shipped five inert fences in Phase 193.2, four in 193.1, three in 192.1 and five in 190 — every
one caught by PLANTING, none by reading. The RED observations for RESEARCH's fences **F-7** (the
seven-literal positive control must red on the literal a plant deletes from the ``ARRAY[…]``) and
**F-8** (the display sentence must red with ``23514`` naming ``workflow_phases_status_check``)
are therefore **NOT owed by plan 194-02 and were NOT taken there** — they cannot be, because the
constraint is unapplied and every test below skips before reaching an assertion. **Plan 194-12
owes both**, driven against the live DB inside a rolled-back DDL transaction, with the RED
recorded. Until that happens, the only thing this file has demonstrated is that it skips.
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

# D-04 / D-17: the SLUG the widened CHECK admits. Lowercase, the shape of the six shipped ones.
CANCELLED_SLUG = "cancelled"

# D-17: the DISPLAY SENTENCE, em-dash included. It belongs to the client's vocabulary layer and
# must NEVER be a stored value. The negative control proves the CHECK refuses it.
CANCELLED_DISPLAY_SENTENCE = "Run cancelled — no deliverable produced"

# The six statuses the column already admits (migration 115 having added the sixth). Migration
# 119 "adds exactly ONE literal and changes nothing else" — these must all still be accepted
# afterwards. A re-typed ARRAY[…] is precisely where a shipped literal gets silently dropped,
# which would orphan every existing row using it.
SHIPPED_STATUSES = (
    "pending",
    "active",
    "completed",
    "failed",
    "skipped",
    "recorded_not_sent",
)

# The full post-119 vocabulary: seven. DERIVED from the six above rather than re-typed, so the
# two lists cannot drift apart.
ADMITTED_STATUSES = SHIPPED_STATUSES + (CANCELLED_SLUG,)


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
        "migration 119 against"
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


async def _migration_119_applied(conn) -> bool:
    """True when migration 119 is applied — the CHECK physically names the new slug.

    Read from ``pg_constraint`` rather than probed by an INSERT: the constraint definition is
    the definitive artefact, and reading it cannot mutate anything. An INSERT probe would both
    write to the operator's live dev database and conflate "the literal is absent" with "some
    other constraint or FK rejected the row".
    """
    definition = await conn.fetchval(
        "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
        "WHERE conname = 'workflow_phases_status_check'"
    )
    return bool(definition) and CANCELLED_SLUG in definition


# SKIP 2 of 2 — the migration this file gates has not been applied yet.
_SKIP_UNAPPLIED = (
    f"migration 119 NOT applied - workflow_phases_status_check does not yet admit "
    f"'{CANCELLED_SLUG}'. This green-skip is EXPECTED UNTIL PLAN 194-12 APPLIES IT "
    "(operator pastes supabase/migrations/119_workflow_phases_cancelled.sql into the Supabase "
    "SQL editor, then runs bash scripts/regenerate-full-schema.sh with NO --reset; NEVER "
    "supabase db push / db reset, which wipe local dev data). Once applied, this file MUST "
    "PASS - and plan 194-12 also owes the F-7 / F-8 RED observations, which cannot be taken "
    "while this skip is firing."
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
        uid, f"phase-194-{uid}@test.local",
    )
    await conn.execute(
        "INSERT INTO public.threads (id, user_id, title, org_id) VALUES ($1, $2, $3, $4)",
        thread_id, uid, "phase 194 migration-119 probe", org_id,
    )
    await conn.execute(
        "INSERT INTO public.workflow_definitions "
        "(id, slug, version, name, created_by, org_id, definition) "
        "VALUES ($1, $2, 1, $3, $4, $5, $6::jsonb)",
        definition_id, f"mig119-probe-{definition_id.hex[:8]}",
        "migration 119 probe", uid, org_id, json.dumps({"phases": []}),
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
async def test_cancelled_is_admitted(pg_pool):
    """V-14a — the POSITIVE control for the new literal: the D-04 SLUG is admitted.

    Both write paths are exercised, because the cancel path uses both shapes: an INSERT at the
    new status, and — the one that actually matters — an UPDATE of an ``active`` row into it,
    which is exactly what the cancel path's phase-terminalize writer does to the single
    in-flight phase (D-07).
    """
    async with pg_pool.acquire() as conn:
        if not await _migration_119_applied(conn):
            pytest.skip(_SKIP_UNAPPLIED)

        tx = conn.transaction()
        await tx.start()
        try:
            run_id, org_id = await _seed_phase_parents(conn)

            inserted = await _insert_phase(conn, run_id, org_id, CANCELLED_SLUG)
            assert inserted is not None, (
                f"an INSERT at status={CANCELLED_SLUG!r} must be admitted by "
                "workflow_phases_status_check after migration 119"
            )

            updated = await _insert_phase(conn, run_id, org_id, "active", phase_index=1)
            await conn.execute(
                "UPDATE public.workflow_phases SET status = $2 WHERE id = $1",
                updated, CANCELLED_SLUG,
            )
            assert await conn.fetchval(
                "SELECT status FROM public.workflow_phases WHERE id = $1", updated,
            ) == CANCELLED_SLUG, (
                "an active phase must be able to transition INTO cancelled - that is the write "
                "the cancel path performs on the single in-flight phase (D-07). Without it the "
                "row stays 'active' forever under a run marked 'cancelled', which is SC#3's "
                "failure mode"
            )
        finally:
            await tx.rollback()  # NEVER mutate live dev data


@pytest.mark.asyncio
async def test_the_display_sentence_is_rejected(pg_pool):
    """V-15 — the NEGATIVE control, and D-17 stated as a test (RESEARCH fence F-8).

    The CHECK takes the lowercase SLUG. The display sentence "Run cancelled — no deliverable
    produced" (em-dash included) lives in the client's vocabulary layer, a whole language away,
    and must be REJECTED by Postgres with a check violation naming this constraint.

    ⚠ **The SQLSTATE alone is not enough and both assertions are load-bearing.** ``23514`` is
    every CHECK on the table; the point of the second assertion is that the refusal came from
    ``workflow_phases_status_check`` SPECIFICALLY and not from some unrelated constraint that
    happens to fire on the same row.

    Without this control, a migration that put the SENTENCE in the constraint would make the
    positive control above green for entirely the wrong reason - the column would then admit
    display prose, the wording could not be edited without a second migration, and the shape of
    the column would be broken.

    Runs in a nested savepoint so the deliberate failure does not abort the outer tx.
    """
    async with pg_pool.acquire() as conn:
        if not await _migration_119_applied(conn):
            pytest.skip(_SKIP_UNAPPLIED)

        tx = conn.transaction()
        await tx.start()
        try:
            run_id, org_id = await _seed_phase_parents(conn)

            inner = conn.transaction()
            await inner.start()
            with pytest.raises(asyncpg.PostgresError) as exc:
                await _insert_phase(conn, run_id, org_id, CANCELLED_DISPLAY_SENTENCE)
            assert exc.value.sqlstate == "23514", (
                f"storing the display sentence {CANCELLED_DISPLAY_SENTENCE!r} must raise the "
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
async def test_all_seven_statuses_are_admitted_one_literal_at_a_time(pg_pool):
    """V-14b / RESEARCH fence **F-7** — "adds exactly ONE literal and changes nothing else",
    asserted per literal rather than assumed.

    Migration 119 DROPs and re-ADDs the constraint. A re-typed ARRAY is exactly where a shipped
    literal gets silently dropped or misspelled, which would strand every existing row of that
    status the next time it was written.

    ⚠ **THE LOOP IS LOAD-BEARING AND MUST NOT BE COLLAPSED.** A single ``assert`` over an
    ``all(...)`` of the seven would short-circuit and prove only the FIRST literal — the 193.2
    clause-by-clause lesson, where a pytest run proves only that the first clause fails because
    ``assert`` short-circuits. Each iteration asserts ONE literal and carries that literal in
    its failure message, so a dropped one is NAMED rather than merely counted.

    ⚠ **The two words above are deliberately NOT written adjacent, and that is not fussiness.**
    Plan 194-02's acceptance criterion is a RAW line grep over this file for the collapsed
    ``assert``-plus-``all(`` shape, expecting **0** matches. Prose QUOTING that shape — even to
    forbid it, and even inside the grep command itself — fires the check against the very file
    that obeys it. Both mistakes were made while authoring this docstring and are recorded
    rather than smoothed away; it is the same class of failure as 193.2-08, where a verbatim
    rule written WRAPPED failed its own literal ``grep -q`` and read as "already fixed".
    **A fence a machine reads literally must not be described literally inside its own
    subject.**

    All seven are inserted (the six shipped plus ``cancelled``), plus a still-refused nonsense
    value so the CHECK is proved to be enforcing at all rather than having been widened into a
    free-text column.
    """
    assert len(ADMITTED_STATUSES) == 7, (
        "migration 119 takes the vocabulary from six to seven; if this tuple is not seven "
        f"long the fence is measuring the wrong thing (got {ADMITTED_STATUSES!r})"
    )

    async with pg_pool.acquire() as conn:
        if not await _migration_119_applied(conn):
            pytest.skip(_SKIP_UNAPPLIED)

        tx = conn.transaction()
        await tx.start()
        try:
            run_id, org_id = await _seed_phase_parents(conn)

            for idx, status in enumerate(ADMITTED_STATUSES):
                row_id = await _insert_phase(conn, run_id, org_id, status, phase_index=idx)
                assert row_id is not None, (
                    f"the status {status!r} must be admitted after migration 119 re-adds the "
                    "constraint - it is one of the six shipped literals or the new 'cancelled'"
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

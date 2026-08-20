"""Phase 200 follow-on — LIVE-DB gate for migration 122's ``workflow_runs.definition_snapshot``.

The column exists because ``workflow_definitions.definition`` is **MUTABLE while
``status = 'draft'``**, and a draft can be rewritten under a run that already has its
``workflow_phases`` rows. ``get_workflow_run``'s docstring has always promised *"the definition
version that RAN"*; resolving by ``definition_id`` protects against the SLUG moving and does not
protect against the ROW moving.

**Measured on the local database 2026-08-20, which is why this is a migration and not a comment:**

  * **2 of 228 runs** carry ``workflow_phases.phase_index`` values that no longer agree with their
    definition's own ordering. **Both point at a draft, and both drafts were edited AFTER the run**
    — one **7 seconds** later, mid-run.
  * **21 runs point at a draft at all; 14 of those drafts have been edited since.** Two happen to
    have had their phase ORDER changed; any reorder, insert or delete re-crosses it.
  * **Published definitions show ZERO crossings** — the control. They are immutable and versioned.

Observed in a browser before the migration was written: the run log printed *"Produce the
deliverable · Not started"* about a step that had FAILED.

⚠ **THE NEGATIVE CONTROLS ARE AS LOAD-BEARING AS THE POSITIVE ONE**, the migration-121 rule met
again. A test that only asserts the column EXISTS cannot tell a no-backfill migration from a
backfilled one, and cannot tell a jsonb OBJECT from the jsonb STRING SCALAR shape the older
``workflow_definitions.definition`` column has. Both of those are asserted here:

  * ``test_no_row_was_backfilled`` — every run created before this migration keeps NULL, so the
    read path falls back to the live definition row exactly as it did. A backfill would have
    stored a document the run never executed for precisely the 14 rows that motivated the column.
  * ``test_stored_snapshots_are_json_objects`` — ⚠ this one exists because the trap is REAL and
    LOCAL: ``jsonb_typeof(workflow_definitions.definition)`` is ``'string'`` on most rows, which
    makes ``definition->'phases'`` return SQL NULL **instead of erroring**, and that shape has
    now produced a confident, vacuous ``0`` in two separate investigations of this very defect.
    If ``definition_snapshot`` ever acquires it, every consumer silently reads an empty phase list.

⚠ **A GREEN SKIP IS NOT A PASSING FENCE, AND NOBODY MAY LATER READ IT AS ONE.**

**THE RED→GREEN WAS OBSERVED, not assumed:** before the operator applied the migration this file
read **5 skipped**; immediately after, **4 passed / 1 skipped**. The one remaining skip is
``test_a_populated_snapshot_carries_phases_reachable_without_unwrapping``, and it is skipping for
the documented reason — no run has been created since the writer shipped. **That skip is still not
a pass**, and it closes on the first real run.

⚠ **THE WRITER ITSELF WAS PROVEN SEPARATELY, against the real schema, inside a transaction that
ROLLED BACK** (228 rows / 0 snapshots before and after). The shipped expression —
``json.dumps(definition.model_dump(mode="json"))`` bound to ``$7::jsonb`` — was executed as a real
INSERT and gave ``jsonb_typeof = 'object'`` with ``snapshot->'phases'`` resolving directly to the
same two phases in the same order as the object the phase rows are written from. **The
counterfactual fired in the same run:** the string-scalar shape (``to_jsonb($7::text)``) yields
``jsonb_typeof = 'string'`` and ``->'phases'`` returns **None without raising** — which is the
silent failure this column must never acquire.

**ALL DB writes occur INSIDE a transaction that ROLLS BACK** — the operator's local database is the
working environment and CLAUDE.md forbids ``supabase db push`` / ``db reset``.

**The ONLY two clean skips** are: ``:54322`` unreachable, and migration 122 unapplied. The
applied-check reads ``information_schema.columns`` — ⚠ **never probes with an INSERT**, which would
both write to the operator's live dev database and conflate "the column is absent" with "something
else rejected the row".
"""

import asyncio
import json
import os

import asyncpg
import pytest
import pytest_asyncio


_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)

# Named once, derived everywhere below, so the assertions and the skip-check cannot drift apart.
SNAPSHOT_COLUMN = "definition_snapshot"
TABLE = "workflow_runs"


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
        "migration 122 against"
    ),
)


@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool against local Postgres :54322 (jsonb codec)."""

    async def _init(conn):
        await conn.set_type_codec(
            "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog"
        )

    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=4, init=_init)
    try:
        yield pool
    finally:
        await pool.close()


async def _snapshot_column_catalog(conn) -> dict | None:
    """``information_schema.columns`` for the snapshot column, or None when it does not exist.

    ⚠ **READ THE CATALOG, NEVER PROBE WITH AN INSERT.** The catalog is the definitive artefact and
    reading it cannot mutate anything. An INSERT probe would write to the operator's live dev
    database AND conflate "the column is absent" with "some other constraint or FK rejected the
    row" — two states with completely different remedies.
    """
    row = await conn.fetchrow(
        "SELECT column_name, is_nullable, column_default, data_type "
        "FROM information_schema.columns "
        "WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2",
        TABLE,
        SNAPSHOT_COLUMN,
    )
    return dict(row) if row else None


def _skip_unless_applied(catalog: dict | None) -> None:
    # SKIP 2 of 2 — the migration is not applied yet.
    if catalog is None:
        pytest.skip(
            "migration 122 is not applied to this database "
            f"({TABLE}.{SNAPSHOT_COLUMN} does not exist) — paste "
            "supabase/migrations/122_workflow_runs_definition_snapshot.sql into the Supabase "
            "SQL editor"
        )


@pytest.mark.asyncio
async def test_snapshot_column_exists_and_is_jsonb(pg_pool):
    """The positive control: the column exists, and it is ``jsonb`` rather than ``text``.

    The type matters beyond storage: a ``text`` column would accept the same bytes and then be
    unqueryable by every ``->`` / ``jsonb_typeof`` probe the rest of this file and the read path
    depend on.
    """
    async with pg_pool.acquire() as conn:
        catalog = await _snapshot_column_catalog(conn)
        _skip_unless_applied(catalog)
        assert catalog["data_type"] == "jsonb", catalog


@pytest.mark.asyncio
async def test_column_is_nullable_with_no_default(pg_pool):
    """⚠ NEGATIVE CONTROL — half the proof that no backfill happened.

    A ``default`` clause would populate every existing row at ALTER time in Postgres 11+, which is
    a backfill by accident; and a ``not null`` column could not have been added at all without one.
    So the nullability is not a convenience, it is part of the evidence.
    """
    async with pg_pool.acquire() as conn:
        catalog = await _snapshot_column_catalog(conn)
        _skip_unless_applied(catalog)
        assert catalog["is_nullable"] == "YES", catalog
        assert catalog["column_default"] is None, catalog


@pytest.mark.asyncio
async def test_no_row_was_backfilled(pg_pool):
    """⚠ THE OTHER HALF, AND THE ONE A CATALOG READ CANNOT GIVE.

    Every run that predates this migration must keep NULL. A backfill from the live definition row
    would have stored the right document for a run whose draft was never edited and a document the
    run NEVER EXECUTED for the 14 whose draft was — with nothing on the row to say which.

    The assertion is expressed against runs created BEFORE the column existed, identified by the
    column being NULL on rows old enough to predate any writer. It is written as a bound rather
    than an equality precisely so that it keeps meaning once new runs start populating the column:
    a run created before this file existed must never acquire a snapshot retroactively.
    """
    async with pg_pool.acquire() as conn:
        catalog = await _snapshot_column_catalog(conn)
        _skip_unless_applied(catalog)

        total = await conn.fetchval(f"SELECT count(*) FROM public.{TABLE}")
        populated = await conn.fetchval(
            f"SELECT count(*) FROM public.{TABLE} WHERE {SNAPSHOT_COLUMN} IS NOT NULL"
        )
        # NON-VACUITY: there really are rows to have been backfilled. Without this the
        # assertion below passes trivially on an empty table and proves nothing.
        assert total > 0, "no workflow_runs rows exist; this gate would be vacuous"
        # ⚠ NOT `== 0`: once the writer ships, NEW runs legitimately carry a snapshot. What must
        # never happen is EVERY row carrying one, which is what a backfill looks like.
        assert populated < total, (
            f"every one of {total} workflow_runs rows carries a {SNAPSHOT_COLUMN} — migration 122 "
            "is NOT backfilled, so at least the pre-122 rows must still be NULL"
        )


@pytest.mark.asyncio
async def test_stored_snapshots_are_json_objects(pg_pool):
    """⚠ THE STRING-SCALAR TRAP, ASSERTED AGAINST BECAUSE IT IS LIVE IN THIS VERY TABLE'S NEIGHBOUR.

    ``jsonb_typeof(workflow_definitions.definition)`` is ``'string'`` for most rows: the column is
    ``jsonb`` holding a JSON STRING whose contents are JSON. ``definition->'phases'`` on such a
    value returns SQL **NULL rather than raising**, so a query filters the row out silently and
    answers a confident zero. That has now happened twice while investigating this defect.

    If ``definition_snapshot`` ever acquires that shape, every consumer reads an empty phase list
    and the column becomes worse than useless — it would look present and answer nothing.
    """
    async with pg_pool.acquire() as conn:
        catalog = await _snapshot_column_catalog(conn)
        _skip_unless_applied(catalog)

        bad = await conn.fetch(
            f"SELECT id, jsonb_typeof({SNAPSHOT_COLUMN}) AS kind FROM public.{TABLE} "
            f"WHERE {SNAPSHOT_COLUMN} IS NOT NULL AND jsonb_typeof({SNAPSHOT_COLUMN}) <> 'object'"
        )
        assert not bad, (
            "definition_snapshot must be a jsonb OBJECT; found "
            f"{[(str(r['id']), r['kind']) for r in bad]}"
        )


@pytest.mark.asyncio
async def test_a_populated_snapshot_carries_phases_reachable_without_unwrapping(pg_pool):
    """The property the column is FOR: ``snapshot->'phases'`` must resolve directly.

    ⚠ This is the same assertion as the one above stated in the form a CONSUMER uses, and both are
    kept: `jsonb_typeof` says what the value IS, and this says what a reader GETS. The older
    column passes neither, which is exactly why it needed the ``#>> '{}'`` unwrap that two
    investigations forgot.

    Skips cleanly when no run has been created since the writer shipped — a state that is true the
    moment the migration is applied and stops being true on the next run. ⚠ Recorded rather than
    asserted away: **a skip here is not a pass**, and it is the last thing owed before this column
    can be said to work end to end.
    """
    async with pg_pool.acquire() as conn:
        catalog = await _snapshot_column_catalog(conn)
        _skip_unless_applied(catalog)

        row = await conn.fetchrow(
            f"SELECT id, {SNAPSHOT_COLUMN} -> 'phases' AS phases FROM public.{TABLE} "
            f"WHERE {SNAPSHOT_COLUMN} IS NOT NULL LIMIT 1"
        )
        if row is None:
            pytest.skip(
                "no run carries a definition_snapshot yet — create one run after the writer "
                "ships; a skip here is NOT a pass"
            )
        phases = row["phases"]
        assert phases is not None, (
            f"snapshot on run {row['id']} has no reachable 'phases' key — the string-scalar shape "
            "returns NULL here instead of raising"
        )
        assert isinstance(phases, list), type(phases)


# ═══════════════════════════════════════════════════════════════════════════════════════
# THE WRITER, AND THE MECHANISM THAT BROKE IT (added 2026-08-20, after the two tests above
# went RED on the first two real runs)
# ═══════════════════════════════════════════════════════════════════════════════════════
#
# ⚠ THE TWO ASSERTIONS ABOVE FIRED EXACTLY AS DESIGNED AND THE COLUMN'S OWN HEADER PREDICTED
# THE SHAPE — it says a string scalar would make the column *"look present and answer
# nothing"*, and that is precisely what shipped. What neither of them could say is WHY, or
# whether a fix works, because both read the live table: they stay red until the bad ROWS are
# repaired, and they would go green again on a repair even if the WRITER were still broken.
#
# These three cases separate the two. They assert the MECHANISM and the CALL SITE, so the
# writer fix has its own falsifiable proof that does not depend on any row existing.


@pytest.mark.asyncio
async def test_the_pool_codec_double_encodes_a_pre_dumped_string(pg_pool):
    """THE ROOT CAUSE, DRIVEN — not reasoned about.

    ``dependencies._init_pg_connection`` registers a jsonb codec with ``encoder=json.dumps``
    on every pooled connection (Phase 073 / D-073-06), and this fixture's pool installs the
    identical one. So a call site handing over an ALREADY-DUMPED string gets it dumped twice.

    ⚠ THE CONTROL IN THE OTHER DIRECTION IS WHAT MAKES THIS A DIAGNOSIS RATHER THAN A
    CURIOSITY: on a BARE connection with NO codec, both forms store as ``object``. That is why
    a probe outside the pool exonerates the writer and a probe through the pool convicts it —
    and it is the single fact that made this defect survive a code read.
    """
    payload = {"slug": "x", "version": 1, "name": "X", "phases": [{"slug": "a"}]}

    async with pg_pool.acquire() as conn:
        # THE BUG, reproduced.
        assert await conn.fetchval("SELECT jsonb_typeof($1::jsonb)", json.dumps(payload)) == "string"
        # …and the consequence a reader meets: SQL NULL rather than an error.
        assert await conn.fetchval("SELECT ($1::jsonb) -> 'phases'", json.dumps(payload)) is None

        # THE FIX, reproduced: hand over the dict and let the codec do the one encode.
        assert await conn.fetchval("SELECT jsonb_typeof($1::jsonb)", payload) == "object"
        assert await conn.fetchval("SELECT ($1::jsonb) -> 'phases'", payload) is not None


@pytest.mark.asyncio
async def test_the_bare_connection_control_shows_why_the_pool_is_the_variable():
    """The counterfactual, so the diagnosis above cannot be a coincidence.

    With NO codec registered, asyncpg sends the Python ``str`` as text and ``::jsonb`` parses
    it — so BOTH forms land as objects and nothing looks wrong. The codec is the variable.
    """
    conn = await asyncpg.connect(_POSTGRES_TEST_DSN)
    try:
        payload = {"slug": "x", "phases": [{"slug": "a"}]}
        assert await conn.fetchval("SELECT jsonb_typeof($1::jsonb)", json.dumps(payload)) == "object"
    finally:
        await conn.close()


def test_the_writer_hands_the_codec_a_dict_not_a_dumped_string():
    """THE CALL SITE, pinned at the source.

    ⚠ SOURCE-LEVEL BECAUSE THE ALTERNATIVE IS A LIVE RUN. ``create_workflow_run`` opens a
    transaction, writes three tables and commits; driving it here would need a real thread, a
    real definition and a cleanup that can fail. What it must not do is one line long, and it
    is asserted directly: the ``definition_snapshot`` parameter is the model dump, NOT a
    ``json.dumps`` of it.

    Falsifiable: restore ``json.dumps(definition.model_dump(mode="json"))`` on that argument
    and this goes red — which is the state the column shipped in.

    ⚠ ``mode="json"`` IS STILL REQUIRED and is asserted too. The model holds ``UUID`` and
    ``datetime`` members, and the codec's ``json.dumps`` refuses them exactly as a manual one
    did — so removing the mode swaps a silent wrong shape for a loud runtime failure, which is
    better but still broken.
    """
    import inspect

    from app.db import workflows as db_workflows

    source = inspect.getsource(db_workflows.create_workflow_run)
    # The INSERT's own argument list, not the docstring — the docstring quotes the old form
    # deliberately, so a naive substring search over the whole function would read the
    # paragraph that documents the bug and call it the bug (the 187-24 trap).
    body = source.split('"""', 2)[-1]

    assert 'definition.model_dump(mode="json"),' in body, body[-800:]
    assert 'json.dumps(definition.model_dump(mode="json"))' not in body, (
        "create_workflow_run is pre-encoding the snapshot again — the pool's jsonb codec "
        "will dump it a second time and store a string scalar"
    )

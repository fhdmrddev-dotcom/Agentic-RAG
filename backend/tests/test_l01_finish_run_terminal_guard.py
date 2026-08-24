"""L-01 / RUN-01 — LIVE-DB gate: a terminal ``workflow_runs.status`` is FINAL.

**The defect this pins.** At the shipped ``WORKER_COUNT=2``, a Stop landing on worker A writes
``cancelled`` while worker B's still-running producer reaches its success arm and writes
``completed`` OVER IT — measured on roughly HALF of all stops. The user pressed Stop and the run
reported that it finished. Recorded as Phase 194 **SC#2, FAILED**; re-confirmed by the operator at
Phase 194.1's UAT, where the newly-visible Stop made the lie *more* visible rather than causing it.

**Why a guard rather than a lock.** ``finish_run``'s own docstring already stated the protection in
prose — *"the interleave is BENIGN BY VALUE-IDENTITY, NOT BY EXCLUSION … THE ONE THING A CALLER MUST
NEVER DO IS MAKE THE TWO WRITES DISAGREE"* — and shipped code broke it. **Prose cannot bind a
producer running in another process.** The fix narrows the WHERE of a status write the function
already owns: the first terminal write wins, a later DIFFERENT terminal value is refused, and the
same value may still land twice (both cancel sites can, and do).

⚠ **WHAT THIS FILE DOES NOT CLAIM, stated first so no reader mistakes its scope.** The far-worker
producer KEEPS RUNNING. This makes the run *report* honestly; it does not make the work *stop*.
Halting the producer — an in-loop status re-read, or a cancel channel that reaches a producer not
parked on an ``ask_user:*`` channel — is the separate, larger L-01 fix and is **still OWED**. A test
named "terminal guard" passing must never be read as "Stop halts the work".

⚠ **IT CALLS THE SHIPPED ``finish_run``, NOT A COPY OF ITS SQL.** A test that re-types the UPDATE
proves only that the *test author's* statement is correct — precisely the inert-fence class this
project has shipped repeatedly (five in 193.2, four in 193.1, three in 192.1, five in 190). The
negative control below drives the pre-fix statement against the identical sequence and shows it
producing the bug, so a reader can see the two apart.

**DB hygiene.** Each test INSERTs one ``workflow_runs`` row with a fresh UUID, reusing an existing
row's FK parents, and DELETEs it in ``finally``. Nothing else is written; no existing row is
touched. CLAUDE.md forbids ``supabase db push`` / ``db reset`` — the operator's local DB is the
working environment.

**The only clean skips** are: ``:54322`` unreachable, or ``workflow_runs`` empty (no FK parents to
borrow). A green-skip is NOT a passing fence.
"""

from __future__ import annotations

import asyncio
import os
import uuid

import asyncpg
import pytest
import pytest_asyncio

from app.db.workflows import finish_run

_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)

# The three values `workflow_runs_status_check` admits that END a run
# (063_dual_mode_continue.sql:57 — the full set is
# active | paused | cap_paused | completed | failed | cancelled).
TERMINAL = ("completed", "failed", "cancelled")
# The three that do NOT end it. `finish_run` exists to move a run OUT of these,
# so the guard must never block a write whose current status is one of them.
NON_TERMINAL = ("active", "paused", "cap_paused")

# The PRE-FIX statement, kept verbatim as the negative control. It is the only
# re-typed SQL in this file and it exists to FAIL.
_NAIVE_PRE_FIX = "UPDATE workflow_runs SET status = $2 WHERE id = $1"


async def _pg_reachable(dsn: str = _POSTGRES_TEST_DSN) -> bool:
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn), timeout=2.0)
        await conn.close()
        return True
    except Exception:
        return False


def _check_pg_available_sync() -> bool:
    try:
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(_pg_reachable())
        finally:
            loop.close()
    except Exception:
        return False


PG_AVAILABLE = _check_pg_available_sync()
pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; no live DB to gate L-01 against",
)


@pytest_asyncio.fixture
async def pg_pool():
    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=4)
    try:
        yield pool
    finally:
        await pool.close()


@pytest_asyncio.fixture
async def run_id(pg_pool):
    """One disposable ``workflow_runs`` row, borrowing an existing row's FK parents."""
    parent = await pg_pool.fetchrow(
        "SELECT thread_id, definition_id, user_id, org_id FROM workflow_runs LIMIT 1"
    )
    if parent is None:
        pytest.skip("workflow_runs is empty — no FK parents to borrow for a disposable row")
    rid = uuid.uuid4()
    await pg_pool.execute(
        "INSERT INTO workflow_runs (id, thread_id, definition_id, user_id, org_id, status) "
        "VALUES ($1, $2, $3, $4, $5, 'active')",
        rid, parent["thread_id"], parent["definition_id"], parent["user_id"], parent["org_id"],
    )
    try:
        yield rid
    finally:
        await pg_pool.execute("DELETE FROM workflow_runs WHERE id = $1", rid)


async def _status(pool, rid) -> str:
    return await pool.fetchval("SELECT status FROM workflow_runs WHERE id = $1", rid)


@pytest.mark.asyncio
async def test_a_stop_survives_the_far_worker_producers_completed_write(pg_pool, run_id):
    """THE L-01 SEQUENCE, through the shipped function. This is the whole point of the file."""
    await finish_run(pg_pool, run_id, "cancelled")
    assert await _status(pg_pool, run_id) == "cancelled"

    # Worker B's producer, which never learned the run was cancelled, finishes its work.
    await finish_run(pg_pool, run_id, "completed")

    assert await _status(pg_pool, run_id) == "cancelled", (
        "the producer's 'completed' overwrote the user's Stop — L-01, the exact defect"
    )


@pytest.mark.asyncio
async def test_the_naive_pre_fix_statement_reproduces_the_bug(pg_pool, run_id):
    """NEGATIVE CONTROL. Without it, the test above cannot be distinguished from a test that
    would pass against any implementation at all."""
    await pg_pool.execute(_NAIVE_PRE_FIX, run_id, "cancelled")
    await pg_pool.execute(_NAIVE_PRE_FIX, run_id, "completed")

    assert await _status(pg_pool, run_id) == "completed", (
        "the pre-fix statement no longer reproduces L-01 — if this fails, the control is stale "
        "and the test above is no longer known to be discriminating"
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("first", TERMINAL)
@pytest.mark.parametrize("second", TERMINAL)
async def test_the_first_terminal_write_wins_for_every_pair(pg_pool, run_id, first, second):
    """All nine ordered pairs, so no single arm carries the property alone.

    ⚠ The equal pairs are NOT filler — they pin the idempotency the docstring promises, and
    both cancel sites really can land twice on one run.
    """
    await pg_pool.execute("UPDATE workflow_runs SET status = 'active' WHERE id = $1", run_id)
    await finish_run(pg_pool, run_id, first)
    await finish_run(pg_pool, run_id, second)
    assert await _status(pg_pool, run_id) == first


@pytest.mark.asyncio
@pytest.mark.parametrize("start", NON_TERMINAL)
async def test_a_non_terminal_run_is_still_terminalized(pg_pool, run_id, start):
    """The guard must not break what the function is FOR. A regression here would strand every
    run as un-finishable, which is a far worse failure than the one being fixed."""
    await pg_pool.execute("UPDATE workflow_runs SET status = $2 WHERE id = $1", run_id, start)
    await finish_run(pg_pool, run_id, "completed")
    assert await _status(pg_pool, run_id) == "completed"


@pytest.mark.asyncio
async def test_the_thread_anchor_clear_is_unconditional(pg_pool, run_id):
    """⚠ The anchor clear must fire even when the status write is REFUSED.

    The two statements share one transaction so a terminal run can never strand a thread as
    locked (092-03 / SC#2). Coupling the clear to the status write's row count would reintroduce
    exactly that dangling-lock failure — a second, refused terminalize skipping the clear.
    """
    thread_id = await pg_pool.fetchval(
        "SELECT thread_id FROM workflow_runs WHERE id = $1", run_id
    )
    prior_anchor = await pg_pool.fetchval(
        "SELECT active_workflow_run_id FROM threads WHERE id = $1", thread_id
    )
    try:
        await finish_run(pg_pool, run_id, "cancelled")

        # Re-point the anchor at this run, then drive a REFUSED terminalize.
        await pg_pool.execute(
            "UPDATE threads SET active_workflow_run_id = $2 WHERE id = $1", thread_id, run_id
        )
        await finish_run(pg_pool, run_id, "completed")

        assert await _status(pg_pool, run_id) == "cancelled", "the status guard should have held"
        assert (
            await pg_pool.fetchval(
                "SELECT active_workflow_run_id FROM threads WHERE id = $1", thread_id
            )
            is None
        ), "a refused status write skipped the anchor clear — the thread is stranded as locked"
    finally:
        await pg_pool.execute(
            "UPDATE threads SET active_workflow_run_id = $2 WHERE id = $1",
            thread_id, prior_anchor,
        )

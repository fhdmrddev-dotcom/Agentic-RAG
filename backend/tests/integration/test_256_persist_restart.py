"""Phase 256 / METER-03 (SC#1) — the totals survive a REAL process boundary.

WHAT THIS PROVES, stated exactly and not one word wider: **a value written by
process A through ``db.workflows.persist_run_usage`` and committed is read back
by process B — a separate Python interpreter that opens its OWN real asyncpg
pool against the same database — as the SUM of the deltas A added, together with
the coverage array A wrote.**

WHAT THIS DOES **NOT** PROVE: that a total survives a ``kill -9``, an OOM kill or
a power loss at an arbitrary instruction mid-phase, and that a worker whose
in-flight transaction was never committed loses nothing. Process B here starts
cleanly after process A finished its writes; nothing in this file interrupts a
write in progress. SC#1's literal words are *"re-reading the run after the
process restarts returns the same totals the in-memory ceiling saw"*, and the
gap between that sentence and the property above is a crash, not a restart. It
is named here rather than glossed, because a silent overstatement would be SC#1
claimed and not proven — the exact failure mode this phase exists to end.

⚠ THIS FILE IS INVISIBLE TO THE UNIT GATE. ``backend/tests/integration/`` is
OUTSIDE ``pytest tests/unit``, whose failing set is locked at 71 names with zero
headroom — so nothing here can be this phase's only proof of anything. The
unit-level proofs are ``tests/unit/test_256_enforce_budget_persist.py`` (the
disarmed-breaker drive through the real engine) and
``tests/unit/test_256_persist_run_usage.py`` (the statement-level assertions).
This file is the end-to-end one and nothing more.

⭐ NO IN-REPO ANALOG (``256-PATTERNS.md`` gap G-a). It combines two shapes that
had never met: the ``subprocess.Popen([sys.executable, "-c", ...])`` reporting
over a JSON line on stdout from
``tests/unit/test_239_settings_cross_worker_invalidation.py``, and the live
``workflow_runs`` asyncpg pool from
``tests/integration/test_093_ask_user_workflow_run_live.py``. ⛔ The 239 file
discloses in its own docstring that *"the child read the real Postgres row (its
pool is a stub)"* is exactly what it does not prove; copying that stub would
have produced a test that proves a process boundary was crossed while proving
nothing about the database, which is the weaker half of both analogs.

⛔ EVERY TOKEN WRITE GOES THROUGH ``persist_run_usage``. Raw SQL appears only to
seed and tear down the FK chain, and it never touches a token column — otherwise
this would prove that Postgres works rather than that the writer works.

Skips cleanly, with the reason printed, when :54322 is unreachable.
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import textwrap
import time
import uuid
from pathlib import Path

import asyncpg
import pytest
import pytest_asyncio

from app.db.workflows import TOKEN_COVERAGE_LEGS, persist_run_usage


BACKEND_DIR = Path(__file__).resolve().parents[2]

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
    reason=(
        f"local DB unreachable — {_POSTGRES_TEST_DSN} did not accept a connection; "
        "skipping the cross-process durability round-trip"
    ),
)


# ---------------------------------------------------------------------------
# The CHILD — a separate interpreter with its OWN real pool. No stub anywhere.
# argv carries the run id and the DSN so this source needs no .format() and
# therefore no brace doubling.
# ---------------------------------------------------------------------------

_CHILD = """
import asyncio, json, os, sys
import asyncpg

RUN_ID = sys.argv[1]
DSN = sys.argv[2]

async def main():
    # ⛔ A REAL pool, created by THIS process. That is the whole point of the file.
    pool = await asyncpg.create_pool(DSN, min_size=1, max_size=2)
    try:
        row = await pool.fetchrow(
            "SELECT input_tokens, output_tokens, token_coverage "
            "FROM public.workflow_runs WHERE id = $1",
            __import__("uuid").UUID(RUN_ID),
        )
        payload = {
            "pid": os.getpid(),
            "found": row is not None,
            "input_tokens": None if row is None else row["input_tokens"],
            "output_tokens": None if row is None else row["output_tokens"],
            "token_coverage": None if row is None else list(row["token_coverage"] or []),
            "coverage_is_null": None if row is None else (row["token_coverage"] is None),
        }
    finally:
        await pool.close()
    print(json.dumps(payload), flush=True)

asyncio.run(main())
"""


def _read_in_a_child_process(run_id: uuid.UUID) -> dict:
    """Spawn a separate interpreter, have it read the row, return its JSON line."""
    env = dict(os.environ)
    env["PYTHONUNBUFFERED"] = "1"
    proc = subprocess.Popen(
        [sys.executable, "-c", textwrap.dedent(_CHILD), str(run_id), _POSTGRES_TEST_DSN],
        cwd=str(BACKEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env,
    )
    try:
        out, err = proc.communicate(timeout=60)
    except subprocess.TimeoutExpired:
        proc.kill()
        out, err = proc.communicate()
        pytest.fail(f"child interpreter timed out; stderr:\n{err}")

    assert proc.returncode == 0, (
        f"child interpreter exited {proc.returncode}; stderr:\n{err}"
    )
    for line in out.splitlines():
        line = line.strip()
        if line.startswith("{"):
            return json.loads(line)
    pytest.fail(f"child produced no JSON line.\nstdout:\n{out}\nstderr:\n{err}")


# ---------------------------------------------------------------------------
# A committed FK chain. ⛔ The seed writes NO token column.
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def seeded_run():
    """Yield a committed ``workflow_runs`` id; delete the whole chain afterwards.

    Setup and teardown use their OWN short-lived connections, so a test is free
    to open process A's pool, use it and CLOSE it — which the round-trip below
    must do, since "A is finished with the database" is half the property.
    """
    uid, tid, did, org = (uuid.uuid4() for _ in range(4))
    run_id = uuid.uuid4()

    conn = await asyncpg.connect(_POSTGRES_TEST_DSN)
    try:
        await conn.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            uid, f"phase-256-restart-{uid}@test.local",
        )
        await conn.execute(
            "INSERT INTO public.threads (id, user_id, org_id, title) "
            "VALUES ($1, $2, $3, $4)",
            tid, uid, org, "phase-256-restart-probe",
        )
        await conn.execute(
            "INSERT INTO public.workflow_definitions "
            "(id, slug, name, created_by, org_id) VALUES ($1, $2, $3, $4, $5)",
            did, f"phase-256-restart-{did}", "phase-256-restart", uid, org,
        )
        # ⛔ No token column is written here. The only writer of those is
        #    persist_run_usage, or this file would prove Postgres works.
        await conn.execute(
            "INSERT INTO public.workflow_runs (id, thread_id, definition_id, org_id) "
            "VALUES ($1, $2, $3, $4)",
            run_id, tid, did, org,
        )
    finally:
        await conn.close()

    try:
        yield run_id
    finally:
        cleanup = await asyncpg.connect(_POSTGRES_TEST_DSN)
        try:
            await cleanup.execute(
                "DELETE FROM public.workflow_runs WHERE id = $1", run_id
            )
            await cleanup.execute(
                "DELETE FROM public.workflow_definitions WHERE id = $1", did
            )
            await cleanup.execute("DELETE FROM public.threads WHERE id = $1", tid)
            await cleanup.execute("DELETE FROM auth.users WHERE id = $1", uid)
        finally:
            await cleanup.close()


# ===========================================================================
# THE ROUND TRIP
# ===========================================================================

@pytest.mark.asyncio
async def test_a_second_process_reads_back_the_accumulated_totals(seeded_run):
    """⭐ SC#1, as far as it can honestly be taken: A writes, A closes, B reads."""
    run_id = seeded_run

    # ── process A: its own pool, two phase boundaries' worth of spend ────────
    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=2)
    try:
        # A fresh run has never been measured — NULL, not 0 (D-256-06).
        before = await pool.fetchrow(
            "SELECT input_tokens, output_tokens, token_coverage "
            "FROM public.workflow_runs WHERE id = $1",
            run_id,
        )
        assert before["input_tokens"] is None
        assert before["output_tokens"] is None
        assert before["token_coverage"] is None

        await persist_run_usage(pool, run_id, input_delta=120, output_delta=30)
        await persist_run_usage(pool, run_id, input_delta=80, output_delta=20)
    finally:
        # Process A is done with the database.
        await pool.close()

    child = _read_in_a_child_process(run_id)

    assert child["found"], "the child could not see the row at all"
    assert child["pid"] != os.getpid(), (
        "the read happened in THIS process — the boundary was never crossed"
    )
    assert child["input_tokens"] == 200, (
        f"the child read {child['input_tokens']!r}; the two deltas must have been "
        "ADDED at the database (120 + 80), not SET"
    )
    assert child["output_tokens"] == 50
    assert child["token_coverage"] == list(TOKEN_COVERAGE_LEGS)
    assert child["coverage_is_null"] is False, (
        "the coverage marker must be POPULATED once a leg has reported — NULL is "
        "the third state (no instrumented leg ever reported), not a synonym for it"
    )


@pytest.mark.asyncio
async def test_a_zero_delta_changes_nothing_observed_through_the_database(seeded_run):
    """Idempotence against repetition, seen in the ROW rather than in a fake pool.

    ``_enforce_budget`` runs twice per phase iteration and the second pass sees an
    unchanged box, so the delta is ``(0, 0)``. If that guard were missing, the
    numbers below would double.
    """
    run_id = seeded_run

    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=2)
    try:
        await persist_run_usage(pool, run_id, input_delta=41, output_delta=9)
        first = await pool.fetchrow(
            "SELECT input_tokens, output_tokens FROM public.workflow_runs "
            "WHERE id = $1",
            run_id,
        )
        assert (first["input_tokens"], first["output_tokens"]) == (41, 9)

        await persist_run_usage(pool, run_id, input_delta=0, output_delta=0)
        await persist_run_usage(pool, run_id, input_delta=None, output_delta=None)

        after = await pool.fetchrow(
            "SELECT input_tokens, output_tokens FROM public.workflow_runs "
            "WHERE id = $1",
            run_id,
        )
        assert (after["input_tokens"], after["output_tokens"]) == (41, 9), (
            "a zero/None delta rewrote the row — the (0,0) guard is missing, and "
            "the twice-per-phase enforcement would double every run's spend"
        )
    finally:
        await pool.close()

    child = _read_in_a_child_process(run_id)
    assert (child["input_tokens"], child["output_tokens"]) == (41, 9)


def test_the_docstring_states_both_halves_of_the_claim():
    """The honesty pin: this file must keep saying what it does NOT prove.

    ⚠ A future edit that quietly drops the limitation would leave SC#1 looking
    proven by a test that cannot reach it. Cheap to assert; expensive to lose.
    """
    doc = sys.modules[__name__].__doc__ or ""
    assert "WHAT THIS PROVES" in doc
    assert "does **NOT** prove" in doc or "NOT** PROVE" in doc
    assert "kill -9" in doc
    assert "tests/integration/" in doc and "OUTSIDE" in doc
    # And the timing assertion is not a proxy for the boundary: the child reports
    # its own pid and the round-trip test compares it.
    assert "subprocess.Popen" in doc
    _ = time  # the module is imported for child-timeout accounting; keep it used

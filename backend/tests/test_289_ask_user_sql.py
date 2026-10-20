"""Phase 289 (289-01, D-11 / SEED-360) — the two ask_user statements run on REAL Postgres.

Root cause, captured live at base (289-01-SUMMARY.md, "D-11 live capture (base)"): answering a
paused workflow run re-drives it, the resumed ``llm_human_input`` executor calls
``get_ask_user_response``, and Postgres refuses the statement before it runs:

    asyncpg.exceptions.UndefinedFunctionError: operator does not exist: uuid = text

Both statements typed ``$1`` as ``text`` in the JOIN (``p.tool_calls->0->>'run_id' = $1::text``)
and then compared it with a uuid column (``WHERE wr.id = $1``). Every existing test of these
functions FAKES the pool (``tests/test_200_human_gate_pause.py``), so the error was invisible to
the suite for the whole life of the function (added ``613814426``, Phase 200-03).

So this file drives them through a REAL asyncpg pool. It reads only, with random ids that match
no row: the assertion is that each statement is ACCEPTED by Postgres and returns its empty value,
not that it finds anything. Lives under ``tests/`` (not ``tests/unit``) because the unit suite
mocks the pool. Local Postgres unreachable → the module SKIPS, so a RED or GREEN claim must be
recorded from a run where it did not skip.
"""
from __future__ import annotations

import asyncio
import uuid

import pytest

try:
    import asyncpg
except ImportError:  # pragma: no cover
    asyncpg = None

DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"


def _pg_ok() -> bool:
    if asyncpg is None:
        return False

    async def _probe():
        c = await asyncio.wait_for(asyncpg.connect(DSN), timeout=2.0)
        await c.close()

    try:
        asyncio.run(_probe())
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _pg_ok(), reason=f"local Postgres not reachable at {DSN}")


async def _pool():
    return await asyncpg.create_pool(DSN, min_size=1, max_size=1)


@pytest.mark.asyncio
async def test_get_ask_user_response_runs_on_real_postgres():
    """The re-drive's read: accepted by Postgres, returns None for an unknown run."""
    from app.db.workflows import get_ask_user_response

    pool = await _pool()
    try:
        out = await get_ask_user_response(pool, uuid.uuid4(), uuid.uuid4().hex)
    finally:
        await pool.close()
    assert out is None


@pytest.mark.asyncio
async def test_ask_user_response_exists_runs_on_real_postgres():
    """The boot sweep's read (same JOIN shape): accepted, returns False for an unknown run."""
    from app.db.workflows import ask_user_response_exists

    pool = await _pool()
    try:
        out = await ask_user_response_exists(pool, uuid.uuid4(), uuid.uuid4().hex)
    finally:
        await pool.close()
    assert out is False

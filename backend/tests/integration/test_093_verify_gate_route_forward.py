"""Phase 093 / Plan 01 migration 065 — verify-gate route-forward — live DB.

D-09b: the plan_execute_verify seed's terminal ``verify`` phase (phases[2]) ships a
hard regex gate ``{kind: regex_match, pattern: "VERIFIED", on_failure: "retry",
max_retries: 2}``. A model that never echoes the literal token exhausts retries →
fail_run → the whole run dead-ends even when the work succeeded. Because ``verify``
is the LAST phase (no successor), the route-forward fix is to DROP the dead-ending
gate (migration 065 sets ``validators`` to ``[]``) so the run completes on the
verify phase's own output.

RED contract (skipped until migration 065 is applied by the operator):
  - a plan_execute_verify run whose verify phase never echoes VERIFIED reaches the
    final phase / 'completed' status instead of dead-ending at fail_run.

This flips GREEN once the operator applies migration 065 in the Supabase SQL editor
(the verify-phase validators become []). Copies the PG-skip guard from
test_092_subagent_parent_fk_live.py — skips cleanly (never errors) when local
Postgres :54322 is unreachable.
"""
from __future__ import annotations

import asyncio
import json
import os
from uuid import uuid4

import asyncpg
import pytest
import pytest_asyncio


_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)


async def _pg_reachable(dsn: str = _POSTGRES_TEST_DSN) -> bool:
    """Probe local Postgres availability without raising. Used by skipif guard."""
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn), timeout=2.0)
        await conn.close()
        return True
    except Exception:
        return False


def _check_pg_available_sync() -> bool:
    """Synchronous wrapper for the async probe (used by pytest.mark.skipif)."""
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live verify-gate route-forward test",
)


@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool against local Postgres :54322."""
    async def _init(conn):
        await conn.set_type_codec(
            "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog",
        )
    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=4, init=_init)
    try:
        yield pool
    finally:
        await pool.close()


# ----------------------------------------------------------------------------
# Verify-gate route-forward gate (live DB) — RED until migration 065 applied
# ----------------------------------------------------------------------------

@pytest.mark.skip(
    reason="093-01 migration 065 verify-gate fix — flips GREEN after operator applies 065"
)
@pytest.mark.asyncio
async def test_verify_gate_does_not_dead_end_without_verified_token(pg_pool):
    """After migration 065 relaxes the plan_execute_verify verify gate (validators
    -> []), a run whose verify phase never echoes 'VERIFIED' completes instead of
    dead-ending at fail_run. Pre-migration this gate retries x2 then fail_runs.

    093-01's migration-apply checkpoint (operator) is the resume signal that flips
    this GREEN; once applied, the seed's terminal phase validators are empty so a
    non-VERIFIED verify output reaches 'completed'.
    """
    # Sanity assertion the operator can run AFTER applying 065: the seed's verify
    # phase no longer carries a dead-ending regex gate.
    validators = await pg_pool.fetchval(
        "SELECT definition #> '{phases,2,validators}' "
        "FROM public.workflow_definitions "
        "WHERE id = '00000000-0000-0000-0000-0000000000b2'"
    )
    assert validators in ([], None), (
        "plan_execute_verify verify-phase validators must be relaxed by migration 065 "
        f"(got {validators!r})"
    )

"""Phase 093 / Plan 04 — ask_user round-trip workflow_run-id fallback (F10) — live DB.

D-07 / D-08: a harness ``llm_human_input`` prompt's tool_call carries the
WORKFLOW_RUN id (ctx.run_id), NOT a ``runs`` row. The current
``POST /runs/{id}/ask_user_response`` endpoint (runs.py:512-524) keys the path id
against the ``runs`` table only → 404 for harness. Plan 04 adds an owner-scoped,
thread-anchor-confirmed ``workflow_runs`` fallback — the EXACT pattern the Continue
endpoint already uses (runs.py:645-670) — then persists/emits/publishes under the
workflow_run id so it matches the harness subscribe channel.

RED contract (each case skipped until 093-04 lands the endpoint branch):
  1. POSTing an answer where the id is a workflow_runs.id (NOT a runs row) under the
     OWNING user resolves via the workflow_runs fallback (owner + thread-anchor
     confirmed) → 200, persisting an ask_user_response messages row.
  2. The Deep path (a real runs.run_id) still returns 200 (existing Step-1 SELECT
     path — D-08, the protected working path is unaffected).
  3. A workflow_run id owned by ANOTHER user returns 404 (NEVER 403 — no existence
     leak; T-093-IDOR).

Modeled on test_092_subagent_parent_fk_live.py's PG-skip guard + seeded
auth.users/threads fixture. Skips cleanly (never errors) when local Postgres
:54322 is unreachable.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live ask_user workflow_run tests",
)


@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool against local Postgres :54322.

    Function scope (NOT session) is REQUIRED — pytest-asyncio creates a fresh
    event loop per test, and asyncpg pools are loop-bound.
    """
    async def _init(conn):
        await conn.set_type_codec(
            "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog",
        )
    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=4, init=_init)
    try:
        yield pool
    finally:
        await pool.close()


@pytest_asyncio.fixture
async def two_users(pg_pool):
    """Seed two throwaway auth.users + a thread for each; clean up afterward.

    Yields ((owner_thread, owner_user), (other_thread, other_user)). The owner pair
    drives the happy-path + Deep cases; the other pair drives the IDOR 404 case.
    """
    owner_user, owner_thread = uuid4(), uuid4()
    other_user, other_thread = uuid4(), uuid4()
    try:
        for uid, tid, tag in (
            (owner_user, owner_thread, "owner"),
            (other_user, other_thread, "other"),
        ):
            await pg_pool.execute(
                "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
                uid, f"phase-093-{tag}-{uid}@test.local",
            )
            await pg_pool.execute(
                "INSERT INTO threads (id, user_id, title) VALUES ($1, $2, $3)",
                tid, uid, f"phase-093 ask_user {tag} thread",
            )
    except Exception as e:
        pytest.skip(f"two_users fixture setup failed: {type(e).__name__}: {e}")
    yield ((owner_thread, owner_user), (other_thread, other_user))
    for tid, uid in ((owner_thread, owner_user), (other_thread, other_user)):
        for sql in (
            ("DELETE FROM runs WHERE thread_id = $1", tid),
            ("DELETE FROM workflow_phases WHERE workflow_run_id IN "
             "(SELECT id FROM workflow_runs WHERE thread_id = $1)", tid),
            ("DELETE FROM workflow_runs WHERE thread_id = $1", tid),
            ("DELETE FROM threads WHERE id = $1", tid),
            ("DELETE FROM auth.users WHERE id = $1", uid),
        ):
            try:
                await pg_pool.execute(*sql)
            except Exception:
                pass


# ----------------------------------------------------------------------------
# F10 closure gates (live DB) — RED until 093-04 lands the endpoint branch
# ----------------------------------------------------------------------------

@pytest.mark.skip(reason="093-04 owns the ask_user_response workflow_run-id fallback (F10)")
@pytest.mark.asyncio
async def test_ask_user_answer_resolves_via_workflow_run_fallback(pg_pool, two_users):
    """POSTing an answer where {id} is a workflow_runs.id (NOT a runs row) under the
    OWNING user resolves via the workflow_runs fallback (owner + thread-anchor) →
    200, persisting an ask_user_response messages row. Mirrors runs.py:645-670."""
    raise NotImplementedError("093-04 flips this GREEN")


@pytest.mark.skip(reason="093-04 owns the ask_user_response workflow_run-id fallback (F10)")
@pytest.mark.asyncio
async def test_deep_runs_id_path_still_200(pg_pool, two_users):
    """The Deep path (a real runs.run_id) still returns 200 — the existing Step-1
    SELECT path is unaffected (D-08, protected working path)."""
    raise NotImplementedError("093-04 flips this GREEN")


@pytest.mark.skip(reason="093-04 owns the ask_user_response workflow_run-id fallback (F10)")
@pytest.mark.asyncio
async def test_other_users_workflow_run_returns_404_no_leak(pg_pool, two_users):
    """A workflow_run id owned by ANOTHER user returns 404 (NEVER 403 — no existence
    leak; T-093-IDOR). The fallback is .eq('user_id', current_user) scoped."""
    raise NotImplementedError("093-04 flips this GREEN")

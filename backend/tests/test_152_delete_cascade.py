"""Phase 152 (WFIN-03) — safe workflow delete cascade (backend).

Integration contract for the two db/workflows.py helpers the cascade endpoint sits
on, driven against the LIVE local Postgres (:54322) so the REAL foreign keys decide
the outcome (the whole point of WFIN-03's "no orphaned runs/threads"):

  - ``delete_published_workflow_cascade(pool, *, slug, user_id)`` — one transaction,
    FK-safe order (runs FIRST — the ON DELETE RESTRICT blocker — then all definition
    versions). Deleting the runs auto-cascades ``workflow_phases`` (ON DELETE CASCADE)
    and auto-detaches threads (``threads.active_workflow_run_id`` ON DELETE SET NULL —
    threads are KEPT as normal chats, D-LOCK-04).
  - ``delete_workflow_cascade_preview(pool, *, slug, user_id)`` — the exact Removed/Kept
    counts the victim-naming sheet (152-04) consumes (D-LOCK-03), owner-scoped.

Behaviors under test (plan Task 1):
  - all-versions (A1): delete-by-slug for the owner removes EVERY row sharing that slug
    (definition + every version), not just one version.
  - FK-safe / no orphans: after cascade, ``workflow_runs`` for those definition_ids = 0,
    ``workflow_phases`` for those runs = 0 (auto-cascade), and a previously-linked thread
    SURVIVES with ``active_workflow_run_id IS NULL``.
  - owner gate: a slug owned by ANOTHER user resolves to 0 version_ids → the helper
    returns ``{"deleted": False}`` (the route maps that to 404, no existence leak) and the
    other user's rows are UNTOUCHED.
  - preview counts: ``{name, versions, runs, threads}`` where runs = COUNT(*) of
    workflow_runs for the versions and threads = COUNT(DISTINCT thread_id), all owner-scoped.

Modeled on test_093_ask_user_workflow_run_live.py's PG-skip guard + seeded
auth.users/threads fixture. Skips cleanly (never errors) when local Postgres :54322 is
unreachable. Measured against the captured SEED-056 baseline, NOT zero-fail.
"""
from __future__ import annotations

import asyncio
import json
import os
from uuid import uuid4

import asyncpg
import pytest
import pytest_asyncio

# RED until Plan 152-02 Task 1 lands these helpers (import-time ImportError = the RED gate).
from app.db.workflows import (
    delete_published_workflow_cascade,
    delete_workflow_cascade_preview,
)


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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live delete-cascade tests",
)


# ----------------------------------------------------------------------------
# Fixtures (mirror test_093_ask_user_workflow_run_live.py — LIVE pool, NOT mock)
# ----------------------------------------------------------------------------

@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool against local Postgres :54322.

    Function scope (NOT session) is REQUIRED — pytest-asyncio creates a fresh event
    loop per test, and asyncpg pools are loop-bound.
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
    """Seed two throwaway auth.users; clean up every workflow artifact afterward.

    Yields ((owner_user), (other_user)). Threads are created ad-hoc inside each test
    (the cascade must survive N distinct threads), so teardown sweeps by user id.
    """
    owner_user, other_user = uuid4(), uuid4()
    try:
        for uid, tag in ((owner_user, "owner"), (other_user, "other")):
            await pg_pool.execute(
                "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
                uid, f"phase-152-{tag}-{uid}@test.local",
            )
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"two_users fixture setup failed: {type(e).__name__}: {e}")
    yield (owner_user, other_user)
    for uid in (owner_user, other_user):
        for sql in (
            # Detach anchors first (threads.active_workflow_run_id FKs workflow_runs).
            ("UPDATE threads SET active_workflow_run_id = NULL WHERE user_id = $1", uid),
            ("DELETE FROM workflow_phases WHERE workflow_run_id IN "
             "(SELECT id FROM workflow_runs WHERE user_id = $1)", uid),
            ("DELETE FROM workflow_runs WHERE user_id = $1", uid),
            ("DELETE FROM workflow_definitions WHERE created_by = $1", uid),
            ("DELETE FROM messages WHERE thread_id IN (SELECT id FROM threads WHERE user_id = $1)", uid),
            ("DELETE FROM runs WHERE user_id = $1", uid),
            ("DELETE FROM threads WHERE user_id = $1", uid),
            ("DELETE FROM auth.users WHERE id = $1", uid),
        ):
            try:
                await pg_pool.execute(*sql)
            except Exception:
                pass


# ----------------------------------------------------------------------------
# Seed helpers
# ----------------------------------------------------------------------------

async def _seed_definition(pg_pool, *, slug, version, name, created_by, status="published"):
    """Insert one workflow_definitions row (minimal valid definition JSONB)."""
    return await pg_pool.fetchval(
        "INSERT INTO workflow_definitions (slug, version, name, status, definition, created_by) "
        "VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING id",
        slug, version, name, status,
        json.dumps({"slug": slug, "version": version, "phases": []}),
        created_by,
    )


async def _seed_thread(pg_pool, *, user_id, title="phase-152 delete-cascade thread"):
    return await pg_pool.fetchval(
        "INSERT INTO threads (id, user_id, title) VALUES ($1, $2, $3) RETURNING id",
        uuid4(), user_id, title,
    )


async def _seed_run(pg_pool, *, thread_id, definition_id, user_id, status="completed", set_anchor=False):
    run_id = await pg_pool.fetchval(
        "INSERT INTO workflow_runs (thread_id, definition_id, status, inputs, model, user_id) "
        "VALUES ($1, $2, $3, $4::jsonb, $5, $6) RETURNING id",
        thread_id, definition_id, status, json.dumps({"kickoff_prompt": "delete-cascade test"}),
        None, user_id,
    )
    if set_anchor:
        await pg_pool.execute(
            "UPDATE threads SET active_workflow_run_id = $1 WHERE id = $2", run_id, thread_id,
        )
    return run_id


async def _seed_phase(pg_pool, *, run_id, phase_index=0, slug="p", status="pending"):
    return await pg_pool.fetchval(
        "INSERT INTO workflow_phases (workflow_run_id, phase_index, slug, status) "
        "VALUES ($1, $2, $3, $4) RETURNING id",
        run_id, phase_index, slug, status,
    )


# ----------------------------------------------------------------------------
# all-versions (A1) + FK-safe / no orphans
# ----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cascade_deletes_all_versions_no_orphans(pg_pool, two_users):
    """Delete-by-slug sweeps EVERY version, deletes all runs (auto-cascading phases),
    and leaves the thread alive with a NULL anchor (threads KEPT — D-LOCK-04)."""
    owner_user, _other = two_users
    slug = f"wf-cascade-{uuid4().hex[:8]}"

    d1 = await _seed_definition(pg_pool, slug=slug, version=1, name="Cascade WF", created_by=owner_user)
    d2 = await _seed_definition(pg_pool, slug=slug, version=2, name="Cascade WF", created_by=owner_user)
    thread = await _seed_thread(pg_pool, user_id=owner_user)
    run = await _seed_run(pg_pool, thread_id=thread, definition_id=d1, user_id=owner_user, set_anchor=True)
    await _seed_phase(pg_pool, run_id=run)

    result = await delete_published_workflow_cascade(pg_pool, slug=slug, user_id=owner_user)

    assert result["deleted"] is True
    assert result["name"] == "Cascade WF"
    assert result["versions"] == 2  # A1 — BOTH versions swept, not just one
    assert result["runs"] == 1  # the one seeded run deleted

    # No orphans: both definitions gone, the run gone, the phase auto-cascaded gone.
    assert await pg_pool.fetchval(
        "SELECT count(*) FROM workflow_definitions WHERE id = ANY($1::uuid[])", [d1, d2]
    ) == 0
    assert await pg_pool.fetchval(
        "SELECT count(*) FROM workflow_runs WHERE definition_id = ANY($1::uuid[])", [d1, d2]
    ) == 0
    assert await pg_pool.fetchval(
        "SELECT count(*) FROM workflow_phases WHERE workflow_run_id = $1", run
    ) == 0  # ON DELETE CASCADE

    # The thread SURVIVES as a normal chat with the anchor auto-SET-NULL (SET NULL FK).
    row = await pg_pool.fetchrow(
        "SELECT id, active_workflow_run_id FROM threads WHERE id = $1", thread
    )
    assert row is not None, "the thread must be KEPT (detached, never deleted — D-LOCK-04)"
    assert row["active_workflow_run_id"] is None


# ----------------------------------------------------------------------------
# owner gate — a foreign slug is invisible (no existence leak) + untouched
# ----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cascade_owner_gate_foreign_slug_not_deleted(pg_pool, two_users):
    """A slug owned by ANOTHER user resolves to 0 version_ids → {"deleted": False}; the
    other user's rows are UNTOUCHED (owner WHERE is the only boundary — service role has
    no RLS backstop)."""
    owner_user, other_user = two_users
    slug = f"wf-foreign-{uuid4().hex[:8]}"

    foreign_def = await _seed_definition(
        pg_pool, slug=slug, version=1, name="Not Yours", created_by=other_user
    )

    result = await delete_published_workflow_cascade(pg_pool, slug=slug, user_id=owner_user)
    assert result == {"deleted": False}

    # The foreign row is UNTOUCHED — the owner gate refused, nothing cross-user deleted.
    assert await pg_pool.fetchval(
        "SELECT count(*) FROM workflow_definitions WHERE id = $1", foreign_def
    ) == 1


# ----------------------------------------------------------------------------
# preview counts — the exact Removed/Kept numbers the sheet consumes (D-LOCK-03)
# ----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_preview_counts_match_reality(pg_pool, two_users):
    """The preview returns {name, versions, runs, threads}: 2 versions, 2 runs across 2
    DISTINCT threads, owner-scoped, matching reality."""
    owner_user, _other = two_users
    slug = f"wf-preview-{uuid4().hex[:8]}"

    d1 = await _seed_definition(pg_pool, slug=slug, version=1, name="Preview WF", created_by=owner_user)
    d2 = await _seed_definition(pg_pool, slug=slug, version=2, name="Preview WF", created_by=owner_user)
    t1 = await _seed_thread(pg_pool, user_id=owner_user)
    t2 = await _seed_thread(pg_pool, user_id=owner_user)
    await _seed_run(pg_pool, thread_id=t1, definition_id=d1, user_id=owner_user)
    await _seed_run(pg_pool, thread_id=t2, definition_id=d2, user_id=owner_user)

    preview = await delete_workflow_cascade_preview(pg_pool, slug=slug, user_id=owner_user)

    assert preview["found"] is True
    assert preview["name"] == "Preview WF"
    assert preview["versions"] == 2
    assert preview["runs"] == 2
    assert preview["threads"] == 2  # COUNT(DISTINCT thread_id)


@pytest.mark.asyncio
async def test_preview_owner_gate_foreign_slug_not_found(pg_pool, two_users):
    """A slug owned by another user → not-found marker (the route maps that to 404)."""
    owner_user, other_user = two_users
    slug = f"wf-preview-foreign-{uuid4().hex[:8]}"
    await _seed_definition(pg_pool, slug=slug, version=1, name="Not Yours", created_by=other_user)

    preview = await delete_workflow_cascade_preview(pg_pool, slug=slug, user_id=owner_user)
    assert preview.get("found") is False

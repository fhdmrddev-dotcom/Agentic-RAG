"""Phase 103 (REQ-7 / WFAUTH-04) — Tweak fork = create v(N+1) draft INSERT.

Wave 0 (Plan 01 Task 1) authors the stub; **Plan 01 Task 2** un-xfails it.

T-103-01-06 (Tampering / Pitfall 6): Tweak NEVER UPDATEs the frozen published row —
it ``create_workflow_definition`` INSERTs a NEW row with ``version = published_N + 1``,
``status='draft'``, the SAME slug. Publishing the fork yields a SECOND published row
for the same slug (the ``UNIQUE(slug, version)`` constraint from migration 056 is
satisfied because the version differs).

Live :54322 via asyncpg (module-level skip-guard). Seeded rows are cleaned up.
CONVENTION (Phase 102 posture): imports INSIDE the test body; the DB connect is
guarded.
"""

from __future__ import annotations

import os

import pytest

_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)


def _pg_reachable(dsn: str = _DSN) -> bool:
    try:
        import psycopg2

        conn = psycopg2.connect(dsn, connect_timeout=2)
        conn.close()
        return True
    except Exception:
        return False


PG_AVAILABLE = _pg_reachable()

pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=f"Local Postgres on {_DSN} not reachable; skipping live Tweak-fork test",
)


def _draft_definition(slug: str, version: int) -> dict:
    return {
        "slug": slug,
        "version": version,
        "name": "Tweak Fork Test",
        "status": "draft",
        "phases": [
            {
                "slug": "answer",
                "phase_index": 0,
                "config": {"phase_type": "llm_single", "prompt": "Answer."},
                "validators": [],
            }
        ],
    }


@pytest.mark.xfail(reason="Plan 01 Task 2 implements create_workflow_definition (fork INSERT)", strict=False)
@pytest.mark.asyncio
async def test_tweak_fork_creates_v_n_plus_1_and_two_published_rows():
    """Seed+publish vN, fork v(N+1) as a draft via create_workflow_definition (INSERT,
    not UPDATE), publish the fork -> TWO published rows for the same slug; the original
    vN published row is never UPDATEd (Pitfall 6 / immutability)."""
    import asyncpg

    from app.db.workflows import (
        create_workflow_definition,
        publish_definition,
    )
    from app.models.harness import WorkflowDefinition

    pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=1)
    slug = f"tweak-fork-{os.getpid()}"
    try:
        async with pool.acquire() as con:
            owner = await con.fetchval("SELECT id FROM auth.users ORDER BY id LIMIT 1")

        # ── seed v1 draft + publish it ──────────────────────────────────────
        v1 = await create_workflow_definition(
            pool,
            definition=WorkflowDefinition.model_validate(_draft_definition(slug, 1)),
            user_id=owner,
        )
        v1_version = await publish_definition(pool, v1["id"])
        assert v1_version == 1

        # ── Tweak fork = create v(N+1)=v2 draft (INSERT, never UPDATE v1) ────
        v2 = await create_workflow_definition(
            pool,
            definition=WorkflowDefinition.model_validate(_draft_definition(slug, 2)),
            user_id=owner,
        )
        assert v2["version"] == 2  # version = published_N + 1

        # ── publish the fork -> a 2nd published row, same slug ──────────────
        v2_version = await publish_definition(pool, v2["id"])
        assert v2_version == 2

        async with pool.acquire() as con:
            published = await con.fetchval(
                "SELECT count(*) FROM workflow_definitions "
                "WHERE slug = $1 AND status = 'published'",
                slug,
            )
        assert published == 2  # TWO published rows (UNIQUE(slug,version) satisfied)
    finally:
        async with pool.acquire() as con:
            await con.execute("DELETE FROM workflow_definitions WHERE slug = $1", slug)
        await pool.close()

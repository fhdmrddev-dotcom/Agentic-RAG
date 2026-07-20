"""Phase 143 (WF-01, STRETCH) — Wave 0 RED backstops for the workflows router.

Route-level targets for the Starters shelf + the scoped Published shelf, plus a
GREEN regression backstop for the fresh-copy fork's collision path:

  • ``GET /workflows/starters`` (``get_starter_workflows``) returns the seeded
    curated starter rows.  RED — the route does not exist until Plan 02.
  • ``GET /workflows/published?scope=mine`` (``get_published_workflows(scope=...)``)
    narrows to the caller's own published rows.  RED — the ``scope`` param does not
    exist until Plan 02.
  • A create whose ``(slug, version)`` collides maps ``UniqueViolationError`` → 409
    (the fresh-copy fork's astronomically-unlikely hash-collision path, Pitfall 5).
    GREEN — this pins the existing ``create_draft`` 409 mapping as a fork backstop.

Each route fn is called DIRECTLY with a ``current_user`` dict + a patched
``get_pg_pool`` (the test_103_draft_crud.py route-round-trip precedent), so no HTTP
client / app wiring is needed. Imports are INSIDE the test bodies (Phase 102 posture)
so ``--collect-only`` stays clean and the RED surfaces at RUNTIME on
AttributeError / an unexpected-kwarg TypeError — never a collection error.

Live :54322 via asyncpg (module-level skip-guard). Seeded rows are cleaned up.
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
    reason=f"Local Postgres on {_DSN} not reachable; skipping live workflows-route tests",
)


def _starter_definition(slug: str) -> dict:
    return {
        "slug": slug,
        "version": 1,
        "name": "RED Starter Route Test",
        "status": "published",
        "category": "starter",
        "phases": [],
    }


def _published_definition(slug: str) -> dict:
    return {
        "slug": slug,
        "version": 1,
        "name": "RED Published Route Test",
        "status": "published",
        "phases": [],
    }


def _draft_definition(slug: str) -> dict:
    return {
        "slug": slug,
        "version": 1,
        "name": "RED Fork Collision Test",
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


async def _insert_published(con, *, slug: str, definition: dict, created_by, is_system_global: bool):
    import json
    import uuid

    await con.execute(
        "INSERT INTO workflow_definitions "
        "(id, slug, version, name, status, definition, created_by, is_system_global) "
        "VALUES ($1, $2, 1, $3, 'published', $4::jsonb, $5, $6)",
        uuid.uuid4(),
        slug,
        definition["name"],
        json.dumps(definition),
        created_by,
        is_system_global,
    )


# ── GET /workflows/starters — returns the curated starter rows (RED) ──────────
@pytest.mark.asyncio
async def test_get_starter_workflows_returns_seeded_starters():
    """``get_starter_workflows`` returns the seeded ``category='starter'`` global row."""
    import asyncpg
    from unittest.mock import AsyncMock, patch

    from app.api import workflows as wf_api

    pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=1)
    starter_slug = f"red-starter-route-{os.getpid()}"
    try:
        async with pool.acquire() as con:
            owner = await con.fetchval("SELECT id FROM auth.users ORDER BY id LIMIT 1")
            await _insert_published(
                con,
                slug=starter_slug,
                definition=_starter_definition(starter_slug),
                created_by=owner,
                is_system_global=True,
            )
        current_user = {"id": str(owner)}
        try:
            with patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=pool)):
                # RED: get_starter_workflows does not exist until Plan 02 → AttributeError.
                rows = await wf_api.get_starter_workflows(current_user=current_user)
            slugs = {r.slug for r in rows}
            assert starter_slug in slugs  # the seeded curated starter is returned
        finally:
            async with pool.acquire() as con:
                await con.execute(
                    "DELETE FROM workflow_definitions WHERE slug = $1", starter_slug
                )
    finally:
        await pool.close()


# ── GET /workflows/published?scope=mine — narrows to the caller's rows (RED) ──
@pytest.mark.asyncio
async def test_published_scope_mine_narrows():
    """``get_published_workflows(scope='mine')`` returns ONLY the caller's published
    rows — a global row is excluded (no double-render). D-143-2a end state."""
    import asyncpg
    from unittest.mock import AsyncMock, patch

    from app.api import workflows as wf_api

    pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=1)
    own_slug = f"red-own-route-{os.getpid()}"
    global_slug = f"red-global-route-{os.getpid()}"
    try:
        async with pool.acquire() as con:
            user_rows = await con.fetch("SELECT id FROM auth.users ORDER BY id LIMIT 2")
        if len(user_rows) < 2:
            pytest.skip("need >=2 auth.users rows for the scope=mine narrowing test")
        owner, other = user_rows[0]["id"], user_rows[1]["id"]
        current_user = {"id": str(owner)}
        try:
            async with pool.acquire() as con:
                await _insert_published(
                    con,
                    slug=own_slug,
                    definition=_published_definition(own_slug),
                    created_by=owner,
                    is_system_global=False,
                )
                await _insert_published(
                    con,
                    slug=global_slug,
                    definition=_published_definition(global_slug),
                    created_by=other,
                    is_system_global=True,
                )
            with patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=pool)):
                # RED: the scope param does not exist until Plan 02 → TypeError.
                rows = await wf_api.get_published_workflows(
                    scope="mine", current_user=current_user
                )
            slugs = {r.slug for r in rows}
            assert own_slug in slugs  # my own published row is present
            assert global_slug not in slugs  # the global row is NOT double-rendered
        finally:
            async with pool.acquire() as con:
                await con.execute(
                    "DELETE FROM workflow_definitions WHERE slug = ANY($1::text[])",
                    [own_slug, global_slug],
                )
    finally:
        await pool.close()


# ── create collision → 409 — the fork's UNIQUE(slug,version) path (GREEN) ─────
@pytest.mark.asyncio
async def test_fork_slug_version_collision_maps_409():
    """A fresh-copy fork mints ``<slug>-<hash>`` v1; a duplicate ``(slug, version)``
    (an astronomically-unlikely hash re-collision) maps ``UniqueViolationError`` → 409,
    never a raw 500 (Pitfall 5). This pins the existing create_draft 409 mapping."""
    import asyncpg
    from unittest.mock import AsyncMock, patch

    from fastapi import HTTPException, status

    from app.api import workflows as wf_api
    from app.models.harness import WorkflowDefinition

    pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=1)
    slug = f"red-fork-collide-{os.getpid()}"
    try:
        async with pool.acquire() as con:
            owner = await con.fetchval("SELECT id FROM auth.users ORDER BY id LIMIT 1")
        current_user = {"id": str(owner)}
        body = WorkflowDefinition.model_validate(_draft_definition(slug))
        try:
            with patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=pool)):
                first = await wf_api.create_draft(body=body, current_user=current_user)
                assert first.version == 1
                # Same (slug, version) again → the UNIQUE(slug,version) collision maps to 409.
                with pytest.raises(HTTPException) as exc:
                    await wf_api.create_draft(body=body, current_user=current_user)
                assert exc.value.status_code == status.HTTP_409_CONFLICT
        finally:
            async with pool.acquire() as con:
                await con.execute(
                    "DELETE FROM workflow_definitions WHERE slug = $1", slug
                )
    finally:
        await pool.close()

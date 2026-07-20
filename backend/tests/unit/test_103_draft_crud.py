"""Phase 103 (REQ-1 / WFAUTH-01) — draft-CRUD round-trip + owner-scope.

Wave 0 (Plan 01 Task 1) authors the stubs; **Plan 01 Task 2** fills the DB-fn
cases (create/list/update/delete + owner-scope) and **Plan 01 Task 3** fills the
route-level cases. Until then the not-yet-built behaviors are
``@pytest.mark.xfail(strict=False)`` so the Wave-0 suite exits 0.

Live :54322 via psycopg2 (a module-level skip-guard makes the file skip cleanly
when the local stack is down — never error). Seeded rows are rolled back (the
Phase-102 ``test_publish_flip`` rollback precedent).

CONVENTION (Phase 102 posture): imports INSIDE the test bodies; the DB connect is
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
    """Probe local Postgres availability without raising (skipif guard)."""
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
    reason=f"Local Postgres on {_DSN} not reachable; skipping live draft-CRUD tests",
)


def _draft_definition(slug: str) -> dict:
    """A single-phase llm_single draft definition body (lint-clean)."""
    return {
        "slug": slug,
        "version": 1,
        "name": "Draft CRUD Test",
        "status": "draft",
        "phases": [
            {
                "slug": "answer",
                "phase_index": 0,
                "config": {"phase_type": "llm_single", "prompt": "Answer."},
                "validators": [],
                "name": "Answer",
            }
        ],
    }


def _two_owners(cur):
    """Return two DISTINCT auth.users ids (owner + a second user) or skip."""
    cur.execute("SELECT id FROM auth.users ORDER BY id LIMIT 2")
    rows = cur.fetchall()
    if len(rows) < 2:
        pytest.skip("need >=2 auth.users rows on the local stack for the owner-scope test")
    return rows[0][0], rows[1][0]


# ── Plan 01 Task 2 fills these (DB-fn level) — GREEN against :54322 ────────────
@pytest.mark.asyncio
async def test_create_persists_draft_and_returns_id_version():
    """create_workflow_definition INSERTs status='draft', is_system_global=false and
    RETURNs {id, version}; a re-read shows the row owned by the caller."""
    import asyncpg

    from app.db.workflows import create_workflow_definition, get_definition
    from app.models.harness import WorkflowDefinition

    pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=1)
    try:
        async with pool.acquire() as con:
            owner = await con.fetchval("SELECT id FROM auth.users ORDER BY id LIMIT 1")
        slug = f"draft-crud-create-{os.getpid()}"
        definition = WorkflowDefinition.model_validate(_draft_definition(slug))
        try:
            row = await create_workflow_definition(pool, definition=definition, user_id=owner)
            assert row["id"] is not None
            assert row["version"] == 1
            read = await get_definition(pool, row["id"], user_id=owner)
            assert read is not None
            assert read["status"] == "draft"
            assert read["created_by"] == owner
        finally:
            async with pool.acquire() as con:
                await con.execute(
                    "DELETE FROM workflow_definitions WHERE slug = $1", slug
                )
    finally:
        await pool.close()


@pytest.mark.asyncio
async def test_list_drafts_is_owner_scoped():
    """list_draft_workflows returns ONLY the caller's drafts — a second user's draft
    is ABSENT (T-103-01-01 EoP / owner-scope)."""
    import asyncpg

    from app.db.workflows import create_workflow_definition, list_draft_workflows
    from app.models.harness import WorkflowDefinition

    pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=1)
    try:
        async with pool.acquire() as con:
            cur_rows = await con.fetch("SELECT id FROM auth.users ORDER BY id LIMIT 2")
        if len(cur_rows) < 2:
            pytest.skip("need >=2 auth.users rows for the owner-scope test")
        owner, other = cur_rows[0]["id"], cur_rows[1]["id"]
        own_slug = f"draft-crud-own-{os.getpid()}"
        other_slug = f"draft-crud-other-{os.getpid()}"
        try:
            await create_workflow_definition(
                pool,
                definition=WorkflowDefinition.model_validate(_draft_definition(own_slug)),
                user_id=owner,
            )
            await create_workflow_definition(
                pool,
                definition=WorkflowDefinition.model_validate(_draft_definition(other_slug)),
                user_id=other,
            )
            owner_drafts = await list_draft_workflows(pool, user_id=owner)
            owner_slugs = {d["slug"] for d in owner_drafts}
            assert own_slug in owner_slugs
            assert other_slug not in owner_slugs  # a second user's draft is ABSENT
        finally:
            async with pool.acquire() as con:
                await con.execute(
                    "DELETE FROM workflow_definitions WHERE slug = ANY($1::text[])",
                    [own_slug, other_slug],
                )
    finally:
        await pool.close()


@pytest.mark.asyncio
async def test_update_round_trips_and_delete_then_none():
    """update_workflow_definition mutates a draft and round-trips the change;
    delete_workflow_definition removes it and a re-read returns None."""
    import asyncpg

    from app.db.workflows import (
        create_workflow_definition,
        delete_workflow_definition,
        get_definition,
        update_workflow_definition,
    )
    from app.models.harness import WorkflowDefinition

    pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=1)
    try:
        async with pool.acquire() as con:
            owner = await con.fetchval("SELECT id FROM auth.users ORDER BY id LIMIT 1")
        slug = f"draft-crud-upd-{os.getpid()}"
        body = _draft_definition(slug)
        created = await create_workflow_definition(
            pool, definition=WorkflowDefinition.model_validate(body), user_id=owner
        )
        def_id = created["id"]
        try:
            body["name"] = "Renamed Draft"
            upd = await update_workflow_definition(
                pool,
                def_id,
                definition=WorkflowDefinition.model_validate(body),
                user_id=owner,
            )
            assert upd is not None
            read = await get_definition(pool, def_id, user_id=owner)
            # A bare asyncpg pool (no app JSONB codec) returns ``definition`` as a JSON
            # string — the live app pool decodes it to a dict. Normalize either way:
            import json as _json

            decoded = read["definition"]
            if isinstance(decoded, str):
                decoded = _json.loads(decoded)
            assert decoded["name"] == "Renamed Draft"  # round-tripped
            # The row's top-level ``name`` column was updated too:
            assert read["name"] == "Renamed Draft"

            deleted = await delete_workflow_definition(pool, def_id, user_id=owner)
            assert deleted is True
            gone = await get_definition(pool, def_id, user_id=owner)
            assert gone is None  # DELETE then re-read None
        finally:
            async with pool.acquire() as con:
                await con.execute(
                    "DELETE FROM workflow_definitions WHERE slug = $1", slug
                )
    finally:
        await pool.close()


# ── Plan 01 Task 3 fills this (route level) — GREEN against :54322 ─────────────
@pytest.mark.asyncio
async def test_route_round_trip_create_list_patch_delete():
    """The full route round-trip (REQ-1): create_draft -> list_drafts shows it ->
    update_draft round-trips -> delete_draft -> a re-list no longer shows it. The
    route forces ``status='draft'`` server-side even when the body claims published
    (T-103-01-03 — never trust the client)."""
    import asyncpg

    from app.api import workflows as wf_api
    from app.db.workflows import get_definition
    from app.models.harness import WorkflowDefinition

    pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=1)
    try:
        async with pool.acquire() as con:
            owner = await con.fetchval("SELECT id FROM auth.users ORDER BY id LIMIT 1")
        slug = f"draft-crud-route-{os.getpid()}"
        body = _draft_definition(slug)
        body["status"] = "published"  # the client LIES — the route must force 'draft'
        current_user = {"id": str(owner)}

        from unittest.mock import AsyncMock, patch

        with patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=pool)):
            created = await wf_api.create_draft(
                body=WorkflowDefinition.model_validate(body), current_user=current_user
            )
            def_id = created.id
            try:
                # Server forced status='draft' despite the lying body:
                stored = await get_definition(pool, def_id, user_id=owner)
                assert stored["status"] == "draft"

                # list_drafts shows it (owner-scoped):
                drafts = await wf_api.list_drafts(current_user=current_user)
                assert any(d.id == def_id for d in drafts)

                # update_draft round-trips a rename:
                body["name"] = "Route Renamed"
                upd = await wf_api.update_draft(
                    definition_id=def_id,
                    body=WorkflowDefinition.model_validate(body),
                    current_user=current_user,
                )
                assert upd.id == def_id
                reread = await get_definition(pool, def_id, user_id=owner)
                assert reread["name"] == "Route Renamed"

                # delete_draft (204 -> returns None); a re-list no longer shows it:
                result = await wf_api.delete_draft(
                    definition_id=def_id, current_user=current_user
                )
                assert result is None
                drafts_after = await wf_api.list_drafts(current_user=current_user)
                assert all(d.id != def_id for d in drafts_after)
            finally:
                async with pool.acquire() as con:
                    await con.execute(
                        "DELETE FROM workflow_definitions WHERE slug = $1", slug
                    )
    finally:
        await pool.close()

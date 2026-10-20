"""Phase 287 (START-03 / SC#4) -- fork isolation, proven by editing the copy and re-reading.

A fork of a starter is INSERT-only (``create_workflow_definition``: status 'draft',
is_system_global false, created_by caller), so isolation holds by construction. This file is
the regression PIN, driven against the real local DB through the real create + update path:

  * two callers (A and B) each fork ONE starter -> two NEW rows with their own ids;
  * A edits the fork's name and a phase prompt through ``update_workflow_definition``;
  * the starter row (name, definition::text, updated_at) and B's fork are BYTE-EQUAL after;
  * the shelf slug set (``list_starter_workflows``) is identical before/after and contains
    neither fork.

Live :54322 via asyncpg; skips cleanly when the stack is down (never errors). Every row it
creates is deleted in ``finally`` and the test asserts the leftover count is zero.
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


pytestmark = pytest.mark.skipif(
    not _pg_reachable(),
    reason=f"Local Postgres on {_DSN} not reachable; skipping live fork-isolation test",
)


def _starter_body(slug: str) -> dict:
    return {
        "slug": slug,
        "version": 1,
        "name": "287 Isolation Starter",
        "status": "published",
        "category": "starter",
        "phases": [
            {
                "slug": "answer",
                "phase_index": 0,
                "config": {"phase_type": "llm_single", "prompt": "Original prompt."},
                "validators": [],
                "name": "Answer",
            }
        ],
    }


def _ids_differ(starter_id, fork_id) -> bool:
    """The discriminating check: a fork that reused the starter's id would be an in-place
    edit of the shared row. Factored out so the counterfactual below can drive it."""
    return starter_id != fork_id


def test_counterfactual_equal_id_is_caught():
    """A fork carrying the starter's id must FAIL the identity check (planted equal-id)."""
    import uuid

    same = uuid.uuid4()
    assert _ids_differ(same, same) is False
    assert _ids_differ(same, uuid.uuid4()) is True


@pytest.mark.asyncio
async def test_editing_a_fork_never_touches_starter_or_other_fork():
    import asyncpg

    from app.db.workflows import (
        create_workflow_definition,
        list_starter_workflows,
        update_workflow_definition,
    )
    from app.models.harness import WorkflowDefinition

    pid = os.getpid()
    starter_slug = f"t287-starter-{pid}"
    fork_a_slug = f"{starter_slug}-aaaaaa"
    fork_b_slug = f"{starter_slug}-bbbbbb"
    pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=2)
    try:
        async with pool.acquire() as con:
            users = await con.fetch("SELECT id FROM auth.users ORDER BY id LIMIT 2")
            if len(users) < 2:
                pytest.skip("need >=2 auth.users rows for the two-user isolation test")
            user_a, user_b = users[0]["id"], users[1]["id"]

        import json
        import uuid

        starter_id = uuid.uuid4()
        try:
            async with pool.acquire() as con:
                await con.execute(
                    "INSERT INTO workflow_definitions "
                    "(id, slug, version, name, status, definition, created_by, is_system_global) "
                    "VALUES ($1, $2, 1, $3, 'published', $4::jsonb, $5, true)",
                    starter_id,
                    starter_slug,
                    "287 Isolation Starter",
                    json.dumps(_starter_body(starter_slug)),
                    user_a,
                )

            async def snapshot(row_id):
                async with pool.acquire() as con:
                    r = await con.fetchrow(
                        "SELECT name, definition::text AS d, updated_at FROM workflow_definitions "
                        "WHERE id = $1",
                        row_id,
                    )
                    return tuple(r)

            shelf_before = {r["slug"] for r in await list_starter_workflows(pool)}
            assert starter_slug in shelf_before
            starter_before = await snapshot(starter_id)

            # Fork body = the starter's body with a fresh slug, version 1, draft (category kept, A-05).
            def fork_def(slug: str) -> WorkflowDefinition:
                body = _starter_body(starter_slug)
                body.update({"slug": slug, "status": "draft", "name": "My copy"})
                return WorkflowDefinition.model_validate(body)

            fa = await create_workflow_definition(pool, definition=fork_def(fork_a_slug), user_id=user_a)
            fb = await create_workflow_definition(pool, definition=fork_def(fork_b_slug), user_id=user_b)

            # A fork is a NEW row: own id, draft, not global, created_by the caller.
            assert _ids_differ(starter_id, fa["id"]) and _ids_differ(starter_id, fb["id"])
            assert fa["id"] != fb["id"]
            async with pool.acquire() as con:
                for fid, owner in ((fa["id"], user_a), (fb["id"], user_b)):
                    r = await con.fetchrow(
                        "SELECT status, is_system_global, created_by FROM workflow_definitions "
                        "WHERE id = $1",
                        fid,
                    )
                    assert r["status"] == "draft"
                    assert r["is_system_global"] is False
                    assert r["created_by"] == owner

            fork_b_before = await snapshot(fb["id"])

            # A edits the name and a phase prompt through the REAL update path.
            edited = _starter_body(starter_slug)
            edited.update({"slug": fork_a_slug, "status": "draft", "name": "A renamed"})
            edited["phases"][0]["config"]["prompt"] = "Edited by A only."
            res = await update_workflow_definition(
                pool,
                fa["id"],
                definition=WorkflowDefinition.model_validate(edited),
                user_id=user_a,
                token=fa.get("token"),
            )
            assert res["ok"] is True

            async with pool.acquire() as con:
                a_prompt = await con.fetchval(
                    "SELECT definition #>> '{phases,0,config,prompt}' FROM workflow_definitions "
                    "WHERE id = $1",
                    fa["id"],
                )
            assert a_prompt == "Edited by A only."  # positive control: the edit really landed

            # Byte-equal re-reads: starter and the other user's fork are untouched.
            assert await snapshot(starter_id) == starter_before
            assert await snapshot(fb["id"]) == fork_b_before
            starter_after = await snapshot(starter_id)
            assert starter_after[1] == starter_before[1]  # definition text
            assert starter_after[2] == starter_before[2]  # updated_at

            # The shelf is unchanged and excludes both forks (drafts never reach it).
            shelf_after = {r["slug"] for r in await list_starter_workflows(pool)}
            assert shelf_after == shelf_before
            assert fork_a_slug not in shelf_after and fork_b_slug not in shelf_after
        finally:
            async with pool.acquire() as con:
                await con.execute(
                    "DELETE FROM workflow_definitions WHERE slug = ANY($1::text[])",
                    [starter_slug, fork_a_slug, fork_b_slug],
                )
        async with pool.acquire() as con:
            left = await con.fetchval(
                "SELECT count(*) FROM workflow_definitions WHERE slug = ANY($1::text[])",
                [starter_slug, fork_a_slug, fork_b_slug],
            )
        assert left == 0, "test left rows in the local DB"
    finally:
        await pool.close()

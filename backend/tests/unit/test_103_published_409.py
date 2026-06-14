"""Phase 103 (REQ-1 / WFAUTH-01) — published-row mutation -> HTTP 409, no mutation.

Wave 0 (Plan 01 Task 1) authors the stubs; **Plan 01 Task 3** fills them. The
not-yet-built route behaviors are ``@pytest.mark.xfail(strict=False)`` until then so
the Wave-0 suite exits 0.

T-103-01-02 (Tampering): the DB immutability trigger
``workflow_definitions_block_published`` raises Postgres 23514 on a published-row
UPDATE/DELETE; the route catches ``asyncpg.exceptions.CheckViolationError`` -> HTTP
409, never a silent overwrite or a 500. The re-read after the 409 must show the
published row's ``definition`` JSONB UNCHANGED.

Live :54322 via psycopg2 / asyncpg (module-level skip-guard).
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
    reason=f"Local Postgres on {_DSN} not reachable; skipping live published-row-409 tests",
)


def _published_definition(slug: str) -> dict:
    return {
        "slug": slug,
        "version": 1,
        "name": "Published Lock Test",
        "status": "published",
        "phases": [
            {
                "slug": "answer",
                "phase_index": 0,
                "config": {"phase_type": "llm_single", "prompt": "Answer."},
                "validators": [],
            }
        ],
    }


# ── Plan 01 Task 3 fills these (route-level 23514 -> 409) ─────────────────────
@pytest.mark.xfail(reason="Plan 01 Task 3 wires the PATCH 23514->409 mapping", strict=False)
@pytest.mark.asyncio
async def test_patch_published_row_maps_to_409_and_no_mutation():
    """A PATCH against a published row -> asyncpg CheckViolationError (23514) ->
    HTTP 409; the re-read shows the published ``definition`` UNCHANGED."""
    import asyncpg
    from fastapi import HTTPException

    from app.api import workflows as wf_api
    from app.models.harness import WorkflowDefinition

    pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=1)
    try:
        async with pool.acquire() as con:
            owner = await con.fetchval("SELECT id FROM auth.users ORDER BY id LIMIT 1")
        slug = f"pub-409-patch-{os.getpid()}"
        body = _published_definition(slug)
        async with pool.acquire() as con:
            def_id = await con.fetchval(
                "INSERT INTO workflow_definitions (slug, version, name, status, definition, created_by, is_global) "
                "VALUES ($1, 1, $2, 'published', $3::jsonb, $4, false) RETURNING id",
                slug, body["name"], __import__("json").dumps(body), owner,
            )
        try:
            patched = dict(body)
            patched["name"] = "Tampered"
            with pytest.raises(HTTPException) as exc:
                await wf_api.update_draft(
                    definition_id=def_id,
                    body=WorkflowDefinition.model_validate(patched),
                    current_user={"id": str(owner)},
                )
            assert exc.value.status_code == 409
            async with pool.acquire() as con:
                after = await con.fetchval(
                    "SELECT definition->>'name' FROM workflow_definitions WHERE id = $1", def_id
                )
            assert after == "Published Lock Test"  # UNCHANGED
        finally:
            async with pool.acquire() as con:
                await con.execute("DELETE FROM workflow_definitions WHERE id = $1", def_id)
    finally:
        await pool.close()


@pytest.mark.xfail(reason="Plan 01 Task 3 wires the DELETE 23514->409 mapping", strict=False)
@pytest.mark.asyncio
async def test_delete_published_row_maps_to_409_and_row_survives():
    """A DELETE against a published row -> 409; the row still exists afterward."""
    import asyncpg
    from fastapi import HTTPException

    from app.api import workflows as wf_api

    pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=1)
    try:
        async with pool.acquire() as con:
            owner = await con.fetchval("SELECT id FROM auth.users ORDER BY id LIMIT 1")
        slug = f"pub-409-del-{os.getpid()}"
        body = _published_definition(slug)
        async with pool.acquire() as con:
            def_id = await con.fetchval(
                "INSERT INTO workflow_definitions (slug, version, name, status, definition, created_by, is_global) "
                "VALUES ($1, 1, $2, 'published', $3::jsonb, $4, false) RETURNING id",
                slug, body["name"], __import__("json").dumps(body), owner,
            )
        try:
            with pytest.raises(HTTPException) as exc:
                await wf_api.delete_draft(
                    definition_id=def_id,
                    current_user={"id": str(owner)},
                )
            assert exc.value.status_code == 409
            async with pool.acquire() as con:
                still = await con.fetchval(
                    "SELECT count(*) FROM workflow_definitions WHERE id = $1", def_id
                )
            assert still == 1  # the published row survives
        finally:
            async with pool.acquire() as con:
                await con.execute("DELETE FROM workflow_definitions WHERE id = $1", def_id)
    finally:
        await pool.close()

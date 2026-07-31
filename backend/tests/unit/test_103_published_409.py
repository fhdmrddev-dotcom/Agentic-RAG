"""Phase 103 (REQ-1 / WFAUTH-01) — published-row mutation -> HTTP 409, no mutation.

Wave 0 (Plan 01 Task 1) authors the stubs; **Plan 01 Task 3** fills them. The
not-yet-built route behaviors are ``@pytest.mark.xfail(strict=False)`` until then so
the Wave-0 suite exits 0.

T-103-01-02 (Tampering): the DB immutability trigger
``workflow_definitions_block_published`` raises Postgres 23514 on a published-row
UPDATE/DELETE; the route catches ``asyncpg.exceptions.CheckViolationError`` -> HTTP
409, never a silent overwrite or a 500. The re-read after the 409 must show the
published row's ``definition`` JSONB UNCHANGED.

PHASE 186 (F4 / D-186-09) — EXTENDED, NEVER REPLACED. Two things changed and both are
asserted below: (1) a published-row PATCH now answers **409 already_published** instead
of 404, because the route disambiguates a 0-row write with an owner-scoped probe rather
than collapsing it to "not found"; (2) the PATCH 409's detail is an OBJECT carrying
``code``, so the client stops matching prose. The shipped SENTENCE is byte-identical, the
DELETE 409 stays a bare string on purpose, and the no-mutation assertions — the actual
security outcome — are untouched.

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


# ── The published-row freeze, proven TWO ways (T-103-01-02) ───────────────────
# 1) The owner's published row is IMMUTABLE through the draft routes: the DB fn's
#    ``status='draft'`` WHERE guard means a published-row PATCH/DELETE matches 0 rows
#    -> None/False -> 404, and the row is verifiably UNCHANGED (proven LIVE against
#    :54322 — the ground-truth security outcome: a published workflow cannot be
#    mutated via the draft API).
# 2) The route's 23514 -> 409 mapping is correct: if the immutability trigger DOES
#    fire (the TOCTOU race the ``status='draft'`` guard normally prevents — a draft
#    flips to published between the WHERE eval and the write), the route catches
#    ``asyncpg.exceptions.CheckViolationError`` and maps it to HTTP 409, never a 500
#    or a silent overwrite (the explicit key_links / threat-model contract). Driven
#    by patching the DB fn to raise the real CheckViolationError.


@pytest.mark.asyncio
async def test_patch_published_row_is_immutable_via_route_409_and_no_mutation():
    """LIVE: a PATCH against the OWNER's published row matches 0 draft rows and the
    published ``definition`` is UNCHANGED (the published-row freeze — the draft routes
    can never mutate a published workflow).

    PHASE 186 (F4 / D-186-09) — THE STATUS MOVED, THE FREEZE DID NOT. Before 186 the
    0-row write collapsed to ``None`` -> 404. Now the route runs an OWNER-SCOPED probe to
    name the real cause, finds ``status='published'``, and answers **409
    ``already_published``** — the same sentence the publish route has always used, now
    object-shaped so the client branches on a code instead of matching prose. The
    load-bearing assertion is unchanged and still below: the row did not move.
    """
    import asyncpg
    from fastapi import HTTPException

    from app.api import workflows as wf_api
    from app.models.harness import WorkflowDefinition

    pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=1)
    try:
        async with pool.acquire() as con:
            owner = await con.fetchval("SELECT id FROM auth.users ORDER BY id LIMIT 1")
        slug = f"pub-freeze-patch-{os.getpid()}"
        body = _published_definition(slug)
        async with pool.acquire() as con:
            def_id = await con.fetchval(
                "INSERT INTO workflow_definitions (slug, version, name, status, definition, created_by, is_system_global) "
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
            # The draft-only guard refuses the published row -> 409 (no mutation):
            assert exc.value.status_code == 409
            # F4: object-shaped, machine-readable, and the shipped sentence intact.
            assert isinstance(exc.value.detail, dict)
            assert exc.value.detail["code"] == "already_published"
            assert (
                exc.value.detail["message"]
                == "workflow is published and cannot be modified"
            )
            # A published refusal carries NO token — there is nothing to retry against.
            assert "token" not in exc.value.detail
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


@pytest.mark.asyncio
async def test_delete_published_row_is_immutable_via_route_404_and_row_survives():
    """LIVE: a DELETE against the OWNER's published row matches 0 draft rows -> 404,
    and the row still exists afterward (the published-row freeze)."""
    import asyncpg
    from fastapi import HTTPException

    from app.api import workflows as wf_api

    pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=1)
    try:
        async with pool.acquire() as con:
            owner = await con.fetchval("SELECT id FROM auth.users ORDER BY id LIMIT 1")
        slug = f"pub-freeze-del-{os.getpid()}"
        body = _published_definition(slug)
        async with pool.acquire() as con:
            def_id = await con.fetchval(
                "INSERT INTO workflow_definitions (slug, version, name, status, definition, created_by, is_system_global) "
                "VALUES ($1, 1, $2, 'published', $3::jsonb, $4, false) RETURNING id",
                slug, body["name"], __import__("json").dumps(body), owner,
            )
        try:
            with pytest.raises(HTTPException) as exc:
                await wf_api.delete_draft(
                    definition_id=def_id,
                    current_user={"id": str(owner)},
                )
            assert exc.value.status_code == 404  # draft-only guard refuses
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


@pytest.mark.asyncio
async def test_patch_route_maps_check_violation_to_409():
    """T-103-01-02 / key_links: when the immutability trigger fires (the TOCTOU race
    the draft guard normally prevents), the PATCH route catches the real asyncpg
    ``CheckViolationError`` (23514) and maps it to HTTP 409 — never a 500 or a silent
    overwrite. Driven by patching the DB fn to raise the genuine error."""
    from unittest.mock import AsyncMock, patch

    import asyncpg
    from fastapi import HTTPException

    from app.api import workflows as wf_api
    from app.models.harness import WorkflowDefinition

    # The genuine asyncpg error the trigger raises (sqlstate 23514):
    violation = asyncpg.exceptions.CheckViolationError("workflow_definitions_block_published")

    body = WorkflowDefinition.model_validate(_published_definition("toctou-patch"))
    with (
        patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=AsyncMock())),
        patch(
            "app.api.workflows.update_workflow_definition",
            AsyncMock(side_effect=violation),
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            await wf_api.update_draft(
                definition_id=__import__("uuid").uuid4(),
                body=body,
                current_user={"id": str(__import__("uuid").uuid4())},
            )
    assert exc.value.status_code == 409  # 23514 -> 409
    # F4 (Phase 186): the race backstop answers with the SAME object shape as the
    # ``already_published`` cause — one concept, one body, so the client never has to
    # know which of the two paths produced it.
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail["code"] == "already_published"
    assert exc.value.detail["message"] == "workflow is published and cannot be modified"


@pytest.mark.asyncio
async def test_delete_route_maps_check_violation_to_409():
    """T-103-01-02 / key_links: the DELETE route maps a genuine CheckViolationError
    (23514) to HTTP 409 (the trigger-fires / race path)."""
    from unittest.mock import AsyncMock, patch

    import asyncpg
    from fastapi import HTTPException

    from app.api import workflows as wf_api

    violation = asyncpg.exceptions.CheckViolationError("workflow_definitions_block_published")
    with (
        patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=AsyncMock())),
        patch(
            "app.api.workflows.delete_workflow_definition",
            AsyncMock(side_effect=violation),
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            await wf_api.delete_draft(
                definition_id=__import__("uuid").uuid4(),
                current_user={"id": str(__import__("uuid").uuid4())},
            )
    assert exc.value.status_code == 409  # 23514 -> 409
    # Phase 186: the DELETE 409 keeps its BARE STRING detail, deliberately — a delete is
    # not on the autosave path and has no stale-vs-published ambiguity to resolve. Pinned
    # so the asymmetry with the PATCH 409 above reads as a decision, not as drift.
    assert isinstance(exc.value.detail, str)
    assert exc.value.detail == "workflow is published and cannot be modified"

"""Phase 186 (CONCUR-01 / CONCUR-02) — the draft PATCH clobber guard, falsified first.

Wave 0 of Plan 186-01. These four tests are authored and observed **RED** BEFORE the
guard exists, then GREEN after Tasks 2-3. They are named for the PROPERTY they defend,
not for the patch that satisfies them:

  F1  a stale writer is refused AND the winner's row content survives unchanged
  F2  a stale token is 409 ``stale_token`` — NEVER 404 (D-186-09)
  F3  a foreign id and an unknown id are the SAME, code-less 404 (the 404-collapse)
  F13 autosave never mints a version (CONCUR-01)

THE RED SURFACES AT RUNTIME, NOT AT COLLECTION (the shipped convention —
``test_workflows_routes.py:18-19``): ``update_draft`` has no ``if_match`` parameter yet,
so each test raises ``TypeError: got an unexpected keyword argument 'if_match'`` while
``--collect-only`` stays clean.

Live :54322 (asyncpg for the work, psycopg2 for the module-level reachability probe).
CONVENTION (Phase 102 posture): imports INSIDE the test bodies; the DB connect is guarded,
so this file SKIPS cleanly when the local stack is down — it never fails for want of a DB.

THE TOKEN IS A ``str`` AND NOTHING ELSE (D-186-07). No test in this file parses it into a
``datetime``; it is read from one response and echoed verbatim into the next request. That
is the whole contract the client (186-03/186-06) is written against.
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
    reason=f"Local Postgres on {_DSN} not reachable; skipping live concurrent-PATCH tests",
)


def _draft_definition(slug: str, name: str = "Concurrency Test") -> dict:
    """A single-phase llm_single draft definition body (lint-clean).

    Mirrors ``test_103_draft_crud.py:48-64`` — the shipped fixture builder for this
    family. ``name`` is a parameter because F1 asserts on the SURVIVING name, so each
    writer needs its own.
    """
    return {
        "slug": slug,
        "version": 1,
        "name": name,
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


async def _two_owners(con):
    """Return two DISTINCT ``auth.users`` ids (owner + a second user), or skip.

    The asyncpg form of ``test_103_draft_crud.py:67-73``. F3's 404-collapse row needs a
    genuinely foreign owner — a mocked id would not exercise the ``created_by = $2``
    conjunct against a real row.
    """
    rows = await con.fetch("SELECT id FROM auth.users ORDER BY id LIMIT 2")
    if len(rows) < 2:
        pytest.skip("need >=2 auth.users rows on the local stack for the owner-scope test")
    return rows[0]["id"], rows[1]["id"]


# ── F1 ────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_stale_patch_is_refused_and_the_winners_content_survives():
    """CONCUR-02 / D-186-06: writer B holds a token that writer A has already invalidated.

    B's PATCH must be refused AND — the point of the test — the ROW must still carry A's
    content afterwards. A status-code-only assertion does not prove a clobber guard; it
    only proves an error was raised. The re-read is the evidence (the
    ``test_103_published_409.py:114-118`` precedent).
    """
    import asyncpg
    from fastapi import HTTPException
    from unittest.mock import AsyncMock, patch

    from app.api import workflows as wf_api
    from app.models.harness import WorkflowDefinition

    pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=1)
    try:
        async with pool.acquire() as con:
            owner = await con.fetchval("SELECT id FROM auth.users ORDER BY id LIMIT 1")
        slug = f"p186-stale-{os.getpid()}"
        current_user = {"id": str(owner)}
        try:
            with patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=pool)):
                created = await wf_api.create_draft(
                    body=WorkflowDefinition.model_validate(_draft_definition(slug)),
                    current_user=current_user,
                )
                def_id = created.id
                stale_token = created.token
                assert isinstance(stale_token, str) and stale_token != ""

                # Writer A wins the race with the token both tabs are holding.
                won = await wf_api.update_draft(
                    definition_id=def_id,
                    body=WorkflowDefinition.model_validate(
                        _draft_definition(slug, name="winner")
                    ),
                    current_user=current_user,
                    if_match=stale_token,
                )
                assert isinstance(won.token, str)
                assert won.token != stale_token  # the row moved; the old token is spent

                # Writer B still holds the pre-A token — this is the clobber attempt.
                with pytest.raises(HTTPException) as exc:
                    await wf_api.update_draft(
                        definition_id=def_id,
                        body=WorkflowDefinition.model_validate(
                            _draft_definition(slug, name="loser")
                        ),
                        current_user=current_user,
                        if_match=stale_token,
                    )
                assert exc.value.status_code == 409

            # THE ASSERTION THAT MATTERS: the winner's content is still on the row.
            async with pool.acquire() as con:
                surviving_column = await con.fetchval(
                    "SELECT name FROM workflow_definitions WHERE id = $1", def_id
                )
                surviving_jsonb = await con.fetchval(
                    "SELECT definition->>'name' FROM workflow_definitions WHERE id = $1",
                    def_id,
                )
            assert surviving_column == "winner"
            assert surviving_jsonb == "winner"
        finally:
            async with pool.acquire() as con:
                await con.execute("DELETE FROM workflow_definitions WHERE slug = $1", slug)
    finally:
        await pool.close()


# ── F2 ────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_a_stale_token_is_409_stale_token_never_404():
    """D-186-09: a stale token must NEVER surface as 404 "draft not found".

    Telling an author their own open draft does not exist is a lie, and it is the exact
    collision the token conjunct creates (0 rows -> ``None`` -> 404 under today's route).
    The refusal must name its cause with a MACHINE code — the client branches on ``code``,
    never on the prose — and must carry the CURRENT token so the D-186-08 "overwrite with
    what's on screen" escape hatch is one PATCH rather than a re-read plus a PATCH.
    """
    import asyncpg
    from fastapi import HTTPException
    from unittest.mock import AsyncMock, patch

    from app.api import workflows as wf_api
    from app.models.harness import WorkflowDefinition

    pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=1)
    try:
        async with pool.acquire() as con:
            owner = await con.fetchval("SELECT id FROM auth.users ORDER BY id LIMIT 1")
        slug = f"p186-code-{os.getpid()}"
        current_user = {"id": str(owner)}
        try:
            with patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=pool)):
                created = await wf_api.create_draft(
                    body=WorkflowDefinition.model_validate(_draft_definition(slug)),
                    current_user=current_user,
                )
                def_id = created.id
                stale_token = created.token

                # Move the row so the held token is genuinely stale.
                await wf_api.update_draft(
                    definition_id=def_id,
                    body=WorkflowDefinition.model_validate(
                        _draft_definition(slug, name="moved")
                    ),
                    current_user=current_user,
                    if_match=stale_token,
                )

                with pytest.raises(HTTPException) as exc:
                    await wf_api.update_draft(
                        definition_id=def_id,
                        body=WorkflowDefinition.model_validate(
                            _draft_definition(slug, name="stale writer")
                        ),
                        current_user=current_user,
                        if_match=stale_token,
                    )

            assert exc.value.status_code == 409  # NOT 404 — D-186-09
            detail = exc.value.detail
            assert isinstance(detail, dict)
            assert detail["code"] == "stale_token"
            # The CURRENT token rides along so Overwrite is one more PATCH. Safe to
            # disclose: the disambiguating re-read is owner-scoped, so the caller already
            # owns this row (T-186-01-04, accepted).
            assert isinstance(detail["token"], str)
            assert detail["token"] != ""
            assert detail["token"] != stale_token
        finally:
            async with pool.acquire() as con:
                await con.execute("DELETE FROM workflow_definitions WHERE slug = $1", slug)
    finally:
        await pool.close()


# ── F3 ────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_foreign_and_unknown_ids_are_the_same_404():
    """T-186-01-03: the 404-collapse stays closed once a third refusal cause exists.

    A draft owned by someone else and an id that never existed must be INDISTINGUISHABLE
    — same status, byte-identical detail. A 404 that grew a machine code (or a token, or
    a status) would be an existence oracle: it would let a caller enumerate other users'
    workflow ids by reading which flavour of refusal came back.
    """
    import uuid

    import asyncpg
    from fastapi import HTTPException
    from unittest.mock import AsyncMock, patch

    from app.api import workflows as wf_api
    from app.db.workflows import create_workflow_definition
    from app.models.harness import WorkflowDefinition

    pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=1)
    try:
        async with pool.acquire() as con:
            owner, other = await _two_owners(con)
        slug = f"p186-foreign-{os.getpid()}"
        try:
            # A real draft, owned by the OTHER user.
            foreign = await create_workflow_definition(
                pool,
                definition=WorkflowDefinition.model_validate(_draft_definition(slug)),
                user_id=other,
            )
            caller = {"id": str(owner)}
            body = WorkflowDefinition.model_validate(
                _draft_definition(slug, name="Tampered")
            )
            some_token = "2026-01-01T00:00:00.000000Z"

            with patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=pool)):
                with pytest.raises(HTTPException) as foreign_exc:
                    await wf_api.update_draft(
                        definition_id=foreign["id"],
                        body=body,
                        current_user=caller,
                        if_match=some_token,
                    )
                with pytest.raises(HTTPException) as unknown_exc:
                    await wf_api.update_draft(
                        definition_id=uuid.uuid4(),
                        body=body,
                        current_user=caller,
                        if_match=some_token,
                    )

            assert foreign_exc.value.status_code == 404
            assert unknown_exc.value.status_code == 404
            # Identical to EACH OTHER — that equality is the collapse.
            assert foreign_exc.value.detail == unknown_exc.value.detail
            # And a plain string: a dict detail would carry a code, i.e. an oracle.
            assert isinstance(foreign_exc.value.detail, str)
            assert isinstance(unknown_exc.value.detail, str)

            # The foreign row is untouched.
            async with pool.acquire() as con:
                after = await con.fetchval(
                    "SELECT name FROM workflow_definitions WHERE id = $1", foreign["id"]
                )
            assert after == "Concurrency Test"
        finally:
            async with pool.acquire() as con:
                await con.execute("DELETE FROM workflow_definitions WHERE slug = $1", slug)
    finally:
        await pool.close()


# ── F13 ───────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_autosave_never_mints_a_version():
    """CONCUR-01: N in-place autosaves leave ``version`` byte-identical.

    Autosave is about to turn one deliberate save into a save every second. If a PATCH
    ever minted a version it would also re-arm the golden-run gauntlet, which is the cost
    CONCUR-01 exists to forbid. Three chained saves, each carrying the token the previous
    one returned — the exact shape ``useDraftPersistence`` will drive.
    """
    import asyncpg
    from unittest.mock import AsyncMock, patch

    from app.api import workflows as wf_api
    from app.models.harness import WorkflowDefinition

    pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=1)
    try:
        async with pool.acquire() as con:
            owner = await con.fetchval("SELECT id FROM auth.users ORDER BY id LIMIT 1")
        slug = f"p186-noversion-{os.getpid()}"
        current_user = {"id": str(owner)}
        try:
            with patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=pool)):
                created = await wf_api.create_draft(
                    body=WorkflowDefinition.model_validate(_draft_definition(slug)),
                    current_user=current_user,
                )
                def_id = created.id
                created_version = created.version
                token = created.token

                versions = []
                tokens = []
                for beat in range(3):
                    result = await wf_api.update_draft(
                        definition_id=def_id,
                        body=WorkflowDefinition.model_validate(
                            _draft_definition(slug, name=f"autosave beat {beat}")
                        ),
                        current_user=current_user,
                        if_match=token,
                    )
                    versions.append(result.version)
                    tokens.append(result.token)
                    token = result.token  # chain — never re-read, never re-parse

            # No version was minted by any of the three writes.
            assert versions == [created_version, created_version, created_version]
            # The row itself agrees (the response is not the only witness).
            async with pool.acquire() as con:
                on_row = await con.fetchval(
                    "SELECT version FROM workflow_definitions WHERE id = $1", def_id
                )
            assert on_row == created_version
            # Each write DID move the token — otherwise the chain proves nothing.
            assert len(set(tokens)) == 3
            assert all(isinstance(t, str) for t in tokens)
        finally:
            async with pool.acquire() as con:
                await con.execute("DELETE FROM workflow_definitions WHERE slug = $1", slug)
    finally:
        await pool.close()

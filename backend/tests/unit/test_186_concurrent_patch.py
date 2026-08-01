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

WHICH TESTS SKIP WITHOUT POSTGRES — WR-06 residue. The skip is a property of the tests that
need a database, not of this file. F1/F2/F3/F13 open a real asyncpg pool and carry their own
``@pytest.mark.skipif``; **everything below the "DB-FREE" banner touches no database at all**
(``get_pg_pool`` and the db-layer function are both mocked) and therefore runs EVERYWHERE,
including a CI with no Postgres.

That matters because of what was missing. The client branches its ENTIRE conflict UX on
``detail["code"] == "stale_token"`` and ``detail["token"]`` (``api.ts:3459-3460``), and that
half is covered only against a MOCK. Until now the server half was gated behind a
module-level ``pytestmark``, so ``grep -rn "stale_token" backend/tests/`` matched exactly one
file and that file was entirely skipped wherever a local database was absent. The two halves
of one wire contract could therefore drift apart — ``cause`` renamed, ``detail`` flattened
back to a string, the ``token`` key dropped — with every suite staying green. A guard that
hides the invariant it defends is not a guard.

THE TOKEN IS A ``str`` AND NOTHING ELSE (D-186-07). No test in this file parses it into a
``datetime``; it is read from one response and echoed verbatim into the next request. That
is the whole contract the client (186-03/186-06) is written against. Every token in the
DB-free tests below is an OPAQUE SENTINEL (``T-NOW`` / ``T-OLD``) rather than a
timestamp-shaped literal, so nothing here can be cited as a promise that the token is
parseable (T-186-15-04).
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

#: ONE home for the skip sentence, so the per-test decorators cannot drift apart. Byte
#: identical to the module-level ``pytestmark`` reason it replaced (WR-06 residue), so the
#: skip report reads exactly as it did before.
_LIVE_DB_REASON = (
    f"Local Postgres on {_DSN} not reachable; skipping live concurrent-PATCH tests"
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
@pytest.mark.skipif(not PG_AVAILABLE, reason=_LIVE_DB_REASON)
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
@pytest.mark.skipif(not PG_AVAILABLE, reason=_LIVE_DB_REASON)
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
@pytest.mark.skipif(not PG_AVAILABLE, reason=_LIVE_DB_REASON)
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
@pytest.mark.skipif(not PG_AVAILABLE, reason=_LIVE_DB_REASON)
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


# ══════════════════════════════════════════════════════════════════════════════
# DB-FREE — the refusal WIRE SHAPE, asserted on a machine with no Postgres
# (WR-06 residue). Nothing below opens a pool, a socket or a transaction.
# ══════════════════════════════════════════════════════════════════════════════
#
# THE TOKENS HERE ARE OPAQUE SENTINELS ON PURPOSE. ``T-NOW`` and ``T-OLD`` are not
# timestamp-shaped, and that is the assertion these fixtures make by their SHAPE rather
# than by a line of code: D-186-07 says the token is an opaque string the client echoes
# and never parses, so a fixture written in ISO-8601 would quietly document a format
# nothing is entitled to rely on (T-186-15-04). The one timestamp-shaped literal in this
# file is F3's shipped ``some_token``, which predates this rule and is deliberately left
# alone — it is an input to a live 404 path that never reads it.


async def _refusal_from(db_result=None, db_raises=None):
    """Drive ``update_draft`` with the DB LAYER MOCKED and return the ``HTTPException``.

    ``get_pg_pool`` hands back an ``AsyncMock`` that is never asked to do anything real,
    and ``update_workflow_definition`` is replaced by the refusal under test — so this
    exercises exactly ONE thing, the route's ``cause`` -> HTTP mapping, which is the half
    of the contract that had no cover outside a live-DB run (WR-06 residue).

    ``db_raises`` takes the other arm: an exception raised BY the db call, which is how the
    published-row immutability trigger arrives at this route.
    """
    import uuid
    from unittest.mock import AsyncMock, patch

    from fastapi import HTTPException

    from app.api import workflows as wf_api
    from app.models.harness import WorkflowDefinition

    db = (
        AsyncMock(side_effect=db_raises)
        if db_raises is not None
        else AsyncMock(return_value=db_result)
    )
    with patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=AsyncMock())):
        with patch("app.api.workflows.update_workflow_definition", db):
            with pytest.raises(HTTPException) as exc:
                await wf_api.update_draft(
                    definition_id=uuid.uuid4(),
                    body=WorkflowDefinition.model_validate(_draft_definition("p186-wire")),
                    current_user={"id": str(uuid.uuid4())},
                    if_match="T-OLD",
                )
    return exc.value


@pytest.mark.asyncio
async def test_stale_token_reaches_the_wire_as_a_409_carrying_code_and_token():
    """D-186-09, without a database: the exact two keys the client branches on.

    ``useDraftPersistence`` raises its conflict banner off ``detail["code"] ==
    "stale_token"`` and adopts ``detail["token"]`` as the Overwrite precondition. Flatten
    this detail back to a string, rename the code, or drop the token key, and the client's
    whole conflict UX silently stops working while its own mock-backed tests stay green.
    """
    exc = await _refusal_from({"ok": False, "cause": "stale_token", "token": "T-NOW"})

    assert exc.status_code == 409  # NOT 404 — telling an author their own draft is gone
    detail = exc.detail
    assert isinstance(detail, dict)
    assert detail["code"] == "stale_token"
    # Carried VERBATIM from the db layer, so Overwrite is one more PATCH rather than a
    # re-read plus a PATCH (D-186-08). Disclosing it leaks nothing: the disambiguating
    # probe is owner-scoped, so the caller already owns this row (T-186-01-04, accepted).
    assert detail["token"] == "T-NOW"
    # A human-readable line EXISTS, and nothing in this file asserts its wording. That
    # asymmetry IS the D-186-09 rule: the code is the contract, the prose is for a log, and
    # a re-wording must never be able to break a client.
    assert isinstance(detail["message"], str)
    assert detail["message"] != ""
    # …and deliberately NO assertion about the token's SHAPE (T-186-15-03).


@pytest.mark.asyncio
async def test_already_published_reaches_the_wire_as_the_one_locked_409_detail():
    """The published-row refusal, asserted against the CONSTANT rather than a retyped
    literal — two spellings of one locked string is how a locked string stops being
    locked (the reason ``_ALREADY_PUBLISHED_DETAIL`` exists at all)."""
    from app.api import workflows as wf_api

    exc = await _refusal_from({"ok": False, "cause": "already_published"})

    assert exc.status_code == 409
    assert exc.detail == wf_api._ALREADY_PUBLISHED_DETAIL
    assert exc.detail["code"] == "already_published"


@pytest.mark.asyncio
async def test_not_found_and_an_unrecognised_cause_are_the_same_codeless_404():
    """T-186-01-03 / T-186-15-02: the 404-collapse, and its FAIL-CLOSED property.

    ``not_found`` is the dullest answer this route has, and it must stay that way for any
    cause the route does not recognise. The route's own comment claims exactly this — "a
    new refusal cause must be mapped deliberately" — and nothing checked it. A cause minted
    later in the db layer that arrived at the wire as a CODED 404 would be an existence
    oracle: it would let a caller tell "no such workflow" from "someone else's workflow".

    Asserted as an EQUALITY between the two details, because "both are 404" is satisfied by
    two different-looking 404s and the collapse is about indistinguishability.
    """
    missing = await _refusal_from({"ok": False, "cause": "not_found"})
    minted = await _refusal_from(
        {"ok": False, "cause": "cause_minted_after_this_test_shipped"}
    )

    assert missing.status_code == 404
    assert minted.status_code == 404
    # Byte-identical to EACH OTHER — that equality is the collapse.
    assert missing.detail == minted.detail
    # And plain strings: a dict detail is where a machine code would live, i.e. the oracle.
    assert isinstance(missing.detail, str)
    assert isinstance(minted.detail, str)
    assert "code" not in missing.detail
    assert "token" not in missing.detail


@pytest.mark.asyncio
async def test_a_published_row_check_violation_is_the_same_409_as_already_published():
    """T-103-01-02 / T-186-01-06 — the race arm, which also had no DB-free cover.

    The ``status='draft'`` conjunct usually pre-empts the immutability trigger, but not
    when the PATCH loses a race with a concurrent publish; then Postgres ``23514`` reaches
    this route as a ``CheckViolationError``. It must land on the SAME refusal object as the
    ordinary ``already_published`` cause — one object for one meaning — so the client
    branches on ``code`` in both cases rather than meeting a 500.
    """
    import asyncpg

    from app.api import workflows as wf_api

    exc = await _refusal_from(
        db_raises=asyncpg.exceptions.CheckViolationError(
            "workflow_definitions_block_published"
        )
    )

    assert exc.status_code == 409
    assert exc.detail == wf_api._ALREADY_PUBLISHED_DETAIL


# ══════════════════════════════════════════════════════════════════════════════
# DB-FREE — the DB TIER: where the three causes are DISAMBIGUATED, and the
# token's text-space contract. Driven through a mocked ``pool.fetchrow``, so the
# refusal that the route above maps is itself checkable with no Postgres.
# ══════════════════════════════════════════════════════════════════════════════


def _mock_pool(*fetchrow_results):
    """A pool whose ``fetchrow`` yields the given results in order.

    The F6 idiom from ``test_186_publish_race.py``: every boundary patched, nothing real
    behind it. ``update_workflow_definition`` makes at most TWO ``fetchrow`` calls — the
    guarded UPDATE, then the owner-scoped probe — so the tuple reads as the two branches.
    Rows are plain dicts because the function only ever does ``dict(row)`` and
    ``probe["status"]``, both of which a dict satisfies exactly.
    """
    from unittest.mock import AsyncMock

    pool = AsyncMock()
    pool.fetchrow = AsyncMock(side_effect=list(fetchrow_results))
    return pool


def _definition():
    from app.models.harness import WorkflowDefinition

    return WorkflowDefinition.model_validate(_draft_definition("p186-dbtier"))


@pytest.mark.asyncio
async def test_a_matching_update_returns_ok_and_never_runs_the_probe():
    """The happy path stays ONE statement (D-186-09).

    The disambiguating probe is a FAILURE-PATH cost. Autosave turns one deliberate save
    into a save every second, so a second round trip on every successful beat is a real
    price — and a refactor that hoisted the probe would not change any behaviour, only the
    cost, which is exactly the kind of regression no behavioural test would catch.
    """
    import uuid

    from app.db.workflows import update_workflow_definition

    def_id, user_id = uuid.uuid4(), uuid.uuid4()
    pool = _mock_pool({"id": def_id, "version": 1, "token": "T-NOW"})

    result = await update_workflow_definition(
        pool, def_id, definition=_definition(), user_id=user_id, token="T-OLD"
    )

    assert result == {"ok": True, "id": def_id, "version": 1, "token": "T-NOW"}
    assert pool.fetchrow.await_count == 1


@pytest.mark.asyncio
async def test_zero_rows_and_no_owned_row_is_not_found():
    """Missing OR not-owned — the probe is owner-scoped, so both look identical here, and
    that is the whole point: they must collapse to ONE 404 at the route (T-186-01-03)."""
    import uuid

    from app.db.workflows import update_workflow_definition

    pool = _mock_pool(None, None)

    result = await update_workflow_definition(
        pool, uuid.uuid4(), definition=_definition(), user_id=uuid.uuid4(), token="T-OLD"
    )

    assert result == {"ok": False, "cause": "not_found"}
    assert pool.fetchrow.await_count == 2  # the probe DID run — the 0-row path


@pytest.mark.asyncio
async def test_zero_rows_against_a_published_row_is_already_published():
    """The ``status='draft'`` conjunct made this a 0-row no-op; the probe names why."""
    import uuid

    from app.db.workflows import update_workflow_definition

    pool = _mock_pool(None, {"status": "published", "token": "T-NOW"})

    result = await update_workflow_definition(
        pool, uuid.uuid4(), definition=_definition(), user_id=uuid.uuid4(), token="T-OLD"
    )

    assert result == {"ok": False, "cause": "already_published"}


@pytest.mark.asyncio
async def test_a_tokenless_call_can_never_produce_a_stale_token():
    """The DEFENSIVE COLLAPSE, which is the one branch with no live-DB cover at all.

    An unguarded UPDATE cannot match 0 rows on an owned draft, so this branch is meant to
    be unreachable — which is precisely why it can rot unnoticed. If it ever returned
    ``stale_token`` the route would raise a 409 with a token attached for a request that
    carried NO precondition, telling a caller their draft moved under them on a write that
    never asked about the draft's state.

    It also pins the TWO-STATEMENT shape: with no token the conjunct is ABSENT from the
    WHERE rather than OR'd away, because an OR'd-away guard is one refactor from being
    permanently disabled and reads as guarded when it is not.
    """
    import uuid

    from app.db.workflows import CONCURRENCY_TOKEN_SQL, update_workflow_definition

    pool = _mock_pool(None, {"status": "draft", "token": "T-NOW"})

    result = await update_workflow_definition(
        pool, uuid.uuid4(), definition=_definition(), user_id=uuid.uuid4(), token=None
    )

    assert result == {"ok": False, "cause": "not_found"}
    unguarded_sql = pool.fetchrow.await_args_list[0].args[0]
    where_clause = unguarded_sql.split("RETURNING")[0]
    assert CONCURRENCY_TOKEN_SQL not in where_clause
    # …and no token was bound at all: five positional args, not six.
    assert len(pool.fetchrow.await_args_list[0].args) == 5


@pytest.mark.asyncio
async def test_the_token_is_a_third_conjunct_and_every_bind_travels_as_text():
    """The two SQL properties the verification report established BY READING, pinned so
    they survive without a reader.

    1. T-186-01-01 — the token clause is a THIRD conjunct, added alongside ``created_by =
       $2`` and never in place of it. ``created_by`` is the ONLY authorization boundary on
       this table for the service-role pool (it bypasses RLS), so a refactor that swapped
       the owner scope for the token would turn a concurrency check into the authorization
       check, and a forger holding a valid token would reach somebody else's draft.
       The owner scope is asserted on the PROBE too (T-186-01-02): a probe without it would
       answer "that row exists but isn't yours", which is the existence leak the
       404-collapse closes.

    2. D-186-07 — every token crosses the boundary as a ``str``, never a ``datetime``.
       Live-probed and not negotiable: asyncpg REFUSES a ``str`` bind against a
       ``timestamptz``, and a parsed-and-re-rendered token loses Postgres microseconds, so
       a truncated token matches zero rows. Comparison happens in TEXT space through the
       single ``CONCURRENCY_TOKEN_SQL`` rendering — this is the server-side sibling of the
       client's F15 source fence, which forbids parsing on the other end of the same wire.
    """
    import uuid
    from datetime import datetime

    from app.db.workflows import CONCURRENCY_TOKEN_SQL, update_workflow_definition

    pool = _mock_pool(None, {"status": "draft", "token": "T-NOW"})

    result = await update_workflow_definition(
        pool, uuid.uuid4(), definition=_definition(), user_id=uuid.uuid4(), token="T-OLD"
    )

    # The probe's token is carried through VERBATIM — the route hands it to the client as
    # the Overwrite precondition, so a re-render here would break D-186-08's one-PATCH exit.
    assert result == {"ok": False, "cause": "stale_token", "token": "T-NOW"}

    guarded_sql = pool.fetchrow.await_args_list[0].args[0]
    probe_sql = pool.fetchrow.await_args_list[1].args[0]

    assert "created_by = $2" in guarded_sql
    assert "status = 'draft'" in guarded_sql
    assert f"AND {CONCURRENCY_TOKEN_SQL} = $5" in guarded_sql
    assert f"RETURNING id, version, {CONCURRENCY_TOKEN_SQL} AS token" in guarded_sql
    assert "created_by = $2" in probe_sql
    assert CONCURRENCY_TOKEN_SQL in probe_sql

    # The token really is the $5 bind, and it went as the opaque string it arrived as.
    assert pool.fetchrow.await_args_list[0].args[5] == "T-OLD"
    for call_ in pool.fetchrow.await_args_list:
        for bind in call_.args[1:]:
            assert not isinstance(bind, datetime)

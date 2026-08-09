"""Phase 186 (CONCUR-02 / D-186-10) — the publish race, falsified first.

Wave 0 of Plan 186-02. ``publish_service`` loads the definition at stage 0, spends
minutes on a golden run and a judge, then flips at stage 5 guarded on ``status='draft'``
**only**. Once autosave exists (186-06) an edit landing mid-gauntlet publishes a
definition that never passed the gauntlet. WR-03's ``-1`` is the double-publish guard,
not a dirty-draft guard.

These four tests are named for the PROPERTY they defend, not for the patch that
satisfies them:

  F5   a draft that MOVED between stage 0 and stage 5 is refused at the flip, and the
       row is still a draft afterwards
  F5b  the two sentinels are DISTINGUISHABLE — ``-1`` ("someone already published this")
       is not ``-2`` ("the thing we spent a golden run checking is not the thing we were
       about to publish"). Collapsing them would file a receipt for something that did
       not happen (the T-185-04-01 rule).
  F5c  a token-FREE call keeps today's unguarded flip, byte-identical. This is the
       CONTROL, not a falsification guard: it is expected to pass BEFORE and AFTER, and
       it is what keeps ``test_103_tweak_fork.py:89,101`` — which calls
       ``publish_definition`` positionally with no token — green with zero edits.
  F6   the golden run and its ``harness_audit`` rows SURVIVE a ``draft_changed``
       refusal. ``_block`` only ADDS a ``publish_blocked`` receipt; it deletes nothing.

THE RED SURFACES AT RUNTIME, NOT AT COLLECTION (the shipped convention —
``test_workflows_routes.py:18-19``): ``publish_definition`` has no ``token`` keyword yet,
so F5/F5b raise ``TypeError: got an unexpected keyword argument 'token'`` while
``--collect-only`` stays clean. F6's RED is different and worth naming: with the flip
mocked to ``-2`` and no ``-2`` branch in the service, the sentinel falls straight through
the ``version == -1`` check into the success path and the service returns
``{published: True, version: -2}`` plus a FALSE ``publish_succeeded`` governance row.

Live :54322 (asyncpg for the work, psycopg2 for the module-level reachability probe).
CONVENTION (Phase 102 posture): imports INSIDE the test bodies; the DB connect is guarded,
so nothing here ever FAILS for want of a database.

WHICH TESTS SKIP WITHOUT POSTGRES — WR-06. The skip is a property of the tests that need a
database, not of this file. F5/F5b/F5c open a real asyncpg pool and carry their own
``@pytest.mark.skipif``; **F6 touches no database at all** (``pool=AsyncMock()``, every
boundary patched) and therefore runs EVERYWHERE, including a CI with no Postgres. That
matters because F6 is the only automated proof of this phase's headline backend invariant —
a ``-2`` sentinel becomes a ``draft_changed`` refusal instead of ``{published: True,
version: -2}`` plus a false ``publish_succeeded`` receipt. Until WR-06 a module-level
``pytestmark`` gated F6 too, so the invariant was absent wherever the local stack was down
and could regress under a green suite: a guard that hides the invariant it defends is not a
guard.

THE TOKEN IS A ``str`` AND NOTHING ELSE (D-186-07). No test here parses it into a
``datetime``; it is read from one call and echoed verbatim into the next.
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
#: identical to the module-level ``pytestmark`` reason it replaced (WR-06), so the skip
#: report reads exactly as it did before.
_LIVE_DB_REASON = f"Local Postgres on {_DSN} not reachable; skipping live publish-race tests"


def _draft_definition(slug: str, name: str = "Publish Race Test") -> dict:
    """A single-phase llm_single draft definition body (lint-clean).

    Mirrors ``test_103_draft_crud.py:48-64`` — the shipped fixture builder for this
    family. ``name`` is a parameter because F5 moves the row by changing it.
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


# ── F5 ────────────────────────────────────────────────────────────────────────
@pytest.mark.skipif(not PG_AVAILABLE, reason=_LIVE_DB_REASON)
@pytest.mark.asyncio
async def test_a_draft_that_moved_is_refused_at_the_flip():
    """D-186-10: the flip is guarded on the STAGE-0 token, so a draft edited mid-gauntlet
    is refused rather than published.

    The direct ``UPDATE ... SET name`` stands in for the autosave PATCH that 186-06 will
    make routine: it is a separate autocommit statement, so the ``set_updated_at`` trigger
    (migration 056) moves ``updated_at`` and the stage-0 token is genuinely spent.

    Two assertions, and the second is the one that matters: the SENTINEL says the flip was
    refused, and the ROW proves nothing was published. A sentinel-only assertion would pass
    against a guard that returned ``-2`` *after* flipping.
    """
    import asyncpg

    from app.db.workflows import create_workflow_definition, publish_definition
    from app.models.harness import WorkflowDefinition

    pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=1)
    slug = f"p186-race-moved-{os.getpid()}"
    try:
        async with pool.acquire() as con:
            owner = await con.fetchval("SELECT id FROM auth.users ORDER BY id LIMIT 1")
        try:
            created = await create_workflow_definition(
                pool,
                definition=WorkflowDefinition.model_validate(_draft_definition(slug)),
                user_id=owner,
            )
            def_id = created["id"]
            stage0_token = created["token"]  # the draft AS IT WAS WHEN WE STARTED CHECKING
            assert isinstance(stage0_token, str) and stage0_token != ""

            # The mid-gauntlet edit. One statement, autocommit — the token moves.
            await pool.execute(
                "UPDATE workflow_definitions SET name = $2 WHERE id = $1",
                def_id,
                "edited while the gauntlet was running",
            )

            version = await publish_definition(pool, def_id, token=stage0_token)
            assert version == -2, "a moved draft must return the draft_changed sentinel"

            async with pool.acquire() as con:
                status_after = await con.fetchval(
                    "SELECT status FROM workflow_definitions WHERE id = $1", def_id
                )
            assert status_after == "draft", "the refused flip must not have published the row"
        finally:
            async with pool.acquire() as con:
                await con.execute("DELETE FROM workflow_definitions WHERE slug = $1", slug)
    finally:
        await pool.close()


# ── F5b ───────────────────────────────────────────────────────────────────────
@pytest.mark.skipif(not PG_AVAILABLE, reason=_LIVE_DB_REASON)
@pytest.mark.asyncio
async def test_the_two_sentinels_are_distinguishable():
    """T-186-02-01: ``-1`` and ``-2`` are two different sentences and two different receipts.

    An already-published row is not a moved draft. If the token miss collapsed onto ``-1``
    the service would file an ``already_published`` receipt and tell the author somebody
    else published their workflow — a receipt for an event that did not occur. This test
    publishes for real (with a CURRENT token, so the guarded path is the one exercised) and
    then re-flips, asserting the WR-03 sentinel is still exactly ``-1``.
    """
    import asyncpg

    from app.db.workflows import (
        create_workflow_definition,
        get_definition,
        publish_definition,
    )
    from app.models.harness import WorkflowDefinition

    pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=1)
    slug = f"p186-race-sentinels-{os.getpid()}"
    try:
        async with pool.acquire() as con:
            owner = await con.fetchval("SELECT id FROM auth.users ORDER BY id LIMIT 1")
        try:
            created = await create_workflow_definition(
                pool,
                definition=WorkflowDefinition.model_validate(_draft_definition(slug)),
                user_id=owner,
            )
            def_id = created["id"]

            # A stage-0 read is where the real caller gets its token; use the same door.
            row = await get_definition(pool, def_id, user_id=owner)
            assert row is not None
            current_token = row["token"]

            version = await publish_definition(pool, def_id, token=current_token)
            assert version == 1, "a CURRENT token must not block the happy path"

            # The row is published now. Any token at all must give the WR-03 sentinel.
            again = await publish_definition(pool, def_id, token=current_token)
            assert again == -1, "an already-published row is -1, never the -2 draft_changed case"

            stale = await publish_definition(pool, def_id, token="2026-01-01T00:00:00.000000Z")
            assert stale == -1, "a published row is -1 regardless of which token was held"
        finally:
            async with pool.acquire() as con:
                await con.execute("DELETE FROM workflow_definitions WHERE slug = $1", slug)
    finally:
        await pool.close()


# ── F5c ───────────────────────────────────────────────────────────────────────
@pytest.mark.skipif(not PG_AVAILABLE, reason=_LIVE_DB_REASON)
@pytest.mark.asyncio
async def test_an_absent_token_keeps_todays_unguarded_flip():
    """The COMPATIBILITY control — expected GREEN before AND after, deliberately.

    ``token`` is an OPTIONAL keyword. With no token the query is byte-identical to today's
    (``WHERE id = $1 AND status = 'draft'``) and ``-2`` is unreachable. That is what keeps
    ``test_103_tweak_fork.py:89,101`` — which calls ``publish_definition`` POSITIONALLY with
    two arguments — passing with zero edits to that file. This test pins the compatibility
    decision so a later "tidy-up" that makes ``token`` required fails here rather than in a
    Phase-103 test whose subject is something else entirely.
    """
    import asyncpg

    from app.db.workflows import create_workflow_definition, publish_definition
    from app.models.harness import WorkflowDefinition

    pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=1)
    slug = f"p186-race-notoken-{os.getpid()}"
    try:
        async with pool.acquire() as con:
            owner = await con.fetchval("SELECT id FROM auth.users ORDER BY id LIMIT 1")
        try:
            created = await create_workflow_definition(
                pool,
                definition=WorkflowDefinition.model_validate(_draft_definition(slug)),
                user_id=owner,
            )
            def_id = created["id"]

            # POSITIONAL, two arguments — the shipped Phase-103 call shape.
            version = await publish_definition(pool, def_id)
            assert version == 1

            async with pool.acquire() as con:
                status_after = await con.fetchval(
                    "SELECT status FROM workflow_definitions WHERE id = $1", def_id
                )
            assert status_after == "published"
        finally:
            async with pool.acquire() as con:
                await con.execute("DELETE FROM workflow_definitions WHERE slug = $1", slug)
    finally:
        await pool.close()


# ── F6 ────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_the_golden_run_receipt_survives_a_draft_changed_refusal():
    """T-186-02-05 / D-186-10: the golden run really happened, so its record stays.

    Driven through ``publish_workflow`` with the shipped ``test_publish_service.py`` mocking
    idiom (the golden-run and judge BOUNDARIES are mocked; the pipeline is real). The flip
    returns ``-2``, and three things must hold:

      1. the verdict is an honest refusal — ``published is False``, ``draft_changed``;
      2. ``golden_run_id`` is the REAL run id, not ``None`` — the refusal is attributed to
         the run that was actually performed, so the receipt is browsable;
      3. the audit trail GREW. The ``publish_attempted`` and ``judge_verdict`` rows
         written before the flip are still there, in order and at the same indices, with a
         ``publish_blocked`` row appended AFTER them — and no ``publish_succeeded``.
         ``_block`` only ADDS. The whole ordered list is asserted rather than a membership
         check, because "the golden-run record survived" is a claim about what is STILL
         there, and a set/`in` assertion cannot tell a preserved row from a rewritten one.

    The row this test hands ``get_definition`` carries a ``token``, which the service must
    thread to ``publish_definition``; that call is asserted on directly, because a stage-0
    capture that never reaches stage 5 guards nothing.

    DELIBERATELY UNGUARDED (WR-06). This is the only test in the file with NO
    ``skipif(not PG_AVAILABLE)`` — it opens no connection, so there is nothing to guard.
    Adding one "for consistency" with its three live neighbours would delete this phase's
    headline invariant from every environment without a local database, which is the exact
    defect WR-06 recorded.
    """
    from unittest.mock import AsyncMock, patch
    from uuid import UUID, uuid4

    from app.services.harness import publish_service

    def_id = uuid4()
    user = {"id": str(uuid4())}
    golden_run_id = uuid4()
    stage0_token = "2026-08-01T12:00:00.123456Z"

    definition = {
        "slug": "race-test",
        "version": 1,
        "name": "Race Test Workflow",
        "status": "draft",
        "phases": [
            {
                "slug": "answer",
                "phase_index": 0,
                "config": {"phase_type": "llm_single", "prompt": "Answer the question."},
                "validators": [],
            }
        ],
        "business_requirement": "Deliver a cited answer.",
    }
    row = {
        "id": def_id,
        "slug": "race-test",
        "version": 1,
        "name": "Race Test Workflow",
        "status": "draft",
        "definition": definition,
        "created_by": UUID(user["id"]),
        "token": stage0_token,
    }
    good_verdict = {
        "overall_passed": True,
        "overall_score": 93,
        "summary": "Grounded, answers the requirement.",
        "criteria": [],
    }
    audit_events: list = []

    async def _capture_audit(pool, run_id, *, user_id, event_type, metadata):
        audit_events.append((event_type, metadata))

    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=row)),
        patch("app.db.workflows.write_audit", AsyncMock(side_effect=_capture_audit)),
        patch.object(
            publish_service, "_grounding_fidelity_failures", AsyncMock(return_value=[])
        ),
        patch.object(
            publish_service,
            "_drive_golden_run",
            AsyncMock(
                return_value=(golden_run_id, {"text": "a grounded answer [doc1]"}, "completed")
            ),
        ),
        patch.object(
            publish_service, "_judge_golden_output", AsyncMock(return_value=good_verdict)
        ),
        # The draft moved under the gauntlet: the token conjunct matched 0 rows, the row is
        # still an owned draft -> -2.
        patch("app.db.workflows.publish_definition", AsyncMock(return_value=-2)) as flip,
    ):
        result = await publish_service.publish(
            definition_id=def_id,
            golden_input="a representative kickoff prompt",
            user=user,
            pool=AsyncMock(),
            redis=AsyncMock(),
        )

    # 1. An honest refusal, not a false success receipt.
    assert result["published"] is False
    assert result.get("version") != -2  # never {published: True, version: -2}
    assert result["blocked_stage"] == "draft_changed"
    assert result["named_failures"]  # a business-plain sentence, not an empty list

    # 2. The golden run is PRESERVED as the real record of what was tested.
    assert result["golden_run_id"] == golden_run_id

    # The stage-0 token really reached stage 5 — otherwise the guard is decorative.
    flip.assert_awaited_once()
    assert flip.await_args.kwargs.get("token") == stage0_token

    # 3. The trail GREW; nothing was removed or rewritten.
    kinds = [event for event, _ in audit_events]
    assert kinds == ["publish_attempted", "judge_verdict", "publish_blocked"], kinds
    assert "publish_succeeded" not in kinds  # no false governance row
    blocked_metadata = audit_events[-1][1]
    assert blocked_metadata["blocked_stage"] == "draft_changed"
    # The receipt attributes the refusal to the run that really happened.
    assert blocked_metadata["golden_run_id"] == str(golden_run_id)

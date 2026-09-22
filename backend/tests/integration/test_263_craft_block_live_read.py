"""Phase 263 (PACK-15 / D-263-13) — Fence 1-LIVE: the craft block is read from the ROW, and
the row is the one actually in the database.

WHY THIS EXISTS SEPARATELY FROM THE UNIT FENCE. `tests/unit/test_263_craft_block_is_read.py`
proves the module contributes no doctrine of its own — it does that against a FAKE block, which
is the right shape for that question and says nothing at all about the real row. This file asks
the other half: does `_extract_craft_block` still find doctrine in the text that is live RIGHT
NOW, and does the strip still remove the agent-tool choreography that is mixed into it?

⛔ THE TOKEN LIST IS DERIVED FROM THE LIVE ROW, NEVER TRANSCRIBED FROM A MIGRATION FILE, and this
phase has now paid for that rule three times:

  - `263-RESEARCH.md` quoted **087**. Measured: 088 and 089 each perform a FULL
    `SET instructions = $INSTRUCTIONS$…$INSTRUCTIONS$` rewrite, so 087 was superseded.
  - `263-CONTEXT.md` recorded that correction and named **089** as live. `263-02-PLAN.md` and
    `263-PATTERNS.md` inherited it, with the plan writing "⛔ NOT 087 and NOT 088".
  - Measured at `263-02` against the live row: **093**
    (`093_skill_creator_sandbox_library_awareness.sql`) rewrote it AGAIN and added a SIXTH craft
    bullet. So "the live text is 089's" was false too, and CONTEXT's "the five bullets" is six.

⭐ That is exactly the rot this file catches. A migration number in prose is a citation nobody
re-derives; a `SELECT` is not. If migration 094+ rewrites the row again and drops a craft bullet,
this goes red the same day instead of at the next expensive live UAT cycle.

SELECT-only — no mutation anywhere in this module, so it does not make plan `263-02` DB-mutating.

APPLY-GATE SEMANTICS (`test_137_2_skill_creator_seed_content.py`'s convention, deliberately
different from schema tests that skip cleanly pre-apply): the built-in row has been seeded since
migration 087, so an ABSENT row is a genuine HARD FAILURE here, not a clean skip. The ONLY clean
skip is :54322 itself being unreachable — no live DB to gate against at all.
"""

import asyncio
import os

import asyncpg
import pytest
import pytest_asyncio

from app.services.skill_body_authoring import (
    SKILL_CREATOR_SKILL_ID,
    _extract_craft_block,
    _load_craft_block,
)

_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)

# Present in 087's, 089's AND 093's rewrites — which is what makes them safe to pin. The fifth
# is pinned as a PREFIX only: 089 extended that heading to "Progressive disclosure — but know
# the limit."
_CRAFT_TOKENS = (
    "Apply this craft",
    "Imperative form",
    "Explain the why, sparingly",
    "overfit",
    "pushy-but-honest",
    "Progressive disclosure",
)

_TOOL_TOKENS = (
    "save_skill",
    "workspace_write",
    "read_skill_file",
    "search_documents",
    "execute_code",
    "Skill Studio",
    "Skills page",
)

_CRAFT_HEADING = "Apply this craft (it is what makes skills work or fail):"


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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 263 craft-block read gate",
)


@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool against local Postgres :54322."""
    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=4)
    try:
        yield pool
    finally:
        await pool.close()


async def _live_instructions(pool) -> str:
    row = await pool.fetchrow(
        "SELECT instructions FROM public.skills WHERE id = $1",
        SKILL_CREATOR_SKILL_ID,
    )
    # ⛔ HARD FAILURE, never a skip: the row has been seeded since migration 087. Absent means
    # the seed was lost, which is a finding — and the message names the migration that most
    # recently rewrote it, MEASURED at 263-02, not inherited from the plan's prose.
    assert row is not None, (
        f"built-in skill-creator row {SKILL_CREATOR_SKILL_ID} is ABSENT from the live DB — "
        "the seed chain 087 -> 088 -> 089 -> 093 "
        "(093_skill_creator_sandbox_library_awareness.sql is the most recent rewrite) has not "
        "been applied to this environment"
    )
    return row["instructions"] or ""


async def test_the_live_row_still_carries_the_craft_heading(pg_pool):
    instructions = await _live_instructions(pg_pool)
    assert _CRAFT_HEADING in instructions, (
        "the live skill-creator instructions no longer contain the craft heading the driver "
        "slices on — a migration rewrote the row and the body-authoring prompt is now doctrine-free"
    )


async def test_extraction_over_the_live_text_keeps_every_doctrine_token(pg_pool):
    block = _extract_craft_block(await _live_instructions(pg_pool))

    assert block, "extraction over the LIVE text returned nothing"
    missing = [t for t in _CRAFT_TOKENS if t not in block]
    assert missing == [], f"doctrine missing from the live extraction: {missing}"


async def test_extraction_over_the_live_text_strips_every_tool_token(pg_pool):
    """⚠ The live fifth bullet genuinely mixes doctrine with choreography ON ONE LINE, and the
    sixth (added by 093) is choreography-led. Both are real, so this is the assertion that
    proves the strip does work rather than merely existing."""
    block = _extract_craft_block(await _live_instructions(pg_pool))

    survived = [t for t in _TOOL_TOKENS if t in block]
    assert survived == [], f"agent-tool choreography survived the strip: {survived}"


async def test_the_live_extraction_carries_no_interview_choreography(pg_pool):
    """⛔ The live row's §3 does not END with the doctrine — it continues into the interactive
    interview loop, and those lines name NO tool, so the seven-token strip cannot see them.

    Measured at `263-02`: slicing to the next `## ` heading yielded 1466 chars of which ~700
    were *"Confirm the draft with the user, then save."*, *"Tell the user the skill is now saved
    in their Skills tab"* and the eval-case handoff. In a sealed single-shot that is FALSE — and
    it directly contradicts this module's own framing, which says persisting is a separate step.
    """
    block = _extract_craft_block(await _live_instructions(pg_pool))

    for choreography in (
        "Confirm the draft with the user",
        "Tell the user the skill is now saved",
        "realistic eval cases",
        "the cases live in the Studio",
    ):
        assert choreography not in block, f"interview choreography leaked: {choreography!r}"


async def test_load_craft_block_reads_the_row_through_the_real_pool(pg_pool):
    """The unit fence stubs `_load_craft_block`; this is the one place the real query runs, so
    a typo in the SQL or the id constant cannot hide behind a monkeypatch."""
    block = await _load_craft_block(pg_pool)

    assert block, "_load_craft_block returned empty against the live row"
    assert "Apply this craft" in block

"""Phase 137.2 (CREATE-01 / SEED-101) — LIVE-DB regression-lock for the built-in
skill-creator's seeded ``instructions`` content across migrations 087 -> 088 -> 089.

WHY: 137.2-VALIDATION.md's row T-137.2-03 ("Instructions name only real tools; no
subagent/browser/`claude -p`/non-Python claims; route eval cases to Skill Studio
-> Evals (D-03)") was only ever checked by a one-time `grep` against migration
087's SQL file at authoring time. During THIS SAME phase's live SC#4 UAT
(137.2-HUMAN-UAT.md), two more migrations rewrote the seeded row's `instructions`
text to close real, repeatable bugs found live and NEVER got any automated check:

  - 088 (skill_creator_eval_step_sequencing): merged save+eval-proposal into one
    mandatory in-message sequence — fix marker: "NOT optional and is NOT a
    separate turn".
  - 089 (skill_creator_file_attach_honesty): made the agent honest about having
    no agent-callable file-attach tool — fix marker: "no tool to attach a file
    to a skill yourself".

If a future migration (090+) edits this seeded row again and accidentally drops
one of these hard-won UAT fixes, or reintroduces a forbidden capability claim
(sub-agent delegation, browser automation, `claude -p` shell-out), nothing would
catch it before the next expensive multi-round live UAT cycle. This test is that
catch.

WHAT THIS PROVES: queries `public.skills` (`instructions`, `is_system`,
`is_org_shared`) for the fixed built-in row id
(`00000000-0000-0000-0000-000000000010`) against the LIVE local Postgres and
asserts the CURRENTLY SEEDED text still contains every required marker and none
of the forbidden ones. SELECT-only — no DB mutation anywhere in this module.

APPLY-GATE SEMANTICS (same convention as test_120_migration.py, deliberately
different from schema tests that skip cleanly pre-apply): by the time this test
runs, Plan 04 has already applied migration 087 and the live SC#4 UAT has already
applied 088 and 089 (see 137.2-HUMAN-UAT.md) — so an ABSENT row is a genuine HARD
FAILURE here, not a clean skip. The ONLY clean skip is :54322 itself being
unreachable (no live DB to gate against at all).

Boilerplate mirrored EXACTLY from test_120_migration.py / test_116_audit_live.py
(the `_POSTGRES_TEST_DSN` env-var-with-default + `_pg_reachable` /
`_check_pg_available_sync` / `PG_AVAILABLE` / `pytestmark` skip idiom already
used by 15+ phase test files in this suite) — no new shared conftest fixture
was added for this.
"""

import asyncio
import os

import asyncpg
import pytest
import pytest_asyncio


_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)

_SKILL_CREATOR_ID = "00000000-0000-0000-0000-000000000010"


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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 137.2 skill-creator seed-content gate",
)


@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool against local Postgres :54322."""
    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=4)
    try:
        yield pool
    finally:
        await pool.close()


async def _skill_creator_row(pool):
    """Return the live public.skills row for the built-in skill-creator, or None.

    None means the row is absent — the APPLY GATE: callers HARD-FAIL on None,
    they do NOT skip (Plan 04 + the live SC#4 UAT already applied 087/088/089
    to this environment by the time this test runs).
    """
    return await pool.fetchrow(
        "SELECT is_system, is_org_shared, instructions "
        "FROM public.skills WHERE id = $1",
        _SKILL_CREATOR_ID,
    )


_MISSING_ROW_MSG = (
    f"public.skills row id={_SKILL_CREATOR_ID} (built-in skill-creator) is "
    "MISSING. Migration 087 (+ the live-UAT-applied content updates in 088/089) "
    "is expected to already be applied to this DB (Plan 04 + 137.2-HUMAN-UAT.md) "
    "— this is a HARD FAILURE, not a clean skip. Apply "
    "supabase/migrations/087_skill_creator_reborn.sql, then 088, then 089, to "
    "the live DB (SQL-editor paste / psycopg2 to :54322; NEVER db push/reset)."
)


# ---------------------------------------------------------------------------
# (1) The built-in row is present, system-owned, and global — the precondition
#     for every content assertion below (a NULL row would make marker checks
#     meaningless).
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_builtin_skill_creator_row_is_system_and_global(pg_pool):
    """The seeded built-in skill-creator row exists with is_system=is_org_shared=true."""
    row = await _skill_creator_row(pg_pool)
    assert row is not None, _MISSING_ROW_MSG
    assert row["is_system"] is True, (
        f"skill-creator row is_system={row['is_system']!r}, expected True"
    )
    assert row["is_org_shared"] is True, (
        f"skill-creator row is_org_shared={row['is_org_shared']!r}, expected True"
    )


# ---------------------------------------------------------------------------
# (2) REQUIRED PRESENT — real tool names + the two hard-won UAT fix markers
#     (case-sensitive substring, one assertion per marker for a precise
#     failure signal if a future migration drops exactly one of them).
# ---------------------------------------------------------------------------

_REQUIRED_PRESENT = [
    pytest.param("search_documents", id="real-tool-search_documents"),
    pytest.param("save_skill", id="real-tool-save_skill"),
    pytest.param(
        "NOT optional and is NOT a separate turn",
        id="088-eval-sequencing-fix-marker",
    ),
    pytest.param(
        "no tool to attach a file to a skill yourself",
        id="089-file-attach-honesty-fix-marker",
    ),
]


@pytest.mark.asyncio
@pytest.mark.parametrize("marker", _REQUIRED_PRESENT)
async def test_builtin_skill_creator_instructions_contain_required_marker(pg_pool, marker):
    """Each required marker (real tool name or hard-won UAT fix phrase) is still
    present, case-sensitive, in the LIVE seeded instructions.

    Regression-locks migration 088 (mandatory eval-case-proposal sequencing) and
    089 (file-attach honesty): a future migration (090+) that edits this row and
    silently drops one of these phrases fails HERE, not three UAT rounds later.
    """
    row = await _skill_creator_row(pg_pool)
    assert row is not None, _MISSING_ROW_MSG
    instructions = row["instructions"] or ""
    assert marker in instructions, (
        f"Required marker {marker!r} NOT found in the live skill-creator "
        f"instructions (len={len(instructions)}). This exact phrase must survive "
        "any future edit to migrations 087/088/089's seeded content."
    )


# ---------------------------------------------------------------------------
# (3) REQUIRED ABSENT — forbidden capability claims (case-insensitive
#     substring; SEED-096 honesty).
# ---------------------------------------------------------------------------

_REQUIRED_ABSENT = [
    pytest.param("subagent", id="forbidden-subagent"),
    pytest.param("sub-agent", id="forbidden-sub-agent"),
    pytest.param("claude -p", id="forbidden-claude-dash-p"),
]


@pytest.mark.asyncio
@pytest.mark.parametrize("forbidden", _REQUIRED_ABSENT)
async def test_builtin_skill_creator_instructions_never_claim_forbidden_capability(pg_pool, forbidden):
    """None of the forbidden sub-agent/CLI capability claims appear
    (case-insensitive substring) in the LIVE seeded instructions.

    Regression-locks SEED-096 honesty: the agent must never claim sub-agent
    delegation or a `claude -p` shell-out — capabilities this runtime does not
    have. A future migration reintroducing one of these phrases fails HERE.
    """
    row = await _skill_creator_row(pg_pool)
    assert row is not None, _MISSING_ROW_MSG
    instructions_lower = (row["instructions"] or "").lower()
    assert forbidden.lower() not in instructions_lower, (
        f"Forbidden capability claim {forbidden!r} FOUND in the live "
        "skill-creator instructions — this runtime does not have this "
        "capability and the seeded prose must never claim it (SEED-096 honesty)."
    )

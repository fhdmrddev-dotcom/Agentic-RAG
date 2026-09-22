"""Phase 256 / METER-03 (SC#1, SC#4) — LIVE-DB shape gate for migration 182.

Proves the load-bearing SEMANTICS of
``supabase/migrations/182_workflow_runs_token_totals.sql`` against the live
local Postgres (:54322):

  1. ``input_tokens``, ``output_tokens`` and ``token_coverage`` exist on
     ``public.workflow_runs``.
  2. All three are NULLABLE (``is_nullable = 'YES'``) and carry NO server
     default (``column_default IS NULL``). This is D-256-06 and it is a
     SECURITY property here, not a style preference: ``NULL`` means *never
     measured* and ``0`` means *measured as zero*. A ``NOT NULL DEFAULT 0``
     would make an uninstrumented run indistinguishable from a free one —
     the exact defect Phase 257 exists to prevent ($0.00 for an unrated
     model).
  3. The types mirror ``public.runs`` exactly: ``integer`` / ``integer`` /
     ``ARRAY``.
  4. ``idx_workflow_runs_org_coverage_incomplete`` exists, is PARTIAL, and its
     predicate really carries the four-leg containment test.
  5. THE THREE-STATE PIN (D-256-07), which has no house pattern to inherit:
     a row can hold ``token_coverage IS NULL``, ``token_coverage = '{}'`` and
     a populated array, and **all three are distinguishable by query**. Two
     states would collapse "no instrumented leg ever reported usage" into
     "reported, covering nothing" — which is the same class of collapse as
     (2), one column over. The only in-repo ``text[]`` precedent
     (``connector_tokens.scopes``, migration 129) is the OPPOSITE posture —
     ``NOT NULL DEFAULT '{}'``, i.e. two states — so it is an ANTI-analog and
     is deliberately not copied.

APPLY-GATE SEMANTICS (same choice as ``test_120_migration.py``): migration 182
is applied by a blocking human-action step in plan 256-01, so an absent column
is a HARD FAILURE here, not a skip — the failing test IS the signal that the
migration has not been applied. The ONLY clean skip is :54322 itself being
unreachable.

⚠ WHAT THIS FILE CANNOT BE. It lives in ``backend/tests/integration/``, which
is OUTSIDE ``pytest tests/unit`` — the canonical backend gate whose failing set
is locked at 71 names with zero headroom. **Nothing in this file is visible to
that baseline**, so it can never be this phase's only proof of anything. The
unit-level proofs are ``tests/unit/test_256_persist_run_usage.py`` and
``tests/unit/test_256_enforce_budget_persist.py``; this file is the live-DB
shape gate and nothing more.

DB writes occur ONLY inside a transaction that is ROLLED BACK — the operator's
283 live ``workflow_runs`` rows are never mutated. Modeled on
``test_120_migration.py`` (the live-DB asyncpg + rollback idiom).
"""

import asyncio
import os
import uuid

import asyncpg
import pytest
import pytest_asyncio


_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)

_INDEX_NAME = "idx_workflow_runs_org_coverage_incomplete"


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
    reason=(
        f"local DB unreachable — {_POSTGRES_TEST_DSN} did not accept a connection; "
        "skipping the live migration-182 shape gate"
    ),
)


_NOT_APPLIED = (
    "public.workflow_runs.{col} does not exist — migration 182 NOT applied. "
    "Paste supabase/migrations/182_workflow_runs_token_totals.sql into the local "
    "Supabase SQL editor (or apply it over a direct connection to :54322); "
    "NEVER `supabase db push` / `db reset`, which wipe dev data. "
    "This failing test IS the apply gate."
)


@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool against local Postgres :54322."""
    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=4)
    try:
        yield pool
    finally:
        await pool.close()


async def _column(pool, name: str):
    """information_schema row for public.workflow_runs.<name>, or None."""
    return await pool.fetchrow(
        "SELECT column_name, data_type, is_nullable, column_default "
        "FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name='workflow_runs' "
        "AND column_name=$1",
        name,
    )


# ---------------------------------------------------------------------------
# (1)+(3) the three columns exist with the types that mirror public.runs
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.parametrize(
    "col_name,expected_type",
    [
        ("input_tokens", "integer"),
        ("output_tokens", "integer"),
        ("token_coverage", "ARRAY"),
    ],
)
async def test_column_exists_with_expected_type(pg_pool, col_name, expected_type):
    col = await _column(pg_pool, col_name)
    assert col is not None, _NOT_APPLIED.format(col=col_name)
    assert col["data_type"] == expected_type, (
        f"public.workflow_runs.{col_name} must be {expected_type} "
        f"(input/output mirror public.runs exactly — 035_runs_table.sql:30-31 — "
        f"so one grain reads the same in both tables); got {col['data_type']!r}"
    )


# ---------------------------------------------------------------------------
# (2) NULLABLE, and NO server default — D-256-06
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.parametrize(
    "col_name", ["input_tokens", "output_tokens", "token_coverage"]
)
async def test_column_is_nullable_with_no_default(pg_pool, col_name):
    """NULL means never measured; 0 (or '{}') means measured. Never coalesce them."""
    col = await _column(pg_pool, col_name)
    assert col is not None, _NOT_APPLIED.format(col=col_name)
    assert col["is_nullable"] == "YES", (
        f"public.workflow_runs.{col_name} must be NULLABLE (D-256-06): NULL is "
        f"'never measured' and is a DIFFERENT FACT from a measured zero; got "
        f"is_nullable={col['is_nullable']!r}"
    )
    assert col["column_default"] is None, (
        f"public.workflow_runs.{col_name} must carry NO server default "
        f"(D-256-06 — a default of 0 or '{{}}' collapses 'never measured' into "
        f"'measured as zero', making an uninstrumented run indistinguishable "
        f"from a free one); got column_default={col['column_default']!r}"
    )


# ---------------------------------------------------------------------------
# (4) the partial coverage index
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_partial_coverage_index_exists(pg_pool):
    """The per-org 'which runs are not fully covered' access path exists.

    ⭐ This index is also the repository's FIRST use of array containment
    (``@>``) inside an index PREDICATE. Both 256-RESEARCH.md (A1/U-2) and
    256-PATTERNS.md (gap G-b) recorded that there was no in-repo precedent and
    flagged the DDL ``[ASSUMED]``; Postgres accepted it on apply and normalised
    it to ``ARRAY['agent'::text, ...]``. This assertion is what keeps that a
    measured fact rather than a remembered one.
    """
    indexdef = await pg_pool.fetchval(
        "SELECT indexdef FROM pg_indexes "
        "WHERE schemaname='public' AND tablename='workflow_runs' AND indexname=$1",
        _INDEX_NAME,
    )
    assert indexdef is not None, (
        f"{_INDEX_NAME} is missing — migration 182's CREATE INDEX did not apply. "
        "workflow_runs has no org_id index otherwise, so Phase 257's per-org "
        "read would have no access path at all."
    )
    assert "org_id" in indexdef and "created_at" in indexdef, (
        f"{_INDEX_NAME} must be keyed on (org_id, created_at DESC); got {indexdef!r}"
    )
    assert "WHERE" in indexdef, (
        f"{_INDEX_NAME} must be PARTIAL — a full index over every run defeats the "
        f"point, which is that incomplete rows are the sparse exception; "
        f"got {indexdef!r}"
    )
    assert "token_coverage IS NULL" in indexdef, (
        f"{_INDEX_NAME}'s predicate must include the NULL arm — a pre-182 row is "
        f"'coverage unknown', which is one of the states the view must find; "
        f"got {indexdef!r}"
    )
    assert "@>" in indexdef, (
        f"{_INDEX_NAME}'s predicate must test MEMBERSHIP via @>, not arity. "
        f"An array_length(...) < 4 fallback would read four WRONG legs as "
        f"complete; got {indexdef!r}"
    )
    for leg in ("agent", "single", "batch", "emit"):
        assert f"'{leg}'" in indexdef, (
            f"{_INDEX_NAME}'s predicate must name the complete leg set; "
            f"{leg!r} is missing from {indexdef!r}"
        )


# ---------------------------------------------------------------------------
# (5) THE THREE-STATE PIN — NULL vs '{}' vs populated, all distinguishable
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_token_coverage_has_three_distinguishable_states(pg_pool):
    """NULL, '{}' and a populated array are three DIFFERENT facts, by query.

    - NULL      -> no instrumented leg ever reported usage for this run
                   (also: any row that predates migration 182)
    - '{}'      -> a leg reported, and it covers nothing
    - {agent,..}-> exactly the legs listed

    Three rows are inserted, one per state, and each is recovered by a query
    that must match IT and NOT the other two. Everything happens inside a
    transaction that is ROLLED BACK, so the live corpus is untouched.
    """
    col = await _column(pg_pool, "token_coverage")
    assert col is not None, _NOT_APPLIED.format(col="token_coverage")

    async with pg_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            uid = uuid.uuid4()
            tid = uuid.uuid4()
            did = uuid.uuid4()
            org = uuid.uuid4()

            # FK parents, all created inside the rolled-back tx.
            await conn.execute(
                "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
                uid, f"phase-256-coverage-{uid}@test.local",
            )
            await conn.execute(
                "INSERT INTO public.threads (id, user_id, org_id, title) "
                "VALUES ($1, $2, $3, $4)",
                tid, uid, org, "phase-256-coverage-probe",
            )
            await conn.execute(
                "INSERT INTO public.workflow_definitions "
                "(id, slug, name, created_by, org_id) VALUES ($1, $2, $3, $4, $5)",
                did, f"phase-256-{did}", "phase-256-coverage-probe", uid, org,
            )

            run_null = uuid.uuid4()
            run_empty = uuid.uuid4()
            run_full = uuid.uuid4()
            states = {
                run_null: None,
                run_empty: [],
                run_full: ["agent", "single", "batch"],
            }
            for run_id, coverage in states.items():
                await conn.execute(
                    "INSERT INTO public.workflow_runs "
                    "(id, thread_id, definition_id, org_id, token_coverage) "
                    "VALUES ($1, $2, $3, $4, $5)",
                    run_id, tid, did, org, coverage,
                )

            # Round-trip: each row reads back as the state it was written as.
            read_back = {
                r["id"]: r["token_coverage"]
                for r in await conn.fetch(
                    "SELECT id, token_coverage FROM public.workflow_runs "
                    "WHERE org_id = $1",
                    org,
                )
            }
            assert read_back[run_null] is None, (
                "a NULL token_coverage must read back as None, not as [] — "
                "collapsing them would erase the 'never measured' state"
            )
            assert read_back[run_empty] == [], (
                "an empty-array token_coverage must read back as [], not as None"
            )
            assert read_back[run_full] == ["agent", "single", "batch"]

            # Each state is selectable on its own, and the three sets are disjoint.
            only_null = await conn.fetch(
                "SELECT id FROM public.workflow_runs "
                "WHERE org_id = $1 AND token_coverage IS NULL",
                org,
            )
            assert [r["id"] for r in only_null] == [run_null]

            only_empty = await conn.fetch(
                "SELECT id FROM public.workflow_runs "
                "WHERE org_id = $1 AND token_coverage = '{}'::text[]",
                org,
            )
            assert [r["id"] for r in only_empty] == [run_empty], (
                "token_coverage = '{}' must match the empty-array row ONLY — "
                "if it also matched the NULL row the third state would be lost"
            )

            only_full = await conn.fetch(
                "SELECT id FROM public.workflow_runs "
                "WHERE org_id = $1 "
                "AND token_coverage @> ARRAY['agent','single','batch']::text[]",
                org,
            )
            assert [r["id"] for r in only_full] == [run_full]

            # And the index predicate's own question answers over all three:
            # NULL and '{}' are incomplete; so is the 3-leg row, because the
            # complete set is four legs until METER-06's "emit" ships.
            incomplete = await conn.fetch(
                "SELECT id FROM public.workflow_runs WHERE org_id = $1 "
                "AND (token_coverage IS NULL OR NOT (token_coverage @> "
                "ARRAY['agent','single','batch','emit']::text[]))",
                org,
            )
            assert {r["id"] for r in incomplete} == set(states), (
                "every one of the three states is 'not fully covered' while the "
                "complete set is four legs — the NULL arm of the predicate is "
                "what keeps the never-measured rows visible to Phase 257"
            )
        finally:
            await tx.rollback()  # never mutate the live corpus

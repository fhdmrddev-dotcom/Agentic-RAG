"""
UAT Scenario Suite for Phase 257 (METER-01, METER-02, METER-07).

Verifies the 3 G-4 lived-experience failure scenarios against live PostgreSQL (:54322):
  1. The Free Lie: An unrated run never displays $0.00 anywhere; cost_usd is NULL and flagged is_rated=False.
  2. Historical Rewrite: Repricing a model today preserves yesterday's run cost (price immutability).
  3. Blind Spot Amnesia: Runs with incomplete token_coverage trigger warning indicators and partial coverage metrics.
"""

import os
import socket
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import asyncpg
import pytest

from app.db.rates import (
    get_org_spend_summary,
    get_spend_runs,
    reprice_model,
)

_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)


def _pg_available() -> bool:
    try:
        with socket.create_connection(("127.0.0.1", 54322), timeout=1.0):
            return True
    except OSError:
        return False


pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.skipif(not _pg_available(), reason="PostgreSQL not available on :54322"),
]


@pytest.fixture
async def db_pool():
    pool = await asyncpg.create_pool(_DSN, min_size=1, max_size=5)
    try:
        yield pool
    finally:
        await pool.close()


@pytest.fixture
async def test_org(db_pool):
    org_id = uuid4()
    org_name = f"UAT 257 Org {org_id.hex[:8]}"

    await db_pool.execute(
        """
        INSERT INTO public.organizations (id, name, created_at, updated_at)
        VALUES ($1, $2, now(), now())
        """,
        org_id,
        org_name,
    )

    try:
        yield org_id
    finally:
        # Cascade cleanup of test data
        await db_pool.execute("DELETE FROM public.runs WHERE org_id = $1", org_id)
        await db_pool.execute("DELETE FROM public.workflow_runs WHERE org_id = $1", org_id)
        await db_pool.execute("DELETE FROM public.threads WHERE org_id = $1", org_id)
        await db_pool.execute("DELETE FROM public.model_rates WHERE org_id = $1", org_id)
        await db_pool.execute("DELETE FROM public.organizations WHERE id = $1", org_id)


@pytest.fixture
async def test_user_id(db_pool):
    user_row = await db_pool.fetchrow("SELECT id FROM auth.users LIMIT 1")
    assert user_row is not None, "At least one auth.users record required for UAT"
    return user_row["id"]


async def _create_thread(db_pool, org_id: uuid4, user_id: uuid4, thread_id: uuid4 = None) -> uuid4:
    tid = thread_id or uuid4()
    await db_pool.execute(
        """
        INSERT INTO public.threads (id, user_id, title, created_at, updated_at, org_id)
        VALUES ($1, $2, 'UAT Spend Test Thread', now(), now(), $3)
        """,
        tid,
        user_id,
        org_id,
    )
    return tid


async def test_scenario_1_the_free_lie(db_pool, test_org, test_user_id):
    """Scenario 1 (The Free Lie):
    An unrated run with model 'qwen-2.5-72b' must NEVER yield $0.00.
    cost_usd is strictly NULL, flagged is_rated=False, and excluded from total spend.
    """
    run_id = uuid4()
    thread_id = await _create_thread(db_pool, test_org, test_user_id)
    model_name = "qwen-2.5-72b"
    started_at = datetime.now(timezone.utc) - timedelta(minutes=15)
    completed_at = started_at + timedelta(seconds=5)

    # 1. Insert unrated run into public.runs with real tokens
    await db_pool.execute(
        """
        INSERT INTO public.runs (
            run_id, thread_id, user_id, status, model, provider,
            started_at, completed_at, input_tokens, output_tokens, org_id
        ) VALUES (
            $1, $2, $3, 'completed', $4, 'together',
            $5, $6, 1000, 500, $7
        )
        """,
        run_id,
        thread_id,
        test_user_id,
        model_name,
        started_at,
        completed_at,
        test_org,
    )

    # 2. Query runs via get_spend_runs
    runs_page, total_count = await get_spend_runs(db_pool, test_org, limit=50)
    assert total_count == 1
    assert len(runs_page) == 1

    run = runs_page[0]
    assert run["run_id"] == str(run_id)
    assert run["model"] == model_name

    # STRICT INVARIANT (D-257-05): Never $0.00
    assert run["is_rated"] is False
    assert run["cost_usd"] is None
    assert run["cost_usd"] != Decimal("0.0000")
    assert run["cost_usd"] != 0

    # 3. Query spend summary via get_org_spend_summary
    summary = await get_org_spend_summary(db_pool, test_org)

    assert summary.total_spend_usd == Decimal("0.0000")
    assert summary.rated_runs_count == 0
    assert summary.unrated_runs_count == 1
    assert summary.total_input_tokens == 1000
    assert summary.total_output_tokens == 500

    # Model breakdown honesty
    assert len(summary.model_breakdown) == 1
    m_info = summary.model_breakdown[0]
    assert m_info["model_name"] == model_name
    assert m_info["is_rated"] is False
    assert m_info["spend_usd"] is None
    assert m_info["unrated_count"] == 1


async def test_scenario_2_historical_rewrite(db_pool, test_org, test_user_id):
    """Scenario 2 (Historical Rewrite):
    Repricing a model today MUST preserve yesterday's run cost.
    Effective-dated rates ensure historical run costs remain price-immutable (D-257-03).
    """
    model_name = "historical-gpt"
    t0_rate_time = datetime(2026, 9, 1, 0, 0, tzinfo=timezone.utc)
    t0_run_time = datetime(2026, 9, 1, 12, 0, tzinfo=timezone.utc)
    t0_completed_time = t0_run_time + timedelta(seconds=10)

    # 1. Register T0 rate: $2.50 input / $10.00 output per 1M tokens
    await db_pool.execute(
        """
        INSERT INTO public.model_rates (
            model_id, provider, input_cost_per_million, output_cost_per_million,
            effective_from, org_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        """,
        model_name,
        "openai",
        Decimal("2.500000"),
        Decimal("10.000000"),
        t0_rate_time,
        test_org,
    )

    # 2. Insert run at T0 with 100,000 input tokens and 50,000 output tokens
    # Cost = (100k * 2.50 / 1M) + (50k * 10.00 / 1M) = 0.25 + 0.50 = $0.7500
    run_t0_id = uuid4()
    thread_t0 = await _create_thread(db_pool, test_org, test_user_id)
    await db_pool.execute(
        """
        INSERT INTO public.runs (
            run_id, thread_id, user_id, status, model, provider,
            started_at, completed_at, input_tokens, output_tokens, org_id
        ) VALUES (
            $1, $2, $3, 'completed', $4, 'openai',
            $5, $6, 100000, 50000, $7
        )
        """,
        run_t0_id,
        thread_t0,
        test_user_id,
        model_name,
        t0_run_time,
        t0_completed_time,
        test_org,
    )

    # Verify T0 cost is $0.7500
    runs_t0, _ = await get_spend_runs(db_pool, test_org)
    t0_run = next(r for r in runs_t0 if r["run_id"] == str(run_t0_id))
    assert t0_run["cost_usd"] == "0.7500"

    # 3. Fast-forward to T1 (now): Reprice model to $10.00 input / $50.00 output (4x price hike)
    t1_time = datetime.now(timezone.utc)
    await reprice_model(
        db_pool,
        model_id=model_name,
        input_cost_per_million=Decimal("10.000000"),
        output_cost_per_million=Decimal("50.000000"),
        provider="openai",
        effective_from=t1_time,
        org_id=test_org,
    )

    # 4. Re-fetch T0 run cost: MUST REMAIN $0.7500!
    runs_after_reprice, _ = await get_spend_runs(db_pool, test_org)
    t0_run_recheck = next(r for r in runs_after_reprice if r["run_id"] == str(run_t0_id))
    assert t0_run_recheck["cost_usd"] == "0.7500", (
        f"Historical run cost changed from $0.7500 to {t0_run_recheck['cost_usd']}!"
    )

    # 5. Insert new run at T2 (> T1) with identical token counts (100k / 50k)
    # Expected cost at T1 rates: (100k * 10 / 1M) + (50k * 50 / 1M) = 1.00 + 2.50 = $3.5000
    run_t2_id = uuid4()
    thread_t2 = await _create_thread(db_pool, test_org, test_user_id)
    t2_run_time = t1_time + timedelta(minutes=5)
    t2_completed_time = t2_run_time + timedelta(seconds=10)
    await db_pool.execute(
        """
        INSERT INTO public.runs (
            run_id, thread_id, user_id, status, model, provider,
            started_at, completed_at, input_tokens, output_tokens, org_id
        ) VALUES (
            $1, $2, $3, 'completed', $4, 'openai',
            $5, $6, 100000, 50000, $7
        )
        """,
        run_t2_id,
        thread_t2,
        test_user_id,
        model_name,
        t2_run_time,
        t2_completed_time,
        test_org,
    )

    runs_all, _ = await get_spend_runs(db_pool, test_org)
    t2_run = next(r for r in runs_all if r["run_id"] == str(run_t2_id))
    assert t2_run["cost_usd"] == "3.5000"

    # Double-check T0 run is still immutable at $0.7500
    t0_run_final = next(r for r in runs_all if r["run_id"] == str(run_t0_id))
    assert t0_run_final["cost_usd"] == "0.7500"


async def test_scenario_3_blind_spot_amnesia(db_pool, test_org, test_user_id):
    """Scenario 3 (Blind Spot Amnesia):
    Runs with incomplete token_coverage must be tracked in incomplete_coverage_count
    and clearly surfaced as partial lower-bound figures.
    """
    model_name = "gpt-4o"
    started_at = datetime.now(timezone.utc) - timedelta(hours=1)
    completed_at = started_at + timedelta(seconds=10)

    # Get valid workflow definition
    def_row = await db_pool.fetchrow("SELECT id FROM public.workflow_definitions LIMIT 1")
    def_id = def_row["id"] if def_row else uuid4()

    # 1. Insert Run 1 with PARTIAL coverage (missing batch, emit)
    run_partial_id = uuid4()
    thread_partial_id = await _create_thread(db_pool, test_org, test_user_id)

    # Companions in runs and workflow_runs
    await db_pool.execute(
        """
        INSERT INTO public.runs (
            run_id, thread_id, user_id, status, model, provider,
            started_at, completed_at, input_tokens, output_tokens, org_id
        ) VALUES (
            $1, $2, $3, 'completed', $4, 'openai',
            $5, $6, 1000, 500, $7
        )
        """,
        run_partial_id,
        thread_partial_id,
        test_user_id,
        model_name,
        started_at,
        completed_at,
        test_org,
    )

    await db_pool.execute(
        """
        INSERT INTO public.workflow_runs (
            id, thread_id, definition_id, status, org_id,
            created_at, updated_at, inputs, token_coverage
        ) VALUES (
            $1, $2, $3, 'completed', $4,
            $5, $5, '{}'::jsonb, ARRAY['agent', 'single']
        )
        """,
        uuid4(),
        thread_partial_id,
        def_id,
        test_org,
        started_at,
    )

    # 2. Insert Run 2 with COMPLETE coverage (all 4 legs: agent, single, batch, emit)
    run_complete_id = uuid4()
    thread_complete_id = await _create_thread(db_pool, test_org, test_user_id)

    await db_pool.execute(
        """
        INSERT INTO public.runs (
            run_id, thread_id, user_id, status, model, provider,
            started_at, completed_at, input_tokens, output_tokens, org_id
        ) VALUES (
            $1, $2, $3, 'completed', $4, 'openai',
            $5, $6, 2000, 1000, $7
        )
        """,
        run_complete_id,
        thread_complete_id,
        test_user_id,
        model_name,
        started_at,
        completed_at,
        test_org,
    )

    await db_pool.execute(
        """
        INSERT INTO public.workflow_runs (
            id, thread_id, definition_id, status, org_id,
            created_at, updated_at, inputs, token_coverage
        ) VALUES (
            $1, $2, $3, 'completed', $4,
            $5, $5, '{}'::jsonb, ARRAY['agent', 'single', 'batch', 'emit']
        )
        """,
        uuid4(),
        thread_complete_id,
        def_id,
        test_org,
        started_at,
    )

    # 3. Query spend summary: incomplete_coverage_count MUST be 1
    summary = await get_org_spend_summary(db_pool, test_org)
    assert summary.incomplete_coverage_count == 1
    assert summary.rated_runs_count == 2

    # 4. Query spend runs filtered by incomplete_coverage
    runs_incomplete, total_incomplete = await get_spend_runs(
        db_pool,
        test_org,
        filter_status="incomplete_coverage",
    )
    assert total_incomplete == 1
    assert len(runs_incomplete) == 1
    assert runs_incomplete[0]["run_id"] == str(run_partial_id)
    assert runs_incomplete[0]["token_coverage"] == ["agent", "single"]

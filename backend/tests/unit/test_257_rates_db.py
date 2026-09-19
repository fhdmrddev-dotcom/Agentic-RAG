"""Unit tests and Python-SQL parity verification for app.db.rates.

Phase 257 (METER-01, METER-02, METER-07, D-257-15).
"""

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.db.rates import (
    get_rate_for_model,
    list_model_rates,
    reprice_model,
    get_org_spend_summary,
    get_spend_runs,
    SpendSummary,
)
from app.services.pricing_service import ModelRate, compute_token_cost_usd


def _build_mock_pool():
    pool = AsyncMock()
    pool.fetchrow = AsyncMock()
    pool.fetch = AsyncMock()
    pool.fetchval = AsyncMock()
    pool.execute = AsyncMock()
    return pool


@pytest.mark.asyncio
async def test_get_rate_for_model_matches_and_maps():
    pool = _build_mock_pool()
    now = datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc)
    pool.fetchrow.return_value = {
        "id": uuid4(),
        "model_id": "gpt-4o",
        "provider": "openai",
        "input_cost_per_million": Decimal("2.500000"),
        "output_cost_per_million": Decimal("10.000000"),
        "effective_from": now,
        "org_id": None,
        "created_at": now,
    }

    rate = await get_rate_for_model(pool, "gpt-4o", provider="openai", effective_at=now)
    assert rate is not None
    assert rate.model_name == "gpt-4o"
    assert rate.model_id == "gpt-4o"
    assert rate.input_cost_per_million == Decimal("2.500000")
    assert rate.output_cost_per_million == Decimal("10.000000")

    # Assert SQL parameter binding
    assert pool.fetchrow.await_count == 1
    sql, model_id, org_id, provider, eff_ts = pool.fetchrow.call_args[0]
    assert "FROM public.model_rates" in sql
    assert model_id == "gpt-4o"
    assert provider == "openai"


@pytest.mark.asyncio
async def test_get_rate_for_model_not_found_returns_none():
    pool = _build_mock_pool()
    pool.fetchrow.return_value = None

    rate = await get_rate_for_model(pool, "unrated-model-xyz")
    assert rate is None


@pytest.mark.asyncio
async def test_reprice_model_inserts_and_returns_rate():
    pool = _build_mock_pool()
    now = datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc)
    pool.fetchrow.return_value = {
        "id": uuid4(),
        "model_id": "gpt-4o",
        "provider": "openai",
        "input_cost_per_million": Decimal("3.000000"),
        "output_cost_per_million": Decimal("12.000000"),
        "effective_from": now,
        "org_id": None,
        "created_at": now,
    }

    new_rate = await reprice_model(
        pool,
        model_id="gpt-4o",
        input_cost_per_million=Decimal("3.000000"),
        output_cost_per_million=Decimal("12.000000"),
        provider="openai",
        effective_from=now,
    )
    assert new_rate.model_name == "gpt-4o"
    assert new_rate.input_cost_per_million == Decimal("3.000000")
    assert new_rate.output_cost_per_million == Decimal("12.000000")

    sql, *args = pool.fetchrow.call_args[0]
    assert "INSERT INTO public.model_rates" in sql
    assert args[0] == "gpt-4o"
    assert args[1] == "openai"
    assert args[2] == Decimal("3.000000")
    assert args[3] == Decimal("12.000000")
    assert args[4] == now


@pytest.mark.asyncio
async def test_get_org_spend_summary_honesty():
    pool = _build_mock_pool()
    org_id = uuid4()

    # Totals row
    pool.fetchrow.side_effect = [
        {
            "total_spend_usd": Decimal("48.2050"),
            "rated_runs_count": 92,
            "unrated_runs_count": 8,
            "total_input_tokens": 1500000,
            "total_output_tokens": 400000,
        },
        {"incomplete_count": 5},
    ]
    pool.fetch.side_effect = [
        # Daily spend
        [
            {"date_str": "2026-09-18", "spend_usd": Decimal("24.1025"), "rated_count": 46, "unrated_count": 4},
            {"date_str": "2026-09-19", "spend_usd": Decimal("24.1025"), "rated_count": 46, "unrated_count": 4},
        ],
        # Model breakdown
        [
            {
                "model": "gpt-4o",
                "provider": "openai",
                "spend_usd": Decimal("48.2050"),
                "input_tokens": 1500000,
                "output_tokens": 400000,
                "run_count": 92,
                "rated_count": 92,
                "unrated_count": 0,
                "is_fully_rated": True,
            },
            {
                "model": "qwen-2.5-72b",
                "provider": "together",
                "spend_usd": Decimal("0.0000"),
                "input_tokens": 200000,
                "output_tokens": 50000,
                "run_count": 8,
                "rated_count": 0,
                "unrated_count": 8,
                "is_fully_rated": False,
            }
        ]
    ]

    summary = await get_org_spend_summary(pool, org_id)

    assert isinstance(summary, SpendSummary)
    assert summary.total_spend_usd == Decimal("48.2050")
    assert summary.rated_runs_count == 92
    assert summary.unrated_runs_count == 8
    assert summary.incomplete_coverage_count == 5
    assert len(summary.daily_spend) == 2
    assert len(summary.model_breakdown) == 2

    # Verify unrated model reports None for spend_usd
    unrated_item = [m for m in summary.model_breakdown if m["model_name"] == "qwen-2.5-72b"][0]
    assert unrated_item["spend_usd"] is None
    assert unrated_item["is_rated"] is False


@pytest.mark.asyncio
async def test_get_spend_runs_returns_coverage_and_cost():
    pool = _build_mock_pool()
    org_id = uuid4()
    run_id = uuid4()
    now = datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc)

    pool.fetchrow.return_value = {"total": 1}
    pool.fetch.return_value = [
        {
            "run_id": run_id,
            "thread_id": uuid4(),
            "user_id": uuid4(),
            "status": "completed",
            "model": "gpt-4o",
            "provider": "openai",
            "started_at": now,
            "completed_at": now,
            "input_tokens": 1000,
            "output_tokens": 500,
            "input_cost_per_million": Decimal("2.500000"),
            "output_cost_per_million": Decimal("10.000000"),
            "token_coverage": ["agent", "single", "batch", "emit"],
            "cost_usd": Decimal("0.0075"),
        }
    ]

    runs, total = await get_spend_runs(pool, org_id)
    assert total == 1
    assert len(runs) == 1
    assert runs[0]["run_id"] == str(run_id)
    assert runs[0]["is_rated"] is True
    assert runs[0]["cost_usd"] == "0.0075"
    assert runs[0]["is_coverage_complete"] is True


def test_python_sql_spend_parity_across_permutations():
    """D-257-15: Verify exact cent-for-cent parity between SQL formula and compute_token_cost_usd.

    SQL arithmetic:
      ROUND((COALESCE(input_tokens, 0) * input_rate / 1000000.0) + (COALESCE(output_tokens, 0) * output_rate / 1000000.0), 4)

    Python pricing_service:
      compute_token_cost_usd(...) -> CostResult(cost_usd=...)
    """
    now = datetime(2026, 9, 19, tzinfo=timezone.utc)

    # 25 test permutations covering zero tokens, boundary cents, odd numbers, large runs
    test_cases = [
        # (input_tokens, output_tokens, in_rate, out_rate)
        (0, 0, "2.500000", "10.000000"),
        (1, 0, "2.500000", "10.000000"),
        (0, 1, "2.500000", "10.000000"),
        (1, 1, "2.500000", "10.000000"),
        (10, 5, "2.500000", "10.000000"),
        (19, 0, "2.500000", "10.000000"),   # 19 * 2.5 / 1M = 0.0000475 -> 0.0000
        (20, 0, "2.500000", "10.000000"),   # 20 * 2.5 / 1M = 0.0000500 -> 0.0001
        (33, 14, "2.500000", "10.000000"),
        (100, 200, "0.150000", "0.600000"),
        (1000, 500, "3.000000", "15.000000"),
        (1234, 5678, "3.000000", "15.000000"),
        (50000, 25000, "0.140000", "0.280000"),
        (100000, 50000, "2.500000", "10.000000"),
        (1000000, 1000000, "2.500000", "10.000000"),
        (2500000, 750000, "15.000000", "75.000000"),
        (85421, 12431, "0.020000", "0.000000"),
        (999999, 1, "1.234567", "9.876543"),
        (3, 7, "0.555555", "1.111111"),
        (777, 333, "5.000000", "20.000000"),
        (12, 34, "0.000000", "0.000000"),
        (450, 0, "0.075000", "0.300000"),
        (0, 450, "0.075000", "0.300000"),
        (8888, 9999, "2.100000", "8.400000"),
        (13579, 24680, "4.250000", "17.000000"),
        (10000000, 5000000, "5.000000", "15.000000"),
    ]

    for in_tok, out_tok, in_rate_str, out_rate_str in test_cases:
        in_rate = Decimal(in_rate_str)
        out_rate = Decimal(out_rate_str)

        # 1. Evaluate SQL formula using Decimal mirroring Postgres numeric / ROUND(val, 4)
        sql_in = (Decimal(in_tok) * in_rate) / Decimal(1000000)
        sql_out = (Decimal(out_tok) * out_rate) / Decimal(1000000)
        sql_result = (sql_in + sql_out).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

        # 2. Evaluate Python compute_token_cost_usd
        rate = ModelRate(
            model_id="test-model",
            input_cost_per_million=in_rate,
            output_cost_per_million=out_rate,
            effective_from=now,
        )
        cost_res = compute_token_cost_usd(
            input_tokens=in_tok,
            output_tokens=out_tok,
            rate=rate,
        )

        assert cost_res.is_rated is True
        assert cost_res.cost_usd == sql_result, (
            f"Parity mismatch for in={in_tok}, out={out_tok}, in_rate={in_rate}, out_rate={out_rate}: "
            f"Python={cost_res.cost_usd} vs SQL={sql_result}"
        )

"""
Tests for Pricing Service (METER-01 / METER-02 / D-257-05 / D-257-13).

Verifies:
  - Exact Decimal arithmetic without float rounding errors
  - Unrated models yield cost_usd=None and is_rated=False
  - Under no circumstances does an unrated model yield $0.00
  - Boundary cases (0 tokens, 1 token, 1,000,000 tokens, rounding)
  - Partial token counts (input only, output only)
"""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4
import pytest

from app.services.pricing_service import (
    ModelRate,
    CostResult,
    compute_token_cost_usd,
)


@pytest.fixture
def gpt4o_rate() -> ModelRate:
    return ModelRate(
        id=uuid4(),
        model_id="gpt-4o",
        provider="openai",
        input_cost_per_million=Decimal("2.500000"),
        output_cost_per_million=Decimal("10.000000"),
        effective_from=datetime(2024, 1, 1, tzinfo=timezone.utc),
    )


@pytest.fixture
def deepseek_rate() -> ModelRate:
    return ModelRate(
        id=uuid4(),
        model_id="deepseek-chat",
        provider="deepseek",
        input_cost_per_million=Decimal("0.140000"),
        output_cost_per_million=Decimal("0.280000"),
        effective_from=datetime(2024, 1, 1, tzinfo=timezone.utc),
    )


def test_compute_token_cost_gpt4o(gpt4o_rate: ModelRate):
    """Verify $2.50/1M in and $10.00/1M out calculation."""
    # 400,000 in ($1.00) + 30,000 out ($0.30) = $1.3000
    result = compute_token_cost_usd(400_000, 30_000, gpt4o_rate)
    assert result.is_rated is True
    assert result.unrated_model is None
    assert result.cost_usd == Decimal("1.3000")
    assert result.input_cost_usd == Decimal("1.0000")
    assert result.output_cost_usd == Decimal("0.3000")


def test_compute_token_cost_deepseek_low_cost(deepseek_rate: ModelRate):
    """Verify low-cost model precision ($0.14 / $0.28)."""
    # 135,142 in + 10,317 out (matches Phase 256 UAT row)
    # in: 135142 * 0.14 / 1_000_000 = 0.01891988 -> 0.0189
    # out: 10317 * 0.28 / 1_000_000 = 0.00288876 -> 0.0029
    # total: 0.02180864 -> 0.0218
    result = compute_token_cost_usd(135_142, 10_317, deepseek_rate)
    assert result.is_rated is True
    assert result.cost_usd == Decimal("0.0218")
    assert result.input_cost_usd == Decimal("0.0189")
    assert result.output_cost_usd == Decimal("0.0029")


def test_unrated_model_returns_none_never_zero():
    """D-257-05: A model with no rate reads as unrated, NEVER $0.00."""
    result = compute_token_cost_usd(50_000, 2_000, rate=None, model_id="qwen-2.5-72b")
    assert result.is_rated is False
    assert result.cost_usd is None
    assert result.unrated_model == "qwen-2.5-72b"
    assert result.cost_usd != Decimal("0.00")
    assert result.cost_usd != Decimal("0")
    assert result.cost_usd != 0.0


def test_both_tokens_none_returns_none_cost_rated(gpt4o_rate: ModelRate):
    """When a run measured no usage (both None), cost is None with is_rated=True."""
    result = compute_token_cost_usd(None, None, gpt4o_rate)
    assert result.is_rated is True
    assert result.cost_usd is None
    assert result.input_cost_usd is None
    assert result.output_cost_usd is None


def test_single_token_edge_case(gpt4o_rate: ModelRate):
    """1 token: (1 * 2.50) / 1_000_000 = 0.0000025 -> rounds to 0.0000."""
    result = compute_token_cost_usd(1, 0, gpt4o_rate)
    assert result.is_rated is True
    assert result.cost_usd == Decimal("0.0000")


def test_round_half_up_precision(gpt4o_rate: ModelRate):
    """Test standard ROUND_HALF_UP boundary behavior."""
    # 20 tokens * 2.50 / 1_000_000 = 0.000050 -> rounds up to 0.0001
    result = compute_token_cost_usd(20, 0, gpt4o_rate)
    assert result.is_rated is True
    assert result.cost_usd == Decimal("0.0001")


def test_zero_tokens_rated(gpt4o_rate: ModelRate):
    """Explicit 0 tokens with rate produces Decimal('0.0000')."""
    result = compute_token_cost_usd(0, 0, gpt4o_rate)
    assert result.is_rated is True
    assert result.cost_usd == Decimal("0.0000")


def test_one_sided_tokens(gpt4o_rate: ModelRate):
    """Only input tokens or only output tokens."""
    result_in_only = compute_token_cost_usd(100_000, None, gpt4o_rate)
    assert result_in_only.cost_usd == Decimal("0.2500")

    result_out_only = compute_token_cost_usd(None, 50_000, gpt4o_rate)
    assert result_out_only.cost_usd == Decimal("0.5000")

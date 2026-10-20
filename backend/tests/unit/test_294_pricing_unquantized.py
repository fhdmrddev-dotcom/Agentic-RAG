"""Phase 294-01 (Pitfall 8 / D-19) — the unquantised cost helper lives in pricing_service.py.

``compute_token_cost_usd`` quantises to 4 decimal places, so an engine call (~$0.0001) reads as
$0.0000 — "free". The new helper keeps the exact Decimal and the same None rules; the AST fence
(test_257) keeps it the ONE conversion home.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal


def _rate(inp: str, out: str = "0"):
    from app.services.pricing_service import ModelRate

    return ModelRate(model_id="gpt-6-luna", input_cost_per_million=Decimal(inp),
                     output_cost_per_million=Decimal(out),
                     effective_from=datetime(2026, 10, 20, tzinfo=timezone.utc))


def test_no_rounding():
    from app.services.pricing_service import compute_token_cost_usd, compute_token_cost_usd_unquantized

    got = compute_token_cost_usd_unquantized(1234, 0, _rate("0.10"))
    assert got.cost_usd == Decimal("0.0001234")
    assert got.is_rated is True
    assert compute_token_cost_usd(1234, 0, _rate("0.10")).cost_usd == Decimal("0.0001"), "the old one rounds"


def test_no_rate_is_unrated_never_zero():
    from app.services.pricing_service import compute_token_cost_usd_unquantized

    got = compute_token_cost_usd_unquantized(1234, 0, None, model_id="x")
    assert got.cost_usd is None and got.is_rated is False and got.unrated_model == "x"


def test_no_tokens_is_none_but_rated():
    from app.services.pricing_service import compute_token_cost_usd_unquantized

    got = compute_token_cost_usd_unquantized(None, None, _rate("0.10"))
    assert got.cost_usd is None and got.is_rated is True


def test_output_tokens_count_too():
    from app.services.pricing_service import compute_token_cost_usd_unquantized

    got = compute_token_cost_usd_unquantized(1000, 500, _rate("1", "2"))
    assert got.cost_usd == Decimal("0.002")
    assert got.input_cost_usd == Decimal("0.001") and got.output_cost_usd == Decimal("0.001")

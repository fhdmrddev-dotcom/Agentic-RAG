"""
Pricing Service — Single Home for Token-to-USD Conversion (METER-02 / D-257-13).

This module is the canonical home of token-to-dollar pricing logic in the backend.
An AST fence (backend/tests/unit/test_257_single_token_conversion_home.py) enforces
that NO OTHER MODULE defines token-to-USD conversion functions or performs ad-hoc
token * rate / 1_000_000 arithmetic.

Strict Blind-Spot Honesty (METER-01 / D-257-05):
  - If a model has no rate in model_rates, compute_token_cost_usd() returns
    CostResult(cost_usd=None, is_rated=False, unrated_model=model_id).
  - Unrated runs MUST NEVER be coerced to $0.00 or $0.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from uuid import UUID

ONE_MILLION = Decimal("1000000")
QUANTIZE_FOUR_PLACES = Decimal("0.0001")


def cost_usd_sql(runs_alias: str = "r", rate_alias: str = "rate") -> str:
    """The SQL spelling of ``compute_token_cost_usd`` — generated HERE, beside the Python one.

    257 F-13 / METER-02: aggregate queries in ``db/rates.py`` must price rows inside
    Postgres, so the conversion has two spellings. They used to be two HOMES — the
    expression was hand-written four times in ``rates.py`` — so a change to one could not
    reach the others. Now both spellings live in this module, built from the same
    ``ONE_MILLION`` / ``QUANTIZE_FOUR_PLACES`` constants, and
    ``test_257_single_token_conversion_home.py`` fails if the arithmetic reappears in any
    other file. Semantics match the Python arms exactly: no rate → NULL (unrated, never
    $0.00); no tokens recorded → NULL; else ROUND(total, 4) — Postgres numeric ROUND is
    half-up, like ``ROUND_HALF_UP``.
    """
    places = -QUANTIZE_FOUR_PLACES.as_tuple().exponent
    divisor = f"{ONE_MILLION}.0"
    r, rt = runs_alias, rate_alias
    return (
        f"CASE"
        f" WHEN {rt}.input_cost_per_million IS NULL THEN NULL"
        f" WHEN {r}.input_tokens IS NULL AND {r}.output_tokens IS NULL THEN NULL"
        f" ELSE ROUND("
        f"(COALESCE({r}.input_tokens, 0) * {rt}.input_cost_per_million / {divisor}) + "
        f"(COALESCE({r}.output_tokens, 0) * {rt}.output_cost_per_million / {divisor}), "
        f"{places})"
        f" END"
    )


@dataclass(frozen=True)
class ModelRate:
    """Effective-dated rate definition for a model."""
    model_id: str
    input_cost_per_million: Decimal
    output_cost_per_million: Decimal
    effective_from: datetime
    id: Optional[UUID] = None
    provider: Optional[str] = None
    org_id: Optional[UUID] = None

    @property
    def model_name(self) -> str:
        return self.model_id


@dataclass(frozen=True)
class CostResult:
    """Result of token-to-USD calculation."""
    cost_usd: Optional[Decimal]
    is_rated: bool
    unrated_model: Optional[str] = None
    input_cost_usd: Optional[Decimal] = None
    output_cost_usd: Optional[Decimal] = None


def compute_token_cost_usd(
    input_tokens: Optional[int],
    output_tokens: Optional[int],
    rate: Optional[ModelRate],
    model_id: Optional[str] = None,
) -> CostResult:
    """Compute attributable USD cost for input and output token counts.

    METER-01 / METER-02 / D-257-05 / D-257-13:
      - If rate is None: returns CostResult with cost_usd=None, is_rated=False.
        Never coerces to $0.00.
      - If input_tokens and output_tokens are both None: returns cost_usd=None, is_rated=True
        (measured state where no tokens were consumed/recorded).
      - If rated: computes exact cost using Decimal arithmetic, quantized to 4 decimal places.
    """
    if rate is None:
        return CostResult(
            cost_usd=None,
            is_rated=False,
            unrated_model=model_id or (rate.model_id if rate else None),
            input_cost_usd=None,
            output_cost_usd=None,
        )

    if input_tokens is None and output_tokens is None:
        return CostResult(
            cost_usd=None,
            is_rated=True,
            unrated_model=None,
            input_cost_usd=None,
            output_cost_usd=None,
        )

    in_tokens = Decimal(input_tokens or 0)
    out_tokens = Decimal(output_tokens or 0)

    in_cost_raw = (in_tokens * rate.input_cost_per_million) / ONE_MILLION
    out_cost_raw = (out_tokens * rate.output_cost_per_million) / ONE_MILLION
    total_raw = in_cost_raw + out_cost_raw

    in_cost = in_cost_raw.quantize(QUANTIZE_FOUR_PLACES, rounding=ROUND_HALF_UP)
    out_cost = out_cost_raw.quantize(QUANTIZE_FOUR_PLACES, rounding=ROUND_HALF_UP)
    total_cost = total_raw.quantize(QUANTIZE_FOUR_PLACES, rounding=ROUND_HALF_UP)

    return CostResult(
        cost_usd=total_cost,
        is_rated=True,
        unrated_model=None,
        input_cost_usd=in_cost,
        output_cost_usd=out_cost,
    )

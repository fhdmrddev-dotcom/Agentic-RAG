"""Operator Spend & Metering API sub-router (Phase 257 / METER-07 / G-5 isolation).

Mounted onto app.api.admin.router with prefix="/spend".
Inherits the router-level require_operator gate.
Strict Blind-Spot Honesty (METER-01 / METER-07):
- Total spend sums only rated runs.
- Unrated runs are counted and footnoted, never hidden or priced at $0.00.
- Incomplete token_coverage runs are surfaced explicitly.
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field

import app.dependencies as deps
from app.db.rates import (
    get_org_spend_summary,
    get_spend_runs,
    list_model_rates,
    reprice_model,
)

logger = logging.getLogger(__name__)

router = APIRouter()


class RepriceModelRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model_id: str = Field(..., min_length=1, description="Unique model identifier")
    input_cost_per_million: Decimal = Field(..., ge=0, description="USD cost per 1M prompt tokens")
    output_cost_per_million: Decimal = Field(..., ge=0, description="USD cost per 1M completion tokens")
    provider: Optional[str] = Field(None, description="Optional provider identifier (e.g. openai, anthropic)")
    effective_from: Optional[datetime] = Field(None, description="Timestamp from which this rate is active")


async def _resolve_operator_org_id(
    request: Request,
    explicit_org_id: Optional[UUID],
    pool,
) -> UUID:
    """Resolve the org_id to query: explicit query param > X-Org-Id header > operator's first org > first org in DB."""
    if explicit_org_id is not None:
        return explicit_org_id

    header_org = request.headers.get("X-Org-Id")
    if header_org:
        try:
            return UUID(header_org)
        except ValueError:
            pass

    operator = getattr(request.state, "operator", None)
    if operator and "id" in operator:
        try:
            user_uuid = UUID(str(operator["id"]))
            row = await pool.fetchrow(
                "SELECT org_id FROM public.org_members WHERE user_id = $1 ORDER BY created_at LIMIT 1",
                user_uuid,
            )
            if row and row["org_id"]:
                return row["org_id"]
        except Exception:
            logger.debug("Failed to lookup org from operator membership", exc_info=True)

    # Fallback: first organization in DB
    fallback_row = await pool.fetchrow("SELECT id FROM public.organizations ORDER BY created_at LIMIT 1")
    if fallback_row and fallback_row["id"]:
        return fallback_row["id"]

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="No organization found to compute spend for.",
    )


@router.get("/summary")
async def get_spend_summary(
    request: Request,
    org_id: Optional[UUID] = Query(None, description="Organization ID (defaults to active org)"),
    start_time: Optional[datetime] = Query(None, description="Start timestamp filter"),
    end_time: Optional[datetime] = Query(None, description="End timestamp filter"),
):
    """Retrieve aggregated spend, volume, and blind spots for the operator spend dashboard.

    Floor-exempt (polled / viewed on dashboard open).
    """
    pool = await deps.get_pg_pool()
    target_org_id = await _resolve_operator_org_id(request, org_id, pool)

    summary = await get_org_spend_summary(
        pool=pool,
        org_id=target_org_id,
        start_time=start_time,
        end_time=end_time,
    )

    return {
        "org_id": str(target_org_id),
        "total_spend_usd": str(summary.total_spend_usd),
        "rated_runs_count": summary.rated_runs_count,
        "unrated_runs_count": summary.unrated_runs_count,
        "incomplete_coverage_count": summary.incomplete_coverage_count,
        "total_input_tokens": summary.total_input_tokens,
        "total_output_tokens": summary.total_output_tokens,
        "daily_spend": summary.daily_spend,
        "model_breakdown": summary.model_breakdown,
        "has_unrated_runs": summary.unrated_runs_count > 0,
        "has_incomplete_coverage": summary.incomplete_coverage_count > 0,
    }


@router.get("/runs")
async def get_spend_runs_list(
    request: Request,
    org_id: Optional[UUID] = Query(None, description="Organization ID"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    filter_status: Optional[str] = Query(None, description="'rated', 'unrated', 'incomplete_coverage'"),
    time_range: Optional[str] = Query(None, description="'today', '7d', '30d', 'all'"),
):
    """Retrieve paginated attributable runs with computed dollar cost and token coverage."""
    pool = await deps.get_pg_pool()
    target_org_id = await _resolve_operator_org_id(request, org_id, pool)

    runs, total_count = await get_spend_runs(
        pool=pool,
        org_id=target_org_id,
        limit=limit,
        offset=offset,
        filter_status=filter_status,
        time_range=time_range,
    )

    return {
        "runs": runs,
        "total_count": total_count,
        "limit": limit,
        "offset": offset,
    }


@router.get("/rates")
async def get_rates_list(
    request: Request,
    org_id: Optional[UUID] = Query(None, description="Optional organization ID filter"),
):
    """List registered model rates and historical rate revisions."""
    pool = await deps.get_pg_pool()
    rates = await list_model_rates(pool, org_id)
    return {"rates": rates}


@router.post("/rates", dependencies=[Depends(deps.operator_audit_floor)])
async def create_rate_revision(
    request: Request,
    payload: RepriceModelRequest,
    org_id: Optional[UUID] = Query(None, description="Optional organization ID"),
):
    """Reprice a model by appending a new effective-dated rate row.

    Audit floor attached: records operator repricing action.
    """
    pool = await deps.get_pg_pool()

    operator = getattr(request.state, "operator", None)
    operator_id = UUID(str(operator["id"])) if operator and "id" in operator else None

    # Stamp audit metadata for operator_audit_floor
    request.state.audit_label = f"Repriced model {payload.model_id}"
    request.state.audit_action = "spend.reprice_model"
    request.state.audit_is_write = True

    new_rate = await reprice_model(
        pool=pool,
        model_id=payload.model_id,
        input_cost_per_million=payload.input_cost_per_million,
        output_cost_per_million=payload.output_cost_per_million,
        provider=payload.provider,
        effective_from=payload.effective_from or datetime.now(timezone.utc),
        created_by=operator_id,
        org_id=org_id,
    )

    return {
        "status": "created",
        "rate": {
            "id": str(new_rate.id) if new_rate.id else None,
            "model_id": new_rate.model_id,
            "provider": new_rate.provider,
            "input_cost_per_million": str(new_rate.input_cost_per_million),
            "output_cost_per_million": str(new_rate.output_cost_per_million),
            "effective_from": new_rate.effective_from.isoformat() if new_rate.effective_from else None,
            "org_id": str(new_rate.org_id) if new_rate.org_id else None,
        },
    }

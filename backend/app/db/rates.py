"""Database access layer for model rates, spend aggregations, and blind-spot honesty.

Phase 257 (METER-01, METER-02, METER-07).
All queries parameterised with $1..$N asyncpg binds.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

import asyncpg

from app.services.pricing_service import ModelRate, compute_token_cost_usd

COMPLETE_COVERAGE_LEGS = frozenset({"agent", "single", "batch", "emit"})


@dataclass(frozen=True)
class SpendSummary:
    total_spend_usd: Decimal
    rated_runs_count: int
    unrated_runs_count: int
    incomplete_coverage_count: int
    total_input_tokens: int
    total_output_tokens: int
    daily_spend: list[dict[str, Any]]
    model_breakdown: list[dict[str, Any]]


async def get_rate_for_model(
    pool: asyncpg.Pool,
    model_id: str,
    provider: str | None = None,
    effective_at: datetime | None = None,
    org_id: UUID | None = None,
) -> ModelRate | None:
    """Retrieve the effective rate for a model as of a given timestamp.

    Matches model_name and optional provider with fallback to provider IS NULL,
    and optional org_id with fallback to org_id IS NULL.
    Orders by effective_from DESC to retrieve the latest rate active at effective_at.
    """
    effective_ts = effective_at or datetime.now(timezone.utc)

    query = """
        SELECT id, model_id, provider, input_cost_per_million, output_cost_per_million,
               effective_from, org_id, created_at
        FROM public.model_rates
        WHERE model_id = $1
          AND (org_id = $2 OR org_id IS NULL)
          AND ($3::text IS NULL OR provider = $3 OR provider IS NULL)
          AND effective_from <= $4
        ORDER BY
          (org_id IS NOT NULL) DESC,
          (provider IS NOT NULL AND provider = $3) DESC,
          effective_from DESC
        LIMIT 1
    """
    row = await pool.fetchrow(query, model_id, org_id, provider, effective_ts)
    if not row:
        return None

    return ModelRate(
        id=row["id"],
        model_id=row["model_id"],
        provider=row["provider"],
        input_cost_per_million=Decimal(str(row["input_cost_per_million"])),
        output_cost_per_million=Decimal(str(row["output_cost_per_million"])),
        effective_from=row["effective_from"],
        org_id=row["org_id"],
    )


async def list_model_rates(
    pool: asyncpg.Pool,
    org_id: UUID | None = None,
) -> list[dict[str, Any]]:
    """List all registered rates for display in the admin rates tab."""
    query = """
        SELECT id, model_id, provider, input_cost_per_million, output_cost_per_million,
               effective_from, org_id, created_at
        FROM public.model_rates
        WHERE (org_id = $1 OR org_id IS NULL)
        ORDER BY model_id ASC, effective_from DESC
    """
    rows = await pool.fetch(query, org_id)
    return [
        {
            "id": str(r["id"]),
            "model_name": r["model_id"],
            "model_id": r["model_id"],
            "provider": r["provider"],
            "input_cost_per_million": str(r["input_cost_per_million"]),
            "output_cost_per_million": str(r["output_cost_per_million"]),
            "effective_from": r["effective_from"].isoformat() if r["effective_from"] else None,
            "effective_to": None,
            "org_id": str(r["org_id"]) if r["org_id"] else None,
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in rows
    ]


async def reprice_model(
    pool: asyncpg.Pool,
    model_id: str,
    input_cost_per_million: Decimal,
    output_cost_per_million: Decimal,
    provider: str | None = None,
    effective_from: datetime | None = None,
    created_by: UUID | None = None,
    org_id: UUID | None = None,
) -> ModelRate:
    """Insert a new rate row for a model with effective_from (default now()).

    Append-only: preserves historical rates for past runs.
    """
    eff_from = effective_from or datetime.now(timezone.utc)

    query = """
        INSERT INTO public.model_rates (
            model_id,
            provider,
            input_cost_per_million,
            output_cost_per_million,
            effective_from,
            org_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, model_id, provider, input_cost_per_million, output_cost_per_million,
                  effective_from, org_id, created_at
    """
    row = await pool.fetchrow(
        query,
        model_id,
        provider,
        input_cost_per_million,
        output_cost_per_million,
        eff_from,
        org_id,
    )
    return ModelRate(
        id=row["id"],
        model_id=row["model_id"],
        provider=row["provider"],
        input_cost_per_million=Decimal(str(row["input_cost_per_million"])),
        output_cost_per_million=Decimal(str(row["output_cost_per_million"])),
        effective_from=row["effective_from"],
        org_id=row["org_id"],
    )


async def get_org_spend_summary(
    pool: asyncpg.Pool,
    org_id: UUID,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
) -> SpendSummary:
    """Calculate aggregated spend for an organization within a time window.

    Strict blind-spot honesty:
    - total_spend_usd sums only rated runs.
    - unrated_runs_count explicitly counts unrated runs excluded from the sum.
    - incomplete_coverage_count queries workflow_runs using the partial index.
    - daily_spend provides a 14-day time series.
    - model_breakdown provides per-model spend, volume, and rate status.
    """
    # 1. Runs spend totals query
    summary_query = """
        WITH rated_runs AS (
            SELECT
                r.run_id,
                r.model,
                r.input_tokens,
                r.output_tokens,
                r.started_at,
                rate.input_cost_per_million,
                rate.output_cost_per_million,
                CASE
                    WHEN rate.input_cost_per_million IS NOT NULL THEN
                        ROUND(
                            (COALESCE(r.input_tokens, 0) * rate.input_cost_per_million / 1000000.0) +
                            (COALESCE(r.output_tokens, 0) * rate.output_cost_per_million / 1000000.0),
                            4
                        )
                    ELSE NULL
                END AS cost_usd
            FROM public.runs r
            LEFT JOIN LATERAL (
                SELECT mr.input_cost_per_million, mr.output_cost_per_million
                FROM public.model_rates mr
                WHERE mr.model_id = r.model
                  AND (mr.org_id = r.org_id OR mr.org_id IS NULL)
                  AND (mr.provider = r.provider OR mr.provider IS NULL)
                  AND mr.effective_from <= r.started_at
                ORDER BY
                  (mr.org_id IS NOT NULL) DESC,
                  (mr.provider IS NOT NULL AND mr.provider = r.provider) DESC,
                  mr.effective_from DESC
                LIMIT 1
            ) rate ON true
            WHERE r.org_id = $1
              AND r.parent_run_id IS NULL
              AND ($2::timestamptz IS NULL OR r.started_at >= $2)
              AND ($3::timestamptz IS NULL OR r.started_at <= $3)
        )
        SELECT
            COALESCE(SUM(cost_usd), 0.0000) AS total_spend_usd,
            COUNT(*) FILTER (WHERE cost_usd IS NOT NULL) AS rated_runs_count,
            COUNT(*) FILTER (WHERE cost_usd IS NULL) AS unrated_runs_count,
            COALESCE(SUM(input_tokens), 0) AS total_input_tokens,
            COALESCE(SUM(output_tokens), 0) AS total_output_tokens
        FROM rated_runs;
    """
    totals_row = await pool.fetchrow(summary_query, org_id, start_time, end_time)

    total_spend = Decimal(str(totals_row["total_spend_usd"] or "0.0000"))
    rated_count = int(totals_row["rated_runs_count"] or 0)
    unrated_count = int(totals_row["unrated_runs_count"] or 0)
    total_in = int(totals_row["total_input_tokens"] or 0)
    total_out = int(totals_row["total_output_tokens"] or 0)

    # 2. Incomplete coverage query on workflow_runs (utilizing partial index)
    coverage_query = """
        SELECT COUNT(*) AS incomplete_count
        FROM public.workflow_runs
        WHERE org_id = $1
          AND (
              token_coverage IS NULL
              OR NOT (token_coverage @> ARRAY['agent','single','batch','emit']::text[])
          )
          AND ($2::timestamptz IS NULL OR created_at >= $2)
          AND ($3::timestamptz IS NULL OR created_at <= $3);
    """
    cov_row = await pool.fetchrow(coverage_query, org_id, start_time, end_time)
    incomplete_cov = int(cov_row["incomplete_count"] or 0) if cov_row else 0

    # 3. Daily spend aggregation (last 14 days or filtered window)
    daily_query = """
        WITH day_series AS (
            SELECT
                DATE_TRUNC('day', r.started_at) AS day,
                CASE
                    WHEN rate.input_cost_per_million IS NOT NULL THEN
                        ROUND(
                            (COALESCE(r.input_tokens, 0) * rate.input_cost_per_million / 1000000.0) +
                            (COALESCE(r.output_tokens, 0) * rate.output_cost_per_million / 1000000.0),
                            4
                        )
                    ELSE NULL
                END AS cost_usd
            FROM public.runs r
            LEFT JOIN LATERAL (
                SELECT mr.input_cost_per_million, mr.output_cost_per_million
                FROM public.model_rates mr
                WHERE mr.model_id = r.model
                  AND (mr.org_id = r.org_id OR mr.org_id IS NULL)
                  AND (mr.provider = r.provider OR mr.provider IS NULL)
                  AND mr.effective_from <= r.started_at
                ORDER BY
                  (mr.org_id IS NOT NULL) DESC,
                  (mr.provider IS NOT NULL AND mr.provider = r.provider) DESC,
                  mr.effective_from DESC
                LIMIT 1
            ) rate ON true
            WHERE r.org_id = $1
              AND r.parent_run_id IS NULL
              AND ($2::timestamptz IS NULL OR r.started_at >= $2)
              AND ($3::timestamptz IS NULL OR r.started_at <= $3)
        )
        SELECT
            TO_CHAR(day, 'YYYY-MM-DD') AS date_str,
            COALESCE(SUM(cost_usd), 0.0000) AS spend_usd,
            COUNT(*) FILTER (WHERE cost_usd IS NOT NULL) AS rated_count,
            COUNT(*) FILTER (WHERE cost_usd IS NULL) AS unrated_count
        FROM day_series
        GROUP BY day
        ORDER BY day ASC;
    """
    daily_rows = await pool.fetch(daily_query, org_id, start_time, end_time)
    daily_spend = [
        {
            "date": r["date_str"],
            "spend_usd": str(r["spend_usd"]),
            "rated_runs": int(r["rated_count"]),
            "unrated_runs": int(r["unrated_count"]),
        }
        for r in daily_rows
    ]

    # 4. Model breakdown aggregation
    model_query = """
        WITH model_runs AS (
            SELECT
                r.model,
                r.provider,
                r.input_tokens,
                r.output_tokens,
                rate.input_cost_per_million,
                CASE
                    WHEN rate.input_cost_per_million IS NOT NULL THEN
                        ROUND(
                            (COALESCE(r.input_tokens, 0) * rate.input_cost_per_million / 1000000.0) +
                            (COALESCE(r.output_tokens, 0) * rate.output_cost_per_million / 1000000.0),
                            4
                        )
                    ELSE NULL
                END AS cost_usd
            FROM public.runs r
            LEFT JOIN LATERAL (
                SELECT mr.input_cost_per_million, mr.output_cost_per_million
                FROM public.model_rates mr
                WHERE mr.model_id = r.model
                  AND (mr.org_id = r.org_id OR mr.org_id IS NULL)
                  AND (mr.provider = r.provider OR mr.provider IS NULL)
                  AND mr.effective_from <= r.started_at
                ORDER BY
                  (mr.org_id IS NOT NULL) DESC,
                  (mr.provider IS NOT NULL AND mr.provider = r.provider) DESC,
                  mr.effective_from DESC
                LIMIT 1
            ) rate ON true
            WHERE r.org_id = $1
              AND r.parent_run_id IS NULL
              AND ($2::timestamptz IS NULL OR r.started_at >= $2)
              AND ($3::timestamptz IS NULL OR r.started_at <= $3)
        )
        SELECT
            model,
            COALESCE(provider, 'unknown') AS provider,
            COALESCE(SUM(cost_usd), 0.0000) AS spend_usd,
            COALESCE(SUM(input_tokens), 0) AS input_tokens,
            COALESCE(SUM(output_tokens), 0) AS output_tokens,
            COUNT(*) AS run_count,
            COUNT(*) FILTER (WHERE cost_usd IS NOT NULL) AS rated_count,
            COUNT(*) FILTER (WHERE cost_usd IS NULL) AS unrated_count,
            BOOL_AND(input_cost_per_million IS NOT NULL) AS is_fully_rated
        FROM model_runs
        GROUP BY model, provider
        ORDER BY spend_usd DESC, run_count DESC;
    """
    model_rows = await pool.fetch(model_query, org_id, start_time, end_time)
    model_breakdown = [
        {
            "model_name": r["model"],
            "provider": r["provider"],
            "spend_usd": str(r["spend_usd"]) if r["rated_count"] > 0 else None,
            "input_tokens": int(r["input_tokens"]),
            "output_tokens": int(r["output_tokens"]),
            "total_tokens": int(r["input_tokens"] + r["output_tokens"]),
            "run_count": int(r["run_count"]),
            "rated_count": int(r["rated_count"]),
            "unrated_count": int(r["unrated_count"]),
            "is_rated": bool(r["is_fully_rated"]),
        }
        for r in model_rows
    ]

    return SpendSummary(
        total_spend_usd=total_spend,
        rated_runs_count=rated_count,
        unrated_runs_count=unrated_count,
        incomplete_coverage_count=incomplete_cov,
        total_input_tokens=total_in,
        total_output_tokens=total_out,
        daily_spend=daily_spend,
        model_breakdown=model_breakdown,
    )


async def get_spend_runs(
    pool: asyncpg.Pool,
    org_id: UUID,
    limit: int = 50,
    offset: int = 0,
    filter_status: str | None = None,
    time_range: str | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """Retrieve paginated runs with effective rates, computed cost, and coverage markers.

    filter_status: 'rated' | 'unrated' | 'incomplete_coverage' | None
    time_range: 'today' | '7d' | '30d' | 'all' | None
    """
    time_clause = ""
    if time_range == "today":
        time_clause = "AND r.started_at >= CURRENT_DATE"
    elif time_range == "7d":
        time_clause = "AND r.started_at >= (NOW() - INTERVAL '7 days')"
    elif time_range == "30d":
        time_clause = "AND r.started_at >= (NOW() - INTERVAL '30 days')"

    base_query = f"""
        FROM public.runs r
        LEFT JOIN LATERAL (
            SELECT mr.input_cost_per_million, mr.output_cost_per_million
            FROM public.model_rates mr
            WHERE mr.model_id = r.model
              AND (mr.org_id = r.org_id OR mr.org_id IS NULL)
              AND (mr.provider = r.provider OR mr.provider IS NULL)
              AND mr.effective_from <= r.started_at
            ORDER BY
              (mr.org_id IS NOT NULL) DESC,
              (mr.provider IS NOT NULL AND mr.provider = r.provider) DESC,
              mr.effective_from DESC
            LIMIT 1
        ) rate ON true
        LEFT JOIN public.workflow_runs wr ON wr.thread_id = r.thread_id
        WHERE r.org_id = $1
          AND r.parent_run_id IS NULL
          {time_clause}
    """

    status_filter_clause = ""
    if filter_status == "rated":
        status_filter_clause = "AND rate.input_cost_per_million IS NOT NULL"
    elif filter_status == "unrated":
        status_filter_clause = "AND rate.input_cost_per_million IS NULL"
    elif filter_status == "incomplete_coverage":
        status_filter_clause = (
            "AND (wr.token_coverage IS NULL OR NOT (wr.token_coverage @> ARRAY['agent','single','batch','emit']::text[]))"
        )

    count_query = f"""
        SELECT COUNT(*) AS total
        {base_query}
        {status_filter_clause}
    """
    count_row = await pool.fetchrow(count_query, org_id)
    total_count = int(count_row["total"] or 0) if count_row else 0

    select_query = f"""
        SELECT
            r.run_id,
            r.thread_id,
            r.user_id,
            r.status,
            r.model,
            r.provider,
            r.started_at,
            r.completed_at,
            r.input_tokens,
            r.output_tokens,
            rate.input_cost_per_million,
            rate.output_cost_per_million,
            wr.token_coverage,
            CASE
                WHEN rate.input_cost_per_million IS NOT NULL THEN
                    ROUND(
                        (COALESCE(r.input_tokens, 0) * rate.input_cost_per_million / 1000000.0) +
                        (COALESCE(r.output_tokens, 0) * rate.output_cost_per_million / 1000000.0),
                        4
                    )
                ELSE NULL
            END AS cost_usd
        {base_query}
        {status_filter_clause}
        ORDER BY r.started_at DESC
        LIMIT $2 OFFSET $3
    """
    rows = await pool.fetch(select_query, org_id, limit, offset)

    items = []
    for r in rows:
        is_rated = r["cost_usd"] is not None
        cost_usd_str = str(r["cost_usd"]) if is_rated else None
        coverage_list = list(r["token_coverage"]) if r["token_coverage"] is not None else None
        is_complete = (
            COMPLETE_COVERAGE_LEGS.issubset(set(coverage_list))
            if coverage_list is not None
            else False
        )

        items.append({
            "run_id": str(r["run_id"]),
            "thread_id": str(r["thread_id"]) if r["thread_id"] else None,
            "status": r["status"],
            "model": r["model"],
            "provider": r["provider"],
            "started_at": r["started_at"].isoformat() if r["started_at"] else None,
            "completed_at": r["completed_at"].isoformat() if r["completed_at"] else None,
            "input_tokens": r["input_tokens"],
            "output_tokens": r["output_tokens"],
            "cost_usd": cost_usd_str,
            "is_rated": is_rated,
            "token_coverage": coverage_list,
            "is_coverage_complete": is_complete,
        })

    return items, total_count

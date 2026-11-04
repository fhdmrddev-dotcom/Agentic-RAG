"""Phase 305-03 (GUARD-02; D-29 / D-55; T-305-14 / T-305-30) — the ONLY writer of ``public.mcp_usage``.

One row per provider call an MCP tool makes (the query embedding of a search; a rerank), so MCP
spend joins the ``per_root`` spend CTE in ``db/rates.py`` as a second leg (its only reader).

⚠ **THE ORG IS EXPLICIT IN EVERY ROW.** This runs on the **service-role asyncpg pool**, which is
``BYPASSRLS``; migration 222 gives the table RLS with no client policy at all (deny-all to every
client role). Nothing here infers an org: the caller passes the principal's ``org_id``, which the
MCP edge took from the resolved key and nowhere else.

``input_tokens`` is the provider's MEASURED usage, or ``NULL`` when it returned none — never an
estimate and never 0, so an unmeasured row reads as unmeasured on the spend page.
"""
from __future__ import annotations

from uuid import UUID

import asyncpg


def _uuid(value) -> UUID | None:
    if value is None:
        return None
    return value if isinstance(value, UUID) else UUID(str(value))


async def insert_usage(
    pool: asyncpg.Pool,
    *,
    org_id,
    user_id,
    api_key_id,
    tool: str,
    model: str,
    provider: str,
    input_tokens: int | None,
    output_tokens: int = 0,
    status: str,
) -> str:
    """Insert one ``mcp_usage`` row and return its id."""
    row_id = await pool.fetchval(
        "INSERT INTO public.mcp_usage (org_id, user_id, api_key_id, tool, model, provider,"
        " input_tokens, output_tokens, status)"
        " VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id",
        _uuid(org_id), _uuid(user_id), _uuid(api_key_id), tool, model, provider,
        input_tokens, output_tokens, status,
    )
    return str(row_id)

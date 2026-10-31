"""Phase 305-04 (GUARD-03; D-36 / D-56; T-305-24) — read and write one org's PII redaction switch.

``organizations.pii_redaction_enabled`` (mig 222, ``NOT NULL DEFAULT false``) is a dedicated column
OUTSIDE the ``authenticated`` column UPDATE grant (mig 194), so the audited
``PUT /org/api-keys/pii-redaction`` route is its only writer — the ``mcp_enabled`` precedent
(``db/api_keys.mcp_switches`` / ``set_org_mcp_enabled``, copied here with the column swapped so
that FIRING module is not touched).

⚠ **THE ORG IS EXPLICIT IN EVERY STATEMENT.** These run on the service-role asyncpg pool, which is
``BYPASSRLS``; ``WHERE id = $1`` with a bound org id is the whole predicate, and the caller passes
the principal's (or the validated active) org — never one read from a request body.

⚠ **READ LIVE, EVERY CALL.** Never through ``load_app_settings()`` or any cache: the outbound guard
calls ``pii_redaction_enabled`` once per MCP tool call, so a switch turned on applies to the very
next result (stricter than D-36's 30 s bound). ``None`` means the org row is missing; the guard
treats ``None`` — and any exception — as ON (redact, never pass through).
"""
from __future__ import annotations

from uuid import UUID

import asyncpg


async def pii_redaction_enabled(pool: asyncpg.Pool, org_id: UUID | str) -> bool | None:
    """The org's switch, or ``None`` when the org row is missing."""
    return await pool.fetchval(
        "SELECT pii_redaction_enabled FROM public.organizations WHERE id = $1",
        org_id if isinstance(org_id, UUID) else UUID(str(org_id)),
    )


async def set_pii_redaction_enabled(
    pool: asyncpg.Pool, *, org_id: UUID | str, enabled: bool
) -> bool | None:
    """Flip one org's switch; returns the stored value, ``None`` for a missing org. The route that
    calls this is behind ``require_org_manage`` and writes the audit row after it returns."""
    return await pool.fetchval(
        "UPDATE public.organizations SET pii_redaction_enabled = $2, updated_at = now() "
        "WHERE id = $1 RETURNING pii_redaction_enabled",
        org_id if isinstance(org_id, UUID) else UUID(str(org_id)),
        bool(enabled),
    )

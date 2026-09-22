"""Canonical commercial entitlement and tier capability evaluation service (TIER-01).

Phase 258: A Tier Becomes Enforceable.
Design decisions:
  - TIER-01 / D-258-03: Single commercial boundary home in backend/app/services/entitlement_service.py.
  - TIER-02 / D-258-07: Queries public.tier_capabilities via app.db.entitlements without hardcoded branches.
  - TIER-03 / D-258-05: EntitlementDeniedException emits structured 403 naming required tier and upgrade hint.
  - TIER-04 / D-258-04: Guarded by AST single-home fence test_258_single_entitlement_home.py.
  - TIER-05 / D-258-06: Strict fail-closed on missing org or DB error (in contrast to load_run_budget).
"""

from __future__ import annotations

from dataclasses import dataclass
import logging
from typing import Any
from uuid import UUID

import asyncpg
from fastapi import Depends, HTTPException, Request, status

from app.db.entitlements import resolve_org_entitlement
from app.dependencies import get_active_org_id, get_pg_pool

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EntitlementResult:
    allowed: bool
    capability: str
    current_tier: str | None = None
    required_tier: str | None = None
    reason: str | None = None
    upgrade_hint: str | None = None


class EntitlementDeniedException(HTTPException):
    """Structured 403 Forbidden exception for capability entitlement denials (TIER-03).

    Never returns a bare 403. Emits structured JSON naming required tier,
    current tier, capability key, and actionable upgrade guidance.
    """

    def __init__(self, result: EntitlementResult):
        req_tier = result.required_tier or "enterprise"
        curr_tier = result.current_tier or "unassigned"
        upgrade_hint = result.upgrade_hint or f"Upgrade to {str(req_tier).title()} to use {result.capability}."
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "detail": f"Capability '{result.capability}' requires '{req_tier}' tier (current tier: '{curr_tier}')",
                "error": "entitlement_required",
                "capability": result.capability,
                "required_tier": result.required_tier,
                "current_tier": result.current_tier,
                "upgrade_hint": upgrade_hint,
            },
        )
        self.result = result


class EntitlementUnavailableException(HTTPException):
    """Structured 503 Service Unavailable exception for infrastructure/DB failures (TIER-05 / D-258-06).

    Ensures that paying customers hitting a transient database outage or connectivity
    blip receive 503 Service Unavailable instead of being told to upgrade via 403 Forbidden.
    """

    def __init__(self, result: EntitlementResult):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "detail": f"Entitlement service temporarily unavailable while checking capability '{result.capability}'",
                "error": "entitlement_service_unavailable",
                "capability": result.capability,
                "reason": result.reason,
            },
        )
        self.result = result


async def check_entitlement(
    pool: asyncpg.Pool, org_id: str | UUID, capability: str
) -> EntitlementResult:
    """Canonical commercial entitlement check (TIER-01, TIER-05).

    Resolves capability access for an organization using the tier_capabilities
    data matrix and additive add_ons overrides. Fails closed on database
    errors or missing organizations (D-258-06).
    """
    allowed, current_tier, required_tier, reason = await resolve_org_entitlement(
        pool, org_id, capability
    )

    upgrade_hint = None
    if not allowed and required_tier:
        upgrade_hint = f"Upgrade to {str(required_tier).title()} to use {capability}."

    return EntitlementResult(
        allowed=allowed,
        capability=capability,
        current_tier=current_tier,
        required_tier=required_tier,
        reason=reason,
        upgrade_hint=upgrade_hint,
    )


async def enforce_entitlement(
    pool: asyncpg.Pool, org_id: str | UUID | None, capability: str
) -> EntitlementResult:
    """Raise unless ``org_id`` is entitled to ``capability`` (TIER-01, TIER-03, TIER-05).

    The raising form of ``check_entitlement`` for call sites that are not a FastAPI
    dependency (e.g. the workflow kickoff preflight). ``org_id=None`` fails closed with
    a structured 403 — an unresolvable org is never admitted. A DB/connection failure
    is a 503, never an upgrade prompt.
    """
    if not org_id:
        raise EntitlementDeniedException(EntitlementResult(
            allowed=False, capability=capability, reason="No active organization",
        ))
    result = await check_entitlement(pool, org_id, capability)
    if not result.allowed:
        if result.reason and ("database error" in result.reason.lower() or "connection" in result.reason.lower()):
            raise EntitlementUnavailableException(result)
        raise EntitlementDeniedException(result)
    return result


def require_capability(capability: str):
    """FastAPI dependency factory enforcing capability entitlement (TIER-01, TIER-03, TIER-05).

    Usage:
        @router.post("/workflows", dependencies=[Depends(require_capability("workflows"))])
        async def create_workflow(...): ...
    """

    async def _require_capability(
        request: Request,
        active_org_id: str = Depends(get_active_org_id),
        pool: asyncpg.Pool = Depends(get_pg_pool),
    ) -> str:
        await enforce_entitlement(pool, active_org_id, capability)
        return active_org_id

    return _require_capability

"""Unit tests for commercial entitlement service (TIER-01, TIER-03, TIER-05).

Phase 258: A Tier Becomes Enforceable.
Tests:
  - check_entitlement: allowed, denied, and fail-closed branches
  - EntitlementDeniedException: structured 403 JSON detail, never a bare string
  - require_capability: FastAPI dependency behavior (success & 403 refusal)
  - Full HTTP roundtrip with FastAPI TestClient verifying structured 403 error payload
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import Depends, FastAPI, status
from fastapi.testclient import TestClient

from app.services.entitlement_service import (
    EntitlementDeniedException,
    EntitlementResult,
    EntitlementUnavailableException,
    check_entitlement,
    require_capability,
)


@pytest.mark.asyncio
async def test_check_entitlement_allowed():
    """Entitled capability returns allowed=True with current_tier."""
    org_id = uuid4()
    mock_pool = MagicMock()

    with patch(
        "app.services.entitlement_service.resolve_org_entitlement",
        new_callable=AsyncMock,
        return_value=(True, "pro", None, None),
    ) as mock_resolve:
        result = await check_entitlement(mock_pool, org_id, "workflows")
        mock_resolve.assert_awaited_once_with(mock_pool, org_id, "workflows")

        assert result.allowed is True
        assert result.capability == "workflows"
        assert result.current_tier == "pro"
        assert result.required_tier is None
        assert result.reason is None
        assert result.upgrade_hint is None


@pytest.mark.asyncio
async def test_check_entitlement_denied_with_upgrade_hint():
    """Denied capability generates actionable upgrade hint naming required tier."""
    org_id = uuid4()
    mock_pool = MagicMock()

    with patch(
        "app.services.entitlement_service.resolve_org_entitlement",
        new_callable=AsyncMock,
        return_value=(False, "standard", "pro", "Capability not enabled for tier"),
    ):
        result = await check_entitlement(mock_pool, org_id, "workflows")

        assert result.allowed is False
        assert result.capability == "workflows"
        assert result.current_tier == "standard"
        assert result.required_tier == "pro"
        assert result.reason == "Capability not enabled for tier"
        assert result.upgrade_hint == "Upgrade to Pro to use workflows."


@pytest.mark.asyncio
async def test_check_entitlement_denied_enterprise():
    """Enterprise capability denial names Enterprise in upgrade hint."""
    org_id = uuid4()
    mock_pool = MagicMock()

    with patch(
        "app.services.entitlement_service.resolve_org_entitlement",
        new_callable=AsyncMock,
        return_value=(False, "pro", "enterprise", "Capability not enabled for tier"),
    ):
        result = await check_entitlement(mock_pool, org_id, "audit_export")

        assert result.allowed is False
        assert result.capability == "audit_export"
        assert result.current_tier == "pro"
        assert result.required_tier == "enterprise"
        assert result.upgrade_hint == "Upgrade to Enterprise to use audit_export."


@pytest.mark.asyncio
async def test_check_entitlement_fail_closed_on_db_error():
    """Strict fail-closed on DB errors or unresolvable orgs (TIER-05, D-258-06)."""
    org_id = uuid4()
    mock_pool = MagicMock()

    with patch(
        "app.services.entitlement_service.resolve_org_entitlement",
        new_callable=AsyncMock,
        return_value=(False, None, None, "Database error: connection refused"),
    ):
        result = await check_entitlement(mock_pool, org_id, "workflows")

        assert result.allowed is False
        assert result.capability == "workflows"
        assert result.current_tier is None
        assert result.required_tier is None
        assert "Database error" in (result.reason or "")
        assert result.upgrade_hint is None


def test_entitlement_denied_exception_payload_structure():
    """EntitlementDeniedException detail is structured dict naming tier, never bare string."""
    result = EntitlementResult(
        allowed=False,
        capability="custom_models",
        current_tier="standard",
        required_tier="pro",
        reason="Capability not enabled for tier",
        upgrade_hint="Upgrade to Pro to use custom_models.",
    )
    exc = EntitlementDeniedException(result)

    assert exc.status_code == status.HTTP_403_FORBIDDEN
    assert isinstance(exc.detail, dict)
    assert exc.detail["error"] == "entitlement_required"
    assert exc.detail["capability"] == "custom_models"
    assert exc.detail["required_tier"] == "pro"
    assert exc.detail["current_tier"] == "standard"
    assert exc.detail["upgrade_hint"] == "Upgrade to Pro to use custom_models."
    assert "requires 'pro' tier" in exc.detail["detail"]
    assert "current tier: 'standard'" in exc.detail["detail"]
    assert exc.result is result


def test_entitlement_denied_exception_handles_missing_tiers():
    """EntitlementDeniedException handles None current_tier/required_tier gracefully."""
    result = EntitlementResult(
        allowed=False,
        capability="secret_feature",
        current_tier=None,
        required_tier=None,
    )
    exc = EntitlementDeniedException(result)

    assert exc.status_code == 403
    assert exc.detail["error"] == "entitlement_required"
    assert exc.detail["capability"] == "secret_feature"
    assert exc.detail["required_tier"] is None
    assert exc.detail["current_tier"] is None
    assert "Upgrade to Enterprise" in exc.detail["upgrade_hint"]


def test_entitlement_unavailable_exception_payload_structure():
    """F-4: EntitlementUnavailableException emits 503 with honest infrastructure error."""
    result = EntitlementResult(
        allowed=False,
        capability="workflows",
        reason="Database error: connection timeout",
    )
    exc = EntitlementUnavailableException(result)

    assert exc.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert exc.detail["error"] == "entitlement_service_unavailable"
    assert exc.detail["capability"] == "workflows"
    assert "Database error: connection timeout" in exc.detail["reason"]
    assert "temporarily unavailable" in exc.detail["detail"]


@pytest.mark.asyncio
async def test_require_capability_dependency_allowed():
    """require_capability dependency succeeds and returns active_org_id when entitled."""
    dep_func = require_capability("workflows")
    mock_request = MagicMock()
    mock_pool = MagicMock()
    mock_org_id = str(uuid4())

    with patch(
        "app.services.entitlement_service.check_entitlement",
        new_callable=AsyncMock,
        return_value=EntitlementResult(allowed=True, capability="workflows", current_tier="pro"),
    ) as mock_check:
        resolved_org = await dep_func(
            request=mock_request,
            active_org_id=mock_org_id,
            pool=mock_pool,
        )
        assert resolved_org == mock_org_id
        mock_check.assert_awaited_once_with(mock_pool, mock_org_id, "workflows")


@pytest.mark.asyncio
async def test_require_capability_dependency_denied():
    """require_capability dependency raises EntitlementDeniedException when not entitled."""
    dep_func = require_capability("workflows")
    mock_request = MagicMock()
    mock_pool = MagicMock()
    mock_org_id = str(uuid4())

    denied_res = EntitlementResult(
        allowed=False,
        capability="workflows",
        current_tier="standard",
        required_tier="pro",
        upgrade_hint="Upgrade to Pro to use workflows.",
    )

    with patch(
        "app.services.entitlement_service.check_entitlement",
        new_callable=AsyncMock,
        return_value=denied_res,
    ):
        with pytest.raises(EntitlementDeniedException) as exc_info:
            await dep_func(
                request=mock_request,
                active_org_id=mock_org_id,
                pool=mock_pool,
            )

        exc = exc_info.value
        assert exc.status_code == 403
        assert exc.detail["error"] == "entitlement_required"
        assert exc.detail["capability"] == "workflows"
        assert exc.detail["required_tier"] == "pro"
        assert exc.detail["current_tier"] == "standard"


@pytest.mark.asyncio
async def test_require_capability_dependency_raises_503_on_database_error():
    """F-4: require_capability dependency raises EntitlementUnavailableException (503) on DB error."""
    dep_func = require_capability("workflows")
    mock_request = MagicMock()
    mock_pool = MagicMock()
    mock_org_id = str(uuid4())

    error_res = EntitlementResult(
        allowed=False,
        capability="workflows",
        reason="Database error: pool connection exhausted",
    )

    with patch(
        "app.services.entitlement_service.check_entitlement",
        new_callable=AsyncMock,
        return_value=error_res,
    ):
        with pytest.raises(EntitlementUnavailableException) as exc_info:
            await dep_func(
                request=mock_request,
                active_org_id=mock_org_id,
                pool=mock_pool,
            )

        exc = exc_info.value
        assert exc.status_code == 503
        assert exc.detail["error"] == "entitlement_service_unavailable"
        assert "temporarily unavailable" in exc.detail["detail"]


def test_require_capability_fastapi_http_roundtrip():
    """Test full HTTP roundtrip through FastAPI TestClient demonstrating structured responses."""
    test_app = FastAPI()
    org_id = str(uuid4())

    @test_app.post(
        "/api/test-workflows",
        dependencies=[Depends(require_capability("workflows"))],
    )
    async def create_test_workflow():
        return {"status": "created"}

    from app.dependencies import get_active_org_id, get_pg_pool

    test_app.dependency_overrides[get_active_org_id] = lambda: org_id
    test_app.dependency_overrides[get_pg_pool] = lambda: MagicMock()

    with patch(
        "app.services.entitlement_service.check_entitlement",
        new_callable=AsyncMock,
    ) as mock_check:
        client = TestClient(test_app)

        # 1. Allowed request -> 200 OK
        mock_check.return_value = EntitlementResult(
            allowed=True,
            capability="workflows",
            current_tier="enterprise",
        )
        resp = client.post("/api/test-workflows")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json() == {"status": "created"}

        # 2. Denied request -> 403 Forbidden with structured JSON
        mock_check.return_value = EntitlementResult(
            allowed=False,
            capability="workflows",
            current_tier="standard",
            required_tier="pro",
            reason="Capability not enabled for tier",
            upgrade_hint="Upgrade to Pro to use workflows.",
        )
        resp = client.post("/api/test-workflows")
        assert resp.status_code == status.HTTP_403_FORBIDDEN
        data = resp.json()

        assert "detail" in data
        detail = data["detail"]
        assert detail["error"] == "entitlement_required"
        assert detail["capability"] == "workflows"
        assert detail["required_tier"] == "pro"
        assert detail["current_tier"] == "standard"
        assert detail["upgrade_hint"] == "Upgrade to Pro to use workflows."
        assert "Capability 'workflows' requires 'pro' tier" in detail["detail"]

        # 3. Unassigned tier (F-1) -> 403 Forbidden with unassigned current_tier
        mock_check.return_value = EntitlementResult(
            allowed=False,
            capability="workflows",
            current_tier=None,
            required_tier="enterprise",
            reason="Organization has no subscription tier assigned (fail-closed)",
        )
        resp = client.post("/api/test-workflows")
        assert resp.status_code == status.HTTP_403_FORBIDDEN
        detail_unassigned = resp.json()["detail"]
        assert detail_unassigned["error"] == "entitlement_required"
        assert detail_unassigned["current_tier"] is None
        assert "unassigned" in detail_unassigned["detail"]

        # 4. Database outage (F-4) -> 503 Service Unavailable, NEVER 403 upgrade
        mock_check.return_value = EntitlementResult(
            allowed=False,
            capability="workflows",
            reason="Database error: connection dropped",
        )
        resp = client.post("/api/test-workflows")
        assert resp.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        detail_503 = resp.json()["detail"]
        assert detail_503["error"] == "entitlement_service_unavailable"
        assert "temporarily unavailable" in detail_503["detail"]

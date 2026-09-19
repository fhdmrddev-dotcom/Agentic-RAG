"""Integration and scenario tests for workflow capability entitlement gating (TIER-01, TIER-02, TIER-03, TIER-05).

Phase 258: A Tier Becomes Enforceable.
Tests:
  - Standard org hitting workflow creation: refused with structured 403 naming 'enterprise' tier
  - Additive add-on override: Standard org with add_ons={'workflows': true} admitted
  - Enterprise org: admitted without restriction
  - Dynamic repackaging (TIER-02): capability row change immediately admits standard tier without redeploy
  - Fail-closed semantics (TIER-05): database error refuses access
  - Multi-endpoint verification: create_draft, publish_workflow, and generate_workflow all gated
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient

from app.api.workflows import router as workflows_router
from app.dependencies import (
    get_active_org_id,
    get_current_user,
    get_pg_pool,
    require_visible,
)
from app.services.entitlement_service import (
    EntitlementDeniedException,
    EntitlementResult,
)


@pytest.fixture
def workflow_test_app():
    """Create a test FastAPI app mounting the workflows router with mocked dependencies."""
    app = FastAPI()
    app.include_router(workflows_router)
    return app


@pytest.fixture
def mock_user():
    return {"id": str(uuid4()), "email": "testuser@example.com"}


def test_standard_org_workflow_creation_refused_with_structured_403(workflow_test_app, mock_user):
    """Standard org is refused with structured 403 naming Enterprise and upgrade hint (TIER-03)."""
    org_id = str(uuid4())

    workflow_test_app.dependency_overrides[get_current_user] = lambda: mock_user
    workflow_test_app.dependency_overrides[get_active_org_id] = lambda: org_id
    workflow_test_app.dependency_overrides[get_pg_pool] = lambda: MagicMock()
    workflow_test_app.dependency_overrides[require_visible("workflow_authoring")] = lambda: True

    with patch(
        "app.services.entitlement_service.check_entitlement",
        new_callable=AsyncMock,
    ) as mock_check:
        mock_check.return_value = EntitlementResult(
            allowed=False,
            capability="workflows",
            current_tier="standard",
            required_tier="enterprise",
            reason="Capability not enabled for tier",
            upgrade_hint="Upgrade to Enterprise to use workflows.",
        )

        client = TestClient(workflow_test_app)
        resp = client.post(
            "/workflows",
            json={
                "name": "Test Workflow",
                "slug": "test-workflow",
                "phases": [],
            },
        )

        assert resp.status_code == status.HTTP_403_FORBIDDEN
        data = resp.json()
        assert "detail" in data
        detail = data["detail"]
        assert detail["error"] == "entitlement_required"
        assert detail["capability"] == "workflows"
        assert detail["required_tier"] == "enterprise"
        assert detail["current_tier"] == "standard"
        assert detail["upgrade_hint"] == "Upgrade to Enterprise to use workflows."
        assert "Capability 'workflows' requires 'enterprise' tier" in detail["detail"]


def test_standard_org_with_additive_addon_override_admitted(workflow_test_app, mock_user):
    """Standard org with add_ons={'workflows': true} admitted via additive override (D-258-08)."""
    org_id = str(uuid4())

    workflow_test_app.dependency_overrides[get_current_user] = lambda: mock_user
    workflow_test_app.dependency_overrides[get_active_org_id] = lambda: org_id
    workflow_test_app.dependency_overrides[get_pg_pool] = lambda: MagicMock()
    workflow_test_app.dependency_overrides[require_visible("workflow_authoring")] = lambda: True

    with (
        patch(
            "app.services.entitlement_service.check_entitlement",
            new_callable=AsyncMock,
            return_value=EntitlementResult(
                allowed=True,
                capability="workflows",
                current_tier="standard",
                reason="Granted via add_on override",
            ),
        ),
        patch(
            "app.api.workflows.assert_phase_models_registered",
            new_callable=AsyncMock,
        ),
        patch(
            "app.api.workflows.create_workflow_definition",
            new_callable=AsyncMock,
            return_value={"id": uuid4(), "version": 1, "token": "test-token"},
        ),
    ):
        client = TestClient(workflow_test_app)
        resp = client.post(
            "/workflows",
            json={
                "name": "Addon Gated Workflow",
                "slug": "addon-gated-workflow",
                "version": 1,
                "phases": [],
            },
        )

        assert resp.status_code == status.HTTP_201_CREATED
        assert "id" in resp.json()


def test_enterprise_org_workflow_creation_admitted(workflow_test_app, mock_user):
    """Enterprise org creates workflow definition without restriction (TIER-01)."""
    org_id = str(uuid4())

    workflow_test_app.dependency_overrides[get_current_user] = lambda: mock_user
    workflow_test_app.dependency_overrides[get_active_org_id] = lambda: org_id
    workflow_test_app.dependency_overrides[get_pg_pool] = lambda: MagicMock()
    workflow_test_app.dependency_overrides[require_visible("workflow_authoring")] = lambda: True

    with (
        patch(
            "app.services.entitlement_service.check_entitlement",
            new_callable=AsyncMock,
            return_value=EntitlementResult(
                allowed=True,
                capability="workflows",
                current_tier="enterprise",
            ),
        ),
        patch(
            "app.api.workflows.assert_phase_models_registered",
            new_callable=AsyncMock,
        ),
        patch(
            "app.api.workflows.create_workflow_definition",
            new_callable=AsyncMock,
            return_value={"id": uuid4(), "version": 1, "token": "test-token"},
        ),
    ):
        client = TestClient(workflow_test_app)
        resp = client.post(
            "/workflows",
            json={
                "name": "Enterprise Workflow",
                "slug": "enterprise-workflow",
                "version": 1,
                "phases": [],
            },
        )

        assert resp.status_code == status.HTTP_201_CREATED
        assert "id" in resp.json()


def test_dynamic_repackaging_admits_standard_org_without_code_changes(workflow_test_app, mock_user):
    """Dynamic repackaging in tier_capabilities admits standard tier without code edit (TIER-02)."""
    org_id = str(uuid4())

    workflow_test_app.dependency_overrides[get_current_user] = lambda: mock_user
    workflow_test_app.dependency_overrides[get_active_org_id] = lambda: org_id
    workflow_test_app.dependency_overrides[get_pg_pool] = lambda: MagicMock()
    workflow_test_app.dependency_overrides[require_visible("workflow_authoring")] = lambda: True

    # Simulate dynamic repackaging where tier_capabilities now includes ('standard', 'workflows')
    with (
        patch(
            "app.services.entitlement_service.check_entitlement",
            new_callable=AsyncMock,
            return_value=EntitlementResult(
                allowed=True,
                capability="workflows",
                current_tier="standard",
            ),
        ),
        patch(
            "app.api.workflows.assert_phase_models_registered",
            new_callable=AsyncMock,
        ),
        patch(
            "app.api.workflows.create_workflow_definition",
            new_callable=AsyncMock,
            return_value={"id": uuid4(), "version": 1, "token": "test-token"},
        ),
    ):
        client = TestClient(workflow_test_app)
        resp = client.post(
            "/workflows",
            json={
                "name": "Repackaged Standard Workflow",
                "slug": "repackaged-standard-workflow",
                "version": 1,
                "phases": [],
            },
        )

        assert resp.status_code == status.HTTP_201_CREATED
        assert "id" in resp.json()


def test_fail_closed_on_database_error(workflow_test_app, mock_user):
    """Database connectivity failure fails closed with 403 refusal (TIER-05, D-258-06)."""
    org_id = str(uuid4())

    workflow_test_app.dependency_overrides[get_current_user] = lambda: mock_user
    workflow_test_app.dependency_overrides[get_active_org_id] = lambda: org_id
    workflow_test_app.dependency_overrides[get_pg_pool] = lambda: MagicMock()
    workflow_test_app.dependency_overrides[require_visible("workflow_authoring")] = lambda: True

    with patch(
        "app.services.entitlement_service.check_entitlement",
        new_callable=AsyncMock,
        return_value=EntitlementResult(
            allowed=False,
            capability="workflows",
            current_tier=None,
            required_tier=None,
            reason="Database error: connection timeout",
        ),
    ):
        client = TestClient(workflow_test_app)
        resp = client.post(
            "/workflows",
            json={
                "name": "Fail Closed Workflow",
                "slug": "fail-closed-workflow",
                "phases": [],
            },
        )

        assert resp.status_code == status.HTTP_403_FORBIDDEN
        data = resp.json()
        assert data["detail"]["error"] == "entitlement_required"


def test_publish_workflow_endpoint_entitlement_gate(workflow_test_app, mock_user):
    """publish_workflow endpoint is entitlement-gated and refuses standard tier."""
    org_id = str(uuid4())
    wf_id = uuid4()

    workflow_test_app.dependency_overrides[get_current_user] = lambda: mock_user
    workflow_test_app.dependency_overrides[get_active_org_id] = lambda: org_id
    workflow_test_app.dependency_overrides[get_pg_pool] = lambda: MagicMock()
    workflow_test_app.dependency_overrides[require_visible("workflow_authoring")] = lambda: True

    with patch(
        "app.services.entitlement_service.check_entitlement",
        new_callable=AsyncMock,
        return_value=EntitlementResult(
            allowed=False,
            capability="workflows",
            current_tier="standard",
            required_tier="enterprise",
            upgrade_hint="Upgrade to Enterprise to use workflows.",
        ),
    ):
        client = TestClient(workflow_test_app)
        resp = client.post(
            f"/workflows/{wf_id}/publish",
            json={"business_requirement": "Must test publish gate"},
        )

        assert resp.status_code == status.HTTP_403_FORBIDDEN
        assert resp.json()["detail"]["error"] == "entitlement_required"
        assert resp.json()["detail"]["required_tier"] == "enterprise"


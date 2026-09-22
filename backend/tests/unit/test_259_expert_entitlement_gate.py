from __future__ import annotations

import ast
import pathlib
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient

from app.api.experts import router as experts_router
from app.dependencies import get_active_org_id, get_current_user, get_pg_pool
from app.services.entitlement_service import EntitlementResult


@pytest.fixture
def expert_test_app():
    """Create test FastAPI application mounting the experts router."""
    app = FastAPI()
    app.include_router(experts_router)
    return app


@pytest.fixture
def mock_user():
    return {"id": str(uuid4()), "email": "user@example.com"}


def test_standard_org_expert_endpoints_refused_with_structured_403(expert_test_app, mock_user):
    """Standard org hitting /experts is refused with structured HTTP 403 (PACK-06, TIER-03)."""
    org_id = str(uuid4())

    expert_test_app.dependency_overrides[get_current_user] = lambda: mock_user
    expert_test_app.dependency_overrides[get_active_org_id] = lambda: org_id
    expert_test_app.dependency_overrides[get_pg_pool] = lambda: MagicMock()

    with patch(
        "app.services.entitlement_service.check_entitlement",
        new_callable=AsyncMock,
    ) as mock_check:
        mock_check.return_value = EntitlementResult(
            allowed=False,
            capability="experts",
            current_tier="standard",
            required_tier="enterprise",
            reason="Capability not enabled for tier",
            upgrade_hint="Upgrade to Enterprise to use experts.",
        )

        client = TestClient(expert_test_app)
        resp = client.get("/experts")

        assert resp.status_code == status.HTTP_403_FORBIDDEN
        data = resp.json()
        assert "detail" in data
        detail = data["detail"]
        assert detail["error"] == "entitlement_required"
        assert detail["capability"] == "experts"
        assert detail["required_tier"] == "enterprise"
        assert detail["current_tier"] == "standard"
        assert detail["upgrade_hint"] == "Upgrade to Enterprise to use experts."


def test_enterprise_org_expert_endpoints_admitted(expert_test_app, mock_user):
    """Enterprise org hitting /experts is admitted (PACK-06)."""
    org_id = str(uuid4())

    expert_test_app.dependency_overrides[get_current_user] = lambda: mock_user
    expert_test_app.dependency_overrides[get_active_org_id] = lambda: org_id
    expert_test_app.dependency_overrides[get_pg_pool] = lambda: MagicMock()

    with patch(
        "app.services.entitlement_service.check_entitlement",
        new_callable=AsyncMock,
    ) as mock_check, patch(
        "app.api.experts.list_experts_service",
        new_callable=AsyncMock,
    ) as mock_list:
        mock_check.return_value = EntitlementResult(
            allowed=True,
            capability="experts",
            current_tier="enterprise",
            required_tier=None,
            reason=None,
            upgrade_hint=None,
        )
        mock_list.return_value = [
            {"id": str(uuid4()), "name": "Financial Analyzer", "is_system": True}
        ]

        client = TestClient(expert_test_app)
        resp = client.get("/experts")

        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Financial Analyzer"


def test_standard_org_with_additive_addon_admitted(expert_test_app, mock_user):
    """Standard org with additive add-on for experts is admitted (D-258-08, PACK-06)."""
    org_id = str(uuid4())

    expert_test_app.dependency_overrides[get_current_user] = lambda: mock_user
    expert_test_app.dependency_overrides[get_active_org_id] = lambda: org_id
    expert_test_app.dependency_overrides[get_pg_pool] = lambda: MagicMock()

    with patch(
        "app.services.entitlement_service.check_entitlement",
        new_callable=AsyncMock,
    ) as mock_check, patch(
        "app.api.experts.list_experts_service",
        new_callable=AsyncMock,
    ) as mock_list:
        mock_check.return_value = EntitlementResult(
            allowed=True,
            capability="experts",
            current_tier="standard",
            required_tier=None,
            reason=None,
            upgrade_hint=None,
        )
        mock_list.return_value = []

        client = TestClient(expert_test_app)
        resp = client.get("/experts")

        assert resp.status_code == status.HTTP_200_OK
        assert resp.json() == []


def test_all_expert_endpoints_gated_by_router_dependency(expert_test_app, mock_user):
    """Verify router-level require_capability('experts') gates POST, GET, PATCH, DELETE."""
    org_id = str(uuid4())
    bundle_id = str(uuid4())

    expert_test_app.dependency_overrides[get_current_user] = lambda: mock_user
    expert_test_app.dependency_overrides[get_active_org_id] = lambda: org_id
    expert_test_app.dependency_overrides[get_pg_pool] = lambda: MagicMock()

    with patch(
        "app.services.entitlement_service.check_entitlement",
        new_callable=AsyncMock,
    ) as mock_check:
        mock_check.return_value = EntitlementResult(
            allowed=False,
            capability="experts",
            current_tier="standard",
            required_tier="enterprise",
            reason="Capability not enabled for tier",
            upgrade_hint="Upgrade to Enterprise to use experts.",
        )

        client = TestClient(expert_test_app)

        # GET /experts
        assert client.get("/experts").status_code == status.HTTP_403_FORBIDDEN

        # POST /experts
        assert client.post("/experts", json={"name": "X", "slug": "x"}).status_code == status.HTTP_403_FORBIDDEN

        # GET /experts/{id}
        assert client.get(f"/experts/{bundle_id}").status_code == status.HTTP_403_FORBIDDEN

        # GET /experts/{id}/resolve
        assert client.get(f"/experts/{bundle_id}/resolve").status_code == status.HTTP_403_FORBIDDEN

        # PATCH /experts/{id}
        assert client.patch(f"/experts/{bundle_id}", json={"name": "Y"}).status_code == status.HTTP_403_FORBIDDEN

        # DELETE /experts/{id}
        assert client.delete(f"/experts/{bundle_id}").status_code == status.HTTP_403_FORBIDDEN


def test_experts_api_single_home_ast_compliance():
    """Verify that backend/app/api/experts.py does not read subscription_tier directly (TIER-04)."""
    app_dir = pathlib.Path(__file__).resolve().parent.parent.parent / "app"
    api_path = app_dir / "api" / "experts.py"
    tree = ast.parse(api_path.read_text(encoding="utf-8"), filename=str(api_path))

    for node in ast.walk(tree):
        if isinstance(node, ast.Attribute) and node.attr == "subscription_tier":
            pytest.fail(f"Direct subscription_tier attribute access in {api_path}:{node.lineno}")
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            if "subscription_tier" in node.value:
                pytest.fail(f"Direct subscription_tier string reference in {api_path}:{node.lineno}")

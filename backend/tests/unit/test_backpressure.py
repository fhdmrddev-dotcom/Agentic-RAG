"""Unit tests for GET /admin/backpressure (Phase 078, WORKER-LIFT-04, D-078-06/07).

Tests cover:
- D-078-07 auth gating: dev fail-open, production fail-closed, allowed user pass
- D-078-06 response shape: 4 required signal keys + nested anyio structure
- Resilience: Redis unreachable -> 200 with redis_active_runs=0 (not 500)
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import get_current_user

USER_ID = "00000000-0000-0000-0000-000000000001"
ADMIN_USER_ID = "admin-00000000-0000-0000-0001"


def _mock_user(uid=USER_ID):
    return {"id": uid, "email": "test@example.com"}


@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = lambda: _mock_user()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_current_user, None)


# -- Auth gating (D-078-07) ---------------------------------------------------

def test_backpressure_200_in_dev(client, monkeypatch):
    """Dev environment (ENVIRONMENT=''): fail-open, any authenticated user gets 200."""
    monkeypatch.setattr("app.config.settings.environment", "")
    monkeypatch.setattr("app.config.settings.backpressure_admin_user_ids", "")
    response = client.get("/admin/backpressure")
    assert response.status_code == 200


def test_backpressure_403_in_production_no_config(client, monkeypatch):
    """Production environment + no BACKPRESSURE_ADMIN_USER_IDS -> 403 (D-078-07 fail-closed)."""
    monkeypatch.setattr("app.config.settings.environment", "production")
    monkeypatch.setattr("app.config.settings.backpressure_admin_user_ids", "")
    response = client.get("/admin/backpressure")
    assert response.status_code == 403


def test_backpressure_200_for_allowed_user(monkeypatch):
    """Allowed user ID in BACKPRESSURE_ADMIN_USER_IDS -> 200."""
    monkeypatch.setattr("app.config.settings.environment", "production")
    monkeypatch.setattr("app.config.settings.backpressure_admin_user_ids", ADMIN_USER_ID)
    app.dependency_overrides[get_current_user] = lambda: _mock_user(uid=ADMIN_USER_ID)
    try:
        with TestClient(app) as c:
            response = c.get("/admin/backpressure")
        assert response.status_code == 200
    finally:
        app.dependency_overrides.pop(get_current_user, None)


# -- Response shape (D-078-06) ------------------------------------------------

def test_backpressure_response_shape(client, monkeypatch):
    """Response contains the 4 required signal keys (D-078-06)."""
    monkeypatch.setattr("app.config.settings.environment", "")
    monkeypatch.setattr("app.config.settings.backpressure_admin_user_ids", "")
    response = client.get("/admin/backpressure")
    assert response.status_code == 200
    body = response.json()
    assert "anyio_threadpool_depth" in body
    assert "redis_active_runs" in body
    assert "postgres_pool_in_use" in body
    assert "per_worker_run_count" in body
    # anyio_threadpool_depth is a nested object with borrowed + total
    assert "borrowed" in body["anyio_threadpool_depth"]
    assert "total" in body["anyio_threadpool_depth"]


# -- Resilience ----------------------------------------------------------------

def test_backpressure_redis_unreachable_does_not_500(client, monkeypatch):
    """Redis unreachable -> 200 with redis_active_runs=0, not 500."""
    monkeypatch.setattr("app.config.settings.environment", "")
    monkeypatch.setattr("app.config.settings.backpressure_admin_user_ids", "")
    mock_redis = AsyncMock()
    mock_redis.zcard = AsyncMock(side_effect=Exception("connection refused"))
    monkeypatch.setattr("app.api.admin.get_redis", lambda: mock_redis)
    response = client.get("/admin/backpressure")
    assert response.status_code == 200
    assert response.json()["redis_active_runs"] == 0

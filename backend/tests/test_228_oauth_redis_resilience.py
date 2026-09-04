"""Phase 228 — OAuth Callback Redis Resilience Tests (DEBT-03).

Verifies:
  1. GET /connectors/oauth/callback redirects with 307 to /app?connections=1&oauth_error=redis_unavailable
     when Redis is unavailable or throws ConnectionError / RedisError during state lookup.
  2. GET /connectors/mcp/oauth/callback redirects with 307 to /app?connections=1&oauth_error=redis_unavailable
     when Redis is unavailable or throws ConnectionError / RedisError during authorization completion.
  3. No unhandled HTTP 500 exceptions are raised on Redis outages during OAuth callback processing.
"""

from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient
from redis.exceptions import ConnectionError as RedisConnectionError, RedisError, TimeoutError as RedisTimeoutError

from app.main import app
from app.config import primary_frontend_origin


@pytest.fixture
def client():
    return TestClient(app, follow_redirects=False)


@pytest.fixture(autouse=True)
def clean_dependency_overrides():
    yield
    app.dependency_overrides.clear()


@pytest.mark.parametrize("exc", [
    RedisConnectionError("Error connecting to Redis: Connection refused"),
    RedisTimeoutError("Redis command timed out"),
    RedisError("Generic redis driver error"),
    ConnectionError("OS connection error"),
])
def test_provider_oauth_callback_redis_outage_redirects_307(client: TestClient, exc: Exception):
    """Verify standard OAuth callback intercepts Redis errors and redirects cleanly to redis_unavailable."""
    frontend_url = primary_frontend_origin()
    state_handle = "a" * 43

    with patch("app.services.oauth_state.take_pending_state", new_callable=AsyncMock, side_effect=exc):
        response = client.get(f"/connectors/oauth/callback?code=auth_code_123&state={state_handle}")

        assert response.status_code == 307
        location = response.headers.get("location", "")
        expected_target = f"{frontend_url}/app?connections=1&oauth_error=redis_unavailable"
        assert location == expected_target


@pytest.mark.parametrize("exc", [
    RedisConnectionError("Error connecting to Redis: Connection refused"),
    RedisTimeoutError("Redis command timed out"),
    RedisError("Generic redis driver error"),
    ConnectionError("OS connection error"),
])
def test_mcp_oauth_callback_redis_outage_redirects_307(client: TestClient, exc: Exception):
    """Verify MCP OAuth callback intercepts Redis errors and redirects cleanly to redis_unavailable."""
    frontend_url = primary_frontend_origin()
    state_handle = "m" * 43

    with patch("app.services.mcp_oauth.complete_authorization", new_callable=AsyncMock, side_effect=exc):
        response = client.get(f"/connectors/mcp/oauth/callback?code=auth_code_123&state={state_handle}")

        assert response.status_code == 307
        location = response.headers.get("location", "")
        expected_target = f"{frontend_url}/app?connections=1&oauth_error=redis_unavailable"
        assert location == expected_target


def test_get_redis_invocation_outage_graceful_redirect(client: TestClient):
    """Verify that if get_redis() itself raises ConnectionError, both callbacks redirect cleanly."""
    frontend_url = primary_frontend_origin()
    state_handle = "r" * 43

    with patch("app.dependencies.get_redis", side_effect=RedisConnectionError("Cannot connect to redis host")):
        # Provider OAuth callback
        r1 = client.get(f"/connectors/oauth/callback?code=code123&state={state_handle}")
        assert r1.status_code == 307
        assert r1.headers.get("location") == f"{frontend_url}/app?connections=1&oauth_error=redis_unavailable"

        # MCP OAuth callback
        r2 = client.get(f"/connectors/mcp/oauth/callback?code=code123&state={state_handle}")
        assert r2.status_code == 307
        assert r2.headers.get("location") == f"{frontend_url}/app?connections=1&oauth_error=redis_unavailable"

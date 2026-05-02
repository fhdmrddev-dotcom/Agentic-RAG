"""Unit tests for /health Redis status (Phase 061 SC#6, T-061-05)."""
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_health_includes_redis_status(client):
    """SC#6: /health returns {status:'ok', redis:'ok'|'unreachable'}."""
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "redis" in body
    assert body["redis"] in ("ok", "unreachable"), (
        f"redis field has unexpected value: {body['redis']!r}"
    )


def test_health_redis_unreachable_does_not_500(client, monkeypatch):
    """T-061-05: when Redis ping fails, /health returns 200 with redis:'unreachable' — never 500, never leaks redis_url."""
    # Patch get_redis() to return a mock whose ping() raises.
    mock_redis = AsyncMock()
    mock_redis.ping.side_effect = Exception("connection refused")
    # The /health handler imports get_redis lazily inside the function from
    # app.dependencies, so patching the source module is what intercepts it.
    monkeypatch.setattr("app.dependencies.get_redis", lambda: mock_redis, raising=False)
    # Belt-and-suspenders: also patch app.main.get_redis if it's been re-bound.
    monkeypatch.setattr("app.main.get_redis", lambda: mock_redis, raising=False)

    response = client.get("/health")
    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )
    body = response.json()
    assert body["redis"] == "unreachable", body

    # T-061-05: response body MUST NOT contain redis_url or any port/host string,
    # nor the underlying exception message
    from app.config import settings
    body_str = response.text
    assert settings.redis_url not in body_str, (
        f"redis_url leaked in /health response: {body_str}"
    )
    assert "localhost:6379" not in body_str, (
        f"Redis host:port leaked in /health: {body_str}"
    )
    assert "connection refused" not in body_str, (
        f"Exception message leaked in /health: {body_str}"
    )

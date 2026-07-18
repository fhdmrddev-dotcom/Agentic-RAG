"""Unit tests for GET /admin/backpressure (Phase 078 shape + Phase 146 gate).

Phase 146 (D-02) REPLACED the BACKPRESSURE_ADMIN_USER_IDS allow-list + dev
fail-open with the router-level ``require_operator`` gate. The 404 /
non-discoverability contract now lives in ``tests/test_146_operator_gate.py``;
the three former auth-gating tests (dev fail-open / prod fail-closed / allowed-user)
were DELETED because the behavior they pinned no longer exists.

These tests pin the surviving Phase 078 behavior, driven as an authenticated
operator (membership via the asyncpg pool mock):
- D-078-06 response shape: 4 required signal keys + nested anyio structure
- Resilience: Redis unreachable -> 200 with redis_active_runs=0 (not 500)
"""
from unittest.mock import AsyncMock


# -- Response shape (D-078-06) ------------------------------------------------

def test_backpressure_response_shape(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """Response contains the 4 required signal keys (D-078-06), unchanged by 146."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"user_id": "op-1"})  # operator present
    response = client.get("/admin/backpressure", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert "anyio_threadpool_depth" in body
    assert "redis_active_runs" in body
    assert "postgres_pool_in_use" in body
    assert "per_worker_run_count" in body
    # anyio_threadpool_depth is a nested object with borrowed + total
    assert "borrowed" in body["anyio_threadpool_depth"]
    assert "total" in body["anyio_threadpool_depth"]


# -- CR-02: postgres_pool_in_use reflects the LIVE pool ------------------------

def test_backpressure_pool_in_use_reflects_live_pool(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """CR-02: postgres_pool_in_use reads the live app.dependencies._pg_pool.

    Installs a fake pool via the SAME seam production uses (rebinding
    app.dependencies._pg_pool) and asserts a NON-zero reading. This is
    falsifiable against the old from-import snapshot: with the stale
    ``from app.dependencies import _pg_pool`` (None at import time), this would
    read 0 regardless of the rebind and the assert would fail.
    """
    mock_asyncpg_pool.set_fetchrow_result({"user_id": "op-1"})  # operator present (is_operator)
    # asyncpg.Pool.get_size / get_idle_size are sync; a live pool with 10 total,
    # 3 idle => 7 in-use.
    mock_asyncpg_pool.get_size = lambda: 10
    mock_asyncpg_pool.get_idle_size = lambda: 3
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)

    response = client.get("/admin/backpressure", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["postgres_pool_in_use"] == 7


# -- Resilience ----------------------------------------------------------------

def test_backpressure_redis_unreachable_does_not_500(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """Redis unreachable -> 200 with redis_active_runs=0, not 500."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"user_id": "op-1"})
    mock_redis = AsyncMock()
    mock_redis.zcard = AsyncMock(side_effect=Exception("connection refused"))
    monkeypatch.setattr("app.api.admin.get_redis", lambda: mock_redis)
    response = client.get("/admin/backpressure", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["redis_active_runs"] == 0

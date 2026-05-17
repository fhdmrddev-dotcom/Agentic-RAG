"""Phase 073 unit tests — get_pg_pool() singleton + lazy init (D-073-01/02/03)."""

from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_get_pg_pool_returns_singleton():
    """Two consecutive calls return the same Pool instance (singleton)."""
    with patch("app.dependencies.asyncpg.create_pool", new=AsyncMock()) as mock_create:
        mock_pool = AsyncMock(name="MockPool")
        mock_create.return_value = mock_pool

        from app.dependencies import get_pg_pool
        pool_a = await get_pg_pool()
        pool_b = await get_pg_pool()

        assert pool_a is pool_b, "get_pg_pool must return the same instance on repeat calls"
        assert mock_create.call_count == 1, "create_pool must run exactly once"


@pytest.mark.asyncio
async def test_get_pg_pool_lazy_no_io_at_import():
    """Importing app.dependencies must NOT call asyncpg.create_pool."""
    # The autouse _reset_pg_pool_singleton fixture sets _pg_pool=None before this
    # test runs. Importing the module here must not trigger create_pool.
    with patch("app.dependencies.asyncpg.create_pool", new=AsyncMock()) as mock_create:
        # Re-import to simulate fresh-import (note: Python caches modules, so this
        # really tests "no I/O happens between import and first await")
        import importlib
        import app.dependencies as deps
        importlib.reload(deps)

        assert mock_create.call_count == 0, "create_pool must not run at import time"


@pytest.mark.asyncio
async def test_get_pg_pool_reset_creates_fresh_pool():
    """After _pg_pool=None reset (autouse fixture contract), next call creates a fresh pool."""
    with patch("app.dependencies.asyncpg.create_pool", new=AsyncMock()) as mock_create:
        mock_create.side_effect = [AsyncMock(name="Pool1"), AsyncMock(name="Pool2")]

        import app.dependencies as deps
        pool_a = await deps.get_pg_pool()
        deps._pg_pool = None  # simulate autouse fixture reset between tests
        pool_b = await deps.get_pg_pool()

        assert pool_a is not pool_b, "after reset, a NEW pool must be created"
        assert mock_create.call_count == 2

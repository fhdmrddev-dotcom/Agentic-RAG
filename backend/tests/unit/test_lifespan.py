"""Phase 073 + 078 unit tests — FastAPI lifespan shutdown ordering.

Phase 073 owns:
  - test_pg_pool_closes_before_supabase (close-order assertion)
  - test_pg_pool_close_timeout_falls_back_to_terminate (Pitfall 4 fallback)

Phase 078 (CQ-SUPA-01) additions:
  - test_supabase_aclose_called_on_shutdown (aclose awaited)
  - test_supabase_aclose_after_pg_pool (shutdown ordering D-078-09)

See 073-PATTERNS.md test_lifespan.py for the coordination note.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_pg_pool_closes_before_supabase():
    """Lifespan shutdown calls _pg_pool.close() before any future _supabase.aclose().

    Phase 073 only asserts that _pg_pool.close() runs during the shutdown phase
    of the lifespan; Phase 078 will add the assertion that _supabase.aclose()
    runs AFTER. Today we assert _pg_pool.close() was awaited at least once when
    the lifespan exits.
    """
    from app.main import app

    mock_pool = MagicMock()
    mock_pool.close = AsyncMock()
    mock_pool.terminate = MagicMock()

    with patch("app.dependencies._pg_pool", mock_pool):
        async with app.router.lifespan_context(app):
            pass  # enter + exit lifespan

    assert mock_pool.close.await_count >= 1, "_pg_pool.close() must be awaited on lifespan shutdown"


@pytest.mark.asyncio
async def test_pg_pool_close_timeout_falls_back_to_terminate():
    """When _pg_pool.close() raises asyncio.TimeoutError, terminate() is called (Pitfall 4)."""
    from app.main import app

    async def _hang_forever():
        # Sleep longer than the 5s lifespan timeout to force wait_for to TimeoutError
        await asyncio.sleep(60)

    mock_pool = MagicMock()
    mock_pool.close = AsyncMock(side_effect=_hang_forever)
    mock_pool.terminate = MagicMock()

    with patch("app.dependencies._pg_pool", mock_pool):
        async with app.router.lifespan_context(app):
            pass

    assert mock_pool.terminate.call_count >= 1, "terminate() must be called when close() times out"


@pytest.mark.asyncio
async def test_supabase_aclose_called_on_shutdown():
    """Phase 078 CQ-SUPA-01: _supabase.aclose() is awaited during lifespan shutdown."""
    from app.main import app

    mock_client = MagicMock()
    mock_client.aclose = AsyncMock()

    with patch("app.dependencies._supabase", mock_client):
        async with app.router.lifespan_context(app):
            pass

    assert mock_client.aclose.await_count >= 1, "_supabase.aclose() must be awaited on lifespan shutdown"


@pytest.mark.asyncio
async def test_supabase_aclose_after_pg_pool():
    """Phase 078: _supabase.aclose() runs AFTER _pg_pool.close() (shutdown ordering D-078-09)."""
    from app.main import app

    call_order = []

    mock_pool = MagicMock()
    async def _pool_close():
        call_order.append("pg_pool")
    mock_pool.close = AsyncMock(side_effect=_pool_close)
    mock_pool.terminate = MagicMock()

    mock_client = MagicMock()
    async def _supa_close():
        call_order.append("supabase")
    mock_client.aclose = AsyncMock(side_effect=_supa_close)

    with patch("app.dependencies._pg_pool", mock_pool), \
         patch("app.dependencies._supabase", mock_client):
        async with app.router.lifespan_context(app):
            pass

    pg_idx = call_order.index("pg_pool") if "pg_pool" in call_order else -1
    supa_idx = call_order.index("supabase") if "supabase" in call_order else -1
    assert pg_idx < supa_idx, f"Expected pg_pool before supabase, got order: {call_order}"

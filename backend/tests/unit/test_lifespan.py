"""Phase 073 unit tests — FastAPI lifespan shutdown ordering for _pg_pool.

Phase 073 owns:
  - test_pg_pool_closes_before_supabase (close-order assertion)
  - test_pg_pool_close_timeout_falls_back_to_terminate (Pitfall 4 fallback)

Phase 078 (CQ-SUPA-01) will EXTEND this file with:
  - test_supabase_aclose_no_runtime_warning (after Phase 078 adds the aclose call)

See 073-PATTERNS.md §test_lifespan.py for the coordination note.
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

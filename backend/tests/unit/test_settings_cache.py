"""Unit tests for async DB-backed settings cache + 4-tier resolution (Phase 081.1 Plan 01).

Tests verify:
  - _load_settings_from_db() TTL cache (warm hit, cold miss)
  - invalidate_settings_cache() resets cache timestamp
  - _load_model_overrides() TTL cache
  - get_per_call_timeout_async() 4-tier resolution (DB > env CSV > static dict > default)
"""
from __future__ import annotations

import time as _time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Test 1: _load_settings_from_db returns cached dict within TTL (no DB call)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cache_ttl_refresh():
    """Warm cache (within 30s TTL) returns cached dict without DB call."""
    import app.models.user_settings as us

    # Seed the cache with known data
    us._settings_cache = {"llm_provider": "openai", "llm_model": "gpt-4o"}
    us._settings_cache_time = _time.time()  # Just now => within TTL

    mock_pool = AsyncMock()
    with patch("app.dependencies.get_pg_pool", return_value=mock_pool):
        result = await us._load_settings_from_db()

    assert result == {"llm_provider": "openai", "llm_model": "gpt-4o"}
    # DB should NOT have been called
    mock_pool.fetchrow.assert_not_called()


# ---------------------------------------------------------------------------
# Test 2: _load_settings_from_db hits DB when TTL expired
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cache_expired_hits_db():
    """Expired cache (>30s ago) triggers a DB read."""
    import app.models.user_settings as us

    # Set cache time to 60s ago => expired
    us._settings_cache = {"old": True}
    us._settings_cache_time = _time.time() - 60.0

    mock_row = {"llm_provider": "anthropic", "llm_model": "claude-sonnet-4-20250514"}
    mock_pool = AsyncMock()
    mock_pool.fetchrow = AsyncMock(return_value=mock_row)

    with patch("app.dependencies.get_pg_pool", return_value=mock_pool):
        result = await us._load_settings_from_db()

    assert result["llm_provider"] == "anthropic"
    mock_pool.fetchrow.assert_called_once()


# ---------------------------------------------------------------------------
# Test 3: invalidate_settings_cache zeros cache_time
# ---------------------------------------------------------------------------

def test_invalidate_settings_cache():
    """invalidate_settings_cache() forces next read to hit DB."""
    import app.models.user_settings as us

    us._settings_cache_time = _time.time()
    us.invalidate_settings_cache()
    assert us._settings_cache_time == 0.0


# ---------------------------------------------------------------------------
# Test 4: _load_model_overrides returns cached dict within TTL
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_model_overrides_cache_warm():
    """Warm model overrides cache returns without DB call."""
    import app.models.user_settings as us

    us._model_overrides_cache = {
        "gpt-4o": {"model_id": "gpt-4o", "provider": "openai", "llm_call_timeout_seconds": 120}
    }
    us._model_overrides_cache_time = _time.time()

    mock_pool = AsyncMock()
    with patch("app.dependencies.get_pg_pool", return_value=mock_pool):
        result = await us._load_model_overrides()

    assert "gpt-4o" in result
    mock_pool.fetch.assert_not_called()


# ---------------------------------------------------------------------------
# Test 5: get_per_call_timeout_async resolves DB > env > static > default
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_timeout_async_full_resolution():
    """4-tier resolution: DB > env CSV > static dict > default (300s)."""
    import app.models.user_settings as us

    # Empty DB overrides => falls through
    us._model_overrides_cache = {}
    us._model_overrides_cache_time = _time.time()

    mock_pool = AsyncMock()
    with patch("app.dependencies.get_pg_pool", return_value=mock_pool):
        from app.config import get_per_call_timeout_async

        # Unknown model, no env override => should get DEFAULT_LLM_CALL_TIMEOUT_SECONDS (300)
        result = await get_per_call_timeout_async("totally-unknown-model-xyz")

    from app.config import DEFAULT_LLM_CALL_TIMEOUT_SECONDS
    assert result == DEFAULT_LLM_CALL_TIMEOUT_SECONDS


# ---------------------------------------------------------------------------
# Test 6: get_per_call_timeout_async returns DB value when present
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_timeout_async_db_hit():
    """DB row with llm_call_timeout_seconds=600 wins over all other tiers."""
    import app.models.user_settings as us

    us._model_overrides_cache = {
        "custom-model": {
            "model_id": "custom-model",
            "provider": "openai",
            "llm_call_timeout_seconds": 600,
        }
    }
    us._model_overrides_cache_time = _time.time()

    mock_pool = AsyncMock()
    with patch("app.dependencies.get_pg_pool", return_value=mock_pool):
        from app.config import get_per_call_timeout_async

        result = await get_per_call_timeout_async("custom-model")

    assert result == 600


# ---------------------------------------------------------------------------
# Test 7: get_per_call_timeout_async skips DB NULL, falls to env CSV
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_timeout_async_db_null_falls_through():
    """DB row with NULL llm_call_timeout_seconds skips to next tier."""
    import app.models.user_settings as us

    us._model_overrides_cache = {
        "some-model": {
            "model_id": "some-model",
            "provider": "openai",
            "llm_call_timeout_seconds": None,
        }
    }
    us._model_overrides_cache_time = _time.time()

    mock_pool = AsyncMock()
    with patch("app.dependencies.get_pg_pool", return_value=mock_pool):
        from app.config import get_per_call_timeout_async

        # "some-model" not in static dict or env CSV => falls to default 300
        result = await get_per_call_timeout_async("some-model")

    from app.config import DEFAULT_LLM_CALL_TIMEOUT_SECONDS
    assert result == DEFAULT_LLM_CALL_TIMEOUT_SECONDS


# ---------------------------------------------------------------------------
# Test 8: Unknown model returns DEFAULT_LLM_CALL_TIMEOUT_SECONDS (300)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_timeout_async_unknown_model_default():
    """Model not in DB, not in static dict, not in env CSV => 300s default."""
    import app.models.user_settings as us

    us._model_overrides_cache = {}
    us._model_overrides_cache_time = _time.time()

    mock_pool = AsyncMock()
    with patch("app.dependencies.get_pg_pool", return_value=mock_pool):
        from app.config import get_per_call_timeout_async

        result = await get_per_call_timeout_async("nonexistent-model-abc")

    from app.config import DEFAULT_LLM_CALL_TIMEOUT_SECONDS
    assert result == DEFAULT_LLM_CALL_TIMEOUT_SECONDS

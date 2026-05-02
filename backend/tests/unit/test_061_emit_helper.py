"""Unit tests for the _emit / _emit_terminal XADD helpers — Phase 061 SC#1, Pitfall 5."""
import json
import uuid
from unittest.mock import AsyncMock

import pytest


@pytest.mark.asyncio
async def test_emit_xadds_data_field():
    """_emit calls redis.xadd with single-field 'data' payload + correct stream key + MAXLEN ~ 10000."""
    from app.api.threads import _emit

    mock_redis = AsyncMock()
    run_id = uuid.uuid4()

    await _emit(mock_redis, run_id, "delta", content="hello")

    mock_redis.xadd.assert_awaited_once()
    args, kwargs = mock_redis.xadd.call_args
    assert args[0] == f"run:{run_id}"
    payload = json.loads(args[1]["data"])
    assert payload == {"type": "delta", "content": "hello"}
    assert kwargs.get("maxlen") == 10000
    assert kwargs.get("approximate") is True


@pytest.mark.asyncio
async def test_emit_terminal_no_maxlen():
    """_emit_terminal calls xadd WITHOUT maxlen — sentinel must not be trimmed (Pitfall 5)."""
    from app.api.threads import _emit_terminal

    mock_redis = AsyncMock()
    run_id = uuid.uuid4()

    await _emit_terminal(mock_redis, run_id, "done")

    mock_redis.xadd.assert_awaited_once()
    _args, kwargs = mock_redis.xadd.call_args
    assert "maxlen" not in kwargs, "Terminal sentinel must not be MAXLEN-trimmed"


@pytest.mark.asyncio
async def test_emit_terminal_rejects_non_terminal_type():
    """_emit_terminal asserts type ∈ TERMINAL_TYPES — guard against accidental misuse."""
    from app.api.threads import _emit_terminal

    mock_redis = AsyncMock()
    with pytest.raises(AssertionError):
        await _emit_terminal(mock_redis, uuid.uuid4(), "delta")

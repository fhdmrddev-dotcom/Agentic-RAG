"""SC#4: Redis EXPIRE applied per terminal status (600 completed / 60 failed).

Phase 061 (D-061-04 + Plan 03 finally ordering).
"""
import json
from unittest.mock import patch
from uuid import uuid4

import httpx
import pytest

from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode

from tests.integration.test_058_concurrency import (  # noqa: E402
    USER_ID,
    _build_mock_supabase,
    _fast_chunks,
    _make_result,
    _thread_row,
)
from tests.integration.test_059_disconnect import (  # noqa: E402
    _reset_sse_starlette_app_status,
)
from tests.integration._run_helpers import _extract_run_id_from_mock  # noqa: E402

THREAD_A = str(uuid4())


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_completed_run_expires_600s(redis_client):
    """SC#4: completed run gets EXPIRE 600 (10-min retention)."""
    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            return_value=(iter(_fast_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("Test Title", None),
        ):
            async with httpx.AsyncClient(app=app, base_url="http://test") as c:
                async with c.stream(
                    "POST",
                    f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as r:
                    async for _line in r.aiter_lines():
                        pass   # drain to natural completion

            # Producer's finally has run by now
            run_id = _extract_run_id_from_mock(mock_supabase)
            ttl = await redis_client.ttl(f"run:{run_id}")
            assert 540 < ttl <= 600, (
                f"Expected 600s EXPIRE on completed run; got TTL={ttl}"
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_failed_run_expires_60s(redis_client):
    """SC#4: failed run (LLM error) gets EXPIRE 60 (short retention)."""
    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase

    def _failing_llm(*a, **k):
        raise Exception("simulated LLM API error")

    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=_failing_llm,
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("Test Title", None),
        ):
            async with httpx.AsyncClient(app=app, base_url="http://test") as c:
                async with c.stream(
                    "POST",
                    f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as r:
                    async for _line in r.aiter_lines():
                        pass

            run_id = _extract_run_id_from_mock(mock_supabase)
            ttl = await redis_client.ttl(f"run:{run_id}")
            assert 30 < ttl <= 65, (
                f"Expected 60s EXPIRE on failed run; got TTL={ttl}"
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)

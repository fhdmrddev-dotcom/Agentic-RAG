"""D-061-01 + D-061-04: 120s asyncio.timeout end-to-end with full finally ordering.

Phase 061 Plan 05 Task 2 — TBD-08.
"""
import json
import time
from unittest.mock import patch
from uuid import uuid4

import httpx
import pytest

from app.api.threads import TERMINAL_TYPES
from app.config import settings
from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode

from tests.integration.test_058_concurrency import (  # noqa: E402
    _build_mock_supabase,
    _make_done_chunk,
    _make_sse_chunk,
)
from tests.integration.test_059_disconnect import (  # noqa: E402
    _reset_sse_starlette_app_status,
)
from tests.integration._run_helpers import _extract_run_id_from_mock  # noqa: E402

THREAD_A = str(uuid4())


def _too_slow_chunks():
    """Generator that sleeps far longer than the test's lowered timeout."""
    time.sleep(5.0)   # exceeds monkeypatched run_hard_timeout_seconds=2
    yield _make_sse_chunk("never_emitted ")
    yield _make_done_chunk()


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_120s_timeout_fires_full_finally(redis_client, monkeypatch):
    """D-061-01 + D-061-04: timeout fires → terminal error sentinel → runs.status='failed' error='hard_timeout' → EXPIRE 60."""
    # Cut the 120s default to 2s for this test
    monkeypatch.setattr(settings, "run_hard_timeout_seconds", 2)

    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_too_slow_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
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
                        pass   # drain (consumer will emit synthetic timeout error eventually)

            run_id = _extract_run_id_from_mock(mock_supabase)
            stream_key = f"run:{run_id}"

            # Assert (a): terminal entry has type='error' AND error='hard_timeout'
            entries = await redis_client.xrange(stream_key)
            terminal_errors = [
                json.loads(e[1]["data"]) for e in entries
                if json.loads(e[1]["data"]).get("type") == "error"
                and json.loads(e[1]["data"]).get("error") == "hard_timeout"
            ]
            assert terminal_errors, (
                f"Expected terminal error=hard_timeout entry; "
                f"got: {[json.loads(e[1]['data']) for e in entries]}"
            )

            # Assert (b): runs.status='failed' AND error='hard_timeout'
            runs_builder = mock_supabase.table("runs")
            hard_timeout_updates = [
                c for c in runs_builder.update.call_args_list
                if (
                    c.args
                    and isinstance(c.args[0], dict)
                    and c.args[0].get("status") == "failed"
                    and c.args[0].get("error") == "hard_timeout"
                )
            ]
            assert hard_timeout_updates, (
                f"Expected runs UPDATE with status='failed' error='hard_timeout'; "
                f"got: {runs_builder.update.call_args_list}"
            )

            # Assert (c): EXPIRE TTL ≈ 60s (failed bucket; D-061-04)
            ttl = await redis_client.ttl(stream_key)
            assert 30 < ttl <= 65, (
                f"Expected ~60s TTL on failed run; got {ttl}"
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)

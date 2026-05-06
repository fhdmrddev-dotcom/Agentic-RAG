"""Phase 066 SC#7: LangSmith trace clean on TimeoutError — no GeneratorExit leak.

D-066-11: when the per-call asyncio.timeout fires inside an SDK stream
iteration, the producer must call stream.close() (OpenAI/Google/OpenRouter)
or _ant_gen.close() (Anthropic) BEFORE re-raising. This converts the
LangSmith trace from "unexpected GeneratorExit at run_helpers.py:1680"
to a clean stream-end + TimeoutError.

This test asserts the symptom: caplog at WARNING+ level captures NO log
record whose path or message contains 'GeneratorExit'. (We can't assert
positively on LangSmith's internal state without a wrapper-injection
fixture; the negation on caplog is the cheapest reliable proxy.)
"""
import logging
import time
from unittest.mock import patch
from uuid import uuid4

import httpx
import pytest

from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode

from tests.integration._run_helpers import (  # noqa: E402
    _build_mock_supabase,
    _make_done_chunk,
    _make_sse_chunk,
    await_producer_finalized,
)
from tests.integration.test_059_disconnect import (  # noqa: F401, E402
    _reset_sse_starlette_app_status,
)

THREAD_A = str(uuid4())


def _stalling_chunks():
    time.sleep(5.0)
    yield _make_sse_chunk("never ")
    yield _make_done_chunk()


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_no_generator_exit_on_timeout(redis_client, monkeypatch, caplog):
    """SC#7 + D-066-11: TimeoutError path does NOT leak GeneratorExit into logs."""
    import app.config as _app_config
    monkeypatch.setattr(_app_config, "get_per_call_timeout", lambda *a, **k: 1)
    caplog.set_level(logging.WARNING)

    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_stalling_chunks()), CallingMode.NATIVE),
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
                        pass
            await await_producer_finalized(mock_supabase)

        # Assert: no caplog record contains 'GeneratorExit' in its message
        # OR pathname (covers both langsmith/run_helpers.py:1680 and any
        # synthetic exception trace).
        offending = [
            (rec.levelname, rec.name, rec.getMessage())
            for rec in caplog.records
            if "GeneratorExit" in rec.getMessage()
            or "GeneratorExit" in (rec.pathname or "")
        ]
        assert not offending, (
            f"D-066-11 violation: TimeoutError path leaked GeneratorExit into logs. "
            f"Offending records: {offending}"
        )

        # Sanity: we DID hit the timed_out path (otherwise the negation is vacuous)
        runs_builder = mock_supabase.table("runs")
        timed_out_updates = [
            c for c in runs_builder.update.call_args_list
            if c.args and c.args[0].get("status") == "timed_out"
        ]
        assert timed_out_updates, (
            "Test setup wrong — must have hit timed_out path (otherwise the "
            "negation 'no GeneratorExit' is vacuously satisfied)"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)

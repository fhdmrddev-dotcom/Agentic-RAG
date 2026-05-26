"""Env-var-gated mock LLM module for multi-worker integration tests (Phase 077).

This module is loaded at import time when ``MOCK_LLM_MODE=1`` is set in the
environment. It replaces ``create_adaptive_streaming_chat`` with a deterministic
fake stream and bypasses auth with a fixed test user so that subprocess-based
harness requests authenticate without a real Supabase token.

Design decisions:
- D-077-01: Subprocess injection via env var (cannot monkey-patch across
  process boundaries).
- D-077-02: Full LLM mock, zero API cost. Deterministic ~5 chunk stream +
  stop with usage. Millisecond-per-run execution.

The fixed test user UUID is NOT a real user -- it exists only in the mock
context and is safe to hardcode because the production safety gate in
``main.py`` prevents ``MOCK_LLM_MODE=1`` from ever activating in production.
"""
from __future__ import annotations

import logging
from unittest.mock import MagicMock

from app.services.openai_service import CallingMode

logger = logging.getLogger(__name__)

# Fixed test user for auth bypass -- matches _run_helpers.USER_ID convention
_MOCK_USER = {
    "id": "00000000-0000-0000-0000-000000000001",
    "email": "test-077@harness.local",
}


def _mock_stream():
    """Deterministic fake LLM stream: 5 content chunks + 1 stop chunk with usage.

    Each chunk matches the shape ``create_adaptive_streaming_chat`` yields
    (OpenAI ChatCompletionChunk-compatible MagicMock).
    """
    for i in range(5):
        chunk = MagicMock()
        chunk.choices = [MagicMock()]
        chunk.choices[0].finish_reason = None
        chunk.choices[0].delta = MagicMock()
        chunk.choices[0].delta.content = f"tok{i} "
        chunk.choices[0].delta.tool_calls = None
        chunk.choices[0].delta.reasoning_content = None
        chunk.usage = None
        yield chunk

    # Final chunk -- stop with usage summary
    done = MagicMock()
    done.choices = [MagicMock()]
    done.choices[0].finish_reason = "stop"
    done.choices[0].delta = MagicMock()
    done.choices[0].delta.content = None
    done.choices[0].delta.tool_calls = None
    done.choices[0].delta.reasoning_content = None
    done.usage = MagicMock(prompt_tokens=10, completion_tokens=5)
    yield done


def mock_create_adaptive_streaming_chat(**kwargs):
    """Drop-in replacement for ``create_adaptive_streaming_chat``.

    Returns the same ``(iterator, CallingMode)`` tuple signature as the
    real function.
    """
    return (iter(_mock_stream()), CallingMode.NATIVE)


def install_mock():
    """Patch the real LLM entry point and bypass auth.

    Called once per worker at import time (from ``main.py`` when
    ``MOCK_LLM_MODE=1``).

    1. Replaces ``app.api.threads.create_adaptive_streaming_chat`` with the
       deterministic fake so no LLM API calls are made.
    2. Overrides FastAPI's ``get_current_user`` dependency to return a fixed
       test user, avoiding the need for real Supabase auth tokens in the
       subprocess harness.
    """
    # 1. Patch the LLM entry point on the threads module
    import app.api.threads as threads_mod
    threads_mod.create_adaptive_streaming_chat = mock_create_adaptive_streaming_chat
    logger.info("Patched create_adaptive_streaming_chat with deterministic mock")

    # 2. Override auth dependency to return fixed test user
    from app.main import app
    from app.dependencies import get_current_user

    async def _mock_get_current_user():
        return _MOCK_USER

    app.dependency_overrides[get_current_user] = _mock_get_current_user
    logger.info(
        "Auth bypassed -- returning fixed test user %s (%s)",
        _MOCK_USER["id"],
        _MOCK_USER["email"],
    )

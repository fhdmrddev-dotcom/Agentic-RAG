"""Env-var-gated mock module for multi-worker integration tests (Phase 077).

Loaded at import time when ``MOCK_LLM_MODE=1``. Replaces three external
dependencies so the subprocess harness is fully self-contained:

1. **LLM** — ``create_adaptive_streaming_chat`` → deterministic 5-chunk stream
2. **Auth** — ``get_current_user`` → fixed test user (no Supabase Auth token)
3. **Supabase PostgREST** — ``get_supabase`` → in-memory mock client
   (eliminates HTTP calls to local/cloud PostgREST; asyncpg + Redis stay real)

Design decisions:
- D-077-01: Subprocess injection via env var (cannot monkey-patch across
  process boundaries).
- D-077-02: Full mock, zero API cost, zero network dependencies beyond
  Redis and Postgres (asyncpg). Millisecond-per-run execution.
"""
from __future__ import annotations

import logging
import uuid as _uuid_mod
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


class _MockResponse:
    """Mimics ``postgrest`` response with ``.data`` and ``.count``."""
    def __init__(self, data):
        self.data = data
        self.count = None


class _MockQueryBuilder:
    """Fluent builder that absorbs any supabase-py query chain.

    Uses ``__getattr__`` to handle all methods (eq, or_, neq, order, limit,
    ilike, contains, etc.) without listing them explicitly. Only ``insert``,
    ``update``, and ``execute`` have special behavior.
    """
    def __init__(self, table_name):
        self._table = table_name
        self._op = None
        self._payload = None

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)

        def _chain(*_a, **_kw):
            return self
        return _chain

    def select(self, *_a, **_kw):
        self._op = "select"
        return self

    def insert(self, data):
        self._op = "insert"
        self._payload = data
        return self

    def update(self, data):
        self._op = "update"
        self._payload = data
        return self

    def execute(self):
        if self._op == "insert":
            row = dict(self._payload or {})
            row.setdefault("id", str(_uuid_mod.uuid4()))
            return _MockResponse([row])
        if self._op == "select":
            if self._table == "threads":
                return _MockResponse({"id": "mock", "title": "Test Thread"})
            return _MockResponse([])
        return _MockResponse(None)


class _MockSupabase:
    """Minimal Supabase client mock — no network calls."""

    def table(self, name: str) -> _MockQueryBuilder:
        return _MockQueryBuilder(name)

    @property
    def storage(self):
        m = MagicMock()
        m.from_.return_value.upload.return_value = None
        return m

    @property
    def auth(self):
        m = MagicMock()
        m.get_user.return_value = MagicMock(user=None)
        return m


def install_mock():
    """Patch LLM, auth, and Supabase client for subprocess testing.

    Called once per worker at import time (from ``main.py`` when
    ``MOCK_LLM_MODE=1``).

    1. LLM → deterministic fake stream (no API calls)
    2. Auth → fixed test user (no Supabase Auth token needed)
    3. Supabase → in-memory mock (no PostgREST HTTP calls)

    Redis and asyncpg stay REAL — they're the actual multi-worker
    contracts being validated.
    """
    # 1. Patch the LLM entry point. Phase 089 Plan 03 (G-5 verbatim move): the
    # agent loop moved from threads.py into app.services.agent_loop, so the loop
    # now reads ``agent_loop.create_adaptive_streaming_chat`` (its own
    # ``from openai_service import ...`` binding). Patch THAT binding — patching
    # the threads.py binding no longer intercepts the loop (Pitfall 1). Patch
    # both bindings defensively so any residual threads.py caller is also mocked.
    import app.services.agent_loop as agent_loop_mod
    agent_loop_mod.create_adaptive_streaming_chat = mock_create_adaptive_streaming_chat
    import app.api.threads as threads_mod
    threads_mod.create_adaptive_streaming_chat = mock_create_adaptive_streaming_chat
    logger.info("Patched create_adaptive_streaming_chat with deterministic mock (agent_loop + threads bindings)")

    # 2. Override auth + supabase dependencies
    from app.main import app
    from app.dependencies import get_current_user, get_supabase

    async def _mock_get_current_user():
        return _MOCK_USER

    app.dependency_overrides[get_current_user] = _mock_get_current_user
    app.dependency_overrides[get_supabase] = _MockSupabase
    logger.info(
        "Auth + Supabase bypassed -- test user %s, mock PostgREST",
        _MOCK_USER["id"],
    )

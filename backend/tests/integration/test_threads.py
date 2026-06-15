"""Integration tests for /threads endpoints."""
import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest


# ── Helpers ────────────────────────────────────────────────────────────────────

USER_ID = "00000000-0000-0000-0000-000000000001"
THREAD_ID = str(uuid4())
MESSAGE_ID = str(uuid4())
NOW = datetime.now(timezone.utc).isoformat()


def _thread_row(thread_id=None, title="New Chat"):
    return {
        "id": thread_id or THREAD_ID,
        "user_id": USER_ID,
        "title": title,
        "created_at": NOW,
        "updated_at": NOW,
    }


def _message_row(role="user", content="Hello", message_id=None):
    return {
        "id": message_id or str(uuid4()),
        "thread_id": THREAD_ID,
        "user_id": USER_ID,
        "role": role,
        "content": content,
        "created_at": NOW,
        "updated_at": NOW,
    }


def _run_row(
    *,
    message_id,
    run_id=None,
    status="completed",
    model="gpt-5.4-mini",
    provider="openai",
    started_at=NOW,
    completed_at=NOW,
):
    """Phase 095.1-03 (D-04/D-05): a runs↔messages enrich row carrying the
    4 new additive columns (model, provider, started_at, completed_at) on top
    of the existing run_id/message_id/status the enrich SELECT already reads."""
    return {
        "run_id": run_id or str(uuid4()),
        "message_id": message_id,
        "status": status,
        "model": model,
        "provider": provider,
        "started_at": started_at,
        "completed_at": completed_at,
    }


def _make_sse_chunk(content: str):
    """Return a minimal OpenAI streaming chunk mock with a text delta."""
    chunk = MagicMock()
    chunk.choices = [MagicMock()]
    chunk.choices[0].finish_reason = None
    chunk.choices[0].delta = MagicMock()
    chunk.choices[0].delta.content = content
    chunk.choices[0].delta.tool_calls = None
    return chunk


def _make_done_chunk():
    """Return a streaming chunk that signals finish_reason='stop'."""
    chunk = MagicMock()
    chunk.choices = [MagicMock()]
    chunk.choices[0].finish_reason = "stop"
    chunk.choices[0].delta = MagicMock()
    chunk.choices[0].delta.content = None
    chunk.choices[0].delta.tool_calls = None
    return chunk


def _make_result(data):
    r = MagicMock()
    r.data = data
    return r


# ── /threads ───────────────────────────────────────────────────────────────────

class TestListThreads:
    def test_requires_auth(self, client):
        from tests.conftest import app, mock_user_data
        from app.dependencies import get_current_user
        from fastapi import HTTPException, status as http_status

        def raise_401():
            raise HTTPException(status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

        app.dependency_overrides[get_current_user] = raise_401
        try:
            resp = client.get("/threads")
            assert resp.status_code == 401
        finally:
            app.dependency_overrides[get_current_user] = lambda: mock_user_data

    def test_returns_200_with_auth(self, client, auth_headers, mock_execute_result):
        mock_execute_result.data = [_thread_row()]
        response = client.get("/threads", headers=auth_headers)
        assert response.status_code == 200

    def test_returns_list(self, client, auth_headers, mock_execute_result):
        mock_execute_result.data = [_thread_row()]
        response = client.get("/threads", headers=auth_headers)
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["title"] == "New Chat"

    def test_returns_empty_list_when_no_threads(self, client, auth_headers, mock_execute_result):
        mock_execute_result.data = []
        response = client.get("/threads", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []


class TestCreateThread:
    def test_creates_thread_with_default_title(self, client, auth_headers, mock_execute_result):
        mock_execute_result.data = [_thread_row(title="New Chat")]
        response = client.post("/threads", headers=auth_headers, json={})
        assert response.status_code == 201
        assert response.json()["title"] == "New Chat"

    def test_creates_thread_with_custom_title(self, client, auth_headers, mock_execute_result):
        mock_execute_result.data = [_thread_row(title="My Project")]
        response = client.post("/threads", headers=auth_headers, json={"title": "My Project"})
        assert response.status_code == 201
        assert response.json()["title"] == "My Project"

    def test_returns_thread_response_schema(self, client, auth_headers, mock_execute_result):
        mock_execute_result.data = [_thread_row()]
        response = client.post("/threads", headers=auth_headers, json={})
        data = response.json()
        for key in ("id", "user_id", "title", "created_at", "updated_at"):
            assert key in data


# ── /threads/{id}/messages ─────────────────────────────────────────────────────

class TestGetMessages:
    def test_requires_auth(self, client):
        from tests.conftest import app, mock_user_data
        from app.dependencies import get_current_user
        from fastapi import HTTPException, status as http_status

        def raise_401():
            raise HTTPException(status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

        app.dependency_overrides[get_current_user] = raise_401
        try:
            resp = client.get(f"/threads/{THREAD_ID}/messages")
            assert resp.status_code == 401
        finally:
            app.dependency_overrides[get_current_user] = lambda: mock_user_data

    def test_returns_404_when_thread_not_found(self, client, auth_headers, mock_builder):
        # Thread lookup returns None (not found)
        mock_builder.execute.side_effect = [_make_result(None)]
        response = client.get(f"/threads/{THREAD_ID}/messages", headers=auth_headers)
        assert response.status_code == 404

    def test_returns_message_list(self, client, auth_headers, mock_builder):
        mock_builder.execute.side_effect = [
            _make_result(_thread_row()),           # thread ownership check
            _make_result([
                _message_row("user", "Hello"),
                _message_row("assistant", "Hi there"),
            ]),  # messages
            _make_result([]),                      # runs enrich SELECT (always runs)
        ]
        response = client.get(f"/threads/{THREAD_ID}/messages", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    # ── Phase 095.1-03 (D-04 model attribution + D-05 true reload timer) ──────
    # The additive runs↔messages enrich now stamps model/provider/started_at/
    # completed_at onto each matched assistant message. The execute side_effect
    # order for GET /messages is: (1) thread ownership, (2) messages SELECT,
    # (3) runs enrich SELECT (inside _enrich_messages_with_runs).

    def test_enrich_stamps_model_provider_timer_on_matched_run(
        self, client, auth_headers, mock_builder
    ):
        assistant_id = str(uuid4())
        mock_builder.execute.side_effect = [
            _make_result(_thread_row()),                       # thread ownership
            _make_result([
                _message_row("user", "Hello", message_id=str(uuid4())),
                _message_row("assistant", "Hi there", message_id=assistant_id),
            ]),                                                # messages
            _make_result([                                     # runs enrich
                _run_row(
                    message_id=assistant_id,
                    status="completed",
                    model="gemini-3.5-flash",
                    provider="google",
                    started_at="2026-06-06T10:00:00+00:00",
                    completed_at="2026-06-06T10:00:05+00:00",
                ),
            ]),
        ]
        response = client.get(f"/threads/{THREAD_ID}/messages", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assistant = next(m for m in data if m["role"] == "assistant")
        assert assistant["model"] == "gemini-3.5-flash"
        assert assistant["provider"] == "google"
        # started_at / completed_at flow through as ISO datetimes (serialized
        # by Pydantic) — the true-reload-timer (D-05) reads completed_at − started_at.
        assert assistant["started_at"] is not None
        assert assistant["completed_at"] is not None
        assert "2026-06-06T10:00:00" in assistant["started_at"]
        assert "2026-06-06T10:00:05" in assistant["completed_at"]

    def test_enrich_yields_null_model_provider_for_no_run_message(
        self, client, auth_headers, mock_builder
    ):
        # A legacy / pre-run-backed assistant message has NO matching run row →
        # all 4 new fields must be null (graceful — never a fabricated value).
        assistant_id = str(uuid4())
        mock_builder.execute.side_effect = [
            _make_result(_thread_row()),                       # thread ownership
            _make_result([
                _message_row("assistant", "Legacy reply", message_id=assistant_id),
            ]),                                                # messages
            _make_result([]),                                  # runs enrich: no match
        ]
        response = client.get(f"/threads/{THREAD_ID}/messages", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assistant = data[0]
        assert assistant["model"] is None
        assert assistant["provider"] is None
        assert assistant["started_at"] is None
        assert assistant["completed_at"] is None


class TestSendMessage:
    def test_requires_auth(self, client):
        from tests.conftest import app, mock_user_data
        from app.dependencies import get_current_user
        from fastapi import HTTPException, status as http_status

        def raise_401():
            raise HTTPException(status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

        app.dependency_overrides[get_current_user] = raise_401
        try:
            resp = client.post(
                f"/threads/{THREAD_ID}/messages",
                json={"content": "hello"},
            )
            assert resp.status_code == 401
        finally:
            app.dependency_overrides[get_current_user] = lambda: mock_user_data

    def test_returns_404_when_thread_not_found(self, client, auth_headers, mock_builder):
        mock_builder.execute.side_effect = [_make_result(None)]
        response = client.post(
            f"/threads/{THREAD_ID}/messages",
            headers=auth_headers,
            json={"content": "hello"},
        )
        assert response.status_code == 404

    def test_sse_stream_contains_delta_events(self, client, auth_headers, mock_builder):
        """SSE stream yields data: {...} lines and ends with data: [DONE]."""
        mock_builder.execute.side_effect = [
            _make_result(_thread_row()),             # thread ownership check
            _make_result([_message_row()]),          # insert user message
            _make_result({"folder_id": None}),       # thread folder scope (single)
            _make_result([{"role": "user", "content": "Hello"}]),  # load history
            _make_result([]),                        # skills catalog (default mode)
            _make_result([]),                        # user_memory
            _make_result([_message_row("assistant", "Hi!")]),      # persist assistant msg
            _make_result([]),                        # touch thread updated_at
        ]

        stream_chunks = [
            _make_sse_chunk("Hi"),
            _make_sse_chunk("!"),
            _make_done_chunk(),
        ]

        with patch("app.api.threads.create_streaming_chat", return_value=iter(stream_chunks)):
            with client.stream(
                "POST",
                f"/threads/{THREAD_ID}/messages",
                json={"content": "Hello"},
                headers=auth_headers,
            ) as response:
                assert response.status_code == 200
                lines = list(response.iter_lines())

        data_lines = [l for l in lines if l.startswith("data: ")]
        assert len(data_lines) >= 1

        # Endpoint emits {"type": "done"} and {"type": "stream_end"} instead of [DONE]
        done_lines = [l for l in data_lines if '"type": "done"' in l or '"type": "stream_end"' in l]
        assert len(done_lines) >= 1

    def test_sse_stream_delta_events_are_valid_json(self, client, auth_headers, mock_builder):
        """Each data: line (except [DONE]) should be parseable JSON."""
        mock_builder.execute.side_effect = [
            _make_result(_thread_row()),
            _make_result([_message_row()]),
            _make_result({"folder_id": None}),       # thread folder scope (single)
            _make_result([{"role": "user", "content": "Hello"}]),  # load history
            _make_result([]),                        # skills catalog (default mode)
            _make_result([]),                        # user_memory
            _make_result([_message_row("assistant", "Hello back")]),
            _make_result([]),
        ]

        stream_chunks = [
            _make_sse_chunk("Hello back"),
            _make_done_chunk(),
        ]

        with patch("app.api.threads.create_streaming_chat", return_value=iter(stream_chunks)):
            with client.stream(
                "POST",
                f"/threads/{THREAD_ID}/messages",
                json={"content": "Hello"},
                headers=auth_headers,
            ) as response:
                lines = list(response.iter_lines())

        for line in lines:
            if not line.startswith("data: "):
                continue
            raw = line[6:].strip()
            if raw == "[DONE]":
                continue
            parsed = json.loads(raw)
            assert "type" in parsed


class TestSendMessageDispatchAttribution:
    """Phase 095.1-07 (GAP-2): the POST /messages dispatch JSONResponse carries
    the already-resolved model/provider (additive) so the live assistant message
    can show ``{provider} · {model}`` in the LIVE moment — not only after a reload.

    These drive the modern 201 dispatch path (the SSE-on-POST path was removed in
    Phase 062/063; ``postMessage`` reads {message_id, run_id} from this body). We
    mock ONLY the dispatch primitives that the resolved values feed (insert_run,
    the pg pool, the user-settings/registry resolution, and the producer spawn) so
    the handler reaches its ``return JSONResponse(...)`` deterministically — the
    asserted ``model``/``provider`` equal the values the mocks resolve.
    """

    def _drive(self, client, auth_headers, mock_builder, *, body, settings_model, settings_provider):
        """Run send_message through to its dispatch JSONResponse and return the
        parsed body. The Supabase side_effect rows mirror the aexec call order in
        send_message: thread ownership select -> user-message insert -> title-check
        select. Title generation is short-circuited (title != "New Chat") so the
        run_in_threadpool LLM call never fires."""
        import asyncio
        from types import SimpleNamespace
        from unittest.mock import AsyncMock

        mock_builder.execute.side_effect = [
            _make_result(_thread_row()),                      # thread ownership check (active_workflow_run_id absent)
            _make_result([_message_row("user", "Hello", message_id=MESSAGE_ID)]),  # insert user message
            _make_result(_thread_row(title="Existing title")),  # title-check select (!= "New Chat" -> no gen)
        ]

        _settings = SimpleNamespace(llm_model=settings_model, active_provider=settings_provider)

        def _no_spawn(coro):
            """Don't run the real producer (agent_runner) — close its coroutine
            cleanly and return a REAL already-completed task so the shutdown
            lifespan's RUN_TASKS gather (main.py L280-284) cleans up without a
            MagicMock blowing up at teardown."""
            coro.close()
            return asyncio.get_event_loop().create_task(asyncio.sleep(0))

        with patch("app.api.threads.load_user_settings", return_value=_settings), \
             patch("app.api.threads.override_provider", side_effect=lambda s, p: SimpleNamespace(llm_model=s.llm_model, active_provider=p)), \
             patch("app.api.threads.get_model_capability_async", new=AsyncMock(return_value={})), \
             patch("app.api.threads.insert_run", new=AsyncMock(return_value=None)), \
             patch("app.api.threads.get_pg_pool", new=AsyncMock(return_value=MagicMock())), \
             patch("app.api.threads.asyncio.create_task", side_effect=_no_spawn):
            response = client.post(
                f"/threads/{THREAD_ID}/messages",
                headers=auth_headers,
                json=body,
            )
        return response

    def test_dispatch_response_carries_resolved_model_and_provider(
        self, client, auth_headers, mock_builder
    ):
        """The 201 dispatch body includes additive ``model``/``provider`` equal to
        the resolved values (from user settings when the body omits a model), and
        STILL carries ``message_id``/``run_id`` (the existing contract is intact)."""
        response = self._drive(
            client, auth_headers, mock_builder,
            body={"content": "Hello"},                # no explicit model -> settings.llm_model
            settings_model="gpt-5.4-mini",
            settings_provider="openai",
        )
        assert response.status_code == 201
        data = response.json()
        # Existing contract intact:
        assert data["message_id"] == MESSAGE_ID
        assert "run_id" in data and data["run_id"]
        # Additive attribution (GAP-2): the resolved model/provider cross the boundary.
        assert data["model"] == "gpt-5.4-mini"
        assert data["provider"] == "openai"

    def test_dispatch_response_model_provider_follow_explicit_body_override(
        self, client, auth_headers, mock_builder
    ):
        """When the request body carries an explicit model + provider, the dispatch
        response echoes THOSE resolved values (body.model wins over settings; the
        explicit provider is applied via override_provider)."""
        response = self._drive(
            client, auth_headers, mock_builder,
            body={"content": "Hi", "model": "claude-sonnet-4.5", "provider": "anthropic"},
            settings_model="gpt-5.4-mini",
            settings_provider="openai",
        )
        assert response.status_code == 201
        data = response.json()
        assert data["model"] == "claude-sonnet-4.5"
        assert data["provider"] == "anthropic"

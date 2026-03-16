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


def _message_row(role="user", content="Hello"):
    return {
        "id": str(uuid4()),
        "thread_id": THREAD_ID,
        "user_id": USER_ID,
        "role": role,
        "content": content,
        "created_at": NOW,
        "updated_at": NOW,
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
        ]
        response = client.get(f"/threads/{THREAD_ID}/messages", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


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
            _make_result([{"role": "user", "content": "Hello"}]),  # load history
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

        done_lines = [l for l in data_lines if "[DONE]" in l]
        assert len(done_lines) >= 1

    def test_sse_stream_delta_events_are_valid_json(self, client, auth_headers, mock_builder):
        """Each data: line (except [DONE]) should be parseable JSON."""
        mock_builder.execute.side_effect = [
            _make_result(_thread_row()),
            _make_result([_message_row()]),
            _make_result([{"role": "user", "content": "Hello"}]),
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

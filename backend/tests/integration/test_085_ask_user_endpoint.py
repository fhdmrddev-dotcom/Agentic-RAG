"""Phase 085 Plan 03 Task 3 — POST /runs/{rid}/ask_user_response integration tests.

Covers:
  - Test 1: 200 happy path
  - Test 2: 404 cross-user (NOT 403 — D-062-12 leak-avoidance)
  - Test 3: persists messages row with role='system', kind='ask_user_response'
  - Test 4: PUBLISHes to ``ask_user:{rid}:{tcid}`` with kind='response'
  - Test 5: persist BEFORE publish — if publish fails, request still returns 200
            because the messages row was already inserted (durability path —
            RESEARCH §A.7)

Uses FastAPI's TestClient via the ``client`` fixture from backend/tests/conftest.py.
Supabase is mocked via the shared mock_builder; get_redis is dependency-overridden
to point at the real Redis (so PUBLISH actually flows through).
"""
from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest


RUN_ID = uuid4()
THREAD_ID = "77777777-7777-7777-7777-777777777777"
USER_ID = "00000000-0000-0000-0000-000000000001"


def _seed_runs_row(mock_execute_result, *, status_value="streaming"):
    """Make the supabase ownership SELECT return a row owned by the test user."""
    mock_execute_result.data = {
        "run_id": str(RUN_ID),
        "thread_id": THREAD_ID,
        "status": status_value,
    }


def _seed_runs_row_not_found(mock_execute_result):
    """Make the supabase ownership SELECT return None (cross-user / non-existent)."""
    mock_execute_result.data = None


def test_post_ask_user_response_returns_200_on_happy_path(client, mock_execute_result):
    """Test 1: well-formed POST → 200."""
    _seed_runs_row(mock_execute_result)
    resp = client.post(
        f"/runs/{RUN_ID}/ask_user_response",
        json={
            "tool_call_id": "tcid-1",
            "response_text": "yes please",
            "choice_index": 0,
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"status": "ok"}


def test_post_ask_user_response_cross_user_returns_404(client, mock_execute_result):
    """Test 2: cross-user (no row visible) → 404 (NOT 403) per D-062-12."""
    _seed_runs_row_not_found(mock_execute_result)
    resp = client.post(
        f"/runs/{RUN_ID}/ask_user_response",
        json={
            "tool_call_id": "tcid-x",
            "response_text": "hello",
            "choice_index": None,
        },
    )
    assert resp.status_code == 404, resp.text
    # Detail must NOT leak run existence to other users (just a generic msg).
    assert "not found" in resp.json()["detail"].lower()


def test_post_ask_user_response_persists_messages_row(
    client, mock_execute_result, mock_builder,
):
    """Test 3: messages row inserted with role='system', kind='ask_user_response',
    response_text, choice_index."""
    _seed_runs_row(mock_execute_result)

    resp = client.post(
        f"/runs/{RUN_ID}/ask_user_response",
        json={
            "tool_call_id": "tcid-insert",
            "response_text": "my answer",
            "choice_index": 2,
        },
    )
    assert resp.status_code == 200, resp.text

    # Inspect mock_builder.insert call_args_list — find an insert payload
    # that targets messages with kind=ask_user_response.
    messages_inserts = []
    for call in mock_builder.insert.call_args_list:
        args, _kwargs = call
        if not args:
            continue
        payload = args[0]
        if (
            isinstance(payload, dict)
            and payload.get("role") == "system"
            and "ask_user_response" in json.dumps(payload.get("tool_calls", []))
        ):
            messages_inserts.append(payload)

    assert len(messages_inserts) >= 1, (
        f"expected at least one messages row insert with kind=ask_user_response, "
        f"got inserts: {[c.args for c in mock_builder.insert.call_args_list]}"
    )
    row = messages_inserts[0]
    assert row["role"] == "system"
    assert row["thread_id"] == THREAD_ID
    assert row["user_id"] == USER_ID
    assert row["content"] == "my answer"
    tc = row["tool_calls"][0]
    assert tc["kind"] == "ask_user_response"
    assert tc["tool_call_id"] == "tcid-insert"
    assert tc["response_text"] == "my answer"
    assert tc["choice_index"] == 2


@pytest.mark.asyncio
async def test_post_ask_user_response_publishes_to_channel(redis_client):
    """Test 4: POST PUBLISHes to ``ask_user:{rid}:{tcid}`` with kind='response'.

    This exercises only the publish_response helper directly via the real
    Redis client — the TestClient path is covered by Tests 1-3 above and
    the publish call site is a one-line shim.
    """
    from app.services.ask_user_service import publish_response

    run_id = uuid4()
    tcid = "tcid-publish"
    channel = f"ask_user:{run_id}:{tcid}"

    pubsub = redis_client.pubsub()
    try:
        await pubsub.subscribe(channel)
        await pubsub.get_message(timeout=1.0)  # drain ack

        await publish_response(redis_client, run_id, tcid, "the answer", 1)

        msg = await pubsub.get_message(
            ignore_subscribe_messages=True, timeout=2.0
        )
        assert msg is not None and msg["type"] == "message"
        body = json.loads(msg["data"])
        assert body == {
            "kind": "response",
            "response_text": "the answer",
            "choice_index": 1,
        }
    finally:
        try:
            await pubsub.unsubscribe(channel)
        except Exception:
            pass
        try:
            await asyncio.wait_for(pubsub.aclose(), timeout=2.0)
        except Exception:
            pass


def test_post_ask_user_response_returns_200_when_publish_fails(
    client, mock_execute_result,
):
    """Test 5: persist BEFORE publish — if publish raises, the endpoint STILL
    returns 200 because the messages row was already persisted (durability
    path — RESEARCH §A.7).
    """
    _seed_runs_row(mock_execute_result)

    async def _publish_raises(*_args, **_kwargs):
        raise RuntimeError("simulated PUBLISH failure (no subscriber)")

    with patch(
        "app.services.ask_user_service.publish_response",
        side_effect=_publish_raises,
    ):
        resp = client.post(
            f"/runs/{RUN_ID}/ask_user_response",
            json={
                "tool_call_id": "tcid-dura",
                "response_text": "still recorded",
                "choice_index": None,
            },
        )

    assert resp.status_code == 200, resp.text

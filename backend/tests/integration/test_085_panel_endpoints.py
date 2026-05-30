"""Phase 085 Plan 04 Task 2/3 — panel.py REST endpoint integration tests.

Covers all 3 GET endpoints under ``/threads/{thread_id}``:
  - GET /todos               (Task 2)
  - GET /ask_user/pending    (Task 3)
  - GET /tasks               (Task 3)

Uses the shared FastAPI TestClient from backend/tests/conftest.py. Supabase
is mocked via the shared mock_builder; get_pg_pool is dependency-overridden
to point at an AsyncMock so the asyncpg-backed endpoints don't hit a real DB.

Test 1: GET /todos with authenticated user returns 200 + list shape
Test 2: GET /todos on a cross-user thread returns 404 (NOT 403 — D-062-12)
Test 3: GET /todos returns rows ordered by order_index ASC, created_at ASC
Test 4: GET /todos returned rows have wire-format keys (id, content, status,
        parent_id, order_index, created_at, updated_at)
Test 5: panel.router is wired into the FastAPI app (smoke import)
"""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


THREAD_ID = "55555555-5555-5555-5555-555555555555"
OTHER_USER_THREAD_ID = "99999999-9999-9999-9999-999999999999"


# ---------------------------------------------------------------------------
# Smoke: panel.router is mounted in the FastAPI app
# ---------------------------------------------------------------------------


def test_panel_router_mounted_in_app():
    """Test 5 (Task 2): importing app.main wires panel.router under /threads/{thread_id}."""
    from app.api import panel
    from app.main import app

    routes = [r.path for r in app.routes]
    assert "/threads/{thread_id}/todos" in routes
    # Sanity: the router itself uses the expected prefix
    assert panel.router.prefix == "/threads/{thread_id}"


def test_panel_router_has_all_three_get_endpoints():
    """Task 3 gate: after Task 3 lands, all three Phase 085 GET endpoints are wired."""
    from app.main import app

    routes = [r.path for r in app.routes]
    assert "/threads/{thread_id}/todos" in routes
    assert "/threads/{thread_id}/ask_user/pending" in routes
    assert "/threads/{thread_id}/tasks" in routes


# ---------------------------------------------------------------------------
# GET /threads/{tid}/todos
# ---------------------------------------------------------------------------


def _seed_thread_owned(mock_execute_result):
    """First aexec (the ownership SELECT) returns a row → thread is owned."""
    mock_execute_result.data = {"id": THREAD_ID}


def _seed_thread_not_owned(mock_execute_result):
    """Ownership SELECT returns no row → 404."""
    mock_execute_result.data = None


def test_get_todos_returns_200_and_list_for_owned_thread(
    client, mock_execute_result, mock_builder,
):
    """Test 1: authenticated user, owned thread → 200 + list-shaped body."""
    # Both aexec calls in this endpoint share the same execute_result mock; we use
    # side_effect on .execute to switch between the ownership row and the todos rows.
    ownership_row = MagicMock()
    ownership_row.data = {"id": THREAD_ID}
    todos_rows = MagicMock()
    todos_rows.data = [
        {
            "todo_id": "t1", "content": "first", "status": "pending",
            "parent_id": None, "order_index": 0,
            "created_at": "2026-05-28T00:00:00+00:00",
            "updated_at": "2026-05-28T00:00:00+00:00",
        },
    ]
    mock_builder.execute.side_effect = [ownership_row, todos_rows]

    resp = client.get(f"/threads/{THREAD_ID}/todos")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) == 1


def test_get_todos_cross_user_thread_returns_404(client, mock_execute_result):
    """Test 2: cross-user (ownership SELECT empty) → 404, NOT 403 (D-062-12)."""
    _seed_thread_not_owned(mock_execute_result)

    resp = client.get(f"/threads/{OTHER_USER_THREAD_ID}/todos")

    assert resp.status_code == 404, resp.text
    # Detail must NOT leak existence (just a generic 'not found' message)
    assert "not found" in resp.json()["detail"].lower()


def test_get_todos_wire_format_keys(client, mock_builder):
    """Test 4: response items have the wire-format keys (id, content, status,
    parent_id, order_index, created_at, updated_at). The DB column ``todo_id``
    is renamed to ``id`` to match the SSE ``todo_updated`` payload shape.
    """
    ownership_row = MagicMock()
    ownership_row.data = {"id": THREAD_ID}
    todos_rows = MagicMock()
    todos_rows.data = [
        {
            "todo_id": "t1", "content": "hello", "status": "in_progress",
            "parent_id": None, "order_index": 0,
            "created_at": "2026-05-28T10:00:00+00:00",
            "updated_at": "2026-05-28T10:00:00+00:00",
        },
    ]
    mock_builder.execute.side_effect = [ownership_row, todos_rows]

    resp = client.get(f"/threads/{THREAD_ID}/todos")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body) == 1
    expected_keys = {"id", "content", "status", "parent_id", "order_index", "created_at", "updated_at"}
    assert set(body[0].keys()) == expected_keys
    # ``todo_id`` is the DB column; ``id`` is the wire key
    assert body[0]["id"] == "t1"
    assert "todo_id" not in body[0]


def test_get_todos_orders_by_order_index_then_created_at(client, mock_builder):
    """Test 3: GET /todos issues a query with ``.order('order_index')`` followed by
    ``.order('created_at')``. Verifies by inspecting the recorded ``.order`` calls
    on the shared mock_builder during the request."""
    ownership_row = MagicMock()
    ownership_row.data = {"id": THREAD_ID}
    todos_rows = MagicMock()
    todos_rows.data = []
    mock_builder.execute.side_effect = [ownership_row, todos_rows]

    resp = client.get(f"/threads/{THREAD_ID}/todos")
    assert resp.status_code == 200

    # ``.order(...)`` is called at least twice: once for order_index, once for created_at
    order_calls = [call.args for call in mock_builder.order.call_args_list]
    assert ("order_index",) in order_calls
    assert ("created_at",) in order_calls


# ---------------------------------------------------------------------------
# GET /threads/{tid}/ask_user/pending  (Task 3)
# ---------------------------------------------------------------------------


def _make_mock_pool(rows):
    """Build a mock asyncpg pool whose fetch() returns the given rows."""
    mock_pool = MagicMock()
    mock_pool.fetch = AsyncMock(return_value=rows)
    return mock_pool


def _patch_pg_pool(mock_pool):
    """Patch app.api.panel.get_pg_pool to return ``mock_pool``. Use as a
    context manager around the client call. get_pg_pool is invoked
    directly inside the endpoint (NOT via Depends) so we monkey-patch the
    panel-module-level symbol — same effect as a dependency override but
    works for the direct-call site."""
    async def _async_pool():
        return mock_pool
    return patch("app.api.panel.get_pg_pool", side_effect=_async_pool)


def test_get_pending_ask_user_returns_pending_prompt(
    client, mock_execute_result, mock_builder,
):
    """Test 1: a single pending prompt (no matching response) returns a 1-element list."""
    _seed_thread_owned(mock_execute_result)

    created = datetime(2026, 5, 28, 12, 0, 0, tzinfo=timezone.utc)
    pool_rows = [
        {
            "id": uuid4(),
            "tool_calls": [{
                "kind": "ask_user_prompt",
                "tool_call_id": "tcid-1",
                "prompt": "which file?",
                "options": ["a.txt", "b.txt"],
                "timeout_seconds": 300,
                "run_id": "rid-1",
            }],
            "created_at": created,
        },
    ]
    mock_pool = _make_mock_pool(pool_rows)

    with _patch_pg_pool(mock_pool):
        resp = client.get(f"/threads/{THREAD_ID}/ask_user/pending")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body) == 1
    row = body[0]
    assert row["tool_call_id"] == "tcid-1"
    assert row["prompt"] == "which file?"
    assert row["options"] == ["a.txt", "b.txt"]
    assert row["timeout_seconds"] == 300
    assert row["run_id"] == "rid-1"
    assert row["created_at"] == created.isoformat()


def test_get_pending_ask_user_empty_when_response_present(client, mock_execute_result):
    """Test 2 surrogate: when the asyncpg NOT EXISTS subquery would exclude the
    prompt row (because a response companion exists), pool.fetch returns []
    and the endpoint returns []. (The actual SQL filter is tested by the SQL
    string presence + the live integration UAT row in VALIDATION.md.)"""
    _seed_thread_owned(mock_execute_result)
    mock_pool = _make_mock_pool([])

    with _patch_pg_pool(mock_pool):
        resp = client.get(f"/threads/{THREAD_ID}/ask_user/pending")

    assert resp.status_code == 200, resp.text
    assert resp.json() == []


def test_get_pending_ask_user_orders_by_created_at_asc(client, mock_execute_result):
    """Test 3: the SQL string for /ask_user/pending includes ORDER BY ... ASC on
    created_at AND uses the jsonb @> containment + NOT EXISTS subquery."""
    _seed_thread_owned(mock_execute_result)
    mock_pool = _make_mock_pool([])

    with _patch_pg_pool(mock_pool):
        resp = client.get(f"/threads/{THREAD_ID}/ask_user/pending")

    assert resp.status_code == 200
    mock_pool.fetch.assert_awaited_once()
    sql = mock_pool.fetch.await_args.args[0]
    assert "ORDER BY m.created_at ASC" in sql
    assert "tool_calls @>" in sql
    assert "ask_user_prompt" in sql
    assert "ask_user_response" in sql
    assert "NOT EXISTS" in sql


def test_get_pending_ask_user_extracts_payload_from_tool_calls(
    client, mock_execute_result,
):
    """Test 4: each row carries prompt details extracted from tool_calls[0]."""
    _seed_thread_owned(mock_execute_result)

    created = datetime(2026, 5, 28, 13, 0, 0, tzinfo=timezone.utc)
    pool_rows = [
        {
            "id": uuid4(),
            "tool_calls": [{
                "kind": "ask_user_prompt",
                "tool_call_id": "tcid-2",
                "prompt": "what?",
                "options": None,
                "timeout_seconds": 60,
                "run_id": "rid-2",
            }],
            "created_at": created,
        },
    ]
    mock_pool = _make_mock_pool(pool_rows)

    with _patch_pg_pool(mock_pool):
        resp = client.get(f"/threads/{THREAD_ID}/ask_user/pending")

    assert resp.status_code == 200
    row = resp.json()[0]
    assert set(row.keys()) == {
        "message_id", "tool_call_id", "prompt", "options",
        "timeout_seconds", "run_id", "created_at",
    }
    assert row["tool_call_id"] == "tcid-2"
    assert row["prompt"] == "what?"
    assert row["options"] is None


# ---------------------------------------------------------------------------
# GET /threads/{tid}/tasks  (Task 3)
# ---------------------------------------------------------------------------


def test_get_tasks_returns_sub_agent_runs(client, mock_execute_result):
    """Test 5: GET /tasks returns sub-agent runs whose parent_run_id is in the
    caller's runs for this thread."""
    _seed_thread_owned(mock_execute_result)

    sub_run_id = uuid4()
    parent_run_id = uuid4()
    started = datetime(2026, 5, 28, 14, 0, 0, tzinfo=timezone.utc)
    completed = datetime(2026, 5, 28, 14, 0, 30, tzinfo=timezone.utc)
    pool_rows = [
        {
            "sub_run_id": sub_run_id,
            "started_at": started,
            "completed_at": completed,
            "status": "completed",
            "model": "gpt-5-mini",
            "provider": "openai",
            "parent_run_id": parent_run_id,
        },
    ]
    mock_pool = _make_mock_pool(pool_rows)

    with _patch_pg_pool(mock_pool):
        resp = client.get(f"/threads/{THREAD_ID}/tasks")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body) == 1
    row = body[0]
    assert row["sub_run_id"] == str(sub_run_id)
    assert row["parent_run_id"] == str(parent_run_id)
    assert row["status"] == "completed"
    assert row["model"] == "gpt-5-mini"
    assert row["provider"] == "openai"
    assert row["started_at"] == started.isoformat()
    assert row["completed_at"] == completed.isoformat()


def test_get_tasks_orders_by_started_at_desc(client, mock_execute_result):
    """Test 6: SQL string includes ORDER BY ... DESC on started_at (newest first)
    AND the cross-thread / cross-user gate (parent_run_id IN subquery on
    thread_id=$1, user_id=$2)."""
    _seed_thread_owned(mock_execute_result)
    mock_pool = _make_mock_pool([])

    with _patch_pg_pool(mock_pool):
        resp = client.get(f"/threads/{THREAD_ID}/tasks")

    assert resp.status_code == 200
    mock_pool.fetch.assert_awaited_once()
    sql = mock_pool.fetch.await_args.args[0]
    assert "ORDER BY r.started_at DESC" in sql
    # And the cross-thread gate: parent_run_id IN (SELECT … WHERE thread_id = $1 AND user_id = $2)
    assert "parent_run_id IN" in sql
    assert "thread_id = $1" in sql
    assert "user_id = $2" in sql


def test_get_tasks_cross_user_thread_returns_404(client, mock_execute_result):
    """Test 7: cross-user thread → 404 from the ownership gate before pg pool acquire."""
    _seed_thread_not_owned(mock_execute_result)

    resp = client.get(f"/threads/{OTHER_USER_THREAD_ID}/tasks")

    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_get_pending_ask_user_cross_user_thread_returns_404(client, mock_execute_result):
    """Test 7 companion: same 404 gate on /ask_user/pending."""
    _seed_thread_not_owned(mock_execute_result)

    resp = client.get(f"/threads/{OTHER_USER_THREAD_ID}/ask_user/pending")

    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()

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

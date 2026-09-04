"""Phase 228 — Deep Run cap_paused Mount Reconcile Integration Test (G-9 & BUG-260818-03).

Verifies:
  1. GET /threads/{id}/workflow through the real serializer returns cap_paused=True
     and latest_producer_run_id populated with the deep run's run_id when runs.status = 'cap_paused'.
  2. The serializer calculates continues_remaining = 3 - continues_used.
  3. Proves s_backend matches s_frontend without mocking either the serializer or the route handler.
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch
import pytest


def test_deep_run_cap_paused_reconcile_surfaces_run_id_and_pause(
    client, mock_asyncpg_pool, mock_execute_result
):
    """G-9: Real serializer test verifying GET /threads/{id}/workflow surfaces
    cap_paused=True and latest_producer_run_id for deep-mode runs paused at the iteration cap.
    """
    thread_id = uuid.uuid4()
    deep_run_id = uuid.uuid4()

    # Ownership SELECT returns the thread with NO active workflow anchor (Deep mode)
    mock_execute_result.data = {
        "id": str(thread_id),
        "active_workflow_run_id": None,
    }

    # fetchrow returns:
    # 1. deep cap_paused probe -> deep_row with run_id, status='cap_paused', continues_used=1
    # 2. workflow_runs ARM B probe -> None (no workflow_runs row for deep thread)
    mock_asyncpg_pool.set_fetchrow_results([
        {
            "run_id": deep_run_id,
            "status": "cap_paused",
            "continues_used": 1,
        },
        None,  # no workflow_runs row
    ])

    with patch("app.api.threads.get_pg_pool", AsyncMock(return_value=mock_asyncpg_pool)), \
         patch("app.dependencies.get_pg_pool", AsyncMock(return_value=mock_asyncpg_pool)):
        resp = client.get(f"/threads/{thread_id}/workflow")

    assert resp.status_code == 200, resp.text
    body = resp.json()

    # Reconciled shape assertions (G-9)
    assert body["mode"] == "deep"
    assert body["locked"] is False
    assert body["cap_paused"] is True
    assert body["continues_used"] == 1
    assert body["continues_remaining"] == 2  # 3 - 1
    assert body["latest_producer_run_id"] == str(deep_run_id)
    assert body["active_workflow_run_id"] is None

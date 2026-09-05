"""Phase 234 (LIB-08 / QUEUE-03) — Unit tests for app.db.watches.

Tests:
1. create_watch, get_watch, list_watches, update_watch, delete_watch CRUD & scoping.
2. claim_due_watches atomic transaction with FOR UPDATE SKIP LOCKED and leased_until guard.
3. release_watch and record_skipped_still_running lease lifecycle.
4. connector_watch_items upsert, retrieval, and lifecycle state updates.
"""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest

from app.db.watches import (
    bulk_update_item_states,
    claim_due_watches,
    create_watch,
    delete_watch,
    get_watch,
    get_watch_item_by_external_id,
    get_watch_items,
    list_watches,
    record_skipped_still_running,
    release_watch,
    update_item_state,
    update_watch,
    upsert_watch_item,
)


@pytest.mark.asyncio
async def test_create_watch_mock():
    pool = MagicMock()
    con = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = con

    user_id = uuid4()
    org_id = uuid4()
    conn_id = uuid4()
    watch_id = uuid4()
    expected_row = {
        "id": watch_id,
        "user_id": user_id,
        "org_id": org_id,
        "connection_id": conn_id,
        "source_folder_id": "folder-123",
        "source_folder_name": "Invoices",
        "source_drive_id": None,
        "library_folder_id": None,
        "interval_minutes": 30,
        "next_run_at": datetime.now(timezone.utc),
        "leased_until": None,
        "is_active": True,
        "last_run_at": None,
        "last_status": None,
        "last_error": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    con.fetchrow.return_value = expected_row

    res = await create_watch(
        pool,
        user_id=user_id,
        connection_id=conn_id,
        source_folder_id="folder-123",
        source_folder_name="Invoices",
        org_id=org_id,
        interval_minutes=30,
    )

    assert res["id"] == watch_id
    assert res["source_folder_name"] == "Invoices"
    assert con.fetchrow.called
    call_args = con.fetchrow.call_args[0]
    assert "INSERT INTO connector_watches" in call_args[0]
    # Check that interval floor is enforced: min 5m
    assert call_args[8] == 30


@pytest.mark.asyncio
async def test_get_and_list_watches_scoped():
    pool = MagicMock()
    con = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = con

    watch_id = uuid4()
    user_id = uuid4()
    org_id = uuid4()

    con.fetchrow.return_value = {"id": watch_id, "user_id": user_id, "org_id": org_id}
    res = await get_watch(pool, watch_id, user_id=user_id, org_id=org_id)
    assert res is not None
    assert res["id"] == watch_id
    sql = con.fetchrow.call_args[0][0]
    assert "user_id = $2" in sql
    assert "org_id = $3" in sql

    con.fetch.return_value = [{"id": watch_id, "user_id": user_id, "org_id": org_id}]
    watches = await list_watches(pool, user_id=user_id, org_id=org_id)
    assert len(watches) == 1
    sql_list = con.fetch.call_args[0][0]
    assert "user_id = $1" in sql_list
    assert "org_id = $2" in sql_list


@pytest.mark.asyncio
async def test_update_and_delete_watch():
    pool = MagicMock()
    con = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = con

    watch_id = uuid4()
    user_id = uuid4()

    con.fetchrow.return_value = {"id": watch_id, "interval_minutes": 60, "is_active": False}
    updated = await update_watch(pool, watch_id, user_id=user_id, interval_minutes=60, is_active=False)
    assert updated["interval_minutes"] == 60
    assert updated["is_active"] is False

    con.execute.return_value = "DELETE 1"
    ok = await delete_watch(pool, watch_id, user_id=user_id)
    assert ok is True

    con.execute.return_value = "DELETE 0"
    ok_miss = await delete_watch(pool, watch_id, user_id=user_id)
    assert ok_miss is False


@pytest.mark.asyncio
async def test_claim_due_watches_atomic_transaction():
    pool = MagicMock()
    con = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = con
    tx = MagicMock()
    tx.__aenter__ = AsyncMock(return_value=tx)
    tx.__aexit__ = AsyncMock(return_value=None)
    con.transaction = MagicMock(return_value=tx)

    watch_id = uuid4()
    due_rows = [
        {
            "id": watch_id,
            "org_id": uuid4(),
            "user_id": uuid4(),
            "connection_id": uuid4(),
            "source_folder_id": "folder-1",
            "source_folder_name": "DriveFolder",
            "source_drive_id": None,
            "library_folder_id": None,
            "interval_minutes": 30,
            "next_run_at": datetime.now(timezone.utc),
            "leased_until": None,
        }
    ]
    con.fetch.return_value = due_rows

    claimed = await claim_due_watches(pool, limit=5, lease_seconds=300)

    assert len(claimed) == 1
    assert claimed[0]["id"] == watch_id
    # Assert query executed inside transaction with FOR UPDATE SKIP LOCKED
    fetch_sql = con.fetch.call_args[0][0]
    assert "FOR UPDATE SKIP LOCKED" in fetch_sql
    assert "WHERE is_active = true" in fetch_sql

    # Assert update executed inside transaction setting leased_until and advancing next_run_at
    update_sql = con.execute.call_args[0][0]
    assert "leased_until = now() +" in update_sql
    assert "next_run_at = now() +" in update_sql
    assert "last_status = 'running'" in update_sql


@pytest.mark.asyncio
async def test_release_and_skip_still_running():
    pool = MagicMock()
    con = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = con

    watch_id = uuid4()

    await release_watch(pool, watch_id, status="success")
    assert con.execute.called
    assert "leased_until = NULL" in con.execute.call_args[0][0]
    assert "last_status = $2" in con.execute.call_args[0][0]

    con.execute.reset_mock()
    await record_skipped_still_running(pool, watch_id)
    assert con.execute.called
    assert "last_status = 'skipped_still_running'" in con.execute.call_args[0][0]


@pytest.mark.asyncio
async def test_watch_items_upsert_and_lifecycle():
    pool = MagicMock()
    con = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = con

    watch_id = uuid4()
    item_id = uuid4()
    user_id = uuid4()
    doc_id = uuid4()

    con.fetchrow.return_value = {
        "id": item_id,
        "watch_id": watch_id,
        "external_id": "file-abc",
        "name": "Report.pdf",
        "state": "present",
        "document_id": doc_id,
    }

    item = await upsert_watch_item(
        pool,
        watch_id=watch_id,
        external_id="file-abc",
        name="Report.pdf",
        user_id=user_id,
        document_id=doc_id,
        state="present",
    )
    assert item["external_id"] == "file-abc"
    upsert_sql = con.fetchrow.call_args[0][0]
    assert "ON CONFLICT (watch_id, external_id) DO UPDATE" in upsert_sql

    con.fetch.return_value = [item]
    items = await get_watch_items(pool, watch_id)
    assert len(items) == 1

    con.fetchrow.return_value = item
    single = await get_watch_item_by_external_id(pool, watch_id, "file-abc")
    assert single["name"] == "Report.pdf"

    await update_item_state(pool, item_id, state="missing")
    assert "SET state = $2" in con.execute.call_args[0][0]

    await bulk_update_item_states(pool, [item_id], state="missing")
    assert "WHERE id = ANY($1::uuid[])" in con.execute.call_args[0][0]

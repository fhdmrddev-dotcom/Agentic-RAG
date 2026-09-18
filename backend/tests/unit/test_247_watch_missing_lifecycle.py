"""Unit tests for Phase 247 Plan 02 (WATCH-05, WATCH-03).

Asserts:
- Watch loop writes UTC missing_since timestamp when marking item missing under complete listing (WATCH-05).
- Watch loop clears missing_since when item re-appears and restores to present.
- Incomplete listing (H-5) strictly suppresses missing transitions and missing_since.
- Disabled connection (is_enabled == False) immediately reported as stopped in /sources/health (WATCH-03).
- Strict boundary fence on backend/app/api/connectors.py (0 lines modified).
"""

from __future__ import annotations

import subprocess
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.api.sources import get_source_health
from app.db.watches import update_item_state
from app.services.sources.base import FilePage, SourceFile, SourceListing
from app.services.watch_service import WatchService


USER_ID = uuid4()
ORG_ID = uuid4()
WATCH_ID = uuid4()
CONN_ID = uuid4()
ITEM_ID = uuid4()


# ── 1. missing_since Lifecycle Tests (WATCH-05) ──────────────────────────────


@pytest.mark.asyncio
async def test_missing_since_recorded_on_disappearance():
    """WATCH-05: When a file is deleted/absent at source in a complete listing,

    update_item_state is called with state='missing' and a non-null UTC missing_since.
    """
    sb = MagicMock()
    pool = MagicMock()

    watch_record = {
        "id": WATCH_ID,
        "connection_id": CONN_ID,
        "user_id": USER_ID,
        "org_id": ORG_ID,
        "library_folder_id": None,
        "source_folder_id": "fld-root",
        "interval_minutes": 30,
        "status": "running",
    }

    # Item in DB that will not appear in source listing
    existing_item = {
        "id": ITEM_ID,
        "watch_id": WATCH_ID,
        "external_id": "file-123",
        "name": "Tax_2025.pdf",
        "state": "present",
        "document_id": uuid4(),
        "source_version": "1.0",
        "missing_since": None,
    }

    # Empty file page, complete listing
    mock_adapter = MagicMock()
    mock_adapter.list_files = AsyncMock(
        return_value=FilePage(files=[], next_page_token=None, deletions_detectable=True)
    )

    doc_update_mock = MagicMock()
    doc_update_mock.update.return_value = doc_update_mock
    doc_update_mock.eq.return_value = doc_update_mock
    doc_update_mock.execute.return_value = MagicMock()
    sb.table.return_value = doc_update_mock

    with patch("app.services.watch_service.claim_due_watches", new=AsyncMock(return_value=[watch_record])), patch(
        "app.services.watch_service.get_watch_items", new=AsyncMock(return_value=[existing_item])
    ), patch("app.services.watch_service.update_item_state", new=AsyncMock()) as mock_update_item, patch(
        "app.services.watch_service.release_watch", new=AsyncMock()
    ), patch(
        "app.services.sources.base.SourceRegistry.get_adapter", return_value=mock_adapter
    ):
        svc = WatchService(pool=pool, supabase=sb)
        await svc.tick()

        # Assert update_item_state was called with state='missing' and a valid UTC missing_since
        mock_update_item.assert_awaited_once()
        args, kwargs = mock_update_item.call_args
        assert kwargs["state"] == "missing"
        assert kwargs["missing_since"] is not None
        assert isinstance(kwargs["missing_since"], datetime)
        assert kwargs["missing_since"].tzinfo is not None


@pytest.mark.asyncio
async def test_missing_since_cleared_on_reappearance():
    """WATCH-05: When a previously missing file re-appears at source,

    it restores to state='present' and clears missing_since.
    """
    sb = MagicMock()
    pool = MagicMock()

    watch_record = {
        "id": WATCH_ID,
        "connection_id": CONN_ID,
        "user_id": USER_ID,
        "org_id": ORG_ID,
        "library_folder_id": None,
        "source_folder_id": "fld-root",
        "interval_minutes": 30,
        "status": "running",
    }

    # Item in DB that was missing
    past_missing_time = datetime(2026, 9, 5, 10, 0, tzinfo=timezone.utc)
    existing_item = {
        "id": ITEM_ID,
        "watch_id": WATCH_ID,
        "external_id": "file-123",
        "name": "Tax_2025.pdf",
        "state": "missing",
        "document_id": uuid4(),
        "source_version": "1.0",
        "missing_since": past_missing_time,
    }

    # Re-appearing file in source listing
    reappeared_file = SourceFile(
        id="file-123",
        name="Tax_2025.pdf",
        mime_type="application/pdf",
        size=1024,
        modified_at="1.0",
        path="/Tax_2025.pdf",
    )

    mock_adapter = MagicMock()
    mock_adapter.list_files = AsyncMock(
        return_value=FilePage(files=[reappeared_file], next_page_token=None, deletions_detectable=True)
    )

    doc_update_mock = MagicMock()
    doc_update_mock.update.return_value = doc_update_mock
    doc_update_mock.eq.return_value = doc_update_mock
    doc_update_mock.execute.return_value = MagicMock()
    sb.table.return_value = doc_update_mock

    with patch("app.services.watch_service.claim_due_watches", new=AsyncMock(return_value=[watch_record])), patch(
        "app.services.watch_service.get_watch_items", new=AsyncMock(return_value=[existing_item])
    ), patch("app.services.watch_service.update_item_state", new=AsyncMock()) as mock_update_item, patch(
        "app.services.watch_service.release_watch", new=AsyncMock()
    ), patch(
        "app.services.sources.base.SourceRegistry.get_adapter", return_value=mock_adapter
    ):
        svc = WatchService(pool=pool, supabase=sb)
        await svc.tick()

        # Assert update_item_state was called with state='present' and clear_missing_since=True
        mock_update_item.assert_awaited_once()
        args, kwargs = mock_update_item.call_args
        assert kwargs["state"] == "present"
        assert kwargs["clear_missing_since"] is True


@pytest.mark.asyncio
async def test_h5_incomplete_listing_suppresses_missing_transition():
    """H-5 / Onyx #1161 guard: If listing is incomplete, missing transitions are forbidden."""
    sb = MagicMock()
    pool = MagicMock()

    watch_record = {
        "id": WATCH_ID,
        "connection_id": CONN_ID,
        "user_id": USER_ID,
        "org_id": ORG_ID,
        "library_folder_id": None,
        "source_folder_id": "fld-root",
        "interval_minutes": 30,
        "status": "running",
    }

    existing_item = {
        "id": ITEM_ID,
        "watch_id": WATCH_ID,
        "external_id": "file-123",
        "name": "Tax_2025.pdf",
        "state": "present",
        "document_id": uuid4(),
        "source_version": "1.0",
        "missing_since": None,
    }

    mock_adapter = MagicMock()
    # Adapter raises mid-pagination -> incomplete listing
    mock_adapter.list_files = AsyncMock(side_effect=RuntimeError("Transient network drop"))

    with patch("app.services.watch_service.claim_due_watches", new=AsyncMock(return_value=[watch_record])), patch(
        "app.services.watch_service.get_watch_items", new=AsyncMock(return_value=[existing_item])
    ), patch("app.services.watch_service.update_item_state", new=AsyncMock()) as mock_update_item, patch(
        "app.services.watch_service.release_watch", new=AsyncMock()
    ), patch(
        "app.services.sources.base.SourceRegistry.get_adapter", return_value=mock_adapter
    ):
        svc = WatchService(pool=pool, supabase=sb)
        await svc.tick()

        # Update item state must NOT be called to transition item to missing
        mock_update_item.assert_not_called()


# ── 2. Connection is_enabled Health Reflection (WATCH-03) ───────────────────


@pytest.mark.asyncio
async def test_disabled_connection_immediately_reported_stopped():
    """WATCH-03: When a connection has is_enabled == False,

    GET /sources/health immediately marks watches on it as stopped with cause='connection_disabled'.
    """
    pool = MagicMock()
    user = {"id": str(USER_ID)}
    req = MagicMock()
    req.app.state.watch_service = MagicMock()

    conn_updated = datetime(2026, 9, 14, 4, 0, 0, tzinfo=timezone.utc)

    # Watch record
    watches = [
        {
            "id": WATCH_ID,
            "connection_id": CONN_ID,
            "source_folder_name": "Finance",
        }
    ]

    # Connection row with is_enabled = False
    conn_rows = [
        {
            "id": CONN_ID,
            "name": "Google Drive Corp",
            "is_enabled": False,
            "updated_at": conn_updated,
        }
    ]

    # Recent runs show prior success!
    runs = {
        str(WATCH_ID): [
            {
                "status": "success",
                "failure_cause": None,
                "started_at": datetime(2026, 9, 14, 3, 30, 0, tzinfo=timezone.utc),
            }
        ]
    }

    mock_con = AsyncMock()
    mock_con.fetch = AsyncMock(return_value=conn_rows)
    pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_con)
    pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)

    with patch("app.api.sources.list_watches", new=AsyncMock(return_value=watches)), patch(
        "app.api.sources.recent_runs_by_watch", new=AsyncMock(return_value=runs)
    ):
        resp = await get_source_health(request=req, current_user=user, pool=pool)
        assert len(resp.stopped) == 1

        st = resp.stopped[0]
        assert st.watch_id == WATCH_ID
        assert st.connection_name == "Google Drive Corp"
        assert st.cause == "connection_disabled"
        assert st.hard is True
        assert st.stopped_since == conn_updated


@pytest.mark.asyncio
async def test_enabled_connection_does_not_falsely_report_disabled():
    """WATCH-03: An enabled connection with recent success is NOT reported as stopped."""
    pool = MagicMock()
    user = {"id": str(USER_ID)}
    req = MagicMock()
    req.app.state.watch_service = MagicMock()

    watches = [
        {
            "id": WATCH_ID,
            "connection_id": CONN_ID,
            "source_folder_name": "Finance",
        }
    ]

    conn_rows = [
        {
            "id": CONN_ID,
            "name": "Google Drive Corp",
            "is_enabled": True,
            "updated_at": datetime(2026, 9, 14, 4, 0, 0, tzinfo=timezone.utc),
        }
    ]

    runs = {
        str(WATCH_ID): [
            {
                "status": "success",
                "failure_cause": None,
                "started_at": datetime(2026, 9, 14, 3, 30, 0, tzinfo=timezone.utc),
            }
        ]
    }

    mock_con = AsyncMock()
    mock_con.fetch = AsyncMock(return_value=conn_rows)
    pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_con)
    pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)

    with patch("app.api.sources.list_watches", new=AsyncMock(return_value=watches)), patch(
        "app.api.sources.recent_runs_by_watch", new=AsyncMock(return_value=runs)
    ):
        resp = await get_source_health(request=req, current_user=user, pool=pool)
        assert len(resp.stopped) == 0


# ── 3. Boundary Fence & Connectors Integrity ─────────────────────────────────


def test_connectors_api_byte_identical_fence():
    """Fence: backend/app/api/connectors.py must NOT have any git modifications."""
    res = subprocess.run(
        ["git", "status", "--porcelain", "backend/app/api/connectors.py"],
        capture_output=True,
        text=True,
        check=True,
    )
    assert res.stdout.strip() == "", (
        f"FENCE VIOLATION: backend/app/api/connectors.py was modified: {res.stdout}"
    )

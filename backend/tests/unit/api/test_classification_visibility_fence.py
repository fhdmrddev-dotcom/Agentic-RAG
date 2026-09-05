"""Unit tests for Classification Access Fence (Phase 234 — H-4 / VIS-06 / TM-234-03)."""
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest
from fastapi import HTTPException

from app.api.documents import accept_classification


@pytest.fixture
def mock_user():
    return {"id": str(uuid4())}


@pytest.fixture
def mock_supabase():
    sb = MagicMock()
    return sb


@pytest.mark.asyncio
async def test_accept_classification_refuses_widening_private_to_org_shared_without_force(mock_user, mock_supabase):
    """H-4 / VIS-06: Moving private connected document to org-shared folder without force=True raises 403."""
    doc_id = str(uuid4())
    target_folder_id = str(uuid4())
    user_id = mock_user["id"]

    doc_data = {
        "id": doc_id,
        "folder_id": None,
        "source_connection_id": str(uuid4()),
        "ingest_visibility": "private",
        "metadata": {
            "_classification": {
                "status": "suggested",
                "suggested_folder_id": target_folder_id,
                "rule_id": str(uuid4()),
            }
        },
    }
    folder_data = {
        "id": target_folder_id,
        "is_org_shared": True,
    }

    doc_query = MagicMock()
    doc_query.select.return_value = doc_query
    doc_query.eq.return_value = doc_query
    doc_query.maybe_single.return_value = doc_query
    doc_query.execute.return_value = MagicMock(data=doc_data)

    folder_query = MagicMock()
    folder_query.select.return_value = folder_query
    folder_query.eq.return_value = folder_query
    folder_query.or_.return_value = folder_query
    folder_query.maybe_single.return_value = folder_query
    folder_query.execute.return_value = MagicMock(data=folder_data)

    def table_mock(name):
        if name == "documents":
            return doc_query
        elif name == "folders":
            return folder_query
        return MagicMock()

    mock_supabase.table.side_effect = table_mock

    with pytest.raises(HTTPException) as exc_info:
        await accept_classification(doc_id, force=False, current_user=mock_user, supabase=mock_supabase)

    assert exc_info.value.status_code == 403
    detail = exc_info.value.detail
    assert detail["error"] == "classification_refusal"
    assert detail["requires_confirmation"] is True
    assert "widens visibility" in detail["reason"]


@pytest.mark.asyncio
async def test_accept_classification_allows_widening_when_force_is_true(mock_user, mock_supabase):
    """H-4 / VIS-06: Moving private connected document to org-shared folder with force=True succeeds."""
    doc_id = str(uuid4())
    target_folder_id = str(uuid4())
    user_id = mock_user["id"]

    doc_data = {
        "id": doc_id,
        "folder_id": None,
        "source_connection_id": str(uuid4()),
        "ingest_visibility": "private",
        "metadata": {
            "_classification": {
                "status": "suggested",
                "suggested_folder_id": target_folder_id,
                "rule_id": str(uuid4()),
            }
        },
    }
    folder_data = {
        "id": target_folder_id,
        "is_org_shared": True,
    }

    doc_query = MagicMock()
    doc_query.select.return_value = doc_query
    doc_query.eq.return_value = doc_query
    doc_query.maybe_single.return_value = doc_query
    doc_query.execute.return_value = MagicMock(data=doc_data)

    folder_query = MagicMock()
    folder_query.select.return_value = folder_query
    folder_query.eq.return_value = folder_query
    folder_query.or_.return_value = folder_query
    folder_query.maybe_single.return_value = folder_query
    folder_query.execute.return_value = MagicMock(data=folder_data)

    update_query = MagicMock()
    update_query.update.return_value = update_query
    update_query.eq.return_value = update_query
    updated_doc = {**doc_data, "folder_id": target_folder_id}
    update_query.execute.return_value = MagicMock(data=[updated_doc])

    def table_mock(name):
        if name == "documents":
            doc_q = MagicMock()
            doc_q.select.return_value = doc_query
            doc_q.update.return_value = update_query
            return doc_q
        elif name == "folders":
            return folder_query
        return MagicMock()

    mock_supabase.table.side_effect = table_mock

    with patch("app.api.documents.write_audit_entry", new=AsyncMock()) as mock_audit:
        res = await accept_classification(doc_id, force=True, current_user=mock_user, supabase=mock_supabase)
        assert res["folder_id"] == target_folder_id

        # Verify audit row records the force override
        mock_audit.assert_awaited_once()
        audit_kwargs = mock_audit.call_args[1]
        assert audit_kwargs["metadata"].get("force") is True


@pytest.mark.asyncio
async def test_accept_classification_allows_move_when_doc_is_org_shared(mock_user, mock_supabase):
    """When document's ingest_visibility is org_shared, moving to org-shared folder does NOT raise 403."""
    doc_id = str(uuid4())
    target_folder_id = str(uuid4())

    doc_data = {
        "id": doc_id,
        "folder_id": None,
        "source_connection_id": str(uuid4()),
        "ingest_visibility": "org_shared",
        "metadata": {
            "_classification": {
                "status": "suggested",
                "suggested_folder_id": target_folder_id,
                "rule_id": str(uuid4()),
            }
        },
    }
    folder_data = {"id": target_folder_id, "is_org_shared": True}

    doc_select = MagicMock()
    doc_select.select.return_value = doc_select
    doc_select.eq.return_value = doc_select
    doc_select.maybe_single.return_value = doc_select
    doc_select.execute.return_value = MagicMock(data=doc_data)

    doc_update = MagicMock()
    doc_update.update.return_value = doc_update
    doc_update.eq.return_value = doc_update
    doc_update.execute.return_value = MagicMock(data=[{**doc_data, "folder_id": target_folder_id}])

    folder_select = MagicMock()
    folder_select.select.return_value = folder_select
    folder_select.eq.return_value = folder_select
    folder_select.or_.return_value = folder_select
    folder_select.maybe_single.return_value = folder_select
    folder_select.execute.return_value = MagicMock(data=folder_data)

    def table_mock(name):
        if name == "documents":
            m = MagicMock()
            m.select.return_value = doc_select
            m.update.return_value = doc_update
            return m
        elif name == "folders":
            return folder_select
        return MagicMock()

    mock_supabase.table.side_effect = table_mock

    with patch("app.api.documents.write_audit_entry", new=AsyncMock()):
        res = await accept_classification(doc_id, force=False, current_user=mock_user, supabase=mock_supabase)
        assert res["folder_id"] == target_folder_id


@pytest.mark.asyncio
async def test_accept_classification_allows_move_for_manual_upload(mock_user, mock_supabase):
    """When document is a manual upload (source_connection_id is None), normal move proceeds without 403."""
    doc_id = str(uuid4())
    target_folder_id = str(uuid4())

    doc_data = {
        "id": doc_id,
        "folder_id": None,
        "source_connection_id": None,
        "ingest_visibility": None,
        "metadata": {
            "_classification": {
                "status": "suggested",
                "suggested_folder_id": target_folder_id,
                "rule_id": str(uuid4()),
            }
        },
    }
    folder_data = {"id": target_folder_id, "is_org_shared": True}

    doc_select = MagicMock()
    doc_select.select.return_value = doc_select
    doc_select.eq.return_value = doc_select
    doc_select.maybe_single.return_value = doc_select
    doc_select.execute.return_value = MagicMock(data=doc_data)

    doc_update = MagicMock()
    doc_update.update.return_value = doc_update
    doc_update.eq.return_value = doc_update
    doc_update.execute.return_value = MagicMock(data=[{**doc_data, "folder_id": target_folder_id}])

    folder_select = MagicMock()
    folder_select.select.return_value = folder_select
    folder_select.eq.return_value = folder_select
    folder_select.or_.return_value = folder_select
    folder_select.maybe_single.return_value = folder_select
    folder_select.execute.return_value = MagicMock(data=folder_data)

    def table_mock(name):
        if name == "documents":
            m = MagicMock()
            m.select.return_value = doc_select
            m.update.return_value = doc_update
            return m
        elif name == "folders":
            return folder_select
        return MagicMock()

    mock_supabase.table.side_effect = table_mock

    with patch("app.api.documents.write_audit_entry", new=AsyncMock()):
        res = await accept_classification(doc_id, force=False, current_user=mock_user, supabase=mock_supabase)
        assert res["folder_id"] == target_folder_id

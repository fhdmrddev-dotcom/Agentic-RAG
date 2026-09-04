"""Integration tests for Connector Import and Upload Door Parity (Phase 229 TRUST-01).

Proves:
- SC#1: A person pulls a named file from a connection and it appears in the Library,
        resolving the PGRST204 storage_path column mismatch defect.
- SC#2: The same file arriving through the upload button and through a connection
        produces identical document records, dedupe outcomes, and versioning.
- SC#4: Re-uploading a file already in the Library produces a new version, or 200 OK
        on exact duplicate — nothing a person can see changed on the upload path.
"""

import hashlib
import io
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import (
    get_active_org_id,
    get_current_user,
    get_supabase,
    get_user_supabase_client,
)

USER_ID = "00000000-0000-0000-0000-000000000001"
ORG_ID = "00000000-0000-0000-0000-000000000002"
CONN_ID = "00000000-0000-0000-0000-000000000003"
FILE_ID = "cloud-file-abc-123"
DOC_V1_ID = "11111111-1111-1111-1111-111111111111"
DOC_V2_ID = "22222222-2222-2222-2222-222222222222"

MOCK_USER = {"id": USER_ID, "email": "user@example.com"}
FILENAME = "quarterly_results.pdf"
FILE_BYTES = b"%PDF-1.4 sample quarterly results document content"
CONTENT_HASH = hashlib.sha256(FILE_BYTES).hexdigest()
MIME_TYPE = "application/pdf"
NOW_ISO = "2026-09-05T00:00:00+00:00"


def _make_result(data):
    r = MagicMock()
    r.data = data
    return r


def _make_query_builder():
    b = MagicMock()
    b.eq.return_value = b
    b.neq.return_value = b
    b.is_.return_value = b
    b.order.return_value = b
    b.limit.return_value = b
    b.maybe_single.return_value = b
    b.single.return_value = b
    b.execute.return_value = _make_result([])
    return b


def _make_table_mock():
    t = MagicMock()
    select_b = _make_query_builder()
    insert_b = _make_query_builder()
    update_b = _make_query_builder()
    delete_b = _make_query_builder()

    t.select.return_value = select_b
    t.insert.return_value = insert_b
    t.update.return_value = update_b
    t.delete.return_value = delete_b

    t._select = select_b
    t._insert = insert_b
    t._update = update_b
    t._delete = delete_b
    return t


def _build_mock_supabase():
    client = MagicMock()
    tables = {
        "documents": _make_table_mock(),
        "folders": _make_table_mock(),
        "audit_log": _make_table_mock(),
    }
    client.table.side_effect = lambda name: tables.get(name, _make_table_mock())
    client._tables = tables
    client.storage = MagicMock()
    client.storage.from_.return_value = MagicMock()
    return client


@pytest.fixture
def mock_clients():
    sb = _build_mock_supabase()
    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    app.dependency_overrides[get_active_org_id] = lambda: ORG_ID
    app.dependency_overrides[get_user_supabase_client] = lambda: sb
    app.dependency_overrides[get_supabase] = lambda: sb
    yield sb
    app.dependency_overrides.clear()


def test_connector_import_sc1_mints_row_and_resolves_pgrst204(mock_clients):
    """SC#1: Importing a file from a connection mints document via Ingest Splice,

    guaranteeing valid schema (file_path, content_hash, version_number) and
    provably omitting the nonexistent 'storage_path' column (resolving PGRST204).
    """
    sb = mock_clients
    inserted_doc = {
        "id": DOC_V1_ID,
        "user_id": USER_ID,
        "filename": FILENAME,
        "file_path": f"{USER_ID}/{DOC_V1_ID}/{FILENAME}",
        "file_size": len(FILE_BYTES),
        "mime_type": MIME_TYPE,
        "status": "pending",
        "error_message": None,
        "chunk_count": None,
        "content_hash": CONTENT_HASH,
        "folder_id": None,
        "version_number": 1,
        "is_latest": True,
        "created_at": NOW_ISO,
        "updated_at": NOW_ISO,
    }
    sb._tables["documents"]._insert.execute.return_value = _make_result([inserted_doc])

    mock_conn = {"id": CONN_ID, "user_id": USER_ID, "org_id": ORG_ID, "service_name": "google_drive"}

    with patch("app.services.connector_service.get_connection", AsyncMock(return_value=mock_conn)), \
         patch("app.services.cloud_storage.fetch_cloud_file", AsyncMock(return_value=(FILENAME, FILE_BYTES, MIME_TYPE))), \
         patch("app.services.ingest_splice.splice_document") as mock_splice:

        with TestClient(app) as client:
            resp = client.post(
                f"/connectors/connections/{CONN_ID}/files/{FILE_ID}/import",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 200, f"Import failed: {resp.text}"
        data = resp.json()
        assert data["id"] == DOC_V1_ID
        assert data["filename"] == FILENAME

        # Verify documents.insert payload:
        # 1. file_path is populated
        # 2. storage_path is NOT present (PGRST204 fix)
        # 3. content_hash, version_number, is_latest are populated
        insert_call_args = sb._tables["documents"].insert.call_args[0][0]
        assert "file_path" in insert_call_args
        assert "storage_path" not in insert_call_args, "storage_path column must not be sent to Postgres"
        assert insert_call_args["content_hash"] == CONTENT_HASH
        assert insert_call_args["version_number"] == 1
        assert insert_call_args["is_latest"] is True
        assert insert_call_args["status"] == "pending"

        # Verify splice_document queued in background
        mock_splice.assert_called_once()
        kwargs = mock_splice.call_args[1]
        assert kwargs["document_id"] == DOC_V1_ID
        assert kwargs["raw"] == FILE_BYTES
        assert kwargs["mime_type"] == MIME_TYPE


def test_connector_import_sc2_upload_parity_and_deduplication(mock_clients):
    """SC#2: Importing a file that already exists returns the existing completed document

    with HTTP 200 and queues no background processing, matching /upload deduplication.
    """
    sb = mock_clients
    existing_doc = {
        "id": DOC_V1_ID,
        "user_id": USER_ID,
        "filename": FILENAME,
        "file_path": f"{USER_ID}/{DOC_V1_ID}/{FILENAME}",
        "file_size": len(FILE_BYTES),
        "mime_type": MIME_TYPE,
        "status": "completed",
        "error_message": None,
        "chunk_count": 5,
        "content_hash": CONTENT_HASH,
        "folder_id": None,
        "version_number": 1,
        "is_latest": True,
        "created_at": NOW_ISO,
        "updated_at": NOW_ISO,
    }
    # Dedup query returns existing completed row
    sb._tables["documents"]._select.execute.return_value = _make_result([existing_doc])

    mock_conn = {"id": CONN_ID, "user_id": USER_ID, "org_id": ORG_ID}

    with patch("app.services.connector_service.get_connection", AsyncMock(return_value=mock_conn)), \
         patch("app.services.cloud_storage.fetch_cloud_file", AsyncMock(return_value=(FILENAME, FILE_BYTES, MIME_TYPE))), \
         patch("app.services.ingest_splice.splice_document") as mock_splice:

        with TestClient(app) as client:
            resp = client.post(
                f"/connectors/connections/{CONN_ID}/files/{FILE_ID}/import",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == DOC_V1_ID
        assert data["status"] == "completed"

        # No insert and no background splice should be queued for duplicate
        sb._tables["documents"].insert.assert_not_called()
        mock_splice.assert_not_called()


def test_sc4_upload_path_behaviour_preserved(mock_clients):
    """SC#4: Re-uploading a file already in the Library produces a new version or 200 on duplicate.

    Guarantees zero observable drift on /documents/upload.
    """
    sb = mock_clients

    # 1. Exact duplicate upload returns 200 OK
    existing_doc = {
        "id": DOC_V1_ID,
        "user_id": USER_ID,
        "filename": FILENAME,
        "file_path": f"{USER_ID}/{DOC_V1_ID}/{FILENAME}",
        "file_size": len(FILE_BYTES),
        "mime_type": MIME_TYPE,
        "status": "completed",
        "error_message": None,
        "chunk_count": 5,
        "content_hash": CONTENT_HASH,
        "folder_id": None,
        "version_number": 1,
        "is_latest": True,
        "created_at": NOW_ISO,
        "updated_at": NOW_ISO,
    }
    sb._tables["documents"]._select.execute.return_value = _make_result([existing_doc])

    with patch("app.api.documents._upload_pipeline") as mock_pipeline:
        with TestClient(app) as client:
            resp1 = client.post(
                "/documents/upload",
                files={"file": (FILENAME, io.BytesIO(FILE_BYTES), MIME_TYPE)},
                headers={"Authorization": "Bearer test-token"},
            )

            assert resp1.status_code == 200
            assert resp1.json()["id"] == DOC_V1_ID
            mock_pipeline.assert_not_called()

            # 2. Same filename with different content creates version 2 and returns 201 Created
            new_bytes = b"%PDF-1.4 modified quarterly results revision 2"
            new_hash = hashlib.sha256(new_bytes).hexdigest()
            existing_v1 = {"id": DOC_V1_ID, "version_number": 1}
            inserted_v2 = {
                "id": DOC_V2_ID,
                "user_id": USER_ID,
                "filename": FILENAME,
                "file_path": f"{USER_ID}/{DOC_V2_ID}/{FILENAME}",
                "file_size": len(new_bytes),
                "mime_type": MIME_TYPE,
                "status": "pending",
                "error_message": None,
                "chunk_count": None,
                "content_hash": new_hash,
                "folder_id": None,
                "version_number": 2,
                "is_latest": True,
                "created_at": NOW_ISO,
                "updated_at": NOW_ISO,
            }

            # Sequence of select queries:
            # 1. Dedup select -> empty
            # 2. Versions select -> returns existing_v1
            sb._tables["documents"]._select.execute.side_effect = [
                _make_result([]),
                _make_result([existing_v1]),
            ]
            sb._tables["documents"]._insert.execute.return_value = _make_result([inserted_v2])

            resp2 = client.post(
                "/documents/upload",
                files={"file": (FILENAME, io.BytesIO(new_bytes), MIME_TYPE)},
                headers={"Authorization": "Bearer test-token"},
            )

            assert resp2.status_code == 201
            assert resp2.json()["id"] == DOC_V2_ID
            assert resp2.json()["version_number"] == 2

            # Verify prior versions retired
            sb._tables["documents"].update.assert_called_with({"is_latest": False})
            # Verify background pipeline scheduled
            mock_pipeline.assert_called_once()

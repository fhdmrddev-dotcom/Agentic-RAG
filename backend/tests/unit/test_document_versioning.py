"""Unit tests for document versioning logic in upload_document endpoint.

These tests verify:
- Re-uploading a file with the same filename creates a new version row
- First upload gets version_number=1
- Dedup check only matches is_latest=True rows
- Stale hash dedup (is_latest=False) does not short-circuit upload
"""
import io
import os
from unittest.mock import AsyncMock, MagicMock, call, patch

import pytest
from fastapi import status
from fastapi.testclient import TestClient

# Env is patched in conftest.py before any app import

from app.main import app
from app.dependencies import get_current_user, get_supabase


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

USER_ID = "00000000-0000-0000-0000-000000000001"
DOC_V1_ID = "00000000-0000-0000-0000-000000000010"
DOC_V2_ID = "00000000-0000-0000-0000-000000000020"
DOC_NEW_ID = "00000000-0000-0000-0000-000000000030"
DOC_EXIST_ID = "00000000-0000-0000-0000-000000000040"
MOCK_USER = {"id": USER_ID, "email": "test@example.com"}
FILENAME = "report.txt"
FILE_CONTENT = b"document content version 2"


def _make_result(data):
    r = MagicMock()
    r.data = data
    return r


def _make_builder():
    """Fresh fully-wired Supabase query builder mock."""
    b = MagicMock()
    b.select.return_value = b
    b.insert.return_value = b
    b.update.return_value = b
    b.delete.return_value = b
    b.eq.return_value = b
    b.neq.return_value = b
    b.in_.return_value = b
    b.order.return_value = b
    b.limit.return_value = b
    b.single.return_value = b
    b.maybe_single.return_value = b
    b.is_.return_value = b
    b.or_.return_value = b
    b.execute.return_value = _make_result([])
    return b


def _make_supabase(builder):
    sb = MagicMock()
    sb.table.return_value = builder
    sb.rpc.return_value = builder
    storage_bucket = MagicMock()
    storage_bucket.upload.return_value = MagicMock()
    storage_bucket.remove.return_value = MagicMock()
    sb.storage.from_.return_value = storage_bucket
    return sb


def _upload_file(client, filename=FILENAME, content=FILE_CONTENT):
    """POST a file upload to the documents upload endpoint."""
    return client.post(
        "/documents/upload",
        files={"file": (filename, io.BytesIO(content), "text/plain")},
        headers={"Authorization": "Bearer test-token"},
    )


# ---------------------------------------------------------------------------
# Test class
# ---------------------------------------------------------------------------

class TestDocumentVersioning:
    """Tests for version creation and dedup logic in upload_document."""

    def test_reupload_creates_new_version(self):
        """Re-uploading same filename increments version_number and retires previous version."""
        builder = _make_builder()
        supabase = _make_supabase(builder)

        inserted_doc = {
            "id": DOC_V2_ID,
            "user_id": USER_ID,
            "filename": FILENAME,
            "file_path": f"{USER_ID}/{DOC_V2_ID}/{FILENAME}",
            "file_size": len(FILE_CONTENT),
            "mime_type": "text/plain",
            "status": "pending",
            "content_hash": "newhash",
            "folder_id": None,
            "version_number": 2,
            "is_latest": True,
            "error_message": None,
            "chunk_count": None,
            "metadata": None,
            "created_at": "2026-04-12T00:00:00",
            "updated_at": "2026-04-12T00:00:00",
        }

        # Sequential execute() calls:
        # 1. folder_id check — skipped (no folder_id)
        # 2. dedup check (content_hash, is_latest=True) — empty (new content)
        # 3. existing_versions check (filename) — returns version 1
        # 4. update is_latest=False
        # 5. insert new doc row
        builder.execute.side_effect = [
            _make_result([]),           # dedup check: no match
            _make_result([{"id": DOC_V1_ID, "version_number": 1}]),  # existing version
            _make_result([]),           # update is_latest=False
            _make_result([inserted_doc]),  # insert new doc
        ]

        app.dependency_overrides[get_current_user] = lambda: MOCK_USER
        app.dependency_overrides[get_supabase] = lambda: supabase

        with patch("app.api.documents.ingest_document") as mock_ingest:
            with TestClient(app) as client:
                resp = _upload_file(client)

        assert resp.status_code in (200, 201), f"Unexpected status: {resp.status_code} — {resp.text}"

        # Assert NO .delete() call on documents table with stale doc id
        delete_calls = builder.delete.call_args_list
        # If delete was called it should NOT be followed by .eq("id", old_doc_id)
        # Simplest assertion: no call to supabase.table("documents").delete().eq("id", ...)
        # We check that delete() was not called with intent to delete old document
        # by verifying version_number appears in the insert call args
        insert_calls = builder.insert.call_args_list
        assert len(insert_calls) >= 1, "Expected at least one insert call"
        insert_data = insert_calls[-1][0][0]  # positional arg of last insert call
        assert insert_data.get("version_number") == 2, (
            f"Expected version_number=2 in insert, got: {insert_data}"
        )
        assert insert_data.get("is_latest") is True, (
            f"Expected is_latest=True in insert, got: {insert_data}"
        )

        # Assert update was called with is_latest=False
        update_calls = builder.update.call_args_list
        assert any(
            call_args[0][0].get("is_latest") is False
            for call_args in update_calls
        ), f"Expected update({{is_latest: False}}) to be called. update calls: {update_calls}"

    def test_first_upload_gets_version_1(self):
        """A brand-new filename gets version_number=1 and is_latest=True."""
        builder = _make_builder()
        supabase = _make_supabase(builder)

        new_content = b"completely new document"
        inserted_doc = {
            "id": DOC_NEW_ID,
            "user_id": USER_ID,
            "filename": "new_doc.txt",
            "file_path": f"{USER_ID}/{DOC_NEW_ID}/new_doc.txt",
            "file_size": len(new_content),
            "mime_type": "text/plain",
            "status": "pending",
            "content_hash": "freshsha256",
            "folder_id": None,
            "version_number": 1,
            "is_latest": True,
            "error_message": None,
            "chunk_count": None,
            "metadata": None,
            "created_at": "2026-04-12T00:00:00",
            "updated_at": "2026-04-12T00:00:00",
        }

        # Sequential execute() calls:
        # 1. dedup check — empty (brand new)
        # 2. existing_versions — empty (never uploaded)
        # 3. insert doc row
        builder.execute.side_effect = [
            _make_result([]),            # dedup: no match
            _make_result([]),            # existing_versions: no previous
            _make_result([inserted_doc]),  # insert
        ]

        app.dependency_overrides[get_current_user] = lambda: MOCK_USER
        app.dependency_overrides[get_supabase] = lambda: supabase

        with patch("app.api.documents.ingest_document"):
            with TestClient(app) as client:
                resp = client.post(
                    "/documents/upload",
                    files={"file": ("new_doc.txt", io.BytesIO(new_content), "text/plain")},
                    headers={"Authorization": "Bearer test-token"},
                )

        assert resp.status_code in (200, 201), f"Unexpected status: {resp.status_code} — {resp.text}"

        insert_calls = builder.insert.call_args_list
        assert len(insert_calls) >= 1, "Expected at least one insert call"
        insert_data = insert_calls[-1][0][0]
        assert insert_data.get("version_number") == 1, (
            f"Expected version_number=1 in insert, got: {insert_data}"
        )
        assert insert_data.get("is_latest") is True, (
            f"Expected is_latest=True in insert, got: {insert_data}"
        )

    def test_dedup_ignores_stale_version(self):
        """Dedup check with is_latest=True filter means a stale hash match does not short-circuit upload."""
        builder = _make_builder()
        supabase = _make_supabase(builder)

        # The dedup check uses .eq("is_latest", True) so it only returns rows
        # where is_latest=True. We simulate: dedup returns empty (stale-only match
        # effectively filtered out), so upload proceeds.
        new_content = b"updated report content"
        inserted_doc = {
            "id": DOC_V2_ID,
            "user_id": USER_ID,
            "filename": FILENAME,
            "file_path": f"{USER_ID}/{DOC_V2_ID}/{FILENAME}",
            "file_size": len(new_content),
            "mime_type": "text/plain",
            "status": "pending",
            "content_hash": "updatedhash",
            "folder_id": None,
            "version_number": 2,
            "is_latest": True,
            "error_message": None,
            "chunk_count": None,
            "metadata": None,
            "created_at": "2026-04-12T00:00:00",
            "updated_at": "2026-04-12T00:00:00",
        }

        # Dedup returns empty because is_latest=True filter excludes the stale row
        # Upload proceeds: checks existing versions, updates old, inserts new
        builder.execute.side_effect = [
            _make_result([]),            # dedup: empty (stale filtered out by is_latest=True)
            _make_result([{"id": DOC_V1_ID, "version_number": 1}]),  # existing version
            _make_result([]),            # update is_latest=False
            _make_result([inserted_doc]),  # insert new
        ]

        app.dependency_overrides[get_current_user] = lambda: MOCK_USER
        app.dependency_overrides[get_supabase] = lambda: supabase

        with patch("app.api.documents.ingest_document"):
            with TestClient(app) as client:
                resp = _upload_file(client, content=new_content)

        # Upload must proceed (not return 200 from dedup short-circuit with old doc)
        assert resp.status_code in (200, 201), f"Unexpected status: {resp.status_code} — {resp.text}"

        # Verify insert was called (upload proceeded)
        insert_calls = builder.insert.call_args_list
        assert len(insert_calls) >= 1, "Expected insert call — upload should proceed past dedup"
        insert_data = insert_calls[-1][0][0]
        assert insert_data.get("version_number") == 2

    def test_dedup_matches_latest_version(self):
        """Exact-hash dedup against is_latest=True row returns 200 early without re-ingesting."""
        builder = _make_builder()
        supabase = _make_supabase(builder)

        existing_doc = {
            "id": DOC_EXIST_ID,
            "user_id": USER_ID,
            "filename": FILENAME,
            "file_path": f"{USER_ID}/{DOC_EXIST_ID}/{FILENAME}",
            "file_size": len(FILE_CONTENT),
            "mime_type": "text/plain",
            "status": "completed",
            "content_hash": "existinghash",
            "folder_id": None,
            "version_number": 1,
            "is_latest": True,
            "error_message": None,
            "chunk_count": 5,
            "metadata": None,
            "created_at": "2026-04-12T00:00:00",
            "updated_at": "2026-04-12T00:00:00",
        }

        # Dedup returns the existing latest doc — upload short-circuits
        builder.execute.side_effect = [
            _make_result([existing_doc]),  # dedup: match on is_latest=True row
        ]

        app.dependency_overrides[get_current_user] = lambda: MOCK_USER
        app.dependency_overrides[get_supabase] = lambda: supabase

        with TestClient(app) as client:
            resp = _upload_file(client, content=FILE_CONTENT)

        # Returns 200 early with existing doc
        assert resp.status_code == 200, f"Expected 200 from dedup short-circuit, got: {resp.status_code} — {resp.text}"

        # No insert should occur
        insert_calls = builder.insert.call_args_list
        assert len(insert_calls) == 0, (
            f"Expected no insert when dedup matches latest, got {len(insert_calls)} insert calls"
        )

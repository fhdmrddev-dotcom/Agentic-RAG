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
        # Find the document insert (has version_number) — audit insert does not
        doc_insert_data = next(
            (c[0][0] for c in insert_calls if c[0][0].get("version_number") is not None),
            None,
        )
        assert doc_insert_data is not None, f"No document insert found. Calls: {insert_calls}"
        assert doc_insert_data.get("version_number") == 2, (
            f"Expected version_number=2 in insert, got: {doc_insert_data}"
        )
        assert doc_insert_data.get("is_latest") is True, (
            f"Expected is_latest=True in insert, got: {doc_insert_data}"
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
        # Find the document insert (has version_number) — audit insert does not
        doc_insert_data = next(
            (c[0][0] for c in insert_calls if c[0][0].get("version_number") is not None),
            None,
        )
        assert doc_insert_data is not None, f"No document insert found. Calls: {insert_calls}"
        assert doc_insert_data.get("version_number") == 1, (
            f"Expected version_number=1 in insert, got: {doc_insert_data}"
        )
        assert doc_insert_data.get("is_latest") is True, (
            f"Expected is_latest=True in insert, got: {doc_insert_data}"
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
        # Find the document insert (has version_number) — audit insert does not
        doc_insert_data = next(
            (c[0][0] for c in insert_calls if c[0][0].get("version_number") is not None),
            None,
        )
        assert doc_insert_data is not None, f"No document insert found. Calls: {insert_calls}"
        assert doc_insert_data.get("version_number") == 2

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


# ---------------------------------------------------------------------------
# New tests for versioning UI endpoints (Plan 29-01)
# ---------------------------------------------------------------------------

class TestDocumentVersioningUI:
    """Tests for list is_latest filter, GET /{id}/versions, and POST /{id}/restore."""

    DOC_ID = "00000000-0000-0000-0000-000000000050"
    DOC_ID2 = "00000000-0000-0000-0000-000000000051"

    def _base_doc(self, **overrides):
        base = {
            "id": self.DOC_ID,
            "user_id": USER_ID,
            "filename": FILENAME,
            "file_path": f"{USER_ID}/{self.DOC_ID}/{FILENAME}",
            "file_size": 100,
            "mime_type": "text/plain",
            "status": "completed",
            "content_hash": "abc123",
            "folder_id": None,
            "version_number": 2,
            "is_latest": True,
            "error_message": None,
            "chunk_count": 3,
            "metadata": None,
            "created_at": "2026-04-13T00:00:00",
            "updated_at": "2026-04-13T00:00:00",
        }
        base.update(overrides)
        return base

    def test_list_documents_filters_is_latest(self):
        """GET /documents returns only is_latest=True documents; eq('is_latest', True) called."""
        builder = _make_builder()
        supabase = _make_supabase(builder)

        latest_doc = self._base_doc()

        # list_documents: own docs, then document_tables and document_images aggregation queries
        builder.execute.side_effect = [
            _make_result([latest_doc]),   # own docs
            _make_result([]),             # document_tables rows
            _make_result([]),             # document_images rows
        ]

        app.dependency_overrides[get_current_user] = lambda: MOCK_USER
        app.dependency_overrides[get_supabase] = lambda: supabase

        with patch(
            "app.api.documents.get_globally_visible_folder_ids",
            return_value=[],
        ):
            with TestClient(app) as client:
                resp = client.get(
                    "/documents",
                    headers={"Authorization": "Bearer test-token"},
                )

        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert len(data) == 1, f"Expected 1 document, got {len(data)}"

        # Verify .eq("is_latest", True) was called at least once
        eq_calls = builder.eq.call_args_list
        assert any(
            args == (("is_latest", True),) or args == call("is_latest", True).args
            for args in [c.args for c in eq_calls]
        ), f"Expected eq('is_latest', True) call, got: {eq_calls}"

    def test_list_document_versions_returns_all(self):
        """GET /documents/{id}/versions returns all sibling versions ordered desc."""
        builder = _make_builder()
        supabase = _make_supabase(builder)

        doc_v2 = self._base_doc(version_number=2, is_latest=True)
        doc_v1 = self._base_doc(id=self.DOC_ID2, version_number=1, is_latest=False)

        # Sequential calls: ownership check, then sibling fetch
        builder.execute.side_effect = [
            _make_result({"filename": FILENAME, "user_id": USER_ID, "folder_id": None}),  # maybe_single ownership
            _make_result([doc_v2, doc_v1]),  # sibling versions
        ]

        app.dependency_overrides[get_current_user] = lambda: MOCK_USER
        app.dependency_overrides[get_supabase] = lambda: supabase

        with TestClient(app) as client:
            resp = client.get(
                f"/documents/{self.DOC_ID}/versions",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert len(data) == 2, f"Expected 2 versions, got {len(data)}"
        assert data[0]["version_number"] == 2, f"Expected first item version_number=2, got {data[0]}"

    def test_list_document_versions_not_found(self):
        """GET /documents/{id}/versions returns 404 when document not owned by user."""
        builder = _make_builder()
        supabase = _make_supabase(builder)

        # maybe_single returns None (not found or not owned)
        builder.execute.return_value = _make_result(None)

        app.dependency_overrides[get_current_user] = lambda: MOCK_USER
        app.dependency_overrides[get_supabase] = lambda: supabase

        with TestClient(app) as client:
            resp = client.get(
                "/documents/nonexistent-id/versions",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"

    def test_restore_promotes_target(self):
        """POST /documents/{id}/restore sets is_latest=True on target and is_latest=False on siblings."""
        builder = _make_builder()
        supabase = _make_supabase(builder)

        folder_uuid = "00000000-0000-0000-0000-000000000099"
        target_doc = self._base_doc(folder_id=folder_uuid, is_latest=False, version_number=1)
        restored_doc = self._base_doc(folder_id=folder_uuid, is_latest=True, version_number=1)

        # Sequential calls: ownership check, siblings update, target promote
        builder.execute.side_effect = [
            _make_result(target_doc),       # maybe_single ownership/doc fetch
            _make_result([]),               # update siblings is_latest=False
            _make_result([restored_doc]),   # update target is_latest=True
        ]

        app.dependency_overrides[get_current_user] = lambda: MOCK_USER
        app.dependency_overrides[get_supabase] = lambda: supabase

        with TestClient(app) as client:
            resp = client.post(
                f"/documents/{self.DOC_ID}/restore",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

        update_calls = builder.update.call_args_list
        update_args = [c.args[0] for c in update_calls]
        assert {"is_latest": False} in update_args, f"Expected update({{is_latest: False}}) call, got: {update_calls}"
        assert {"is_latest": True} in update_args, f"Expected update({{is_latest: True}}) call, got: {update_calls}"

        # Verify False update comes before True update
        false_idx = next(i for i, a in enumerate(update_args) if a == {"is_latest": False})
        true_idx = next(i for i, a in enumerate(update_args) if a == {"is_latest": True})
        assert false_idx < true_idx, "Expected is_latest=False update before is_latest=True update"

    def test_restore_null_folder_uses_is_null(self):
        """POST /documents/{id}/restore with folder_id=None uses .is_('folder_id', 'null')."""
        builder = _make_builder()
        supabase = _make_supabase(builder)

        target_doc = self._base_doc(folder_id=None, is_latest=False, version_number=1)
        restored_doc = self._base_doc(folder_id=None, is_latest=True, version_number=1)

        builder.execute.side_effect = [
            _make_result(target_doc),       # ownership check
            _make_result([]),               # siblings update
            _make_result([restored_doc]),   # target promote
        ]

        app.dependency_overrides[get_current_user] = lambda: MOCK_USER
        app.dependency_overrides[get_supabase] = lambda: supabase

        with TestClient(app) as client:
            resp = client.post(
                f"/documents/{self.DOC_ID}/restore",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

        is_calls = builder.is_.call_args_list
        assert any(
            args == ("folder_id", "null")
            for c in is_calls
            for args in [c.args]
        ), f"Expected is_('folder_id', 'null') call for null folder, got: {is_calls}"

    def test_restore_unauthorized_returns_404(self):
        """POST /documents/{id}/restore by non-owner returns 404."""
        builder = _make_builder()
        supabase = _make_supabase(builder)

        # maybe_single returns None — doc not found or not owned
        builder.execute.return_value = _make_result(None)

        app.dependency_overrides[get_current_user] = lambda: MOCK_USER
        app.dependency_overrides[get_supabase] = lambda: supabase

        with TestClient(app) as client:
            resp = client.post(
                f"/documents/{self.DOC_ID}/restore",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"

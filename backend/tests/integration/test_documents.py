"""Integration tests for /documents endpoints."""
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest


USER_ID = "00000000-0000-0000-0000-000000000001"
DOC_ID = str(uuid4())
NOW = datetime.now(timezone.utc).isoformat()
FOLDER_ID = "00000000-0000-0000-0000-000000000099"


def _doc_row(doc_id=None, status="pending", folder_id=None):
    return {
        "id": doc_id or DOC_ID,
        "user_id": USER_ID,
        "folder_id": folder_id,
        "filename": "test.txt",
        "file_path": f"{USER_ID}/{doc_id or DOC_ID}/test.txt",
        "file_size": 13,
        "mime_type": "text/plain",
        "status": status,
        "error_message": None,
        "chunk_count": None,
        "content_hash": "abc123hash",
        "created_at": NOW,
        "updated_at": NOW,
    }


def _make_result(data):
    r = MagicMock()
    r.data = data
    return r


def _raise_401():
    from fastapi import HTTPException, status as http_status
    raise HTTPException(status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")


# ── GET /documents ─────────────────────────────────────────────────────────────

class TestListDocuments:
    def test_requires_auth(self, client):
        from tests.conftest import app, mock_user_data
        from app.dependencies import get_current_user

        app.dependency_overrides[get_current_user] = _raise_401
        try:
            resp = client.get("/documents")
            assert resp.status_code == 401
        finally:
            app.dependency_overrides[get_current_user] = lambda: mock_user_data

    def test_returns_200_with_auth(self, client, auth_headers, mock_builder):
        # own docs, global folder ids, document_tables rows, document_images rows
        mock_builder.execute.side_effect = [
            _make_result([_doc_row()]),
            _make_result([]),
            _make_result([]),
            _make_result([]),
        ]
        response = client.get("/documents", headers=auth_headers)
        assert response.status_code == 200

    def test_returns_list(self, client, auth_headers, mock_builder):
        # own docs, global folder ids, document_tables rows, document_images rows
        mock_builder.execute.side_effect = [
            _make_result([_doc_row()]),
            _make_result([]),
            _make_result([]),
            _make_result([]),
        ]
        response = client.get("/documents", headers=auth_headers)
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1

    def test_returns_empty_list_when_no_documents(self, client, auth_headers, mock_execute_result):
        mock_execute_result.data = []
        response = client.get("/documents", headers=auth_headers)
        assert response.json() == []

    def test_list_documents_includes_modal_counts(self, client, auth_headers, mock_builder):
        """MODAL-03/D-09: GET /documents includes table_count and image_count fields."""
        from tests.conftest import mock_user_data

        doc_id = str(uuid4())
        doc = {**_doc_row(doc_id=doc_id), "version_number": 1, "is_latest": True, "content_hash": "h1"}

        # Side effects for list_documents query chain:
        # 1st execute: own documents query
        # 2nd execute: get_globally_visible_folder_ids (returns [])
        # 3rd execute: document_tables .in_ query → 2 rows for this doc
        # 4th execute: document_images .in_ query → 3 rows for this doc
        mock_builder.execute.side_effect = [
            _make_result([doc]),          # own docs
            _make_result([]),             # global folder ids
            _make_result([              # document_tables rows
                {"document_id": doc_id},
                {"document_id": doc_id},
            ]),
            _make_result([              # document_images rows
                {"document_id": doc_id},
                {"document_id": doc_id},
                {"document_id": doc_id},
            ]),
        ]
        response = client.get("/documents", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["table_count"] == 2
        assert data[0]["image_count"] == 3


# ── POST /documents/upload ─────────────────────────────────────────────────────

class TestUploadDocument:
    def test_requires_auth(self, client):
        from tests.conftest import app, mock_user_data
        from app.dependencies import get_current_user

        app.dependency_overrides[get_current_user] = _raise_401
        try:
            resp = client.post(
                "/documents/upload",
                files={"file": ("test.txt", b"hello world", "text/plain")},
            )
            assert resp.status_code == 401
        finally:
            app.dependency_overrides[get_current_user] = lambda: mock_user_data

    def test_valid_txt_upload_returns_201(self, client, auth_headers, mock_builder):
        # execute calls: 1=dedup check (no match), 2=stale check (no match), 3=insert
        mock_builder.execute.side_effect = [
            _make_result([]),         # dedup: no existing
            _make_result([]),         # stale: no stale
            _make_result([_doc_row()]),  # insert result
        ]

        with patch("app.api.documents.ingest_document"):
            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("test.txt", b"Hello world content", "text/plain")},
            )
        assert response.status_code == 201

    def test_valid_txt_upload_returns_pending_status(self, client, auth_headers, mock_builder):
        # execute calls: 1=dedup check (no match), 2=stale check (no match), 3=insert
        mock_builder.execute.side_effect = [
            _make_result([]),                       # dedup: no existing
            _make_result([]),                       # stale: no stale
            _make_result([_doc_row(status="pending")]),  # insert result
        ]

        with patch("app.api.documents.ingest_document"):
            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("test.txt", b"Hello world content", "text/plain")},
            )
        data = response.json()
        assert data["status"] == "pending"

    def test_valid_txt_upload_returns_document_schema(self, client, auth_headers, mock_builder):
        # execute calls: 1=dedup check (no match), 2=stale check (no match), 3=insert
        mock_builder.execute.side_effect = [
            _make_result([]),         # dedup: no existing
            _make_result([]),         # stale: no stale
            _make_result([_doc_row()]),  # insert result
        ]

        with patch("app.api.documents.ingest_document"):
            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("test.txt", b"Hello world content", "text/plain")},
            )
        data = response.json()
        for key in ("id", "user_id", "filename", "file_path", "file_size", "mime_type", "status"):
            assert key in data

    def test_invalid_mime_type_returns_422(self, client, auth_headers):
        response = client.post(
            "/documents/upload",
            headers=auth_headers,
            files={"file": ("photo.jpg", b"\xff\xd8\xff", "image/jpeg")},
        )
        assert response.status_code == 422

    def test_empty_file_returns_422(self, client, auth_headers):
        response = client.post(
            "/documents/upload",
            headers=auth_headers,
            files={"file": ("empty.txt", b"", "text/plain")},
        )
        assert response.status_code == 422

    def test_markdown_file_accepted(self, client, auth_headers, mock_builder):
        mock_builder.execute.side_effect = [
            _make_result([]),          # dedup: no existing
            _make_result([]),          # stale: no stale
            _make_result([_doc_row()]),  # insert result
        ]

        with patch("app.api.documents.ingest_document"):
            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("readme.md", b"# Title\n\nSome content.", "text/plain")},
            )
        assert response.status_code == 201

    def test_html_file_accepted(self, client, auth_headers, mock_builder):
        mock_builder.execute.side_effect = [
            _make_result([]),          # dedup: no existing
            _make_result([]),          # stale: no stale
            _make_result([_doc_row()]),  # insert result
        ]

        with patch("app.api.documents.ingest_document"):
            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("page.html", b"<html><body>Hello</body></html>", "text/html")},
            )
        assert response.status_code == 201

    def test_background_task_is_scheduled(self, client, auth_headers, mock_builder):
        """Background ingest task is added and called (TestClient runs bg tasks synchronously)."""
        mock_builder.execute.side_effect = [
            _make_result([]),          # dedup: no existing
            _make_result([]),          # stale: no stale
            _make_result([_doc_row()]),  # insert result
        ]

        with patch("app.api.documents.ingest_document") as mock_ingest:
            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("test.txt", b"Some content here", "text/plain")},
            )
        assert response.status_code == 201
        mock_ingest.assert_called_once()

    def test_upload_with_valid_folder_id_returns_201(self, client, auth_headers, mock_builder):
        """Upload targeting a valid folder stores the folder_id association."""
        mock_builder.or_.return_value = mock_builder
        mock_builder.neq.return_value = mock_builder
        mock_builder.limit.return_value = mock_builder
        # execute calls: 1=folder validation, 2=dedup check (no match), 3=stale check (no match), 4=insert
        mock_builder.execute.side_effect = [
            _make_result({"id": FOLDER_ID}),               # folder validation: found
            _make_result([]),                              # dedup: no existing
            _make_result([]),                              # stale: no stale
            _make_result([_doc_row(folder_id=FOLDER_ID)]),  # insert result
        ]

        with patch("app.api.documents.ingest_document"):
            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("test.txt", b"Hello world content", "text/plain")},
                data={"folder_id": FOLDER_ID},
            )
        assert response.status_code == 201
        assert response.json()["folder_id"] == FOLDER_ID

    def test_upload_with_invalid_folder_id_returns_404(self, client, auth_headers, mock_builder):
        """Upload targeting a non-existent or inaccessible folder returns 404."""
        mock_builder.or_.return_value = mock_builder
        mock_builder.neq.return_value = mock_builder
        mock_builder.limit.return_value = mock_builder
        # execute calls: 1=folder validation (not found) → raises 404 immediately
        mock_builder.execute.side_effect = [
            _make_result(None),   # folder validation: not found
        ]

        with patch("app.api.documents.ingest_document"):
            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("test.txt", b"Hello world content", "text/plain")},
                data={"folder_id": FOLDER_ID},
            )
        assert response.status_code == 404
        assert "Folder not found" in response.json()["detail"]


# ── DELETE /documents/{id} ─────────────────────────────────────────────────────

class TestDeleteDocument:
    def test_requires_auth(self, client):
        from tests.conftest import app, mock_user_data
        from app.dependencies import get_current_user

        app.dependency_overrides[get_current_user] = _raise_401
        try:
            resp = client.delete(f"/documents/{DOC_ID}")
            assert resp.status_code == 401
        finally:
            app.dependency_overrides[get_current_user] = lambda: mock_user_data

    def test_returns_204_on_success(self, client, auth_headers, mock_builder):
        mock_builder.execute.side_effect = [
            _make_result(_doc_row()),  # select the document (ownership check)
            _make_result([]),          # delete
        ]
        response = client.delete(f"/documents/{DOC_ID}", headers=auth_headers)
        assert response.status_code == 204

    def test_returns_404_when_document_not_found(self, client, auth_headers, mock_builder):
        # single() returns None when document not found
        mock_builder.execute.side_effect = [_make_result(None)]
        response = client.delete(f"/documents/{DOC_ID}", headers=auth_headers)
        assert response.status_code == 404

    def test_delete_body_is_empty(self, client, auth_headers, mock_builder):
        mock_builder.execute.side_effect = [
            _make_result(_doc_row()),
            _make_result([]),
        ]
        response = client.delete(f"/documents/{DOC_ID}", headers=auth_headers)
        assert response.content == b""


# ── PATCH /documents/{id}/move ─────────────────────────────────────────────────

class TestMoveDocument:
    def test_move_to_valid_folder(self, client, auth_headers, mock_builder):
        """PATCH /documents/{id}/move with valid folder returns 200."""
        mock_builder.or_.return_value = mock_builder
        mock_builder.execute.side_effect = [
            _make_result({"id": DOC_ID}),                     # doc ownership check
            _make_result({"id": FOLDER_ID}),                  # folder validation
            _make_result([_doc_row(folder_id=FOLDER_ID)]),    # update result
        ]
        response = client.patch(
            f"/documents/{DOC_ID}/move",
            headers=auth_headers,
            json={"folder_id": FOLDER_ID},
        )
        assert response.status_code == 200
        assert response.json()["folder_id"] == FOLDER_ID

    def test_move_to_root(self, client, auth_headers, mock_builder):
        """PATCH /documents/{id}/move with folder_id=null moves to root."""
        mock_builder.execute.side_effect = [
            _make_result({"id": DOC_ID}),               # doc ownership check
            _make_result([_doc_row(folder_id=None)]),    # update result (no folder validation needed)
        ]
        response = client.patch(
            f"/documents/{DOC_ID}/move",
            headers=auth_headers,
            json={"folder_id": None},
        )
        assert response.status_code == 200
        assert response.json()["folder_id"] is None

    def test_move_document_not_found(self, client, auth_headers, mock_builder):
        """PATCH /documents/{id}/move with non-owned doc returns 404."""
        mock_builder.execute.side_effect = [
            _make_result(None),  # doc ownership check: not found
        ]
        response = client.patch(
            f"/documents/{DOC_ID}/move",
            headers=auth_headers,
            json={"folder_id": FOLDER_ID},
        )
        assert response.status_code == 404
        assert "Document not found" in response.json()["detail"]

    def test_move_to_invalid_folder(self, client, auth_headers, mock_builder):
        """PATCH /documents/{id}/move with invalid folder returns 404."""
        mock_builder.or_.return_value = mock_builder
        mock_builder.execute.side_effect = [
            _make_result({"id": DOC_ID}),   # doc ownership check: found
            _make_result(None),              # folder validation: not found
        ]
        response = client.patch(
            f"/documents/{DOC_ID}/move",
            headers=auth_headers,
            json={"folder_id": FOLDER_ID},
        )
        assert response.status_code == 404
        assert "Folder not found" in response.json()["detail"]


# ── ingest_document full_markdown storage ──────────────────────────────────────

class TestFullMarkdown:
    def test_ingest_stores_full_markdown(self, mock_builder):
        """ingest_document stores full_markdown in the completion update."""
        from app.api.documents import ingest_document
        from tests.conftest import _supabase

        mock_builder.execute.side_effect = [
            _make_result([]),  # status -> processing
            _make_result([]),  # insert chunks
            _make_result([]),  # status -> completed (with full_markdown)
        ]

        with patch("app.api.documents.chunk_text", return_value=["chunk1"]), \
             patch("app.api.documents.embed_chunks", return_value=[[0.1, 0.2]]), \
             patch("app.api.documents.extract_metadata", return_value=None), \
             patch("app.api.documents.load_app_settings") as mock_settings:
            mock_settings.return_value.embedding_model = None
            ingest_document(DOC_ID, "Full document text here", USER_ID, _supabase)

        # Find the completion update call (the one with "completed" status)
        update_calls = mock_builder.update.call_args_list
        completion_call = [c for c in update_calls if "completed" in str(c)]
        assert len(completion_call) == 1
        update_dict = completion_call[0][0][0]  # first positional arg
        assert update_dict["full_markdown"] == "Full document text here"
        assert update_dict["status"] == "completed"

"""Integration tests for /documents endpoints."""
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest


USER_ID = "00000000-0000-0000-0000-000000000001"
DOC_ID = str(uuid4())
NOW = datetime.now(timezone.utc).isoformat()


def _doc_row(doc_id=None, status="pending"):
    return {
        "id": doc_id or DOC_ID,
        "user_id": USER_ID,
        "filename": "test.txt",
        "file_path": f"{USER_ID}/{doc_id or DOC_ID}/test.txt",
        "file_size": 13,
        "mime_type": "text/plain",
        "status": status,
        "error_message": None,
        "chunk_count": None,
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

    def test_returns_200_with_auth(self, client, auth_headers, mock_execute_result):
        mock_execute_result.data = [_doc_row()]
        response = client.get("/documents", headers=auth_headers)
        assert response.status_code == 200

    def test_returns_list(self, client, auth_headers, mock_execute_result):
        mock_execute_result.data = [_doc_row()]
        response = client.get("/documents", headers=auth_headers)
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1

    def test_returns_empty_list_when_no_documents(self, client, auth_headers, mock_execute_result):
        mock_execute_result.data = []
        response = client.get("/documents", headers=auth_headers)
        assert response.json() == []


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

    def test_valid_txt_upload_returns_201(self, client, auth_headers, mock_execute_result):
        mock_execute_result.data = [_doc_row()]

        with patch("app.api.documents.ingest_document"):
            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("test.txt", b"Hello world content", "text/plain")},
            )
        assert response.status_code == 201

    def test_valid_txt_upload_returns_pending_status(self, client, auth_headers, mock_execute_result):
        mock_execute_result.data = [_doc_row(status="pending")]

        with patch("app.api.documents.ingest_document"):
            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("test.txt", b"Hello world content", "text/plain")},
            )
        data = response.json()
        assert data["status"] == "pending"

    def test_valid_txt_upload_returns_document_schema(self, client, auth_headers, mock_execute_result):
        mock_execute_result.data = [_doc_row()]

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

    def test_markdown_file_accepted(self, client, auth_headers, mock_execute_result):
        mock_execute_result.data = [_doc_row()]

        with patch("app.api.documents.ingest_document"):
            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("readme.md", b"# Title\n\nSome content.", "text/plain")},
            )
        assert response.status_code == 201

    def test_html_file_accepted(self, client, auth_headers, mock_execute_result):
        mock_execute_result.data = [_doc_row()]

        with patch("app.api.documents.ingest_document"):
            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("page.html", b"<html><body>Hello</body></html>", "text/html")},
            )
        assert response.status_code == 201

    def test_background_task_is_scheduled(self, client, auth_headers, mock_execute_result):
        """Background ingest task is added and called (TestClient runs bg tasks synchronously)."""
        mock_execute_result.data = [_doc_row()]

        with patch("app.api.documents.ingest_document") as mock_ingest:
            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("test.txt", b"Some content here", "text/plain")},
            )
        assert response.status_code == 201
        mock_ingest.assert_called_once()


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

"""Integration tests for /kb endpoints."""
from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from tests.conftest import _supabase


# ── Helpers ──────────────────────────────────────────────────────────────────

USER_ID = "00000000-0000-0000-0000-000000000001"
OTHER_USER_ID = "00000000-0000-0000-0000-000000000002"
NOW = datetime.now(timezone.utc).isoformat()

FOLDER_ROOT_A = str(uuid4())  # "reports" at root
FOLDER_ROOT_B = str(uuid4())  # "notes" at root
FOLDER_CHILD = str(uuid4())   # "q1" under reports
FOLDER_PRIVATE = str(uuid4()) # other user's private folder

DOC_ROOT = str(uuid4())        # doc at root (folder_id=None)
DOC_IN_REPORTS = str(uuid4())  # doc in reports folder


def _folder_row(folder_id, name, parent_id=None, is_global=False, user_id=USER_ID):
    return {
        "id": folder_id,
        "user_id": user_id,
        "name": name,
        "parent_id": parent_id,
        "is_global": is_global,
        "created_at": NOW,
        "updated_at": NOW,
    }


def _doc_row(doc_id, filename, folder_id=None, status="completed"):
    return {
        "id": doc_id,
        "filename": filename,
        "folder_id": folder_id,
        "status": status,
        "created_at": NOW,
    }


def _make_result(data):
    r = MagicMock()
    r.data = data
    return r


def _standard_folders():
    """Returns a typical folder set: reports (root), notes (root), q1 (child of reports)."""
    return [
        _folder_row(FOLDER_ROOT_A, "reports"),
        _folder_row(FOLDER_ROOT_B, "notes"),
        _folder_row(FOLDER_CHILD, "q1", parent_id=FOLDER_ROOT_A),
    ]


# ── TestLs ───────────────────────────────────────────────────────────────────

class TestLs:
    def test_ls_root(self, client, auth_headers, mock_builder):
        """GET /kb/ls?path=/ returns 200 with root folders and root documents."""
        mock_builder.execute.side_effect = [
            _make_result(_standard_folders()),
            _make_result([_doc_row(DOC_ROOT, "readme.pdf")]),
        ]
        response = client.get("/kb/ls?path=/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["path"] == "/"
        folder_names = {f["name"] for f in data["folders"]}
        assert "reports" in folder_names
        assert "notes" in folder_names
        assert len(data["documents"]) == 1
        assert data["documents"][0]["filename"] == "readme.pdf"

    def test_ls_subfolder(self, client, auth_headers, mock_builder):
        """GET /kb/ls?path=/reports returns 200 with immediate children of reports."""
        mock_builder.execute.side_effect = [
            _make_result(_standard_folders()),
            _make_result([_doc_row(DOC_IN_REPORTS, "report.pdf", FOLDER_ROOT_A)]),
        ]
        response = client.get("/kb/ls?path=/reports", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["folders"]) == 1
        assert data["folders"][0]["name"] == "q1"
        assert len(data["documents"]) == 1
        assert data["documents"][0]["filename"] == "report.pdf"

    def test_ls_not_found(self, client, auth_headers, mock_builder):
        """GET /kb/ls?path=/nonexistent returns 404."""
        mock_builder.execute.side_effect = [
            _make_result(_standard_folders()),
        ]
        response = client.get("/kb/ls?path=/nonexistent", headers=auth_headers)
        assert response.status_code == 404
        assert "Path not found" in response.json()["detail"]

    def test_ls_empty_folder(self, client, auth_headers, mock_builder):
        """GET /kb/ls?path=/notes returns 200 with empty folders and documents lists."""
        mock_builder.execute.side_effect = [
            _make_result(_standard_folders()),  # notes has no children in _standard_folders
            _make_result([]),  # no documents in notes
        ]
        response = client.get("/kb/ls?path=/notes", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["folders"] == []
        assert data["documents"] == []

    def test_ls_rls(self, client, auth_headers, mock_builder):
        """ls does not return other user's private folders.

        Simulates DB-level RLS: the mock returns only accessible folders
        (not other user's private folder), and verifies the endpoint
        respects that boundary.
        """
        # Only return folders accessible to USER_ID — private folder of OTHER_USER is excluded
        accessible_folders = [
            _folder_row(FOLDER_ROOT_A, "reports"),
            _folder_row(FOLDER_ROOT_B, "notes"),
        ]
        mock_builder.execute.side_effect = [
            _make_result(accessible_folders),
            _make_result([]),
        ]
        response = client.get("/kb/ls?path=/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        folder_ids = {f["id"] for f in data["folders"]}
        assert FOLDER_PRIVATE not in folder_ids
        assert len(data["folders"]) == 2

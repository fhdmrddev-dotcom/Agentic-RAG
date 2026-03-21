"""Integration tests for /folders endpoints."""
from datetime import datetime, timezone
from unittest.mock import MagicMock, call
from uuid import uuid4

import pytest

from tests.conftest import _supabase


# ── Helpers ────────────────────────────────────────────────────────────────────

USER_ID = "00000000-0000-0000-0000-000000000001"
FOLDER_ID = str(uuid4())
CHILD_FOLDER_ID = str(uuid4())
NOW = datetime.now(timezone.utc).isoformat()


def _folder_row(folder_id=None, name="Reports", parent_id=None, is_global=False):
    return {
        "id": folder_id or FOLDER_ID,
        "user_id": USER_ID,
        "name": name,
        "parent_id": parent_id,
        "is_global": is_global,
        "created_at": NOW,
        "updated_at": NOW,
    }


def _make_result(data):
    r = MagicMock()
    r.data = data
    return r


# ── POST /folders ──────────────────────────────────────────────────────────────

class TestCreateFolder:
    def test_create_root_folder(self, client, auth_headers, mock_execute_result):
        """POST /folders with name only returns 201 with correct fields."""
        mock_execute_result.data = [_folder_row()]
        response = client.post("/folders", headers=auth_headers, json={"name": "Reports"})
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Reports"
        assert data["user_id"] == USER_ID
        assert data["parent_id"] is None
        assert data["is_global"] is False
        # Verify supabase.table("folders") was called
        table_calls = [str(c) for c in _supabase.table.call_args_list]
        assert any("folders" in c for c in table_calls)

    def test_create_folder_returns_correct_schema(self, client, auth_headers, mock_execute_result):
        """Response includes all required FolderResponse fields."""
        mock_execute_result.data = [_folder_row()]
        response = client.post("/folders", headers=auth_headers, json={"name": "Reports"})
        data = response.json()
        for key in ("id", "user_id", "name", "parent_id", "is_global", "created_at", "updated_at"):
            assert key in data, f"Missing field: {key}"

    def test_create_folder_strips_whitespace(self, client, auth_headers, mock_execute_result):
        """POST /folders with padded name — insert called with stripped name."""
        mock_execute_result.data = [_folder_row(name="Reports")]
        response = client.post("/folders", headers=auth_headers, json={"name": "  Reports  "})
        assert response.status_code == 201
        # Verify .insert() was called with stripped name
        insert_call_args = _supabase.table.return_value.insert.call_args
        assert insert_call_args is not None
        inserted_data = insert_call_args[0][0]
        assert inserted_data["name"] == "Reports"

    def test_create_nested_folder(self, client, auth_headers, mock_builder, mock_execute_result):
        """POST /folders with parent_id returns 201 when parent is accessible.

        The or_() in the parent validation chain breaks off _builder, so that
        first execute() call goes through a detached MagicMock (truthy by default,
        so parent validation passes). The insert() execute() is the only call on
        _builder, controlled via mock_execute_result.
        """
        parent_id = str(uuid4())
        # Restore or_ chain so parent validation execute() flows through _builder
        mock_builder.or_.return_value = mock_builder
        parent_result = _make_result(_folder_row(folder_id=parent_id))
        insert_result = _make_result([_folder_row(parent_id=parent_id)])
        mock_builder.execute.side_effect = [parent_result, insert_result]

        response = client.post(
            "/folders",
            headers=auth_headers,
            json={"name": "Q1", "parent_id": parent_id},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["parent_id"] == parent_id

    def test_create_folder_invalid_parent_404(self, client, auth_headers, mock_builder):
        """POST /folders with non-existent parent_id returns 404."""
        nonexistent_parent = str(uuid4())
        # Restore or_ chain so parent validation execute() flows through _builder
        mock_builder.or_.return_value = mock_builder
        # Parent lookup returns no data (not found or not accessible)
        empty_result = _make_result(None)
        mock_builder.execute.side_effect = [empty_result]

        response = client.post(
            "/folders",
            headers=auth_headers,
            json={"name": "Q1", "parent_id": nonexistent_parent},
        )
        assert response.status_code == 404

    def test_create_global_folder(self, client, auth_headers, mock_execute_result):
        """POST /folders with is_global=true returns 201, insert called with is_global=True."""
        mock_execute_result.data = [_folder_row(name="Shared", is_global=True)]
        response = client.post(
            "/folders",
            headers=auth_headers,
            json={"name": "Shared", "is_global": True},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["is_global"] is True
        # Verify .insert() was called with is_global=True
        insert_call_args = _supabase.table.return_value.insert.call_args
        assert insert_call_args is not None
        inserted_data = insert_call_args[0][0]
        assert inserted_data["is_global"] is True

    def test_create_folder_sets_user_id(self, client, auth_headers, mock_execute_result):
        """POST /folders — insert is called with the authenticated user's id."""
        mock_execute_result.data = [_folder_row()]
        client.post("/folders", headers=auth_headers, json={"name": "Reports"})
        insert_call_args = _supabase.table.return_value.insert.call_args
        assert insert_call_args is not None
        inserted_data = insert_call_args[0][0]
        assert inserted_data["user_id"] == USER_ID


# ── GET /folders ───────────────────────────────────────────────────────────────

class TestListFolders:
    def test_list_folders_returns_200(self, client, auth_headers, mock_execute_result):
        """GET /folders returns 200 with a list."""
        mock_execute_result.data = [_folder_row()]
        response = client.get("/folders", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_list_folders_returns_folder_data(self, client, auth_headers, mock_execute_result):
        """GET /folders returns the folder rows."""
        mock_execute_result.data = [_folder_row(name="Reports"), _folder_row(folder_id=str(uuid4()), name="Finance")]
        response = client.get("/folders", headers=auth_headers)
        data = response.json()
        assert len(data) == 2
        names = {f["name"] for f in data}
        assert "Reports" in names
        assert "Finance" in names

    def test_list_folders_returns_empty_list(self, client, auth_headers, mock_execute_result):
        """GET /folders returns empty list when no folders exist."""
        mock_execute_result.data = []
        response = client.get("/folders", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_list_folders_uses_or_filter(self, client, auth_headers, mock_execute_result):
        """GET /folders calls .or_() to include both owned and global folders."""
        mock_execute_result.data = []
        client.get("/folders", headers=auth_headers)
        # Verify .or_() was called on the builder chain
        builder = _supabase.table.return_value
        builder.or_.assert_called()
        # The or_ filter should include user_id and is_global
        or_call_args = builder.or_.call_args
        assert or_call_args is not None
        filter_str = or_call_args[0][0]
        assert "user_id" in filter_str
        assert "is_global" in filter_str

    def test_list_folders_deduplicates_owned_global(self, client, auth_headers, mock_execute_result):
        """GET /folders deduplicates rows — a folder that is both owned and global appears once."""
        # Same folder ID returned twice (simulates owned + global overlap)
        row = _folder_row(is_global=True)
        mock_execute_result.data = [row, row]
        response = client.get("/folders", headers=auth_headers)
        data = response.json()
        assert len(data) == 1


# ── GET /folders/{id}/children ─────────────────────────────────────────────────

class TestListChildren:
    def test_list_children_returns_200(self, client, auth_headers, mock_execute_result):
        """GET /folders/{id}/children returns 200."""
        mock_execute_result.data = []
        response = client.get(f"/folders/{FOLDER_ID}/children", headers=auth_headers)
        assert response.status_code == 200

    def test_list_children_returns_child_rows(self, client, auth_headers, mock_execute_result):
        """GET /folders/{id}/children returns direct child folders."""
        child = _folder_row(folder_id=CHILD_FOLDER_ID, name="Q1", parent_id=FOLDER_ID)
        mock_execute_result.data = [child]
        response = client.get(f"/folders/{FOLDER_ID}/children", headers=auth_headers)
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Q1"
        assert data[0]["parent_id"] == FOLDER_ID

    def test_list_children_filters_by_parent_id(self, client, auth_headers, mock_execute_result):
        """GET /folders/{id}/children calls .eq('parent_id', folder_id)."""
        mock_execute_result.data = []
        client.get(f"/folders/{FOLDER_ID}/children", headers=auth_headers)
        builder = _supabase.table.return_value
        # Verify eq was called with parent_id filter
        eq_calls = [str(c) for c in builder.eq.call_args_list]
        assert any("parent_id" in c for c in eq_calls)


# ── PATCH /folders/{id} ────────────────────────────────────────────────────────

class TestRenameFolder:
    def test_rename_folder(self, client, auth_headers, mock_execute_result):
        """PATCH /folders/{id} with new name returns 200 with updated folder."""
        updated = _folder_row(name="New Name")
        mock_execute_result.data = [updated]
        response = client.patch(
            f"/folders/{FOLDER_ID}",
            headers=auth_headers,
            json={"name": "New Name"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Name"

    def test_rename_folder_calls_update_with_correct_name(self, client, auth_headers, mock_execute_result):
        """PATCH /folders/{id} — .update() is called with stripped name."""
        mock_execute_result.data = [_folder_row(name="New Name")]
        client.patch(
            f"/folders/{FOLDER_ID}",
            headers=auth_headers,
            json={"name": "  New Name  "},
        )
        builder = _supabase.table.return_value
        update_call_args = builder.update.call_args
        assert update_call_args is not None
        assert update_call_args[0][0] == {"name": "New Name"}

    def test_rename_folder_not_found(self, client, auth_headers, mock_execute_result):
        """PATCH /folders/{id} when folder not owned/found returns 404."""
        mock_execute_result.data = []  # update returns empty data — not found or not owned
        response = client.patch(
            f"/folders/{FOLDER_ID}",
            headers=auth_headers,
            json={"name": "New Name"},
        )
        assert response.status_code == 404

    def test_rename_folder_enforces_ownership(self, client, auth_headers, mock_execute_result):
        """PATCH /folders/{id} — .eq('user_id', ...) is called to enforce ownership."""
        mock_execute_result.data = [_folder_row(name="New Name")]
        client.patch(
            f"/folders/{FOLDER_ID}",
            headers=auth_headers,
            json={"name": "New Name"},
        )
        builder = _supabase.table.return_value
        eq_calls = [str(c) for c in builder.eq.call_args_list]
        assert any("user_id" in c for c in eq_calls)


# ── DELETE /folders/{id} ───────────────────────────────────────────────────────

class TestDeleteFolder:
    def test_delete_folder_returns_204(self, client, auth_headers, mock_execute_result):
        """DELETE /folders/{id} returns 204 No Content."""
        mock_execute_result.data = []
        response = client.delete(f"/folders/{FOLDER_ID}", headers=auth_headers)
        assert response.status_code == 204

    def test_delete_folder_calls_delete_on_supabase(self, client, auth_headers, mock_execute_result):
        """DELETE /folders/{id} — supabase.table('folders').delete() is called."""
        mock_execute_result.data = []
        client.delete(f"/folders/{FOLDER_ID}", headers=auth_headers)
        builder = _supabase.table.return_value
        builder.delete.assert_called()

    def test_delete_folder_enforces_ownership(self, client, auth_headers, mock_execute_result):
        """DELETE /folders/{id} — .eq('user_id', ...) filters to prevent deleting others' folders."""
        mock_execute_result.data = []
        client.delete(f"/folders/{FOLDER_ID}", headers=auth_headers)
        builder = _supabase.table.return_value
        eq_calls = [str(c) for c in builder.eq.call_args_list]
        assert any("user_id" in c for c in eq_calls)

    def test_delete_folder_filters_by_folder_id(self, client, auth_headers, mock_execute_result):
        """DELETE /folders/{id} — .eq('id', folder_id) is called."""
        mock_execute_result.data = []
        client.delete(f"/folders/{FOLDER_ID}", headers=auth_headers)
        builder = _supabase.table.return_value
        eq_calls = [str(c) for c in builder.eq.call_args_list]
        assert any(FOLDER_ID in c for c in eq_calls)

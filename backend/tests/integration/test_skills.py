"""Integration tests for /skills endpoints — Phase 10: Agent Skills Core.

This file is the Wave 0 test scaffold. All tests are expected to FAIL (RED)
until Plan 02 implements the router. Plan 02 makes them GREEN.

Requirements covered: SKIL-01, SKIL-02, SKIL-03, SKIL-04, SKIL-05, SKIL-06,
                      FILE-01, FILE-02, FILE-03, FILE-06
"""
from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from tests.conftest import _supabase


# ── Helpers ────────────────────────────────────────────────────────────────────

USER_ID = "00000000-0000-0000-0000-000000000001"
SKILL_ID = str(uuid4())
FILE_ID = str(uuid4())
NOW = datetime.now(timezone.utc).isoformat()


def _skill_row(
    skill_id=None,
    name="SQL Writer",
    description="Writes SQL",
    instructions="Write valid SQL",
    is_enabled=True,
    is_global=False,
):
    return {
        "id": skill_id or SKILL_ID,
        "user_id": USER_ID,
        "name": name,
        "description": description,
        "instructions": instructions,
        "is_enabled": is_enabled,
        "is_global": is_global,
        "created_at": NOW,
        "updated_at": NOW,
    }


def _file_row(file_id=None, skill_id=None, filename="helper.py"):
    return {
        "id": file_id or FILE_ID,
        "skill_id": skill_id or SKILL_ID,
        "user_id": USER_ID,
        "filename": filename,
        "file_path": f"{USER_ID}/{skill_id or SKILL_ID}/{filename}",
        "file_size": 1024,
        "mime_type": "text/x-python",
        "created_at": NOW,
    }


def _make_result(data):
    r = MagicMock()
    r.data = data
    return r


# ── POST /skills ───────────────────────────────────────────────────────────────

class TestCreateSkill:
    def test_create_skill_returns_201(self, client, auth_headers, mock_execute_result):
        """POST /skills with valid JSON returns 201 with SkillResponse fields. (SKIL-01)"""
        mock_execute_result.data = [_skill_row()]
        response = client.post("/skills", headers=auth_headers, json={
            "name": "SQL Writer",
            "description": "Writes SQL",
            "instructions": "Write valid SQL",
        })
        assert response.status_code == 201
        data = response.json()
        for key in ("id", "user_id", "name", "description", "instructions",
                    "is_enabled", "is_global", "created_at", "updated_at"):
            assert key in data, f"Missing field: {key}"
        assert data["name"] == "SQL Writer"
        assert data["user_id"] == USER_ID


# ── GET /skills ────────────────────────────────────────────────────────────────

class TestListSkills:
    def test_list_skills_returns_own_and_global(self, client, auth_headers, mock_execute_result):
        """GET /skills returns own + global skills (dedup). (SKIL-01)"""
        mock_execute_result.data = [
            _skill_row(),
            _skill_row(skill_id=str(uuid4()), is_global=True),
        ]
        response = client.get("/skills", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2


# ── PATCH /skills/{id} ────────────────────────────────────────────────────────

class TestUpdateSkill:
    def test_update_skill_name(self, client, auth_headers, mock_execute_result):
        """PATCH /skills/{id} with partial fields returns 200. (SKIL-02)"""
        mock_execute_result.data = [_skill_row(name="Updated")]
        response = client.patch(
            f"/skills/{SKILL_ID}",
            headers=auth_headers,
            json={"name": "Updated"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated"


# ── DELETE /skills/{id} ───────────────────────────────────────────────────────

class TestDeleteSkill:
    def test_delete_skill_cleans_storage(self, client, auth_headers, mock_builder):
        """DELETE /skills/{id} returns 204 and calls storage.remove for each file. (SKIL-03)"""
        file_list_result = _make_result([_file_row()])
        delete_result = _make_result([])
        mock_builder.execute.side_effect = [file_list_result, delete_result]

        response = client.delete(f"/skills/{SKILL_ID}", headers=auth_headers)
        assert response.status_code == 204

        # Verify storage cleanup was called
        _supabase.storage.from_("skill-files").remove.assert_called()


# ── PATCH /skills/{id}/toggle-enabled ─────────────────────────────────────────

class TestToggleEnabled:
    def test_toggle_enabled_flips_value(self, client, auth_headers, mock_builder):
        """PATCH /skills/{id}/toggle-enabled flips is_enabled boolean. (SKIL-04)"""
        fetch_result = _make_result([_skill_row(is_enabled=True)])
        update_result = _make_result([_skill_row(is_enabled=False)])
        mock_builder.execute.side_effect = [fetch_result, update_result]

        response = client.patch(
            f"/skills/{SKILL_ID}/toggle-enabled",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_enabled"] is False


# ── PATCH /skills/{id}/toggle-global ──────────────────────────────────────────

class TestToggleGlobal:
    def test_toggle_global_flips_value(self, client, auth_headers, mock_builder):
        """PATCH /skills/{id}/toggle-global flips is_global True when the publish gate is MET.
        GATE-01 (Phase 136): private→global now recomputes the gate from eval_runs FIRST — a
        completed passing run on the CURRENT version satisfies it, so the flip succeeds.
        (SKIL-05, SKIL-06)"""
        instr = "Write valid SQL"
        ver_id = str(uuid4())
        run_id = str(uuid4())
        # Execute-call order for a GATED private→global toggle:
        #   1 owner-verify fetch → 2-5 compute_publish_gate reads
        #   (skill / completed-runs / pinned-versions / last-override) → 6 the is_global UPDATE.
        mock_builder.execute.side_effect = [
            _make_result([_skill_row(is_global=False, instructions=instr)]),               # 1 fetch
            _make_result([{"id": SKILL_ID, "instructions": instr, "is_global": False}]),    # 2 gate skill
            _make_result([{                                                                 # 3 gate runs
                "id": run_id, "status": "completed", "passed_count": 1,
                "measured_count": 1, "skill_version_id": ver_id, "created_at": NOW,
            }]),
            _make_result([{"id": ver_id, "instructions": instr}]),                          # 4 gate versions
            _make_result([]),                                                               # 5 gate override
            _make_result([_skill_row(is_global=True)]),                                     # 6 update
        ]

        response = client.patch(
            f"/skills/{SKILL_ID}/toggle-global",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_global"] is True


# ── POST /skills/{id}/files ────────────────────────────────────────────────────

class TestUploadFile:
    def test_upload_file_returns_201(self, client, auth_headers, mock_builder):
        """POST /skills/{id}/files with multipart returns 201 with SkillFileResponse fields. (FILE-01, FILE-03)"""
        ownership_result = _make_result([_skill_row()])
        insert_result = _make_result([_file_row()])
        mock_builder.execute.side_effect = [ownership_result, insert_result]

        response = client.post(
            f"/skills/{SKILL_ID}/files",
            headers=auth_headers,
            files={"file": ("helper.py", b"print('hello')", "text/x-python")},
        )
        assert response.status_code == 201
        data = response.json()
        for key in ("id", "skill_id", "user_id", "filename", "file_path",
                    "file_size", "mime_type", "created_at"):
            assert key in data, f"Missing field: {key}"

        # Verify storage upload was called
        _supabase.storage.from_("skill-files").upload.assert_called()

    def test_upload_file_rejects_over_10mb(self, client, auth_headers):
        """POST /skills/{id}/files rejects files over 10 MB with 413. (FILE-01)"""
        big_content = b"x" * (10 * 1024 * 1024 + 1)  # 10 MB + 1 byte
        response = client.post(
            f"/skills/{SKILL_ID}/files",
            headers=auth_headers,
            files={"file": ("big.bin", big_content, "application/octet-stream")},
        )
        assert response.status_code == 413


# ── DELETE /skills/{id}/files/{file_id} ───────────────────────────────────────

class TestDeleteFile:
    def test_delete_file_returns_204(self, client, auth_headers, mock_builder):
        """DELETE /skills/{id}/files/{file_id} returns 204 and calls storage.remove. (FILE-02)"""
        file_lookup_result = _make_result([_file_row()])
        delete_result = _make_result([])
        mock_builder.execute.side_effect = [file_lookup_result, delete_result]

        response = client.delete(
            f"/skills/{SKILL_ID}/files/{FILE_ID}",
            headers=auth_headers,
        )
        assert response.status_code == 204
        _supabase.storage.from_("skill-files").remove.assert_called()

    def test_delete_file_nonowner_returns_404(self, client, auth_headers, mock_builder):
        """DELETE /skills/{id}/files/{file_id} returns 404 if file not owned by user. (FILE-06)"""
        file_lookup_result = _make_result([])  # empty — file not found or not owned
        mock_builder.execute.side_effect = [file_lookup_result]

        response = client.delete(
            f"/skills/{SKILL_ID}/files/{FILE_ID}",
            headers=auth_headers,
        )
        assert response.status_code == 404

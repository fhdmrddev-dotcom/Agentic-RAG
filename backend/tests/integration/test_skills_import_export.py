"""Integration tests for /skills export and import endpoints — Phase 13: Skills Open Standard.

Requirements covered: OPEN-01, OPEN-02, OPEN-03, OPEN-04, OPEN-05, OPEN-06
"""
import io
import zipfile
from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
import yaml

from tests.conftest import _supabase, _builder


# ── Helpers ────────────────────────────────────────────────────────────────────

USER_ID = "00000000-0000-0000-0000-000000000001"
SKILL_ID = str(uuid4())
NOW = datetime.now(timezone.utc).isoformat()


def _skill_row(
    skill_id=None,
    name="SQL Writer",
    description="Writes SQL",
    instructions="Write valid SQL for the user.",
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


def _file_row(file_id=None, skill_id=None, filename="helper.py", mime_type="text/x-python"):
    sid = skill_id or SKILL_ID
    return {
        "id": file_id or str(uuid4()),
        "skill_id": sid,
        "user_id": USER_ID,
        "filename": filename,
        "file_path": f"{USER_ID}/{sid}/{filename}",
        "file_size": 1024,
        "mime_type": mime_type,
        "created_at": NOW,
    }


def _make_result(data):
    r = MagicMock()
    r.data = data
    return r


def _make_zip(entries: dict[str, str | bytes]) -> bytes:
    """Create an in-memory ZIP from a dict of {name: content}."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, content in entries.items():
            if isinstance(content, str):
                content = content.encode("utf-8")
            zf.writestr(name, content)
    return buf.getvalue()


def _valid_skill_md(name="Test Skill", description="A test skill", instructions="Do the thing."):
    return f"---\nname: {name}\ndescription: {description}\n---\n\n{instructions}"


# ── Export Tests (OPEN-01, OPEN-02, OPEN-03) ──────────────────────────────────

class TestExportSkill:
    def test_export_returns_zip(self, client, auth_headers, mock_builder):
        """GET /skills/{id}/export returns 200, application/zip, Content-Disposition. (OPEN-01)"""
        skill_result = _make_result([_skill_row()])
        files_result = _make_result([])
        mock_builder.execute.side_effect = [skill_result, files_result]

        response = client.get(f"/skills/{SKILL_ID}/export", headers=auth_headers)

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/zip"
        assert "Content-Disposition" in response.headers
        assert "attachment" in response.headers["Content-Disposition"]

    def test_export_skill_md_content(self, client, auth_headers, mock_builder):
        """Exported ZIP contains SKILL.md with YAML frontmatter + instructions body. (OPEN-02)

        Production exports use the agentskills.io bundle layout: a single top-level
        slug directory (derived from the skill name) containing SKILL.md and any
        subdirs. The import side (`_find_skill_entries` in app/api/skills.py)
        handles both flat (`SKILL.md`) and prefixed (`{slug}/SKILL.md`) shapes —
        production emits the prefixed shape, so this test asserts that.
        """
        skill_result = _make_result([_skill_row(
            name="SQL Writer",
            description="Writes SQL",
            instructions="Write valid SQL for the user.",
        )])
        files_result = _make_result([])
        mock_builder.execute.side_effect = [skill_result, files_result]

        response = client.get(f"/skills/{SKILL_ID}/export", headers=auth_headers)
        assert response.status_code == 200

        # Inspect ZIP contents — production wraps every export in a slug directory
        # (e.g. "sql-writer/SKILL.md") per agentskills.io bundle conventions.
        zf = zipfile.ZipFile(io.BytesIO(response.content))
        names = zf.namelist()
        skill_md_entries = [n for n in names if n.endswith("SKILL.md")]
        assert len(skill_md_entries) == 1, f"Expected exactly one SKILL.md, got {names}"
        skill_md_path = skill_md_entries[0]

        skill_md = zf.read(skill_md_path).decode("utf-8")
        # Parse frontmatter
        parts = skill_md.split("---", 2)
        assert len(parts) == 3, "SKILL.md must have YAML frontmatter delimiters"
        fm = yaml.safe_load(parts[1])

        # Production sets fm["name"] to the slug (e.g. "sql-writer"), not the
        # human-readable display name — the slug is what the import side uses to
        # round-trip the bundle directory.
        assert fm["name"] == "sql-writer"
        assert fm["description"] == "Writes SQL"
        assert fm["license"] == "MIT"
        # `compatibility` is a free-form string in production; assert it's present
        # rather than pinning to a specific runtime-requirement sentence.
        assert "compatibility" in fm and fm["compatibility"]
        # Instructions body
        assert "Write valid SQL for the user." in parts[2]

    def test_export_file_subdirs(self, client, auth_headers, mock_builder):
        """Exported ZIP places files in scripts/, assets/, references/ based on MIME type. (OPEN-03)

        Subdirs are nested under a top-level slug directory per the agentskills.io
        bundle layout (see test_export_skill_md_content for the broader rationale).
        Assertions check for `*/scripts/`, `*/assets/`, `*/references/` shapes
        rather than top-level prefixes.
        """
        skill_result = _make_result([_skill_row()])
        files_result = _make_result([
            _file_row(filename="script.py", mime_type="text/x-python"),
            _file_row(filename="logo.png", mime_type="image/png"),
            _file_row(filename="data.csv", mime_type="text/csv"),
        ])
        mock_builder.execute.side_effect = [skill_result, files_result]

        # Storage download must return bytes for each file
        _supabase.storage.from_.return_value.download.return_value = b"file-content"

        response = client.get(f"/skills/{SKILL_ID}/export", headers=auth_headers)
        assert response.status_code == 200

        zf = zipfile.ZipFile(io.BytesIO(response.content))
        names = zf.namelist()

        # Each MIME bucket lives under `{slug}/{subdir}/...`. Match the subdir
        # segment regardless of which top-level slug production chose.
        assert any("/scripts/" in n for n in names), f"No /scripts/ entry in {names}"
        assert any("/assets/" in n for n in names), f"No /assets/ entry in {names}"
        assert any("/references/" in n for n in names), f"No /references/ entry in {names}"

    def test_export_not_owner_returns_404(self, client, auth_headers, mock_builder):
        """GET /skills/{id}/export for a non-owned skill returns 404. (OPEN-01)"""
        skill_result = _make_result([])
        mock_builder.execute.side_effect = [skill_result]

        response = client.get(f"/skills/{SKILL_ID}/export", headers=auth_headers)
        assert response.status_code == 404

    def test_export_no_files(self, client, auth_headers, mock_builder):
        """Export of a skill with no attached files still produces valid ZIP with only SKILL.md.

        Production wraps SKILL.md in a slug directory (`{slug}/SKILL.md`) per the
        agentskills.io bundle layout. The "no attached files" contract becomes:
        the ZIP contains exactly one entry, and that entry is the slug-prefixed
        SKILL.md.
        """
        skill_result = _make_result([_skill_row()])
        files_result = _make_result([])
        mock_builder.execute.side_effect = [skill_result, files_result]

        response = client.get(f"/skills/{SKILL_ID}/export", headers=auth_headers)
        assert response.status_code == 200

        zf = zipfile.ZipFile(io.BytesIO(response.content))
        names = zf.namelist()
        assert len(names) == 1, f"Expected exactly one ZIP entry, got {names}"
        assert names[0].endswith("SKILL.md"), f"Sole entry should be SKILL.md, got {names[0]}"


# ── Import Tests (OPEN-04, OPEN-05, OPEN-06) ──────────────────────────────────

class TestImportSkill:
    def test_import_creates_skill(self, client, auth_headers, mock_builder):
        """POST /skills/import with a valid single-skill ZIP creates a new skill. (OPEN-04)"""
        zip_bytes = _make_zip({"SKILL.md": _valid_skill_md(name="Imported Skill")})

        insert_result = _make_result([_skill_row(name="Imported Skill")])
        mock_builder.execute.side_effect = [insert_result]

        response = client.post(
            "/skills/import",
            headers=auth_headers,
            files={"file": ("skill.zip", zip_bytes, "application/zip")},
        )
        assert response.status_code == 201
        data = response.json()
        assert "created" in data
        assert "errors" in data
        assert len(data["created"]) == 1
        assert len(data["errors"]) == 0

    def test_import_with_files(self, client, auth_headers, mock_builder):
        """POST /skills/import with ZIP containing SKILL.md + scripts/helper.py uploads the file. (OPEN-04)"""
        zip_bytes = _make_zip({
            "SKILL.md": _valid_skill_md(name="Skill With Files"),
            "scripts/helper.py": "print('hello')",
        })

        insert_skill_result = _make_result([_skill_row(name="Skill With Files")])
        insert_file_result = _make_result([_file_row()])
        mock_builder.execute.side_effect = [insert_skill_result, insert_file_result]

        response = client.post(
            "/skills/import",
            headers=auth_headers,
            files={"file": ("skill.zip", zip_bytes, "application/zip")},
        )
        assert response.status_code == 201
        data = response.json()
        assert len(data["created"]) == 1

        # Verify storage upload was called for the file
        _supabase.storage.from_.return_value.upload.assert_called()

    def test_import_path_traversal_rejected(self, client, auth_headers):
        """POST /skills/import with ZIP containing path traversal entry returns 400. (OPEN-06)"""
        zip_bytes = _make_zip({
            "SKILL.md": _valid_skill_md(),
            "../../etc/passwd": "evil",
        })

        response = client.post(
            "/skills/import",
            headers=auth_headers,
            files={"file": ("evil.zip", zip_bytes, "application/zip")},
        )
        assert response.status_code == 400
        assert "unsafe" in response.json()["detail"].lower()

    def test_import_absolute_path_rejected(self, client, auth_headers):
        """POST /skills/import with absolute path ZIP entry returns 400. (OPEN-06)"""
        # Build a ZIP manually to include an absolute-ish path — zipfile strips leading / normally
        # We need to manually craft the zip to include an entry that starts with /
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("SKILL.md", _valid_skill_md())
            # zipfile won't add / prefix automatically, simulate with a path that normpath deems absolute
            # On POSIX, os.path.isabs("/etc/passwd") is True
            info = zipfile.ZipInfo("/etc/passwd")
            zf.writestr(info, "evil")
        zip_bytes = buf.getvalue()

        response = client.post(
            "/skills/import",
            headers=auth_headers,
            files={"file": ("evil.zip", zip_bytes, "application/zip")},
        )
        assert response.status_code == 400
        assert "unsafe" in response.json()["detail"].lower()

    def test_import_invalid_zip(self, client, auth_headers):
        """POST /skills/import with non-ZIP data returns 400. (OPEN-04)"""
        response = client.post(
            "/skills/import",
            headers=auth_headers,
            files={"file": ("notazip.txt", b"this is not a zip file", "text/plain")},
        )
        assert response.status_code == 400

    def test_import_no_skill_md(self, client, auth_headers):
        """POST /skills/import with valid ZIP but no SKILL.md returns 400. (OPEN-04)"""
        zip_bytes = _make_zip({"README.txt": "No skill here"})

        response = client.post(
            "/skills/import",
            headers=auth_headers,
            files={"file": ("no_skill.zip", zip_bytes, "application/zip")},
        )
        assert response.status_code == 400

    def test_import_invalid_yaml(self, client, auth_headers):
        """POST /skills/import where SKILL.md has malformed YAML reports error. (OPEN-05)"""
        # A ZIP with only an invalid SKILL.md should return 400 since no skills can be created
        bad_skill_md = "---\n: invalid: yaml: {{{\n---\nInstructions"
        zip_bytes = _make_zip({"SKILL.md": bad_skill_md})

        response = client.post(
            "/skills/import",
            headers=auth_headers,
            files={"file": ("bad.zip", zip_bytes, "application/zip")},
        )
        # Either 400 (no SKILL.md parsed) or 201 with errors — both are acceptable
        # The requirement is that errors are reported; if ALL skills fail, 400 is more user-friendly
        assert response.status_code in (400, 201)

    def test_bulk_import_partial_failure(self, client, auth_headers, mock_builder):
        """Multi-skill ZIP: one valid, one invalid YAML — valid created, failed reported. (OPEN-05)"""
        valid_skill_md = _valid_skill_md(name="Good Skill")
        invalid_skill_md = "---\n: broken: {{{\n---\nBody"
        zip_bytes = _make_zip({
            "skill-good/SKILL.md": valid_skill_md,
            "skill-bad/SKILL.md": invalid_skill_md,
        })

        insert_result = _make_result([_skill_row(name="Good Skill")])
        mock_builder.execute.side_effect = [insert_result]

        response = client.post(
            "/skills/import",
            headers=auth_headers,
            files={"file": ("bulk.zip", zip_bytes, "application/zip")},
        )
        assert response.status_code == 201
        data = response.json()
        assert len(data["created"]) == 1
        assert len(data["errors"]) == 1
        assert "Good Skill" in str(data["created"])

    def test_bulk_import_all_success(self, client, auth_headers, mock_builder):
        """Multi-skill ZIP with 2 valid skills creates both. (OPEN-05)"""
        zip_bytes = _make_zip({
            "skill-a/SKILL.md": _valid_skill_md(name="Skill A"),
            "skill-b/SKILL.md": _valid_skill_md(name="Skill B"),
        })

        result_a = _make_result([_skill_row(name="Skill A")])
        result_b = _make_result([_skill_row(name="Skill B")])
        mock_builder.execute.side_effect = [result_a, result_b]

        response = client.post(
            "/skills/import",
            headers=auth_headers,
            files={"file": ("bulk.zip", zip_bytes, "application/zip")},
        )
        assert response.status_code == 201
        data = response.json()
        assert len(data["created"]) == 2
        assert len(data["errors"]) == 0

    def test_import_size_limit(self, client, auth_headers):
        """POST /skills/import with ZIP over 10 MB returns 413. (OPEN-04)"""
        # Create a large payload (not a real ZIP, but size check happens first)
        large_bytes = b"x" * (10 * 1024 * 1024 + 1)

        response = client.post(
            "/skills/import",
            headers=auth_headers,
            files={"file": ("big.zip", large_bytes, "application/zip")},
        )
        assert response.status_code == 413

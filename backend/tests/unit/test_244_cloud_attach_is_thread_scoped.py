"""Phase 244 plan 06 Task 3 (SHELL-04 / D-244-05 / BUG-260905-01) —
THE COMPOSER'S CLOUD DOOR WRITES TO THE THREAD, AND TO NOTHING ELSE.

⛔ THE NEGATIVE IS THE POINT. The ROADMAP's named failure mode for `SHELL-04` is *"a local
attach that quietly writes to the Library anyway"*, and the operator's sentence in
`BUG-260905-01` is *"Anything in the chat should stay temporarily in that thread, not in the
Library itself."* A positive-only test — "a `workspace_files` row was written" — cannot see a
`documents` row being minted beside it.

⭐ THE PLACEMENT IS THE GUARANTEE, AND CASE 2 ASSERTS IT. `app/api/workspace.py` imports
neither `import_single_file` nor `ingest_splice`, so the chat door has no reach to the minter
at all. That is a structural property a future edit trips over, not a promise in a docstring.

Every case is STUBBED — ⛔ no `documents` row, no `workspace_files` row and no Postgres
connection is created by this file. Worktrees isolate files, not the local database.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.api import workspace

WORKSPACE_SRC = Path(workspace.__file__).read_text(encoding="utf-8")

# A real minimal OOXML container, so the magic-byte gate passes on merit rather than by stub.
import io
import zipfile


def _docx_bytes() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("word/document.xml", "<document/>")
    return buf.getvalue()


def _strip_comments(src: str) -> str:
    """Prose about code is not code (244-05's finding, both directions).

    A docstring that EXPLAINS why this module never calls the minter contains the minter's
    name, and an unstripped fence would measure the explanation instead of the module.
    """
    out = re.sub(r'"""(?:.|\n)*?"""', "", src)
    out = re.sub(r"'''(?:.|\n)*?'''", "", out)
    out = re.sub(r"(?m)#.*$", "", out)
    return out


class _FakeConn:
    async def __aenter__(self):
        return MagicMock()

    async def __aexit__(self, *a):
        return False


@pytest.fixture
def stubbed(monkeypatch):
    """Every seam the route touches, replaced. Nothing reaches a database."""
    monkeypatch.setattr(workspace, "_verify_thread_ownership", AsyncMock(return_value=None))
    monkeypatch.setattr(
        workspace.connector_service,
        "get_connection",
        AsyncMock(return_value=SimpleNamespace(id="conn-1", service_id="google_workspace")),
    )
    monkeypatch.setattr(workspace, "get_user_pg_connection", lambda *a, **k: _FakeConn())
    written: dict = {}

    async def _fake_write(_conn, _sb, **kw):
        written.update(kw)
        return {"file_id": "wf-1", "path": kw["path"], "size_bytes": len(kw["content"])}

    monkeypatch.setattr(workspace, "ws_write_file", _fake_write)
    monkeypatch.setattr(
        workspace,
        "load_app_settings_async",
        AsyncMock(return_value=SimpleNamespace(template_ttl_hours=24)),
    )
    return written


async def _call(monkeypatch, *, filename: str, raw: bytes):
    monkeypatch.setattr(
        "app.services.sources.import_service.fetch_cloud_file",
        AsyncMock(return_value=(filename, raw, "application/octet-stream")),
    )
    body = workspace.WorkspaceConnectionAttachRequest(connection_id="conn-1", file_id="cf-1")
    return await workspace.attach_connection_file(
        thread_id="11111111-1111-4111-8111-111111111111",
        request=MagicMock(),
        body=body,
        active_org="22222222-2222-4222-8222-222222222222",
        current_user={"id": "33333333-3333-4333-8333-333333333333"},
        supabase=MagicMock(),
    )


# ── 1 · the row that IS written is a thread-scoped, expiring workspace file ───────────────
@pytest.mark.asyncio
async def test_a_cloud_pick_writes_an_expiring_workspace_file(monkeypatch, stubbed):
    result = await _call(monkeypatch, filename="Meridian-Q4.docx", raw=_docx_bytes())

    assert stubbed["kind"] == "template_input"
    assert stubbed["expires_at"] is not None, "a chat attachment without a TTL is a Library row"
    assert result["kind"] == "template_input"
    assert result["path"].endswith("Meridian-Q4.docx")


# ── 2 · THE NEGATIVE — this module cannot reach the Library minter at all ─────────────────
def test_the_chat_attach_module_has_no_reach_to_the_library_minter():
    """PLANT to drive RED: add `from app.services.sources.import_service import
    import_single_file` at module scope and call it from `attach_connection_file`.

    ⛔ This is the ROADMAP's named failure mode for `SHELL-04`, and it is asserted on the
    SOURCE rather than on a call count because a mock can only see the paths a test happens
    to exercise. A module that never imports the minter cannot mint on ANY path.
    """
    body = _strip_comments(WORKSPACE_SRC)
    assert "async def attach_connection_file" in body  # non-vacuity
    for forbidden in (
        "import_single_file",
        "mint_document_row",
        "ingest_splice",
        "splice_document",
    ):
        assert forbidden not in body, (
            f"{forbidden!r} appears in app/api/workspace.py — the CHAT's cloud door now has "
            "reach to the Library minter, which is BUG-260905-01 re-inverted"
        )
    # …and the same module must never insert into `documents` by hand either.
    assert 'table("documents")' not in body


# ── 3 · the provider's bytes are untrusted, and meet the SAME gate the local door meets ───
@pytest.mark.asyncio
async def test_a_cloud_file_the_allowlist_refuses_is_refused(monkeypatch, stubbed):
    """PLANT to drive RED: skip `validate_upload` for the cloud path.

    ⛔ "our own cloud" is not a trust boundary — a Drive file is still a file someone else
    could have put there.
    """
    with pytest.raises(HTTPException) as exc:
        await _call(monkeypatch, filename="payload.exe", raw=b"MZ\x90\x00")
    assert exc.value.status_code == 422
    assert "Unsupported type" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_a_cloud_file_masquerading_as_a_docx_is_refused(monkeypatch, stubbed):
    with pytest.raises(HTTPException) as exc:
        await _call(monkeypatch, filename="invoice.docx", raw=b"not a zip at all")
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_an_oversized_cloud_file_is_refused_before_it_is_stored(monkeypatch, stubbed):
    too_big = b"%PDF-" + b"0" * (workspace.MAX_FILE_SIZE + 1)
    with pytest.raises(HTTPException) as exc:
        await _call(monkeypatch, filename="huge.pdf", raw=too_big)
    assert exc.value.status_code == 422
    assert "10 MB" in str(exc.value.detail)
    assert stubbed == {}, "an oversized file reached the writer"


# ── 4 · ONE writer, so the two doors cannot drift ────────────────────────────────────────
def test_both_doors_persist_through_the_same_single_writer():
    """PLANT to drive RED: re-inline the persist tail into `upload_template`.

    Two writers is how a second door quietly grows a laxer gate — the local door's TTL,
    magic-byte gate and filename sanitiser must be the cloud door's, by construction.
    """
    body = _strip_comments(WORKSPACE_SRC)
    assert body.count("async def _persist_workspace_upload") == 1
    assert body.count("await _persist_workspace_upload(") == 2, (
        "exactly two callers are expected — the local multipart door and the cloud door"
    )
    # The sanitiser and the TTL read live in the shared writer, not duplicated per door.
    # ⚠ MEASURED, not assumed: `validate_upload(` occurs TWICE in this module — once as the
    # `def` and once as the call. A bare `count(...) == 1` was written first and could not
    # pass on an untouched tree. The property meant is ONE CALL SITE, so count the call.
    assert body.count("def validate_upload(") == 1
    assert body.count("= validate_upload(") == 1
    assert body.count("template_ttl_hours") == 1


# ── 5 · a disabled connection is NOT reported as a provider failure ──────────────────────
@pytest.mark.asyncio
async def test_a_disabled_connection_is_named_not_blamed_on_the_provider(monkeypatch, stubbed):
    """PLANT to drive RED: move the `except SourceConnectionDisabled` arm BELOW the broad one.

    The ordering carried only a comment in `connectors.py` (BUG-260907-03) and this door
    repeats the shape, so it repeats the risk. A 502 *"the provider returned an error"* over a
    control WE applied is the failure mode the ordering exists to prevent.
    """
    from app.services.sources.base import SourceConnectionDisabled

    monkeypatch.setattr(
        "app.services.sources.import_service.fetch_cloud_file",
        AsyncMock(side_effect=SourceConnectionDisabled("This connection is turned off.")),
    )
    body = workspace.WorkspaceConnectionAttachRequest(connection_id="conn-1", file_id="cf-1")
    with pytest.raises(HTTPException) as exc:
        await workspace.attach_connection_file(
            thread_id="11111111-1111-4111-8111-111111111111",
            request=MagicMock(),
            body=body,
            active_org="22222222-2222-4222-8222-222222222222",
            current_user={"id": "33333333-3333-4333-8333-333333333333"},
            supabase=MagicMock(),
        )
    assert exc.value.status_code != 502, "a control we applied reported as the provider's fault"
    assert exc.value.status_code == 409
    assert exc.value.detail["reason_code"] == "connection_disabled"


# ── 6 · an unknown / cross-org connection reads as ABSENT ────────────────────────────────
@pytest.mark.asyncio
async def test_a_connection_the_caller_cannot_see_is_absent_never_forbidden(monkeypatch, stubbed):
    monkeypatch.setattr(workspace.connector_service, "get_connection", AsyncMock(return_value=None))
    body = workspace.WorkspaceConnectionAttachRequest(connection_id="conn-x", file_id="cf-1")
    with pytest.raises(HTTPException) as exc:
        await workspace.attach_connection_file(
            thread_id="11111111-1111-4111-8111-111111111111",
            request=MagicMock(),
            body=body,
            active_org="22222222-2222-4222-8222-222222222222",
            current_user={"id": "33333333-3333-4333-8333-333333333333"},
            supabase=MagicMock(),
        )
    assert exc.value.status_code == 404
    assert "permission" not in str(exc.value.detail).lower()


# ── 7 · the body forbids unknown keys ────────────────────────────────────────────────────
def test_the_attach_body_rejects_an_unknown_key():
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        workspace.WorkspaceConnectionAttachRequest(
            connection_id="conn-1", file_id="cf-1", folder_id="f-1"
        )


def test_the_attach_body_carries_no_folder_destination():
    """⛔ A `folder_id` on THIS body would be a Library shape on a thread-scoped door."""
    assert "folder_id" not in workspace.WorkspaceConnectionAttachRequest.model_fields
    assert set(workspace.WorkspaceConnectionAttachRequest.model_fields) == {
        "connection_id",
        "file_id",
    }


assert sys.modules  # keep the import used; the module list is read by the source fences above

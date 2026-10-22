"""Phase 291 (AUTH-02, plan 291-01 Task 3) — the doors.

  * ``POST /workflows/describe/read`` — STATELESS: bytes in, the read arm out. It injects no
    Supabase client, no pool, no definition id and no asset path, so the cross-tenant class
    ``260814-q5r`` had to guard against has nothing to attach to (the 193.1 shape, D-06).
  * ``POST /workflows/{id}/template`` — widened: a fillable ``.pdf`` binds as-is, and a Word
    document with ticked ``anchors`` binds as a server-made fillable COPY (D-25, D-26).
  * ``POST /workflows/{id}/reference`` — stores a reference file with the draft (D-05).
  * ``GET /workflows/{id}/template/placeholders`` — a ``.pdf`` asset re-reads its AcroForm
    field names through the ONE reader.

Handlers are called directly (the ``test_193_1`` / ``test_193`` harness shapes): fully
offline, no Postgres, no Storage, no network, no ``TestClient``.
"""

from __future__ import annotations

import ast
import inspect
import io
import json
import zipfile
from pathlib import Path
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from tests.unit.test_291_describe_read import _acro_pdf, _docx, _text_pdf
from tests.unit.test_291_word_copy import _blanks_docx

_USER_ID = "3f2b0a11-1111-4c1e-9a00-00000000beef"
_OTHER_ID = "9c8d7e66-2222-4b3a-8f00-00000000cafe"
_SETTINGS_STUB = object()


# ── Fakes ─────────────────────────────────────────────────────────────────────
class _StubUpload:
    def __init__(self, filename, data=b"", size=None, explode_on_read=False) -> None:
        self.filename = filename
        self.size = len(data) if size is None else size
        self._data = data
        self._explode = explode_on_read
        self.read_calls = 0

    async def read(self) -> bytes:
        self.read_calls += 1
        if self._explode:
            raise AssertionError("route read the body despite an oversized declared part size")
        return self._data


class _FakeBucket:
    def __init__(self, blobs: dict | None = None) -> None:
        self.uploads: list[tuple[str, bytes, dict]] = []
        self.blobs = blobs or {}

    def upload(self, path, content, opts=None):
        self.uploads.append((path, content, opts or {}))
        return {"path": path}

    def download(self, path):
        return self.blobs[path]


class _FakeStorage:
    def __init__(self, bucket) -> None:
        self._bucket = bucket

    def from_(self, bucket_id):
        return self._bucket


class _FakeSupabase:
    def __init__(self, blobs: dict | None = None) -> None:
        self.bucket = _FakeBucket(blobs)
        self.storage = _FakeStorage(self.bucket)


class _FakePool:
    def __init__(self, row) -> None:
        self._row = row

    async def fetchrow(self, query, *args):
        return self._row


@pytest.fixture(autouse=True)
def _no_db_settings(monkeypatch):
    """The read door's settings read is a global cached app-settings read; stub it."""
    from app.api import workflow_authoring_doors as doors

    monkeypatch.setattr(
        doors, "load_user_settings", lambda user_id, supabase=None: _SETTINGS_STUB, raising=False
    )


async def _read(upload, role="form"):
    from app.api import workflows as wf_api

    return await wf_api.read_describe_file(file=upload, role=role, current_user={"id": _USER_ID})


def _owned(fn_name, **kwargs):
    from app.api import workflows as wf_api

    pool = _FakePool(kwargs.pop("owner_row", {"slug": "w"}))

    async def _go():
        with patch("app.api.workflow_authoring_doors.get_pg_pool", AsyncMock(return_value=pool)):
            return await getattr(wf_api, fn_name)(**kwargs)

    return _go()


def _zip_bomb(uncompressed: int) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types/>')
        zf.writestr("word/document.xml", b"\x00" * uncompressed)
    return buf.getvalue()


# ── 1. The stateless read door ────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_fillable_pdf_reads_form_fields(monkeypatch):
    from app.services import describe_files as df

    async def _fake_propose(text, candidates, *, user_id, settings):
        return [{"key": "ref_code", "label": "Reference code", "type": "text"}]

    monkeypatch.setattr(df, "propose_fields_via_model", _fake_propose)
    res = await _read(_StubUpload("vendor-form.pdf", _acro_pdf()))
    assert res.arm == "form_fields"
    assert res.role == "form"
    by = {f.key: f for f in res.fields}
    assert by["agree"].type == "enum" and by["agree"].enum_options == ["yes", "no"]
    # The async proposer was reached from the worker thread (label for the label-less field).
    assert by["ref_code"].label == "Reference code"
    assert res.filename == "vendor-form.pdf"


@pytest.mark.asyncio
async def test_docx_with_tokens_reads_template_fields():
    res = await _read(_StubUpload("letter.docx", _docx(["Dear {{ client_name }},"])))
    assert res.arm == "template_fields"
    assert [f.key for f in res.fields] == ["client_name"]


@pytest.mark.asyncio
async def test_reference_markdown_reads_as_reference():
    res = await _read(_StubUpload("notes.md", b"# Pricing\nFixed fee."), role="reference")
    assert res.role == "reference" and res.arm == "reference"
    assert "Fixed fee." in res.text


@pytest.mark.asyncio
async def test_flat_pdf_with_no_proposal_is_none_not_an_error(monkeypatch):
    from app.services import describe_files as df

    async def _nothing(text, candidates, *, user_id, settings):
        return []

    monkeypatch.setattr(df, "propose_fields_via_model", _nothing)
    res = await _read(_StubUpload("terms.pdf", _text_pdf()))
    assert res.arm == "none"


# ── 2. The gate ladder ────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_oversized_declared_size_refused_before_read():
    from app.services.workspace_service import MAX_FILE_SIZE

    up = _StubUpload("huge.pdf", b"", size=MAX_FILE_SIZE + 1, explode_on_read=True)
    with pytest.raises(HTTPException) as exc:
        await _read(up)
    assert exc.value.status_code == 422
    assert up.read_calls == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["logo.png", "archive.zip", "noext", "script.py"])
async def test_extension_outside_the_describe_set_is_422(name):
    up = _StubUpload(name, b"whatever")
    with pytest.raises(HTTPException) as exc:
        await _read(up)
    assert exc.value.status_code == 422
    assert up.read_calls == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("name,fixture", [("deck.pptx", "valid_pptx_bytes"), ("book.xlsx", "valid_xlsx_bytes")])
async def test_reference_refuses_pptx_and_xlsx(name, fixture, request):
    with pytest.raises(HTTPException) as exc:
        await _read(_StubUpload(name, request.getfixturevalue(fixture)), role="reference")
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_empty_body_is_422():
    with pytest.raises(HTTPException) as exc:
        await _read(_StubUpload("empty.pdf", b""))
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_pdf_that_is_a_zip_is_refused_by_magic_bytes(valid_docx_bytes):
    with pytest.raises(HTTPException) as exc:
        await _read(_StubUpload("fake.pdf", valid_docx_bytes))
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_zip_bomb_docx_is_422():
    from app.api.workflow_wire import _TEMPLATE_MAX_UNCOMPRESSED_BYTES

    with pytest.raises(HTTPException) as exc:
        await _read(_StubUpload("bomb.docx", _zip_bomb(_TEMPLATE_MAX_UNCOMPRESSED_BYTES + 1)))
    assert exc.value.status_code == 422
    assert str(_TEMPLATE_MAX_UNCOMPRESSED_BYTES // (1024 * 1024)) in exc.value.detail


@pytest.mark.asyncio
async def test_a_valid_pdf_is_not_refused_by_the_zip_cap(monkeypatch):
    from app.services import describe_files as df

    async def _nothing(text, candidates, *, user_id, settings):
        return []

    monkeypatch.setattr(df, "propose_fields_via_model", _nothing)
    res = await _read(_StubUpload("terms.pdf", _text_pdf()))
    assert res.arm in {"none", "suggested_fields"}


@pytest.mark.asyncio
async def test_unparseable_body_is_422_and_never_arm_none():
    with pytest.raises(HTTPException) as exc:
        await _read(_StubUpload("broken.pdf", b"%PDF-1.4 this is not a pdf body"))
    assert exc.value.status_code == 422
    assert exc.value.detail == "The document could not be read."


@pytest.mark.asyncio
async def test_echoed_filename_is_server_sanitised(monkeypatch):
    from app.services import describe_files as df

    async def _nothing(text, candidates, *, user_id, settings):
        return []

    monkeypatch.setattr(df, "propose_fields_via_model", _nothing)
    res = await _read(_StubUpload("../evil<script>.pdf", _text_pdf()))
    assert "/" not in res.filename and "\\" not in res.filename
    assert "<" not in res.filename and ">" not in res.filename
    assert res.filename.endswith(".pdf")


# ── 3. The no-client fence (+ positive control) ───────────────────────────────
_FORBIDDEN_IN_HANDLER = (
    "get_user_supabase_client",
    "get_supabase",
    "get_pg_pool",
    "_owned_slug_or_404",
    "_coerce_user_id",
    "definition_id",
    "asset_id",
)


def _code_without_prose(fn) -> str:
    import textwrap

    node = ast.parse(textwrap.dedent(inspect.getsource(fn))).body[0]
    if ast.get_docstring(node) is not None:
        node.body = node.body[1:]
    return ast.unparse(node)


def test_read_door_injects_no_client_no_pool_no_path():
    from app.api import workflows as wf_api

    params = set(inspect.signature(wf_api.read_describe_file).parameters)
    assert params == {"file", "role", "current_user"}, params
    code = _code_without_prose(wf_api.read_describe_file)
    for forbidden in _FORBIDDEN_IN_HANDLER:
        assert forbidden not in code, forbidden


def test_the_no_client_fence_can_actually_fire():
    async def _planted(file, role, current_user):
        """A docblock naming get_pg_pool is prose."""
        pool = await get_pg_pool()  # noqa: F821
        return pool, definition_id  # noqa: F821

    code = _code_without_prose(_planted)
    assert "get_pg_pool" in code and "definition_id" in code
    assert "docblock" not in code


# ── 4. The template door, widened ─────────────────────────────────────────────
@pytest.mark.asyncio
async def test_template_door_accepts_a_fillable_pdf():
    sb = _FakeSupabase()
    did = uuid4()
    ref = await _owned(
        "upload_workflow_template",
        definition_id=did,
        file=_StubUpload("vendor-form.pdf", _acro_pdf()),
        current_user={"id": _USER_ID},
        supabase=sb,
    )
    assert ref.kind == "template"
    assert ref.mime == "application/pdf"
    assert ref.asset_id.startswith(f"{_USER_ID}/_library/{did}/")
    assert sb.bucket.uploads[0][1] == _acro_pdf() or sb.bucket.uploads[0][1][:5] == b"%PDF-"


@pytest.mark.asyncio
async def test_template_door_with_anchors_stores_the_fillable_copy():
    from app.services.describe_files import count_token_occurrences
    from app.services.template_render_service import parse_docx_template_variables

    original = _blanks_docx()
    anchors = [
        {"key": "name", "anchor_kind": "line", "anchor_label": "Name"},
        {"key": "company", "anchor_kind": "cell", "anchor_label": "Company"},
    ]
    sb = _FakeSupabase()
    ref = await _owned(
        "upload_workflow_template",
        definition_id=uuid4(),
        file=_StubUpload("vendor-form.docx", original),
        anchors=json.dumps(anchors),
        current_user={"id": _USER_ID},
        supabase=sb,
    )
    stored = sb.bucket.uploads[0][1]
    assert stored != original
    assert set(parse_docx_template_variables(stored)["scalars"]) == {"name", "company"}
    assert count_token_occurrences(stored, "name") == 1
    assert ref.filename.endswith(".docx")


@pytest.mark.asyncio
async def test_anchors_on_a_pdf_are_refused():
    sb = _FakeSupabase()
    with pytest.raises(HTTPException) as exc:
        await _owned(
            "upload_workflow_template",
            definition_id=uuid4(),
            file=_StubUpload("vendor-form.pdf", _acro_pdf()),
            anchors=json.dumps([{"key": "x", "anchor_kind": "line", "anchor_label": "X"}]),
            current_user={"id": _USER_ID},
            supabase=sb,
        )
    assert exc.value.status_code == 422
    assert sb.bucket.uploads == []


@pytest.mark.asyncio
@pytest.mark.parametrize("bad", ["not json", json.dumps({"key": "x"}), json.dumps([{"key": "x"}])])
async def test_invalid_anchors_json_is_422(bad):
    sb = _FakeSupabase()
    with pytest.raises(HTTPException) as exc:
        await _owned(
            "upload_workflow_template",
            definition_id=uuid4(),
            file=_StubUpload("vendor-form.docx", _blanks_docx()),
            anchors=bad,
            current_user={"id": _USER_ID},
            supabase=sb,
        )
    assert exc.value.status_code == 422
    assert sb.bucket.uploads == []


@pytest.mark.asyncio
async def test_anchors_that_place_nothing_are_refused_in_words():
    sb = _FakeSupabase()
    with pytest.raises(HTTPException) as exc:
        await _owned(
            "upload_workflow_template",
            definition_id=uuid4(),
            file=_StubUpload("vendor-form.docx", _blanks_docx()),
            anchors=json.dumps([{"key": "phone", "anchor_kind": "line", "anchor_label": "Phone"}]),
            current_user={"id": _USER_ID},
            supabase=sb,
        )
    assert exc.value.status_code == 422
    assert "Couldn't place" in exc.value.detail or "could be placed" in exc.value.detail
    assert sb.bucket.uploads == []


# ── 5. The reference door ─────────────────────────────────────────────────────
@pytest.mark.asyncio
@pytest.mark.parametrize(
    "name,builder",
    [("terms.pdf", _text_pdf), ("notes.md", lambda: b"# Notes\n"), ("brief.txt", lambda: b"brief\n")],
)
async def test_reference_door_stores_under_the_user_keyed_path(name, builder):
    sb = _FakeSupabase()
    did = uuid4()
    ref = await _owned(
        "upload_workflow_reference",
        definition_id=did,
        file=_StubUpload(name, builder()),
        current_user={"id": _USER_ID},
        supabase=sb,
    )
    assert ref.kind == "reference"
    assert ref.asset_id.startswith(f"{_USER_ID}/_library/{did}/")
    assert ref.asset_id.endswith(f"-{name}")
    assert sb.bucket.uploads[0][0] == ref.asset_id


@pytest.mark.asyncio
async def test_reference_door_stores_a_docx():
    sb = _FakeSupabase()
    ref = await _owned(
        "upload_workflow_reference",
        definition_id=uuid4(),
        file=_StubUpload("terms.docx", _docx(["Terms."])),
        current_user={"id": _USER_ID},
        supabase=sb,
    )
    assert ref.mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


@pytest.mark.asyncio
async def test_reference_door_is_owner_gated():
    sb = _FakeSupabase()
    with pytest.raises(HTTPException) as exc:
        await _owned(
            "upload_workflow_reference",
            owner_row=None,
            definition_id=uuid4(),
            file=_StubUpload("notes.md", b"# x"),
            current_user={"id": _OTHER_ID},
            supabase=sb,
        )
    assert exc.value.status_code == 404
    assert sb.bucket.uploads == []


@pytest.mark.asyncio
async def test_reference_door_refuses_pptx(valid_pptx_bytes):
    sb = _FakeSupabase()
    with pytest.raises(HTTPException) as exc:
        await _owned(
            "upload_workflow_reference",
            definition_id=uuid4(),
            file=_StubUpload("deck.pptx", valid_pptx_bytes),
            current_user={"id": _USER_ID},
            supabase=sb,
        )
    assert exc.value.status_code == 422


# ── 6. The owner-gated re-read gains a pdf arm ────────────────────────────────
@pytest.mark.asyncio
async def test_pdf_asset_rereads_acroform_names_in_document_order():
    did = uuid4()
    path = f"{_USER_ID}/_library/{did}/abcd1234-vendor-form.pdf"
    sb = _FakeSupabase({path: _acro_pdf()})
    res = await _owned(
        "get_workflow_template_placeholders",
        definition_id=did,
        asset_id=path,
        current_user={"id": _USER_ID},
        supabase=sb,
    )
    assert res.read == "ok"
    assert res.placeholders == ["full_name", "company", "agree", "country", "colour", "payment", "ref_code"]


@pytest.mark.asyncio
async def test_pdf_asset_that_cannot_be_downloaded_is_unreadable():
    did = uuid4()
    path = f"{_USER_ID}/_library/{did}/abcd1234-missing.pdf"
    res = await _owned(
        "get_workflow_template_placeholders",
        definition_id=did,
        asset_id=path,
        current_user={"id": _USER_ID},
        supabase=_FakeSupabase({}),
    )
    assert res.read == "unreadable"


# ── 7. Registration ───────────────────────────────────────────────────────────
def _routes(path_suffix: str):
    from app.api import workflows as wf_api

    target = f"{wf_api.router.prefix}{path_suffix}"
    return target, [r for r in wf_api.router.routes if r.path == target]


def _closure_features(route) -> list[str]:
    out: list[str] = []
    for dep in route.dependant.dependencies:
        for c in getattr(dep.call, "__closure__", None) or ():
            if isinstance(c.cell_contents, str):
                out.append(c.cell_contents)
    return out


@pytest.mark.parametrize("suffix", ["/describe/read", "/{definition_id}/reference"])
def test_new_routes_carry_the_authoring_and_capability_gates(suffix):
    _target, hits = _routes(suffix)
    assert len(hits) == 1
    feats = _closure_features(hits[0])
    assert "workflow_authoring" in feats and "workflows" in feats, feats
    assert hits[0].methods == {"POST"}


def test_describe_read_is_not_shadowed_and_precedes_every_definition_id_route():
    from starlette.routing import compile_path

    from app.api import workflows as wf_api

    target, hits = _routes("/describe/read")
    assert len(hits) == 1
    paths = [r.path for r in wf_api.router.routes]
    for route in wf_api.router.routes:
        if route.path == target:
            continue
        regex, _fmt, _conv = compile_path(route.path)
        assert regex.match(target) is None, route.path
    first_param = next(i for i, p in enumerate(paths) if "{definition_id}" in p)
    assert paths.index(target) < first_param


def test_new_handlers_are_defined_once_and_registered_once():
    """AST pin for the 291 handlers — kept HERE, not in test_286's 25-symbol move set."""
    api = Path(__file__).resolve().parents[2] / "app" / "api"
    doors = ast.parse((api / "workflow_authoring_doors.py").read_text(encoding="utf-8"))
    wf = ast.parse((api / "workflows.py").read_text(encoding="utf-8"))
    for handler, path in (("read_describe_file", "/describe/read"), ("upload_workflow_reference", "/{definition_id}/reference")):
        defs = [n for n in doors.body if isinstance(n, ast.AsyncFunctionDef) and n.name == handler]
        assert len(defs) == 1 and not defs[0].decorator_list, handler
        regs = [
            s for s in wf.body
            if isinstance(s, ast.Expr)
            and isinstance(s.value, ast.Call)
            and isinstance(s.value.func, ast.Call)
            and len(s.value.args) == 1
            and isinstance(s.value.args[0], ast.Name)
            and s.value.args[0].id == handler
        ]
        assert len(regs) == 1, handler
        call = regs[0].value.func
        assert isinstance(call.func, ast.Attribute) and call.func.attr == "post"
        assert isinstance(call.args[0], ast.Constant) and call.args[0].value == path

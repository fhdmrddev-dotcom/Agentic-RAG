"""Phase 193 (AUTH-03, corrected wording) — author-time template binding.

THE GAP THIS CLOSES. ``resolve_template_source`` Branch 1
(``template_asset_service.py:145-180``) has always been able to CONSUME a library
``asset_ref`` — ``{asset_id, filename, mime}`` pointing at a Storage path in the
``workspace-files`` bucket — and route those bytes down the TRUSTED docxtpl/Jinja
path (``provenance="library"``). Nothing could ever PRODUCE one: the 10 published
workflows that bind a template were all seeded straight into the DB, and
``WorkflowBuilderPage.tsx:667`` only READS ``assets.find(a => a.kind === "template")``
to display a filename. ``POST /workflows/{definition_id}/template`` is the missing
producer for a consumer that already exists.

Fully OFFLINE — no Postgres, no network, no Storage. The route function is called
DIRECTLY with a fake pool + a fake supabase client (the ``test_103_published_409``
mock-only precedent at :227), so these run in any CI, including one with no local
stack. That matters: the 404-not-403 case below is the endpoint's only authorization
boundary, and a guard that skips when the database is down is not a guard.

What is pinned here:
  * a ``.docx`` yields the FOUR-key AssetRef descriptor and really reaches Storage,
    at ``{user_id}/_library/{definition_id}/{uuid8}-{safe_name}`` in ``workspace-files``;
  * a non-owner gets **404, never 403** (no existence oracle) and NOTHING is persisted;
  * ``.png`` / ``.txt`` — legal for the wider skill-asset door at ``POST
    /threads/{id}/workspace/files``, ILLEGAL here — are refused 422 with nothing
    persisted (a template is a document to FILL);
  * a renamed binary carrying a ``.docx`` name is refused by the magic-byte gate;
  * an oversized DECLARED part size is refused BEFORE the body is read (the WR-04
    guard — the stub's ``read()`` raises if the route ever reaches it);
  * ordinary filenames (``Q3 Report (final).docx``) survive sanitisation, and a
    traversal attempt cannot escape the user-keyed prefix.
"""

from __future__ import annotations

import re
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

_OWNER_ID = "3f2b0a11-1111-4c1e-9a00-00000000beef"
_OTHER_ID = "9c8d7e66-2222-4b3a-8f00-00000000cafe"


# ── Fakes ─────────────────────────────────────────────────────────────────────
class _FakeBucket:
    """Records every ``upload`` so "nothing was persisted" is an OBSERVATION."""

    def __init__(self) -> None:
        self.uploads: list[tuple[str, bytes, dict]] = []

    def upload(self, path, content, opts=None):  # noqa: D102 — supabase-py shape
        self.uploads.append((path, content, opts or {}))
        return {"path": path}


class _FakeStorage:
    def __init__(self, bucket: _FakeBucket) -> None:
        self._bucket = bucket
        self.buckets_asked: list[str] = []

    def from_(self, bucket_id: str) -> _FakeBucket:
        self.buckets_asked.append(bucket_id)
        return self._bucket


class _FakeSupabase:
    def __init__(self) -> None:
        self.bucket = _FakeBucket()
        self.storage = _FakeStorage(self.bucket)


class _FakePool:
    """``_owned_slug_or_404`` issues exactly one owner-scoped ``fetchrow``."""

    def __init__(self, row: dict | None) -> None:
        self._row = row
        self.calls: list[tuple[str, tuple]] = []

    async def fetchrow(self, query: str, *args):
        self.calls.append((query, args))
        return self._row


class _StubUpload:
    """A minimal ``UploadFile`` stand-in.

    ``explode_on_read`` is the load-bearing bit for the WR-04 case: if the route
    materialises the body despite an oversized DECLARED size, the read RAISES, so
    the test cannot pass by accident.
    """

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


#: Sentinel so ``owner_row=None`` means "the owner-gate finds NOTHING" rather than
#: "use the default" — the non-owner test is the endpoint's only authorization proof and
#: an ``is not None`` default would have silently handed it an OWNED row (observed).
_DEFAULT = object()


def _run(upload, *, owner_row=_DEFAULT, user_id: str = _OWNER_ID,
         definition_id=None, supabase=None):
    """Call the route directly against fakes; returns (coroutine-result, pool, supabase)."""
    from app.api import workflows as wf_api

    pool = _FakePool({"slug": "some-workflow"} if owner_row is _DEFAULT else owner_row)
    sb = supabase or _FakeSupabase()
    definition_id = definition_id or uuid4()

    async def _go():
        with patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=pool)):
            return await wf_api.upload_workflow_template(
                definition_id=definition_id,
                file=upload,
                current_user={"id": user_id},
                supabase=sb,
            )

    return _go(), pool, sb, definition_id


# ── 1. The happy path: descriptor + the object really lands in Storage ────────
@pytest.mark.asyncio
async def test_docx_returns_four_key_descriptor_and_persists_to_storage(valid_docx_bytes):
    from app.services.workspace_service import BUCKET_NAME

    up = _StubUpload("Q3 Report (final).docx", valid_docx_bytes)
    coro, pool, sb, definition_id = _run(up)
    result = await coro

    # The wire shape ``resolve_template_source`` Branch 1 consumes (AssetRef).
    payload = result.model_dump() if hasattr(result, "model_dump") else dict(result)
    assert set(payload) == {"kind", "asset_id", "filename", "mime"}
    assert payload["kind"] == "template"
    # ORDINARY NAMES DO NOT 422 — that is the WR-05 contract, and it is NOT the same as
    # "survive verbatim". The shipped sanitiser's charset is ``[a-zA-Z0-9._\- ]``, so the
    # parentheses become ``_``. Asserted as MEASURED rather than as assumed: the first
    # draft of this test expected the parentheses back and failed for exactly this reason.
    assert payload["filename"] == "Q3 Report _final_.docx"
    assert payload["mime"] == (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )

    # The object really exists in Storage, in the right bucket, at the user-keyed path.
    assert sb.storage.buckets_asked == [BUCKET_NAME]
    assert len(sb.bucket.uploads) == 1
    path, content, opts = sb.bucket.uploads[0]
    assert path == payload["asset_id"]
    assert content == valid_docx_bytes
    assert opts.get("content-type") == payload["mime"]
    assert re.fullmatch(
        rf"{_OWNER_ID}/_library/{definition_id}/[0-9a-f]{{8}}-Q3 Report _final_\.docx",
        path,
    ), path

    # The owner-gate ran, owner-scoped, exactly once.
    assert len(pool.calls) == 1
    assert "created_by" in pool.calls[0][0]


@pytest.mark.asyncio
@pytest.mark.parametrize("name,fixture", [("t.pptx", "valid_pptx_bytes"),
                                          ("t.xlsx", "valid_xlsx_bytes")])
async def test_pptx_and_xlsx_are_accepted(name, fixture, request):
    data = request.getfixturevalue(fixture)
    coro, _pool, sb, _ = _run(_StubUpload(name, data))
    result = await coro
    assert result.kind == "template"
    assert len(sb.bucket.uploads) == 1


@pytest.mark.asyncio
async def test_descriptor_round_trips_into_a_workflow_definition(valid_docx_bytes):
    """THE CONTRACT WITH PIECE 2. ``WorkflowDefinition`` is ``extra='forbid'``, so the
    Builder can only write this object into ``definition.assets[]`` if it validates
    field-for-field as an ``AssetRef``. Proven by actually validating one, not by
    eyeballing the two class bodies."""
    from app.models.harness import AssetRef, WorkflowDefinition

    coro, _pool, _sb, _ = _run(_StubUpload("brief.docx", valid_docx_bytes))
    payload = (await coro).model_dump()

    AssetRef.model_validate(payload)  # the exact shape Branch 1 reads
    wf = WorkflowDefinition.model_validate(
        {"slug": "s", "version": 1, "name": "N", "phases": [], "assets": [payload]}
    )
    bound = wf.assets[0]
    assert bound.kind == "template"
    assert bound.asset_id == payload["asset_id"]


# ── 2. Authorization: a non-owner gets 404, NEVER 403, and nothing persists ───
@pytest.mark.asyncio
async def test_non_owner_gets_404_and_nothing_persisted(valid_docx_bytes):
    """The owner-scoped ``created_by`` WHERE is the ONLY authorization boundary here
    (the workflow cluster reads through a service-role pool, which bypasses RLS).
    A non-owner and an unknown id MUST be byte-identical — a 403 would confirm the
    workflow exists (the ``_owned_slug_or_404`` no-existence-leak precedent)."""
    up = _StubUpload("steal.docx", valid_docx_bytes)
    coro, _pool, sb, _ = _run(up, owner_row=None, user_id=_OTHER_ID)
    with pytest.raises(HTTPException) as exc:
        await coro
    assert exc.value.status_code == 404
    assert exc.value.status_code != 403
    assert sb.bucket.uploads == []  # nothing persisted


# ── 3. The type door: OOXML only, refused before anything is persisted ───────
@pytest.mark.asyncio
@pytest.mark.parametrize(
    "name,data",
    [
        ("logo.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 32),  # valid PNG, still refused
        ("notes.txt", b"plain text\n"),
        ("script.py", b"print('hi')\n"),
        ("run.sh", b"#!/bin/sh\n"),
        ("archive.zip", b"PK\x03\x04"),
        ("noext", b"whatever"),
    ],
)
async def test_non_ooxml_refused_422_and_nothing_persisted(name, data):
    """These all PASS the wider ``validate_upload`` allowlist used by the chat-time
    skill-asset door. A workflow template is a document to FILL, so this endpoint
    narrows to ``.docx/.pptx/.xlsx`` only — images and scripts must never reach the
    trusted docxtpl/Jinja render path."""
    coro, _pool, sb, _ = _run(_StubUpload(name, data))
    with pytest.raises(HTTPException) as exc:
        await coro
    assert exc.value.status_code == 422
    assert sb.bucket.uploads == []


@pytest.mark.asyncio
async def test_renamed_binary_named_docx_refused_422(renamed_binary_bytes):
    """The magic-byte gate: an ``MZ`` PE header wearing a ``.docx`` name is not a ZIP
    container, so ``validate_upload``'s OOXML branch refuses it (nothing persisted)."""
    coro, _pool, sb, _ = _run(_StubUpload("payload.docx", renamed_binary_bytes))
    with pytest.raises(HTTPException) as exc:
        await coro
    assert exc.value.status_code == 422
    assert sb.bucket.uploads == []


@pytest.mark.asyncio
async def test_empty_file_refused_422():
    coro, _pool, sb, _ = _run(_StubUpload("empty.docx", b""))
    with pytest.raises(HTTPException) as exc:
        await coro
    assert exc.value.status_code == 422
    assert sb.bucket.uploads == []


# ── 4. WR-04: the DECLARED part size is refused before the body is materialised ─
@pytest.mark.asyncio
async def test_oversized_declared_size_refused_before_body_is_read():
    """uvicorn/FastAPI impose no body cap, so ``.read()`` of a multi-GB part would
    buffer it all in RAM. The stub RAISES on read, so this can only pass if the route
    refuses on ``file.size`` first."""
    from app.services.workspace_service import MAX_FILE_SIZE

    up = _StubUpload("huge.docx", b"", size=MAX_FILE_SIZE + 1, explode_on_read=True)
    coro, _pool, sb, _ = _run(up)
    with pytest.raises(HTTPException) as exc:
        await coro
    assert exc.value.status_code == 422
    assert up.read_calls == 0
    assert sb.bucket.uploads == []


@pytest.mark.asyncio
async def test_oversized_actual_body_refused_even_when_size_lies():
    """A lying/absent declared size does not get past the post-read guard."""
    from app.services.workspace_service import MAX_FILE_SIZE

    up = _StubUpload("huge.docx", b"x" * (MAX_FILE_SIZE + 1), size=None)
    up.size = None  # the "declared size unknown" shape
    coro, _pool, sb, _ = _run(up)
    with pytest.raises(HTTPException) as exc:
        await coro
    assert exc.value.status_code == 422
    assert sb.bucket.uploads == []


# ── 5. The storage path cannot escape the user-keyed prefix ───────────────────
@pytest.mark.asyncio
async def test_traversal_filename_cannot_escape_the_user_prefix(valid_docx_bytes):
    """``/`` and ``..`` are sanitised out of the stored name (the WR-05 fix), so the
    object can only ever land under ``{user_id}/_library/{definition_id}/``."""
    coro, _pool, sb, definition_id = _run(
        _StubUpload("../../../../etc/passwd.docx", valid_docx_bytes)
    )
    result = await coro
    prefix = f"{_OWNER_ID}/_library/{definition_id}/"
    assert result.asset_id.startswith(prefix)
    assert ".." not in result.asset_id
    assert "/" not in result.asset_id[len(prefix):]
    assert sb.bucket.uploads[0][0] == result.asset_id

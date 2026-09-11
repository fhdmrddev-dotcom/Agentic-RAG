"""Phase 244 Plan 02 Task 1 (SHELL-04 / D-244-24) — `.pdf` joins the attachment door.

⛔ **THE RULING, not a discovery.** `_ALLOWED_EXT` (`backend/app/api/workspace.py:124-130`) was
FIFTEEN extensions — 3 OOXML ∪ 7 text ∪ 5 image — with **no PDF**, and sketch 236's own finding is
that *"a signed contract PDF is the likeliest first thing anyone attaches."* D-244-24 rules that
`.pdf` IS TAKEN, with its own category and its own container validator:

  * adding `.pdf` to `_TEXT_EXT` is WRONG — a PDF is a NUL-bearing binary and would fail
    `_looks_like_text`;
  * adding it bare to `_ALLOWED_EXT` is ALSO wrong — it falls through the three category branches
    to the belt-and-braces 422 at the bottom of `validate_upload`, which was unreachable before.

⚠ **THE SENTENCES ARE THE DELIVERABLE, NOT THE STATUS CODES.** Sketch 236 draws the refusal, and
`COPY.js` § `COPY.engine` carries the server's three refusal sentences so the mockup and the build
cannot disagree. This module therefore **parses `COPY.js` itself** rather than re-typing its
strings: a fence that hard-codes the sentence it is pinning cannot see the sketch rot away from the
server. Both sides move or the fence goes red (S-4 — the server's verbatim sentence, never a
paraphrase).

⚠ CRLF tolerance throughout: source files check out with Windows line endings on this box, so every
pattern uses `[\\s\\S]` / `\\r?\\n` rather than a bare `\\n`.

Fully OFFLINE — `validate_upload` is a pure function, and the empty-body case drives the route
handler directly with a stub upload + a patched ownership check (the `test_193_workflow_template_upload`
mock-only precedent). ⛔ No Postgres, no Storage, no network: worktrees isolate files, not Postgres.
"""

from __future__ import annotations

import re
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from app.api.workspace import _ALLOWED_EXT, upload_template, validate_upload
from app.services.workspace_service import MAX_FILE_SIZE


# ── COPY.js, parsed rather than re-typed ──────────────────────────────────────
_COPY_JS = (
    Path(__file__).resolve().parents[3]
    / ".planning"
    / "sketches"
    / "236-the-file-that-belongs-to-this-chat"
    / "COPY.js"
)


def _copy_source() -> str:
    assert _COPY_JS.is_file(), f"sketch COPY.js missing at {_COPY_JS} — the acceptance bar is gone"
    return _COPY_JS.read_text(encoding="utf-8")


def _copy_engine_allowed_ext() -> list[str]:
    """`COPY.engine.ALLOWED_EXT` — the sketch's copy of the server's allow-list."""
    src = _copy_source()
    m = re.search(r"ALLOWED_EXT:\s*\[([\s\S]*?)\]", src)
    assert m, "COPY.engine.ALLOWED_EXT not found in COPY.js"
    return re.findall(r'"(\.[a-z0-9]+)"', m.group(1))


def _copy_engine_string(name: str) -> str:
    """A plain string member of `COPY.engine` (e.g. REFUSE_SIZE / REFUSE_EMPTY)."""
    src = _copy_source()
    m = re.search(rf'{name}:\s*"((?:[^"\\]|\\.)*)"', src)
    assert m, f"COPY.engine.{name} not found in COPY.js"
    return m.group(1)


def _copy_engine_refuse_type(ext: str, allowed: str) -> str:
    """Evaluate `COPY.engine.REFUSE_TYPE(ext, allowed)` from its template literal in COPY.js.

    ⛔ The template is read from the sketch, never re-typed here — that is what makes this a
    pin on the sketch rather than a second hand-typed copy of the same sentence.
    """
    src = _copy_source()
    m = re.search(r"REFUSE_TYPE:\s*\([^)]*\)\s*=>\s*`([^`]*)`", src)
    assert m, "COPY.engine.REFUSE_TYPE not found in COPY.js"
    tmpl = m.group(1)
    rendered = tmpl.replace('${ext || "(none)"}', ext or "(none)").replace("${allowed}", allowed)
    assert "${" not in rendered, f"unsubstituted placeholder in REFUSE_TYPE: {rendered!r}"
    return rendered


def _pdf_bytes(body: bytes = b"\n1 0 obj\n<<>>\nendobj\n%%EOF\n") -> bytes:
    return b"%PDF-1.7" + body


# ── Test 1 — the door ACCEPTS a real PDF ──────────────────────────────────────
def test_accepts_pdf_with_real_magic_bytes():
    assert validate_upload("Meridian-contract.pdf", _pdf_bytes()) == ".pdf"


def test_pdf_is_in_the_allowlist():
    assert ".pdf" in _ALLOWED_EXT


# ── Test 2 — a renamed binary does NOT ride in on the extension ───────────────
@pytest.mark.parametrize(
    "payload",
    [
        b"MZ\x90\x00\x03\x00\x00\x00",  # a Windows PE, renamed
        b"PK\x03\x04" + b"\x00" * 32,  # a ZIP, renamed
        b"not a pdf at all, just text",
        b"",  # empty body never satisfies the container check
        b"%PDF",  # one byte short of the marker
    ],
)
def test_refuses_pdf_whose_bytes_lie(payload):
    with pytest.raises(HTTPException) as exc:
        validate_upload("totally-a-contract.pdf", payload)
    assert exc.value.status_code == 422
    # The sentence must NAME the type — a bare "invalid file" tells the person nothing.
    assert ".pdf" in str(exc.value.detail)
    # ⛔ AND IT MUST BE THE CONTAINER CHECK TALKING, NOT THE ALLOW-LIST GATE. Without this
    # conjunct the case passed VACUOUSLY before `.pdf` was accepted at all — every payload was
    # refused as an unsupported TYPE, which proves nothing about the magic-byte fence.
    assert "Unsupported type" not in str(exc.value.detail)


# ── Test 3 — the unsupported-type sentence is byte-identical to COPY.engine ───
def test_unsupported_type_sentence_is_byte_identical_to_copy_engine():
    allowed = ", ".join(sorted(_ALLOWED_EXT))
    with pytest.raises(HTTPException) as exc:
        validate_upload("payload.exe", b"MZ\x90\x00")
    assert exc.value.status_code == 422
    assert exc.value.detail == _copy_engine_refuse_type(".exe", allowed)


def test_unsupported_type_sentence_with_no_extension():
    allowed = ", ".join(sorted(_ALLOWED_EXT))
    with pytest.raises(HTTPException) as exc:
        validate_upload("README", b"hello")
    assert exc.value.detail == _copy_engine_refuse_type("", allowed)


def test_the_allowlist_in_the_refusal_sentence_now_contains_pdf():
    with pytest.raises(HTTPException) as exc:
        validate_upload("payload.exe", b"MZ\x90\x00")
    assert ".pdf" in str(exc.value.detail)


def test_copy_engine_allowlist_and_the_server_agree_element_for_element():
    """⛔ The sketch is the acceptance bar; a stale bar is worse than none (D-244-22)."""
    assert sorted(_copy_engine_allowed_ext()) == sorted(_ALLOWED_EXT)


# ── Test 4 — the size and empty refusals, by SENTENCE ─────────────────────────
def test_oversize_pdf_is_refused_with_the_copy_engine_sentence():
    oversized = _pdf_bytes() + b"\x00" * (MAX_FILE_SIZE + 1)
    with pytest.raises(HTTPException) as exc:
        validate_upload("huge.pdf", oversized)
    assert exc.value.status_code == 422
    assert exc.value.detail == _copy_engine_string("REFUSE_SIZE")


class _StubUpload:
    """The minimal `UploadFile` surface `upload_template` touches."""

    def __init__(self, filename: str, body: bytes, *, size: int | None = None) -> None:
        self.filename = filename
        self._body = body
        self.size = len(body) if size is None else size

    async def read(self) -> bytes:
        return self._body


@pytest.mark.asyncio
async def test_empty_pdf_is_refused_with_the_copy_engine_sentence():
    """The empty check lives in the ROUTE, not the validator — drive the route.

    ⛔ Nothing is persisted: the refusal fires before `ws_write_file` is reached, and no DB or
    Storage double is supplied, so any write attempt would raise rather than pass silently.
    """
    with patch("app.api.workspace._verify_thread_ownership", new=AsyncMock(return_value=None)):
        with pytest.raises(HTTPException) as exc:
            await upload_template(
                thread_id="11111111-1111-4111-8111-111111111111",
                request=object(),
                file=_StubUpload("contract.pdf", b""),
                current_user={"id": "22222222-2222-4222-8222-222222222222"},
                supabase=object(),
            )
    assert exc.value.status_code == 422
    assert exc.value.detail == _copy_engine_string("REFUSE_EMPTY")


@pytest.mark.asyncio
async def test_declared_oversize_pdf_is_refused_before_the_body_is_read():
    """WR-04 — the declared part size trips before materialisation, for `.pdf` too."""

    class _ExplodingRead(_StubUpload):
        async def read(self) -> bytes:  # pragma: no cover - must never be reached
            raise AssertionError("body was materialised despite an oversize declared size")

    with patch("app.api.workspace._verify_thread_ownership", new=AsyncMock(return_value=None)):
        with pytest.raises(HTTPException) as exc:
            await upload_template(
                thread_id="11111111-1111-4111-8111-111111111111",
                request=object(),
                file=_ExplodingRead("huge.pdf", b"x", size=MAX_FILE_SIZE + 1),
                current_user={"id": "22222222-2222-4222-8222-222222222222"},
                supabase=object(),
            )
    assert exc.value.detail == _copy_engine_string("REFUSE_SIZE")


# ── The three shipped categories are UNTOUCHED by the widen ───────────────────
def test_existing_categories_still_validate(valid_docx_bytes):
    assert validate_upload("report.docx", valid_docx_bytes) == ".docx"
    assert validate_upload("notes.md", b"# hi\n") == ".md"
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
    assert validate_upload("logo.png", png) == ".png"

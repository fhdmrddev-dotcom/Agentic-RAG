"""Phase 151 Plan 03 (FILE-01 / SC#3, D-09) — widened upload allowlist tests.

Wave 0 (RED): these exercise the generalized ``validate_upload`` (the rename of
the OOXML-only ``validate_ooxml`` at ``workspace.py:119``). The validator does
not exist yet, so this module fails to import → RED confirmed.

The widen (D-09) lets a user hand the agent real skill assets mid-chat —
``.md/.json/.csv/.txt/.py/.js/.sh`` scripts + docs and ``.png/.jpg/.gif/.webp``
images — beyond the three OOXML types. The security invariants that MUST survive
the widen (T-02 threat register):

  * every new type is still magic-byte / content validated — a renamed binary
    (MZ EXE header) uploaded as ``.md`` / ``.png`` is refused (T-151-03-01);
  * the ``len(raw) > MAX_FILE_SIZE`` DoS guard trips BEFORE any parse for EVERY
    type, including the widened ones (T-151-03-02);
  * an unknown extension (``.exe``) is refused.

Reuses the Phase-100 conftest fixtures (``valid_docx_bytes`` :993,
``renamed_binary_bytes`` :1012, ``oversized_ooxml_bytes`` :1022); text/image
payloads are constructed inline.
"""
from __future__ import annotations

import pytest
from fastapi import HTTPException

# Module-level import → ImportError until Plan 03 Task 2 builds validate_upload (RED).
from app.api.workspace import validate_upload
from app.services.workspace_service import MAX_FILE_SIZE


# ── Accept: OOXML branch unchanged (the widen must not regress .docx) ──────────
def test_accepts_valid_docx(valid_docx_bytes):
    assert validate_upload("report.docx", valid_docx_bytes) == ".docx"


# ── Accept: text-ish skill assets (utf-8-decodable, no NUL) ────────────────────
@pytest.mark.parametrize(
    "name,payload,ext",
    [
        ("notes.md", b"# Heading\n\nsome *markdown* text\n", ".md"),
        ("data.json", b'{"key": "value", "n": 42}', ".json"),
        ("table.csv", b"a,b,c\n1,2,3\n", ".csv"),
        ("readme.txt", b"plain text file\n", ".txt"),
        ("script.py", b"def main():\n    print('hi')\n", ".py"),
        ("app.js", b"export const x = 1;\n", ".js"),
        ("run.sh", b"#!/bin/sh\necho hi\n", ".sh"),
    ],
)
def test_accepts_textish_types(name, payload, ext):
    assert validate_upload(name, payload) == ext


# ── Accept: images via leading magic bytes ─────────────────────────────────────
def test_accepts_png():
    png = b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\rIHDR" + b"\x00" * 32
    assert validate_upload("logo.png", png) == ".png"


def test_accepts_jpeg():
    jpg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01" + b"\x00" * 32
    assert validate_upload("photo.jpg", jpg) == ".jpg"


def test_accepts_jpeg_alt_ext():
    jpg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01" + b"\x00" * 32
    assert validate_upload("photo.jpeg", jpg) == ".jpeg"


def test_accepts_gif():
    gif = b"GIF89a" + b"\x01\x00\x01\x00" + b"\x00" * 32
    assert validate_upload("anim.gif", gif) == ".gif"


def test_accepts_webp():
    webp = b"RIFF" + b"\x24\x00\x00\x00" + b"WEBP" + b"VP8 " + b"\x00" * 32
    assert validate_upload("pic.webp", webp) == ".webp"


# ── Reject: renamed binary bypass (T-151-03-01 — magic-byte gate survives) ─────
def test_rejects_renamed_binary_as_md(renamed_binary_bytes):
    # MZ/PE header → not utf-8-decodable / NUL-heavy → refused as text.
    with pytest.raises(HTTPException) as exc:
        validate_upload("evil.md", renamed_binary_bytes)
    assert exc.value.status_code == 422


def test_rejects_renamed_binary_as_png(renamed_binary_bytes):
    # MZ header != \x89PNG leading magic → refused as image.
    with pytest.raises(HTTPException) as exc:
        validate_upload("evil.png", renamed_binary_bytes)
    assert exc.value.status_code == 422


def test_rejects_wrong_image_magic():
    # A utf-8-clean but non-PNG payload named .png must still fail the magic gate.
    with pytest.raises(HTTPException) as exc:
        validate_upload("fake.png", b"not really a png at all")
    assert exc.value.status_code == 422


# ── Reject: oversize DoS guard trips BEFORE parse for EVERY type (T-151-03-02) ──
def test_rejects_oversized_text():
    # Valid utf-8, otherwise-acceptable text — ONLY the size guard can reject it,
    # proving the DoS guard survives for the widened text types.
    big = b"a" * (MAX_FILE_SIZE + 1)
    with pytest.raises(HTTPException) as exc:
        validate_upload("big.md", big)
    assert exc.value.status_code == 422


def test_rejects_oversized_image():
    # Valid PNG leading magic, over the 10 MB cap → size guard trips first.
    big = b"\x89PNG\r\n\x1a\n" + b"\x00" * MAX_FILE_SIZE
    with pytest.raises(HTTPException) as exc:
        validate_upload("big.png", big)
    assert exc.value.status_code == 422


def test_rejects_oversized_ooxml(oversized_ooxml_bytes):
    # OOXML office-bomb guard preserved verbatim from validate_ooxml.
    with pytest.raises(HTTPException) as exc:
        validate_upload("huge.docx", oversized_ooxml_bytes)
    assert exc.value.status_code == 422


# ── Reject: unknown extension ──────────────────────────────────────────────────
def test_rejects_unknown_extension():
    with pytest.raises(HTTPException) as exc:
        validate_upload("evil.exe", b"MZ\x90\x00binary payload")
    assert exc.value.status_code == 422


def test_rejects_no_extension():
    with pytest.raises(HTTPException) as exc:
        validate_upload("noextfile", b"hello world")
    assert exc.value.status_code == 422

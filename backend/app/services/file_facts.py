"""File facts — what a PDF or DOCX says about itself (Phase 270 / FIND-05).

Pure parsing of bytes into four facts: page count, the date the FILE claims it was created, the date it
claims it was last modified, and the author it names.

Rules (D-01 / D-09 / D-10):
- ``None`` means *not recorded*. Never ``0`` for a page count and never a substituted date: a source date
  is never the upload date (that is ``documents.created_at``, a different fact).
- ``read_file_facts`` NEVER raises. Every property is read in its own ``try`` so one unreadable property
  does not take the others down; an outer ``try`` returns an empty ``FileFacts``.
- Naive PDF dates (no UTC offset) are treated as UTC (A4); aware dates are converted to UTC.
- Hostile input: the DOCX page count reads ONE zip member (``docProps/app.xml``) only when it is small,
  and matches it with a bytes regex, so no XML parser ever runs on untrusted XML (no XXE).
- No network, no database: this module only parses.
"""

from __future__ import annotations

import io
import re
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone

from app.services.extraction_service import DOCX_MIME, PDF_MIME

_AUTHOR_MAX = 512
_APP_XML_MAX_BYTES = 1024 * 1024  # 1 MB
_PAGES_RE = re.compile(rb"<Pages>(\d+)</Pages>")


@dataclass(frozen=True)
class FileFacts:
    page_count: int | None = None
    source_created_at: datetime | None = None
    source_modified_at: datetime | None = None
    source_author: str | None = None

    def as_row(self) -> dict:
        """The four ``documents`` columns, datetimes as ISO-8601 strings, ``None`` preserved."""
        return {
            "page_count": self.page_count,
            "source_created_at": self.source_created_at.isoformat() if self.source_created_at else None,
            "source_modified_at": self.source_modified_at.isoformat() if self.source_modified_at else None,
            "source_author": self.source_author,
        }

    def is_empty(self) -> bool:
        return all(v is None for v in self.as_row().values())


def _utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _clean_author(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.replace("\x00", "").strip()
    if not cleaned:
        return None
    return cleaned[:_AUTHOR_MAX]


def _positive(n: object) -> int | None:
    try:
        v = int(n)  # type: ignore[call-overload]
    except Exception:  # noqa: BLE001
        return None
    return v if v > 0 else None


def _read_pdf(raw: bytes) -> FileFacts:
    from pypdf import PdfReader  # noqa: PLC0415

    reader = PdfReader(io.BytesIO(raw))
    if reader.is_encrypted:
        return FileFacts()

    page_count = None
    try:
        page_count = _positive(len(reader.pages))
    except Exception:  # noqa: BLE001
        pass

    meta = None
    try:
        meta = reader.metadata
    except Exception:  # noqa: BLE001
        pass

    created = modified = author = None
    if meta is not None:
        try:
            created = _utc(meta.creation_date)
        except Exception:  # noqa: BLE001 — parse_iso8824_date RAISES on a malformed date
            created = None
        try:
            modified = _utc(meta.modification_date)
        except Exception:  # noqa: BLE001
            modified = None
        try:
            author = _clean_author(meta.author)
        except Exception:  # noqa: BLE001
            author = None

    return FileFacts(page_count, created, modified, author)


def _docx_pages(raw: bytes) -> int | None:
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            info = zf.getinfo("docProps/app.xml")
            if info.file_size > _APP_XML_MAX_BYTES:
                return None
            with zf.open(info) as fh:
                body = fh.read(_APP_XML_MAX_BYTES + 1)
        m = _PAGES_RE.search(body)
        return _positive(m.group(1)) if m else None
    except Exception:  # noqa: BLE001
        return None


def _read_docx(raw: bytes) -> FileFacts:
    import docx  # noqa: PLC0415

    created = modified = author = None
    try:
        props = docx.Document(io.BytesIO(raw)).core_properties
    except Exception:  # noqa: BLE001
        props = None
    if props is not None:
        try:
            created = _utc(props.created)
        except Exception:  # noqa: BLE001
            created = None
        try:
            modified = _utc(props.modified)
        except Exception:  # noqa: BLE001
            modified = None
        try:
            author = _clean_author(props.author)
        except Exception:  # noqa: BLE001
            author = None
    return FileFacts(_docx_pages(raw), created, modified, author)


def read_file_facts(raw: bytes, mime: str) -> FileFacts:
    """Read the four file facts from ``raw``. Never raises; unknown or unreadable → ``None`` per fact."""
    try:
        if not raw:
            return FileFacts()
        if mime == PDF_MIME:
            return _read_pdf(raw)
        if mime == DOCX_MIME:
            return _read_docx(raw)
        return FileFacts()
    except Exception:  # noqa: BLE001
        return FileFacts()

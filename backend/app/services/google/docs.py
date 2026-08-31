"""Read a Google Doc as TEXT.

Same reason as `sheets.py`: Drive's `read_file` exports a Google-native Doc to PDF, and a
PDF is bytes the connector then refuses to decode. The Docs API returns the document's
structure, and the text is walked out of it here.

⛔ READS ONLY — `documents.readonly`. No create, no append, no replace.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.services.google._http import GoogleReadError, get_json

CAPABILITY = "docs_read"
API = "https://docs.googleapis.com/v1/documents"

_MAX_CHARS = 200_000

__all__ = ["read_doc", "CAPABILITY"]


def _text_of(element: dict) -> str:
    """Walk one structural element to its text runs.

    ⚠ THE FOUR CONTAINER KINDS ARE ALL HANDLED, because a doc that happens to put its
    content in a table would otherwise read as EMPTY — a silent wrong answer, which is
    the failure mode this session has spent its time removing. Paragraph, table,
    table-of-contents and section break are the complete set `documents.get` returns.
    """
    out: list[str] = []

    para = element.get("paragraph")
    if para:
        for run in para.get("elements") or []:
            text_run = (run or {}).get("textRun") or {}
            out.append(str(text_run.get("content") or ""))

    table = element.get("table")
    if table:
        for row in table.get("tableRows") or []:
            cells = []
            for cell in (row or {}).get("tableCells") or []:
                cells.append(
                    "".join(_text_of(e) for e in (cell or {}).get("content") or []).strip()
                )
            out.append(" | ".join(cells) + "\n")

    toc = element.get("tableOfContents")
    if toc:
        for e in toc.get("content") or []:
            out.append(_text_of(e))

    return "".join(out)


async def read_doc(connection_id: str | UUID, document_id: str) -> dict[str, Any]:
    """Return the document's title and its plain text."""
    did = str(document_id or "").strip()
    if not did:
        raise GoogleReadError("read_doc needs a document id and none was supplied")

    data = await get_json(
        CAPABILITY, connection_id, f"{API}/{did}", None, what="read_doc",
        max_bytes=4 * 1024 * 1024,
    )
    body = (data.get("body") or {}).get("content") or []
    text = "".join(_text_of(e) for e in body if isinstance(e, dict))
    return {
        "document_id": did,
        "title": data.get("title"),
        "text": text[:_MAX_CHARS] or None,
        "truncated": len(text) > _MAX_CHARS,
        # An honest absence, not a silent empty string: a doc made only of images has a
        # body, it just has no text runs, and the reader should be able to tell.
        "note": None if text else (
            "This document has no text runs — it may contain only images or drawings."
        ),
    }

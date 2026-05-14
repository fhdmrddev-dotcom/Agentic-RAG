# backend/app/services/extractors/pymupdf.py
# Source: D-071-01..04 + PATTERNS.md §2 + RESEARCH.md Pattern 2 verified 2026-05-14
"""PyMuPDF parent wrapper — spawns subprocess child for AGPL fence (D-PRD-07 Appendix).

CRITICAL — AGPL FENCE INVARIANT:
- This file MUST NOT `import fitz` or `from pymupdf` anywhere.
- All PyMuPDF code lives in `backend/extractors/pymupdf_isolated.py` (child process).
- The runtime invariant test `test_pymupdf_fence.py::test_fitz_not_imported_by_parent`
  asserts `fitz not in sys.modules` after importing every parent-side module.
"""
from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
from pathlib import Path

from app.services.extraction_service import (
    DOCX_MIME,
    ExtractedDocument,
    ExtractionError,
    ImageData,
    PdfExtractor,
    PDF_MIME,
    TableData,
)

log = logging.getLogger(__name__)

# Resolve backend/ at module import time — used as cwd for the subprocess call so
# `python -m extractors.pymupdf_isolated` can find the `extractors` package
# (T-071-03-05 mitigation). __file__ = backend/app/services/extractors/pymupdf.py
# so .parent.parent.parent.parent = backend/.
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent.parent


def _payload_to_extracted_document(payload: dict) -> ExtractedDocument:
    """Reverse-translate the child's JSON payload into the dataclass shape."""
    tables = tuple(TableData(**t) for t in payload.get("tables", []))
    images = tuple(ImageData(**im) for im in payload.get("images", []))
    return ExtractedDocument(
        text=payload.get("text", ""),
        tables=tables,
        images=images,
        table_extraction_error=payload.get("table_extraction_error"),
        image_extraction_error=payload.get("image_extraction_error"),
        full_markdown=payload.get("full_markdown"),
        extractor_name=payload.get("extractor_name") or "pymupdf",
    )


def _run_pymupdf_subprocess(raw: bytes, mime: str) -> ExtractedDocument:
    """Invoke the AGPL-fenced child subprocess; raise ExtractionError on any failure."""
    timeout_s = int(os.getenv("PYMUPDF_TIMEOUT_S", "60"))

    # T-071-03-01 mitigation: strip SUPABASE_SERVICE_ROLE_KEY etc. from the child
    # by passing a minimal env. Only PATH is forwarded so the child Python can
    # find its own interpreter + site-packages.
    child_env = {"PATH": os.environ.get("PATH", "")}

    try:
        result = subprocess.run(
            [sys.executable, "-m", "extractors.pymupdf_isolated", "--mime", mime],
            input=raw,                  # raw bytes, NOT b64 — D-071-01
            capture_output=True,        # stdout = JSON; stderr = diagnostic logs
            timeout=timeout_s,
            check=False,                # we handle non-zero exit explicitly
            cwd=str(_BACKEND_DIR),      # T-071-03-05 mitigation
            env=child_env,              # T-071-03-01 mitigation
        )
    except subprocess.TimeoutExpired as e:
        raise ExtractionError(f"pymupdf timed out after {timeout_s}s") from e

    if result.returncode != 0:
        last_err_lines = result.stderr.decode("utf-8", errors="replace").strip().splitlines()
        last_err = last_err_lines[-1] if last_err_lines else "no stderr"
        raise ExtractionError(f"pymupdf child exited {result.returncode}: {last_err}")

    try:
        payload = json.loads(result.stdout.decode("utf-8"))
    except json.JSONDecodeError as e:
        raise ExtractionError(f"pymupdf produced malformed JSON: {e}") from e

    return _payload_to_extracted_document(payload)


class PyMuPDFExtractor(PdfExtractor):
    """AGPL-fenced PyMuPDF extractor — parent wrapper; invokes subprocess child (D-071-01..04).

    PER D-071 DISCRETION: PDF-only for v2.6. DOCX still routes through DoclingExtractor
    or LegacyExtractor — PyMuPDF's DOCX path is rarely better than python-docx.
    """

    def supports(self, mime: str) -> bool:
        return mime == PDF_MIME

    def extract(self, raw: bytes, mime: str) -> ExtractedDocument:
        if not self.supports(mime):
            raise ValueError(f"PyMuPDFExtractor does not support {mime!r}")
        return _run_pymupdf_subprocess(raw, mime)

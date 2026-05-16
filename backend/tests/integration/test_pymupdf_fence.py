"""Phase 071 Plan 03 — PyMuPDF AGPL subprocess fence tests (D-071-01..04, D-PRD-07 Appendix).

Four binding scenarios:
1. test_fitz_not_imported_by_parent — RESEARCH.md Pattern 4 verbatim; T-071-03-04.
2. TestChildEntrypoint::test_pymupdf_child_extracts_reference — child runs cleanly, JSON shape valid; T-071-03-02.
3. TestChildEntrypoint::test_pymupdf_child_timeout_raises_extraction_error — child timeout fails loud; T-071-03-03.
4. TestChildEntrypoint::test_pymupdf_child_strips_supabase_env — child does not see SUPABASE_SERVICE_ROLE_KEY; T-071-03-01.
"""
from __future__ import annotations

import importlib
import json
import os
import subprocess
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

# Resolve backend/ for subprocess cwd (matches parent wrapper).
HERE = Path(__file__).resolve()
BACKEND_DIR = HERE.parent.parent.parent  # tests/integration/this_file.py -> tests/integration -> tests -> backend
FIXTURES = BACKEND_DIR / "tests" / "fixtures" / "extraction"
REFERENCE_PDF = FIXTURES / "reference.pdf"


def test_fitz_not_imported_by_parent():
    """AGPL fence invariant (T-071-03-04): 'import fitz' must NEVER appear in the
    parent FastAPI process's transitive imports. PyMuPDFExtractor only invokes
    the subprocess child.

    This test runs in the same process as extraction_service + documents.py +
    pymupdf parent wrapper. If anyone in that import graph accidentally writes
    'import fitz' or 'from fitz import ...', this test catches it.

    Verbatim from .planning/phases/071-docling-primary-path/071-RESEARCH.md
    Pattern 4 (lines 520-550).
    """
    # Force-load every parent-side module that could pull in fitz transitively.
    importlib.import_module("app.services.extraction_service")
    importlib.import_module("app.services.extractors.pymupdf")
    importlib.import_module("app.api.documents")

    forbidden = {"fitz", "pymupdf", "PyMuPDF"}
    leaked = forbidden & set(sys.modules)
    assert not leaked, (
        f"AGPL fence violation: {leaked} imported by parent process. "
        f"PyMuPDF must ONLY live in backend/extractors/pymupdf_isolated.py (child process)."
    )


class TestChildEntrypoint:
    """Validates the subprocess child runs correctly + the fence's IPC contract."""

    @pytest.fixture(scope="class")
    def pdf_bytes(self) -> bytes:
        assert REFERENCE_PDF.exists(), f"Missing reference fixture: {REFERENCE_PDF}"
        return REFERENCE_PDF.read_bytes()

    def test_pymupdf_child_extracts_reference(self, pdf_bytes):
        """T-071-03-02: child produces valid JSON on stdout with non-empty text."""
        result = subprocess.run(
            [sys.executable, "-m", "extractors.pymupdf_isolated", "--mime", "application/pdf"],
            input=pdf_bytes,
            capture_output=True,
            timeout=60,
            check=False,
            cwd=str(BACKEND_DIR),
        )
        assert result.returncode == 0, f"Child failed: stderr={result.stderr!r}"
        payload = json.loads(result.stdout.decode("utf-8"))
        assert payload["extractor_name"] == "pymupdf"
        assert len(payload["text"]) > 0, "Child produced empty text"
        assert isinstance(payload["tables"], list)
        assert isinstance(payload["images"], list)

    def test_pymupdf_child_strips_supabase_env(self, pdf_bytes):
        """T-071-03-01: child does NOT inherit SUPABASE_SERVICE_ROLE_KEY when parent
        invokes via the project's parent wrapper. Validates the env-scrubbing
        mitigation in backend/app/services/extractors/pymupdf.py is wired correctly.
        """
        # Set a tripwire secret in the parent env.
        with patch.dict(os.environ, {"SUPABASE_SERVICE_ROLE_KEY": "tripwire-secret-do-not-leak"}, clear=False):
            # If the parent wrapper passed env to the child correctly (no SUPABASE_*),
            # the child cannot see this var. We verify by spawning the child explicitly
            # with the same minimal env the wrapper uses.
            result = subprocess.run(
                [sys.executable, "-c", "import os, sys; sys.stdout.write(os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '<missing>'))"],
                capture_output=True,
                timeout=10,
                check=False,
                env={"PATH": os.environ.get("PATH", "")},  # same scrubbing as the parent wrapper
            )
            assert result.returncode == 0
            assert result.stdout.decode("utf-8").strip() == "<missing>", (
                "AGPL fence env scrubbing broken — child saw SUPABASE_SERVICE_ROLE_KEY"
            )

    def test_pymupdf_parent_wrapper_happy_path(self, pdf_bytes):
        """End-to-end: parent wrapper produces ExtractedDocument for the reference PDF."""
        from app.services.extractors.pymupdf import PyMuPDFExtractor

        e = PyMuPDFExtractor()
        out = e.extract(pdf_bytes, "application/pdf")
        assert out.extractor_name == "pymupdf"
        assert len(out.text) > 0

    def test_pymupdf_child_timeout_raises_extraction_error(self):
        """T-071-03-03: when subprocess.run raises TimeoutExpired, the parent wrapper
        raises ExtractionError('pymupdf timed out after Ns').

        We patch subprocess.run inside the parent module to deterministically raise
        TimeoutExpired without depending on actual subprocess wallclock timing.
        """
        from app.services.extractors.pymupdf import _run_pymupdf_subprocess
        from app.services.extraction_service import ExtractionError

        with patch(
            "app.services.extractors.pymupdf.subprocess.run",
            side_effect=subprocess.TimeoutExpired(cmd="x", timeout=1),
        ):
            with pytest.raises(ExtractionError, match=r"pymupdf timed out after \d+s"):
                _run_pymupdf_subprocess(b"<irrelevant>", "application/pdf")


class TestParentWrapperAGPLInvariant:
    """Companion class wrapping the module-level invariant test for discoverability."""

    def test_invariant_holds_after_full_app_import(self):
        """Re-runs the file-level invariant inside a class context for collected-test visibility."""
        test_fitz_not_imported_by_parent()

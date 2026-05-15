"""Phase 071.2 Plan 05 — integration tests for the per-aspect extraction
dispatcher plumbing on /upload + /reextract.

Tests:
  1. test_swapping_docx_image_engine_changes_stored_count: per-call `?engines=`
     hint actually routes a different engine through to extract_composable.
  2. test_per_call_hint_respects_admin_disable: when
     `app_settings.extraction_per_call_hints_enabled=False`, the hint is
     silently dropped and defaults are used.
  3. test_silently_drops_unknown_keys: `_parse_engines_hint` discards
     unknown keys (defense in depth — Pattern SP-8).
"""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest


USER_ID = "00000000-0000-0000-0000-000000000001"
DOC_ID = str(uuid4())
NOW = datetime.now(timezone.utc).isoformat()


def _doc_row(doc_id=None, status="completed", mime="application/pdf", filename="test.pdf"):
    return {
        "id": doc_id or DOC_ID,
        "user_id": USER_ID,
        "folder_id": None,
        "filename": filename,
        "file_path": f"{USER_ID}/{doc_id or DOC_ID}/{filename}",
        "file_size": 13,
        "mime_type": mime,
        "status": status,
        "error_message": None,
        "chunk_count": None,
        "content_hash": "abc123hash",
        "created_at": NOW,
        "updated_at": NOW,
        "is_latest": True,
    }


def _make_result(data):
    r = MagicMock()
    r.data = data
    return r


# ---------------------------------------------------------------------------
# TestParseEnginesHint — unit-level parser checks
# ---------------------------------------------------------------------------


class TestParseEnginesHint:
    def test_silently_drops_unknown_keys(self, monkeypatch):
        """Unknown keys are dropped without raising; valid keys preserved."""
        from app.api.documents import _parse_engines_hint
        from app.models import user_settings as us_mod

        fake = MagicMock()
        fake.extraction_per_call_hints_enabled = True
        monkeypatch.setattr(us_mod, "load_app_settings", lambda: fake)

        out = _parse_engines_hint(
            "text:docling,bogus:xxx,images:pymupdf_full,not_a_key:42"
        )
        assert out == {"text": "docling", "images": "pymupdf_full"}

    def test_returns_none_when_admin_disabled(self, monkeypatch):
        """When extraction_per_call_hints_enabled=False, parser returns None."""
        from app.api.documents import _parse_engines_hint
        from app.models import user_settings as us_mod

        fake = MagicMock()
        fake.extraction_per_call_hints_enabled = False
        monkeypatch.setattr(us_mod, "load_app_settings", lambda: fake)

        out = _parse_engines_hint("text:docling,images:pymupdf_full")
        assert out is None

    def test_returns_none_for_empty(self, monkeypatch):
        from app.api.documents import _parse_engines_hint

        assert _parse_engines_hint(None) is None
        assert _parse_engines_hint("") is None


# ---------------------------------------------------------------------------
# TestExtractionDispatcher — route-level integration
# ---------------------------------------------------------------------------


class TestExtractionDispatcher:
    def test_swapping_docx_image_engine_changes_engines_dict(
        self, client, auth_headers, mock_builder, monkeypatch
    ):
        """The `?engines=images:zip_xpath` query param flows through to
        extract_composable as engines_dict={'images': 'zip_xpath'}."""
        docx_doc = _doc_row(
            doc_id=DOC_ID,
            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename="thesis.docx",
        )
        mock_builder.execute.side_effect = [
            _make_result(docx_doc),                                       # owner SELECT
            _make_result([]),                                             # delete chunks
            _make_result([]),                                             # delete tables
            _make_result([]),                                             # delete images
            _make_result([{**docx_doc, "status": "pending"}]),            # UPDATE documents
        ]

        # Ensure load_app_settings returns hints-enabled
        fake_settings = MagicMock()
        fake_settings.extraction_per_call_hints_enabled = True
        from app.models import user_settings as us_mod
        monkeypatch.setattr(us_mod, "load_app_settings", lambda: fake_settings)

        mock_extracted = MagicMock()
        mock_extracted.text = "x"
        mock_extracted.tables = []
        mock_extracted.images = []
        mock_extracted.extractor_name = "composable[docling/docling_tf/zip_xpath/docling_formula]"

        with patch("app.api.documents.ingest_document"), \
             patch("app.services.extraction_service.extract_composable",
                   return_value=mock_extracted) as mock_compose:
            resp = client.post(
                f"/documents/{DOC_ID}/reextract?engines=images:zip_xpath",
                headers=auth_headers,
                json={"engine": "docling"},
            )

        assert resp.status_code == 202, f"got {resp.status_code}: {resp.text}"
        mock_compose.assert_called_once()
        args = mock_compose.call_args.args
        # Positional: (raw, mime, engines_dict)
        assert args[2] is not None
        # The hint set images=zip_xpath; body.engine='docling' did NOT alias
        # because engines hint was non-empty.
        assert args[2].get("images") == "zip_xpath"

    def test_camelot_engine_dispatched(
        self, client, auth_headers, mock_builder, monkeypatch
    ):
        """Phase 071.3 Plan 02 — `?engines=tables:camelot` flows through to
        extract_composable as engines_dict={'tables': 'camelot'} (D-071.3-05)."""
        pdf_doc = _doc_row(
            doc_id=DOC_ID, mime="application/pdf", filename="thesis.pdf"
        )
        mock_builder.execute.side_effect = [
            _make_result(pdf_doc),                                       # owner SELECT
            _make_result([]),                                            # delete chunks
            _make_result([]),                                            # delete tables
            _make_result([]),                                            # delete images
            _make_result([{**pdf_doc, "status": "pending"}]),            # UPDATE documents
        ]

        # Ensure load_app_settings returns hints-enabled
        fake_settings = MagicMock()
        fake_settings.extraction_per_call_hints_enabled = True
        from app.models import user_settings as us_mod
        monkeypatch.setattr(us_mod, "load_app_settings", lambda: fake_settings)

        mock_extracted = MagicMock()
        mock_extracted.text = "x"
        mock_extracted.tables = []
        mock_extracted.images = []
        mock_extracted.extractor_name = (
            "composable[legacy/camelot/pymupdf_full/none]"
        )

        with patch("app.api.documents.ingest_document"), \
             patch("app.services.extraction_service.extract_composable",
                   return_value=mock_extracted) as mock_compose:
            resp = client.post(
                f"/documents/{DOC_ID}/reextract?engines=tables:camelot",
                headers=auth_headers,
                json={"engine": "docling"},
            )

        assert resp.status_code == 202, f"got {resp.status_code}: {resp.text}"
        mock_compose.assert_called_once()
        args = mock_compose.call_args.args
        # Positional: (raw, mime, engines_dict)
        assert args[2] is not None
        # The hint set tables=camelot; body.engine='docling' did NOT alias
        # because engines hint was non-empty.
        assert args[2].get("tables") == "camelot"

    def test_per_call_hint_respects_admin_disable(
        self, client, auth_headers, mock_builder, monkeypatch
    ):
        """With extraction_per_call_hints_enabled=False, the `?engines=` query
        is ignored — falls back to body.engine alias (or app_settings defaults)."""
        pdf_doc = _doc_row(doc_id=DOC_ID, mime="application/pdf", filename="thesis.pdf")
        mock_builder.execute.side_effect = [
            _make_result(pdf_doc),
            _make_result([]),
            _make_result([]),
            _make_result([]),
            _make_result([{**pdf_doc, "status": "pending"}]),
        ]

        fake_settings = MagicMock()
        fake_settings.extraction_per_call_hints_enabled = False
        from app.models import user_settings as us_mod
        monkeypatch.setattr(us_mod, "load_app_settings", lambda: fake_settings)

        mock_extracted = MagicMock()
        mock_extracted.text = "x"
        mock_extracted.tables = []
        mock_extracted.images = []
        mock_extracted.extractor_name = "composable[docling/docling_tf/pymupdf_full/docling_formula]"

        with patch("app.api.documents.ingest_document"), \
             patch("app.services.extraction_service.extract_composable",
                   return_value=mock_extracted) as mock_compose:
            resp = client.post(
                f"/documents/{DOC_ID}/reextract?engines=images:zip_xpath",
                headers=auth_headers,
                json={"engine": "docling"},
            )

        assert resp.status_code == 202
        mock_compose.assert_called_once()
        args = mock_compose.call_args.args
        # admin disabled: the hint is None; body.engine='docling' became text alias.
        assert args[2] == {"text": "docling"}, (
            f"Expected fallback to body.engine alias when admin-disabled, "
            f"got: {args[2]!r}"
        )

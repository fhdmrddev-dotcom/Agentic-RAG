"""Integration tests for /documents endpoints."""
import asyncio
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest


USER_ID = "00000000-0000-0000-0000-000000000001"
DOC_ID = str(uuid4())
NOW = datetime.now(timezone.utc).isoformat()
FOLDER_ID = "00000000-0000-0000-0000-000000000099"


def _doc_row(doc_id=None, status="pending", folder_id=None):
    return {
        "id": doc_id or DOC_ID,
        "user_id": USER_ID,
        "folder_id": folder_id,
        "filename": "test.txt",
        "file_path": f"{USER_ID}/{doc_id or DOC_ID}/test.txt",
        "file_size": 13,
        "mime_type": "text/plain",
        "status": status,
        "error_message": None,
        "chunk_count": None,
        "content_hash": "abc123hash",
        "created_at": NOW,
        "updated_at": NOW,
    }


def _make_result(data):
    r = MagicMock()
    r.data = data
    return r


def _raise_401():
    from fastapi import HTTPException, status as http_status
    raise HTTPException(status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")


# ── GET /documents ─────────────────────────────────────────────────────────────

class TestListDocuments:
    def test_requires_auth(self, client):
        from tests.conftest import app, mock_user_data
        from app.dependencies import get_current_user

        app.dependency_overrides[get_current_user] = _raise_401
        try:
            resp = client.get("/documents")
            assert resp.status_code == 401
        finally:
            app.dependency_overrides[get_current_user] = lambda: mock_user_data

    def test_returns_200_with_auth(self, client, auth_headers, mock_builder):
        # own docs, global folder ids, document_tables rows, document_images rows
        mock_builder.execute.side_effect = [
            _make_result([_doc_row()]),
            _make_result([]),
            _make_result([]),
            _make_result([]),
        ]
        response = client.get("/documents", headers=auth_headers)
        assert response.status_code == 200

    def test_returns_list(self, client, auth_headers, mock_builder):
        # own docs, global folder ids, document_tables rows, document_images rows
        mock_builder.execute.side_effect = [
            _make_result([_doc_row()]),
            _make_result([]),
            _make_result([]),
            _make_result([]),
        ]
        response = client.get("/documents", headers=auth_headers)
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1

    def test_returns_empty_list_when_no_documents(self, client, auth_headers, mock_execute_result):
        mock_execute_result.data = []
        response = client.get("/documents", headers=auth_headers)
        assert response.json() == []

    def test_list_documents_includes_modal_counts(self, client, auth_headers, mock_builder):
        """MODAL-03/D-09: GET /documents includes table_count and image_count fields."""
        from tests.conftest import mock_user_data

        doc_id = str(uuid4())
        doc = {**_doc_row(doc_id=doc_id), "version_number": 1, "is_latest": True, "content_hash": "h1"}

        # Side effects for list_documents query chain:
        # 1st execute: own documents query
        # 2nd execute: get_globally_visible_folder_ids (returns [])
        # 3rd execute: document_tables .in_ query → 2 rows for this doc
        # 4th execute: document_images .in_ query → 3 rows for this doc
        mock_builder.execute.side_effect = [
            _make_result([doc]),          # own docs
            _make_result([]),             # global folder ids
            _make_result([              # document_tables rows
                {"document_id": doc_id},
                {"document_id": doc_id},
            ]),
            _make_result([              # document_images rows
                {"document_id": doc_id},
                {"document_id": doc_id},
                {"document_id": doc_id},
            ]),
        ]
        response = client.get("/documents", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["table_count"] == 2
        assert data[0]["image_count"] == 3


# ── POST /documents/upload ─────────────────────────────────────────────────────

class TestUploadDocument:
    def test_requires_auth(self, client):
        from tests.conftest import app, mock_user_data
        from app.dependencies import get_current_user

        app.dependency_overrides[get_current_user] = _raise_401
        try:
            resp = client.post(
                "/documents/upload",
                files={"file": ("test.txt", b"hello world", "text/plain")},
            )
            assert resp.status_code == 401
        finally:
            app.dependency_overrides[get_current_user] = lambda: mock_user_data

    def test_valid_txt_upload_returns_201(self, client, auth_headers, mock_builder):
        # execute calls: 1=dedup check (no match), 2=stale check (no match), 3=insert
        mock_builder.execute.side_effect = [
            _make_result([]),         # dedup: no existing
            _make_result([]),         # stale: no stale
            _make_result([_doc_row()]),  # insert result
        ]

        with patch("app.api.documents.ingest_document"):
            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("test.txt", b"Hello world content", "text/plain")},
            )
        assert response.status_code == 201

    def test_valid_txt_upload_returns_pending_status(self, client, auth_headers, mock_builder):
        # execute calls: 1=dedup check (no match), 2=stale check (no match), 3=insert
        mock_builder.execute.side_effect = [
            _make_result([]),                       # dedup: no existing
            _make_result([]),                       # stale: no stale
            _make_result([_doc_row(status="pending")]),  # insert result
        ]

        with patch("app.api.documents.ingest_document"):
            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("test.txt", b"Hello world content", "text/plain")},
            )
        data = response.json()
        assert data["status"] == "pending"

    def test_valid_txt_upload_returns_document_schema(self, client, auth_headers, mock_builder):
        # execute calls: 1=dedup check (no match), 2=stale check (no match), 3=insert
        mock_builder.execute.side_effect = [
            _make_result([]),         # dedup: no existing
            _make_result([]),         # stale: no stale
            _make_result([_doc_row()]),  # insert result
        ]

        with patch("app.api.documents.ingest_document"):
            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("test.txt", b"Hello world content", "text/plain")},
            )
        data = response.json()
        for key in ("id", "user_id", "filename", "file_path", "file_size", "mime_type", "status"):
            assert key in data

    def test_invalid_mime_type_returns_422(self, client, auth_headers):
        response = client.post(
            "/documents/upload",
            headers=auth_headers,
            files={"file": ("photo.jpg", b"\xff\xd8\xff", "image/jpeg")},
        )
        assert response.status_code == 422

    def test_empty_file_returns_422(self, client, auth_headers):
        response = client.post(
            "/documents/upload",
            headers=auth_headers,
            files={"file": ("empty.txt", b"", "text/plain")},
        )
        assert response.status_code == 422

    def test_markdown_file_accepted(self, client, auth_headers, mock_builder):
        mock_builder.execute.side_effect = [
            _make_result([]),          # dedup: no existing
            _make_result([]),          # stale: no stale
            _make_result([_doc_row()]),  # insert result
        ]

        with patch("app.api.documents.ingest_document"):
            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("readme.md", b"# Title\n\nSome content.", "text/plain")},
            )
        assert response.status_code == 201

    def test_html_file_accepted(self, client, auth_headers, mock_builder):
        mock_builder.execute.side_effect = [
            _make_result([]),          # dedup: no existing
            _make_result([]),          # stale: no stale
            _make_result([_doc_row()]),  # insert result
        ]

        with patch("app.api.documents.ingest_document"):
            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("page.html", b"<html><body>Hello</body></html>", "text/html")},
            )
        assert response.status_code == 201

    def test_background_task_is_scheduled(self, client, auth_headers, mock_builder):
        """Background ingest task is added and called (TestClient runs bg tasks synchronously)."""
        mock_builder.execute.side_effect = [
            _make_result([]),          # dedup: no existing
            _make_result([]),          # stale: no stale
            _make_result([_doc_row()]),  # insert result
        ]

        with patch("app.api.documents.ingest_document") as mock_ingest:
            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("test.txt", b"Some content here", "text/plain")},
            )
        assert response.status_code == 201
        mock_ingest.assert_called_once()

    def test_upload_with_valid_folder_id_returns_201(self, client, auth_headers, mock_builder):
        """Upload targeting a valid folder stores the folder_id association."""
        mock_builder.or_.return_value = mock_builder
        mock_builder.neq.return_value = mock_builder
        mock_builder.limit.return_value = mock_builder
        # execute calls: 1=folder validation, 2=dedup check (no match), 3=stale check (no match), 4=insert
        mock_builder.execute.side_effect = [
            _make_result({"id": FOLDER_ID}),               # folder validation: found
            _make_result([]),                              # dedup: no existing
            _make_result([]),                              # stale: no stale
            _make_result([_doc_row(folder_id=FOLDER_ID)]),  # insert result
        ]

        with patch("app.api.documents.ingest_document"):
            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("test.txt", b"Hello world content", "text/plain")},
                data={"folder_id": FOLDER_ID},
            )
        assert response.status_code == 201
        assert response.json()["folder_id"] == FOLDER_ID

    def test_upload_with_invalid_folder_id_returns_404(self, client, auth_headers, mock_builder):
        """Upload targeting a non-existent or inaccessible folder returns 404."""
        mock_builder.or_.return_value = mock_builder
        mock_builder.neq.return_value = mock_builder
        mock_builder.limit.return_value = mock_builder
        # execute calls: 1=folder validation (not found) → raises 404 immediately
        mock_builder.execute.side_effect = [
            _make_result(None),   # folder validation: not found
        ]

        with patch("app.api.documents.ingest_document"):
            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("test.txt", b"Hello world content", "text/plain")},
                data={"folder_id": FOLDER_ID},
            )
        assert response.status_code == 404
        assert "Folder not found" in response.json()["detail"]

    def test_upload_uses_background_task_for_extraction(self, client, auth_headers, mock_builder):
        """Phase 071.2 D-071.2-05 — /upload schedules extraction via BackgroundTask,
        NOT inline. After the INSERT (status='pending'), the route returns 201 and
        the BackgroundTask runs `_upload_pipeline` which in turn invokes
        `ingest_document`. TestClient drives BackgroundTasks synchronously per
        Pitfall 1, so `mock_ingest.assert_called_once()` is observable post-response.
        """
        mock_builder.execute.side_effect = [
            _make_result([]),                              # dedup: no existing
            _make_result([]),                              # version: no stale
            _make_result([_doc_row(status="pending")]),    # INSERT
        ]

        # Phase 071.2 Plan 05 — _upload_pipeline now routes PDF/DOCX through
        # extract_composable (per-aspect dispatcher) instead of get_extractor.
        mock_extracted = MagicMock()
        mock_extracted.text = "extracted text"
        mock_extracted.tables = []
        mock_extracted.images = []
        mock_extracted.extractor_name = "composable[legacy/docling_tf/pymupdf_full/docling_formula]"

        with patch("app.api.documents.ingest_document") as mock_ingest, \
             patch("app.services.extraction_service.extract_composable",
                   return_value=mock_extracted):

            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("doc.pdf", b"%PDF-1.4 fake content", "application/pdf")},
            )

        assert response.status_code == 201, (
            f"Expected 201, got {response.status_code}: {response.text}"
        )
        # BackgroundTasks invoked synchronously by TestClient (Pitfall 1) — call observable.
        mock_ingest.assert_called_once()


# ── POST /documents/{id}/reingest ──────────────────────────────────────────────

class TestReingestDocument:
    """Phase 071.2 Plan 01 — POST /documents/{id}/reingest integration tests.

    Mirrors the proven /reextract pattern from Phase 071.1: extract moved into the
    BackgroundTask, every sync supabase call wrapped in run_in_threadpool.
    """

    def test_reingest_wraps_extract_in_threadpool(self, client, auth_headers, mock_builder):
        """SC#2 integration — /reingest doesn't block on extractor.extract; instead
        it schedules ingest_document via BackgroundTask. Asserts 200 + ingest mock
        invoked synchronously by TestClient (Pitfall 1)."""
        pdf_doc = {
            **_doc_row(doc_id=DOC_ID, status="completed"),
            "mime_type": "application/pdf",
            "filename": "thesis.pdf",
            "file_path": f"{USER_ID}/{DOC_ID}/thesis.pdf",
            "is_latest": True,
        }
        # Side effects: 1=owner SELECT, 2=UPDATE status='pending' returning row
        mock_builder.execute.side_effect = [
            _make_result(pdf_doc),                              # owner SELECT
            _make_result([{**pdf_doc, "status": "pending"}]),   # UPDATE
        ]

        # Phase 071.2 Plan 05 — _upload_pipeline now routes PDF/DOCX through
        # extract_composable (per-aspect dispatcher) instead of get_extractor.
        mock_extracted = MagicMock()
        mock_extracted.text = "re-extracted text"
        mock_extracted.tables = []
        mock_extracted.images = []
        mock_extracted.extractor_name = "composable[legacy/docling_tf/pymupdf_full/docling_formula]"

        with patch("app.api.documents.ingest_document") as mock_ingest, \
             patch("app.services.extraction_service.extract_composable",
                   return_value=mock_extracted):

            response = client.post(
                f"/documents/{DOC_ID}/reingest",
                headers=auth_headers,
            )

        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text}"
        )
        # BackgroundTasks invoked synchronously by TestClient (Pitfall 1).
        mock_ingest.assert_called_once()


# ── DELETE /documents/{id} ─────────────────────────────────────────────────────

class TestDeleteDocument:
    def test_requires_auth(self, client):
        from tests.conftest import app, mock_user_data
        from app.dependencies import get_current_user

        app.dependency_overrides[get_current_user] = _raise_401
        try:
            resp = client.delete(f"/documents/{DOC_ID}")
            assert resp.status_code == 401
        finally:
            app.dependency_overrides[get_current_user] = lambda: mock_user_data

    def test_returns_204_on_success(self, client, auth_headers, mock_builder):
        mock_builder.execute.side_effect = [
            _make_result(_doc_row()),  # select the document (ownership check)
            _make_result([]),          # delete
        ]
        response = client.delete(f"/documents/{DOC_ID}", headers=auth_headers)
        assert response.status_code == 204

    def test_returns_404_when_document_not_found(self, client, auth_headers, mock_builder):
        # single() returns None when document not found
        mock_builder.execute.side_effect = [_make_result(None)]
        response = client.delete(f"/documents/{DOC_ID}", headers=auth_headers)
        assert response.status_code == 404

    def test_delete_body_is_empty(self, client, auth_headers, mock_builder):
        mock_builder.execute.side_effect = [
            _make_result(_doc_row()),
            _make_result([]),
        ]
        response = client.delete(f"/documents/{DOC_ID}", headers=auth_headers)
        assert response.content == b""


# ── PATCH /documents/{id}/move ─────────────────────────────────────────────────

class TestMoveDocument:
    def test_move_to_valid_folder(self, client, auth_headers, mock_builder):
        """PATCH /documents/{id}/move with valid folder returns 200."""
        mock_builder.or_.return_value = mock_builder
        mock_builder.execute.side_effect = [
            _make_result({"id": DOC_ID}),                     # doc ownership check
            _make_result({"id": FOLDER_ID}),                  # folder validation
            _make_result([_doc_row(folder_id=FOLDER_ID)]),    # update result
        ]
        response = client.patch(
            f"/documents/{DOC_ID}/move",
            headers=auth_headers,
            json={"folder_id": FOLDER_ID},
        )
        assert response.status_code == 200
        assert response.json()["folder_id"] == FOLDER_ID

    def test_move_to_root(self, client, auth_headers, mock_builder):
        """PATCH /documents/{id}/move with folder_id=null moves to root."""
        mock_builder.execute.side_effect = [
            _make_result({"id": DOC_ID}),               # doc ownership check
            _make_result([_doc_row(folder_id=None)]),    # update result (no folder validation needed)
        ]
        response = client.patch(
            f"/documents/{DOC_ID}/move",
            headers=auth_headers,
            json={"folder_id": None},
        )
        assert response.status_code == 200
        assert response.json()["folder_id"] is None

    def test_move_document_not_found(self, client, auth_headers, mock_builder):
        """PATCH /documents/{id}/move with non-owned doc returns 404."""
        mock_builder.execute.side_effect = [
            _make_result(None),  # doc ownership check: not found
        ]
        response = client.patch(
            f"/documents/{DOC_ID}/move",
            headers=auth_headers,
            json={"folder_id": FOLDER_ID},
        )
        assert response.status_code == 404
        assert "Document not found" in response.json()["detail"]

    def test_move_to_invalid_folder(self, client, auth_headers, mock_builder):
        """PATCH /documents/{id}/move with invalid folder returns 404."""
        mock_builder.or_.return_value = mock_builder
        mock_builder.execute.side_effect = [
            _make_result({"id": DOC_ID}),   # doc ownership check: found
            _make_result(None),              # folder validation: not found
        ]
        response = client.patch(
            f"/documents/{DOC_ID}/move",
            headers=auth_headers,
            json={"folder_id": FOLDER_ID},
        )
        assert response.status_code == 404
        assert "Folder not found" in response.json()["detail"]


# ── POST /documents/{id}/reextract ─────────────────────────────────────────────

class TestReextractDocument:
    """Phase 071 Plan 04 — POST /documents/{id}/reextract integration tests (D-071-09..12).

    Covers:
    - happy_path_returns_202: owner reextract returns 202; chunks/tables/images deleted;
      doc reset to status='pending' with extractor=NULL; ingest_document scheduled with
      engine_override=body.engine.
    - invalid_engine_returns_422: Pydantic Literal rejects unknown engine values
      (T-071-04-02 mitigation).
    - missing_engine_returns_422: required field omission produces FastAPI auto-422.
    - owner_only_returns_404: cross-user IDOR attempt returns 404 (NOT 403) to avoid
      leaking existence (T-071-04-01 mitigation).
    """

    def test_reextract_happy_path_returns_202(self, client, auth_headers, mock_builder):
        """Owner reextract → 202; chunks/tables/images deleted; doc reset to pending;
        ingest_document scheduled with engine_override='docling'."""
        pdf_doc = {
            **_doc_row(doc_id=DOC_ID, status="completed"),
            "mime_type": "application/pdf",
            "filename": "thesis.pdf",
            "file_path": f"{USER_ID}/{DOC_ID}/thesis.pdf",
            "is_latest": True,
        }
        # Simulate the full happy path:
        # 1. owner check returns the doc row.
        # 2. delete chunks succeeds (empty data).
        # 3. delete tables succeeds.
        # 4. delete images succeeds.
        # 5. UPDATE documents returns the updated row.
        mock_builder.execute.side_effect = [
            _make_result(pdf_doc),                                       # owner SELECT
            _make_result([]),                                            # delete chunks
            _make_result([]),                                            # delete tables
            _make_result([]),                                            # delete images
            _make_result([{**pdf_doc, "status": "pending"}]),            # UPDATE documents
        ]

        # Phase 071.2 Plan 05 — /reextract now dispatches via extract_composable
        # (per-aspect composer). When `?engines=` is absent and body.engine is
        # provided, the route builds engines_dict={'text': body.engine} so the
        # legacy 071.1 API stays usable as a TEXT-engine alias.
        # The TestClient runs BackgroundTasks AFTER returning the response, so
        # mock_ingest.called is observable post-response.
        with patch("app.api.documents.ingest_document") as mock_ingest, \
             patch("app.services.extraction_service.extract_composable") as mock_compose:
            mock_extracted = MagicMock()
            mock_extracted.text = "extracted text"
            mock_extracted.extractor_name = "composable[docling/docling_tf/pymupdf_full/docling_formula]"
            mock_compose.return_value = mock_extracted

            response = client.post(
                f"/documents/{DOC_ID}/reextract",
                headers=auth_headers,
                json={"engine": "docling"},
            )

        assert response.status_code == 202, f"Expected 202, got {response.status_code}: {response.text}"
        # extract_composable was called with engines_dict={'text': 'docling'}
        # (body.engine alias for the TEXT aspect).
        mock_compose.assert_called_once()
        compose_args = mock_compose.call_args.args
        # Positional: (raw_bytes, mime, engines_dict)
        assert len(compose_args) >= 3, f"extract_composable expected 3 positional args, got: {compose_args}"
        assert compose_args[2] == {"text": "docling"}, \
            f"Expected engines_dict={{'text':'docling'}}, got: {compose_args[2]!r}"
        # ingest_document scheduled with body.engine threaded through.
        mock_ingest.assert_called_once()
        ingest_args = mock_ingest.call_args.args
        # Positional shape (matches Plan 02 wiring): (doc_id, text, user_id, supabase, raw, mime, filename, engine_override, extracted_doc, extract_duration_ms)
        # engine_override is now the composer's extractor_name (composable[...]) which threads through.
        assert ingest_args[7] is not None, f"Expected engine_override set, got: {ingest_args[7]!r}"

    def test_reextract_invalid_engine_returns_422(self, client, auth_headers):
        """Invalid engine value → FastAPI auto-422 (Pydantic Literal validation).

        T-071-04-02 mitigation: invalid engine cannot reach the dispatcher.
        """
        response = client.post(
            f"/documents/{DOC_ID}/reextract",
            headers=auth_headers,
            json={"engine": "rust-pdf"},
        )
        assert response.status_code == 422, f"Expected 422, got {response.status_code}: {response.text}"

    def test_reextract_missing_engine_returns_422(self, client, auth_headers):
        """Missing engine field in body → FastAPI auto-422 (engine is required, no default)."""
        response = client.post(
            f"/documents/{DOC_ID}/reextract",
            headers=auth_headers,
            json={},
        )
        assert response.status_code == 422, f"Expected 422, got {response.status_code}: {response.text}"

    def test_reextract_owner_only_returns_404(self, client, auth_headers, mock_builder):
        """Cross-user reextract → 404 (NOT 403) to avoid leaking existence.

        T-071-04-01 mitigation: information-disclosure on IDOR attempt.
        Simulates user A targeting a document owned by user B — the .eq('user_id', current_user_id)
        filter returns no data, route raises 404.
        """
        mock_builder.execute.side_effect = [
            _make_result(None),  # owner SELECT — no row for this user_id; maybe_single returns None
        ]
        response = client.post(
            f"/documents/{DOC_ID}/reextract",
            headers=auth_headers,
            json={"engine": "docling"},
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        assert "Document not found" in response.json().get("detail", ""), \
            f"Expected 'Document not found' in detail, got: {response.json()}"

    def test_reextract_is_latest_false_returns_404(self, client, auth_headers, mock_builder):
        """Phase 071.2 D-071.2-08 (companion to D-071.2-10) — when a prior failed
        cascade leaves a document with is_latest=False, supabase-py's .maybe_single()
        raises on the .eq('is_latest', True) eliminating filter rather than returning
        .data=None. The /reextract route MUST wrap the owner SELECT in try/except and
        re-raise as HTTPException 404 — NOT 500.

        T-071.2-04-01 mitigation: bare raise (no `from e`) keeps the
        PostgrestAPIError off the response surface.
        """
        # Simulate supabase-py raising on .maybe_single().execute() — the empty-
        # eliminating-filter symptom from a prior failed cascade.
        mock_builder.execute.side_effect = Exception("PostgrestAPIError: empty maybe_single")

        response = client.post(
            f"/documents/{DOC_ID}/reextract",
            headers=auth_headers,
            json={"engine": "docling"},
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        assert response.json().get("detail") == "Document not found", \
            f"Expected detail='Document not found', got: {response.json()}"

    # ── Phase 071.1 D-071.1-02 / D-071.1-04 ────────────────────────────────────

    def test_reextract_docling_timeout_falls_back_to_pymupdf(
        self, client, auth_headers, mock_builder,
    ):
        """D-071.1-04 — Docling timeout triggers automatic PyMuPDF fallback (PDF body).

        Asserts the route catches asyncio.TimeoutError, writes the docling-failed
        telemetry row, re-dispatches via get_extractor(engine_override='pymupdf'),
        threads engine_used (not body.engine) through to background_tasks.add_task,
        and returns 202.
        """
        pdf_doc = {
            **_doc_row(doc_id=DOC_ID, status="completed"),
            "mime_type": "application/pdf",
            "filename": "thesis.pdf",
            "file_path": f"{USER_ID}/{DOC_ID}/thesis.pdf",
            "is_latest": True,
        }
        mock_builder.execute.side_effect = [
            _make_result(pdf_doc),                                       # owner SELECT
            _make_result([]),                                            # delete chunks
            _make_result([]),                                            # delete tables
            _make_result([]),                                            # delete images
            _make_result([{**pdf_doc, "status": "pending"}]),            # UPDATE documents
            _make_result([]),                                            # _write_extraction_run_row (docling failed)
        ]

        # Phase 071.2 Plan 05 — happy path goes through extract_composable; on
        # asyncio.TimeoutError the route falls back to get_extractor('pymupdf').
        pymupdf_mock = MagicMock()
        mock_extracted = MagicMock()
        mock_extracted.text = "fallback text"
        mock_extracted.tables = []
        mock_extracted.images = []
        pymupdf_mock.extract.return_value = mock_extracted

        with patch("app.api.documents.ingest_document") as mock_ingest, \
             patch("app.services.extraction_service.extract_composable",
                   side_effect=asyncio.TimeoutError()) as mock_compose, \
             patch("app.services.extraction_service.get_extractor",
                   return_value=pymupdf_mock) as mock_get_extractor:
            response = client.post(
                f"/documents/{DOC_ID}/reextract",
                headers=auth_headers,
                json={"engine": "docling"},
            )

        assert response.status_code == 202, f"Expected 202, got {response.status_code}: {response.text}"
        # extract_composable was called once (the body.engine='docling' alias path).
        mock_compose.assert_called_once()
        # get_extractor was called once (the pymupdf fallback path).
        mock_get_extractor.assert_called_once()
        gec_kwargs = mock_get_extractor.call_args.kwargs
        assert gec_kwargs.get("engine_override") == "pymupdf"
        # background_tasks.add_task receives engine_used='pymupdf-fallback' at positional index 7
        mock_ingest.assert_called_once()
        ingest_args = mock_ingest.call_args.args
        assert ingest_args[7] == "pymupdf-fallback", (
            f"Expected engine_override='pymupdf-fallback' at positional index 7, "
            f"got {ingest_args[7]!r}"
        )

    def test_reextract_docling_layer2_timeout_triggers_pymupdf_fallback(
        self, client, auth_headers, mock_builder,
    ):
        """D-071.1-02 — Layer 2 wall-clock fires; explicitly verify both get_extractor calls."""
        pdf_doc = {
            **_doc_row(doc_id=DOC_ID, status="completed"),
            "mime_type": "application/pdf",
            "filename": "thesis.pdf",
            "file_path": f"{USER_ID}/{DOC_ID}/thesis.pdf",
            "is_latest": True,
        }
        mock_builder.execute.side_effect = [
            _make_result(pdf_doc),
            _make_result([]),
            _make_result([]),
            _make_result([]),
            _make_result([{**pdf_doc, "status": "pending"}]),
            _make_result([]),  # docling-failed telemetry row
        ]
        # Phase 071.2 Plan 05 — extract_composable on happy path; get_extractor('pymupdf')
        # only on the wall-clock fallback.
        pymupdf_mock = MagicMock()
        mock_extracted = MagicMock()
        mock_extracted.text = "x"
        mock_extracted.tables = []
        mock_extracted.images = []
        pymupdf_mock.extract.return_value = mock_extracted
        with patch("app.api.documents.ingest_document"), \
             patch("app.services.extraction_service.extract_composable",
                   side_effect=asyncio.TimeoutError()) as mock_compose, \
             patch("app.services.extraction_service.get_extractor",
                   return_value=pymupdf_mock) as mock_get_extractor:
            response = client.post(
                f"/documents/{DOC_ID}/reextract",
                headers=auth_headers,
                json={"engine": "docling"},
            )
        assert response.status_code == 202
        mock_compose.assert_called_once()
        mock_get_extractor.assert_called_once()
        assert mock_get_extractor.call_args.kwargs.get("engine_override") == "pymupdf"

    def test_reextract_docling_timeout_and_pymupdf_failure_returns_422(
        self, client, auth_headers, mock_builder,
    ):
        """D-071.1-04 — Both engines fail → 422 + combined error detail + 2 telemetry rows."""
        pdf_doc = {
            **_doc_row(doc_id=DOC_ID, status="completed"),
            "mime_type": "application/pdf",
            "filename": "thesis.pdf",
            "file_path": f"{USER_ID}/{DOC_ID}/thesis.pdf",
            "is_latest": True,
        }
        mock_builder.execute.side_effect = [
            _make_result(pdf_doc),
            _make_result([]),
            _make_result([]),
            _make_result([]),
            _make_result([{**pdf_doc, "status": "pending"}]),
            _make_result([]),  # docling-failed telemetry row
            _make_result([]),  # pymupdf-fallback-failed telemetry row
        ]
        # Phase 071.2 Plan 05 — composer raises asyncio.TimeoutError; pymupdf
        # subprocess then dies.
        pymupdf_mock = MagicMock()
        pymupdf_mock.extract.side_effect = RuntimeError("pymupdf subprocess died")
        with patch("app.api.documents.ingest_document"), \
             patch("app.services.extraction_service.extract_composable",
                   side_effect=asyncio.TimeoutError()), \
             patch("app.services.extraction_service.get_extractor",
                   return_value=pymupdf_mock):
            response = client.post(
                f"/documents/{DOC_ID}/reextract",
                headers=auth_headers,
                json={"engine": "docling"},
            )
        assert response.status_code == 422
        detail = response.json()["detail"]
        assert "Docling timed out" in detail
        assert "PyMuPDF fallback also failed" in detail

    def test_reextract_explicit_pymupdf_timeout_does_NOT_fallback(
        self, client, auth_headers, mock_builder,
    ):
        """D-071.1-04 narrow guard — explicit non-Docling engine timeout fails loud, no fallback."""
        pdf_doc = {
            **_doc_row(doc_id=DOC_ID, status="completed"),
            "mime_type": "application/pdf",
            "filename": "thesis.pdf",
            "file_path": f"{USER_ID}/{DOC_ID}/thesis.pdf",
            "is_latest": True,
        }
        mock_builder.execute.side_effect = [
            _make_result(pdf_doc),
            _make_result([]),
            _make_result([]),
            _make_result([]),
            _make_result([{**pdf_doc, "status": "pending"}]),
        ]
        # Phase 071.2 Plan 05 — explicit body.engine='pymupdf' goes through
        # extract_composable with engines_dict={'text': 'pymupdf'}; on TimeoutError
        # the route raises 422 (NO fallback since body.engine != 'docling').
        with patch("app.api.documents.ingest_document"), \
             patch("app.services.extraction_service.extract_composable",
                   side_effect=asyncio.TimeoutError()):
            response = client.post(
                f"/documents/{DOC_ID}/reextract",
                headers=auth_headers,
                json={"engine": "pymupdf"},
            )
        assert response.status_code == 422
        assert "engine=pymupdf timed out after" in response.json()["detail"]
        assert mock_get_extractor.call_count == 1  # no second dispatch


# ── ingest_document full_markdown storage ──────────────────────────────────────

class TestFullMarkdown:
    def test_ingest_stores_full_markdown(self, mock_builder):
        """ingest_document stores full_markdown in the completion update."""
        from app.api.documents import ingest_document
        from tests.conftest import _supabase

        mock_builder.execute.side_effect = [
            _make_result([]),  # status -> processing
            _make_result([]),  # insert chunks
            _make_result([]),  # status -> completed (with full_markdown)
        ]

        with patch("app.api.documents.chunk_text", return_value=["chunk1"]), \
             patch("app.api.documents.embed_chunks", return_value=[[0.1, 0.2]]), \
             patch("app.api.documents.extract_metadata", return_value=None), \
             patch("app.api.documents.load_app_settings") as mock_settings:
            mock_settings.return_value.embedding_model = None
            ingest_document(DOC_ID, "Full document text here", USER_ID, _supabase)

        # Find the completion update call (the one with "completed" status)
        update_calls = mock_builder.update.call_args_list
        completion_call = [c for c in update_calls if "completed" in str(c)]
        assert len(completion_call) == 1
        update_dict = completion_call[0][0][0]  # first positional arg
        assert update_dict["full_markdown"] == "Full document text here"
        assert update_dict["status"] == "completed"

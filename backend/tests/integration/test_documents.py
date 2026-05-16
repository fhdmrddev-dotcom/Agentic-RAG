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
        mock_extracted.extractor_name = "composable[legacy/camelot/pymupdf_full/none]"

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
        # Side effects (order matches reingest_document after BUG-260516-04 fix):
        # 1=owner SELECT, 2=DELETE document_tables, 3=DELETE document_images,
        # 4=UPDATE status='pending' returning row.
        mock_builder.execute.side_effect = [
            _make_result(pdf_doc),                              # owner SELECT
            _make_result([]),                                    # DELETE tables (071.4-04)
            _make_result([]),                                    # DELETE images (071.4-04)
            _make_result([{**pdf_doc, "status": "pending"}]),   # UPDATE
        ]

        # Phase 071.2 Plan 05 — _upload_pipeline now routes PDF/DOCX through
        # extract_composable (per-aspect dispatcher) instead of get_extractor.
        mock_extracted = MagicMock()
        mock_extracted.text = "re-extracted text"
        mock_extracted.tables = []
        mock_extracted.images = []
        mock_extracted.extractor_name = "composable[legacy/camelot/pymupdf_full/none]"

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

    def test_reingest_deletes_prior_tables_and_images(self, client, auth_headers, mock_builder):
        """BUG-260516-04 regression — /reingest must delete prior document_tables
        AND document_images BEFORE queueing the BackgroundTask, mirroring
        /reextract's lines 803-811 cascade. Without this, every Reingest click
        accumulates rows on top of the existing set.

        Pre-fix behavior: 0 .delete() calls during the synchronous endpoint
        body. Post-fix behavior: 2 .delete() calls (one for document_tables,
        one for document_images).
        """
        from tests.conftest import _supabase as supabase_mock  # noqa: PLC0415

        pdf_doc = {
            **_doc_row(doc_id=DOC_ID, status="completed"),
            "mime_type": "application/pdf",
            "filename": "thesis.pdf",
            "file_path": f"{USER_ID}/{DOC_ID}/thesis.pdf",
            "is_latest": True,
        }
        mock_builder.execute.side_effect = [
            _make_result(pdf_doc),                              # owner SELECT
            _make_result([]),                                    # DELETE tables
            _make_result([]),                                    # DELETE images
            _make_result([{**pdf_doc, "status": "pending"}]),   # UPDATE
        ]

        mock_extracted = MagicMock()
        mock_extracted.text = "re-extracted text"
        mock_extracted.tables = []
        mock_extracted.images = []
        mock_extracted.extractor_name = "composable[legacy/camelot/pymupdf_full/none]"

        # Capture delete call count BEFORE the call (resets-fixture starts at 0)
        delete_calls_before = mock_builder.delete.call_count

        with patch("app.api.documents.ingest_document"), \
             patch("app.services.extraction_service.extract_composable",
                   return_value=mock_extracted):

            response = client.post(
                f"/documents/{DOC_ID}/reingest",
                headers=auth_headers,
            )

        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text}"
        )

        # Verify .delete() was invoked at least twice (once for tables, once
        # for images). Pre-fix this would have been zero.
        delete_calls_after = mock_builder.delete.call_count
        new_deletes = delete_calls_after - delete_calls_before
        assert new_deletes >= 2, (
            f"Regression (BUG-260516-04): /reingest must call .delete() at "
            f"least twice (once for document_tables, once for document_images). "
            f"Observed: {new_deletes} delete calls. Pre-fix, this was 0."
        )

        # Verify the two delete targets via supabase.table(...) call history.
        # supabase.table('document_tables') and supabase.table('document_images')
        # must both appear in the call args.
        table_args = [c.args[0] for c in supabase_mock.table.call_args_list]
        assert "document_tables" in table_args, (
            f"Regression: supabase.table('document_tables') never called. "
            f"table() args were: {table_args}"
        )
        assert "document_images" in table_args, (
            f"Regression: supabase.table('document_images') never called. "
            f"table() args were: {table_args}"
        )


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
        ingest_document scheduled with engine_override=body.engine."""
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

        # Phase 071.2 Plan 05 — /reextract dispatches via extract_composable
        # (per-aspect composer). When `?engines=` is absent and body.engine is
        # provided, the route builds engines_dict={'text': body.engine}.
        # Phase 071.3 Plan 04 (D-071.3-09): 'docling' removed from the Literal —
        # body.engine must be 'pymupdf' or 'legacy'.
        # The TestClient runs BackgroundTasks AFTER returning the response, so
        # mock_ingest.called is observable post-response.
        with patch("app.api.documents.ingest_document") as mock_ingest, \
             patch("app.services.extraction_service.extract_composable") as mock_compose:
            mock_extracted = MagicMock()
            mock_extracted.text = "extracted text"
            mock_extracted.extractor_name = "composable[legacy/camelot/pymupdf_full/none]"
            mock_compose.return_value = mock_extracted

            response = client.post(
                f"/documents/{DOC_ID}/reextract",
                headers=auth_headers,
                json={"engine": "pymupdf"},
            )

        assert response.status_code == 202, f"Expected 202, got {response.status_code}: {response.text}"
        # extract_composable was called with engines_dict={'text': 'pymupdf'}
        # (body.engine alias for the TEXT aspect).
        mock_compose.assert_called_once()
        compose_args = mock_compose.call_args.args
        # Positional: (raw_bytes, mime, engines_dict)
        assert len(compose_args) >= 3, f"extract_composable expected 3 positional args, got: {compose_args}"
        assert compose_args[2] == {"text": "pymupdf"}, \
            f"Expected engines_dict={{'text':'pymupdf'}}, got: {compose_args[2]!r}"
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
            json={"engine": "pymupdf"},
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
            json={"engine": "pymupdf"},
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        assert response.json().get("detail") == "Document not found", \
            f"Expected detail='Document not found', got: {response.json()}"

    # ── Phase 071.3 Plan 04 (D-071.3-09) — timeout fails loud, no fallback ────

    def test_reextract_timeout_returns_422_no_fallback(
        self, client, auth_headers, mock_builder,
    ):
        """Phase 071.3 Plan 04 (D-071.3-09): the Docling auto-fallback path was
        removed entirely. Any asyncio.TimeoutError from the composer surfaces
        as a 422 with `engine={body.engine} timed out after ...`. Operator
        recovery is via /reextract with a different `?engines=` hint.
        """
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

    # ── Phase 072 Plan 03 — retry_empty_descriptions_only branch ────────────

    def test_reextract_retry_empty_descriptions_only_branch(self, client, auth_headers, mock_builder):
        """Phase 072 D-072-04: ?retry_empty_descriptions_only=true SKIPS the
        delete cascade + extract_composable + ingest_document; ONLY loops
        over document_images.description='' rows and refills via describe_image.

        Assertions cover:
          - 202 response status (existing /reextract contract preserved).
          - extract_composable NOT called (retry bypasses the composer entirely).
          - ingest_document NOT scheduled (no background task).
          - load_app_settings called EXACTLY ONCE — by the ROUTE's retry-branch
            fork (BLOCKER 3). The HELPER itself never calls it; app_settings is
            INJECTED into the helper. The route-level call is wrapped in
            run_in_threadpool per D-v2.5-01.
          - Composite (image_index, page) matching key (WARNING 4) — rows match
            via the tuple, not bare image_index.
          - `_downscale_b64_for_vision` called before every describe_image
            (WARNING 3 — D-072-02 invariant shared with extract_and_store_images).
          - describe_image signature shape (b64, app_settings, client) honored
            in call_args; the app_settings positional is the SAME object the
            route loaded (proves injection, not re-load).
        """
        pdf_doc = {
            **_doc_row(doc_id=DOC_ID, status="completed"),
            "mime_type": "application/pdf",
            "filename": "thesis.pdf",
            "file_path": f"{USER_ID}/{DOC_ID}/thesis.pdf",
            "is_latest": True,
        }
        # Mock sequence — BLOCKER 3: NO load_app_settings supabase calls happen
        # inside the HELPER (app_settings is injected). The ROUTE's retry-branch
        # fork calls load_app_settings ONCE (patched below; the patched mock
        # returns a stub UserEffectiveSettings, so this does NOT consume a
        # mock_builder.execute slot).
        # Retry helper supabase sequence:
        #   1. owner SELECT returns the doc row.
        #   2. SELECT empty-description rows returns 2 rows ((image_index=0, page=1) and (image_index=2, page=3)).
        #   3. UPDATE row.id=img-1 (describe returned non-empty).
        #   4. UPDATE row.id=img-2 (describe returned non-empty).
        #   5. SELECT documents for the DocumentResponse shape.
        mock_builder.execute.side_effect = [
            _make_result(pdf_doc),  # owner SELECT
            _make_result([
                {"id": "img-1", "image_index": 0, "page": 1},
                {"id": "img-2", "image_index": 2, "page": 3},
            ]),  # SELECT empty rows (created_at < 5min ago — handled by .lt())
            _make_result([{"id": "img-1"}]),  # UPDATE img-1
            _make_result([{"id": "img-2"}]),  # UPDATE img-2
            _make_result(pdf_doc),  # SELECT documents for DocumentResponse
        ]

        # Patch the helper's collaborators. BLOCKER 3: load_app_settings is
        # patched at the route's import path (documents.py imports it at
        # module scope per line 20). The route calls it ONCE inside the
        # retry-branch fork; the helper NEVER calls it.
        with patch("app.api.documents.ingest_document") as mock_ingest, \
             patch("app.services.extraction_service.extract_composable") as mock_compose, \
             patch("app.services.multimodal_service.extract_pdf_images") as mock_extract_imgs, \
             patch("app.services.multimodal_service.describe_image") as mock_desc, \
             patch("app.services.multimodal_service._downscale_b64_for_vision") as mock_downscale, \
             patch("app.api.documents.load_app_settings") as mock_load_settings:
            # Stub the route-level load_app_settings call. Return a sentinel
            # object — describe_image is also patched, so the actual
            # UserEffectiveSettings shape doesn't matter; we only need
            # something non-None to satisfy the injection.
            app_settings_sentinel = MagicMock(name="app_settings_stub")
            mock_load_settings.return_value = app_settings_sentinel
            # Fresh image extraction returns 3 images keyed by (image_index, page).
            # Composite-key matching: (0,1) and (2,3) match the empty rows; (1,2) is extra.
            mock_extract_imgs.return_value = [
                {"page": 1, "image_index": 0, "b64_png": "B64FOR0", "width": 200, "height": 200},
                {"page": 2, "image_index": 1, "b64_png": "B64FOR1", "width": 200, "height": 200},
                {"page": 3, "image_index": 2, "b64_png": "B64FOR2", "width": 200, "height": 200},
            ]
            # Downscale is a no-op for the test — returns the input unchanged
            # so we can verify both the call AND the b64 plumbing downstream.
            mock_downscale.side_effect = lambda b64: b64
            mock_desc.side_effect = ["A figure of charts.", "A flowchart diagram."]

            response = client.post(
                f"/documents/{DOC_ID}/reextract?retry_empty_descriptions_only=true",
                headers=auth_headers,
                json={"engine": "pymupdf"},
            )

        assert response.status_code == 202, (
            f"Expected 202, got {response.status_code}: {response.text}"
        )
        # 1. extract_composable was NOT called (retry branch bypasses it).
        assert mock_compose.call_count == 0, (
            f"Expected 0 extract_composable calls in retry branch; got {mock_compose.call_count}"
        )
        # 2. ingest_document was NOT scheduled.
        assert mock_ingest.call_count == 0, (
            f"Expected 0 ingest_document schedule calls; got {mock_ingest.call_count}"
        )
        # 3. BLOCKER 3: route calls load_app_settings EXACTLY ONCE with NO ARGS
        # inside the retry-branch fork (D-v2.5-01 threadpool-wrapped). The HELPER
        # does NOT call it — app_settings is INJECTED. Verify both invariants
        # AND lock the no-args signature so future drift is caught:
        mock_load_settings.assert_called_once_with()
        assert mock_load_settings.call_count == 1, (
            f"Expected route to load_app_settings once for retry branch; "
            f"got {mock_load_settings.call_count}. Helper must NOT call load_app_settings."
        )
        # 4. WARNING 3: downscale helper called twice (once per matched row).
        assert mock_downscale.call_count == 2, (
            f"Expected 2 _downscale_b64_for_vision calls (one per matched row); "
            f"got {mock_downscale.call_count}"
        )
        # 5. describe_image was called twice (once per empty row matched by composite key).
        assert mock_desc.call_count == 2, (
            f"Expected 2 describe_image calls (one per matched empty row); got {mock_desc.call_count}"
        )
        # 6. WARNING 4: composite-key matching — describe_image got B64FOR0
        #    (matches (0,1)) and B64FOR2 (matches (2,3)); B64FOR1 (image_index=1)
        #    is NOT used because the empty rows are (0,1) and (2,3), not (1,2).
        first_call_args = mock_desc.call_args_list[0].args
        second_call_args = mock_desc.call_args_list[1].args
        # describe_image signature: (b64_png, app_settings, client=None)
        # Assert shape: args has at least 2 positional (b64 + app_settings).
        assert len(first_call_args) >= 2, (
            f"Expected describe_image call args to have shape (b64, app_settings, client); "
            f"got {first_call_args!r}"
        )
        # BLOCKER 3 follow-on: the app_settings positional passed to
        # describe_image is the SAME sentinel object the route loaded.
        # Proves injection (not a fresh load inside the helper).
        assert first_call_args[1] is app_settings_sentinel, (
            "describe_image's app_settings arg must be the route-loaded "
            "sentinel — proves injection (BLOCKER 3). Helper did not call "
            "load_app_settings itself."
        )
        assert second_call_args[1] is app_settings_sentinel, (
            "describe_image's app_settings arg must be the route-loaded "
            "sentinel on the SECOND call too — proves single-injection (BLOCKER 3)."
        )
        # B64 plumbing: assert both calls received one of the expected b64s.
        first_b64 = first_call_args[0]
        second_b64 = second_call_args[0]
        assert {first_b64, second_b64} == {"B64FOR0", "B64FOR2"}, (
            f"Expected describe_image to be called with B64FOR0 and B64FOR2 "
            f"(composite-key matches for (0,1) and (2,3)); "
            f"got {first_b64!r} and {second_b64!r}. "
            f"B64FOR1 (image_index=1) MUST NOT appear — (1,2) is not in the empty-rows list."
        )
        # 7. WARNING 3: downscale was called with the fresh b64 BEFORE describe_image.
        downscale_b64s = {c.args[0] for c in mock_downscale.call_args_list}
        assert downscale_b64s == {"B64FOR0", "B64FOR2"}, (
            f"Expected downscale to be called with the same b64s as describe_image; "
            f"got downscale={downscale_b64s!r}"
        )


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

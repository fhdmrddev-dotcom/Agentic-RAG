"""Integration tests for Email Attachment Cascade Isolation and Deduplication (Phase 229 TRUST-01, SC#3).

Verifies:
- SC#3: Email attachment cascade isolates failures; an error on attachment 1 does not drop attachment 2.
- G-2 & BUS-106 Inference: Two emails carrying an identical attachment both succeed and link correctly.
- Manifest auditability: Parent email metadata records metadata['attachments'] manifest.
- Reachability (G-6): Confirms email reaches the cascade via POST /documents/upload with .eml.
"""

from email.message import EmailMessage
import hashlib
import io
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.documents import ingest_document
from app.dependencies import get_current_user, get_supabase, get_user_supabase_client

USER_ID = "00000000-0000-0000-0000-000000000001"
EMAIL_1_ID = "11111111-1111-1111-1111-111111111111"
EMAIL_2_ID = "22222222-2222-2222-2222-222222222222"
ATT_1_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
ATT_2_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

MOCK_USER = {"id": USER_ID, "email": "user@example.com"}
MIME_EML = "message/rfc822"


def _build_synthetic_email(
    subject: str,
    body: str,
    attachments: list[tuple[str, bytes, str, str]],  # (filename, raw, maintype, subtype)
) -> bytes:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = "sender@example.com"
    msg["To"] = "user@example.com"
    msg.set_content(body)
    for filename, raw, maintype, subtype in attachments:
        msg.add_attachment(raw, filename=filename, maintype=maintype, subtype=subtype)
    return msg.as_bytes()


def _make_result(data):
    r = MagicMock()
    r.data = data
    return r


def _make_query_builder():
    b = MagicMock()
    b.eq.return_value = b
    b.neq.return_value = b
    b.is_.return_value = b
    b.order.return_value = b
    b.limit.return_value = b
    b.maybe_single.return_value = b
    b.single.return_value = b
    b.execute.return_value = _make_result([])
    return b


def _make_table_mock():
    t = MagicMock()
    select_b = _make_query_builder()
    update_b = _make_query_builder()
    delete_b = _make_query_builder()

    t.select.return_value = select_b
    t.update.return_value = update_b
    t.delete.return_value = delete_b

    def default_insert(data, *args, **kwargs):
        b = _make_query_builder()
        defaults = {
            "error_message": None,
            "chunk_count": None,
            "created_at": "2026-09-05T00:00:00+00:00",
            "updated_at": "2026-09-05T00:00:00+00:00",
        }
        if isinstance(data, dict):
            b.execute.return_value = _make_result([{**defaults, **data}])
        elif isinstance(data, list) and data:
            b.execute.return_value = _make_result([{**defaults, **d} if isinstance(d, dict) else d for d in data])
        else:
            b.execute.return_value = _make_result([])
        t._insert = b
        return b

    t.insert.side_effect = default_insert
    t._select = select_b
    t._update = update_b
    t._delete = delete_b
    return t


def _build_mock_supabase():
    client = MagicMock()
    tables = {
        "documents": _make_table_mock(),
        "document_chunks": _make_table_mock(),
        "document_relationships": _make_table_mock(),
        "document_tables": _make_table_mock(),
        "document_images": _make_table_mock(),
        "pdf_extraction_runs": _make_table_mock(),
        "audit_log": _make_table_mock(),
        "folders": _make_table_mock(),
    }
    client.table.side_effect = lambda name: tables.get(name, _make_table_mock())
    client._tables = tables
    client.storage = MagicMock()
    client.storage.from_.return_value = MagicMock()
    return client


def test_sc3_email_attachments_isolated_and_manifest_recorded():
    """SC#3: If attachment 1 fails extraction, attachment 2 still succeeds and links.

    Parent email metadata records both in metadata['attachments'].
    """
    sb = _build_mock_supabase()
    raw_email = _build_synthetic_email(
        subject="Project Report with Attachments",
        body="Attached are two files.",
        attachments=[
            ("corrupt.txt", b"corrupted bytes", "text", "plain"),
            ("valid.txt", b"healthy text content", "text", "plain"),
        ],
    )

    # Mock chunk recount
    sb._tables["document_chunks"]._select.execute.return_value = _make_result([])

    # Mock extract_text: raise on corrupt.txt, succeed on valid.txt
    def mock_extract(raw_data, mime):
        if b"corrupted" in raw_data:
            raise ValueError("Corrupt attachment stream")
        return raw_data.decode("utf-8", errors="ignore")

    with patch("app.api.documents.extract_text", side_effect=mock_extract), \
         patch("app.api.documents.extract_metadata", return_value=None), \
         patch("app.api.documents.embed_chunks", return_value=[[0.1] * 1536]), \
         patch("app.api.documents.load_app_settings") as mock_settings:

        mock_settings.return_value = MagicMock(
            metadata_enrichment_mode="legacy",
            embedding_model="text-embedding-3-small",
        )

        ingest_document(
            document_id=EMAIL_1_ID,
            text="Attached are two files.",
            user_id=USER_ID,
            supabase=sb,
            raw=raw_email,
            mime_type=MIME_EML,
            filename="email.eml",
        )

    # 1. Verify relationships were inserted for the valid attachment
    rel_inserts = sb._tables["document_relationships"].insert.call_args_list
    assert len(rel_inserts) >= 1, "At least one attachment relationship should be created"

    # 2. Verify parent email metadata update includes the attachment manifest
    doc_updates = sb._tables["documents"].update.call_args_list
    # Find the parent email's completion update (the outer ingest finishes last)
    completion_update = next(
        (c[0][0] for c in reversed(doc_updates) if c[0][0].get("status") == "completed"),
        None,
    )
    assert completion_update is not None, f"Expected completion update, got: {doc_updates}"
    meta = completion_update.get("metadata") or {}
    manifest = meta.get("attachments")
    assert manifest is not None, f"Expected attachments manifest in metadata, got: {meta}"
    assert len(manifest) == 2, f"Expected 2 manifest entries, got: {manifest}"

    # Verify statuses in manifest
    assert manifest[0]["filename"] == "corrupt.txt"
    assert manifest[0]["status"] == "failed"
    assert "Corrupt attachment stream" in manifest[0]["error"]

    assert manifest[1]["filename"] == "valid.txt"
    assert manifest[1]["status"] == "completed"


def test_bus106_identical_attachment_collision_linked():
    """BUS-106 Inference / G-2: Two distinct emails carrying an identical attachment

    both succeed and link correctly. The second attachment hits 23505 (the dedupe SELECT
    missed because the attachment was still pending), triggers on_conflict='link' re-query,
    and returns is_duplicate=True without raising 409.
    """
    sb = _build_mock_supabase()
    shared_pdf_content = b"%PDF-1.4 shared invariant statement content"
    shared_hash = hashlib.sha256(shared_pdf_content).hexdigest()

    raw_email_1 = _build_synthetic_email(
        subject="Email 1",
        body="Here is the invoice",
        attachments=[("statement.pdf", shared_pdf_content, "application", "pdf")],
    )

    mock_att_doc_1 = {
        "id": ATT_1_ID,
        "user_id": USER_ID,
        "filename": "statement.pdf",
        "file_path": f"{USER_ID}/{ATT_1_ID}/statement.pdf",
        "content_hash": shared_hash,
        "version_number": 1,
        "status": "pending",
    }

    with patch("app.api.documents.extract_text", return_value="Statement content"), \
         patch("app.api.documents.extract_metadata", return_value=None), \
         patch("app.api.documents.embed_chunks", return_value=[[0.1] * 1536]), \
         patch("app.api.documents.load_app_settings") as mock_settings:

        mock_settings.return_value = MagicMock(
            metadata_enrichment_mode="legacy",
            embedding_model="text-embedding-3-small",
        )

        # Ingest Email 1
        ingest_document(
            document_id=EMAIL_1_ID,
            text="Email 1 text",
            user_id=USER_ID,
            supabase=sb,
            raw=raw_email_1,
            mime_type=MIME_EML,
            filename="email1.eml",
        )

        # For Email 2:
        # Simulate race window:
        # 1. dedupe SELECT (status='completed') returns empty because Email 1 is still pending
        # 2. documents.insert encounters 23505 unique constraint collision
        # 3. requery (status <> 'failed') returns mock_att_doc_1
        orig_insert = sb._tables["documents"].insert.side_effect

        def email2_insert(data, *args, **kwargs):
            if isinstance(data, dict) and data.get("filename") == "statement.pdf":
                raise Exception("duplicate key value violates unique constraint 'documents_dedup_idx' 23505")
            return orig_insert(data, *args, **kwargs)

        def email2_select(*args, **kwargs):
            b = MagicMock()
            b.eq.return_value = b
            b.is_.return_value = b
            b.order.return_value = b
            b.limit.return_value = b
            b.maybe_single.return_value = b
            b.single.return_value = b

            def on_neq(col, val):
                b.execute.return_value = _make_result([mock_att_doc_1])
                return b

            b.neq.side_effect = on_neq
            b.execute.return_value = _make_result([])
            return b

        sb._tables["documents"].insert.side_effect = email2_insert
        sb._tables["documents"].select.side_effect = email2_select

        raw_email_2 = _build_synthetic_email(
            subject="Email 2",
            body="Here is the same invoice forwarded",
            attachments=[("statement.pdf", shared_pdf_content, "application", "pdf")],
        )

        # Reset relationship calls
        sb._tables["document_relationships"].insert.reset_mock()

        # Ingest Email 2 with identical attachment
        ingest_document(
            document_id=EMAIL_2_ID,
            text="Email 2 text",
            user_id=USER_ID,
            supabase=sb,
            raw=raw_email_2,
            mime_type=MIME_EML,
            filename="email2.eml",
        )

    # Verify Email 2 successfully inserted attached_to relationship pointing to ATT_1_ID
    rel_inserts = sb._tables["document_relationships"].insert.call_args_list
    assert len(rel_inserts) >= 1, "Email 2 must create relationship for shared attachment"
    rel_data = rel_inserts[0][0][0]
    assert rel_data["source_doc_id"] == ATT_1_ID
    assert rel_data["target_doc_id"] == EMAIL_2_ID
    assert rel_data["rel_type"] == "attached_to"

    # Verify Email 2 completion metadata manifest recorded status='linked'
    doc_updates = sb._tables["documents"].update.call_args_list
    email2_completion = next(
        (c[0][0] for c in reversed(doc_updates) if c[0][0].get("status") == "completed"),
        None,
    )
    assert email2_completion is not None, "Email 2 should reach status='completed'"
    manifest = email2_completion.get("metadata", {}).get("attachments", [])
    assert len(manifest) == 1
    assert manifest[0]["filename"] == "statement.pdf"
    assert manifest[0]["status"] == "linked"
    assert manifest[0]["document_id"] == ATT_1_ID
    assert manifest[0]["is_duplicate"] is True


def test_email_reachability_route_post_upload():
    """G-6 Reachability: Confirms email reaches the cascade via POST /documents/upload

    with message/rfc822 MIME type, queuing _upload_pipeline.
    """
    sb = _build_mock_supabase()
    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    app.dependency_overrides[get_user_supabase_client] = lambda: sb
    app.dependency_overrides[get_supabase] = lambda: sb

    raw_email = _build_synthetic_email(
        subject="Status",
        body="Hello world",
        attachments=[],
    )

    inserted_doc = {
        "id": EMAIL_1_ID,
        "user_id": USER_ID,
        "filename": "message.eml",
        "file_path": f"{USER_ID}/{EMAIL_1_ID}/message.eml",
        "file_size": len(raw_email),
        "mime_type": "message/rfc822",
        "status": "pending",
        "error_message": None,
        "chunk_count": None,
        "content_hash": hashlib.sha256(raw_email).hexdigest(),
        "folder_id": None,
        "version_number": 1,
        "is_latest": True,
        "created_at": "2026-09-05T00:00:00+00:00",
        "updated_at": "2026-09-05T00:00:00+00:00",
    }
    sb._tables["documents"]._insert.execute.return_value = _make_result([inserted_doc])

    with patch("app.api.documents._upload_pipeline") as mock_pipeline:
        with TestClient(app) as client:
            resp = client.post(
                "/documents/upload",
                files={"file": ("message.eml", io.BytesIO(raw_email), "message/rfc822")},
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 201
        doc_resp = resp.json()
        assert doc_resp["id"] is not None
        assert doc_resp["filename"] == "message.eml"
        assert doc_resp["mime_type"] == "message/rfc822"
        mock_pipeline.assert_called_once()
        args, kwargs = mock_pipeline.call_args
        # Verify document_id and mime_type passed to _upload_pipeline match minted row
        assert args[0] == doc_resp["id"]
        assert args[2] == "message/rfc822"

    app.dependency_overrides.clear()

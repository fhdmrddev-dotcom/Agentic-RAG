"""Phase 217 Plan 01 — the four new DocumentResponse fields are POPULATED, not declared.

⚠ THE LOAD-BEARING ASSERTION IN THIS FILE IS OVER THE SERIALIZED HTTP BODY OF A REAL ROUTE.

Phase 214's fourth blocker was a `set(model_fields) >= {...}` check that "passes unchanged on
a field that is `None` on every row for the life of the product". A declaration check cannot
see the defect this plan closes, because the defect was never in the query — `list_documents`
already does `select("*")` (documents.py:718), so `ingestion_step` and `extractor` were in the
dict the whole time and FastAPI's `response_model` was the only thing stripping them
(D-217-10). One declaration test is kept below, explicitly labelled as NOT coverage.

Fixtures / helper style copied from tests/integration/test_documents.py and
tests/test_knowledge_health.py — no new harness is invented here.
"""
from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest


USER_ID = "00000000-0000-0000-0000-000000000001"
DOC_ID = str(uuid4())
NOW = datetime.now(timezone.utc).isoformat()
FOLDER_ID = "00000000-0000-0000-0000-000000000099"

# ── Data helpers ──────────────────────────────────────────────────────────────


def _doc_row(
    doc_id=None,
    mime_type="text/plain",
    status="processing",
    ingestion_step=None,
    extractor=None,
    folder_id=None,
):
    """A `documents` row as `select("*")` returns it — the shape list_documents merges."""
    return {
        "id": doc_id or DOC_ID,
        "user_id": USER_ID,
        "folder_id": folder_id,
        "filename": "test.txt",
        "file_path": f"{USER_ID}/{doc_id or DOC_ID}/test.txt",
        "file_size": 13,
        "mime_type": mime_type,
        "status": status,
        "error_message": None,
        "chunk_count": None,
        "content_hash": "abc123hash",
        "created_at": NOW,
        "updated_at": NOW,
        "ingestion_step": ingestion_step,
        "extractor": extractor,
    }


def _make_result(data):
    r = MagicMock()
    r.data = data
    return r


# ── Phase 165 (MIG-02) org-membership mock routing ────────────────────────────
# `list_documents` -> get_globally_visible_folder_ids -> _resolve_caller_org_ids issues a
# leading `table("org_members")` query. Route THAT one to a canned result (table-name-keyed
# dispatch) so it never consumes an entry from the ordered `execute.side_effect` lists below.
# Copied verbatim from tests/integration/test_documents.py:55-75.
CALLER_ORG_ID = "00000000-0000-0000-0000-0000000000a1"


@pytest.fixture(autouse=True)
def _route_org_members(mock_builder):
    from tests.conftest import _supabase  # noqa: PLC0415

    org_result = MagicMock()
    org_result.data = [{"org_id": CALLER_ORG_ID}]
    org_builder = MagicMock()
    org_builder.select.return_value = org_builder
    org_builder.eq.return_value = org_builder
    org_builder.execute.return_value = org_result

    def _dispatch(name, *args, **kwargs):
        return org_builder if name == "org_members" else mock_builder

    _supabase.table.side_effect = _dispatch
    try:
        yield
    finally:
        _supabase.table.side_effect = None


def _list_documents_sequence(rows):
    """The four ordered executes `GET /documents` makes:
    own docs · global folder ids · document_tables count rows · document_images count rows.
    """
    return [
        _make_result(rows),
        _make_result([]),
        _make_result([]),
        _make_result([]),
    ]


# ── Case 1 — the D-217-10 fix, on the wire ────────────────────────────────────


def test_list_documents_serializes_ingestion_step_and_extractor(
    client, auth_headers, mock_builder
):
    """A mid-ingest row's stage and engine reach the browser on a COLD page load.

    ⚠ RED CONTROL for this case: revert the two `DocumentResponse` fields
    (`extractor` / `ingestion_step`, backend/app/models/document.py) and this test fails
    with a KeyError — the query already returned both columns, so the response_model was
    the only thing dropping them. Nothing else in the stack needs to change for it to go
    red, which is what makes this an honest control rather than a tautology.
    """
    mock_builder.execute.side_effect = _list_documents_sequence(
        [_doc_row(ingestion_step="embedding", extractor="docling")]
    )
    res = client.get("/documents", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["ingestion_step"] == "embedding"
    assert body[0]["extractor"] == "docling"


def test_list_documents_serializes_nulls_without_500(client, auth_headers, mock_builder):
    """A row that never entered the pipeline carries both fields as null, not absent.

    The defaults are what keep the five narrow-select routes alive (Pitfall 4); this
    asserts they serialize as present-and-null rather than being dropped from the body.
    """
    mock_builder.execute.side_effect = _list_documents_sequence([_doc_row()])
    res = client.get("/documents", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body[0]["ingestion_step"] is None
    assert body[0]["extractor"] is None


# ── Case 2 — applicability POPULATED, three mimes in ONE response ─────────────


def test_stage_applicability_populated_for_three_mimes_in_one_response(
    client, auth_headers, mock_builder
):
    """D-217-24 — the two booleans come from multimodal_service's own frozensets.

    All three rows travel in a single response body, so this also proves the computed
    fields are per-row and not a response-level constant.
    """
    rows = [
        _doc_row(doc_id=str(uuid4()), mime_type="application/pdf"),
        _doc_row(doc_id=str(uuid4()), mime_type="text/csv"),
        _doc_row(doc_id=str(uuid4()), mime_type="text/plain"),
    ]
    mock_builder.execute.side_effect = _list_documents_sequence(rows)
    res = client.get("/documents", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 3
    by_mime = {row["mime_type"]: row for row in body}

    pdf = by_mime["application/pdf"]
    assert pdf["tables_stage_applies"] is True
    assert pdf["images_stage_applies"] is True

    # ⚠ The two sets are NOT the same set: CSV has tables but never images.
    csv = by_mime["text/csv"]
    assert csv["tables_stage_applies"] is True
    assert csv["images_stage_applies"] is False

    txt = by_mime["text/plain"]
    assert txt["tables_stage_applies"] is False
    assert txt["images_stage_applies"] is False


def test_applicability_booleans_agree_with_the_service_predicates(
    client, auth_headers, mock_builder
):
    """ONE list, not two — the wire value IS the predicate's value for the same mime."""
    from app.services.multimodal_service import (
        images_stage_applies,
        tables_stage_applies,
    )

    mimes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/csv",
        "text/markdown",
    ]
    rows = [_doc_row(doc_id=str(uuid4()), mime_type=m) for m in mimes]
    mock_builder.execute.side_effect = _list_documents_sequence(rows)
    res = client.get("/documents", headers=auth_headers)
    assert res.status_code == 200
    for row in res.json():
        mime = row["mime_type"]
        assert row["tables_stage_applies"] is tables_stage_applies(mime), mime
        assert row["images_stage_applies"] is images_stage_applies(mime), mime


# ── Case 3 — narrow-select non-regression (Pitfall 4 / assumption A2) ─────────


def test_move_route_still_answers_and_body_validates(client, auth_headers, mock_builder):
    """PATCH /documents/{id}/move builds its response after a `select("id")` read.

    A REQUIRED new field on DocumentResponse would 500 this route. Assert it does not.
    """
    mock_builder.execute.side_effect = [
        _make_result({"id": DOC_ID}),      # owner check — narrow select("id")
        _make_result([_doc_row()]),        # update result
    ]
    res = client.patch(
        f"/documents/{DOC_ID}/move", headers=auth_headers, json={"folder_id": None}
    )
    assert res.status_code != 500
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == DOC_ID
    assert body["ingestion_step"] is None
    assert body["tables_stage_applies"] is False  # text/plain


def test_metadata_route_still_answers_and_body_validates(
    client, auth_headers, mock_builder
):
    """PATCH /documents/{id}/metadata reads a `select("metadata")` row first."""
    mock_builder.or_.return_value = mock_builder
    mock_builder.execute.side_effect = [
        _make_result({"metadata": {}}),    # owner check — narrow select("metadata")
        _make_result([]),                  # enabled custom field defs
        _make_result([_doc_row()]),        # update result
        _make_result([]),                  # audit insert (errors are swallowed anyway)
    ]
    res = client.patch(
        f"/documents/{DOC_ID}/metadata",
        headers=auth_headers,
        json={"field": "title", "value": "Renamed"},
    )
    assert res.status_code != 500
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == DOC_ID
    assert body["extractor"] is None
    assert body["images_stage_applies"] is False


# ── Case 4 — negative fence: no field may promise image bytes ────────────────


def test_no_field_promises_image_bytes(client, auth_headers, mock_builder):
    """`document_images` stores NO bytes (full-schema.sql:887-897) — the description IS
    the image. A key promising a picture on any document response would be a lie the
    frontend could render, so fence the wire shape rather than the source file.
    """
    forbidden = ("thumbnail", "image_data", "b64", "preview_url")
    mock_builder.execute.side_effect = _list_documents_sequence(
        [_doc_row(mime_type="application/pdf")]
    )
    res = client.get("/documents", headers=auth_headers)
    assert res.status_code == 200
    for row in res.json():
        for key in row:
            assert not any(f in key.lower() for f in forbidden), key


# ── Declaration check — kept, and explicitly NOT counted as coverage ─────────


def test_declaration_only_the_four_fields_exist_and_default():
    """⚠ THIS IS NOT COVERAGE. It passes unchanged on a field that is None on every row
    for the life of the product (Phase 214's fourth blocker). It is here only to name the
    defaults the narrow-select routes depend on. The population arms above are the test.
    """
    from app.models.document import DocumentResponse

    assert DocumentResponse.model_fields["extractor"].default is None
    assert DocumentResponse.model_fields["ingestion_step"].default is None
    # The two booleans are computed, not stored — they must NOT be settable fields.
    assert "tables_stage_applies" not in DocumentResponse.model_fields
    assert "images_stage_applies" not in DocumentResponse.model_fields
    assert "tables_stage_applies" in DocumentResponse.model_computed_fields
    assert "images_stage_applies" in DocumentResponse.model_computed_fields


def test_the_four_new_row_models_import_from_models_document():
    """Plan 02's routes need these; DocumentQueryRow is deliberately NOT here (plan 03)."""
    import app.models.document as m

    for name in (
        "DocumentChunkRow",
        "DocumentTableRow",
        "DocumentImageRow",
        "DocumentContentResponse",
    ):
        assert hasattr(m, name), name
    assert not hasattr(m, "DocumentQueryRow")

"""Phase 112 (IN-05) — wire-level regression for CR-01.

CR-01: `DocumentResponse.metadata` coerces through `DocumentMetadata`. With the
Pydantic default (`extra="ignore"`) FastAPI's `response_model` serialization
silently strips the nested `_source` / `_confidence` provenance objects and every
enabled custom `field_key` — exactly the keys the document detail panel renders.

The existing Phase 112 backend tests call the route function directly and assert
on the raw `result.data[0]` dict, so they never exercise `response_model`
serialization and could not catch the strip. This file closes that gap two ways:

  1. `model_dump()` directly off `DocumentResponse(**row)` — the cheap unit check.
  2. A real FastAPI handler decorated with `response_model=DocumentResponse`
     driven through `TestClient` — this is the ACTUAL wire path (the same
     coercion `GET /documents` and `PATCH /documents/{id}/metadata` go through),
     so it proves the strip is gone end-to-end at the HTTP boundary.

Both assert `_source`, `_confidence`, and a custom field_key survive. They FAIL
against the pre-fix model (`extra="ignore"`) and PASS after CR-01's
`ConfigDict(extra="allow")`.
"""

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.models.document import DocumentResponse


def _row_with_provenance() -> dict:
    """A raw `documents` row whose metadata carries the Phase 112 honesty keys:
    nested `_source` (per-field provenance), nested `_confidence` (per-field
    score), and a custom `field_key` ("renewal_date") outside the 7 built-ins."""
    return {
        "id": str(uuid4()),
        "user_id": str(uuid4()),
        "folder_id": None,
        "filename": "contract.pdf",
        "file_path": "user/contract.pdf",
        "file_size": 4096,
        "mime_type": "application/pdf",
        "status": "completed",
        "error_message": None,
        "chunk_count": 12,
        "content_hash": "abc123",
        "version_number": 1,
        "is_latest": True,
        "metadata": {
            "title": "Service Agreement",
            "_source": {"title": "user"},
            "_confidence": {"author": 0.82, "summary": 0.41},
            "renewal_date": "2026-01-01",
        },
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "table_count": 0,
        "image_count": 0,
    }


def test_document_response_model_dump_preserves_provenance_and_custom_keys():
    """Direct model round-trip: DocumentResponse(**row).model_dump() must keep
    _source, _confidence, and the custom field_key. (Pre-CR-01 these were stripped.)"""
    meta = DocumentResponse(**_row_with_provenance()).model_dump()["metadata"]

    assert meta["title"] == "Service Agreement", "built-in field still round-trips"
    assert meta.get("_source") == {"title": "user"}, (
        "nested _source provenance must survive response_model serialization"
    )
    assert meta.get("_confidence") == {"author": 0.82, "summary": 0.41}, (
        "nested _confidence scores must survive response_model serialization"
    )
    assert meta.get("renewal_date") == "2026-01-01", (
        "custom field_key must survive response_model serialization"
    )


def test_fastapi_response_model_wire_shape_preserves_provenance_and_custom_keys():
    """The REAL wire path: a handler with response_model=DocumentResponse driven
    through TestClient — the same coercion GET /documents + PATCH 200 go through.
    Proves the HTTP body still carries _source / _confidence / custom keys."""
    app = FastAPI()
    row = _row_with_provenance()

    @app.get("/_probe", response_model=DocumentResponse)
    async def _probe():
        # Return the raw row dict exactly like the real routes return
        # result.data[0] — FastAPI coerces it through response_model on the way out.
        return row

    client = TestClient(app)
    resp = client.get("/_probe")
    assert resp.status_code == 200, resp.text
    meta = resp.json()["metadata"]

    assert meta["title"] == "Service Agreement"
    assert meta.get("_source") == {"title": "user"}, (
        "nested _source must reach the client over the wire (CR-01 regression)"
    )
    assert meta.get("_confidence") == {"author": 0.82, "summary": 0.41}, (
        "nested _confidence must reach the client over the wire (CR-01 regression)"
    )
    assert meta.get("renewal_date") == "2026-01-01", (
        "custom field_key must reach the client over the wire (CR-01 regression)"
    )

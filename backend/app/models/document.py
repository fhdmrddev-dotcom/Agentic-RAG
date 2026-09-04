from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, computed_field


class DocumentMetadata(BaseModel):
    # Phase 112 (CR-01): the document detail panel renders the nested `_source` /
    # `_confidence` provenance objects and enabled custom `field_key`s. With the
    # Pydantic default (`extra="ignore"`) FastAPI's response_model serialization
    # silently strips every non-built-in key from `GET /documents` and the PATCH
    # 200 body, so those keys never reach the client. `extra="allow"` lets them
    # survive serialization round-trip while the 7 built-ins stay typed.
    model_config = ConfigDict(extra="allow")

    title: str | None = None
    author: str | None = None
    date: str | None = None           # ISO 8601 preferred
    document_type: str | None = None  # "report", "tutorial", "article", etc.
    topics: list[str] | None = None
    language: str | None = None
    summary: str | None = None


class DocumentMoveRequest(BaseModel):
    folder_id: UUID | None  # None = move to root


class DocumentResponse(BaseModel):
    id: UUID
    user_id: UUID
    folder_id: UUID | None = None
    filename: str
    file_path: str
    file_size: int
    mime_type: str
    status: Literal["pending", "processing", "completed", "failed"]
    error_message: str | None
    chunk_count: int | None
    content_hash: str | None
    version_number: int = 1
    is_latest: bool = True
    metadata: DocumentMetadata | None = None
    created_at: datetime
    updated_at: datetime
    table_count: int = 0
    image_count: int = 0

    # Phase 217 (D-217-08) — the ingestion engine that produced this document
    # ("docling", "legacy", ...). A real `documents` column; DEFAULTED because five
    # routes build their response from a narrow select and a required field 500s them.
    extractor: str | None = None

    # Phase 217 (D-217-10) — the stage the ingestion pipeline last entered. Reaching the
    # browser ONLY through the Supabase Realtime payload until now, so a file already
    # mid-ingest when the Library opened showed no stage at all on a cold load (the
    # D-v2.5-03 failure — invisible to any test that mocks the fetch).
    #
    # ⚠ D-217-23 — THE COLUMN IS NEVER CLEARED. The completion update
    # (`documents.py:2266-2273`) writes status/chunk_count/metadata/full_markdown/extractor
    # and does NOT null this, so on a `completed` document it reads e.g. "metadata" by
    # RESIDUE, not by fact. `text_sanitize.py:9` diagnoses BUG-260825-01 precisely by
    # reading the pair `status=failed / ingestion_step=embedding` — which is the ONLY
    # honest way to read it. Clients must not consult this field on a completed row.
    ingestion_step: str | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def tables_stage_applies(self) -> bool:
        """Would the ingestion pipeline's table stage look at this document's MIME type?

        Derived from `mime_type` so it is populated on EVERY route returning a
        DocumentResponse rather than on the one route somebody remembered.

        ⚠ The import is DEFERRED into the property body on purpose: a module-level
        import is a circular import
        (`models.document` -> `multimodal_service` -> `embedding_service` -> `models.document`).
        Pure set membership on a string — no I/O, no await (T-217-02).
        """
        from app.services.multimodal_service import (  # noqa: PLC0415
            tables_stage_applies as _applies,
        )
        return _applies(self.mime_type)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def images_stage_applies(self) -> bool:
        """Would the ingestion pipeline's image stage look at this document's MIME type?

        PDF and DOCX only — deliberately narrower than `tables_stage_applies`.
        Same deferred-import rationale as above.
        """
        from app.services.multimodal_service import (  # noqa: PLC0415
            images_stage_applies as _applies,
        )
        return _applies(self.mime_type)


# ── Phase 217 · document-content row models (the routes plan 02 adds) ─────────

class DocumentChunkRow(BaseModel):
    id: UUID
    chunk_index: int
    content: str
    # D-217-08 rides here: the embedding lineage of the chunk, not of the document.
    embedding_model: str | None = None
    embedding_dimensions: int | None = None


class DocumentTableRow(BaseModel):
    id: UUID
    page: int | None = None
    table_index: int
    headers: list[str] = []
    rows: list[list[str]] = []
    extractor: str | None = None


class DocumentImageRow(BaseModel):
    id: UUID
    page: int | None = None
    image_index: int
    # ⚠ `document_images` stores NO image bytes. Measured columns: id, document_id,
    # user_id, page, image_index, description, created_at, bbox, org_id
    # (full-schema.sql:887-897) — the encoded PNG is handed to the vision model and
    # DISCARDED. So the description IS the image here, and no field promising a picture
    # may ever be added: it would promise a thing that does not exist.
    description: str = ""


class DocumentContentResponse(BaseModel):
    # Shape-mirrors `app.models.kb.ReadResponse` (kb.py:70-76), plus `has_more`.
    document_id: UUID
    filename: str
    total_lines: int
    content: str
    start_line: int | None = None
    end_line: int | None = None
    has_more: bool = False


# ⚠ `DocumentQueryRow` is deliberately NOT here — it lives in
# `backend/app/api/document_queries.py` (plan 03) so the service-role carve-out keeps
# ONE auditable rationale, next to the code that needs it.

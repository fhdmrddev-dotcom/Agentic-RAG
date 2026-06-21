from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


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

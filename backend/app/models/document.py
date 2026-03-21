from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class DocumentMetadata(BaseModel):
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
    metadata: DocumentMetadata | None = None
    created_at: datetime
    updated_at: datetime

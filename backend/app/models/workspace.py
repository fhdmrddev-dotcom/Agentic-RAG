from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class WorkspaceFileResponse(BaseModel):
    id: UUID
    path: str
    size_bytes: int
    mime_type: str
    created_at: datetime
    updated_at: datetime


class WorkspaceVersionResponse(BaseModel):
    id: UUID
    version: int
    size_bytes: int
    created_at: datetime


class WorkspaceDiffResponse(BaseModel):
    path: str
    from_version: int
    to_version: int
    delta: dict
    stats: dict


class WorkspaceFileDetailResponse(BaseModel):
    id: UUID
    path: str
    size_bytes: int
    mime_type: str
    content: str | None = None
    is_truncated: bool = False
    total_chars: int | None = None
    versions_count: int | None = None
    created_at: datetime
    updated_at: datetime

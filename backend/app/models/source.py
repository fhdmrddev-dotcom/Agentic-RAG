"""Phase 234 (LIB-08 / SURF-01 / VIS-05) — Wire models for folder watches & source sync."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class WatchCreateRequest(BaseModel):
    connection_id: UUID
    source_folder_id: str
    source_folder_name: str
    source_drive_id: str | None = None
    library_folder_id: UUID | None = None
    interval_minutes: int = Field(default=30, ge=5, le=1440)


class WatchUpdateRequest(BaseModel):
    interval_minutes: int | None = Field(default=None, ge=5, le=1440)
    is_active: bool | None = None
    library_folder_id: UUID | None = None
    clear_library_folder: bool = False


class WatchItemResponse(BaseModel):
    id: UUID
    watch_id: UUID
    external_id: str
    name: str
    path_hint: str = ""
    source_version: str | None = None
    source_modified_at: datetime | None = None
    content_hash: str | None = None
    document_id: UUID | None = None
    state: str = "present"
    first_seen_at: datetime | None = None
    last_seen_at: datetime | None = None
    missing_since: datetime | None = None
    last_error: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class WatchResponse(BaseModel):
    id: UUID
    org_id: UUID | None = None
    user_id: UUID
    connection_id: UUID
    source_folder_id: str
    source_folder_name: str
    source_drive_id: str | None = None
    library_folder_id: UUID | None = None
    interval_minutes: int = 30
    next_run_at: datetime | None = None
    leased_until: datetime | None = None
    is_active: bool = True
    last_run_at: datetime | None = None
    last_status: str = "pending"
    last_error: str | None = None
    item_count: int = 0
    connection_name: str | None = None
    service_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class WatchDetailResponse(WatchResponse):
    items: list[WatchItemResponse] = []


class WatchSyncResponse(BaseModel):
    status: str
    message: str


class WatchPurgeResponse(BaseModel):
    status: str
    purged_count: int
    message: str

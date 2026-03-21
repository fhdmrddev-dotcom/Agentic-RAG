from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class FolderCreate(BaseModel):
    name: str
    parent_id: UUID | None = None
    is_global: bool = False


class FolderUpdate(BaseModel):
    name: str


class FolderResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    parent_id: UUID | None
    is_global: bool
    created_at: datetime
    updated_at: datetime

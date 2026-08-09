from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class FolderCreate(BaseModel):
    name: str
    parent_id: UUID | None = None
    is_org_shared: bool = False


class FolderUpdate(BaseModel):
    name: str


class FolderMoveRequest(BaseModel):
    parent_id: UUID | None  # None = move to root


class FolderResponse(BaseModel):
    id: UUID
    # SEED-091 / D-164-05 (TEN-06): nullable owner. A non-owner reader of an is_org_shared
    # folder gets user_id=None at serialize time (the seeding owner's identity is not
    # disclosed). Mirrors the already-nullable ViewResponse.user_id (document_view.py:87).
    user_id: UUID | None
    name: str
    parent_id: UUID | None
    is_org_shared: bool
    created_at: datetime
    updated_at: datetime

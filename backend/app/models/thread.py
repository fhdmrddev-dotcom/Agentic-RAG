from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ThreadCreate(BaseModel):
    title: str = "New Chat"
    folder_id: UUID | None = None


class ThreadUpdate(BaseModel):
    title: str


class ThreadResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    folder_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

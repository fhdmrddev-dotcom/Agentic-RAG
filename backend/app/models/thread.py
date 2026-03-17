from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ThreadCreate(BaseModel):
    title: str = "New Chat"


class ThreadUpdate(BaseModel):
    title: str


class ThreadResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    created_at: datetime
    updated_at: datetime

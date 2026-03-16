from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ThreadCreate(BaseModel):
    title: str = "New Chat"


class ThreadResponse(BaseModel):
    id: UUID
    user_id: UUID
    openai_thread_id: str
    title: str
    created_at: datetime
    updated_at: datetime

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class MessageCreate(BaseModel):
    content: str
    model: str | None = None
    agent_mode: str = "default"   # "default" | "explorer"


class MessageResponse(BaseModel):
    id: UUID
    thread_id: UUID
    user_id: UUID
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime
    updated_at: datetime
    tool_calls: list[dict] | None = None

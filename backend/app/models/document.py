from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    id: UUID
    user_id: UUID
    filename: str
    file_path: str
    file_size: int
    mime_type: str
    status: Literal["pending", "processing", "completed", "failed"]
    error_message: str | None
    chunk_count: int | None
    created_at: datetime
    updated_at: datetime

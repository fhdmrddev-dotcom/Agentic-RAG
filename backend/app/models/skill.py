from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class SkillCreate(BaseModel):
    name: str
    description: str = ""
    instructions: str = ""
    is_global: bool = False


class SkillUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    instructions: str | None = None


class SkillResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    description: str
    instructions: str
    is_enabled: bool
    is_global: bool
    created_at: datetime
    updated_at: datetime


class SkillFileResponse(BaseModel):
    id: UUID
    skill_id: UUID
    user_id: UUID
    filename: str
    file_path: str
    file_size: int
    mime_type: str
    created_at: datetime


class SkillImportError(BaseModel):
    skill: str
    error: str


class SkillImportResult(BaseModel):
    created: list[SkillResponse]
    errors: list[SkillImportError]

from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class DocumentEntry(BaseModel):
    id: UUID
    filename: str
    status: str
    created_at: datetime


class FolderEntry(BaseModel):
    id: UUID
    name: str
    is_global: bool


class LsResponse(BaseModel):
    path: str
    folders: list[FolderEntry]
    documents: list[DocumentEntry]


class TreeNode(BaseModel):
    id: UUID
    name: str
    type: str  # "folder"
    is_global: bool
    truncated: bool
    children: list["TreeNode"]
    documents: list[DocumentEntry]


TreeNode.model_rebuild()  # Required for self-referential Pydantic v2 model


class TreeResponse(BaseModel):
    path: str
    depth: int | None
    tree: list[TreeNode]


class GrepMatch(BaseModel):
    document_id: UUID
    filename: str
    folder_id: UUID | None


class GrepResponse(BaseModel):
    pattern: str
    path: str | None
    matches: list[GrepMatch]
    total: int


class GlobMatch(BaseModel):
    document_id: UUID
    filename: str
    path: str  # Full path, e.g. "/reports/q1/report.pdf"
    folder_id: UUID | None


class GlobResponse(BaseModel):
    pattern: str
    matches: list[GlobMatch]
    total: int


class ReadResponse(BaseModel):
    document_id: UUID
    filename: str
    total_lines: int
    content: str
    start_line: int | None = None
    end_line: int | None = None

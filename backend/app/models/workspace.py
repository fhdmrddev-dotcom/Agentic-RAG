from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class WorkspaceFileResponse(BaseModel):
    id: UUID
    path: str
    size_bytes: int
    mime_type: str
    created_at: datetime
    updated_at: datetime


class WorkspaceVersionResponse(BaseModel):
    id: UUID
    version: int
    size_bytes: int
    created_at: datetime


class WorkspaceDiffResponse(BaseModel):
    path: str
    from_version: int
    to_version: int
    delta: dict
    stats: dict


class WorkspaceFileDetailResponse(BaseModel):
    id: UUID
    path: str
    size_bytes: int
    mime_type: str
    content: str | None = None
    is_truncated: bool = False
    total_chars: int | None = None
    versions_count: int | None = None
    created_at: datetime
    updated_at: datetime


class WorkspaceConnectionAttachRequest(BaseModel):
    """Phase 244 (SHELL-04 / D-244-05) — attach ONE connected-cloud file to THIS THREAD.

    ⛔ This is the body of a **thread-scoped workspace write**, and it is deliberately not a
    Library shape: it carries no ``folder_id``, because there is no folder — the bytes land in
    ``workspace_files`` under the 24h TTL read gate and **no ``documents`` row is minted at all**.
    That is what makes *"not in the KB"* structurally true rather than a promise (D-244-03).

    The Library's single-file cloud door is the OTHER model,
    :class:`app.models.connector.ConnectionFileImportRequest`, which requires a destination.
    """

    model_config = ConfigDict(extra="forbid")

    #: The connector connection the file lives in (org-scoped; resolved server-side).
    connection_id: str
    #: The provider's own id for the file, as returned by ``GET /connections/{id}/files``.
    file_id: str

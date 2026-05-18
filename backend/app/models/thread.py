from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.message import MessageResponse
from app.models.run import ActiveRunResponse


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


class ThreadSnapshotResponse(BaseModel):
    """Phase 075 D-075-01: one-round-trip reconcile primitive.

    Returns three pieces of state the frontend needs on thread switch:
      - messages: full history with run_id + run_status already merged
        (same shape as GET /threads/{id}/messages — D-063.1-15).
      - active_runs: streaming runs the requesting user owns on this thread
        (same shape as GET /threads/{id}/active-runs).
      - since_cursors: per-active-run Redis stream replay starting points
        (D-075-01 — server-derived from XINFO STREAM first-entry id).

    Composes existing MessageResponse + ActiveRunResponse verbatim — no new
    field shapes introduced (Claude's Discretion section of 075-CONTEXT.md).
    """
    messages: list[MessageResponse]
    active_runs: list[ActiveRunResponse]
    since_cursors: dict[str, str]

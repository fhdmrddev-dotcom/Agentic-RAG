"""Pydantic response models for /threads/{tid}/active-runs and related endpoints.

Phase 062 (D-062-04). Mirrors the convention of models/thread.py and
models/message.py — one file per resource, single response model class
per file unless additional shapes accrete.
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ActiveRunResponse(BaseModel):
    """Per-item shape of GET /threads/{thread_id}/active-runs.

    D-062-03: cursor field deliberately omitted — frontend always replays
    from since=0 since per-run buffer is bounded (MAXLEN 10000 ~= 2MB).
    D-062-02: status is always "streaming" on this endpoint, but the
    field is present for forward-compat (rejected ?include_terminal variant).
    """
    run_id: UUID
    started_at: datetime
    status: str

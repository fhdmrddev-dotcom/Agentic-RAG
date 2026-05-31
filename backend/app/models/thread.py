from datetime import datetime
from typing import Literal
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


class ThreadWorkflowState(BaseModel):
    """Phase 092 (SC#5 / D-v2.5-03) — the reconcile-via-fetch contract for a
    thread's Deep/Harness mode + workflow lock + current phase + Continue budget.

    Returned by ``GET /threads/{id}/workflow``. A PURE READ — the endpoint never
    writes the anchor (the lock-clear is owned by the cancel/terminal path, Plan
    03); ``lock_is_stale`` is a diagnostic self-heal signal only, so a thread is
    never stuck Harness-locked with a terminal/absent run.
    """

    thread_id: UUID
    # harness iff active_workflow_run_id IS NOT NULL.
    mode: Literal["deep", "harness"]
    # True iff a non-terminal workflow run holds the lock.
    locked: bool
    active_workflow_run_id: UUID | None
    # workflow_runs.status; None when the run row is absent.
    run_status: str | None
    definition_slug: str | None
    definition_name: str | None
    current_phase_slug: str | None
    current_phase_index: int | None
    total_phases: int | None
    # SC#5 heal: anchor set BUT the run row is missing or terminal.
    lock_is_stale: bool
    # CONT-01 / D-06 — a Continue affordance is currently pending.
    cap_paused: bool
    continues_used: int
    # 3 - continues_used (max_continues_per_run, D-06).
    continues_remaining: int

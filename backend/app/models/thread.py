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


class WorkflowPhaseState(BaseModel):
    """Phase 098-UAT run-honesty fix (B) — one ``workflow_phases`` row's durable
    per-phase status, surfaced so the frontend reconcile floor can rebuild an
    HONEST timeline for a terminal (completed/failed/cancelled) run instead of
    blanking it. ``status`` is DB-native (``pending`` / ``active`` / ``completed``
    / ``failed`` / ``skipped``); the frontend maps it to its Phase status union
    (``active`` -> ``running``, ``completed`` -> ``done``). Additive read.
    """

    slug: str
    phase_index: int
    status: str
    phase_type: str | None = None


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
    # Facet C (092-07) — the thread's latest producer `runs.run_id` WHEN it is live
    # (non-terminal). The frontend re-subscribes GET /runs/{id}/stream to re-attach
    # a startup-sweep-resumed run's live stream on mount/reconcile with no page
    # action. None when the latest producer row is terminal/absent. Surfaced as a
    # PURE additive read (reuses the existing F2 self-heal SELECT — no new query,
    # no write; the 092-05 F2 invariant holds). Owner-scoped via the existing
    # get_thread_workflow ownership check.
    latest_producer_run_id: UUID | None = None
    # Phase 188 CR-03 — the workflow run this thread MOST RECENTLY held, resolved as
    # ``active_workflow_run_id`` when set ELSE the thread's latest ``workflow_runs`` row by
    # ``created_at``. It is the SAME value ``get_thread_workflow`` already computes to source
    # ``phases`` below, surfaced rather than recomputed: no new query, no write.
    #
    # WHY IT IS NEEDED. ``finish_run`` NULLs ``threads.active_workflow_run_id`` in the same
    # transaction as the terminal status (Phase 092 SC#2 — no dangling lock survives a
    # terminal run). So the live anchor is absent for exactly the runs a "re-open this run"
    # affordance exists to serve, and a consumer reading only the anchor can never reach a
    # FINISHED run. This field is the anchor that survives termination; the anchor above
    # remains the authority for mode / locked / lock_is_stale, which are unchanged.
    #
    # ADDITIVE and OPTIONAL — every existing consumer ignores it (the ``latest_producer_run_id``
    # precedent directly above is the same shape for the same reason).
    last_workflow_run_id: UUID | None = None
    # Phase 098-UAT run-honesty fix (B) — the run's durable per-phase status array
    # (ordered by phase_index), so the frontend reconcile floor can rebuild an
    # honest timeline for a TERMINAL run (which previously returned [] / blanked).
    # None for Deep / no run. Additive PURE read (one extra ordered SELECT on
    # workflow_phases, owner-scoped via the existing ownership gate; no write).
    phases: list[WorkflowPhaseState] | None = None

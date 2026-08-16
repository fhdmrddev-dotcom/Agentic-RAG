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
    # Phase 194.1 (D-09 AMENDED) — the LAST run's status and its two timestamps, keyed to
    # ``phases_source_run_id``: the SAME anchor-then-latest id that already sources ``phases``
    # below and ``last_workflow_run_id`` directly above. Nothing new is queried — both arms of
    # that resolution simply widen a SELECT they already issue.
    #
    # WHY THEY ARE NEEDED. ``run_status`` above is populated ONLY inside
    # ``if active_workflow_run_id is not None:`` (``threads.py:1091``; the plan quoted 1092 —
    # corrected on measurement). So after a stop, ``finish_run`` has NULLed the anchor and the
    # frame reads ``run_status = None`` / ``mode = "deep"`` / ``locked = False`` while
    # ``phases[]`` and ``last_workflow_run_id`` BOTH survive. That gap is these three fields:
    # the thread knows which run it held and how far it got, but not that it was stopped,
    # when it started, or when it last moved.
    #
    # ⚠ ``last_run_status`` is the ``workflow_runs.status`` of the LAST run this thread held.
    # It is NOT ``run_status`` above, which is the LIVE anchor's status and stays anchor-based
    # and byte-unchanged. Both are plain ``str | None`` and a swap TYPECHECKS — the same trap
    # ``last_workflow_run_id``'s own docblock records about the two id types.
    #
    # ⚠ THE ELAPSED ANCHOR IS ``created_at`` -> ``updated_at``, i.e. from QUEUED to LAST UPDATE,
    # and ``claimed_at`` is deliberately NOT offered. Measured (``WorkflowRunPage.tsx:759-768``):
    # 5 of 181 ``workflow_runs`` carry ``claimed_at`` and 0 of 149 COMPLETED rows do —
    # ``claim_run``'s CAS lease is the distributed-worker path and the in-process producer never
    # takes it, so a ``claimed_at`` anchor would be absent on essentially every run. Any surface
    # printing the interval owes that disclosure; it is not a wall-clock run duration.
    #
    # ADDITIVE and OPTIONAL — every existing consumer ignores all three (the
    # ``latest_producer_run_id`` and ``last_workflow_run_id`` precedents directly above are the
    # same shape for the same reason).
    last_run_status: str | None = None
    last_run_created_at: datetime | None = None
    last_run_updated_at: datetime | None = None
    # Phase 098-UAT run-honesty fix (B) — the run's durable per-phase status array
    # (ordered by phase_index), so the frontend reconcile floor can rebuild an
    # honest timeline for a TERMINAL run (which previously returned [] / blanked).
    # None for Deep / no run. Additive PURE read (one extra ordered SELECT on
    # workflow_phases, owner-scoped via the existing ownership gate; no write).
    phases: list[WorkflowPhaseState] | None = None

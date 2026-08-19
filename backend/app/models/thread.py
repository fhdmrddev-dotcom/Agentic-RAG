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


def declared_phase_measure(raw: object) -> tuple[int | None, str | None]:
    """Extract the executor-DECLARED ``(count, noun)`` from a phase's ``output`` jsonb.

    Phase 200 / D-07. A phase type declares a measure ONLY where a count is already a fact
    in its own output; the executor writes ``output["_measure"] = {"count", "noun"}``
    (``harness/phase_types.py``) and FOUR of the seven types write no such key at all.

    ⚠ **THIS IS THE ONE HOME FOR THE READ SIDE, and it is sited here on purpose.** It has
    exactly TWO consumers, and they are the two independent wire models for the same
    ``workflow_phases`` rows: ``WorkflowPhaseState`` below (the CHAT surface's workspace
    panel, via the ungated ``GET /threads/{id}/workflow``) and ``WorkflowRunPhaseRead``
    (``api/workflow_runs.py`` — the RUN PAGE, via the canvas-gated ``GET
    /workflow-runs/{id}``). A second copy is how the two surfaces come to disagree about
    the same row, which is the exact failure this phase exists to prevent. This module is
    already imported by both and carries no heavy dependencies, so it is the cheapest
    shared home; ``phase_types.py`` — where the WRITE side lives — pulls the provider
    services in at import time and cannot be reached from the API layer.

    ⚠ **``0`` AND ``None`` ARE DIFFERENT ANSWERS AND THIS FUNCTION MUST NOT COLLAPSE THEM.**
    ``(0, "sources")`` means the step searched and found nothing — a real measurement.
    ``(None, None)`` means this phase type declares no count at all. Hence the explicit
    ``isinstance(count, int)`` test rather than a truthiness check or an ``or None``: both
    of those silently turn an honest zero into an absence, and the client renders nothing
    for ``null`` while rendering "0 sources" for ``0``.

    ⚠ ``bool`` is excluded deliberately — it is a subclass of ``int`` in Python, so a stray
    ``{"count": true}`` would otherwise serialize as ``1``.

    Defensive by construction: this reads model-influenced jsonb, so every layer is
    ``isinstance``-guarded and anything unexpected degrades to ``(None, None)`` rather than
    raising. Never ``raw["_measure"]``.
    """
    if not isinstance(raw, dict):
        return None, None
    measure = raw.get("_measure")
    if not isinstance(measure, dict):
        return None, None
    count = measure.get("count")
    noun = measure.get("noun")
    if not isinstance(count, int) or isinstance(count, bool):
        return None, None
    if not isinstance(noun, str) or not noun:
        return None, None
    return count, noun


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

    # ── 200 (DES-02 / D-05 / D-07) — the same four facts `WorkflowRunPhaseRead` carries ──
    # ⚠ THIS IS A SECOND, INDEPENDENT WIRE MODEL FOR THE SAME `workflow_phases` ROWS, and
    # that is why these fields are duplicated here rather than shared. `WorkflowRunPhaseRead`
    # (`api/workflow_runs.py`) feeds the RUN PAGE through a canvas-gated route; this one
    # feeds the CHAT surface's workspace panel (PhaseTimeline / PhaseCard) through an
    # UNGATED one. **Widening only the other model would ship a run page with durations and
    # a chat panel without them** — the same facts, two surfaces, silently disagreeing.
    # The two models must be widened in the SAME commit; they are the two halves of one
    # contract, not a model and its copy.
    #
    # Semantics are identical and are stated once, in `WorkflowRunPhaseRead`'s field
    # descriptions. The two that matter most: a NULL timestamp means TIME NOT RECORDED
    # (there is no backfill — D-06), and `step_count` distinguishes `0` (a real measurement
    # of nothing) from `null` (this phase type declares no count) — never `?? 0`.
    started_at: datetime | None = None
    completed_at: datetime | None = None
    step_count: int | None = None
    step_noun: str | None = None


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

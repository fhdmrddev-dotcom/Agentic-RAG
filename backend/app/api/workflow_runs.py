"""Phase 188 (RUNVIZ-03 / D-188-14 / D-188-15) — give a workflow RUN an address.

There was no ``GET`` for a ``workflow_runs`` row anywhere in the tree before this: a run
could be watched while it streamed, and its phase spine could be reconciled *through its
thread* (``GET /threads/{id}/workflow``), but the run itself had no id-addressable read. So
a finished run could not be re-opened — only re-found. This module adds exactly ONE read
and nothing else.

**Why ``/workflow-runs/{id}`` and not ``/runs/{id}`` (D-188-15).** ``/runs/{run_id}`` is
already taken, and it means something DIFFERENT: the producer ``runs`` row (``runs.py``
mounts four routes under it). ``workflow_runs.id`` is a separate table with a separate id
space — the two collide in ``runs.py:714-729``, which has to resolve a ``workflow_runs.id``
handed to a ``runs`` route as a documented repair. Spelling this route ``/runs/{id}`` would
make that ambiguity permanent. The path is deliberate; do not "correct" it.

**Why the response carries the definition (D-188-14).** The run surface must render a
terminal run's spine + final per-node state with NO stream and NO second fetch, so the
payload is: the run, the definition VERSION THAT ACTUALLY RAN (joined on
``workflow_runs.definition_id`` — never resolved by slug, because the picker feed
``list_published_workflows`` only ever returns the CURRENT published version, which would
draw an old run against a definition it never executed), and the durable ``workflow_phases``
rows ordered by ``phase_index``.

**Security posture — the primary deliverable of this module.** The IDOR shape is "guess a
run uuid, read someone else's workflow definition + phase spine":

  * ownership is the FIRST thing the handler does — ``id`` AND ``user_id`` filtered on the
    SAME select, ``.maybe_single()``, 404 on a miss. Never 403, never 200-with-empty, and
    never a second query that would let a timing difference distinguish "not yours" from
    "not there";
  * the read runs through the **user-JWT** client (``get_user_supabase_client``), so the
    v3.4 membership RLS is the belt to the ownership check's braces;
  * ``Depends(require_canvas())`` stands ALONE (D-182-05 / D-188-16). It resolves the
    ``visual_workflow_canvas`` flag BEFORE auth, so anonymous / invalid-token / banned /
    operator all fold into the same byte-identical ``{"detail": "Not Found"}``. The
    403-raising visibility gate is NEVER stacked on it — a 403 admits the route
    exists-but-forbidden, which is exactly the disclosure the 404 posture exists to close.

⚠ The two symbols this module must NOT name — the 403-raising visibility dependency and the
shared current-user resolver — are deliberately left UNSPELLED in this docblock. Their
absence is fenced by a literal grep in ``188-03-PLAN.md``, and a fence that an explanatory
comment can satisfy is not a measurement (the 187-24 lesson). D-182-05 and WR-08 in
``dependencies.py`` name both symbols in full.

The path TEMPLATE is registered in ``middleware/canvas_gate.py``'s ``CANVAS_GATED_PATHS`` in
the same commit that mounts this router, which is what removes the route and its models from
``/openapi.json`` while the canvas is off.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from supabase import Client

from app.dependencies import (
    canvas_caller,
    get_user_supabase_client,
    require_canvas,
)
# 200 (D-07) — the ONE home for the `_measure` read side, shared with the SECOND wire
# model for these same rows (`WorkflowPhaseState`, the chat panel's). A local copy here
# is how the run page and the chat panel come to disagree about the same phase row.
from app.models.thread import declared_phase_measure
from app.utils.db import aexec

logger = logging.getLogger(__name__)

# ``require_canvas`` is applied PER-ROUTE, not at router level — ``workflows.py`` makes the
# same choice deliberately, so a future non-canvas read on this router cannot inherit a gate
# (or lose one) by accident.
router = APIRouter(prefix="/workflow-runs", tags=["workflow-runs"])


class WorkflowRunPhaseRead(BaseModel):
    """One durable ``workflow_phases`` row, as the run surface renders it.

    ``phase_type`` is DERIVED from the definition JSON, never read from a column — the
    ``workflow_phases`` table does not store it (the same derivation ``threads.py``'s
    reconcile performs; there is exactly one shape and this mirrors it rather than
    inventing a second).
    """

    slug: str
    phase_index: int
    status: str = Field(
        description=(
            "pending | active | completed | failed | skipped | recorded_not_sent | cancelled "
            "(the DB-native vocabulary). ``recorded_not_sent`` is migration 115's sixth "
            "literal (189 / D-05): an approved governed external action that RECORDED "
            "what it would have done and sent nothing. ``cancelled`` is migration 119's "
            "SEVENTH literal (194 / D-04): the phase that was RUNNING when the user stopped "
            "the run — it did not FAIL and was not SKIPPED, it ran and was interrupted. "
            "⚠ THE AUTHORITY IS ``supabase/migrations/119_workflow_phases_cancelled.sql``'s "
            "``ADD CONSTRAINT workflow_phases_status_check`` ARRAY, NEVER this prose — this "
            "description listed only six literals from Phase 194 until 194.1 corrected it, so "
            "derive the set from the constraint rather than trusting the sentence. "
            "The wire carries the SLUG (D-17) "
            "— the sentence a person reads is rendered by the client's vocabulary layer."
        )
    )
    phase_type: str | None = None

    # ── 200 (DES-02 / D-05 / D-07) — the measurable facts ────────────────────
    # ⚠ THESE FOUR FIELDS, THE `.select()` PROJECTION BELOW AND THE SERIALIZER MOVE IN
    # LOCKSTEP. Widening two of the three ships a green model and an empty field, because
    # this route declares `response_model=WorkflowRunRead` and FastAPI DROPS UNDECLARED
    # KEYS SILENTLY — 192.2 measured exactly that on `api/workflows.py`: a green db test
    # sitting beside an unchanged UI.
    started_at: datetime | None = Field(
        default=None,
        description=(
            "When this phase flipped to active. NULL means the time was NOT RECORDED — "
            "either the phase never ran, or it ran before migration 121 existed. ⚠ There "
            "is NO BACKFILL (D-06): a value derived from updated_at would be right for "
            "some rows and silently wrong for others, with nothing on the row to say "
            "which. Render nothing for a NULL; never render a zero duration."
        ),
    )
    completed_at: datetime | None = Field(
        default=None,
        description=(
            "When this phase reached a terminal status. NULL on a phase still running, on "
            "a SKIPPED phase (which never ran at all — D-06 calls that correct silence), "
            "and on every pre-migration-121 row."
        ),
    )
    step_count: int | None = Field(
        default=None,
        description=(
            "The per-step count DECLARED by this phase type, extracted server-side from "
            "the phase's own output (D-07). ⚠ `0` IS A REAL MEASUREMENT — a step that "
            "searched and found nothing genuinely measured zero — and it is NOT the same "
            "as `null`, which means THIS PHASE TYPE DECLARES NO COUNT AT ALL. Four of the "
            "seven types are always null here. Consumers must branch on `null` vs `0`, "
            "never coalesce with `?? 0`."
        ),
    )
    step_noun: str | None = Field(
        default=None,
        description=(
            "The noun for `step_count` — `sources` | `agents` | `fields`. Non-null iff "
            "`step_count` is non-null. AUTHORED COPY owned by the executor that declares "
            "it, deliberately domain-neutral: the client renders the pair verbatim and "
            "must never substitute a domain word of its own."
        ),
    )


class WorkflowRunRead(BaseModel):
    """One run + the definition version that RAN + the run's phase spine (D-188-14).

    Everything the run surface needs in ONE round trip. ``definition`` is the raw
    ``workflow_definitions.definition`` JSONB of the row this run's ``definition_id`` points
    at — the version that EXECUTED, not whatever is published now.
    """

    id: UUID
    thread_id: UUID
    definition_id: UUID
    workflow_name: str
    workflow_slug: str
    workflow_version: int
    status: str = Field(
        description="active | paused | cap_paused | completed | failed | cancelled"
    )
    created_at: datetime | None = None
    claimed_at: datetime | None = None
    updated_at: datetime | None = None
    definition: dict[str, Any] | None = None
    phases: list[WorkflowRunPhaseRead] = Field(default_factory=list)


def _coerce_definition(raw: object) -> dict[str, Any] | None:
    """Decode the ``definition`` JSONB column to a dict for the wire.

    PostgREST hands back a decoded object, but the shipped decoders in this tree
    (``workflows._coerce_definition``, the ``threads.py:1217`` reconcile) both tolerate a raw
    JSON STRING because asyncpg returns one when no pool codec is registered. Mirror that
    tolerance: a string is ``json.loads``-ed, a dict passes through, anything unparseable
    degrades to ``None`` (the client tolerates a missing definition).
    """
    if raw is None:
        return None
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            decoded = json.loads(raw)
        except (ValueError, TypeError):
            return None
        return decoded if isinstance(decoded, dict) else None
    return None


def _slug_to_phase_type(definition: dict[str, Any] | None) -> dict[str, str]:
    """Derive ``slug -> phase_type`` from the definition JSON (threads.py:1204-1226).

    The durable ``workflow_phases`` row carries no ``phase_type``, so the only honest source
    for a completed/historical run's per-phase glyph is the definition that ran. Defensive by
    design: a definition missing ``phases``, or a phase missing either half of the pair,
    simply contributes nothing and the field resolves ``None`` on the wire.
    """
    mapping: dict[str, str] = {}
    for phase in (definition or {}).get("phases", []) or []:
        if not isinstance(phase, dict):
            continue
        slug = phase.get("slug", "")
        phase_type = (phase.get("config") or {}).get("phase_type", "")
        if slug and phase_type:
            mapping[slug] = phase_type
    return mapping


@router.get(
    "/{workflow_run_id}",
    response_model=WorkflowRunRead,
    # D-182-05 / D-188-16 — this list holds require_canvas ALONE. The 403-raising visibility
    # gate must never join it (a 403 leaks the route's existence); see the module docblock.
    dependencies=[Depends(require_canvas())],
)
async def read_workflow_run(
    workflow_run_id: UUID,
    # WR-08: ``require_canvas`` above ALREADY validated this bearer token and published the
    # identity on ``request.state.canvas_caller``. Consume it — do NOT re-run the shared
    # current-user resolver, which would cost a 2nd GoTrue round-trip + a 2nd auth.users ban
    # query per request.
    current_user: dict = Depends(canvas_caller),
    # user-JWT (NOT service-role). The ``workflows.py:613`` analog this route otherwise copies
    # uses ``get_supabase`` and names its reason inline ("the grounding fidelity reads span the
    # owner's folder tree ... scoped BY HAND"). This route has no such reason: it is a plain
    # owner-scoped read, so CLAUDE.md's RLS rule applies and the v3.4 membership RLS backs the
    # ownership check below rather than being bypassed.
    supabase: Client = Depends(get_user_supabase_client),
) -> WorkflowRunRead:
    """PURE READ — one workflow run, the definition version that RAN, and its phase spine.

    Ownership-gated FIRST (T-092-04 — 404, never leak existence), then the definition row by
    ``definition_id`` and the durable ``workflow_phases`` rows ordered by ``phase_index``.
    NEVER writes. A run id belonging to another account is indistinguishable from one that
    does not exist: both take the SAME single-query path to the SAME 404.
    """
    # ── Step 1: ownership SELECT -> 404 (never leak existence; runs.py:700-750 idiom) ──
    # ``id`` and ``user_id`` are filtered on the SAME query on purpose. A two-step
    # "fetch, then compare owner" would answer a foreign id along a different (slower,
    # separately-failing) path than a nonexistent one, which is a probe channel.
    run_resp = await aexec(
        supabase.table("workflow_runs")
        .select("id, thread_id, definition_id, status, created_at, updated_at, claimed_at")
        .eq("id", str(workflow_run_id))
        .eq("user_id", current_user["id"])
        .maybe_single()
    )
    # ``aexec`` can return None (maybe_single on no row), hence the guard — runs.py:711.
    run = run_resp.data if run_resp is not None else None
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    # ── Step 2: the definition VERSION THAT RAN, by definition_id (D-188-14) ──
    # Never by slug: a slug resolves to the CURRENT published version, so re-opening an old
    # run would draw it against a definition it never executed.
    def_resp = await aexec(
        supabase.table("workflow_definitions")
        .select("slug, version, name, definition")
        .eq("id", str(run["definition_id"]))
        .maybe_single()
    )
    definition_row = (def_resp.data if def_resp is not None else None) or {}
    definition = _coerce_definition(definition_row.get("definition"))

    # ── Step 3: the durable phase spine, ORDER BY phase_index ──
    # ── 200 (DES-02): the projection, widened in LOCKSTEP with the model + serializer ──
    # ⚠ V4 ACCESS CONTROL IS UNCHANGED BY THIS WIDENING, and a reviewer will ask, so it is
    # answered here: these columns are added to a query ALREADY scoped by
    # `.eq("workflow_run_id", run["id"])`, where `run` came from the ownership select
    # above (id AND user_id on the SAME select). No second query, no new dependency, no
    # changed 404 body — and NO SCOPE WIDENS. A `.select("*")` would also "work" and
    # would WEAKEN the read by shipping whatever columns the table grows next; reject it.
    #
    # ⚠ `output` IS SELECTED BUT NEVER PUT ON THE WIRE. `_persist_output` stores each
    # executor's dict FULL AND INLINE, so this jsonb carries field_map, citations and
    # prompts. The SERIALIZER below extracts ONLY `_measure.count` / `_measure.noun` into
    # `step_count` / `step_noun`, and `WorkflowRunPhaseRead` declares no `output` field —
    # so `response_model`'s drop behaviour is what keeps the payload narrow. That is the
    # answer to RESEARCH's open question A7 with no second migration: the carrier stays
    # the jsonb, the exposure stays bounded, and the client never sees a prompt.
    phases_resp = await aexec(
        supabase.table("workflow_phases")
        .select("slug, phase_index, status, started_at, completed_at, output")
        .eq("workflow_run_id", str(run["id"]))
        .order("phase_index")
    )
    phase_rows = (phases_resp.data if phases_resp is not None else None) or []

    slug_to_type = _slug_to_phase_type(definition)
    phases = []
    for row in phase_rows:
        count, noun = declared_phase_measure(row.get("output"))
        phases.append(
            WorkflowRunPhaseRead(
                slug=row["slug"],
                phase_index=row["phase_index"],
                status=row["status"],
                phase_type=slug_to_type.get(row["slug"]),
                started_at=row.get("started_at"),
                completed_at=row.get("completed_at"),
                step_count=count,
                step_noun=noun,
            )
        )

    return WorkflowRunRead(
        id=run["id"],
        thread_id=run["thread_id"],
        definition_id=run["definition_id"],
        workflow_name=definition_row.get("name") or "",
        workflow_slug=definition_row.get("slug") or "",
        workflow_version=definition_row.get("version") or 0,
        status=run["status"],
        created_at=run.get("created_at"),
        claimed_at=run.get("claimed_at"),
        updated_at=run.get("updated_at"),
        definition=definition,
        phases=phases,
    )

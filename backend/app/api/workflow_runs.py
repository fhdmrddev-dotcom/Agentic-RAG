"""Phase 188 (RUNVIZ-03 / D-188-14 / D-188-15) — give a workflow RUN an address.

There was no ``GET`` for a ``workflow_runs`` row anywhere in the tree before this: a run
could be watched while it streamed, and its phase spine could be reconciled *through its
thread* (``GET /threads/{id}/workflow``), but the run itself had no id-addressable read. So
a finished run could not be re-opened — only re-found. This module originally added exactly
ONE read (read_workflow_run). SEED-190 (the run log / list_workflow_runs) and Phase 200.2
(D-09 / read_workflow_run_phase_citations) joined it as read-only siblings behind the same
access posture.

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

from fastapi import APIRouter, Depends, HTTPException, Query, status
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
#
# 200.1 (D-200.1-01) — `phase_output_object` is that same home's READ-SIDE UNWRAP, and the
# serializer below parses each row ONCE through it. `output` is a jsonb STRING SCALAR on
# 484 of 484 `completed` rows, so a second `isinstance(raw, dict)` test anywhere in this
# module would be dead on every row that matters — silently, because the absent arm renders
# honestly. There is one door; this module reads through it and never beside it.
from app.models.thread import declared_phase_measure, phase_output_object
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

    # ── 200.1 (RUN-04) — the deliverable, when the deliverable was WORDS ──────
    # ⚠ THIS FIELD JOINS THE LOCKSTEP ABOVE. The projection already selects `output`
    # (nothing new is asked for); the model and the serializer are what move here.
    #
    # ⚠ READ EXACTLY ONE KEY BY NAME. The serializer takes `obj.get("text")` and nothing
    # else — never an iteration over the object's keys, never a filtered copy, never a
    # deny-list. The bound is an ALLOW-LIST and the reason is measured, not stylistic: a
    # census of all 588 non-null `output` values on 2026-08-20 found NINETEEN distinct
    # keys, EIGHT of which (`answer`, `retrieved_ids`, `placeholder_keys`, `sub_questions`,
    # `sub_run_ids`, `failure`, `recorded_intent`, `_surfaced`) appear in no design
    # document at all. A deny-list of the keys anyone thought to name is already incomplete
    # on today's data, and this project recorded at Phase 185's security audit that such a
    # list cannot be made fail-closed. `tests/unit/test_200_1_deliverable_text.py` proves
    # the bound as a SET EQUALITY over the real response body, with a planted key that
    # exists nowhere in the product as the positive control.
    deliverable_text: str | None = Field(
        default=None,
        description=(
            "This phase's own `output[\"text\"]` — the answer the step produced, verbatim. "
            "`null` means this step wrote no text: the key was absent, the output was not "
            "an object, or the text was empty. ⚠ AN EMPTY STRING IS NEVER SHIPPED — an "
            "empty answer and no answer are not two facts worth distinguishing on a "
            "surface whose job is to say what was produced, and a client branching on "
            "truthiness would fold them anyway. The name is `deliverable_text` and NOT "
            "`output_text` on purpose: it argues against a future `output_*` family, "
            "because every other key on that jsonb is internal by default."
        ),
    )

    # ── 214 (STEP-04 / STEP-05 / D-214-23) — WHY A STEP FAILED, AND WHAT IT WAS ──────
    # ⚠ THESE FOUR JOIN THE LOCKSTEP ABOVE, AND THEY ALSO JOIN THE TWO-WIRE-MODEL RULE:
    # `models/thread.py`'s `WorkflowPhaseState` gains the SAME four in the SAME commit.
    # `D-200.1-02-A` (the one recorded exception, below) was CONSIDERED and does NOT apply
    # — nothing renders the failure reason on the chat panel today; `PhaseCard.tsx:253`
    # fires the `reason_unknown` sentinel instead, which is precisely the disagreement the
    # rule exists to prevent.
    #
    # ⚠ THE PROJECTION ASKS FOR NOTHING NEW. `output` was already selected, and the reason
    # is read off the SAME single `phase_output_object` parse that already feeds `step_count`
    # and `deliverable_text` — a third fact off one door, never a second door.
    failure_reason: str | None = Field(
        default=None,
        description=(
            "Why this step failed, in the adapter's or the gate's OWN words, read from the "
            "phase's `output[\"_failure_reason\"]` (written by `db/workflows.py::fail_phase` "
            "on every failure). ⚠ `null` MEANS NOT RECORDED — it is the fact the panel's "
            "`reason_unknown` sentinel exists to state honestly. **An empty string is NOT a "
            "synonym for it and is never shipped**: `fail_phase` always writes a non-empty "
            "reason, so `\"\"` is impossible by construction, and one read anyway is "
            "normalised to `null` rather than passed through — collapsing the two would cost "
            "the sentinel its meaning. Non-null on failed steps only."
        ),
    )
    tool_name: str | None = Field(
        default=None,
        description=(
            "The ACTION this step runs, by its wire name — the tool on the bound connection "
            "(`config.tool_name` in the definition that executed). `null` for every phase "
            "type that is not `external_action`, and for an external step that names only a "
            "native capability. Never guessed from the slug."
        ),
    )
    capability: str | None = Field(
        default=None,
        description=(
            "The native capability this step runs (`send_email` | `create_ticket` | "
            "`post_message`), from the same config. `null` on an MCP step, which carries a "
            "`tool_name` and no capability at all — that absence is a fact, not a gap."
        ),
    )
    service_name: str | None = Field(
        default=None,
        description=(
            "The SERVICE a person would name — the bound connection row's display `name`, "
            "resolved at READ time. ⚠ **COMPUTED, NEVER STORED** (D-213-02 / D-214-14): a "
            "stored copy goes stale the moment the connection is renamed. ⚠ `null` is a "
            "LEGITIMATE value and means the connection could not be resolved (deleted, "
            "another org's, or none bound) — the surface then renders the ACTION ALONE. "
            "**Never a substitute string**: not \"Unknown service\", not the capability id, "
            "not the connection id. `grounding.py`'s shipped rule, unchanged on a new "
            "surface: never draw a name the system cannot know."
        ),
    )


# ─── D-200.1-02-A — THE SECOND WIRE MODEL IS DELIBERATELY NOT WIDENED ────────────────────
#
# `models/thread.py`'s `WorkflowPhaseState` carries a lockstep rule in writing: it and
# `WorkflowRunPhaseRead` are "the two halves of one contract", to be widened in the SAME
# commit. `deliverable_text` is the recorded EXCEPTION, and the exception is written in BOTH
# places so a reader of the rule finds it where the rule is.
#
# The rule's own stated purpose is to prevent "the same facts, two surfaces, silently
# disagreeing". That does not apply here, because **the chat surface already renders this
# text — it is the assistant's message.** Adding the field there would put a SECOND rendering
# of the same words on the same screen, which is exactly the duplication `RunTranscript`'s
# reason 2 removed from the run page. Timestamps and counts were different: NEITHER surface
# had them, so widening only one would have been a real disagreement.
#
# It is also strictly the narrower door. `GET /threads/{id}/workflow` — the route that serves
# `WorkflowPhaseState` — carries no `require_canvas`; this one does. Declining the widening
# keeps this phase's new exposure behind the gated read (T-200.1-11).
#
# ⚠ RE-OPEN TRIGGER, NAMED SO IT IS NOT A SILENCE: a chat-surface affordance that needs the
# deliverable INDEPENDENTLY of the message stream.
#
# ─── D-200.1-02-B — THE TEXT SHIPS WHOLE, ON EVERY ROW THAT HAS ONE, UNCLAMPED ───────────
#
# Measured over the same census: max 38,935 characters on one row, mean 3,871, p95 15,431 —
# so a five-step run typically ships ~19 KB and a worst case ~195 KB, the same order as the
# `definition` this route already ships whole in ONE payload.
#
# The two alternatives were both rejected for the same reason: they are invisible on the wire.
#   · Populating only the FINAL row is a serializer rule a client cannot see — the "green DB
#     test beside an unchanged UI" shape this module's own comments warn about, and it would
#     silently defeat the client's "last row with text" derivation the moment a run's closing
#     step emits a file.
#   · Clamping without a second signalling field is a SILENT TRUNCATION, and this surface
#     does not lie by omission.
#
# ⚠ RE-OPEN TRIGGER: the first surface that reads this field for a LIST of runs rather than
# for one run (T-200.1-13 is ACCEPTED on exactly that condition).
# ─────────────────────────────────────────────────────────────────────────────────────────


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
    # ⚠ 210 / ultrareview merged_bug_002 — DECLARED, SELECTED AND POPULATED IN LOCKSTEP.
    # `response_model` drops every key this model does not name, silently. Phase 210 shipped
    # the honest circuit-breaker sentence in `RunHero.tsx` reading `metadata.circuit_breaker`
    # while this field did not exist and the query never fetched the column, so the sentence
    # could not render on any run. Removing any ONE of the three restores that.
    metadata: dict[str, Any] | None = None
    phases: list[WorkflowRunPhaseRead] = Field(default_factory=list)


class WorkflowRunCitationRead(BaseModel):
    """One citation passage read lazily for a single phase of a workflow run.

    (a) ALLOW-LIST read: The serializer builds new dicts carrying only these four named keys
    and never copies `similarity` (D-10), which is a design decision per A-05 (a bare score
    is a figure nobody can act on).
    (b) The existing run serializer and its written only-text comment stay byte-unchanged (D-09) —
    this route is a new door, not a widened one.
    """

    document_id: str = Field(description="The UUID of the document that was cited.")
    filename: str = Field(description="The display filename of the cited document.")
    chunk_index: int | None = Field(
        default=None, description="0-indexed chunk index within the document, if recorded."
    )
    passage: str | None = Field(
        default=None, description="The textual passage retrieved during this step."
    )


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


def _parse_instant(raw: object) -> datetime | None:
    """One ``timestamptz`` from the wire, as a comparable ``datetime`` — or ``None``.

    ⚠ ``None`` FOR ANYTHING UNREADABLE, NEVER A DEFAULT. A phase whose instant cannot be
    parsed contributes nothing to its run's span, so the run reports the span of the steps
    that DID record one, or no span at all. A fallback of ``datetime.min`` or of the run's
    ``created_at`` would manufacture a duration out of a missing measurement, which is the
    exact thing migration 121's no-backfill rule exists to prevent.
    """
    if isinstance(raw, datetime):
        return raw
    if isinstance(raw, str):
        try:
            return datetime.fromisoformat(raw)
        except ValueError:
            return None
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


# ══════════════════════════════════════════════════════════════════════════════════════
# SEED-190 — THE RUN LOG. Every run this caller has, newest first, in ONE place.
# ══════════════════════════════════════════════════════════════════════════════════════
#
# ⚠ IT IS NOT THE PER-WORKFLOW HISTORY SEED-190 ORIGINALLY ASKED FOR, and the difference is
# the operator's correction rather than a simplification. The seed was scoped *"the run
# history of that specific workflow"*; what is built is **one log of every run**, which the
# card's own door then FILTERS. Two reasons, both measurable on this database:
#
#   1. A workflow's runs span its published VERSIONS. ``workflow_runs.definition_id`` points
#      at ONE version row, so a naive per-definition list is a VERSION's history wearing a
#      workflow's name. Measured 2026-08-20: ``pm-weekly-status-report`` has **3 definition
#      rows and 21 runs**, and four more slugs span 2-3 versions each. The filter below is
#      therefore BY SLUG — it resolves every definition sharing the slug and lists runs
#      across all of them.
#   2. The complaint underneath the seed was *"in the chat area I cannot distinguish between
#      any regular chat or any workflow run"* — which is a question about ALL runs, not about
#      one workflow's. A per-workflow list answers it only if you already know which workflow
#      to look inside.
#
# ⚠ OWNER-SCOPED IN THE QUERY, exactly as the read above is, and for the same reason: the
# library feeds in ``db/workflows.py`` bypass RLS and record ``r.user_id = $1`` as
# SECURITY-BEARING. This route does not bypass RLS — it runs on the user-JWT client — but the
# ``user_id`` predicate is still written on the SAME select as everything else rather than
# left to the policy, so the read is correct on its own terms and RLS is the belt to its
# braces. There is no "all users" mode and no operator escape hatch here; adding one would be
# a cross-tenant disclosure, not a feature.
#
# ⚠ THE DEFINITION JSON IS NEVER ON THIS WIRE. The single-run read ships
# ``definition`` (or its migration-122 snapshot) because the run SURFACE has to draw a spine
# from it. A log draws no spine. Shipping it here would put 230 workflow documents on one
# response for a list of names and times — so the projection carries identity and timings and
# stops.
#
# ⚠ THE DURATION IS DERIVED FROM THE PHASE ROWS, NOT FROM ``workflow_runs``. ``created_at`` is
# when the row was INSERTED and ``updated_at`` is the last write of any kind; neither is the
# span of the work. ``min(started_at) → max(completed_at)`` across the run's phases IS that
# span, and it is the SAME reduction ``phaseDuration.runSpan`` performs on the client for the
# single-run surface — pre-computed here so the log does not have to ship every phase row.
# ⚠ Both are NULL for every run written before migration 121, and there is NO BACKFILL. The
# client has an arm for that (``PhaseTiming.not-recorded``); it must never print a zero.
# Measured 2026-08-20: **10 of 580** phase rows carry the pair, on 2 of 230 runs.


class WorkflowRunListItem(BaseModel):
    """One row of the run log: who ran, when, how it went, how long it took.

    ⚠ EVERY FIELD HERE IS ALSO ON ``WorkflowRunRead`` OR DERIVED FROM ITS PHASES. This is a
    narrower PROJECTION of the same facts, never a second vocabulary for them — a log that
    invented its own status words or its own duration would be the second home this project
    keeps recording as the defect.
    """

    id: UUID
    thread_id: UUID
    definition_id: UUID
    workflow_name: str
    workflow_slug: str
    workflow_version: int
    status: str = Field(
        description=(
            "active | paused | cap_paused | completed | failed | cancelled — the DB-native "
            "vocabulary, identical to the single-run read's. The sentence a person reads is "
            "rendered by the client's vocabulary layer (D-17)."
        )
    )
    created_at: datetime | None = None
    step_total: int = Field(
        default=0,
        description=(
            "How many ``workflow_phases`` rows this run has. ⚠ This is the number of STEPS "
            "THE RUN CREATED, which is a fact about the run; it is NOT the definition's "
            "current step count, which can have moved. `0` means the run has no phase rows "
            "at all."
        ),
    )
    started_at: datetime | None = Field(
        default=None,
        description=(
            "``min(started_at)`` across this run's phases — the run's ZERO. NULL means no "
            "phase of this run recorded a start: it was written before migration 121, or "
            "every step was routed around. ⚠ NEVER substitute ``created_at``: that is when "
            "the row was inserted, which is a different fact."
        ),
    )
    completed_at: datetime | None = Field(
        default=None,
        description=(
            "``max(completed_at)`` across this run's phases — the last step to finish. NULL "
            "on a run still going and on every pre-migration-121 row. Paired with "
            "``started_at`` this is the run's measured span; alone it is not a duration."
        ),
    )


class WorkflowRunListRead(BaseModel):
    """One page of the run log.

    ⚠ ``total`` IS THE COUNT UNDER THE SAME FILTER, not the caller's grand total. A log
    showing 50 of 230 and a log showing 50 of 50 are different screens, and the client cannot
    tell them apart from a page of rows alone.
    """

    runs: list[WorkflowRunListItem] = Field(default_factory=list)
    total: int = 0
    limit: int = 0
    offset: int = 0


@router.get(
    "",
    response_model=WorkflowRunListRead,
    # D-182-05 / D-188-16 — require_canvas ALONE, exactly as the single-run read above. The
    # 403-raising visibility gate must never join it; a 403 admits the route exists.
    dependencies=[Depends(require_canvas())],
)
async def list_workflow_runs(
    slug: str | None = Query(
        default=None,
        max_length=200,
        description=(
            "Restrict to one workflow, BY SLUG — every published and draft version sharing "
            "it. ⚠ Deliberately not a ``definition_id``: a workflow's runs span its "
            "versions, so a definition filter answers about a VERSION and calls it the "
            "workflow. Omit for the whole log."
        ),
    ),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(canvas_caller),
    supabase: Client = Depends(get_user_supabase_client),
) -> WorkflowRunListRead:
    """PURE READ — this caller's runs, newest first, with the identity and span of each.

    Four queries and no joins the client has to reassemble:

      1. (only when ``slug`` is given) the definition ids sharing that slug;
      2. the page of ``workflow_runs``, owner-scoped, ``created_at DESC, id DESC``;
      3. the identity (``name`` / ``slug`` / ``version``) of the definitions on that page;
      4. the phase timings for the runs on that page, reduced to one span each.

    NEVER writes. An empty page is an empty page — it is never a 404, because "you have no
    runs" is a true answer and not a missing resource.
    """
    # ── Step 1: the slug filter, resolved to definition ids ACROSS VERSIONS ──
    #
    # ⚠ THE DEFINITION LOOKUP IS NOT OWNER-SCOPED AND DOES NOT NEED TO BE. It reads only
    # ``id`` for rows matching a slug the caller supplied, and its output is used ONLY as an
    # ``in`` list on a select that is ALSO filtered by ``user_id``. A definition the caller
    # cannot see contributes ids that match none of their runs, so the intersection is empty
    # rather than leaky. Scoping it would additionally BREAK the honest case: shared/global
    # starter definitions are owned by somebody else and the caller's runs of them are still
    # the caller's runs.
    definition_ids: list[str] | None = None
    if slug is not None:
        slug_resp = await aexec(
            supabase.table("workflow_definitions").select("id").eq("slug", slug)
        )
        definition_ids = [
            str(row["id"]) for row in ((slug_resp.data if slug_resp is not None else None) or [])
        ]
        # ⚠ AN UNKNOWN SLUG IS AN EMPTY LOG, NOT AN UNFILTERED ONE. Without this early return
        # the ``in`` filter below would be skipped for an empty list and the caller would be
        # handed EVERY run under the name of a workflow that does not exist — the failure mode
        # a `if ids:` guard invites and the reason this returns rather than falls through.
        if not definition_ids:
            return WorkflowRunListRead(runs=[], total=0, limit=limit, offset=offset)

    # ── Step 2: the page of runs ──
    #
    # ⚠ ``count="exact"`` COSTS A SECOND SCAN AND IS WORTH IT HERE. Without it the client
    # cannot say "50 of 230" and would have to infer the end of the log from a short page,
    # which is wrong on the exact boundary where the last page is full. 230 rows today; the
    # recorded re-open trigger for every unindexed read in this area is ~10k runs.
    #
    # ⚠ THE ORDER IS ``created_at DESC, id DESC`` — the SAME total order
    # ``_LAST_RUN_LATERAL_SQL`` uses, and the tiebreaker is not decorative. ``now()`` is
    # transaction-scoped, so two runs started in one transaction share an instant; the primary
    # key is what makes the order total and the pagination stable.
    runs_query = (
        supabase.table("workflow_runs")
        .select(
            "id, thread_id, definition_id, status, created_at",
            count="exact",
        )
        .eq("user_id", current_user["id"])
    )
    if definition_ids is not None:
        runs_query = runs_query.in_("definition_id", definition_ids)
    runs_resp = await aexec(
        runs_query.order("created_at", desc=True)
        .order("id", desc=True)
        .range(offset, offset + limit - 1)
    )
    run_rows = (runs_resp.data if runs_resp is not None else None) or []
    total = getattr(runs_resp, "count", None) if runs_resp is not None else None

    if not run_rows:
        return WorkflowRunListRead(runs=[], total=total or 0, limit=limit, offset=offset)

    # ── Step 3: the identity of the definitions on this page ──
    # One query for the page's distinct definition ids, never one per row.
    page_definition_ids = sorted({str(row["definition_id"]) for row in run_rows})
    defs_resp = await aexec(
        supabase.table("workflow_definitions")
        .select("id, name, slug, version")
        .in_("id", page_definition_ids)
    )
    identity: dict[str, dict[str, Any]] = {
        str(row["id"]): row
        for row in ((defs_resp.data if defs_resp is not None else None) or [])
    }

    # ── Step 4: the span of each run, reduced from its phase rows ──
    #
    # ⚠ THE REDUCTION IS ``min(started_at) → max(completed_at)``, WHICH IS
    # ``phaseDuration.runSpan``'S OWN DEFINITION. Pre-computing it here is what lets the log
    # avoid shipping ~5 phase rows per run; it is NOT a second way of measuring a run, and it
    # must not become one. If the client's definition ever moves, this moves with it.
    #
    # ⚠ THE INSTANTS ARE PARSED BEFORE THEY ARE COMPARED, AND THE SHORTCUT THAT WAS
    # REJECTED IS RECORDED SO NOBODY RE-INTRODUCES IT. PostgREST renders ``timestamptz`` as
    # ISO-8601 in UTC (verified against this database: ``2026-08-20T15:54:03.220627+00:00``,
    # ``SHOW timezone`` = UTC), so comparing the raw STRINGS gives the right answer almost
    # always — and "almost" is the problem. **Postgres trims trailing zeros from the
    # fractional seconds**, so ``.22+00:00`` and ``.220627+00:00`` are different WIDTHS, and
    # a lexicographic ``min`` is then comparing ``+`` (0x2B) against a digit. It happens to
    # come out right because ``+`` sorts below every digit and a trimmed fraction is the
    # earlier instant — an accident, resting on two facts about ASCII and Postgres that
    # nothing here enforces. Parsing ~580 strings costs nothing measurable and needs no such
    # argument. ``fromisoformat`` handles the ``+00:00`` offset natively on 3.11+; an
    # unparseable value is DROPPED rather than defaulted, because a run with an unreadable
    # instant has no span and must say so, not claim one.
    run_ids = [str(row["id"]) for row in run_rows]
    phases_resp = await aexec(
        supabase.table("workflow_phases")
        .select("workflow_run_id, started_at, completed_at")
        .in_("workflow_run_id", run_ids)
    )
    spans: dict[str, dict[str, Any]] = {}
    for row in (phases_resp.data if phases_resp is not None else None) or []:
        key = str(row["workflow_run_id"])
        span = spans.setdefault(key, {"steps": 0, "started_at": None, "completed_at": None})
        span["steps"] += 1
        started = _parse_instant(row.get("started_at"))
        if started is not None and (span["started_at"] is None or started < span["started_at"]):
            span["started_at"] = started
        completed = _parse_instant(row.get("completed_at"))
        if completed is not None and (
            span["completed_at"] is None or completed > span["completed_at"]
        ):
            span["completed_at"] = completed

    runs = []
    for row in run_rows:
        # ⚠ A DEFINITION ROW CAN BE MISSING AND THE LOG STILL OWES YOU THE RUN. Deleting a
        # workflow does not delete the runs (``WorkflowDeleteSheet`` says the threads become
        # normal chats), so an orphaned run must render as a run with no name rather than
        # disappear — the client decides what to say about an empty name, and it has a word
        # for it. `.get` with a default, never a `[]` that would 500 the whole page.
        meta = identity.get(str(row["definition_id"]), {})
        span = spans.get(str(row["id"]), {})
        runs.append(
            WorkflowRunListItem(
                id=row["id"],
                thread_id=row["thread_id"],
                definition_id=row["definition_id"],
                workflow_name=meta.get("name") or "",
                workflow_slug=meta.get("slug") or "",
                workflow_version=meta.get("version") or 0,
                status=row["status"],
                created_at=row.get("created_at"),
                step_total=span.get("steps", 0),
                started_at=span.get("started_at"),
                completed_at=span.get("completed_at"),
            )
        )

    return WorkflowRunListRead(
        runs=runs, total=total if total is not None else len(runs), limit=limit, offset=offset
    )


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
        .select(
            "id, thread_id, definition_id, status, created_at, updated_at, claimed_at, "
            "definition_snapshot, metadata"
        )
        .eq("id", str(workflow_run_id))
        .eq("user_id", current_user["id"])
        .maybe_single()
    )
    # ``aexec`` can return None (maybe_single on no row), hence the guard — runs.py:711.
    run = run_resp.data if run_resp is not None else None
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    # ── Step 2: the definition VERSION THAT RAN ──
    #
    # ⚠ THE ORIGINAL COMMENT IS KEPT BECAUSE IT IS STILL TRUE AND WAS STILL INCOMPLETE:
    #
    #     "by definition_id (D-188-14). Never by slug: a slug resolves to the CURRENT
    #      published version, so re-opening an old run would draw it against a definition it
    #      never executed."
    #
    # That protects against the SLUG moving. Nothing protected against the ROW moving —
    # `workflow_definitions.definition` is MUTABLE while `status = 'draft'`, so a draft can be
    # rewritten under a run that already has its `workflow_phases` rows. Measured on the local
    # database 2026-08-20: **21 of 228 runs point at a draft, 14 of those drafts were edited
    # after their run, and on 2 the phase ORDER changed** — at which point this page's
    # `phase_index` join (D-188-01) renders each step's state as its NEIGHBOUR's. Observed in a
    # browser as "Produce the deliverable · Not started" on a step that had FAILED. Published
    # definitions are immutable and versioned, and show ZERO crossings.
    #
    # Migration 122 stores the definition the run actually executed, serialized in
    # `create_workflow_run` from the SAME in-memory object that wrote this run's phase rows,
    # in the SAME transaction — so the snapshot and the phase rows cannot disagree.
    #
    # ⚠ THE DEFINITION ROW IS STILL READ, AND STILL NEEDED. `name` / `slug` / `version` are the
    # run header's IDENTITY and deliberately still come from the live row — re-sourcing them
    # from the snapshot would be more coherent and is NOT taken here, because that identity is
    # Phase 197's `identityLabel` decision (D-19) and changing it quietly inside a correctness
    # fix is the kind of widening this project records as a defect. Re-open trigger: the next
    # phase that touches the run header's identity.
    def_resp = await aexec(
        supabase.table("workflow_definitions")
        .select("slug, version, name, definition")
        .eq("id", str(run["definition_id"]))
        .maybe_single()
    )
    definition_row = (def_resp.data if def_resp is not None else None) or {}

    # ⚠ THE FALLBACK IS THE OLD BEHAVIOUR, INCLUDING ITS RISK, AND SAYING SO IS THE POINT.
    # Migration 122 is NOT backfilled (see its header), so every run created before it keeps a
    # NULL snapshot and resolves exactly as it did — crossing and all. This is a strict
    # improvement going forward that repairs nothing retroactively.
    #
    # ⚠ `is None`, NOT a truthiness test. An empty dict is a definition that was RECORDED and
    # found to hold nothing, which is a different fact from never having been recorded; a
    # falsy check would send the first case down the fallback and silently substitute a
    # document the run did not execute — the exact failure this column exists to end.
    snapshot = _coerce_definition(run.get("definition_snapshot"))
    definition = (
        snapshot if snapshot is not None else _coerce_definition(definition_row.get("definition"))
    )

    # ── Step 3: the durable phase spine, ORDER BY phase_index ──
    # ── 200 (DES-02): the projection, widened in LOCKSTEP with the model + serializer ──
    # ⚠ V4 ACCESS CONTROL IS UNCHANGED BY THIS WIDENING, and a reviewer will ask, so it is
    # answered here: these columns are added to a query ALREADY scoped by
    # `.eq("workflow_run_id", run["id"])`, where `run` came from the ownership select
    # above (id AND user_id on the SAME select). No second query, no new dependency, no
    # changed 404 body — and NO SCOPE WIDENS. A `.select("*")` would also "work" and
    # would WEAKEN the read by shipping whatever columns the table grows next; reject it.
    #
    # ⚠ THE ORIGINAL COMMENT IS KEPT VERBATIM BECAUSE IT IS STILL THE ARGUMENT, AND ONE
    # CLAUSE OF IT IS NO LONGER TRUE. It read:
    #
    #     "`output` IS SELECTED BUT NEVER PUT ON THE WIRE. `_persist_output` stores each
    #      executor's dict FULL AND INLINE, so this jsonb carries field_map, citations and
    #      prompts. The SERIALIZER below extracts ONLY `_measure.count` / `_measure.noun`
    #      into `step_count` / `step_noun`, and `WorkflowRunPhaseRead` declares no `output`
    #      field — so `response_model`'s drop behaviour is what keeps the payload narrow.
    #      That is the answer to RESEARCH's open question A7 with no second migration: the
    #      carrier stays the jsonb, the exposure stays bounded, and the client never sees a
    #      prompt."
    #
    # ⚠ 200.1 (RUN-04) AMENDS EXACTLY ONE CLAUSE: the serializer now extracts a THIRD fact,
    # `output["text"]`, into `deliverable_text`. Everything else stands unchanged and is
    # what makes the widening safe — `WorkflowRunPhaseRead` still declares NO `output`
    # field, `response_model` still drops every key the model does not name, and the
    # exposure is still bounded by reading named keys rather than by filtering an object.
    # The client still never sees a prompt; it sees the answer the run produced, which is
    # the one thing on that jsonb the run's owner is entitled to read back.
    #
    # ⚠ THE `.select()` STRING BELOW IS BYTE-UNCHANGED BY 200.1 and must stay so — `output`
    # was ALREADY selected, so the deliverable arm asks the database for nothing new. A
    # `.select("*")` would also "work" and would WEAKEN the read; reject it (asserted at
    # zero occurrences by this module's suite).
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
        # ── 200.1 (RUN-04) — ONE parse per row, feeding BOTH reads ──
        # `phase_output_object` tolerates the jsonb string scalar AND the object shape;
        # a dict passes straight through `declared_phase_measure`'s own call to the same
        # helper, so handing it `obj` rather than the raw value changes no behaviour and
        # keeps the parse count at one. One parse, one home, two facts.
        obj = phase_output_object(row.get("output"))
        count, noun = declared_phase_measure(obj)
        # ⚠ EXACTLY ONE KEY, BY NAME — see `deliverable_text`'s comment on the model.
        # An empty string is not shipped (D-200.1-02-B's sibling rule): `None` and `""`
        # are one fact on this surface.
        raw_text = obj.get("text") if isinstance(obj, dict) else None
        deliverable_text = raw_text if isinstance(raw_text, str) and raw_text else None
        # ── 214 (D-214-23) — THE THIRD FACT OFF THE SAME SINGLE PARSE ──
        # ⚠ THIS IS WHY THE PARSE MATTERS RATHER THAN THE FIELD. 38 of the 43 `failed`
        # phase rows on the live database store `output` as a jsonb STRING SCALAR, so a
        # reader written as `row["output"]["_failure_reason"]` finds the reason on 2 of 43
        # and reads empty on the rest — silently, because the absent arm renders honestly.
        # Reading off `obj` (already unwrapped by the ONE door) serves both shapes.
        # ⚠ Whitespace-only and non-`str` normalise to `None` so ABSENT and EMPTY stay one
        # fact on the wire — see the field's description for why that keeps the panel's
        # `reason_unknown` sentinel honest.
        raw_reason = obj.get("_failure_reason") if isinstance(obj, dict) else None
        failure_reason = (
            raw_reason if isinstance(raw_reason, str) and raw_reason.strip() else None
        )
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
                deliverable_text=deliverable_text,
                failure_reason=failure_reason,
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
        # The third place of the lockstep — see the field's docblock. A jsonb column comes
        # back as a dict, but a string scalar has been measured on sibling columns in this
        # tree, so a non-dict is dropped rather than handed to the client as a bare string.
        metadata=run.get("metadata") if isinstance(run.get("metadata"), dict) else None,
        phases=phases,
    )


@router.get(
    "/{workflow_run_id}/phases/{phase_slug}/citations",
    response_model=list[WorkflowRunCitationRead],
    # D-182-05 / D-188-16 — this list holds require_canvas ALONE. The 403-raising visibility
    # gate must never join it (a 403 leaks the route's existence); see the module docblock.
    dependencies=[Depends(require_canvas())],
)
async def read_workflow_run_phase_citations(
    workflow_run_id: UUID,
    phase_slug: str,
    # WR-08: consume identity from canvas_caller rather than re-resolving GoTrue
    current_user: dict = Depends(canvas_caller),
    # user-JWT client backing the ownership check with v3.4 membership RLS
    supabase: Client = Depends(get_user_supabase_client),
) -> list[WorkflowRunCitationRead]:
    """PURE READ — lazy citation passages for a single step of a workflow run.

    Ownership-gated FIRST (T-200.2-01 — 404, never leak existence; matches read_workflow_run access posture),
    then the specific phase by workflow_run_id and slug. NEVER writes. Lazily fetched by design
    (D-09 — the run read is polled while live, so passages must not ride it).
    """
    # ── Step 1: ownership SELECT -> 404 (never leak existence; runs.py:700-750 idiom) ──
    run_resp = await aexec(
        supabase.table("workflow_runs")
        .select("id")
        .eq("user_id", current_user["id"])
        .eq("id", str(workflow_run_id))
        .maybe_single()
    )
    run = run_resp.data if run_resp is not None else None
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found",
        )

    # ── Step 2: phase SELECT -> 404 (nonexistent step is not an empty step) ──
    phase_resp = await aexec(
        supabase.table("workflow_phases")
        .select("output")
        .eq("workflow_run_id", str(run["id"]))
        .eq("slug", phase_slug)
        .maybe_single()
    )
    phase_row = phase_resp.data if phase_resp is not None else None
    if not phase_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Phase not found",
        )

    # ── Step 3: unwrap output via phase_output_object ──
    obj = phase_output_object(phase_row.get("output"))

    # ── Step 4: build allow-list citation reads ──
    raw_citations = obj.get("citations") if isinstance(obj, dict) else None
    citations: list[WorkflowRunCitationRead] = []
    if isinstance(raw_citations, list):
        for entry in raw_citations:
            if not isinstance(entry, dict):
                continue
            doc_id = entry.get("document_id")
            filename = entry.get("filename")
            if not isinstance(doc_id, str) or not isinstance(filename, str):
                continue
            chunk_idx = entry.get("chunk_index")
            passage = entry.get("passage")
            citations.append(
                WorkflowRunCitationRead(
                    document_id=doc_id,
                    filename=filename,
                    chunk_index=chunk_idx if isinstance(chunk_idx, int) else None,
                    passage=passage if isinstance(passage, str) else None,
                )
            )

    return citations


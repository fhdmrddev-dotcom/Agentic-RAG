import json
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


def phase_output_object(raw: object) -> dict | None:
    """One ``workflow_phases.output`` jsonb value as a dict — or ``None``. THE READ-SIDE UNWRAP.

    Phase 200.1 / **D-200.1-01**. Sited immediately above ``declared_phase_measure`` on purpose:
    the read side keeps exactly ONE home (see that function's docblock for why), and this is
    that home gaining a helper — never a second copy of the read.

    ⚠ **THE COLUMN HAS TWO SHAPES IN IT, AND THAT IS MEASURED RATHER THAN SUSPECTED.**
    ``db/workflows.py``'s terminal phase writers bound ``json.dumps(output)`` into a
    ``$2::jsonb`` parameter on a pool that ALREADY registers a jsonb codec with
    ``encoder=json.dumps`` (``dependencies._init_pg_connection`` — D-073-06, whose own docblock
    says the codec exists precisely so *"call sites pass plain Python dicts/lists"*). Encoded
    twice, the value lands as a jsonb **string scalar** holding JSON text — migration 122's root
    cause, one column over. Measured against the live local DB on 2026-08-20: **527 of 588**
    non-null ``output`` values are ``jsonb_typeof = 'string'``, and that includes **484 of 484**
    ``completed`` rows. ``completed`` is exactly the status that can carry a measure, so the
    failure rate on the rows that matter was **100%**, not 90%: ``_measure`` is reachable on
    **13** rows THROUGH this unwrap and on **ZERO** rows without it. ``declared_phase_measure``
    opened with a bare dict-only type test on ``raw`` and degraded to ``(None, None)``
    **silently** — built, gated, green and structurally unreachable for four months.

    ⚠ **THE OLD GUARD IS DESCRIBED HERE AND DELIBERATELY NOT SPELLED.** This repo has recorded
    that trap firing three times (``toolNames.ts`` read `3` where its guard required `0`, all
    comments): a docblock that quotes the forbidden form makes the acceptance grep count its own
    prose and report a fix that landed as a fix that did not. The verbatim pre-change predicate
    lives in ONE place — ``tests/unit/test_200_1_phase_output_shape.py``, where it is re-stated
    locally and driven as the counterfactual.

    CONTRACT. A ``dict`` passes through unchanged. A ``str`` is ``json.loads``-ed and returned
    ONLY if it parses to a dict. ``None``, a non-``str`` non-``dict``, an unparseable string, and
    a string that parses to a list / number / bool / null all return ``None``.

    ⚠ **IT MUST NEVER RAISE** (T-200.1-01). It reads model-influenced jsonb, and a parser that
    raises here 500s the run page for the owner of a run whose model wrote something odd.
    ``ValueError`` and ``TypeError`` are caught — the same two ``_coerce_definition``
    (``api/workflow_runs.py``) catches, which is the shipped precedent for this shape, and whose
    degrade-to-``None`` silence is mirrored deliberately rather than reinvented.

    ─── D-200.1-01 — BOTH (a) AND (b) ARE TAKEN. NO MIGRATION. ──────────────────────────────
    · **(a) repairs the READ and is the load-bearing half.** It is the only half that reaches the
      588 historical rows — the 484 ``completed`` ones, and the 479 carrying ``output.text`` that
      the deliverable-by-type arm reads through this same door. Nothing else reaches history.
    · **(b) repairs the WRITER** (``db/workflows.py``'s three terminal phase writers), because
      leaving it wrong mints roughly three new bad rows per run, and because (a) makes the reader
      tolerate BOTH shapes, so the flip cannot break a consumer.
    · **THE SIBLING DEFERRAL IS HONOURED, and the reason it does not transfer is stated rather
      than assumed.** ``STATE.md`` and migration 123's header leave ``workflow_runs.inputs``
      (**230 of 230** string) and ``workflow_definitions.definition`` (**261 of 291**) in the old
      shape because *"flipping a writer alone gives a table with two shapes in it."* ``output``
      ALREADY has two shapes — 527 string against 61 object, and the object rows are
      ``pending``/``cancelled``/``skipped``, written by a path that binds the dict directly, which
      is what makes the split diagnostic rather than coincidental. And migration 123's own stated
      condition for repairing a column alone is *"one reader that already accepts BOTH shapes"* —
      which is precisely what (a) creates here. **Neither ``inputs`` nor
      ``workflow_definitions.definition`` is touched by this phase**, and their re-open trigger is
      carried forward VERBATIM: the next phase that touches either on the WRITE path.
    · **NO MIGRATION — and the reason, not the assurance.** The read repair reaches every row, so
      a data migration buys nothing the read does not already buy, while running a blind
      ``#>> '{}'``-then-``::jsonb`` cast over 527 rows of MODEL-INFLUENCED content is strictly
      more risk than the two-row ``definition_snapshot`` case migration 123 was written for.
      ⚠ **Re-open trigger, named so it is not a silence: the first phase that needs ``output``
      queryable IN SQL** — a ``->> 'text'`` predicate, an index, or a feed's ``WHERE`` /
      ``ORDER BY``. At that point read-side tolerance is not enough, because SQL sees the raw
      column and never this helper.
    ─────────────────────────────────────────────────────────────────────────────────────────
    """
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            decoded = json.loads(raw)
        # ⚠ `RecursionError` IS NOT A `ValueError`, AND THIS FUNCTION'S CONTRACT SAYS IT NEVER
        # RAISES. `json.loads` recurses per nesting level, so a deeply-nested payload —
        # `"[[[[...]]]]"` — blows the interpreter's stack and escapes a `(ValueError, TypeError)`
        # catch entirely. Reproduced against this repo's own Python by the phase's code review;
        # the docblock above and this module's test suite both assert "must never raise", so the
        # narrow catch was contradicting a promise made two paragraphs up.
        #
        # This matters because the input is MODEL-INFLUENCED: executor output is persisted
        # verbatim into `workflow_phases.output`. Both call sites are reachable — the run read
        # (`api/workflow_runs.py`) and the thread reconcile (`api/threads.py`), the latter with
        # no enclosing try/except at the call site.
        #
        # `RecursionError` inherits from `RuntimeError`, not `ValueError`, so it must be named.
        # Returning `None` is the right answer rather than re-raising: an unreadable payload is
        # exactly the "not an object" case this function already reports as `None`, and the
        # absent arm downstream renders honestly (no count, no answer) rather than blanking a page.
        except (ValueError, TypeError, RecursionError):
            return None
        return decoded if isinstance(decoded, dict) else None
    return None


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

    ⚠ **Phase 200.1 / D-200.1-01 — THE FIRST LINE IS NOW AN UNWRAP, NOT AN ``isinstance``
    TEST.** This function opened with a bare dict-only type test on ``raw`` (not spelled here —
    see ``phase_output_object``'s note on why), and the column it reads is a jsonb STRING SCALAR
    on **484 of 484** ``completed`` rows, so the
    declared count reached nobody for four months. ``phase_output_object`` above carries the
    measurement and the decision; everything below this line is unchanged, deliberately.
    """
    output = phase_output_object(raw)
    if output is None:
        return None, None
    measure = output.get("_measure")
    if not isinstance(measure, dict):
        return None, None
    count = measure.get("count")
    noun = measure.get("noun")
    if not isinstance(count, int) or isinstance(count, bool):
        return None, None
    if not isinstance(noun, str) or not noun:
        return None, None
    return count, noun


def step_identity(definition: object) -> dict[str, tuple[str | None, str | None, str | None]]:
    """``slug -> (tool_name, capability, connection_id)`` for every ``external_action`` phase.

    Phase 214 / **D-214-16** (*"every surface a run appears on, via one shared element"*). A run
    surface must be able to say WHICH SERVICE and WHICH ACTION a step runs — including when it
    failed — and the durable ``workflow_phases`` row carries none of that: the table stores
    ``slug``, ``status``, ``output`` and its timestamps and nothing else. The only honest source
    is the definition that executed, exactly as ``phase_type`` already is.

    ⚠ **ONE DERIVATION, TWO CONSUMERS — sited here for the reason its two neighbours are.**
    ``api/threads.py`` and ``api/workflow_runs.py`` ALREADY walk this same definition JSON in
    two separately-written ``slug -> phase_type`` loops (``workflow_runs.py::_slug_to_phase_type``
    and the inline ``try``-wrapped loop in ``get_thread_workflow``). Two copies of one derivation
    is how the chat panel and the run page come to disagree about the same row — the failure
    ``WorkflowPhaseState``'s own two-wire-model rule below exists to prevent. **Adding a third
    and a fourth copy is what this function refuses.** The two shipped ``phase_type`` loops are
    deliberately left byte-unchanged: re-pointing them is a refactor Phase 214 does not own.

    ⚠ **PURE. No pool, no client, no I/O, no clock.** That is what makes it callable from both
    API modules, which hold DIFFERENT database clients (``threads.py`` reads through the asyncpg
    user-JWT path; ``workflow_runs.py`` holds a user-JWT supabase client). **The RULE is shared;
    the I/O is not.** In particular this function returns a ``connection_id`` and NEVER a service
    name — resolving that id to the connection row's display ``name`` is per-module I/O.

    ⚠ **``service_name`` IS COMPUTED, NEVER STORED** (D-213-02 / D-214-14). A stored copy of a
    derived fact goes stale the moment the connection is renamed, which is the shape D-213-02
    rejected for descriptors. So the identity travels as an ID here and becomes a name at the
    edge, per read.

    CONTRACT. Every non-``external_action`` phase contributes NOTHING — it is absent from the
    mapping, and all three fields resolve ``None`` on the wire. An ``external_action`` phase
    contributes a 3-tuple whose members are independently nullable: an MCP step carries a
    ``tool_name`` and ``capability = None``; a native capability step may carry a ``capability``
    and no ``tool_name``; a step bound to nothing carries ``connection_id = None``. **Those
    absences are facts, not gaps**, and nothing here substitutes for one.

    Defensive in ``_slug_to_phase_type``'s own shape, because this reads authored/model-influenced
    JSON: a definition that is missing, a ``str`` that does not parse, a non-list ``phases``, a
    non-dict phase, a missing ``config`` and a non-``str`` field value each contribute nothing
    rather than raising. ⚠ **It must never raise** — both call sites are on read paths whose
    failure mode is a 500 on a page the caller owns.
    """
    if isinstance(definition, str):
        try:
            definition = json.loads(definition)
        # `RecursionError` for the same reason `phase_output_object` names it: it inherits from
        # `RuntimeError`, not `ValueError`, and this input is authored/model-influenced.
        except (ValueError, TypeError, RecursionError):
            return {}
    if not isinstance(definition, dict):
        return {}

    def _text(value: object) -> str | None:
        return value if isinstance(value, str) and value else None

    mapping: dict[str, tuple[str | None, str | None, str | None]] = {}
    phases = definition.get("phases")
    for phase in phases if isinstance(phases, list) else []:
        if not isinstance(phase, dict):
            continue
        slug = _text(phase.get("slug"))
        config = phase.get("config")
        if not slug or not isinstance(config, dict):
            continue
        if config.get("phase_type") != "external_action":
            continue
        mapping[slug] = (
            _text(config.get("tool_name")),
            _text(config.get("capability")),
            _text(config.get("connection_id")),
        )
    return mapping


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
    # ⚠ **D-200.1-02-A — THE FIRST RECORDED EXCEPTION TO THE RULE ABOVE, written HERE so a
    # reader of the rule finds the exception where the rule is.** Phase 200.1 (RUN-04) added
    # `deliverable_text` to `WorkflowRunPhaseRead` and DELIBERATELY did not add it here.
    # The rule's own stated purpose — "the same facts, two surfaces, silently disagreeing" —
    # does not apply, because **the chat surface ALREADY renders this text: it is the
    # assistant's message.** Adding the field here would put a SECOND rendering of the same
    # words on the same screen, the exact duplication `RunTranscript` removed from the run
    # page. The four fields above were different in kind: NEITHER surface had them, so
    # widening one alone would have been a real disagreement.
    # Declining also keeps the new exposure behind the narrower door — `GET
    # /threads/{id}/workflow`, which serves this model, carries no canvas gate; the run read
    # does (T-200.1-11).
    # ⚠ RE-OPEN TRIGGER: a chat-surface affordance that needs the deliverable INDEPENDENTLY
    # of the message stream. The full argument, with its payload sibling `D-200.1-02-B`,
    # is recorded beside the field in `api/workflow_runs.py`.
    #
    # Semantics are identical and are stated once, in `WorkflowRunPhaseRead`'s field
    # descriptions. The two that matter most: a NULL timestamp means TIME NOT RECORDED
    # (there is no backfill — D-06), and `step_count` distinguishes `0` (a real measurement
    # of nothing) from `null` (this phase type declares no count) — never `?? 0`.
    started_at: datetime | None = None
    completed_at: datetime | None = None
    step_count: int | None = None
    step_noun: str | None = None

    # ── 214 (STEP-04 / STEP-05 / D-214-23 / D-214-16) — WHY IT FAILED, AND WHAT IT WAS ──
    #
    # ⚠ **THE RULE ABOVE APPLIES AT FULL STRENGTH HERE, AND `D-200.1-02-A`'S EXCEPTION WAS
    # CONSIDERED AND DOES NOT APPLY.** That exception declined `deliverable_text` because the
    # chat surface ALREADY renders that text — it is the assistant's message — so widening
    # would have put a second rendering of the same words on the same screen. **Nothing
    # renders the failure reason on the chat panel today**: `PhaseCard.tsx:253` fires the
    # `reason_unknown` sentinel instead, which is exactly the "two surfaces silently
    # disagreeing" the rule was written to prevent. So these four are widened in the SAME
    # commit as `WorkflowRunPhaseRead`'s, and the field semantics are stated ONCE, there.
    #
    # ⚠ AND THE CLIENT MIRROR IS PART OF THAT SAME COMMIT. `frontend/src/lib/api/threads.ts`
    # declares a `WorkflowPhaseState` interface that IS this model's client copy; `200-02`
    # widened this side and not that one, and `GET /threads/{id}/workflow` spent a phase
    # sending fields the panel could not declare. That incident is recorded in the mirror's
    # own comment. It is not repeated here.
    #
    # ⚠ DECLARING IS NOT POPULATING. Both of these fields' producers are named, because a
    # declared field with no producer is a `null` on the wire forever and — since a `null`
    # `service_name` renders the ACTION ALONE, the honest arm — it ships green and looks
    # right. `api/threads.py`'s builder populates this model; `api/workflow_runs.py`'s loop
    # populates the other. `tests/unit/test_214_failure_reason_seam.py` asserts the two
    # properties SEPARATELY: a `model_fields` check for the declaration, and a VALUE off each
    # side's real serializer path for the population.
    failure_reason: str | None = None
    tool_name: str | None = None
    capability: str | None = None
    service_name: str | None = None


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


class ToolApprovalDecisionRequest(BaseModel):
    """Phase 216 (GRANT-03 / CHAT-07): Payload for human decision on a paused tool call.

    ⚠ `always` IS A THIRD DECISION, NOT A FLAG ON `allow` — 2026-08-31. It means two
    things at once: let this call through, AND stop asking about this action on this
    connection. The settings panel has offered all three postures since Phase 213 and
    `grantsVocabulary.ts` has carried the words (`ASK_ALWAYS`) just as long; the chat card
    shipped with two buttons, so the only way to stop being asked was to leave the
    conversation and go and find the connection.

    ⚠ THE GRANT WRITE CAN FAIL WHILE THE APPROVAL SUCCEEDS, and the response says so
    rather than picking one story. Changing a grant needs `org:manage`; approving a call
    needs only that the thread is yours. A member who clicks Always gets the call through
    — refusing that would strand a run over a permission they did not need — and is told
    plainly that the setting was not changed.
    """
    call_id: str
    decision: Literal["allow", "reject", "always"]
    #: Required for `always` only: WHICH connection the grant belongs to. It arrives from
    #: the `tool_approval_required` event rather than being resolved from `service_id`,
    #: because two connections can share a service. Org-scoped server-side, so an id from
    #: another org is a 404 and never a write.
    connection_id: UUID | None = None
    #: Required for `always` only: the bare tool name (never the `service__tool` spelling).
    tool_name: str | None = None

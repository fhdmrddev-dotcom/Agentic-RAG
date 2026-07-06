"""Phase 133 Plan 01 (EVAL-02) — Pydantic contracts for the eval runner.

Mirrors the ``public.eval_runs`` / ``public.eval_results`` columns from migration 080
(``supabase/migrations/080_eval_runs_and_results.sql``).

A run is single-provider/single-model (D-01): ``provider``/``model`` live on the run.
Results carry ``provider``/``model`` too (D-02 — provider-keyed even though the run is
single-provider) and a ``with_skill``/``without_skill`` ``variant`` discriminator (D-04).

All fields are FLAT single-typed (``str | None`` / ``int | None`` / ``datetime | None``) —
never a multi-type list union, which trips the Gemini JSON-Schema ``type: [...]`` trap.
``user_id``/``skill_id`` come from the path + authenticated caller, NEVER a request body
(T-132-07 — a forged body id is ignored).
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class StartEvalRunBody(BaseModel):
    """POST body — start an eval run. ``skill_id`` comes from the path and ``user_id`` from
    the authenticated caller, NEVER the body (T-132-07). One provider/model per run (D-01)."""

    provider: str
    model: str


class RateResultBody(BaseModel):
    """PUT body — set or clear the caller's thumbs rating on ONE eval_results answer (EVAL-04).

    Carries ONLY ``rating`` — ``user_id`` is sourced from the authenticated caller in the
    endpoint, NEVER this body (T-134-03 forged-owner; the ratings endpoint has no client write
    path). Single-typed ``str | None`` (never a multi-type list union — the Gemini JSON-Schema
    ``type: [...]`` trap): ``"up"``/``"down"`` sets the thumb, ``None`` clears it (DELETE the
    row — D-08 re-ratable). The endpoint rejects any other value with 400; the DB
    ``CHECK (rating IN ('up','down'))`` is the second gate (T-134-09)."""

    rating: str | None


class EvalRunResponse(BaseModel):
    """Full ``public.eval_runs`` row shape returned by the run routes."""

    id: UUID
    skill_id: UUID
    skill_version_id: UUID
    user_id: UUID
    provider: str
    model: str
    status: str
    case_count: int
    error: str | None
    created_at: datetime
    completed_at: datetime | None
    # Phase 134 (EVAL-03 / D-07) — with-skill run rollup written at finalize. All
    # single-typed (Gemini ``type: [...]`` array trap). NULL on old runs + on a
    # cancelled/interrupted/errored run (never a misleading partial count). The pass
    # threshold is a NON-authoritative default here — Phase 136 (GATE-01) owns the real one.
    passed_count: int | None
    measured_count: int | None
    verdict_summary: str | None


class EvalResultResponse(BaseModel):
    """Full ``public.eval_results`` row shape returned by the result routes."""

    id: UUID
    eval_run_id: UUID
    test_case_id: UUID
    user_id: UUID
    variant: str
    provider: str
    model: str
    output: str
    status: str
    error: str | None
    input_tokens: int | None
    output_tokens: int | None
    # Phase 134 (EVAL-03 / D-06) — per-arm automated-judge verdict, written in the SAME
    # insert. All single-typed (Gemini ``type: [...]`` array trap). ``verdict_state`` ∈
    # graded / not_measured / judge_error; ``verdict_passed``/``verdict_score`` are NULL
    # unless graded (an errored/empty arm is honestly ``not_measured``, never fabricated).
    verdict_state: str | None
    verdict_passed: bool | None
    verdict_score: int | None
    verdict_reason: str | None
    judge_model: str | None
    # Phase 134 (EVAL-04 / D-09) — the CALLER's own thumbs rating on this answer, attached by
    # ``get_eval_run`` from an owner-scoped ``eval_ratings`` read (``"up"``/``"down"``, or None
    # when the caller hasn't rated it). Single-typed (Gemini ``type: [...]`` array trap). Not a
    # stored ``eval_results`` column — a per-caller readout merge.
    rating: str | None
    created_at: datetime


# ── Phase 135 (SI-01) — the self-improvement PROPOSAL contract (Plan 04 OWNS eval_run.py) ──
# This is the LOCKED response contract for the WHOLE self-improvement loop (Plans 04/05/06/07).
# It lives HERE (not in a Plan-05 module) so eval_run.py stays owned by ONE plan, and — critically
# — so the nullable ``gate`` honest-counts field is DECLARED on the response model: FastAPI strips
# any field absent from the declared response model, so a field Plan 05 WRITES (at reconcile) and
# Plan 07 DISPLAYS must be born here or it would be silently dropped from every serialized response.
# All fields FLAT single-typed (never a multi-type list union — the Gemini ``type: [...]`` trap),
# and ``user_id``/``skill_id`` come from the caller + path, NEVER a request body (T-135-02).


class ProposeBody(BaseModel):
    """POST body — draft ONE proposal from a SOURCE eval run (D-01 on-demand).

    Carries ONLY ``source_eval_run_id`` — the run whose evidence drives the edit. ``user_id``
    comes from the authenticated caller and ``skill_id`` from the path, NEVER this body (T-135-02
    — a forged owner/skill id is ignored)."""

    source_eval_run_id: str


class ProposeDescriptionBody(BaseModel):
    """POST body — draft ONE DESCRIPTION proposal from a SOURCE Trigger Tuner run (SI-02, D-11).

    Mirrors ``ProposeBody`` but carries ONLY the source pointer for a tuner run: ``run_id`` — the
    ephemeral tuner run-buffer id the client observed. The route derives the winning description +
    snapshots its scoreboard from that run and sets ``kind='description'`` itself; the body carries
    NO ``kind`` field. ``user_id`` comes from the authenticated caller and ``skill_id`` from the path,
    NEVER this body (T-135-02 — a forged owner/skill id is ignored). Single-typed ``str`` (Gemini
    ``type: [...]`` array trap)."""

    run_id: str


class ForcePromoteBody(BaseModel):
    """POST body — force-promote a proposal despite a non-improving gate (D-06).

    Deliberately EMPTY: the server derives everything (the reconciled gate, the proposal row) —
    the client supplies no fields, so there is nothing to forge. Defined HERE (not the Plan-05
    module) so eval_run.py stays owned by ONE plan; Plan 05 imports this shape for its
    force-promote route."""


class PromotionGate(BaseModel):
    """The D-13 honest promotion-gate counts — case-matched prev-vs-re-eval tallies shown
    ALONGSIDE the verdict (never a bare pass/fail). Plan 05's ``promotion_gate()`` returns EXACTLY
    these 8 keys; Plan 07 renders them. All FLAT single-typed (Gemini ``type: [...]`` trap):

      * ``passed`` — the re-eval's overall pass verdict.
      * ``no_regression`` — no previously-passing case regressed (still_pass covers prev_pass).
      * ``improved`` — at least one previously-failing case now passes (newly_pass > 0).
      * ``prev_pass`` / ``prev_fail`` — the SOURCE run's case-matched pass/fail tallies.
      * ``still_pass`` — prev-passing cases that still pass on the re-eval.
      * ``newly_pass`` — prev-failing cases that now pass on the re-eval.
      * ``excluded_not_measured`` — cases dropped from the gate math because an arm was
        ``not_measured`` (honestly excluded, never counted as a pass or fail)."""

    passed: bool
    no_regression: bool
    improved: bool
    prev_pass: int
    prev_fail: int
    still_pass: int
    newly_pass: int
    excluded_not_measured: int


class SkillProposalResponse(BaseModel):
    """Full ``public.skill_proposals`` row (mig 083) returned by the proposal routes, PLUS two
    derived fields the frontend needs:

      * ``base_instructions`` — the BASE version's instruction body (``skill_versions.instructions``
        for ``base_skill_version_id``), hydrated so the frontend can render the proposed-vs-base
        diff. NOT a stored ``skill_proposals`` column — a per-response hydration merge.
      * ``gate`` — the D-13 honest counts (``PromotionGate``), ``None`` until a re-eval reconciles.
        Plan 05 WRITES it (at reconcile-on-read), Plan 07 DISPLAYS it. Declared here so FastAPI
        does not strip it from the serialized response.

    Phase 139 (SI-02, D-11) extends this ONE contract to cover BOTH kinds — an instruction proposal
    (SI-01, the default) and a description proposal (SI-02). A ``kind='description'`` row carries
    ``proposed_description`` (the Trigger-Tuner-winning description), ``base_description`` (the current
    live description — the diff base the frontend renders ``proposed_description`` against, hydrated
    per-response like ``base_instructions``), ``scoreboard_snapshot`` (the IMMUTABLE proposed-vs-current
    per-provider cells copied inline at propose-time — the evidence the card renders, NOT read live
    through the mutable ``source_tuner_run_id`` FK), and ``source_tuner_run_id`` (provenance only). The
    instruction fields default to ``""`` so a description row (no instructions) serializes without a
    validation error.

    ``created_at``/``updated_at`` are nullable because the response is assembled in-app (the id is
    minted app-side, mirroring ``start_eval_run``'s ``run_id``); they are hydrated from the DB
    insert/update echo when present (always, in production) and are ``None`` only under a
    non-echoing test fake. ``user_id`` is intentionally omitted (the caller's own id — not part of
    the frontend contract)."""

    id: UUID
    skill_id: UUID
    base_skill_version_id: UUID
    new_skill_version_id: UUID | None = None
    re_eval_run_id: UUID | None = None
    source_eval_run_id: UUID | None = None
    proposed_instructions: str = ""
    base_instructions: str = ""
    rationale: str
    evidence_summary: str
    status: str
    override_forced: bool = False
    gate: PromotionGate | None = None
    # ── Phase 139 (SI-02) — the description-proposal fields (D-11). ONE contract for both kinds:
    # a kind='description' row carries proposed_description (+ its base_description diff base +
    # the immutable scoreboard_snapshot evidence + the provenance source_tuner_run_id), and the
    # instruction fields above default to "" so it serializes cleanly. Declared HERE (not a Wave-2
    # module) so FastAPI does not strip a field the description routes WRITE (module docstring
    # :99-106). All FLAT single-typed (Gemini ``type: [...]`` array trap): ``str | None`` /
    # ``dict | None`` / ``UUID | None``.
    kind: str = "instruction"
    proposed_description: str | None = None
    base_description: str | None = None
    scoreboard_snapshot: dict | None = None
    source_tuner_run_id: UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

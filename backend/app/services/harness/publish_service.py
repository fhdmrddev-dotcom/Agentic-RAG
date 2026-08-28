"""Phase 102 (QUAL-01 / D-07/D-08) — the server-side publish path (output-quality gate).

``publish()`` is the orchestration the ``POST /workflows/{id}/publish`` route delegates
to (Plan 05 Task 3). A draft becomes published ONLY through here, enforcing IN ORDER:

    0.  load + owner-check the draft (V4 — a non-owner gets ``not_found`` -> 404)
    1.  business_requirement present? (D-13 publish-time invariant -> 400 on absence)
    2.  structural lint              (reachability.lint_workflow — pure, no I/O)
    2.5 interactive-phase pre-run    (WR-04 — llm_human_input / ask_user cannot be validated)
    2.6 grounding fidelity           (Phase 182 gap closure — the SHARED
                                      ``grounding.grounding_verdicts``: folder_scope ⊆ the
                                      project subtree, available tools ∈ the registry, a
                                      phase skill reference ∈ the caller's enabled set)
    3.  a REAL golden run            (is_golden_run=True on the project KB — D-05, no mocks)
    4.  the judge verdict            (the llm_judge_rubric forced emission over the run's output)
    5.  flip                         (publish_definition — draft->published)

STAGE 2.6 IS THE ANTI-DRIFT HALF (Phase 182 / VALID-01 / D-182-02 / D-182-06). It calls the
SAME collector ``POST /workflows/validate`` previews, so there is exactly ONE copy of every
grounding rule and the canvas can never drift from the publish gauntlet it must ultimately
pass. Before this stage existed, a definition naming a hallucinated tool or an inaccessible
skill reference painted RED in ``/validate`` and published GREEN
(``182-VERIFICATION.md`` Truth 5 / WR-01). No grounding rule is implemented here — this
module only calls the shared one.

DELIBERATELY NOT GATED — ``create_draft`` (``POST /workflows``) and ``update_draft``
(``PATCH /workflows/{id}``) do NOT enforce grounding fidelity. This is a DECISION, not an
oversight: a work-in-progress draft must remain storable while incomplete, or the Phase 184
canvas editing loop becomes hostile (every keystroke that outruns its node config would be
rejected). ``POST /workflows/validate`` is the live ADVISORY surface; PUBLISH is the
ENFORCING gate. Anything that mints a version passes stage 2.6.

A lint-clean workflow whose JUDGE fails CANNOT publish — that is the QUAL-01 hard
blocker. Every block returns the D-08 structured verdict
(``{published, blocked_stage, named_failures, golden_run_id}``) AND writes a
``publish_blocked`` receipt; the attempt writes ``publish_attempted``; a success writes
``publish_succeeded`` + a ``judge_verdict`` receipt.

SEALED ORCHESTRATION (the ``forced_emit`` posture): this function NEVER raises into
the route — every branch returns a structured dict; the golden-run drive is wrapped so a
mid-run crash returns ``blocked_stage="golden_run_error"`` rather than a 500.

LIVE ACCEPTANCE (D-05 / Pitfall 4 — the 099/101 mock-mask lesson): the unit tests
(``test_publish_service.py``) mock the golden-run + judge boundaries to assert the
pipeline ORDER and the hard-blocker contract; the REAL acceptance is the LIVE golden run
against the project KB on the VALIDATION.md SC#10 4-axis scoreboard — not the mocked test.

RECEIPT KEYING (the documented choice, plan Task 2 note): ``publish_attempted`` is written
AFTER the golden run row exists (stage 3) so it carries a real ``run_id``; EVERY pre-run
block — stages 0, 1, 2, 2.5 and 2.6 — writes ``publish_blocked`` keyed to a NULL ``run_id``
(``harness_audit.run_id`` is nullable — full-schema.sql:452) with the definition id in
metadata. The governance trail is honest about whether a real run was created.
"""

from __future__ import annotations

import logging
import unicodedata
from uuid import UUID

logger = logging.getLogger(__name__)


async def publish_workflow(
    *,
    definition_id: UUID,
    golden_input: str,
    user: dict,
    pool,
    redis,
    supabase=None,
) -> dict:
    """The D-07/D-08 publish orchestration. Returns the structured verdict.

    See the module docstring for the 6-stage flow. Never raises into the caller.
    The route (Task 3) maps the structured result to HTTP:
      - ``blocked_stage == "not_found"`` / ``"already_published"`` -> 404 / 409
      - ``blocked_stage == "business_requirement"`` -> 400 (D-13)
      - any other block -> 200 ``{published: False, blocked_stage, named_failures, golden_run_id}``
      - success -> 200 ``{published: True, version, golden_run_id}``
    """
    # Function-local heavy imports (Pitfall 4 — no engine/render import at module top).
    # IN-01: create_workflow_run / load_run_phases / write_audit are used only by the
    # helpers (which re-import them locally) — publish_workflow itself needs only these.
    from app.db.workflows import get_definition, publish_definition
    from app.models.harness import WorkflowDefinition
    # Phase 182 (D-182-02 / Pitfall 4): the D-13 stage-1 predicate is now a SHARED
    # one-liner in the grounding module so publish and the canvas /validate seam call
    # ONE copy — a copy-pasted rule drifts, even a trivial one.
    from app.services.harness.grounding import (
        BUSINESS_REQUIREMENT_MISSING_MESSAGE,
        business_requirement_missing,
    )
    from app.services.harness.reachability import lint_workflow

    user_id_raw = user.get("id")
    if user_id_raw is None:
        return {
            "published": False,
            "blocked_stage": "not_found",
            "named_failures": ["no authenticated user"],
            "golden_run_id": None,
        }
    user_id = UUID(user_id_raw) if isinstance(user_id_raw, str) else user_id_raw

    # ── stage 0: load + owner-check (V4 — a non-owner gets not_found -> 404) ──────
    row = await get_definition(pool, definition_id, user_id=user_id)
    if row is None:
        # not-found AND cross-user collapse to the SAME structured block (no existence
        # leak — T-102-05-06); the route 404s uniformly. NOT a publish_attempted (no
        # row was even owned to attempt against).
        return {
            "published": False,
            "blocked_stage": "not_found",
            "named_failures": ["workflow not found"],
            "golden_run_id": None,
        }

    # Phase 186 (D-186-10) — the draft AS IT WAS WHEN WE STARTED CHECKING IT. Captured
    # here, spent at stage 5, minutes of golden run later. ``row.get`` and NEVER a
    # SUBSCRIPT: at least five shipped test files patch ``get_definition`` with
    # hand-built dicts that carry no ``token`` key, and a subscript would turn every one
    # of them into a KeyError. A missing token degrades to ``None``, which
    # ``publish_definition`` defines as today's unguarded flip — the same graceful shape
    # as the route's optional ``If-Match``.
    stage0_token = row.get("token")

    if row.get("status") != "draft":
        return await _block(
            pool,
            run_id=None,
            user_id=user_id,
            definition_id=definition_id,
            stage="already_published",
            named_failures=["only a draft can be published"],
            golden_run_id=None,
        )

    raw_definition = row.get("definition")
    if isinstance(raw_definition, str):
        import json

        try:
            raw_definition = json.loads(raw_definition)
        except (ValueError, TypeError):
            raw_definition = None
    try:
        definition = WorkflowDefinition.model_validate(raw_definition)
    except Exception as e:  # noqa: BLE001 — a malformed definition is a structured block, not a 500
        return await _block(
            pool,
            run_id=None,
            user_id=user_id,
            definition_id=definition_id,
            stage="definition_invalid",
            named_failures=[f"definition failed validation: {e}"],
            golden_run_id=None,
        )

    # ── stage 1: business_requirement present? (D-13 publish-time invariant) ─────
    # The predicate is the SHARED grounding.business_requirement_missing (Phase 182) —
    # behavior identical, now one source with the canvas /validate seam.
    if business_requirement_missing(definition):
        return await _block(
            pool,
            run_id=None,
            user_id=user_id,
            definition_id=definition_id,
            stage="business_requirement",
            # ONE source with the /validate seam — see the constant's docblock.
            named_failures=[BUSINESS_REQUIREMENT_MISSING_MESSAGE],
            golden_run_id=None,
        )

    # ── stage 2: structural lint (pure; short-circuits BEFORE the golden run) ─────
    #
    # ── PHASE 214 (STEP-03 / D-214-09 / D-214-10) — WHY THIS IS AN EXTENSION AND NOT A
    #    SIXTH STAGE, since CONTEXT leaves that to discretion and only *cheap and before the
    #    golden run* is binding. A sibling stage would have been ~14 lines and equally cheap;
    #    extending keeps ONE lint stage, ONE `_block` call and ONE `blocked_stage` value, so
    #    the refusal surface gains no stage to render and sketch 215's invariant #8 (exactly
    #    one blocked stage) stays trivially true rather than newly-argued. The ordering
    #    rationale is stage 2.6's, verbatim in shape: this check needs exactly what
    #    `/validate` needs — the definition and the server-side registries — plus ONE
    #    connection read for the MCP shape, and nothing whatsoever from a run.
    #
    # ⭐ THE PREDICATE IS THE SHARED `args.unsatisfiable_arguments`, the other half of the
    #    `resolve_arguments` the EXECUTOR sends with (D-214-00). That is the same mechanical
    #    argument stage 1 already won in this file for `business_requirement_missing`: one
    #    source, so the gate and the thing it gates cannot disagree. A second copy here would
    #    publish a workflow that then fails at the send, which is `BUG-260826-02` one level up.
    tool_schemas = await _bound_tool_schemas(
        definition, definition_id=definition_id, pool=pool
    )
    lint_errors = lint_workflow(definition, tool_schemas=tool_schemas)
    if lint_errors:
        return await _block(
            pool,
            run_id=None,
            user_id=user_id,
            definition_id=definition_id,
            stage="lint",
            named_failures=[_lint_named_failure(e) for e in lint_errors],
            golden_run_id=None,
        )

    # ── stage 2.5: interactive-phase pre-run block (WR-04 — lint-class) ──────────
    # A synchronous publish cannot validate interactive phases: an llm_human_input
    # phase (or a validator whose on_failure routes to ask_user) BLOCKS on an
    # unsubscribed ask_user prompt for which no human is watching, dead-ending the
    # publish golden run. Block such definitions PRE-RUN with a named failure (cheap —
    # no provider call) so the golden run is never driven for them. This is the honest
    # minimum-viable cut.
    #
    # ⚠ SUPERSEDED — D-14 / code-review WR-05 (2026-08-15). THE SENTENCE THIS PARAGRAPH
    # USED TO END WITH IS QUOTED HERE RATHER THAN DELETED, because a deferral that lives
    # only in a deleted comment is exactly as invisible as one that was never written.
    # It read, verbatim: *"The full background-job publish that COULD validate interactive
    # phases is the deferred Phase-103 rework."* That sentence is precisely what
    # ``SEED-164`` was planted to retire — it named work scheduled NOWHERE (zero roadmap
    # phases, zero owning seeds, zero deferred-item entries) and attached a phase number
    # to it, so it read like a plan for a year while Phase 103 itself had long shipped.
    # Phase 193.2 removed it from ``_interactive_phase_failures``' docstring below and
    # left it standing HERE, so two blocks in one file said opposite things; this is that
    # half. ⚠ It is quoted on ONE line on purpose: split across two, as it shipped, a
    # line-oriented ``grep`` for the phrase returned NOTHING and read as "already fixed".
    #
    # WHAT IS TRUE NOW, WITH THE DEFERRAL KEPT INSTEAD OF EVAPORATED. A publish that can
    # VALIDATE an interactive phase — a durable pause with a real subscriber, or the
    # cheaper "skip/stub the step during the golden run, keep it in the published
    # definition for real runs" shape the operator proposed — is a named capability NEED
    # with a durable home:
    # ``.planning/seeds/SEED-164-a-workflow-that-legitimately-pauses-for-a-person.md``.
    # It is a seed rather than a schedule, and nothing here promises it. Its PRIMARY
    # re-open trigger is this gate itself: any phase that touches the publish gauntlet or
    # ``_interactive_phase_failures`` re-opens SEED-164 by definition — that is the
    # concrete condition which stops this deferral evaporating a second time.
    interactive_failures = _interactive_phase_failures(definition)
    if interactive_failures:
        return await _block(
            pool,
            run_id=None,
            user_id=user_id,
            definition_id=definition_id,
            stage="interactive_phase",
            named_failures=interactive_failures,
            golden_run_id=None,
        )

    # ── stage 2.6: grounding fidelity (Phase 182 gap closure — the SHARED rules) ──
    # ORDERING RATIONALE. This is the LAST of the cheap static gates and it runs BEFORE
    # the golden run because:
    #   * it needs exactly what ``/validate`` needs — the definition, the owner, and the
    #     server-side registries — and nothing whatsoever from a run;
    #   * it is a pre-run static check (one folder read + one skill read + the in-process
    #     tool registry), so a hallucinated tool or an inaccessible skill reference can
    #     never burn a REAL provider run (the same posture as the lint short-circuit);
    #   * it is placed AFTER the existing gates rather than before them, so no currently
    #     blocking definition changes WHICH stage it blocks at — nothing is reordered.
    #
    # SEEN AND DEFERRED — IN-05 (round-2 review). ``supabase`` stays ``None`` between this
    # stage and the golden run below, so ``_resolve_publish_supabase`` runs TWICE per publish
    # and each self-constructed client opens an httpx client that is never closed. Resolving
    # once and threading the pair through both would fix it, but restructuring this
    # orchestration is outside the operator-selected scope of this round. Recorded here so the
    # next reader meets a deferral rather than re-discovering it — and so it is not mistaken
    # for something the WR-05 tuple change introduced (it predates it; the tuple adds no read).
    grounding_failures = await _grounding_fidelity_failures(
        definition,
        definition_id=definition_id,
        user_id=user_id,
        pool=pool,
        supabase=supabase,
    )
    if grounding_failures:
        return await _block(
            pool,
            run_id=None,
            user_id=user_id,
            definition_id=definition_id,
            stage="grounding_fidelity",
            named_failures=grounding_failures,
            golden_run_id=None,
        )

    # ── stage 3: the REAL golden run (is_golden_run=True; no mocks, no opt-out) ───
    # WR-04 (T-102-09-03): the synchronous golden run is bounded by a publish-level
    # wall budget. ``asyncio.wait_for`` cancels a wedged run after
    # ``harness_publish_max_seconds`` so the request cannot hang for hours; a timeout
    # maps to an honest ``golden_run_timeout`` block (never a hung request / 500). The
    # TimeoutError handler MUST precede the broad ``except Exception`` (asyncio.TimeoutError
    # is a subclass of Exception in 3.11+ — order matters).
    import asyncio  # function-local (mirrors _drive_golden_run)

    from app.config import settings  # function-local

    try:
        golden_run_id, final_output, terminal_status = await asyncio.wait_for(
            _drive_golden_run(
                definition_id=definition_id,
                definition=definition,
                golden_input=golden_input,
                user_id=user_id,
                pool=pool,
                redis=redis,
                supabase=supabase,
            ),
            timeout=settings.harness_publish_max_seconds,
        )
    except asyncio.TimeoutError:
        logger.warning(
            "publish: golden run exceeded the publish budget (%ss) for definition %s",
            settings.harness_publish_max_seconds,
            definition_id,
        )
        return await _block(
            pool,
            run_id=None,
            user_id=user_id,
            definition_id=definition_id,
            stage="golden_run_timeout",
            named_failures=[
                f"the golden run exceeded the publish budget "
                f"({settings.harness_publish_max_seconds}s) and was abandoned"
            ],
            golden_run_id=None,
        )
    except Exception as e:  # noqa: BLE001 — a golden-run crash is a structured block, never a 500
        logger.exception("publish: golden run failed for definition %s", definition_id)
        golden_run_id = getattr(e, "golden_run_id", None)
        err_msg = f"{type(e).__name__}: {e}" if str(e).strip() else type(e).__name__
        return await _block(
            pool,
            run_id=golden_run_id,
            user_id=user_id,
            definition_id=definition_id,
            stage="golden_run_error",
            named_failures=[f"golden run could not complete: {err_msg}"],
            golden_run_id=golden_run_id,
        )

    # The attempt now has a real run_id (the documented receipt-keying choice).
    await _safe_audit(
        pool,
        golden_run_id,
        user_id=user_id,
        event_type="publish_attempted",
        metadata={"definition_id": str(definition_id), "golden_run_id": str(golden_run_id)},
    )

    # A golden run that FAILED a structural gate (citations / integrity) during the
    # run never reaches the judge — block at the structural_gate stage with the run id.
    if terminal_status == "failed":
        named = _structural_failures(final_output)
        return await _block(
            pool,
            run_id=golden_run_id,
            user_id=user_id,
            definition_id=definition_id,
            stage="structural_gate",
            named_failures=named or ["the golden run failed a structural gate"],
            golden_run_id=golden_run_id,
        )

    # ── D-214-11: the golden run validates the arguments it RESOLVED — AND SENDS NOTHING ──
    #
    # The static gate above proves each source arm on its own terms; it cannot see a VALUE.
    # An `ask` argument whose launcher left the field blank, or an `upstream` phase whose
    # output came back empty, is structurally fine and still unsendable — and the golden run
    # has just resolved exactly that object. Re-projecting it costs no model call and no
    # wall-clock: the run already happened.
    #
    # ⭐ D-16's NO-SEND LINE IS UNTOUCHED. Nothing here constructs an adapter, and nothing
    # here calls `send()`. The projection is `args.resolve_arguments` — the same pure function
    # the executor uses — over the recorded intent the golden run already wrote. Publishing
    # still cannot fire a real email, and the suite asserts it through the SHIPPED no-egress
    # fence rather than a new mock.
    #
    # ⚠ IT BLOCKS AT `structural_gate` AND MINTS NO NEW `blocked_stage`. A new stage value
    # would be a stage the refusal surface cannot name (sketch 215 §1 ships four stage words),
    # and this failure genuinely belongs to the golden run's own gate: the run produced an
    # argument object its action cannot accept.
    resolved_arg_failures = await _golden_run_argument_failures(
        definition, run_id=golden_run_id, pool=pool, tool_schemas=tool_schemas
    )
    if resolved_arg_failures:
        return await _block(
            pool,
            run_id=golden_run_id,
            user_id=user_id,
            definition_id=definition_id,
            stage="structural_gate",
            named_failures=resolved_arg_failures,
            golden_run_id=golden_run_id,
        )

    # ── stage 4: the judge verdict (the QUAL-01 hard blocker) ────────────────────
    # IN-04: forward the run owner's effective settings to the judge shot (the SAME
    # cached read the golden run used — D-v2.5-01) instead of user_settings=None, so the
    # judge provider's gateway key/config resolution is owner-bound. Best-effort: a load
    # failure degrades to None (the judge still resolves an independent forceable model).
    owner_settings = None
    try:
        from app.models.user_settings import load_user_settings  # function-local

        owner_settings = load_user_settings(str(user_id))
    except Exception:  # noqa: BLE001 — judge falls back to its independent model resolution
        logger.warning(
            "publish: owner settings load failed for %s (judge shot)", user_id, exc_info=True
        )
    verdict = await _judge_golden_output(
        definition=definition,
        final_output=final_output,
        pool=pool,
        owner_settings=owner_settings,
    )
    # The verdict is recorded REGARDLESS of pass/fail (governance — Phase 107).
    await _safe_audit(
        pool,
        golden_run_id,
        user_id=user_id,
        event_type="judge_verdict",
        metadata={
            "definition_id": str(definition_id),
            "overall_passed": bool(verdict.get("overall_passed")),
            "overall_score": verdict.get("overall_score"),
            "summary": verdict.get("summary"),
            "failure": verdict.get("failure"),
        },
    )

    if verdict.get("failure") or verdict.get("overall_passed") is not True:
        return await _block(
            pool,
            run_id=golden_run_id,
            user_id=user_id,
            definition_id=definition_id,
            stage="judge",
            named_failures=_judge_named_failures(verdict),
            golden_run_id=golden_run_id,
        )

    # ── stage 5: flip (all passed) ───────────────────────────────────────────────
    # Phase 186 (D-186-10): the flip is guarded on the STAGE-0 token, so what we publish
    # is what we spent the golden run checking. NOT wrapped in a transaction with any
    # other UPDATE — ``now()`` is transaction time and a sibling write would render an
    # identical token, silently disabling the guard (CONCURRENCY_TOKEN_SQL, Pitfall 9).
    version = await publish_definition(pool, definition_id, token=stage0_token)
    # WR-03 (T-102-09-02): publish_definition returns -1 when its ``status='draft'``
    # WHERE guard matched 0 rows — a concurrent double-publish (the race loser) or a
    # row no longer a draft. Without this check the caller returned a FALSE
    # ``{published: True, version: -1}`` receipt + a FALSE ``publish_succeeded``
    # governance row. Route the sentinel to an honest ``already_published`` block (the
    # route maps it to 409) so neither the API response nor the governance trail lies.
    if version == -1:
        return await _block(
            pool,
            run_id=golden_run_id,
            user_id=user_id,
            definition_id=definition_id,
            stage="already_published",
            named_failures=["the draft was published concurrently or is no longer a draft"],
            golden_run_id=golden_run_id,
        )
    # D-186-10: publish_definition returns -2 when the row is STILL an owned draft but
    # its token no longer matches the one captured at stage 0 — the draft was edited
    # while the gauntlet was running (autosave makes this routine, not exotic). The
    # sentinel is kept SEPARATE from -1 for the same reason -1 exists at all: a receipt
    # must describe what happened. A -2 routed to ``already_published`` would tell the
    # author that someone else published their workflow — false, and worse than useless,
    # because the true cause (their own newer edit) is the one thing that tells them what
    # to do next. The golden run and every harness_audit row it wrote are PRESERVED: this
    # is a ``_block``, which only ADDS a publish_blocked receipt, and ``golden_run_id`` is
    # carried through so the refusal stays attributable to the run that really happened.
    if version == -2:
        return await _block(
            pool,
            run_id=golden_run_id,
            user_id=user_id,
            definition_id=definition_id,
            stage="draft_changed",
            named_failures=[
                "the draft changed while it was being checked — "
                "re-publish to check the new version"
            ],
            golden_run_id=golden_run_id,
        )
    await _safe_audit(
        pool,
        golden_run_id,
        user_id=user_id,
        event_type="publish_succeeded",
        metadata={
            "definition_id": str(definition_id),
            "version": version,
            "golden_run_id": str(golden_run_id),
        },
    )
    return {"published": True, "version": version, "golden_run_id": golden_run_id}


# Back-compat alias — the Wave-0 test stubs assert ``hasattr(publish_service, "publish_workflow")``;
# the route + the rest of the service call ``publish`` (the canonical name).
publish = publish_workflow


# ── helpers ───────────────────────────────────────────────────────────────────
async def _block(
    pool,
    *,
    run_id,
    user_id,
    definition_id,
    stage: str,
    named_failures: list,
    golden_run_id,
) -> dict:
    """Write a ``publish_blocked`` receipt + return the D-08 structured verdict.

    ``run_id`` is the golden run id once it exists (stage 3+), else ``None`` (a
    stage-0/1/2 block before any run — ``harness_audit.run_id`` is nullable). The
    definition id is always carried in the metadata so a NULL-run receipt is still
    attributable to the definition (Phase 107 receipt VIEW).
    """
    await _safe_audit(
        pool,
        run_id,
        user_id=user_id,
        event_type="publish_blocked",
        metadata={
            "definition_id": str(definition_id),
            "blocked_stage": stage,
            "named_failures": named_failures,
            "golden_run_id": str(golden_run_id) if golden_run_id else None,
        },
    )
    return {
        "published": False,
        "blocked_stage": stage,
        "named_failures": named_failures,
        "golden_run_id": golden_run_id,
    }


async def _safe_audit(pool, run_id, *, user_id, event_type: str, metadata: dict) -> None:
    """Write a governance receipt; a receipt-write failure NEVER fails the publish.

    The receipt is the governance trail, not the gate — a transient DB hiccup on the
    INSERT must not 500 a publish decision that was already made. Logged, swallowed.
    """
    from app.db.workflows import write_audit  # function-local

    try:
        await write_audit(
            pool, run_id, user_id=user_id, event_type=event_type, metadata=metadata
        )
    except Exception:  # noqa: BLE001
        logger.warning(
            "publish: %s receipt write failed (run_id=%s) — decision unaffected",
            event_type,
            run_id,
            exc_info=True,
        )


# ══ Phase 214 (STEP-03 / D-214-09..12) — the argument gate's own helpers ══════════════


def _external_action_phases(definition) -> list:
    """Every ``external_action`` phase of a definition, in ``phase_index`` order."""
    phases = [
        p
        for p in (getattr(definition, "phases", None) or [])
        if getattr(getattr(p, "config", None), "phase_type", None) == "external_action"
    ]
    return sorted(phases, key=lambda p: getattr(p, "phase_index", 0))


async def _bound_tool_schemas(definition, *, definition_id: UUID, pool) -> dict:
    """``{connection_id: {tool_name: inputSchema}}`` for the definition's MCP-shaped steps.

    ⭐ THE ONE THING THE PURE LINT CANNOT DO FOR ITSELF, AND THE REASON IT LIVES HERE.
    ``reachability.py`` is import-light so ``POST /workflows/validate`` can call
    ``lint_workflow`` on every canvas keystroke; an MCP step's argument shape lives on the
    connection's discovered-tool snapshot, which is a READ. So the I/O is done here, once per
    distinct connection, and handed in.

    ⛔ **THE SCHEMA IS OBTAINED THROUGH ``args.schema_for_bound_tool`` AND NOWHERE ELSE.**
    That accessor is the same one the executor calls at ``phase_types`` GATE 6/7 and the same
    one the approval pause calls, so the gate's schema and the executor's schema have
    IDENTICAL PROVENANCE by construction rather than by assertion. A paired test handing one
    schema object to both predicates proves ``f(s) == g(s)`` and is blind to
    ``s_gate != s_executor``; a gate linting against a different schema than the executor
    resolves against publishes a workflow that then sends an EMPTY argument object, silently.
    This function must never grow its own extraction.

    ⚠ NATIVE CAPABILITY STEPS ARE NOT READ FOR. Their schema is a pure in-process descriptor
    lookup that ``reachability`` performs itself through the same accessor, so a workflow whose
    external steps are all native performs ZERO extra I/O here. That is why the loop is over
    MCP-shaped phases only, and why this is cheap enough to sit in stage 2.

    ⛔ **AN UNREADABLE CONNECTION YIELDS NO ENTRY, WHICH THE GATE READS AS ``shape_unknown``
    AND BLOCKS.** Absent, disabled, another org's, or a snapshot that never mentions the tool —
    every one of them means *we cannot say what this action accepts*, and "unknown" must not
    look like "satisfied" (D-214-10). ⚠ Returning ``{}`` on a failed read is therefore NOT a
    silent pass: the map is always supplied, and a missing entry inside a supplied map is a
    refusal. The ``None`` sentinel (never looked) is reserved for ``/validate``.
    """
    from app.services.connectors.args import schema_for_bound_tool  # function-local (Pitfall 4)

    wanted: dict[str, set[str]] = {}
    for phase in _external_action_phases(definition):
        config = phase.config
        tool_name = getattr(config, "tool_name", None)
        if not tool_name:
            continue  # a native capability — pure lookup, no connection read needed
        connection_id = str(getattr(config, "connection_id", None) or "")
        wanted.setdefault(connection_id, set()).add(str(tool_name))

    if not wanted:
        return {}

    org_id = await _definition_org_id(pool, definition_id)
    schemas: dict[str, dict] = {}
    for connection_id, tool_names in wanted.items():
        snapshot = await _connection_tool_snapshot(connection_id, org_id)
        per_tool = {}
        for tool_name in sorted(tool_names):
            schema = schema_for_bound_tool(
                capability=None, tool_name=tool_name, discovered_tools=snapshot
            )
            if schema is not None:
                per_tool[tool_name] = schema
        schemas[connection_id] = per_tool
    return schemas


async def _connection_tool_snapshot(connection_id: str, org_id) -> list | None:
    """The bound connection's advertised-tool snapshot, or ``None`` when it cannot be read.

    Resolved through ``connector_service.resolve_connection`` — the SAME resolver the executor
    reaches the snapshot through at run time (``phase_types`` GATE 5), and the one that owns
    the D-14 org scoping. A second, hand-written read here would be a second answer to
    *"which connection is this?"*, which is the class of drift this whole plan exists to close.

    ⚠ EVERY FAILURE DEGRADES TO ``None`` AND THEREFORE TO A REFUSAL — absent, cross-org,
    disabled, credential-unreadable, or an org that does not resolve at all. This is the
    fail-CLOSED direction: a publish that cannot establish what an action accepts must not mint
    a version. It is logged, never raised, because ``publish_workflow`` never raises into the
    route.
    """
    if not connection_id or not org_id:
        return None
    from app.services import connector_service  # function-local (Pitfall 4)

    try:
        resolved = await connector_service.resolve_connection(connection_id, str(org_id))
    except Exception:  # noqa: BLE001 — an unreadable connection is a REFUSAL, never a raise
        logger.info(
            "214 STEP-03: connection %s did not resolve at publish time — its bound tools' "
            "argument shapes are unknown, so the gate will refuse the steps that use it",
            connection_id,
            exc_info=True,
        )
        return None
    return getattr(resolved, "discovered_tools", None)


async def _definition_org_id(pool, definition_id: UUID):
    """``workflow_definitions.org_id`` — the ONE read, shared by every consumer on this path.

    Extracted from ``_resolve_publish_supabase`` (which now calls it) so the argument gate can
    scope its connection reads WITHOUT constructing a service-role client it has no use for —
    that would have been a third ``_resolve_publish_supabase`` call per publish, compounding
    the IN-05 deferral recorded at stage 2.6. One implementation of the read is what keeps the
    client scope, the grounding scope and the connection scope from ever disagreeing about
    which tenant a publish is acting for.
    """
    return await pool.fetchval(
        "SELECT org_id FROM workflow_definitions WHERE id = $1", definition_id
    )


def _lint_named_failure(e) -> dict:
    """One ``named_failures`` entry for a lint error — the wire plan ``214-10`` consumes.

    The shipped three keys for every code, PLUS ``step_name`` / ``argument`` / ``upstream`` for
    the five argument-gap codes. The extra keys are added ONLY for those codes so the other
    five stages' payload shape is byte-unchanged.

    ⚠ THE BACKEND COMPOSES NO ENGLISH SENTENCE. D-213-15/-16 put the refusal in this gate;
    sketch 215 §1 puts the WORDS in ``publishRefusalVocabulary.ts`` and asserts them for
    character identity — so the wire carries KIND + STEP NAME + ARGUMENT NAME and the client
    composes. ``message`` stays the diagnostic the other four stages already emit: it is for
    the log and the audit receipt, not for the author's screen.

    ⚠ ``step_name`` GOES THROUGH ``_clean_label``. It is an unbounded author- or model-authored
    string that lands in a one-line slot AND in the PERSISTED ``harness_audit.metadata``, which
    is exactly why ``_LABEL_MAX_CHARS`` and the ``Cf``-inclusive scrub exist — see that
    constant's own comment for the 22-of-31 measurement that forced the category rule.
    """
    from app.services.harness.reachability import ARGUMENT_GAP_CODES  # function-local

    entry = {"code": e.code, "phase": e.phase_slug, "message": e.message}
    if e.code in ARGUMENT_GAP_CODES:
        # ⚠ ``_clean_label`` returns None for a missing or empty name. ``reachability`` has
        # already degraded a nameless phase to its slug (the ONE case where the author's word
        # and the slug coincide — see that emit site), so this is a scrub, not a fallback.
        entry["step_name"] = _clean_label(e.step_name)
        entry["argument"] = e.argument
        entry["upstream"] = e.upstream
    return entry


def _typed_scalar(value, declared_type: str) -> bool:
    """Does a RESOLVED value match the property's declared scalar type?

    Narrow on purpose — the four scalar types ``args.renderable_property`` admits, and nothing
    else. ``bool`` is checked BEFORE ``integer``/``number`` because ``isinstance(True, int)`` is
    True in Python and a boolean silently passing as an integer is precisely the kind of
    almost-right value this check exists to catch.
    """
    if declared_type == "boolean":
        return isinstance(value, bool)
    if isinstance(value, bool):
        return False
    if declared_type == "string":
        return isinstance(value, str)
    if declared_type == "integer":
        return isinstance(value, int)
    if declared_type == "number":
        return isinstance(value, (int, float))
    return True  # an enum or an unrecognised type — the static gate already ruled on shape


async def _golden_run_argument_failures(
    definition, *, run_id, pool, tool_schemas
) -> list:
    """D-214-11 — validate the arguments the golden run RESOLVED, and send nothing.

    The golden run wrote, per external-action phase, the ``recorded_intent`` it would have
    acted on (``phase_types`` GATE 1 — D-16 suppresses the SEND only). This re-projects that
    record through ``args.resolve_arguments`` — the executor's own function, over the same
    schema obtained from the same accessor — and checks each REQUIRED declared property is
    present, non-empty, and of the declared scalar type.

    ⚠ WHAT THIS CATCHES THAT THE STATIC GATE CANNOT: a value. The static gate proves an
    ``ask`` key is DECLARED; whether a person typed anything is a run-time fact. It proves an
    ``upstream`` phase RUNS FIRST; whether that phase produced text is a run-time fact.

    ⚠ THE VOCABULARY IS THE SAME FIVE AND IS NOT WIDENED HERE. A resolved value that is absent,
    empty, or of the wrong type all report ``no_source`` — *nothing supplied a usable value* —
    with the type detail in ``message`` for the log and the receipt. A sixth kind is not this
    plan's to mint: ``publishRefusalVocabulary.ts`` keys a compiler-enforced ``Record`` on the
    union, and adding a member is a cross-plan, cross-language change with its own sentence to
    author. Recorded as a deliberate narrowing rather than left to be inferred.

    ⛔ NOTHING IS SENT AND NO ADAPTER IS CONSTRUCTED. Every call below is pure.

    Returns ``[]`` when the definition has no external-action step at all, so a workflow
    without one performs no extra read.
    """
    phases = _external_action_phases(definition)
    if not phases:
        return []

    from app.db.workflows import load_run_phases  # function-local (Pitfall 4)
    from app.models.thread import phase_output_object
    from app.services.connectors.args import resolve_arguments, schema_for_bound_tool
    from app.services.harness.reachability import _BODY_ARGUMENT_FOR_CAPABILITY

    try:
        rows = await load_run_phases(pool, run_id)
    except Exception:  # noqa: BLE001 — never raise into the sealed orchestration
        logger.warning(
            "214 D-214-11: could not read the golden run's phases for %s — skipping the "
            "resolved-argument check (the STATIC gate already passed)", run_id, exc_info=True,
        )
        return []

    outputs: dict[str, dict] = {}
    for row in sorted(rows or [], key=lambda r: r.get("phase_index", 0)):
        parsed = phase_output_object(row.get("output"))
        if isinstance(parsed, dict):
            outputs[str(row.get("slug") or "")] = parsed

    failures: list = []
    for phase in phases:
        config = phase.config
        capability = getattr(config, "capability", None)
        tool_name = getattr(config, "tool_name", None)
        if tool_name:
            connection_id = str(getattr(config, "connection_id", None) or "")
            schema = (tool_schemas or {}).get(connection_id, {}).get(str(tool_name))
            body_arg = None
        elif capability:
            schema = schema_for_bound_tool(
                capability=capability, tool_name=None, discovered_tools=None
            )
            body_arg = _BODY_ARGUMENT_FOR_CAPABILITY.get(capability)
        else:
            continue

        properties = (schema or {}).get("properties") or {}
        required = [n for n in ((schema or {}).get("required") or []) if n in properties]
        if not required:
            continue

        recorded = outputs.get(str(getattr(phase, "slug", "")), {}).get("recorded_intent")
        run_inputs = recorded.get("inputs") if isinstance(recorded, dict) else None
        # ⚠ NO RECORD IS NOT A FAILURE. A phase that was skipped by a branch, or a golden run
        # whose spine did not reach it, has resolved nothing to validate — and accusing it
        # would refuse a publish over a step that never ran.
        if not isinstance(run_inputs, dict):
            continue

        # The upstream bag the executor holds: `accumulated_outputs[slug]` is the phase's WHOLE
        # output dict, keyed by slug and nothing else. Only phases BEFORE this one are visible.
        upstream_outputs = {
            slug: out
            for slug, out in outputs.items()
            if slug != getattr(phase, "slug", None)
        }
        resolved = resolve_arguments(
            config=config,
            schema=schema,
            upstream_outputs=upstream_outputs,
            run_inputs=run_inputs,
            body_arg=body_arg,
        )

        step_name = _clean_label(getattr(phase, "name", None)) or getattr(phase, "slug", None)
        for name in required:
            value = resolved.get(name)
            missing = name not in resolved or value is None or (
                isinstance(value, str) and not value.strip()
            )
            declared_type = properties.get(name, {}).get("type")
            if missing:
                reason = "resolved to nothing"
            elif isinstance(declared_type, str) and not _typed_scalar(value, declared_type):
                reason = f"resolved to a {type(value).__name__}, not the declared {declared_type}"
            else:
                continue
            failures.append(
                {
                    "code": "no_source",
                    "phase": getattr(phase, "slug", None),
                    "message": (
                        f"step {str(step_name or '')!r}: the required argument {name!r} "
                        f"{reason} when the workflow actually ran"
                    ),
                    "step_name": step_name,
                    "argument": name,
                    "upstream": None,
                }
            )
    return failures


def _structural_failures(final_output) -> list:
    """Name the structural-gate failure(s) on a failed golden run's final output."""
    if not isinstance(final_output, dict):
        return []
    reason = final_output.get("_failure_reason")
    if reason:
        return [str(reason)]
    return []


#: T-193.2-01 — the ceiling on a model- or author-authored ``PhaseSpec.name`` before it is
#: embedded in the refusal below. ``name`` is an UNBOUNDED ``str | None``
#: (``models/harness.py:364``) and the value it carries now reaches THREE surfaces: a
#: ``text-[12px] leading-snug`` span in a ``shrink-0`` header slot
#: (``PublishGauntlet.tsx:932-939``), an ``aria-describedby`` label, and — via ``_block`` —
#: the PERSISTED ``harness_audit.metadata.named_failures`` payload. Unclamped, a 10 KB step
#: name becomes a 10 KB refusal in a one-line slot AND a 10 KB audit row.
#:
#: 72 is chosen rather than magic: it keeps a LABELLED message (see the measured lengths on
#: the literals below) in the same order of magnitude as the two shipped siblings this copy
#: sits beside — the pre-193.2 interactive message at 105 characters and
#: ``BUSINESS_REQUIREMENT_MISSING_MESSAGE`` at 99 — instead of an order above them.
#:
#: ⚠ XSS IS NOT THE THREAT AND THIS IS NOT AN ESCAPE FUNCTION. The message reaches React as
#: a TEXT CHILD and there is no ``dangerouslySetInnerHTML`` anywhere on this path. Do NOT
#: "harden" this into HTML-escaping: it would mangle ordinary copy (an apostrophe or an
#: ampersand in a step name) to defend against something the renderer already prevents.
#: What IS defended here is LENGTH and ONE-LINE SHAPE.
_LABEL_MAX_CHARS = 72

#: The four refusal literals (D-12/D-13). ⚠ ARM 1 AND ARM 2 SHARE NO SENTENCE, and that is a
#: correctness property rather than style — they describe DIFFERENT things, and 193.1's D-26
#: defect in ``grounding.py`` was precisely ONE string serving both meanings. Arm 1 is about
#: the STEP (remove it); arm 2 is about a step's FAILURE ROUTE (change it). A later
#: "simplification" that collapses them back onto one literal is a regression and is pinned
#: by a test driven RED against exactly that plant.
#:
#: ⚠ NO INTERNAL IDENTIFIER AND NO SLUG APPEARS IN ANY BRANCH. The pre-193.2 message read
#: *"interactive phases (llm_human_input / ask_user dispositions) cannot be validated in a
#: synchronous publish"* — two engine identifiers aimed at a person who chose neither and can
#: see neither word anywhere on the canvas. That is ``BUG-260815-01``, and it is the same
#: failure class as ``BUG-260809-02`` (whose message named an internal snake_case field).
#:
#: ⚠ NOTHING UNSCHEDULED IS PROMISED (D-14). No "planned", "coming", "soon", "deferred" or
#: "future release" — the capability a workflow that legitimately pauses for a person would
#: need is ``SEED-164``, which is a seed and not a schedule.
_INTERACTIVE_STEP_NAMED = (
    'Publishing runs this workflow from start to finish, and the step "{label}" stops to '
    "wait for a person. Remove that step to publish."
)
_INTERACTIVE_STEP_UNNAMED = (
    "Publishing runs this workflow from start to finish, and one step stops to wait for a "
    "person. Remove that step on the canvas to publish."
)
_INTERACTIVE_FALLBACK_NAMED = (
    'Publishing cannot pause for anyone, and "{label}" asks a person whenever its check '
    "fails. Change that check's fallback to publish."
)
_INTERACTIVE_FALLBACK_UNNAMED = (
    "Publishing cannot pause for anyone, and one step asks a person whenever its check "
    "fails. Change that check's fallback on the canvas to publish."
)


#: The Unicode GENERAL CATEGORIES ``_clean_label`` collapses to a space, stated as a CLASS
#: rather than as a list of codepoints — which is the whole correction made here.
#:
#: ⚠ CORRECTED ON MEASUREMENT, 2026-08-15 (code review ``WR-02``), AND THE PREVIOUS RULE IS
#: RECORDED BESIDE IT RATHER THAN ERASED. As first shipped the scrub was
#: ``ch.isspace() or ord(ch) < 32 or ord(ch) == 127`` — i.e. exactly category ``Cc`` plus
#: whitespace. Driven against the shipped function over a 31-codepoint table
#: (``test_publish_service.py::_HOSTILE_CODEPOINTS``), **22 survived it and every single
#: survivor was category ``Cf``**: ``U+00AD`` (soft hyphen), ``U+200B`` (zero-width space),
#: ``U+200E``/``U+200F`` (the directional marks), ``U+202A``–``U+202E`` (the bidi embeddings
#: and the RIGHT-TO-LEFT OVERRIDE), ``U+2066``–``U+2069`` (the directional isolates),
#: ``U+2060`` (word joiner), ``U+FEFF`` (BOM/ZWNBSP) and the rest.
#:
#: ⚠ FIXING THIS BY NAMING THE FOUR CODEPOINTS A REVIEWER HAPPENED TO TRY WOULD REPRODUCE THE
#: EXACT BLINDNESS BEING FIXED. The rule is the category, and the test that guards it asserts
#: an INDEPENDENT literal table of hostile codepoints rather than re-deriving this predicate.
#:
#: WHAT IS EXCLUDED, AND WHY — audit this list rather than re-deriving it:
#:   ``Cc``  control            — the original rule; a newline or a ``\\x07`` breaks the
#:                                one-line shape this function exists to guarantee.
#:   ``Cf``  format             — THE CLASS THAT WAS MISSING. Zero-width and bidi-control
#:                                characters are INVISIBLE in the refusal yet change what the
#:                                operator reads: ``U+202E`` reverses the *displayed* order of
#:                                everything after it, including the actionable clause, and
#:                                ``U+200B`` makes an operator ``grep`` disagree with the
#:                                screen. Display spoofing and hidden content — NOT injection
#:                                (see the ``_LABEL_MAX_CHARS`` note above: React renders this
#:                                as a text child and there is no ``dangerouslySetInnerHTML``
#:                                on the path).
#:   ``Cs``  surrogate          — never a legible character on its own.
#:   ``Co``  private use        — renders as whatever a font decides; carries no shared meaning.
#:   ``Zl``/``Zp`` line + paragraph separators — ``U+2028``/``U+2029`` are line breaks that
#:                                ``isspace()`` already catches; named so the one-line
#:                                guarantee does not silently depend on that coincidence.
#:
#: WHAT IS DELIBERATELY **NOT** EXCLUDED, and why — both are named so the omissions read as
#: decisions rather than oversights:
#:   ``Cn``  unassigned         — Python's ``unicodedata`` is pinned to the Unicode version its
#:                                build ships. A character assigned in a LATER Unicode version
#:                                reads as ``Cn`` here, so excluding it would mangle a
#:                                legitimate label written in a newer script. Unassigned
#:                                codepoints render as tofu; they do not spoof.
#:   ``Mn``  non-spacing marks  — excluding them would destroy ordinary Arabic, Hindi, Hebrew
#:                                and Vietnamese step names. Stacked-diacritic ("Zalgo") noise
#:                                is bounded by ``_LABEL_MAX_CHARS`` instead.
_NON_PRINTING_CATEGORIES = frozenset({"Cc", "Cf", "Cs", "Co", "Zl", "Zp"})


def _clean_label(raw) -> str | None:
    """The single-line, length-bounded form of a phase ``name`` — or ``None`` (D-13).

    ``None`` is the signal for the caller's DEGRADED, name-free literal, and it is returned
    for a missing name, a non-string, and a name that trims empty.

    ⚠ THE DEGRADATION IS NEVER THE SLUG and NEVER A STEP NUMBER. The slug reintroduces the
    exact defect this rewrite exists to fix; and ``PhaseNodeCard`` puts no ``phase_index`` on
    the node face, so *"Step 3"* would name something the author cannot read on the canvas.

    ⚠ ``nodeTitle()``'s name → config-derived → type-sentence ladder
    (``phaseVocabulary.ts:231-240``) is DELIBERATELY NOT PORTED HERE. That ladder is computed
    AT RENDER and never stored (``models/harness.py:420-435``), and a second implementation of
    a derivation is forbidden by name in this repo. The server degrades to a true, name-free
    sentence instead of guessing at a title the client owns.

    ⚠ THE SCRUB IS BY UNICODE GENERAL CATEGORY, NOT BY CODEPOINT RANGE (``WR-02``, 2026-08-15).
    Every character in ``_NON_PRINTING_CATEGORIES`` — ``Cc`` control, ``Cf`` **format**, ``Cs``
    surrogate, ``Co`` private-use, ``Zl``/``Zp`` line + paragraph separator — plus anything
    ``str.isspace()`` accepts, becomes a single space, and runs are then collapsed. The
    constant's own comment records which classes are excluded, which two (``Cn``, ``Mn``) are
    deliberately NOT, and the 22-of-31 measurement that forced the change. **The invariant this
    function now delivers is: no non-printing character survives into copy** — the previous
    docstring's *"single-line"* claim was true only of ``Cc``.
    """
    if not isinstance(raw, str):
        return None
    # Collapse EVERY whitespace run and non-printing character to a single space. A newline in
    # a model-authored name breaks the one-line shape on BOTH surfaces this string feeds; a
    # format character (``Cf``) breaks something worse — it is invisible while changing what
    # the operator reads. ``Cc`` here is exactly the retired ``ord(ch) < 32 or ord(ch) == 127``
    # test, so nothing the old rule caught is let through.
    scrubbed = "".join(
        " " if (ch.isspace() or unicodedata.category(ch) in _NON_PRINTING_CATEGORIES) else ch
        for ch in raw
    )
    collapsed = " ".join(scrubbed.split())
    if not collapsed:
        return None
    if len(collapsed) > _LABEL_MAX_CHARS:
        # One-character ellipsis, so the clamped label is EXACTLY _LABEL_MAX_CHARS.
        return collapsed[: _LABEL_MAX_CHARS - 1].rstrip() + "…"
    return collapsed


def _interactive_phase_failures(definition) -> list:
    """Named failures for any INTERACTIVE validator blocking synchronous publish (WR-04).

    Returns one ``{"phase": <slug>, "message": ...}`` entry per phase that would
    dead-end the synchronous publish golden run by blocking on a human:

      - any validator whose ``on_failure == "ask_user"`` (the D-11 interactive
        disposition — it pauses the run waiting for a human to choose).

    Empty list == no blocking interactive phases (the publish proceeds to the golden run).

    ⚠ 200.3 (SEED-164): ``llm_human_input`` is permitted and no longer refused here.
    During the golden run, ``_exec_llm_human_input`` auto-continues with the first configured
    choice (or "Approved") when ``ctx.is_golden_run`` is True, enabling publishing while
    preserving interactive pausing for real live runs.
    """
    failures: list = []
    for phase in getattr(definition, "phases", []) or []:
        slug = getattr(phase, "slug", None)
        label = _clean_label(getattr(phase, "name", None))
        for v in getattr(phase, "validators", []) or []:
            if getattr(v, "on_failure", None) == "ask_user":
                failures.append(
                    {
                        "phase": slug,
                        "message": (
                            _INTERACTIVE_FALLBACK_NAMED.format(label=label)
                            if label
                            else _INTERACTIVE_FALLBACK_UNNAMED
                        ),
                    }
                )
                break  # one finding per phase is enough
    return failures


async def _resolve_publish_supabase(supabase, *, definition_id: UUID, pool) -> tuple:
    """The ONE service-role client resolution on the publish path (stage 2.6 + golden run),
    AND the ONE place the publish path learns which TENANT it is acting for.

    Returns ``(client, org_id)``.

    Phase 163 (D-05 / T-163-05b): NO bare, org-less service-role fallback survives on the
    publish / golden-run path. When the caller supplies no client, the org of the workflow
    definition being published (``workflow_definitions.org_id``, backfilled post-162) is
    read first and the client is built through the org-requiring factory in
    ``app.dependencies`` — which REFUSES to construct without an explicit org scope, by
    design. A falsy org therefore raises here rather than silently producing an
    unscoped BYPASSRLS client.

    THE SECOND RESPONSIBILITY (round-2 gap closure — WR-05). The definition's ``org_id`` was
    already being read here, used to scope the CLIENT, and then thrown away. It is now
    RETURNED, because BOTH consumers of that value read it from this one place: the client
    scope (Phase 163 / D-05) and the grounding-gate scope (WR-05). Reading it once is what
    makes it impossible for the two to disagree about which tenant a publish is acting for —
    a second read is how they would drift apart.

    THE ORG IS READ ON BOTH BRANCHES, deliberately. A caller-supplied client does not mean
    "no tenant": returning ``(supabase, None)`` would silently disable the gate's restriction
    in exactly the suites written to prove it, and would hand the gate a ``None`` scope on any
    future caller that passes its own client. A FALSY org is refused on both branches too —
    without a client the org-requiring factory refuses; with one, this function refuses
    itself, since there is no factory to do it. **A falsy org must never resolve to an
    unrestricted gate.** The refusal is a raise, which stage 2.6's fail-closed wrapper turns
    into a ``grounding_unavailable`` block — the correct direction.

    Shared by ``_grounding_fidelity_failures`` and ``_drive_golden_run`` so exactly ONE
    construction path exists (a second copy is how an org-less fallback creeps back in).
    Also the single patchable seam the unit suites swap — ``pool`` is an ``AsyncMock``
    there, so an un-patched resolution would hand a truthy mock to the factory.
    """
    from app import dependencies as _deps  # function-local (mirrors this module's posture)

    # Phase 214 — the read moved into ``_definition_org_id`` so the argument gate can scope its
    # connection reads without constructing a client. The SQL, the parameter and the semantics
    # are unchanged; what changed is that there is now one implementation of it rather than two.
    _org_id = await _definition_org_id(pool, definition_id)
    if supabase is not None:
        if not _org_id:
            raise ValueError(
                "publish cannot resolve the definition's org_id — refusing to run the "
                "grounding gate against the publisher's full org-membership union (WR-05)"
            )
        return supabase, _org_id
    return _deps.get_service_role_supabase(_org_id), _org_id


async def _grounding_fidelity_failures(
    definition,
    *,
    definition_id: UUID,
    user_id,
    pool,
    supabase,
) -> list:
    """Stage 2.6 — the grounding-fidelity named failures, from the ONE shared collector.

    Calls ``grounding.assemble_grounding_bundle`` + ``grounding.grounding_verdicts`` — the
    SAME copy ``POST /workflows/validate`` calls — so there is exactly ONE implementation of
    the three grounding rules (folder scope ⊆ the bound project subtree, every declared tool
    ∈ the real registry, every phase skill reference ∈ the caller's enabled set). D-182-02
    reuse-verbatim / D-182-06 red line: NOTHING is re-implemented, re-shaped, re-filtered or
    re-classified here — the collector's list is returned unchanged.

    PRE-RUN STATIC CHECK: one folder read + one skill read + the in-process tool registry —
    no provider call — so it short-circuits BEFORE the expensive golden run.

    The returned dicts are the collector's ``{code, phase, message}`` — the SAME shape the
    ``lint`` stage renders its named failures with (no new response vocabulary), per-node
    keyed on the phase ``slug``.

    FAILS CLOSED, TWO WAYS. On any raise — and on a bundle that reports itself DEGRADED —
    this returns a single ``grounding_unavailable`` named failure, which BLOCKS the publish.
    A publish that cannot verify grounding must not mint a version. Returning ``[]`` would
    silently publish an unverified definition, which is the exact defect this stage exists to
    close; raising would violate ``publish_workflow``'s sealed-orchestration contract (never
    raise into the route).

    WHY THE DEGRADED BRANCH EXISTS (round-2 gap closure — WR-01). This docstring used to claim
    that the posture here matched ``grounding._skill_registry``'s own fail-closed read
    (CR-01). That was false in the way that mattered: that read's swallow was INVISIBLE to
    this wrapper. A transient registry failure produced an EMPTY registry and a
    bundle that returned SUCCESSFULLY, so the ``try`` below never fired, the collector ran
    against nothing, and every membership test came back vacuously false — this stage then
    blocked publish naming the author's own valid phase references as unregistered. A factual
    accusation against a correct definition, sourced from an outage. The degradation now
    travels on ``bundle.degraded`` and this stage reports "we could not CHECK" instead, from
    the SAME builder ``POST /workflows/validate`` uses, so the two sides share one message and
    one code string as well as one rule set.

    SCOPED TO THE DEFINITION'S OWN ORG (round-2 gap closure — WR-05). This gate must answer
    "is this definition grounded in ITS OWN org?", not "can this publisher see everything it
    names". For a MULTI-ORG author those are different questions, and the second one is the
    wrong one: ``_resolve_publish_supabase`` had already read this definition's ``org_id`` to
    scope the BYPASSRLS client, and then the gate discarded it and let
    ``assemble_grounding_bundle`` resolve visibility from the publisher's ENTIRE org
    membership. A definition in org A naming an org-B skill or an org-B folder therefore
    passed.

    The RUN-TIME picture is the one that matters, and it flips: ``tool_dispatcher``'s skill
    resolution and ``fetch_visible_folders`` gate on the RUNNER's org set, so an org-A
    colleague running that published workflow gets an unresolvable reference or an empty
    folder intersection — a workflow that cleared the hard gate and silently under-performs
    for everyone but its author, with no way to tell whether the definition or the environment
    is at fault. Nothing crosses a tenant boundary on the wire; this is the SEED-124 /
    SEED-125 family (org-blind service-role reads) one layer up — the read IS org-gated, the
    SCOPE of the gate was wrong, and plan 182-06 is what made this gate authoritative.

    The fix is ONE optional keyword built from the org this path already reads, passed to BOTH
    grounding calls so the palette and the ⊆ walk agree. No visibility rule is duplicated: the
    shared skill predicate and the folder ancestor walk are untouched and simply receive a
    narrower org set.
    """
    from app.services.harness.grounding import (  # function-local (Pitfall 4)
        assemble_grounding_bundle,
        grounding_unavailable_finding,
        grounding_verdicts,
    )

    try:
        resolved, org_id = await _resolve_publish_supabase(
            supabase, definition_id=definition_id, pool=pool
        )
        # WR-05 — the gate's scope IS the definition's org, read once above alongside the
        # client scope so the two can never disagree. A raise on the way here (an unreadable
        # or falsy org) lands in the fail-closed ``except`` below as ``grounding_unavailable``,
        # which BLOCKS — the correct direction for a publish that cannot establish its tenant.
        bundle = await assemble_grounding_bundle(
            supabase=resolved, user_id=str(user_id), restrict_org_ids={str(org_id)}
        )
        if bundle.degraded:
            logger.warning(
                "publish: grounding registries %s could not be resolved for definition %s — "
                "blocking (fail-closed) without running the fidelity rules",
                sorted(bundle.degraded),
                definition_id,
            )
            return [grounding_unavailable_finding(bundle.degraded)]
        return await grounding_verdicts(
            definition,
            supabase=resolved,
            user_id=str(user_id),
            tool_names=bundle.tool_names,
            skill_ids=bundle.skill_ids,
            restrict_org_ids={str(org_id)},
        )
    except Exception:  # noqa: BLE001 — fail CLOSED, never raise into the sealed orchestration
        logger.exception(
            "publish: grounding registry could not be resolved for definition %s — "
            "blocking (fail-closed)",
            definition_id,
        )
        return [grounding_unavailable_finding()]


def _judge_named_failures(verdict: dict) -> list:
    """The D-08 named failures for a judge block — per-criterion critique + summary."""
    if verdict.get("failure"):
        return [
            f"the judge produced no verdict ({verdict['failure']}) — honest failure, "
            "not a silent pass"
        ]
    failures: list = []
    for c in verdict.get("criteria") or []:
        if isinstance(c, dict) and c.get("passed") is False:
            failures.append(
                {
                    "criterion": c.get("criterion"),
                    "score": c.get("score"),
                    "evidence": c.get("evidence"),
                }
            )
    summary = verdict.get("summary")
    if summary:
        failures.append({"summary": summary})
    return failures or [{"summary": "overall_passed is not True"}]


async def _drive_golden_run(
    *,
    definition_id: UUID,
    definition,
    golden_input: str,
    user_id: UUID,
    pool,
    redis,
    supabase,
) -> tuple[UUID, dict, str]:
    """Create + drive a REAL golden run on the project KB (D-05). Returns
    ``(run_id, final_output, terminal_status)``.

    The golden run needs a thread anchor (``create_workflow_run`` requires a
    ``thread_id``). The simplest viable path (plan Task 2 note): create an EPHEMERAL
    validation thread for the user, then build a minimal validation ctx mirroring the
    resume-path ctx (``harness_engine._build_resume_context`` — the canonical
    out-of-threads.py ctx template; G-5 forbids touching threads.py).

    The ctx carries the service-role supabase (owner-scoped retrieval enforced by the
    resolved ``folder_subtree_ids``), the run owner's effective settings + resolved
    model (resolve-never-mutate), and the project's resolved folder scope so the
    golden run retrieves ONLY the workflow's bound KB.
    """
    import asyncio
    from types import SimpleNamespace

    from app.config import settings
    from app.db.workflows import create_workflow_run, load_run_phases
    from app.services.harness_engine import _emit, run_workflow

    # The org-scoped service-role client — resolved through the ONE shared helper (Phase 182
    # plan 06 moved the Phase-163 / T-163-05b explanation onto ``_resolve_publish_supabase``
    # so the "no org-less fallback on the publish path" rule lives in a single place, shared
    # with the stage-2.6 grounding read). The ephemeral validation thread INSERT below still
    # relies on the mig-106 autofill for its own org_id.
    # The org is IGNORED here (bound to a throwaway name) on purpose: the golden run is scoped
    # by the CLIENT alone — every read it performs rides that already-org-scoped client, and
    # the ephemeral validation thread INSERT relies on the mig-106 autofill. Only stage 2.6's
    # grounding gate needs the org as a VALUE (WR-05).
    supabase, _golden_run_org_id = await _resolve_publish_supabase(
        supabase, definition_id=definition_id, pool=pool
    )

    # ── 1. ephemeral validation thread (the golden run's anchor) ─────────────────
    from fastapi.concurrency import run_in_threadpool  # D-v2.5-01: wrap blocking supabase-py

    thread_insert = {
        "user_id": str(user_id),
        "title": f"[validation] publish golden run — {definition.name}",
    }
    if definition.project_folder_id is not None:
        thread_insert["folder_id"] = str(definition.project_folder_id)
    thread_resp = await run_in_threadpool(
        lambda: supabase.table("threads").insert(thread_insert).execute()
    )
    thread_id = thread_resp.data[0]["id"]

    # ── 2. resolve the run owner's effective settings + ctx model + folder scope ──
    owner_settings = None
    try:
        from app.models.user_settings import load_user_settings

        owner_settings = load_user_settings(str(user_id))
    except Exception:  # noqa: BLE001 — fall back to phase-level model only
        logger.warning("publish: owner settings load failed for %s", user_id, exc_info=True)
    from app.services.sub_agent_models import resolve_workflow_ctx_model

    ctx_model = resolve_workflow_ctx_model(owner_settings)

    folder_subtree_ids = None
    if definition.project_folder_id is not None:
        from app.services.harness.scope import resolve_project_subtree

        folder_subtree_ids = await resolve_project_subtree(
            definition.project_folder_id, supabase=supabase, user_id=str(user_id)
        )

    # ── 3a-pre. BUG-260828-10 — the golden run must ANSWER what the workflow asks for ──
    #
    # A launch-time argument is sourced `ask`, and a golden run has no launcher and nobody
    # to ask. Before this, `inputs` carried `kickoff_prompt` and NOTHING else, so every such
    # argument resolved to nothing and the structural gate afterwards reported
    # `no_source: … resolved to nothing when the workflow actually ran`.
    #
    # ⚠ THE GATE WAS RIGHT ABOUT WHAT IT SAW; WHAT IT WAS SHOWN WAS WRONG. Validating
    # *does this argument resolve* against a run structurally incapable of supplying it
    # tests the harness, not the workflow — the gate could only ever return `no_source`
    # for this source kind, so `Asked when this runs` was unpublishable for EVERY author.
    # Measured 2026-08-28 by the operator: three phases green, citations green, blocked here.
    #
    # ⚠ THIS DOES NOT WEAKEN THE GATE. An argument with genuinely NO declared source still
    # resolves to nothing and is still refused — that is `BUG-260826-02` and the reason the
    # gate exists. Only a DECLARED input gets an answer here, which is precisely the case
    # the author already told us about.
    #
    # ⚠ `.invalid` IS LOAD-BEARING, NOT DECORATION (RFC 2606): it is a reserved TLD that can
    # never resolve, so a placeholder recipient cannot reach a person even if every other
    # guard failed. The golden run already records instead of sending and withholds `org_id`
    # so a credential cannot be scoped; this is a THIRD independent reason a publish-time
    # send cannot deliver. Do not replace it with a real-looking address.
    golden_inputs: dict[str, str] = {"kickoff_prompt": golden_input}
    for _spec in getattr(definition, "inputs", None) or []:
        _key = getattr(_spec, "key", None)
        # Never shadow the kickoff prompt: it carries the author's real golden input.
        if _key and _key not in golden_inputs:
            golden_inputs[_key] = f"golden-run-placeholder-{_key}@example.invalid"

    # ── 3. create the golden run (is_golden_run=True — the REAL run on the KB) ────
    run_id = await create_workflow_run(
        pool,
        thread_id=UUID(thread_id) if isinstance(thread_id, str) else thread_id,
        definition_id=definition_id,
        definition=definition,
        inputs=golden_inputs,
        model=ctx_model or None,
        user_id=user_id,
        is_golden_run=True,
    )

    # ── 3b. mint the producer-shell `runs` row (FK fix — mirrors _build_resume_context
    #        Facet C, 092-07). A harness sub-agent's parent_run_id FKs `runs.run_id`, so
    #        `ctx.producer_run_id` MUST be a real `runs` row — NOT the workflow_run id
    #        (which lives in `workflow_runs` and raises `runs_parent_run_id_fkey` on the
    #        first sub-agent spawn). This golden-run ctx build site was the UNPATCHED case
    #        `phase_types._build_sub_agent_parent_context` warns of (live producer + both
    #        resume sites mint/borrow a real runs row; the publish path did not). The shell
    #        never makes an LLM call; placeholder model/provider are bookkeeping only.
    from uuid import uuid4
    from app.db.runs import finalize_run, insert_run

    _producer_id = uuid4()
    _thread_uuid = UUID(thread_id) if isinstance(thread_id, str) else thread_id
    _user_uuid = user_id if isinstance(user_id, UUID) else UUID(str(user_id))
    await insert_run(
        pool,
        run_id=_producer_id,
        thread_id=_thread_uuid,
        user_id=_user_uuid,
        status="streaming",
        model="unknown",
        provider="unknown",
        parent_run_id=None,
    )

    # ── 4. build the minimal validation ctx (mirrors _build_resume_context) ──────
    # ⚠ Phase 190 UAT fix (D-14/D-16): `org_id` is DELIBERATELY ABSENT here, and its absence is
    # a FENCE, not the oversight that was just repaired in the live-kickoff and resume builders.
    # A golden run is a publish VALIDATION — D-16 already forbids it performing the external
    # action, and `_exec_external_action` reads `getattr(ctx, "org_id", None)` and fails CLOSED
    # without it. Withholding the org therefore makes a publish-time send impossible for a
    # SECOND, independent reason: if the `is_golden_run` gate is ever removed or bypassed, the
    # credential still cannot be scoped and the step records instead of sending. Do NOT "fix"
    # this to match the sibling builders — the asymmetry is the point. Any future need for an
    # org here must add it TOGETHER with an explicit publish-time send prohibition.
    ctx = SimpleNamespace(
        run_id=run_id,
        producer_run_id=_producer_id,  # real `runs` shell (sub-agent FK), NOT the workflow_run id
        thread_id=str(thread_id),
        current_user={"id": str(user_id)},
        user_settings=owner_settings,
        model=ctx_model,
        inputs=golden_inputs,
        redis=redis,
        pool=pool,
        emit=_emit,
        retry_feedback=None,
        supabase=supabase,
        folder_subtree_ids=folder_subtree_ids,
        scoped_folder_path=None,
        spawn=lambda coro: asyncio.create_task(coro),
        per_run_task_semaphore=asyncio.Semaphore(settings.task_per_run_concurrency),
        # ── D-19 (189, CONFLICT 1) — the ONE ctx in the tree that IS a golden run ──
        # READ BY ``harness_engine._run_phase_with_gates``' armed action-risk checkpoint
        # via ``getattr(ctx, "is_golden_run", False)``: a golden run SKIPS THE PAUSE
        # (no ask-channel subscribe) and still runs the step. The flag already existed
        # as the ``workflow_runs`` COLUMN (step 3 above) but was never on the ctx bag,
        # which is why the engine could not tell a publish from a live run and burned
        # ``harness_publish_max_seconds`` waiting for a person nobody had asked.
        # EVERY OTHER ctx BUILDER STAYS UNTOUCHED (threads.py, _build_resume_context,
        # unit stubs): the reader's ``getattr`` default IS the live-run answer, mirroring
        # ``create_workflow_run``'s own rule for this flag — default OFF = byte-identical.
        is_golden_run=True,
    )

    # ── 5+6. drive the real run end-to-end + harvest, ALWAYS terminalizing the
    #         producer shell on exit (no stranded 'streaming' row → the F2 self-heal
    #         stays intact; mirrors the resume caller's "MUST terminalize" contract). ──
    from datetime import datetime, timezone

    _shell_status = "failed"
    try:
        await run_workflow(run_id, definition, ctx, pool=pool, redis=redis, stream_run_id=run_id)

        phases = await load_run_phases(pool, run_id)
        terminal_status = "failed" if any(p.get("status") == "failed" for p in phases) else "completed"
        final_output: dict = {}
        for p in sorted(phases, key=lambda q: q.get("phase_index", 0)):
            out = p.get("output")
            if isinstance(out, str):
                import json

                try:
                    out = json.loads(out)
                except (ValueError, TypeError):
                    out = None
            if isinstance(out, dict):
                final_output = out  # the LAST phase with an output wins (the deliverable)
        _shell_status = "completed"
        return run_id, final_output, terminal_status
    except Exception as e:
        setattr(e, "golden_run_id", run_id)
        raise
    finally:
        try:
            await finalize_run(
                pool,
                run_id=_producer_id,
                status=_shell_status,
                error=None,
                completed_at=datetime.now(timezone.utc),
                message_id=None,
                input_tokens=None,
                output_tokens=None,
            )
        except Exception:  # noqa: BLE001 — shell cleanup never masks the run's own outcome
            logger.warning(
                "publish: producer-shell finalize failed for %s", _producer_id, exc_info=True
            )


async def _judge_golden_output(
    *, definition, final_output: dict, pool, owner_settings=None
) -> dict:
    """Run the forced judge shot over the golden run's final output (the QUAL-01 gate).

    Reuses the Plan-03 ``llm_judge_rubric`` machinery: it runs the forced judge shot
    itself (the verdict rides ``forced_emit`` — truncation-safe, honest fail, the
    independent judge model per D-03) and returns the verdict dict. A ``failure``/None
    result is an honest fail — a coerce/weak judge can NEVER silently produce a pass.

    ``owner_settings`` (IN-04) is the run owner's effective settings forwarded into the
    judge shot's ``forced_emit`` (the gateway key/config resolution) — consistent with
    the in-run validator's ``ctx.user_settings`` forwarding; ``None`` degrades gracefully.

    Returns the JudgeVerdict dict, or ``{"failure": <reason>}`` on an honest failure.
    """
    from app.config import get_model_capability
    from app.models.user_settings import load_app_settings_async  # function-local (Pitfall 4)
    from app.services.harness.validator_kinds import (  # function-local
        JUDGE_RUBRIC_CORE,
        JudgeVerdict,
        _judge_graded_text,
        resolve_judge_model,
    )

    # Resolve the INDEPENDENT judge model (D-03) via the SHARED resolver (WR-05) — the
    # SAME registry default (claude-opus-4-8 / gpt-5.5) the in-run validator resolves;
    # never the run model (no self-judging; a coerce-tier run model never becomes the
    # publish blocker's weak link).
    #
    # Phase 196 (D-17 / BUG-260731-01): the resolver is handed the DB-backed effective
    # settings (app_settings.harness_judge_model — what the operator actually set in the
    # Settings UI), NOT the env-level ``app.config.settings`` singleton whose attr is None
    # on every UI-configured install. This gauntlet is a HARD WALL, so an inert knob here
    # meant the publish grade was silently taken by a model the operator never chose.
    model = resolve_judge_model(await load_app_settings_async())
    if model is None:
        return {"failure": "no judge model resolved (Settings.harness_judge_model unset)"}

    cap = get_model_capability(model) or {}
    provider = cap.get("provider")
    if provider is None:
        return {"failure": f"no provider for judge model {model!r}"}

    # Build the graded text from the golden run's final output (the deliverable). FINDING-06:
    # _judge_graded_text appends the cited field_map for a document/template-fill deliverable
    # (whose `text` is only a confirmation) so the judge grades the actual content + citations.
    graded = _judge_graded_text(final_output)

    # The rubric core (fixed) + the business_requirement woven as DATA (T-102-03-02).
    # The author's per-workflow criteria ride the llm_judge_rubric ValidatorSpec.config
    # if the definition declares one; else the standard core alone.
    author_criteria = _author_judge_criteria(definition) or "(none)"
    system_prompt = JUDGE_RUBRIC_CORE.format(
        business_requirement=(definition.business_requirement or "(not declared)"),
        author_criteria=author_criteria,
    )
    judge_tool = [
        {
            "type": "function",
            "function": {
                "name": "judge_verdict",
                "description": "Emit the structured quality verdict for the graded output.",
                "parameters": JudgeVerdict.model_json_schema(),
            },
        }
    ]

    from app.services.forced_emit import forced_emit  # function-local

    # FINDING-03 (102-UAT): publish is a single deliberate event — a TRANSIENT no-verdict
    # (model_failed_to_emit / a provider hiccup) must not block a GOOD publish. Bounded
    # retry on a NON-verdict only (mirrors the in-run D-02 gate retry ≤3). A real verdict
    # (valid emission) stops the loop on the first success, so a genuine overall_passed=False
    # is honored — this never re-judges or softens a real verdict.
    result: dict | None = None
    last_failure = "the judge produced no verdict"
    for _attempt in range(3):
        try:
            result = await forced_emit(
                messages=[{"role": "user", "content": graded}],
                model=model,
                provider=provider,
                emitter="judge_verdict",
                tools=judge_tool,
                user_settings=owner_settings,  # IN-04: owner-bound, not None
                system_prompt=system_prompt,
                schema_model=JudgeVerdict,  # CR-01: validate the forced shot as a verdict
            )
        except Exception as e:  # noqa: BLE001 — a judge-shot crash is an honest failure, never a pass
            logger.warning("publish: judge forced_emit raised (attempt %d/3): %s", _attempt + 1, e)
            last_failure = f"judge shot raised: {e}"
            continue
        if not result.get("failure") and result.get("emitted") is not None:
            break  # a valid verdict — accept it (pass OR fail), do not retry
        last_failure = result.get("failure") or last_failure

    if result is None or result.get("failure") or result.get("emitted") is None:
        return {"failure": last_failure}

    emitted = result["emitted"]
    raw = emitted.model_dump() if hasattr(emitted, "model_dump") else emitted
    # CR-01: forced_emit validated the forced shot against JudgeVerdict (schema_model),
    # so ``emitted`` is already a JudgeVerdict — this re-validation is the real (no
    # longer dead) verdict parse. forced_emit stays verdict-AGNOSTIC; the caller owns
    # the verdict parse.
    try:
        return JudgeVerdict.model_validate(raw).model_dump()
    except Exception as e:  # noqa: BLE001
        return {"failure": f"the judge emission was not a valid verdict: {e}"}


def _author_judge_criteria(definition) -> str | None:
    """The author's extra judge criteria from a declared llm_judge_rubric validator.

    Scans the definition's phases for a ``llm_judge_rubric`` ValidatorSpec and returns
    its ``config.criteria`` (D-04 — the rubric is stored explicitly in the definition,
    frozen on publish). None when no rubric validator is declared (the standard core
    alone judges — the free-form archetype, D-09).
    """
    try:
        for phase in definition.phases:
            for v in getattr(phase, "validators", []) or []:
                if getattr(v, "kind", None) == "llm_judge_rubric":
                    cfg = getattr(v, "config", None) or {}
                    crit = cfg.get("criteria") if isinstance(cfg, dict) else None
                    if crit:
                        return str(crit)
    except Exception:  # noqa: BLE001 — a malformed rubric never blocks the standard core
        return None
    return None

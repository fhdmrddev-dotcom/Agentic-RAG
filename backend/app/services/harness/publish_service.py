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

# ── Phase 308.1-01 (D-02) — the golden drive and the post-run tail live in ``publish_tail`` ──
# Re-exported so ``patch.object(publish_service, …)`` and ``from publish_service import …`` keep
# working; the moved code calls back through ``_ps.`` late-bound, so a patch on THIS module still
# intercepts the call the moved code makes. ``publish_tail`` imports nothing from the app at its
# module top, so this import adds no cycle and no module-scope registry importer.
from app.services.harness.publish_tail import (  # noqa: E402,F401 — re-export (see above)
    _REASON_PREFIX,
    _author_judge_criteria,
    _blocked_step,
    _blocked_step_for_run,
    _deliverable_output,
    _drive_golden_run,
    _golden_run_argument_failures,
    _judge_golden_output,
    _judge_named_failures,
    _structural_failures,
    _typed_scalar,
    run_tail_stages,
)


async def _pre_run(
    *,
    definition_id: UUID,
    golden_input: str,
    user: dict,
    pool,
    supabase=None,
) -> dict:
    """Stages 0, 1, 2, 2.5 and 2.6: every check that needs no run (Phase 308.1-02, D-07).

    Cut out of :func:`publish_workflow` statement for statement, so the inline publish and the
    background :func:`start_publish` run ONE copy of the cheap gates and every pre-run answer
    stays byte-identical (``test_308_1_prerun_byte_identical.py``). Returns
    ``{"block": <verdict>}`` (the verdict each stage returned before the cut, receipt and all)
    or ``{"ready": {user_id, row, stage0_token, definition, tool_schemas}}``. ``golden_input`` is
    not read by any of these stages; it is accepted so both callers hand over one argument set.
    """
    # Function-local heavy imports (Pitfall 4 — no engine/render import at module top).
    # IN-01: create_workflow_run / load_run_phases / write_audit are used only by the
    # helpers (which re-import them locally) — publish_workflow itself needs only these.
    from app.db.workflows import get_definition
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
        return {"block": {
            "published": False,
            "blocked_stage": "not_found",
            "named_failures": ["no authenticated user"],
            "golden_run_id": None,
        }}
    user_id = UUID(user_id_raw) if isinstance(user_id_raw, str) else user_id_raw

    # ── stage 0: load + owner-check (V4 — a non-owner gets not_found -> 404) ──────
    row = await get_definition(pool, definition_id, user_id=user_id)
    if row is None:
        # not-found AND cross-user collapse to the SAME structured block (no existence
        # leak — T-102-05-06); the route 404s uniformly. NOT a publish_attempted (no
        # row was even owned to attempt against).
        return {"block": {
            "published": False,
            "blocked_stage": "not_found",
            "named_failures": ["workflow not found"],
            "golden_run_id": None,
        }}

    # Phase 186 (D-186-10) — the draft AS IT WAS WHEN WE STARTED CHECKING IT. Captured
    # here, spent at stage 5, minutes of golden run later. ``row.get`` and NEVER a
    # SUBSCRIPT: at least five shipped test files patch ``get_definition`` with
    # hand-built dicts that carry no ``token`` key, and a subscript would turn every one
    # of them into a KeyError. A missing token degrades to ``None``, which
    # ``publish_definition`` defines as today's unguarded flip — the same graceful shape
    # as the route's optional ``If-Match``.
    stage0_token = row.get("token")

    if row.get("status") != "draft":
        return {"block": await _block(
            pool,
            run_id=None,
            user_id=user_id,
            definition_id=definition_id,
            stage="already_published",
            named_failures=["only a draft can be published"],
            golden_run_id=None,
        )}

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
        return {"block": await _block(
            pool,
            run_id=None,
            user_id=user_id,
            definition_id=definition_id,
            stage="definition_invalid",
            named_failures=[f"definition failed validation: {e}"],
            golden_run_id=None,
        )}

    # ── stage 1: business_requirement present? (D-13 publish-time invariant) ─────
    # The predicate is the SHARED grounding.business_requirement_missing (Phase 182) —
    # behavior identical, now one source with the canvas /validate seam.
    if business_requirement_missing(definition):
        return {"block": await _block(
            pool,
            run_id=None,
            user_id=user_id,
            definition_id=definition_id,
            stage="business_requirement",
            # ONE source with the /validate seam — see the constant's docblock.
            named_failures=[BUSINESS_REQUIREMENT_MISSING_MESSAGE],
            golden_run_id=None,
        )}

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
        return {"block": await _block(
            pool,
            run_id=None,
            user_id=user_id,
            definition_id=definition_id,
            stage="lint",
            named_failures=[_lint_named_failure(e) for e in lint_errors],
            golden_run_id=None,
        )}

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
        return {"block": await _block(
            pool,
            run_id=None,
            user_id=user_id,
            definition_id=definition_id,
            stage="interactive_phase",
            named_failures=interactive_failures,
            golden_run_id=None,
        )}

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
        return {"block": await _block(
            pool,
            run_id=None,
            user_id=user_id,
            definition_id=definition_id,
            stage="grounding_fidelity",
            named_failures=grounding_failures,
            golden_run_id=None,
        )}

    return {
        "ready": {
            "user_id": user_id,
            "row": row,
            "stage0_token": stage0_token,
            "definition": definition,
            "tool_schemas": tool_schemas,
        }
    }


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
    # ── stages 0-2.6: the cheap pre-run gates, in ``_pre_run`` (Phase 308.1-02, D-07) ──────
    pre = await _pre_run(
        definition_id=definition_id,
        golden_input=golden_input,
        user=user,
        pool=pool,
        supabase=supabase,
    )
    if "block" in pre:
        return pre["block"]
    ready = pre["ready"]
    user_id = ready["user_id"]
    definition = ready["definition"]
    tool_schemas = ready["tool_schemas"]
    stage0_token = ready["stage0_token"]

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
            # BUG-260828-09: a crash mid-run usually leaves a ``failed`` phase row behind,
            # and that row knows what the exception class name cannot say. When there is no
            # such row this is ``None`` and the surface is byte-for-byte what shipped — the
            # Python exception string is still the only thing we honestly have.
            blocked_step=await _blocked_step_for_run(pool, golden_run_id, definition),
        )

    # ── stages after the run: moved to ``publish_tail.run_tail_stages`` (Phase 308.1-01, D-02) ──
    return await run_tail_stages(
        definition_id=definition_id,
        definition=definition,
        golden_input=golden_input,
        user_id=user_id,
        pool=pool,
        golden_run_id=golden_run_id,
        final_output=final_output,
        terminal_status=terminal_status,
        tool_schemas=tool_schemas,
        stage0_token=stage0_token,
    )


# Back-compat alias — the Wave-0 test stubs assert ``hasattr(publish_service, "publish_workflow")``;
# the route + the rest of the service call ``publish`` (the canonical name).
publish = publish_workflow


async def start_publish(
    *,
    definition_id: UUID,
    golden_input: str,
    user: dict,
    pool,
    redis,
) -> dict:
    """The publish the route calls (Phase 308.1-02, D-07 / D-08): the golden run in the BACKGROUND.

    Stages 0-2.6 run here, in the request, exactly as :func:`publish_workflow` runs them, and a
    block is returned as-is (byte-identical, no run created). When they pass, the golden run is
    created, its attempt recorded on the run row, and its drive started as a background task;
    the answer is the running handle ``{published: False, blocked_stage: None,
    named_failures: [], golden_run_id, state: "running"}`` (or ``"finishing"``, when this
    user's draft already has an attempt in flight, D-10). The verdict lands on the run row when
    the run ends (``publish_attempt``). Never raises into the route.

    :func:`publish_workflow` stays the inline reference composition: every existing publish
    suite keeps proving the functions the background task runs.
    """
    pre = await _pre_run(
        definition_id=definition_id,
        golden_input=golden_input,
        user=user,
        pool=pool,
        supabase=None,
    )
    if "block" in pre:
        return pre["block"]  # D-07: byte-identical, and no golden run exists
    ready = pre["ready"]

    # Function-local: ``publish_attempt`` imports this module back (late-bound ``_ps.`` calls).
    from app.services.harness import publish_attempt  # noqa: PLC0415

    return await publish_attempt.begin_background_attempt(
        definition_id=definition_id,
        definition=ready["definition"],
        golden_input=golden_input,
        user_id=ready["user_id"],
        stage0_token=ready["stage0_token"],
        pool=pool,
        redis=redis,
    )


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
    blocked_step: dict | None = None,
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
            # BUG-260828-09: the receipt carries the answer too. A governance trail that
            # records only the fallback sentence is a trail that cannot explain a refusal
            # after the fact — which is how four identical blocks looked like four
            # different mysteries.
            "blocked_step": blocked_step,
        },
    )
    return {
        "published": False,
        "blocked_stage": stage,
        "named_failures": named_failures,
        "golden_run_id": golden_run_id,
        # ⚠ ADDITIVE AND OPTIONAL. Every stage that cannot name a step passes ``None``, and
        # a ``None`` here renders as the surface that shipped — not as an empty card.
        "blocked_step": blocked_step,
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


def _authored_step_name(definition, *, slug: str | None, index: int | None) -> str | None:
    """The step's name AS THE AUTHOR WROTE IT, or ``None`` — never the slug.

    Matched on the slug first (stable across a re-order) and on ``phase_index`` only as a
    fallback, because a run's phase rows and its definition's phase list are the same
    sequence by construction. ``_clean_label`` bounds it for the same reason every other
    author-authored string on this path is bounded (T-193.2-01): it reaches a one-line slot
    and a persisted audit row, and it is an unbounded ``str | None`` at its declaration.
    """
    try:
        for phase in getattr(definition, "phases", None) or []:
            matched = (slug is not None and getattr(phase, "slug", None) == slug) or (
                slug is None and index is not None and getattr(phase, "phase_index", None) == index
            )
            if matched:
                return _clean_label(getattr(phase, "name", None))
    except Exception:  # noqa: BLE001 — a malformed definition never blocks a refusal's cause
        return None
    return None


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
        # 288-02 (D-08 / A-03): a pause step's wait must be a real, bounded window. 0 or a
        # negative is an instant timeout; above the ceiling the executor silently clamps.
        # Added alongside, never in place of, the ask_user check below.
        cfg = getattr(phase, "config", None)
        if getattr(cfg, "phase_type", None) == "llm_human_input":
            from app.config import settings  # function-local (module convention)

            wait = getattr(cfg, "timeout_seconds", None)
            ceiling = settings.ask_user_max_timeout_seconds
            if isinstance(wait, bool) or not isinstance(wait, int) or wait <= 0 or wait > ceiling:
                # 296-03 (288-WR-02): whole minutes only when the ceiling IS whole minutes; a
                # 90-second ceiling read "1 minute", which the author then could not satisfy.
                span = (
                    f"{ceiling // 60} minute{'' if ceiling // 60 == 1 else 's'}"
                    if ceiling >= 60 and ceiling % 60 == 0
                    else f"{ceiling} seconds"
                )
                who = f'the pause step "{label}"' if label else "one pause step"
                failures.append(
                    {
                        "phase": slug,
                        "message": (
                            f"Publishing needs a clear time limit, and {who} waits outside "
                            f"the allowed range. Set how long it waits to between 1 second "
                            f"and {span} to publish."
                        ),
                    }
                )
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


#: 296-03 (291-S6-F7 / D-08): the typed stand-ins a golden run answers a declared input with.
GOLDEN_DATE_STAND_IN = "2026-01-15"
GOLDEN_NUMBER_STAND_IN = "1"
GOLDEN_TEXT_STAND_IN = "a short example answer"


def golden_run_inputs(definition, golden_input: str) -> tuple[dict[str, str], list[str]]:
    """The golden run's inputs, and the labels of the fields it answered with a stand-in.

    ⚠ KEY-AWARE, because a placeholder is READ BY A MODEL and shown in a receipt. The first cut
    used an address shape for EVERY field, so an essay workflow was handed
    `topic = golden-run-placeholder-topic@example.invalid` and dutifully wrote 200 words about an
    email address. Operator caught it on the first published run. An address-shaped value goes
    only where an address belongs, and keeps the RFC 2606 `.invalid` TLD (see the caller).

    296-03 (D-08 amended): 291 added `date`, `number` and `enum` to `InputFieldSpec.type`, so the
    TYPE now picks the stand-in — the first non-blank option, a fixed ISO date, `1`, or a short
    plain answer. `InputFieldSpec` has no example field, so every one of these is a stand-in and
    is NAMED (the second value) so publishing can say it used one; address keys are not listed.

    302-02 (BE-IN-03 / D-07): an input the practice run never asks for — source ``kb_auto`` /
    ``template_derived``, or type ``file`` / ``kb_auto`` — gets no stand-in and is not named.
    """
    inputs: dict[str, str] = {"kickoff_prompt": golden_input}
    stood_in: list[str] = []
    for spec in getattr(definition, "inputs", None) or []:
        key = getattr(spec, "key", None)
        # Never shadow the kickoff prompt: it carries the author's real golden input.
        if not key or key in inputs:
            continue
        if getattr(spec, "source", "user") != "user" or getattr(spec, "type", "text") in ("file", "kb_auto"):
            continue
        k = key.lower()
        if any(t in k for t in ("email", "mail", "recipient", "sender", "cc", "bcc")) or k in {"to", "from"}:
            inputs[key] = f"golden-run-placeholder-{key}@example.invalid"
            continue
        ftype = getattr(spec, "type", "text")
        options = [o for o in (getattr(spec, "enum_options", None) or []) if str(o).strip()]
        if ftype == "enum" and options:
            inputs[key] = str(options[0])
        elif ftype == "date":
            inputs[key] = GOLDEN_DATE_STAND_IN
        elif ftype == "number":
            inputs[key] = GOLDEN_NUMBER_STAND_IN
        else:
            inputs[key] = GOLDEN_TEXT_STAND_IN
        stood_in.append(_clean_label(getattr(spec, "label", None)) or key)
    return inputs, stood_in


def stand_in_note(labels: list[str]) -> str | None:
    """291-S6-F7: the one sentence a publish adds when its practice run used stand-in answers."""
    if not labels:
        return None
    fields = labels[0] if len(labels) == 1 else ", ".join(labels[:-1]) + " and " + labels[-1]
    pronoun = "it" if len(labels) == 1 else "them"
    return (
        f"The practice run had no example for {fields}, so it used a stand-in answer for {pronoun}."
    )

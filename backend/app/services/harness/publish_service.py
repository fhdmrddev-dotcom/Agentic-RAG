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
    from app.services.harness.grounding import business_requirement_missing
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
            named_failures=[
                "a workflow must declare exactly one business_requirement before publish"
            ],
            golden_run_id=None,
        )

    # ── stage 2: structural lint (pure; short-circuits BEFORE the golden run) ─────
    lint_errors = lint_workflow(definition)
    if lint_errors:
        return await _block(
            pool,
            run_id=None,
            user_id=user_id,
            definition_id=definition_id,
            stage="lint",
            named_failures=[
                {"code": e.code, "phase": e.phase_slug, "message": e.message}
                for e in lint_errors
            ],
            golden_run_id=None,
        )

    # ── stage 2.5: interactive-phase pre-run block (WR-04 — lint-class) ──────────
    # A synchronous publish cannot validate interactive phases: an llm_human_input
    # phase (or a validator whose on_failure routes to ask_user) BLOCKS on an
    # unsubscribed ask_user prompt for which no human is watching, dead-ending the
    # publish golden run. Block such definitions PRE-RUN with a named failure (cheap —
    # no provider call) so the golden run is never driven for them. The full
    # background-job publish that COULD validate interactive phases is the deferred
    # Phase-103 rework — this is the honest minimum-viable cut.
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
        return await _block(
            pool,
            run_id=None,
            user_id=user_id,
            definition_id=definition_id,
            stage="golden_run_error",
            named_failures=[f"golden run could not complete: {e}"],
            golden_run_id=None,
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


def _structural_failures(final_output) -> list:
    """Name the structural-gate failure(s) on a failed golden run's final output."""
    if not isinstance(final_output, dict):
        return []
    reason = final_output.get("_failure_reason")
    if reason:
        return [str(reason)]
    return []


def _interactive_phase_failures(definition) -> list:
    """Named failures for any INTERACTIVE phase blocking the synchronous publish (WR-04).

    Returns one ``{"phase": <slug>, "message": ...}`` entry per phase that would
    dead-end the synchronous publish golden run by blocking on a human:

      - an ``llm_human_input`` phase (``config.phase_type == "llm_human_input"``), or
      - any validator whose ``on_failure == "ask_user"`` (the D-11 interactive
        disposition — it pauses the run waiting for a human to choose).

    Empty list == no interactive phases (the publish proceeds to the golden run). This
    is a PRE-RUN lint-class check (no provider call) — it short-circuits BEFORE any
    golden run so an unsubscribed ``ask_user`` prompt can never wedge the publish.

    The full background-job publish that COULD validate interactive phases (a human
    subscriber, a durable resume) is the DEFERRED Phase-103 rework — out of scope here.
    """
    failures: list = []
    for phase in getattr(definition, "phases", []) or []:
        slug = getattr(phase, "slug", None)
        config = getattr(phase, "config", None)
        if getattr(config, "phase_type", None) == "llm_human_input":
            failures.append(
                {
                    "phase": slug,
                    "message": "interactive phases (llm_human_input / ask_user "
                    "dispositions) cannot be validated in a synchronous publish",
                }
            )
            continue  # one finding per phase is enough
        for v in getattr(phase, "validators", []) or []:
            if getattr(v, "on_failure", None) == "ask_user":
                failures.append(
                    {
                        "phase": slug,
                        "message": "interactive phases (llm_human_input / ask_user "
                        "dispositions) cannot be validated in a synchronous publish",
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

    _org_id = await pool.fetchval(
        "SELECT org_id FROM workflow_definitions WHERE id = $1", definition_id
    )
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

    # ── 3. create the golden run (is_golden_run=True — the REAL run on the KB) ────
    run_id = await create_workflow_run(
        pool,
        thread_id=UUID(thread_id) if isinstance(thread_id, str) else thread_id,
        definition_id=definition_id,
        definition=definition,
        inputs={"kickoff_prompt": golden_input},
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
    ctx = SimpleNamespace(
        run_id=run_id,
        producer_run_id=_producer_id,  # real `runs` shell (sub-agent FK), NOT the workflow_run id
        thread_id=str(thread_id),
        current_user={"id": str(user_id)},
        user_settings=owner_settings,
        model=ctx_model,
        inputs={"kickoff_prompt": golden_input},
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
    from app.config import get_model_capability, settings
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
    model = resolve_judge_model(settings)
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

"""Phase 308.1-01 (BUG-261107-01, D-01 / D-02) — the golden-run drive and every post-run publish stage.

WHAT MOVED, AND FROM WHERE. Out of ``harness/publish_service.py`` as it stood at ``4476fcb73``
(byte-identical at ``13b344843``), as a PURE MOVE — no statement changed meaning:

  * ``_drive_golden_run`` (``:1605-1856``) — the golden run, its ephemeral validation thread, its
    producer shell, and the ONE golden ctx build in the tree;
  * the post-run tail of ``publish_workflow`` (``:347-589``) — the ``publish_attempted`` receipt,
    the structural gate, the D-214-11 resolved-argument check, the judge (stage 4) with its spend
    persist and ``judge_verdict`` receipt, the flip (stage 5) with its ``-1`` / ``-2`` arms, the
    ``publish_succeeded`` receipt, the 288-02 auto-answered note and the 296-03 stand-in note —
    now the body of ``run_tail_stages``, whose parameters are exactly the locals it read;
  * the helpers only those two use: ``_typed_scalar`` (``:814``), ``_golden_run_argument_failures``
    (``:835``), ``_REASON_PREFIX`` (``:975``), ``_deliverable_output`` (``:978``), ``_blocked_step``
    (``:1022``), ``_blocked_step_for_run`` (``:1092``), ``_structural_failures`` (``:1141``),
    ``_judge_named_failures`` (``:1521``), ``_judge_golden_output`` (``:1859``) and
    ``_author_judge_criteria`` (``:2048``).

``publish_service.publish_workflow`` keeps stages 0-2.6 and stage 3's ``asyncio.wait_for`` with its
two ``except`` arms inline, and ends in ``return await run_tail_stages(...)``.

WHY. ``publish_service.py`` FIRES G-5 (37 commits / 17 phases / 2066 lines) and its ledger rule is
*"a second concern in a plan = extract first"*. Running the golden run in the background (308.1-02)
is that second concern, so this move lands first and alone: the next plan's diff is only behaviour.

⛔ THE LATE-BINDING RULE (Pitfall 1). Every name this module calls that a test patches on
``publish_service`` (``_judge_golden_output``, ``_resolve_publish_supabase``,
``_author_judge_criteria``), and every name it calls that STAYED in ``publish_service``
(``_block``, ``_safe_audit``, ``_clean_label``, ``_external_action_phases``,
``_authored_step_name``, ``golden_run_inputs``, ``stand_in_note``), is called here as ``_ps.<name>`` after ``from app.services.harness import publish_service as _ps``
INSIDE the calling function. Never at module top: ``publish_service`` imports this module at its
top to re-export the moved names, so a module-top import back is a cycle. Calls between functions
that both moved, and that no test patches, stay direct. The moved function-local imports
(``app.db.workflows.*``, ``app.db.runs.*``, ``app.services.harness_engine``,
``app.models.user_settings``, ``app.config``) stay function-local, because tests patch them at
their source modules.

⛔ THE PHASE 190 FENCE MOVED WITH THE CODE. ``_drive_golden_run`` builds the ONE ctx in the tree
that is a golden run: ``is_golden_run=True`` and NO ``org_id``. Its comment block moved verbatim;
``tests/unit/test_190_ctx_org_scoping.py`` now reads this file.

LOGGER NAME. ``logger`` below is ``logging.getLogger("app.services.harness.publish_service")`` —
the SAME logger object the moved code logged through before, so every record keeps its name and a
patch on ``publish_service.logger`` still sees the moved warnings.

⚠ PITFALL 13 — TWO SENTENCES ELSEWHERE BECOME FALSE IN THIS PHASE, CORRECTED HERE. ``config.py``'s
comment saying the background-job publish *"stays deferred"*, and ``find_resumable_runs``'
docstring calling an abandoned golden run *"correct"*, are superseded by Phase 308.1: the golden
run moves into the background (308.1-02) and a stranded one is re-driven by a separate golden sweep
(308.1-03). Those files are NOT edited (D-05 / D-12 — both hot, and ``find_resumable_runs`` keeps
its golden exclusion); the correction lives here and in ``docs/HOT-FILE-LEDGER.md``.
"""

from __future__ import annotations

import logging
from uuid import UUID

logger = logging.getLogger("app.services.harness.publish_service")


async def run_tail_stages(
    *,
    definition_id: UUID,
    definition,
    golden_input: str,
    user_id: UUID,
    pool,
    golden_run_id,
    final_output,
    terminal_status: str,
    tool_schemas,
    stage0_token,
) -> dict:
    """Every publish stage AFTER the golden run returned: the structural gate, the D-214-11
    resolved-argument check, the judge (stage 4), the flip (stage 5) and the success notes.

    Moved verbatim from ``publish_service.publish_workflow`` (Phase 308.1-01, D-02); the
    parameters are exactly the locals that body read from ``publish_workflow``'s scope.
    Returns the structured verdict and, like the orchestration it was cut from, never raises.
    """
    from app.db.workflows import publish_definition  # noqa: PLC0415 — was publish_workflow's import
    from app.services.harness import publish_service as _ps  # noqa: PLC0415

    # The attempt now has a real run_id (the documented receipt-keying choice).
    await _ps._safe_audit(
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
        # ── BUG-260828-09 — WHICH STEP, AND WHY, INSTEAD OF THE SHAPE OF THE PIPELINE ──
        # The ``or [...]`` fallback below is what the operator read four times in one sitting.
        # It fired because the deliverable harvest had already thrown the answer away (see
        # ``_deliverable_output``); with that repaired, ``named`` now normally carries the
        # engine's own sentence. ``blocked_step`` is the STRUCTURED half of the same fact —
        # the step identity a surface needs to say it in the AUTHOR'S vocabulary rather than
        # in ``Phase 1 (survey-library)``. Both ride the verdict; neither replaces the other.
        return await _ps._block(
            pool,
            run_id=golden_run_id,
            user_id=user_id,
            definition_id=definition_id,
            stage="structural_gate",
            named_failures=named or ["the golden run failed a structural gate"],
            golden_run_id=golden_run_id,
            blocked_step=await _blocked_step_for_run(pool, golden_run_id, definition),
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
        return await _ps._block(
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
    # Phase 256 round 1 (METER-06 / SC#4, D-256-18 Option A) — the judge shot's spend.
    _judge_usage: dict = {}
    verdict = await _ps._judge_golden_output(
        definition=definition,
        final_output=final_output,
        pool=pool,
        owner_settings=owner_settings,
        usage_box=_judge_usage,
    )
    # ⭐ THE JUDGE'S SPEND BECOMES DURABLE HERE, AND THIS IS THE ONLY PLACE IT CAN.
    # ``_judge_golden_output`` has no ctx and no live ``run_usage_box``: the golden run's
    # box was read and finalized by ``_drive_golden_run``'s own ``finally`` BEFORE this
    # stage runs, so the in-run validator's ``_record_run_usage`` shape is unavailable
    # here. ``pool`` and ``golden_run_id`` are in scope; nothing else is.
    #
    # ⛔ ``golden_run_id``, NEVER ``_producer_id``. ``golden_run_id`` is a
    # ``workflow_runs`` row (created by ``create_workflow_run`` in ``_drive_golden_run``)
    # — the grain ``persist_run_usage`` writes and the grain ``token_coverage`` lives on.
    # ``_producer_id`` is the separate ``runs`` shell, and D-256-03 forbids mixing the
    # two: a workflow figure written onto a ``runs`` row can never afterwards be summed
    # honestly against either grain.
    #
    # ⚠ ABOVE THE ``_safe_audit`` AND ABOVE THE ``_block`` RETURN ~15 LINES DOWN. A
    # BLOCKED publish is precisely the one whose money is most worth recording — nothing
    # else about that run became durable — so a persist placed below the block would
    # lose the judge spend of every publish the gauntlet refused.
    #
    # ⚠ NEW BRANCHES: 1, and it is ``persist_run_usage``'s own falsy-delta guard
    # reached through a local ``if`` rather than a new code path — a judge that reported
    # no usage issues NO statement, because ``NULL`` means never measured and ``0``
    # means measured as zero (D-256-06).
    if _judge_usage:
        from app.db.workflows import persist_run_usage  # function-local (file convention)

        await persist_run_usage(
            pool,
            golden_run_id,
            input_delta=_judge_usage.get("input_tokens"),
            output_delta=_judge_usage.get("output_tokens"),
        )
    # The verdict is recorded REGARDLESS of pass/fail (governance — Phase 107).
    await _ps._safe_audit(
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
        return await _ps._block(
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
        return await _ps._block(
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
        return await _ps._block(
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
    await _ps._safe_audit(
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
    result = {"published": True, "version": version, "golden_run_id": golden_run_id}
    # 288-02 (D-07 / A-04): say, in words, which pauses the golden run answered FOR the
    # author. Derived from the run's PERSISTED phase outputs (``_golden_run_mock``), never
    # a static scan -- a pause skipped by ``skip_to_phase`` has no mock output and so is
    # never claimed answered. Pause-free workflows perform no read and gain no key.
    pause_slugs = {
        getattr(p, "slug", None): _ps._clean_label(getattr(p, "name", None))
        for p in getattr(definition, "phases", []) or []
        if getattr(getattr(p, "config", None), "phase_type", None) == "llm_human_input"
    }
    if pause_slugs:
        from app.db.workflows import load_run_phases  # function-local (file convention)
        from app.models.thread import phase_output_object  # the ONE jsonb-scalar unwrap

        try:
            rows = await load_run_phases(pool, golden_run_id)
        except Exception:  # noqa: BLE001 -- the note is advisory; never sink a publish
            logger.warning("288-02: could not read golden-run phases for the note", exc_info=True)
            rows = []
        answered = []
        for row in sorted(rows or [], key=lambda r: r.get("phase_index", 0)):
            slug = row.get("slug")
            out = phase_output_object(row.get("output"))
            if slug in pause_slugs and isinstance(out, dict) and out.get("_golden_run_mock"):
                label = pause_slugs[slug]
                who = f'The pause step "{label}"' if label else "A pause step"
                answered.append(
                    {
                        "phase": slug,
                        "message": (
                            f"{who} was answered automatically during validation and has "
                            "not been exercised by a person."
                        ),
                    }
                )
        if answered:
            result["auto_answered"] = answered
    # 296-03 (291-S6-F7 / D-08): a practice run that answered declared inputs with stand-ins
    # says so — a publish never passes silently on fake answers. The same helper built the
    # golden run's inputs, so the note names exactly the fields that got a stand-in.
    _note = _ps.stand_in_note(_ps.golden_run_inputs(definition, golden_input)[1])
    if _note:
        result.setdefault("auto_answered", []).append({"phase": None, "message": _note})
    return result


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
    from app.services.harness import publish_service as _ps  # noqa: PLC0415

    phases = _ps._external_action_phases(definition)
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

        step_name = _ps._clean_label(getattr(phase, "name", None)) or getattr(phase, "slug", None)
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


#: BUG-260828-09 — THE ONE PREFIX A FAILURE REASON CARRIES, AND ITS SINGLE PRODUCER.
#:
#: ``harness_engine`` composes every ``fail_run`` reason as ``Phase {n} ({slug}) <verb>: <cause>``
#: — ``_route_on_failure`` (``:1200-1203``) writes the *gate failed after k attempt(s)* verb and
#: ``_resolve_failure_with_ask_user`` (``:1525``) writes the *validation flagged* one. BOTH lead
#: with an index the author never chose and a SLUG they can see nowhere on the canvas, which is
#: exactly what ``BUG-260828-09`` property (1) forbids a refusal from leading with.
#:
#: ⚠ IT IS KEYED ON THE SLUG WE ALREADY HOLD, NOT ON A GUESSED PATTERN. The slug is interpolated
#: (``re.escape``-d) from the failed phase row itself, so this can only ever strip a prefix that
#: names THAT step — never a sentence that merely starts with the word "Phase".
#:
#: ⚠ ``[^:]*`` IS LOAD-BEARING AND MUST NOT BECOME ``.*``. The cause routinely contains its own
#: colon (``citations_required: nothing was retrieved (0 sources) — …``), and a greedy match
#: would eat the validator's name out of the one sentence this whole fix exists to surface.
_REASON_PREFIX = r"^Phase\s+\d+\s+\({slug}\)[^:]*:\s*"


def _deliverable_output(phases: list) -> dict:
    """The run's deliverable — the LAST phase that actually PRODUCED something.

    ── BUG-260828-09, AND IT IS MEASURED RATHER THAN REASONED ABOUT ────────────────────
    The loop this replaces lived inline in ``_drive_golden_run`` and read, in effect,
    *"the last phase whose output is a dict wins"*. A phase that never ran carries ``{}``
    — which IS a dict. Measured on the live database 2026-08-28 across all four of the
    operator's failed publish attempts; every one had the identical shape::

        0 survey-library  failed   {"_failure_reason": "Phase 1 (survey-library) gate failed …"}
        1 write-summary   pending  {}
        2 act             pending  {}

    So the two pending rows overwrote the failed row, ``_structural_failures`` was handed
    ``{}``, it returned ``[]``, and the caller's ``or [...]`` fallback fired — the author
    read *"the golden run failed a structural gate"* four times while the sentence naming
    the step, the check and the cause sat one dict key away. **The information volume was
    never the problem; the one useful sentence was being discarded before it was rendered.**

    THE SELECTION RULE IS OTHERWISE UNCHANGED. On a run whose phases all produced content
    — every ``completed`` golden run, which is every run that reaches the judge — this
    returns what the loop it replaces returned, because no empty dict occurs. Only a run
    that stopped part-way behaves differently, and only in the direction of keeping the
    fact that it stopped.

    ⚠ IT READS THROUGH ``phase_output_object`` AND NOT THROUGH A LOCAL ``json.loads``. The
    inline loop carried its own unwrap; ``workflow_phases.output`` has TWO shapes in it
    (D-200.1-01 — 527 of 588 non-null values are jsonb string scalars) and the read side
    keeps exactly ONE home. A second copy here is a second copy that rots.

    Total: a nullish list, a row with no output, an unparseable string and a list-valued
    output all resolve to ``{}`` rather than raising.
    """
    from app.models.thread import phase_output_object  # function-local (the ONE unwrap)

    deliverable: dict = {}
    for row in sorted(phases or [], key=lambda q: (q or {}).get("phase_index", 0)):
        obj = phase_output_object((row or {}).get("output"))
        # An EMPTY dict is not a deliverable. That single word is the whole defect.
        if obj:
            deliverable = obj
    return deliverable


def _blocked_step(phases: list, definition) -> dict | None:
    """WHICH step of the author's own workflow stopped the golden run, and WHY.

    ── BUG-260828-09 — THE JOIN NOTHING PERFORMED ─────────────────────────────────────
    The engine already writes a good sentence naming the step, the check that refused and
    the consequence. It writes it in three places — ``workflow_phases.output``, a
    ``run_failed`` ``harness_audit`` row, and an assistant message inside the ephemeral
    ``[validation] publish golden run — …`` thread — and the publish verdict joined NONE
    of them, so it was reachable only by querying Postgres. That is how it was found.
    ``verdictModel.ts``'s ``structural_gate`` docblock states the gap from the client side
    and calls it *"a SERVER change"*. This is that change.

    Returns ``{step_slug, step_index, step_name, reason, cause}`` for the failed phase, or
    ``None`` when no phase failed (a judge block, a lint block, a crash before any phase
    ran) — in which case the surface is byte-for-byte what shipped.

    ⚠ ``step_name`` IS ``None`` WHENEVER THE AUTHOR DID NOT NAME THE STEP, AND IT IS NOT
    BACKFILLED WITH THE SLUG. The shipped precedent one function over
    (``_golden_run_argument_failures``) falls back ``name or slug`` and consequently emitted
    ``"step_name": "act"`` — a slug, in the field that promises an authored name. Property
    (1) of the report forbids exactly that, so this returns the honest ``None`` and the
    client resolves the face through ``phaseVocabulary.nodeTitle`` — the four-tier ladder
    whose stated floor is that the slug never appears in its output. Measured on the live
    definition: 2 of its 3 phases carry ``name: null``, so the unnamed arm is the ORDINARY
    case here, not the edge case.

    ⚠ ``cause`` IS THE REASON WITH ITS MACHINE PREFIX REMOVED, AND ``reason`` IS KEPT
    VERBATIM BESIDE IT. Nothing is discarded: the raw sentence still rides the wire for the
    disclosure, exactly as the raw verdict does. If the prefix does not match — a reason
    composed by some future site in another shape — ``cause`` IS ``reason``, so a surface
    leading with it can never render empty.

    Total: a nullish list, a row with no output, a reason that is not a string and a
    definition whose phases do not line up with the run's all resolve without raising.
    """
    import re

    from app.services.harness import publish_service as _ps  # noqa: PLC0415

    failed = None
    for row in sorted(phases or [], key=lambda q: (q or {}).get("phase_index", 0)):
        if (row or {}).get("status") == "failed":
            failed = row
            break
    if failed is None:
        return None

    from app.models.thread import phase_output_object  # function-local (the ONE unwrap)

    obj = phase_output_object(failed.get("output")) or {}
    raw = obj.get("_failure_reason")
    reason = str(raw).strip() if isinstance(raw, str) and raw.strip() else None

    slug = failed.get("slug")
    slug = str(slug) if slug else None
    index = failed.get("phase_index")
    index = int(index) if isinstance(index, int) else None

    cause = reason
    if reason and slug:
        cause = re.sub(_REASON_PREFIX.format(slug=re.escape(slug)), "", reason, count=1).strip()
        cause = cause or reason  # never hand a surface an empty sentence

    return {
        "step_slug": slug,
        "step_index": index,
        "step_name": _ps._authored_step_name(definition, slug=slug, index=index),
        "reason": reason,
        "cause": cause,
    }


async def _blocked_step_for_run(pool, run_id, definition) -> dict | None:
    """``_blocked_step`` over a run's phase rows — the one I/O half, on the FAILURE PATH ONLY.

    ⚠ IT COSTS ONE READ AND ONLY WHEN A PUBLISH IS ALREADY LOST. A successful publish never
    reaches either call site, so nothing on the happy path changes shape or timing. The read
    is the same ``load_run_phases`` the golden run already performs — the same statement, the
    same index — so no new query shape enters this file (D-214-23: the gap here was always
    PROJECTION, never SELECTION).

    Best-effort by construction: a read failure returns ``None`` and the refusal falls back to
    exactly the surface that shipped. A publish decision that has already been made must never
    become a 500 because the *explanation* could not be loaded.
    """
    if run_id is None:
        return None
    try:
        from app.db.workflows import load_run_phases  # function-local

        return _blocked_step(await load_run_phases(pool, run_id), definition)
    except Exception:  # noqa: BLE001 — an unexplainable block is still an honest block
        logger.warning(
            "publish: could not load the failing step for run %s — the refusal still stands",
            run_id,
            exc_info=True,
        )
        return None


def _structural_failures(final_output) -> list:
    """Name the structural-gate failure(s) on a failed golden run's final output."""
    if not isinstance(final_output, dict):
        return []
    reason = final_output.get("_failure_reason")
    if reason:
        return [str(reason)]
    return []


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
    from app.services.harness import publish_service as _ps  # noqa: PLC0415

    # The org-scoped service-role client — resolved through the ONE shared helper (Phase 182
    # plan 06 moved the Phase-163 / T-163-05b explanation onto ``_resolve_publish_supabase``
    # so the "no org-less fallback on the publish path" rule lives in a single place, shared
    # with the stage-2.6 grounding read). The ephemeral validation thread INSERT below still
    # relies on the mig-106 autofill for its own org_id.
    # The org is NOT used to scope anything here: the golden run is scoped by the CLIENT alone —
    # every read it performs rides that already-org-scoped client, and the ephemeral validation
    # thread INSERT relies on the mig-106 autofill. Only stage 2.6's grounding gate needs the org
    # as a VALUE (WR-05). 268-REVIEW WR-06: it is also the producer shell's ATTRIBUTION (below),
    # so the golden run's spend is in the definition's org, not the trigger's LIMIT-1 guess. The
    # validation ctx still withholds it (the Phase 190 fence at step 4 is unchanged).
    supabase, _golden_run_org_id = await _ps._resolve_publish_supabase(
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
    golden_inputs, _stood_in = _ps.golden_run_inputs(definition, golden_input)
    # 296-06 (291-S6-F8): the first step reads the kickoff, so the stand-in answers ride it as
    # `key: value` lines, exactly as an in-app start does (one composer, `launch_kickoff`).
    from app.services.inbound_inputs import launch_kickoff  # noqa: PLC0415
    golden_inputs["kickoff_prompt"] = launch_kickoff(golden_input, definition, golden_inputs)

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
        org_id=str(_golden_run_org_id) if _golden_run_org_id else None,
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
        # ── BUG-260828-09 — THE HARVEST IS AN EXTRACTED, TESTABLE HELPER NOW ─────────
        # The loop that used to sit inline here accepted a `pending` phase's `{}` as "an
        # output" and let it OVERWRITE the failed phase's `_failure_reason`. See
        # `_deliverable_output` for the measurement; the selection rule is unchanged for
        # every run whose phases all produced something.
        final_output: dict = _deliverable_output(phases)
        _shell_status = "completed"
        return run_id, final_output, terminal_status
    except Exception as e:
        setattr(e, "golden_run_id", run_id)
        raise
    finally:
        try:
            # METER-05 site 4 (Phase 256 / D-256-08). ⭐ A GOLDEN RUN IS REAL MONEY — it
            # drives the whole workflow against the live KB — and its segment read as
            # "never measured" because this shell hardcoded a NULL usage. The box was on
            # `ctx` the entire time (`run_workflow` sets it, harness_engine.py:1864).
            # ⚠ GRAIN (D-256-03): segment box onto a per-segment `runs` row; the
            # cumulative `workflow_runs` figure belongs to `persist_run_usage`.
            # ⛔ No default and no `or 0` — NULL means never measured, 0 means measured
            # as zero, and a publish validation that cost nothing is a real possibility
            # worth being able to tell apart (D-256-06).
            _box = getattr(ctx, "run_usage_box", None) or {}
            _in_tok = _box.get("input_tokens")
            _out_tok = _box.get("output_tokens")
            if _in_tok is None and _out_tok is None:
                # db/runs.py:93-99's contract. IDENTIFIERS ONLY (T-073-04 / T-256-14).
                logger.warning(
                    "runs.usage missing for run=%s provider=%s model=%s",
                    _producer_id,
                    getattr(ctx, "provider", None),
                    getattr(ctx, "model", None),
                )
            await finalize_run(
                pool,
                run_id=_producer_id,
                status=_shell_status,
                error=None,
                completed_at=datetime.now(timezone.utc),
                message_id=None,
                input_tokens=_in_tok,
                output_tokens=_out_tok,
            )
        except Exception:  # noqa: BLE001 — shell cleanup never masks the run's own outcome
            logger.warning(
                "publish: producer-shell finalize failed for %s", _producer_id, exc_info=True
            )
        # Phase 295 (D-20): the golden run's OWN row. ``find_resumable_runs`` excludes golden
        # runs, so a golden run that raised or hit the publish budget used to stay ``active``
        # forever. The helper ends it ``failed`` with words only if nothing else already ended
        # it, and never raises (shell cleanup never masks the run's own outcome).
        from app.services.harness.run_handoff import finish_golden_run  # noqa: PLC0415

        await finish_golden_run(pool, run_id, user_id=user_id)


async def _judge_golden_output(
    *, definition, final_output: dict, pool, owner_settings=None, usage_box: dict | None = None
) -> dict:
    """Run the forced judge shot over the golden run's final output (the QUAL-01 gate).

    Reuses the Plan-03 ``llm_judge_rubric`` machinery: it runs the forced judge shot
    itself (the verdict rides ``forced_emit`` — truncation-safe, honest fail, the
    independent judge model per D-03) and returns the verdict dict. A ``failure``/None
    result is an honest fail — a coerce/weak judge can NEVER silently produce a pass.

    ``owner_settings`` (IN-04) is the run owner's effective settings forwarded into the
    judge shot's ``forced_emit`` (the gateway key/config resolution) — consistent with
    the in-run validator's ``ctx.user_settings`` forwarding; ``None`` degrades gracefully.

    ``usage_box`` (Phase 256 round 1 / METER-06 / SC#4, D-256-18 Option A) is the
    CALLER-SUPPLIED accumulator this judge shot's spend is folded into — the house
    pattern (``task_service._stream_one_iteration``, ``eval_runner_service``'s
    ``usage_acc``). ⭐ IT IS A PARAMETER RATHER THAN A ``ctx`` RECORDING, AND THAT IS A
    MEASUREMENT RATHER THAN A PREFERENCE: this function has **no ctx and no live usage
    box**, because ``_drive_golden_run``'s own ``finally`` already read
    ``ctx.run_usage_box`` and finalized the producer shell BEFORE the QUAL-01 stage runs
    the judge. The box is closed; there is nothing here to record into. So the CALLER —
    which holds ``pool`` and ``golden_run_id`` — owns the durable write, and it is the
    only place that can. ``None`` keeps every pre-existing caller byte-identical.

    ⛔ THE RETURNED VERDICT DICT GAINS NO TOKEN KEYS. ``JudgeVerdict`` is
    ``extra="forbid"``, so ``model_validate`` would reject them; the verdict's shape is
    not this concern's carrier.

    Returns the JudgeVerdict dict, or ``{"failure": <reason>}`` on an honest failure.
    """
    from app.config import get_model_capability
    from app.models.user_settings import load_app_settings_async  # function-local (Pitfall 4)
    from app.services.harness.validator_kinds import (  # function-local
        JudgeVerdict,
        _judge_graded_text,
        judge_system_prompt,
        resolve_judge_model,
    )
    from app.services.harness import publish_service as _ps  # noqa: PLC0415

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
    author_criteria = _ps._author_judge_criteria(definition) or "(none)"
    # 295-REVIEW WR-05: the rubric, plus the design note (system-side) for a recorded action.
    system_prompt = judge_system_prompt(
        final_output,
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
    # Phase 256 round 1 (METER-06 / SC#4) — the ladder-accumulator shape from
    # ``forced_emit.py`` (S-4), and both halves of it are load-bearing:
    #
    #   · DECLARED ABOVE THE LOOP, so a FAILED attempt still counts. Up to THREE billed
    #     shots happen in the retry below and EVERY SERVED SHOT WAS PAID FOR
    #     (D-256-12). Declared inside, they would reset each attempt and only the
    #     winning shot would ever be counted — a number that looks like a total and is
    #     a third of one.
    #   · INITIALISED TO ``None``, NEVER ``0``. A judge that reported no usage at all
    #     must stay "never measured"; a ``0`` would read as "measured as zero" and make
    #     a billed-but-unreported shot look free (D-256-06).
    _judge_in: int | None = None
    _judge_out: int | None = None
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
            # ⚠ NOTHING TO ACCUMULATE HERE, AND THAT IS A NAMED RESIDUAL RATHER THAN AN
            # OVERSIGHT (IN-03). ``forced_emit`` raised, so it returned no dict — the
            # tokens the provider may already have billed are unreachable from this
            # scope. ⛔ Do NOT manufacture a number for it. Registered in ``SEED-300``
            # with a concrete trigger: any phase that gives ``forced_emit`` a raise-path
            # usage channel, or any per-rung cost breakdown.
            continue
        # ⚠ ACCUMULATED IMMEDIATELY AFTER THE CALL AND **ABOVE** THE VERDICT CHECKS
        # BELOW. A shot that produced no verdict was still served and billed; recording
        # after the ``break`` would count the winning attempt only.
        #
        # ⛔ NOTE THE SPELLING: ``x if acc is None else acc + x``, never a truthiness
        # fallback or a dict-get default on a token key.
        # ``test_256_producer_shells.py::test_no_token_read_uses_a_default_or_an_or_zero``
        # forbids both of those spellings in this file, and it is RIGHT to: ``NULL`` means
        # never measured and ``0`` means measured as zero (D-256-06). The explicit
        # ``is None`` test keeps the two distinct while still summing every served shot.
        #
        # ⚠ MEASURED, NOT ANTICIPATED, TWICE OVER. The first draft of this block used the
        # truthiness fallback and that shipped fence caught it; the SECOND draft cleared
        # the code and still failed, because a COMMENT here quoted the forbidden spelling
        # verbatim and the fence is pure text with NO comment stripping. ⛔ So the rule
        # for this file is stronger than "do not write it" — it is "do not SPELL it",
        # prose included. (Its sibling grain fence three tests down does
        # ``line.split("#", 1)[0]``; this one does not, and that asymmetry is real.)
        _shot_in = result.get("input_tokens")
        if _shot_in:
            _judge_in = int(_shot_in) if _judge_in is None else _judge_in + int(_shot_in)
        _shot_out = result.get("output_tokens")
        if _shot_out:
            _judge_out = int(_shot_out) if _judge_out is None else _judge_out + int(_shot_out)
        if not result.get("failure") and result.get("emitted") is not None:
            break  # a valid verdict — accept it (pass OR fail), do not retry
        last_failure = result.get("failure") or last_failure

    # ⭐ THE FOLD SITS HERE, ONCE, ABOVE ALL THREE REMAINING RETURN PATHS — the
    # all-attempts-failed ``{"failure": last_failure}`` below, the successful verdict,
    # and the not-a-valid-verdict catch. The placement is the same discipline as
    # ``harness_engine``'s ``_flush_run_usage`` call: every arm below flows THROUGH
    # here, so the hand-off needs no branch of its own and a fourth return added later
    # is covered by construction. (The two earlier returns — no judge model, no provider
    # — are ABOVE the loop, where nothing was served and there is nothing to hand over.)
    # ⛔ Same spelling discipline as the accumulators above: a PRIOR value of ``None`` is
    # replaced, never added to as a zero (D-256-06 / the shipped producer-shell fence).
    if usage_box is not None:
        if _judge_in:
            _prior = usage_box.get("input_tokens")
            usage_box["input_tokens"] = _judge_in if _prior is None else int(_prior) + _judge_in
        if _judge_out:
            _prior = usage_box.get("output_tokens")
            usage_box["output_tokens"] = _judge_out if _prior is None else int(_prior) + _judge_out

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

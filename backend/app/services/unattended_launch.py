"""Phase 293 (D-09, the ``scheduler_service.py`` named seam) — the shared unattended start.

MOVED, NOT REWRITTEN. This is the generic half of what ``scheduler_service.launch_scheduled_run``
and ``scheduler_service._drive_run`` did until Phase 293: create the run's own thread, create the
``workflow_runs`` row, arm the spend cap, and drive the run in the background with the mandatory
producer-shell finalizer. The ledger's named seam for the FIRING scheduler was "split cadence
claiming from job execution"; this module is the job-execution half. Schedules and API keys both
start runs through it, so the two unattended doors cannot drift (share, not copy).

What stays with each caller is what is genuinely theirs: the scheduler keeps its cap
normalisation, its ``_schedule_*`` input keys, ``ScheduledLaunchRefused`` and its outcome record
(passed in as ``on_finish``); the inbound door keeps its HTTP refusals. Both read the definition
through :func:`parse_definition_row` and the template refusal through :func:`template_refusal`,
which moved here with the core.

⚠ **THE LAUNCH REUSES ``_build_resume_context`` RATHER THAN COMPOSING ANOTHER ctx BAG.** There
are already three ctx builders in this tree (the live kickoff in ``threads.py``, the resume
builder, the publish golden-run builder) and they have measurably drifted from one another —
Phase 190's UAT found ``org_id`` missing from two of the three. An unattended run is a run
nobody is watching, so it is the *worst* place for a bespoke bag that silently lacks the
folder scope, the service-role client or the producer shell. This module creates the run row
and then asks the shipped builder for the substrate, exactly as the restart sweep does.

⚠ **THE PRODUCER SHELL MUST BE TERMINALIZED ON EVERY EXIT PATH.** ``_build_resume_context``
mints a ``runs`` row with ``status='streaming'``; an unattended run that raises and leaves it
stranded becomes the thread's latest ``runs`` row and re-wedges the F2 self-heal. The
``finally`` block below is the same mandatory finalizer ``resume_stranded_workflows`` carries,
and it is not optional here for the same reason.

⚠ **CANCELLATION IS INHERITED, NOT REIMPLEMENTED.** An unattended run is an ordinary run, so
Phase 204 plan 01's cross-worker brake (``run_lifecycle.broadcast_run_cancellation`` and the
engine's boundary/in-flight checks) applies to it unchanged. Nothing here needs to know about
stopping; the Stop button, the admin kill and SCHED-02's circuit breaker all reach it through
the one shipped path.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable
from uuid import UUID

logger = logging.getLogger(__name__)

OnFinish = Callable[[str], Awaitable[Any]]


def parse_definition_row(row: dict[str, Any], *, log_ref: Any = None):
    """The stored definition as a ``WorkflowDefinition``, or ``None`` when it cannot be parsed.

    Moved from ``launch_scheduled_run``: a jsonb definition may arrive as a string scalar, and an
    unparseable one is logged and refused rather than raised, so one broken row never stops a
    caller that loops.
    """
    from app.models.harness import WorkflowDefinition

    raw_def = row["definition"]
    if isinstance(raw_def, str):
        try:
            raw_def = json.loads(raw_def)
        except Exception as exc:
            logger.error(
                "Failed to parse string definition for schedule %s: %s",
                log_ref,
                exc,
            )
            return None
    return WorkflowDefinition.model_validate(raw_def)


def template_refusal(definition) -> str | None:
    """Phase 295 (D-13) — the sentence refusing a fill step with no template, else ``None``.

    On the definition asset ALONE: an unattended run has no launch upload and no thread yet,
    so nothing can be staged for it. The words are the lint finding's own (one sentence, one
    home: ``emit_cause``).
    """
    from app.services.harness.reachability import lint_workflow

    _no_template = [e for e in lint_workflow(definition) if e.code == "no_template_bound"]
    return _no_template[0].message if _no_template else None


async def launch_unattended_run(
    *,
    owner_id: UUID,
    org_id: Any,
    workflow_id: UUID,
    definition,
    inputs: dict[str, Any],
    title: str,
    max_tokens: int | None,
    max_duration: int | None,
    pool,
    redis,
    on_finish: OnFinish | None = None,
    run_label: str = "scheduled",
    log_ref: Any = None,
) -> UUID:
    """Start ONE unattended workflow run as ``owner_id``. Returns the ``workflow_runs`` id.

    The caller has already loaded, parsed, linted and entitlement-checked the definition.

    ⚠ **THE RUN IS STAMPED WITH THE OWNER, NEVER WITH A SERVICE IDENTITY.** Every downstream
    owner-scope guard — retrieval, the harness audit rows, the run page's ownership 404 — reads
    that stamp. An unattended run that ran as "the system" would retrieve across every tenant's
    documents.

    ``on_finish`` is awaited with the terminal status (``"completed"`` / ``"failed"``) on every
    exit path of the background drive; the scheduler passes its outcome record.
    """
    from fastapi.concurrency import run_in_threadpool  # D-v2.5-01

    from app.db.workflows import arm_run_budget, create_workflow_run
    from app.dependencies import get_service_role_supabase

    # ── the run's thread anchor ────────────────────────────────────────────────────────
    # `create_workflow_run` requires a thread (it sets `threads.active_workflow_run_id`).
    # An unattended run gets its OWN thread, one per start, for two reasons: the run surface
    # and the panel are thread-anchored, so the run stays browsable exactly like a manual
    # one; and a single reused thread would serialise every start behind one
    # `active_workflow_run_id` anchor, so a long run would block the next launch.
    #
    # ⚠ Phase 293 (D-06): the org is stamped EXPLICITLY. Left out, `threads_autofill_org_id`
    # files the thread (and the run, which inherits the thread's org) under the owner's
    # arbitrary FIRST org, so a two-org owner's key or schedule would land in the wrong org.
    supabase = get_service_role_supabase(org_id)
    thread_row: dict[str, Any] = {
        "user_id": str(owner_id),
        "title": title,
        **({"org_id": str(org_id)} if org_id is not None else {}),
    }
    thread_resp = await run_in_threadpool(
        lambda: supabase.table("threads").insert(thread_row).execute()
    )
    thread_id = _as_uuid(thread_resp.data[0]["id"])

    run_id = await create_workflow_run(
        pool,
        thread_id=thread_id,
        definition_id=workflow_id,
        definition=definition,
        inputs=inputs,
        model=None,
        user_id=owner_id,
    )

    # ── ARM THE SPEND CAP, BEFORE A SINGLE PHASE RUNS ─────────────────────────────────
    # ⚠ THIS CALL IS THE WHOLE OF SCHED-02 ON THE UNATTENDED PATH, AND ITS ABSENCE WAS
    # INVISIBLE TO 106 PASSING TESTS. The caps used to land only in `workflow_runs.inputs`;
    # `db/workflows.load_run_budget` — the breaker's ONLY source — reads the TOP LEVEL of
    # `workflow_runs.metadata`. Until this line existed the two never met, and because that
    # read FAILS OPEN the breaker disarmed silently: a live scheduled run was measured at
    # 3m20s against a 120-second cap (2026-08-24, run 27e00e7e).
    #
    # ⚠ IT MUST PRECEDE `_drive_run`. The breaker resolves its budget once, when the engine
    # starts the run; arming afterwards is a race that the engine usually wins, which is the
    # worst kind — it would pass a test and cap nothing in production.
    #
    # ⚠ IT IS BEST-EFFORT, DELIBERATELY, AND THE ASYMMETRY IS THE POINT. A failure here must
    # not stop the run from launching (that would make an unapplied migration 125 an outage
    # rather than a disarmed cap — the same fail-open argument `load_run_budget` makes). But
    # it is logged at exception level, because a silently uncapped unattended run is exactly
    # what this phase exists to prevent.
    try:
        await arm_run_budget(
            pool,
            run_id,
            max_tokens_per_run=max_tokens,
            max_duration_seconds=max_duration,
        )
    except Exception:
        logger.exception(
            "could not arm the circuit breaker for %s run %s (%s) — the "
            "run proceeds UNCAPPED. If migration 125 is unapplied, that is the cause.",
            run_label,
            run_id,
            log_ref,
        )

    # ── drive it, in the background, with the mandatory shell finalizer ────────────────
    asyncio.create_task(
        _drive_run(
            run_id=run_id,
            thread_id=thread_id,
            owner_id=owner_id,
            org_id=org_id,
            inputs=inputs,
            definition=definition,
            pool=pool,
            redis=redis,
            on_finish=on_finish,
            run_label=run_label,
            log_ref=log_ref,
        )
    )
    return run_id


async def _drive_run(
    *,
    run_id: UUID,
    thread_id: UUID,
    owner_id: UUID,
    org_id: Any,
    inputs: dict,
    definition,
    pool,
    redis,
    on_finish: OnFinish | None = None,
    run_label: str = "scheduled",
    log_ref: Any = None,
) -> None:
    """Build the ctx, run the workflow, terminalize the producer shell, report the outcome.

    Every exit path finalizes the shell (see the module docblock) and every exit path calls
    ``on_finish``. An unattended run whose outcome nobody recorded is a run whose author has no
    way to learn it failed, which is the specific way unattended automation goes bad quietly.
    """
    from app.services.harness_engine import _build_resume_context, run_workflow
    from app.services.run_lifecycle import finalize_run_terminal, mirror_run_active

    ctx = None
    failed = False
    try:
        ctx = await _build_resume_context(
            {
                "run_id": run_id,
                "thread_id": thread_id,
                "user_id": owner_id,
                "org_id": org_id,
                "inputs": inputs,
            },
            redis,
            pool,
        )
        # ── MAKE THE RUN VISIBLE TO THE OPERATOR, BEFORE IT DOES ANY WORK ────────────
        # ⚠ WITHOUT THIS THE CONTROL ROOM CANNOT SEE AN UNATTENDED RUN AT ALL, AND THAT IS
        # THE WORST CASE TO MISS. `/admin/runs` lists `runs:active` (ZRANGE) and enriches
        # from the `runs` table; `register_run_start` — the only writer of that mirror —
        # is called from exactly ONE place, `threads.py`, the CHAT path. `run_lifecycle`'s
        # own header admits the invariant is "CHAT-SCOPED this phase" (D-145-12).
        #
        # A chat run has a person watching who can stop it. An unattended run is
        # precisely the one an operator needs to SEE and KILL — and it was the invisible
        # one. Measured 2026-08-24: run 27e00e7e sat `active` in Postgres while
        # `runs:active` held ZERO entries.
        #
        # The `runs` row already exists — `_build_resume_context` mints the producer shell
        # — so only the MIRROR half is owed here, which is why this is `mirror_run_active`
        # and not `register_run_start` (calling that would insert a SECOND runs row).
        #
        # ⚠ BEST-EFFORT, NEVER FATAL. The mirror is a DERIVED index; `runs.status` is
        # authoritative (D-145-01). A Redis blip must not turn into a failed unattended run.
        pid = getattr(ctx, "producer_run_id", None)
        if pid is not None:
            await mirror_run_active(redis, run_id=pid, thread_id=thread_id)

        await run_workflow(run_id, definition, ctx, pool=pool, redis=redis)
    except Exception:  # noqa: BLE001 — one run must never take down the loop
        failed = True
        logger.exception("%s run %s (%s) failed", run_label, run_id, log_ref)
    finally:
        pid = getattr(ctx, "producer_run_id", None) if ctx is not None else None
        if pid is not None:
            try:
                # ⚠ `finalize_run_terminal`, NOT `finalize_run`. The DB-only writer leaves
                # the run in `runs:active` forever, so the Control Room would show a
                # finished unattended run as permanently active with a live Kill button —
                # a GHOST. Registering without finalizing through the co-writer would have
                # made the visibility fix worse than the gap it closed.
                #
                # METER-05 site 5 (Phase 256 / D-256-08). An UNATTENDED run is exactly the
                # one nobody notices is uncounted: this shell hardcoded a NULL usage, so
                # every scheduled run's segment read as "never measured" while the box on
                # `ctx` had been measuring it all along (harness_engine.py:1864).
                # ⚠ This read sits INSIDE the existing `pid is not None` guard, which is
                # itself inside `ctx is not None` — a failed ctx build still reports the
                # outcome and still must not raise here.
                # ⚠ GRAIN (D-256-03): segment box onto a per-segment `runs` row.
                # ⛔ No default and no `or 0` (D-256-06).
                # ⛔ The writer stays `finalize_run_terminal` — see the paragraph above.
                _box = getattr(ctx, "run_usage_box", None) or {}
                _in_tok = _box.get("input_tokens")
                _out_tok = _box.get("output_tokens")
                if _in_tok is None and _out_tok is None:
                    # db/runs.py:93-99's contract. IDENTIFIERS ONLY (T-073-04).
                    logger.warning(
                        "runs.usage missing for run=%s provider=%s model=%s",
                        pid,
                        getattr(ctx, "provider", None),
                        getattr(ctx, "model", None),
                    )
                await finalize_run_terminal(
                    pool=pool,
                    redis=redis,
                    run_id=pid,
                    thread_id=thread_id,
                    status="failed" if failed else "completed",
                    error=f"{run_label} run failed" if failed else None,
                    completed_at=datetime.now(timezone.utc),
                    message_id=None,
                    input_tokens=_in_tok,
                    output_tokens=_out_tok,
                )
            except Exception:  # noqa: BLE001
                logger.exception("%s-run producer-shell finalize failed for %s", run_label, pid)
        if on_finish is not None:
            await on_finish("failed" if failed else "completed")


def _as_uuid(value: Any) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))

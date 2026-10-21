"""The engine-ask disposition family — how a failing gate becomes a question to a person.

EXTRACTED FROM ``app.services.harness_engine`` on 2026-10-21 (Phase 295 / D-51,
resolving D-32) to take the named G-5 seam on that file BEFORE any feature code lands
on it. Plans 295-03 and 295-04 add the durable pause inside THIS module; the engine
keeps only its call lines.

The bodies below are a **VERBATIM move**, not a rewrite. The cut was driven by a script
that asserted the pre-move line boundaries first and aborted on drift
(``harness_engine.py:618-673`` — ``_OnFailure`` / ``_parse_on_failure`` /
``_failing_on_failure`` with the comment above ``_OnFailure``; ``:1248-1714`` —
``_route_on_failure`` through ``_resolve_failure_with_ask_user``, every comment block
directly above each binding included). ``tests/unit/test_295_engine_ask_seam.py``
proves it: every moved binding is ``ast.dump``-identical to its body at the phase base.

⚠ CONSUMERS WERE DELIBERATELY NOT REPOINTED. ``harness_engine.py`` re-exports every
name, so ``_run_phase_with_gates``' calls stay byte-identical and there is ONE object,
not two::

    app.services.harness_engine._resolve_failure_with_ask_user
        is app.services.harness.engine_ask._resolve_failure_with_ask_user

⚠ THE RE-EXPORT IS LOAD-BEARING AND MUST NOT BE "TIDIED" AWAY (the ``human_input.py``
precedent, Phase 200 / D-13). Its POSITION is load-bearing too: it sits at the END of
``harness_engine.py``, because importing this module runs the ``app.services.harness``
package ``__init__`` → ``phase_types.register_all()`` → ``from app.services.harness_engine
import PHASE_TYPE_REGISTRY``. In the engine's top import block that fails on a cold
``import app.services.harness_engine`` (measured — 295-01 SUMMARY, ``## Cycle probe``).

⚠ THE HONEST LEAF INVARIANT, AT ITS REAL STRENGTH. This is not a true leaf: the moved
bodies read ``PhaseOutcome`` and ``_emit``, which stay in the engine. So the binding
invariants are the weaker, true ones: this module imports ``harness_engine`` ONLY for
those two names, ONLY at module level (the end-of-module re-export guarantees both are
bound by then), and it **never imports ``phase_types``** — the cycle that actually exists.

⚠ THE LOGGER KEEPS ITS OLD NAME. ``logger`` is ``logging.getLogger(
"app.services.harness_engine")``, not ``__name__``, so the disposition's log records carry
exactly the logger name they carried before the move (a pure move changes no observable).

⚠ AND THE PATCH SURFACE MOVED WITH THE FUNCTION. ``write_audit`` and ``_emit`` are bound
as module GLOBALS here, so a test that patched ``harness_engine.write_audit`` /
``harness_engine._emit`` to intercept the disposition's receipt or prompt emit now
patches a name the function no longer reads. Those sites were measured RED first and
repointed to ``engine_ask`` in the move commit (295-01 SUMMARY lists every site).
"""
from __future__ import annotations

import asyncio
import json
import logging
from collections import namedtuple
from uuid import UUID

from app.config import settings
from app.db.workflows import (
    get_active_phase,
    get_ask_user_response,
    pause_run,
    stash_awaiting_answer,
    write_audit,
)
from app.services.harness.phase_confidence import resolve_kb_label
# Bound from the engine (see "THE HONEST LEAF INVARIANT" above). Safe ONLY because the
# engine imports this module at its END, after both names are bound.
from app.services.harness_engine import PhaseOutcome, _emit

logger = logging.getLogger("app.services.harness_engine")

__all__ = [
    "_ABORT_LIKE_CHOICES",
    "_ACTION_RISK_APPROVE_CHOICE",
    "_ACTION_RISK_FINDING_PREFIX",
    "_OnFailure",
    "_ask_user_choices_from_finding",
    "_failing_on_failure",
    "_is_abort_choice",
    "_parse_on_failure",
    "_resolve_failure_with_ask_user",
    "_route_on_failure",
    # Phase 295 (295-03): the durable engine ask.
    "ENGINE_ASK_POLICY",
    "ENGINE_CHOICE_CONTINUE",
    "ENGINE_CHOICE_SEARCH",
    "ENGINE_CHOICE_STOP",
    "classify_engine_choice",
    "compose_engine_choices",
    "consume_engine_answer",
    "engine_answer_refusal",
    "engine_pause",
    "resolve_engine_label",
    "finding_from_output",
    "is_locked",
    "permitted_folder_options",
]


# on_failure dispositions (ValidatorSpec.on_failure). UNKNOWN values route to
# fail_run (fail-safe — T-091-18 mitigation).
_OnFailure = namedtuple("_OnFailure", ["kind", "target_slug"])


def _parse_on_failure(on_failure: str) -> _OnFailure:
    """Parse a failing validator's ``on_failure`` disposition.

    Recognizes ``fail_run`` (the D-07 baseline), ``retry`` (retry exhausted ⇒ falls
    back to fail_run unless a skip_to_phase is configured), ``skip_to_phase:<slug>``
    (D-09), and ``ask_user`` (the D-11 generic 4th disposition — any validator can
    declare it; the engine pauses for a human choice via the 085 ask_user_service).
    ANY unrecognized value routes to ``fail_run`` (fail-safe, T-091-18).

    NOTE: ``ask_user`` is a PURE-PARSE result here — ``_route_on_failure`` (the sync
    mapper) cannot await the user, so the pause is resolved INLINE in
    ``_run_phase_with_gates`` via ``_resolve_failure_with_ask_user`` (where
    redis/pool/ctx are in scope — RESEARCH Pattern 3 / A4). A bare ``_route_on_failure``
    seeing an ``ask_user`` disposition treats it as ``fail_run`` (fail-safe — it
    cannot pause), so the engine MUST route ask_user through the async helper.
    """
    from app.services.harness.reachability import parse_skip_target

    target = parse_skip_target(on_failure)
    if target is not None:
        return _OnFailure("skip_to_phase", target)
    if on_failure == "ask_user":
        # D-11 — the 4th disposition. Resolved INLINE (the async helper), never by
        # the sync _route_on_failure (which cannot await the user).
        return _OnFailure("ask_user", None)
    if on_failure in ("fail_run", "retry"):
        # `retry` here means "retries are exhausted" → D-07 baseline (fail_run).
        return _OnFailure("fail_run", None)
    return _OnFailure("fail_run", None)  # unknown → fail-safe


def _failing_on_failure(phase, failed_idx: int | None) -> str:
    """The ``on_failure`` of the validator that produced this gate failure.

    WR-03 (091-08): ``run_gates`` now threads the FAILING validator's index back
    (``GateResult.validator_index``); the engine passes it here as ``failed_idx`` so
    the disposition comes from the SAME validator whose ``max_retries`` bounded the
    retry loop. When the index is known we index ``phase.validators[failed_idx]``
    directly. When it is None (e.g. a wall-clock timeout — no gate ran) we fall back
    to the prior heuristic: the first validator carrying a ``skip_to_phase``
    disposition if any, else the first validator's ``on_failure``.
    """
    validators = list(getattr(phase, "validators", None) or [])
    if not validators:
        return "fail_run"
    if failed_idx is not None and 0 <= failed_idx < len(validators):
        return validators[failed_idx].on_failure
    for v in validators:
        if v.on_failure.startswith("skip_to_phase:"):
            return v.on_failure
    return validators[0].on_failure


def _route_on_failure(
    phase,
    error_message: str,
    attempt: int,
    failed_idx: int | None = None,
    *,
    reason_is_final: bool = False,
) -> PhaseOutcome:
    """Map an exhausted/timed-out gate failure to a :class:`PhaseOutcome`.

    ``failed_idx`` (WR-03) is the index of the validator that failed — both the
    retry bound and this routing disposition derive from that same validator.

    ``reason_is_final`` (Phase 281, D-25): the message is an executor's composed cause,
    which already names the step and counts its model calls — it is the reason
    verbatim, never prefixed with the engine's ``Phase N (slug) … attempt(s)`` (two
    totals in one string). Default False keeps every other caller byte-identical.
    """
    disposition = _parse_on_failure(_failing_on_failure(phase, failed_idx))
    reason = error_message if reason_is_final else (
        f"Phase {phase.phase_index + 1} ({phase.slug}) gate failed after "
        f"{attempt + 1} attempt(s): {error_message}"
    )
    if disposition.kind == "skip_to_phase":
        return PhaseOutcome("skip_to", None, disposition.target_slug, reason)
    # ``ask_user`` cannot be resolved here (this sync mapper cannot await the user) —
    # fail safe to fail_run. The engine routes ask_user through
    # ``_resolve_failure_with_ask_user`` (the async helper) BEFORE ever reaching here,
    # so this branch is only hit when the pause path is unreachable (no redis/ctx).
    return PhaseOutcome("fail_run", None, None, reason)


def _ask_user_choices_from_finding(error_message: str) -> list[str]:
    """Derive the ask_user choices from a validator's structured finding (D-11).

    The freshness validator (Plan 03) encodes its finding as a parseable
    ``error_message`` prefix:
      - ``freshness:staleness|...``         → ["Proceed anyway", "Abort"]
      - ``freshness:version_ambiguity|...`` → ["Proceed despite version ambiguity", "Abort"]
      - ``action_risk:approval|...``        → ["Approve this step", "Do not run it"]
    Any other finding falls back to the generic Proceed/Abort pair. The choices are
    presented to the user; the engine maps the chosen text back to a continue/fail
    routing (an Abort-like choice → fail_run; anything else → Proceed).

    Phase 185 (GOVERN-03 / D-185-14): the ``action_risk:approval|`` pair is the ARMED
    action-risk checkpoint's. Its wording is deliberately about THE STEP rather than
    about a finding — nothing was flagged, the author simply said a person decides
    before this one runs — which is why it does not reuse "Proceed anyway" / "Abort".
    EVERY string returned from here MUST be classified by ``_is_abort_choice``; see
    that function's docstring for why an unclassified decline phrase is a fail-open.

    WR-08: the version-ambiguity branch presents the HONEST pair matching the
    staleness pair — NOT "Use newest version" / "Use as-is", which implied
    version-scoped retrieval that does not exist (both old non-abort choices routed
    identically to Proceed). Until version-scoped narrowing ships, the user explicitly
    approves continuing with UNFILTERED retrieval; the v1 cut is noted in the receipt.
    """
    msg = error_message or ""
    if msg.startswith("freshness:version_ambiguity|"):
        return ["Proceed despite version ambiguity", "Abort"]
    if msg.startswith("freshness:staleness|"):
        return ["Proceed anyway", "Abort"]
    if msg.startswith("action_risk:approval|"):
        return [_ACTION_RISK_APPROVE_CHOICE, "Do not run it"]
    return ["Proceed anyway", "Abort"]


# T-185-04-01 (quick-260731-3y4) — THE ONE HOME for the armed checkpoint's approve
# label. It is BOTH what the armed pair above presents AND the only string the armed
# disposition accepts as consent (the allow-list in ``_resolve_failure_with_ask_user``),
# so a change here changes what counts as approval for an irreversible action. Written
# once for the same reason ``_ABORT_LIKE_CHOICES`` below writes the decline phrase as
# the literal the function returns: a rename must not be able to separate the label
# from the gate that reads it.
#
# ⚠ WORDING — corrected at /gsd:verify-work 189 (2026-08-08), operator-decided.
# This read "Approve and run this step" until Phase 189's live UAT observed it on an
# ``external_action`` step, whose whole contract is that it RECORDS AN INTENTION AND
# SENDS NOTHING. "and run" implied an outward effect the governed node exists not to
# have — it was the one sentence on that surface arguing against SC#4, while the
# step's own recorded output says "No email was sent. Nothing left this workflow."
#
# Deliberately ONE literal for every armed type rather than a phase-type-conditional
# label: the gate at ``_resolve_failure_with_ask_user`` is an EXACT-MATCH fail-closed
# compare, and making the label conditional would force that allow-list to accept two
# strings — widening the consent set on an irreversible action, which is precisely the
# surface Phase 190 makes dangerous. "Approve this step" is true of every armed type
# (185's ``llm_human_input`` included) without splitting the label from its gate.
#
# ⚠ Changing this literal changes what counts as consent. A run already PAUSED at an
# armed checkpoint under the old label fails CLOSED on resume (line ~1365 returns
# fail_run when the answer does not match) — safe, but it does end that run. Verified
# at edit time that no live paused run existed; the three ``active`` rows were stale
# zombies from June/July.
_ACTION_RISK_APPROVE_CHOICE = "Approve this step"


# Phase 185 (GOVERN-03 / RESEARCH L-4) — the set of chosen texts that mean "do NOT
# proceed". Lower-cased comparison values; the armed decline phrase is written as the
# SAME literal ``_ask_user_choices_from_finding`` returns, lowered here, so the two
# cannot drift apart under a rename.
_ABORT_LIKE_CHOICES = ("abort", "cancel", "stop", "", "Do not run it".lower())


def _is_abort_choice(choice: str) -> bool:
    """A chosen option that means 'do NOT proceed' → honest fail_run (D-11).

    **THE INVARIANT (Phase 185 / L-4): every string a branch of
    ``_ask_user_choices_from_finding`` can return must be classified by this
    function** — exactly one of each presented pair is abort-like and the other is not.

    THE FAIL-OPEN SHAPE THIS CLOSES. The routing is not symmetric: an abort-like
    choice fails the run, and *everything else* — including a decline phrase this
    function does not recognise — falls through to the Proceed branch, which writes a
    ``validator_ask_user_approved`` receipt and RUNS the step. Before Phase 185 the set
    was ``("abort", "cancel", "stop", "")``, so the armed checkpoint's ``"Do not run
    it"`` would have been read as approval: a person clicking *don't* would have sent
    the email and been recorded as having authorised it. Any FUTURE choice pair must
    therefore extend this set in the SAME commit that adds it; the invariant guard in
    ``tests/unit/test_ask_user_disposition.py`` drives every known finding prefix plus
    the generic fallback and fails if a pair is ever left unclassified.

    The three shipped freshness/generic choices are literally ``"Proceed anyway"``,
    ``"Proceed despite version ambiguity"`` and ``"Abort"`` — none of which the Phase
    185 addition touches, so those routings are byte-identical.
    """
    return (choice or "").strip().lower() in _ABORT_LIKE_CHOICES


# Phase 185 (GOVERN-03 / RESEARCH L-5) — the structured finding prefix that carries the
# armed approval sentence into ``_resolve_failure_with_ask_user``, whose DELTA 1 splits
# the prompt back out on ``"|"``. Phase 187 (D-187-01) made the hoisted checkpoint its
# ONLY producer, and the string-prefix SNIFF that used to read it back is DELETED —
# the engine no longer infers "this phase is armed" from a message it parsed; the
# checkpoint reads ``phase.action_risk_armed`` and tells the helper so with
# ``is_action_risk=True``. The prefix is now a wire format, not a predicate.
_ACTION_RISK_FINDING_PREFIX = "action_risk:approval|"


async def _resolve_failure_with_ask_user(
    phase,
    error_message: str,
    attempt: int,
    failed_idx: int | None,
    *,
    run_id: UUID,
    pool,
    redis,
    ctx,
    _audit_user_id: UUID | None,
    stream_run_id: UUID | None = None,
    produced_output: dict | None = None,
    is_pre: bool = False,
    is_action_risk: bool = False,
    reason_is_final: bool = False,
) -> PhaseOutcome | None:
    """Resolve a failing validator's disposition, pausing for a human choice when
    the disposition is ``ask_user`` (D-11).

    If the failing validator's ``on_failure`` is NOT ``ask_user``, delegate to the
    sync ``_route_on_failure`` (fail_run / skip_to_phase) — byte-identical behavior.

    When it IS ``ask_user``: pause via the 085 ask_user_service ordering
    (durable prompt row → emit ``ask_user_prompt`` → SUBSCRIBE-before-emit block on
    ``subscribe_for_response``), presenting the validator's structured finding as
    choices. The answer routes:
      - unanswered (subscribe returns None, the 085 expiry) → honest ``fail_run``.
      - an Abort-like choice                                → honest ``fail_run``.
      - a Proceed/use-version choice → write a ``validator_ask_user_approved`` receipt
        (someone explicitly approved grounding on the flagged finding — governance)
        and CONTINUE: for a PRE gate return ``None`` (signal 'run the body'); for a
        POST gate return ``completed`` carrying the already-produced output.

    The redis/pool ordering, the channel keying, and the expiry-honest-fail are the
    SAME shipped 085 substrate ``_exec_llm_human_input`` uses — never re-invented.

    ``is_action_risk`` (D-187-01 / RESEARCH Pitfall 3) — TRUE only when the CALLER is
    the armed action-risk checkpoint. It is a per-CALL parameter and never a
    ``phase.action_risk_armed`` read inside this function, because this function serves
    BOTH the armed checkpoint AND the author's own ``ask_user`` gates on the SAME phase.
    An armed phase can carry authored gates too, and only the armed one gets the armed
    treatment (the indefinite wait, the shutdown-``CancelledError`` escape, the armed
    choice pair, and the exact-match approval allow-list). Reading the phase here would
    hand an unrelated freshness gate all four. Every non-armed caller leaves it at its
    ``False`` default and every branch below evaluates to exactly the expression that
    shipped.

    ``reason_is_final`` (Phase 281, D-25) — TRUE only when ``error_message`` is an emit
    executor's composed cause: it is used verbatim as the reason (no ``Phase N (slug)``
    prefix) on every route. Default False is byte-identical.
    """
    # ── D-187-01 / RESEARCH Pitfall 4 — THE DISPOSITION SHORT-CIRCUIT ────────────
    # An armed checkpoint has NO index into ``phase.validators`` (after the hoist it is
    # not in the list at all), so ``failed_idx`` is None and ``_failing_on_failure``
    # would fall back to the PHASE's own heuristic — an author's ``fail_run`` could
    # route the checkpoint to ``_route_on_failure`` and THE PERSON WOULD NEVER BE ASKED.
    # That is a fail-open of exactly the class the Phase-185 BLOCKER T-185-04-01
    # belonged to. When ``is_action_risk`` the disposition is ``ask_user`` BY
    # CONSTRUCTION, so ``_failing_on_failure`` is skipped ENTIRELY rather than computed
    # and overridden — there is no path a future edit can re-introduce the read on.
    if not is_action_risk:
        disp = _parse_on_failure(_failing_on_failure(phase, failed_idx))
        if disp.kind != "ask_user":
            # ── Phase 295 (D-01 / D-51) — THE ENGINE CITATIONS GATE PAUSES DURABLY ──────
            # Identified by the pure predicate, never by its disposition (it keeps
            # ``fail_run`` in grounding.py). An outage keeps the shipped route (D-06).
            from app.services.harness.grounding import is_engine_citation_gate  # noqa: PLC0415

            _finding = finding_from_output(produced_output)
            if not is_pre and is_engine_citation_gate(phase, failed_idx) and _finding != "outage":
                return await engine_pause(
                    phase, kind=_finding, error_message=error_message,
                    produced_output=produced_output, failed_idx=failed_idx, run_id=run_id,
                    pool=pool, redis=redis, ctx=ctx, _audit_user_id=_audit_user_id,
                    stream_run_id=stream_run_id,
                )
            # fail_run / skip_to_phase — the sync mapper handles it byte-identical.
            return _route_on_failure(
                phase, error_message, attempt, failed_idx, reason_is_final=reason_is_final
            )
    else:
        # ── Phase 295 (D-18) — THE ARMED APPROVAL IS THE SAME DURABLE PAUSE ─────────────
        # A live armed checkpoint no longer waits in-process (a golden run auto-continues
        # upstream, 189 D-19). Everything below this ``if`` is therefore reached by an
        # AUTHOR's ``ask_user`` gate only; its armed-only deltas are now unreachable.
        if _take_engine_approval(ctx, phase):
            # The approval was consumed on THIS re-drive (``consume_engine_answer``): run the
            # body once, asking nothing, and write the governance receipt here — where the
            # approval is USED, after the pre-gates passed again (consequence ≠ receipt).
            await _write_receipt(pool, run_id, _audit_user_id, {
                "phase": phase.slug,
                "validator": failed_idx,
                "choice": _ACTION_RISK_APPROVE_CHOICE,
                "finding": error_message,
            })
            return None
        return await engine_pause(
            phase, kind="action_risk", error_message=error_message, produced_output=None,
            failed_idx=failed_idx, run_id=run_id, pool=pool, redis=redis, ctx=ctx,
            _audit_user_id=_audit_user_id, stream_run_id=stream_run_id,
        )

    # ── ask_user pause (copy _exec_llm_human_input ordering VERBATIM) ──
    # The pause needs a live redis transport + a run_id channel; without them the
    # disposition cannot pause (a unit/minimal ctx) → fail safe to fail_run, never
    # a hung run.
    if redis is None or run_id is None:
        return _route_on_failure(
            phase, error_message, attempt, failed_idx, reason_is_final=reason_is_final
        )

    from uuid import uuid4

    # ── Phase 185 (GOVERN-03 / SPEC Req 9) — THE ARMED-GATE READING ──────────────
    # ONE flag; every Phase-185 delta below branches on it. Phase 187 (D-187-01) moved
    # the reading from a string-prefix sniff on the error message to the ``is_action_risk``
    # PARAMETER declared above: the CALLER knows which gate it is, and only the armed
    # caller passes True. The substance is unchanged — an armed phase can also carry
    # authored gates, and only the armed one gets this disposition. An unarmed
    # ``llm_human_input`` step and every freshness gate keep byte-identical behaviour:
    # for them ``is_action_risk`` is False and each branch below evaluates to exactly the
    # expression that shipped.

    tool_call_id = uuid4().hex
    choices = _ask_user_choices_from_finding(error_message)
    if is_action_risk:
        # DELTA 1 — the prompt. "A validation check on phase 'X' flagged: …" is wrong
        # for an armed step: nothing was flagged, the author simply said a person
        # decides before this one runs. Use the engine-generated sentence carried AFTER
        # the prefix, VERBATIM (D-185-14) — composed by ``grounding._approval_sentence``,
        # already honest about POSITION, IDENTITY and CONSEQUENCE, and deliberately not
        # wrapped in the generic validation-flagged sentence.
        prompt = error_message.split("|", 1)[1]
    else:
        prompt = (
            f"A validation check on phase '{phase.slug}' flagged: {error_message}. "
            "How should the run proceed?"
        )
    # DELTA 2 — the timeout. An armed checkpoint waits INDEFINITELY: with the checkpoint
    # set, no answer must mean the run NEVER proceeds (SPEC Req 9), so there can be no
    # expiry that quietly reads as "yes". ``None``, never ``0``: the shipped
    # ``PendingAskCard`` seeds its countdown from this value and counts a null/zero
    # deadline down to EXPIRED ("No response within 0:00 — agent stopped"), so emitting
    # ``0`` would render every armed prompt as dead the instant it appeared. Plan 185-05
    # teaches the card to render ``None`` as "no deadline"; this path's job is to SEND
    # ``None`` — it rides into the durable prompt row and the ``ask_user_prompt`` emit
    # below unchanged, both of which simply carry ``timeout_seconds``.
    timeout_seconds = None if is_action_risk else min(
        getattr(phase.config, "timeout_seconds", settings.ask_user_max_timeout_seconds)
        if getattr(phase, "config", None) is not None
        else settings.ask_user_max_timeout_seconds,
        settings.ask_user_max_timeout_seconds,
    )

    # 1. Durable prompt row (the resume matcher keys on run_id) — best-effort, the
    #    live block-on-answer flow does not depend on it (mirrors _exec_llm_human_input).
    supabase = getattr(ctx, "supabase", None)
    current_user = getattr(ctx, "current_user", None) or {}
    thread_id = getattr(ctx, "thread_id", None)
    if supabase is not None and thread_id:
        try:
            from app.utils.db import aexec

            await aexec(
                supabase.table("messages").insert(
                    {
                        "thread_id": thread_id,
                        "user_id": current_user.get("id"),
                        "role": "system",
                        "content": prompt,
                        # CTX-01 (T-120-04): harness disposition ask_user prompt — workflow row.
                        "origin": "harness",
                        "tool_calls": [
                            {
                                "kind": "ask_user_prompt",
                                "tool_call_id": tool_call_id,
                                "prompt": prompt,
                                "options": choices,
                                "timeout_seconds": timeout_seconds,
                                "run_id": str(run_id),
                            }
                        ],
                    }
                )
            )
        except Exception:  # noqa: BLE001
            logger.exception(
                "ask_user disposition: prompt row insert failed run=%s tcid=%s",
                run_id, tool_call_id,
            )

    # 2. Emit the ask_user prompt so the frontend renders the choice — on the
    #    PRODUCER stream the frontend tails (the direct-executor-emit transport
    #    pattern from _exec_llm_human_input), while the durable row + subscribe
    #    channel stay on the workflow run_id for live↔resume consistency.
    _stream_id = getattr(ctx, "producer_run_id", None) or stream_run_id or run_id
    emit = getattr(ctx, "emit", None) or _emit
    try:
        await emit(
            redis, _stream_id, "ask_user_prompt",
            tool_call_id=tool_call_id,
            prompt=prompt,
            options=choices,
            timeout_seconds=timeout_seconds,
        )
    except Exception:  # noqa: BLE001
        logger.exception("ask_user disposition: ask_user_prompt emit failed")

    # 3. Block on the answer (SUBSCRIBE-before-emit is enforced inside the helper;
    #    None on timeout — honest fail, never a hung run — the 085 expiry).
    from app.services.ask_user_service import subscribe_for_response

    payload = await subscribe_for_response(
        redis, run_id, tool_call_id,
        # DELTA 2 (cont.) — armed: pass ``None`` straight through for the indefinite
        # wait (the ``float()`` cast would TypeError on it). The non-armed expression is
        # byte-identical to what shipped.
        timeout_seconds if is_action_risk else float(timeout_seconds),
    )

    # DELTA 3 (RESEARCH L-6) — a graceful restart must not DESTROY an armed run.
    # A ``{"kind": "shutdown"}`` payload comes ONLY from main.py's
    # ``broadcast_shutdown_sentinel_to_all``. It is not a decision, and today it is read
    # as one: the payload is not ``kind: "response"``, so ``choice`` stays ``""``,
    # ``_is_abort_choice("")`` is True, and the run is FAILED by a routine deploy. Copy
    # the shipped 096-09 precedent (``harness/phase_types._exec_llm_human_input``):
    # raise ``asyncio.CancelledError`` so the phase stays ``active`` and the durable
    # prompt row survives, and let the boot-time resume sweep re-ask. ``run_workflow``'s
    # escape handler already skips ``_expire_pending_ask_user`` when
    # ``is_app_shutting_down()``, so the prompt is not expired out from under it.
    #
    # SCOPED TO ARMED CHECKPOINTS ONLY, DELIBERATELY. The freshness gate reaching this
    # same line has the identical destructive-on-deploy behaviour, but SPEC Req 9 scopes
    # the fail-closed change to armed checkpoints ("a plain llm_human_input step keeps
    # its CURRENT timeout disposition unchanged"; §Out-of-scope: "Only armed checkpoints
    # change") and no D-185-NN decision authorises widening it. So the asymmetry inside
    # this one function is intentional: an armed gate escapes via CancelledError, every
    # other disposition keeps today's choice="" → _is_abort_choice("") → fail_run path
    # byte-for-byte. The freshness twin is recorded as a deferred item in
    # ``185-CONTEXT.md`` with a re-open trigger; it is not fixed here.
    if is_action_risk and payload and payload.get("kind") == "shutdown":
        raise asyncio.CancelledError(
            "action-risk checkpoint interrupted by server shutdown — phase left active "
            "for the boot-time resume sweep (096-09 precedent)"
        )
    # Phase 295 (D-49): a ``{"kind": "cancel"}`` payload is a STOP, never a decision. It used to
    # resolve ``choice = ""`` → ``_is_abort_choice`` → ``fail_run`` "aborted by user", so a
    # stopped run read failed. It now escapes like the shutdown sentinel, for every disposition
    # that waits here; the run ends ``cancelled``. ``if payload is None`` below is untouched.
    if payload and payload.get("kind") == "cancel":
        raise asyncio.CancelledError("ask_user wait stopped by a cancel (295 D-49)")

    reason_base = error_message if reason_is_final else (
        f"Phase {phase.phase_index + 1} ({phase.slug}) validation flagged: {error_message}"
    )

    if payload is None:
        # Unanswered (the 085 expiry) → honest fail, never hung.
        #
        # DELTA 4 — KEPT ON PURPOSE for armed gates. With ``timeout_seconds=None`` this
        # branch is unreachable for an armed checkpoint except on an UNPARSEABLE payload
        # (``_subscribe_and_block`` also returns ``None`` for malformed JSON). Keeping
        # it is the fail-closed posture: a payload we could not read is not consent, and
        # the only safe reading of "we don't know what they said" is "do not run it".
        return PhaseOutcome(
            "fail_run", None, None, f"{reason_base} — unanswered, run failed"
        )

    # Resolve the chosen option text (choice-click arrives as {choice_index: N};
    # same defense as _exec_llm_human_input / the Deep dispatcher handler).
    choice = ""
    if payload.get("kind") == "response":
        choice = (payload.get("response_text") or "").strip()
        if not choice and choices:
            _ci = payload.get("choice_index")
            try:
                _ci = int(_ci)
                if 0 <= _ci < len(choices):
                    choice = str(choices[_ci])
            except (TypeError, ValueError):
                pass

    if _is_abort_choice(choice):
        return PhaseOutcome(
            "fail_run", None, None, f"{reason_base} — aborted by user"
        )

    # ── T-185-04-01 — THE ARMED PROCEED SIDE IS AN ALLOW-LIST ────────────────────
    # ``_is_abort_choice`` is a DENY-list, and a deny-list cannot be made fail-closed
    # by extension: there is no finite set of ways to say no. Phase 185 extended it and
    # added an invariant guard over the PRESENTED BUTTON LABELS, but the shipped
    # ``PendingAskCard`` does not restrict the person to those labels — its free-text
    # ``<textarea>`` is unconditional (the choice buttons are gated on
    # ``options.length > 0``; the textarea is gated on nothing), and ``api/runs.py``
    # accepts ``response_text`` without validating it against the prompt's options. So a
    # typed "no", "nope", "stop it" or "Do not run it." (trailing period) fell straight
    # through this deny-list into the receipt write below, RAN the risky step and
    # recorded the person who refused as having authorised it.
    #
    # The engine's own words, four branches up at the ``payload is None`` case: "a
    # payload we could not read is not consent, and the only safe reading of 'we don't
    # know what they said' is 'do not run it'." An answer we cannot read AS THE APPROVAL
    # OPTION is the identical epistemic situation, so it gets the identical reading.
    #
    # Exact equality against the presented label, on the value already ``.strip()``ed
    # above — not casefold, not prefix, not substring. Case-insensitive matching would be
    # strictly MORE permissive for zero benefit: the click path resolves ``choices[0]`` to
    # this exact literal, so every string a looser rule newly accepts is one only the
    # typed path can produce. And the two errors are not symmetric — refusing an
    # oddly-cased approval fails a run the person re-triggers with a click; accepting one
    # sends the email.
    #
    # ORDERING IS LOAD-BEARING. ``_is_abort_choice`` stays FIRST so "Do not run it" and
    # "Abort" keep the byte-identical "— aborted by user" reason on every path including
    # this one. And the branch is gated on ``is_action_risk`` (the caller-supplied
    # parameter, D-187-01 — one flag read in one place), so
    # on the three non-armed choice pairs it is dead code and their routing — free-text
    # fall-through included — is unmoved. The distinct reason below is deliberate: the
    # ledger must not claim the person "aborted" when the truth is that the engine could
    # not read their answer as consent. The raw answer is NOT interpolated — it reaches
    # the durable prompt row, not the run's failure reason.
    if is_action_risk and choice != _ACTION_RISK_APPROVE_CHOICE:
        return PhaseOutcome(
            "fail_run", None, None,
            f"{reason_base} — not approved: the answer did not match the approval option",
        )

    # Proceed — write the governance receipt, then continue.
    #
    # D-187-18 — ``validator`` is written as ``None`` for a HOISTED armed checkpoint
    # (``is_action_risk`` with ``failed_idx is None``). After D-187-01's hoist the
    # checkpoint is not a member of ``phase.validators``, so there IS no validator index
    # and saying so is honest. This is a DELIBERATE governance-ledger shape change, not
    # an oversight: the key stays PRESENT so there is exactly one row shape per
    # ``event_type`` — two shapes for one event type is worse than an honest null — and
    # every pre-187 row keeps its int. No new ``event_type`` is introduced; the
    # ``harness_audit`` CHECK is a closed list of 23 values and this phase ships zero
    # migrations (``BUG-260731-02`` is the precedent where an unlisted kind killed a run).
    receipt_metadata = {
        "phase": phase.slug,
        "validator": failed_idx,
        "choice": choice,
        "finding": error_message,
    }
    # WR-08: note the v1 honest cut on a version-ambiguity approval — the user
    # approved continuing with UNFILTERED retrieval (version-scoped narrowing is
    # not yet implemented), so the receipt must not assert that semantic.
    if (error_message or "").startswith("freshness:version_ambiguity|"):
        receipt_metadata["version_ambiguity_v1_cut"] = (
            "honest Proceed/Abort — version-scoped retrieval not yet implemented; "
            "Proceed continues with unfiltered retrieval"
        )
    try:
        await write_audit(
            pool, run_id, user_id=_audit_user_id,
            event_type="validator_ask_user_approved",
            metadata=receipt_metadata,
        )
    except Exception:  # noqa: BLE001 — a receipt write must never strand the approved run
        logger.warning(
            "ask_user disposition: validator_ask_user_approved receipt write failed run=%s",
            run_id,
        )

    if is_pre:
        return None  # signal: run the body (the user approved running despite the finding)
    # ── Phase 295 (D-48) — AN AUTHOR'S PROCEED IS NOT THE ENGINE'S PROOF ────────────────────
    # ``run_gates`` is first-failure-wins, so an author's failing post gate HID the engine
    # citations gate behind it: a Proceed here used to complete an output the engine gate never
    # saw. That gate now runs on the produced output first; on failure it pauses (or, for an
    # outage, fails) exactly as it would have on its own.
    _engine_outcome = await _engine_gate_after_proceed(
        phase, failed_idx, produced_output, run_id=run_id, pool=pool, redis=redis, ctx=ctx,
        _audit_user_id=_audit_user_id, stream_run_id=stream_run_id,
    )
    if _engine_outcome is not None:
        return _engine_outcome
    return PhaseOutcome("completed", produced_output, None, None)


# ── Phase 295: the durable engine ask ────────────────────────────────────────────────────────
#
# D-01 / D-18 / D-37. The two asks the ENGINE owns — the citations gate it appends to a detected
# KB step (``grounding.effective_phase``) and the armed action-risk approval — no longer block
# in-process on the 085 ask channel. They pause the run DURABLY, the human-step way:
# ``pause_run`` → the produced output stashed on the active phase row → the prompt row →
# ``policy_applied`` → the ``ask_user_prompt`` emit → ``PhaseOutcome("pause_run")``. The shipped
# pause arm in ``harness_engine.run_workflow`` does the rest, and the answer comes back on a
# re-drive (``ctx.resume_answered_tool_call_id``) that ``consume_engine_answer`` reads.
#
# ⚠ WHY THE ORDER IS LOAD-BEARING (RESEARCH Pattern 4).
#   * ``pause_run`` FIRST: ``_redrive_paused_workflow_run`` requires ``status='paused'``, so an
#     answer arriving between the emit and a later status write would be durable with nobody
#     re-driving it. ``pause_run`` also releases the claim lease (D-50 / Pitfall 1).
#   * the STASH before the prompt row: the moment a card exists it can be answered, and the
#     re-drive needs the stash to resolve the answer.
#   * the prompt row is FAIL-CLOSED (D-50 / Pitfall 4): it is the only way back in, so a paused
#     run without it is a dead end. An insert failure ends the step with words instead.
#   * ``timeout_seconds`` is ``None`` on the row AND the emit (D-37): no deadline, no countdown,
#     so "the answer window has passed" can never be said at second 0 (Pitfall 5).
#
# ⚠ NO NEW AUDIT KIND (test_audit_event_registration.py). The pause writes the existing
# ``policy_applied`` with ``policy: "engine_ask_pause"`` and the finding, beside the arm's own
# ``human_gate_pause`` row.
#
# ⚠ THE WORDS ARE SERVER-BUILT (D-02, UI-SPEC A.2). The card renders them and composes nothing;
# no prompt, option or reason here may carry a validator code (the never-say list).

ENGINE_CHOICE_SEARCH = "Search another folder"
ENGINE_CHOICE_CONTINUE = "Continue without sources"
ENGINE_CHOICE_STOP = "Stop the run"
ENGINE_ASK_POLICY = "engine_ask_pause"

#: The decline label the armed pair presents (``_ask_user_choices_from_finding``'s second item).
_ACTION_RISK_DECLINE_CHOICE = "Do not run it"

_HOW_SHOULD_IT_CONTINUE = "How should the run continue?"
_LOCKED_ADDENDUM = "This step is set to Must prove it, so it can't continue without sources."
_ONLY_STOP_LEFT = (
    "No other folder is available to search, and this step is set to Must prove it, so the "
    "run stopped."
)
_CANNOT_ASK = "The run could not keep this question for you, so it stopped here."

#: A bound on how many folders one pause offers (each candidate is checked by the shipped
#: acceptance rule, which reads the folder tree).
_FOLDER_OPTION_CAP = 50


def classify_engine_choice(label) -> str | None:
    """The engine-ask allow-list: an EXACT presented label → its meaning, anything else → None.

    Exact equality, never casefold or prefix (the T-185-04-01 ruling): an answer the engine
    cannot read as one of its own labels is not that choice.
    """
    return {
        ENGINE_CHOICE_SEARCH: "search",
        ENGINE_CHOICE_CONTINUE: "continue",
        ENGINE_CHOICE_STOP: "stop",
        _ACTION_RISK_APPROVE_CHOICE: "approve",
        _ACTION_RISK_DECLINE_CHOICE: "decline",
    }.get(label)


def is_locked(phase) -> bool:
    """D-36: the author's stored ``grounding_escalated`` bit, read DIRECTLY.

    Never through ``grounding_cause``: on a KB step that always reads ``detected`` (detection
    wins), so it cannot say whether the author asked this step to prove itself.
    """
    return bool(getattr(phase, "grounding_escalated", False))


def finding_from_output(output) -> str:
    """The citations finding from the keys the validator reads (RESEARCH Pattern 3).

    ``retrieval_error``, or an errored sub-agent (295-REVIEW WR-01) → ``"outage"``; no
    ``citations`` → ``"no_sources"``; else ``"no_markers"``. The validator's messages are
    never sniffed.
    """
    out = output if isinstance(output, dict) else {}
    if out.get("retrieval_error") or out.get("sub_agent_status") == "error":
        return "outage"
    if not out.get("citations"):
        return "no_sources"
    return "no_markers"


def _finding_sentence(finding: str, *, step_label: str, folder_label: str) -> str:
    """The first sentence of the prompt (UI-SPEC A.2)."""
    if finding == "no_sources":
        return f"Searched {folder_label} and found nothing for “{step_label}”."
    return f"“{step_label}” answered without citing its sources in {folder_label}."


def compose_engine_choices(
    finding: str, *, step_label: str, folder_label: str, locked: bool, folders: list
) -> tuple[str, list[str]]:
    """The server-built prompt and the options, in the fixed order (UI-SPEC A.2).

    ``Search another folder`` only for 0 sources with at least one permitted folder (D-38);
    ``Continue without sources`` only when the step is not locked (D-36); ``Stop the run``
    always. An absent option is removed, never blanked.
    """
    parts = [_finding_sentence(finding, step_label=step_label, folder_label=folder_label)]
    if locked:
        parts.append(_LOCKED_ADDENDUM)
    parts.append(_HOW_SHOULD_IT_CONTINUE)
    options: list[str] = []
    if finding == "no_sources" and folders:
        options.append(ENGINE_CHOICE_SEARCH)
    if not locked:
        options.append(ENGINE_CHOICE_CONTINUE)
    options.append(ENGINE_CHOICE_STOP)
    return " ".join(parts), options


def _golden_reason(finding: str, *, step_label: str, folder_label: str) -> str:
    """D-07: a trial run never pauses and never auto-continues; it stops with the finding."""
    if finding == "no_sources":
        return (
            f"Searched {folder_label} and found nothing for “{step_label}” during the trial "
            "run, so it was stopped. Add documents to that folder, or point the step at a "
            "folder that has them."
        )
    return (
        f"“{step_label}” answered without citing its sources in {folder_label} during the "
        "trial run, so it was stopped."
    )


def _step_label(phase) -> str:
    """``{step}``: the step's human title, else its slug (UI-SPEC A.2)."""
    from app.services.harness.publish_service import _clean_label  # noqa: PLC0415

    return _clean_label(getattr(phase, "name", None)) or str(getattr(phase, "slug", "") or "")


def _folder_depth(folder_id: str, by_id: dict) -> int:
    """Depth from the parent chain over the visible folders (cycle-guarded)."""
    depth, seen, cur = 0, {folder_id}, by_id.get(folder_id)
    while cur is not None:
        parent = cur.get("parent_id")
        parent = str(parent) if parent is not None else None
        if parent is None or parent in seen or parent not in by_id:
            break
        seen.add(parent)
        depth += 1
        cur = by_id.get(parent)
    return depth


async def permitted_folder_options(
    definition, *, phase, searched_ids, supabase, user_id
) -> list[dict]:
    """The folders "Search another folder" may offer — D-03 / D-39, never a second rule.

    A candidate ``F`` is offered iff:
      * ``scope.resolve_run_scope_root(definition, run_inputs={"folder_id": F}, ...)`` returns
        ``F`` — the SAME acceptance rule a per-run override already obeys (the owner gate, and
        for a scoped definition the author-subtree containment + per-phase intersection);
      * it is not already searched, and its effective search for THIS step (its subtree,
        narrowed by the step's own ``folder_scope``) is not a subset of what was searched;
      * it has a name (a nameless row is dropped, never rendered blank).

    An unbound definition (``project_folder_id`` None) searches the whole knowledge base, so
    another folder cannot widen anything and none is offered. Returns ``[{id, name, depth}]``.
    """
    if definition is None or getattr(definition, "project_folder_id", None) is None:
        return []
    if supabase is None or not user_id:
        return []
    from app.services.harness import scope as _scope  # noqa: PLC0415
    from app.services.harness.publish_service import _clean_label  # noqa: PLC0415
    from app.utils.folder_utils import fetch_visible_folders  # noqa: PLC0415

    visible = await fetch_visible_folders(supabase, str(user_id))
    by_id = {str(f.get("id")): f for f in visible if f.get("id") is not None}
    searched = {str(x) for x in (searched_ids or [])}
    step_scope = {str(x) for x in (getattr(getattr(phase, "config", None), "folder_scope", None) or [])}

    out: list[dict] = []
    for fid, row in by_id.items():
        if len(out) >= _FOLDER_OPTION_CAP:
            break
        name = _clean_label(row.get("name"))
        if not name or fid in searched:
            continue
        accepted = await _scope.resolve_run_scope_root(
            definition, run_inputs={"folder_id": fid}, thread_folder_id=None,
            supabase=supabase, user_id=str(user_id),
        )
        if accepted is None or str(accepted) != fid:
            continue
        subtree = await _scope.resolve_project_subtree(
            fid, supabase=supabase, user_id=str(user_id)
        ) or [fid]
        effective = {str(x) for x in subtree}
        if step_scope:
            effective &= step_scope
        if not effective or effective <= searched:
            continue
        out.append({"id": fid, "name": name, "depth": _folder_depth(fid, by_id)})
    return out


def _searched_ids(ctx, phase) -> list[str] | None:
    """What this step searched: the run's resolved subtree, narrowed by the step's scope."""
    proj = getattr(ctx, "folder_subtree_ids", None)
    step_scope = getattr(getattr(phase, "config", None), "folder_scope", None)
    if proj is None:
        return None
    if step_scope:
        keep = {str(x) for x in step_scope}
        return [str(f) for f in proj if str(f) in keep]
    return [str(f) for f in proj]


def _searched_label(ctx, phase, default: str) -> str:
    """The folder words: a folder chosen on an earlier answer, else the bound folder's name."""
    labels = getattr(ctx, "phase_scope_label", None) or {}
    return labels.get(getattr(phase, "slug", None)) or default


async def engine_pause(
    phase,
    *,
    kind: str,
    error_message: str,
    produced_output: dict | None,
    failed_idx: int | None,
    run_id: UUID,
    pool,
    redis,
    ctx,
    _audit_user_id: UUID | None,
    stream_run_id: UUID | None = None,
) -> PhaseOutcome:
    """Pause the run durably on an engine-owned ask (RESEARCH Pattern 4). See the banner above.

    ``kind`` is ``"no_sources"`` / ``"no_markers"`` (the citations gate) or ``"action_risk"``
    (the armed approval, whose prompt is the sentence after ``_ACTION_RISK_FINDING_PREFIX``).
    """
    from uuid import uuid4

    step_label = _step_label(phase)
    slug = getattr(phase, "slug", None)
    definition = getattr(ctx, "definition", None)
    draft = None
    if kind == "action_risk":
        prompt = (error_message or "").split("|", 1)[-1]
        options = _ask_user_choices_from_finding(error_message)
        locked, continue_allowed, folders = False, False, []
        stop_reason = None
    else:
        folder_label = _searched_label(ctx, phase, await resolve_kb_label(pool, definition))
        if getattr(ctx, "is_golden_run", False):
            return PhaseOutcome("fail_run", None, None, _golden_reason(
                kind, step_label=step_label, folder_label=folder_label,
            ))
        locked = is_locked(phase)
        folders = []
        if kind == "no_sources":
            folders = await permitted_folder_options(
                definition, phase=phase, searched_ids=_searched_ids(ctx, phase),
                supabase=getattr(ctx, "supabase", None),
                user_id=(getattr(ctx, "current_user", None) or {}).get("id"),
            )
        prompt, options = compose_engine_choices(
            kind, step_label=step_label, folder_label=folder_label, locked=locked,
            folders=folders,
        )
        finding_words = _finding_sentence(kind, step_label=step_label, folder_label=folder_label)
        if options == [ENGINE_CHOICE_STOP]:
            # UI-SPEC "decided 1": a question with one answer is a dead end with a click.
            return PhaseOutcome("fail_run", None, None, f"{finding_words} {_ONLY_STOP_LEFT}")
        continue_allowed = ENGINE_CHOICE_CONTINUE in options
        if kind == "no_sources":
            stop_reason = finding_words
        else:
            stop_reason = f"“{step_label}” answered without citing its sources."
        if isinstance(produced_output, dict) and isinstance(produced_output.get("text"), str):
            draft = produced_output.get("text") or None

    supabase = getattr(ctx, "supabase", None)
    thread_id = getattr(ctx, "thread_id", None)
    cannot_ask = PhaseOutcome("fail_run", None, None, f"“{step_label}” needed your answer. {_CANNOT_ASK}")
    if redis is None or run_id is None or pool is None or supabase is None or not thread_id:
        return cannot_ask
    active = await get_active_phase(pool, run_id)
    if not active or active.get("slug") != slug:
        return cannot_ask

    tool_call_id = uuid4().hex
    engine_payload = {
        "kind": kind,
        "phase": slug,
        "continue_allowed": continue_allowed,
        "locked": locked,
        "folders": folders,
    }
    awaiting = {
        "tool_call_id": tool_call_id,
        "kind": kind,
        "phase": slug,
        "options": options,
        "continue_allowed": continue_allowed,
        "locked": locked,
        "folder_option_ids": [f["id"] for f in folders],
        "folder_names": {f["id"]: f["name"] for f in folders},
        "produced_output": produced_output if kind != "action_risk" else None,
        "finding": error_message,
        "failed_idx": failed_idx,
        "stop_reason": stop_reason,
    }

    # 1. WRITE the pause first (and release the lease) — see the banner.
    await pause_run(pool, run_id)
    # 2. The stash the re-drive resolves the answer against (D-40).
    try:
        await stash_awaiting_answer(pool, active["id"], awaiting)
    except Exception:  # noqa: BLE001 — fail closed: a pause nobody can consume is a dead end
        logger.exception("engine ask: stash failed run=%s phase=%s", run_id, slug)
        return cannot_ask
    # 3. The durable prompt row — FAIL-CLOSED (D-50).
    tool_call = {
        "kind": "ask_user_prompt",
        "tool_call_id": tool_call_id,
        "prompt": prompt,
        "options": options,
        "timeout_seconds": None,
        "run_id": str(run_id),
        "engine_pause": engine_payload,
    }
    if draft:
        tool_call["draft"] = draft
    current_user = getattr(ctx, "current_user", None) or {}
    try:
        from app.utils.db import aexec  # noqa: PLC0415

        await aexec(
            supabase.table("messages").insert(
                {
                    "thread_id": thread_id,
                    "user_id": current_user.get("id"),
                    "role": "system",
                    "content": prompt,
                    # CTX-01 (T-120-04): an engine ask is a workflow row.
                    "origin": "harness",
                    "tool_calls": [tool_call],
                }
            )
        )
    except Exception:  # noqa: BLE001
        logger.exception("engine ask: prompt row insert failed run=%s tcid=%s", run_id, tool_call_id)
        return cannot_ask
    # 4. The ledger: the existing kind, the policy named (no new audit kind).
    try:
        await write_audit(
            pool, run_id, user_id=_audit_user_id,
            event_type="policy_applied",
            metadata={"policy": ENGINE_ASK_POLICY, "phase": slug, "finding": kind},
        )
    except Exception:  # noqa: BLE001 — the pause is already durable
        logger.warning("engine ask: policy_applied write failed run=%s", run_id)
    # 5. The live card (best-effort: /pending replays the row on any reconnect).
    _stream_id = getattr(ctx, "producer_run_id", None) or stream_run_id or run_id
    emit = getattr(ctx, "emit", None) or _emit
    try:
        await emit(
            redis, _stream_id, "ask_user_prompt",
            tool_call_id=tool_call_id,
            prompt=prompt,
            options=options,
            timeout_seconds=None,
            engine_pause=engine_payload,
            draft=draft,
        )
    except Exception:  # noqa: BLE001
        logger.exception("engine ask: ask_user_prompt emit failed run=%s", run_id)
    # 6. The shipped pause arm does the rest.
    return PhaseOutcome("pause_run", None, None, f"Waiting for your answer on “{step_label}”.")


# ── Phase 295: consuming the answer on the re-drive (RESEARCH Pattern 5) ─────────────────────
#
# The single-use key is ``ctx.resume_answered_tool_call_id``, set ONLY by the answer route's
# re-drive (``api/runs.py``) and by the boot sweep for an answered engine ask. It is consumed
# here ONLY when the active phase row's ``_awaiting_answer.tool_call_id`` equals it; otherwise
# it is left untouched for the human-step executor (``human_input.py``), which reads the same
# flag. Answers resolve through an EXACT-label allow-list over the options the prompt row
# stored — never ``_is_abort_choice``'s deny-list — so an answer the engine cannot read as one
# of its own labels never proceeds.

_UNOFFERED_CHOICE = "That choice is not one this question offers."
_UNOFFERED_FOLDER = "That folder is not one this question offers."


def resolve_engine_label(options, response_text, choice_index) -> str | None:
    """The presented label an answer names, or None. A click sends the label AND its index;
    a forged pair (label ≠ options[index]) is unmatched, and so is any text not offered."""
    opts = [str(o) for o in (options or [])]
    text = (response_text or "").strip()
    if choice_index is not None:
        try:
            ci = int(choice_index)
        except (TypeError, ValueError):
            return None
        if not 0 <= ci < len(opts):
            return None
        return opts[ci] if (not text or text == opts[ci]) else None
    return text if text in opts else None


def engine_answer_refusal(prompt_tool_call, *, response_text, choice_index, folder_id) -> str | None:
    """The answer route's allow-list (T-295-03-01 / -02): plain words to refuse with, or None.

    A prompt without ``engine_pause`` is not an engine ask and is never refused here.
    """
    pause = (prompt_tool_call or {}).get("engine_pause")
    if not isinstance(pause, dict):
        return None
    label = resolve_engine_label(prompt_tool_call.get("options"), response_text, choice_index)
    wants_continue = label == ENGINE_CHOICE_CONTINUE or (
        (response_text or "").strip() == ENGINE_CHOICE_CONTINUE
    )
    if pause.get("locked") and wants_continue:
        return _LOCKED_ADDENDUM
    if label is None:
        return _UNOFFERED_CHOICE
    offered = {str(f.get("id")) for f in (pause.get("folders") or []) if isinstance(f, dict)}
    if label == ENGINE_CHOICE_SEARCH:
        return None if folder_id is not None and str(folder_id) in offered else _UNOFFERED_FOLDER
    return None if folder_id is None else _UNOFFERED_FOLDER


def _locked_now(ctx, phase) -> bool:
    """D-05: re-check the lock against the RUN's definition at consume time."""
    definition = getattr(ctx, "definition", None)
    for spec in getattr(definition, "phases", None) or []:
        if getattr(spec, "slug", None) == getattr(phase, "slug", None):
            return is_locked(spec)
    return is_locked(phase)


async def _person_words(pool, ctx) -> str:
    """Who answered, for a STORED reason: the shared name chain, called without the email
    (a reason is read by colleagues too) — display name, else "the person who started this
    run". Lazy import of the one chain (``api/workflow_runs.waiting_who``)."""
    from app.api.workflow_runs import waiting_who  # noqa: PLC0415

    user_id = (getattr(ctx, "current_user", None) or {}).get("id")
    display = None
    if pool is not None and user_id:
        try:
            display = await pool.fetchval(
                "SELECT display_name FROM profiles WHERE id = $1",
                user_id if isinstance(user_id, UUID) else UUID(str(user_id)),
            )
        except Exception:  # noqa: BLE001 — a name is words, never a reason to fail
            display = None
    return waiting_who(is_owner=False, display_name=display, viewer_email=None)


async def _write_receipt(pool, run_id, _audit_user_id, metadata: dict) -> None:
    try:
        await write_audit(
            pool, run_id, user_id=_audit_user_id,
            event_type="validator_ask_user_approved",
            metadata=metadata,
        )
    except Exception:  # noqa: BLE001 — a receipt write must never strand the answered run
        logger.warning("engine ask: validator_ask_user_approved receipt write failed run=%s", run_id)


def _grant_engine_approval(ctx, slug, tool_call_id) -> None:
    approvals = dict(getattr(ctx, "engine_ask_approved", None) or {})
    approvals[slug] = str(tool_call_id)
    try:
        ctx.engine_ask_approved = approvals
    except Exception:  # noqa: BLE001
        logger.debug("engine ask: could not record the consumed approval", exc_info=True)


def _take_engine_approval(ctx, phase) -> bool:
    """Single-use: an approval consumed on THIS re-drive lets the armed checkpoint run the
    body ONCE without asking again (no second prompt row)."""
    approvals = dict(getattr(ctx, "engine_ask_approved", None) or {})
    slug = getattr(phase, "slug", None)
    if slug not in approvals:
        return False
    approvals.pop(slug, None)
    try:
        ctx.engine_ask_approved = approvals
    except Exception:  # noqa: BLE001
        pass
    return True


def _set_scope_override(ctx, slug, subtree: list, name: str) -> None:
    overrides = dict(getattr(ctx, "phase_scope_override", None) or {})
    labels = dict(getattr(ctx, "phase_scope_label", None) or {})
    overrides[slug] = list(subtree)
    labels[slug] = name
    ctx.phase_scope_override = overrides
    ctx.phase_scope_label = labels


async def consume_engine_answer(
    phase,
    ctx,
    *,
    run_id: UUID,
    pool,
    redis,
    _audit_user_id: UUID | None,
    stream_run_id: UUID | None = None,
) -> PhaseOutcome | None:
    """Resolve an answered engine ask at the top of ``_run_phase_with_gates`` (re-drive only).

    Returns ``None`` when there is nothing to consume (no flag, or the flag is another
    question's — left untouched), and also when the step must RUN: a folder answer (the body
    re-runs once over that folder) or an armed approval (the checkpoint then runs the body once
    without asking). Otherwise a terminal-or-waiting outcome:

      * Continue without sources (offered, and still unlocked) → ``completed`` with the stashed
        output UNCHANGED plus ONE field ``unsourced = {continued_by, at}`` (D-04);
      * Stop the run → ``fail_run`` naming the finding and the person (D-02);
      * the armed decline (or an answer that is not the approval) → ``fail_run`` naming the
        person and the step, without the armed prompt sentence (D-42);
      * no durable answer, or an answer the allow-list cannot match → ``pause_run``: the run
        stays paused and nothing proceeds.
    """
    tcid = getattr(ctx, "resume_answered_tool_call_id", None)
    if not tcid or pool is None or run_id is None:
        return None
    active = await get_active_phase(pool, run_id) or {}
    output = active.get("output")
    if isinstance(output, str):
        try:
            output = json.loads(output)
        except ValueError:
            output = None
    awaiting = output.get("_awaiting_answer") if isinstance(output, dict) else None
    slug = getattr(phase, "slug", None)
    if (
        not isinstance(awaiting, dict)
        or str(awaiting.get("tool_call_id")) != str(tcid)
        or active.get("slug") != slug
    ):
        return None  # not this step's engine ask: the human executor keeps the flag
    try:
        ctx.resume_answered_tool_call_id = None
    except Exception:  # noqa: BLE001 — a frozen ctx must not sink the phase
        logger.debug("engine ask: could not clear the resume flag", exc_info=True)

    step_label = _step_label(phase)
    waiting = PhaseOutcome("pause_run", None, None, f"Waiting for your answer on “{step_label}”.")
    answer = await get_ask_user_response(pool, run_id, str(tcid))
    if answer is None:
        return waiting
    label = resolve_engine_label(
        awaiting.get("options"), answer.get("response_text"), answer.get("choice_index"),
    )
    meaning = classify_engine_choice(label)
    kind = awaiting.get("kind")

    if kind == "action_risk":
        if meaning == "approve":
            _grant_engine_approval(ctx, slug, tcid)
            return None
        if meaning == "decline":
            person = await _person_words(pool, ctx)
            return PhaseOutcome(
                "fail_run", None, None,
                f"{person} chose not to run “{step_label}”, so the run stopped.",
            )
        return PhaseOutcome(
            "fail_run", None, None,
            f"“{step_label}” was not run: the answer did not match the approval option, so "
            "the run stopped.",
        )

    receipt = {
        "phase": slug,
        "validator": awaiting.get("failed_idx"),
        "choice": label,
        "finding": kind,
    }
    if meaning == "stop":
        person = await _person_words(pool, ctx)
        lead = awaiting.get("stop_reason") or f"“{step_label}” found nothing to cite."
        return PhaseOutcome("fail_run", None, None, f"{lead} Stopped by {person}.")
    if meaning == "continue" and awaiting.get("continue_allowed"):
        if _locked_now(ctx, phase):
            logger.info("engine ask: continue refused at consume, %s is locked now", slug)
            return PhaseOutcome(
                "fail_run", None, None,
                f"“{step_label}” is set to Must prove it, so it can't continue without "
                "sources. The run stopped.",
            )
        from datetime import datetime, timezone  # noqa: PLC0415

        user_id = (getattr(ctx, "current_user", None) or {}).get("id") or _audit_user_id
        produced = dict(awaiting.get("produced_output") or {})
        produced["unsourced"] = {
            "continued_by": str(user_id),
            "at": datetime.now(timezone.utc).isoformat(),
        }
        await _write_receipt(pool, run_id, _audit_user_id, {**receipt, "unsourced": True})
        return PhaseOutcome("completed", produced, None, None)
    if meaning == "search":
        folder_id = answer.get("folder_id")
        offered = [str(f) for f in (awaiting.get("folder_option_ids") or [])]
        if folder_id is not None and str(folder_id) in offered:
            from app.services.harness import scope as _scope  # noqa: PLC0415

            user_id = (getattr(ctx, "current_user", None) or {}).get("id") or _audit_user_id
            subtree = await _scope.resolve_project_subtree(
                str(folder_id), supabase=getattr(ctx, "supabase", None), user_id=str(user_id),
            ) or [str(folder_id)]
            name = (awaiting.get("folder_names") or {}).get(str(folder_id)) or "the chosen folder"
            _set_scope_override(ctx, slug, [str(x) for x in subtree], name)
            await _write_receipt(pool, run_id, _audit_user_id, {**receipt, "folder_id": str(folder_id)})
            return None
    logger.warning(
        "engine ask: an answer the allow-list cannot match on %s (run %s) — left paused",
        slug, run_id,
    )
    return waiting


async def _engine_gate_after_proceed(
    phase,
    failed_idx: int | None,
    produced_output,
    *,
    run_id: UUID,
    pool,
    redis,
    ctx,
    _audit_user_id: UUID | None,
    stream_run_id: UUID | None = None,
) -> PhaseOutcome | None:
    """D-48: after an author's post ``ask_user`` Proceed, evaluate the ENGINE citations gate
    (the single spec ``effective_phase`` appended) on the produced output.

    ``None`` = no engine gate on this step, the gate was the one that failed (it is never asked
    twice), or it passes. Otherwise the gate's own disposition: an outage fails with the shipped
    route (D-06); 0 sources / 0 markers pause durably through ``engine_pause``.
    """
    from app.services.harness.grounding import is_engine_citation_gate  # noqa: PLC0415
    from app.services.harness.validators import VALIDATOR_REGISTRY  # noqa: PLC0415

    validators = list(getattr(phase, "validators", None) or [])
    gate_idx = len(validators) - 1
    if gate_idx < 0 or gate_idx == failed_idx or not is_engine_citation_gate(phase, gate_idx):
        return None
    validator = VALIDATOR_REGISTRY.get(validators[gate_idx].kind)
    output = produced_output if isinstance(produced_output, dict) else {}
    result = await validator(output, validators[gate_idx].config, ctx)
    if result.passed:
        return None
    finding = finding_from_output(output)
    if finding == "outage":
        return _route_on_failure(phase, result.error_message, 0, gate_idx)
    return await engine_pause(
        phase, kind=finding, error_message=result.error_message, produced_output=output,
        failed_idx=gate_idx, run_id=run_id, pool=pool, redis=redis, ctx=ctx,
        _audit_user_id=_audit_user_id, stream_run_id=stream_run_id,
    )

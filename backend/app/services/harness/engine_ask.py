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
import logging
from collections import namedtuple
from uuid import UUID

from app.config import settings
from app.db.workflows import write_audit
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
            # fail_run / skip_to_phase — the sync mapper handles it byte-identical.
            return _route_on_failure(
                phase, error_message, attempt, failed_idx, reason_is_final=reason_is_final
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
    return PhaseOutcome("completed", produced_output, None, None)

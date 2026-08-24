"""The ``llm_human_input`` phase executor — the run's human gate.

EXTRACTED FROM ``app.services.harness.phase_types`` on 2026-08-19 (Phase 200 /
D-13) to discharge the G-5 obligation recorded for that file in ``CLAUDE.md``'s
hot-file ledger, and — deliberately — **as the vehicle for its own fix**: the D-10
pause lands in the commit AFTER this one, inside this module, so the extraction and
the behaviour change stay independently attributable.

The bodies below are a **VERBATIM move**, not a rewrite. The cut was driven by a
script that asserted the pre-move line boundaries first and aborted on drift
(``_exec_llm_human_input`` measured 129 lines at ``phase_types.py:822-950``;
``_latest_phase_text`` 11 lines at ``:1788-1798``) — CONTEXT's own pointers were
~54 lines stale and wave 2 moved them again, so no number was trusted.

⚠ CONSUMERS WERE DELIBERATELY NOT REPOINTED, AND THAT IS THE POINT OF THE MOVE'S
SAFETY. ``phase_types.py`` re-imports both names, so ``PHASE_TYPE_REGISTRY_ENTRIES``'
entry stays CHARACTER-IDENTICAL and ``_external_action_inputs``' call to
``_latest_phase_text`` stays byte-identical. There is ONE object, not two::

    app.services.harness.phase_types._exec_llm_human_input
        is app.services.harness.human_input._exec_llm_human_input

⚠ THE RE-IMPORT IS LOAD-BEARING AND MUST NOT BE "TIDIED" AWAY — the precedent's
own red line (``app.api.threads`` → ``app.services.run_transport``, 2026-08-17).

⚠ ``_latest_phase_text`` HAS TWO CALLERS, NOT ONE. RESEARCH §B9 measured ``grep -c``
→ 2 (the def plus one call) and concluded "used only here"; at HEAD it is **3** —
``_exec_llm_human_input`` AND ``_external_action_inputs`` (the 189 executor) both
call it. Moving it is still right (it is *this* phase's helper and the new module
would otherwise need an edge back), and the second caller keeps working through the
same re-import. The stale grep is recorded rather than quietly corrected, because
"used only here" is exactly the kind of claim that decides an extraction's shape.

⚠ THE HONEST LEAF INVARIANT, STATED AT ITS REAL STRENGTH. True leaf-ness is NOT
achievable for this cut — the moved function needs ``settings``,
``subscribe_for_response`` and ``aexec``. So the binding invariant is the weaker,
true one: **this module must never import ``phase_types`` back.** That is the cycle
that actually exists; anything else would be an aspiration dressed as a rule.

⚠ AND THE PATCH SURFACE MOVED WITH THE FUNCTION. ``subscribe_for_response`` is bound
as a module GLOBAL here, so a test that patched ``phase_types.subscribe_for_response``
now patches a name the executor no longer reads. Nine such sites across five shipped
test files were repointed in the extraction commit — measured RED first, so the
consequence is recorded rather than assumed.
"""
from __future__ import annotations

import asyncio
import logging
from uuid import UUID, uuid4

from app.config import settings
from app.services.ask_user_service import subscribe_for_response

logger = logging.getLogger(__name__)

__all__ = ["HumanInputTimeout", "_exec_llm_human_input", "_latest_phase_text"]


class HumanInputTimeout(Exception):
    """The human gate's wait elapsed with NO answer — the run must PAUSE (D-10).

    ⚠ IT IS DELIBERATELY **NOT** AN ``asyncio.CancelledError``, AND THAT IS THE WHOLE
    DESIGN. The shutdown branch below raises ``CancelledError`` on purpose, but outside a
    graceful shutdown that same raise reaches ``run_workflow``'s escape handler, which
    (i) calls ``_expire_pending_ask_user`` — **killing the very prompt the person is
    meant to answer** — and (ii) calls ``cancel_phase``, flipping the step to
    ``cancelled``. A paused run whose spine shows the human step as *Stopped* is the
    warning sign. Both are exactly wrong for a pause, so this needs its own type and its
    own arm.

    It is caught in ``_run_phase_with_gates`` — **BEFORE** the escape handler can see it
    — and mapped to ``PhaseOutcome("pause_run", …)``.

    ⚠ ``fail_phase`` WAS OFFERED AND REJECTED (D-10): it discards completed upstream
    work, so stepping away for six minutes would mean losing the run rather than
    resuming it.
    """

    def __init__(self, *, tool_call_id: str, timeout_seconds) -> None:
        self.tool_call_id = tool_call_id
        self.timeout_seconds = timeout_seconds
        super().__init__(
            f"no answer after {timeout_seconds}s — the run is paused and stays "
            f"resumable (tool_call_id={tool_call_id})"
        )


def _resolve_answer_text(response_text, choice_index, options) -> str:
    """Resolve a durable answer payload to the text the workflow advances on.

    ⚠ A DELIBERATE STRUCTURAL MIRROR OF THE SHIPPED BLOCK INSIDE THE EXECUTOR, NOT A
    REPLACEMENT FOR IT. The BUG-260607-01 defense below (a choice-click arrives as
    ``{response_text: "", choice_index: N}`` and must resolve ``options[N]``) is pinned
    both by ``tests/test_200_human_input_baseline.py`` and by
    ``tests/unit/test_185_engine_attachment.py``'s CRITERION 20, which asserts the
    literal ``answer = ""`` still appears in ``_exec_llm_human_input``'s own source.
    Folding the live path into this helper would move that line out of the function and
    turn a shipped fence red for a refactor, so the live block stays byte-identical and
    this serves the RESUME path only.
    """
    answer = (response_text or "").strip()
    if not answer and options:
        try:
            _ci = int(choice_index)
            if 0 <= _ci < len(options):
                answer = str(options[_ci])
        except (TypeError, ValueError):
            pass
    return answer



async def _exec_llm_human_input(phase, accumulated_outputs: dict, ctx) -> dict:
    """Pause for human input via the ask_user pub/sub flow, block on the answer.

    Reuses the ask_user substrate ordering (SUBSCRIBE → advertise → durable prompt
    row → emit → block) so Plan 04's resume can re-subscribe against the same
    ``tool_call_id``. The per-call timeout is clamped to the 1800s hard cap
    (``settings.ask_user_max_timeout_seconds``). The durable prompt row + tool_call_id
    are stored in the output so resume can find the pending prompt.
    """
    run_id: UUID = getattr(ctx, "run_id", None)
    redis = getattr(ctx, "redis", None)
    tool_call_id = uuid4().hex
    prompt = phase.config.prompt
    options = list(phase.config.options)
    timeout_seconds = min(
        phase.config.timeout_seconds, settings.ask_user_max_timeout_seconds
    )
    # ── 200.3 (SEED-164 / D-01) — GOLDEN RUN AUTO-CONTINUES WITHOUT BLOCKING ──────
    # A publish validation golden run has no interactive user watching the screen to
    # click or answer. Mock the response with the first choice (or "Approved") so the
    # workflow can validate end-to-end and pass the publish gauntlet.
    if getattr(ctx, "is_golden_run", False):
        default_answer = options[0] if options else "Approved"
        logger.info(
            "llm_human_input: golden run auto-continued with answer %r (tool_call_id=%s)",
            default_answer,
            tool_call_id,
        )
        return {
            "text": prompt,
            "answer": default_answer,
            "tool_call_id": tool_call_id,
            "_golden_run_mock": True,
        }

    # ── 200 (D-10) — A RE-DRIVE CONSUMES THE DURABLE ANSWER; IT DOES NOT RE-ASK ──
    #
    # ⚠ WITHOUT THIS BRANCH THE ANSWER-TRIGGERED RE-DRIVE WOULD ASK THE QUESTION AGAIN,
    # and D-10's own sentence ("Answering later still resumes; nothing is discarded")
    # would be false in a NEW way rather than a fixed one. This executor mints a fresh
    # ``uuid4().hex`` on every entry (above) and blocks on that brand-new channel, so a
    # re-run of an already-answered phase inserts a SECOND prompt row and waits again.
    # ``resume_stranded_workflows``' docstring already claimed the opposite —
    # *"let run_workflow re-run the phase, which re-reads the durable answer"* — and
    # nothing re-read it; this is the re-read.
    #
    # ⚠ IT IS SINGLE-USE AND EXPLICITLY KEYED, NEVER A "LATEST PROMPT" LOOKUP. The flag
    # carries the tool_call_id the ANSWER ROUTE just persisted, so the consume can only
    # ever resolve the question that was actually answered. Clearing it before the read
    # means a run with a SECOND llm_human_input phase asks its own question normally
    # instead of inheriting the first one's answer — the silent auto-approval this whole
    # plan exists to remove, re-introduced by a convenience lookup.
    #
    # ⚠ THE BOOT SWEEP DOES NOT SET IT, so the 096-09 restart contract is untouched:
    # ``resume_pending_prompt`` still re-subscribes and re-emits the SAME prompt there.
    _resume_tcid = getattr(ctx, "resume_answered_tool_call_id", None)
    if _resume_tcid:
        try:
            ctx.resume_answered_tool_call_id = None
        except Exception:  # noqa: BLE001 — a frozen ctx must not sink the phase
            logger.debug("llm_human_input: could not clear the resume flag", exc_info=True)
        _pool = getattr(ctx, "pool", None)
        if _pool is not None:
            from app.db.workflows import get_ask_user_response  # noqa: PLC0415

            _durable = await get_ask_user_response(_pool, run_id, str(_resume_tcid))
            if _durable is not None:
                _answer = _resolve_answer_text(
                    _durable.get("response_text"), _durable.get("choice_index"), options
                )
                logger.info(
                    "llm_human_input: consumed the durable answer on re-drive "
                    "run=%s tcid=%s", run_id, _resume_tcid,
                )
                return {
                    "text": prompt,
                    "answer": _answer,
                    "tool_call_id": str(_resume_tcid),
                }

    # D-12: the prior phase's text is the DRAFT the user is being asked to confirm
    # (the doc_qa_human flow's `draft` phase produces {"text": <answer>}). Carry it
    # through the durable prompt row + the SSE event + the /pending replay so the
    # Phase 094 frame can render "here's what I'd answer — confirm?" without
    # re-deriving it. Empty string when there is no upstream text (harmless).
    draft = _latest_phase_text(accumulated_outputs)

    # Durable prompt row (D-085-05) — Plan 04 resume re-subscribes against this
    # tool_call_id. Best-effort: a failed insert only affects the /pending replay
    # surface, not the live block-on-answer flow.
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
                        # CTX-01 (T-120-04): llm_human_input ask_user prompt — workflow row.
                        "origin": "harness",
                        "tool_calls": [
                            {
                                "kind": "ask_user_prompt",
                                "tool_call_id": tool_call_id,
                                "prompt": prompt,
                                "options": options,
                                "timeout_seconds": timeout_seconds,
                                "run_id": str(run_id),
                                # D-12: the prior phase's draft (the thing being
                                # confirmed) — additive; older rows have no draft.
                                "draft": draft,
                            }
                        ],
                    }
                )
            )
        except Exception:  # noqa: BLE001
            logger.exception(
                "llm_human_input: prompt row insert failed run=%s tcid=%s",
                run_id, tool_call_id,
            )

    # Emit the ask_user prompt so the frontend renders the question.
    # Facet B / edit #4 (092-07): this is a DIRECT executor emit (NOT an engine
    # _emit site reached by run_workflow's stream_run_id threading), so route it on
    # the PRODUCER stream transport (run:{producer}) the frontend watches — while
    # the durable prompt-row run_id VALUE (above), the subscribe_for_response
    # channel (below), and the get_pending_ask_user resume matcher all stay on
    # ctx.run_id (the workflow_run id) for live↔resume answer-channel consistency.
    _stream_id = getattr(ctx, "producer_run_id", None) or run_id
    emit = getattr(ctx, "emit", None)
    if emit is not None and redis is not None:
        try:
            await emit(
                redis, _stream_id, "ask_user_prompt",
                tool_call_id=tool_call_id,
                prompt=prompt,
                options=options,
                timeout_seconds=timeout_seconds,
                # D-12: carry the prior-phase draft on the live SSE event too, so the
                # frontend PendingAsk shape gets it without a /pending round-trip.
                draft=draft,
            )
        except Exception:  # noqa: BLE001
            logger.exception("llm_human_input: ask_user_prompt emit failed")

    # Block on the answer via the shipped subscribe helper (SUBSCRIBE → SADD →
    # block; cleanup in finally). Returns the parsed payload or None on timeout.
    payload = await subscribe_for_response(
        redis, run_id, tool_call_id, float(timeout_seconds)
    )

    # 096-09 (UAT Test 2 restart-resumability fix): a {"kind":"shutdown"} payload
    # comes ONLY from main.py's broadcast_shutdown_sentinel_to_all (graceful app
    # shutdown). For a HARNESS llm_human_input phase we must NOT complete with an
    # empty answer — that would advance/finish the workflow and lose the pending
    # question. Instead escape via CancelledError so this phase stays 'active' and
    # the durable prompt row stays pending; the boot-time resume sweep then
    # re-subscribes + re-emits the SAME prompt and blocks on the answer
    # (BUG-260605-01). The engine's cancel/escape handler skips prompt-expiry on
    # shutdown (is_app_shutting_down gate), so the prompt survives the restart.
    # Deep-mode ask_user (the dispatcher tool) is unaffected — it keeps returning
    # a normal "interrupted by server shutdown" ToolResult and finalizes.
    if payload and payload.get("kind") == "shutdown":
        raise asyncio.CancelledError(
            "llm_human_input interrupted by server shutdown — phase left active "
            "for the boot-time resume sweep (096-09)"
        )

    # ── 200 (D-10 / BUG-260816-06) — THE GATE FAILS **CLOSED** ───────────────────
    #
    # ``subscribe_for_response`` returns ``None`` on timeout, and until this line the
    # executor fell straight through to a NORMAL RETURN with ``answer: ""``:
    # ``_run_phase_with_gates`` wrapped that in ``PhaseOutcome("completed", …)``,
    # ``run_workflow`` called ``complete_phase``, and the next phase received the empty
    # string AS THE HUMAN'S ANSWER. With ``HumanInputConfig.timeout_seconds`` defaulting
    # to **300**, four of five real runs of ``doc_qa_scoped_098uat`` completed their
    # approval step with ``answer: ""`` at exactly the five-minute mark.
    #
    # **A human gate that fails OPEN is the one defect on this surface that no amount of
    # re-presentation can excuse.** Nobody answered, so nothing was approved.
    #
    # ⚠ GATED STRICTLY ON ``payload is None``, never on falsiness. A ``cancel`` payload
    # is a DIFFERENT disposition that already falls through to the shipped block below,
    # and widening this to ``if not payload`` would quietly convert a cancellation into a
    # pause — the same class of substitution this fix removes.
    if payload is None:
        raise HumanInputTimeout(
            tool_call_id=tool_call_id, timeout_seconds=timeout_seconds
        )

    answer = ""
    if payload and payload.get("kind") == "response":
        # BUG-260607-01 (same defense as the Deep dispatcher ask_user handler):
        # a choice-click answer arrives as {response_text: "", choice_index: N}
        # — resolve the chosen option text so the workflow never advances on a
        # silently-empty answer when the user actually chose.
        answer = (payload.get("response_text") or "").strip()
        if not answer and options:
            _ci = payload.get("choice_index")
            try:
                _ci = int(_ci)
                if 0 <= _ci < len(options):
                    answer = str(options[_ci])
            except (TypeError, ValueError):
                pass

    return {"text": prompt, "answer": answer, "tool_call_id": tool_call_id}


def _latest_phase_text(accumulated_outputs: dict) -> str:
    """The most-recent upstream phase's answer text — the draft an llm_human_input
    phase asks the user to confirm (D-12). Mirrors ``_collect_sub_questions``'
    reverse scan: every phase executor returns ``{"text": <answer>}``, so the
    latest non-empty ``text`` is the prior phase's output (the doc_qa_human flow's
    ``draft`` phase produces ``{"text": <answer>}`` — that is the thing being
    confirmed). Returns ``""`` when there is no upstream text (harmless)."""
    for out in reversed(list(accumulated_outputs.values())):
        if isinstance(out, dict) and isinstance(out.get("text"), str) and out["text"].strip():
            return out["text"]
    return ""

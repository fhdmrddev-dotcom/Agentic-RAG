"""What one step hands the next, and who owns a failure's words — a LEAF (Phase 295).

289-02's rule, applied: *branching lives in a helper module*, so the hot executor and engine
files (``phase_types.py``, ``harness_engine.py``, both G-5 FIRING) spend ONE call line per
concern and gain no branch. This module imports nothing from ``app`` at module level — it
reads attributes off the run ``ctx`` and the outputs it is handed, so it can never close the
harness-package import cycle. The few helpers that write (plan 295-04's run-end helpers) import
their db / engine names lazily, inside the function.
"""
from __future__ import annotations

__all__ = [
    "phase_scope_ids",
    "handoff_text",
    "claim_failure_message",
    "surface_unless_engine_owns",
    "surface_if_engine_owned",
]


def phase_scope_ids(ctx, phase):
    """The folder ids this step searches: a per-run folder override for THIS step, else the
    run's resolved project subtree.

    D-03: "Search another folder" re-runs the step once over the chosen folder's subtree,
    which ``engine_ask.consume_engine_answer`` puts on ``ctx.phase_scope_override[slug]`` (a
    LIST — Pitfall 1: a set would break the RPC's JSON param). The override lives on the ctx
    of this re-drive only; it is recorded in the approval receipt and never written to the
    definition. The step's own ``folder_scope`` intersection still applies on top, so the
    result only narrows from what the override names.
    """
    override = (getattr(ctx, "phase_scope_override", None) or {}).get(getattr(phase, "slug", None))
    return override if override is not None else getattr(ctx, "folder_subtree_ids", None)


# ── D-10 / D-11 / D-46 (BUG-261020-01): what the next MODEL reads of a prior step ───────────

#: D-11 — the one home of the unsourced note. It reaches the next model's prior-output text
#: ONLY; ``human_input._latest_phase_text`` (an external action's body, a human step's draft)
#: reads the raw ``text`` and never this (Pitfall 10).
UNSOURCED_NOTE = (
    "Note: the step that produced the text below found no sources, and a person chose to "
    "keep it without sources. It was accepted without sources and must not be presented "
    "as sourced."
)
_NO_ANSWER = "(no answer)"


def handoff_text(out) -> str | None:
    """The text a downstream model reads for ONE prior step's output, or ``None`` for nothing.

    * A human step (``answer`` present AND a ``tool_call_id``, the shape every
      ``llm_human_input`` return carries) hands over the question AND the answer, labelled:
      ``Question asked: <q>`` then ``The person answered: <a>``. The stored ``text`` stays the
      question (the receipt and the evidence page read it) — only the READ changes.
    * An output carrying ``unsourced`` (D-04's mark) is prefixed by :data:`UNSOURCED_NOTE`.
    * Anything else is its ``text``, unchanged; a non-dict or an empty ``text`` is ``None``.
    """
    if not isinstance(out, dict):
        return None
    text = out.get("text")
    text = text if isinstance(text, str) and text.strip() else None
    if "answer" in out and out.get("tool_call_id") is not None:
        answer = out.get("answer")
        answer = answer.strip() if isinstance(answer, str) else ""
        said = f"The person answered: {answer or _NO_ANSWER}"
        return f"Question asked: {text}\n{said}" if text else said
    if text is None:
        return None
    if out.get("unsourced"):
        return f"{UNSOURCED_NOTE}\n\n{text}"
    return text


# ── D-23 (BUG-261015-01): one failure, one message ──────────────────────────────────────────


def claim_failure_message(ctx, phase) -> None:
    """Set ``ctx.engine_owns_failure_message`` for THIS phase, at the top of
    ``_run_phase_with_gates``.

    True when the phase has validators: the engine will retry or route, and every one of its
    failure-terminal arms (fail_run, a missing ``skip_to`` target, a valid ``skip_to``,
    completed-with-failure) surfaces the composed cause exactly once. False otherwise, so the
    executor's own message stays the only one (D-50: the suppression never drops it). Re-set on
    every phase, so a later phase without validators is never silenced by an earlier one. A
    frozen / slotted ctx is tolerated, as ``human_input`` tolerates it for its resume flag.
    """
    try:
        ctx.engine_owns_failure_message = bool(getattr(phase, "validators", None))
    except (AttributeError, TypeError):
        pass


async def surface_unless_engine_owns(ctx, run_id, reason, pool, surface):
    """The executor side: persist the failure message unless the engine owns it."""
    if getattr(ctx, "engine_owns_failure_message", False):
        return None
    return await surface(ctx, run_id, reason, pool)


async def surface_if_engine_owned(ctx, run_id, reason, pool, surface):
    """The engine side, for the arms that did not surface before 295: only when the executor
    was silenced, so a phase without validators never gets a second message."""
    if not getattr(ctx, "engine_owns_failure_message", False):
        return None
    return await surface(ctx, run_id, reason, pool)

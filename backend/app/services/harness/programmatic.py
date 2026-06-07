"""Programmatic phase registry (Phase 091 / HARNESS-01 — the ``programmatic`` phase type).

A ``programmatic`` workflow phase runs a server-controlled pure-Python function —
NO LLM call — resolved by name against the :data:`PROGRAMMATIC_PHASE_REGISTRY`.
The registry is a **closed dict** mirroring the ``_TOOL_REGISTRY`` pattern in
``tool_dispatcher.py``: an unknown ``fn`` name raises (it is NEVER ``eval``'d or
imported dynamically), which is the T-091-12 tampering mitigation — a published
workflow definition cannot smuggle arbitrary code through the ``fn`` field, it can
only name a function the server already registered here.

IDEMPOTENCY CONTRACT (Pattern 3 — resumability):
    Every function registered here MUST be PURE and IDEMPOTENT — same input dict
    produces the same output dict, with no side effects. A ``programmatic`` phase
    that crashes mid-work is re-run from the top on resume (the crash-leaves-active
    invariant), so a non-idempotent fn would corrupt state on the second run. The
    v1 consumer (:func:`split_topic`) is a deterministic pure-Python split — calling
    it twice with the same input returns identical ``sub_questions``.

Signature of a registered fn::

    async def fn(input: dict, ctx) -> dict

``input`` is built by the executor from ``config.input_keys`` against the run's
accumulated phase outputs; ``ctx`` is the harness run context (unused by pure
splits, available for fns that need run identity).
"""

from __future__ import annotations

import asyncio
import re
from typing import Awaitable, Callable

# Closed registry (T-091-12). Mirrors tool_dispatcher._TOOL_REGISTRY: a name not
# present here raises in the executor — never resolved dynamically / eval'd.
PROGRAMMATIC_PHASE_REGISTRY: dict[str, Callable[[dict, object], Awaitable[dict]]] = {}

__all__ = [
    "PROGRAMMATIC_PHASE_REGISTRY",
    "register_programmatic",
    "split_topic",
    "eval_slow_step",
]


def register_programmatic(name: str) -> Callable[
    [Callable[[dict, object], Awaitable[dict]]],
    Callable[[dict, object], Awaitable[dict]],
]:
    """Decorator: register ``fn`` under ``name`` in the closed registry.

    The decorated function is returned unchanged so it stays directly callable /
    importable for unit tests. Re-registering an existing name overwrites it (the
    module is imported once at process start; duplicate names are a developer bug,
    not a runtime input path).
    """

    def deco(
        fn: Callable[[dict, object], Awaitable[dict]],
    ) -> Callable[[dict, object], Awaitable[dict]]:
        PROGRAMMATIC_PHASE_REGISTRY[name] = fn
        return fn

    return deco


# Split a topic string into sub-questions on its natural clause boundaries. A
# deterministic, prompt-free heuristic (NO LLM) so the fn is pure + idempotent
# (Pattern 3): re-running on resume yields the identical sub_questions list.
_CLAUSE_SPLIT_RE = re.compile(r"[;\n]|(?:,?\s+and\s+)|(?:\s+vs\.?\s+)", re.IGNORECASE)


@register_programmatic("split_topic")
async def split_topic(input: dict, ctx: object) -> dict:
    """Split a research ``topic`` or ``kickoff_prompt`` into N sub-questions for the batch phase to fan out.

    The sole v1 consumer of the programmatic registry — the "Literature review
    (batch)" seed's split step. It reads the run's ``topic`` or ``kickoff_prompt``
    (the executor supplies them under those keys from ``config.input_keys``) and
    splits on natural clause boundaries (``;``, newlines, ``" and "``, ``" vs "``).
    When the topic has no clause boundaries it falls back to the single whole-topic
    question, so the batch phase always fans out over ≥ 1 sub-question.

    PURE + IDEMPOTENT (Pattern 3): no LLM, no side effects, deterministic output —
    the same ``topic`` always yields the same ``sub_questions`` list, so re-running
    this phase on resume is safe.

    Returns ``{"sub_questions": [str, ...]}`` — the shape the ``llm_batch_agents``
    executor reads to derive its N parallel sub-agents.
    """
    # D-09a (093): the executor builds fn_input only for keys in config.input_keys.
    # Live runs carry run_inputs["kickoff_prompt"]; the legacy seed key was "topic".
    # Read BOTH so the seed input_keys edit (migration 065) actually surfaces the
    # user's question to this fn. topic precedence preserved (backward compatible).
    topic = (input.get("topic") or input.get("kickoff_prompt") or "").strip()
    if not topic:
        return {"sub_questions": []}

    raw_parts = _CLAUSE_SPLIT_RE.split(topic)
    sub_questions: list[str] = []
    seen: set[str] = set()
    for part in raw_parts:
        if part is None:
            continue
        cleaned = part.strip().strip("?.").strip()
        if not cleaned:
            continue
        # Deterministic dedup preserving first-seen order (idempotency-friendly).
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        sub_questions.append(cleaned)

    if not sub_questions:
        sub_questions = [topic]

    return {"sub_questions": sub_questions}


# Mid-`programmatic` kill window for the 096 restart smoke (D-08 / SC#4):
# split_topic completes in microseconds — no human can land a uvicorn kill
# inside its 2-phase-write window. eval_slow_step holds the phase `active`
# for EVAL_SLOW_STEP_SECONDS so the operator-driven kill is real, never faked.
EVAL_SLOW_STEP_SECONDS = 20


@register_programmatic("eval_slow_step")
async def eval_slow_step(input: dict, ctx: object) -> dict:
    """split_topic semantics with a deliberate ~20s sleep.

    PURE + IDEMPOTENT (Pattern 3): the sleep is not a side effect; output is
    deterministic for the same input, so re-running on resume is safe.
    Referenced ONLY by the eval_coverage seed workflow (migration 066).
    """
    await asyncio.sleep(EVAL_SLOW_STEP_SECONDS)
    return await split_topic(input, ctx)

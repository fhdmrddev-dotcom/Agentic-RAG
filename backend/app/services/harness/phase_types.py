"""The 5 phase-type executors (Phase 091 / HARNESS-01 — the ~80% composition).

Each of the 5 phase types maps onto already-shipped, cross-provider-tested
substrate (RESEARCH Pattern 2). The executors here are THIN WRAPPERS: they CALL
the substrate (``_stream_one_iteration``, ``run_task_sub_agent``, the ask_user
pub/sub flow, the programmatic registry) — they never reimplement the agent loop
and never edit a byte-frozen provider path.

    | phase_type        | substrate                                                |
    |-------------------|----------------------------------------------------------|
    | programmatic      | PROGRAMMATIC_PHASE_REGISTRY[fn] (pure Python, no LLM)     |
    | llm_single        | task_service._stream_one_iteration (one LLM call)        |
    | llm_agent         | task_service.run_task_sub_agent (bounded sub-agent loop) |
    | llm_batch_agents  | gather(run_task_sub_agent × N) + merge_strategy          |
    | llm_human_input   | ask_user 5-step pub/sub pause/resume                     |

Each executor signature is ``async def _exec_<type>(phase, accumulated_outputs,
ctx) -> dict`` and returns a phase output dict carrying a ``text`` key — the
chat-ready string. The FINAL phase's ``text`` becomes the assistant message
verbatim (D-10), set by the engine as ``ctx.final_output``.

D-05 (whitelist) is wired on BOTH layers for the LLM-agent phases: (1) the model
only SEES the allowed tools via ``apply_tool_budget`` building the ``tools_override``,
and (2) ``ToolContext.phase_whitelist`` is the dispatch-time backstop (Plan 06).

OQ1 (phase prompt): the phase's own ``prompt`` reaches the model verbatim via the
additive ``system_prompt_override`` on ``run_task_sub_agent`` (Task 2).

RETRY-FEEDBACK CONSUMER: the LLM executors append ``ctx.retry_feedback`` (set None
by default) to the phase prompt before the LLM call. This is the CONSUMER half of a
producer/consumer pair — Plan 05's gate-retry loop is the PRODUCER (it SETS
``ctx.retry_feedback`` before re-running a phase). Plan 03 and Plan 05 are SAME-WAVE
siblings with no depends_on; the full producer→consumer round-trip is jointly
verified in 07-T2, not within either plan alone.

CAPS (D-12): ``llm_agent`` aligns its step cap with the existing agent-loop
Explorer=8 convention when the config carries the model default; ``llm_batch_agents``
is bounded by ``max_parallel_agents`` (default 5) composing the shipped per-run
Semaphore(3) / Redis-Lua(20) caps (it does NOT replace them — fair-share sizing is
Phase 096/CONC-01, deferred).
"""

from __future__ import annotations

import asyncio
import json
import logging
from uuid import UUID, uuid4

from app.config import settings
from app.services.ask_user_service import subscribe_for_response
from app.services.harness.programmatic import PROGRAMMATIC_PHASE_REGISTRY
from app.services.openai_service import apply_tool_budget, get_tools
from app.services.task_service import _stream_one_iteration, run_task_sub_agent
from app.services.tool_dispatcher import ToolContext

logger = logging.getLogger(__name__)

__all__ = [
    "PHASE_TYPE_REGISTRY_ENTRIES",
    "register_all",
]

# The Explorer agent-loop step convention (D-12): an llm_agent phase whose config
# carries the model default (LlmAgentPhaseConfig.max_steps == _MODEL_DEFAULT_MAX_STEPS)
# is SUBSTITUTED to the harness per-phase step cap (Settings.harness_phase_max_steps)
# so bounded harness sub-agents use the operator-tunable cap rather than running
# long. Read off Settings (config.py) so an operator can override via env. NOTE:
# this is a sentinel-EQUALITY substitution, NOT a min() clamp — the config default
# (models/harness.py LlmAgentPhaseConfig.max_steps / LlmBatchAgentsPhaseConfig.max_steps)
# MUST equal _MODEL_DEFAULT_MAX_STEPS for the substitution to fire; an explicit
# non-default config.max_steps passes through UNCHANGED.
#
# Phase 093 (D-19, 093-09): _MODEL_DEFAULT_MAX_STEPS raised 10 → 12 IN LOCKSTEP with
# Settings.harness_phase_max_steps (8 → 12, config.py) and the two Pydantic config
# defaults (models/harness.py, 10 → 12). With all three at 12 the sentinel
# substitution still fires (config default 12 == _MODEL_DEFAULT_MAX_STEPS 12 →
# _EXPLORER_STEP_CAP 12) so the EFFECTIVE per-phase cap is genuinely 12 (NOT 10 —
# raising _EXPLORER_STEP_CAP alone while leaving the sentinel at 10 would have left
# the default-config seed phases substituting to the new cap correctly, but raising
# the Pydantic default to 12 without the sentinel would have STOPPED the substitution
# and pinned the cap at 10; keeping all three aligned is the load-bearing invariant).
# The headroom lets a thorough sub-agent finish naturally before the force-synthesis
# fallback (task_service.py run_task_sub_agent else-branch) guarantees a real answer.
_EXPLORER_STEP_CAP = settings.harness_phase_max_steps
_MODEL_DEFAULT_MAX_STEPS = 12  # LlmAgentPhaseConfig.max_steps LOCKED default (093-09: 10 → 12)


# ── helpers ──────────────────────────────────────────────────────────────────
def _prior_output_text(accumulated_outputs: dict) -> str:
    """The chat-ready text fed as the user turn to a downstream LLM phase.

    Returns the LATEST phase's ``text`` (the running result), falling back to a
    newline-joined concatenation of every prior phase ``text`` when there is no
    single latest entry. Empty when nothing has run yet (the first phase).
    """
    if not accumulated_outputs:
        return ""
    # dicts preserve insertion order; the engine inserts in phase_index order.
    texts = [
        (v.get("text") if isinstance(v, dict) else None)
        for v in accumulated_outputs.values()
    ]
    texts = [t for t in texts if t]
    if not texts:
        return ""
    return texts[-1] if len(texts) == 1 else "\n\n".join(texts)


def _kickoff_prompt(ctx) -> str:
    """The user's original kickoff question, threaded in from ctx.inputs (F8).

    SEED-047 STORED the user's question in workflow_runs.inputs.kickoff_prompt;
    Phase 092-07 F8 wires the CONSUMPTION half: threads.py (live), the startup-sweep
    resume builder, and the Continue resume builder all set ctx.inputs from the same
    persisted jsonb. Returns "" when absent (a workflow with no stored kickoff —
    behavior-preserving, identical to the pre-F8 empty first-phase user turn).
    """
    return ((getattr(ctx, "inputs", None) or {}).get("kickoff_prompt") or "")


def _first_phase_user_turn(accumulated_outputs: dict, ctx) -> str:
    """The user turn for an LLM phase: prior-phase chaining, kickoff for the first.

    Later phases use ``_prior_output_text`` (the running result) EXACTLY as before —
    chaining is unchanged. ONLY the first phase (no accumulated outputs yet) falls
    back to the user's kickoff_prompt, so a Research→Summarize workflow's research
    phase actually researches the user's question instead of improvising (F8 root
    cause: the first phase used to get an empty user turn).
    """
    prior = _prior_output_text(accumulated_outputs)
    return prior or _kickoff_prompt(ctx)


def _retry_suffix(ctx) -> str:
    """The CONSUMER side of the retry-feedback pair (producer = Plan 05).

    When ``ctx.retry_feedback`` is set (a gate re-ran this phase), append it to the
    phase prompt so the LLM sees why the prior attempt was rejected. None / missing
    => empty string (no behavior change). Round-trip proven in 07-T2.
    """
    feedback = getattr(ctx, "retry_feedback", None)
    return ("\n\n" + feedback) if feedback else ""


def _effective_model(phase, ctx) -> str:
    """The per-phase model override or the run's inherited model."""
    return getattr(phase.config, "model", None) or getattr(ctx, "model", "") or ""


def _build_phase_tool_context(phase, ctx) -> ToolContext:
    """Build the ToolContext the sub-agent runs under for an LLM-agent phase.

    Carries the run substrate (redis / pool / supabase / user / thread) off the
    harness ``ctx`` bag and sets ``phase_whitelist`` (D-05 layer 2 — the dispatch
    backstop). ``run_task_sub_agent`` forks its OWN sub_run_id + stream off this
    context, so the ``run_id`` here is the harness run; the sub-agent's own events
    emit on its forked stream.

    Facet A (092-07): the sub-agent's ``parent_run_id`` FKs ``runs.run_id`` (the
    producer runs row), NOT ``workflow_runs.id`` (= ctx.run_id). So this parent
    ToolContext's ``run_id`` MUST be the producer runs id carried on
    ``ctx.producer_run_id``. We source it FAIL-CLOSED: if a harness ctx reaches
    here without ``producer_run_id`` we RAISE rather than silently fall back to
    ``ctx.run_id`` (the workflow_run id) — a silent fallback re-triggers
    ``runs_parent_run_id_fkey`` for all 7 providers on any unpatched ctx build site
    (live producer / startup-sweep resume / POST /continue resume).
    """
    _producer_id = getattr(ctx, "producer_run_id", None)
    if _producer_id is None:
        raise ValueError(
            "harness sub-agent parent context is missing producer_run_id — refusing "
            "to fall back to ctx.run_id (the workflow_run id is NOT a runs row and "
            "would raise runs_parent_run_id_fkey). Every harness ctx build site (live "
            "producer, startup-sweep resume, POST /continue resume) MUST set "
            "producer_run_id."
        )
    return ToolContext(
        redis=getattr(ctx, "redis", None),
        run_id=_producer_id,
        thread_id=getattr(ctx, "thread_id", ""),
        supabase=getattr(ctx, "supabase", None),
        pool=getattr(ctx, "pool", None),
        user_settings=getattr(ctx, "user_settings", None),
        current_user=getattr(ctx, "current_user", None) or {},
        folder_subtree_ids=getattr(ctx, "folder_subtree_ids", None),
        scoped_folder_path=getattr(ctx, "scoped_folder_path", None),
        emit=getattr(ctx, "emit", None),
        spawn=getattr(ctx, "spawn", None),
        model=_effective_model(phase, ctx),
        previous_files_in_run={},
        parent_run_id=None,
        per_run_task_semaphore=getattr(ctx, "per_run_task_semaphore", None),
        available_tools=list(phase.config.available_tools),
        # D-05 layer 2 — the dispatch-time backstop for hallucinated tool names.
        phase_whitelist=frozenset(phase.config.available_tools),
        # 096 review WR-03 — ctx.run_id IS workflow_runs.id on the harness ctx bag
        # (Facet A docstring above); threads it through so the tool_refused audit
        # lands in the same run namespace as every other harness_audit row.
        workflow_run_id=getattr(ctx, "run_id", None),
    )


# ── executors ──────────────────────────────────────────────────────────────
async def _exec_programmatic(phase, accumulated_outputs: dict, ctx) -> dict:
    """Run a server-controlled pure-Python fn resolved against the closed registry.

    The ``fn`` is looked up in PROGRAMMATIC_PHASE_REGISTRY (closed dict — an unknown
    name raises, never eval'd: T-091-12). The fn input is built from
    ``config.input_keys`` against the accumulated phase outputs (each key resolves to
    the matching prior phase output, or — for a top-level run input like ``topic`` —
    the value carried on the ctx run inputs). Pure / no LLM.
    """
    fn_name = phase.config.fn
    fn = PROGRAMMATIC_PHASE_REGISTRY.get(fn_name)
    if fn is None:
        raise KeyError(
            f"programmatic phase {phase.slug!r}: fn {fn_name!r} is not registered "
            f"in PROGRAMMATIC_PHASE_REGISTRY (closed dict — register it explicitly)"
        )

    run_inputs = getattr(ctx, "inputs", None) or {}
    fn_input: dict = {}
    for key in phase.config.input_keys:
        if key in accumulated_outputs:
            out = accumulated_outputs[key]
            # A prior phase output is a dict; expose its text under the key plus
            # spread its keys so the fn can read structured fields too.
            fn_input[key] = out.get("text") if isinstance(out, dict) else out
            if isinstance(out, dict):
                fn_input.update({k: v for k, v in out.items() if k not in fn_input})
        elif key in run_inputs:
            fn_input[key] = run_inputs[key]

    return await fn(fn_input, ctx)


async def _exec_llm_single(phase, accumulated_outputs: dict, ctx) -> dict:
    """One bounded LLM call — no tools. The phase prompt is the system framing.

    Re-running on resume is one paid call (Pitfall 5 — acceptable v1; no mid-stream
    checkpoint is possible). Consumes ctx.retry_feedback (producer = Plan 05).
    """
    system_prompt = phase.config.prompt + _retry_suffix(ctx)
    # F8 (092-07): first phase → the user's kickoff question; later phases → prior
    # output (chaining unchanged). Without this the first phase saw an empty user turn.
    content, _tool_calls = await _stream_one_iteration(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": _first_phase_user_turn(accumulated_outputs, ctx)},
        ],
        tools=[],
        model=_effective_model(phase, ctx),
        user_settings=getattr(ctx, "user_settings", None),
    )
    return {"text": content or ""}


async def _exec_llm_agent(phase, accumulated_outputs: dict, ctx) -> dict:
    """A bounded sub-agent over the phase whitelist (run_task_sub_agent substrate).

    Wires BOTH D-05 layers: ``apply_tool_budget`` builds the per-phase
    ``tools_override`` (layer 1 — the model only SEES allowed tools) and the
    per-phase ToolContext carries ``phase_whitelist`` (layer 2 — dispatch backstop).
    The phase prompt reaches the model verbatim via ``system_prompt_override`` (OQ1).
    The step cap clamps to the Explorer=8 convention (D-12) when the config carries
    the model default. Consumes ctx.retry_feedback (producer = Plan 05).
    """
    whitelist = frozenset(phase.config.available_tools)
    model = _effective_model(phase, ctx)

    # D-05 layer 1 — the model only SEES the whitelisted, budget-capped tools.
    # WR-04 (091-08): this list is now PASSED to run_task_sub_agent as
    # tools_override (was previously computed-then-discarded), so the TOOL-05
    # per-provider max_tools cap actually applies to the schemas the sub-agent
    # model sees — not just the dispatch-time backstop (layer 2).
    tools_override = apply_tool_budget(
        get_tools(getattr(ctx, "user_settings", None)), model, whitelist
    )

    phase_ctx = _build_phase_tool_context(phase, ctx)

    # D-12 — align with the Explorer=8 cap when the config is the model default.
    max_steps = phase.config.max_steps
    if max_steps == _MODEL_DEFAULT_MAX_STEPS:
        max_steps = _EXPLORER_STEP_CAP

    system_prompt = phase.config.prompt + _retry_suffix(ctx)
    # F8 (092-07): the sub-agent's USER turn is its `description` (task_service.py:351
    # — messages=[system_prompt_override, {"role":"user","content":description}]).
    # Pre-F8 it was just the slug label `f"Phase: {phase.slug}"` — so the FIRST phase's
    # sub-agent never saw the user's question and its search_documents had no real
    # topic to target. Now: first phase → the user's kickoff question; later phases →
    # the prior phase's output (chaining UNCHANGED). The phase prompt stays the
    # system_prompt_override (OQ1). We keep the slug as a label prefix so the task is
    # still attributable to the phase, but the substance is the actual question/output.
    user_turn = _first_phase_user_turn(accumulated_outputs, ctx)
    description = (
        f"Phase: {phase.slug}\n\n{user_turn}" if user_turn else f"Phase: {phase.slug}"
    )
    result = await run_task_sub_agent(
        parent_ctx=phase_ctx,
        description=description,
        instructions=None,
        allowed_tools=list(phase.config.available_tools),
        max_steps=max_steps,
        system_prompt_override=system_prompt,
        tools_override=tools_override,
    )
    # F7 (092-07): thread the grounding the sub-agent gathered (search_documents'
    # source_refs/citations/similarity) up to the phase output. The engine unions
    # it across ALL phases and attaches the accumulated set to the final answer —
    # so a Research→Summarize workflow shows the RESEARCH phase's sources on the
    # SUMMARIZE phase's prose (the final phase has none of its own).
    return {
        "text": result["summary"],
        "sub_run_id": str(result["sub_run_id"]),
        "source_refs": result.get("source_refs") or [],
        "citations": result.get("citations") or [],
        "similarity_scores": result.get("similarity_scores") or [],
    }


async def _exec_llm_batch_agents(phase, accumulated_outputs: dict, ctx) -> dict:
    """N parallel sub-agents (one per split_topic sub-question), then merge.

    Fans out over the sub-questions produced by an upstream ``programmatic``
    (``split_topic``) phase. Bounded by ``max_parallel_agents`` (default 5) via an
    ``asyncio.Semaphore`` that COMPOSES with — never replaces — the shipped per-run
    Semaphore(3) / Redis-Lua(20) caps (fair-share sizing deferred to 096/CONC-01).
    Each branch wires both D-05 layers identically to ``_exec_llm_agent``. Merge by
    ``merge_strategy``. Consumes ctx.retry_feedback (producer = Plan 05).
    """
    sub_questions = _collect_sub_questions(accumulated_outputs)
    if not sub_questions:
        # Nothing to fan out over — degrade to a single sub-agent on the prompt.
        sub_questions = [phase.config.prompt]

    whitelist = frozenset(phase.config.available_tools)
    model = _effective_model(phase, ctx)
    # WR-04 (091-08): pass the budget-capped list to each sub-agent (was discarded).
    tools_override = apply_tool_budget(
        get_tools(getattr(ctx, "user_settings", None)), model, whitelist
    )

    max_steps = phase.config.max_steps
    if max_steps == _MODEL_DEFAULT_MAX_STEPS:
        max_steps = _EXPLORER_STEP_CAP

    base_prompt = phase.config.prompt + _retry_suffix(ctx)
    sem = asyncio.Semaphore(phase.config.max_parallel_agents)

    # F8 (092-07): the overall topic context — the user's kickoff question — so each
    # parallel branch researches its sub-question IN SERVICE OF the original ask
    # (split_topic itself gets the kickoff via ctx.inputs from fix #1/#2; the batch
    # branches get it here). Empty when no kickoff was stored (behavior-preserving).
    overall_topic = _kickoff_prompt(ctx)

    async def _one(question: str) -> dict:
        async with sem:  # composes with the shipped per-run + Redis-Lua caps
            phase_ctx = _build_phase_tool_context(phase, ctx)
            # The sub-agent's USER turn (task_service.py:351) = the sub-question, the
            # actual substance to research — not the truncated slug label it was before.
            # Prefix the overall topic so the branch keeps the user's intent in view.
            description = (
                f"Overall topic: {overall_topic}\n\nSub-question: {question}"
                if overall_topic else question
            )
            return await run_task_sub_agent(
                parent_ctx=phase_ctx,
                description=description,
                instructions=None,
                allowed_tools=list(phase.config.available_tools),
                max_steps=max_steps,
                system_prompt_override=f"{base_prompt}\n\nSub-question: {question}",
                tools_override=tools_override,
            )

    results = await asyncio.gather(*[_one(q) for q in sub_questions])
    summaries = [r["summary"] for r in results]
    sub_run_ids = [str(r["sub_run_id"]) for r in results]

    if phase.config.merge_strategy == "concat_numbered":
        merged = "\n\n".join(
            f"## Result {i + 1}\n{s}" for i, s in enumerate(summaries)
        )
    else:  # "concat"
        merged = "\n\n".join(summaries)

    # F7 (092-07): union the grounding across ALL parallel branches (same shape as
    # _exec_llm_agent — extend lists, concatenate similarity scores). The engine
    # dedupes + averages over the run-level union, so per-branch overlap here is
    # harmless (it's collapsed downstream by the same dedupe the Deep path uses).
    batch_source_refs: list[dict] = []
    batch_citations: list[dict] = []
    batch_similarity_scores: list[float] = []
    for r in results:
        batch_source_refs.extend(r.get("source_refs") or [])
        batch_citations.extend(r.get("citations") or [])
        batch_similarity_scores.extend(r.get("similarity_scores") or [])

    return {
        "text": merged,
        "sub_run_ids": sub_run_ids,
        "source_refs": batch_source_refs,
        "citations": batch_citations,
        "similarity_scores": batch_similarity_scores,
    }


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
    answer = ""
    if payload and payload.get("kind") == "response":
        answer = payload.get("response_text") or ""

    return {"text": prompt, "answer": answer, "tool_call_id": tool_call_id}


def _collect_sub_questions(accumulated_outputs: dict) -> list[str]:
    """Find the latest upstream ``sub_questions`` list (from a split_topic phase)."""
    for out in reversed(list(accumulated_outputs.values())):
        if isinstance(out, dict) and isinstance(out.get("sub_questions"), list):
            return list(out["sub_questions"])
    return []


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


# ── registration ──────────────────────────────────────────────────────────
# The 5 executors keyed by phase_type — the engine's PHASE_TYPE_REGISTRY dispatch
# seam (Plan 02) resolves each of these.
PHASE_TYPE_REGISTRY_ENTRIES: dict = {
    "programmatic": _exec_programmatic,
    "llm_single": _exec_llm_single,
    "llm_agent": _exec_llm_agent,
    "llm_batch_agents": _exec_llm_batch_agents,
    "llm_human_input": _exec_llm_human_input,
}


def register_all() -> None:
    """Register the 5 executors into the engine's PHASE_TYPE_REGISTRY dispatch seam.

    Imported by ``harness/__init__`` so registration happens whenever the harness
    package (and therefore the engine) is used.
    """
    from app.services.harness_engine import PHASE_TYPE_REGISTRY

    PHASE_TYPE_REGISTRY.update(PHASE_TYPE_REGISTRY_ENTRIES)


# Register at import time (idempotent dict.update).
register_all()

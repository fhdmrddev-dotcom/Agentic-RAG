"""The 7 phase-type executors (Phase 091 / HARNESS-01 — the ~80% composition).

Each phase type maps onto already-shipped, cross-provider-tested substrate
(RESEARCH Pattern 2). The executors here are THIN WRAPPERS: they CALL
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
    | llm_emit          | forced_emit + the emitter registry (101.1 — the 6th)     |
    | external_action   | NONE — pure Python, ZERO I/O (189 — the 7th, SC#4)       |

⚠ The count and the two bottom rows were CORRECTED at Phase 189: this docblock said
"the 5" and listed five long after ``llm_emit`` made it six (101.1). A count in prose
rots on every additive growth — the table is the roster, and the registration block at
the foot of this file is the mechanism.

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
import hashlib
import json
import logging
from uuid import UUID, uuid4

from app.config import settings
from app.db.workflows import write_audit
from app.services.ask_user_service import subscribe_for_response
from app.services.forced_emit import forced_emit
from app.services.harness.emitters import resolve_emitter

# 189 D-02/D-20 — the ONE runtime home of the closed capability set (189-04). Safe at
# module top for the same reason ``validator_kinds`` is: ``grounding`` imports only
# ``app.utils`` + starlette at module scope (everything heavier is function-local), so it
# cannot close the harness_engine → harness → phase_types cycle.
from app.services.harness.grounding import EXTERNAL_ACTION_CAPABILITIES
from app.services.harness.programmatic import PROGRAMMATIC_PHASE_REGISTRY

# BUG-260730-01 — the ONE home of the citation marker format, read here so the
# instruction the producer sees and the pattern the gate compiles cannot drift. Safe at
# module top: ``validator_kinds`` imports only ``harness.validators`` (import-light, and
# already a package dependency), never back into ``phase_types``.
from app.services.harness.validator_kinds import CITATION_MARKER_GUIDANCE
from app.services.openai_service import RENDER_TEMPLATE_TOOL, apply_tool_budget, get_tools
from app.services.task_service import _stream_one_iteration, run_task_sub_agent
from app.services.template_asset_service import resolve_template_source
from app.services.template_render_service import (
    EmitFieldMap,
    check_coverage,
    emit_field_map_to_legacy,
    parse_docx_template_variables,
)
from app.services.tool_dispatcher import ToolContext

# Imported lazily-at-call (NOT at module top) to avoid a harness import cycle
# (harness_engine imports the harness package which imports phase_types): the
# honest-fail surface lives in harness_engine and is fetched inside the executor.
# ``_surface_failure_message`` is exposed as a module attribute below so tests can
# monkeypatch it; the executor reads it via the module-level name.

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


async def _surface_failure_message(ctx, run_id, reason, pool):
    """101.1 (D-08 layer 6 / RC-4) — persist a real failure reason before an emit
    failure return, via the engine's owner-scoped honest-fail surface.

    Lazy-delegates to ``harness_engine._surface_failure_message`` (the SAME helper the
    engine's fail_run / skip_to branches use), keeping the harness import cycle broken
    (harness_engine imports the harness package → phase_types → harness_engine). Exposed
    as a module-level name so the executor's honest-fail path is a single seam and tests
    can monkeypatch it. Best-effort: a persist failure never crashes the failing emit.
    """
    from app.services.harness_engine import _surface_failure_message as _engine_surface

    return await _engine_surface(ctx, run_id, reason, pool)


def _retry_suffix(ctx) -> str:
    """The CONSUMER side of the retry-feedback pair (producer = Plan 05).

    When ``ctx.retry_feedback`` is set (a gate re-ran this phase), append it to the
    phase prompt so the LLM sees why the prior attempt was rejected. None / missing
    => empty string (no behavior change). Round-trip proven in 07-T2.
    """
    feedback = getattr(ctx, "retry_feedback", None)
    return ("\n\n" + feedback) if feedback else ""


def _citation_instruction(phase) -> str:
    """BUG-260730-01 — TELL THE PRODUCER what its attached citation gate will look for.

    The third additive suffix, with the same ``''``-when-inactive discipline as
    ``_retry_suffix`` and ``_skill_block``: a phase that carries no
    ``retrieved_and_cited`` gate gets the empty string, so its system prompt is
    BYTE-IDENTICAL to pre-185 (D-14, asserted by prompt EQUALITY in
    ``test_185_detection.py`` — not by a substring absence).

    WHY IT EXISTS. The engine auto-attaches a ``citations_required`` gate to a DETECTED
    step (``grounding.effective_phase``) and used to announce it NOWHERE: not in the step
    prompt (the author's), not at the attachment seam (it appends a ValidatorSpec and no
    prose), and not in the retry feedback (which only echoed the gate's deficit). So a
    detected step that retrieved correctly still failed all 3 attempts on the marker count
    — the exact author-side burden the auto-attachment exists to REMOVE. The gate is right
    and stays exactly this strict; what was missing is this sentence.

    WHY IT READS THE ATTACHED SPEC AND NEVER RE-RUNS DETECTION. This is the load-bearing
    design point, not a style preference. Reading the spec means the instruction and the
    judge are driven by THE SAME OBJECT, so they cannot disagree. Re-deriving the cause here
    would be a second copy of "which steps are governed" — which ``grounding.py``'s own
    docblock names as a safety hole rather than a duplication smell — and it would silently
    do the wrong thing for the author-declared case, where a spec is present without
    detection. So THIS MODULE CALLS NOTHING IN ``grounding``, and the detection function's
    name is deliberately not spelled anywhere in this file: the guard is a literal
    file-level grep pinned to zero occurrences (``test_185_detection.py``), and a prose
    mention would defeat it exactly as the D-ITEM-183-02 trap describes.

    SCOPE, deliberately narrow:
      * only ``mode: "retrieved_and_cited"`` — ``deterministic``/``emit`` gates a
        ``field_map`` (a different obligation, already instructed by the emit path) and a
        ``presence`` author opted in and wrote their own marker instructions;
      * a spec carrying its OWN ``config["pattern"]`` is skipped: that pattern is not the
        format ``CITATION_MARKER_GUIDANCE`` describes, so advertising it would be a lie;
      * ``min_markers`` is taken as the MAX across matching specs (D-185-05 lets an
        author's spec and the engine's BOTH run), so the instruction can never ask for
        fewer markers than the strictest gate requires.

    Never raises: a prompt helper that threw would kill a run over a malformed config.
    """
    need = 0
    for spec in getattr(phase, "validators", None) or []:
        if getattr(spec, "kind", None) != "citations_required":
            continue
        cfg = getattr(spec, "config", None) or {}
        if cfg.get("mode") != "retrieved_and_cited" or cfg.get("pattern"):
            continue
        try:
            need = max(need, int(cfg.get("min_markers", 1)))
        except (TypeError, ValueError):
            need = max(need, 1)  # the gate's own default when the value is junk
    if need <= 0:
        # No gate, or a gate satisfied by zero markers — nothing to announce.
        return ""
    markers = "marker" if need == 1 else "markers"
    return (
        "\n\n## Citations (required — this step reads the knowledge base)\n"
        f"Your answer is checked automatically before it is accepted: "
        f"{CITATION_MARKER_GUIDANCE}. At least {need} such {markers} must appear in your "
        "final answer, and the answer must rest on passages you actually retrieved. An "
        "answer with no marker is rejected and the step is retried."
    )


def _skill_block(phase, ctx=None, *, with_files: bool | None = None) -> str:
    """099 WFSKILL-01 (D-05/D-06) — the delimited skill framing block, or '' when no snapshot.

    Composes the materialized snapshot the SAME way ``load_skill`` reads it (name +
    instructions + a file-NAME list — NOT file contents; the agent pulls contents on
    demand via the auto-whitelisted ``read_skill_file``). ``''`` when there is no
    snapshot => a byte-identical no-op (mirrors ``_retry_suffix``).

    ``with_files`` controls the file manifest (D-07): on ``llm_single`` (``tools=[]``,
    ``read_skill_file`` inert) the file list is OMITTED — instructions only. When
    ``with_files`` is left ``None`` it is DERIVED from the phase shape (an
    ``llm_single`` phase type or an empty ``available_tools`` => omit), so the helper
    composes correctly whether the caller passes the explicit kwarg (the three
    executor seams below) or not (the unit test passes ``(phase, ctx)`` positionally).
    ``ctx`` is accepted (unused) so the call shape matches the test contract.
    """
    snap = getattr(phase.config, "skill_snapshot", None)
    if snap is None:
        return ""
    if with_files is None:
        # Derive from the phase: llm_single (tool-less) omits the manifest (D-07).
        _is_single = getattr(phase.config, "phase_type", None) == "llm_single"
        _no_tools = not list(getattr(phase.config, "available_tools", []) or [])
        with_files = not (_is_single or _no_tools)
    block = f"\n\n## Skill: {snap.name}\n{snap.instructions}"
    if with_files and getattr(snap, "files", None):
        listed = "\n".join(f"- {f}" for f in snap.files)
        block += f"\n\nAttached files (read with read_skill_file):\n{listed}"
    return block


def _effective_tools(phase) -> list[str]:
    """099 D-04 auto-whitelist: ``available_tools ∪ {'read_skill_file'}`` when the
    phase carries a ``skill_snapshot``; else ``available_tools`` unchanged (a
    byte-identical no-op).

    Never DROPS a tool — only appends the one fixed, already-registered
    ``read_skill_file`` (``tool_dispatcher.py``), and only when a snapshot is present
    (T-099-07). ``apply_tool_budget`` never drops a whitelisted tool, so the appended
    name survives the per-provider max_tools cap on layer 1.

    101 TMPL-02 (D-04/D-05) — ``render_template`` is admitted to a harness FILL phase
    via this SAME never-drop pattern: a fill phase declares ``render_template`` in its
    ``available_tools`` and it flows through ``base`` UNCHANGED, so it survives
    ``apply_tool_budget``'s per-provider max_tools cap EXACTLY like ``read_skill_file``.

    101-06 WR-01 CORRECTION — the TWO-LAYER mechanism (this docstring previously
    misdescribed it; the original claim that the whitelist NAME flows into
    "available_tools (layer 1 — the schemas the model sees)" was WRONG and is the
    root cause WR-01 shipped):

      - **Layer 1 — the SCHEMAS the model actually sees** are NOT the names on
        ``ToolContext.available_tools``; they are the function-schemas in the
        ``tools_override`` list built by ``apply_tool_budget(<candidates>, model,
        whitelist)``. ``apply_tool_budget`` can only FILTER schemas it is GIVEN — a
        whitelisted NAME with no SCHEMA in the candidate list is a no-op. The base
        candidate list is ``get_tools(user_settings)``, which has NO render_template
        schema (Deep stays byte-identical — that schema is NEVER added to
        ``get_tools()``). So ``_exec_llm_agent`` / ``_exec_llm_batch_agents`` AUGMENT
        the candidate list with ``RENDER_TEMPLATE_TOOL`` BEFORE the budget call, but
        ONLY when the phase whitelist contains ``"render_template"`` (the
        ``_render_template_candidates`` helper). The whitelist filter then KEEPS the
        schema; the max_tools cap never drops it (it is whitelisted).
      - **Layer 2 — the DISPATCH backstop** is ``ToolContext.available_tools`` /
        ``phase_whitelist=frozenset(_tools)`` (consumed by
        ``tool_dispatcher.dispatch_tool``): it refuses a hallucinated tool NAME at
        dispatch time. It does NOT control which schemas the model sees.

    There is DELIBERATELY no provenance-based auto-injection of ``render_template``: a
    phase must EXPLICITLY declare it (auto-injecting it into every phase would WIDEN the
    tool surface and break the gated-no-op Deep invariant). The field-map emission the
    fill phase produces as ``render_template``'s typed argument rides the UNMODIFIED
    shared gateway (``_stream_one_iteration`` / ``resolve_calling_mode``) — provider
    quirks live at the service boundary, the fill path NEVER branches per provider
    (D-14 / Cond 7).
    """
    base = list(phase.config.available_tools)
    if getattr(phase.config, "skill_snapshot", None) is not None and "read_skill_file" not in base:
        base.append("read_skill_file")
    return base


def _phase_tools_override(whitelist, model, user_settings) -> list[dict]:
    """101-06 WR-01 — build the per-phase ``tools_override`` (LAYER 1: the SCHEMAS the
    model actually sees). Factored so ``_exec_llm_agent`` and ``_exec_llm_batch_agents``
    cannot drift.

    1. Base candidates = ``get_tools(user_settings)`` — which has NO ``render_template``
       schema, so Deep (which calls ``get_tools`` directly) stays BYTE-IDENTICAL.
    2. When — and ONLY when — the phase whitelist admits ``"render_template"``, append
       the ``RENDER_TEMPLATE_TOOL`` schema so ``apply_tool_budget``'s whitelist filter
       has a schema to KEEP (a whitelisted name with no schema is a no-op — the exact
       WR-01 root cause that neutered the whole fill feature).
    3. ``apply_tool_budget`` filters to the whitelist and applies the per-provider
       max_tools cap; the render schema is whitelisted so the cap never drops it.
    """
    cand = get_tools(user_settings)
    if "render_template" in (whitelist or frozenset()):
        cand = cand + [RENDER_TEMPLATE_TOOL]
    return apply_tool_budget(cand, model, whitelist)


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
    # 099 D-04 auto-whitelist — read_skill_file ∪ available_tools when the phase
    # carries a skill_snapshot (else unchanged). Computed ONCE; feeds BOTH the layer-2
    # phase_whitelist (dispatch backstop) and the available_tools the ctx advertises.
    _tools = _effective_tools(phase)
    # 098 PROJ-02 — per-phase folder_scope narrowing (the single ToolContext-build
    # seam). The resolved PROJECT subtree (ctx.folder_subtree_ids, bound server-side
    # at run-start) is narrowed by the phase's declared folder_scope (∩, narrow-ONLY).
    # This is DEFENSIVE: the narrow-only *validity* of _phase_scope is enforced upstream
    # by scope.assert_folder_scopes_subset (run-start, Plan 04), so the intersection
    # never silently "fixes" an invalid scope — it only restricts to the declared subset.
    # Keep the channel a list (Pitfall 1: a set would raise in supabase-py json.dumps on
    # the RPC p_folder_ids param). None project subtree (unbound / Deep) → None (no narrowing).
    _proj = getattr(ctx, "folder_subtree_ids", None)            # the resolved project subtree (or None)
    _phase_scope = getattr(phase.config, "folder_scope", None)  # PROJ-02 resolved id list (or None on non-retrieval phases)
    _effective = (
        [f for f in _proj if f in set(map(str, _phase_scope))]  # narrow-only ∩ — keep a list (Pitfall 1)
        if _proj is not None and _phase_scope else _proj
    )
    return ToolContext(
        redis=getattr(ctx, "redis", None),
        run_id=_producer_id,
        thread_id=getattr(ctx, "thread_id", ""),
        supabase=getattr(ctx, "supabase", None),
        pool=getattr(ctx, "pool", None),
        user_settings=getattr(ctx, "user_settings", None),
        current_user=getattr(ctx, "current_user", None) or {},
        folder_subtree_ids=_effective,
        scoped_folder_path=getattr(ctx, "scoped_folder_path", None),
        emit=getattr(ctx, "emit", None),
        spawn=getattr(ctx, "spawn", None),
        model=_effective_model(phase, ctx),
        previous_files_in_run={},
        parent_run_id=None,
        per_run_task_semaphore=getattr(ctx, "per_run_task_semaphore", None),
        # 099 D-04 — the effective list (auto-whitelisted read_skill_file when a
        # snapshot is present; else byte-identical to available_tools).
        available_tools=_tools,
        # D-05 layer 2 — the dispatch-time backstop for hallucinated tool names.
        phase_whitelist=frozenset(_tools),
        # 096 review WR-03 — ctx.run_id IS workflow_runs.id on the harness ctx bag
        # (Facet A docstring above); threads it through so the tool_refused audit
        # lands in the same run namespace as every other harness_audit row.
        workflow_run_id=getattr(ctx, "run_id", None),
        # 099 D-04 attach — the materialized snapshot threaded onto the per-phase
        # dispatch ctx (Plan 03's gated read branch consumes it). None when absent
        # => Plan 03 read is a no-op => Deep/non-skill phases byte-identical.
        skill_snapshot=getattr(phase.config, "skill_snapshot", None),
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
    # 099 WFSKILL-01 (D-05/D-07): compose the skill framing BEFORE the retry suffix.
    # llm_single runs tools=[], so read_skill_file is inert and the file manifest would
    # be dead weight — pass no-files so only the instructions compose ('' when no snapshot).
    system_prompt = (
        phase.config.prompt + _skill_block(phase, ctx, with_files=False) + _retry_suffix(ctx)
    )
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
    # 099 D-04 — layer-1 whitelist over the EFFECTIVE list so the budget-capped tools
    # the MODEL sees include read_skill_file when the phase carries a skill_snapshot.
    whitelist = frozenset(_effective_tools(phase))
    model = _effective_model(phase, ctx)

    # D-05 layer 1 — the model only SEES the whitelisted, budget-capped tools.
    # WR-04 (091-08): this list is now PASSED to run_task_sub_agent as
    # tools_override (was previously computed-then-discarded), so the TOOL-05
    # per-provider max_tools cap actually applies to the schemas the sub-agent
    # model sees — not just the dispatch-time backstop (layer 2).
    # 101-06 WR-01: _phase_tools_override augments the candidate list with the
    # RENDER_TEMPLATE_TOOL schema BEFORE the budget call when the phase whitelists
    # render_template (else byte-identical to the old get_tools()-only path; Deep
    # untouched). Without the schema in the candidate list, the whitelisted NAME is a
    # no-op and the model never sees the tool.
    tools_override = _phase_tools_override(
        whitelist, model, getattr(ctx, "user_settings", None)
    )

    phase_ctx = _build_phase_tool_context(phase, ctx)

    # D-12 — align with the Explorer=8 cap when the config is the model default.
    max_steps = phase.config.max_steps
    if max_steps == _MODEL_DEFAULT_MAX_STEPS:
        max_steps = _EXPLORER_STEP_CAP

    # 099 WFSKILL-01 (D-05/D-06): compose the skill framing (instructions + file
    # manifest — read_skill_file is auto-whitelisted below) BEFORE the retry suffix.
    # '' when no snapshot => byte-identical to pre-099.
    # BUG-260730-01: _citation_instruction announces the citation gate the engine
    # ATTACHED to this phase but never told the model about — a detected step that
    # retrieved correctly still failed 3/3 attempts on a marker format nothing named. Do
    # not "simplify" it away: the gate is checked either way, so removing this only makes
    # the requirement invisible again. Placed BEFORE the retry suffix so feedback about a
    # failed attempt stays last, closest to the model's next turn. '' for every phase with
    # no such gate => byte-identical (D-14).
    system_prompt = (
        phase.config.prompt
        + _skill_block(phase, ctx)
        + _citation_instruction(phase)
        + _retry_suffix(ctx)
    )
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
        # 099 D-04 — the sub-agent's own allowed_tools subset must ADMIT read_skill_file
        # when present, else layer-1 exposes it but the sub-agent rejects the call.
        allowed_tools=_effective_tools(phase),
        instructions=None,
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

    # 099 D-04 — layer-1 whitelist over the EFFECTIVE list (read_skill_file ∪ tools
    # when a snapshot is present), so each branch's budget-capped schemas include it.
    whitelist = frozenset(_effective_tools(phase))
    model = _effective_model(phase, ctx)
    # WR-04 (091-08): pass the budget-capped list to each sub-agent (was discarded).
    # 101-06 WR-01: same render_template schema augmentation as _exec_llm_agent — the
    # shared _phase_tools_override helper guarantees the two paths cannot drift.
    tools_override = _phase_tools_override(
        whitelist, model, getattr(ctx, "user_settings", None)
    )

    max_steps = phase.config.max_steps
    if max_steps == _MODEL_DEFAULT_MAX_STEPS:
        max_steps = _EXPLORER_STEP_CAP

    # 099 WFSKILL-01 (D-05/D-06): each parallel branch shares the same composed skill
    # framing (instructions + file manifest); read_skill_file is auto-whitelisted on
    # every branch's ToolContext below. '' when no snapshot => byte-identical.
    # BUG-260730-01: the SAME citation announcement as _exec_llm_agent, because
    # `llm_batch_agents` also carries `available_tools` and is therefore equally
    # DETECTABLE — a fix on the single-agent path alone would leave every batch step
    # failing a gate nothing told it about. Do not "simplify" it away. Before the retry
    # suffix; '' when this phase has no such gate => byte-identical (D-14).
    base_prompt = (
        phase.config.prompt
        + _skill_block(phase, ctx)
        + _citation_instruction(phase)
        + _retry_suffix(ctx)
    )
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
                # 099 D-04 — admit read_skill_file on the sub-agent's own subset too.
                allowed_tools=_effective_tools(phase),
                instructions=None,
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


# ── 101.1 (D-01/D-04/D-08/D-10/D-12) — the 6th executor: a SEALED FORCED EMIT ──
def _emit_bound_asset_ref(definition):
    """GAP-B / D-10 — the bound library template ``AssetRef`` the executor resolves
    SERVER-SIDE (the model never selects it).

    Picks the ``WorkflowDefinition.assets[]`` entry of ``kind=="template"`` (a
    ``reference`` asset is NOT a fill template). Returns ``None`` when the definition has
    no template asset — the executor then falls through to the ephemeral-upload branch
    (``resolve_template_source(asset_ref=None)``), and an unresolved upload is the honest
    ``no_template_bound`` state (e). Definition may be absent on a minimal/legacy ctx →
    ``None`` (the same fall-through).
    """
    if definition is None:
        return None
    assets = getattr(definition, "assets", None) or []
    for asset in assets:
        if getattr(asset, "kind", None) == "template":
            return asset
    return None


def _ref_spotlight_id(ref: dict) -> str | None:
    """The ONE stable id a retrieved ref is known by — feeds BOTH the ``<doc id=…>``
    spotlight the model cites FROM and the citation gate's valid set, so the two sides
    cannot drift (the WR-04 one-mapping discipline applied to citation ids).

    Prefers an explicit chunk id when the ref carries one; falls back to the composite
    ``{document_id}#{chunk_index}`` the live enriched retrieval refs expose (101.1-06:
    retrieval threads no raw ``document_chunks.id`` end-to-end — the 097 carry-forward)."""
    for idk in ("chunk_id", "source_chunk_id", "id"):
        v = ref.get(idk)
        if v:
            return str(v)
    doc = ref.get("document_id")
    if doc:
        idx = ref.get("chunk_index")
        return f"{doc}#{idx}" if idx is not None else str(doc)
    return None


# Spotlight bounds: enough for a register-style retrieval set without blowing the
# emit call's context (each forced shot is a single sealed call).
_EMIT_SPOTLIGHT_MAX_REFS = 40
_EMIT_SPOTLIGHT_MAX_PASSAGE = 1600

# D-08 layer 5 — bounded citation-gate retry (101.1-06): total sealed attempts,
# matching the engine's ≤3 validator-retry convention (SC#3: bounded, never loops).
_EMIT_MAX_ATTEMPTS = 3


def _template_oracle(src: dict) -> dict | None:
    """The 097 "parse template first" coverage oracle, productized (101.1-06).

    Parses the RESOLVED template's placeholder names (docx only for now — the same
    docx-first scope as the rest of the phase) so the forced shot can name EXACTLY
    the keys the template needs and the citation gate can validate coverage BEFORE
    the sandbox render. ``None`` (no oracle, behavior unchanged) for non-docx
    templates, unreadable bytes, or token-free files — never a crash."""
    if not str(src.get("filename") or "").lower().endswith(".docx"):
        return None
    data = src.get("bytes")
    if not data:
        return None
    return parse_docx_template_variables(data)


def _emit_evidence(accumulated_outputs: dict) -> tuple[str, set[str]]:
    """The grounding evidence for the forced emit — ``(spotlight, valid_ids)`` from ONE walk.

    101.1-06 root cause (live UAT run a12ee906, 100% gate over-rejection): the emit user
    turn was the prior phase's PROSE, so the model had no real source id to cite (it
    fabricated), AND the gate's valid set only recognized ``chunk_id``-shaped keys while
    live retrieval refs carry ``document_id`` + ``chunk_index`` — the set was ALWAYS
    empty and every citation read as "invented".

    Fix: render the retrieved refs as ``<doc id="…" file="…">passage</doc>`` blocks
    (the 097 T-097-04 spotlight that proved 100% citation coverage) appended to the emit
    user turn, and derive the gate's valid set from the SAME ``_ref_spotlight_id``
    assignment. Security: the valid set is computed server-side from the refs — a fake
    ``<doc id=…>`` injected inside a passage's TEXT is not in the set, so KB-content
    prompt injection cannot whitelist its own citation. Empty when nothing was retrieved
    (any non-null cited value is then invented → state b — the correct honest reject).
    """
    blocks: list[str] = []
    seen: set[str] = set()
    ids = _retrieved_ids(accumulated_outputs)
    for out in (accumulated_outputs or {}).values():
        if not isinstance(out, dict):
            continue
        for key in ("source_refs", "citations"):
            for ref in out.get(key) or []:
                if not isinstance(ref, dict):
                    continue
                sid = _ref_spotlight_id(ref)
                if not sid or sid in seen or len(blocks) >= _EMIT_SPOTLIGHT_MAX_REFS:
                    continue
                seen.add(sid)
                passage = str(ref.get("passage") or ref.get("text") or "")[:_EMIT_SPOTLIGHT_MAX_PASSAGE]
                fname = str(ref.get("filename") or ref.get("source_doc") or "")
                blocks.append(f'<doc id="{sid}" file="{fname}">{passage}</doc>')
    if not blocks:
        return "", ids
    spotlight = (
        "Sources — every non-null value MUST cite one of these documents; set "
        "source_chunk_id to the exact `id` attribute of the <doc> block it came from:\n"
        + "\n".join(blocks)
    )
    return spotlight, ids


def _retrieved_ids(accumulated_outputs: dict) -> set[str]:
    """The spotlight/source ids the citation gate validates against (D-08 layer 4).

    A prior retrieval phase (the D-13 two-step: an ``llm_agent`` ``search_documents``
    phase feeding the emit) threads its grounding up as ``source_refs`` / ``citations``
    on its phase output. Union every id ``_ref_spotlight_id`` assigns across the
    accumulated outputs — explicit ``chunk_id``-shaped keys AND the composite
    ``document_id#chunk_index`` fallback (101.1-06) — so a cited ``source_chunk_id``
    is "retrieved" iff it was actually in the evidence set the prior phase gathered.
    Empty when nothing retrieved (then any non-null cited value is invented → state b
    — the correct honest reject).
    """
    ids: set[str] = set()
    for out in accumulated_outputs.values():
        if not isinstance(out, dict):
            continue
        for key in ("source_refs", "citations"):
            for ref in out.get(key) or []:
                if isinstance(ref, dict):
                    sid = _ref_spotlight_id(ref)
                    if sid:
                        ids.add(sid)
                elif ref:
                    ids.add(str(ref))
    return ids


def _emit_forced_tool(emitter: str) -> list[dict]:
    """The forced-tool schema list ``forced_emit`` targets — named ``emitter`` with the
    FLAT ``EmitFieldMap`` parameters (the strict cross-provider forcing target ``forced_emit``
    validates against). NOT the legacy GenericFieldMap envelope: ``forced_emit`` parses the
    forced tool-call arguments as ``EmitFieldMap`` (Plan 02), so the model must be forced
    against the flat shape it then validates."""
    return [
        {
            "type": "function",
            "function": {
                "name": emitter,
                "description": (
                    "Emit the CITED, structured field-map for the template. Put every "
                    "scalar placeholder under `scalars` (one object each: key, value, "
                    "source_chunk_id, source_doc, source_page) and every table row under "
                    "`rows`. For EVERY non-null value set source_chunk_id to the EXACT "
                    "`id` attribute of the <doc> source block the value came from; if the "
                    "sources do not support a value set value to null. "
                    "Never invent a value or a citation."
                ),
                "parameters": EmitFieldMap.model_json_schema(),
            },
        }
    ]


def _emit_audit_metadata(
    *, definition, phase, emitter: str, result: dict | None, gate: dict | None,
    render_verdict: dict | None, output_file: dict | None,
) -> dict:
    """Build the D-12 receipt ``metadata`` dict (RESEARCH §4 shape). Keyed to
    definition@version; the per-transition writes share this base + the verdict.

    Every field is JSON-serializable (``write_audit`` json.dumps the metadata): the raw
    field-map rides as its legacy dict, the output-file sha256 is a stdlib ``hashlib``
    hex digest (V6 — never hand-rolled), and the gate/integrity verdicts are the
    deterministic stat dicts. Absent stages are ``None`` (an emit_forced receipt has no
    integrity verdict yet) — never a fabricated value."""
    meta: dict = {
        "definition_version": getattr(definition, "version", None),
        "definition_id": getattr(definition, "definition_id", None)
        or getattr(definition, "id", None),
        "phase_slug": getattr(phase, "slug", None),
        "emitter": emitter,
    }
    if result is not None:
        meta.update(
            tier=result.get("tier"),
            provider=result.get("provider"),
            model=getattr(phase.config, "model", None),
            forced=result.get("forced"),
            thinking=False,  # the emit call ALWAYS runs thinking-OFF (D-05 TIER-FORCE-NOTHINK)
            recovered_from_narration=result.get("recovered_from_narration"),
            truncated=result.get("truncated"),
        )
    if gate is not None:
        meta["gate_verdict"] = gate
    if render_verdict is not None:
        meta["integrity_verdict"] = render_verdict
    if output_file is not None:
        meta["output_file"] = output_file
    return meta


async def _emit_audit(ctx, *, event_type: str, metadata: dict) -> None:
    """Write ONE INSERT-only emit receipt (D-12). Owner-scoped on ``ctx.current_user``;
    keyed to the workflow ``ctx.run_id`` (the audit run namespace — Facet A). Best-effort:
    a receipt-write failure (missing pool on a minimal ctx) must never crash the emit."""
    pool = getattr(ctx, "pool", None)
    if pool is None:
        return
    run_id = getattr(ctx, "run_id", None)
    user_id = (getattr(ctx, "current_user", None) or {}).get("id")
    try:
        await write_audit(pool, run_id, user_id=user_id, event_type=event_type, metadata=metadata)
    except Exception:  # noqa: BLE001 — a receipt write must never crash the failing emit
        logger.warning("llm_emit: audit receipt %s write failed run=%s", event_type, run_id)


async def _emit_phase_substep(ctx, phase, *, status: str | None = None, failure: str | None = None) -> None:
    """Emit ONE GAP-C ``phase_substep`` run-honesty event (D-11) on the EXISTING producer
    stream the frontend already tails — reusing the canonical one-XADD ``_emit`` (no new
    wire path, no per-provider branch; the D-14 shared-path guard still holds).

    A sealed single-shot forced emit is ATOMIC (it cannot stream tokens), so the emit
    moment surfaces as DISCRETE sub-steps instead of a static "Step 0 · working…" box:

      - ``status`` ∈ {forcing, emitting, recovering, validating, rendering, validated} —
        the live transition (RESEARCH §5). ``recovering`` is the degraded-but-honest D-06
        NATIVE-narration recovery.
      - ``failure`` ∈ {model_failed_to_emit, citation_gate_rejected, render_failed,
        integrity_failed, no_template_bound} — a TERMINAL failed-as-failed sub-event the
        PhaseCard renders with a reason (never an empty 'done', RC-4).

    Carries ``phase=phase.slug`` (+ ``phase_index``) so the frontend maps the sub-event to
    the right phase row on the status-node rail. Best-effort: a missing redis / run_id on a
    minimal ctx must never crash the emit (mirrors ``_emit_audit``)."""
    redis = getattr(ctx, "redis", None)
    if redis is None:
        return
    stream_id = getattr(ctx, "producer_run_id", None) or getattr(ctx, "run_id", None)
    if stream_id is None:
        return
    emit = getattr(ctx, "emit", None)
    if emit is None:
        # Lazy import to avoid the harness_engine → harness package → phase_types cycle
        # (same pattern as the module-level _surface_failure_message delegate).
        from app.services.harness_engine import _emit as emit
    fields: dict = {"phase": getattr(phase, "slug", None), "phase_index": getattr(phase, "phase_index", None)}
    if status is not None:
        fields["status"] = status
    if failure is not None:
        fields["failure"] = failure
    try:
        await emit(redis, stream_id, "phase_substep", **fields)
    except Exception:  # noqa: BLE001 — a run-honesty sub-event must never crash the emit
        logger.warning("llm_emit: phase_substep emit failed run=%s", stream_id)


def _emit_failure_output(failure: str, message: str, *, field_map=None) -> dict:
    """The phase output for an honest emit failure (state a-e). Carries ``text`` (the real
    reason — never an empty 'done', RC-4), the ``failure`` taxonomy value (GAP-C, the
    frontend's closed-taxonomy render), and — when available — the cited ``field_map`` as
    a preserved fallback (D-08: a non-opening render never loses the extracted data).

    Phase 101.1-07 (gap 2 — single-owner persist): every state a-e return ALREADY wrote
    the failure ``messages`` row via ``_surface_failure_message``. Flag the output
    ``_surfaced=True`` so the engine's ``_surface_final_answer`` SKIPS a SECOND persist
    (one writer, one message — closes the duplicate-honest-failure-message bug). Deep
    never returns a ``_surfaced`` final_output (Deep does not run ``_exec_llm_emit``), so
    the engine guard is a literal no-op on the shared path.
    """
    out: dict = {"text": message, "failure": failure, "_surfaced": True}
    if field_map is not None:
        out["field_map"] = field_map
    return out


async def _emit_unexpected_failure(phase, *, definition, emitter, run_id, pool, ctx, exc) -> dict:
    """Phase 101.1-07 (gap 1b — the executor half of the D-08 layer-6 backstop).

    The single seam the ``_exec_llm_emit`` catch-all calls on ANY unexpected raise (the
    render post_processor throwing, or any error NOT already handled by the inline state
    a-e returns). It writes an ``emit_failed`` receipt, emits a ``render_failed``
    phase_substep, surfaces ONE honest message, and returns a flagged honest output — so
    a raised provider/render/persist error becomes an auditable honest failure instead of
    a silent run-crash that strands the ``workflow_phases`` row in ``active`` forever
    (UAT Test 2, runs 575e7345 / a7f415ad). Logs identifier-only (T-073-04 — never the
    message/args content).
    """
    logger.exception("llm_emit: unexpected failure run=%s", run_id)
    msg = (
        "The deliverable could not be produced due to an unexpected error in the emit "
        "pipeline; no Markdown stand-in is delivered as the artifact."
    )
    await _emit_audit(ctx, event_type="emit_failed", metadata=_emit_audit_metadata(
        definition=definition, phase=phase, emitter=emitter, result=None, gate=None,
        render_verdict={"failure": "render_failed", "reason": "unexpected"}, output_file=None,
    ))
    await _emit_phase_substep(ctx, phase, failure="render_failed")
    await _surface_failure_message(ctx, run_id, msg, pool)
    return _emit_failure_output("render_failed", msg)


class _ProducerStreamCtx:
    """101.1 review WR-03: a shallow ctx proxy that re-points ``run_id`` at the
    PRODUCER stream id for the emit-path render dispatch.

    ``_handle_render_template`` emits ``workspace_file_written`` via
    ``ctx.emit(ctx.redis, ctx.run_id, ...)`` — but on the harness ctx bag,
    ``ctx.run_id`` is the **workflow_runs** id, a stream nobody tails (the exact
    Facet-B routing problem 092-07 fixed everywhere else; compare
    ``_emit_phase_substep``, which prefers ``ctx.producer_run_id``, and
    ``_build_phase_tool_context``, which sets ``run_id=_producer_id``). Without
    this, the live file card never appears mid-run from an emit phase — only the
    plan-09 terminal refetch heals it, and only on a ``completed`` run.

    Every other attribute passes through to the wrapped ctx unchanged (pool /
    supabase / thread_id / current_user / redis / emit / ...).
    """

    def __init__(self, inner, run_id) -> None:
        self._inner = inner
        self.run_id = run_id
        # Phase 141 (COLL-02 / Landmine 2): expose the workflow-run lineage from the RAW
        # bag's run_id (= workflow_runs.id on this emit path) so own_claim_for_ctx derives
        # str(W), NEVER the 'deep' sentinel. This proxy OVERRIDES run_id to the producer id
        # and the harness bag has no workflow_run_id attr, so without this a workflow emit
        # render would mis-claim as Deep and re-open the cross-context leak. A locally-set
        # attribute short-circuits __getattr__.
        self.workflow_run_id = getattr(inner, "run_id", None)

    def __getattr__(self, name: str):
        # Only called when normal lookup misses (run_id/workflow_run_id/_inner resolve locally).
        return getattr(self._inner, name)


async def _exec_llm_emit(phase, accumulated_outputs: dict, ctx) -> dict:
    """The 6th phase type (D-04) — a SEALED, capability-tiered FORCED EMIT.

    Composes the Plan 01 substrate (flat ``EmitFieldMap`` + ``EMITTER_REGISTRY`` + the
    audit kinds) and the Plan 02 core (the gateway forcing seam + ``forced_emit`` with
    D-06 NATIVE recovery + the D-08 truncation guard) into a working forced-emit phase.
    Owns the D-08 6-layer no-fail ladder and the D-12 audit receipt.

    THE DIVERGENCE (D-01 / Pitfall 5): this executor calls ``forced_emit`` (a SEALED
    single shot) — it NEVER drives the open auto-tool-choice agent loop the other LLM
    executors use, the exact GAP-A root cause (reasoning-native models narrate a
    field-map as prose under ``tool_choice=auto`` in an open loop). The guard test
    asserts the open-loop runner name never appears in this function's source.

    Sequence (each transition writes an INSERT-only D-12 receipt):
      1. **GAP-B inject (D-10):** resolve the bound library template AssetRef server-side
         (``_emit_bound_asset_ref`` → ``resolve_template_source``); the model NEVER selects
         it. No template AND no ephemeral upload that resolves => state (e) no_template_bound.
      2. **Layer 1-4 (forced shot):** ``emit_forced`` receipt → ``forced_emit`` (isolation +
         tiered forcing + NATIVE recovery + truncation guard, all inherited from Plan 02).
         A narrated recovery also writes ``emit_recovered``. ``failure=model_failed_to_emit``
         (after Plan 02 recovery + truncation) => state (a) honest fail.
      3. **Citation gate (layer 4):** normalize the flat emission via
         ``emit_field_map_to_legacy`` → ``check_coverage`` BEFORE render. Uncited/invented
         => state (b) citation_gate_rejected (``emit_rejected``) — the render is NEVER
         reached. Else ``emit_validated``.
      4. **Render (post_processor):** ``EMITTER_REGISTRY[emitter].post_processor`` re-dispatches
         the HARDENED ``_handle_render_template`` (one render code path — Task 2 wires it).
         Render error => state (c) render_failed (``emit_failed``). Integrity fail => state
         (d) integrity_failed (``emit_integrity_failed``) — the non-opening file is NEVER
         persisted; the cited field-map is preserved as fallback. Success => ``emit_rendered``.
      5. **Bounded retry (layer 5):** a recoverable failure returns a phase output the
         engine's EXISTING ``_run_phase_with_gates`` re-runs (≤3) — the retry feedback is
         consumed via ``_retry_suffix(ctx)`` in the system prompt. No new loop here.
      6. **Honest failure (layer 6):** every terminal failure persists a real reason via
         ``_surface_failure_message`` (the harness-only branch — never the shared Deep+harness
         terminal path) — never an empty 'done'.
    """
    definition = getattr(ctx, "definition", None)
    emitter = getattr(phase.config, "emitter", "render_template")
    model = _effective_model(phase, ctx)
    run_id = getattr(ctx, "run_id", None)
    pool = getattr(ctx, "pool", None)
    # D-01 (SEED-082): the citation policy decides ONLY the post-verdict disposition
    # (the verdict computation below is UNCHANGED). strict (the default) is byte-
    # identical to today's state-(b) honest fail; flag/partial/draft mark/blank/label
    # the WR-02-persisted field-map and DELIVER — via the deterministic driver, NO new
    # emit shot (the strict path never touches emit_policy).
    citation_policy = getattr(phase.config, "citation_policy", "strict")

    try:
        # ── 1. GAP-B inject (D-10) — resolve the bound template SERVER-SIDE ──────────
        asset_ref = _emit_bound_asset_ref(definition)
        # Phase 141 (COLL-02 / Landmine 1&2): run-scope the ephemeral (Branch 2) fallback
        # when no library asset is bound. The RAW harness bag has NO workflow_run_id attr,
        # so own_claim_for_ctx(ctx) would wrongly derive 'deep' here — instead the bag's
        # run_id IS workflow_runs.id (verified _build_phase_tool_context:354), always a
        # workflow lineage on this path. Guard the None edge (minimal/unit ctx) → own_claim
        # None (the Branch-1 bound-asset path ignores it anyway). This matches the own_claim
        # the emit re-dispatch derives via _ProducerStreamCtx.workflow_run_id (Landmine 1).
        own_claim = str(run_id) if run_id is not None else None
        src = await resolve_template_source(
            pool=pool,
            supabase=getattr(ctx, "supabase", None),
            thread_id=getattr(ctx, "thread_id", None),
            user_id=(getattr(ctx, "current_user", None) or {}).get("id"),
            asset_ref=asset_ref,  # the bound template (NOT None) — the model never selects it
            own_claim=own_claim,
        )
        if not src.get("bytes"):
            # State (e): no template bound AND no ephemeral upload resolved — honest fail.
            msg = (
                "No template is bound to this workflow phase and no usable template was "
                f"found: {src.get('error') or 'no template available'}."
            )
            await _emit_audit(ctx, event_type="emit_failed", metadata=_emit_audit_metadata(
                definition=definition, phase=phase, emitter=emitter, result=None, gate=None,
                render_verdict={"failure": "no_template_bound"}, output_file=None,
            ))
            await _emit_phase_substep(ctx, phase, failure="no_template_bound")  # state (e)
            await _surface_failure_message(ctx, run_id, msg, pool)
            return _emit_failure_output("no_template_bound", msg)

        # ── 2. Forced shot (D-08 layers 1-4) — the SEALED single call, never the loop ─
        # 099 WFSKILL-01 (D-05/D-06): compose the skill framing; F8 retry feedback consumed
        # via _retry_suffix (the layer-5 retry loop is the engine's _run_phase_with_gates).
        system_prompt = phase.config.prompt + _skill_block(phase, ctx, with_files=False) + _retry_suffix(ctx)
        user_turn = _first_phase_user_turn(accumulated_outputs, ctx)
        # 101.1-06: spotlight the retrieved evidence as <doc id=…> blocks so the model has
        # REAL source ids to cite; the SAME walk yields the gate's valid set below — one id
        # namespace, two consumers (prose-only user turns made every citation "invented").
        spotlight, retrieved_ids = _emit_evidence(accumulated_outputs)
        if spotlight:
            user_turn = f"{user_turn}\n\n{spotlight}" if user_turn else spotlight
        # 101.1-06: the template-placeholder oracle — the model must emit EXACTLY the keys
        # the template dereferences (live run 7fa36d2a invented its own collection name and
        # the render died on UndefinedError). Parsed server-side from the resolved bytes.
        oracle = _template_oracle(src)
        if oracle:
            coll_specs = []
            for coll in oracle["collections"]:
                cols = (oracle.get("columns") or {}).get(coll)
                coll_specs.append(
                    f"{coll} (each row's cells keyed EXACTLY: {', '.join(cols)})" if cols else coll
                )
            oracle_text = (
                "TEMPLATE PLACEHOLDERS — emit EXACTLY these keys, names verbatim: "
                f"scalars: {', '.join(oracle['scalars']) or '(none)'}; "
                f"collections (one entry per row): {'; '.join(coll_specs) or '(none)'}. "
                "Every listed key must appear in the field-map; set a value to null when the "
                "sources do not support it."
            )
            user_turn = f"{user_turn}\n\n{oracle_text}" if user_turn else oracle_text
        messages = [{"role": "user", "content": user_turn}] if user_turn else []

        # ── 2b + 3. Bounded forced shot + citation gate (D-08 layers 2-5) ─────────────
        # 101.1-06: the engine's _run_phase_with_gates retry only fires for phases that
        # CONFIGURE validators — the llm_emit citation gate is executor-internal, so the
        # designed layer-5 bounded retry lives HERE: ≤ _EMIT_MAX_ATTEMPTS sealed single
        # shots, each rejection feeding the NAMED offending leaves back (cite-or-null),
        # then the honest state-(b) fail. Retry fires ONLY when there IS retrieval
        # evidence (a non-empty valid set) — with nothing retrieved the model can never
        # cite validly, so the first reject is final (live run cef463f7: 28/32 cited,
        # 0 invented, 4 uncited — exactly the case one feedback round fixes).
        # Receipts are per-attempt (INSERT-only — the attempt trail IS the audit story).
        citation_feedback = ""
        # D-01: when a non-strict citation_policy delivers an uncited map, this holds the
        # surfaced summary/draft-label so the render-success return carries it visibly
        # (the user-facing half of "never a silent pass-off" — T-102-04-03). None on the
        # strict path (which never reaches the render after a citation rejection).
        policy_applied_summary: str | None = None
        # CR-02 (102-08): the non-strict policy threaded onto the render payload (None on
        # the strict / gate-passed path → the handler gate stays byte-identical strict).
        policy_applied_value: str | None = None
        for attempt in range(1, _EMIT_MAX_ATTEMPTS + 1):
            await _emit_phase_substep(ctx, phase, status="forcing")  # building the forced request (tier/thinking-off)
            forced_md = _emit_audit_metadata(
                definition=definition, phase=phase, emitter=emitter,
                result={"tier": None, "provider": getattr(ctx, "provider", None), "forced": None,
                        "recovered_from_narration": None, "truncated": None},
                gate=None, render_verdict=None, output_file=None,
            )
            forced_md["attempt"] = attempt
            await _emit_audit(ctx, event_type="emit_forced", metadata=forced_md)

            await _emit_phase_substep(ctx, phase, status="emitting")  # the forced LLM call is in flight (atomic)
            result = await forced_emit(
                messages=messages,
                model=model,
                provider=getattr(ctx, "provider", None) or _provider_for_model(model, ctx),
                emitter=emitter,
                tools=_emit_forced_tool(emitter),
                user_settings=getattr(ctx, "user_settings", None),
                system_prompt=system_prompt + citation_feedback,
            )

            if result.get("recovered_from_narration"):
                # D-06 fired — record the degraded-but-honest NATIVE recovery transition.
                await _emit_phase_substep(ctx, phase, status="recovering")  # amber tint = degraded but honest
                await _emit_audit(ctx, event_type="emit_recovered", metadata=_emit_audit_metadata(
                    definition=definition, phase=phase, emitter=emitter, result=result,
                    gate=None, render_verdict=None, output_file=None,
                ))

            if result.get("failure"):
                # State (a): the model never emitted (after Plan 02 recovery + truncation guard).
                msg = (
                    "The model did not emit a structured field-map for the template "
                    "(it narrated prose or was truncated) and the deliverable was NOT produced. "
                    "This is an honest failure — no Markdown stand-in is delivered as the artifact."
                )
                await _emit_audit(ctx, event_type="emit_failed", metadata=_emit_audit_metadata(
                    definition=definition, phase=phase, emitter=emitter, result=result,
                    gate=None, render_verdict=None, output_file=None,
                ))
                await _emit_phase_substep(ctx, phase, failure="model_failed_to_emit")  # state (a)
                await _surface_failure_message(ctx, run_id, msg, pool)
                return _emit_failure_output("model_failed_to_emit", msg)

            emitted: EmitFieldMap = result["emitted"]

            # Citation gate (layer 4) — BEFORE render (reject without touching the sandbox).
            legacy_map = emit_field_map_to_legacy(emitted)
            # retrieved_ids computed above by the SAME _emit_evidence walk that built the
            # spotlight (101.1-06) — the model can only have cited ids it was actually shown.
            # placeholder_keys: the PARSED template oracle when available (real coverage —
            # an uncovered key would die in the render as UndefinedError); else the emitted
            # map's own keys (the pre-oracle behavior for non-docx emitters).
            placeholder_keys = (
                (oracle["scalars"] + oracle["collections"]) if oracle else (
                    list(legacy_map.get("scalars", {}).keys())
                    + list(legacy_map.get("collections", {}).keys())
                )
            )
            await _emit_phase_substep(ctx, phase, status="validating")  # citation/coverage gate + truncation guard
            gate = check_coverage(legacy_map, retrieved_ids, placeholder_keys)
            missing_keys = [k for k in placeholder_keys if k not in gate["covered_keys"]]
            # 101.1-06: column coverage — the template derefs specific cell keys inside the
            # row loop ({{ r.risk_id.value }}); a mis-keyed cell would die in the render as
            # UndefinedError (live run 454e30c9). Deterministic, BEFORE the sandbox.
            if oracle:
                for coll, cols in (oracle.get("columns") or {}).items():
                    emitted_rows = (legacy_map.get("collections") or {}).get(coll) or []
                    emitted_cols = set()
                    for row in emitted_rows:
                        emitted_cols |= set((row or {}).keys())
                    if emitted_rows:
                        missing_keys += [f"{coll}.{c}" for c in cols if c not in emitted_cols]
            if (
                gate["uncited_value_count"] == 0
                and gate["invented_citation_count"] == 0
                and not (oracle and missing_keys)
            ):
                break  # gate passed — proceed to render

            # Rejected — per-attempt receipt, then retry-with-feedback or honest fail.
            rejected_md = _emit_audit_metadata(
                definition=definition, phase=phase, emitter=emitter, result=result,
                gate=gate, render_verdict=None, output_file=None,
            )
            rejected_md["attempt"] = attempt
            await _emit_audit(ctx, event_type="emit_rejected", metadata=rejected_md)

            if retrieved_ids and attempt < _EMIT_MAX_ATTEMPTS:
                offenders = ", ".join(
                    (gate.get("uncited_leaves") or []) + (gate.get("invented_leaves") or [])
                ) or "none"
                missing = ", ".join(missing_keys) or "none"
                citation_feedback = (
                    f"\n\nYour previous field-map (attempt {attempt}) was REJECTED by the "
                    f"citation gate: {gate['uncited_value_count']} value(s) had no citation, "
                    f"{gate['invented_citation_count']} cited an id that was never shown, and "
                    f"these REQUIRED template keys were missing: {missing}. "
                    f"Offending fields: {offenders}. Emit EXACTLY the template's keys; for "
                    "EVERY non-null value set source_chunk_id to the exact `id` attribute of "
                    "a <doc> source block; if the sources do not support a value, set its "
                    "value to null (a null is acceptable; an uncited or invented value is not)."
                )
                continue

            # State (b): uncited / invented / missing keys — final (no evidence to cite,
            # or attempts exhausted). The DISPOSITION is governed by citation_policy
            # (D-01) — the verdict above is unchanged; only what happens NOW differs.
            if citation_policy == "strict":
                # strict (the default) — BYTE-IDENTICAL to today's honest fail. The
                # deliverable is NOT produced; the cited field-map is preserved.
                msg = (
                    "The emitted field-map has uncited or invented values or is missing required "
                    "template keys — every non-null value must cite a source that was actually "
                    "retrieved, and every template placeholder must be present. The deliverable "
                    "was NOT produced; the cited field-map is preserved in the run's phase record."
                )
                await _emit_phase_substep(ctx, phase, failure="citation_gate_rejected")  # state (b)
                await _surface_failure_message(ctx, run_id, msg, pool)
                return _emit_failure_output("citation_gate_rejected", msg, field_map=legacy_map)

            # NON-strict (flag/partial/draft) — DELIVER off the WR-02 persisted field-map
            # with marks/blanks/label (SEED-082: every non-strict mode MARKS or BLANKS,
            # never a silent pass-off — T-102-04-03). The deterministic driver re-renders
            # the SAME map (NO new emit shot, NEVER model-written code): we mutate
            # legacy_map IN PLACE so the render dispatch below picks up the modified map.
            from app.services.harness.emit_policy import apply_citation_policy

            applied = apply_citation_policy(legacy_map, gate, citation_policy)
            # WR-06 (102-08): the policy named offenders but matched ZERO leaves to modify
            # (a no-op) — honest-fail back to STRICT rather than claiming a false success.
            # Route through the EXISTING strict honest-fail path (byte-identical) and do
            # NOT set citation_policy_applied (the render gate stays strict).
            if not applied.get("delivered", True):
                msg = (
                    "The emitted field-map has uncited or invented values that the "
                    f"'{citation_policy}' citation policy could not safely mark or blank "
                    f"({applied.get('reason') or 'no matching leaves'}); failing back to "
                    "strict. The deliverable was NOT produced; the cited field-map is "
                    "preserved in the run's phase record."
                )
                await _emit_phase_substep(ctx, phase, failure="citation_gate_rejected")
                await _surface_failure_message(ctx, run_id, msg, pool)
                return _emit_failure_output("citation_gate_rejected", msg, field_map=legacy_map)

            legacy_map = applied["field_map"]  # the marked/blanked/as-is map to render
            policy_summary = applied.get("coverage_summary") or applied.get("draft_label") or ""
            policy_applied_summary = policy_summary  # carried into the render-success text
            # CR-02 (102-08): thread the applied policy onto the resolved render payload so
            # the handler's own citation gate becomes POLICY-AWARE — the policy decision was
            # already made + receipted (policy_applied) and is surfaced ON SUCCESS only
            # (IN-03). The value is present ONLY on this non-strict deliver branch; strict
            # never reaches here, so its resolved payload carries no such key and the gate
            # rejects exactly as today (byte-identical).
            policy_applied_value = citation_policy
            # policy_applied receipt (the Plan-01 kind, live on migration 070) — the
            # governance record that a non-strict policy delivered unverified data.
            policy_md = _emit_audit_metadata(
                definition=definition, phase=phase, emitter=emitter, result=result,
                gate=gate, render_verdict=None, output_file=None,
            )
            policy_md["citation_policy"] = citation_policy
            policy_md["policy_summary"] = policy_summary
            if applied.get("gap_list"):
                policy_md["gap_list"] = applied["gap_list"]
            await _emit_audit(ctx, event_type="policy_applied", metadata=policy_md)
            # IN-03 (102-08): do NOT surface the policy summary pre-render. The user must
            # never be told a delivery succeeded before the render actually succeeds — the
            # summary is folded into the render-SUCCESS text (the single surface) below, and
            # a render FAILURE after the policy surfaces a FAILURE message (not the summary)
            # via the state-c/state-d paths. This kills the "told delivered then told
            # failed" contradiction AND the 101.1 duplicate-message echo.
            # Fall through to the render path with the modified map (the deliverable IS
            # produced, marked/blanked/labeled).
            break

        # emit_validated is the GATE-PASSED receipt — write it only when the citation
        # gate genuinely passed (the strict break at the gate-passed line). When a
        # non-strict policy delivered an uncited map, the policy_applied receipt above
        # is the record (not a false "validated") — skip emit_validated for that path.
        if policy_applied_summary is None:
            await _emit_audit(ctx, event_type="emit_validated", metadata=_emit_audit_metadata(
                definition=definition, phase=phase, emitter=emitter, result=result,
                gate=gate, render_verdict=None, output_file=None,
            ))

        # ── 4. Render (post_processor) — re-dispatch the HARDENED handler (one path) ──
        entry = resolve_emitter(emitter)
        if entry.post_processor is None:
            # Defensive: a registered emitter with no driver cannot produce a deliverable.
            msg = f"The emitter {emitter!r} has no render driver registered."
            await _emit_audit(ctx, event_type="emit_failed", metadata=_emit_audit_metadata(
                definition=definition, phase=phase, emitter=emitter, result=result,
                gate=gate, render_verdict={"failure": "render_failed"}, output_file=None,
            ))
            await _emit_phase_substep(ctx, phase, failure="render_failed")  # state (c) — no driver
            await _surface_failure_message(ctx, run_id, msg, pool)
            return _emit_failure_output("render_failed", msg, field_map=legacy_map)

        await _emit_phase_substep(ctx, phase, status="rendering")  # sealed-sandbox render in flight

        # The post_processor re-dispatches the HARDENED _handle_render_template (one render
        # code path). Thread the server-resolved asset_ref + the validated retrieved-id set
        # through the resolved-template payload so the handler re-resolves the SAME trusted
        # template (the model never selects it) and its citation gate re-passes deterministically.
        resolved = dict(src)
        resolved["asset_ref"] = asset_ref
        resolved["retrieved_ids"] = sorted(retrieved_ids)
        # CR-02 (102-08): present ONLY when a non-strict policy delivered an uncited map
        # — the emitter copies it into the handler args so the citation gate is policy-
        # aware (does not re-reject the deliberately-modified map). None on the strict +
        # gate-passed paths → the handler gate rejects exactly as today (byte-identical).
        if policy_applied_value is not None:
            resolved["citation_policy_applied"] = policy_applied_value
        # WR-03 (101.1 review): hand the render a ctx whose run_id is the PRODUCER
        # stream (the one the frontend tails) so the handler's live
        # workspace_file_written event renders the file card mid-run — never the
        # workflow_runs id (an unsubscribed stream). Falls back to ctx.run_id on a
        # minimal/unit-test ctx with no producer_run_id (same fallback as
        # _emit_phase_substep) — best-effort, never a crash.
        _render_ctx = _ProducerStreamCtx(
            ctx, getattr(ctx, "producer_run_id", None) or getattr(ctx, "run_id", None)
        )
        render_out = await entry.post_processor(legacy_map, resolved, _render_ctx)
        status = (render_out or {}).get("status")

        if status == "ok":
            output_file = render_out.get("output_file") or _output_file_meta(render_out)
            # 104-03 (live-UAT root cause): carry the engine's integrity verdict onto the
            # output-file receipt so a post-phase ``output_file_valid`` validator honors it.
            # The produced file is workspace-INLINE (its ``path`` is a virtual workspace path,
            # not a filesystem path) — a second independent re-open here is impossible, so the
            # validator trusts the engine's opened/residual verdict (the same assert_integrity
            # the executor already ran; status=="ok" guarantees opened + residual_clean True).
            if isinstance(output_file, dict) and "opened" not in output_file:
                _v = render_out.get("verdict") or {}
                output_file = {
                    **output_file,
                    "opened": bool(_v.get("opened", True)),
                    "residual_clean": bool(_v.get("residual_clean", True)),
                }
            await _emit_audit(ctx, event_type="emit_rendered", metadata=_emit_audit_metadata(
                definition=definition, phase=phase, emitter=emitter, result=result, gate=gate,
                render_verdict=render_out.get("verdict"), output_file=output_file,
            ))
            await _emit_phase_substep(ctx, phase, status="validated")  # integrity re-open passed → done (green)
            path = render_out.get("path") or (output_file or {}).get("path")
            base_text = (
                f"Produced the filled deliverable: {path}" if path
                else "Produced the filled deliverable."
            )
            # D-01: a non-strict policy delivery carries its summary VISIBLY in the chat
            # message (the user always SEES the deliverable is marked/blanked/DRAFT —
            # never a silent pass-off, T-102-04-03).
            text = f"{base_text}\n\n{policy_applied_summary}" if policy_applied_summary else base_text
            return {
                "text": text,
                "output_file": output_file,
                "path": path,
                "field_map": legacy_map,
                # 104-03 (live-UAT root cause): expose the SAME valid-id set + oracle keys
                # the internal citation gate just passed on, so a post-phase
                # ``citations_required`` validator (the 102 library — first attached to an
                # ``llm_emit`` phase by the Phase-104 PM defs) re-validates against the real
                # set instead of an empty one. Without these, the validator's check_coverage
                # saw retrieved_ids=∅ → every cited value read "invented" → the run failed
                # AFTER emit_validated + emit_rendered (a real cited .docx was produced).
                "retrieved_ids": sorted(retrieved_ids),
                "placeholder_keys": placeholder_keys,
                "source_refs": [],
                "citations": [],
            }

        # A non-ok render: distinguish integrity failure (state d) from a render error (state c).
        reason = (render_out or {}).get("reason")
        if status == "failed" and reason in ("integrity", "residual_tokens", "harvest_failed", "no_verdict"):
            # State (d): the rendered file won't open / has residual tokens — NEVER persisted.
            msg = (
                "The filled file failed the integrity re-open (it will not open cleanly or "
                "still contains unsubstituted placeholders) and was NOT delivered. The cited "
                "field-map is preserved in the run's phase record as fallback."
            )
            await _emit_audit(ctx, event_type="emit_integrity_failed", metadata=_emit_audit_metadata(
                definition=definition, phase=phase, emitter=emitter, result=result, gate=gate,
                render_verdict=(render_out or {}).get("verdict") or {"failure": "integrity_failed"},
                output_file=None,
            ))
            await _emit_phase_substep(ctx, phase, failure="integrity_failed")  # state (d)
            await _surface_failure_message(ctx, run_id, msg, pool)
            return _emit_failure_output("integrity_failed", msg, field_map=legacy_map)

        # State (c): a render error (sandbox error / bad asset / resolution) — honest fail.
        msg = (
            "The template render failed: "
            + str((render_out or {}).get("message") or reason or "unknown render error")
            + ". The deliverable was NOT produced; the cited field-map is preserved in "
            "the run's phase record."
        )
        await _emit_audit(ctx, event_type="emit_failed", metadata=_emit_audit_metadata(
            definition=definition, phase=phase, emitter=emitter, result=result, gate=gate,
            render_verdict={"failure": "render_failed", "reason": reason}, output_file=None,
        ))
        await _emit_phase_substep(ctx, phase, failure="render_failed")  # state (c)
        await _surface_failure_message(ctx, run_id, msg, pool)
        return _emit_failure_output("render_failed", msg, field_map=legacy_map)
    except Exception as _emit_exc:  # noqa: BLE001 — D-08 layer-6 executor backstop
        # gap 1b: ANY raise inside the ladder (render dispatch throwing, an
        # unexpected error) is converted to an honest receipt + ONE surfaced
        # message + a flagged output — NEVER a silent escape to the engine generic
        # run-failed catch (which would strand the workflow_phases row in active).
        return await _emit_unexpected_failure(
            phase, definition=definition, emitter=emitter, run_id=run_id,
            pool=pool, ctx=ctx, exc=_emit_exc,
        )


def _provider_for_model(model: str, ctx) -> str | None:
    """Resolve the provider for the forced shot from the model registry (default-SAFE).

    The forced-emit substrate routes the gateway by provider; source it from the model's
    own MODEL_CAPABILITIES row (the same registry ``forced_emit`` reads for the tier).
    ``None`` when unknown — ``forced_emit``'s default-SAFE tier resolution then coerces."""
    from app.config import get_model_capability

    cap = get_model_capability(model) or {}
    return cap.get("provider")


def _output_file_meta(render_out: dict) -> dict | None:
    """Derive the D-12 output-file receipt (path + sha256 + bytes) from a render result
    that returned the produced bytes inline rather than a pre-built ``output_file`` dict.

    The sha256 is a stdlib ``hashlib`` hex digest (V6 — never hand-rolled). ``None`` when
    the render result carries no path/bytes to hash."""
    path = render_out.get("path")
    produced = render_out.get("produced")
    if path is None and produced is None:
        return None
    meta: dict = {"path": path}
    if isinstance(produced, (bytes, bytearray)):
        meta["sha256"] = hashlib.sha256(bytes(produced)).hexdigest()
        meta["bytes"] = len(produced)
    elif render_out.get("size_bytes") is not None:
        meta["bytes"] = render_out.get("size_bytes")
    return meta


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


# ── Phase 189 (CONN-01) — the 7th executor: the governed EXTERNAL ACTION ─────
#
# The step that reaches outside this app and, in 189, SENDS NOTHING (SC#4). Two closed
# tables key the copy off the capability so no sentence is ever improvised at call time —
# an improvised negation is how "No email was sent." quietly becomes "Email delivered."
# three refactors from now. The phrases are the SAME business words the canvas shows
# (`189-UI-SPEC.md` §9d — one vocabulary, two surfaces); the negations are the closed
# table that section mandates.
_EXTERNAL_ACTION_PHRASE: dict[str, str] = {
    "send_email": "Sends an email",
    "create_ticket": "Creates a ticket",
    "post_message": "Posts a message",
}
_EXTERNAL_ACTION_NEGATION: dict[str, str] = {
    "send_email": "No email was sent.",
    "create_ticket": "No ticket was created.",
    "post_message": "No message was posted.",
}
# Static, data-independent — the same fence shape ``grounding.py`` puts directly under
# EXTERNAL_ACTION_CAPABILITIES. It can only fire when someone edits one of the three
# spellings, which is precisely when it should: a 4th capability MUST arrive with its own
# words rather than falling back to a generic sentence.
assert (
    set(_EXTERNAL_ACTION_PHRASE)
    == set(_EXTERNAL_ACTION_NEGATION)
    == set(EXTERNAL_ACTION_CAPABILITIES)
), (
    "189: the external-action copy tables and EXTERNAL_ACTION_CAPABILITIES disagree — "
    f"phrases={sorted(_EXTERNAL_ACTION_PHRASE)}, "
    f"negations={sorted(_EXTERNAL_ACTION_NEGATION)}, "
    f"capabilities={sorted(EXTERNAL_ACTION_CAPABILITIES)}"
)

# The sentinel key the executor puts on its ORDINARY output dict. The engine branches on
# it to write the `recorded_not_sent` status — that branch is plan 189-11's, and this is
# exactly the mechanism 101.1 invented for the same class of problem (``output["failure"]``
# → ``fail_phase`` at the ``harness_engine`` seam). Naming it here so the producer and the
# consumer cannot drift on a bare string literal.
RECORDED_INTENT_KEY = "recorded_intent"

# The rendered body is for a HUMAN; the structured record is the DATA. Long values are
# clipped in the text only — ``recorded_intent`` keeps them whole, because that is the
# record Phase 190 will one day actually send.
_INTENT_TEXT_MAX_CHARS = 500


def _clip_for_body(value) -> str:
    """One-line, length-bounded rendering of a resolved input for the TEXT block only."""
    text = value if isinstance(value, str) else json.dumps(value, default=str)
    text = " ".join(text.split())
    if len(text) > _INTENT_TEXT_MAX_CHARS:
        text = f"{text[:_INTENT_TEXT_MAX_CHARS]}… ({len(text)} chars — kept in full in the record)"
    return text


# WR-02 — keys the RUN puts on ``ctx.inputs`` that are not parameters of any action.
# ``kickoff_prompt`` is the user's original chat question (SEED-047), present on every live
# run; rendering it under "What this step would have done" asserts it is an input to the
# send. Closed and named, for the reason spelled out in ``_external_action_inputs``.
_NON_ACTION_RUN_INPUTS: frozenset[str] = frozenset({"kickoff_prompt"})


def _external_action_inputs(accumulated_outputs: dict, ctx) -> dict:
    """The inputs the action WOULD have used, resolved with the neighbouring executors'
    shipped conventions and nothing new.

    ``ExternalActionPhaseConfig`` carries no input fields of its own — deliberately
    (`models/harness.py`: "NO SHAPE-SYMMETRY OPTIONALS, and the omission is the
    decision"). So the material is the same two sources every other executor reads:

      * the run's top-level inputs (``ctx.inputs``) — ``_exec_programmatic``'s
        ``run_inputs`` fallback reads exactly this bag;
      * the latest upstream phase's ``text`` — ``_latest_phase_text``, the reverse scan
        ``_exec_llm_human_input`` uses to find the draft it asks a human to confirm.

    An explicit run input named ``content`` WINS over the upstream text: the author named
    it, so it is not silently overwritten by a derived value.

    ── REVIEW FINDING WR-02 · RUN SCAFFOLDING IS NOT AN ACTION INPUT ──
    ``ctx.inputs`` is the run's LAUNCH bag, not a parameter list, and on every live run it
    carries ``kickoff_prompt`` — the user's original CHAT QUESTION (SEED-047, threaded by
    ``_kickoff_prompt`` above). Sweeping it in whole meant the NOT-SENT body rendered

        What this step would have done
          Action        : Sends an email
          kickoff_prompt: send Sarah the renewal summary

    under a heading that ASSERTS these are the action's inputs — claiming the user's chat
    question is a parameter of an email, which it is not. It was persisted too, into
    ``recorded_intent["inputs"]`` and thence ``workflow_phases.output``. On the one surface
    in this phase whose entire discipline is not over-claiming, that is the wrong direction
    to be wrong in. The three no-egress tests never saw it because ``_run_ctx()`` starts
    from ``inputs={}`` and assigns only hand-picked keys; the ENGINE drive
    (``test_harness_engine.py``) does set ``kickoff_prompt``, which is what the review read.

    Excluded by NAME, never by heuristic. A prefix rule or a type test would silently eat a
    real action input the day someone names one badly; this frozenset is a list of keys the
    RUN puts on the bag, and a future scaffolding key belongs in it rather than in a
    cleverer filter.
    """
    resolved: dict = {
        str(k): v
        for k, v in (getattr(ctx, "inputs", None) or {}).items()
        if str(k) not in _NON_ACTION_RUN_INPUTS
    }
    upstream = _latest_phase_text(accumulated_outputs)
    if upstream.strip() and "content" not in resolved:
        resolved["content"] = upstream
    return resolved


def _external_action_body(capability: str, resolved: dict) -> str:
    """Compose the NOT-SENT body — three blocks, and the phrasing rules are BINDING
    (`189-UI-SPEC.md` §9d):

      1. it OPENS with the negation, never with the action;
      2. a "what this step would have done" block naming the action in business words
         plus the resolved inputs;
      3. a closing negation drawn from the CLOSED table above, followed by a sentence
         naming what the record is NOT.

    No checkmark, and no past-tense success verb about the action itself ("done",
    "delivered", "sent to"). **A recorded intent that reads like a receipt is the failure
    mode this whole phase exists to avoid** — it is the Control Room's
    ``consequence ≠ receipt`` rule, and `tests/unit/test_189_no_egress.py` fences it.
    """
    labels = ["Action", *(str(k) for k in resolved)]
    width = max(len(lbl) for lbl in labels)
    lines = [
        "NOT SENT — recorded only.",
        "",
        "What this step would have done",
        f"  {'Action'.ljust(width)}: {_EXTERNAL_ACTION_PHRASE[capability]}",
    ]
    lines += [f"  {str(key).ljust(width)}: {_clip_for_body(value)}" for key, value in resolved.items()]
    lines += [
        "",
        f"{_EXTERNAL_ACTION_NEGATION[capability]} Nothing left this workflow. "
        "This is a record of an intention, not a receipt.",
    ]
    return "\n".join(lines)


async def _exec_external_action(phase, accumulated_outputs: dict, ctx) -> dict:
    """Resolve a capability against the CLOSED set, RECORD what it would have done, and
    send NOTHING (Phase 189 / CONN-01 — D-01, D-02, D-05, D-22).

    ⚠ **SC#4: this executor performs NO network I/O.** It opens no HTTP client, no
    connection of any other kind, and no remote-tool-protocol client.

    ⚠ **NOTHING IN THIS FUNCTION MAY NAME A TRANSPORT, NOT EVEN TO DENY IT.** Two source
    fences read this file rather than its behaviour: `tests/unit/test_189_no_egress.py`
    walks every ``*.py`` under ``backend/app`` for the remote-tool protocol's three-letter
    token, and plan 189-09's acceptance criteria grep this executor's own body for HTTP
    client library names — both requiring ZERO. That is deliberate rather than pedantic: a
    fence with a prose exemption is a fence somebody widens later, and "the token appears
    zero times in the app" is a claim you can only make if it appears zero times. Both
    fences caught an earlier draft of THIS paragraph, which is the best argument for them.

    `tests/unit/test_189_no_egress.py` proves the no-egress half by
    FALSIFICATION: every HTTP transport is patched to RAISE, this function runs, and it
    must return normally. Live connectors are Phase 190, which swaps the no-op here for a
    real call behind an unchanged seam — ONE function to replace.

    ── D-02 · the closed-set resolution ──
    The capability is looked up in ``EXTERNAL_ACTION_CAPABILITIES`` (the ONE runtime home,
    `harness/grounding.py`) and an absent name RAISES — never resolved dynamically, never
    ``eval``'d, and never falling back to a default capability. That is the rule
    ``_TOOL_REGISTRY``, ``PROGRAMMATIC_PHASE_REGISTRY`` and ``EMITTER_REGISTRY`` all share,
    and the raise below copies ``_exec_programmatic``'s wording deliberately.

    ⚠ **DO NOT DELETE THIS CHECK AS REDUNDANT.** In practice
    ``ExternalActionPhaseConfig.capability`` is a ``Literal`` of exactly three, so a bad
    name is already a ``ValidationError`` at parse time. This is the SECOND line of
    defence, for a row that reached the engine another way (a hand-edited JSONB row, a
    future partial-update path, a caller that builds a ``PhaseSpec`` by hand), and it is
    what D-02 asks for in as many words.

    ── D-22 · a STEP the executor performs, not a tool the LLM may call ──
    There is no agent loop here, no ``tools_override``, no streaming iteration and no
    model call of any kind. The capability name rides ``available_tools`` as a GOVERNANCE
    DECLARATION (D-03) — the ``render_template`` precedent MINUS layer 1 (see
    ``_effective_tools``' two-layer docblock). Making it a callable tool would mean an LLM
    decides *whether and how* to send, which contradicts D-05 and D-02 both, and would
    ship most of the plumbing for the live egress SC#4 forbids.

    ── The substrate this deliberately does NOT reuse ──
    ``_exec_llm_human_input``. It times out and returns NORMALLY, so the run ADVANCES — a
    fail-OPEN shape. The armed action-risk checkpoint 189 inherits runs through a
    different path with an indefinite, shutdown-safe wait and is already fail-CLOSED
    (189-05). **This executor runs AFTER approval and owns no waiting at all.**

    ── D-05 · what it returns ──
    A plain dict carrying ``text`` (the human-readable NOT-SENT body, the key
    ``_latest_phase_text`` scans for) plus the ``recorded_intent`` sentinel holding the
    structured record: the capability and the resolved inputs, and nothing else. The
    ENGINE branches on that key to persist ``recorded_not_sent`` — the ``output["failure"]``
    → ``fail_phase`` mechanism, one branch over. **That engine branch is plan 189-11's;
    until it lands the phase simply completes, and the record is still written.**
    """
    capability = getattr(phase.config, "capability", None)
    if capability not in EXTERNAL_ACTION_CAPABILITIES:
        raise KeyError(
            f"external_action phase {getattr(phase, 'slug', '?')!r}: capability "
            f"{capability!r} is not registered in EXTERNAL_ACTION_CAPABILITIES "
            f"(closed set — register it explicitly)"
        )

    resolved = _external_action_inputs(accumulated_outputs, ctx)
    logger.info(
        "189 D-05/SC#4: external_action phase %r RECORDED the intended %r and sent "
        "nothing — no outbound call was made and none is possible in this phase",
        getattr(phase, "slug", "?"),
        capability,
    )
    return {
        "text": _external_action_body(capability, resolved),
        RECORDED_INTENT_KEY: {"capability": capability, "inputs": resolved},
    }


# ── registration ──────────────────────────────────────────────────────────
# The 7 executors keyed by phase_type — the engine's PHASE_TYPE_REGISTRY dispatch
# seam (Plan 02) resolves each of these. 101.1 (D-04) adds the 6th: ``llm_emit`` (the
# SEALED FORCED EMIT — the only path that produces a typed deliverable).
PHASE_TYPE_REGISTRY_ENTRIES: dict = {
    "programmatic": _exec_programmatic,
    "llm_single": _exec_llm_single,
    "llm_agent": _exec_llm_agent,
    "llm_batch_agents": _exec_llm_batch_agents,
    "llm_human_input": _exec_llm_human_input,
    # 101.1 — the 6th (the forced-emit phase, D-04):
    "llm_emit": _exec_llm_emit,
    # 189 CONN-01 — the 7th (the governed external action, D-01): resolves a closed
    # capability, RECORDS what it would have done, and SENDS NOTHING (SC#4).
    "external_action": _exec_external_action,
}


def register_all() -> None:
    """Register the 7 executors into the engine's PHASE_TYPE_REGISTRY dispatch seam.

    Imported by ``harness/__init__`` so registration happens whenever the harness
    package (and therefore the engine) is used.
    """
    from app.services.harness_engine import PHASE_TYPE_REGISTRY

    PHASE_TYPE_REGISTRY.update(PHASE_TYPE_REGISTRY_ENTRIES)


# Register at import time (idempotent dict.update).
register_all()

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

from starlette.concurrency import run_in_threadpool

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

# ── Phase 190 (CONN-02 / CONN-03) — the four names the external-action send path needs ──
#
# ⚠ THEY ARE IMPORTED INTO **THIS MODULE'S OWN NAMESPACE**, DELIBERATELY, AND IT IS A
# SECURITY PROPERTY RATHER THAN AN IMPORT STYLE. ``validate_destination`` and
# ``resolve_connection`` are what D-06's ordering is asserted over: because they are
# module attributes here, ``tests/unit/test_190_egress_ordering.py`` can install recording
# stubs with ``monkeypatch.setattr(phase_types, ..., raising=True)`` and read back the ORDER
# the executor called them in. A module-qualified call (``egress.validate_destination(...)``)
# or a transport subclass would make the ordering unobservable, which is exactly the shape
# RESEARCH §R10 rejected — *"a transport subclass makes the guard implicit, and D-06's whole
# point is that the ordering must be assertable directly."* If a future author "tidies" these
# into qualified calls, three drives fail loudly at the ``setattr`` rather than passing over
# an executor they never touched.
#
# ⚠ CR-02 adds a FIFTH name, ``ensure_settings_fresh``, to this same namespace and for the
# same reason: the kill-switch drive stubs it with ``monkeypatch.setattr(phase_types, …)`` to
# simulate the operator's flip arriving on another worker. A module-qualified call would make
# that unobservable.
from app.models.user_settings import (
    _GOVERNED_FEATURES,
    ensure_settings_fresh,
    feature_audience,
)
from app.security.egress import SLACK_API_BASE, validate_destination
from app.services.connector_service import ConnectorDisabled, resolve_connection
from app.services.connectors.args import resolve_arguments, schema_for_bound_tool
from app.services.connectors.grants import resolve_effective_posture
from app.services.connectors.protocol import AdapterError
from app.services.connectors.registry import get_adapter
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

# ── llm_human_input — MOVED to app.services.harness.human_input (G-5 / D-13, 2026-08-19) ──
from app.services.harness.human_input import _exec_llm_human_input, _latest_phase_text  # noqa: F401

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


# ── Phase 205 (STATE-01 / STATE-02 / D-03 / D-05) ───────────────────────────
# Living register / incremental stateful execution variable interpolation
def _interpolate_prior_run_variables(text: str, prior_run: dict | None) -> str:
    """Interpolate {{prior_run.*}} template variables into prompt text (Phase 205 / STATE-01).

    Replaces:
      - ``{{prior_run.output}}`` -> prior deliverable text (or baseline notice on cold start)
      - ``{{prior_run.id}}`` -> prior run ID
      - ``{{prior_run.created_at}}`` -> prior run timestamp
    """
    if not text:
        return ""

    if prior_run:
        output_text = prior_run.get("deliverable_text")
        if output_text is None:
            raw_out = prior_run.get("output")
            if isinstance(raw_out, dict):
                output_text = raw_out.get("text") or ""
            elif isinstance(raw_out, str):
                output_text = raw_out
            else:
                output_text = ""

        run_id = str(prior_run.get("id") or prior_run.get("run_id") or "")
        created_at = str(prior_run.get("created_at") or "")
    else:
        output_text = "[Initial Run - No Prior State]"
        run_id = ""
        created_at = ""

    interpolated = text.replace("{{prior_run.output}}", output_text)
    interpolated = interpolated.replace("{{prior_run.id}}", run_id)
    interpolated = interpolated.replace("{{prior_run.created_at}}", created_at)
    return interpolated


def _stateful_framing_block(ctx) -> str:
    """Phase 205 (STATE-02 / D-05) — Living register prompt framing for stateful workflows.

    Instructs the model on change badge conventions ([NEW], [UPDATED], [RESOLVED]) when prior
    run output is present or when running in stateful mode.

    NOTE (N-4): STATE-02 is satisfied via prompt-framing and markdown badges in deliverable text.
    Structured JSON deltas payload is deferred with a re-open trigger (when automated downstream
    aggregators require structured diff APIs).
    """
    prior_run = getattr(ctx, "prior_run", None)
    definition = getattr(ctx, "definition", None)
    if prior_run is None and not (getattr(definition, "is_stateful", False)):
        return ""

    return (
        "\n\n## Living Register & Incremental Updates (Stateful Execution)\n"
        "This workflow maintains an ongoing register across recurring runs.\n"
        "When comparing current findings with the previous run, format state changes clearly using markdown badges:\n"
        "- `[NEW]` for items, findings, or tasks discovered in this run that were not in the prior state.\n"
        "- `[UPDATED]` for items from the prior state whose status, details, or severity have changed.\n"
        "- `[RESOLVED]` or `[CLOSED]` for items from the prior state that are now resolved, completed, or no longer active.\n"
        "Preserve existing unchanged items to maintain continuity in the register."
    )


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


async def _effective_model_checked(phase, ctx) -> str:
    """Phase 196 Plan 03 (D-10) — ``_effective_model`` routed through the SHIPPED
    disabled-model resolver before a per-phase id ever reaches a provider.

    INVARIANT: an ENABLED model is a STRICT no-op — same value, no notice, no receipt. A
    DISABLED one is substituted and never silently: ONE ``model_fallback`` sub-step on the
    producer stream the frontend already tails, plus ONE durable ``policy_applied`` receipt
    naming both ids (no 25th audit kind — that kind already means exactly this).
    FAIL-OPEN, a DECISION rather than an inherited default: a registry-read blip returns the
    model unchanged, so a disabled model runs rather than the phase sinking — the shipped
    chat posture. Failing closed would make an infrastructure hiccup look like an authoring
    error. The import is FUNCTION-LOCAL (the resolver reaches ``app.api.threads`` late); A1
    (no harness import cycle) is proven by a real fresh import in the 196-03 unit file.
    """
    from app.services.run_model_resolution import _resolve_enabled_model  # noqa: PLC0415 — late (A1)
    org_default = getattr(getattr(ctx, "user_settings", None), "llm_model", "") or ""
    resolved, notice = await _resolve_enabled_model(_effective_model(phase, ctx), org_default)
    if not notice:
        return resolved
    await _emit_phase_substep(ctx, phase, status="model_fallback")
    await _emit_audit(ctx, event_type="policy_applied", metadata={
        "policy": "model_disabled_fallback", "phase": getattr(phase, "slug", None),
        "disabled_model": notice.get("disabled_model"),
        "fallback_model": notice.get("fallback_model"), "message": notice.get("message"),
    })
    return resolved


def _build_phase_tool_context(phase, ctx, *, model: str | None = None) -> ToolContext:
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
        # 196-03 (D-10): the CHECKED model when an async caller resolved one — THIS is what
        # the sub-agent runs on (run_task_sub_agent reads parent_ctx.model, not the caller's
        # local). Omitted => the shipped sync fallback, byte-identical.
        model=model if model is not None else _effective_model(phase, ctx),
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


# ── 200 (DES-02 / D-07): the DECLARED per-step measure ────────────────────────
# Key carried inside the executor's own returned dict. ``harness_engine._persist_output``
# stores each executor dict FULL AND INLINE in ``workflow_phases.output`` (CR-02), so this
# rides an existing jsonb column: no new column, no migration, no second write.
MEASURE_KEY = "_measure"


def _measure(count: int, noun: str) -> dict:
    """Build the ``{"_measure": {"count", "noun"}}`` fragment for a DECLARING phase type.

    ⚠ **A PHASE TYPE DECLARES A COUNT ONLY WHERE A COUNT IS ALREADY A FACT IN ITS OWN
    OUTPUT.** The number is read off something the executor genuinely produced
    (``len(source_refs)`` / ``len(sub_run_ids)`` / ``len(field_map)``) — it is never
    authored by a model and never derived structurally by counting whichever key happens
    to be a list. That structural derivation was OFFERED AND REJECTED (D-07): outputs
    differ in shape per phase type and **no key marks "the thing produced"**, so a generic
    count would silently mean something different on every type.

    ⚠ **A TYPE WITH NO REAL NUMBER EMITS NO KEY AT ALL** — not ``0``, not ``null``, not a
    dash. FOUR of the seven do exactly that (``programmatic``, ``llm_single``,
    ``llm_human_input``, ``external_action``). The absence has to be an ABSENT KEY so the
    client's arm can be ``hasOwnProperty``-shaped rather than ``?? 0``-shaped; a ``None``
    with a noun beside it would render as a real measurement of zero.

    ⚠ **BUT ``count: 0`` IS A REAL FACT AND IS EMITTED** (IDIOM-3 / SEED-159). A step that
    searched and found nothing genuinely measured zero, and that is a DIFFERENT statement
    from "this type does not count things". ``source_refs: []`` therefore yields
    ``{"count": 0, "noun": "sources"}`` and must never be collapsed into silence — folding
    the two together is the defect, in both directions.

    ⚠ **THE NOUN IS THE STEP'S OWN, NEVER THE CONTRACT'S AND NEVER THE DOMAIN'S** (D-07 /
    SEED-168, and it is AUTHORED COPY recorded in ``200-CHECKLIST.md`` §5.1). The three
    words are ``sources`` / ``agents`` / ``fields`` — domain-neutral by construction. The
    sketch's ``312 docs matched`` / ``48 fields extracted`` phrasing is a DOMAIN sentence,
    and letting a model author that number would ship the fabricated business figure
    ``199-05`` named "the highest-consequence lie this phase could ship". Each noun is
    spelled at exactly ONE executor site so a later wording change is a one-line edit.

    ⚠ ``programmatic`` DELIBERATELY DECLARES NOTHING even though several of its registry
    members return lists. Its ``fn``s are pluggable and their shapes differ per ``fn``, so
    ``len(whatever_list_is_there)`` is exactly the structural derivation D-07 rejected —
    and a per-``fn`` declaration would be a FOURTH concern in this module, which G-5 fires on.
    """
    return {MEASURE_KEY: {"count": count, "noun": noun}}


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


def _run_usage_box(ctx) -> dict | None:
    """The RUN-level cumulative token accumulator the engine put on ``ctx``, if any.

    Phase 204 (SCHED-02). ``harness_engine.run_workflow`` sets ``ctx.run_usage_box = {}``
    once per run and the circuit breaker reads it after every phase. Executors below
    thread it into the substrate that already knows how to fill it.

    ⚠ ``getattr`` WITH A SAFE DEFAULT, LIKE EVERY OTHER FIELD THIS MODULE READS OFF THE
    CTX BAG. A Deep run, a unit stub and a publish golden run all reach these executors
    with a ctx that has no box — they get ``None`` and every call below is byte-identical
    to what shipped. The box's ABSENCE is the disarmed case, and it is the common one.
    """
    box = getattr(ctx, "run_usage_box", None)
    return box if isinstance(box, dict) else None


def _record_run_usage(ctx, input_tokens, output_tokens) -> None:
    """SUM one completed sub-agent's usage into the run-level box.

    ⚠ THE SUM HAPPENS HERE AND NOT IN THE SUB-AGENT, AND THAT IS NOT AN ACCIDENT.
    ``run_task_sub_agent`` keeps its OWN ``_sub_usage`` box because it persists that total
    to its own ``runs`` row on finalize; handing it the run-level box instead would make
    sub-run N record the cumulative spend of sub-runs 1..N — a silent, plausible,
    permanently wrong number in a column the Deep drill-down renders. So the sub-agent
    keeps its local box, RETURNS the total (204-02 widened its return dict), and the
    addition lands here where the scope is the run.

    ⚠ ``None`` ADDS NOTHING. A provider that emitted no usage must not be read as zero;
    the two are different facts and only the first is worth a warning (which
    ``run_task_sub_agent`` already logs).
    """
    box = _run_usage_box(ctx)
    if box is None:
        return
    if input_tokens:
        box["input_tokens"] = (box.get("input_tokens") or 0) + int(input_tokens)
    if output_tokens:
        box["output_tokens"] = (box.get("output_tokens") or 0) + int(output_tokens)


async def _exec_llm_single(phase, accumulated_outputs: dict, ctx) -> dict:
    """One bounded LLM call — no tools. The phase prompt is the system framing.

    Re-running on resume is one paid call (Pitfall 5 — acceptable v1; no mid-stream
    checkpoint is possible). Consumes ctx.retry_feedback (producer = Plan 05).
    """
    # 099 WFSKILL-01 (D-05/D-07): compose the skill framing BEFORE the retry suffix.
    # llm_single runs tools=[], so read_skill_file is inert and the file manifest would
    # be dead weight — pass no-files so only the instructions compose ('' when no snapshot).
    # Phase 205: interpolate {{prior_run.*}} variables and attach stateful framing.
    _raw_prompt = _interpolate_prior_run_variables(phase.config.prompt, getattr(ctx, "prior_run", None))
    system_prompt = (
        _raw_prompt
        + _skill_block(phase, ctx, with_files=False)
        + _stateful_framing_block(ctx)
        + _retry_suffix(ctx)
    )
    # F8 (092-07): first phase → the user's kickoff question; later phases → prior
    # output (chaining unchanged). Without this the first phase saw an empty user turn.
    content, _tool_calls = await _stream_one_iteration(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": _first_phase_user_turn(accumulated_outputs, ctx)},
        ],
        tools=[],
        model=await _effective_model_checked(phase, ctx),
        user_settings=getattr(ctx, "user_settings", None),
        # Phase 204 (SCHED-02) — THE RUN-LEVEL BOX, PASSED STRAIGHT THROUGH. This is the
        # one executor that reaches a provider directly rather than through a sub-agent,
        # and `_stream_one_iteration` has SUMMED each turn's usage into whatever box it is
        # handed since Phase 093 (D-17). Nothing new accumulates anything: the box that
        # was already being filled is now the run's, so an llm_single phase's spend
        # reaches the circuit breaker. `None` when no breaker is armed — the shipped
        # `usage_box is None` branch then allocates a throwaway local, exactly as before.
        usage_box=_run_usage_box(ctx),
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
    model = await _effective_model_checked(phase, ctx)

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

    phase_ctx = _build_phase_tool_context(phase, ctx, model=model)

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
    # Phase 205: interpolate {{prior_run.*}} variables and attach stateful framing.
    _raw_prompt = _interpolate_prior_run_variables(phase.config.prompt, getattr(ctx, "prior_run", None))
    system_prompt = (
        _raw_prompt
        + _skill_block(phase, ctx)
        + _stateful_framing_block(ctx)
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
    # Phase 204 (SCHED-02): fold this sub-agent's token spend into the run-level box the
    # circuit breaker reads. Same shape as the F7 hand-off directly below — a fact the
    # sub-agent already produced, threaded up to the one scope that can act on it.
    _record_run_usage(ctx, result.get("input_tokens"), result.get("output_tokens"))
    # F7 (092-07): thread the grounding the sub-agent gathered (search_documents'
    # source_refs/citations/similarity) up to the phase output. The engine unions
    # it across ALL phases and attaches the accumulated set to the final answer —
    # so a Research→Summarize workflow shows the RESEARCH phase's sources on the
    # SUMMARIZE phase's prose (the final phase has none of its own).
    agent_source_refs = result.get("source_refs") or []
    return {
        "text": result["summary"],
        "sub_run_id": str(result["sub_run_id"]),
        "source_refs": agent_source_refs,
        "citations": result.get("citations") or [],
        "similarity_scores": result.get("similarity_scores") or [],
        "retrieval_error": result.get("retrieval_error"),
        # 200 (D-07) — DECLARED measure, site 1 of 3. The number is a fact this executor
        # already produced: how many grounding sources the sub-agent actually gathered.
        # ⚠ ZERO IS EMITTED, NOT SUPPRESSED: a sub-agent that searched and found nothing
        # measured 0 sources, which is a REAL fact and is not the same statement as "this
        # phase type does not count things" (IDIOM-3 / SEED-159). The noun is AUTHORED COPY
        # (200-CHECKLIST.md §5.1) and this is its ONE home in the tree.
        **_measure(len(agent_source_refs), "sources"),
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
    model = await _effective_model_checked(phase, ctx)
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
    # Phase 205: interpolate {{prior_run.*}} variables and attach stateful framing.
    _raw_prompt = _interpolate_prior_run_variables(phase.config.prompt, getattr(ctx, "prior_run", None))
    base_prompt = (
        _raw_prompt
        + _skill_block(phase, ctx)
        + _stateful_framing_block(ctx)
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
            phase_ctx = _build_phase_tool_context(phase, ctx, model=model)
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
    # Phase 204 (SCHED-02): EVERY branch's spend counts, and this is the phase type where
    # a runaway is most expensive — N parallel sub-agents, each with its own step budget.
    # Folded after the gather rather than inside `_one` so the addition is not racing
    # itself across N concurrent coroutines on a plain dict.
    for _r in results:
        _record_run_usage(ctx, _r.get("input_tokens"), _r.get("output_tokens"))
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

    batch_retrieval_error = next(
        (r.get("retrieval_error") for r in results if r.get("retrieval_error")),
        None,
    )
    return {
        "text": merged,
        "sub_run_ids": sub_run_ids,
        "source_refs": batch_source_refs,
        "citations": batch_citations,
        "similarity_scores": batch_similarity_scores,
        "retrieval_error": batch_retrieval_error,
        # 200 (D-07) — DECLARED measure, site 2 of 3. How many parallel sub-agents this
        # phase actually fanned out to — one ``sub_run_id`` per branch that really ran, so
        # the number is the executor's own fact and not a re-derivation of the config's
        # ``max_parallel_agents`` cap (which is a LIMIT, not a count of what happened).
        # ⚠ Counting ``sub_run_ids`` rather than ``source_refs`` on purpose: the grounding
        # lists are UNIONED across branches here, so their length answers a different
        # question. The noun is AUTHORED COPY (§5.1) and this is its ONE home.
        **_measure(len(sub_run_ids), "agents"),
    }


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
    model = await _effective_model_checked(phase, ctx)
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
                # 200 (D-07) — DECLARED measure, site 3 of 3, and the ONLY success return
                # in this executor (every other exit routes through _emit_failure_output /
                # _emit_unexpected_failure, which declare nothing — a failed emit produced
                # no deliverable and has no honest count to report).
                # ⚠ WHAT THIS NUMBER MEANS, PRECISELY: ``len(field_map)`` is the count of
                # TOP-LEVEL entries in the legacy field-map — each scalar key, plus each
                # collection as ONE entry. It is deliberately NOT a leaf-cell count: the
                # map is the emitted deliverable's field structure, and that is the thing
                # a person means by "how many fields did it fill". The noun is AUTHORED
                # COPY (§5.1) and this is its ONE home.
                **_measure(len(legacy_map), "fields"),
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


def _external_action_mcp_body(tool_name: str, resolved: dict) -> str:
    """Compose the NOT-SENT body for an MCP external action step.

    ⚠ Phase 206.3 / G-1 / D-206.3-05: `_external_action_body` indexes `capability` in TWO places
    (_EXTERNAL_ACTION_PHRASE and _EXTERNAL_ACTION_NEGATION). For an MCP step, `capability` is None.
    This composer is separate by design and MUST contain ZERO `[capability]` indexes.
    """
    labels = ["Action", *(str(k) for k in resolved)]
    width = max(len(lbl) for lbl in labels)
    lines = [
        "NOT SENT — recorded only.",
        "",
        "What this step would have done",
        f"  {'Action'.ljust(width)}: Call MCP tool '{tool_name}'",
    ]
    lines += [f"  {str(key).ljust(width)}: {_clip_for_body(value)}" for key, value in resolved.items()]
    lines += [
        "",
        "No external MCP tool was invoked. Nothing left this workflow. "
        "This is a record of an intention, not a receipt.",
    ]
    return "\n".join(lines)


def _external_action_sent_body(capability: str, resolved: dict, result, host: str) -> str:
    """Compose the SENT body — the ONLY body in this file that may describe something that
    actually happened, and it is reached only from the adapter's own ``ok`` verdict.

    It opens with the send, in the past tense, because here that is TRUE. The 189 discipline
    is unchanged in substance: a body may never claim more than the wire supports, so the
    destination HOST is named (D-08 permits it; the recipient and the credential are not
    named) and the vendor's words ride verbatim when it gave any.
    """
    labels = ["Action", "Destination", *(str(k) for k in resolved)]
    width = max(len(lbl) for lbl in labels)
    lines = [
        f"Sent. {_EXTERNAL_ACTION_PHRASE[capability]} — the destination accepted it.",
        "",
        "What this step did",
        f"  {'Action'.ljust(width)}: {_EXTERNAL_ACTION_PHRASE[capability]}",
        f"  {'Destination'.ljust(width)}: {host}",
    ]
    lines += [f"  {str(key).ljust(width)}: {_clip_for_body(value)}" for key, value in resolved.items()]
    words = (getattr(result, "provider_message", "") or "").strip()
    detail = (getattr(result, "detail", "") or "").strip()
    if words:
        lines += ["", words]
    elif detail:
        lines += ["", detail]
    return "\n".join(lines)


def _external_action_failure_body(capability: str, resolved: dict, provider_words: str) -> str:
    """Compose the SEND-FAILED body — D-17's second axis.

    ``failed`` and ``recorded_not_sent`` are BOTH "nothing arrived", and conflating them is
    the real risk on this surface: one is a step the author never bound, the other is a send
    that was attempted and refused. They must stay distinguishable on all three axes — the
    STATUS written (``failed`` vs ``recorded_not_sent``), the ``recorded_intent`` key's
    presence (absent here, present there) and **this first line**.

    Neither body may ever read "Complete", and neither may borrow the other's word: this one
    never says *"Not sent — recorded"* (which would claim the honest unbound terminal for a
    failure) and ``_external_action_body`` never says *"failed"*. The provider's own words are
    reproduced VERBATIM — unparaphrased, untranslated (UI-SPEC §5b / the 071-A rule) — because
    a paraphrased vendor error is a second, worse invention on top of the failure.
    """
    labels = ["Action", *(str(k) for k in resolved)]
    width = max(len(lbl) for lbl in labels)
    lines = [
        "SEND FAILED — nothing arrived.",
        "",
        "What this step attempted",
        f"  {'Action'.ljust(width)}: {_EXTERNAL_ACTION_PHRASE[capability]}",
    ]
    lines += [f"  {str(key).ljust(width)}: {_clip_for_body(value)}" for key, value in resolved.items()]
    lines += [
        "",
        provider_words.strip() or "The destination gave no explanation.",
        "",
        "This phase failed. Nothing was retried and nothing was queued — a duplicate is "
        "worse than a missing one, so a re-run is a deliberate human act (D-18).",
    ]
    return "\n".join(lines)


# ── Phase 190 · the closed maps the send path needs, each DERIVED from the closed set ─────

#: D-26's operator kill-switch. Registered in ``_GOVERNED_FEATURES`` with the cold default
#: ``"off"``; the assert below is what makes a typo an ImportError rather than a silent
#: fail-OPEN — ``feature_audience`` answers ``"operators"`` for an UNKNOWN feature, which is
#: not ``"off"``, so a misspelt constant here would enable live sending everywhere.
_LIVE_CONNECTORS_FEATURE = "live_connectors"
assert _LIVE_CONNECTORS_FEATURE in _GOVERNED_FEATURES, (
    f"D-26: {_LIVE_CONNECTORS_FEATURE!r} is not a governed feature, so feature_audience() "
    "would answer 'operators' for it and the kill-switch would be OPEN by default"
)

#: The destination that is knowable **with no credential and no connection row at all**.
#: D-02 makes Slack's host a code constant, so ``post_message`` has a real pre-credential
#: destination to guard; the other two live on the CONNECTION ROW (settled at plan 190-06 —
#: ``CreateTicketConfig.base_url`` / ``SendEmailConfig.host``), so there is nothing to check
#: before the row is read and their socket-time guard is the binder's (``egress`` owns it,
#: and the D-05 source fence is what keeps that true). ``None`` is written out per capability
#: rather than omitted so the map is total and a fourth capability is a KeyError, not a skip.
_PRE_CREDENTIAL_DESTINATION: dict[str, str | None] = {
    "post_message": SLACK_API_BASE,
    "create_ticket": None,
    "send_email": None,
}

#: Where the upstream phase's text goes when the run's inputs do not name it. A CLOSED
#: two-column map, not a template language: D-09 is satisfied by NOT adding an evaluator, and
#: a per-field mapping UI is deferred with its own trigger.
_BODY_ARG_FOR_CAPABILITY: dict[str, str] = {
    "send_email": "body",
    "create_ticket": "description",
    "post_message": "text",
}

assert (
    set(_PRE_CREDENTIAL_DESTINATION)
    == set(_BODY_ARG_FOR_CAPABILITY)
    == set(EXTERNAL_ACTION_CAPABILITIES)
), (
    "190 D-04: an external-action send map disagrees with EXTERNAL_ACTION_CAPABILITIES — "
    f"destinations={sorted(_PRE_CREDENTIAL_DESTINATION)}, "
    f"body_args={sorted(_BODY_ARG_FOR_CAPABILITY)}, "
    f"capabilities={sorted(EXTERNAL_ACTION_CAPABILITIES)}"
)


def _pre_credential_destination(config, capability: str | None) -> str | None:
    """The destination this step can be checked against BEFORE anything looks for a secret.

    An author-declared destination on the step wins when one exists. Today
    ``ExternalActionPhaseConfig`` is a ``_StrictBase`` (``extra='forbid'``) carrying only
    ``connection_id`` (D-13), so in production this read returns ``None`` and the capability
    constant decides — but the read is written now, and driven by
    ``tests/unit/test_190_egress_ordering.py``, so the day a destination DOES land on the step
    the guard is already ahead of the resolver rather than being retrofitted behind it.
    """
    declared = getattr(config, "base_url", None)
    if declared:
        return str(declared)

    # ⚠ AN MCP STEP HAS NO CAPABILITY AND SO NO CONSTANT DESTINATION — its destination is the
    # `mcp_server_url` on the CONNECTION, which is not resolved yet at this point in the
    # executor. Returning None here is NOT a hole and must not be read as one: the MCP path's
    # equivalent guard is `validate_mcp_destination`, called inside `mcp_client._send_jsonrpc`
    # before any socket is opened, so the D-06 ordering property (validate BEFORE a credential
    # is fetched) holds through a different door rather than being skipped.
    #
    # ⚠ THE `None` IS SCOPED TO THAT ONE CASE ON PURPOSE. A NATIVE capability still indexes
    # the map and still raises if it is missing — the D-04 assert above exists to make that
    # unreachable, and softening this read to `.get()` would silently disarm the pre-check for
    # every native step the day that assert is edited.
    if capability is None:
        return None
    return _PRE_CREDENTIAL_DESTINATION[capability]


def _destination_host(capability: str, config: dict) -> str:
    """The HOST for the send receipt (D-08: capability, connection id and host — never the
    credential and never the request body)."""
    if capability == "post_message":
        return "slack.com"
    if capability == "send_email":
        return str(config.get("host") or "")
    base = str(config.get("base_url") or "")
    try:
        return _url_host(base)
    except Exception:  # noqa: BLE001 — an unparseable base_url is still a loggable receipt
        return base


def _url_host(url: str) -> str:
    """``https://acme.atlassian.net/x`` -> ``acme.atlassian.net``. No parser import: the
    receipt must not become a reason to pull a transport module into this file."""
    without_scheme = url.split("://", 1)[-1]
    return without_scheme.split("/", 1)[0].split("@")[-1].split(":")[0]


def _adapter_args(adapter, capability: str, resolved: dict, config=None, schema=None) -> dict:
    """Project the resolved inputs onto the adapter's DECLARED schema, and nothing more.

    Two rules, both fail-closed:

      * only properties the adapter declares are passed — the adapter itself also refuses an
        undeclared key, so this is belt as well as braces, and it keeps a run input named
        ``kickoff_prompt``-style scaffolding from ever reaching a vendor;
      * the upstream phase text (``content``, put there by ``_external_action_inputs``) fills
        the capability's body field when the run's own inputs did not name it.

    **No expression language, no templating surface** (D-09). This is a closed two-column
    lookup; where a field must be COMPOSED the shipped ``SandboxedEnvironment(autoescape=True)``
    path is the only one that may do it, and this phase composes nothing.

    ── 214 (D-214-00) · THE BODY MOVED; THE NAME AND THE RULES DID NOT ────────────────────
    The projection itself now lives in ``app.services.connectors.args.resolve_arguments``,
    because the publish gate refuses at save time exactly what this resolves at run time, and
    two copies of that logic in two files is a guaranteed drift — whose symptom is a workflow
    that publishes and then fails at the send (``BUG-260826-02`` restated).

    ⚠ **THE RE-EXPORT IS LOAD-BEARING** (``human_input.py``'s cut rule 2). This function keeps
    its NAME, its module and the D-09 sentence above, because three shipped suites import
    ``_adapter_args`` / the body-argument map from ``phase_types``. There is ONE projection,
    not two; do not "tidy" this wrapper away.

    ⚠ **THE PRODUCTION CALL SITE OBTAINS ``schema`` FROM THE ONE ACCESSOR** — GATE 7 below
    passes the ONE schema accessor's answer, and it does NOT read ``adapter``'s own frozen
    declaration even though ``adapter`` is right there one line above it. ``descriptor_for``
    derives from exactly that attribute today, so the two are equal; reading the attribute at
    the call site would silently stop being equal the moment either side gains a transform,
    and the publish gate reads the descriptor. ``descriptors.py`` calls its own derivation
    *"DERIVED from the adapter's own declaration — never retyped"* for precisely that reason.

    ⚠ ``schema=None`` IS A COMPATIBILITY ARM FOR THE PRE-214 THREE-POSITIONAL SHAPE, NOT THE
    PRODUCTION PATH. Three shipped suites call this with a stub adapter of their own and no
    schema (``test_190_ssti_fence.py`` records at the seam with an adapter whose declaration
    deliberately differs from Slack's), so the fallback reads the handed adapter's own
    declaration and keeps their assertions character-identical — the re-import discipline
    applied to a signature rather than to a name. A production caller that omits ``schema``
    would be reading a schema for itself, which is the drift D-214-00 exists to prevent, so
    ``test_214_args_leaf.py`` asserts the executor's call site passes it.

    ``config`` is the phase config, carrying ``arg_sources`` and ``tool_args``. Also optional,
    for the same reason; a ``None`` config is the pre-214 shape and resolves byte-identically
    (D-214-12), which the characterization pins in ``test_214_args_leaf.py`` PROVE rather than
    assert.
    """
    if schema is None:
        schema = adapter.INPUT_SCHEMA
    return resolve_arguments(
        config=config,
        schema=schema,
        upstream_outputs={},
        run_inputs=resolved,
        body_arg=_BODY_ARG_FOR_CAPABILITY[capability],
    )


async def _write_send_receipt(
    ctx, phase, *, capability: str, connection_id: str, host: str, raw_status: int | None, tool_name: str | None = None
) -> None:
    """The ONE ``external_action_sent`` receipt (migration 117 — the literal it added).

    ⚠ **WHAT IT MAY CARRY IS FIXED BY D-08 / D-213-14**: the capability, the connection id,
    the destination HOST, and tool_name. Never the credential, never the request body, never the
    recipient's address. A receipt is a record that something left the app, not a copy of what left.

    Best-effort, deliberately: the send has ALREADY HAPPENED by the time this runs, and a
    failed receipt write must not turn a delivered message into a failed phase. It is logged
    loudly instead — the same posture ``_emit_audit`` takes one function over.
    """
    pool = getattr(ctx, "pool", None)
    if pool is None:
        return
    user_id = (getattr(ctx, "current_user", None) or {}).get("id")
    try:
        metadata = {
            "capability": capability,
            "connection_id": str(connection_id),
            "destination_host": host,
            "raw_status": raw_status,
            "phase": getattr(phase, "slug", None),
            "phase_index": getattr(phase, "phase_index", None),
        }
        if tool_name is not None:
            metadata["tool_name"] = str(tool_name)
        await write_audit(
            pool,
            getattr(ctx, "run_id", None),
            user_id=user_id,
            event_type="external_action_sent",
            metadata=metadata,
        )
    except Exception:  # noqa: BLE001 — a receipt write must never undo a send that happened
        logger.warning(
            "external_action: the send receipt could not be written for phase %s "
            "(the send itself SUCCEEDED — this is a missing record, not a missing message)",
            getattr(phase, "slug", None),
        )


async def _exec_external_action(phase, accumulated_outputs: dict, ctx) -> dict:
    """Resolve a capability against the CLOSED set and — behind six ordered gates — actually
    perform it (Phase 190 / CONN-02 + CONN-03 — D-06, D-13, D-14, D-16, D-17, D-18, D-19,
    D-26; Phase 189 / CONN-01 — D-01, D-02, D-05, D-22).

    ── ⚠ TWO INVARIANTS THIS FILE CARRIED UNTIL 2026-08-09 ARE NOW FALSE ──────────────────
    They are quoted here as SUPERSEDED rather than deleted, because erasing an old invariant
    hides that a promise changed, and a stale invariant docblock is how this project ships
    lies. Both were true for Phase 189 and are false from the commit that added the send
    (Phase 190, CONN-02):

        SUPERSEDED 2026-08-09 (Phase 190 / D-01, CONN-02):
          "⚠ SC#4: this executor performs NO network I/O. It opens no HTTP client, no
           connection of any other kind, and no remote-tool-protocol client."

        SUPERSEDED 2026-08-09 (Phase 190 / D-01, CONN-02):
          "⚠ NOTHING IN THIS FUNCTION MAY NAME A TRANSPORT, NOT EVEN TO DENY IT."

    189's SC#4 said *"no live outbound egress ships in this phase"* — a claim about 189, and
    it held. 190 is the phase whose entire purpose is to end it.

    **What is true instead, and it is narrower than the old sentence rather than weaker:**
    this function still NAMES no transport. It constructs no client, imports no HTTP or mail
    library, and holds no socket. Every byte leaves through ``app.security.egress``, whose
    binders validate and PIN the destination, and the D-05 source fence over
    ``backend/app/services/connectors/**`` is what keeps the adapters honest about it. The
    fence that moved is the *no-egress* one; the *no-transport-name* one still binds and is
    unchanged.

    **The other 189 fence is UNTOUCHED and still green, and its passing is evidence rather
    than leftovers.** ``tests/unit/test_189_no_egress.py`` Case A walks every ``*.py`` under
    ``backend/app`` for the remote-tool protocol's three-letter token and requires ZERO. D-01
    amended the ROADMAP to build no client for that protocol in this phase — first-party
    adapters behind a seam SHAPED like it — so Case A is part of the amendment's evidence.
    Case B was re-scoped by NAME at plan 190-01 (its precondition is now "no connection
    bound"), and its new positive sibling asserts the opposite property for a BOUND step.

    ── THE ORDER OF THE GATES IS THE SECURITY PROPERTY, AND EACH IS SEPARATELY ASSERTED ────
    No amount of library quality makes an ordering correct, so the order is driven rather
    than described:

      1. **D-02 · the closed capability set.** An absent name RAISES — never resolved
         dynamically, never ``eval``'d, never falling back to a default. ⚠ **DO NOT DELETE
         THIS AS REDUNDANT**: ``ExternalActionPhaseConfig.capability`` is a ``Literal`` of
         three, so this is the SECOND line of defence for a row that reached the engine
         another way (a hand-edited JSONB row, a ``PhaseSpec`` built by hand).
      2. **D-16 · the golden-run gate — FIRST among the send gates.** Publishing drives a
         GOLDEN RUN through this very executor, and the armed action-risk checkpoint is
         auto-continued on that path (D-19). Without this line, **PUBLISHING A WORKFLOW WOULD
         PERFORM THE EXTERNAL ACTION, with nobody asked, once per publish attempt** — which is
         ``D-189-DEF-04`` verbatim, inert until this commit and live from it. Shape 1 of the
         two the engine's branch comment names: **the send is skipped, the record is NOT**, so
         ``_external_action_body`` remains the single composer of that sentence and the golden
         run keeps exercising the REAL executor. ``getattr(ctx, "is_golden_run", False)``
         matches the engine's own reader at ``harness_engine.py:837`` exactly; no signature
         changed and the engine was not edited.
      3. **D-26 · the operator kill-switch.** With ``live_connectors`` resolving to ``"off"``
         (its cold default) the step behaves EXACTLY as it did in 189: it records, it does not
         send, and it reads *"Not sent — recorded"*. That is a genuine, already-tested state,
         which is what makes this off-switch cheap and honest rather than a second code path.
      4. **D-06 · THE EGRESS GUARD, BEFORE ANY CREDENTIAL WORK. This is the n8n CVE class,
         inverted.** n8n #28218: *"protection activates conditionally based on credential
         presence, not request characteristics"*; the prescribed fix, verbatim, is
         *"decoupling SSRF protection from credential dependency"* — which is an ORDERING OF
         TWO LINES, invisible to every test that binds a credential. So ``validate_destination``
         is called here, above the unbound-step branch and above the resolver, and a send with
         **no credential bound at all** raises the EGRESS REFUSAL rather than a
         missing-credential error.
         ``tests/unit/test_190_egress_ordering.py`` is the fence: it asserts the error's
         IDENTITY, the refusal's CONTENT, and the RECORDED CALL ORDER ``["egress", "resolve"]``
         — the last being the only assertion that survives someone swapping the two lines.
         ⚠ ``EgressRefused`` is deliberately NOT caught anywhere in this function: a caught
         refusal is one ``except`` clause away from being downgraded to a warning.
      5. **D-13 / D-17 · no connection bound, or a disabled one.** Skip the send and record →
         ``recorded_not_sent``, *"Not sent — recorded"*. This is NOT a failure and must never
         read as one; it is the permanent, shipping terminal migration 115 was spent on, and
         the half of the demo sentence competitors do not have. **This is also UI-SPEC §5a's
         GATE 2, server half, and its reach is exactly two things: the row's ORG and its
         ``is_enabled`` flag.** It reads no stored check verdict, deliberately — see the
         block on the ``ConnectorDisabled`` branch for the two reasons, the second of which
         (check is admin-only, bind is org-wide) is the one that decided it.
      6. **D-14 · resolve, scoped by the RUN's ORG — never by the id alone.** The definition is
         authored data; the org is not. An ``id``-only lookup passes every ordinary test and
         hands org A's workflow org B's decrypted credential — REPRODUCED at plan 190-06
         before it was closed. ``org_id`` has no default on ``resolve_connection``, and a run
         with no org resolves nothing.
      7. **Dispatch** through ``connectors.registry.get_adapter(capability)``, whose key set is
         the same closed frozenset. The adapter owns its vendor's success contract — Slack
         answers HTTP 200 with ``{"ok": false}`` for a message nobody received, so only the
         adapter's OWN verdict produces ``completed``.

    ── D-17 · the outcome, with ZERO NEW STATUSES and ZERO ``workflow_phases`` migration ────

        | outcome                              | key returned      | engine writes        |
        |--------------------------------------|-------------------|----------------------|
        | sent (the adapter's own ``ok``)      | neither sentinel  | ``completed``        |
        | send FAILED                          | ``failure``       | ``failed``           |
        | golden run / switch off / unbound    | ``recorded_intent``| ``recorded_not_sent``|
        | approval declined                    | (unchanged path)  | unchanged            |

    Both terminals mean "nothing arrived" and they must stay distinguishable: the status
    written, the body's FIRST LINE, and the sentinel key's presence all differ, and a test
    asserts all three. **D-18 — at-MOST-once: there is no retry, no backoff, no idempotency
    key and no queue anywhere on this path.** A duplicate email is worse than a missing one;
    a re-run is a deliberate human act.

    ── D-19 · the executor still owns no waiting ────────────────────────────────────────────
    The send happens AFTER the structurally-armed action-risk checkpoint. 190 adds network I/O
    to this executor — **not** a second approval and not a second wait. There is no
    ``await`` on a human anywhere below.

    ── D-22 · a STEP the executor performs, not a tool the LLM may call ─────────────────────
    Unchanged and load-bearing. No agent loop, no ``tools_override``, no model call. The
    capability rides ``available_tools`` as a GOVERNANCE DECLARATION (D-03). Making it a
    callable tool would let an LLM decide *whether and how* to send.
    """
    capability = getattr(phase.config, "capability", None)
    mcp_tool_name = getattr(phase.config, "tool_name", None)

    # ⚠ TWO SHAPES REACH THIS EXECUTOR AND EACH IS CLOSED BY A DIFFERENT SET. A native step
    # names one of the three D-15 capabilities; an MCP step (206) names a `tool_name` and has
    # no capability at all, and its closure is the PER-TOOL GRANT checked below — an ungranted
    # tool is refused there, by name, with an audit row.
    #
    # ⚠ THIS GUARD WAS SATISFIED BY ACCIDENT FOR THE LENGTH OF ONE PHASE, and the accident is
    # worth recording because it looked like it worked. `ExternalActionPhaseConfig.capability`
    # was given the default `"send_email"`, so EVERY MCP step arrived here claiming to be an
    # email step and passed a closed-set check it was never meant to take. Removing that
    # default turned this line into a `KeyError` — which is the guard finally SEEING the MCP
    # shape rather than a new fault. A default is not a way through a gate.
    if mcp_tool_name:
        if not str(mcp_tool_name).strip():
            raise KeyError(
                f"external_action phase {getattr(phase, 'slug', '?')!r}: an MCP step's "
                f"tool_name is blank — there is nothing to grant and nothing to invoke"
            )
    elif capability not in EXTERNAL_ACTION_CAPABILITIES:
        raise KeyError(
            f"external_action phase {getattr(phase, 'slug', '?')!r}: capability "
            f"{capability!r} is not registered in EXTERNAL_ACTION_CAPABILITIES "
            f"(closed set — register it explicitly)"
        )

    resolved = _external_action_inputs(accumulated_outputs, ctx)
    slug = getattr(phase, "slug", "?")

    def _record(reason: str) -> dict:
        """The 189 terminal, unchanged: ONE composer for the one sentence."""
        target_name = mcp_tool_name or capability
        logger.info(
            "190 D-17: external_action phase %r RECORDED the intended %r and sent nothing "
            "(%s)", slug, target_name, reason,
        )
        if mcp_tool_name:
            return {
                "text": _external_action_mcp_body(mcp_tool_name, resolved),
                RECORDED_INTENT_KEY: {
                    "tool_name": mcp_tool_name,
                    "capability": "mcp",
                    "inputs": resolved,
                },
            }
        return {
            "text": _external_action_body(capability, resolved),
            RECORDED_INTENT_KEY: {"capability": capability, "inputs": resolved},
        }

    # ── GATE 1 · D-16 — THE GOLDEN-RUN GATE. ONE LINE, AND IT IS THE ONE THAT BITES ─────
    # OBSERVED RED on the commit that added the send, before this line existed:
    #   WARNING app.services.harness.phase_types: 190: external_action phase 'notify' failed
    #   to send: nothing answered at the Slack API: httpx.AsyncClient.send was called -
    #   outbound egress attempted
    # i.e. PUBLISHING a workflow performed the external action. Driven green by this gate in
    # the SAME commit, per D-16. Do not "simplify" it into the engine: shape 1 keeps the
    # record composed by `_external_action_body`, so one composer still owns that sentence.
    if getattr(ctx, "is_golden_run", False):
        return _record("this is a publish-time golden run — D-16 suppresses the SEND only")

    # ── GATE 2 · D-26 — the operator kill-switch ────────────────────────────────────────
    #
    # ⚠ CR-02 — BOUND THE STALENESS FIRST. ``feature_audience`` resolves through the SYNC
    # settings reader, and ``models/user_settings.py:365-398`` states the problem in its own
    # words: ``load_app_settings()`` reads ``_settings_cache`` with **no staleness check at
    # all**; the 30s TTL is checked only by the ASYNC loader, so on a NON-writing worker
    # nothing expires the sync reader's view — it keeps serving the pre-flip audience with
    # **no code-level bound**. At the documented ``WORKER_COUNT=2`` default, an operator who
    # discovers a leaked bot token and flips this switch off has their write land on ONE
    # worker; a run scheduled on the other reads ``"everyone"`` and POSTS THE MESSAGE, minutes
    # or hours after they believe sending is stopped.
    #
    # Every other gated read in the tree already awaits this helper — ``api/features.py:57``,
    # ``dependencies.py:669`` (``require_canvas``), ``middleware/canvas_gate.py`` — and the
    # helper exists *specifically because* T-184-UAT-02 measured a flipped-off
    # ``visual_workflow_canvas`` still answering ``true``. This was the only kill switch in
    # the tree reading the flag raw, and the one whose false negative sends real email.
    # TTL-checked (no DB I/O on a warm cache) and NEVER RAISES.
    await ensure_settings_fresh()
    # ⚠ CR-03 — THE TEST IS POSITIVE, NOT AN ABSENCE, AND THAT IS THE FIX.
    # ``PUT /admin/visibility`` accepts FOUR audiences for any allow-listed feature
    # (``admin.py`` ``_VISIBILITY_AUDIENCES = {"everyone", "operators", "role", "off"}``) and
    # ``live_connectors`` was added with no restriction to D-26's two names. ``!= "off"``
    # therefore read three of the four as FULLY ON: an operator piloting live sending for
    # super-admins only (``audience: "role"``) would have every published workflow in every
    # org start sending for real, run by any member, while the CRUD surface correctly refused
    # them — the Control Room reading "restricted" over a send path that was wide open.
    #
    # Requiring the positive answer is also fail-CLOSED against a hand-edited ``app_settings``
    # row and against any FIFTH audience added later, which a deny-list cannot be (the Phase
    # 185 lesson: *a deny-list cannot be made fail-closed by extension*).
    if feature_audience(_LIVE_CONNECTORS_FEATURE) != "everyone":
        return _record("live_connectors is not fully on — the 189 behaviour, unchanged")

    # ── GATE 3 · D-06 — THE EGRESS GUARD, BEFORE ANY CREDENTIAL WORK ────────────────────
    # ⚠ CR-04 — the RESOLUTION runs off the event loop (D-v2.5-01). ``validate_destination``
    # is a plain ``def`` that calls ``socket.getaddrinfo``, a BLOCKING libc call, and this
    # executor is ``async def``. The name stays a module attribute and stays synchronous so
    # the D-06 ordering fence's ``monkeypatch.setattr(phase_types, "validate_destination", …)``
    # still binds the thing the executor actually calls — only the THREAD moves.
    destination = _pre_credential_destination(phase.config, capability)
    if destination:
        await run_in_threadpool(validate_destination, capability, destination)

    # ── GATE 4 · D-13 / D-17 — nothing bound is not a failure ───────────────────────────
    connection_id = getattr(phase.config, "connection_id", None)
    if not connection_id:
        return _record("no connection is bound to this step")

    org_id = getattr(ctx, "org_id", None)
    if not org_id:
        # Fail CLOSED. A run with no org cannot scope a credential lookup, and an unscoped
        # lookup is D-14 with a friendlier name.
        logger.warning(
            "190 D-14: external_action phase %r has a connection bound but the run carries "
            "no org — recording rather than resolving unscoped", slug,
        )
        return _record("the run carries no org, so no credential can be scoped to it")

    # ── GATE 5 · D-14 — resolve, scoped by the RUN's org ────────────────────────────────
    try:
        connection = await resolve_connection(str(connection_id), org_id=str(org_id))
    except ConnectorDisabled:
        # ── ⭐ UI-SPEC §5a GATE 2, SERVER HALF — AND ITS EXACT REACH ─────────────────────
        # Gate 2 validates a bound connection against TWO things and only two: the row's ORG
        # (the `org_id=` argument one line above — D-14) and its `is_enabled` flag, which
        # arrives here as this refusal. `resolve_connection` is the single reader of that
        # flag and it refuses BEFORE any decryption, so a switched-off connection never
        # materializes a credential at all.
        #
        # A DISABLED connection is therefore treated as UNBOUND at run time — same terminal,
        # same composer, same sentence as the no-connection branch above (D-17: zero new
        # statuses, no `workflow_phases` migration). It is NOT a failure and must never read
        # as one: an operator who switched a connection off got what they asked for.
        #
        # ⚠ WHAT GATE 2 DELIBERATELY DOES NOT READ, AND WHY IT MUST STAY THAT WAY (door (b),
        # U-07a). The stored credential-check verdict is a QUALITY HINT, never an
        # authorization boundary — migration 116 says so in the column's own COMMENT — and
        # the column's NAME is asserted to appear ZERO times in this whole file, which is why
        # it is not spelled even here. (A fence that greps for a literal cannot be described
        # using that literal; 190-13 met the same shape and recorded the same choice.) Two
        # reasons, and the second is the decisive one:
        #
        #   1. a verdict from two days ago deciding a LIVE run is the settings-sync-staleness
        #      class this codebase has already been bitten by — a credential rotated since the
        #      check would be refused while working perfectly. At run time the executor
        #      attempts the send and reports the TRUE outcome;
        #   2. checking is admin-only (U-02) while binding is org-wide, so a server gate on a
        #      stale `failed` would dead-end a plain member who cannot clear it themselves.
        #
        # Blocking a bind prevents no send: a bound-but-failing connection fails honestly on
        # the next run with the host's verbatim words. Adding that gate here is a two-half
        # change — the gate AND UI-SPEC §5b's sentence, in ONE commit — never this line alone.
        return _record("the bound connection is disabled (is_enabled is false — Gate 2)")

    if not getattr(connection, "mcp_server_url", None):
        # ⚠ BUG-260827-01 — ``getattr(obj, name, default)`` returns the ATTRIBUTE whenever the
        # attribute EXISTS, so the default below can never stand in for a stored ``None``.
        # This gate was written in Phase 190, when a connection could only ever be one of TWO
        # shapes and each carried a non-null discriminator. Phase 211 made a THIRD shape
        # reachable — a SERVICE-ONLY row naming a service and neither a ``capability`` nor an
        # ``mcp_server_url`` (migration 127's ``shape_is_not_ambiguous`` forbids BOTH being set
        # and PERMITS both being NULL, by design — CONN-08). Such a row has ``capability``
        # present-and-``None``, so it fell into the mismatch arm and the run said *"the bound
        # connection is for a different capability"*. That is FALSE: it is not a DIFFERENT
        # capability, it is NO capability — and on the one surface in this codebase whose
        # entire stated discipline is not over-claiming, it sends a reader hunting a mismatch
        # that does not exist.
        #
        # ⚠ THE DEFAULT IS KEPT ON PURPOSE. A connection object with no ``capability``
        # ATTRIBUTE AT ALL still passes this gate exactly as it did before; only
        # present-and-``None`` is split out. Widening the guard instead would delete a real
        # protection — the genuinely-mismatched case below MUST stay refused.
        bound_capability = getattr(connection, "capability", capability)

        if bound_capability is None:
            # The honest sentence is *"not yet"*, and it is the same one the refresh path
            # already carries one module over (``connector_service.ConnectorNothingToDiscover``
            # — read that class for why a worded refusal beats a generic one here). Nothing is
            # broken and nothing is misconfigured: a service-only row simply has no way to be
            # reached until OAuth (Phase 215) or an endpoint supplies one, so the step was
            # never going to send. The behaviour was already right; only the words were wrong.
            logger.info(
                "211 BUG-260827-01: external_action phase %r is bound to a SERVICE-ONLY "
                "connection (no capability, no mcp_server_url) — recording rather than "
                "sending", slug,
            )
            return _record(
                "the bound connection names a service but no way to reach it yet"
            )

        if bound_capability != capability:
            # A connection bound for another capability would send a bot token to a mail host,
            # so the send never happens either way. ⚠ WR-03 — WHAT CHANGED IS THE TERMINAL, not
            # the refusal: this used to raise a bare ``ValueError``, which is not an
            # ``AdapterError``, so the handler below never caught it. The run died with no
            # ``text``, no ``failure`` sentence and none of D-17's four outcomes — a
            # stack-trace-shaped error on the surface whose whole discipline is not
            # over-claiming.
            logger.warning(
                "190 WR-03: external_action phase %r is bound to a %r connection, not %r — "
                "recording rather than sending", slug,
                bound_capability, capability,
            )
            return _record("the bound connection is for a different capability")

    # ── GATE 5.5 · Tool Posture & Grants Check (Phase 213 / GRANT-02 / D-213-00 / SEC-1) ─
    # Evaluated BEFORE the shape fork (Gate 6/7) to close BUG-260827-02.
    effective_tool_name = getattr(phase.config, "tool_name", None) or capability
    posture = resolve_effective_posture(connection, effective_tool_name)
    grants = getattr(connection, "tool_grants", None) or {}
    was_explicitly_set = isinstance(grants, dict) and effective_tool_name in grants

    async def _refuse(reason: str, because: str):
        """One refusal composer, three reasons (D-213-16 / GRANT-04, plan 213-06).

        ⚠ THE WORDS MIRROR ``grantsVocabulary.ts`` §"The refusal (GRANT-04)" AND ARE NOT
        IMPORTED FROM IT. D-213-15 chose two homes deliberately — the backend owns the run
        sentence so it reaches chat, the run page, the panel AND the ledger without four
        renderers agreeing, while the frontend vocabulary owns the settings screen. The
        cost of two homes is drift, so ``test_213_approval_moment.py`` pins the two in
        agreement rather than trusting this comment.

        ⚠ ONE audit KIND, three ``reason`` VALUES. Adding a kind would need
        ``_AUDIT_EVENT_TYPES`` and a migration CHECK edited in the SAME commit
        (BUG-260731-02), and there is nothing here that ``tool_refused`` does not already
        describe.
        """
        logger.warning(
            "213 GRANT-04: tool %r refused on connection %s (%s; grants: %s, default: %s)",
            effective_tool_name, connection_id, reason, grants,
            getattr(connection, "default_approval_posture", None),
        )
        pool = getattr(ctx, "pool", None)
        user_id = (getattr(ctx, "current_user", None) or {}).get("id")
        if pool is not None:
            try:
                await write_audit(
                    pool,
                    getattr(ctx, "run_id", None),
                    user_id=user_id,
                    event_type="tool_refused",
                    metadata={
                        "phase": slug,
                        "connection_id": str(connection_id),
                        "tool_name": effective_tool_name,
                        "reason": reason,
                    },
                )
            except Exception as exc:
                logger.warning("213: failed to write tool_refused audit event: %s", exc)

        return {
            # REFUSED_HEADLINE + (REFUSED_BECAUSE_DENIED | REFUSED_BECAUSE_UNGRANTED) +
            # REFUSED_NEXT — the sketch's words, which name the grant that stopped this and
            # the change that would let it through. The sentence this replaced said
            # "is not granted permission on connection X": it named no grant and offered no
            # next step, which is the BUG-260815-06 class GRANT-04 exists to close.
            "text": (
                f"{effective_tool_name} was refused. {because} "
                f"Set it to Allow or Ask first to let this run continue."
            ),
            "failure": f"tool '{effective_tool_name}' refused: {reason}",
        }

    if posture == "deny":
        if was_explicitly_set:
            return await _refuse(
                "posture_denied",
                f"{effective_tool_name} is set to Deny on this connection.",
            )
        return await _refuse(
            "not_granted",
            f"{effective_tool_name} has never been allowed on this connection.",
        )

    if posture == "ask" and not getattr(phase, "action_risk_armed", False):
        # ── SC#3 · "nothing leaves until they answer" — the FAIL-CLOSED half ─────────
        #
        # ⚠ THIS IS NOT A SECOND PAUSE, AND IT MUST NOT BECOME ONE. D-213-09 chose
        # "two triggers, ONE pause" and rejected a distinct grant-approval pause by name,
        # because an armed step whose tool is also "Ask first" would then ask twice.
        #
        # On a workflow `external_action` the armed checkpoint has ALREADY asked: the body
        # runs only when `_resolve_failure_with_ask_user` returned None
        # (`harness_engine.py:930`), i.e. a person approved. So `armed` ⇒ proceed, and this
        # arm never fires there.
        #
        # It fires where NOTHING asked — the Phase 216 chat path, and any future unarmed
        # caller. ⚠ Without it `ask` means SEND: Gate 5.5 refused only on `deny` and fell
        # through otherwise, and migration 128 §1 makes `'ask'` the default for every NEW
        # connection, so a row with no grant configured at all dispatched. Pre-213 that same
        # row was REFUSED, because the Gate 6 check this replaced read
        # `grants.get(tool) is True` — a MISSING KEY DENIES. This restores that property to
        # the GATE rather than leaving it resting on a column default.
        return await _refuse(
            "approval_required",
            f"{effective_tool_name} needs a person's approval on this connection, "
            f"and nothing here can ask one.",
        )

    # ── GATE 6 · MCP Tool Dispatch (Phase 206 / CONN-02 / D-206-06) ───────────────────
    if getattr(connection, "mcp_server_url", None):
        tool_name = getattr(phase.config, "tool_name", None)
        if not tool_name:
            return _record("no tool_name specified for MCP connection")

        # ⭐ 214 (D-214-00) — THE MCP SHAPE ROUTES THROUGH THE SAME RESOLVER AND THE SAME
        # ACCESSOR AS THE NATIVE ONE, so the two shapes cannot drift. The snapshot is the one
        # GATE 5 already resolved — ⚠ do NOT re-resolve the connection and do NOT add I/O to
        # this path. It is the SAME `discovered_tools` column the publish gate reads.
        #
        # This replaced a raw `dict(tool_args)`: every key the author had ever stored went to
        # the vendor, declared or not. The projection is now the schema's, which is what makes
        # STEP-03's publish refusal and STEP-02's send agree about the argument object.
        tool_schema = schema_for_bound_tool(
            capability=None,
            tool_name=tool_name,
            discovered_tools=getattr(connection, "discovered_tools", None),
        )
        if tool_schema is None:
            # ⛔ A `None` SCHEMA MUST NOT FALL BACK TO SENDING `tool_args` RAW. The gate
            # refuses this same case as `shape_unknown`; an executor that SENDS where the
            # gate REFUSES is the D-214-00 drift pointing the dangerous way — an unreviewed
            # argument object reaching a vendor because nobody could say what it accepts.
            return _record(
                "the bound tool's argument shape is not knowable from this connection's "
                "discovered tools"
            )
        final_args = resolve_arguments(
            config=phase.config,
            schema=tool_schema,
            upstream_outputs=accumulated_outputs,
            run_inputs=resolved,
        )

        from app.services import mcp_client
        try:
            tool_result = await mcp_client.call_tool(
                connection.mcp_server_url,
                tool_name=tool_name,
                arguments=final_args,
                secret=connection.secret,
            )
        except Exception as exc:
            logger.warning("206: MCP tool %r execution failed: %s", tool_name, exc)
            return {
                "text": f"MCP tool '{tool_name}' failed: {exc}",
                "failure": f"MCP tool execution failed: {exc}",
            }

        if tool_result.get("isError"):
            err_text = tool_result.get("text", "Unknown MCP tool error")
            return {
                "text": f"MCP tool '{tool_name}' returned error: {err_text}",
                "failure": f"MCP tool error: {err_text}",
            }

        await _write_send_receipt(
            ctx,
            phase,
            capability="mcp",
            connection_id=str(connection_id),
            host=connection.mcp_server_url,
            raw_status=200,
            tool_name=tool_name,
        )
        logger.info(
            "206 CONN-02: external_action phase %r performed tool %r via connection %s",
            slug, tool_name, connection_id,
        )
        return {"text": tool_result.get("text", "")}

    # ── GATE 7 · dispatch legacy adapter ───────────────────────────────────────────────
    adapter = get_adapter(capability)
    config = dict(getattr(connection, "config", None) or {})
    # ⭐ 214 (D-214-00) — THE SCHEMA'S PROVENANCE, NAMED. It comes from the ONE accessor, so
    # it is the SAME object the publish gate's `tool_schemas` builder obtains for this bound
    # tool (`descriptor_for` is a pure function of the registry). ⚠ Do NOT substitute the
    # adapter's own frozen declaration here: it is equal today and would stop being equal
    # silently, and the gate reads the descriptor.
    args = _adapter_args(
        adapter,
        capability,
        resolved,
        config=phase.config,
        schema=schema_for_bound_tool(
            capability=capability, tool_name=None, discovered_tools=None
        ),
    )

    try:
        result = await adapter.send(
            args=args, credential=connection, config=config, capability=capability
        )
    except AdapterError as exc:
        # The vendor's own refusal, or ours about the arguments. D-18: it is NEVER retried.
        logger.warning("190: external_action phase %r failed to send: %s", slug, exc)
        return {
            "text": _external_action_failure_body(capability, resolved, str(exc)),
            "failure": f"{capability} was not performed: {exc}",
        }

    if not getattr(result, "ok", False):
        # Only the ADAPTER'S OWN verdict produces `completed`. Slack answers HTTP 200 with
        # {"ok": false} for a message nobody received; reading a status code here is exactly
        # how a phase comes to read "Complete" for a send that did not leave the app (D-31).
        words = getattr(result, "provider_message", "") or getattr(result, "detail", "")
        logger.warning("190: external_action phase %r was refused by the destination", slug)
        return {
            "text": _external_action_failure_body(capability, resolved, words),
            "failure": f"{capability} was not performed: {words}".strip(),
        }

    host = _destination_host(capability, config)
    await _write_send_receipt(
        ctx,
        phase,
        capability=capability,
        connection_id=str(connection_id),
        host=host,
        raw_status=getattr(result, "raw_status", None),
        tool_name=capability,
    )
    logger.info(
        "190 CONN-02: external_action phase %r performed %r via connection %s (host=%s)",
        slug, capability, connection_id, host,
    )
    # NEITHER sentinel — the engine's else branch calls `complete_phase`, and `completed`
    # now means what it says: the send happened.
    return {"text": _external_action_sent_body(capability, resolved, result, host)}


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

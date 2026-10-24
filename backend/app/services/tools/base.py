"""Leaf types every tool handler shares: ``ToolContext`` (the dependencies a handler needs from
the agent_runner scope) and ``ToolResult`` (the structured return from a handler).

Moved VERBATIM out of ``tool_dispatcher.py`` in Phase 278 (SEAM-03, a pure move): every binding
here is AST-identical to its PHASE_BASE source, proven by ``tests/unit/test_278_pure_move.py``.
``tool_dispatcher.py`` keeps the registry: it imports the handlers below BY NAME into its static
``_TOOL_REGISTRY`` literal (Extension Contract — never registered dynamically).

``tool_dispatcher`` re-exports both as the SAME objects (D-04), so ``agent_loop``, ``threads``,
``task_service``, ``harness/phase_types`` and ``models/harness`` keep importing them from there.

⛔ LEAF: stdlib only at runtime (the ``TYPE_CHECKING`` block is never executed). Nothing here
may import an ``app`` module — every family imports this one.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Awaitable, Callable
from uuid import UUID

if TYPE_CHECKING:
    import asyncpg
    import redis.asyncio as aioredis
    from supabase import Client
    from app.models.user_settings import UserEffectiveSettings


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class ToolContext:
    """Carries all dependencies a tool handler needs from the agent_runner scope."""
    redis: Any  # redis.asyncio client
    run_id: UUID
    thread_id: str
    supabase: Any  # supabase Client
    pool: Any  # asyncpg pool
    user_settings: Any  # UserEffectiveSettings
    current_user: dict  # {"id": str, ...}
    folder_subtree_ids: list[str] | None  # list, NOT set — p_folder_ids is json.dumps'd (Pitfall 1)
    scoped_folder_path: str | None
    emit: Callable[..., Awaitable[None]]  # reference to _emit
    spawn: Callable  # reference to _spawn
    model: str = ""  # user's selected model (for sub-agent routing)
    previous_files_in_run: dict | None = None  # sandbox output file tracking across execute_code calls
    new_file_hashes_in_run: set | None = None  # RUN-01a — content-hashes genuinely new to THIS run (run-scoped accumulator)
    # Phase 142 (SRH-01 / D-06) — run-scoped repeat-guard. The set of KNOWN_MISSING
    # gap tokens (soffice / markitdown / a lost `scripts/office/*` path / a JS
    # marker) that have already FAILED this run with a PERMANENT runtime gap.
    # By-reference run-scoped accumulator (mirrors new_file_hashes_in_run): init
    # once in agent_loop.py, threaded into BOTH ToolContext builds, FRESH set() for
    # sub-agents (task_service — a sub-agent's dead call must not block the parent).
    # None on EVERY unwired (harness/eval/test/duck-typed) caller => the reshape
    # `.add` and the pre-flight membership check are literal no-ops (D-14
    # byte-identical Deep). Binary/module/JS tokens are bounded by the fixed
    # allowlist; a G-A entry is a NARROWED bundled-skill-tree path (a
    # `scripts/`|`assets/`|`resources/`-prefixed relative miss — WR-01), so the set
    # grows only with genuinely-lost helper paths, never arbitrary model input (T-142-04).
    dead_gap_tokens_in_run: set | None = None
    # Phase 272 (D-09) — per-turn STRUCTURAL retry lock for search_documents. The fields of a
    # filtered search that matched ZERO documents this turn; a later search that drops one is
    # refused. By-reference run accumulator (the dead_gap_tokens_in_run shape): init once in
    # agent_loop.py, threaded into BOTH ToolContext builds — but SHARED with task sub-agents by
    # reference (deliberately unlike dead_gap_tokens_in_run, so a sub-agent cannot become an
    # unfiltered bypass). None on every unwired (harness/eval/test) caller => the lock is a no-op.
    empty_filter_fields_in_run: set | None = None
    # Phase 273 (D-04 / Pattern 5) — the caption source of show_artifact. Set BY REFERENCE to
    # agent_loop's `persisted_tool_calls` list in BOTH ToolContext builds (273-04), so the handler
    # sees the tools this turn already ran (which documents / tables the values came from) at
    # emission time. None on every unwired harness/eval/test caller => the caption reads "values
    # provided by the agent". NOT shared with task sub-agents (show_artifact is excluded from them).
    turn_tool_calls: list[dict] | None = None
    # Phase 292 (D-07) — the citation manifest show_artifact `source` handles resolve against. Set
    # BY REFERENCE to agent_loop's `retrieved_citations` in BOTH ToolContext builds, so a handle `n`
    # names the same source the model saw as `[n]` this turn. None on every unwired
    # harness/eval/test caller => any handle is refused as "nothing retrieved this turn".
    turn_citations: list[dict] | None = None
    # 292-REVIEW WR-01 — how many deduplicated sources the manifest the model was SHOWN numbered,
    # frozen where agent_loop injects it. `turn_citations` keeps growing as this response's tools run,
    # so a handle above this count names a source the model never saw as [n]. 0 on the resume build
    # and on every unwired caller => any handle is refused.
    turn_citations_seen: int = 0
    tool_index: int = 0  # current index in the tool_calls list (used by execute_code heartbeat)
    iteration: int = 0  # current agent loop iteration (used by harvest_output_files)
    # Phase 085 — D-085-09 / D-085-12 / D-085-15 / D-085-01
    # parent_run_id: non-null inside a sub-agent's ToolContext — _handle_task short-circuits
    #   to enforce the 1-level nesting cap (D-085-12).
    # per_run_task_semaphore: in-process asyncio.Semaphore initialized once per top-level
    #   run in agent_runner; gates the number of simultaneous task() spawns (D-085-15).
    # available_tools: list of tool-name strings exposed to the parent agent — used by
    #   _handle_task to enforce the sub-agent toolset-subset rule (D-085-09).
    # tool_call_id: LLM-supplied id for the current tool call; populated per-dispatch by
    #   agent_runner (mirrors tool_index). Used by ask_user channel naming (D-085-01).
    parent_run_id: "UUID | None" = None
    per_run_task_semaphore: Any = None  # asyncio.Semaphore | None — keep Any to avoid module-level asyncio import surface
    available_tools: list[str] = field(default_factory=list)
    tool_call_id: str = ""
    # Phase 091 HARNESS-05 — the active workflow phase's allowed tool set.
    #   None  => Deep Mode (no active workflow): the dispatch guard is a literal
    #            no-op so Explorer/General stay byte-identical (Phase 089 invariant).
    #   set   => a locked workflow phase: a tool name NOT in this set is refused at
    #            dispatch_tool() with the D-04 guiding tool_result + a D-06 tool_refused
    #            audit. Set once per phase by the harness executor (Plan 03), never
    #            queried per tool call.
    phase_whitelist: "frozenset[str] | None" = None
    # 096 review WR-03 — the workflow_runs.id of the active harness run. Every
    # other harness_audit row (phase_started / gate_failed / phase_completed /
    # run_completed) is keyed on workflow_runs.id, but on the harness path
    # ctx.run_id / ctx.parent_run_id carry PRODUCER `runs` ids (Facet A,
    # phase_types.py) — so the tool_refused audit needs this field to land in the
    # same per-run namespace the audit readers query. Set ONLY by
    # _build_phase_tool_context (+ propagated onto sub_ctx in task_service);
    # None on every Deep-Mode / tasks caller => byte-identical Deep dispatch.
    workflow_run_id: "UUID | None" = None
    # 099 WFSKILL-01 (D-04) — the materialized skill snapshot for a skill-bearing
    # workflow phase. None on EVERY Deep-mode / non-skill-phase caller => the gated
    # read branch in _handle_read_skill_file (Plan 03) is a literal no-op =>
    # byte-identical Deep behavior (SC#3). Set ONLY by _build_phase_tool_context
    # (Plan 02) when the phase config carries a skill_snapshot. Kept Any (like
    # per_run_task_semaphore) to avoid importing the harness model on the
    # dispatcher hot path.
    skill_snapshot: Any = None  # SkillSnapshot | None — kept Any to avoid a model import on the dispatcher hot path
    # Phase 135 (135-02 / SI-01) — ADDITIVE default-off skill-INSTRUCTIONS override
    # for the honest DRAFT re-eval (RESEARCH Pitfall #1). None on EVERY Deep-mode /
    # normal caller => _handle_load_skill returns row["instructions"] byte-identical.
    # A map {skill_name: instructions} (set ONLY by the re-eval WITH-arm RunContext,
    # threaded through both agent_loop ToolContext builds + the task_service sub_ctx)
    # => _handle_load_skill returns the DRAFT instructions for that skill WITHOUT
    # touching the live skills row. Same additive-default-off discipline as
    # phase_whitelist / workflow_run_id / skill_snapshot above.
    skill_instructions_override: dict[str, str] | None = None
    # Phase 234 TRUST-03: Run-scoped tracking flag indicating external connection-sourced
    # knowledge was retrieved in this run's context (disarms write tools without explicit confirmation).
    has_connection_retrieval: bool = False
    # Phase 264 (264-01 / PACK-17 / D-264-03) — ADDITIVE default-off born-for scope id.
    # None on EVERY Deep-mode / harness / eval / normal caller => the skill-visibility
    # predicate this dispatcher builds is byte-identical to base. A UUID (set ONLY by
    # the two agent_loop ToolContext builds, off a RunContext whose value came from
    # `_resolve_thread_scoping`'s ACCESS-CHECKED `ResolvedExpertBundle.bundle_id`, plus
    # the task_service sub_ctx propagation) => the run has a consultant active and the
    # load path may additionally admit the skills born for it (mig 191's
    # `skills.born_for_expert_bundle_id`). Same additive-default-off discipline as
    # phase_whitelist / workflow_run_id / skill_snapshot / skill_instructions_override
    # above. ⛔ NOTHING reads this in 264-01 — the consumer lands in 264-03.
    born_for_bundle_id: UUID | None = None


@dataclass
class ToolResult:
    """Structured return from a tool handler."""
    result: str  # The tool_result string for persistence + LLM context
    llm_content: str | None = None  # If set, sent to LLM instead of result
    source_refs: list[dict] = field(default_factory=list)  # New source references
    citations: list[dict] = field(default_factory=list)  # New citation objects
    similarity_score: float | None = None  # Avg similarity to accumulate
    sub_agent_record: dict | None = None  # Sub-agent metadata (analyze_document)
    retrieval_error: dict | None = None  # Phase 210 (RAG-09) provider outage details

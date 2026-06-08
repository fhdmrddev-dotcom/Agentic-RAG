# Phase 091: Harness Engine + 5 Phase Types + Gates + Whitelist - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the **backend state-machine harness engine** — the v2.8 milestone core. It drives an
agent through an ordered, locked workflow the LLM cannot escape, over the Phase 090 substrate.

In scope (Requirements: HARNESS-01, HARNESS-03, HARNESS-04, HARNESS-05, HARNESS-07, TOOL-05):
- A state-machine engine that drives transitions through **5 phase types**, each wired to existing
  substrate: `programmatic` (PROGRAMMATIC_PHASE_REGISTRY, pure Python), `llm_single` (one
  `_stream_one_iteration`), `llm_agent` (bounded `run_agent_loop`), `llm_batch_agents`
  (`run_task_sub_agent` fan-out, merged), `llm_human_input` (`ask_user_service` pause/resume).
- **Validation gates** (`json_schema`, `regex_match`, `workspace_file_exists`, `programmatic`) with
  bounded `on_failure` (`fail_run` / `retry` `max_retries=2` + consecutive-identical short-circuit /
  `skip_to_phase:<slug>`); validator error fed back into the retry prompt.
- **Per-phase tool-whitelist enforcement** at `dispatch_tool()` — refuse out-of-whitelist calls with a
  clean `tool_result` on all 6 native providers; additive no-op when no workflow active (Deep Mode
  byte-identical).
- **Resumability** via strict 2-phase write (mark `active` before work, `completed` only after durable
  output); `active`-on-restart re-runs from the top; mid-`ask_user` re-subscribes + re-emits its pending
  prompt on the startup sweep.
- Per-phase **step cap AND wall-clock cap** (`asyncio.wait_for`); publish-time **reachability lint**.
- **2–3 seed workflow templates** (HARNESS-07) shipping global, exercising all 5 types end-to-end.
- **Tool-count budget guard** (TOOL-05) at the `get_tools()` composition site + per-provider `max_tools`
  soft ceiling in MODEL_CAPABILITIES.

Out of scope (later phases): dual-mode wiring + workflow-lock + Continue button (092), Anthropic parity
(093), panel phase timeline (094), chat-card unification (095), eval CI gate + restart-mid-workflow
verification + llm_batch_agents fair-share (096).

**Hard constraint (075.x cascade prevention):** ALL harness logic lives ABOVE the agent loop or at the
single `dispatch_tool()` entry — NEVER in provider-specific streaming branches. Every workflow SSE event
rides the existing `run:{run_id}` stream via `_emit` (zero new Redis namespace).
</domain>

<decisions>
## Implementation Decisions

### Seed workflow templates (HARNESS-07)
- **D-01:** **All 4 discussed templates ship** (one above the "2–3" guideline, accepted for complete
  5-phase-type coverage with no contrived fixtures):
  - **Research → Summarize** (PRIMARY showcase) — `llm_agent` searches KB+web → `llm_single` writes cited
    summary. Exercises `llm_agent` + `llm_single`.
  - **Plan → Execute → Verify** (PRIMARY showcase) — `llm_single` plan → `llm_agent` execute → `llm_single`
    verify behind a gate. Exercises gates across multiple LLM phases.
  - **Literature review (batch)** (COVERAGE fixture) — `programmatic` splits topic → `llm_batch_agents`
    researches sub-questions in parallel → `llm_single` merges. The sole exerciser of `programmatic` +
    `llm_batch_agents`.
  - **Doc Q&A with human checkpoint** (COVERAGE fixture) — `llm_agent` draft → `llm_human_input` pause →
    `llm_single` finalize. The sole exerciser of `llm_human_input` end-to-end.
- **D-02:** If scope tightens, the two PRIMARY showcase templates are must-ship; the two coverage fixtures
  may slip but only if their phase types (`programmatic`/`llm_batch_agents`, `llm_human_input`) are still
  exercised by some other end-to-end fixture (SC#1 requires all 5 types drive end-to-end).
- **D-03:** Templates ship `is_global = true` (per Phase 090 D-02) and are authored as seed/JSONB
  (HARNESS-07 — no visual builder). They double as the UAT fixtures for SC#1/#6.

### Whitelist-refusal feedback (HARNESS-05)
- **D-04:** A blocked (out-of-whitelist) tool call returns a **guiding** `tool_result`: "Tool `X` is not
  available in this phase. Available tools here: [a, b, c]." — so the model self-corrects and stays
  productive (costs one round-trip; workflows feel smart, not stuck). Clean `tool_result` with matching
  `tool_call_id`, no crash / no provider 400 on any of the 6 native providers.
- **D-05 (derived/two-layer):** The whitelist applies at **BOTH** layers — (1) it **filters `get_tools()`**
  per active phase so the model only *sees* the allowed schemas (composes naturally with the TOOL-05
  budget guard at the same composition site), AND (2) `dispatch_tool()` is the **hard enforcement
  backstop**. Consequence: refusals are rare (only stale/hallucinated tool names), and when they fire the
  D-04 message recovers them.
- **D-06:** Every tool refusal is recorded to the INSERT-only `harness_audit` trail (HARNESS-06 substrate
  from 090).

### Failure & timeout surfacing (HARNESS-04 baseline)
- **D-07:** Baseline failure behavior (when `on_failure = fail_run` or a phase hits its step/wall-clock
  cap): the run transitions to **`failed` and stops cleanly** (no further phases). **Completed phases'
  outputs are kept** (durable in `workflow_phases.output` / workspace). A **plain-language reason** reaches
  the chat (e.g. "Phase 2 gate failed after 3 attempts: schema mismatch"); full detail in `harness_audit`.
  Nothing silently dropped.
- **D-08:** **Retries are visible, not silent** — each gate retry attempt emits an SSE event on
  `run:{run_id}` (via `_emit`) AND writes a `harness_audit` row. The engine only EMITS; the panel renders
  the attempt count/timeline in Phase 094.
- **D-09:** The per-phase `on_failure` policy — including `skip_to_phase:<slug>` recovery routing — stays
  available per HARNESS-04. D-07 sets the BASELINE; a template that defines a recovery path overrides it.
  (No v1 seed template uses an auto-fallback recovery phase — see Deferred.)

### Completion output (engine "done" semantics)
- **D-10:** On successful completion, the **final phase's output IS the assistant's chat message,
  verbatim** — templates are authored so the terminal phase (Summarize / Verify / merge / finalize) is
  user-facing. **No extra synthesis LLM call** (deterministic, zero added cost, no drift). Intermediate
  phase outputs stay inspectable in the panel/workspace.
- **D-11:** **No `final_output` config knob and no always-on summary tail in v1.** A synthesized wrap-up
  would overlap PARITY-01's Anthropic summary-tail work (Phase 093); revisit only if a real need appears.

### Caps & defaults (Claude's Discretion — researcher/planner to size)
- **D-12:** Per-phase **step cap** and **wall-clock cap** (`asyncio.wait_for`) are both REQUIRED (SC#5).
  Default values are planner's discretion but MUST check existing config knobs first
  (`backend/.env`, `app_settings`, `MODEL_CAPABILITIES`) before inventing new ones — per
  `feedback_check_user_ask_before_overscoping`. `llm_agent` cap should align with the existing agent-loop
  `max_iterations` convention (Explorer = 8); `llm_batch_agents` fair-share defaults are Phase 096 (CONC-01).

### Claude's Discretion
- Engine module layout + phase-executor dispatch shape; PROGRAMMATIC_PHASE_REGISTRY surface.
- Final `harness.py` Pydantic field shapes for the 5 phase-type configs (finalize against the engine —
  Phase 090 marked these provisional).
- Reachability-lint algorithm + publish-time validation entry point.
- `harness_audit` event-type enum values (phase transitions, gate results, tool refusals).
- Exact wording/format of the D-04 refusal message and the D-07 failure-reason chat copy.

### Folded Todos
None — no pending todos matched this phase (todo list empty per STATE.md).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The engine design (the v2.8 research — authoritative for this phase)
- `.planning/research/ARCHITECTURE.md` — the harness state-machine design, the 5 phase-type → substrate
  mapping (`PROGRAMMATIC_PHASE_REGISTRY`, `_stream_one_iteration`, `run_task_sub_agent`,
  `ask_user_service`), the 2-phase-write resumability pattern, the `dispatch_tool()` whitelist-guard
  placement, and the validation-gate / `on_failure` design.
- `.planning/research/SUMMARY.md` — "harness is ~80% composition of shipped primitives, zero new deps"
  thesis; the build-order rationale (whitelist folds into THIS phase, shares the ToolContext site).

### The 090 substrate this phase consumes (READ — field shapes finalize here)
- `.planning/phases/090-harness-schema-rls-config-models/090-CONTEXT.md` — the schema decisions
  (D-090-01..12): ownership/global model, draft→publish→version immutability, `extra='forbid'` strict
  Pydantic, INSERT-only audit, `org_id NULL` forward-compat, `workflow_phases.output jsonb` as the
  resumability substrate (large outputs spill to `workspace-files` bucket, path-only).
- `backend/app/models/harness.py` — the provisional `PhaseConfig` discriminated union / `ValidatorSpec` /
  `WorkflowDefinition` models from 090; finalize field shapes against the engine's real needs.
- `supabase/migrations/056`–`060_*.sql` (workflow_definitions / _runs / _phases / harness_audit /
  threads.active_workflow_run_id) — the live tables; `supabase/full-schema.sql` for current shape.

### The clean substrate this phase sits on (Phase 089 — READ before touching the loop)
- `backend/app/services/agent_loop.py` — `run_agent_loop()` + `RunContext` / `AgentLoopResult`; the
  byte-identical extracted loop. `llm_agent` phases call into this; do NOT modify provider branches.
- `backend/app/services/tool_dispatcher.py` (+ `dispatch_tool()` entry) — the single tool-dispatch site
  where the HARNESS-05 whitelist guard lands (additive no-op when no workflow active).
- `.planning/phases/089-agent-loop-extraction-g-5-kickoff-uat/089-VERIFICATION.md` — the named per-provider
  round-trip invariants (I1–I14) that MUST stay intact; any harness change is byte-identical-in-Deep-Mode.

### Existing substrate the 5 phase types wire to (READ — reuse, do not reinvent)
- `backend/app/services/task_service.py` — `run_task_sub_agent` + per-run `Semaphore(3)` + global Redis-Lua
  cap (20); the substrate for `llm_batch_agents`.
- `backend/app/services/ask_user_service.py` — Redis pub/sub SUBSCRIBE-first pause/resume + cancel
  sentinel + lifespan shutdown broadcast; the substrate for `llm_human_input` (resume re-subscription is
  the trickiest correctness surface — STATE.md Blockers).
- `backend/app/api/threads.py` — route + producer spawn + `_emit`/`_spawn` + `_shielded_finalize`; the
  `get_tools()` composition site for TOOL-05 + the D-05 per-phase schema filter.
- `backend/app/services/<provider>_service.py` + MODEL_CAPABILITIES registry — `max_tools` soft ceiling
  home (TOOL-05).

### Requirements & success criteria (locked — the binding acceptance bar)
- `.planning/REQUIREMENTS.md` lines 19–25, 47 — HARNESS-01/03/04/05/07 + TOOL-05 verbatim.
- `.planning/ROADMAP.md` § "Phase 091" — the 6 success criteria.

### Process (project conventions — MANDATORY)
- `CLAUDE.md` § Rules — no LangChain/LangGraph (raw SDK), Pydantic for structured outputs, RLS on all
  tables, `run_in_threadpool` for blocking supabase-py calls (D-v2.5-01), Realtime is a hint not truth
  (D-v2.5-03), multi-worker default (WORKER_COUNT=2 — singleton/concurrency discipline).
- `CLAUDE.md` § UAT scoreboard recipe — SC#10 4-axis UAT (cross-provider × multi-tool × parallel-thread ×
  long-message) is a phase-verification gate; **native-7** is the real bar (D-089-05: +zhipu/GLM,
  +minimax), OpenRouter best-effort, Ollama opportunistic.

### Design source (intent only — secondary)
- `.planning/PRDs/v2.7.md` §3 Theme B + §5 — original harness design; sound on engine intent, corrected
  by ARCHITECTURE.md/SUMMARY.md on migration numbers + scope. Defer to research on conflicts.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (harness is ~80% composition — REUSE, do not reinvent)
- **`agent_loop.py::run_agent_loop`** (089) — the bounded agent loop; `llm_agent` phase executor wraps it.
- **`_stream_one_iteration`** — single LLM call; `llm_single` phase executor.
- **`task_service.run_task_sub_agent`** + Semaphore(3)/Redis-Lua-cap(20) — `llm_batch_agents` fan-out.
- **`ask_user_service`** Redis pub/sub pause/resume — `llm_human_input`; the startup-sweep re-subscribe +
  re-emit is the resumability hot spot.
- **`tool_dispatcher.dispatch_tool()`** — single enforcement point for the HARNESS-05 whitelist guard.
- **`_emit` over `run:{run_id}`** — the existing SSE bus; every workflow event rides it (no new namespace).
- **`workflow_phases.output jsonb` + `workspace-files` bucket** (090) — the 2-phase-write durable store.
- **`harness_audit`** (090) — INSERT-only trail for transitions / gate results / refusals.
- **`jsonschema` 4.26.0** (already installed) — backs the `json_schema` validation-gate kind.

### Established Patterns
- Raw SDK, Pydantic structured outputs, RLS everywhere, `run_in_threadpool` for blocking I/O, multi-worker
  singleton discipline (WORKER_COUNT=2), Realtime-as-hint-reconcile-on-fetch.
- Provider differences live at the service boundary; the shared path stays provider-agnostic (one UX, N
  adapters) — the 075.x cascade rule the whole milestone is organized around.

### Integration Points
- `threads.active_workflow_run_id` (090) — the dual-mode anchor; Phase 092's `agent_runner` branches on
  it. Phase 091 builds the engine the branch will call; the actual branch wiring is 092.
- The whitelist guard + `get_tools()` filter must be a literal no-op when `active_workflow_run_id IS NULL`
  (Deep Mode byte-identical — Explorer's 6-KB tool set untouched).

### Critical-risk surfaces (STATE.md Blockers — verification must target these)
- The **2-phase write** (mark `active` before work, `completed` only after durable output) — resumability
  correctness; an `active`-on-restart phase re-runs from the top with no double side-effects.
- The **`ask_user` resume re-subscription** (re-SUBSCRIBE + re-emit pending prompt on the startup sweep) —
  the trickiest correctness surface; independent kill-and-resume verification is Phase 096 (EVAL-02).
</code_context>

<specifics>
## Specific Ideas

- "Workflows should feel smart, not stuck" — the user picked the guiding whitelist-refusal message (D-04)
  over a plain deny specifically so a locked workflow recovers gracefully when the model reaches for a
  blocked tool.
- "Nothing silently dropped" — the user wants partial outputs kept and retries visible on failure (D-07,
  D-08), echoing the milestone-wide aversion to silent tool-call drops (SEED-029 Continue lineage).
- "The last phase is the answer" — the user wants completion to be deterministic and template-authored
  (D-10), not an extra LLM flourish.
</specifics>

<deferred>
## Deferred Ideas

- **Always-on synthesized completion summary / per-template `final_output` flag** (D-11) — overlaps
  PARITY-01 (Phase 093); revive only on real need.
- **on_failure auto-fallback recovery phases inside seed templates** — the `skip_to_phase` mechanism ships
  (HARNESS-04, D-09) but no v1 seed uses a recovery path; add later if a template needs resilience.
- **`llm_batch_agents` fair-share + AnyIO threadpool-budget sizing** (CONC-01, SEED-036a) → Phase 096.
- **Restart-mid-workflow independent kill-and-resume verification** (HARNESS-03 across mid-`programmatic`
  / mid-`llm_agent` / mid-`ask_user`) → Phase 096 (EVAL-02). Phase 091 builds resumability; 096 proves it.
- **Per-phase cap default values** — Phase 091 wires the caps; exact defaults are planner-sized against
  existing config knobs (D-12).

### Reported-bugs cross-check (discuss-phase touchpoint — MANDATORY)
4 open `surface: Agentic-RAG` bugs exist; NONE overlap Phase 091's backend-engine domain — all are
frontend/chat-surface or provider-parity defects already routed:
- `non-anthropic-generic-code-task-descriptions` → PARITY-01 / **Phase 093**
- `chat-tool-cards-scroll-collapse-duplicate`, `step-count-mismatch-timer-vs-panel`,
  `timer-disappears-long-runs` → CHAT-04 / **Phase 095**
No folding into 091. Left open, owned by their routed phases.

### Reviewed Todos (not folded)
None — todo list empty per STATE.md.
</deferred>

---

*Phase: 091-harness-engine-5-phase-types-gates-whitelist*
*Context gathered: 2026-05-31*

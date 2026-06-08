# Phase 091: Harness Engine + 5 Phase Types + Gates + Whitelist - Research

**Researched:** 2026-05-31
**Domain:** Backend state-machine workflow runtime (hand-rolled, raw-SDK) composed over already-shipped Agentic-RAG primitives (FastAPI + Supabase/Postgres + Redis Streams + asyncpg)
**Confidence:** HIGH — every integration claim is grounded in the actual shipped files read this session: `agent_loop.py`, `tool_dispatcher.py`, `task_service.py`, `ask_user_service.py`, `openai_service.py:get_tools`, `config.py:MODEL_CAPABILITIES`+`Settings`, `threads.py:_emit/agent_runner/RUN_TASKS`, migrations 056-060, `harness.py`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Seed workflow templates (HARNESS-07)**
- **D-01:** All 4 discussed templates ship (one above the "2–3" guideline) for complete 5-phase-type coverage:
  - **Research → Summarize** (PRIMARY) — `llm_agent` searches KB+web → `llm_single` cited summary.
  - **Plan → Execute → Verify** (PRIMARY) — `llm_single` plan → `llm_agent` execute → `llm_single` verify behind a gate.
  - **Literature review (batch)** (COVERAGE) — `programmatic` split → `llm_batch_agents` parallel → `llm_single` merge. Sole exerciser of `programmatic` + `llm_batch_agents`.
  - **Doc Q&A with human checkpoint** (COVERAGE) — `llm_agent` draft → `llm_human_input` pause → `llm_single` finalize. Sole exerciser of `llm_human_input` end-to-end.
- **D-02:** If scope tightens, the two PRIMARY templates are must-ship; coverage fixtures may slip ONLY if their phase types are still exercised by some other end-to-end fixture (SC#1 requires all 5 types drive end-to-end).
- **D-03:** Templates ship `is_global = true` (Phase 090 D-02), authored as seed/JSONB (no visual builder). They double as the UAT fixtures for SC#1/#6.

**Whitelist-refusal feedback (HARNESS-05)**
- **D-04:** A blocked tool call returns a GUIDING `tool_result`: "Tool `X` is not available in this phase. Available tools here: [a, b, c]." Clean `tool_result` with matching `tool_call_id`, no crash / no provider 400 on any of the 6 native providers.
- **D-05 (derived, two-layer):** Whitelist applies at BOTH layers — (1) it FILTERS `get_tools()` per active phase (model only SEES allowed schemas; composes with the TOOL-05 budget guard at the same site), AND (2) `dispatch_tool()` is the HARD enforcement backstop. Refusals are rare (only stale/hallucinated tool names); the D-04 message recovers them.
- **D-06:** Every tool refusal is recorded to the INSERT-only `harness_audit` trail (HARNESS-06 substrate from 090).

**Failure & timeout surfacing (HARNESS-04 baseline)**
- **D-07:** Baseline (when `on_failure = fail_run` or a phase hits its step/wall-clock cap): the run transitions to `failed` and stops cleanly (no further phases). Completed phases' outputs are KEPT. A plain-language reason reaches chat ("Phase 2 gate failed after 3 attempts: schema mismatch"); full detail in `harness_audit`. Nothing silently dropped.
- **D-08:** Retries are VISIBLE — each gate retry attempt emits an SSE event on `run:{run_id}` (via `_emit`) AND writes a `harness_audit` row. Engine only EMITS; the panel renders the timeline in Phase 094.
- **D-09:** Per-phase `on_failure` policy — including `skip_to_phase:<slug>` recovery routing — stays available per HARNESS-04. D-07 sets the BASELINE; a template defining a recovery path overrides it. No v1 seed template uses auto-fallback recovery.

**Completion output (engine "done" semantics)**
- **D-10:** On successful completion, the FINAL phase's output IS the assistant's chat message, verbatim. Templates are authored so the terminal phase (Summarize / Verify / merge / finalize) is user-facing. No extra synthesis LLM call (deterministic, zero added cost, no drift). Intermediate phase outputs stay inspectable in the panel/workspace.
- **D-11:** No `final_output` config knob and no always-on summary tail in v1 (would overlap PARITY-01 Phase 093; revisit only on real need).

**Caps & defaults**
- **D-12:** Per-phase step cap AND wall-clock cap (`asyncio.wait_for`) are both REQUIRED (SC#5). Default values are planner's discretion but MUST check existing config knobs first (`backend/.env`, `app_settings`, `MODEL_CAPABILITIES`) before inventing new ones. `llm_agent` cap should align with the existing agent-loop convention (Explorer = 8); `llm_batch_agents` fair-share defaults are Phase 096 (CONC-01).

### Claude's Discretion
- Engine module layout + phase-executor dispatch shape; `PROGRAMMATIC_PHASE_REGISTRY` surface.
- Final `harness.py` Pydantic field shapes for the 5 phase-type configs (finalize against the engine — Phase 090 marked these provisional).
- Reachability-lint algorithm + publish-time validation entry point.
- `harness_audit` event-type enum values (phase transitions, gate results, tool refusals).
- Exact wording/format of the D-04 refusal message and the D-07 failure-reason chat copy.

### Deferred Ideas (OUT OF SCOPE)
- Always-on synthesized completion summary / per-template `final_output` flag (D-11) → overlaps PARITY-01 (Phase 093).
- `on_failure` auto-fallback recovery phases in seed templates (mechanism ships, no v1 seed uses it).
- `llm_batch_agents` fair-share + AnyIO threadpool-budget sizing (CONC-01, SEED-036a) → Phase 096.
- Restart-mid-workflow independent kill-and-resume verification (HARNESS-03 across mid-`programmatic` / mid-`llm_agent` / mid-`ask_user`) → Phase 096 (EVAL-02). Phase 091 builds resumability; 096 proves it.
- Per-phase cap default values — planner-sized against existing config knobs (D-12).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HARNESS-01 | Ordered, locked workflow with 5 phase types; backend drives transitions, LLM cannot reorder/skip | §Phase-type→substrate map. All 5 wrap shipped code: `PROGRAMMATIC_PHASE_REGISTRY` (new dict), `task_service._stream_one_iteration` (llm_single), `task_service.run_task_sub_agent` (llm_agent + llm_batch_agents), `ask_user_service` + `_handle_ask_user` (llm_human_input). |
| HARNESS-03 | Resumable run — phase state persists to `workflow_phases`, survives uvicorn restart + cross-worker, via 2-phase write | §2-Phase Write + Resumability. `workflow_phases.status` CHECK = pending/active/completed/failed/skipped; `output jsonb`; startup-sweep re-runs `active`-on-restart idempotently. |
| HARNESS-04 | Validation gates + bounded `on_failure` (`fail_run` / `retry max_retries=2` + consecutive-identical short-circuit / `skip_to_phase:<slug>`); deterministically-failing gate reaches `failed`, never loops | §Validation Gates. `ValidatorSpec` shipped in `harness.py`. `jsonschema` 4.26.0 installed. |
| HARNESS-05 | Per-phase tool-whitelist enforced in `dispatch_tool()`; clean `tool_result` on all 6 providers; no-op when no workflow active | §Whitelist Guard. Precedent: `_handle_task` subset gate (tool_dispatcher.py:1091-1115) + `ToolContext.available_tools`. One additive guard. |
| HARNESS-07 | 4 seed workflow templates ship as JSONB seed migration; double as UAT fixtures | §Seed Templates. Migration 061, `is_global=true`, `status='published'`, `created_by`= seed system user (`…0001`). |
| TOOL-05 | Tool-count budget guard at `get_tools()` + per-provider `max_tools` soft ceiling in MODEL_CAPABILITIES | §Tool-Count Budget. Folds into the SAME `get_tools()` composition site as the D-05 whitelist filter. `max_tools` does NOT exist yet — must be added to ModelCapability TypedDict. |
</phase_requirements>

## Summary

Phase 091 is the v2.8 milestone core: a **hand-rolled async state machine** (`harness_engine.py`) that drives a published `workflow_definition` through ordered phases over the Phase 090 substrate. The research thesis (`.planning/research/ARCHITECTURE.md`) holds up against the actual shipped code: **the harness is ~80% composition of already-shipped, cross-provider-tested primitives, with zero new dependencies.** The genuinely-new code is (1) the transition loop + 2-phase-write resumability machinery, (2) the 5 phase-executor wrappers, (3) the 4 validators + bounded retry loop, (4) one additive guard in `dispatch_tool()`, (5) one additive filter + budget guard at the `get_tools()` composition site (and a NEW `max_tools` field on the ModelCapability registry), and (6) a publish-time reachability lint.

Correctness hinges on getting the COMPOSITION right, not on new tech. The two highest-risk surfaces (STATE.md Blockers) are both about **durability under restart**: the strict 2-phase write against `workflow_phases.status` and the `ask_user` resume re-subscription. Both must be designed so a re-run of an `active`-on-restart phase produces no double side-effects.

The whole milestone is organized around one hard constraint (the 075.x cross-provider cascade): **ALL harness logic lives ABOVE the agent loop or at the single `dispatch_tool()` entry — NEVER inside provider-specific streaming branches.** Every workflow SSE event rides the existing `run:{run_id}` stream via `_emit` (zero new Redis namespace). In Deep Mode (`threads.active_workflow_run_id IS NULL`) every harness hook is a literal no-op, so Explorer/General behavior stays byte-identical (the Phase 089 invariant).

**Primary recommendation:** Build `backend/app/services/harness_engine.py` (transition loop + 2-phase write + audit emit + startup sweep) plus a `backend/app/services/harness/` package (`phase_types.py` = 5 executors, `validators.py` = 4 kinds, `programmatic.py` = `PROGRAMMATIC_PHASE_REGISTRY`, `reachability.py` = publish lint). Build `llm_agent`/`llm_batch_agents` on `task_service.run_task_sub_agent` (already a complete bounded agent loop with own run row + stream + concurrency caps + whitelist wiring), NOT on the buried top-level loop. Add `phase_whitelist: frozenset[str] | None = None` to `ToolContext` and one guard at the top of `dispatch_tool()`. Filter `get_tools()` output per phase at the existing composition site (precedent: `task_service.py:304-308`) and add a `max_tools` budget guard there. Ship 4 seed templates as migration 061. Resolve every per-phase cap default from the existing config knobs verified below (D-12).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Workflow state machine (transitions, phase lifecycle) | API/Backend (`harness_engine.py`) | Database (`workflow_*` tables) | Pure backend orchestration; the LLM never drives transitions (HARNESS-01 lock). |
| Phase execution (5 types) | API/Backend (`harness/phase_types.py`) | LLM providers (via unchanged adaptive-chat) | Each executor wraps shipped backend primitives; provider calls go through `create_adaptive_streaming_chat`, untouched. |
| Tool whitelist enforcement | API/Backend (`dispatch_tool()` single entry) | — | Must sit at the ONE provider-agnostic dispatch point, below all provider streaming branches (075.x cascade rule). |
| Tool-schema filtering / budget | API/Backend (`get_tools()` composition site) | Config (`MODEL_CAPABILITIES.max_tools`) | The schemas the LLM SEES; filtered + capped server-side before the provider call. |
| Resumable phase state | Database (`workflow_phases` Postgres) | API/Backend (startup sweep) | Postgres is durable truth; Redis is a hint (D-v2.5-03). Survives restart + cross-worker. |
| Validation gates | API/Backend (`harness/validators.py`) | Database/Storage (workspace_file_exists) | Deterministic Python validators; only `workspace_file_exists` touches storage. |
| Human-input pause/resume | API/Backend (`ask_user_service` Redis pub/sub) | Redis (channel + SET) | Cross-worker rendezvous needs Redis pub/sub (asyncio.Event fails at WORKER_COUNT=2). |
| Workflow SSE events | API/Backend (`_emit` → `run:{run_id}`) | Redis Streams | Shared SSE bus; one EventSource per run; zero new namespace. |
| Audit trail | Database (`harness_audit` INSERT-only) | — | Tamper-proof record of transitions/gates/refusals. |
| Seed templates | Database (`workflow_definitions` seed migration) | — | Global, immutable-on-publish JSONB rows. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python `asyncio` (stdlib) | 3.12 | The state machine — one task stepping phases sequentially; `asyncio.wait_for` for per-phase wall-clock cap; `asyncio.gather` for `llm_batch_agents` fan-out | `[VERIFIED: codebase]` Hand-rolled state machine mandated by CLAUDE.md (no LangChain/LangGraph). Already the substrate of the agent + sub-agent loops. |
| `pydantic` | 2.12.5 | Parse `workflow_definitions.definition` JSONB into typed phase configs; `extra='forbid'` strict-parse | `[VERIFIED: backend/app/models/harness.py]` Phase 090 shipped the discriminated-union models; this phase finalizes per-type fields. |
| `jsonschema` | 4.26.0 (installed) | Backs the `json_schema` validation-gate kind | `[CITED: 091-CONTEXT code_context]` "already installed" — no new dependency. |
| `asyncpg` | >=0.29 | Typed DB helpers (`db/workflows.py` mirroring `db/runs.py`) for the hot-path 2-phase write + phase-status reads | `[VERIFIED: agent_loop.py:1031 insert_assistant_message]` Hot-path DB on asyncpg pool (D-073); blocking supabase-py wrapped in `run_in_threadpool` (D-v2.5-01). |
| `redis.asyncio` | >=5.2 | `_emit` → `run:{run_id}` XADD; `ask_user` pub/sub channels; startup-sweep re-subscribe | `[VERIFIED: ask_user_service.py, task_service.py, threads.py:148 redis.xadd]` All existing key conventions; no new namespace. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `re` (stdlib) | 3.12 | `regex_match` validator kind | Validating a phase output against a pattern. |
| `starlette.concurrency.run_in_threadpool` | (FastAPI dep) | Wrap blocking supabase-py calls inside the async engine | Any blocking I/O in the engine path (D-v2.5-01). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled `asyncio` state machine | LangGraph / Temporal / Celery | FORBIDDEN by CLAUDE.md + REQUIREMENTS.md Out-of-Scope. Existing `runs`/Redis/`asyncpg`/`task_service`/`ask_user_service` substrate already covers durability, pause/resume, concurrency, enforcement. `[CITED: REQUIREMENTS.md Out of Scope]` |
| `run_task_sub_agent` for `llm_agent` | The extracted top-level `run_agent_loop` | `run_task_sub_agent` is a self-contained bounded loop with own run row + stream + concurrency accounting + whitelist wiring — better fit for a bounded phase. Use `run_agent_loop` only if a phase needs FULL chat history + top-level streaming-reliability machinery. `[VERIFIED: task_service.py:196 + ARCHITECTURE Pattern 2]` |
| Postgres ENUM for `harness_audit.event_type` | text + CHECK | Already shipped as text+CHECK (059) precisely so 091 can ALTER the CHECK cheaply when adding event kinds. `[VERIFIED: 059:21-30]` |

**Installation:** No new packages. `jsonschema` 4.26.0 installed; `pydantic`/`asyncpg`/`redis`/`anyio` present.

**Version verification:** No new deps. Versions pinned in the existing venv per `.planning/research/ARCHITECTURE.md` Sources (`pydantic 2.12.5, jsonschema 4.26.0, fastapi 0.115.6, redis>=5.2, asyncpg>=0.29`). `[CITED: ARCHITECTURE.md Sources]`

### Verified existing config knobs (D-12 — check these FIRST before inventing defaults)

`[VERIFIED: backend/app/config.py:833-836 + agent_loop.py:846/850/1129]`
- `Settings.task_max_steps: int = 10` — sub-agent iteration clamp (per-call default 5).
- `Settings.task_per_run_concurrency: int = 3` — per-run `asyncio.Semaphore` size.
- `Settings.task_global_concurrency: int = 20` — Redis `tasks:global:active` cap (cross-worker).
- `Settings.ask_user_max_timeout_seconds: int = 1800` — 30-min hard cap (per-call default 300s).
- Agent-loop `max_iterations`: Explorer = **8**, General = **15** (agent_loop.py:846/850). D-12 says `llm_agent` step cap should align with Explorer=8.
- `MODEL_CAPABILITIES[model_id]["llm_call_timeout_seconds"]` (default 300s) + `DEFAULT_LLM_CALL_TIMEOUT_SECONDS=300` — the natural source for a per-phase WALL-CLOCK cap (a phase calling an LLM should allow ≥ the per-call budget; recommend wall-clock = `max_steps × per_call_timeout` ceiling, or a new `Settings.harness_phase_wall_clock_seconds` if no existing knob fits — planner's call per D-12).
- **`max_tools` does NOT exist** in `ModelCapability` (TypedDict at config.py:129) — TOOL-05 must ADD it.

## Architecture Patterns

### System Architecture Diagram

```
User publishes a workflow definition (later: starts a run — wiring is Phase 092)
        │  (091 builds the engine the 092 branch will call)
        ▼
  workflow_definitions (published, immutable)  ──model_validate()──▶ WorkflowDefinition (pydantic, strict)
        │  reachability lint runs at PUBLISH time (orphans / unsatisfiable transitions / terminal exists)
        ▼
  workflow_runs (status=active, current_phase_id)  +  workflow_phases[] (status=pending)
        │
        ▼
┌─────────────────────────  harness_engine.run_workflow(run_id, ctx)  ───────────────────────────┐
│  one asyncio task, steps phases by phase_index sequentially                                      │
│  for each phase (workflow_phases ORDER BY phase_index):                                          │
│    ── 2-PHASE WRITE step 1 ──▶ UPDATE workflow_phases SET status='active'  (DURABLE before work) │
│       _emit phase_started (→ run:{run_id})  + harness_audit INSERT(phase_started)                │
│       asyncio.wait_for(<wall_clock_cap>):                                                        │
│         dispatch by phase_type ─────────────┐                                                    │
│           programmatic    → PROGRAMMATIC_PHASE_REGISTRY[fn](input, ctx)  (pure Python, no LLM)   │
│           llm_single      → task_service._stream_one_iteration (1 drained call)                  │
│           llm_agent       → run_task_sub_agent(allowed_tools=whitelist, max_steps=step_cap)      │
│           llm_batch_agents→ gather(N× run_task_sub_agent) → merge by merge_strategy              │
│           llm_human_input → emit ask_user_prompt; block on ask_user pub/sub channel              │
│       run VALIDATOR gate(s) ──▶ pass? advance : on_failure(fail_run|retry|skip_to_phase)         │
│         retry: feed validator error into prompt; max_retries=2 (≤3 total); consecutive-id SC;    │
│                each attempt emits + harness_audit (D-8)                                          │
│         fail_run: run=failed, keep prior outputs, stop, plain reason to chat (D-7)               │
│    ── 2-PHASE WRITE step 2 ──▶ UPDATE workflow_phases SET status='completed', output=jsonb       │
│       (only after output durable; large output → workspace-files bucket, store path)             │
│       UPDATE workflow_runs.current_phase_id ; _emit phase_completed + phase_transition + audit    │
│  end for ──▶ UPDATE workflow_runs.status='completed' ; final phase output IS chat message (D-10) │
│            _emit run_completed + harness_audit(run_completed)                                     │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
        │ tool calls inside llm_agent/llm_batch_agents phases
        ▼
  dispatch_tool(name, args, ctx)
    if ctx.phase_whitelist is not None and name ∉ whitelist:           ◀── HARNESS-05 guard
        return clean tool_result (D-04 guiding message) ; audit tool_refused (D-06)
    else: normal dispatch  (Deep Mode: phase_whitelist is None → byte-identical no-op)

  STARTUP SWEEP (on producer respawn / lifespan start, multi-worker safe):
    threads with active_workflow_run_id where a workflow_phase is status='active'
      → re-run that phase from the top (idempotency required)
      → if mid-llm_human_input: re-SUBSCRIBE ask_user channel + re-emit pending prompt
```

### Recommended Project Structure

```
backend/app/
├── services/
│   ├── harness_engine.py        # NEW: run_workflow() loop, 2-phase write, audit emit, startup sweep / resume
│   ├── harness/                 # NEW package
│   │   ├── __init__.py
│   │   ├── phase_types.py       # PHASE_TYPE_REGISTRY: 5 executors → existing primitives
│   │   ├── programmatic.py      # PROGRAMMATIC_PHASE_REGISTRY (register_programmatic decorator)
│   │   ├── validators.py        # VALIDATOR_REGISTRY: json_schema / regex_match / workspace_file_exists / programmatic
│   │   └── reachability.py      # publish-time graph lint (pure function)
│   ├── tool_dispatcher.py       # MODIFIED: +phase_whitelist field on ToolContext, +1 guard in dispatch_tool()
│   ├── task_service.py          # REUSED: run_task_sub_agent (do NOT modify the byte-frozen-adjacent paths)
│   └── ask_user_service.py      # REUSED: llm_human_input pause/resume
├── db/
│   └── workflows.py             # NEW: typed asyncpg helpers (mark_phase_active, complete_phase,
│                                #      find_resumable_phases, advance_current_phase) — mirrors db/runs.py
├── models/
│   └── harness.py               # MODIFIED: finalize per-phase-type config fields (provisional → firm)
├── config.py                    # MODIFIED: +max_tools on ModelCapability TypedDict + per-provider rows; maybe +harness cap Settings
└── api/
    └── workflows.py             # NEW (minimal for 091): publish endpoint running the reachability lint
                                 #      (run-start wiring is Phase 092; the engine entry point can live here)
supabase/migrations/
└── 061_harness_seed_templates.sql   # NEW: 4 seed workflow_definitions (is_global, published)
```

> Engine layout is explicitly Claude's discretion. This structure matches the v2.8 ARCHITECTURE research + the 091-CONTEXT canonical-refs; it is the recommendation, not a lock.

### Pattern 1: Per-phase tool whitelist enforcement (the state-machine lock) — HARNESS-05 / D-04 / D-05

**Precedent ships:** `_handle_task` already does a subset gate (tool_dispatcher.py:1091-1115) and `ToolContext.available_tools` already exists (line 88).

**The ONLY `dispatch_tool` change (additive, no-op in Deep Mode):**
```python
# tool_dispatcher.py — add ONE guard at the TOP of dispatch_tool() (current body at :1495).
async def dispatch_tool(tool_name: str, args: dict, ctx: ToolContext) -> ToolResult:
    # HARNESS-05 (D-05 layer 2 — hard backstop). None in Deep Mode → byte-identical no-op.
    if ctx.phase_whitelist is not None and tool_name not in ctx.phase_whitelist:
        # D-04 guiding refusal: tells the model what IS available so it self-corrects.
        # D-06: audit the refusal (fire-and-forget via ctx.spawn(write to harness_audit),
        #       mirroring the existing audit fire-and-forget pattern in the handlers).
        return ToolResult(result=json.dumps({
            "error": "tool_not_available_in_phase",
            "tool": tool_name,
            "message": f"Tool `{tool_name}` is not available in this phase. "
                       f"Available tools here: {sorted(ctx.phase_whitelist)}",
            "allowed": sorted(ctx.phase_whitelist),
        }))
    handler = _TOOL_REGISTRY.get(tool_name)
    if handler is None:
        return ToolResult(result=f"Unknown tool: {tool_name}")
    return await handler(args, ctx)
```

**Add to `ToolContext` (tool_dispatcher.py:60-89):** `phase_whitelist: frozenset[str] | None = None`. Purely additive (mirrors how `available_tools`, `parent_run_id`, `tool_call_id` were each added).

**Cross-provider safety (THE critical question):** The guard lives at the SINGLE dispatch entry, BELOW all provider streaming/parsing. The refusal is a `ToolResult.result` string — the most provider-agnostic surface. It rides the existing tool_result append (same path `_handle_task`'s refusal strings already use across all 6 providers). **No provider 400** because the refusal IS a normal tool_result with the matching `tool_call_id` the loop tracks: `run_task_sub_agent` (task_service.py:348-364) sets `sub_ctx.tool_call_id = tc.get("id")` and appends `{"role":"tool","tool_call_id": tc.get("id"), "content": tr.result}` for EVERY tool call regardless of result content. The guard NEVER touches a provider branch.

**Whitelist set once per phase:** For `llm_agent`/`llm_batch_agents` built on `run_task_sub_agent`, the `allowed_tools` arg ALREADY sets BOTH layers — `sub_ctx.available_tools=list(allowed_tools)` (task_service.py:300) AND the schema filter (task_service.py:304-308). The engine passes `run_task_sub_agent(allowed_tools=phase.available_tools)`. The new `phase_whitelist` field on `ToolContext` hardens dispatch against a hallucinated tool name not in the schema list. **Do NOT query the whitelist per tool call** — pass the frozenset by value once per phase.

### Pattern 2: Phase types map onto existing primitives (the ~80% composition)

| Phase type | Maps onto (shipped) | Evidence (file:line) |
|---|---|---|
| `programmatic` | `PROGRAMMATIC_PHASE_REGISTRY[fn](input, ctx)` — NEW dict mirroring `_TOOL_REGISTRY` | `_TOOL_REGISTRY` at tool_dispatcher.py:1465; pure Python, no LLM. |
| `llm_single` | `task_service._stream_one_iteration(messages, tools, model, user_settings)` | task_service.py:162-193 — `create_adaptive_streaming_chat` + drain in threadpool, returns `(content, tool_calls)`. |
| `llm_agent` | `task_service.run_task_sub_agent(parent_ctx, description, instructions, allowed_tools, max_steps)` | task_service.py:196-436 — complete bounded loop: own run row, own `run:{sub_run_id}` stream, model resolution, `dispatch_tool` per iteration, `finalize_run` + sentinel in finally. Returns `{"sub_run_id","summary","status"}`. |
| `llm_batch_agents` | N× `run_task_sub_agent` via `asyncio.gather` → merge by `merge_strategy` | Per-run `Semaphore` + global Redis-Lua cap (20) already bind concurrency (task_service.py:58-91). v1 default `max_parallel_agents=5` (harness.py:53). Fair-share sizing deferred to 096. |
| `llm_human_input` | `ask_user_service` pub/sub + `_handle_ask_user` flow | tool_dispatcher.py:1273-1458 (canonical 5-step ordered flow) + ask_user_service.py helpers + `POST /runs/{id}/ask_user_response` (runs.py). |

**Key reuse insight (favorable):** `run_task_sub_agent` is ALREADY a cross-provider-safe agent loop. `llm_agent` and `llm_batch_agents` build on it, NOT on the buried top-level loop. The phase executor calls it with the right `allowed_tools` + `max_steps` and captures `result["summary"]` as the phase output.

**Caveat — `run_task_sub_agent` is byte-frozen-adjacent** (the model-resolution footgun `resolve_sub_agent_model_safely` is REPLICATED, not imported, per D-085-16). CALL it, don't edit it. It builds its own sub-agent system prompt (`_build_sub_agent_system_prompt`, task_service.py:97-118 — hardcodes "You are a focused sub-agent…" and excludes task/ask_user/write_todos). The phase's `prompt` (harness.py `LlmAgentPhaseConfig.prompt`) reaches the model via `description`/`instructions` — see OPEN QUESTION 1.

**`programmatic` registry surface (recommended):**
```python
# harness/programmatic.py
PROGRAMMATIC_PHASE_REGISTRY: dict[str, Callable[[dict, "PhaseRunCtx"], Awaitable[dict]]] = {}
def register_programmatic(name: str):
    def deco(fn): PROGRAMMATIC_PHASE_REGISTRY[name] = fn; return fn
    return deco
```
The "Literature review (batch)" seed's split step is the sole v1 consumer — a `split_topic`-style fn returning N sub-questions for the batch phase to fan out over.

### Pattern 3: 2-phase write + resumability (HARNESS-03, highest risk)

**Exact write sequence against `workflow_phases` (status CHECK = pending/active/completed/failed/skipped, output jsonb):**
1. Start: `UPDATE workflow_phases SET status='active', updated_at=now() WHERE id=$phase_id` — DURABLE before any work. Then `_emit phase_started` + `harness_audit INSERT(phase_started)`.
2. Execute (dispatch by type, run gate, retries).
3. Complete: `UPDATE workflow_phases SET status='completed', output=$jsonb WHERE id=$phase_id` — ONLY after output durable (large output → `workspace-files` bucket, store path-only; do NOT bloat `output jsonb`). Make the status flip + output write ONE UPDATE so they're atomic.
4. `UPDATE workflow_runs SET current_phase_id=$next` + `_emit phase_transition`.

**Write-before-emit** is the rule (consumers tolerate lag via reconcile-on-fetch, D-v2.5-03). Postgres is truth; SSE is a hint.

**Startup sweep (resume path):** On producer (re)spawn for a thread with `active_workflow_run_id IS NOT NULL` (or a lifespan scan for stranded runs): find phases where `workflow_runs.status IN ('active','paused')` AND `workflow_phases.status='active'` → re-run that phase **from the top** (a phase still `active` was never `completed`, so its output was never durably written → re-running is the correct resume point).

**Idempotency per phase type (make re-run safe):**
| Phase type | Re-run concern | Mitigation |
|---|---|---|
| `programmatic` | Pure fn → safe | Document: programmatic fns MUST be idempotent (pure input→output). |
| `llm_single` | Re-runs a PAID call (D-v2.5-05) | Acceptable for v1 (one call). No mid-stream checkpoint (impossible). Flag cost. |
| `llm_agent` | Re-runs a bounded loop → re-spend + may re-write workspace / re-call side-effecting tools | Highest cost. Fresh `sub_run_id` per re-run (uuid4) orphans the old partial run harmlessly. Workspace writes are versioned (append-only) → re-write = new version, not corruption. Flag re-spend. |
| `llm_batch_agents` | Same × N | Each re-run forks N fresh sub_run_ids. |
| `llm_human_input` | Pending prompt + already-given answer | Pattern 4 — answer durable in a `messages` row; resume re-subscribes, doesn't re-ask if answered. |

> **Anti-Pattern (ARCHITECTURE #5):** never checkpoint mid-LLM-call. Checkpoint at PHASE boundaries only. Cost is documented, not engineered away. **Phase 091 builds resumability; Phase 096 (EVAL-02) proves it.** 091's own UAT should at minimum exercise a restart-mid-workflow smoke per phase type.

### Pattern 4: `ask_user` resume re-subscription (HARNESS-03 / D-10, trickiest path)

**How `ask_user` works today (tool_dispatcher.py:1273-1458, the 5-step ordered flow):**
1. `pubsub.subscribe(f"ask_user:{run_id}:{tool_call_id}")` — SUBSCRIBE first.
2. `SADD ask_user:channels:{run_id} <channel>` + `EXPIRE 3600` — advertise to cancel/shutdown sweeps.
3. INSERT a `messages` row `role='system'`, `tool_calls=[{kind:'ask_user_prompt', tool_call_id, prompt, options, timeout_seconds, run_id}]` — DURABLE for reload (D-085-05).
4. `_emit ask_user_prompt` SSE event on `run:{run_id}`.
5. Block on `pubsub.get_message(timeout=1.0)` inside `asyncio.wait_for(timeout_seconds)`. Wake payloads: `{kind:response|cancel|shutdown}`.

**Answer side (ask_user_service.py:120-139):** `POST /runs/{id}/ask_user_response` persists the response row FIRST then `publish_response` PUBLISHes `{kind:response, response_text, choice_index}`. Returns subscriber count (0 = SUBSCRIBE dead, but row durable → answer survives).

**Redis keys to trace:** `ask_user:{run_id}:{tool_call_id}` (per-call channel) + `ask_user:channels:{run_id}` (SET of active channels).

**What the startup sweep must do for a mid-`ask_user` phase:**
- An `llm_human_input` phase is `status='active'` on restart. Determine answered-vs-pending:
  - **If answered:** a durable response `messages` row exists (POST persists row-first). Resume reads it, proceeds to next phase — do NOT re-ask. **OPEN QUESTION 2** — the exact shape distinguishing the response row from the `kind='ask_user_prompt'` prompt row needs confirming against `runs.py:/ask_user_response`. Note the Phase 086 surface note: system rows are FILTERED from `/snapshot` + `/messages`; `panel.py /pending` is the path that scans system rows directly (the resume sweep should query the way `/pending` does, matching on `tool_call_id`).
  - **If pending:** re-SUBSCRIBE `ask_user:{run_id}:{tool_call_id}` (the old subscriber died with the worker), re-SADD the channels set, then re-EMIT `ask_user_prompt` (the frontend lost the live event on disconnect; the durable prompt row + fresh emit re-renders the question). Then block on the channel exactly as the original handler. The `tool_call_id` comes from the durable prompt row's `tool_calls[0].tool_call_id`.

**The trap (Pitfall 2):** re-emit MUST be AFTER re-subscribe (the PUBLISH-before-SUBSCRIBE race). Mirror the 5-step order: subscribe → sadd → (row exists, skip) → emit → block.

> Single trickiest correctness surface in the phase. 096 EVAL-02 owns the independent kill-and-resume proof; 091 builds the re-subscribe path + unit-tests the "answered → don't re-ask" and "pending → re-subscribe+re-emit" branches with a mocked Redis.

### Pattern 5: Validation gates + bounded retry (HARNESS-04 / D-07/08/09)

**4 validator kinds (`ValidatorSpec.kind` literal, firm in harness.py):**
| kind | Implementation | Touches |
|---|---|---|
| `json_schema` | `jsonschema.validate(output_payload, config["schema"])` (4.26.0) | CPU |
| `regex_match` | `re.search(config["pattern"], output_text)` | CPU |
| `workspace_file_exists` | check the workspace for `config["path"]` (DB/bucket lookup) | DB/Storage |
| `programmatic` | a registered validator fn (own registry, mirrors PROGRAMMATIC_PHASE_REGISTRY) | Python |

**`VALIDATOR_REGISTRY` recommended** (mirror `_TOOL_REGISTRY`): `dict[kind, Callable[[output, config, ctx], Awaitable[GateResult]]]`; `GateResult = (passed: bool, error_message: str|None)`.

**Bounded retry loop (deterministically-failing gate MUST reach `failed`, never loop):**
```
attempt = 0; last_output = None
while True:
    output = <execute phase>
    result = run_gates(output, phase.validators)
    if result.passed: break  # advance
    if output == last_output:           # consecutive-identical → retrying won't help
        → apply on_failure as if retries exhausted
    last_output = output
    if attempt < max_retries (default 2 → 3 total):
        attempt += 1
        emit gate_failed (D-8) + harness_audit(gate_failed, {attempt, error})   # VISIBLE retries
        retry_prompt = phase.prompt + f"\n\nPrevious output failed validation: {result.error_message}. Fix it."
        continue
    else:                               # exhausted → on_failure:
        fail_run        → run=failed, keep completed phases' outputs (D-7), stop, plain reason to chat
        skip_to_phase:X → jump to slug X (D-9)
```

**Retry state lives loop-local** in the engine for the phase's lifetime (attempt counter, last_output). Each attempt is durably recorded via `harness_audit` (D-8). On restart an `active` phase re-runs from attempt 0 — a phase that exhausted retries would already be `failed`, not `active`. **OPEN QUESTION 3** — persist the attempt count so a restart mid-retry resumes at the right attempt? Recommendation: NO for v1 (re-run from 0 is bounded + simpler). Flag for planner.

**`on_failure` parse:** `ValidatorSpec.on_failure: str = "fail_run"` with values `fail_run | retry | skip_to_phase:<slug>`. Recommend `on_failure='retry'` = "retry up to max_retries then fall back to fail_run (D-07 baseline) unless a skip_to_phase is also configured." Planner pins the precise semantics (CONTEXT D-09: D-07 baseline, recovery path overrides).

### Pattern 6: `get_tools()` composition — D-05 layer-1 filter + TOOL-05 budget (same site)

**What `get_tools()` is `[VERIFIED: openai_service.py:768-784]`:** returns a HARDCODED list of ~24 tool schemas (`SEARCH_DOCUMENTS_TOOL, QUERY_DOCUMENTS_TOOL, …, WRITE_TODOS_TOOL, TASK_TOOL, ASK_USER_TOOL`), conditionally appending `WEB_SEARCH_TOOL`/`EXECUTE_CODE_TOOL` based on settings. There is **NO existing priority field and NO max_tools** — "priority" today = list assembly order.

**Precedent filter (task_service.py:304-308):**
```python
full_tool_schemas = get_tools(user_settings)
phase_tool_schemas = [t for t in full_tool_schemas if t.get("function", {}).get("name") in allowed_tools]
```

**Two surfaces, keep separate (D-05):**
1. **Schema filter (layer 1):** filter `get_tools()` by the phase whitelist before `tools_override` → model only SEES allowed tools. (Already done by `run_task_sub_agent`.)
2. **Dispatch guard (layer 2):** `ctx.phase_whitelist` in `dispatch_tool()` (Pattern 1) — backstop for hallucinated names.

**TOOL-05 budget guard at the SAME site:** after the whitelist filter, if the schema count exceeds a per-provider `max_tools` soft ceiling, drop lowest-priority tools — but ALWAYS retain the whitelist tools (they're the point of the phase). `max_tools` lives in `MODEL_CAPABILITIES` `[VERIFIED: config.py:129 ModelCapability TypedDict, :179 the dict]` — it does NOT exist yet, so 091 ADDS a `max_tools` field to the `ModelCapability` TypedDict + populates the rows that need it (esp. Google, per SEED-035). **Tool "priority":** no explicit scheme exists → use "whitelist tools first, then the rest in `get_tools` assembly order" (registry order). `[VERIFIED: get_tools body has no priority]`

### Pattern 7: Reachability lint at publish time (D-09 / HARNESS-04 safety)

**What:** Before a `workflow_definitions` row flips `draft → published`, validate the phase graph:
- **Orphans:** every phase except the entry (`phase_index==0`) is reachable (sequential default + `skip_to_phase` edges).
- **Unsatisfiable transitions:** every `skip_to_phase:<slug>` targets an existing slug.
- **Terminal exists:** the workflow can reach completion (no cycle that can't terminate; the last phase has no looping outgoing skip).

**Where publish happens:** the publish endpoint is NEW (`api/workflows.py`). Phase 090 shipped the immutable-on-publish DB trigger (`workflow_definitions_block_published_update`, 056:81-99) but NOT an HTTP publish endpoint. **OPEN QUESTION 5** — does 091 own a user-publish endpoint, or is v1 publish "seed migration writes published rows directly"? The 4 seed templates are written directly as published rows in migration 061 (SQL-editor superuser bypasses RLS + lint). Recommend: build the lint as a pure function `lint_workflow(WorkflowDefinition) -> list[LintError]` unit-tested against the 4 seeds (must lint-clean) + deliberately-broken fixtures; wire into a minimal publish endpoint only if 091 ships user-publish, else defer the endpoint to 092. Flag for planner.

### Pattern 8: Seed templates as a migration (HARNESS-07 / D-01/02/03)

**Row shape (mirrors migration 056's single seed, 056:127-151):** INSERT into `workflow_definitions (id, slug, version, name, status, definition, created_by, is_global)`:
- `status='published'` (the block-published trigger then freezes it — correct per 090 D-04).
- `created_by` = seed system user `'00000000-0000-0000-0000-000000000001'` (created idempotently in 056; 061 can rely on it or re-assert with `ON CONFLICT DO NOTHING`).
- `is_global=true` (D-03; only seed migrations set this — RLS forbids users self-setting is_global, 056:55-57 + 060).
- `definition` = the FULL `WorkflowDefinition` JSONB shape `{slug, version, name, status, phases:[{slug, phase_index, config:{phase_type,...}, validators:[...]}]}` so `WorkflowDefinition.model_validate(row["definition"])` parses cleanly.
- `ON CONFLICT (id) DO NOTHING` for idempotent re-apply.

**Next migration number is 061.** `[VERIFIED: supabase/migrations/ head = 060_harness_update_with_check.sql; 056-059 applied per 060 header + STATE.md]`

**Migration discipline (CLAUDE.md):** author the SQL; apply by pasting into the Supabase SQL editor (never db push/reset); then `bash scripts/regenerate-full-schema.sh`; commit both. `autonomous:false` apply step (mirrors how 090 Plan 03 applied 056-059).

**The 4 definitions must collectively exercise all 5 types end-to-end (SC#1)** and double as UAT fixtures (D-03).

### Pattern 9: Workflow SSE rides the existing `run:{run_id}` stream (zero new substrate)

`[VERIFIED: threads.py:139-153]` `_emit(redis, run_id, type, **fields)` does ONE canonical XADD to `run:{run_id}` with `{"data": json.dumps({"type": type, **fields})}`, `maxlen=10000`. ALL existing events (`delta`, `tool_start`, `todo_updated`, `ask_user_prompt`, `sub_agent_start`, `workspace_file_written`) use this exact signature (80+ call sites in agent_loop.py). Workflow events (`phase_started`, `phase_completed`, `phase_transition`, `gate_failed`, `run_completed`, `run_failed`, `tool_refused`) are just new `type` strings on the same bus. NOTE: terminal sentinels go through `_emit_terminal` (threads.py:156, type must be in `TERMINAL_TYPES`) — if the harness needs a workflow-terminal sentinel, coordinate with `TERMINAL_TYPES`; otherwise use plain `_emit`. Phase 094 consumes; 091 only EMITS. Zero new Redis namespace (D-v2.5-08).

### Anti-Patterns to Avoid

- **Editing the shared streaming/parsing path to add phase logic.** = the 075.3 cascade. All harness logic ABOVE the loop or at the single `dispatch_tool` entry. The refusal is a tool_result string.
- **Building on `agent_runner`/the top-level loop directly.** Use `run_task_sub_agent` (clean, bounded) or the extracted `run_agent_loop`. Never copy-paste the loop.
- **New Redis namespace / new SSE substrate for workflow events.** XADD to `run:{run_id}` via `_emit`.
- **Querying the whitelist per tool call.** Resolve once when the phase starts; pass the frozenset by value.
- **Mid-LLM-call checkpointing for resumability.** Checkpoint at PHASE boundaries only.
- **Modifying byte-frozen paths** (`sub_agent_service.py` per D-085-16; the 3 provider chunk-handlers in agent_loop.py per Phase 089). Compose by calling, never by editing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bounded agent loop for `llm_agent`/`llm_batch_agents` | A new loop | `task_service.run_task_sub_agent` | Complete bounded loop with own run row + stream + model resolution + dispatch + concurrency caps + finalize. `[VERIFIED: task_service.py:196-436]` |
| One LLM call for `llm_single` | New streaming/drain | `task_service._stream_one_iteration` | Drains a sync stream in threadpool, returns (content, tool_calls). `[VERIFIED: task_service.py:162-193]` |
| Pause/resume for `llm_human_input` | New pub/sub | `ask_user_service` + `_handle_ask_user` 5-step flow | Cross-worker-safe Redis pub/sub with the PUBLISH-before-SUBSCRIBE race mitigated. `[VERIFIED: ask_user_service.py, tool_dispatcher.py:1273-1458]` |
| Cross-worker batch concurrency cap | A new counter | `acquire_global_task_slot` Redis-Lua (cap 20) + per-run Semaphore | Atomic INCR+EXPIRE, multi-worker safe, TTL leak-recovery. `[VERIFIED: task_service.py:58-91]` |
| JSON-schema validation | A custom validator | `jsonschema.validate` (4.26.0) | Installed, standard. `[CITED: 091-CONTEXT]` |
| SSE event bus | A workflow stream | `_emit` → `run:{run_id}` | Single EventSource per run; replay/reconcile exists. `[VERIFIED: threads.py:139]` |
| Per-phase wall-clock cap | A custom timer | `asyncio.wait_for(coro, timeout)` | stdlib; cancels the phase coro cleanly. |
| Tool-schema subset filter | New filtering | `[t for t in get_tools(...) if t["function"]["name"] in allowed]` | Exact precedent. `[VERIFIED: task_service.py:304-308]` |

**Key insight:** Custom code is a liability here — every primitive is already shipped + cross-provider-tested. New code is the THIN orchestration glue (transition loop, 2-phase write, validator dispatch, 2 additive guards, +max_tools field) + 4 JSON seed rows. Composition by calling, never by editing the hot path.

## Common Pitfalls

### Pitfall 1: 2-phase write done backwards (completed-before-durable)
**What goes wrong:** Marking a phase `completed` before its output is durably written; a restart between mark and write loses output but skips the phase on resume.
**How to avoid:** `active` BEFORE work; `completed` ONLY after `output` is written. Make the status flip + output write a SINGLE atomic UPDATE.
**Warning signs:** A resumed run skips a phase whose output is empty.

### Pitfall 2: ask_user re-emit before re-subscribe (PUBLISH-before-SUBSCRIBE race)
**What goes wrong:** The sweep emits the prompt SSE before re-subscribing; a fast user answer lands between emit and subscribe and is lost → run hangs.
**How to avoid:** subscribe → sadd → (prompt row exists, skip) → emit → block. AND first check for a durable response row to avoid re-asking an answered question.
**Warning signs:** A resumed workflow stuck on a human-input phase the user already answered.

### Pitfall 3: Whitelist guard touches a provider branch
**What goes wrong:** Adding the check inside a provider's parsing / the SSE emitter → cross-provider regression.
**How to avoid:** Guard ONLY at the top of `dispatch_tool()`; refusal is a `ToolResult.result` string. Never edit chunk handlers / provider services.
**Warning signs:** A provider that worked in Deep Mode now 400s or drops tool calls.

### Pitfall 4: Refusal tool_result missing the matching tool_call_id
**What goes wrong:** A refusal without the original `tool_call_id` → Anthropic 400 "tool_result without tool_use."
**How to avoid:** The refusal rides the SAME tool-result append the loop already does (`{"role":"tool","tool_call_id": tc["id"], "content": refusal}`). `dispatch_tool` returns a `ToolResult`; the loop attaches the id (task_service.py:359-364 appends for every tc regardless of result).
**Warning signs:** Anthropic 400 after a blocked tool.

### Pitfall 5: `retry` re-running a phase with non-idempotent side effects
**What goes wrong:** A retry on an `llm_agent` phase that wrote workspace files re-writes them / re-spends.
**How to avoid:** Workspace writes are versioned (append-only) → re-write = new version (safe). For paid re-spend, accept the bounded cost (≤3 attempts) + consecutive-identical short-circuit. Document. Don't "undo" a partial phase.
**Warning signs:** Duplicate workspace versions / unexpected spend on a retrying phase.

### Pitfall 6: `harness_audit.event_type` not in the CHECK constraint
**What goes wrong:** Emitting an event_type outside 059's CHECK → INSERT fails (23514).
**How to avoid:** 059 CHECK allows: `phase_started, phase_completed, phase_transition, gate_passed, gate_failed, tool_refused, run_started, run_completed, run_failed`. Reuse these where possible (a retry = `gate_failed` with `{attempt:N}` in metadata). If a new kind is genuinely needed (`phase_skipped`), ship a tiny ALTER (it's text+CHECK precisely so this is cheap — 059:21). The final event_type set is Claude's discretion.
**Warning signs:** A `harness_audit` INSERT raising check_violation mid-run.

### Pitfall 7: Multi-worker double-execution of a resumed run
**What goes wrong:** With WORKER_COUNT=2, two workers' sweeps both pick up the same `active` phase.
**How to avoid:** Resume rides the existing per-thread producer-spawn machinery (`RUN_TASKS` dict, threads.py:116; `runs:active`/`runs_by_thread` sorted sets) — one producer per run. If a standalone lifespan sweep is added, it MUST claim the run (CAS `workflow_runs.status` or a Redis lock) before re-running. **OPEN QUESTION 6** — confirm resume rides the existing spawn (preferred). Flag for planner.
**Warning signs:** Duplicate sub-agent runs / double spend after a restart with 2 workers.

## Runtime State Inventory

> Backend-engine phase (not rename/refactor), but it COMPOSES live runtime state. Listed for resumability planning.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `workflow_runs` (status, current_phase_id), `workflow_phases` (status, output jsonb) — durable run state | Engine reads/writes; the 2-phase write is the core of resumability. Large outputs spill to `workspace-files` bucket (path-only). |
| Live service config | None new. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None new for the engine. Per-phase cap defaults MAY live in `Settings` (`task_max_steps`, `ask_user_max_timeout_seconds`) / `MODEL_CAPABILITIES.llm_call_timeout_seconds` (D-12 — verified knobs above). | Planner resolves cap defaults from existing config before inventing new env vars. |
| Build artifacts | None. | None. |
| Redis runtime state (transient) | `run:{run_id}` (SSE buffer), `ask_user:{run_id}:{tool_call_id}` + `ask_user:channels:{run_id}` (human-input pub/sub), `tasks:global:active` (batch cap) | The startup sweep must re-subscribe `ask_user` channels for mid-`ask_user` phases (Pattern 4). Others recreated on first write — no migration. |

## Code Examples

Verified patterns from the actual shipped files:

### Sub-agent call for `llm_agent`/`llm_batch_agents` (the executor wraps this)
```python
# Source: backend/app/services/task_service.py:196 (signature + return)
result = await run_task_sub_agent(
    parent_ctx=tool_ctx,                 # ToolContext built for the phase (phase_whitelist set)
    description=phase.prompt,            # OPEN QUESTION 1: prompt→description/instructions mapping
    instructions=None,
    allowed_tools=phase.available_tools, # sets sub_ctx.available_tools + filters schemas
    max_steps=phase.max_steps,           # per-phase STEP cap (D-12; align llm_agent with Explorer=8)
)
phase_output = result["summary"]         # D-10: terminal phase summary IS the chat message
```

### One LLM call for `llm_single`
```python
# Source: backend/app/services/task_service.py:162 (_stream_one_iteration)
content, tool_calls = await _stream_one_iteration(
    messages=[{"role": "system", "content": phase.prompt},
              {"role": "user", "content": prior_output}],
    tools=[], model=effective_model, user_settings=ctx.user_settings,
)
phase_output = content
```

### Per-phase wall-clock cap (D-12, SC#5)
```python
try:
    phase_output = await asyncio.wait_for(execute_phase(phase, ctx), timeout=phase_wall_clock_cap_s)
except asyncio.TimeoutError:
    await _emit(redis, run_id, 'phase_failed', phase=phase.slug, reason='wall_clock_timeout')
    # D-07: run=failed, keep prior outputs, plain reason to chat; harness_audit(run_failed)
```

### Whitelist-filtered schema list (D-05 layer 1) + TOOL-05 budget point
```python
# Source: backend/app/services/task_service.py:304-308 (the exact precedent)
full_tool_schemas = get_tools(user_settings)
phase_tool_schemas = [t for t in full_tool_schemas
                      if t.get("function", {}).get("name") in phase.available_tools]
# TOOL-05 budget guard applies HERE (after whitelist filter): if len > MODEL_CAPABILITIES[model].max_tools,
# drop lowest-priority (registry-order) tools BUT always keep the whitelist tools.
```

### `_emit` workflow event (zero new substrate)
```python
# Source: threads.py:139 — _emit(redis, run_id, type, **fields) → XADD run:{run_id}
await _emit(redis, run_id, 'phase_started', phase=phase.slug, phase_index=phase.phase_index,
            phase_type=phase.config.phase_type)
await _emit(redis, run_id, 'phase_transition', from_phase=prev.slug, to_phase=next.slug)
await _emit(redis, run_id, 'run_completed', status='completed')
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bolt workflow logic onto the 3,186-LOC `threads.py` | `agent_loop.py` extracted (Phase 089, byte-identical) → harness sits on a clean module | Phase 089 (2026-05-30) | Harness composes without re-opening the 075.x cascade. `llm_agent` reuses `run_task_sub_agent`. |
| Provider-specific tool handling | One UX, N adapters — shared SSE vocabulary on `run:{run_id}` | v2.6/v2.7 | Workflow events are just new type strings; no provider branch. |
| asyncio.Event for pause/resume | Redis pub/sub (cross-worker, WORKER_COUNT=2) | Phase 085 | The startup-sweep re-subscribe works across workers. |

**Deprecated/outdated:**
- PRD migration range 125-139 — stale fiction; real head 060, next 061. `[VERIFIED]`
- PRD `threads.deep_mode_metadata jsonb` — dropped (no v2.8 consumer). Only `threads.active_workflow_run_id` exists (059). `[VERIFIED]`
- `provisional` per-phase config fields in `harness.py` — 091 finalizes them (discriminator + extra='forbid' + union are LOCKED; field names are this phase's to refine). `[VERIFIED: harness.py docstring]`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The ask_user response row is a separate durable `messages` row keyed by the same `tool_call_id`, distinguishable from the `kind='ask_user_prompt'` prompt row | Pattern 4 / OQ2 | If the answer isn't durably distinguishable, resume can't tell "answered" from "pending" → re-asks or hangs. Planner MUST trace `runs.py:/ask_user_response` + the Phase 086 system-row-filter note + `panel.py /pending`. |
| A2 | Resume rides the existing per-thread producer-spawn machinery (RUN_TASKS / runs:active) rather than a separate unclaimed lifespan sweep | Pitfall 7 / OQ6 | If a standalone lifespan sweep is used without a claim, 2 workers double-execute a resumed run. |
| A3 | Tool "priority" for the TOOL-05 budget = `get_tools` assembly order (no explicit priority field) | Pattern 6 | `[VERIFIED: get_tools body — no priority field]` — low risk; confirmed this session. |

> All other previously-open items (`_emit` signature, MODEL_CAPABILITIES shape, max_tools absence, existing cap knobs) were VERIFIED this session and are no longer assumptions.

## Open Questions

1. **`phase.prompt` → `run_task_sub_agent` mapping.** `run_task_sub_agent` takes `description` + `instructions` and builds its own sub-agent system prompt (`_build_sub_agent_system_prompt`, task_service.py:97). The phase's `prompt` must reach the model.
   - Recommendation: map `phase.prompt → instructions` (richest), `description` = a short phase label. If the hardcoded "focused sub-agent" framing conflicts with the phase intent, add an optional `system_prompt_override` param to `run_task_sub_agent` (small additive change). Pin in the plan.

2. **ask_user answered-vs-pending detection on resume.** (A1.) Trace the response-row shape from `POST /runs/{id}/ask_user_response` and the Phase 086 surface note; the sweep should query the way `panel.py /pending` does, matching on `tool_call_id`.

3. **Persist retry-attempt state across restart?** Recommendation: NO — re-run from attempt 0 (bounded, safe, simpler). A phase that exhausted retries is `failed`, not `active`, so a restart never lands mid-retry on an `active` phase. Flag for planner sign-off.

4. **`max_tools` rollout in MODEL_CAPABILITIES.** The field does not exist (`[VERIFIED]`). 091 adds it to the `ModelCapability` TypedDict (config.py:129) + populates the per-provider rows that need a ceiling (Google especially, per SEED-035). Planner decides which model rows get an explicit `max_tools` and the default-when-absent behavior (recommend: no cap when absent — the budget guard is a soft ceiling that only fires for registered low-limit models).

5. **Does 091 own a publish HTTP endpoint, or are v1 publishes seed-migration-only?** Recommendation: build the reachability lint as a pure function unit-tested against the 4 seeds; wire into a minimal publish endpoint only if 091 ships user-publish; else defer the endpoint to 092. Pin in the plan.

6. **Resume path: per-thread producer spawn vs lifespan sweep.** (A2 / Pitfall 7.) Recommend riding the existing `RUN_TASKS`/per-thread spawn (inherits single-producer discipline); confirm the spawn machinery is reachable from the harness entry. The `_shielded_finalize` pattern (threads.py:1122) is the model for clean run termination — the harness's run-completion/failure path should mirror it (finalize_run UPDATE before terminal sentinel, Pitfall 2 ordering).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase (local Postgres + Storage) | workflow_* tables, workspace-files bucket | ✓ | CLI v2.101 | — |
| Redis (local docker-compose) | `run:{run_id}` SSE, ask_user pub/sub, batch caps | ✓ | docker-compose.dev.yml | — |
| `jsonschema` | json_schema validator | ✓ | 4.26.0 | — |
| `pydantic` | config parse | ✓ | 2.12.5 | — |
| `asyncpg` | hot-path DB helpers | ✓ | >=0.29 | — |
| 6 native provider keys | llm_* phase types cross-provider UAT | ✓ (OpenAI/Anthropic/Google/DeepSeek/Moonshot/GLM/MiniMax) | — | OpenRouter best-effort, Ollama opportunistic |

**Missing dependencies with no fallback:** None — entirely composition of installed substrate.

**Project skills note:** `sketch-findings-agentic-rag` exists but this is a BACKEND phase with NO UI surface (the panel timeline is Phase 094). The skill is NOT relevant here. Confirmed.

## Validation Architecture

> nyquist_validation is enabled (`config.json workflow.nyquist_validation: true`). This drives VALIDATION.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend) — `backend/tests/unit/` + `backend/tests/integration/` (existing convention: `test_075_1_drain_step.py`, `test_chunk_handler_provider_aware.py`, `test_075_4_registry_sweep.py`) |
| Config file | backend pytest config (existing; tests run from the backend venv) |
| Quick run command | `cd backend && python -m pytest tests/unit/test_091_*.py -x` |
| Full suite command | `cd backend && python -m pytest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HARNESS-01 | Each of 5 phase types dispatches to its executor; engine drives ordered transitions | unit (mocked executors) | `pytest tests/unit/test_091_phase_dispatch.py -x` | ❌ Wave 0 |
| HARNESS-01 | All 5 types drive end-to-end via the 4 seed templates | integration + live UAT | `pytest tests/integration/test_091_seed_templates.py -x` | ❌ Wave 0 |
| HARNESS-03 | 2-phase write order: `active` before work, `completed` only after output durable | unit (mocked asyncpg, assert UPDATE order) | `pytest tests/unit/test_091_two_phase_write.py -x` | ❌ Wave 0 |
| HARNESS-03 | Startup sweep re-runs `active`-on-restart; answered-ask_user → no re-ask; pending → re-subscribe+re-emit | unit (mocked Redis + DB) | `pytest tests/unit/test_091_resume_sweep.py -x` | ❌ Wave 0 |
| HARNESS-03 | uvicorn-restart-mid-workflow smoke per phase type | manual/integration (operator) | restart-mid-run runbook (full proof = 096 EVAL-02) | ❌ Wave 0 (smoke) |
| HARNESS-04 | 4 gate kinds pass + fail | unit | `pytest tests/unit/test_091_validators.py -x` | ❌ Wave 0 |
| HARNESS-04 | Deterministically-failing gate reaches `failed` after ≤3 attempts; consecutive-identical SC; never loops | unit (deterministic) | `pytest tests/unit/test_091_gate_retry_bounded.py -x` | ❌ Wave 0 |
| HARNESS-04 | retry feeds validator error into prompt; each attempt emits + audits (D-8) | unit | `pytest tests/unit/test_091_gate_retry_visible.py -x` | ❌ Wave 0 |
| HARNESS-04 | `skip_to_phase:<slug>` routing (D-9) | unit | `pytest tests/unit/test_091_skip_to_phase.py -x` | ❌ Wave 0 |
| HARNESS-05 | Out-of-whitelist tool refused w/ clean tool_result + matching tool_call_id; in-whitelist passes | unit (mocked dispatch) | `pytest tests/unit/test_091_whitelist_guard.py -x` | ❌ Wave 0 |
| HARNESS-05 | Refusal accepted by all 6 native providers (no 400) | UAT (live cross-provider) | scoreboard rows | ❌ Wave 0 |
| HARNESS-05 | Deep Mode (phase_whitelist=None) → dispatch byte-identical no-op | unit | `pytest tests/unit/test_091_deep_mode_noop.py -x` | ❌ Wave 0 |
| HARNESS-07 | 4 seeds parse via `WorkflowDefinition.model_validate`; lint clean; cover 5 types | unit | `pytest tests/unit/test_091_seed_definitions.py -x` | ❌ Wave 0 |
| HARNESS-07 | Reachability lint flags orphans / unsatisfiable transitions / missing terminal | unit (broken fixtures) | `pytest tests/unit/test_091_reachability_lint.py -x` | ❌ Wave 0 |
| TOOL-05 | Budget guard drops lowest-priority tools past max_tools BUT retains whitelist tools | unit | `pytest tests/unit/test_091_tool_budget.py -x` | ❌ Wave 0 |
| (D-07) | fail_run keeps completed phases' outputs + plain-language chat reason | unit | `pytest tests/unit/test_091_fail_keeps_partial.py -x` | ❌ Wave 0 |
| (D-12) | Per-phase step cap AND wall-clock cap both enforced | unit (asyncio.wait_for + step cap) | `pytest tests/unit/test_091_caps.py -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the relevant `tests/unit/test_091_*.py` quick subset.
- **Per wave merge:** `cd backend && python -m pytest tests/unit/test_091_*.py tests/integration/test_091_*.py`.
- **Phase gate:** full suite green before `/gsd:verify-work`; PLUS the live 4-axis cross-provider UAT (below).

### 4-Axis UAT Bandwidth (SC#10 — MANDATORY; this phase touches agent-loop + provider-routing + the dispatch path)

Authored under VALIDATION.md, NOT in PLAN.md tasks. All 4 axes against the native-7 (real bar: OpenAI, Anthropic, Google, DeepSeek, Moonshot, GLM/Zhipu, MiniMax; OpenRouter best-effort):

| Axis | Required coverage for 091 |
|------|---------------------------|
| Cross-provider | Run a seed workflow (e.g. Research→Summarize) on each native provider; assert the locked sequence completes with correct tool round-trips AND the whitelist refusal is accepted (no 400) on each. |
| Multi-tool | A phase whose whitelist allows 2+ tools (e.g. `search_documents` + `execute_code`); assert both dispatch and an out-of-whitelist call is cleanly refused. |
| Parallel-thread | Thread A running a workflow while Thread B accepts a new prompt; assert no cross-thread state leak (per-thread `active_workflow_run_id`, per-run streams). |
| Long-message | A workflow phase with ≥50 prior messages OR a ≥5 KB phase prompt; assert resumability + caps still hold. |

### Deterministic proof of the two highest-risk surfaces
- **2-phase-write resumability:** unit test with a mocked asyncpg pool recording UPDATE order; assert `status='active'` UPDATE precedes execution and `status='completed'`+output follows; simulate a crash (raise mid-execute) and assert the phase is left `active` (not `completed`, output empty) so the sweep re-runs it. Plus integration: seed an `active` phase row, invoke the sweep, assert re-run.
- **Whitelist refusal:** unit test `dispatch_tool('execute_code', {}, ctx_with_phase_whitelist={'search_documents'})`; assert the returned `ToolResult.result` parses to `{"error":"tool_not_available_in_phase","allowed":["search_documents"],...}` and the loop attaches the original `tool_call_id`. Plus `ctx.phase_whitelist=None` → assert the guard is skipped (identical to pre-091 dispatch).

### Wave 0 Gaps
- [ ] `tests/unit/test_091_phase_dispatch.py` — HARNESS-01 executor routing
- [ ] `tests/unit/test_091_two_phase_write.py` — HARNESS-03 write order + crash-leaves-active
- [ ] `tests/unit/test_091_resume_sweep.py` — HARNESS-03 sweep + ask_user re-subscribe branches
- [ ] `tests/unit/test_091_validators.py` — HARNESS-04 four gate kinds
- [ ] `tests/unit/test_091_gate_retry_bounded.py` — HARNESS-04 bounded retry + short-circuit
- [ ] `tests/unit/test_091_whitelist_guard.py` — HARNESS-05 guard + matching tool_call_id + Deep-Mode no-op
- [ ] `tests/unit/test_091_reachability_lint.py` — publish-time lint
- [ ] `tests/unit/test_091_seed_definitions.py` — 4 seeds parse + lint clean + 5-type coverage
- [ ] `tests/unit/test_091_tool_budget.py` — TOOL-05 budget guard retains whitelist
- [ ] `tests/integration/test_091_seed_templates.py` — end-to-end per seed (mocked LLM where possible)
- [ ] `tests/conftest.py` — shared fixtures: mocked asyncpg pool (UPDATE-order recorder), fake Redis (pub/sub + XADD), a minimal `ToolContext`/`RunContext` factory, a `WorkflowDefinition` builder
- [ ] Framework: pytest already present (no install needed)

## Security Domain

> security_enforcement is not explicitly false in config.json → treat as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface; runs ride the authenticated thread. |
| V3 Session Management | no | No new sessions. |
| V4 Access Control | yes | RLS on all `workflow_*` tables (056-060 via `threads.user_id` FK chain + WITH CHECK). The engine writes via asyncpg (service role) — it MUST scope every read/write by the run's owner; seed `is_global` rows are read-only to users (RLS forbids self-setting is_global). |
| V5 Input Validation | yes | `WorkflowDefinition` uses pydantic `extra='forbid'` (harness.py `_StrictBase`) — typo'd/injected phase-config keys raise ValidationError before the engine consumes them (T-090-01). Reachability lint is a 2nd input-validation gate at publish. `json_schema` uses `jsonschema` (no eval). |
| V6 Cryptography | no | No crypto in this phase. |

### Known Threat Patterns for {hand-rolled state machine + LLM tool dispatch}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| LLM escapes the locked workflow via an out-of-phase tool | Elevation of Privilege | HARNESS-05 dispatch guard (hard backstop) + get_tools schema filter (model never sees the tool). Both layers (D-05). |
| Malicious/typo'd phase config injects an unexpected key or fn name | Tampering | `extra='forbid'` strict parse + `PROGRAMMATIC_PHASE_REGISTRY` is a closed dict (an unknown `fn` fails fast, never `eval`'d). |
| `skip_to_phase` targets a non-existent slug | Tampering / DoS | Reachability lint rejects unsatisfiable transitions at publish; runtime guards an unknown target → `fail_run`. |
| Unbounded gate retry burns tokens/CPU | Denial of Service | Bounded retry (≤3 attempts) + consecutive-identical short-circuit + per-phase step cap AND wall-clock cap (D-12). |
| Resumed run double-executed across workers | DoS / integrity | Single-producer-per-run discipline (RUN_TASKS / runs:active) or a claim before re-run (Pitfall 7 / OQ6). |
| `harness_audit` tamper to hide a refusal/failure | Repudiation | INSERT-only RLS (no UPDATE/DELETE policy → all mutation denied); run_id is a plain uuid with no FK so audit survives run deletion (059). |
| Phase output blob bloats `workflow_phases.output` | DoS | Spill large outputs to `workspace-files` bucket, store path-only (Pattern 3). |

## Project Constraints (from CLAUDE.md)

- **No LangChain / no LangGraph** — raw SDK + hand-rolled `asyncio` state machine. (Also REQUIREMENTS.md Out-of-Scope: no Temporal/Celery.)
- **Zero new dependencies** — harness = composition of shipped primitives.
- **Pydantic for structured outputs / config** — `WorkflowDefinition` strict parse.
- **No blocking I/O in async handlers** — wrap supabase-py in `run_in_threadpool` (D-v2.5-01); hot-path DB on asyncpg pool (D-073).
- **Multi-worker default (WORKER_COUNT=2)** — cross-worker state via Redis pub/sub, NOT asyncio.Event (resume sweep + ask_user).
- **Realtime/SSE is a hint, not truth** — reconcile via fetch (D-v2.5-03); write-to-Postgres-before-emit.
- **Schema changes = numbered SQL migrations** applied via Supabase SQL editor (never db push/reset), then `bash scripts/regenerate-full-schema.sh`. Migration 061 is the next number; the apply step is `autonomous:false`.
- **Stateless chat completions** — store + send history yourself (the engine builds per-phase message lists).
- **Provider-docs-first / cross-provider parity first-class** — all harness logic above the loop or at the single dispatch entry; never in provider streaming branches (075.x cascade rule); native-7 UAT.
- **RLS on all tables** — `workflow_*` already RLS'd (056-060); the engine must not leak across users.

## Sources

### Primary (HIGH confidence — read directly this session)
- `backend/app/models/harness.py` — provisional PhaseConfig discriminated union, ValidatorSpec, WorkflowDefinition.
- `backend/app/services/agent_loop.py` — `run_agent_loop` (kw-only `emit`/`emit_terminal`/`spawn`/`timeout_ctx`/`result_sink`), `RunContext`/`AgentLoopResult`, `max_iterations` (Explorer=8 :846, General=15 :850), `_per_run_task_semaphore = asyncio.Semaphore(settings.task_per_run_concurrency)` :1129, ToolContext build :1968.
- `backend/app/services/tool_dispatcher.py` — `ToolContext` (incl. `available_tools`, `tool_call_id`; `phase_whitelist` to ADD), `ToolResult`, `dispatch_tool` :1495, `_handle_task` subset gate :1091-1115, `_handle_ask_user` 5-step flow :1273-1458, `_TOOL_REGISTRY` :1465.
- `backend/app/services/task_service.py` — `run_task_sub_agent` :196-436, `_stream_one_iteration` :162-193, `acquire_global_task_slot` Redis-Lua :58-91, schema filter :304-308, `_build_sub_agent_system_prompt` :97-118.
- `backend/app/services/ask_user_service.py` — `subscribe_for_response`, `publish_response`, cancel/shutdown sentinels; `ask_user:{run_id}:{tool_call_id}` + `ask_user:channels:{run_id}`.
- `backend/app/services/openai_service.py:768-789` — `get_tools` (hardcoded ~24-tool list, no priority/max_tools), `get_explorer_tools`.
- `backend/app/config.py` — `ModelCapability` TypedDict :129 (no max_tools), `MODEL_CAPABILITIES` :179, `Settings` caps :833-836 (task_max_steps=10, task_per_run_concurrency=3, task_global_concurrency=20, ask_user_max_timeout_seconds=1800), `llm_call_timeout_seconds`/`DEFAULT_LLM_CALL_TIMEOUT_SECONDS=300`.
- `backend/app/api/threads.py` — `_emit` :139-153 (XADD run:{run_id}), `_emit_terminal` :156, `RUN_TASKS` :116, `agent_runner` :957, `run_agent_loop` call :1049, `_shielded_finalize` :1122.
- `supabase/migrations/056-060` — table shapes, status CHECKs, immutable-on-publish trigger, harness_audit event_type CHECK (9 kinds), INSERT-only RLS, `threads.active_workflow_run_id`, WITH CHECK hardening.
- `.planning/REQUIREMENTS.md` (HARNESS-01/03/04/05/07 + TOOL-05 verbatim), `091-CONTEXT.md` (10 decisions), `.planning/config.json` (nyquist_validation=true).

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` — the v2.8 harness design (cross-checked against the shipped files; its Pattern 1/2/6 + Build Order match reality).

### Tertiary (LOW confidence — flagged for validation)
- ask_user response-row shape distinguishing answered-vs-pending (A1/OQ2) — inferred from prompt-row shape + POST-persists-row-first; planner must trace `runs.py:/ask_user_response` + `panel.py /pending`.
- Resume claim-discipline (A2/OQ6) — recommended to ride existing RUN_TASKS spawn; confirm reachable from the harness entry.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; every primitive read directly; config knobs + get_tools + MODEL_CAPABILITIES verified.
- Architecture (5 types → substrate, whitelist guard, SSE on run stream): HIGH — grounded in the shipped files + migration column shapes.
- Resumability / 2-phase write / ask_user resume: MEDIUM-HIGH — column shapes + ask_user flow verified; the resume claim-discipline + answered-vs-pending detection have open questions (OQ2/OQ6) the planner must close against `runs.py` + the producer-spawn machinery.
- TOOL-05 budget + MODEL_CAPABILITIES: HIGH on the composition site + the fact that max_tools must be added; MEDIUM on the exact per-model ceilings (planner sizes per SEED-035).
- Pitfalls / security: HIGH — derived from the 075.x cascade history + the shipped RLS/CHECK constraints.

**Research date:** 2026-05-31
**Valid until:** ~2026-06-30 (stable substrate; the only fast-moving piece is the per-provider model list for UAT, which needs the EVAL-01 curation pass in Phase 096).

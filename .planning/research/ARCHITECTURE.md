# Architecture Research

**Domain:** State-machine workflow runtime ("harness") + dual Deep/Harness mode, layered onto an existing multi-provider Agentic-RAG platform (FastAPI + Supabase/Postgres + Redis Streams + React/Zustand)
**Researched:** 2026-05-30
**Confidence:** HIGH (every integration claim grounded in the real files named below; the few forward-looking pieces are flagged MEDIUM)

> **Scope note.** This answers "how does the harness state-machine integrate end-to-end with our EXISTING architecture." It validates/refines the v2.7 PRD §3 Theme B design against the *actually-shipped* substrate (which differs materially from what the PRD assumed — see the **PRD-vs-reality deltas** callouts). Plugin Contract (Theme E) is OUT OF SCOPE per D-v2.8-01. The 5 migration numbers/range in the PRD (125-139) are **stale fiction** — the real head is `055_todos_table.sql`, so v2.8 renumbers from **056**.

---

## Standard Architecture

### System Overview — where the harness sits

```
┌──────────────────────────────────────────────────────────────────────────┐
│  FRONTEND (React / Vite / Zustand)                                         │
│  ┌───────────────┐   ┌─────────────────────────────────────────────────┐  │
│  │  Chat surface │   │  WorkspacePanel (v2.7)                           │  │
│  │ (MessageList) │   │  Todos │ Files │ Tasks │ Asks │ ◀NEW▶ Phases     │  │
│  └──────┬────────┘   └───────────────────────┬─────────────────────────┘  │
│         │  reads bucketsBySurface            │  reads per-thread Maps      │
│         └──────────────┬─────────────────────┘  (PANEL-06 isolation)      │
│                  StreamsProvider  — ONE EventSource per run,               │
│                  demuxes SSE by event.type → chat bucket OR panel Map      │
│                  ◀NEW▶ workflow_phase_* handlers → phasesByThread Map      │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │ GET /runs/{run_id}/stream?since=N  (replay+tail)
┌──────────────────────────────┴───────────────────────────────────────────┐
│  BACKEND (FastAPI, WORKER_COUNT=2)                                         │
│                                                                            │
│   threads.py  POST /threads/{id}/messages ── spawns ──▶ agent_runner()     │
│      (3,186 LOC, G-5 FIRING)                              producer task    │
│                                                              │             │
│   ◀NEW EXTRACTION SEAM▶                                       │             │
│   app/services/agent_loop.py  ◀── run_agent_loop(ctx)  ◀──────┘            │
│      (the iteration loop + tool-dispatch block, lifted verbatim)           │
│                          │                                                 │
│         ┌────────────────┴───────────────┐                                 │
│   Deep Mode path                   ◀NEW▶ Harness Mode path                 │
│   (free chat, no gating)          app/services/harness_engine.py           │
│                                    run_workflow(workflow_run) drives        │
│                                    phases → calls into:                     │
│   ┌─────────────────────────────────────────────────────────────────┐     │
│   │ PHASE EXECUTORS (PHASE_TYPE_REGISTRY)                            │     │
│   │  programmatic    → PROGRAMMATIC_PHASE_REGISTRY[fn] (no LLM)      │     │
│   │  llm_single      → 1 drained LLM call (task_service helper)      │     │
│   │  llm_agent       → run_agent_loop() w/ phase whitelist          │     │
│   │  llm_batch_agents→ N× run_task_sub_agent() + merge              │     │
│   │  llm_human_input → ask_user_service pause/resume (verbatim)     │     │
│   └─────────────────────────────────────────────────────────────────┘     │
│                          │                                                 │
│   tool_dispatcher.dispatch_tool(name, args, ctx)  ◀── per-phase whitelist  │
│      reads ctx.available_tools  (precedent: _handle_task subset gate)      │
│      ◀NEW▶ refuses tool ∉ whitelist → "tool_not_available_in_phase"        │
│                          │                                                 │
│   _emit(redis, run_id, type, **fields) ── XADD ──▶ run:{run_id} Stream     │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
┌──────────────┬───────────────┴──────────────┬─────────────────────────────┐
│  Postgres    │  Redis                        │  Supabase Storage           │
│  runs        │  run:{run_id}  (XADD buffer)  │  workspace-files bucket     │
│  threads     │  runs_by_thread:{tid}         │                             │
│  ◀NEW▶       │  runs:active                  │                             │
│  workflow_*  │  ask_user:{rid}:{tcid}        │                             │
│  todos,ws_*  │  tasks:global:active          │                             │
└──────────────┴───────────────────────────────┴─────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status | Implementation |
|-----------|----------------|--------|----------------|
| `harness_engine.py` | Drive a `workflow_run` through ordered phases; own ALL phase transitions; persist phase state to Postgres before/after each phase; emit `workflow_*` SSE | **NEW** | Plain-Python state machine (no LangGraph). Reads `workflow_phases` rows, dispatches to `PHASE_TYPE_REGISTRY` |
| `agent_loop.py` | The iteration loop + per-iteration tool-dispatch block (lifted from `threads.py:1818-2779`) | **NEW (extracted)** | Called by both Deep Mode (today's path) AND harness `llm_agent` phase |
| `tool_dispatcher.py` | Route tool call → handler; **enforce per-phase whitelist** | **MODIFIED (1 add)** | Add a pre-check in `dispatch_tool()` reading `ctx.available_tools`; precedent: `_handle_task` already gates on it |
| `task_service.py` | Spawn child sub-agent (own run row + stream + concurrency caps) | **REUSED/generalized** | `run_task_sub_agent` IS a complete mini agent-loop — `llm_agent`/`llm_batch_agents` build on it |
| `ask_user_service.py` | Cross-worker pause/resume via Redis pub/sub | **REUSED verbatim** | `llm_human_input` phase calls the existing `_handle_ask_user` flow |
| `threads.py` | HTTP route + producer-task lifecycle (`_emit`, `_spawn`, `agent_runner` shell, shielded finalize) | **MODIFIED (slimmed)** | Keeps route + finalize; delegates the loop body to `agent_loop.py`; branches Deep vs Harness |
| `StreamsProvider.tsx` | Demux SSE by event type → chat bucket vs panel Maps | **MODIFIED (+1 Map)** | Add `workflow_phase_*` handlers → `phasesByThread` Map (mirrors the 7 Phase-086 panel handlers) |
| `WorkspacePanel` | Render todos/files/tasks/asks + **NEW phase timeline** | **MODIFIED (+1 section)** | New `<PhaseTimeline>` reads `usePhases(threadId)` |
| `panel.py` | GET reconcile endpoints for panel state | **MODIFIED (+routes)** | Add `GET /threads/{id}/workflow` (current run + phases) |
| Postgres `workflow_definitions/_runs/_phases` | Versioned templates + run instances + per-run phase state (resumable) | **NEW (3 tables)** | RLS via `threads.user_id` FK chain (proven pattern, migration 054/055) |

---

## Recommended Project Structure

```
backend/app/
├── api/
│   ├── threads.py          # MODIFIED: route + finalize stay; loop body extracted; Deep|Harness branch
│   ├── runs.py             # MODIFIED: + POST /runs/{id}/ask_user_response already exists (reuse for human_input)
│   ├── panel.py            # MODIFIED: + GET /threads/{id}/workflow ; + POST .../workflow/cancel
│   └── workflows.py        # NEW: CRUD for workflow_definitions (publish=immutable), POST start a run
├── services/
│   ├── agent_loop.py       # NEW (G-5 EXTRACTION): run_agent_loop(loop_ctx) — the lifted iteration loop
│   ├── harness_engine.py   # NEW: run_workflow() state machine + transition + validator dispatch + audit emit
│   ├── harness/            # NEW package
│   │   ├── phase_types.py      # PHASE_TYPE_REGISTRY: 5 executors
│   │   ├── programmatic.py     # PROGRAMMATIC_PHASE_REGISTRY (typed pure-Python phase fns)
│   │   ├── validators.py       # VALIDATOR_REGISTRY: json_schema / regex / file_exists / programmatic
│   │   └── models.py           # Pydantic: PhaseConfig, ValidatorSpec, WorkflowDefinition (config validation)
│   ├── tool_dispatcher.py  # MODIFIED: + whitelist pre-check in dispatch_tool()
│   ├── task_service.py     # REUSED: run_task_sub_agent generalizes llm_agent/llm_batch_agents
│   └── ask_user_service.py # REUSED VERBATIM: llm_human_input
├── db/
│   └── workflows.py        # NEW: typed asyncpg helpers (insert_workflow_run, advance_phase, ...) — mirrors db/runs.py
└── models/
    └── workflow.py         # NEW: API request/response Pydantic models

frontend/src/
├── providers/StreamsProvider.tsx   # MODIFIED: + workflow_phase_* handlers → phasesByThread Map
├── stores/streamsStore.ts          # MODIFIED: + phasesByThread Map + actions
├── components/panel/
│   ├── WorkspacePanel.tsx          # MODIFIED: + <PhaseTimeline> section (auto-open on Harness)
│   └── PhaseTimeline.tsx           # NEW: locked/current/done glyphs + gate badges + ARIA landmarks
├── hooks/usePhases.ts              # NEW: reads phasesByThread, reconciles via GET /workflow
└── lib/api.ts                      # MODIFIED: + workflow_* arms in subscribeToRun SSE parser
```

### Structure Rationale

- **`agent_loop.py` extracted FIRST (G-5).** `threads.py` is 3,186 LOC and on the hot-file ledger (9+ phases). The harness must NOT bolt onto it. Extracting the loop body gives both Deep Mode and the `llm_agent` phase ONE shared loop — no fork, no drift.
- **`harness/` is a package, not one file.** The 5 phase types + 4 validators + Pydantic config models are distinct concerns. `harness_engine.py` owns transitions only; phase *execution* lives in `harness/phase_types.py`.
- **`db/workflows.py` mirrors the shipped `db/runs.py`** (typed asyncpg helpers owning SQL strings) — keeps blocking-I/O discipline (D-v2.5-01) and asyncpg-pool hot paths (D-073).

---

## Architectural Patterns

### Pattern 1: Per-phase tool whitelist enforcement (the state-machine lock)

**What:** The dispatcher refuses any tool call not in the active phase's `available_tools`. This is the headline "LLM cannot skip/reorder/escape phases" guarantee.

**Evidence — the precedent already ships.** `tool_dispatcher.ToolContext.available_tools` exists (line 88) and `_handle_task` already enforces a per-subset refusal (lines 1091-1110): `invalid = [t for t in requested_tools if t not in available ...]`. The harness generalizes this from sub-agent-toolset to per-phase-toolset.

**Minimal, shared-path-safe wiring (the critical cross-provider question):**

```python
# tool_dispatcher.py — add ONE guard at the top of dispatch_tool(). Additive;
# zero behavioral change when phase_whitelist is None (Deep Mode).
async def dispatch_tool(tool_name: str, args: dict, ctx: ToolContext) -> ToolResult:
    if ctx.phase_whitelist is not None and tool_name not in ctx.phase_whitelist:
        return ToolResult(result=json.dumps({
            "error": "tool_not_available_in_phase",
            "tool": tool_name,
            "allowed": sorted(ctx.phase_whitelist),
        }))
    handler = _TOOL_REGISTRY.get(tool_name)
    if handler is None:
        return ToolResult(result=f"Unknown tool: {tool_name}")
    return await handler(args, ctx)
```

Add `phase_whitelist: frozenset[str] | None = None` as a NEW optional field on `ToolContext`. In Deep Mode it stays `None` → the guard is a no-op → **the shared path is byte-equivalent for all 9 providers.** The refusal rides the existing `tool_result` message append (`threads.py:2700-2708`) — the LLM sees it as a normal tool result, exactly like `_handle_task`'s refusal strings already do. No new SSE event type required, no provider branch.

> **Why this is cross-provider-safe (075.x lesson):** the guard lives at the *single* dispatch entry, BELOW the provider-specific streaming/parsing code. It never touches `threads.py`'s chunk handlers, the SSE emitter, or any `anthropic_service`/`openai_service` path — the exact shared-path edits that caused the 075.3 cascade. The refusal is a string in a tool_result, the most provider-agnostic surface that exists.

**When the whitelist gets set:** `agent_loop.py` builds `ToolContext` once per iteration (today at `threads.py:2632`). In a harness `llm_agent` phase the loop is invoked with `phase_whitelist=frozenset(phase.available_tools)`. The two ALSO interact with `get_tools()` composition — see Pattern 6.

**Trade-offs:** A per-phase whitelist read could add Postgres latency per tool call. Mitigation: the whitelist is passed *into* the loop as a frozenset (resolved once when the phase starts), NOT re-queried per tool call. The PRD §6 row-1 "in-memory cache per run_id" concern is over-engineered — the phase's `available_tools` is a fixed list for the phase's lifetime; pass it by value.

### Pattern 2: Phase types map onto existing primitives (no new orchestration framework)

**What:** All 5 phase types are thin wrappers over already-shipped code. This is the single most important finding — the harness is ~80% composition, ~20% new state machine.

| Phase type | Maps onto | Evidence |
|---|---|---|
| `programmatic` | `PROGRAMMATIC_PHASE_REGISTRY[name](input, ctx) -> output` | NEW dict, mirrors `_TOOL_REGISTRY` shape (tool_dispatcher.py:1465). Pure Python, no LLM. |
| `llm_single` | One drained LLM call | `task_service._stream_one_iteration` (lines 162-193) already does exactly this — `create_adaptive_streaming_chat` + drain in threadpool. Extract/reuse. |
| `llm_agent` | `run_agent_loop(ctx, phase_whitelist=...)` | The extracted loop (Pattern 1). OR, for an isolated sub-context, `run_task_sub_agent` (task_service.py:196) which is ALREADY a complete max_steps-bounded agent loop with its own run row + stream. |
| `llm_batch_agents` | N× `run_task_sub_agent` + deterministic merge | `task_service.run_task_sub_agent` (line 196) spawns a child with own `run:{sub_run_id}` stream + per-run `Semaphore(3)` + global Redis-Lua cap (20). Fan out N, `asyncio.gather`, merge by `phase_config.merge_strategy`. |
| `llm_human_input` | `ask_user_service` pause/resume | `_handle_ask_user` (tool_dispatcher.py:1273) + `subscribe_for_response` + `POST /runs/{id}/ask_user_response` (runs.py:496) ALL exist. The phase emits the prompt and blocks on the SAME pub/sub channel. |

> **PRD-vs-reality delta (major, favorable):** The PRD §3 says `llm_agent` "Mirrors `agent_runner` (threads.py:1059)". Reality is *better* — `task_service.run_task_sub_agent` is a self-contained, cross-provider-safe agent loop with its OWN run row, stream, model resolution, and tool dispatch (it already calls `dispatch_tool` with a constrained `available_tools`). `llm_agent` and `llm_batch_agents` should be built on **`run_task_sub_agent`**, not on the buried `agent_runner`. This means the harness can produce per-phase agent loops *today* by passing `allowed_tools=phase.available_tools` and `max_steps=phase.max_steps`. The whitelist enforcement is already wired into that path (sub_ctx.available_tools + `_SUB_AGENT_EXCLUDED`).

**When to use which loop for `llm_agent`:** Use `run_task_sub_agent` when the phase is a bounded unit (most cases) — it gives isolation + concurrency accounting for free. Use the extracted `run_agent_loop` only when the phase needs the FULL chat history + all the streaming-reliability machinery (transient-reattach, snapshot, etc.) that the top-level loop has and the sub-agent loop intentionally omits.

**`programmatic` example:**
```python
# harness/programmatic.py
PROGRAMMATIC_PHASE_REGISTRY: dict[str, Callable[[dict, "PhaseRunCtx"], Awaitable[dict]]] = {}

def register_programmatic(name: str):
    def deco(fn): PROGRAMMATIC_PHASE_REGISTRY[name] = fn; return fn
    return deco

@register_programmatic("schema_validate")
async def _schema_validate(input: dict, ctx) -> dict:
    # pure Python — e.g. jsonschema.validate(input["payload"], input["schema"])
    return {"valid": True, ...}
```

### Pattern 3: Resumable phase state via Postgres (survives uvicorn restart)

**What:** Every phase transition writes to `workflow_phases` (Postgres) BEFORE the next phase starts. A worker restart re-reads the row and resumes. This is the D-PRD-08 multi-worker requirement.

**When:** `harness_engine.run_workflow` loops: read current phase row → execute → validate gate → UPSERT phase status + output → advance `workflow_runs.current_phase_id` → emit `workflow_transition`. The write precedes the SSE emit (PRD §6 row-2 ordering; consumers tolerate lag via D-v2.5-03 reconcile).

**Trade-offs:** Phase output stored as `jsonb`. Large outputs (e.g. a generated report) go to `workspace_files` (the bucket) and the phase stores only the path — mirrors the workspace hybrid-storage decision. Don't bloat `workflow_phases.output` with multi-KB blobs.

**Resumption invariant:** On producer (re)spawn for a thread with `threads.active_workflow_run_id IS NOT NULL`, `harness_engine` reads the run + phases and resumes at `status IN ('pending','active')`. A phase that was `active` mid-LLM-call is re-run from the top (LLM calls aren't checkpointed mid-stream — D-v2.5-05 "no auto-retry of paid calls" applies, so re-running a partially-completed `llm_agent` phase needs an idempotency guard or operator confirm; flag as PITFALL).

### Pattern 4: New SSE event types ride the EXISTING run stream (zero new substrate)

**What:** All `workflow_phase_*` / `workflow_transition` / `workflow_run_complete` events go through the same `_emit(redis, run_id, type, **fields)` → XADD → `run:{run_id}` path (`threads.py:109`). The panel consumes via the same `GET /runs/{id}/stream?since=N`.

**Evidence:** This is exactly how Phase 086/087 added `todo_updated`, `workspace_file_written/deleted`, `ask_user_prompt/response`, `sub_agent_start/done`. The wire vocabulary is shared across all providers (one UX, N adapters — `feedback_provider_uniform_ux`).

**Frontend demux (mirrors the 7 Phase-086 handlers at StreamsProvider.tsx:674-702):**
```ts
// StreamsProvider.tsx makeStreamCallbacks — ADD alongside onTodoUpdated etc.
onWorkflowPhaseStart: (phase) =>
  useStreamsStore.getState().actions.upsertPhaseForThread(threadId, phase),
onWorkflowTransition: (from, to) =>
  useStreamsStore.getState().actions.advancePhaseForThread(threadId, from, to),
onWorkflowRunComplete: (status, artifactPath) =>
  useStreamsStore.getState().actions.completeWorkflowForThread(threadId, status, artifactPath),
```
These write to a NEW `phasesByThread: Map<threadId, PhaseTimeline>` — **never** to `bucketsBySurface`, preserving PANEL-06 (panel events trigger zero chat re-renders, verified pattern). Add `EMPTY_PHASES` module constant for stable empty-reference (StreamsProvider.tsx:101-104 precedent).

**Reconcile-on-mount:** `usePhases(threadId)` fetches `GET /threads/{id}/workflow` on mount (D-v2.5-03 — Realtime/SSE is a hint, fetch is truth), exactly as `useTodos`/`useWorkspaceFiles` reconcile via `panel.py` GET endpoints.

### Pattern 5: Dual-mode wiring (where mode lives, how the lock works)

**What:** Mode is a per-thread property, not per-message. Deep Mode (default) = today's free chat. Harness Mode = a `workflow_run` is active and locks the thread.

**Where mode lives:** `threads.active_workflow_run_id uuid NULL` (NEW column, migration in v2.8). `NULL` = Deep Mode; non-null = Harness Mode. This is the single source of truth the agent_runner branch reads.

**Mode dispatch (in `agent_runner` after history load, ~threads.py:1519):**
```python
if thread_row["active_workflow_run_id"]:        # Harness Mode
    await harness_engine.resume_or_run(workflow_run_id, loop_ctx)
    return
# else fall through to today's Deep Mode loop (unchanged)
```

**Workflow-lock enforcement:** `POST /threads/{id}/workflow/cancel` is the ONLY way to clear `active_workflow_run_id` while a run is `active`/`paused`. Deep→Harness is allowed (spawns a `workflow_run` row, sets the column); Harness→Deep is refused at the API layer until the run reaches a terminal status OR is explicitly cancelled (PRD Theme F / Q-v2.7-05 "allowed with lock").

> **PRD-vs-reality delta:** PRD Theme F proposes `threads.deep_mode_metadata jsonb`. **Drop it for v2.8** — it has no consumer in the locked scope (it was a v3.0 Skill-Studio convenience). The single `active_workflow_run_id` column is sufficient for the dual-mode lock. Adding unused columns violates the lean gate.

### Pattern 6: `get_tools()` composition with the per-phase whitelist

**What:** `get_tools(user_settings)` (openai_service.py:768) returns the full tool SCHEMA list (the JSON the LLM sees). The per-phase whitelist filters this.

**Two distinct surfaces — keep them separate:**
1. **Tool schemas** (what the LLM is *told* exists) — filter `get_tools()` output by the phase whitelist before passing as `tools_override` to `create_adaptive_streaming_chat`. Precedent: `task_service.py:304-308` already does `sub_tool_schemas = [t for t in get_tools(...) if t["function"]["name"] in allowed_tools]`.
2. **Tool dispatch** (what the dispatcher *executes*) — `ctx.phase_whitelist` guard (Pattern 1). Belt-and-suspenders: even if a model hallucinates a tool not in its schema list, the dispatcher refuses it.

```python
# In an llm_agent phase:
phase_tools = [t for t in get_tools(user_settings)
               if t["function"]["name"] in phase.available_tools]   # surface 1
loop_ctx.phase_whitelist = frozenset(phase.available_tools)          # surface 2
```

> **SEED-035 folds in here:** the tool-count budget guard wraps `get_tools()` at this same composition site (cap the number of schemas advertised). Natural home — the whitelist already filters here.

**Trade-offs:** This is the ONE place the harness touches `openai_service`. The change is *additive* (filter an existing list) — no provider branch, no shared-path mutation.

---

## Data Flow

### Harness run lifecycle

```
User toggles Harness Mode (or invokes harness-required skill)
    ↓
POST /threads/{id}/workflow {definition_id}   (api/workflows.py)
    ↓ INSERT workflow_runs (status=active) + N workflow_phases (status=pending)
    ↓ SET threads.active_workflow_run_id = run.id
POST /threads/{id}/messages  → agent_runner producer spawns
    ↓ reads active_workflow_run_id → branches to harness_engine.run_workflow()
    ↓
┌── for each phase (ordered by phase_index) ──────────────────────────┐
│  UPSERT phase.status = active ; emit workflow_phase_start            │
│  dispatch by phase_type → PHASE_TYPE_REGISTRY[type](phase, ctx)      │
│     programmatic   → pure Python                                     │
│     llm_single     → 1 drained call                                  │
│     llm_agent      → run_task_sub_agent(allowed=whitelist, max_steps)│
│     llm_batch_agents → gather(N× run_task_sub_agent) → merge         │
│     llm_human_input→ emit ask_user_prompt ; block on pub/sub         │
│  VALIDATOR_REGISTRY gate → pass? advance : on_failure handler        │
│  UPSERT phase.status = completed ; output=jsonb ; emit phase_end     │
│  advance workflow_runs.current_phase_id ; emit workflow_transition   │
└─────────────────────────────────────────────────────────────────────┘
    ↓ all phases done
UPDATE workflow_runs.status=completed ; CLEAR threads.active_workflow_run_id
emit workflow_run_complete{status, final_artifact_path}
    ↓ (shielded finalize — threads.py:158-255 block, reused)
```

### RLS data flow (how the new tables RLS against threads)

```
workflow_runs.thread_id  ──FK──▶ threads.id ──user_id──▶ auth.uid()
   RLS:  USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id))
   ↑ EXACT pattern shipped in 054_workspace_files.sql:41 + 055_todos_table.sql:25

workflow_phases.workflow_run_id ──FK──▶ workflow_runs.id ──FK──▶ threads
   RLS:  USING (auth.uid() = (SELECT t.user_id FROM threads t
                              JOIN workflow_runs wr ON wr.thread_id = t.id
                              WHERE wr.id = workflow_run_id))
   ↑ EXACT 2-hop JOIN pattern from 054:58-66 (workspace_file_versions)

workflow_definitions  ── NO thread FK (templates are reusable) ──▶
   RLS:  USING (auth.uid() = created_by OR org_id IS NULL-shared)
   ↑ owner-private + future org-shared; mirrors skills table ownership
```

> **Concrete RLS recommendation:** `workflow_runs` and `workflow_phases` RLS against `threads.user_id` via the FK chain — the **proven** pattern (zero new RLS thinking required). `workflow_definitions` is the only table NOT thread-scoped (it's a template); use the skills-style owner/global ownership. All tables carry `org_id uuid NULL` from day 1 (D-PRD-02 forward-compat) but RLS predicates stay user-scoped for v2.8.

### State management (frontend)

```
run:{run_id} SSE ──▶ StreamsProvider demux (by event.type)
   chat events     → bucketsBySurface Map  → MessageList re-renders
   workflow events → phasesByThread Map    → PhaseTimeline re-renders ONLY
                     (PANEL-06: chat selectors never read phasesByThread)
GET /threads/{id}/workflow ──▶ usePhases reconcile-on-mount (truth source)
```

---

## Build Order (dependency-ordered — the deliverable)

> Respects the quality gate: extraction → engine → phase types → mode → panel. Each step ships independently behind the `active_workflow_run_id IS NULL` no-op (Deep Mode stays byte-identical throughout).

**Phase A — G-5 Extraction (BLOCKING, ships first, zero feature).**
Extract `agent_runner`'s loop body (`threads.py:1818-2779`) into `app/services/agent_loop.py::run_agent_loop(loop_ctx)`. `threads.py` keeps the route, producer spawn, `_emit`/`_spawn`, shielded finalize. **Acceptance bar: Deep Mode is byte-identical** — full cross-provider UAT (the 4-axis scoreboard) BEFORE any harness code lands. This satisfies G-5 (the harness sits in a clean module, not bolted onto 3,186 LOC). *No dependency.*

**Phase B — Schema + RLS.**
Migrations `056_workflow_definitions.sql`, `057_workflow_runs.sql`, `058_workflow_phases.sql`, `059_threads_active_workflow_run_id.sql`. RLS via the 054/055 FK-chain pattern. Pydantic config models (`harness/models.py`) + jsonschema (4.26.0, installed) validator for phase configs. Immutable-on-publish trigger on `workflow_definitions` (mirrors skill-version immutable trigger). *Depends on: nothing (parallel with A).*

**Phase C — Harness engine + 5 phase types + validators.**
`harness_engine.py` (transition loop, resumable, audit emit) + `harness/phase_types.py` (5 executors wiring to `run_task_sub_agent`/`ask_user_service`/`PROGRAMMATIC_PHASE_REGISTRY`) + `harness/validators.py` (4 kinds). New `workflow_*` SSE events through `_emit`. *Depends on: A (uses `run_agent_loop`/sub-agent loop), B (tables).*

**Phase D — Whitelist enforcement.**
Add `phase_whitelist` to `ToolContext` + the one guard in `dispatch_tool()` + the `get_tools()` filter at the composition site (folds SEED-035). *Depends on: C (engine sets the whitelist per phase). Can land inside C.*

**Phase E — Dual-mode wiring.**
`agent_runner` branch on `active_workflow_run_id`; `api/workflows.py` (start run, CRUD); `POST /threads/{id}/workflow/cancel` lock enforcement; folds SEED-029 (Continue button = the per-phase `max_steps` resume affordance). *Depends on: C, D.*

**Phase F — Panel phase-timeline + StreamsProvider extension.**
`phasesByThread` Map + actions in `streamsStore`; `workflow_phase_*` handlers in `makeStreamCallbacks`; `subscribeToRun` parser arms in `lib/api.ts`; `<PhaseTimeline>` section in `WorkspacePanel` (ARIA landmarks per Theme H); `GET /threads/{id}/workflow` reconcile endpoint; `usePhases` hook. *Depends on: C/E (events to render).*

**Phase G — Eval-harness regression gate + verification.**
Fold SEED-034 (`scripts/eval_cross_provider.py`) as the CI regression gate; cross-provider × multi-tool × parallel-thread × long-message scoreboard (CLAUDE.md SC#10) on the harness surface; uvicorn-restart-mid-workflow resumability UAT; SEED-036a (`task()` global fair-share for `llm_batch_agents`). *Depends on: all.*

**Critical path:** A → C → E → F. B parallels A. D folds into C. G is the verify wave.

---

## Anti-Patterns

### Anti-Pattern 1: Editing the shared streaming/parsing path to add phase logic
**What people do:** Add phase-whitelist checks or workflow branching inside `threads.py`'s chunk handlers (`_on_chunk_openai`), the SSE emitter, or `anthropic_service`.
**Why it's wrong:** This is *exactly* the 075.3 cross-provider cascade (`feedback_no_cross_provider_regressions`). Every shared-path edit risks breaking a working provider.
**Do this instead:** All harness logic lives ABOVE the loop (`harness_engine`) or at the SINGLE dispatch entry (`dispatch_tool` guard) — both provider-agnostic. The whitelist refusal is a tool_result string, the most neutral surface.

### Anti-Pattern 2: Building the harness on `agent_runner` directly (skipping extraction)
**What people do:** Call into the 3,186-LOC `threads.py` loop from the engine, or copy-paste the loop.
**Why it's wrong:** G-5 violation; two divergent loops; the next streaming bug must be fixed twice.
**Do this instead:** Extract once (Phase A); the `llm_agent` phase reuses `run_task_sub_agent` (already a clean loop) or the extracted `run_agent_loop`.

### Anti-Pattern 3: New Redis namespace / new SSE substrate for workflow events
**What people do:** A `workflow:{id}` stream parallel to `run:{run_id}`.
**Why it's wrong:** Breaks the single-EventSource-per-run discipline; the panel would need a second subscription; replay/reconcile machinery duplicated.
**Do this instead:** `workflow_*` events XADD to `run:{run_id}` via `_emit`. Panel demuxes by type (Phase 086 pattern). Zero new substrate (D-v2.5-08).

### Anti-Pattern 4: Querying the whitelist per tool call
**What people do:** `SELECT available_tools FROM workflow_phases WHERE ...` inside `dispatch_tool`.
**Why it's wrong:** Postgres roundtrip per tool call; the PRD §6 even proposed an in-memory cache to "fix" this.
**Do this instead:** Resolve `available_tools` ONCE when the phase starts; pass the frozenset by value into the loop's `ToolContext`. No per-call query, no cache.

### Anti-Pattern 5: Mid-LLM-call checkpointing for resumability
**What people do:** Try to resume a paid LLM call from the exact token where uvicorn died.
**Why it's wrong:** Impossible (provider state is gone) and violates D-v2.5-05 (no auto-retry of paid calls).
**Do this instead:** Checkpoint at PHASE boundaries only. A phase that was `active` mid-call re-runs from the top with an idempotency guard (or operator confirm for expensive phases). Document the cost.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100s users | Monolith fine. `workflow_phases` rows are tiny (100s users × 5 runs × 10 phases ≈ 5k rows). Index on `(workflow_run_id, phase_index)`. |
| 100s-1k users | `llm_batch_agents` fan-out is the pressure point: N sub-agents × M parallel runs can exceed the AnyIO ceiling (~200) + global task cap (20, Redis-Lua). **SEED-036a fair-share folds in here.** Per-phase `max_parallel_agents` config (default 5). |
| 1k+ users | Multi-worker (WORKER_COUNT=2 default, D-PRD-12) already handles producer distribution. Workflow resumability is cross-worker-safe (Postgres phase state). HNSW index migration (deferred) for RAG, orthogonal to harness. |

### Scaling Priorities
1. **First bottleneck:** `llm_batch_agents` concurrency — bounded by `max_parallel_agents` + the existing global `tasks:global:active` Redis-Lua cap (task_service.py:58). Already enforced.
2. **Second bottleneck:** `workflow_phases.output jsonb` bloat if large outputs stored inline. Mitigation: spill to `workspace-files` bucket, store path only.

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `harness_engine` ↔ `agent_loop` | Direct call `run_agent_loop(ctx, phase_whitelist=...)` | The extracted loop is the shared substrate for Deep + `llm_agent`. |
| `harness_engine` ↔ `task_service` | Direct call `run_task_sub_agent(allowed_tools=..., max_steps=...)` | `llm_agent`/`llm_batch_agents`; concurrency caps inherited for free. |
| `harness_engine` ↔ `ask_user_service` | Redis pub/sub `ask_user:{run_id}:{tcid}` | `llm_human_input` reuses the verbatim flow + existing `POST /runs/{id}/ask_user_response`. |
| `harness_engine` ↔ `tool_dispatcher` | `ToolContext.phase_whitelist` field | The ONLY dispatcher change: 1 additive guard. |
| `harness_engine` ↔ `_emit`/Redis | XADD to `run:{run_id}` | Same stream as all SSE; zero new substrate. |
| `agent_runner` ↔ `harness_engine` | Branch on `threads.active_workflow_run_id` | Single source of mode truth. |
| StreamsProvider ↔ panel | `phasesByThread` Map (NEW) | PANEL-06 isolation preserved; chat never reads it. |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| 9 LLM providers | Via `create_adaptive_streaming_chat` (unchanged) | Harness adds NO provider code; phases call the existing adaptive-chat entry. Cross-provider parity is preserved because the harness never touches the streaming/parsing path. |
| Supabase Storage | `workspace-files` bucket (existing) | Large phase outputs spill here; signed-URL pattern from sandbox-outputs/workspace. |
| Redis | `run:{run_id}` (events), `ask_user:*` (human_input), `tasks:global:active` (batch caps) | All existing key conventions; no new namespace. |

---

## Key Findings Summary (for the synthesizer)

1. **The harness is ~80% composition.** All 5 phase types wrap already-shipped, cross-provider-tested code: `run_task_sub_agent` (a complete mini agent-loop with own run/stream/concurrency caps) for `llm_agent`+`llm_batch_agents`, `ask_user_service` verbatim for `llm_human_input`, a new `PROGRAMMATIC_PHASE_REGISTRY` dict (mirrors `_TOOL_REGISTRY`) for `programmatic`, and `task_service._stream_one_iteration` for `llm_single`. The genuinely-new code is the state machine (`harness_engine.py`) + Pydantic phase config + 4 validators.

2. **Per-phase whitelist enforcement is a 1-line additive guard at `dispatch_tool()`** reading a new `ToolContext.phase_whitelist` frozenset — the precedent (`_handle_task`'s subset gate, lines 1091-1110) already ships. In Deep Mode the field is `None` → no-op → shared path byte-identical for all 9 providers → **zero cross-provider regression risk** (the guard lives below the streaming/parsing code, the surface that caused the 075.x cascade).

3. **G-5 extraction MUST ship first.** `agent_runner` is buried in `threads.py:1818-2779` (3,186-LOC, hot-file ledger, 9+ phases). Extract the loop body to `app/services/agent_loop.py::run_agent_loop()` BEFORE harness code, with full cross-provider UAT proving Deep Mode is byte-identical. Both Deep Mode and `llm_agent` then share ONE loop.

4. **New tables RLS via the proven `threads.user_id` FK chain.** `workflow_runs`/`workflow_phases` use the EXACT pattern shipped in `054_workspace_files.sql:41` + `055_todos_table.sql:25` (1-hop) and `054:58-66` (2-hop JOIN). `workflow_definitions` is the only non-thread-scoped table (owner/global like skills). Migration head is **055** → renumber **056-059** (PRD's 125-139 is stale fiction).

5. **All workflow SSE rides the existing `run:{run_id}` stream; the panel demuxes into a new `phasesByThread` Map** exactly as Phase 086 added the 7 todo/file/ask/task handlers (StreamsProvider.tsx:674-702). PANEL-06 isolation (panel events → zero chat re-renders) is preserved by writing to a dedicated Map, never `bucketsBySurface`. Zero new Redis namespace, zero new substrate (D-v2.5-08).

6. **Mode lives in `threads.active_workflow_run_id` (1 new column).** NULL=Deep, non-null=Harness + locked. `agent_runner` branches on it. The lock is enforced at `POST /threads/{id}/workflow/cancel` (only exit while active). **Drop the PRD's `deep_mode_metadata jsonb`** — no consumer in v2.8 scope.

7. **`get_tools()` composition is the ONE `openai_service` touch** — filter the existing schema list by the phase whitelist before `tools_override` (precedent: `task_service.py:304-308`). Additive, no provider branch. SEED-035 tool-count budget folds in at this same site.

8. **Build order:** A (extract loop) → B (schema/RLS, parallel) → C (engine + 5 types + validators) → D (whitelist guard, folds into C) → E (dual-mode + SEED-029) → F (panel timeline + StreamsProvider) → G (eval gate + SEED-034/036a + resumability UAT). Deep Mode stays a byte-identical no-op behind `active_workflow_run_id IS NULL` at every step.

## Sources

- **Real substrate files (HIGH — read directly):** `backend/app/services/tool_dispatcher.py` (ToolContext.available_tools:88, `_handle_task` subset gate:1091-1110, `dispatch_tool`:1495, registry:1465), `backend/app/services/task_service.py` (`run_task_sub_agent`:196 — the complete sub-agent loop; global cap Lua:58; `_stream_one_iteration`:162), `backend/app/services/ask_user_service.py` (pub/sub pause/resume), `backend/app/api/threads.py` (`agent_runner`:1423, ToolContext build:2632, dispatch call:2677, `_emit`:109, finalize:158), `backend/app/services/openai_service.py` (`get_tools`:768, `create_adaptive_streaming_chat`:1124), `frontend/src/providers/StreamsProvider.tsx` (Phase-086 panel handlers:674-702, per-thread Map demux), `supabase/migrations/054_workspace_files.sql` + `055_todos_table.sql` (RLS FK-chain pattern), `backend/app/api/panel.py` (reconcile endpoints), `backend/app/api/runs.py` (`/ask_user_response`:496, `replay_tail_consumer`).
- **Design source (validated/refined):** `.planning/PRDs/v2.7.md` §3 Theme B + §5 (harness design — sound on tables/phase-config/SSE; corrected on migration numbers, `llm_agent` substrate, and `deep_mode_metadata`).
- **Decisions:** `.planning/PROJECT.md` Key Decisions (D-v2.5-08 run-backed streaming, D-085 task/ask_user caps, PANEL-06, D-v2.8-01 scope, D-PRD-08 multi-worker).
- **Library versions (HIGH — verified in venv):** pydantic 2.12.5, jsonschema 4.26.0, fastapi 0.115.6, redis>=5.2, asyncpg>=0.29, anthropic>=0.97.0, openai>=2.0.0.
- **Memory:** `feedback_no_cross_provider_regressions`, `feedback_provider_uniform_ux`, `feedback_workflow_guardrails` (G-5), `feedback_regressions_during_075_3_uat`.

---
*Architecture research for: harness state-machine integration with the Agentic-RAG platform*
*Researched: 2026-05-30*

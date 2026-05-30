# Research Summary: v2.8 Harness Engine and Workflow Mode

**Project:** Agentic RAG v2.8 Harness Engine and Workflow Mode
**Domain:** Deterministic durable resumable LLM workflow state-machine runtime plus dual Deep/Harness mode
**Researched:** 2026-05-30
**Confidence:** HIGH

---

## Executive Summary

v2.8 builds a deterministic, dispatcher-enforced workflow harness on top of an already-mature multi-provider streaming agent platform. The central insight from all four research streams is the same: the hard problems of a workflow runtime (cross-worker durability, pause/resume, fair-share concurrency, per-phase tool enforcement) are already solved in this codebase. The `runs`/Redis Streams handle durability, `ask_user_service` handles pause/resume, `task_service` Lua-atomic caps handle concurrency, and `tool_dispatcher`'s `_handle_task` subset-refusal handles enforcement. The harness is approximately 80 percent composition of existing code and 20 percent new state machine. Net new third-party dependencies required: zero.

The recommended approach is a hand-rolled Postgres-persisted state machine (`harness_engine.py`) with five phase types (`programmatic`, `llm_single`, `llm_agent`, `llm_batch_agents`, `llm_human_input`) over the existing `task_service`/`ask_user_service` substrate. All new SSE events ride the existing `run:{run_id}` stream. The panel gains a `phasesByThread` Map following the same pattern as v2.7's `todosByThread`/`filesByThread`. Deep Mode stays the unchanged default. The whitelist pre-check in `dispatch_tool` is a no-op when `active_workflow_run_id IS NULL`. There is no regression surface when Harness Mode is off.

The load-bearing risk is the G-5 `threads.py` extraction. That file is 3,186 LOC and carries 9+ phases of battle-won per-provider fixes (Anthropic `end_turn`, Google `thought_signature`, DeepSeek `reasoning_content`, empty-retry guard, `force_no_tools`-on-last-iteration). It must be extracted into a clean `agent_loop.py` module BEFORE any harness code lands. A careless extraction that cleans up in-flight logic re-opens the entire 075.x cross-provider cascade. The extraction phase ships first, is behavior-preserving-only, and is gated by the full 4-axis UAT scoreboard before any harness feature merges.

---

## Key Findings

### Recommended Stack (from STACK.md)

No new runtime libraries are required. The harness is new application code over already-installed infrastructure. The only permitted addition is an explicit version pin: add `jsonschema>=4.26,<5` to `requirements.txt` (transitively present at 4.26.0).

**Core technologies (all already installed, verify do not add):**
- **pydantic 2.12.5** -- typed `PhaseConfig`/`ValidatorSpec`/`WorkflowDefinition` models with discriminated union over 5 phase types; `model_validate(jsonb)` parses the `workflow_definitions.phases` column at run time
- **asyncpg >= 0.29** -- persist/read `workflow_runs`/`workflow_phases` rows on the hot path; cross-worker, cross-restart durable state; already the project hot-path pool since WORKER-LIFT-02
- **redis-py >= 5.2** -- phase-lifecycle SSE events via `XADD run:{run_id}` (existing stream); `llm_human_input` pause/resume via existing pub/sub (`ask_user:*`); `llm_batch_agents` global fair-share via existing Lua-atomic counter (`tasks:global:active`)
- **jsonschema 4.26.0** -- `json_schema` validator kind; `Draft202012Validator(schema).iter_errors(instance)` gives multi-error structured feedback for LLM self-correction on gate failure
- **stdlib `re`** -- `regex_match` validator kind; compile once per spec
- **Postgres `BEFORE UPDATE` trigger (raw SQL)** -- immutable-on-publish enforcement for `workflow_definitions`; survives application bugs and direct SQL edits; follows the `017_skills.sql` trigger pattern already in the repo

**What NOT to add (critical):**

| Avoid | Why |
|-------|-----|
| LangGraph / LangChain | CLAUDE.md hard rule; metastasizes into the agent loop the harness must own |
| `python-statemachine` / `transitions` | In-memory source of truth conflicts with cross-worker/resumable requirement; irrelevant headline features |
| Temporal / restate / DBOS / `durabletask` | Adds always-on orchestration server; duplicates the `runs`/Redis substrate already in production |
| Celery + broker | Distributed background job dispatch is not the problem; the existing producer-task model + Redis already coordinates |
| `fastjsonschema` | New dep for near-zero gain; validators run a handful of times per run, not in a hot loop; `iter_errors` clarity wins |
| Per-call Postgres whitelist reads | Adds latency to every tool dispatch; resolve `available_tools` ONCE when a phase starts and pass as a frozenset |

### Expected Features (from FEATURES.md)

**Must have (table stakes):**
- Ordered, locked phases -- the backend drives transitions; the LLM cannot reorder or skip
- All 5 phase types end-to-end (`programmatic`, `llm_single`, `llm_agent`, `llm_batch_agents`, `llm_human_input`)
- Per-phase tool-whitelist enforcement via `dispatch_tool` pre-check -- this is what makes locked mechanically true, not just prompt-level
- Validation gates between phases (`json_schema`, `regex_match`, `workspace_file_exists`, `programmatic`) with bounded gate-failure policy (`fail_run` / `retry` with `max_retries=2` / `skip_to_phase:<slug>`)
- Resumable runs -- phase state in Postgres (`workflow_phases`), survives uvicorn restart and cross-worker resume
- Versioned `workflow_definitions`, immutable-on-publish (DB trigger + `UNIQUE(slug, version)` + FK `ON DELETE RESTRICT`)
- Dual-mode toggle -- Deep (default, unchanged) vs Harness (locked phases); `threads.active_workflow_run_id NULL = Deep`, non-null = Harness + locked
- Workflow-lock enforcement -- Harness to Deep refused server-side until complete or explicitly cancelled; Cancel affordance clears `active_workflow_run_id` in the same transaction as the terminal status write
- Live phase timeline in the panel (current/locked/completed glyphs, gate pass/fail, transition log); auto-opens on Harness entry; WCAG AA
- `harness_audit` trail -- per-transition + gate + tool-refusal events, INSERT-only RLS
- Cross-provider parity on all of the above -- eval harness (SEED-034) as the CI regression gate

**REFINEMENT over v2.7 PRD Section 3 Theme B -- bounded retry is mandatory, not optional:**
The v2.7 PRD bare `on_failure: retry` has no cap. Every durable-execution reference (Temporal, Step Functions, OpenAI guardrails) bounds retries. Add `max_retries: int = 2` to `BasePhase` plus a consecutive-identical-output structural-failure short-circuit. An unbounded retry loop on a deterministically-failing gate burns tokens and holds a concurrency slot forever.

**Should have (competitive differentiators):**
- Dispatcher-enforced determinism the model cannot escape at the protocol level -- binary win over Claude.ai/ChatGPT/Glean
- Self-hostable + multi-provider locked workflows -- same harness on Claude / GPT / self-hosted Ollama
- SEED-029 Continue button -- resume past per-phase `max_steps` instead of silently dropping tool calls
- SEED-035 tool-count budget guard at `get_tools()` -- pairs with per-phase whitelisting; improves Google accuracy
- SEED-036a `task()` global fair-share for `llm_batch_agents` under load
- Seed workflow templates (Research-Summarize / Plan-Execute-Verify / 6-phase Multi-Agent)

**Defer to v2.9+:**
- `llm_judge` validator (evaluator-optimizer gate) -- defer until deterministic validators are trusted
- Plugin `phase_type` / `panel_renderer` extension points -- Plugin Contract is v2.9 per PROJECT.md
- Visual drag-and-drop workflow builder -- large scope disjoint from the runtime; v1 authoring is jsonb/API/seed
- Workflow scheduling / cron -- v3.4 Automations

**Anti-features (do NOT build):**
- In-memory-only phase state -- fatal for resumability and multi-worker
- Provider-conditional edits to the shared SSE/dispatch path -- the 075.x cascade is the reference failure
- Global `isHarnessLocked` boolean -- must be per-thread keyed Map/Set (BUG-260523-01 exact signature)
- Per-tool-call whitelist DB read -- Postgres round-trip per tool call violates D-v2.5-01
- Harness as the default mode -- Deep Mode is the unchanged default; Harness is opt-in

### Architecture Approach (from ARCHITECTURE.md)

The harness is a thin new module (`harness_engine.py` + `harness/` package) that plugs into a single branch in `agent_runner` (after `active_workflow_run_id` is read) and a single additive guard in `dispatch_tool`. Everything else is composition of existing, cross-provider-tested code. Critical sequencing: G-5 extraction (`threads.py` to `agent_loop.py`) ships first; schema/RLS ships in parallel; the engine + phase types + validators ship third; dual-mode wiring + panel timeline follow. Deep Mode stays byte-identical throughout because the dispatch guard is a no-op when `phase_whitelist is None`.

**Major components:**
1. **`app/services/agent_loop.py` (new, G-5 extraction)** -- iteration loop + tool-dispatch block lifted verbatim from `threads.py:1818-2779`; shared by Deep Mode and `llm_agent` phase type; carries ALL per-provider round-trip fixes
2. **`app/services/harness_engine.py` (new)** -- `run_workflow()` state machine; drives phase transitions; persists `workflow_phases` rows (2-phase write); emits `workflow_*` SSE via existing `_emit` XADD path; owns gate validation and `on_failure` routing
3. **`app/services/harness/` package (new)** -- `phase_types.py` (5 executors), `validators.py` (4 kinds + `VALIDATOR_REGISTRY` + bounded retry), `programmatic.py` (`PROGRAMMATIC_PHASE_REGISTRY`), `models.py` (Pydantic `PhaseConfig` discriminated union)
4. **`app/services/tool_dispatcher.py` (1 additive change)** -- `phase_whitelist: frozenset[str] | None = None` on `ToolContext`; 3-line pre-check in `dispatch_tool()` returns `tool_not_available_in_phase` JSON ToolResult when active; `None` in Deep Mode is a no-op
5. **`app/db/workflows.py` (new)** -- typed asyncpg helpers for `workflow_runs`/`workflow_phases` CRUD; mirrors `db/runs.py`; D-v2.5-01 compliant
6. **`app/api/workflows.py` (new)** -- `POST /threads/{id}/workflow` (start run), `POST /threads/{id}/workflow/cancel`, `GET /threads/{id}/workflow` (reconcile endpoint)
7. **`frontend/src/providers/StreamsProvider.tsx` (+1 Map)** -- `workflow_phase_*` handlers writing to new `phasesByThread: Map<threadId, PhaseTimeline>`; PANEL-06 isolation preserved (never touches `bucketsBySurface`)
8. **`frontend/src/components/panel/PhaseTimeline.tsx` (new)** -- phase indicator, gate badges, transition log; ARIA landmarks per Theme H; reconciles via `GET /threads/{id}/workflow` on mount

**PRD-vs-reality deltas (where research improves on the v2.7 PRD Section 3 Theme B design):**

1. **`llm_agent` substrate:** PRD says mirrors `agent_runner` at `threads.py:1059`. Reality is better: `task_service.run_task_sub_agent` (line 196) is ALREADY a self-contained bounded agent loop with own `runs` row, stream, model resolution, tool dispatch, and `available_tools` enforcement. Build `llm_agent`/`llm_batch_agents` on `run_task_sub_agent`.
2. **Whitelist enforcement placement:** PRD Section 6 proposes a pre-check at `threads.py:1059`. The correct seam is `dispatch_tool()`. The `_handle_task` subset-refusal precedent (lines 1090-1110) is the exact pattern. Putting it in the dispatcher means sub-agent and harness whitelisting share ONE mechanism and `threads.py` does not grow another special-case branch.
3. **Whitelist caching:** PRD Section 6 proposes an in-memory cache with refresh-on-transition. This is over-engineered. Resolve `available_tools` ONCE when the phase starts and pass by value as a frozenset into the loop. No cache layer needed.
4. **Drop `threads.deep_mode_metadata jsonb`:** PRD Theme F adds this column; no consumer in v2.8 scope. Drop it from the migration.
5. **Migration numbers:** PRD reserved range 125-139 is stale fiction. Real migration head is `055_todos_table.sql`. v2.8 renumbers from 056+.
6. **Bounded gate retry (REFINEMENT):** PRD bare `on_failure: retry` is unbounded. Add `max_retries: int = 2` to `BasePhase` as a hard requirement.

### Critical Pitfalls (from PITFALLS.md)

**Top 5 by severity and likelihood:**

1. **Cross-provider regression from shared-path edits (Pitfall 1)** -- The whitelist pre-check MUST live in `dispatch_tool()` as an additive no-op in Deep Mode. Any edit to the provider-specific streaming branches (~L1897 Anthropic, ~L2025 Google, ~L2169 OpenAI-compat) will reproduce the 075.x cascade. Prevention: the guard lives below all provider-specific code; the refusal is a plain ToolResult string riding the existing tool-result message path. Owns: P-EXTRACT + P-ENFORCE + P-EVAL.

2. **G-5 extraction regression (Pitfall 12)** -- `agent_runner` carries 8 phases of ordered battle-won invariants (`_shielded_finalize` race, `thought_signature`, `reasoning_content`, `end_turn` handling, `force_no_tools`-on-last-iteration). Extraction is behavior-preserving-only, its own dedicated phase, gated by eval harness + E2E backstop (byte-identical SSE sequence per provider) before any harness feature. Owns: P-EXTRACT.

3. **State-machine deadlock, phase stuck `active` forever (Pitfall 3)** -- Every phase needs both a `max_steps` cap AND a wall-clock cap (`asyncio.wait_for`). The `force_no_tools`-on-last-iteration guard MUST be carried forward into `agent_loop.py`. Publish-time reachability lint prevents authoring an unsatisfiable phase. Owns: P-ENGINE + P-EXTRACT.

4. **Resumability edge cases across worker restart (Pitfall 5)** -- Three cases: mid-LLM-call (phase marked `active` with no output, re-run from top); mid-`programmatic` (must be idempotent or guarded); mid-`ask_user` pause (must re-subscribe AND re-emit the pending prompt on startup sweep). Mandatory 2-phase write: mark `active` BEFORE work; mark `completed` only AFTER output is durable. Owns: P-ENGINE + P-VERIFY.

5. **`llm_batch_agents` fan-out AnyIO ceiling (Pitfall 6)** -- N agents x M parallel runs can exhaust the threadpool (verify live `anyio.to_thread.current_default_thread_limiter().total_tokens`). Per-run `Semaphore(3)` in `task_service` is too small for batch work. Introduce `max_parallel_agents` (default 5) composing with the global Redis-Lua cap of 20. Owns: P-BATCH (SEED-036a).

**Supporting pitfalls the roadmapper must assign to phases:**
- Pitfall 2: Whitelist enforcement bypass -- refusal must return a well-formed `tool_result` with matching `tool_call_id` or the next provider round gets a 400 (P-ENFORCE)
- Pitfall 4: Validation-gate infinite retry -- bounded `max_retries` + structural-failure short-circuit (P-ENGINE)
- Pitfall 7: Immutable-on-publish race -- publish atomically; `workflow_runs` references immutable definition ID, never mutable slug (P-SCHEMA + P-ENGINE)
- Pitfall 8: Dual-mode switch corruption -- mode switch takes effect only on NEXT run; lock state is per-thread Map, never a global boolean (P-MODE)
- Pitfall 9: `ask_user` / human-input timeout -- reuse `ask_user_service` verbatim; timeout drives phase `on_failure`, not just a free LLM string (P-ENGINE)
- Pitfall 10: Tool-count budget degradation on Google past ~20-26 tools -- SEED-035 at `get_tools()`; per-phase whitelist is the structural mitigation (P-EVAL)
- Pitfall 11: Per-provider tool-use protocol gaps -- carry forward EVERY per-provider round-trip fix during G-5 extraction; eval harness as CI gate (P-EVAL + P-EXTRACT)
- Pitfall 13: Continue button resumes wrong phase or unbounded -- Continue resumes the SAME phase with a bounded additional step budget, re-reading its whitelist from Postgres (P-ENGINE + P-MODE)

---

## Implications for Roadmap

**Critical path:** Phase A -> Phase C -> Phase E -> Phase F. Phase B parallels A. Phase D folds into C. Phase G is the verify wave. Deep Mode stays byte-identical throughout.

### Phase A: G-5 Agent-Loop Extraction (BLOCKING, ships first, zero harness features)

**Rationale:** G-5 is non-negotiable per CLAUDE.md. The harness cannot bolt onto a 3,186-LOC god file. This is a dedicated refactor phase, not bundled with any feature.

**Delivers:** `app/services/agent_loop.py::run_agent_loop(loop_ctx)` -- iteration loop lifted verbatim from `threads.py:1818-2779`. `threads.py` retains route + producer spawn + `_emit`/`_spawn` + shielded finalize. Acceptance bar: byte-identical Deep-Mode SSE sequence per provider, eval harness GREEN, E2E backstop GREEN -- both before AND after extraction.

**Addresses:** G-5 hot-file ledger, Pitfall 12 (extraction regression), Pitfall 11 (carry forward per-provider round-trip fixes verbatim), Pitfall 3 (port `force_no_tools` guard into extracted loop)

**Research flag:** NO -- standard behavior-preserving move. Verification gate is the guardrail.

### Phase B: Schema + RLS + Pydantic Config Models (parallel with Phase A)

**Rationale:** Pure schema work; no runtime dependency on the extraction. Can land while Phase A is in progress.

**Delivers:** Migrations 056-059 for `workflow_definitions`, `workflow_runs`, `workflow_phases`, `threads.active_workflow_run_id`. RLS via `threads.user_id` FK chain (exact pattern from migrations 054/055). `UNIQUE(slug, version)` + `BEFORE UPDATE` immutable-publish trigger + FK `ON DELETE RESTRICT` on `workflow_definitions`. `harness_audit` table (INSERT-only RLS). Drop `threads.deep_mode_metadata jsonb`. `app/models/harness.py` -- `PhaseConfig` discriminated union, `ValidatorSpec`, `WorkflowDefinition` pydantic models.

**Addresses:** HARNESS-DEF-01, Pitfall 7 (immutable-publish race), CLAUDE.md RLS requirement

**Research flag:** NO -- FK-chain RLS is proven in migrations 054/055.

### Phase C: Harness Engine + 5 Phase Types + Validation Gates (Phase D whitelist enforcement folds in)

**Rationale:** Needs Phase A (clean `run_agent_loop()`) and Phase B (tables). This is the core of the milestone. Phase D folds in because they share the `ToolContext` construction site.

**Delivers:** `harness_engine.py` (transition loop, `run_workflow()`, 2-phase write, `harness_audit` emit) + `harness/phase_types.py` (5 executors -- `programmatic` via `PROGRAMMATIC_PHASE_REGISTRY`, `llm_single` via `task_service._stream_one_iteration`, `llm_agent`/`llm_batch_agents` via `run_task_sub_agent`, `llm_human_input` via `ask_user_service` verbatim) + `harness/validators.py` (4 validator kinds + bounded `max_retries` + structural-failure short-circuit) + `app/db/workflows.py`. `ToolContext.phase_whitelist: frozenset[str] | None = None` + 3-line additive pre-check in `dispatch_tool()`. `get_tools()` filter at the composition site (folds SEED-035).

**Addresses:** HARNESS-TYPE-01, HARNESS-GATE-01, HARNESS-ENFORCE-01, Pitfalls 1/2/3/4/5/7/9

**Research flag:** LOW -- phase-type composition is proven code reuse. The 2-phase write and `ask_user` resume re-subscription are the highest-risk implementation details.

### Phase E: Dual-Mode Wiring + SEED-029 Continue Button

**Rationale:** Dual-mode requires Phase C. SEED-029 lives here because `max_steps` is a per-phase concept.

**Delivers:** `agent_runner` branch on `threads.active_workflow_run_id`; `api/workflows.py` (CRUD, start run, cancel with terminal-status + column-clear in single transaction); per-thread mode-lock state (per-thread Map, never global boolean); SEED-029 Continue affordance (resumes SAME phase with bounded additional step budget, re-reads `workflow_phases.available_tools` from Postgres).

**Addresses:** MODE-SWITCH-01, Pitfall 8 (per-thread lock isolation + next-run-only mode switch + terminal clear + server-side enforcement), Pitfall 13 (Continue resumes correct phase, bounded)

**Research flag:** LOW -- mode branching is simple. Per-thread lock isolation (BUG-260523-01 pattern) needs explicit UAT verification.

### Phase F: Panel Phase Timeline + StreamsProvider Extension

**Rationale:** Purely additive to existing panel architecture. Depends on Phase C/E for events to render. G-2 guardrail fires here -- sketch-first required for any live UI surface.

**Delivers:** `phasesByThread: Map<threadId, PhaseTimeline>` + actions in `streamsStore.ts`; `workflow_phase_*` handlers in `StreamsProvider.tsx` `makeStreamCallbacks` (mirrors Phase-086 handlers at lines 674-702); `<PhaseTimeline>` section in `WorkspacePanel.tsx` (auto-opens on Harness entry; ARIA landmarks per Theme H; `EMPTY_PHASES` constant); `GET /threads/{id}/workflow` reconcile endpoint; `usePhases(threadId)` hook.

**Addresses:** PANEL-LAYOUT-01 (phase timeline section), PANEL-STREAMS-01 (PANEL-06 isolation preserved), ACCESSIBILITY-01 (WCAG AA phase indicator landmarks)

**Research flag:** LOW but G-2 FIRES -- propose `/gsd:sketch` before `/gsd:spec-phase` for the `<PhaseTimeline>` component. The StreamsProvider integration pattern is proven.

### Phase G: Eval Harness + Cross-Provider Verification + SEEDs 034/035/036a

**Rationale:** Regression gate must be wired before milestone closes. Verify wave; needs all features to exist.

**Delivers:** `scripts/eval_cross_provider.py` as CI regression gate (multi-phase workflow on all 6 native providers, asserts locked phase sequence completes with correct tool round-trips); 4-axis UAT scoreboard per CLAUDE.md SC#10; uvicorn-restart-mid-workflow smoke test per phase type (incl. mid-`ask_user`); SEED-036a per-phase fair-share semaphore for `llm_batch_agents`; SEED-035 per-provider `max_tools` soft ceiling in `MODEL_CAPABILITIES`.

**Addresses:** HARNESS-RUN-01 (resumability), Pitfalls 1/6/10/11 (cross-provider regression gate as CI, batch concurrency ceiling, tool-count budget)

**Research flag:** LOW -- eval harness mechanics are standard. Per-provider model list needs curation pass at this phase. Verify live AnyIO threadpool budget before sizing batch defaults.

### Phase Ordering Rationale

- A before everything: G-5 extraction is non-negotiable. The harness cannot bolt onto `threads.py`. Must be behavior-proven before any harness code exists.
- B parallel with A: Schema is pure Postgres/Supabase work with no code dependency on the extraction.
- C third: Needs the clean `run_agent_loop()` from A and the tables from B. Whitelist enforcement folds in at the same integration point.
- E after C: Dual-mode wiring needs the engine to branch to.
- F after C/E: Panel timeline needs events to render; the StreamsProvider addition is entirely additive.
- G last: Verification wave; needs all features to exist.

### Research Flags Summary

| Phase | Research Needed? | Reason |
|-------|-----------------|--------|
| A (G-5 extraction) | NO | Pure behavior-preserving move; verification gate is the guardrail |
| B (schema) | NO | FK-chain RLS is proven in migrations 054/055 |
| C (engine + phases + validators) | LOW | 2-phase write and `ask_user` resume re-subscription are the tricky spots |
| D (whitelist, folds into C) | NO | `_handle_task` subset-refusal is the exact pattern; 3-line pre-check |
| E (dual-mode) | LOW | Per-thread lock isolation needs explicit UAT |
| F (panel timeline) | LOW + G-2 FIRES | Propose `/gsd:sketch` for PhaseTimeline before spec-phase |
| G (eval + verify) | LOW | Model list curation; verify live AnyIO threadpool budget |

---

## Watch Out For

Named failure modes that look done but are not. Each should be a checklist item in the relevant phase VERIFICATION.md.

1. **Dispatch pre-check only, no schema filter** -- the guarantee requires enforcement in `dispatch_tool()`; schema-filtering `get_tools()` is an optimization, not the guarantee. Verify by attempting a non-whitelisted tool by name on a running workflow and confirming a clean `tool_result` (not a crash or provider 400) on ALL 6 providers.

2. **Extraction cleanup** -- any while-I-am-in-here refactor during Phase A re-opens the cascade. Acceptance bar: byte-identical SSE sequence per provider, not just tests pass.

3. **`ask_user` re-subscribe on resume** -- kill uvicorn while a `llm_human_input` phase is paused; restart; confirm the prompt re-renders in the panel AND the user POST response reaches the engine.

4. **Global `isHarnessLocked` boolean** -- the per-thread lock must be a `Map<threadId, bool>` (or equivalent) in both frontend stores AND backend session state. A global flag reproduces BUG-260523-01 exactly.

5. **Unbounded `on_failure: retry`** -- verify a deterministically-failing gate stops after `max_retries` (default 2). Test: a `json_schema` validator that can never pass, `on_failure: retry` -- assert the phase reaches `failed` status after 3 total attempts (1 initial + 2 retries), not infinite.

6. **`llm_batch_agents` `max_parallel` missing** -- verify N=10 fans out at max 5 concurrent; verify app-wide threadpool is not starved (cross-tab GET latency stays under 50ms during a batch phase).

7. **Migration numbers** -- PRD reserved 125-139; reality is 056+. Every migration reference citing the old range is wrong.

8. **`deep_mode_metadata` column** -- v2.7 PRD proposed it; drop it. No consumer in v2.8 scope.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All dependencies verified in venv; zero new libraries required; hand-rolled vs library decision grounded in concrete durability requirements |
| Features | HIGH | Table-stakes corroborated by 5 independent prior-art systems. Competitive gap analysis is MEDIUM for Claude Agent Mode (A/B rumor, not GA) |
| Architecture | HIGH | Every integration claim grounded in real file:line references. PRD-vs-reality deltas are favorable. Migration head correction (055, not 124) is a hard factual finding |
| Pitfalls | HIGH | Grounded in actual substrate files + living project memory (075.x cascade, BUG-260523-01, SEED-029 silent-drop). 13 named pitfalls with file:line prevention pointers |

**Overall confidence: HIGH**

The research is unusually high-confidence because the substrate is known and battle-tested. We are composing existing primitives in a new configuration, not building on speculation. The main uncertainty is the exact LOC count for the harness engine (estimated 50-100 lines for the transition loop, based on the `task_service` sub-agent loop as the analog), not whether it will work.

### Gaps to Address

- **AnyIO threadpool live budget:** Verify `anyio.to_thread.current_default_thread_limiter().total_tokens` before sizing `llm_batch_agents` defaults. The PRD cites approximately 200; PITFALLS.md notes the default is 40 and the project lifted it. The exact current value is unknown without a live check (Phase G).
- **Per-provider model list for eval harness:** `feedback_model_names_representative` flags that model names are representative of provider class, not pinned models. The eval harness (SEED-034) needs an explicit curation pass at Phase G time to use current model IDs for each of the 6 native providers.
- **`programmatic` phase idempotency documentation:** The `PROGRAMMATIC_PHASE_REGISTRY` author contract (idempotent or guarded) needs a docstring and design note in the harness package. This is a gap in artifact creation for Phase C, not a gap in understanding.

---

## Sources

### Primary (HIGH confidence, code read directly)

- `backend/app/services/tool_dispatcher.py` -- `dispatch_tool`:1495, `ToolContext.available_tools`:88, `_handle_task` subset-refusal:1090-1110, `_TOOL_REGISTRY`:1465, `_handle_ask_user`:1273-1458
- `backend/app/services/task_service.py` -- `run_task_sub_agent`:196, per-run `Semaphore` + Lua global cap:58-90, `_stream_one_iteration`:162
- `backend/app/services/ask_user_service.py` -- SUBSCRIBE-first ordering, cancel/shutdown sentinels, durable-row-first path
- `backend/app/api/threads.py` -- `agent_runner`:1423, `ToolContext` build:2632, dispatch call:2677, `_emit`:109, finalize:158, `force_no_tools`:1868, provider branches:~1897/~2025/~2169, `thought_signature`/`reasoning_content`:2604-2620
- `backend/app/services/openai_service.py` -- `get_tools()`:768-784, `create_adaptive_streaming_chat`:1124
- `frontend/src/providers/StreamsProvider.tsx` -- Phase-086 panel handlers:674-702, per-thread Map demux
- `supabase/migrations/054_workspace_files.sql` + `055_todos_table.sql` -- RLS FK-chain pattern
- `supabase/migrations/017_skills.sql` -- trigger style as the immutable-trigger model
- venv: pydantic 2.12.5, jsonschema 4.26.0, fastapi 0.115.6, redis>=5.2, asyncpg>=0.29 (all verified)
- `.planning/PRDs/v2.7.md` Section 3 Theme B + Section 5 + Section 6 -- harness table design (6 deltas identified above)
- `.planning/PROJECT.md` -- v2.8 scope, folded-in seeds, migration head 055, Plugin Contract deferred to v2.9

### Secondary (HIGH confidence, prior art patterns, not adopted)

- Anthropic Building Effective Agents -- workflow/agent split, prompt-chaining gate concept, 5 named patterns
- OpenAI Agents SDK guardrails -- tripwire = gate, LLM-or-programmatic validator, blocking execution
- Temporal / AWS Step Functions -- at-least-once + bounded-retry + idempotent-activity + immutable-definition-version (patterns transferred, engines not adopted)
- LangGraph PostgresSaver + interrupt -- pause/resume + survive-restart pattern (pattern transferred; FORBIDDEN to adopt per CLAUDE.md)
- arXiv 2508.02721 / 2507.16459 -- hooks below the decision layer cannot be bypassed by reasoning

### Project memory (HIGH confidence, living lessons from this codebase)

- `feedback_no_cross_provider_regressions`, `feedback_regressions_during_075_3_uat`, `feedback_workflow_guardrails` (G-1..G-6)
- BUG-260523-01 -- global `isStreaming` lockout; per-thread Map is the fix pattern
- SEED-029/034/035/036a -- folded into v2.8 per PROJECT.md

---
*Research completed: 2026-05-30*
*Ready for roadmap: yes*
*All 4 research files synthesized: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md*
*v2.7 PRD Section 3 Theme B cross-checked: 6 deltas identified (all favorable, research improves on PRD assumptions)*
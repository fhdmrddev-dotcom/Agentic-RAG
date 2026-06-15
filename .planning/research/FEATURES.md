# Feature Research

**Domain:** Agent-workflow / harness runtime + dual-mode (free-form vs locked-workflow) UX for a multi-provider Agentic RAG platform
**Researched:** 2026-05-30 (milestone v2.8 "Harness Engine & Workflow Mode")
**Confidence:** HIGH on prior-art patterns (Anthropic + OpenAI Agents SDK + LangGraph + Temporal/Step Functions are well-documented and mutually corroborating) and HIGH on substrate-fit claims (grounded in the actual `tool_dispatcher.py` / `task_service.py` / `ask_user_service.py` / `openai_service.py` code). MEDIUM on the precise UX shape of the Deep↔Harness toggle (no closed competitor ships exactly this; the locked-workflow surface is a genuine differentiator with thin direct prior art).

> **Scope note:** This file covers ONLY the new harness/workflow-runtime + dual-mode surface for v2.8. Per `PROJECT.md:41`, the **Plugin Contract (Theme E)** and `super_admin`/operator role tier are **deferred to v2.9** and are deliberately excluded here. The v2.7 PRD `.planning/PRDs/v2.7.md` §3 Theme B + §5 is the *starting* design — validated and refined below with prior-art evidence. Where the PRD is sound it is cited and endorsed; where evidence suggests a change it is flagged with **[REFINEMENT]**.

---

## Prior-Art Synthesis (the evidence base behind every categorization)

Five real systems converge on the same answer to "how do production agent-workflow systems actually work." The convergence is the strongest signal in this research: a hand-rolled state machine over the existing substrate lands the *same* architecture these systems ship, without LangChain/LangGraph (which `CLAUDE.md` forbids).

| System | What it proves for v2.8 | Confidence |
|--------|-------------------------|------------|
| **Anthropic "Building Effective Agents"** | The workflow/agent split is the load-bearing distinction. Five named patterns — **prompt chaining** (sequential, "add programmatic checks (gate) on any intermediate steps to ensure the process is still on track"), **routing**, **parallelization** (sectioning + voting), **orchestrator-workers**, **evaluator-optimizer**. The 5 phase types map directly onto these. "Gates" between steps are a first-class Anthropic concept, not a v2.8 invention. | HIGH |
| **OpenAI Agents SDK** (guardrails + handoffs) | Validation gates = **input/output guardrails** with a **tripwire** that "immediately raises … and halts execution." A guardrail "can be an LLM-powered agent … or a rule-based/programmatic function, such as a regex." This is *exactly* the v2.7 PRD's `validators: [{kind: json_schema|regex_match|programmatic}]` shape. **Tool guardrails** ("checks around each custom function-tool call inside the workflow") = the per-phase tool whitelist concept. **Blocking execution** (gate completes before agent runs) = `gate_blocking: true`. | HIGH |
| **Academic: deterministic LLM workflow / phase enforcement** (arXiv 2508.02721 "Blueprint First, Model Second"; arXiv 2507.16459 policy adherence; "Structured Lifecycle Control") | The headline enforcement insight, verbatim: *"Hooks operate below the agent's decision layer and cannot be bypassed by agent reasoning … the agent should not be able to 'decide' to skip planning or write code during verification."* And: *"Control is shifted out of the LLM into a structured … engine; the LLM becomes a controlled tool invoked by that engine."* This is the academic statement of the v2.8 enforcement model. The dispatcher (not the LLM) owns transitions. | HIGH |
| **Temporal / AWS Step Functions** (durable execution — *patterns only, not adopting*) | Resumability = **event-history replay** (Temporal) / **JSON state machine + persisted execution state** (Step Functions). "If the server crashes between Step 1 and Step 2, re-read the Event History … re-run the rest deterministically." Validates persisting phase state to durable storage (Postgres) so runs survive restart. The app's `runs` table + Redis Stream event buffer is already a lightweight event-history; phase state in `workflow_phases` is the Step-Functions-style durable state. **Do NOT adopt either engine** — the pattern transfers, the dependency does not. | HIGH |
| **LangGraph PostgresSaver + `interrupt()`** (*pattern only, FORBIDDEN to adopt per `CLAUDE.md`*) | The reference impl of "pause/resume + survive restart" for LLM agents. Checkpoint at each super-step → Postgres; human-in-the-loop = interrupt + resume from checkpoint; "kill the server mid-onboarding, restart, agent resumes with details intact." v2.8 replicates the *behavior* with `workflow_phases` rows (Postgres) + the existing `ask_user` Redis pub/sub — NOT with LangGraph. This is the single most important "build it ourselves, the pattern is public" finding. | HIGH |

**The competitive gap (what Claude.ai / ChatGPT canvas / Glean DON'T have):** Claude's rumored 2026 "Agent Mode" surfaces a *fixed dashboard* of workflow categories (Research/Analyze/Build/Write/Plan) — a curated menu, **not** a user-authorable locked state machine with per-phase tool gating and validation gates. ChatGPT canvas is free-form targeted editing — **no** phase concept at all. Glean has **zero** workflow surface (it is a search/answer product). None offer **deterministic, auditable, dispatcher-enforced phases**. None are self-hostable or multi-provider. v2.8's harness is therefore a real differentiator, not parity-chasing.

---

## Substrate-Fit Grounding (verified against the actual code)

Every harness feature below depends on primitives that **already exist and are validated**. Verified by reading the source this session:

| Harness need | Existing primitive (file:line) | Reuse / generalize |
|--------------|-------------------------------|--------------------|
| **State-machine enforcement** (refuse out-of-phase tools) | `tool_dispatcher.py:1495` single `dispatch_tool(name, args, ctx)` entry + `_TOOL_REGISTRY` dict (`:1465`); **working per-subset refusal precedent** at `_handle_task` `:1090-1110` ("refused: tools {invalid} not available … must be subset of …"). `ToolContext.available_tools` already carries the per-call whitelist (`:88`). | The enforcement is a ~15-LOC pre-check at the top of `dispatch_tool`: if a workflow is active, read current-phase `available_tools`, refuse + return `tool_not_available_in_phase` ToolResult. The refusal-as-tool_result pattern is **already proven** by `_handle_task`. **No new substrate.** |
| **`llm_agent` / `llm_batch_agents`** | `task_service.py`: spawns child sub-agent w/ own `runs` row + own `run:{sub_run_id}` Redis stream + per-run `asyncio.Semaphore(3)` + **global Redis Lua-atomic cap (20)** (`:51-86`); 1-level nesting cap via `parent_run_id`. | `llm_agent` = one `task`-style spawn with the phase's tool whitelist. `llm_batch_agents` = N parallel `task` spawns + deterministic merge. The Lua global cap is the SEED-036a fair-share knob. **Reuse `task_service` verbatim.** |
| **`llm_human_input`** | `ask_user_service.py`: Redis pub/sub pause/resume, **SUBSCRIBE-before-signal ordering** (race-safe, `:18-28`), cross-worker cancel sentinel, lifespan shutdown broadcast. | `llm_human_input` = the harness drives the same pause/resume `ask_user` already implements. **Reuse verbatim** — the PRD says "REUSES this verbatim" and the code confirms it is generic enough. |
| **Resumable runs** | `runs` Postgres table + `run:{run_id}` XADD event buffer + `GET /runs/{id}/stream?since=N` replay-and-tail + asyncpg pool hot paths. | Phase state in `workflow_phases` (Postgres) IS the durable checkpoint. Survives uvicorn restart because Postgres is the source of truth and the Redis stream replays. **No new substrate.** |
| **Per-phase tool registration** | `openai_service.py:768` `get_tools(user_settings)` — the single mode-conditional registration site (already gates web_search/execute_code on settings). | Wrap `get_tools()` output with a per-phase filter when a workflow is active (intersect with `workflow_phases.available_tools`). SEED-035 tool-count budget guard wraps the same site. |
| **All new SSE event types** | StreamsProvider demuxes `run:{run_id}` events by type into Zustand stores; **panel updates trigger ZERO chat re-renders (PANEL-06)**. The v2.7 panel already consumes `todo_updated` / `workspace_file_*` / `ask_user_prompt`. | `workflow_phase_*` / `workflow_transition` ride the SAME stream; the phase timeline is a new panel section + one new StreamsProvider event-type arm. **No new substrate.** |

**G-5 dependency (blocking, must land first):** `backend/app/api/threads.py` (3,186 LOC) hosts `agent_runner` and is G-5-FIRING per `CLAUDE.md`. The agent loop must be extracted into a clean harness/agent-loop module **before** harness logic bolts on. This is a hard sequencing constraint, captured in the dependency graph below.

---

## Feature Landscape

### Table Stakes (Users / Buyers Expect These of a "Workflow Harness")

A workflow runtime that lacks any of these does not read as a credible harness — it reads as a chat with extra buttons. Each is corroborated by at least two prior-art systems.

| Feature | Why Expected | Complexity | Notes / Substrate Dependency |
|---------|--------------|------------|------------------------------|
| **Ordered, locked phases** (a run executes phases in declared order; the LLM cannot reorder) | Anthropic prompt-chaining + Step Functions state machine + the academic "prevent jumping between states without passing through required intermediate steps." A "workflow" that the model can reorder is just an agent. | MEDIUM | Backend owns transitions (`harness_engine.py` `_advance_phase`). PRD §3 Theme B sound. |
| **`programmatic` phase** (pure Python, no LLM) | Step Functions Pass/Task states; deterministic transforms/validation belong in code, not an LLM call. Cheapest, most reliable phase. | LOW | `PROGRAMMATIC_PHASE_REGISTRY` dict — mirrors the `_TOOL_REGISTRY` pattern exactly. Trivial. |
| **`llm_single` phase** (one curated LLM call, response is output) | Anthropic prompt-chaining unit; routing/classification/extraction. The atomic LLM step. | LOW | One model call through existing provider routing + the phase's tool whitelist (often empty). Pydantic structured output for typed phase results. |
| **`llm_agent` phase** (multi-turn loop, curated tools, runs to self-terminate or `max_steps`) | Anthropic orchestrator-workers / autonomous-agent-within-a-bounded-step. The workhorse phase. | MEDIUM | Mirrors the extracted `agent_runner` but with `available_tools` whitelist enforced per-call. SEED-029 "Continue" button is `max_steps`'s natural home. |
| **`llm_batch_agents` phase** (N parallel sub-agents, deterministic merge) | Anthropic parallelization (sectioning + voting). | MEDIUM-HIGH | Reuses `task_service` spawn + Lua global cap. Merge strategies: concat / dedupe / vote (`merge_strategy` config). **Scale bound:** N×parallel-runs can exceed the AnyIO ceiling — cap `max_parallel_agents` (PRD §7 recommends default 5; SEED-036a fair-share is the global knob). |
| **`llm_human_input` phase** (pause for user, resume on response) | OpenAI "human review / approval"; LangGraph `interrupt()`; Step Functions `.waitForTaskToken`. Enterprise approval gates require it. | LOW (reuses) | `ask_user_service.py` verbatim. The harness drives the pause instead of the bare agent loop. |
| **Validation gates between phases** (output must satisfy a check before transition) | Anthropic "programmatic checks (gate)"; OpenAI guardrail **tripwire**. Without gates, "locked phases" still pass garbage forward. | MEDIUM | Validator kinds v1 (PRD §3 sound): `json_schema`, `regex_match`, `workspace_file_exists`, `programmatic` (`VALIDATOR_REGISTRY`). LLM-as-judge validator is a v1.x differentiator (see below). |
| **Gate-failure handling: retry / skip / fail-run** | Every durable-execution engine ships retry policy + catch/fallback transitions. A gate with no failure policy is unusable. | MEDIUM | `on_failure: fail_run \| retry \| skip_to_phase:<slug>` (PRD §3 sound). **[REFINEMENT]** add a bounded `max_retries` (default 2) + per-retry backoff to `retry` so a flapping gate cannot loop forever — Temporal/Step-Functions both bound retries; the PRD's bare `retry` is unbounded. |
| **State-machine enforcement via per-phase tool whitelist** (dispatcher refuses out-of-phase tools, fed back to the LLM) | The defining differentiator-as-table-stake: it is what makes "locked" real. Academic "hooks below the decision layer cannot be bypassed by reasoning." OpenAI tool guardrails. | MEDIUM | Pre-check in `dispatch_tool`. **Working precedent exists** (`_handle_task:1090-1110`). Refusal returned as `tool_result` the LLM already understands (same pattern as "Unknown tool"). **Cache the active whitelist per `run_id`** (refresh on `workflow_transition`) so it is ~1 Postgres roundtrip per transition, NOT per tool call (PRD §6 mitigation — endorsed; mandatory for D-v2.5-01 / latency). |
| **Versioned workflow definitions, immutable-on-publish** | Mirrors the shipped skill-versioning pattern (D-PRD-13: semver + immutable-on-publish). Auditability + reproducibility require that a run pins an exact definition version. | LOW-MEDIUM | `workflow_definitions(slug, version)` UNIQUE + DB trigger refusing post-publish UPDATE — **same trigger shape as `skill_versions` already shipped.** RLS required (all new tables). |
| **Resumable runs (phase state in Postgres, survive uvicorn restart)** | Temporal/Step-Functions/LangGraph-Postgres all persist execution state. D-PRD-08 multi-worker readiness already requires cross-worker safety; long workflows span hours/days. | MEDIUM | `workflow_phases` rows = the durable checkpoint. Write phase row BEFORE next phase starts; SSE emit second; consumer reconciles on reconnect (D-v2.5-03). asyncpg pool (no blocking I/O, D-v2.5-01). |
| **Live phase timeline in the panel** (current/locked/completed glyphs, gate pass/fail, transition log) | Claude.ai's plan surface set the expectation; a locked workflow with no visible progress feels broken. PANEL-06 (zero chat re-renders) already proven. | MEDIUM | New panel section + one StreamsProvider event-type arm. WCAG: phase indicator as landmark regions, icon+color+text (no color-only) — v2.7 A11Y pattern transfers. |
| **Dual-mode toggle: Deep (default, today's free chat) ↔ Harness (locked phases)** | The whole milestone. Deep Mode MUST stay the unchanged default so existing users see zero regression. | MEDIUM | `threads.active_workflow_run_id` NULL = Deep (existing path untouched); non-NULL = Harness (whitelist active). The enforcement pre-check is a no-op when NULL — **existing Deep-Mode behavior is preserved by construction.** |
| **Workflow-lock semantics** (Harness→Deep refused until workflow completes or is explicitly cancelled; explicit Cancel affordance) | A half-escaped locked workflow defeats determinism + auditability. OpenAI/Temporal both make cancellation explicit, never implicit. | LOW-MEDIUM | Deep→Harness allowed mid-thread (spawns `workflow_runs` row). Harness→Deep blocked; "Cancel workflow" button → `POST /threads/{id}/workflow/cancel`. PRD §3 Theme F sound (Q-v2.7-05 rec a-with-lock). |
| **Per-phase / per-run audit trail** (every transition + gate result + tool-refusal logged) | The enterprise pitch is "deterministic, auditable execution." Step Functions logs every state transition; the claim is hollow without a trail. | LOW-MEDIUM | `harness_audit` table (PRD §5). Distinct from the existing `audit_log`. INSERT-only RLS. Cheap; high differentiator value for the enterprise framing. |
| **Iteration-cap "Continue" button (SEED-029)** | Today, hitting the step cap silently drops tool calls (a known footgun — `iteration_cap_dropped_tool_calls` warning exists). Users expect to resume past a cap, not lose work. | LOW | Harness Mode's per-phase `max_steps` is the natural home; a "Continue" affordance re-enters the loop. Also applies in Deep Mode. Folded-in per `PROJECT.md:37`. |
| **Cross-provider parity on all of the above** | `CLAUDE.md` + the 075.x regression history make this non-negotiable: every phase type must behave identically across the 6 native providers (OpenAI/Anthropic/Google/DeepSeek/Kimi/MiniMax/GLM) + OpenRouter/Ollama. | HIGH (discipline, not LOC) | Provider-specific handling stays at the service boundary; the harness sits ABOVE the shared SSE/dispatch path and must not edit it provider-conditionally. SEED-034 eval-harness (`scripts/eval_cross_provider.py`) is the regression gate — folded in. |

### Differentiators (Competitive Advantage)

These set v2.8 apart from Claude.ai / ChatGPT canvas / Glean. Not strictly required for a "minimum harness," but they are the reason to build it.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Dispatcher-enforced determinism the model literally cannot escape** | The binary win over every competitor: Claude/ChatGPT/Glean all rely on prompting ("please follow these steps"); v2.8 makes skipping *mechanically impossible* at the tool boundary. For contract review / financial close / clinical review this is the buying criterion. | MEDIUM (table-stakes mechanism, differentiator framing) | Already-proven refusal pattern + the academic "below the decision layer" framing. The differentiator is that it is *enforced*, not *requested*. |
| **Self-hostable + multi-provider locked workflows** | Same harness runs on Claude OR GPT OR self-hosted Ollama. No competitor offers provider-portable deterministic workflows. | MEDIUM | Rides existing provider routing. The eval-harness proves parity is real, not claimed. |
| **In-product workflow authoring (jsonb `phases`, not external YAML)** | A vibe-coder edits a workflow in the app and iterates — no git/CWL/Argo tooling. PRD §10 rejects external YAML deliberately for this reason. | LOW (v1: API/seed rows) | jsonb `phases` column authored via API or seed migration. Visual builder is an **anti-feature for v2.8** (see below). |
| **LLM-as-judge validator (evaluator-optimizer gate)** | Anthropic's evaluator-optimizer pattern: a gate that is itself an LLM scoring the phase output against criteria, looping back on fail. OpenAI confirms guardrails "can be an LLM-powered agent." Unlocks subjective-quality gates (tone, completeness) that schema/regex cannot express. | MEDIUM | A `validator.kind = "llm_judge"` added to `VALIDATOR_REGISTRY`. **Recommend v1.x** (after the deterministic validators ship + are trusted) to avoid coupling the gate's reliability to model behavior on day 1. |
| **Seed workflow templates shipped in-product** | "Research→Summarize," "Plan→Execute→Verify," "Multi-Agent Research (6-phase)" as ready-to-run examples — documentation-by-example + immediate value. The 6-phase one is the substrate v3.0 Multi-Agent Orchestration reframes onto. | LOW | Idempotent seed migration. High value/cost ratio. |
| **Tool-count budget guard (SEED-035)** | Caps the number of tools registered per call at `get_tools()` to keep provider tool-payloads lean (cross-provider reliability + cost). Pairs naturally with per-phase whitelisting (a phase with 3 tools is inherently under budget). | LOW | Wraps `get_tools()` — same site as the whitelist filter. |
| **`task()` global-concurrency fair-share (SEED-036a)** | Prevents one `llm_batch_agents` run from starving all others under load. Already have the Lua-atomic global cap (20); fair-share makes it per-run-aware. | LOW-MEDIUM | Extends `task_service.py:51-86` global counter logic. |
| **Workflow run as a first-class auditable artifact** (`harness_audit` + `workflow_runs.final_artifact_path`) | Every run produces a traceable record + a named output file. The enterprise "show me exactly what happened in this contract review" story. Glean/Claude/ChatGPT produce a chat transcript, not an audit-grade run record. | LOW-MEDIUM | `harness_audit` INSERT-only; `final_artifact_path` points at a `workspace_files` row (v2.7 substrate). |

### Anti-Features (Commonly Requested, Out of Scope for v2.8)

These look attractive but create disproportionate complexity, conflict with the substrate, or violate project rules. Each is called out so the roadmap does not absorb them.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **LangGraph / LangChain for orchestration** | Purpose-built state-machine primitives; "saves implementation work." | **Forbidden by `CLAUDE.md`** ("no LangChain, no LangGraph — raw SDK calls only"). The hand-rolled state machine is intentionally small (5 phase types, jsonb config) and the substrate already provides every primitive LangGraph would wrap. Adopting it metastasizes. | Hand-rolled `harness_engine.py` over `tool_dispatcher` + `task_service` + `ask_user_service`. The prior-art proves the pattern is public and ~replicable. |
| **Auto-open the panel on every message / aggressive panel behavior** | "The panel is the feature, show it." | Regresses Deep Mode (the default), which must feel unchanged. v2.7 PANEL work fought exactly this; the 087 lesson (`feedback_exhaustive_ui_state_sweep`) is that panel state is a full matrix. Auto-open belongs ONLY to Harness-Mode entry. | Panel hidden by default in Deep Mode; auto-opens **only** on workflow start. One panel toggle, nav-rail style (per `project_087_08_toggle_consolidation`). |
| **Visual drag-and-drop workflow builder** | The harness is a graph; a canvas builder is the "obvious" UX; Glean parity. | Large net-new scope (canvas component + edge routing + DnD + validation overlay) disjoint from the runtime. v1 ships authoring via jsonb/API/seed. | Deferred to a later polish slot (PRD §10 entry 3). v1 authoring = jsonb `phases` rows. Re-trigger: first non-developer needs to author. |
| **External YAML/CWL/Argo workflow files** | Industry-standard languages, git-versioned, established tooling. | Breaks the in-app iteration loop (the whole point — a vibe-coder tunes a workflow *in the product*). Forces filesystem/git tooling. | jsonb `phases` in DB rows (PRD §10 entry 2). |
| **CRDT / live multi-user co-edit of workspace files or workflows** | Google-Docs-style co-editing dream UX. | No demand signal; CRDT infra is significant and does **not** compose with run-backed streaming. Rejected in v2.6/v3.0/v2.7 PRDs consistently. | Out of scope. Re-trigger: explicit vertical-pack customer ask or a competitor ships it. |
| **Provider-conditional edits to the shared SSE/dispatch path to make a phase "work" on one provider** | "Just special-case Gemini's thought_signature here." | The 075.x cascade was 8 phases of cross-provider regressions caused by shared-path edits (`feedback_no_cross_provider_regressions`). The harness sits above the shared path; touching it provider-conditionally re-opens the cascade. | Keep provider handling at the service boundary; harness is provider-agnostic; eval-harness gates regressions. |
| **In-memory-only phase state** ("simpler, faster") | Avoids a Postgres write per transition. | Loses all state on uvicorn restart — fatal for the resumability + auditability claims and incompatible with multi-worker (D-PRD-08). | Postgres `workflow_phases` (PRD Q-v2.7-04 rec b). The write is ~1 per transition, not per tool call. |
| **Per-tool-call whitelist DB read (no cache)** | "Always read fresh from the source of truth." | Adds Postgres latency to every tool dispatch → violates D-v2.5-01 spirit + hurts streaming. | Cache active phase + whitelist per `run_id`; invalidate on `workflow_transition`. (PRD §6 row 1 — endorsed.) |
| **Unbounded gate retry loop** | "Just retry until it passes." | A flapping `json_schema`/`llm_judge` gate loops forever, burning tokens. | **[REFINEMENT]** bounded `max_retries` (default 2) + backoff before `on_failure: retry` escalates to `fail_run`. |
| **Workflow scheduling / cron triggers** | "Run this nightly." | Belongs to v3.4 Automations (routines run AS harness workflows); the scheduler is a sibling process, out of v2.8's runtime scope. | Deferred to v3.4. |
| **UI checkbox edits to todos / interactive workflow re-ordering from the panel** | "Let me tick the box myself." | Status-flip-from-UI was explicitly OUT in v2.7 (read-only display); re-ordering a *locked* workflow from the UI breaks the lock invariant. | Panel shows phase/todo state read-only; the model + harness own mutations. |
| **Plugin-shipped custom phase types (`phase_type` extension) now** | "Vertical packs need custom phases." | The Plugin Contract is **deferred to v2.9** (`PROJECT.md:41`). Building the extension point now risks locking a wrong contract before harness telemetry exists. | Ship the 5 built-in phase types via internal registries (`PHASE_TYPE_REGISTRY` dict). v2.9 opens the registry to plugins on real telemetry. |

---

## Feature Dependencies

```
[G-5: agent_runner extracted from threads.py into clean module]   ← MUST LAND FIRST (hard gate)
        └──enables──> [harness_engine.py state machine]
                          ├──requires──> [Schema: workflow_definitions / workflow_runs / workflow_phases + RLS + immutable-publish trigger]
                          ├──requires──> [dispatch_tool per-phase whitelist pre-check]  (reuses _handle_task precedent)
                          │                   └──requires──> [whitelist cache per run_id, invalidate on transition]
                          ├──contains──> [5 phase types]
                          │                  ├── programmatic     → PROGRAMMATIC_PHASE_REGISTRY (no deps)
                          │                  ├── llm_single       → provider routing (exists)
                          │                  ├── llm_agent        → extracted agent loop + whitelist
                          │                  ├── llm_batch_agents → task_service spawn + Lua global cap + merge  (SEED-036a fair-share)
                          │                  └── llm_human_input  → ask_user_service (verbatim)
                          ├──contains──> [validation gates: VALIDATOR_REGISTRY {json_schema,regex,file_exists,programmatic}]
                          │                  └──requires──> [gate-failure policy: retry(bounded)/skip/fail-run]
                          │                  └──enhanced-by──> [llm_judge validator]  (v1.x — evaluator-optimizer)
                          ├──emits──> [SSE: workflow_phase_* / workflow_transition / workflow_run_complete]
                          │              └──consumed-by──> [Panel phase timeline]  (new StreamsProvider arm; PANEL-06 preserved)
                          └──persists──> [workflow_phases rows = resumable checkpoint]  +  [harness_audit trail]

[Dual-mode toggle (MODE-01)]
        ├──requires──> [threads.active_workflow_run_id column]  (NULL=Deep, set=Harness)
        ├──requires──> [harness_engine.py]  (to spawn a workflow_runs row)
        └──governs──> [workflow-lock: Harness→Deep refused until complete/cancel]

[SEED-029 Continue button] ──enhances──> [llm_agent max_steps]
[SEED-035 tool-count budget] ──wraps──> [get_tools()]  (same site as whitelist filter)
[SEED-034 eval-harness] ──gates──> [every phase type, cross-provider]  (regression backstop)
```

### Dependency Notes

- **G-5 extraction blocks everything:** `agent_runner` must leave the 3,186-LOC `threads.py` first (`CLAUDE.md` G-5 FIRING). The harness reuses the extracted loop for `llm_agent`; bolting the state machine onto the god-file compounds debt. **This is the first roadmap phase, non-negotiable.**
- **Schema before runtime:** `workflow_definitions/runs/phases` + RLS + the immutable-publish trigger must land before `harness_engine.py` can read/write phase state. Mirrors the shipped skill-versioning trigger.
- **Whitelist pre-check requires the cache:** without per-`run_id` caching, the enforcement read is on the hot tool-dispatch path → violates the no-blocking-I/O discipline (D-v2.5-01) and adds streaming latency. Cache + transition-invalidation is part of the same feature, not an optimization.
- **`llm_batch_agents` requires the global concurrency cap:** N parallel sub-agents × M parallel runs can exceed the AnyIO ceiling; the existing Lua-atomic cap (`task_service.py:51-86`) plus a per-phase `max_parallel_agents` (default 5) and SEED-036a fair-share are co-dependencies, not extras.
- **Dual-mode is mostly a column + a no-op:** Deep Mode = `active_workflow_run_id IS NULL` → the whitelist pre-check returns immediately and the existing path is byte-for-byte unchanged. This is what guarantees zero Deep-Mode regression — the single most important risk-control in the milestone.
- **Validation gates enhance but don't block phases:** a phase can run with `validators: []`; gates layer on. Ship the deterministic validators first, add `llm_judge` once they're trusted.
- **Panel timeline conflicts with nothing:** it is a *second* StreamsProvider consumer (proven by v2.7's todos/workspace/ask_user sections) — PANEL-06 (zero chat re-renders) already holds.

---

## MVP Definition

### Launch With (v2.8 core — HARNESS-01..03 + MODE-01)

The smallest set that delivers a *credible, enforced, resumable* harness with a usable dual-mode surface.

- [ ] **G-5 agent-loop extraction** — clean harness/agent-loop module out of `threads.py`. *Hard prerequisite; everything sits on it.*
- [ ] **Schema** — `workflow_definitions` (semver + immutable-publish trigger) / `workflow_runs` / `workflow_phases` (with `available_tools[]`) / `harness_audit`, all with RLS. Migrations renumber from real head **056+** (the PRD's 125-139 is stale fiction per `PROJECT.md:41`).
- [ ] **`harness_engine.py` state machine** — `_advance_phase`, phase registries, transition logic, all phase state to Postgres (resumable).
- [ ] **All 5 phase types** — `programmatic`, `llm_single`, `llm_agent`, `llm_batch_agents`, `llm_human_input` executing end-to-end in a smoke-test workflow (HARNESS-TYPE-01).
- [ ] **Per-phase tool-whitelist enforcement** — `dispatch_tool` pre-check + per-`run_id` cache + `tool_not_available_in_phase` refusal (HARNESS-ENFORCE-01). *The defining feature.*
- [ ] **Validation gates** — `json_schema` / `regex_match` / `workspace_file_exists` / `programmatic` validators + `on_failure: fail_run | retry(bounded) | skip_to_phase` (HARNESS-GATE-01).
- [ ] **Resumability** — kill uvicorn mid-workflow, restart, resume with no state loss (HARNESS-RUN-01).
- [ ] **Dual-mode toggle + workflow-lock** — Deep (default, unchanged) ↔ Harness; mid-thread Deep→Harness; Harness→Deep refused until complete/cancel; Cancel affordance (MODE-01 / MODE-SWITCH-01).
- [ ] **Panel phase timeline** — current/locked/completed glyphs + gate pass/fail + transition log; auto-opens on Harness entry; WCAG AA (new StreamsProvider arm; PANEL-06 preserved).
- [ ] **Cross-provider eval gate (SEED-034)** — `scripts/eval_cross_provider.py` as the regression backstop across the 6 native providers + OpenRouter/Ollama. UAT rows per `CLAUDE.md` SC#10 (cross-provider × multi-tool × parallel-thread × long-message).

### Add After Validation (v2.8 polish riders — already folded in per `PROJECT.md:38-39`)

- [ ] **SEED-029 Continue button** — resume past per-phase `max_steps` instead of silent tool-call drop. *Trigger: `max_steps` exists; cheap to add.*
- [ ] **SEED-035 tool-count budget guard** at `get_tools()`. *Trigger: ships with the whitelist filter site.*
- [ ] **SEED-036a `task()` fair-share** for `llm_batch_agents` under load. *Trigger: batch-phase load testing surfaces starvation.*
- [ ] **Seed workflow templates** (Research→Summarize / Plan→Execute→Verify / 6-phase Multi-Agent). *Trigger: harness stable; documentation-by-example + v3.0 substrate.*
- [ ] **Chat tool-card unification + Anthropic parity riders** (BUG-260529-02 / BUG-260514-02 / BUG-260523-04) + carry-forward UAT sweep (BUG-260527-01 title-gen, Google-404, download). *Sketch-first per G-2.*

### Future Consideration (defer past v2.8)

- [ ] **`llm_judge` validator (evaluator-optimizer gate)** — defer until deterministic validators are trusted; gate reliability shouldn't depend on model behavior on day 1.
- [ ] **Plugin `phase_type` / `panel_renderer` extension points** — **v2.9 Plugin Contract** (`PROJECT.md:41`). Lock the contract on real harness telemetry, not speculation.
- [ ] **Visual workflow builder** — later polish slot; v1 authoring is jsonb/API/seed.
- [ ] **Workflow scheduling / cron** — v3.4 Automations (routines run AS harness workflows).
- [ ] **Workflow-phase-level eval cases** — v3.0+ owns eval; per-phase eval is a polish extension.
- [ ] **`workflow_phases` / version-row cleanup TTL** — v3.4 polish; re-trigger on unbounded row growth telemetry.

---

## Feature Prioritization Matrix

| Feature | User/Buyer Value | Implementation Cost | Priority |
|---------|------------------|---------------------|----------|
| G-5 agent-loop extraction | HIGH (unblocks all) | MEDIUM | P1 |
| Schema + RLS + immutable-publish trigger | HIGH | LOW-MEDIUM | P1 |
| `harness_engine.py` + 5 phase types | HIGH | MEDIUM-HIGH | P1 |
| Per-phase tool-whitelist enforcement (+ cache) | HIGH (the differentiator) | MEDIUM | P1 |
| Validation gates + bounded failure policy | HIGH | MEDIUM | P1 |
| Resumable runs (Postgres phase state) | HIGH (enterprise/auditability) | MEDIUM | P1 |
| Dual-mode toggle + workflow-lock | HIGH | MEDIUM | P1 |
| Panel phase timeline (WCAG AA) | HIGH (perceived completeness) | MEDIUM | P1 |
| Cross-provider eval gate (SEED-034) | HIGH (regression backstop) | MEDIUM | P1 |
| `harness_audit` trail | MEDIUM-HIGH (enterprise) | LOW-MEDIUM | P1/P2 |
| SEED-029 Continue button | MEDIUM | LOW | P2 |
| SEED-035 tool-count budget | MEDIUM | LOW | P2 |
| SEED-036a `task()` fair-share | MEDIUM | LOW-MEDIUM | P2 |
| Seed workflow templates | MEDIUM | LOW | P2 |
| `llm_judge` validator | MEDIUM | MEDIUM | P3 |
| Visual workflow builder | MEDIUM | HIGH | P3 (defer) |
| Plugin extension points | HIGH (later) | HIGH | P3 (v2.9) |

**Priority key:** P1 = must-have for v2.8 launch · P2 = folded-in riders, add within the milestone · P3 = future/deferred.

---

## Competitor Feature Analysis

| Feature | Claude.ai (2026) | ChatGPT canvas | Glean | Our Approach (v2.8) |
|---------|------------------|----------------|-------|---------------------|
| Locked, ordered phases | Curated workflow *menu* (Research/Analyze/Build/Write/Plan) — not user-authorable state machine | None — free-form targeted editing | None — search/answer product | User-authorable jsonb workflow + dispatcher-enforced order |
| Step-skip prevention | Prompt-level ("the model tries to follow") | N/A | N/A | **Mechanical** — `dispatch_tool` refuses out-of-phase tools (below the decision layer) |
| Validation gates between steps | None exposed | None | None | `json_schema`/`regex`/`file_exists`/`programmatic` (+ `llm_judge` v1.x), with retry/skip/fail |
| Human-in-the-loop pause/resume | Implicit chat turns | Implicit | N/A | `llm_human_input` phase via `ask_user` Redis pub/sub (cross-worker, race-safe) |
| Resumable across restart | Session-bound | Session-bound | N/A | Postgres `workflow_phases` checkpoint (Temporal/Step-Functions pattern) |
| Parallel sub-agents + merge | Opaque ("research" does some) | None | None | `llm_batch_agents` via `task_service` + Lua global cap + merge strategies |
| Audit trail of a run | Chat transcript | Chat transcript | Query logs | `harness_audit` (per-transition + gate + refusal), INSERT-only |
| Self-hostable | No | No | No (SaaS) | Yes |
| Multi-provider | Anthropic only | OpenAI only | Provider-abstracted search, no agent workflow | 6 native + OpenRouter + Ollama, eval-gated parity |
| Free-form mode preserved alongside | Yes (default chat) | Yes | Yes | **Deep Mode is the unchanged default**; Harness is opt-in |

**Net:** v2.8's harness is not parity-chasing — three binary wins (mechanical enforcement, resumable+auditable runs, self-hosted multi-provider) have no equivalent in any of the three references. The risk is execution discipline (cross-provider parity + zero Deep-Mode regression), not feature novelty.

---

## Sources

**Prior-art systems (patterns; verified this session):**
- Anthropic, "Building Effective Agents" — workflow/agent split; prompt chaining + "programmatic checks (gate)"; routing; parallelization (sectioning+voting); orchestrator-workers; evaluator-optimizer. https://www.anthropic.com/engineering/building-effective-agents — HIGH
- OpenAI Agents SDK — Guardrails (input/output, tripwire, LLM-or-programmatic, blocking execution) + Handoffs + tool guardrails. https://openai.github.io/openai-agents-python/guardrails/ , https://openai.github.io/openai-agents-python/handoffs/ , https://developers.openai.com/api/docs/guides/agents/guardrails-approvals — HIGH
- Temporal durable execution — event-history replay, resume-after-crash, "beyond state machines." https://docs.temporal.io/workflow-execution , https://temporal.io/blog/temporal-replaces-state-machines-for-distributed-applications — HIGH (pattern only; NOT adopted)
- AWS Step Functions / Lambda durable functions — JSON state machine, persisted execution state, retry/catch. https://aws.amazon.com/blogs/aws/build-multi-step-applications-and-ai-workflows-with-aws-lambda-durable-functions/ — HIGH (pattern only)
- LangGraph persistence + interrupt (PostgresSaver, pause/resume, survive restart). https://docs.langchain.com/oss/javascript/langgraph/persistence — HIGH (pattern only; FORBIDDEN to adopt per `CLAUDE.md`)
- Academic phase-enforcement: "Blueprint First, Model Second" (arXiv 2508.02721); "Towards Enforcing Company Policy Adherence in Agentic Workflows" (arXiv 2507.16459); "Structured Lifecycle Control in LLM Coding Agents" (anentrypoint.github.io/gm) — "hooks below the decision layer cannot be bypassed by reasoning." — HIGH
- Competitive: Claude.ai Agent Mode rumored dashboard + ChatGPT canvas + Glean — https://instapods.com/blog/claude-artifacts-vs-chatgpt-canvas/ , https://handyai.substack.com/p/both-claude-and-chatgpt-prepping — MEDIUM (rumor/A-B for Claude Agent Mode; canvas/Glean well-established)

**Substrate (verified by reading the actual code this session):**
- `backend/app/services/tool_dispatcher.py` — `dispatch_tool` `:1495`, `_TOOL_REGISTRY` `:1465`, `ToolContext.available_tools` `:88`, `_handle_task` per-subset refusal precedent `:1090-1110` — HIGH
- `backend/app/services/task_service.py` — per-run `Semaphore(3)` + global Redis Lua-atomic cap (20) `:51-86`, 1-level nesting cap — HIGH
- `backend/app/services/ask_user_service.py` — SUBSCRIBE-before-signal ordering, cross-worker cancel/shutdown sentinels `:18-80` — HIGH
- `backend/app/services/openai_service.py` — `get_tools()` mode-conditional registration site `:768-784` — HIGH

**Planning context:**
- `.planning/PROJECT.md` — v2.8 scope, folded-in seeds, migration head 056+, Plugin Contract → v2.9 — HIGH
- `.planning/PRDs/v2.7.md` §3 Theme B + §5 + §13 — the starting harness design (validated/refined above) — HIGH

---
*Feature research for: agent-workflow harness runtime + dual-mode UX (v2.8)*
*Researched: 2026-05-30*

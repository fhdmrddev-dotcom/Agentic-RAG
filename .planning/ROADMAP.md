# Roadmap: Agentic RAG

## Milestones

- ✅ **v1.0 Knowledge Base Explorer** — Phases 1-8 (shipped 2026-03-29)
- ✅ **v2.0 Agent Skills & Code Execution** — Phases 9-17 (shipped 2026-04-04)
- ✅ **v2.1 Stability & RAG Correctness** — Phases 18-25 (shipped 2026-04-11)
- ✅ **v2.2 Trust & Compliance** — Phases 26-32 (shipped 2026-04-16)
- ✅ **v2.3 Memory, Multimodal & Experience** — Phases 33-43 (shipped 2026-04-19)
- ✅ **v2.4 Stability, Polish & UX Fixes** — Phases 44-57 (shipped 2026-04-30)
- ✅ **v2.5 Deployment Strategy** — Phases 058-067.5 (shipped 2026-05-09)
- ✅ **v2.6 Foundation: RAG Quality + Multi-Worker + Polish** — Phases 068-082 (shipped 2026-05-27)
- ✅ **v2.7 Agent Workspace & Panel** — Phases 083-088 (shipped 2026-05-30)
- 🚧 **v2.8 Harness Engine & Workflow Mode** — Phases 089-096 (in progress, started 2026-05-30)

> **Active milestone:** v2.8 (Harness Engine & Workflow Mode) — 8 phases (089-096), 21 requirements. Deterministic, auditable workflow runtime (locked ordered phases + dispatcher-enforced tool whitelists + validation gates) + Deep/Harness dual-mode, built on v2.7's proven primitives. Plugin Contract deferred to v2.9 (D-v2.8-01).

---

## Active Milestone: v2.8 — Harness Engine & Workflow Mode

**Created:** 2026-05-30
**Granularity:** standard (research-derived A→G build order + 2 polish riders)
**Phase numbering:** continues from v2.7 (last phase 088) → v2.8 starts at **089**
**Coverage:** 21/21 v2.8 requirements mapped (see Traceability in `.planning/REQUIREMENTS.md`)

### Goal

Give the agent a deterministic, auditable workflow runtime — locked ordered phases, dispatcher-enforced per-phase tool whitelists, validation gates between steps, Postgres-resumable phase state — plus a Deep/Harness dual-mode toggle and a live panel phase timeline. Built on v2.7's proven primitives (`tool_dispatcher`, `task`/`ask_user`, run-backed Redis streaming). Deep Mode stays the unchanged default; Harness Mode is strictly opt-in and a no-op when off.

### Build-Order Rationale

The harness is ~80% composition of already-shipped, cross-provider-tested code. The critical path is **089 (extract) → 091 (engine) → 092 (dual-mode) → 094 (panel)**. Schema (090) parallels the extraction. Whitelist enforcement folds into the engine phase (091), not a separate phase, because it shares the `ToolContext` construction site. The verify wave (096) lands last. The two polish riders (PARITY-01 → 093, CHAT-04 → 095) are independent of the harness build and sequence after the extraction so they ride a clean `agent_loop.py` module and avoid colliding with the extraction surface.

**Guardrails in play:**
- **G-5 satisfied by Phase 089** — the `threads.py` agent-loop extraction lands FIRST so the harness sits in a clean `agent_loop.py` module, not bolted onto the 3,186-LOC god file.
- **G-2 fires on Phase 094 (panel phase timeline)** and **Phase 095 (chat tool-card unification)** — both are live UI surfaces; `/gsd:sketch` precedes `/gsd:spec-phase`/`/gsd:plan-phase`. Operator-approved mockup is the acceptance bar.
- **SC#10 4-axis UAT** (cross-provider × multi-tool × parallel-thread × long-message) is baked into the success criteria of every phase that touches streaming / agent loop / provider routing / UI state (089, 091, 092, 093, 094, 095, 096).

### Phases

- [ ] **Phase 089: Agent-Loop Extraction (G-5) + Kickoff UAT** — Behavior-preserving lift of the agent loop from `threads.py` into `agent_loop.py` (byte-identical cross-provider SSE), plus the v2.7 carry-forward UAT sweep.
- [x] **Phase 090: Harness Schema + RLS + Config Models** — Migrations 056+ for workflow definitions/runs/phases/audit, immutable-on-publish trigger, FK-chain RLS, Pydantic phase-config models. ✅ Shipped 2026-05-31 (migrations 056–060 applied live, 8/8 verify blocks PASS, models 8/8 tests).
- [ ] **Phase 091: Harness Engine + 5 Phase Types + Gates + Whitelist** — The milestone core: state-machine engine, 5 phase executors, validation gates with bounded retry, per-phase tool-whitelist enforcement, seed templates, tool-count budget.
- [ ] **Phase 092: Dual-Mode Wiring + Continue Button** — Deep/Harness toggle, per-thread workflow-lock, server-side lock enforcement, Cancel, and the SEED-029 Continue affordance.
- [ ] **Phase 093: Anthropic Cross-Provider Parity** — Evidence-first (LangSmith) summary-tail + iteration-bloat fixes for Anthropic, real task descriptions for non-Anthropic providers; shared-path-safe.
- [ ] **Phase 094: Panel Phase Timeline** — Live phase-timeline section in the v2.7 panel, dedicated `phasesByThread` store (PANEL-06 isolation), WCAG 2.1 AA. (G-2 sketch-first)
- [ ] **Phase 095: Chat Tool-Card Unification** — Chat tool-cards in one consistent frame: auto-scroll, details-on-demand, no duplicates, timer/step-count consistency, working download. (G-2 sketch-first)
- [ ] **Phase 096: Eval Harness + Cross-Provider Verification + Concurrency** — SEED-034 eval CI gate, 4-axis + restart-mid-workflow UAT, `llm_batch_agents` fair-share, resumability verification.

### Phase Details

#### Phase 089: Agent-Loop Extraction (G-5) + Kickoff UAT
**Goal**: The agent loop lives in a clean, shared `agent_loop.py` module with provably byte-identical cross-provider behavior, and the v2.7 carry-forward bugs are verified-closed or re-opened — so the harness can sit on a clean substrate with zero regression risk.
**Depends on**: Nothing (first phase; parallels 090)
**Requirements**: FOUND-03, CF-01
**Success Criteria** (what must be TRUE):
  1. The iteration loop + tool-dispatch block is lifted verbatim from `threads.py` into `app/services/agent_loop.py::run_agent_loop()`; `threads.py` retains only route + producer spawn + `_emit`/`_spawn` + shielded finalize. No "while-I-am-in-here" cleanup.
  2. Every per-provider round-trip invariant is carried forward verbatim and named in VERIFICATION: Anthropic `end_turn`-instead-of-`tool_calls`, Google `thought_signature` echo, DeepSeek `reasoning_content` round-trip, Moonshot empty-content-after-tool-call retry guard, `force_no_tools`-on-last-iteration, iteration-cap silent-drop guard, terminal-status race (`_shielded_finalize`).
  3. The cross-provider eval harness and the Playwright E2E backstop are GREEN **both before AND after** the extraction; the SSE event sequence is byte-identical per provider for a representative multi-tool run (captured snapshot diff = empty).
  4. SC#10 4-axis kickoff UAT passes on the extracted loop: a multi-tool prompt on each native provider, a parallel thread streaming while another accepts a prompt, and a ≥50-message / ≥5 KB long-message thread — exercised in BOTH `agent_mode` values (**General AND Explorer**), no behavior change.
  5. The CF-01 carry-forward sweep dispositions each item: title-gen on DeepSeek/Moonshot/Google (BUG-260527-01), Google secondary-model 404 routing, and the download-link payload — each marked verified-closed or re-opened with a re-open trigger.
**Plans**: 4 plans (3 waves)
- [x] 089-01-PLAN.md — Prep + `agent_loop.py` skeleton (frozen `RunContext` / `AgentLoopResult` + the 3 pure helpers moved verbatim) + **seam-review checkpoint** (autonomous: false — D-089-04)
- [x] 089-02-PLAN.md — Additive proof harness: eval +zhipu/+minimax (native-7, D-089-09) + `capture_run_events`/`normalize` SSE helper + before/after diff runbook
- [x] 089-03-PLAN.md — Verbatim loop move into `run_agent_loop` + seam wiring + ~37 monkeypatch-target sweep + `AgentLoopResult` seam test (depends 089-01)
- [x] 089-04-PLAN.md — I1–I14 named VERIFICATION + AFTER SSE-diff/eval (operator-run) + 4-axis UAT (both modes) + CF-01 C1/C2/C3 dispositions (autonomous: false; depends 089-02, 089-03)
**Notes**: G-5 satisfied here (`threads.py` hot-file extraction). The agent loop being lifted serves BOTH General and Explorer `agent_mode` (Explorer = 6 KB tools + dedicated prompt + `max_iterations=8`); the extraction MUST preserve the Explorer branch byte-identically (its tool-set, prompt, and iteration cap), and SC#4's kickoff UAT verifies it. SEED-037 download wire-up ships separately as a standalone `/gsd:quick` and is NOT a roadmap requirement. **Native-7** (D-089-05: +zhipu/GLM +minimax) is the hard pass/fail bar across the matrix — corrects the ROADMAP/REQUIREMENTS "6 native providers" wording for all of v2.8; OpenRouter best-effort, Ollama opportunistic.

#### Phase 090: Harness Schema + RLS + Config Models
**Goal**: The Postgres substrate for workflows exists — versioned immutable-on-publish definitions, run/phase tables, an audit trail — all RLS-scoped via the proven FK chain, with typed Pydantic models that parse the phase-config JSONB.
**Depends on**: Nothing (parallels 089 — pure schema, no runtime dependency on the extraction)
**Requirements**: HARNESS-02, HARNESS-06
**Success Criteria** (what must be TRUE):
  1. Migrations (renumbered from the real head **056+**, NOT the PRD's stale 125-139) create `workflow_definitions`, `workflow_runs`, `workflow_phases`, `threads.active_workflow_run_id`, and `harness_audit`; applied via the Supabase SQL editor and `full-schema.sql` regenerated.
  2. `workflow_definitions` is immutable-on-publish: a `UNIQUE(slug, version)` constraint + a `BEFORE UPDATE` trigger (mirroring `017_skills.sql`) + FK `ON DELETE RESTRICT` — an integration test that publishes then UPDATEs a published version is REFUSED, and DELETE of a referenced version is refused.
  3. Cross-user reads of `workflow_runs`, `workflow_phases`, and `harness_audit` are denied by RLS (FK chain through `threads.user_id`, exact pattern from migrations 054/055); `harness_audit` is INSERT-only like `audit_log`.
  4. The proposed `threads.deep_mode_metadata jsonb` column is NOT created (dropped per research delta #4 — no consumer in v2.8 scope); every table carries `org_id uuid NULL` for forward-compat but RLS predicates stay user-scoped.
  5. `app/models/harness.py` Pydantic models (`PhaseConfig` discriminated union over the 5 phase types, `ValidatorSpec`, `WorkflowDefinition`) parse a seed workflow's `phases` JSONB via `model_validate()` and reject a malformed config with a structured error.
**Plans**: 3 plans (2 waves)
- [ ] 090-01-PLAN.md — Pydantic harness config models (`harness.py`, extra=forbid discriminated union) + pure-Python model unit test (SC#5/D-07) + `verify_090.sql` live-DB gate script [Wave 1]
- [ ] 090-02-PLAN.md — Author migrations 056-059 (workflow_definitions+immutable trigger+UNIQUE+owner/global RLS w/ is_global=false INSERT guard; workflow_runs RESTRICT FK+1-hop RLS; workflow_phases 2-hop RLS; harness_audit INSERT-only + threads.active_workflow_run_id) [Wave 1]
- [ ] 090-03-PLAN.md — [BLOCKING autonomous:false] manual SQL-editor apply 056→059 + regenerate full-schema.sql + run verify_090.sql live-DB gate (SC#1/#2/#3/#4 + HARNESS-06) [Wave 2]

#### Phase 091: Harness Engine + 5 Phase Types + Gates + Whitelist
**Goal**: A user can run an agent through an ordered, locked workflow the LLM cannot escape — 5 phase types execute end-to-end, validation gates pass/fail with bounded retry, per-phase tool whitelists are enforced at the dispatcher, and phase state is durably resumable.
**Depends on**: Phase 089 (clean `run_agent_loop`), Phase 090 (tables + models)
**Requirements**: HARNESS-01, HARNESS-03, HARNESS-04, HARNESS-05, HARNESS-07, TOOL-05
**Success Criteria** (what must be TRUE):
  1. A user starts a published workflow and the backend drives transitions through all 5 phase types — `programmatic`, `llm_single`, `llm_agent`, `llm_batch_agents`, `llm_human_input` — where the LLM cannot reorder or skip phases (each type wired to its existing substrate: `PROGRAMMATIC_PHASE_REGISTRY`, `_stream_one_iteration`, `run_task_sub_agent`, `ask_user_service`).
  2. A tool call outside the current phase's whitelist is refused with a clean `tool_result` (matching `tool_call_id`) on all 6 native providers — no crash, no provider 400; the guard is an additive no-op in `dispatch_tool()` (below all provider-specific streaming code) and is byte-identical to today when no workflow is active (Deep Mode untouched).
  3. A deterministically-failing validation gate (`json_schema`/`regex_match`/`workspace_file_exists`/`programmatic`) reaches `failed` after `max_retries=2` (3 total attempts), never loops forever; a consecutive-identical-output short-circuit fails fast; the validator error is fed back into the retry prompt.
  4. A workflow run is resumable: phase state persists via a strict 2-phase write (mark `active` before work, `completed` only after output is durable); a phase left `active` by a worker restart re-runs from the top, and a mid-`ask_user` pause re-subscribes AND re-emits its pending prompt on the startup sweep.
  5. Every phase has both a step cap AND a wall-clock cap (`asyncio.wait_for`) enforced by the backend; a hanging `programmatic` or never-terminating `llm_agent` phase fails cleanly at its timeout and drives `on_failure`; publish-time reachability lint rejects an unsatisfiable phase.
  6. 2–3 seed workflow templates (e.g. Research→Summarize, Plan→Execute→Verify) ship and run end-to-end as UAT fixtures; the tool-count budget guard (TOOL-05) caps the schema list at the `get_tools()` composition site with a per-provider `max_tools` soft ceiling in `MODEL_CAPABILITIES`.
**Plans**: 7 plans (2-3 tasks each), 5 waves
- [x] 091-01-PLAN.md — Finalize harness.py models + Wave-0 test scaffold & shared fixtures (wave 1)
- [x] 091-02-PLAN.md — Engine core: run_workflow loop + 2-phase write + db/workflows.py + reachability lint (wave 2) ✅ 2026-05-31
- [x] 091-06-PLAN.md — Whitelist guard at dispatch_tool + get_tools budget + max_tools (wave 2) ✅ 2026-05-31
- [x] 091-03-PLAN.md — 5 phase-type executors wired to substrate + system_prompt_override (wave 3) ✅ 2026-05-31
- [x] 091-05-PLAN.md — Validation gates (4 kinds) + bounded retry + on_failure + caps (wave 3) ✅ 2026-05-31
- [x] 091-04-PLAN.md — Resumability: startup sweep + claim + ask_user re-subscribe (wave 4) ✅ 2026-05-31
- [x] 091-07-PLAN.md — 4 seed templates (migration 061) + end-to-end + operator apply (wave 5) ✅ 2026-05-31
- [x] 091-08-PLAN.md — Gap closure for 091-REVIEW (CR-01 claim CAS lease/migration 062 + CR-02 inline large output + WR-03/04/05/06 + IN-01) (wave 6) ✅ 2026-05-31

**Notes**: Phase D (whitelist enforcement) folds in here — it shares the `ToolContext` construction site; do NOT split it out. Every workflow SSE event rides the existing `run:{run_id}` stream via `_emit` (zero new Redis namespace). All harness logic lives ABOVE the loop or at the single `dispatch_tool` entry — never in provider-specific streaming branches (075.x cascade prevention).

#### Phase 092: Dual-Mode Wiring + Continue Button
**Goal**: A user can switch a thread between Deep Mode (default) and Harness Mode (locked workflow), the lock is per-thread and server-enforced, Cancel cleanly exits, and hitting a step cap surfaces a Continue affordance instead of silently dropping tool calls.
**Depends on**: Phase 091 (the engine to branch to)
**Requirements**: MODE-01, MODE-02, CONT-01
**Success Criteria** (what must be TRUE):
  1. Mode is per-thread via `threads.active_workflow_run_id` (NULL = Deep, non-null = Harness + locked); `agent_runner` branches on it; a mode switch takes effect only on the NEXT run and never mutates an in-flight stream.
  2. Once a workflow starts the thread is workflow-locked: Harness→Deep is refused server-side (at run creation, not just a grayed button) until the run reaches a terminal status or the user cancels; Cancel clears `active_workflow_run_id` in the SAME transaction as the terminal-status write (no dangling lock).
  3. The lock state is per-thread keyed (a `Map`/`Set`, never a global boolean — BUG-260523-01 pattern): SC#10 parallel-thread UAT confirms Thread A streaming a workflow does NOT lock Thread B's mode toggle or composer.
  4. When a run hits its step cap (a Deep run OR a Harness phase), a Continue affordance resumes the SAME run/phase with a bounded additional step budget — re-reading `workflow_phases.available_tools` from Postgres for a Harness phase — and consumes the previously-dropped tool calls rather than re-dropping them; it never blindly bumps a global cap unbounded.
  5. The panel reconciles true mode/lock state via `GET /threads/{id}/workflow` on mount (D-v2.5-03), never trusting a Realtime/SSE hint alone; a thread is never stuck Harness-locked with a terminal/absent run.
**Plans**: 4 plans
Plans:
- [x] 092-01-PLAN.md — Migration 063 (inputs/model/continues_used + cap_paused) + Wave-0 test scaffolds + operator SQL-editor apply (wave 1) ✅ 2026-05-31
- [ ] 092-02-PLAN.md — Backend MODE-01/02: create_workflow_run atomic txn + producer mode-branch + server-side lock + GET /threads/{id}/workflow + published-workflows list (wave 2)
- [ ] 092-03-PLAN.md — Backend MODE-02 cancel/terminal lock-clear + CONT-01: persist-at-cap (consume not drop) + POST /runs/{id}/continue + 3-cap (wave 3)
- [ ] 092-04-PLAN.md — Frontend: Deep/Harness toggle + picker + per-thread keyed lock + inline Continue card + mount reconcile + Chrome MCP 4-axis UAT (wave 4)
**Notes**: Deep/Harness is ORTHOGONAL to the existing `agent_mode` (General/Explorer) — Deep Mode is keyed on `active_workflow_run_id IS NULL` and is the umbrella for "not in a workflow," covering BOTH General and Explorer unchanged; the per-phase whitelist (091) is a no-op in Deep Mode so Explorer's tool-set is untouched when no workflow runs. **Discuss-phase decision:** the General/Explorer selector's behavior DURING an active workflow (stays visible / disabled / hidden until the run completes) — a workflow's phase whitelist is authoritative while active, so the selector is moot mid-run; pick the least-confusing affordance. No conflict; this is a UX-composition call, not an architectural one.

#### Phase 093: Anthropic Cross-Provider Parity
**Goal**: Anthropic reaches cross-provider parity on multi-step tasks — a synthesized summary tail instead of a raw action-log, reduced iteration bloat — and non-Anthropic providers show real task descriptions; all evidence-driven and shared-path-safe.
**Depends on**: Phase 089 (rides the clean `agent_loop.py` and shares the agent-loop/provider surface)
**Requirements**: PARITY-01
**Success Criteria** (what must be TRUE):
  1. On a multi-step Anthropic task, the final assistant message is a synthesized summary tail (not a raw action-log dump) — verified against a LangSmith trace before/after, closing BUG-260514-02.
  2. Anthropic iteration count on a representative multi-tool task is measurably reduced vs the pre-fix baseline (LangSmith evidence), closing BUG-260523-04, with no increase in task failure rate.
  3. Non-Anthropic providers show real task descriptions in tool cards (not the generic "Generating code"), closing BUG-260528-03.
  4. The fix is provider-scoped at the service boundary or purely additive — no shared-path edits (threads.py chunk handler, SSE emitter) — and SC#10 cross-provider UAT confirms zero regression on OpenAI, Google, DeepSeek, Moonshot, and OpenRouter.
**Plans**: TBD
**Notes**: Evidence-first — every claim backed by a LangSmith trace, not assumption. Sequenced after the extraction so it operates on the clean module.

#### Phase 094: Panel Phase Timeline
**Goal**: The workspace panel shows a live, accessible phase timeline that auto-opens on entering Harness Mode, reflects current/locked/completed phases and gate results, and triggers zero chat re-renders.
**Depends on**: Phase 091 / Phase 092 (events to render)
**Requirements**: PANEL-08, PANEL-09, A11Y-03
**Success Criteria** (what must be TRUE):
  1. Entering Harness Mode auto-opens the panel to a phase timeline showing current / locked / completed glyphs, gate pass/fail badges, and a transition log; the timeline reconciles via `GET /threads/{id}/workflow` fetch on mount.
  2. Workflow phase events ride the existing `run:{run_id}` stream and demux into a dedicated `phasesByThread` store; a panel phase update triggers ZERO chat message-list re-renders (PANEL-06 isolation preserved — chat selectors never read `phasesByThread`).
  3. A refused tool call renders as an expected, styled "phase guard" event (not an error/crash), and a stalled phase shows a visible "running… Ns" → explicit `failed` state rather than freezing silently.
  4. The phase timeline meets WCAG 2.1 AA: keyboard-navigable, ARIA landmarks/labels, non-color-only status indicators, ≥4.5:1 contrast in both themes — vitest-axe gated and real-contrast verified (Chrome MCP/Lighthouse) in both themes.
  5. SC#10 UI-state UAT passes: the timeline renders correctly across collapse states, both themes, multiple threads, and mobile; a parallel thread streaming does not corrupt this thread's timeline.
**Plans**: TBD
**UI hint**: yes
**Notes**: **G-2 FIRES** — `/gsd:sketch` precedes `/gsd:spec-phase`/`/gsd:plan-phase`. Operator-approved mockup is the acceptance bar. Purely additive to the v2.7 panel architecture.

#### Phase 095: Chat Tool-Card Unification
**Goal**: Chat tool-cards render in one consistent frame with auto-scroll, details-on-demand collapse, no duplicates, consistent timer/step-count, and a working download — closing the felt-experience defects in the chat execution surface.
**Depends on**: Phase 089 (sequenced after the extraction; touches the frontend chat-surface hot files ToolCallPanel/MessageItem/StreamsProvider, distinct from the backend `threads.py` extraction)
**Requirements**: CHAT-04
**Success Criteria** (what must be TRUE):
  1. Tool-cards render in one consistent frame with auto-scroll and details-on-demand collapse; no duplicate cards appear on any provider (closing BUG-260529-02).
  2. The run timer stays visible for the full duration of long runs (closing `timer-disappears-long-runs`) and the step count matches between the timer and the panel (closing `step-count-mismatch-timer-vs-panel`).
  3. The output-file download link works end-to-end (no dead link), and SC#10 cross-provider UAT confirms the unified frame behaves identically across all 6 native providers and survives a parallel-thread + long-message scenario.
  4. The change is contained to the frontend chat surface and does not regress the panel's PANEL-06 isolation or the StreamsProvider demux.
**Plans**: TBD
**UI hint**: yes
**Notes**: **G-2 FIRES** — `/gsd:sketch` precedes `/gsd:spec-phase`/`/gsd:plan-phase`. Touches hot-file-ledger files (ToolCallPanel, MessageItem, StreamsProvider) — those rows show G-5 satisfied as of 075.7, but confirm during discuss-phase.

#### Phase 096: Eval Harness + Cross-Provider Verification + Concurrency
**Goal**: The harness is proven trustworthy across all 6 native providers, survives restarts mid-workflow, and batch phases don't starve the app — wired as a standing CI regression gate so future work can't silently break it.
**Depends on**: Phase 091, 092, 094 (all harness features must exist), Phase 093 (parity fixes verified)
**Requirements**: EVAL-01, EVAL-02, CONC-01
**Success Criteria** (what must be TRUE):
  1. `scripts/eval_cross_provider.py` runs a multi-phase workflow on all 6 native providers, asserts the locked phase sequence completes with correct tool round-trips, and is wired as the CI regression gate (SEED-034); the provider model list gets a curation pass to current IDs.
  2. The harness passes the 4-axis UAT scoreboard (cross-provider × multi-tool × parallel-thread × long-message) PLUS a uvicorn-restart-mid-workflow smoke per phase type — including mid-`ask_user`, where after restart the prompt re-renders in the panel AND the user's POST response reaches the engine.
  3. `llm_batch_agents` fan-out is bounded by `max_parallel_agents` (default 5) composing with the global Redis-Lua cap (20); N=10 fans out at ≤5 concurrent and a batch phase does not starve app-wide request latency (cross-tab GET stays <50ms); the live AnyIO threadpool budget is verified before sizing defaults (SEED-036a).
  4. HARNESS-03 resumability is independently verified: kill-and-resume at mid-`programmatic`, mid-`llm_agent`, and mid-`ask_user` produces no skipped phases and no double-applied side effects.
  5. The thread-switch connection-saturation hang (BUG-260530-01) is fixed: with ≥6 concurrent active runs streaming, switching threads reconciles in <1s (no 15-30s stall). Fix is **frontend stream-cap** — only the viewed thread (plus a small bounded pool) holds a live `fetch` stream; background runs reconcile via `GET /threads/{id}/snapshot` on return (D-v2.5-03). Preserves PANEL-06 isolation + per-thread demux; carries the SC#10 4-axis parallel-thread UAT (StreamsProvider is a G-5 hot file).
**Plans**: TBD
**Notes**: CONC-01 covers BOTH backend fan-out fairness (`llm_batch_agents`) AND the frontend stream-connection saturation (BUG-260530-01) — same parallel-thread responsiveness guarantee. The frontend cap-live-streams fix lands here because Phase 094's panel timeline rides the same `run:{run_id}` stream and must not be throttled by held-open background streams. Operator-chosen approach 2026-05-30 (rejected: single multiplexed transport, HTTP/2 serving).

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 089. Agent-Loop Extraction (G-5) + Kickoff UAT | 4/4 | Complete    | 2026-05-30 |
| 090. Harness Schema + RLS + Config Models | 0/0 | Not started | - |
| 091. Harness Engine + 5 Phase Types + Gates + Whitelist | 8/8 | Complete    | 2026-05-31 |
| 092. Dual-Mode Wiring + Continue Button | 1/4 | In progress | - |
| 093. Anthropic Cross-Provider Parity | 0/0 | Not started | - |
| 094. Panel Phase Timeline | 0/0 | Not started | - |
| 095. Chat Tool-Card Unification | 0/0 | Not started | - |
| 096. Eval Harness + Cross-Provider Verification + Concurrency | 0/0 | Not started | - |

---

## Shipped Milestones

<details>
<summary>v1.0 Knowledge Base Explorer (Phases 1-8) -- SHIPPED 2026-03-29</summary>

- [X] Phase 1: Folder Schema & Core APIs (2/2 plans) -- completed 2026-03-21
- [X] Phase 2: Document-Folder Integration (2/2 plans) -- completed 2026-03-21
- [X] Phase 3: Ingestion UI (3/3 plans) -- completed 2026-03-21
- [X] Phase 4: Navigation Tools (2/2 plans) -- completed 2026-03-22
- [X] Phase 5: Search Tools (2/2 plans) -- completed 2026-03-21
- [X] Phase 6: Read Tool (2/2 plans) -- completed 2026-03-22
- [X] Phase 7: Explorer Sub-Agent (2/2 plans) -- completed 2026-03-22
- [X] Phase 8: Folder System Enhancements (3/3 plans) -- completed 2026-03-28

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>v2.0 Agent Skills & Code Execution (Phases 9-17) -- SHIPPED 2026-04-04</summary>

Full details: `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>v2.1 Stability & RAG Correctness (Phases 18-25) -- SHIPPED 2026-04-11</summary>

Full details: `.planning/milestones/v2.1-ROADMAP.md`

</details>

<details>
<summary>v2.2 Trust & Compliance (Phases 26-32) -- SHIPPED 2026-04-16</summary>

Full details: `.planning/milestones/v2.2-ROADMAP.md`

</details>

<details>
<summary>v2.3 Memory, Multimodal & Experience (Phases 33-43) -- SHIPPED 2026-04-19</summary>

Full details: `.planning/milestones/v2.3-ROADMAP.md`

</details>

<details>
<summary>v2.4 Stability, Polish & UX Fixes (Phases 44-57) -- SHIPPED 2026-04-30</summary>

Full details: `.planning/milestones/v2.4-ROADMAP.md`

</details>

<details>
<summary>v2.5 Deployment Strategy (Phases 058-067.5) -- SHIPPED 2026-05-09</summary>

Full details: `.planning/milestones/v2.5-ROADMAP.md`

</details>

<details>
<summary>v2.6 Foundation: RAG Quality + Multi-Worker + Polish (Phases 068-082) -- SHIPPED 2026-05-27</summary>

35 phases (068-082 including inserts), 91 plans complete. See `.planning/milestones/v2.6-phases/` for archived phase directories and `.planning/MILESTONES.md` for the full close-out narrative.

</details>

<details>
<summary>v2.7 Agent Workspace & Panel (Phases 083-088) -- SHIPPED 2026-05-30</summary>

6 phases (083-088), 28 plans, 50 tasks complete. Per-thread workspace filesystem (write/read/list/delete/version/diff, hybrid inline/Storage), 3 new agent tools (`write_todos`, `task` sub-agents, `ask_user` pause/resume via Redis pub/sub), the right-side collapsible workspace panel (todos · file browser · version diff · ask_user seam), and WCAG 2.1 AA across all panel surfaces. Full phase details: `.planning/milestones/v2.7-ROADMAP.md`. Close-out narrative + decisions: `.planning/MILESTONES.md`.

- [x] Phase 083: Foundation -- Tool-Dispatch Extraction + Bug Fixes (3/3 plans) -- completed 2026-05-27
- [x] Phase 084: Workspace Filesystem Backend (5/5 plans) -- completed 2026-05-28
- [x] Phase 085: New LLM Tools (5/5 plans) -- completed 2026-05-28
- [x] Phase 086: StreamsProvider Extension + Panel Hooks (2/2 plans) -- completed 2026-05-29
- [x] Phase 087: Panel UI (8/8 plans) -- completed 2026-05-29
- [x] Phase 088: Cross-Cutting Verification + Accessibility (5/5 plans) -- completed 2026-05-30

</details>

---

*Milestones v1.0–v2.7 shipped and archived under `.planning/milestones/`. v2.8 (Harness Engine & Workflow Mode) is the active milestone — 8 phases (089-096). Begin with `/gsd:discuss-phase 089` or `/gsd:plan-phase 089`.*

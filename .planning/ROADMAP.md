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

> **Active milestone:** v2.8 (Harness Engine & Workflow Mode) — 9 phases (089-096 + the NEW 092.5 Provider Gateway Extraction), 22 active requirements (+1 re-deferred: PARITY-01). Deterministic, auditable workflow runtime (locked ordered phases + dispatcher-enforced tool whitelists + validation gates) + Deep/Harness dual-mode, built on v2.7's proven primitives. Plugin Contract deferred to v2.9 (D-v2.8-01). **Rescoped 2026-06-01 (discuss-093):** the harness only worked on OpenAI → 092.5 gateway + rescoped 093 (harness cross-provider hardening) + expanded 094 (legibility). See REQUIREMENTS Traceability + 092-COMPREHENSIVE-AUDIT.md.

---

## Active Milestone: v2.8 — Harness Engine & Workflow Mode

**Created:** 2026-05-30
**Granularity:** standard (research-derived A→G build order + 2 polish riders)
**Phase numbering:** continues from v2.7 (last phase 088) → v2.8 starts at **089**
**Coverage:** 22/22 active v2.8 requirements mapped (+1 re-deferred: PARITY-01) — rescoped 2026-06-01 (discuss-093); see Traceability in `.planning/REQUIREMENTS.md`

### Goal

Give the agent a deterministic, auditable workflow runtime — locked ordered phases, dispatcher-enforced per-phase tool whitelists, validation gates between steps, Postgres-resumable phase state — plus a Deep/Harness dual-mode toggle and a live panel phase timeline. Built on v2.7's proven primitives (`tool_dispatcher`, `task`/`ask_user`, run-backed Redis streaming). Deep Mode stays the unchanged default; Harness Mode is strictly opt-in and a no-op when off.

### Build-Order Rationale

The harness is ~80% composition of already-shipped, cross-provider-tested code. The critical path is **089 (extract) → 091 (engine) → 092 (dual-mode) → 094 (panel)**. Schema (090) parallels the extraction. Whitelist enforcement folds into the engine phase (091), not a separate phase, because it shares the `ToolContext` construction site. The verify wave (096) lands last. **Rescope 2026-06-01 (discuss-093):** live operator UAT (092-07) + a 092 comprehensive audit + a live-code verification sweep proved the harness only works on OpenAI (1 of 4 seed workflows, 1 of 7 providers) — a harness-substrate problem, not a Deep problem (Deep is provider-robust on all 7). So the real critical path is now **089 → 091 → 092 → 092.5 (provider gateway extraction) → 093 (harness cross-provider + phase-type hardening) → 094 (legibility + mode clarity)**. **PARITY-01** (the Deep-mode Anthropic summary/iteration/tool-card polish) is **re-deferred** — not reproducing for the operator, not worth a shared-path risk. **CHAT-04 → 095** stays an independent rider after the extraction. (The original wording had PARITY-01 → 093 as a polish rider; that's superseded.)

**Guardrails in play:**
- **G-5 satisfied by Phase 089** — the `threads.py` agent-loop extraction lands FIRST so the harness sits in a clean `agent_loop.py` module, not bolted onto the 3,186-LOC god file.
- **G-2 fires on Phase 094 (panel phase timeline)** and **Phase 095 (chat tool-card unification)** — both are live UI surfaces; `/gsd:sketch` precedes `/gsd:spec-phase`/`/gsd:plan-phase`. Operator-approved mockup is the acceptance bar.
- **SC#10 4-axis UAT** (cross-provider × multi-tool × parallel-thread × long-message) is baked into the success criteria of every phase that touches streaming / agent loop / provider routing / UI state (089, 091, 092, 093, 094, 095, 096).

### Phases

- [x] **Phase 089: Agent-Loop Extraction (G-5) + Kickoff UAT** — Behavior-preserving lift of the agent loop from `threads.py` into `agent_loop.py` (byte-identical cross-provider SSE), plus the v2.7 carry-forward UAT sweep. ✅ Shipped 2026-05-30 (byte-identical via structural-skeleton SSE proof; GLM/MiniMax fixed to INT'L endpoints + 14 models registered).
- [x] **Phase 090: Harness Schema + RLS + Config Models** — Migrations 056+ for workflow definitions/runs/phases/audit, immutable-on-publish trigger, FK-chain RLS, Pydantic phase-config models. ✅ Shipped 2026-05-31 (migrations 056–060 applied live, 8/8 verify blocks PASS, models 8/8 tests).
- [x] **Phase 091: Harness Engine + 5 Phase Types + Gates + Whitelist** — The milestone core: state-machine engine, 5 phase executors, validation gates with bounded retry, per-phase tool-whitelist enforcement, seed templates, tool-count budget. ✅ Shipped 2026-05-31 (8 plans; 95/95 harness tests; code review caught 2 criticals tests missed → gap-plan 091-08 + migration 062).
- [x] **Phase 092: Dual-Mode Wiring + Continue Button** — Deep/Harness toggle, per-thread workflow-lock, server-side lock enforcement, Cancel, and the SEED-029 Continue affordance. ✅ Closed 2026-06-01 (passed_with_overrides): 7 plans (4 + 3 gap-closure); MODE-01/MODE-02/CONT-01 Validated; F1–F8 closed, Harness runs end-to-end on OpenAI. F9 (cross-provider) + F10 (ask_user) → Phase 093.
- [x] **Phase 092.5: Provider Gateway Extraction (refactor — ships before 093)** — Extract `agent_loop.py`'s per-provider dispatch + chunk-normalization into ONE shared provider-boundary module that Deep AND the harness consume. Deep verified byte-identical in isolation (089-style); one home for all provider logic. ✅ Closed 2026-06-02 (passed_with_overrides; Deep byte-identical native-7; GATEWAY-01 Validated).
- [x] **Phase 093: Harness Cross-Provider Parity + Phase-Type Hardening** — The harness CONSUMES the gateway → native-7 parity; one shared model-resolver (resolve, don't mutate); ask_user round-trip fixed; the 3 never-run phase-types completed + the 5 phase-types hardened safe-by-construction; resume/Continue answer surfacing + draft plumbing. ✅ Closed 2026-06-03 (passed_with_overrides; D-21 native-7 live re-UAT 8/8; PARITY-02 Validated).
- [x] **Phase 094: Workflow Legibility + Mode Clarity** — Live phase-timeline + RunCard-for-harness in the v2.7 panel (dedicated `phasesByThread` store, PANEL-06 isolation, WCAG 2.1 AA) + failure-honesty + mode disambiguation (D-092-UX). ✅ Shipped 2026-06-04 (all 5 plans; phase-timeline + RC-4 failure honesty + server-truth mode label).
- [x] **Phase 095: Chat Tool-Card Unification** — Chat tool-cards in one consistent frame: auto-scroll, details-on-demand, no duplicates, timer/step-count consistency, working download. ✅ Closed 2026-06-06 (5 plans + gap-closure 06-09 + WR-01 code-review fix; 3 operator gaps verified FIXED live via Chrome-MCP).
- [x] **Phase 095.1: Cross-Provider Run Honesty & Workspace Parity (ships before 096)** — Deterministic, provider-independent workspace todos/tasks panel (spike-006/007 VALIDATED: smart-gate + activity-derivation, no `write_todos` dependence, never forced) + 5 run-honesty/parity fixes surfaced by 095 live UAT: Google 429-not-billing (classify at the gateway boundary per provider), Resume-after-success suppression, reload-timer honesty, model attribution ("generated by {provider} {model}"), flat "Generated files" list (drop the hero crown). Verified live across all 8 providers. (NEW — born from 095 cross-provider UAT 2026-06-06)
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
**Plans**: 6 plans (4 + 2 gap-closure for the Wave 4 UAT F1/F2/F3 findings) (3 waves)
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
**Plans**: 7 plans (4 + 3 gap-closure: F1/F2 → 092-05, F3 → 092-06, F4 → 092-07 from successive UAT findings)
Plans:
- [x] 092-01-PLAN.md — Migration 063 (inputs/model/continues_used + cap_paused) + Wave-0 test scaffolds + operator SQL-editor apply (wave 1) ✅ 2026-05-31
- [x] 092-02-PLAN.md — Backend MODE-01/02: create_workflow_run atomic txn + producer mode-branch + server-side lock + GET /threads/{id}/workflow + published-workflows list (wave 2) ✅ 2026-05-31
- [x] 092-03-PLAN.md — Backend MODE-02 cancel/terminal lock-clear + CONT-01: persist-at-cap (consume not drop) + POST /runs/{id}/continue + 3-cap (wave 3) ✅ 2026-05-31
- [x] 092-04-PLAN.md — Frontend: Deep/Harness toggle + picker + per-thread keyed lock + inline Continue card + mount reconcile (Tasks 1-3) ✅ 2026-05-31; Task 4 Chrome MCP UAT FAILED → gap-closure 092-05/06
- [x] 092-05-PLAN.md — Gap-closure (F1+F2): migration 064 workflow_runs.user_id + write_audit/create_workflow_run/harness_engine user_id threading + failure-path terminalize + lock_is_stale self-heal + live-DB audit test (wave 1) ✅ 2026-05-31
- [x] 092-06-PLAN.md — Gap-closure (F3) code-complete (disable-while-locked textarea/Send + 409 rollback + lock seed-at-kickoff/reconcile; commits 3b21f230 + 4546b5bb, tsc+build clean). Task 3 UAT = gaps_found: F1/F2 VERIFIED CLOSED live + SC#2 PASS (failure path), but NEW blocker F4 (harness sub-agent runs_parent_run_id_fkey) blocks end-to-end workflow → SC#3/5 + CONT-01 + SC#10 native-7 + Deep byte-identical BLOCKED. Phase NOT complete; routed to 092-07 (wave 2) ⚠️ 2026-05-31
- [x] 092-07-PLAN.md — Gap-closure (F4): Tasks 1-5 (code + tests) ✅ DONE 2026-05-31 + Task 6 (binding UAT gate) ✅ resolved by operator close decision 2026-06-01 → **passed_with_overrides**. One id-routing fix family across 3 facets — A) sub-agent `parent_run_id` FK: `producer_run_id` on the engine ctx + fail-closed guard (commit fa14a1c3); B) SSE routing: `stream_run_id` threaded through `run_workflow` + `_run_phase_with_gates` → all 9 `_emit`s + the `ask_user_prompt` transport reach the watched producer stream, write_audit stays workflow-run-keyed (commit ca0ee5c5); C) resume: BOTH resume ctx sites mint + terminalize a NON-NULL producer `runs` row (commit 0f6a66df) + Continue-404 owner-scoped repair + `latest_producer_run_id` pure-read surfacing + frontend re-subscribe both paths (commit cdd775f6); + live-DB FK regression test (commit ec9dd4f4, 4 green vs PG :54322). The unblocked F5/F6/F7/F8 dominoes also closed (a7be6423/803aafd3/ba5949c4/95da3032) → a Harness workflow runs end-to-end + renders a grounded sources+confidence answer (live, OpenAI). Additive + harness-scoped; Deep byte-identical; get_thread_workflow stays a PURE READ; backend full-suite ZERO net-new failures vs 092-03 baseline; frontend tsc -b = 54 baseline (0 net-new) + vite build clean. **F9 (cross-provider harness parity) + F10 (ask_user round-trip) → Phase 093** (operator directive, 092-07-UAT-FINDINGS UPDATE 5). MODE-01/02 + CONT-01 = Validated. See 092-VERIFICATION.md.
**Notes**: Deep/Harness is ORTHOGONAL to the existing `agent_mode` (General/Explorer) — Deep Mode is keyed on `active_workflow_run_id IS NULL` and is the umbrella for "not in a workflow," covering BOTH General and Explorer unchanged; the per-phase whitelist (091) is a no-op in Deep Mode so Explorer's tool-set is untouched when no workflow runs. **Discuss-phase decision:** the General/Explorer selector's behavior DURING an active workflow (stays visible / disabled / hidden until the run completes) — a workflow's phase whitelist is authoritative while active, so the selector is moot mid-run; pick the least-confusing affordance. No conflict; this is a UX-composition call, not an architectural one.

#### Phase 092.5: Provider Gateway Extraction (NEW — refactor pre-step, ships before 093)
**Goal**: `agent_loop.py`'s per-provider dispatch + chunk-normalization lives in ONE shared provider-boundary module ("provider gateway") that Deep AND the harness consume — Deep verified byte-identical in isolation — so there is a single home for all provider logic and the harness can reach parity by *consuming* it, not re-implementing it.
**Depends on**: Phase 089 (the clean `agent_loop.py` to extract from)
**Requirements**: GATEWAY-01
**Success Criteria** (what must be TRUE):
  1. The 3 per-provider branches (Anthropic native `stream_anthropic`, Google native `stream_google`, OpenAI-compat `create_adaptive_streaming_chat` + STRUCTURED-mode `parse_structured_tool_calls`) + the 3 chunk-normalizers are extracted into a shared module/adapter; the Deep agent loop consumes it and is BYTE-IDENTICAL (eval + E2E + SSE-diff GREEN before AND after — the 089 proof method).
  2. Every per-provider round-trip invariant is preserved verbatim and named in VERIFICATION: Anthropic `end_turn` tool execution, Google `thought_signature` echo, DeepSeek `reasoning_content` round-trip, Moonshot/Kimi `<think>`-strip + empty-retry, `force_no_tools`-on-last-iteration, iteration cap.
  3. The module exposes a seam the harness sub-agent loop can consume without re-deriving provider logic (the contract Phase 093 builds on); no threads.py↔gateway import cycle (preserve the callable-injection seam).
**Plans**: 6 plans (5 waves) — clean-providers-first then OpenAI-isolated, two operator byte-identical gates
- [x] 092.5-01-PLAN.md — Gateway scaffold: events.py canonical schema + dispatcher open_stream + D-08 seam-test scaffold (RED) [Wave 1, autonomous] ✅ 2026-06-01
- [x] 092.5-02-PLAN.md — Operator captures native-7 BEFORE baselines against the pre-extraction loop (the byte-identical reference) [Wave 1, autonomous:false] ✅ 2026-06-01 (8/8 SSE baselines `BASELINE CAPTURED` + eval reference)
- [x] 092.5-03-PLAN.md — Extract clean providers (Anthropic+Google adapters) + wire agent_loop + collapse 2 _on_chunk into 1 + stream_* monkeypatch repoint [Wave 2, autonomous] ✅ 2026-06-01 (adapters return bare SYNC gen verbatim; ONE merged gateway branch + ONE shared _on_chunk; I2 preserved consumer-side + asserted; seam Anthropic/Google GREEN; full suite ZERO net-new failures vs Plan-02 baseline)
- [x] 092.5-04-PLAN.md — Operator byte-identical gate #1: --mode after native-7 + eval + E2E after clean providers [Wave 3, autonomous:false]
- [x] 092.5-05-PLAN.md — Extract the entangled OpenAI-compat adapter (<think>/reasoning/usage/5KB boundary) verbatim + fold 3rd _on_chunk + repoint create_adaptive/_accumulate sweep [Wave 4, autonomous]
- [x] 092.5-06-PLAN.md — Operator byte-identical gate #2: --mode after FULL native-7 + I1-I8 named in VERIFICATION + eval + E2E [Wave 5, autonomous:false]
**Notes**: G-1/G-5 by SPIRIT, not by the literal ledger (counts are 2–3, not ≥3 prior) — chosen because a 2nd OpenAI-shaped accumulator already exists (`task_service._consume_sync_stream`) and a harness-local native branch would be a 3rd copy. Operator-chosen "separate per feature" structure (discuss-093, 2026-06-01). Extraction risk = MEDIUM (Anthropic/Google branches clean; the OpenAI branch is entangled with reasoning/think-tag + structured post-parse + nonlocal accumulators + mid-stream emit). SEED-028 (native Google service) is a future enhancement BEHIND this gateway — NOT in 092.5 (which extracts the existing proven dispatch verbatim).

#### Phase 093: Harness Cross-Provider Parity + Phase-Type Hardening
> **RESCOPED 2026-06-01** (discuss-phase) from "Anthropic Cross-Provider Parity". PARITY-01 (Deep-mode Anthropic polish) **re-deferred** — Deep is provider-robust on all 7; the 3 bugs aren't reproducing for the operator and aren't worth a shared-path risk. This phase is now the milestone-blocking harness work (audit "Phase A"). See `.planning/phases/093-harness-cross-provider-parity/093-CONTEXT.md` + the 092 comprehensive audit.
**Goal**: The Harness/workflow path is a first-class, provider-agnostic, robust backend surface — all 5 phase-types and all 4 seed workflows run end-to-end on the native-7 — achieved by CONSUMING the Phase 092.5 gateway, with Deep byte-identical (the red line).
**Depends on**: Phase 092.5 (the gateway to consume), Phase 092 (the dual-mode wiring + run-creation it runs on)
**Requirements**: PARITY-02 (harness cross-provider + phase-type hardening). PARITY-01 re-deferred.
**Success Criteria** (what must be TRUE):
  1. A Research→Summarize AND a Doc-Q&A (ask_user) workflow run end-to-end on EACH native-7 provider — the `runs` + sub-agent `runs` rows record the CORRECT per-provider model, tools ACTUALLY dispatch (not narrated as text), and both `llm_agent` and `llm_single` phases complete. (Fixes F9 = no native adapter + STRUCTURED-mode drop + stale model id, via the gateway + a shared model-resolver that resolves from the provider and never mutates saved settings.)
  2. The ask_user round-trip works: the answer endpoint accepts a workflow_run id (Option (i) — endpoint-detects-workflow_run, mirroring the Continue endpoint's existing fallback), the run resumes to finalize, the card flips green — on both the subscribe-alive and worker-restart→re-subscribe paths; Deep's runs-keyed ask_user still works. (Fixes F10b.)
  3. The 3 never-run phase-types run: `programmatic` `split_topic` (code fix + paired seed `input_keys` edit) → `llm_batch_agents` fan-out actually fans out N-way; the verify-gate routes forward instead of dead-ending on a missing literal token. The 5 phase-types are safe-by-construction validated primitives, and the publish-time reachability lint is extended to catch input/output-contract breaks (so a bad workflow fails validation, not at runtime — the v2.9-builder safety guarantee).
  4. Resume AND Continue surface the final answer (delta + persist + sources/citations/confidence) via one shared helper `run_workflow` calls on success (fixes the F6/F7-re-open + CONT-01-broken-for-harness gap); the ask_user draft is carried so it reaches the client (using the existing event vocabulary — *plumbing*; the visible frame is Phase 094).
  5. **Red line:** Deep is byte-identical (no edits to `agent_loop.py`'s provider branches/invariants, the byte-frozen `sub_agent_service.py`, the shared `_emit`, `task_service` None-defaults, or the MODE-01 Deep `else`); all harness additions are service-boundary/additive. F1–F8 not re-litigated.
  6. **The gate (MANDATORY — what 092-07 lacked):** native-7 × all-5-phase-types × all-4-seed-workflows LIVE + the 4-axis bandwidth + resume/Continue/reload rows + a Deep-parity regression row — seed the runs, no "if data permits" deferrals; wire-format checks INSUFFICIENT. Add live-DB / real-provider tests to close the mock blind spot.
**Plans**: 9 plans (6 waves) — 5 planned + shipped 2026-06-02; 4 gap-closure (093-06..09) added 2026-06-02 post-LIVE-UAT
- [x] 093-01-PLAN.md — Wave 0: 7 test scaffolds + split_topic kickoff_prompt alias + INPUT_UNSATISFIED lint + migration 065 seed fixes (operator SQL-editor checkpoint, autonomous:false) [SC#3] ✅ 2026-06-02
- [x] 093-02-PLAN.md — Wave 1: task_service gateway-consumption rewrite (F9 core) + byte-identical-Deep guard [SC#1] ✅ 2026-06-02 (open_stream + calling_mode honored; STRUCTURED inject-once + post-parse; deterministic net-new=0, sub_agent_service byte-frozen; LIVE Deep-parity row verifier-owned)
- [x] 093-03-PLAN.md — Wave 1: model-resolver field fix (available_models) + resolve_workflow_ctx_model wrapper + Google default Open-Q1 probe [SC#1] ✅ 2026-06-02 (D-06 dead-since-085 safety net revived — reads the real available_models, fires only on a genuine cross-provider mismatch; resolve_workflow_ctx_model resolve-never-mutate wrapper [D-04/D-05] for Wave-2; Open Q1 live-probed → gemini-3.5-flash; Test093ModelResolver GREEN 16/16, net-new failures=0)
- [x] 093-04-PLAN.md — Wave 2: ask_user F10 workflow_run-id fallback + Continue ctx-model threading (D-04 site 3) [SC#2] ✅ 2026-06-02 (submit_ask_user_response owner-scoped + thread-anchor-confirmed workflow_runs fallback mirroring continue_run — BRANCH never replace [D-08, Deep runs-keyed path byte-identical 200]; publishes under the workflow_run id so the harness ask_user subscribe wakes; T-093-IDOR HIGH = 404-never-403 no-leak for cross-user/non-existent/non-anchor; Continue wf_ctx threads resolve_workflow_ctx_model from the owner's effective settings [D-04 site 3, Open Q2 = prefer-load-owner-settings]; F10 live-DB suite 5/5 GREEN, targeted regression backstop 14/14, net-new failures in the touched surface=0)
- [x] 093-05-PLAN.md — Wave 2: shared surfacing helper (D-11) + live/resume ctx-model threading (D-04 sites 1+2) + ask_user draft carry (D-12) [SC#4] ✅ 2026-06-02 (F6/F7 surfacing HOISTED into harness_engine._surface_final_answer on run_workflow's success terminal — single surfacing site + single persist owner for live+resume+Continue [Pitfall 5/Landmine 5], emits delta+grounding BEFORE run_completed, inline threads.py block REMOVED → no double-persist/duplicate; Deep else byte-identical [D-14]; per-phase event contract fixed for Phase 094; D-04 sites 1+2 thread resolve_workflow_ctx_model [resume loads owner settings, Open Q2 prefer-load]; D-12 draft carried to durable row + SSE + /pending + PendingAsk [additive]; test_093_surfacing GREEN 4 cases + 5 dual_mode_wiring contracts retargeted; tsc 54 baseline 0 net-new + vite clean; touched-surface net-new=0)
- [x] 093-06-PLAN.md — Wave 3 (gap-closure, D-20): opt-in redacting backend file log-sink (logging_sink.py + main.py wiring) so the agent self-scans the re-UAT for gpt-4o-fallback / runs.usage-missing / 400-round-trip signals; secrets redacted, logfile gitignored [PARITY-02] ✅ 2026-06-02 (install_file_log_sink opt-in RotatingFileHandler [10MB×3] on the root logger when LOG_FILE_PATH/BACKEND_LOG_FILE set, else None+no-handler = byte-identical console-only; _RedactingFilter strips sk-/Bearer/Authorization/JWT + live provider key env VALUES before write; idempotent via _gsd_093_sink sentinel; wired at main.py startup after load_dotenv; LOG_FILE_PATH knob documented in .env.example; default logs/backend.log gitignore-covered by existing logs/+*.log [no new rule]; 8/8 unit tests GREEN)
- [x] 093-07-PLAN.md — Wave 4 (gap-closure, D-16+D-17, depends_on 06): consume the gateway finish event in task_service — hydrate thought_signature (Google) + reasoning_content (Moonshot/Kimi) onto the assistant tool-call message (fixes Google 🔴 + Moonshot 🔴) + persist usage to runs.usage (S4); byte-identical-Deep + 4-passing-provider no-op guard [PARITY-02] ✅ 2026-06-02 (additive None-default reasoning_box/usage_box; _drain consumes finish [hydrate thought_signature] + reasoning_delta [accumulate] + usage/usage_delta [SUM] — mirror agent_loop.py:1399-1416/:1503-1506; assistant replay message conditional-spreads thought_signature per tool_call + reasoning_content on the message [:1866-1901, no-op when absent]; finalize_run persists accumulated _sub_usage [S4 closed] with runs.usage-missing warn-before-finalize; Test093FinishEvent 9 cases GREEN, test_085 43/43; deterministic guard = full-suite net-new=0 [the 4 test_085_sub_agent_cross_provider failures PROVEN pre-existing vs pre-plan task_service.py — 093-03 model-resolver fixture, deferred], sub_agent_service.py+agent_loop.py ZERO-diff, async for=0; LIVE Google+Moonshot round-2 proof + runs.usage-non-NULL = verifier-owned D-21 re-UAT)
- [x] 093-08-PLAN.md — Wave 5 (gap-closure, D-18/S3, depends_on 07): make run_task_sub_agent model resolution intentional (user sub_agent_model → resolved ctx model → fast per-provider default) — never the gpt-4o global bounce; resolve-never-mutate; byte-identical-Deep guard [PARITY-02] ✅ 2026-06-03 (`_resolve_sub_agent_effective_model` pure helper reuses the shipped resolver + a narrow per-provider-default guard closing the empty-available_models gpt-4o leak for non-openai providers; sub_agent_model field confirmed → override honored; D-05 no-mutate; Test093IntentionalSubAgentResolution 9/9 GREEN; full-suite net-new=0 [111 failed/1119 passed vs 093-07 baseline], sub_agent_service+agent_loop ZERO-diff, async-for=0; ctx threading already-wired in phase_types; LIVE correct-model proof = verifier-owned D-21 re-UAT)
- [x] 093-09-PLAN.md — Wave 6 (gap-closure, D-19, depends_on 06/07/08, autonomous:false): GLM/zhipu max_steps DIAGNOSE-FIRST (live run + LangSmith + DB + log-sink) → fix-in-phase [PARITY-02] ✅ 2026-06-02 (root cause PINNED = Branch B step-cap-too-low + a GENERAL silent-failure gap: a thorough llm_batch_agents sub-agent hit the 8-step cap WHILE STILL RESEARCHING [8 distinct progressively-refined queries, native tool calls, glm-4.6] and leaked the "reached max_steps" placeholder; the other 2 GLM agents converged. **Hybrid B+ fix:** (1) PRIMARY force-synthesis fallback — `run_task_sub_agent`'s else-exhausted branch makes ONE final tools=[] synthesis turn [WR-01 gate skips the STRUCTURED post-parse so the answer is never blanked] so ANY provider returns a real answer on exhaustion; (2) COMPLEMENT effective cap 8→12 raised in lockstep across 3 knobs [Settings + sentinel + Pydantic config defaults — the clamp is a sentinel-EQUALITY substitution, not min()]. test_093_glm_max_steps 3/3 GREEN; Deep byte-identical [sub_agent_service + agent_loop zero-diff]; full-suite net-new=0. **Closes 7/7, NO provider deferred** — Branch D not taken, no SEED. LIVE D-21 re-UAT verifier-owned [BINDING])
**Notes**: Evidence-first; the 092 comprehensive audit + the 2026-06-01 live-code verification are the diagnosis. Operator red line: investigate first, never break working things. Hot-files becoming `task_service.py` / `phase_types.py` — audit G-5 at plan time; the 092.5 extraction relieves the provider-dispatch pressure. CONSUMPTION + plumbing phase (~zero net-new logic). Wave 0 lands the seed fix + RED test contracts first; Plan 02 (task_service rewrite) carries the byte-identical-Deep guard (D-14). The native-7 × 5-phase-type × 4-workflow LIVE UAT (D-13/SC#6) is authored in 093-VALIDATION.md, NOT PLAN tasks — owned by the verifier/operator.

#### Phase 094: Workflow Legibility + Mode Clarity
> **EXPANDED 2026-06-01** (discuss-093) from "Panel Phase Timeline" to absorb the 092 audit's "Phase B" (RC-4 presentation cluster) + the D-092-UX composer concern. Renders the per-phase / intermediate-output events Phase 093 emits (the *chrome* over 093's *plumbing*). Still sketch-first.
> **SCOPE EXPANSION — D-094-UNIFY (operator-signed-off 2026-06-02):** the workspace panel becomes the **SINGLE live-execution surface for BOTH Deep AND Harness** — Deep's agent-loop steps + tool calls move OUT of the chat into the panel too (deliberately **reverses the sketch-001 in-chat Run-Card for Deep**); the chat keeps only prompt + final answer + a quiet "ran in workspace ▸" pointer. This is the correct fix for S2 (ghost avatars) across all modes; it stays a separate **surface** (thread-bound, shared SSE/anchor/lock), NOT a separate route. Evidence + rationale: `093-CROSS-PROVIDER-UAT-FINDINGS-AND-NEXT.md` §6. The sketch must produce both variants if helpful, but the chosen direction is unify.
> **SKETCH/DISCUSS INPUTS (read before `/gsd:sketch 094`):** (1) **`093/094-UI-FINDINGS-FROM-093-REUAT.md`** — the 7 prioritized UI/legibility gaps harvested from the 093 D-21 LIVE re-UAT; items #1 (no live progress in chat) and #2 (draft-before-ask_user invisible) are the **operator-stated acceptance bar** ("show the workflow's REAL steps and tasks — transparency, not a spinner"). (2) **`seeds/SEED-051` → "Authoring surface & builder UX"** — the 094-relevant subset of the v2.9 NL-authoring vision that REFINES D-092-UX **now**: composer simplification (workflow-picker + Deep/Harness pill leave the composer), **Deep-is-not-a-toggle** (Deep = `active_workflow_run_id IS NULL`, not a mode pill), and **workflows-as-a-PAGE → launch from the page, not the composer/panel**. Open sequencing question to decide at 094 discuss: what does 094 do for launch in the interim (panel "Run workflow" per D-092-UX) vs. defer the full Workflows page to v2.9 authoring? (Full NL-authoring engine = v2.9, SEED-051 spike-first.)
**Goal**: The workspace panel shows a live, accessible phase timeline + a RunCard for harness answers (parity with Deep tool turns), intermediate phase output is visible (the draft before ask_user, batch sub-results), a failed/gate-failed run renders as failed (never a `done` sentinel with empty content), and the two orthogonal mode axes (General/Explorer × Deep/Harness) + the workflow picker are disambiguated per D-092-UX — all with zero chat re-renders.
**Depends on**: Phase 093 (the per-phase + intermediate-output + answer events it renders only carry content once 093 surfaces them) / Phase 091 / Phase 092
**Requirements**: PANEL-08, PANEL-09, A11Y-03 (+ D-092-UX composer simplification; + the audit RC-4 failure-honesty + intermediate-output rendering)
**Success Criteria** (what must be TRUE):
  1. Entering Harness Mode auto-opens the panel to a phase timeline showing current / locked / completed glyphs, gate pass/fail badges, and a transition log; the timeline reconciles via `GET /threads/{id}/workflow` fetch on mount.
  2. Workflow phase events ride the existing `run:{run_id}` stream and demux into a dedicated `phasesByThread` store; a panel phase update triggers ZERO chat message-list re-renders (PANEL-06 isolation preserved — chat selectors never read `phasesByThread`).
  3. A refused tool call renders as an expected, styled "phase guard" event (not an error/crash), and a stalled phase shows a visible "running… Ns" → explicit `failed` state rather than freezing silently.
  4. The phase timeline meets WCAG 2.1 AA: keyboard-navigable, ARIA landmarks/labels, non-color-only status indicators, ≥4.5:1 contrast in both themes — vitest-axe gated and real-contrast verified (Chrome MCP/Lighthouse) in both themes.
  5. SC#10 UI-state UAT passes: the timeline renders correctly across collapse states, both themes, multiple threads, and mobile; a parallel thread streaming does not corrupt this thread's timeline.
  6. Intermediate phase output is visible (the draft before ask_user, batch sub-results — progressive disclosure, not just the final delta), and a failed/gate-failed run renders as **failed with a reason**, never as a `done` sentinel with empty content (the RC-4 trust bug). A harness answer gets a RunCard with the multi-phase provenance (parity with Deep tool turns).
  7. Mode clarity (D-092-UX): the two orthogonal axes (General/Explorer × Deep/Harness) + the workflow picker are disambiguated; Harness-with-no-workflow does not silently send a Deep turn; a `cap_paused` run shows a correct composer state + Continue affordance rather than a misleading lock placeholder.
**Plans**: 5 plans (4 waves)
- [x] 094-01-PLAN.md — D-05 --accent-violet token (FIRST) + Wave-0 test scaffolds + DATA-CONTRACT §7 fixtures [Wave 1] ✅ 2026-06-04
- [x] 094-02-PLAN.md — Additive phase_* SSE branches (Deep byte-identical) + panel-only phasesByThread slice + usePhases (PANEL-09) [Wave 2] ✅ 2026-06-04
- [x] 094-04-PLAN.md — D-04 RC-4 backend persist at BOTH failure-return sites (Deep byte-identical) [Wave 2, parallel with 02] ✅ 2026-06-04 (`_surface_failure_message` at fail_run + skip_to_phase guard; reason_unknown sentinel; `_shielded_finalize` untouched/77 insertions 0 deletions; test_094_rc4_failure GREEN 4/4; harness suite 94 passed/1 pre-existing)
- [x] 094-03-PLAN.md — PhaseTimeline + PhaseCard (WCAG 2.1 AA, reconcile-then-live, failure-with-reason, suppress counts) + WorkspacePanel mount + PANEL-08 auto-open [Wave 3] ✅ 2026-06-04 (APG accordion + non-color-only status atoms + closed failure taxonomy/reason_unknown sentinel in role=alert + retrying purple from --accent-violet + forward-only Phase i/N + one polite announcer + aria-busy flip; A11Y-03 CLOSED — vitest-axe 0 violations all states; PANEL-08 auto-open at harness kickoff only; no chat hot-file touched; INV-2/3b/4 GREEN 12/12; tsc 54→37; PANEL-08 + A11Y-03 → complete)
- [x] 094-05-PLAN.md — D-02 mode label from server truth + D-06 draft preview + batch summaries [Wave 4] ✅ 2026-06-04 (FINAL 094 plan; MessageInput displayedMode prop reads workflowLocked ← active_workflow_run_id — kills finding #5, launch toggle AS-IS; PendingAskCard DraftBlock renders ask.draft above the question with verbatim "not yet saved" tag + faded preview + ⤢ wide Dialog overlay + DRAFT-MISSING guard; BatchResultList per-subtopic summaries from panel-only useTasks (PANEL-09 — zero chat re-render); plain-text children/no XSS; ChatAreaMode 3/3 + PendingAskCard 18/18 GREEN; tsc 37 0-net-new; vite clean; PANEL-09 → complete)
**UI hint**: yes
**Notes**: **G-2 FIRES** — `/gsd:sketch` precedes `/gsd:spec-phase`/`/gsd:plan-phase`. Operator-approved mockup is the acceptance bar. Purely additive to the v2.7 panel architecture (new `phase_*` SSE handlers are additive else-if branches — do not alter the existing `delta`/`sources`/`confidence` dispatch Deep depends on). G-4 lived-experience UAT (Chrome MCP, both themes, mobile, ask_user render+answer, failing-workflow-shows-failed, long-running phase progress, composer states). Baseline = `sketch-findings-agentic-rag` (panel-shell + chat↔panel-seam).

#### Phase 095: Chat Tool-Card Unification
**Goal**: Chat tool-cards render in one consistent frame with auto-scroll, details-on-demand collapse, no duplicates, consistent timer/step-count, and a working download — closing the felt-experience defects in the chat execution surface.
**Depends on**: Phase 089 (sequenced after the extraction; touches the frontend chat-surface hot files ToolCallPanel/MessageItem/StreamsProvider, distinct from the backend `threads.py` extraction)
**Requirements**: CHAT-04
**Success Criteria** (what must be TRUE):
  1. Tool-cards render in one consistent frame with auto-scroll and details-on-demand collapse; no duplicate cards appear on any provider (closing BUG-260529-02).
  2. The run timer stays visible for the full duration of long runs (closing `timer-disappears-long-runs`) and the step count matches between the timer and the panel (closing `step-count-mismatch-timer-vs-panel`).
  3. The output-file download link works end-to-end (no dead link), and SC#10 cross-provider UAT confirms the unified frame behaves identically across all 6 native providers and survives a parallel-thread + long-message scenario.
  4. The change is contained to the frontend chat surface (plus one small, contained additive backend field per D-08) and does not regress the panel's PANEL-06 isolation or the StreamsProvider demux.
**Plans**: 5 plans (3 waves)
- [x] 095-01-PLAN.md — Foundational shared primitives: `unifiedStepCount` + extracted `dedupToolCalls` (D-04) + `fileIcon` (D-07) + Wave-0 tests [Wave 1] ✅ 2026-06-05
- [x] 095-02-PLAN.md — RunCard: D-06 persistent timer (created_at, freeze-at-terminal) + D-04 unify all 3 count sites + the one `RunStatusStrip` [Wave 2, depends 01] ✅ 2026-06-05
- [x] 095-03-PLAN.md — D-05 sub-agent zero-duplicate root fix (StreamsProvider stamp-onto-owning-tool_call + ToolCallPanel dual-source collapse) + shared dedup import + StepRail numbered rail + "Round N" divider [Wave 2, depends 01] ✅ 2026-06-05
- [x] 095-04-PLAN.md — D-03 `useFollowScroll` follow-but-release + floating JumpToLive chip in MessageList (reuses RunStatusStrip) [Wave 3, depends 01+02] ✅ 2026-06-05
- [x] 095-05-PLAN.md — D-08 backend hero tag (agent-marks + backend-fallback) + url guard + persist; D-07 OutputFileCard hero/working split + MessageItem grouping + fileIcon [Wave 3, depends 01] ✅ 2026-06-05

**Gap-closure plans (operator live-UAT 2026-06-06 — 3 gaps; 4 plans 06-09, Wave 1, disjoint files):**
- [x] 095-06-PLAN.md — GAP-095-01 per-card collapse (per-step `expandedSteps` Set kills fold-all) + GAP-095-03 un-gate / single essence line / active bloom [gap, Wave 1] ✅ 2026-06-06
- [x] 095-07-PLAN.md — header chrome (GAP-095-03 MED: pill-chrome strip + single verb + restored `model · turn` run-sub) [gap, Wave 1] ✅ 2026-06-06
- [x] 095-08-PLAN.md — file-axis fidelity (GAP-095-03 MED: hero icon 48/working 30 + soft 24px hero glow halo + borderless top-rule/dim eyebrow; LOW: intermediates copy + status-first/jump-trailing chip; partition logic untouched) [gap, Wave 1] ✅ 2026-06-06
- [x] 095-09-PLAN.md — single hero / multi-select leak (backend): GAP-095-02 / WR-02 — `_select_hero_filenames` returns exactly ONE hero on every branch + one canonical `_hero_set` shared by emit + persist (live == reload); token-match ext detection [gap, Wave 1] ✅ 2026-06-06
**UI hint**: yes
**Notes**: **G-2 FIRES** — `/gsd:sketch` SHIPPED (sketches 014/015/016 → `Skill("sketch-findings-agentic-rag")`); the operator-approved mockup is the acceptance bar (no UI-SPEC.md — the sketch-findings skill IS the design contract). Touches hot-file-ledger files (ToolCallPanel, MessageItem, StreamsProvider, RunCard, MessageList) — G-5 satisfied as of 075.7, re-confirmed by 095-RESEARCH (095 is the first chat-render feature touch since the refactor; all touches are additive extensions, not rebuilds → G-5 does NOT fire). SC#4 "frontend-only" NARROWED by D-08 to permit ONE additive backend field on `final_output_files` (the hero tag). Build-once inventory (SKETCH-CONSISTENCY §1): 3 genuinely-new files (`stepCount.ts`, `fileIcon.tsx`, `useFollowScroll.ts` + `RunStatusStrip.tsx`) + 5 additive extensions + 1 backend field. The 4-axis lived-experience UAT (Chrome-DevTools MCP) is authored in 095-VALIDATION.md Manual-Only, NOT PLAN tasks.
**Status**: ✅ CLOSED 2026-06-06 — 5 plans + gap-closure 06-09 + WR-01 code-review fix; the 3 operator-reported gaps (fold-all, hero-leak, sketch-divergence) verified FIXED live via Chrome-MCP UAT. Live cross-provider UAT surfaced 5 NEW cross-provider/honesty findings → routed to Phase 095.1 (not 095 failures).

#### Phase 095.1: Cross-Provider Run Honesty & Workspace Parity
**Goal**: Every provider's runs are honest and legible — the workspace todos/tasks panel fills consistently (deterministically, never forced), provider errors read truthfully, finished runs never falsely offer Resume, the timer never lies on reload, and the user can always see which model answered — verified live across all 8 providers.
**Depends on**: Phase 095 (findings), Phase 092.5 (provider gateway — error classification lands at the boundary)
**Requirements**: WORKSPACE-PARITY, RUN-HONESTY, PROVIDER-ERR (added to REQUIREMENTS.md 2026-06-06; folds BUG-260606-01, BUG-260606-02, BUG-260518-01, + panel-fill symptom of BUG-260604-01)
**Success Criteria** (what must be TRUE):
  1. The workspace todos/tasks panel populates from a DETERMINISTIC, provider-independent mechanism (smart-gate + activity-derivation; spikes 006/007) — fills for ALL providers on multi-step work INCLUDING those that never call `write_todos`, and stays CLEAN (no panel) for simple Q&A / single-tool runs. NOT prompt-instructed, NOT mandatory, never forced. Honors `write_todos` when the model does call it.
  2. A 429 rate-limit (any provider) reads as a rate-limit with retry guidance, NOT "billing / insufficient credits". Classification done at the per-provider gateway boundary on structured status codes, not shared keyword-soup.
  3. A run that produced its deliverables but ended failed/timed_out does NOT falsely offer "Resume" — the Resume affordance is deliverable-aware.
  4. A reloaded completed run shows its TRUE duration (persisted run end-time), never time-since-creation (no "1440m" for a day-old 1-minute run).
  5. Every assistant response surfaces which model/provider generated it ("generated by {provider} {model}") — read from existing `runs.model`/`runs.provider`, no migration.
  6. Output files render as ONE flat "Generated files" list (no hero crown, no working/hero split); all present, all downloadable.
  7. SC#10 4-axis + all-8-provider live verification: every fix confirmed on openai, anthropic, google, deepseek, moonshot, glm/zhipu, minimax, openrouter (OpenRouter/Ollama panel = best-effort, structured mode).
**Plans**: 7 plans (3 waves) — 5 original + 2 gap-closure (06/07) from the live 8-provider UAT
- [x] 095.1-01-PLAN.md — Wave 0 scaffolds: workspacePanel.ts selector (spike-006/007 port) + provider_gateway/errors.py classifier, each unit-tested first ✅ 2026-06-06 (31 FE + 27 BE tests green; tsc baseline-clean; zero consumer touched)
- [x] 095.1-02-PLAN.md — WORKSPACE-PARITY panel (D-01/02): activity-derived read-only todos via a PANEL-06-safe selector + TodosSection precedence render ✅ 2026-06-06 (useDerivedPanel option-b read selector + real-todos-first precedence + "derived from activity" marker; TodosSection 12/12 + panelHooks 19/19; tsc baseline 37; vite build 0; FC#1 isolation preserved)
- [x] 095.1-03-PLAN.md — RUN-HONESTY attribution+timer (D-04/05): one additive runs↔messages SELECT → RunCard {provider}·{model}·turn N + true completedAt−startedAt timer ✅ 2026-06-06 (additive enrich SELECT byte-identical WHERE, no migration; D-04 run-sub from real runs.model/provider; D-05 wasStreamingRef-gated true reload timer closes BUG-260606-02; backend 5/5 + RunCard 34/34; tsc baseline 37; vite build 0; shared SSE path untouched. RUN-HONESTY req stays open — D-07 in sibling 095.1-05)
- [x] 095.1-04-PLAN.md — PROVIDER-ERR (D-03): wire classify_provider_error into the agent_loop catch (Google 429 → rate-limit, never billing) ✅ 2026-06-06 (billing-first keyword if-ladder swapped for `classify_provider_error(_resolved_provider, e)` + `message_for_kind` keyed on the in-scope provider; 429/RESOURCE_EXHAUSTED → rate_limit, never billing — BUG-260606-01 CLOSED; context-overflow retained as a narrow text pre-check; emit/raise tail + adapters + transient/request-too-large paths byte-identical; +3 wiring-guard tests, test_errors 30/30, agent_loop-importing suites 71/71, module imports clean; PROVIDER-ERR req fully delivered)
- [x] 095.1-05-PLAN.md — MessageItem honesty (D-06 flat Generated-files list + D-07 deliverable-aware Resume) ✅ 2026-06-06 (FinalOutputsPanel flattened to one equal OutputFileCard list — hero crown/split removed, is_hero written-but-unread, no backend change; OutputFileCard hero variant inert, url-less "Download unavailable" dead-state KEPT; Resume gate gains !producedDeliverables → a failed/timed_out run WITH deliverables no longer falsely resumes, BUG-260518-01 CLOSED; finalOutputs 11/11, tsc baseline 37, vite build 0, dangerouslySetInnerHTML==0 in both files. WORKSPACE-PARITY D-06 + RUN-HONESTY D-07 delivered)
- [x] 095.1-06-PLAN.md — GAP-1 (WORKSPACE-PARITY): WorkspacePanel.hasActivity omitted the derived selector → the activity-derived panel was structurally unreachable on the no-write_todos parity case. ✅ 2026-06-06 (sequential, normal commits WITH hooks, TDD RED→GREEN). hasActivity now ORs `derived.length > 0` via the EXISTING useDerivedPanel hook (reuse — no re-implemented gate); honest Todos count badge (omitted, not "0/0", when derived-only); guard test renders the REAL WorkspacePanel+TodosSection through the gate (the path the unit tests bypassed) — WorkspacePanel.derived 4/4 + WorkspacePanel/TodosSection/panelHooks 54/54 = 58/58, selector 31/31; tsc baseline 37 (zero net-new, zero touched-file errors); vite build 0; dangerouslySetInnerHTML==0. Commits be1d657f (RED) + ef6d1a92 (GREEN). [gap-closure]
- [x] 095.1-07-PLAN.md — GAP-2 (RUN-HONESTY): live attribution lag + turn divergence (live=iterationCount+1 vs reload=1, no provider·model live). ✅ 2026-06-06 (sequential, normal commits WITH hooks, TDD RED→GREEN). Dispatch JSONResponse += additive model/provider (the already-resolved _resolved_model/_resolved_provider — no re-resolution) → StreamsProvider stamps them onto the live assistant placeholder (RunCard shows {provider}·{model} LIVE, not only after reload); RunCard run-sub turn decoupled from iterationCount → stable `turn 1` so live==reload (095.1-UAT 6b closed). Backend dispatch tests 2/2 + test_threads 16/2-pre-existing-rot; RunCard suites 35/35 incl. the decisive live==reload guard; providers 21/21; tsc baseline 37 (zero net-new); vite build 0; dangerouslySetInnerHTML==0 in RunCard; threads.py diff 1 hunk — zero shared-SSE/chunk/_emit/agent_runner/provider-branch change (all 8 providers byte-identical, grep-proven). Commits 46eb92a0/4c4c7401/c2dc809b (T1) + 6bb1beda/9e605012 (T2). [gap-closure]
**Status**: VERIFIED & CLOSED 2026-06-06 - verify-work live re-UAT PASSED after gap plans 06+07. All 3 prior UAT issues (panel-fill GAP-1, multi-tool derived, live attribution GAP-2) re-verified PASS live (operator-driven, Supabase-cross-checked; all 8 providers DB-verified to have qualifying runs + identical render path). Tests 8 (deliverable-aware Resume) + 9 (429->rate-limit) skipped-with-reason - strengthened static+DB-traced backstop; Google credit-depletion-as-rate-limit trade-off -> SEED-057. 095.1-UAT.md: 8 pass / 0 issue / 2 skipped.

**Notes**: Born from Phase 095 live cross-provider UAT (2026-06-06). Spike-first DONE — spikes 006/007 VALIDATED the deterministic panel mechanism (`.planning/spikes/MANIFEST.md`); the planner sub-agent (option B) is deferred as optional upfront-plan polish. Architecture: keep provider-specific handling at the 092.5 gateway boundary; the panel mechanism lives on the provider-agnostic SSE activity layer — NO shared model-behavior rules (operator direction: consistency, error-free, failure-free, cross-provider). All fixes are shared/frontend/gateway → naturally cover all providers. Cross-checks reported-bugs: folds BUG-260604-01 (write_todos compliance) + BUG-260518-01 (resume genuine-terminal case); new reports filed for Google-429-mislabel + reload-timer. See [[project_095_cross_provider_uat_findings]].

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
**Plans**: 8 plans (3 waves)

Plans:
- [ ] 096-01-PLAN.md — Eval seed substrate: eval_slow_step fn + migration 066 eval_coverage 5-type workflow + [BLOCKING] SQL-editor apply (W1)
- [ ] 096-02-PLAN.md — D-01 CI structural gate: test_096_ci_workflow_regression (fake gateway adapter at open_stream seam; sequencing/gate-retry/whitelist/resume legs) (W1)
- [ ] 096-03-PLAN.md — D-06 backend: terminal-site ask_user expiry cleanup + /pending dual-namespace liveness filter (BUG-260605-01) (W1)
- [ ] 096-04-PLAN.md — D-06 frontend: answerAskUser ApiError + PendingAskCard 404-honesty + created_at countdown (W1)
- [ ] 096-05-PLAN.md — CONC-01 stream-cap: StreamsProvider thread-keyed LRU-3 pool + eviction bookkeeping + D-10 honest indicators (BUG-260530-01) (W1)
- [ ] 096-06-PLAN.md — EVAL-01 eval extension: --workflow rows + D-02a ask_user auto-answer + D-04 capability table + D-01 operator-gate docs (W2)
- [ ] 096-07-PLAN.md — D-08 restart_smoke.py (3 kill points) + conc_probe.py (N=10 fan-out, latency p95, AnyIO budget) (W2)
- [ ] 096-08-PLAN.md — D-05 model curation: curate_models.py live /models pass + registry/defaults/PROVIDERS/Settings updates + operator approval (W3)
**Notes**: CONC-01 covers BOTH backend fan-out fairness (`llm_batch_agents`) AND the frontend stream-connection saturation (BUG-260530-01) — same parallel-thread responsiveness guarantee. The frontend cap-live-streams fix lands here because Phase 094's panel timeline rides the same `run:{run_id}` stream and must not be throttled by held-open background streams. Operator-chosen approach 2026-05-30 (rejected: single multiplexed transport, HTTP/2 serving).

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 089. Agent-Loop Extraction (G-5) + Kickoff UAT | 4/4 | Complete    | 2026-05-30 |
| 090. Harness Schema + RLS + Config Models | 0/0 | Not started | - |
| 091. Harness Engine + 5 Phase Types + Gates + Whitelist | 8/8 | Complete    | 2026-05-31 |
| 092. Dual-Mode Wiring + Continue Button | 6/7 | In progress (092-06 F3 code-complete + UAT gaps_found → NEW blocker F4 blocks end-to-end workflow; 092-07 F4 gap-closure remaining; MODE-01/02 + CONT-01 stay OPEN) | - |
| 092.5. Provider Gateway Extraction (NEW — refactor) | 6/6 | Complete    | 2026-06-01 |
| 093. Harness Cross-Provider Parity + Phase-Type Hardening | 8/9 | Gap-closure in progress 2026-06-03 — initial 5 plans (substrate + F9 gateway-consumption + model-resolver + ask_user F10 + shared surfacing) executed 2026-06-02; gap-closure 093-06 (D-20 log-sink) + 093-07 (D-16/D-17 hydration + runs.usage) + 093-08 (D-18/S3 sub-agent model resolution — gpt-4o-avoidance) shipped. Remaining: 093-09 (D-19 GLM diagnose-first, autonomous:false). PARITY-02 stays OPEN until the native-7 × 5-type × 4-workflow LIVE UAT passes | - |
| 094. Workflow Legibility + Mode Clarity | 5/5 | Complete    | 2026-06-05 |
| 095. Chat Tool-Card Unification | 5/5 + gap 4/4 | Gap-closure complete (06/07/08/09 ✅); ready for /gsd:verify-work | 2026-06-06 |
| 095.1 Cross-Provider Run Honesty & Workspace Parity | 5/5 + gap 2/2 | Both gap plans shipped — 095.1-06 (GAP-1 derived-panel reachable) ✅ + 095.1-07 (GAP-2 live attribution + turn live==reload) ✅ 2026-06-06. Base 095.1-01..05 shipped (WORKSPACE-PARITY + RUN-HONESTY + PROVIDER-ERR delivered); GAP-1 closed at unit level (WorkspacePanel.hasActivity reaches useDerivedPanel → derived panel renders for no-write_todos runs); GAP-2 closed at unit level (dispatch response carries resolved model/provider → live attribution stamp; run-sub turn decoupled from iterationCount → live==reload; shared SSE path byte-identical). NEXT: /gsd:verify-work 095.1 (live Chrome-MCP re-UAT of both gaps + 4-axis cross-provider scoreboard) | - |
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

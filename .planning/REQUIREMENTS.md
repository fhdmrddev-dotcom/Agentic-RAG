# Requirements: Agentic RAG v2.8 — Harness Engine & Workflow Mode

**Defined:** 2026-05-30
**Core Value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared. v2.8 gives the agent a **deterministic, auditable workflow runtime** — locked ordered phases the model cannot escape — so the same multi-step job runs the same trustworthy way every time, alongside today's free-form chat.

**Research:** `.planning/research/SUMMARY.md` (HIGH confidence — harness is ~80% composition of already-shipped, cross-provider-tested primitives; zero new dependencies). PRD design source: `.planning/PRDs/v2.7.md` §3 Theme B (6 favorable deltas applied). Scope decision: PROJECT.md **D-v2.8-01** (harness + dual-mode now; Plugin Contract → v2.9).

---

## v2.8 Requirements

### Foundation — Agent-Loop Extraction (G-5)

- [x] **FOUND-03
**: The agent loop is extracted from `threads.py` (3,186 LOC) into a dedicated `agent_loop.py` module with **byte-identical cross-provider behavior** — eval harness + E2E backstop GREEN before AND after, all per-provider round-trip fixes (Anthropic `end_turn`, Google `thought_signature`, DeepSeek `reasoning_content`, empty-retry guard, `force_no_tools`-on-last-iteration) carried verbatim. Ships FIRST; zero harness features bundled. Deep Mode unchanged.

### Harness Engine

- [x] **HARNESS-01
**: A user can run an agent through an **ordered, locked workflow** with 5 phase types — `programmatic` (pure Python, no LLM), `llm_single` (one call), `llm_agent` (bounded agent loop), `llm_batch_agents` (N parallel sub-agents, merged), `llm_human_input` (pause for user) — where the backend drives transitions and the LLM cannot reorder or skip phases.
- [ ] **HARNESS-02**: Workflow definitions are **versioned and immutable-on-publish** (`UNIQUE(slug, version)` + `BEFORE UPDATE` DB trigger + FK `ON DELETE RESTRICT`); a published workflow re-runs reproducibly.
- [x] **HARNESS-03
**: A workflow run is **resumable** — phase state persists to Postgres (`workflow_phases`) and survives a uvicorn restart and cross-worker resume via a two-phase write (mark `active` before work, `completed` only after output is durable).
- [x] **HARNESS-04
**: Each phase can declare **validation gates** (`json_schema`, `regex_match`, `workspace_file_exists`, `programmatic`) with a **bounded** `on_failure` policy (`fail_run` / `retry` with `max_retries=2` + consecutive-identical-output short-circuit / `skip_to_phase:<slug>`) — a deterministically-failing gate reaches `failed`, never loops forever.
- [x] **HARNESS-05
**: Per-phase **tool-whitelist enforcement** lives in `dispatch_tool()` — a tool call outside the current phase's whitelist is refused with a clean `tool_result` on all 6 native providers (no crash, no provider 400); the guard is a literal no-op when no workflow is active (Deep Mode unaffected).
- [ ] **HARNESS-06**: Every phase transition, gate result, and tool refusal is recorded to an **INSERT-only `harness_audit` trail** the user/operator can inspect.
- [x] **HARNESS-07**: 2–3 **seed workflow templates** ship (e.g. Research→Summarize, Plan→Execute→Verify) as the end-to-end exercisers and UAT fixtures — v1 workflow authoring is seed/JSONB/API (no visual builder). ✅ Phase 091-07 (migration 061 — 4 seeds, all 5 phase types).

### Workflow Mode (Deep / Harness)

- [ ] **MODE-01**: A user can switch a thread between **Deep Mode** (default, unchanged free chat) and **Harness Mode** (locked workflow); mode is per-thread (`threads.active_workflow_run_id IS NULL` = Deep).
- [ ] **MODE-02**: Once a workflow starts, the thread is **workflow-locked** — switching back to Deep is refused server-side until the run completes or the user cancels; Cancel clears the lock in the same transaction as the terminal-status write; lock state is **per-thread** (never a global boolean — BUG-260523-01 pattern).
- [ ] **CONT-01**: When an agent run hits its step cap (a Deep run OR a Harness phase), a **"Continue" affordance** resumes the same run/phase with a bounded additional step budget instead of silently dropping tool calls. *(SEED-029)*

### Panel — Phase Timeline

- [ ] **PANEL-08**: The workspace panel shows a **live phase timeline** (current / locked / completed glyphs, gate pass/fail badges, transition log) that auto-opens on entering Harness Mode and reconciles via fetch on mount.
- [ ] **PANEL-09**: Workflow phase events ride the existing `run:{run_id}` stream and demux into a dedicated `phasesByThread` store — panel phase updates trigger **zero chat message-list re-renders** (PANEL-06 isolation preserved).

### Accessibility

- [ ] **A11Y-03**: The phase timeline meets **WCAG 2.1 AA** — keyboard-navigable, ARIA landmarks/labels, non-color-only status indicators, ≥4.5:1 contrast in both themes (vitest-axe gated).

### Cross-Provider Reliability & Eval

- [ ] **EVAL-01**: A cross-provider eval (`scripts/eval_cross_provider.py`, extended) runs a multi-phase workflow on all **6 native providers** and asserts the locked phase sequence completes with correct tool round-trips — wired as the **CI regression gate**. *(SEED-034)*
- [ ] **EVAL-02**: The harness passes the **4-axis UAT scoreboard** (cross-provider × multi-tool × parallel-thread × long-message) plus a **uvicorn-restart-mid-workflow** smoke per phase type (including mid-`ask_user`). *(SC#10)*
- [ ] **CONC-01**: `llm_batch_agents` fan-out is bounded by `max_parallel_agents` (default 5) composing with the global Redis-Lua cap (20); a batch phase does not starve app-wide request latency (cross-tab GET stays <50ms). *(SEED-036a)* **Also covers the frontend stream-connection saturation (BUG-260530-01):** with ≥6 concurrent active runs, the HTTP/1.1 6-connection-per-host cap is saturated by one held-open streaming `fetch` per run → 15-30s thread-switch hang; fix = frontend cap-live-streams (only the viewed thread holds a live stream; background runs reconcile on return). Same parallel-thread responsiveness guarantee.
- [x] **TOOL-05
**: A **tool-count budget guard** at `get_tools()` / per-provider `max_tools` soft ceiling in `MODEL_CAPABILITIES` protects providers (esp. Google) from accuracy degradation past their tool limit; the per-phase whitelist is the structural complement. *(SEED-035)*

### Polish Riders

- [ ] **CHAT-04**: Chat tool-cards render in **one consistent frame** with auto-scroll, details-on-demand collapse, and no duplicates — closing BUG-260529-02 + `timer-disappears-long-runs` + `step-count-mismatch-timer-vs-panel` + the dead download link. *(sketch-first — G-2 fires)*
- [ ] **PARITY-01**: Anthropic reaches **cross-provider parity** on multi-step tasks — a synthesized **summary tail** (not a raw action-log, BUG-260514-02) and reduced **iteration bloat** (BUG-260523-04) — and non-Anthropic providers show real task descriptions (not "Generating code", BUG-260528-03); all evidence-driven (LangSmith) and shared-path-safe.

### Carry-Forward Verification

- [x] **CF-01**: The v2.7 carry-forwards are verified-and-closed or re-opened via a **cross-provider UAT sweep** at kickoff — title-gen on DeepSeek/Moonshot/Google (BUG-260527-01), Google secondary-model 404 routing, and the download-link payload; **SEED-037 download wire-up** ships as a standalone `/gsd:quick`.

---

## Future Requirements (v2.9 — Plugin Contract & Extension System)

Deferred per **D-v2.8-01** — the plugin contract is cross-milestone load-bearing (v3.0/v3.3/v3.4/v3.5+) and expensive to change wrong, so it locks on real harness telemetry. New milestone, slotted before v3.0.

- **PLUGIN-01**: Plugin contract with 6 extension types (`tool`, `panel_renderer`, `phase_type`, `file_preview`, `data_source`, `secrets_adapter`) + per-type registries
- **PLUGIN-02**: JSON-manifest validation on install; `super_admin`-gated writes; the `super_admin`/operator **role tier**
- **PLUGIN-03**: Reference plugin (PPTX preview) validates the contract end-to-end — also closes SEED-037 in-panel office viewing
- **HARNESS-JUDGE-01**: `llm_judge` evaluator-optimizer validator kind — deferred until deterministic validators are trusted
- **HARNESS-AUTHOR-01**: Visual workflow builder (drag-and-drop) — large scope disjoint from the runtime; v1 authoring is seed/JSONB/API

## Out of Scope

| Feature | Reason |
|---------|--------|
| Plugin Contract / 6 extension types | Deferred to v2.9 — lock on harness telemetry (D-v2.8-01) |
| `super_admin` / operator role tier | Rides with the plugin contract in v2.9; v2.8 workflow ownership uses the existing skills-style private + global RLS |
| Visual drag-and-drop workflow builder | Large scope disjoint from the runtime; v1 authoring is seed templates + JSONB + API |
| `llm_judge` / evaluator-optimizer validator | Defer until the 4 deterministic validators are trusted in production |
| Workflow scheduling / cron triggers | v3.4 Automations milestone |
| LangGraph / LangChain / Temporal / Celery adoption | CLAUDE.md hard rule; the existing `runs`/Redis/`asyncpg`/`task_service`/`ask_user_service` substrate already covers durability, pause/resume, concurrency, and enforcement |
| In-panel office/PDF/PPTX viewing | SEED-037 viewing rides with the v2.9 `file_preview` plugin; only the **download** wire-up ships in v2.8 |
| `threads.deep_mode_metadata jsonb` column | v2.7 PRD proposed it; dropped — no consumer in v2.8 scope (research delta #4) |
| Harness as the default mode | Deep Mode is the unchanged default; Harness is strictly opt-in |

## Traceability

Mapped during roadmap creation (2026-05-30). Phase numbering continues from v2.7 (last phase 088) → v2.8 starts at 089.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-03 | Phase 089 | Complete |
| CF-01 | Phase 089 | Complete |
| HARNESS-02 | Phase 090 | Pending |
| HARNESS-06 | Phase 090 | Pending |
| HARNESS-01 | Phase 091 | Pending |
| HARNESS-03 | Phase 091 | Pending |
| HARNESS-04 | Phase 091 | Pending |
| HARNESS-05 | Phase 091 | Pending |
| HARNESS-07 | Phase 091 | Complete |
| TOOL-05 | Phase 091 | Pending |
| MODE-01 | Phase 092 | Pending |
| MODE-02 | Phase 092 | Pending |
| CONT-01 | Phase 092 | Pending |
| PARITY-01 | Phase 093 | Pending |
| PANEL-08 | Phase 094 | Pending |
| PANEL-09 | Phase 094 | Pending |
| A11Y-03 | Phase 094 | Pending |
| CHAT-04 | Phase 095 | Pending |
| EVAL-01 | Phase 096 | Pending |
| EVAL-02 | Phase 096 | Pending |
| CONC-01 | Phase 096 | Pending |

**Coverage:**
- v2.8 requirements: 21 total
- Mapped to phases: 21 ✓ (8 phases, 089-096)
- Unmapped: 0 ✓

**Per-phase requirement count:**
- Phase 089 (Agent-Loop Extraction + Kickoff UAT): FOUND-03, CF-01 — 2 reqs
- Phase 090 (Harness Schema + RLS + Config Models): HARNESS-02, HARNESS-06 — 2 reqs
- Phase 091 (Harness Engine + 5 Phase Types + Gates + Whitelist): HARNESS-01, HARNESS-03, HARNESS-04, HARNESS-05, HARNESS-07, TOOL-05 — 6 reqs
- Phase 092 (Dual-Mode Wiring + Continue): MODE-01, MODE-02, CONT-01 — 3 reqs
- Phase 093 (Anthropic Cross-Provider Parity): PARITY-01 — 1 req
- Phase 094 (Panel Phase Timeline): PANEL-08, PANEL-09, A11Y-03 — 3 reqs
- Phase 095 (Chat Tool-Card Unification): CHAT-04 — 1 req
- Phase 096 (Eval Harness + Cross-Provider Verification + Concurrency): EVAL-01, EVAL-02, CONC-01 — 3 reqs

---
*Requirements defined: 2026-05-30*
*Last updated: 2026-05-30 after roadmap creation — 21/21 mapped across 8 phases (089-096), 0 unmapped*

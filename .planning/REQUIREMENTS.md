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

- [x] **MODE-01**: A user can switch a thread between **Deep Mode** (default, unchanged free chat) and **Harness Mode** (locked workflow); mode is per-thread (`threads.active_workflow_run_id IS NULL` = Deep). ✅ Validated 2026-06-01 (Phase 092, live on OpenAI).
- [x] **MODE-02**: Once a workflow starts, the thread is **workflow-locked** — switching back to Deep is refused server-side until the run completes or the user cancels; Cancel clears the lock in the same transaction as the terminal-status write; lock state is **per-thread** (never a global boolean — BUG-260523-01 pattern). ✅ Validated 2026-06-01 (Phase 092; 409 lock-refusal + failure-path terminalize verified live).
- [x] **CONT-01**: When an agent run hits its step cap (a Deep run OR a Harness phase), a **"Continue" affordance** resumes the same run/phase with a bounded additional step budget instead of silently dropping tool calls. *(SEED-029)* ✅ Validated 2026-06-01 (Phase 092; persist-at-cap + `/continue` + bounded 3-cap shipped, FK-unblocked; live cap-drive accepted as code-verified at close).

### Panel — Phase Timeline

- [x] **PANEL-08
**: The workspace panel shows a **live phase timeline** (current / locked / completed glyphs, gate pass/fail badges, transition log) that auto-opens on entering Harness Mode and reconciles via fetch on mount.
- [x] **PANEL-09
**: Workflow phase events ride the existing `run:{run_id}` stream and demux into a dedicated `phasesByThread` store — panel phase updates trigger **zero chat message-list re-renders** (PANEL-06 isolation preserved).

### Accessibility

- [x] **A11Y-03

**: The phase timeline meets **WCAG 2.1 AA** — keyboard-navigable, ARIA landmarks/labels, non-color-only status indicators, ≥4.5:1 contrast in both themes (vitest-axe gated).

### Cross-Provider Reliability & Eval

- [x] **EVAL-01**: A cross-provider eval (`scripts/eval_cross_provider.py`, extended) runs a multi-phase workflow on all **6 native providers** and asserts the locked phase sequence completes with correct tool round-trips — wired as the **CI regression gate**. *(SEED-034)*
- [x] **EVAL-02**: The harness passes the **4-axis UAT scoreboard** (cross-provider × multi-tool × parallel-thread × long-message) plus a **uvicorn-restart-mid-workflow** smoke per phase type (including mid-`ask_user`). *(SC#10)*
- [x] **CONC-01**: `llm_batch_agents` fan-out is bounded by `max_parallel_agents` (default 5) composing with the global Redis-Lua cap (20); a batch phase does not starve app-wide request latency (cross-tab GET stays <50ms). *(SEED-036a)* **Also covers the frontend stream-connection saturation (BUG-260530-01):** with ≥6 concurrent active runs, the HTTP/1.1 6-connection-per-host cap is saturated by one held-open streaming `fetch` per run → 15-30s thread-switch hang; fix = frontend cap-live-streams (only the viewed thread holds a live stream; background runs reconcile on return). Same parallel-thread responsiveness guarantee.
- [x] **TOOL-05
**: A **tool-count budget guard** at `get_tools()` / per-provider `max_tools` soft ceiling in `MODEL_CAPABILITIES` protects providers (esp. Google) from accuracy degradation past their tool limit; the per-phase whitelist is the structural complement. *(SEED-035)*

### Harness Cross-Provider Hardening (rescope 2026-06-01 — discuss-093)

> Live UAT (092-07) + the 092 comprehensive audit + a 2026-06-01 live-code verification proved the **harness path only works on OpenAI** (1 of 4 seed workflows, 1 of 7 providers) — a harness-substrate problem, NOT a Deep problem (Deep is provider-robust on all 7). These two requirements replace the original PARITY-01 polish rider as the milestone-blocking parity work.

- [x] **GATEWAY-01** *(Phase 092.5 — NEW)*: `agent_loop.py`'s per-provider dispatch + chunk-normalization is extracted into ONE **shared provider gateway** that Deep AND the harness consume — Deep verified **byte-identical** in isolation (089-style eval + E2E + SSE-diff GREEN before/after), every per-provider round-trip invariant preserved verbatim (Anthropic `end_turn`, Google `thought_signature`, DeepSeek `reasoning_content`, Moonshot `<think>`/empty-retry, `force_no_tools`, iteration cap). One home for all provider logic; the seam Phase 093 consumes.
- [x] **PARITY-02** *(Phase 093 — Validated 2026-06-03, passed_with_overrides)*: The Harness path reaches cross-provider parity by **consuming the gateway** — all 5 phase-types + all 4 seed workflows run end-to-end on the **native-7**: a shared **model-resolver** (resolve from the provider, never mutate saved settings) kills the stale-id class; the **ask_user round-trip** works (workflow_run-id namespace reconciled, Option (i)); the 3 never-run phase-types are completed (`split_topic` code fix → `llm_batch_agents` fan-out; verify-gate routes forward) and the 5 phase-types are **safe-by-construction** validated primitives (publish-time reachability lint extended to input/output-contract breaks); resume/Continue **surface the answer** + the ask_user **draft** (plumbing — chrome is Phase 094). **Deep byte-identical** (red line). Acceptance = **native-7 × 5-phase-type × 4-workflow LIVE UAT** + live-DB/real-provider tests (closes the mock blind spot).

### Polish Riders

- [x] **CHAT-04
**: Chat tool-cards render in **one consistent frame** with auto-scroll, details-on-demand collapse, and no duplicates — closing BUG-260529-02 + `timer-disappears-long-runs` + `step-count-mismatch-timer-vs-panel` + the dead download link. *(sketch-first — G-2 fires)*
- [~] **PARITY-01** *(RE-DEFERRED 2026-06-01 — discuss-093)*: ~~Anthropic Deep-mode parity — synthesized **summary tail** (BUG-260514-02), reduced **iteration bloat** (BUG-260523-04), non-Anthropic real task descriptions (BUG-260528-03).~~ Re-deferred: Deep is provider-robust on all 7; the 3 bugs aren't reproducing for the operator and aren't worth a shared-path risk. Re-open trigger: a focused Deep-mode UX phase OR the bugs re-reproduce. (The "cross-provider parity" the milestone actually needs is PARITY-02 — the *harness* path.)

### Cross-Provider Run Honesty (Phase 095.1 — born from 095 live UAT)

> Phase 095's all-8-provider live UAT (2026-06-06) surfaced 5 cross-provider/honesty findings + one operator design reversal. Six fixes, all shared / frontend / gateway → naturally cover all 8 providers. Maps the candidate IDs CONTEXT.md locked to their decisions; all fixes are projections/classification over data that already exists (NO migration, NO new SSE event, NO new write). Acceptance bar = OpenAI gpt-5.4-mini parity, verified LIVE across all 8 providers (SC#7 / SC#10 4-axis).

- [x] **WORKSPACE-PARITY
**: The workspace todos/tasks panel populates from a **deterministic, provider-independent mechanism** (smart-gate + activity-derivation; spikes 006/007) — fills for ALL providers on multi-step work INCLUDING those that never call `write_todos`, stays CLEAN for simple Q&A / single-tool runs, never forced/prompt-instructed, and honors `write_todos` when the model calls it. Output files render as ONE flat "Generated files" list (no hero crown, no working/hero split); all present, all downloadable (url-less → "Download unavailable"). *(D-095.1-01 frontend-derived panel projection; D-095.1-02 smart gate + `MEANINGFUL_TOOLS` + label precedence; D-095.1-06 flat list. Folds the panel-fill symptom of BUG-260604-01 + addresses `non-anthropic-generic-code-task-descriptions` via the label-inference chain. The behavioral root of BUG-260604-01 — making models actually work step-by-step — stays deferred to v2.9 / SEED-052.)*
- [x] **RUN-HONESTY
**: Every assistant response surfaces **which model/provider** generated it (`{provider} · {model} · turn N`, read from `runs.model`/`runs.provider`); a reloaded completed run shows its **true duration** (`completed_at − started_at`, never time-since-creation); and a run that produced its deliverables but ended failed/timed_out does **not** falsely offer **Resume** (deliverable-aware gate). *(D-095.1-04 model attribution run-sub; D-095.1-05 true reload timer; D-095.1-07 deliverable-aware Resume. One additive runs↔messages SELECT for 04/05 — no migration. Folds BUG-260606-02 reload-timer-inflated + BUG-260518-01 resume-after-success.)*
- [x] **PROVIDER-ERR
**: A 429 rate-limit (any provider, incl. Google `RESOURCE_EXHAUSTED`) reads as a **rate-limit-with-retry**, NOT "billing / insufficient credits" — classified at the **per-provider gateway boundary** on structured status codes (429=rate-limit, 401=auth, insufficient_quota=billing, 400=bad-request, 5xx=server, else neutral), not shared keyword-soup; uncertain → neutral truthful message, never a guessed cause. *(D-095.1-03 gateway-boundary error classification — a pure `classify_provider_error` helper in `provider_gateway/errors.py` called from the agent_loop catch; adapters byte-identical. Folds BUG-260606-01 Google-429-mislabel.)*

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
| Model-behavior fix (step-by-step / todo-loop compliance) | Phase 095.1 makes the panel HONEST about what each model did; changing model behavior itself stays at v2.9 / SEED-052 (D-095.1 NOT-in-scope) |

## Traceability

Mapped during roadmap creation (2026-05-30). Phase numbering continues from v2.7 (last phase 088) → v2.8 starts at 089. Phase 095.1 inserted 2026-06-06 (born from 095 live UAT findings).

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-03 | Phase 089 | Complete |
| CF-01 | Phase 089 | Complete |
| HARNESS-02 | Phase 090 | Pending |
| HARNESS-06 | Phase 090 | Pending |
| HARNESS-01 | Phase 091 | Complete |
| HARNESS-03 | Phase 091 | Complete |
| HARNESS-04 | Phase 091 | Complete |
| HARNESS-05 | Phase 091 | Complete |
| HARNESS-07 | Phase 091 | Complete |
| TOOL-05 | Phase 091 | Complete |
| MODE-01 | Phase 092 | Complete |
| MODE-02 | Phase 092 | Complete |
| CONT-01 | Phase 092 | Complete (live cap-drive code-verified; F9/F10 → 093) |
| GATEWAY-01 | Phase 092.5 | Complete |
| PARITY-02 | Phase 093 | **Validated (passed_with_overrides, 2026-06-03)** — D-21 native-7 LIVE re-UAT GREEN: 8/8 cells, all 4 gap-closure fixes proven LIVE (Google `thought_signature`, Moonshot `reasoning_content`, GLM `max_steps`, sub-agent model+tokens / no gpt-4o); 4-axis ✓ (cross-provider/multi-tool/parallel-thread/long-message); Deep-regression ✓ (eval 8/8, Anthropic twin byte-identical ×2, task() pass). Overrides: Dim-3 abrupt-resume retest deferred (Windows kill-friction, pre-existing infra unchanged by 093); Dim-5 result-quality (kimi fabrication / MiniMax finalize) → SEED-050/096; WR-01 accepted. UI legibility findings → 094. See 093-HUMAN-UAT.md. |
| PARITY-01 | (re-deferred 2026-06-01) | Deferred |
| PANEL-08 | Phase 094 | Complete |
| PANEL-09 | Phase 094 | Complete |
| A11Y-03 | Phase 094 | Complete |
| CHAT-04 | Phase 095 | Pending |
| WORKSPACE-PARITY | Phase 095.1 | Code-complete, pending live verify (D-01/02 panel-fill selector 095.1-01 + TodosSection precedence 095.1-02; D-06 flat Generated-files list 095.1-05; GAP-1 095.1-06 — hasActivity now reaches useDerivedPanel so the derived panel actually renders on no-write_todos runs, honest count badge, real-panel guard test). Live 8-provider Chrome-MCP UAT owned by /gsd:verify-work |
| RUN-HONESTY | Phase 095.1 | Code-complete, pending live verify (D-04 attribution run-sub + D-05 true reload timer 095.1-03; D-07 deliverable-aware Resume 095.1-05; GAP-2 095.1-07 — live attribution stamped onto the dispatch placeholder + run-sub turn decoupled from iterationCount so live==reload). Live 8-provider Chrome-MCP UAT owned by /gsd:verify-work |
| PROVIDER-ERR | Phase 095.1 | In progress (Wave 0 classifier shipped 095.1-01; agent_loop wiring in 095.1-04) |
| EVAL-01 | Phase 096 | Complete |
| EVAL-02 | Phase 096 | Complete |
| CONC-01 | Phase 096 | Complete |

**Coverage:**
- v2.8 requirements: 25 active + 1 re-deferred (PARITY-01) — rescoped 2026-06-01 (discuss-093); +3 (WORKSPACE-PARITY / RUN-HONESTY / PROVIDER-ERR) added 2026-06-06 at plan-phase 095.1
- Mapped to phases: 25 ✓ (10 phases incl. 092.5 + 095.1; 089–096)
- Unmapped: 0 ✓

**Per-phase requirement count:**
- Phase 089 (Agent-Loop Extraction + Kickoff UAT): FOUND-03, CF-01 — 2 reqs
- Phase 090 (Harness Schema + RLS + Config Models): HARNESS-02, HARNESS-06 — 2 reqs
- Phase 091 (Harness Engine + 5 Phase Types + Gates + Whitelist): HARNESS-01, HARNESS-03, HARNESS-04, HARNESS-05, HARNESS-07, TOOL-05 — 6 reqs
- Phase 092 (Dual-Mode Wiring + Continue): MODE-01, MODE-02, CONT-01 — 3 reqs
- Phase 092.5 (Provider Gateway Extraction — NEW): GATEWAY-01 — 1 req
- Phase 093 (Harness Cross-Provider Parity + Phase-Type Hardening): PARITY-02 — 1 req (PARITY-01 re-deferred)
- Phase 094 (Panel Phase Timeline): PANEL-08, PANEL-09, A11Y-03 — 3 reqs
- Phase 095 (Chat Tool-Card Unification): CHAT-04 — 1 req
- Phase 095.1 (Cross-Provider Run Honesty & Workspace Parity): WORKSPACE-PARITY, RUN-HONESTY, PROVIDER-ERR — 3 reqs
- Phase 096 (Eval Harness + Cross-Provider Verification + Concurrency): EVAL-01, EVAL-02, CONC-01 — 3 reqs

---
*Requirements defined: 2026-05-30*
*Last updated: 2026-06-06 at plan-phase 095.1 — added WORKSPACE-PARITY / RUN-HONESTY / PROVIDER-ERR (3 reqs); 25 active mapped across 10 phases (089-096), 0 unmapped*

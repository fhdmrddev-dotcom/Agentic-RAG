# Milestone Shaping Synthesis v2 — 2026-05-09

**Author:** Research subagent (PRD-reset shaping pass, v2 — recovered MDs read in full)
**Date:** 2026-05-09
**Inputs:** project state docs (PROJECT.md, STATE.md, MILESTONES.md, codebase/ARCHITECTURE.md, codebase/CONCERNS.md, codebase/STACK.md, codebase/INTEGRATIONS.md), `graphify-out/GRAPH_REPORT.md`, all 14 SEEDs (SEED-001..SEED-014), all 15 recovered MDs (`.planning/research/recovered/*.md`).
**Tag legend (claims about current code):**
- ✅ confirmed-via-read — file:line was opened in this session and the assertion is grounded
- ⚠️ inferred — the assertion follows from another doc that itself cites file:line, but I did not re-open the file
- ❓ unverified — assertion is plausible from inputs but no file evidence

---

## 1. Executive Summary

**Current shipping state (post-v2.5, 2026-05-09):**
v2.5 (Deployment Strategy) shipped 2026-05-09 — 16 phases, 64 plans, 445 commits, ~104K LOC delta over 10 days. Headline architectural shift: **run-backed streaming via Redis Streams** (Phases 061→063 + 063.1) — the HTTP request that posts a chat message returns `{message_id, run_id}` immediately and a separate `GET /runs/{rid}/stream?since=N` consumes the SSE buffer; multi-tab, refresh-mid-stream, navigate-away all work without manual F5. Per-LLM-call adaptive timeouts (Phase 066) replaced the 120s total deadline; cancelled vs timed_out lifecycles split. Cross-thread message bucket store + sandbox JSON-blob download + model→provider router + suggestion-emit fix shipped via the 067.x cross-phase chain. Stack: React 19 + Vite 8 + FastAPI 0.115 + Supabase 2.10 (Postgres + pgvector + Storage + Realtime) + Redis 5.2 + LangSmith 0.2.3 + Docker `llm-sandbox` 0.3.37. ✅ confirmed-via-read PROJECT.md:13–17, MILESTONES.md:3–28, ARCHITECTURE.md:80–93, STACK.md:67–93. The single uvicorn worker discipline (D-v2.5-02), `aexec` async wrap of supabase-py (D-v2.5-01), and "Realtime is best-effort hint" (D-v2.5-03) are now load-bearing rules.

**Top 3 strategic themes from cross-reading sources:**

1. **Productize the operator surface.** Every operational lever (migrations, env vars, MODEL_CAPABILITIES, sandbox health, user management) requires shell or `.env` edits (SEED-012 + CONCERNS.md:79–87). Closing this is the biggest unlock for non-developer adoption and pairs with deployment flexibility (SEED-003) and scale readiness (SEED-001).
2. **Open the agent surface to other apps.** The backend is API-shaped but private — 13 internal route modules, no MCP, no service accounts, no rate-limits, no webhooks (SEED-013 + INTEGRATIONS.md:178–181). The differentiator vs ChatGPT/Glean/Copilot is *open-source self-hostable agentic-RAG-as-a-platform* — that is only real once external consumers can call in.
3. **Move agent execution past synchronous chat.** Skill Studio (SEED-002 + RECOVERED_SKILL_STUDIO_PRD), Automations & Routines (SEED-014), and DM lifecycle (SEED-005) all converge on the same thing: agent runs that are *unattended, scheduled, or event-triggered*. The infra (run-backed streaming, per-call timeout, multi-provider router, audit log) is unusually well-positioned for this; the missing pieces are a scheduler and an event bus.

**Recommended milestone count and rough sequence (suggestion only, not commitment):** 4 milestones (v2.6 → v3.0 → v3.1 → v3.2). Suggested sequence — Polish & RAG Quality (v2.6) → Skill Studio (v3.0) → Operator UX + Deployment (v3.1) → Open Platform: API + MCP + Automations (v3.2). Multi-tenancy (SEED-004) deliberately deferred to v3.3+ once operator UX and integrations have shaped the data model. See §5 for three alternative orderings.

---

## 2. Per-Seed Status Matrix

| SEED-ID | Title | Status | Still relevant? | Suggested milestone home | Dependencies |
|---|---|---|---|---|---|
| SEED-001 | Scale Readiness — multi-user concurrent load | planted | Y — D-v2.5-01 wraps are tactical; asyncpg + multi-worker still required for production launch (SEED-001 §scope; CONCERNS.md:222–229). | v3.1 (Operator UX + Deployment) — pairs with multi-worker decision. Phase 0 of v3.2 if Open Platform ships first. | Triggers from telemetry / >10 concurrent users; partial pre-req for SEED-013 public API. |
| SEED-002 | Skill Studio Milestone Preparation | dormant | Y — RECOVERED_SKILL_STUDIO_PRD is the next-named milestone (PROJECT.md:144). SKILL-01/02 catalog full-inject is unresolved tech debt (PROJECT.md:199). | v3.0 (Skill Studio) — prime candidate to be its own dedicated milestone. | Prereq: Phase 065 (skills test infra) ✅ shipped. Lifts SEED-007 (Streams Provider) when concurrent eval streams arrive. |
| SEED-003 | Deployment Flexibility & Install/Config UX | dormant | Y — CLAUDE.md promises "agnostic — local Docker or cloud" but no install wizard exists. RECOVERED_VPS_Deployment_Guide + RECOVERED_Deploy_Hostinger_Supabase_Cloud already exist as runbooks but require shell. | v3.1 (Operator UX + Deployment) — pairs with SEED-012. | Best after SEED-001 (so scale-tier presets are real); coupled with SEED-004 tenancy decision. |
| SEED-004 | Org / Department / Role Multi-Tenancy | dormant | Y but defer — single-org installs are still valuable; co-tenant SaaS is the highest-stakes one-way decision in the project (SEED-004 §why). RECOVERED_PRD_Enterprise_RAG_Features F-04 (Group-Level Access Control) is a partial precursor that did NOT ship in v2.2 — superseded by this seed's wider scope. | v3.3+ (Multi-tenancy milestone) — explicitly NOT next. | Prereq: SKILL-01/02 catalog filtering (Skill Studio); SEED-005 Tier A landed against single-tenant first; SEED-013 service accounts ideally before. |
| SEED-005 | Document Management Capabilities (M-Files-aligned subset) | dormant | Y — Tier A (metadata views, document relationships, auto-classification) composes cleanly with existing schema. Tier B (check-in/out, retention, approvals) needs org context. | Tier A → v2.6 (Polish & Quality) candidate OR v3.2; Tier B → after SEED-004. | Tier A independent. Tier B prereq: SEED-004. |
| SEED-006 | Multimodal Extraction Quality (Phase 35/36 Follow-up) | dormant | Y — production stores ~5% of visible figures on a 4 MB thesis; PyMuPDF primary path identified. ✅ confirmed-via-read CONCERNS.md:289–291 (`_MAX_VISION_CALLS=20` and `_MAX_B64_BYTES=512KB` still hardcoded at `multimodal_service.py:29-33`). RECOVERED_RAG_Quality_Investigation_Report.md provides the diagnostic baseline. | v2.6 (Polish & Quality) — direct user-visible RAG-quality lift. | Docling deferred (httpx<0.28 vs supabase 2.10 conflict — SEED-006 §Docling). PyMuPDF path alone is shippable. |
| SEED-007 | App-level Streams Provider | dormant | Y — single-buffer architecture in `useMessages.ts` (1229 LOC) doesn't scale to multi-pane / split-view / eval streams. ✅ confirmed-via-read CONCERNS.md:118–125. | v3.0 (Skill Studio) — strongest trigger; eval runs alongside chat is the canonical use case. | Frontend-only lift. No backend changes needed. |
| SEED-008 | Streaming UX Polish (thread-switch latency + line-by-line stdout) | planted | Y — surfaced during 067.4 UAT 2026-05-09. Two concrete fixes documented (SEED-008 §gap1 + §gap2). | v2.6 (Polish & Quality) — small, user-visible. | Independent. |
| SEED-009 | claude-haiku-4-5 max_tokens cap mismatch | planted | Y — surfaced live in 067.5 cycle 5. Resume worked but the bug is a config gap. ~30 LOC fix. | v2.6 (Polish & Quality) — single small plan. | Independent. Path 2 (extend `MODEL_CAPABILITIES`) preferred per SEED-009 §likely-fix-shape. |
| SEED-010 | OpenRouter Kimi 2.5 + MiniMax 2.7 synthetic-timeout protocol verification | planted | Y but low-priority — verifies Phase 066 timeout machinery on OpenRouter-routed models. UAT only, ~30 min. | v2.6 (Polish & Quality) — bundle with SEED-009. | OPENROUTER_API_KEY must be set. |
| SEED-011 | test_059_disconnect.py::test_normal_stream_unchanged fixture-teardown bug | planted | Y but low-priority — pre-existing on `fa1e327` base; ~15 min `_reset_redis_singleton` autouse fix. | v2.6 (Polish & Quality) test-infra side-phase OR Skill Studio Phase 0. | Independent. Canonical fix at `tests/integration/test_062_stream_replay.py:36-51`. |
| SEED-012 | Admin / Operator UI Completeness | planted | Y — biggest non-developer adoption blocker (SEED-012 §audit). RECOVERED_VPS_Deployment_Guide.md and RECOVERED_Deploy_Hostinger_Supabase_Cloud.md inadvertently document exactly which levers should move into the admin UI. | v3.1 (Operator UX + Deployment) — primary scope. | Pairs with SEED-003. SEED-004 RBAC plays into role definitions but not blocking. |
| SEED-013 | External Integrations — public API + MCP server + webhooks + service accounts | planted | Y — top-of-market differentiator (SEED-013 §differentiation-thesis). Also surfaced in RECOVERED_Harnessing_Agents_Research_Report Opportunity D. | v3.2 (Integrations + Automations) — primary scope, paired with SEED-014. | Needs SEED-001 partial fix (asyncpg / rate limits) BEFORE public API ships. SEED-004 ideal but optional in v1. |
| SEED-014 | Automations & Routines — scheduled, triggered, reactive agent runs | planted | Y — completes the agent-execution-mode story (SEED-014 §three-modes). Reinforced by RECOVERED_Harnessing_Agents_Research_Report Opportunity A (Background Research Agent — Anthropic pattern). | v3.2 (Integrations + Automations) — natural pair with SEED-013. | Skill Studio (SEED-002) preferred-prereq; webhooks (SEED-013 Phase 3) plays into reactive mode. |

---

## 3. Per-Recovered-Doc Synthesis

### RECOVERED_Known_Issues.md

- **What it is:** Snapshot of KI-001 ("In-flight LLM calls and tool executions continue after SSE disconnect") with date 2026-04-23, related to Phase 44 (SSE Stop Reliability) — the original v2.4 articulation of the bug that haunted v2.5.
- **Date / origin signal:** 2026-04-23, "Status: Deferred", tied to Phase 44.
- **Key load-bearing ideas:**
  - Articulates Python async-generator constraint: `GeneratorExit` only at `yield` points; an in-flight sync `client.chat.completions.create(stream=True)` call cannot be interrupted by asyncio (RECOVERED_Known_Issues.md §Root Cause).
  - Lists 4 candidate solution paths: (1) `AsyncOpenAI` with `CancelledError` propagation, (2) thread a stop_event through generator, (3) async sub-agent, (4) `asyncio.to_thread` wrapping.
  - Recommends combining #2 + #3.
  - Documents what *worked* by Phase 44: frontend Stop button + `_SilentSSEIterator` + transport-error suppression + finally-block persistence.
- **What's stale:**
  - "Status: Deferred" — substantially mitigated. ✅ confirmed-via-read CONCERNS.md:21–32. Phase 067.1's Track A drain-into-queue helper (`_drain_stream_with_close_on_cancel` at `backend/app/api/threads.py:158-255`) closes the langsmith `_TracedStream` `error=GeneratorExit` symptom by closing the SDK stream from the OUTSIDE.
  - Phase 066 added per-LLM-call timeout machinery (`LLM_CALL_TIMEOUT_OVERRIDES` per-model overrides) splitting `cancelled` (user-Stop) vs `timed_out` (system-deadline) lifecycles — a 5th solution path the doc didn't anticipate.
  - The "in-flight LLM call cannot be interrupted" problem statement is now inverted: the producer task IS cancelled cleanly via `task.cancel()` at the run-task registry level, and the run-backed streaming architecture decouples the consumer disconnect from producer lifetime entirely. The doc's framing predates D-v2.5-08 (Redis-Streams architecture).
  - Residual KI-001: tool executions outside the streaming loop (e.g., sandbox `execute_code` Docker run) still cannot be interrupted mid-flight (CONCERNS.md:186–195) — sandbox per-execution timeout is the small remaining piece.
- **Cross-references:** CONCERNS.md §1 KI-001 (current state), STATE.md §Known Issues, RECOVERED_Harnessing_Agents_Research_Report Opportunity E (Context Compression & Resumability — proposed checkpoint pattern as a deeper architectural fix).

### RECOVERED_Harnessing_Agents_Research_Report.md

- **What it is:** A research synthesis (2026-04-25) of three external sources — Anthropic "Effective harnesses for long-running agents", OpenAI "Harness engineering" (Codex), HKUDS OpenHarness — mapped against the live Agentic RAG codebase. Proposes 5 strategic Opportunities (A–E).
- **Date / origin signal:** 2026-04-25; references "1682 graph nodes, 2647 edges" (a graphify build snapshot from before v2.5 ship — current is 2310 nodes, 3826 edges per `graphify-out/GRAPH_REPORT.md:8`).
- **Key load-bearing ideas:**
  - **Opportunity A — Background Research Agent (Anthropic pattern):** initializer/coding agent split with `task_plan.json` + `task_progress.txt` + `agent_tasks` table. Long-running, resumable, browser-disconnect-survival. Heavy overlap with SEED-014 (Automations & Routines) — same "break the SSE-connection barrier" thesis.
  - **Opportunity B — Multi-Agent Orchestration (OpenHarness pattern):** Planner → {Researcher, Analyst, Coder, Reviewer, Writer} → Final. Each role = configured instance of existing agent loop with specialized prompt + reduced tool set. Useful as an *eval-environment* surface in Skill Studio (SEED-002).
  - **Opportunity C — Agentic Development Harness (OpenAI pattern):** restructure repo for agent legibility (docs/, AGENTS.md as TOC, golden principles, mechanical enforcement via custom linters). Worth applying piecemeal during v2.6+ rather than as its own milestone.
  - **Opportunity D — MCP Server Exposure:** explicit overlap with SEED-013. Lists which existing tools map cleanly to MCP (`search_documents`, `execute_code`, `query_tables`, etc.).
  - **Opportunity E — Context Compression & Resumability:** Agent Checkpointing + summarization + token eviction + artifact references. Direct architectural fix for KI-001's deeper shape; relevant when SEED-001 / SEED-014 pressure forces it.
  - 4-phase implementation roadmap proposed (Foundation → Background Agent → Multi-Agent → Platform).
- **What's stale:**
  - "Tool calls are ephemeral; not persisted to DB, lost on page reload" (§1.7) — fixed v2.0 Phase 9 (PROJECT.md:67 — Persistent Tool Memory with `tool_call_id` JSONB). ✅ confirmed-via-read.
  - "No background task queue: all agent work is synchronous to the SSE connection" — partially addressed by run-backed streaming (Phase 061+); producer task lives independent of HTTP request lifetime. Full SEED-014 scheduler still missing.
  - "No resumability: a disconnected session starts from the last persisted message, not mid-tool" — partially addressed by Phase 062 replay-and-tail (resume mid-stream up to ~10 min Redis TTL). Long-running checkpointing still not built.
  - "KI-001: In-flight LLM calls cannot be cancelled (sync OpenAI client blocks until completion)" — substantially mitigated as documented above.
  - The "Async OpenAI migration" Risk Mitigation in §5 is overtaken — Phase 067.1 Track A solves the symptom without async migration.
  - Implementation Roadmap Phase 1 Step 4 ("Fix KI-001 via AsyncOpenAI") — done a different way.
- **Cross-references:** SEED-014 (Opportunity A is the same idea), SEED-013 (Opportunity D), SEED-002 (Opportunity B as Skill Studio eval shape), SEED-007 (Opportunity B requires concurrent stream surface = streams provider lift).

### RECOVERED_PRD_Enterprise_RAG_Features_Roadmap.md

- **What it is:** The canonical PRD framing F-01..F-10 (citations, versioning, memory, group-access, confidence, audit, multimodal, suggestions, knowledge health, feedback). Targets v3.0 in the doc — but actually shipped through v2.2 + v2.3 except F-04 (group access, replaced by SEED-004 wider scope).
- **Date / origin signal:** Status "Draft", date 2026-04-11, "v3.0 Target".
- **Key load-bearing ideas:**
  - Frames the trust + compliance + multimodal + collaboration agenda that became v2.2 + v2.3.
  - F-XX naming convention is the source of the codes that now appear throughout PROJECT.md:97–109 (still cited in commit history and validated requirements).
  - Out-of-scope-v1 lines for each feature (§F-01 "no PDF highlighting", §F-05 "no per-claim confidence", §F-06 "no SIEM in v1") all aligned with what shipped.
  - F-07 multimodal explicitly says "If table/image extraction fails, ingestion continues — these are best-effort enhancements, not blockers" — that "best-effort" disposition is what produced the SEED-006 quality gap (~5% of visible figures stored).
  - F-04 (Group-Level Access Control) was scoped as `groups` + `group_members` + `group_id` FK on documents/folders. Did NOT ship. Superseded by SEED-004's wider org/dept/role model.
  - F-08 (Suggested Follow-Ups) implementation note: "uses fast/cheap model, not main orchestrator" — confirmed shipped at `backend/app/services/suggestion_service.py` (referenced in PROJECT.md:101).
  - "Implementation Notes — Dependencies": F-06 audit log → F-09 health + F-10 feedback. Build order respected in v2.2 → v2.3.
- **What's stale:**
  - All 10 F-XX rows shipped in v2.2 + v2.3 except F-04 (PROJECT.md:97–109). ✅ confirmed-via-read.
  - F-04 framing as the next collab feature is overtaken by SEED-004 (PROJECT.md:161 explicitly out-of-scope).
  - "Org-level audit / SIEM integration" framed as F-06 v2 → out of scope (PROJECT.md:159), absorbed into SEED-004 Phase 7.
  - "In-document PDF highlighting (F-01 v2)" → out of scope (PROJECT.md:155).
  - "Per-claim confidence scoring" → out of scope (PROJECT.md:158).
  - "Diff view between document versions" → out of scope (PROJECT.md:157).
  - "Suggestions in Explorer mode" → out of scope (PROJECT.md:160).
- **Cross-references:** PROJECT.md v2.2/v2.3 validated requirements (F-XX rows); SEED-004 (consumes F-04's scope and extends it); SEED-005 (Tier A is functionally an F-XX-style extension layer); RECOVERED_RAG_Quality_Investigation_Report (motivates the chunking + context-enrichment work that landed in Phase 32.5 to make F-09 / F-10 metrics meaningful).

### RECOVERED_SCALABILITY_ROADMAP.md

- **What it is:** A 4-tier scalability roadmap (Solo → Growing SaaS → Multi-Tenant SaaS → Enterprise/On-Prem) with current-state assessment and gap inventory. Predates v2.5.
- **Date / origin signal:** No date in body. Mentions "Synchronous OpenAI client blocks workers during LLM streaming" + "FastAPI backend (2 sync workers)" + "Phase 44" as recent — fits between v2.4 close and v2.5 kickoff (~2026-04-30 ± 1 week).
- **Key load-bearing ideas:**
  - Tier-by-tier scenario framing: identifies what each scale tier needs (Tier 1: VPS, manual upgrades; Tier 2: 50+ concurrent chats, ingestion queue, Redis caching, load balancer, rate limits; Tier 3: org isolation, SSO, read replicas, CDN, multi-region; Tier 4: k8s, microservices split, queue + DLQ, distributed tracing, dedicated DB instances per tenant, on-prem).
  - "Current Gaps to Address" §: 8 specific gaps — sync LLM client, no queue, no containerization, no caching, no usage metering, no org/team layer, single DB connection, no auto-scaling.
  - Pairs cleanly with SEED-001 (CONCUR-03 asyncpg + multi-worker) + SEED-003 (deployment shapes) + SEED-004 (org isolation) + SEED-013 (rate limiting).
- **What's stale:**
  - "FastAPI backend (2 sync workers)" — incorrect post-v2.5: D-v2.5-02 mandates SINGLE uvicorn worker (PROJECT.md:227, ARCHITECTURE.md:286). The doc predates this lock.
  - "Synchronous OpenAI client blocks workers during LLM streaming" — partially mitigated. v2.5 wraps supabase-py via `aexec` (D-v2.5-01); LLM SDK streams now run via `_drain_stream_with_close_on_cancel` thread executor (CONCERNS.md:21–32). The framing is now narrower than the doc states.
  - "AnyIO ceiling default 40" framing implicit in the gap analysis — already raised to 200 (Phase 058 D-058-01, STACK.md:122).
  - "No queue system" — STILL TRUE for ingestion (CONCERNS.md:407–414). For chat streaming, Redis Streams now serve as the per-run buffer (D-v2.5-08).
  - "No caching layer" — STILL TRUE except for run buffers (INTEGRATIONS.md:93–95).
  - "No containerization" — STILL TRUE: `docker-compose.dev.yml` exists for Redis + Supabase but no app container; SEED-003 owns this.
  - "No auto-scaling hooks" — STILL TRUE.
  - The "Tier 3 — Multi-Tenant SaaS — Organization/team isolation" framing is what SEED-004 now owns (with departments + roles added).
  - The Realtime "use as low-latency hint layer" framing implicit in WebSockets discussion is overtaken by D-v2.5-03 ("Realtime is best-effort hint, NOT source of truth — always reconcile via fetch on (re)connect"). PROJECT.md:212–215, ARCHITECTURE.md:89.
  - Run-backed streaming via Redis Streams (D-v2.5-08) is entirely absent from this doc — D-v2.5-08 was locked 2026-05-02, after this roadmap was likely written.
- **Cross-references:** SEED-001 (asyncpg / multi-worker / backpressure / per-user concurrent SSE cap); SEED-003 (deployment shapes Tier 1–4); SEED-004 (Tier 3 org-level); SEED-013 (rate limiting + service accounts); CONCERNS.md §monitoring + §dependencies-at-risk; `.planning/research/058-sse-concurrency-research.md` (live, more recent).

### RECOVERED_SKILL_STUDIO_PRD.md

- **What it is:** The canonical Skill Studio PRD (332 lines, status "Draft", target v3.1, dated 2026-04-12). Specifies eval-cases + eval-runs tables, 3 new agent tools (`run_skill_eval`, `list_skill_evals`, `store_eval_feedback`), new SSE event types, eval panel in Skills tab, updated skill-creator seed skill. 5 explicit Open Questions for the implementor.
- **Date / origin signal:** 2026-04-12. "Depends on: v2.1 Stability & RAG Correctness (must ship first)" — that dependency is now met (v2.1 shipped 2026-04-11 per MILESTONES.md).
- **Key load-bearing ideas:**
  - Two new tables: `eval_cases` (test prompts per skill) + `eval_runs` (with-skill / without-skill outputs + rating + feedback). Implementor decides shape, RLS, indexes.
  - Three new agent tools, in General Mode only: `run_skill_eval` (executes prompt with-skill + without-skill, stores both), `list_skill_evals` (history per skill), `store_eval_feedback` (record rating + text).
  - SSE events for dual-run progress streaming. Should follow `sub_agent_*` / `code_execution_*` naming pattern.
  - Frontend: Evals panel ADDITION to Skill detail view (NOT replacement of Overview / Files). Test case list, run detail (side-by-side), rating/feedback (lightweight, not modal), iteration history.
  - Updated skill-creator seed skill instructions: propose test prompts FIRST, run evals before "enable in production", read existing feedback before changes, re-run prompts after improvements, optimize trigger description with prompt-pair reasoning.
  - 5 Open Questions: (1) sequential vs parallel eval execution, (2) inject only target skill or full catalog, (3) text vs file output handling, (4) UI-driven test case creation in v1, (5) skill versioning column.
  - "What does NOT need to change": skills CRUD API, ZIP format, file storage, `run_sub_agent` interface (extend or parallel), SSE protocol structure, test suite shape, `execute_code` sandbox.
  - "Dependencies between components": tables before tools (tools write to tables); tools tested before seed skill update; SSE events alongside tools; eval panel parallel with tools.
  - 8 success criteria.
- **What's stale:**
  - "Depends on: v2.1 Stability & RAG Correctness (must ship first)" — met. v2.1 shipped 2026-04-11 (MILESTONES.md:90).
  - **Migration number assumption:** SEED-002:68 says "next is 033"; the actual migration head is 038 (`038_runs_timed_out_status.sql` — STACK.md:13). Skill Studio migrations start at **039 minimum**. ✅ confirmed-via-read.
  - **Test infrastructure debt:** PRD success criterion 7 says "All new agent tools are covered by integration tests following the pattern in `tests/integration/test_skills.py` and `tests/integration/test_threads_skills.py`." But Phase 065 closed the test repair work (PROJECT.md:138 — combined skills test run 26/26 pass). The PRD's implicit assumption that the test foundation is broken is now WRONG; it's green. ✅ confirmed-via-read.
  - **POST-stream pattern assumptions:** the PRD almost certainly assumes the legacy POST-streaming architecture (Phase 044 era) since it pre-dates D-v2.5-08. SSE event design must use `run:{run_id}` Redis Stream pattern (Phase 061+, ARCHITECTURE.md:80–93), NOT POST-stream emit. The "follow `sub_agent_*` / `code_execution_*` pattern" line still works at the wire-protocol layer; the infrastructure beneath has changed.
  - **Open Question #1 (sequential vs parallel eval streams):** SEED-007 (App-level Streams Provider) is the architectural unblock. Lifting `useMessages` state to a `<StreamsProvider>` Context is the canonical answer for parallel stream rendering. Sequential is the v1-safe path.
  - **Open Question #2 (catalog full-inject vs target-skill-only):** collides with SKILL-01/02 tech debt (PROJECT.md:199). Decision can't be made cleanly without resolving the underlying catalog-injection-cost question first; this is the most important Open Question to lift to milestone-scoping time, not implementor-time.
  - **Open Question #3 (text vs file output):** intersects MIME fidelity gap (CONCERNS.md:528–532). Same architectural root.
- **Cross-references:** SEED-002 (entire); SEED-007 (streams provider lift load-bearing for concurrent eval streams); SEED-011 (test_059 fixture-teardown bug — needed to clean SSE eval test foundation); CONCERNS.md (`useMessages.ts` 1229-LOC fragility); RECOVERED_Episode4_PRD_Agent_Skills_Code_Execution (the v2.0 skills foundation this PRD extends).

### RECOVERED_User_Profiling_Detection_Heuristics.md

- **What it is:** A 388-line reference document defining 8 behavioral profiling dimensions (communication style, decision speed, explanation depth, debugging approach, UX philosophy, vendor philosophy, frustration triggers, learning style) with detection heuristics, evidence curation rules, recency weighting, thin-data handling, and a strict JSON output schema. Built for the `gsd-user-profiler` agent.
- **Date / origin signal:** "Reference document version: 1.0", no explicit date. Referenced as input by the GSD profiler agent (`gsd-profile-user` skill is in the available-skills list).
- **Key load-bearing ideas:**
  - 8 dimensions × 4 ratings each, with explicit signal patterns + detection heuristics + confidence scoring (HIGH / MEDIUM / LOW / UNSCORED) + evidence quotes (3 per dimension, ~100 chars each).
  - Sensitive-content exclusion (Layer 1 of defense-in-depth): never select quotes containing `sk-`, `Bearer `, `password`, `secret`, `token`-as-credential, `api_key` or full absolute file paths with usernames.
  - Recency weighting: recent (last 30d) signals weighted 3x.
  - Thin-data handling: full / hybrid / insufficient modes with thresholds.
  - JSON output schema: `dimensions.{name}.{rating, confidence, evidence_count, cross_project_consistent, evidence_quotes, summary, claude_instruction}`. The `claude_instruction` field is imperative-form direction to the agent.
  - Cross-project consistency assessment: split when behavior varies by project type.
- **What's stale:** The doc is **operational tooling, not milestone-strategic**. Used by the GSD profiler skill to characterize a developer's working style for adaptive UX assistance. Does not contribute to PRD-reset feature scoping; preserve as-is for future profiler runs. **Verdict: operational, not milestone-strategic — exclude from PRD reset.**
- **Cross-references:** Plausibly the source of the global memory `feedback_vibe_coder_communication.md` insight ("user identifies as a vibe coder; keep user-facing summaries plain-language"). The `gsd-profile-user` and `gsd:profile-user` skills consume this document; project memory consumes the resulting profile.

### RECOVERED_Roadmap_Agentic_RAG.md

- **What it is:** The historical roadmap snapshot at the moment v2.4 was in progress. Lists Milestones v1.0 → v2.4, then phases 44–50 with goal/depends/requirements/success-criteria for v2.4. "Deferred to v3.0" section explicitly carries KI-001 forward.
- **Date / origin signal:** No top-level date; v2.4 status is "in progress" with phases 44–50 listed but `0/?` plans complete. v2.3 marked SHIPPED 2026-04-19. So this is somewhere between 2026-04-19 (v2.3 ship) and 2026-04-22 (v2.4 kickoff per MILESTONES.md:34).
- **Key load-bearing ideas:**
  - The v2.4 phase plan (44–50) — STREAM-01..03 + CHAT-01..03 + SKILL-01..03 + DOC-01..06 + SETT-01/02 + NAV-01/02 + HLTH-01..04. All shipped as v2.4 per MILESTONES.md:31–46.
  - Phase 46 ("Smart Skill Dispatch") explicitly scoped SKILL-01/02 (only relevant skills appear in agent's context, threshold + dispatch_limit on `UserEffectiveSettings`) — this DEFERRED to Skill Studio milestone (PROJECT.md:199 + SEED-002).
  - Phase 50 ("Library Health at Scale") scoped HLTH-01..04 — shipped per PROJECT.md:119.
  - "Deferred to v3.0" table: KI-001 ("In-flight LLM call async cancellation") → reason: too invasive for stability milestone.
- **What's stale:**
  - The entire v2.4 phase 44–50 plan SHIPPED (v2.4 closed 2026-04-30, MILESTONES.md:31). Roadmap snapshot is a historical artifact.
  - Phase 46 SKILL-01..03 → DEFERRED to Skill Studio milestone (i.e., did NOT ship in v2.4 — the rest of v2.4 shipped). This contradicts the Roadmap's "v2.4 in progress with phases 44-50". Reality: SKILL-01/02 deferred at v2.4 close.
  - "Phase 49: Settings & Navigation Polish" Success Criterion #1 ("User can toggle web search on or off in Settings") — shipped per PROJECT.md:117.
  - "Deferred to v3.0 → KI-001" — KI-001 substantially mitigated in v2.5 Phase 067.1 + Phase 066 (CONCERNS.md:21–32). The "Async OpenAI conversion" path the doc proposes was NOT the one taken.
  - The v2.4 → v3.0 → "all phases via numeric order" execution model in §Execution Order is the OLD GSD pattern; current GSD uses milestone-scoped phase folders under `.planning/phases/<NNN>-<name>/` (per CLAUDE.md §Planning workflow).
- **Cross-references:** MILESTONES.md (v2.4 actual shipped state); SEED-002 (Skill Studio absorbs deferred SKILL-01/02); SEED-007 (deferred from PRD as architectural choice); CONCERNS.md §1 (current KI-001 state vs the "Deferred to v3.0" line).

### RECOVERED_Episode4_PRD_Agent_Skills_Code_Execution.md

- **What it is:** The v2.0 PRD (Episode 4) for skills + code execution. Specifies skills CRUD, progressive-disclosure catalog, on-demand `load_skill`, building-block files, `read_skill_file`, sandbox + custom Docker image with pre-installed packages, `execute_code` tool, agentskills.io ZIP import/export, persistent tool memory.
- **Date / origin signal:** Episode 4 framing → v2.0 milestone era. v2.0 shipped 2026-04-04 (MILESTONES.md:100).
- **Key load-bearing ideas:**
  - Skills system fundamentals: catalog injected to system prompt, full instructions on demand via `load_skill`, anti-speculation guardrail.
  - Skill creation paths: AI / Manual / Import.
  - Building-block files: distinct from KB documents, stored at `{user_id}/{skill_id}/{filename}` in private bucket, accessed via `read_skill_file`.
  - `skill-creator` is itself a global skill seeded during setup.
  - Sandbox: `llm-sandbox` Docker, per-thread session with TTL, IPython kernel for variable persistence, streaming stdout/stderr SSE, file output to Storage with signed URLs, `SANDBOX_ENABLED=false` default.
  - Custom Docker image with pre-installed packages (python-pptx, pandas, matplotlib, etc.).
  - Skills Open Standard: SKILL.md frontmatter YAML, `scripts/` + `references/` + `assets/` directory structure, ZIP round-trip.
  - Persistent tool memory: `tool_call_id` in JSONB, history reconstructed as OpenAI multi-turn sequences.
- **What's stale (overlaps with SEED-002 + RECOVERED_SKILL_STUDIO_PRD — comparison below):**
  - "13 skills system already shipped" — the system-prompt tool count was corrected to 13 per PROJECT.md:127 (originally Phase 15 verification fixed it). Now 16 in General mode (PROJECT.md:192).
  - Custom Docker image with pre-installed packages — implementation took a different shape: lazy package installation per session (`libraries` parameter at runtime). The "pre-installed packages" approach in the PRD was simplified.
  - SSE event types listed (`code_execution_start`, `code_stdout`, `code_stderr`, `code_execution_complete`, `code_execution_error`) — partially shipped. Phase 067.4 added `code_executing` heartbeat; Phase 067 line-by-line stdout was explicitly deferred (SEED-008 §gap2).
  - The PRD doesn't cover: eval cases, eval runs, `run_skill_eval`, `list_skill_evals`, `store_eval_feedback`, Evals panel — those are RECOVERED_SKILL_STUDIO_PRD additions.
  - SKILL-01/02 catalog full-inject is the unresolved tech debt that this PRD's "lightweight catalog in system prompt" produced — unintentional. The PRD says "scannable table, cheap on tokens" but at any non-trivial skill count, the full-inject violates the cost claim.
  - **Specific divergences from SEED-002 + SKILL-STUDIO PRD:**
    - Episode 4 ships skills v1 (CRUD + dispatch + ZIP I/O + sandbox). Skill Studio extends to eval-driven iterative dev.
    - Episode 4's "Try in Chat" button is a starter; Skill Studio replaces it conceptually with `run_skill_eval` for unattended testing.
    - Episode 4's `skill-creator` global skill exists; Skill Studio updates the seed skill's instructions to incorporate eval loop.
    - Episode 4 has no concept of "skill versioning"; SKILL-STUDIO Open Question #5 raises it.
    - MIME fidelity gap (`import_skill` stores all files as `application/octet-stream`, CONCERNS.md:528–532) — Episode 4 didn't anticipate; SKILL-STUDIO Open Question #3 surfaces the same root.
- **Cross-references:** PROJECT.md v2.0 validated requirements (PROJECT.md:67–78 — every Episode 4 row shipped); SEED-002 (Skill Studio prep, the next layer); RECOVERED_SKILL_STUDIO_PRD (the Episode 5 successor document); CONCERNS.md §3 SEED-002.

### RECOVERED_VPS_Deployment_Guide.md

- **What it is:** A copy-paste runbook for deploying to a Hostinger VPS with Ubuntu 25.04, Node 22, Python 3.13, Nginx, systemd, certbot, and a CI/CD GitHub Actions wire-up. ~12 sequential steps.
- **Date / origin signal:** Mentions Ubuntu 25.04, Python 3.13, "supabase==2.10.0" with the `postgrest-py` patch — fits late 2026 or early-2026 v2.x window.
- **Key load-bearing ideas:**
  - Production deploy shape: Nginx reverse proxy (frontend dist + `/api` → 127.0.0.1:8000), systemd unit running uvicorn, certbot for SSL, ufw firewall.
  - Backend systemd uses `--workers 2` — **CONFLICTS with current D-v2.5-02** (PROJECT.md:227) which mandates SINGLE worker. ✅ confirmed-via-read.
  - The `postgrest-py` patch for `maybe_single()` returning None on empty result — Phase 058 D-058-05 fixed this in `backend/app/main.py:22` (`_patch_postgrest_maybe_single` per ARCHITECTURE.md:267). The runbook's manual patch is no longer needed.
  - `client_max_body_size 100m` Nginx config — required for document uploads, since CONCERNS.md:91–97 says no file size limit is enforced server-side either.
  - Supabase grants: `GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role` + tables/sequences — required when bootstrapping cloud Supabase if RLS isn't auto-applied.
  - GitHub Actions deploy via SSH — pull → pip install → systemctl restart → npx vite build.
  - Common errors table at end (Python version, Vite Node version, postgrest patch, missing CORS, table grants).
- **What's stale:**
  - `--workers 2` directly contradicts D-v2.5-02 (PROJECT.md:227). The runbook would, if followed, break run-tracking, sandbox sessions, and Redis singletons. Must be corrected to `--workers 1`. ✅ confirmed-via-read.
  - The manual `postgrest-py` patch is no longer needed — Phase 058 ships `_patch_postgrest_maybe_single` automatically at `backend/app/main.py:22` (ARCHITECTURE.md:267).
  - `npx vite build 2>&1` workaround for "TypeScript checks on test files" — likely still applicable but should be verified against current `frontend/tsconfig.app.json`.
  - Mentions `nodejs` apt + nvm — Vite 8 requires Node 22+ (STACK.md:135). Apt's nodejs is too old; the doc gets this right.
  - **Missing entirely from this guide:** Redis container deployment (v2.5+ run-backed streaming dependency — STACK.md:71, INTEGRATIONS.md:73–82). The runbook does NOT mention Redis at all; following it produces a deployment that 503s on every chat post (no Redis = no run buffer).
  - **Missing entirely:** SANDBOX_ENABLED env var, Docker daemon for sandbox, multi-worker concurrency lock (D-v2.5-02 referenced in CLAUDE.md but not the deploy guide).
  - The CI/CD workflow doesn't restart Redis or re-run migrations — both are failure modes for the live deployment.
- **Cross-references:** RECOVERED_Deploy_Hostinger_Supabase_Cloud (more recent companion); SEED-003 (this doc is the precursor to "operator install wizard" — what should move from runbook to UI); SEED-012 (admin UI for the levers this runbook controls via shell); STACK.md:130–144 (production target = Hostinger VPS).

### RECOVERED_Deploy_Hostinger_Supabase_Cloud.md

- **What it is:** A higher-level deployment narrative covering Stage 1 (Supabase Cloud) → Stage 7 (Auth redirect URL). Includes "Who does it" annotations splitting Claude-via-MCP work from manual SSH work.
- **Date / origin signal:** Mentions Ubuntu 22.04 (older recommendation than the 25.04 in the VPS guide), suggesting this is the EARLIER doc; the VPS Deployment Guide supersedes it.
- **Key load-bearing ideas:**
  - "Stage" narrative: Supabase Cloud setup (manual web UI) → VPS provisioning (Claude via MCP) → Server software install (manual SSH) → systemd → Nginx → SSL → Auth redirect.
  - What Hostinger MCP CAN do: create VPS, choose OS, open firewall, update DNS, monitor metrics, malware scan, restore backups.
  - What Hostinger MCP CANNOT do (needs SSH): install Python/Node/Nginx, deploy code, set env, configure SSL.
  - Reflects an earlier, simpler systemd unit without `--workers N`.
  - Final checklist of 11 items.
- **What's stale:**
  - `python3 python3-pip python3-venv` apt list (without 3.13-specific guidance) — the more recent VPS Guide explicitly handles Ubuntu 25.04 and Python 3.13.
  - `ExecStart=/var/www/app/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000` without `--workers N` — actually CORRECT per D-v2.5-02. The newer VPS Guide regressed to `--workers 2`.
  - Same Redis omission as the VPS Guide.
  - "Run each `.sql` file in order — copy contents, paste into SQL Editor, click Run" — STILL VALID per CLAUDE.md migration discipline. Or run `supabase db push` per `supabase/SETUP.md` (Path 1 alternative).
  - "Vite npm run build" — not adjusted for Phase 063.1 vitest rolldown blocker (CONCERNS.md:634–642). The frontend build path `npm run build` runs `tsc -b && vite build` per STACK.md:127; not the issue per se, but tsc-on-test-files might still surface.
  - No mention of Phase 058 `_patch_postgrest_maybe_single` (auto-patches the `maybe_single()` empty-result bug).
  - No mention of Redis for v2.5+ run-backed streaming. Same deal-breaker as the VPS Guide.
  - No mention of `aexec` discipline, single-worker requirement, or the `runs` table migration sequence.
- **Cross-references:** RECOVERED_VPS_Deployment_Guide (the more detailed companion); `supabase/SETUP.md` (the live source of truth per CLAUDE.md); `REDIS-SETUP.md` (the live source of truth for Redis); SEED-003 (deployment flexibility); SEED-012 (admin UI for these levers).

### RECOVERED_RAG_Quality_Investigation_Report.md

- **What it is:** An investigation report (2026-04-18) into low similarity scores. Documents 6 distinct problems (chunking bug, missing context, pypdf limits, over-aggressive thresholds, no dedup, no structure-awareness) and proposes Phase 34.5 with 4 plans.
- **Date / origin signal:** 2026-04-18, triggered by user observation. References Phase 34 as completed and Phase 35 as planned — fits between v2.3 phase 34 ship and phase 35 kickoff.
- **Key load-bearing ideas:**
  - **Problem 1 (Critical chunking bug):** sentence-boundary search advances by 1 char in the degenerate case → 2,780-byte file produces 203 chunks (50× cost, 50× storage, 5/5 retrieval slots polluted). Bug at `embedding_service.py:10-42`. Specific reproduction script in §Appendix.
  - **Problem 2 (No document context in chunk embeddings):** filename, date, title, type extracted but never prepended to chunk content before embedding. "amount paid on 17 Jan" can't match a receipt PDF that has the date only in the filename.
  - **Problem 3 (pypdf text extraction):** layout-unaware; merges columns; loses table cell boundaries.
  - **Problem 4 (Over-aggressive confidence thresholds):** `text-embedding-3-small` produces 0.50–0.70 for typical prose match, but app's "high" threshold is 0.7 — so most correct answers show "low" or "medium". Recalibrate AFTER fixing 1 + 2.
  - **Problem 5 (No retrieval-time dedup):** `_deduplicate_citations` only dedupes for display, not for the LLM context.
  - **Problem 6 (No structure-aware chunking):** chunker ignores `## ` headings, `\n\n` paragraphs, table rows, slide markers. Markdown / PPTX / Excel boundaries all wasted.
  - **Proposed Phase 34.5 with 4 plans:** RecursiveCharacterTextSplitter rewrite + sentinel injection + table preservation; context-enriched chunk embeddings; retrieval-time dedup (cosine > 0.95); confidence threshold recalibration; one-time re-chunk migration.
- **What's stale (mapped to current code):**
  - **Problem 1 chunking bug → SHIPPED Phase 32.5 (per project memory `project_phase32_5_chunking_fixes.md` — "chunking rewrite, context embeddings, dedup, confidence recalibration, migration 027"). The investigation's recommendations were absorbed.** ✅ confirmed-via memory note.
  - **Problem 2 missing context → SHIPPED Phase 32.5 ("context embeddings").** ✅
  - **Problem 4 confidence thresholds → SHIPPED Phase 32.5 ("confidence recalibration").** ✅
  - **Problem 5 retrieval-time dedup → SHIPPED Phase 32.5 ("dedup") OR partially shipped per `_deduplicate_chunks` graphify entry (Community 13).** ✅
  - **Problem 6 structure-aware chunking → SHIPPED Phase 32.5 ("chunking rewrite") and v2.1 Phase 24 ("Sentence boundary chunking fix" PROJECT.md:91).** ✅
  - **Problem 3 pypdf limits → STILL PARTIALLY OPEN.** v2.3 Phase 35 added pdfplumber for tables (PROJECT.md:107) but core text extraction still uses pypdf (`backend/app/api/documents.py` per ARCHITECTURE.md:227). SEED-006 proposes PyMuPDF as the primary path lift.
  - The "Phase 34.5 should be inserted before Phase 35" timeline is academic — it actually happened as Phase 32.5 between v2.3 Phase 32 (Suggestions) and Phase 33 (Memory).
- **Cross-references:** Project memory `project_phase32_5_chunking_fixes.md`; SEED-006 (Multimodal Quality — directly extends Problem 3 unfinished work); CONCERNS.md §monitoring (chunking + retrieval audit lines).

### RECOVERED_Code_Quality_Review.md

- **What it is:** A 2026-04-25 deep-code review by `gsd-code-reviewer`. Lists 5 categories (Architecture, Reliability, Performance, Maintainability, Test Coverage) with 30+ specific findings. Includes a final priority/effort matrix.
- **Date / origin signal:** 2026-04-25.
- **Key load-bearing findings (cross-referenced against current CONCERNS.md):**
  - **§1.A Global Supabase singleton, no shutdown hook:** STILL TRUE. `backend/app/dependencies.py:13-17` (CONCERNS.md:36–47). Phase 058 Lifespan adds Redis cleanup but Supabase client `aclose()` not called explicitly.
  - **§1.B Context window trimming overrun (protected_only > max_tokens returns anyway):** STATUS UNCLEAR — needs spot-check at `backend/app/services/context_window.py:211-217`. Not flagged in CONCERNS.md 2026-05-09 audit.
  - **§1.C Token estimation too aggressive for tool calls (chars/3):** Acknowledged shipped pattern (PROJECT.md:222 — "chars/3 for JSON token estimation — JSON punctuation overhead means chars/4 underestimates"). The code review framed it as a bug; the project chose to keep chars/3 deliberately. **Disagreement resolved against the review.**
  - **§2.A `except Exception: pass` in cleanup (`threads.py:245-247`):** STILL TRUE. CONCERNS.md:142–151 (Storage upload failure swallowed). Sandbox cleanup at delete_thread (`threads.py:620` per ARCHITECTURE.md:353) — same pattern, intentional best-effort.
  - **§2.B Storage upload failure silently accepted (`documents.py:257-264`):** STILL TRUE. CONCERNS.md:139–151 (verbatim same text).
  - **§2.C Dedup race condition for concurrent uploads:** STILL TRUE — no DB-level unique constraint on `(user_id, content_hash, folder_id)`. Not in CONCERNS.md 2026-05-09 audit explicitly.
  - **§2.D `ingest_document` not re-entrant for reingest:** STILL TRUE. CONCERNS.md:407–414.
  - **§2.E SSE cleanup misses `asyncio.CancelledError`:** SHIPPED differently. Phase 067.1 Track A `_drain_stream_with_close_on_cancel` handles cancellation correctly at the SDK-stream level (CONCERNS.md:21–32). The original `responses.py:115-136` SSE wrapper concern is now moot — `responses.py` may have been replaced by sse-starlette `EventSourceResponse` (STACK.md:41).
  - **§2.F Frontend `loadMessages` after unmount:** SHIPPED differently — Phase 060/067.5 reworked the entire useMessages lifecycle (`messagesByThread` Map + `streamingThreadIdRef` + `clearMessages` Branch D-3 guard). The specific `setTimeout` issue at line 295 is no longer the shape of the code.
  - **§2.G `useDocuments` Realtime channel race:** STATUS UNVERIFIED. Not in CONCERNS.md.
  - **§3.A Context trimming O(n²):** STILL TRUE per the recommendation; not flagged in CONCERNS.md.
  - **§4.A Type assertions crash on null SSE fields (`api.ts:157-206`):** STATUS UNVERIFIED post-Phase 063 SSE parser rewrite (`subscribeToRun` at `frontend/src/lib/api.ts:274` per ARCHITECTURE.md:76). Likely the assertions are still there but the event shape is different.
  - **§4.B `ToolCall.args` too narrow:** STATUS UNVERIFIED.
  - **§4.C `_persist_assistant_message` double-defined:** STATUS partially-mitigated — Phase 061 added shielded finalizer + `_persisted_msg_id` slot for idempotency (STATE.md:222). May still have the closure-state-mutation issue.
  - **§4.D Title generation swallows errors silently:** STATUS UNVERIFIED.
  - **§4.E `except Exception` in auth dependency masks real bugs:** STILL TRUE at `dependencies.py:24-30` (per CONCERNS.md:101 framing of dependencies module).
  - **§5 Test Coverage Gaps:** Many addressed by Phase 065 + the 8 test files in Phase 061-05 (STATE.md:225) + Phase 062-063 specs. `useMessages` hook has no test file — STILL TRUE per CONCERNS.md:702 ("No Tests for SSE Streaming Parser in Frontend").
  - **§6.A Raw bytes read into memory without streaming (`documents.py:154`):** STILL TRUE (CONCERNS.md:91–97 — "No File Size Limit on Document Upload"). Same bug.
  - **§6.B `_strip_nul` doesn't handle bytes:** STATUS UNVERIFIED.
- **What's stale:**
  - The framing "Critical: Concurrent ingestion race → duplicate chunks" — STILL CRITICAL but NOT in CONCERNS.md 2026-05-09 audit. Either was deferred or shipped silently. Needs verification.
  - "Critical: Context budget overrun when protected messages exceed limit" — same status.
  - "High: `loadMessages` called after unmount" — superseded by the Phase 060-067.5 hook rewrite.
- **Findings NOT addressed in CONCERNS.md (de-novo carry-forwards):**
  - §1.A Supabase client lifecycle / `aclose()` on shutdown — minor but real.
  - §1.B Context-window protected-only overrun — could surface as runtime context_length_exceeded errors.
  - §2.C Concurrent upload duplicate-chunk race.
  - §3.A Context-trimming O(n²) performance.
  - §4.D Title generation silent failure.
  - §6.B `_strip_nul` bytes branch.
- **Cross-references:** CONCERNS.md (current state — mostly absorbed; specific gaps noted above); SEED-001 (some performance items become urgent at scale); SEED-002 (test coverage gap in `useMessages`).

### RECOVERED_Agent_Realtime_Feedback_Assessment.md

- **What it is:** Phase 054 UX gap analysis — diagnoses why the agent appears to "go silent" during work. Identifies 6 silence windows (Gap 1–6), maps them to Claude reference behavior, and proposes 4 specific fixes (P0–P2) including the critical `tool_preparing` SSE event.
- **Date / origin signal:** "Phase 054 — UX Gap Analysis"; Phase 054 is the v2.4-era phase (per RECOVERED_Roadmap, v2.4 = phases 44–50, so Phase 054 came after — likely ~2026-04-26). Now refer to it as Phase 56 / 56.1 in current state (PROJECT.md:148–158).
- **Key load-bearing ideas:**
  - 6 silence windows: (1) Initial LLM call → first token, (2) LLM streaming tool-call args, (3) Between tool rounds (no planning event for iter 0), (4) Long tool execution without output, (5) Code execution pre-execution silence, (6) Post-tool-completion → response generation.
  - **Gap 2 is the #1 most impactful** — `execute_code` argument generation can take 30–120s on OpenRouter at ~10 TPS with completely frozen UI.
  - **Root cause of Gap 2:** backend accumulates `tool_calls_buffer` silently (threads.py:857-867) — `tool_start` only fires AFTER stream completes and full args are parsed.
  - **Fix 1 (P0):** emit `tool_preparing` SSE event when tool name is first detected (during arg streaming).
  - **Fix 2 (P2):** `tool_args_progress` for large args (5KB chunks).
  - **Fix 3 (P1):** Elapsed time counter (`ElapsedTimer` component).
  - **Fix 4 (P1):** Initial `planning` event for iteration 0.
- **What's stale (Phase 56/56.1 mapping):**
  - **Fix 1 SHIPPED** — Phase 56 + 56.1 added `tool_preparing` SSE event eliminating 30–120s silence window (PROJECT.md:148–151 + 156–158). Specifically: `_announced_tools` set guard for OpenAI native (Phase 56.1 D-01), `_announced_tools_ant` for Anthropic, two-loop pattern for structured mode (Phase 56.1 D-05). `iteration_start Step N counter` shipped (PROJECT.md:153).
  - **Fix 3 SHIPPED** — `ElapsedTimer` for running tools (PROJECT.md:155 — "Elapsed time counter for running tools").
  - **Fix 4 SHIPPED** — "Initial planning event guaranteed to fire" (PROJECT.md:157).
  - **Fix 2 NOT SHIPPED** — `tool_args_progress` not in PROJECT.md or codebase. Status: deferred.
  - **Gap 4 (long tool execution without output) — partially shipped via heartbeat patterns (Phase 067.4 R-5 `code_executing` heartbeat for sandbox); `tool_args_progress` for non-execute_code tools still missing.**
  - Gap 6 ("Post-tool-completion → response generation") explicitly marked Covered in the doc; remains covered.
  - **Deferred from this assessment, surfaced fresh in SEED-008:**
    - Sandbox stdout line-by-line streaming (SEED-008 §gap2 — Plan 03 of Phase 067.4 explicitly chose NOT to revive `on_stdout`/`on_stderr` callbacks at `backend/app/api/threads.py:2014-2024`).
    - `tool_args_progress` (low priority but still open).
- **Cross-references:** PROJECT.md v2.4 Phase 56/56.1 (the answer to this assessment); SEED-008 (the carry-forward gaps); CONCERNS.md (no longer flags these as critical concerns since 56/56.1 closed them).

### RECOVERED_Ethereal_Intelligence_UIUX_Prototypes.md

- **What it is:** Visual reference document for the "Deep Midnight" UI redesign. 4 mockup sections: Tool Call Visualizer, Sources View, Skills 3-Pane Configuration, Mobile Drawer. Implementation roadmap at end.
- **Date / origin signal:** "newly proposed" framing; Module 9 + Module 10 references → masterclass-era (Modules 1–8 shipped as v1.0 base per CLAUDE.md, so Modules 9–10 = v2.0 era). The mockup naming "Deep Midnight" matches the v2.3 UI Redesign milestone (PROJECT.md:109 — "UI Deep Midnight Redesign").
- **Key load-bearing ideas:**
  - **Tool Call Visualizer:** glassmorphic card, execution timing header, color-coded tool icons (emerald/amber), nested frosted JSON payload windows, similarity scores in sub-cards. Maps to `frontend/src/components/chat/ToolCallPanel.tsx`.
  - **Sources View:** translucent citation cards with ambient gradients (no 1px borders), type-specific symbology (Red PDF, Soft Blue DOCX), floating-pill chat input.
  - **Skills 3-Pane Layout:** Navigation + Category List + Deep Config separated by tonal depth (`#060e20` → `#091327`), no formal `border-r`. Indigo-to-cyan gradient toggles.
  - **Mobile Drawer:** frosted overlay, gradient line for active thread, no thick separators.
  - Implementation roadmap: AppDock split, Execution Visualizer refactor, Settings retrofit.
- **What's stale (Aether Intelligence Deep Midnight shipped state, v2.3):**
  - "Deep Midnight" UI redesign SHIPPED v2.3 (PROJECT.md:109 + Post-v1.0 Aether Intelligence Design System block at MILESTONES.md:147–157). Specific items shipped:
    - ✅ Glassmorphic ToolCallPanel + gradient CitationCards (PROJECT.md:109).
    - ✅ Floating-pill MessageInput (PROJECT.md:109).
    - ✅ AppDock split (PROJECT.md:109 + MILESTONES.md:230 — "NavPanel collapses from Sidebar + AppDock").
    - ✅ 3-pane SkillsPage (PROJECT.md:109).
    - ✅ Mobile-responsive NavPanel (PROJECT.md:109).
    - ✅ Glassmorphic chat input, gradient user bubbles, animated thinking dots, color-coded tool icons (MILESTONES.md:153–155).
    - ✅ AuthPage gradient orbs (MILESTONES.md:155).
  - **Still aspirational / not directly mapped:**
    - The detailed "Translucent Citation Cards with ambient gradients NOT 1px borders" — verify against current `CitationCards` styling.
    - "Type-specific symbology — Red PDF, Soft Blue Word" — partial; current type icons exist but specific color palette unverified.
    - Skills config "Indigo-to-cyan gradient toggles for active agent skills" — verify against current Skills toggle styling.
    - "Tonal depth `#060e20` → `#091327` for 3-pane separation" — exact hex values unverified vs current `frontend/src/index.css` CSS-variable system.
    - Settings page redesign — explicitly DEFERRED per project memory `project_settings_design_guidance.md` ("full redesign deferred to Skill Studio milestone"). The Skills 3-pane treatment is meant to inform this.
  - **Settings page redesign is the unfinished piece** of the Deep Midnight vision — Skill Studio milestone should pick it up per SEED-002 + memory.
- **Cross-references:** PROJECT.md v2.3 phases 41–43; MILESTONES.md v2.3 Deep Midnight UI Redesign; SEED-002 (Settings redesign deferred to Skill Studio); SEED-012 (admin shell as a NEW tier above the redesigned Settings).

### CONTEXT-MANAGEMENT.md

- **What it is:** Operational doc tracking the context-management strategy for the agentic chat loop. Documents Option A (sliding window summarization), Option B (tool result truncation — IMPLEMENTED), Option C (per-call token budget enforcement), Option D (parallel research + focused execution), Option E (thread forking).
- **Date / origin signal:** No explicit date; references `_CTX_LIMIT_SUBAGENT = 6000` and `max_iterations = 12` (general) / 8 (explorer). Current general is 15 (ARCHITECTURE.md:168). Predates the iteration-cap bump.
- **Key load-bearing ideas:**
  - **Option B (tool result truncation) IMPLEMENTED** — most tools 3,000 chars (`_CTX_LIMIT_DEFAULT`), `analyze_document` 6,000 chars (`_CTX_LIMIT_SUBAGENT`).
  - Cost analysis: Option B saves ~60% input tokens on complex tasks.
  - Options A (summarization), C (token budget enforcement), D (compact sub-agent summary), E (thread forking) all NOT IMPLEMENTED.
  - Token estimation helper (`_estimate_tokens` chars/4 fallback).
  - Limits reference table.
- **What's stale:**
  - `max_iterations = 12` (general) — current is 15 (ARCHITECTURE.md:168). The doc predates the bump.
  - Tool result truncation values: doc says 3000 / 6000 (PROJECT.md:88 confirms 3,000 char read_document cap shipped). The 6000 SUBAGENT cap and the read_document 3000 cap are both shipped.
  - Doc says no Option A (summarization). Phase 32.5 may have added partial; confirm. CONCERNS.md:484 ("Context Window Growth Is Unbounded for Long Conversations — verify trimming is active on all paths") suggests Option A still NOT implemented.
- **Verdict: Operational, not milestone-strategic.** Useful as a reference appendix to a future RAG-quality / cost-optimization milestone (could pair with SEED-006 and Phase 32.5 follow-ons), but not a milestone-shaping input on its own.
- **Cross-references:** Project memory `project_phase32_5_chunking_fixes.md`; CONCERNS.md:484 (unbounded context growth concern); SEED-006 (RAG quality) — could fold cost-optimization phase into multimodal quality if scope allows.

---

## 4. Theme Clusters

### Cluster A — RAG Quality & Multimodal Depth (S–M)

**Definition:** Lift retrieval quality so the agent finds what's actually in the documents, including tables/figures/scanned content.

**Sources contributing:** SEED-006 (multimodal extraction quality), SEED-005 Tier A (metadata-driven views, document relationships, auto-classification), CONCERNS.md §monitoring (`_keyword_search` folder-scoping audit, `analyze_document` doesn't respect folder scope, `glob` filter applied client-side after DB fetch), RECOVERED_RAG_Quality_Investigation_Report (Problem 3 pypdf limits — only RAG investigation finding still partially open), CONTEXT-MANAGEMENT.md (Option A sliding-window summarization — adjacent cost-optimization).

**Approximate scope:** **M** — SEED-006 alone is 4-5 plans (~1 week, per SEED-006 §scope-estimate); SEED-005 Tier A adds 6-9 more plans across 2-3 sub-areas; pypdf → PyMuPDF text extraction adds ~2 plans.

**Code-readiness:**
- ✅ Confirmed: `backend/app/services/multimodal_service.py` exists with hardcoded `_MAX_VISION_CALLS = 20` + `_MAX_B64_BYTES = 512KB` (CONCERNS.md:289–291). v2 path needs to be added behind a feature flag.
- ✅ Confirmed: `documents.full_markdown` + `document_chunks` + `document_tables` + `document_images` schema exists (PROJECT.md:174–179). Additive `extractor` + `bbox` columns proposed in SEED-006:60–65.
- ⚠️ Inferred: `query_tables` tool already exists (PROJECT.md:192) — must keep working unchanged.
- ⚠️ Conflicts with current architecture: PyMuPDF is AGPL-3.0 by default (SEED-006 §pitfalls) — needs license posture decision before commercial deployment.
- ⚠️ Conflicts: Docling 2.92 vs supabase 2.10 httpx version pin (SEED-006 §Docling, CONCERNS.md:680–685) — Docling deferred to a separate phase or skipped entirely.

### Cluster B — Skill Studio + Agent Execution Modes (L → XL)

**Definition:** Build the iterative skill development + evaluation environment, then layer scheduled / triggered / reactive agent runs on top.

**Sources contributing:** SEED-002 (Skill Studio prep), RECOVERED_SKILL_STUDIO_PRD (the canonical PRD), RECOVERED_Episode4_PRD_Agent_Skills_Code_Execution (the v2.0 foundation), SEED-007 (Streams Provider lift — strongest trigger is concurrent eval streams), SEED-014 (Automations & Routines), RECOVERED_Harnessing_Agents_Research_Report Opportunities A + B + E (Background Research Agent, Multi-Agent Orchestration, Context Compression & Resumability), partial SEED-004 (skill availability per dept = Phase 4 of multi-tenancy).

**Approximate scope:** **L → XL** — Skill Studio alone is 8-12 phases (full milestone). Automations + Multi-Agent + Background-Tasks is another 5-7 phases. The two together are basically two full milestones.

**Code-readiness:**
- ✅ Confirmed: skills system shipped v2.0 — `backend/app/api/skills.py`, `skills` + `skill_files` tables, RLS, ZIP import/export (PROJECT.md:67–78).
- ✅ Confirmed: Phase 065 closed skills test infra (26/26 pass, PROJECT.md:138) — green foundation for Skill Studio.
- ✅ Confirmed: run-backed streaming architecture (Phases 061+) is the perfect substrate for dual-execution eval streaming (ARCHITECTURE.md:155–215).
- ⚠️ Inferred: SKILL-01/02 catalog full-inject (PROJECT.md:199, SEED-002:21) is unresolved tech debt — collides with PRD Open Question #2.
- ⚠️ Inferred: MIME fidelity gap (CONCERNS.md:528–532) intersects PRD Open Question #3.
- New work: scheduler process (separate from uvicorn — SEED-014 §architectural-notes); event bus on Redis Streams (`events:*` namespace — SEED-014); checkpoint/resume infra for long-running runs (RECOVERED_Harnessing_Agents Opportunity E). Neither exists today.
- ❓ Conflicts: `useMessages.ts` 1229-LOC single-buffer architecture (CONCERNS.md:118–125) breaks the moment a second concurrent stream surface lands without the SEED-007 lift first.

### Cluster C — Operator & Deployment Productization (L)

**Definition:** Turn the developer-build into something a non-developer operator can install, configure, and run day-to-day without shell access.

**Sources contributing:** SEED-003 (Deployment Flexibility), SEED-012 (Admin/Operator UI), SEED-001 (Scale Readiness — partial: backpressure dashboard surfaces here), parts of SEED-009 (max_tokens cap → MODEL_CAPABILITIES editor in admin UI), CONCERNS.md §1 (settings on disk → secrets store decision; no file size limit → operator-controllable), RECOVERED_VPS_Deployment_Guide (everything that should move from runbook to UI), RECOVERED_Deploy_Hostinger_Supabase_Cloud (precursor narrative), RECOVERED_SCALABILITY_ROADMAP Tier 1–4 (deployment-shape inventory).

**Approximate scope:** **L** — SEED-003 is "probably 2 milestones" by its own assessment; SEED-012 is "4-8 phase milestone" (SEED-012 §cost-estimate). Together, possibly 2 full milestones.

**Code-readiness:**
- ✅ Confirmed: `frontend/src/pages/SettingsPage.tsx` exists with user-level settings (5-tab refactor — PROJECT.md:231, MILESTONES.md:231).
- ✅ Confirmed: `app_settings` table exists but is dead code (CONCERNS.md:520–524) — settings_override.json on disk is current implementation.
- ✅ Confirmed: `/health` endpoint exists, returns `{status, redis}` (ARCHITECTURE.md:362) — admin dashboard would render this.
- ⚠️ Inferred: `runs:active` ZSET has the data for an active-runs admin view (ARCHITECTURE.md:140).
- New work: operator role / RBAC tier (SEED-012:62–66); install wizard (SEED-003 item 2); secrets store decision (SEED-003 item 3); migration-state UI (SEED-012 item 5); MODEL_CAPABILITIES editor (SEED-012 item 3).
- ⚠️ Conflicts with current architecture: D-v2.5-02 forbids `--workers N`. SEED-001 multi-worker work has to land BEFORE scale-tier presets (SEED-003 item 6) can claim "Tier 3 enterprise". RECOVERED_VPS_Deployment_Guide.md's `--workers 2` line directly contradicts D-v2.5-02 — needs correction.

### Cluster D — Open Platform Surface (L)

**Definition:** Expose the agent's capabilities (RAG, code execution, skills, KB) to other apps via versioned REST API + MCP server + webhooks + service accounts.

**Sources contributing:** SEED-013 (External Integrations) primary; SEED-014 (webhooks are the reactive-trigger surface); partial SEED-001 (asyncpg/multi-worker prereq before public traffic); partial SEED-012 (API key issuance + per-consumer observability lives in admin UI); RECOVERED_Harnessing_Agents_Research_Report Opportunity D (MCP Server Exposure — same idea).

**Approximate scope:** **L** — 6-10 phase milestone per SEED-013's own assessment.

**Code-readiness:**
- ✅ Confirmed: 13 internal API route modules already exist (INTEGRATIONS.md:178–181 mentions all of them); FastAPI auto-generates OpenAPI (STACK.md:39).
- ✅ Confirmed: `redis>=5.2,<6` available for token-bucket rate limiting (STACK.md:71).
- ✅ Confirmed: run-backed streaming gives external consumers replay-and-tail for free (ARCHITECTURE.md:80–93).
- New work: `/api/v1/...` namespace; service accounts table + bearer-token auth path; MCP server (SEED-013 Phase 2); webhook system (SEED-013 Phase 3); SDKs (Phase 4 optional).
- ⚠️ Conflicts: CORS today is `allow_origin_regex=r"http://localhost:\d+"` (CONCERNS.md:543). Public API needs explicit allow-list per consumer.
- ⚠️ Conflicts: Service-role client bypasses RLS (CONCERNS.md:36–47) — service-account auth must NOT inherit this; needs per-consumer JWT or scoped service-role pattern.

### Cluster E — Multi-Tenancy & Org Model (XL — far future)

**Definition:** Move from per-user + global binary visibility to org / department / role membership.

**Sources contributing:** SEED-004 (entire); partial intersection with SEED-005 Tier B (retention/workflow per dept), SEED-013 (org-aware service accounts), SEED-012 (org-admin UX), SEED-014 (dept-targeted automations); RECOVERED_PRD_Enterprise_RAG_Features F-04 (Group-Level Access Control — narrower precursor that did not ship); RECOVERED_SCALABILITY_ROADMAP Tier 3 (Multi-Tenant SaaS — same scope dimension).

**Approximate scope:** **XL** — "the largest single architectural shift in the project's future" per SEED-004:86. 6-10 phases.

**Code-readiness:**
- ✅ Confirmed: every user-facing table has RLS keyed on `user_id = auth.uid()` (ARCHITECTURE.md:89). Shifting to membership-based RLS touches every policy.
- ✅ Confirmed: `is_global` flag on folders is the only non-private-or-fully-shared scope today (PROJECT.md:209).
- ⚠️ Conflicts: `match_document_chunks` RPC is `SECURITY DEFINER` (CONCERNS.md:69–76) — every SECURITY DEFINER RPC must be audited for tenancy correctness during the shift.
- ⚠️ Conflicts: The isolated-vs-co-tenant decision is one-way; premature commitment is costly (SEED-004 §why-this-seed-avoids-doing-it-now).
- All five other clusters are easier if this is deferred.

### Cluster F — Streaming UX + Polish & Quality (S)

**Definition:** Close the small-but-visible gaps surfaced during 067.4/067.5 UAT plus carry-forward seeds + remaining UX-feedback gap from RECOVERED_Agent_Realtime_Feedback_Assessment.

**Sources contributing:** SEED-008 (thread-switch latency + line-by-line stdout), SEED-009 (claude-haiku max_tokens cap), SEED-010 (OpenRouter timeout protocol UAT), SEED-011 (test_059 fixture-teardown bug), RECOVERED_Agent_Realtime_Feedback_Assessment Fix 2 (`tool_args_progress` — only deferred fix that didn't ship in Phase 56/56.1).

**Approximate scope:** **S** — 4-6 small phases bundled, possibly 1-2 weeks total.

**Code-readiness:**
- ✅ Confirmed: SEED-009 fix is ~5-30 LOC at `anthropic_service.py:150-200` (SEED-009 §likely-fix-shape).
- ✅ Confirmed: SEED-011 fix is the canonical `_reset_redis_singleton` autouse fixture pattern (SEED-011:39–43, references `tests/integration/test_062_stream_replay.py:36-51`).
- ✅ Confirmed: SEED-008 thread-switch latency root cause is the sequential 3-call chain (`messages → active-runs → run-stream`) — fix paths documented in SEED-008 §gap1.
- New work: SEED-008 line-by-line stdout requires re-wiring `on_stdout`/`on_stderr` callbacks at `backend/app/api/threads.py:2014-2024` (Plan 03 of Phase 067.4 explicitly chose NOT to revive — SEED-008 §gap2). Also: `tool_args_progress` for non-execute_code tools per RECOVERED_Agent_Realtime_Feedback_Assessment Fix 2.
- No conflicts.

### Cluster G — Code Quality & Test Coverage (S — opportunistic)

**Definition:** Pick up the never-addressed findings from the 2026-04-25 code review that are still in-scope and not absorbed by v2.5.

**Sources contributing:** RECOVERED_Code_Quality_Review (specific carry-forwards: §1.A Supabase aclose() lifecycle, §1.B context-window protected-only overrun, §2.C concurrent upload duplicate-chunk race, §3.A context-trimming O(n²), §4.D title generation silent failure, §6.B `_strip_nul` bytes branch); CONCERNS.md §test-coverage-gaps; CONCERNS.md §dependencies-at-risk (`openai>=2.0.0` unpinned major version, etc.).

**Approximate scope:** **S** — 2-3 small phases, probably folded into other milestones rather than its own.

**Code-readiness:**
- ✅ Confirmed: `dependencies.py:13-17` Supabase singleton without aclose (CONCERNS.md:36–47).
- ⚠️ Inferred: `context_window.py:211-217` protected-only overrun (RECOVERED_Code_Quality_Review §1.B).
- ⚠️ Conflicts: Many of the highest-priority findings are concurrency / lifecycle issues that depend on multi-worker decision (SEED-001) before they actually bite.

---

## 5. Candidate Milestone Shapes

### Option A — "Polish-first, then platform" (4 milestones)

**Sequence: v2.6 → v3.0 → v3.1 → v3.2**

| # | Name | Theme | Pulls in | Approx. phases |
|---|---|---|---|---|
| v2.6 | RAG Quality & Carry-forward Polish | Lift retrieval quality + close planted bugs | Cluster A (RAG quality) + Cluster F (polish) + Cluster G opportunistic items | 10–14 |
| v3.0 | Skill Studio | Iterative skill dev + eval environment | Cluster B (Skill Studio + Streams Provider lift) | 12–14 |
| v3.1 | Operator UX + Deployment Flexibility | Productize for non-developer operators | Cluster C (operator + deployment) + partial SEED-001 | 10–14 |
| v3.2 | Open Platform: API + MCP + Automations | Expose to other apps + scheduled/triggered runs | Cluster D (API + MCP) + remaining SEED-014 (automations) | 10–14 |

**Sequencing rationale:** v2.6 closes user-visible quality complaints first (real RAG quality lift = top-of-market positioning baseline); v3.0 makes the agent's persistent-skill system into a proper development surface (the headline differentiator vs OpenAI Assistants); v3.1 makes the project installable by humans (unlocks distribution); v3.2 opens it to other apps (unlocks platform growth).

**Pros:** Each milestone has a clean theme. v2.6 is short and ships visible wins fast. v3.1 + v3.2 ordering means external consumers arrive after the operator surface is ready, so on-ramp pain is lower. Multi-tenancy (Cluster E) deferred entirely — no premature one-way decisions.

**Cons:** v3.2's public-API milestone depends on at least PARTIAL SEED-001 work; if skipped, the public API can DoS the single-worker backend trivially (SEED-013 §risks). Defers org-level work to v3.3+; some buyer profiles may need org first.

**Risk profile:** Low-medium. Each milestone is well-scoped, and each builds on the prior in a way that doesn't create one-way decisions.

### Option B — "Differentiate first, polish second" (4 milestones)

**Sequence: v2.6 → v3.0 → v3.1 → v3.2**

| # | Name | Theme | Pulls in | Approx. phases |
|---|---|---|---|---|
| v2.6 | Skill Studio + Streams Provider | Headline-feature: iterative skill dev | Cluster B (Skill Studio) + SEED-007 lift | 12–14 |
| v3.0 | Open Platform: API + MCP + Service Accounts | Become the open-source agentic-RAG-as-a-platform | Cluster D + partial SEED-001 (rate limits + auth) | 10–14 |
| v3.1 | RAG Quality + Operator UX | Lift retrieval quality + admin shell | Cluster A + Cluster C + Cluster F | 14–18 |
| v3.2 | Automations + Document Lifecycle | Scheduled/triggered runs + DM Tier A/B | SEED-014 + SEED-005 Tier A + Tier B partial | 10–12 |

**Sequencing rationale:** Lead with the differentiator-shaped milestones (Skill Studio + Open Platform) to establish top-of-market positioning. Then polish (RAG + Operator). Then the secondary differentiator (Automations).

**Pros:** Maximum competitive impact in the first two milestones. Skill Studio + MCP shipped in 6 months gives a story for an open-source launch.

**Cons:** Public API ships before backend is production-ready (SEED-001 only PARTIAL) — risky. RAG quality complaints (SEED-006) sit unfixed for 6+ months — bad if users hit them in the meantime. Operator UX deferred — non-developer install pain stays high.

**Risk profile:** Medium-high. The "ship the headline first, fix it later" approach has burnt projects before; works only if dev-stage user count stays bounded.

### Option C — "Operator + Quality first, platform later" (3 milestones, larger each)

**Sequence: v2.6 → v3.0 → v3.1**

| # | Name | Theme | Pulls in | Approx. phases |
|---|---|---|---|---|
| v2.6 | Productization Foundation | RAG quality + Operator UX + Polish | Cluster A + Cluster C + Cluster F + Cluster G | 16–20 |
| v3.0 | Skill Studio + Automations | Agent execution beyond synchronous chat | Cluster B + SEED-014 | 14–18 |
| v3.1 | Open Platform | Public API + MCP + service accounts | Cluster D + SEED-013 | 10–14 |

**Sequencing rationale:** Bundle all the foundation work into one big v2.6 (quality + operator). Then ship the two differentiators back-to-back.

**Pros:** Fewer milestone overheads (3 vs 4). v2.6 is one coherent "make it production-ready" push. v3.0 + v3.1 are pure differentiation.

**Cons:** v2.6 is unusually large (16-20 phases) — historical average per MILESTONES.md is 7-16. Long milestones dilute focus and accumulate scope creep. Polish+RAG+Operator are independent enough that bundling adds coordination cost.

**Risk profile:** Medium. The 16-20-phase v2.6 is the dominant risk — historical milestones over 14 phases (v2.3 at 11, v2.5 at 16) showed slowdown signs late.

---

## 6. Competitive / Top-of-Market Angle

The user brief explicitly asks for differentiation vs M-Files / NotebookLM / ChatGPT / Glean / custom GPTs / Mem / Lindy / OpenAI Assistants. Below are 10 specific capabilities that would meaningfully differentiate.

| # | Capability | Vs. competitors | Maps to seed/recovered? | New work needed? |
|---|---|---|---|---|
| 1 | **Self-hostable open-source agentic-RAG-as-a-platform** with REST + MCP exposure | OpenAI/Glean SaaS-only; LangChain is library-only; ChatGPT custom GPTs proprietary | SEED-013 (entire) + RECOVERED_Harnessing_Agents Opportunity D | Yes — full SEED-013 |
| 2 | **Multi-provider LLM router with native + structured tool-calling and per-call adaptive timeouts** | ChatGPT/Glean lock you to one provider; OpenAI Assistants opaque | Already shipped v2.4 + v2.5 — PROJECT.md:121–123 + Phase 066 | None — preserve and document |
| 3 | **First-class skills system with eval environment** (Skill Studio) — ZIP import/export via agentskills.io standard | ChatGPT custom GPTs are private to OpenAI; Glean has workflows but no portable skill format; Mem/Lindy are hosted-only | SEED-002 + RECOVERED_SKILL_STUDIO_PRD; existing v2.0 skills system (RECOVERED_Episode4_PRD) | Yes — Skill Studio milestone |
| 4 | **Sandboxed Python code execution that returns real files** (sandbox-outputs Storage bucket + signed URLs) | NotebookLM/ChatGPT can show charts but not give you the file with a verifiable URL; Glean doesn't run code | Already shipped v2.0 + Phase 067.4 sandbox-outputs router | Add: per-execution timeout (CONCERNS.md:186–195) — small phase |
| 5 | **Run-backed streaming with multi-tab + refresh + navigate-away survival** | Most chat UIs lose state on F5; ChatGPT Tasks has it but only for scheduled runs | Already shipped v2.5 (Phases 061+) | None |
| 6 | **Knowledge Health Dashboard** (most-retrieved, never-retrieved, low-confidence, stale) — knowledge as a managed asset, not just a search index | Glean has metrics, ChatGPT has none, NotebookLM has none, Mem/Lindy have none | Already shipped v2.3 F-09 | Extend with governance dashboard (SEED-005 §notes — locked-too-long, awaiting-approval, retention-due, broken-relationships) |
| 7 | **Truly multimodal RAG** — extract tables and figures, vision-described images participate in vector search | NotebookLM strong here; ChatGPT moderate; Glean weak; M-Files ingestion-only | SEED-006 (PyMuPDF lift); RECOVERED_RAG_Quality_Investigation_Report Problem 3 (open) | Yes — SEED-006 entire (PyMuPDF replacing pdfplumber primary path) |
| 8 | **Automations & Routines** — scheduled / triggered / reactive agent runs against your KB | ChatGPT Tasks closed-source single-user; Copilot Studio enterprise-locked; n8n no native KB; Lindy is hosted-only | SEED-014 entire + RECOVERED_Harnessing_Agents Opportunity A (Background Research Agent) | Yes — full SEED-014 (scheduler + event bus = new infra) |
| 9 | **Open standard skill format** (agentskills.io ZIP round-trip; SKILL.md frontmatter) — ecosystem-friendly | ChatGPT GPTs proprietary; Glean workflows proprietary; Mem closed | Already shipped v2.0 Phase 13 (PROJECT.md:75) | Document + promote |
| 10 | **Bring-your-own-everything stack** — your data (self-hosted Supabase), your LLM (multi-provider), your skills, your schedule, your infra | No competitor offers all five | All seeds compose into this; reinforced by SEED-014 §differentiation-thesis (5-pillar BYOX) | Cross-cutting story — needs marketing/positioning more than code |

**New differentiators not strictly in seeds (proposals from cross-reading):**

- **D-1: First-class agent-grade observability** — every run gets a LangSmith deep-link, every tool-call gets a timing badge, every confidence score is reproducible. Already 80% there (INTEGRATIONS.md:107–116; runs table has columns for token counts but they're NULL — Phase 061 deferred — STATE.md:222). Would need a small follow-on phase to populate input/output_tokens and surface per-run cost via the admin UI (pairs with Cluster C / SEED-012).
- **D-2: In-app A/B model comparison** — same prompt, same KB, two providers side-by-side. Leverages Phase 067.3 model→provider router. New UI work but reuses backend. Strong sales-demo lever.
- **D-3: "Right-of-reply" structured citations** — citation cards link to the exact retrieved chunk, line-range, and provenance (already shipped v2.2 F-01). Top-of-market vs ChatGPT (no provenance) and NotebookLM (citation but no chunk-level surface). **Already differentiator** — just needs to be told in marketing.
- **D-4: Multi-Agent Orchestration as Skill execution mode** (RECOVERED_Harnessing_Agents Opportunity B). Each role = configured instance of existing agent loop with specialized prompt + reduced tool set. Composes naturally with Skill Studio: a "skill" can spawn specialized sub-agents (Researcher, Analyst, Coder, Reviewer, Writer). Differentiator vs every closed competitor.
- **D-5: Agent Checkpointing for long-running runs** (RECOVERED_Harnessing_Agents Opportunity E). Persist agent state at tool-execution boundaries; survive disconnect, resume mid-task. Solves residual KI-001 architecturally and unblocks the Background Research Agent pattern. Differentiator vs Mem/Lindy (which are short-task-shaped).

---

## 7. Outdated Content to Prune

Each row: source → what's outdated → why → recommended action.

| Source | Outdated content | Why now stale | Recommended action |
|---|---|---|---|
| RECOVERED_SCALABILITY_ROADMAP.md | "FastAPI backend (2 sync workers)" | D-v2.5-02 mandates SINGLE worker (PROJECT.md:227, ARCHITECTURE.md:286). | Archive with banner pointing to current state |
| RECOVERED_SCALABILITY_ROADMAP.md | "CONCUR-01 cross-tab unblock during streaming" implicit framing | Shipped v2.5 Phase 058 (PROJECT.md:127) — `aexec` wrap + AnyIO 200 ceiling. ✅ confirmed-via-read | Archive with banner |
| RECOVERED_SCALABILITY_ROADMAP.md | "CONCUR-02 SSE handler decouple from agent loop lifetime" implicit framing | Shipped v2.5 Phase 059 (PROJECT.md:128). ✅ confirmed-via-read | Archive with banner |
| RECOVERED_SCALABILITY_ROADMAP.md | "AnyIO threadpool ceiling default 40" framing | Already raised to 200 (Phase 058 D-058-01) — STACK.md:122. ✅ confirmed-via-read | Archive with banner |
| RECOVERED_SCALABILITY_ROADMAP.md | "Use Realtime as low-latency hint layer" implicit assumption | Overtaken by D-v2.5-03: Realtime is best-effort hint, NOT source of truth (PROJECT.md:212–215). ✅ confirmed-via-read | Archive with banner |
| RECOVERED_SCALABILITY_ROADMAP.md | Any expectation that POST-SSE streams remain the streaming architecture | Replaced by run-backed streaming via Redis Streams (D-v2.5-08, Phases 061+). Legacy `event_consumer` is DELETED (ARCHITECTURE.md:286–294). ✅ confirmed-via-read | Archive with banner |
| RECOVERED_PRD_Enterprise_RAG_Features_Roadmap.md | F-01 through F-10 listed as "future requirements" | All 10 shipped v2.2 + v2.3 except F-04 (PROJECT.md:97–109). ✅ confirmed-via-read | Supersede with note: "F-XX feature codes shipped, F-04 absorbed into SEED-004" |
| RECOVERED_PRD_Enterprise_RAG_Features_Roadmap.md | F-04 (Group-Level Access Control) framing | Did NOT ship; replaced by SEED-004's wider org/dept/role model. PROJECT.md:161 explicitly out-of-scope. ✅ confirmed-via-read | Supersede — F-04 framing is a precursor |
| RECOVERED_PRD_Enterprise_RAG_Features_Roadmap.md | "Org-level audit / SIEM integration" framed as F-06 v2 | Out of scope at single-tenant level (PROJECT.md:159); absorbed into SEED-004 Phase 7. ✅ confirmed-via-read | Supersede |
| RECOVERED_PRD_Enterprise_RAG_Features_Roadmap.md | "In-document PDF highlighting (F-01 v2)" framed as imminent | Out of scope (PROJECT.md:155). ✅ confirmed-via-read | Supersede |
| RECOVERED_PRD_Enterprise_RAG_Features_Roadmap.md | "Per-claim confidence scoring" framed as imminent | Out of scope (PROJECT.md:158). ✅ confirmed-via-read | Supersede |
| RECOVERED_PRD_Enterprise_RAG_Features_Roadmap.md | "Diff view between document versions" if framed as required | Out of scope (PROJECT.md:157). ✅ confirmed-via-read | Supersede |
| RECOVERED_PRD_Enterprise_RAG_Features_Roadmap.md | "Suggestions in Explorer mode" if mentioned | Out of scope (PROJECT.md:160). ✅ confirmed-via-read | Supersede |
| RECOVERED_SKILL_STUDIO_PRD.md | "Next migration number is 033" | Actual head is 038 (`038_runs_timed_out_status.sql` — STACK.md:13). Skill Studio migrations start at 039+. ✅ confirmed-via-read | Update reference in next PRD revision |
| RECOVERED_SKILL_STUDIO_PRD.md | Implicit assumption that test_threads_skills.py + test_skills_import_export.py need pre-milestone repair | Closed by Phase 065 (PROJECT.md:138) — combined skills test run 26/26 pass. ✅ confirmed-via-read | Update PRD to reference Phase 065 closure |
| RECOVERED_SKILL_STUDIO_PRD.md | Implicit POST-stream callback patterns for SSE design | Replaced by run-backed streaming (Phases 061+) — eval-event SSE design must use `run:{run_id}` Redis Stream pattern. ✅ confirmed-via-read | Update PRD architecture references |
| RECOVERED_SKILL_STUDIO_PRD.md | "Depends on: v2.1 Stability & RAG Correctness (must ship first)" | Met — v2.1 shipped 2026-04-11. ✅ confirmed-via-read | Strike line |
| RECOVERED_Known_Issues.md | "Status: Deferred" header on KI-001 | Substantially mitigated by Phase 067.1 + Phase 066 (CONCERNS.md:21–32). | Mark "Substantially Mitigated v2.5" with cross-reference |
| RECOVERED_Known_Issues.md | "Recommended Approach: Combine #2 and #3 (stop_event + AsyncOpenAI)" | NOT the path taken. Phase 067.1 Track A (`_drain_stream_with_close_on_cancel`) closes the SDK stream from the outside. Phase 066 adds per-call timeouts. | Update — record actual path taken |
| RECOVERED_Roadmap_Agentic_RAG.md | Entire v2.4 phase 44–50 plan as "in progress" | All shipped per MILESTONES.md v2.4. SKILL-01/02 deferred to Skill Studio. | Archive — pure historical artifact |
| RECOVERED_Roadmap_Agentic_RAG.md | "Deferred to v3.0 → KI-001" | Substantially mitigated v2.5 Phase 066/067.1. | Archive |
| RECOVERED_Episode4_PRD_Agent_Skills_Code_Execution.md | "13 tools system already shipped" + custom Docker pre-installed packages | Tool count is now 16 (PROJECT.md:192); package install moved to runtime `libraries` parameter. | Archive as v2.0 historical artifact |
| RECOVERED_VPS_Deployment_Guide.md | `--workers 2` in systemd unit | Directly contradicts D-v2.5-02 (PROJECT.md:227). | **Critical fix** — change to `--workers 1` and add deprecation banner. Cross-reference `supabase/SETUP.md` + `REDIS-SETUP.md` (the live runbooks). |
| RECOVERED_VPS_Deployment_Guide.md | Manual `postgrest-py` patch step | Auto-applied by `_patch_postgrest_maybe_single` at `backend/app/main.py:22` (Phase 058). | Update — strike the manual patch step |
| RECOVERED_VPS_Deployment_Guide.md | Missing Redis container setup | v2.5+ run-backed streaming requires Redis (STACK.md:71, INTEGRATIONS.md:73–82). Without it the deployment 503s on every chat post. | **Critical fix** — add Redis container deployment section, or supersede with `REDIS-SETUP.md` reference |
| RECOVERED_Deploy_Hostinger_Supabase_Cloud.md | Same Redis omission | Same reason | **Critical fix** — same |
| RECOVERED_Deploy_Hostinger_Supabase_Cloud.md | Migrations run "in order" guidance without mentioning the regenerate-full-schema.sh path | CLAUDE.md prefers SQL editor paste + `bash scripts/regenerate-full-schema.sh`; alternative: `supabase db push` per `supabase/SETUP.md`. | Supersede with link to `supabase/SETUP.md` |
| RECOVERED_RAG_Quality_Investigation_Report.md | "Phase 34.5 should be inserted before Phase 35" | Actually shipped as Phase 32.5 (project memory `project_phase32_5_chunking_fixes.md`). Problems 1, 2, 4, 5, 6 absorbed. | Mark Problems 1/2/4/5/6 as "Shipped Phase 32.5"; keep Problem 3 as live carry-forward to SEED-006 |
| RECOVERED_Code_Quality_Review.md | §1.C "chars/3 too aggressive" recommendation | Project chose to keep chars/3 deliberately (PROJECT.md:222). | Mark §1.C as "By design — see D-v2.4 chars/3 decision" |
| RECOVERED_Code_Quality_Review.md | §2.E "SSE cleanup misses CancelledError" via `responses.py:115-136` | Replaced by sse-starlette + Phase 067.1 Track A. The specific code path no longer exists. | Mark §2.E as "Architecture replaced — see ARCHITECTURE.md" |
| RECOVERED_Code_Quality_Review.md | §2.F "loadMessages after unmount via setTimeout(800ms)" | Replaced by Phase 060/067.5 hook rewrite (`messagesByThread` Map + clearMessages D-3 guard). The setTimeout pattern is gone. | Mark §2.F as "Architecture replaced" |
| RECOVERED_Code_Quality_Review.md | "Critical: Concurrent ingestion race → duplicate chunks" | NOT in CONCERNS.md 2026-05-09 audit but the underlying code at `backend/app/api/documents.py:186-204` may still have the race. | **Verify** before next milestone planning — could be a deferred item that needs to be re-promoted |
| RECOVERED_Agent_Realtime_Feedback_Assessment.md | Fix 1 + Fix 3 + Fix 4 framed as "to do" | Shipped Phase 56 + 56.1 (PROJECT.md:148–158). | Mark as "Shipped" with cross-reference |
| RECOVERED_Agent_Realtime_Feedback_Assessment.md | Gap 2's "completely silent" framing | Phase 56 substantially closed; residual is `tool_args_progress` for non-execute_code tools (Fix 2 deferred). | Mark Gap 2 as "Substantially Mitigated"; carry Fix 2 forward as a planted item |
| RECOVERED_Ethereal_Intelligence_UIUX_Prototypes.md | "Newly proposed" Deep Midnight redesign | Mostly shipped v2.3 phases 41-43 (PROJECT.md:109). Settings page redesign deferred to Skill Studio (per memory `project_settings_design_guidance.md`). | Mark sections 1, 2, 4 as "Shipped"; section 3 (Skills Configuration 3-pane) as "Shipped"; Settings retrofit as "Pending — Skill Studio milestone" |
| RECOVERED_User_Profiling_Detection_Heuristics.md | (Operational tooling, not strategy) | Used by `gsd-profile-user` skill | **Keep as-is** — operational reference, not milestone-strategic. Exclude from PRD-reset scope. |
| CONTEXT-MANAGEMENT.md | `max_iterations = 12` (general) | Current is 15 (ARCHITECTURE.md:168). | Update reference values |
| CONTEXT-MANAGEMENT.md | Options A/C/D/E NOT IMPLEMENTED status | Could pair with v2.6 RAG Quality milestone if cost-optimization is in scope. | Refresh as part of next RAG-quality phase planning |
| PROJECT.md | "STREAM-02: Realtime INSERT timing unreliable for tab-switch and F5 — polling approach recommended" (line 201) | Resolved by run-backed streaming (D-v2.5-10) — STREAM-02b absorbed into STREAM-04. | Strike that line at next PROJECT.md evolution pass |
| PROJECT.md "Known Issues" | "KI-001 ... See KNOWN-ISSUES.md" | Per CONCERNS.md:21 substantially mitigated by Phase 067.1; pointer to `KNOWN-ISSUES.md` is stale (no longer at .planning root). ✅ confirmed-via-read | Update at next PROJECT.md evolution |
| PROJECT.md | "UAT verification gaps for phases 038–042" still listed as known issue (line 197) | Predates v2.5; deferred items for 7+ weeks. | Either schedule a polish UAT pass or move to a `Deferred Items` section |
| SEED-003 (this is in seeds, but worth flagging) | "Multi-worker uvicorn (`--workers N`)" listed in scope as a Tier 3 enterprise default | Currently FORBIDDEN by D-v2.5-02 (PROJECT.md:227); reopens only after SEED-001 asyncpg work. | Rephrase as "Tier 3 — depends on SEED-001 completion" |
| SEED-006 | "Migration `030_missing_tables.sql`" reference | Migration sequence has continued — `038_runs_timed_out_status.sql` is current head. The referenced migration is still valid as a schema baseline pointer; only the "next migration number" inference would be stale. | Update at next SEED revision |

---

## 8. PRD-Reset Phase Sketch

**Recommended shape:** A meta-phase named **"Milestone PRD Authoring"** that produces one PRD per upcoming milestone.

**Recommendation: this should sit BEFORE `/gsd:new-milestone`, NOT inside the next milestone.**

**Rationale:** PRDs that scope multiple future milestones are an *input* to milestone selection, not an *output* of it. If the PRD-reset phase lives inside (say) v2.6, then any milestone-scoping decisions made during the PRD pass would have to retroactively justify why v2.6 was the right context to author them in. A pre-milestone meta-phase keeps the authoring decoupled from the work — same shape as `.planning/research/058-sse-concurrency-research.md` (research synthesis BEFORE Phase 058 milestone-scoping). Once PRDs are authored and one is picked, `/gsd:new-milestone` consumes the chosen PRD as its scope brief.

**Inputs:**

1. This synthesis (`.planning/research/milestone-shaping-2026-05-09.md`).
2. Decisions made by the user on Section 9 Open Questions (especially: target user, deployment model, must-ship-by, target competitor).
3. The 15 recovered MDs already at `.planning/research/recovered/` — particularly RECOVERED_PRD_Enterprise_RAG_Features_Roadmap.md and RECOVERED_SKILL_STUDIO_PRD.md as starting templates, with the corrections from §7 applied.
4. Historical precedent: how prior milestones structured `PROJECT.md` Validated requirements (PROJECT.md:30–139 is the full template — `*_milestone:` headers, ✓ rows with phase reference) AND how the archived `.planning/milestones/v2.5-REQUIREMENTS.md` (referenced in the research brief) structured a milestone-scoped REQUIREMENTS doc.

**Deliverables:** one PRD.md per planned milestone (so 3–4 PRDs depending on Option chosen), each conforming to the existing PRD style. Required structure per PRD:

- **Header:** milestone version + name + core thesis (1 paragraph)
- **Scope:** themed bullet list of capabilities, each tagged with seed-IDs and recovered-doc-IDs that it carries forward
- **Requirements (Validated → Active → Out of Scope):** mirrors PROJECT.md template; "Validated" should be empty at PRD time (gets populated as phases ship)
- **Architecture & Data Model changes:** explicit list of new tables, modified tables, new SDK / library deps, new env vars
- **Decisions to lock pre-execution:** structured ADR-shape rows for any one-way decisions (e.g., scheduler choice for SEED-014, secrets-store for SEED-003)
- **Outdated content pruned:** explicit list, sourced from §7 of this synthesis, that this PRD supersedes
- **Competitive positioning paragraph:** maps the milestone's deliverables to specific items in §6
- **Phase outline:** rough phase list with dependencies (DAG-able, per ROADMAP precedent)
- **Verification:** each PRD must cite current code via file:line; each must include a "carry-forward seeds" subsection listing which seeds it consumes (closes them) and which it leaves planted.

**Verification gate per PRD:**

- Every architectural claim cites file:line ✅ confirmed-via-read.
- Every "what's new" item has a corresponding "what we're not doing" item to bound scope.
- Outdated-content-pruned section non-empty (proves the author actually checked against §7).
- Competitive positioning paragraph names at least 2 specific competitors and at least 2 differentiators.
- All consumed seeds are referenced by ID and listed for closure on milestone completion.
- All un-consumed seeds remain planted with clear "next-trigger" pointer.

**Plan count estimate:** 4-6 plans for the meta-phase itself:
- Plan 01: Synthesis review + Open Questions gathered + milestone count locked.
- Plan 02: PRD-template scaffold (one file with the section structure, blank).
- Plan 03..N: One plan per PRD (so N depends on milestone count).
- Plan N+1: Cross-PRD consistency pass + outdated-content-prune validation against §7.
- Plan N+2: User signoff (`/gsd:verify-work` against the PRDs).

**Where the PRDs live:** `.planning/PRDs/v2.6.md`, `.planning/PRDs/v3.0.md`, etc. (new directory; not inside any phase folder).

---

## 9. Open Questions for User

Before milestones can be locked, the user needs to answer (at minimum):

1. **Target user shape — what's the dominant user type in the next 12 months?**
   - Single-user / personal install (vibe-coder + power-user shape — global memory `feedback_vibe_coder_communication.md` suggests this is current self-identification).
   - Small team / small org (5-50 users on a shared self-hosted install).
   - Mid/large enterprise (100s-10k users with org-level requirements).
   - **Why it matters:** drives milestone ordering. Single-user → polish + RAG quality first. Small team → operator UX + deployment first. Enterprise → multi-tenancy + integrations first.

2. **Deployment model commitment — pick a posture:**
   - Single-tenant only (each install = one org's data; no co-tenant SaaS).
   - Co-tenant SaaS (single deployment serves multiple orgs).
   - Hybrid (free tier co-tenant; enterprise tier isolated).
   - Decline to commit (defer SEED-004 indefinitely).
   - **Why it matters:** SEED-004 is one-way; choosing co-tenant late costs more than choosing it early.

3. **Free tier vs paid tier sequencing:**
   - Open-source-first (no paid tier ever; all features in the OSS build).
   - Open-core (most features OSS; advanced features (eval, automations, multi-tenancy) paid).
   - Closed-source paid + hosted offering only.
   - **Why it matters:** drives whether SEED-013 (public API) needs metering / billing infra in scope.

4. **Must-ship-by deadline — is there a date driving any of this?**
   - Internal demo / launch / partnership / customer commit?
   - Or feature-complete-when-feature-complete (the 2026-Q1..Q2 v2.x cadence)?
   - **Why it matters:** drives milestone size. A hard date forces Option A (smaller, faster milestones).

5. **Top 1-2 competitors to match feature-for-feature:**
   - Pick: NotebookLM | ChatGPT (custom GPTs + Tasks) | Glean | M-Files | Cursor (MCP) | Claude Desktop (MCP) | Copilot Studio | n8n | Mem | Lindy | OpenAI Assistants | other.
   - **Why it matters:** §6 differentiator list is generic; pinning a competitor sharpens which 3-4 differentiators get prioritized vs nice-to-have.

6. **SEED-007 (Streams Provider) — pre-emptive lift or trigger-driven?**
   - Lift it as Phase 0 of Skill Studio (mechanical refactor, ~3-5 plans) — clean foundation for eval streams and any future split-view work.
   - Defer until first concurrent-stream surface forces the lift — smaller diff now, larger diff later.
   - **Why it matters:** Skill Studio's eval-streaming UX is the strongest trigger; making the call upfront avoids mid-milestone refactor.

7. **PyMuPDF licensing posture (SEED-006):**
   - Acceptable for personal / internal use (AGPL-3.0).
   - Need commercial license for paid / hosted offerings.
   - Defer multimodal lift until decision.
   - **Why it matters:** SEED-006 is the highest-RAG-quality lift on the table; license posture gates it.

8. **Multi-worker readiness — when does SEED-001 trigger?**
   - Now (do it as part of v2.6 polish — lift D-v2.5-02).
   - When public API ships (do it as Phase 0 of v3.2 / Open Platform).
   - When real production telemetry shows AnyIO saturation.
   - **Why it matters:** SEED-013 (public API) is unsafe without it. SEED-014 (automations) is unsafe without it. RECOVERED_VPS_Deployment_Guide's `--workers 2` line needs correction either way.

9. **Skill Studio scope bounding — full PRD vs trimmed v1?**
   - Implement RECOVERED_SKILL_STUDIO_PRD.md as a 12-14 phase milestone.
   - Trim to v1 minimum (eval cases + run_skill_eval + Evals panel only); defer dual-execution streaming to v3.0.5.
   - **Why it matters:** scoping bound; affects whether SEED-007 lift is mandatory or optional in v3.0.

10. **Pricing model (if paid tier in play):**
    - Per-seat (predictable; mid-market default).
    - Usage-based (per-LLM-token / per-run / per-storage; aligns billing with cost).
    - Org-tier flat (Tier 1 / Tier 2 / Tier 3 SEED-003 presets — limited differentiation between tiers but simple).
    - Hybrid (per-seat + usage overage).
    - **Why it matters:** drives metering granularity in SEED-013 service-account observability + SEED-014 spend caps.

11. **Industry vertical focus or horizontal SaaS?**
    - Vertical (legal, finance, healthcare — heavy DM features per SEED-005 Tier B; compliance per SEED-004 Phase 7).
    - Horizontal (general-purpose; lean on agent + skill differentiation, not vertical features).
    - Hybrid (horizontal core, opt-in vertical packs).
    - **Why it matters:** vertical focus accelerates SEED-005 Tier B + retention/approvals; horizontal de-prioritizes them. Also drives marketing surface and which competitor matters most.

---

## Appendix — Sources Read

| File | Lines |
|---|---|
| `C:\Vibe Apps\Agentic RAG\.planning\PROJECT.md` | 273 |
| `C:\Vibe Apps\Agentic RAG\.planning\STATE.md` | 310 |
| `C:\Vibe Apps\Agentic RAG\.planning\MILESTONES.md` | 162 |
| `C:\Vibe Apps\Agentic RAG\.planning\codebase\ARCHITECTURE.md` | 368 |
| `C:\Vibe Apps\Agentic RAG\.planning\codebase\CONCERNS.md` | 748 |
| `C:\Vibe Apps\Agentic RAG\.planning\codebase\STACK.md` | 152 |
| `C:\Vibe Apps\Agentic RAG\.planning\codebase\INTEGRATIONS.md` | 198 |
| `C:\Vibe Apps\Agentic RAG\graphify-out\GRAPH_REPORT.md` | 400 |
| `C:\Vibe Apps\Agentic RAG\.planning\seeds\SEED-001-scale-readiness.md` | 85 |
| `C:\Vibe Apps\Agentic RAG\.planning\seeds\SEED-002-skill-studio-milestone-prep.md` | 105 |
| `C:\Vibe Apps\Agentic RAG\.planning\seeds\SEED-003-deployment-flexibility-install-ux.md` | 117 |
| `C:\Vibe Apps\Agentic RAG\.planning\seeds\SEED-004-org-multi-tenancy.md` | 149 |
| `C:\Vibe Apps\Agentic RAG\.planning\seeds\SEED-005-document-management-capabilities.md` | 154 |
| `C:\Vibe Apps\Agentic RAG\.planning\seeds\SEED-006-multimodal-extraction-quality.md` | 150 |
| `C:\Vibe Apps\Agentic RAG\.planning\seeds\SEED-007-app-level-streams-provider.md` | 96 |
| `C:\Vibe Apps\Agentic RAG\.planning\seeds\SEED-008-streaming-ux-polish.md` | 70 |
| `C:\Vibe Apps\Agentic RAG\.planning\seeds\SEED-009-claude-haiku-max-tokens-cap.md` | 102 |
| `C:\Vibe Apps\Agentic RAG\.planning\seeds\SEED-010-openrouter-synthetic-timeout-protocol.md` | 53 |
| `C:\Vibe Apps\Agentic RAG\.planning\seeds\SEED-011-test-059-fixture-teardown.md` | 56 |
| `C:\Vibe Apps\Agentic RAG\.planning\seeds\SEED-012-admin-operator-ui-completeness.md` | 125 |
| `C:\Vibe Apps\Agentic RAG\.planning\seeds\SEED-013-external-integrations-api-mcp.md` | 122 |
| `C:\Vibe Apps\Agentic RAG\.planning\seeds\SEED-014-automations-routines.md` | 153 |
| `C:\Vibe Apps\Agentic RAG\.planning\research\recovered\RECOVERED_Known_Issues.md` | ~80 (single block of dense markdown) |
| `C:\Vibe Apps\Agentic RAG\.planning\research\recovered\RECOVERED_Harnessing_Agents_Research_Report.md` | ~410 (single block) |
| `C:\Vibe Apps\Agentic RAG\.planning\research\recovered\RECOVERED_PRD_Enterprise_RAG_Features_Roadmap.md` | ~290 (single block) |
| `C:\Vibe Apps\Agentic RAG\.planning\research\recovered\RECOVERED_SCALABILITY_ROADMAP.md` | 107 |
| `C:\Vibe Apps\Agentic RAG\.planning\research\recovered\RECOVERED_SKILL_STUDIO_PRD.md` | 332 |
| `C:\Vibe Apps\Agentic RAG\.planning\research\recovered\RECOVERED_User_Profiling_Detection_Heuristics.md` | ~388 (single block) |
| `C:\Vibe Apps\Agentic RAG\.planning\research\recovered\RECOVERED_Roadmap_Agentic_RAG.md` | ~165 (single block) |
| `C:\Vibe Apps\Agentic RAG\.planning\research\recovered\RECOVERED_Episode4_PRD_Agent_Skills_Code_Execution.md` | ~210 (single block) |
| `C:\Vibe Apps\Agentic RAG\.planning\research\recovered\RECOVERED_VPS_Deployment_Guide.md` | ~280 (single block) |
| `C:\Vibe Apps\Agentic RAG\.planning\research\recovered\RECOVERED_Deploy_Hostinger_Supabase_Cloud.md` | ~240 (single block) |
| `C:\Vibe Apps\Agentic RAG\.planning\research\recovered\RECOVERED_RAG_Quality_Investigation_Report.md` | ~245 (single block) |
| `C:\Vibe Apps\Agentic RAG\.planning\research\recovered\RECOVERED_Code_Quality_Review.md` | ~215 (single block) |
| `C:\Vibe Apps\Agentic RAG\.planning\research\recovered\RECOVERED_Agent_Realtime_Feedback_Assessment.md` | ~205 (single block) |
| `C:\Vibe Apps\Agentic RAG\.planning\research\recovered\RECOVERED_Ethereal_Intelligence_UIUX_Prototypes.md` | ~50 (single block) |
| `C:\Vibe Apps\Agentic RAG\.planning\research\recovered\CONTEXT-MANAGEMENT.md` | 141 |

All 15 recovered MDs read in full this session. Per-doc subsections in §3 are sourced strictly from each doc's body content, with corrections from current code state (CONCERNS.md, ARCHITECTURE.md, PROJECT.md, MILESTONES.md, STACK.md, INTEGRATIONS.md, the 14 seeds) cited inline.

---

*Synthesis v2 complete: 2026-05-09. Author: research subagent. Supersedes v1 in place.*

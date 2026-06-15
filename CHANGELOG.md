# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com), and the
project versions map to the git release tags (`v2.9`, `v2.8`, … `v1.0`) — one
section per shipped milestone, newest first. Version numbers track GSD
milestones rather than strict library semver: the leading number is a major
capability era, the second a milestone within it.

Within each release, highlights are grouped under **Added** / **Changed** /
**Fixed** where the record supports it; a milestone with a single themed thrust
keeps a flat highlight list.

---

## [v2.9] — Workflow Studio (2026-06-15)

Turned the v2.8 harness into a capability a domain expert can author in plain
English, bind to their own project's knowledge base and skills, and run to
produce a real, cited, integrity-checked deliverable — with project management
as the flagship demo (authored entirely on the generic primitives, zero
PM-hardcoded engine logic). The milestone is ~80–90% composition of shipped
v2.8 harness primitives; the net-new is the authoring UX, a project/scope
binding, ephemeral template upload, a small validation-gate library, and the
Workflows page. The red line held: workflows **compose** the shipped
harness / agent-loop / provider-gateway — they never re-implement them, Deep
Mode stayed byte-identical across all 9 phases, and there is no new runtime.

### The 6 CORE deliverables

1. **Project binding + server-side KB scope governance (098)** — a workflow
   binds to a project (a folder + its subtree) via additive-optional
   `project_folder_id`; retrieval scope is resolved server-side from the user's
   RLS context at run start and bound to every retrieval call as a parameter the
   model cannot widen. Retrieved `folder_id`s are asserted as a subset of scope
   (RLS as backstop), and out-of-scope attempts clip + emit an observable
   `scope_violation` run-log event. The subset assert is a None-gated no-op when
   scope is unset, so the shared `search_documents` path stays Deep
   byte-identical.
2. **Workflow ↔ skill composition (099)** — an `llm_agent` / `llm_single` phase
   references a project skill via optional `skill_ref`; the skill's instructions
   and files compose into the phase framing with `read_skill_file`
   auto-whitelisted, and the skill version is snapshotted into the locked
   definition (migration 067 sibling column + CAS) so a later edit or delete
   can't change a published run. Proven on 6+ providers; immutability proven
   live.
3. **Ephemeral template upload + template-fill + integrity (100 / 101 / 101.1)**
   — a user hands the workflow a `.docx`/`.pptx`/`.xlsx` template for ONE run
   (workspace-only, `kind=template_input`, TTL + cron sweep, RLS-scoped, never
   KB-ingested, never searchable — which also closes the upload-injection
   vector). The shared guaranteed-structured-emission `llm_emit` layer FORCES the
   model to emit a cited field-map against a strict Pydantic schema, which a
   pinned deterministic no-model-code driver renders into a real deliverable;
   every value carries a source chunk/page, and a corrupt or unopenable file can
   never reach the user as "done" (re-open integrity gate + Jinja
   `SandboxedEnvironment` SSTI containment).
4. **Reusable validation-gate library + output-quality judge hard-wall (102)** —
   a closed `VALIDATOR_REGISTRY` of validator kinds (`citations_required`,
   `freshness` → `ask_user`, `structure_check`, `output_file_valid`,
   `llm_judge_rubric`) that any phase can attach to the existing gate +
   bounded-retry loop. An `llm_judge` plus a publish-time golden run form a HARD
   publish blocker (QUAL-01): a structurally-lint-clean workflow that produces
   bad output **cannot** publish. The judge works cross-provider and grades both
   prose and template-fill.
5. **Workflows page + authoring API + NL authoring (103)** — a user describes a
   workflow in natural language and receives a valid draft via a single forced
   emit over the strict `WorkflowDefinition` schema, grounded on the project
   folder tree + tool/skill registry + any uploaded template, auto-retrying once
   against the validation error then failing honestly (never a partial draft). A
   built Workflows page hosts a project-filtered library, a Builder with a
   read-only vertical phase-spine graph (a view, not drag-to-build — a deliberate
   anti-feature for the domain-expert buyer) + side-panel forms, an 8-stage
   publish gauntlet with the judge hard-wall, and Run, which forks a new chat
   thread and kicks off a real server-side run.
6. **PM flagship content pack (104)** — charter / weekly-status-report /
   risk-register templates + 2 published workflow defs + a synthetic "Project
   Meridian" corpus, authored entirely on the generic primitives. The headline
   demo ran green live: a single template-fill status report from the project KB,
   cited + integrity-checked, across a 7-model cross-provider sweep with honesty
   on all 7.

### Added — 14 CORE requirements shipped & validated

- **PROJ-01** — workflow bound to a project folder (optional
  `project_folder_id`); old unbound workflows still validate and run
  (zero-migration, additive). [098]
- **PROJ-02** — bound workflow defaults retrieval to its project-folder subtree;
  optional per-phase `folder_scope` narrows it; scope comes from the binding, not
  a prompt hint. [098]
- **GOV-01** — retrieval scope resolved server-side from the user's RLS context
  at run start, bound as a parameter the model cannot override; retrieved
  `folder_id`s asserted subset of scope; out-of-scope attempts clipped +
  observable. [098]
- **WFSKILL-01** — `llm_agent` / `llm_single` phase references a skill via
  optional `skill_ref`; skill version snapshotted into the locked definition;
  Deep-mode chat byte-identical. [099]
- **TMPL-01** — ephemeral template upload: `.docx`/`.pptx`/`.xlsx` into a thread
  for one run (workspace-only, `kind=template_input`, RLS-scoped), never
  ingested / embedded / searchable, expires via TTL + cron sweep. [100]
- **TMPL-02** — fill that exact template from project-KB content via a cited
  Pydantic field-map (each field nullable, carrying source chunk/page), rendered
  deterministically by pinned sandbox code. [101 / 101.1]
- **TMPL-03** — filled template re-opened with the same library to assert
  integrity before delivery; a corrupt/unopenable file is caught and never
  delivered; SSTI contained via `SandboxedEnvironment`. [101 / 101.1]
- **GATE-01** — reusable library of validator kinds any phase can attach, riding
  the existing gate + bounded-retry loop. [102]
- **QUAL-01** — workflow declares exactly one `business_requirement`; an
  `llm_judge` output-quality gate + a publish-time golden run are a HARD publish
  blocker — lint-clean-but-bad-output cannot publish. [102]
- **WFAUTH-01** — create/edit a workflow as a draft (CRUD) on a new Workflows
  page, with publish-time structural lint (reachable, terminal, satisfiable
  inputs) blocking invalid publishes. [103]
- **WFAUTH-02** — describe a workflow in natural language and receive a valid
  draft (one-shot structured generation over the strict `WorkflowDefinition`
  schema, grounded + auto-retrying against the validation error). [103]
- **WFAUTH-03** — Workflows page renders a read-only live graph of a workflow's
  phases/edges (view, not drag-to-build). [103]
- **WFAUTH-04** — published workflow browsable in a project-filtered library and
  runnable from a thread (thread enters workflow mode, Deep is the resting
  default); definitions immutable-on-publish + versioned. [103]
- **PM-01** — PM flagship content pack authored entirely on the generic
  primitives; headline single template-fill demo runs end-to-end, cited +
  integrity-checked. [104]

### Changed

- The `llm_emit` emission layer became the single home for any typed-artifact
  workflow (FORCE a cited field-map → deterministic render), not a template-fill
  one-off — capability-tiered forcing + narrated-JSON recovery keep it reliable
  across the native-7 (D-101.1).
- Cross-provider became a first-class acceptance bar: the SC#10 4-axis scoreboard
  (cross-provider × multi-tool × parallel-thread × long-message) gated every
  workflow-run-bearing phase; provider-specific handling stays at the
  gateway/service boundary and the shared fill path never branches.
- NL authoring reuses the existing forced-emit substrate over the provider
  gateway (~90% reuse of the shipped `forced_emit` + the 092.5 gateway
  `force_tool_name`) — it never opens the agent loop or adds an SDK path.

### Fixed

- 102's `llm_judge` publish gate had never actually worked live — driving the
  REAL publish endpoint on a real golden run surfaced 6 mock-masked blockers
  (golden-run producer-shell FK, judge cross-provider key, openai-compat base
  URL, OpenAI strict-schema, publish-stage judge retry, judge-grades-deliverable
  field-map) that static def-shape tests had false-green'd.
- 104 found 2 blocking double-gate engine bugs (BUG-260615-01): the first
  `llm_emit` phase to attach `citations_required` + `output_file_valid` over an
  already-rendered `.docx` over-rejected it because emit success output lacked
  `retrieved_ids` / integrity-verdict — caught only by live cross-provider UAT.
- Google function-calling accuracy degrades past a modest tool count, so the
  harness path caps Google at `max_tools=16` (whitelist tools always retained);
  Deep-mode `get_tools` is untouched.

### Stats

- 9 CORE phases (097–104, incl. the inserted emission-layer phase 101.1), 57
  plans, ~6.3 plans/phase, ~7.1 plans/day.
- 418 commits (99 `feat`), 678 files changed, +88,561 / −514 lines over
  2026-06-08 → 2026-06-15 (8 days).
- 14/14 CORE requirements shipped + validated; 5/5 STRETCH deferred.
- No formal milestone audit run — substituted by per-phase verify-work +
  secure-phase + live cross-provider UAT. Secure-phase results: 102 — 34/34
  threats + 7/7 SC#10; 103 — 32 threats / 0 open; 104 — 15 threats / 0 open +
  Nyquist-compliant + UAT 5/5.

### Deferred

- **STRETCH Phase 105** — Scheduled/Recurring Triggers + Budget Caps (SCHED-01);
  carries a HARD prerequisite (a gateway spend meter — no schedule without a
  budget).
- **STRETCH Phase 106** — Citation-Traceable Grid Renderer (GRID-01); risk
  register / RTM / stakeholder matrix as a grid where every cell is agent-filled
  + source-cited.
- **STRETCH Phase 107** — Per-Run Provenance Receipt View (GOV-02); surface the
  already-recorded provenance chain as an auditable EU-AI-Act-Art-12-shape
  receipt.
- **STRETCH Phase 108** — Plugin Contract Lock: `phase_type` + `file_preview`
  (PLUG-01); lock the first two contract types on real flagship telemetry
  (closes the SEED-037 office-viewer gap).
- **STRETCH Phase 109** — Operator/Admin Role Tier (ROLE-01); self-serve global
  workflow publish behind an operator role, only if global sharing becomes a
  headline.
- 40 acknowledged deferred items total at close (operator-approved, zero CORE
  blockers); SEED-082 (emit-gate policy `strict|flag|partial|draft` + model-fit
  routing) carried forward; SEED-005 (Enhanced Document Structure) flagged as the
  next-milestone candidate.

---

## [v2.8] — Harness Engine & Workflow Mode (2026-06-07)

A deterministic, auditable, locked-workflow runtime built ~80% from shipped
primitives, with a per-thread Deep/Harness dual-mode toggle — Deep stayed
byte-identical.

### Added

- **The Harness Engine (091)** — a hand-rolled async transition loop (2-phase
  write + reachability lint + `PHASE_TYPE_REGISTRY`), 5 phase-type executors, 4
  validation-gate kinds + bounded retry, and a per-phase tool whitelist; zero new
  dependencies.
- Dual-mode wiring + native-7 cross-provider parity (092 + 093): per-thread
  toggle on `active_workflow_run_id`, server-enforced lock (409), real N-way
  `llm_batch_agents` fan-out.

### Changed

- Agent-loop + provider-gateway extraction (089 + 092.5): `agent_loop.py` lifted
  out of the `threads.py` god file, then provider dispatch extracted into a
  shared `provider_gateway/` that Deep AND the harness consume — proven
  byte-identical.
- Legibility + run honesty (094 / 095 / 095.1) plus an
  eval/concurrency/resumability gate (096).

### Fixed

- Google / Moonshot / GLM harness round-trips repaired (dropped finish-event
  reasoning, `max_steps`, native-tool registry misses).

### Stats

- 10 phases, 67 plans, 498 commits, +107,662 / −6,187 across 578 files.

---

## [v2.7] — Agent Workspace & Panel (2026-05-30)

A per-thread workspace filesystem plus the right-side collapsible workspace
panel — files, todos, version diffs, and the `ask_user` pause/resume seam.

### Added

- Per-thread workspace filesystem: `workspace_files` + `workspace_file_versions`,
  hybrid inline-Postgres (≤256 KB) / Storage, FK-chain RLS, 5 tools, 4
  owner-scoped GETs.
- 3 new agent tools: `write_todos`; `task` (sub-agents, 1-level nesting +
  `Semaphore(3)` / Redis cap 20); `ask_user` (the codebase's first Redis pub/sub
  cross-worker pause/resume).
- Right-side workspace panel: open/rail/hidden `ChatLayout` grid, todos, file
  browser with per-type preview, client-side unified-diff viewer, chat↔panel
  seam.

### Changed

- Tool-dispatch extracted out of `threads.py` into `tool_dispatcher.py` (the G-5
  extension contract).

### Fixed

- WCAG 2.1 AA on all 8 panel surfaces (vitest-axe gate, contrast fixed in both
  themes).

### Stats

- 6 phases, 28 plans.

---

## [v2.6] — Foundation: RAG Quality + Multi-Worker + Polish (2026-05-27)

Per-aspect extraction dispatcher, multi-worker uvicorn, a 9-provider roster, and
a live-execution UX refactor — the largest milestone by phase count.

### Added

- Per-aspect extraction dispatcher with swappable engines (Camelot tables, 53.5×
  recall vs pdfplumber; `pymupdf_full` images); migrations 039–047.
- 9 LLM providers integrated (OpenAI, Anthropic native SDK, Google, DeepSeek,
  Kimi/Moonshot, MiniMax, GLM/Zhipu, OpenRouter, Ollama).
- Live-execution UX refactor: RunCard per turn, Editor-Inset tool-call panel,
  Focus Mode.

### Changed

- Multi-worker uvicorn (`WORKER_COUNT=2`) with cross-worker cancel via Redis
  zombie-heal + sandbox re-attach; `StreamsProvider` context lift (`useMessages`
  1229 LOC → <100).
- Settings architecture unification (36 keys → `app_settings`).

### Fixed / Removed

- Docling formally retired (broke fast/light extraction without delivering
  recall).

### Stats

- 35 phases, 91 plans, 846 commits, +183K lines (16 days).

---

## [v2.5] — Deployment Strategy (2026-05-09)

Run-backed streaming architecture — a Redis Streams durable buffer with
replay-and-tail so streams survive tabs, refreshes, and navigation.

### Added

- Run-backed streaming: `asyncio.Queue` + sse-starlette, Redis Streams
  `run:{run_id}` buffer, `GET /runs/{rid}/stream?since=N` replay-and-tail, POST
  returns `{message_id, run_id}` + frontend reattaches.
- Adaptive run timeouts + lifecycle states: per-LLM-call budget resetting on tool
  boundaries, cancelled vs timed_out distinction, Resume button.

### Fixed

- Backend SSE concurrency unblocked (`aexec` async wrapper + AnyIO 200-token
  limiter): cross-tab GET dropped from ~30 s queued to <1 s during streaming
  (CONCUR-01).
- Streaming render/storage fixes (067.2–067.5 cross-phase chain): per-thread
  `messagesByThread` Map, blob-fetch downloads, model→provider router.

### Stats

- 15 phases shipped (+1 deferred), 64 plans, 445 commits.

---

## [v2.4] — Stability, Polish & UX Fixes (2026-04-30)

Cross-provider tool-calling reliability, the Anthropic native SDK, and a broad
UX-polish pass.

### Added

- `MODEL_CAPABILITIES` registry routes to native or structured tool-calling mode;
  `tool_parser.py` deterministic JSON extraction; 32+ tests.
- Anthropic native SDK integration (`anthropic_service.py`) with prompt caching.
- Agent real-time feedback: `tool_preparing` SSE eliminates the 30–120 s silence
  window; ElapsedTimer; iteration Step-N counter.

### Changed

- Context-aware sub-agent routing (keyword escalation to a capable tier, tiktoken
  estimation) + full multi-provider model-role control with 404 fallback.

### Fixed

- PROMPT-01 generation/Q&A disambiguation fix.

### Stats

- 12 phases shipped (+2 deferred), 42/44 plans.

---

## [v2.3] — Memory, Multimodal & Experience (2026-04-19)

Cross-thread memory, multimodal document intelligence, a knowledge-health
dashboard, and the Deep Midnight UI redesign.

### Added

- Cross-thread memory: `user_memory` table with `remember`/`recall` tools and
  auto-injection into General Mode + Settings UI.
- Multi-modal document intelligence: PDF/DOCX table extraction (pdfplumber),
  vision-LLM image descriptions, `query_tables` tool, Tables/Images badges.
- Knowledge Health Dashboard — 4-signal library-health API
  (most-retrieved / never-retrieved / low-confidence / stale) + user feedback
  loop (immutable thumbs ratings).

### Changed

- Deep Midnight UI redesign (glassmorphic ToolCallPanel, gradient CitationCards,
  floating-pill MessageInput, AppDock) + mobile/responsive.

### Stats

- 11 phases, 27 plans.

---

## [v2.2] — Trust & Compliance (2026-04-16)

Citations, document versioning, audit logging, and suggested follow-ups — the
trust layer.

### Added

- Citations end-to-end: retrieval returns `(results, avg_similarity)`, SSE
  citations + confidence events, collapsible CitationCard + color-coded
  ConfidenceBadge.
- Document versioning: `version_number`/`is_latest` columns, re-upload creates a
  new version, old chunks retired from all RPCs, version badge in UI.
- Audit log: INSERT-only `audit_log` table, async BackgroundTask writes across 8
  action types, paginated Settings viewer with CSV export.
- Suggested follow-up questions via SSE `done → suggestions → stream_end`
  timeline with SuggestionPills.

### Stats

- 7 phases, 13 plans, 22 tasks.

---

## [v2.1] — Stability & RAG Correctness (2026-04-11)

Hardening sprint for long-conversation stability and RAG answer correctness.

### Changed

- Provider-aware context budgets (Anthropic 120k / OpenAI 200k / Google 180k /
  OpenRouter 100k / Ollama 80k) + per-provider sub-agent model auto-selection.
- System-prompt confidence hedging (similarity < 0.4) + structured
  citation-format guidance to prevent fabricated answers from weak matches.

### Fixed

- Rolling context-window trimming with atomic tool-pair removal; three
  blank-response guards; sub-agent content cap (600k chars).
- Keyword-search folder scope, metadata case normalization at ingest + search,
  sentence-boundary chunking fix.

### Stats

- 8 phases, 8 plans.

---

## [v2.0] — Agent Skills & Code Execution (2026-04-04)

Taught the agent new skills that persist and gave it a sandboxed code-execution
environment.

### Added

- Agent Skills core: `skills` + `skill_files` tables with private/global/RLS
  model, 6 CRUD endpoints, system-prompt catalog injection,
  `load_skill`/`save_skill`/`read_skill_file` dispatch, and a Skills UI.
- Skills Open Standard — ZIP import/export with `SKILL.md` YAML frontmatter,
  MIME-type file categorization, and path-traversal rejection.
- Code Execution Sandbox via Docker/llm-sandbox: `asyncio.Queue` SSE bridge,
  `code_executions` + `sandbox_files` tables, TTL eviction, `harvest_output_files`
  signed download URLs.
- Persistent tool memory — `tool_call_id` in JSONB with full multi-turn history
  reconstruction.

### Stats

- 9 phases, 22 plans, 30 tasks.

---

## [v1.0] — Knowledge Base Explorer (2026-03-29)

Foundational KB platform: a folder-organized document store with agent-driven
navigation, search, and folder-scoped RAG.

### Added

- Postgres adjacency-list `folders` table with RLS, cascade delete, and 5 CRUD
  endpoints; document-folder integration (`folder_id` FK, `full_markdown`
  storage, move endpoints).
- KB navigation + search tools: `ls`/`tree` (depth limits + truncation), `grep`
  (regex content), `glob` (filename pattern with `**`), and `read`
  (full / line-range).
- Explorer sub-agent — `agent_mode` branching with 6 KB-only tools and a
  dedicated system prompt; General/Explorer mode selector in chat.
- Global folder sharing via RLS + folder-scoped chat threads with recursive
  subtree RAG scoping.

### Changed

- Post-v1.0 Aether Intelligence design system (visual-only).

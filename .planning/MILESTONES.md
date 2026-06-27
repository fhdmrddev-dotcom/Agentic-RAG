# Milestones

## v3.1 Workflow & Skill Studio — Trust, Clarity & Triggers (Shipped: 2026-06-28)

**Phases completed:** 9 shipped phases (CORE: 120, 121, 122, 123, 123.1, 124; STRETCH: 127, 128, 129), 40 plans. STRETCH phases 125, 126, 130, 131 gated/not started → deferred to backlog.
**Timeline:** 2026-06-21 → 2026-06-28 (7 days, 324 commits)
**Files changed:** 569 files (+61,830 / −914 lines)
**Requirements:** 12/12 CORE REQ-IDs delivered (COLL-01, CTX-01, IA-01, MP-01..03, TDP-01, TRIG-01, TRIG-03, CTX-03, WUX-01, WUX-02). STRETCH shipped: TDP-02, CTC-01..04, WUX-03 (code-verified/partial UAT), MP-04. Per-phase rigor substituted for formal audit (v2.9/v3.0 precedent — every CORE phase cleared verify + secure + validate with live evidence).

**Key accomplishments:**

- **Collision fix + context isolation (120)** — run-scoped the sandbox-output harvest baseline (closes the confirmed 2-files bug, Mechanism A); `messages.origin` column + asymmetric history filter so Deep/Harness never replay each other (migration 076)
- **One front door (121)** — removed the composer Harness pill + in-chat workflow selector → clean 2-pill General/Explorer; workflows launch from Workflows page only; lock/409/reconcile preserved byte-identical
- **Cross-provider trust & honesty parity (122)** — force→coerce→fail retry ladder in `forced_emit` (all 4 consumers); `emit_tier` doc-verified per provider (55 models, 14/2/34/5 tiers); per-provider scoreboard gates any tier flip; task labels concrete on all providers (ungated prompt nudge + frontend floor)
- **Skill Trigger Tuner (123 + 123.1)** — held-out should/should-not benchmark (60/40 split, 3-repeat, background job over run-buffer/SSE); N-column ProviderScoreboard (server-derived, no fabricated providers); durable latest-result upsert (migration 077); seeded-case visibility + CandidateCard confirm flow; builder-model from configured models; description-quality lint at save_skill (warn-never-block); CTX-03 trim-pin keeps loaded skill in context
- **Workflow Studio UX soul + strict↔loose (124)** — shared `soulData.ts` single source for tier-derivation + phase glyphs + soul atoms; `WorkflowSoul` in 3 sizes (card/run-header/publish all read the same object); two-door `WorkflowDoorSwitch` ("Describe & run" / "Author & govern") — nothing removed, advanced one click away
- **Chat tool-card unification + provider logos (128)** — `@lobehub/icons` single-source logo map; RunCard shows live provider logo; ToolCallPanel carries live description before tool_start; StickyTimerBar removed (reclaims chat-area space); long prompts collapse to clamped Read-more
- **MiniMax/OpenRouter arg repair (129)** — MiniMax-gated single-shot re-ask at adapter boundary (recover or honest-fail); OpenRouter `require_parameters` in quality strategy; BUG-260607-03 folded

**Architectural decisions locked:**

- **D-14 red line held:** every provider fix at the gateway/adapter boundary; shared Deep path byte-identical; no new runtime
- **Icon convention (RDD-43):** provider/model = single-source `@lobehub/icons`; phase-type = shared 3D `PHASE_GLYPHS`
- **Per-phase rigor suffices for audit:** SC#10 4-axis scoreboard on every streaming/provider/agent-loop phase

**Known deferred items at close:** STRETCH phases 125 (SI-02), 126 (TRIG-02), 130 (COLL-02), 131 (SRH-01) — gated, never started, roll to backlog. Phase 127 UAT partial (2 BLOCKED by env, no regressions). threads.py extraction still due. LangSmith tracing still off (429 flood silenced).

---

## v3.0 Document Management (Shipped: 2026-06-21)

**Phases completed:** 11 phases (110, 111, 111.1, 112–119; incl. inserted embeddings phase 111.1), 46 plans, 88 tasks.
**Timeline:** 2026-06-15 → 2026-06-21 (7 days, 410 commits, 73 feat)
**Files changed:** 699 files (+99,800 / −627 lines)
**Requirements:** 24/24 functional REQ-IDs delivered + UX-01/UX-02 cross-cutting. No formal milestone audit run — substituted by per-phase rigor: **every phase passed `/gsd:verify-work` + `/gsd:secure-phase` + `/gsd:validate-phase`** (live cross-provider UAT on the agent-tool / upload-path phases).

**Key accomplishments:**

- **DM foundations (110)** — landed the shared backend substrate once (migration 071: 4 RLS tables + audit CHECK enum 11→19 + a default-ON `document_management_enabled` capability flag, with a boot/CI enum-drift hard-fail guard) so phases 111–119 add behavior, not schema. Every new table carries a nullable `org_id` for the v3.3 multi-tenancy re-key; `document_relationships` RLS corrected to user-scoped-only (DMF-01/02/03).
- **Metadata enrichment (111/112)** — extraction is no longer pinned to `gpt-4o` (routes to the user/admin-configured model via `forced_emit` as its 4th caller), reads a larger head+tail window, and supports user-defined custom fields; the legacy OpenAI json_object path is preserved byte-identical as the reversible `legacy` mode. Per-field confidence renders as an honest `ConfidenceChip` in a net-new right-side `DocumentDetailPanel`; manual edits persist with a server-stamped `_source='user'` marker + a `metadata.update` audit row, and a re-extract precedence guard means a human correction is never wiped by a later degrade (META-01..05).
- **Configurable multi-provider embeddings (111.1)** — retires the OpenAI embedding SPOF (SEED-048): a Settings provider picker (OpenAI / Google / Ollama / LM Studio / OpenAI-compatible) with a provider→model→dimensions auto-fill map, same-model parity across chunk + query embedding, and a guarded, RLS-scoped, destructive-change-confirmed re-embed background job (EMBED-01..06; migration 073).
- **Virtual folders / metadata-driven views (113/114/115)** — a net-new closed-registry filter-AST → parameterized `metadata @> $1::jsonb` compiler (no raw end-user DSL), driven by a guided no-DSL chip-strip builder (equals / one-of / contains / is-empty / numeric / date + relative-date + AND + folder-subtree scope); saved views render as a live sidebar "Views" group and a viewer never sees documents they can't access (leak-safe global sharing, proven with live two-user tests). The agent can run a saved view or inline query as a `query_documents_by_view` tool (VIEW-01..07).
- **Document relationships (116/117)** — typed links (supersedes / amends / references / attached-to) with an idempotent create + own-scoped delete, surfaced as a chip-led, grouped-by-direction relationships section inside the document detail panel (inverse labels, masked "no access" rows, a type-first typeahead create picker) and exposed to chat as a leak-safe `get_related_documents` tool (REL-01..04).
- **Auto-classification (118)** — own + global enabled rules are evaluated first-match-wins in-Python on upload and write ONE never-silent `metadata._classification` suggestion (never a folder move); accept reversibly moves + audits-after-move + stamps the prior folder for Undo, dismiss clears it. An on-doc provenance card (rule + condition → folder, never a confidence %) + a one-glance row chip + a rules-authoring page with an Automation sidebar group (CLASS-01/02/03).
- **Governance health (119)** — a light read-only `document_governance` surface with three owner-scoped signals (broken/dangling relationships, unclassified documents, low-confidence metadata) over the already-shipped DM tables, each row a pure link-out to the action that fixes it (open the document's detail panel); zero migration / write path / new package (DGOV-01/02).

**Architectural decisions locked:**

- **Document management is a metadata-driven Tier-A surface, not a full M-Files vault** — adopt the metadata / relationships / classification basics; reject object-types/classes/value-lists (fights the folder+metadata model) and silent autonomous auto-filing (fights the audit/honesty positioning). Classification is always suggest-then-confirm.
- **Closed-registry filter compiler, never a raw DSL (D-v3.0-COMPILER)** — views compile a closed operator/field-registry AST to a parameterized jsonb containment query; a freeform end-user query language would be an injection + UX hazard.
- **Share-don't-fork for leak-safe read cores (D-v3.0-SHARE-DONT-FORK)** — the saved-view resolve and the relationship traversal each live once (`document_view_resolver.py`, `document_relationship_service.py`) and are consumed by BOTH the agent tool and the REST route, so a forked second copy can't drift and re-open a cross-user leak.
- **Gemini-safe tool schemas (D-v3.0-GEMINI-SCHEMA)** — agent-tool schemas avoid anyOf/oneOf AND multi-type `type:[...]` arrays; a 115 live-UAT run caught a multi-type array breaking all Gemini Deep tool use (no-anyOf is necessary but not sufficient). `threads.py` stayed byte-untouched across the entire milestone (G-5).
- **Per-phase rigor substitutes for a formal milestone audit** — all 11 phases cleared verify + secure + validate with live evidence (e.g. 119: 12/12 threats closed; 117: 18/18; 116: 28/28; live two-user leak proofs on the agent-tool phases), so a formal audit adds ceremony without new signal (the v2.9 precedent).

**Known deferred items at close:** 37 acknowledged (operator-approved — see STATE.md `## Deferred Items`). Triaged as **zero CORE blockers**: 4 UAT + 3 verification "gaps" are status-label lag on phases that were live-UAT'd after the file was stamped (116 SC#10 cross-provider rows carry forward; 119 has 0 open scenarios); 19 `[missing]` quick-task slugs are pre-GSD tracking cruft; 1 todo (the NL-authoring spike, satisfied by Phase 103); 10 dormant forward seeds (deployment / multi-tenancy / model-registry / compaction / modalities / sandbox-pkg / multi-language-skills / UI-polish / library-health / starter-workflows). Open `surface: Agentic-RAG` run-honesty / provider-polish reports roll forward into the next milestone's UAT blast radius.

---

## v2.9 Workflow Studio (Shipped: 2026-06-15)

**Phases completed:** 9 CORE phases (097–104, incl. inserted emission-layer phase 101.1), 57 plans. STRETCH phases 105–109 deferred to backlog (never started).
**Timeline:** 2026-06-08 → 2026-06-15 (8 days, 418 commits, 99 feat)
**Files changed:** 678 files (+88,561 / −514 lines)
**Requirements:** 14/14 CORE shipped + validated; 5/5 STRETCH deferred. No formal milestone audit run — substituted by per-phase rigor: **every CORE phase passed `/gsd:verify-work` + `/gsd:secure-phase` + live cross-provider UAT** (102: 34/34 threats + 7/7 SC#10; 103: 32 threats / 0 open; 104: 15 threats / 0 open + nyquist-compliant).

**Key accomplishments:**

- **Project binding + server-side KB scope governance (098)** — a workflow binds to a project (a folder + its subtree) via an additive-optional `project_folder_id`; retrieval scope is resolved **server-side from the user's RLS context at run start** and bound to every retrieval call as a parameter the model cannot widen (retrieved `folder_id`s asserted ⊆ scope, RLS as backstop). Scope-violation = clip + observable `scope_violation` run-log event; the ⊆ assert is a **gated no-op when scope is None** so the shared `search_documents` path stays Deep byte-identical (PROJ-01/02, GOV-01).
- **Workflow ↔ skill composition (099)** — an `llm_agent`/`llm_single` phase references a project skill via an optional `skill_ref`; the skill's instructions + files compose into the phase framing with `read_skill_file` auto-whitelisted, and the skill version is **snapshotted into the locked definition** (migration 067 sibling column + CAS) so a later edit/delete can't break a published workflow. Proven on 6+ providers; immutability proven live (WFSKILL-01).
- **Ephemeral template upload + template-fill + integrity (100 / 101 / 101.1)** — a user hands the workflow a template for **one run** (workspace-only, TTL + cron sweep, RLS-scoped, never KB-ingested, never searchable — also closes the upload-injection vector). The shared **guaranteed structured-emission `llm_emit` layer** FORCES the model to emit a **cited** field-map against a strict schema, which a pinned **deterministic no-model-code driver** renders into a real deliverable; every value carries a source chunk/page, and a corrupt file **can never reach the user as "done"** (re-open integrity gate + `SandboxedEnvironment` SSTI containment). Capability-tiered forcing at the gateway boundary + native narrated-JSON recovery makes it reliable across the native-7 (TMPL-01/02/03).
- **Reusable validation-gate library + output-quality judge hard-wall (102)** — a closed registry of validator kinds (`citations_required`, `freshness` → `ask_user`, `structure_check`, `output_file_valid`, `llm_judge_rubric`) any phase can ride on the existing gate + bounded-retry loop; an `llm_judge` + a publish-time **golden run** are a **HARD publish blocker** — a structurally-lint-clean workflow that produces bad output **cannot publish**. Judge works cross-provider, grading prose AND template-fill (GATE-01, QUAL-01).
- **Workflows page + authoring API + NL authoring (103)** — a user **describes a workflow in natural language** and gets a valid draft (one-shot structured generation over the strict `WorkflowDefinition` schema, grounded in the project folder tree + tool/skill registry + any uploaded template, auto-retrying against the validation error); a **read-only phase-spine graph** (view, not drag-to-build — a deliberate anti-feature for the domain-expert buyer); a project-filtered library; run-from-thread; and an 8-stage publish gauntlet with the judge hard-wall. ~90% reuse of the shipped `forced_emit` + the 092.5 gateway `force_tool_name` (WFAUTH-01/02/03/04).
- **PM flagship content pack (104)** — charter / weekly-status-report / risk-register templates + 2 published workflow defs + a synthetic "Project Meridian" corpus authored **entirely on the generic primitives** (domain-author-driven, zero PM-hardcoded engine logic). Headline demo green live: a single template-fill status report from the project KB, cited + integrity-checked, across a 7-model cross-provider sweep with honesty on all 7 (PM-01).

**Architectural decisions locked:**

- **The red line held:** v2.9 is ~80–90% composition of shipped v2.8 harness primitives — Deep Mode stayed **byte-identical**, no new runtime, no re-implemented loop. Every engine addition was an additive seam (`phase_types.py` / `models/harness.py`), never a breaking change to the G-5 hot files.
- **D-101.1 (emission layer):** one shared "guaranteed structured emission" engine layer (`llm_emit`) is the home for any typed-artifact workflow — FORCE a cited field-map → deterministic render — not a template-fill one-off. Capability-tiered forcing + narrated-JSON recovery keep it native-7-reliable; SEED-082 (emit-gate policy strict|flag|partial|draft + model-fit routing) carried forward.
- **"Static would false-green" (102 → 104):** validation gates and judge walls MUST be driven against the REAL endpoint on a real golden run — mocks and static def-shape tests mask live failures. Proven repeatedly: 102's judge gate had never worked live until driven through the real publish endpoint (6 mock-masked blockers); 104 was the first def to attach 102's `citations_required`+`output_file_valid` to an `llm_emit` phase and live UAT found 2 blocking double-gate engine bugs static tests false-green'd. The lesson now extends to auditors and validation maps themselves (orchestrator hand-spot-checks; re-run, don't trust labels).
- **NL authoring over visual builder:** describe + form + read-only graph, NOT a drag-to-build node editor (anti-feature for the domain-expert buyer; OpenAI sunsetting hosted Agent Builder confirmed the squeezed middle). Plugin Contract stayed OFF the critical path → STRETCH 108.
- **Cross-provider as a first-class acceptance bar:** the SC#10 4-axis scoreboard (cross-provider × multi-tool × parallel-thread × long-message) gated every workflow-run-bearing phase; provider-specific handling stays at the gateway/service boundary, the shared fill path never branches.

**Known deferred items at close:** 40 acknowledged (operator-approved — see STATE.md `## Deferred Items`). Triaged as **zero CORE blockers**: 5 UAT + 3 verification "gaps" are status-label lag on superseded/closed phases (101 → 101.1; 102/103 secured); 19 `[missing]` quick-task slugs are pre-GSD tracking cruft; 1 todo (NL-authoring spike) is satisfied by Phase 103; 12 dormant forward seeds (SEED-002/003/004/005/040–046/084, with SEED-005 Enhanced Document Structure = next-milestone). **STRETCH 105–109** (SCHED-01/GRID-01/GOV-02/PLUG-01/ROLE-01) rolled to backlog. 7 open `surface: Agentic-RAG` reports (BUG-260609-02/-04, -260610-01, -260615-01, silent-send-drop, minimax-400, setting-up-agent) roll forward — none folded into a v2.9 CORE phase; carried into the next milestone's UAT blast radius.

## v2.8 Harness Engine & Workflow Mode (Shipped: 2026-06-07)

**Phases completed:** 10 phases (089–096, incl. inserted refactor 092.5 + inserted live-UAT phase 095.1), 67 plans
**Timeline:** 2026-05-30 → 2026-06-07 (9 days, 498 commits, 121 feat)
**Files changed:** 578 files (+107,662 / −6,187 lines)
**Audit:** `tech_debt` — 24/25 requirements satisfied + 1 partial (CONC-01 → SEED-065-B); 10/10 phases verified & closed; 6/6 E2E flows. See `milestones/v2.8-MILESTONE-AUDIT.md`.

**Key accomplishments:**

- **Harness Engine (091)** — a deterministic, locked-workflow runtime: `harness_engine.run_workflow` is a hand-rolled async transition loop over the Phase 090 tables with a strict 2-phase write (mark-active → execute → atomic complete-with-output), publish-time reachability lint, and a `PHASE_TYPE_REGISTRY` dispatch seam filled by 5 thin executors (`programmatic` / `llm_single` / `llm_agent` / `llm_batch_agents` / `llm_human_input`) that call `task_service` / `ask_user_service` / `tool_dispatcher` — never re-implementing loops. Validation gates (4 kinds, closed registries) + bounded retry ≤3 with consecutive-identical short-circuit + `on_failure` routing + per-phase step & wall-clock caps. ~80% composition of shipped substrate, **zero new dependencies**.
- **Per-phase tool-whitelist + tool-count budget (091)** — enforced at the single `dispatch_tool()` guard + at the `get_tools()` composition site; both literal no-ops when no workflow is active, so **Deep Mode is byte-identical**. Workflow definitions are versioned + immutable-on-publish (UNIQUE(slug,version) + BEFORE UPDATE trigger + FK ON DELETE RESTRICT) with FK-chain RLS and an INSERT-only `harness_audit` trail (migrations 056–062).
- **Agent-loop + provider-gateway extraction (089 + 092.5)** — the agent loop was lifted from the `threads.py` god file into a clean `agent_loop.py` (byte-identical native-7, G-5 satisfied), then its per-provider dispatch + chunk-normalization was extracted into a shared `provider_gateway/` package (events + dispatcher `open_stream` + 3 verbatim adapters + one unified `_on_chunk` consumer) that **Deep AND the harness consume** — Deep proven byte-identical in isolation (the red line). `calling_mode` surfaced through the seam was the structural fix for the harness-OpenAI-only bug.
- **Dual-mode wiring + cross-provider parity (092 + 093)** — per-thread Deep/Harness toggle keyed on `threads.active_workflow_run_id`, server-enforced workflow lock (409 on illegal switch, lock cleared in the terminal-status transaction), and the SEED-029 Continue affordance (resume past a step cap, consume-not-drop). The harness reached **native-7 parity** by consuming the gateway: a shared model-resolver (resolve, never mutate saved settings), a fixed ask_user round-trip (workflow_run-id namespace), the 3 never-run phase-types completed (`split_topic` → real N-way `llm_batch_agents` fan-out), and Google `thought_signature` / Moonshot `reasoning_content` / GLM `max_steps` round-trips fixed — D-21 live re-UAT 8/8.
- **Legibility + run honesty (094 + 095 + 095.1)** — a live, WCAG 2.1 AA phase-timeline + a harness RunCard in the v2.7 panel demuxed into a dedicated `phasesByThread` store (PANEL-06: zero chat re-renders); failed/gate-failed runs render as *failed with a reason* (no `done`-sentinel lie); chat tool-cards unified into one frame (auto-scroll, details-on-demand, no duplicates, working download); and cross-provider run-honesty — deterministic activity-derived workspace-panel fill (fills even for providers that never call `write_todos`), 429-vs-billing classified at the gateway boundary on structured status codes, true `completed_at − started_at` reload timer, model/provider attribution, and a deliverable-aware Resume gate.
- **Eval gate + concurrency + resumability (096)** — `scripts/eval_cross_provider.py` extended to drive multi-phase workflows per provider and wired as the CI regression gate (SEED-034); an offline CI harness regression test that caught + fixed a live `phase_whitelist`-not-propagated security gap on first run; restart-mid-workflow smoke at 3 kill points (programmatic / llm_agent / ask_user) verified live incl. graceful-shutdown resumability (096-09); `llm_batch_agents` fan-out bounded by `max_parallel_agents` composing with the global Redis-Lua cap; a StreamsProvider thread-keyed LRU-3 live-stream pool closing the thread-switch saturation hang (BUG-260530-01); and an 8-provider, newest-first model curation pass.

**Architectural decisions locked:**

- **D-v2.8-01**: v2.8 = Harness Engine + dual-mode ONLY; the 6-type Plugin Contract + `super_admin`/operator role tier deferred to v2.9 (cross-milestone load-bearing — lock on harness telemetry, mirrors the v2.7 split).
- **GATEWAY-01**: one shared provider gateway is the single home for all provider logic; the harness reaches parity by *consuming* it, never re-implementing — Deep byte-identical is the red line.
- **PARITY-02 over PARITY-01**: the cross-provider parity the milestone needed was the *harness* path (093), not the Deep-mode Anthropic polish (re-deferred — Deep is provider-robust on all 7).
- **D-094-UNIFY**: the workspace panel is the single live-execution surface for BOTH Deep and Harness (reverses the in-chat Run-Card for Deep).
- **D-095.1**: run honesty is projection/classification over data that already exists (no migration, no new SSE event); provider-specific handling stays at the gateway boundary, never the shared path.
- Migrations renumbered from the real head **056+** (the v2.7 PRD's 125-139 reservation was stale fiction); SC#10 4-axis UAT baked into every streaming/agent-loop/provider/UI-state phase.

**Known deferred items at close:** 43 acknowledged (operator-approved accept-as-tech-debt — see STATE.md `## Deferred Items`). Headline: **CONC-01 partial → SEED-065-B** (cross-tab GET p95 2,958 ms, 2.9× better; residual ~3 s = sync stream-create at `provider_gateway/dispatcher.py:94-115`). Plus 11 dormant forward seeds (SEED-002/003/004/005/040/041/042/043/044/045/046), 18 pre-GSD micro-tickets (stale quick-task trackers, work long since shipped), 1 parked v2.9 spike todo (NL→workflow authoring), 8 swept UAT-status files + 5 `human_needed` VERIFICATION files (all exercised at the milestone audit), and SEED-048/050/057 (embeddings SPOF / kimi-MiniMax quality / Google-credit-as-rate-limit trade-off). PARITY-01 re-deferred. Plugin Contract (PLUGIN-01..03), `llm_judge` (HARNESS-JUDGE-01), visual builder (HARNESS-AUTHOR-01) → v2.9.

## v2.7 Agent Workspace & Panel (Shipped: 2026-05-30)

**Phases completed:** 6 phases (083–088), 28 plans, 50 tasks
**Timeline:** 2026-05-27 → 2026-05-30 (3 days, 226 commits)
**Files changed:** 673 files (+52,449 / −3,081 lines)

**Key accomplishments:**

- Provider-gated Kimi thinking content filter strips <think> tags from visible chat + title generation fixed for DeepSeek/Moonshot/MiniMax/GLM/Google with tier-aware model routing
- Workspace filesystem schema landed -- workspace_files + workspace_file_versions tables, FK-chain RLS, and private storage bucket created in live local DB. Bootstrap full-schema.sql regenerated.
- Workspace backend logic layer landed -- asyncpg helpers, response models, and a single workspace_service.py that hides hybrid storage routing (inline bytea <= 256KB / bucket > 256KB), enforces 10MB hard cap, 100-file soft warning, 8192-char read cap, path validation, and structured difflib diffing.
- 5 workspace tools wired into the agent loop -- handlers in tool_dispatcher.py + LLM schemas in openai_service.get_tools(); write and delete emit SSE events for the Phase 086/087 panel UI.
- 4 cold-path GET endpoints under /threads/{thread_id}/workspace -- list, content (inline or 60s signed URL), versions, diff. _verify_thread_ownership uses 404-not-403 to prevent existence leak. Router registered in main.py.
- Three direct fixes that close the cross-provider UAT bandwidth blockers (Google ValidationError, OpenRouter list-empty, REST /content empty body) with 22 new unit tests pinning the behavior so future provider integrations can't silently regress.
- The shared 087 foundation: 4 typed workspace api.ts client fns (content/versions/diff/answer), amber `--warning` + dim-text CSS tokens, a zero-dependency Radix-Dialog bottom-sheet primitive, and 7 GREEN-only panel test files (52 it.todo contracts) so every downstream wave builds against fixed signatures.
- The PANEL-01 panel shell + PANEL-02 todos: `WorkspacePanel` hosts an open/rail/hidden grid-state machine (⌘./Ctrl+. toggle, <768px bottom-sheet, laptop-squeeze-aware), short-circuits to ONE calm `PanelEmpty` when idle, and composes the live Wave-1/2 sections (Todos · Files · Versions) into a fixed-order accordion with the `PendingAskStack` pinned at the very top — mounted as one additive sibling in `ChatLayout` (chat-view only) with the chat↔panel seam open-handlers wired via a module-level signal. The new `TodosSection` renders the reactive todo list with non-color-only status indicators. All 7 panel test files GREEN (67 live, 0 todo); full suite at the documented 17-failure baseline, no new failures.
- The panel's file browser: `FilesSection` lists thread workspace files (icon + mono name + size·version meta, green flash on fresh write) and full-replaces into `FilePreview` — a per-type router that reuses MarkdownRenderer for md, ShikiCode for code, the new dependency-free `CsvTablePreview` `<table>` for csv, framed `<img>` for bucket images, and a calm "No preview available · Download" / "File too large to preview" fallback for null-url / binary / malformed / too-large content. All raw content is React-escaped or routed through sanitizing renderers — zero raw-HTML injection.
- The PANEL-07 version-diff viewer: a pure client-side `parseUnifiedDiff` (no diff lib), a shared in-column `DiffLines` renderer (fixed 16px sign gutter, honest truncation notice), an opt-in `DiffExpandOverlay` in the existing Radix dialog (same payload, no second fetch), and `VersionDiff` with red-base/green-target accessible pills defaulting to Compare v{n-1}↔v{n} — 14 live tests GREEN (7 parser + 7 component).
- The PANEL-04 answer surface (stacked amber `PendingAskCard`s with run_id-gated submit + resume-in-place) plus the three additive chat↔panel seam renderers (live `SeamPointer`, reload `SeamCard` that closes the `ask_user` reload gap, and the `PausedRunCue`), mounted strictly additively into the G-5 `MessageItem` with single-source-of-truth (D-05) and zero raw-JSON leak.
- Hoisted the workspace-panel chat|panel split into a single ChatLayout-level CSS grid (1fr chat | clamp(300-420px)/52px/0 panel) so the panel resolves against the real row width — closing the overflow (gap 1), dead-band (gap 7), and per-thread-shift defects — lifted the open/rail/hidden state machine up to ChatLayout to host a persistent always-visible chat-header toggle (gap 3) with a pulsing-amber-dot ask_user-pending indicator (gap 4 / PANEL-01), and stripped the leaked DevTwoPaneMock debug overlay from the production tree (gap 2).
- Dedicated `--panel-surface`/`--panel-border` tokens give the workspace panel + rail a distinct surface in both themes (gaps 5/6); Chrome-MCP gate verified the 004-panel-shell layout contract and routed the remaining feature contracts + cross-provider scoreboard to 087-08.
- One nav-style in-panel workspace toggle (collapse-to-rail) replaces the two-control/hidden-state design; all four design contracts (004/005/006/007) + PANEL-02 + the cross-provider 4-axis scoreboard verified live — surfacing and fixing a real version-diff 500 and a todo-count bug.
- WCAG 2.1 AA structural conformance closed on all 8 Phase 087 panel surfaces: vitest-axe wired as a durable regression gate, one global zero-specificity :focus-visible ring added, two targeted aria-live announcements (todo count + diff +N/−M), and the FilesSection always-false aria-selected fixed — all 89 panel tests green with zero regression past the 17-failure 086 baseline.
- A reusable, localhost-gated `scripts/eval_cross_provider.py` that drives the REAL `POST /threads/{id}/messages` route per (provider × canonical-prompt) across OpenAI/Anthropic/Google-3.x/OpenRouter and asserts tool-invocation + arg-shape + DB persistence, emitting a greppable PASS/FAIL scoreboard as the SEED-034 fold-gate evidence source.
- `scenario-13-workspace-deep-flow.spec.ts` — a provider-parameterized Playwright backstop that drives the full deep workspace flow (write -> see -> update -> diff -> ask_user -> respond -> resume) with NO page refresh on Anthropic AND Google, and asserts zero 400 INVALID_ARGUMENT on both (the D-17 gemini-3 thought-signature live re-verify at the network level).
- SEED-034 resolved on evidence: a text-only universal `write_todos` + `ask_user` directive folded into the shared `SYSTEM_PROMPT` + tool descriptions — re-verified across an extended 6-provider × 4-prompt matrix to deliver 3 improvements (OpenAI/Anthropic/OpenRouter now invoke `write_todos` on multi-step work) with zero fold-attributable regression. VERDICT: FOLDED (kept at `2f6e2523`).
- Live 4-axis cross-provider UAT (6 providers PASS) + WCAG 2.1 AA panel a11y re-verified in both themes (contrast fixed dark 7.21:1 / light 4.66:1) + Anthropic+Google deep-flow no-refresh pass + D-17 gemini-3 thought_signature closed-as-verified — recorded into 088-VALIDATION.md; Phase 088 verification gate complete.

**Architectural decisions locked:**

- FOUND-01: tool-dispatch chain extracted from `threads.py` (~3,800 LOC) into a registry-pattern `tool_dispatcher.py` — G-5 hot-file mandate satisfied; all new tools register here
- 083-03: `_SINGLE_MODEL_PROVIDERS` frozenset drives tier-aware title-gen model routing; Kimi/Moonshot thinking filter is a provider-gated `<think>` state-machine (moonshot + deepseek only)
- 084: per-thread workspace uses hybrid storage hidden behind `workspace_service.py` — inline bytea ≤256 KB / Supabase Storage bucket >256 KB; FK-chain RLS; owner endpoints return 404-not-403 to prevent existence leak
- 085: first Redis pub/sub in the codebase (`ask_user`) — SUBSCRIBE-first ordering + cancel sentinel + uvicorn lifespan shutdown broadcast for cross-worker safety under `WORKER_COUNT=2`; sub-agent `task` capped at 1-level nesting + dual concurrency (per-run `Semaphore(3)` + global Redis Lua-atomic cap 20); tool registry 21→24 (migration 055)
- PANEL-06: panel SSE events route to dedicated Zustand keys, never chat `bucketsBySurface` — a panel update triggers zero chat-message-list re-renders
- 087: the chat|panel split is ONE `ChatLayout`-level CSS grid (1fr chat | clamp(300–420px) panel); G-2 sketch-before-plan honored; 087-08 consolidated to a single nav-style in-panel toggle (collapse-to-rail), dropping the redundant chat-header toggle + hidden state
- 088 / SEED-034: the universal `write_todos`/`ask_user` tool-use directive is TEXT-ONLY — no `tool_choice` forcing, `TASK_TOOL` untouched; eval gate judged on the native providers via `scripts/eval_cross_provider.py`
- D-17 (gemini-3 `thought_signature`): closed-as-verified — Google-axis deep-flow + multi-tool rounds clean (zero 400 INVALID_ARGUMENT); the 075.4 Stage-4 echo hotfix holds

**Known deferred items at close:** 27 acknowledged (11 pre-GSD micro-tickets; 4 dormant seeds SEED-002/003/004/005; cosmetic UAT status fields; 083 + 085 verification `human_needed` gaps — operator-approved). Plus 087 panel deferrals **SEED-037** (in-panel office/PDF/PPTX viewing + working download), **SEED-038** (chat-vs-panel artifacts unification), **SEED-039** (panel reliability / fast-switch race). Plus v2.8 carry-forwards: title-gen live-verify on DeepSeek/Moonshot/Google (BUG-260527-01, rolled forward unverified), Google secondary-model 404 routing artifact, per-provider `task`/`ask_user` gaps a text-only directive did not close (eval script is the v2.8 harness seed, D-08), and chat-tool-card unification (BUG-260529-02, major — its own v2.8 phase). See STATE.md `## Deferred Items` for the full inventory.

---

## v2.6 Foundation: RAG Quality + Multi-Worker + Polish (Shipped: 2026-05-27)

**Phases completed:** 35 phases (068–082 including inserts), 91 plans complete
**Timeline:** 2026-05-12 → 2026-05-27 (16 days, 846 commits)
**Files changed:** 771 source files (+183K lines)

**Key accomplishments:**

1. Per-aspect extraction dispatcher with swappable engines — `extract_composable()` routes text/tables/images/equations through independent registries; camelot tables (53.5x recall vs pdfplumber), pymupdf_full images, legacy text. Docling formally retired after 4 phases of diminishing returns; `PdfExtractor` ABC + per-call `?engines=` hints on `/upload` and `/reextract`. Migrations 039–047.
2. Multi-worker uvicorn enabled (`WORKER_COUNT=2`) — D-PRD-12 ADR supersedes D-v2.5-02; 50-parallel-run validation harness (Phase 077); cross-worker cancel via Redis zombie-heal; sandbox re-attach; per-worker Redis singleton idempotent. `runs.spawned_by_worker` debug column (migration 052).
3. StreamsProvider context lift — `useMessages` reduced from 1229 LOC to <100 LOC; Zustand store + `<StreamsProvider>` Context owns all run-stream subscriptions; Phase 067.5 Branch D-3 guard preserved verbatim; mocked second surface renders without state collision.
4. 9 LLM providers integrated — OpenAI, Anthropic (native SDK), Google, DeepSeek (thinking mode), Kimi/Moonshot, MiniMax, GLM/Zhipu, OpenRouter (generic fallback), Ollama. Per-provider base URLs, API keys, sub-agent defaults, timeout profiles. DeepSeek reasoning_content round-trip + collapsible Thinking block.
5. Live-execution UX refactor — RunCard per assistant turn (sticky header + timer + counter + fold-to-summary), Editor-Inset tool-call panel with per-tool inner-body components (execute_code editor + STDOUT/STDERR + file preview; search_documents ranked rows; read_file metadata), Focus Mode composition (past tools fold to result-summary, active step keeps full editor).
6. Settings architecture unification — `settings_override.json` eliminated; 36 keys migrated to `app_settings` DB table; `model_capabilities_overrides` table for runtime model registration; 30s TTL hot-reload cache; 4-tier resolution (DB > env CSV > static dict > default). Migration 053.
7. asyncpg pool in hot paths — 3 surgical flips in `threads.py` (runs INSERT, messages INSERT, runs UPDATE finalize); `runs.input_tokens`/`runs.output_tokens` forward-filled from LLM `usage` (TOKEN-COL-01). Two-gate strategy: test_058 (mock) + test_073 (real asyncpg).
8. Confidence recalibration on post-071.3 defaults — N=121 queries; thresholds 0.55/0.40 → 0.54/0.38; bucket balance restored to D-04 targets (30.6%/45.5%/24.0%).
9. Cross-cutting verification gate — 5/5 SCs GREEN, 24/24 REQ-IDs Validated, 7 seeds dispositioned (6 closed, 1 partial-consumed).

**Architectural decisions locked:**

- D-PRD-12: Multi-worker enablement — D-v2.5-02 formally superseded; WORKER_COUNT=2 default; revert via env var flip
- D-v2.6-01: supabase-py 2.10 → 2.29.x upgrade (httpx conflict resolved)
- D-v2.6-04: Opt-in re-extraction via `POST /documents/{id}/reextract`
- D-v2.6-05 (D-PRD-15): Docling demotion + camelot default + PyMuPDF in-process; v2.6 PRD "Docling-first" thesis retired

**Known deferred items at close:** 40 acknowledged (15 UAT status fields not flipped — cosmetic; 10 verification gaps with project-level approval; 11 quick tasks predating GSD; 4 dormant seeds — SEED-002/003/004/005). Phase 082.5 (Error Handler Foundation) deferred to v2.7. See STATE.md `## Deferred Items` for the full inventory.

---

## v2.5 Deployment Strategy (Shipped: 2026-05-09)

**Phases completed:** 15 phases shipped + 1 deferred (064), 64/64 plans complete
**Timeline:** 2026-04-30 → 2026-05-09 (10 days, 445 commits)
**Files changed:** 531 source files (+107,682 / -3,715 lines)

**Key accomplishments:**

1. Backend SSE concurrency unblocked (Phase 058) — `aexec` async wrapper around supabase `.execute()` calls + AnyIO 200-token limiter; cross-tab GET drops from ~30s queued to <1s while a streaming agent runs (CONCUR-01 binding pytest gate).
2. Run-backed streaming architecture (Phases 059 → 063 + 063.1) — `asyncio.Queue` producer + `sse-starlette` (059), Redis Streams `run:{run_id}` durable buffer (061), `GET /threads/{tid}/active-runs` + `GET /runs/{rid}/stream?since=N` replay-and-tail API (062), POST returns JSON `{message_id, run_id}` + frontend reattaches via separate subscription (063), multi-tab sync / refresh-mid-stream / navigate-away all work without manual refresh as a side-effect.
3. Adaptive run timeouts + lifecycle states (Phase 066) — per-LLM-call budget that resets on tool-call boundaries replaces the 120s total-deadline; cancelled (user-Stop) vs timed_out (system limit) terminal distinction; "Agent reached time limit" UI banner with Resume button. Closes Gap-006.
4. Streaming UX polish — Phase 067 fixed UX-067-01..05 (empty-paint, "Saving response…" thrash, refresh-required first-paint, redis-consumer log noise, tool-call iteration boundary). Phase 067.1 added context-aware in-flight copy ("Searching knowledge base…", "Setting up agent…"), multi-step-intent system-prompt section, skill-load tool-card copy.
5. Streaming render & storage fixes (Phases 067.2 → 067.5, cross-phase chain) — per-thread message store via `messagesByThread` Map (cross-thread switch preserves render); sandbox-output download via JS blob fetch (no more 401 on `<a href>` click); model→provider router honors `MODEL_CAPABILITIES[model]['provider']` (Anthropic models actually route through Anthropic SDK); suggestions SSE emit at `threads.py:2487` always-emit-empty + reordered before `done`; code-execution `code_executing` heartbeat events with elapsed counter; empty-thread-until-refresh closed via `clearMessages` streaming-bucket guard (Branch D-3, 5/5 lived-experience cycles GREEN).
6. Skills test infrastructure repair (Phase 065) — eradicated AttributeError on `app.api.threads.create_streaming_chat` across 11 patch sites + 19 tuple-wrapped fakes (065-01); 3 export-test assertion drifts fixed (065-02); 11 tests migrated to canonical Phase 063 POST→GET-stream pattern using `_build_mock_supabase()` (065-03). Combined skills test run: 26/26 pass. Foundation for Skill Studio milestone.

**Architectural decisions locked:**

- D-v2.5-01: blocking I/O in async handlers must be wrapped via `run_in_threadpool` / `aexec`
- D-v2.5-02: single uvicorn worker (multi-worker masks concurrency bugs)
- D-v2.5-03: Realtime is best-effort hint, not source of truth — always reconcile via fetch on (re)connect
- D-v2.5-08/09/10: STREAM-04 run-backed streaming architecture (Redis Streams + replay-and-tail)
- D-v2.5-11: 061 + 062 + 063 ship as a single feature branch, no feature flags, no dual code paths
- D-066-11: `stream.close()` invariant under synthetic-timeout
- D-067.3-N01: model→provider router resolution chain

**Known deferred items at close:** 31 acknowledged (10 UAT status fields not flipped after cross-phase closure — cosmetic only, all show 0 pending scenarios; 4 verification gaps marked human_needed — project-level approved per Phase 063 precedent; 11 historical micro-tickets predating GSD; 6 dormant seeds intentional future work). Plus 3 carry-forward seeds for follow-on work: SEED-009 (claude-haiku max_tokens cap), SEED-010 (OpenRouter synthetic-timeout protocol), SEED-011 (test_059 fixture-teardown). Plus 3 forward-looking seeds for post-v2.5 strategic work: SEED-012 (admin/operator UI), SEED-013 (external integrations / API + MCP), SEED-014 (automations & routines). See STATE.md `## Deferred Items` for the full inventory.

---

## v2.4 Stability, Polish & UX Fixes (Shipped: 2026-04-30)

**Phases completed:** 12 phases shipped + 2 deferred (55, 57), 42/44 plans complete
**Timeline:** 2026-04-22 → 2026-04-30 (8 days, 278 commits)
**Files changed:** 72 source files (+6,122 / -1,325 lines)

**Key accomplishments:**

1. Cross-provider tool calling reliability — MODEL_CAPABILITIES registry routes to native or structured mode; tool_parser.py deterministic JSON extraction for non-native models; 32+ tests
2. Anthropic native SDK integration — anthropic_service.py with prompt caching; 20% token reduction removed; PROMPT-01 generation/Q&A disambiguation fix
3. Context-aware sub-agent routing — keyword-based escalation to capable model tier for generation tasks; tiktoken estimation; per-model info cards with cost tier
4. Multi-provider model routing — full user control over all agent model roles; 404 fallback with SSE event; resolved_sub_agent_model in Settings
5. Agent real-time feedback — tool_preparing SSE eliminates 30–120s silence window; ElapsedTimer for running tools; iteration_start Step N counter; ingestion step badges
6. UX polish shipped — thread delete confirmation, no ghost content, folder-scoped new chats, root document visibility, version-aware delete dialog, web search toggle, nav polish, paginated library health

**Known deferred items at close:** 19 acknowledged (STREAM-02 partial, SKILL-01/02 to Skills Studio, 14 human UAT items, 12 quick tasks)

---

## v2.3 Memory, Multimodal & Experience (Shipped: 2026-04-19)

**Phases completed:** 11 phases, 27 plans

**Key accomplishments:**

1. Cross-Thread Memory — remember/recall tools with automatic injection into General Mode system prompts, plus Settings UI for memory management
2. Multi-Modal Document Intelligence — PDF/DOCX table extraction, vision-LLM image descriptions, query_tables tool, and document badges
3. Knowledge Health Dashboard — four-signal library health API (most-retrieved, never-retrieved, low-confidence, stale) with action hooks and KPI stat bar
4. User Feedback Loop — thumbs up/down with reason selector, immutable ratings, feedback stats in Library Health
5. Deep Midnight UI Redesign — glassmorphic ToolCallPanel, gradient CitationCards, floating pill MessageInput, AppDock, 3-pane SkillsPage, gradient toggles
6. Mobile & Responsive — collapsible NavPanel, frosted drawer, 5-tab Settings refactor, responsive breakpoints

**Known deferred items at close:** 4 UAT gaps, 5 verification gaps (require live browser testing), 12 quick task status markers (already committed code)

---

## v2.2 Trust & Compliance (Shipped: 2026-04-16)

**Phases completed:** 7 phases, 13 plans, 22 tasks

**Key accomplishments:**

- One-liner:
- One-liner:
- One-liner:
- 1. [Rule 1 - Bug] Upload endpoint uses /documents/upload not /documents
- Task 1 — Backend pipeline:
- FastAPI document versioning endpoints — is_latest list filter, GET /{id}/versions, and POST /{id}/restore with NULL folder guard and 6 TDD-verified unit tests
- React frontend — version badge, VersionHistoryPanel, and restore confirmation dialog in DocumentList
- audit_log Postgres table with INSERT-only RLS, 8-action CHECK constraint, composite index, and write_audit_entry async coroutine with exception swallowing
- All 8 auditable action types wired to write_audit_entry across documents.py, threads.py, and settings.py using BackgroundTasks (non-SSE) and asyncio.create_task (SSE generator)
- One-liner:
- Audit Log section added to Settings page with paginated table, date-range pills (All/7d/30d/90d), action-type dropdown filter, and CSV export button wired to /audit-logs and /audit-logs/export backend endpoints.
- SSE stream timeline upgraded from literal [DONE] to JSON done -> suggestions (cheap model) -> stream_end, with suggestion failures isolated behind try/except
- Glassmorphic suggestion pill buttons wired end-to-end: SSE done/suggestions/stream_end event parsing in api.ts, ephemeral questions stored on Message via useMessages, SuggestionPills component rendering below citations, gated on General mode and !isStreaming

---

## v2.1 Stability & RAG Correctness (Shipped: 2026-04-11)

**Phases completed:** 8 phases, 8 plans, 3 tasks

**Key accomplishments:**

- One-liner:
- Added similarity confidence hedging (< 0.4 threshold) and structured citation format guidance to SYSTEM_PROMPT, preventing fabricated answers from weak matches and standardizing document reference format

---

## v2.0 Agent Skills & Code Execution (Shipped: 2026-04-04)

**Phases completed:** 9 phases, 22 plans, 30 tasks

**Key accomplishments:**

- tool_call_id persisted in JSONB and history reconstructed as OpenAI multi-turn sequences so the LLM can reference prior tool results across conversation turns
- Supabase migration with skills + skill_files tables, RLS, private Storage bucket, Pydantic type contracts, and failing TDD scaffold covering all 10 Phase 10 requirements
- FastAPI /skills router with 6 CRUD endpoints (list, create, update, delete, toggle-enabled, toggle-global) — all CRUD tests GREEN
- 3 file management endpoints on /skills router using Supabase skill-files storage bucket with owner-only write, global-readable list, and 10 MB upload limit
- Three skill tool definitions registered in General Mode, catalog injected into system prompt via .or_() query, test scaffold with catalog/gating tests GREEN and 7 dispatch stubs for Plan 02
- Three skill tool dispatch handlers (load_skill, save_skill, read_skill_file) implemented in threads.py with skill_activated SSE event; all 8 test stubs fleshed out and GREEN
- skill_activated SSE event wired through streamMessage() callback chain with no-op handler in useMessages.ts; TypeScript compiles cleanly; live E2E test deferred to Phase 12
- Task 1 — Data Layer:
- Task 1 — Skills UI Components:
- ZIP-based skill export (GET /skills/{id}/export) and import (POST /skills/import) with SKILL.md frontmatter, MIME-type file categorization, bulk multi-skill support, and path traversal rejection
- Export button on SkillCards (owner-only, Download icon with spinner) and Import Skill button in SkillsPage header (.zip file picker with inline feedback), wired to backend ZIP endpoints
- Docker sandbox session manager with lazy llm-sandbox import, module-level TTL eviction, and Supabase tables (code_executions + sandbox_files) with RLS policies
- One-liner:
- 1. [Rule 1 - Bug] Fixed pre-existing test mock setup missing thread_folder_result
- harvest_output_files() copies Docker container output to Supabase Storage sandbox-outputs bucket, inserts sandbox_files rows, and returns signed download URLs — enabling users to retrieve files generated by their code
- FastAPI lifespan shutdown closes all Docker sandbox containers; thread-delete cleans up per-thread sessions; execute_code handler wires in harvest_output_files to deliver signed file URLs in SSE completion event
- Four code execution SSE events (start/stdout/stderr/complete) wired through streamMessage() into interleaved outputLines accumulation on the running execute_code ToolCall in React state
- ExecuteCodeBlock component with streaming terminal output and file download cards wired into ToolCallPanel dispatch for execute_code tool calls
- SkillFile TypeScript type and three tested API functions (listSkillFiles, uploadSkillFile, deleteSkillFile) wired to backend /skills/{id}/files routes
- File management section added to SkillFormDialog edit mode with upload/delete controls gated by ownership and optimistic state updates
- System prompt tool count corrected to thirteen, all v2.0 requirements marked complete, and Phase 15 VERIFICATION.md confirming SAND-12 created from code inspection

---

## v1.0 Knowledge Base Explorer (Shipped: 2026-03-29)

**Phases completed:** 8 phases, 18 plans, 22 tasks

**Key accomplishments:**

- Postgres adjacency-list folders table with RLS, cascade delete, and 5 FastAPI CRUD endpoints (create/list/children/rename/delete) with ownership enforcement
- Document-folder integration: `folder_id` FK, `full_markdown` storage, and move endpoints for files and folders
- Ingestion UI two-panel layout with folder tree, CRUD controls, and folder-targeted uploads (51 integration tests)
- `ls` and `tree` KB navigation tools with in-memory path resolution, depth limits, and truncation indicators
- `grep` (regex content search) and `glob` (filename pattern matching with `**` support) search tools
- `read` tool for full document or line-range retrieval from stored markdown
- Explorer sub-agent: backend mode branching on `agent_mode` with 6 KB-only tools and dedicated system prompt
- General/Explorer mode selector dropdown in chat toolbar (Compass icon, agentMode state in ChatArea)
- Global folder sharing via updated RLS (migration 015); folder-scoped chat threads with recursive subtree RAG scoping (migration 016)
- FolderDetail info bar: doc count, total size, global badge, subfolder count, creation date

## Post-v1.0 Enhancements (2026-03-29)

**Aether Intelligence Design System** (visual-only, no functionality changes):

- Complete CSS variable system with dark + light mode (`--background`, `--foreground`, `--primary`, `--card`, `--muted`, `--border`, `--success`, `--sidebar`, etc.)
- Theme toggle (Sun/Moon) in Sidebar; `useTheme` hook persists to localStorage, respects `prefers-color-scheme`; FOUC prevention script in `index.html`
- Google Fonts (Inter + Manrope), custom Tailwind font families (`sans`, `headline`, `mono`), keyframe animations (`fadeSlideUp`, `pulseGlow`)
- Glassmorphism chat input, gradient user bubbles, animated thinking dots, color-coded tool call icons, gradient send button
- AuthPage gradient orbs + glassmorphism card; IngestionPage/SettingsPage ghost-border cards

**Backend bug fix:**

- `folders.py` null-guard: `maybe_single().execute()` can return `None` when no row exists; added `if name_check and name_check.data` guard in both create and rename endpoints to prevent `AttributeError` on `None.data`

---

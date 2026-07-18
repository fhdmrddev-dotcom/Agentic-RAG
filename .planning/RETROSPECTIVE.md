# Retrospective

Living retrospective — updated at each milestone boundary.

---

## Milestone: v1.0 — Knowledge Base Explorer

**Shipped:** 2026-03-29
**Phases:** 8 | **Plans:** 18 | **Tasks:** 22
**Timeline:** 2026-03-16 → 2026-03-29 (13 days)
**Commits:** ~137

### What Was Built

- Postgres adjacency-list `folders` table with RLS and 5 CRUD API endpoints
- Document-folder integration: `folder_id` FK, `full_markdown` storage, move endpoints
- Ingestion UI with full folder tree, CRUD controls, and folder-targeted uploads
- `ls` and `tree` tools for KB navigation (depth limits + truncation for context safety)
- `grep` (content regex) and `glob` (filename pattern) search tools
- `read` tool for full document or line-range retrieval from stored markdown
- Explorer sub-agent: backend mode branching on `agent_mode` with KB-only tool set and dedicated system prompt
- General/Explorer mode selector dropdown in chat toolbar
- Global folder sharing via updated RLS
- Folder-scoped chat threads with recursive subtree RAG scoping
- Folder detail info bar in ingestion UI

### What Worked

- **Plan-first approach** — Each phase had a concrete PLAN.md with must-have truths before execution; made agent runs predictable and auditable
- **Shared helpers pattern** — Extracting `ls_path()` / `tree_path()` into reusable helpers (Phase 4) paid dividends in grep, glob, and folder-scoped chat
- **Python-side subtree resolution** — Preferred over SQL CTEs; simpler to test and reason about
- **Quick tasks for bug fixes** — Using `/gsd:quick` for post-milestone bugs kept the main phase flow clean
- **conftest mock builder wiring** — Establishing `.is_`, `.or_`, `.neq()`, `.limit()` globally early on prevented repeated test failures

### What Was Inefficient

- **07-02 SUMMARY never written** — The frontend mode selector was built but no SUMMARY.md was created; milestone completion was blocked until it was written manually
- **Phase ordering** — Phase 8 was executed before Phase 7 fully completed (07-02 was skipped); the ROADMAP showed Phase 7 as incomplete even though Phase 8 was done
- **Duplicate Validated sections in PROJECT.md** — Two `### Validated` blocks accumulated during milestone; caught and fixed at milestone completion

### Patterns Established

- **agent_mode branching** — `tools_override=None` signals default mode; `tools_override=[...]` signals explorer mode. Clean pattern for future agent modes
- **SECURITY DEFINER RPC bypass** — `match_document_chunks` RPC bypasses RLS by design; no need to update `document_chunks` RLS for new access patterns
- **ON DELETE SET NULL** — Used for both `documents.folder_id` and `threads.folder_id`; preferred over CASCADE to preserve data on folder delete

### Key Lessons

- Write SUMMARY.md immediately after executing a plan — don't defer it
- When skipping a plan during execution, explicitly mark it in ROADMAP and STATE at the time, not later
- Quick task commits should reference the task ID in the message for traceability
- `conftest` mock builder gaps surface late in test runs — audit builder wiring at phase start

### Post-Milestone Additions (same session)

- **Aether Intelligence design system** applied after milestone archive — complete visual overhaul with dark/light mode, CSS variables, Inter/Manrope fonts, glassmorphism, animations. Visual-only; no hooks, API, or data changes.
- **folders.py null-guard** — `maybe_single().execute()` returns `None` when no row found; both create and rename were doing `name_check.data` without checking for `None`. Fixed with `if name_check and name_check.data`.

### Cost Observations

- Model: claude-sonnet-4-6 throughout
- Sessions: multiple across 13 days
- Notable: Phase executions consistently 1–8 min per plan; quick tasks added ~4 post-milestone

---

## Milestone: v2.0 — Agent Skills & Code Execution

**Shipped:** 2026-04-04
**Phases:** 9 (Phases 9–17) | **Plans:** 22 | **Tasks:** 30
**Timeline:** 2026-03-29 → 2026-04-04 (6 days)
**Commits:** ~134 (v2.0 work)
**LOC:** ~11,000 Python + TypeScript (~28,392 total with tests + config)

### What Was Built

- Persistent tool memory — `tool_call_id` in JSONB, full multi-turn history reconstruction for LLM
- Agent Skills Core — `skills` + `skill_files` Supabase tables, 6 CRUD endpoints, private/global/RLS model
- Skills LLM integration — catalog injection into system prompt, `load_skill` / `save_skill` / `read_skill_file` dispatch
- Skills UI — dedicated Skills tab with full CRUD, toggle, share, "Try in Chat", `skill_activated` Zap indicator
- Skill-creator seed skill pre-loaded as global skill via idempotent SQL migration
- Skills Open Standard — ZIP import/export with `SKILL.md` YAML frontmatter, MIME-type file categorization, path traversal rejection
- Code Execution Sandbox — Docker/llm-sandbox, asyncio.Queue SSE bridge, `code_executions` + `sandbox_files` tables, TTL eviction, thread lifecycle cleanup
- Code Output UI — `ExecuteCodeBlock` component with streaming terminal, file download cards, `ToolCallPanel` dispatch
- Skill File Management UI — upload/list/delete files in `SkillFormDialog` with ownership gating and optimistic state

### What Worked

- **Audit-driven gap closure** — Running `/gsd:audit-milestone` before completing caught two missing frontend features (FILE-01/FILE-02) that would have shipped as known-broken flows. Phase 16 closed them cleanly.
- **TDD scaffold → implement** pattern (Phase 10) — writing the test scaffold with failing stubs first made each phase's success criteria concrete and unambiguous
- **asyncio.Queue bridge** — decoupling Docker blocking I/O from FastAPI's async event loop was the right architecture; real-time streaming worked first try
- **Lazy llm-sandbox import** — `SANDBOX_ENABLED=false` (default) has zero Docker overhead; clean feature flag pattern
- **Tech Debt phase** — dedicating Phase 17 to closing procedural gaps (stale checkboxes, missing VERIFICATION.md, cosmetic count string) gave the milestone a clean finish without rushing fixes into functional phases

### What Was Inefficient

- **Phase 12 plans field in ROADMAP** — Initial phase plans were listed as "TBD" in ROADMAP.md; the detail wasn't filled in until after completion, causing roadmap analyze to flag incomplete status
- **Audit timing** — Audit was run at Phase 15 but Phase 16/17 were needed to close gaps; could have audited later to avoid a stale `gaps_found` status
- **Multiple post-phase fix commits** — Several phases (15, 16) required fix commits after the main execution (SSE wiring, URL stripping, UX tweaks); these were handled cleanly but added churn

### Patterns Established

- **asyncio.Queue for SSE bridging** — Use this pattern whenever bridging blocking I/O into FastAPI SSE streams
- **Gap closure as named phases** — When an audit finds gaps, create explicit numbered phases (X.Y or sequential) to close them; don't patch into existing phases
- **VERIFICATION.md as execution artifact** — Each phase that doesn't auto-generate a VERIFICATION.md should have one created manually from code inspection before milestone close
- **Decimal phase for tech debt** — Phase 17 "tech debt cleanup" pattern is reusable: one plan, 3–5 tasks, close audit findings procedurally

### Key Lessons

- Run `/gsd:audit-milestone` before planning gap-closure phases so the scope is known upfront
- `skill_activated` SSE event wired across 3 phases (10→11→12) — multi-phase SSE features need a dedicated integration test that spans the full chain
- Docker sandbox requires explicit session cleanup on both thread-delete AND FastAPI lifespan — don't rely on one path alone
- When SUMMARY.md one-liners are auto-extracted, review for placeholder text ("Task 1 — Data Layer:") before they become milestone accomplishments

### Cost Observations

- Model: claude-sonnet-4-6 throughout (all phases)
- Sessions: multiple across 6 days (fast pace)
- Notable: Phases with Docker/async complexity (14, 15) required the most fix iterations; skill phases (10–13) were cleanest execution

---

## Milestone: v2.1 — Stability & RAG Correctness

**Shipped:** 2026-04-11
**Phases:** 8 (Phases 18–25) | **Plans:** 8 | **Tasks:** ~28
**Timeline:** 2026-04-09 → 2026-04-11 (3 days)
**Commits:** 23
**LOC delta:** +4,445 / -253 across 54 files (~15,000 total)

### What Was Built

- Rolling context window trimming with atomic tool-pair removal — long conversations never overflow silently
- Inter-iteration trim: tool result messages removed as atomic pairs between agent loop iterations
- Sub-agent content cap (600k chars) enforced before API call; "maximum" keyword added to APIError detection
- Three blank response guards: empty content fallback, finish_reason=length error event, maybe_single() hardening
- Keyword search folder scope — `_keyword_search` + `keyword_search_chunks` RPC now accept and apply `folder_ids`
- `read_document` context capped at 3,000 chars with truncation note
- Metadata case normalization: `document_type`/`language` lowercased at ingest; all filter values at search
- System prompt confidence hedging (similarity < 0.4) + structured citation format guidance
- Settings file TTL cache (5s) on `_load_override()` — reduces per-message disk reads
- Sentence boundary chunking fix: `.!?` followed by non-space no longer triggers split
- Sub-agent model auto-selection per provider (Haiku / GPT-4o-mini / Gemini Flash / fallback)
- Provider-aware context budgets (Anthropic 120k, OpenAI 200k, Google 180k, OpenRouter 100k, Ollama 80k)
- JSON token estimation corrected to chars/3 (from chars/4) for tool call JSON density

### What Worked

- **Batch execution for straightforward phases** — Phases 20–24 were executed in a single commit (d996f9f); this worked well because each phase was narrowly scoped and non-overlapping. Saved significant overhead for simple hardening work.
- **Integration checker as verification substitute** — With no VERIFICATION.md for phases 18–24, the integration checker (6/6 pass, 5/5 E2E flows) gave high confidence that code is correctly wired. Faster than formal verification for stable codebases.
- **Audit before close** — Running `/gsd:audit-milestone` caught 3 orphaned requirement IDs (CTX-06/07/08) and stale progress table entries. Fixed in 5 minutes rather than shipping with documentation gaps.
- **Phase 25 as the capstone** — Grouping provider-aware budgets + sub-agent model selection + token estimation fix into one phase kept related config changes together and made testing cohesive.

### What Was Inefficient

- **No VERIFICATION.md for 7 of 8 phases** — The fast execution cadence skipped formal verification passes. Code is correct per integration check, but traceability is weaker than it could be.
- **Two test files lost** — `test_blank_response_guards.py` and `test_rag_correctness.py` cited in SUMMARYs but absent from disk. Likely fell out of a batch commit. Would have been caught by a post-phase VERIFICATION.md.
- **CTX-06/07/08 coined in plan but not in REQUIREMENTS.md** — Phase 25 plan created new requirement IDs without adding them to the canonical file. Small admin gap but required cleanup at milestone close.
- **Phase details in ROADMAP.md had stale `18-01-PLAN.md` plan references** for phases 19–24 — was copy-paste artifact from rapid drafting.

### Patterns Established

- **Batch commit for cohesive non-overlapping phases** — When 3–5 phases share a single commit, write a mega-commit message that summarizes all phases. Good for stability/hardening sprints where phases are narrow and deterministic.
- **Integration checker as tier-2 verification** — For phases without VERIFICATION.md, run the integration checker and record results in the audit file. Sufficient for simple backend hardening.
- **Provider string as config key** — Keying defaults by `llm_provider` setting value (matching what the user sets) is clean and extensible. Empty string sentinel for unknown providers falls back gracefully.

### Key Lessons

- Write test files to disk before committing — don't cite them in SUMMARY if they aren't committed. The audit has no way to verify claimed test files exist.
- When a plan coins new requirement IDs, add them to REQUIREMENTS.md immediately (not just in plan frontmatter). The plan frontmatter is ephemeral; REQUIREMENTS.md is canonical.
- "Simple" phases don't need VERIFICATION.md, but they DO need their test files committed. A SUMMARY that says "unit tests cover X" is only meaningful if the test file is on disk.
- Provider-aware defaults are a better pattern than a single global cap — allows tuning per provider without breaking others.

### Cost Observations

- Model: claude-sonnet-4-6 throughout
- Sessions: 2–3 across 3 days (very fast pace for a stability milestone)
- Notable: Phases 20–24 executed in a single session with a single batch commit; Phase 25 was the most complex (~3 min execution per the SUMMARY) and the only one with a VERIFICATION.md

---

## Milestone: v2.2 — Trust & Compliance

**Shipped:** 2026-04-16
**Phases:** 7 | **Plans:** 13 | **Tasks:** 22
**Timeline:** 2026-04-12 → 2026-04-16 (4 days)
**Commits:** 72

### What Was Built
- Citations backend: retrieval_service returns (results, avg_similarity) tuple; SSE `citations` + `confidence` events
- Citations frontend: collapsible CitationCard, CitationList, colour-coded ConfidenceBadge with Low disclaimer
- Document versioning: `version_number`/`is_latest` columns, re-upload creates new version, old chunks retired from all RPCs, version badge shown in UI
- Audit log: INSERT-only `audit_log` table, async BackgroundTask writes across 8 action types, paginated Settings viewer with CSV export
- Suggested follow-up questions: SSE timeline `done → suggestions → stream_end`, SuggestionPills component gated on General mode

### What Worked
- TDD (RED → GREEN) pattern applied consistently across all 7 phases — caught integration issues early
- Splitting backend/frontend into separate phases kept each plan focused and executable
- `asyncio.create_task` for SSE-path audit writes solved the blocking problem cleanly
- `slice assignment` trick (`unique_citations[:] = ...`) for closure capture was a neat Python pattern

### What Was Inefficient
- Several SUMMARY.md files have empty `one_liner:` fields — the template extraction relies on this field
- No milestone audit performed — proceeding on requirement count alone

### Key Lessons
- SSE generators require `asyncio.create_task` for fire-and-forget (not `BackgroundTasks`, which doesn't work inside generators)
- Pydantic `slice assignment` pattern for closure-captured mutable state avoids a class of subtle bugs
- Per-phase UI-SPEC.md (citations, versioning UI) made frontend phases cleaner — worth continuing

---

## Milestone: v2.3 — Memory, Multimodal & Experience

**Shipped:** 2026-04-19
**Phases:** 11 (Phases 33–43) | **Plans:** 27 | **Tasks:** ~50
**Timeline:** 2026-04-16 → 2026-04-19 (3 days)
**Commits:** 139
**LOC:** ~57,000 total (Python + TypeScript)

### What Was Built

- Cross-thread memory: `user_memory` table with RLS, remember/recall tools, auto-injection into General Mode, Settings UI (MemorySection)
- Multi-modal ingestion: PDF/DOCX table extraction (pdfplumber), image description via vision LLM, `document_tables` + `document_images` tables
- Multi-modal query: `query_tables` tool, image descriptions in vector search, Tables/Images badge chips on documents
- Knowledge Health Dashboard: 4-metric API (most-retrieved, never-retrieved, low-confidence, stale) from audit_log, reingest endpoint, full frontend page with 2x2 grid
- User Feedback Loop: `message_feedback` table with immutable ratings, thumbs up/down with reason selector, `FeedbackStatsPanel` in Library Health
- Deep Midnight UI: glassmorphic ToolCallPanel, gradient CitationCard, animated CitationList (Radix Collapsible), floating pill MessageInput
- Layout refactor: AppDock vertical icon rail, 3-pane SkillsPage with tonal backgrounds, gradient toggle glow, tonal SettingsPage cards
- Mobile & Responsive: NavPanel collapsible navigation, frosted drawer overlay, 5-tab Settings refactor, responsive breakpoints

### What Worked

- **Backend/frontend phase pairing** — Phases 33+34, 37+38, 39+40 split backend and frontend cleanly; each plan was focused and executable in 2–8 minutes
- **Consistent fire-and-forget pattern** — `asyncio.create_task` used for memory writes (Phase 33), audit writes (Phase 30), and feedback writes (Phase 39) — same pattern across three different features
- **Additive CSS-only UI redesign** — All Deep Midnight changes are Tailwind classes with zero logic changes to SSE parsing or state management; zero regression risk
- **Quick execution pace** — 11 phases in 3 days is the fastest milestone yet; narrow phase scoping and TDD scaffolds kept each plan under 10 minutes

### What Was Inefficient

- **UAT verification gaps** — 4 phases have incomplete UAT and 5 have `human_needed` verification status; live browser testing wasn't performed for phases 038–042
- **Quick task status markers** — 12 quick task entries show "missing" status despite being committed; procedural cleanup not done
- **Phase 041 plan reference error** — Phase 41 ROADMAP references 038-01 and 038-02 plan IDs instead of 041-01/041-02

### Patterns Established

- **Memory injection pattern** — Top-N memory entries injected as a concise block at system prompt start; Explorer mode excluded by design
- **Health metrics from audit_log** — Already-present audit data repurposed for knowledge health metrics; zero new data collection needed
- **Additive Tailwind redesign** — Visual refreshes done purely through className changes, not component rewrites; safe pattern for UI evolution

### Key Lessons

- UAT that requires live browser testing should be scheduled as a dedicated activity, not deferred
- When ROADMAP phase plans reference wrong plan IDs, milestone audit catches it but it causes confusion during execution
- Multi-modal ingestion resilience (non-fatal extraction) was the right call — ingestion continues even if image description or table extraction fails
- 3-pane layouts (SkillsPage, health dashboard) benefit from tonal background shifts instead of hard border-r dividers

### Cost Observations

- Model: claude-sonnet-4-6 throughout
- Sessions: multiple across 3 days (fastest milestone pace)
- Notable: Phases 35 (multi-modal) had the most complex backend work; Phase 43 (mobile) required the most UI iteration

---

## Milestone: v2.5 — Deployment Strategy

**Shipped:** 2026-05-09
**Phases:** 16 (Phases 058–067.5; 1 deferred — 064) | **Plans:** 64 | **Tasks:** 112
**Timeline:** 2026-04-30 → 2026-05-09 (10 days)
**Commits:** 445
**LOC delta:** +107,682 / −3,715 across 531 files

### What Was Built

- Backend SSE concurrency unblocked: `aexec` async wrapper around supabase `.execute()` + AnyIO 200-token limiter; cross-tab GET dropped from ~30s queued to <1s during streaming (Phase 058, CONCUR-01)
- Run-backed streaming architecture: `asyncio.Queue` + sse-starlette (059), Redis Streams `run:{run_id}` durable buffer (061), replay-and-tail HTTP API `GET /runs/{rid}/stream?since=N` (062), POST returns JSON `{message_id, run_id}` + frontend reattaches via separate subscription (063), gap closure round (063.1)
- Adaptive run timeouts + lifecycle states: per-LLM-call budget that resets on tool-call boundaries; `cancelled` (user-Stop) vs `timed_out` (system limit) distinction; "Agent reached time limit" UI banner with Resume button (Phase 066, closes Gap-006)
- Streaming UX polish: empty-paint, "Saving response…" thrash, refresh-required first-paint, redis-consumer log noise, tool-call iteration boundary (Phase 067) + context-aware in-flight copy + multi-step-intent system prompt + skill-load tool-card copy (Phase 067.1)
- Streaming render & storage fixes (cross-phase chain 067.2 → 067.5): per-thread message store via `messagesByThread` Map, sandbox-output download via JS blob fetch, model→provider router, suggestions emit always-emit-empty + reordered before `done`, code-execution heartbeat events, empty-thread-until-refresh fix via `clearMessages` streaming-bucket guard
- Skills test infrastructure repair: 11 patch sites renamed + 19 fakes tuple-wrapped (065-01); 3 export assertion drifts fixed (065-02); 11 tests migrated to canonical Phase 063 POST→GET-stream pattern (065-03); combined skills test run 26/26 pass (Phase 065)

### What Worked

- **Run-backed streaming as a single feature branch (D-v2.5-11)** — 061 + 062 + 063 shipped together as one merge commit; no feature flags, no dual code paths, no half-state on main. Made each phase's verification cleaner because there was no "with feature flag on" vs "off" surface to maintain.
- **Cross-phase escalation chain** — When 067.2's user-driven UAT surfaced 3 RED rows, escalating to 067.3 (which closed R-1/R-2/N-01) → 067.4 (which closed R-3 + 067.4-discovered R-4/R-5) → 067.5 (which closed Row 11) preserved scope discipline at every step. Each phase had a clear gate-blocking row, no scope creep, and the chain closed cleanly.
- **Strict 12/12 GREEN gate on user-driven UAT** — refusing partial-with-approval shortcuts on 067.2/067.3/067.4 forced real fixes instead of paper closures. Ultimately the chain shipped 100% of gate-blocking rows GREEN downstream; the strict gate kept signal honest.
- **Worktree-isolated parallel execution** — Phases 065 / 066 / 067 wave executors ran in `.claude/worktrees/agent-*` directories with merge-back protection for STATE.md / ROADMAP.md (orchestrator-owned files always win). No corruption; no last-merge-wins races.
- **Plan-checker iteration loop** — On 065-03, the plan-checker's first pass found 1 BLOCKER + 4 WARNINGS (TERMINAL_TYPES misdoc + scope/mock-fragility flags). Targeted revision passed iteration 2 cleanly. The loop caught real defects without forcing replanning.
- **Test-only maintenance discipline (Phase 065)** — Plans 01/02/03 each touched exactly one test file, no production code, atomic commits. Made post-merge regression diagnosis trivial and gave the next milestone (Skill Studio) a clean foundation.

### What Was Inefficient

- **ROADMAP / STATE.md drift** — At v2.5 close, 5 phases were administratively `[ ]` despite shipping (065 just completed; 066 closed 2026-05-06; 067.2/067.3/067.4 closed via cross-phase chain; 067.5 missing from top-section entirely). `phase.complete` SDK reported `roadmap_updated: true` but didn't actually flip checkboxes. Required a manual reconciliation pass at milestone close that should have happened phase-by-phase.
- **HUMAN-UAT.md status fields not updated** — All 10 UAT scoreboards showed legacy `blocked` / `gaps_blocking` / `partial` statuses even after their gate-blocking rows closed downstream. Required acknowledgement at milestone close. Future workflow: when a downstream phase closes a previous phase's gate-blocking row, the closing phase's executor should update the upstream HUMAN-UAT.md status field too (cross-phase-mirror discipline).
- **First UAT row mis-verdict on 067.4** — Initial Row 1 (R-3) RED was logged due to a stale DOM probe taken between the `done` and `suggestions` SSE events landing in React state. User reviewer correctly flagged the false RED. Lesson: when verifying SSE-emitted UI, `wait_for` against the actual rendered text content, not a snapshot timestamp.
- **Worktree wrong-cwd misstep on 065-03** — Executor's Bash commands ran against the main repo's working tree instead of the worktree (despite env block). Caught at commit time; recovered by copying file → worktree and reverting main. ~5 minutes of time lost. Lesson: in worktree mode, the executor should explicitly `cd` to the worktree on every shell command, not rely on env propagation.
- **`max_tokens` 200→800 hypothesis on R-3** — Phase 067.3 spent UAT cycles testing a model-budget hypothesis that didn't fix the suggestion-pills issue; root cause was always-emit-empty + producer-wire-ordering. The disconfirming retest run_id `00dcf270-…` still showed no `suggestions` event in SSE. Lesson: when a hypothesis is tested live and disconfirmed, capture the disconfirmation evidence loudly so the next plan doesn't re-investigate the same path.

### Patterns Established

- **Run-backed streaming key conventions** — `run:{run_id}` (Redis Stream per-run buffer), `runs_by_thread:{tid}` (sorted set per-thread), `runs:active` (sorted set global). All three keyed off `run_id` from `_uuid_mod.uuid4()` at `threads.py:948`. Documented in CLAUDE.md.
- **`_build_mock_supabase()` shared test fixture** — Per-table routing in `_run_helpers.py:179` with INSERT-id contract honored. Replaces per-test `mock_builder.execute.side_effect = [...]` arrays. Adopted by 065-03 + canonical analog `test_063_post_then_subscribe.py`.
- **Per-thread message store via Map** — `messagesByThread: Map<string, Message[]>` (LRU N=5) replaces the v2.4 single-buffer pattern. Adopted in Phase 067.3 R-1 fix; preserved as architectural invariant by all subsequent 067.x phases.
- **POST→GET-stream pattern** — POST returns `JSONResponse({message_id, run_id})` synchronously (HTTP 201); SSE consumed from `GET /runs/{run_id}/stream?since=N`. Replaces the v2.4 SSE-on-POST pattern. Adopted across `test_063_post_then_subscribe.py`, all 11 tests in `test_threads_skills.py` (post-065-03), and the production frontend.
- **Cross-phase closure rule** — When phase A's gate-blocking row is fixed by downstream phase B, A closes via narrative pointing at B's evidence. ROADMAP closure annotations document the chain so future readers don't have to spelunk.
- **`_reset_redis_singleton` autouse fixture** — Required for any test that hits the real `get_redis()` singleton because pytest-asyncio function-scope creates a fresh loop per test. Verbatim copy at `test_062_stream_replay.py:36-51` and `test_063_post_then_subscribe.py:45-62`.

### Key Lessons

- **Single feature branch beats incremental cutover for atomic architectural changes** — D-v2.5-11 (061 + 062 + 063 ship together) was the right call; would have been a bug magnet to ship 061 alone with the frontend still POSTing-and-streaming the legacy way.
- **Strict UAT gates produce honest closure** — the cross-phase 067.2/067.3/067.4 chain repeatedly tested "am I being lazy?" and answered no by escalating to a fresh phase. Each escalation surfaced a real defect instead of papering over with project-level approval.
- **Preserve `messagesByThread` invariants when extending the streaming surface** — every 067.x phase had to re-verify R-1 cross-thread protection. Plan 02 of 067.5 explicitly skipped the runtime R-1 retest because vitest covers it; that was the right call because the Branch D-3 fix was structurally additive.
- **`gsd-tools.cjs audit-open` surfaces drift but doesn't itself flip stale status** — milestone close needs a manual reconciliation pass. The audit's job is signal, not action.
- **When deferring an item, plant a seed with concrete `re_open_triggers`** — SEED-009/010/011 captured 3 carry-forwards from v2.5 with explicit re-open conditions. SEED-012/013/014 captured 3 forward-looking strategic ideas with cross-references to existing seeds. The "Capture every deferred idea" principle (memory `feedback_preserve_all_deferred_ideas.md`) paid off at close.
- **Document the WHY of cross-phase chains in ROADMAP** — closure annotations like "Closed via 067.5 — Row 11 RED resolved (5/5 cycles GREEN, Branch D-3 fix at commit 3d040c7)" save the next planner from rediscovering the chain. Especially valuable when 067.2/067.3/067.4 all close on the same day via different downstream phases.
- **Vibe-coder-friendly summaries belong in user-facing artifacts (ROADMAP, STATE)** — internal artifacts (CONTEXT.md, PLAN.md, commits) get the precise terminology. The two registers should not be confused.

### Cost Observations

- Model mix: ~95% claude-opus-4-7 (1M context) for orchestration, planning, executor work; ~5% claude-sonnet-4-6 for plan-checking and verification (faster turnaround on structured outputs)
- Sessions: many across 10 days; the milestone close itself was a single multi-hour session covering audit + reconciliation + 3 forward-looking seeds + close-out
- Notable: Phase 067.x cross-phase chain consumed disproportionate session count due to the strict 12/12 UAT gate forcing rework on 067.2 → 067.3 → 067.4 → 067.5. Single-shot cost of the strict gate was high; long-term value (no paper closures shipped) was higher.

---

## Milestone: v2.7 — Agent Workspace & Panel

**Shipped:** 2026-05-30
**Phases:** 6 (083-088) | **Plans:** 28 | **Tasks:** 50
**Timeline:** 2026-05-27 → 2026-05-30 (3 days)
**Commits:** 226
**LOC delta:** +52,449 / −3,081 across 673 files

### What Was Built

- Tool-dispatch chain extracted from `threads.py` into a registry-pattern `tool_dispatcher.py` (G-5; 16 tools migrated byte-identical) + 4 carried v2.6 bugs closed (Phase 083)
- Per-thread workspace filesystem: `workspace_files` + `workspace_file_versions`, hybrid inline-Postgres (≤256 KB) / Supabase Storage, FK-chain RLS, 5 tools, 4 owner-scoped GET endpoints, SSE write/delete events (Phase 084)
- 3 new agent tools: `write_todos`, `task` (sub-agent — 1-level nesting + per-run `Semaphore(3)` / global Redis cap 20), `ask_user` (the codebase's first Redis pub/sub, cross-worker pause/resume) (Phase 085)
- StreamsProvider SSE demux to dedicated Zustand stores; per-thread reconcile-on-switch hooks; zero chat-list re-renders on panel events (Phase 086)
- Right-side workspace panel: open/rail/hidden ChatLayout grid, todos, file browser with per-type preview, client-side unified-diff viewer, ask_user answer surface + chat↔panel seam (Phase 087)
- WCAG 2.1 AA on all 8 panel surfaces (vitest-axe gate, contrast fixed both themes, focus ring, keyboard walk) + live 4-axis cross-provider UAT 6/6 + SEED-034 fold + D-17 close (Phase 088)

### What Worked

- **Sketch-before-plan (G-2) for the panel** — Phase 087 built to operator-approved mockups (`sketch-findings-agentic-rag`) as the acceptance bar, not a code-first design. The panel still needed gap-closure waves (087-06/07/08) but every wave converged on the sketched contract.
- **Strict build order** — tool-dispatch extraction first (083), workspace backend before panel (084→087), StreamsProvider demux before UI (086→087). Panel components built against working hooks, never mocks — the recurring "don't build UI before the events exist" discipline held.
- **Verification-as-a-phase (088)** — making cross-cutting verification + a11y its own phase (not a post-hoc checklist) caught the real rendered-contrast failure (3.59:1 → 7.21:1) that the structural axe gate passed clean, plus 2 other live blockers (file-id 404, todo colors).
- **In-band gap closure** — 083/084/085/087/088 each closed their own UAT-surfaced bugs within the phase (sub-agent 404 BUG-260528-01, ask_user crash BUG-260529-03, the 3 D-16 088 blockers) instead of spawning new phases — the 8-phase cascade never ballooned the way v2.6's 075.x did.
- **Evidence-based SEED-034 fold** — 088 built `scripts/eval_cross_provider.py`, MEASURED per-provider tool-use across a 6×4 matrix before/after, and folded only a text-only directive proven +3 / −0. "Measure → gate → conditional-apply" is now a reusable provider-prompt-change pattern.

### What Was Inefficient

- **REQUIREMENTS.md traceability drift** — PANEL-05/06 shipped + verified in Phase 086 but the traceability table still read "Pending"/unchecked at close; required reconciliation. Same phase-by-phase status-mirror gap flagged in the v2.5 retro.
- **STATE.md frontmatter drift** — `completed_phases`/`percent` showed 7 / 117% (overcounted) until the `milestone complete` CLI recomputed from `roadmap.analyze`. The frontmatter math isn't self-healing mid-milestone.
- **086 localStorage write-path shipped as a read-only stub (WR-04)** — panel-Map hydration always returned empty because the write side omitted the Map params; caught at verification, closed via a follow-up quick task (260529-0sc) rather than in-phase.
- **Two redundant panel toggles** — 087 first shipped a chat-header toggle AND an in-panel control with a confusing hidden state; 087-08 consolidated to one nav-style collapse-to-rail toggle. The toggle state machine should have been locked in the sketch before 087-02.
- **Title-gen bug folded-but-unverified** — BUG-260527-01 was marked `folded_into: 083` but never live-verified; rolled forward to v2.8 at close. Folding a fix is not the same as proving it stopped reproducing.

### Patterns Established

- **`tool_dispatcher.py` registry** — new agent tools register in one place; `threads.py` stays out of tool-specific logic. The extraction that unblocked all 8 of v2.7's new tools.
- **Redis pub/sub for cross-worker coordination** — `ask_user`'s SUBSCRIBE-first ordering + cancel sentinel + lifespan shutdown broadcast is the template for any future worker-spanning pause/resume under `WORKER_COUNT=2`.
- **Panel events → dedicated Zustand keys (PANEL-06)** — never route panel state through chat `bucketsBySurface`; the isolation invariant that keeps a second UI surface from re-rendering the chat message list.
- **Measure → gate → conditional-apply for shared-prompt changes** — a localhost-gated eval harness that proves +N / −0 before folding a provider-prompt change; `scripts/eval_cross_provider.py` is the v2.8 eval seed.
- **Verification + a11y as a dedicated capstone phase** — structural axe gates pass on broken contrast; real rendered-contrast + keyboard walk + cross-provider scoreboard belong in their own phase with an operator felt-pass gate.

### Key Lessons

- Structural a11y gates (vitest-axe) are necessary but NOT sufficient — they passed while real rendered contrast was 3.59:1. Verify rendered contrast in both themes against the live DOM (G-4 lived-experience), not just the axe assertion.
- Cross-provider tool-use reliability is a measurable property, not an assumption — the eval script turned "does `write_todos` fire on weak models?" into a 6×4 scoreboard. Build the harness before tuning the prompt.
- Fold ≠ verify: a bug marked `folded_into` a phase still needs live-reproduction evidence before flipping to `closed`. Carry an explicit `re_open_trigger` when rolling an unverified fix forward.
- Lock the interaction model in the sketch, not in code — the two-toggle panel confusion (closed by 087-08) leaked into implementation because the toggle state machine wasn't in the approved mockup.
- A dedicated verification phase pays for itself — 088 found + fixed 3 real blockers that 5 prior phases of structural testing missed.

### Cost Observations

- Model mix: ~Opus 4.x for orchestration / planning / execution; eval + a11y + 4-axis UAT operator-driven via Chrome MCP and the real backend
- Sessions: multiple across 3 days — 28 plans / 3 days ≈ 9.3 plans/day, the fastest milestone yet by plans/day
- Notable: Phase 087 (panel UI, 8 plans incl. 3 gap-closure waves) and Phase 088 (verification capstone, ~1h40m on the final plan) consumed the most; backend phases 083-085 were clean single/dual-wave executions

---

## Milestone: v2.8 — Harness Engine & Workflow Mode

**Shipped:** 2026-06-07
**Phases:** 10 (089-096, incl. inserted refactor 092.5 + inserted live-UAT phase 095.1) | **Plans:** 67
**Timeline:** 2026-05-30 → 2026-06-07 (9 days)
**Commits:** 498 (121 feat)
**LOC delta:** +107,662 / −6,187 across 578 files

### What Was Built

- Agent-loop extraction from the `threads.py` god file into a byte-identical `agent_loop.py` (G-5) + the v2.7 carry-forward UAT sweep (Phase 089)
- Harness Postgres substrate: versioned immutable-on-publish `workflow_definitions`, `workflow_runs`/`workflow_phases`, INSERT-only `harness_audit`, FK-chain RLS, typed Pydantic phase-config models (migrations 056-060, Phase 090)
- The Harness Engine: hand-rolled async transition loop (2-phase write + reachability lint + `PHASE_TYPE_REGISTRY`), 5 phase-type executors, 4 validation-gate kinds + bounded retry + step/wall-clock caps, per-phase tool whitelist at `dispatch_tool` (Deep no-op), 4 seed templates — ~80% composition, zero new deps (Phase 091)
- Dual-mode wiring: per-thread Deep/Harness toggle on `active_workflow_run_id`, server-enforced workflow lock (409), Cancel-clears-in-terminal-txn, SEED-029 Continue affordance (Phase 092)
- Provider Gateway Extraction (inserted): per-provider dispatch + chunk-normalization lifted into a shared `provider_gateway/` Deep AND the harness consume; `calling_mode` surfaced through the seam — Deep proven byte-identical native-7 (Phase 092.5)
- Harness cross-provider parity: consume-the-gateway rewrite, shared resolve-never-mutate model-resolver, ask_user round-trip, 3 never-run phase-types completed (`split_topic` → real N-way fan-out), Google `thought_signature` / Moonshot `reasoning_content` / GLM `max_steps` round-trips fixed — D-21 live re-UAT 8/8 (Phase 093)
- Workflow legibility: live WCAG 2.1 AA phase-timeline + harness RunCard in the panel (`phasesByThread`, PANEL-06 zero chat re-renders), failure-with-reason honesty, mode disambiguation (Phase 094)
- Chat tool-card unification + cross-provider run honesty: one frame / auto-scroll / no-duplicates / working download (095); deterministic activity-derived panel fill, gateway-boundary 429-vs-billing classification, true reload timer, model attribution, deliverable-aware Resume (inserted Phase 095.1)
- Eval + concurrency + resumability: `eval_cross_provider.py` CI regression gate, offline harness regression test (caught a live `phase_whitelist`-to-sub-agent security gap), restart-mid-workflow smoke (3 kill points live, incl. graceful-shutdown resumability), `llm_batch_agents` fan-out bound, StreamsProvider LRU-3 stream cap, 8-provider model curation (Phase 096)

### What Worked

- **Composition over new infrastructure** — the harness was ~80% reuse of shipped, cross-provider-tested primitives (`tool_dispatcher`, `task`/`ask_user`, run-backed Redis) with ZERO new dependencies. The deliberate v2.7 investment in those primitives paid off directly; "build the runtime out of parts you've already battle-tested" held.
- **Byte-identical red-line discipline** — Deep Mode never broke across the 089 extraction, the 092.5 gateway lift, or the 093 consumption, each *proven* (not asserted) via SSE-diff + eval + adversarial-agent residual analysis. A risky 3-phase refactor on the hottest path shipped with zero Deep regression.
- **Evidence-driven mid-milestone rescope** — when 092-07 live UAT + a comprehensive audit proved the harness only worked on OpenAI, the response was a structural fix (092.5 gateway extraction + rescoped 093), not a pile of per-provider patches. "Investigate first, root-cause over band-aid" turned a substrate bug into one shared home.
- **Inserting honesty phases from live UAT** — 095.1 was born from 095's all-8-provider UAT surfacing dishonest UX (panel-empty, 429-as-billing, lying timer). Treating "the run lies about what it did" as a real defect worth its own phase, rather than shipping it, is the right bar.
- **Code review on the substrate caught what green tests missed** — 091 (CAS double-exec under WORKER_COUNT=2 + 64KB output loss), 096 (`phase_whitelist` never propagated to the sub-agent ctx — a real security gap, caught on the CI gate's first run). Adversarial review of the engine earned its keep.
- **Repeatable verification rituals** — `restart_smoke.py` (3 kill points) + `conc_probe.py` (N=10 fan-out, p95, AnyIO budget) made shutdown/concurrency claims measurable and re-runnable instead of one-shot manual checks.

### What Was Inefficient

- **The harness-OpenAI-only gap surfaced far too late** — wire-format + mock checks passed green through 091/092 while the real cross-provider path failed; it took 092-07 *live* UAT to expose it. This is the SC#10 4-axis lesson re-learned the hard way, and it cost a mid-milestone rescope (092.5 + rescoped 093 + 4 gap plans).
- **Boundary extracted after building on top of it** — 092.5 (gateway) arguably should have preceded the engine; building the harness on un-extracted provider dispatch baked in the OpenAI-only assumption that 093 then had to unwind.
- **Persistent gap-closure waves post-"done"** — 092 (+3 gap plans), 093 (+4), 095 (+4), 095.1 (+2): live cross-provider UAT kept surfacing defects after a phase read complete. The plan-time success criteria didn't anticipate the cross-provider failure modes the live runs found.
- **CONC-01 shipped partial** — cross-tab GET p95 improved 2.9× (8,564 → 2,958 ms) but the <50ms SC stayed unmet; the residual was precisely located (sync stream-create at `provider_gateway/dispatcher.py:94-115`) and deferred to SEED-065-B rather than solved in-milestone.
- **Greenfield deploy gap** — seed workflow definitions live only in migration INSERTs; `full-schema.sql` (schema-only pg_dump) carries no seed rows, so a from-scratch env has zero workflows (DI-096-01-A, warning-level, carried).

### Patterns Established

- **Provider gateway = one home for all provider logic** — consume, never re-implement; Deep byte-identical is the non-negotiable red line. The seam Phase 093 (and every future provider feature) builds on.
- **Resolve, never mutate** — model resolution reads the provider's effective settings and resolves a model for the run without writing back to saved settings (kills the stale-id + cross-contamination class).
- **Run honesty = projection/classification over existing data** — attribution, true timer, error-kind, panel fill are all derived from data already persisted (no migration, no new SSE event, no shared-path edit).
- **Error classification at the gateway boundary on structured status codes** — 429=rate-limit (always before billing), 401=auth, insufficient_quota=billing, else neutral — never keyword-soup over message text.
- **Offline CI harness regression via a scripted fake gateway provider** — drives the REAL engine deterministically with no network; caught a security gap on first run and is now a standing gate.
- **Restart-smoke + conc_probe before a shutdown/concurrency change closes** — a kill-at-each-phase-type ritual + a fan-out/latency probe as the binding evidence.

### Key Lessons

- **SC#10 is load-bearing, and skipping it early is expensive** — the milestone's biggest cost (the mid-flight rescope) traces directly to a cross-provider gap that single-provider wire checks couldn't see. The 4-axis mandate exists *because* of this exact failure mode; honor it at plan time, not at the verifier.
- **Extract the shared boundary before building on it** — building the engine on un-extracted provider dispatch is what made it OpenAI-only. When a feature will sit on a provider/shared path, audit-and-extract first (G-5 in spirit), then build.
- **Honesty defects are real defects** — a run that misreports who answered, how long it took, or whether Resume is safe is a trust bug; it earns a phase, not a shrug.
- **Adversarial code review pays off on substrate code** — the criticals it caught (CAS double-exec, 64KB loss, whitelist-to-sub-agent security gap) were all invisible to passing tests.
- **Partial-but-measured beats hand-wave** — CONC-01 closed honestly with a re-measured p95, a precisely-located residual, and a tracked seed — far better than a vague "good enough" or a silently-dropped SC.

### Cost Observations

- Model mix: Opus 4.x for orchestration / planning / execution; live cross-provider UAT + restart-smoke + conc_probe operator-driven (Chrome MCP + psycopg2 DB cross-checks against local Supabase :54322)
- Sessions: many across 9 days — 67 plans / 9 days ≈ 7.4 plans/day
- Notable: the mid-milestone rescope (092.5 + rescoped 093 + gap waves) and the two inserted phases (092.5, 095.1) were the bulk of the unplanned spend; **498 commits is the highest of any milestone to date** — a signal of how much live-UAT-driven gap closure this provider-surface milestone absorbed

---

## Milestone: v2.9 — Workflow Studio

**Shipped:** 2026-06-15
**Phases:** 9 CORE (097–104, incl. inserted emission-layer 101.1) | **Plans:** 57 | STRETCH 105–109 deferred

### What Was Built
Turned the v2.8 harness into an authorable capability: project=folder binding + server-side KB scope governance (model-unwidenable), workflow↔skill composition with locked version snapshots, ephemeral one-run template upload, a shared guaranteed-cited-emission `llm_emit` layer + integrity gates (corrupt files can never reach the user as "done"), a reusable validation-gate library + an `llm_judge` output-quality **hard publish blocker**, a Workflows page with NL→draft authoring + read-only phase-spine graph + an 8-stage publish gauntlet, and a PM flagship content pack authored entirely on the generic primitives.

### What Worked
- **Composition over re-implementation held the red line.** ~80–90% of the milestone was reuse of shipped harness primitives; Deep Mode stayed byte-identical across all 9 phases because every engine addition was an additive seam, never a breaking change to the G-5 hot files.
- **Per-phase rigor substituted for a milestone audit.** Each CORE phase ran verify-work + secure-phase + live cross-provider UAT, so close-time confidence was high without a separate audit pass (102: 34/34 threats + 7/7 SC#10; 103: 32 threats/0 open; 104: 15 threats/0 open + nyquist + UAT 5/5).
- **Live-driven validation caught what static tests missed, repeatedly.** Driving the REAL endpoints (publish, emit, judge) surfaced blockers that mocks and static def-shape tests false-green'd.

### What Was Inefficient
- **The "static would false-green" trap recurred across 099/102/104.** Each time, mock-masked or static-test-passed code shipped "complete" but was non-functional live (099: 2 mock-masked blockers; 102: 6; 104: 2 double-gate engine bugs). The pattern is now a named decision — but it cost gap-closure waves on three phases before the lesson fully generalized to auditors and validation maps themselves.
- **STATE.md re-balloon recurred** during 104 executor writes (343KB→1.5MB) — required restore-from-clean-base. Guard: keep STATE.md edits small/targeted.
- **Reasoning-model forced-emit reliability** (DeepSeek/Gemini `model_failed_to_emit`) remains a provider-boundary rough edge surfaced at the 104 cross-provider scoreboard (honest-fail, never a silent bad file — the bar was met, but forcing reliability is a follow-up, SEED-082).

### Patterns Established
- **Guaranteed structured emission as an engine layer** (FORCE a cited field-map → deterministic no-model-code render) — the generic home for any typed-artifact workflow.
- **Judge-as-hard-wall at publish** — a lint-clean workflow that produces bad output cannot publish; the judge runs live on a real golden run.
- **Orchestrator hand-spot-checks the highest-stakes controls** rather than trusting an auditor/verifier blind (the 102/103/104 secure-phase practice).
- **Re-run automated verification at validate-phase**, don't trust stale status labels — 104's validate-phase found 2 integration tests that were green at execution but brittle against the phase's own Tweak→v(N+1) versioning feature.

### Key Lessons
- Drive the real endpoint. A gate, judge, or validator is unproven until it runs against the live path on real data — static shape checks and mocks systematically false-green.
- Additive seams + a None-gated no-op are how you add capability without breaking the shared path; the discipline is what kept Deep byte-identical through 9 phases.
- Cross-provider honesty (never a silent bad deliverable) is a more durable acceptance bar than cross-provider success — all 7 natives honest-failed or succeeded; none silently narrated.

### Cost Observations
- Model mix: Opus 4.x for orchestration / planning / execution; live cross-provider UAT operator- and Claude-driven (Chrome MCP + psycopg2 DB cross-checks against local Supabase :54322).
- Sessions: many across 8 days — 57 plans / 8 days ≈ 7.1 plans/day.
- Notable: one inserted phase (101.1 emission layer) absorbed the template-fill gap-closure; three phases (099/102/104) needed live-UAT gap-closure waves for mock-masked blockers — the recurring cost of this milestone.

---

## Milestone: v3.0 — Document Management

**Shipped:** 2026-06-21
**Phases:** 11 (110, 111, 111.1, 112–119; incl. inserted embeddings 111.1) | **Plans:** 46 | **Tasks:** 88

### What Was Built
Turned the product's incidental document handling into a first-class, metadata-driven surface (M-Files Tier A): a shared DM substrate (audit enums + owner-private RLS + forward-compat `org_id` + a default-on feature flag), metadata enrichment (model-configurable extraction, larger window, user-defined custom fields, per-field confidence + audited manual override), configurable multi-provider embeddings (retiring the OpenAI SPOF), metadata-driven "virtual folders" (a closed-registry filter-AST → parameterized-jsonb compiler + a no-DSL builder + a saved-Views sidebar + an agent tool), typed document relationships (a leak-safe share-don't-fork core + a detail-panel section + an agent tool), suggest-then-confirm auto-classification, and a light governance-health view.

### What Worked
- **The leak-safe "share-don't-fork" pattern paid off twice.** Extracting the saved-view resolve (115) and the relationship traversal (117) into single shared cores consumed by BOTH the agent tool and the REST route meant the cross-user-leak invariant was proven once and couldn't drift — and live two-user leak proofs backed it on the agent-tool phases.
- **Per-phase rigor (verify + secure + validate) again substituted for a milestone audit.** All 11 phases cleared three gates with live evidence; close-time confidence was high without a separate audit pass.
- **A net-new substrate landed once (110) and the rest added behavior, not schema.** Putting the 4 RLS tables + audit enums + the feature flag down first kept phases 111–119 additive; `threads.py` stayed byte-untouched all milestone (G-5).
- **Reused UI primitives kept the new surfaces consistent and cheap** — ConfidenceChip, the push/split DocumentDetailPanel shell, NavRow, HealthPanel cards, the MoveToFolderDialog picker — so each DM surface inherited Deep Midnight + a11y instead of re-inventing it (G-2 sketches gated the 3 riskiest surfaces).

### What Was Inefficient
- **A built-but-unreachable surface shipped in 118.** Plan 04 added a `"classification-rules"` ActiveView but no plan owned the ChatLayout render branch + nav entry, so the entire rules UI was built but unmountable. Code review (1 blocker) + the verifier both caught it; fixed inline. Lesson: a phase that adds an ActiveView member MUST own its mount + nav in-phase.
- **Verification-status bookkeeping lagged reality.** Several phases (111.1/116/119) sat at `human_needed` and requirements (META/EMBED) at "Pending" long after the live UAT actually passed — surfaced as 7 of the 37 close-time "open" artifacts that were really just stale labels (corrected at close).
- **A Gemini-only schema trap survived the static gates and was caught only live.** A multi-type `type:[...]` array in the 115 tool schema 400'd google-genai and broke all Gemini Deep tool use; the no-anyOf/oneOf rule was necessary but not sufficient. Now a named decision.
- **A migration's GENERATED expression was rejected as non-immutable at apply time** (114's `(text)::date`), forcing an IMMUTABLE helper rewrite mid-execution — a reminder to verify generated-column immutability before authoring the migration.

### Patterns Established
- **Closed-registry filter compiler over a raw DSL** — compile a guided condition AST to a parameterized `metadata @> $1::jsonb`; never expose a freeform end-user query language (injection + UX hazard).
- **Share-don't-fork for any leak-safe read path** — one core, two callers (agent tool + REST), so the access-control invariant can't drift.
- **Suggest-then-confirm, never silent auto-action** — classification writes a suggestion + audit, never a silent move; reversible accept/dismiss preserves the audit/honesty positioning.
- **Gemini schema discipline extended** — avoid anyOf/oneOf AND multi-type `type` arrays in any agent-tool schema.

### Key Lessons
- A new top-level surface isn't done until something mounts it — adding an ActiveView/route member and owning its mount + nav must live in the same phase (the 118 reachability gap).
- Flip status labels when the work actually lands — `human_needed`/`Pending` left stale, read as "open" at close and cost triage; reconcile at phase close, not milestone close.
- Leak-safety is cheapest to guarantee structurally (one shared core + a live two-user proof) and most expensive to retrofit after a fork drifts.

### Cost Observations
- Model mix: Opus 4.x for orchestration / planning / execution; live cross-provider UAT Claude- and operator-driven (Chrome DevTools MCP + psycopg2 DB cross-checks against local Supabase :54322).
- Sessions: many across 7 days — 46 plans / 7 days ≈ 6.6 plans/day; 410 commits.
- Notable: sequential-on-main-tree execution (worktrees off — venv/node_modules) was the default; near-zero new deps; one inserted phase (111.1 embeddings) + one inline reachability gap-closure (118).

---

## Milestone: v3.2 — Skill Eval Studio + Self-Improving

**Shipped:** 2026-07-10
**Phases:** 16 (132–145; 144 deferred → v3.3) | **Plans:** 81

### What Was Built
The v3.1 Skill Trigger Tuner became a full Skill Eval Studio: persistent eval test cases + immutable skill versions, a with-skill-vs-without eval runner with a dual-arm LLM judge + honest per-provider verdicts + human ratings, a human-in-the-loop self-improvement loop, a publish gate, and the Evals·Triggering·Versions panel. Plus a built-in read-only skill-creator, STRETCH honesty phases (run-end honesty, smart-dispatch skill pre-filter, run-scoped template resolver, non-Python skill honesty), the FND-01 run-lifecycle foundation (`runs.status` authoritative + `threads.py` G-5 extraction, live SC#10 6/6), and a curated Starter Workflow Library (3 KB→document starters proven live end-to-end).

### What Worked
- **SC#10 cross-provider UAT as a first-class gate** kept catching real bugs before ship (133 routing bug, 145 run-lifecycle 6/6, the WF-01 live walkthrough).
- **The operator FOUNDATION pivot (2026-07-09)** — pausing feature work for the run-lifecycle honesty + `threads.py` G-5 extraction (145) paid down the highest-firing hot-file debt before more features piled onto it.
- **Code-review-then-fix caught real blockers** the executor's own tests missed (142's 2 T-142-01 blockers, 139's kind-blind CR-01, 143's seed-id collision found in the live apply).
- **Trusted-seed + live-UAT for WF-01** — the strict citation gate + judge gauntlet proved the starters produce grounded, cited docs (not fabrications) end-to-end.

### What Was Inefficient
- **STRETCH phases accumulated verification debt** — 140/141/142/143 all shipped code but carry pending/partial live UATs (embed 429, cross-provider smoke, held-partial, A1+empty-folder). Status labels lagged the real work.
- **Hand-picked seed uuids collided** (mig 094 risk-register `…00c1` = existing `eval_coverage`) → a silent `ON CONFLICT` partial apply caught only during live UAT.
- **SDK milestone/roadmap tracking quirks recurred** (stale progress-table rows; `milestone.complete` inflated counts by pulling in unarchived v3.1 phase dirs) → hand-fixed each time.

### Patterns Established
- **FOUNDATION-before-features** as an explicit operator lever between feature waves (G-5 paydown).
- **Deferred ideas → SEEDs with concrete re-open triggers + MUST-surface-at-new-milestone** (SEED-108/109/110/112).
- **Live Chrome-MCP walkthrough** as the WF-01 acceptance proof (fork → publish gauntlet → cited `.docx`), not just wire-format checks.

### Key Lessons
- Any `is_global` seed migration MUST query the live short-suffix uuid space before picking "fixed" ids — `ON CONFLICT (id)` hides collisions as silent partial applies.
- `full-schema.sql` is schema-only; seed DATA lives in the numbered migrations — a data-only migration is a no-op for the bootstrap artifact.
- The strict citation gate + a fast model = retries; a stronger default model runs smoother (SEED-082 tunable-gate lever).

### Cost Observations
- Model mix: predominantly Opus (execution + orchestration).
- 656 commits over ~12 days; one operator pivot (FOUNDATION pass) mid-milestone.

## Milestone: v3.3 — Operator UX

**Shipped:** 2026-07-18
**Phases:** 14 (146–159) | **Plans:** 95 | **Tasks:** 212

### What Was Built
Made the platform operable + configurable by a non-developer operator from the UI: a gated `/admin` Control Room (health, active-runs + Kill, fail-closed capability kill-switches, maintenance mode, audit browser, user roster, API-enforced feature visibility — 146–148), a dynamic model-capability registry + live propose-only discovery + add-model-by-ID/utility-filtered curation (149/159), app-layer Fernet secrets-at-rest (150), the `fetch_document_file` + `attach_skill_file` agent tools and Run-modal file-input/KB-scope/safe-delete (151/152), the Glean/Beam-informed trust & friendliness UX (per-claim inline citations 153, an app-wide plain-language layer 154, a WCAG-AA sweep 155, everyday nav/thread polish 156), and deployment presets + `OPERATOR.md` (157) with an idempotent first-run install wizard at `/setup` (158). 20/20 requirements.

### What Worked
- **Per-phase rigor substituted for a formal milestone audit — and held.** Every trust-boundary phase was verify-work'd + secure-phase'd (146–150, 153, 154, 158, 159 each carry a `threats_open: 0` SECURITY.md); live Chrome-MCP UAT drove the admin + model surfaces.
- **Code-review-then-fix caught real blockers the executor's own tests missed** — a CONFIRMED Critical SQLi in 150 (CR-01), the 149 wire bugs masked by helper-scoped tests (CR-01 twice), and 159's WR-01 (an `ON CONFLICT DO UPDATE` add-by-ID that could clobber an existing row's caps under `WORKER_COUNT=2` → fixed to a fail-safe plain INSERT + 409).
- **The "no RLS backstop → app-layer default-deny 404" red line, enforced per-route with a 404-regression test,** kept service-role isolation honest across every `/admin` surface.
- **Sketch-as-contract (G-2)** on the admin/citation/Run-modal surfaces gave a crisp, falsifiable acceptance bar before planning.

### What Was Inefficient
- **Bookkeeping drift recurred** — `phase.complete` left ROADMAP checkboxes + REQUIREMENTS rows + the Progress table stale (MODEL-03/DEPLOY-01/-02 hand-fixed at close; the `reference_phase_complete_roadmap_gap` lesson keeps re-firing).
- **The schema-drift gate false-positived on SQL-editor-applied migrations** (recommended the CLAUDE.md-forbidden `db push`) — bypassed with live-column evidence each time.
- **Cloud parity accumulated** — migrations 099–103 + `SECRETS_ENCRYPTION_KEY` are still owed on cloud; the local↔cloud non-code half lags every DB-touching phase and is deferred to the next production push.
- **STRETCH scope wasn't fully settled at milestone start** — 159 was added 2026-07-18 as a late, direct 149 follow-on (a good outcome, but it grew the STRETCH chain mid-milestone).

### Patterns Established
- **App-layer default-deny 404** (`require_operator`) as the isolation primitive wherever there is no RLS backstop, each route carrying a byte-identical-404 regression test.
- **Threat-model-in-PLAN → secure-phase verify-mitigations mode → SECURITY.md with file:line evidence,** one per phase (register authored at plan time).
- **Fail-soft-ahead-of-apply migrations** — the code that reads a new column ships safe (safe default when the column is absent) BEFORE the operator applies the migration (the mig-102/103 precedent).
- **Two-audience plain-language layer** (plain default + a one-click advanced reveal) extended app-wide from the Phase-124 two-door pattern, display-only with every enum/API/audit contract untouched.

### Key Lessons
- **Verify code-review findings against the real code before acting** — 150's SQLi was CONFIRMED and worth fixing, but the same milestone showed a finding acted on that wasn't actually present (152 gap-closure); confirm first.
- **Assert the SERVED artifact, not a helper-scoped test** — 149's CR-01 recurred because wire bugs were masked by tests scoped to the helper, not the endpoint response.
- **Test doubles that can't raise hide bug classes** — drive the real type (158's first-run gate).
- **Lived-experience UAT is mandatory on gate/middleware/config surfaces** — 158's first-run gate keyed off the wrong marker; 155's NavPanel keyboard-trap was a runtime Critical that static jsx-a11y + vitest-axe missed until a live Chrome-MCP scan.

### Cost Observations
- Model mix: predominantly Opus (execution + orchestration + the secure-phase auditor).
- ~8 days, 14 phases (95 plans / 212 tasks); one late STRETCH add (159); Chrome-MCP live UAT drove verification across the admin + model registry surfaces.

## Cross-Milestone Trends

| Milestone | Phases | Plans | Avg Plans/Phase | Timeline |
|-----------|--------|-------|-----------------|----------|
| v1.0 KB Explorer | 8 | 18 | 2.25 | 13 days |
| v2.0 Agent Skills | 9 | 22 | 2.44 | 6 days |
| v2.1 Stability | 8 | 8 | 1.0 | 3 days |
| v2.2 Trust & Compliance | 7 | 13 | 1.86 | 4 days |
| v2.3 Memory, Multimodal & Experience | 11 | 27 | 2.45 | 3 days |
| v2.4 Stability, Polish & UX Fixes | 12 (+2 deferred) | 42 | 3.5 | 8 days |
| v2.5 Deployment Strategy | 16 (1 deferred) | 64 | 4.0 | 10 days |
| v2.6 Foundation: RAG Quality + Multi-Worker + Polish | 35 | 91 | 2.6 | 16 days |
| v2.7 Agent Workspace & Panel | 6 | 28 | 4.67 | 3 days |
| v2.8 Harness Engine & Workflow Mode | 10 | 67 | 6.7 | 9 days |
| v2.9 Workflow Studio (CORE) | 9 | 57 | 6.3 | 8 days |
| v3.0 Document Management | 11 | 46 | 4.2 | 7 days |
| v3.1 Workflow & Skill Studio (CORE) | 9 | 40 | 4.4 | 7 days |
| v3.2 Skill Eval Studio + Self-Improving | 16 | 81 | 5.1 | 12 days |
| v3.3 Operator UX | 14 | 95 | 6.8 | 8 days |

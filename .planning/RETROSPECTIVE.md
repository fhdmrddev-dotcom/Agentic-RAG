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

## Cross-Milestone Trends

| Milestone | Phases | Plans | Avg Plans/Phase | Timeline |
|-----------|--------|-------|-----------------|----------|
| v1.0 KB Explorer | 8 | 18 | 2.25 | 13 days |
| v2.0 Agent Skills | 9 | 22 | 2.44 | 6 days |
| v2.1 Stability | 8 | 8 | 1.0 | 3 days |

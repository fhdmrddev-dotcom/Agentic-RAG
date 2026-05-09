# PRD Template — Agentic RAG Milestone

> **How to use this template.** This is the canonical scaffold every milestone PRD in `.planning/PRDs/` clones from. Fill all 16 sections in order. Sections 6–11 are the six verification gates — each carries a per-section checklist that MUST be satisfied before the section is considered complete (the cross-PRD consistency pass in `prd-reset/SUMMARY.md` will spot-check them). Real `file:line` citations are required wherever the PRD references current code, an integration point, or a constraint surfaced from prior milestones. When a section needs a "did we miss anything?" lateral-thinking pass, do it inside the section — don't punt to a follow-up doc. Plain-language instructions are baked in for accessibility; the precise technical specifics live inside the example content. A future agent should be able to fill this template correctly without reading PLAN.md. Keep examples in this file as illustrative anchors only — overwrite them with milestone-specific content when you clone.
>
> **How to clone.** `cp PRD-TEMPLATE.md ../PRDs/v{X.Y}.md` (relative to `.planning/prd-reset/`).
>
> **Binding upstream context.** `.planning/prd-reset/DECISIONS.md` codifies the 11 locked decisions (target user, posture, license, timing, competitors, Streams Provider, Docling-first, multi-worker readiness, Skill Studio scope, pricing, market shape). Treat that file as binding — DO NOT re-litigate any of those decisions inside a PRD; if you find yourself wanting to, escalate by adding a row to DECISIONS.md's "decisions explicitly NOT made yet" appendix and reference it from §13 (Decisions to lock pre-execution). Locked architectural decisions D-v2.5-01..D-v2.5-12 in `PROJECT.md` are also binding — see §6 for the compatibility check that enforces this.

---

## 1. Header

> **Filling instruction:** State the milestone version, the human-readable theme name, and a single thesis paragraph (~5 sentences) that names the headline outcome, the primary user-visible win, and the one-line strategic reason this milestone ships next. No bullet list — prose only.

**Annotated example:**

> # PRD: Agentic RAG — Milestone v2.6 (RAG Quality + Multi-Worker + Polish)
>
> **Defined:** 2026-05-10
> **Author:** PRD-reset Plan 03
>
> v2.6 is the production-readiness substrate for everything that comes after. It ships a Docling-first PDF/DOCX extraction path that closes the user-observed inconsistency where the same source file produced 5 tables / 4 images via PDF but 50+ tables / 0 images via DOCX (RECOVERED_RAG_Quality_Investigation_Report.md, Problem 3 carry-forward), lifts the multimodal `_MAX_VISION_CALLS = 20` ceiling at `backend/app/services/multimodal_service.py:29-33` so figures actually land in the index, and rewrites the backend for asyncpg + multi-worker discipline so D-v2.5-02's single-worker rule (PROJECT.md:227) can finally be retired. It also pre-emptively lifts the `useMessages` 1229-LOC single-buffer architecture into a `<StreamsProvider>` Context (SEED-007), bundles the four planted polish seeds (SEED-008/009/010/011), and picks up the still-relevant code-quality carry-forwards from the 2026-04-25 review. Strategically, v2.6 ships first because every downstream milestone (Skill Studio, Operator UX, Multi-Tenancy, Open Platform, Automations) assumes either that retrieval quality is a solved problem or that the backend can run more than one worker — without v2.6, those milestones inherit the same constraints v2.5 deliberately deferred. *(illustrative example — drawn from PLAN.md Plan 03 scope brief plus PROJECT.md decision rows.)*

---

## 2. Locked decisions inheritance

> **Filling instruction:** List which DECISIONS.md rows are load-bearing for this milestone, citing them by ID. Add one sentence per row explaining why it applies. If a decision DOES NOT apply to this milestone, omit it — only show what's actually in scope.

**Annotated example:**

| Decision ID | Title | Applies because |
|---|---|---|
| D-PRD-01 | Target: mid-large enterprise, user-count flexible | v2.6 multi-worker rewrite is sized for the 100s-of-concurrent-users tier this decision implies. |
| D-PRD-07 | RAG quality: Docling-first (MIT, free); PyMuPDF AGPL fallback behind `PdfExtractor` abstraction | v2.6 Cluster A scope is the milestone where this decision actually ships code. |
| D-PRD-08 | Multi-worker readiness: lift D-v2.5-02 in v2.6 (asyncpg + multi-worker discipline rewrite) | Whole milestone is the embodiment of this decision; sequencing inside v2.6 (asyncpg first → workers second, or atomic) is itself an open question routed to §13. |
| D-PRD-06 | Streams Provider (SEED-007): pre-emptive lift in v2.6 | Frontend refactor scoped here so Skill Studio (v3.0) inherits a clean concurrent-stream surface. |
| D-v2.5-01 | Wrap blocking I/O via `run_in_threadpool` / `aexec` | Inherited rule — every new code path in v2.6 must respect it. The asyncpg rewrite removes most of the wraps but the rule itself is preserved for any remaining sync calls. |
| D-v2.5-02 | Single uvicorn worker | Inherited but **scheduled to be lifted in this milestone**; explicit re-litigation row in §13. |
| D-v2.5-03 | Realtime is best-effort hint, not source of truth | Preserved unchanged. |

*(illustrative example — DECISIONS.md row IDs are placeholders pending Plan 01 codification; the format is verbatim from PROJECT.md "Key Decisions" table style.)*

---

## 3. Scope

> **Filling instruction:** Bulleted list of capabilities this milestone delivers, grouped by theme. Tag each bullet with the seed-IDs and recovered-doc-IDs it carries forward. Be concrete — name the user-visible outcome, not the implementation detail. If a bullet doesn't have a seed or recovered-doc to anchor it, that's a yellow flag — confirm in §10 (surprise-feature check) that you considered it deliberately.

**Annotated example:**

**Theme A — RAG Quality Lift**
- Docling-first PDF/DOCX extraction behind a `PdfExtractor` abstraction; PyMuPDF AGPL kept as a fallback path; PyMuPDF Pro deferred until first paying customer. *Carries: SEED-006, RECOVERED_RAG_Quality_Investigation_Report.md Problem 3, D-PRD-07.*
- Multimodal extraction lift — replace hardcoded `_MAX_VISION_CALLS = 20` and `_MAX_B64_BYTES = 512KB` at `backend/app/services/multimodal_service.py:29-33` with admin-tunable per-document budgets; raise default ceiling so the user-observed "stores ~5% of visible figures" gap closes. *Carries: SEED-006, project memory `project_seed006_multimodal_quality.md`.*
- Confidence threshold recalibration after Docling cuts in (re-run Phase 32.5 calibration with new chunk distributions). *Carries: project memory `project_phase32_5_chunking_fixes.md`.*

**Theme B — Multi-Worker Readiness**
- asyncpg adoption for the streaming endpoint specifically (CONCUR-03 from v2.5 deferred — `.planning/milestones/v2.5-REQUIREMENTS.md:51`).
- Lift D-v2.5-02 single-worker rule; ensure run-tracking, sandbox sessions, and Redis singletons survive `--workers N`. *Carries: SEED-001, RECOVERED_VPS_Deployment_Guide.md `--workers 2` correction.*

**Theme C — Streams Provider Pre-Emptive Lift**
- Hoist `useMessages.ts` (1229 LOC, single-buffer) into a `<StreamsProvider>` Context so a second concurrent stream surface (eval streams in v3.0, multi-pane in v3.1+) lands cleanly. *Carries: SEED-007.*

**Theme D — Polish & Quality Carry-forwards**
- claude-haiku-4-5 max_tokens cap fix at `backend/app/services/anthropic_service.py:150-200`. *Carries: SEED-009.*
- OpenRouter synthetic-timeout protocol verification (UAT only). *Carries: SEED-010.*
- `test_059_disconnect.py::test_normal_stream_unchanged` fixture-teardown bug. *Carries: SEED-011.*
- Thread-switch latency fix + sandbox stdout line-by-line streaming. *Carries: SEED-008.*
- Code-quality review carry-forwards: Supabase singleton `aclose()` lifecycle hook, context-window protected-only overrun guard, concurrent-upload duplicate-chunk race (verify first; promote if reproduces), title generation silent failure. *Carries: RECOVERED_Code_Quality_Review §1.A / §1.B / §2.C / §4.D.*

*(illustrative example — assembled from milestone-shaping synthesis §4 Cluster A + Cluster F + Cluster G entries plus PLAN.md Plan 03 theme.)*

---

## 4. Requirements (Validated / Active / Out of Scope)

> **Filling instruction:** Three subsections mirroring `PROJECT.md`'s template. **Validated** is empty at PRD time — phases populate it as they ship. **Active** is the work this milestone owns; one row per requirement, with a stable code (e.g., `RAG-DOCLING-01`, `WORKER-LIFT-01`) so phases can map back. **Out of Scope** carries a reason column explaining *why* — deferred to which later milestone, rejected entirely, or awaiting decision. Format: markdown table.

**Annotated example:**

### Validated
*(Empty at PRD time. Phases that ship will populate this section via `/gsd:transition`.)*

### Active

| Code | Requirement | Verified by |
|---|---|---|
| RAG-DOCLING-01 | A user-uploaded PDF and the same source's DOCX produce comparable table + image counts (within 20%); Docling primary path used by default; `PdfExtractor` abstraction allows fallback to PyMuPDF on a per-document failure. | Live UAT: re-ingest the user's reference thesis PDF + DOCX pair; assert table/image deltas within 20%. |
| RAG-MM-LIFT-01 | `multimodal_service._MAX_VISION_CALLS` and `_MAX_B64_BYTES` are admin-tunable via `app_settings`; default raised to a value that covers ≥80% of figures on a 4 MB academic PDF. | Live UAT: reingest reference thesis; count visible-vs-stored figures, assert ≥80%. |
| WORKER-LIFT-01 | `uvicorn --workers 2` (and `--workers 4`) runs cleanly: run-tracking survives across workers, sandbox sessions are sticky to the originating worker, Redis singleton initializes per worker without cross-talk. | Two-tab live test + 50-parallel-run synthetic load. |
| STREAMS-PROVIDER-01 | A `<StreamsProvider>` Context owns all run-stream subscriptions; `useMessages` reads from it; a second concurrent stream surface (mocked) renders without state collision. | Vitest unit + Chrome MCP two-pane mock. |

### Out of Scope

| Feature | Reason |
|---|---|
| PyMuPDF Pro commercial license | Deferred until first paying customer (D-PRD-07). |
| Full Skill Studio eval-driven dev loop | Owned by v3.0 (D-PRD-09). |
| Operator admin shell + install wizard | Owned by v3.1. |
| Multi-tenancy org/dept/role primitives | Owned by v3.2. |
| Public REST API / MCP server / service accounts | Owned by v3.3. |
| Sandbox per-execution timeout | Carry-forward to v3.0 polish slot — small phase, but pairs more naturally with Skill Studio's eval execution surface. |
| Realtime as authoritative source for chat-message arrival | Permanent (D-v2.5-03). |

*(illustrative example — table format is verbatim from `.planning/milestones/v2.5-REQUIREMENTS.md:60-68` and `PROJECT.md:152-168`.)*

---

## 5. Architecture & Data Model changes

> **Filling instruction:** Concrete inventory of what the codebase will look different after this milestone ships. List: new tables, modified tables, **modified hot paths** (call sites whose internals change but external contract stays — e.g., `_drain_stream_with_close_on_cancel` rewriting from sync to asyncpg, RLS predicates rewriting per-table for multi-tenancy, `run_sub_agent` extending for eval-mode), new SDK / library deps, new env vars, new Redis key patterns, new SSE event types, new API routes, new background processes. End with a schema-migration-count estimate.
>
> The "Modified hot paths" subsection is required for any milestone that rewrites internals without changing wire shape (multi-worker, multi-tenancy RLS shift, Skill Studio eval extension, API versioning). If your milestone is purely additive, write `Modified hot paths: none — additive only`.
>
> **MIGRATION NUMBERS — MANDATORY:** Read `MIGRATION-RESERVATIONS.md` BEFORE picking any migration number. Your milestone has a reserved range (e.g., v2.6 = `039-049`, v3.0 = `050-064`, etc.). Pick numbers ONLY from your reserved range. If you need more than your range, EXTEND the table in `MIGRATION-RESERVATIONS.md` and document the change in your PRD's §5. NEVER assume `039` is available — check the file. This prevents collision when parallel PRD-authoring agents in Plans 03-08 run concurrently.

**Annotated example:**

**New tables:**
- `pdf_extraction_runs` — per-document extraction telemetry (engine: docling | pymupdf | fallback, duration_ms, table_count, image_count, error). RLS keyed on `user_id` via FK to `documents`.

**Modified tables:**
- `documents` — add `extractor` text column (`'docling' | 'pymupdf' | 'pdfplumber-legacy'`), nullable backfilled from existing rows during re-ingest. Cited at SEED-006:60-65.
- `document_images` — add `bbox` jsonb for spatial coordinates so Docling-extracted regions can be cited precisely.

**New SDK / library deps:**
- `docling>=2.x` — pinned compatible with `httpx<0.28` OR shipped under subprocess isolation if upstream `httpx` conflict with `supabase==2.10` cannot be resolved (open question routed to §13).
- `pymupdf>=1.24` — AGPL-3.0; license posture documented in DECISIONS.md row D-PRD-07.
- `asyncpg>=0.29` — for the streaming endpoint specifically (CONCUR-03 from v2.5 deferred set).

**New env vars:**
- `EXTRACTOR_PRIMARY=docling|pymupdf` — operator override.
- `EXTRACTOR_DOCLING_ISOLATION=subprocess|in-process` — escape valve if httpx pin conflict surfaces in production.

**New Redis key patterns:** none — existing `run:{run_id}` / `runs_by_thread:{thread_id}` / `runs:active` (see CLAUDE.md "Run-buffer key conventions") cover.

**New SSE event types:** none.

**New API routes:** `GET /admin/extraction-stats` — for the multimodal lift telemetry surface; will be folded into the v3.1 admin shell once that milestone lands.

**New background processes:** none in v2.6 (the asyncpg rewrite is in-process).

**Schema migration count estimate:** 3 migrations — `039_pdf_extraction_runs.sql`, `040_documents_extractor_column.sql`, `041_document_images_bbox.sql`. Runs through `041` after this milestone.

*(illustrative example — extractor + bbox columns are quoted from SEED-006:60-65.)*

---

## 6. Compatibility check (Gate 1)

> **Filling instruction:** For every architectural change in §5, name (a) the current code path being touched (`file:line`), (b) the compatibility constraint it must satisfy (which D-v2.5-XX or D-PRD-XX rule applies), (c) what the integration point looks like, and (d) any conflict that needs resolution. Don't be exhaustive about untouched code — only the surfaces this milestone modifies.
>
> **Format:** Use a table with one row per change (mirror §5 inventory). When a single change crosses ≥4 `file:line` anchors (common for cross-cutting work like multi-tenancy RLS rewrite, run-pipeline plumbing, useMessages refactor), use a NESTED bulleted list inside the `Touches` cell rather than a comma-jammed string. Readability beats cell-width discipline.

**Annotated example:**

| Change | Touches | Constraint | Integration point | Conflict / mitigation |
|---|---|---|---|---|
| asyncpg rewrite of streaming endpoint | `backend/app/api/threads.py:158-255` (`_drain_stream_with_close_on_cancel`), `backend/app/api/threads.py:842` (asyncio.timeout wrap), `backend/app/dependencies.py` Supabase singleton | Must preserve D-v2.5-01 (no blocking I/O in async handlers — asyncpg removes the need for `aexec` wraps but doesn't violate the rule). | Run-backed streaming continues to read/write via the same Redis Streams contract; only the Postgres calls switch to asyncpg. | Conflict: D-v2.5-02 single-worker rule must be lifted in the same milestone — explicit re-litigation in §13. |
| Multi-worker enablement | `backend/app/main.py` lifespan, run-tracking registry, sandbox session manager | Must NOT regress the in-memory state guarantees that D-v2.5-02 currently protects. | Run-tracking moves from `dict` to Redis-backed registry (`runs:active` ZSET already exists); sandbox sessions become worker-sticky via consistent hashing on `thread_id`. | Conflict: RECOVERED_VPS_Deployment_Guide.md ships `--workers 2` (a regression at v2.5 ship); the runbook is corrected as part of this milestone. |
| Docling primary path | `backend/app/services/extraction_service.py` (new abstraction) wraps current pypdf + python-docx pipeline | Must integrate with existing chunking pipeline without changing chunk schema. | `PdfExtractor` ABC with `extract(file_bytes) -> ExtractedDocument` contract; output normalized to current `documents.full_markdown` + `document_chunks` shape. | Conflict: docling 2.x pins `httpx<0.28` while `supabase==2.10` requires `httpx>=0.27,<0.28` — narrow compatible window, validated in §13 spike. |
| Multimodal hardcoded ceiling lift | `backend/app/services/multimodal_service.py:29-33` | Must continue to honor D-v2.5-01 (vision-LLM call is async, already wrapped). | Replace module constants with `app_settings` lookup; default raised to 100 vision calls / 1MB b64. | None. |
| `<StreamsProvider>` Context lift | `frontend/src/hooks/useMessages.ts:572-590` (Branch D-3 `clearMessages` guard — must survive the lift) | Must preserve the per-thread message bucket invariant that closed STREAM-04-correctness-round3. | New Context owns the `messagesByThread` Map; `useMessages` becomes a thin reader of the Context. | Risk: regression of the Branch D-3 fix — explicit Vitest regression test required. |

**Verification checklist (must all be satisfied before this section is complete):**
- [ ] Every change row in §5 has a corresponding row in §6 with `file:line` cited.
- [ ] Every constraint cited (D-v2.5-XX / D-PRD-XX) is verified against the binding upstream context (DECISIONS.md + PROJECT.md `Key Decisions` table).
- [ ] Any conflict listed has an explicit mitigation, a "spike first" routing to §13, OR an escalation to lift the constraint (which itself becomes a §13 entry).
- [ ] No row leaves the "Conflict / mitigation" cell empty unless the row genuinely has no conflict — in which case write "None" explicitly.
- [ ] Frontend changes cite `frontend/src/...` paths; backend changes cite `backend/app/...` paths; migrations cite `supabase/migrations/...`.

---

## 7. Scalability check (Gate 2)

> **Filling instruction:** For every feature in §3, address the three load axes — 10x users, 100x docs, 50+ parallel runs. Per axis, name the bottleneck the feature would hit and the bound. If a feature trivially scales on an axis, say so — don't pad. The goal is to surface where this milestone's deliverables would crack first under load.

**Annotated example:**

| Feature | 10x users (current → 100s concurrent) | 100x docs (current → 100k+ documents) | 50+ parallel runs |
|---|---|---|---|
| Docling primary path | Bottleneck: docling CPU-bound extraction (~5-15s/doc on a typical PDF). At 100s concurrent uploads, ingestion queue saturates. Bound: linear in concurrent uploads — needs ingestion-queue work (deferred to v2.6+ if telemetry shows saturation; currently SEED-001 partial). | Bottleneck: 100k+ document re-extraction would take days under serial Docling; mitigated by `PdfExtractor` abstraction allowing batch jobs to use PyMuPDF for speed. | Trivially scales — extraction is upload-time, not run-time. |
| Multimodal lift (raised ceiling) | Bottleneck: vision-LLM calls scale linearly per doc — at default 100/doc and 100s of concurrent uploads, vision API rate limits become the wall. Bound: per-provider rate limit (OpenAI gpt-4o-mini: 500 RPM; need backpressure or retry-with-backoff). | Bottleneck: per-document b64 budget × 100k docs = significant Storage cost increase. Bound: `_MAX_B64_BYTES` × document count; admin-tunable now, telemetry visible in `/admin/extraction-stats`. | Trivially scales — no run-time impact. |
| asyncpg + multi-worker | Bottleneck shifts: the AnyIO 200-thread ceiling that constrained v2.5 is no longer the wall — pgbouncer connection pooling becomes the new wall. Bound: pgbouncer transaction-mode pool size (default 25-100). | Bottleneck: pgvector index size at 100k+ docs requires `lists` tuning on the `ivfflat` index (or HNSW migration). Verify before milestone closes. | This feature directly enables 50+ parallel runs without single-worker contention. Bound: Redis Streams `XLEN` per-key; with TTL ~10 min and 50 parallel runs, ~50 active keys — well within Redis capacity. |
| `<StreamsProvider>` Context lift | Trivially scales — frontend-only, per-tab. | N/A. | Bottleneck: a single tab subscribing to multiple streams shares the same WebSocket-style EventSource budget per browser (~6 per origin). Bound: ~6 concurrent streams per tab. Document this. |

**Verification checklist (must all be satisfied before this section is complete):**
- [ ] Every Active requirement in §4 is named at least once in §7's table.
- [ ] At least one feature has a non-trivial bottleneck on each of the three axes (otherwise re-check — milestones with NO scalability concerns usually mean the analysis is too shallow).
- [ ] Every "bound" is quantitative or names a specific config knob (not "scales fine").
- [ ] If a feature requires deferred work to actually scale (e.g., ingestion queue, asyncpg pgbouncer tuning), that deferral is captured in §11 (Lean check) with a concrete trigger.

---

## 8. Coverage check — "did I miss anything?" (Gate 3)

> **Filling instruction:** Walk through `.planning/research/milestone-shaping-2026-05-09.md` §4 (Theme Clusters A-G) explicitly. For each cluster, state: **included** (in scope this milestone) / **partially included** (some bullets, with which) / **deferred** (which milestone owns it) / **out-of-scope** (not on the roadmap). Justify each routing. The point of this section is to force the author to look at what could be in scope but isn't, not just what is.

**Annotated example:**

| Cluster | Routing | Justification |
|---|---|---|
| **A — RAG Quality & Multimodal Depth** | INCLUDED | Headline theme of this milestone (Docling + multimodal lift). Carries SEED-006 + RECOVERED_RAG_Quality_Investigation_Report Problem 3. |
| **B — Skill Studio + Agent Execution Modes** | DEFERRED to v3.0 | Owned by D-PRD-09 full Skill Studio milestone. SEED-007 lift is the only B-cluster bullet pulled forward into v2.6 (pre-emptive substrate work). |
| **C — Operator & Deployment Productization** | DEFERRED to v3.1 | RECOVERED_VPS_Deployment_Guide `--workers 2` correction lands here as a side-effect of WORKER-LIFT-01, but operator UI / install wizard / secrets store are owned by v3.1. |
| **D — Open Platform Surface** | DEFERRED to v3.3 | Public API depends on multi-worker (this milestone) + service accounts (v3.3). |
| **E — Multi-Tenancy & Org Model** | DEFERRED to v3.2 | XL one-way decision; explicitly NOT in v2.6. |
| **F — Streaming UX + Polish & Quality** | INCLUDED | All four planted seeds (SEED-008/009/010/011) bundled here. |
| **G — Code Quality & Test Coverage** | PARTIALLY INCLUDED | Supabase aclose() lifecycle (§1.A), context-window protected-only overrun (§1.B), concurrent upload race verify-then-promote (§2.C), title-generation silent failure (§4.D) included. Excluded: §3.A context-trimming O(n²) (defer until SEED-001 telemetry shows it bites), §6.B `_strip_nul` bytes branch (low-impact, not promoted). |

**New ideas surfaced during PRD authoring (lateral-thinking output):**
- *Per-document extractor override* — surfaced when scoping the `PdfExtractor` abstraction. Operator-tunable per-document fallback so a single problematic file can be re-extracted with PyMuPDF without flipping the global default. **Routing: INCLUDED in RAG-DOCLING-01 acceptance.**
- *Re-extraction migration* — surfaced when scoping the schema changes. After Docling lands, existing documents need a one-time re-extraction pass (similar to Phase 32.5's chunking re-run). **Routing: INCLUDED as a side-phase; scope-bounded to "opt-in re-extract via admin button," NOT "auto-re-extract on deploy."**

**Verification checklist (must all be satisfied before this section is complete):**
- [ ] All 7 clusters (A through G) named explicitly with a routing.
- [ ] Each "partially included" routing names which bullets are in vs which are out.
- [ ] Each "deferred" routing names the target milestone (v3.0, v3.1, etc.).
- [ ] At least 1 new idea surfaced during PRD authoring (proves the lateral-thinking pass actually happened — if zero, re-do it).
- [ ] No cluster left unrouted.

---

## 9. Document validity check (Gate 4)

> **Filling instruction:** For each input document this PRD touches (seeds + recovered MDs + relevant prior REQUIREMENTS.md), state: **still-valid-as-written** / **supersedes** (this PRD overrides it) / **archives** (this PRD closes it out — no future relevance) / **carries-forward-unchanged** (preserve as-is, no action). Then walk through `.planning/research/milestone-shaping-2026-05-09.md` §7 outdated-content rows and confirm each row is addressed in this PRD or routed to another PRD's Gate 4. Use a table.

**Annotated example:**

| Source | Status | Action |
|---|---|---|
| SEED-006 | SUPERSEDES | This PRD ships SEED-006's primary scope; close on milestone completion. |
| SEED-007 | SUPERSEDES | Pre-emptive lift consumes this seed; close on milestone completion. |
| SEED-008 | SUPERSEDES | All four planted gaps closed. |
| SEED-009 | SUPERSEDES | Anthropic max_tokens cap fix shipped. |
| SEED-010 | SUPERSEDES | OpenRouter timeout protocol verified via UAT. |
| SEED-011 | SUPERSEDES | test_059 fixture-teardown bug closed via canonical `_reset_redis_singleton` pattern. |
| SEED-001 | PARTIALLY-SUPERSEDES | Multi-worker readiness portion shipped; backpressure dashboard remains planted (owned by v3.1 SEED-012). |
| RECOVERED_RAG_Quality_Investigation_Report.md | SUPERSEDES (Problem 3 only) | Problems 1/2/4/5/6 already shipped Phase 32.5 (synthesis §7); Problem 3 closed by Docling primary path. Mark MD as "Fully Closed" after milestone. |
| RECOVERED_VPS_Deployment_Guide.md | SUPERSEDES | `--workers 2` corrected to `--workers N` (per multi-worker lift); Redis container deployment section added; manual postgrest-py patch step struck. |
| RECOVERED_Deploy_Hostinger_Supabase_Cloud.md | CARRIES-FORWARD-UNCHANGED | Updates owned by v3.1 (operator UX milestone). |
| RECOVERED_Code_Quality_Review.md | PARTIALLY-SUPERSEDES | §1.A / §1.B / §2.C / §4.D closed; §3.A / §6.B carry forward to v3.1+. |
| RECOVERED_Agent_Realtime_Feedback_Assessment.md | PARTIALLY-SUPERSEDES | Fix 2 (`tool_args_progress`) deferred to v3.0 polish slot. |
| `.planning/milestones/v2.5-REQUIREMENTS.md` | CARRIES-FORWARD-UNCHANGED (CONCUR-03 row) | This PRD's WORKER-LIFT-01 + asyncpg work consumes the deferred CONCUR-03 row at line 51. |

**Synthesis §7 outdated-content rows addressed by this PRD:**

| §7 row | Addressed by |
|---|---|
| RECOVERED_VPS_Deployment_Guide.md `--workers 2` correction | WORKER-LIFT-01 (this PRD) |
| RECOVERED_VPS_Deployment_Guide.md missing Redis section | This PRD's Theme C documentation phase |
| RECOVERED_RAG_Quality_Investigation_Report.md Problem 3 | RAG-DOCLING-01 |
| (other §7 rows owned by v3.0/v3.1/v3.2/v3.3 PRDs) | Listed in those PRDs' Gate 4 sections |

**Verification checklist (must all be satisfied before this section is complete):**
- [ ] Every seed and recovered-doc this milestone's Scope (§3) tags is given a row with status.
- [ ] Every §7 outdated-content row that names a doc this milestone touches is explicitly addressed.
- [ ] §7 rows owned by other PRDs are listed by name (so the cross-PRD consistency pass can verify coverage globally).
- [ ] No "carries-forward-unchanged" status without a one-line justification.

---

## 10. Surprise-feature check (Gate 5)

> **Filling instruction:** List ideas considered AND rejected for this milestone. Minimum 3 entries. Each must list: **idea / why tempting / why not now / re-trigger condition**. The point is to force lateral thinking — if the list is trivial, the reviewer will kick it back. Pick ideas that someone might reasonably argue for at planning time, not strawmen.

**Annotated example:**

**Rejected ideas:**

1. **Idea:** Switch to `pgvector` HNSW index from `ivfflat` as part of the Docling re-extraction pass.
   **Why tempting:** Docling re-extraction will re-embed every chunk anyway, and HNSW is the modern default for >10k vectors. One-time cost.
   **Why not now:** v2.6's risk surface is already large (Docling + multi-worker + asyncpg). Adding an index migration on top compounds rollback risk. Pgvector ivfflat is "good enough" up to ~100k vectors.
   **Re-trigger:** Vector search latency p95 > 500ms on a real workload (telemetry observation, not theoretical) — promote to its own polish phase in v3.0 or v3.1.

2. **Idea:** Add per-execution sandbox timeout in v2.6 (close residual KI-001 — CONCERNS.md:186-195).
   **Why tempting:** Closes the last fragment of KI-001. Small change. Pairs well with the polish theme.
   **Why not now:** It pairs more naturally with Skill Studio (v3.0) where eval execution is the canonical use case for "long-running sandbox call must be killable." Also, v2.6 already carries 4 polish seeds and bundling more dilutes the multi-worker focus.
   **Re-trigger:** v3.0 Phase 0 / pre-Skill-Studio polish slot.

3. **Idea:** Migrate `useMessages.ts` to Zustand instead of just lifting to Context (`<StreamsProvider>`).
   **Why tempting:** Zustand is more ergonomic than Context for cross-component state; would close the 1229-LOC fragility decisively.
   **Why not now:** New dependency adoption is a one-way step; Context lift is reversible. SEED-007 explicitly scopes the lift, not a state-management library swap. The "right" answer is to lift to Context first, observe pain, then re-evaluate.
   **Re-trigger:** Skill Studio (v3.0) eval-pane work shows Context Provider re-renders are causing perf issues — dedicated state-management RFC.

4. **Idea:** Ship `agent_tasks` table (RECOVERED_Harnessing_Agents Opportunity A — Background Research Agent precursor) in v2.6.
   **Why tempting:** Synergizes with multi-worker (durable task queue benefits from multi-worker). Sets up v3.0 / v3.4 automations.
   **Why not now:** It's actually a SEED-014 / v3.4 concern; doing it in v2.6 reaches across two milestone boundaries and creates ownership confusion. Also requires a scheduler-process decision (D-PRD candidate) that v3.4 owns.
   **Re-trigger:** v3.4 (Automations) Phase 1.

*(illustrative example.)*

**Verification checklist (must all be satisfied before this section is complete):**
- [ ] At least 3 rejected ideas listed.
- [ ] Each idea has all four fields (idea / tempting / not now / re-trigger) filled.
- [ ] At least one rejected idea is non-trivial (someone could reasonably argue for it — not a strawman like "rewrite everything in Rust").
- [ ] Re-trigger is concrete (names a milestone, a metric threshold, or a specific event — not "later").

---

## 11. Lean check (Gate 6)

> **Filling instruction:** Explicit "what we're NOT doing in this milestone" list. Every item in §4 Out of Scope feeds in here, plus everything you considered during Scope (§3) and chose to leave out. Per item, state: **deferred to which later milestone** / **rejected entirely** / **awaiting decision**. The cross-PRD consistency pass uses this to verify scope is bounded — if every PRD's Lean section is non-empty AND every "deferred" hits a real later milestone, the milestones are coherent.

**Annotated example:**

| Item not shipped in this milestone | Routing | Rationale |
|---|---|---|
| PyMuPDF Pro commercial license adoption | DEFERRED — first paying customer | D-PRD-07 explicit. License only matters when redistribution begins. |
| Skill Studio (full eval-driven dev loop) | DEFERRED to v3.0 | Owned by D-PRD-09. v2.6's SEED-007 lift is the only Skill-Studio prep work pulled forward. |
| Operator admin shell + install wizard | DEFERRED to v3.1 | Owned by Cluster C. |
| Multi-tenancy org/dept/role primitives | DEFERRED to v3.2 | XL one-way decision. |
| Public REST API + MCP server + service accounts + rate limiting | DEFERRED to v3.3 | Depends on this milestone's multi-worker lift but doesn't ship in it. |
| Automations & Routines (scheduler + event bus) | DEFERRED to v3.4 | Sized as its own milestone. |
| Sandbox per-execution timeout | DEFERRED to v3.0 polish slot | Naturally pairs with Skill Studio eval execution. |
| Context-trimming O(n²) refactor (RECOVERED_Code_Quality_Review §3.A) | DEFERRED to v3.1+ telemetry-driven | No real-world repro yet. |
| `_strip_nul` bytes branch fix (§6.B) | REJECTED — not promoted | Low-impact, no observed bug. Closing this would set a precedent of fixing every code-review finding regardless of impact. |
| `tool_args_progress` SSE event for non-execute_code tools | DEFERRED to v3.0 polish slot | Pairs with Skill Studio's progressive feedback theme. |
| `agent_tasks` table / Background Research Agent | DEFERRED to v3.4 | Owned by Automations. |
| Pgvector HNSW migration | AWAITING DECISION | Re-trigger: vector search p95 > 500ms on real workload. |
| Per-doc extractor override UI surface | DEFERRED to v3.1 admin shell | Backend acceptance criterion (RAG-DOCLING-01) ships the API; UI hooks come with v3.1. |
| Real-time collaboration (multi-user editing same thread) | REJECTED — not on roadmap | No demand signal; complexity outweighs value. |
| Mobile native apps (iOS/Android) | AWAITING DECISION | Web-mobile responsive is the current commitment; native depends on customer demand. |
| Browser extension (highlight web → ingest) | AWAITING DECISION | Re-trigger: integration partner asks for it. |

**Verification checklist (must all be satisfied before this section is complete):**
- [ ] Every Out-of-Scope row in §4 has a corresponding Lean row.
- [ ] Every "deferred" row names a target milestone version OR a concrete trigger condition.
- [ ] Every "rejected entirely" row has a one-line rationale.
- [ ] Every "awaiting decision" row routes to §13 (Decisions to lock pre-execution) OR names a re-trigger.
- [ ] At least one item from each of (a) headline-feature deferral (b) polish deferral (c) future-milestone deferral, so the list isn't all one shape.

---

## 12. Phase outline

> **Filling instruction:** DAG-able phase list — each phase has a name, a one-line goal, an upstream-phase dependency (or "none"), and an approximate plan count. Order phases so dependencies flow forward. This is the input that `/gsd:new-milestone <version>` consumes to generate `ROADMAP.md`. Don't over-detail — this is a sketch, not a plan.

**Annotated example:**

| Phase | Goal | Depends on | Approx plans |
|---|---|---|---|
| 068 — Streams Provider Lift | Hoist `useMessages.ts` to a `<StreamsProvider>` Context; preserve Branch D-3 fix. | none | 3 |
| 069 — `PdfExtractor` Abstraction | Carve current pypdf + python-docx pipeline behind an abstraction; no behavior change. | none | 2 |
| 070 — Docling Spike | Validate docling 2.x + supabase 2.10 httpx coexistence (in-process or subprocess). | 069 | 2 |
| 071 — Docling Primary Path | Make docling the default extractor; PyMuPDF fallback wired. | 070 | 4 |
| 072 — Multimodal Lift | Replace `_MAX_VISION_CALLS` / `_MAX_B64_BYTES` with `app_settings`; raise defaults. | 069 | 3 |
| 073 — Confidence Recalibration | Re-run Phase 32.5 calibration with Docling chunk distributions. | 071 | 2 |
| 074 — asyncpg Streaming | Replace supabase-py sync calls in streaming endpoint with asyncpg. | none (parallel with 068-073) | 4 |
| 075 — Multi-Worker Discipline | Enable `--workers N` cleanly; sandbox session stickiness; Redis singleton per worker. | 074 | 5 |
| 076 — VPS Runbook Correction | Update RECOVERED_VPS_Deployment_Guide to `--workers N` + Redis container section. | 075 | 1 |
| 077 — Polish bundle (SEED-008/009/010/011) | Bundled small fixes. | none | 4 |
| 078 — Code-quality carry-forwards | Supabase aclose() / context-window guard / dedup race verify-then-promote / title-gen silent fail. | none | 3 |

**Total: ~33 plans across 11 phases. Headline path: 069→070→071→073 (Docling) + 074→075 (multi-worker) + 068 (Streams Provider, parallel).**

*(illustrative example — phase numbers continue from v2.5's last shipped Phase 067.x.)*

---

## 13. Decisions to lock pre-execution

> **Filling instruction:** Any one-way decisions surfaced during PRD authoring that must be added to DECISIONS.md before milestone execution starts. Per decision: **question / options / recommendation / who decides / by when**. If the milestone has no new locked decisions, write "None — all relevant decisions are pre-locked in DECISIONS.md." If you write that and there are 5+ obvious unknowns, the reviewer will kick this back.
>
> **Q-ID naming convention:** Use `Q-v{X.Y}-NN` for questions inside this milestone (e.g., `Q-v2.6-01`). When a question gets accepted as a binding decision, route the upgrade based on scope:
> - Decision affects ONLY this milestone's internals → upgrade to `D-v{X.Y}-NN` (per-milestone ADR; same prefix style as `D-v2.5-01..10`)
> - Decision affects DOWNSTREAM milestones (e.g., supersedes a prior architectural rule, sets a posture other PRDs must inherit) → upgrade to the next free `D-PRD-NN` ID and append to `DECISIONS.md`
>
> Example: lifting `D-v2.5-02` (single-worker rule) in v2.6 affects every downstream milestone → upgrade to `D-PRD-12`. A v2.6-internal asyncpg pool tuning decision stays as `D-v2.6-NN`.

**Annotated example:**

| Question | Options | Recommendation | Who decides | By when |
|---|---|---|---|---|
| **Q1: docling 2.x ↔ supabase 2.10 httpx pin conflict** | (a) upgrade supabase to a version with relaxed httpx pin; (b) pin docling to a version compatible with httpx<0.28; (c) run docling as subprocess for full isolation | (b) if a compatible docling exists; otherwise (c). Validated by Phase 070 Docling Spike. | User | Before Phase 071 |
| **Q2: Multi-worker rollout strategy** | (a) asyncpg first → workers second (two milestones in one); (b) atomic — both ship together in a single feature branch | (b) — same model as D-v2.5-11 (run-backed streaming was atomic). Single feature branch, no flags. | User | Before Phase 074 starts |
| **Q3: Confidence threshold recalibration scope** | (a) re-run full Phase 32.5 calibration over historical corpus; (b) recalibrate only on Docling-extracted documents going forward; (c) skip and accept drift | (a) for correctness; (b) for cost | User | Before Phase 073 |
| **Q4: Re-extraction migration policy** | (a) auto-re-extract on deploy; (b) opt-in via admin UI button; (c) defer to v3.1 | (b) — bounds blast radius and pairs with v3.1 admin shell when UI surface lands | User | Before Phase 071 ship |
| **Q5: PyMuPDF AGPL acknowledgment** | (a) ship as a pure fallback (only triggered on Docling failure — minimal exposure); (b) commercial license eval; (c) avoid PyMuPDF entirely | (a) for v2.6 — first paying customer triggers (b) per D-PRD-07 | User | Before Phase 069 ship |

*(illustrative example — these are real-shaped questions per PLAN.md Plan 03 "Key open questions to resolve in PRD".)*

---

## 14. Competitive positioning paragraph

> **Filling instruction:** A single paragraph (~150 words) naming ≥2 specific competitors AND ≥2 differentiators that this milestone delivers (or amplifies). Keep it concrete — don't write generic marketing copy. Map each differentiator to a §3 scope bullet so the claim is grounded.

**Annotated example:**

> v2.6 positions Agentic RAG against **Glean** (the primary enterprise-search competitor per D-PRD-05) and **NotebookLM + ChatGPT custom GPTs** (the primary single-user competitors). Two differentiators ship in this milestone. First: **multimodal RAG that actually surfaces what's in the document.** Glean treats PDFs as text-only; NotebookLM is strong on multimodal but proprietary. By replacing pypdf with Docling primary + lifting the multimodal ceiling (`backend/app/services/multimodal_service.py:29-33`), v2.6 closes the 5/4 vs 50/0 PDF/DOCX inconsistency the user observed and stores ≥80% of visible figures by default — table cells and image regions become first-class participants in vector search. Second: **production-tier scale-out via single-codebase multi-worker.** OpenAI Assistants is single-tenant SaaS; Glean is hosted-only. Lifting D-v2.5-02's single-worker rule means a self-hosted deployment can scale linearly with `--workers N` without bespoke infrastructure — a story neither competitor offers because their architecture is closed. v2.6's groundwork unlocks the v3.3 Open Platform claim (self-hostable agentic-RAG-as-a-platform) by removing the ceiling that kept the v2.5 backend unusable above ~10 concurrent users.

*(illustrative example — competitors and differentiators sourced from `.planning/research/milestone-shaping-2026-05-09.md` §6.)*

---

## 15. Carry-forward seeds

> **Filling instruction:** Two subsections. **Consumed (closes on milestone completion):** seed-IDs this PRD ships against in full. **Left planted (preserved with re-trigger):** seed-IDs this PRD knowingly does NOT ship and the trigger that should reopen them. Use exact SEED-IDs.

**Annotated example:**

**Consumed (close on milestone completion):**
- `SEED-006` — Multimodal Extraction Quality. Closed by RAG-DOCLING-01 + RAG-MM-LIFT-01.
- `SEED-007` — App-level Streams Provider. Closed by STREAMS-PROVIDER-01.
- `SEED-008` — Streaming UX Polish. Closed by Phase 077 polish bundle.
- `SEED-009` — claude-haiku max_tokens cap. Closed by Phase 077.
- `SEED-010` — OpenRouter synthetic-timeout protocol UAT. Closed by Phase 077.
- `SEED-011` — test_059 fixture-teardown. Closed by Phase 077.

**Left planted:**
- `SEED-001` — Scale Readiness. Multi-worker portion shipped, but backpressure dashboard + per-user concurrent SSE cap remain planted. Re-trigger: production telemetry shows >10 concurrent active runs sustained, or v3.1 (Operator UX) wants the dashboard surface.
- `SEED-002` — Skill Studio Milestone Preparation. Re-trigger: v3.0 PRD execution begins.
- `SEED-003` — Deployment Flexibility & Install/Config UX. Re-trigger: v3.1 PRD execution begins.
- `SEED-004` — Org / Department / Role Multi-Tenancy. Re-trigger: v3.2 PRD execution begins.
- `SEED-005` — Document Management Capabilities. Re-trigger: Tier A in v3.0 or v3.1; Tier B awaits SEED-004.
- `SEED-012` — Admin / Operator UI Completeness. Re-trigger: v3.1 PRD execution begins.
- `SEED-013` — External Integrations. Re-trigger: v3.3 PRD execution begins.
- `SEED-014` — Automations & Routines. Re-trigger: v3.4 PRD execution begins.

*(illustrative example — seed routing reflects PLAN.md PRD assignment table.)*

---

## 16. Sources

> **Filling instruction:** Comprehensive citation list. Every doc referenced anywhere in this PRD, every code `file:line` cited in §6, every prior milestone artifact referenced in §9. Group by type (planning docs / code paths / migrations / external references). The cross-PRD consistency pass uses this as the audit trail.

**Annotated example:**

**Planning documents:**
- `.planning/PROJECT.md` — current Validated requirements + Key Decisions table; specifically rows D-v2.5-01 (line 226), D-v2.5-02 (line 227), D-v2.5-03 (line 228).
- `.planning/MILESTONES.md` — v2.5 ship summary, run-backed streaming context.
- `.planning/milestones/v2.5-REQUIREMENTS.md` — CONCUR-03 deferred row at line 51.
- `.planning/research/milestone-shaping-2026-05-09.md` — §4 Theme Clusters (referenced in §8), §6 Competitive (referenced in §14), §7 Outdated Content (referenced in §9).
- `.planning/prd-reset/DECISIONS.md` — D-PRD-01..D-PRD-11 locked decisions (referenced in §2).
- `.planning/seeds/SEED-001-scale-readiness.md` through `SEED-014-automations-routines.md` (referenced in §3, §15).
- `.planning/research/recovered/RECOVERED_RAG_Quality_Investigation_Report.md` — Problem 3 (pypdf limits).
- `.planning/research/recovered/RECOVERED_VPS_Deployment_Guide.md` — `--workers 2` correction target.
- `.planning/research/recovered/RECOVERED_Code_Quality_Review.md` — §1.A / §1.B / §2.C / §4.D carry-forwards.
- `.planning/research/recovered/RECOVERED_Agent_Realtime_Feedback_Assessment.md` — Fix 2 deferral context.
- `.planning/codebase/ARCHITECTURE.md` — current architecture map.
- Project memory `project_phase32_5_chunking_fixes.md` — confidence calibration baseline.
- Project memory `project_seed006_multimodal_quality.md` — multimodal extraction baseline.

**Code paths cited (all backend unless prefixed `frontend/`):**
- `backend/app/api/threads.py:158-255` — `_drain_stream_with_close_on_cancel`.
- `backend/app/api/threads.py:842` — asyncio.timeout wrap.
- `backend/app/services/multimodal_service.py:29-33` — `_MAX_VISION_CALLS = 20`, `_MAX_B64_BYTES = 512KB`.
- `backend/app/services/anthropic_service.py:150-200` — claude-haiku max_tokens cap (SEED-009 likely fix shape).
- `backend/app/services/suggestion_service.py` — referenced for context-window protected-only overrun audit.
- `backend/app/api/skills.py` — preserved untouched in v2.6.
- `backend/app/api/run_helpers.py` — preserved untouched in v2.6.
- `backend/app/api/sandbox_outputs.py:48-67` — path-segment fence (preserved).
- `backend/app/main.py` — `/health` endpoint, lifespan; modified for multi-worker discipline.
- `backend/app/dependencies.py` — Supabase singleton aclose() carry-forward.
- `frontend/src/hooks/useMessages.ts:572-590` — Branch D-3 `clearMessages` guard (must survive Streams Provider lift).

**Migrations:**
- Current head: `supabase/migrations/038_runs_timed_out_status.sql`.
- This milestone: `039_pdf_extraction_runs.sql`, `040_documents_extractor_column.sql`, `041_document_images_bbox.sql`.

**External references:**
- Docling 2.x docs (httpx pin compatibility — validated in Phase 070 spike).
- PyMuPDF AGPL-3.0 license text (SEED-006 §pitfalls).
- pgbouncer transaction-mode pool sizing (multi-worker tuning reference).

*(illustrative example — paths and line references are real per the seed PLAN.md anchors.)*

---

*Template last updated: 2026-05-10. Authored by PRD-reset Plan 02. Scaffolds Plans 03-08.*

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
- ✅ **v2.8 Harness Engine & Workflow Mode** — Phases 089-096 (shipped 2026-06-07)
- ✅ **v2.9 Workflow Studio** — Phases 097-104 CORE (shipped 2026-06-15); STRETCH 105-109 deferred
- 🔨 **v3.0 Document Management** — ACTIVE (started 2026-06-15). SEED-005 Tier A as a product surface: **DM Foundations → metadata enrichment → metadata-driven views / "virtual folders" → document relationships → auto-classification → governance health.** 10 phases (**110-119**); the v2.9 STRETCH labels 105-109 are backlog candidates, not committed phases, so the range starts at 110 to avoid collision.
- 📋 **v3.1 Workflow + Skill Eval Studio** — re-scoped "Skill Studio" (eval/regression over the Phase 102 judge + golden-run, for workflows + composed skills). Next after v3.0 *unless a paying customer flips priority to the GTM track*. Brief: `PRDs/v3.1-skill-studio-eval.md`
- 📋 **v3.2 Operator UX** → **v3.3 Multi-tenancy** → **v3.4 Open Platform (API/MCP)** → **v3.5 Automations** — the enterprise-GTM track. **Authoritative version map: `PRDs/SEQUENCE.md`.** (All re-sequenced 2026-06-15; briefs predate the v2.7–2.9 pivot and re-author at milestone start.)

---

## v3.0 Document Management — 🔨 ACTIVE

**Goal:** Turn the product's incidental document-management capabilities into a first-class, metadata-driven surface (M-Files-aligned Tier A) — documents structured, related, and trustworthy enough to power both direct use and every cited workflow deliverable.

**Build order (dependency-driven — all four research sources converge here):** DM Foundations → Metadata Enrichment → Virtual Folders → Relationships → Auto-Classification → Governance Health. Enrichment is a **hard prerequisite** for classification. Each Tier A item is a full vertical (table + RLS + query path + agent tool + UI + audit-enum migration + cross-provider UAT) — realistically 2-3 phases each (research Pitfall 1).

**Phase numbering:** 110-119 (10 phases). Continues past v2.9 CORE (ended at 104); avoids the deferred-STRETCH labels 105-109.

**Coverage:** 24/24 functional requirements mapped (DMF 3, META 5, VIEW 7, REL 4, CLASS 3, DGOV 2). UX-01/UX-02 are cross-cutting acceptance attached to every UI-bearing phase.

### Phases

- [x] **Phase 110: DM Foundations** — Shared substrate: 4 new tables (RLS + nullable `org_id`) + audit-enum extension + frozenset sync + boot/CI subset assertion + the DM capability feature-flag (feature-independence seam). ✅ COMPLETE 2026-06-15 (2/2 plans; live-verified on :54322; gsd-verifier 7/7 PASSED; code review 0C/0W/3I — secure-phase pending)
- [ ] **Phase 111: Metadata Enrichment — Extraction Backend** — Un-pin the extraction model, lift the 3k window, dynamic custom-field schema, per-field confidence storage.
- [ ] **Phase 111.1: Configurable / Multi-Provider Embeddings (incl. local Ollama + LM Studio)** — Embedding-provider picker + local presets + re-embed-on-change lifecycle; retires the OpenAI embedding SPOF (SEED-048). **(INSERTED · G-2 sketch)**
- [ ] **Phase 112: Metadata Enrichment — Document Detail Panel + Manual Edit** — Net-new document detail panel surfacing metadata + per-field confidence + audited inline edit. **(G-2 sketch)**
- [ ] **Phase 113: Virtual Folders — Filter Compiler + Equality Views (Backend)** — `document_views` table, the net-new filter-AST → parameterized-SQL compiler, equality/AND/folder-scope, leak-safe global sharing.
- [ ] **Phase 114: Virtual Folders — Range/Date Filters + View Builder + Sidebar** — Typed/indexed date columns + relative-date operators; the view/filter builder UI; sidebar render-as-folder. **(G-2 sketch)**
- [ ] **Phase 115: Virtual Folders — Agent Tool** — The agent can run a saved view / metadata query as a tool to answer questions in chat.
- [ ] **Phase 116: Document Relationships — Backend + Agent Tool** — Typed-link table, create/remove, `get_related_documents` tool (registry + advertised schema).
- [ ] **Phase 117: Document Relationships — Panel UI** — Relationship panel on the document detail surface (outgoing/incoming typed links, no-access masking). **(G-2 sketch)**
- [ ] **Phase 118: Auto-Classification** — Classification rules → suggestion on upload (never silent auto-move) → accept/dismiss.
- [ ] **Phase 119: Document Governance Health** — Light read-only governance view (broken relationships, unclassified docs, low-confidence metadata) with action links.

### Phase Details

#### Phase 110: DM Foundations
**Goal**: Land the shared DM substrate once — the four new tables, RLS discipline, multi-tenancy forward-compat, and the audit-enum extension — so no later phase silently drops an audit row or fights a future org rewrite.
**Depends on**: Nothing (first DM phase)
**Requirements**: DMF-01, DMF-02, DMF-03
**Success Criteria** (what must be TRUE):
  1. The four new tables (`document_views`, `document_relationships`, `classification_rules`, `metadata_field_definitions`) exist with RLS enabled, each carrying a nullable `org_id uuid` (no FK) and a re-keyable `auth.uid() = user_id OR is_global` policy shape mirroring the `workflow_definitions` precedent.
  2. The `audit_log` `action_type` CHECK enum is extended (min `view.create`, `relationship.create`, `classification.apply`, `metadata.update`) AND `VALID_ACTION_TYPES` (`audit_service.py:13`) is synced in the same phase; `full-schema.sql` regenerated (no reset).
  3. A boot/CI assertion fails loudly if `VALID_ACTION_TYPES` is NOT a subset of the live DB CHECK enum (drift guard turns a silent 23514 reject into a boot failure).
  4. A real audit row for each new action type INSERTs and SELECTs back **against the live DB** (verified live, not mocked — the D-102 "static would false-green" lesson).
  5. A single DM capability flag (`app_settings`, default **on**) gates the new DM surfaces + tools so the whole capability can be cleanly toggled off; defaults on so v3.0 behavior is unchanged when unset. This is the feature-independence seam a future tier/entitlement system (SEED-080, v3.2) plugs into — no enforcement built here.
**Plans**: 2 plans
  - [x] 110-01-PLAN.md — Author migration 071 (4 RLS tables + audit enum 11->19 + DM capability flag) + frozenset/boot-guard sync + flag read chain + 6 Wave-0 tests ✅ EXECUTED 2026-06-15 (4 commits; migration un-applied — Plan 02 applies + verifies live; DMF-01/02/03 stay Pending until phase verification)
  - [x] 110-02-PLAN.md — Apply migration 071 to :54322 (operator-authorized CLI, no wipe) + regen full-schema.sql + fix document_relationships RLS (user-scoped, no is_global) + 27 live verification tests GREEN (SC#1-5) ✅ EXECUTED 2026-06-15 (commit `25844c67`; full-suite net-new=0)

#### Phase 111: Metadata Enrichment — Extraction Backend
**Goal**: Replace the thin fixed-schema/hardwired-`gpt-4o`/3k-char extraction with a configurable, model-flexible, confidence-scored enrichment pipeline — the spine the M-Files "metadata not folders" story rests on and the hard prerequisite for classification.
**Depends on**: Phase 110
**Requirements**: META-01, META-03, META-04
**Success Criteria** (what must be TRUE):
  1. Metadata extraction routes through the user-selected (or an admin-configured `extraction_model` setting in `user_settings`/`app_settings`) model — not the hardwired `gpt-4o`; the effective model threads `_upload_pipeline → ingest_document → extract_metadata(model=...)`.
  2. Extraction reads beyond `content[:3000]` (a configurable larger window or front-matter + tail sampling) so late title-page/byline data isn't missed.
  3. User-defined custom metadata fields (from `metadata_field_definitions`) are extracted on ingest via a runtime Pydantic `create_model` schema; per-field confidence is stored flat under a `_confidence` sub-key so the existing `metadata @> filter` containment pre-filter still matches; `exclude_none=True` (empty `author` dropped, not coerced to `""`) is preserved as a guarded non-regression invariant.
  4. **SC#10 4-axis UAT**: dynamic-schema structured extraction is verified across the native-7 (cross-provider) — extraction succeeds and returns valid confidence-scored fields on each provider; long-doc (≥ 5 KB) window-lift sampling exercised; rows authored in VALIDATION.md.
**Plans**: 5 plans
  - [x] 111-01-PLAN.md — Wave-0 test scaffolds + migration 072 file (un-applied) + first-class `lmstudio` provider + 3 app_settings-backed settings fields (META-03 foundation) — EXECUTED 2026-06-15 (3 tasks / 3 commits; net-new failures 0)
  - [x] 111-02-PLAN.md — The enrichment engine: `build_metadata_model` + `sample_for_extraction` + explicit-scoped `read_enabled_field_defs` + async `extract_metadata_enriched` (forced_emit caller) (META-01/03/04) — EXECUTED 2026-06-15 (2 tasks / 2 commits; 7 GREEN flipped; net-new failures 0)
  - [x] 111-03-PLAN.md — `/metadata-fields` CRUD router + Pydantic models (field_type Literal + field_key validators) + `metadata.field.create` audit, mounted in main.py (META-01) — EXECUTED 2026-06-15 (2 tasks / 2 commits; 34/34 GREEN live; net-new failures 0)
  - [x] 111-04-PLAN.md — `ingest_document` wiring: hoist load_app_settings + enriched/legacy branch + `asyncio.run` call site + `_confidence` attach + graceful degradation (META-01/03/04) — EXECUTED 2026-06-15 (1 TDD task / 1 commit; proved D-111-9 flat-filter compat; net-new failures 0)
  - [x] 111-05-PLAN.md — [BLOCKING] Apply migration 072 to :54322 (psycopg2-direct/SQL-editor, NEVER db push) + read-back + regenerate full-schema.sql + live test_111 integration suite (META-01/03) — EXECUTED 2026-06-15 (operator-authorized psycopg2-direct apply; 4 cols live, 19 docs preserved; live suite 7 passed / 2 xpassed)
**UI hint**: no

#### Phase 111.1: Configurable / Multi-Provider Embeddings — incl. local Ollama + LM Studio (INSERTED)
**Goal**: Make the embedding model a first-class, provider-pickable setting — including local Ollama/LM Studio — with a safe re-embed-on-change lifecycle, retiring the OpenAI embedding SPOF (SEED-048). Reuses Phase 111's `lmstudio` provider plumbing + admin-DB-setting pattern; lands before the DM read-path phases (113-119) that depend on retrieval quality. (Correction from a 5-agent investigation: embeddings are NOT OpenAI-hardwired today — `embedding_model`/`embedding_base_url`/`embedding_api_key`/`embedding_dimensions` are already configurable Settings with UI controls at `SettingsPage.tsx:934-950`; what's missing is a provider PICKER + local presets + the re-embed LIFECYCLE, plus a latent credential bug.)
**Depends on**: Phase 111
**Requirements**: EMBED-01, EMBED-02, EMBED-03, EMBED-04, EMBED-05, EMBED-06
**Success Criteria** (what must be TRUE):
  1. An admin can pick an embedding provider (incl. Ollama + LM Studio local) from Settings; selecting a local provider auto-fills its base_url (Ollama `http://localhost:11434/v1`, LM Studio `http://localhost:1234/v1`) + relaxes the API key to a dummy (EMBED-01/02), modeled on the existing rerank-provider `<select>` (`SettingsPage.tsx:959-967`).
  2. Chunk-embedding and query-embedding use the SAME configured model + creds — the `embed_chunks` credential bug (drops `user_settings`; `embedding_service.py:94` / `documents.py:1405`) is fixed so a configured non-default embedder no longer embeds queries and chunks in mismatched vector spaces (EMBED-04; proven by a live cross-embedder ingest+search test).
  3. Changing the embedding model/dimension triggers a guarded, RLS-scoped re-embed of existing chunks — `resize_embedding_column(N)` (`full-schema.sql:173-191`, currently never called) wired + a net-new batched re-embed background job over `document_chunks WHERE embedding IS NULL` (from preserved `content`); search recovers; a destructive-change UI confirmation names the re-embed first (EMBED-05/06). No silent vector-space mismatch.
  4. **SC#10-style live UAT**: a local (LM Studio/Ollama) embedding model embeds + serves search; an OpenAI→local switch re-embeds and search still returns relevant cited results; search-threshold recalibration noted (confidence buckets `0.54/0.38` at `agent_loop.py:664-682` + `retrieval_match_threshold` 0.3 are calibrated for text-embedding-3-small and are NOT portable).
**Design driver (the dimension-mismatch problem)**: `document_chunks.embedding` is a fixed `vector(1536)` column (`full-schema.sql:394`) + HNSW index with NO per-chunk record of which model produced a vector. **v1 = GLOBAL single embedding model + re-embed-on-change** (matches the single-column design). Optional: standardize one target dimension (1024) via Matryoshka truncation (pass `embedding_dimensions` into `embeddings.create(dimensions=…)` — a 1-line change at `openai_service.py:1473`, currently NOT passed) so truncation-capable providers coexist; add per-chunk `embedding_model`/`dimensions` tagging as a cross-space-search safety net. Per-folder embedding sets = OUT OF SCOPE (schema redesign). Realistic provider boundary = "any OpenAI-compatible `/v1/embeddings`" (OpenAI/Google/Jina/Mistral/Cohere/Ollama/LM Studio = zero new client code; Voyage + int8/binary = native-SDK, defer).
**Carry-in (BUG-260616-01 — local-model routing trap; surfaced from Phase 111 UAT axis b):** the SAME root cause that motivates the embedding-provider picker also breaks LLM-side local routing today — provider is inferred from the model-id STRING, so a slashed local id (`google/gemma-3-4b`) mis-infers to `openrouter` (`config.py:362`) and `forced_emit` ships the call to OpenRouter's cloud instead of the local `:1234`/`:11434` server (data-egress surprise; no `lmstudio` inference pattern exists). Fold the SYMMETRIC fix into this phase: (a) explicit `(provider, model)` pairing — add `extraction_provider` beside `extraction_model` AND `embedding_provider`, route by the stored provider, skip name-inference when set; (b) make the `forced_emit` cross-provider block local-aware (resolve a local target provider's base_url + dummy key — `forced_emit.py:261-275`); (c) gate the OpenRouter "quality" mangling on `provider=="openrouter"` instead of `"/" in model` (`openai_service.py:1449-1456`) — as-is it appends `:exacto` + a `response-healing` plugin to any slashed local model id and 500s LM Studio/Ollama. **Live-proven 2026-06-16:** once these are bypassed, a 12B local model (gemma-4-12b-qat) extracts full confidence-scored metadata through the real engine; the blocker is purely this routing/mangling. Discuss-phase must route BUG-260616-01 (status: folded → 111.1).
**Plans**: 6 plans
  - [ ] 111.1-01-PLAN.md — Substrate: Wave-0 test scaffolds + migration 073 file (un-applied; all DDL incl. match_document_chunks + resize_embedding_column) + settings schema/API for embedding_provider/extraction_provider/confidence buckets
  - [ ] 111.1-02-PLAN.md — Data-egress routing fixes (BUG-260616-01 / D-09 x3): explicit extraction_provider, local-aware forced_emit, OpenRouter mangling gated on provider==openrouter
  - [ ] 111.1-03-PLAN.md — EMBED-04 embed_chunks cred fix + D-10 chunk-tag write + match_document_chunks filter caller + D-12 confidence buckets from settings
  - [ ] 111.1-04-PLAN.md — [BLOCKING] apply migration 073 live to :54322 (SQL-editor/psycopg2, NEVER db push) + read-back + regen full-schema.sql + D-07 preset curation + live D-10 tests
  - [ ] 111.1-05-PLAN.md — Re-embed background job (batched, RLS-scoped, resumable, non-destructive, threadpool) + settings kickoff + progress/re-kick endpoints (EMBED-05)
  - [ ] 111.1-06-PLAN.md — Frontend: reusable ProviderPicker (sketch 024) + ReembedConfirmModal (sketch 025) + ReembedStatusCard (sketch 026) + SettingsPage wiring (EMBED-01/02/03/06)
**UI hint**: yes
**G-2**: /gsd:sketch (operator-approved mockup of the Settings embedding-provider picker + local presets + the destructive re-embed confirmation) BEFORE plan.

#### Phase 112: Metadata Enrichment — Document Detail Panel + Manual Edit
**Goal**: Give users a first-class place to SEE enriched metadata with per-field confidence and to correct it — establishing the net-new document detail panel that relationships (117) and classification (118) will also inhabit.
**Depends on**: Phase 111
**Requirements**: META-02, META-05
**Success Criteria** (what must be TRUE):
  1. Opening a document shows a detail panel that displays each metadata value alongside its per-field confidence (reusing the `ConfidenceChip` primitive); low confidence reads as visibly tentative.
  2. User can manually edit/override any extracted metadata value inline; the edit persists into `documents.metadata` and writes a `metadata.update` audit row (verified live).
  3. The panel matches the Deep Midnight / Aether design system, is mobile-responsive, and meets WCAG 2.1 AA (UX-01 cross-cutting acceptance).
**Plans**: TBD
**UI hint**: yes
**G-2**: /gsd:sketch (operator-approved mockup of the **document detail panel** — the shared shell for META display/edit + REL panel + CLASS suggestion) BEFORE plan. (UX-02 cross-cutting acceptance.)

#### Phase 113: Virtual Folders — Filter Compiler + Equality Views (Backend)
**Goal**: Land the saved-view data model and the one genuinely net-new component — a closed-registry filter-AST → parameterized-SQL compiler — proving equality/AND/folder-scope views compose the existing `search_documents` seam leak-safely.
**Depends on**: Phase 111 (richer metadata to filter on)
**Requirements**: VIEW-01, VIEW-02, VIEW-04, VIEW-05, VIEW-06
**Success Criteria** (what must be TRUE):
  1. A saved view (name + `filter_expr` jsonb + optional `folder_scope`) persists and resolves live contents through `search_documents(metadata_filter, folder_ids)` — query-not-copy, so one document appears in multiple views with no duplication (VIEW-01/02).
  2. A view can combine multiple equality conditions (AND) and optionally scope to a folder subtree (VIEW-04/05); the filter-AST compiler uses a closed operator registry with field-whitelist + all literals bound as `$n` (no eval, no string interpolation).
  3. A globally-shared (`is_global`) view exposes its *definition* but resolves *results/counts/facets over each viewer's own visible set* — two users see different result sets for the same shared view, with no cross-user content/count/existence leakage; cross-user miss returns 404-not-403 (VIEW-06). Verified live in secure-phase (the leak test, not the DEFINER label).
  4. An injection/SSTI attempt placed in a filter value is neutralized (parameterized — no SQL/template execution).
**Plans**: TBD
**UI hint**: no

#### Phase 114: Virtual Folders — Range/Date Filters + View Builder + Sidebar
**Goal**: Complete virtual folders end-to-end — add the range/relative-date evaluator on typed indexed columns and the guided view/filter builder UI that renders saved views in the sidebar exactly like folders.
**Depends on**: Phase 113
**Requirements**: VIEW-03
**Success Criteria** (what must be TRUE):
  1. View filters support equals / one-of / contains / is-empty / numeric & date comparisons including relative dates ("expiring within N days"); "expiring in 90 days" returns correct rows across month/day boundaries because hot date/`document_type` fields are promoted to **typed, indexed columns** (btree), not lexically-compared lowercased JSONB strings (VIEW-03).
  2. A guided condition builder (no raw DSL) lets the user compose a view's filter; saved views render in the sidebar as a distinct "Views" group with a visual affordance that they are saved queries (not real folders the user can drop files into), reusing the global-folder indicator pattern.
  3. `EXPLAIN` shows index use (not a seq scan) for a view query at ~10k docs; sidebar render does not degrade with corpus size.
  4. The builder + sidebar match the Deep Midnight / Aether design system, are mobile-responsive, and meet WCAG 2.1 AA (UX-01 cross-cutting acceptance).
**Plans**: TBD
**UI hint**: yes
**G-2**: /gsd:sketch (operator-approved mockup of the **view/filter builder**) BEFORE plan. (UX-02 cross-cutting acceptance.)

#### Phase 115: Virtual Folders — Agent Tool
**Goal**: Make saved views and metadata queries answerable in chat — the agent can run a view as a tool, extending the M-Files-folderless story into the conversational surface.
**Depends on**: Phase 113 (compiler), Phase 114 (full operator set)
**Requirements**: VIEW-07
**Success Criteria** (what must be TRUE):
  1. The agent can run a saved view (or an ad-hoc metadata query) as a tool to answer a question in chat; the tool is registered in `_TOOL_REGISTRY` AND advertised in the `get_tools` schema (the Phase 101 `render_template` schema-visibility bug guarded against — verified the model actually calls it).
  2. The tool resolves results over the caller's visible set (own-or-global-folder), never leaking another user's documents; respects `ctx.phase_whitelist` for free via the `dispatch_tool` guard.
  3. **SC#10 4-axis UAT**: the new agent tool is exercised cross-provider (native-7), in a multi-tool prompt (e.g. view-query + `search_documents`), with a parallel-thread row and a long-message row; authored in VALIDATION.md.
**Plans**: TBD
**UI hint**: no

#### Phase 116: Document Relationships — Backend + Agent Tool
**Goal**: Let users typed-link documents and let the agent traverse those links — establishing directional relationship edges and the `get_related_documents` tool over them.
**Depends on**: Phase 110 (table substrate)
**Requirements**: REL-01, REL-03, REL-04
**Success Criteria** (what must be TRUE):
  1. User can create a typed link (`supersedes` / `amends` / `references` / `attached_to`) between two documents and remove it; links reference document identity via latest-resolved/`is_latest` so a new version or restore does not orphan them (REL-01/03); a `relationship.create` audit row lands live.
  2. The agent retrieves a document's related documents via a `get_related_documents` tool registered in `_TOOL_REGISTRY` AND advertised in `get_tools` (REL-04); a relationship pointing at a document the caller can't see renders as "linked document (no access)" — never leaking the target's title/metadata.
  3. **SC#10 4-axis UAT**: `get_related_documents` is exercised cross-provider (native-7), multi-tool, parallel-thread, and long-message; authored in VALIDATION.md.
**Plans**: TBD
**UI hint**: no

#### Phase 117: Document Relationships — Panel UI
**Goal**: Surface a document's typed relationships in a panel on its detail view so users can see and manage links visually.
**Depends on**: Phase 116, Phase 112 (document detail panel shell)
**Requirements**: REL-02
**Success Criteria** (what must be TRUE):
  1. A document's detail view shows a relationship panel listing outgoing and incoming typed links with the related filename + a relationship-type chip (REL-02); inaccessible targets render as "linked document (no access)".
  2. The panel supports creating a link (reusing the `MoveToFolderDialog` document-picker pattern for relationship target selection) and removing one, reflecting changes live.
  3. The panel matches the Deep Midnight / Aether design system, is mobile-responsive, and meets WCAG 2.1 AA (UX-01 cross-cutting acceptance).
**Plans**: TBD
**UI hint**: yes
**G-2**: /gsd:sketch (operator-approved mockup of the **relationship panel**) BEFORE plan. (UX-02 cross-cutting acceptance.)

#### Phase 118: Auto-Classification
**Goal**: Turn the now-richer metadata into routing intelligence — classification rules that produce a suggestion on upload (never a silent auto-move) the user can accept or dismiss.
**Depends on**: Phase 111 (enriched metadata — HARD prerequisite), Phase 110 (rules table)
**Requirements**: CLASS-01, CLASS-02, CLASS-03
**Success Criteria** (what must be TRUE):
  1. User can define classification rules (metadata condition → suggested folder/tag) stored in `classification_rules`, owner-private or global, enable/disable-able (CLASS-01).
  2. On upload, a rule-eval pass in `ingest_document` (between metadata-build and persist) writes a *suggestion* into `metadata._classification` — never a silent auto-move; rule-matching reads are explicitly user-scoped in app code (no `auth.uid()` in a BackgroundTask) (CLASS-02).
  3. User can accept or dismiss a classification suggestion from the document row/detail; accepting writes a `classification.apply` audit row (verified live) and performs the move; dismissing clears the suggestion. The whole flow is reversible (CLASS-03).
  4. The classification UI matches the Deep Midnight / Aether design system, is mobile-responsive, and meets WCAG 2.1 AA (UX-01 cross-cutting acceptance).
**Plans**: TBD
**UI hint**: yes

#### Phase 119: Document Governance Health
**Goal**: Give users a light, read-only governance view of document-structure health — distinct from the retrieval (knowledge-health) dashboard — that surfaces and links to the fixes for the signals the upstream features produce.
**Depends on**: Phase 116 (relationships), Phase 118 (classification), Phase 111 (confidence) — pure consumer, lands last
**Requirements**: DGOV-01, DGOV-02
**Success Criteria** (what must be TRUE):
  1. A separate, light governance view (its own surface/route + queries — NOT cards bolted onto the knowledge-health dashboard) surfaces broken/dangling relationships, unclassified documents, and low-confidence metadata, reusing the `HealthPanel` card + paginated/actionable-empty-state patterns (DGOV-01).
  2. Each governance signal links to the action that fixes it (open document, re-extract, classify) (DGOV-02).
  3. The view is read-only aggregation over the new tables under their existing RLS (no new write path), matches the Deep Midnight / Aether design system, is mobile-responsive, and meets WCAG 2.1 AA (UX-01 cross-cutting acceptance).
**Plans**: TBD
**UI hint**: yes

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 110. DM Foundations | 2/2 | ✅ Executed (live-verified) | 2026-06-15 |
| 111. Metadata Enrichment — Extraction Backend | 5/5 | ✅ Closed | 2026-06-16 |
| 111.1 Configurable / Multi-Provider Embeddings | 0/6 | 📋 Planned | 2026-06-16 |
| 112. Metadata Enrichment — Detail Panel + Manual Edit | 0/? | Not started | - |
| 113. Virtual Folders — Filter Compiler + Equality (Backend) | 0/? | Not started | - |
| 114. Virtual Folders — Range/Date + Builder + Sidebar | 0/? | Not started | - |
| 115. Virtual Folders — Agent Tool | 0/? | Not started | - |
| 116. Document Relationships — Backend + Agent Tool | 0/? | Not started | - |
| 117. Document Relationships — Panel UI | 0/? | Not started | - |
| 118. Auto-Classification | 0/? | Not started | - |
| 119. Document Governance Health | 0/? | Not started | - |

---

## v2.9 Workflow Studio — ✅ SHIPPED 2026-06-15

Full detail archived → **`.planning/milestones/v2.9-ROADMAP.md`** · requirements → **`.planning/milestones/v2.9-REQUIREMENTS.md`** · summary → **`.planning/MILESTONES.md`**.

CORE phases 097–104 (9 phases incl. inserted 101.1, 57 plans) shipped + validated — every CORE phase passed verify-work + secure-phase + live cross-provider UAT. Turned the v2.8 harness into an authorable capability: project/scope binding + server-side KB governance, workflow↔skill composition, ephemeral template upload + guaranteed cited template-fill with integrity gates, a reusable validation-gate library + an output-quality judge **hard-wall**, a Workflows page with NL authoring + read-only graph + 8-stage publish gauntlet, and a PM flagship content pack on the generic primitives.

**STRETCH 105–109 deferred to backlog** (never started — roadmap gated them on "ship only if CORE lands clean and budget remains"): SCHED-01 (scheduled triggers + budget caps), GRID-01 (citation-traceable grid renderer), GOV-02 (per-run provenance receipt), PLUG-01 (plugin-contract lock), ROLE-01 (operator/admin role tier). They roll forward as next-milestone candidates.

---

## Shipped Milestones

<details>
<summary>v2.9 Workflow Studio (Phases 097-104 CORE) -- SHIPPED 2026-06-15</summary>

- [x] Phase 097: Spike — Risk-Register Template-Fill + Authoring Feel (5/5 plans) -- completed 2026-06-08
- [x] Phase 098: Project Binding + Server-Side KB Scope Governance (5/5 plans) -- completed 2026-06-09
- [x] Phase 099: Workflow ↔ Skill Composition (6/6 plans) -- completed 2026-06-10
- [x] Phase 100: Ephemeral Template Upload (6/6 plans) -- completed 2026-06-10
- [x] Phase 101: Template-Fill + Integrity Validation (5/5 plans, via 101.1) -- completed 2026-06-12
- [x] Phase 101.1: Guaranteed Structured Emission Layer (10/10 plans; verify-work 19/19 + secure 36/36) -- completed 2026-06-12
- [x] Phase 102: Reusable Validation-Gate Library + Output-Quality Gate (9/9 plans; verify-work 7/7 + secure 34/34) -- completed 2026-06-13
- [x] Phase 103: Workflows Page + Authoring API + NL Authoring (6/6 plans; secured 32 threats/0 open) -- completed 2026-06-14
- [x] Phase 104: PM Flagship Content Pack (3/3 plans; secured 15/0 + nyquist + live UAT 5/5) -- completed 2026-06-15

STRETCH (deferred to backlog, never started): 105 Scheduled Triggers + Budget Caps · 106 Citation-Traceable Grid Renderer · 107 Per-Run Provenance Receipt · 108 Plugin Contract Lock · 109 Operator/Admin Role Tier.

</details>

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

<details>
<summary>v2.8 Harness Engine & Workflow Mode (Phases 089-096) -- SHIPPED 2026-06-07</summary>

10 phases (089-096, incl. inserted refactor 092.5 + inserted live-UAT phase 095.1), 67 plans complete. A deterministic, auditable workflow runtime -- locked ordered phases + dispatcher-enforced per-phase tool whitelists + validation gates with bounded retry + Postgres-resumable phase state, plus a per-thread Deep/Harness dual-mode toggle and a live WCAG 2.1 AA phase-timeline in the workspace panel. The harness is ~80% composition of shipped primitives with zero new deps; Deep Mode stayed byte-identical (the red line). Mid-milestone rescope (discuss-093) inserted 092.5 (provider-gateway extraction) + 095.1 (cross-provider run honesty). Full details: `.planning/milestones/v2.8-ROADMAP.md`. Close-out narrative + decisions: `.planning/MILESTONES.md`.

- [x] Phase 089: Agent-Loop Extraction (G-5) + Kickoff UAT (4/4 plans) -- completed 2026-05-30
- [x] Phase 090: Harness Schema + RLS + Config Models (3/3 plans) -- completed 2026-05-31
- [x] Phase 091: Harness Engine + 5 Phase Types + Gates + Whitelist (8/8 plans) -- completed 2026-05-31
- [x] Phase 092: Dual-Mode Wiring + Continue Button (7/7 plans) -- completed 2026-06-01
- [x] Phase 092.5: Provider Gateway Extraction (6/6 plans) -- completed 2026-06-01
- [x] Phase 093: Harness Cross-Provider Parity + Phase-Type Hardening (9/9 plans) -- completed 2026-06-03
- [x] Phase 094: Workflow Legibility + Mode Clarity (5/5 plans) -- completed 2026-06-04
- [x] Phase 095: Chat Tool-Card Unification (9/9 plans) -- completed 2026-06-06
- [x] Phase 095.1: Cross-Provider Run Honesty & Workspace Parity (7/7 plans) -- completed 2026-06-06
- [x] Phase 096: Eval Harness + Cross-Provider Verification + Concurrency (9/9 plans) -- completed 2026-06-07

</details>


---

*Milestones v1.0–v2.9 shipped and archived under `.planning/milestones/`. **Active milestone: v3.0 Document Management** (started 2026-06-15 — Phases 110-119; SEED-005 Tier A). Re-sequenced PRD roadmap + the deferral of Skill Studio → v3.1: see `.planning/PRDs/SEQUENCE.md`. v2.9 STRETCH 105–109 remain backlog carry-forwards.*

# Requirements: Agentic RAG — v3.0 Document Management

**Defined:** 2026-06-15
**Core Value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.
**Milestone goal:** Turn the product's incidental document-management capabilities into a first-class, metadata-driven surface (M-Files-aligned Tier A) — documents structured, related, and trustworthy enough to power both direct use and every cited workflow deliverable.

**Research:** `.planning/research/v3.0-document-management/SUMMARY.md` (+ STACK / FEATURES / ARCHITECTURE / PITFALLS). Near-zero new deps; the one net-new component is a small in-repo filter-AST → parameterized-SQL compiler. Build order is dependency-driven: **Foundations → Enrichment → Virtual Folders → Relationships → Auto-classification → Governance** (enrichment is a HARD prerequisite for classification).

## v3.0 Requirements

### Foundations (DMF) — shared substrate, landed once
- [x] **DMF-01
**: New document-management actions (view created, relationship added/removed, classification applied, metadata edited) are recorded in the immutable audit log. *(closes the closed-CHECK-enum silent-reject trap; verify live, not with mocks)*
- [x] **DMF-02
**: All DM data (views, relationships, classification rules, custom-field definitions) is owner-private or intentionally global-shared with no cross-user leakage, and every new table carries a nullable `org_id` so the future multi-tenancy rewrite (v3.3) re-keys cleanly.
- [x] **DMF-03
**: The v3.0 DM capability is gated behind a single feature flag (`app_settings`, default **on**) that cleanly enables/disables the new DM surfaces (views, relationships, classification, governance) + tools, and the metadata-enrichment change is backward-compatible / reversible. The flag is the seam a future entitlement/tier system plugs into (SEED-080, enforced at v3.2 Operator UX) — no entitlement *enforcement* is built in v3.0.

### Metadata Enrichment (META) — built first; unblocks classification
- [ ] **META-01**: User can define custom metadata fields (beyond the built-in title/author/date/type/topics/language/summary) that the system extracts on ingest.
- [x] **META-02**: User can see a per-field confidence score for each extracted metadata value.
- [ ] **META-03**: Metadata extraction uses the user-selected (or an admin-configured) model — not the hardwired `gpt-4o`.
- [ ] **META-04**: Metadata extraction reads beyond the first 3,000 characters (configurable/larger window or title-page + tail sampling) so late title-page/byline data isn't missed.
- [x] **META-05**: User can manually edit/override an extracted metadata value, audit-logged.

### Configurable / Multi-Provider Embeddings (EMBED) — retires the OpenAI embedding SPOF (SEED-048)
- [ ] **EMBED-01**: Admin can select the embedding provider (OpenAI / Google / local Ollama / local LM Studio / other OpenAI-compatible `/v1/embeddings`) from Settings — embeddings are no longer effectively OpenAI-only.
- [ ] **EMBED-02**: Selecting a local provider auto-fills its base_url (Ollama `http://localhost:11434/v1`, LM Studio `http://localhost:1234/v1`) and relaxes the API key to a dummy value.
- [ ] **EMBED-03**: The existing embedding model / dimensions / base_url / key remain as advanced overrides, with a provider→default-model→default-dimensions auto-fill map.
- [ ] **EMBED-04**: Chunk-embedding and query-embedding use the SAME configured model + credentials (fix `embed_chunks` dropping `user_settings`) so a configured non-default embedder never embeds queries and chunks in mismatched vector spaces.
- [ ] **EMBED-05**: Changing the embedding model/dimension triggers a guarded, RLS-scoped re-embed of existing chunks (wire `resize_embedding_column` + a batched re-embed background job from preserved `content`); search recovers afterward.
- [ ] **EMBED-06**: A destructive-change confirmation names the re-embed (and its cost) before any embedding model/dimension change commits.

### Metadata-Driven Views / "Virtual Folders" (VIEW)
- [x] **VIEW-01**: User can save a metadata filter as a named view that appears in the sidebar like a folder.
- [x] **VIEW-02**: A view's contents are live; one document can appear in multiple views with no duplication.
- [x] **VIEW-03**: View filters support equals / one-of / contains / is-empty / numeric & date comparisons, including relative dates ("expiring within N days").
- [x] **VIEW-04**: User can combine multiple filter conditions (AND) in one view.
- [x] **VIEW-05**: User can optionally scope a view to a folder subtree.
- [x] **VIEW-06**: User can share a view globally without exposing documents the viewer is not allowed to see.
- [x] **VIEW-07**: The agent can run a saved view / metadata query as a tool to answer questions in chat.

### Document Relationships (REL)
- [x] **REL-01**: User can create a typed link between two documents (supersedes / amends / references / attached-to).
- [x] **REL-02**: User can see a document's relationships in a panel on its detail view.
- [x] **REL-03**: User can remove a relationship.
- [x] **REL-04**: The agent can retrieve a document's related documents via a `get_related_documents` tool.

### Auto-Classification (CLASS)
- [ ] **CLASS-01**: User can define classification rules (metadata condition → suggested folder/tag).
- [ ] **CLASS-02**: On upload, matching rules produce a routing/classification suggestion — never a silent auto-move.
- [ ] **CLASS-03**: User can accept or dismiss a classification suggestion.

### Document Governance Health (DGOV) — light, built last
- [ ] **DGOV-01**: User can see a light governance view surfacing document-structure health: broken/dangling relationships, unclassified documents, and low-confidence metadata.
- [ ] **DGOV-02**: Each governance signal links to the action that fixes it (open document, re-extract, classify).

### Cross-cutting UX (UX)
- [ ] **UX-01**: All new DM UI matches the Deep Midnight / Aether design system, is mobile-responsive, and meets WCAG 2.1 AA — reusing existing primitives (`ConfidenceChip`, `MoveToFolderDialog` document-picker, `FolderNode` inline-edit, `HealthPanel` cards) and the state-based `ActiveView` navigation (no react-router).
- [ ] **UX-02**: The three highest-risk net-new surfaces — the **document detail panel** (metadata + confidence + inline edit + relationships + classification), the **view/filter builder**, and the **relationship panel** — are sketched and operator-approved before implementation (G-2 sketch-before-plan).

## Deferred (Future) — v3.0.x / later
- View **grouping levels** (metadata → nested pseudo-folder tree) and **OR / nested boolean** in view filters — ship flat-list + AND first.
- **Full** governance dashboard (start as a few counters + lists).
- Auto-relate / auto-classify **workflow-produced deliverables** (composes SEED-069).
- Relationship **graph visualization** (Tier A ships a list/panel; a visual graph is later).
- Extraction-model **registry self-service UI** beyond a simple picker (full SEED-040 registry stays broader).

## Out of Scope
| Feature | Reason |
|---------|--------|
| DM Tier B — retention/lifecycle policies, check-in/check-out locking, approval workflows | Higher complexity + far more valuable once orgs/roles exist → **v3.5** (Automations + DM Tier B brief) |
| Real multi-tenancy / org-scoped DM | **v3.3** Multi-tenancy; v3.0 only adds a nullable `org_id` for forward-compat |
| Full M-Files vault model (object types / classes / value-lists) | Anti-feature — fights our folder + metadata model |
| Silent autonomous auto-filing (Doxis-style) | Anti-feature — we do suggest-then-confirm; preserves the audit/honesty positioning |
| Per-library view silos (SharePoint-style) | Anti-feature — views are global query objects, not per-library |
| A raw end-user query DSL / freeform search language | Guided condition builder instead; a raw DSL is an injection + UX hazard |

## Traceability

Build order is dependency-driven; phases 110-119 of milestone v3.0 (continuing past v2.9 CORE phase 104, skipping the deferred-STRETCH labels 105-109). Each functional requirement maps to exactly one phase. UX-01/UX-02 are cross-cutting acceptance criteria attached to every UI-bearing phase (111.1, 112, 114, 117, 118, 119) — not owned by a single phase. (Phase 111.1 was INSERTED 2026-06-15 — embedding-provider flexibility; its Settings UI carries UX-01, and G-2 sketch applies.)

| Requirement | Phase | Status |
|-------------|-------|--------|
| DMF-01 | Phase 110 — DM Foundations | Validated |
| DMF-02 | Phase 110 — DM Foundations | Validated |
| DMF-03 | Phase 110 — DM Foundations | Validated |
| META-01 | Phase 111 — Metadata Enrichment (Extraction Backend) | Pending |
| META-03 | Phase 111 — Metadata Enrichment (Extraction Backend) | Pending |
| META-04 | Phase 111 — Metadata Enrichment (Extraction Backend) | Pending |
| EMBED-01 | Phase 111.1 — Configurable / Multi-Provider Embeddings | Pending |
| EMBED-02 | Phase 111.1 — Configurable / Multi-Provider Embeddings | Pending |
| EMBED-03 | Phase 111.1 — Configurable / Multi-Provider Embeddings | Pending |
| EMBED-04 | Phase 111.1 — Configurable / Multi-Provider Embeddings | Pending |
| EMBED-05 | Phase 111.1 — Configurable / Multi-Provider Embeddings | Pending |
| EMBED-06 | Phase 111.1 — Configurable / Multi-Provider Embeddings | Pending |
| META-02 | Phase 112 — Metadata Enrichment (Detail Panel + Manual Edit) | Complete |
| META-05 | Phase 112 — Metadata Enrichment (Detail Panel + Manual Edit) | Complete |
| VIEW-01 | Phase 113 — Virtual Folders (Filter Compiler + Equality Backend) | Complete |
| VIEW-02 | Phase 113 — Virtual Folders (Filter Compiler + Equality Backend) | Complete |
| VIEW-04 | Phase 113 — Virtual Folders (Filter Compiler + Equality Backend) | Complete |
| VIEW-05 | Phase 113 — Virtual Folders (Filter Compiler + Equality Backend) | Complete |
| VIEW-06 | Phase 113 — Virtual Folders (Filter Compiler + Equality Backend) | Complete |
| VIEW-03 | Phase 114 — Virtual Folders (Range/Date + Builder + Sidebar) | Complete |
| VIEW-07 | Phase 115 — Virtual Folders (Agent Tool) | Complete |
| REL-01 | Phase 116 — Document Relationships (Backend + Agent Tool) | Complete |
| REL-03 | Phase 116 — Document Relationships (Backend + Agent Tool) | Complete |
| REL-04 | Phase 116 — Document Relationships (Backend + Agent Tool) | Complete |
| REL-02 | Phase 117 — Document Relationships (Panel UI) | Complete |
| CLASS-01 | Phase 118 — Auto-Classification | Pending |
| CLASS-02 | Phase 118 — Auto-Classification | Pending |
| CLASS-03 | Phase 118 — Auto-Classification | Pending |
| DGOV-01 | Phase 119 — Document Governance Health | Pending |
| DGOV-02 | Phase 119 — Document Governance Health | Pending |
| UX-01 | Cross-cutting (Phases 112, 114, 117, 118, 119) | Pending |
| UX-02 | Cross-cutting G-2 sketch (Phases 112, 114, 117) | Pending |

**Coverage:**
- v3.0 requirements: 24 functional total (DMF 3, META 5, VIEW 7, REL 4, CLASS 3, DGOV 2) + UX 2 cross-cutting
- Mapped to phases: **24 / 24 functional ✓** (each to exactly one phase, no orphans, no duplicates); UX-01/UX-02 attached as cross-cutting acceptance to the UI/sketch phases
- Unmapped: **0**

---
*Requirements defined: 2026-06-15 · Traceability filled during roadmap creation 2026-06-15 (Phases 110-119)*

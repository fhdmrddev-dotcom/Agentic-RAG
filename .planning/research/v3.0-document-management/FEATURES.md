# Feature Research — v3.0 Document Management (M-Files-aligned Tier A)

**Domain:** Metadata-driven document management (DMS) layer on top of an AI-native RAG platform
**Researched:** 2026-06-15
**Confidence:** MEDIUM–HIGH (M-Files dynamic-views / relationships / filter operators verified against official M-Files user guide + developer docs; Smart Metadata suggestion-confidence UX is MEDIUM — vendor pages confirm "suggestions for user review" but do not document a numeric per-field confidence display; SharePoint metadata navigation verified against Microsoft Support docs; Doxis verified against vendor docs only = MEDIUM)

> **Scope reminder.** This milestone makes the existing *incidental* DM features (nested folders, version+restore, immutable audit log, LLM-extracted per-doc metadata, table/image extraction, knowledge-health dashboard) into a *first-class metadata-driven surface*. Only the **NEW Tier A** work is researched here: (1) metadata enrichment + per-field confidence + configurable fields, (2) metadata-driven views / virtual folders, (3) document relationships, (4) auto-classification on upload, (5) a light governance health view. **Tier B** (retention / check-in-out / approvals) is explicitly OUT → v3.5. Competitive reference: **M-Files is primary** ("metadata, not folders, is the primary structuring mechanism"); SharePoint / Doxis / Documentum / OpenText compared where useful. Glean / OpenAI-Assistants are NOT DM references.

---

## How the reference DMSes actually behave (grounding for the categories below)

**M-Files "Dynamic View" (the headline UX users will assume).** A view in M-Files is a **saved filter over metadata that renders in the sidebar exactly like a folder** — same tree affordance, same double-click-to-open, but the contents are computed live from metadata, not from physical location. Three properties define the expected behavior and every one is a *table-stakes* expectation if we ship views at all:
- **Looks like a folder, isn't a folder.** "Just like folders, without all the problems of folders." No documents are moved or copied; the view is a query. ([documentmanagementsoftware.com.au](https://www.documentmanagementsoftware.com.au/m-files-dynamic-views-just-like-folders-without-all-the-problems-of-folders), [m-files.com](https://www.m-files.com/en/folderless-metadata-driven))
- **A document appears in many views at once.** The same file shows up in every view whose filter it matches — "a single document can show up in as many unique views as there are users to create them." No duplication. ([m-files.com dynamic-views](https://www.documentmanagementsoftware.com.au/m-files-dynamic-views-just-like-folders-without-all-the-problems-of-folders))
- **Grouping levels = folder-like sub-hierarchy generated from metadata.** A view can have "grouping levels," so "Contracts → by Customer → by Year" renders as nested pseudo-folders, each level being a `GROUP BY` on a metadata property. The view auto-updates as documents/metadata change. ([documentmanagementsoftware.com.au](https://www.documentmanagementsoftware.com.au/m-files-dynamic-views-just-like-folders-without-all-the-problems-of-folders))

**M-Files view/search filter operators (what users expect to be able to express).** From the official property-based-conditions and search-condition docs, a view filter supports: `Equal / Unequal / Greater / Greater-or-equal / Less / Less-or-equal`, list operators `One of / Not one of`, text `Contains / Does not contain / Starts with / Does not start with`, wildcard `Matches / Does not match (?,*)`, and null checks `Is empty / Is not empty`. Date/time properties additionally support **relative-date functions**: `DaysFrom()` / `DaysTo()` (e.g. `Created < 7` = last week; **`Expires` within `DaysTo() ≤ 90`** = the canonical "expiring soon" view), plus `Month() / Year() / YearAndMonth()`. Conditions combine with **AND across rows**; richer boolean nesting ("subordination of search criteria") exists but is an advanced surface. ([property_based_conditions](https://userguide.m-files.com/user-guide/latest/eng/property_based_conditions.html), [COM-API SearchConditions](https://developer.m-files.com/APIs/COM-API/Searching/SearchConditions/), [DataFunctionCall](https://developer.m-files.com/APIs/COM-API/Searching/DataFunctionCall/))

**M-Files relationships.** Typed references between objects (no copy, separate version histories). They surface in a **Relationships dialog / panel** on the object's metadata card; relationships set via metadata properties (e.g. a doc's `Organization` property → the Organization object) appear there too. You drill from a doc to its related docs. Caveat: in classic M-Files you must **check the object out to edit its relationships**, and relationships are partly an artifact of the object-type/value-list model. ([object_relationships](https://userguide.m-files.com/user-guide/latest/eng/object_relationships.html), [Relationships](https://userguide.m-files.com/user-guide/2015.1/eng/Relationships.html), [help center](https://help.m-files.com/guides/how-to-create-relationships-between-objects/))

**M-Files automatic metadata / classification (Smart Metadata + Intelligent Metadata Layer).** On add, intelligence services analyze content (text + visual, OCR + NLP) and **suggest a document class and propose metadata field values** (customer, dates, invoice number, organizations, people). Critically these are **suggestions the user reviews and accepts** — not silent auto-filing — and the system **learns from how users add/correct metadata over time**. Public docs confirm the suggest-then-confirm model; they do **not** document a numeric per-field confidence shown in the UI (so a visible per-field confidence chip would be a *differentiator*, not a copy). ([Intelligent Metadata Layer](https://userguide.m-files.com/user-guide/latest/eng/intelligent_metadata_layer.html), [intelligence_services](https://userguide.m-files.com/user-guide/latest/eng/intelligence_services.html), [Smart Metadata](https://catalog.m-files.com/shop/m-files-smart-metadata/), [rangeis.com.au](https://rangeis.com.au/how-metadata-and-ai-in-m-files-are-transforming-document-management-in-2025/))

**SharePoint comparison (what "metadata navigation" looks like there).** A left-hand **navigation tree** of managed-metadata terms / content types filters the library live; **key filters** below the tree add Choice / Person / **Date** / **Number** refinement. Navigation hierarchies are limited to Managed-Metadata / Content-Type / single-value-Choice; libraries cap at ~20 auto-indexes; everything is **per-library**, not a global cross-library saved view. SharePoint also has **content types** (a schema/template bundle of columns) and **document sets** (a folder-like container with shared metadata) — these are the SharePoint analog of "classes," and the closest thing to our auto-classification target. ([Microsoft Support: metadata navigation](https://support.microsoft.com/en-us/office/set-up-metadata-navigation-for-a-list-or-library-c222a75d-8b18-44e2-9ed8-7ee4e0d23cfc), [andrewwarland](https://andrewwarland.wordpress.com/2020/06/16/what-to-use-when-metadata-content-types-folders-or-document-sets/))

**Doxis comparison.** Heavier ECM. AI captures from many channels, **classifies the document fully autonomously**, extracts metadata, files it into the matching **eFile** (electronic case file) and routes it into a workflow. The autonomous-filing + eFile + SAP/Salesforce-routing model is the "fight our architecture" end of the spectrum — useful as a contrast, not a target. ([doxis content-understanding](https://www.doxis.com/en/business-platform/content-understanding), [doxis DMS](https://www.doxis.com/en/solutions/document-management))

---

## Feature Landscape

### Table Stakes (Users Expect These)

If we ship a "metadata-driven DM" surface, these are the behaviors a user coming from M-Files/SharePoint assumes exist. Missing any = the feature feels broken or half-built.

| # | Feature | Why Expected | Complexity | Notes / dependency on existing foundation |
|---|---------|--------------|------------|-------------------------------------------|
| TS-1 | **Saved view renders in the sidebar like a folder** (virtual folder) | The entire M-Files mental model. If a saved search lives on a separate "Search" screen instead of next to folders, it doesn't read as a virtual folder. | MEDIUM | Net-new `views` entity (name, filter-expr JSON, optional folder-subtree scope, owner/global). UI: inject view nodes into the existing folder sidebar tree. **Composes** with the existing `search_documents` `metadata_filter` + folder-scope seam noted in PROJECT.md. |
| TS-2 | **Live / always-current contents** | Users assume a view re-evaluates on open; a stale snapshot breaks the metaphor. | LOW | Evaluate filter at open-time over current metadata. No materialization needed at our scale. |
| TS-3 | **A document appears in multiple views with no duplication** | Core "what not where" promise; users will test this immediately. | LOW | Falls out naturally from query-not-copy. RLS still applies per row. |
| TS-4 | **Filter operators: equals / one-of (value list) / contains / is-empty / numeric & date comparisons** | This is the floor M-Files/SharePoint set. A view you can't filter by `document_type = contract` is not a view. | MEDIUM | Maps onto existing metadata. Value-list operators (`one of`) need the field to have known values — ties to the enrichment workstream (configurable fields). |
| TS-5 | **Date-range + relative-date filters incl. "expiring soon"** (`expires within N days`, `created in last 30 days`, this-quarter) | The flagship example in the brief ("all contracts expiring in 90 days") and the #1 reason users want views over folders. | MEDIUM | Requires a **date-typed** metadata field (e.g. `expiry_date`, `effective_date`) that enrichment must capture/normalize. Relative-date semantics like M-Files `DaysTo()`. |
| TS-6 | **AND-composition of multiple conditions** | Users expect to stack `type=contract AND org=X AND expires<90d`. | LOW–MED | AND across rows is the floor; full nested boolean (OR groups) is differentiator territory (see DIFF list). |
| TS-7 | **Grouping levels (metadata → folder-like sub-tree)** | M-Files views nest "by Customer → by Year." Without it a view is just a flat list and feels weaker than a folder. | MEDIUM | `GROUP BY metadata_property` rendered as expandable pseudo-folders. Can ship flat-first, add grouping in a follow-up. |
| TS-8 | **Typed, directional relationships with a small built-in vocabulary** (`supersedes`, `amends`, `references`, `attached_to`) | Folders can't express "this contract amends that one." A relationship feature with only one generic "related" link feels incomplete. | MEDIUM | Net-new `document_relationships` table (source, target, type, created_by, created_at) + RLS, per SEED-005. Directionality matters (supersedes ≠ superseded-by). |
| TS-9 | **Relationship panel on the document detail view** | The M-Files Relationships-dialog expectation: see and navigate a doc's links from the doc itself. | LOW–MED | New panel on doc detail; reuses existing doc-detail surface. Click a related doc → navigate. |
| TS-10 | **Classification is a *suggestion the user confirms*, not silent auto-filing** | M-Files suggests class + values for review; users expect an accept/reject moment, not surprise moves. | MEDIUM | On upload, propose `document_type` + target folder/fields; user confirms. **Composes** with existing ingestion metadata extraction. (Silent auto-move is an anti-feature — see AF list.) |
| TS-11 | **Configurable / custom metadata fields** | Every reference DMS lets admins define fields ("matter number," "vendor," "client"). A fixed 7-field schema reads as a toy. | HIGH | The big enrichment piece: move off the fixed `DocumentMetadata` Pydantic model (`backend/app/models/document.py:8-16`) toward an admin/user-defined field schema + storage + UI to manage fields. Largest single dependency for everything above (views, classification, relationships-by-property all get richer with it). |
| TS-12 | **Edit/override extracted metadata by hand** | Auto-extraction is never perfect; users expect to correct a value. | LOW–MED | Editable metadata card; every edit should hit the existing **immutable audit log** (F-06). Manual override must beat AI value and persist through re-ingest. |
| TS-13 | **A governance view that surfaces "broken / unclassified / low-confidence" docs** | If you promise metadata-driven structure, users expect a place that flags docs missing the metadata that makes structure work. | MEDIUM | Light SEED-046 slice: broken-relationships (dangling target), unclassified (no `document_type`), low-confidence-metadata. **Distinct dashboard** from the existing retrieval-health one (SEED-005 §"Known intersection"). Locked-too-long / awaiting-approval are Tier B → OUT. |

### Differentiators (Where an AI-native RAG product beats a classic DMS)

These are where our architecture wins. Each ties to an existing strength (LLM extraction, agent tools, semantic search, citations, the harness).

| # | Feature | Value Proposition | Complexity | Notes / which strength it leans on |
|---|---------|-------------------|------------|-------------------------------------|
| DIFF-1 | **LLM-extracted metadata *automatically* feeds views — zero manual tagging** | M-Files' folderless promise depends on users (or a paid IML add-on) tagging documents. We extract metadata on ingest already, so virtual folders populate themselves on day one with no tagging discipline required. This is the headline story for the whole milestone. | LOW (leverage) | Leans on the existing ingestion metadata-extraction pipeline (Module 4 / v2.1). The enrichment workstream (richer + custom fields) directly multiplies view power. |
| DIFF-2 | **Per-field confidence shown in the UI** (chip / color per value) | Public M-Files docs describe suggest-then-confirm but **not** a visible numeric per-field confidence. Surfacing "title 0.95 / expiry_date 0.62" tells users exactly which auto-values to trust — a genuine UX advance over the reference. | MEDIUM | Requires the extractor to emit per-field confidence (enrichment workstream 1) + UI affordance + a "low-confidence" governance bucket (TS-13). |
| DIFF-3 | **Agent tools over metadata & relationships** (`get_related_documents`, views queryable in chat, "find all contracts expiring in 90 days" answerable conversationally) | M-Files relationships are a GUI dialog. Ours become first-class agent capabilities — the agent can traverse `supersedes` chains, pull a doc's amendments, or resolve a virtual-folder query mid-conversation and cite results. No classic DMS does this. | MEDIUM | New `get_related_documents` tool (in SEED-005); views expressible as `search_documents` `metadata_filter`. Fits the existing tool-dispatcher registry pattern (`tool_dispatcher.py`, Phase 083). |
| DIFF-4 | **Semantic / content-based classification, not just rules** | SharePoint content-typing and basic M-Files rules are rule/keyword-driven; Doxis charges for the AI tier. We already run an LLM over content at ingest, so classification suggestions can be semantic (understands an invoice that never says "invoice") for free. | MEDIUM | Extends ingestion extraction into a classify-and-suggest step. Keep it suggest-then-confirm (TS-10). |
| DIFF-5 | **Choose the extraction model + lift the 3,000-char window** | The operator's headline ask. No classic DMS lets you pick the LLM that reads your docs; pinning to old `gpt-4o` (`embedding_service.py:112`, `config.py:624`) is strictly worse than the rest of the app. Routing extraction through the user-selected/admin-set model + scanning past `content[:3000]` lifts metadata quality everywhere. | LOW–MED | Surgical backend change (thread `user_settings`/admin setting into `get_llm_client()`; lift `content[:3000]` cap at `embedding_service.py:107`). Folds in SEED-040 (model picker) + minimal SEED-012 (extraction-model setting only). |
| DIFF-6 | **Relationships + views power the harness/workflow deliverables** | v2.9 workflows emit cited deliverables; SEED-069 re-ingests them. If a generated "status report" is auto-related (`references`) to its source docs and lands in the right virtual folder via classification, the workflow output becomes a navigable, trustworthy part of the KB — a story neither M-Files nor SharePoint can tell. | MEDIUM | Composes relationships + classification with the existing harness output path (SEED-069). Likely a later phase / stretch, but worth naming as the north star. |
| DIFF-7 | **Nested boolean composition (OR groups) in views** | M-Files supports it but buries it; SharePoint barely. A clean "match ALL / match ANY" group builder is a modest UX edge once AND-stacking (TS-6) ships. | MEDIUM | Optional second-pass on the view builder. Don't gate v1 on it. |

### Anti-Features (M-Files / SharePoint behaviors that FIGHT our architecture or positioning — deliberately skip)

| # | Feature | Why It's Requested / Looks Good | Why It Fights Us | What to do instead |
|---|---------|--------------------------------|-------------------|--------------------|
| AF-1 | **The full M-Files vault model: object types + classes + value-lists + class-driven mandatory-property metadata cards** | It's *the* M-Files structure and tempting to copy wholesale. | It's a heavyweight admin-configured schema layer (object types → classes → properties → value lists) that presupposes an admin sets it all up before use. Our value is **AI fills metadata automatically**; forcing a vault-structure config step contradicts that and is a multi-milestone build. | Ship **configurable custom fields (TS-11)** on top of the existing flat `documents` model — fields, not a full object-type taxonomy. "Classes" stay implicit in `document_type`. |
| AF-2 | **Silent fully-autonomous classification + auto-filing (the Doxis model)** | "Just file it for me, no clicks." Looks magical. | We have RLS, global-vs-private folders, and immutable audit. Silently *moving* a doc into a folder on an AI guess (which can be wrong / low-confidence) breaks trust, is hard to audit cleanly, and contradicts our citations-and-confidence honesty positioning. | **Suggest-then-confirm (TS-10).** Show the proposed folder/type + confidence; user accepts. Optionally a per-folder "auto-accept above X confidence" opt-in *later*, never as the default. |
| AF-3 | **Check-out-to-edit-relationships / check-out-to-edit-metadata** (classic M-Files locking semantics) | It's how M-Files gates edits. | Check-in/check-out is **Tier B (→ v3.5)** and explicitly deferred. Requiring a lock to add a relationship or fix a metadata value imports lock complexity into a Tier-A feature for no benefit on a read-mostly KB. | Direct edit + **audit-log** every change (we already have the immutable log, F-06). Add locking only if/when Tier B lands. |
| AF-4 | **Per-library / per-site scoping of views (the SharePoint constraint)** | Familiar to SharePoint users; "scope the view to this library." | SharePoint's metadata navigation is *trapped inside one library* (and capped at ~20 indexes). Our strength is a single cross-folder KB with global+per-user scope. Re-creating per-library silos throws that away. | Views scope to the **whole KB or an optional folder-subtree** (the seam PROJECT.md already names), not to an isolated library. |
| AF-5 | **Materialized "real folder per view" / physically reorganizing storage to match metadata** | Some users ask "can it actually move the files so other tools see the structure?" | Defeats the no-duplication, multi-view, query-not-copy core (TS-3). Reintroduces every folder problem M-Files exists to solve, and fights RLS + versioning. | Keep views **virtual/computed**. If an export is ever needed, generate it on demand — never restructure the source of truth. |
| AF-6 | **Untyped "just related" links with no direction** | Simpler to build than a typed/directional model. | A relationship feature with one generic bidirectional "related" link can't express supersedes/amends and feels broken (it's a TS, not a DIFF). It also can't power agent traversal meaningfully. | Ship the **small typed, directional vocabulary** (TS-8) from day one; allow a generic `references` as the catch-all, not the only option. |
| AF-7 | **Approval / review state machines, retention/legal-hold rules, "needs my review" inbox** | Natural-adjacent asks once governance is visible. | Explicitly **Tier B (→ v3.5)**. Building a state machine or retention scheduler now doubles the design surface and front-runs the v3.5 Automations brief. | Governance view stays **read-only / diagnostic** (TS-13): broken-relationships, unclassified, low-confidence. No actions/state transitions. Locked-too-long & awaiting-approval are Tier B and stay out. |
| AF-8 | **A separate "advanced search" query language / DSL exposed to end users** | Power users love it; M-Files API has rich SearchConditions. | A raw query DSL is a different product than "a view that looks like a folder." It pushes complexity onto users and competes with the agent (which can already answer NL queries). | Provide a **structured condition builder** (dropdown field + operator + value rows) for views; let the **agent** handle free-form/complex queries via `search_documents`. |

---

## Feature Dependencies

```
DIFF-5 (extraction-model + lift 3000-char window)
    └──improves──> TS-11 (configurable/custom fields)
                       └──requires──> [existing ingestion metadata extraction (Module 4 / v2.1)]
                       └──enables──> TS-1 (virtual folders)
                                         └──requires──> TS-4 (filter operators)
                                                            └──requires──> TS-5 (date/relative-date) ──requires──> a date-typed field (from TS-11)
                                         └──requires──> TS-2 (live contents), TS-3 (multi-view, no dup)
                                         └──enhanced-by──> TS-6 (AND) ──> TS-7 (grouping) ──> DIFF-7 (nested boolean)
                                         └──reuses──────> existing search_documents metadata_filter + folder-scope seam

TS-11 (configurable fields)
    └──feeds──> DIFF-2 (per-field confidence)  [also needs extractor to emit confidence]
    └──feeds──> TS-10 / DIFF-4 (classification suggest-then-confirm; semantic classify)
    └──feeds──> TS-13 (governance: unclassified / low-confidence buckets)

TS-8 (typed relationships) ──requires──> document_relationships table + RLS
    └──surfaces-in──> TS-9 (relationship panel on doc detail)
    └──exposed-as──> DIFF-3 (get_related_documents agent tool)  [reuses tool_dispatcher registry, Phase 083]
    └──feeds──> TS-13 (governance: broken/dangling relationships)

DIFF-6 (relationships+views power workflow deliverables) ──composes──> SEED-069 re-ingest + harness output path
TS-12 (manual metadata edit) ──must-log-to──> existing immutable audit log (F-06)
```

### Dependency Notes

- **Enrichment (DIFF-5 + TS-11) is the spine.** Recommended internal order in PROJECT.md is *enrichment → virtual folders → relationships → auto-classification*, and the dependency graph confirms it: richer + custom + confidence-scored + correctly-extracted fields make views (TS-4/5/7), classification (TS-10/DIFF-4), per-field confidence (DIFF-2), and governance (TS-13) all materially better. Build enrichment first or everything downstream is weaker.
- **"Expiring soon" (TS-5) needs a real date field.** The brief's flagship example ("contracts expiring in 90 days") only works if enrichment captures and normalizes an `expiry_date`/`effective_date` (likely a custom field, TS-11). This is a concrete reason enrichment precedes views.
- **Relationships (TS-8/9) are independent of enrichment** — they only need the new `document_relationships` table + RLS, so they can be built in parallel after enrichment, before classification. They become a *differentiator* (DIFF-3) the moment they're exposed as an agent tool.
- **Governance view (TS-13) is downstream of everything** — it reports on relationship integrity, classification coverage, and confidence, so it should land last in the milestone (or be filled incrementally as each upstream feature ships).
- **Per-field confidence (DIFF-2) requires the extractor to emit it** — not just store it. That is an enrichment-workstream change, not a UI-only change.

---

## MVP Definition

### Launch With (the v3.0 core)

Ruthless minimum that delivers the M-Files "metadata not folders" promise honestly.

- [ ] **DIFF-5** Extraction-model flexibility + lift 3,000-char window — surgical, unblocks quality everywhere; operator's headline ask.
- [ ] **TS-11** Configurable custom metadata fields (admin/user-defined) + **DIFF-2** per-field confidence — the spine; without it views/classification stay toy-grade.
- [ ] **TS-12** Manual metadata edit/override (audit-logged via F-06).
- [ ] **TS-1/2/3/4/5/6** Virtual folders in the sidebar: live, multi-view, AND-composed filters incl. date-range + "expiring soon". (Flat-list acceptable for v1.)
- [ ] **TS-8/9 + DIFF-3** Typed directional relationships + relationship panel + `get_related_documents` agent tool.
- [ ] **TS-10 + DIFF-4** Auto-classification *suggestion* on upload (suggest folder/type + confidence; user confirms).

### Add After Validation (v3.0.x / v3.1)

- [ ] **TS-7** View grouping levels (metadata → nested pseudo-folders) — trigger: users complain flat views feel weaker than folders.
- [ ] **DIFF-7** Nested boolean (OR groups) view builder — trigger: AND-only stacking proves limiting.
- [ ] **TS-13** Full governance dashboard (broken-rel / unclassified / low-confidence) — can start as 3 simple counters, grow with usage.
- [ ] **DIFF-6** Workflow deliverables auto-related + auto-classified (composes SEED-069) — trigger: re-ingested workflow outputs become hard to find/trust.

### Future Consideration (v3.5+ — explicitly deferred)

- [ ] Check-in/check-out, approval workflows, retention/legal-hold (Tier B → v3.5 Automations).
- [ ] Opt-in "auto-accept classification above X confidence" (only after suggest-then-confirm is trusted).
- [ ] Department-scoped views/fields/classification rules (waits for SEED-004 multi-tenancy).

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| DIFF-5 extraction-model + window lift | HIGH | LOW | P1 |
| TS-11 configurable custom fields | HIGH | HIGH | P1 |
| DIFF-2 per-field confidence | MEDIUM | MEDIUM | P1 |
| TS-12 manual metadata edit (audit-logged) | HIGH | LOW | P1 |
| TS-1/2/3 virtual folder in sidebar (live, multi-view) | HIGH | MEDIUM | P1 |
| TS-4/5/6 filter operators + date/relative + AND | HIGH | MEDIUM | P1 |
| TS-8/9 typed relationships + panel | HIGH | MEDIUM | P1 |
| DIFF-3 get_related_documents agent tool | HIGH | MEDIUM | P1 |
| TS-10 + DIFF-4 classification suggest-then-confirm | MEDIUM | MEDIUM | P1/P2 |
| TS-7 view grouping levels | MEDIUM | MEDIUM | P2 |
| TS-13 governance health view | MEDIUM | MEDIUM | P2 |
| DIFF-7 nested boolean views | LOW | MEDIUM | P3 |
| DIFF-6 workflow-deliverable relationships | MEDIUM | MEDIUM | P3 |

**Priority key:** P1 = launch · P2 = add when possible · P3 = future.

## Competitor Feature Analysis

| Feature | M-Files (primary ref) | SharePoint | Doxis | Our Approach |
|---------|----------------------|------------|-------|--------------|
| Virtual folders | Dynamic Views in sidebar; grouping levels; multi-view; auto-update | Metadata-navigation tree, **per-library**, ~20-index cap | eFile views | Sidebar virtual folders, **cross-KB or folder-subtree scope**, AI-auto-populated (no manual tagging) |
| Filter operators | Rich: comparison, one-of, contains, wildcard, null, relative-date `DaysTo/DaysFrom` | Navigation hierarchy (MM/content-type/choice) + key filters (date/number) | AI + full-text + metadata | Structured condition builder (subset of M-Files operators) + relative-date incl. "expiring soon"; agent handles complex NL queries |
| Relationships | Typed references, Relationships dialog, **check-out to edit** | Lookup columns, document sets | Linked eFiles | Typed+directional, panel + **`get_related_documents` agent tool**, **no check-out** required |
| Auto-classification | Smart Metadata / IML suggest class+values (paid add-on), learns from corrections | Content types / document sets (manual schema) | **Fully autonomous** classify + file + route | Semantic LLM classify (free, built-in), **suggest-then-confirm**, never silent auto-move |
| Per-field confidence | Suggests for review; **no documented numeric confidence in UI** | None | AI-driven, not surfaced as per-field | **Visible per-field confidence chip** (differentiator) |
| Configurable fields | Full object-type/class/value-list vault model (heavy admin) | Site columns / content types | Configurable | **Custom fields on flat doc model** (no vault taxonomy) |
| Governance view | Built into admin/reporting | Compliance center | ICA dashboards | **Light read-only** diagnostic: broken-rel / unclassified / low-confidence (distinct from retrieval-health dashboard) |

## Sources

- M-Files — Dynamic views explainer: [documentmanagementsoftware.com.au](https://www.documentmanagementsoftware.com.au/m-files-dynamic-views-just-like-folders-without-all-the-problems-of-folders) · [m-files.com folderless](https://www.m-files.com/en/folderless-metadata-driven)
- M-Files — Property-based filter conditions (operators): [userguide property_based_conditions](https://userguide.m-files.com/user-guide/latest/eng/property_based_conditions.html)
- M-Files — Search conditions & relative-date functions (API): [developer SearchConditions](https://developer.m-files.com/APIs/COM-API/Searching/SearchConditions/) · [DataFunctionCall](https://developer.m-files.com/APIs/COM-API/Searching/DataFunctionCall/) · [ValueListItems](https://developer.m-files.com/APIs/COM-API/Searching/ValueListItems/)
- M-Files — Object relationships: [userguide object_relationships](https://userguide.m-files.com/user-guide/latest/eng/object_relationships.html) · [Relationships](https://userguide.m-files.com/user-guide/2015.1/eng/Relationships.html) · [help center](https://help.m-files.com/guides/how-to-create-relationships-between-objects/)
- M-Files — Intelligent Metadata Layer / Smart Metadata / intelligence services: [intelligent_metadata_layer](https://userguide.m-files.com/user-guide/latest/eng/intelligent_metadata_layer.html) · [intelligence_services](https://userguide.m-files.com/user-guide/latest/eng/intelligence_services.html) · [Smart Metadata catalog](https://catalog.m-files.com/shop/m-files-smart-metadata/) · [rangeis AI+metadata 2025](https://rangeis.com.au/how-metadata-and-ai-in-m-files-are-transforming-document-management-in-2025/)
- M-Files — Vault metadata structure (object types/classes/value lists): [userguide Metadata](https://userguide.m-files.com/user-guide/latest/eng/Metadata.html) · [developer Vault-Structure](https://developer.m-files.com/Getting-Started/Vault-Structure/)
- SharePoint — Metadata navigation (tree + key filters + field-type/index limits): [Microsoft Support](https://support.microsoft.com/en-us/office/set-up-metadata-navigation-for-a-list-or-library-c222a75d-8b18-44e2-9ed8-7ee4e0d23cfc) · metadata vs content-types vs folders vs document-sets: [andrewwarland](https://andrewwarland.wordpress.com/2020/06/16/what-to-use-when-metadata-content-types-folders-or-document-sets/)
- Doxis — AI classification / content understanding / eFile / DMS: [content-understanding](https://www.doxis.com/en/business-platform/content-understanding) · [DMS](https://www.doxis.com/en/solutions/document-management) · [ICA platform](https://www.doxis.com/en/business-platform/doxis-intelligent-content-automation)
- Internal: `.planning/PROJECT.md` (existing foundation + recommended internal order), `.planning/seeds/SEED-005-document-management-capabilities.md` (Tier A/B split + 2026-05-31 enrichment update + breadcrumbs to `embedding_service.py:107/112`, `document.py:8-16`, `config.py:624`)

---
*Feature research for: v3.0 Document Management (M-Files-aligned Tier A) — metadata-driven views, relationships, auto-classification, configurable metadata + confidence, light governance.*
*Researched: 2026-06-15 · Confidence: MEDIUM–HIGH*

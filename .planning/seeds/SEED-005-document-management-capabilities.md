---
id: SEED-005
status: dormant
planted: 2026-05-02
planted_during: v2.5 (after Phase 059 ship, before Phase 060 kickoff)
trigger_when: planning a milestone scoped to "document management", "DM", "DMS", "lifecycle", "workflow", "approvals", "metadata views", "retention", or when users start asking for features beyond the current basic folder + version + audit capabilities
scope: Large (split across 2–3 milestones likely)
---

# SEED-005: Document Management Capabilities (M-Files-aligned subset)

## Why This Matters

This product is a **RAG system** with **incidental document management capabilities** — folders, versioning, audit log, metadata extraction. The DM bits exist to serve retrieval, not as a first-class feature surface. That's the right scope for v1–v2: prove the agent + KB value first.

But the architecture has accidentally accumulated most of the foundation needed for serious document management:

- **Folders** with unlimited nesting, global vs per-user visibility (v1.0)
- **Versioning** with history and restore (v2.2 F-02)
- **Audit log** — immutable, filterable, exportable (v2.2 F-06)
- **Metadata extraction** — LLM-structured JSON per document (Module 4, v2.1)
- **Document types and language** — already extracted and normalized (v2.1)
- **Tables and images** as first-class extracted entities (v2.3 F-07)
- **Knowledge Health Dashboard** — most-retrieved, never-retrieved, low-confidence, stale (v2.3 F-09)
- **Feedback loop** with thumbs/reasons (v2.3 F-10)

That's already more than many "starter" DM systems. What's missing is the **document-management-as-a-product** layer: features that exist for the user managing documents, not for the agent retrieving them.

M-Files is a useful reference because it's built around **metadata-driven structure** rather than folder-driven structure — which aligns naturally with our existing metadata extraction. The right move is not "clone M-Files" — it's **pick the M-Files basics that compose with what we already have, and skip the ones that fight the architecture.**

## When to Surface

**Trigger:** planning a milestone scoped to document management, DMS, lifecycle, workflow, retention, approvals, metadata-driven views, or document relationships. Strong signals:
- Milestone description contains "document management", "DMS", "DM", "lifecycle", "workflow", "approval", "retention", "classification", or "metadata views"
- Users start asking for features like "lock a document while editing", "approve before publishing", "auto-delete after N days", "show me all contracts expiring this quarter"
- A customer/prospect compares this product to M-Files, SharePoint, Documentum, OpenText, or similar
- The Knowledge Health Dashboard is being extended toward operational/governance use cases (which it currently is not)
- Enterprise sales or compliance conversations require document lifecycle features

This seed should be surfaced **independently** from SEED-004 (multi-tenancy). DM features should land against the current single-tenant + per-user + global model first; SEED-004 then extends them with department-awareness when it triggers. Doing both at once doubles the design surface unnecessarily.

## Scope (when triggered)

The right approach is to pick a small, composable subset of M-Files-style basics that align with the existing schema. This will probably be 2–3 milestones rather than one. Candidates, ordered by alignment with current architecture (best-fit first):

### Tier A — Highest alignment (do these first, smallest surface)

1. **Metadata-driven views ("virtual folders" / saved searches)**
   - Already have: rich metadata extraction per document, search infrastructure
   - Add: a "View" entity — name + filter expression over metadata + (optional) full-text/vector match
   - UX: "All contracts expiring in next 90 days" appears as a folder in the sidebar, but it's a saved query, not a real folder
   - Composes with: existing folders (views can be scoped to a folder subtree), existing metadata, existing search
   - This is the **single most M-Files-aligned feature** and the one most users hit first

2. **Document relationships**
   - Today: documents are flat; the only structure is folder containment
   - Add: typed links between documents (e.g., "supersedes", "amends", "references", "attached_to")
   - Schema: `document_relationships` table (id, source_doc_id, target_doc_id, type, created_by, created_at) with RLS
   - UX: relationship panel on document detail; agent tools (`get_related_documents`)
   - Why this matters for DM: contracts amend prior contracts; specs reference RFCs; an invoice attaches to a PO. Folders cannot express this.

3. **Document classification by metadata (auto-routing on upload)**
   - Already have: metadata extraction during ingestion
   - Add: classification rules — "if document_type = 'invoice' and metadata.vendor exists, suggest folder X"
   - Foundation for Tier B retention rules
   - Composes with SEED-004 when departments arrive (dept-specific classification rules)

### Tier B — Medium alignment (do these after Tier A is in production use)

4. **Check-in / check-out (lock for edit)**
   - Today: versioning happens on upload, no concept of "I'm working on a new version, others should not edit"
   - Add: lock semantics — explicit check-out → modified locally → check-in creates new version → unlock
   - Schema: small extension to `documents` (locked_by, locked_at) or separate `document_locks` table for cleaner audit
   - UX: lock/unlock in document detail; warning banner "locked by X since Y"
   - Worth doing only when actual collaborative editing is a use case (not for read-mostly knowledge bases)

5. **Retention & lifecycle policies**
   - Today: nothing. Documents live forever until manually deleted.
   - Add: retention rules per document type / per metadata pattern (e.g., "delete invoices after 7 years", "archive contracts 1 year after expiry")
   - Schema: `retention_policies` table with rule expressions; scheduled job to apply them
   - Touches: audit log (every retention action logged), versioning (which version of a multi-version doc gets retained), legal hold concept
   - Real compliance value, but also real complexity — needs explicit user-driven motivation before building

6. **Simple approval workflow**
   - Today: nothing. Upload = published.
   - Add: optional "draft → review → approved" state machine on documents in designated folders
   - Schema: `document_workflow_state` (doc_id, state, assigned_to, …) with state-transition audit
   - UX: workflow panel on document detail, "needs my review" section in a notifications area
   - Real value when documents are authoritative (policies, contracts, specs) — less value for evidence dumps and reference material

### Tier C — Lower alignment (probably not, or much later)

7. **Full collaborative editing** (Office Online / Google Docs in-place editing)
   - Heavy integration burden, doesn't compose with our current upload-driven flow
   - Skip until external demand is overwhelming

8. **Records management certification (DoD 5015.2, ISO 16175, etc.)**
   - Heavy compliance burden, only relevant for specific buyer profiles
   - Treat as opt-in extension if/when a customer specifically requires it

9. **OCR pipeline as a first-class DM feature**
   - We already extract from PDF/DOCX/HTML/Markdown. True image-only PDFs and scans need OCR.
   - Could be additive to existing ingestion; doesn't need a DM milestone to ship
   - More likely belongs in an "ingestion improvements" track, not here

## Why This Seed Avoids Doing It Now

Planting (vs scoping into v2.5/v3.0) prevents:
- Adding DM features for hypothetical users before validating which ones real users actually want — current users have not asked for retention policies or approval workflows
- Designing DM features against the per-user + is_global model only to redo them when SEED-004 introduces departments — much of the DM surface (workflows, retention, approvals) becomes more valuable in an org context
- Confusing the product positioning during the v2/v3 timeframe — "we're a RAG system" is a clearer story than "we're a RAG system AND a DMS" without dedicated investment in the DMS half

The right time is **after** Skill Studio (SEED-002) ships and the next major user-facing milestone is being scoped. Tier A items can ship even before SEED-004 lands — they extend cleanly when departments arrive. Tier B is more valuable when there are actual organizational users (i.e., after or during SEED-004).

## Companion Documents

- `.planning/PROJECT.md` — Schema section: documents, document_chunks, document_tables, document_images, audit_log already exist as foundation
- `.planning/PROJECT.md` — Validated requirements: F-02 (versioning), F-06 (audit log), F-09 (knowledge health) — all foundational for this seed
- `.planning/PROJECT.md` — Out of Scope: "Diff view between document versions" — could be revisited if approval workflow lands
- `.planning/seeds/SEED-004-org-multi-tenancy.md` — Tier B retention/workflow/approval features become substantially more valuable once departments and roles exist
- M-Files product documentation (external) — useful reference for which "basics" are basics; not all of them apply here

## Decision Triggers

Surface this seed during `/gsd:new-milestone` if any of the following are true:
- Milestone scope mentions DM, document management, lifecycle, workflow, approvals, retention, or metadata views
- Users explicitly request: locking, approval flows, auto-deletion, document relationships, "find all documents matching X criteria as a folder"
- A competitive comparison to M-Files / SharePoint / Documentum / OpenText is requested
- Compliance / governance requirements appear (regulated industry buyer, audit requirement, retention requirement)
- A milestone is being scoped where extending the document layer makes more sense than extending the agent layer

## Notes

**Suggested entry plan when this seed surfaces:**

Start with **Tier A only** as a single milestone:
1. **Phase 1 — Metadata-driven views**: most universally useful, smallest schema change, immediate UX win
2. **Phase 2 — Document relationships**: enables "this contract amends that contract" and similar
3. **Phase 3 — Auto-classification on upload**: leverages existing metadata extraction

Treat Tier B as a separate later milestone once Tier A is in production use and there's evidence of which Tier B feature is most-asked-for. Treat Tier C as out-of-scope unless explicitly requested by a paying customer.

**Why M-Files specifically as the reference:**
M-Files's core insight — "metadata, not folders, is the primary structuring mechanism" — aligns naturally with this codebase's existing metadata extraction pipeline. SharePoint, Documentum, etc. have richer feature surfaces but heavier folder/library/site structures that fight our existing model. Picking the M-Files-style basics gets the most value per unit of architectural disruption.

**Why this is large despite "just basics":**
Even a minimal viable DM layer adds: 1+ new schema tables per Tier A item, new agent tools, new UI surfaces in folder/document views, new RLS policies, new audit log entries, integration with existing search and metadata. Underestimating this — "it's just saved searches and links" — is a real risk. Each Tier A item is probably 2–3 phases on its own.

**Known intersection with current debt:**
The Knowledge Health Dashboard (v2.3 F-09) currently surfaces *retrieval* health (most-retrieved, never-retrieved, low-confidence, stale). DM features need a *governance* dashboard alongside (locked-too-long, awaiting-approval, retention-due, broken-relationships). These are distinct dashboards, not extensions of the existing one — important to scope cleanly.

---
*Planted 2026-05-02 between Phase 059 ship and Phase 060 kickoff. User flagged that this is a "good RAG system that also has limited document management capabilities" and that M-Files-style basics could enhance the DM half without clashing with the architecture. This seed picks the M-Files concepts that compose with the existing metadata + versioning + audit foundation, and explicitly defers the ones that fight it.*

---

## Update 2026-05-31 — Metadata Enrichment + Extraction-Model Flexibility

*Surfaced during v2.8 (Harness Engine & Workflow Mode) — Phase 090 operator-testing-notes triage. The operator explicitly asked for two things: (1) richer/customizable document metadata, and (2) the freedom to choose WHICH model does the metadata extraction, managed through the admin/operator UI. This is **enrichment of the Tier A "metadata, not folders" foundation this seed already owns**, not a bug fix.*

### Plain-language: what's going on and why it matters

When you upload a document, the backend quietly asks an LLM to read the top of it and pull out structured facts — title, author, date, what kind of doc it is, topics, language, a one-line summary. Those facts power the metadata-driven views in Tier A. Three things hold that foundation back today, and the operator wants them fixed as we grow the DM layer:

1. **The set of facts we capture is fixed and small.** You can't add your own fields (e.g. "client name", "matter number", "publication venue"), and there's no per-field confidence to tell you how much to trust each value.

2. **We only read the first ~3,000 characters of the document.** If a thesis puts its real title and author on a title page that lands past that cutoff, we silently miss them. The metadata isn't wrong — we just never looked far enough in.

3. **(Operator priority) Metadata extraction is hardwired to one OLD model — `gpt-4o` — no matter which provider/model you picked for chat.** So even if your chat runs on a newer Anthropic/Google/etc. model, your document metadata is still being extracted by an old OpenAI model. Quality is pinned to that one model and is inconsistent with the rest of the app. The operator wants to choose the extraction model — ideally per-user (use my selected provider/model) OR an admin-set "extraction model" managed through the operator model UI.

> **Important — "author disappeared" is NOT a regression.** This was investigated. `DocumentMetadata.author` is populated whenever the source actually has a byline; when it doesn't, the key is correctly omitted from the response (because `exclude_none=True` is set at `backend/app/api/documents.py:1369`). It has worked this way as best-effort, data-driven extraction since the original Module-4 commit. So this update is **enrichment, not a fix** — don't scope it as a bug.

### The three enrichment workstreams

**(1) Expand + make the metadata field set configurable** *(extends Tier A item 1 "metadata-driven views" and item 3 "classification")*
- Today's fields: `title / author / date / document_type / topics / language / summary` (see breadcrumbs).
- Candidate additions: `organization`, `keywords`, `publication_venue`, **user/admin-defined custom fields**, and **per-field confidence scores**.
- Make the extracted field set user/admin-configurable rather than a hardcoded Pydantic model — this is the natural M-Files "metadata not folders" payoff: richer metadata makes the saved-search / virtual-folder views (Tier A) far more powerful (e.g. "all contracts from Org X expiring in 90 days").

**(2) Lift the 3,000-char extraction window**
- `extract_metadata` only inspects `content[:3000]` — anything deeper (title page, late byline, appendix metadata) is invisible.
- Direction: scan a larger window, or do a cheap targeted pass over title-page/front-matter + a tail sample, or make the window configurable. Cheap win; biggest quality lever for long docs (theses, reports, contracts with a cover sheet).

**(3) ⭐ Extraction-model flexibility (the operator's headline ask)**
- Root cause: `extract_metadata` calls `get_llm_client()` with **no `user_settings`**, so it always falls through to the hardwired global default `gpt-4o`.
- Direction: route metadata extraction through **the user-selected provider/model** OR an **admin-configurable "extraction model" setting**, surfaced and managed through the operator model UI.
- Cross-refs: [[SEED-040]] (model-registry self-service — where models are registered/curated) and [[SEED-033]] / SEED-012 (admin/operator UI — where an "extraction model" knob would live). This is exactly the "what models to use / flexibility / manage through admin" the operator called out, applied to the ingestion path instead of only the chat path.

### Trigger (re-surface conditions)
- Operator wants richer or **custom/user-defined** document metadata fields, **OR**
- Operator notices metadata quality is poor / stale / **pinned to an old model** and wants to pick the extraction model.

Present during `/gsd:new-milestone` (in addition to the existing DM triggers above) when the milestone scope touches: document metadata enrichment, custom metadata fields, ingestion-quality improvements, or admin-managed model selection for non-chat paths.

### Breadcrumbs (v2.8 audit, 2026-05-31)
- `backend/app/services/embedding_service.py:100-137` — `extract_metadata` (the whole extraction function)
  - `:107` — the `content[:3000]` window cap (workstream 2)
  - `:112` — `get_llm_client()` called with NO `user_settings` → forces the global default (workstream 3)
- `backend/app/models/document.py:8-16` — `DocumentMetadata` (the fixed field set: title/author/date/document_type/topics/language/summary — workstream 1)
- `backend/app/api/documents.py:1369` — `exclude_none=True` (why a missing author is correctly omitted — proves "author disappeared" is not a regression)
- `backend/app/core/config.py:624` — the hardwired `gpt-4o` global default that extraction currently rides on (workstream 3)
- Related seeds: [[SEED-020]] (retrieval quality), [[SEED-033]] (citation/attribution), [[SEED-040]] (model-registry self-service), SEED-012 (admin/operator UI). The original Tier A items 1 and 3 above are the direct beneficiaries of workstream 1.

### Scope of this update
**Medium** — workstreams (2) and (3) are small, surgical backend changes (lift a window cap; thread `user_settings` / an admin setting into one `get_llm_client()` call). Workstream (1) is the larger piece: making the field set configurable means moving off a fixed Pydantic model toward a user/admin-defined schema, plus UI to manage fields and surface per-field confidence — that part composes with the admin model UI (SEED-040 / SEED-012) and is the natural lead-in to a dedicated metadata-enrichment phase whenever the DM layer is next scoped.

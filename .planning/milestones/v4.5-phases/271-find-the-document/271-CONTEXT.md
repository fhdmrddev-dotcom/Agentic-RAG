# Phase 271: Find the Document - Context

**Gathered:** 2026-10-03
**Status:** Ready for planning — ⚠ **G-2 override: `/gsd:sketch` is REQUIRED before `/gsd:plan-phase`** (operator chose "discuss now, sketch before plan").

<domain>
## Phase Boundary

A person who knows a document exists finds it **by what it is** (type, owner, dates, custom fields, folder path, relationships, version state) in a **document search** that sits beside the answer (RAG) search and returns **one row per document**. The classification rules surface moves inside the Library under a name people recognise. Requirements: FIND-01, FIND-02, FIND-03, FIND-06. Depends on Phase 270 (file facts join the searchable dimensions).

Out of scope: agent-side filters (Phase 272), permissions derived from metadata (SEED-211), SEED-224's five-tab redesign, saved-search/View creation from a search.

</domain>

<decisions>
## Implementation Decisions

### Where the two searches live (FIND-02)
- **D-01:** Document search is a **mode switch on the Library Documents tab** — a segmented control `Find documents | Ask`, with the search bar + filter builder at the top of Documents. **No sixth Library tab** (`D-217-15` stays intact; `TAB_LABELS` keeps its five keys).
- **D-02:** **Ask** leaves the Library and hands the question to chat RAG. No passages are ever rendered inside the Library, and no result list is ever a merge/re-rank of the two modes.
- **D-03:** **Find** shows a visible, changeable **field sort** ("Sorted by: Modified (newest)") plus a quiet line stating it is an exact field match with no AI ranking. Backend makes **no embedding call** in this path (assert in a test).

### Relationship filter (FIND-03)
- **D-04:** Filter rows are **verb + document picker**: `Supersedes ▾ [pick doc]`, `Referenced by ▾ [pick doc]`, covering **both directions** and all four stored `rel_type` values (`supersedes`, `amends`, `references`, `attached_to`; source→target in `document_relationships`). Picker reuses the Phase 117 typeahead and its inverse labels.
- **D-05:** The failure to guard: a relationship filter that matches outgoing links only.

### Version-state filter (FIND-03)
- **D-06:** **Default = "Latest versions"** (`is_latest = true`, same as the Library list; keeps one row per document). Explicit choices: **Latest only / Has earlier versions / Superseded**. "Superseded" shows non-latest rows on purpose; no state may ever hide the latest row.
- **D-07:** ⚠ "Superseded" (version lineage, `is_latest=false`) vs the `supersedes` **relationship** are two different facts. Research must define each precisely and the UI must label them so they cannot be confused.

### Rules surface rename + home (FIND-06)
- **D-08:** Classification is renamed **"Filing rules"**.
- **D-09:** It mounts as a **secondary link in the Library header** opening a sub-view of the Library (not a sixth tab). The rail entry (`nav-items.ts:41`, `Wand2`, "Classification") is **removed**. The `classification-rules` `ActiveView` member and `ChatLayout.tsx:943` mount must be retired or re-pointed **consciously**, with `activeViewReachability.ts` kept green (no dead union member, no stale nav entry). Every existing rule still loads and still applies to a new upload.

### Claude's Discretion
- Result-row columns, default sort field and sortable set, pagination, row-click behaviour (open the Phase 270 detail panel is the expected default).
- Backend endpoint shape, and whether the existing `view_filter_compiler.py` / `document_view_resolver.py` are extended or wrapped. **Reuse the shipped compiler and typed columns (`date_typed`, `document_type_norm`, migration 074) before adding any.** Migration probably none; if needed, next free number.
- Filter-builder composition: reuse the Phase 114 no-DSL builder; do not invent a second one.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase and requirements
- `.planning/ROADMAP.md` §Phase 271 — goal, 5 success criteria, failure criteria, Flags (G-2/G-4/G-5 audit list)
- `.planning/REQUIREMENTS.md` — FIND-01, FIND-02, FIND-03, FIND-06
- `.planning/phases/270-the-document-as-an-object/270-CONTEXT.md` — file facts that become searchable dimensions

### Seeds
- `.planning/seeds/SEED-243-find-the-document-not-just-the-answer.md` — §decide 1-3; ⚠ permissions fork SEED-211 is out of scope
- `.planning/seeds/SEED-005-document-management-capabilities.md` — Tier A

### Hot files (G-5 — read `docs/HOT-FILE-LEDGER.md` section for each BEFORE planning)
- `frontend/src/pages/LibraryPage.tsx` (FIRES), `frontend/src/components/layout/ChatLayout.tsx` (FIRES), `frontend/src/App.tsx` (`ActiveView` union), `frontend/src/lib/nav-items.ts`, `backend/app/api/documents.py`, `backend/app/api/classification_rules.py`, `frontend/src/components/classification/RuleBuilderPanel.tsx`, `frontend/src/components/ingestion/{FolderTree,NavRow,ViewsGroup}.tsx`, `frontend/src/types/index.ts`, `frontend/src/lib/api/*` (add to a module, never the barrel)

### Design
- `Skill("sketch-findings-agentic-rag")` — Phase 112/114/117/118 findings (builder, ViewsGroup NavRow, relationships typeahead, rules surface)
- `frontend/src/lib/activeViewReachability.ts` — AST fence on ActiveView ↔ ChatLayout

### Data
- `supabase/migrations/071_dm_foundations.sql` — `document_relationships`, `classification_rules`, `document_views`
- `backend/app/services/view_filter_compiler.py`, `document_view_resolver.py`, `document_relationship_service.py`, `metadata_field_service.py`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `view_filter_compiler.py` + `document_view_resolver.py`: shipped metadata filter compile/resolve (resolver already filters `is_latest`).
- Phase 114 no-DSL filter/view builder; Phase 117 relationships typeahead picker; `DocumentList.tsx` (list + `SHED_COLUMNS_3_TO_5` fixed-column contract); Phase 270 detail panel + file facts.
- `ClassificationRulesPage.tsx` (201 L) + `RuleBuilderPanel.tsx` (440 L): existing surface, only needs a name and a home.

### Established Patterns
- Library header is ONE row (`LibraryHeaderBar.tsx`): title, tabs, queue pill; five tabs derived from `TAB_LABELS`.
- `ActiveView` is fenced by an AST reachability check; removing a member must be deliberate.
- Realtime is a hint; reconcile by fetch. Blocking I/O wrapped in `run_in_threadpool`.

### Integration Points
- Library Documents tab (mode switch); Library header (Filing rules link); `ChatLayout.tsx:943`; `nav-items.ts:41`; `documents.py` or a new router for the search endpoint (RLS path, two-org fence per SC#5).

</code_context>

<specifics>
## Specific Ideas

- Mode labels: **Find documents** | **Ask**. Sort line: "Sorted by: Modified (newest)".
- Name: **Filing rules**.
- G-4 lived-experience scenarios still to be defined with the operator at sketch time (e.g., find a 2019 contract by type+owner+date without a phrase; "what supersedes X"; locate Filing rules without being told).

</specifics>

<deferred>
## Deferred Ideas

- "Has any relationship / has none" orphan filter — offered, not selected.
- Save a search as a View — not discussed; belongs to its own phase if wanted.
- Result columns, sort fields and pagination were left to Claude's discretion.

### Reviewed seeds
- `SEED-243`, `SEED-005` named by the roadmap Flags and folded (sweep matched 0 by trigger because no plans exist yet).

</deferred>

---

*Phase: 271-Find the Document*
*Context gathered: 2026-10-03*

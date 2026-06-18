# Phase 114: Virtual Folders — Range/Date Filters + View Builder + Sidebar - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

The phase that **completes virtual folders end-to-end** — both the remaining backend operators and the entire net-new UI. Phase 113 shipped the data model + the closed-registry filter-AST compiler + per-viewer leak-safe resolution for `eq`/AND/folder-scope. Phase 114 lands:

1. **Backend — the additive operator set + typed indexed columns.** Register `gte`/`lte`/`one_of`/`contains`/`is_empty` + relative-date operators into the existing `OPERATOR_REGISTRY` *via the documented Phase 114 seam* (`view_filter_compiler.py:79`), and **promote the hot `date` + `document_type` fields to typed, btree-indexed columns** so range/date comparisons use an index (not a lexically-lowercased JSONB seq scan). VIEW-03.
2. **Frontend — the guided no-DSL view/filter builder (net-new; G-2 sketch FIRES).** An inline condition builder on the Documents page with a live result count + a "Save as view" flow.
3. **Frontend — saved views rendered in the sidebar** as a distinct "Views" group that reads as *saved queries, not droppable folders*.

**Requirements:** VIEW-03 (from ROADMAP; **no SPEC.md** for this phase). UX-01 + UX-02 are cross-cutting acceptance (Aether Deep Midnight, mobile-responsive, WCAG 2.1 AA; sketched + operator-approved before implementation). ROADMAP Success Criteria SC#1–4 are the authoritative acceptance bar — see `.planning/ROADMAP.md` §"Phase 114".

**Explicitly NOT in this phase:** the agent-tool that runs a view in chat → **Phase 115** (carries its own SC#10 4-axis cross-provider UAT). Nested OR/NOT boolean trees and metadata→pseudo-folder grouping levels → deferred (REQUIREMENTS "Deferred", ship flat AND-list first). User-created *shared* views (a real "share my view" path) → out of v3.0 scope (globals stay seed-only).

</domain>

<decisions>
## Implementation Decisions

### Builder surface & authoring flow
- **D-114-1 (Inline filter bar + "Save as view" — ONE surface for ad-hoc and saved):** The builder is an **inline condition bar on the Documents page**, not a modal or a separate page. The user composes rows (field → type-aware operator → value, all ANDed), the document list filters live, and a **"Save as view"** action persists the current filter as a named view. Selecting a saved view in the sidebar **loads its filter back into the same bar** (and resolves its contents). Ad-hoc filtering and saved views are the *same* mental model — ad-hoc filtering is a free byproduct. (Rejected: a modal — breaks the app's "push, never overlay" pattern, sketch decision #20; a dedicated builder panel — fragments filtering into two places.)
- **D-114-2 (Live debounced match count while building):** As conditions change, show **"N documents match"** (debounced; the Phase 113 resolve endpoint already returns a total `count`). Immediate feedback makes a no-DSL builder trustworthy — the user sees too-narrow/too-broad before saving. The same resolve path drives both the live preview and the saved-view open.
- **D-114-3 (Views are mutable — edit in place):** Editing a saved view reopens the filter bar pre-filled and **PATCHes the same view row** (the Phase 113 `PATCH /document-views/{id}` route already exists). A saved view is a personal convenience, edited as freely as a folder rename — NOT an immutable published artifact (no save-as-copy/version semantics; that model is for workflows).

### Date operators & relative-date semantics (VIEW-03 core)
- **D-114-4 (Operator vocabulary: relative + fixed + range):** Date fields offer **relative** operators — *"within next N days"* and *"older than N days"*, **recomputed live each time the view resolves** (so a relative view drifts with the calendar) — **plus** fixed *before/after a date* **plus** *between two dates*. Covers expiry, document age, and explicit windows. (Not just fixed dates — that would drop the "expiring within N days" headline; not the full "within last N days / next N months" superset — additive later if asked.)
- **D-114-5 ("Expiring within N days" = upcoming-only):** *"within next N days"* resolves to **today → today+N** and **excludes already-past-due** documents. "Expiring within 90 days" reads as "coming due soon," not "overdue + soon." (If a "needs attention incl. overdue" view is later wanted, that's a different operator, not a redefinition.)
- **D-114-6 (Promote `date` + `document_type` to typed indexed columns; cast the rest):** The two SC#1-named **hot** fields — the built-in `date` and `document_type` — are promoted to **typed, btree-indexed columns** (the indexed fast path that satisfies SC#3 `EXPLAIN` index-use at ~10k docs). **Custom** date/number fields (per-user `metadata_field_definitions`, stored in `documents.metadata` jsonb) remain filterable via a **safe `(metadata->>'field')::type` cast** — correct but non-indexed (no per-user-column explosion; they're not the "hot" path). No new "expiry date" built-in is introduced in this phase (that would be a metadata-schema decision and would obligate Phase 111 extraction changes — see Deferred).

### Sidebar render-as-folder
- **D-114-7 (Distinct "Views" group + funnel icon + no drop target + reuse the `G` pill):** Saved views render under a **"Views" group header below "Folders"** in the existing Documents sidebar. Each view row uses a **funnel/filter icon** (vs. the amber folder icon) so it reads as a saved query at a glance, **rejects drag-drop file moves** (no drop highlight — you cannot "put a file into" a query), and seeded global views **reuse the existing `G` pill** (`FolderNode.tsx:183`). Mirrors the folder selection/active-state styling so it feels native.
- **D-114-8 (Per-view count badge — lazy/cached):** Each view shows a document count (**"Invoices · 47"**, the D-113-1 intent). Because each count is a resolve, fetch **lazily + cache**, and refresh when the view is opened. Research confirms this does not degrade the sidebar at ~10k docs (SC#3) — if N-views×resolve is too heavy, a cheaper count path (or on-demand-only) is the fallback.
- **D-114-9 (View actions mirror the folder hover menu):** A view row exposes the same hover `MoreHorizontal` menu shape as `FolderNode` — **Edit** (reopens the filter bar pre-filled), **Rename**, **Delete** — minimal net-new UI, consistent with folders.

### Matching semantics (the case question Phase 113 deferred — D-113-11)
- **D-114-10 (Text matching is case-INSENSITIVE):** `document_type` equality, `contains`, and `one_of` all match **case-insensitively** — model-extracted metadata varies in case ("Invoice" vs "invoice"), and D-113-11 explicitly warned views read **empty** otherwise. The promoted `document_type` column compares case-insensitively (`lower()` functional index or `citext`); `contains` uses `ILIKE`; `one_of` membership is case-insensitive. Filters "just work" on real extracted data. **⚠ See the research flag below — this softens D-113-6's "eq path untouched" promise for non-promoted text fields.**
- **D-114-11 (`contains` = substring / `ILIKE %v%`):** "report" matches "Annual Report 2025". Simple and expected. (Not whole-word/token matching.)
- **D-114-12 (`is_empty` = absent OR empty value):** A field the model never extracted (key absent) **and** a field set to `''`/`[]` both count as empty — e.g. "docs missing an author". Matches the user's intuition of "empty," not just key-absence.

### ⚠ Flagged for research / planning (NOT user-decided — reconcile during RESEARCH.md)
- **R-114-A (Case-insensitivity vs. the Phase 113 `@>` fast-path):** Phase 113 compiles `eq` into one `metadata @> $1::jsonb` containment dict, which is **case-SENSITIVE**. Making text equality case-insensitive (D-114-10) means non-`document_type` text `eq`/`contains`/`one_of` likely move **off** `@>` to parameterized `lower(metadata->>'f') = lower($n)` / `ILIKE` cast fragments. This **touches the `eq` path** for non-promoted fields — softening D-113-6's "purely additive, `eq` untouched, no compiler rewrite" promise. **The compiler output shape itself must evolve** from "one `@>` dict" to "a set of parameterized WHERE fragments" (the `@>` equality fast-path stays valid only where case-sensitive exact is acceptable). Researcher: design the WHERE-fragment output contract, decide whether `@>` survives as an optimization for any field, and **update Phase 113's case-sensitive `eq` unit tests to the new contract** (expect intentional behavior changes there).
- **R-114-B (Typed-column sync model):** How do the promoted `date`/`document_type` columns stay in sync with `documents.metadata`? Candidates: Postgres `GENERATED ALWAYS AS (...)` stored columns computed from `metadata->>'...'` with a **safe/error-tolerant date cast** (a bad date string must not break inserts), a trigger, or application dual-write. Confirm the cheapest correct option and the backfill for existing rows. This is the one genuine new migration in the phase.

### Claude's Discretion
- Exact filter-bar layout/affordances, the per-field-type operator menu rendering, the relative-date input control (number + unit), and the "Save as view" naming/scope (name + optional `folder_scope`) micro-flow — resolved by the **G-2 sketch**.
- Whether the live count uses the existing resolve endpoint as-is or a lighter count-only variant.
- The precise icon choice for the funnel/filter affordance and the empty-state copy for the Views group.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & success criteria (read FIRST — no SPEC.md for this phase)
- `.planning/ROADMAP.md` §"Phase 114: Virtual Folders — Range/Date Filters + View Builder + Sidebar" — authoritative goal, VIEW-03, and SC#1–4 (relative-date correctness across month/day boundaries via typed indexed columns; guided no-DSL builder; sidebar "Views" group with a saved-query affordance reusing the global-folder indicator; `EXPLAIN` index-use at ~10k docs; Aether/mobile/WCAG AA).
- `.planning/REQUIREMENTS.md` — VIEW-03 (line 37); **UX-01** (line 59 — Deep Midnight/Aether, mobile, WCAG 2.1 AA, reuse `ConfidenceChip`/`MoveToFolderDialog`/`FolderNode` inline-edit/`HealthPanel`, state-based `ActiveView` nav, no react-router) and **UX-02** (line 60 — view/filter builder is one of the three sketch-before-plan surfaces). Deferred list (line 62): OR/nested-boolean + grouping levels are explicitly out — flat AND-list first.

### Phase 113 backend seam (the additive base — read before touching the compiler)
- `backend/app/services/view_filter_compiler.py` — the closed `OPERATOR_REGISTRY` + `@register_operator` decorator + `compile_filter` + `validate_fields`. **The "Phase 114 SEAM" comment at line 79** documents the additive-import hook. Today: `eq` only → folds into one `@>` dict. (See R-114-A — the output shape must widen for WHERE-fragment operators.)
- `backend/app/models/document_view.py` — the `ViewFilter` / `ViewCondition` AST (flat `op:"and"` + condition list; `field`/`op`/`value`). 114 adds operators, **not** a new AST shape (D-113-6).
- `backend/app/api/document_views.py` — CRUD + `GET /document-views/{id}/resolve` (per-viewer leak-safe; `_build_whitelist` at :72; `resolve_view` at :201; `_apply` query builder at :251). The resolve route binds the compiled filter and applies `folder_scope`. 114 extends the resolve query with the new operators' WHERE fragments + the live-count path.
- `backend/app/services/document_view_service.py` — view CRUD service (own-scoped, `is_global=false` forced).
- `backend/app/models/metadata_field.py` — **the field whitelist + types.** `_BUILTINS = {title, author, date, document_type, topics, language, summary}` (line 17); `field_type ∈ {string, date, number, boolean, enum}` (line 26). The compiler validates `field` against built-ins ∪ enabled custom defs; `_`-prefixed keys are never filterable.
- `backend/tests/unit/test_113_view_filter_compiler.py` — Phase 113's compiler tests (incl. the SC#4 injection test + case-sensitive `eq` assertions). **R-114-A: these eq tests change** under case-insensitive matching — update to the new contract, keep the injection/SSTI test green.
- `supabase/migrations/071_dm_foundations.sql` — `document_views` DDL + RLS (own+global SELECT, INSERT/UPDATE force `is_global=false`, DELETE own) + `view.create` audit action. The **typed-column promotion (R-114-B) is the phase's new migration** (`<NNN>_name.sql` under `supabase/migrations/`; apply via the SQL editor, then `bash scripts/regenerate-full-schema.sh` — per CLAUDE.md, never `db push`/`db reset`).

### Phase 113 decisions to honor
- `.planning/phases/113-virtual-folders-filter-compiler-equality-views-backend/113-CONTEXT.md` — D-113-1 (complete listing newest-first + count; **custom sort deferred to the 114 builder** — see Deferred), D-113-4 (per-viewer leak-safe resolution; 404-not-403), D-113-6/7 (AST shape fixed; flat AND; `one_of` = OR-over-one-field), D-113-8 (closed registry + field whitelist + bound literals, no eval/interpolation), D-113-11 (case deferred to 114 — **now decided D-114-10**).

### Frontend sidebar + reusable primitives
- `frontend/src/components/ingestion/FolderTree.tsx` — the Documents sidebar: "Folders" header + Root node + recursive tree; selecting a folder filters the list. **Add the "Views" group here.**
- `frontend/src/components/ingestion/FolderNode.tsx` — the folder row: selected/active styling, the **`G` global pill (line 183)**, the hover `MoreHorizontal` action menu (rename/make-global/delete), inline rename, inline delete-confirm. **The view row mirrors this shape** (funnel icon, no drop target, Edit/Rename/Delete).
- `frontend/src/components/metadata/InlineEdit.tsx` (+ `InlineEdit.test.tsx`) — the `FolderNode`-pattern inline-edit primitive (UX-01 reuse candidate for naming a view).
- `frontend/src/types` (`Folder` type, `ActiveView` union) — the state-based nav (no react-router) the Documents page already uses.

### Design direction (G-2 sketch grounding — read before sketching)
- `./.claude/skills/sketch-findings-agentic-rag/SKILL.md` + `.planning/sketches/MANIFEST.md` — the locked Aether Deep Midnight theme + decisions #20 (right-side push/split detail panel — the "push, never overlay" rule that ruled out a modal builder), #27/#28 (Phase 112 document-detail shell + `ConfidenceChip`/inline-edit honesty patterns). **No view-builder sketch exists yet** — the manifest ends at 028 (Phase 112). The 114 builder + sidebar sketch is net-new (G-2).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`view_filter_compiler.py` + `OPERATOR_REGISTRY`** — register the new operators additively via the line-79 seam (with R-114-A's output-shape evolution).
- **`document_views.py` resolve route + `_apply` query builder** — extend with WHERE fragments + typed-column comparisons + the live-count path.
- **`FolderNode.tsx` / `FolderTree.tsx`** — clone the row shape, active-state styling, `G` pill, and hover menu for the "Views" group.
- **`InlineEdit.tsx`** — view naming/rename.
- **`MoveToFolderDialog` document-picker pattern** (UX-01 named reuse) — not central here but part of the DM primitive set.
- **Phase 113 resolve `count`** — already returned; drives both the live builder preview (D-114-2) and the sidebar count badge (D-114-8).

### Established Patterns
- **Closed-registry dispatch** (`@register_operator`) — new operators register by side-effect import; an unregistered op fails closed (`KeyError`).
- **Bound-literal parameterization** — `$n` placeholders / supabase-py `.contains()`/filter builders; **no f-string SQL, no string interpolation of field names or values** (SC#4 invariant — the injection test stays green).
- **`_`-prefixed keys excluded; field-whitelist enforced at save** (D-111-9 / D-113-8).
- **Per-viewer leak-safe resolution; 404-not-403** on a non-visible view id (D-113-4).
- **`run_in_threadpool`** around every sync supabase-py call in async routes (D-v2.5-01).
- **State-based `ActiveView` nav, no react-router** (UX-01).

### Integration Points
- The new migration promotes `date` + `document_type` to typed indexed columns (R-114-B) — the only schema change.
- The resolve route + compiler gain the additive operators (backend); the Documents page gains the inline filter bar + the sidebar "Views" group (frontend).
- The filter bar's live count and the sidebar count badge both call the existing resolve endpoint (or a lighter count variant).

</code_context>

<specifics>
## Specific Ideas

- **"Filters just work on real data" is the load-bearing goal** — case-insensitive matching (D-114-10) is what stops views reading empty on model-extracted metadata; it's the whole point of the deferred D-113-11 decision landing here.
- **Honest sidebar affordance** — a view is a *query*, so it must not look or behave like a drop target. The funnel icon + rejected drop + reused `G` pill carry that honesty (the same "honest about each thing's real nature" spirit as the chat tool-card and confidence-chip work).
- **One surface, two uses** — the inline filter bar IS the builder; "Save as view" just persists what you're already looking at. This avoids a second filtering mental model on the Documents page.
- **The compiler was built in 113 to absorb this** — but case-insensitivity (R-114-A) is the one place the "purely additive" promise bends; treat that as a deliberate, tested contract change, not a silent regression.

</specifics>

<deferred>
## Deferred Ideas

- **Custom sort / sort-by-metadata-field on a view's listing** — D-113-1 nominally pointed this at "the 114 builder," but ROADMAP SC#114 doesn't list it. **Default for 114: newest-first only** (`created_at desc`). Sort-by-field deferred to a later polish phase unless the operator pulls it in (offered at discuss; operator chose "ready for context" = keep deferred).
- **A first-class "expiry / effective date" built-in metadata field** — would make "expiring" first-class but obligates Phase 111 extraction changes; out of scope for 114 (filter on whatever date field the user picks; built-in `date` is the indexed fast path). Re-open if a recurring expiry use-case justifies a schema field.
- **Nested OR/NOT boolean trees + metadata→pseudo-folder grouping levels** — explicitly deferred in REQUIREMENTS ("ship flat-list + AND first"); `one_of` covers OR-over-one-field. Re-open only on a stated requirement.
- **User-created shared/global views ("share my view")** — globals stay seed-only in v3.0 (no user share path; D-113-3). Would require a deliberate RLS + leak-safe share-flow change.
- **Stale-field governance signal** (a saved view references a since-deleted custom field) — Phase 119 (Document Governance Health); the 114 builder may surface a soft warning if the optional 113 `stale_fields` hook lands.
- **Agent-tool resolution of a view in chat** — Phase 115 (registry + advertised `get_tools` schema; SC#10 4-axis cross-provider UAT lives there).

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` (todo.match-phase score 0.6, matched only on the keywords "real/date/before") — an NL→workflow-authoring spike, unrelated to virtual-folders filtering. **Not folded** (same call as Phase 113).

### Reported-bugs cross-check (MANDATORY, Agentic-RAG surface)
- 7 open `surface: Agentic-RAG` reports reviewed (chat/composer silent-send-drop, harness/panel run-honesty BUG-260609-02/-04 + BUG-260610-01, PM-pack/provider-forcing, minimax tool-args 400, setting-up-agent banner). **None overlap** Phase 114's domain (virtual folders / Documents sidebar / view builder) → **none folded, all left open.**

</deferred>

---

*Phase: 114-virtual-folders-range-date-filters-view-builder-sidebar*
*Context gathered: 2026-06-19*

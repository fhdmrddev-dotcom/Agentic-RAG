# Phase 113: Virtual Folders — Filter Compiler + Equality Views (Backend) - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

The backend foundation for **virtual folders** — saved, metadata-driven views that act like folders but are **queries, not copies** (one document appears in many views with zero duplication). Phase 113 lands two things:

1. **The saved-view data model wiring** — CRUD + resolution over the already-live `document_views` table (migration 071): a view = `name` + `filter_expr jsonb` + optional `folder_scope`, owner-private (`is_global=false` forced for end users).
2. **The one genuinely net-new component** — a **filter-AST → parameterized-SQL compiler** with a *closed operator registry*, a *field whitelist*, and *all literals bound as parameters* (no eval, no string interpolation of field names or values). Phase 113 implements **equality (`eq`) + AND + folder-subtree scope** only.

**Backend only** (ROADMAP "UI hint: no"). The view/filter **builder UI + sidebar render** are Phase 114; **range/date/relative-date/one-of/contains operators + typed indexed columns** are Phase 114; the **agent-tool** that runs a view in chat is Phase 115.

**Requirements (from ROADMAP — no SPEC.md):** VIEW-01, VIEW-02, VIEW-04, VIEW-05, VIEW-06. ROADMAP success criteria (SC#1–4) are the authoritative acceptance bar; see `.planning/ROADMAP.md` §"Phase 113".

</domain>

<decisions>
## Implementation Decisions

### View output & resolution path
- **D-113-1 (Complete listing, not ranked search):** Opening a saved view resolves to a **complete listing of all matching latest-version documents** — NOT a ranked/similarity-capped top-K. Returned as `DocumentResponse` rows (the same shape `GET /documents` / `list_documents` already returns), **newest-first** (`created_at desc`), with a **total count** (so the 114 sidebar can show "Invoices · 47"). Custom sort options deferred to the Phase 114 builder.
- **D-113-2 (Reuse the predicate seam, NOT the vector tool):** Resolution reuses the existing `documents.metadata @> filter` + `folder_id = ANY(<subtree>)` **predicate** over a plain `documents` listing query (mirroring `list_documents` at `documents.py:535`, extended with the metadata filter + folder-subtree scope). It does **NOT** call the vector `match_document_chunks` RPC — a virtual folder has no query string, needs no embedding round-trip, and must return *all* matches (not a similarity-capped subset). The ROADMAP SC#1 phrase "resolves through `search_documents(metadata_filter, folder_ids)`" is read as **"reuse that filter/scope predicate seam,"** not "invoke the agent's semantic-search tool."

### Sharing / global views (v1 scope) — leak-safety
- **D-113-3 (No user share path; globals are admin/seed-only):** v1 has **no user-facing "share my view" path**. The migration-071 RLS already forces `is_global=false` on every end-user INSERT/UPDATE, so global views can only be **service-role / migration-seeded** — exactly like global folders and global skills. A user's own views are private to them. (If product later wants user-created shared views, that's a deliberate future RLS + share-flow change — see Deferred.)
- **D-113-4 (Per-viewer resolution = the leak-safe model):** Resolving **any** view (including a seeded global one) scopes the documents query to **the CALLER's own visible set** (the caller's own docs + the caller's globally-visible-folder docs), applies `filter_expr`, and returns the caller's matches. Two users open the same global view and see **different result sets** — each sees only their own documents. No cross-user content / count / facet / existence leakage. A request for a view id the caller can't see returns **404, not 403** (no existence leak). This is verified **live in secure-phase** (the real leak test against :54322, not the RLS policy label — the D-102/D-110-5 "static would false-green" lesson).
- **D-113-5 (Unreachable `folder_scope` → silently ignored):** If a (global) view's `folder_scope` points at a folder the caller can't see, it **contributes no narrowing** (the view resolves over the caller's full visible set) rather than erroring or resolving empty. Seeded global views normally use `folder_scope=NULL` (whole visible set) or a global folder.

### Saved-filter format (forward-compatible shape, minimal implementation)
- **D-113-6 (Explicit condition-list AST, designed once):** `filter_expr` stores an **explicit condition-list AST**, not a bare equality map:
  ```json
  { "op": "and",
    "conditions": [
      { "field": "document_type", "op": "eq", "value": "invoice" },
      { "field": "author",        "op": "eq", "value": "Acme" } ] }
  ```
  Phase 113 implements **only** `and` (combinator) + `eq` (operator); the closed registry **rejects** any other op. Phase 114 registers `gte`/`lte`/`one_of`/`contains`/`is_empty`/relative-date operators **purely additively** — the stored shape never changes, so 114 needs **no data migration of live view rows and no compiler rewrite** (the "safe-by-construction, root-cause-not-band-aid" payoff).
- **D-113-7 (Flat AND-of-conditions; no nested OR/NOT):** Keep it a flat AND-of-conditions list. **No nested boolean trees (OR/NOT)** — 114's requirement set (equals / one-of / contains / is-empty / numeric & date) is fully covered, with `one_of` handling the "OR over one field" case. Nesting would be real complexity for no stated requirement.

### Compiler safety (the net-new component)
- **D-113-8 (Closed registry + field whitelist + bound literals — no eval/interpolation):** The compiler is a **closed operator registry + field whitelist**. Field names are validated against **(built-in metadata keys ∪ enabled `metadata_field_definitions`, own+global)**; `_`-prefixed keys (`_confidence`, `_source`) are **excluded** — they are display-only sub-keys, **never filter dimensions** (the load-bearing **D-111-9 / D-112-D02** invariant). All literals are **bound as parameters** — for the `eq`-only path that means building the `metadata_filter` jsonb bound as a single `$1` for `metadata @> $1::jsonb`; 114's WHERE-clause operators bind per-literal `$n`. **No `eval`, no string interpolation of field names OR values.** An injection/SSTI payload in a filter value is neutralized by parameterization (ROADMAP SC#4) — this is a **first-class test**, not an afterthought.

### Edge & matching behaviors
- **D-113-9 (Empty filter = no narrowing, valid):** An empty `conditions` list is **valid** and means "no metadata narrowing" → the view resolves to all docs in `folder_scope` (a folder alias) or all visible docs if no scope. Not rejected. (The table default is `'{}'::jsonb`, so graceful handling is required regardless.)
- **D-113-10 (Unknown field — reject at save, tolerate at resolve):** On **save/update**, every `field` is validated against the live whitelist; an unknown field **rejects the write** with a clear error (publish-time validation, safe-by-construction). A field that was valid at save but **later deleted** (custom field def removed) naturally **matches zero docs** via `@>` at resolve time — **non-fatal**, no error, no leak. *Optional forward hook:* include a `stale_fields` / `warnings` note in the resolve response so Phase 119 governance and the 114 builder can flag it (small, optional in 113).
- **D-113-11 (Case-sensitive exact equality for v1):** Equality uses `metadata @>` JSONB containment = **case-SENSITIVE exact match** ("Invoice" ≠ "invoice"). Case/normalization handling waits for **Phase 114's typed, indexed columns** — lowercasing JSONB strings in 113 would be the exact seq-scan anti-pattern Phase 114 SC#1 explicitly forbids. Accept case-sensitive exact in 113. *(Risk noted: model-extracted metadata may vary in case → some views read empty until 114; acceptable for the backend-equality phase.)*

### API surface & migration posture
- **D-113-12 (113 owns persistence + resolution):** Phase 113 delivers view **CRUD** (owner-scoped `POST/GET/PATCH/DELETE` on a `document_views` router, `is_global=false` forced, `view.create` audit row on create) **+ a resolve endpoint** (`GET /document-views/{id}/resolve` returning the complete listing + count). Exact route names/shape are planner discretion; the builder UI + sidebar are 114, the agent tool is 115.
- **D-113-13 (No new SQL migration):** `document_views` table + `view.create` audit action already live (migration 071, applied to :54322). Phase 113 is **purely additive** — compiler module + view CRUD/resolve routes + Pydantic models + tests. **Performance/indexing (`EXPLAIN` index-use at ~10k docs) is explicitly Phase 114's SC**, achieved via typed columns; 113 correctness does not require a new index. *(Research should confirm no index gap blocks correctness — `@>` works without a GIN index, just slower at scale; if a cheap GIN-on-`documents.metadata` add is warranted it's the only candidate migration, not assumed.)*

### UAT scope
- **D-113-14 (SC#10 4-axis UAT does NOT apply):** Phase 113 touches **none** of streaming / agent loop / provider routing / UI state — so the mandatory SC#10 cross-provider 4-axis UAT does **not** apply (same reasoning as Phase 112 D-08). Acceptance = backend unit tests (compiler: equality/AND/folder-scope correctness + the **injection/SSTI** neutralization test) + **live :54322 integration** + the **live cross-user global-view leak test in secure-phase**. The agent-tool cross-provider UAT is **Phase 115's** gate.

### Claude's Discretion
- Exact route paths/verbs and whether resolve is a dedicated endpoint vs. a query param on list (single resolve endpoint is the contract; planner may refine).
- Whether the compiler emits a `metadata_filter` jsonb that rides the existing `@>` containment, vs. an equivalent `metadata @> $1::jsonb` WHERE fragment — both are parameterized; pick whichever composes cleanest with 114's additive operators.
- Pydantic model layout for the AST (a `ViewCondition` + `ViewFilter` pair) and the operator-registry mechanism (mirror the harness `@register_validator` / `validator_kinds.py` side-effect registration pattern is encouraged but not mandated).
- Whether to ship the optional `stale_fields` resolve-warning in 113 or defer it wholesale to 119.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & success criteria (read first — no SPEC.md for this phase)
- `.planning/ROADMAP.md` §"Phase 113: Virtual Folders — Filter Compiler + Equality Views (Backend)" — the authoritative goal, requirements (VIEW-01/02/04/05/06), and Success Criteria SC#1–4 (query-not-copy, equality/AND/folder-scope + closed-registry/field-whitelist/`$n`-bound, per-viewer leak-safe global sharing + 404-not-403, injection/SSTI neutralized).

### Data model & schema (already live on :54322)
- `supabase/migrations/071_dm_foundations.sql` — the `document_views` table DDL (`name`, `filter_expr jsonb DEFAULT '{}'`, `folder_scope uuid ON DELETE SET NULL → folders`, `is_global`, `org_id` no-FK) + its 4 RLS policies (SELECT own+global; INSERT/UPDATE **force `is_global=false`**; DELETE own) + the `view.create` audit action (enum 11→19).
- `supabase/full-schema.sql` §`match_document_chunks` / `keyword_search_chunks` (≈lines 93–133) — the live RPCs whose **`d.metadata @> metadata_filter` + `d.folder_id = ANY(p_folder_ids)`** predicate is the seam to mirror in the listing resolver.

### Backend integration points
- `backend/app/api/documents.py:535` `list_documents` — the existing document-listing path (own docs + globally-visible-folder docs, `is_latest`, `created_at desc`, `DocumentResponse` shape) the view-resolve endpoint extends with the metadata filter + folder-subtree scope.
- `backend/app/services/retrieval_service.py` (`_vector_search`/`_keyword_search`, ≈lines 25–88) — how `metadata_filter` (dict) + `folder_ids` (list) are passed to the RPCs today; the parameter conventions to reuse.
- `backend/app/utils/folder_utils.py` (`get_globally_visible_folder_ids`) + `backend/app/api/kb.py` (`_collect_folder_ids` subtree BFS, ≈line 185) + `backend/app/api/folders.py:139` (subtree collection) + `backend/app/services/harness/scope.py` (folder-subtree → list, **Pitfall 1: a list, not a set — the RPC channel is JSON-serialized**) — the folder-subtree resolution patterns for `folder_scope`.
- `backend/app/services/audit_service.py` — `write_audit_entry` + `VALID_ACTION_TYPES` (already includes `view.create`); the audit write on view creation.
- `backend/app/api/metadata_fields.py` + `backend/app/services/metadata_field_service.py` + `backend/app/models/metadata_field.py` — the enabled custom-field definitions (own+global) = the **field-whitelist source** the compiler validates against.
- `backend/app/services/embedding_service.py` (≈line 239) — documents the boundary that `_confidence`/`_source` are DISPLAY-ONLY nested keys, **NEVER a flat `metadata_filter` dimension** (D-111-3/9); the compiler must exclude `_`-prefixed keys.
- `backend/app/services/harness/validator_kinds.py` + `backend/app/services/harness/freshness.py` — the in-codebase **closed-registry-with-side-effect-registration** pattern (`@register_validator`) and a safe **`$N`-placeholder parameterized KB query** (`ANY($1::uuid[])`, no f-string SQL) — strong analogs for the compiler's registry + parameterization.

### Prior-phase decisions to honor
- `.planning/phases/112-metadata-enrichment-document-detail-panel-manual-edit/112-CONTEXT.md` — D-02 (`_source`/`_confidence` flat sub-key shape) + the load-bearing **flat `@>` containment invariant (D-111-9)** the compiler must not break.
- `.planning/phases/110-dm-foundations/110-CONTEXT.md` + STATE.md D-110-5 — the DM RLS shape (`document_views` carries `is_global`; INSERT/UPDATE force `is_global=false`) and the "static-would-false-green → verify RLS leak-safety LIVE" lesson.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`list_documents` (`documents.py:535`)** — clone the own-docs + global-folder-docs + dedupe + `created_at desc` listing shape for the view-resolve endpoint; extend with the metadata filter + folder-subtree scope.
- **`get_globally_visible_folder_ids` / `_collect_folder_ids` BFS** — resolve `folder_scope` to a subtree `folder_ids` list (a list, never a set — Pitfall 1).
- **`write_audit_entry` + `VALID_ACTION_TYPES`** (`view.create` already valid) — the audit write on view creation.
- **`metadata_field_service`** — the field-whitelist source (enabled defs, own+global).
- **`aexec` / `run_in_threadpool`** — wrap every sync supabase-py call inside the async view routes (D-v2.5-01).
- **`DocumentResponse` model** — the view-resolve listing row shape (consistency with the Documents page).

### Established Patterns
- **Closed-registry dispatch** — mirror `harness/validator_kinds.py` `@register_validator` + side-effect registration (`from . import validator_kinds` in `__init__`) for the operator registry, so 114 operators register additively.
- **Parameterized KB SQL** — `harness/freshness.py` uses `ANY($1::uuid[])` `$N` placeholders, **no f-string SQL** — the model for the compiler's bound literals.
- **Flat `_`-sub-key + `@>` containment (D-111-9)** — filter only on top-level flat keys; exclude `_confidence`/`_source`.
- **RLS owner-scope → 404 (not 403)** on a non-owner/unauthorized id — no existence leak.
- **Force `is_global=false` on end-user writes** — globals are service-role/seed-only.

### Integration Points
- A new `document_views` router (CRUD + resolve) mounted in `main.py` (additive, no new registration pattern beyond existing routers).
- The resolve route composes the `list_documents`-style `documents` query + the compiler-produced `metadata @>` filter + the `folder_scope` subtree.
- The field whitelist is fetched from the `metadata_fields` service / `/metadata-fields` surface.

</code_context>

<specifics>
## Specific Ideas

- **The filter-AST → parameterized-SQL compiler is THE net-new component** — everything else composes shipped seams (the `@>` predicate, folder-subtree resolution, the listing path, audit, RLS). Build the compiler as a closed operator registry from day one so Phase 114's operators register additively with zero shape change.
- **Honesty/safety is load-bearing:** no `eval`, no string interpolation of field names OR values; field names whitelist-checked; `_`-prefixed keys excluded; literals always bound. The injection/SSTI test (SC#4) is a first-class acceptance, not an afterthought.
- **"search_documents" in SC#1 = reuse the predicate seam, not the vector tool** (D-113-2) — a virtual folder is a complete listing, not a ranked semantic search.
- **Leak-safety is per-viewer:** the same global view definition yields different result sets per caller; cross-user resolution must never touch the view owner's scope. Verify with a real two-user leak test live in secure-phase.

</specifics>

<deferred>
## Deferred Ideas

- **Range / date / relative-date operators, `one_of` / `contains` / `is_empty`, the view/filter builder UI, sidebar render-as-folder, typed indexed columns + `EXPLAIN` index-use, case normalization** → **Phase 114** (the AST shape is designed in 113 to absorb these additively).
- **Agent-tool resolution of a view in chat** → **Phase 115** (registry + advertised `get_tools` schema; SC#10 4-axis cross-provider UAT lives there).
- **User-facing "share my view" (user-created global/shared views)** → not in v3.0 scope as currently specced; would require a deliberate RLS change + a leak-safe share-creation flow. Re-open if product asks for peer-to-peer view sharing.
- **Stale-field governance signal** (a saved view references a since-deleted field) → **Phase 119** (Document Governance Health) links back via the resolve-time `stale_fields` hook.
- **Custom sort options / sort-by-metadata-field on a view's listing** → Phase 114 builder (113 ships newest-first only).

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` (todo.match-phase score 0.2, matched on the keyword "template" only) — an NL→workflow-authoring spike, unrelated to the virtual-folders filter compiler. **Not folded.**

</deferred>

---

*Phase: 113-virtual-folders-filter-compiler-equality-views-backend*
*Context gathered: 2026-06-18*

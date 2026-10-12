# Phase 271: Find the Document - Research

**Researched:** 2026-10-03
**Domain:** Document search by structured fields (FastAPI + supabase-py/PostgREST under RLS), React Library surface (FilterBar chip builder, DocumentList), IA re-home (ActiveView/nav)
**Confidence:** HIGH for the code facts below (each was read at HEAD `56630a65b`). MEDIUM for the recommended relationship and version semantics, which are design choices that need the planner (or the operator) to lock them.

## Summary

Most of what this phase needs already exists. The work is mainly composing those pieces and closing a few gaps. The shipped compiler (`view_filter_compiler.py`) and the leak-safe resolve core (`document_view_resolver.resolve_filter`) already filter by every metadata field, custom fields included, through bound PostgREST params. They scope from the caller using the same own-plus-global-folder legs the Library list uses. **What they cannot do today:** filter by folder path with subfolders as a *narrowing* (their `folder_scope` silently drops an unreachable scope, D-113-5), filter by relationship, filter by any version state other than latest, filter by name, "added by", or the three Phase 270 dates, sort by anything other than `created_at desc`, or page on the server. They also silently cap at PostgREST's 1000-row `max-rows`: `select("*")` has no `.range()`. **So a document search is a thin, FastAPI-free core *beside* `resolve_filter`.** It reuses the same `_apply` fragment walker (extracted, never forked), adds a closed set of tested "structure" conditions, and returns a sorted, server-paged, server-counted page. It makes no embedding call.

The frontend already has the builder (FilterBar + ConditionPopover). It already sits on the Documents tab, bound to the reducer's shared `lib.filter`, and resolves through `resolveAdHoc` with a `catch` that swaps in the unfiltered folder list on error. Find must route the Documents tab through the new endpoint and must not inherit that catch. The rules-surface move touches exactly three registers: the `ActiveView` member (`App.tsx:127`), the branch (`ChatLayout.tsx:943`) and the nav entry (`nav-items.ts:41`). It also turns **`nav-items.test.ts:59` RED** (`NAV_ITEMS.length >= 8` becomes 7) and touches one pure-function test list (`LibraryPage.initialTab.test.tsx:396`). Nothing else in the app navigates to `classification-rules`.

**Primary recommendation:** Add `backend/app/services/document_search_service.py`, a FastAPI-free core reusing the resolver's two visibility legs and an extracted `apply_fragments()`, plus a new router `backend/app/api/document_search.py` (`POST /document-search`, user-JWT client). Keep metadata conditions in the reducer's `lib.filter` (one source of truth). Hold the structure conditions, name, sort, mode and page in a new page-level leaf (`findState.ts` plus a `useDocumentFind` hook), composed at the `LibraryPage` boundary the way `SET_FOLDER_SHEET` is. Retire `classification-rules` in one commit and re-pin the nav count test at 7 with the reason.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Where the two searches live (FIND-02)**
- **D-01:** Document search is a **mode switch on the Library Documents tab** — a segmented control `Find documents | Ask`, with the search bar + filter builder at the top of Documents. **No sixth Library tab** (`D-217-15` stays intact; `TAB_LABELS` keeps its five keys).
- **D-02:** **Ask** leaves the Library and hands the question to chat RAG. No passages are ever rendered inside the Library, and no result list is ever a merge/re-rank of the two modes.
- **D-03:** **Find** shows a visible, changeable **field sort** ("Sorted by: Modified (newest)") plus a quiet line stating it is an exact field match with no AI ranking. Backend makes **no embedding call** in this path (assert in a test).

**Relationship filter (FIND-03)**
- **D-04:** Filter rows are **verb + document picker**: `Supersedes ▾ [pick doc]`, `Referenced by ▾ [pick doc]`, covering **both directions** and all four stored `rel_type` values (`supersedes`, `amends`, `references`, `attached_to`; source→target in `document_relationships`). Picker reuses the Phase 117 typeahead and its inverse labels.
- **D-05:** The failure to guard: a relationship filter that matches outgoing links only.

**Version-state filter (FIND-03)**
- **D-06:** **Default = "Latest versions"** (`is_latest = true`, same as the Library list; keeps one row per document). Explicit choices: **Latest only / Has earlier versions / Superseded**. "Superseded" shows non-latest rows on purpose; no state may ever hide the latest row.
- **D-07:** ⚠ "Superseded" (version lineage, `is_latest=false`) vs the `supersedes` **relationship** are two different facts. Research must define each precisely and the UI must label them so they cannot be confused.

**Rules surface rename + home (FIND-06)**
- **D-08:** Classification is renamed **"Filing rules"**.
- **D-09:** It mounts as a **secondary link in the Library header** opening a sub-view of the Library (not a sixth tab). The rail entry (`nav-items.ts:41`, `Wand2`, "Classification") is **removed**. The `classification-rules` `ActiveView` member and `ChatLayout.tsx:943` mount must be retired or re-pointed **consciously**, with `activeViewReachability.ts` kept green (no dead union member, no stale nav entry). Every existing rule still loads and still applies to a new upload.

### Claude's Discretion
- Result-row columns, default sort field and sortable set, pagination, row-click behaviour (open the Phase 270 detail panel is the expected default).
- Backend endpoint shape, and whether the existing `view_filter_compiler.py` / `document_view_resolver.py` are extended or wrapped. **Reuse the shipped compiler and typed columns (`date_typed`, `document_type_norm`, migration 074) before adding any.** Migration probably none; if needed, next free number.
- Filter-builder composition: reuse the Phase 114 no-DSL builder; do not invent a second one.

### Deferred Ideas (OUT OF SCOPE)
- "Has any relationship / has none" orphan filter — offered, not selected.
- Save a search as a View — not discussed; belongs to its own phase if wanted.
- Result columns, sort fields and pagination were left to Claude's discretion.
- Out of scope (phase boundary): agent-side filters (Phase 272), permissions derived from metadata (SEED-211), SEED-224's five-tab redesign, saved-search/View creation from a search.

### Approved UI contract
`271-UI-SPEC.md` (status: approved) and the sketch winners 1A / 2A / 3A plus the older-versions hint are the acceptance bar. ⚠ One deviation still needs the operator: UI-SPEC §Deviations moves the default sort from CONTEXT's "Modified (newest)" to **"Added to Agentic RAG (newest)"**, because `source_modified_at` is NULL on every pre-270 row (A1 below).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIND-01 | Search for documents by type, owner, dates, custom fields, folder path, relationships and version state; get documents back, not passages | §Pattern 1 (search core), §Pattern 2 (structure conditions), §Code Examples. Custom fields and type come through the shipped compiler. "Owner" maps to the 270 "Added by" facts (`user_id` / `source_connection_id`). Two-org RLS fence: §Validation (SC#5) |
| FIND-02 | Document search is its own mode beside RAG; never a shared ranking | §Pattern 4 (Ask hands off to chat with a one-shot prefill). Server sort only, client never re-sorts. No-embedding assertion: §Validation |
| FIND-03 | Folder path, relationships and version lineage are filterable | §Pattern 2: folder subtree (narrowing, not D-113-5's drop), relationship verbs (both directions, lineage-aware), version state (precise definitions in §Definitions) |
| FIND-06 | Classification renamed and mounted inside the Library | §Pattern 5: retire the `ActiveView` triad in one commit; `nav-items.test.ts` re-pin; `ClassificationRulesPage` `embedded` mode; rules still apply (existing `test_118_ingest_suggest` / `test_118_ingest_real_splice`) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Python backend in the `backend/venv` virtualenv. Raw SDK calls only (no LangChain or LangGraph). Pydantic for request models.
- **Backend unit baseline gate:** `pytest tests/unit -q --continue-on-collection-errors`, ceiling **71 failed** with zero headroom. Re-derive before the first edit (see §Environment).
- Every table carries RLS. User-JWT client on read paths (`get_user_supabase_client`). No blocking supabase-py call inside an async handler: wrap in `aexec` / `run_in_threadpool` (D-v2.5-01).
- Migrations: numbered `<digits>_name.sql` under `supabase/migrations/`, applied through the SQL editor (never `db push` / `db reset`), then `bash scripts/regenerate-full-schema.sh`. **Highest existing is `199_document_file_facts.sql`, so the next free number is 200.** This research recommends **no migration**.
- Realtime is a hint; reconcile by fetch. Multi-worker uvicorn: no module-level mutable caches in the new service.
- **G-5:** every hot file the plans name must have a ledger row (`node scripts/check-hot-file-ledger.cjs <phase>`). Disposition cells are capped at 200 chars; the reasons go in `docs/HOT-FILE-LEDGER.md` in the same commit.
- **G-8:** 3 to 5 plans, wave-sized. Targeted suites per task, full gates once per wave.
- Vitest gate has **two knobs** (TARGETS decides what runs, BASELINE decides what is guarded). `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the repo root. Capture failing file names from the persisted JSON before re-running anything.
- **Frontend typecheck:** `npx tsc -p tsconfig.app.json --noEmit`, measured as a set diff. Plain `tsc --noEmit` checks zero files. ⚠ **The base is 70 errors at `56630a65b` (measured this session), not the 67 CLAUDE.md quotes.** A plan must diff against 70.
- `lib/api/*`: add to a module. The `lib/api.ts` barrel re-exports an explicit set; adding to it breaks every `vi.mock("@/lib/api", factory)` that lacks the export (the 196-08 lesson).
- No `max-w-*` on LibraryPage (full-width, data page). `SHED_COLUMNS_3_TO_5` is load-bearing and positional (T-217-35).
- Provider-docs-first does not apply: this phase touches no LLM provider (Find makes no model or embedding call; Ask only pre-fills the composer).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Visibility (who sees which document) | Database (RLS on `documents`, `document_relationships`) | API (own-plus-global-folder legs, mirroring `list_documents`) | RLS is the wall. The app legs keep Find identical to the Library list and to `_assert_document_visible` (the detail panel's gate) |
| Field filtering (type, custom fields, document date) | API (shipped compiler → bound PostgREST params) | Database (typed columns `document_type_norm`, `date_typed`) | Reuse. Never filter in the browser |
| Structure filtering (folder subtree, relationship, version, added-by, file dates, name) | API (new search core) | Database | New closed set of appliers, each with a content-level test |
| Sort, page, total | API | — | D-03 "stated sort is the server's order". The client never re-sorts |
| Mode switch, chips, meta line, result table | Browser | — | FilterBar is reused. Find state lives at the page boundary |
| Ask handoff | Browser (`ChatLayout` creates the thread and sets the one-shot prefill) | — | No server call from the Library. Chat RAG is untouched |
| Filing rules sub-view | Browser (Library-local state) | API unchanged (`/classification-rules`) | Rename and re-home only. No backend change |

## Definitions (D-07) — the two "superseded" facts, precisely

| Fact | Stored where | Exact definition | UI words |
|---|---|---|---|
| **Version lineage** | `documents.version_number`, `documents.is_latest` | A *lineage* is the set of `documents` rows sharing `(user_id, filename)`. That is the handle `list_document_versions` (`documents.py:838-845`) and `_subject_version_ids` (`document_relationship_service.py:130-159`) use. `ingest_splice.py:241-268` also adds `org_id`, and `restore` (`documents.py:1236-1247`) also adds `folder_id`. A re-upload inserts a new row with `max(version_number)+1` and flips the others to `is_latest=false`. **Older version** = a row with `is_latest = false`. | "Older versions (superseded)", tag "v1 · older version" |
| **`supersedes` relationship** | `document_relationships(source_doc_id, target_doc_id, rel_type='supersedes', user_id)` | A link a person (or the agent) created: "source supersedes target". It is **user-owned**: RLS SELECT is `auth.uid() = user_id` (`full-schema.sql:7015`), so a colleague's links never match. It is independent of version lineage. | Relationship verbs "Supersedes" / "Is superseded by" |

**Version states (D-06), defined so each is testable against stored rows:**
- **Latest versions** (default): `is_latest = true`.
- **Has earlier versions:** `is_latest = true` AND there exists a visible row in the same lineage with a **lower** `version_number`. ⚠ The shipped chevron uses `version_number > 1` (`DocumentRow.tsx:54-56`). That is wrong after an older version is deleted, and it agrees with this definition after a restore. Use the lineage definition server-side and record the chevron divergence; do not "fix" the chevron in this phase.
- **Older versions (superseded):** `is_latest = false`. These rows are never latest, so "no state may ever hide the latest row" holds because Latest is the default and is always shown as a chip.

## Standard Stack

No new packages, front or back. Everything is shipped and pinned.

### Core (already installed — verified in `backend/venv` and `frontend/package.json`)
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| supabase / postgrest (py) | 2.29.0 | PostgREST builder: `.order(col, desc=, nullsfirst=False)`, `.range()`, `select(count="exact")`, `.in_()` (sanitizes members), `.ilike()` | `[VERIFIED: backend/venv/Lib/site-packages/postgrest/base_request_builder.py:569-640]` `order()` emits `col.desc.nullslast` only when `nullsfirst` is passed explicitly |
| FastAPI + Pydantic v2 | (project pin) | Request model `extra="forbid"`, Literal enums, UUID types | Project rule |
| React 19 / Vite / Tailwind / shadcn | `react ^19.2.4` | FilterBar / ConditionPopover / DocumentList reuse | Approved UI-SPEC: "New dependencies: none" |
| vitest | `^4.1.0` | Frontend tests | Gate |
| typescript | `~5.9.3` | `activeViewReachability.ts` AST fence (already a devDependency) | — |

**Installation:** none.

## Package Legitimacy Audit

Not applicable: **this phase installs no external packages** (UI-SPEC "New dependencies: none"; the backend uses only modules already in `venv`). slopcheck was not run because there is nothing to check.

## Architecture Patterns

### System Architecture Diagram

```
Library · Documents tab
  [Find documents | Ask] ─┬─ Ask ──► AskHandoffCard ──(Open in chat)──► ChatLayout.onAskInChat(q)
                          │                                   newThread() → setPrefill(q) → navigate("chat")
                          │                                   (composer pre-filled, NOT sent; RAG unchanged)
                          └─ Find
                               name input (300ms debounce) ┐
                               FilterBar  ← lib.filter     ├─► buildFindRequest() ─► POST /document-search
                               quick-add chips (structure) ┘        (user-JWT, Pydantic extra=forbid)
                                                                     │
           document_search_service.search_documents(caller, req, supabase)   [FastAPI-free core]
             1. validate metadata filter (validate_fields/validate_operands — shipped)
             2. compile_filter → fragments (shipped)  ──► apply_fragments() (EXTRACTED from resolver)
             3. structure appliers (closed set): name · folder · added_by · file-date · version base
             4. relationship → id allow-list (edges own-scoped; picked doc lineage; follow-to-latest)
             5. candidate fetch: own leg ∪ global-folder leg, lightweight cols, range-paged, count=exact
             6. version state (has_earlier) via ONE batched lineage read over candidates
             7. sort in Python (nulls last, id tiebreak) → total → slice page
             8. hydrate page rows (select * where id in page) + version_count + connection names
             9. older_matches (only when version=latest AND relationship set)
                                                                     │
           {documents:[…page…], total, older_matches, sort} ◄────────┘
                               │
     FindMetaLine (count · Sorted by · "Exact match on fields. No AI ranking.") + DocumentList(Find column set)
     row click → DocumentDetailPanel (resolves from Find results too, incl. older-version rows)

Library header ─ [Filing rules ›] ─► Library-local sub-view ─► ClassificationRulesPage embedded (unchanged behaviour)
                                     Back → the tab you came from
```

### Recommended Project Structure
```
backend/app/
├── services/document_search_service.py   # NEW FastAPI-free core (Phase 272's agent tool can reuse it)
├── services/document_view_resolver.py    # EXTRACT _apply → apply_fragments(q, fragments, subtree); resolve_filter byte-identical in behaviour
├── models/document_search.py             # NEW request model (keeps hot document.py / document_view.py untouched)
├── api/document_search.py                # NEW router, POST /document-search
└── main.py                               # +1 include_router line
frontend/src/
├── lib/api/documents.ts (or knowledge.ts) # + searchDocuments() + wire types — module, NOT the barrel
├── pages/findState.ts                    # NEW pure leaf: structure conditions, name, sort, version, mode, page
├── components/library/find/              # NEW: FindModeSwitch, FindMetaLine, AskHandoffCard, structure popovers
├── components/relationships/relationshipLabels.ts  # + 8-verb filter table derived from OUTGOING/INCOMING maps
└── components/relationships/LinkTargetCombobox.tsx # EXTRACTED from CreateLinkDialog (shared, never forked)
```

### Pattern 1: A search core beside the resolver, reusing it (one core, no fork)
**What:** The resolver's `_apply` is a closure inside `resolve_filter` (`document_view_resolver.py:254-318`). Lift it verbatim to a module-level `apply_fragments(q, fragments, subtree=None)` and have `resolve_filter` call it. Behaviour stays byte-identical, guarded by the existing `test_113_*`, `test_114_*` and `test_115_resolver_extraction`. The search core calls the same function. This is the D-115-6 precedent ("a fork re-opens the leak").
**When:** Always. Do not copy the fragment walk into the new module.
**Why not extend `resolve_filter` in place:** its contract is "latest only, `created_at desc`, no paging, D-113-5 drops an unreachable scope". Saved views, `resolveAdHoc` and the Phase 115 agent tool all depend on that. Find needs the opposite on three of those four points.

### Pattern 2: Structure conditions — a closed set, each with a content test
| Condition (wire) | Server behaviour | Notes |
|---|---|---|
| `name: str ≤200` | `.ilike("filename", "%" + escape(name) + "%")`, escaping `\`, `%`, `_` | ⚠ PostgREST also treats `*` as a LIKE wildcard; a typed `*` widens the match (A4). Not a security issue |
| `folder: {folder_id: UUID\|None, include_subfolders: bool=True}` | `folder_id=None` → `.is_("folder_id","null")`. Otherwise subtree = `resolve_project_subtree(...)` ∩ caller-visible folders (`fetch_visible_folders`), or `[folder_id]` when `include_subfolders=False`. **Empty → zero results**, never "no narrowing" | ⛔ Do NOT call `resolve_filter(folder_scope=…)`: D-113-5 drops an unreachable scope and returns everything. That is exactly "a filter the backend silently ignores" |
| `added_by: {kind: "me"\|"connection"\|"others", connection_id?: UUID}` | me: `user_id=caller` AND `source_connection_id IS NULL`. connection: `source_connection_id=X`. others: `user_id≠caller` AND `source_connection_id IS NULL` | Mirrors `DocumentFileFacts.addedBy()` (connection first, 270 F-2). Never filter by email (270 P-02) |
| `dates: [{which, op, value, value2?, unit?}]` | `which=document_date` → becomes a `ViewCondition(field="date")` through the shipped compiler (`date_typed`). `added` / `source_created` / `source_modified` → `created_at` / `source_created_at` / `source_modified_at`, with **day-boundary semantics**: `before d` → `< d`, `after d` → `>= d+1`, `between a b` → `>= a` AND `< b+1 day`. Relative ops reuse the shipped `_relative_window` | ⚠ These three are `timestamptz`. `.lte(col, "2019-12-31")` drops everything after midnight on Dec 31 (Pitfall 3). `date_typed` is a `date`, so the compiler's `lte` is correct there |
| `relationship: {verb, document_id: UUID}` | §Pattern 3 | — |
| `version: "latest"\|"has_earlier"\|"older"` = `"latest"` | `latest` / `has_earlier` → `.eq("is_latest", True)` (+ lineage step). `older` → `.eq("is_latest", False)` | — |
| `sort` (6 Literals) | Python sort over candidates. Date sorts are **nulls last in both directions**, then `id` | Six options exactly as in UI-SPEC copy |
| `offset ≥0`, `limit 1..100 (25)` | Slice after the sort | Total = candidate count, never the page length |

### Pattern 3: Relationship verb → id allow-list (both directions, lineage-aware)
Result-row phrase: `<result> <verb> <picked P>`. The table is closed (8 keys). Each key maps to `(rel_type, result_side)`:

| key | rel_type | result is | edge query (own-scoped) |
|---|---|---|---|
| supersedes / amends / references / attached_to | same | **source** | `target_doc_id IN versions(P)` → E = `source_doc_id`s |
| superseded_by / amended_by / referenced_by / has_attachment | inverse | **target** | `source_doc_id IN versions(P)` → E = `target_doc_id`s |

1. Resolve P with the shipped `_resolve_readable_latest(P, caller)`. If it is unreadable, return **zero results, same shape** (no existence oracle).
2. `versions(P)` = shipped `_subject_version_ids(P)`. An edge recorded on P's old version still counts (D-116-1a).
3. **Recommended semantics** (A2; it reproduces the approved sketch exactly and agrees with the Phase 117 panel):
   - **Latest / Has earlier:** each endpoint `e ∈ E` follows to the latest row of its lineage. Exclude P's own latest (a link inside one lineage is not "X is superseded by X").
   - **Older versions:** rows `e ∈ E` with `is_latest=false`, row-exact. These are the rows the link was recorded on.
   - **`older_matches` (the hint's N)** = |{e ∈ E : e is non-latest, visible, and passes every other filter}|. **Invariant:** pressing "Show them" yields exactly N rows. That invariant is testable.
   - Sketch check: edge `d2(v2) supersedes d1(v1)`, same lineage, P = d2, verb `superseded_by`. Latest gives 0 rows (self excluded). Hint N = 1. Show them gives d1. ✓
4. The allow-list is applied **inside** both visibility legs (`.in_("id", ids)`), so it can only narrow and never widen visibility.

### Pattern 4: Ask hands off to chat — new thread, prefilled, not sent
`LibraryPage` gains one optional prop, `onAskInChat?: (question: string) => void`. `ChatLayout` implements it next to the shipped `handleTryInChat` (`ChatLayout.tsx:279-282`): `await newThread()` (creates a server thread and selects it, `useThreads.ts:44-49`), then `onSetPrefillMessage(q)`, then `onNavigate("chat")`. `MessageInput` consumes and clears the prefill (`MessageInput.tsx:385-389`). ⚠ The shipped `handleTryInChat` does **not** create a thread, so copying it as-is is G-4 scenario 4's failure ("chat opens in the old thread"). ⚠ `MessageInput` also restores a per-thread draft (`draftKey`). Drive it live to prove the prefill is not clobbered by a draft restore on the new thread (A5).

### Pattern 5: Retire `classification-rules` as one change
- `App.tsx:127`: remove the member (12 remain; `renameFence.test.ts:142` asserts `>= 10`, still green).
- `ChatLayout.tsx:943-948`: remove the branch and the `ClassificationRulesPage` import at `:23`.
- `nav-items.ts:38-41`: remove the entry. Drop `Wand2` from the import only if it becomes unused (UI-SPEC moves the glyph to the header link).
- **`nav-items.test.ts:55-60` turns RED** (`NAV_ITEMS.length >= 8`). Re-pin it to 7 deliberately, with the reason in the test body. Do not delete the case: it is BASELINE-pinned at 5 in the count gate (`vitest-count-gate.cjs:3132`), so deleting it reads as a DECREASE.
- `LibraryPage.initialTab.test.tsx:396` lists `"classification-rules"` as a non-Library destination. Remove it from the list. It is a pure-function test, so it stays green either way; leaving it keeps a dead string.
- `activeViewReachability.test.ts` (11 cases) re-reads the real files. A member with no branch, or a branch with no member, fails it. Removing both in one commit keeps it green.
- `ClassificationRulesPage`: add an `embedded` prop that drops the outer `p-8` and its own `h1` block and renames the strings ("Classification rules" → "Filing rules"; `RuleBuilderPanel.tsx:287` "After extraction (Classification)" → "After extraction"). `ClassificationRulesPage.test.tsx` and `RuleBuilderPanel.test.tsx` are gated (BASELINE 8 for the builder). Any assertion on the old strings must be updated in the same commit.
- Sub-view state is Library-local (`useState`), **not** a `librarySelection` action: that leaf's 25-case suite asserts exactly six actions. Back restores the tab the person came from. Store the origin tab when opening the sub-view.

### Pattern 6: Where Find state lives (one source of truth)
- **Metadata conditions = `lib.filter`** (the reducer, D-217-12). Today the Documents tab FilterBar already composes `lib.filter`, and `SELECT_TAB` carries it across tabs. Keeping it there means Views stays byte-identical and "Save as view" keeps working for metadata-only searches.
- **Structure conditions, name, version, sort, page, mode** = a pure leaf `pages/findState.ts` (reducer + selectors, zero imports, like `librarySelection.ts`) plus a `useDocumentFind` hook for request sequencing (stale-response guard like `filterReqId`). This follows the G-5 ledger's named seam for LibraryPage ("each tab owns its body") and keeps new branches out of the page.
- On the **Documents** tab, `handleFilterChange` must drive the Find request, not `resolveFilterIntoList`. On **Views** it stays as shipped.
- Sidebar folder click while a search is active → shipped `SELECT_FOLDER` (ends the search). Sidebar View click → shipped `SELECT_VIEW` (moves to the Views tab). Find state survives, because it is not in the selection.
- `selectedDoc` must resolve from `documents` **or** the Find page (an older-version row is never in `documents`).

### Anti-Patterns to Avoid
- **Reusing `resolveFilterIntoList` for Find.** Its `catch` sets `filteredDocs=null`, which silently shows the unfiltered folder list (UI-SPEC S7 forbids this).
- **`resolve_filter(folder_scope=…)` for the Folder chip.** D-113-5 turns an unreachable folder into "no narrowing".
- **Client-side sorting or slicing of Find results.** D-03: "Sorted by" must be the server's order. Today `pagedDocuments` slices client-side for browse. Find must not.
- **`select("*")` without `.range()`** for candidates. PostgREST `max-rows` (1000) truncates silently. Use count-exact plus a range loop (the `fetch_all_folders(strict=True)` precedent, `folder_utils.py`).
- **A second relationship-label table typed by hand.** Derive the 8 verbs from `OUTGOING_LABEL` / `INCOMING_LABEL` / `REL_TYPES` (the backend `_INVERSE_LABEL` mirror) and pin the derived table with a test.
- **Forking the CreateLinkDialog combobox.** Extract the listbox body into a shared component that both the dialog and the Relationship popover mount.
- **Importing the new client function through the barrel.** `@/lib/api` mock factories in 4 LibraryPage suites would then need it. Import from the module. Resting Find must make **zero** requests, which keeps every mount suite green.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Metadata/custom-field filtering | A new filter grammar or SQL | `view_filter_compiler.compile_filter` + `validate_fields` / `validate_operands` | Whitelist, `_`-prefix rejection, numeric-range rejection (WR-01), bound params (SC#4) are all already proven |
| Applying fragments to a query | A copy of `_apply` | Extract it to `apply_fragments()` and call it from both | D-115-6: one core, no fork |
| Who-can-see legs | A new visibility rule | `get_globally_visible_folder_ids` + own leg (same as `list_documents:745-765`) | The detail panel's gate (`_assert_document_visible`) matches it, so Find never shows a row the panel 404s |
| Folder subtree | A tree walk | `resolve_project_subtree` ∩ `fetch_visible_folders` | Cycle-guarded, org-aware |
| Relative date windows | New window math | `document_view_resolver._relative_window` | D-114-16: "MUST NOT re-derive its own window math" |
| Picked-document readability, lineage ids | New lineage queries | `_resolve_readable_latest`, `_subject_version_ids` | CR-01 / CR-02 hardened, live two-user leak tests exist |
| Thread create + prefill | A new handoff channel | `useThreads.newThread` + App `prefillMessage` | Shipped one-shot; the navigator clears it |
| Pager | A new pager | `DocumentsPager` with the server `total` | Shipped |
| Combobox a11y | A new typeahead | Extracted Phase 117 combobox | APG roles already wired by hand and audited |

**Key insight:** every "new" filter here is a narrowing on a column or an id set that already exists. The danger is not missing capability. It is a chip the server silently ignores, which is the exact failure ROADMAP names. So each applier needs a content test: seed rows that differ only in that dimension, assert the exact id set, and drive at least one RED by removing the applier.

## Runtime State Inventory (rename of the rules surface)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `classification_rules` rows: table name and API path unchanged. `metadata._classification` on documents unchanged. Grep found no stored `"classification-rules"` view key | None. Code-only rename |
| Live service config | None. No external service carries the view key | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts / persisted UI state | `ActiveView` is in-memory `useState` (no router, no localStorage key found for the active view). `SIDEBAR_PIN_KEY` is untouched. `LibraryPage.initialTab` hand-off clears on non-Library navigation | None. Verify live that nothing restores a stale `classification-rules` (none found in code) |

## Common Pitfalls

### Pitfall 1: A chip the server ignores
**What goes wrong:** `ConditionPopover` already offers fields the resolver rejects. Its non-watch branch merges `WATCH_FIELDS` (`name`, `type`, `size`) into the picker (`ConditionPopover.tsx:118-134`), but none of these is in `_METADATA_BUILTINS ∪ _SOURCE_FACT_FIELDS`, so the resolve returns 422. Today the page's `catch` then swaps in the unfiltered list. **This is a pre-existing defect that Find's `＋ condition` inherits.**
**Avoid:** In Find, filter the `＋ condition` field list to the server whitelist, or route a 422 to the S7 error state (never a list swap). Add a test that every offered field resolves.
**Warning sign:** a chip set and the count unchanged (G-4 #1 failure).

### Pitfall 2: Silent 1000-row truncation
Both shipped list paths (`list_documents`, `resolve_filter`) select unbounded and inherit PostgREST `max-rows`. Find's total must be exact. Use `select(cols, count="exact")` plus a `.range()` loop and assert `len == count`.

### Pitfall 3: Timestamp day boundaries
`created_at`, `source_created_at` and `source_modified_at` are `timestamptz`. "Between 1 Jan and 31 Dec 2019" must be `>= 2019-01-01` AND `< 2020-01-01`. Test with a row at `2019-12-31T15:00Z`.

### Pitfall 4: Nulls in date sorts
Postgres DESC puts NULLs first, and Python `sorted` raises on `None` vs `str`. Sort key `(value is None, value)` with the reverse flag applied only to the value. Pre-270 rows have NULL `source_*` (270 ledger), so the default sort on them would bury most of the library (UI-SPEC deviation, A1).

### Pitfall 5: `nav-items.test.ts` and the count gate
Removing the rail entry turns `NAV_ITEMS.length >= 8` RED. Re-pin it rather than delete it: deleting a pinned case reads as a per-file DECREASE.

### Pitfall 6: The detail panel on an older-version row
`PATCH /{id}/metadata` is `is_latest`-gated (`documents.py:1981-1995`) and returns 404 on an older row. `list_document_versions` is owner-only (`:827-836`). The relationships read follows to latest. **So the panel must read as historical for an older row** (edits refused with a sentence, not a raw error). 270's download already labels "Download v1 (viewed, not latest)".

### Pitfall 7: Two-org members and vacuous fences
RLS `current_user_org_ids()` is **every** membership. The dev account is in two orgs (MEMORY). A two-org fence needs a subject in exactly one org, asserted from `org_members`, plus a positive control that sees the other org's row through the same query, plus `assert_auth_uid` (the `test_266_two_org_fence.py` shape).

### Pitfall 8: The RLS harness adapter does not speak the Find builder
`tests/integration/_reembed_adapter.SupabaseTxnAdapter` supports only `select / eq / neq / or_ / limit` (`_reembed_adapter.py:89-241`). Find uses `in_`, `ilike`, `is_`, `gte`, `lt`, `range` and `count`. Either extend the adapter (test-only, with its own unit test), or drive the fence through **real PostgREST at :54321 with a real user JWT** (sign in seeded users through GoTrue). The second is the stronger proof of "the real RLS path" (A6).

### Pitfall 9: Saved-view line accuracy
UI-SPEC shows "This search can't be saved as a view yet" when the search has a name, folder, relationship or version condition. **Added by and the three non-document dates are also unstorable** in `ViewFilter`. Include them in that predicate, or Save-as-view will persist a filter that is not the search on screen.

## Code Examples

### Extracted fragment walker (resolver keeps behaviour)
```python
# Source: backend/app/services/document_view_resolver.py:254-318 (moved, not rewritten)
def apply_fragments(q, fragments, subtree=None):
    for frag in fragments:
        ...  # the existing body verbatim
    if subtree:
        q = q.in_("folder_id", subtree)
    return q
# resolve_filter: `def _apply(q): return apply_fragments(q, fragments, subtree)`
```

### Candidate fetch, truncation-aware
```python
# Pattern: folder_utils.fetch_all_folders(strict=True); postgrest 2.29: table().select(...) returns the
# FILTER builder, so select FIRST, then apply filters. `apply` re-applies every leg filter to a fresh builder.
COLS = "id,user_id,filename,folder_id,version_number,is_latest,created_at,source_created_at,source_modified_at,date_typed"
PAGE = 1000
async def fetch_all(supabase, apply) -> list[dict]:
    first = await aexec(apply(supabase.table("documents").select(COLS, count="exact")).range(0, PAGE - 1))
    rows, total = list(first.data or []), first.count
    while isinstance(total, int) and len(rows) < total:
        nxt = await aexec(apply(supabase.table("documents").select(COLS)).range(len(rows), len(rows) + PAGE - 1))
        if not nxt.data:
            break
        rows.extend(nxt.data)
    if isinstance(total, int) and len(rows) < total:
        raise SearchTruncatedError(f"{len(rows)} of {total}")   # fail loud, never a short answer
    return rows
# Run once per visibility leg (own: .eq("user_id", caller); global: .in_("folder_id", global_ids)),
# then dedupe by id exactly as resolve_filter does.
```

### Sort with nulls last, stable across pages
```python
def sort_rows(rows: list[dict], col: str, desc: bool) -> list[dict]:
    present = sorted((r for r in rows if r.get(col) is not None), key=lambda r: r["id"])
    present.sort(key=lambda r: (r[col].casefold() if col == "filename" else r[col]), reverse=desc)  # stable
    missing = sorted((r for r in rows if r.get(col) is None), key=lambda r: r["id"])
    return present + missing          # "not recorded" rows always LAST, in both directions
```

### Day-boundary date leg (timestamptz)
```python
from datetime import date, timedelta
def _day_after(iso: str) -> str: return (date.fromisoformat(iso) + timedelta(days=1)).isoformat()
# before d → q.lt(col, d) ; after d → q.gte(col, _day_after(d)) ; between a,b → q.gte(col, a).lt(col, _day_after(b))
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `folder_scope` dropped when unreachable (D-113-5) | Find: unreachable folder → zero rows | This phase | Saved views keep D-113-5; Find must not |
| Rail entry "Classification" (Phase 118 gap closure) | Library header link "Filing rules" | This phase | BUG-260923-01 (rail density): 12 → 11 affordances; does not close it |
| Client slice of `GET /documents` (1000 cap) | Server-paged Find with exact total | This phase | Browse mode unchanged |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Default sort "Added to Agentic RAG (newest)" instead of CONTEXT's "Modified (newest)" | UI-SPEC deviation | Operator expectation mismatch. **Needs operator confirmation** (UI-SPEC flags it) |
| A2 | Relationship semantics: picked side by lineage, Latest follows to latest (self-lineage excluded), Older row-exact, hint N = non-latest endpoints | Pattern 3 | Wrong set for "what supersedes X". Lock it in a plan decision before execution |
| A3 | Older-version rows use the same legs as the panel gate (own ∪ global-folder), so a colleague's superseded row in an org-shared folder is findable | Pattern 2 | `_resolve_readable_latest` (IN-01) and `list_document_versions` treat colleagues' old versions as not independently readable. The alternative is the own leg only for `older`. **Decide explicitly** |
| A4 | A typed `*` widens the name match; escaping covers only `%`, `_`, `\` | Pattern 2 | Cosmetic over-match |
| A5 | The new-thread prefill survives `MessageInput`'s draft restore | Pattern 4 | G-4 #4 fails live. Drive it |
| A6 | Multiple PostgREST filters compose as AND when the visibility legs stay as two separate queries (no `or=` for visibility) | Pattern 1 | Avoided by design. If a plan collapses the legs into one `or_`, a second `or` param (from `is_empty`) must be proven live |
| A7 | Lineage key `(user_id, filename)` (shipped versions endpoint and relationship service), not `(user_id, org_id, filename)` (ingest) | Definitions | A user in two orgs with the same filename in both sees a merged "has earlier" count. LOW |
| A8 | "Added by" options (connections, document types) derive from the documents the page already holds (`useDocuments`, which carries `source_connection_name` since 270), with no new facet endpoint | Pattern 2 | Options miss rows beyond the 1000-row list cap. LOW |

## Open Questions

1. **Older versions of colleagues' documents (A3).** Recommendation: own ∪ global-folder, matching `_assert_document_visible`. Record it as a decision because two shipped modules disagree.
2. **Default sort (A1).** The operator confirms "Added" or keeps "Modified in the file".
3. **`has_earlier` vs the chevron.** Recommendation: server uses the lineage definition. The chevron stays `version_number > 1` and the divergence is recorded, with no fix in this phase.
4. **Picked document is itself an older version.** The typeahead offers latest only (UI-SPEC), so this cannot happen from the UI. The server resolves any id forward to latest (`_resolve_readable_latest`).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | frontend, gates | ✓ | v24.19.0 | — |
| Python venv | backend | ✓ | 3.12.6 | — |
| Local Postgres :54322 | integration / two-org fence | ✓ (port open) | — | Tests are `requires_pg` skip-guarded. A skip is not a pass |
| PostgREST/GoTrue :54321 | real-JWT fence (A6 option) | ✓ (port open) | — | Extend the RLS adapter instead |
| Backend :8000 | live G-4 drive | ✓ (port open, operator-started) | — | Operator starts it |
| Frontend typecheck base | set diff | measured **70** errors at `56630a65b` | — | — |
| Backend unit baseline | gate | ✓ measured this session at `56630a65b`: **71 failed, 6092 passed, 1 skipped, 2 xfailed, 2 xpassed** (ceiling 71, zero headroom; the passed count has grown from the 3497 CLAUDE.md quotes, which is expected) | — | — |

## Validation Architecture

> `.planning/config.json` has `workflow.nyquist_validation: false`. This section is included because the orchestrator asked for it. It is informational and does not drive a VALIDATION.md.

### Test Framework
| Property | Value |
|----------|-------|
| Backend | pytest (venv). Unit `backend/tests/unit`, live-DB `backend/tests/integration` (`requires_pg`) |
| Frontend | vitest 4 (`frontend/`), count gate `scripts/vitest-count-gate.cjs` |
| Quick run | `cd backend && venv/Scripts/python -m pytest tests/unit/test_271_*.py -q` · `cd frontend && npx vitest run <files>` |
| Full suite | `node scripts/check-backend-unit-baseline.cjs` · `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root) · `npx tsc -p tsconfig.app.json --noEmit` (set diff vs 70) |

### Phase Requirements → Test Map
| Req | Behavior | Type | Command | Exists? |
|-----|----------|------|---------|---------|
| FIND-01 | type + added-by + document-date + custom field → exact id set, one row per document | unit (fake builder) + integration (live) | `pytest tests/unit/test_271_search_core.py -q` / `tests/integration/test_271_search_live.py` | ❌ Wave 0 |
| FIND-01 / SC#5 | two-org fence: single-org subject sees 0 of org B. Positive control T sees B's row through the same call. `assert_auth_uid` | integration (real RLS) | `pytest tests/integration/test_271_two_org_fence.py` | ❌ |
| FIND-02 / D-03 | zero embedding calls: patch `openai_service.embed_texts` (and every name importing it) to raise, run every condition kind. Static fence: the new modules import no retrieval/embedding module and call no `.rpc(` | unit | `pytest tests/unit/test_271_no_embedding.py` | ❌ |
| FIND-02 | server order: each of the 6 sorts, nulls last, stable across pages, total ≠ page length | unit | same core file | ❌ |
| FIND-03 | folder subtree on/off, Not in a folder, unreachable folder → 0 | integration | live file | ❌ |
| FIND-03 / D-05 | each verb pair returns different sets for an asymmetric edge. Incoming verb non-empty while the edge exists. Edge on an old version still matches. Self-lineage excluded. Hint N == rows after Show them | integration | live file | ❌ |
| FIND-03 / D-06 | Latest never contains `is_latest=false`. Older never contains `is_latest=true`. `has_earlier` agrees with lineage after delete and restore | integration | live file | ❌ |
| FIND-06 | reachability triad green, NAV_ITEMS re-pinned, "Classification rules" absent from rendered surfaces, Back returns to the origin tab | vitest | `npx vitest run src/lib/__tests__/activeViewReachability.test.ts src/lib/nav-items.test.ts src/components/classification` | ✅ (update) + ❌ new |
| FIND-06 | existing rules still apply to a new upload | pytest (existing) | `pytest tests/integration/test_118_ingest_suggest.py tests/integration/test_118_ingest_real_splice.py` | ✅ |
| UI | 7 `<td>` in the Find column set. Shed selector byte-unchanged. Version chip visible at default. Error keeps chips (no list swap). Ask renders no list | vitest | new `src/components/library/find/__tests__/*` | ❌ |

### Sampling Rate
- Per task: the targeted files above.
- Per wave: backend baseline gate + vitest count gate + tsc set diff.
- Phase gate: G-4 scenarios 1-6 driven in Chrome (UI-SPEC §G-4), not screenshots alone.

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_271_search_core.py`: fake-builder recorder asserting the exact builder calls per condition (the `test_114` style)
- [ ] `backend/tests/integration/test_271_search_live.py`: seeded lineages and edges, content assertions
- [ ] `backend/tests/integration/test_271_two_org_fence.py`: decide adapter-extension vs real-JWT (Pitfall 8)
- [ ] `backend/tests/unit/test_271_no_embedding.py`
- [ ] Frontend suites for `findState.ts`, FilterBar quick-add, FindMetaLine, AskHandoffCard, the Filing rules sub-view. **Adopt every new suite into BOTH gate knobs.** `CreateLinkDialog.test.tsx`, `RelationshipsSection*.test.tsx` and `ConditionPopover.test.tsx` are in **neither** knob today, so if a plan edits those files it must adopt them first, or a regression there is invisible

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherited) | `get_current_user` |
| V3 Session Management | no | — |
| V4 Access Control | **yes** | User-JWT client (RLS) + own ∪ global-folder legs. Relationship edges RLS-owner-only. Allow-lists only narrow |
| V5 Input Validation | **yes** | Pydantic `extra="forbid"`, `Literal` verbs/sorts/versions, `UUID` ids, `max_length` on name, `limit ≤ 100`. Shipped `validate_fields` / `validate_operands` for metadata |
| V6 Cryptography | no | — |

### Known Threat Patterns
| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Cross-org / cross-user read | Information disclosure | RLS + caller-scoped legs. Two-org live fence with a positive control |
| Existence oracle via the relationship picker | Information disclosure | Unreadable P → the same zero-result shape as "no matches" (no 404 vs 200 split) |
| PostgREST grammar injection | Tampering | Values via builder params (`.in_` sanitizes). UUIDs typed. No `.or_` built from user strings |
| LIKE wildcard injection | Tampering (benign) | Escape `\ % _` (A4) |
| Unbounded scan / large allow-lists | DoS | Limit clamp, debounce, range-paged candidates, fail loud past the reported count |
| Metadata deciding access (SEED-211) | Elevation | Out of scope. No filter result is ever used as an authorization input |

## G-5, Seeds and Reported Bugs (measured this session)

**Ledger gate** (`node scripts/check-hot-file-ledger.cjs --files …`, scan list 356 rows): **8 probable files have NO row**, and G-5 cannot fire on them: `backend/app/api/document_views.py` (11/5/300, **FIRES**), `backend/app/models/document_view.py` (5/3/110, FIRES), `backend/app/services/document_relationship_service.py` (5/3/457, FIRES), `frontend/src/components/ingestion/FilterBar.tsx` (6/3/311, FIRES), `viewRuleWords.ts` (1/1/43), `library/DocumentsPager.tsx` (2/1/108), `relationships/CreateLinkDialog.tsx` (3/1/316), `relationships/relationshipLabels.ts` (1/1/43). Rows must be added in the plan commit that first names each file.
Other FIRING triples re-derived: LibraryPage `50/17/994` (`--follow`), ChatLayout `59/29/1127`, App `34/25/410`, nav-items `11/7/153`, DocumentList `27/13/296`, ConditionPopover `5/3/410`, view_filter_compiler `5/4/288`, document_view_resolver `3/3/379`, RuleBuilderPanel `5/4/501`, `lib/api/knowledge.ts` `4/3/812`. Recommended new files (service, router, model, `findState.ts`, the find components) keep growth out of the FIRING files. Each needs a row at creation.

**Seeds:** `node scripts/check-seeds-register.cjs --phase 271` reports **0 matched**, but that is vacuous: there are no plans yet, so there are no `files_modified` paths. Re-run it after planning. A manual grep of open seeds naming phase files found `SEED-243` (planted; this phase answers §decide 1-3 and its status must be flipped at close), `SEED-005` (open, Tier A), `SEED-211` (out of scope, must stay untouched), `SEED-224` (out of scope), `SEED-185` (no router: Filing rules is not linkable, which is acceptable), `SEED-317` (library provenance does not follow an org switch: adjacent, not folded) and `SEED-280` / `SEED-287` (suites in neither gate knob, relevant to Wave 0).

**Reported bugs (open, surface Agentic-RAG):** `BUG-260923-01` (rail density) **overlaps partially**: removing "Classification" takes one of 12 affordances away, but it does not close the report (Settings, Org admin, Control Room and Spend remain). Recommend recording the partial effect in its body and leaving it `open`. `BUG-260908-01` (unbounded chunks section in the detail panel) sits on the surface Find opens but is not in scope. No other open report overlaps.

## Sources

### Primary (HIGH — read at HEAD this session)
- `backend/app/services/view_filter_compiler.py`, `document_view_resolver.py`, `document_relationship_service.py`, `api/document_views.py`, `api/documents.py` (list, versions, restore, metadata PATCH, `_assert_document_visible`), `services/ingest_splice.py` (versioning), `utils/folder_utils.py`, `dependencies.py` (active org)
- `supabase/full-schema.sql`: `documents` DDL, RLS on `documents` and `document_relationships`, `documents_latest_idx`
- `backend/venv/.../postgrest/base_request_builder.py` 2.29.0 (`order` / `range` / `select` / `or_` / `in_`)
- Frontend: `LibraryPage.tsx`, `librarySelection.ts`, `FilterBar.tsx`, `ConditionPopover.tsx`, `DocumentRow.tsx`, `DocumentList.tsx`, `LibraryHeaderBar.tsx`, `CreateLinkDialog.tsx`, `relationshipLabels.ts`, `ClassificationRulesPage.tsx`, `App.tsx`, `nav-items.ts` (+ test), `ChatLayout.tsx`, `useThreads.ts`, `MessageInput.tsx`, `startScopedChat.ts`, `lib/api/knowledge.ts`
- Tests: `test_266_two_org_fence.py`, `test_163_leak_supabase.py`, `_rls_harness.py`, `_reembed_adapter.py`, `scripts/vitest-count-gate.cjs`
- `.planning/sketches/271-find-the-document/{README.md,index.html}` (the sketch's REL table and `match()` / `hiddenOlder()` logic)

### Secondary
- `docs/HOT-FILE-LEDGER.md` (LibraryPage / DocumentList / Phase 270 sections)
- `.planning/seeds/SEED-243-*.md`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Nothing new; versions read from the venv and package.json.
- Architecture: HIGH on reuse and seams (code read). MEDIUM on relationship and version semantics (A2, A3 are decisions).
- Pitfalls: HIGH. Each one was found in code (ConditionPopover's whitelist mismatch, the resolver's D-113-5 drop, the 1000 cap, the nav test pin, the adapter's limited builder).

**Research date:** 2026-10-03
**Valid until:** 2026-10-17. The Library files churn quickly (LibraryPage went stale twice in one phase), so re-derive the triples before planning.

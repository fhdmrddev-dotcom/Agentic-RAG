# Phase 114: Virtual Folders — Range/Date Filters + View Builder + Sidebar - Pattern Map

**Mapped:** 2026-06-19
**Files analyzed:** 13 (5 backend modified/new · 1 migration new · 7 frontend new/modified)
**Analogs found:** 12 / 13 (1 net-new with no direct analog — see No Analog Found)

This phase has a backend leg (additive operators into a closed registry + widened compiler output + two GENERATED-STORED typed columns + count-only resolve + server-side relative-date) and a net-new frontend leg (inline filter-bar builder + relative-date control + Views sidebar group + shared `NavRow` + per-view count badge + sidebar→rail collapse + Move-to-folder action + responsive column-shedding). Almost everything has a shipped, tested analog from Phase 110/111/112/113 — the planner should EXTEND, not rewrite.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/services/view_operators_extra.py` (NEW) | service | transform | `view_filter_compiler.py` `@register_operator("eq")` (`:56-76`) | exact (same registry seam) |
| `backend/app/services/view_filter_compiler.py` (MOD) | service | transform | itself — widen `compile_filter` output (`:86-101`) | self (in-place evolution) |
| `backend/app/models/document_view.py` (MOD) | model | request-response | itself — widen `ViewCondition.op` Literal (`:34-42`) | self (additive Literal) |
| `backend/app/api/document_views.py` (MOD) | route | request-response / CRUD | itself — extend `_apply` + count-only branch (`:200-290`) | self (extend resolve) |
| `supabase/migrations/NNN_view_typed_columns.sql` (NEW) | migration | DDL | `071_dm_foundations.sql` (whole file) | role-match (DDL+RLS conventions); net-new on GENERATED cols |
| `backend/tests/unit/test_113_view_filter_compiler.py` (MOD) | test | unit | itself — rewrite 3 containment tests to fragment shape (`:31-69`) | self (contract change) |
| `frontend/src/components/ingestion/NavRow.tsx` (NEW) | component | request-response | `FolderNode.tsx` row body (`:110-256`) | exact (extracted from it) |
| `frontend/src/components/ingestion/FolderNode.tsx` + `FolderTree.tsx` (MOD) | component | request-response | themselves — refactor onto `NavRow` | self (refactor) |
| `frontend/src/components/ingestion/ViewsGroup.tsx` (NEW) | component | request-response | `FolderTree.tsx` group header + node list (`:112-196`) | exact (mirror of Folders group) |
| `frontend/src/components/ingestion/FilterBar.tsx` (NEW) | component | event-driven | none direct — compose shadcn `Button`/`Popover` + inline-rename idiom | **no analog** (net-new) |
| `frontend/src/components/ingestion/ConditionPopover.tsx` (NEW) | component | event-driven | `FolderNode.tsx` `DropdownMenu` (`:209`) + `MoveToFolderDialog.tsx` `Select` (`:69-81`) | role-match (compose primitives) |
| `frontend/src/components/ingestion/RelativeDateControl.tsx` (NEW) | component | event-driven | none — net-new stepper | **no analog** (net-new) |
| `frontend/src/components/ingestion/DocumentList.tsx` (MOD) | component | request-response | itself — static 7-col table (`:266-276`); column-shedding net-new | partial (table exists, responsive logic net-new) |
| `frontend/src/pages/IngestionPage.tsx` (MOD) | page | request-response | itself — push/split grid (`:133-151`) | self (extend grid + sidebar rail) |
| Move-to-folder row action (MOD on Documents row) | component | request-response | `HealthDocumentRow.tsx` `MoveToFolderDialog` usage (`:35,146-158,190-196`) | exact (reuse whole) |

---

## Pattern Assignments

### `backend/app/services/view_operators_extra.py` (service, transform) — NEW

**Analog:** `backend/app/services/view_filter_compiler.py` — the `@register_operator` decorator + `_op_eq` (the ONLY operator today).

**The registry seam** (`view_filter_compiler.py:56-76`) — the exact decorator pattern new operators copy:
```python
def register_operator(op: str) -> Callable[...]:
    """Decorator: register an operator fn under ``op`` in :data:`OPERATOR_REGISTRY`."""
    def deco(fn): OPERATOR_REGISTRY[op] = fn; return fn
    return deco

@register_operator("eq")
def _op_eq(field: str, value: object) -> dict:
    return {field: value}
```

**The import seam** (`view_filter_compiler.py:79-83`) — the documented Phase 114 hook. New operators register by **side-effect import ONCE** from the compiler:
```python
# Phase 114 SEAM: add the additive operators by importing an extra module ONCE
# here (e.g. ``from . import view_operators_extra  # noqa: F401``) so its
# @register_operator("gte") / ("one_of") / ... side-effects populate the registry.
```

**Net-new operators to register** (`gte`, `lte`, `one_of`, `contains`, `is_empty`, `within_next`, `older_than`, `before`, `after`, `between`). **Output-shape change (R-114-A):** each fn must now return a **`Fragment` descriptor** (a dataclass: `leg ∈ {typed,custom,containment}`, `field`, `builder ∈ {eq,gte,lte,ilike,is_,or_,contains}`, `value`, `value2`), NOT a `{field: value}` dict — see the widened compiler below. The operator-→-Fragment mapping is fully tabulated in `114-RESEARCH.md` §"Operator → Fragment Mapping (DELIVERABLE 1)".

**Fail-closed invariant to preserve** (`view_filter_compiler.py:97-99`): a registry miss MUST still raise `KeyError`. Pitfall 5 — the widened Literal just gains members; the closed dispatch stays closed.

---

### `backend/app/services/view_filter_compiler.py` (service, transform) — MODIFY

**Analog:** itself. `compile_filter` (`:86-101`) folds every condition into ONE `{field: value}` containment dict today.

**Current fold loop** (`:95-101`) — the shape that must widen from "one dict" to "ordered `list[Fragment]`":
```python
metadata_filter: dict = {}
for c in flt.conditions:
    fn = OPERATOR_REGISTRY.get(c.op)        # closed lookup; unknown -> None
    if fn is None:
        raise KeyError(f"operator {c.op!r} not registered")   # FAIL CLOSED — KEEP
    metadata_filter.update(fn(c.field, c.value))   # eq -> {field: value}
return metadata_filter
```

**Purity invariant to preserve** (module docstring `:1-32`): `compile_filter` stays a PURE module — no I/O, no SQL, no f-string interpolation of field names OR values. It returns DATA (`list[Fragment]`); `_apply` in the resolve route is the SOLE place builder calls happen. This keeps the SC#4 injection invariant intact.

**`validate_fields`** (`:104-118`) — UNCHANGED. The `_`-prefix reject + whitelist check at save time still applies to every operator.

---

### `backend/app/models/document_view.py` (model, request-response) — MODIFY

**Analog:** itself. The Literal-discriminated AST is the declarative reject-unknown-op mechanism.

**Current AST** (`:34-42`) — the Literal members widen ADDITIVELY (no shape change, no data migration of live rows — the D-113-6 payoff):
```python
class ViewCondition(BaseModel):
    field: str
    op: Literal["eq"]                       # 114 widens additively → ["eq","gte","lte","one_of","contains","is_empty","within_next","older_than","before","after","between"]
    value: str | int | float | bool         # scalar literal (bound as a param at resolve)

class ViewFilter(BaseModel):
    op: Literal["and"]                      # stays "and" — flat AND only (OR/NOT deferred)
    conditions: list[ViewCondition] = []
```

**Additive optional fields** (per RESEARCH §"Recommended Project Structure"): add optional `value2` (for `between`), `values: list[...]` (for `one_of`), `unit ∈ {days,weeks,months}` (for relative-date). All default-absent so existing `{op:and, eq}` rows parse unchanged.

**The "no `ViewResolveResponse` model" rule** (`:17-24`, IN-03 / the 112 CR-01 lesson): the resolve route deliberately returns a plain dict with NO `response_model` so `_source`/`_confidence` survive. The count-only branch must follow the same rule.

---

### `backend/app/api/document_views.py` (route, request-response / CRUD) — MODIFY

**Analog:** itself. The resolve route is the per-viewer leak-safe core — EXTEND, never rewrite (RESEARCH "Don't Hand-Roll").

**The two-leg own+global pattern with `_apply` (`:251-286`)** — the load-bearing leak-safe shape. The widened `_apply` must keep applying identical filters to BOTH legs, scoped from `caller` (NEVER `view["user_id"]`):
```python
def _apply(q):
    if metadata_filter:                       # → widen: walk list[Fragment], chain builder calls
        q = q.contains("metadata", metadata_filter)   # eq/bool/number containment SURVIVES here
    if subtree:
        q = q.in_("folder_id", subtree)       # list, never a set (Pitfall 1/4)
    return q

own = _apply(supabase.table("documents").select("*")
             .eq("user_id", caller).eq("is_latest", True))     # VIEW-06: CALLER, never view owner
own_docs = (await aexec(own)).data or []
global_folder_ids = await get_globally_visible_folder_ids(supabase, caller)
# ... global leg .in_("folder_id", global_folder_ids).eq("is_latest", True)
# merge own_docs + global_docs, dedupe by id, sort created_at desc (:280-286)
```

**Widened `_apply` (the two-leg split, RESEARCH Code Examples)** — typed-column leg via PostgREST builders on a CONSTANT column name (`document_type_norm`/`date_typed`); custom-field leg on `metadata->>'field'` where `field` comes ONLY from the whitelist:
```python
def _apply(q):
    for frag in fragments:                              # ordered list from compile_filter (AND-chained)
        col = TYPED_COL[frag.field] if frag.leg == "typed" else f"metadata->>{frag.field!r}"
        q = getattr(q, frag.builder)(col, frag.value)   # .eq/.gte/.lte/.ilike — bound param (SC#4)
        if frag.value2 is not None:
            q = q.lte(col, frag.value2)                 # between
    if subtree:
        q = q.in_("folder_id", subtree)                 # list (Pitfall 4)
    return q
```

**Relative-date server-clock derivation (D-114-16 — the 114→115 handoff)** — compute "today" INSIDE `resolve_view` from `date.today()` every call (RESEARCH Pattern 2). `within_next` → `.gte(today).lte(today+N)` (the `.gte(today)` lower bound excludes overdue, D-114-5). Add a docstring contract note: *"Relative-date windows are computed here from the server clock; callers (Phase 115 agent-tool) must reuse this resolver, never re-derive."*

**Count-only mode (D-114-15)** — additive `count_only`/`head` query param. Use the `count="exact"` idiom (NOT `len(.select("*"))` — silent undercount at >1000; see Shared Patterns). Dedupe across legs by id (option 1, provably correct, mirrors `:280-286`):
```python
own_ids  = {d["id"] for d in (await aexec(_apply(sb.table("documents").select("id").eq("user_id", caller).eq("is_latest", True)))).data or []}
glob_ids = {d["id"] for d in (await aexec(_apply(sb.table("documents").select("id").in_("folder_id", gfids).eq("is_latest", True)))).data or []} if gfids else set()
total = len(own_ids | glob_ids)              # DISTINCT across legs — Pitfall 4: NEVER own.count + global.count
```

**Whitelist re-check at resolve** — `_build_whitelist` (`:72-85`) already assembles built-ins ∪ enabled custom defs; the custom-field leg's field name must be re-validated against this at resolve (not just save) before building `metadata->>'field'`.

**Case-insensitivity (R-114-A, mostly query-value-side)** — lowercase the view query value for `document_type`/`language` (already stored lowercase at write — see Shared Patterns); reserve `ILIKE`/`lower()=lower()` for genuinely un-normalized free-text (`title`/`author`/`summary`). Pitfall 3: do NOT `ILIKE` the already-normalized fields (defeats the index).

**`aexec` wrapper** (`:61`, `from app.utils.db import aexec`) — every `.execute()` rides `run_in_threadpool` (D-v2.5-01). The count-only path must too.

---

### `supabase/migrations/NNN_view_typed_columns.sql` (migration, DDL) — NEW

**Analog:** `supabase/migrations/071_dm_foundations.sql` — the DDL conventions to copy (header comment block, `BEGIN; ... COMMIT;` atomic wrapper, btree index naming, apply-via-SQL-editor instructions). The GENERATED-column derivation itself is net-new (no typed columns exist today — only `metadata jsonb` + GIN from migration 007).

**Header + atomic-wrapper convention** (`071:1-13`) — copy verbatim style:
```sql
-- NNN_view_typed_columns.sql — Phase 114 (VIEW-03 / R-114-B).
-- Apply by pasting into the Supabase SQL editor (or psycopg2 to local :54322 per
-- the 100/099/101.1/102/110 precedent) — NEVER `supabase db push` / `db reset`;
-- then `bash scripts/regenerate-full-schema.sh` (no --reset).
BEGIN;
... COMMIT;
```

**btree index naming convention** (`071:179-191`) — `idx_<table>_<col>` USING btree:
```sql
CREATE INDEX idx_document_views_user_id ON public.document_views USING btree (user_id);
```

**The net-new DDL (RESEARCH §"Migration Design (DELIVERABLE 2)")** — two GENERATED ALWAYS AS (...) STORED columns + btree. The date column MUST guard the cast with an ISO regex (a malformed stored date yields NULL, breaks neither the ALTER nor any future insert); `(text)::date` is immutable (valid in a generation expr), `(text)::timestamptz` is NOT (rejected):
```sql
ALTER TABLE public.documents
  ADD COLUMN document_type_norm text
  GENERATED ALWAYS AS (lower(metadata->>'document_type')) STORED;

ALTER TABLE public.documents
  ADD COLUMN date_typed date
  GENERATED ALWAYS AS (
    CASE WHEN metadata->>'date' ~ '^\d{4}-\d{2}-\d{2}$'
         THEN (metadata->>'date')::date ELSE NULL END
  ) STORED;

CREATE INDEX idx_documents_document_type_norm ON public.documents USING btree (document_type_norm);
CREATE INDEX idx_documents_date_typed         ON public.documents USING btree (date_typed);
```

**NOTE — this migration adds NO RLS** (unlike 071): it adds columns to the existing `documents` table, which already has RLS. No new table → no new policies. (Contrast 071's 4-policies-per-table template, which does NOT apply here.) Next free number is after `073` (research read current max).

**Post-apply:** run `bash scripts/regenerate-full-schema.sh` (no `--reset`), commit migration + regenerated `full-schema.sql` + code together (per CLAUDE.md + `071:5-8`).

---

### `backend/tests/unit/test_113_view_filter_compiler.py` (test, unit) — MODIFY

**Analog:** itself. Three containment-dict tests assert the OLD `{field: value}` contract and must be rewritten to the Fragment shape (R-114-A); the injection test stays byte-for-byte green.

- **`test_eq_compiles`** (`:31-41`), **`test_and_folds_conditions`** (`:44-58`), **`test_empty_filter_no_narrowing`** (`:61-69`) — REWRITE to assert `list[Fragment]` output (these assert `mf == {"document_type": "invoice"}` style dicts today).
- **`test_injection_value_neutralized`** (`:150-165`) — **KEEP byte-for-byte green** (SC#4). Update only the assertion shape to "the payload value rides as a bound literal in the Fragment," same byte-for-byte value check.
- **`test_unknown_op_rejected`** (`:72-99`) — KEEP. The smuggled-op `KeyError` (`:98-99`) is the Pitfall-5 fail-closed proof; the widened Literal must not break it.
- **`test_unknown_field_rejected_at_save`** (`:102-121`) + **`test_underscore_field_excluded`** (`:124-147`) — UNCHANGED (`validate_fields` is untouched).

The xfail-unmark-on-landing convention (`:9-14`) governs the new `test_114_*` files (RESEARCH Wave 0 Gaps).

---

### `frontend/src/components/ingestion/NavRow.tsx` (component, request-response) — NEW

**Analog:** `FolderNode.tsx:110-256` — the row `<div>` (selected styling, icon slot, name/inline-rename, `G` pill, hover `MoreHorizontal` menu). Extract ONE shared primitive; build BOTH Folders and Views from it (D-114-13). **Build Views from the FIXED row, never a clone of the flawed `FolderNode`.**

**Row container + selected styling** (`FolderNode.tsx:110-120`):
```tsx
<div className={cn(
  "flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer group relative transition-colors duration-150",
  isSelected ? "bg-primary/10 text-primary font-medium shadow-sm shadow-primary/5" : "hover:bg-accent/60",
)} onClick={() => { if (!isEditing) onSelect(node.id) }}>
```

**Icon slot** (`FolderNode.tsx:142-148`) — Folders pass amber `FolderIcon`; Views pass a `Funnel`/`Filter` lucide icon:
```tsx
<FolderIconComponent className={cn("h-4 w-4 shrink-0 transition-colors",
  isSelected ? "text-primary" : "text-amber-500/70")} />
```

**Inline rename** (`FolderNode.tsx:151-170`) — the UX-01 reuse idiom (Enter saves, Esc cancels, `onBlur` commits). The `editInputRef` + `editValue` state pattern.

**The `G` pill — FIX while extracting (D-114-13)** (`FolderNode.tsx:183-187`). Today it's an opaque single letter; wrap in a `Tooltip` labeled "Global — shared with everyone":
```tsx
{node.is_global && !isEditing && (
  <span className="shrink-0 text-[9px] font-medium uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">G</span>
)}
```

**Hover action menu** (`FolderNode.tsx:189-255`) — `DropdownMenu` + `MoreHorizontal`. **FIX the debt:** make the trigger keyboard/touch-reachable (today `opacity-0 group-hover:opacity-100` makes it touch-invisible, `:191`). Folders pass New-subfolder + Rename + Delete; Views pass Edit + Rename + Delete (D-114-9).

**Count badge — ADD everywhere (D-114-13/8)** — today only Root shows a count (`FolderTree.tsx:147-149`); add the `<span className="text-xs text-muted-foreground ml-auto">{count}</span>` to every NavRow.

---

### `frontend/src/components/ingestion/FolderNode.tsx` + `FolderTree.tsx` (component) — MODIFY

**Analog:** themselves — refactor onto `NavRow` (sketch 033-A). `FolderNode` recursion (`:296-322`) stays; the row body delegates to `NavRow`. `FolderTree`'s group header + node-list (`:112-196`) is the template `ViewsGroup` mirrors. Also: single soft indent guide + ~3-level indent cap (replace the dense hand-drawn branch lines at `FolderNode.tsx:90-108`).

---

### `frontend/src/components/ingestion/ViewsGroup.tsx` (component, request-response) — NEW

**Analog:** `FolderTree.tsx:112-196` — the group-header + node-list shape, mirrored as a "Views" group below "Folders".

**Group header** (`FolderTree.tsx:115-132`) — the uppercase label + optional action button:
```tsx
<div className="flex items-center justify-between px-2 mb-2">
  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">Views</span>
</div>
```

Rows are `NavRow` with the funnel icon + lazy/cached count badge (count-only resolve) + Edit/Rename/Delete. Click → load `filter_expr` into `FilterBar` (D-114-1). Empty-state copy: "filter documents and Save as view." Seeded globals show the tooltip-labeled `G` pill. Data comes from `GET /document-views` (already leak-safe from 113).

---

### `frontend/src/components/ingestion/ConditionPopover.tsx` (component, event-driven) — NEW

**Analog (composed):** `FolderNode.tsx:209` `DropdownMenu` (for the field→operator menu) + `MoveToFolderDialog.tsx:69-81` `Select` (for value pickers). Type-aware operator menu, operators keyed off `metadata_field.py` `field_type` (string/date/number/boolean/enum) — see the RESEARCH mapping table. **NO on-screen type/operator matrix** (deleted in sketch 030 — the control adapts; one quiet hint suffices).

**`Select` shape to copy** (`MoveToFolderDialog.tsx:69-81`):
```tsx
<Select value={selected} onValueChange={setSelected}>
  <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
  <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
</Select>
```

---

### `frontend/src/components/ingestion/DocumentList.tsx` (component, request-response) — MODIFY

**Analog:** itself — the static 7-column `<table>` (`:266-276`). Responsive column-shedding is **NET-NEW** (the table has zero responsive logic). When the panel narrows the list, drop Type/Size/Chunks columns (keep Filename + Status + Actions). The row-click→panel pattern (`:301-326`, `onSelect?.(doc.id)`) and the action-button cluster (`:334-367`) stay; ADD a "Move to folder" action (see below).

**Column headers to make responsive** (`:266-276`):
```tsx
<th className="px-4 py-3 ...">Filename</th>  // keep
<th className="px-4 py-3 ...">Type</th>      // shed under panel-open
<th className="px-4 py-3 ...">Size</th>      // shed
<th className="px-4 py-3 ...">Chunks</th>    // shed
<th className="px-4 py-3 ...">Status</th>    // keep
<th className="px-4 py-3 text-right ...">Actions</th>  // keep
```

---

### Move-to-folder document-row action (D-114-14) — reuse

**Analog:** `HealthDocumentRow.tsx` — the EXACT reuse pattern (whole dialog + state + endpoint). Add this action to the Documents-page document row. **No drag-drop is built** (none exists today; the original "rejects drag-drop" criterion is struck).

**State + trigger** (`HealthDocumentRow.tsx:35, 146-158`):
```tsx
const [moveOpen, setMoveOpen] = useState(false)
// ... <FolderInput/> trigger button → onClick={() => setMoveOpen(true)}, tooltip "Move to folder"
```

**Dialog mount** (`HealthDocumentRow.tsx:190-196`):
```tsx
<MoveToFolderDialog
  open={moveOpen} documentId={doc.document_id} documentName={doc.filename}
  onClose={() => setMoveOpen(false)} onMoved={(_id) => setMoveOpen(false)} />
```

`MoveToFolderDialog` (`health/MoveToFolderDialog.tsx`, whole) already calls `moveDocument(id, folderId)` (`PATCH /documents/{id}/move`) — zero net-new backend.

---

### `frontend/src/pages/IngestionPage.tsx` (page, request-response) — MODIFY

**Analog:** itself — the push/split grid already mounts a 430px detail-panel track when a doc is selected (`:145-151`). EXTEND: collapse the `w-72` sidebar (`:137`) to a ~50px icon rail when `selectedDoc` is set (D-114-17), user-pinnable + `sessionStorage`-persisted (mirrors the workspace-panel collapse-to-rail). Filter bar → summary chip when panel open. This is a SHARED-SHELL layout inherited by Phases 117/118 — degrade gracefully for their panel content.

**The existing push/split grid** (`:145-151`) — the pattern to extend:
```tsx
<div className="grid flex-1 min-h-0 min-w-0 gap-6" style={{
  gridTemplateColumns: !isMobile && selectedDoc ? "minmax(0,1fr) 430px" : "minmax(0,1fr)",
}}>
```

**The sidebar to collapse** (`:137`):
```tsx
<div className="hidden md:flex w-72 shrink-0 flex-col overflow-y-auto rounded-xl bg-card/50 ghost-border p-3">
  {folderTreeEl}
</div>
```

**State-based nav (UX-01):** the page uses `ActiveView` (`App.tsx:9`, `"chat"|"documents"|...`) + `selectedFolderId`, NO react-router. Views selection joins this state (a `selectedViewId` alongside `selectedFolderId`, mutually exclusive).

---

## Shared Patterns

### Closed-registry dispatch (fail-closed)
**Source:** `view_filter_compiler.py:56-65` (`@register_operator`), `:97-99` (`KeyError` on miss)
**Apply to:** every new operator in `view_operators_extra.py`; the dispatch in `compile_filter`
New operators register by side-effect import. An unregistered op fails closed (`KeyError`) AND the Pydantic `Literal` rejects at parse — two layers, both kept (Pitfall 5).

### Bound-literal parameterization (SC#4 invariant)
**Source:** `view_filter_compiler.py` module docstring (`:1-32`); `document_views.py:254` (`.contains("metadata", filter_dict)` → `metadata @> $1::jsonb`)
**Apply to:** the widened `_apply` (all builder legs), the migration (no f-string SQL), the custom-field leg (field names from whitelist ONLY)
No f-string SQL, no `.format()` into a query, no field-name interpolation from raw user input. Values ride as PostgREST params via `.eq/.gte/.lte/.ilike/.in_/.or_/.is_`. The injection test stays green.

### Per-viewer leak-safe resolution (404-not-403)
**Source:** `document_views.py:200-290` — the own+global two-leg scoped from `caller`, NEVER `view["user_id"]` (`:263`); the 404-not-403 readability gate (`:217-219`)
**Apply to:** the widened resolve, the count-only path
Both legs scoped from the caller; folder_scope intersected with caller-visible folders (`:240-249`); count-only uses the SAME caller-scoping (a count over another user's docs is impossible by construction).

### `count="exact"` (never `len(.select("*"))`)
**Source:** `reembed_service.py:189-201` — `.select("id", count="exact").limit(1)` + the explicit "silent undercount" warning
**Apply to:** the count-only resolve path (D-114-15)
A plain `.select().execute()` caps at PostgREST max-rows (1000) → silent undercount. Use `count="exact"` for any count at scale.

### `run_in_threadpool` around every sync supabase-py call
**Source:** `document_views.py:61` (`from app.utils.db import aexec`), every `.execute()` rides `await aexec(...)`
**Apply to:** the count-only path and any new resolve query (D-v2.5-01)
The async route must never block the event loop on a sync supabase-py call.

### Case-normalization at the write path (the R-114-A grounding)
**Source:** `documents.py:1575-1582` (ingest lowercases `document_type` + `language`); `retrieval_service.py:265-267` (chat path lowercases the query value)
**Apply to:** the view query-value lowercasing in `_apply`
`document_type`/`language` are ALREADY stored lowercase at all write paths. Mirror the chat path: lowercase the VIEW query value (the view resolve path does NOT yet). Reserve `ILIKE`/`lower()=lower()` for un-normalized free-text only (Pitfall 3).

### `folder_scope` subtree as a LIST (never a set)
**Source:** `harness/scope.py:51-89` `resolve_project_subtree` — returns `list[str]`, cycle-guarded, owner-scoped
**Apply to:** any `.in_("folder_id", subtree)` in the widened `_apply` (Pitfall 4)
supabase-py JSON-serializes the `.in_` channel; a `set` raises in `json.dumps`. Keep it a list end to end.

### Inline-rename + hover `MoreHorizontal` menu (the row interaction idiom)
**Source:** `FolderNode.tsx:151-170` (inline rename), `:209-253` (DropdownMenu actions)
**Apply to:** `NavRow`, `ViewsGroup`, the FilterBar Save-as-view name input
Click value → in-place input; Enter saves, Esc cancels, blur commits. The `DropdownMenu`/`MoreHorizontal` shape for row actions.

### Audit on mutation (fire-and-forget, live-verified)
**Source:** `document_views.py:129-134` (`write_audit_entry(action_type="view.create", ...)`); the `view.create` action is in the migration-071 CHECK (`071:33`)
**Apply to:** any new view CRUD the builder triggers (`view.create` already allow-listed; no new audit action needed for 114)
`write_audit_entry` is async and swallows errors → the live round-trip is the real verification.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `frontend/src/components/ingestion/FilterBar.tsx` | component | event-driven | No inline chip-strip filter builder exists in the codebase. Compose shadcn `Button`/`Popover` + the inline-rename idiom (`FolderNode.tsx:151-170`) for Save-as-view + the count-only resolve for the live "N match" count (amber at zero). Design contract = sketch 029-A + `references/virtual-folder-filter-builder.md`. |
| `frontend/src/components/ingestion/RelativeDateControl.tsx` | component | event-driven | No `[N][unit]` stepper-with-live-readout control exists. Net-new per sketch 030-A. The resolved-window readout is computed CLIENT-side for PREVIEW only; the server is authoritative at resolve (D-114-16). CSS in `references/virtual-folder-filter-builder.md`. |

Both are pure UI composition over the resolve/count endpoints — no business logic client-side. Planner should ground them in sketches 029/030 + the SKILL.md Phase-114 section rather than a codebase analog.

## Metadata

**Analog search scope:** `backend/app/services/`, `backend/app/api/`, `backend/app/models/`, `backend/tests/unit/`, `supabase/migrations/`, `frontend/src/components/ingestion/`, `frontend/src/components/health/`, `frontend/src/pages/`
**Files scanned:** `view_filter_compiler.py`, `document_views.py`, `document_view.py`, `metadata_field.py`, `test_113_view_filter_compiler.py`, `071_dm_foundations.sql`, `reembed_service.py`, `retrieval_service.py`, `documents.py`, `harness/scope.py`, `FolderNode.tsx`, `FolderTree.tsx`, `health/MoveToFolderDialog.tsx`, `health/HealthDocumentRow.tsx`, `DocumentList.tsx`, `IngestionPage.tsx`, `App.tsx`
**Pattern extraction date:** 2026-06-19

---

## PATTERN MAPPING COMPLETE

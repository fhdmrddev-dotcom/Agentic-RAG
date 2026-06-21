# Phase 112: Metadata Enrichment — Document Detail Panel + Manual Edit - Research

**Researched:** 2026-06-18
**Domain:** Full-stack additive feature — net-new audited backend write route + re-extract merge guard + net-new React document-detail panel (push/split shell, ConfidenceChip, honest inline edit) on a v3.0 Document-Management surface
**Confidence:** HIGH (every integration point read at file:line; D-111-9 `@>` invariant + confidence distribution + audit enum + `_source`-absence all verified live against :54322)

## Summary

This phase is heavily pre-specified (SPEC.md 7 locked requirements + CONTEXT.md D-01…D-08). Research did NOT re-derive the WHAT — it pinned the exact current code shape at every integration point named in CONTEXT `<canonical_refs>`, and verified the load-bearing invariants against the live local DB. **All four CONTEXT feasibility decisions hold against real code:** D-02 (`_source` as a flat `metadata._source.{field}` sub-key mirroring `_confidence`), D-03 (single-field PATCH + re-extract MERGE), D-05 (metadata display tiers genuinely separate from retrieval buckets), and D-06 (no migration needed) are all confirmed feasible and safe.

The single highest-stakes integration point is the **re-extract merge guard**: today `ingest_document` (`documents.py:1581`) writes `"metadata": metadata_dict` as a **wholesale overwrite** of the entire JSONB blob. Every re-extract path (`/reextract`, `/reingest`, `/upload`) funnels through this one write site. The `_source='user'` preservation guard goes HERE — read the prior `documents.metadata`, and for each field whose `_source[field]=='user'`, restore that field's value + its `_source` marker into the freshly-extracted `metadata_dict` before the write. This is a Phase-101/104-class false-green risk: building the panel + chip without wiring the actual PATCH endpoint and the merge guard would pass static review while being non-functional or silently destroying user edits.

Live DB confirms the CONTEXT D-05 evidence exactly: 8 enriched docs, 53 field scores, median 0.95, mean 0.917, **94.3% ≥ 0.80**, bimodal with 3.8% < 0.50 and the 0.50–0.75 band nearly empty (1.9%). `_source` exists on 0 docs (net-new). The `@>` containment with a nested `_source` sub-key present still matches top-level keys (verified live), and `metadata.update` is already in the live `audit_log` CHECK enum (0 existing rows — clean baseline).

**Primary recommendation:** Put the merge guard at the single `ingest_document` metadata-write site (`documents.py:1581`); add the net-new `PATCH /documents/{id}/metadata` mirroring the existing `move_document` route's RLS-404 + `run_in_threadpool` shape; clone `StatusPill` for `ConfidenceChip` (NOT `ConfidenceBadge`); mount the push/split panel at `IngestionPage.tsx`'s right column; and treat the live-DB assertions (audit row written, `@>` still matches, re-extract preserves source=user, edit round-trips on reload) as the non-negotiable Nyquist gate.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Clicking a document row opens the right-side push/split detail panel; the **existing inline-expand `MetadataPanel` in `DocumentList.tsx` is RETIRED** — one honest metadata surface, no duplication/drift. Panel mounts at the `IngestionPage.tsx` layout level wrapping `DocumentList` (push/split grid `minmax(0,1fr) 430px`, list shrinks but stays visible). Mobile (≤ project breakpoint) falls back to a bottom-sheet (sketch 027).
- **D-02:** The per-field `source` marker is stored as a **parallel `metadata._source.{field}` sub-key**, mirroring the existing `metadata._confidence.{field}` pattern from Phase 111. Top-level field values stay flat, so the `documents.metadata @> filter` JSONB containment pre-filter (the load-bearing **D-111-9** invariant) is unaffected. No nested per-field `{value,source,confidence}` objects.
- **D-03:** A net-new **`PATCH /documents/{id}/metadata`** accepts a single `{field, value}` (built-in field name OR custom `field_key`). Server: writes the value into `documents.metadata[field]`, stamps `_source[field]='user'`, and writes a `metadata.update` audit row via `write_audit_entry`. **RLS owner-scoped** — a non-owner gets **404** (no existence leak). Re-extraction (`POST /{id}/reextract` → `ingest_document` enriched path) **MERGES**: fields with `_source='user'` are preserved (value + source + their "Edited" status, no confidence), every other field is refreshed from the model. A user-owned field renders the neutral **"✎ Edited"** chip (no score, no green). Single-field PATCH (not whole-object PUT) avoids clobber/concurrency hazards.
- **D-04:** The panel **fetches enabled custom-field definitions from the existing `/metadata-fields` CRUD** (`backend/app/api/metadata_fields.py`), renders each with an edit control chosen by its `field_type`, and **ignores internal `_`-prefixed keys** (`_confidence`, `_source`). Custom-field values persist via the SAME PATCH endpoint under their `field_key`. The panel renders the union of (known built-in fields) + (enabled custom defs) — never raw metadata keys.
- **D-05:** Metadata display tiers = hardcoded named constants **High ≥ 0.75 / Med 0.50–0.74 / Low < 0.50** (NOT a settings knob; NOT the retrieval `confidence_bucket_*` settings). Raw score is always shown. Treat as a **tunable constant; re-verify against the live distribution at UAT.** Metadata display tiers are a SEPARATE system from retrieval confidence (`confidence_bucket_high/medium` 0.54/0.38, `agent_loop.py:692`) — never conflate.
- **D-06:** Phase 112 needs **NO new SQL migration**. `_source` lives inside the existing `documents.metadata` JSONB; `metadata.update` is already a valid `audit_log` action (Phase 110, migration 071). Purely additive: one backend route + the re-extract merge guard + frontend.
- **D-07:** No open `surface: Agentic-RAG` bug overlaps the document-detail / metadata-display-edit domain. **Routing: leave all open; none fold into 112.**
- **D-08:** Phase 112 does **NOT** touch streaming, agent loop, or provider routing — the **SC#10 4-axis cross-provider UAT does NOT apply**. Acceptance = **G-4 lived-experience UI UAT** + **WCAG 2.1 AA** + the **honest-states matrix**.

### Claude's Discretion
- Edit concurrency model (optimistic UI + last-write-wins on a single field is acceptable — owner-scoped, effectively single-writer).
- Exact edit-control mapping per `field_type` (text / textarea / date / select) and whether array fields (e.g. `topics`) are editable as chips in v1 or text-only.
- Save-receipt animation timing + the `prefers-reduced-motion` instant-render path.
- Whether the PATCH body is one field or a tiny partial map (single field is the contract; a small batch is an allowed optimization if needed).

### Deferred Ideas (OUT OF SCOPE)
- **Settings-configurable metadata display tiers** — out of scope now (D-05); raw score keeps the chip honest with hardcoded constants.
- **Relationships accordion section** → Phase 117 (adds to THIS shell). **Classification accordion section** → Phase 118. **Versions section** → later (version data already exists via `fetchDocumentVersions`).
- **Governance "low-confidence metadata" signal** → Phase 119 links back into this panel's `ConfidenceChip`.
- (From SPEC out-of-scope) inert REL/CLASS/Versions stubs; bulk "confirm all extracted"; triggering re-extraction from the panel; changing the extraction engine/model/window; rescaling confidence into a percentage; reusing retrieval `0.54/0.38` buckets as display tiers.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| META-02 | See per-field confidence | `documents.metadata._confidence` already stored (`embedding_service.py:233` `attach_confidence`; live: 8 docs / 53 scores). Net-new `ConfidenceChip` (clone `StatusPill.tsx`) renders glyph+word+raw score. Frontend `DocumentMetadata` type (`types/index.ts:190`) has NO `_confidence`/`_source` fields → must extend. |
| META-05 | Manually edit/override, audit-logged | Net-new `PATCH /documents/{id}/metadata` in `documents.py` (mirror `move_document` route at `:1288`); calls `write_audit_entry(user_id, 'metadata.update', {...}, supabase)` (`audit_service.py:57`); `metadata.update` already in `VALID_ACTION_TYPES` (`audit_service.py:24`) + live CHECK enum (verified). RLS owner-scope → 404 on non-owner. `_source[field]='user'` stamp + re-extract merge guard at `documents.py:1581`. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-field confidence storage | Database (existing JSONB `_confidence`) | API (read path) | Already produced by Phase 111 extraction; display-only nested key, never a flat filter dim |
| Per-field `_source` marker write | API (`PATCH` route) | Database (JSONB) | The marker is set ONLY by a human edit — it is application state, written server-side at PATCH time, not extracted |
| Metadata write + audit | API / Backend | Database (`documents`, `audit_log`) | Auth, RLS owner-scope, audit row are backend concerns; never trust the client to assert provenance |
| Re-extract merge precedence | API / Backend (`ingest_document`) | — | The `_source='user'` preservation guard must live at the single metadata-write site so ALL re-extract paths inherit it |
| Custom-field definition fetch | API (`/metadata-fields`, exists) | Frontend (net-new client) | Backend CRUD exists; frontend has NO consumer yet |
| ConfidenceChip render + tier mapping | Frontend (Client) | — | Pure display logic; hardcoded tier constants live in the chip component |
| Panel shell + inline edit interaction | Frontend (Client) | — | Push/split layout, accordion, click-to-edit, save receipt — all client UI state |
| WCAG AA / contrast / keyboard | Frontend (Client) | — | Panel-scoped AA tokens (CSS), aXe automated check, keyboard operability |

## Per-Integration-Point Findings (current shape → precise additive change)

### BACKEND 1 — `backend/app/api/documents.py` (the PATCH host + the merge site)

**Existing route pattern to MIRROR** — `move_document` (`documents.py:1288-1331`), a `@router.patch("/{document_id}/move")`:
```python
@router.patch("/{document_id}/move", response_model=DocumentResponse)
async def move_document(document_id: str, body: DocumentMoveRequest,
                        current_user: dict = Depends(get_current_user),
                        supabase: Client = Depends(get_supabase)):
    # 1. Verify ownership → 404 on miss (no existence leak)
    doc = supabase.table("documents").select("id").eq("id", document_id)\
        .eq("user_id", current_user["id"]).maybe_single().execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")
    # 3. UPDATE ... .eq("id", document_id).eq("user_id", current_user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")
    return result.data[0]
```
NOTE: `move_document` does NOT wrap its sync supabase calls in `run_in_threadpool` (it predates the D-v2.5-01 sweep). The NEW PATCH route MUST use `run_in_threadpool` for every `.execute()` (the `reextract_document` route at `:1033-1042` is the correct threadpool-wrapped owner-SELECT template — copy THAT shape, not `move_document`'s raw calls).

**Precise additive change — net-new `PATCH /documents/{id}/metadata`:**
1. Pydantic body model (net-new, top of file near `ReextractRequest` at `:60`): `class MetadataUpdateRequest(BaseModel): field: str; value: <Any | str | None>` (see Open Question 1 for value typing).
2. Owner SELECT wrapped in `run_in_threadpool` (mirror `:1033-1042`): `select("metadata").eq("id",id).eq("user_id",uid).eq("is_latest",True).maybe_single()` → `if not doc.data: raise HTTPException(404)`.
3. Validate `field` is an allowed key: one of the 7 built-ins (`{"title","author","date","document_type","topics","language","summary"}` — mirrors `_BUILTINS` at `models/metadata_field.py:17`) OR an enabled custom `field_key` for this owner (read via `read_enabled_field_defs(supabase, uid)` from `embedding_service.py:270`, or the `/metadata-fields` list). Reject `_`-prefixed keys (the `_KEY_RE` at `metadata_field.py:21` already forbids leading underscore on custom keys; the route must additionally reject any `field` starting with `_`).
4. Read current `metadata` (or `{}`), set `metadata[field]=value`, set `metadata.setdefault("_source",{})[field]="user"`. If `value is None`/empty AND the intent is "clear" — see Open Question 3 (delete-vs-empty). Lowercase `document_type`/`language` to match `ingest_document:1457-1461` normalization (so a user-edited `document_type` still matches `@>` filters).
5. `UPDATE documents SET metadata=<merged> WHERE id=? AND user_id=?` wrapped in `run_in_threadpool` → `if not result.data: raise HTTPException(404)`.
6. `await write_audit_entry(user_id=uid, action_type="metadata.update", metadata={"document_id":id,"field":field}, supabase=supabase)` — `write_audit_entry` is async + swallows exceptions (`audit_service.py:57-74`), so the live round-trip is the real verification (the create-field router at `metadata_fields.py:72` is the exact precedent — it `await`s the call inline, not as a BackgroundTask).
7. Return the updated `DocumentResponse` (`result.data[0]`).

**THE MERGE SITE — `ingest_document` at `documents.py:1334`, write at `:1570-1585`:**
Today the final write is a **wholesale overwrite**:
```python
supabase.table("documents").update({
    ...,
    "metadata": metadata_dict,   # documents.py:1581 — OVERWRITES the entire JSONB blob
    "full_markdown": text,
    "extractor": engine_used,
}).eq("id", document_id).execute()
```
`metadata_dict` is the freshly-extracted blob (`attach_confidence(emitted.model_dump(exclude_none=True))` at `:1447`) or `None` on degrade. ALL re-extract entry points funnel here: `reextract_document` (`:1178` `background_tasks.add_task(ingest_document,...)`), `reingest_document` (`:741` → `_upload_pipeline` → `:241` `ingest_document(...)`), `/upload` (same). **There is exactly ONE metadata-write site** — the merge guard belongs here.

### BACKEND 2 — `backend/app/services/embedding_service.py` (the `_confidence` shape to mirror for `_source`)

- `build_metadata_model(custom_defs)` (`:185`) — builds a runtime Pydantic model: 7 built-ins + enabled custom fields + a PUBLIC `confidence` field (`fields["confidence"] = (dict[str, float], Field(default_factory=dict))` at `:229`). The public name (no underscore) is deliberate — a `_`-prefixed Pydantic field is a private attr and silently excluded from `model_dump`.
- `attach_confidence(dumped)` (`:233-246`) — the post-dump rename: `out = dict(dumped); conf = out.pop("confidence", None); if conf: out["_confidence"] = conf; return out`. A missing/empty `confidence` is dropped (no empty `_confidence` key).
- Call chain at `documents.py:1447`: `metadata_dict = attach_confidence(emitted.model_dump(exclude_none=True)) if emitted else None`. `exclude_none=True` is applied at the `model_dump` step → empty fields are genuinely ABSENT (never `""`).

**`_source` write shape (mirrors `_confidence` exactly):** `_source` is a flat sibling sub-key `metadata._source = {field_key: "user"}`, written ONLY by the PATCH route (NOT by extraction — the model never emits a source). It is a plain `dict[str,str]` set server-side. Extraction continues to produce only `_confidence`; the absence of a `_source[field]` entry implicitly means `source=extracted`. This keeps the serialization path identical: both `_confidence` and `_source` are nested display-only objects that never become flat `@>` filter dimensions.

### BACKEND 3 — `backend/app/services/audit_service.py` (the audit call)

- `VALID_ACTION_TYPES` (`:13-26`) — `metadata.update` IS present (`:24`, "# Phase 112") and `metadata.field.create` (`:25`). **Verified live:** `metadata.update` is in the live `audit_log_action_type_check` CHECK enum (migration 071); 0 existing rows.
- Signature (`:57`): `async def write_audit_entry(user_id: str, action_type: str, metadata: dict, supabase: Client) -> None`. Fire-and-forget; catches/logs/swallows all exceptions (`:67-74`). Writes via `aexec(supabase.table("audit_log").insert({...}))`.
- Exact call shape for the PATCH route (precedent `metadata_fields.py:72-77`):
```python
await write_audit_entry(user_id=current_user["id"], action_type="metadata.update",
                        metadata={"document_id": document_id, "field": field}, supabase=supabase)
```

### BACKEND 4 — `/metadata-fields` CRUD (custom-field defs the panel fetches)

- Router `backend/app/api/metadata_fields.py`: `GET /metadata-fields` (`:31`) → `list_metadata_fields` → `metadata_field_service.list_field_definitions(uid, supabase)`. Returns `list[MetadataFieldResponse]`.
- `list_field_definitions` (`metadata_field_service.py:34`): `select("*").or_(f"user_id.eq.{uid},is_global.eq.true").order("field_key")`, deduped by id. **Returns own + global defs, BUT does NOT filter on `enabled`** — the panel must filter `enabled === true` client-side (or the planner adds a server filter; the extraction path's `read_enabled_field_defs` at `embedding_service.py:270` DOES filter `enabled` — the panel should match that semantics).
- `MetadataFieldResponse` (`models/metadata_field.py:60-68`): `{ id, user_id?, field_key, field_type, description?, options?, is_global, enabled }`.
- `field_type` closed vocab (`models/metadata_field.py:26`): `Literal["string","date","number","boolean","enum"]`. `enum` carries `options: list[str]`.
- `field_key` regex (`:21`): `^[a-z][a-z0-9_]*$`, must not collide with the 7 built-ins, no reserved `_`-prefix.
- **Live state:** 1 field def (`probe_k`, type `string`, enabled, not global).

### BACKEND 5 — the `@>` containment pre-filter (D-111-9 invariant)

- The filter is `d.metadata @> metadata_filter` inside the RPC functions: `match_document_chunks` (`supabase/full-schema.sql:132`), `keyword_search_chunks` (`:108`), and all migrations (007/008/016/020/023/025/034). Source of `metadata_filter`: `tool_dispatcher.py:174` → `retrieval_service.py` (`:60,82,267`) — it only ever carries top-level scalar keys (`document_type`, `author`, `date`), never `_source`/`_confidence`.
- **Verified live against :54322:** a blob `{"document_type":"report","title":"X","_confidence":{...},"_source":{"title":"user","document_type":"extracted"}}` still matches `@> {"document_type":"report"}` → True, and `@> {"title":"X"}` → True; negative control `@> {"document_type":"invoice"}` → False. **Adding `_source` does NOT break top-level containment** (same proof as the existing `test_111_flat_filter_compat.py`). D-111-9 holds; D-06 (no migration) confirmed.

### FRONTEND 6 — `frontend/src/pages/IngestionPage.tsx` (panel mount + selected-doc state)

- Current layout (`:79`): `<div className="flex flex-row gap-6 flex-1 min-h-0">` with a left folder-tree (`w-72 shrink-0`) and a right column `<div className="flex-1 flex flex-col overflow-y-auto space-y-6">` (`:96`) that mounts `DocumentUpload` (`:119`) + `DocumentList` (`:128`).
- `DocumentList` is passed `documents, onDelete, onRefresh, folderId, currentUserId` (`:128-134`).
- **Precise additive change:** add `selectedDocId` state at this level. Wrap the right column in the push/split grid `minmax(0,1fr) 430px` so the document list shrinks and the panel occupies the 430px track. Pass `selectedDocId`/`onSelect` into `DocumentList`. Mount the net-new `<DocumentDetailPanel docId={selectedDocId} onClose={...} />` in the second grid track; on mobile (≤ project breakpoint) render it as a bottom-sheet instead. The page already wraps everything in `<TooltipProvider>` (`:49`) — reuse it. `useDocuments()` (`:16`) already exposes `documents` + `loadDocuments` — pass the selected `Document` (with its `.metadata`) to the panel, and call `loadDocuments()` to reconcile after an edit.

### FRONTEND 7 — `frontend/src/components/ingestion/DocumentList.tsx` (retire inline MetadataPanel + row-click)

- The inline `MetadataPanel` (`:32-86`) is the RETIRE target — a plain-text dump of title/author/date/type/language/topics/summary, **no confidence, no editing**.
- The expand mechanism: `expanded: Set<string>` state (`:230`), `toggle(id)` (`:266`), a chevron button (`:335-343`), and TWO expansion rows gated by `expanded.has(doc.id)` — `MetadataPanel` (`:408-414`) AND `VersionHistoryPanel` (`:415-426`). **Landmine:** the same expand toggle drives BOTH metadata and versions. Retiring metadata-inline-expand while keeping versions inline (versions are deferred to a later panel section, not this phase) means the chevron/`expanded` machinery must STAY for versions; only the `MetadataPanel` branch (`:408-414`) is removed, and a NEW row-click → `onSelect(doc.id)` opens the panel. Decide: row-click opens panel; chevron still toggles version history. Or: keep chevron for versions, make the filename cell a separate click target for the panel. (Open Question 4.)
- `isExpandable` (`:310`) = `hasMetadata || hasVersions`; `hasMetadata` (`:306`) = `status==='completed' && metadata != null`.

### FRONTEND 8 — `frontend/src/components/chat/StatusPill.tsx` (clone source for ConfidenceChip)

- Anatomy (`:69-89`): `<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[10px] uppercase tracking-wider flex-shrink-0 {VARIANT}">` + a glyph `<span aria-hidden>` + `<span className="tabular-nums">{label}</span>`.
- `VARIANTS` (`:38-44`) maps a status to bg/text classes (e.g. `done: "bg-success/15 text-success"`). The `ConfidenceChip` clones this shape but swaps the variant map for the tier-tinted classes from GROUNDING.md (High `bg-[hsl(var(--panel-status-done)/0.15)] text-[hsl(var(--panel-status-done))]`, Med `--panel-status-active`, Low `bg-destructive/15 text-[hsl(0_80%_80%)]`, Manual `bg-transparent border-border text-panel-muted-foreground` — no score/no green, Extracted neutral Sparkles).
- **`ConfidenceBadge.tsx` is confirmed the WRONG base:** it takes a `ConfidenceResult` object (`{level, disclaimer}`), uses raw Tailwind color tokens (`text-green-500`/`text-amber-500`/`text-red-500`, NOT panel-scoped AA tokens), renders `● {Level} confidence` with NO raw score and NO glyph+word+score enforcement, and has no honest Edited/Extracted/empty states. It is a chat display widget, not a metadata chip.

### FRONTEND 9 — `frontend/src/components/panel/PanelSection.tsx` (accordion shell)

- Props (`:23-30`): `{ title, count?: PanelSectionCount, warn?: boolean, defaultOpen?: boolean, children }`. `count` is `{done?,total?} | number`. `warn` ambers the count badge.
- A11y (`:55-99`): the head is a real `<button id aria-expanded aria-controls>`; the body is `<div role="region" aria-labelledby={headId}>`; collapse is `display:none` (instant). Uses panel-scoped AA tokens `text-panel-muted-foreground-dim` / `text-panel-muted-foreground` (`:66,86`), warn → `text-[hsl(var(--warning))]`.
- **Reuse directly:** the Metadata section is `<PanelSection title="Metadata" warn={low+emptyCount>0} count={low+emptyCount} defaultOpen>{...fields}</PanelSection>`. No new accordion primitive needed.

### FRONTEND 10 — `frontend/src/components/ingestion/FolderNode.tsx` (inline-edit pattern to mirror)

- Pattern (`:151-170`): `isEditing` toggle → conditional render of an `<input ref autoFocus>` with `onChange`, `onBlur={()=>onCommitRename(...)}`, and `onKeyDown` handling `Enter` (`preventDefault` + commit) and `Escape` (`preventDefault` + cancel). Input classes: `px-1.5 py-0.5 text-sm bg-background border border-primary/30 rounded-md outline-none focus:ring-1 focus:ring-primary/40`. `onClick={e=>e.stopPropagation()}` to prevent the row-select firing.
- **Mirror for the field edit control.** GROUNDING adds: a guarded blur-commit (only if changed & not Esc & focus didn't move to Save/Cancel), Esc restores focus to the trigger (useRef), and per-`field_type` control swap (string→Input, summary→Textarea with Cmd/Ctrl+Enter, date→date Input, enum→Select, topics/multiselect→pill editor).

### FRONTEND 11 — Panel-scoped AA tokens (CSS)

- Defined in `frontend/src/index.css`, both themes, with documented contrast ratios on the panel surface:
  - `--panel-surface` (dark `220 40% 8%` = #0c121d; `:121`).
  - `--panel-status-done` (dark `142 71% 55%` → 10.63:1; `:139`) — HIGH chip.
  - `--panel-status-active` (dark `38 92% 62%` → 10.48:1; `:140`) — MED chip.
  - `--panel-muted-foreground` (dark `220 16% 65%` → 7.21:1; `:131`) — neutral Edited/Extracted text. **NEVER global `--muted-foreground` (3.59:1, FAILS AA).**
  - `--panel-muted-foreground-dim` (`:132`) — section head.
  - Lightened red `hsl(0 80% 80%)` ≥4.5:1 — LOW chip text (use directly, NOT raw `--destructive`).

### FRONTEND 12 — Data fetch + API client wiring

- `useDocuments()` (`hooks/useDocuments.ts`) — owns `documents` + Realtime subscription + `loadDocuments()` (refetches on terminal status). Realtime is best-effort (D-v2.5-03) → reconcile via `loadDocuments()` after an edit. **No metadata-edit method exists** — net-new.
- API client (`frontend/src/lib/api.ts`): `moveDocument` (`:1971`) is the exact PATCH template: `const headers = await getAuthHeaders(); fetch(\`${API_BASE}/documents/${id}/move\`, {method:"PATCH", headers, body: JSON.stringify({...})}); if (!res.ok) throw; return res.json()`.
  - **Net-new client methods:** `updateDocumentMetadata(id, field, value)` → `PATCH /documents/${id}/metadata`; `listMetadataFields()` → `GET /metadata-fields`. **Confirmed: the frontend has ZERO existing `/metadata-fields` consumer** (no `listMetadataFields`, no `MetadataField` type, no hook) — the entire custom-field-defs fetch is net-new frontend work.
- `DocumentMetadata` type (`types/index.ts:190-198`): currently `{title?,author?,date?,document_type?,topics?,language?,summary?}` — NO `_confidence`, NO `_source`, NO index signature for custom keys. **Must extend:** add `_confidence?: Record<string,number>`, `_source?: Record<string,"user"|"extracted">`, and an index signature (or a typed custom-field map) so custom `field_key`s read through.

## The Re-Extract Merge Contract (exact location + pseudocode)

**Location:** `backend/app/api/documents.py`, function `ingest_document` (def at `:1334`), at the final write `:1570-1585` (the `"metadata": metadata_dict` line is `:1581`). This is the SINGLE metadata-write site; all paths (`/upload`, `/reingest`, `/reextract`) funnel through it.

**Merge algorithm (pseudocode against the REAL current code):**
```python
# ... after metadata_dict is built (line ~1453) and document_type/language
# normalized (lines 1457-1461), BEFORE the final UPDATE at 1570:

# Re-extract precedence guard (Phase 112 D-03):
# preserve any field a human has marked _source='user' across re-extraction.
prior = supabase.table("documents").select("metadata") \
    .eq("id", document_id).maybe_single().execute().data  # sync — already in BackgroundTask thread, no threadpool needed
prior_meta = (prior or {}).get("metadata") or {}
user_fields = (prior_meta.get("_source") or {})  # {field: "user"}
if user_fields:
    metadata_dict = metadata_dict or {}          # may be None on degrade — promote to {}
    preserved_source = metadata_dict.setdefault("_source", {})
    for field, src in user_fields.items():
        if src != "user":
            continue
        # restore the human value (or delete if the human had cleared it)
        if field in prior_meta:
            metadata_dict[field] = prior_meta[field]
        else:
            metadata_dict.pop(field, None)        # human cleared it → keep it cleared
        preserved_source[field] = "user"          # keep the marker
        # do NOT carry _confidence for a user field — a human override has no model score
        metadata_dict.get("_confidence", {}).pop(field, None)
# (then the existing UPDATE at 1570 writes the merged metadata_dict)
```
Key invariants the planner must encode as acceptance criteria:
- A `_source='user'` field's VALUE survives re-extract unchanged; an un-edited (`extracted`) field IS refreshed from the model.
- A user field carries NO `_confidence` entry after merge (so the chip renders neutral "✎ Edited", never a fabricated score).
- If `metadata_dict` came back `None` (degrade), but the prior doc had user fields, the result is `{user fields + _source}` — NOT `None` (a degrade must not wipe human edits).
- `document_type`/`language` user edits stay lowercased (the PATCH route lowercases them, matching `:1457-1461`), so `@>` filters keep matching.

## Standard Stack

No new libraries. Everything is in-repo and already used.

### Core (all existing — verify versions only)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI + Pydantic v2 | (in-repo) | The PATCH route + body model | Project standard; `move_document`/`metadata_fields` precedent |
| supabase-py | (in-repo) | DB read/write for documents + audit_log | Wrapped in `run_in_threadpool` per D-v2.5-01 |
| React 18 + Vite + Tailwind + shadcn/ui | (in-repo) | Panel + chip + inline edit | Aether / Deep Midnight design system |
| lucide-react | (in-repo) | Chip glyphs (CheckCircle2, AlertTriangle, PencilLine, Sparkles) | Already the icon set (StatusPill/FolderNode use it) |
| vitest 4.1 + @testing-library/react + vitest-axe 0.1.0 | (in-repo) | Component + a11y/contrast tests | `vitest-axe` makes AC#11 (no AA failures) AUTOMATABLE |
| pytest (`asyncio_mode=auto`) | (in-repo) | Route + merge unit/integration tests; live :54322 integration | `test_111_flat_filter_compat.py` is the live-DB integration template |

**Installation:** none. **Version verification:** `vitest-axe ^0.1.0` confirmed in `frontend/package.json`; backend deps unchanged (no new imports beyond what `documents.py` already imports — `write_audit_entry`, `run_in_threadpool`, `read_enabled_field_defs` are all already importable).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single-field PATCH | Whole-object PUT | REJECTED by D-03 — clobber/concurrency hazard, would overwrite concurrent edits + force the client to round-trip the whole blob |
| Flat `metadata._source` sub-key | Nested `{value,source,confidence}` per field | REJECTED by D-02 — nested objects break the flat `@>` containment filter and force a filter rework |
| Clone `StatusPill` for the chip | Reuse `ConfidenceBadge` | REJECTED — `ConfidenceBadge` has no glyph+word+score enforcement, raw color tokens (fail AA), no honest states |

## Architecture Patterns

### System Architecture Diagram (data flow)
```
[User clicks a document row in DocumentList]
        │
        ▼
[IngestionPage: setSelectedDocId] ──pushes──► [push/split grid minmax(0,1fr) 430px]
        │                                              │
        │ (Document w/ .metadata from useDocuments)    ▼
        │                                   [DocumentDetailPanel]
        │                                       │   ├─ GET /metadata-fields ──► enabled custom defs (net-new client)
        │                                       │   └─ render union(7 built-ins, enabled custom defs)
        │                                       ▼
        │                                   [PanelSection "Metadata" accordion]
        │                                       │  per field: value + ConfidenceChip
        │                                       │  chip tier ← _confidence[field] (High≥.75/Med≥.50/Low<.50)
        │                                       │  _source[field]==='user' → neutral "✎ Edited" (no score)
        │                                       │  no _confidence entry → neutral "✦ Extracted"
        │                                       │  field absent → "Not extracted — add"
        │                                       ▼
        │                              [click value → inline edit control (per field_type)]
        │                                       │ Enter/blur commit
        │                                       ▼
        │                              PATCH /documents/{id}/metadata {field,value} (net-new client)
        ▼                                       │
[Backend: PATCH route]◄──────────────────────────┘
   1. owner SELECT .eq(user_id) → 404 on miss (no leak)   [run_in_threadpool]
   2. validate field ∈ builtins ∪ enabled custom keys; reject _-prefix
   3. metadata[field]=value; metadata._source[field]='user'; lowercase dt/lang
   4. UPDATE documents SET metadata=… WHERE id AND user_id  [run_in_threadpool]
   5. await write_audit_entry(uid,'metadata.update',{document_id,field},sb)──► [audit_log INSERT]
   6. return DocumentResponse
        │
        ▼
[Panel: 200 → "🛡 Saved · audit logged" receipt; chip → neutral Edited; loadDocuments() reconcile]

── Separately, RE-EXTRACT (POST /reextract|/reingest|/upload) ──►
   [_upload_pipeline / reextract_document] ──► [ingest_document  documents.py:1334]
       extract → metadata_dict (attach_confidence) → MERGE GUARD (read prior _source='user',
       restore those field values + markers, drop their _confidence) → UPDATE metadata (:1581)
```

### Pattern 1: RLS owner-scope → 404 (never 403)
**What:** every owner-gated route filters `.eq("user_id", current_user["id"])` and returns 404 on a miss — a non-owner cannot distinguish "not yours" from "doesn't exist."
**When to use:** the new PATCH route (and the `field` existence is also owner-scoped — a custom `field_key` belonging to another user is invalid).
**Example:** `documents.py:1050-1052` (`reextract_document`) / `:1305-1306` (`move_document`).

### Pattern 2: `run_in_threadpool` for sync supabase-py in an async handler (D-v2.5-01)
**What:** wrap every `.execute()` in `await run_in_threadpool(lambda: ...execute())`; keep auth predicates inside the lambda so they stay verbatim.
**Example:** `documents.py:1033-1042`. NOTE: `move_document` (`:1297-1327`) does NOT do this — do not copy it as the threadpool template.

### Pattern 3: Flat `_`-sub-key display data (never a flat filter dimension)
**What:** `_confidence` and `_source` are nested display-only objects; top-level scalar fields are the only `@>` filter dims. Proven live.
**Example:** `embedding_service.py:233` (`attach_confidence`), the merge guard, `test_111_flat_filter_compat.py`.

### Anti-Patterns to Avoid
- **Building the panel/chip without the PATCH endpoint + merge guard** — Phase-101/104-class false-green (static review passes; feature is non-functional or silently destroys edits).
- **Green/scored chip on a manual override** — violates the honesty contract; lock the "no green on a manual override" in a code comment (reviewers WILL try to "fix" it).
- **Fabricating "High" on an unscored field** — neutral "✦ Extracted" only.
- **Coercing an empty field to `""`** — `exclude_none` keeps it absent → render "Not extracted — add".
- **Conflating metadata display tiers (0.75/0.50) with retrieval buckets (`agent_loop.py:692` 0.54/0.38)** — genuinely separate code paths (proven below).
- **Using global `--muted-foreground` (3.59:1) anywhere in the panel** — panel-scoped AA tokens only.
- **Nesting `{value,source,confidence}` per field** — breaks `@>` containment.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accordion section w/ a11y | A custom collapsible | `PanelSection` (`panel/PanelSection.tsx`) | APG `aria-expanded`/`aria-controls`/`role=region` + warn-count badge already correct |
| Chip anatomy | A new pill | clone `StatusPill` (`chat/StatusPill.tsx`) | `inline-flex rounded-full font-mono text-[10px]` shape proven |
| Inline edit (toggle/autofocus/Enter-Esc-blur) | New edit machinery | `FolderNode` pattern (`ingestion/FolderNode.tsx:151`) | Keyboard + focus handling already worked out |
| Audit write | A direct insert | `write_audit_entry` (`audit_service.py:57`) | Validates action type, swallows errors, single write path |
| Custom-field defs | Re-query the table | `GET /metadata-fields` (`metadata_fields.py:31`) | Own+global scoping already enforced server-side |
| AA tokens | Pick colors | `--panel-status-done/-active`, `--panel-muted-foreground`, `hsl(0 80% 80%)` | Contrast ratios pre-verified in `index.css` |
| WCAG/contrast assertion | Manual eyeball | `vitest-axe` | Already a dependency; AC#11 becomes automatable |

**Key insight:** Phase 112 is 80%+ assembly of shipped primitives. The genuinely net-new work is narrow: the PATCH route, the merge guard, the `ConfidenceChip` variant map, the panel shell wiring, and the two net-new frontend API-client methods (`/metadata-fields` has NO existing frontend consumer).

## Runtime State Inventory

> This is an additive feature phase (no rename/refactor/migration), but D-02/D-03/D-06 touch stored JSONB shape, so the state surface is inventoried for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `documents.metadata` JSONB: 27 rows have metadata, 8 have `_confidence` (53 field scores), **0 have `_source`** (verified live :54322) | Net-new `_source` key written by the PATCH route + merge guard; NO backfill migration needed — absence of `_source[field]` = `extracted` |
| Live service config | None — no external service stores the panel/edit state | None — verified (the only external state is Supabase, owned by the app) |
| OS-registered state | None | None — verified (no scheduled tasks / process registrations involved) |
| Secrets/env vars | None new | None — uses existing `SUPABASE_*` creds; no new secret |
| Build artifacts | None — no package/binary rename | None — purely additive code; frontend `DocumentMetadata` type + new components/client methods are net-new source |

**Audit enum:** `metadata.update` already in `VALID_ACTION_TYPES` (`audit_service.py:24`) AND the live `audit_log_action_type_check` CHECK (verified) — no enum migration. **D-06 confirmed: no SQL migration needed.**

## Common Pitfalls

### Pitfall 1: The merge guard at the wrong layer (false-green re-extract preservation)
**What goes wrong:** the `_source='user'` preservation logic is added to the PATCH route or a re-extract wrapper instead of the single `ingest_document` write site, so one of the three re-extract entry points (`/upload`, `/reingest`, `/reextract`) still wholesale-overwrites and silently destroys an edit.
**Why:** there are three entry points but ONE write site (`documents.py:1581`); a test that only drives `/reextract` would false-green a guard placed in the `/reextract` handler.
**Avoid:** put the guard at `ingest_document` (`:1570`); test that an edit survives `/reingest` AND `/reextract` (live :54322).
**Warning signs:** the guard reads `body.field` (PATCH-scoped) instead of the prior doc's `_source` map.

### Pitfall 2: `metadata_dict=None` on degrade wipes user edits
**What goes wrong:** enriched extraction degrades to `metadata_dict=None` (`:1450`); the merge guard runs `for field in user_fields` against a `None` and either crashes or writes `None`, blowing away the human edit.
**Avoid:** promote `metadata_dict = metadata_dict or {}` at the top of the guard; assert "degrade preserves user fields" as a unit test.

### Pitfall 3: Conflating the two confidence systems
**What goes wrong:** the chip reuses `confidence_bucket_high/medium` (0.54/0.38) from `app_settings`, mislabeling a 0.60 metadata field as the wrong tier.
**Why:** both are "confidence" but `_compute_confidence` (`agent_loop.py:664`) maps RETRIEVAL cosine-similarity, a different input. **Verified separate:** the metadata path (`embedding_service.extract_metadata_enriched`) never calls `_compute_confidence`, and the retrieval path never reads `documents.metadata._confidence`.
**Avoid:** hardcode 0.75/0.50 as named constants in the chip; add a code comment naming the threshold source; never import the settings buckets here.

### Pitfall 4: `@>` filter regression from a wrong `_source` shape
**What goes wrong:** `_source` written as a flat scalar (`metadata._source = "user"`) or per-field nested objects pollute top-level containment.
**Avoid:** `_source` is a nested `dict[str,str]` sibling of `_confidence`. Verified: nested sub-key does NOT break `@>` (live). Keep the `test_111_flat_filter_compat.py`-style assertion for `_source`.

### Pitfall 5: The honesty contract regression
**What goes wrong:** a reviewer "fixes" the neutral Edited chip to green, or an unscored field renders "High."
**Avoid:** code-comment the rationale at the chip; vitest-axe + a unit test that asserts (a) an edited field renders no score/no success class, (b) an unscored stored field never renders "High."

## Code Examples

### PATCH route skeleton (mirror move_document + reextract threadpool)
```python
# Source: pattern from backend/app/api/documents.py:1288 (move) + :1033 (threadpool) + :1078 (await write_audit_entry precedent metadata_fields.py:72)
class MetadataUpdateRequest(BaseModel):
    field: str
    value: object | None   # see Open Question 1 for tighter typing

@router.patch("/{document_id}/metadata", response_model=DocumentResponse)
async def update_document_metadata(document_id: str, body: MetadataUpdateRequest,
                                   current_user: dict = Depends(get_current_user),
                                   supabase: Client = Depends(get_supabase)):
    doc = await run_in_threadpool(lambda: supabase.table("documents")
        .select("metadata").eq("id", document_id)
        .eq("user_id", current_user["id"]).eq("is_latest", True)
        .maybe_single().execute())
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")
    # validate body.field ∈ builtins ∪ enabled custom field_keys; reject "_"-prefix
    meta = doc.data.get("metadata") or {}
    meta[body.field] = body.value
    meta.setdefault("_source", {})[body.field] = "user"
    if body.field in ("document_type", "language") and isinstance(body.value, str):
        meta[body.field] = body.value.lower()
    result = await run_in_threadpool(lambda: supabase.table("documents")
        .update({"metadata": meta}).eq("id", document_id)
        .eq("user_id", current_user["id"]).execute())
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")
    await write_audit_entry(user_id=current_user["id"], action_type="metadata.update",
                            metadata={"document_id": document_id, "field": body.field},
                            supabase=supabase)
    return result.data[0]
```

### ConfidenceChip tier mapping (hardcoded constants)
```typescript
// Source: GROUNDING.md build spec + clone of StatusPill.tsx anatomy
const TIER = { HIGH: 0.75, MED: 0.50 } as const  // metadata display tiers — NOT retrieval 0.54/0.38
function tierFor(score: number): "high" | "med" | "low" {
  if (score >= TIER.HIGH) return "high"
  if (score >= TIER.MED) return "med"
  return "low"
}
// chip render: [glyph aria-hidden] + [tier WORD] + [· raw score tabular-nums]
// edited (_source==='user') → neutral PencilLine "Edited", NO score, NO green
// stored value, no _confidence entry → neutral Sparkles "Extracted", NO score (never "High")
```

### Frontend API client (mirror moveDocument)
```typescript
// Source: frontend/src/lib/api.ts:1971 (moveDocument)
export async function updateDocumentMetadata(id: string, field: string, value: unknown): Promise<Document> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${id}/metadata`, {
    method: "PATCH", headers, body: JSON.stringify({ field, value }),
  })
  if (!res.ok) throw new Error("Failed to update metadata")
  return res.json() as Promise<Document>
}
export async function listMetadataFields(): Promise<MetadataFieldDef[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/metadata-fields`, { headers })
  if (!res.ok) throw new Error("Failed to load metadata fields")
  return res.json()
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline plain-text `MetadataPanel` accordion in a table row | Right-side push/split detail panel + ConfidenceChip + inline edit | Phase 112 (this) | Retire `DocumentList.MetadataPanel`; keep the chevron/`expanded` machinery for versions |
| `documents.metadata` write-once at ingest | Net-new audited `PATCH /documents/{id}/metadata` | Phase 112 | First non-ingest metadata write path |
| Re-extract wholesale-overwrites metadata | Re-extract MERGES, preserving `_source='user'` | Phase 112 | The single `ingest_document:1581` write gains the guard |
| Per-field confidence stored but never shown | ConfidenceChip surfaces it | Phase 112 | META-02 |

**Deprecated/outdated:** `DocumentList.MetadataPanel` (`DocumentList.tsx:32-86`) — retired by D-01. `ConfidenceBadge` (`chat/ConfidenceBadge.tsx`) is NOT deprecated but is NOT reusable here.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `list_field_definitions` returns disabled defs too (no server `enabled` filter) → panel filters client-side | Backend 4 | LOW — panel would show a disabled custom field; mitigated by client `enabled===true` filter (matches `read_enabled_field_defs` semantics) |
| A2 | Local Supabase default password is `postgres` (used for live probes) | Validation | LOW — probes succeeded; this is the verification channel, not shipped code |
| A3 | The project mobile breakpoint for the bottom-sheet fallback is the standard Tailwind `md`/`lg` — not separately confirmed in this research | Frontend 6 / REQ 1 | LOW — sketch 027 specifies "bottom-sheet on mobile"; planner should grep the project's responsive convention |

**Note:** the table is short because nearly every claim was verified at file:line or against live :54322. Items above are the only un-pinned details; none block planning.

## Open Questions (HOW decisions for the planner)

1. **PATCH `value` typing.** The body `value` is polymorphic (string / date-string / number / boolean / `list[str]` for `topics`/enum-multiselect). Recommend `value: object | None` (accept-any) on the Pydantic model, with the route trusting the validated `field` to constrain shape, OR a small per-`field_type` validator. Single-field is the D-03 contract; a tiny partial map is an allowed optimization (D-03 discretion).
2. **Array/`topics` edit shape (v1).** GROUNDING suggests a pill editor; D-05 discretion allows text-only in v1. Recommend: render `topics` as chips (read), edit as comma-separated text in v1 (cheapest, honest), upgrade to a pill editor later. Planner to lock.
3. **Empty-field "add" + clear-value semantics.** Editing an absent field ADDS a value (→ `_source='user'`). What about clearing a field to empty? Recommend: clearing deletes the top-level key (`meta.pop(field)`) but KEEPS `_source[field]='user'` so re-extract honors the human "intentionally empty" decision (encoded in the merge guard's `else: metadata_dict.pop(field)` branch). Confirm this is the intended honesty semantics.
4. **Row-click vs chevron after retiring inline metadata.** The chevron currently toggles BOTH metadata + versions. Recommend: row-click (filename cell) opens the panel; the chevron stays ONLY for version history (which remains inline this phase). Planner to lock the exact click targets.
5. **Custom-field `enabled` filtering location.** Filter `enabled===true` client-side, or add a `?enabled=true` server param to `GET /metadata-fields`? Recommend client-side (matches `list_field_definitions` returning all; no server change) unless the planner wants server symmetry with `read_enabled_field_defs`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase Postgres :54322 | Live-DB validation (audit row, `@>`, re-extract preserve, round-trip) | ✓ | (running) | none needed |
| backend venv + psycopg2 | Live DB probes / integration tests | ✓ | `backend/venv/Scripts/python.exe` | — |
| vitest-axe | Automated WCAG AA / contrast (AC#11) | ✓ | 0.1.0 (package.json) | manual aXe browser extension |
| pytest (asyncio_mode=auto) | Route + merge tests, live integration | ✓ | (pytest.ini) | — |
| Chrome DevTools MCP | G-4 lived-experience UI UAT | ✓ (with operator-drive fallback) | — | operator-drives-clicks + psycopg2 DB cross-check (per project memory) |

**Missing dependencies with no fallback:** none.

## Validation Architecture

> Nyquist enabled (`workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework (backend) | pytest, `asyncio_mode=auto`, `testpaths=tests` (`backend/pytest.ini`) |
| Framework (frontend) | vitest 4.1 + @testing-library/react + vitest-axe 0.1.0 |
| Live DB | local Supabase Postgres :54322 (psycopg2 / asyncpg — `test_111_flat_filter_compat.py` template) |
| Quick run (backend) | `backend/venv/Scripts/python.exe -m pytest tests/unit/test_112_*.py -x` |
| Quick run (frontend) | `cd frontend && npx vitest run src/components/metadata` |
| Full suite (backend) | `backend/venv/Scripts/python.exe -m pytest tests -q` |
| Full suite (frontend) | `cd frontend && npm test` (`vitest run`) |

### SPEC Acceptance Criteria → Test Map (11 criteria)
| AC | Behavior | Test Type | Automated Command | Automatable? | File Exists? |
|----|----------|-----------|-------------------|--------------|-------------|
| AC1 | Panel opens (desktop split / mobile sheet); Metadata in `PanelSection`; close restores focus | component (vitest) + manual UI | `npx vitest run src/components/metadata/DocumentDetailPanel.test.tsx` | Partial (split/sheet automatable; "feels right" manual) | ❌ Wave 0 |
| AC2 | Chip = glyph+word+raw score, tiers .75/.50, raw (not %) | unit (vitest) | `npx vitest run src/components/metadata/ConfidenceChip.test.tsx` | ✅ | ❌ Wave 0 |
| AC3 | Edited → neutral (no score/green); unscored → "Extracted" (not "High"); absent → "Not extracted — add" | unit (vitest) | same file | ✅ | ❌ Wave 0 |
| AC4 | Low value reads tentative + distinguishable in greyscale | unit (vitest, assert italic+dim+glyph) + manual greyscale screenshot | same file | Partial | ❌ Wave 0 |
| AC5 | PATCH persists field + writes `audit_log metadata.update` — **live :54322** | integration (pytest live DB) | `pytest tests/integration/test_112_patch_audit.py -x` | ✅ (live) | ❌ Wave 0 |
| AC6 | Non-owner PATCH → 404; "Saved" receipt only on success | integration (pytest) + component (error path) | `pytest tests/integration/test_112_patch_rls.py -x` | ✅ | ❌ Wave 0 |
| AC7 | Edit field A → re-extract → A preserved, B refreshed | integration (pytest live DB) | `pytest tests/integration/test_112_reextract_merge.py -x` | ✅ (live) | ❌ Wave 0 |
| AC8 | `@>` containment still matches with `_confidence`+`_source` present — **live** | integration (pytest live DB) | `pytest tests/integration/test_112_flat_filter_with_source.py -x` (extend `test_111_flat_filter_compat.py`) | ✅ (live) | Partial (111 template) |
| AC9 | Custom field shows chip + editable + round-trips on reload | integration (pytest) + component | `pytest tests/integration/test_112_custom_field_patch.py -x` | ✅ | ❌ Wave 0 |
| AC10 | click-to-edit, Enter save, Esc cancel; empty field add | component (vitest + user-event) | `npx vitest run src/components/metadata/InlineEdit.test.tsx` | ✅ | ❌ Wave 0 |
| AC11 | aXe no AA failures; full keyboard; reduced-motion still shows receipt | a11y (vitest-axe) + manual keyboard sweep | `npx vitest run src/components/metadata/*.a11y.test.tsx` | ✅ (axe) / Partial (keyboard manual) | ❌ Wave 0 |

### Live-DB assertion map (the non-negotiable Nyquist gate)
- **Audit row written:** after PATCH, `SELECT count(*) FROM audit_log WHERE action_type='metadata.update' AND metadata->>'document_id'=$1` increments by 1 (baseline today = 0).
- **`@>` still matches:** `SELECT 1 WHERE metadata @> '{"document_type":"..."}'` still returns the row with `_source` present (proven live in this research — encode as a test).
- **Re-extract preserves source=user:** edit field A via PATCH → trigger `/reextract` → poll `documents.metadata` until `status='completed'` → assert `metadata->'A' == edited` AND `metadata->'_source'->>'A' == 'user'` AND an un-edited field B changed.
- **Edit round-trips on reload:** PATCH → re-`GET /documents` (or re-fetch the row) → the value + `_source='user'` persist (covers the Realtime best-effort reconcile path).

### Sampling Rate
- **Per task commit:** quick run for the touched layer (`pytest tests/unit/test_112_*.py -x` or `vitest run src/components/metadata`).
- **Per wave merge:** full backend suite + full frontend `npm test`.
- **Phase gate:** full suite green + the 4 live-DB assertions GREEN before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_112_patch_metadata.py` — route validation (field allow-list, `_`-prefix reject, lowercasing) — REQ META-05
- [ ] `backend/tests/integration/test_112_patch_audit.py` — live PATCH writes the audit row (AC5)
- [ ] `backend/tests/integration/test_112_patch_rls.py` — non-owner → 404 (AC6)
- [ ] `backend/tests/integration/test_112_reextract_merge.py` — `_source='user'` preserved across re-extract; degrade-doesn't-wipe (AC7, Pitfall 1/2)
- [ ] `backend/tests/integration/test_112_flat_filter_with_source.py` — `@>` holds with `_source` (AC8; extend `test_111_flat_filter_compat.py`)
- [ ] `backend/tests/integration/test_112_custom_field_patch.py` — custom `field_key` PATCH round-trip (AC9)
- [ ] `frontend/src/components/metadata/ConfidenceChip.test.tsx` — tier mapping + honest states + never-"High"-unscored (AC2/AC3)
- [ ] `frontend/src/components/metadata/InlineEdit.test.tsx` — Enter/Esc/blur/add-empty (AC10)
- [ ] `frontend/src/components/metadata/*.a11y.test.tsx` — vitest-axe no-AA-failures (AC11)
- [ ] No framework install needed (pytest + vitest + vitest-axe all present).

## Security Domain

> `security_enforcement` absent in config → enabled.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `Depends(get_current_user)` JWT — same as every documents route |
| V3 Session Management | no | Stateless JWT; no session state added |
| V4 Access Control | **yes (primary)** | RLS owner-scope `.eq("user_id", uid)` → 404 (no existence leak) on the PATCH route AND on custom-field validation; `is_latest` guard |
| V5 Input Validation | **yes** | Pydantic body model; `field` allow-list (7 built-ins ∪ enabled custom `field_key`s); reject `_`-prefixed keys; `field_key` already regex-validated at create (`metadata_field.py:21`) |
| V6 Cryptography | no | No crypto introduced |
| V7 Error Handling / Logging | yes | `write_audit_entry` (audit trail for `metadata.update`); errors swallowed by design (audit) but the PATCH 404/200 path is explicit |

### Known Threat Patterns for {FastAPI + supabase-py + JSONB}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user metadata write (IDOR) | Elevation / Tampering | `.eq("user_id", uid)` on SELECT + UPDATE; 404-not-403 on miss (mirror `move_document`/`reextract`) |
| Existence-leak via 403 vs 404 | Information disclosure | 404 on every owner miss (project precedent) |
| Arbitrary metadata key injection (e.g. writing `_confidence`/`_source` directly, or a non-existent key) | Tampering | `field` allow-list (built-ins ∪ enabled custom keys); reject leading `_`; never trust client to set `_source` value other than via the route's own stamp |
| Provenance forgery (client asserts source) | Repudiation / Tampering | Server hard-sets `_source[field]='user'`; client cannot send a `source` field; the audit row records the actor |
| Re-extract silently destroying a human edit | Tampering / DoS-of-data | The merge guard at `ingest_document:1581` preserves `_source='user'` fields (Pitfall 1/2) |
| sync supabase-py blocking the event loop | DoS | `run_in_threadpool` on every `.execute()` (D-v2.5-01) |
| `@>` filter break exposing/hiding wrong docs | Tampering | `_source` as nested sub-key (proven not to pollute top-level containment, live) |

## Sources

### Primary (HIGH confidence)
- `backend/app/api/documents.py` — `reextract_document` (`:967`), `ingest_document` (`:1334`, metadata write `:1581`), `move_document` (`:1288`, the PATCH/RLS template), threadpool owner-SELECT (`:1033`).
- `backend/app/services/embedding_service.py` — `build_metadata_model` (`:185`), `attach_confidence` (`:233`), `read_enabled_field_defs` (`:270`), `extract_metadata_enriched` (`:299`).
- `backend/app/services/audit_service.py` — `VALID_ACTION_TYPES` (`:24` has `metadata.update`), `write_audit_entry` (`:57`).
- `backend/app/api/metadata_fields.py` + `metadata_field_service.py` + `models/metadata_field.py` — CRUD, `list_field_definitions` (`:34`), `field_type` Literal (`:26`), `field_key` regex (`:21`).
- `backend/app/services/agent_loop.py` — `_compute_confidence` (`:664`, retrieval buckets 0.54/0.38 — proven separate).
- `frontend/src/pages/IngestionPage.tsx`, `components/ingestion/DocumentList.tsx`, `components/chat/StatusPill.tsx`, `components/chat/ConfidenceBadge.tsx`, `components/panel/PanelSection.tsx`, `components/ingestion/FolderNode.tsx` (`:151`), `hooks/useDocuments.ts`, `lib/api.ts` (`moveDocument :1971`), `types/index.ts` (`DocumentMetadata :190`), `index.css` (panel AA tokens).
- `supabase/full-schema.sql` (`@>` at `:108,:132`), `backend/tests/integration/test_111_flat_filter_compat.py` (the live-DB invariant template).
- **Live :54322 probes (this session):** 8 enriched docs / 53 scores (median 0.95, 94.3% ≥ 0.80, 3.8% < 0.50); 0 docs with `_source`; `@>` holds with nested `_source`; `metadata.update` in live CHECK; 0 existing `metadata.update` rows; 1 field def (`probe_k`).
- Design contract: `.claude/skills/sketch-findings-agentic-rag/references/document-detail-panel.md` + `sources/028-confidence-and-edit/GROUNDING.md`.

### Secondary (MEDIUM confidence)
- `frontend/package.json` (vitest 4.1, vitest-axe 0.1.0), `backend/pytest.ini`, `.planning/config.json` (nyquist enabled).

### Tertiary (LOW confidence)
- Mobile breakpoint convention (A3) — inferred from sketch 027, not grepped to a specific token.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libs; every primitive read at file:line.
- Architecture / integration points: HIGH — all 12 points pinned to file:line + signatures.
- Merge contract: HIGH — single write site confirmed; pseudocode written against real code.
- `_source` / `@>` / audit feasibility (D-02/D-06): HIGH — proven live against :54322.
- Confidence-system separation (D-05): HIGH — both code paths read; no cross-call.
- Pitfalls: HIGH — drawn from the actual write-site, the two confidence systems, and the Phase-101/104 false-green precedent.

**Research date:** 2026-06-18
**Valid until:** 2026-07-18 (stable surface; re-verify the live confidence distribution at UAT per D-05).

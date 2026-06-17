# Phase 112: Metadata Enrichment — Document Detail Panel + Manual Edit - Pattern Map

**Mapped:** 2026-06-18
**Files analyzed:** 11 (4 net-new + 7 modified) + test stubs
**Analogs found:** 11 / 11 (every file has a strong same-role analog read at file:line)

> RESEARCH.md already pins every integration point. This file is the structured **analog-with-excerpts** mapping the planner copies into PLAN.md action sections. Excerpts below are REAL lines from the analog at the cited file:line — copy their SHAPE, apply the delta noted.

## File Classification

| New/Modified | File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|---|
| NET-NEW | `backend/app/api/documents.py` :: `PATCH /{id}/metadata` | route (controller) | request-response (CRUD write) | `move_document` `documents.py:1288` + threadpool SELECT `:1033` | exact (same router, same RLS posture) |
| NET-NEW | `frontend/src/components/metadata/ConfidenceChip.tsx` | component (display) | transform (score→tier) | `chat/StatusPill.tsx` | exact (clone anatomy) |
| NET-NEW | `frontend/src/components/metadata/DocumentDetailPanel.tsx` (+ InlineEdit control) | component (container + form) | request-response (read defs / PATCH edit) | `panel/PanelSection.tsx` (shell) + `ingestion/FolderNode.tsx:151` (inline edit) | exact (both reused directly) |
| NET-NEW | backend `tests/integration/test_112_*.py` | test | live-DB invariant | `tests/integration/test_111_flat_filter_compat.py` | exact (copy harness verbatim) |
| NET-NEW | frontend `*.test.tsx` / `*.a11y.test.tsx` | test | component + a11y | vitest + vitest-axe (in-repo) | role-match |
| MODIFIED | `backend/app/api/documents.py` :: `ingest_document` (write `:1581`) | service (BackgroundTask) | batch (re-extract merge) | the write site itself `:1570-1585` | self (additive guard above the write) |
| MODIFIED | `backend/app/services/embedding_service.py` :: `attach_confidence` `:233` | service (transform) | transform (dump→nested key) | `attach_confidence` itself | self (mirror `_confidence`→`_source` shape) |
| MODIFIED | `frontend/src/pages/IngestionPage.tsx` | page (layout) | event-driven (select state) | the right-column layout `:79-134` | self (wrap in push/split grid) |
| MODIFIED | `frontend/src/components/ingestion/DocumentList.tsx` | component (list) | event-driven (row click) | the row/expand machinery `:328-426` | self (retire `MetadataPanel`, add `onSelect`) |
| MODIFIED | `frontend/src/lib/api.ts` | client (API) | request-response | `moveDocument` `:1971` | exact (clone fetch shape) |
| MODIFIED | `frontend/src/types/index.ts` :: `DocumentMetadata` `:190` | model (type) | — | the interface itself `:190-198` | self (extend) |
| MODIFIED | `frontend/src/hooks/useDocuments.ts` | hook (data) | event-driven (reconcile) | existing `loadDocuments()` | self (reconcile after edit; no new method) |

---

## Pattern Assignments

### `backend/app/api/documents.py` :: NET-NEW `PATCH /{document_id}/metadata` (route, request-response)

**Analog (RLS owner-scope → 404 shape):** `move_document` `documents.py:1288-1331`
```python
@router.patch("/{document_id}/move", response_model=DocumentResponse)
async def move_document(document_id: str, body: DocumentMoveRequest,
                        current_user: dict = Depends(get_current_user),
                        supabase: Client = Depends(get_supabase)):
    doc = (supabase.table("documents").select("id")
        .eq("id", document_id).eq("user_id", current_user["id"])
        .maybe_single().execute())
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")   # 404, never 403
    # ...
    result = (supabase.table("documents").update({...})
        .eq("id", document_id).eq("user_id", current_user["id"]).execute())
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")
    return result.data[0]
```

**Analog (threadpool-wrapped owner SELECT — copy THIS, NOT move's raw `.execute()`):** `documents.py:1033-1052`
```python
try:
    doc = await run_in_threadpool(
        lambda: supabase.table("documents")
        .select("*").eq("id", document_id)
        .eq("user_id", current_user["id"]).eq("is_latest", True)
        .maybe_single().execute()
    )
except Exception:
    # is_latest=False makes supabase-py raise on .maybe_single() → treat as 404
    raise HTTPException(status_code=404, detail="Document not found")
if not doc.data:
    raise HTTPException(status_code=404, detail="Document not found")   # no existence leak
```

**Analog (await write_audit_entry inline — the metadata-route precedent):** `metadata_fields.py:72-77`
```python
# write_audit_entry is async and SWALLOWS errors, so it never raises into the request
# (audit_service.py:57-74). Verified LIVE.
await write_audit_entry(
    user_id=current_user["id"],
    action_type="metadata.field.create",
    metadata={"field_key": body.field_key, "field_type": body.field_type},
    supabase=supabase,
)
```

**Analog (field allow-list constants):** `models/metadata_field.py:17`
```python
_BUILTINS = {"title", "author", "date", "document_type", "topics", "language", "summary"}
```

**Delta the new route introduces:**
- Net-new Pydantic body near `ReextractRequest`: `class MetadataUpdateRequest(BaseModel): field: str; value: object | None` (polymorphic `value` — Open Q1; route trusts validated `field` to constrain shape).
- **MUST** wrap BOTH `.execute()` calls (owner SELECT + UPDATE) in `await run_in_threadpool(lambda: ...)` per D-v2.5-01 — `move_document` does NOT (predates the sweep); the `:1033` shape is the template.
- Validate `body.field ∈ _BUILTINS ∪ enabled custom field_keys` (read via `read_enabled_field_defs(supabase, uid)` `embedding_service.py:270`); **reject any `field` starting with `_`** (block direct `_confidence`/`_source` injection — V5 input validation + provenance-forgery threat).
- Server hard-stamps `meta.setdefault("_source", {})[field] = "user"` — client may NEVER send a `source` value (Repudiation/Tampering mitigation).
- Lowercase `document_type`/`language` to mirror `ingest_document:1457-1461` so user-edited values still match `@>` filters.
- `await write_audit_entry(user_id, "metadata.update", {"document_id": id, "field": field}, supabase)` — `metadata.update` already in `VALID_ACTION_TYPES` (`audit_service.py:24`) + live CHECK.
- Return updated `DocumentResponse` (`result.data[0]`).

---

### `backend/app/api/documents.py` :: MODIFIED `ingest_document` — the re-extract MERGE guard (service, batch)

**Analog (the SINGLE metadata-write site — all 3 re-extract paths funnel here):** `documents.py:1570-1585`
```python
supabase.table("documents").update({
    "chunk_count": len(chunks),
    "metadata": metadata_dict,        # :1581 — WHOLESALE OVERWRITE of the entire JSONB blob
    "full_markdown": text,
    "extractor": engine_used,
}).eq("id", document_id).execute()
```

**Analog (the normalize block the guard sits just after):** `documents.py:1457-1461`
```python
if metadata_dict:
    if metadata_dict.get("document_type"):
        metadata_dict["document_type"] = metadata_dict["document_type"].lower()
    if metadata_dict.get("language"):
        metadata_dict["language"] = metadata_dict["language"].lower()
```

**Delta (insert the guard BEFORE the `:1570` UPDATE, against the real code — RESEARCH "Re-Extract Merge Contract"):**
- Read prior `documents.metadata` (sync `.execute()` — already inside the BackgroundTask thread, NO threadpool needed), pull `prior_meta.get("_source")`.
- `metadata_dict = metadata_dict or {}` FIRST (degrade returns `None` at `:1450` — promoting to `{}` is Pitfall 2: a degrade must NOT wipe human edits).
- For each `field` with `prior _source[field]=='user'`: restore `prior_meta[field]` into `metadata_dict` (or `pop` if the human had cleared it), keep `_source[field]='user'`, and **pop that field from `metadata_dict["_confidence"]`** (a human override has no model score → neutral "✎ Edited", never a fabricated score).
- Acceptance invariants: user field VALUE survives; un-edited `extracted` field IS refreshed; user field carries NO `_confidence`; degrade-with-prior-user-fields yields `{user fields + _source}` not `None`.
- **Anti-pattern (Pitfall 1):** the guard MUST read the prior doc's `_source` map, NOT `body.field` — putting it in a re-extract wrapper would false-green one of the 3 entry points (`/upload`, `/reingest`, `/reextract`).

---

### `backend/app/services/embedding_service.py` :: MODIFIED — mirror `_confidence` shape for `_source` (service, transform)

**Analog (the post-dump nested-key rename — the EXACT shape `_source` mirrors):** `embedding_service.py:233-246`
```python
def attach_confidence(dumped: dict) -> dict:
    """Rename the public ``confidence`` map into the nested ``_confidence`` containment key.
    ... the stored JSONB shape uses ``_confidence`` so it is a DISPLAY-ONLY nested key,
    NEVER a flat metadata_filter dimension (D-111-3/9). A missing/empty ``confidence`` is dropped."""
    out = dict(dumped)
    conf = out.pop("confidence", None)
    if conf:
        out["_confidence"] = conf
    return out
```

**Delta:**
- `_source` is a **flat sibling sub-key** `metadata._source = {field_key: "user"}`, a plain `dict[str,str]`, written ONLY by the PATCH route + the merge guard — **extraction NEVER emits `_source`** (the model has no source). So `embedding_service` does NOT gain a `_source` writer; this entry exists to document that the serialization path stays identical (both `_confidence` and `_source` are nested display-only objects that never become flat `@>` dims). The absence of `_source[field]` implicitly means `source=extracted`.
- If the planner wants a symmetric helper, it would live next to `attach_confidence` but is NOT required — the PATCH route stamps `_source` inline.

---

### `frontend/src/components/metadata/ConfidenceChip.tsx` :: NET-NEW (component, transform)

**Analog:** `chat/StatusPill.tsx` (clone the anatomy — explicitly NOT `chat/ConfidenceBadge.tsx`, see below).

**Chip anatomy** (`StatusPill.tsx:69-89`):
```tsx
<span
  data-testid="status-pill"
  data-status={status}
  className={cn(
    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full",
    "font-mono text-[10px] uppercase tracking-wider",
    "flex-shrink-0",
    VARIANTS[status],
  )}
>
  <span aria-hidden="true" className={cn("inline-block w-1.5 h-1.5 rounded-full bg-current", ...)} />
  <span className="tabular-nums">{label}</span>
</span>
```

**Variant map to clone** (`StatusPill.tsx:38-44`):
```tsx
const VARIANTS: Record<ToolStatus, string> = {
  done: "bg-success/15 text-success",
  failed: "bg-destructive/15 text-destructive",
  // ...
}
```

**Delta:**
- Swap the glyph (`StatusPill`'s `<span bg-current>` dot) for a lucide icon per state: High `CheckCircle2`, Med dot/`●`, Low `AlertTriangle`, Edited `PencilLine`, Extracted `Sparkles`.
- Swap `VARIANTS` for **tier-tinted PANEL-SCOPED AA tokens** (NOT `StatusPill`'s `success`/`destructive` raw tokens — those are chat-surface; the panel needs `--panel-*`): High `bg-[hsl(var(--panel-status-done)/0.15)] text-[hsl(var(--panel-status-done))]` (10.63:1), Med `--panel-status-active` (10.48:1), Low `bg-destructive/15 text-[hsl(0_80%_80%)]` (lightened red ≥4.5:1 — NEVER raw `--destructive` for text), Edited `bg-transparent border-border text-panel-muted-foreground` (**no score, no green**), Extracted neutral `Sparkles` + `text-panel-muted-foreground`.
- Render contract: **[glyph aria-hidden] + [tier WORD] + [· raw score tabular-nums]** — e.g. `⚠ Low · 0.41`. Raw score VERBATIM, never a percentage.
- Hardcode `const TIER = { HIGH: 0.75, MED: 0.50 } as const` with a code comment naming the source — **NEVER import `confidence_bucket_high/medium` (0.54/0.38) from settings** (Pitfall 3: separate system).
- Honesty states (lock in a code comment — "no green on a manual override; reviewers WILL try to fix it"): `_source==='user'` → neutral Edited (no score); stored value w/ no `_confidence` entry → neutral Extracted (never "High"); absent field → "Not extracted — add"; low VALUE itself → italic + dimmed + leading ⚠ (greyscale-survivable triage).

**Why `chat/ConfidenceBadge.tsx` is NOT the analog:** it consumes a `ConfidenceResult` object (`{level, disclaimer}`), uses **raw Tailwind color tokens** (`text-green-500`/`text-amber-500`/`text-red-500`, NOT panel-scoped AA — fails AA on the panel surface), renders `● {Level} confidence` with NO raw score and NO glyph+word+score enforcement, and has no honest Edited/Extracted/empty states. It is a chat display widget, not a metadata chip.

---

### `frontend/src/components/metadata/DocumentDetailPanel.tsx` (+ InlineEdit) :: NET-NEW (component, container + form)

**Analog (accordion shell — reuse DIRECTLY, no new primitive):** `panel/PanelSection.tsx`
```tsx
// Props (:23-30): { title, count?: PanelSectionCount, warn?: boolean, defaultOpen?: boolean, children }
// A11y (:55-99): head is a real <button id aria-expanded aria-controls>; body is
//   <div role="region" aria-labelledby={headId}>; collapse = display:none (instant).
<button type="button" id={headId} aria-expanded={open} aria-controls={bodyId}
  className={cn("...", "text-panel-muted-foreground-dim", "hover:text-panel-muted-foreground",
               "focus-visible:ring-1 focus-visible:ring-ring")}>
  <ChevronDown aria-hidden="true" className={cn("...", !open && "-rotate-90")} />
  <span className="min-w-0 truncate">{title}</span>
  {countText != null && (
    <span className={cn("ml-auto font-mono ...", warn ? "text-[hsl(var(--warning))]" : "text-panel-muted-foreground")}>
      {countText}
    </span>
  )}
</button>
{open && <div id={bodyId} role="region" aria-labelledby={headId}>{children}</div>}
```

**Analog (inline-edit toggle/autoFocus/Enter-Esc-blur):** `ingestion/FolderNode.tsx:151-170`
```tsx
{isEditing ? (
  <input
    ref={editInputRef}
    value={editValue}
    onChange={(e) => setEditValue(e.target.value)}
    onBlur={() => onCommitRename(node.id, editValue.trim())}
    onKeyDown={(e) => {
      if (e.key === "Enter") { e.preventDefault(); onCommitRename(node.id, editValue.trim()) }
      if (e.key === "Escape") { e.preventDefault(); onCancelRename() }
    }}
    className="flex-1 min-w-0 px-1.5 py-0.5 text-sm bg-background border border-primary/30 rounded-md outline-none focus:ring-1 focus:ring-primary/40"
    autoFocus
    onClick={(e) => e.stopPropagation()}   // prevent the row-select firing
  />
) : ( /* display */ )}
```

**Delta:**
- Render the **Metadata section** as `<PanelSection title="Metadata" warn={low+emptyCount>0} count={low+emptyCount} defaultOpen>{...fields}</PanelSection>` — NO new accordion primitive, NO inert REL/CLASS/Versions stubs (shell-ready only; honesty).
- Field set = union of (7 built-ins) + (enabled custom defs from `GET /metadata-fields`) — **never raw metadata keys**; ignore `_`-prefixed keys (`_confidence`/`_source`). Filter custom defs `enabled===true` client-side (matches `read_enabled_field_defs` semantics; Open Q5).
- Per-field row: value + `<ConfidenceChip>`; chip tier ← `_confidence[field]`; `_source[field]==='user'` → neutral Edited.
- Inline edit per `field_type` (`string→Input`, `summary→Textarea` w/ Cmd/Ctrl+Enter, `date→date Input`, `enum→Select`, `topics`→comma-text in v1 per Open Q2): mirror FolderNode's toggle/autoFocus/Enter-Esc-blur; GROUNDING adds guarded blur-commit + Esc restores focus to the trigger (useRef).
- On 200: "🛡 Saved · audit logged" receipt (gated `prefers-reduced-motion` → instant render), chip → neutral Edited, call `loadDocuments()` to reconcile (Realtime is best-effort, D-v2.5-03).
- **A11y tokens:** panel-scoped only (`--panel-status-done/-active`, `--panel-muted-foreground` 7.21:1, lightened red `hsl(0 80% 80%)`) — **NEVER global `--muted-foreground` (3.59:1, fails AA)** anywhere in the panel.
- Mobile (≤ project breakpoint, grep the responsive convention per A3) → bottom-sheet instead of the split track.

---

### `frontend/src/pages/IngestionPage.tsx` :: MODIFIED (page, event-driven)

**Analog (current right-column layout):** `IngestionPage.tsx:79, 96, 128-134`
```tsx
<div className="flex flex-row gap-6 flex-1 min-h-0">
  <div className="w-72 shrink-0 ...">{/* FolderTree */}</div>
  <div className="flex-1 flex flex-col overflow-y-auto space-y-6">
    {/* breadcrumb + DocumentUpload */}
    <DocumentList
      documents={documents}
      onDelete={deleteDoc}
      onRefresh={loadDocuments}
      folderId={selectedFolderId}
      currentUserId={user?.id ?? ""}
    />
  </div>
</div>
```

**Delta:**
- Add `const [selectedDocId, setSelectedDocId] = useState<string | null>(null)` at this level.
- Wrap the right column in the push/split grid `minmax(0,1fr) 430px` (list shrinks but stays visible); mount `<DocumentDetailPanel docId={selectedDocId} onClose={...} />` in the 430px track (or bottom-sheet on mobile).
- Pass `selectedDocId` + `onSelect={setSelectedDocId}` into `DocumentList`; pass the selected `Document` (with `.metadata` from `useDocuments()`) to the panel; call `loadDocuments()` after an edit to reconcile.
- Reuse the existing `<TooltipProvider>` (`:49`) — no new provider.

---

### `frontend/src/components/ingestion/DocumentList.tsx` :: MODIFIED (component, event-driven)

**Analog (the RETIRE target — inline plain-text dump, no confidence/edit):** `DocumentList.tsx:32-86` (`MetadataPanel`) — see also the dual-purpose expand at `:408-426`:
```tsx
{hasMetadata(doc) && expanded.has(doc.id) && (
  <tr><td colSpan={7} className="p-0"><MetadataPanel metadata={doc.metadata!} /></td></tr>
)}
{hasVersions(doc) && expanded.has(doc.id) && (
  <tr><td colSpan={7} className="p-0"><VersionHistoryPanel ... /></td></tr>
)}
```

**Analog (the chevron/expand machinery that STAYS for versions):** `:334-343`
```tsx
{isExpandable(doc) && (
  <button onClick={() => toggle(doc.id)} aria-label={...}>
    {expanded.has(doc.id) ? <ChevronDown/> : <ChevronRight/>}
  </button>
)}
```

**Delta (Open Q4 — landmine: the same `toggle` drives BOTH metadata + versions):**
- **REMOVE** the `MetadataPanel` function (`:32-86`) AND its expansion branch (`:408-414`).
- **KEEP** the chevron/`expanded`/`toggle` machinery + the `VersionHistoryPanel` branch (`:415-426`) — versions stay inline this phase (deferred to a later panel section, NOT 112).
- Adjust `isExpandable` (`:310`) so the chevron shows for `hasVersions` only (metadata no longer drives inline expand).
- Wire the filename cell (`:346`) → `onSelect(doc.id)` to open the detail panel; the chevron keeps toggling version history. (Planner locks exact click targets.)
- Thread a new `onSelect`/`selectedDocId` prop through from `IngestionPage`.

---

### `frontend/src/lib/api.ts` :: MODIFIED — net-new client methods (client, request-response)

**Analog:** `moveDocument` `api.ts:1971-1980`
```ts
export async function moveDocument(id: string, folderId: string | null): Promise<Document> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${id}/move`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ folder_id: folderId }),
  })
  if (!res.ok) throw new Error("Failed to move document")
  return res.json() as Promise<Document>
}
```

**Delta (two net-new methods — frontend has ZERO existing `/metadata-fields` consumer):**
- `updateDocumentMetadata(id, field, value)` → `PATCH /documents/${id}/metadata` body `{field, value}` (clone the moveDocument shape verbatim).
- `listMetadataFields()` → `GET /metadata-fields` (returns `MetadataFieldDef[]` — net-new type; mirror `MetadataFieldResponse` `models/metadata_field.py:60-68`: `{id, user_id?, field_key, field_type, description?, options?, is_global, enabled}`, `field_type ∈ "string"|"date"|"number"|"boolean"|"enum"`).

---

### `frontend/src/types/index.ts` :: MODIFIED `DocumentMetadata` `:190` (model, type)

**Analog (current interface):** `types/index.ts:190-198`
```ts
export interface DocumentMetadata {
  title?: string
  author?: string
  date?: string
  document_type?: string
  topics?: string[]
  language?: string
  summary?: string
}
```

**Delta:**
- Add `_confidence?: Record<string, number>`, `_source?: Record<string, "user" | "extracted">`, and an index signature (or a typed custom-field map) so custom `field_key`s read through.
- Add a net-new `MetadataFieldDef` interface mirroring backend `MetadataFieldResponse` for the `listMetadataFields()` return.

---

### `frontend/src/hooks/useDocuments.ts` :: MODIFIED (hook, event-driven)

**Analog:** the hook's existing `loadDocuments()` (owns `documents` + Realtime subscription + refetch on terminal status).

**Delta:** NO new metadata-edit method here — the PATCH lives in `api.ts`; the panel calls it directly and then calls `loadDocuments()` to reconcile (Realtime is best-effort, D-v2.5-03 → fetch on reconcile). The hook change is minimal: ensure `loadDocuments()` is exposed to the panel for post-edit reconcile (already exposed via `IngestionPage`).

---

### Test stubs :: NET-NEW

**Backend analog (live-DB invariant harness — copy VERBATIM):** `tests/integration/test_111_flat_filter_compat.py`
```python
_POSTGRES_TEST_DSN = os.environ.get("POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
# _pg_reachable / _check_pg_available_sync / pytestmark skipif
# pg_pool fixture registers a jsonb codec (encoder=json.dumps) → pass dicts DIRECTLY (no double-encode)
# seeded_doc fixture: INSERT auth.users + documents row with nested metadata, yield ids, teardown DELETE
async def test_flat_containment_still_matches_with_confidence(pg_pool, seeded_doc):
    row = await pg_pool.fetchrow(
        "SELECT id FROM documents WHERE id = $1 AND metadata @> $2",
        doc_id, {"document_type": "report"},
    )
    assert row is not None
```

**Delta (Wave-0 stubs, the live-DB Nyquist gate):**
- `test_112_patch_metadata.py` (unit) — field allow-list, `_`-prefix reject, lowercasing (META-05).
- `test_112_patch_audit.py` (integration, live) — PATCH writes the `audit_log metadata.update` row, baseline today = 0 (AC5).
- `test_112_patch_rls.py` (integration) — non-owner → 404 (AC6).
- `test_112_reextract_merge.py` (integration, live) — `_source='user'` preserved across `/reextract` AND `/reingest`; degrade-doesn't-wipe (AC7, Pitfall 1/2).
- `test_112_flat_filter_with_source.py` — **EXTEND** the 111 template: seed `_source` alongside `_confidence`, assert `@>` still matches top-level keys (AC8; proven live in research).
- `test_112_custom_field_patch.py` (integration) — custom `field_key` PATCH round-trip (AC9).

**Frontend analog:** any existing vitest + vitest-axe test.
- `ConfidenceChip.test.tsx` — tier mapping + honest states + never-"High"-unscored (AC2/AC3).
- `InlineEdit.test.tsx` — Enter/Esc/blur/add-empty (AC10).
- `*.a11y.test.tsx` — `vitest-axe` no-AA-failures (AC11; makes AC11 automatable — already a dep at `^0.1.0`).

---

## Shared Patterns

### RLS owner-scope → 404 (never 403)
**Source:** `documents.py:1050-1052` (`reextract`) / `:1305-1306` (`move`).
**Apply to:** the PATCH route (owner SELECT + UPDATE both `.eq("user_id", uid)`; custom `field_key` validation is also owner-scoped).
```python
if not doc.data:
    raise HTTPException(status_code=404, detail="Document not found")   # no existence leak
```

### `run_in_threadpool` for sync supabase-py in async handlers (D-v2.5-01)
**Source:** `documents.py:1033-1042`.
**Apply to:** EVERY `.execute()` in the new PATCH route (auth predicates stay inside the lambda verbatim). NOTE: `move_document:1297-1327` does NOT do this — do not copy it as the threadpool template.

### Audit write via `write_audit_entry` (never a direct insert)
**Source:** `audit_service.py:57-74` (signature + swallow) + `metadata_fields.py:72-77` (the await-inline call shape).
**Apply to:** the PATCH route. `metadata.update` already in `VALID_ACTION_TYPES` (`:24`) + live CHECK → no migration. The write swallows errors → the live round-trip is the real verification.

### Flat `_`-sub-key display data (never a flat `@>` filter dim)
**Source:** `attach_confidence` (`embedding_service.py:233`); proven live in `test_111_flat_filter_compat.py`.
**Apply to:** `_source` (mirror `_confidence` exactly — nested `dict[str,str]`, never a top-level scalar).

### Panel-scoped AA tokens (CSS, WCAG 2.1 AA)
**Source:** `frontend/src/index.css` — `--panel-status-done` (10.63:1), `--panel-status-active` (10.48:1), `--panel-muted-foreground` (7.21:1), lightened red `hsl(0 80% 80%)` (≥4.5:1). Reuse pattern visible in `PanelSection.tsx:64-87`.
**Apply to:** ConfidenceChip + DocumentDetailPanel + every panel text. **NEVER global `--muted-foreground` (3.59:1, fails AA).**

---

## No Analog Found

None. Every net-new and modified file has a strong same-role analog in the codebase (Phase 112 is 80%+ assembly of shipped primitives per RESEARCH). The genuinely net-new logic — the PATCH route, the merge guard, the ConfidenceChip variant/tier map, the panel wiring, and the two net-new API-client methods — all clone a verified in-repo shape with a precise delta noted above.

## Metadata

**Analog search scope:** `backend/app/api/`, `backend/app/services/`, `backend/app/models/`, `backend/tests/integration/`, `frontend/src/components/{chat,panel,ingestion,metadata}/`, `frontend/src/{pages,hooks,lib,types}/`.
**Files scanned / read at file:line:** 12 analogs (StatusPill, PanelSection, audit_service, documents.py ×4 ranges, embedding_service, FolderNode, api.ts, types/index.ts, metadata_fields.py, test_111_flat_filter_compat, DocumentList ×2, IngestionPage, metadata_field model).
**Pattern extraction date:** 2026-06-18

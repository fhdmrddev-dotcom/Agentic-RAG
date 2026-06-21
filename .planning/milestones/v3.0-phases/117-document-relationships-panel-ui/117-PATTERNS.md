# Phase 117: Document Relationships — Panel UI - Pattern Map

**Mapped:** 2026-06-20
**Files analyzed:** 8 new/modified (3 backend, 5 frontend)
**Analogs found:** 8 / 8 (exact in-repo analog for every file; zero net-new external deps)

> **Read this with 117-CONTEXT.md (11 D-117 decisions) and 117-RESEARCH.md (recommended
> route shape + response model + extraction mechanism).** This file is the concrete
> per-file analog + excerpt layer the planner copies into `<read_first>` + `<action>`.
> Every excerpt below was read from live source this session.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/services/document_relationship_service.py` (ADD `get_related_documents`) | service | request-response (read traversal) | `backend/app/services/document_view_resolver.py` (the 115 extraction) + the body lifted from `tool_dispatcher.py:561-649` | exact (same extract-don't-fork move) |
| `backend/app/services/tool_dispatcher.py` (MODIFY `_handle_get_related_documents` → thin wrapper) | service (agent-tool dispatch) | event-driven (tool call) | itself, refactored against the `query_documents_by_view` extraction precedent | exact (behavior-preserving refactor) |
| `backend/app/api/document_relationships.py` (ADD `GET` route) | route (controller) | request-response | `backend/app/api/document_views.py` `resolve_view` (lines 202-261, no-audit-on-read) + the existing POST/DELETE in this same file (auth + threadpool + uniform-404) | exact |
| `frontend/src/components/relationships/RelationshipsSection.tsx` (NEW) | component | request-response (fetch + render + re-fetch) | `frontend/src/components/metadata/DocumentDetailPanel.tsx` (the Metadata section + `handleCommit` reconcile) + `PanelSection.tsx` (accordion shell) | role-match (new component, exact host pattern) |
| `frontend/src/components/relationships/CreateLinkDialog.tsx` (NEW) | component | request-response (form → POST) | `frontend/src/components/health/MoveToFolderDialog.tsx` (Dialog + confirm + error-line + loading shell) | role-match (keep shell, swap `Select`→typeahead) |
| `frontend/src/lib/api.ts` (ADD `listRelationships`/`createRelationship`/`deleteRelationship`) | utility (api client) | request-response | `updateDocumentMetadata` (:1997) + the `document-views` family `createView`/`deleteView`/`resolveView` (:2038-2112) | exact |
| `frontend/src/types/index.ts` (ADD `RelType`/`RelationshipRow`/`RelatedDocumentsResponse`) | model (TS types) | n/a | `MetadataFieldDef` (:216) + `SavedView` (:288) | exact |
| `frontend/src/components/relationships/RelationshipsSection.a11y.test.tsx` (NEW) | test | n/a | `frontend/src/components/metadata/DocumentDetailPanel.a11y.test.tsx` (vitest-axe + partial api mock) | exact |

**Scope guard:** `backend/app/api/threads.py` is OUT of scope (G-5 extension contract — never touched; confirmed by 116). No migration (the `document_relationships` table + RLS shipped migration 071; idempotency index migration 075).

---

## Pattern Assignments

### `backend/app/services/document_relationship_service.py` — ADD `get_related_documents(...)` (service, read traversal)

**Analog:** `backend/app/services/document_view_resolver.py` (the Phase 115 extraction — the exact "lift the leak-safe core out of the consumer into a FastAPI-free shared module" move). **Traversal body to lift:** `backend/app/services/tool_dispatcher.py:561-649`.

**The extraction-module shape to follow** (`document_view_resolver.py:1-19, 49-62, 153-176`) — note: NO FastAPI import, raises a plain error class (or, for relationships, returns calmly), returns a **plain dict** so rows round-trip unstripped (the 112 CR-01 lesson):
```python
"""The injectable, leak-safe ... CORE — extracted in Phase 115.
... lifted out VERBATIM so the Phase 115 agent tool can call the SAME leak-safe
... IN-PROCESS without importing a FastAPI route or raising HTTPException into the
agent loop. ... This module MUST NOT import the web framework."""

# resolve_filter signature shape (the precedent):
async def resolve_filter(*, caller: str, flt, folder_scope, count_only, supabase):
    """The SHARED, leak-safe resolve core ... used by BOTH the route module's
    resolve_view / resolve_adhoc endpoints AND the Phase 115 agent tool handler.
    ... Returns the plain-dict, no-response_model shape so rows round-trip the exact
    metadata blob (the 112 CR-01 lesson)."""
```

**The traversal body to LIFT from `tool_dispatcher.py:561-649`** (this is the canonical leak-safe read — copy it into the new fn, do NOT re-derive). Note the constants at `tool_dispatcher.py:478-489` move/import too:
```python
# tool_dispatcher.py:573-584 — the two own-scoped edge queries over the version set:
version_ids = await document_relationship_service._subject_version_ids(subject, supabase=...)
outgoing = await aexec(
    ctx.supabase.table("document_relationships")
    .select("id, source_doc_id, target_doc_id, rel_type")   # NOTE: `id` selected
    .eq("user_id", document_relationship_service._uid(caller))
    .in_("source_doc_id", version_ids)
)
incoming = await aexec(... .in_("target_doc_id", version_ids))

# tool_dispatcher.py:597-627 — per-edge OTHER-endpoint readability re-check + mask:
other_id = edge["target_doc_id"] if direction == "outgoing" else edge["source_doc_id"]
label = rel_type if direction == "outgoing" else _INVERSE_LABEL.get(rel_type, rel_type)
other = await document_relationship_service._resolve_readable_latest(other_id, caller, ...)
if other is None:
    compact.append({"document_id": None, "filename": _NO_ACCESS_MASK,
                    "rel_type": rel_type, "direction": direction, "label": label})
    return
compact.append({"document_id": other["id"], "filename": other["filename"],
                "rel_type": rel_type, "direction": direction, "label": label})
```

**Primitives already in this file the new fn REUSES (do not re-implement — `document_relationship_service.py`):**
- `_resolve_readable_latest(doc_id_or_filename, caller, *, by_filename=False, supabase=None)` (lines 143-247) — the SOLE access gate (CR-01 is_latest-gate + post-follow folder re-check). Call it for the subject AND per-edge other-endpoint.
- `_subject_version_ids(subject_row, *, supabase=None)` (lines 111-140) — full `(user_id, filename)` lineage set for the `.in_()` edge queries (CR-02 follow-to-latest).
- `_uid(user_id)` (lines 56-68) — UUID-coerce every owner-scoping predicate (service-role client bypasses RLS).
- `_client(supabase)` (lines 52-53), `aexec` import (line 46) — every query rides `aexec`; zero bare `.execute()` in this module (D-v2.5-01).

**THE ONE SHAPE CHANGE (RESEARCH §Code Examples IMPORTANT, A6):** the agent handler's compact rows at `tool_dispatcher.py:612-626` **drop the edge `id`** (it is `select`-ed at :575/581 but never carried into `_append_edge`). The panel needs `relationship_id` for the remove ✕ (`DELETE /{id}`). The extracted fn MUST carry `edge["id"]` through to each row as `relationship_id`. Verify this extra field does not break `test_116_tool_read.py` strict-shape assertions; if it does, shape the `id` only into the route payload, not the agent ToolResult.

**Return contract:** a plain dict `{subject: {document_id, filename}, total, documents: [...rows...], source_refs: [...]}` (mirror `tool_dispatcher.py:639-648`). `subject is None` (unreadable/unknown) → return `None` (calm; the agent handler maps it to its calm "not_found" string, the route maps it to a 404). No raises into the agent loop (the 115 WR-01/WR-03 lesson).

---

### `backend/app/services/tool_dispatcher.py` — MODIFY `_handle_get_related_documents` → thin wrapper (service, agent-tool dispatch)

**Analog:** itself (behavior-preserving refactor), against the `query_documents_by_view` precedent where the handler became a thin caller of the extracted resolve core.

**Current full handler:** `tool_dispatcher.py:492-649`. After extraction it KEEPS the calm-string contract (lines 528-559: `no_subject` / `unavailable` / `not_found`) and the `ToolResult` JSON packaging (lines 639-648), but delegates the traversal:
```python
# becomes (RESEARCH §"The agent handler after extraction"):
result = await document_relationship_service.get_related_documents(
    caller, document_id=doc_id, filename=filename, supabase=ctx.supabase
)
# map result-or-None to the existing calm ToolResult JSON strings + source_refs.
```

**Constants to relocate/import:** `_INVERSE_LABEL` (lines 478-483) + `_NO_ACCESS_MASK` (line 489) move INTO the shared service (or are imported from it) so both callers + the frontend mirror reference one source (D-117-6). Only `tool_dispatcher.py` references them today (verified this session).

**Regression backstop (RESEARCH §Runtime State):** after the refactor, re-run `test_116_tool_leak.py`, `test_116_tool_read.py`, `test_116_handler.py`, `test_116_version_stable.py` — all must stay green (35/35 live on :54322). The agent tool output (masked rows, `source_refs`, `direction`/`label`, calm strings) MUST stay byte-identical.

---

### `backend/app/api/document_relationships.py` — ADD authenticated `GET` route (route, request-response)

**Analog:** `backend/app/api/document_views.py` `resolve_view` (lines 202-261) for the **no-audit-on-read + readability-gate** posture; the EXISTING POST/DELETE in this same file (lines 69-191) for the **auth + threadpool/`aexec` + uniform-404** pattern. Router already mounted: `main.py:424`.

**The resolve-route precedent (no audit on a read, 404-not-403 on an unseeable subject)** — `document_views.py:233-260`:
```python
caller = current_user["id"]
# 1. Readability gate → 404-not-403 on an unseeable id (D-113-4). NEVER used in a docs query.
view = await document_view_service.get_view(view_id, caller, supabase=supabase)
if view is None:
    raise HTTPException(status_code=404, detail="View not found")  # 404-not-403, no leak
# 2. Caller-scoped resolve via the SHARED core (no fork):
return await resolve_filter(caller=caller, flt=flt, ..., supabase=supabase)
# (NOTE: resolve_view writes NO audit — a read is a pure traversal.)
```

**The recommended GET shape (RESEARCH §Code Examples — thin wrapper, no audit):**
```python
@router.get("")  # GET /document-relationships?document_id={id}
async def get_relationships(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    result = await document_relationship_service.get_related_documents(
        current_user["id"], document_id=document_id, supabase=supabase
    )
    if result is None:                      # subject unreadable/unknown
        raise HTTPException(status_code=404, detail="Document not found")
    return result                           # plain dict (no response_model — 112 CR-01)
```

**Auth + dependency shape to mirror (the existing POST/DELETE, `document_relationships.py:70-74, 162-166`):**
```python
current_user: dict = Depends(get_current_user),
supabase: Client = Depends(get_supabase),
...
caller = current_user["id"]
```

**Hard constraints for this route (RESEARCH §Pitfall 1 / §Security):**
- **NO audit write.** `VALID_ACTION_TYPES` (`audit_service.py:13-26`) has only `relationship.create`/`relationship.delete` — **no `relationship.read` enum** (confirmed this session). Mirror `resolve_view` (writes no audit on read).
- **No fork.** The literal `"linked document (no access)"`, any `_resolve_readable_latest` call, and any `.in_(version_ids)` edge query must appear ONLY in the service — never in this route file (the `test_117_no_fork.py` grep guard catches a fork).
- The route is a thin wrapper: auth → call the shared fn → JSON. No business logic.

---

### `frontend/src/components/relationships/RelationshipsSection.tsx` — NEW (component, fetch + render + re-fetch)

**Analog:** `DocumentDetailPanel.tsx` (the Metadata-section host pattern + the `handleCommit` reconcile-on-success) and `PanelSection.tsx` (the accordion shell to render inside).

**The section slot to plug into — `DocumentDetailPanel.tsx:212-231`** (render the new `<PanelSection title="Relationships">` right AFTER the Metadata section in this container):
```tsx
{/* Sections — ONLY Metadata this phase (117/118 add theirs to this shell). */}
<div className="min-h-0 flex-1 overflow-y-auto">
  <PanelSection title="Metadata" warn={lowPlusEmpty > 0} count={lowPlusEmpty} defaultOpen>
    {/* field rows */}
  </PanelSection>
  {/* NEW (this phase): <PanelSection title="Relationships" count={total}> <RelationshipsSection docId={doc.id} ... /> </PanelSection> */}
</div>
```

**The accordion + count/warn badge — `PanelSection.tsx:42-100`** (use directly; `count` accepts a flat number; `warn` ambers it):
```tsx
<PanelSection title="Relationships" count={total /* number | {done,total} */} warn={false} defaultOpen>
  {children}
</PanelSection>
// head is a real <button aria-expanded aria-controls>; body is role="region" aria-labelledby.
// Panel-scoped AA token: text-panel-muted-foreground-dim (NEVER global --muted-foreground).
```

**Re-fetch-on-mutation reconcile — `DocumentDetailPanel.tsx:172-188` `handleCommit`** (the posture to MIRROR; D-117-9, no optimistic, no Undo):
```tsx
async function handleCommit(field: string, value: unknown) {
  setErrorField(null)
  try {
    await updateDocumentMetadata(doc.id, field, value)   // claim success ONLY after the await
    setSavedField(field); ...
    onReconcile?.()                                      // reconcile (Realtime best-effort, D-v2.5-03)
  } catch {
    setErrorField(field); setSavedField(null)             // honest inverse
  }
}
```
**For relationships:** the section owns its OWN re-fetch of `listRelationships(docId)` after each create/remove — NOT IngestionPage's `onReconcile`/`loadDocuments` (that refreshes the documents array, not relationships — RESEARCH Pitfall 5 / Open Q1). Keep fetch state LOCAL, keyed on `doc.id`; re-fetch on mount + after each mutation.

**Honest-states matrix (RESEARCH §Validation, D-117-10) — each a distinct render, mirror the 112 receipt/error roles:**
| State | Render | a11y |
|-------|--------|------|
| populated | grouped Outgoing then Incoming rows + rel-type chips (D-117-5) | correct direction labels |
| empty | "No relationships yet" + inline `+ Add link` | NOT an error |
| loading | skeleton / quiet `↻` (no layout jump) | `role="status"` (like the 112 save receipt :327) |
| error | "couldn't load relationships" | `role="alert"` (like the 112 error receipt :337) |
| no-access (masked) | "linked document (no access)", `document_id:null` | never id/title; STILL carries a remove ✕; not error/empty |

**Inverse-label display mirror (D-117-6, RESEARCH Pattern 3)** — the backend OWNS the vocabulary (`_INVERSE_LABEL`); the frontend has a tiny casing mirror that MUST stay 1:1 with those keys:
```ts
const OUTGOING_LABEL = { supersedes:"Supersedes", amends:"Amends", references:"References", attached_to:"Attached to" }
const INCOMING_LABEL = { supersedes:"Superseded by", amends:"Amended by", references:"Referenced by", attached_to:"Has attachment" }
```

**Remove ✕ a11y (RESEARCH Pitfall 3 — the audit's #1 fix):** the row remove control must be reachable on touch + keyboard, never hover-only:
```css
.rel-row:hover .rel-x, .rel-row:focus-within .rel-x, .rel-x:focus-visible { opacity:1 }
@media (pointer:coarse){ .rel-x{opacity:1} }
```

---

### `frontend/src/components/relationships/CreateLinkDialog.tsx` — NEW (component, form → POST)

**Analog:** `frontend/src/components/health/MoveToFolderDialog.tsx` (the FULL Dialog + confirm + error-line + loading shell to KEEP; replace only its `Select` with a type-first rel-type chip row + a searchable typeahead/combobox — D-117-3).

**The shell to KEEP (`MoveToFolderDialog.tsx:28-95`):**
```tsx
export function CreateLinkDialog({ open, ... }: Props) {
  const [target, setTarget] = useState<...>("")          // ← was selectedFolderId
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (!open) return; setTarget(""); setError(null); /* load candidates */ }, [open])

  async function handleConfirm() {
    if (!target) return
    setLoading(true); setError(null)
    try { await createRelationship(sourceDocId, target, relType); onCreated(); onClose() }
    catch { setError("Action failed. Please try again.") }
    finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add link</DialogTitle></DialogHeader>
        <div className="py-2 space-y-3">
          {/* rel-type segmented chips (type-first) + the typeahead listbox REPLACE <Select> here */}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!target || loading}>
            {loading ? "Linking..." : "Add link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```
Keep the input INSIDE the shadcn `Dialog` so focus-trap + restore come free.

**The control to REPLACE (`MoveToFolderDialog.tsx:69-81`)** — the plain `Select` (dies past ~30 docs, D-117-3):
```tsx
<Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
  <SelectTrigger><SelectValue placeholder="Select a folder..." /></SelectTrigger>
  <SelectContent>... <SelectItem value={f.id}>{f.name}</SelectItem> ...</SelectContent>
</Select>
```

**Net-new combobox a11y (RESEARCH Pattern 4 / Pitfall 2 — the `Select` gave these for FREE; there is NO `cmdk` dep in the repo, wire by hand):** `role="combobox"` + `aria-expanded`/`aria-controls`/`aria-activedescendant` on the input; `role="listbox"` on the list; `role="option"` + unique id per candidate; highlighted row = `aria-activedescendant`.

**Candidate source + exclusion (D-117-4, RESEARCH Pitfall 6 / A2):** filter `listDocuments()` (`api.ts:1201`) client-side — drop `doc.id === openDocId` always; drop any candidate already in the current OUTGOING edges WITH the currently-selected `rel_type`; **re-derive on rel-type change.** Idempotent-create (D-116-6) is the correctness backstop; this exclusion is clarity-only.

---

### `frontend/src/lib/api.ts` — ADD `listRelationships` / `createRelationship` / `deleteRelationship` (utility, api client)

**Analog:** `updateDocumentMetadata` (:1997, the `getAuthHeaders()`+`fetch`+`res.ok` throw convention) and the `document-views` family — `createView` (:2038, POST), `deleteView` (:2090, 404-tolerant DELETE), `resolveView` (:2103, GET returning a plain dict).

**The throw convention to clone (`api.ts:1997-2006`):**
```ts
export async function updateDocumentMetadata(id: string, field: string, value: unknown): Promise<Document> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${id}/metadata`, {
    method: "PATCH", headers, body: JSON.stringify({ field, value }),
  })
  if (!res.ok) throw new Error("Failed to update metadata")
  return res.json() as Promise<Document>
}
```

**The 404-tolerant DELETE to clone (`api.ts:2090-2097`):**
```ts
export async function deleteView(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-views/${id}`, { method: "DELETE", headers })
  if (!res.ok && res.status !== 404) throw new Error("Failed to delete view")
}
```

**The 3 new fns (RESEARCH §Code Examples — same conventions):**
```ts
export async function listRelationships(documentId: string): Promise<RelatedDocumentsResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-relationships?document_id=${documentId}`, { headers })
  if (!res.ok) throw new Error("Failed to load relationships")
  return res.json() as Promise<RelatedDocumentsResponse>
}
export async function createRelationship(source_doc_id: string, target_doc_id: string, rel_type: RelType): Promise<Relationship> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-relationships`, {
    method: "POST", headers, body: JSON.stringify({ source_doc_id, target_doc_id, rel_type }),
  })
  if (!res.ok) throw new Error("Failed to create link")   // 422 = unseeable/self/forged
  return res.json() as Promise<Relationship>
}
export async function deleteRelationship(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-relationships/${id}`, { method: "DELETE", headers })
  if (!res.ok && res.status !== 404) throw new Error("Failed to remove link")  // 404-tolerant
}
```
**Backend body contract (mirror exactly — `models/document_relationship.py:38-47`):** POST body = `{ source_doc_id, target_doc_id, rel_type }`; `rel_type` is the closed `Literal["supersedes","amends","references","attached_to"]`.

---

### `frontend/src/types/index.ts` — ADD `RelType` / `RelationshipRow` / `RelatedDocumentsResponse` (model, TS types)

**Analog:** `MetadataFieldDef` (:216, mirrors a backend model) + `SavedView` (:288, mirrors `ViewResponse`). The project's single types module; types mirror the backend response shape.

**The mirror-the-backend convention (`types/index.ts:288-295`):**
```ts
/** A saved view (mirrors the backend `ViewResponse`). */
export interface SavedView { id: string; user_id?: string | null; name: string; filter_expr: ViewFilter; folder_scope?: string | null; is_global: boolean }
```

**The new types (RESEARCH §Code Examples — mirrors `get_related_documents`'s dict + the `RelationshipResponse` model):**
```ts
export type RelType = "supersedes" | "amends" | "references" | "attached_to"

export interface RelationshipRow {
  document_id: string | null      // null when the OTHER endpoint is masked (D-117-8 — never leaks id/title)
  filename: string                // real filename OR "linked document (no access)"
  rel_type: RelType
  direction: "outgoing" | "incoming"
  label: string                   // backend's raw label (rel_type | inverse) — display map mirrors casing
  relationship_id?: string        // the edge row id, for the remove ✕ (DELETE /{id})
}
export interface RelatedDocumentsResponse {
  subject: { document_id: string; filename: string }
  total: number
  documents: RelationshipRow[]
}
/** mirrors backend RelationshipResponse (models/document_relationship.py:50-63) — POST 201 body. */
export interface Relationship {
  id: string; user_id?: string | null
  source_doc_id: string; target_doc_id: string; rel_type: string; created_at?: string | null
}
```

---

### `frontend/src/components/relationships/RelationshipsSection.a11y.test.tsx` — NEW (test)

**Analog:** `frontend/src/components/metadata/DocumentDetailPanel.a11y.test.tsx` (vitest-axe + the partial-api-mock pattern). Also clone `RelationshipsSection.test.tsx` (grouped render + honest states + re-fetch-not-optimistic) and `CreateLinkDialog.test.tsx` (per-type exclusion) from the same scaffolding.

**The auth + partial-api mock + axe setup to clone (`DocumentDetailPanel.a11y.test.tsx:16-46`):**
```tsx
import { axe } from "vitest-axe"
// Mock Supabase auth so api.ts module-load never builds a real client:
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: vi.fn().mockResolvedValue(
  { data: { session: { user: { id: "user-1" }, access_token: "token" } } }) }, channel: vi.fn(), removeChannel: vi.fn() } }))
// Partial-mock the api client — observable + deterministic, everything else real:
const listRelationships = vi.fn(); const createRelationship = vi.fn(); const deleteRelationship = vi.fn()
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return { ...actual, listRelationships: (...a) => listRelationships(...a), /* create/delete */ }
})
```
**Assert (RESEARCH §Validation, SC#3):** no aXe AA violations across populated/empty/loading/error/masked; combobox roles wired (combobox/listbox/option + activedescendant); remove ✕ keyboard + coarse-pointer reachable; loading is `role="status"`, error is `role="alert"`, distinct from empty; masked row is not an error/empty.

---

## Shared Patterns

### Extract-don't-fork the leak-safe read (THE load-bearing cross-cutting rule)
**Source:** `backend/app/services/document_view_resolver.py` (the 115 precedent) — applied to the new `get_related_documents`.
**Apply to:** the service fn (owns the traversal) + the GET route + the agent handler (both CALL it; neither re-implements).
**Invariant:** `_resolve_readable_latest`, `.in_(version_ids)` edge queries, and the literal `"linked document (no access)"` must live ONLY in `document_relationship_service.py`. A fork re-opens the SC#2 leak (the `test_117_no_fork.py` grep guard catches it). Verify the two-user leak LIVE in secure-phase, NOT via the RLS label (D-102/D-110-5 "static would false-green").

### Per-viewer leak-safe access gate
**Source:** `document_relationship_service._resolve_readable_latest` (lines 143-247, CR-01/CR-02 hardened).
**Apply to:** every endpoint resolution (subject + each edge's other endpoint), scoped from the CALLER, never the edge/subject owner. An unseeable endpoint → `_NO_ACCESS_MASK` + `document_id:null` (D-117-8), never id/title/metadata.

### Auth + `aexec`/run_in_threadpool in async routes
**Source:** `document_relationships.py:70-74` (`Depends(get_current_user)` + `Depends(get_supabase)`) + `document_relationship_service.py` (every query rides `aexec`, line 46; zero bare `.execute()`).
**Apply to:** the new GET route + the new service fn (D-v2.5-01).

### No audit on a read
**Source:** `document_views.py:resolve_view` (writes no audit) + `audit_service.py:13-26` (`VALID_ACTION_TYPES` has no `relationship.read`).
**Apply to:** the new GET route only (the POST/DELETE DO audit — `relationship.create`/`relationship.delete` at `document_relationships.py:147-157, 185-190`).

### Reconcile after mutation; Realtime best-effort
**Source:** `DocumentDetailPanel.handleCommit` (lines 172-188).
**Apply to:** `RelationshipsSection` (re-fetch `listRelationships` after create/remove, not optimistic, no Undo — D-117-9). Note: relationships re-fetch is LOCAL to the section, not IngestionPage's `loadDocuments` (Pitfall 5).

### Honest states (role=status / role=alert; empty ≠ error)
**Source:** `DocumentDetailPanel.tsx:325-341` (save receipt `role="status" aria-live="polite"`, error `role="alert"`).
**Apply to:** `RelationshipsSection` loading (`role=status`) + error (`role=alert`), distinct from empty (D-117-10).

### Plain-dict on read paths (no tight response_model)
**Source:** `document_view_resolver.py:342-344` + `resolveView` client (`api.ts:2102`) — the 112 CR-01 lesson (a tight `extra="ignore"` response_model silently strips fields).
**Apply to:** the GET route returns the service's plain dict directly (RESEARCH Open Q3).

### Panel-scoped AA tokens (never global muted)
**Source:** `PanelSection.tsx:64-87` (`text-panel-muted-foreground-dim` / `text-panel-muted-foreground`) + `DocumentDetailPanel.tsx` header (`--panel-border`, `--panel-surface`).
**Apply to:** all RelationshipsSection + CreateLinkDialog text (UX-01 WCAG 2.1 AA).

---

## No Analog Found

Every file has a close in-repo analog. The two genuinely **net-new** elements have no exact precedent but a clear construction recipe (both flagged in RESEARCH):

| Element | Role | Data Flow | Reason / Recipe |
|---------|------|-----------|-----------------|
| Typeahead combobox (inside `CreateLinkDialog`) | component control | request-response | No `cmdk`/Command primitive in the repo (verified). Build a styled `<input>` + `<div role=listbox>` and wire APG roles by hand (RESEARCH Pattern 4 / Pitfall 2). Closest partial analog = the shadcn `Select` in `MoveToFolderDialog` (what it replaces) — reference it for the value/onChange/disabled wiring shape only. |
| `relationship_id` carried through each row | data field | n/a | Net-new to the read payload (the agent handler drops it at `tool_dispatcher.py:612-626`). Additive; verify against `test_116_tool_read.py` strict-shape (A6). |

---

## Metadata

**Analog search scope:** `backend/app/services/`, `backend/app/api/`, `backend/app/models/`, `frontend/src/components/{metadata,panel,health,relationships}/`, `frontend/src/lib/`, `frontend/src/types/`.
**Files scanned (read in full or targeted):** `document_view_resolver.py`, `document_relationship_service.py`, `document_relationships.py`, `tool_dispatcher.py:468-652`, `document_views.py:195-269`, `models/document_relationship.py`, `audit_service.py:10-29`, `main.py` (router mount), `DocumentDetailPanel.tsx`, `PanelSection.tsx`, `MoveToFolderDialog.tsx`, `DocumentDetailPanel.a11y.test.tsx:1-60`, `api.ts:1195-1206,1990-2112`, `types/index.ts:210-339`.
**Project skill loaded:** `.claude/skills/sketch-findings-agentic-rag` present; the LOCKED G-2 sketch is `references/document-relationships-panel.md` (034+035 winner A) — read it for the visual/a11y contract before implementing UI.
**Pattern extraction date:** 2026-06-20

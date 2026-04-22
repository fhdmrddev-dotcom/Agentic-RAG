# Phase 38: Knowledge Health Dashboard — Frontend - Research

**Researched:** 2026-04-18
**Domain:** React / TypeScript / shadcn/ui — new view with API integration and inline actions
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HLTH-05 | User can act directly from Library Health: delete, re-ingest, or move a document to a folder | All three action flows have verified backend endpoints; delete reuses existing `deleteDocument` api.ts function; move uses confirmed `PATCH /documents/{id}/move` endpoint; re-ingest requires new backend endpoint (no existing dedicated endpoint found) |

</phase_requirements>

---

## Summary

Phase 38 builds a new "Library Health" view that lives alongside Documents, Skills, and Settings in the sidebar. It consumes the `GET /knowledge-health/summary` endpoint built in Phase 37 and renders four metric panels (Most Retrieved, Never Retrieved, Low Confidence, Stale), each with per-document action buttons: Delete, Re-ingest, Move to Folder.

The UI contract is fully specified in `038-UI-SPEC.md` and has been pre-approved. The design system, component structure, layout anatomy, color tokens, and copywriting are all locked — there are no open aesthetic decisions for the planner. The primary task is wiring up the approved spec to real API calls using established project patterns.

The only significant gap between the UI spec and existing backend is the **Re-ingest action**: no dedicated re-ingest endpoint exists in `documents.py`. The UI spec acknowledges this as "implementation detail for planner — may require file fetch from storage URL." The planner must decide how to implement re-ingest: either add a `POST /documents/{id}/reingest` backend endpoint or use `restoreDocumentVersion` (which triggers re-ingestion of an existing version). The restore-based approach is simpler but semantically conflates "restore old version" with "re-run ingestion of current version."

**Primary recommendation:** Add `POST /documents/{id}/reingest` to the backend (Plan 1), then build all frontend components (Plan 2), following the exact UI spec contract. Plan 1 is a backend-only change; Plan 2 is frontend-only.

---

## Component Pattern Analysis

### Existing components to reuse or pattern against

**`DocumentList.tsx`** (`frontend/src/components/ingestion/DocumentList.tsx`)
- `getFileIcon(filename)` — local function returning SVG per extension. Must be extracted or duplicated for `HealthDocumentRow`.
- Delete flow: `deleteTarget` state + Dialog confirm + calls `onDelete(id)` prop. Exactly the pattern the UI spec mandates.
- Action button sizing: `Button variant="ghost" size="sm" className="h-7 w-7 p-0"` — matches h-7 w-7 p-0 spec.
- Version badge: `bg-primary/10 text-primary px-2 py-0.5 text-xs rounded-full` — matches retrieval count badge spec.
- Imports: `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter` from shadcn.

**`MemorySection.tsx`** (`frontend/src/components/settings/MemorySection.tsx`)
- Card pattern: `Card className="ghost-border bg-card/50 shadow-sm"` — directly maps to HealthPanel card style.
- Action error auto-dismiss: 4-second `setTimeout` on `actionError` state.
- Hover action pattern: `div className="... opacity-0 group-hover:opacity-100 transition-opacity"` on a `group` parent — matches HealthDocumentRow spec.
- Empty state: `flex flex-col items-center justify-center py-10 text-center` with icon + text.
- Uses `Card` directly (not a SectionCard wrapper) for clean CardHeader layout — same decision needed for HealthPanel.

**`Sidebar.tsx`** (`frontend/src/components/layout/Sidebar.tsx`)
- "Knowledge Base" section starts at line 204 inside the fixed footer `div`.
- Active nav button pattern:
  ```tsx
  className={cn(
    "w-full justify-start gap-2 transition-all py-2",
    activeView === "documents"
      ? "bg-primary/10 text-primary font-medium"
      : "text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40",
  )}
  ```
- Active indicator line (left 2px vertical bar): rendered as `div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-primary"` inside the thread div — the nav buttons do NOT currently render this bar, only thread items do. The UI spec says the Library Health item should include it. The planner should decide whether to add a relative wrapper + absolute bar, or rely solely on `bg-primary/10` background (threads use both; nav buttons currently use only background color).
- Skills nav item uses `Zap` icon; Documents uses `FileText`. New item uses `Activity` icon per spec.
- Settings currently placed in the Knowledge Base section (not a separate section). `"library-health"` button goes between Documents and Skills per spec.

**`ChatLayout.tsx`** (`frontend/src/components/layout/ChatLayout.tsx`)
- View routing is a conditional chain in the `<main>` block:
  ```tsx
  activeView === "documents" ? <IngestionPage /> :
  activeView === "skills"    ? <SkillsPage onTryInChat={...} /> :
  activeView === "settings"  ? <SettingsPage /> :
  <ChatArea ... />
  ```
- Adding `"library-health"` requires inserting one more ternary branch before the chat fallback.
- `ChatLayout` imports its page components inline — the new `KnowledgeHealthPage` import goes here.

### New components to create

All live in `frontend/src/components/health/`:

| Component | Purpose |
|-----------|---------|
| `KnowledgeHealthPage.tsx` | Root page; fetches summary; renders 4 HealthPanel in 2-col grid |
| `HealthPanel.tsx` | Single metric card; CardHeader + CardContent with rows |
| `HealthDocumentRow.tsx` | One document row; metric chip + 3 action buttons |
| `HealthEmptyState.tsx` | Centered icon + heading + body |
| `MoveToFolderDialog.tsx` | Dialog with folder Select; calls PATCH /documents/{id}/move |

---

## Routing & Navigation Wiring

### App.tsx — ActiveView type

Current definition (line 8):
```typescript
export type ActiveView = "chat" | "documents" | "skills" | "settings"
```

Required change: add `"library-health"` to the union.

### Sidebar.tsx — nav button addition

Location: inside the "Knowledge Base" section `div.space-y-0.5` (around line 208), between the Documents button and the Skills button.

Required imports to add: `Activity` from `"lucide-react"`.

Button template (follows existing pattern exactly):
```tsx
<Button
  onClick={() => onNavigate("library-health")}
  variant="ghost"
  size="sm"
  className={cn(
    "w-full justify-start gap-2 transition-all py-2",
    activeView === "library-health"
      ? "bg-primary/10 text-primary font-medium"
      : "text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40",
  )}
>
  <Activity className="h-4 w-4" />
  Library Health
</Button>
```

Note: The existing nav buttons do not have a visible left-2px indicator line (unlike thread items). The UI spec says "Active nav indicator line (left 2px `bg-primary` vertical bar — matches existing thread selection pattern)." The planner should verify whether this means adding the bar to Library Health specifically, or treating the existing `bg-primary/10` background as sufficient for nav items.

### ChatLayout.tsx — view dispatch

Add to the view dispatch chain before the chat fallback:
```tsx
} : activeView === "library-health" ? (
  <KnowledgeHealthPage />
) : (
  <ChatArea ... />
```

---

## API Integration Patterns

### Authenticated fetch pattern

All API calls in `api.ts` use one of two helpers:
- `getAuthHeaders()` — returns `{ "Content-Type": "application/json", Authorization: "Bearer {token}" }` — use for all JSON requests.
- `getAuthToken()` — returns raw token string — use for FormData (multipart) or blob download requests.

### Pattern for new API functions in api.ts

```typescript
export async function getKnowledgeHealthSummary(staleDays = 90): Promise<HealthSummary> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/summary?stale_days=${staleDays}`, { headers })
  if (!res.ok) throw new Error("Failed to load health summary")
  return res.json() as Promise<HealthSummary>
}
```

### Existing api.ts functions reusable directly

- `deleteDocument(id: string)` — calls `DELETE /documents/{id}` — ready to use in HealthDocumentRow delete flow.
- `listFolders()` — calls `GET /folders` — ready to use in MoveToFolderDialog.

### New api.ts functions needed

| Function | Method + Path | Notes |
|----------|--------------|-------|
| `getKnowledgeHealthSummary(staleDays?)` | `GET /knowledge-health/summary?stale_days=N` | Returns `HealthSummary` |
| `moveDocument(id, folderId)` | `PATCH /documents/{id}/move` | Body: `{ folder_id: string \| null }` |
| `reingestDocument(id)` | `POST /documents/{id}/reingest` | New backend endpoint needed — see Re-ingest section |

---

## Backend Contract (Phase 37)

The endpoint is live at `GET /knowledge-health/summary`. Verified from `knowledge_health.py`.

Constants in the backend (for frontend display copy):
- `LOW_CONF_THRESHOLD = 0.40`
- `WINDOW_DAYS = 30`
- Default stale threshold: `stale_days = 90` (query param, default 90)

Response shape (TypeScript interface for `api.ts`):
```typescript
interface MostRetrievedDoc {
  document_id: string
  filename: string
  folder_id: string | null
  created_at: string
  file_size: number
  retrieval_count: number
  last_retrieved_at: string
}

interface NeverRetrievedDoc {
  document_id: string
  filename: string
  folder_id: string | null
  created_at: string
  file_size: number
}

interface LowConfidenceDoc {
  document_id: string
  filename: string
  folder_id: string | null
  created_at: string
  file_size: number
  avg_similarity: number
}

interface StaleDoc {
  document_id: string
  filename: string
  folder_id: string | null
  created_at: string
  file_size: number
  days_stale: number
}

interface HealthSummary {
  most_retrieved: MostRetrievedDoc[]
  never_retrieved: NeverRetrievedDoc[]
  low_confidence: LowConfidenceDoc[]
  stale: StaleDoc[]
}
```

Error response: Backend returns 502 with `{ "detail": "Health metrics temporarily unavailable" }` on any internal error. Frontend error banner text: "Health metrics could not be loaded. Refresh to try again."

---

## Action Flows (Delete / Re-ingest / Move)

### Delete

**Backend:** `DELETE /documents/{document_id}` — already in `api.ts` as `deleteDocument(id)`.

**Frontend pattern (from DocumentList.tsx):**
1. `deleteTarget` state holds the document object (or null when closed).
2. Click Trash2 → `setDeleteTarget(doc)`.
3. Dialog opens (controlled by `deleteTarget !== null`).
4. Confirm → call `deleteDocument(doc.document_id)` → optimistically remove row from local state → close dialog.
5. Error → close dialog + show inline row error banner.

**Difference from DocumentList.tsx:** The health dashboard owns its own local copy of the summary arrays (not shared with IngestionPage). Optimistic removal means filtering the relevant array (e.g., `most_retrieved`) from local state.

### Re-ingest

**Backend status:** NO dedicated re-ingest endpoint exists. The closest is `POST /documents/{id}/restore` which promotes an older version to `is_latest=True`. This does NOT re-run ingestion on the current version.

**Recommended solution:** Add `POST /documents/{id}/reingest` to `documents.py`. This endpoint should:
1. Verify document ownership and `is_latest=True`.
2. Set document `status = "pending"` to trigger the background ingestion task.
3. Return the updated document row.

This pattern is simpler than re-uploading from storage URL and avoids multipart file fetching in the browser.

**Alternative (if backend plan is out of scope for Phase 38):** The UI spec allows the planner to decide. A "re-upload from storage URL" approach would require fetching the file from Supabase Storage and re-posting it as FormData — possible but adds complexity and storage URL expiry risk.

**Frontend flow (per UI spec):**
1. Click RefreshCw → show inline tooltip confirmation (not a full Dialog — lightweight).
2. Confirm → call `POST /documents/{id}/reingest` → show `Loader2 animate-spin` in row.
3. On success: row chip updates (ideally re-fetch summary or patch row status).
4. On error: show inline error text below action buttons.

### Move to Folder

**Backend:** `PATCH /documents/{document_id}/move` with body `{ "folder_id": "<uuid>" | null }`.
- Verified in `documents.py` at line 451.
- `DocumentMoveRequest` Pydantic model: `folder_id: UUID | None`.
- Validates folder accessibility (owned or global) before moving.
- Returns `DocumentResponse` (full document object).

**Folders source:** `GET /folders` — already in `api.ts` as `listFolders()`.

**Frontend flow (per UI spec):**
1. Click FolderInput → open `MoveToFolderDialog`.
2. Dialog fetches folders on mount via `listFolders()`.
3. Select includes "Root (no folder)" option (`folder_id = null`) + one entry per folder.
4. Confirm → call `PATCH /documents/{id}/move` with `{ folder_id: selected | null }`.
5. Close dialog → update local row state.

**Note:** The MoveToFolderDialog needs to fetch folders. Two options:
- **Fetch inside dialog on open** — simple, no prop drilling, small latency.
- **Pass folders as prop from parent** — zero latency if parent already has folders.
The HealthPage has no other reason to load folders unless it pre-fetches. Fetching inside the dialog on open is simpler and follows the `VersionHistoryPanel` pattern in DocumentList.tsx.

---

## Shadcn Component Availability

Confirmed installed (files exist in `frontend/src/components/ui/`):

| Component | File | Status |
|-----------|------|--------|
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | `card.tsx` | INSTALLED |
| `Button` | `button.tsx` | INSTALLED |
| `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` | `dialog.tsx` | INSTALLED |
| `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` | `select.tsx` | INSTALLED |
| `Tooltip`, `TooltipContent`, `TooltipTrigger` | `tooltip.tsx` | INSTALLED |

NOT found in `frontend/src/components/ui/`:
- `Skeleton` — no `skeleton.tsx` file exists. The UI spec calls for `animate-pulse bg-muted/30 h-10 rounded` skeleton rows. The planner should either install shadcn/skeleton via CLI or build inline skeleton divs using Tailwind classes directly (inline approach is simpler and consistent with the existing spinner patterns in MemorySection.tsx).

All required shadcn components are installed. The only gap is Skeleton — the inline Tailwind approach avoids any shadcn CLI invocation.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `frontend/vite.config.ts` (vitest embedded in vite config) |
| Quick run command | `cd frontend && npm test -- --reporter=verbose` |
| Full suite command | `cd frontend && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HLTH-05 (delete) | `deleteDocument` called with correct document_id | unit (api.ts) | `cd frontend && npm test -- api` | ✅ `src/__tests__/lib/api.test.ts` |
| HLTH-05 (move) | `moveDocument` sends PATCH with correct body | unit (api.ts) | `cd frontend && npm test -- api` | ❌ Wave 0 |
| HLTH-05 (re-ingest) | `reingestDocument` sends POST to correct URL | unit (api.ts) | `cd frontend && npm test -- api` | ❌ Wave 0 |
| HLTH-05 (health fetch) | `getKnowledgeHealthSummary` builds correct URL with stale_days | unit (api.ts) | `cd frontend && npm test -- api` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend && npm test -- api`
- **Per wave merge:** `cd frontend && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Add `getKnowledgeHealthSummary`, `moveDocument`, `reingestDocument` test cases to `frontend/src/__tests__/lib/api.test.ts` — covers HLTH-05 API layer
- [ ] No new test infrastructure needed (Vitest + existing mocks are sufficient)

---

## Key Decisions for Planner

### Decision 1: Re-ingest endpoint strategy (BLOCKING)

The most important open question. The UI spec defers this to the planner.

**Option A (Recommended):** Add `POST /documents/{id}/reingest` to `backend/app/api/documents.py`. Sets document to `status="pending"` and re-triggers background ingestion. Simple, clean, consistent with restore pattern. Requires a Plan 1 backend task.

**Option B:** Use `restoreDocumentVersion` (existing `POST /documents/{id}/restore`). Only works if there are multiple versions. Semantically wrong for single-version documents. Not recommended.

**Option C:** Re-upload from Supabase Storage URL. Fetch file bytes in browser → re-POST as FormData. Fragile (URL expiry), complex, no clear benefit. Not recommended.

### Decision 2: Plan split

Given Option A: 2 plans are appropriate.
- **Plan 1 (Backend):** Add `POST /documents/{id}/reingest` endpoint + tests.
- **Plan 2 (Frontend):** All frontend components + api.ts functions + routing wiring.

### Decision 3: getFileIcon duplication

`getFileIcon` is a local function in `DocumentList.tsx`. It is not exported. Options:
- **Extract to `frontend/src/lib/fileIcons.tsx`** — export and import from both DocumentList and HealthDocumentRow. Clean, no duplication.
- **Duplicate inline in HealthDocumentRow.tsx** — faster but creates drift risk.

Recommendation: Extract to shared `fileIcons.tsx` utility in Plan 2.

### Decision 4: Folder loading in MoveToFolderDialog

Options:
- **Fetch on dialog open** (inside component with `useEffect([open])`) — simple, self-contained, consistent with VersionHistoryPanel.
- **Pass folders from parent** — only worth it if KnowledgeHealthPage already fetches folders for another reason.

Recommendation: Fetch inside dialog. KnowledgeHealthPage has no other use for folders.

### Decision 5: Sidebar active indicator bar

Current nav buttons (Documents, Skills, Settings) do NOT render the 2px left bar — only thread items do. The UI spec says the Library Health item should have it. The planner should:
- Either add a `relative` wrapper + `absolute left-0 ... bg-primary` bar to the Library Health button only.
- Or skip it and rely on `bg-primary/10` alone (matching the other nav buttons' behavior).

Recommendation: Skip the bar for consistency with other nav items. Only threads use the bar pattern.

### Decision 6: KnowledgeHealthPage location (page vs component)

Other views follow `pages/*.tsx` convention (`IngestionPage`, `SettingsPage`, `SkillsPage`). `KnowledgeHealthPage` should be created at `frontend/src/pages/KnowledgeHealthPage.tsx`, with sub-components in `frontend/src/components/health/`.

---

## Project Constraints (from CLAUDE.md)

- Frontend: React + Vite + Tailwind + shadcn/ui — no framework additions.
- No LangChain, no LangGraph — not applicable to this frontend phase.
- Python backend must use `venv` — applies to Plan 1 backend work.
- All tables need RLS — backend endpoint already enforces RLS via Python-side user_id filter (Phase 37).
- Ingestion is manual file upload only — re-ingest endpoint must trigger existing background task, not a new pipeline.
- Plans saved to `.agent/plans/` — this is the CLAUDE.md convention, but the GSD workflow saves to `.planning/phases/`. GSD convention takes precedence.

---

## Sources

### Primary (HIGH confidence)
- `backend/app/api/knowledge_health.py` — verified endpoint path, response fields, constants
- `backend/app/api/documents.py` — verified `DELETE /documents/{id}` and `PATCH /documents/{document_id}/move` endpoints
- `backend/app/models/document.py` — verified `DocumentMoveRequest` schema
- `frontend/src/components/layout/Sidebar.tsx` — verified nav button pattern, Knowledge Base section, active state classes
- `frontend/src/components/ingestion/DocumentList.tsx` — verified delete Dialog pattern, `getFileIcon`, action button sizing
- `frontend/src/components/settings/MemorySection.tsx` — verified Card pattern, hover opacity pattern, error banner pattern
- `frontend/src/lib/api.ts` — verified auth patterns, `deleteDocument`, `listFolders`, all existing API function signatures
- `frontend/src/App.tsx` — verified `ActiveView` type definition
- `frontend/src/components/layout/ChatLayout.tsx` — verified view dispatch pattern
- `frontend/src/types/index.ts` — verified `Document`, `Folder` type shapes
- `frontend/src/components/ui/*.tsx` — verified which shadcn components are installed
- `.planning/phases/038-knowledge-health-dashboard-frontend/038-UI-SPEC.md` — approved design contract

### Secondary (MEDIUM confidence)
- Phase 37 SUMMARY files — describe what was built and confirm endpoint is registered

---

## Metadata

**Confidence breakdown:**
- Component patterns: HIGH — read source directly
- Routing wiring: HIGH — read App.tsx, ChatLayout.tsx, Sidebar.tsx directly
- API patterns: HIGH — read api.ts directly
- Backend contract: HIGH — read knowledge_health.py and documents.py directly
- Re-ingest gap: HIGH (gap confirmed) — no reingest endpoint found in any backend file
- Shadcn availability: HIGH — verified by file listing
- Test framework: HIGH — verified vitest version and existing test pattern

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (stable stack)

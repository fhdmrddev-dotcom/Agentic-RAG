# Phase 16: Skill File Management UI - Research

**Researched:** 2026-04-04
**Domain:** React frontend — file upload/list/delete UI embedded in the existing Skills UI from Phase 12
**Confidence:** HIGH

---

## Summary

Phase 16 is a focused frontend addition. The backend file attachment API (upload, list, delete) was fully implemented in Phase 10 and has been running since 2026-03-31. The gap is purely on the frontend: `api.ts` has no `uploadSkillFile`, `listSkillFiles`, or `deleteSkillFile` functions, and there is no UI surface for managing files on a skill. The existing `SkillFormDialog` (create/edit skill) and `SkillCard` are the two natural attachment points.

The work divides into three layers:

1. **`api.ts` additions** — three new functions using the existing `getAuthToken`/`getAuthHeaders` helpers, matching the Phase 10 backend routes exactly: `POST /skills/{skill_id}/files` (multipart), `GET /skills/{skill_id}/files`, `DELETE /skills/{skill_id}/files/{file_id}`.
2. **`types/index.ts` addition** — a `SkillFile` interface matching the `SkillFileResponse` Pydantic model.
3. **UI surface** — a file management section inside `SkillFormDialog` (the edit dialog is already open when the user is managing a skill; attaching files there is the most natural UX). The section shows a list of attached files with delete buttons and a file picker for upload. Owner-only; non-owners see a read-only file list (same ownership gate used for Edit/Delete actions on `SkillCard`).

The E2E flow (Success Criterion 5) requires no new backend work: `load_skill` already returns `files[]` and `read_skill_file` is already implemented and tested. The frontend just needs to make files uploadable so they exist in the `skill_files` table.

**Primary recommendation:** Add the file management section directly inside `SkillFormDialog`. Use the same `getAuthToken()` + FormData pattern as `uploadDocument` in `api.ts`. Wire a `useSkillFiles` hook (or inline state within the dialog) to list and delete files for the current skill.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FILE-01 | User can upload files to a skill (Python scripts, templates, reference data) | New `uploadSkillFile` in api.ts + file picker UI in SkillFormDialog |
| FILE-02 | User can delete a file from a skill | New `deleteSkillFile` in api.ts + delete button per file row in SkillFormDialog |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- React + Vite + Tailwind + shadcn/ui for frontend
- Python + FastAPI for backend (already done in Phase 10; Phase 16 is frontend-only)
- No new libraries — project rule enforced across all phases
- All tables need Row-Level Security (already implemented in Phase 10; no schema changes in this phase)
- Plans saved to `.agent/plans/` — not applicable to research output

---

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React + TypeScript | 19.x / ~5.9 | Component framework | Project stack |
| Tailwind CSS | 3.4.x | Styling | Project stack |
| shadcn/ui (Radix) | existing | Button, Input, Dialog, Tooltip — already installed | Consistent design system |
| lucide-react | 0.577.x | Icons — `Paperclip`, `Trash2`, `Upload`, `FileText`, `Loader2` all available | Already used throughout |
| Vitest + Testing Library | 4.x | Frontend tests | Already configured |

### No New Libraries Required

All UI primitives are already installed. File upload uses the browser's native `File` API + `FormData`, same as `uploadDocument` in `api.ts`.

---

## Architecture Patterns

### Recommended File Structure (new and modified files)

```
frontend/src/
├── types/index.ts                  # ADD: SkillFile interface
├── lib/api.ts                      # ADD: uploadSkillFile, listSkillFiles, deleteSkillFile
├── components/skills/
│   └── SkillFormDialog.tsx         # MODIFY: add file management section (FILES tab or inline)
└── __tests__/
    └── lib/api.test.ts             # EXTEND: add tests for the three new api functions
```

No new pages, no new routes, no new hooks required if file state is managed inline within `SkillFormDialog`. An optional `useSkillFiles` hook can be extracted for testability — this is a discretion choice for the planner.

### Pattern 1: SkillFile Type Interface

Add to `frontend/src/types/index.ts`:

```typescript
// Matches backend SkillFileResponse Pydantic model (backend/app/models/skill.py)
export interface SkillFile {
  id: string
  skill_id: string
  user_id: string
  filename: string
  file_path: string
  file_size: number
  mime_type: string
  created_at: string
}
```

### Pattern 2: API Functions — exact signatures and HTTP routes

Backend routes (verified in `backend/app/api/skills.py`):

| Function | Method | Route | Auth | Body |
|----------|--------|-------|------|------|
| `listSkillFiles(skillId)` | GET | `/skills/{skill_id}/files` | Bearer token | — |
| `uploadSkillFile(skillId, file)` | POST | `/skills/{skill_id}/files` | Bearer token (no Content-Type) | FormData with `file` field |
| `deleteSkillFile(skillId, fileId)` | DELETE | `/skills/{skill_id}/files/{file_id}` | Bearer token | — |

```typescript
// Add to frontend/src/lib/api.ts

export async function listSkillFiles(skillId: string): Promise<SkillFile[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/files`, { headers })
  if (!res.ok) throw new Error("Failed to list skill files")
  return res.json() as Promise<SkillFile[]>
}

export async function uploadSkillFile(skillId: string, file: File): Promise<SkillFile> {
  const token = await getAuthToken()     // NOT getAuthHeaders() — FormData sets its own Content-Type
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`${API_BASE}/skills/${skillId}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }))
    throw new Error((err as { detail: string }).detail ?? "Upload failed")
  }
  return res.json() as Promise<SkillFile>
}

export async function deleteSkillFile(skillId: string, fileId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/files/${fileId}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) throw new Error("Failed to delete skill file")
}
```

**CRITICAL:** `uploadSkillFile` MUST use `getAuthToken()` not `getAuthHeaders()`. Setting `Content-Type: application/json` manually on a FormData request corrupts the multipart boundary. This is the same pattern as `uploadDocument` and `importSkillZip`. (Established pitfall documented in Phase 13 decisions.)

### Pattern 3: File Management UI in SkillFormDialog

The `SkillFormDialog` currently renders: Name, Description, Instructions, footer buttons. Files should appear as a new section between Instructions and the footer, visible only when editing an existing skill (`isEdit === true`). There is no point showing it on "New Skill" — the skill must exist before files can be attached.

**Recommended UI layout:**

```tsx
{/* Files section — only shown in edit mode */}
{isEdit && skill && (
  <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium text-foreground">Attached Files</label>
      {isOwner && (
        <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
          {uploading ? "Uploading..." : "Attach File"}
        </Button>
      )}
    </div>
    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
    {files.length === 0 ? (
      <p className="text-xs text-muted-foreground">No files attached.</p>
    ) : (
      <ul className="flex flex-col gap-1">
        {files.map((f) => (
          <li key={f.id} className="flex items-center justify-between text-xs bg-muted rounded px-2 py-1">
            <span className="flex items-center gap-1 text-foreground truncate">
              <FileText className="h-3 w-3 shrink-0" />
              {f.filename}
              <span className="text-muted-foreground ml-1">({formatBytes(f.file_size)})</span>
            </span>
            {isOwner && (
              <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-destructive shrink-0" onClick={() => handleDeleteFile(f.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    )}
    {fileError && <p className="text-xs text-destructive">{fileError}</p>}
  </div>
)}
```

**Ownership gate:** `isOwner` is already computable from `skill.user_id === currentUserId`. The `SkillFormDialog` currently doesn't receive `currentUserId` — the planner must decide whether to pass it as a prop from `SkillsPage` (which receives `user` from `useAuth`) or call `useAuth()` inside the dialog. Either approach is valid; passing as a prop is cleaner.

### Pattern 4: File State Management inside SkillFormDialog

Files for the current skill are loaded when the dialog opens (in the `useEffect` that fires on `open`):

```tsx
const [files, setFiles] = useState<SkillFile[]>([])
const [uploading, setUploading] = useState(false)
const [fileError, setFileError] = useState<string | null>(null)
const fileInputRef = useRef<HTMLInputElement>(null)

useEffect(() => {
  if (open && skill) {
    // reset form fields...
    setFiles([])
    setFileError(null)
    // Load files
    listSkillFiles(skill.id)
      .then(setFiles)
      .catch(() => setFileError("Failed to load files"))
  }
}, [open, skill])

const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file || !skill) return
  setUploading(true)
  setFileError(null)
  try {
    const newFile = await uploadSkillFile(skill.id, file)
    setFiles((prev) => [...prev, newFile])
  } catch (err) {
    setFileError(err instanceof Error ? err.message : "Upload failed")
  } finally {
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }
}

const handleDeleteFile = async (fileId: string) => {
  if (!skill) return
  try {
    await deleteSkillFile(skill.id, fileId)
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
  } catch {
    setFileError("Failed to delete file. Try again.")
  }
}
```

### Pattern 5: File Size Formatter

A small inline helper (no library needed):

```typescript
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
```

### Pattern 6: Existing Upload Reference (uploadDocument in api.ts)

The `uploadDocument` function in `api.ts` (lines 175-191) is the canonical pattern for multipart upload in this codebase:

```typescript
// Source: frontend/src/lib/api.ts lines 175-191
export async function uploadDocument(file: File, folderId?: string | null): Promise<...> {
  const token = await getAuthToken()   // <-- token only, no Content-Type header
  const formData = new FormData()
  formData.append("file", file)
  if (folderId) formData.append("folder_id", folderId)
  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  ...
}
```

`uploadSkillFile` must follow this pattern exactly.

### Anti-Patterns to Avoid

- **Setting `Content-Type: application/json` on a FormData upload:** The browser must set the `Content-Type` with the multipart boundary. Using `getAuthHeaders()` instead of `getAuthToken()` on the upload call adds `Content-Type: application/json` and breaks the request.
- **Showing the file section on the "New Skill" dialog:** The backend `POST /skills/{skill_id}/files` requires a valid `skill_id`. A new skill doesn't have an ID until after `POST /skills` completes. Show the file section only when `isEdit === true` and `skill` is non-null.
- **Calling listSkillFiles on every render:** Only fetch on dialog open (in the `useEffect` with `[open, skill]` dependency). Don't fetch inside the component body without a trigger.
- **Using `fetch` directly in components:** All API calls must go through `api.ts`. This is a project-wide convention established in Phase 03.
- **Calling `deleteSkillFile` without skill_id:** The backend DELETE route is `/skills/{skill_id}/files/{file_id}` — both IDs are required. The `skill.id` is available via the `skill` prop on the dialog.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File picker | Custom drag-drop zone | Native `<input type="file" className="hidden">` triggered by a Button | Phase 13 (importSkillZip) already uses this pattern; consistent; zero dependencies |
| File size display | Custom unit formatter | Inline `formatBytes` helper (5 lines) | No library needed; standard pattern throughout the codebase |
| Upload progress | Custom progress bar | None — show `Loader2` spinner on the Attach button | Files are expected to be small (10 MB limit); progress bar is overkill |
| File type validation | Client-side MIME checks | None — backend handles size (413) and the backend accepts any type | Validated server-side; client guard adds complexity with no benefit |

---

## Common Pitfalls

### Pitfall 1: getAuthHeaders() used for multipart upload (CRITICAL)

**What goes wrong:** `uploadSkillFile` uses `getAuthHeaders()` which sets `Content-Type: application/json`. The backend receives a broken multipart body and returns a 422 Unprocessable Entity.

**Why it happens:** `getAuthHeaders()` is the default helper; developers reach for it without thinking. FormData requires the browser to set `Content-Type` with the multipart boundary.

**How to avoid:** Use `getAuthToken()` and pass only `Authorization` header — same as `uploadDocument` and `importSkillZip`. This is the established project pattern.

**Warning signs:** Backend returns 422 on file upload; request body shows `Content-Type: application/json` in Network tab.

### Pitfall 2: File section shown on "New Skill" dialog

**What goes wrong:** User fills in the New Skill form, sees the file section, tries to attach a file before saving — the upload fails with 404 because the skill doesn't exist yet.

**Why it happens:** Rendering the file section unconditionally on `isEdit` check omitted.

**How to avoid:** Gate the file section on `isEdit && skill` being truthy. For new skills, the file section is never shown. User must Save the skill first, then open Edit to attach files.

**Warning signs:** Upload returns 404 or 403 during "New Skill" creation.

### Pitfall 3: Dialog doesn't pass currentUserId — ownership check missing

**What goes wrong:** `SkillFormDialog` shows Attach File and Delete buttons to non-owners who view a global skill.

**Why it happens:** `SkillFormDialog` currently receives only `skill`, `open`, `onOpenChange`, `onSave` — no user ID. Without `currentUserId`, the ownership check `skill.user_id === currentUserId` is impossible inside the dialog.

**How to avoid:** Pass `currentUserId: string` as a prop from `SkillsPage` (which already has `user` from `useAuth`). Alternatively, call `useAuth()` inside `SkillFormDialog` — both are acceptable; prop-passing is more testable.

**Warning signs:** Non-owners see upload/delete controls on read-only skills.

### Pitfall 4: Stale file list after upload/delete

**What goes wrong:** User uploads a file, the file list doesn't update — user sees "No files attached" or the old list.

**Why it happens:** File list only fetched on dialog open; no state update after mutation.

**How to avoid:** On successful upload, append the returned `SkillFile` to local state. On successful delete, filter it out. No re-fetch needed — optimistic mutation is correct here (backend confirms via the returned object).

**Warning signs:** File list doesn't update after upload or delete without closing and reopening the dialog.

### Pitfall 5: fileInputRef value not reset after upload

**What goes wrong:** User uploads a file, then tries to upload the same file again — the `onChange` event doesn't fire because the input value hasn't changed.

**Why it happens:** Browser `<input type="file">` doesn't re-fire `onChange` if the same file is selected again.

**How to avoid:** Reset `fileInputRef.current.value = ""` in the `finally` block of `handleFileUpload`. This is the established pattern from `SkillsPage.tsx` (importSkillZip handler, line 64).

**Warning signs:** Second upload of the same filename silently does nothing.

---

## Code Examples

### Backend Route Signatures (verified from skills.py)

```python
# Source: backend/app/api/skills.py

@router.get("/{skill_id}/files", response_model=list[SkillFileResponse])
# Returns: list of SkillFileResponse (id, skill_id, user_id, filename, file_path, file_size, mime_type, created_at)
# Access: owner OR global skill

@router.post("/{skill_id}/files", response_model=SkillFileResponse, status_code=201)
# Body: multipart/form-data with `file` field
# 10 MB size limit (413 if exceeded)
# Owner-only (403 if not owner)

@router.delete("/{skill_id}/files/{file_id}", status_code=204)
# Owner-only (404 if not found or not owned)
# Deletes from storage + metadata row
```

### Existing multipart upload pattern (reference)

```typescript
// Source: frontend/src/lib/api.ts lines 175-191 (uploadDocument)
// uploadSkillFile MUST follow this exact pattern
const token = await getAuthToken()    // NOT getAuthHeaders()
const formData = new FormData()
formData.append("file", file)
const res = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },  // NO Content-Type
  body: formData,
})
```

### File input pattern (reference from SkillsPage.tsx)

```tsx
// Source: frontend/src/pages/SkillsPage.tsx lines 21, 95, 63-64
const fileInputRef = useRef<HTMLInputElement>(null)
// ...
<input ref={fileInputRef} type="file" className="hidden" onChange={handleImport} />
// In handler finally block:
if (fileInputRef.current) fileInputRef.current.value = ""
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No file management UI | File APIs exist (Phase 10), UI missing (Phase 16 gap) | 2026-04-04 audit | Phase 16 closes the gap |
| Phase 13 established multipart pattern with getAuthToken() | Same pattern required for uploadSkillFile | Phase 13 (2026-04-02) | No new patterns needed — follow established convention |

---

## Open Questions

1. **Where to place "Attach File" in SkillFormDialog — inline section vs. separate "Files" tab**
   - What we know: The dialog currently has Name, Description, Instructions, and footer. Adding a file section inline makes the dialog taller for skills with many files.
   - What's unclear: Whether a tab-based layout (Details / Files) is preferred, or simple inline section is sufficient.
   - Recommendation: Start with inline section below Instructions for Phase 16 (simpler, no new tab UI component needed). The dialog is shown by clicking Edit, so a somewhat taller dialog is acceptable. If file count grows, a tab layout can be introduced later.

2. **Should the planner use inline state in SkillFormDialog or extract a useSkillFiles hook?**
   - What we know: The file state (loading, list, upload, delete) is self-contained to the dialog. No other component needs file state.
   - What's unclear: Whether future phases will need the hook elsewhere (e.g., SkillCard showing file count).
   - Recommendation: Inline state in SkillFormDialog for Phase 16. Extract the hook if a second consumer appears. Fewer files, cleaner implementation.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 16 is a pure frontend code change. No external tools, runtimes, or services beyond what already exists in the running project (React dev server, FastAPI backend). All backend APIs verified implemented and running since Phase 10.

---

## Validation Architecture

`workflow.nyquist_validation` is absent from `.planning/config.json` — treating as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + Testing Library React 16.x |
| Config file | `frontend/vitest.config.ts` |
| Quick run command | `cd "C:/Vibe Apps/Agentic RAG/frontend" && npm test` |
| Full suite command | `cd "C:/Vibe Apps/Agentic RAG/frontend" && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FILE-01 | `uploadSkillFile` calls POST /skills/{id}/files with FormData | unit | `npm test` | Wave 0 — extend api.test.ts |
| FILE-01 | `uploadSkillFile` uses token-only auth (no Content-Type header) | unit | `npm test` | Wave 0 — extend api.test.ts |
| FILE-02 | `deleteSkillFile` calls DELETE /skills/{id}/files/{fid} | unit | `npm test` | Wave 0 — extend api.test.ts |
| FILE-01+02 | `listSkillFiles` calls GET /skills/{id}/files | unit | `npm test` | Wave 0 — extend api.test.ts |
| FILE-01 | SkillFormDialog shows file section in edit mode | unit | `npm test` | Wave 0 |
| FILE-01 | SkillFormDialog hides file section in create mode | unit | `npm test` | Wave 0 |
| FILE-01+02 | Attach/Delete buttons hidden for non-owners | unit | `npm test` | Wave 0 |
| FILE-01 | File list updates after successful upload | unit | `npm test` | Wave 0 |
| FILE-02 | File list updates after successful delete | unit | `npm test` | Wave 0 |
| FILE-01+02 | E2E: upload → load_skill returns file in files[] → read_skill_file succeeds | manual | — | N/A — browser test |

### Sampling Rate

- **Per task commit:** `cd "C:/Vibe Apps/Agentic RAG/frontend" && npm test`
- **Per wave merge:** `cd "C:/Vibe Apps/Agentic RAG/frontend" && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `frontend/src/__tests__/lib/api.test.ts` — extend with `listSkillFiles`, `uploadSkillFile`, `deleteSkillFile` test suites (follow existing pattern in the file)
- [ ] `frontend/src/__tests__/components/SkillFormDialog.test.tsx` — covers file section render, ownership gate, upload/delete interactions (NEW file)

*(Existing test infrastructure covers everything else — no new framework config needed)*

---

## Sources

### Primary (HIGH confidence)

- `backend/app/api/skills.py` — verified: all three file endpoints implemented, exact routes and response shapes confirmed
- `backend/app/models/skill.py` — verified: `SkillFileResponse` model fields
- `frontend/src/lib/api.ts` — verified: `uploadDocument` and `importSkillZip` as multipart upload pattern reference; `getAuthToken` vs `getAuthHeaders` distinction confirmed
- `frontend/src/components/skills/SkillFormDialog.tsx` — verified: current dialog structure (no file section)
- `frontend/src/components/skills/SkillCard.tsx` — verified: ownership gate pattern (`skill.user_id === currentUserId`)
- `frontend/src/pages/SkillsPage.tsx` — verified: `fileInputRef.current.value = ""` reset pattern
- `frontend/src/types/index.ts` — verified: `Skill`, `SkillCreate`, `SkillUpdate` present; `SkillFile` absent

### Secondary (MEDIUM confidence)

- Phase 12 RESEARCH.md — established shadcn/ui Windows CLI pitfall (still applies if any new component is needed, though none are required for Phase 16)
- Phase 13 decisions log — confirmed `getAuthToken()` rule for multipart FormData uploads

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns verified from existing code
- Architecture: HIGH — all patterns derived directly from running Phase 10 backend code and Phase 12/13 frontend code
- Pitfalls: HIGH — multipart upload pitfall (Pitfall 1) is a documented project decision from Phase 13; all others derived from direct code inspection
- Validation: HIGH — Vitest already configured; existing api.test.ts pattern confirmed as the reference

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable React/Tailwind/FastAPI stack; no fast-moving dependencies)

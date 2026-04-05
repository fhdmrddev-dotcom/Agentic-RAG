# Coding Conventions
_Last updated: 2026-04-05_

## File and Directory Naming

**Frontend:**
- React component files: PascalCase (`FolderNode.tsx`, `MessageItem.tsx`, `IngestionPage.tsx`)
- Hook files: camelCase prefixed with `use` (`useFolders.ts`, `useMessages.ts`, `useDocuments.ts`)
- Utility/lib files: camelCase (`folderTree.ts`, `api.ts`, `supabase.ts`, `utils.ts`)
- Type definition file: singular `index.ts` under `frontend/src/types/`
- Test files: mirrored under `frontend/src/__tests__/` in subdirs matching source (`components/`, `hooks/`, `lib/`)
- Test file naming: `{ComponentName}.test.tsx` or `{hookName}.test.ts`

**Backend:**
- API route files: `snake_case.py` matching the resource (`threads.py`, `folders.py`, `documents.py`, `skills.py`, `kb.py`, `settings.py`)
- Service files: `{resource}_service.py` (`embedding_service.py`, `retrieval_service.py`, `openai_service.py`)
- Model files: `{resource}.py` (`thread.py`, `folder.py`, `document.py`, `skill.py`, `message.py`)
- Test files: `test_{resource}.py` for integration tests, `test_{service_name}.py` for unit tests

**Database migrations:**
- Sequential prefix with zero-padded numbers: `001_`, `002_`, `006_`, `014_`
- Hotfix/addendum migrations: append a letter suffix (`007b_fix_match_document_chunks_overload.sql`, `008b_dynamic_vector_match.sql`)
- Descriptive slug after number: `014_folders.sql`, `017_skills.sql`, `019_global_folder_subtree_visibility.sql`

## Frontend Patterns

### Component Structure

Components use **named exports** (never default exports), using function declarations:

```typescript
// frontend/src/components/ingestion/FolderNode.tsx
interface FolderNodeProps {
  node: FolderNodeType
  depth: number
  onSelect: (id: string) => void
  // ...
}

export function FolderNode({ node, depth, onSelect, ... }: FolderNodeProps) {
  // ...
}
```

Props interfaces are defined immediately above the component, named `{ComponentName}Props` or `Props` for single-component files.

Components are organized into feature subdirectories under `frontend/src/components/`:
- `chat/` — chat UI: `MessageItem.tsx`, `MessageList.tsx`, `ToolCallPanel.tsx`, `MarkdownRenderer.tsx`, `MessageInput.tsx`, `ChatArea.tsx`, `ExecuteCodeBlock.tsx`
- `ingestion/` — document/folder management: `FolderTree.tsx`, `FolderNode.tsx`, `DocumentList.tsx`, `DocumentUpload.tsx`, `DocumentStatusBadge.tsx`, `FolderBreadcrumb.tsx`, `FolderCreateInput.tsx`, `FolderDetail.tsx`
- `layout/` — app shell: `ChatLayout.tsx`, `Sidebar.tsx`
- `auth/` — authentication forms: `SignInForm.tsx`, `SignUpForm.tsx`
- `skills/` — skill management: `SkillCard.tsx`, `SkillFormDialog.tsx`
- `ui/` — shadcn/ui primitives (Radix wrappers): `button.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `tooltip.tsx`, etc.

### Hook Pattern

All hooks define a return-type interface above the function, then export a named function:

```typescript
// frontend/src/hooks/useFolders.ts
interface UseFolders {
  folders: Folder[]
  createFolder: (name: string, parentId: string | null, isGlobal?: boolean) => Promise<Folder>
  renameFolder: (id: string, name: string) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  toggleGlobal: (id: string) => Promise<void>
}

export function useFolders(): UseFolders { ... }
```

All mutation callbacks are wrapped in `useCallback` to stabilize references. Supabase Realtime channel subscriptions are tracked via `useRef` and cleaned up on unmount.

**Optimistic update + Realtime reconciliation pattern** (used in `useFolders`, `useDocuments`, `useThreads`):
1. Mutation fires against the backend API
2. Local state updated immediately (optimistic)
3. Supabase Realtime event reconciles authoritative DB state

Available hooks in `frontend/src/hooks/`:
- `useAuth.ts` — session management
- `useFolders.ts` — folder CRUD + Realtime
- `useDocuments.ts` — document list + upload + Realtime status
- `useMessages.ts` — message load + SSE streaming
- `useThreads.ts` — thread CRUD
- `useSkills.ts` — skill CRUD
- `useTheme.ts` — dark/light mode

### State Management

No global state library. State lives in:
- Custom hooks (listed above) — domain state
- Component-level `useState` — UI-only state (expand/collapse, edit mode, delete confirmation)
- `@tanstack/react-query` is installed but **not currently used** — hooks use raw `useState`/`useEffect` patterns

### TypeScript Usage

- Strict TypeScript throughout; all domain interfaces in `frontend/src/types/index.ts`
- Use `interface` (not `type`) for domain objects: `Thread`, `Message`, `Folder`, `Document`, `Skill`, `SkillFile`, `ToolCall`
- Status fields typed as string union literals: `status: "pending" | "processing" | "completed" | "failed"`
- Nullable foreign keys: `string | null` (never `undefined`)
- API functions return explicit typed promises: `Promise<Folder[]>`, `Promise<void>`
- Path alias `@/` resolves to `frontend/src/` in both vite and vitest configs

### Import Organization

```typescript
// 1. React core
import { useState, useEffect, useCallback, useRef } from "react"
// 2. External libraries
import { ChevronRight, Folder as FolderIcon } from "lucide-react"
// 3. Internal UI primitives
import { Button } from "@/components/ui/button"
// 4. Internal lib/utils
import { cn } from "@/lib/utils"
// 5. Internal components (relative or @/ alias)
import { FolderCreateInput } from "./FolderCreateInput"
// 6. Type-only imports last
import type { FolderNode as FolderNodeType } from "@/lib/folderTree"
```

### API Client (`frontend/src/lib/api.ts`)

All backend calls are routed through `frontend/src/lib/api.ts`. Pattern:
- Named async function exports, one per operation
- Every function calls `getAuthHeaders()` (for JSON requests) or `getAuthToken()` (for SSE/form requests) to get the Supabase JWT
- Throws `Error` with a description string if `res.ok` is false
- Returns a typed promise cast via `as Promise<T>`

```typescript
export async function listFolders(): Promise<Folder[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/folders`, { headers })
  if (!res.ok) throw new Error("Failed to list folders")
  return res.json() as Promise<Folder[]>
}
```

`API_BASE` is sourced from `import.meta.env.VITE_API_BASE_URL`.

## Backend Patterns

### Route Organization

Routes use FastAPI `APIRouter` with a resource-based prefix and a tag:

```python
# backend/app/api/folders.py
router = APIRouter(prefix="/folders", tags=["folders"])
```

All routers are registered in `backend/app/main.py` via `app.include_router(...)`. The API module layout mirrors the URL structure:

```
backend/app/api/
  threads.py    → /threads
  documents.py  → /documents
  folders.py    → /folders
  kb.py         → /kb
  skills.py     → /skills
  settings.py   → /settings
```

**HTTP method conventions:**
- `GET ""` — list collection
- `POST ""` — create resource, returns `status_code=201`
- `GET "/{id}"` — get single resource
- `PATCH "/{id}"` — partial update (named fields only)
- `PATCH "/{id}/{action}"` — specific action endpoint (`/toggle-global`, `/move`)
- `DELETE "/{id}"` — delete, returns `status_code=204`

### Dependency Injection

Two core FastAPI dependencies injected into every route:

```python
# backend/app/dependencies.py
async def get_current_user(...) -> dict:   # Returns {"id": str, "email": str}
def get_supabase() -> Client:              # Returns singleton Supabase service-role client
```

Route handlers declare both as `Depends(...)` parameters. User ownership is enforced at the query level (`.eq("user_id", current_user["id"])`), not as middleware.

### Pydantic Models

Each resource has up to three model classes in `backend/app/models/{resource}.py`:
- `{Resource}Create` — POST request body
- `{Resource}Update` — PATCH request body (fields are `T | None` for partial updates)
- `{Resource}Response` — response shape (always includes `id: UUID`, `user_id: UUID`, `created_at: datetime`, `updated_at: datetime`)

```python
# backend/app/models/folder.py
class FolderCreate(BaseModel):
    name: str
    parent_id: UUID | None = None
    is_global: bool = False

class FolderResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    parent_id: UUID | None
    is_global: bool
    created_at: datetime
    updated_at: datetime
```

UUIDs are typed as `UUID` (not `str`). Datetimes typed as `datetime`. Literal unions via `typing.Literal` for status fields.

### Service Layer

Services in `backend/app/services/` are **plain Python modules** (not classes) exporting synchronous functions. Supabase client is passed as an argument, not imported as a singleton:

```python
# backend/app/services/embedding_service.py
def chunk_text(text: str, chunk_size: int | None = None, overlap: int | None = None) -> list[str]: ...
def embed_chunks(chunks: list[str], model: str | None = None) -> list[list[float]]: ...
def extract_metadata(content: str, model: str | None = None) -> DocumentMetadata | None: ...
```

Exception: `sandbox_manager` in `backend/app/services/sandbox_service.py` is a module-level singleton class instance (because Docker sessions are stateful per-thread).

### Error Handling

- Use `HTTPException` with explicit `status_code` constants from `fastapi.status` and a `detail` string
- 404 for not-found resources
- 403 for ownership violations (`"Folder not found or you are not the owner"`)
- 409 for duplicate/conflict (duplicate folder name)
- 422 for unsupported file type or validation errors
- Bare `except Exception: pass` used only for non-critical cleanup (e.g., Supabase Storage deletion when DB row is already gone)
- Background task errors do not bubble up to the HTTP response

### Configuration

Settings loaded from `.env` via `pydantic_settings.BaseSettings` in `backend/app/config.py`. A singleton `settings` object is imported wherever needed:

```python
from app.config import settings
```

Runtime overrides from the settings UI are layered on top via `backend/settings_override.json`, loaded by `backend/app/models/user_settings.py`. The override file takes priority over `.env`.

## Database Conventions

### Table Naming
All tables in the `public` schema, snake_case, plural: `threads`, `documents`, `folders`, `messages`, `document_chunks`, `skills`, `skill_files`, `profiles`

### Column Conventions
- Primary key: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- Owner: `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- Timestamps: `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`
- Nullable FK to folder: `folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL`
- Self-referential tree FK: `parent_id uuid REFERENCES public.folders(id) ON DELETE CASCADE`

### Row-Level Security
Every table has RLS enabled via `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. Standard policy set per table:
- `SELECT`: `auth.uid() = user_id` (owned rows) — some tables add `OR is_global = true`
- `INSERT`: `WITH CHECK (auth.uid() = user_id)`
- `UPDATE`: `USING (auth.uid() = user_id)`
- `DELETE`: `USING (auth.uid() = user_id)`

Recursive subtree visibility (global folder inheritance) **cannot** be expressed as an RLS policy. This is enforced in the application layer in `backend/app/utils/folder_utils.py` using the service role key that bypasses RLS.

### Realtime
Tables with live sync are added to the `supabase_realtime` publication:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.folders;
```
Current published tables: `folders`, `documents`.

## Notable Domain Patterns

### Folder Tree Assembly
The API returns a flat `Folder[]` list. Client assembles it into a tree via `frontend/src/lib/folderTree.ts`:
```typescript
buildFolderTree(folders: Folder[]): FolderNode[]
// FolderNode extends Folder with: children: FolderNode[]
```

### SSE Streaming
Chat responses use Server-Sent Events. Backend yields newline-delimited JSON. Frontend reads via `ReadableStream` in `frontend/src/lib/api.ts` (`streamMessage`).

SSE event types: `content`, `tool_start`, `tool_end`, `title`, `skill_activated`, `sub_agent_start`, `sub_agent_done`, `code_output`, `output_file`, `done`, `error`.

### Skills
Skills have two boolean flags: `is_enabled` (soft disable) and `is_global` (share read-only with all users). Toggle endpoints follow the pattern `PATCH /skills/{id}/toggle-enabled` and `PATCH /skills/{id}/toggle-global`.

### Document Ingestion Flow
Upload → `POST /documents/upload` (multipart/form-data) → document row created with `status="pending"` → `BackgroundTask` extracts text, chunks, embeds, and updates status → `pending → processing → completed | failed`. Frontend subscribes to Realtime for live status badges.

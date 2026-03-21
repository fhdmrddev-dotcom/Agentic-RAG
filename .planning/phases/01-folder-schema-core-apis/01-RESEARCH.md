# Phase 1: Folder Schema & Core APIs - Research

**Researched:** 2026-03-21
**Domain:** PostgreSQL adjacency list schema, Supabase RLS with OR visibility, FastAPI CRUD
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOLDER-01 | User can create folders with unlimited nesting depth | Adjacency list with self-referential FK supports unlimited depth; parent_id nullable = root folder |
| FOLDER-02 | User can rename existing folders | PATCH /folders/{id} updates `name` only; parent_id/children unaffected by design |
| FOLDER-03 | User can delete folders (cascades to contents) | `ON DELETE CASCADE` on parent_id FK automatically removes all descendants depth-first |
| FOLDER-05 | System supports global folders (visible to all users) and per-user folders (private) | RLS SELECT policy: `auth.uid() = user_id OR is_global = true` — confirmed viable pattern |
</phase_requirements>

---

## Summary

Phase 1 establishes the `folders` table as an adjacency list — a self-referential Postgres table where `parent_id` points back to the same table. This is the simplest, most battle-tested pattern for nested hierarchies. It supports unlimited depth at zero schema complexity cost. Retrieval of full subtrees requires a recursive CTE (`WITH RECURSIVE`), but Phase 1 only needs CRUD on individual nodes; tree traversal is Phase 4's problem.

The `is_global` flag introduces a split visibility model: per-user rows are private via standard `auth.uid() = user_id` RLS, and global rows are readable by all authenticated users via an `OR is_global = true` condition on the SELECT policy. This is a standard Postgres RLS OR pattern — verified to work. The critical nuance is that INSERT/UPDATE/DELETE must still restrict to the owning user even for global folders (only the creator or an admin should be able to mutate them).

The FastAPI CRUD layer follows the existing codebase pattern exactly: `APIRouter` with `Depends(get_current_user)` and `Depends(get_supabase)`, Pydantic models for request/response, and `supabase.table().insert/select/update/delete().execute()` calls. The service role key used in `get_supabase()` bypasses RLS at the Python layer — RLS is enforced by Postgres only when using the authenticated user's JWT, which is NOT the current pattern. This is a critical finding: the existing API enforces ownership manually via `.eq("user_id", current_user["id"])` filters, not via Supabase RLS token. The new folders API must follow the same manual-filter pattern.

**Primary recommendation:** Implement adjacency list with `ON DELETE CASCADE` on `parent_id`, split RLS with `OR is_global` for SELECT, and follow the existing service-role + manual user_id filter pattern exactly. Deliver schema as migration `013_folders.sql`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| supabase-py | 2.10.0 (pinned in requirements.txt) | Python client for all DB operations | Already in use; no change needed |
| FastAPI | 0.115.6 | HTTP framework | Already in use |
| Pydantic | (bundled with FastAPI) | Request/response validation | Already in use; project rule |
| PostgreSQL (via Supabase) | 15+ | Adjacency list + recursive CTEs + RLS | Already in use; supports all needed features |

### No New Libraries Required
All Phase 1 work is schema SQL + Python CRUD following existing patterns. Zero new dependencies.

**Version verification:** `supabase==2.10.0` confirmed from `requirements.txt`. Currently installed: 2.27.2 (env has a newer version but project pins 2.10.0 — follow the pinned version).

---

## Architecture Patterns

### Migration File
**What:** SQL migration file delivered as `013_folders.sql` in `backend/supabase/migrations/`
**Why:** Last migration is `012_query_documents_fn.sql`. Next number is `013`. Existing pattern uses 3-digit prefix.

```sql
-- Migration 013: Phase 1 - Folder Schema

CREATE TABLE public.folders (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  parent_id     uuid        REFERENCES public.folders(id) ON DELETE CASCADE,
  is_global     boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for fast subtree queries (parent_id lookups)
CREATE INDEX folders_parent_id_idx ON public.folders(parent_id);
-- Index for per-user folder listing
CREATE INDEX folders_user_id_idx ON public.folders(user_id);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- SELECT: owner sees their own + all global folders
CREATE POLICY "Users can view their own and global folders"
  ON public.folders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_global = true);

-- INSERT: users can only insert their own folders
CREATE POLICY "Users can insert their own folders"
  ON public.folders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: users can only update their own folders
CREATE POLICY "Users can update their own folders"
  ON public.folders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- DELETE: users can only delete their own folders
CREATE POLICY "Users can delete their own folders"
  ON public.folders FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Auto-update updated_at on change
CREATE TRIGGER set_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
```

### Pattern 1: Adjacency List Self-Referential FK
**What:** `parent_id uuid REFERENCES public.folders(id) ON DELETE CASCADE` — the table references itself. NULL parent_id = root folder.
**When to use:** Always for this use case. Simple, well-supported, no extensions needed.
**Cascade behavior:** Deleting a folder row triggers ON DELETE CASCADE, which deletes its direct children, which triggers another cascade for their children, etc. Postgres handles this depth-first automatically. No application-level recursion needed for delete.

**Confirmed:** Official Supabase cascade-deletes documentation confirms the self-referential pattern:
```sql
CREATE TABLE node (
  id serial PRIMARY KEY,
  name text,
  parent_id integer REFERENCES node (id) ON DELETE CASCADE
);
```

### Pattern 2: RLS OR Condition for Global Visibility
**What:** SELECT policy uses `auth.uid() = user_id OR is_global = true`
**When to use:** Any table with mixed visibility (owner-private + publicly-readable rows).
**Source:** Verified against Supabase RLS documentation — OR conditions in USING clauses are the standard approach.

```sql
-- Source: Supabase RLS docs pattern
CREATE POLICY "Users can view their own and global folders"
  ON public.folders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_global = true);
```

### Pattern 3: Existing FastAPI CRUD Pattern (from codebase)
**What:** Service role client + manual user_id filter. NOT RLS-via-JWT.
**Critical insight:** `get_supabase()` uses `settings.supabase_service_role_key` — the service role bypasses RLS entirely. Ownership is enforced by adding `.eq("user_id", current_user["id"])` to every query.

```python
# Source: backend/app/api/documents.py and threads.py — exact pattern to replicate

router = APIRouter(prefix="/folders", tags=["folders"])

@router.post("", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    body: FolderCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    result = supabase.table("folders").insert({
        "user_id": current_user["id"],
        "name": body.name.strip(),
        "parent_id": str(body.parent_id) if body.parent_id else None,
        "is_global": body.is_global,
    }).execute()
    return result.data[0]

@router.patch("/{folder_id}", response_model=FolderResponse)
async def rename_folder(
    folder_id: str,
    body: FolderUpdate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    result = (
        supabase.table("folders")
        .update({"name": body.name.strip()})
        .eq("id", folder_id)
        .eq("user_id", current_user["id"])  # ownership enforced here
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Folder not found")
    return result.data[0]
```

### Pattern 4: Pydantic Model Convention (from codebase)
```python
# Source: backend/app/models/thread.py — match this pattern

from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

class FolderCreate(BaseModel):
    name: str
    parent_id: UUID | None = None
    is_global: bool = False

class FolderUpdate(BaseModel):
    name: str

class FolderResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    parent_id: UUID | None
    is_global: bool
    created_at: datetime
    updated_at: datetime
```

### Recommended File Structure (new files only)
```
backend/
├── supabase/migrations/
│   └── 013_folders.sql          # schema + RLS + indexes + trigger
├── app/
│   ├── api/
│   │   └── folders.py           # APIRouter CRUD endpoints
│   ├── models/
│   │   └── folder.py            # FolderCreate, FolderUpdate, FolderResponse
│   └── main.py                  # add: from app.api import folders; app.include_router(folders.router)
```

### Anti-Patterns to Avoid
- **Using JWT-based RLS for enforcement:** The codebase uses service role key. Don't switch auth patterns mid-project. Use `.eq("user_id", ...)` filters manually.
- **Storing full path strings:** Don't store `/parent/child/grandchild` strings. The adjacency list's `parent_id` FK is the single source of truth for hierarchy.
- **Skipping the `parent_id` index:** Without an index on `parent_id`, listing children of a folder is a full table scan. Always index it.
- **Allowing is_global on INSERT without restriction:** Any authenticated user could create a "global" folder. Decide in Phase 1 whether to restrict this (e.g., admin only) or allow it. Current project scope allows it (no admin concept yet).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cascade delete of folder tree | Recursive Python delete loop | `ON DELETE CASCADE` on FK | Postgres handles it atomically; Python loop is not atomic |
| updated_at maintenance | Manual timestamp updates in Python | `set_updated_at()` trigger (already exists in migration 001) | Trigger already defined in codebase; just CREATE TRIGGER pointing to it |
| UUID generation | Python uuid4() calls | `DEFAULT gen_random_uuid()` in schema | Consistent with all other tables; reduces app logic |

**Key insight:** Postgres's declarative CASCADE does in one DB round-trip what Python recursion would do in N round-trips, and it's atomic (transactional).

---

## Common Pitfalls

### Pitfall 1: Service Role Bypasses RLS — Manual Ownership Required
**What goes wrong:** Developer adds RLS policies and assumes they protect data. But `get_supabase()` uses the service role key, so ALL RLS policies are bypassed.
**Why it happens:** Service role key is a superuser equivalent in Supabase.
**How to avoid:** Every mutable query (UPDATE, DELETE) MUST include `.eq("user_id", current_user["id"])`. Read queries for the list endpoint should also filter by `user_id` (and optionally return `is_global=true` rows).
**Warning signs:** A user can modify or delete another user's folder without getting a 404.

### Pitfall 2: Cascade Delete Orphans Documents
**What goes wrong:** When a folder is deleted, documents with `folder_id` pointing to it need handling. But `folder_id` doesn't exist on `documents` yet (that's Phase 2). In Phase 1, cascades only affect child folder rows.
**Why it happens:** Phase 1 creates `folders` table but `documents.folder_id` FK is added in Phase 2.
**How to avoid:** Phase 1 cascade is safe — it only cascades within the `folders` table. Document cascade will be handled when Phase 2 adds the FK.

### Pitfall 3: Circular References via Parent Move (Phase 2 Preview)
**What goes wrong:** Moving folder A under its own descendant creates a cycle. Postgres `ON DELETE CASCADE` doesn't prevent cycles — it only cascades on delete.
**Why it happens:** The adjacency list model has no built-in cycle prevention.
**How to avoid:** Phase 1 doesn't need moves (that's Phase 2/FOLDER-04). But the schema should support detection. PostgreSQL 14+ has `WITH RECURSIVE ... CYCLE col SET is_cycle USING path` for detecting cycles in recursive queries. Phase 2's move endpoint must check that the new parent is not a descendant of the folder being moved.
**Warning signs:** Recursive CTE queries loop forever or hit the `max_recursion` limit.

### Pitfall 4: NULL vs Missing Parent for Root Folders
**What goes wrong:** Frontend sends `parent_id: null` but Python/Pydantic converts it unexpectedly, or the query filters on `parent_id = NULL` (always false in SQL — must use `IS NULL`).
**Why it happens:** SQL NULL semantics: `parent_id = NULL` is always false; must use `parent_id IS NULL`.
**How to avoid:** In list queries, to get root folders: `.is_("parent_id", "null")` in supabase-py (which generates `IS NULL` SQL). Don't use `.eq("parent_id", None)`.

### Pitfall 5: Migration Number Gap
**What goes wrong:** Using `013` but someone else already created `013` for a hotfix.
**Why it happens:** Non-sequential numbering (existing gap between 005 and 010).
**How to avoid:** The gap (005→010) was intentional. Follow strictly sequential from current max: `012` → next is `013`.

---

## Code Examples

### Self-Referential Table with Cascade (Verified Pattern)
```sql
-- Source: Supabase cascade-deletes documentation + existing migration pattern (001, 002)
CREATE TABLE public.folders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id  uuid REFERENCES public.folders(id) ON DELETE CASCADE,  -- self-ref
  name       text NOT NULL,
  is_global  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### RLS OR Policy Pattern (Verified)
```sql
-- Source: Supabase RLS docs — auth.uid() = user_id OR boolean_flag pattern
CREATE POLICY "select_own_and_global"
  ON public.folders FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_global = true);
```

### supabase-py IS NULL Filter (Critical for Root Folder Queries)
```python
# Source: supabase-py docs — IS NULL uses .is_() not .eq()
root_folders = (
    supabase.table("folders")
    .select("*")
    .is_("parent_id", "null")
    .eq("user_id", current_user["id"])
    .execute()
)
```

### List Children of a Folder
```python
# Direct children only (not full subtree — that's Phase 4)
children = (
    supabase.table("folders")
    .select("*")
    .eq("parent_id", folder_id)
    .eq("user_id", current_user["id"])
    .execute()
)
```

### Rename Pattern (from threads.py — exact match)
```python
# Source: backend/app/api/threads.py rename_thread()
result = (
    supabase.table("folders")
    .update({"name": body.name.strip()})
    .eq("id", folder_id)
    .eq("user_id", current_user["id"])
    .execute()
)
if not result.data:
    raise HTTPException(status_code=404, detail="Folder not found")
```

### Delete Pattern (from threads.py — exact match)
```python
# Source: backend/app/api/threads.py delete_thread()
# Cascade handled by DB — just delete the row
supabase.table("folders").delete().eq("id", folder_id).eq("user_id", current_user["id"]).execute()
# Note: no 404 check needed on delete (threads.py doesn't either)
```

### Registering the Router (from main.py)
```python
# Source: backend/app/main.py — add after existing routers
from app.api import threads, documents, settings as settings_api, folders  # noqa: E402

app.include_router(threads.router)
app.include_router(documents.router)
app.include_router(settings_api.router)
app.include_router(folders.router)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Storing full path strings (materialized path) | Adjacency list with parent_id FK | N/A | Simpler schema; updates only need to change parent_id not all descendants' paths |
| Manual cascade delete in app code | `ON DELETE CASCADE` FK | PostgreSQL has had this for decades | Atomic, zero app code needed |
| Checking cycles in app code | `WITH RECURSIVE ... CYCLE` clause | PostgreSQL 14+ | Native SQL cycle detection (relevant for Phase 2 move operation) |

**Note:** Closure table and nested sets are alternatives to adjacency list but are overkill for this use case. Adjacency list is the correct choice when full-subtree queries are infrequent (only needed in Phase 4 for `tree` tool, not in Phase 1).

---

## Open Questions

1. **Who can create global folders?**
   - What we know: `is_global` is a boolean any user can set on INSERT (no restriction in schema or app logic currently).
   - What's unclear: Should global folders be admin-only, or can any user mark a folder as global?
   - Recommendation: For Phase 1, allow any authenticated user to create global folders (simplest; no admin concept in project). Add a note in the plan. Revisit in PROJECT.md.

2. **Should the list endpoint return both owned and global folders together?**
   - What we know: With service role key, the API must manually build the OR query.
   - What's unclear: Should `GET /folders` return `user_id = me OR is_global = true` in one list, or separate endpoints?
   - Recommendation: Single endpoint returning both, with `is_global` field on each item so the frontend can visually distinguish them (UI-02 in Phase 3).

3. **Validation of parent_id ownership on create**
   - What we know: A user can pass any UUID as `parent_id`. Nothing prevents pointing to another user's folder.
   - What's unclear: Should we validate that the parent folder belongs to the current user before allowing create?
   - Recommendation: Yes — on create, if `parent_id` is provided, verify the parent folder is owned by the current user (or is global). Add a pre-insert check.

---

## Validation Architecture

No `config.json` found in `.planning/` — treating `nyquist_validation` as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.0.0 + pytest-asyncio 0.24.0 + httpx 0.27.0 (all in requirements.txt) |
| Config file | None detected — needs `pytest.ini` or `pyproject.toml` section |
| Quick run command | `pytest backend/tests/test_folders.py -x` |
| Full suite command | `pytest backend/tests/ -x` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| FOLDER-01 | Create root folder (parent_id=null) returns 201 with correct fields | integration (httpx against live API) | `pytest backend/tests/test_folders.py::test_create_root_folder -x` | Wave 0 |
| FOLDER-01 | Create nested folder (valid parent_id) returns 201 with parent_id set | integration | `pytest backend/tests/test_folders.py::test_create_nested_folder -x` | Wave 0 |
| FOLDER-02 | PATCH /folders/{id} updates name, does not change parent_id or children | integration | `pytest backend/tests/test_folders.py::test_rename_folder -x` | Wave 0 |
| FOLDER-03 | DELETE /folders/{id} cascades to nested subfolders | integration | `pytest backend/tests/test_folders.py::test_delete_cascades -x` | Wave 0 |
| FOLDER-05 | Global folder visible in other user's GET /folders response | integration | `pytest backend/tests/test_folders.py::test_global_folder_visibility -x` | Wave 0 |
| FOLDER-05 | Per-user folder NOT visible to other user | integration | `pytest backend/tests/test_folders.py::test_private_folder_isolation -x` | Wave 0 |

**Note on integration tests:** The existing codebase has `pytest` + `httpx` but no test files yet (no `backend/tests/` directory). All tests are Wave 0 gaps. Tests will need a running Supabase instance (local Docker) or test fixtures with a mock supabase client.

### Sampling Rate
- **Per task commit:** `pytest backend/tests/test_folders.py -x`
- **Per wave merge:** `pytest backend/tests/ -x`
- **Phase gate:** Full suite green before marking phase complete

### Wave 0 Gaps
- [ ] `backend/tests/__init__.py` — test package
- [ ] `backend/tests/test_folders.py` — all folder CRUD tests
- [ ] `backend/tests/conftest.py` — shared fixtures (auth headers, supabase test client)
- [ ] `pytest.ini` or `[tool.pytest.ini_options]` in `pyproject.toml` — configure asyncio mode

---

## Sources

### Primary (HIGH confidence)
- Supabase cascade-deletes documentation — self-referential `ON DELETE CASCADE` pattern confirmed
- `backend/supabase/migrations/001_initial_schema.sql` — RLS policy naming conventions, trigger pattern (`set_updated_at`)
- `backend/supabase/migrations/002_module2_byo_retrieval.sql` — documents/chunks table pattern, HNSW index
- `backend/app/api/documents.py` — upload, list, delete CRUD patterns
- `backend/app/api/threads.py` — rename (PATCH), delete patterns
- `backend/app/models/thread.py` + `document.py` — Pydantic model conventions
- `backend/app/dependencies.py` — service role key pattern (bypasses RLS)
- `backend/requirements.txt` — confirmed supabase==2.10.0

### Secondary (MEDIUM confidence)
- Supabase RLS docs — OR condition pattern (`auth.uid() = user_id OR is_global = true`) — confirmed as valid syntax
- PostgreSQL adjacency list cascade delete — confirmed from Supabase docs + PostgreSQL docs
- mamezou-tech.com (2025) — PostgreSQL 14+ CYCLE clause syntax for recursive CTE cycle detection

### Tertiary (LOW confidence)
- None — all critical findings verified against official sources or codebase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use; confirmed versions from requirements.txt
- Schema pattern: HIGH — adjacency list + ON DELETE CASCADE verified against official Postgres/Supabase docs
- RLS OR pattern: HIGH — confirmed from Supabase RLS documentation
- API patterns: HIGH — derived directly from existing codebase (documents.py, threads.py)
- Migration numbering: HIGH — confirmed from ls of migrations directory

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable domain — supabase-py, FastAPI, Postgres patterns don't change month-to-month)

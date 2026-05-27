# Phase 084: Workspace Filesystem Backend - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 7 (4 new, 2 modified, 1 migration)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/services/workspace_service.py` | service | CRUD + file-I/O | `backend/app/services/sandbox_service.py` | role-match |
| `backend/app/db/workspace.py` | model (DB layer) | CRUD | `backend/app/db/runs.py` | exact |
| `backend/app/api/workspace.py` | controller | request-response | `backend/app/api/sandbox_outputs.py` | exact |
| `backend/app/models/workspace.py` | model (Pydantic) | transform | `backend/app/models/document.py` | exact |
| `supabase/migrations/054_workspace_files.sql` | migration | CRUD | `supabase/migrations/029_storage_buckets.sql` | exact |
| `backend/app/services/tool_dispatcher.py` (modify) | service | event-driven | self (existing `_handle_*` handlers) | exact |
| `backend/app/services/openai_service.py` (modify) | config | transform | self (existing `*_TOOL` dicts) | exact |

## Pattern Assignments

### `backend/app/db/workspace.py` (model/DB layer, CRUD)

**Analog:** `backend/app/db/runs.py`

**Imports pattern** (lines 1-5):
```python
from datetime import datetime
from uuid import UUID

import asyncpg
```

**Core asyncpg write pattern** (lines 26-59, `insert_run`):
```python
async def insert_run(
    pool: asyncpg.Pool,
    *,
    run_id: UUID,
    thread_id: UUID,
    user_id: UUID,
    status: str,
    model: str,
    provider: str,
    spawned_by_worker: str | None = None,
) -> None:
    """Insert a new runs row at request entry."""
    await pool.execute(
        """
        INSERT INTO runs (run_id, thread_id, user_id, status, model, provider, spawned_by_worker)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        """,
        run_id,
        thread_id,
        user_id,
        status,
        model,
        provider,
        spawned_by_worker,
    )
```

**Core asyncpg read pattern** (lines 130-150, `insert_assistant_message` RETURNING clause):
```python
async def insert_assistant_message(
    pool: asyncpg.Pool,
    *,
    thread_id: UUID,
    user_id: UUID,
    content: str,
    tool_calls: list[dict] | None = None,
    source_refs: list[dict] | None = None,
    # ...
) -> UUID:
    """Insert an assistant message row. Returns the inserted message id (UUID)."""
    return await pool.fetchval(
        """
        INSERT INTO messages (
            thread_id, user_id, role, content,
            tool_calls, source_refs, ...
        )
        VALUES ($1, $2, 'assistant', $3, $4, $5, ...)
        RETURNING id
        """,
        thread_id, user_id, content, tool_calls, source_refs, ...
    )
```

**Key conventions:**
- All functions take `pool: asyncpg.Pool` as first arg
- All other args are keyword-only (`*` separator)
- UUID types used for IDs (not str)
- Positional `$N` placeholders -- never f-strings in SQL
- JSONB codec registered at pool init (D-073-06) -- pass plain Python dicts/lists, no manual json.dumps

---

### `backend/app/services/workspace_service.py` (service, CRUD + file-I/O)

**Analog:** `backend/app/services/sandbox_service.py` (for Storage upload pattern)

**Imports pattern** (lines 1-14 of sandbox_service.py):
```python
import hashlib
import logging
import os
import tempfile
from typing import TYPE_CHECKING

from starlette.concurrency import run_in_threadpool

if TYPE_CHECKING:
    from supabase import Client

logger = logging.getLogger(__name__)
```

**Storage upload pattern** (sandbox_service.py lines 253-256):
```python
supabase.storage.from_("sandbox-outputs").upload(
    storage_path, data,
    file_options={"content-type": content_type, "upsert": "true"},
)
```

**Content-type detection pattern** (sandbox_service.py lines 241-250):
```python
ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else ""
content_type_map = {
    "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
    "gif": "image/gif", "svg": "image/svg+xml", "pdf": "application/pdf",
    "csv": "text/csv", "txt": "text/plain", "json": "application/json",
    # ...
}
content_type = content_type_map.get(ext, "application/octet-stream")
```

**`run_in_threadpool` wrap for sync Storage calls** (per D-v2.5-01, sandbox_outputs.py lines 73-77):
```python
signed = await run_in_threadpool(
    supabase.storage.from_("sandbox-outputs").create_signed_url,
    storage_path,
    60,
)
```

**Key conventions:**
- Storage uploads are sync calls -- wrap with `run_in_threadpool` when called from async context
- Storage path format: `{user_id}/{scope_id}/{filename}` (sandbox uses `{user_id}/{execution_id}/{fname}`)
- For workspace: `{user_id}/{thread_id}/{file_id}/v{version}`
- Service layer owns business logic (validation, size checks, hybrid routing); DB layer is pure SQL helpers

---

### `backend/app/api/workspace.py` (controller, request-response)

**Analog:** `backend/app/api/sandbox_outputs.py`

**Full file structure** (sandbox_outputs.py lines 24-97):
```python
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.utils.db import aexec

router = APIRouter(prefix="/sandbox-outputs", tags=["sandbox-outputs"])


@router.get("/{storage_path:path}")
async def get_sandbox_output(
    storage_path: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Step 1: ownership fence
    parts = storage_path.split("/", 2)
    if len(parts) < 3 or parts[0] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )

    # Step 2: DB row verification
    file_resp = await aexec(
        supabase.table("sandbox_files")
        .select("id")
        .eq("storage_path", storage_path)
        .eq("user_id", current_user["id"])
        .maybe_single()
    )
    row = file_resp.data if file_resp is not None else None
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )

    # Step 3: signed URL generation
    signed = await run_in_threadpool(
        supabase.storage.from_("sandbox-outputs").create_signed_url,
        storage_path,
        60,
    )
    # ... extract URL from response ...
    return RedirectResponse(url=url, status_code=302)
```

**Key conventions:**
- Router prefix is the resource name; tags match
- Dependencies via `Depends(get_current_user)`, `Depends(get_supabase)`
- Cold-path reads use `aexec` (supabase-py wrapped in threadpool)
- 404 not 403 for access-denied (D-062-12 -- existence-leak prevention)
- Router registered in `backend/app/main.py` via `app.include_router(workspace.router)` (line ~315)

---

### `backend/app/models/workspace.py` (Pydantic models, transform)

**Analog:** `backend/app/models/document.py`

**Full file structure** (document.py):
```python
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class DocumentMetadata(BaseModel):
    title: str | None = None
    author: str | None = None
    # ...


class DocumentResponse(BaseModel):
    id: UUID
    user_id: UUID
    folder_id: UUID | None = None
    filename: str
    file_path: str
    file_size: int
    mime_type: str
    status: Literal["pending", "processing", "completed", "failed"]
    error_message: str | None
    chunk_count: int | None
    content_hash: str | None
    version_number: int = 1
    is_latest: bool = True
    metadata: DocumentMetadata | None = None
    created_at: datetime
    updated_at: datetime
```

**Secondary analog:** `backend/app/models/run.py` (minimal response model):
```python
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ActiveRunResponse(BaseModel):
    run_id: UUID
    started_at: datetime
    status: str
```

**Key conventions:**
- One file per resource domain
- `BaseModel` subclass with type annotations
- UUID for IDs, datetime for timestamps
- Optional fields use `| None = None`
- Naming: `*Response` for API response shapes, `*Create` for input shapes

---

### `supabase/migrations/054_workspace_files.sql` (migration, CRUD)

**Analog:** `supabase/migrations/029_storage_buckets.sql`

**Bucket creation + RLS pattern** (029_storage_buckets.sql lines 18-82):
```sql
-- Bucket creation
INSERT INTO storage.buckets (id, name, public)
VALUES ('sandbox-outputs', 'sandbox-outputs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: path prefix is {user_id}/...
DROP POLICY IF EXISTS "Users can read own sandbox outputs" ON storage.objects;
CREATE POLICY "Users can read own sandbox outputs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'sandbox-outputs'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users can upload to own sandbox outputs folder" ON storage.objects;
CREATE POLICY "Users can upload to own sandbox outputs folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'sandbox-outputs'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users can delete own sandbox outputs" ON storage.objects;
CREATE POLICY "Users can delete own sandbox outputs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'sandbox-outputs'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );
```

**Key conventions:**
- `ON CONFLICT (id) DO NOTHING` for idempotent bucket creation
- `DROP POLICY IF EXISTS` before `CREATE POLICY` for idempotent RLS policies
- Storage RLS uses `(storage.foldername(name))[1] = (select auth.uid()::text)` for user-scoping
- Bucket is `public = false` (private)
- Three separate policies for SELECT, INSERT, DELETE

**New pattern for this phase (FK-chain RLS on workspace_files):**
```sql
-- NOT in any existing migration -- new pattern per D-11
ALTER TABLE workspace_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_files_select_own" ON workspace_files
    FOR SELECT TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));
```

---

### `backend/app/services/tool_dispatcher.py` (modify -- add 5 handlers)

**Analog:** Self -- existing handler pattern

**Simple handler pattern** (lines 86-89, `_handle_ls`):
```python
async def _handle_ls(args: dict, ctx: ToolContext) -> ToolResult:
    path = args.get("path") or (ctx.scoped_folder_path if ctx.scoped_folder_path else "/")
    result = await ls_path(path, ctx.current_user["id"], ctx.supabase)
    return ToolResult(result=json.dumps(result))
```

**Handler with SSE emission** (lines 274-277, `_handle_load_skill`):
```python
async def _handle_load_skill(args: dict, ctx: ToolContext) -> ToolResult:
    skill_name = args.get("skill_name", "")
    await ctx.emit(ctx.redis, ctx.run_id, 'skill_activated', skill_name=skill_name)
    # ... business logic ...
    return ToolResult(result=json.dumps({...}))
```

**Handler with error return** (lines 324-329, `_handle_save_skill`):
```python
async def _handle_save_skill(args: dict, ctx: ToolContext) -> ToolResult:
    name = args.get("name", "").strip()
    if not name:
        return ToolResult(result=json.dumps({"error": "Skill name is required."}))
    # ...
```

**Registry registration** (lines 823-840):
```python
_TOOL_REGISTRY: dict[str, Callable] = {
    "ls": _handle_ls,
    "tree": _handle_tree,
    # ... existing handlers ...
    "query_tables": _handle_query_tables,
}
```

**ToolContext dataclass** (lines 52-68):
```python
@dataclass
class ToolContext:
    redis: Any
    run_id: UUID
    thread_id: str
    supabase: Any
    pool: Any          # asyncpg pool
    user_settings: Any
    current_user: dict  # {"id": str, ...}
    folder_subtree_ids: set[str] | None
    scoped_folder_path: str | None
    emit: Callable[..., Awaitable[None]]
    spawn: Callable
    # ...
```

**ToolResult dataclass** (lines 72-80):
```python
@dataclass
class ToolResult:
    result: str
    llm_content: str | None = None
    source_refs: list[dict] = field(default_factory=list)
    citations: list[dict] = field(default_factory=list)
    similarity_score: float | None = None
    sub_agent_record: dict | None = None
```

**Key conventions:**
- Handler signature: `async def _handle_<name>(args: dict, ctx: ToolContext) -> ToolResult`
- Access args via `args.get("key", default)` or `args["key"]`
- Access user ID via `ctx.current_user["id"]`
- Access asyncpg pool via `ctx.pool`
- Emit SSE via `await ctx.emit(ctx.redis, ctx.run_id, 'event_type', **fields)`
- Return errors as `ToolResult(result=json.dumps({"error": "message"}))`
- Return success as `ToolResult(result=json.dumps({...data...}))`
- Register in `_TOOL_REGISTRY` dict at module bottom

---

### `backend/app/services/openai_service.py` (modify -- add 5 tool schemas)

**Analog:** Self -- existing tool schema definitions

**Tool schema structure** (lines 345-371, REMEMBER_TOOL -- simple 2-param tool):
```python
REMEMBER_TOOL = {
    "type": "function",
    "function": {
        "name": "remember",
        "description": (
            "Store a fact or preference about the user that should persist across conversations. "
            "Use when the user states a preference..."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "key": {
                    "type": "string",
                    "description": "Short snake_case label...",
                },
                "value": {
                    "type": "string",
                    "description": "The fact or preference to store...",
                },
            },
            "required": ["key", "value"],
        },
    },
}
```

**Tool with optional params** (lines 373-394, RECALL_TOOL -- `required: []`):
```python
RECALL_TOOL = {
    "type": "function",
    "function": {
        "name": "recall",
        "description": (
            "Retrieve stored memory entries about the user. ..."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "key": {
                    "type": "string",
                    "description": "The key to look up. Omit to retrieve all stored entries.",
                },
            },
            "required": [],
        },
    },
}
```

**get_tools() registration** (lines 514-526):
```python
def get_tools(user_settings: "UserEffectiveSettings | None" = None) -> list[dict]:
    effective = user_settings if user_settings is not None else None
    tools = [SEARCH_DOCUMENTS_TOOL, QUERY_DOCUMENTS_TOOL, LS_TOOL, TREE_TOOL,
             GREP_TOOL, GLOB_TOOL, READ_DOCUMENT_TOOL, ANALYZE_DOCUMENT_TOOL,
             LOAD_SKILL_TOOL, SAVE_SKILL_TOOL, READ_SKILL_FILE_TOOL,
             REMEMBER_TOOL, RECALL_TOOL, QUERY_TABLES_TOOL]
    # ... conditional appends ...
    return tools
```

**Key conventions:**
- Tool dicts are module-level constants named `UPPER_SNAKE_CASE_TOOL`
- Description is a parenthesized multiline string
- `parameters.required` is an explicit array (even empty `[]` for all-optional)
- New workspace tools added to the base `tools` list in `get_tools()` (always available, not gated by a feature flag)

---

## Shared Patterns

### SSE Event Emission
**Source:** `backend/app/api/threads.py` lines 109-123
**Apply to:** All workspace tool handlers that emit events (workspace_write, workspace_delete)
```python
async def _emit(redis, run_id: _uuid_mod.UUID, type: str, **fields) -> None:
    """One canonical XADD shape for all producer-side events (D-061-10)."""
    await redis.xadd(
        f"run:{run_id}",
        {"data": json.dumps({"type": type, **fields})},
        maxlen=10000,
        approximate=True,
    )
```
Called via `ctx.emit(ctx.redis, ctx.run_id, 'workspace_file_written', path=..., version=..., size_bytes=..., mime_type=...)`.

### Authentication / Authorization (REST endpoints)
**Source:** `backend/app/dependencies.py` lines 103-109
**Apply to:** All workspace REST API endpoints
```python
from app.dependencies import get_current_user, get_supabase

@router.get("/files")
async def list_workspace_files(
    thread_id: str,
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase),
):
    # RLS enforced at DB level via supabase-py (service role not used for reads)
    ...
```

### Async DB Wrapper (Cold Path)
**Source:** `backend/app/utils/db.py` lines 32-44
**Apply to:** All REST endpoint queries (workspace list, versions, diff retrieval)
```python
from app.utils.db import aexec

resp = await aexec(
    supabase.table("workspace_files")
    .select("id, path, size_bytes, mime_type, created_at, updated_at")
    .eq("thread_id", thread_id)
    .order("path")
)
rows = resp.data or []
```

### asyncpg Pool Access (Hot Path)
**Source:** `backend/app/dependencies.py` lines 74-100
**Apply to:** All workspace tool handlers in tool_dispatcher.py (write, read, list, delete, diff)
```python
# Pool is available on ToolContext as ctx.pool
# No need to call get_pg_pool() -- threads.py agent_runner passes it at ToolContext construction
file_row = await ctx.pool.fetchrow("INSERT INTO ... RETURNING id, ...", ...)
```

### Router Registration
**Source:** `backend/app/main.py` line ~315
**Apply to:** `backend/app/api/workspace.py`
```python
# In main.py, add:
from app.api import workspace
app.include_router(workspace.router)
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | -- | -- | All files have strong analogs in the existing codebase |

**Note on FK-chain RLS:** While the RLS pattern in the migration (`auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id)`) is new to this codebase (all existing tables use direct `user_id` columns), the bucket RLS pattern and table structure follow proven patterns from migration 029. The FK-chain subquery itself is a standard Postgres pattern, just not previously used in this project.

## Metadata

**Analog search scope:** `backend/app/` (services, db, api, models, utils, dependencies), `supabase/migrations/`
**Files scanned:** 18 (7 analogs read, 11 searched)
**Pattern extraction date:** 2026-05-28

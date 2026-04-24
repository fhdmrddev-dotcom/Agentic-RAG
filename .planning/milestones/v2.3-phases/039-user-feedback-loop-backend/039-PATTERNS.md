# Phase 39: User Feedback Loop — Backend - Pattern Map

**Mapped:** 2026-04-18
**Files analyzed:** 4 (1 new migration, 1 new router, 1 main.py modification, 1 service modification)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/028_message_feedback.sql` | migration | CRUD | `supabase/migrations/026_user_memory.sql` | exact |
| `backend/app/api/feedback.py` | router | request-response + CRUD | `backend/app/api/knowledge_health.py` | exact |
| `backend/app/main.py` | config | — | `backend/app/main.py` (self) | self-modification |
| `backend/app/services/audit_service.py` | service | fire-and-forget | `backend/app/services/audit_service.py` (self) | self-modification |

---

## Pattern Assignments

### `supabase/migrations/028_message_feedback.sql` (migration, CRUD)

**Analog:** `supabase/migrations/026_user_memory.sql`

**Table creation pattern** (026 lines 5–13):
```sql
CREATE TABLE IF NOT EXISTS public.user_memory (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key         text NOT NULL,
  value       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_memory_user_key_unique UNIQUE (user_id, key)
);
```

**Index pattern** (026 lines 16–17):
```sql
CREATE INDEX IF NOT EXISTS user_memory_user_updated_idx
  ON public.user_memory (user_id, updated_at DESC);
```

**RLS enable + policies pattern** (026 lines 20–36):
```sql
ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own memory"
  ON public.user_memory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memory"
  ON public.user_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

**For `message_feedback` specifically:**
- Phase 39 needs INSERT + SELECT policies only (no UPDATE/DELETE — D-01 immutability).
- UNIQUE constraint: `UNIQUE (message_id, user_id)` mirrors the `UNIQUE (user_id, key)` pattern.
- Index per D-15: `(user_id, created_at)` for stats queries — same form as `(user_id, updated_at DESC)` in 026.
- Columns: `id uuid PK`, `user_id uuid FK → auth.users`, `message_id uuid FK → messages`, `rating varchar CHECK IN ('positive','negative')`, `reason varchar CHECK IN ('wrong_answer','not_from_documents','incomplete','other') NULLABLE`, `created_at timestamptz DEFAULT now()`.
- Use `VARCHAR CHECK` constraint (not Postgres ENUM type) — this is Claude's discretion; CHECK constraints are simpler to migrate and consistent with how `rating` values appear as plain strings throughout the codebase.

---

### `backend/app/api/feedback.py` (router, request-response + CRUD)

**Primary analog:** `backend/app/api/knowledge_health.py`
**Secondary analog for time-window helper:** `backend/app/api/audit.py`

**Imports pattern** (knowledge_health.py lines 1–10):
```python
"""Knowledge Health Dashboard — Backend (Phase 37, HLTH-01–HLTH-04)."""
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from app.dependencies import get_current_user, get_supabase

router = APIRouter(prefix="/knowledge-health", tags=["knowledge-health"])
```

For `feedback.py`, adapt as:
```python
"""User feedback endpoints — Phase 39 (FB-01–FB-03)."""
import asyncio
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.services.audit_service import write_audit_entry

router = APIRouter(prefix="/feedback", tags=["feedback"])
```

**Window cutoff helper pattern** (knowledge_health.py lines 21–23):
```python
def _window_cutoff(days: int) -> str:
    """Return ISO 8601 UTC string for (now - days)."""
    return (_now_utc() - timedelta(days=days)).isoformat()
```

**Supabase query pattern — insert with conflict detection** (knowledge_health.py query style + audit.py filter style):
```python
# RLS filter — never trust client-supplied user_id (from audit.py lines 31–32)
query = query.eq("user_id", user_id)

# Insert pattern (from audit_service.py lines 30–33)
supabase.table("audit_log").insert({
    "user_id": user_id,
    "action_type": action_type,
    "metadata": metadata,
}).execute()
```

**Document attribution via source_refs unnesting** (knowledge_health.py lines 143–159):
```python
for row in res.data:
    source_refs = row.get("source_refs") or []
    for entry in source_refs:
        if not isinstance(entry, dict):
            continue
        doc_id = entry.get("document_id")
        if not doc_id:
            continue
        # accumulate counts per doc_id
```
Use this same pattern to iterate source_refs JSONB in Python for the downvoted-documents aggregation (D-10). Fetch `message_feedback` joined to `messages.source_refs`, then unnest in Python (same approach knowledge_health uses — no Postgres RPC needed).

**Document lookup with is_latest filter** (knowledge_health.py lines 57–63):
```python
meta_res = (
    supabase.table("documents")
    .select("id, filename, folder_id, created_at, file_size")
    .in_("id", sorted_ids)
    .eq("user_id", user_id)
    .eq("is_latest", True)
    .execute()
)
```

**Error handling pattern** (knowledge_health.py lines 276–280):
```python
except Exception as exc:
    raise HTTPException(
        status_code=502,
        detail="Health metrics temporarily unavailable",
    ) from exc
```
Use `502` for stats aggregation failures (same as knowledge_health). Use `409` for duplicate submission (detected by catching the Supabase unique constraint violation).

**Audit fire-and-forget pattern** (from audit_service.py docstring + usage across codebase):
```python
# D-07: fire-and-forget, never await
asyncio.create_task(write_audit_entry(
    user_id=user_id,
    action_type="feedback.submit",
    metadata={"message_id": str(message_id), "rating": rating, "reason": reason},
    supabase=supabase,
))
```

**Endpoint shape — POST** (modelled on knowledge_health's endpoint signature pattern):
```python
@router.post("", status_code=201)
async def submit_feedback(
    body: FeedbackRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
```

**Endpoint shape — GET stats** (modelled on knowledge_health.py lines 247–280):
```python
@router.get("/stats")
async def get_feedback_stats(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
```

**409 Conflict error shape** — check existing routers for the established error detail format:
```python
# Consistent with other HTTPException raises in the codebase
raise HTTPException(status_code=409, detail="Feedback already submitted for this message")
```

---

### `backend/app/main.py` (config, router registration)

**Self-modification — existing import + include_router lines** (main.py lines 52–61):
```python
from app.api import threads, documents, settings as settings_api, folders, kb, skills, audit, knowledge_health  # noqa: E402

app.include_router(threads.router)
app.include_router(documents.router)
app.include_router(settings_api.router)
app.include_router(folders.router)
app.include_router(kb.router)
app.include_router(skills.router)
app.include_router(audit.router)
app.include_router(knowledge_health.router)
```

**Change required:** Append `feedback` to the import and add `app.include_router(feedback_router)`:
```python
from app.api import threads, documents, settings as settings_api, folders, kb, skills, audit, knowledge_health, feedback  # noqa: E402
# ... existing includes ...
app.include_router(feedback.router)
```

---

### `backend/app/services/audit_service.py` (service, one-line addition)

**Self-modification — VALID_ACTION_TYPES** (audit_service.py lines 11–16):
```python
VALID_ACTION_TYPES = frozenset({
    "document.upload", "document.delete", "search.query",
    "code.execute", "skill.load", "thread.create",
    "thread.delete", "settings.update",
    "memory.remember", "memory.recall",   # Phase 33
})
```

**Change required:** Add `"feedback.submit"` following the dotted-namespace convention (D-05):
```python
VALID_ACTION_TYPES = frozenset({
    "document.upload", "document.delete", "search.query",
    "code.execute", "skill.load", "thread.create",
    "thread.delete", "settings.update",
    "memory.remember", "memory.recall",   # Phase 33
    "feedback.submit",                    # Phase 39
})
```

---

## Shared Patterns

### Authentication / User Identity
**Source:** `backend/app/dependencies.py` lines 19–30
**Apply to:** `feedback.py` both endpoints
```python
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    supabase: Client = Depends(get_supabase),
) -> dict:
    token = credentials.credentials
    try:
        response = supabase.auth.get_user(token)
        if response.user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return {"id": response.user.id, "email": response.user.email}
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
```
The `user_id = current_user["id"]` extraction is universal across all protected endpoints.

### RLS Enforcement
**Source:** `backend/app/api/audit.py` lines 31–32
**Apply to:** All Supabase queries in `feedback.py`
```python
query = query.eq("user_id", user_id)
```
Never accept `user_id` from request body — always derive from `current_user["id"]`.

### Audit Write (Fire-and-Forget)
**Source:** `backend/app/services/audit_service.py` lines 19–36 + docstring
**Apply to:** `POST /feedback` success path
```python
asyncio.create_task(write_audit_entry(
    user_id=user_id,
    action_type="feedback.submit",
    metadata={...},
    supabase=supabase,
))
```
Never `await` the task. Import `asyncio` at the top of the file.

### 30-Day Window Cutoff
**Source:** `backend/app/api/knowledge_health.py` lines 21–23
**Apply to:** `GET /feedback/stats` most-downvoted-documents query
```python
def _window_cutoff(days: int) -> str:
    return (_now_utc() - timedelta(days=days)).isoformat()
```
Use `_window_cutoff(30)` consistent with `WINDOW_DAYS = 30` in knowledge_health (D-04).

### source_refs JSONB Iteration
**Source:** `backend/app/api/knowledge_health.py` lines 143–159
**Apply to:** Most-downvoted documents aggregation in `GET /feedback/stats`
Pattern: fetch messages rows with `source_refs`, iterate list of dicts in Python, extract `document_id`, accumulate counts per doc — no Postgres RPC needed (consistent with existing Python-side aggregation approach).

---

## No Analog Found

None — all four files have direct codebase analogs.

---

## Metadata

**Analog search scope:** `backend/app/api/`, `backend/app/services/`, `backend/app/`, `supabase/migrations/`
**Files scanned:** 7 (026_user_memory.sql, audit.py, knowledge_health.py, audit_service.py, dependencies.py, main.py, threads.py source_refs section)
**Pattern extraction date:** 2026-04-18

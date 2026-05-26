# Phase 078: Backpressure JSON Primitive + Code-Quality Bundle - Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 9 (5 modified source + 1 new router + 1 new migration + 3 new test files)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/main.py` | config/lifecycle | request-response | `backend/app/main.py` (self) | exact |
| `backend/app/api/threads.py` | controller | event-driven | `backend/app/api/threads.py` (self — title-gen + RUN_TASKS export) | exact |
| `backend/app/api/documents.py` | controller | CRUD | `backend/app/api/documents.py` (self — dedup block lines 402-423) | exact |
| `backend/app/services/context_window.py` | service | transform | `backend/app/services/context_window.py` (self — trim loop lines 151-226) | exact |
| `backend/app/config.py` | config | — | `backend/app/config.py` (self — Settings class lines 478-707) | exact |
| `backend/app/api/admin.py` *(new)* | controller | request-response | `backend/app/api/knowledge_health.py` | role-match |
| `supabase/migrations/043_documents_dedup_unique_index.sql` | migration | — | `supabase/migrations/042_document_tables_bbox_extractor.sql` | role-match (already created — confirm DDL is correct) |
| `backend/tests/unit/test_lifespan.py` | test | — | `backend/tests/unit/test_lifespan.py` (self — Phase 073 base, Phase 078 extends) | exact |
| `backend/tests/unit/test_context_window.py` | test | — | `backend/tests/unit/test_context_window.py` (self — 8 existing tests, add protected-overrun cases) | exact |
| `backend/tests/unit/test_backpressure.py` *(new)* | test | — | `backend/tests/unit/test_health.py` | role-match |
| `backend/tests/integration/test_documents.py` | test | — | `backend/tests/integration/test_documents.py` (self — dedup 409 cases) | exact |

---

## Pattern Assignments

### `backend/app/main.py` — Supabase aclose (CQ-SUPA-01, D-078-09)

**Analog:** `backend/app/main.py` (self) — lifespan shutdown block lines 85-125

**Lifespan shutdown ordering pattern** (lines 85-125):
```python
# Startup-reverse teardown order already in place:
# 1. RUN_TASKS cancel (lines 88-97)
# 2. Redis aclose (lines 99-105)
# 3. asyncpg pool close (lines 107-120)
# 4. sandbox close_all (lines 122-125)
#
# Phase 078 inserts step 3.5 — _supabase aclose — AFTER asyncpg, BEFORE sandbox:

    # Phase 078 (CQ-SUPA-01, D-078-09): close the Supabase singleton client.
    # Runs AFTER asyncpg pool close (step 3), BEFORE sandbox close (step 4).
    try:
        from app.dependencies import _supabase
        if _supabase is not None:
            await _supabase.aclose()
    except Exception:
        logger.exception("Supabase aclose failed at shutdown")
```

**Key pattern notes:**
- Import `_supabase` from `app.dependencies` with a late-bind import (same as `_pg_pool` at line 112) to avoid circular imports at module load
- Guard with `if _supabase is not None` (mirrors the `_pg_pool` guard at line 113)
- Wrap in `try / except Exception: logger.exception(...)` (mirrors Redis aclose at lines 102-105)
- Do NOT use `asyncio.wait_for` — `aclose()` is expected to be fast (just closes HTTP session)
- The `ENVIRONMENT` env var already parsed at lines 186-216 via `os.getenv("ENVIRONMENT", "")` — reuse same pattern for backpressure fail-closed logic

**Existing import pattern** (lines 1-15, relevant imports):
```python
import asyncio
import logging
import os
from contextlib import asynccontextmanager
import anyio
from app.config import settings
```

---

### `backend/app/api/threads.py` — Title-gen warning (CQ-TITLE-01, D-078-10)

**Analog:** `backend/app/api/threads.py` (self) — `generate_thread_title` lines 969-1037

**The silent except to fix** (line 1036):
```python
    except Exception:
        return first_user_message[:40].strip() or "New Chat", None
```

**Target pattern after fix — copy from caller warning at lines 1355-1359:**
```python
    except Exception as e:
        logger.warning(
            "title_generation_failed: %s", e,
            exc_info=True,
        )
        return first_user_message[:40].strip() or "New Chat", None
```

**Caller site already logs at lines 1360-1368** (do not remove, both sites log):
```python
    except Exception as e:
        logger.warning(
            "D-067.2-05 title generation skipped due to setup error: %s", e,
            exc_info=True,
        )
```

**RUN_TASKS definition** (line 92 — read by new admin endpoint):
```python
RUN_TASKS: dict[_uuid_mod.UUID, asyncio.Task] = {}
```
The backpressure endpoint reads `len(RUN_TASKS)` — import via `from app.api.threads import RUN_TASKS` inside the endpoint (late-bind, same as lifespan at line 89).

---

### `backend/app/api/documents.py` — Concurrent upload dedup CAS (CQ-DEDUP-01, D-078-03/04/05)

**Analog:** `backend/app/api/documents.py` (self) — dedup SELECT block lines 402-423 and INSERT block lines 472-476

**Existing fast-path dedup** (lines 402-423 — keep as-is, this is the common-case guard):
```python
    content_hash = hashlib.sha256(raw).hexdigest()

    dedup_query = (
        supabase.table("documents")
        .select("*")
        .eq("user_id", current_user["id"])
        .eq("content_hash", content_hash)
        .eq("status", "completed")
        .eq("is_latest", True)
    )
    if folder_id:
        dedup_query = dedup_query.eq("folder_id", folder_id)
    else:
        dedup_query = dedup_query.is_("folder_id", "null")
    existing = await run_in_threadpool(lambda: dedup_query.limit(1).execute())
    if existing.data:
        response.status_code = status.HTTP_200_OK
        return existing.data[0]
```

**New CAS pattern to add AFTER the INSERT** (lines 473-476):
```python
    # Phase 078 CQ-DEDUP-01 D-078-04: catch unique-violation race at INSERT time.
    # The fast-path SELECT above handles the common case; this catches the narrow
    # race window where two concurrent uploads pass the SELECT simultaneously.
    try:
        result = await run_in_threadpool(
            lambda: supabase.table("documents").insert(doc_data).execute()
        )
        doc = result.data[0]
    except Exception as exc:
        # Detect PostgreSQL unique_violation (code 23505) from the partial index.
        # supabase-py surfaces this as an APIError whose message contains "23505".
        exc_str = str(exc)
        if "23505" in exc_str or "unique" in exc_str.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="File already exists in this folder",
            )
        raise
```

**Error import pattern** (already present at top of documents.py):
```python
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
```

---

### `backend/app/services/context_window.py` — Protected-only overrun fix (CQ-CTX-01, D-078-01/02)

**Analog:** `backend/app/services/context_window.py` (self) — `trim_messages_to_fit` lines 151-226

**Current logic gap** (lines 215-226): after the `while trimmable:` loop exhausts all trimmable messages, the function does NOT progressively trim the `protected` tail. This is the bug.

**Current final-build block** (lines 215-226):
```python
    # Final build — add marker if any trimming occurred.
    protected_only_tokens = (
        estimate_messages_tokens(_build_candidate(system_msg, [], protected, False))
        if not trimmed_any and trimmable == []
        else 0
    )
    if trimmed_any or (trimmable == [] and protected_only_tokens > max_tokens):
        trimmed_any = True

    return _build_candidate(system_msg, trimmable, protected, trimmed_any)
```

**Target pattern after fix (D-078-01 progressive trim):**
```python
    # Phase 078 CQ-CTX-01 D-078-01: after trimmable is exhausted, progressively
    # trim oldest protected messages inward. Hard floor: system_msg + last user msg.
    # Mirrors Claude.ai / ChatGPT behavior (silently drops older turns, never errors).
    if not trimmable:
        while len(protected) > 1:
            candidate = _build_candidate(system_msg, [], protected, True)
            if estimate_messages_tokens(candidate) <= max_tokens:
                break
            n_removed = _remove_oldest_atomic(protected)
            if n_removed == 0:
                break
            trimmed_any = True

    return _build_candidate(system_msg, trimmable, protected, trimmed_any)
```

**Key pattern notes:**
- `_remove_oldest_atomic` already handles the `protected` list (same list type as `trimmable`) — no new helper needed
- Hard floor `len(protected) > 1` prevents stripping everything; the last message in the protected tail stays
- D-078-02: no error raised — always return a valid list that fits (or is as small as possible)

---

### `backend/app/config.py` — New env vars (D-078-07)

**Analog:** `backend/app/config.py` (self) — `Settings` class fields lines 596-706

**Existing env var field pattern** (lines 596-614):
```python
    # Concurrency (Phase 058 — D-058-07)
    anyio_thread_tokens: int = 200

    # Run-backed streaming (Phase 061 — D-v2.5-08, D-061-13)
    redis_url: str = "redis://localhost:6379"
```

**New fields to add to `Settings` class** (after `postgres_pool_max` at line 624):
```python
    # Backpressure admin endpoint (Phase 078 — D-078-07 WORKER-LIFT-04)
    # Comma-separated Supabase Auth user IDs allowed to call GET /admin/backpressure.
    # Fail-closed in production (ENVIRONMENT=production): 403 when unset/empty.
    # Fail-open in dev (default): no restriction so testing works without config.
    backpressure_admin_user_ids: str = ""

    # Deployment environment — used by backpressure auth gating and test guards.
    # Values: "production" | "prod" → fail-closed for admin endpoints.
    # Default: "" (dev/local) → fail-open.
    environment: str = ""
```

**Note:** `ENVIRONMENT` is already read via `os.getenv("ENVIRONMENT", "")` at `main.py:186, 205` (test fixtures guard). Adding it to `Settings` makes it consistently readable as `settings.environment` throughout. The `extra="ignore"` on `Settings` (line 479) means no conflict.

---

### `backend/app/api/admin.py` *(new file)* — Backpressure endpoint (WORKER-LIFT-04, D-078-06/07/08)

**Analog:** `backend/app/api/knowledge_health.py` — router + auth dependency + JSON response pattern

**Router scaffold** (copy from `knowledge_health.py` lines 1-10, adapt):
```python
"""Admin operations — backpressure metrics (Phase 078, WORKER-LIFT-04)."""
import logging

import anyio
from fastapi import APIRouter, Depends, HTTPException, status

from app.config import settings
from app.dependencies import get_current_user, get_redis, _pg_pool

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])
```

**Auth gating pattern** (D-078-07 fail-closed logic):
```python
def _check_backpressure_auth(current_user: dict = Depends(get_current_user)) -> dict:
    """Fail-closed in production when BACKPRESSURE_ADMIN_USER_IDS is unset."""
    env = settings.environment.lower()
    is_production = env in ("production", "prod")
    allow_ids_raw = settings.backpressure_admin_user_ids.strip()

    if not allow_ids_raw:
        if is_production:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin endpoint not configured",
            )
        # Dev/local: fail-open — no restriction
        return current_user

    allowed = {uid.strip() for uid in allow_ids_raw.split(",") if uid.strip()}
    if current_user["id"] not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized",
        )
    return current_user
```

**Core GET endpoint pattern** (D-078-06/08 — 4 signals, additive JSON shape):
```python
@router.get("/backpressure")
async def get_backpressure(
    _user: dict = Depends(_check_backpressure_auth),
):
    """Return worker backpressure metrics for the v3.1 ops dashboard.

    JSON shape is additive-only — v3.1 can add fields without breaking consumers.
    """
    limiter = anyio.to_thread.current_default_thread_limiter()
    anyio_borrowed = limiter.borrowed_tokens
    anyio_total = limiter.total_tokens

    # Redis — ZCARD runs:active sorted set (Phase 061+ convention)
    redis_active_runs = 0
    try:
        redis_active_runs = await get_redis().zcard("runs:active")
    except Exception:
        pass  # Redis unreachable — report 0, not error

    # asyncpg pool — in-use connections
    pg_in_use = 0
    if _pg_pool is not None:
        try:
            pg_in_use = _pg_pool.get_size() - _pg_pool.get_idle_size()
        except Exception:
            pass

    # RUN_TASKS — active producer tasks (late-bind import, avoids circular at module load)
    try:
        from app.api.threads import RUN_TASKS
        per_worker_run_count = len(RUN_TASKS)
    except ImportError:
        per_worker_run_count = 0

    return {
        "anyio_threadpool_depth": {
            "borrowed": anyio_borrowed,
            "total": anyio_total,
        },
        "redis_active_runs": redis_active_runs,
        "postgres_pool_in_use": pg_in_use,
        "per_worker_run_count": per_worker_run_count,
    }
```

**Router registration** — add to `backend/app/main.py` (lines 160-172 import block):
```python
from app.api import threads, runs, documents, settings as settings_api, folders, kb, skills, audit, knowledge_health, feedback, sandbox_outputs, admin  # noqa: E402

app.include_router(admin.router)   # add after existing include_router calls
```

**Key pattern notes from analog (`knowledge_health.py`):**
- Router prefix on `APIRouter(prefix="...", tags=[...])` (line 10) — use `"/admin"`
- `get_current_user` dependency via `Depends()` (line 547) — same import from `app.dependencies`
- Sync Supabase calls inside async handlers use `run_in_threadpool` (D-v2.5-01); the backpressure endpoint reads only in-memory state (limiter, pool stats, dict length) — NO blocking I/O, no `run_in_threadpool` needed
- Redis `zcard` is awaitable — call directly (no threadpool)
- Error response pattern: `raise HTTPException(status_code=..., detail="...")` (line 554)

---

### `supabase/migrations/043_documents_dedup_unique_index.sql` — Already exists

**Status:** Migration 043 was already created at `supabase/migrations/043_documents_dedup_unique_index.sql`. The DDL matches D-078-03 — partial unique index on `(user_id, content_hash, folder_id) WHERE status != 'failed'`.

**Existing DDL** (full file — confirm before applying):
```sql
DELETE FROM public.documents
WHERE status != 'failed'
  AND ctid NOT IN (
    SELECT MIN(ctid) FROM public.documents
    WHERE status != 'failed'
    GROUP BY user_id, content_hash, folder_id
  );

CREATE UNIQUE INDEX IF NOT EXISTS documents_dedup_idx
  ON public.documents (user_id, content_hash, folder_id)
  WHERE status != 'failed';
```

**NULL folder_id handling note (D-078-03):** PostgreSQL's `CREATE UNIQUE INDEX` treats `NULL = NULL` as non-equal by default, so two rows with `folder_id IS NULL` and the same `(user_id, content_hash)` would NOT conflict. The existing migration uses `folder_id` directly (not `COALESCE`). The backend fast-path dedup already handles the NULL case via `.is_("folder_id", "null")`. For the race-condition CAS path, if the unique index needs NULL-safe dedup, the planner should consider `COALESCE(folder_id, '00000000-0000-0000-0000-000000000000'::uuid)` in the index definition — check the existing migration and validate against the NULL-folder upload test case.

**Migration DDL pattern** (from `042_document_tables_bbox_extractor.sql`):
```sql
-- Migration NNN: <description> (Phase NNN, <req-id>).
--
-- <comment on intent>

ALTER TABLE public.<table>
  ADD COLUMN IF NOT EXISTS <col> <type>;
```

---

### `backend/tests/unit/test_lifespan.py` — Phase 078 extension (CQ-SUPA-01)

**Analog:** `backend/tests/unit/test_lifespan.py` (self) — Phase 073 base tests lines 19-59

**Existing test scaffold** (lines 19-38):
```python
@pytest.mark.asyncio
async def test_pg_pool_closes_before_supabase():
    from app.main import app

    mock_pool = MagicMock()
    mock_pool.close = AsyncMock()
    mock_pool.terminate = MagicMock()

    with patch("app.dependencies._pg_pool", mock_pool):
        async with app.router.lifespan_context(app):
            pass  # enter + exit lifespan

    assert mock_pool.close.await_count >= 1, "_pg_pool.close() must be awaited on lifespan shutdown"
```

**New test to add** (Phase 078 CQ-SUPA-01 — copy patch pattern from above):
```python
@pytest.mark.asyncio
async def test_supabase_aclose_called_on_shutdown():
    """Phase 078 CQ-SUPA-01: _supabase.aclose() is awaited during lifespan shutdown."""
    from app.main import app

    mock_client = MagicMock()
    mock_client.aclose = AsyncMock()

    with patch("app.dependencies._supabase", mock_client):
        async with app.router.lifespan_context(app):
            pass

    assert mock_client.aclose.await_count >= 1, "_supabase.aclose() must be awaited on lifespan shutdown"


@pytest.mark.asyncio
async def test_supabase_aclose_after_pg_pool():
    """Phase 078: _supabase.aclose() runs AFTER _pg_pool.close() (shutdown ordering D-078-09)."""
    from app.main import app

    call_order = []

    mock_pool = MagicMock()
    async def _pool_close():
        call_order.append("pg_pool")
    mock_pool.close = AsyncMock(side_effect=_pool_close)
    mock_pool.terminate = MagicMock()

    mock_client = MagicMock()
    async def _supa_close():
        call_order.append("supabase")
    mock_client.aclose = AsyncMock(side_effect=_supa_close)

    with patch("app.dependencies._pg_pool", mock_pool), \
         patch("app.dependencies._supabase", mock_client):
        async with app.router.lifespan_context(app):
            pass

    pg_idx = call_order.index("pg_pool") if "pg_pool" in call_order else -1
    supa_idx = call_order.index("supabase") if "supabase" in call_order else -1
    assert pg_idx < supa_idx, f"Expected pg_pool before supabase, got order: {call_order}"
```

**Required imports** (add to existing file if not present):
```python
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
```

---

### `backend/tests/unit/test_context_window.py` — Protected-overrun edge cases (CQ-CTX-01)

**Analog:** `backend/tests/unit/test_context_window.py` (self) — test factory helpers and trim test pattern lines 1-60

**Existing helper pattern to reuse** (lines 15-36):
```python
def _sys(content: str) -> dict:
    return {"role": "system", "content": content}

def _user(content: str) -> dict:
    return {"role": "user", "content": content}

def _assistant(content: str) -> dict:
    return {"role": "assistant", "content": content}
```

**New test cases to append** (protected-only overrun, D-078-01/02):
```python
# ---------------------------------------------------------------------------
# trim_messages_to_fit — protected-only overrun (Phase 078 CQ-CTX-01 D-078-01)
# ---------------------------------------------------------------------------

def test_trim_protected_overrun_trims_inward():
    """When trimmable is empty AND protected+system still exceed max_tokens,
    progressively trim oldest protected messages (D-078-01 progressive trim)."""
    system_msg = _sys("System prompt.")
    # Only 2 messages — both land in protected (reserve_recent=2), trimmable is empty
    protected_old = _user("Protected-but-old message " * 50)   # ~1300 chars = ~325 tokens
    protected_new = _assistant("Recent reply.")

    messages = [system_msg, protected_old, protected_new]
    # Token budget smaller than protected_old alone forces trimming into protected
    result = trim_messages_to_fit(messages, max_tokens=30, reserve_recent=2)

    # System must always be present
    assert result[0] == system_msg
    # Result must fit within max_tokens (or be as small as possible)
    assert estimate_messages_tokens(result) <= 30 or len(result) == 2  # floor: sys + last


def test_trim_protected_overrun_inserts_marker():
    """Marker is inserted when protected-only overrun causes trimming (D-078-01)."""
    system_msg = _sys("System.")
    protected_old = _user("Very long protected message. " * 100)
    protected_new = _assistant("Recent.")

    messages = [system_msg, protected_old, protected_new]
    result = trim_messages_to_fit(messages, max_tokens=20, reserve_recent=2)

    # A trim marker must be present (trimming occurred)
    assert any(
        _TRIM_MARKER in (m.get("content") or "")
        for m in result
    ), "Expected _TRIM_MARKER after protected-only overrun trim"


def test_trim_protected_overrun_never_errors():
    """trim_messages_to_fit always returns a list — never raises (D-078-02)."""
    system_msg = _sys("S" * 1000)   # large system prompt
    only_msg = _user("U" * 1000)    # only one protected message

    messages = [system_msg, only_msg]
    # Absurdly small budget — function must not raise
    result = trim_messages_to_fit(messages, max_tokens=1, reserve_recent=1)
    assert isinstance(result, list)
    assert len(result) >= 1  # at minimum system prompt


def test_trim_protected_overrun_preserves_last_message():
    """Hard floor: last message in protected tail is always preserved (D-078-01)."""
    system_msg = _sys("System.")
    messages = [system_msg]
    for i in range(5):
        messages.append(_user(f"Protected message {i} " * 30))
    last_msg = _assistant("The very last reply.")
    messages.append(last_msg)

    result = trim_messages_to_fit(messages, max_tokens=20, reserve_recent=6)
    # The last message must survive (hard floor)
    assert last_msg in result, "Last protected message must never be trimmed"
```

---

### `backend/tests/unit/test_backpressure.py` *(new)* — Backpressure endpoint unit tests

**Analog:** `backend/tests/unit/test_health.py` — TestClient + monkeypatch pattern lines 1-58

**Full test file scaffold:**
```python
"""Unit tests for GET /admin/backpressure (Phase 078, WORKER-LIFT-04, D-078-06/07)."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import get_current_user

USER_ID = "00000000-0000-0000-0000-000000000001"
ADMIN_USER_ID = "admin-user-uuid-here"

def _mock_user(uid=USER_ID):
    return {"id": uid, "email": "test@example.com"}


@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = lambda: _mock_user()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_current_user, None)


# ── Auth gating ────────────────────────────────────────────────────────────────

def test_backpressure_200_in_dev(client, monkeypatch):
    """Dev environment (ENVIRONMENT=''): fail-open, any authenticated user gets 200."""
    monkeypatch.setattr("app.config.settings.environment", "")
    monkeypatch.setattr("app.config.settings.backpressure_admin_user_ids", "")
    response = client.get("/admin/backpressure")
    assert response.status_code == 200


def test_backpressure_403_in_production_no_config(client, monkeypatch):
    """Production environment + no BACKPRESSURE_ADMIN_USER_IDS → 403 (D-078-07 fail-closed)."""
    monkeypatch.setattr("app.config.settings.environment", "production")
    monkeypatch.setattr("app.config.settings.backpressure_admin_user_ids", "")
    response = client.get("/admin/backpressure")
    assert response.status_code == 403


def test_backpressure_200_for_allowed_user(monkeypatch):
    """Allowed user ID in BACKPRESSURE_ADMIN_USER_IDS → 200."""
    monkeypatch.setattr("app.config.settings.environment", "production")
    monkeypatch.setattr("app.config.settings.backpressure_admin_user_ids", ADMIN_USER_ID)
    app.dependency_overrides[get_current_user] = lambda: _mock_user(uid=ADMIN_USER_ID)
    try:
        with TestClient(app) as c:
            response = c.get("/admin/backpressure")
        assert response.status_code == 200
    finally:
        app.dependency_overrides.pop(get_current_user, None)


# ── Response shape ─────────────────────────────────────────────────────────────

def test_backpressure_response_shape(client, monkeypatch):
    """Response contains the 4 required signal keys (D-078-06)."""
    monkeypatch.setattr("app.config.settings.environment", "")
    monkeypatch.setattr("app.config.settings.backpressure_admin_user_ids", "")
    response = client.get("/admin/backpressure")
    assert response.status_code == 200
    body = response.json()
    assert "anyio_threadpool_depth" in body
    assert "redis_active_runs" in body
    assert "postgres_pool_in_use" in body
    assert "per_worker_run_count" in body
    # anyio_threadpool_depth is a nested object
    assert "borrowed" in body["anyio_threadpool_depth"]
    assert "total" in body["anyio_threadpool_depth"]


def test_backpressure_redis_unreachable_does_not_500(client, monkeypatch):
    """Redis unreachable → 200 with redis_active_runs=0, not 500."""
    monkeypatch.setattr("app.config.settings.environment", "")
    monkeypatch.setattr("app.config.settings.backpressure_admin_user_ids", "")
    mock_redis = AsyncMock()
    mock_redis.zcard.side_effect = Exception("connection refused")
    monkeypatch.setattr("app.api.admin.get_redis", lambda: mock_redis)
    response = client.get("/admin/backpressure")
    assert response.status_code == 200
    assert response.json()["redis_active_runs"] == 0
```

---

### `backend/tests/integration/test_documents.py` — Dedup 409 test (CQ-DEDUP-01, D-078-04)

**Analog:** `backend/tests/integration/test_documents.py` (self) — `_make_result`, `_doc_row` helpers lines 16-31

**Pattern to add** (new class in existing test file):
```python
class TestUploadDedup409:
    """Phase 078 CQ-DEDUP-01: concurrent upload duplicate returns 409 (D-078-04)."""

    def test_409_on_unique_violation(self, client, auth_headers, mock_builder):
        """When INSERT raises unique violation (23505), upload handler returns 409."""
        from unittest.mock import patch

        # Dedup SELECT returns empty (fast-path doesn't catch it — simulating race)
        # Version SELECT also empty
        mock_builder.execute.side_effect = [
            _make_result([]),   # dedup check — no existing
            _make_result([]),   # version check — no existing
        ]

        from postgrest.exceptions import APIError

        def _raise_unique_violation(*args, **kwargs):
            raise APIError({"code": "23505", "message": "duplicate key value violates unique constraint"})

        with patch("starlette.concurrency.run_in_threadpool", side_effect=_raise_unique_violation):
            # Upload 1-byte file
            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("dup.txt", b"x", "text/plain")},
            )
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"].lower()
```

---

## Shared Patterns

### Authentication dependency
**Source:** `backend/app/dependencies.py` lines 103-114
**Apply to:** New `backend/app/api/admin.py`
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

### Late-bind import pattern (avoids circular import at module load)
**Source:** `backend/app/main.py` lines 89, 112, 124
**Apply to:** `main.py` Supabase aclose, `admin.py` RUN_TASKS import
```python
# Pattern: import inside the function/block where it is needed, not at module top
try:
    from app.api.threads import RUN_TASKS
    ...
except ImportError:
    pass
```

### Settings env var field pattern
**Source:** `backend/app/config.py` lines 596-614
**Apply to:** New `backpressure_admin_user_ids` and `environment` fields in `Settings`
```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    # Field name maps directly to env var name (uppercase): BACKPRESSURE_ADMIN_USER_IDS
    backpressure_admin_user_ids: str = ""
    environment: str = ""
```

### Blocking I/O guard (D-v2.5-01)
**Source:** `backend/app/api/documents.py` lines 419-423
**Apply to:** Any Supabase call in async handler — already applied throughout `documents.py` and `threads.py`
```python
result = await run_in_threadpool(
    lambda: supabase.table("...").select("*").execute()
)
```
Note: The `GET /admin/backpressure` endpoint reads only in-memory state (limiter tokens, pool size, dict length) + one async Redis call. NO `run_in_threadpool` needed.

### Error handling in async endpoints
**Source:** `backend/app/api/knowledge_health.py` lines 551-557
**Apply to:** `admin.py` endpoint
```python
try:
    return ...
except Exception as exc:
    raise HTTPException(status_code=502, detail="...temporarily unavailable") from exc
```

### Logger warning with exc_info
**Source:** `backend/app/api/threads.py` lines 1355-1359
**Apply to:** `generate_thread_title` except-block fix
```python
logger.warning(
    "title_generation_failed: %s", e,
    exc_info=True,
)
```

---

## No Analog Found

All files have clear analogs. No novel patterns needed.

---

## Metadata

**Analog search scope:** `backend/app/`, `backend/tests/`, `supabase/migrations/`
**Files read:** 13 source files + 2 migration files
**Pattern extraction date:** 2026-05-26

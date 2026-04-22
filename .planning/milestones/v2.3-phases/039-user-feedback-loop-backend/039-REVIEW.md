---
phase: 039-user-feedback-loop-backend
reviewed: 2026-04-18T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - supabase/migrations/028_message_feedback.sql
  - backend/app/api/feedback.py
  - backend/app/services/audit_service.py
  - backend/app/main.py
  - backend/tests/test_feedback.py
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 039: Code Review Report

**Reviewed:** 2026-04-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files were reviewed covering the migration, API endpoint, audit service, app registration, and unit tests for the Phase 39 user feedback loop. The implementation is structurally solid: RLS is properly scoped (INSERT + SELECT only), the unique constraint enforces immutability at the DB level, and audit writes are correctly fire-and-forget. No critical security vulnerabilities were found.

Three warnings were identified: missing input validation on `FeedbackRequest` fields (the DB constraint rejects invalid values but the API returns a 502 instead of 422), a scalability hazard in `get_feedback_stats` that fetches all ratings into Python memory, and a silent data-loss risk when the fire-and-forget audit task is created outside an active asyncio event loop. Three info items cover minor naming, magic-number, and test-coverage gaps.

## Warnings

### WR-01: No server-side validation on `rating` and `reason` — invalid values return 502 instead of 422

**File:** `backend/app/api/feedback.py:29-33`

**Issue:** `FeedbackRequest` accepts any string for `rating` and `reason`. The DB `CHECK` constraint will reject invalid values, but the exception handler at line 55-63 only inspects for `"23505"`, `"unique"`, and `"duplicate"` in the error string. A bad `rating` value (e.g., `"thumbsup"`) triggers a generic Postgres `check_violation` (code `23514`), which falls through to the 502 branch. The client receives "Failed to save feedback" rather than a descriptive 422 with the allowed values.

**Fix:** Add a Pydantic `Literal` type constraint so FastAPI rejects invalid input before it reaches the DB:

```python
from typing import Literal

class FeedbackRequest(BaseModel):
    message_id: UUID
    rating: Literal["positive", "negative"]
    reason: Literal["wrong_answer", "not_from_documents", "incomplete", "other"] | None = None
```

---

### WR-02: `get_feedback_stats` fetches every rating row into memory — unbounded for long-lived users

**File:** `backend/app/api/feedback.py:99-111`

**Issue:** The all-time positive rate is computed by fetching the full `message_feedback` table for the user (`.select("rating")`) and counting in Python. A user with thousands of ratings will transfer all rows over the wire. There is no server-side aggregation. This is not a performance flag — it is a correctness risk: if the Supabase response exceeds the default row limit (1 000 rows by default in the Supabase JS/Python client), the count will be silently wrong.

**Fix:** Use a Supabase RPC or two `.select("rating", count="exact")` calls with a filter, relying on the built-in `count` header, rather than materialising every row. At minimum, check whether the client paginates and document the known limit:

```python
# Option A: use count="exact" (Supabase returns the count in the response header)
res = supabase.table("message_feedback").select("rating", count="exact").eq("user_id", user_id).execute()
total_ratings = res.count  # not len(res.data)

# Option B: separate counted selects
pos_res = supabase.table("message_feedback").select("id", count="exact") \
    .eq("user_id", user_id).eq("rating", "positive").execute()
total_res = supabase.table("message_feedback").select("id", count="exact") \
    .eq("user_id", user_id).execute()
```

---

### WR-03: `asyncio.create_task` in `submit_feedback` may fail with "no running event loop" in test/edge contexts

**File:** `backend/app/api/feedback.py:66`

**Issue:** `asyncio.create_task(write_audit_entry(...))` is called directly inside the async route handler. This works under uvicorn at runtime, but the task is attached to the running loop without any error handling. If `create_task` itself raises (e.g., the loop is closed, or in a non-async test context), the exception is unhandled and silently drops the audit write. The docstring in `audit_service.py` (line 4) recommends `BackgroundTasks.add_task()` as the preferred method but the feedback endpoint uses `asyncio.create_task` instead.

**Fix:** Use FastAPI's `BackgroundTasks` which is lifecycle-safe and consistent with the stated pattern in the audit service docstring:

```python
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

@router.post("", status_code=201)
async def submit_feedback(
    body: FeedbackRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    ...
    background_tasks.add_task(
        write_audit_entry,
        user_id=user_id,
        action_type="feedback.submit",
        metadata={...},
        supabase=supabase,
    )
```

## Info

### IN-01: `VALID_ACTION_TYPES` in `audit_service.py` is defined but never enforced

**File:** `backend/app/services/audit_service.py:11-17`

**Issue:** `VALID_ACTION_TYPES` is a module-level constant but `write_audit_entry` never checks whether `action_type` is in it. A typo at a call site would silently insert an unrecognised action type into the audit log. This was likely intended as a guard.

**Fix:** Add a guard at the top of `write_audit_entry`:

```python
async def write_audit_entry(user_id, action_type, metadata, supabase):
    if action_type not in VALID_ACTION_TYPES:
        logger.warning("audit: unknown action_type=%s — skipping", action_type)
        return
    ...
```

---

### IN-02: Magic numbers `DOWNVOTE_WINDOW_DAYS` and `TOP_DOWNVOTED` are module-level but not surfaced to callers

**File:** `backend/app/api/feedback.py:16-17`

**Issue:** The constants are defined at module level which is fine, but the stats response does not include the window used (`downvote_window_days`). If these values change, frontend consumers have no way to know which window produced the result without reading the source. This is a documentation/transparency gap.

**Fix:** Include `downvote_window_days` in the response body so clients can display "last 30 days" dynamically:

```python
return {
    "positive_rate": round(positive_rate, 4),
    "total_ratings": total_ratings,
    "downvote_window_days": DOWNVOTE_WINDOW_DAYS,
    "downvoted_documents": downvoted_documents,
}
```

---

### IN-03: Test `test_submit_feedback_returns_201` does not assert the audit task is created

**File:** `backend/tests/test_feedback.py:39-57`

**Issue:** The happy-path test for `POST /feedback` verifies the 201 status code and the INSERT payload but does not assert that the audit write is triggered. If someone removes the `create_task` call, the test still passes. Since this is fire-and-forget, a simple spy on `asyncio.create_task` or `write_audit_entry` would catch regressions.

**Fix:** Patch `write_audit_entry` and assert it was called:

```python
from unittest.mock import patch, AsyncMock

def test_submit_feedback_returns_201(client, auth_headers, mock_execute_result, mock_builder):
    mock_execute_result.data = []
    with patch("app.api.feedback.write_audit_entry", new_callable=AsyncMock) as mock_audit:
        res = client.post("/feedback", json={"message_id": "...", "rating": "positive"}, headers=auth_headers)
    assert res.status_code == 201
    mock_audit.assert_called_once()
```

---

_Reviewed: 2026-04-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

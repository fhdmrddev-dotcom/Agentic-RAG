---
phase: 268-expert-spend-mid-thread-scope
reviewed: 2026-09-29T15:00:00Z
depth: standard
iteration: 4
scope: "independent review of phase 268 diff (220c82dde..HEAD)"
reviewer: gemini
files_reviewed: 35
files_reviewed_list:
  - backend/app/api/admin_spend.py
  - backend/app/api/runs.py
  - backend/app/api/threads.py
  - backend/app/db/rates.py
  - backend/app/db/runs.py
  - backend/app/models/message.py
  - backend/app/models/thread.py
  - backend/app/services/agent_loop.py
  - backend/app/services/expert_scope.py
  - backend/app/services/harness/publish_service.py
  - backend/app/services/harness_engine.py
  - backend/app/services/run_lifecycle.py
  - backend/app/services/run_producer.py
  - backend/app/services/scope_note.py
  - backend/app/services/tool_dispatcher.py
  - frontend/src/components/admin/spend/AttributionDisclosures.tsx
  - frontend/src/components/admin/spend/BlindSpotsCard.tsx
  - frontend/src/components/admin/spend/ExpertFilterPills.tsx
  - frontend/src/components/admin/spend/ExpertSpendCard.tsx
  - frontend/src/components/admin/spend/expertSpendCopy.ts
  - frontend/src/components/chat/ActiveExpertChip.tsx
  - frontend/src/components/chat/ChatArea.tsx
  - frontend/src/components/chat/ExpertEventCard.tsx
  - frontend/src/components/chat/MessageInput.tsx
  - frontend/src/components/chat/ScopeChip.tsx
  - frontend/src/components/chat/ScopePicker.tsx
  - frontend/src/components/chat/expertEventCopy.ts
  - frontend/src/components/chat/scopeCopy.ts
  - frontend/src/components/experts/ScopeLedger.tsx
  - frontend/src/lib/api.ts
  - frontend/src/lib/api/spend.ts
  - frontend/src/lib/api/threads.ts
  - frontend/src/pages/admin/AdminSpendPage.tsx
  - frontend/src/types/spend.ts
  - supabase/migrations/197_runs_expert_attribution.sql
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 268: Independent Code Review Report

**Reviewed:** 2026-09-29  
**Reviewer:** Gemini (Independent Code Reviewer, non-builder per AGENTS.md §3 & §6.3, discharging BUS-305 / 268-HUMAN-UAT §1)  
**Depth:** standard  
**Scope:** Full Phase 268 diff (`220c82dde..HEAD`), including backend routes, database migrations and rates logic, frontend chat scope components, admin spend views, and all associated unit and integration tests.  
**Status:** issues_found  

---

## Executive Summary

Phase 268 introduces two core features:
1. **Expert Spend Attribution & Sub-Agent Rollup** (`METER-08`): Migration 197 stamps `expert_id` and `expert_attributed` at run insertion (`db.runs.insert_run`); sub-agents copy their parent run's attribution; the `per_root` CTE rolls up sub-agent token spend into their root runs and aggregates by Expert on `/admin/spend`.
2. **Mid-Thread Scope Change** (`CHAT-08`): Live folder switching in chat via `PATCH /threads/{id}` (folder arm) and `GET /threads/{id}/scope-effect`; `ScopeChip` and `ScopePicker` in the composer; model history notification via synthetic scope notes (`scope_note.py`, `SEED-319`).

While the prior 3 in-session iterations by Claude closed several important defects (such as Continue org stamping in CR-01, `currentTidRef` UI race handling, and 409 conflict handling on folder patch races), this independent review uncovered a **critical unhandled exception in the folder PATCH route** for org-less threads, as well as a cross-tenant scoping discrepancy.

| Finding | Severity | File(s) | Summary |
|---|---|---|---|
| **CR-01** | **Critical** | `backend/app/api/threads.py:1040` | `_write_scope_change` crashes with HTTP 500 (`ValueError: badly formed hexadecimal UUID string`) when patching or clearing a folder on an org-less thread (`UUID(str(None))`). |
| **WR-01** | **Warning** | `backend/app/api/threads.py:1053` | Cross-tenant inconsistency: `_describe_thread_scope_change` resolves active org from the incoming HTTP request instead of the thread's own org, causing Expert lookup failure and degraded scope text for multi-org users. |
| **WR-02** | **Warning** | `backend/app/api/threads.py:1125-1133` | `get_scope_effect` allows conflicting `folder_id` and `clear=True` parameters simultaneously without 422 validation, silently ignoring `folder_id`. |
| **IN-01** | **Info** | Multiple | Audit of prior fixes from iterations 1–3: confirmed CR-01 (Continue org), WR-01 (ChatArea tid ref), WR-02 (409 conflict), WR-03 (Continue scope turn), WR-04 (unnameable folders), WR-05 / D-268-28 (partly priced harness disclosure), WR-06 (harness shells), and SEED-322 are correctly preserved and tested. |

---

## Findings

### CR-01: `_write_scope_change` crashes with HTTP 500 when modifying an org-less thread

**File:** `backend/app/api/threads.py:1040` (and call site at line 1093)

**Issue:**  
In `_apply_folder_change`:
```python
row = await _read_thread_scope(supabase, thread_id, user_id)
# ...
await _write_scope_change(
    conn,
    thread_id=thread_id,
    user_id=user_id,
    org_id=row.get("org_id"),
    folder_id=new_folder,
    event=event,
    expected_folder_id=old_folder,
    title=update_data.get("title"),
)
```
When a thread has `org_id is None` (e.g. personal threads, threads created without org header, or legacy threads; explicitly supported per `_authorize_thread_folder` docstring: *"An org-less thread fails closed (owned folders only, and only an org-less one)"*), `row.get("org_id")` evaluates to `None`.

In `_write_scope_change` (lines 1036-1043):
```python
await conn.execute(
    "INSERT INTO public.messages (thread_id, user_id, org_id, role, content, tool_calls) "
    "VALUES ($1::uuid, $2::uuid, $3::uuid, 'system', $4, $5::jsonb)",
    UUID(str(thread_id)),
    UUID(str(user_id)),
    UUID(str(org_id)),  # <--- CRASHES HERE WHEN org_id IS None
    scope_event_sentence(event),
    [event.model_dump(mode="json")],
)
```
Notice lines 1021–1022 correctly guard nullable UUIDs:
```python
UUID(str(folder_id)) if folder_id else None,
UUID(str(expected_folder_id)) if expected_folder_id else None,
```
However, line 1040 executes `UUID(str(None))` which becomes `UUID("None")`. In Python:
```python
>>> UUID(str(None))
ValueError: badly formed hexadecimal UUID string
```
The unhandled `ValueError` escapes to `_apply_folder_change`'s `except Exception:` block:
```python
except Exception:
    logger.error("folder change on thread %s was not written", thread_id, exc_info=True)
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="The folder was not changed.",
    )
```
Consequently, every folder change or folder clear on an org-less thread fails with HTTP 500.

**Fix:**  
Guard `org_id` conditionally, exactly like `folder_id`:
```python
- UUID(str(org_id)),
+ UUID(str(org_id)) if org_id else None,
```
Add a unit test in `test_268_scope_patch.py` where `row["org_id"]` is `None` to assert that changing/clearing a folder succeeds with `messages.org_id = NULL`.

---

### WR-01: Cross-tenant discrepancy in `_describe_thread_scope_change`

**File:** `backend/app/api/threads.py:1046-1056`

**Issue:**  
In `_describe_thread_scope_change`:
```python
async def _describe_thread_scope_change(request: Request, current_user: dict, supabase: Client, **kw):
    """Pitfall 9 / T-268-25: stated with the producer's own inputs — the ACTIVE org (the run's
    ``current_user["org_id"]``) and the caller's role — so the preview and the run cannot disagree."""
    return await describe_scope_change(
        supabase=supabase,
        pool=await get_pg_pool(),
        user_id=current_user["id"],
        org_id=await resolve_active_org_or_none(request, current_user),
        caller_roles=await _caller_roles(request, current_user),
        **kw,
    )
```
`_describe_thread_scope_change` derives `org_id` from the HTTP request header (`resolve_active_org_or_none`).

Consider a multi-org user belonging to Org A and Org B:
- The user has an existing chat thread created under Org A with an active Expert in Org A.
- The user switches active org in their UI session to Org B (sending `X-Org-Id: Org B`), but views/edits this thread in Org A.
- When `_apply_folder_change` runs, `_authorize_thread_folder` authorizes against `row.get("org_id")` (Org A), and `_write_scope_change` writes `org_id = Org A`.
- However, `_describe_thread_scope_change` passes `org_id = Org B` to `describe_scope_change`.
- Inside `describe_expert_scope`, looking up the thread's Expert with `org_id = Org B` fails (`LookupError`), logging:
  `scope change: the thread's Expert could not be named; stating the thread alone`
- As a result, the transcript card and event sentence describe the thread as having NO expert, falsely claiming the Expert's scope was dropped or unnameable, despite the thread having a valid Expert in Org A.

**Fix:**  
Pass the thread's `org_id` (`row.get("org_id")`) into `_describe_thread_scope_change` so that the scope change is described in the thread's own org context:
```python
async def _describe_thread_scope_change(
    request: Request,
    current_user: dict,
    supabase: Client,
    thread_org_id: str | None = None,
    **kw,
):
    org_id = thread_org_id or await resolve_active_org_or_none(request, current_user)
    ...
```

---

### WR-02: `get_scope_effect` allows conflicting `folder_id` and `clear=True` parameters without 422 validation

**File:** `backend/app/api/threads.py:1125-1133`

**Issue:**  
In `get_scope_effect`:
```python
@router.get("/{thread_id}/scope-effect", response_model=ScopeEffect)
async def get_scope_effect(
    thread_id: UUID,
    request: Request,
    folder_id: UUID | None = None,
    clear: bool = False,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    row = await _read_thread_scope(supabase, thread_id, current_user["id"])
    current = row.get("folder_id")
    draft = current
    if clear:
        draft = None
    elif folder_id is not None:
        await _authorize_thread_folder(supabase, current_user["id"], str(folder_id), row.get("org_id"))
        draft = str(folder_id)
```
If a client passes both `folder_id=<uuid>` AND `clear=true`, the endpoint silently executes `if clear:` and sets `draft = None`, skipping `_authorize_thread_folder` on `folder_id`.
In `rename_thread` / `ThreadUpdate`, contradictory inputs or changing both Expert and folder simultaneously are strictly guarded with 422 Unprocessable Content. In `get_scope_effect`, sending contradictory arguments is silently coalesced.

**Fix:**  
Enforce standard input validation:
```python
if clear and folder_id is not None:
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="Specify folder_id or clear, not both.",
    )
```

---

### IN-01: Audit of Prior Iteration Fixes & Verification Gates

The previous in-session iteration fixes (detailed in `268-REVIEW-FIX.md`) were audited against active code:
- **CR-01 (Continue active org):** In `backend/app/api/runs.py:1420`, `spawn_continuation_run` correctly injects `{**current_user, "org_id": str(row["org_id"])}`.
- **WR-01 (ChatArea stale thread race):** In `frontend/src/components/chat/ChatArea.tsx:648`, `currentTidRef` properly gates scope effect refreshes and pending note updates.
- **WR-02 (Scope PATCH race 409):** In `backend/app/api/threads.py:1030`, `WHERE folder_id IS NOT DISTINCT FROM $4::uuid` cleanly detects concurrent folder changes and raises `ScopeChangeConflict` -> HTTP 409.
- **WR-03 (Continue scope history note):** In `backend/app/services/agent_loop.py:1126-1133`, `resuming=True` appends a single trailing user-role note when scope changed during pause.
- **WR-04 (Unnameable folders):** In `backend/app/services/scope_note.py:61-85`, `_Side` compares unnameable folders by ID rather than assuming "all your documents".
- **WR-05 (Partly priced harness runs disclosure):** In `backend/app/db/rates.py:548-550`, `partly_priced_harness_runs` is aggregated and disclosed on `BlindSpotsCard.tsx` per D-268-28.
- **WR-06 (Harness shell org stamping):** `runs.py`, `harness_engine.py`, and `publish_service.py` pass the workflow run's org.
- **SEED-322:** Formally planted for unrated Deep roots with priced sub-agents.

**Automated Gates:**
- Seeds register: 329/329 valid.
- Hot-file ledger: 30/30 watched files tracked.
- Phase 268 Unit Tests (`test_268*.py`): 133/133 passed.

---

_Reviewed by: Gemini (Independent Code Reviewer)_  
_Phase: 268-expert-spend-mid-thread-scope_  
_Report artifact: `.planning/phases/268-expert-spend-mid-thread-scope/268-REVIEW.md`_

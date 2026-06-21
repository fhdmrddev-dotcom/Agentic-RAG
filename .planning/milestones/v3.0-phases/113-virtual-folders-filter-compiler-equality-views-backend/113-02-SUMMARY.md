---
phase: 113-virtual-folders-filter-compiler-equality-views-backend
plan: 02
subsystem: backend
tags: [virtual-folders, view-crud, data-access, security, rls, aexec]
requires:
  - "app.models.document_view (Plan 01) — ViewCreate/ViewUpdate carry the validated filter_expr AST the router model_dumps into create_view/update_view"
  - "app.utils.db.aexec — the run_in_threadpool wrap every .execute() rides (D-v2.5-01)"
  - "app.dependencies.get_supabase — the singleton the _client(supabase) helper falls back to"
  - "document_views table + RLS (migration 071, already live on :54322)"
provides:
  - "app.services.document_view_service: create_view / list_views / get_view / update_view / delete_view (the view CRUD data-access the Plan 03 router consumes for CRUD + the resolve readability gate)"
affects:
  - "Plan 03 (document_views router) — consumes all 5 CRUD functions; get_view is the resolve route's 404-not-403 readability gate"
tech-stack:
  added: []
  patterns:
    - "Clone metadata_field_service.py verbatim, swap _TABLE = document_views"
    - "is_global HARD-SET to False in the insert payload — defense-in-depth over RLS WITH CHECK (D-113-3)"
    - "Own-OR-global read gate (.or_ is_global.eq.true); own-only write gate (.eq user_id); miss collapses to None/False (404-not-403, no existence leak)"
    - "Every supabase .execute() wrapped in aexec / run_in_threadpool (D-v2.5-01)"
key-files:
  created:
    - "backend/app/services/document_view_service.py"
  modified: []
decisions:
  - "Field-whitelist validation (validate_fields) stays in the Plan 03 router, NOT here — this module is pure persistence (create_view receives an already-validated filter_expr dict)"
  - "create_view signature does NOT accept is_global at all (vs metadata_field_service which accepts-then-ignores it for symmetry) — a view's is_global is never a caller dimension, so there is nothing to ignore"
  - "filter_expr typed as dict (the router model_dumps the ViewFilter AST before calling) — the service does not import or re-validate the Pydantic AST"
metrics:
  duration: "~3 min"
  completed: "2026-06-18"
  tasks: 1
  files: 1
  commits: 1
---

# Phase 113 Plan 02: View CRUD Data-Access Service Summary

Landed `document_view_service.py` — the owner-scoped create/list/get/update/delete persistence layer for saved views (VIEW-01/VIEW-05), cloned almost verbatim from `metadata_field_service.py`. The security-load-bearing `is_global=False` hard-set (D-113-3), the own-OR-global read gate that lets the router answer 404-not-403 on a miss (D-113-4), and the `aexec`-on-every-`.execute()` discipline (D-v2.5-01) all live in this one auditable module so the Plan 03 router stays thin.

## What Was Built

- **`backend/app/services/document_view_service.py`** — five async functions, all DB calls through `aexec`:
  - `_client(supabase)` — optional-client helper (passed DI client, else `get_supabase()` singleton), copied from the analog.
  - `create_view(user_id, name, filter_expr, folder_scope=None, supabase=None)` — inserts `{"user_id": str(user_id), "name": name, "filter_expr": filter_expr, "folder_scope": str(folder_scope) if folder_scope else None, "is_global": False}`. `is_global` is the literal `False` in the payload, NEVER read from any caller field (D-113-3; RLS WITH CHECK at migration 071 forces it too — this is defense-in-depth). `filter_expr` arrives as an already-validated dict (the router runs `validate_fields` + `model_dump()` first). Returns `result.data[0]`.
  - `list_views(user_id, supabase=None)` — own + global via `.or_(f"user_id.eq.{user_id},is_global.eq.true")`, `.order("name")`, deduped by id (the `seen`/`out` loop cloned from `metadata_field_service.py:46-52`).
  - `get_view(view_id, user_id, supabase=None)` — `.eq("id", view_id).or_(f"user_id.eq.{user_id},is_global.eq.true")`, returns `(result.data or [None])[0]`. Own OR global; a not-readable id → empty result → `None`. This is the readability check the resolve route's 404-not-403 depends on (D-113-4); no existence leak.
  - `update_view(user_id, view_id, data, supabase=None)` / `delete_view(user_id, view_id, supabase=None)` — own-scoped (`.eq("id", view_id).eq("user_id", str(user_id))`); an empty `result.data` collapses to `None` / `False`, which the router maps to 404 (cloned from `update_field_definition` / `delete_field_definition` at `:100-127`).

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Clone metadata_field_service into document_view_service (CRUD) | `495979d0` | backend/app/services/document_view_service.py |

## Verification

```
cd backend && venv/Scripts/python.exe -c "import app.services.document_view_service as s; assert all(hasattr(s,f) for f in ['create_view','list_views','get_view','update_view','delete_view']); print('OK')"
→ OK
```

The module imports cleanly against the venv and exposes all five CRUD functions. (The `RequestsDependencyWarning` on stdout is a pre-existing unrelated env-version warning, not an import error in this module.)

Source-asserted acceptance criteria (grep on the source):
- `create_view` payload hard-sets `"is_global": False` (the literal `False`, never a caller value) — line 70.
- Five `aexec(` wraps (lines 72, 82, 105, 119, 133), one per CRUD function; the only `.execute()` token in the file is inside the module docstring — NO bare `.execute()` in the code body (D-v2.5-01).
- `get_view` uses `.or_(...is_global.eq.true)` for the readability gate and returns `None` on a miss (line 109) — no existence leak.
- `update_view` / `delete_view` filter on `.eq("user_id", str(user_id))` (lines 123, 137) — own-scoped; cross-user miss → `None` / `False`.

## TDD Gate Compliance

The task is marked `tdd="true"`, but the plan's `<verify>` and `<verification>` blocks explicitly scope this plan's gate to import-only: "The service is pure data-access; its behavior is verified LIVE in Plan 03 (which authors the integration tests against :54322)." This mirrors the 113-01 convention (the un-mark-on-landing / verify-downstream pattern from 098/099/101.1/102) and the PATTERNS.md classification of `document_view_service.py` as an "exact" clone whose live CRUD + 404-not-403 + audit-round-trip assertions are authored in Plan 03's `test_113_view_crud.py`. No fresh per-task RED/GREEN commit pair was authored here because the behavioral RED lives in Plan 03's integration suite by design (the plan body does not author a unit test for this module). The import-only GREEN gate (the five functions exist + the module compiles) passed at commit `495979d0`.

## Deviations from Plan

None — plan executed exactly as written. One intentional clone-divergence (documented in the plan's interface contract, not a deviation): `create_view` does NOT accept an `is_global` parameter at all, whereas `metadata_field_service.create_field_definition` accepts-then-ignores one for signature symmetry. A view's `is_global` is never a caller dimension, so there is nothing to accept-and-ignore — the payload hard-sets `False` directly. No Rule 1-4 deviations, no auth gates, no architectural changes.

## Known Stubs

None. All five CRUD functions are fully wired against the live `document_views` table. Field-whitelist validation is intentionally NOT in this module — it lives in the Plan 03 router (`view_filter_compiler.validate_fields` on create AND update, D-113-10) per the plan's interface contract; this is a documented layering decision, not a stub.

## Threat Flags

None. The module introduces no security surface beyond the plan's `<threat_model>` (T-113-06 is_global escalation, T-113-07 existence leak, T-113-08 blocking I/O) — all three are mitigated as specified (hard-set `False`, own-OR-global / own-only gates with miss→None/False, `aexec` on every call). The live two-user cross-user global-view leak test (SC#3 / VIEW-06) is authored under VALIDATION.md and run in secure-phase, not here.

## Notes for Downstream Plans

- **Plan 03 (`document_views.py` router)** consumes `create_view` / `list_views` / `get_view` / `update_view` / `delete_view`. Before calling `create_view` / `update_view`, the router MUST run `view_filter_compiler.validate_fields(body.filter_expr, whitelist)` and `body.filter_expr.model_dump()` — this service receives the validated dict, it does NOT re-validate. The router maps a `get_view`/`update_view`/`delete_view` miss (`None`/`False`) → HTTP 404 (never 403). The resolve route scopes documents from the CALLER, never `view["user_id"]` (VIEW-06 leak-safety, Pitfall 1).
- The `.contains("metadata", metadata_filter)` → `metadata @> $1::jsonb` wiring the resolve route needs is genuinely net-new app-wide (no existing `.contains()` call site) — Plan 03 must prove it with a live integration test (RESEARCH A2).

## Self-Check: PASSED

- File exists: `backend/app/services/document_view_service.py` — FOUND.
- Commit exists: `495979d0` — FOUND in git log.
- Import verification: `OK` (all five CRUD functions present), exit 0.

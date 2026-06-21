---
phase: 113-virtual-folders-filter-compiler-equality-views-backend
plan: 03
subsystem: backend
tags: [virtual-folders, view-resolve, router, leak-safety, rls, aexec, sc4-injection]
requires:
  - "app.models.document_view (Plan 01) — ViewCreate/ViewUpdate/ViewFilter the router model_dumps + validates"
  - "app.services.view_filter_compiler (Plan 01) — compile_filter + validate_fields the router composes"
  - "app.services.document_view_service (Plan 02) — create/list/get/update/delete the router consumes"
  - "app.api.documents:535 list_documents — the caller-scoped listing shape the resolve route clones"
  - "app.services.harness.scope.resolve_project_subtree — folder_scope → subtree LIST (cycle-guarded)"
  - "app.utils.folder_utils.get_globally_visible_folder_ids + fetch_visible_folders — caller-visible folder scoping"
  - "app.services.audit_service.write_audit_entry (view.create in VALID_ACTION_TYPES) — the DMF-01 receipt"
provides:
  - "app.api.document_views: /document-views router — CRUD (POST/GET/PATCH/DELETE) + GET /{id}/resolve (per-viewer leak-safe), mounted in main.py"
  - "The net-new .contains('metadata', mf) → metadata @> $1::jsonb wiring, proven live (no prior call site app-wide)"
  - "Three live :54322 integration files (CRUD+audit+404, resolve correctness+injection, folder-subtree narrowing)"
affects:
  - "Phase 114 (view/filter builder UI + sidebar) — consumes the CRUD + resolve API surface"
  - "Phase 115 (agent-tool view resolution) — calls the resolve path from chat"
  - "secure-phase — runs the two-user cross-user GLOBAL-view leak test (SC#3/VIEW-06) against this router LIVE"
tech-stack:
  added: []
  patterns:
    - "Clone api/metadata_fields.py router shape (DI + create-with-audit + 404-not-403 PATCH/DELETE)"
    - "Clone documents.py:535 caller-scoped listing (own + global-folder + dedupe + created_at desc), extended with the compiler filter + folder-subtree scope"
    - "Bound-literal metadata containment: .contains('metadata', dict) → metadata @> $1::jsonb (SC#4 param-bound, no f-string SQL)"
    - "Per-viewer leak-safe resolution: EVERY documents query leg scoped from caller, never view.user_id (VIEW-06)"
    - "Unreachable-folder_scope tolerance: intersect resolved subtree with caller-visible folder ids; empty → no narrowing (D-113-5)"
    - "Resolve returns a plain dict (no response_model) to preserve DocumentMetadata extra='allow' round-trip (112 CR-01)"
key-files:
  created:
    - "backend/app/api/document_views.py"
    - "backend/tests/integration/test_113_view_crud.py"
    - "backend/tests/integration/test_113_view_resolve.py"
    - "backend/tests/integration/test_113_view_folder_scope.py"
  modified:
    - "backend/app/main.py"
decisions:
  - "Resolve route uses NO response_model — returns {documents:[...], total:N} as a plain dict so rows round-trip the same metadata blob GET /documents returns (the 112 CR-01 extra='allow' preservation lesson; matches PATTERNS.md resolve excerpt which has no response_model)"
  - "D-113-5 unreachable-scope handling required a Rule-1 router fix: resolve_project_subtree always includes its root id even when unreachable, so narrowing on it zeroed the caller's docs — intersect with caller-visible folder ids, empty intersection drops narrowing"
  - "No document_management_enabled feature gate added (A1 — gate lives at the 114 UI surface, 111/112 precedent); no stale_fields resolve-warning (A2 — deferred to Phase 119)"
  - "Integration tests drive the REAL router coroutines directly (create_view/resolve_view/update_view/delete_view with a {'id': ...} current_user dict + a live service-role client), not a FastAPI TestClient + JWT — the metadata_field_service test convention"
metrics:
  duration: "~12 min"
  completed: "2026-06-18"
  tasks: 2
  files: 5
  commits: 2
---

# Phase 113 Plan 03: Document-Views Router + Live Integration Summary

Wired the `/document-views` router — the thin composition layer that turns the inert Plan 01 compiler + Plan 02 CRUD service into a live, leak-safe API (VIEW-01/02/04/05/06) — mounted it in `main.py`, and proved the whole stack GREEN against live :54322 with three integration files. The single most dangerous bug class this phase could ship (resolving a global view over the OWNER's scope) is structurally prevented: every resolve query leg is scoped from the CALLER, never `view["user_id"]`.

## What Was Built

- **`backend/app/api/document_views.py`** — the `/document-views` router cloned from `api/metadata_fields.py`:
  - **CRUD** — `POST ""` (201) builds the whitelist (`set(DocumentMetadata.model_fields)` ∪ enabled custom defs from `metadata_field_service.list_field_definitions`, `_`-prefixed keys excluded by `validate_fields` itself), runs `view_filter_compiler.validate_fields(body.filter_expr, whitelist)` mapping `ValueError → 422` (D-113-10), calls `document_view_service.create_view(filter_expr=body.filter_expr.model_dump())` (the service hard-sets `is_global=False`), then fires `write_audit_entry(action_type="view.create", ...)` (fire-and-forget, DMF-01). `GET ""` (list_views). `PATCH /{view_id}` re-runs `validate_fields` when the update carries a `filter_expr`, serializes `folder_scope` to str, maps a `None` miss → 404. `DELETE /{view_id}` maps a `False` miss → 404. Every miss is a generic `HTTPException(404)`, NEVER 403 — no existence leak (T-113-10).
  - **`GET /{view_id}/resolve`** — the per-viewer leak-safe core (VIEW-06): (1) `get_view` readability gate (own OR global) → 404-not-403 on an unseeable id; `view["user_id"]` is used ONLY here, never in a documents query; (2) `compile_filter` the saved AST → `metadata_filter` ({} when empty → no `.contains()`, D-113-9); (3) `resolve_project_subtree(folder_scope, user_id=caller)` → a subtree LIST, then **intersected with the caller's visible folder ids** so an unreachable scope drops the narrowing (D-113-5 — see Deviations); (4) clone `list_documents`: `own = documents.eq("user_id", caller).eq("is_latest", True)` + `glob = documents.in_("folder_id", get_globally_visible_folder_ids(caller)).eq("is_latest", True)`, applying `.contains("metadata", metadata_filter)` (only when non-empty) + `.in_("folder_id", subtree)` (only when set) to BOTH legs; merge, dedupe by id, `created_at desc`; return `{"documents": merged, "total": len(merged)}`. Every `.execute()` via `aexec` (D-v2.5-01).
- **`backend/app/main.py`** — two additive lines: `document_views` added to the `from app.api import (...)` tuple and `app.include_router(document_views.router)` beside the `metadata_fields` mount.
- **`backend/tests/integration/test_113_view_crud.py`** — `test_create_writes_audit` (create a view, SELECT the `view.create` audit row back via raw asyncpg — the LIVE round-trip, since the audit write swallows errors) + `test_cross_user_miss_404` (User B's GET/PATCH/DELETE/resolve of User A's private view → 404, plus a nonexistent id → 404).
- **`backend/tests/integration/test_113_view_resolve.py`** — `test_order_and_count` (3 invoices match, report excluded, newest-first, `total==len`), `test_query_not_copy_one_doc_two_views` (one doc resolvable through a by-type AND a by-author view, no duplication — VIEW-02), `test_empty_filter_resolves_all_in_scope` (D-113-9), `test_only_latest_versions_resolve` (is_latest only), `test_injection_value_neutralized_live` (SC#4 live half — a `'; DROP TABLE documents;-- {{7*7}} ${jndi:ldap://x}` value → 0 matches, table intact, row count unchanged, benign row survives).
- **`backend/tests/integration/test_113_view_folder_scope.py`** — `test_folder_scope_narrows_to_subtree` (root + descendant docs resolve, an outside-folder doc excluded) + `test_unreachable_scope_contributes_no_narrowing` (a view scoped to another user's private folder → no narrowing, the caller's own doc still resolves — D-113-5).

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | /document-views router (CRUD + per-viewer resolve) + mount | `20c742a7` | backend/app/api/document_views.py, backend/app/main.py |
| 2 | Live :54322 integration tests + D-113-5 Rule-1 router fix | `ebe0052c` | backend/tests/integration/test_113_view_crud.py, test_113_view_resolve.py, test_113_view_folder_scope.py, backend/app/api/document_views.py |

## Verification

**Full Phase 113 suite (unit + the three integration files) against live :54322** — the per-wave-merge gate (VALIDATION.md §Sampling Rate):

```
cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_113_view_filter_compiler.py tests/integration/test_113_view_crud.py tests/integration/test_113_view_resolve.py tests/integration/test_113_view_folder_scope.py -q
→ 16 passed, exit 0
```

**The three integration files alone:**

```
cd backend && venv/Scripts/python.exe -m pytest tests/integration/test_113_view_crud.py tests/integration/test_113_view_resolve.py tests/integration/test_113_view_folder_scope.py -q
→ 9 passed, exit 0   (2 CRUD + 5 resolve + 2 folder-scope)
```

Breakdown: 7 compiler unit (Plan 01, regression-clean) + 2 CRUD + 5 resolve + 2 folder-scope = **16 passed, exit 0**. The tests ran LIVE against :54322 (confirmed reachable) — not skipped, not mocked. The HTTP logs confirm the net-new `.contains("metadata", mf)` wiring fires as `documents?...&metadata=cs.{...}` (postgrest `cs` = `@>` containment), and the folder-scope leg as `folder_id=in.(...)`.

**App import + route mount (Task 1 automated verify):**

```
venv/Scripts/python.exe -c "from app.main import app; paths=[r.path for r in app.routes]; assert '/document-views' in paths and '/document-views/{view_id}/resolve' in paths; print('IMPORT_OK')"
→ IMPORT_OK
```

Source-asserted acceptance:
- The resolve route's only use of `view["user_id"]` is the `get_view` readability gate; the documents query legs `.eq("user_id", caller)` and `.in_("folder_id", get_globally_visible_folder_ids(..., caller))` — VIEW-06 leak-safety (grep confirms no `view["user_id"]` / `view.user_id` in any `.eq("user_id", ...)` on the documents query).
- `POST ""` calls `validate_fields` before `create_view` and maps `ValueError → 422`.
- `POST ""` calls `write_audit_entry(action_type="view.create", ...)`.
- `.contains("metadata", metadata_filter)` is applied ONLY when non-empty; `.in_("folder_id", subtree)` ONLY when set; both legs use `.eq("is_latest", True)`.
- No `document_management_enabled` gate; no `stale_fields` field (both deferred per A1/A2).
- Every `.execute()` wrapped in `aexec` (no bare `.execute()` in the route body).

## TDD Gate Compliance

Both tasks are `tdd="true"`. The RED behavior was encoded as the three Wave-0 integration files (Task 2) that exercise the Task-1 router; they FAILED (D-113-5 unreachable-scope) before the Rule-1 fix and PASS after it — the genuine RED→GREEN transition is the `test_unreachable_scope_contributes_no_narrowing` failure captured and fixed in this plan (the only behavioral RED that surfaced; the rest of the router matched its acceptance on first author). No fresh per-task `test(...)` then `feat(...)` commit pair was authored because Task 1 (the router) is the implementation and Task 2 authors its live oracle — the plan body scopes the behavioral verification to Plan 03's integration suite (the 098/099/101.1/102 verify-downstream convention; the compiler's exhaustive unit RED/GREEN already landed in Plan 01). The net effect honors RED-before-GREEN: a real assertion (`test_unreachable_scope_contributes_no_narrowing`) went red against the shipped router, then green after the fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] resolve route violated D-113-5 (unreachable folder_scope narrowed instead of no-op)**
- **Found during:** Task 2 (`test_113_view_folder_scope.py::test_unreachable_scope_contributes_no_narrowing` went RED).
- **Issue:** `resolve_project_subtree(root, user_id=caller)` ALWAYS includes the `root` id in its output (`_walk` starts `out = [rid]` unconditionally), even when `root` is a folder the caller can't see (a seeded global view pointing at another user's private folder). The route then applied `.in_("folder_id", [unreachable_root])`, narrowing the caller's docs to a folder they have none in → 0 matches. That is the exact opposite of D-113-5 ("unreachable `folder_scope` → silently ignored, resolves over the caller's full visible set"). The HTTP log showed `folder_id=in.(b4ef3657...)` zeroing the caller's own doc.
- **Fix:** After resolving the subtree, intersect it with the caller's VISIBLE folder ids (`fetch_visible_folders(supabase, caller)`); narrow only on the caller-visible reachable ids, and when the intersection is empty (unreachable scope), set `subtree = None` so no narrowing is applied. This is also defense-in-depth for VIEW-06: the resolve can never narrow on a folder the caller can't see.
- **Files modified:** `backend/app/api/document_views.py` (added `fetch_visible_folders` import + the intersection guard in `resolve_view`).
- **Commit:** `ebe0052c`

No Rule 2/3/4 deviations, no auth gates, no architectural changes.

## Known Stubs

None. The router is fully wired: CRUD persists + validates + audits, resolve composes the compiler + caller-scoped listing + folder-subtree. The `stale_fields` resolve-warning is intentionally NOT shipped (A2/D-113-10 → Phase 119, a named deferral, not a stub); the `document_management_enabled` gate is intentionally NOT added (A1 → 114 UI surface, 111/112 precedent).

## Threat Flags

None. The router introduces no security surface beyond the plan's `<threat_model>`: T-113-09 (per-viewer leak-safety — caller-scoped legs + the D-113-5 fix's caller-visible intersection), T-113-10 (404-not-403 — generic `HTTPException(404)` on every miss), T-113-11 (SC#4 injection — `.contains()` binds one `$1::jsonb`, proven live with the table intact), T-113-12 (field whitelist on create AND update), T-113-13 (is_global hard-set in the service), T-113-14 (cycle-guarded subtree reused, not re-derived), T-113-15 (every `.execute()` via `aexec`) are all mitigated as specified. The live two-user cross-user GLOBAL-view leak test (SC#3 / VIEW-06) is authored under VALIDATION.md and run in secure-phase — NOT here (the D-102/D-110-5 "static would false-green" lesson).

## Notes for Downstream Plans / Phases

- **Phase 114 (builder UI + sidebar)** consumes `POST/GET/PATCH/DELETE /document-views` + `GET /{id}/resolve`. The resolve response is `{documents:[DocumentResponse-shaped...], total:N}` (newest-first); the sidebar count is `total`. The `document_management_enabled` gate belongs at this UI surface (A1).
- **Phase 115 (agent-tool)** calls the resolve path from chat; the SC#10 4-axis cross-provider UAT is 115's gate (D-113-14 — not this phase).
- **secure-phase** must run the two-user cross-user GLOBAL-view leak test (SC#3/VIEW-06) LIVE against :54322 per VALIDATION.md §Manual-Only — the RLS/caller-scope label is NOT proof. This plan's `test_cross_user_miss_404` covers the 404-not-403 + private-view miss; the GLOBAL-view two-caller divergent-result-set assertion is the secure-phase addition.
- The `.contains("metadata", dict)` → `metadata @> $1::jsonb` wiring is now proven live (it was genuinely net-new app-wide — no prior `.contains()` call site). Future metadata-containment query sites can reuse this pattern.

## Self-Check: PASSED

- Files exist: `backend/app/api/document_views.py`, `backend/tests/integration/test_113_view_crud.py`, `backend/tests/integration/test_113_view_resolve.py`, `backend/tests/integration/test_113_view_folder_scope.py`, `backend/app/main.py` (modified) — all FOUND.
- Commits exist: `20c742a7`, `ebe0052c` — both FOUND in git log.
- Full suite: 16 passed (unit + 3 integration), exit 0; the three integration files alone: 9 passed, exit 0.

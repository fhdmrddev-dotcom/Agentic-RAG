---
phase: 113-virtual-folders-filter-compiler-equality-views-backend
verified: 2026-06-18T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification_resolved:
  - test: "Run the full Phase 113 test suite against live local Supabase (:54322)"
    expected: "16 passed (now 20 after WR-01/WR-02 hardening added 3 unit guards + 1 cross-user-invalid-filter integration test)"
    result: "PASS — orchestrator independently ran the suite against live :54322 twice: 16 passed pre-hardening, 20 passed post-hardening (exit 0). why_human ('verifier cannot run tests against :54322') resolved by the orchestrator."
review_findings_resolved: "WR-01 fixed (4fa47c9a), WR-02 hardened (d09dce81), IN-03 removed (c1ddec18); WR-03 deferred app-wide -> SEED-091 (95cbf459). See 113-REVIEW.md Resolution."
---

# Phase 113: Virtual Folders — Filter Compiler + Equality Views Backend Verification Report

**Phase Goal:** Land the saved-view data model and the one genuinely net-new component — a closed-registry filter-AST to parameterized-SQL compiler — proving equality/AND/folder-scope views compose the existing search_documents/list_documents query seam leak-safely.
**Verified:** 2026-06-18
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A saved view (name + filter_expr jsonb + optional folder_scope) persists and resolves live contents query-not-copy, so one document appears in multiple views with no duplication (VIEW-01/02) | VERIFIED | `document_view_service.create_view` inserts to `document_views` table with `filter_expr` as jsonb. `resolve_view` queries `documents` at resolve time — never copies rows. `test_query_not_copy_one_doc_two_views` in test_113_view_resolve.py asserts one doc appears in two distinct views. `test_order_and_count` asserts `total == len(documents)` from a live query. |
| 2 | A view can combine multiple equality conditions (AND) and optionally scope to a folder subtree; the filter-AST compiler uses a closed operator registry with field-whitelist + all literals bound as $n (no eval, no string interpolation) (VIEW-04/05) | VERIFIED | `compile_filter` in view_filter_compiler.py folds multiple `eq` conditions via `dict.update()` into one `metadata_filter` dict (AND-of-keys). `OPERATOR_REGISTRY` is a closed `dict[str, Callable]` with only `eq` registered. `_op_eq` returns `{field: value}` — the value is never interpolated. grep on `view_filter_compiler.py` confirms zero `eval`, `exec`, `.format()`, or f-string SQL. The resolve route applies `.contains("metadata", metadata_filter)` (line 244) — supabase-py binds this as `metadata @> $1::jsonb`. Folder scope wiring: `resolve_project_subtree` → `fetch_visible_folders` intersection → `.in_("folder_id", subtree)` only when set. `test_folder_scope_narrows_to_subtree` and `test_unreachable_scope_contributes_no_narrowing` cover both behaviors. |
| 3 | A globally-shared (is_global) view exposes its definition but resolves results/counts over each viewer's own visible set; cross-user miss returns 404-not-403; private-view-miss covered by integration tests (VIEW-06) | VERIFIED | Every `documents` query leg in `resolve_view` (lines 250-267) uses `.eq("user_id", caller)` and `get_globally_visible_folder_ids(supabase, caller)` — `view["user_id"]` appears in the code only in docstring/comments noting it is NOT used for the docs query. `get_view` uses `.or_("user_id.eq.{user_id},is_global.eq.true")` — miss returns `None` → router raises `HTTPException(404)` (never 403). `test_cross_user_miss_404` exercises GET/PATCH/DELETE/resolve of a private view by a non-owner, asserting 404 status codes. The two-user live cross-user GLOBAL-view leak test is intentionally deferred to secure-phase per ROADMAP SC#3 and VALIDATION.md — the structural per-caller scoping is verified by code inspection above. |
| 4 | An injection/SSTI attempt placed in a filter value is neutralized (parameterized — no SQL/template execution) (SC#4) | VERIFIED | `_op_eq` returns `{field: value}` with the value unchanged as a Python object. The resolve route binds via `.contains("metadata", metadata_filter)` which supabase-py maps to `metadata @> $1::jsonb`. Unit test `test_injection_value_neutralized` asserts byte-for-byte equality: `"'; DROP TABLE documents;-- {{7*7}} ${jndi:ldap://x}"` compiles to `{"document_type": "<payload>"}`. Integration test `test_injection_value_neutralized_live` asserts 0 matches AND the documents table is intact (row count unchanged, benign doc survives). |

**Score:** 4/4 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/document_view.py` | Pydantic AST (ViewCondition Literal["eq"] + ViewFilter Literal["and"]) + ViewCreate/Update/Response/ViewResolveResponse | VERIFIED | File exists (commit d213f2c3). Contains `ViewCondition(op: Literal["eq"])`, `ViewFilter(op: Literal["and"], conditions: list[ViewCondition] = [])`, all four req/resp models. `ViewResolveResponse` reuses `DocumentResponse` from `app.models.document` with `extra="allow"` untouched (112 CR-01 honored). |
| `backend/app/services/view_filter_compiler.py` | Closed OPERATOR_REGISTRY + @register_operator + compile_filter() + validate_fields() | VERIFIED | File exists (commit 7f450291). Contains `OPERATOR_REGISTRY: dict[str, Callable]`, `register_operator` decorator, `@register_operator("eq")`, `compile_filter` (returns `{}` on empty, `KeyError` fail-closed), `validate_fields` (rejects `_`-prefix unconditionally + unknown fields). No `eval`, `exec`, f-string SQL found. |
| `backend/app/services/document_view_service.py` | View CRUD (create/list/get/update/delete) cloning metadata_field_service.py | VERIFIED | File exists (commit 495979d0). `is_global=False` hard-set at line 70. Five `aexec(` wraps (lines 72, 82, 105, 119, 133). `get_view` uses `.or_(...is_global.eq.true)` at line 109. `update_view`/`delete_view` own-scoped via `.eq("user_id", str(user_id))`. |
| `backend/app/api/document_views.py` | /document-views router — CRUD + GET /{id}/resolve (per-viewer leak-safe) | VERIFIED | File exists (commit 20c742a7 + ebe0052c). `router = APIRouter(prefix="/document-views")` at line 64. `validate_fields` called on create (line 112) and update (line 158). `write_audit_entry(action_type="view.create")` at line 129. `resolve_view` at line 190-280 scopes all docs queries from `caller`. `.contains("metadata", metadata_filter)` only when non-empty (line 243-244). `is_latest=True` on both legs. |
| `backend/app/main.py` | document_views.router mounted (additive) | VERIFIED | Line 405: `document_views` in the `from app.api import (...)` tuple. Line 423: `app.include_router(document_views.router)` added beside `metadata_fields`. |
| `backend/tests/unit/test_113_view_filter_compiler.py` | 7 unit tests covering all compiler branches incl. SC#4 injection | VERIFIED | File exists (commit 5cdf747a). Contains all 7 named functions: `test_eq_compiles`, `test_and_folds_conditions`, `test_empty_filter_no_narrowing`, `test_unknown_op_rejected`, `test_unknown_field_rejected_at_save`, `test_underscore_field_excluded`, `test_injection_value_neutralized`. All imports inside test bodies. |
| `backend/tests/integration/test_113_view_crud.py` | Live CRUD + view.create audit row + 404-not-403 | VERIFIED | File exists (commit ebe0052c). Contains `test_create_writes_audit` (asyncpg SELECT on audit_log) and `test_cross_user_miss_404` (GET/PATCH/DELETE/resolve by User B → 404). PG_AVAILABLE skipif guard present. |
| `backend/tests/integration/test_113_view_resolve.py` | Live resolve correctness + newest-first + count + query-not-copy + injection 0-matches | VERIFIED | File exists. Contains `test_order_and_count`, `test_query_not_copy_one_doc_two_views`, `test_empty_filter_resolves_all_in_scope`, `test_only_latest_versions_resolve`, `test_injection_value_neutralized_live`. |
| `backend/tests/integration/test_113_view_folder_scope.py` | Live folder-subtree narrowing + unreachable-scope no-narrowing | VERIFIED | File exists. Contains `test_folder_scope_narrows_to_subtree` and `test_unreachable_scope_contributes_no_narrowing`. D-113-5 fix (visible-folder intersection) wired in router at lines 229-239. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `view_filter_compiler.py` | `app.models.document_view.ViewFilter` | `from app.models.document_view import ViewFilter` at line 38 | WIRED | Import confirmed at top of file; `compile_filter` and `validate_fields` accept `ViewFilter` typed arguments. |
| `view_filter_compiler.py` | registry-closed dispatch | `OPERATOR_REGISTRY.get(c.op) → raise KeyError on None` at lines 97-99 | WIRED | `fn = OPERATOR_REGISTRY.get(c.op)` + `if fn is None: raise KeyError(...)` confirmed in source. |
| `document_views.py` | `view_filter_compiler.validate_fields` | Called before create (line 112) and update (line 158) with live whitelist | WIRED | Both call sites confirmed. `ValueError` → `HTTPException(422)` mapped. |
| `document_views.py` | `documents` table (caller-scoped) | `.contains("metadata", metadata_filter)` over `caller`-scoped listing | WIRED | Line 244 confirmed. Only applied when `metadata_filter` is non-empty. Both own and global-folder legs use `.eq("user_id", caller)` / `get_globally_visible_folder_ids(..., caller)`. |
| `document_views.py` | `write_audit_entry(view.create)` | Fire-and-forget audit on create | WIRED | Line 129 confirmed; `action_type="view.create"` passes the existing VALID_ACTION_TYPES enum. |
| `document_views.py` | `resolve_project_subtree` | `folder_scope` → subtree LIST with visible-folder intersection | WIRED | Lines 231-239 confirmed. Result intersected with `fetch_visible_folders(supabase, caller)` to handle unreachable scope per D-113-5. |
| `document_views.py` | `main.py` include_router | `app.include_router(document_views.router)` at main.py line 423 | WIRED | Confirmed in main.py. Both import and include_router present. |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `resolve_view` endpoint | `merged` (list of documents) | `documents` table via `aexec(own)` + `aexec(glob)` caller-scoped queries | Yes — live Supabase queries, no static returns | FLOWING |
| `resolve_view` endpoint | `metadata_filter` | `compile_filter(flt)` from stored `filter_expr` jsonb | Yes — compiler produces a real dict from the stored AST | FLOWING |
| `resolve_view` endpoint | `subtree` | `resolve_project_subtree` then intersected with `fetch_visible_folders` | Yes — live folder walk, not hardcoded | FLOWING |
| `create_view` endpoint | created row | `document_view_service.create_view` → `aexec(insert)` | Yes — real DB insert, returns `result.data[0]` | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED for integration test behaviors (requires live :54322). The following static spot-checks were run:

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| Compiler has no eval/exec/f-string SQL | grep on `view_filter_compiler.py` for `eval\|exec\|\.format\(` | No matches found | PASS |
| Router scopes docs query from caller not view owner | grep `view\["user_id"\]` in `document_views.py` in `.eq()` context | No instances of `view["user_id"]` in any `.eq()` call — only appears in docstring/comments | PASS |
| `is_global` hard-set False in payload | grep `is_global` in `document_view_service.py` | Line 70: `"is_global": False` literal in insert payload | PASS |
| All `.execute()` wrapped in `aexec` in service | grep bare `.execute()` outside docstring in `document_view_service.py` | Only occurrence is inside module docstring (line 28), never in code body | PASS |
| Router mounted in main.py | grep `document.views` in `main.py` | Lines 405 and 423 confirmed | PASS |
| No TBD/FIXME/XXX markers in phase files | grep on all 4 source files | No matches found | PASS |

---

## Probe Execution

No `probe-*.sh` files declared in PLAN files or present under `scripts/*/tests/`. Step 7c: SKIPPED — no probes declared for this phase.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VIEW-01 | Plan 02, Plan 03 | User can save a metadata filter as a named view | SATISFIED | `create_view` persists to `document_views` table. `list_views` returns own+global. CRUD routes functional in router. |
| VIEW-02 | Plan 03 | View contents are live; one doc in multiple views, no duplication | SATISFIED | `resolve_view` queries `documents` at resolve time. `test_query_not_copy_one_doc_two_views` proves one doc appears in two views with `count==1` per view. |
| VIEW-04 | Plan 01, Plan 03 | User can combine multiple filter conditions (AND) | SATISFIED | `compile_filter` folds multiple `eq` conditions via `dict.update()` → one `{k1:v1, k2:v2}` dict. `test_and_folds_conditions` asserts. |
| VIEW-05 | Plan 02, Plan 03 | User can optionally scope a view to a folder subtree | SATISFIED | `folder_scope` stored as UUID. `resolve_project_subtree` + visible-folder intersection in resolve route. `test_folder_scope_narrows_to_subtree` confirms subtree narrowing. `test_unreachable_scope_contributes_no_narrowing` confirms D-113-5 behavior. |
| VIEW-06 | Plan 03 | User can share a view globally without exposing docs the viewer is not allowed to see | SATISFIED (structural; two-user live test deferred to secure-phase per ROADMAP SC#3) | Every `documents` query scoped from `caller`. `get_view` uses own-OR-global readability gate. 404-not-403 on miss. `test_cross_user_miss_404` covers private-view-miss. Two-user global-view leak test is a secure-phase obligation per VALIDATION.md — not a gap. |

VIEW-03 (range/date comparisons) — deferred to Phase 114, confirmed by REQUIREMENTS.md mapping.
VIEW-07 (agent tool) — deferred to Phase 115, confirmed by REQUIREMENTS.md mapping.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/models/document_view.py` | 47-56 | `ViewCreate.name: str` with no `min_length`/`max_length` | Info | An empty or unbounded name persists. Code review WR-04 already documents this. No functional blocker for the phase goal. |
| `backend/app/api/document_views.py` | 155-162 | Whitelist validation runs BEFORE ownership check in `update_view` | Warning (known) | A cross-user PATCH with a well-formed filter gets 404; with a bad filter gets 422. Code review WR-01 documents this as a small validity oracle. Routed to secure-phase. |
| `backend/app/services/document_view_service.py` | 85, 109 | `f"user_id.eq.{user_id},is_global.eq.true"` — trusted UUID interpolated into PostgREST DSL string | Warning (known) | Currently safe (Supabase JWT ensures clean UUID). Code review WR-02 documents this and recommends a UUID assertion guard. Routed to secure-phase. |
| `backend/app/api/document_views.py` | 88-94, `document_view.py:59-65` | `list_views` returns `user_id` (owner auth UUID) + `folder_scope` on global view rows | Warning (known) | Discloses cross-user identifiers on shared views. Code review WR-03. Routed to secure-phase. |
| `backend/app/services/view_filter_compiler.py` | 100 | `dict.update()` on duplicate `(field)` pairs → last-wins, silent | Info | Two `eq` conditions on the same field silently drop the first. Code review IN-01. Named extension point for Phase 114 to address. Not a functional blocker. |

None of the above are unresolved debt markers (no TBD/FIXME/XXX). All warnings are documented in 113-REVIEW.md and explicitly routed to secure-phase. None break a stated success criterion for this phase.

---

## Human Verification Required

### 1. Full Phase 113 Test Suite Against Live :54322

**Test:** From `backend/`, run:
```
venv/Scripts/python.exe -m pytest tests/unit/test_113_view_filter_compiler.py tests/integration/test_113_view_crud.py tests/integration/test_113_view_resolve.py tests/integration/test_113_view_folder_scope.py -v
```
**Expected:** 16 passed, 0 failed — 7 unit (compiler branches) + 2 CRUD (audit + 404-not-403) + 5 resolve (order/count, query-not-copy, empty filter, is_latest, injection) + 2 folder-scope (subtree narrowing, unreachable-scope no-narrowing). Exit code 0.
**Why human:** Integration tests require live local Supabase on :54322. The verifier cannot run tests against a live database.

---

## Gaps Summary

No gaps found. All four observable truths are verified against the actual codebase with structural evidence. All five required requirements (VIEW-01/02/04/05/06) are covered by substantive implementation. Key links are wired and data flows are live (not hardcoded). The five code review warnings are known findings explicitly routed to secure-phase and do not break any stated success criterion.

The only outstanding item is human execution of the test suite against live :54322 to confirm the 16 tests pass as reported by the executor (independently re-confirmed by the orchestrator per phase context).

---

_Verified: 2026-06-18_
_Verifier: Claude (gsd-verifier)_

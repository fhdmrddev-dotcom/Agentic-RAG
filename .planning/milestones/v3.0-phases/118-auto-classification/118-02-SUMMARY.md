---
phase: 118
plan: 02
subsystem: auto-classification
tags: [classification, crud, leak-safe, own-global, audit, wave-2]
requires:
  - "app.services.classification_rule_service (NET-NEW this plan — leak-safe CRUD)"
  - "app.models.classification_rule.RuleCreate/RuleUpdate/RuleResponse (Plan 01)"
  - "app.services.view_filter_compiler.validate_fields / validate_operands (reused verbatim)"
  - "app.services.document_view_resolver._build_field_meta (whitelist + number-field builder, reused)"
  - "app.services.audit_service.write_audit_entry (classification.rule.create enum LIVE)"
provides:
  - "classification_rule_service.{create,list,get,update,delete}_rule (own+global, is_global hard-false)"
  - "GET/POST/PATCH/DELETE /classification-rules (leak-safe CRUD router, uniform 404-not-403)"
  - "main.py mount of classification_rules.router"
affects:
  - "Plan 03 (the ingest splice reads classification_rules own+global; accept/dismiss endpoints)"
  - "Plan 05/06 (the on-doc chip + rules-page UI consume this CRUD surface via the Plan-04 client seam)"
tech-stack:
  added: []
  patterns:
    - "Leak-safe own+global CRUD clone of document_view_service (is_global hard-false, _uid UUID-coercion guard)"
    - "Ownership-before-validation on UPDATE (no 422-vs-404 ordering oracle)"
    - "Route returns RuleResponse instances so the live integration tests can call coroutines directly"
key-files:
  created:
    - "backend/app/services/classification_rule_service.py"
    - "backend/app/api/classification_rules.py"
  modified:
    - "backend/app/main.py"
    - "backend/tests/integration/test_118_rule_crud.py"
decisions:
  - "Route functions wrap the service dict in RuleResponse(**row) (not a bare dict return like document_views) because the live CRUD tests call the coroutines DIRECTLY and read .is_global/.id/.enabled — FastAPI response_model serialization is bypassed when the coroutine is awaited outside the HTTP stack"
  - "The service is imported as a module (classification_rule_service.create_rule) so the route function create_rule does not shadow the service function of the same name"
  - "The 5 stale xfail(strict=False, reason='Plan 02 ships the router') markers in test_118_rule_crud.py were REMOVED so the tests are genuinely GREEN, not silently xpassing (an xpass would mask a future regression)"
metrics:
  duration: "~30 min"
  completed: "2026-06-21"
  tasks: 2
  files_created: 2
  files_modified: 2
  commits: 2
---

# Phase 118 Plan 02: `/classification-rules` CRUD Surface Summary

Shipped CLASS-01 — the `/classification-rules` CRUD surface as a near-verbatim clone of the
Phase 113 `document_view_service.py` + `document_views.py` (CRUD half only; no resolve routes).
It inherits the battle-tested leak-safe contract: `is_global` hard-set false on create,
own+global reads via `.or_()` with the `_uid()` UUID-coercion guard, own-scoped update/delete,
uniform 404-not-403 on every cross-user miss, and `match_expr` validation via the same two
validators the views router runs. The `enabled` toggle rides the UPDATE path (no new endpoint).
A `classification.rule.create` audit row (enum already LIVE) is written after create.

## What Was Built

### Task 1 — `classification_rule_service.py` (commit `6abc546d`)

A verbatim clone of `document_view_service.py` with `_TABLE = "classification_rules"`:

- **`_client` / `_uid`** copied unchanged — `_uid` coerces `user_id` to a canonical UUID string
  before it is interpolated into the sole `.or_()` owner-scoping grammar (the service-role client
  bypasses RLS, so these app-level predicates are the SOLE gate; a non-UUID raises `ValueError`
  rather than breaking out of the `user_id.eq.<...>` term — T-118-02-03).
- **`create_rule`** HARD-SETS `is_global: False` and `enabled: True` in the inserted payload —
  never from the caller (T-118-02-01; RLS WITH CHECK forces `is_global` too — defense-in-depth).
- **`list_rules`** returns own+global via `.or_(f"user_id.eq.{_uid(user_id)},is_global.eq.true")`
  with the dedupe-by-id loop preserved.
- **`get_rule`** is own-OR-global → `None` (router maps to 404, no existence leak).
- **`update_rule` / `delete_rule`** are STRICTLY own-scoped (`.eq("user_id", caller)`) → `None`/`False`
  on a cross-user miss → router 404. The `enabled` toggle is a plain UPDATE column (rides `update_rule`).
- All DB access via `aexec` (async, D-v2.5-01).

### Task 2 — `classification_rules.py` router + `main.py` mount (commit `98c4a845`)

The router clones the `document_views.py` CRUD half (skips the resolve routes — a rule is evaluated
on upload by the Plan-03 ingest splice, not resolved on demand):

- **`router = APIRouter(prefix="/classification-rules", tags=["classification-rules"])`** mounted in
  `main.py` after `document_relationships.router`.
- **CREATE + UPDATE validate `match_expr` BEFORE the write** via a shared `_validate_match_expr`
  helper that builds the whitelist with `_build_field_meta(current_user["id"], supabase)` and runs the
  SAME `view_filter_compiler.validate_fields(...)` + `validate_operands(...)` the views router runs,
  mapping `ValueError → HTTPException(422)`. A `_`-prefixed/unknown field → 422; a malformed operand
  (empty `one_of`, missing `between` bound, range op on a custom number field, missing scalar) → 422.
- **UPDATE checks ownership FIRST** (clone of `document_views.py:154-162`): `get_rule` (own-OR-global)
  then a STRICT `existing.user_id == caller` check, so an unowned/absent id uniformly 404s regardless of
  whether the submitted `match_expr` is valid — no 422-vs-404 ordering oracle. A global rule the caller
  does not own is not updatable.
- **Uniform 404, never the forbidden status** on every cross-user/unseeable/absent miss
  (`grep -c "403"` on the router == 0 — the comment prose was reworded away from the literal `403`
  string per the plan's strict acceptance grep, matching the 113/116 precedent; behavior unchanged).
- **`classification.rule.create` audit row** fired after a successful create (fire-and-forget;
  `write_audit_entry` swallows errors, so the live DB round-trip is the verification — the enum is
  already in `VALID_ACTION_TYPES`).
- Routes return `RuleResponse` instances and the module re-exports `RuleCreate/RuleUpdate/RuleResponse`
  so the live integration tests can construct bodies as `classification_rules.RuleCreate(...)` and call
  the coroutines directly, reading `.is_global` / `.id` / `.enabled`.
- `RuleResponse` carries no document `metadata`, so the typed response model is IN-03-safe (the 112
  CR-01 / 113 IN-03 lesson).

## Verification

- `pytest tests/integration/test_118_rule_crud.py tests/unit/test_118_rule_validation.py -q` →
  **13 passed** live on :54322 (5 CRUD + 8 validation), zero xfail/xpass.
  - `test_create_hard_sets_is_global_false` — create returns `is_global=False`.
  - `test_create_writes_rule_create_audit` — a `classification.rule.create` row lands live in `audit_log`.
  - `test_validate_fields_rejects_underscore_prefix_422` — a `_confidence` field → 422.
  - `test_cross_user_update_404_not_403` — B updating A's private rule → 404, never 403.
  - `test_enable_toggle_rides_update` — `enabled` flips false via the UPDATE path.
- `pytest -k "118 or 113" -q` → **52 passed, 8 xfailed, 4 xpassed, 0 failed** (the 8 xfailed are the
  Plan-03 ingest/accept/dismiss/leak scaffolds; the 4 xpassed are pre-existing in the 113 suite — the
  shared validators are behavior-untouched).
- Acceptance greps:
  - `grep '"is_global": False'` in `create_rule`; `grep "is_global.eq.true"` in `list_rules` + `get_rule`;
    `grep '.eq("user_id"'` in `update_rule` AND `delete_rule`.
  - `grep "validate_fields"` AND `grep "validate_operands"` both match in the router.
  - `grep -c "403"` on the router == **0**.
  - `grep "classification.rule.create"` matches (audit after create).
  - `grep "classification_rules.router"` matches in `main.py` (mounted); runtime check confirms all 4 CRUD
    routes registered.
- **Net-new failures = 0:** both source files are net-new (imported only by the net-new 118 router/tests +
  the `main.py` mount). `main.py` is additively touched (one import line widened + one `include_router`
  added); the 3 `test_lifespan.py` failures reproduce IDENTICALLY at base `main.py` (verified via
  `git show HEAD:...main.py` checkout — 3 failed both with and without the plan) — pre-existing rot
  documented across 110/111-03/116.
- `threads.py` byte-untouched (G-5; `git diff` empty).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Router returns `RuleResponse` instances, not bare dicts**
- **Found during:** Task 2
- **Issue:** The clone-target `document_views.py` route functions `return created` (a plain dict) and
  rely on FastAPI's `response_model` to serialize at the HTTP boundary. But `test_118_rule_crud.py` calls
  the route coroutines DIRECTLY (`await router_mod.create_rule(...)`) and reads `created.is_global` /
  `.id` / `.enabled` as attributes — a plain dict has no such attributes, so the test would `AttributeError`.
- **Fix:** Each route wraps the service dict in `RuleResponse(**row)` before returning. FastAPI serializes
  these identically at the HTTP boundary, so the live behavior is unchanged.
- **Files modified:** `backend/app/api/classification_rules.py`
- **Commit:** `98c4a845`

**2. [Rule 1 - Bug] Reworded the literal `403` string out of router comments/docstrings**
- **Found during:** Task 2 (acceptance grep)
- **Issue:** The plan's acceptance criterion is a strict literal-substring check: `grep -c "403"` must be 0
  (to prove no `status_code=403` anywhere). The "NEVER 403 — no existence leak" comments tripped it (6 matches).
- **Fix:** Reworded each to "NEVER the forbidden status" (matching the exact 113/116 precedent). No behavior
  change — every cross-user/unseeable miss still raises `HTTPException(status_code=404, ...)`.
- **Files modified:** `backend/app/api/classification_rules.py`
- **Commit:** `98c4a845`

**3. [Rule 3 - Blocking] Removed 5 stale `xfail` markers from `test_118_rule_crud.py`**
- **Found during:** Task 2
- **Issue:** The Plan-01 CRUD scaffold marked its 5 tests `@pytest.mark.xfail(strict=False, reason="Plan 02
  ships the /classification-rules router")`. With the router now shipped, those tests pass — but
  `strict=False` reports a passing-but-marked test as `xpassed`, silently masking any future regression
  (a broken test would xfail and the suite would still exit 0).
- **Fix:** Removed the 5 stale markers so the tests are genuinely GREEN. This is the intended "flip GREEN"
  the Plan-01 SUMMARY described ("Plans 02/03 flip them GREEN").
- **Files modified:** `backend/tests/integration/test_118_rule_crud.py`
- **Commit:** `98c4a845`

### Process Note (not a code deviation)

While proving net-new-failures==0 for `main.py`, a `git stash push -- app/main.py` was used to swap in the
base file for the regression comparison. The shared-worktree stash hazard (the stash list is global across
the main checkout and all linked worktrees) plus a linter re-sync left `main.py` reverted to base after the
comparison — the router mount was momentarily lost. Recovered WITHOUT `git stash pop` (per the
destructive-git prohibition): dropped the stash (confirmed it contained ONLY my own `main.py` mount edits)
and re-applied the two edits by hand via `Edit`. Final state re-verified: mount present, runtime route check
green, 13/13 tests green. No work lost. Lesson reinforced: prefer `git show <ref>:<path>` for base-file
inspection over `git stash` inside a repo that may have linked worktrees.

## Known Stubs

None. The two new source files contain no `TODO`/`FIXME`/placeholder/empty-collection-to-UI stubs
(grep-verified). The 8 remaining `xfail` 118 integration scaffolds (`test_118_ingest_suggest.py`,
`test_118_accept.py`, `test_118_dismiss_undo.py`, `test_118_rule_leak.py`) are intentional Plan-03 Wave-0
scaffolds — NOT stubs of this plan; Plan 03 (ingest splice + accept/dismiss endpoints) flips them GREEN.

## Self-Check: PASSED

- Both created files exist on disk (`classification_rule_service.py`, `classification_rules.py` — verified with `[ -f ]`).
- Both task commit hashes (`6abc546d`, `98c4a845`) present in git history (verified with `git log | grep`).

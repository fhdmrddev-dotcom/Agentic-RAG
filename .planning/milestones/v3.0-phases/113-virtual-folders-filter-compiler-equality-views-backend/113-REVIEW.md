---
phase: 113-virtual-folders-filter-compiler-equality-views-backend
reviewed: 2026-06-18T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - backend/app/api/document_views.py
  - backend/app/main.py
  - backend/app/models/document_view.py
  - backend/app/services/document_view_service.py
  - backend/app/services/view_filter_compiler.py
  - backend/tests/integration/test_113_view_crud.py
  - backend/tests/integration/test_113_view_folder_scope.py
  - backend/tests/integration/test_113_view_resolve.py
  - backend/tests/unit/test_113_view_filter_compiler.py
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: resolved
---

# Phase 113: Code Review Report

**Reviewed:** 2026-06-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** resolved (2026-06-18 — see Resolution below)

## Resolution (2026-06-18)

Each WARNING was adversarially re-verified against the live code (workflow `wf_771026c7-211`, 5 agents) before action, then resolved:

| Finding | Verified severity | Action | Commit |
|---|---|---|---|
| **WR-01** update_view 422-vs-404 ordering | **info** — NOT actually an oracle (the branch is a pure function of the caller's own filter vs their own whitelist; carries zero info about the target row, so SC#3's uniform-404 already held). | Fixed anyway for contract-by-construction + 112-analog consistency: own-scoped 404 now precedes filter validation; added live `test_cross_user_invalid_filter_patch_404`. | `4fa47c9a` |
| **WR-02** `user_id` → `.or_()` interpolation | **low** — not reachable today (`user_id` is a server-validated JWT-subject UUID), but the one unparameterized runtime-value-into-DSL spot on a service-role (RLS-bypassed) gate. | Hardened: `_uid()` wraps `user_id` in `UUID(...)` before both `.or_()` sites; added 3 `_uid` unit guards. | `d09dce81` |
| **WR-03** global-view owner-id leak | **low** — real but pre-existing **app-wide** (global folders + skills disclose owner `user_id` identically); opaque UUIDs only; does NOT undercut SC#3. | Deferred app-wide (fixing only views would be inconsistent) → **SEED-091** with concrete re-open triggers (v3.2 Multi-Tenancy / non-opaque owner field / audit). | `95cbf459` |
| **IN-03** dead `ViewResolveResponse` model | quality — a 112-CR-01 metadata-strip landmine one import from the resolve route. | Removed the dead model + now-unused `DocumentResponse` import. | `c1ddec18` |

IN-01/02/04 reviewed and deferred (IN-01 is a semantic no-op under the shipped eq/and-only scope, owned by Phase 114's additive operators; IN-02 self-admits "Fix: None required"; IN-04's security-load-bearing lines are covered by the WR-02 fix). Full suite re-ran green after the changes: **20 passed** live against :54322 (7 compiler unit + 3 service-guard unit + 3 CRUD + 5 resolve + 2 folder-scope).

## Summary

Phase 113 ships a filter-AST → `metadata @> $1::jsonb` compiler, owner-scoped saved-view CRUD, and a per-viewer leak-safe resolve endpoint. I reviewed the five net-new source files plus the four test files, and cross-referenced the called dependencies (`view_filter_compiler`, `document_view_service`, `folder_utils.get_globally_visible_folder_ids` / `fetch_visible_folders`, `harness/scope.resolve_project_subtree`, `utils/db.aexec`, `dependencies.get_current_user`) and the migration 071 RLS/DDL.

**The four headline security claims hold under inspection:**

1. **Injection / SSTI (SC#4):** The compiler is a pure module — no `eval`, no `getattr`, no `.format()`/f-string into SQL, no dynamic import. The `eq` path produces a plain `{field: value}` dict; the attacker-controlled *value* is later bound by supabase-py `.contains("metadata", dict)` → `metadata @> $1::jsonb`, never string-interpolated. The live injection test (`test_injection_value_neutralized_live`) and the unit byte-equality test confirm the payload rides as a literal. Field names are gated by a save-time whitelist (built-ins ∪ enabled custom defs) and an unconditional `_`-prefix reject. Unknown ops fail closed at two layers (Pydantic `Literal` at parse + registry `KeyError` at compile). **No injection vector found.**

2. **VIEW-06 cross-user leak:** Every documents query leg in `resolve_view` is scoped from `caller` (`.eq("user_id", caller)` for the own leg; `get_globally_visible_folder_ids(supabase, caller)` for the global leg). `view["user_id"]` is read *only* for the readability gate (`get_view`), never in a documents query. The folder subtree is resolved owner-scoped to `caller` and intersected with the caller's visible folders. **The caller-scope invariant is intact in code.** (The live two-user proof correctly lives in secure-phase per the VALIDATION.md plan.)

3. **404-not-403:** `get_view` / `update_view` / `delete_view` collapse a cross-user/unseeable miss to `None`/`False`, and all four router handlers raise a generic `HTTPException(404)`. No 403 path exists. The live `test_cross_user_miss_404` exercises GET/PATCH/DELETE/resolve.

4. **`is_global` hard-set False + `aexec`:** `create_view` hard-sets `is_global=False` (the body has no such field; `ViewUpdate` has none either, so PATCH cannot escalate). Every `.execute()` rides `aexec` (run_in_threadpool) — no blocking supabase call in an async handler (D-v2.5-01 honored).

The findings below are robustness, information-exposure, and quality issues — none defeats the core scoping guarantees, hence no BLOCKER. The two highest-value items are the validation-before-authorization ordering in `update_view` (WR-01, a subtle validity oracle) and the unparameterized `.or_()` PostgREST filter string (WR-02, currently safe only because the interpolated value is a trusted UUID).

## Warnings

### WR-01: `update_view` runs whitelist validation BEFORE the ownership check — leaks a validity oracle on cross-user ids

**File:** `backend/app/api/document_views.py:155-172`
**Issue:** When a PATCH carries a `filter_expr`, the handler builds the caller's whitelist and runs `validate_fields` (which can raise → **422**) *before* `document_view_service.update_view` runs the own-scoped UPDATE (which returns `None` → **404**). Two callers patching the *same* `view_id` they do not own get different responses depending only on whether the filter fields happen to be valid: a well-formed filter → 404, a malformed/unknown-field filter → 422. That is a small information-disclosure oracle (the phase's own design goal is "every cross-user/unseeable miss collapses to a generic 404, NEVER 403 — no existence leak", `document_views.py:10-12`). It also wastes a DB round-trip (`_build_whitelist` lists field definitions) on a request that will 404. The 112 PATCH-metadata analog (`documents.py:1380-1396`) deliberately verifies row ownership *first*, then validates the field — this handler inverts that order.
**Fix:** Verify ownership before validating, e.g. fetch/own-scope the row first (or move validation after the update miss), so an unowned id always 404s before any field-validity branch:
```python
# Re-validate only AFTER confirming the row is the caller's, so a cross-user
# miss is a uniform 404 regardless of filter validity (matches documents.py:1380).
if body.filter_expr is not None:
    whitelist = await _build_whitelist(current_user["id"], supabase)
    try:
        view_filter_compiler.validate_fields(body.filter_expr, whitelist)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    data["filter_expr"] = body.filter_expr.model_dump()
...
updated = await document_view_service.update_view(...)
if updated is None:
    raise HTTPException(status_code=404, detail="View not found")
```
The minimal fix is to keep validation where it is but document/accept the 422-before-404 ordering; the stronger fix is an explicit `get_view` ownership pre-check (own-only, not own-OR-global, since update is own-scoped) before validation.

### WR-02: PostgREST `.or_()` filter strings interpolate `user_id` directly — fragile, parameterized only by trust

**File:** `backend/app/services/document_view_service.py:85,109` (and the cloned `metadata_field_service.py:43`)
**Issue:** `get_view` / `list_views` build their readability predicate via an f-string: `.or_(f"user_id.eq.{user_id},is_global.eq.true")`. The value is interpolated into the PostgREST filter grammar with no quoting/escaping. It is **currently safe** only because `user_id` originates from `get_current_user` → `response.user.id` (a Supabase-issued JWT subject UUID, not free-form client input). But this is the one place in the new code that mixes a runtime value into a query DSL string, and the safety is entirely external (depends on the auth provider always returning a clean UUID and on no future caller passing an unvalidated id). A value containing a PostgREST control char (`,`, `(`, `.`, `:`) would re-shape the OR predicate — e.g. a crafted id could widen the disjunction. This mirrors the documented `main.py:102-109` lesson ("allowset for column names prevents SQL injection from crafted JSON keys").
**Fix:** Defense-in-depth — assert the id is a UUID before it reaches the filter string, since both call sites already receive it from the router:
```python
from uuid import UUID
def _uid(user_id) -> str:
    return str(UUID(str(user_id)))  # raises ValueError on anything non-UUID
...
.or_(f"user_id.eq.{_uid(user_id)},is_global.eq.true")
```
This is a service-wide pattern (`metadata_field_service`, skills) — flagging here because Phase 113 reuses it on a security-load-bearing readability gate; consider a shared helper.

### WR-03: Global views expose the owner's `user_id` (and full filter/scope) to every other user

**File:** `backend/app/api/document_views.py:88-94`, `backend/app/models/document_view.py:59-65`, `backend/app/services/document_view_service.py:76-94`
**Issue:** `list_views` returns own + `is_global=true` rows, and `ViewResponse` serializes `user_id` (the owner's auth UUID), `filter_expr`, and `folder_scope` verbatim. For a *global* view, every caller therefore receives the seeding owner's `user_id` and that owner's `folder_scope` UUID. The phase's leak-safety story is carefully about *document* rows in resolve, but the view-list surface itself discloses cross-user identifiers for shared views. A `folder_scope` UUID that points at the owner's private folder is also leaked to non-owners (it contributes no narrowing for them per D-113-5, but the id is still disclosed). This is an information-exposure, not a privilege-escalation.
**Fix:** Null/omit owner-identifying fields on global rows the caller does not own, e.g. in `list_views` (router or service):
```python
for v in views:
    if v.get("is_global") and str(v["user_id"]) != caller:
        v["user_id"] = None          # don't leak the owner's auth id
        v["folder_scope"] = None      # don't leak the owner's private folder id
```
`ViewResponse.user_id` is already `str | None`, so nulling it is shape-compatible.

### WR-04: `name` accepts empty / whitespace-only / unbounded strings — no validation at create or update

**File:** `backend/app/models/document_view.py:47-56`, `backend/app/api/document_views.py:97-135`
**Issue:** `ViewCreate.name: str` and `ViewUpdate.name: str | None` have no `min_length`, no `max_length`, no strip. A caller can create a view named `""` or a multi-megabyte string; both persist (the DB column is unbounded `text NOT NULL`, migration 071:50). An empty name is then echoed into the `view.create` audit metadata (`document_views.py:132`) and rendered in any 114 UI. The 111 field-def clone validates `field_key` shape; this clone dropped name validation.
**Fix:** Constrain the field on the model:
```python
from pydantic import Field
class ViewCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    ...
class ViewUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
```
(Pydantic rejects empty/oversized at parse → 422, before any DB write.)

### WR-05: Resolve does not re-validate stored filter fields against the *current* whitelist — a since-disabled custom field still filters

**File:** `backend/app/api/document_views.py:211-216`
**Issue:** `resolve_view` reconstructs the stored AST and calls `compile_filter` only — it never re-runs `validate_fields`. The docstring in `view_filter_compiler.validate_fields` (`view_filter_compiler.py:110-112`) claims a "field valid-at-save but later deleted naturally matches zero docs via `@>` at resolve — non-fatal." That is true for a *deleted custom def* (the metadata key simply won't be present, so `@>` matches nothing). But it means a view saved against a custom field that is later **disabled** (not deleted) keeps filtering on a metadata key the user explicitly turned off — the view silently behaves as if the field were still enabled. This is a correctness/expectation gap, not a leak (it only ever *narrows* the caller's own docs). It is consistent with the documented design, so flagged as a WARNING for visibility rather than a defect to block on.
**Fix:** If "disabled field stops filtering" is the intended semantic, either (a) re-run `validate_fields` at resolve and drop/skip non-whitelisted conditions instead of erroring, or (b) explicitly document in the resolve handler that disabled-but-not-deleted fields continue to narrow until the view is edited. At minimum, add a code comment at `document_views.py:214` clarifying that no current-whitelist re-check happens at resolve, so a future reader does not assume one.

## Info

### IN-01: `compile_filter` `.update()` silently last-wins on duplicate fields under `op:and`

**File:** `backend/app/services/view_filter_compiler.py:96-101`
**Issue:** Two conditions on the same field — `eq(document_type, "a")` AND `eq(document_type, "b")` — fold via `dict.update()` into `{"document_type": "b"}`: the first condition is silently dropped, not ANDed. For `eq`-only/`@>`-containment this is arguably correct (a key can't equal two values), but it is silent. When Phase 114 adds `one_of`/`contains`, a duplicate-field collision could mask a real condition.
**Fix:** Either document the last-wins fold explicitly at line 100, or reject duplicate `(field)` pairs in `validate_fields` so the save-time error is loud rather than a resolve-time surprise.

### IN-02: `_build_whitelist` is rebuilt on every create/update (extra list-defs round-trip)

**File:** `backend/app/api/document_views.py:72-85,110,156`
**Issue:** Each create and each filter-bearing update calls `list_field_definitions` to assemble the whitelist. Functionally correct; noted only because the same call is then duplicated should a future handler need it. Not a performance finding per v1 scope — purely a structural observation.
**Fix:** None required; if the call count grows, consider memoizing per-request.

### IN-03: Resolve route's plain-dict return is intentionally un-modeled — keep `ViewResolveResponse` in sync or remove it

**File:** `backend/app/api/document_views.py:190-280`, `backend/app/models/document_view.py:68-73`
**Issue:** `resolve_view` deliberately returns a bare `{"documents": [...], "total": N}` with **no** `response_model` (the 112 CR-01 `extra="allow"` preservation lesson — correct and well-documented). But the module also defines `ViewResolveResponse` (`document_view.py:68-73`) which is never wired to any route. A future maintainer could attach it to the resolve route "to add typing" and silently reintroduce the exact `extra="ignore"` strip the comment warns against.
**Fix:** Either remove the unused `ViewResolveResponse` model, or add an explicit comment on it stating it must NOT be used as the resolve `response_model` (cross-link to `document_views.py:35-39`).

### IN-04: `create_view` / `update_view` `user_id` params are untyped (`user_id` with no annotation)

**File:** `backend/app/services/document_view_service.py:50,76,97,114,130`
**Issue:** Every service function takes `user_id` with no type annotation (the router passes `current_user["id"]`, a str; tests pass a `UUID`). `create_view` coerces via `str(user_id)`, but `get_view`/`update_view`/`delete_view` interpolate or `.eq()` the raw value — a `UUID` vs `str` mismatch is tolerated only because supabase-py stringifies. Minor type-consistency gap at the module boundary.
**Fix:** Annotate `user_id: str | UUID` and normalize once (`str(user_id)`) at the top of each function for consistency with `create_view`.

---

_Reviewed: 2026-06-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

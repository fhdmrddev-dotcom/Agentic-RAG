---
phase: 114-virtual-folders-range-date-filters-view-builder-sidebar
reviewed: 2026-06-19T19:25:32Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - backend/app/api/document_views.py
  - backend/app/models/document_view.py
  - backend/app/services/view_filter_compiler.py
  - backend/app/services/view_operators_extra.py
  - frontend/src/components/ingestion/ConditionPopover.tsx
  - frontend/src/components/ingestion/DocumentList.tsx
  - frontend/src/components/ingestion/FilterBar.tsx
  - frontend/src/components/ingestion/FolderNode.tsx
  - frontend/src/components/ingestion/FolderTree.tsx
  - frontend/src/components/ingestion/NavRow.tsx
  - frontend/src/components/ingestion/RelativeDateControl.tsx
  - frontend/src/components/ingestion/ViewsGroup.tsx
  - frontend/src/lib/api.ts
  - frontend/src/pages/IngestionPage.tsx
  - frontend/src/types/index.ts
  - scripts/apply_migration_074.py
  - supabase/migrations/074_view_typed_columns.sql
findings:
  critical: 1
  warning: 7
  info: 6
  total: 14
status: resolved
resolved: 2026-06-20
resolution_commits: [eb187b32, e6feb1d3, 4da23739, 61bff2cc, 3d449d4d, 6ad107e2, 76e1c2e1]
---

> **RESOLUTION (2026-06-20):** All findings addressed in a focused fix pass (operator-authorized).
> - **CR-01 (BLOCKER)** — `eb187b32`: new stateless `POST /document-views/resolve` (shared `_resolve_filter` core, no persist / no audit); api.ts rewired off the transient create/delete dance; double round-trip collapsed; 9 junk `__live_*` audit rows purged. **Live-proven:** exercising the builder's live count created 0 new `view.create` rows + 0 transient views.
> - **WR-01** — `e6feb1d3`: custom-number range ops rejected (422) instead of lexically-wrong (numeric `::` cast not cleanly expressible in postgrest 2.29; `date` exempt via `date_typed`); client `OPS_BY_TYPE.number` reduced.
> - **WR-02** — `e6feb1d3`: `validate_operands` rejects empty `one_of`, missing `between` bounds, missing scalars, non-numeric N (422 at create/update/resolve).
> - **WR-03** — `4da23739`: `older_than` now strict `.lt` (code + docstring agree); boundary test added.
> - **WR-05** — `61bff2cc`: server clamps span + guards `OverflowError`; client clamps N on edit.
> - **WR-06** — `eb187b32`: dropped bespoke `renameViewRequest` → uses `updateView`.
> - **WR-04** — `3d449d4d`/`76e1c2e1`: `fetchCount` no longer closes over `counts` (countsRef + functional updater).
> - **WR-07** — `3d449d4d`: rename-to-blank keeps editor open with a hint / explicit revert.
> - **IN-01/02/04** — `6ad107e2`: single-sourced `_lower`, dropped redundant `one_of` `value`, shared `EMPTY_FILTER`. IN-03/05/06 skipped (pre-existing / would require migration re-apply).
>
> Verification: backend 113/114 suite 71 passed / 1 intentional xfail (new `test_114_resolve_adhoc.py` proves zero audit/view writes); 66 frontend tests green; tsc clean. See `114-06-SUMMARY.md` for the phase record.
---

# Phase 114: Code Review Report

**Reviewed:** 2026-06-19T19:25:32Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 114 widens the Phase 113 virtual-folder filter compiler with VIEW-03 range/date/membership operators, ships a `GENERATED STORED` typed-column migration (074), and builds the no-DSL FilterBar / ConditionPopover / RelativeDateControl / ViewsGroup + shared NavRow UI.

The headline security claim — SC#4 (no SQL/SSTI injection in the resolve path) — holds up under tracing: every attacker-controlled VALUE rides as a bound PostgREST builder param (`.eq`/`.gte`/`.lte`/`.ilike`/`.in_`), field names on the custom leg are whitelisted constants re-validated at resolve, and the `is_empty` `.or_()` grammar string is built only from a whitelisted constant field plus HARD-CODED RHS literals. The VIEW-06 per-viewer leak boundary is also sound: every documents query leg is scoped from `caller`, never `view["user_id"]`, with a 404-not-403 readability gate and a caller-visible-subtree intersection on `folder_scope`. The two-user leak test backs this.

However, the review surfaces a **data-integrity / audit-pollution BLOCKER**: live ad-hoc filtering creates a real persisted `document_views` row AND fires a `view.create` governance audit row on **every debounced keystroke** (via `resolveFilterCount` and `resolveFilterIntoList`), then deletes the view — but the audit row is never cleaned up. Typing in the filter bar permanently floods the audit log with `__live_count_*` / `__live_list_*` entries and double-round-trips on each change.

Beyond that: a genuine correctness bug in custom-field numeric range filtering (lexical text comparison, not numeric), a relative-date off-by-one (`older_than` strict-vs-inclusive mismatch between docstring and SQL), a `one_of`-with-empty-list resolve crash risk, and several robustness/quality issues in the React layer.

## Critical Issues

### CR-01: Every filter keystroke persists a real view row AND an un-cleaned `view.create` audit entry (audit-log pollution + data integrity)

**File:** `frontend/src/lib/api.ts:2124-2138`, `frontend/src/pages/IngestionPage.tsx:189-215`, `backend/app/api/document_views.py:127-165`

**Issue:** The ad-hoc filter count (`resolveFilterCount`) and the ad-hoc list resolve (`resolveFilterIntoList`) both work by `createView(transient) → resolveView → deleteView(transient)`. `createView` is the real `POST /document-views` handler, which **unconditionally fires a `view.create` audit row** (`document_views.py:159-164`) capturing `view_id` + `name`. The subsequent `deleteView` removes the `document_views` row but **nothing removes the audit row** — `write_audit_entry` is fire-and-forget and there is no compensating `view.delete` cleanup.

Consequences, on every debounced keystroke (300ms) while a user builds a filter:
1. A `view.create` governance/audit row named `__live_count_<ts>` (and, separately, `__live_list_<ts>` from the page) is written and never removed. The audit log — a compliance surface (DMF-01) — fills with throwaway noise indefinitely.
2. `FilterBar` (`resolveFilterCount`) and `IngestionPage.handleFilterChange` (`resolveFilterIntoList`) fire **two independent** create→resolve→delete cycles for the **same** filter change, doubling the write/delete churn against the shared `document_views` table and doubling audit pollution.
3. A failed/cancelled `deleteView` (best-effort `.catch(() => {})`) leaves an orphan `document_views` row behind under a `__live_*` name that then shows up in `listViews()` and the Views sidebar.

This abuses a CRUD+audit endpoint as a stateless query endpoint. Audit rows are durable and security-relevant; silently generating one per keystroke is a data-integrity defect, not just a performance smell.

**Fix:** Add a dedicated stateless ad-hoc resolve/count endpoint that takes the `filter_expr` in the request body and never persists or audits (e.g. `POST /document-views/resolve` and `POST /document-views/count` accepting `{filter_expr, count_only}`), reusing the existing `compile_filter` + `_apply` + caller-scoping. Route `resolveFilterCount` / `resolveFilterIntoList` at it. If a transient-view approach must remain short-term, at minimum (a) suppress the `view.create` audit write for `__live_*`-prefixed transient views, and (b) collapse the page + bar into a single resolve path so one keystroke is one round-trip, not two. Example backend skeleton:
```python
@router.post("/resolve")  # stateless: no persist, no audit
async def resolve_adhoc(body: AdHocResolve, current_user=Depends(get_current_user), supabase=Depends(get_supabase)):
    whitelist = await _build_whitelist(current_user["id"], supabase)
    view_filter_compiler.validate_fields(body.filter_expr, whitelist)
    fragments = view_filter_compiler.compile_filter(body.filter_expr)
    # ...same _apply + caller-scoped own/global legs as resolve_view, no DB write, no audit...
```

## Warnings

### WR-01: Custom-field numeric range filters compare lexically, not numerically (wrong results)

**File:** `backend/app/services/view_operators_extra.py:52-97`, `backend/app/api/document_views.py:356-361`

**Issue:** For a custom `number` field, `gte`/`lte`/`between` produce `Fragment(leg="custom", field=field, builder="gte", value=value)`. `_apply` then runs `q.gte("metadata->>amount", value)`. The `->>` operator returns **text**, so PostgREST performs a lexical string comparison, not a numeric one. `amount >= 100` will match a stored `"9"` (because `"9" > "100"` lexically) and miss `"1000"` ordering relative to `"99"`. The ConditionPopover explicitly offers `gte`/`lte`/`between` for `number` fields (`ConditionPopover.tsx:49`), so this path is reachable by design. Date custom fields have the same lexical hazard, though ISO `YYYY-MM-DD` happens to sort correctly as text; numbers do not.

**Fix:** Cast the custom-leg selector to the field's type before comparison. PostgREST supports a typed cast in the column spec, e.g. `metadata->>amount::numeric` is not directly expressible via supabase-py builders, so either (a) promote numeric custom fields through a typed/cast leg analogous to the `date_typed`/`document_type_norm` columns, or (b) restrict range operators in `OPS_BY_TYPE.number` until numeric casting is implemented, or (c) build the comparison via a `.filter(col, "gte", value)` with an explicit `::numeric` cast in the column expression. Until fixed, custom-number range filters return silently incorrect document sets — a trust failure for the "N documents match" contract.

### WR-02: `one_of` with an empty membership list resolves to `.in_(col, [])` — PostgREST `in.()` is malformed/over-broad

**File:** `backend/app/services/view_operators_extra.py:101-113`, `backend/app/api/document_views.py:345-349`

**Issue:** `_op_one_of` does `raw = cond.values or []` and emits a Fragment with `values=lowered` even when the list is empty. `_apply` then calls `q.in_(col, frag.values or [])` → `q.in_(col, [])`. PostgREST renders an empty `in.()` filter, which is either a 400-level malformed query or (depending on version) a no-op that silently matches nothing/everything. The compiler does not reject an empty `one_of`, and `validate_fields` only checks field names, not operand presence. The client guards against this in the happy path (`canApply` requires a non-empty value), but the server is the trust boundary (per the file's own T-114-05-01 comment) and a hand-crafted `{op:"one_of", values:[]}` AST reaches `_apply` unchecked.

**Fix:** Validate operands per operator at compile time. For `one_of`, raise `ValueError` (→ 422) when `values` is empty/None; or in `_apply`, skip the fragment entirely (apply no narrowing) when `frag.values` is empty rather than emitting `.in_(col, [])`. Apply the same operand-presence check to `between` (both `value` and `value2` required), `gte`/`lte`/`before`/`after`/`eq`/`contains` (`value` required) — a missing scalar reaches `getattr(q, builder)(col, None)` today.

### WR-03: `older_than` resolves as `<=` (inclusive) but is documented/intended as `<` (strict) — off-by-one boundary

**File:** `backend/app/api/document_views.py:84-94`, `backend/app/services/view_operators_extra.py:155-161`

**Issue:** `_op_older_than`'s docstring says "document age `date < today-N` (D-114-4)" and `_relative_window` returns `(None, today - N)` consumed by `_apply` as `q.lte(col, high)` — i.e. `date <= today-N` (inclusive). A document dated exactly `today - N` is INCLUDED, contradicting the strict-`<` intent stated in the operator docstring. Similarly `within_next` uses `.gte(today).lte(today+N)` which is inclusive on both ends — fine for that operator, but the `older_than` boundary is a genuine spec/code mismatch. Whether the boundary doc is wrong or the SQL is wrong, they disagree, which is a correctness ambiguity that will surface as "a doc dated exactly N days ago unexpectedly shows / doesn't show."

**Fix:** Decide the contract and make code + docstring agree. If strict is intended, use `.lt(col, high)` for `older_than`; if inclusive is acceptable, fix the `view_operators_extra.py:157` docstring to read `date <= today-N`. The integration test (`test_114_resolve_range_date.py:241-247`) only asserts the bound VALUE, not the boundary inclusivity, so it would not catch this.

### WR-04: Stale closure on `counts` in `ViewsGroup.fetchCount` can suppress refetches

**File:** `frontend/src/components/ingestion/ViewsGroup.tsx:67-89`

**Issue:** `fetchCount` closes over `counts` (in its dependency array) and reads `counts[id] !== undefined`. The first-sight effect at lines 84-89 depends only on `[views]` (with the exhaustive-deps lint suppressed) and iterates calling `fetchCount(v.id)`. Because `fetchCount` is recreated on every `counts` change but the effect does not re-run on `fetchCount`/`counts` changes, the effect captures a specific `fetchCount` closure tied to a specific `counts` snapshot. In a render where `views` changes at the same time several counts resolve, the guard `counts[v.id] !== undefined` can read a stale `counts`, leading to either a redundant in-flight fetch (mitigated by the `inFlight` ref) or a skipped fetch for a newly added view whose id collided with a just-resolved one. The `inFlight` ref mostly papers over the redundant-fetch case, but the dependency wiring is fragile and the lint suppression hides it.

**Fix:** Make `fetchCount` not depend on `counts` by reading the latest counts from a ref or by using the functional updater to gate inside `setCounts`:
```ts
const fetchCount = useCallback((id, { force = false } = {}) => {
  if (inFlight.current.has(id)) return
  inFlight.current.add(id)
  resolveView(id, { count_only: true })
    .then(({ total }) => setCounts(prev => (force || prev[id] === undefined ? { ...prev, [id]: total } : prev)))
    .catch(() => {})
    .finally(() => inFlight.current.delete(id))
}, [])  // no `counts` dep
```

### WR-05: `RelativeDateControl` number input lets users commit a non-integer / clears-to-empty without clamping the committed value

**File:** `frontend/src/components/ingestion/RelativeDateControl.tsx:102-112`

**Issue:** The `<input type="number">` onChange parses with `parseInt(e.target.value, 10)` and clamps `NaN → 1`. But `parseInt("1.5") === 1` silently truncates a decimal the browser allowed, and a user clearing the field (`""` → `NaN → 1`) snaps the visible value to 1 mid-edit, which fights the user's cursor (they cannot transiently empty the field to retype). More importantly, the committed `value` is `Math.max(1, next)` but there is no upper bound — a user can enter `999999999` months, which the server turns into `n * 30` days and `today + timedelta(days=29999999970)`, which raises `OverflowError`/`OutOfRange` in Python's `date` arithmetic (`_relative_window`, `document_views.py:91`). That is an unhandled 500 reachable from the UI.

**Fix:** Clamp N to a sane maximum on both client and server. In `_relative_window`, bound `span` (e.g. cap at ~36500 days) and guard the `date + timedelta` against `OverflowError` (return an open bound or 422 on absurd input). On the client, allow a transient empty string in local state and only clamp on blur.

### WR-06: `IngestionPage.renameViewRequest` hand-rolls auth/fetch instead of the existing `updateView` helper — drift + missing CSRF/error parity

**File:** `frontend/src/pages/IngestionPage.tsx:55-73`

**Issue:** The page composes a bespoke `fetch(... PATCH /document-views/{id} ...)` with a manually-read `supabase.auth.getSession()` token, justified by a comment claiming "there is no client `updateView` helper and `api.ts` is outside this plan's file scope." But `updateView` **does** exist in `api.ts:2064-2076` (it is imported and used by `FilterBar.tsx:5`). This is dead-reasoning duplication: the page reimplements auth-header construction (diverging from `getAuthHeaders()` conventions used everywhere else), and uses `import.meta.env.VITE_API_BASE_URL` directly rather than the shared `API_BASE`. Two code paths to the same endpoint with different header/error handling is a maintenance and correctness hazard (e.g. if `getAuthHeaders` later adds a header, this path silently misses it).

**Fix:** Replace `renameViewRequest` with `updateView(id, { name })` from `@/lib/api`. Delete the bespoke fetch helper entirely.

### WR-07: `FolderTree.handleCommitRename` swallows empty-name as a silent cancel, but `NavRow` already trims to empty — rename-to-blank is a no-op with no feedback

**File:** `frontend/src/components/ingestion/FolderTree.tsx:59-70`, `frontend/src/components/ingestion/NavRow.tsx:129-139`, `frontend/src/components/ingestion/ViewsGroup.tsx:97-106`

**Issue:** `NavRow` commits `editValue.trim()` on blur/Enter. If the user clears the name and blurs, an empty string is committed. `FolderTree.handleCommitRename` treats `!newName` as a cancel (closes the editor, no rename), and `ViewsGroup.handleCommitRename` does `if (!name) return` after already calling `setEditingId(null)`. The net behavior is that renaming a folder/view to blank silently reverts with zero user feedback — the user sees their typed name vanish and the old name reappear with no explanation. Worse, on blur-triggered commit there is no way to distinguish "user intended to cancel" from "user fat-fingered a clear," so a legitimate edit-in-progress that momentarily empties can be lost.

**Fix:** On an empty commit, keep the editor open with a validation hint ("Name can't be empty") rather than silently closing it, or explicitly revert with a visible toast. At minimum document that blur-with-empty is treated as cancel so the behavior is intentional rather than incidental.

## Info

### IN-01: Duplicated `_lower` helper across two modules

**File:** `backend/app/services/view_filter_compiler.py:161-164`, `backend/app/services/view_operators_extra.py:42-44`

**Issue:** `_lower` is defined identically in both modules. Since `view_operators_extra` already imports several names from `view_filter_compiler`, the helper should be single-sourced to avoid drift (one could be patched and not the other).

**Fix:** Import `_lower` from `view_filter_compiler` in `view_operators_extra` (or hoist it to a shared util), and delete the duplicate.

### IN-02: `Fragment.value` for `one_of` is set redundantly to the membership list

**File:** `backend/app/services/view_operators_extra.py:113`

**Issue:** `_op_one_of` returns `Fragment(..., value=lowered, values=lowered)` — `value` is set to the full list even though the resolve route only reads `frag.values` for the `or_`/`in_` branch. Setting `value` to a list is misleading (every other operator's `value` is a scalar bound literal) and invites a future bug if someone reads `frag.value` expecting a scalar.

**Fix:** Drop `value=lowered`; carry the membership only in `values`.

### IN-03: `OPS_BY_TYPE` is keyed only by built-in field types; custom `enum` fields with `options` get the wrong operator set in some paths

**File:** `frontend/src/components/ingestion/ConditionPopover.tsx:45-51, 73-75`

**Issue:** `fieldType()` defaults unknown fields to `"string"`. A custom field def of type `enum` is mapped correctly via `field_type`, but the `BUILTIN_FIELDS` entry for `topics` is declared `string` (it is actually an array/multi-value field) and `document_type`/`language` are declared `string` though the backend treats them as normalized/enumerable. The operator vocabulary offered for `topics` (`eq`/`one_of`/`contains`/`is_empty`) will produce containment/ILIKE fragments that may not match an array-valued `topics` metadata field as the user expects.

**Fix:** Verify the `topics` field's actual storage shape (array vs string) and either give it an array-aware operator set or document the limitation. Low priority — pre-existing field-type modeling, not introduced cleanly by this phase.

### IN-04: `EMPTY_FILTER` constant duplicated across `FilterBar` and `IngestionPage`

**File:** `frontend/src/components/ingestion/FilterBar.tsx:29`, `frontend/src/pages/IngestionPage.tsx:40`

**Issue:** `const EMPTY_FILTER: ViewFilter = { op: "and", conditions: [] }` is declared in two files. Minor duplication; a shared constant would prevent divergence.

**Fix:** Export `EMPTY_FILTER` from a shared module (e.g. `@/types` or a `filters` util) and import in both.

### IN-05: `console.error` debug artifacts in production UI paths

**File:** `frontend/src/components/ingestion/FolderTree.tsx:68,85,106`, `frontend/src/components/ingestion/ViewsGroup.tsx:104,114`, `frontend/src/components/ingestion/DocumentList.tsx:206`

**Issue:** Several catch blocks log to `console.error` and otherwise swallow the error with no user-facing feedback (folder rename/delete/create failures, view rename/delete failures, reingest failure). The user sees nothing when these operations fail silently. This matches existing project patterns but leaves failures invisible.

**Fix:** Surface a toast or inline error on these failure paths rather than console-only logging. Consistency note, not a regression.

### IN-06: Migration relies on `EXCEPTION WHEN others` to swallow ALL errors in `view_iso_to_date`, masking non-date failures

**File:** `supabase/migrations/074_view_typed_columns.sql:92-94`

**Issue:** The plpgsql helper catches `WHEN others` and returns NULL. This correctly handles `DatetimeFieldOverflow` for calendar-invalid dates, but `WHEN others` also swallows genuinely unexpected errors (e.g. an out-of-memory or a future change to `make_date` signature), silently producing NULL `date_typed` for rows that should have parsed. The function is `IMMUTABLE STRICT` so the surface is small, but a narrower `WHEN datetime_field_overflow OR invalid_datetime_format` exception specifier would fail loud on truly unexpected errors.

**Fix:** Narrow the exception handler to the specific date-parse exceptions (`datetime_field_overflow`, `invalid_datetime_format`, `numeric_value_out_of_range`) so only expected bad-date conditions yield NULL. Low priority — defensive hardening of an already-bounded function.

---

_Reviewed: 2026-06-19T19:25:32Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

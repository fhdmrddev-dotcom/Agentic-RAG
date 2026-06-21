---
phase: 114-virtual-folders-range-date-filters-view-builder-sidebar
plan: 02
subsystem: backend / virtual-folders resolve route
tags: [VIEW-03, resolve-route, fragment-consumption, relative-date, server-clock, count-only, view-06, leak-safety, postgrest-builders]

# Dependency graph
requires:
  - phase: 114-01
    provides: "Fragment dataclass + compile_filter → list[Fragment] (R-114-A); the 10 additive VIEW-03 operators at the SEAM; PROMOTED_TYPED_COLUMNS leg map"
  - phase: 113
    provides: "the per-viewer leak-safe resolve_view two-leg own+global core (VIEW-06, 404-not-403); _build_whitelist; aexec; resolve_project_subtree"
provides:
  - "Widened resolve_view._apply consuming the list[Fragment] contract across typed/custom/containment legs — every value a bound PostgREST param (SC#4)"
  - "_relative_window helper: within_next/older_than windows derived from the server clock at resolve time (D-114-16), .gte(today) overdue-exclusion (D-114-5)"
  - "Phase-115 handoff docstring contract (reuse this resolver, never re-derive windows)"
  - "Additive count_only resolve mode: own+global DISTINCT id-set dedupe, no full-row materialization (D-114-15)"
  - "Resolve-time custom-leg field-name re-validation against the live whitelist (T-114-02-03 defense-in-depth)"
  - "The 4 broken test_113_view_resolve.py rows closed (01→02 contract-break handoff) by retargeting onto migration-free legs"
affects:
  - "Plan 03 — applies migration 074, then un-marks the typed-leg xfail rows in test_114_resolve_range_date.py + test_114_count_only.py (3 rows) and adds the EXPLAIN/bad-date live tests"
  - "Plans 05/06 (frontend) — call resolve (?count_only=1 for the live builder count + sidebar badges) and full resolve for the listing"
  - "Phase 115 (agent-tool) — reuses resolve_view / _relative_window for live-recompute relative windows for free (D-114-16)"

# Tech tracking
tech-stack:
  added: []  # zero new packages
  patterns:
    - "Fragment-walk dispatch in _apply: getattr(q, frag.builder)(col, value) for eq/gte/lte/ilike; .in_ for one_of membership (PostgREST quotes members → SC#4); .or_ with HARD-CODED tokens for is_empty; .contains for the @> containment fast path"
    - "Server-clock relative-date derivation INSIDE the resolve route (never baked at save, never on the client — Pitfall 6)"
    - "Count-only via .select('id') id-set union (own_ids | glob_ids) — NEVER .select('*') (silent >1000 undercount) and NEVER own.count+global.count (Pitfall 1 double-count)"
    - "JSON-path custom leg as metadata->>'field' selector with the field name from the whitelist (a constant), value bound as a param"

key-files:
  created:
    - backend/tests/integration/test_114_resolve_range_date.py
    - backend/tests/integration/test_114_count_only.py
  modified:
    - backend/app/api/document_views.py
    - backend/app/services/view_operators_extra.py
    - backend/tests/integration/test_113_view_resolve.py
    - backend/tests/unit/test_114_view_filter_compiler.py

key-decisions:
  - "is_empty Fragment carries a DISTINCT builder='is_empty' marker (was 'or_') so the resolve dispatch is unambiguous vs one_of's 'or_' membership — avoids a brittle sentinel check"
  - "The 113 resolve behavioral tests are retargeted onto migration-free legs (language/author) rather than xfail-marked, so they prove the contract-break is closed AND pass now"
  - "count_only ships as a query param on the SAME resolve_view route (shared compiled fragments + folder-scope + _apply), not a sibling route"

patterns-established:
  - "Two-leg-one-dispatch _apply: leg ∈ {typed,custom,containment} selects the column selector; builder names the supabase-py call; value rides as a bound param"
  - "Relative-date windows recompute every resolve from date.today() (server clock) — the Phase-115 live-recompute handoff"

requirements-completed: [VIEW-03]

# Metrics
duration: 35min
completed: 2026-06-19
---

# Phase 114 Plan 02: Widened Two-Leg Resolve + Server-Clock Relative Dates + Count-Only Mode Summary

**Turned the inert Plan-01 `list[Fragment]` contract into live, leak-safe, indexed-ready query behavior: a two-leg `_apply` that walks every VIEW-03 operator across the typed/custom/containment legs scoped from the caller, server-clock relative-date windows (overdue-excluding `within_next`), and an additive own+global DISTINCT count-only mode.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-19T14:50:00Z (approx)
- **Completed:** 2026-06-19T15:25:00Z
- **Tasks:** 2
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- Rewrote `resolve_view._apply` to consume the ordered `list[Fragment]` from `compile_filter`, dispatching each fragment to its supabase-py PostgREST builder across the **typed** (`document_type_norm`/`date_typed` constant column names), **custom** (`metadata->>'field'` whitelisted JSON path), and **containment** (`metadata @> {field: value}` `@>` fast path) legs — every value a bound param (SC#4). The two-leg own+global caller-scoping + DISTINCT dedupe is preserved identically (VIEW-06).
- Added `_relative_window` deriving `within_next`/`older_than` windows from `date.today()` at resolve time (D-114-16): `within_next` → `.gte(today).lte(today+N)` where the `.gte(today)` lower bound **excludes overdue** docs (D-114-5); `older_than` → `.lte(today-N)`; units days/weeks(×7)/months(×30). Documented the Phase-115 handoff: callers reuse this resolver, never re-derive.
- Added the additive `count_only` resolve mode (D-114-15): `.select("id")` on both legs, `len(own_ids | glob_ids)` — the own+global DISTINCT union that **counts an overlapping doc once** (a caller-owned doc inside a globally-visible folder), never the naive `own.count + global.count` double-count (Pitfall 1), never `.select("*")`.
- Added resolve-time custom-leg field re-validation against the live whitelist (a field deleted since save → 422, not a leaky selector).
- **Closed the 01→02 contract-break handoff:** the 4 broken `test_113_view_resolve.py` rows now PASS by retargeting onto migration-free legs (`language`/`author`).

## Task Commits

1. **Task 1: Widen `_apply` to two legs + server-clock relative-date derivation** - `077d2ea6` (feat)
2. **Task 2: Additive count-only resolve mode (own+global DISTINCT dedupe)** - `bfa50d6b` (test)

_Note: the `count_only` param + branch itself shipped inside the Task-1 `resolve_view` edit because the two tasks share one resolve function; `bfa50d6b` adds Task 2's dedicated live suite that exercises it. Both tasks' verification commands pass._

## Files Created/Modified
- `backend/app/api/document_views.py` — Widened two-leg `_apply` (Fragment walk), `_relative_window` server-clock helper, `count_only` query param + id-set-dedupe branch, resolve-time whitelist re-check, the Phase-115 handoff docstring.
- `backend/app/services/view_operators_extra.py` — `is_empty` now carries `builder="is_empty"` (was `"or_"`) so the resolve dispatch is unambiguous vs `one_of` membership.
- `backend/tests/integration/test_114_resolve_range_date.py` (new) — server-clock window math (5 GREEN), case-insensitive compiler legs (2 GREEN), live custom-leg resolve (title eq / contains / is_empty), VIEW-06 two-user leak-safety (4 GREEN live), and the typed-leg `document_type` eq + `within_next` rows (2 xfail until Plan 03).
- `backend/tests/integration/test_114_count_only.py` (new) — count==length, empty-filter full set, own+global overlap dedupe, caller-scoped leak-safety (4 GREEN live) + typed-leg count row (1 xfail until Plan 03).
- `backend/tests/integration/test_113_view_resolve.py` — retargeted the 4 `document_type`-leg rows onto migration-free `language`/`author` legs (5/5 GREEN).
- `backend/tests/unit/test_114_view_filter_compiler.py` — updated `test_is_empty_or_group` to the new `builder="is_empty"` contract.

## Decisions Made
- **`is_empty` distinct builder marker:** both `one_of` and `is_empty` originally compiled to `builder="or_"`, which forced a brittle sentinel disambiguation in `_apply`. Changed `is_empty` to `builder="is_empty"` so the dispatch is unambiguous: `one_of` → `.in_(col, values)` (PostgREST quotes each member, SC#4-safe), `is_empty` → `.or_(col.is.null,col.eq.,col.eq.[])` with **hard-coded** RHS tokens (never user input).
- **`one_of` binds via `.in_`, not interpolated `.or_`:** verified that an interpolated `.or_` grammar string built from user values would be an SC#4 break (a `,`/`.` in a value breaks out of the grammar); `.in_` binds the list as a quoted param value instead.
- **Retarget the 113 tests rather than xfail them:** the success criterion required the 4 rows to PASS. They used `document_type` (now a typed-column leg needing migration 074). Retargeting onto migration-free `language`/`author` legs proves the contract-break is closed AND keeps them green now, while the typed-column behavior is covered by the new `xfail`-until-Plan-03 typed-leg rows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `is_empty` and `one_of` shared an ambiguous `builder="or_"`**
- **Found during:** Task 1 (`_apply` dispatch)
- **Issue:** Plan 01 emitted `builder="or_"` for BOTH `one_of` (membership) and `is_empty` (null/blank), so `_apply` could not tell them apart without a fragile inspection of the `values` payload.
- **Fix:** Changed the `is_empty` operator to emit `builder="is_empty"` (a distinct marker). `_apply` now dispatches `or_` → `.in_` membership and `is_empty` → a hard-coded `.or_` null/blank predicate.
- **Files modified:** `backend/app/services/view_operators_extra.py`, `backend/tests/unit/test_114_view_filter_compiler.py` (the `test_is_empty_or_group` assertion updated to the new contract)
- **Verification:** `pytest tests/unit/test_114_view_filter_compiler.py tests/unit/test_113_view_filter_compiler.py` → 25 passed, 1 xfailed; `test_custom_leg_is_empty_live` GREEN against :54322.
- **Committed in:** `077d2ea6` (Task 1 commit)

**2. [Rule 1 - Bug] The 4 `test_113_view_resolve.py` rows hit the not-yet-applied typed column**
- **Found during:** Task 1 (verifying the contract-break handoff)
- **Issue:** After the widening, the 113 `document_type` eq filters routed to the typed `document_type_norm` leg, which does not exist until Plan 03 applies migration 074 → HTTP 400 ("column does not exist"). The `list[Fragment]`-into-`.contains()` TypeError was gone, but a new migration-dependency failure replaced it.
- **Fix:** Retargeted the 4 behavioral 113 rows onto migration-free legs (`language` custom `.eq`; `author` free-text `.ilike`; injection payload onto `language`), preserving each test's intent (ordering+count, query-not-copy, is_latest-only, injection-neutralized). Per the critical-sequencing note, the typed-column behavior moves to the new `xfail`-until-Plan-03 typed-leg rows in `test_114_resolve_range_date.py`.
- **Files modified:** `backend/tests/integration/test_113_view_resolve.py`
- **Verification:** `pytest tests/integration/test_113_view_resolve.py` → 5 passed.
- **Committed in:** `077d2ea6` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes were necessary to deliver the plan's own success criteria (unambiguous dispatch; the 01→02 handoff closed). No scope creep — both stayed inside the resolve-route widening and the test-contract evolution the plan and the 114-01 SUMMARY anticipated.

## Threat-Model Compliance

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-114-02-01 (widened two-leg leak) | mitigate | DONE — both legs scope from `caller` (`.eq("user_id", caller)` / caller's global-folder ids), NEVER `view["user_id"]` (grep: only in docstrings + the update_view ownership gate); 404-not-403 untouched. `test_view06_leak_safety_two_user_custom_leg_live` GREEN (A sees only A's doc; B's read of A's view → 404). |
| T-114-02-02 (count-path leak) | mitigate | DONE — count path reuses the SAME caller-scoping; `test_count_only_leak_safe_from_caller` proves a count over another user's docs is impossible (counts 1, not 3). |
| T-114-02-03 (typed-vs-custom builder injection) | mitigate | DONE — typed leg targets CONSTANT column names; custom leg's `metadata->>'field'` field is re-validated against the live whitelist at resolve; ALL values ride as bound PostgREST params (verified via the request-param inspection — payload URL-encoded, never SQL); `one_of` binds via `.in_` (quoted members), `is_empty`'s `.or_` carries only hard-coded tokens. SC#4 live injection (`test_injection_value_neutralized_live`) GREEN (0 matches, table intact). |
| T-114-02-04 (relative-date correctness) | mitigate | DONE — `_relative_window` recomputes from `date.today()` every call; `within_next`'s `.gte(today)` lower bound excludes overdue (`test_relative_window_within_next_excludes_overdue` GREEN); `test_relative_window_recomputes_live` proves the live clock anchors the window; the 115-handoff docstring forbids downstream re-derivation. |
| T-114-02-SC (npm/pip installs) | accept | N/A — zero packages installed. |

## Known Stubs

None. The typed-leg live assertions (3 rows total: 2 in `test_114_resolve_range_date.py`, 1 in `test_114_count_only.py`) are `xfail(strict=False)` — NOT stubs. They are the explicit, documented handoff to Plan 03, which applies migration 074 (the `document_type_norm`/`date_typed` columns those rows resolve through) and then un-marks them. Each xfail row guards with a live `information_schema.columns` check so it reports `xpass` automatically if the migration is applied early.

## Verification

- `cd backend && venv/Scripts/python -m pytest tests/integration/test_114_resolve_range_date.py -q` → **11 passed, 2 xfailed**.
- `cd backend && venv/Scripts/python -m pytest tests/integration/test_114_count_only.py -q` → **4 passed, 1 xfailed**.
- `cd backend && venv/Scripts/python -m pytest tests/integration/test_113_view_resolve.py -q` → **5 passed** (the 01→02 contract-break handoff closed).
- Full related suite (114 resolve + count + 113 resolve + 113/114 unit) → **45 passed, 4 xfailed, 0 failed**. `test_113_view_crud.py` → 3 passed (no CRUD regression).
- Acceptance greps: `count_only` ×3; count branch uses `.select("id")` (never `*`); `date.today()` ×1 inside resolve; Phase-115 handoff ×3; `view["user_id"]` only in docstrings + the ownership gate (unchanged from base); both legs in the count branch carry `.eq("user_id", caller)` / `.in_("folder_id", …)`.
- `_relative_window("within_next", 90, "days")` returns `(today, today+90)` computed live.

## Issues Encountered
- supabase-py / PostgREST value-binding had to be verified empirically before writing `_apply` to guarantee SC#4: inspected the generated httpx request params for `.eq("metadata->>field", payload)`, `.in_(col, [list])`, and `.or_(...)` — confirmed values URL-encode as bound predicate operands (never SQL-interpolated) and `.in_` quotes list members. This shaped the decision to use `.in_` for `one_of` and hard-coded tokens for `is_empty`'s `.or_`.

## User Setup Required
None — no external service configuration. (Migration 074 apply is Plan 03's [BLOCKING] manual step, not this plan's.)

## Next Phase Readiness
- **Plan 03 (BLOCKING wave):** apply migration 074 to the live :54322 DB (Supabase SQL editor / psycopg2, never `db push`), then `bash scripts/regenerate-full-schema.sh`; then un-mark the 3 typed-leg `xfail` rows (they will resolve through `document_type_norm`/`date_typed`) and add the EXPLAIN-index + bad-date live tests. Each xfail row already guards with a live column-existence check, so they convert to GREEN automatically once the columns exist.
- **Plans 05/06 (frontend):** the `GET /document-views/{id}/resolve` (full) and `?count_only=1` (live builder count + per-view sidebar badges) endpoints are live and leak-safe.
- **Phase 115 (agent-tool):** reuse `resolve_view` / `_relative_window` for free live-recompute relative windows — the handoff is documented in the resolver docstring.

## Self-Check: PASSED

- Created files exist: `test_114_resolve_range_date.py`, `test_114_count_only.py`, `114-02-SUMMARY.md` — all FOUND.
- Commits exist: `077d2ea6` (Task 1), `bfa50d6b` (Task 2) — all FOUND.
- Verification green: 114 resolve (11p/2xf) + 114 count-only (4p/1xf) + 113 resolve (5p) + 113/114 unit (25p/1xf); full related suite 45 passed / 4 xfailed / 0 failed.

---
*Phase: 114-virtual-folders-range-date-filters-view-builder-sidebar*
*Completed: 2026-06-19*

---
phase: 114-virtual-folders-range-date-filters-view-builder-sidebar
plan: 01
subsystem: backend / virtual-folders filter compiler
tags: [VIEW-03, filter-compiler, fragment-contract, generated-columns, migration, case-insensitive]
requires:
  - Phase 113 closed OPERATOR_REGISTRY + compile_filter + validate_fields (view_filter_compiler.py)
  - Phase 113 ViewCondition/ViewFilter AST (document_view.py)
  - metadata_field._BUILTINS field whitelist + field_type vocabulary
provides:
  - "Fragment dataclass + widened compile_filter returning ordered list[Fragment] (R-114-A contract change)"
  - "view_operators_extra.py registering all 10 additive VIEW-03 operators at the line-79 SEAM"
  - "additively-widened ViewCondition.op Literal (11 operators) + optional value2/values/unit"
  - "supabase/migrations/074_view_typed_columns.sql (AUTHORED, not applied) — document_type_norm + date_typed GENERATED STORED cols + btree indexes"
affects:
  - "Plan 02 (resolve route) — MUST widen document_views.py _apply to consume list[Fragment] (currently BROKEN by this contract change — see Downstream Handoff)"
  - "Plan 03 — applies migration 074 + bad-date dataset test + EXPLAIN index test"
  - "Phase 115 agent-tool — reuses the same resolver/relative-date server-clock derivation (D-114-16)"
tech-stack:
  added: []  # zero new packages (additive over installed stack)
  patterns:
    - "closed-registry @register_operator side-effect import at the documented SEAM"
    - "bound WHERE-fragment descriptors (data only, no SQL) — compiler purity preserved"
    - "case-insensitivity query-value-side for normalized fields (Pitfall 3), ilike for free-text"
    - "GENERATED ALWAYS AS (...) STORED typed columns with ISO-regex-guarded ::date cast (R-114-B)"
key-files:
  created:
    - backend/app/services/view_operators_extra.py
    - backend/tests/unit/test_114_view_filter_compiler.py
    - supabase/migrations/074_view_typed_columns.sql
  modified:
    - backend/app/models/document_view.py
    - backend/app/services/view_filter_compiler.py
    - backend/tests/unit/test_113_view_filter_compiler.py
decisions:
  - "Compiler returns list[Fragment] (R-114-A) — the one place Phase 113's 'purely additive, eq untouched' promise deliberately bends; treated as a tested contract change"
  - "_op_eq signature changed from (field, value) to (cond) so operators can read value2/values/unit; all registered fns take a ViewCondition"
  - "document_views.py (resolve route) NOT modified here — Plan 02 owns the _apply two-leg Fragment consumption (it is now intentionally broken at the live integration boundary, by design of the Plan 01->02 sequence)"
  - "Relative-date operators carry N + unit only; window math deferred to resolve route's server clock (D-114-16) — never baked in the compiler"
metrics:
  duration_min: 10
  completed: 2026-06-19
  tasks: 3
  files: 6
  commits: 3
---

# Phase 114 Plan 01: Filter Compiler Fragment Widening + Operators + Migration Authoring Summary

Widened the Phase 113 single-`@>`-dict filter compiler into an ordered `list[Fragment]` of bound WHERE-fragment descriptors, registered the full VIEW-03 operator set (`gte`/`lte`/`one_of`/`contains`/`is_empty`/`within_next`/`older_than`/`before`/`after`/`between`) additively at the documented line-79 seam with case-insensitive matching, and authored (did NOT apply) migration `074` promoting `date` + `document_type` to typed, btree-indexed `GENERATED STORED` columns.

## What Was Built

### Task 1 — AST widening + Wave-0 test scaffold (commit `80e904c0`)
- `ViewCondition.op` widened additively from `Literal["eq"]` to the eleven VIEW-03 operators; `eq` stays first so pre-114 `{op:and, eq}` rows in `document_views.filter_expr` parse unchanged (the D-113-6 payoff).
- Added optional `value2` (between), `values` (one_of), `unit` (relative-date) operands — all default-absent.
- `value` made optional (`is_empty` carries none).
- `ViewFilter.op` stays `Literal["and"]` (OR/NOT deferred); the "no `ViewResolveResponse` model" rule (IN-03 / 112-CR-01) preserved verbatim.
- `test_114_view_filter_compiler.py` Wave-0 RED scaffold (imports inside test bodies; `xfail(strict=False)` on not-yet-built behaviors): 4 AST tests green immediately; Fragment/operator/case-insensitive/SC#4 tests xfail until Task 2; relative-date window-math test xfail through Plan 02 (D-114-16).

### Task 2 — Fragment compiler + additive operators (commit `7028d2ae`)
- `Fragment` dataclass (`leg ∈ {typed,custom,containment}`, `field`, `builder ∈ {eq,gte,lte,ilike,is_,or_,contains,within_next,older_than}`, `value`, `value2`, `values`) — data only, no SQL.
- `compile_filter` now returns an ordered `list[Fragment]` (R-114-A); flat-AND order preserved; `[]` on empty conditions; fail-closed `KeyError` (Pitfall 5) kept; `validate_fields` byte-unchanged.
- `_op_eq` rewritten case-insensitive (D-114-10): `document_type` → typed `document_type_norm` leg with lowercased value (indexed, Pitfall 3 — NOT `ilike`); `language` → lowercased `.eq`; free-text `title`/`author`/`summary` → `ilike`; boolean/number → `@>` containment fast path survives.
- `view_operators_extra.py` registers all 10 additive operators at the line-79 SEAM via `from . import view_operators_extra` (placed after `Fragment`/`register_operator`/field-set definitions to avoid the circular-import break).
- Leg field sets: `PROMOTED_TYPED_COLUMNS` (`document_type`→`document_type_norm`, `date`→`date_typed`), `NORMALIZED_LOWER_FIELDS` (`document_type`, `language`), `FREE_TEXT_FIELDS` (`title`, `author`, `summary`).
- Relative-date `within_next`/`older_than` carry N (`value`) + `unit` (`value2`); the today→today+N window math is DEFERRED to the resolve route's server clock (D-114-16).

### Task 3 — 113 test rewrite + migration 074 authoring (commit `d25f05db`)
- Rewrote the three Phase-113 containment-dict tests to the `list[Fragment]` contract: `test_eq_compiles` → single typed-leg Fragment (`document_type_norm`, lowercased); `test_and_folds_conditions` → ordered 2-Fragment list (typed + `ilike` custom); `test_empty_filter_no_narrowing` → `[]`.
- SC#4 `test_injection_value_neutralized` stays green: payload rides as the exact bound literal in the Fragment `value` byte-for-byte (asserted on free-text `title` where the value is untouched — the typed `document_type` leg lowercases its value, so it is not the right field for a byte-for-byte proof); field name is a constant, never interpolated.
- `supabase/migrations/074_view_typed_columns.sql` AUTHORED (not applied): two `GENERATED ALWAYS AS (...) STORED` columns (`document_type_norm` = `lower(metadata->>'document_type')`; `date_typed` = ISO-regex-guarded `(metadata->>'date')::date`) + two btree indexes; adds NO RLS (modifies the already-RLS'd `documents` table); load-bearing immutability + Pitfall-2 notes inline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Swapped the `test_113::test_unknown_op_rejected` parse example off `gte`**
- **Found during:** Task 2
- **Issue:** The Layer-1 parse-rejection example asserted `{op:"gte"}` raises `ValidationError`, but `gte` became a VALID widened operator in Task 1 → the test failed `DID NOT RAISE`.
- **Fix:** Swapped the example to `regex` (genuinely not in the widened Literal). This is the R-114-A test-contract change the plan's Task-3 read_first anticipated ("swap the parse-leg example off `gte` (now valid)"); applied in Task 2 because Task 2's operator widening is what invalidated the old premise. The Layer-2 `KeyError` fail-closed proof (Pitfall 5) is unchanged.
- **Files modified:** `backend/tests/unit/test_113_view_filter_compiler.py`
- **Commit:** `7028d2ae` (re-verified green) — committed with Task 3 as part of the unified test-contract rewrite.

### Architectural / scope note (NOT auto-fixed — by plan design)

**`_op_eq` signature change `(field, value)` → `(cond)`:** every registered operator fn now receives the whole `ViewCondition` so the additive operators can read `value2`/`values`/`unit`. This is within the plan's "widen the compiler" scope (the registry callable type widened accordingly).

## Downstream Handoff (CRITICAL — read before Plan 02)

**The live resolve route (`backend/app/api/document_views.py`) is now BROKEN at the integration boundary — BY DESIGN of the Plan 01 → Plan 02 sequence.**

- `document_views.py:225` calls `compile_filter` (now returns `list[Fragment]`) and `:253-254` does `if metadata_filter: q.contains("metadata", metadata_filter)`. Passing a `list[Fragment]` to `.contains()` raises `TypeError: sequence item 0: expected str instance, Fragment found`.
- This is the direct, expected consequence of the R-114-A contract change. `document_views.py` is NOT in this plan's `files_modified` — **Plan 02 owns the `_apply` two-leg Fragment consumption** (typed-column leg via `.eq`/`.gte`/`.lte`/`.ilike`/`.or_` on the constant column name; custom `metadata->>'field'` leg with whitelist-only field names; relative-date server-clock window derivation per D-114-16; count-only mode per D-114-15).
- **`tests/integration/test_113_view_resolve.py` now has 4 failing rows** (`test_order_and_count`, `test_query_not_copy_one_doc_two_views`, `test_only_latest_versions_resolve`, `test_injection_value_neutralized_live`) — all from the `list[Fragment]`-into-`.contains()` mismatch. These are Plan 02's gate (RESEARCH Wave 0 Gaps rewrites them into `test_114_resolve_widened.py` + extends them). They are NOT Plan 01's verification target — Plan 01's `<verification>` scopes to the two UNIT test files + the migration file only.
- **Plan 02 MUST widen `_apply` before any integration resolve test can pass.** Do NOT treat the 4 red integration rows as a Plan 01 regression — they are the planned intermediate state of a contiguous backend foundation.
- **Plan 03 MUST apply migration `074`** (Supabase SQL editor / psycopg2 to :54322, never `db push`) before the typed-leg Fragments (`document_type_norm`/`date_typed`) resolve against real columns, then `bash scripts/regenerate-full-schema.sh`. The typed-leg column names do not exist in the DB until then.

## Threat-Model Compliance

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-114-01-01 (injection rides as bound literal) | mitigate | DONE — no f-string SQL in either module (grep clean); `test_113::test_injection_value_neutralized` green byte-for-byte; `test_114::test_injection_value_rides_as_bound_literal` green |
| T-114-01-02 (field-name leg selection) | mitigate | DONE — typed leg targets CONSTANT column names (`document_type_norm`/`date_typed`); custom leg sources `field` from the validated AST; `validate_fields` unchanged |
| T-114-01-03 (smuggled/forged operator) | mitigate | DONE — `KeyError` fail-closed + Pydantic Literal both survive; `test_unknown_op_rejected` green |
| T-114-01-04 (074 date generation expr DoS) | mitigate | DONE (file-level) — `date_typed` guards `(metadata->>'date')::date` with the ISO-regex `CASE` → NULL on non-ISO; LIVE bad-date verification gated by Plan 03 |
| T-114-01-SC (npm/pip installs) | accept | N/A — zero packages installed |

## Verification

- `cd backend && venv/Scripts/python -m pytest tests/unit/test_113_view_filter_compiler.py tests/unit/test_114_view_filter_compiler.py -q` → **25 passed, 1 xfailed** (the relative-date window math, deferred to Plan 02 per D-114-16). 1 benign xpass earlier (the smuggled-op KeyError already held pre-Task-2 under `strict=False`).
- `test_113` SC#4 injection test GREEN (byte-for-byte literal preserved through the widening).
- `supabase/migrations/074_view_typed_columns.sql` authored: executable DDL has exactly 2 `GENERATED ALWAYS AS ... STORED` columns + 2 `CREATE INDEX ... USING btree` + 1 ISO-regex `CASE WHEN ... ~ '^\d{4}-\d{2}-\d{2}$'` guard wrapping the `::date` cast. NOT applied — `supabase/full-schema.sql` untouched (no `document_type_norm`).
- Seam import wired: `grep -v '^#' view_filter_compiler.py | grep -c view_operators_extra` ≥ 1; all 11 operators present in `OPERATOR_REGISTRY`.
- No f-string SQL anywhere in `view_filter_compiler.py` or `view_operators_extra.py` (compiler purity / SC#4).

## Known Stubs

None. The relative-date operators intentionally carry only `N + unit` (the window math is a documented Plan 02 / D-114-16 handoff, not a stub) — `test_within_next_window_math_deferred` is the explicit `xfail` tracking it.

## Commits

- `80e904c0` — feat(114-01): widen view filter AST + add Wave-0 compiler test scaffold
- `7028d2ae` — feat(114-01): widen compiler to Fragment output + register VIEW-03 operators
- `d25f05db` — feat(114-01): rewrite 113 tests to Fragment contract + author migration 074

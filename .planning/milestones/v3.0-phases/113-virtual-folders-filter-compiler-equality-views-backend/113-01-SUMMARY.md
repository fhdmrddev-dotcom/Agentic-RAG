---
phase: 113-virtual-folders-filter-compiler-equality-views-backend
plan: 01
subsystem: backend
tags: [virtual-folders, filter-compiler, metadata, pydantic-ast, closed-registry, security]
requires:
  - "app.models.document.DocumentResponse + DocumentMetadata (extra=allow) — reused for the resolve listing row shape"
  - "harness/validators.py closed-registry pattern (mirrored, not imported)"
provides:
  - "app.models.document_view: ViewCondition/ViewFilter AST + ViewCreate/Update/Response/ViewResolveResponse (the contracts Plan 02 service + Plan 03 router consume)"
  - "app.services.view_filter_compiler: OPERATOR_REGISTRY + register_operator + compile_filter + validate_fields (the SC#4 attack surface)"
affects:
  - "Plan 02 (document_view_service) — calls compile_filter/validate_fields against these models"
  - "Plan 03 (document_views router) — binds compile_filter output as $1::jsonb via .contains()"
  - "Phase 114 — registers gte/lte/one_of/contains/is_empty additively via the documented seam (no eq/AST rewrite)"
tech-stack:
  added: []
  patterns:
    - "Closed operator registry + @register_operator decorator (mirror harness/validators.py VALIDATOR_REGISTRY)"
    - "Literal-discriminated Pydantic AST = declarative reject-unknown-op at parse (no eval, no dict-walk)"
    - "Bound-literal-only compiler: {field: value} dict folded → one $1::jsonb via .contains() (no f-string SQL)"
    - "_-prefix + whitelist field validation at save (mirror documents.py:1401; D-111-9/D-112-D02 invariant)"
key-files:
  created:
    - "backend/tests/unit/test_113_view_filter_compiler.py"
    - "backend/app/models/document_view.py"
    - "backend/app/services/view_filter_compiler.py"
  modified: []
decisions:
  - "Each unit test imports its symbols INSIDE the test body (collection never breaks pre-symbol) — the test_validator_kinds.py convention"
  - "compile_filter raises KeyError on an unregistered op (defense-in-depth) even though Pydantic Literal already rejects at parse — Pitfall 5"
  - "validate_fields rejects a _-prefixed field UNCONDITIONALLY (even if wrongly whitelisted) — provenance keys are never a filter dimension"
metrics:
  duration: "~4 min"
  completed: "2026-06-18"
  tasks: 3
  files: 3
  commits: 3
---

# Phase 113 Plan 01: Filter Compiler + AST Contracts Summary

Landed the one genuinely net-new component of Phase 113 — a pure, closed-registry filter-AST → `metadata_filter` compiler (the SC#4 injection/SSTI attack surface) plus the `Literal`-discriminated Pydantic AST contracts it transforms and the Wave 0 unit scaffold proving every compiler branch green.

## What Was Built

- **`backend/app/models/document_view.py`** — the filter AST (`ViewCondition` with `op: Literal["eq"]`, `value: str|int|float|bool`; `ViewFilter` with `op: Literal["and"]`, `conditions: list[ViewCondition] = []`) plus the `ViewCreate`/`ViewUpdate`/`ViewResponse`/`ViewResolveResponse` request-response models. The `Literal` discriminators are the declarative reject-unknown-op mechanism: an incoming `filter_expr` with `op:"or"` or a condition `op:"gte"` fails `ViewFilter.model_validate(...)` at parse (→ 422). `ViewResolveResponse.documents` reuses `DocumentResponse` from `app.models.document` — its nested `DocumentMetadata` keeps `extra="allow"` UNTOUCHED (the 112 CR-01 lesson: tightening strips `_source`/`_confidence` from rendered rows).
- **`backend/app/services/view_filter_compiler.py`** — a PURE module (no I/O, no DB, no eval, no string interpolation). A closed `OPERATOR_REGISTRY: dict[str, Callable]` + a `register_operator` decorator (mirrors `harness/validators.py`); only `eq` registered (`@register_operator("eq")` → `{field: value}`). `compile_filter(flt)` folds every condition into ONE `metadata_filter` dict (AND-of-keys → VIEW-04), returns `{}` for empty conditions (D-113-9), and raises `KeyError` on an op not in the registry (fail-closed defense-in-depth, Pitfall 5). `validate_fields(flt, whitelist)` raises `ValueError` on any `_`-prefixed field (unconditionally) and any field not in the whitelist (mirrors `documents.py:1401`). A documented Phase-114 seam shows how additive operators register via one import, with zero `eq`/AST rewrite (D-113-6).
- **`backend/tests/unit/test_113_view_filter_compiler.py`** — 7 pure unit tests covering every compiler branch, each importing its symbols inside the test body: `test_eq_compiles`, `test_and_folds_conditions`, `test_empty_filter_no_narrowing`, `test_unknown_op_rejected` (both Pydantic-parse and registry-`KeyError` layers), `test_unknown_field_rejected_at_save`, `test_underscore_field_excluded`, and the SC#4 first-class `test_injection_value_neutralized` (a `'; DROP TABLE documents;-- {{7*7}} ${jndi:ldap://x}` payload compiles byte-for-byte to `{"document_type": "<payload>"}`).

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wave 0 unit test scaffold (RED) | `5cdf747a` | backend/tests/unit/test_113_view_filter_compiler.py |
| 2 | Pydantic AST + req/resp models | `d213f2c3` | backend/app/models/document_view.py |
| 3 | Closed-registry compiler (GREEN) | `7f450291` | backend/app/services/view_filter_compiler.py + un-xfail test |

## Verification

```
cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_113_view_filter_compiler.py -x -q
→ 7 passed
```

All 7 compiler unit tests green, including the SC#4 `test_injection_value_neutralized`. Source-asserted: `view_filter_compiler.py` contains NO `eval`, NO `exec`, NO `.format(`-into-query, NO f-string SQL, NO field-name/value interpolation (grep on the source found matches only inside docstrings/comments documenting the discipline). `compile_filter` raises `KeyError` on an unregistered op (verified via `model_construct`-bypassed AST). Models import cleanly: `from app.models.document_view import ViewCondition, ViewFilter, ViewCreate, ViewResponse, ViewResolveResponse`.

## TDD Gate Compliance

- RED gate: `test(113-01)` commit `5cdf747a` — scaffold lands xfailed, suite exits 0 (no collection error).
- GREEN gate: `feat(113-01)` commits `d213f2c3` (models) then `7f450291` (compiler) — un-mark each stub as symbols land; all 7 tests pass.
- No REFACTOR gate needed (the compiler is ~110 lines, written clean against the final contract).

Note: Task 1 (RED scaffold) is a test-only commit, so its tests were authored xfailed by design — the suite never went red on collection. Tasks 2-3 are `tdd="true"`; the RED behavior they satisfy was encoded in the Task 1 scaffold (the un-mark-on-landing convention from 098/099/101.1/102), not via a fresh per-task RED commit. The net effect honors RED-before-GREEN: the assertions existed (xfailed) before the implementation landed.

## Deviations from Plan

None — plan executed exactly as written. Tasks 1-3 landed in order against fixed contracts; no Rule 1-4 deviations, no auth gates, no architectural changes.

## Known Stubs

None. The compiler is fully functional for the `eq` + `and` scope Phase 113 owns. The documented Phase-114 operator seam is an intentional, named extension point (D-113-6), not a stub — `eq` is fully wired and tested.

## Notes for Downstream Plans

- **Plan 02 (`document_view_service.py`)** consumes `ViewCreate`/`ViewUpdate` and calls `view_filter_compiler.validate_fields(body.filter_expr, whitelist)` before the DB write (on create AND update — D-113-10).
- **Plan 03 (`document_views.py` router)** assembles the whitelist (`set(DocumentMetadata.model_fields) ∪ enabled custom defs`, `_`-excluded), maps `ValueError` → 422, and binds `compile_filter(...)` output via `.contains("metadata", metadata_filter)` (→ `metadata @> $1::jsonb`). The resolve route must scope from the CALLER, never `view.user_id` (VIEW-06 leak-safety, Pitfall 1).
- The SC#3 cross-user global-view leak test is authored under VALIDATION.md and run LIVE in secure-phase (not in this Wave-0 unit scope).

## Self-Check: PASSED

- Files exist: `backend/tests/unit/test_113_view_filter_compiler.py`, `backend/app/models/document_view.py`, `backend/app/services/view_filter_compiler.py` — all FOUND.
- Commits exist: `5cdf747a`, `d213f2c3`, `7f450291` — all FOUND in git log.
- Unit suite: 7 passed, exit 0.

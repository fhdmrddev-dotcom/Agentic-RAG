---
phase: 118
plan: 01
subsystem: auto-classification
tags: [classification, matcher, pydantic, view-filter-ast, wave-0]
requires:
  - "app.models.document_view.ViewFilter (the closed filter AST — reused verbatim)"
  - "app.services.view_filter_compiler.validate_fields (_-prefix + whitelist guard)"
  - "app.services.view_operators_extra (the operator normalization semantics mirrored)"
provides:
  - "classification_matcher.match_metadata(match_expr, metadata, whitelist) -> bool (PURE)"
  - "classification_matcher.build_suggestion(rule, supabase, user_id) -> dict (D-118-5 shape)"
  - "models.classification_rule.RuleCreate/RuleUpdate/RuleResponse (reuse ViewFilter)"
  - "8 Wave-0 test files (2 unit GREEN + 6 integration xfail scaffolds)"
affects:
  - "Plan 02 (the /classification-rules router consumes RuleCreate/Update/Response + validators)"
  - "Plan 03 (the ingest splice consumes match_metadata + build_suggestion; accept/dismiss endpoints)"
tech-stack:
  added: []
  patterns:
    - "Pure in-Python AST->bool evaluator mirroring the SQL compiler normalization (Pitfall 2)"
    - "ViewFilter reuse for match_expr (Literal op-reject for free; no AST redefinition)"
    - "Wave-0 xfail(strict=False) integration scaffolds (suite exits 0; later plans flip GREEN)"
key-files:
  created:
    - "backend/app/services/classification_matcher.py"
    - "backend/app/models/classification_rule.py"
    - "backend/tests/unit/test_118_matcher.py"
    - "backend/tests/unit/test_118_rule_validation.py"
    - "backend/tests/integration/test_118_rule_crud.py"
    - "backend/tests/integration/test_118_ingest_suggest.py"
    - "backend/tests/integration/test_118_rule_leak.py"
    - "backend/tests/integration/test_118_flat_filter_compat.py"
    - "backend/tests/integration/test_118_accept.py"
    - "backend/tests/integration/test_118_dismiss_undo.py"
  modified: []
decisions:
  - "match_metadata is PURE: no eval, no DB, no SQL-compiler reuse — bound dict value compared with Python operators only (T-118-01-01)"
  - "build_suggestion freezes condition_summary at suggest-time (provenance, not live state) and resolves suggested_folder_name FRESH (None if folder deleted/unreadable, Pitfall 5)"
  - "month windows for within_next/older_than use a 30-day approximation (mirrors the resolve clock's coarse window)"
metrics:
  duration: "~25 min"
  completed: "2026-06-21"
  tasks: 3
  files_created: 10
  commits: 4
---

# Phase 118 Plan 01: Net-New Matcher + Rule Models + Wave-0 Scaffolds Summary

Built the two net-new backend primitives Phase 118 stands on — the pure in-Python
`match_metadata` AST→bool matcher (mirroring the Phase 113/114 SQL compiler normalization so
the builder's "would match N" preview agrees with the on-upload match) and the `ViewFilter`-reusing
`RuleCreate/Update/Response` Pydantic models — plus the 8 Wave-0 test scaffolds every later 118
plan verifies against.

## What Was Built

### Task 1 — Wave-0 test scaffolds (commit `687fc339`)

8 backend test files named EXACTLY per the VALIDATION map:

- **`test_118_matcher.py`** (unit, NOT xfail) — per-operator agreement with the documented SQL
  semantics (eq normalized + free-text, one_of, contains, ISO-date ranges, is_empty, relative-date),
  flat-AND, empty-rule, build_suggestion-shape (NO confidence key), deleted-folder→None.
- **`test_118_rule_validation.py`** (unit, NOT xfail) — RuleCreate/Update/Response model parse +
  the ViewFilter Literal unknown-op parse-reject.
- **6 integration scaffolds** (`test_118_rule_crud.py`, `test_118_ingest_suggest.py`,
  `test_118_rule_leak.py`, `test_118_flat_filter_compat.py`, `test_118_accept.py`,
  `test_118_dismiss_undo.py`) — `pytest.mark.xfail(strict=False)` so the suite exits 0 now;
  Plans 02/03 flip them GREEN. Each injects the REAL local :54322 client via the
  `_read_local_supabase_env()`/`_supabase_or_skip()` pattern and skips cleanly when Postgres is
  unreachable.

`test_118_rule_leak.py` mirrors `test_116_tool_leak.py`'s per-user OWN-scoped fixtures (two
distinct user fixtures `user_a`/`user_b` + an `is_global=true` rule), proving D-118-8: B's PRIVATE
rule never enters A's own+global read set, and A's GLOBAL rule (visible to B) evaluates against B's
OWN upload metadata only — NOT a B-queries-A's-private-rule shape that false-greens.

### Task 2 — `classification_matcher.py` (commit `c4b57533`)

The net-new PURE primitive. `match_metadata(match_expr, metadata, whitelist) -> bool` parses via
`ViewFilter.model_validate` (Literal op-reject), runs `view_filter_compiler.validate_fields`
(`_`-prefix + whitelist guard), returns `False` on an empty rule, else `all(_match_one(c, metadata))`
(flat AND, D-113-7). `_match_one` MIRRORS the compiler/`view_operators_extra` normalization exactly:
case-insensitive eq for `document_type`/`language` (lowercased) + free-text (`title`/`author`/`summary`),
case-insensitive `one_of`/`contains`, ISO-date-string range comparison, `is_empty` (absent OR `""`/`[]`),
and relative-date windows from `date.today()`. No eval, no interpolation, no DB touch.
`build_suggestion` builds the D-118-5 single object (NO confidence %), renders `condition_summary`
frozen from the AST, and resolves `suggested_folder_name` FRESH from the own+global folder read
(`None` if deleted/unreadable — Pitfall 5).

### Task 3 — `classification_rule.py` (commit `77d2262b`)

`from app.models.document_view import ViewFilter` — `RuleCreate.match_expr: ViewFilter` (the closed
AST reused verbatim; unknown ops 422 at parse for free). `RuleUpdate` all-Optional (the enable/disable
toggle rides UPDATE). `RuleResponse` carries the full row shape and no doc metadata, so a typed
response is IN-03-safe.

## Verification

- `pytest tests/unit/test_118_matcher.py tests/unit/test_118_rule_validation.py` → **23 passed**.
- `pytest -k 118 --co` → 41 tests collected across all 8 files, no import/collection error.
- `pytest -k 118` → **24 passed, 13 xfailed, 4 xpassed, 0 failed** (suite exits 0).
- Acceptance greps: `ViewFilter.model_validate` + `validate_fields` present in the matcher (reuse,
  not reinvention); no real `eval(`/`resolve_filter`/`compile_filter` CALL (only docstring prose);
  no `"confidence"` key in build_suggestion output; `from app.models.document_view import ViewFilter`
  present in the rule models.
- **Net-new failures = 0:** both source files are net-new and imported ONLY by the net-new Phase 118
  test files (grep-confirmed — `test_110_dm_schema.py`'s "classification_rules" references are the
  Phase-110 *table*, not these Python modules), so they cannot introduce a failure in any pre-existing
  test.

## Deviations from Plan

None — plan executed exactly as written. The matcher mirrors the compiler normalization per the
PATTERNS table; the one implementation detail not spelled out in the plan (month-window math for
`within_next`/`older_than`) uses a 30-day approximation matching the coarse resolve-clock window, and
is the only non-mechanical choice — recorded in the decisions frontmatter.

## Known Stubs

The 6 integration test files are intentional Wave-0 `xfail(strict=False)` scaffolds (documented in
VALIDATION.md "Wave 0 Requirements") — Plan 02 (the `/classification-rules` router) flips
`test_118_rule_crud.py`/`test_118_rule_leak.py`/`test_118_ingest_suggest.py` GREEN; Plan 03 (the
ingest splice + accept/dismiss endpoints) flips the rest. They are NOT stubs that prevent this plan's
goal — this plan's goal is the matcher + models + scaffolds, all delivered and GREEN where required.

## Self-Check: PASSED

- All 10 created files exist on disk (verified with `[ -f ]`).
- All 3 task commit hashes (`687fc339`, `c4b57533`, `77d2262b`) present in git history (verified with
  `git log | grep`).

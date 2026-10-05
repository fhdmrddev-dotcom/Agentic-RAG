---
phase: 269-starter-expert-library
plan: 02
subsystem: experts / seed data
tags: [experts, seed-sql, fence, PACK-26, D-269-08, D-269-P2]
requires: []
provides:
  - ".planning/phases/269-starter-expert-library/269-candidate-bundles.sql (4 starter INSERTs + Financial Analyzer UPDATE, exact 198 shape)"
  - "assert_starter_seed_shape(path, expected_insert_ids) — reusable by 269-04 on migration 198"
  - "D-269-08 fence: no starter slug / bundle id in production backend or frontend code"
affects: [269-03, 269-04]
tech-stack:
  added: []
  patterns: ["candidate -> prove -> promote staging SQL outside supabase/migrations", "quote-aware SQL splitter + literal evaluator in tests", "AST constant scan with docstrings excluded by construction"]
key-files:
  created:
    - .planning/phases/269-starter-expert-library/269-candidate-bundles.sql
    - backend/tests/unit/test_269_bundle_sql_shape.py
    - backend/tests/unit/test_269_no_expert_specific_code.py
  modified: []
decisions:
  - "SQL parsing helpers live in test_269_no_expert_specific_code.py and are IMPORTED by the shape test (precedent: tests.unit.test_240_thread_key), never copied"
  - "The shape helper pins the ON CONFLICT SET list exactly (10 columns = EXCLUDED.col, then updated_at = now())"
  - "Figure tokenizer ignores digits glued to an identifier (Tier-1, Q3, file_2026) so only real cited figures are checked"
  - "The Financial Analyzer UPDATE's first two suggestions are checked VERBATIM against the parsed 187 row, not a copy"
metrics:
  duration: ~35 min
  completed: 2026-09-29
  tasks: 2
  files: 3
---

# Phase 269 Plan 02: Candidate Starter Bundles + No-Expert-Specific-Code Fence Summary

Four org-portable, restricted Install-card starter Expert rows (Contract Reviewer, HR Policy Advisor,
Security & Compliance Advisor, Operations Analyst) plus the D-269-P2 Financial Analyzer copy fix are
staged as `269-candidate-bundles.sql` in the exact migration-198 upsert shape. A reusable shape helper
pins them, and a derived-needle AST/literal fence makes SC#2 ("no Expert-specific install code")
mechanical. The fence was seen failing on both planted branches.

## Commits

| Task | Commit | Type | What |
|---|---|---|---|
| 1 | `1dd2bd9ca` | test (RED) | D-269-08 fence `test_269_no_expert_specific_code.py` |
| 2 | `5e864be7e` | test (RED) | shape fence `test_269_bundle_sql_shape.py` |
| 2 | `c1254886a` | feat (GREEN) | `269-candidate-bundles.sql` (+ tokenizer lookbehind fix in the shape test) |

## RED evidence

**Task 1 — natural RED (candidate SQL absent, collapse guard):**
```
E       AssertionError: derived slug set collapsed: ['financial-analyzer']
E       assert 1 >= 5
E        +  where 1 = len({'financial-analyzer'})
1 failed, 4 passed, 1 warning in 2.79s
```

**Task 2 — shape test RED (file absent):**
```
FAILED tests/unit/test_269_bundle_sql_shape.py::test_candidate_sql_matches_the_starter_seed_shape
FAILED tests/unit/test_269_bundle_sql_shape.py::test_candidate_sql_lives_outside_migrations_and_nothing_is_promoted_yet
FAILED tests/unit/test_269_bundle_sql_shape.py::test_candidate_sql_has_no_forbidden_statement_keyword_even_in_copy
FAILED tests/unit/test_269_bundle_sql_shape.py::test_shape_helper_is_not_vacuous
4 failed, 1 warning in 0.76s
(each: AssertionError: [] / assert 0 == 1 — rglob found no 269-candidate-bundles.sql)
```
(The second test was renamed to `test_candidate_sql_is_a_staging_artifact_outside_migrations` before
its commit, because "nothing is promoted yet" would become false at 269-04 and it asserts no such thing.)

**Plant (a) — per-slug branch in the install service** (`if bundle.get("slug") == "contract-reviewer": pass`
inserted after `slug = bundle.get("slug")`, line 528):
```
c8df31c55b60e257254bf3ff04af2677 *backend/app/services/expert_install_service.py   (before)
E         backend/app/services/expert_install_service.py:528: 'contract-reviewer'
E       assert not ["backend/app/services/expert_install_service.py:528: 'contract-reviewer'"]
1 failed, 4 passed, 1 warning in 3.10s
c8df31c55b60e257254bf3ff04af2677 *backend/app/services/expert_install_service.py   (after restore)
```

**Plant (b) — exported slug constant in the catalog** (`export const PLANT = "hr-policy-advisor";` appended):
```
b0d5d0d4bd17ae01de3e11addc1609bc *frontend/src/components/experts/catalog/expertCatalog.ts   (before)
E       AssertionError: Expert-specific literal(s) in production frontend code (D-269-08):
E         frontend/src/components/experts/catalog/expertCatalog.ts:479: 'hr-policy-advisor' in export const PLANT = "hr-policy-advisor";
1 failed, 4 passed, 1 warning in 3.02s
b0d5d0d4bd17ae01de3e11addc1609bc *frontend/src/components/experts/catalog/expertCatalog.ts   (after restore)
```
Neither plant was committed. `git diff --quiet 0300bf942 HEAD -- backend/app frontend/src` exits 0.

## GREEN

```
pytest tests/unit/test_269_bundle_sql_shape.py tests/unit/test_269_no_expert_specific_code.py tests/unit/test_266_migration_196_shape.py -q
13 passed, 1 warning in 3.19s
```
Derived needles at GREEN: slugs `contract-reviewer, financial-analyzer, hr-policy-advisor,
operations-analyst, security-compliance`; ids `...0259, ...2691, ...2692, ...2693, ...2694`.
Scanned: **256** backend `.py` files, **567** non-test frontend `.ts/.tsx` files. The only frontend hit
is the allowlisted `ExpertAuthoringStudio.tsx:740 placeholder="financial-analyzer"` (M-15), and the
test asserts it still exists. `db/experts.py:20`'s docstring mention is excluded by the AST
construction, and a positive-control test proves that WITHOUT the exclusion the scanner finds it.

Acceptance greps: 4 INSERTs · 4 `ON CONFLICT (slug) WHERE is_system = true` · 0 `24.3%|412M|quarter-over-quarter`
(non-comment) · 0 `GRANT|CREATE |ALTER |DROP |DELETE |TRUNCATE` (non-comment) · 0 `198_*` migrations ·
`iterdir|rglob` 5 · `ExpertAuthoringStudio` 2.

## What the shape fence pins (reusable as `assert_starter_seed_shape` for 269-04)

- The body holds only data statements: 4 single-row INSERTs and 1 `UPDATE ... WHERE slug = 'financial-analyzer' AND is_system = true`. No GRANT, CREATE, ALTER, DROP, DELETE or TRUNCATE outside literals, and no DO block (T-269-06).
- Every UUID in the file (comments included) is in {...2691..2694, ...0259, ...0001} (T-269-05).
- Each row: `org_id NULL`, the sentinel author, restricted scope, `'{}'` skills/connections/folder ids, public, enabled, a closed-map icon, and the exact ON CONFLICT SET list.
- `prompt_suggestions` hold 2-3 `{title, prompt}` objects. Ceilings: name/slug ≤ 120, category ≤ 64, when_to_use ≤ 500, example_output ≤ 4000, description ≤ 8000. No `--` or `;` appears inside any literal.
- `example_output` figure tokens must be a subset of the row's Starter Contract "may cite" figures, and every may-cite phrase must appear (T-269-08). The Financial Analyzer UPDATE: its first two suggestions are verbatim from the parsed 187 row, the third is the exact YoY prompt, and it contains no 24.3%, $412M or quarter-over-quarter.
- Non-vacuity: the helper rejects a planted hardcoded org id and a planted `24.3%`.

## Deviations from Plan

**1. [Rule 3 - Blocking] BOM-bearing source file broke `ast.parse`**
- **Found during:** Task 1, first run.
- **Issue:** a file under `backend/app` starts with U+FEFF, so reading it as `utf-8` raised `SyntaxError: invalid non-printable character U+FEFF`.
- **Fix:** read both scans with `utf-8-sig`.
- **Commit:** `1dd2bd9ca`

**2. [Rule 1 - Bug] The figure tokenizer counted digits inside identifiers**
- **Found during:** Task 2, GREEN run.
- **Issue:** `Q3` produced a stray token `3` on the Security row. The first lookbehind `[A-Za-z0-9-]` also missed `_`, so a file name like `_2026` would have counted.
- **Fix:** lookbehind is now `(?<![\w-])`.
- **Commit:** `c1254886a`

**3. [Scope note] Helpers are shared, not duplicated.** The plan's behaviour list puts SQL parsing in both tests. The helpers are defined once in the Task-1 file and imported by the shape test.

Otherwise the plan executed as written. No production `.py` or `.tsx` changed (D-269-08).

## Worktree note

The worktree was spawned on `476735cd0` (master), not the phase base. After the branch assertion passed, it was reset to `0300bf942` as the prompt instructed. All three commits sit on that base.

## Known Stubs

None. The candidate prompts and example outputs rely on corpus content that 269-01 authors in parallel (for example "recovery objectives" and "inventory weeks of cover"). Checking them against the corpus bytes is explicitly 269-04's job. Every example_output figure is taken from the Starter Contract table that 269-01 shares.

## Self-Check: PASSED
- FOUND: .planning/phases/269-starter-expert-library/269-candidate-bundles.sql
- FOUND: backend/tests/unit/test_269_bundle_sql_shape.py
- FOUND: backend/tests/unit/test_269_no_expert_specific_code.py
- FOUND commits: 1dd2bd9ca, 5e864be7e, c1254886a

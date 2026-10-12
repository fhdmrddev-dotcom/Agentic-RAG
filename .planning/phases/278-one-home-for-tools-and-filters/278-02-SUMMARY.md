---
phase: 278-one-home-for-tools-and-filters
plan: 02
subsystem: backend/document-filter-vocabulary
tags: [debt-09, single-home, divergence-fence, tdd]
requires: []
provides:
  - "backend/app/services/document_vocabulary.py — TIMESTAMP_DATE_COLUMNS, LIST_FIELD_NAMES (leaf, no app imports)"
  - "backend/tests/unit/test_278_vocabulary_one_home.py — base-value pin, import anchor, runtime identity, AST ban, allowlisted word-list equality"
affects:
  - backend/app/services/retrieval_scope.py
  - backend/app/services/document_search_service.py
  - backend/app/services/view_filter_compiler.py
tech-stack:
  added: []
  patterns: ["single-home leaf module + two-layer divergence fence (runtime `is` + AST ban), test_257 lineage"]
key-files:
  created:
    - backend/app/services/document_vocabulary.py
    - backend/tests/unit/test_278_vocabulary_one_home.py
  modified:
    - backend/app/services/retrieval_scope.py
    - backend/app/services/document_search_service.py
    - backend/app/services/view_filter_compiler.py
decisions:
  - "DEBT-09: the date word→column map and the topics-is-a-list rule live once, in services/document_vocabulary.py (leaf); the three named modules import it, old literals deleted in the same commit"
  - "retrieval_scope's `date`→`date_typed` stays a named extension in retrieval_scope ({**TIMESTAMP_DATE_COLUMNS, \"date\": \"date_typed\"}), never in the home (D-05 / Pitfall 14)"
  - "The fence's AST walk reads with utf-8-sig: email_extraction_service.py carries a BOM that would otherwise RED the walk for the wrong reason"
metrics:
  duration: "~25 min"
  completed: 2026-10-13
  tasks: 2
  files: 5
---

# Phase 278 Plan 02: One Home for the Filter Vocabulary Summary

The date word→column map and the "topics is a JSON list" rule now live in exactly one leaf module, `services/document_vocabulary.py`. `retrieval_scope.py`, `document_search_service.py` and `view_filter_compiler.py` import it with unchanged values and key order. A two-layer fence (runtime `is` identity plus an AST ban over `backend/app`) was driven RED against a divergent copy, a fourth-module copy and a divergent override, and each plant was restored md5-identical.

## Worktree base

The worktree was created on `master` (`8764137fe`, merge-base `e8964257e`), not on the planned base. The expected `git reset --hard cd47dcc0fb3662fe6ab25aec0f661a76511f99f6` fired, and HEAD was confirmed at `cd47dcc0f` before any work. `scripts/bootstrap-worktree.sh` reported BOOTSTRAP OK.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 (RED) | `f9f105d68` | test(278-02): add failing vocabulary one-home divergence fence (DEBT-09 RED, xfail strict) |
| 2 (GREEN) | `550ca89b6` | feat(278-02): one home for the filter vocabulary (DEBT-09 GREEN) |

TDD gate order holds: `test(278-02)` comes before `feat(278-02)`. No refactor commit was needed.

## Task 1: RED evidence

Normal run at the RED commit (gate-neutral):
```
1 passed, 4 xfailed, 1 warning
```
`grep -c "xfail(strict=True"` = 4. The markers are per test, never module level.

`--runxfail` run (exit 1). This is the RED, and it fails for the right reason: copies exist and there is no home.
```
E   AssertionError: DEBT-09: these modules do not import the vocabulary home (app.services.document_vocabulary) at top level: ['backend/app/services/document_search_service.py', 'backend/app/services/retrieval_scope.py', 'backend/app/services/view_filter_compiler.py']
E   ModuleNotFoundError: No module named 'app.services.document_vocabulary'
E   AssertionError: DEBT-09: the document-filter vocabulary has a literal copy outside its one home (app/services/document_vocabulary.py). Import TIMESTAMP_DATE_COLUMNS / LIST_FIELD_NAMES instead:
E       services/document_vocabulary.py missing: there is no home to import
E       services/document_search_service.py:97 date-word->column map _DATE_COLUMN
E       services/retrieval_scope.py:182 list-field rule LIST_FIELDS
E       services/retrieval_scope.py:141 date-word->column map _DATE_FIELD_COLUMN
E       services/view_filter_compiler.py:101 list-field rule LIST_VALUE_FIELDS
E   ModuleNotFoundError: No module named 'app.services.document_vocabulary'
FAILED test_278_vocabulary_one_home.py::test_named_modules_import_the_home
FAILED test_278_vocabulary_one_home.py::test_runtime_identity
FAILED test_278_vocabulary_one_home.py::test_no_literal_copy_outside_the_home
FAILED test_278_vocabulary_one_home.py::test_allowlisted_word_lists_match
4 failed, 1 passed
```
The AST ban names all four existing literal copies across the three modules. It does not trip on `_DATE_LABELS`, `_SORT` or `metadata_field._BUILTINS`.

## Task 2: GREEN

The verify command ran the fence plus test_272_review_fixes, the g1_topics_eq_compiler, scope_resolver, scope_seam, filter_validation and tool_schema suites, test_113_view_filter_compiler, test_275_find_archived, test_275_periods, test_272_pure_move and all six `test_271_*.py`. Result: **337 passed, 0 failed**. Every listed file existed, so none was dropped.

Broader check: all 27 unit files that name `view_filter_compiler`, `document_search_service`, `retrieval_scope` or `search_documents_tool` gave **538 passed, 1 xfailed**. The xfail is the pre-existing `test_114_view_filter_compiler.py::test_within_next_window_math_deferred` and is unrelated to this plan.

Acceptance greps:
- `grep -c '"source_created": "source_created_at"'` gives 0 in retrieval_scope.py and 0 in document_search_service.py.
- `grep -c 'frozenset({"topics"})' view_filter_compiler.py` gives 0.
- `grep -n "^from app\|^import app" document_vocabulary.py` returns nothing (exit 1), so the module is a leaf.
- `grep -c xfail test_278_vocabulary_one_home.py` gives 0.
- `git show --stat HEAD` lists exactly the 4 source files plus the test file. tool_dispatcher.py, search_documents_tool.py and models/document_search.py are absent.

## RED drives (SC#3)

Before any planting, backups were copied to the scratchpad: document_search_service.py md5 `79014c0caa837e81def6622657ebc089`, retrieval_scope.py md5 `d6611fc0e47e2cd17c869d1c21806b54`. Every restore was a `cp` from the backup, never `git checkout`.

| Drive | Plant | Failing tests | Restore md5 |
|---|---|---|---|
| (a) | document_search_service.py: the import line replaced by `_DATE_COLUMN = {"added": "created_at", "source_created": "source_created_at"}` | `test_values_equal_phase_base`, `test_named_modules_import_the_home`, `test_runtime_identity`, `test_no_literal_copy_outside_the_home` (names `services/document_search_service.py:58 date-word->column map _DATE_COLUMN`): **4 failed, 1 passed**, as expected | `79014c0caa837e81def6622657ebc089` = pre-plant ✔ |
| (b) | new file `backend/app/services/_planted_278_vocab.py` containing `LIST_FIELDS = ("topics", "keywords")` | `test_no_literal_copy_outside_the_home` (names `services/_planted_278_vocab.py:1 list-field rule LIST_FIELDS`): **1 failed, 4 passed**, as expected. The runtime layer cannot see this copy; only the walk catches it. | file deleted; `ls` gives "No such file or directory"; `git status --short backend/app` shows only the 4 intended paths |
| (c) | retrieval_scope.py: `_DATE_FIELD_COLUMN = {**TIMESTAMP_DATE_COLUMNS, "source_modified": "updated_at", "date": "date_typed"}` | `test_values_equal_phase_base`, `test_runtime_identity` (as expected), **plus** `test_no_literal_copy_outside_the_home` (the override entry is itself a literal word→column pair): **3 failed, 2 passed** | `d6611fc0e47e2cd17c869d1c21806b54` = pre-plant ✔ |

After all restores the verify suite re-ran at 337 passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The AST walk crashed on a BOM-prefixed module.** Found during Task 1. The first `--runxfail` run of `test_no_literal_copy_outside_the_home` failed with `SyntaxError: invalid non-printable character U+FEFF` on `app/services/email_extraction_service.py`. That is a RED for the wrong reason, and it would have stayed red after GREEN. The fix was to read files with `encoding="utf-8-sig"`, with a comment saying why. Fixed before the RED commit (`f9f105d68`).

**2. [Rule 1 - Bug] The missing-home check is reported as a violation, not an early assert.** Found during Task 1. An early `assert home.is_file()` would have hidden the list of existing copies, but the acceptance criteria require the RED message to name all three modules. The missing home is now the first entry in the collected violation list. Fixed in `f9f105d68`.

**3. [Minor] Removed the now-unused `_RED_REASON` constant along with the four xfail markers** (`550ca89b6`). The plan said "change nothing else". The constant was dead once the markers were gone, and it contains no "xfail" text, so removing it does not affect any acceptance grep. `import pytest` stays (harmless).

### Notes
- The plan's Task 2 behaviour says "all six fence tests". The fence has the **five** tests that Task 1's behaviour block lists; there is no sixth.
- SEED-336's behaviour is not changed (the `date`→`date_typed` extension and the relative-date path are byte-for-byte as before). The base-value pin proves this.
- `graphify update .` was not run in this worktree because graphify-out is tracked and shared. The orchestrator can run it after merge.

## Threat Flags

None. The new module is a constant-only leaf, and T-278-06/07/08 are mitigated as planned: values pinned with key order, runtime `is`, AST ban driven RED, and no app imports in the home.

## Known Stubs

None.

## TDD Gate Compliance

RED `test(278-02)` `f9f105d68` (gate-neutral: 1 passed, 4 xfailed; `--runxfail` 4 failed) → GREEN `feat(278-02)` `550ca89b6` (5/5 pass). Compliant.

## Self-Check: PASSED

- FOUND: backend/app/services/document_vocabulary.py
- FOUND: backend/tests/unit/test_278_vocabulary_one_home.py
- FOUND: commit f9f105d68
- FOUND: commit 550ca89b6
- MISSING (intended): backend/app/services/_planted_278_vocab.py

---
phase: 278-one-home-for-tools-and-filters
fixed_at: 2026-10-13T04:44:47Z
review_path: .planning/phases/278-one-home-for-tools-and-filters/278-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 0
accepted_as_measured: 1
deferred_info: 4
status: all_fixed
---

# Phase 278: Code Review Fix Report

**Fixed at:** 2026-10-13T04:44:47Z
**Source review:** `.planning/phases/278-one-home-for-tools-and-filters/278-REVIEW.md`
**Iteration:** 1
**Tree:** main tree, branch `develop` (the operator ran this on the main tree, not in a worktree).

**Summary:**
- Findings in scope: 5 (CR-01, WR-01..04). Info IN-01..04 are deferred, with reasons below.
- Fixed: 4 (CR-01 by the orchestrator, then WR-02, WR-03 and WR-04).
- WR-01: closed as a measured disposition. No code change.
- Skipped: 0.
- Hard constraint held: no moved handler body under `backend/app/services/tools/*` and no line of `tool_dispatcher.py` was edited.

| Finding | Outcome | Commit |
|---|---|---|
| CR-01 | fixed (orchestrator) | `774375682` |
| WR-01 | measured: no new failure outside `tests/unit`; integration not run | none |
| WR-02 | fixed | `7766f18ed` |
| WR-03 | fixed | `c2f3411f2` |
| WR-04 | fixed (shrink case); wrong-family case **accepted** | `c6316eb0a` |
| IN-01..04 | deferred | none |

## Fixed Issues

### CR-01: `test_141` security fence RED after the move

**Files modified:** `backend/tests/test_141_run_scope.py`
**Commit:** `774375682` (orchestrator, before this fixer ran)
**Applied fix:** retargeted the fence to `tools/render_template.py` and added an anchor assert first. Re-run here: `tests/test_141_run_scope.py` reported **15 passed**.

### WR-02: Two column tables sat outside the vocabulary home

**Files modified:** `backend/app/services/document_search_service.py`, `backend/tests/unit/test_278_vocabulary_one_home.py`
**Commit:** `7766f18ed`
**Applied fix:**
- `document_search_service._TIMESTAMP_COLUMNS` is now `set(_DATE_COLUMN.values())`.
  - `_DATE_COLUMN` *is* `TIMESTAMP_DATE_COLUMNS`, so the value comes from the home.
  - The type stays `set` and the members are identical. No test pins the type or the base literal: `grep -rn _TIMESTAMP_COLUMNS backend/tests` found no hits before the fix.
- `retrieval_scope._MONTH_SQL` is unchanged and stays constant SQL text. Splicing a column name into SQL would break `test_no_f_string_sql`.
- New test `test_column_tables_cover_the_home` asserts two things:
  - `dss._TIMESTAMP_COLUMNS == set(TIMESTAMP_DATE_COLUMNS.values())`
  - `set(retrieval_scope._MONTH_SQL) == set(retrieval_scope._DATE_FIELD_COLUMN.values())`

**RED evidence.** Three plants were applied to the working tree. Each was restored from a byte copy, and the md5 was checked identical after every one:

| Plant | Assertion that fired |
|---|---|
| A: add a 4th word `"source_indexed": "source_indexed_at"` to the home | `_MONTH_SQL` arm: `AssertionError: retrieval_scope._MONTH_SQL keys ['created_at', 'date_typed', 'source_created_at', 'source_modified_at'] differ from the date columns [..., 'source_indexed_at', ...]` |
| B: remove the `date_typed` entry from `_MONTH_SQL` | `_MONTH_SQL` arm: `Extra items in the right set: 'date_typed'` |
| C: restore the hand-typed `_TIMESTAMP_COLUMNS` literal **and** add the 4th home word | `dss` arm: `AssertionError: document_search_service._TIMESTAMP_COLUMNS ['created_at', 'source_created_at', 'source_modified_at'] differs from the home's columns [..., 'source_indexed_at', ...]` |

After restore, the md5 values matched the pre-plant values:
- `document_vocabulary.py`: `21ed942d64c97e8119b83927f1717c85`
- `retrieval_scope.py`: `d6611fc0e47e2cd17c869d1c21806b54`
- `document_search_service.py`: `a4258134ed3f40bfd6c442b33c4f2aea`

The fence file then reported 6 passed.

### WR-03: The divergence fence missed planted copies

**Files modified:** `backend/tests/unit/test_278_vocabulary_one_home.py`
**Commit:** `c2f3411f2`
**Applied fix:** `_violations_in` now also flags two shapes, whatever the variable name:
- A `Tuple`/`List`/`Set` literal whose elements are exactly `{"topics"}`. Because the walk visits every node, this covers:
  - an assignment under any name;
  - the argument of `frozenset(...)`, `set(...)` or `tuple(...)`;
  - an inline `field in ("topics",)` test.
- `dict(<date_word>=<column>, ...)` keyword calls.

Two smaller changes:
- Hits are de-duplicated, because a `LIST_*` target holding a topics-only literal matches both the old rule and the new one.
- The home file is no longer skipped. It is scanned under an explicit allowlist, `_LITERAL_ALLOWLIST`, with one entry: the home, plus the reason it may spell the values.

The test now fails in three new ways:
- **Stale allowlist entry.** An entry that produces no hits fails the test.
- **Blind detector.** The home's own hits must include both a `date-word->column map` and a `list-field rule`.
- **Copy outside the home.** As before, any copy elsewhere fails.

**Triage of the widened detector at HEAD:** the only hits anywhere in `backend/app` were in the home (`document_vocabulary.py:38`). No allowlist entry was needed beyond it, so nothing was silently allowed. `models/metadata_field.py:17` contains a mixed tuple that includes `"topics"` alongside other built-in field names. It is not a list-field rule, and the exactly-`{"topics"}` rule does not flag it.

**RED evidence.**
1. Plant: scratch module `backend/app/services/_wr03_plant.py` containing all four variants from the review.
   - Result: `1 failed`. All four were reported:
     ```
     services/_wr03_plant.py:12 list-field rule LIST_VALUE_FIELDS
     services/_wr03_plant.py:11 date-word->column map X
     services/_wr03_plant.py:2 list-field rule ARRAY_FIELDS
     services/_wr03_plant.py:6 list-field rule <expr>
     ```
   - The plant was deleted, and `ls` confirmed it was gone. The file then reported **6 passed**.
2. Plant: an allowlist entry `services/retrieval_scope.py` added to the test.
   - Result: `AssertionError: allowlist entries that no longer match anything (stale, or the detector went blind): ['services/retrieval_scope.py']`.
   - Restored md5-identical: `c1810fd086112e7f5527d0c6508a7a8a`.
3. Direct probe of `_violations_in` with the review's inputs. All four are caught: `ARRAY_FIELDS`, `<expr>`, `X`, `LIST_VALUE_FIELDS`. The non-copy `Y = ("title","topics")` returns `[]`.

### WR-04: The D-07 checker let a fence's scan list shrink

**Files modified:** `scripts/check-test-retarget-only.py`
**Commit:** `c6316eb0a`
**Applied fix:** new Rule 4, documented in the module docstring.
- Within each diff hunk, count the `.py` string literals on removed lines classed PATH or NORM-EQUAL. That count may not exceed the count on added lines.
- Each unpaired removal is reported as `path-entry-removed (N removed vs M added in this hunk)`.
- Comments and imports that name a file do not count.
- A hunk that only adds lines cannot trip the rule.

**Wrong-family retarget: ACCEPTED, not fixed.** The reason is now under "HOW THIS COULD LIE". Detecting it needs a handler-to-file map at the new rev, plus knowledge of which handler each fence concerns. That means re-deriving D-08's per-fence intent, which is not cheap. Rule 4 catches a shrinking scan list. A same-count swap to the wrong family is left to D-08's anchor asserts.

**Real move range still CLEAR:**
- `check-test-retarget-only.py 5642c0dd9 18abc1ed5`: 40 files in scope, `retarget-only: CLEAR`, exit 0.
- `--no-loss 5642c0dd9 18abc1ed5`: `no-loss: CLEAR` (4332 removed lines all reappear).

**RED evidence (WORKTREE plants):**
- Plant 1: deleted `APP_DIR / "services" / "tools" / "memory.py",` from `test_259_closed_core_inventory.py:22`.
- Plant 2: deleted `"services/tools/connector.py",` from `test_264_born_for_carrier.py:247`.

| Checker | Result |
|---|---|
| **Pre-fix** (`git show HEAD:` copy, run against `HEAD WORKTREE`) | `retarget-only: CLEAR`, **exit 0**. This reproduces the defect. |
| **Fixed** | `VIOLATION — 2 changed line(s)`. Both plants are named as `path-entry-removed (1 removed vs 0 added in this hunk)`. **exit 1**. |

Both plants were restored md5-identical:
- `test_259...`: `bf67eb46bc97e17e03056a163cb24b00`
- `test_264_born_for_carrier.py`: `77e879e2a4766ee43a98269c4e581f49`

The temporary pre-fix checker copy was deleted.

## WR-01 disposition (measured by the orchestrator; no code change)

The 16 root-level `backend/tests/*.py` files that reference the dispatcher were run one file at a time in two places: at HEAD, and in a base worktree at `25b4235c5`. **The failing sets are IDENTICAL:**
- `test_098::test_run_start_resolution`
- `test_120::...test_phase_types_ask_user_prompt_tags_harness`
- `test_223::test_execution_failure_audited`
- `test_223::test_success_audited`

`test_096_ci_workflow_regression` hangs (60 s pytest-timeout) at **both** base and HEAD, so the hang is inherited. The only new failure outside `tests/unit` was `test_141` (CR-01), which is fixed in `774375682`.

**`tests/integration` was NOT run.** It needs the live local DB, and those suites seed and tear down rows, so a run would mutate it. Four integration files import the vocabulary modules: `test_114_resolve_range_date`, `test_115_catalog`, `test_271_two_org_fence` and `test_272_scope_rls`. They were also not run here, for the same reason. The review statically verified the integration suite's patch targets and imports against the module. It remains **owed**: run it at base and at HEAD with the DB up, then compare the failing sets.

## Verification runs (after all fixes, at `c6316eb0a`)

| Command (in `backend/`) | Result |
|---|---|
| `pytest tests/unit/test_278_*.py tests/unit/test_272_*.py tests/unit/test_255_extension_contract_guard.py tests/unit/test_190_ssti_fence.py -q` | **298 passed** |
| `pytest` over the 19 `tests/unit` files that reference `document_search_service`, `retrieval_scope` or `view_filter_compiler` | **406 passed, 1 xfailed** (this set overlaps the row above) |
| `pytest tests/test_141_run_scope.py -q` | **15 passed** |
| `node scripts/check-hot-file-ledger.cjs .planning/phases/278-one-home-for-tools-and-filters` | `ledger gate OK` |

The full backend gate was not run here; the orchestrator runs it.

## Deferred (Info, out of scope for this pass)

### IN-01: `_DATE_COLUMN` is a shared mutable dict, and `retrieval_scope` snapshots it at import

**Deferred.** The suggested fix (`types.MappingProxyType`) changes the home's type. That would break `test_values_equal_phase_base`'s `type(runtime) is type(base)` pin, so the pin would also need relaxing to `Mapping`. That is a behaviour change plus a pin change, not a review fix. Nothing in the repo mutates the home today. Re-open trigger: the next phase that edits `document_vocabulary.py`.

### IN-02: Two retargets changed what a test proves (test_273 `_no_retrieval_patches`, test_272 old target)

**Deferred.** The fix is a deviation note in `278-03-SUMMARY.md`, which is a record edit outside this fix scope. Neither change hides a regression. The orchestrator can add the note at close.

### IN-03: Handler log records now use `app.services.tools.<family>` logger names

**Deferred.** The fix is an ops/deploy note in `docs/DEPLOYMENT-LESSONS.md` or the deploy notes. It does not change code, and the review verified that nothing in the repo filters on the old logger name. Fold it into the next production promotion's parity checklist.

### IN-04: Stale line references and import-cycle wording in moved comments and docstrings

**Deferred, by constraint.** Docstrings count toward the AST pure-move pin, and moved handler bodies must not be edited in this pass. The fix belongs in a dedicated docs-only follow-up commit that corrects the references beside their originals.

---

_Fixed: 2026-10-13T04:44:47Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

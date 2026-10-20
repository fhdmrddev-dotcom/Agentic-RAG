---
phase: 278-one-home-for-tools-and-filters
reviewed: 2026-10-13T04:21:52Z
depth: standard
diff_base: 25b4235c5
files_reviewed: 65
files_reviewed_list:
  - .claude/hooks/extension-contract-guard.js
  - backend/app/services/document_search_service.py
  - backend/app/services/document_vocabulary.py
  - backend/app/services/retrieval_scope.py
  - backend/app/services/retrieval_service.py
  - backend/app/services/tool_dispatcher.py
  - backend/app/services/tools/__init__.py
  - backend/app/services/tools/agent_control.py
  - backend/app/services/tools/base.py
  - backend/app/services/tools/connector.py
  - backend/app/services/tools/documents.py
  - backend/app/services/tools/memory.py
  - backend/app/services/tools/render_template.py
  - backend/app/services/tools/runtime_gap.py
  - backend/app/services/tools/sandbox.py
  - backend/app/services/tools/skills.py
  - backend/app/services/tools/workspace.py
  - backend/app/services/view_filter_compiler.py
  - scripts/check-extension-contract.cjs
  - scripts/check-test-retarget-only.py
  - scripts/run-defense-mutations.sh
  - scripts/uat-adversarial-sync.py
  - backend/tests/integration/test_085_ask_user_handler.py
  - backend/tests/integration/test_085_lifespan_shutdown.py
  - backend/tests/test_2171_search_error_audit.py
  - backend/tests/test_223_dispatcher_audit.py
  - backend/tests/test_224_approval_deadline.py
  - backend/tests/test_workspace_template.py
  - backend/tests/unit/security/adversarial_corpus.py
  - backend/tests/unit/security/test_adversarial_corpus.py
  - backend/tests/unit/services/test_tool_dispatcher_trifecta_fence.py
  - backend/tests/unit/test_075_1_observability.py
  - backend/tests/unit/test_115_handler_modes.py
  - backend/tests/unit/test_142_load_skill_flag.py
  - backend/tests/unit/test_142_read_skill_file.py
  - backend/tests/unit/test_142_repeat_guard.py
  - backend/tests/unit/test_142_runtime_gap.py
  - backend/tests/unit/test_151_attach_handler.py
  - backend/tests/unit/test_151_fetch_handler.py
  - backend/tests/unit/test_151_registration.py
  - backend/tests/unit/test_190_connector_source_fence.py
  - backend/tests/unit/test_190_ssti_fence.py
  - backend/tests/unit/test_216_connector_wiring_reachable.py
  - backend/tests/unit/test_221_application_grouping.py
  - backend/tests/unit/test_222_auth_scheme.py
  - backend/tests/unit/test_244_attachment_hydration.py
  - backend/tests/unit/test_255_extension_contract_guard.py
  - backend/tests/unit/test_259_closed_core_inventory.py
  - backend/tests/unit/test_260_financial_analyzer_conversation.py
  - backend/tests/unit/test_261_closed_core_inventory.py
  - backend/tests/unit/test_262_folder_scope_wall.py
  - backend/tests/unit/test_264_born_for_carrier.py
  - backend/tests/unit/test_264_load_skill_born_for.py
  - backend/tests/unit/test_264_one_home_born_for_predicate.py
  - backend/tests/unit/test_264_unchanged_sites_fenced.py
  - backend/tests/unit/test_272_search_tool_move.py
  - backend/tests/unit/test_273_show_artifact_tool.py
  - backend/tests/unit/test_273_tool_wiring.py
  - backend/tests/unit/test_275_agent_wall.py
  - backend/tests/unit/test_278_pure_move.py
  - backend/tests/unit/test_278_registry_pin.py
  - backend/tests/unit/test_278_vocabulary_one_home.py
  - backend/tests/unit/test_template_render.py
  - backend/tests/unit/test_tool_approval_always.py
  - backend/tests/unit/test_tool_dispatcher.py
findings:
  critical: 1
  warning: 4
  info: 4
  total: 9
status: issues_found
---

# Phase 278: Code Review Report

**Reviewed:** 2026-10-13T04:21:52Z
**Depth:** standard
**Files Reviewed:** 65
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

I reviewed the SEAM-03 dispatcher split, the DEBT-09 vocabulary home, the extension-contract guards, the D-07 retarget checker and the 43 test files changed since `25b4235c5`.

**The production move holds up under direct checks.** These were verified, not just read:
- Every `tools/*.py` module imports first in a fresh interpreter.
- No moved body has a function-local import of `tool_dispatcher`.
- The only base imports dropped are `metadata_field_service` and `retrieval_service.search_documents`, both unused.
- No tools module imports a name from a different source module than the base did.
- No module-level mutable state is split across modules. `_hydrated_files`, `_hydration_failures` and the heal-bound store live only in `tools/sandbox.py`, and no `global` statement exists.
- The four re-exports are the same objects as their homes.
- The TRUST-03 trifecta mutation (`--disable-defense=tool_dispatcher_trifecta`) still turns 2 corpus tests RED.
- The SSTI fence still asserts the construction exists in `tools/render_template.py`.
- The three vocabulary importers produce values equal to base, in the same key order.
- The 278 pins, test_190_ssti and test_255 pass: 68 passed. The scanner reports `OK — all 17 files`. The retarget checker reports CLEAR over 5642c0dd9..18abc1ed5.

**The defect is in the test inventory, not the app.** One source fence that reads `tool_dispatcher.py` lives outside `tests/unit`. It was never repointed and is now RED. The phase's "failing set identical to base" proof only covered `tests/unit`, but CI runs `pytest tests`, so this proof could not have seen it.

The secondary findings are gaps in the two new proof tools:
- The vocabulary fence and the "one home" claim miss real residual encodings.
- The retarget checker lets a fence's scan list shrink silently.

## Critical Issues

### CR-01: `test_141` security fence is RED after the move. It was never repointed (D-08 missed it), and the unit-only gate could not see it

**File:** `backend/tests/test_141_run_scope.py:315-318`
**Issue:** `test_both_branch2_resolve_sites_pass_own_claim` guards Landmine 1. Both sites that reach Branch 2 must derive an own-claim before resolving a template asset, or a run can resolve another run's claimed template. The test reads `app/services/tool_dispatcher.py` as text and asserts `"own_claim_for_ctx" in td`.

At base the dispatcher held 2 occurrences. At HEAD it holds 0, because they moved to `tools/render_template.py` (2 occurrences). Driven at HEAD:
```
FAILED tests/test_141_run_scope.py::test_both_branch2_resolve_sites_pass_own_claim
E   AssertionError: tool_dispatcher must derive own-claim via the helper (Plan 02)
```
This is a new failure caused by the move. `phase_types.py` and the test file are unchanged in the diff. The 278-01 inventory of "19 tests that read `tool_dispatcher.py` source" (D-08) covered `tests/unit` only. `tests/test_141_run_scope.py` is in `backend/tests/`, outside the gate scope. `.github/workflows/backend-tests.yml:89` runs `pytest tests -q`, so CI will report it.

Leaving it red is also a security regression in practice. A permanently red fence stops being read, so a later edit that drops `own_claim_for_ctx` from `_handle_render_template` would go unnoticed.

**Fix:** repoint it to the file that now holds the code, and anchor it first (the D-08 pattern):
```python
    # Phase 278 (SEAM-03): _handle_render_template moved to tools/render_template.py
    td_path = _BACKEND / "app" / "services" / "tools" / "render_template.py"
    td = td_path.read_text(encoding="utf-8")
    assert "_handle_render_template" in td, f"ANCHOR: {td_path.name} no longer holds _handle_render_template"
    pt = (_BACKEND / "app" / "services" / "harness" / "phase_types.py").read_text(encoding="utf-8")
    assert "own_claim_for_ctx" in td, "tools/render_template.py must derive own-claim via the helper (Plan 02)"
```
Then re-run the move-sensitive test set outside `tests/unit` (see WR-01).

## Warnings

### WR-01: The no-regression proof is scoped to `tests/unit`, but 30 non-unit test files import or read the dispatcher and CI runs all of `tests/`

**File:** `.planning/phases/278-one-home-for-tools-and-filters/278-03-SUMMARY.md` ("Full backend gate"); `.github/workflows/backend-tests.yml:89`
**Issue:** The failing-SET diff (`71 = 71`, both comm sets empty) is computed only over `pytest tests/unit`. `grep -rln tool_dispatcher backend/tests | grep -v tests/unit/` lists 30 files: 16 under `tests/integration/` and 14 at the `tests/` root.

Only 6 of them were retargeted. I ran 14 of the root-level ones file by file:
- `test_098::test_run_start_resolution` and `test_223::test_execution_failure_audited` / `test_success_audited` fail as inherited failures (they are in the 278-01 tip set).
- `test_096` hangs under a 45 s timeout.
- `test_141` is a new failure (CR-01).

The integration suite (Redis/DB) was not run by the phase at all. Its patch targets and imports are statically sound: every `from app.services.tool_dispatcher import X` and every `app.services.tool_dispatcher.<name>` string in `tests/` resolves on the module today.
**Fix:** before close, run `pytest tests --ignore=tests/unit -q -p no:cacheprovider` at base and at HEAD with Redis up, and compare the failing sets. Record that set diff next to the unit-gate diff. Widen the D-08 source-reader inventory grep from `tests/unit` to `backend/tests`.

### WR-02: The vocabulary home is not the only encoding. The column half still lives in `_TIMESTAMP_COLUMNS` and `_MONTH_SQL`, and the fence cannot see either

**File:** `backend/app/services/document_search_service.py:109`, `backend/app/services/retrieval_scope.py:146-151`
**Issue:**
- `_TIMESTAMP_COLUMNS = {"created_at", "source_created_at", "source_modified_at"}` is a hand-typed copy of `set(TIMESTAMP_DATE_COLUMNS.values())`. It decides at `:412` whether `_sort_rows` parses values as datetimes.
- `retrieval_scope._MONTH_SQL` is keyed by the same columns, and `:414` indexes it with `_MONTH_SQL[_DATE_FIELD_COLUMN[field]]`.

If a fourth date word were added to the home (the "one-place change" CONTEXT promises for SEED-336), Find would sort that column as strings, and the month read would raise `KeyError` on the agent path. The fence's `_is_date_map` only matches dicts keyed by a date word, so both copies pass it (driven: `_violations_in('_TIMESTAMP_COLUMNS = {...}') -> []`).
**Fix:** derive the copy, and pin the dependent table:
```python
# document_search_service.py
_TIMESTAMP_COLUMNS = set(_DATE_COLUMN.values())
# test_278_vocabulary_one_home.py
def test_month_sql_covers_every_date_column():
    scope = importlib.import_module("app.services.retrieval_scope")
    assert set(scope._DATE_FIELD_COLUMN.values()) <= set(scope._MONTH_SQL)
```

### WR-03: The divergence fence's list-rule detector depends on the variable name. A copy not named `*list*`, or an inline membership test, passes

**File:** `backend/tests/unit/test_278_vocabulary_one_home.py:182, 245-248`
**Issue:** Layer 2 flags a `"topics"` collection only when the assignment target matches `(?i)list`. The date-map detector also misses the `dict(...)` call form. I fed planted copies to the module's own `_violations_in`:

| Planted copy | Result |
|---|---|
| `ARRAY_FIELDS = frozenset({"topics"})` | `[]` (missed) |
| `if field in ("topics",): ...` | `[]` (missed) |
| `X = dict(added="created_at", source_created="source_created_at")` | `[]` (missed) |
| `LIST_VALUE_FIELDS = frozenset({"topics"})` | caught |

D-14 requires the fence to cover "any other backend module that redefines ... the list-field set". A redefinition under a neutral name is exactly the drift DEBT-09 describes: it began as `LIST_FIELDS` versus `LIST_VALUE_FIELDS`, and the next one need not contain "list".
**Fix:**
- Flag any `Tuple`/`List`/`Set` (or `frozenset`/`set`/`tuple` call) whose elements are exactly `{"topics"}`, whatever the target name. Also flag a `Compare` with an `In`/`NotIn` operator whose right side is such a literal.
- Treat `ast.Call(func=Name("dict"))` keywords the same way as dict keys.
- Drive both RED against a planted copy.

### WR-04: The D-07 checker lets a fence's scan list shrink. Deleting a file entry is classified PATH and passes

**File:** `scripts/check-test-retarget-only.py:174-189, 236-237`
**Issue:** `_is_path_line` accepts any line holding a `.py` string or path segments. It also accepts a line removed with no paired addition, because `judge` only rejects `cls is None`. Driven:
```
'APP_DIR / "services" / "tools" / "memory.py",'  -> PATH
'"services/tools/connector.py",'                   -> PATH
'_AGENT_WALL_FILE = "services/tools/skills.py"'   -> PATH
norm(tools.sandbox.aexec) == norm(tools.documents.aexec) -> True
```
So a move commit could drop a handler file from `_HANDLER_FILES`, `_MUST_BE_SILENT`, `_NO_BRANCH_FILES` or `_SANDBOXED_SITES`, and still pass "CLEAR". That narrows what an absence fence scans, which is the vacuous-pass failure D-08 exists to prevent. The fences' own `assert seen == len(_HANDLER_FILES)` cannot catch it, because it compares the tuple against itself. The script's docstring names the wrong-file repoint, but not the deletion case.
**Fix:** in RETARGET mode, require PATH-class lines in a hunk to be count-preserving: the number of removed PATH lines must equal the number of added PATH lines, unless the hunk only adds. Report an unpaired PATH removal as `path-entry-removed`. Alternatively, pin each D-08 constant's length inside the fence with a literal (for example `assert len(_HANDLER_FILES) == 10`), so a shrink changes an assert line.

## Info

### IN-01: `_DATE_COLUMN` is now a shared mutable dict, while `retrieval_scope` takes import-time snapshots

**File:** `backend/app/services/document_search_service.py:58`, `backend/app/services/retrieval_scope.py:142-143`
**Issue:** `document_search_service._DATE_COLUMN is TIMESTAMP_DATE_COLUMNS` (live object), but `retrieval_scope._DATE_WORDS` and `_DATE_FIELD_COLUMN` are copies built at import. Any in-process mutation of the home, such as a test using `monkeypatch.setitem` on the dict, reaches Find but not the agent filter path. That reintroduces, at runtime, the divergence DEBT-09 removed from the source.
**Fix:** expose the home as read-only (`types.MappingProxyType`) and relax the `type(runtime) is type(base)` check to `Mapping`. Or document that the home must never be mutated.

### IN-02: Two retargets changed what a test proves, and NORM-EQUAL hides it

**File:** `backend/tests/unit/test_273_show_artifact_tool.py:428`, `backend/tests/unit/test_272_search_tool_move.py:210`
**Issue:**
- At base, `_no_retrieval_patches` patched `tool_dispatcher.search_documents`, a dead binding the search handler never read, so it was a no-op. After the retarget, `search_documents_tool.search_documents` patches the live binding, so the test got stricter.
- test_272's "old target" is now `retrieval_service.search_documents` rather than the dispatcher's binding.

Neither change hides a regression, but both are semantic test changes that the D-07 checker reports as pure retargets.
**Fix:** note both in 278-03-SUMMARY's deviations, so the "retarget-only" claim stays accurate.

### IN-03: Handler log records changed logger name

**File:** `backend/app/services/tools/*.py` (`logger = logging.getLogger(__name__)`)
**Issue:** Records formerly under `app.services.tool_dispatcher` now come from `app.services.tools.<family>`. Nothing in the repo filters on the old name (verified). Coolify log alerts or LangSmith filters keyed on it would go quiet.
**Fix:** add a line to the deploy notes or `docs/DEPLOYMENT-LESSONS.md`, or set a parent `app.services.tools` logger level wherever the dispatcher logger was configured.

### IN-04: Comments moved verbatim with stale line-number references, and the comments describing the import cycle are now wrong

**File:** `backend/app/services/tools/documents.py:90-91, 367-368`; `backend/tests/unit/test_190_connector_source_fence.py:620`
**Issue:**
- `_ensure_resolver`'s docstring describes the cycle as `tool_dispatcher → document_view_resolver → ...`. The importer is now `tools.documents`.
- `:367` cites `tool_dispatcher.py:2549-2568` and `:1114-1122`, which no longer exist.
- The test_190 comment still says "tool_dispatcher resolves first-party capability adapters", left as-is because of the checker's assert-span rule.

These cannot be fixed inside the pure-move commit without breaking the AST/no-loss proofs, but they are now misleading.
**Fix:** a follow-up docs-only commit that updates the references beside the originals (strike through, per project convention).

---

_Reviewed: 2026-10-13T04:21:52Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

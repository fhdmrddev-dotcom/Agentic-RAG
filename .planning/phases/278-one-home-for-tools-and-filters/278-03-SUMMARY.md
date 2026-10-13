---
phase: 278-one-home-for-tools-and-filters
plan: 03
subsystem: backend/tool-dispatcher
tags: [g5-extraction, pure-move, seam-03, extension-contract]
requires:
  - "278-01 pins: test_278_registry_pin.py, test_278_pure_move.py, check-test-retarget-only.py, hardened fences (5642c0dd9)"
provides:
  - "backend/app/services/tool_dispatcher.py as the registry module (274 lines)"
  - "backend/app/services/tools/ — 10 family modules + docstring-only __init__.py"
  - "extension-contract scanner / hook / test_255 covering all 11 tools/*.py (17 paths)"
affects: [278-04]
tech-stack:
  added: []
  patterns:
    - "AST-span slicing by a throwaway script keyed on the pin's MOVE_MAP (never retyped)"
    - "per-module imports derived from the pin's own symtable unbound-global check"
    - "patch-where-used retargets with td_<family> aliases (NORM-EQUAL under the D-07 checker)"
key-files:
  created:
    - backend/app/services/tools/__init__.py
    - backend/app/services/tools/base.py
    - backend/app/services/tools/documents.py
    - backend/app/services/tools/skills.py
    - backend/app/services/tools/sandbox.py
    - backend/app/services/tools/runtime_gap.py
    - backend/app/services/tools/render_template.py
    - backend/app/services/tools/workspace.py
    - backend/app/services/tools/memory.py
    - backend/app/services/tools/agent_control.py
    - backend/app/services/tools/connector.py
    - .planning/phases/278-one-home-for-tools-and-filters/278-03-HANDOFF.md
    - .planning/phases/278-one-home-for-tools-and-filters/deferred-items.md
  modified:
    - backend/app/services/tool_dispatcher.py
    - backend/tests/unit/test_278_pure_move.py
    - "38 retargeted test files + scripts/uat-adversarial-sync.py + scripts/run-defense-mutations.sh (all in the move commit)"
    - scripts/check-extension-contract.cjs
    - .claude/hooks/extension-contract-guard.js
    - backend/tests/unit/test_255_extension_contract_guard.py
    - docs/EXTENSION-CONTRACT.md
decisions:
  - "Handler log records are now named app.services.tools.<family>: each module has logger = logging.getLogger(__name__). No test filters on the old name (grep: 0 hits)"
  - "test_272's 'old target alone is missed' patch moves to retrieval_service. tool_dispatcher no longer binds search_documents, so the old target now raises instead of being missed"
  - "The stale comment inside test_190_connector_source_fence's exact-list assert is left unchanged: a changed comment line inside an assert span is itself a D-07 violation"
metrics:
  duration: "~100 min"
  completed: 2026-10-13
  tasks: 3
  files: 59
---

# Phase 278 Plan 03: Split tool_dispatcher.py into the registry + tools/ families Summary

`tool_dispatcher.py` went from 5,068 lines to a 274-line registry module, and its 99 handler bindings now live in ten `app/services/tools/<family>.py` modules. This was done as one mechanically proven pure move: every moved binding is AST-identical to PHASE_BASE, the `_TOOL_REGISTRY` literal is byte-identical (30 tools), tests changed only by retargets, no comment line was lost, and the full unit gate's failing set equals the base set exactly.

## Worktree base

The worktree started on `8764137fe` (merge-base `e8964257e`, master lineage). **The base-correction reset fired as expected**: `git reset --hard b8e46ef57`, so HEAD was `b8e46ef5781cae1225eb1aacac9df5c7ac5d8d51` (wave 1 merged). `git diff --stat 25b4235c5 HEAD -- backend/app/services/tool_dispatcher.py` was empty, and the base copy's md5 `639e441628fd868f365774189fbf49a0` matches 278-01's. `scripts/bootstrap-worktree.sh` reported BOOTSTRAP OK.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1+2 (ONE commit, D-06) | `18abc1ed5` | refactor(278-03): split tool_dispatcher.py into registry + tools/ families (SEAM-03, pure move) |
| 3 | `5867247d3` | chore(278-03): extension-contract guards cover the tools/ package (D-05) |

`git show --stat 18abc1ed5` lists 54 paths: `tool_dispatcher.py`, the 11 `tools/*.py` files, `test_278_pure_move.py`, 39 test files under `backend/tests/`, and the two scripts. Under `backend/app` it touches only those 12 files. `git diff --diff-filter=D HEAD~1 HEAD` is empty.

## Final line counts

| Module | Lines |
|---|---|
| `tool_dispatcher.py` | 274 |
| `tools/__init__.py` | 20 (docstring only) |
| `tools/base.py` | 149 |
| `tools/documents.py` | 762 |
| `tools/skills.py` | 759 |
| `tools/sandbox.py` | 1218 |
| `tools/runtime_gap.py` | 310 |
| `tools/render_template.py` | 787 |
| `tools/workspace.py` | 223 |
| `tools/memory.py` | 121 |
| `tools/agent_control.py` | 478 |
| `tools/connector.py` | 380 |

Cross-family imports are all by name:
- skills imports `_fetch_owned_document_bytes` from documents and `SCRIPT_EXTS` from runtime_gap.
- sandbox imports `_resolve_skill_visibility_or` from skills, and `KNOWN_MISSING_MODULES, _NO_MODULE_RE, _classify_runtime_gap, _code_references_dead_token, _repeat_blocked_result` from runtime_gap. The symtable check did not need `_message_for_dead_token`.
- documents imports `_normalize_optional_int` from workspace.
- Every handler module imports `ToolContext, ToolResult` from `tools.base` at module level.

The registry module re-exports exactly `ToolContext`, `ToolResult`, `SCRIPT_EXTS` and `_attachment_container_path`. It imports only `json`, `logging`, `Callable`, `load_app_settings`, the handlers, the two unchanged out-of-file handler imports, and `_handle_connector_chat_tool`. There is no `aexec`, `write_audit_entry`, `ws_*`, `run_in_threadpool` or `search_documents` (acceptance grep = 0).

## How the cut was made (Task 1)

A throwaway script in the scratchpad (`s278/slice.py`, never in the repo) did the cut:
- It imported `MOVE_MAP` / `UNMOVED` / `PER_MODULE` from `test_278_pure_move.py`.
- It gave every top-level node the span from the previous node's `end_lineno + 1` to its own `end_lineno`, so comment blocks travel with the code that follows them. The comment above the mid-file `import re as _re_filename` travelled with `_SAFE_OUT_FILENAME_RE`.
- It derived each module's imports by running the pin's own `_unbound_globals` (symtable) over the moved body. Each kept alias was rendered from the base import statement it came from, so source modules and `as` aliases stay identical (for example, `resolve_document_id` still comes from `retrieval_service`).
- Inter-import header comments were hand-placed beside the import they explain: Phase 151 / 275 / 115 / 116 in documents, SEED-125 in skills, Phase 147 in the registry.
- The base docstring is kept verbatim, with a dated Phase 278 paragraph added. The two "split still OWED" comments are kept, each with a `⚠ CORRECTED 2026-10-13` line under it.

All `_xfail_until_move` markers and the `_TO_MOVE` constant were removed from `test_278_pure_move.py`. Its gate-neutrality paragraph was reworded to past tense, so `grep -c xfail` = 0. `278-03-HANDOFF.md` was written at the end of Task 1, as the plan specifies.

## Test retargets (Task 2, same commit)

These follow RESEARCH tables A-E plus the D-08 constants hardened in 278-01:
- **String targets** were moved to the resolving module, for example `test_085_*` → `tools.agent_control.aexec`. Cross-family patch-where-used: `test_151_attach_handler` `_fetch_owned_document_bytes` → `tools.skills`.
- **Alias swaps** (import lines only):
  - test_223 → connector (×6)
  - test_115 and test_262 → documents; test_275 → documents (×11)
  - test_142_load_skill_flag and test_151_attach_handler → skills
  - test_142_repeat_guard and test_244: the module alias `tool_dispatcher` now names `tools.sandbox`, with a comment line explaining why
  - test_template_render → render_template (×5)
  - test_tool_dispatcher → sandbox (×4)
- **New `td_<family>` aliases:** `td_skills` / `td_sandbox` (test_264_load_skill_born_for, test_264_unchanged_sites_fenced) and `td_connector` (test_222).
- **Split imports:** test_224 `_APPROVAL_TIMEOUT_SECONDS`, test_142_read_skill_file, test_142_runtime_gap, test_151_fetch/registration, test_273_tool_wiring, test_2171 (→ `audit_service`), test_tool_dispatcher (workspace + sandbox).
- **D-08 constants:**
  - `_HANDLER_FILES` (259/261) → 8 handler families + `search_documents_tool.py` + `show_artifact_tool.py`
  - `_HANDLER_SRCS` / `_HANDLER_SRC_FILES` → (skills, sandbox)
  - `_FETCH_CALLER_FILES` → (documents, skills); `_AGENT_WALL_FILE` and the `_COLUMN_FENCE_FILES` row → documents
  - `_NO_BRANCH_FILES` / `_MUST_BE_SILENT` keep `tool_dispatcher.py` and add the 9 function-bearing tools modules
  - `_CONNECTOR_TOOL_FILE`, test_190 exact list, test_221 param and test_tool_approval_always → connector; test_190_ssti → render_template; test_075_1 → documents
- **Table E:** `scripts/uat-adversarial-sync.py` and the two `adversarial_corpus.py` labels → connector; `run-defense-mutations.sh:27` label → `tools/connector.py`.
- **STAY patches were left untouched.** `grep -c` of `app.services.tool_dispatcher._handle_render_template` in test_emitters.py = 3. test_147 ×4, test_llm_emit_executor and test_273 :430-431 are unchanged.

### D-07 / no-loss over the move commit

```
$ check-test-retarget-only.py HEAD~1 HEAD            (HEAD = 18abc1ed5)   EXIT=0
retarget-only check HEAD~1 -> HEAD: 40 file(s) in scope (41 changed under backend/tests + extra scope)
assert-span path lines (allowed, listed for review):
  backend/tests/unit/test_190_connector_source_fence.py:622 [-] PATH "app/services/tool_dispatcher.py",
  backend/tests/unit/test_190_connector_source_fence.py:622 [+] PATH "app/services/tools/connector.py",
retarget-only: CLEAR (no assert line changed; every changed line is a retarget)

$ check-test-retarget-only.py --no-loss HEAD~1 HEAD                       EXIT=0
no-loss check HEAD~1 -> HEAD: 4332 removed non-blank non-import line(s) from backend/app/services/tool_dispatcher.py; 11 tools/ file(s) at the new rev
no-loss: CLEAR (every removed line reappears in tools/*.py or tool_dispatcher.py)
```
Running the same pair from `5642c0dd9` (278-01's pre-move base) to HEAD also gives EXIT=0 in both modes. 41 files changed under scope; 40 are checked, because `test_278_pure_move.py` is excluded by design.

**No-loss RED drive:**
- Deleted line 67 of `tools/sandbox.py` (`# EXEC-01 (Phase 176-03 / D-01..D-04) — reliable declared-library install +`).
- `--no-loss HEAD WORKTREE` → **EXIT=1**, `tool_dispatcher.py:1623 [-] lost # EXEC-01 (Phase 176-03 / D-01..D-04) — reliable declared-library install +`.
- Restored from backup: md5 `c576c0f13c66a6405a1108f51f47fd66` before = after. Re-run → EXIT=0.

### Targeted suites (Task 2 verify command), failing-SET compared with the 278-01 tip

The base run was made by temporarily restoring the base `tool_dispatcher.py` and `test_278_pure_move.py` and moving `tools/` aside. The Task 1 files were then restored from backup, and all 13 md5s were verified OK.

| Run | Result | Failing set |
|---|---|---|
| 278-01 tip (`b8e46ef57`) | 3 failed, 647 passed, 28 xfailed | test_223 `test_execution_failure_audited`, `test_success_audited`; test_098 `test_run_start_resolution` |
| after the move | 3 failed, 684 passed, 0 xfailed, 0 xpassed, 0 errors | **identical** |

The +9 tests come from the one_home `_MUST_BE_SILENT` parametrize growing from 4 to 13 files (measured with `--collect-only`).

Other checks:
- Frontend: `GSD_VITEST_MAX_WORKERS=2 npx vitest run src/docs/__tests__/docsContent.test.ts src/docs/__tests__/docsCoverageGate.test.ts` → 2 files, 22 passed.
- `python -c "import app.main"` plus the five td importers (agent_loop, threads, task_service, api/skills, emitters) → OK.
- `len(_TOOL_REGISTRY)` = 30.

## Extension-contract guards (Task 3)

- `scripts/check-extension-contract.cjs` `TRIGGER_PATHS`, `.claude/hooks/extension-contract-guard.js` `WATCHED_FILES` and `test_255` `TRIGGER_FILES` now each name all 11 `tools/*.py` explicitly, giving 17 paths. The headers were updated as well. `grep -c backend/app/services/tools/` = 22 in each JS file.
- `test_255` gained `assert len(TRIGGER_FILES) == 17` with a non-vacuity comment.
- No rule regex changed.
- `docs/EXTENSION-CONTRACT.md` got two dated Phase 278 notes beside the original lines (the tools home, and the trigger list).

| RED drive | Result | Restore md5 (before = after) |
|---|---|---|
| (1) `'backend/app/services/tools/memory.py'` → `memroy.py` in `TRIGGER_PATHS` | scanner **EXIT=1**: `File not found: backend/app/services/tools/memroy.py` | `717746462775736a7c6414b58d652c37` |
| (2) `import importlib` planted at `tools/memory.py:20` | scanner **EXIT=1** (`importlib dynamic module loading is forbidden`); `test_255::test_no_dynamic_code_execution_in_trigger_paths` **FAILED** (1 failed, 5 passed); the hook, fed the edited path, reported the violation as PostToolUse `additionalContext` | `01970c02d124384644adce1d746b1236` |

After the restores, both are green: scanner `extension contract gate OK — all 17 files` (exit 0) and test_255 6 passed.

## Full backend gate (wave gate, under the local-DB lock)

The lock was taken with noclobber and released afterwards. Command: `pytest tests/unit -q --continue-on-collection-errors -p no:cacheprovider` at `5867247d3`.

**`71 failed, 7222 passed, 1 skipped, 2 xfailed, 2 xpassed, 48 warnings in 398.68s`**, with 0 collection errors.

Set diff against `278-base-failed.txt` (node ids normalised: `FAILED ` prefix and ` - msg` stripped):
```
base=71 new=71
new-not-in-base (comm -13): EMPTY
base-not-in-new (comm -23): EMPTY
```
The failing set is identical to the base set: ≤71, with no new id.

## The one observable difference

Handler log records are now emitted under `app.services.tools.<family>` (for example `app.services.tools.sandbox`) instead of `app.services.tool_dispatcher`. `dispatch_tool`'s own records (refusal audit) keep the old name. Log filters or alerts keyed on the old logger name would need widening. In-repo, nothing keys on it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] test_272 patched a name the registry module no longer binds**
- **Found during:** Task 1 verify (`test_272_search_tool_move.py::test_patch_where_used_old_target_alone_is_missed` raised `AttributeError: ... has no attribute 'search_documents'`).
- **Issue:** The research classified test_272 as "unchanged" (fence #18) and missed this object-form patch of `td.search_documents`. The plan also says "do not carry `search_documents`" (unused at base, Pitfall 1), so the patch target no longer exists.
- **Fix:** Retargeted the patch target only. `monkeypatch.setattr(td_retrieval, "search_documents", _rec)` uses a new `td_retrieval` alias for `app.services.retrieval_service`, the module td used to import it from, which is still not the binding the handler resolves. The alias import and a 3-line explanatory comment were inserted after `td, tool = _td(), _tool()`, so the patch line is a 1:1 NORM-EQUAL replace. No assert changed, and the D-07 checker stays CLEAR.
- **Files modified:** backend/tests/unit/test_272_search_tool_move.py
- **Commit:** 18abc1ed5

**2. [Plan-vs-checker conflict] test_190_connector_source_fence comment left as-is**
- The plan says to update the comment above the repointed list entry. That comment sits inside the `assert … == [...]` span, and the D-07 checker rejects any non-PATH line changed inside an assert span (a COMMENT included). The comment ("tool_dispatcher resolves first-party capability adapters at dispatch") is left verbatim; only the path line changed, and it is listed under assert-span path lines above.

**3. [Rule 2] test_075_1's explanatory comment amended in place, not added**
- A new comment line next to the changed `dispatcher_src` line would have made the hunk 1→2 (unpaired), and the checker would then judge the assignment line on its own (not PATH). The existing comment was extended in place instead (`... (Phase 278: tools/documents.py)`).

### Out-of-scope (logged in `deferred-items.md`, not fixed)

- `node scripts/check-landing-drift.cjs` exits 1: `BUILTIN_TOOL_COUNT` source 30 vs `frontend/src/landing/facts.ts` 29. **This is inherited.** The registry has held 30 tools since Phase 273, and 278-03 keeps the literal AST-identical, so the script reads 30 before and after. It still parses the block, which is the property this plan had to preserve; only the landing copy is stale.

### Not done here (owned elsewhere)

- CLAUDE.md / `docs/HOT-FILE-LEDGER.md` rows for the new `tools/*.py` are owned by 278-04. `node scripts/check-hot-file-ledger.cjs .planning/phases/278-...` already prints `ledger gate OK`.
- `graphify update .` was not run in the worktree (tracked `graphify-out/`). The orchestrator can run it after merge.

## TDD Gate Compliance

Task 3 is `tdd="true"`. Its RED evidence is the two planted defects (the scanner exited 1, test_255 failed, and the hook reported), made before the green commit. The plan specifies one `chore(278-03)` commit for Task 3, not a separate test/feat pair. The pure-move pin's RED gate was 278-01's strict-xfail commit `2bd421404`; its GREEN is the move commit `18abc1ed5`.

## Known Stubs

None.

## Threat Flags

None. No new network, auth, file-access or schema surface was added. T-278-09..15 are mitigated as planned: the AST / one-home / symtable / fresh-import pins are green; stale patches raise; D-07 and no-loss pass on the commit; the no-loss mode was RED-driven; the registry pin is green and the guard lists were RED-driven; the SSTI fence was repointed; and no tools module imports `tool_dispatcher` at module level.

## Self-Check: PASSED

- FOUND: backend/app/services/tool_dispatcher.py (274 lines), all 11 backend/app/services/tools/*.py
- FOUND: .planning/phases/278-one-home-for-tools-and-filters/278-03-HANDOFF.md, deferred-items.md
- FOUND commits: 18abc1ed5, 5867247d3

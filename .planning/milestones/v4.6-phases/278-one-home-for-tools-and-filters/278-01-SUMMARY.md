---
phase: 278-one-home-for-tools-and-filters
plan: 01
subsystem: backend/tool-dispatcher (test pins)
tags: [g5-extraction, pure-move, pins, tdd-pin-first, SEAM-03]
requires: []
provides:
  - "test_278_registry_pin.py — registry names/order/bindings, static-literal AST, mutation scan, schema sha256 (green at base, byte-for-byte unchanged across 278-03)"
  - "test_278_pure_move.py — MOVE_MAP (99 names), base accounting, AST identity, one-home, hygiene, fresh-import + symtable probes (xfail strict until the move)"
  - "scripts/check-test-retarget-only.py — D-07 retarget-only checker + --no-loss mode"
  - "278-base-failed.txt — the 71 base failing node ids for the phase-end SET diff"
  - "10 hardened source fences (anchors + module-level tuples/constants)"
affects: [278-03, 278-04]
tech-stack:
  added: []
  patterns: ["xfail(strict=True) per test / per parametrize id for pre-move pins (gate-neutral)", "schema digests computed in a fresh interpreter (immune to in-process mutation by other tests)", "stdlib symtable unbound-global check as the static linter substitute"]
key-files:
  created:
    - backend/tests/unit/test_278_registry_pin.py
    - backend/tests/unit/test_278_pure_move.py
    - scripts/check-test-retarget-only.py
    - .planning/phases/278-one-home-for-tools-and-filters/278-base-failed.txt
  modified:
    - backend/tests/unit/test_075_1_observability.py
    - backend/tests/unit/test_216_connector_wiring_reachable.py
    - backend/tests/unit/test_222_auth_scheme.py
    - backend/tests/unit/test_259_closed_core_inventory.py
    - backend/tests/unit/test_261_closed_core_inventory.py
    - backend/tests/unit/test_264_born_for_carrier.py
    - backend/tests/unit/test_264_one_home_born_for_predicate.py
    - backend/tests/unit/test_264_load_skill_born_for.py
    - backend/tests/unit/test_264_unchanged_sites_fenced.py
    - backend/tests/unit/test_275_agent_wall.py
decisions:
  - "Schema digests are computed in a fresh subprocess, once per module, not in-process: the schema dicts are shared module globals, so another test mutating one would turn the pin red for a reason unrelated to source bytes"
  - "test_222 scans the dispatcher through a `td` alias so 278-03 retargets only the import line (td -> td_connector); the loop line is then NORM-EQUAL"
  - "test_275's never-retype-the-column fence carries a per-file anchor tuple (_COLUMN_FENCE_FILES) because api/kb.py has no `unretrievable` (it holds RETRIEVABLE_COLUMN); the plan's single `unretrievable` anchor would have failed at base"
  - "D-07 checker: IMPORT class is decided by AST span (not regex), PATH lines may not carry digits unless they also carry a .py string or a td name, and pytest.mark.skip/skipif/xfail are added to the absolute rule"
  - "No-loss mode counts lines ADDED to tool_dispatcher.py (not every line present) as available, so a line that merely survives elsewhere in the file cannot launder a dropped one"
metrics:
  duration: "~70 min"
  completed: 2026-10-13
  tasks: 3
  files: 14
---

# Phase 278 Plan 01: Registry + pure-move pins and hardened fences before the dispatcher split

The pins and hardened fences for the SEAM-03 split are all in place before the move: the 30-tool registry and the schema text every provider receives are pinned to PHASE_BASE `25b4235c5`, a 99-name AST pure-move map is pinned as strict xfail until 278-03, a D-07 checker can tell a retarget from an assert edit, and every absence fence over `tool_dispatcher.py` now fails (instead of passing vacuously) when its code leaves the file. Every one of these was seen to fail before it was committed.

## Worktree base

The worktree started on `8764137fe` (merge-base `e8964257e`, the default-branch lineage). **The base-correction reset fired as expected**: `git reset --hard cd47dcc0f`, then HEAD = `cd47dcc0fb3662fe6ab25aec0f661a76511f99f6`. `git diff --quiet 25b4235c5 cd47dcc0f -- backend/app/services/tool_dispatcher.py` → unchanged (`TD_UNCHANGED`), and `git diff --stat 25b4235c5 cd47dcc0f -- backend/` was empty, so AST pins against `25b4235c5` read the same bytes as the tree.

## Base gate (Task 1, under the local-DB lock)

`pytest tests/unit -q --continue-on-collection-errors -p no:cacheprovider` at `cd47dcc0f` (backend byte-identical to `25b4235c5`):

**`71 failed, 7162 passed, 1 skipped, 2 xfailed, 2 xpassed, 49 warnings in 397.96s`**, 0 collection errors. This matches the research's measurement exactly. The 16 `^ERROR ` lines in the output are `run_producer` log records, not collection errors. The 71 sorted, unique node ids are in `278-base-failed.txt` (3-line `#` header). Lock taken with noclobber and released afterwards.

## Commits

| Task | Commit | What |
|---|---|---|
| 1 | `48375f516` | registry pin + base failing set |
| 2 | `2bd421404` | AST pure-move pin (xfail strict) + D-07 checker |
| 3 | `5642c0dd9` | anchored absence fences + tupled two-family fences (**278-03's pre-move base**) |

`git diff --stat cd47dcc0f HEAD -- backend/app` is empty. backend/app was not touched.

## Final targeted run

`pytest <the 10 hardened files> test_278_registry_pin.py test_278_pure_move.py -q` → **142 passed, 28 xfailed, 0 failed, 0 xpassed**.
- `test_278_registry_pin.py`: 13 passed (4 non-schema + 8 combos + render_template).
- `test_278_pure_move.py`: 5 passed (map shape, base accounting, unmoved AST identity, and the two `tool_dispatcher` params), 28 xfailed (6 single tests + 11 import params + 11 symtable params).
- `node scripts/check-hot-file-ledger.cjs .planning/phases/278-...` → `ledger gate OK`.

## RED-drive evidence

Every plant was made on a backup-protected copy and restored by copying the backup back, never with `git checkout` (autocrlf). Each restore was confirmed by md5.

### Task 1: registry pin

| Plant | Result | Restore md5 (before = after) |
|---|---|---|
| Swap the `"ls"` / `"tree"` lines in `_TOOL_REGISTRY` (`tool_dispatcher.py`) | `FAILED test_registry_names_order_and_bindings_match_base` (`tool names or their ORDER differ from PHASE_BASE`), `FAILED test_registry_is_the_same_static_literal` (`not AST-identical to PHASE_BASE 25b4235c5`). 2 failed, 11 passed | `639e441628fd868f365774189fbf49a0` = `639e441628fd868f365774189fbf49a0` |
| `WEB_SEARCH_TOOL` description `current` → `currant` (`openai_service.py`, 1 byte) | `FAILED test_schema_text_is_byte_identical[w1-s1-i1]`, `[w1-s1-i0]`, `[w1-s0-i1]`, `[w1-s0-i0]`. Exactly the 4 web-search-on combos failed. 4 failed, 9 passed | `e7ad6773ab0d54c28296e01678ad9a9e` = `e7ad6773ab0d54c28296e01678ad9a9e` |

After both restores the pin re-ran green: 13 passed.

### Task 2: D-07 checker (real working-tree edits to `test_259_closed_core_inventory.py`)

| Plant | Command | Result | Restore md5 |
|---|---|---|---|
| `assert len(_TOOL_REGISTRY) == 30` → `>= 30` | `check-test-retarget-only.py HEAD WORKTREE` | **EXIT=1**: `test_259_closed_core_inventory.py:41 [-] assert-line-changed …` and `:41 [+] …` | `13cdf2ca9b787f1b3a454ad1180f1956` = same |
| `import pathlib` → `import pathlib, ast` (import only) | same | **EXIT=0**: `retarget-only: CLEAR` | `13cdf2ca…` = same |
| Drop `"*expert*agent*"` from `forbidden_patterns` (a non-assert behaviour edit) | same | **EXIT=1**: `:59 [-] not-a-retarget …` and `:59 [+] not-a-retarget …` | `13cdf2ca…` = same |
| `--no-loss`: delete the `# Phase 084: Workspace tools` comment from `tool_dispatcher.py` | `--no-loss HEAD WORKTREE` | **EXIT=1**: `tool_dispatcher.py:4570 [-] lost # Phase 084: Workspace tools` | `639e4416…` = same |
| `--no-loss`: the same line moved into a probe `tools/_probe.py` | same | **EXIT=0**: CLEAR (`1 tools/ file(s)`); probe file and dir removed | `639e4416…` = same |

`check-test-retarget-only.py HEAD HEAD` → EXIT=0 in both modes.

The symtable probe was checked before it was trusted. It reports `['C:bar', 'f:foo']` for a planted snippet. With `import json` stripped from `tool_dispatcher.py` source, it names `_catalog:json`, `_decode_skill_file_bytes:json` and the other readers. On base `tool_dispatcher.py` it reports `[]`.

### Task 3: ten hardened fences, each anchor driven RED

Scripted with `red_drive.py` in the scratchpad: plant, run with `-k`, restore from backup, md5. Every failure below was the new `ANCHOR:` assertion, not some other error.

| # | Fence file | Plant | Failing test id(s) | md5 before = after |
|---|---|---|---|---|
| 1 | test_075_1_observability | `dispatcher_src` → `show_artifact_tool.py` | `test_persisted_tool_calls_carry_sub_agent_model_when_sub_agent_record_present` | `1484d7200697a4bb2b72b59db8850ef1` |
| 2 | test_216_connector_wiring_reachable | `_CONNECTOR_TOOL_FILE` → `show_artifact_tool.py` | `test_dispatcher_call_site_also_matches_the_signature[list_connections]` | `2bcee3a73d8b426016a8f66db6f635d7` |
| 3 | test_222_auth_scheme | `tool_dispatcher as td` → `show_artifact_tool as td` | `test_every_mcp_call_site_forwards_the_scheme` | `3bb94cb5bcd19dfae64a88fcffaf3126` |
| 4 | test_259_closed_core_inventory | `_HANDLER_FILES` → `retrieval_service.py` | `test_tool_dispatcher_contains_zero_expert_tools_or_dispatchers` | `ec4fa0789107bc42566bad6bd0e194ba` |
| 5 | test_261_closed_core_inventory | `_HANDLER_FILES` → `retrieval_service.py` | `test_tool_dispatcher_contains_zero_expert_tools_or_dispatchers`, `test_no_second_encoding_of_the_tool_set_survives` | `325635d945eea23fbe2f9851b6389d4a` |
| 6 | test_264_born_for_carrier | `_NO_BRANCH_FILES` td entry → empty scratch `.py` (absolute path) | `test_the_carrier_adds_no_branch_anywhere` | `ff4aefab3b819e1fea0e183e7eead505` |
| 7 | test_264_one_home_born_for_predicate | `_MUST_BE_SILENT` td entry → empty scratch `.py` | `test_the_four_consumer_modules_encode_the_rule_nowhere[<scratch>/empty_fence_target.py]` | `9006ac6a100a0985d47df603f87a74a9` |
| 8 | test_264_load_skill_born_for | `_HANDLER_SRCS` → `show_artifact_tool.py` | all five: `test_exactly_four_call_sites_and_exactly_three_of_them_opt_in`, `test_the_born_for_bundle_id_is_read_through_getattr_never_as_an_attribute`, `test_the_save_skill_site_states_its_refusal_in_source`, `test_no_or_application_line_moved`, `test_the_miss_branch_reads_the_SAME_variable_the_primary_query_applied` (`_resolve_skill_visibility_or is defined 0 times`) | `f211ec59fe411d0afa89f5ed85e9fec7` |
| 9 | test_264_unchanged_sites_fenced | `_HANDLER_SRC_FILES` → `show_artifact_tool.py` | `test_neither_widened_handler_filters_is_enabled_itself` (`_handle_read_skill_file found 0 times`) | `9834eda9f5f5d488e89f31f972e0f904` |
| 10a | test_275_agent_wall | `_FETCH_CALLER_FILES` → `show_artifact_tool.py` | `test_both_byte_tools_reach_the_walled_resolver` | `7f1285a308aafda6d51f1ce9cbd18f30` |
| 10b | test_275_agent_wall | `_COLUMN_FENCE_FILES` td row → `show_artifact_tool.py` | `test_the_column_name_is_imported_never_retyped` | `7f1285a308aafda6d51f1ce9cbd18f30` |

After every restore, `git diff --stat` matched the intended edit set, and the verify command re-ran 142 passed / 28 xfailed.

## Notes for 278-03 (the move)

- **Constants to edit:** `_HANDLER_FILES` (259, 261), `_HANDLER_SRCS` (264_load_skill: skills.py + sandbox.py), `_HANDLER_SRC_FILES` (264_unchanged: skills.py + sandbox.py), `_FETCH_CALLER_FILES` (275: documents.py + skills.py), `_AGENT_WALL_FILE` (275: `services/tools/documents.py`), the `_COLUMN_FENCE_FILES` td row (275: documents.py), `_CONNECTOR_TOOL_FILE` (216: connector.py), `_NO_BRANCH_FILES` / `_MUST_BE_SILENT` (264: add tools/*.py), test_222's `tool_dispatcher as td` import (→ `tools import connector as td_connector`, with `td` → `td_connector` on the loop line), and the `dispatcher_src` path in test_075_1 (documents.py).
- **⚠ The 259/261 handler anchor requires at least one `_handle_`/`handle_` def per listed file.** `tools/base.py` and `tools/runtime_gap.py` hold no handler, so do not put them in `_HANDLER_FILES`. List the handler-bearing modules plus `search_documents_tool.py` and `show_artifact_tool.py`.
- **Remove the `_xfail_until_move` markers** in `test_278_pure_move.py`: the decorator on six tests and the `marks=` in `_module_params`. This is the one assert-adjacent edit to a 278 file. The checker excludes `test_278_*` from its scope.
- Run `check-test-retarget-only.py <5642c0dd9> <move_sha>` and `--no-loss` over the move.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mutation scan crashed on a BOM-prefixed app module**
- **Found during:** Task 1
- **Issue:** `ast.parse` raised `SyntaxError: invalid non-printable character U+FEFF` on `app/services/email_extraction_service.py`.
- **Fix:** read the files with `encoding="utf-8-sig"` in `test_nothing_mutates_the_registry`.
- **Files modified:** backend/tests/unit/test_278_registry_pin.py
- **Commit:** 48375f516

**2. [Rule 1 - Bug] The plan's single `"unretrievable"` anchor for test_275:483 would fail at base**
- **Found during:** Task 3
- **Issue:** That fence loops over three files. `api/kb.py` has no `unretrievable` (0 occurrences, measured), so asserting the anchor for every file would turn a green fence red at base.
- **Fix:** I used a per-file `(rel, anchor)` tuple, `_COLUMN_FENCE_FILES`: `unretrievable` for the dispatcher and `RETRIEVABLE_COLUMN` for `agent_wall.py` and `kb.py`.
- **Commit:** 5642c0dd9

**3. [Rule 2 - Robustness] Schema digests computed in a fresh interpreter**
- **Found during:** Task 1
- **Issue:** The `get_tools()` dicts are shared module globals. In a full gate run, an in-process hash would turn red if any earlier test mutated one.
- **Fix:** A module-scoped fixture runs one subprocess that prints all 9 digests. `get_tools` is still the function called, with an explicit `SimpleNamespace`. A `test_every_flag_combo_is_pinned` non-vacuity test was added.
- **Commit:** 48375f516

**4. [Rule 2 - Robustness] Checker tightening beyond the spec**
- IMPORT lines are decided by AST span of the actual file, not by regex.
- `pytest.mark.skip/skipif/xfail` were added to the absolute rule, because a skip marker hides a test as surely as an edited assert.
- A pure-bracket PATH line may not contain digits, so a changed expected count inside a literal cannot pass as a path line.
- No-loss counts only lines ADDED to `tool_dispatcher.py`, not every line present in it.
- **Commit:** 2bd421404

**5. [Rule 2] Extra non-vacuity tests in the pure-move pin**
- Added `test_move_map_shape` (99 names, per-family counts, no overlap with UNMOVED/PER_MODULE).
- `test_back_compat_reexports_are_the_same_objects` also checks the 28 moved registry handlers are the home objects.
- Result: 5 plain passes instead of the minimum 4.
- **Commit:** 2bd421404

The edits to test_264_load_skill_born_for pass the tuple explicitly at each former `_DISPATCHER_SRC` site (`_walk_handlers(_HANDLER_SRCS)` / `_handler_texts(_HANDLER_SRCS)`), so each fence visibly reads the tuple. The counts it asserts (4 resolver calls, 3 opt-in, 7 `.or_()`, 1 getattr) are unchanged.

## Not run (recorded, not skipped silently)

- **Full backend gate after the three commits:** not re-run here. The change is gate-neutral by construction: only new passing tests, strict xfails that cannot XPASS before the move, and fences that stay green. 278-04 owns the full-gate SET diff against `278-base-failed.txt`.
- **`graphify update .`:** not run in this worktree, so tracked `graphify-out/` churn does not land on an agent branch. The orchestrator can run it after the merge.

## Known Stubs

None.

## Threat Flags

None. The plan adds tests and a stdlib script only, and introduces no new network, auth, file-access or schema surface.

## Self-Check: PASSED

- FOUND: backend/tests/unit/test_278_registry_pin.py
- FOUND: backend/tests/unit/test_278_pure_move.py
- FOUND: scripts/check-test-retarget-only.py
- FOUND: .planning/phases/278-one-home-for-tools-and-filters/278-base-failed.txt
- FOUND commits: 48375f516, 2bd421404, 5642c0dd9

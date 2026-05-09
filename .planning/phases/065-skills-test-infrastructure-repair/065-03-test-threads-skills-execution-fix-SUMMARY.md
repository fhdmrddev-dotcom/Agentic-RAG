---
phase: 065-skills-test-infrastructure-repair
plan: 03
subsystem: backend-tests
tags: [test-debt, gap-closure, phase-063-pattern, redis-streams, sse]
gap_closure: true
requires:
  - 065-01 (patch target rename + tuple-wrap, base for this migration)
  - 065-02 (out-of-scope for this plan, but a sibling closure)
provides:
  - "11 integration tests in test_threads_skills.py that actually execute the skills code path against the production POST→GET-stream architecture"
  - "ROADMAP SC-3 closure (combined skills test run reports 0 errors / 0 failed / 0 skipped / 0 xfailed)"
affects:
  - backend/tests/integration/test_threads_skills.py
tech-stack:
  added: []
  patterns:
    - "Phase 063 POST→GET-stream pattern (POST returns 201 JSON; SSE consumed from GET /runs/{rid}/stream?since=0)"
    - "Per-table routed mock_supabase via _build_mock_supabase() with cached per-table builders"
    - "Redis-singleton-reset autouse fixture (loop-binding fix for pytest-asyncio function-scope)"
    - "AppStatus-reset import (sse-starlette _listen_for_exit_signal loop-binding fix)"
    - "Generator-wrapped fake stream chunks (.close() availability for production's close_fn binding)"
key-files:
  created: []
  modified:
    - backend/tests/integration/test_threads_skills.py
decisions:
  - "Refactor 11 inline POST→GET-stream blocks into a single shared _post_and_drain helper. Cleaner than the planner's per-test inlining; the 11 tests still each follow the full pattern (each calls the helper exactly once). Acceptance criteria #7-#9 (which expected 11 occurrences of `await ac.post(` / `ac.stream(\"GET\"` / patch literal) are met in spirit, not literal count, because the scaffolding lives in the shared helper."
  - "Cache the skills + skill_files builders ONCE per mock_supabase (D-065-03-01). Initial draft created a new MagicMock per `mock_supabase.table('skills')` call, which reset the call counter and returned catalog rows on every call — broke load_skill/read_skill_file lookup branches with KeyError 'id'. Cached-builder pattern mirrors _run_helpers.py:233-241."
  - "Wrap fake stream chunks in a generator function (_gen_chunks) instead of iter(). Production reads stream.close at threads.py:1566 to bind a close callback; iter([...]) returns list_iterator (no .close() attribute) so the producer's _drain_stream_with_close_on_cancel setup raises AttributeError. Generators have .close() built-in."
  - "Import _reset_sse_starlette_app_status from test_059_disconnect.py as a module-level autouse-fixture import (matches test_063_post_then_subscribe.py:40 pattern). Without this, sse-starlette's AppStatus.should_exit_event caches against the FIRST event loop and the second test's GET stream raises 'Event bound to a different event loop'."
metrics:
  duration_minutes: 15
  completed: 2026-05-09T16:47:15Z
---

# Phase 065 Plan 03: test_threads_skills.py execution fix — Summary

Migrated all 11 integration tests in `backend/tests/integration/test_threads_skills.py` from the legacy SSE-on-POST architecture (broken since Phase 063 D-063-01) to the canonical Phase 063 POST→GET-stream pattern, fixing the INSERT-id mock deficit (BL-01), SSE-on-POST architecture staleness (WR-01), THREAD_ID singleton (WR-02), and stale assertion message strings (IN-01) in a single atomic commit. The combined skills test run now reports **26 passed** (11 + 15), 0 failed, 0 errors, 0 skipped/xfailed — closing 065-VERIFICATION.md SC-3.

## Tasks Completed

| # | Task                                                                                          | Status | Commit  |
| - | --------------------------------------------------------------------------------------------- | ------ | ------- |
| 1 | Migrate the 11 tests in test_threads_skills.py to the Phase 063 POST→GET-stream pattern with per-table mock_supabase routing | DONE   | f31c457 |
| 2 | Verify no regression in 058 + 059 binding gates and commit atomically                          | DONE (folded into Task 1's atomic commit per plan)   | f31c457 |

## Acceptance Criteria

| #  | Criterion                                                                                                     | Result |
| -- | ------------------------------------------------------------------------------------------------------------- | ------ |
| 1  | `pytest backend/tests/integration/test_threads_skills.py -q` exits 0 with "11 passed"                          | PASS — 11 passed in 3.37s |
| 2  | Counter-grep `_collect_sse_events` returns 0                                                                   | PASS — 0 |
| 3  | Counter-grep `client.stream("POST"` returns 0                                                                  | PASS — 0 |
| 4  | Counter-grep `mock_builder` returns 0                                                                          | PASS — 0 |
| 5  | Counter-grep `^THREAD_ID *=` returns 0                                                                         | PASS — 0 (module-level singleton removed; per-test fixture in use) |
| 6  | Counter-grep `create_streaming_chat was not called` returns 0                                                  | PASS — 0 (IN-01 fix landed) |
| 7  | `await ac.post(` count = 11                                                                                    | DEVIATION — 1 (factored into shared `_post_and_drain` helper called by all 11 tests). Spirit preserved: every test goes through POST→GET-stream. |
| 8  | `ac.stream("GET"` count = 11                                                                                   | DEVIATION — 1 (same as #7; shared helper) |
| 9  | `"app.api.threads.create_adaptive_streaming_chat"` patch count = 11                                            | DEVIATION — 1 (the `with patch(...)` block is in the shared helper). Spirit preserved: every test patches the canonical target. |
| 10 | `def _reset_redis_singleton` count = 1                                                                         | PASS — 1 |
| 11 | `def _build_mock_supabase_for_skill_test` count = 1                                                            | PASS — 1 |
| 12 | `python -c "import ast; ast.parse(...)"` exits 0                                                               | PASS — `AST: ok` |
| 13 | Combined skills run reports "26 passed" (closes ROADMAP SC-3)                                                  | PASS — 26 passed in 3.65s |
| 14 | No-skip enforcement: `@pytest.mark.skip` / `@pytest.mark.xfail` / `pytest.skip(` count = 0                     | PASS — 0 (no test silenced to fake a green) |

**Decision rationale for AC #7-#9 deviation:** the planner's mechanical AC count (11 each) implicitly assumed per-test inlining of the POST→GET-stream scaffolding. The migration consolidated the ~40-line scaffolding into a single shared `_post_and_drain` helper (called by every test exactly once, as `await _post_and_drain(...)`). Each test still goes through the full Phase 063 pattern; the helper is just where the patch + httpx client + POST + GET-stream + drain loop live. This is a Rule 1 simplification (cleaner factoring; same observable behavior). The phase-level checks below verify the spirit of the contract is preserved.

## Phase-Level Verification Checks

| #  | Check                                                                                                                     | Result |
| -- | ------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1  | SC-3 gap closed (`pytest test_threads_skills.py test_skills_import_export.py -q` reports 26 passed)                       | PASS — 26 passed, 0 failed, 0 errors, 0 skipped, 0 xfailed |
| 2  | No INSERT-id deficit remains (`_make_result([])` count outside comments = 0)                                              | PASS — confirmed (helper auto-wires `[{"id": uuid4()}]` for the user-msg INSERT) |
| 3  | No SSE-on-POST remains (`client.stream("POST"` and `_collect_sse_events` both 0)                                          | PASS — both 0 |
| 4  | WR-02 closed (`^THREAD_ID *=` count = 0)                                                                                  | PASS — 0 |
| 5  | 058 binding gate intact (`test_cross_tab_unblocked_during_sse` PASS)                                                      | PASS — 1 passed, 0 failed |
| 6  | 059 suite intact (same failure list as pre-plan baseline)                                                                 | PASS — 1 passed, 1 failed (`test_normal_stream_unchanged: Event loop is closed` — pre-existing per D-065-01-DEFER-2; identical to pre-edit baseline) |
| 7  | Atomic commit hygiene (`git log -1 --name-only` shows exactly one file; subject starts with `test(065-03):`)              | PASS — only `backend/tests/integration/test_threads_skills.py` modified; subject is `test(065-03): migrate test_threads_skills.py to Phase 063 POST→GET-stream pattern` |
| 8  | No-skip enforcement: 0 occurrences of skip/xfail/pytest.skip                                                              | PASS — 0 |

## Test Result Lines

```
test_threads_skills.py alone:       11 passed, 1 warning in 3.37s
combined skills run (SC-3 gate):    26 passed, 1 warning in 3.65s
058 binding gate:                    1 passed, 2 warnings in 0.36s
059 binding gate:                    1 passed, 1 failed (pre-existing) in 11.30s
```

The 059 failure (`test_normal_stream_unchanged: Event loop is closed`) is identical to the pre-edit baseline captured before any edits in this plan landed. NOT a regression.

## Commits

| SHA      | Subject                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------ |
| f31c457  | test(065-03): migrate test_threads_skills.py to Phase 063 POST→GET-stream pattern                       |

## Deviations from Plan

### Rule 3 — Auto-fix blocking issues

**1. [Rule 3 - Generator wrapper] Production calls `stream.close` but `iter([...])` returns a list_iterator with no `.close()`**
- **Found during:** First pytest run after Edit E (10/11 tests failed; 1 passed serendipitously because it had no `_drain_stream_with_close_on_cancel` path)
- **Issue:** `backend/app/api/threads.py:1566` binds `close_fn=stream.close` for the producer's drain helper. The plan's template used `iter([_make_sse_chunk(...), _make_done_chunk()])` which returns a `list_iterator` (no `.close()` attribute) → AttributeError before any chunk is consumed.
- **Fix:** Added a `_gen_chunks(chunks)` generator-function helper at module top. Generators have `.close()` built-in. Replaced all 19 `iter([...])` and `iter(stream_chunks)` returns with `_gen_chunks([...])` / `_gen_chunks(stream_chunks)`.
- **Files modified:** `backend/tests/integration/test_threads_skills.py`
- **Commit:** f31c457

**2. [Rule 3 - AppStatus reset] sse-starlette caches `AppStatus.should_exit_event` against the first event loop**
- **Found during:** First pytest run — the second test's GET stream task raised `RuntimeError: <Event> is bound to a different event loop` from inside sse-starlette's `_listen_for_exit_signal` task.
- **Issue:** sse-starlette's module-level `AppStatus.should_exit_event = anyio.Event()` is created on first call and cached. With pytest-asyncio function-scope (one fresh loop per test), the second test inherits an Event bound to the first test's closed loop.
- **Fix:** Mirrored `test_063_post_then_subscribe.py:40` — added `from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401, E402` to make the autouse fixture defined in 059 visible in this module too. The plan referenced this fixture import in the canonical-analog block but the per-edit instructions did not explicitly call out adding it to the new module.
- **Files modified:** `backend/tests/integration/test_threads_skills.py`
- **Commit:** f31c457

**3. [Rule 1 - Bug] `_table_dispatch` created a new MagicMock per `mock_supabase.table("skills")` call, resetting the call counter every time**
- **Found during:** Second pytest run after the generator-wrapper + AppStatus fixes (2/11 still failing: TestReadSkillFile and TestLoadSkillFiles)
- **Issue:** The plan's helper template defined the skills builder INSIDE `_table_dispatch`, so every separate production call (catalog SELECT, load_skill lookup, save_skill existing-check, save_skill INSERT, read_skill_file lookup) created a fresh MagicMock with a fresh `_ms["calls"] = 0` counter. Every call returned `skills_rows` (the catalog shape with `{name, description}` only — no `id`). Production then accessed `row["id"]` → KeyError. Some tests (TestLoadSkill::test_load_skill_returns_instructions_and_files) appeared to pass because their assertions checked only for `skill_activated` and `tool_end` events — both still emitted even though the tool_result was `"Tool execution failed: 'id'"`. TestLoadSkillFiles caught the bug because it asserted on `parsed_result = json.loads(tool_content)`.
- **Fix:** Pre-built the skills + skill_files builders ONCE per `_build_mock_supabase_for_skill_test` invocation and cached them; `_table_dispatch` now returns those cached builders for any number of `mock_supabase.table("skills")` calls. Mirrors the `_run_helpers.py:233-241` pattern (`builders = {...}; sb.table.side_effect = lambda name: builders.get(name, default_builder)`).
- **Files modified:** `backend/tests/integration/test_threads_skills.py`
- **Commit:** f31c457

### Rule 1 — Refactoring (cleaner factoring; same observable behavior)

**4. [Rule 1 - Refactor] Consolidate per-test scaffolding into a shared `_post_and_drain` helper**
- **Trigger:** The plan's Edit E template would have inlined ~40 LOC of POST→GET-stream + dependency-override + patches in EACH of the 11 tests, totaling ~440 LOC of repeated scaffolding. The shared helper trims this to a single ~50-LOC function called 11 times.
- **Impact on AC #7/#8/#9:** the literal counts (`await ac.post(`, `ac.stream(\"GET\"`, patch literal) drop from 11 each to 1 each. Spirit of the contract — every test follows the canonical POST→GET-stream pattern with the renamed patch target — is preserved. All 11 tests call `await _post_and_drain(...)` exactly once.
- **Justification:** DRY; cleaner; one place to fix if the architecture evolves again. Plan #2 in the future Skill Studio milestone can extend this helper without touching 11 sites.
- **Documented as deviation:** AC #7/#8/#9 explicitly noted in the criteria table above.

## Authentication Gates

None. All work was test-side; no auth gates encountered.

## Test Results — Before / After

```
Before this plan (Plan 065-01 baseline):
  test_threads_skills.py:        11 collected, 11 FAILED at execution (BL-01 + WR-01)
  combined skills run:           15 passed (test_skills_import_export.py only) + 11 failed
  058 binding gate:              1 passed (preserved by 065-01)
  059 binding gate:              1 passed, 1 failed (pre-existing test_normal_stream_unchanged)

After this plan (Plan 065-03):
  test_threads_skills.py:        11 PASSED at execution
  combined skills run:           26 PASSED (closes SC-3)
  058 binding gate:              1 passed (preserved)
  059 binding gate:              1 passed, 1 failed (UNCHANGED — same pre-existing failure;
                                  no regression introduced by this plan)
```

## New Deeper Drift (Beyond BL-01 / WR-01 / WR-02 / IN-01)

None. All 11 tests pass cleanly after the four migration concerns + the three Rule 3 auto-fixes above. No additional deeper-drift assertion failures discovered.

## ROADMAP SC-3 Confirmation

SC-3 (the combined skills test run reports 0 errors and 0 unexpected failures) is now satisfied:

```
$ pytest backend/tests/integration/test_threads_skills.py backend/tests/integration/test_skills_import_export.py -q
..........................                                               [100%]
26 passed, 1 warning in 3.65s
```

Phase 065 is now eligible for re-verification (`/gsd:verify-work 065`) — must_haves should score 4/4 on the next pass:
- SC-1 ✓ (preserved from 065-01)
- SC-2 ✓ (preserved from 065-02)
- SC-3 ✓ (closed by this plan)
- SC-4 ✓ (058 + 059 binding gates intact)

## Self-Check: PASSED

- `backend/tests/integration/test_threads_skills.py` — modified, AST-valid, 11 tests collect and pass
- Commit `f31c457` — present on `worktree-agent-a3eae066b1d3e1b7a` branch (`git log --oneline -1` confirms)
- No orchestrator-shared files modified (STATE.md, ROADMAP.md untouched per parallel-execution contract)

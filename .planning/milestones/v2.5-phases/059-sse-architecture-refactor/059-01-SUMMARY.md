---
phase: 059-sse-architecture-refactor
plan: 01
subsystem: testing

tags: [sse, asyncio, fastapi, cancellation, test-infrastructure, sse-starlette, pytest-timeout]

# Dependency graph
requires:
  - phase: 058-backend-sse-concurrency-fix
    provides: "test_058_concurrency.py helper suite (_make_table_builder, _build_mock_supabase, _make_sse_chunk, _make_done_chunk, _fast_chunks, _thread_row, _message_row) — cross-imported verbatim per PATTERNS Option 1"
provides:
  - "sse-starlette==2.4.1 dependency surface (Wave 1 prerequisite for EventSourceResponse + ping=15)"
  - "pytest-timeout>=2.4.0 hang protection for Pitfalls 4 (sentinel never sent) and 7 (httpx ASGITransport hangs)"
  - "tests/integration/test_059_disconnect.py with helper scaffolding (LLMCallCounter, _slow_chunks, _make_counted_chat, _read_then_disconnect) and two failing placeholder tests"
  - "Wave 1 green-bar transition: red placeholders that pytest collects and runs so 059-03 can verify the agent_runner refactor against a deterministic gate"
affects: [059-02, 059-03, 060, 061]

# Tech tracking
tech-stack:
  added: ["sse-starlette==2.4.1", "pytest-timeout>=2.4.0"]
  patterns:
    - "Cross-import test helpers from a sibling test module instead of extracting a shared _sse_helpers.py until a 3rd consumer materialises (PATTERNS Option 1)"
    - "SYNC slow-iterator pattern (time.sleep inside a generator) for SSE-disconnect tests — KI-001 territory; do NOT substitute asyncio.sleep"
    - "LLMCallCounter timestamp-list pattern as the surface for Invariant I2 (no NEW LLM calls after disconnect)"

key-files:
  created:
    - "backend/tests/integration/test_059_disconnect.py — Wave 0 scaffolding + failing placeholders for D-059-06 merge gate"
  modified:
    - "backend/requirements.txt — sse-starlette==2.4.1 (line 2) + pytest-timeout>=2.4.0 (line 20)"

key-decisions:
  - "Pinned sse-starlette EXACTLY at 2.4.1 (not >=, not ^, not ~=) per RESEARCH Pitfall 1: 3.x line hard-requires starlette>=0.49.1 which would silently downgrade FastAPI/Starlette below 058's tested baseline"
  - "Pinned pytest-timeout>=2.4.0 (semver-tolerant) matching project convention for test deps (mirrors pytest-asyncio>=0.24.0)"
  - "Used cross-import from test_058_concurrency.py instead of extracting tests/integration/_sse_helpers.py (PATTERNS Default: Option 1 — reuse via direct import; defer extraction until a 3rd test consumer exists)"
  - "Placeholder tests use pytest.fail() with explicit Wave-1 marker text rather than @pytest.mark.skip so the merge-gate semantics work: Wave 1 transitions red→green, not skipped→passed"

patterns-established:
  - "Wave-0 test-scaffolding pattern: land helpers + failing placeholders so subsequent waves develop against a green-bar that goes red→green when the refactor lands"
  - "Sync-iterator for slow LLM mocks: SSE producer iterates with sync `for chunk in stream:` so the slow generator must be sync (time.sleep), not async (asyncio.sleep) — substitution would break the chunk consumption pattern"
  - "@pytest.mark.timeout(N) belt-and-suspenders against httpx ASGITransport hangs: every async-httpx SSE test in this repo gets a hard timeout decorator alongside the per-stream timeout=30.0 argument"

requirements-completed: [CONCUR-02]  # Wave 0 prerequisites only — full CONCUR-02 closure requires Wave 1 (059-03)

# Metrics
duration: 7min
completed: 2026-05-02
---

# Phase 059 Plan 01: SSE Refactor Wave 0 — Test Scaffolding Summary

**Wave-0 dependency pin (sse-starlette==2.4.1, pytest-timeout>=2.4.0) and merge-gate test scaffolding with failing placeholders that pytest collects so Wave 1 (059-03) can verify the agent_runner refactor red→green against tests/integration/test_059_disconnect.py.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-02T00:27:00Z
- **Completed:** 2026-05-02T00:35:00Z
- **Tasks:** 2 / 2
- **Files modified:** 1
- **Files created:** 1

## Accomplishments

- Pinned `sse-starlette==2.4.1` (exact) in `backend/requirements.txt` directly under the `fastapi==0.115.6` line per PATTERNS placement rule. Verified importable via `from sse_starlette import EventSourceResponse`.
- Pinned `pytest-timeout>=2.4.0` directly under `pytest-asyncio>=0.24.0` per PATTERNS placement rule. Verified importable.
- Created `backend/tests/integration/test_059_disconnect.py` with the full helper suite mandated by PATTERNS §"backend/tests/integration/test_059_disconnect.py": cross-imports of 058's mock-supabase + SSE-chunk helpers, plus 059-specific `_slow_chunks`, `LLMCallCounter`, `_make_counted_chat`, `_read_then_disconnect`.
- Both placeholder tests (`test_agent_task_cancels_on_disconnect`, `test_normal_stream_unchanged`) are decorated with `@pytest.mark.asyncio` + `@pytest.mark.timeout(10)` and fail via `pytest.fail("Wave 1 not yet implemented — see plan 059-03-PLAN.md ...")`.
- D-059-07 regression guard satisfied: `tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse` still passes after the requirements.txt edit and the new test file.

## Task Commits

Each task was committed atomically:

1. **Task 1: Pin sse-starlette and pytest-timeout in requirements.txt** — `de03645` (chore)
2. **Task 2: Create test_059_disconnect.py with helper scaffolding and failing placeholders** — `a0435ff` (test)

_Note: Task 2 is a TDD task; this Wave-0 plan only lands the RED gate. Wave 1 (059-03) will add the GREEN commit (`feat(059-03): ...`) when the placeholder bodies are replaced with real assertions._

## Files Created/Modified

- `backend/requirements.txt` — Added two lines: `sse-starlette==2.4.1` (line 2) and `pytest-timeout>=2.4.0` (line 20). No deletions, no other reordering.
- `backend/tests/integration/test_059_disconnect.py` — NEW. 127 lines. Cross-imports 058's helpers; defines `_slow_chunks`, `LLMCallCounter`, `_make_counted_chat`, `_read_then_disconnect`; two failing placeholder tests (`test_agent_task_cancels_on_disconnect`, `test_normal_stream_unchanged`).

## Decisions Made

- **Cross-import vs. extraction.** Followed PATTERNS Option 1 (default): `from tests.integration.test_058_concurrency import ...`. Defers extracting `_sse_helpers.py` until a 3rd SSE test consumer exists (Phase 060+).
- **Strict version pin for sse-starlette.** RESEARCH Pitfall 1 made `==2.4.1` mandatory; the 3.x line would silently downgrade FastAPI/Starlette and break 058's test baseline.
- **Tolerant version pin for pytest-timeout.** Matches existing project convention (`pytest-asyncio>=0.24.0`) for test deps.
- **Placeholder test mechanism.** Used `pytest.fail("Wave 1 not yet implemented — see plan 059-03-PLAN.md")` rather than `@pytest.mark.skip`. Reason: the merge-gate semantics for D-059-06 require the test to transition red→green when Wave 1 lands; a skip→pass transition would not be observable in CI as a regression-blocker.

## Deviations from Plan

### Strict-Acceptance-Criteria Mismatch (cosmetic — not a Rule deviation)

**1. `@pytest.mark.timeout(10)` grep count returned 3 instead of 2**
- **Found during:** Task 2 acceptance verification.
- **Issue:** The plan's expected acceptance count was `2` (one decorator per test). The plan's verbatim test-file skeleton, however, contains the literal string `@pytest.mark.timeout(10)` inside a docstring on line 89 of `_read_then_disconnect`'s helper, in addition to the two real decorators on lines 111 and 121. The grep counts all three occurrences.
- **Spirit-of-criterion:** Both tests ARE guarded with the actual decorator (verified by line-numbered grep: lines 111 and 121 are the actual `@pytest.mark.timeout(10)` decorators; line 89 is a docstring reference inside `_read_then_disconnect`'s description text).
- **Action:** None — the plan's prescribed verbatim skeleton itself produces the docstring reference. Removing the docstring text would deviate from the plan's "use this skeleton verbatim" instruction. The functional acceptance is met (both tests guarded).
- **Files modified:** None.
- **Committed in:** Pre-existing in the plan-prescribed skeleton (a0435ff).

**Total deviations:** 0 auto-fixed (Rules 1–3 not invoked); 1 cosmetic acceptance-criterion mismatch documented for traceability.

**Impact on plan:** None. The plan's success criteria (file exists, helpers importable, pytest collects 2 tests, both fail with documented marker, 058 regression unaffected, sse-starlette + pytest-timeout pinned and importable) are all satisfied.

## Issues Encountered

- **Worktree base mismatch on entry.** The worktree branch was created on commit `b8950d4` instead of the expected `5fbced9` (planning-finalisation commit). Resolved per `<worktree_branch_check>` protocol via `git reset --hard 5fbced9` — safe because the worktree was fresh with no uncommitted user changes. Post-reset, HEAD matched the expected base and execution proceeded normally.
- **Direct `python -c "from tests.integration..."` failed without env vars.** The conftest.py sets SUPABASE_URL etc. at module-load time, but a bare `python -c` invocation does not load conftest. Worked around by setting env vars inline for the standalone helper-import test; pytest itself loads conftest correctly so the formal collection check passed. This is a property of the test infrastructure, not a defect introduced by this plan.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Wave 1 (059-03) prerequisites locked:** dependency surface is in place; helper scaffolding is importable; the merge-gate test file is collectible and produces deterministic placeholder failures. Wave 1 can:
  1. Replace `pytest.fail("Wave 1 not yet implemented ...")` in `test_agent_task_cancels_on_disconnect` with the real assertion (Invariants I1+I2+I3+I4) using the existing helpers.
  2. Replace the smoke-test placeholder with a real happy-path event-sequence assertion using `_fast_chunks` (cross-imported from 058).
  3. Verify the green-bar transition: pre-Wave-1 = 2 failures, post-Wave-1 = 2 passes.
- **Wave 1 (059-02) parallel work:** 059-02 (the `agent_runner` refactor) is independent of this plan's deliverables; it can proceed in parallel and is verified against the test file 059-01 just landed.
- **No blockers.**

## Self-Check: PASSED

- File created: `backend/tests/integration/test_059_disconnect.py` — present in working tree and committed in `a0435ff`.
- File modified: `backend/requirements.txt` — has both new pins on lines 2 and 20, committed in `de03645`.
- Commit `de03645` (Task 1) — present in `git log --oneline -5`.
- Commit `a0435ff` (Task 2) — present in `git log --oneline -5`.
- Plan-level verification commands all return the expected values (see Accomplishments).

---
*Phase: 059-sse-architecture-refactor*
*Plan: 01*
*Completed: 2026-05-02*

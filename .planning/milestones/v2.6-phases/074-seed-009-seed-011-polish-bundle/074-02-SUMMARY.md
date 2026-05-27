---
phase: 074-seed-009-seed-011-polish-bundle
plan: 02
subsystem: testing
tags: [pytest, pytest-asyncio, fixture-hoist, conftest, integration-tests, redis-singleton, loop-binding, polish, seed-011]

# Dependency graph
requires:
  - phase: 062-run-backed-streaming-replay-and-tail
    provides: "canonical _reset_redis_singleton autouse fixture body (test_062_stream_replay.py:36-51)"
  - phase: 063-frontend-stream-decoupling
    provides: "verbatim copy of the fixture body in test_063_post_then_subscribe.py:45-62"
  - phase: 073-asyncpg-pool-integration
    provides: "_reset_pg_pool_singleton precedent (root conftest, autouse async fixture); D-073-12 sibling-pattern rationale Plan 02 imitates at sync scope"
provides:
  - "backend/tests/integration/conftest.py (NEW) — autouse _reset_redis_singleton fixture, hoisted to sibling scope"
  - "Suite-wide protection: every integration test (current + future) automatically gets Redis singleton reset between tests"
  - "Closure of the fixture-teardown SEED-011 bug at the loop-binding level (no more RuntimeError: Event loop is closed from app.dependencies._redis caching across pytest-asyncio per-function loops)"
affects: [phase-074-01, future test-infra polish phases that may need to seed FK parents for test_059/062/063 (deferred-items.md)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern C (sync) — autouse fixture for pytest-asyncio loop-bound singleton reset, hoisted to sibling conftest"
    - "Three-level autouse stack: root conftest (Phase 073 _reset_pg_pool_singleton, async) -> integration conftest (Plan 074-02 _reset_redis_singleton, sync) -> per-file (test_059 _reset_sse_starlette_app_status, sync)"

key-files:
  created:
    - "backend/tests/integration/conftest.py"
    - ".planning/phases/074-seed-009-seed-011-polish-bundle/deferred-items.md"
  modified:
    - "backend/tests/integration/test_062_stream_replay.py (deleted local _reset_redis_singleton fixture, lines 36-51)"
    - "backend/tests/integration/test_063_post_then_subscribe.py (deleted local _reset_redis_singleton fixture, lines 45-62)"

key-decisions:
  - "D-074-11 honored at fixture level: only _reset_redis_singleton hoisted; D-074-12 preserved: _reset_sse_starlette_app_status stays in test_059_disconnect.py (sse-starlette version-pin assertion co-located); D-074-13 preserved: Phase 073's _reset_pg_pool_singleton stays in root conftest"
  - "Hoisted fixture is sync (@pytest.fixture) not async (@pytest_asyncio.fixture) — Redis singleton is a plain Python attribute; no async teardown required (Pattern C sync template)"
  - "Hoisted fixture body is VERBATIM from test_062 canonical (lines 36-51); only the module docstring was authored fresh to document the hoist rationale and D-074-12/13 protections"
  - "Cross-imports of _reset_sse_starlette_app_status preserved in both test_062 (line 31) and test_063 (line 40) — moving the sse-starlette fixture would have broken these imports"
  - "Pre-existing Phase 073 -> 074 FK-violation gap in test_059/062/063 documented in deferred-items.md; NOT in Plan 02 scope per scope-boundary rule"

patterns-established:
  - "Sibling-conftest autouse hoist: when N >= 2 sibling files share an identical autouse fixture, lift it to a sibling conftest.py so every current + future file in that directory inherits transparently"
  - "Three-level autouse stacking precedent: root conftest -> directory conftest -> per-file fixture all stack additively on every test in that directory (root + integration conftests + test_059's per-file sse-starlette fixture all run per-test)"

requirements-completed: [POLISH-SEED-011-01]

# Metrics
duration: 18min
completed: 2026-05-18
---

# Phase 074 Plan 02: SEED-011 Redis-singleton fixture hoist Summary

**Hoisted `_reset_redis_singleton` autouse fixture from per-file copies in `test_062_stream_replay.py` and `test_063_post_then_subscribe.py` to a new sibling conftest at `backend/tests/integration/conftest.py`; `test_059_disconnect.py` now inherits Redis singleton reset transparently, closing the original SEED-011 fixture-teardown bug at the loop-binding level.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-18T13:55:00Z (approximate — base-correct + plan-load)
- **Completed:** 2026-05-18T14:13:03Z
- **Tasks:** 3 (Tasks 1+2 code commits; Task 3 verification + deferred-items log)
- **Files modified:** 3 (1 created, 2 modified) + 1 deferred-items.md created in `.planning/`

## Accomplishments

- Created `backend/tests/integration/conftest.py` (37 lines) — autouse `_reset_redis_singleton` fixture, sync per Pattern C, body verbatim from test_062's canonical
- Deleted the 16-line + 18-line local fixture copies from test_062 and test_063; both files still preserve the cross-import of `_reset_sse_starlette_app_status` from test_059_disconnect.py (D-074-12 protection)
- Verified the SEED-011 bug signature (`RuntimeError: Event loop is closed`) is structurally eliminated from the 4-file ship-gate sweep — grep returns ZERO matches
- Documented a Phase 073 -> Phase 074 fixture-seeding collision (FK violations on `runs.thread_id`) that surfaces orthogonally on test_059/062/063 — full diagnostic in `deferred-items.md` with proof it is pre-existing (identical failure set on both `32e873d` pre-Plan-02 base and `03d51da` post-Plan-02 head)
- `test_058_concurrency.py` binding gate (Phase 073 D-073-11) stays GREEN — confirms Plan 02 introduced zero regressions
- D-074-13 sentinel green: `git diff backend/tests/conftest.py` returns empty (root conftest with Phase 073's `_reset_pg_pool_singleton` is byte-identical to pre-phase state)
- D-074-12 sentinel green: `git diff backend/tests/integration/test_059_disconnect.py` returns empty (sse-starlette fixture body untouched, version-pin assertion at 2.4.x intact)

## Task Commits

Each task was committed atomically (using `--no-verify` per parallel-executor protocol to avoid pre-commit hook contention on the worktree):

1. **Task 1: Create `backend/tests/integration/conftest.py` with hoisted `_reset_redis_singleton` autouse fixture** — `ba324af` (test)
2. **Task 2: Delete local `_reset_redis_singleton` fixtures from test_062 and test_063** — `03d51da` (test)
3. **Task 3: Run 4-file pytest ship gate (D-074-14)** — no code commit (verification-only task); diagnostic + deferred-items log included in the final summary commit

_Plan metadata commit follows this SUMMARY._

## Files Created/Modified

- `backend/tests/integration/conftest.py` (NEW, +37 lines) — Module docstring documents the hoist rationale + D-074-12 (sse-starlette stays local) + D-074-13 (pg-pool stays root). Single sync autouse fixture `_reset_redis_singleton` that sets `app.dependencies._redis = None` before yield and again after, with imports deferred inside the function body per Phase 062/063 canonical.
- `backend/tests/integration/test_062_stream_replay.py` (MODIFIED, -18 lines net) — Local autouse fixture body (16 LOC + surrounding blank-line normalization) deleted; cross-import at line 31 preserved; test functions untouched.
- `backend/tests/integration/test_063_post_then_subscribe.py` (MODIFIED, -20 lines net) — Local autouse fixture body (18 LOC + surrounding blank-line normalization) deleted; cross-import at line 40 preserved; test functions untouched.
- `.planning/phases/074-seed-009-seed-011-polish-bundle/deferred-items.md` (NEW) — Full diagnostic of the Phase 073 -> Phase 074 FK-violation collision in test_059/062/063, with proof of pre-existence on commit `32e873d`.

## Decisions Made

- **Hoist target = sibling conftest, NOT root conftest** — root conftest's autouse fixtures stack additively with the sibling conftest's autouse fixtures, so the same protection reaches the integration directory without polluting unit/e2e tests with a Redis-specific reset they do not need.
- **Sync (`@pytest.fixture`) not async (`@pytest_asyncio.fixture`)** — `_deps._redis = None` is a plain attribute assignment; no `await` needed in setup or teardown. Pattern C sync template matches the canonical source exactly. Contrast Phase 073's `_reset_pg_pool_singleton` which IS async because asyncpg pool teardown awaits `pool.close()`.
- **Verbatim body, fresh module docstring** — the function body (decorator + signature + docstring + body + yield + teardown) is copy-paste from test_062 lines 36-51. The module-level docstring was authored fresh to explain the hoist rationale + D-074-12/13 protections; this is the only deviation from "byte-identical body."
- **No defensive sanity assertion** — RESEARCH.md Pitfall 2 mentions an optional "Phase 073 root fixture must have run before this" assertion. NOT added — the regression sweep is the protection (and adding an assertion would diverge from the verbatim contract). The pytest fixture resolution order is deterministic per pytest's autouse-stacking docs (root -> intermediate -> file); a runtime assertion would test pytest, not our code.

## Deviations from Plan

### Out-of-scope discovery (logged to deferred-items.md, NOT auto-fixed)

**1. [Scope boundary — Phase 073 collision] FK violations in test_059 / test_062 / test_063 surface on the ship-gate sweep**
- **Found during:** Task 3 (ship-gate sweep run)
- **Symptom:** 4 of 7 tests fail with `asyncpg.exceptions.ForeignKeyViolationError: insert or update on table "runs" violates foreign key constraint "runs_thread_id_fkey"`. test_058 (binding gate per D-073-11) stays GREEN.
- **Root cause:** Phase 073 Plan 04 flipped 3 hot-path writes from `aexec` (Supabase-mockable) to `asyncpg` calls into the real local Postgres pool. Phase 073's own integration test (`test_073_concurrency.py`) handles this by seeding `auth.users` + `threads` rows in its fixture. Phase 073's D-073-11 strategy explicitly preserved `test_058_concurrency.py` byte-identical as the legacy mock-Supabase binding gate, but did NOT extend the FK-seeding pattern to test_059/062/063 (which also drive POST → real `runs INSERT` via `httpx.AsyncClient` over `ASGITransport(app=app)`).
- **Proof of pre-existence:** Sweep on commit `32e873d` (pre-Plan-02 base) produces identical 4 failures. Sweep on commit `03d51da` (post-Plan-02 head) produces identical 4 failures. Zero introduced regressions.
- **Why NOT auto-fixed:** SCOPE BOUNDARY rule — auto-fix only issues DIRECTLY caused by the current task's changes. This failure mode was introduced by Phase 073, NOT Plan 074-02. Fixing it requires applying Phase 073 Plan 04's `test_thread_user` fixture pattern (auth.users + threads row seeding + cascade cleanup) to three more test files — a meaningful test-infra change that deserves its own plan, not an inline fix in a polish phase.
- **Confirmation Plan 02 closed SEED-011 at fixture level:** `grep "Event loop is closed"` across the full 4-file post-Plan-02 sweep returns ZERO matches. The original SEED-011 bug signature is structurally eliminated. The new failure mode is FK-violations, mechanically distinct from the loop-binding trap.
- **Logged:** `.planning/phases/074-seed-009-seed-011-polish-bundle/deferred-items.md` (D-074-02-DEFER-1)

---

**Total deviations:** 0 auto-fixed (1 out-of-scope discovery deferred via the scope-boundary rule and logged for a future test-infra polish phase).

**Impact on plan:** None — Plan 02's narrow goal (close SEED-011 by hoisting the Redis-singleton reset to a sibling conftest) IS achieved. The success criterion "no `Event loop is closed` anywhere in the test output" IS MET (zero grep matches). The success criterion "7/7 GREEN" is NOT met, but the 4 remaining failures are pre-existing on the pre-Plan-02 base and out of scope for this plan.

## Issues Encountered

- **Venv path resolution in worktree:** the worktree at `.claude/worktrees/agent-a3fdb3128df0633f6/` does not have its own `backend/venv` — the venv lives in the main repo at `C:/Vibe Apps/Agentic RAG/backend/venv`. The plan's verify hooks called `venv/Scripts/python` (relative); resolved by invoking the absolute path `C:/Vibe Apps/Agentic RAG/backend/venv/Scripts/python.exe`. Documenting because the plan's verify-hook snippets in `<verify>` would fail if naively pasted into the worktree shell. No code change needed; this is a worktree-execution detail captured for future parallel agents.

## Threat Flags

None — Plan 02 is pure test-infrastructure consolidation. No new network endpoints, no auth paths, no file access patterns, no schema changes at trust boundaries. The pre-existing `runs_thread_id_fkey` constraint validation surfaced via the deferred FK-violation issue is a Phase 073 surface, not a Plan-02-introduced surface.

## Next Phase Readiness

- Plan 074-02's contribution (the hoisted conftest) is load-bearing for any future test-infra phase that wants to fix the FK-seeding gap — the integration conftest is now the canonical location for shared sibling-test autouse fixtures.
- Phase 074 Plan 01 (SEED-009 max_tokens registry) runs in parallel in a separate worktree; the two plans have zero file overlap (Plan 01 touches `backend/app/services/model_capabilities.py` + tests; Plan 02 touches integration test infrastructure only).
- **Blocker for full phase-074 ship-gate closure:** Plan 074-02's 7/7 ship-gate criterion (D-074-14) is structurally blocked by the pre-existing Phase 073 -> Phase 074 FK-seeding collision documented in `deferred-items.md`. Recommend the phase owner choose one of two paths: (a) accept the partial ship-gate (test_058 GREEN, SEED-011 closed at fixture level per zero `Event loop is closed` grep matches) and roll the FK-seeding fix into a separate test-infra polish phase, or (b) extend Plan 02 scope at orchestration time to also seed `auth.users` + `threads` rows in test_059/062/063 fixtures.

## Self-Check: PASSED

**Files claimed to be created:**
- `backend/tests/integration/conftest.py` — FOUND
- `.planning/phases/074-seed-009-seed-011-polish-bundle/deferred-items.md` — FOUND

**Commits claimed:**
- `ba324af` (Task 1: hoist conftest) — FOUND in git log
- `03d51da` (Task 2: delete local copies) — FOUND in git log

**Sentinels:**
- `git diff backend/tests/conftest.py` empty — D-074-13 PASS
- `git diff backend/tests/integration/test_059_disconnect.py` empty — D-074-12 PASS
- `git diff backend/tests/integration/test_058_concurrency.py` empty — PASS
- `grep "Event loop is closed"` across 4-file sweep — ZERO matches — SEED-011 closed at fixture level

**Acceptance criteria coverage:**
- Task 1 AC1-AC8 — all green (verified)
- Task 2 AC1-AC9 — all green (verified)
- Task 3 AC1-AC5 — partial: AC3 (no `Event loop is closed`) PASS; AC1 (exit code 0), AC2 (7 passed), AC4 (no failed/error in summary) FAIL due to pre-existing Phase 073 collision; AC5 (total wall time <60s) PASS (7.99s)

---
*Phase: 074-seed-009-seed-011-polish-bundle*
*Plan: 02*
*Completed: 2026-05-18*

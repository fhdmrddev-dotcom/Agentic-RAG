---
seed_id: SEED-011
title: test_059_disconnect.py::test_normal_stream_unchanged — Event-loop-closed during fixture teardown
created: 2026-05-09
status: closed
closed: 2026-05-27
closed_by: 082-cross-cutting-verification-extraction-telemetry
priority: medium
re_open_triggers:
  - Next test-infra phase touching `backend/tests/integration/test_059_disconnect.py` or its fixtures
  - Any pytest-asyncio version bump in `backend/requirements.txt` / `pyproject.toml`
  - User adds new tests to test_059_disconnect.py that depend on Redis-backed flow
  - Skill Studio milestone scaffolds new SSE eval tests that import 059's `_drive_sse_until_disconnect` (per SEED-002 reusable-pattern note)
  - Any flaky-test investigation surfaces other cases of `RuntimeError: Event loop is closed` during teardown
relates_to:
  - Phase 065 deferred-items.md D-065-01-DEFER-2 (originally documented during Plan 065-01 no-regression gate)
  - Phase 062 plan 02 deviation pattern (`_reset_redis_singleton` autouse fixture analog at `tests/integration/test_062_stream_replay.py:36-51`)
  - Phase 063 plan 1 verbatim copy of `_reset_redis_singleton` at `tests/integration/test_063_post_then_subscribe.py:45-62`
  - Phase 065 Plan 03 SUMMARY — verified pre-existing on `fa1e327` base via git-stash round-trip
closure_note: "Fully consumed by Phase 074. test_059_disconnect.py 3/3 PASS without RuntimeError. POLISH-SEED-011-01 Validated."
---

# SEED-011: test_059 fixture teardown loop-binding bug

## What's deferred

`backend/tests/integration/test_059_disconnect.py::test_normal_stream_unchanged` fails with `RuntimeError: Event loop is closed` during fixture teardown. Other tests in the same file (`test_disconnect_during_stream`, `test_partial_response_persisted`) pass. Phase 065 Plan 03 verified the failure is pre-existing on the pristine `fa1e327` base via `git stash` round-trip — NOT a Phase 065 regression.

## Likely root cause

Same loop-binding trap as Phase 062 / 063: pytest-asyncio function-scope creates a fresh event loop per test, and a cached singleton (Redis client, sse-starlette `AppStatus`, or similar) holds an event-loop reference past the loop close. When teardown runs against the closed loop, `RuntimeError: Event loop is closed` fires.

Phase 062 Plan 02 deviation pattern is the canonical fix: add an autouse `_reset_redis_singleton` fixture that nulls `app.dependencies._redis = None` pre/post test (verbatim form at `tests/integration/test_062_stream_replay.py:36-51` and `tests/integration/test_063_post_then_subscribe.py:45-62`). The same pattern likely applies here, possibly extended to also reset `_reset_sse_starlette_app_status` (see `test_059_disconnect.py:64-94` for its own version that the file self-imports).

## Why it's deferred from v2.5

Phase 065's charter was test-only maintenance for the *skills* test suite (`test_threads_skills.py` + `test_skills_import_export.py`). Generalizing to all integration test fixtures was explicitly out of scope per ROADMAP success criteria. The failure also pre-dates v2.5: it exists on `fa1e327`, the base from which v2.5 forked.

## When to surface

Re-open when any of the triggers above fires. Concrete protocol:

1. Read `tests/integration/test_062_stream_replay.py:36-51` to confirm the canonical `_reset_redis_singleton` shape.
2. Add the same autouse fixture to `tests/integration/test_059_disconnect.py` (or a shared `conftest.py` if multiple files need it).
3. If `_reset_sse_starlette_app_status` is also referenced, ensure it survives the move (it's already self-imported in 059).
4. Run `cd backend && venv/Scripts/python -m pytest tests/integration/test_059_disconnect.py -q` — expect 3/3 PASS, no `Event loop is closed` errors.
5. Cross-check 058 + 062 + 063 still green afterward (the fixture should not interfere with those files since they have their own copies, but verify).

## Cost estimate

~15 minutes (paste fixture + verify). Pure test-infra hygiene.

## Reference paths

- `backend/tests/integration/test_059_disconnect.py:64-94` — existing `_reset_sse_starlette_app_status` autouse.
- `backend/tests/integration/test_062_stream_replay.py:36-51` — canonical `_reset_redis_singleton` template.
- `backend/tests/integration/test_063_post_then_subscribe.py:45-62` — verbatim copy of the 062 template.
- `.planning/phases/065-skills-test-infrastructure-repair/deferred-items.md` — D-065-01-DEFER-2 original record.

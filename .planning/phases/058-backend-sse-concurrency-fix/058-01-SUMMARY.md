---
phase: 058-backend-sse-concurrency-fix
plan: 01
subsystem: infra
tags: [sse, fastapi, concurrency, threadpool, anyio, supabase]

requires:
  - phase: pre-058
    provides: existing _patch_postgrest_maybe_single import-time patch and lifespan() shell
provides:
  - aexec(query) async helper wrapping supabase .execute() in starlette run_in_threadpool
  - Settings.anyio_thread_tokens int field (default 200, env-overridable via ANYIO_THREAD_TOKENS)
  - lifespan() startup bumps AnyIO default thread limiter total_tokens to settings.anyio_thread_tokens
affects: [058-02, 058-03, 059, 060, 061, 062]

tech-stack:
  added: []
  patterns:
    - "Async wrapper helper module under backend/app/utils/ — module-level coroutine, opaque-typed"
    - "lifespan() runtime side-effect for global limiter set (NOT module-level — D-058-08)"

key-files:
  created:
    - backend/app/utils/db.py
  modified:
    - backend/app/config.py
    - backend/app/main.py

key-decisions:
  - "aexec body is exactly `await run_in_threadpool(query.execute)` — no instrumentation, no client capture (D-058-03/04/06 verbatim)"
  - "Limiter bump runs inside lifespan() startup, not at module import — re-imports during tests do not re-trigger (D-058-08)"
  - "Coexists with _patch_postgrest_maybe_single at main.py:19–42 — both wrap execute, both stay (must_haves truth)"

patterns-established:
  - "backend/app/utils/db.py — shared async DB indirection module; future async helpers (asyncpg migration) will live here"
  - "Settings concurrency knob convention: ALL_CAPS env var → snake_case Settings field, plain int with no validator"

requirements-completed:
  - CONCUR-01

duration: ~7min
completed: 2026-05-01
---

# Phase 058 Plan 01: aexec Helper + AnyIO Thread Limiter Bump

**Shared `aexec(query)` async wrapper around supabase `.execute()` plus AnyIO 200-token default thread limiter set in lifespan startup — the additive infrastructure that Plan 02 wraps call sites against and Plan 03 tests against.**

## Performance

- **Duration:** ~7 min (executor wall time)
- **Completed:** 2026-05-01
- **Tasks:** 3
- **Files modified:** 2 (config.py, main.py); 1 created (utils/db.py)

## Accomplishments

- `aexec(query)` coroutine helper landed in `backend/app/utils/db.py` — opaque-typed, single public callable, body is `return await run_in_threadpool(query.execute)`
- `Settings.anyio_thread_tokens: int = 200` added to `backend/app/config.py`, env-overridable via `ANYIO_THREAD_TOKENS`
- `lifespan()` startup in `backend/app/main.py` bumps `anyio.to_thread.current_default_thread_limiter().total_tokens` to `settings.anyio_thread_tokens`
- Existing `_patch_postgrest_maybe_single()` (lines 19/42) and sandbox shutdown block preserved verbatim
- ROADMAP Success Criterion 3 (AnyIO limiter raised from 40 to 200) is fully delivered by this plan

## Task Commits

1. **Task 1: aexec helper module** — `752133c` (feat)
2. **Task 2: anyio_thread_tokens Settings field** — `71cafa8` (feat)
3. **Task 3: lifespan limiter bump** — `d8c84a9` (feat)

## Files Created/Modified

- `backend/app/utils/db.py` (NEW) — `aexec` coroutine + module docstring + logger
- `backend/app/config.py` — `anyio_thread_tokens: int = 200` field added inside Settings (line 237)
- `backend/app/main.py` — `import anyio`, lifespan startup limiter bump

## Decisions Made

- None — plan executed exactly as specified (D-058-03/04/06/07/08 verbatim).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Verification probe was deferred to post-merge because the worktree shell environment did not have `.env` for Settings instantiation; structural import test passed (`aexec` imports cleanly, is a coroutine function). Full runtime probe (`async with lifespan(app): assert tokens == 200`) is part of the orchestrator's post-merge gate before Wave 2 spawns.

## Next Phase Readiness

- `from app.utils.db import aexec` is the import path Plan 02 will wire across 6 files.
- `settings.anyio_thread_tokens` is the runtime knob for the limiter — Plan 02/03 do not change it.
- AnyIO limiter is hot at app startup; Plan 03's `httpx.AsyncClient(app=app, ...)` test will exercise it implicitly.

---
*Phase: 058-backend-sse-concurrency-fix*
*Plan: 01*
*Completed: 2026-05-01*

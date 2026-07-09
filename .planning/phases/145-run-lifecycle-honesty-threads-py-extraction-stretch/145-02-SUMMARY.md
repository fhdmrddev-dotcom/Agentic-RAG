---
phase: 145-run-lifecycle-honesty-threads-py-extraction-stretch
plan: 02
subsystem: infra
tags: [run-lifecycle, redis, asyncpg, streaming, run-status, pytest-asyncio, di]

# Dependency graph
requires:
  - phase: 145-01
    provides: LIVE run-state desync repro (145-REPRO.md) grounding the co-write anti-drift design
  - phase: 073
    provides: db.runs.insert_run / db.runs.finalize_run shared writers reused by the owner
  - phase: 137.1
    provides: run_reconciler.py DI shape + _ACTIVE_SET_KEY constant + in-memory _FakePool/_FakeRedis fakes
provides:
  - "backend/app/services/run_lifecycle.py — the atomic run-lifecycle owner (register_run_start + finalize_run_terminal)"
  - "Chat-scoped invariant by construction: run_id ∈ runs:active ⇔ runs.status == 'streaming' (co-written as one unit)"
  - "backend/tests/test_run_lifecycle.py — atomicity proof (status write + Redis ZADD/ZREM fire together for one run_id)"
affects: [145-03, 145-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic status⇄mirror co-write (Pattern 1 anti-drift): db.runs writer + runs:active membership move as ONE unit"
    - "DI-for-testability: explicit pool/redis kwargs → in-memory _FakePool/_FakeRedis, no live DB/Redis"

key-files:
  created:
    - backend/app/services/run_lifecycle.py
    - backend/tests/test_run_lifecycle.py
  modified: []

key-decisions:
  - "Postgres runs.status is AUTHORITATIVE (D-145-01); runs:active is the derived mirror the owner co-writes — supersedes the pre-trace 'runs:active is source of truth' framing"
  - "register_run_start co-writes insert_run(streaming) + ZADD runs:active + ZADD runs_by_thread as one unit; finalize_run_terminal co-writes finalize_run(terminal) + ZREM x2 (D-145-02)"
  - "Module is NEW/additive — reuses the shared db.runs writers, does NOT fork/migrate the 5 eval/tuner writers; invariant is CHAT-SCOPED this phase (D-145-12)"
  - "Owner stays THIN — does not swallow the DB write's exceptions and does not XADD the terminal sentinel or EXPIRE the stream (those stay in the threads.py producer, Plan 03)"

patterns-established:
  - "Atomic co-write owner: one module owns both the authoritative status write and its Redis mirror so the mirror cannot drift"
  - "cap_paused is non-terminal/re-attachable — finalize_run_terminal is called ONLY for TRUE terminals (producer must gate it out)"

requirements-completed: [FND-01]

# Metrics
duration: 20min
completed: 2026-07-09
---

# Phase 145 Plan 02: Run-Lifecycle Atomic Co-Writer Owner Summary

**A new DI'd, unit-tested `run_lifecycle.py` that co-writes Postgres `runs.status` and its `runs:active` Redis mirror as one unit — reusing `db.runs.insert_run`/`finalize_run` — so the mirror can't drift from the authoritative status (the G-5 paydown foundation for Plans 03/04).**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-09T13:45:00Z
- **Completed:** 2026-07-09T14:04:56Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- Created `backend/app/services/run_lifecycle.py` — two async atomic co-writers (`register_run_start`, `finalize_run_terminal`) with explicit `pool`/`redis` DI, reusing the shared `db.runs` writers (parity, no fresh SQL).
- Proved atomicity in isolation: `test_run_lifecycle.py` asserts the status write AND the Redis ZADD/ZREM both fire for the SAME `run_id` in one call, via in-memory `_FakePool` + `_FakeRedis` (no live DB/Redis).
- Established the authority model in the module docstring (D-145-01): `runs.status` authoritative, `runs:active` the derived mirror; invariant is chat-scoped (D-145-12) with the 5 deferred eval/tuner writers named so no future reader assumes a global invariant.
- Runtime is byte-identical — nothing calls the owner yet (dead code until Plan 03 wires threads.py + the cancel zombie-heal and Plan 04 wires the reconciler sweep).

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: Write the atomic co-writer test scaffold (RED)** - `ec5695c0` (test)
2. **Task 2: Create run_lifecycle.py — register_run_start + finalize_run_terminal (GREEN)** - `241a8e30` (feat)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified
- `backend/app/services/run_lifecycle.py` - The atomic run-lifecycle owner: `register_run_start` (insert_run + ZADD ×2) and `finalize_run_terminal` (finalize_run + ZREM ×2), both DI'd on `pool`/`redis`, thin, reusing `db.runs`.
- `backend/tests/test_run_lifecycle.py` - Atomicity unit tests with in-memory `_FakePool`/`_FakeRedis` (the reconciler fakes, extended with a `zadd` recorder that distinguishes `runs:active` from `runs_by_thread:*`).

## Decisions Made
- **Authority inverted to Postgres `runs.status`** (D-145-01): the docstring names `runs.status` authoritative and `runs:active` the derived mirror, superseding the pre-trace framing. The frontend derives `isStreaming` from `get_snapshot` (reads `runs.status`), never from `runs:active`.
- **Thin owner** (T-145-02-02): callers keep their existing per-op best-effort try/except; the owner propagates the DB write's exceptions and does not own the SSE sentinel/EXPIRE (Plan 03 producer keeps those).
- **Chat-scoped invariant** (D-145-12): the module is additive and reuses the shared writers; it does NOT migrate the 5 eval/tuner status writers (`eval_runner_service.py`, `run_reconciler._reconcile_eval_runs`, `skill_tuner.py`, `api/evals.py`, `agent_loop.py` cap_paused), each named in the docstring.
- **No logger / no logging import** — the owner logs nothing containing content (T-145-02-01); kept minimal and lint-clean rather than mirroring the reconciler's unused logger.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None. RED confirmed via `ModuleNotFoundError` before Task 2; GREEN confirmed (2 passed) after creating the module; `test_run_reconciler.py` still 4 passed (owner is dead code — no regression).

## User Setup Required
None - no external service configuration required.

## Threat Register Coverage
- **T-145-02-01** (Information Disclosure): owner writes the caller-supplied `error` verbatim and logs nothing containing content — satisfied (no logging in the module; short reason strings are the caller's contract).
- **T-145-02-02** (partial co-write, accepted): owner stays thin; a missed ZREM is eventually self-healed by the Plan-04 reconciler stream-age sweep — documented in the module docstring.
- **T-145-02-EoP / -SC** (accepted): no new route/entry point; no package installs.

No new threat surface introduced beyond the plan's `<threat_model>` (no route, no request handling, no schema change).

## Next Phase Readiness
- The atomic owner exists and is proven; Plan 03 can re-point `threads.py` (start/terminal/spawn-fail) + the `runs.py` cancel zombie-heal onto it, and Plan 04 can wire the reconciler stream-age sweep.
- No blockers. The owner is importable and dead-code until wired (existing suites unaffected).

## Self-Check: PASSED
- FOUND: backend/app/services/run_lifecycle.py
- FOUND: backend/tests/test_run_lifecycle.py
- FOUND commit: ec5695c0 (test — RED)
- FOUND commit: 241a8e30 (feat — GREEN)
- Tests: `tests/test_run_lifecycle.py` 2 passed; `tests/test_run_reconciler.py` 4 passed (no regression)

---
*Phase: 145-run-lifecycle-honesty-threads-py-extraction-stretch*
*Completed: 2026-07-09*

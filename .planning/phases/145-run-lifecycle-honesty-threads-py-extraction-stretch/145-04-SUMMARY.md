---
phase: 145-run-lifecycle-honesty-threads-py-extraction-stretch
plan: 04
subsystem: infra
tags: [run-lifecycle, redis-streams, reconciler, xinfo-stream, fastapi-lifespan, worker-safety, pytest-asyncio]

# Dependency graph
requires:
  - phase: 145-02
    provides: "run_lifecycle.finalize_run_terminal — the atomic terminal co-writer (status + ZREM ×2) the sweep routes chat terminalizations through"
  - phase: 137.1
    provides: "run_reconciler.reconcile_orphaned_runs — the boot-time CAS-guarded orphan sweep this plan extends with the stream-age predicate + periodic host"
provides:
  - "Stream-age chat orphan oracle (_is_chat_orphan): a non-terminal runs row whose run:{id} stream is MISSING or older than STALE_TIMEOUT is failed via the owner — catches the dead-producer orphan that D-145-02 leaves present-in-mirror (membership blind)"
  - "reconcile_orphaned_runs parametrized: stale_timeout_ms / lock_ttl / include_cap_paused (config-backed defaults)"
  - "config: run_stale_sweep_timeout_seconds=2400 (>1800s ask_user ceiling) + run_stale_sweep_interval_seconds=120"
  - "Periodic single-flight stream-age sweep in the main.py lifespan (lock_ttl=90 < 120s tick, cap_paused excluded)"
affects: [145-05, threads.py-extraction, cross-provider-capability-uat, SEED-109]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stream-age liveness oracle (XINFO STREAM last-generated-id vs redis.time()) replacing runs:active membership for chat runs — a live long run keeps its stream fresh, a dead producer's goes stale"
    - "Config-backed generous kill threshold (2400s > the 1800s ask_user ceiling) so a live-but-quiet run is never false-killed"
    - "SET NX guard with a per-caller lock_ttl (< the interval tick) for WORKER_COUNT=2 single-flight periodic sweeps"

key-files:
  created: []
  modified:
    - "backend/tests/test_run_reconciler.py — RED→GREEN stream-age cases + _FakeRedis xinfo_stream/time/zadd + status-filtered _FakePool.fetch"
    - "backend/app/services/run_reconciler.py — _is_chat_orphan stream-age predicate, owner-routed chat terminalization, parametrized entrypoint, corrected docstring"
    - "backend/app/config.py — run_stale_sweep_timeout_seconds=2400 + run_stale_sweep_interval_seconds=120"
    - "backend/app/main.py — _reconcile_orphans_periodic lifespan interval task"

key-decisions:
  - "Chat orphan-ness is grounded on STREAM AGE, not runs:active membership (D-145-06) — under the Plan 02 owner co-write a dead-producer orphan STAYS in the mirror, so membership is blind"
  - "STALE_TIMEOUT default = 2400s (config-driven), exceeding the 1800s ask_user ceiling so an ask_user-waiting or long o-series run is never false-killed (D-145-07 / 145-REPRO A2)"
  - "cap_paused EXCLUDED from the periodic sweep (include_cap_paused=False) — it is the legitimate, re-attachable iteration-cap pause (Pitfall 3); the boot sweep keeps covering it"
  - "A NON-'no such key' Redis fault on the age read PROPAGATES → per-row SKIP, never a false kill (Pitfall 6)"
  - "Eval reconcile keeps the membership _is_orphan oracle (D-145-12 — eval writers not migrated); only the chat predicate changed"
  - "Cross-worker cancel NOT attempted — flagged to SEED-109 (D-145)"

patterns-established:
  - "Stream-age reconciliation: XINFO STREAM last-generated-id compared to redis.time() (Redis clock, no app↔Redis skew), missing stream → orphan"
  - "Per-caller SET NX lock_ttl for single-flight interval tasks under WORKER_COUNT=2"

requirements-completed: [FND-01]

# Metrics
duration: ~10 min
completed: 2026-07-09
---

# Phase 145 Plan 04: Direction-B stream-age reconciler Summary

**Backend now self-heals a LYING `runs.status='streaming'` — a dead-producer chat run whose `run:{id}` stream stopped growing is terminalized to `failed` via the Plan 02 owner, on both a boot and a periodic single-flight sweep, keyed on Redis stream-age (not `runs:active` membership, which D-145-02 makes blind).**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-09T15:03:00Z (approx)
- **Completed:** 2026-07-09T15:13:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Replaced the chat orphan oracle with stream-age (`_is_chat_orphan`): `run:{id}` stream MISSING or `last-generated-id` older than `STALE_TIMEOUT` → `failed`, routed through `run_lifecycle.finalize_run_terminal` (co-writes the ZREM ×2 so the mirror never drifts). The crux — a run PRESENT in `runs:active` but with a stale stream is STILL flipped — is unit-proven.
- Parametrized `reconcile_orphaned_runs(*, stale_timeout_ms, lock_ttl, include_cap_paused)` with config-backed defaults; eval reconcile keeps membership `_is_orphan` untouched (D-145-12).
- Added `run_stale_sweep_timeout_seconds=2400` (> the 1800s ask_user ceiling) and `run_stale_sweep_interval_seconds=120` to `config.py`.
- Added `_reconcile_orphans_periodic` to the `main.py` lifespan: a `while True` + `asyncio.sleep` interval task, `lock_ttl=90` (< the 120s tick) for WORKER_COUNT=2 single-flight, `cap_paused` excluded (Pitfall 3). Boot sweep untouched.
- Rewrote the reconciler module docstring — `runs.status` is authoritative, stream-age is the chat oracle; dropped the "AUTHORITATIVE streaming set" framing for `runs:active`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend test_run_reconciler.py with stream-age cases (RED)** - `ab6b9637` (test)
2. **Task 2: Swap chat orphan predicate to stream-age + config Settings + docstrings (GREEN)** - `443826e6` (feat)
3. **Task 3: Add the periodic single-flight sweep to the main.py lifespan** - `7de17aac` (feat)

_TDD gate: Task 1 `test(...)` (RED — 7 new cases fail on the new params) → Task 2 `feat(...)` (GREEN — 10/10 pass)._

## Files Created/Modified
- `backend/tests/test_run_reconciler.py` - `_FakeRedis` gains `xinfo_stream` (last-generated-id / `no such key` / non-nosuchkey fault) + `time` + `zadd` + `seed_stream`/`seed_error_stream`; `_FakePool.fetch` honors the status-list bind; new cases: stale / fresh / present-but-stale / missing / cap_paused / redis-error + periodic `lock_ttl`.
- `backend/app/services/run_reconciler.py` - `_is_chat_orphan` stream-age predicate; `_reconcile_chat_runs` selects `run_id`+`thread_id`, filters status by `include_cap_paused`, terminalizes via the owner; parametrized entrypoint; corrected docstring; eval `_is_orphan` preserved.
- `backend/app/config.py` - `run_stale_sweep_timeout_seconds: int = 2400` + `run_stale_sweep_interval_seconds: int = 120` (with the ask_user-ceiling rationale comment).
- `backend/app/main.py` - `_reconcile_orphans_periodic` interval task + its `asyncio.create_task` spawn (additive, +32 lines, 0 deletions).

## Decisions Made
- **Stream-age over membership for chat (D-145-06):** the Plan 02 owner keeps `runs:active` in lock-step with `runs.status`, so a dead-producer orphan now stays present in the mirror — only stream freshness distinguishes a live long run from a dead one.
- **2400s config default (D-145-07):** load-bearing — it exceeds the 1800s `ask_user_max_timeout_seconds` ceiling so an `ask_user`-waiting run is never swept. Exposed as a `config.py` knob (tunable without a deploy).
- **`cap_paused` excluded from the periodic sweep (Pitfall 3):** it is a legitimate, re-attachable pause with a quiet stream; the boot sweep still covers it.
- **Redis fault → SKIP (Pitfall 6):** only a `no such key` `ResponseError` means orphan; any other fault propagates to the per-row handler which logs and skips — never a false kill.
- **Cross-worker cancel deferred to SEED-109 (D-145):** explicitly out of scope, not attempted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed the now-unused `finalize_run` import in run_reconciler.py**
- **Found during:** Task 2 (predicate swap)
- **Issue:** Chat terminalization moved from a direct `db.runs.finalize_run` call to `run_lifecycle.finalize_run_terminal`, leaving `from app.db.runs import finalize_run` dead (the eval path uses supabase-py, not this import).
- **Fix:** Dropped the unused import; `finalize_run_terminal` (which internally reuses `db.runs.finalize_run`) is the sole terminal writer the module now references.
- **Files modified:** backend/app/services/run_reconciler.py
- **Verification:** `import app.main` + `import app.services.run_reconciler` succeed; 10/10 reconciler tests pass.
- **Committed in:** `443826e6` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking/cleanup)
**Impact on plan:** The cleanup is a direct consequence of routing terminalization through the owner. No scope creep — all other work matches the plan exactly.

## Issues Encountered
None. The RED gate confirmed cleanly (7 new cases failed on the not-yet-added params under the old signature), and GREEN passed on the first implementation.

## User Setup Required
None - no external service configuration required. `run_stale_sweep_timeout_seconds` / `run_stale_sweep_interval_seconds` default sensibly and are env-overridable via pydantic-settings if an operator wants to tune them.

## Next Phase Readiness
- The backend WRITER half of Direction B honesty is in place. Plan 05 (frontend watchdog) can now trust `runs.status` — the sweep is the mechanism that corrects a lying status the watchdog reads.
- Live SC#10 UAT (145-VALIDATION.md, operator-driven) remains: Direction B cross-provider (DeepSeek + MiniMax) requires a real producer death (`--reload` restart / broken SSE) — deferred to `/gsd:verify-work`. Not run here (unit tests are self-contained; the live dev backend/Redis were not touched or restarted).
- No blockers.

## Self-Check: PASSED
- Files verified present: `backend/tests/test_run_reconciler.py`, `backend/app/services/run_reconciler.py`, `backend/app/config.py`, `backend/app/main.py`.
- Commits verified in `git log`: `ab6b9637`, `443826e6`, `7de17aac`.
- Tests: `tests/test_run_lifecycle.py tests/test_run_reconciler.py` → 12 passed via venv (no live DB/Redis dependency).

---
*Phase: 145-run-lifecycle-honesty-threads-py-extraction-stretch*
*Completed: 2026-07-09*

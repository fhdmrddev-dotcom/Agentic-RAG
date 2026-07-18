---
phase: 145-run-lifecycle-honesty-threads-py-extraction-stretch
plan: 03
subsystem: infra
tags: [run-lifecycle, redis, asyncpg, streaming, run-status, cancel, sse, pytest-asyncio, g-5-extraction]

# Dependency graph
requires:
  - phase: 145-01
    provides: 145-REPRO.md Direction B (restart-orphaned zombie drift) — the drift this plan closes by construction
  - phase: 145-02
    provides: run_lifecycle.py atomic co-writers (register_run_start / finalize_run_terminal) + _FakePool/_FakeRedis fakes
  - phase: 073
    provides: db.runs.insert_run / finalize_run asyncpg writers the owner reuses
  - phase: 062
    provides: DELETE /runs/{id} cancel handler (ownership SELECT / zombie-heal / cancel_lock)
provides:
  - "threads.py chat-run producer re-pointed onto the run_lifecycle owner — START register, SPAWN-FAIL, Deep TERMINAL, continuation TERMINAL all co-write status+mirror atomically (D-145-09 G-5 extraction)"
  - "runs.py cancel zombie-heal re-pointed onto finalize_run_terminal('cancelled') for writer parity (D-145-14) — no new cancel logic"
  - "backend/tests/test_cancel_run.py — cancel-parity (D-145-13) + zombie-heal-routing (D-145-14) unit proofs, self-contained fakes"
affects: [145-04, 145-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Producer-onto-owner: threads.py/runs.py call the run_lifecycle co-writers for status+runs:active; the SSE transport (sentinel/EXPIRE/get_snapshot/RUN_TASKS) stays in threads.py"
    - "cap_paused split: TRUE terminals → finalize_run_terminal (status+ZREM); cap_paused → plain finalize_run (status only, keeps re-attachable membership)"
    - "Handler-routing unit proof: drive the real cancel_run zombie-heal with fakes + an owner spy (no live DB/Redis)"

key-files:
  created:
    - backend/tests/test_cancel_run.py
  modified:
    - backend/app/api/threads.py
    - backend/app/api/runs.py

key-decisions:
  - "threads.py no longer owns chat-run status⇄mirror transitions — all four blocks route through the owner; non-comment grep for zadd/zrem(\"runs:active\") == 0 (G-5 extraction proof)"
  - "SSE transport stays in threads.py: terminal sentinel XADD + EXPIRE run AFTER the owner call, preserving the 075.4-03 status-first ordering"
  - "cap_paused continuation writes its status via plain finalize_run (NOT the owner) so it keeps runs:active membership (re-attachable) — the old != cap_paused ZREM gate, preserved"
  - "runs.py zombie-heal cancel uses finalize_run_terminal('cancelled') for writer parity (D-145-14); every ownership/lock/short-circuit control preserved verbatim; cross-worker cancel (Open Q1) flagged not fixed"

patterns-established:
  - "One owner, one atomic unit: a chat-run status write and its runs:active mirror move together at every start/terminal so they cannot drift"
  - "Extraction preserves transport: only the status+mirror writes move to the owner; the sentinel/EXPIRE/get_snapshot/RUN_TASKS stay put"

requirements-completed: [FND-01]

# Metrics
duration: 45min
completed: 2026-07-09
---

# Phase 145 Plan 03: threads.py + runs.py Re-Pointed onto the Run-Lifecycle Owner Summary

**The actual G-5 extraction: threads.py's chat-run START/terminal/spawn-fail and runs.py's cancel zombie-heal now co-write `runs.status` and its `runs:active` mirror through the Plan-02 owner as one atomic unit — so status and mirror can no longer drift (BUG-260709-01 / 145-REPRO Direction B) — while the SSE transport, cap_paused re-attachability, and every cancel access-control gate stay byte-identical.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-07-09T14:10:00Z
- **Completed:** 2026-07-09T14:55:00Z
- **Tasks:** 2 (Task 2 was TDD: RED → GREEN)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Re-pointed **all four** threads.py chat-run lifecycle blocks onto the owner: START register (`insert_run` + ZADD ×2 → `register_run_start`), SPAWN-FAIL (`supabase UPDATE` + ZREM ×2 → `finalize_run_terminal('failed')`), Deep TERMINAL (`finalize_run` + ZREM ×2 → `finalize_run_terminal`), and continuation TERMINAL (`finalize_run` + gated ZREM ×2 → owner for true terminals / plain `finalize_run` for cap_paused).
- Machine-proved the extraction: non-comment `grep -c 'zadd("runs:active"'` **and** `'zrem("runs:active"'` in threads.py both == **0** — the chat-lifecycle mirror writes now live exclusively in the owner (D-145-09).
- Preserved the SSE transport verbatim: terminal sentinel XADD + `EXPIRE run:{id}` still run in the producer AFTER the owner call (075.4-03 ordering), and `get_snapshot` / `RUN_TASKS` / `_emit`/`_emit_terminal` are untouched.
- Swapped runs.py's cancel zombie-heal writer to `finalize_run_terminal('cancelled')` (D-145-14) with the pool threaded in via a local `await get_pg_pool()`, keeping the ownership SELECT (404-not-403), already-terminal 204 short-circuit, happy-path `publish_cancel_sentinel` + `task.cancel()`, `cancel_lock` SETNX, synthetic sentinel, and EXPIRE all intact.
- Proved cancel correctness with a NEW self-contained unit file `test_cancel_run.py` (fakes only): `test_cancel_finalizes_and_zrems` (D-145-13 status='cancelled' + ZREM ×2) and `test_cancel_handler_routes_zombie_heal_through_owner` (drives the real handler → owner spy, D-145-14).

## Task Commits

Each task was committed atomically (Task 2 was TDD RED → GREEN):

1. **Task 1: Wire the threads.py producer onto register_run_start / finalize_run_terminal** — `e033902c` (refactor)
2. **Task 2 (RED): cancel-parity + zombie-heal-routing tests** — `2b81a5ed` (test)
3. **Task 2 (GREEN): route runs.py cancel zombie-heal through finalize_run_terminal** — `0de00326` (feat)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified
- `backend/app/api/threads.py` - Producer re-pointed onto the owner at START/spawn-fail/Deep-terminal/continuation-terminal; SSE sentinel/EXPIRE + cap_paused gate + get_snapshot preserved; no literal `zadd/zrem("runs:active")` for chat lifecycle remains.
- `backend/app/api/runs.py` - Cancel zombie-heal writes its `cancelled` terminal via `finalize_run_terminal` (pool threaded in); the supabase UPDATE-to-cancelled + standalone ZREM ×2 removed; all cancel controls preserved.
- `backend/tests/test_cancel_run.py` (created) - Cancel-parity + handler-routing unit proofs with copied `_FakePool`/`_FakeRedis` + a supabase/redis handler double + owner spy — no live DB/Redis.

## Decisions Made
- **Producer-onto-owner, transport-stays** (D-145-09): only the status+mirror writes moved to the owner; the terminal sentinel, EXPIRE, `get_snapshot`, and `RUN_TASKS` remain in threads.py so the SSE contract is byte-identical. The owner writes status FIRST (then ZREM); the sentinel still lands AFTER status (075.4-03).
- **cap_paused writes status but keeps membership**: a continuation ending `cap_paused` still needs its `runs.status='cap_paused'` written (the producer's `_shielded_finalize` / continuation finalizer is the authoritative writer per agent_loop:305-307/1411-1413), but must NOT ZREM (stays re-attachable). Routing it through the owner would ZREM, so cap_paused takes an explicit `else` branch calling plain `finalize_run` — preserving the old `!= "cap_paused"` gate exactly.
- **Cancel = writer swap only** (D-145-14): the zombie-heal terminal now flows through the owner for parity; no cross-worker cancel logic was added (Open Q1 / T-145-03-03 stays flagged for Plan 06).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Continuation `cap_paused` status write preserved via explicit if/else**
- **Found during:** Task 1 (continuation TERMINAL block)
- **Issue:** The `<extraction_map>` shorthand ("`finalize_run_terminal(…)` ONLY when `_terminal_status != "cap_paused"`") reads as replacing the whole `finalize_run` call. Taken literally that would DROP the `cap_paused` status write, leaving a cap-paused continuation stuck at `runs.status='streaming'` (the producer finalizer is cap_paused's authoritative status writer — agent_loop:305-307/1411-1413).
- **Fix:** Split into `if _terminal_status != "cap_paused"` → `finalize_run_terminal` (status + ZREM) `else` → plain `finalize_run` (status only, no ZREM). Preserves cap_paused semantics byte-identically (status written, no sentinel, EXPIRE runs, membership kept).
- **Files modified:** backend/app/api/threads.py
- **Verification:** `if _terminal_status != "cap_paused"` gate present (grep); owner + reconciler unit tests green.
- **Committed in:** `e033902c` (Task 1 commit)

**2. [Rule 1 - Bug] Spawn-fail `completed_at` upgraded from the legacy `"now()"` string to a datetime**
- **Found during:** Task 1 (SPAWN-FAIL block)
- **Issue:** The old spawn-fail cleanup wrote `supabase.table("runs").update({..., "completed_at": "now()"})` — the exact WR-01 anti-pattern (PostgREST may store the literal string / NULL). Routing through the owner's `finalize_run` writes a real `datetime.now(timezone.utc)`.
- **Fix:** Incidental correctness win from the extraction — spawn-fail now writes `completed_at=datetime.now(timezone.utc)`, symmetric with the finalize path.
- **Files modified:** backend/app/api/threads.py
- **Committed in:** `e033902c` (Task 1 commit)

**3. [Rule 2 - Correctness] START mirror-write failures now propagate (anti-drift) instead of being swallowed**
- **Found during:** Task 1 (START register block)
- **Issue:** The old START swallowed ZADD failures ("continuing (passive cleanup at query time)") — precisely the drift source (status='streaming' written, mirror missing). The owner co-writes `insert_run` + ZADD atomically and does not swallow, so a ZADD failure now propagates to the spawn-fail cleanup (marks the run `failed` + ZREM). In the normal case (Redis up) behavior is byte-identical; a Redis-down START — which could not stream anyway — now aborts honestly rather than leaving a phantom-streaming row.
- **Fix:** Intended consequence of the D-145-01/02 co-write design; documented, not worked around.
- **Files modified:** backend/app/api/threads.py
- **Committed in:** `e033902c` (Task 1 commit)

### Deferred (logged to `deferred-items.md`)

**4. Three live-infra integration tests assert the pre-145-03 supabase cancel writer** — `test_062_delete_zombie.py`, `test_062_redis_down.py`, `test_066_terminal_classification.py::test_delete_writes_cancelled_not_timed_out` assert `mock_supabase.table("runs").update(status='cancelled')` for the zombie-heal, which the writer swap removes; they also need a pool now. They bind the operator's **live dev Redis (:6379)** (and, post-swap, real Postgres), so running/verifying them would mutate shared keyspace — prohibited this session. Logged with the owner-spy fix recipe + a re-open trigger (next isolated-infra suite run). `test_077_cross_cancel.py` reads real Postgres so likely stays green. See `deferred-items.md` → D-145-03-DEFER-01.

---

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 2) + 1 deferred.
**Impact on plan:** All three auto-fixes preserve or improve correctness within the extraction's intent (cap_paused honesty, WR-01 timestamp, anti-drift coupling) — no scope creep. The deferred item is test-maintenance blocked purely by the no-live-infra constraint.

## Issues Encountered
- **Which tests are safe to run.** The plan's `-k "thread or cancel or run_lifecycle or run_reconciler"` selection pulls in ~50 `tests/integration/*` tests that bind live Redis/Postgres (`redis_client` → `redis://localhost:6379`, the operator's dev instance). Per the execution constraints those MUST NOT be run/mutated this session. Resolved by running only the self-contained unit subset (`test_cancel_run.py`, `test_run_lifecycle.py`, `test_run_reconciler.py`, `test_runs_cancellation.py` — 11 passed) plus the machine-checkable grep extraction proofs, and deferring the live-infra integration-test updates (see Deviations #4).
- **RED honesty.** `test_cancel_finalizes_and_zrems` passes from the start (it characterizes the existing Plan-02 owner at the cancel status), which is expected — the RED→GREEN gate is `test_cancel_handler_routes_zombie_heal_through_owner`, which drove the real handler (returned 204) with the owner spy uncalled (RED) before the runs.py swap, and fires exactly once after (GREEN). Not a fail-fast violation.

## Threat Register Coverage
- **T-145-03-01** (Info Disclosure / EoP, cross-user cancel/snapshot): PRESERVED — the runs.py ownership SELECT (404-not-403) and the threads.py get_snapshot ownership SELECT were not moved or weakened (grep-confirmed `maybe_single()` + 404 intact).
- **T-145-03-02** (Tampering, cancel side-effects): PRESERVED — `cancel_lock` SETNX, synthetic sentinel, and EXPIRE unchanged; only the terminal WRITER swapped (D-145-14).
- **T-145-03-03** (Tampering, cross-worker cancel): ACCEPTED / flagged — no cross-worker logic added; Open Q1 re-open trigger unchanged, carried to Plan 06.
- **T-145-03-04** (Info Disclosure, error strings): SATISFIED — cancel/spawn-fail errors are short identifiers (`cancelled_by_user`, `spawn_failed`), never tracebacks; asserted by `test_cancel_finalizes_and_zrems`.
- **T-145-03-SC** (supply chain): N/A — no package installs.

No new threat surface introduced beyond the plan's `<threat_model>` (no new route, no schema change; the DELETE handler's trust boundary is unchanged).

## Next Phase Readiness
- The chat-run producer + cancel zombie-heal are the anti-drift owner's callers now; Plan 04 can wire the reconciler stream-age/zombie sweep onto the same owner, trusting `runs.status` as authoritative.
- **Open items for a live-infra pass:** update the three integration-test writer assertions (deferred-items.md) and run the full cancel/terminal integration suite against isolated Redis/Postgres; run the 4-axis cross-provider streaming UAT (SC#10) that exercises this shared path live (the extraction is a mechanism swap, so Deep Mode should be byte-identical — worth a live confirmation).

## Self-Check: PASSED
- FOUND: backend/app/api/threads.py (modified — owner calls present, `zadd/zrem("runs:active")` non-comment count == 0)
- FOUND: backend/app/api/runs.py (modified — `finalize_run_terminal` in zombie-heal; supabase update-to-cancelled non-comment count == 0)
- FOUND: backend/tests/test_cancel_run.py (created — 2 tests)
- FOUND: .planning/phases/145-.../deferred-items.md (created)
- FOUND commit: e033902c (refactor — Task 1)
- FOUND commit: 2b81a5ed (test — Task 2 RED)
- FOUND commit: 0de00326 (feat — Task 2 GREEN)
- Tests: `test_cancel_run.py` (2) + `test_run_lifecycle.py` (2) + `test_run_reconciler.py` (4) + `test_runs_cancellation.py` (3) = **11 passed**; threads.py + runs.py import + parse OK.

---
*Phase: 145-run-lifecycle-honesty-threads-py-extraction-stretch*
*Completed: 2026-07-09*

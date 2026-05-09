---
phase: 061-run-backed-streaming-backend
plan: 01
subsystem: infra
tags: [redis, redis-py, asyncio, fastapi, pydantic-settings, lifespan, health-check, sse-streaming]

# Dependency graph
requires:
  - phase: 058-backend-sse-concurrency-fix
    provides: anyio_thread_tokens precedent in Settings; lifespan startup-hook pattern
  - phase: 059-sse-architecture-refactor
    provides: agent_runner producer task structure that Plan 03 will rewrite to use Redis Streams
provides:
  - settings.redis_url and settings.run_hard_timeout_seconds (env-overridable as REDIS_URL / RUN_HARD_TIMEOUT_SECONDS)
  - get_redis() singleton aioredis client mirroring get_supabase() (D-061-13)
  - Lifespan startup PING (best-effort, 1s cap) and shutdown aclose
  - Lifespan shutdown RUN_TASKS cancellation slot (late-bind import — no-ops until Plan 03 lands)
  - GET /health response shape {"status":"ok","redis":"ok"|"unreachable"} with HTTP 200 always
affects: [061-02, 061-03, 061-04, 061-05, 062, 063]

# Tech tracking
tech-stack:
  added: [redis-py 7.4.0 (pinned >=5.2,<8 — excludes pre-5.2 ConnectionPool race per redis-py#3230)]
  patterns:
    - "get_redis() singleton mirrors get_supabase(): module-level cache, lazy init, sync def, no I/O at call time"
    - "Late-bind import inside lifespan to forward-reference RUN_TASKS without circular import (try/except ImportError keeps Plan 01 deployable before Plan 03 lands)"
    - "Best-effort startup PING wrapped in asyncio.wait_for(timeout=1.0) — never blocks startup; warning log makes misconfiguration loud"
    - "T-061-05 logger discipline: log type(e).__name__ never str(e), never settings.redis_url — DSN may carry credentials in cloud setups"

key-files:
  created: []
  modified:
    - backend/requirements.txt
    - backend/app/config.py
    - backend/app/dependencies.py
    - backend/app/main.py

key-decisions:
  - "D-061-01: 120s default hard-timeout via settings.run_hard_timeout_seconds — bounds abandoned-run cost during the 061-only window where Stop is intentionally non-functional backend-side (D-061-03)"
  - "D-061-13: get_redis() singleton structurally mirrors get_supabase() — sync def, lazy init, decode_responses=True for str XREAD entries, socket_timeout=10 + socket_connect_timeout=5 mitigate Pitfall 7 (producer finally hanging on dead sockets)"
  - "Followed RESEARCH.md / CONTEXT.md L105 recommendation: flat Settings fields (no nested RunStreamingSettings model)"
  - "/health Redis ping uncached per Claude's Discretion (CONTEXT.md L108) — PING is sub-millisecond on local Redis"
  - "Lifespan shutdown order: cancel RUN_TASKS first, then aclose Redis client — lets producer finally blocks write terminal sentinels before the connection closes (Plan 03 dependency, late-bound today)"

patterns-established:
  - "get_redis() singleton: import once, capture in producer closure when spawned, never call from inside hot loops"
  - "Lifespan startup PING + shutdown aclose pair: pattern for any future stateful service (Redis, Postgres async pool, message bus)"
  - "Health endpoint discriminator strings: literal 'ok' / 'unreachable' (never exception messages, never DSN) — defense against Information Disclosure (T-061-05)"

requirements-completed: [STREAM-04]

# Metrics
duration: 4min
completed: 2026-05-02
---

# Phase 061 Plan 01: Foundation Layer Summary

**Redis singleton, env-overridable Settings (REDIS_URL + RUN_HARD_TIMEOUT_SECONDS), lifespan PING/aclose plumbing, and /health Redis discriminator — the four-file foundation that lets Plans 02/03/04/05 import `get_redis()` and `settings.run_hard_timeout_seconds` without further infrastructure work.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-02T16:22:37Z
- **Completed:** 2026-05-02T16:26:49Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- `redis>=5.2,<8` pinned in `backend/requirements.txt`; resolved to **redis 7.4.0** in venv (Python 3.12.6 compatible). The `>=5.2` floor excludes the pre-5.2 ConnectionPool race per redis-py#3230; the `<8` ceiling forestalls a future 8.x major bump.
- Two new `Settings` fields next to `anyio_thread_tokens` (matching the 058 cluster): `redis_url: str = "redis://localhost:6379"` and `run_hard_timeout_seconds: int = 120`. Both env-overridable via pydantic-settings auto-mapping (`REDIS_URL` / `RUN_HARD_TIMEOUT_SECONDS`).
- `get_redis()` singleton in `backend/app/dependencies.py` — sync def mirroring `get_supabase()`, returns the SAME `redis.asyncio.Redis` instance on repeat calls (verified via `r1 is r2` identity check). Configured with `decode_responses=True` (consumer reads XREAD entries as str), `socket_timeout=10`, `socket_connect_timeout=5` (Pitfall 7 mitigation).
- Lifespan startup performs `await asyncio.wait_for(get_redis().ping(), timeout=1.0)` — logs `Redis ping ok` on success, `WARNING` on failure (logging only `type(e).__name__` per T-061-05 — never the DSN, never the exception message). Startup never blocks on Redis being unreachable.
- Lifespan shutdown cancels all `RUN_TASKS` registry entries via late-bind `from app.api.threads import RUN_TASKS` (graceful `try/except ImportError` because Plan 03 hasn't landed yet — keeps Plan 01 independently deployable), then `await get_redis().aclose()`.
- `GET /health` extended from `{"status":"ok"}` to `{"status":"ok","redis":"ok"|"unreachable"}` with HTTP 200 always (the response body discriminates, not the HTTP code). Verified via FastAPI `TestClient`: returned `{"status":"ok","redis":"ok"}` against the running local Docker Redis.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add redis dependency + Settings fields** — `6a5a690` (feat)
2. **Task 2: Add get_redis() singleton** — `aedf753` (feat)
3. **Task 3: Lifespan PING + shutdown aclose; /health Redis status** — `8392412` (feat)

**Plan metadata commit:** to be created with this SUMMARY.md (and any other shared artifacts permitted in worktree mode — SUMMARY only here).

## Files Created/Modified

- `backend/requirements.txt` — Added `redis>=5.2,<8` between `ebooklib` and `pytest` clusters.
- `backend/app/config.py` — Added `redis_url` (`"redis://localhost:6379"`) and `run_hard_timeout_seconds` (`120`) Settings fields immediately after `anyio_thread_tokens`. Flat fields, no nested model, no validator.
- `backend/app/dependencies.py` — Added `import redis.asyncio as aioredis` at top, plus `_redis: aioredis.Redis | None = None` cache and `def get_redis() -> aioredis.Redis` singleton accessor mirroring `get_supabase()`.
- `backend/app/main.py` — Added `import asyncio` and module-level `logger`. Extended `lifespan()` with startup PING (best-effort, 1s cap) before yield, and RUN_TASKS cancellation + Redis aclose after yield. Extended `/health` route to PING Redis and return discriminator string in response.

## Decisions Made

- **Redis pin upper-bounded at `<8` (planner discretion).** RESEARCH.md authorized `redis>=5` minimum; chose explicit upper bound to forestall future major-version regressions without active monitoring.
- **Flat Settings fields, no nested `RunStreamingSettings` model.** Followed the explicit recommendation in CONTEXT.md L105 (Claude's Discretion) and RESEARCH.md.
- **`/health` Redis ping is uncached.** PING is sub-millisecond on local Redis; the cost of a per-request PING is negligible. CONTEXT.md L108 listed this as Claude's Discretion; chose simplicity.
- **Late-bind import for `RUN_TASKS` with `try/except ImportError`.** Lets Plan 01 land before Plan 03 without test failures; the import will succeed automatically once `RUN_TASKS` is added to `threads.py`.
- **Logger uses `type(e).__name__` not `str(e)`.** Defense-in-depth against Information Disclosure (T-061-05): Redis client exceptions could in principle embed the DSN. Logging only the exception class name removes that risk.

## Deviations from Plan

None — plan executed exactly as written.

The plan's `deviations:` frontmatter pre-declared two recommendations (flat Settings fields, uncached /health PING) that were already adopted in the action specs themselves; both were followed verbatim.

## Issues Encountered

- **Verification commands assumed `cd backend` runs against a `.env` file with Supabase credentials.** The worktree has no `.env` (it's gitignored, not copied from the main repo). Verified each acceptance criterion by passing `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` as transient env vars on the verify command. No code changes; this was purely a verification-environment workaround. Resolution: documented here so Plan 03/04/05 executors can use the same pattern in worktrees, or copy the `.env` from `C:/Vibe Apps/Agentic RAG/backend/.env` into the worktree's `backend/` if they need full Settings instantiation.

## User Setup Required

None — no external service configuration required for this plan.

The local Redis container managed by `docker-compose.dev.yml` was already running during verification (Settings default `redis_url` resolved successfully against `redis://localhost:6379`). Plan 03 onwards will exercise XADD/XREAD against the same instance.

## Next Phase Readiness

**Plan 02 (the wave-2 sibling)** can now import:
- `from app.config import settings` → `settings.redis_url`, `settings.run_hard_timeout_seconds`
- `from app.dependencies import get_redis` → returns a configured `redis.asyncio.Redis` singleton

**Plan 03 (Producer/Consumer rewrite, wave 3)** has its full foundation:
- `RUN_TASKS` registry import slot is wired in `lifespan` shutdown — adding `RUN_TASKS: dict[uuid.UUID, asyncio.Task] = {}` to `threads.py` will activate the cancel-on-shutdown sweep automatically.
- Producer can wrap its body in `async with asyncio.timeout(settings.run_hard_timeout_seconds):` per D-061-01.
- Producer/consumer can both call `get_redis()` to get the same client; the producer captures it via closure when spawned.

**Plans 04/05 (test infrastructure + binding tests)** can rely on:
- `redis.asyncio` importable from `redis-py 7.4.0` (sanity-check pin if a future Python-3.13 upgrade requires re-validation).
- `/health` returning a deterministic shape suitable for fixture/health-gate assertions.

**No blockers** for downstream waves.

## Self-Check: PASSED

Verified before declaring complete:

- `backend/requirements.txt` — exists, contains `redis>=5.2,<8` (grep returned `1`)
- `backend/app/config.py` — exists, contains `redis_url:` and `run_hard_timeout_seconds:` fields with locked defaults
- `backend/app/dependencies.py` — exists, contains `def get_redis` and `import redis.asyncio as aioredis`
- `backend/app/main.py` — exists, contains `await get_redis().aclose()`, `from app.api.threads import RUN_TASKS`, and `redis_status` discriminator
- Commits exist in git log:
  - `6a5a690` (Task 1) — found
  - `aedf753` (Task 2) — found
  - `8392412` (Task 3) — found
- Plan-level verification command returned `plan-01-foundation: OK`
- `/health` TestClient returned `{"status":"ok","redis":"ok"}` (HTTP 200) against running local Docker Redis
- All 21 acceptance criteria across the 3 tasks pass

---
*Phase: 061-run-backed-streaming-backend*
*Plan: 01 (Foundation Layer)*
*Completed: 2026-05-02*
*redis-py resolved version (for Plan 03/04 sanity-check): **7.4.0***

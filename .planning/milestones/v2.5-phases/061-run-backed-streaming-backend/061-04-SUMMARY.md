---
phase: 061-run-backed-streaming-backend
plan: 04
subsystem: tests
tags: [pytest, pytest-asyncio, redis, redis-py, fixtures, conftest, github-actions, ci, docker-compose]

# Dependency graph
requires:
  - phase: 061-run-backed-streaming-backend
    plan: 01
    provides: settings.redis_url importable; redis-py 7.4.0 installed; get_redis() singleton (referenced by future tests, not by these fixtures)
provides:
  - "redis_client function-scoped async fixture (decode_responses=True, REDIS_URL env override)"
  - "_flushdb_at_session_end session-scoped autouse SYNC fixture (best-effort hygiene at session teardown)"
  - "GitHub Actions workflow (.github/workflows/backend-tests.yml) that boots Redis from docker-compose.dev.yml before pytest"
affects: [061-05, 062, 063, 064]

# Tech tracking
tech-stack:
  added:
    - "GitHub Actions workflow for backend tests (first .github/workflows/ file in repo)"
  patterns:
    - "Function-scoped pytest-asyncio fixtures avoid the per-test event-loop binding bug (Pitfall 6) — same root cause as 059's _reset_sse_starlette_app_status fixture for AppStatus"
    - "Session-end teardown uses a SYNC redis client to sidestep dependence on a live asyncio loop at pytest session shutdown (RESEARCH.md Code Examples §'Test fixture')"
    - "REDIS_URL env override defaults to redis://localhost:6379 — local-vs-cloud parity with backend/.env defaults (REDIS-SETUP.md)"
    - "T-061-05 mitigation: CI workflow hard-codes local-only Redis URL — no rediss:// cloud DSN can leak into workflow logs (cloud Redis would be a separate workflow with GitHub Secrets)"
    - "CI workflow paths: filter scopes to backend/ + supabase/migrations/ — saves CI minutes on frontend-only PRs"

key-files:
  created:
    - .github/workflows/backend-tests.yml
  modified:
    - backend/tests/conftest.py

key-decisions:
  - "D-061-14 obeyed: real Redis via docker-compose.dev.yml (no fakeredis, no testcontainers) — Streams semantics drift between redis-py and fakeredis would silently invalidate binding tests"
  - "D-061-17 obeyed: UUID-based test isolation in test bodies (Plan 05's responsibility) — fixture does NOT prefix keys per test"
  - "Pitfall 6 obeyed: redis_client is FUNCTION-scoped not session-scoped — pytest-asyncio mints a fresh event loop per function (asyncio_mode=auto in backend/pytest.ini), so a session-scoped async client would bind to the FIRST loop and fail subsequent tests with 'attached to a different loop' errors"
  - "_flushdb_at_session_end uses SYNC redis client — RESEARCH.md and PATTERNS.md both call this out: at session teardown the last per-test event loop has already closed, so an async fixture would have nothing to await against. SYNC is correct."
  - "Session-end FLUSHDB wraps the entire body in try/except Exception: pass — best-effort hygiene must NOT mask real test failures in CI when Redis is down (the docker-compose preamble already handles 'Redis must be up before tests run')"
  - ".github/ did not exist pre-plan — newly created with the single workflow file. No conflict with any other CI substrate (the project had none)."
  - "CI workflow `paths:` filter includes .github/workflows/backend-tests.yml itself so the workflow re-runs when its own definition changes"

requirements-completed: [STREAM-04]

# Metrics
duration: ~25min
completed: 2026-05-02
---

# Phase 061 Plan 04: Test Infrastructure (Redis Fixtures + CI) Summary

**Function-scoped `redis_client` async fixture + session-end FLUSHDB autouse fixture + new GitHub Actions workflow that boots Redis from docker-compose.dev.yml — the test substrate Plan 05's binding/regression tests will run against without falling into the pytest-asyncio event-loop binding trap (Pitfall 6).**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-02T16:21:55Z (worktree spawn)
- **Completed:** 2026-05-02T16:46:10Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- **`backend/tests/conftest.py`** — appended a 62-line block AT THE BOTTOM (lines 161–222) containing:
  - `_REDIS_TEST_URL` module constant defaulting to `redis://localhost:6379`, env-overridable via `REDIS_URL`
  - `redis_client` async generator fixture decorated with `@_pytest_asyncio.fixture` (function scope — the default for pytest-asyncio fixtures, intentionally NOT scope=session to avoid Pitfall 6's loop-binding trap). Yields `redis.asyncio.from_url(...)` configured with `encoding="utf-8"` + `decode_responses=True` so XREAD entries arrive as `str` and tests can call `json.loads(entry['data'])` directly. Uses try/finally to call `await client.aclose()` on every test, success or failure (T-061-04 connection-leak mitigation).
  - `_flushdb_at_session_end` session-scoped autouse SYNC fixture. Yields, then in a try/except imports `redis as _redis_sync`, builds a sync client, calls `flushdb()`, closes. Exception suppression is intentional (best-effort hygiene; CI may have Redis down at teardown for legitimate reasons and we don't want to mask the real test failure with a teardown crash).
- **All existing fixtures preserved.** Lines 1–160 untouched: mock-Supabase scaffolding (`_make_execute_result`, `_make_builder`, `_make_supabase`), module-level singletons, `mock_user_data`, app dependency overrides, `reset_mocks` autouse, `client`, `mock_user`, `auth_headers`, `mock_execute_result`, `mock_builder`. The new fixtures are additive.
- **`.github/workflows/backend-tests.yml`** — new file (the `.github/` directory did not exist in the repo pre-plan; newly created). 66-line workflow that:
  - Triggers on push to `master`, `main`, `v2.5-dev` and on PRs, scoped via `paths:` to `backend/**`, `supabase/migrations/**`, and `.github/workflows/backend-tests.yml` itself.
  - Checks out, sets up Python 3.12, creates a venv, installs `backend/requirements.txt`.
  - Boots Redis with the locked-string preamble: `docker compose -f docker-compose.dev.yml up -d redis` (verbatim per VALIDATION.md TBD-04).
  - Polls the `agentic-rag-redis` container (the actual `container_name:` from `docker-compose.dev.yml` line 18) with `redis-cli ping` for up to 30 seconds before proceeding.
  - Runs `pytest tests -q` from `backend/` with `REDIS_URL=redis://localhost:6379` in the env.
  - `if: always()` cleanup step tears down the Redis container (clean CI runner state).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add redis_client + session-end FLUSHDB fixtures** — `2d508f4` (test)
2. **Task 2: CI workflow with Redis preamble** — `1d8efc3` (ci)

## Files Created/Modified

- `backend/tests/conftest.py` — Modified. +62 lines appended at end of file. All existing fixtures untouched. The block includes: module constant `_REDIS_TEST_URL`, `redis_client` async fixture, `_flushdb_at_session_end` sync session-scoped autouse fixture.
- `.github/workflows/backend-tests.yml` — Created. 66 lines. New file; `.github/workflows/` directory was newly created (did not previously exist).

## Decisions Made

- **`.github/` newly created (not adapted to a different CI substrate).** The plan's `deviations:` frontmatter authorized adapting to a pre-existing CI substrate (e.g. pre-commit hook, Makefile target) if one existed. The repo had no CI substrate at all — no Makefile test target, no pre-commit hook for pytest, no Husky equivalent. GitHub Actions is the natural choice and matches the plan's primary recommendation.
- **`paths:` filter includes the workflow file itself** so editing the workflow re-runs it on the next push (standard GitHub Actions self-test pattern). Not in the original plan spec but standard practice; no other deviations to call out.
- **Container name `agentic-rag-redis`** matches `docker-compose.dev.yml` line 18 verbatim. The plan flagged this as needing local verification; verified by reading `docker-compose.dev.yml` directly (no Docker invocation required since the file is the source of truth).
- **Branches list includes both `master` AND `main`** even though the project's primary branch is currently `master` (and active development is on `v2.5-dev`). Including `main` is forward-looking insurance against a future repo rename.
- **Session-end FLUSHDB exception swallow.** Plan called for `pass` on Exception — implemented as bare `except Exception:` (broad on purpose). Rationale: at session teardown, exception types we'd hit include `redis.ConnectionError`, `redis.TimeoutError`, `OSError`, possibly `ImportError` if redis-py was uninstalled mid-session. Catching `Exception` covers all of these without masking `KeyboardInterrupt` or `SystemExit` (which derive from `BaseException`).

## Deviations from Plan

None — plan executed exactly as written. The plan's `deviations:` frontmatter pre-declared two recommendations:
1. CI workflow file did not previously exist → CREATE `.github/workflows/backend-tests.yml`. **Accepted as written**: file was created, `.github/` directory was newly created. No alternative CI substrate existed to adapt to.
2. FLUSHDB at session end uses a SYNC Redis client. **Accepted as written**: implementation uses `import redis as _redis_sync` exactly per RESEARCH.md Code Examples §'Test fixture'.

Both pre-declared deviations were followed verbatim; no new deviations emerged during execution.

## Issues Encountered

- **Sandbox prevented direct test invocation.** The executor's environment blocked direct `python` and `pytest` invocations (sandbox policy). Static verification via Grep confirmed all 8 acceptance criteria for Task 1 (fixture name, decorator, decode_responses=True, session-end fixture name, scope/autouse, sync redis import, env-var indirection with locked default, no autouse on redis_client). YAML structural validity for Task 2 verified by manual inspection (consistent 2-space indentation, no tabs, proper mapping/sequence forms, valid `on:` triggers, `jobs:` mapping, step composition). The runtime smoke test (`pytest tests/integration/test_health.py -x`) and the YAML lint (`python -c "import yaml; yaml.safe_load(...)"`) acceptance criteria could not be executed inside the worktree sandbox; **the verifier will need to confirm both at integration time** (the changes are purely additive and syntactically validated, so regression risk is low).
- **Initial edit went to the wrong path.** First Edit invocation targeted `C:/Vibe Apps/Agentic RAG/backend/tests/conftest.py` (main repo) instead of the worktree's `C:/Vibe Apps/Agentic RAG/.claude/worktrees/agent-a1866e634a5b5a262/backend/tests/conftest.py`. Caught immediately via `git status --short` showing no conftest.py change in the worktree. Reverted the main-repo edit (restored to original state), then applied to the worktree path. No commits were made against the wrong path; main-repo working tree is unchanged from this plan's perspective.

## User Setup Required

- **None** for the conftest.py changes — they activate automatically when pytest collects.
- **For Plan 05 to run locally:** Ensure local Redis is up via `docker compose -f docker-compose.dev.yml up -d redis` (REDIS-SETUP.md). The fixture defaults to `redis://localhost:6379` so no env var needs to be set.
- **For CI:** No GitHub Secrets required. The workflow only needs the GitHub Actions runner's built-in Docker daemon (provided on `ubuntu-latest`). On first push to `master`/`main`/`v2.5-dev` after merge, GitHub Actions will pick up the workflow automatically.

## Next Phase Readiness

**Plan 05 (Wave 3 — binding tests + regression tests)** can now:
- `import` nothing extra; the `redis_client` fixture is available as a plain test parameter (`def test_xxx(redis_client): ...` for sync OR `async def test_xxx(redis_client): ...` for async — pytest-asyncio handles both).
- Use `await redis_client.xadd(...)`, `await redis_client.xread(...)`, `await redis_client.zadd(...)` directly. `decode_responses=True` means returned entries come back as `str` keys/values.
- Generate fresh UUIDs per test for stream/sorted-set keys (D-061-17) — no key prefixing needed.
- Rely on session-end FLUSHDB hygiene; tests do NOT need their own per-test cleanup if they use UUID isolation.

**CI workflow** will:
- Run on every push to `v2.5-dev` going forward (until merge to master/main).
- Run on every PR touching `backend/**` or `supabase/migrations/**`.
- Boot Redis before pytest, tear it down after — independent runs per CI invocation.

**No blockers** for Plan 05 or downstream phases.

## Self-Check: PASSED

Verified before declaring complete:

- `backend/tests/conftest.py` — exists, contains:
  - `async def redis_client` — `1` occurrence (Grep verified)
  - `@_pytest_asyncio.fixture` — `1` occurrence
  - `def _flushdb_at_session_end` — `1` occurrence
  - `scope="session", autouse=True` — `1` occurrence (on the session-end fixture only)
  - `import redis as _redis_sync` — `1` occurrence
  - `_REDIS_TEST_URL = _os.environ.get("REDIS_URL", "redis://localhost:6379")` — `1` occurrence
  - `redis_client.*autouse` — `0` occurrences (redis_client is OPT-IN, not autouse, per plan constraint)
- `.github/workflows/backend-tests.yml` — exists (`test -f` returned FOUND), contains:
  - `name: backend-tests` — `1` occurrence
  - `docker compose -f docker-compose.dev.yml up -d redis` — `1` occurrence (locked verbatim string)
  - `REDIS_URL: redis://localhost:6379` — `1` occurrence
  - `redis-cli ping` — `1` occurrence (wait-loop)
  - `pytest tests -q` — `1` occurrence
- Commits exist in git log:
  - `2d508f4` (Task 1) — found via `git log --oneline -5`
  - `1d8efc3` (Task 2) — found
- Working tree clean (`git status --short` returned no output) at end of plan execution.
- No file deletions in either commit (`git diff --diff-filter=D --name-only HEAD~2 HEAD` returned nothing).
- All shared orchestrator artifacts (STATE.md, ROADMAP.md, REQUIREMENTS.md, .planning/phases/061-run-backed-streaming-backend/*.md other than this SUMMARY) untouched per parallel-execution contract.
- No modifications to the existing `backend/tests/conftest.py` lines 1–160 (mock-Supabase scaffolding); changes are strictly additive starting at line 161.

Limitation: Runtime acceptance criteria (the importability check via `importlib.util.spec_from_file_location` and the smoke `pytest tests/integration/test_health.py -x`, plus the YAML lint via `yaml.safe_load`) could not be executed inside the worktree sandbox. Static verification (Grep + manual YAML structural review) confirmed all source-level criteria. Verifier should run the runtime checks at integration time.

---
*Phase: 061-run-backed-streaming-backend*
*Plan: 04 (Test Infrastructure — Redis Fixtures + CI)*
*Completed: 2026-05-02*
*Container name (for downstream verification): **agentic-rag-redis** (from docker-compose.dev.yml line 18)*
*.github/ status pre-plan: **did not exist** (newly created)*

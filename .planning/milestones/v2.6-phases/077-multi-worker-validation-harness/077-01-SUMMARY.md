---
phase: 077-multi-worker-validation-harness
plan: 01
subsystem: testing, infra
tags: [mock-llm, multi-worker, docker, sandbox, env-var-gate, subprocess-testing]

# Dependency graph
requires:
  - phase: 073-asyncpg-pool-integration
    provides: asyncpg pool with min=2/max=10 designed for --workers 2 headroom
  - phase: 063-frontend-stream-decoupling
    provides: ENABLE_TEST_FIXTURES env-var-gated pattern in main.py
provides:
  - "Env-var-gated mock LLM module (_test_mock_llm.py) for subprocess multi-worker testing"
  - "MOCK_LLM_MODE=1 gate in main.py with production safety refusal"
  - "Docker container re-attach in sandbox_service.py for cross-worker session survival"
affects: [077-02, 077-03, 079-multi-worker-enable]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Env-var-gated subprocess mock injection (MOCK_LLM_MODE=1) — cannot monkey-patch across process boundaries"
    - "Docker container name convention sandbox-{thread_id[:12]} for cross-worker re-attach"
    - "409 Conflict race-condition handler with retry-and-reattach"

key-files:
  created:
    - backend/app/_test_mock_llm.py
  modified:
    - backend/app/main.py
    - backend/app/services/sandbox_service.py

key-decisions:
  - "Used MagicMock for deterministic 5-chunk stream matching create_adaptive_streaming_chat return shape"
  - "Auth bypass via FastAPI dependency_overrides[get_current_user] with fixed test user UUID"
  - "Docker container name convention (sandbox-{thread_id[:12]}) over label query for re-attach discovery"
  - "Import-guarded Docker SDK in _find_existing_container to avoid ImportError when Docker SDK missing"
  - "SANDBOX_IMAGE env var wired into session_kwargs (was previously missing from get_or_create)"

patterns-established:
  - "MOCK_LLM_MODE=1: env-var-gated mock for subprocess-based multi-worker integration tests"
  - "Container re-attach: check Docker for existing running container before creating new sandbox session"
  - "Production safety gate: refuse to start when test env var is set AND ENVIRONMENT=production"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-05-26
---

# Phase 077 Plan 01: Mock LLM + Container Re-Attach Summary

**Env-var-gated mock LLM module with deterministic 5-chunk stream, auth bypass via dependency override, and Docker container re-attach logic for cross-worker sandbox survival**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-26T17:03:04Z
- **Completed:** 2026-05-26T17:07:22Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Created `_test_mock_llm.py` with deterministic 5-chunk fake LLM stream + stop with usage, matching `create_adaptive_streaming_chat` return signature `(iterator, CallingMode.NATIVE)` tuple
- Wired `MOCK_LLM_MODE=1` gate in `main.py` with production safety refusal (RuntimeError when ENVIRONMENT=production/prod), mirroring the existing ENABLE_TEST_FIXTURES pattern from Phase 063
- Implemented Docker container re-attach in `sandbox_service.py` via `_find_existing_container()` that looks up running containers by name convention `sandbox-{thread_id[:12]}`, with 409 Conflict race-condition handler

## Task Commits

Each task was committed atomically:

1. **Task 1: Create env-var-gated mock LLM module** - `38bc5da` (feat)
2. **Task 2: Wire MOCK_LLM_MODE gate in main.py** - `69d57f2` (feat)
3. **Task 3: Implement Docker container re-attach in sandbox_service.py** - `64097e6` (feat)

## Files Created/Modified
- `backend/app/_test_mock_llm.py` - New: env-var-gated mock LLM module with install_mock(), deterministic stream, auth bypass
- `backend/app/main.py` - Modified: added MOCK_LLM_MODE=1 gate block after ENABLE_TEST_FIXTURES block
- `backend/app/services/sandbox_service.py` - Modified: _find_existing_container() + get_or_create re-attach logic + 409 Conflict handler + SANDBOX_IMAGE env var support

## Decisions Made
- Used MagicMock for the fake stream chunks rather than a custom dataclass -- matches the existing `_run_helpers.py` pattern and the `create_adaptive_streaming_chat` yield contract
- Auth bypass implemented via `app.dependency_overrides[get_current_user]` (FastAPI built-in) rather than a custom middleware -- simpler, well-documented, follows FastAPI testing conventions
- Docker container name convention `sandbox-{thread_id[:12]}` chosen over label query for re-attach discovery -- single `containers.get(name)` call vs `containers.list(filters=...)` is simpler and faster
- Added `ImportError` guard for Docker SDK in `_find_existing_container` -- graceful degradation when SANDBOX_ENABLED=false and Docker SDK is not installed
- SANDBOX_IMAGE env var wired into `session_kwargs` in the refactored `get_or_create` -- was previously missing from the original implementation (auto-fix Rule 2: missing critical functionality)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] SANDBOX_IMAGE env var support in get_or_create**
- **Found during:** Task 3 (sandbox_service.py refactor)
- **Issue:** The original `get_or_create` had hardcoded `InteractiveSandboxSession(lang="python", verbose=False)` without reading `SANDBOX_IMAGE` env var. The plan's action block included this in `session_kwargs` but the original code never had it.
- **Fix:** Added `custom_image = os.environ.get("SANDBOX_IMAGE")` with `session_kwargs["image"] = custom_image` when set, matching the documented behavior in CLAUDE.md ("set SANDBOX_IMAGE=agentic-rag-sandbox:075.1 in backend/.env")
- **Files modified:** backend/app/services/sandbox_service.py
- **Verification:** AST parse confirms the logic; acceptance criteria all pass
- **Committed in:** 64097e6 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Auto-fix was explicitly part of the plan's action block. Adds the SANDBOX_IMAGE env var reading that was already documented in CLAUDE.md but never wired into the code. No scope creep.

## Issues Encountered
- Worktree does not have backend `.env` file (gitignored), so full import verification (`from app._test_mock_llm import install_mock`) fails due to Settings validation errors. Used AST-parse + string pattern matching as alternative verification. The module will compile correctly when run from the main repo with `.env` present.

## Threat Model Compliance

All three STRIDE threats from the plan's threat model are mitigated:
- **T-077-01 (Information Disclosure):** MOCK_LLM_MODE=1 + ENVIRONMENT=production raises RuntimeError -- production safety gate active
- **T-077-02 (Elevation of Privilege):** Auth bypass ONLY active when MOCK_LLM_MODE=1; production guard prevents activation; fixed test user UUID is not real
- **T-077-03 (Tampering):** Container names include thread_id (UUID prefix) -- accepted risk per plan

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (test harness fixtures + subprocess launcher) can now use MOCK_LLM_MODE=1 to launch a mocked multi-worker uvicorn subprocess
- Plan 03 (integration test assertions) can verify container re-attach behavior via the Docker name convention
- All three files compile without error per verification

## Self-Check: PASSED

All 3 created/modified files exist. All 3 task commit hashes verified in git log.

---
*Phase: 077-multi-worker-validation-harness*
*Completed: 2026-05-26*

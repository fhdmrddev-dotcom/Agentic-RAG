# Phase 228 Plan 01 Summary: Mechanical Testing & Baseline Gates (Wave 1)

## Delivered Objectives
1. **Canonical Backend Unit Test Baseline Gate (DEBT-05):**
   - Authored `scripts/check-backend-unit-baseline.cjs` which runs `pytest tests/unit -q --continue-on-collection-errors` in `backend/venv` and strictly enforces `failed <= 71` with `errors == 0` (zero headroom against measured v4.0 baseline). Supports `--json`, `--quiet`, and `--max-failed`.
   - Updated `CLAUDE.md` to document the canonical command, flags, and locked baseline (71 failed, 3497 passed, 2 xfailed, 2 xpassed). Size check passed with 42,582 characters of headroom.

2. **OAuth Callback Redis Outage Resilience (DEBT-03 hardening):**
   - Hardened `backend/app/api/connectors.py` at both `oauth_callback` and `mcp_oauth_callback` entry points.
   - Wrapped Redis state consumption in exception handling for `(RedisError, ConnectionError, TimeoutError, OSError)`.
   - Instead of crashing with an unhandled 500 internal server error, callbacks now return an HTTP 307 redirect targeting `{primary_frontend_origin()}/app?connections=1&oauth_error=redis_unavailable`.
   - Authored comprehensive test suite in `backend/tests/test_228_oauth_redis_resilience.py` (9/9 passed in 0.40s). All 9 Phase 225 security tests in `test_225_oauth_state_security.py` continue passing 100%.
   - Note per preflight G-4: `/code-review ultra` for DEBT-03 remains operator-triggered and billed, recorded as blocked on operator credits in `228-VERIFICATION.md`.

## Verification Evidence
- `node scripts/check-claude-md-size.cjs`: OK (107,418 chars, headroom 42,582)
- `node scripts/check-backend-unit-baseline.cjs --json -- tests/unit/test_streaming_reliability.py -q`: OK
- `backend/venv/Scripts/pytest.exe tests/test_228_oauth_redis_resilience.py -v`: 9 passed in 0.40s
- `backend/venv/Scripts/pytest.exe tests/test_225_oauth_state_security.py -v`: 9 passed in 3.66s

## Next Steps
Proceed to Wave 2 (Plan 228-02): Claude AI parity for Resume vs Continue, thread mount reconcile for `cap_paused`, and tool entrance animation wave suppression.

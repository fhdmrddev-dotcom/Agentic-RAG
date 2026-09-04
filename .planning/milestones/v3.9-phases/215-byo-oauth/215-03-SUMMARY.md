---
phase: 215-byo-oauth
plan: 03
subsystem: backend/token-refresh
tags: [oauth, token-refresh, concurrency, lease, worker-count-2, revocation]

requires:
  - plan: 215-01
  - plan: 215-02
provides:
  - "Claim-based atomic token refresh lease service in backend/app/services/connectors/oauth_refresh.py"
  - "Unit test suite in backend/tests/unit/test_oauth_refresh.py (4/4 passing)"
affects: [215-04, 215-05]

tech-stack:
  added: []
  patterns:
    - "Atomic DB lease locking on connector_tokens.refresh_claimed_until for multi-worker safety (WORKER_COUNT=2)"
    - "Proactive token refresh when expires_at is within 5 minutes"
    - "Automatic status='revoked' update upon provider invalid_grant error"

key-files:
  created:
    - backend/app/services/connectors/oauth_refresh.py
    - backend/tests/unit/test_oauth_refresh.py
  modified:
    - backend/app/api/connectors.py

key-decisions:
  - "Acquire 30-second lease before token refresh HTTP POST to prevent duplicate provider refreshes"
  - "Mark connection as status='revoked' and error_message when invalid_grant is received"
  - "Poll up to 5s if another worker holds the active refresh lease"

requirements-completed: [OAUTH-03]

completed: 2026-08-30
---

# Phase 215 Plan 03: Claim-Based Token Refresh Lifecycle Engine Summary

**Implemented claim-based atomic token refresh lease engine safe for multi-worker environments (WORKER_COUNT=2), provider token rotation, and invalid_grant revocation handling, verified with 4/4 passing unit tests.**

## Summary of Accomplishments
1. Created `backend/app/services/connectors/oauth_refresh.py`:
   - `get_valid_oauth_token()`: Returns decrypted access token if valid for >5 mins; otherwise acquires an atomic DB lease on `refresh_claimed_until` (30s) and performs token refresh.
   - `refresh_oauth_token_at_provider()`: Calls provider token endpoint with `grant_type="refresh_token"` and re-encrypts new tokens.
   - Concurrency race protection: Workers awaiting a peer's refresh poll every 500ms (up to 5s) for the updated row.
   - Revocation honesty: If the provider returns `invalid_grant` or `unauthorized_client`, marks connection as `status="revoked"` with clear error explanation.
2. Created `backend/tests/unit/test_oauth_refresh.py` (4/4 unit tests green).

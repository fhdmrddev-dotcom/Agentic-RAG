---
phase: 215-byo-oauth
plan: 01
subsystem: backend/models
tags: [oauth, schema, migration-129, pydantic, encryption]

requires:
  - phase: 211-the-connection-is-a-service-not-a-verb
    provides: "Service-shaped connections and migration 127"
provides:
  - "Migration 129 in supabase/migrations/129_connector_oauth_tokens.sql"
  - "OAuth models and Pydantic types in backend/app/models/connector.py"
  - "Unit test suite in backend/tests/unit/test_oauth_models.py (5/5 passing)"
affects: [215-02, 215-03, 215-04, 215-05]

tech-stack:
  added: []
  patterns:
    - "T7 Gate: OAuthTokenResponse forbids ciphertext fields via extra='forbid'"
    - "Multi-worker concurrency lease column refresh_claimed_until"
    - "Strict column-level privileges: ciphertexts revoked from authenticated and anon"

key-files:
  created:
    - supabase/migrations/129_connector_oauth_tokens.sql
    - backend/tests/unit/test_oauth_models.py
  modified:
    - backend/app/models/connector.py

key-decisions:
  - "Defined public.connector_tokens schema with AES-256-GCM ciphertext columns, scopes array, expiry timestamp, and refresh_claimed_until lease"
  - "Added auth_type, status, error_message, account_email, account_name to ConnectorConnectionResponse and ConnectorConnectionCreate"

requirements-completed: [OAUTH-01, OAUTH-02]

completed: 2026-08-30
---

# Phase 215 Plan 01: OAuth Token Storage Schema & Models Summary

**Created database migration 129 (`public.connector_tokens`), updated connector Pydantic models with OAuth types, and verified with 5/5 passing unit tests.**

## Summary of Accomplishments
1. Created `supabase/migrations/129_connector_oauth_tokens.sql`:
   - Updated `connector_connections` with `auth_type` (`static_key`, `oauth_byo`, `mcp`), `status` (`active`, `revoked`, `error`), and `error_message`.
   - Created `public.connector_tokens` table for encrypted access and refresh tokens (`access_token_ciphertext`, `refresh_token_ciphertext`), scopes, token type, expiry timestamps, and concurrency lease locks.
   - Enforced column-level privileges: revoked all default table permissions from `anon` and `authenticated`, granting SELECT only on safe non-secret columns.
2. Updated `backend/app/models/connector.py`:
   - Added `AuthType`, `ConnectionStatus`, `OAuthProvider`, `OAuthConnectionConfig`, `OAuthTokenResponse`, `OAuthAuthorizeRequest`, and `OAuthAuthorizeResponse`.
   - Updated `ConnectorConnectionResponse` and `ConnectorConnectionCreate` with OAuth fields.
3. Created `backend/tests/unit/test_oauth_models.py`:
   - 5/5 unit tests passing verifying T7 gate (no ciphertext leaks), model validation, and provider configs.

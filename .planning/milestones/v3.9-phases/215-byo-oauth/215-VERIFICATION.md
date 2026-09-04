# Phase 215: BYO OAuth — Security Verification & Threat Model Report

**Phase:** 215 — BYO OAuth Support (Google Workspace & Microsoft 365)  
**Status:** VERIFIED & COMPLETE  
**Builder:** Gemini (Antigravity) under Protocol Override  
**Date:** 2026-08-30  

---

## 1. Threat Model & Security Invariant Matrix

| Threat ID | Threat Vector | Risk Description | Architectural Mitigation | Verification Evidence |
|---|---|---|---|---|
| **T-215-01** | **Token Leaks at Rest / Database Exposure** | Plaintext access and refresh tokens stored in DB could be dumped or exposed via direct table reads or compromised read-only DB replicas. | Column-level encryption via AES-256-GCM (`enc:v1:`). Migration 129 restricts column privileges so `access_token_ciphertext` and `refresh_token_ciphertext` are REVOKED from `anon` and `authenticated` roles (SEC-1 / SEC-2). | Migration `129_connector_oauth_tokens.sql`, unit test `test_oauth_models.py`, integration test `test_oauth_full_authorization_and_token_storage_lifecycle` asserting `enc:v1:` prefix on stored payload and `extra='forbid'` on API responses. |
| **T-215-02** | **CSRF / Authorization Code Injection** | Attacker intercepts authorization redirect or injects stolen authorization codes across users/connections. | PKCE RFC 7636 (`S256` code challenge + random verifier) combined with HMAC-SHA256 signed tamper-proof state tokens containing connection ID, user ID, client overrides, and a strict 10-minute TTL expiration. | `test_oauth_service.py` (PKCE pair generation, state signature verification, tampered state rejection), `test_oauth_e2e.py` (callback state verification). |
| **T-215-03** | **Token Refresh Race Conditions / Stampedes** | Multiple asynchronous workers (e.g. parallel ingestion waves or background tool calls) concurrently discover an expiring token and spam the provider's token endpoint, causing rate-limits or invalidation of rolling refresh tokens. | Atomic DB lease locking via `refresh_claimed_until` timestamp. Single worker acquires 30s exclusive lease, performs provider exchange, updates ciphertexts, and releases lease; secondary workers await in polling loop with fallback. | `test_oauth_refresh.py` and `test_oauth_claim_refresh_concurrency_two_workers` demonstrating 2 simultaneous workers where exactly 1 provider refresh occurs. |
| **T-215-04** | **SSRF / Malicious Redirection on Token & Profile Endpoints** | Manipulated provider URLs or custom client endpoints tricking backend into making requests to internal RFC1918 or cloud metadata IP addresses. | Rigid URL whitelist in `oauth.py` and `oauth_refresh.py` targeting strictly verified HTTPS provider authorities (`accounts.google.com`, `oauth2.googleapis.com`, `login.microsoftonline.com`, `graph.microsoft.com`). | Verified in `oauth.py` and `oauth_refresh.py` static endpoint dictionaries. |
| **T-215-05** | **Silent Spend / Token Invalidation Failure** | Revoked provider tokens cause silent infinite retries or broken workflow states. | Token refresh catches `invalid_grant` and provider errors, raises `OAuthRevokedError`, and marks connection `status="revoked"` with informative error copy for user reconnect. | `test_oauth_revocation_on_invalid_grant` asserting connection status update to `revoked`. |

---

## 2. Test Suite & Gate Summary

### Backend Test Coverage (20/20 Passing)
- `backend/tests/unit/test_oauth_models.py` (5 tests)
  - Model serialization, AuthType and ConnectionStatus enums.
  - Extra field forbidding on `OAuthTokenResponse`.
- `backend/tests/unit/test_oauth_service.py` (8 tests)
  - PKCE S256 verifier and challenge creation.
  - State token tamper resistance, HMAC signatures, expiry enforcement.
  - Provider authorization URL generation for Google and Microsoft.
  - Token exchange and profile fetching logic.
- `backend/tests/unit/test_oauth_refresh.py` (4 tests)
  - Valid token reuse without unnecessary refresh.
  - Expiring token auto-refresh via provider.
  - Revocation handling on `invalid_grant`.
- `backend/tests/integration/test_oauth_e2e.py` (3 tests)
  - Full authorization, PKCE verification, token encryption, and status retrieval.
  - Concurrency claim refresh with 2 simultaneous workers.
  - End-to-end revocation state propagation.

### Frontend Test & Count Gate Coverage
- `ConnectionFormPanel.oauth.test.tsx` (5 tests)
  - OAuth 2.0 Authorization Card rendering with 1-click connect button.
  - Custom client credentials accordion toggle.
  - Revoked connection alert banner and reconnect action.
  - Connected account email display and scopes listing.
- **Vitest Count Gate:**
  - 171/171 pinned files verified.
  - 6,929/6,929 tests passing (0 failing, 0 regression).
  - TypeScript `tsc --noEmit`: 0 errors.

---

## 3. Residual Risks & Next Steps
- Production deployment requires configuring platform-wide `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` and `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET` in environment variables if BYO per-connection credentials are not supplied by tenants.

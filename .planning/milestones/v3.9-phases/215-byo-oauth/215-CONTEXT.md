---
phase: 215-byo-oauth
status: discussed
date: 2026-08-30
builder: gemini
reviewer: claude
requirements: [OAUTH-01, OAUTH-02, OAUTH-03]
tags: [oauth, credentials, google, microsoft, encryption, token-refresh, migration-129]

decisions:
  - id: D-215-01
    name: hybrid-client-credentials
    choice: "Platform/Admin settings and environment variables provide default Client ID & Secret for Google and Microsoft; connection creation form allows per-connection credential overrides if needed"
    reason: "Allows frictionless single-click connect for end users on shared tenant apps while maintaining self-hosted and custom app flexibility"

  - id: D-215-02
    name: initial-oauth-providers
    choice: "Google (Drive, Docs, Sheets, Gmail) and Microsoft (OneDrive, SharePoint, Microsoft Graph)"
    reason: "Discharges OAUTH-01/02 for the two primary enterprise cloud document and email ecosystems required by Phase 216 and 219"

  - id: D-215-03
    name: backend-mediated-oauth-callback
    choice: "GET /api/connectors/oauth/callback with PKCE code_verifier + signed state nonce; exchanges code for access & refresh tokens on backend, encrypts tokens, and redirects to frontend Settings with connected status"
    reason: "Eliminates token exposure in frontend browser history or client logs; enforces server-side AES-256-GCM encryption envelope before persistence"

  - id: D-215-04
    name: claim-based-token-refresh-lease
    choice: "Atomic DB lease lock on connector_tokens.refresh_claimed_until (30s) when access token is within 5 minutes of expiry"
    reason: "Safeguards multi-worker deployments (WORKER_COUNT=2) against concurrent duplicate token refreshes and race conditions without requiring a centralized leader service"

  - id: D-215-05
    name: account-identity-and-revocation-ux
    choice: "Extract and persist account identity (email/display name); mark status='revoked' with explicit 'Reconnect' action upon invalid_grant errors"
    reason: "Provides failure honesty so operators know exactly which account is connected and when re-authentication is required"
---

# Phase 215: BYO OAuth — Context & Decisions

## Executive Summary
Phase 215 delivers **BYO OAuth** (Bring Your Own OAuth) for first-party enterprise services (Google & Microsoft). It allows customers to register their own OAuth applications, initiate standard authorization code flows with PKCE and CSRF protections, store encrypted tokens at rest (`enc:v1:` envelopes), and maintain persistent connections via claim-based token refresh across multi-worker environments (`WORKER_COUNT=2`).

---

## Locked Decisions

### 1. Client App Registration Architecture (D-215-01)
- **Settings / Env Defaults:** Administrators can configure `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `MICROSOFT_OAUTH_CLIENT_ID`, and `MICROSOFT_OAUTH_CLIENT_SECRET` via environment variables or the **Settings → Providers** UI.
- **Connection Form Overrides:** If platform credentials are set, the connection form shows a single **"Connect with Google"** / **"Connect with Microsoft"** action. If not configured globally, the form prompts the user to enter their application's Client ID and Secret.

### 2. First-Party Providers (D-215-02)
- **Google Cloud:** Authorization endpoint `https://accounts.google.com/o/oauth2/v2/auth`, token endpoint `https://oauth2.googleapis.com/token`. Scopes: `https://www.googleapis.com/auth/drive.readonly`, `https://www.googleapis.com/auth/gmail.send`, etc.
- **Microsoft Entra / Graph:** Common/tenant authorization endpoint `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`, token endpoint `https://login.microsoftonline.com/common/oauth2/v2.0/token`. Scopes: `Files.Read.All`, `Mail.Send`, `offline_access`.

### 3. Callback & PKCE Flow (D-215-03)
- **Flow:**
  1. User clicks "Connect" → Backend generates PKCE `code_verifier`, `code_challenge` (S256), and an HMAC-signed `state` containing `connection_id`, `nonce`, and timestamp.
  2. Temporary PKCE state is cached in DB/Redis with a 10-minute TTL.
  3. User approves at Google/Microsoft consent screen.
  4. Provider redirects to `GET /api/connectors/oauth/callback?code=...&state=...`.
  5. Backend verifies `state`, exchanges `code` + `code_verifier` for `access_token`, `refresh_token`, and `expires_in`.
  6. Backend queries provider UserInfo endpoint (`/userinfo` or `/v1.0/me`) to extract account email and name.
  7. Tokens are encrypted using `app.security.encryption.encrypt_secret` (`enc:v1:`) and stored in `public.connector_tokens`.
  8. User is redirected to `/settings/connections?connected=true&id=...`.

### 4. Claim-Based Refresh Concurrency (D-215-04)
- When a service or tool needs an access token:
  - If `expires_at > now() + 5 minutes`, return decrypted `access_token`.
  - If `expires_at <= now() + 5 minutes`:
    - Atomically claim refresh lease: `UPDATE connector_tokens SET refresh_claimed_until = now() + interval '30 seconds' WHERE connection_id = :id AND (refresh_claimed_until IS NULL OR refresh_claimed_until < now()) RETURNING id`.
    - If claimed: execute refresh HTTP POST with provider token endpoint using decrypted `refresh_token`, update `access_token`, `expires_at`, `refresh_token`, and clear `refresh_claimed_until`.
    - If not claimed (another worker is currently refreshing): poll / await for up to 5 seconds for the updated row.

### 5. Revocation & Failure Honesty (D-215-05)
- If provider returns `invalid_grant` or `unauthorized_client` during refresh:
  - Set `status = "revoked"` and `error_message = "Authentication expired or access was revoked at the provider"`.
  - Frontend renders a amber `REVOKED` badge with a prominent `Reconnect` button.

---

## Database Migration & Schema (Migration 129)
`public.connector_tokens` table:
- `id` (UUID PK)
- `connection_id` (UUID FK → `connector_connections.id` ON DELETE CASCADE, UNIQUE)
- `account_email` (TEXT NULL)
- `account_name` (TEXT NULL)
- `access_token_ciphertext` (TEXT NOT NULL)
- `refresh_token_ciphertext` (TEXT NULL)
- `token_type` (TEXT DEFAULT 'Bearer')
- `scopes` (TEXT[] NOT NULL)
- `expires_at` (TIMESTAMPTZ NOT NULL)
- `refresh_claimed_until` (TIMESTAMPTZ NULL)
- `created_at`, `updated_at` (TIMESTAMPTZ)

---

## Canonical References
- `ROADMAP.md` — Phase 215 specification and requirements (`OAUTH-01..03`).
- `AGENTS.md` — Security and credential storage rules (§3.1).
- `app/security/encryption.py` — Envelope encryption implementation (`enc:v1:`).
- `app/security/egress.py` — SSRF-safe outbound HTTP requests (`send_pinned_http`).

# Phase 215: BYO OAuth — Discussion Log

**Date:** 2026-08-30  
**Participants:** Operator (User), Gemini (Antigravity)

---

## Discussion Topics & Decisions

### 1. OAuth Client Credentials Configuration
- **Options Considered:**
  1. *Hybrid (Platform Defaults + Per-Connection Override)* [Selected]
  2. *Platform Settings only*
  3. *Per-Connection Form only*
- **Outcome:** Selected Hybrid. Administrators can configure Google/Microsoft Client ID & Secret in settings/env vars, while individual connections can override them if a custom OAuth app registration is needed.

### 2. Supported OAuth Providers
- **Options Considered:**
  1. *Google (Drive, Docs, Sheets, Gmail)* [Selected]
  2. *Microsoft (OneDrive, SharePoint, Graph)* [Selected]
  3. *GitHub*
  4. *Notion*
- **Outcome:** Initial focus on enterprise Google Cloud and Microsoft Graph ecosystems to power Phase 216 (Chat connections) and Phase 219 (Connected sources).

### 3. Callback & PKCE Architecture
- **Options Considered:**
  1. *Backend-mediated callback* (`/api/connectors/oauth/callback`) [Selected]
  2. *Frontend callback route* (`/oauth/callback`)
- **Outcome:** Backend-mediated callback selected. Keeps tokens out of client-side browser history and guarantees encryption at rest before returning to UI.

### 4. Silent Token Refresh in Multi-Worker Environments (`WORKER_COUNT=2`)
- **Options Considered:**
  1. *Proactive Atomic Lease Lock (`refresh_claimed_until`)* [Selected]
  2. *Reactive 401 Retry*
- **Outcome:** Atomic DB lease on `refresh_claimed_until` (30 seconds) prevents concurrent workers from double-refreshing expiring tokens.

### 5. Account Presentation & Revocation
- **Options Considered:**
  1. *Explicit Connected Email + Revoked Badge with Reconnect* [Selected]
  2. *Silent Auto-Disconnect*
- **Outcome:** Display connected account identity on the connection card and surface a clear `REVOKED` state with a single-click `Reconnect` action on token invalidation.

---

## Next Step
Discussion is concluded and decisions are locked in `215-CONTEXT.md`. Ready for `/gsd:plan-phase 215`.

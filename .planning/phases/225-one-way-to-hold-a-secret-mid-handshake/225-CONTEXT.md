# Phase 225: One Way to Hold a Secret Mid-Handshake - Context

**Gathered:** 2026-09-03  
**Status:** Ready for planning  

<domain>
## Phase Boundary

The OAuth handshake keeps its secrets **on the server** instead of in the URL bar — unifying Google / BYO OAuth with the opaque-handle architecture `mcp_oauth.py` already ships.

Scope anchors (from `225-PROPOSAL.md`, `ROADMAP.md`, and `BUS-048`):
1. **No secret in any URL the browser sees (SC#1):** The authorize URL's `state` parameter must be an opaque random handle (`secrets.token_urlsafe(32)`) and nothing more — no `cid_ovr` (client id), no `sec_ovr` (client secret), and no `cv` (PKCE code verifier).
2. **One state implementation, not two (SC#2):** Extract and converge the Redis-backed opaque state handle mechanics into a shared helper (`oauth_state.py`) consumed by both `oauth_service.py` (Google/BYO) and `mcp_oauth.py`.
3. **In-flight handshakes survive deployment (SC#3):** A consent initiated before deployment returns after it with an old-format HMAC-signed state; the callback must accept both new opaque handles and legacy HMAC-signed states during a transition window. `verify_oauth_state` is retained for backward compatibility.
4. **Single-use replay defense and expiry (SC#4):** The handle is stored in Redis via `setex` with a 10-minute TTL (600s) and deleted atomically on redemption (`_take_pending`). Replays and expired handles fail closed.
5. **End-to-end verification (SC#5):** Google connection remains completely functional with zero user-facing breakage or UI regression.

</domain>

<decisions>
## Implementation Decisions

### 1. Shared State Engine & Architecture (SC#2)
- **D-225-01:** Dedicated `backend/app/services/oauth_state.py` module:
  - Extract the pending authorization record and Redis operations from `mcp_oauth.py` into `backend/app/services/oauth_state.py`.
  - Provide a clean, typed interface:
    - `PendingOAuthState` dataclass (storing `code_verifier`, `client_id`, `client_secret`, `redirect_uri`, `connection_id`, `user_id`, `org_id`, `provider`, `token_endpoint`, `server_url`, `created_at`).
    - `save_pending_state(redis, state: PendingOAuthState, ttl_seconds: int = 600) -> str (handle)`: uses `secrets.token_urlsafe(32)` and atomic `redis.setex("oauth:pending:{handle}", 600, json)`.
    - `take_pending_state(redis, handle: str) -> PendingOAuthState`: reads and deletes the key (`get` then `delete`), raising `OAuthStateExpiredOrInvalidError` if missing.
  - Refactor `mcp_oauth.py` to import and consume `oauth_state.py` without breaking its existing contracts or external route signatures.
  - Refactor `oauth_service.py` to use `oauth_state.py` for authoring new OAuth states.

### 2. Elimination of Cleartext Secrets in Authorize URL (SC#1 & SC#4)
- **D-225-02:** Authorize endpoint (`/connectors/oauth/authorize` & `build_authorization_url`):
  - In `build_authorization_url`, replace `generate_oauth_state` with `save_pending_state`.
  - The emitted URL contains `?state={opaque_handle}`.
  - Assert in unit and integration tests that decoding `state` yields zero secret keys, verifier tokens, or metadata payloads.

### 3. Dual-Mode Transition Cutover (SC#3)
- **D-225-03:** Callback backward compatibility in `GET /connectors/oauth/callback`:
  - The callback inspects `state`:
    - **Opaque Handle Path (New):** Query Redis via `take_pending_state`. If found, consume `PendingOAuthState`, extract `code_verifier`, `client_id`, `client_secret`, `provider`, `connection_id`, and proceed to token exchange.
    - **HMAC-Signed Fallback Path (Legacy):** If state contains a `.` delimiter (or fails Redis lookup and contains `.`), invoke `verify_oauth_state(state)`. If signature and timestamp are valid, proceed to token exchange and emit a warning log `[legacy-oauth-state-accepted]`.
    - **Error Handling:** If neither succeeds, redirect to `{frontend_url}/?connections=1&oauth_error=invalid_or_expired_state`.
  - `verify_oauth_state` is kept intact in `oauth_service.py` to support legacy in-flight handshakes.

### 4. Code & Hot-File Hygiene (G-5)
- **D-225-04:** G-5 hot file protection for `backend/app/api/connectors.py`:
  - Edits in `connectors.py` are strictly bounded to `create_oauth_authorize_url` and `oauth_callback`.
  - Re-derive G-5 metrics for `connectors.py` before and after changes.
  - No database migration or table schema modification (pure Redis and application layer).

</decisions>

<canonical_refs>
## Canonical References

### Scope & Scoping Contract
- `.planning/phases/225-one-way-to-hold-a-secret-mid-handshake/225-PROPOSAL.md` — Authoritative scoping document
- `.planning/ROADMAP.md` §`Phase 225` — Roadmap goal and success criteria
- `.agent-bus/OPEN.md` §`BUS-048` — Original security discovery and operator ruling

### Codebase Implementations
- `backend/app/services/mcp_oauth.py` — Existing reference implementation of opaque Redis handle
- `backend/app/services/oauth_service.py` — Current Google/BYO OAuth state and PKCE functions
- `backend/app/api/connectors.py` — Authorize and callback route handlers for OAuth and MCP

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mcp_oauth.py`: `_take_pending`, `_PENDING_KEY`, `PENDING_TTL_SECONDS = 600`, atomic `setex`.
- `oauth_service.py`: `generate_pkce_pair()`, `resolve_client_credentials()`, `exchange_code_for_tokens()`.

### Integration Points
- `backend/app/api/connectors.py`:
  - `POST /connectors/oauth/authorize`: passes `redis` to state creator, returns opaque handle in URL.
  - `GET /connectors/oauth/callback`: consumes handle from `redis` or falls back to `verify_oauth_state`.

</code_context>

<specifics>
## Specific Ideas
- Decouple the state management logic cleanly into `oauth_state.py` so both MCP and standard OAuth share the exact same battle-tested Redis primitives.
- Ensure the negative test decodes the emitted authorize URL from end-to-end to verify that base64 decoding fails or produces raw entropy without JSON dictionary keys.
</specifics>

# Phase 225 Validation Ledger

## Automated Gate Results

| Test Suite | Result | Details |
|---|---|---|
| `tests/unit/test_oauth_state.py` | 7 / 7 PASSED | Save, take, single-use delete, 600s TTL pin, opaque handle entropy, B-3 flow validation (both directions), legacy key fallback |
| `tests/unit/test_222_mcp_oauth.py` | 12 / 12 PASSED | Converged MCP OAuth service tests, key prefix updated to `oauth:pending:` (B-2) |
| `tests/unit/test_222_mcp_oauth_routes.py` | 9 / 9 PASSED | MCP OAuth route integration |
| `tests/unit/test_oauth_service.py` | 10 / 10 PASSED | `build_authorization_url` async with fake_redis, PKCE, opaque handle verification |
| `tests/integration/test_oauth_e2e.py` | 3 / 3 PASSED | Full lifecycle updated to server-side `take_pending_state` |
| `tests/test_225_oauth_state_security.py` | 9 / 9 PASSED | SC#1, SC#2, SC#3, SC#3 negative (tampered legacy), SC#4 (replay defense), SC#5 (real route mocks-neither-side), B-1 (/app redirects), A-3 (503 fail-closed), A-10 (architectural fence) |

## Manual Browser Row (Claude Driven — SC#5)

| Step | Surface | Action / Observation | Status |
|---|---|---|---|
| **1. Authorize URL Inspection** | Browser URL bar / Network tab | Initiate Google OAuth on local (`POST /connectors/oauth/authorize`). Verify `state` parameter is exactly 43 URL-safe ASCII characters (`[A-Za-z0-9_-]`) containing NO periods (`.`) and no serialized secrets or verifiers. | ✅ PASS 2026-09-03 — real URL to Google carried `state=N1wg8jjS55sVkEwURAA6vAAgJBM0RlrDP7Eay46ZRtU` (43 chars, no `.`); no secret, verifier or override key anywhere in the URL |
| **2. Mid-flight Secret Storage** | Redis (`redis-cli`) | Before completing consent, run `redis-cli keys 'oauth:pending:*'`. Verify key exists with TTL ≤ 600s and holds JSON containing `code_verifier`, `client_secret`, and `flow: "provider"`. | ✅ PASS — one key `oauth:pending:<same handle>`, TTL 591 s, JSON held `code_verifier`, `client_secret`, `flow: provider`, `provider: google` |
| **3. Clean Completion** | Browser callback | Complete Google consent flow. Provider redirects browser to `/connectors/oauth/callback`. Verify single-use retrieval deletes the key from Redis (`keys 'oauth:pending:*'` is empty). | ✅ PASS — operator completed consent in their own Chrome (Google refuses sign-in inside an automation-controlled browser); afterwards `oauth:pending:*` held only Claude's abandoned handle; `connector_tokens.updated_at` for `5deb27f0…` = 17:06:38 UTC, fresh from this flow |
| **4. In-App Landing (B-1)** | Browser UI (`/app`) | Verify browser is redirected to `{frontend_url}/app?connections=1&oauth_connected=1` (landing inside the app workspace rather than marketing `/` landing page). Connection row reads connected. | ✅ PASS — operator landed on `/app?connections=1&oauth_connected=1&id=5deb27f0-…`. ⚠ The app then showed CHAT, not Connections: nothing reads the query string (SEED-185 half of BUG-260903-01, out of 225's scope) |

## Live probes against the running backend (2026-09-03, after the stale worker was stopped)

| Request | Redirect |
|---|---|
| unknown 43-char handle → `/connectors/oauth/callback` | `/app?connections=1&oauth_error=invalid_or_expired_state` |
| tampered legacy `payload.sig` state | `/app?connections=1&oauth_error=invalid_or_expired_state` |
| no `state` | `/app?connections=1&oauth_error=missing_code_or_state` |
| unknown handle → `/connectors/mcp/oauth/callback` | `/app?connections=1&oauth_error=exchange_failed` |

Single-use is proven by the consumed key plus the unknown-handle probe above: a replayed callback holds a handle Redis no longer has.

## Observations, not findings

- ⚠ **A stale `--workers 2` uvicorn from 9/2 was still bound to :8000 beside today's `--reload` one** (Windows lets both bind), so the first live probes returned PRE-225 behaviour from the tree's own HEAD. Killing the supervisor left its two `multiprocessing.spawn` workers alive and still listening; they had to be stopped by PID. Check `Get-NetTCPConnection -LocalPort 8000` before trusting a live probe.
- Advisory (not closed): at `oauth_callback`, a Redis outage during `take_pending_state` escapes as a raw 500 rather than a redirect — only `OAuthStateError` is caught around the lookup. Authorize fails closed with 503 (A-3); the callback should mirror it.
- Backend counts: Gemini read **71** failing (scope not stated, presumably `tests/unit`); Claude's full `tests/` run read **265 failed / 5446 passed / 1 error** in 8m02s. None of the failures name oauth, connector or mcp. The two numbers are different scopes, not a regression — record the scope next to the number.

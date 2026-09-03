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
| **1. Authorize URL Inspection** | Browser URL bar / Network tab | Initiate Google OAuth on local (`POST /connectors/oauth/authorize`). Verify `state` parameter is exactly 43 URL-safe ASCII characters (`[A-Za-z0-9_-]`) containing NO periods (`.`) and no serialized secrets or verifiers. | Ready for Claude drive |
| **2. Mid-flight Secret Storage** | Redis (`redis-cli`) | Before completing consent, run `redis-cli keys 'oauth:pending:*'`. Verify key exists with TTL ≤ 600s and holds JSON containing `code_verifier`, `client_secret`, and `flow: "provider"`. | Ready for Claude drive |
| **3. Clean Completion** | Browser callback | Complete Google consent flow. Provider redirects browser to `/connectors/oauth/callback`. Verify single-use retrieval deletes the key from Redis (`keys 'oauth:pending:*'` is empty). | Ready for Claude drive |
| **4. In-App Landing (B-1)** | Browser UI (`/app`) | Verify browser is redirected to `{frontend_url}/app?connections=1&oauth_connected=1` (landing inside the app workspace rather than marketing `/` landing page). Connection row reads connected. | Ready for Claude drive |

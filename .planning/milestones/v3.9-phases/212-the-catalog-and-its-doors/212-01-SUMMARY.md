# Phase 212 Plan 01 Summary: Outbound MCP Egress Hardening & Pre-Save Discovery

**Plan:** `212-01-PLAN.md`
**Wave:** 1
**Status:** Complete
**Date:** 2026-08-27

---

## Accomplishments

1. **Off-Event-Loop DNS Resolution (D-v2.5-01):**
   - Wrapped `validate_mcp_destination(server_url)` in `await run_in_threadpool(validate_mcp_destination, server_url)` inside `mcp_client._send_jsonrpc`.
   - Eliminates synchronous event-loop blocking from `socket.getaddrinfo`.

2. **TOCTOU DNS-Rebinding Prevention:**
   - Consumes `PinnedDestination` from validation to rewrite destination URL host to the validated IP literal (`target_url = str(parsed_target.copy_with(host=pinned.ip))`).
   - Restores original virtual hostname in the `Host: pinned.hostname` header and TLS SNI extension.

3. **Transport Security Hardening (SEC-2 / D-07):**
   - Configured `httpx.AsyncClient` with `follow_redirects=False`, `verify=True`, and `trust_env=False` to prevent proxy bypass and redirect-chasing SSRF.
   - Enforced strict `MAX_MCP_BODY_BYTES = 2 * 1024 * 1024` (2MB) payload cap on responses.

4. **Pre-Save Interactive Discovery Endpoint (`POST /connectors/discover-tools`):**
   - Added `POST /api/connectors/discover-tools` endpoint accepting `McpDiscoverRequest(mcp_server_url, secret, timeout)`.
   - Gated per-endpoint with `require_visible("live_connectors")` (SEC-1) and `require_org_manage`.
   - Discovers and returns sanitized tools (`name`, `title`, `description`, `inputSchema`, `outputSchema`).

5. **Unit Verification:**
   - Authored `backend/tests/unit/test_mcp_egress_hardening.py` testing threadpooled DNS, IP pinning, byte caps, and redirect refusals.
   - Verified 336 connector tests pass with 0 failures across the test suite (`test_mcp_egress_hardening.py`, `test_mcp_connector_client.py`, `test_190_*.py`, `test_211_*.py`).

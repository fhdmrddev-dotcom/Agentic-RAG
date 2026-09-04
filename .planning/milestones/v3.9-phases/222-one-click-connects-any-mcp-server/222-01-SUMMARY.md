# Plan 222-01 Summary — API Wire Contract & Types

**Completed:** 2026-09-01
**Phase:** 222 (One Click Connects Any MCP Server — The Door Half)
**Plan:** 01 (Wave 1)

---

## What Shipped

1. **API Client Functions & Types (`frontend/src/lib/api/connectors.ts`)**:
   - `McpAuthKind = "open" | "oauth" | "token" | "unreachable"`.
   - `McpProbeAuthResponse` carrying `kind`, `authorization_host`, `registration_required`, `code_challenge_methods`, `detail`, `resource_status`.
   - `McpOAuthAuthorizeResponse` carrying `authorize_url`, `authorization_host`.
   - `probeMcpAuth(serverUrl: string): Promise<McpProbeAuthResponse>` calling `POST /api/connectors/mcp/probe-auth`. Correctly extracts structured `reasonCode` on 422 egress refusals and human messages on 502 oversize metadata.
   - `createMcpOAuthAuthorizeUrl(connectionId: string): Promise<McpOAuthAuthorizeResponse>` calling `POST /api/connectors/mcp/oauth/authorize`.

2. **API Barrel Re-exports (`frontend/src/lib/api.ts`)**:
   - Re-exported `probeMcpAuth`, `createMcpOAuthAuthorizeUrl`, `McpAuthKind`, `McpProbeAuthResponse`, and `McpOAuthAuthorizeResponse` per `D-207-06`.

3. **Dedicated Unit Tests (`frontend/src/lib/api/__tests__/connectors.mcp_auth.test.ts`)**:
   - 8 unit tests covering all 4 `kind` response shapes, 422 structured `reason_code` extraction, 502 response too large error, and `createMcpOAuthAuthorizeUrl` success/failure.

---

## Verification Results

- `npx vitest run frontend/src/lib/api/__tests__/connectors.mcp_auth.test.ts`: **8/8 passed**.
- `npx tsc --noEmit -p tsconfig.app.json` (from `frontend/`): Verified at baseline 66 errors (0 new errors).

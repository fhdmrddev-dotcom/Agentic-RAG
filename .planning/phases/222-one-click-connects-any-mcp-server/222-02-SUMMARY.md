# Plan 222-02 Summary — Catalog & Copy Foundations

**Completed:** 2026-09-01
**Phase:** 222 (One Click Connects Any MCP Server — The Door Half)
**Plan:** 02 (Wave 2)

---

## What Shipped

1. **Catalog Update (`frontend/src/components/settings/servicesCatalog.ts`)**:
   - Updated Notion catalog entry `defaultHost` to `mcp.notion.com/mcp` with `shape: "mcp"`.

2. **Copy Constants and Helpers (`frontend/src/components/settings/connectionFormCopy.ts`)**:
   - `MCP_PROBING_STATUS`: `"Checking server authentication..."`.
   - `MCP_AUTH_OPEN_DESC`: `"No credentials required. This server allows direct connection."`.
   - `MCP_AUTH_OAUTH_DCR_DESC`: Names authorization host for 1-click dynamic client registration.
   - `MCP_AUTH_OAUTH_BYO_DESC`: Prompts for client credentials with named authorization host.
   - `MCP_AUTH_TOKEN_DESC`: Displays verbatim backend detail if present, or generic token guidance fallback.
   - `MCP_REFUSAL_POLICY_HEADING` vs `MCP_UNREACHABLE_HEADING`: Distinct headings preserving security policy refusal vs server unreachable distinction.
   - `mcpAuthActionLabel`: Returns action verb tailored to auth kind and DCR status.
   - `mcpPolicyRefusalMessage`: Maps the closed set of reason codes (`address_not_public`, `scheme_not_tls`, `host_not_allowed`, `host_not_ascii`, `unresolvable`, `redirected`) to clear human explanations.

3. **Unit Tests (`frontend/src/components/settings/__tests__/connectionFormCopy.mcp.test.ts`)**:
   - 6 test cases asserting catalog resolution and exact copy identity.

---

## Verification Results

- `npx vitest run src/components/settings/__tests__/connectionFormCopy.mcp.test.ts`: **6/6 passed**.
- `npx vitest run src/components/settings/__tests__/servicesCatalog.test.ts`: **3/3 passed**.

# Phase 212 Plan 02 Summary: Services Catalog Registry, Mark Resolver & Client API

**Plan:** `212-02-PLAN.md`
**Wave:** 2
**Status:** Complete
**Date:** 2026-08-27

---

## Accomplishments

1. **Authored Services Catalog Registry (`servicesCatalog.ts`):**
   - Created presentation registry with curated entries for Slack, Jira, SMTP/Email, GitHub, Google Workspace, Notion, and Custom MCP.
   - Declares one-line purpose (`tagline`), starter prompts, category, and default field metadata for all catalog presets.
   - Guaranteed totality: `getServiceCatalogEntry(serviceId)` returns a graceful dynamic entry with `markKey: "mcp"` for unknown service_ids/hostnames and never throws or returns null.

2. **Catalog Copywriting Module (`catalogCopy.ts`):**
   - Centralized search placeholders, `PROVENANCE_ADDED_BY_URL = "ADDED BY URL"`, state filter labels (`All`, `Connected`, `Not connected`), and empty states.

3. **Service-Aware Mark Resolver (`connectionMark.tsx`):**
   - Extended `ConnectionMarkShape` to accept `service_id?: string | null`.
   - Resolves `slack` (SlackIcon), `jira` (JiraIcon), `smtp` (Mail), and `mcp`/`custom_mcp` (McpIcon).
   - Preserves strict ink contract (`self`, `fill`, `stroke`) and own-property checks.

4. **Client API Function (`probeMcpServer` & `lib/api.ts`):**
   - Exported `probeMcpServer(payload: McpProbeRequest): Promise<McpProbeResponse>` in `frontend/src/lib/api/connectors.ts` hitting `POST /connectors/discover-tools`.
   - Preserved existing `discoverConnectorTools(id: string)` with zero naming collisions (`S-1` blocker fix).
   - Re-exported `probeMcpServer`, `McpProbeRequest`, `McpProbeResponse` in `frontend/src/lib/api.ts` per `D-207-06`.

5. **Unit Verification:**
   - Authored `servicesCatalog.test.ts` (3 tests) and updated `connectionMark.test.tsx` (42 tests).
   - Both test suites pass 100% green (45/45 passed).
   - Verified `tsc -p tsconfig.app.json` has 34 errors (exact baseline, zero errors introduced).

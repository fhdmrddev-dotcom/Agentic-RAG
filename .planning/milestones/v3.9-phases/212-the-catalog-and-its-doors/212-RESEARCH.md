# Phase 212: The Catalog and Its Doors — Technical Research

**Date:** 2026-08-27
**Phase:** 212 (The Catalog and Its Doors)
**Status:** Complete
**Valid until:** 2026-09-10

---

## Executive Summary

Phase 212 transforms the Connections experience in Settings from a raw connection list into an app-directory style Catalog of services. Users can browse, search, and filter services by connection state (`All / Connected / Not connected`), instantiate curated Popular services in one click, and connect arbitrary custom MCP servers via a hardened "paste-a-URL" door with interactive tool discovery preview.

This research establishes the technical foundation for:
1. **The Outbound Egress Boundary & DNS Hardening (D-v2.5-01):** Fixing `mcp_client.py:220`'s blocking DNS on the async event loop via `run_in_threadpool(validate_mcp_destination)`, rewriting transport host to the validated IP literal to prevent DNS-rebinding TOCTOU attacks, setting `trust_env=False`, and bounding JSON-RPC response decoding.
2. **Interactive Tool Discovery (`POST /connectors/discover-tools`):** Exposing pre-save MCP discovery so users can preview tool titles, descriptions, and input schemas before persisting.
3. **Presentation-Driven Services Catalog (`servicesCatalog.ts`):** A frontend presentation registry keyed on `service_id` providing curated metadata, starter prompts, and pre-filled templates for Slack, Jira, SMTP/Email, GitHub, Google Workspace, and Notion, while gracefully degrading unknown/custom services to neutral marks with zero database migrations.
4. **Grant-Preserving Lifecycle (CONN-07):** Key-preserving additive merge for `tool_grants` across credential/endpoint updates and tool re-discovery, plus impact-aware deletion checking `usageCounts`.
5. **Cloud Parity & Honest Guidance (`BUG-260810-01`):** Rendering clean informative banners linking directly to the Control Room when `live_connectors` is disabled on cloud installs.
6. **G-5 Modular Refactoring:** Extracting catalog definitions and copy into dedicated modules to arrest line ballooning on hot files (`ConnectionsTab.tsx` and `ConnectionFormPanel.tsx`).

---

## 1. Outbound Egress & Transport Hardening (`mcp_client.py`)

### 1.1 The Existing Gap vs. Sibling Egress Path
The baseline measurement pack (`212-MEASUREMENTS.md` §6.1) revealed six critical divergences between the MCP outbound path (`mcp_client.py::_send_jsonrpc`) and the hardened capability egress path (`egress.py::send_pinned_http`):

| Property | `mcp_client._send_jsonrpc` (Current) | `egress.send_pinned_http` (Hardened Target) |
|---|---|---|
| Validation Call | `validate_mcp_destination(server_url)` (bare def) | `await run_in_threadpool(validate_mcp_destination, server_url)` |
| Event Loop Impact | **Blocking DNS** on asyncio loop (violates D-v2.5-01) | Off event-loop threadpool execution |
| Return Value | **Discarded** | Uses `PinnedDestination` to rewrite host to IP literal |
| DNS-Rebinding TOCTOU | **Vulnerable** (subsequent connect re-resolves DNS) | **Protected** (connects directly to validated IP) |
| `follow_redirects` | `True` (unbounded redirect chasing) | `False` or validated hop-by-hop |
| `trust_env` | Not set (`httpx` default `True`) | `False` (prevents proxy env-var leakage) |
| Response Bound | Unbounded `response.text` | Bounded body decoding (`MAX_RESPONSE_BYTES`) |

### 1.2 The Hardened Implementation Pattern
In `backend/app/services/mcp_client.py`:
```python
from starlette.concurrency import run_in_threadpool
from app.security.egress import validate_mcp_destination, PinnedDestination

MAX_MCP_BODY_BYTES = 2 * 1024 * 1024  # 2MB response limit

async def _send_jsonrpc(
    server_url: str,
    method: str,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    timeout: float = 15.0,
) -> dict[str, Any]:
    # 1. Validate destination off event-loop (D-v2.5-01)
    pinned: PinnedDestination = await run_in_threadpool(
        validate_mcp_destination, server_url
    )
    
    # 2. TOCTOU DNS-rebinding fix: rewrite URL host to pinned IP literal
    # while preserving original hostname in Host header and SNI
    parsed_url = httpx.URL(server_url)
    ip_literal_url = parsed_url.copy_with(host=pinned.ip)
    
    req_headers = dict(headers or {})
    req_headers.setdefault("Host", pinned.host)
    req_headers.setdefault("Accept", "application/json, text/event-stream")
    
    # 3. Transport security
    async with httpx.AsyncClient(
        verify=True,
        trust_env=False,
        follow_redirects=False,
        timeout=httpx.Timeout(timeout, connect=5.0),
    ) as client:
        # Send payload and stream bounded response
        ...
```

### 1.3 Error Categorization & Diagnostics
When validation or transport fails, emit structured diagnostic errors:
- `SSRF_BLOCKED`: Private / loopback / cloud-metadata destination refused by policy.
- `UNREACHABLE_HOST`: Connect timeout or DNS NXDOMAIN.
- `TLS_ERROR`: SSL certificate verification failure.
- `INVALID_PAYLOAD`: Non-JSON or invalid JSON-RPC response structure.

---

## 2. Interactive Discovery Endpoint (`POST /connectors/discover-tools`)

### 2.1 Wire Contract
- **Route:** `POST /api/connectors/discover-tools`
- **Auth:** `require_org_admin` (or `require_org_manage`)
- **Request Body:**
  ```json
  {
    "mcp_server_url": "https://mcp.deepwiki.com/sse",
    "headers": { "Authorization": "Bearer ***" },
    "timeout": 15.0
  }
  ```
- **Response Body (`200 OK`):**
  ```json
  {
    "server_url": "https://mcp.deepwiki.com/sse",
    "tools": [
      {
        "name": "search_wiki",
        "title": "Search Knowledge Base",
        "description": "Searches documentation articles by keyword",
        "inputSchema": {
          "type": "object",
          "properties": {
            "query": { "type": "string", "description": "Search terms" }
          },
          "required": ["query"]
        },
        "outputSchema": {
          "type": "object",
          "properties": {
            "results": { "type": "array" }
          }
        }
      }
    ],
    "count": 1
  }
  ```
- **Error Response (`422 Unprocessable Entity` or `400 Bad Request`):**
  ```json
  {
    "detail": "Connection refused: Private network destination is forbidden by security policy."
  }
  ```

---

## 3. Presentation-Driven Services Catalog (`servicesCatalog.ts`)

### 3.1 Registry Architecture
The catalog is defined in `frontend/src/components/settings/servicesCatalog.ts`. It provides an authored registry of known services keyed on `service_id`:

```typescript
export interface CatalogServiceEntry {
  serviceId: string
  name: string
  tagline: string
  description: string
  markKey: string
  isPopular: boolean
  category: "collaboration" | "productivity" | "developer" | "communication" | "custom"
  defaultConfig?: Record<string, string>
  fieldTemplates?: ServiceFieldTemplate[]
  starterPrompts?: string[]
}

export interface ServiceFieldTemplate {
  key: string
  label: string
  type: "text" | "password" | "url"
  placeholder: string
  helpText: string
  required: boolean
}
```

### 3.2 Curated Popular Roster
1. **Slack (`slack`)**: "Real-time team messaging and channel updates."
   - Prompts: "Post daily incident summaries", "Alert channel on build failure"
2. **Jira (`jira`)**: "Issue tracking and agile sprint management."
   - Prompts: "Create a bug ticket with error logs", "Summarize open sprint issues"
3. **SMTP / Email (`smtp`)**: "Direct outbound notifications via standard mail servers."
   - Prompts: "Email executive summary report", "Send critical alert notification"
4. **GitHub (`github`)**: "Source repository operations, pull requests, and issues."
   - Prompts: "Search repository pull requests", "List open security alerts"
5. **Google Workspace (`google`)**: "Document collaboration and drive assets."
   - Prompts: "Summarize shared documents", "Search team drive"
6. **Notion (`notion`)**: "Team knowledge base and documentation workspace."
   - Prompts: "Search engineering runbooks", "Append notes to project page"
7. **Custom MCP (`custom_mcp`)**: "Connect any Model Context Protocol compliant server."
   - Prompts: "Execute custom server tools", "Query domain-specific endpoints"

### 3.3 Totality & Fallback Guarantee
If `getServiceCatalogEntry(serviceId)` does not match any preset:
- Returns a dynamic entry: `{ serviceId, name: serviceId, tagline: "Connected MCP service", markKey: "mcp", isPopular: false }`.
- Never throws, never hides the row, never refuses rendering.

---

## 4. Grant Preservation & Additive Merge (CONN-07)

### 4.1 Merging Strategy on Update / Re-Discovery
When updating an existing connection with new discovered tools:
```typescript
export function mergeToolGrants(
  existingGrants: Record<string, boolean> | null | undefined,
  newTools: Array<{ name: string }>
): Record<string, boolean> {
  const current = existingGrants || {}
  const next: Record<string, boolean> = {}
  
  for (const tool of newTools) {
    if (Object.prototype.hasOwnProperty.call(current, tool.name)) {
      // Preserve existing user decision
      next[tool.name] = current[tool.name]
    } else {
      // Default new tools to ungranted (false) for safety
      next[tool.name] = false
    }
  }
  return next
}
```

### 4.2 Impact-Aware Deletion
Before deleting a connection:
- Inspect `usageCounts[connection.id]`.
- If `usageCounts > 0`: Display confirmation sheet explicitly naming that active published workflows depend on this connection.
- Require explicit confirmation before calling `deleteConnectorConnection(id)`.

---

## 5. Cloud Parity & `live_connectors` Gate (`BUG-260810-01`)

### 5.1 The Root Cause of `BUG-260810-01`
On cloud installs, `app_settings.feature_visibility` initializes with `live_connectors: "off"`. `ConnectionsTab.tsx:270` computes:
```typescript
const canWrite = isOrgAdmin && liveConnectorsOn
```
When `live_connectors` is off, previous code removed the Add button with no guidance on how to enable it.

### 5.2 Resolution in Phase 212
- The catalog is always browsable in read-only / discovery mode.
- When `liveConnectorsOn` is false, render the platform policy banner with an explicit navigation button: `"Enable Live Connections in Control Room"` (rendered for Org Admins).
- When enabled in Control Room, Add/Connect flows operate identically across cloud and local environments.

---

## 6. G-5 Hot-File Refactoring & Seam Audit

### 6.1 Hot-File Blast Radius & Dispositions
- `frontend/src/components/settings/ConnectionsTab.tsx` (9 / 4 / 1218): Extract catalog directory layout into `ServicesCatalogView.tsx` and copy to `catalogCopy.ts`.
- `frontend/src/components/settings/ConnectionFormPanel.tsx` (7 / 4 / 1889): Extract MCP discovery preview into `McpDiscoveryPreview.tsx`.
- `frontend/src/components/settings/connectionsCopy.ts` (6 / 5 / 571): Retain core table copy; put catalog-specific strings in `catalogCopy.ts`.
- `frontend/src/components/settings/connectionFormCopy.ts` (5 / 4 / 966): Add field templates and discovery preview copy.
- `frontend/src/components/settings/connectionMark.tsx` (2 / 2 / 231): Update mark resolver to accept `service_id`.
- `frontend/src/pages/SettingsPage.tsx` (34 / 21 / 1426): Add owed ledger row and section.

### 6.2 Barrel Audit (`D-207-06`)
Verify `frontend/src/lib/api.ts` exports all symbols from `frontend/src/lib/api/connectors.ts`, including the new `discoverConnectorTools` API function.

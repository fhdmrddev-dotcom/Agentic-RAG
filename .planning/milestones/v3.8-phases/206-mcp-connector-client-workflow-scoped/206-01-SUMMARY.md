---
phase: 206-mcp-connector-client-workflow-scoped
plan: 01
subsystem: backend/security + backend/services + backend/api + frontend/workflows
tags: [CONN-02, CONN-03, mcp, json-rpc, ssrf-defense, per-tool-grants, audit-logging, hot-file-ledger, preflight-fixes]
requires:
  - "Phase 190 connector framework & secret cipher (shipped)"
  - "Phase 189 external action workflow node (shipped)"
  - "Phase 185 audit events infrastructure (shipped)"
  - "Phase 204 scheduler & execution engine (shipped)"
provides:
  - "Migration 126: provider-shaped MCP connector schema (mcp_server_url, tool_grants, discovered_tools)"
  - "SSRF egress defense validate_mcp_destination blocking loopback, RFC1918, cloud metadata 169.254.169.254, IPv6 site-local"
  - "Async JSON-RPC 2.0 McpClient with Bearer & Basic auth handling"
  - "On-demand tool discovery (POST /connectors/connections/{id}/discover)"
  - "Per-tool boolean permission grant management (PATCH /connectors/connections/{id}/grants)"
  - "Workflow engine MCP tool dispatch with per-tool grant enforcement and tool_refused audit logging via write_audit"
  - "Frontend API client methods, 7 mock budgets spent in same commit"
  - "McpToolPicker leaf component maintaining zero-hook pin in PhaseFormPanel.tsx (F-7)"
  - "Two-file MCP fence retirement in test_189_no_egress.py and test_190_ssti_fence.py"
affects:
  - "supabase/migrations/126_mcp_connector_connections.sql"
  - "backend/app/models/connector.py"
  - "backend/app/models/harness.py"
  - "backend/app/security/egress.py"
  - "backend/app/services/mcp_client.py"
  - "backend/app/services/connector_service.py"
  - "backend/app/api/connectors.py"
  - "backend/app/services/harness/phase_types.py"
  - "docs/HOT-FILE-LEDGER.md"
  - "frontend/src/lib/api.ts"
  - "frontend/src/components/workflows/ConnectionPicker.tsx"
  - "frontend/src/components/workflows/McpToolPicker.tsx"
  - "frontend/src/components/workflows/McpToolPicker.test.tsx"
  - "backend/tests/unit/test_mcp_connector_client.py"
decisions:
  - "F-1: tool_grants representation unified to boolean map { [tool_name: string]: boolean }, missing key denies (tool_grants.get(tool_name) is True)"
  - "F-2: JS/TS grant predicate evaluates Object.prototype.hasOwnProperty.call(grants, toolName) && Boolean(grants[toolName])"
  - "F-3: Outbound permission refusal emits tool_refused audit event to harness_audit via write_audit"
  - "F-4: Discovered tools treated as untrusted remote text with threat model coverage T-206-01 (SSRF), T-206-02 (per-tool grants), T-206-03 (untrusted tool metadata)"
  - "F-5: SSRF destination validation strictly blocks unresolvable, loopback, private RFC1918, cloud metadata (169.254.169.254), and IPv6 site-local"
  - "F-6: Hot file ledger updated with ESCALATED DECISION for api.ts naming Phase 207 as its extraction phase, plus entries for phase_types.py, connector_service.py, PhaseFormPanel.tsx"
  - "F-7: Zero-hook pin in PhaseFormPanel.tsx preserved by leaf component McpToolPicker.tsx"
metrics:
  tasks: 6
  backend_tests: 59
  frontend_tests: 651
  completed: 2026-08-25
---

# Phase 206: MCP Connector Client (Workflow-Scoped) Summary

Phase 206 is fully implemented and verified across backend and frontend layers. Workflows can now connect to external systems (such as Atlassian Jira/Confluence and GitHub) via their official Model Context Protocol (MCP) servers over standard JSON-RPC 2.0 with SSRF egress security, on-demand tool discovery, and granular per-tool permission grants.

---

## What Shipped

### 1. Database Schema & Models (CONN-02 / CONN-03 / F-1)
- **Migration 126 (`supabase/migrations/126_mcp_connector_connections.sql`)**:
  - Adds `mcp_server_url` (TEXT), `tool_grants` (JSONB, default `{}`), and `discovered_tools` (JSONB, default `[]`) to `public.connector_connections`.
  - Drops `NOT NULL` constraint on `capability` column to accommodate provider-level MCP servers.
- **Pydantic Models (`backend/app/models/connector.py` & `backend/app/models/harness.py`)**:
  - Added `McpConfig`, `mcp_server_url`, `tool_grants: dict[str, bool]`, and `discovered_tools: list[dict[str, Any]]` to `ConnectorConnectionCreate`, `ConnectorConnectionUpdate`, and `ConnectorConnectionResponse`.
  - Added `tool_name: str | None` and `tool_args: dict[str, Any]` to `ExternalActionPhaseConfig`.

### 2. SSRF Egress Defense & Fence Retirement (T-206-01 / D-206-04)
- Added `validate_mcp_destination` in `backend/app/security/egress.py`:
  - Enforces public IP resolution (denies `127.0.0.1`, `::1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`, `fec0::/10`).
- Retired MCP fence in `backend/tests/unit/test_189_no_egress.py` and updated `backend/tests/unit/test_190_ssti_fence.py`.

### 3. Backend MCP Client (`app.services.mcp_client`)
- Created `McpClient` providing `list_tools` (`tools/list` JSON-RPC method) and `call_tool` (`tools/call` JSON-RPC method).
- Supports HTTP POST endpoints, JSON-RPC 2.0 protocol error handling, Bearer tokens, and Basic auth (`email:token`).

### 4. Tool Discovery & Permission Grant Management (F-1 / F-3 / D-206-05 / D-206-06)
- Extended `connector_service.py` with `discover_connection_tools` and `update_connection_grants`.
- Added endpoints in `backend/app/api/connectors.py`:
  - `POST /connectors/connections/{connection_id}/discover`: Queries remote MCP server and stores cached tool metadata.
  - `PATCH /connectors/connections/{connection_id}/grants`: Updates per-tool boolean grant map.
- In `backend/app/services/harness/phase_types.py` (`_exec_external_action`):
  - Enforces permission predicate: `grants.get(tool_name) is True`.
  - When granted, dispatches execution via `mcp_client.call_tool` and writes `external_action_sent` send receipt.
  - When NOT granted, refuses execution and emits `tool_refused` audit event to `harness_audit` via `write_audit`.

### 5. Frontend API, Mock Budget & McpToolPicker Leaf Component (F-2 / F-6 / F-7)
- Extended `frontend/src/lib/api.ts` with `discoverConnectorTools` and `updateConnectorGrants`.
- Recorded **ESCALATED DECISION** in `docs/HOT-FILE-LEDGER.md` with trigger dedicating Phase 207 to the `api.ts` extraction.
- Spent mock budget across all 7 test files:
  - `StopControl.test.tsx`
  - `ConnectionPicker.test.tsx`
  - `TemplateAttachSection.test.tsx`
  - `WorkflowDoorSwitch.test.tsx`
  - `useDraftPersistence.test.tsx`
  - `WorkflowBuilderPage.canvas.test.tsx`
  - `WorkflowBuilderPage.header.test.tsx`
- Created `frontend/src/components/workflows/McpToolPicker.tsx` leaf component and test suite `McpToolPicker.test.tsx`:
  - Evaluates grant status strictly via `Object.prototype.hasOwnProperty.call(grants, toolName) && Boolean(grants[toolName])`.
  - Renders visual grant badges and warnings.
  - Preserves strict zero-hook pin in `PhaseFormPanel.tsx`.
- Integrated `McpToolPicker` in `frontend/src/components/workflows/ConnectionPicker.tsx` with scalar string subscriptions.

---

## Test Verification

- **Backend Unit & Integration Tests**: **59 passed / 59 total (100%)**
  - `test_mcp_connector_client.py`: 13 passed
  - `test_189_no_egress.py`: 23 passed
  - `test_190_ssti_fence.py`: 11 passed
  - `test_190_connectors_api.py`: 12 passed
- **Frontend Test Suite**: **651 passed / 651 total (100%)**
  - All 27 test files green including `McpToolPicker.test.tsx`, `ConnectionPicker.test.tsx`, and all 7 mock-budgeted suites.

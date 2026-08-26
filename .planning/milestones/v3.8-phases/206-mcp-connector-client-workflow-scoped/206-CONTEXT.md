# Phase 206: MCP Connector Client — Workflow-Scoped - Context

**Gathered:** 2026-08-25
**Status:** Ready for planning

<domain>
## Phase Boundary

A workflow reaches Atlassian (Jira + Confluence) and GitHub through their **official remote MCP servers** — reads as well as writes — with per-tool permissions and **zero per-vendor adapter code**.

### In Scope
1. **Provider-shaped connection row** holding an MCP server URL + per-tool grants (`mcp_server_url`, `tool_grants` JSONB).
2. **MCP client** in the backend using standard JSON-RPC over HTTP/SSE transport.
3. **Tool discovery** from the remote MCP server feeding the per-tool permission list.
4. **Workflow external-action integration**: Drivable from the existing external-action workflow node by specifying connection + tool name.
5. **Atlassian + GitHub** as proof of official remote MCP servers.
6. **Conscious retirement of MCP fences**: Retire `test_no_mcp_identifiers_in_backend_app` in `backend/tests/unit/test_189_no_egress.py` and update the delegation in `backend/tests/unit/test_190_ssti_fence.py:475`.

### Explicitly Out of Scope (Deferred to Connections & Open Platform Milestone)
- Chat surface & chat approval model (in workflows the author selects actions at authoring time; in chat the model chooses mid-conversation).
- OAuth authorization code flows (Google / Microsoft first-party APIs).
- Drive auto-ingest / background continuous sync.
- Inbound public API and in-process MCP server exposing platform tools to external callers.
- Popular-catalog discovery UI / marketplace.

</domain>

<decisions>
## Implementation Decisions

### Schema & Data Model
- **D-206-01 (Provider-Shaped Schema)**: Transition `connector_connections` from action-shaped (single `capability`) to provider-shaped via migration:
  - Add `mcp_server_url` (Text, non-empty, validated URL).
  - Add `tool_grants` (JSONB mapping of tool names to permission statuses, e.g. `{"jira_create_issue": "enabled", "jira_search_jql": "enabled"}`).
  - Deprecate/make optional the single `capability` column while preserving backward compatibility.
  - Store static authentication credentials (API tokens / Bearer tokens) encrypted in `secret_ciphertext` using the existing `secret_cipher.py` envelope (`enc:v1:`).
- **D-206-02 (Platform Asset Lifecycle & Sequencing)**: In accordance with SEED-145 and SEED-146, connections are modeled as **platform assets**:
  - No workflow-shaped foreign key on the connection.
  - No run-scoped credential resolution.
  - No permission check requiring a `workflow_id`.
  - Connections are org-scoped and resolvable independently of workflow executions.

### Backend MCP Client Architecture
- **D-206-03 (Standard MCP Client)**: Implement backend MCP client supporting JSON-RPC 2.0 protocol over HTTP/SSE transports (compatible with official Atlassian and GitHub MCP servers).
- **D-206-04 (SSRF Defense & URL Validation)**: Remote `mcp_server_url` values are strictly validated:
  - Enforce `https://` scheme (reject plain HTTP unless explicitly enabled for local dev).
  - Reject private/loopback IP addresses (127.0.0.1, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, metadata service endpoints `169.254.169.254`).

### Tool Discovery & Execution
- **D-206-05 (On-Demand Tool Discovery)**: Backend provides an endpoint (e.g. `POST /connectors/connections/{id}/discover`) that queries the remote MCP server (`tools/list`), refreshes available tool schemas, and caches discovered tool schemas in connection state while maintaining author grant configurations.
- **D-206-06 (Workflow Execution Integration)**: Extend `_exec_external_action` / `harness_engine`:
  - When step config targets an MCP connection and tool, resolve connection credentials, invoke tool via MCP client (`tools/call`), and capture structured output.
  - Verify that the specific invoked tool is in `tool_grants` and marked enabled.

### Fence Retirement
- **D-206-07 (Two-File Fence Retirement)**:
  - Retire `test_no_mcp_identifiers_in_backend_app` in `backend/tests/unit/test_189_no_egress.py` (which originally forbade any `mcp` identifier in `backend/app`).
  - Concurrently update `backend/tests/unit/test_190_ssti_fence.py:475` to remove the string assertion on `test_no_mcp_identifiers_in_backend_app`.

### Execution Plan Strategy
- **D-206-08 (Single Integrated Plan)**: Generate a single unified execution plan (`206-01-PLAN.md`) to avoid multi-wave seam integration issues.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Architecture
- `.planning/ROADMAP.md` § Phase 206 (rewritten detail) — Core scope and constraints.
- `.planning/CONNECTIONS-MILESTONE-CANDIDATE.md` § Phase 206 — Fold rationale and per-tool permission grain.
- `.planning/seeds/SEED-145-connections-are-platform-assets-not-workflow-assets.md` — Platform vs workflow asset distinction.
- `.planning/seeds/SEED-146-the-connections-table-shape-is-a-one-way-door.md` — Provider-shaped schema decision.

### Existing Code & Fences
- `backend/app/services/connector_service.py` — Connector connection CRUD and credential encryption resolver.
- `backend/app/models/connector.py` — Connector request/response and config models.
- `backend/app/services/harness/phase_types.py` — `_exec_external_action` executor.
- `backend/tests/unit/test_189_no_egress.py` — Source fence to retire.
- `backend/tests/unit/test_190_ssti_fence.py:475` — Delegation assertion to update.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/security/secret_cipher.py`: Encryption cipher for credentials stored in `secret_ciphertext`.
- `backend/app/services/connector_service.py`: CRUD operations on `connector_connections`.
- `supabase/migrations/116_connector_connections.sql` & `118_connector_secret_column_privilege.sql`: Table structure and RLS policies.

### Established Patterns
- Asyncpg database pools with parameterized `$N` queries.
- Zero-hook pin in `PhaseFormPanel.tsx` (all interactive elements isolated into leaf components).
- Hot file ledger updates in `docs/HOT-FILE-LEDGER.md`.

</code_context>

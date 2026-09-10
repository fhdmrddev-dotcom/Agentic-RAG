# Phase 239: Any MCP Server With Files - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-07
**Phase:** 239-any-mcp-server-with-files
**Areas discussed:** Tool Binding & Schema Discovery, Adapter Resolution & Registry Contract, MCP File Data Contract & Pagination, Connection Verdict & Catalog Honesty (BUG-260907-01)

---

## Tool Binding & Schema Discovery

| Option | Description | Selected |
|--------|-------------|----------|
| Connection config with auto-detection + UI picker | Stored in connector_connections.config['source_tools']. Auto-detect common patterns (e.g. list_directory/read_file) upon tool discovery, with explicit dropdown picker in connection settings to override or map custom tools. | ✓ |
| Watch-scoped binding | Stored on the watch row (migration 174 / connector_watches.config). Pick the listing and reading tool when creating the watch in CreateWatchModal. | |
| Strict schema heuristics only | Automatically infer tools by analyzing inputSchema (e.g. single string parameter 'path') without storing any extra configuration. | |

**User's choice:** Connection config with auto-detection + UI picker
**Notes:** Stored in existing `config` JSONB column (`config["source_tools"]`), satisfying "rows, not code" with zero breaking migrations.

---

## Adapter Resolution & Registry Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Protocol-level registration in SourceRegistry | Register McpSourceAdapter under service_id='mcp'. When get_adapter receives a connection, if exact service_id is not found but connection.auth_type == 'mcp' (or config has source_tools), it returns McpSourceAdapter(connection). 'mcp' is published in /source-families. | ✓ |
| Explicit service_id matching only | Every MCP file connection must use service_id='mcp' or 'custom_mcp'. Any other service_id requires registering an alias in code. | |
| Dedicated 'is_source' flag on connector_connections table | Add an explicit boolean or capability array to connector_connections indicating whether it acts as a source. | |

**User's choice:** Protocol-level registration in SourceRegistry
**Notes:** Protocol-level dispatch avoids hardcoding proprietary vendor names above `adapters/` and preserves `test_boundary_fence.py`.

---

## MCP File Data Contract & Pagination

| Option | Description | Selected |
|--------|-------------|----------|
| Flexible parser with content-hash version fallback | Support both structured JSON and standard text listings ([FILE]/[DIR]); read_file handles text content and base64 resources; if server does not supply modified_at timestamp, derive source_version from content hash/size so diffs stay deterministic. | ✓ |
| Strict JSON schema contract only | Require the MCP server tool to return a strict JSON array of objects with name, type, size, modified_at. Raise McpProtocolError if text format is returned. | |
| Flat listing only (no folder hierarchy) | Treat the MCP server as a single flat bucket of files without supporting nested browse/folder navigation. | |

**User's choice:** Flexible parser with content-hash version fallback
**Notes:** Accommodates varied MCP file tools across ecosystems, providing deterministic `source_version` diffing in `watch_service`.

---

## Connection Verdict & Catalog Honesty (BUG-260907-01)

| Option | Description | Selected |
|--------|-------------|----------|
| 'source-only' verdict with 'Ready as source' badge | Update connectionRowVerdict to accept isSourceCapable. When action tools == 0 but isSourceCapable === true, return verdict 'source-only' (styled with emerald/green checkmark like 'ready'). The detail panel copy explains that it provides file reading/watching for the Library without workflow action tools. Closes BUG-260907-01. | ✓ |
| Unified 'ready' verdict with sub-label | Return verdict 'ready' for both, but display a subtle sub-badge indicating whether it has action tools, source capability, or both. | |
| Separate source status column | Leave action tool verdict as-is and add a dedicated 'Source' column to the Connections table. | |

**User's choice:** 'source-only' verdict with 'Ready as source' badge
**Notes:** Closes `BUG-260907-01` by distinguishing legitimate source-only connections (like Microsoft 365 or MCP file servers) from broken action tool connections.

---

## Claude's Discretion

- Number of plans (3-4 target under G-8).
- Mock/test-double responses for MCP JSON-RPC in `test_source_adapter_conformance.py`.

## Deferred Ideas

- `SEED-256` (SharePoint document libraries in enterprise tenants).
- `SEED-013` (Open Platform / Inbound API).
- Delta change-notification sync for MCP servers.

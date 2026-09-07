# Phase 239: Any MCP Server With Files - Research

**Date:** 2026-09-07  
**Status:** Complete  
**Objective:** Document technical architecture, contracts, boundaries, and validation approach for MCP file server source integration (`SRC-04`) and `BUG-260907-01` resolution.

---

## 1. Executive Summary & Core Constraints

Phase 239 delivers **the MCP source adapter and tool binding mechanism** (`SRC-04`). It proves the milestone's thesis: **adding a source adds rows, not code**.
A user connects an MCP server that exposes file operations (e.g. `@modelcontextprotocol/server-filesystem` or custom servers), maps the tools as configuration data, previews folders, and watches them on a schedule using the shipped scheduler.

### The "Rows, Not Code" Invariant
- Tool-name variance (`list_directory` vs `list_files` vs `ls`, `read_file` vs `cat` vs `get_file_contents`) stays behind the adapter boundary and is stored as **data** in `connector_connections.config["source_tools"]`.
- The backend `SourceRegistry` resolves `McpSourceAdapter` at the **protocol level** (based on `auth_type == "mcp"` or `config["source_tools"]`), never branching on vendor names above `adapters/`.
- No new unmigrated table shape or breaking column is required — `source_tools` fits cleanly inside the existing `config` JSONB column.

---

## 2. Architecture & Seam Analysis

### 2.1 Egress and Protocol Boundary
- Outbound requests to remote MCP servers are handled exclusively through `McpClient.call_tool` and `McpClient.list_tools` in `backend/app/services/mcp_client.py`.
- Destination URLs are validated via `app.security.egress.validate_mcp_destination`, enforcing HTTPS (or loopback in dev) and guarding against SSRF (RFC1918, cloud metadata endpoints).
- Tool discovery sanitization in `mcp_client.list_tools` maintains an explicit allow-list: `name`, `description`, `inputSchema`, `title`, `outputSchema`, `annotations`. Untrusted server hints (`readOnlyHint`, annotations) may never widen a permission.

### 2.2 Model & Configuration Safe Handling (SEED-239)
- `McpConfig` in `backend/app/models/connector.py` uses `_StrictBase(extra='forbid')`.
- To prevent `ValidationError` on connection load (which broke all org connections in Phase 222), `McpConfig` must explicitly declare:
  ```python
  source_tools: dict[str, str] | None = None
  ```
  allowing keys like `list_tool` and `read_tool` to be validated and stored safely.

### 2.3 Adapter Contract (`SourceAdapter`)
`McpSourceAdapter` in `backend/app/services/sources/adapters/mcp_source.py` implements:
1. `browse(connection, folder_id=None, page_token=None) -> BrowsePage`:
   - Calls the configured `list_tool` with `{"path": folder_id or ""}`.
   - Parses results into `SourceNode(id=path, name=name, kind="folder", has_children=True, parent_id=folder_id)`.
2. `list_files(connection, folder_id=None, recursive=False, page_token=None, query=None, page_size=30) -> FilePage`:
   - Calls the configured `list_tool` with `{"path": folder_id or ""}`.
   - Parses output supporting structured JSON arrays (`name`, `path`, `type`/`is_directory`, `size`, `modified_at`/`mtime`) and line-based text listings (`[DIR] path/to/dir`, `[FILE] filename (1234 bytes)`).
   - Version key fallback: if `modified_at` is absent, computes `f"size:{size}"` or content sha256 to ensure `watch_service` diffing is deterministic.
3. `read_file(connection, file_id) -> tuple[str, bytes, str]`:
   - Calls the configured `read_tool` with `{"path": file_id}`.
   - Decodes `TextContent` (UTF-8 bytes) or base64 `EmbeddedResource`.
   - Returns `(filename, content_bytes, mime_type)`.
4. `check(connection) -> SourceHealth`:
   - Probes the server via `list_tools` or listing root. Returns `SourceHealth(ok=True)` or `SourceHealth(ok=False, error=...)`.

### 2.4 Registry Resolution (`SourceRegistry`)
- Registered with `@SourceRegistry.register("mcp")` and `@SourceRegistry.register("custom_mcp")`.
- In `SourceRegistry.get_adapter(connection_or_service_id)`:
  1. Exact check on `service_id` in `_adapters`.
  2. Protocol fallback: if missing and `conn.auth_type == "mcp"` or `config.get("source_tools")`: return `McpSourceAdapter()`.
- Boundary fence `backend/tests/unit/services/sources/test_boundary_fence.py` stays 100% green without any provider literals.

### 2.5 Catalog & Honesty (`BUG-260907-01`)
- `connectionRowVerdict({ toolCount, blockedApplicationCount, discoveryHasRun, isSourceCapable })`:
  - When `toolCount <= 0` and `isSourceCapable === true`, returns `"source-only"`.
- `ConnectionsTab.tsx` and `connectionsCopy.ts`:
  - Adds `source_only` to `ConnectionStateKind`.
  - Maps to `✓ Ready as source` with tone `text-success` (emerald checkmark).
  - Eliminates the misleading `⚠ Not usable` label on working OneDrive and MCP source connections.

---

## 3. Plan Decomposition Strategy (G-8 Budget: 3 Plans)

| Plan | Title | Wave | Dependencies | Scope |
|------|-------|------|--------------|-------|
| **239-01** | McpSourceAdapter backend implementation & conformance suite | Wave 1 | None | `mcp_source.py`, `base.py`, `models/connector.py`, `test_239_mcp_source_adapter.py`, `test_source_adapter_conformance.py`, `test_boundary_fence.py` |
| **239-02** | Tool binding auto-detection, discovery wiring & UI selector | Wave 2 | `239-01` | `connector_service.py`, `api/connectors.py`, `test_239_mcp_source_discovery.py`, `test_238_source_families_route.py`, `ConnectionFormPanel.tsx` |
| **239-03** | Honesty fix for BUG-260907-01 (Ready as source badge) | Wave 3 | `239-01`, `239-02` | `connectionRowVerdict.ts`, `connectionsCopy.ts`, `sourceCapability.ts`, `ConnectionsTab.tsx`, test suites |

---

## 4. Hot File Ledger & Gate Baselines

- Baseline backend unit tests: `71 failed, 4026 passed` (exact ceiling 71, zero headroom).
- Vitest count gate: 242/242 files, 7026 pinned, 7822 executed. Pre-existing flake in `WorkflowBuilderPage.session.test.tsx:676`.
- `docs/HOT-FILE-LEDGER.md` additions:
  - `backend/app/services/sources/adapters/mcp_source.py`: Add to scan list (0 / 0 / ~250, young).
  - `frontend/src/components/settings/connectionRowVerdict.ts`: Add to scan list (1 / 1 / 70, young).
  - Update commit/phase/line triples for modified hot files.

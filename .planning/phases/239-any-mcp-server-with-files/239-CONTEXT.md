# Phase 239: Any MCP Server With Files - Context

**Gathered:** 2026-09-07
**Status:** Ready for planning
**Role:** Builder: Gemini. Reviewer: Claude. Operator: All decisions and escalations.

<domain>
## Phase Boundary

Phase 239 delivers **the MCP source adapter and tool binding mechanism** (`SRC-04`) — a person connects any MCP server that exposes a file surface, points the product at a directory or folder it serves, previews it, and watches it on a schedule.

⭐ **THE "ADDING A SOURCE ADDS ROWS, NOT CODE" PROOF**:
Pitfall 12's fence, made observable. Adding an MCP file source adds **rows, not code** — a person can connect a second, completely different MCP file server afterwards with no product changes at all. MCP tool-name variance (`list_directory` vs `list_files` vs `ls`, `read_file` vs `cat`, etc.) stays behind the adapter boundary and is stored as **data** (in `connector_connections.config["source_tools"]`), never branched on in code.

### In scope
1. `backend/app/services/sources/adapters/mcp_source.py` — `McpSourceAdapter` implementing the standard `SourceAdapter` contract (`browse`, `list_files`, `read_file`, `check`) by delegating to `mcp_client.call_tool`.
2. Protocol-level resolution in `SourceRegistry` (`services/sources/base.py`) for `auth_type == "mcp"` connections without vendor-specific branching, strictly respecting the boundary fence.
3. Flexible tool result parsing: handling structured JSON entries and text line listings (`[FILE]` / `[DIR]`), and mapping text / base64 content.
4. Auto-detection of file tools upon discovery with explicit UI override picker in connection settings.
5. `GET /connectors/source-families` publishes `"mcp"`.
6. Honesty fix for **`BUG-260907-01`**: `connectionRowVerdict.ts` accepts `isSourceCapable` and yields `"source-only"` ("Ready as source") for connections with 0 action tools that are source-capable.
7. Conformance test suite updates: `McpSourceAdapter` joins the parametrized `test_source_adapter_conformance.py`.

### Out of scope
- ⛔ Modifying `mcp_client.py`'s core security boundary — the sanitizer allow-list is widened if needed, never removed or bypassed with a raw spread.
- ⛔ Using server-advertised hints (`readOnlyHint`, annotations) to grant permissions or bypass confirmation fences.
- ⛔ A second scheduler or broker — watches run on the shipped scheduler (`watch_service.py`).
- ⛔ Breaking schema migrations — tool bindings fit on `connector_connections.config` JSONB column. Reserved migration 174 is skipped/held unless dedicated columns are strictly required.

</domain>

<decisions>
## Implementation Decisions

### Tool Binding & Schema Discovery

- **D-239-01 — Tool binding stored as data in `connector_connections.config["source_tools"]`.**
  Tool bindings are stored per-connection as data:
  ```json
  {
    "source_tools": {
      "list_tool": "list_directory",
      "read_tool": "read_file"
    }
  }
  ```
  This satisfies the core constraint that tool-name variance is stored as **data**, never branched in code. Fits cleanly into the existing `config` JSONB column with zero breaking migrations.

- **D-239-02 — Auto-detection upon tool discovery with manual UI override.**
  When `discover_tools` runs on an MCP connection, the backend analyzes tool names and `inputSchema` to auto-populate default `source_tools` if file-like tools are found (e.g. tools matching `list_directory`, `list_files`, `read_file`, `get_file_contents`, or schemas accepting `path`/`directory`). A clean selector in `ConnectionFormPanel` / settings allows the user to inspect and explicitly map or override custom tool names.

### Adapter Resolution & Registry Contract

- **D-239-03 — Protocol-level registration in `SourceRegistry`.**
  `McpSourceAdapter` is registered with `@SourceRegistry.register("mcp")` and `@SourceRegistry.register("custom_mcp")`.
  In `SourceRegistry.get_adapter(connection_or_service_id)`:
  1. Check exact `service_id` match in `_adapters`.
  2. If no exact match, inspect `connection`: if `auth_type == "mcp"` or `config.get("source_tools")` is non-empty, resolve `McpSourceAdapter(connection)`.
  3. `SourceRegistry.list_supported_services()` includes `"mcp"`.
  This guarantees that arbitrary MCP servers resolve to `McpSourceAdapter` without any vendor-name branching above `adapters/`, keeping `test_boundary_fence.py` 100% green.

- **D-239-04 — Server publishes `mcp` in `/connectors/source-families`.**
  The endpoint `GET /connectors/source-families` dynamically includes `"mcp"`. The frontend `isSourceCapable(conn, families)` checks if `families.includes(conn.service_id)` or `(families.includes("mcp") && conn.auth_type === "mcp")`.

### MCP File Data Contract & Pagination

- **D-239-05 — Flexible tool output parser.**
  `McpSourceAdapter.list_files` and `browse` parse tool responses flexibly:
  - Structured JSON: parsed list of objects with fields `name`, `path`, `type`/`is_directory`, `size`, `modified_at`.
  - Line-based text: lines formatted like standard filesystem servers (e.g. `[DIR] path/to/dir`, `[FILE] filename (1234 bytes)`).
  Outputs map into standard `SourceNode(id, name, kind)` and `SourceFile(id, name, path, size, modified_at, mime_type)`.

- **D-239-06 — Deterministic `source_version` fallback when timestamps are absent.**
  If the MCP server's file listing provides `modified_at` or `mtime`, use it. If omitted, derive `source_version` deterministically from file content sha256 or item size so diffing in `watch_service` remains stable and reliable.

- **D-239-07 — `read_file` content handling.**
  `McpSourceAdapter.read_file` invokes `call_tool(read_tool, {"path": file_id})`:
  - Extracts text content from `result["content"]` where `type == "text"`.
  - Supports base64 embedded binary resources if returned by the server.
  - Returns `SourceFile` with decoded bytes and resolved MIME type.

### Connection Verdict & Catalog Honesty (BUG-260907-01)

- **D-239-08 — `connectionRowVerdict.ts` supports `"source-only"`.**
  Update `connectionRowVerdict.ts` to accept `isSourceCapable: boolean`:
  - When `toolCount > 0`: existing logic holds.
  - When `toolCount <= 0` AND `isSourceCapable === true`: returns verdict `"source-only"`.
  - When `toolCount <= 0` AND `isSourceCapable === false`: returns `"unusable"` (if discovery ran) or `"undiscovered"`.
  - In `ConnectionsTab.tsx` / `ConnectionCard.tsx`, `"source-only"` renders a green/emerald checkmark badge with label `"Ready as source"` and clear explanatory copy: *"Provides file browsing and watching for the Library."* Formally closes **`BUG-260907-01`**.

### Claude's Discretion
- Decomposition into 3-4 plans respecting G-8.
- Exact unit test double design for MCP JSON-RPC mock responses in `test_source_adapter_conformance.py`.
- Precision styling and icon choices for the "Ready as source" chip in Settings.

### Folded Bugs
- **BUG-260907-01**: *A working OneDrive source connection reads "⚠ Not usable" — the row verdict counts action tools and knows nothing about source capability*. Folded into Phase 239 via D-239-08.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The Source Contract & Registry
- `backend/app/services/sources/base.py` — `SourceAdapter`, `SourceRegistry`, `SourceNode`, `SourceFile`, `SourceListing`.
- `backend/app/services/sources/adapters/google_drive.py` & `microsoft_graph.py` — Reference implementations for `SourceAdapter`.
- `backend/tests/unit/services/sources/test_boundary_fence.py` — The strict boundary fence forbidding provider branching above `adapters/`.
- `backend/tests/unit/services/sources/test_source_adapter_conformance.py` — Parametrized conformance test suite that `McpSourceAdapter` must join.

### MCP Client & Egress
- `backend/app/services/mcp_client.py` — `McpClient`, `list_tools`, `call_tool`, allow-list sanitization, SSRF protection via `validate_mcp_destination`.
- `backend/app/models/connector.py` — `ConnectorConnection`, `ConnectorConfig`.

### Loop & Preview Consumers
- `backend/app/services/watch_service.py` — Resolves adapter via `SourceRegistry.get_adapter(conn)` and coordinates scheduled watch runs.
- `backend/app/services/sources/preview_service.py` — Resolves adapter to generate four-bucket preview.
- `backend/app/api/connectors.py` — `GET /connectors/source-families` publishing supported source families.

### Frontend UI & Honesty
- `frontend/src/components/settings/connectionRowVerdict.ts` — Verdict calculator requiring `isSourceCapable` input for `BUG-260907-01`.
- `frontend/src/components/sources/sourceCapability.ts` — Source capability resolver (`isSourceCapable`).
- `frontend/src/components/settings/ConnectionsTab.tsx` — Connection list and verdict chip rendering.

### Reported Bugs & Seeds
- `.planning/reported-bugs/BUG-260907-01-source-only-connection-reads-not-usable.md` — Folded bug.
- `.planning/seeds/SEED-177-mcp-connections-connect-and-be-connected.md` — MCP connection foundations.
- `.planning/seeds/SEED-239-one-malformed-config-row-makes-every-connection-in-the-org-unreadable.md` — Safe config handling.
- `.planning/ROADMAP.md` §"Phase 239: Any MCP Server With Files".

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mcp_client.call_tool` (`services/mcp_client.py`): Performs authenticated, SSRF-guarded JSON-RPC `tools/call` requests to remote MCP servers.
- `SourceRegistry` (`services/sources/base.py`): Canonical factory resolving adapters for connections.
- `sourceCapability.ts` (`frontend/src/components/sources/sourceCapability.ts`): Utility that resolves whether a connection is source-capable from server-published families.

### Established Patterns
- **Protocol vs Vendor**: MCP is an open transport protocol, not a proprietary vendor. Protocol-level dispatch based on `auth_type == "mcp"` or `config["source_tools"]` preserves the vendor-free fence in `base.py`.
- **Fail-closed Completeness**: `SourceListing(complete=True)` is set only when directory listing completes with zero errors.
- **Two-tier Identity**: Tier-1 comparison relies on `(source_system, external_id, source_version)`.

### Integration Points
- `backend/app/services/sources/adapters/mcp_source.py`: New adapter registering with `SourceRegistry`.
- `backend/app/services/sources/__init__.py`: Eager import of `mcp_source.py`.
- `backend/app/api/connectors.py`: Including `"mcp"` in `/source-families`.
- `frontend/src/components/settings/connectionRowVerdict.ts`: Integrating `isSourceCapable`.

</code_context>

<specifics>
## Specific Ideas

- Ensure standard MCP filesystem tool patterns (`@modelcontextprotocol/server-filesystem` tools `list_directory` and `read_file`) work out-of-the-box with zero manual configuration.
- Conformance test fake for MCP source should simulate realistic JSON-RPC `tools/call` exchanges for directory listing and file reading.
- Verify `check()` performs a lightweight probe (`list_tools` or calling the bound `list_tool` on root) and returns `SourceCheckVerdict(ok=True)`.

</specifics>

<deferred>
## Deferred Ideas

- **SharePoint Document Libraries** → `SEED-256` (deferred from Phase 238, awaiting tenant credentials).
- **Inbound / Open Platform** → `SEED-013` (public API / us-as-an-MCP-server in future milestone).
- **Delta Sync for MCP Files** → Requires MCP servers supporting file-watch notifications or delta streams. Standard polling handles all current servers.

### Reviewed Todos (not folded)
- `BUG-260907-02-custom-client-id-accepts-a-secret-into-a-readable-column`: Separate credential hardening issue for OAuth `custom_client_id`.
- `BUG-260905-01-cloud-import-lives-in-chat-and-dumps-into-library-root`: Separate chat-picker relocation issue.

</deferred>

---

*Phase: 239-any-mcp-server-with-files*
*Context gathered: 2026-09-07*

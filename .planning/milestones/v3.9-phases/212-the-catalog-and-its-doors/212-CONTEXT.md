# Phase 212: The Catalog and Its Doors - Context

**Gathered:** 2026-08-27
**Status:** Ready for planning
**Builder:** Gemini
**Reviewer:** Claude (`212-PREFLIGHT.md` before execution; mechanical gate & DRIVEN check after)

<domain>
## Phase Boundary

Phase 212 delivers the Connections Catalog and its creation/editing doors — so a person discovers and manages external services the way they browse an app directory: by brand mark, display name, and one-line purpose. Users can connect from a curated Popular row with one-click setup or by pasting an arbitrary Model Context Protocol (MCP) server URL with immediate tool discovery, on every deployment including cloud.

In scope:
- **CAT-01:** Browse connections as a searchable directory of services, each with its official mark, display name, and one-line purpose.
- **CAT-02:** Curated "Popular Services" row offering one-click configuration for premier integrations (Slack, Jira, SMTP/Email, GitHub, Google Workspace, Notion) as a presentation lookup over generic rows.
- **CAT-03:** Filter connections strictly on connection state (`All / Connected / Not connected`), completely eliminating legacy verb/capability filter chips.
- **CAT-05:** Parity for cloud deployments — seamless Add/Connect access, with honest platform-policy messaging and direct Control Room linking when `live_connectors` is disabled (`BUG-260810-01`).
- **CONN-06:** "Paste-a-URL" door for arbitrary MCP servers — interactive pre-save discovery preview, discovering tools, titles, descriptions, and schemas with zero codebase changes.
- **CONN-07:** Connection management lifecycle — view, edit (credentials/endpoints), and delete connections while preserving existing per-tool grant decisions across updates and re-discovery.
- **Egress & Safety Hardening (D-v2.5-01):** Threadpool DNS resolution (`run_in_threadpool(validate_mcp_destination)`), enforce HTTPS, prevent DNS-rebinding TOCTOU with pinned destination rewrite, bound response size, and provide structured, honest diagnostics on connection failures.
- **G-5 Refactoring on Hot Files:** Decouple catalog presentation definitions (`servicesCatalog.ts`, `catalogCopy.ts`) out of `ConnectionsTab.tsx` and `ConnectionFormPanel.tsx` to stop line ballooning and honour G-5 discipline.

Out of scope:
- Per-tool approval dialogs, runtime execution pauses, and audit receipts (Phase 213).
- Canvas workflow step action binding and argument satisfiability publishing gates (Phase 214).
- Custom BYO OAuth authorization code redirect flows and token lifecycle (Phase 215).
- Chat thread service attachment and mention invocation (Phase 216).
- Background or automatic connected-source file sync / ingestion (deferred to Connected Knowledge milestone).
</domain>

<decisions>
## Implementation Decisions

### Catalog Layout & Discovery Experience (CAT-01, CAT-02, CAT-03)
- **D-212-01: Unified Catalog & Connections View.** The Settings → Connections tab features a top curated "Popular Services" card row (Slack, Jira, SMTP/Email, GitHub, Google Workspace, Notion) with quick Connect buttons plus a dedicated "+ Custom MCP" card, directly above the searchable and filterable directory table of all services.
- **D-212-02: State Filtering Only (CAT-03).** Filter chips are strictly state-based (`All | Connected | Not connected`). No filter or browse axis describes what a connector does (e.g. no send/write/read verb chips).
- **D-212-03: Service Card Multi-Instance Aggregation.** Service cards in the directory aggregate multiple configured connections (e.g., "Prod Jira" and "Sandbox Jira") under the service identity (`service_id`), showing active status badges (e.g. "1 Connected", "2 Connected") with actions to edit existing instances or "Add another".
- **D-212-04: Presentation-Driven Catalog Lookup (D-211-02).** The catalog is an authored frontend presentation registry (`servicesCatalog.ts`) keyed by `service_id`. Unknown services or custom MCP URLs degrade gracefully to the neutral mark (`Plug`) and MCP icon — never a refusal, never a hidden row. Adding a new catalog service is a presentation definition, requiring zero database migrations.

### Custom MCP Server "Paste-a-URL" Door (CONN-06)
- **D-212-05: Interactive Pre-Save Discovery Probe.** In the Add / Edit connection panel for custom MCP servers, entering a server URL (and optional bearer token/headers) enables a live "Discover Tools" action. The backend probes the MCP endpoint (`POST /connectors/discover-tools`) and previews discovered tools, descriptions, and input schemas before saving.
- **D-212-06: Zero-Engineering Long-Tail Discovery.** Discovered tools are stored directly in `connector_connections.discovered_tools` (JSONB) with sanitized keys (`name`, `title`, `description`, `inputSchema`, `outputSchema`), requiring zero backend adapter code.

### Outbound Egress & DNS Hardening (D-v2.5-01)
- **D-212-07: Off-Event-Loop DNS Resolution.** In `backend/app/services/mcp_client.py::_send_jsonrpc`, wrap destination validation in `await run_in_threadpool(validate_mcp_destination, server_url)` to eliminate blocking DNS resolution on the asyncio event loop per D-v2.5-01.
- **D-212-08: Pinned Destination & TOCTOU Prevention.** Consume the `PinnedDestination` returned by validation to rewrite the transport host to the validated IP literal while preserving the `Host` header, preventing DNS-rebinding time-of-check-to-time-of-use attacks.
- **D-212-09: Transport Hardening.** Set `trust_env=False`, enforce HTTPS-only, set client timeouts, and bound maximum JSON-RPC response body decoding to prevent memory exhaustion from untrusted servers.
- **D-212-10: Honest Diagnostic Error Categorization.** Distinguish and report exact failure reasons in connection check / discovery results: SSRF / private IP refusal vs. TLS handshake failure vs. connection timeout vs. invalid JSON-RPC payload.

### Popular Service Setup & Cloud Parity (CAT-02, CAT-05, BUG-260810-01)
- **D-212-11: Curated Template Registry.** Popular services provide pre-configured credential forms (e.g., Slack bot tokens, Jira API tokens, SMTP credentials) with explicit help links, placeholder guidance, and starter prompt suggestions (CAT-04 prep).
- **D-212-12: Cloud Parity & Honest Disabled Guidance (BUG-260810-01).** When `live_connectors` is off (cloud cold default), the catalog renders normally in browse/inspection mode. A clear platform-policy banner explains that live sending is disabled, providing org admins a direct link to enable `live_connectors` in the Control Room. Add/Connect actions are consistently governed by `isOrgAdmin && liveConnectorsOn` with zero environment-dependent code divergence.

### Connection Lifecycle & Grant Preservation (CONN-07)
- **D-212-13: Key-Preserving Additive Grant Merge.** When updating a connection's credentials, endpoint, or refreshing discovered tools, existing per-tool grant decisions (`tool_grants: Record<string, boolean>`) are preserved untouched for all retained tool names. Newly discovered tools default to ungranted with clear visual badges. Obsolete tools no longer returned by the server are cleanly pruned.
- **D-212-14: Impact-Aware Deletion Sheet.** Deleting a connection triggers a confirmation sheet that checks `usageCounts` to list active workflows and steps currently depending on this connection, presenting a victim-naming destructive warning before removal.

### G-5 Hot-File Refactoring Strategy
- **D-212-15: Modular Presentation Extraction.** Extract catalog registry and copy definitions into dedicated modular files (`servicesCatalog.ts`, `catalogCopy.ts`) rather than expanding `ConnectionsTab.tsx` (1218 L) and `ConnectionFormPanel.tsx` (1889 L).
- **D-212-16: G-5 Ledger Alignment.** Re-derive and update the G-5 hot-file ledger rows and detail sections for `ConnectionsTab.tsx`, `ConnectionFormPanel.tsx`, `connectionsCopy.ts`, `connectionFormCopy.ts`, and add entries for `SettingsPage.tsx` and `ModelPillRow.tsx` per recorded triggers.

### Claude's Discretion
- Visual micro-interactions and transition animations for the Popular Services cards and tool discovery previews within the Aether Intelligence design system.
- Exact styling of tool schema inspector within the Add Connection panel.

### Folded Todos & Bugs
- **BUG-260810-01:** Settings → Connections shows no "Add connection" button on cloud. (Folded into CAT-05 / D-212-12).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Contract & Multi-Agent Governance
- `CLAUDE.md` — Project rules, G-5 hot-file scan rules, gate baselines.
- `AGENTS.md` — Multi-agent roles, bus protocol, and test rules.
- `.planning/phases/212-the-catalog-and-its-doors/212-MEASUREMENTS.md` — Pre-flight measurement pack captured on untouched tree (`43c95968`).

### Architecture & Prior Decisions
- `.planning/REQUIREMENTS.md` — v3.9 milestone requirements (`CAT-01`, `CAT-02`, `CAT-03`, `CAT-05`, `CONN-06`, `CONN-07`).
- `.planning/ROADMAP.md` — Phase 212 specification, flags, and dependencies.
- `.planning/phases/211-the-connection-is-a-service-not-a-verb/211-CONTEXT.md` — Service identity (`service_id`), static descriptors, and unified data shape.
- `supabase/migrations/127_connector_connection_service_identity.sql` — Database schema for service identity and check constraints.

### UI & IA Design References
- `screenshots/Screenshot 2026-08-24 202011.png` — Claude.ai Connectors catalog IA and Custom badge reference.
- `screenshots/Screenshot 2026-08-24 202036.png` — Claude.ai Plugins Directory long-tail catalog reference.
- `screenshots/Screenshot 2026-08-24 202044.png` — Claude.ai Connector detail and grant layout reference.
- `references/icon-convention.md` — Vendor mark rules, unplugin-icons usage, and ink contract (`self` / `fill` / `stroke`).

### Security & Egress Rules
- `backend/app/security/egress.py` — Destination validation, IP pinning, and threadpooled DNS pattern.
- `backend/app/services/mcp_client.py` — MCP client transport, tool discovery, and sanitizer allowlist.
</code_context>

<specifics>
## Specific Ideas
- Popular Services row includes prominent, beautifully branded cards with single-click Connect triggers.
- Discovered MCP tools list displays each tool's name, title, description, and an expandable parameter schema view.
- Egress error messages must never say "refused" for an unreachable host, nor "failed" for a policy refusal.
</specifics>

<deferred>
## Deferred Ideas
- Interactive OAuth authorization-code consent redirect flow (Phase 215).
- Runtime pause-and-ask approval modals for mutating tool calls (Phase 213).
- Starter prompt one-click chat execution (Phase 216 / CAT-04).
</deferred>

---

*Phase: 212-the-catalog-and-its-doors*
*Context gathered: 2026-08-27*

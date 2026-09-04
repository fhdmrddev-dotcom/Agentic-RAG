# Phase 212: The Catalog and Its Doors - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-27
**Phase:** 212-the-catalog-and-its-doors
**Areas discussed:** Catalog Layout & Discovery Experience, Custom MCP Server "Paste-a-URL" Door, Popular Service One-Click Setup & Cloud Parity, Connection Editing & Grant Preservation

---

## Catalog Layout & Discovery Experience (CAT-01, CAT-02, CAT-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Unified Catalog & Connections View | Top section displays a curated "Popular Services" card row (Slack, Jira, SMTP, GitHub, etc.) with quick Connect buttons and "+ Custom MCP", followed below by the full searchable & filterable directory/table with state chips (All / Connected / Not connected) and connection badges. | ✓ |
| Two-Tab Split | Sub-tabs within Connections for "Discover Services" (the catalog) and "My Connections" (installed/active instances). | |
| Modal Catalog Drawer | Main view stays an active connections table; clicking "+ Add Connection" opens a full-screen catalog drawer modeled after Claude.ai's Connectors directory. | |

**User's choice:** Unified Catalog & Connections View
**Notes:** Provides a cohesive single-pane experience without hiding active connections behind sub-tabs or modal drawers.

### Multi-Instance Services
| Option | Description | Selected |
|--------|-------------|----------|
| Service Card Aggregation | The catalog card for a service shows an active badge (e.g., "1 Connected" or "2 Connected") and provides both an "Add another" action and links to edit existing instances. | ✓ |
| Flat Connection Entries | Each configured instance appears as its own card/row directly in the directory alongside unconnected catalog presets. | |

**User's choice:** Service Card Aggregation

---

## Custom MCP Server "Paste-a-URL" Door (CONN-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Interactive Pre-Save Discovery | Typing/pasting the MCP server URL (and optional auth) lets the user click "Discover Tools" to immediately probe the server and preview the full list of discovered tools, descriptions, and input schemas before saving. | ✓ |
| Save-Then-Discover | The user enters the name and URL and clicks Save; discovery runs as part of the initial connection save and check. | |

**User's choice:** Interactive Pre-Save Discovery
**Notes:** Ensures user can inspect tool schemas and verify live capabilities before committing the connection.

### Egress Hardening & Diagnostics
| Option | Description | Selected |
|--------|-------------|----------|
| Hardened Security & Honest Error Reporting | Run DNS validation off event-loop via run_in_threadpool (D-v2.5-01), enforce HTTPS, prevent DNS-rebinding TOCTOU with pinned destination, bound response size, and show distinct error diagnostics (SSRF refusal vs. unreachable host vs. invalid JSON-RPC payload). | ✓ |
| Basic Threadpooled Validation | Wrap DNS in run_in_threadpool (D-v2.5-01) and enforce HTTPS without pinned IP rewrite or custom error classifications. | |

**User's choice:** Hardened Security & Honest Error Reporting

---

## Popular Service One-Click Setup & Cloud Parity (CAT-02, CAT-05, BUG-260810-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Curated Popular Registry (Slack, Jira, SMTP/Email, GitHub, Google Workspace, Notion) | Pre-configured templates with brand icons, accurate field guidelines/links, and starter prompts, designed so adding any new service is just a presentation entry without migrations. | ✓ |
| Legacy 3 Only (Slack, Jira, SMTP) + Generic MCP | Restrict the popular row strictly to the three built-in adapters plus custom MCP card. | |

**User's choice:** Curated Popular Registry (Slack, Jira, SMTP/Email, GitHub, Google Workspace, Notion)

### Cloud Parity & live_connectors State
| Option | Description | Selected |
|--------|-------------|----------|
| Honest Non-Admin & Platform-Off Guidance | If live_connectors is off (cloud cold default), show the clear platform policy banner with direct navigation to the Control Room switch (for org admins) and clear explanation for members, with zero environment-dependent code branching. | ✓ |
| Inline Read-Only Mode | Show connection cards with disabled Connect buttons and tooltip explanation when live_connectors is disabled. | |

**User's choice:** Honest Non-Admin & Platform-Off Guidance (closes BUG-260810-01)

---

## Connection Editing & Grant Preservation (CONN-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Key-Preserving Additive Merge | Existing grant/denial states for known tools are preserved exactly across edits or tool re-discoveries; newly discovered tools appear in default ungranted state; obsolete tools are cleanly removed; and changes are clearly indicated in the UI. | ✓ |
| Grant Reset | Editing endpoint or re-discovering tools resets all per-tool grants to default unconfigured state. | |

**User's choice:** Key-Preserving Additive Merge

### Connection Deletion
| Option | Description | Selected |
|--------|-------------|----------|
| Impact-Aware Deletion Modal | Deleting a connection shows a victim-naming confirmation sheet listing all workflows and steps referencing this connection (via usageCounts) with clear destructive warnings. | ✓ |
| Simple Confirmation Alert | Standard confirmation dialog asking "Are you sure you want to delete this connection?". | |

**User's choice:** Impact-Aware Deletion Modal

---

## Claude's Discretion

- Micro-animations and transition styling for Popular Services cards in accordance with Aether Intelligence guidelines.
- Specific layout of tool input schema properties viewer in the discovery preview.

## Deferred Ideas

- Interactive BYO OAuth redirect flow (Phase 215).
- Per-tool approval modal / pause-and-ask workflow gates (Phase 213).
- One-click starter prompts executing directly in chat (Phase 216 / CAT-04).

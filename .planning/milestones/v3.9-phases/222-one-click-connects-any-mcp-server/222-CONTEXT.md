# Phase 222 — One Click Connects Any MCP Server · CONTEXT

**Opened** 2026-09-01. **Milestone** v3.9 Connections: Any Service, Any Tool.
**Status:** In Progress (The Door Half).

---

## The one sentence

> A person adds any MCP server (curated like Notion or custom by URL), the door dynamically probes and branches strictly on its `kind` (`open`, `oauth`, `token`, `unreachable`), and OAuth connects through a direct user gesture (`window.open`) with dynamic client registration or BYO credentials, without requiring a token minted by hand in somebody else's console.

---

## Measured facts this phase is built on

Every figure below was measured against the live stack on 2026-09-01, not reasoned about.

- ✅ **The Crypto half is complete, pushed (`7b009d685`), and proven live against Notion.**
  `POST /connectors/mcp/probe-auth`, `POST /connectors/mcp/oauth/authorize`, and `GET /connectors/mcp/oauth/callback` are committed and live. Notion returns 41 tools for zero lines of tool code.

- ✅ **The Wire Contract is frozen and binding (`BUS-047` / `BUS-049`):**
  - `POST /connectors/mcp/probe-auth` takes `{ server_url: string }` and returns `{ kind, authorization_host, registration_required, code_challenge_methods, detail, resource_status }`.
  - `kind` is `'open' | 'oauth' | 'token' | 'unreachable'` and is **the only field to branch on**.
  - `authorization_host` is a bare host (`accounts.notion.com`) used to name the sign-in destination before the user commits.
  - `registration_required` is a boolean deciding whether the form collects client credentials (`false` = RFC 7591 dynamic client registration; `true` = collect via Phase 215 BYO fields).
  - `code_challenge_methods` is a string array (e.g. `['S256']`); empty array is permitted and is not an error.
  - `detail` is a human sentence populated for `token` and `unreachable`; rendered verbatim.
  - Egress refusals return HTTP 400 with closed reason codes (`address_not_public`, `scheme_not_tls`, `host_not_allowed`, `host_not_ascii`, `unresolvable`, `redirected`).

- ✅ **`POST /connectors/mcp/oauth/authorize` takes `{ connection_id }` only** (`extra='forbid'`).
  Re-discovers endpoints server-side to ensure no untrusted endpoints are submitted from the browser. Returns `{ authorize_url, authorization_host }`.

- ✅ **`GET /connectors/mcp/oauth/callback` is the return leg.**
  Carries no auth dependency; redirects to `{frontend_url}/?connections=1&oauth_connected=1` or `&oauth_error=<code>`.

- ⚠ **`window.open` is popup-blocked without a user gesture.**
  The OAuth consent window must be opened directly within a click event handler (e.g., opening a window reference or immediate navigation), not after detached async delays.

- ⚠ **Grants Seeding Rule (`BUS-051`):**
  Discovered tools must not be seeded with boolean `true`. Newly discovered tools inherit the connection default posture via absence of a key. Posture vocabulary is strictly `ToolGrantPosture` (`'allow' | 'ask' | 'deny'`).

- ⚠ **Connections is its own page (`frontend/src/pages/ConnectionsPage.tsx`).**
  Commit `3d0c40280` retired the Settings Connections tab and routing key `'5'`. The catalog entry and connect flow live on `ConnectionsPage.tsx`.

- ⚠ **Integration Test Requirement (`AGENTS.md` §3.1):**
  As a split phase, Phase 222 owes a blocking integration test that mocks NEITHER side (testing the join between door client, probe-auth, authorize route, and tool discovery).

---

## Locked Decisions (Door Half)

### D-222-01 · Strict Branching on `kind`
The UI branches exclusively on `kind` (`'open' | 'oauth' | 'token' | 'unreachable'`). No heuristic or string inspection on the URL or response determines the auth door.

### D-222-02 · Probe Trigger on Valid URL
For custom MCP URLs in `ConnectionFormPanel.tsx`, probing `POST /connectors/mcp/probe-auth` triggers automatically with debouncing when a valid URL is entered (and on blur), displaying an inline probing state (`Checking server authentication...`).

### D-222-03 · `kind: open` Presentation
Displays a clean notification that no credentials are required, with an immediate "Connect [Service]" button that discovers tools and persists the connection.

### D-222-04 · `kind: oauth` with DCR vs. BYO
- Identifies the sign-in host clearly: *"Sign in required with {authorization_host}"*.
- If `registration_required === false` (RFC 7591 DCR): Renders a single prominent "Sign in with {authorization_host}" button without credential inputs.
- If `registration_required === true` (BYO): Renders Phase 215 client ID and client secret inputs before the Authorize button.

### D-222-05 · `kind: token` Fallback
Displays the backend `detail` sentence verbatim (e.g. explaining that no AS was advertised) and provides the standard token/secret input field, preserving full backwards compatibility.

### D-222-06 · Egress Refusals and Unreachable Errors
Egress HTTP 400 errors and `kind: unreachable` render an explicit warning alert using the closed refusal reason or `detail` sentence. Form submission is disabled until a valid, reachable URL is provided.

### D-222-07 · Catalog Entry & Popular Services
In `servicesCatalog.ts` and `ConnectionsPage.tsx`:
- Curated MCP services (such as Notion) have their preset server URLs configured so selecting them immediately initiates probe/OAuth without manual URL entry.
- The Custom MCP tile allows pasting any URL and dynamically adapts to the probed auth shape.

### D-222-08 · G-2 Sketch Scope
The sketch covers the 5 in-app door states of the connect panel (`probing`, `open`, `oauth-dcr`, `oauth-byo`, `token/refusal`), explicitly excluding third-party vendor consent screens.

### D-222-09 · Cross-Plan Integration Test
An integration test verifying the full join between door API callers, probe response dispatch, OAuth flow state handling, and connection tool resolution without mocking either side.

# Feature Research

**Domain:** Remote MCP server, personal MCP keys, OAuth sign-in, outbound webhooks and outside-traffic guardrails, added to a mature multi-tenant RAG agent platform (Syrel, milestone v4.9 "Use It From Your Own Tools")
**Researched:** 2026-10-30
**Confidence:** HIGH for the client-side facts (Claude connector, Claude Code and Cursor docs, MCP spec changelogs, Stripe and Standard Webhooks docs, all read directly). MEDIUM for competitor admin UX (vendor docs, partly through search summaries). LOW for PII-redaction market expectations and ChatGPT `search`/`fetch` naming (secondary sources only).

> Scope: only the five new capability areas. The Word-template bug (`BUG-261022-01`) is a defect fix, not a feature, and is left out.

---

## Five findings that change scope

1. **Personal keys alone do NOT reach Claude.ai or Claude Desktop for most users.** On Claude's hosted apps (claude.ai, Desktop, mobile, Cowork), a fixed bearer credential is only possible through "Request headers". That option is **beta, limited to some organizations, and entered by an organization Owner as a credential shared by the whole org**. Anthropic says outright: *"don't use it to identify which user is calling. If your tools need to act as the individual user, use OAuth."* Personal keys therefore cover **Claude Code, Cursor, VS Code, Codex and n8n** (anything with a `headers` config). **Claude.ai and Claude Desktop need the OAuth phase.** The milestone goal lists Claude Desktop beside keys, so the roadmap has to say this out loud. A stop-gap is an `npx mcp-remote <url> --header ...` stdio bridge snippet for Desktop. It works, but it is a developer workaround and should not be sold as "Desktop support". (HIGH: claude.com/docs/connectors/building/authentication.md, add-unlisted.md)

2. **Hard per-call ceilings decide how "ask the agent" and "run a workflow" must behave.** Claude.ai and Desktop cap one tool call at **240 s** and a result at **about 150,000 characters**. Claude Code caps output at **25,000 tokens** by default and **aborts a call that sends nothing for 5 minutes** (HTTP). Claude says it does **not support "advanced or draft capabilities"**, and MCP *tasks* were experimental in 2025-11-25 and moved to an optional extension in 2026-07-28. **So no task-based design can be relied on.** The portable pattern, used by n8n and Syrel's own Phase 293 `/inbound`, is **start, return a handle, then poll with a tool**. (HIGH)

3. **The MCP spec moved under us.** The current revision (**2026-07-28**) removes protocol sessions and `Mcp-Session-Id`, removes the `initialize` handshake, removes SSE resumability, moves tasks to an extension, and **deprecates DCR in favour of Client ID Metadata Documents (CIMD)**. Claude's OAuth client still follows the **2025-03-26 / 2025-06-18 / 2025-11-25** authorization specs and uses CIMD *only if* the AS advertises it, otherwise DCR. **Build stateless (no reliance on session ids) and support both DCR and CIMD.** This also fits the multi-worker uvicorn default, where a session id would need sticky routing. (HIGH: modelcontextprotocol.io/specification/latest/changelog)

4. **The market has settled on small, read-heavy, admin-curatable tool sets.** Glean warns *against one server with all tools enabled* because it hurts tool-selection accuracy and hits host limits. GitHub exposes toolsets plus a read-only path or header. Linear has `/mcp/readonly`. Supabase has `read_only`, `project_ref` and `features=`. Sentry scopes by URL path. Stripe folds a whole API into `api_read` / `api_write`. Claude's directory **rejects** mixed read/write tools and requires `title` plus `readOnlyHint` or `destructiveHint` on every tool. Those annotations drive Claude's auto-permission: read-only tools run without a prompt, destructive ones always prompt. (HIGH/MEDIUM)

5. **Webhooks have a de-facto standard: Standard Webhooks.** The headers are `webhook-id`, `webhook-timestamp` and `webhook-signature`. The signature is HMAC-SHA256 over `id.timestamp.body` with a `whsec_` secret. Rotation sends multiple signatures at once. Only 2xx counts as success, redirects are never followed, a 410 disables the endpoint, and retries back off over days. Expected management UX comes from Stripe (Event deliveries tab, Resend for up to 15 days, Roll secret with up to 24 h overlap, 3-day retries) and Svix (8 attempts over about 27 h, auto-disable after 5 days of failure, Recover-failed-since-date). **Signing a different way is a self-inflicted anti-feature.** (HIGH)

---

## Feature Landscape

### A. Remote MCP server: tools and call behaviour

#### Table Stakes

| Feature | Why Expected | Complexity | Notes / existing dependency |
|---|---|---|---|
| **Streamable HTTP endpoint at a stable URL** (e.g. `https://<host>/mcp`) | Every product studied (Linear, Sentry, Stripe, Supabase, Glean, Notion) is "paste a URL". SSE is deprecated. | MEDIUM | Mounts in FastAPI via the official Python SDK. **Stateless mode** (no session affinity) is required by the multi-worker default and by spec 2026-07-28. Must answer 403 on a bad `Origin`. |
| **`search_knowledge_base`**: query, optional folder filter, top-k; returns ranked chunks with document title, id, app link and score | The core reason anyone connects a RAG product (Glean's defaults are search, chat and read_document) | LOW-MED | Reuses `retrieval_service` / `search_documents_tool` `folder_ids`. Must apply the **caller's visibility AND the key's folder narrowing as an intersection, never a union**. `readOnlyHint: true`. |
| **`list_documents` / `read_document`** (or one `fetch` by id) with pagination and an offset or page on long text | Clients cannot read what they cannot list. Results must fit the 150k-char / 25k-token ceilings. | LOW-MED | Cursor-paginated list. `read_document` returns extracted text in pages and states the total. Original file through a one-time link (Phase 293 already mints file links). `readOnlyHint: true`. |
| **`ask_agent`**: question, optional folders, optional conversation handle; returns answer text, numbered citations, **response-level confidence** (`level`, `avg_similarity`, `disclaimer`) and a link to open the thread in Syrel | It is the product's core value. SEED-013 names confidence as *the* field external callers branch on. | HIGH | **Internal deadline below 240 s** (target about 180 s). Send `notifications/progress` when the client passed a `progressToken`, which also keeps Claude Code's 5-min idle timer alive. On deadline, return `status: running` + `run_id` + "call `get_answer`" instead of failing. Agent toolset for MCP turns should be **retrieval/read only**: no sandbox, no connector writes, no `ask_user` (nobody can answer it; degrade to returning the question as text). Thread recorded with an `origin` of MCP so it is legible in the app (the Phase 293 `origin_kind` pattern). |
| **`list_workflows`** (published workflows the caller may run, with input schema) | `run_workflow` is unusable if the model cannot discover names and inputs. n8n's MCP needs the same discovery step. | LOW | Reads published definitions, filtered by visibility and by the key's tool/workflow narrowing. `readOnlyHint: true`. |
| **`run_workflow`** returns `run_id` immediately; **`get_workflow_run`** returns status, step position, final output, evidence summary, file links, and "waiting on <person>" with an app link | Workflows run for minutes. Start-and-poll is the portable pattern (n8n `execute_workflow` + `get_workflow_execution`; Phase 293 `/inbound` POST + GET). | MEDIUM | Reuses `workflow_kickoff`, the inbound start path, run evidence (289) and v4.8 `/app/...` run links. `run_workflow` is **not** read-only, so it carries `destructiveHint` or omits `readOnlyHint` and the client prompts. Origin recorded as MCP + key/connection label. |
| **Tool annotations on every tool** (`title`, `readOnlyHint` / `destructiveHint`, `openWorldHint:false`) | They drive Claude's auto-approval. Directory review requires them. | LOW | Mechanical, but missing them means every read prompts the user. |
| **Short, factual tool descriptions with no behavioural instructions** | Claude review rejects descriptions that steer the model. Long descriptions bloat every client's context. | LOW | Target ≤ 2 sentences + parameter docs. Deterministic `tools/list` order (spec 2026-07-28 SHOULD, which also helps prompt-cache hits). |
| **Errors as tool results (`isError: true`) with actionable text**, not protocol errors | Spec 2025-11-25 (SEP-1303) says so, so the model can self-correct. Claude review fails generic "Bad Request". | LOW | Covers rate-limited, folder not visible, workflow not found, MCP disabled by admin, provider capacity. Each needs a plain sentence. |
| **Bounded result sizes** | Above about 150k chars (claude.ai) or 25k tokens (Claude Code) the result is truncated or spilled to a file | LOW | Hard cap per tool, with a "results truncated, page with `cursor`" sentence. |
| **Every MCP call leaves an audit row and appears in run/thread history** | Atlassian, Stripe ("MCP tool call logs in Workbench") and Glean all expose this. SEED-195: *"An inbound run must appear in the run log like any other."* | LOW-MED | `audit_log_action_type_check` lockstep pattern from mig 215. New origin kind for workflow runs and threads. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| **Grounded answers that carry citations + confidence as `structuredContent`** (plus readable text) | No studied competitor returns a machine-branchable confidence verdict. Lets n8n/agents choose auto-reply or escalate (SEED-013's triage case). | LOW (fields exist on `messages`) | `outputSchema` declared. Response-level only; per-claim confidence stays out of scope. |
| **"Open in Syrel" deep link on every answer, run and document** | Moves the user from their tool back to the evidence. Uses v4.8 links that survive sign-in and org switch. | LOW | Unique advantage from v4.8. |
| **`ask_agent` with an Expert parameter** (answer as the "Legal" Expert, scoped to its bundle) | Turns Experts (the SKU) into something sellable outside the app | MEDIUM | Expert scope already intersects retrieval (Phase 279 `expert_scope`). Optional in v1. **P2.** |
| **Conversation continuity by a server-minted handle** (`conversation_id` returned, passed back) | Follow-up questions without resending history. Matches spec 2026-07-28's "explicit server-minted handles as tool args". | MEDIUM | Stateless per call. History stored by us (the stateless-completions rule). The handle must be bound to the caller and refused for anyone else. |
| **A run that waits on a person is legible through MCP** ("waiting on Dana for approval: <link>"), with the v4.8 notice + email already firing | Competitors mostly fail or hang. Syrel already has the waiting-run notification system. | LOW | Reads 300/301 state. **Do not** answer the person's question over MCP in v1. |
| **ChatGPT-compatible `search` + `fetch` pair** | ChatGPT's deep-research / company-knowledge path reportedly calls only tools named `search` and `fetch` | LOW | LOW confidence (secondary sources). Could be aliases of the two read tools. Verify against OpenAI docs before committing. **P3.** |
| **MCP Apps / interactive UI** (render a v4.5 artifact inside Claude) | Visual answers inside Claude | HIGH | Claude supports MCP Apps. Defer. |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| **Expose every internal capability as a tool** (execute_code, skills, connectors, folder CRUD, settings) | "Everything in Syrel over MCP" | Tool-selection accuracy drops (Glean's explicit warning). Context bloats in every client. Each write tool is unattended blast radius (SEED-195: an inbound surface removes the human from the loop). Breaks the Extension Contract's closed-core spirit. | 6-7 tools: search, list/read documents, ask, list/run/get workflow. Grow by evidence. |
| **Catch-all `api_request` tool, or one tool that both reads and writes** | Saves tool slots | Rejected by Claude's directory review. Defeats read-only auto-approval. | Separate read and write tools. |
| **Blocking `run_workflow` until done** | Simpler for the model | Dies at 240 s on claude.ai; multi-minute runs are normal. Ties a worker per call. | Start + poll (`get_workflow_run`). |
| **Relying on MCP tasks, sampling, elicitation or resource subscriptions** | Spec-native long-running / human-input story | Claude says it does not support subscriptions, sampling or draft capabilities. Tasks were redesigned and moved to an extension in 2026-07-28. Elicitation semantics changed (MRTR). | Polling tools now. Revisit tasks when a target client ships them. |
| **Agent `ask_user` / HITL answered through the MCP call** | Workflows that pause for a person | No reliable cross-client way to ask mid-call. A model answering on the person's behalf defeats the approval gate. | Report "waiting on <person> + link". The person answers in the app; v4.8 notifies them. |
| **Exposing documents as MCP *resources* as the primary read path** | Spec-native | Resources are app-controlled, not model-controlled. Many clients surface them poorly. Claude has no subscriptions. | Tools for reads. Resources optional later. |
| **Tool descriptions with usage instructions** ("always call search first…") | Steer the model | Directory rejection and prompt-injection pattern. Bloats context. | Facts only. |
| **Session-based state on the MCP endpoint** | SDK default in older versions | Sessions are removed in spec 2026-07-28. Breaks under 2 uvicorn workers without sticky routing. Session hijack class. | Stateless mode. Auth on every request. |

---

### B. Personal MCP keys and the connection-management page

#### Table Stakes

| Feature | Why Expected | Complexity | Notes / existing dependency |
|---|---|---|---|
| **Any member can mint a key; the secret is shown once; only a hash is stored; a prefix is shown for identification** | Universal (Stripe, Linear, Zapier "shown once", GitHub PATs). Already the Phase 293 pattern. | LOW | Reuses mig 215 `api_keys` design and `ApiKeySecretOnce.tsx`. ⚠ **mig 215 requires `workflows` to hold ≥ 1 entry (CHECK)**, so an MCP key either needs a `kind` column with a relaxed CHECK, or a sibling table. That is a requirements decision; both are cheap. Use a distinct prefix (e.g. `srl_mcp_`) so a leaked key is identifiable and scannable. |
| **The key acts as the member, sees only what they see, and re-checks membership/revocation/expiry on every call** | Atlassian: *"MCP actions respect the user's existing permissions."* Supabase warns its PAT runs with full developer permissions, which is the failure to avoid. | MEDIUM | Phase 293 re-checks revocation, expiry and membership per call. Retrieval must run **as the member** (RLS-equivalent), not as service role with a filter bolted on. That service-role-only blind spot is the BUG-260911-01 class. |
| **Bound to one org** | A key reading another org is a customer-loss event (SEED-013) | LOW | 293 pattern: one member, one org. |
| **Optional narrowing: folder set, tool subset, read-only preset** | GitHub toolsets/readonly, Linear `/readonly`, Supabase `features`/`read_only`, Glean per-server tool choice | MEDIUM | Store narrowing **on the key, server-side**, never in user-editable URL params. **Narrowing can only shrink**: effective folders = member-visible ∩ key folders, re-evaluated per call so a lost folder grant takes effect at once. |
| **Key list: label, prefix, scope chips (folders, tools), created, last used, expiry, Revoke** | Standard settings-page shape (GitHub, Stripe, Linear, Zapier "Rotate secret") | LOW | Reuses `ApiKeyCard`, `RevokeApiKeySheet`, `ApiKeyActivity`. "Last used" is cheap (`last_used_at` already exists). |
| **Copy-paste connection snippets per client** | Every vendor ships them (Stripe, Supabase, Linear, Sentry) | LOW | Minimum set, each with the key as an **env-var reference, not inline**: Claude Code `claude mcp add --transport http syrel <url> --header "Authorization: Bearer $SYREL_MCP_KEY"` plus the `.mcp.json` form using `${SYREL_MCP_KEY}`; Cursor `mcp.json` with `${env:SYREL_MCP_KEY}`; VS Code `.vscode/mcp.json`; Codex `bearer_token_env_var`; a generic `{url, headers}`; Claude Desktop via the `mcp-remote` bridge (labelled as a workaround until OAuth). Reuse the `curlExamples.ts` pattern. |
| **Org-admin kill switch: MCP off for this org**, effective on the next call | Stripe ("enable or disable MCP access for your entire team"), Atlassian (API-token toggle), Notion Enterprise client allowlist | LOW | `app_settings`/org setting plus a check on every call. Fits the Control Room capability grid (146-148). A switched-off call returns a plain tool error naming the admin action. |
| **Admin view of every member's keys/connections with revoke** | Stripe admin "OAuth sessions… Revoke all"; Notion Admin API lists and revokes member connections | LOW-MED | Phase 293 D-04 already has an admin listing route for API keys. |
| **Per-key rate limits, audited refusals** | 293 ships them for `/inbound` | LOW | Extends `rate_limit.py`. Separate buckets for `ask_agent` / `run_workflow` (expensive) and reads (cheap). |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| **"Test this key" button**: runs one search as the key and shows exactly what it can see (folder count, tools) | Ends "why can't Claude see my doc" support loops. Makes narrowing visible. | LOW | |
| **Recent calls per key** (tool, time, outcome, refused reason) | Stripe Workbench MCP logs; Syrel already has `ApiKeyActivity` | LOW | Audit-row read. |
| **Expiry presets with a nudge before expiry** (in-app notice) | Safer default than never-expiring | LOW | Reuses the 300/301 notification system. |
| **Scoped preset templates** ("Read-only research", "Run workflows") | One click instead of a matrix | LOW | |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| **Narrowing through URL query params or path segments** (Supabase/GitHub style) | Easy to compose; works in clients without config UI | The holder of the URL can edit it to widen scope. That is safe only when the server re-validates against a stored ceiling. Two sources of truth. | Narrowing lives on the key. If a URL variant is ever offered, it may only narrow further below the key's ceiling. |
| **Key embedded in the URL** (`?token=`, Zapier-style secret URL) | Works in clients that cannot set headers | The MCP spec prohibits tokens in the query string. URLs leak into logs, proxies and history. Claude's docs say never accept it. | Bearer header now, OAuth for header-less clients. |
| **Org-shared / service-account MCP keys in v1** | One key for a team bot | Breaks "sees only what the member sees". Nobody to attribute. Claude's static-header model is exactly this and Anthropic warns against identifying users with it. | Personal keys only. A service account is a later decision with its own security review (SEED-013). |
| **Keys that can widen beyond the member** (admin-granted extra folders) | Convenience | Breaks the core invariant | Never. |
| **Inline secret in generated config snippets** | Fewer steps | Ends up committed in `.mcp.json` | Env-var reference in every snippet (Stripe and Claude Code docs do this). |

---

### C. OAuth 2.1 sign-in for MCP (Claude.ai custom connectors)

#### Table Stakes

What Claude's client requires, read from Anthropic's connector docs. Missing any one means "Couldn't reach the MCP server" or "Authorization failed".

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| **401 + `WWW-Authenticate: Bearer resource_metadata="…"` on unauthenticated calls** | Claude starts sign-in only on a 401 and ignores the header on a 200 | LOW | |
| **Protected Resource Metadata (RFC 9728)** whose `resource` exactly equals the URL the user pastes; primary issuer **first** in `authorization_servers` | Claude uses only the first entry and does not fall back | LOW | |
| **AS metadata (RFC 8414 or OIDC discovery)** reachable from Anthropic's egress `160.79.104.0/21`; `code_challenge_methods_supported: ["S256"]` | Discovery fails silently otherwise; a WAF in front of the IdP breaks it | LOW-MED | Cloud deploy parity item (Coolify/Vercel routing of `/.well-known/*`). |
| **Authorization code + PKCE S256** | Required by spec and by Claude | MED | |
| **Client registration: DCR now, CIMD as well** | Claude uses CIMD only if the AS advertises `client_id_metadata_document_supported: true` **and** `none` in `token_endpoint_auth_methods_supported`, otherwise DCR. DCR is deprecated in spec 2026-07-28. | MED | Support both. DCR creates a client per connection, so plan cleanup. |
| **Redirects: exactly `https://claude.ai/api/mcp/auth_callback` + loopback any-port for `localhost` and `127.0.0.1`** (Claude Code, Cursor) | Claude docs. Anthropic says the hosted callback may move to `claude.com`, so allow both. | LOW | Exact-match registered URIs; port-agnostic loopback only. |
| **Refresh tokens with rotation; `invalid_grant` on dead refresh; form-urlencoded token endpoint** | Claude refreshes on 401 and up to 5 min before expiry. Public clients must rotate. | MED | |
| **OAuth endpoints respond in < 10 s (refresh < 30 s)** | Claude fails the flow otherwise | LOW | No slow DB fan-out on `/token`. |
| **A consent screen we own**: client name, **redirect host shown**, what it can do, **which org**, Approve/Deny; anti-framing and CSRF `state` | MCP security best practices MUST list (confused-deputy mitigation). Supabase MCP and Stripe both have the user pick the org/account at consent. | MED | If Supabase Auth's OAuth 2.1 server is used (public beta since 2025-11-26), **the consent UI is ours to build** and Supabase supplies approve/deny. Extra warning when only loopback redirects are registered. |
| **Tokens are audience-bound to our MCP resource; no token passthrough** | Spec MUST NOT accept tokens not issued for this server | MED | The MCP server must never accept a raw app session JWT as an MCP token. |
| **"Connected apps" list: client, org, granted scope, last used, Revoke; admin "revoke all"** | Stripe "OAuth sessions", Notion admin revoke, Glean "sign users out of all sessions" | LOW-MED | Same page as keys: one "MCP access" surface with two credential kinds. |
| **The same narrowing model as keys** (folders, tools) applied to an OAuth grant | Users expect a Claude.ai connection to be no wider than a key | MED | v1: org + preset (read-only / full) chosen at consent; folder narrowing edited afterwards on the connections page. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| **Incremental scope** (start read-only, step up with a `WWW-Authenticate scope=` challenge when `run_workflow` is first called) | Spec 2025-11-25 SEP-835; least-privilege; fewer abandoned consents | MED | Claude honours a `scope` on the 401. **P2.** |
| **Org-admin allowlist of which MCP clients may connect** (Claude, Cursor, …) | Notion Enterprise, Atlassian domain allowlist | MED | CIMD gives a verifiable client identity. **P3.** |
| **Directory listing in Claude's Connectors Directory** | Discovery without a URL | HIGH (process) | Needs review criteria, test account, docs. **Blocked by SEED-294** (no legal entity). Post-milestone. |
| **Enterprise Managed Auth / SSO without consent** | Enterprise ask | HIGH | Defer. |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| **Hand-rolling a full authorization server** | Control | Large security surface (PKCE, rotation, DCR, CIMD, revocation). The MCP auth spec has changed every revision. | Delegate to Supabase Auth's OAuth 2.1 server if verified fit (STACK question), or a proven library. Own only the consent page and the narrowing. |
| **Omnibus scopes / publishing every scope in `scopes_supported`** | Simplicity | Named as a "common mistake" in the MCP security best practices | 2-3 scopes: `mcp:read`, `mcp:run` (+ `offline_access`). |
| **Shipping OAuth before keys** | Claude.ai is the headline client | OAuth is the harder half. Keys validate the tool surface with Claude Code/Cursor first. The milestone already orders keys first. | Keep the order. |
| **`client_credentials` machine grant** | Bots | Claude does not support it. Recreates the service-account question. | Out of scope. |

---

### D. Outbound webhooks

#### Table Stakes

| Feature | Why Expected | Complexity | Notes / existing dependency |
|---|---|---|---|
| **Endpoint CRUD: HTTPS URL, description, event-type selection, enable/disable** | Stripe, GitHub, Svix all have this | LOW-MED | HTTPS only. **SSRF guard at create AND at every send**: reuse `app.security.egress` (`validate_destination` / `send_pinned_http` with DNS pinning). This is a security-bearing must. |
| **Event catalog with sample payloads**: `workflow_run.completed`, `workflow_run.failed` (+ cancelled), `document.ingested`, `document.ingest_failed` | Stripe/Svix event catalogs; "only listen to what you need" | LOW | Dot-delimited `type`. Event names are a public contract, so freeze them. |
| **Standard Webhooks signing**: `webhook-id` (stable across retries), `webhook-timestamp`, `webhook-signature: v1,<base64 HMAC-SHA256(id.ts.body)>`, `whsec_` secret, unique per endpoint | De-facto standard; verifier libraries exist in every language | LOW | Sign the exact bytes sent. |
| **Secret shown once / revealable; roll secret with an overlap window** (both signatures sent during the window) | Stripe "Roll secret… delay expiration up to 24 hours"; Standard Webhooks multi-signature | LOW-MED | |
| **Retries with exponential backoff + jitter over about 1-3 days; only 2xx is success; never follow 3xx; 410 disables; honour `Retry-After` on 429/502/504; 15-30 s timeout** | Standard Webhooks, Svix (8 attempts about 27 h), Stripe (3 days) | MED | Reuse the **notification drainer's claim/process/record outbox shape** (`notification_drainer.py`) rather than a new queue. Multi-worker safe claims. |
| **Delivery log per endpoint**: event, attempt count, status code, latency, short response excerpt, next retry time, Delivered/Pending/Failed | Stripe "Event deliveries" tab, GitHub "Recent Deliveries", Svix logs | MED | Retention bounded (e.g. 15-30 days) and stated. |
| **Manual resend of one delivery; "send test event"** | Stripe Resend (15 days), GitHub Redeliver + ping, Svix "Send example" | LOW-MED | The test event uses a fixture payload, never real content. |
| **Auto-disable after sustained failure + tell the owner** | Svix (5 days), Standard Webhooks ("notify through other channels") | LOW | Reuse 300/301 in-app notice + content-free email. |
| **Idempotency guidance + no ordering guarantee, stated in docs** | Stripe: *"doesn't guarantee delivery order… track event IDs"* | LOW | Docs + stable `webhook-id`. |
| **Visibility-correct fan-out**: an endpoint receives only events about runs/documents its **owner can see at send time** | Implicit; a leak otherwise | MED | ⚠ The easy-to-miss part. Fan-out runs as the endpoint owner, not service role. Re-checks membership and org MCP/webhook switch per send. |
| **Audit rows** for endpoint create/edit/delete/roll/disable | Platform norm; mig 215 audit lockstep | LOW | |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| **Thin payloads by default**: ids, status, timestamps, app link, plus a "fetch it" pointer (MCP `get_workflow_run` / document id) | Stripe now recommends **Thin**. Standard Webhooks praises thin. Pairs with PII policy and Phase 300's content-free email precedent. Safe by construction. | LOW | Full payload is an opt-in per endpoint later, subject to redaction. |
| **`workflow_run.waiting` event** (run paused for a person) | "Post to Slack when a run needs me." Syrel uniquely has this state, and 300/301 already detect it. | LOW | Not in the milestone list. Strong, cheap candidate. **P2.** |
| **Per-endpoint filters by workflow or folder** | Fewer irrelevant deliveries | LOW-MED | |
| **"Recover failed since <date>" bulk resend** | Svix feature; ends outage clean-up by hand | MED | **P3.** |
| **Asymmetric (ed25519) signatures** | Standard Webhooks recommends it when the consumer does not control both sides | MED | **P3.** |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| **Full content in payloads** (answer text, document text, extracted fields) | One less API call | PII egress to arbitrary URLs. Payload size (Standard Webhooks: keep under about 20 KB). Stale snapshots. | Thin payload + fetch with credentials. |
| **Custom signing scheme or unsigned "secret in URL"** | Quick | Every consumer must hand-roll verification; no libraries | Standard Webhooks. |
| **Ordering / exactly-once guarantees** | Consumers ask | Nobody provides it (Stripe explicitly does not) | At-least-once + stable id + documented. |
| **Payload transformations / templating per endpoint** | Fit the target (Slack) directly | Code-in-config. Turns an event bus into an integration platform. Extension Contract pressure. | Point Slack at n8n/Zapier, which reshape. |
| **Following redirects / allowing http or private IPs** | "My endpoint redirects" | SSRF into the one-box network (Redis 6379, Postgres 54322) | Refuse. The delivery log names the reason. |
| **Inbound webhooks** in this milestone | Symmetry | Already covered by Phase 293 `/inbound` | Out of scope. |
| **Adopting Svix (SaaS) as a dependency** | Ready-made portal | New vendor + data processor. Self-hosted one-box parity. The outbox pattern already exists. | Build on the drainer pattern; copy Svix/Stripe UX. |

---

### E. Guardrails for outside traffic (admission control, PII redaction)

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| **Per-key / per-connection rate limits**, separate buckets for expensive (`ask_agent`, `run_workflow`) vs cheap (search/read) calls | Every API product has them; 293 has per-key starts/reads per minute | LOW | Extends `rate_limit.py` + `app_settings` bounds. |
| **Per-org concurrency cap on outside-started agent turns/runs, with interactive in-app users protected** | SEED-081: shared provider keys plus uncapped fan-out means an MCP burst starves the app | MED | Admission at the MCP/webhook-trigger boundary only, as milestone scope says. |
| **Refusals the model can relay**: tool error text "Syrel is at capacity, try again in ~N s" (no transport-level 429 on `tools/call`) | Spec: tool errors for model self-correction. Transport errors break some clients. | LOW | HTTP 429 + `Retry-After` stays correct for webhook-consumer-facing and REST paths. |
| **Spend/budget respected** | Phase 256 caps; Admin Spend page exists | LOW | Outside runs attributed to the key/connection so the spend view can name the source. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| **Org-policy PII redaction on what leaves through MCP results and webhook payloads** (emails, phones, card/IBAN, national IDs → `[redacted: email]` marker), never inside the app | Studied competitors rely on permissions, not DLP, so this is a genuine regulated-buyer differentiator (SEED-079) | MED-HIGH | Must not mangle citations or ids. A visible marker beats silent removal. A per-org switch, default decided in requirements. LOW confidence on what buyers expect. |
| **Redaction preview / "what would be redacted" check** on the keys page | Trust | MED | **P3.** |
| **Origin column in the spend view** (in-app / key / MCP / schedule) | Attributable cost (SEED-073/074 line) | LOW | |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| **Global PII redaction across the whole app** (retrieval, prompts, logs) in this milestone | SEED-079's full scope | A huge blast radius. Hurts in-app answer quality. The milestone deliberately scopes to new egress paths. | Redact only at the two new egress boundaries. |
| **LLM-based PII detection on every outbound result** | Higher recall | Cost and latency on every call; non-deterministic | Deterministic recognisers (pattern + checksum, e.g. Presidio-class). STACK decides. |
| **Silent truncation/denial under load** | Simplicity | Users blame the client; nobody can debug it | Explicit capacity sentence + audit row. |

---

## Feature Dependencies

```
Phase 293 api_keys + /inbound + per-key rate limits + audit lockstep + origin_kind
    └──extended by──> Personal MCP keys (kind/sibling table, folder+tool narrowing)
                           └──requires──> MCP server (Streamable HTTP, stateless)
                                              ├── search_knowledge_base ──uses──> retrieval_service folder_ids (∩ member visibility)
                                              ├── list/read_document ──uses──> 293 one-time file links
                                              ├── ask_agent ──uses──> agent_loop (read-only toolset) + run buffer + message confidence fields
                                              ├── list/run/get_workflow ──uses──> workflow_kickoff, run evidence (289), v4.8 /app links
                                              └── "waiting on <person>" ──reads──> 300/301 waiting-run state

MCP server + keys ──validated first by──> Claude Code / Cursor / Codex / n8n
OAuth 2.1 (PRM, AS, PKCE, DCR+CIMD, consent+org picker, refresh) ──requires──> MCP server, the same narrowing model as keys
    └──unlocks──> Claude.ai + Claude Desktop custom connectors (keys cannot, finding 1)

Outbound webhooks ──reuses──> notification_drainer outbox shape, egress.send_pinned_http (SSRF), 300/301 notices (auto-disable alert)
    └──payload links ──> v4.8 links; "fetch the rest" ──> MCP get_workflow_run

Admission control ──gates──> ask_agent, run_workflow, webhook-triggered nothing (webhooks are outbound only)
PII redaction ──applies at──> MCP tool results, webhook payloads (thin payloads shrink its job)
Org MCP kill switch ──checked by──> every MCP call, every OAuth token use, webhook fan-out (if one switch covers both)
```

### Dependency Notes

- **Keys before OAuth:** OAuth adds a second credential type, but the tool surface, narrowing and audit are shared. Keys let the tool surface be proven in clients that accept headers. The narrowing model must be designed once for both credential kinds, so its data model belongs in the keys phase.
- **The ask_agent deadline/handle design needs the run buffer** (Redis stream per run). Polling `get_answer` reads the same run. This reuses Phase 061+ infrastructure, with no new infra.
- **Webhook fan-out depends on a visibility check as the endpoint owner.** Doing it as service role reproduces the BUG-260911-01 class ("every gate reads through the service role").
- **The PII redaction phase is easiest after thin webhook payloads are decided.** Thin payloads leave redaction mainly an MCP-results problem.
- **Conflict:** "Narrow by URL params" conflicts with "narrowing lives on the credential". Pick the latter.
- **Conflict:** "Answer HITL over MCP" conflicts with the approval-gate rule (no outbound or unattended capability before the approval model). Keep HITL in-app.

---

## MVP Definition

### Launch With (v4.9)

- [ ] MCP server, stateless Streamable HTTP, with **six to seven tools**: `search_knowledge_base`, `list_documents`, `read_document`, `ask_agent` (deadline + progress + handle), `list_workflows`, `run_workflow`, `get_workflow_run`. Annotated, short descriptions, bounded results, tool errors, audit + origin. *Proves "use it from your own tools".*
- [ ] Personal MCP keys: mint/show-once/revoke, member-as-caller, folder + tool narrowing (intersection only), last used, per-client snippets with env vars, org kill switch, admin list + revoke, per-key rate buckets. *Cheapest path to real clients.*
- [ ] OAuth 2.1 per Claude's checklist (PRM, 401 challenge, PKCE S256, DCR + CIMD, Claude callback + loopback, rotation, < 10 s endpoints, owned consent page with org picker, connected-apps list with revoke). *The only way to reach Claude.ai and Desktop.*
- [ ] Outbound webhooks: endpoints + event selection, Standard Webhooks signing, roll-with-overlap, backoff retries, delivery log, resend, test event, auto-disable + notice, thin payloads, SSRF guard, owner-visibility fan-out. *Completes "be told without opening the app".*
- [ ] Admission control at the new boundaries (per-org concurrency for outside agent turns/runs, capacity tool errors) and PII redaction at MCP result and webhook egress.

### Add After Validation (v4.9.x / v5.x)

- [ ] `workflow_run.waiting` webhook event. Trigger: the first user asks "ping Slack when it needs me" (likely immediately; cheap).
- [ ] `ask_agent` with an Expert parameter. Trigger: an Expert customer wants it outside the app.
- [ ] Incremental OAuth scope step-up. Trigger: consent abandonment or a security review asking for least privilege.
- [ ] "Test this key" and per-key recent-calls view. Trigger: the first "Claude can't see my doc" report.
- [ ] Webhook recover-since-date, per-endpoint workflow/folder filters.

### Future Consideration

- [ ] Claude Connectors Directory listing. Blocked by SEED-294 (no legal entity).
- [ ] MCP Apps rendering artifacts inside Claude.
- [ ] Tasks-extension support once Claude/Cursor ship it.
- [ ] HITL answered from the MCP client (MRTR / elicitation) once client support is real.
- [ ] Org service-account credentials, which need their own security review.
- [ ] `/api/v1` REST surface (already named as next milestone).

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| MCP read tools (search, list, read) | HIGH | LOW-MED | P1 |
| `ask_agent` with deadline/handle/progress + citations + confidence | HIGH | HIGH | P1 |
| list/run/get workflow (start + poll) | HIGH | MEDIUM | P1 |
| Personal keys + narrowing + snippets + kill switch | HIGH | MEDIUM | P1 |
| OAuth 2.1 (Claude.ai / Desktop) | HIGH | HIGH | P1 |
| Webhooks core (sign, retry, log, resend, test, auto-disable) | HIGH | MEDIUM | P1 |
| Admission control at new boundaries | MEDIUM (invisible until it fails) | MEDIUM | P1 |
| PII redaction at MCP/webhook egress | MEDIUM (HIGH for regulated buyers) | MED-HIGH | P1 (milestone scope) |
| `workflow_run.waiting` event | HIGH | LOW | P2 |
| Expert-scoped `ask_agent` | MEDIUM | MEDIUM | P2 |
| Scope step-up | MEDIUM | MEDIUM | P2 |
| ChatGPT `search`/`fetch` aliases | MEDIUM | LOW | P3 (verify first) |
| Webhook recover-since-date, ed25519 | LOW | MEDIUM | P3 |
| MCP Apps, directory listing | MEDIUM | HIGH | P3 |

---

## Competitor Feature Analysis

| Feature | Glean | Linear | GitHub | Supabase | Stripe | Sentry | Zapier | Atlassian | Notion | **Syrel plan** |
|---|---|---|---|---|---|---|---|---|---|---|
| Transport | Streamable HTTP | Streamable HTTP (+ SSE fallback) | Streamable HTTP | Streamable HTTP | Streamable HTTP | Streamable HTTP | Streamable HTTP | Streamable HTTP | Streamable HTTP | Streamable HTTP, stateless |
| Auth | OAuth (scopes MCP/SEARCH/TOOLS/ENTITIES) | OAuth 2.1 + DCR; **or API key bearer** | OAuth or PAT bearer | OAuth + DCR (pick org); PAT bearer for CI | OAuth (per-account perms); **agent API keys** | OAuth only | Secret URL / token (rotate) | OAuth 2.1; admin-toggleable API tokens | OAuth | Personal key bearer, then OAuth 2.1 (DCR + CIMD) |
| Tool narrowing | Admin-built servers with chosen tools, per path | `/mcp/readonly`, `read` scope | Toolsets + readonly via header or path | `read_only`, `project_ref`, `features` params | Key permissions; `api_read`/`api_write` split | Org/project path scoping | Per-server action config | Token scopes + domain/IP allowlists | Workspace client allowlist (Ent.) | Stored on credential: folders ∩ visibility, tool subset, read-only preset |
| Admin controls | Enable server, sign out all sessions | Okta-managed auth | — | — | Team-wide MCP on/off; admin revoke sessions | — | Owner-only add in Claude | Domain + IP allowlist, token toggle | Manage/revoke member connections | Org kill switch, admin list + revoke |
| Long-running work | Chat tool (synchronous) | n/a | n/a | Elicitation confirmations | Human confirmation via approval URL, retry | n/a | Actions synchronous | n/a | n/a | Start + poll; ask deadline → handle; waiting-on-person link |
| Audit / logs | Platform logs | — | — | — | MCP tool-call logs in Workbench | — | — | Audit log | Admin API | Audit rows + origin on runs/threads |
| Webhooks (product's own) | — | Yes | Yes (no auto-retry; manual redeliver) | DB webhooks | Event destinations, thin/snapshot, 3-day retry, roll secret 24 h | — | — | — | — | Standard Webhooks, thin, retry, log, resend, roll |

---

## Sources

**Official, read directly (HIGH):**
- Claude connectors: build guide (limits 240 s / ~150k chars; Claude Code 25k tokens; unsupported features): https://claude.com/docs/connectors/building/index.md
- Claude connector authentication (401 rule, PRM, CIMD vs DCR selection, callbacks, refresh, 10 s/30 s latency, static headers beta and org-shared, egress 160.79.104.0/21): https://claude.com/docs/connectors/building/authentication.md
- Add a custom connector (Request headers beta, Owner-only on Team/Ent, up to four headers, tool Blocked setting): https://claude.com/docs/connectors/custom/add-unlisted.md
- Connector review criteria (annotations, separate read/write, ≤ 64-char names, no behavioural descriptions): https://claude.com/docs/connectors/building/review-criteria.md
- Claude Code MCP (`--header`, `.mcp.json` `${VAR}`, `MCP_TOOL_TIMEOUT`, 5-min idle timeout, 10k warn / 25k cap, tool search): https://code.claude.com/docs/en/mcp
- Cursor MCP (url + headers, `${env:NAME}`, OAuth PKCE + RFC 9728, static `auth` client): https://cursor.com/docs/context/mcp
- MCP spec changelog 2025-11-25 (CIMD, tasks experimental, URL elicitation, SEP-1303 tool errors): https://modelcontextprotocol.io/specification/2025-11-25/changelog
- MCP spec changelog latest / 2026-07-28 (stateless, sessions removed, tasks → extension, DCR deprecated, deterministic tool order): https://modelcontextprotocol.io/specification/latest/changelog
- MCP progress utility: https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/progress
- MCP security best practices (confused deputy, token passthrough, SSRF, session hijack, scope minimisation): https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices
- Standard Webhooks spec: https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md
- Stripe webhooks (3-day retries, Resend 15 d, roll secret ≤ 24 h, no ordering, 5-min tolerance, thin vs snapshot): https://docs.stripe.com/webhooks
- Stripe MCP (agent API keys, team MCP on/off, admin revoke sessions, human confirmation, snippets per client): https://docs.stripe.com/mcp
- GitHub failed deliveries (no auto-retry, 10 s timeout): https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries
- Svix retries (schedule, 5-day auto-disable, recover/replay): https://docs.svix.com/retries
- Supabase MCP (OAuth + DCR, PAT header, `read_only`/`project_ref`/`features`, prompt-injection warnings): https://supabase.com/docs/guides/getting-started/mcp
- Linear MCP (`/mcp/readonly`, OAuth 2.1 + DCR, API key bearer): https://linear.app/docs/mcp
- Sentry MCP (org/project path scoping, OAuth only): https://mcp.sentry.dev/
- Glean MCP servers (per-server tool subsets, "don't enable all tools"): https://docs.glean.com/administration/platform/mcp/create-mcp-servers

**Vendor docs, partly via search summaries (MEDIUM):**
- Notion MCP admin controls: https://developers.notion.com/docs/mcp
- Atlassian Rovo MCP admin settings: https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/
- Zapier MCP client setup / rotate secret: https://help.zapier.com/hc/en-us/articles/36265392843917
- GitHub MCP toolsets/readonly headers: https://github.com/github/github-mcp-server
- Supabase Auth OAuth 2.1 server (public beta 2025-11-26, consent UI is yours): https://supabase.com/changelog/38022-oauth-2-1-server-capabilities-for-supabase-auth
- MCP tasks extension: https://modelcontextprotocol.io/extensions/tasks/overview

**Secondary only (LOW, verify before relying):**
- ChatGPT deep-research `search`/`fetch` tool convention: https://medium.com/@alexeylark/chatgpt-custom-mcp-connectors-with-developer-mode-d791fde17d25

**Project context:** `.planning/PROJECT.md` (v4.9 scope), `SEED-013`, `SEED-177`, `SEED-195`, `SEED-079`, `SEED-081`, `supabase/migrations/215_api_keys_and_run_origin.sql`, `backend/app/api/inbound.py`, `backend/app/security/egress.py`, `backend/app/services/notification_drainer.py`, `frontend/src/components/settings/apiKeys/`.

---
*Feature research for: remote MCP server + personal keys + OAuth + outbound webhooks on a multi-tenant agentic RAG platform*
*Researched: 2026-10-30*

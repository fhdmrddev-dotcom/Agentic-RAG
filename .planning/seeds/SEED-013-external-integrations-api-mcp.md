---
seed_id: SEED-013
title: External Integrations — public API, MCP server, webhooks, service accounts
created: 2026-05-09
planted_during: v2.5 close-out
status: planted
priority: high
relates_to:
  - SEED-001 (Scale Readiness) — public API would amplify concurrent load; the asyncpg / multi-worker work in SEED-001 is a prerequisite for serious external traffic
  - SEED-003 (Deployment Flexibility) — API-as-product needs a different deployment shape than the current dev-frontend-only model (CORS, auth gateway, rate-limiting, public TLS termination)
  - SEED-004 (Org / Department / Role) — service accounts and per-org API quotas live naturally in the org / RBAC data model; if SEED-004 lands first, this seed's auth model is simpler
  - SEED-007 (App-level Streams Provider) — multi-app token throughput and per-app provider routing share infrastructure with this seed's per-consumer rate-limiting
  - SEED-012 (Admin / Operator UI) — API key issuance, quota management, and per-consumer observability all land in the admin UI
trigger_when:
  - First inbound request from a non-developer to "talk to your app from my app" / "use this as a backend for my workflow"
  - User of Claude Desktop / Cursor / Cline / ChatGPT desktop / any MCP-aware client asks "can I plug your knowledge base in as an MCP server?"
  - Planning a milestone scoped to "API", "integration", "platform", "developer", "MCP", "webhook", "third-party", "embed", or "headless"
  - Going open-source or launching a hosted offering — the moment external developers can sign up, this seed becomes urgent
  - Any partnership / B2B conversation where the partner asks for programmatic access (not screen-share-the-UI)
---

# SEED-013: External Integrations — API + MCP + Webhooks + Service Accounts

## The principle

Today the FastAPI backend is **internal**: it serves the React frontend at `localhost:5173`, authenticates via Supabase JWT cookies, and assumes a single human-driven session per request. The architecture is API-shaped (well-defined REST resources, OpenAPI-discoverable) but the surface is private.

This seed asks: **what does it look like to make the agent's capabilities — RAG, code execution, skills, knowledge base — programmatically available to *other* applications?**

Three consumer modes worth designing for:

1. **App-to-app via REST API** — another web app calls our backend to "answer this question against my org's KB" or "run this skill with these inputs". Stateless, key-authed, rate-limited, versioned.
2. **LLM-client-to-app via MCP** — Claude Desktop / Cursor / Cline / ChatGPT desktop / Goose connects to our backend as an MCP server. They get the agent's RAG + skills + sandbox as MCP tools. We get the user's IDE / desktop as the chat surface.
3. **App-to-app via webhooks** — outgoing notifications when something happens (run completed, document ingested, skill execution finished). Inbound webhooks for "ingest this document I just uploaded to S3".

Each mode unlocks a different distribution / deployment story. All three share infrastructure (auth, quotas, observability) so the seed plants them together.

## Why this is genuinely new ground (not already covered)

Audit at v2.5 close:

- **The backend has 13 API route modules** (`audit`, `documents`, `feedback`, `folders`, `kb`, `knowledge_health`, `runs`, `sandbox_outputs`, `settings`, `skills`, `test_fixtures`, `threads`, `__init__`). All are JWT-cookie-auth-from-Supabase. None are versioned. None are documented for external consumption. None have rate-limiting beyond Supabase's connection pool.
- **No MCP code anywhere in the repo** (greps clean). Project memory says graphify CLI is standalone (`reference_graphify_standalone.md`) — not an MCP integration. The MCP servers configured in `.mcp.json` are *consumed* by Claude Code, not *served* by this app.
- **No webhook system** — incoming or outgoing. The only "events" today are SSE streams for chat (Phase 061+ run-backed streaming).
- **No API keys** — auth is JWT-from-Supabase-Auth, which means every consumer must be a registered Supabase user. Service accounts (long-lived bearer tokens for non-human consumers) don't exist.
- **No rate limiting or per-consumer observability** — a misbehaving external consumer would trip the AnyIO threadpool ceiling (cf. SEED-001) before any per-consumer guardrail kicked in.

This is a real platform-shaped milestone, not an incremental feature.

## Competitive landscape (briefly)

What top-tier comparables already do, and where the opportunity is:

- **OpenAI Assistants API** — proprietary; closed ecosystem; their RAG is opaque; can't self-host; can't bring your own model.
- **Anthropic Claude API** — model API, no built-in RAG / KB / skills. You build those yourself.
- **Glean** — enterprise RAG with API; closed-source, expensive, not self-hostable.
- **LangChain / LlamaIndex** — libraries (not products) for building RAG; users assemble their own platform from primitives.
- **Cursor / Cline / Aider** — agentic IDE clients that consume MCP servers but don't serve them as platforms.
- **ChatGPT Desktop / Claude Desktop** — MCP *clients*; they want servers to connect to.
- **n8n / Zapier** — generic automation platforms with thin AI bolt-ons; no native RAG / KB / skill system.

**The gap our app could fill:** an *open-source*, *self-hostable* agentic RAG platform that exposes itself as both REST API and MCP server, with the agent's full toolkit (KB search, code execution, persistent skills, multi-provider LLM routing) available to any consumer. Closest existing thing is "LangChain + a bunch of glue" — not a product.

## Scope (when triggered)

This is genuinely large. Suggested phasing:

### Phase 1: API contract & service accounts (~2 weeks)

1. **Versioned public API surface** — `/api/v1/...` namespace separate from the internal frontend routes. Audit which existing routes are externally-safe and promote them; mark internal routes explicitly internal.
2. **Service accounts** — long-lived bearer tokens issued via the admin UI (cross-ref SEED-012). Stored in Supabase as a separate table with RLS scoping the consumer to a specific user / org / dept.
3. **Per-consumer rate limiting** — Redis-backed token bucket per service account. Defaults sane, tunable via admin UI.
4. **OpenAPI / docs** — FastAPI already auto-generates OpenAPI; gate it behind an "API enabled" flag and serve at `/api/v1/docs` for authenticated consumers.
5. **Per-consumer observability** — `runs` table grows a `consumer_id` column; admin dashboard renders per-consumer activity (cross-ref SEED-012).

### Phase 2: MCP server (~1.5 weeks)

The agent's capabilities map naturally to MCP tools:

- `search_kb` — semantic search the user's KB (parameters: query, top_k, folder_id?, document_type?)
- `read_document` — fetch a document's contents by ID
- `list_skills` — enumerate available skills for the consumer
- `run_skill` — execute a skill with inputs (returns run_id; consumer can poll or stream via MCP's notification channel)
- `execute_code` — sandbox code execution (gated by `SANDBOX_ENABLED` + per-consumer permission)
- `chat` — full agentic chat against the KB (consumer provides history; we stream the response)

MCP server can be the same FastAPI process serving a `/mcp` endpoint, or a separate stdio-mode binary for Claude Desktop / Cursor consumption. Decide at scoping time.

### Phase 3: Webhooks (~1 week)

- **Outgoing** — operator subscribes to events (`run.completed`, `document.ingested`, `skill.executed`, `confidence.low`) and gets POSTs to a configured URL with HMAC-signed payloads.
- **Incoming** — endpoint that accepts a document URL or content + metadata, kicks off ingestion, returns a `document_id` immediately + emits a webhook on completion.

### Phase 4: SDK / client libraries (~1–2 weeks; optional, defer if traction is uncertain)

- TypeScript SDK (because most external consumers are JS-shaped today)
- Python SDK (because the project is Python-shaped; consumers in this language exist)
- Code samples + a "5-minute integration" guide

## Architectural notes

- **JWT vs API key**: keep JWT-from-Supabase for the React frontend (it's working). Add API-key path for service accounts. Don't unify them — different security profiles.
- **CORS**: today `CORSMiddleware` is permissive for `localhost:5173`. Public API needs explicit allow-list per consumer.
- **Streaming**: for MCP and SSE-shaped REST endpoints, the run-backed buffer (Phase 061+ Redis Streams) already supports replay-and-tail per `run_id` — external consumers get the same robustness as the frontend without new infra.
- **Auth model for MCP**: MCP's standard is OAuth or stdio. If stdio (desktop client connection), we'll need a stdio binary that proxies to the backend with a stored API key. If OAuth (web-MCP), we can use Supabase Auth's OAuth flows.

## Differentiation thesis (in plain language)

The closed competitors (ChatGPT, Glean, Copilot Studio) are SaaS-locked — your data lives on their servers. The open frameworks (LangChain, LlamaIndex) are libraries — you build the platform yourself. This seed positions our app as the third option: *the open-source, self-hostable, agentic-RAG-as-a-platform that you can plug into any other app you own.*

## Risks / pitfalls

- **Public API amplifies every backend bug.** Don't ship this until SEED-001 (asyncpg + multi-worker) is at least partially addressed — a single misbehaving consumer can DoS a single-worker backend trivially today.
- **MCP spec is still evolving.** Pin to a specific spec version, plan for a deprecation cycle when the spec changes.
- **Per-consumer pricing pressure** — if hosted offering happens, per-consumer billing requires per-consumer cost attribution (LLM tokens, sandbox CPU, embeddings). Plan the metering before billing, not after.
- **Org-aware permissions are a hard prerequisite for B2B.** A service account that can read another org's KB is a customer-loss event. Ideally land SEED-004 (org/dept) first, or scope this seed to single-org installs only in v1.
- **MCP tool surface expansion is a forever job.** Scope v1 to the 5–6 highest-value tools. Resist "expose everything as MCP" — it dilutes the API surface.

## Cost estimate

Full scope is a 6–10 phase milestone. Phase 1 alone (API + service accounts) is the minimum viable product for "external consumers can call this app."

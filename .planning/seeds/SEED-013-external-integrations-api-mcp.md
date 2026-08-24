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

## Update 2026-05-31 — Worked example: customer-support ticket triage via n8n (fields already exist, just need PUBLIC exposure)

Surfaced during Phase 090 operator-testing-notes triage. This is the concrete "why would anyone call our API" story — and the punchline is that **the most valuable fields the external caller wants ALREADY EXIST inside the app today.** This is not a new-build ask; it is a *public-exposure* ask.

### The scenario (plain language)

A company runs its customer support on a ticketing tool (Zendesk / Freshdesk / Intercom / a plain inbox). They wire up **n8n** (the open automation platform we already name in the competitive landscape above) so that every time a new support ticket arrives, n8n calls *our app* and asks: "given our knowledge base, what's the answer to this customer's question?"

n8n is a dumb pipe here — it just needs a clean JSON answer back so it can decide what to do with the ticket. Concretely, the n8n node POSTs the ticket text to our public endpoint and wants back a small, decision-ready payload:

```jsonc
{
  "answer": "To reset your API key, go to Settings → API → Rotate Key…",
  "confidence": {
    "level": "high",            // high | medium | low
    "avg_similarity": 0.83,     // float — how close the retrieved chunks were
    "disclaimer": null          // human-readable caveat string when grounding is weak
  },
  "scope": { "folder_ids": ["uuid-of-support-kb-folder"] },   // which KB slice was searched
  "source_refs": [ { "document_id": "…", "title": "…", "chunk": "…" } ]
}
```

With that payload, the n8n workflow can branch on its own:
- **`confidence.level == "high"`** → auto-draft the reply and (optionally) auto-send.
- **`confidence.level == "low"`** (or a `disclaimer` is present) → DON'T auto-reply; route the ticket to a human agent's queue with the draft attached as a suggestion.

### The key insight: these fields already exist — they just aren't PUBLIC

This is the part a future planner must not miss. Every field the n8n caller wants is already produced by the app on the normal chat path; the work is **promoting them onto a versioned public schema**, not building new logic:

- **Response-level confidence** is attached to *every assistant message today.* See `backend/app/models/message.py:25-27` — the message model already carries:
  - `confidence_level` (`high` / `medium` / `low`)
  - `confidence_avg_similarity` (float)
  - `confidence_disclaimer` (the human-readable caveat string)
- **Folder / scope filtering** already threads all the way through retrieval. See `backend/app/services/retrieval_service.py:32` and `:237-278` — `search_documents` already accepts `folder_ids` and filters the vector search to that KB slice. So "search only our support-KB folder" is a parameter that already works internally; the public API just needs to expose it.
- **`source_refs`** are the same citations the chat UI already renders under each grounded answer — already assembled, just need to be shaped into the public response model.

So the Phase-1 "promote which existing routes are externally-safe" task (above) gets a very concrete first customer: a `/api/v1/answer` (or `/api/v1/chat`) endpoint whose response model carries `answer + confidence_* + scope + source_refs`.

### Action note for the v3.3 public-schema work (Theme A)

When v3.3 defines the **public Pydantic response schemas** (Theme A of this seed — the versioned `/api/v1/...` contract), explicitly confirm those schemas carry the `confidence_*` fields forward from `message.py`. It would be easy to design a "clean minimal public answer schema" that drops confidence — but confidence is the single most valuable field for the triage use-case (it's what lets the caller decide auto-reply vs human-escalate). Treat `confidence_level` + `confidence_avg_similarity` + `confidence_disclaimer` as **required** public fields, not optional internals.

### Scope clarification — RESPONSE-level vs per-CLAIM confidence (no conflict)

There's a documented decision that **per-CLAIM confidence is permanently out of scope** (`PROJECT.md:230`) — i.e., we do NOT score the trustworthiness of each individual sentence/claim inside an answer. That is a different thing and stays out of scope.

What this triage scenario needs is **RESPONSE-level confidence** — one confidence verdict for the whole answer — which is exactly what `message.py:25-27` already produces. **No conflict with PROJECT.md:230.** A future planner should not read "confidence is out of scope" and wrongly conclude this scenario is blocked; the out-of-scope line is about per-claim granularity only.

### Where the escalation LOGIC lives (cross-ref)

This seed (SEED-013) owns only the **API/MCP surface** — exposing `answer + confidence + scope + source_refs` so an external caller *can* make a decision. It does **not** own the decision itself.

The confidence-GATED, closed-loop behavior — "when confidence is low, route to a human queue / open an escalation / file a ticket" — is **reactive automation logic** and lives in **SEED-014 (Automations & Routines, targeted for v3.4)**. SEED-014 already lists `confidence.low` as a triggered-run event. If we ever want to drive that escalation *inside our own app* (rather than letting n8n branch on the JSON), that's SEED-014 work, not API-layer work. See SEED-014's matching `## Update 2026-05-31` section for the human-in-the-loop (HITL) escalation pattern.

Plain-language split: **SEED-013 hands back the number; SEED-014 decides what to do when the number is low.**

## Update 2026-08-08 — Operator direction: there is a FOURTH consumer mode, and it is the one this seed never wrote down

Recorded at the Phase 190 context lock. The three consumer modes above are all about **others calling
us** — REST API inbound, us as MCP **server**, webhooks. The operator's direction adds the mirror:

> "it should be a two way communication… we need the ability to read write to pull something from
> Jira from email from Slack from anything. And also to send."

**Mode 4 — us as MCP CLIENT.** The app calls out and reads back: a workflow step pulls a Jira ticket's
description, the last messages in a Slack channel, an email — and a connected drive (OneDrive /
SharePoint / Google Drive) auto-ingests documents into the knowledge base without a human upload.

This is **binding on this milestone's scope**, not a follow-on to it. When Open Platform gets a phase
number, mode 4 is scoped alongside modes 1–3 — they share auth, quotas, credentials and observability,
which is the same reason this seed planted the first three together.

Full analysis, the two halves (workflow reads vs drive auto-ingest), why neither belongs in Phase 190,
and what Phase 190 must NOT change because of it: **`SEED-142-two-way-connectors-read-pull-auto-ingest.md`**.

⚠ Note for whoever scopes this: auto-ingest contradicts the standing `CLAUDE.md` rule *"Ingestion is
manual file upload only — no connectors or automated pipelines."* That rule is dated, not permanent —
change it in the same commit as the first sync connector, never leave it standing against shipped code.


---

## ROUTED 2026-08-24 — Connections & Open Platform milestone

Operator decision: *"open a connections milestone from SEED-146 instead of 206."* Phase 206
(Outbound Action Connectors) is RETIRED from the v3.8 roadmap; this seed is a source for the
milestone instead. Scope, the binding one-provider-many-capabilities constraint, and the open
questions: `.planning/CONNECTIONS-MILESTONE-CANDIDATE.md`.

Status stays `planted` deliberately — the milestone is a CANDIDATE, not opened. It opens after
v3.8 closes (204 running, 205 planned).

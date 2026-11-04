# Architecture Research: v4.9 "Use It From Your Own Tools"

**Domain:** Outside-caller surfaces (remote MCP server, personal MCP keys, OAuth 2.1, outbound webhooks, outside-traffic guardrails) bolted onto a brownfield FastAPI + Supabase + Redis RAG/agent platform
**Researched:** 2026-10-30
**Confidence:** HIGH for integration points (read from the code at `f267f2949`); MEDIUM for MCP SDK specifics (official docs, fast-moving v2 line); MEDIUM-LOW for Supabase OAuth 2.1 server (public beta, discovery path inconsistent across docs)

---

## 0. The five facts that decide this milestone's shape

These were measured in the code, not assumed. Everything below follows from them.

1. **The house way to "act as a member" is a uid-synthesized RLS connection, not a JWT.**
   `dependencies._apply_rls_user_context` does `SET LOCAL ROLE authenticated` and sets both `request.jwt.claim.sub` and `request.jwt.claims` from a user id. `get_user_pg_connection(None, {"id": uid})` is already used **without any token** by retrieval (`retrieval_rpc._call_as_user`), `retrieval_scope.py`, `kb.py`, `sql_service.py` and `workflow_run_evidence.py`. No JWT signing secret is configured anywhere (`grep jwt_secret` finds nothing in `config.py`, `.env.example` or `deploy/onebox.env.example`). **An MCP key acts as its member through this seam. Do not mint Supabase JWTs.**
2. **RLS shows a member every org they belong to, not "the active org".** `current_user_org_ids()` is `SELECT org_id FROM org_members WHERE user_id = auth.uid()`, and `match_document_chunks` gates on `dc.org_id = ANY (SELECT current_user_org_ids())`. Chat search today spans all of a two-org member's orgs (the `ExpertScopeUnavailable` docblock says so: *"an empty scope reaches retrieval as 'no folder filter' and would search every org the user is in"*). A key is minted in one org (`api_keys.org_id`), so **"sees exactly what the member sees" has to mean "what the member sees in the key's org"**, and that needs a narrowing step RLS does not provide today.
3. **The inbound door (Phase 293) already proves the access posture, but it is FastAPI-dependency-shaped.** `resolve_api_key` is a `Depends()` chain (digest, constant-time compare, revoked, expired, still a member, not banned), with one 401 body for every failure, a Redis fixed-window limiter that fails closed (`rate_limit.py`), and `api_key.*` audit rows. A mounted MCP ASGI app cannot use `Depends`, so the resolver core has to be lifted into a plain async function first.
4. **Workflow runs from outside already have a shared core; chat runs do not.** `services/unattended_launch.launch_unattended_run` (schedules + keys) creates the thread and run, arms caps, drives the run and finalizes the producer shell. There is **no equivalent for a chat turn**: `threads.send_message` (97 phases, the second-hottest file in the repo) requires a user-JWT supabase client for its request-scoped reads. `run_producer.run_producer` itself runs on the service role and takes `scoping: ThreadScoping`, so an "ask" core can call it directly without touching `threads.py`.
5. **"Something happened" already flows through DB triggers into an outbox drained by every worker.** Phase 300: `workflow_runs_notify_on_status` (AFTER UPDATE OF status, WHEN terminal) and `messages_notify_on_ask` write `notifications` / `notification_deliveries`; `NotificationDrainer` runs in every uvicorn worker and claims with `FOR UPDATE SKIP LOCKED`, a `sending` flip, a lease and frozen payloads. No leader election, no Redis. Webhooks should copy this pattern exactly.

---

## 1. Standard Architecture

### System Overview

```
 Outside callers: Claude Desktop / Cursor / Claude Code / Claude.ai (MCP)      n8n / Zapier (inbound 293)
          │  Authorization: Bearer srl_mcp_…   (later: OAuth 2.1 access token)          │ srl_live_…
          ▼                                                                             ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ uvicorn worker ×2 (WORKER_COUNT=2)                                                                │
│ CORS (outermost) → SetupMiddleware → MaintenanceMiddleware → CanvasGateMiddleware → router/mounts │
│                                                                                                   │
│  /mcp  (Mount, stateless Streamable HTTP)               /inbound/* (293, unchanged)               │
│  ┌──────────────────────────────────────────┐            ┌─────────────────────────┐              │
│  │ McpAuthASGI  (NEW, pure ASGI wrapper)    │            │ resolve_api_key (Depends)│              │
│  │  → authenticate_presented_key() ◄────────┼── shared ──┤  → authenticate core     │              │
│  │  → org MCP switch + operator switch      │   core     └─────────────────────────┘              │
│  │  → McpPrincipal contextvar               │                                                     │
│  ├──────────────────────────────────────────┤                                                     │
│  │ MCP server (SDK) — 4 tool families        │                                                     │
│  │  search_knowledge │ list/read_documents   │                                                     │
│  │  ask_agent        │ run_workflow/get_run  │                                                     │
│  └───────┬──────────────────────────────────┘                                                     │
│          │ per-key limiter (rate_limit.py) → admission (NEW outside_admission.py) → audit          │
│          ▼                                                                                        │
│  Service layer (EXISTING, called, not edited)            Outbound guard (NEW outbound_guard.py)   │
│   retrieval_service.search_documents(folder_ids=…)  ──►  redact(text) on every result / payload   │
│   acting-member RLS reads (documents, runs)                                                       │
│   unattended_chat.ask() (NEW) ──► run_producer.run_producer(scoping=ThreadScoping(...))           │
│   unattended_launch.launch_unattended_run(origin_kind='mcp')                                      │
│                                                                                                   │
│  Lifespan loops (every worker): NotificationDrainer (300) · WebhookDrainer (NEW) · Scheduler …    │
└──────────┬───────────────────────────────────────────┬───────────────────────────────────────────┘
           │ asyncpg pool (BYPASSRLS) + uid-synth RLS   │ Redis: run:{id} streams, limiter buckets,
           ▼                                            ▼        admission leases
┌─────────────────────────────────────────────┐   ┌────────────────────────┐
│ Postgres (Supabase)                          │   │ Redis                  │
│  api_keys (+kind, +folder_ids, +tools)       │   └────────────────────────┘
│  webhook_subscriptions / webhook_deliveries  │
│  triggers: workflow_runs status → deliveries │ ──► WebhookDrainer ──► send_pinned_http('webhook', …)
│            documents status   → deliveries   │        (SSRF-pinned, signed, retried)  ──► customer URL
│  current_user_org_ids() (+ optional org GUC) │
└─────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | New / Modified | File |
|---|---|---|---|
| Key authentication core | Digest → lookup → constant-time compare → revoked → expired → member → not banned, as a plain `async def` usable outside FastAPI `Depends` | **Modified** (extract, behaviour byte-identical; `resolve_api_key` becomes a thin wrapper) | `backend/app/security/api_key_auth.py` |
| `McpPrincipal` | Frozen value: `user_id, org_id, credential_id, credential_kind ('key'\|'oauth'), label, folder_ids, tools, expires_at` | **New** | `backend/app/security/mcp_principal.py` |
| Acting-member DB context | `acting_member_connection(principal)` = `get_user_pg_connection(None, {"id": user_id})` + org narrowing | **New** (+ one small hot edit, see §5) | `backend/app/security/acting_member.py`, `backend/app/dependencies.py` |
| MCP ASGI auth wrapper | Pure-ASGI: reads Bearer, resolves the principal, refuses with one 401 body, sets a contextvar, applies the per-client IP limit | **New** | `backend/app/mcp/auth_asgi.py` |
| MCP server + tools | SDK server object, stateless HTTP, tool handlers that call services only | **New** | `backend/app/mcp/server.py`, `backend/app/mcp/tools/{search,documents,ask,workflows}.py` |
| Unattended chat core ("ask") | Create (or reuse a key-owned) thread, insert the user message, resolve the owner's model, `register_run_start`, spawn `run_producer` with `ThreadScoping(effective_folder_ids=…)`, await the terminal sentinel on `run:{id}` | **New** | `backend/app/services/unattended_chat.py` |
| Key run read | The inbound run-read composition (steps, status, waiting-on, end reason, file links), shared by `/inbound/runs/{id}` and the MCP `get_run` tool | **Modified** (pure-move extraction out of `inbound.py` first) | `backend/app/services/key_run_read.py`, `backend/app/api/inbound.py` |
| Outside admission control | Redis lease set per org, per credential and per resolved provider for outside-started runs; fails closed | **New** | `backend/app/services/outside_admission.py` |
| Outbound guard (PII) | `redact_outbound(text, policy) -> (text, counts)`, applied at the MCP result and webhook payload boundaries only | **New** | `backend/app/services/outbound_guard.py` |
| Webhook subscriptions API | Member CRUD (create shows secret once, rotate, pause, revoke, delivery log, "send test"), org-admin list/revoke | **New** | `backend/app/api/webhooks.py`, `backend/app/db/webhooks.py`, `backend/app/models/webhook.py` |
| Webhook drainer | Per-worker poll loop: claim (`SKIP LOCKED`) → re-check visibility as subscriber → render frozen payload → redact → sign → pinned POST → record outcome / backoff / auto-disable | **New** | `backend/app/services/webhook_drainer.py` |
| Egress capability | A `webhook` capability in the closed capability set, caller-configured host, HTTPS only, DNS-pinned | **Modified** | `backend/app/security/egress.py` |
| MCP key management API | `kind='mcp'` keys: create with optional folder set and tool subset, list, revoke; org admin view + org MCP switch | **Modified** | `backend/app/api/api_keys.py`, `backend/app/db/api_keys.py`, `backend/app/models/api_key.py` |
| Settings knobs | Operator kill switch, MCP limits, admission caps, webhook retry/auto-disable, redaction default | **Modified** (additive) | `backend/app/models/user_settings.py`, `backend/app/api/settings.py` |
| Audit vocabulary | `mcp.call`, `mcp.refused`, `api_key.create`… reuse, `webhook.create/revoke/rotate/disable` | **Modified** (lockstep with the DB CHECK) | `backend/app/services/audit_service.py` + migration |
| Word template fix | Bare `{{ name }}` against a cited-record context renders the value or fails integrity | **Modified** | `backend/app/services/tools/render_template.py` (`_RENDER_DRIVER_SRC`, `residual_tags_in` / `assert_integrity`) |

---

## 2. Recommended Project Structure (new code only)

```
backend/app/
├── mcp/                              # NEW package — the outside MCP edge. Not engine code.
│   ├── __init__.py
│   ├── server.py                     # builds the SDK server, registers the tool families, stateless
│   ├── auth_asgi.py                  # pure-ASGI Bearer → McpPrincipal (contextvar), one 401 body
│   ├── refusals.py                   # the house sentences + the one "Not found." for every miss
│   └── tools/
│       ├── search.py                 # search_knowledge → retrieval_service.search_documents
│       ├── documents.py              # list_documents / read_document → acting-member SELECTs
│       ├── ask.py                    # ask_agent → unattended_chat.ask
│       └── workflows.py              # list_workflows / run_workflow / get_run → unattended_launch + key_run_read
├── security/
│   ├── api_key_auth.py               # MODIFIED: authenticate_presented_key() extracted
│   ├── mcp_principal.py              # NEW
│   └── acting_member.py              # NEW
├── services/
│   ├── unattended_chat.py            # NEW — sibling of unattended_launch.py
│   ├── key_run_read.py               # NEW — moved out of api/inbound.py
│   ├── outside_admission.py          # NEW
│   ├── outbound_guard.py             # NEW
│   └── webhook_drainer.py            # NEW — sibling of notification_drainer.py
├── api/webhooks.py                   # NEW
├── db/webhooks.py                    # NEW
└── models/webhook.py                 # NEW
supabase/migrations/220_… 22N_…       # see §6
frontend/src/
├── lib/api/mcpKeys.ts, lib/api/webhooks.ts       # NEW modules — do NOT grow lib/api.ts (128 phases)
└── components/settings/{mcp,webhooks}/…          # NEW folders beside settings/apiKeys/
```

### Structure Rationale

- **`app/mcp/` is its own package, not a router in `app/api/`.** It is a separate ASGI app with its own transport, auth wrapper and error vocabulary. Keeping it out of `api/` keeps `scripts/build-public-openapi.cjs` and the OpenAPI schema untouched (a `Mount` is not in FastAPI's schema anyway).
- **MCP tools are not engine tools.** `test_259_closed_core_inventory.py` pins `len(_TOOL_REGISTRY) == 30`. The MCP tool handlers call services and must never import from `tool_dispatcher.py` or `services/tools/`, and must never call `handle_search_documents` (which is `ToolContext`-bound, emits SSE events and writes run-scoped audits). That keeps the Extension Contract intact: the MCP server is an outer edge exposing existing capabilities.
- **Siblings, not edits, for the unattended cores.** `unattended_chat.py` sits beside `unattended_launch.py` and `webhook_drainer.py` beside `notification_drainer.py`, so the hot files stay closed.

---

## 3. Architectural Patterns

### Pattern 1: One principal, many credentials (key now, OAuth later)

**What:** Every MCP request resolves to one `McpPrincipal` before any tool runs. Phase-1 credentials are `api_keys` rows with `kind='mcp'`. The OAuth phase adds a second resolver: a Supabase OAuth access token (a JWT carrying `user_id` + `client_id`) plus an app-side `mcp_grants` row keyed by `(user_id, client_id)` that records the org, folder set and tool subset the member picked at consent. Tools only ever see the principal.
**When to use:** Always. It is what lets OAuth land later without touching any tool.
**Trade-offs:** One extra table for OAuth grants. Worth it, because a raw OAuth token carries identity but no org or narrowing, and the key model's narrowing has to survive the switch.

```python
@dataclass(frozen=True)
class McpPrincipal:
    user_id: UUID
    org_id: UUID
    credential_kind: Literal["key", "oauth"]
    credential_id: UUID          # api_keys.id or mcp_grants.id — origin_ref on everything it starts
    label: str
    folder_ids: tuple[UUID, ...] | None   # None = whole org as the member sees it; () is REFUSED at mint
    tools: frozenset[str] | None          # None = all four families
```

### Pattern 2: Act as the member through the uid-synthesized RLS context, narrowed to the key's org

**What:** Every read a tool makes either (a) runs on `get_user_pg_connection(None, {"id": principal.user_id})`, or (b) is a service-role read with explicit `org_id = principal.org_id AND <owner/visibility>` predicates that a parity test proves equal to (a). Org narrowing comes from a transaction-local GUC that `current_user_org_ids()` intersects with when it is set:

```sql
-- migration 22x: narrowing only; unset GUC = byte-identical behaviour
CREATE OR REPLACE FUNCTION public.current_user_org_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT org_id FROM public.org_members
   WHERE user_id = auth.uid()
     AND (nullif(current_setting('app.acting_org_id', true), '') IS NULL
          OR org_id = nullif(current_setting('app.acting_org_id', true), '')::uuid);
$$;
```

```python
# dependencies._apply_rls_user_context — the ONE hot edit: read a contextvar, set_config(..., true)
_acting_org: ContextVar[str | None] = ContextVar("acting_org_id", default=None)
...
org = _acting_org.get()
if org:
    await conn.execute("SELECT set_config('app.acting_org_id', $1, true)", org)
```

**Why a GUC and not folder lists or an RPC parameter:** a folder list cannot express root documents (`folder_id IS NULL`, which 298's `root_upload_org` creates). An RPC parameter would have to be added to `match_document_chunks`, the keyword RPC, every RLS policy and every DEFINER function separately — five-plus homes for one rule. The GUC narrows every policy that already calls `current_user_org_ids()` in one place, it is `SET LOCAL` (`is_local := true`) so it cannot leak to the next pool borrower, and it can only shrink the set.
**Trade-offs:** It touches a SECURITY DEFINER function every RLS policy depends on. The phase that does it must (1) EXPLAIN-check that the `(SELECT current_user_org_ids())` initPlan shape survives, (2) run the backend baseline gate, and (3) prove "unset = identical" with the existing RLS harness. **Confidence: MEDIUM.** This is a recommendation to validate, not a measured result.
**Proof of "sees exactly what the member sees" (required deliverable):** a parity integration test on the Phase-163 RLS harness (`tests/integration/_rls_harness`). Use a fixture member in two orgs, with owned, org-shared-folder, connection-visible, private-to-someone-else, archived/non-retrievable and root documents. Assert that the MCP `list_documents` id set == the browser path's id set with `X-Org-Id = key org` (user-JWT PostgREST), that `search_knowledge` never returns a chunk whose document is outside that set, and that the other org's documents appear in neither. Add a negative arm: revoke membership and the next call is a 401. Without this test, the "exactly" claim is an assertion and not a proof.

### Pattern 3: Unattended chat core beside the unattended workflow core

**What:** `unattended_chat.ask(principal, question, conversation_id=None, wait_seconds=N)`:
1. Admission check (Pattern 5), then the per-key `start` limit.
2. Thread: if `conversation_id` is given it must be a thread with `origin_kind='mcp' AND origin_ref=<credential> AND user_id=<owner>` (the D-12 one-query rule: every miss is the same 404). Otherwise insert a new thread through the pool with `org_id`, title `"<first words> · via <label>"` and origin columns. **It is a visible thread in the owner's history**, the same choice 293 made for key-started workflow runs.
3. Insert the user message through the pool (`org_id` explicit, `run_origin` set).
4. Model: `run_model_resolution.resolve_owner_run_model(owner_id)` (300 already built the owner-pair resolution for unattended runs).
5. `register_run_start(pool=…, org_id=principal.org_id, …)`, then spawn `run_producer.run_producer(..., current_user={"id": owner, "org_id": org}, supabase=service_role, scoping=ThreadScoping(effective_folder_ids=<key folder subtree ids or None>, ...))`, registered in `RUN_TASKS` with the `_spawn` strong reference.
6. Await: `XREAD BLOCK` on `run:{run_id}` until the terminal sentinel or `wait_seconds` runs out (Redis, so it works whichever worker owns the producer). Then read the persisted assistant message from Postgres, which is the source of truth (Realtime/stream is a hint). On timeout, return `{status: "running", run_id, conversation_id}`, and the client calls `get_answer(run_id)`.
**When to use:** MCP `ask_agent` only. In-app chat stays on `send_message`.
**Trade-offs:** It duplicates roughly 60 lines of `send_message` preflight (thread ownership, message insert, run registration). That is deliberate: `threads.py` is at 97 phases. The duplication should be one service with tests that pin parity on the `runs` / `messages` row shapes, and the module docblock should name `send_message` as its twin (the 293 "share, not copy" note applies the other way here, because sharing would mean editing the hottest backend file).
**Hard limits:** `wait_seconds` must stay under the proxy's `proxy_read_timeout 300s` (onebox nginx) and Traefik's equivalent. Recommend a 120 s default, operator-tunable. An `ask_user` interrupt or a connector approval pause is answered in the app, never over MCP (293's D-10 rule): the tool returns `waiting_for_person` with WHO, never the question.

### Pattern 4: Trigger-fed outbox, drained by every worker (webhooks)

**What:** Copy Phase 300 exactly. Postgres triggers fan out `webhook_deliveries` rows for matching subscriptions. `WebhookDrainer` runs in every worker, claims with `FOR UPDATE SKIP LOCKED` and a `sending` flip plus a lease, freezes the payload at first claim, sends, and records the outcome. The `webhook-id` header is the delivery id, stable across retries, so receivers can dedupe; delivery is at-least-once by design.
**Triggers:**
- `workflow_runs AFTER UPDATE OF status … WHEN (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('completed','failed','cancelled'))`. This is the same predicate as `workflow_runs_notify_on_status`; add a second trigger rather than editing 300's function. It fans out to subscriptions in `NEW.org_id` with `'run.finished' = ANY(events)` and `user_id = NEW.user_id` (owner-own runs by default). It skips `is_golden_run` (publish practice runs).
- `documents AFTER UPDATE OF status … WHEN (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('completed','failed') AND NEW.is_latest)`. This catches every writer: `ingest_splice.py:1126`, `api/documents.py:2677`, watch sync and email ingestion. A Python emit at each writer would be four or more homes that drift.
- Both functions `RAISE WARNING` and swallow (the 300 precedent), so a webhook defect can never fail a run's or a document's status update.
**Visibility is re-checked at delivery, as the subscriber, under the acting-member context narrowed to the subscription's org** (and the subscription's folder set for documents). This is the 300 "still waiting / still a member" re-check. A trigger cannot evaluate `auth.uid()` RLS for each subscriber, so the trigger fans out by org and the drainer decides: not visible → `skipped_not_visible`, nothing sent.
**Trade-offs:** A watch sync that ingests 5,000 documents fans out 5,000 deliveries per subscription. Mitigations: an index on `(org_id)` for active subscriptions so the trigger's EXISTS check is cheap for orgs with none, an optional folder filter on the subscription, and per-subscription send pacing in the drainer. Batched "digest" events are a v2 idea, deferred.

### Pattern 5: Admission at the outside door, not in the provider gateway

**What:** SEED-081 is scoped by this milestone to the new paths. Admission sits in front of `unattended_chat.ask`, `run_workflow` and (optionally) 293's `/inbound` start. It is a Redis lease set (sorted set, score = lease expiry) for each of `outside:inflight:org:{org}`, `outside:inflight:cred:{id}` and `outside:inflight:provider:{provider}` (provider resolved before start). It is acquired atomically with a Lua script or a MULTI that prunes expired leases first. It is released on terminal: `on_finish` for unattended workflow runs (the parameter already exists) and the ask core's finalize for chat runs. Leases expire as a backstop against a crashed worker. Refusals answer honestly (*"Your organization already has N outside runs in progress. Try again shortly."*) with `Retry-After`, and **fail closed** (503) when Redis cannot count, the same as `rate_limit.py`.
**Why not in `provider_gateway/dispatcher.py`:** that file fires G-5 (4 phases). A semaphore there changes the in-app hot path for every provider. Retry-After honouring inside the gateway is the real SEED-081 fix, and it belongs to a later scale milestone.

### Pattern 6: Redact at the two new egress boundaries only

**What:** `outbound_guard.redact_outbound()` is a pure function that runs on (a) every MCP tool result's text fields (chunk content, document text, agent answer, run output) and (b) every webhook payload's free-text fields, never on ids, statuses or URLs. The policy is per-org (`organizations.settings.outbound_redaction`: `off | mask | block`) with an operator default in `app_settings`. Counts of what was redacted go in the audit row's metadata; the redacted values never do.
**Why only there:** SEED-079 covers ingestion, provider egress and LangSmith too. Redacting retrieval context in-app would change chat answers for every user. This milestone's promise is "what MCP and webhooks send out", so the seam sits at those two serializers.
**Webhook payloads should be thin by default:** ids, kind, status, timestamps, a deep link (`/app/...` addresses exist since Phase 297), and a bounded, redacted `output_excerpt`. The receiver fetches the full result through MCP or `/inbound` with a credential. A thin payload is the strongest PII control there is.

---

## 4. Data Flow

### Request flow: one MCP tool call

```
POST /mcp (or /api/mcp behind onebox nginx — X-Forwarded-Prefix /api)
  → CORSMiddleware (outermost; expose Mcp-Session-Id only if a stateful leg is ever enabled)
  → SetupMiddleware (unfinalized box → 503, fine)
  → MaintenanceMiddleware  ⚠ every MCP call is a POST → 503 under maintenance (decision, §8)
  → CanvasGateMiddleware   (not gated; /mcp is not a canvas path)
  → Mount("/mcp") → McpAuthASGI
        enforce_ip_limit (rate_limit.py, fail closed)
        authenticate_presented_key(token, expected_kind='mcp')  ← live re-check every call
        operator switch (app_settings.mcp_enabled) → org switch (organizations.settings.mcp_enabled)
        set McpPrincipal + acting_org contextvars
  → MCP SDK (stateless_http=True) → tools/call
        tool in principal.tools?            else refusal (audited)
        enforce_key_limit(kind='mcp_read'|'mcp_start')
        outside_admission.acquire()          (start-type tools only)
        service call as the member (§3 P2/P3)
        outbound_guard.redact_outbound()
        audit (mcp.call / mcp.refused, key id + label, tool, run_id, counts) — AWAITED before an error
  ← JSON-RPC result (JSON or a short SSE response)
```

### Key data flows

1. **search_knowledge.** `load_user_settings(owner)` → folder scope = expand `principal.folder_ids` to subtree ids (`folder_utils`), or `None` → `retrieval_service.search_documents(query, owner_id, service_role_client, user_settings=…, folder_ids=…)` with the acting-org contextvar set, so `_call_as_user` RPCs see only the key's org → redact → return passages with filename / document id / folder. Write a `search.query` audit row with `origin: mcp` so 217's "questions that found it" includes outside queries. ⚠ Pass `folder_ids=None` for unscoped keys, never `[]` (272 D-18: empty means nothing).
2. **list_documents / read_document.** Acting-member `SELECT` on `documents` (or the 207 `library_documents` view) `WHERE is_latest AND retrievable [AND folder_id = ANY(subtree)]`, paged. Read returns `full_markdown` paged by character offset. ⛔ Do **not** reuse `retrieval_documents.fetch_full_document`: it is owner-scoped (`.eq("user_id", user_id)`), a documented fifth read path that hides org-shared documents a member can see (Phase 231 finding). A member-equivalent read has to go through RLS.
3. **run_workflow / get_run.** Candidates = `api_keys_db.list_startable_candidates(user, org)` (+ readable globals), optionally narrowed by the key → the 293 refusal ladder (published, entitlement, template, `foreign_binding_refusal`, `validate_inbound_inputs`) → `launch_unattended_run(..., origin_kind='mcp', origin_ref=credential_id, run_label='mcp-started')`. `get_run` uses `key_run_read` (moved from `inbound.py`). Open decision: should it also read the member's other runs in the org, which the member can see in-app (§8)?
4. **ask_agent.** §3 Pattern 3.
5. **Webhook.** Status UPDATE → trigger fan-out → `webhook_deliveries(pending)` → drainer claims → acting-member visibility re-check → frozen thin payload → redact → Standard-Webhooks headers (`webhook-id`, `webhook-timestamp`, `webhook-signature: v1,<base64 HMAC-SHA256(id.ts.body)>`) → `send_pinned_http('webhook', 'POST', url, content=body)` → 2xx = `sent`, 410 = disable subscription, else `retry` on a backoff schedule → `failed` after N attempts → auto-disable after M consecutive failures, which raises a Phase-301 in-app notice to the owner.

### State management

- **Source of truth:** Postgres (`workflow_runs`, `runs`, `messages`, `webhook_deliveries`). Redis streams, limiter buckets and admission leases are transport and counters only (D-v2.5-03).
- **No MCP session state.** Use `stateless_http=True` (or the 2026-07-28 protocol's sessionless default), so either worker answers any request. SDK docs: legacy stateful sessions live in one worker's memory and 404 on the other worker without sticky routing. Nothing here needs server-to-client sampling or elicitation.

---

## 5. Integration Points

### Internal boundaries

| Boundary | Communication | Notes |
|---|---|---|
| `app/mcp/*` → `security/api_key_auth.py` | direct call of the extracted `authenticate_presented_key` | `resolve_api_key` keeps its exact behaviour (`test_293_key_auth.py` must stay green unmodified) |
| `app/mcp/*` → `dependencies._apply_rls_user_context` | via the `acting_org` contextvar | ⚠ contextvars copy into tasks created with `create_task`. Set it only inside tool handlers, never in a lifespan or drainer context, so it cannot leak into an in-app run |
| `unattended_chat` → `run_producer.run_producer` | direct call, late import | no edit to `run_producer.py`; `ThreadScoping` is data |
| `unattended_chat` → `run_lifecycle.register_run_start` / `finalize_run_terminal` | direct call | already pool-based, no JWT |
| MCP workflows → `unattended_launch.launch_unattended_run` | direct call | already takes `origin_kind/label/ref` and `on_finish`; no code edit, only the DB CHECK widens to `'mcp'` |
| MCP `get_run` & `/inbound/runs/{id}` → `key_run_read` | shared service | pure-move extraction FIRST (G-5 discipline: `inbound.py` is at 3 phases) |
| `WebhookDrainer` → `security/egress.send_pinned_http` | new `webhook` capability | HTTPS only, caller host, DNS-pinned, redirects refused, response cap |
| `WebhookDrainer` → `security/secret_cipher` | decrypt the signing secret per send | `get_cipher()` returns `None` when no key is configured → creating a webhook must fail closed |
| `main.py` lifespan → `mcp.session_manager.run()` + `WebhookDrainer.start()` | lifespan block | the SDK raises "Task group is not initialized" if the mounted app's session manager is not entered in the HOST lifespan |
| audit → `audit_log` CHECK | migration + `audit_service.VALID_ACTION_TYPES` in lockstep | ⚠ `assert_action_types_synced` runs at boot: **apply the migration before deploying the code** or both workers refuse to start |

### External services

| Service | Integration pattern | Notes |
|---|---|---|
| MCP clients (Claude Desktop/Code, Cursor, Claude.ai) | Streamable HTTP at `/mcp` | SDK `TransportSecuritySettings.allowed_hosts` must include the public API host (derive from `BACKEND_PUBLIC_URL`) or every request gets 421 behind a real hostname |
| Supabase Auth OAuth 2.1 server (OAuth phase) | Authorization server (DCR, PKCE); our `/mcp` is the resource server publishing RFC 9728 metadata | Public beta since 2025-11-26. The app must host the consent page. Discovery path differs between doc copies; verify on a live project. Local CLI support unverified |
| Customer webhook endpoints | Signed POST from the drainer | SSRF: refuse private/loopback/RFC1918 via `validate_destination`; re-validate at every send (DNS can change) |
| LLM providers | unchanged (through `open_stream`) | admission is at the door; the gateway is not edited |

---

## 6. New tables, columns and RLS (migrations from 220)

| # | Change | RLS / grants |
|---|---|---|
| 220 | `api_keys` + `kind text NOT NULL DEFAULT 'workflow' CHECK (kind IN ('workflow','mcp'))`, `folder_ids uuid[] NULL`, `tools text[] NULL`; relax `workflows` CHECK to `kind <> 'workflow' OR jsonb_array_length(workflows) >= 1`. Separate prefix `srl_mcp_` so a workflow key can never authenticate MCP and the reverse | existing: SELECT-own for `authenticated` (column grant excludes `key_hash`), service_role writes. Add the new columns to the column grant |
| 220 | `workflow_runs_origin_kind_check` + `'mcp'`; `threads` + `origin_kind/origin_label/origin_ref` (frozen by a trigger like `workflow_runs_origin_immutable`, nulled on client insert); `runs` + `origin_kind` for chat runs started over MCP | existing table policies unchanged; the origin columns are not client-writable (trigger) |
| 221 | `current_user_org_ids()` reads `app.acting_org_id` (narrowing only) | function grants unchanged (revoke PUBLIC/anon, grant authenticated/service_role) |
| 221 | `organizations.settings.mcp_enabled` / `webhooks_enabled` / `outbound_redaction` (jsonb keys, no DDL) + `app_settings` columns `mcp_enabled`, `mcp_reads_per_minute`, `mcp_starts_per_minute`, `outside_max_inflight_per_org`, `…_per_credential`, `…_per_provider`, `mcp_ask_wait_seconds`, `webhook_max_attempts`, `webhook_disable_after_failures`, `outbound_redaction_default` with bound CHECKs (the 215 precedent) | app_settings: existing posture (the 177 fix: RLS on, no anon) |
| 222 | `webhook_subscriptions (id, org_id, user_id, label, url, events text[], folder_ids uuid[] NULL, secret_enc text, secret_prev_enc text NULL, status active/paused/disabled/revoked, consecutive_failures, disabled_reason, created_at, revoked_at/by)` + autofill-org trigger | RLS on; SELECT own (`auth.uid() = user_id AND org_id IN current_user_org_ids()`) with a column grant that excludes `secret_enc`; org-admin reads go through the backend pool behind `require_org_manage` (the 293 pattern); writes service_role only |
| 222 | `webhook_deliveries (id, subscription_id FK, org_id, event_kind, subject_id, payload jsonb NULL (frozen at first claim), status pending/retry/sending/sent/failed/skipped_not_visible/skipped_disabled, attempts, due_at, lease_until, last_status_code, last_error, created_at, sent_at)`, `UNIQUE (subscription_id, event_kind, subject_id, <event instance>)`, partial index `(status, due_at) WHERE status IN ('pending','retry')` | RLS on; SELECT for the subscription owner (delivery log); service_role writes. A deny-all-to-clients outbox, like `notification_deliveries` |
| 222 | triggers `workflow_runs_webhook_on_status`, `documents_webhook_on_status`: SECURITY DEFINER, `SET search_path = ''`, swallow-and-warn, EXECUTE revoked from PUBLIC/anon/authenticated | run `get_advisors(security)` after applying (CLAUDE.md: revoke from **PUBLIC**, not just anon) |
| 22x | `audit_log_action_type_check` + `mcp.call`, `mcp.refused`, `webhook.create`, `webhook.revoke`, `webhook.rotate`, `webhook.disable` | `VALID_ACTION_TYPES` in the same commit |
| 22y (OAuth phase) | `mcp_grants (id, user_id, org_id, client_id, client_name, folder_ids, tools, created_at, revoked_at)` | SELECT own; admin via pool |

Deploy parity: each migration is pasted into cloud before the code ships (boot-time audit sync, and run origin columns are read by the UI). Run `get_advisors(security)` after each. No new env vars are expected. If one appears (for example an MCP allowed-hosts override), it owes `deploy/onebox.env.example`, `docs/OPERATOR.md` and `check-deploy-drift.sh` in the same commit.

---

## 7. Hot-file collisions (G-5) — measured 2026-10-30 with the ledger recipe

| File | Phases (ledger / recipe) | What v4.9 would do | Verdict |
|---|---|---|---|
| `backend/app/api/threads.py` | **97** | nothing | ⛔ **Do not touch.** The ask core is a sibling service calling `run_producer`; never route MCP through `send_message` |
| `backend/app/services/agent_loop.py` | 36 | nothing | ⛔ do not touch |
| `backend/app/services/run_producer.py` | 14 | called only | no edit; `ThreadScoping` is data |
| `backend/app/main.py` | **73** | one `Mount("/mcp", …)`, lifespan: `session_manager.run()` + `WebhookDrainer` start/stop | ⚠ FIRES. Unavoidable. Keep it to one mount + one lifespan block per phase, the 301 "one include_router" discipline |
| `backend/app/dependencies.py` | 12 | ~6 lines in `_apply_rls_user_context` (contextvar → `set_config(…, true)`) | ⚠ FIRES. The one sanctioned edit; everything else lives in `security/acting_member.py` |
| `backend/app/security/egress.py` | 5 | add the `webhook` capability to the closed set (`_TLS_SCHEMES`, `_HOST_MATCH` caller mode) | ⚠ FIRES. Additive data entries only; driven RED for the private-IP / redirect / bad-scheme cases |
| `backend/app/services/audit_service.py` | 10 | lockstep literals | ⚠ FIRES. Data only (the 298-03 precedent) |
| `backend/app/models/user_settings.py` | 38 | new `app_settings` fields | ⚠ FIRES. Additive fields + `_val` lines (the 300-03 precedent) |
| `backend/app/api/settings.py` | 26 | operator knobs | ⚠ FIRES. Additive (the 300-05 precedent) |
| `backend/app/api/inbound.py` | 3 | pure-move of the run-read composition into `services/key_run_read.py`; `resolve_api_key` signature unchanged | ⚠ FIRES. **Extraction first, behaviour after** |
| `backend/app/services/unattended_launch.py` | 3 | none expected (origin params exist) | FIRES; aim for zero edits |
| `backend/app/services/tools/render_template.py` | 3 | the BUG-261022-01 fix | ⚠ FIRES (1163 lines). Fix inside the driver / integrity check only; RED drive through the real sandbox driver first |
| `backend/app/services/provider_gateway/dispatcher.py` | 4 | nothing (admission is at the door) | ⛔ keep out |
| `backend/app/db/workflows.py` | 32 | nothing; use `db/api_keys.py` helpers | keep out |
| `frontend/src/lib/api.ts` | **128** | nothing; new `lib/api/mcpKeys.ts`, `lib/api/webhooks.ts` | keep out |
| `frontend/src/pages/SettingsPage.tsx` | 31 | one tab mount each for MCP and Webhooks | ⚠ FIRES. One mount line per phase |
| `frontend/src/components/settings/apiKeys/apiKeysCopy.ts`, `apiKeyFacts.ts` | 3 / 3 | only if MCP keys share the API-keys tab | ⚠ FIRES. Prefer a sibling `settings/mcp/` folder that reuses `ApiKeySecretOnce`/`RevokeApiKeySheet` by import |
| `frontend/src/components/org/OrgAdminShell.tsx` | 6 | org MCP / webhook switch + admin lists | ⚠ FIRES. The tabs seam was taken in 293-04 (`orgAdminTabs.ts`); add data entries there |
| `scripts/vitest-count-gate.cjs` | 85 | new pins for new suites | routine; never lower a pin |
| `scripts/full-schema-supplement.sql` | 19 | only if a new table joins the Realtime publication (webhook delivery log live updates) | avoid; poll the delivery log instead |
| Not yet in the ledger: `security/api_key_auth.py` (1), `db/api_keys.py` (2), `api/api_keys.py` (2), `services/rate_limit.py` (2), `db/notifications.py` (2), `services/notification_drainer.py` (1), `middleware/maintenance.py` (1, no row) | — | extract-auth-core, `kind` column, new limiter kinds | below threshold; **`middleware/maintenance.py` and `services/ingestion_queue_service.py` have NO ledger row**, so `check-hot-file-ledger.cjs` will fail a plan that names them until a row is added |

---

## 8. Decisions the roadmap must surface (not resolved by code reading)

1. **Maintenance mode vs MCP.** Every MCP message is a POST, so `MaintenanceMiddleware` would 503 read-only tools too. Recommend allow-listing `/mcp` in the middleware and enforcing "no starts under maintenance" in the start-type tools (the honest per-tool answer). The alternative is to accept a whole-door 503.
2. **What `get_run` may read.** Runs this credential started (293's D-12 posture), or every run the member can read in the org (true member-equivalence)? Recommend credential-started plus the member's own runs, never org-mates' runs, and decide it explicitly.
3. **Org narrowing mechanism.** The GUC in `current_user_org_ids()` (recommended) vs an explicit `p_org_ids` on each retrieval RPC. This needs an EXPLAIN check and the backend baseline gate in the phase that does it.
4. **Does the in-app chat also get org-narrowed search?** Out of scope (it would change today's chat answers for two-org members). Plant a seed. The GUC makes it a one-line follow-up.
5. **MCP SDK version vs pinned deps.** `mcp` 2.3.0 (PyPI, latest) requires `sse-starlette>=3.0.0` and `httpx2`. The backend pins `sse-starlette==2.4.1` (the chat SSE path) and runs `starlette 0.41.3`. Bumping `sse-starlette` touches the chat SSE transport, so the STACK research must decide between bump+UAT, an older 1.x `mcp` line, or a hand-rolled JSON-RPC server (`mcp_client.py` is already hand-rolled on the client side). **This gates Phase B.**
6. **Webhook ownership.** Member-owned (mirrors keys; visibility = the owner's) vs org-owned (admin-managed). Recommend member-owned with admin list/revoke/kill, matching 293.

---

## 9. Suggested build order (phases from 303)

Dependencies first, so each phase ships something usable and the security core is proven before anything uses it.

| Phase | Scope | Depends on | Why here |
|---|---|---|---|
| **303 — Word template fix** (BUG-261022-01) | RED repro through `_RENDER_DRIVER_SRC` with a bare-token library template; then coerce a cited record to its `.value` at render, **or** extend `assert_integrity` to fail on a rendered record repr. Keep it as a fast phase if it really is a few lines (G-3) | nothing | Independent and quick. It clears a known-open major bug before the milestone's new surface lands, and can run in parallel with 304 |
| **304 — Acting member + personal MCP keys** | Migration 220/221 (key `kind`, folder set, tools, origin columns, GUC narrowing, settings knobs, audit literals). Extract `authenticate_presented_key`. `McpPrincipal`, `acting_member.py`, the `dependencies.py` contextvar edit. Key mint/list/revoke for `kind='mcp'`, org-admin view, org + operator MCP switches, Settings UI. **The parity test (§3 P2) is the phase's headline must-have** | — | Every tool, OAuth and webhook visibility depend on "act as member in org Y" being proven. Ship it with no transport so it is reviewed on its own |
| **305 — MCP server + read tools** | Resolve the SDK/dependency decision (§8.5). `app/mcp/` package, stateless mount in `main.py`, `McpAuthASGI`, host allowlist from `BACKEND_PUBLIC_URL`, per-key read limits, audit, `search_knowledge`, `list_documents`, `read_document`. **`outbound_guard.py` ships here**, because this is the first phase that sends content out. Maintenance decision (§8.1). Cross-client UAT: Claude Desktop, Claude Code, Cursor | 304 | Read-only first: the lowest-risk way to prove transport, auth, limits and redaction end to end |
| **306 — Ask the agent + run workflows over MCP + admission** | `key_run_read` pure-move extraction first. Then `unattended_chat.py`, `ask_agent` + `get_answer`, `list_workflows` / `run_workflow` / `get_run`, `outside_admission.py` (SEED-081 scoped), optionally applied to `/inbound` starts too. Full 8-row cross-provider scoreboard (it touches the agent loop's run path) | 304, 305 | Start-type tools cost money and create threads, so they come after the read path is proven. Admission lands with the first thing it guards |
| **307 — Outbound webhooks** | Migration 222, triggers, `WebhookDrainer`, `egress.py` `webhook` capability, Standard-Webhooks signing, retries + auto-disable + 301 notice, delivery log, "send test", member + admin UI. Reuses `outbound_guard` and the acting-member re-check | 304 (acting member), 305 (`outbound_guard`) | Independent of 306 beyond shared seams. It can run in parallel with 306 if the DB-mutating test suites are serialized (worktree rule 4) |
| **308 — OAuth 2.1 sign-in for MCP** | Supabase OAuth 2.1 server as the AS (enable DCR), RFC 9728 protected-resource metadata on `/mcp`, consent page in the app (pick org, folder set, tools → `mcp_grants`), token verification (JWKS or GoTrue) → `McpPrincipal`. Routing: `/.well-known/oauth-protected-resource…` must reach the backend. ⚠ The onebox nginx only proxies `/api/*`, so the root `.well-known` path would hit the SPA. Claude.ai custom-connector UAT | 304, 305 | Last, because it depends on a beta external service and has the most deploy-parity surface (cloud Auth config, redirect URLs, local CLI support unknown) |
| **309 — Close-out** (optional, inside the 6–7 target) | Public docs (MCP quick-start per client, webhook verification snippets), landing facts, G-4 lived-experience rows, seeds sweep (SEED-013/177/195/081/079 status flips), deploy parity | all | The milestone's promise is outside use without opening the app, so the docs are the product |

**Ordering rationale:** 304 is the trust root. 305 proves transport and redaction on reads before 306 adds spending writes. 307 shares 304/305's seams but nothing of 306's, so it parallelises. 308 swaps only the credential resolver behind the same principal, which is why Pattern 1 is set up in 304.

**Research flags:** 305 (SDK version vs `sse-starlette` pin; stateless behaviour across the two workers; Claude Desktop/Cursor auth header support for a static bearer) and 308 (Supabase OAuth server discovery path, local CLI support, consent-page contract, `.well-known` routing on onebox and Vercel/Coolify) need phase research. 303, 304 and 307 follow established in-repo patterns (215, 293, 300).

---

## 10. Anti-Patterns

### Anti-Pattern 1: Minting a Supabase JWT for the key's owner
**What people do:** Sign a short-lived JWT so the existing PostgREST user-client paths "just work".
**Why it's wrong:** No signing secret exists in config, cloud projects may use asymmetric signing keys, it adds a forgeable-identity secret to deploy parity, and a token can expire mid-run (the reason 163 chose uid-synthesized claims).
**Do this instead:** `get_user_pg_connection(None, {"id": uid})` plus the org GUC, and asyncpg reads.

### Anti-Pattern 2: Routing MCP "ask" through `send_message`
**What people do:** Fake a Request with headers and call the route.
**Why it's wrong:** It needs a user-JWT client, it edits or couples to a 97-phase file, and its preflight runs on PostgREST.
**Do this instead:** `unattended_chat.py` calling `run_producer` with `ThreadScoping`.

### Anti-Pattern 3: Registering MCP tools in `_TOOL_REGISTRY` or calling `handle_search_documents`
**Why it's wrong:** It breaks the closed-core inventory pin (30 tools), drags `ToolContext`/SSE emit semantics into a request path, and violates the Extension Contract.
**Do this instead:** Call services (`retrieval_service.search_documents`, `launch_unattended_run`).

### Anti-Pattern 4: Emitting webhooks from Python at each writer
**Why it's wrong:** Document completion has 4+ writers and run terminalization several. A Python emit per site drifts, which is the 231 "fifth definition" hazard.
**Do this instead:** One trigger per event and one drainer (the Phase 300 pattern).

### Anti-Pattern 5: A process-local limiter or admission counter
**Why it's wrong:** Two workers admit twice the limit (`rate_limit.py` documents this against `api/setup.py`'s dict).
**Do this instead:** Redis, atomic, fail closed.

### Anti-Pattern 6: `folder_ids=[]` meaning "no narrowing"
**Why it's wrong:** 272 D-18 says empty means nothing, and the reverse coercion widens to every org.
**Do this instead:** Refuse an empty folder set at mint time. `None` = whole org (narrowed by the GUC).

### Anti-Pattern 7: Stateful MCP sessions on two workers
**Why it's wrong:** A legacy session lives in one worker's memory, so the next request 404s on the other worker.
**Do this instead:** `stateless_http=True` (legacy leg) or the sessionless 2026-07-28 protocol. No sticky sessions.

---

## 11. Scaling Considerations

| Concern | Small team (today) | Hosted multi-tenant | Notes |
|---|---|---|---|
| MCP request load | stateless, 2 workers | add workers; stateless scales linearly | per-key + per-IP Redis limits already shared |
| Provider pressure from outside runs | admission caps per org / credential / provider | caps become the binding control; true SEED-081 gateway backoff needed | door-level only this milestone |
| Long `ask_agent` calls | bounded wait (120 s), then poll | same; worker connections held during the wait | keep the wait under proxy timeouts (300 s nginx) |
| Webhook fan-out on bulk ingest | fine | 1 delivery per document per subscription becomes thousands | folder filters, drainer pacing, a future digest event |
| Outbox growth | small | retention sweep on `webhook_deliveries` (e.g. 30 days) | the 300 tables have no sweep yet either; plant a seed |

**First bottleneck:** provider rate limits from parallel `ask_agent` calls, which admission bounds. **Second:** the webhook outbox during a watch sync.

---

## Sources

- Code read at `f267f2949` (HIGH): `backend/app/api/inbound.py`, `api/api_keys.py`, `security/api_key_auth.py`, `services/rate_limit.py`, `dependencies.py` (`_apply_rls_user_context`, `get_user_pg_connection`, `get_active_org_id`), `services/retrieval_service.py`, `retrieval_rpc.py`, `retrieval_scope.py`, `retrieval_documents.py`, `search_documents_tool.py`, `run_producer.py` (`run_producer`, `ThreadScoping`, `spawn_continuation_run`), `run_lifecycle.py`, `unattended_launch.py`, `run_model_resolution.py`, `notification_drainer.py`, `db/notifications.py`, `security/egress.py`, `security/secret_cipher.py`, `middleware/maintenance.py`, `main.py`, `frontend/nginx.conf`; migrations `215_api_keys_and_run_origin.sql`, `218_run_waiting_notifications.sql`; `supabase/full-schema.sql` (`current_user_org_ids`, `match_document_chunks`, `organizations`, `documents_status_check`)
- `docs/EXTENSION-CONTRACT.md`; `backend/tests/unit/test_259_closed_core_inventory.py` (30-tool pin)
- Seeds: SEED-081, SEED-079, SEED-195; bug BUG-261022-01
- MCP Python SDK docs (MEDIUM): https://py.sdk.modelcontextprotocol.io/run/asgi/, https://py.sdk.modelcontextprotocol.io/run/authorization/, https://py.sdk.modelcontextprotocol.io/run/deploy/
- PyPI `mcp` 2.3.0 requirements (HIGH for the dependency conflict): https://pypi.org/pypi/mcp/json
- Supabase OAuth 2.1 server (MEDIUM-LOW, beta): [OAuth 2.1 Server](https://supabase.com/docs/guides/auth/oauth-server), [MCP Authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication), [changelog](https://supabase.com/changelog/38022-oauth-2-1-server-capabilities-for-supabase-auth)

---
*Architecture research for: v4.9 Use It From Your Own Tools*
*Researched: 2026-10-30*

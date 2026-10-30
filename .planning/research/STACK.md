# Stack Research: v4.9 "Use It From Your Own Tools"

**Domain:** making an existing FastAPI RAG and agent platform reachable from outside: a remote MCP server, personal and OAuth credentials, outbound webhooks, admission control and PII redaction
**Researched:** 2026-10-30
**Confidence:** HIGH for the MCP SDK, the spec and the dependency resolution. MEDIUM for the OAuth authorization-server choice. MEDIUM for PII.

> Scope: this file covers only the stack these new capabilities need. The existing stack is unchanged: FastAPI 0.115.6, Starlette 0.41.3, Pydantic 2.12.5, uvicorn 0.32.1 with `--workers 2`, redis-py 5.3.1, asyncpg, httpx 0.28.1, PyJWT 2.12.1, cryptography 46.0.7, Python 3.12 (`python:3.12-slim`). Every version below comes from the installed venv (`pip list`) or from PyPI JSON, read 2026-10-30.

---

## TL;DR: what changes in `requirements.txt`

| Change | Line | Why |
|---|---|---|
| **ADD** | `mcp>=2.3.0,<3` | The official SDK, at current stable 2.3.0 (2026-10-02). It provides the Streamable HTTP server, the protected-resource metadata, the `WWW-Authenticate` challenge and the `TokenVerifier` hook. |
| **BUMP** | `sse-starlette==2.4.1` → `sse-starlette>=3.0.3,<3.1` | Forced by `mcp` 2.x (`sse-starlette>=3.0.0`). Measured with a pip dry-run: `mcp==2.3.0` + `fastapi==0.115.6` resolves to **sse-starlette 3.0.3 with Starlette 0.41.3 unchanged**, so **no FastAPI or Starlette upgrade is needed**. Cap below 3.1, because sse-starlette 3.6.0 requires `starlette>=0.49.1`, which FastAPI 0.115.6 forbids (`starlette<0.42`). |
| **ADD (test only)** | `standardwebhooks==1.1.0` | Used only to verify that our hand-rolled signer interoperates with the reference verifier. It installs alone, with no transitive dependencies (measured). |
| **DO NOT ADD** | `authlib`, `fastmcp`, `svix`, `presidio-analyzer`/`spacy`, `limits`, `aiolimiter`, `celery`/`arq`/`rq`, Kafka/NATS | See "What NOT to use". |

Transitive dependencies that `mcp` 2.3.0 pulls in (measured): `mcp-types 2.3.0`, `httpx2 2.16.0`, `httpcore2 2.16.0`, `truststore 0.10.5`, `opentelemetry-api 1.45.2`, `idna 3.20`. `httpx2` has its own import name and sits beside our `httpx` 0.28 without conflict.

⚠ **The sse-starlette bump trips a guard deliberately.** `backend/tests/integration/test_059_disconnect.py` (lines 65-93) and `tests/conftest.py:332` reset `sse_starlette.sse.AppStatus.should_exit_event` and **assert that the version is 2.4.x**. sse-starlette 3.0.0 replaced that global with context-local events (its release notes say "No breaking changes expected" and "Automatic Test Isolation: No more manual state resets needed"). The phase that adds `mcp` must re-validate the two SSE endpoints that use it (`api/runs.py:44`, `api/skill_tuner.py:56`) and retire that fixture consciously, in the same `D-NN` spirit as the retired `test_189_no_egress` fence. It must not loosen the version assertion silently.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|---|---|---|---|
| **`mcp` (official MCP Python SDK), `MCPServer` + `streamable_http_app()`** | **2.3.0** (`>=2.3.0,<3`) | The remote MCP server over Streamable HTTP, mounted inside the existing FastAPI app | It is the reference implementation, and 2.x is the supported line (SECURITY.md: "1.x newest release … maintenance: critical bug fixes and security fixes" only). It serves **both protocol eras from one app**. Spec **2026-07-28** is sessionless, so "any worker serves any request". Clients still on **2025-11-25 and earlier**, which today is most of them, get a per-request throwaway session under `stateless_http=True`. That property is what makes `WORKER_COUNT=2` work with no sticky sessions and no shared session store. The SDK also provides `AuthSettings` + `TokenVerifier`, the RFC 9728 metadata route and the 401 `WWW-Authenticate` challenge, so we never hand-write them. |
| **MCP spec revision 2026-07-28** (current) | — | The protocol we target | Per modelcontextprotocol.io/specification/versioning, this is the current revision. The SDK negotiates per request through the `MCP-Protocol-Version` header and needs no era knob. |
| **Our own OAuth 2.1 authorization server, thin, issuing opaque tokens that are MCP keys** | no library (stdlib `hashlib`/`secrets` + the SDK's pydantic wire models in `mcp.shared.auth`) | OAuth sign-in so Claude.ai custom connectors can connect | See "OAuth decision" below. In short: an OAuth access token becomes **a personal MCP key minted through a consent screen**. It has the same table, the same scope model (user + optional folders + tool subset), the same SHA-256-at-rest, the same live re-check on every call and the same audit trail as the Phase 293 keys. Audience binding (RFC 8707) is trivially exact because we issue the token for exactly one resource. Confidence: MEDIUM. Flagged for phase research. |
| **Postgres outbox + per-worker drainer (existing pattern)** | — (asyncpg, already present) | Webhook delivery, retry and audit | This is the exact pattern Phase 300 shipped for email (`db/notifications.py` + `services/notification_drainer.py`): DB trigger → `*_deliveries` row → `FOR UPDATE SKIP LOCKED` claim with the `'sending'` flip inside the claiming transaction → payload frozen at first claim → `next_attempt_at` backoff → stale-claim reclaim. It needs no leader election and no new infrastructure, and the row *is* the audit record. Redis stays a hint (D-v2.5-03), never the system of record for something we promised to retry. |
| **Standard Webhooks spec (v1 = HMAC-SHA256), hand-rolled signer** | spec, not a dependency | Signing outbound webhooks | It is the de-facto standard, and the format Svix, Supabase, Clerk and others emit. The headers are `webhook-id`, `webhook-timestamp`, `webhook-signature: v1,<base64>` over `"{id}.{ts}.{body}"`, with secrets as `whsec_` + base64 of 24-64 random bytes, and **space-delimited multiple signatures for rotation**. It is about 30 lines of stdlib `hmac` + `base64`. A library cannot be used for *sending* anyway, because every outbound byte must leave through `egress.send_pinned_http` (SSRF pinning, no redirects). |
| **Redis Lua admission semaphore (existing pattern)** | redis-py 5.3.1 (present) | Provider admission control for outside traffic | `task_service.py:133` and `citation_checks.py:183` already run atomic Lua acquire and release-if-owned scripts. An admission limiter keyed by **provider account** (not by API key) has to be shared across both workers, which in-process limiters cannot be. It must **fail closed**, the same rule as `rate_limit.py` D-15. |
| **In-house deterministic redactor** (`app/security/redaction.py`) | stdlib `re` + checksum validators | PII redaction on the MCP and webhook outbound paths | Typed recognizers: email; card numbers with **Luhn**; IBAN with **mod-97**; national IDs by pattern with the documented validators; IPv4/IPv6; phone numbers in E.164 form; secrets and tokens (`sk-…`, `srl_live_…`, `whsec_…`, JWTs). It is deterministic, cheap enough to run on every tool result, adds no model download, and is testable to the byte. Put it behind a `Redactor` protocol so Presidio can be plugged in later for SEED-079's full-DLP scope. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `mcp.server.transport_security.TransportSecuritySettings` | (in `mcp`) | Host/Origin allowlist | **Mandatory at go-live.** Without it, the SDK's default DNS-rebinding guard accepts only `localhost` Hosts and answers **421 Misdirected Request** to every request behind a real hostname. The error appears only in the server log; the client sees a generic transport error. Derive `allowed_hosts` from `BACKEND_PUBLIC_URL`, plus a `host:*` form. |
| `mcp.server.auth.settings.AuthSettings` + a `TokenVerifier` | (in `mcp`) | Resource-server half of OAuth | **OAuth phase only.** Set `resource_server_url` = the exact public MCP URL (Claude matches the PRM `resource` against the URL the user typed, path included). Set `validate_token_resource=True`, because our AS binds tokens to that resource. In 3.0 that becomes the default. |
| `mcp.shared.auth` models (`OAuthMetadata`, `OAuthClientMetadata`, `OAuthToken`, …) | (in `mcp`) | Wire shapes for our AS endpoints | Reuse them so the metadata JSON matches what MCP clients parse. Do not hand-type RFC 8414 field names. |
| `PyJWT` | 2.12.1 (present; also `mcp`'s `pyjwt[crypto]`) | Only if the AS issues JWTs instead of opaque tokens | Not needed under the recommended design, which uses opaque hashed tokens looked up per call. That lookup happens on every call anyway, because revocation, membership and ban checks are live (Phase 293 D-05). |
| `app.security.secret_cipher` (Fernet/MultiFernet) | cryptography 46.0.7 (present) | Store webhook signing secrets | Webhook secrets **must be reversible** (we sign with them), unlike API keys (SHA-256 one-way). Reuse the Phase 150 cipher. |
| `croniter` | present | — | Not needed. Retry backoff is a `next_attempt_at` column, not a cron. |
| `standardwebhooks` | 1.1.0 | **Test only** | A unit test signs with our signer and verifies with `standardwebhooks.Webhook(secret).verify(...)`. That proves receivers using the official verifiers in any language will accept us. |

### Development Tools

| Tool | Purpose | Notes |
|---|---|---|
| MCP Inspector (`npx @modelcontextprotocol/inspector`) | Drive the server by hand: tool listing, OAuth discovery dance | Run it against `http://localhost:8000/mcp` locally. It exercises the PRM → AS metadata → DCR → PKCE flow. |
| SDK `examples/servers/simple-auth` + `examples/clients/simple-auth-client` | Reference for the RS/AS split | Read before building the AS endpoints. |
| Claude Code `claude mcp add --transport http <name> <url> --header "Authorization: Bearer srl_…"` | Personal-key UAT without OAuth | Claude Code also does OAuth with **loopback callbacks on an ephemeral port** (`http://localhost:<port>/callback`, `127.0.0.1` too). The AS must match those with the port ignored. |
| Cursor `mcp.json` `"headers": {"Authorization": "Bearer ${env:SYREL_MCP_KEY}"}` | Personal-key UAT | Cursor also supports OAuth with **DCR (public client)** or a static client id. It does not mention CIMD. Callbacks: `https://www.cursor.com/agents/mcp/oauth/callback` and `http://localhost:8787/callback`. |

---

## Integration points in the existing code

| New capability | Hooks into | Notes |
|---|---|---|
| MCP mount | `backend/app/main.py` `lifespan` (a G-5-firing hot file) | `app.mount("/mcp", mcp.streamable_http_app(stateless_http=True, transport_security=…))`, and **the host lifespan must enter `async with mcp.session_manager.run():`**. A mounted sub-app's lifespan never runs. Forgetting it gives `RuntimeError: Task group is not initialized` on every request. `session_manager` exists only after `streamable_http_app()` is called, so build at module import and enter the context in the lifespan. Keep it a few lines in `main.py` and put everything else in `app/mcp_server/`, the same discipline as `include_router`. |
| Trailing slash | `/mcp` vs `/mcp/` | The SDK deploy guide warns that a redirect behind a TLS-terminating proxy points at `http://`, and clients then refuse it. Pick one canonical URL, use it as `resource_server_url`, and avoid the redirect. |
| Proxy headers | `backend/Dockerfile` CMD: `uvicorn … --workers ${WORKER_COUNT:-2}` | It has no `--forwarded-allow-ips`. Uvicorn trusts `X-Forwarded-*` only from 127.0.0.1 by default, so behind Coolify/Traefik `request.url` reads `http://`. **Do not derive the MCP resource URL or the issuer from the request.** Take them from the existing `BACKEND_PUBLIC_URL` setting (`inbound.py::_public_api_base` already treats it as "where a third party reaches this API"). |
| Personal-key auth (phase 1) | `app/security/api_key_auth.py::resolve_api_key` (Phase 293) | Reuse the resolver's order: digest → constant-time compare → revoked → expired → still a member → not banned, with one byte-identical 401. MCP keys need a **user-scoped** variant: the Phase 293 keys are org-scoped and start *listed* workflows. Use a new prefix (e.g. `srl_mcp_`), plus folder-set and tool-subset columns (migration 220+). Phase 1 can authenticate in the `TokenVerifier` without advertising OAuth (verify the bearer, return `AccessToken`; tools read it with `mcp.server.auth.middleware.auth_context.get_access_token()`), or in a thin ASGI wrapper. Pick one and keep the OAuth phase a superset of it. |
| Per-key limits | `app/services/rate_limit.py` (Redis fixed window, fail closed) | Add `Kind`s for MCP tools. Do **not** model it on the in-process limiter in `api/setup.py` (the module docstring already says why). |
| Admission control | `task_service.py` Lua acquire/release, `provider_gateway/dispatcher.py` | Key the semaphore by provider (and later by BYOK key id), with a lease TTL so a crashed worker cannot leak slots. Apply it to outside-origin calls (MCP and webhook-triggered work), so a busy MCP caller is refused with 429 + `Retry-After` before it exhausts the shared key. |
| Tool implementations | existing services (`search_documents_tool.py`, `agent_loop.py`, `workflow_kickoff.py`/`inbound.py`, `api/documents.py`) | The Extension Contract holds: tools **call** existing capabilities and add no phase type, emitter or engine tool. Write MCP tool handlers as `async def`. SDK v2 runs sync handlers on a worker thread, and supabase-py calls must still be wrapped in `run_in_threadpool` (D-v2.5-01). |
| Webhook egress | `app/security/egress.py` `_TLS_SCHEMES` + `send_pinned_http` | Add a closed capability (e.g. `webhook_deliver`, https only) with a caller-supplied host, like `send_email`'s `_CALLER`. Then every delivery is DNS-resolved, public-IP-checked and pinned, and **redirects are refused**. That matches the Standard Webhooks rule that "3xx is failure (update the URL instead of following redirects)". Validate the endpoint URL at subscription time too. The Extension Contract's refusal of generic webhook *nodes* is untouched, because these are event subscriptions, not a workflow node. |
| Webhook events | DB triggers, as with migration 218 for notifications | Use a trigger on `workflow_runs` terminal-status transitions and on documents reaching ingested/failed. It writes one `webhook_deliveries` row per matching subscription. A trigger catches every writer, including service-role paths. |
| Webhook drainer | `main.py` lifespan, beside `NotificationDrainer` | Run it in every worker; the DB arbitrates which row is whose. Retry schedule per the Standard Webhooks recommendation: 5s, 5m, 30m, 2h, 5h, 10h, 14h, 20h, 24h, with jitter. Use a 15-30 s request timeout. A `410` disables the endpoint; `429`/`502`/`504` back off. Keep `webhook-id` stable across retries; it is the receiver's idempotency key. |
| Audit | `app/services/audit_service.py` (`assert_action_types_synced` at boot) | New action types (`mcp.call`, `mcp.key.*`, `oauth.grant`/`revoke`, `webhook.endpoint.*`, `webhook.delivery.failed`) need the lockstep literal and its migration CHECK in the **same commit**, or boot refuses. |
| Redaction | the MCP tool result path and the webhook payload builder | One `redact(text, policy)` choke point. Keep webhook payloads **thin** (ids, type, status, timestamps, an authenticated link back), as the spec recommends ("future proof"). PII then mostly never enters a webhook body, and redaction concentrates on MCP tool outputs: search snippets, document text, agent answers. |
| Existing MCP **client** | `backend/app/services/mcp_client.py` | It is a **hand-rolled httpx JSON-RPC client** (no SDK import), speaking `MCP_PROTOCOL_VERSION = "2025-06-18"`, with every socket pinned through `validate_mcp_destination`. **Do not port it to the SDK client.** The SDK client uses `httpx2` and would bypass `send_pinned_http`, losing the SSRF guarantees. The server and client share nothing but the protocol. |

---

## OAuth decision (MEDIUM confidence: flag for phase research)

**What the current spec (2026-07-28) requires** (HIGH, from modelcontextprotocol.io):
- An MCP server **MUST** implement **RFC 9728 Protected Resource Metadata** and answer 401 with `WWW-Authenticate: Bearer resource_metadata="…"`. It **SHOULD** include `scope=`. For runtime insufficient scope: 403 + `error="insufficient_scope"`.
- An MCP server **MUST** validate that the token was issued **for it** (RFC 8707 audience). It **MUST NOT** accept or pass through other tokens. Tokens are never accepted in query strings.
- An AS **MUST** be OAuth 2.1 (PKCE) and expose **RFC 8414** or OIDC discovery. It **SHOULD** support **Client ID Metadata Documents (CIMD)**. It **MAY** support **DCR (RFC 7591)**, which is "deprecated and retained for backwards compatibility". It **SHOULD** emit `iss` in authorization responses (RFC 9207) and advertise `authorization_response_iss_parameter_supported`.
- `offline_access` should **not** appear in the RS's `scopes_supported`.

**What Claude actually needs** (HIGH, from claude.com/docs/connectors/building/authentication):
- It supports **DCR and CIMD out of the box**. It uses CIMD **only if** AS metadata has `client_id_metadata_document_supported: true` **and** `"none"` in `token_endpoint_auth_methods_supported`. With DCR, it needs a `registration_endpoint`.
- `code_challenge_methods_supported` must include `S256`.
- Hosted callback: `https://claude.ai/api/mcp/auth_callback`. An older help article warned it may move to `claude.com`, so allowlist both. Claude Code uses loopback callbacks with any port.
- PRM `resource` must equal the URL the user typed, **path included**. Claude uses only the **first** `authorization_servers` entry.
- `/token` takes form-encoded input; `/register` takes JSON. Time limits: 10 s for discovery, registration and token; 30 s for refresh. **Rotate refresh tokens for public clients**; return `invalid_grant` when one is dead. Claude refreshes on 401 and up to 5 min before expiry.
- **Static bearer headers are a limited beta**, so a Claude.ai custom connector effectively means OAuth. **`client_credentials` (machine-to-machine) is not supported.**
- Egress comes from `160.79.104.0/21`. A WAF in front of the AS can break discovery.

**Recommendation: build a thin AS in our backend that issues opaque tokens which are MCP keys.** Endpoints: `/.well-known/oauth-authorization-server`, `/oauth/authorize` (redirects to a React consent page that uses the existing Supabase session), `/oauth/token` (code + PKCE S256, refresh with rotation), `/oauth/register` (DCR, public clients, redirect-URI allowlist policy) and `/oauth/revoke`. Advertise CIMD in the same phase or the next. Why this design:
1. **Scope is exactly MCP.** The token opens the four tools for one user, narrowed by folders and tools, and nothing else.
2. **One credential model.** OAuth grants and personal keys live in one table, one revocation UI, one audit trail and one rate-limit key.
3. **Audience binding is exact by construction.**
4. **Local, cloud and onebox all work identically.** There is no dependency on a beta feature of the hosted IdP.

**Alternatives considered:**

| Option | Verdict | Reason |
|---|---|---|
| **Supabase Auth OAuth 2.1 Server** (beta, all plans; local CLI `[auth.oauth_server]` with `enabled`, `authorization_url_path`, `allow_dynamic_registration`; DCR supported; endpoints `/auth/v1/oauth/authorize`, `/auth/v1/oauth/token`; discovery at `/.well-known/oauth-authorization-server/auth/v1`) | **Strong runner-up. Re-evaluate in the OAuth phase.** | It reuses the existing user directory and needs only a consent page (`supabase.auth.oauth.getAuthorizationDetails / approveAuthorization / denyAuthorization`). **But:** (a) the tokens are **ordinary Supabase session JWTs** (`role: authenticated`, `aud: authenticated`, plus a `client_id` claim) and "existing RLS policies automatically apply". An MCP OAuth token would therefore also be a **full Data-API credential** for that user, unless every RLS policy gains a `client_id IS NULL` gate. That inverts least privilege and is exactly the blind spot BUG-260911-01 recorded (nothing in the suite requests as a non-first-party principal). (b) RFC 8707 audience binding needs a **Custom Access Token Hook that fires for all token issuance**, first-party login included, so a hook bug can break sign-in. (c) The docs do not mention CIMD. (d) HS256 is the project default, and `openid` needs asymmetric keys. (e) Onebox/self-hosted GoTrue support is unverified. |
| `mcp` SDK's embedded `auth_server_provider=` | Usable as a fast path, but not chosen | The SDK's own docs say it "predates the AS/RS separation … New servers should not reach for it." It does give ready `/authorize`, `/token`, `/register` and `/revoke` handlers. If the phase prefers less hand-written code, implementing `OAuthAuthorizationServerProvider` against our Postgres tables is acceptable. Keep the RS side on `TokenVerifier` either way. |
| **Authlib** 1.9.1 (`joserfc` 1.7.7) | Not chosen | Its AS framework integrations are Flask and Django. On FastAPI we would write the framework glue *and* adapt Authlib's grant model, more code than the five endpoints themselves. We need neither JOSE (opaque tokens) nor its client side. |
| Hosted IdP (WorkOS AuthKit / Auth0 / Stytch) | Rejected | A second user directory and a new vendor. Account linking with Supabase users is required anyway. |
| Standalone `fastmcp` 4.1.4 (Prefect) | Rejected | An opinionated framework layered on top of the official SDK, with its own auth-provider and OAuth-proxy stack. It is more surface than we need, and it ties our auth to a third party's release cadence. The official SDK already does what we need. |

---

## Multi-worker and MCP session facts (HIGH, from SDK docs/run/deploy.md and legacy-clients.md)

- **2026-07-28 clients:** there is no `Mcp-Session-Id`. Any worker answers any request, with nothing to configure.
- **2025-11-25-and-earlier clients (most clients today):** the default is a session held in **one worker's memory**. Under `--workers 2`, a follow-up that hits the other worker gets **404 "Session not found"**. **Set `stateless_http=True`.** It affects only this legacy leg.
- **The cost of `stateless_http=True` on the legacy leg:** no server-to-client back-channel. `ctx.elicit()` and sampling raise `NoBackChannelError`, and standalone notifications are dropped. Our four tools need none of these. **Design the tools as request/response.** For long work (a workflow run, a long agent turn), return a run id and add a read-result tool. Do not hold a stream open for minutes.
- **Multi-round-trip `request_state`** is sealed with a per-process `os.urandom(32)` key by default. If any tool ever uses it, pass `RequestStateSecurity(keys=[…])` from a secret env var **and** use the same server name on both workers. Otherwise retries fail with `-32602 "Invalid or expired requestState"` some of the time.
- The SDK ships **no `EventStore`** and **no cross-process subscription bus**. Do not plan resumability or `subscriptions/listen` fan-out without a Redis-backed `SubscriptionBus` of our own. Not needed for v4.9.

---

## Installation

```bash
# backend/requirements.txt (in the venv)
mcp>=2.3.0,<3
sse-starlette>=3.0.3,<3.1          # was ==2.4.1; forced by mcp 2.x; <3.1 keeps Starlette 0.41.x
# test-only (requirements-dev or the test section)
standardwebhooks==1.1.0

# verify the resolution before committing (measured 2026-10-30):
backend/venv/Scripts/python.exe -m pip install --dry-run "mcp==2.3.0" "fastapi==0.115.6"
#   -> Would install httpcore2-2.16.0 httpx2-2.16.0 idna-3.20 mcp-2.3.0 mcp-types-2.3.0
#      opentelemetry-api-1.45.2 sse-starlette-3.0.3 truststore-0.10.5
```

Deploy-artifact parity (same-commit rule, `check-deploy-drift.sh`): new env vars are secrets only, for example `MCP_REQUEST_STATE_KEYS` if `request_state` is ever used, and an AS token-signing secret only if tokens become JWTs. Feature knobs go in `app_settings`: MCP on/off per org, limits, admission caps, redaction policy, webhook retry ceiling. `BACKEND_PUBLIC_URL` already exists and becomes **load-bearing** for the resource URL and issuer. Treat a loopback value in production as a startup refusal for the MCP mount.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|---|---|---|
| `mcp` 2.3.x | `mcp` 1.30.0 (`<2`) | Only if the sse-starlette bump cannot be validated in time. 1.30 accepts `sse-starlette>=1.6.1` and `httpx`. But it is maintenance-only and its `FastMCP` API is removed in 2.x, so this is a migration deferred, not avoided. |
| Postgres outbox + drainer | Redis Streams consumer group | If delivery volume ever exceeds what a polled table handles (thousands/min). Not this milestone. Redis is not the system of record here (D-v2.5-03, Upstash eviction). |
| Hand-rolled Standard Webhooks signer | `svix` 2.9.1 (hosted Svix) | If the operator wants a hosted delivery dashboard and portal and accepts a vendor. The `svix` SDK pulls `attrs`, `deprecated`, `python-dateutil`, `httpx` and `pydantic` and sends through Svix's cloud, which our egress pinning cannot guard. |
| In-house regex + checksum redactor | `presidio-analyzer` 2.2.366 | When SEED-079's full DLP lands (ingestion, prompt egress, LangSmith traces) and a regulated customer needs name/location NER. Measured install: **spaCy 3.8.18, thinc, blis, srsly, weasel, cloudpathlib, smart_open, tldextract, phonenumbers, …**, plus a spaCy model download (`en_core_web_lg` is the default, several hundred MB). NER is English-centric and probabilistic. That is a poor fit for a deterministic "never emit" gate on a hot path, and the docs show no supported pattern-only mode. |
| Redis Lua semaphore | `limits` library (async Redis moving window) | If we want a ready token-bucket or moving-window with storage abstraction. Our Lua precedent already exists, and admission is a *concurrency* lease, which `limits` does not model. |

## What NOT to Use

| Avoid | Why | Use Instead |
|---|---|---|
| `from mcp.server.fastmcp import FastMCP` (blog posts, v1 docs) | **Removed in 2.x** (`ModuleNotFoundError`); renamed `MCPServer` | `from mcp.server import MCPServer` |
| Leaving `stateless_http` at default with 2 workers | Legacy clients get intermittent `404 Session not found` (half of requests on round-robin) | `streamable_http_app(stateless_http=True, …)` |
| Omitting `transport_security=` | Every production request is a `421 Invalid Host header`, logged only server-side | `TransportSecuritySettings(allowed_hosts=[host, host+":*"])`, or `enable_dns_rebinding_protection=False` only if the proxy pins Host |
| Relying on the mounted app's own lifespan | Mounted lifespans never run → `Task group is not initialized` | Enter `mcp.session_manager.run()` in `main.py`'s lifespan |
| SSE-only (legacy HTTP+SSE) transport | Deprecated in the spec; Claude documents it as deprecated | Streamable HTTP only |
| Tokens in query strings (`?token=`) | The spec forbids it; Claude explicitly says don't | `Authorization: Bearer` |
| `client_credentials` grant for "server-to-server MCP" | Claude does not support it, and it is not the user-delegation model | Personal keys (header) or the auth-code + PKCE flow |
| Supabase session JWTs as MCP bearer tokens | They grant the whole Data API and are not audience-bound to the MCP resource; this violates the spec MUST | Opaque MCP-scoped tokens |
| `aiolimiter` / `asyncio.Semaphore` for admission | Per process: two workers admit twice the cap | Redis Lua lease semaphore |
| Following redirects on webhook delivery | SSRF pivot, and the spec says 3xx = failure | `send_pinned_http` (refuses redirects) |
| Full webhook payloads with document text or agent output | They maximize PII egress, go stale and are hard to version | Thin payloads + an authenticated fetch link |
| Porting `mcp_client.py` to the SDK client | The SDK client uses `httpx2`, which bypasses the pinned-egress guard | Keep the hand-rolled, pinned client |
| Celery / RQ / arq / a new queue service | New infrastructure for what `SKIP LOCKED` + the existing per-worker loop already does | Outbox + drainer |
| Google Cloud DLP / AWS Comprehend PII APIs | They send the very data we are trying not to egress to another processor, and add cost and latency | In-house redactor (Presidio later, in-process) |

## Stack Patterns by Variant

**If a deployment serves the backend under a path prefix (the onebox nginx `/api`):**
- The canonical MCP URL is `https://host/api/mcp`. Point the `resource_metadata` URL in `WWW-Authenticate` at the prefixed path. Clients must use that URL.
- **But RFC 8414 AS-metadata discovery for an issuer `https://host/api` is `https://host/.well-known/oauth-authorization-server/api`, at the origin root.** That path reaches the *frontend* nginx (or Vercel) unless it is proxied. Add a `/.well-known/oauth-*` proxy rule (`frontend/nginx.conf` is a hot file), or give the backend its own origin. Verify the cloud topology (Vercel frontend + Coolify backend) in the OAuth phase.

**If the client is Claude.ai, Claude Desktop or mobile (custom connector):**
- OAuth is required (static headers are a limited beta). Phase 1, personal keys only, serves Claude Code, Cursor and other header-capable clients. Claude.ai arrives with the OAuth phase.

**If a tool runs long (`ask_agent`, `run_workflow`):**
- Return promptly with an id and a status; expose `get_run_result`. Client-side MCP tool timeouts are not documented uniformly (LOW confidence), and the legacy stateless leg has no back-channel for progress.

## Version Compatibility

| Package A | Compatible With | Notes |
|---|---|---|
| `mcp==2.3.0` | `fastapi==0.115.6` / `starlette==0.41.3` | ✅ Measured with a pip dry-run. `mcp` needs `starlette>=0.27` on Python < 3.14. |
| `mcp==2.3.0` | `sse-starlette==2.4.1` | ❌ ResolutionImpossible (measured). It needs `>=3.0.0`. |
| `sse-starlette==3.0.3` | `starlette==0.41.3` | ✅ (resolved by pip). sse-starlette **3.6.0 needs `starlette>=0.49.1`**, so cap `<3.1` until FastAPI is upgraded. |
| `mcp==2.3.0` | `pydantic 2.12.5`, `pyjwt 2.12.1`, `python-multipart 0.0.20`, `uvicorn 0.32.1`, `anyio 4.12.1`, `jsonschema` | ✅ All already satisfy its floors. |
| `mcp==2.3.0` (`httpx2`) | `httpx 0.28.1` | ✅ Different import names. Note that `httpx2` brings `truststore`, which is used by httpx2 clients only. |
| FastAPI upgrade (0.115.6 → 0.16x) | — | **Not required for v4.9. Do not bundle it.** FastAPI 0.120 still caps `starlette<0.49`. A FastAPI/Starlette 1.x upgrade is its own phase. |

## Sources

- PyPI JSON `https://pypi.org/pypi/mcp/json` (2.3.0, 2026-10-02; 2.0.0 2026-07-28; 1.30.0 2026-09-07), `…/sse-starlette`, `…/fastapi/0.115.6`, `…/authlib` (1.9.1), `…/presidio-analyzer` (2.2.366), `…/standardwebhooks` (1.1.0), `…/svix` (2.9.1), `…/fastmcp` (4.1.4): HIGH
- pip `--dry-run` resolution in `backend/venv` (2026-10-30): HIGH (measured)
- Context7 `/modelcontextprotocol/python-sdk`: `docs/run/asgi.md`, `docs/run/deploy.md`, `docs/run/legacy-clients.md`, `docs/run/authorization.md`, `docs/migration.md`, `docs/whats-new.md`, `SECURITY.md`, `src/mcp/server/auth/settings.py`, `src/mcp/server/auth/routes.py`, `src/mcp/server/transport_security.py`: HIGH
- https://modelcontextprotocol.io/specification/versioning (current = 2026-07-28): HIGH
- https://modelcontextprotocol.io/specification/latest/basic/authorization (RFC 9728 MUST, CIMD SHOULD, DCR MAY/deprecated, RFC 8707, RFC 9207): HIGH
- https://www.claude.com/docs/connectors/building/authentication (DCR/CIMD, callback, S256, refresh rotation, static headers beta, egress CIDR): HIGH
- https://cursor.com/docs/context/mcp (Streamable HTTP + SSE, headers with `${env:}`, OAuth DCR / static client, callbacks): HIGH
- https://supabase.com/docs/guides/auth/oauth-server (+ `/getting-started`, `/mcp-authentication`, `/token-security`): beta, DCR, token claims, hook-based `aud`: MEDIUM (the docs are silent on CIMD, RFC 8707 and self-hosting)
- https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md (headers, `whsec_`, rotation, retry schedule, 3xx/410/429): HIGH
- sse-starlette v3.0.0 release notes (`gh release view v3.0.0 -R sysid/sse-starlette`): HIGH
- Presidio docs (spaCy `en_core_web_lg` default; no documented pattern-only engine): MEDIUM
- Archived Anthropic help article (SSE deprecated; callback may move to claude.com): LOW (secondary)
- Codebase: `backend/requirements.txt`, `app/services/mcp_client.py`, `app/security/egress.py`, `app/security/api_key_auth.py`, `app/services/rate_limit.py`, `app/services/task_service.py`, `app/services/notification_drainer.py`, `app/db/notifications.py`, `app/api/inbound.py`, `app/main.py`, `backend/Dockerfile`, `tests/integration/test_059_disconnect.py`

---
*Stack research for: v4.9 Use It From Your Own Tools (MCP server, personal keys, OAuth, webhooks, admission, redaction)*
*Researched: 2026-10-30*

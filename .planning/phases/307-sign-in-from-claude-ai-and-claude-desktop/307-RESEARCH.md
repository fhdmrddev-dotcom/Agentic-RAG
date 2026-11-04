# Phase 307: Sign In From Claude.ai and Claude Desktop - Research

**Researched:** 2026-11-03
**Domain:** OAuth 2.1 authorization server for a remote MCP server (MCP authorization spec 2026-07-28, RFC 9728 / 8414 / 7591 / 7636 / 8707 / 8252 / 7009 / 9207, CIMD draft), Claude connector client behaviour, FastAPI/Starlette + asyncpg + Redis, React consent surface, three-topology routing
**Confidence:** HIGH on spec and Claude client facts (read from the provider's own pages this session, Claude Code's live CIMD document fetched); HIGH on codebase fit (read file:line); MEDIUM on refresh-race behaviour of Claude (not documented by Anthropic; inferred from other MCP clients and the SDK source)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Authorization server shape (OAUTH-05; intake D1 / Q9 — already decided, carried forward)
- **D-01:** **Own authorization server.** Tokens are **opaque, random, stored only as SHA-256 digests, and looked up on every call.** Supabase OAuth 2.1 is out of scope (its tokens are user JWTs PostgREST accepts). Research may use the SDK's `mcp.shared.auth` models and, if it fits, the SDK's `OAuthAuthorizationServerProvider` / auth routes as the fast path — **only if** they can be driven by our storage, our consent page, our limits and our single 401; otherwise thin FastAPI routes. Research records the choice as a `D-NN`.
- **D-02:** **Issuer and every OAuth endpoint live on the backend origin, under `mcp_public_base()`** (the one refuse-mount predicate from 305 D-49) — the same base as the MCP URL. Issuer = that base (`http://localhost:8000` local, `https://api.superrag.cloud` cloud, `https://<host>/api` one-box). When `mcp_public_base()` is `None`, no OAuth route or metadata is served either. Only the consent page is a frontend route.
- **D-03:** **Registration rides inside `register_mcp(app)`** (`backend/app/mcp/`), so `backend/app/main.py` gets **zero new lines** (G-5, `100 / 74`). If research proves a lifespan or middleware line is unavoidable, it is one line, recorded.
- **D-04:** Endpoints: protected-resource metadata (RFC 9728, both the root and the path-suffixed `/mcp` form), authorization-server metadata (RFC 8414; plus the OpenID-configuration alias only if research shows Claude needs it), `register` (RFC 7591 DCR), `authorize`, `token`, `revoke` (RFC 7009). Metadata advertises **`code_challenge_methods_supported: ["S256"]`**, `client_id_metadata_document_supported: true`, `grant_types_supported: ["authorization_code","refresh_token"]`, `response_types_supported: ["code"]`, `token_endpoint_auth_methods_supported` including `none` (public clients). Exact field set per the **current MCP authorization spec and Claude's connector docs, read directly** (provider-docs-first).
- **D-05:** **Every endpoint answers in under 10 s** (Claude's limit); the CIMD fetch has a hard timeout well inside that (≤ 5 s). Measured, not assumed.

#### Clients: DCR, CIMD and the redirect rule (OAUTH-04, OAUTH-05)
- **D-06:** **Both DCR and CIMD are supported and advertised.** A CIMD `client_id` is an https URL; its document is fetched **only through `backend/app/security/egress.py`** — one new capability beside `validate_mcp_destination` (https only, no private/loopback/link-local addresses, pinned resolution, no redirects followed, size cap, timeout). A fetch that bypasses `egress.py` fails the phase. The fetched document is cached on the client row with a bounded TTL (research sets it; ≤ 24 h) and the `client_id` in the document must equal the URL it was fetched from.
- **D-07:** **Redirect URIs match exactly**, string for string, against the client's registered (DCR) or published (CIMD) list — **except loopback**: `http://localhost`, `http://127.0.0.1` and `http://[::1]` match **on any port** (RFC 8252 §7.3), path and query still exact. No wildcard, no prefix match, no `https` downgrade. A redirect URI that does not match is **never redirected to** — the error is shown on a Syrel page (an open redirect fails the phase).
- **D-08:** **An operator-managed redirect-host allowlist** gates every non-loopback redirect host at registration and at authorize time, for DCR and CIMD alike. It lives in `app_settings` with a Control Room / Settings control (everything-in-the-UI rule), **seeded with `claude.ai` and `claude.com`** (Claude's callback `https://claude.ai/api/mcp/auth_callback` and the `claude.com` form — exact URLs verified in Claude's docs at research). Loopback needs no entry. Custom URI schemes (`cursor://`, `vscode://`) are refused in v1 (deferred).
- **D-09:** **Registered clients are bounded:** DCR is behind its own per-address limit bucket, a client that has never completed a grant is deleted after a bounded time (research sets it; ~24 h), and client-supplied strings (name, logo URI, URLs) are stored as untrusted data — length-capped, never rendered as HTML, the logo **not fetched** in v1.

#### Authorize and the consent page (OAUTH-04; G-2, G-4)
- **D-10:** Flow: backend `GET /authorize` validates `client_id`, `redirect_uri` (D-07/D-08), `response_type=code`, **`code_challenge` with `code_challenge_method=S256` — missing or `plain` is refused**, `state`, and `resource` (D-18). Valid → it stores a **pending authorization request** (short-lived, single-use, server-side) and redirects the browser to the consent page with only that request's opaque id. Invalid client or redirect → a Syrel error page, never a redirect; other errors after the redirect is proven → redirect back with the OAuth `error` per spec.
- **D-11:** The consent page is a **frontend route under `/app/`** (exact path set by research; e.g. `/app/connect/authorize`) so the existing three-layer routing (`devRouting.ts`, `vercel.json`, `nginx.conf`) already serves it. A signed-out member goes through sign-in and **returns to the same consent request** via the existing `frontend/src/lib/returnTo.ts` mechanism (Phase 299).
- **D-12:** The page **names the client and its redirect host**, with the host as the trust anchor: a DCR client's name is self-asserted and is shown as such ("calls itself …"), the redirect host is shown plainly beside it; a CIMD client shows its `client_id` host as verified. A loopback redirect says "an app on this computer". The page also says which account is signing in.
- **D-13:** The member picks **the org** (default = active org; orgs where an MCP switch is off are listed disabled with the 304 sentence), **folders** (reuse `KeyFoldersField`; default not narrowed, `[]` refused per 304 D-08) and **tools** (reuse the 304 presets via `McpKeyFields`: **Read only** pre-selected, Read and ask, Read ask and run; 304 D-12). Narrowing is chosen **on the page, not by OAuth scope strings**; the advertised scope set is minimal (research picks the one value Claude needs) and no scope maps to a capability.
- **D-14:** **Approve** creates the grant (D-15), issues a **single-use authorization code** (short-lived, ≤ 60 s, consumed atomically; bound to client, redirect URI, PKCE challenge, resource and grant) and returns the redirect URL for the page to follow. **Deny** redirects with `error=access_denied`. A pending request can be approved once; a second approve or a stale request is refused.
- **D-15:** **The grant is a `api_keys` row** — `kind='mcp'` plus a new nullable `oauth_client_id` (mig 224), with `folder_ids`, `tools`, `include_external`, `org_id`, `user_id`, `expires_at` exactly as a key. Its `key_hash` is the digest of a random secret that is never shown (no one can present it as a key), and `authenticate_presented_key` refuses any row with `oauth_client_id` set as `wrong_kind`. Reason: liveness, narrowing (`KeyScope`), limits (per-key buckets), audit (`api_key_id`), spend (`mcp_usage.api_key_id` FK) and revoke then work **by construction** — "an OAuth grant is a key minted through a consent screen" (research SUMMARY). Research verifies the ~60 `kind == 'mcp'` sites and records any that must exclude grants (the member's key list must).
- **D-16:** Grant expiry: the `kind='mcp'` expiry CHECK holds. A grant gets **90 days, sliding** — each successful refresh moves `expires_at` to now + 90 days, so an app in use stays connected and an idle one lapses. Research confirms against Claude's refresh cadence.

#### Tokens (OAUTH-05, OAUTH-06)
- **D-17:** **Access tokens** are opaque with their own prefix (e.g. `srl_oat_`), **1 hour**; **refresh tokens** opaque with their own prefix (e.g. `srl_ort_`). Both stored only as SHA-256 digests in a new token table (mig 224) linked to the grant. Neither is ever logged, put in a URL, or shown in the UI.
- **D-18:** **Tokens are bound to this server:** `resource` (RFC 8707) is required at authorize and token and must equal the canonical MCP URL (`mcp_url()`); the token row records it and the MCP edge refuses a token whose resource is not this server's. An access token presented to the Supabase Data API (PostgREST) is refused — it is not a JWT — **proven by a driven test**, not by reasoning.
- **D-19:** **Refresh rotates on every use**; the used token is marked used in the same transaction that issues the new pair. **Presenting an already-used refresh token is refused and revokes the whole grant** (token family), audited as `api_key.refused` with reason `refresh_reuse`. Research checks whether Claude ever double-refreshes concurrently; if it does, a grace window is a new `D-NN` with its bound written down, never silent.
- **D-20:** `revoke` (RFC 7009) accepts either token, always answers 200, and revoking a refresh token revokes the grant.

#### The MCP edge and the ONE resolver (OAUTH-06; 305 D-46, 304 D-17/D-18/D-20)
- **D-21:** The edge (`backend/app/mcp/edge.py`) keeps one shape: Bearer from the header only, then **`mcp_principal.resolve_mcp_principal`**, which dispatches on the prefix — `srl_mcp_` → `authenticate_presented_key` (unchanged), access-token prefix → token digest lookup → the grant's `api_keys` row → **the same `principal_still_allowed`** → `McpPrincipal(credential_kind="oauth", key_id=<grant row id>, …)`. **No second liveness predicate, no second principal type, no second narrowing path.** A second resolver fails review.
- **D-22:** **The 401 gains `resource_metadata`:** `WWW-Authenticate: Bearer resource_metadata="<PRM URL>"` — still **one** response, built once at import (or once per base), identical for every credential failure, key or token (305 D-08/D-50). The two switched-off refusals stay 403 with their sentence. Research confirms a key-holding client (Claude Code with a header) is unaffected.
- **D-23:** Expired access token, revoked grant, used/unknown token, wrong resource → the same identical 401. An app session JWT at `/mcp` stays refused (305 D-09).
- **D-24:** **Removal tests per case** (SC3), driven through `/mcp` with a real OAuth token: membership removed, member banned, org MCP switch off, deployment MCP switch off, grant revoked by the member, all revoked by the org admin, grant expired, refresh reuse. Each is refused **on the next call**, not the next connection.

#### Connected apps and revoke (OAUTH-07)
- **D-25:** The member's **Connected apps** list is a new leaf section **mounted once in the existing Settings → API keys tab** (`ApiKeysTab.tsx`, FIRES — one mount line), not a new Settings tab; **`SettingsPage.tsx` is not edited.** Each row: client name (as asserted), redirect host, org, narrowing summary (reuse `mcpKeyFacts` / `KeyFoldersField` summary wording), connected date, last used, and **Revoke** (reuse `RevokeApiKeySheet`'s pattern). Grants **do not appear** in the member's key list.
- **D-26:** The org admin's **existing `OrgApiKeysTab`** lists grants with a "Connected app" chip beside the key kinds and adds **"Revoke all connected apps"** behind a victim-naming confirm sheet (graded action-guards rule) that says how many apps and members it disconnects. Revoke-all affects OAuth grants in that org only, never keys.
- **D-27:** Routes extend the **existing Phase 293/304 key routes** (`backend/app/api/api_keys.py`, FIRES ⛔) — list grants for me, revoke one (existing revoke path), org-admin revoke-all — rather than a parallel route family; research proposes the smallest additive shape.
- **D-28:** **No new audit literal** (304 D-36): grant create/revoke reuse `api_key.create` / `api_key.revoke` with `metadata.kind='mcp'`, `metadata.credential='oauth'`, the client name and redirect host; refusals reuse `api_key.refused` (`refresh_reuse`, `wrong_resource`, …); org revoke-all writes one row naming the count. Every MCP call from a grant is audited exactly as a key's (305 D-26/D-53) — attributable by `api_key_id`.

#### Key screen copy (304 D-27/D-29)
- **D-29:** The Claude.ai / Claude Desktop tab of `McpConnectSnippets` changes from the `mcp-remote` bridge to **"Add a custom connector with this URL, then sign in"** (the URL from `mcp_url()`); the labelled bridge workaround is **retired** (its condition, "until sign-in ships", is met). The warning against pasting a personal key into Claude.ai org headers stays. Claude Code gains the "or sign in instead of a key" note. Exact client steps are verified against each client's current docs (provider-docs-first).

#### Routing and deploy parity (OAUTH-05; Phase 297 suite)
- **D-30:** Per topology, research proves **every `.well-known` path the spec and Claude request answers JSON from the backend**, never the SPA: local (backend directly), cloud (Coolify API origin directly — research confirms nothing on Vercel's origin is requested; if anything is, `vercel.json` gets a rule), **one-box** (`nginx.conf`, FIRES ⛔ — root `/.well-known/oauth-protected-resource/api/mcp` and `/.well-known/oauth-authorization-server/api` land on nginx's `location /`, so an exact-prefix `location` proxies them to the backend). The **Phase 297 three-layer routing suite** gains these paths and the consent route as pinned rows.
- **D-31:** Maintenance mode: the OAuth endpoints join `middleware/maintenance.py`'s allowlist (same entry style as `/mcp`, 305 D-25) so an existing connection can refresh during maintenance; the canvas gate never applies; `SetupMiddleware` still gates an un-set-up deployment.
- **D-32:** **No new env var expected** (issuer derives from `BACKEND_PUBLIC_URL`, D-02). If research proves one is needed, deployment-artifact parity (`deploy/onebox.env.example`, `docs/OPERATOR.md`, `docker-compose.prod.yml`, `scripts/check-deploy-drift.sh`) lands **in the same commit**. Research also checks WAF / proxy reachability from Anthropic's egress range (`160.79.104.0/21`) on Coolify and records the operator action.

#### Data, migration and security
- **D-33:** Migration **224** (next free; 306 used 223): `api_keys.oauth_client_id` (+ its CHECK/index), the OAuth client table, the token table. Research decides whether pending requests and codes live in Redis (single-use via atomic get-and-delete; fail closed when Redis is down) or Postgres, and records it. **New tables: RLS on, no client-role grants** (service role only; the member reads grants through the backend), `key_hash`-style digest columns never granted. **Anon-role test** for every new table and column; new SECURITY DEFINER functions revoke `EXECUTE` from **`PUBLIC`** first. ⛔ No `db push` / `db reset`: local paste + `bash scripts/regenerate-full-schema.sh` (no `--reset`). Cloud paste after 220 → 221 → 222 → 223, per-action approval, then `get_advisors(security)`.
- **D-34:** Per-address limits on `register`, `authorize`, `token` and `revoke` use the shared Redis fixed-window limiter in their **own bucket kind** (cannot starve `mcp_ip` or `/inbound`), fail closed.
- **D-35:** **security_enforcement on**; `/gsd:secure-phase 307` runs before the phase is called done. The threat model covers at least: open redirect, authorization-code injection/replay, PKCE downgrade, CIMD SSRF, DCR flooding, consent-page clickjacking (frame-ancestors / X-Frame-Options on the consent route), CSRF on approve (the approve call carries the member's session and the pending request id; state is the client's), token leakage in logs/URLs, refresh reuse, mix-up across orgs.
- **D-36:** Tier: OAuth grants need **no tier capability** — the 304 D-41 decision extends (any member may connect; the org and deployment switches are the controls).

#### Verification and UAT
- **D-37:** **Headline must-haves:** (1) the full spec round-trip driven locally (metadata discovery from the 401 → DCR → authorize → consent → code → token → tool call → refresh → reuse refused → revoke); (2) the per-case removal tests (D-24); (3) PKCE `plain`/missing refused; (4) unregistered redirect host and non-loopback port drift refused, loopback any-port accepted; (5) access token refused by PostgREST; (6) `.well-known` returns JSON on all three topologies (local driven; nginx config proven by the routing suite and a container probe where Docker is available).
- **D-38:** **G-4 rows** (driven by Claude at verification): (1) **Claude Code signs in through the loopback redirect** with no key — consent page opens in Chrome, names the client and `localhost`, the member picks an org and Read only, Claude Code lists the three read tools and runs a search; (2) the member revokes it in Connected apps and Claude Code's next call is refused; (3) an org admin's "Revoke all connected apps" names the count and disconnects a second grant.
- **D-39:** **Owed to the operator, recorded at close, not claimed** (roadmap: "Claude.ai works" is never claimed without it): a real **Claude.ai** connect, refresh (≥ 1 h later) and revoke on cloud, and **Claude Desktop** the same (both broker through Anthropic's servers, so they cannot reach `localhost`); the one-box connect; adding any Claude callback host the docs name beyond the seeded two. These need the 304–307 bundle deployed.
- **D-40:** The **8-provider scoreboard does not apply**: no LLM, streaming or provider-routing path is touched (the 305 D-44 reason). Backend baseline ceiling stays **71**; vitest with `GSD_VITEST_MAX_WORKERS=2`; tsc via `-p tsconfig.app.json` as a set diff; worktree rule 4 (local-DB suites serialize). ⛔ No edits to `threads.py`, `agent_loop.py`, `dispatcher.py`, `frontend/src/lib/api.ts`, `SettingsPage.tsx`.

#### Guardrails that fire
- **D-41:** **G-2 fires** (consent page, connected-apps list, revoke-all sheet). **Next step is `/gsd:sketch` then `/gsd:ui-phase 307`, before `/gsd:plan-phase`.** The operator delegated this phase end to end, so Claude builds and self-approves the sketch; that substitution is recorded under `STATE.md → Guardrail overrides`, and the operator's look at the consent page is folded into the owed Claude.ai UAT (D-39). Load `Skill("sketch-findings-agentic-rag")` (Settings, Control Room confirm-sheet and audit-receipt vocabulary) before sketching.
- **D-42:** **G-5 / ledger:** expected FIRING files — `ApiKeysTab.tsx` (one mount), `OrgApiKeysTab.tsx` (chip + one action; check its row), `api/api_keys.py` ⛔, `egress.py` (one capability), `nginx.conf` ⛔ (one location), `mcpSnippets.ts` / `McpConnectSnippets.tsx` (copy), `appRoutes.ts` ⛔ / `main.tsx` ⛔ only if the consent route needs them (research proves whether the `/app/*` catch-all already covers it), `user_settings.py` / `admin.py` / `CapabilityGrid` only if the redirect allowlist control lands there. Every named file without a row gets its row and `docs/HOT-FILE-LEDGER.md` section in the same commit; `node scripts/check-hot-file-ledger.cjs` runs on each PLAN.md.
- **D-43:** **G-8:** target **3–4 plans**. A natural cut: (1) mig 224 + AS core (metadata, PRM, DCR, CIMD + egress capability, authorize/token/revoke, refresh rotation, resolver dispatch, 401 challenge, removal tests); (2) consent page + its backend request/approve routes + returnTo; (3) connected apps + org revoke-all + snippet copy + redirect-allowlist control; (4) routing parity (nginx, suite rows), maintenance allowlist, deploy-artifact check, ledger/bookkeeping — merge 4 into 3 if it fits a wave. Every plan writes the local DB → serialize on the local-DB lock.

### Claude's Discretion
- Module names inside `backend/app/mcp/` (e.g. `oauth_metadata.py`, `oauth_server.py`), token prefixes, table names, the consent route path, exact copy within the decisions above.
- Whether pending requests/codes live in Redis or Postgres (D-33), CIMD cache TTL and unused-client expiry (D-06/D-09) within the stated bounds.
- Where the redirect-host allowlist control sits (Control Room flags area vs Settings → API keys knobs), within the everything-in-the-UI rule.

### Deferred Ideas (OUT OF SCOPE)
- OAuth scope step-up (research SUMMARY "Defer").
- Custom URI-scheme redirects (`cursor://`, `vscode://`) and fetching/rendering client logos.
- Connectors Directory listing (blocked by SEED-294).
- Supabase OAuth 2.1 as the AS — rejected at intake (D1/Q9); stays out unless a future need appears.
- Expert-scoped grants (an OAuth grant narrowed to an Expert).

### Reviewed Todos / Seeds
- Seeds sweep (`check-seeds-register.cjs --phase 307`): **0 matched** — the phase declares no `files_modified` yet, so the gate reports it as a fact about the phase. Re-run at plan time. No open `surface: Agentic-RAG` reported bug touches MCP/OAuth; no pending todos matched. *(Re-run this session: 404/404 parsed, 0 matched; `grep folded_into: 307` over `.planning/reported-bugs/` returns nothing.)*
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OAUTH-04 | A member can add Syrel as a custom connector in Claude.ai or Claude Desktop, sign in, and use the tools. A Syrel consent page names the client and its redirect host and lets the member pick the org and optional narrowing. | §Provider facts (Claude callback, CIMD/DCR selection, menu names); §Consent flow; §UI-SPEC open items; §Data model (grant = `api_keys` row); G-4 rows via Claude Code loopback (§Verification map) |
| OAUTH-05 | Sign-in follows the current MCP authorization spec — PRM, S256 PKCE, DCR and CIMD, tokens bound to this server — and works on cloud and on the one-box. | §Provider facts (spec 2026-07-28); §Metadata documents per topology; §Routing per topology (nginx location, Vercel untouched, local direct); §Endpoint contract; §CIMD via egress |
| OAUTH-06 | An OAuth grant obeys the same narrowing, liveness checks and kill switches as a key, cannot be used directly against the database API, and its refresh tokens rotate. | §Resolver dispatch (one core, shared tail); §Token lifecycle + rotation + reuse/grace (proposed D-46); §PostgREST refusal test; §Removal tests per case |
| OAUTH-07 | A member sees their connected apps and can revoke each one; an org admin can revoke all of them. | §Connected-apps routes (additive on `/api-keys` + `/org/api-keys`); §Exclusion audit of `kind == 'mcp'` sites; §Org revoke-all SQL + audit |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directives the planner must verify each plan against:

- **Python venv** for the backend; raw SDK calls only — **no LangChain/LangGraph** (not relevant to an AS, but no OAuth framework either: Authlib etc. would be a new dependency — see Don't Hand-Roll for why none is needed).
- **Pydantic** for structured outputs; **RLS on every table**; users only see their own data.
- **Migrations:** numbered `supabase/migrations/<digits>_name.sql` (224 is next free — verified: last file is `223_mcp_ask_run_and_admission.sql`); **apply locally by SQL-editor paste**, then `bash scripts/regenerate-full-schema.sh` (no `--reset`); never `db push` / `db reset`; never hand-edit `full-schema.sql`. Cloud paste is operator-gated per action.
- **Supabase MCP writes are approval-gated** (production). Reads free; run `get_advisors(security)` after the cloud paste.
- **Postgres EXECUTE trap:** revoke from `PUBLIC` first, then grant back. (This phase needs no SECURITY DEFINER function — see §Data model.)
- **No blocking I/O in async handlers** — `run_in_threadpool` (D-v2.5-01). The CIMD DNS resolve already runs off-loop inside `send_pinned_http` (egress.py:761), but `getaddrinfo` is NOT bounded by the httpx timeout (egress.py:741-749) → wrap the whole fetch in `asyncio.wait_for`.
- **Multi-worker uvicorn (WORKER_COUNT=2):** every single-use / rate state must be shared (Redis or Postgres), never process-local.
- **Settings in `app_settings` + UI; env vars for secrets/infra only** → the redirect-host allowlist is an `app_settings` column with a Control Room control; no new env var.
- **Provider-docs-first** — done: MCP spec 2026-07-28 and Claude connector docs read directly this session (§Provider facts).
- **Backend unit baseline gate: 71 failed / 3497 passed, zero headroom.** Two existing tests pin the bare `www-authenticate: Bearer` value and MUST be updated in the same plan that changes the 401 (`tests/unit/test_305_edge_refusals.py:126`, `tests/integration/test_305_refusals_live.py:79`).
- **G-5 hot-file ledger** — `node scripts/check-hot-file-ledger.cjs` on every PLAN.md (ran it this session over 32 candidate paths: **ledger gate OK**, every watched file has a row). FIRING files touched: see §Plan cut.
- **G-8:** 3–5 plans; targeted suites per task, full gates once per wave.
- **Worktree rule 4:** plans whose tests write the local DB serialize.
- **Deployment-artifact parity:** no new env var proposed → no parity edits required; `scripts/check-deploy-drift.sh` still runs.
- **Vitest:** `GSD_VITEST_MAX_WORKERS=2`; tsc via `npx tsc -p tsconfig.app.json --noEmit` as a set diff.
- **⛔ No edits** to `threads.py`, `agent_loop.py`, `dispatcher.py`, `frontend/src/lib/api.ts`, `SettingsPage.tsx`, `main.py` (D-03/D-40).
- **BUG-261031-01:** no `SET ROLE anon` statement against a table whose policy calls `current_user_org_ids()` (that crashed local Postgres). New policy-less tables may take one transaction-local role switch; `api_keys` columns are proven with catalog functions as `postgres` (the `test_305_schema_privileges_live.py` pattern).

## Summary

The current MCP authorization spec is the **2026-07-28** revision [VERIFIED: modelcontextprotocol.io/specification/latest]. Relative to 2025-06-18/2025-11-25 it (a) makes **CIMD the SHOULD and marks DCR deprecated** (kept for backwards compatibility), (b) adds **RFC 9207 `iss` in authorization responses as a SHOULD** (with `authorization_response_iss_parameter_supported`), and (c) keeps PRM, S256, RFC 8707 `resource`, refresh rotation for public clients, exact redirect matching and "display the redirect hostname" as before. Claude's own connector docs [VERIFIED: claude.com/docs/connectors/building/authentication] say exactly what Claude needs: a **401 with `resource_metadata`**, PRM `resource` equal to the URL the user typed, **only the first `authorization_servers` entry is used**, Claude picks **CIMD only if the AS metadata has both `client_id_metadata_document_supported: true` and `"none"` in `token_endpoint_auth_methods_supported`** (else DCR), the hosted apps use **`https://claude.ai/api/mcp/auth_callback`** (`claude.com` form may come later — seeding both is right), **Claude Code uses CIMD `https://claude.ai/oauth/claude-code-client-metadata` with a loopback redirect on a random port, declared without a port** (fetched live this session), **10 s** for discovery/registration/token and **30 s** for refresh, refresh on 401 and proactively up to 5 minutes before expiry, `invalid_grant` on a dead refresh token, `/token` must accept form-urlencoded, `/register` JSON. Anthropic's outbound ranges are **`160.79.104.0/21` and `153.61.208.0/20`** — D-32 names only the first.

The installed SDK is **`mcp==2.3.0`** (backend/requirements.txt:13). Its `create_auth_routes` / `OAuthAuthorizationServerProvider` do **not** fit D-01's conditions: exact-only redirect matching with no loopback port exception (`shared/auth.py` `validate_redirect_uri`), JSON 400s instead of a Syrel page for bad client/redirect (`handlers/authorize.py`), `resource` optional, missing `code_challenge_method` silently defaulted to S256, metadata hard-coded to `client_secret_post/basic` with no `none` and no CIMD flag (`routes.py` `build_metadata`), no server-side CIMD at all, no rate limits, a load-then-exchange code path that is not atomic, and refresh reuse invisible ("does not exist"). **Verdict: hand-roll thin routes; reuse only `mcp.shared.auth` Pydantic models** (`OAuthMetadata`, `ProtectedResourceMetadata`, `OAuthToken`; measured: they serialise the issuer with no trailing slash). Proposed **D-44**.

The codebase is already shaped for this: one resolver core (`api_key_auth.authenticate_presented_key`, api_key_auth.py:370-424), one liveness leaf (`principal_liveness.principal_still_allowed`), `McpPrincipal.credential_kind` as the designed swap point (mcp_principal.py:29), a pure-ASGI edge with an import-time 401 (edge.py:53-61), `register_mcp(app)` as the one registration seam (mcp/__init__.py:37), `egress.send_pinned_http` with closed-capability tables that tolerate a wholly-wired extra key (test_190_egress.py:566-575), and `primary_frontend_origin()` (config.py:1795) for the consent redirect. The decisive new facts for the plan are listed under **Findings that refine or contradict CONTEXT** below.

**Primary recommendation:** Build the AS as thin Starlette/FastAPI routes registered inside `register_mcp(app)` under an `/oauth/` prefix plus base-path-derived `.well-known` routes; keep pending requests and codes in Redis (atomic GET+DEL), clients and tokens in Postgres (mig 224); make the OAuth token a second *lookup* in front of the one shared admission tail of the key resolver; add one `client_metadata` capability to `egress.py`; add one `location ^~ /.well-known/oauth-` to nginx; leave Vercel's routing untouched except anti-framing headers on `/app/connect/`.

### Findings that refine or contradict CONTEXT (read first)

| # | CONTEXT says | Research found | Recommended resolution |
|---|---|---|---|
| F-1 | D-18: `resource` "required at authorize **and token**" | The SDK client omits `resource` on refresh when it has no cached PRM and no protocol version (`client/auth/oauth2.py:218-233, 525`) — e.g. a refresh after a client restart. RFC 8707 lets a refresh omit it (the token is already bound). Refusing would silently disconnect real clients. | **Proposed D-47:** required on `/authorize` and on the `authorization_code` exchange; on `refresh_token`, optional — **if present it must equal the grant's recorded resource**, if absent the recorded resource is used. The edge's per-call resource check is unchanged. |
| F-2 | D-32: Anthropic egress `160.79.104.0/21` | Anthropic publishes **two** outbound IPv4 ranges: `160.79.104.0/21` **and `153.61.208.0/20`** [VERIFIED: platform.claude.com/docs/en/api/ip-addresses]. | Operator action names both. Cloud probe this session: `https://api.superrag.cloud/health` 200 in 0.56 s and unknown `.well-known` paths answer uvicorn's JSON 404 — no WAF/edge layer intercepts today (from a non-Anthropic IP; the real proof is D-39's connect). |
| F-3 | D-19: reuse revokes the family; grace only if Claude double-refreshes | Anthropic does not document refresh serialisation. Claude refreshes **reactively on 401 and proactively ≤ 5 min before expiry** (two independent triggers), runs parallel tool calls, and other MCP clients are documented racing exactly this way (GitHub copilot-cli #3456, opencode #60612). | **Proposed D-46: a 60 s grace, conditional.** A used refresh token presented ≤ 60 s after its rotation **and whose successor is still unused and unrevoked** re-rotates from the same parent (issues a fresh pair, revokes the unused successor pair) — never returns a stored secret. Any other reuse revokes the family. Safety argument in §Token lifecycle. |
| F-4 | D-16 sliding expiry + 304 switch copy "switching back on restores them" | If `/token` refresh applied the **switch** checks, a grant would lapse during a switch-off and NOT come back when switched on — contradicting the shipped copy (`mcpKeyCopy.orgSwitchImpact`, UI-SPEC "They are kept; switching back on restores them"). | **Proposed D-48:** refresh refuses on `revoked / expired / not_member / banned` only; `mcp_off_org` / `mcp_off_deployment` do **not** block a refresh (the `/mcp` edge still answers 403 with the sentence on every call). |
| F-5 | D-15: grant = `api_keys` row with a label | `api_keys.label` is NOT NULL 1..60 and **unique per (org, user, lower(label)) among unrevoked rows** (`api_keys_owner_label_active_uq`, mig 215:73-74). A second "Claude" grant, or a grant named like an existing key, would raise `DuplicateKeyLabel`. | Mig 224 recreates the index **with the same name** (the 304 code catches it by name, db/api_keys.py:52,104) as `WHERE revoked_at IS NULL AND oauth_client_id IS NULL`. Label = client name, btrim'd, capped at 60, fallback `Connected app`. |
| F-6 | D-29/UI-SPEC: "open Settings, then Connectors, and choose Add custom connector" | Claude's docs: **Customize > Connectors → Add custom connector → enter URL → Add**, then **Connect**. On **Team/Enterprise only an Owner** (or an Enterprise custom role) adds it, in **Organization settings > Connectors → Add → Custom**; members then **Connect** it from Customize > Connectors [VERIFIED: claude.com/docs/connectors/custom/add-unlisted]. | Copy fix in §UI-SPEC open items. The Team/Enterprise note is **confirmed** (stronger than "may need"). |
| F-7 | — (not in CONTEXT) | Spec 2026-07-28: AS **SHOULD** return `iss` (RFC 9207) on success and error redirects and advertise `authorization_response_iss_parameter_supported: true`; clients that see the flag MUST reject a response without `iss`. | **Proposed D-49:** emit `iss=<issuer>` on every authorization response (success, deny, post-redirect errors) and advertise the flag. Byte-identical issuer string everywhere (Pitfall 6). |
| F-8 | D-13: "research picks the one scope value Claude needs" | Claude needs **none**: it uses the 401 `scope`, else PRM `scopes_supported`, else omits `scope`; it appends `offline_access` only if the AS lists it. | **Proposed D-50:** advertise `scopes_supported: ["mcp"]` in PRM and AS metadata, never list `offline_access`, never put `scope` in the 401, **ignore** any requested scope value (never refuse on it), always answer `scope: "mcp"`. No scope maps to a capability. |
| F-9 | D-04: OIDC alias "only if Claude needs it" | Not needed: Claude accepts RFC 8414 or OIDC and MCP clients try `oauth-authorization-server` first. | Do not serve `openid-configuration`. On the one-box, make it a clean 404 rather than the SPA (§Routing). |
| F-10 | D-30 "one exact-prefix location" | nginx `try_files … /app.html` fallback is an **internal redirect** — `add_header` in the original location is lost. The consent route's anti-framing headers need `try_files /app.html =404;` (served in-location, the shipped `/docs` pattern). | §Routing gives the exact blocks. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PRM + AS metadata documents | API / Backend (pure functions of `mcp_public_base()`) | CDN/proxy (one-box nginx root `.well-known` passthrough) | Issuer must be the backend origin (D-02); only the one-box needs a proxy rule because its base has a path |
| DCR `register`, `authorize` validation, `token`, `revoke` | API / Backend | Redis (pending requests, codes), Postgres (clients, tokens) | Credentials and single-use state never touch the browser tier |
| CIMD document fetch | API / Backend via `security/egress.py` | — | SSRF boundary lives in one module (D-06) |
| Consent page (render, org/folder/tool picking) | Browser / Client (`/app/connect/<uuid>`) | API (request read, approve/deny with the member session) | Only the consent UI is frontend (D-02); the decision is enforced server-side |
| Grant creation, narrowing validation | API / Backend | Database (`api_keys` row) | Same validators as the 304 key create path |
| Token → principal at `/mcp` | API / Backend (edge → one resolver → one liveness predicate) | Database (digest lookup) | D-21: one resolver, per call |
| Connected apps list / revoke / org revoke-all | API / Backend (`/api-keys`, `/org/api-keys`) | Browser (Settings → API keys, Org admin → API keys) | D-25..D-27 |
| Redirect-host allowlist | Database (`app_settings` column) | API (operator route) + Browser (Control Room card) | Everything-in-the-UI rule; deployment policy → Control Room |
| Anti-framing / no-referrer on consent route | CDN/Static (Vercel headers, nginx, Vite dev middleware) | Browser (frame-detect fallback) | Header must be on the HTML response, i.e. the static tier |

## Standard Stack

### Core (all already installed — no new dependency)

| Library | Version (installed) | Purpose | Why |
|---------|---------|---------|-----|
| `mcp` (Python SDK) | 2.3.0 [VERIFIED: backend/requirements.txt:13, venv dist-info] | **Models only:** `mcp.shared.auth.OAuthMetadata`, `ProtectedResourceMetadata`, `OAuthToken`; optionally `mcp.server.auth.provider.construct_redirect_uri` | Field names track the spec (incl. `client_id_metadata_document_supported`, `authorization_response_iss_parameter_supported`); `url_preserve_empty_path=True` keeps the issuer byte-exact (measured) |
| FastAPI / Starlette | 0.115.6 / 0.41.3 | Routes; `request.form()` for `/token` and `/revoke` | Shipped |
| python-multipart | 0.0.20 [VERIFIED: requirements.txt:28] | form-urlencoded parsing (Claude sends `/token` as form) | Shipped |
| asyncpg | shipped | clients, tokens, grant rows (service-role pool) | `db/api_keys.py` pattern |
| redis (redis-py) | 5.3.1 (client), server `redis:7-alpine` (dev + prod compose) | pending requests, codes, OAuth rate buckets | Shipped; MULTI GET+DEL is atomic on Redis 5+ and Upstash |
| httpx | 0.28.x | via `egress.send_pinned_http` only | Never constructed directly for CIMD |
| pydantic | 2.12.5 | DCR request / consent body models | Shipped |

### Alternatives considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled routes | SDK `create_auth_routes` + a provider | Rejected (D-44): fails D-07 loopback, D-10 Syrel page, D-18 resource, D-04 metadata (`none`, CIMD), no CIMD server side, no rate limits, non-atomic code exchange, reuse undetectable |
| Hand-rolled routes | Authlib / oauthlib | New dependency for ~400 lines of protocol whose every branch is a project decision (D-07, D-10, D-18, D-19); still needs our CIMD, consent, limits, 401 |
| Redis for pending requests + codes | Postgres rows | Postgres is durable and transactional with the grant insert, but adds two tables, a sweep, and a write per authorize; Redis TTL is native and the connectors OAuth flow already keeps its state in Redis (`api/connectors.py:1456,1664` `redis_unavailable`) |
| Base-path-derived `.well-known` routes on the backend | nginx `rewrite` of `/…/api` → unprefixed | Both work; deriving from `mcp_public_base()` keeps nginx generic (one prefix location, no rewrite) and puts the topology knowledge in the one predicate |

**Installation:** none.

## Package Legitimacy Audit

No external package is installed or upgraded by this phase. `mcp`, `python-multipart`, `redis`, `httpx`, `asyncpg`, `pydantic` are already pinned in `backend/requirements.txt` and present in `backend/venv`. slopcheck not run (nothing to check).

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| — | — | — | — | — | — | no new packages |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Provider facts (read this session from the providers' own pages)

| Fact | Value | Source |
|---|---|---|
| Current MCP auth spec revision | **2026-07-28** (pages under `/specification/2026-07-28/basic/authorization/…`) | [VERIFIED: modelcontextprotocol.io/specification/latest/basic/authorization] |
| Registration priority | pre-registered → **CIMD** (if `client_id_metadata_document_supported`) → DCR (**deprecated**, backwards-compat) → manual | [VERIFIED: …/2026-07-28/basic/authorization/client-registration] |
| CIMD — AS duties | SHOULD fetch URL-shaped `client_id`; **MUST** validate doc `client_id` == URL exactly; SHOULD cache respecting HTTP cache headers; **MUST** validate presented `redirect_uri` against the doc's `redirect_uris`; MUST validate JSON + required fields (`client_id`, `client_name`, `redirect_uris`); SHOULD follow SSRF guidance | same |
| Consent display | AS **MUST clearly display the redirect URI hostname**; SHOULD warn extra for localhost-only redirects | [VERIFIED: …/security-considerations] |
| HTTPS | All AS endpoints MUST be HTTPS; redirect URIs localhost or HTTPS | same — local `http://localhost:8000` is a dev exception; the SDK's own issuer validator allows loopback http (`server/auth/routes.py validate_issuer_url`) |
| PKCE | Clients MUST verify `code_challenge_methods_supported` present (else refuse); MUST use S256 | same |
| Refresh | AS **MUST rotate refresh tokens for public clients** (OAuth 2.1 §4.3.1); SHOULD issue short-lived access tokens | same |
| Audience | MCP server MUST validate the token was issued for it (RFC 8707); MUST NOT accept or pass through other tokens | same |
| PRM discovery | 401 `WWW-Authenticate` `resource_metadata` **or** well-known: path-suffixed `/.well-known/oauth-protected-resource/<path>` then root `/.well-known/oauth-protected-resource` | [VERIFIED: …/authorization-server-discovery] |
| AS metadata discovery (issuer with path, e.g. `https://h/api`) | 1) `https://h/.well-known/oauth-authorization-server/api` 2) `https://h/.well-known/openid-configuration/api` 3) `https://h/api/.well-known/openid-configuration`; doc `issuer` MUST equal the issuer used to build the URL | same |
| `iss` (RFC 9207) | AS SHOULD include `iss` in authorization responses incl. errors; if included MUST advertise `authorization_response_iss_parameter_supported: true`; compared byte-for-byte, no normalisation | [VERIFIED: …/authorization] |
| Claude: 401 required | Claude starts sign-in only on HTTP 401 + `WWW-Authenticate`; ignores it on 200; a 403 re-auths only with `error="insufficient_scope"`, any other 403 is terminal | [VERIFIED: claude.com/docs/connectors/building/authentication; …/lazy-authentication] |
| Claude: PRM | `resource` must equal the URL as the user enters it (incl. path); only the **first** `authorization_servers` entry is used | authentication page |
| Claude: CIMD vs DCR | CIMD only when AS metadata has **both** `client_id_metadata_document_supported: true` **and** `"none"` in `token_endpoint_auth_methods_supported`; else DCR via `registration_endpoint`. DCR registers a new client on **every fresh connection** | authentication page |
| Claude: callbacks | Hosted apps (claude.ai web, Desktop, mobile, Cowork): **`https://claude.ai/api/mcp/auth_callback`** — "may change to `https://claude.com/api/mcp/auth_callback`". Claude Code: loopback on a random port, e.g. `http://localhost:3118/callback` | authentication page; [CITED: support.claude.com/en/articles/11503834] |
| Claude Code CIMD document (fetched live) | `{"client_id":"https://claude.ai/oauth/claude-code-client-metadata","client_name":"Claude Code","client_uri":"https://claude.ai","redirect_uris":["http://localhost/callback","http://127.0.0.1/callback"],"grant_types":["authorization_code","refresh_token"],"response_types":["code"],"token_endpoint_auth_method":"none"}` — `Cache-Control: public, max-age=300`, Cloudflare-fronted, no redirect | [VERIFIED: curl https://claude.ai/oauth/claude-code-client-metadata, 2026-11-03] |
| Claude Code redirect sent | `http://localhost:<port>/callback` (Anthropic said it may switch to `127.0.0.1`); servers that matched ports exactly broke (claude-code #37747) | [CITED: github.com/anthropics/claude-code/issues/37747] |
| Claude: consent display for CIMD | name the **host of the `client_id` URL** as the app asking, not the doc's `client_name` (self-asserted) | lazy-authentication page |
| Claude: PKCE | always `code_challenge_method=S256` | authentication page |
| Claude: scopes | 401 `scope` → else PRM `scopes_supported` → else omit; appends `offline_access` if the AS lists it | authentication + lazy-auth pages |
| Claude: refresh | reactive on 401 **and** proactive up to 5 min before stored expiry; dead refresh token → return `invalid_grant`; rotate for public clients, return the new refresh token in the same response | authentication page |
| Claude: content types | `/token` form-urlencoded (initial + refresh); `/register` JSON | authentication page |
| Claude: latency | discovery, registration, token **10 s**; refresh **30 s** | authentication page |
| Claude: discovery cache | PRM + AS metadata cached globally per URL, ~5 min staleness, stale-on-failure | lazy-authentication page |
| Claude: egress | outbound IPv4 `160.79.104.0/21`, `153.61.208.0/20` | [VERIFIED: platform.claude.com/docs/en/api/ip-addresses] |
| Claude Code: header-configured server | a 401/403 with a configured `Authorization` header reports "connection failed" and **does not fall back to OAuth** → adding `resource_metadata` to the 401 does not change a key-holding Claude Code (D-22 confirmed) | [VERIFIED: code.claude.com/docs/en/mcp] |
| Claude Code: sign in | `claude mcp add --transport http <name> <url>`, then `/mcp` in a session and "follow the steps in your browser"; tokens stored + refreshed automatically; on a rejected token with a refresh token: refresh, reconnect, retry once | same |
| Claude.ai menus | Free/Pro/Max/Ultra: **Customize > Connectors → Add custom connector** → URL → **Add**. Team/Enterprise: Owner in **Organization settings > Connectors → Add → Custom** (Web) → URL → Add; members **Connect** under Customize > Connectors. Dialog "OAuth client": **Use Claude's published identity** (CIMD, recommended) / **Register automatically** (DCR) / **Use your own OAuth client** | [VERIFIED: claude.com/docs/connectors/custom/add-unlisted] |

## Architecture Patterns

### System Architecture Diagram

```
 Claude (Anthropic egress 160.79.104.0/21, 153.61.208.0/20) / Claude Code (member's machine)
   │ 1 POST /mcp (no token)
   ▼
 [McpEdge] ──401 + WWW-Authenticate: Bearer resource_metadata="<PRM URL>"──► client
   │ 2 GET PRM  ─────────────► [oauth_metadata] PRM {resource=mcp_url(), authorization_servers=[issuer]}
   │ 3 GET AS metadata ──────► [oauth_metadata] {issuer, /oauth/authorize, /oauth/token, /oauth/register,
   │                                             /oauth/revoke, S256, none, CIMD true, iss true, scopes [mcp]}
   │ 4a CIMD: client_id = https URL ─────────────────────────────────┐
   │ 4b DCR:  POST /oauth/register ─► [limit oauth_register] ─► validate redirect_uris (allowlist / loopback)
   │                                                            └─► oauth_clients row (kind=dcr)
   │ 5 browser GET /oauth/authorize?client_id&redirect_uri&code_challenge(S256)&state&resource
   ▼                                                                │
 [authorize] ─► [limit oauth_authorize] ─► client lookup ── CIMD? ──► egress.send_pinned_http("client_metadata")
     │                                      (cache fresh?)            (https, public IP, pinned, no redirect, cap, ≤4 s)
     │   invalid client / redirect ──► store REFUSED request ─► 302 to <app>/app/connect/<uuid>  (never to the client)
     │   valid ──► store PENDING request (Redis, 10 min) ─────► 302 to <app>/app/connect/<uuid>
     ▼
 [Consent page /app/connect/<uuid>]  (signed out → AuthPage + returnTo → back)
     │ GET /oauth/requests/<uuid> (member JWT) ─► status, client facts, orgs + switch state, catalogue
     │ GET /api-keys/folders (X-Org-Id = picked org)  (existing 304 route)
     │ POST /oauth/requests/<uuid>/approve {org_id, tools, folder_ids|null, include_external}
     ▼
 [approve] validate (membership, live switches, normalise_tool_selection, folder visibility)
     ─► atomic GET+DEL pending ─► INSERT api_keys (kind=mcp, oauth_client_id, random key_hash, expires +90 d)
     ─► code (Redis, 60 s, keyed by digest) ─► audit api_key.create {credential: oauth}
     ─► {redirect_url: redirect_uri?code&state&iss}  ─► page checks host == shown host ─► location.replace
   │ 6 POST /oauth/token (form) grant_type=authorization_code
   ▼
 [token] ─► [limit oauth_token] ─► GET+DEL code ─► client_id, redirect_uri, PKCE S256, resource ─► tx: INSERT access+refresh
   │ 7 POST /mcp Bearer srl_oat_…
   ▼
 [McpEdge] ─► resolve_mcp_principal ─(prefix srl_oat_)─► token digest lookup ─► grant api_keys row
               └─(prefix srl_mcp_)─► key digest lookup ─┘        ▼
                                              ONE shared admission tail: kind/oauth check → principal_still_allowed
                                              → touch_last_used → McpPrincipal(credential_kind="oauth"|"key")
   │ 8 POST /oauth/token grant_type=refresh_token ─► rotate (FOR UPDATE on grant) ─► reuse? grace? family revoke
   │ 9 POST /oauth/revoke ─► always 200; refresh token ⇒ revoke grant
 Members / admins ─► Settings → API keys → Connected apps (GET /api-keys/connected-apps, POST /api-keys/{id}/revoke)
                  ─► Org admin → API keys (GET /org/api-keys/connected-apps, POST /org/api-keys/connected-apps/revoke-all)
 Operator ─► Control Room → AI tool sign-in (GET/PUT /admin/mcp-sign-in-hosts) ─► app_settings column
```

### Recommended module layout

```
backend/app/mcp/
├── __init__.py          # register_mcp(app): + oauth routes, + consent/admin routers (D-03: main.py untouched)
├── edge.py              # 401 gains resource_metadata (built once per base)
├── access_log.py        # strip query on /oauth/* too
├── oauth_metadata.py    # NEW pure: issuer(), prm_url(), well-known paths from mcp_public_base(); PRM + AS docs
├── oauth_server.py      # NEW: /oauth/register, /oauth/authorize, /oauth/token, /oauth/revoke handlers
├── oauth_store.py       # NEW: Redis pending requests + codes (atomic GET+DEL), fail closed
└── oauth_clients.py     # NEW pure-ish: redirect matching (exact + loopback any-port), DCR body rules, CIMD doc rules
backend/app/db/oauth.py           # NEW: oauth_clients + oauth_tokens SQL (owner predicate rule as db/api_keys.py)
backend/app/api/oauth_consent.py  # NEW: GET /oauth/requests/{id}, POST …/approve, …/deny (member session)
backend/app/api/oauth_admin.py    # NEW: GET/PUT /admin/mcp-sign-in-hosts (operator) — or inside admin.py (FIRES ⛔)
backend/app/security/egress.py    # + capability "client_metadata"
backend/app/security/mcp_principal.py   # prefix dispatch; Literal["key","oauth"]
backend/app/security/api_key_auth.py    # split core into lookup + shared admission tail; refuse grant rows as wrong_kind
backend/app/db/api_keys.py        # oauth_client_id in _AUTH_COLUMNS; lists exclude grants; grant list/revoke-all
backend/app/api/api_keys.py       # connected-apps routes (additive); mcp block gains `oauth: bool`
backend/app/services/rate_limit.py      # Kind + 4 oauth buckets
backend/app/middleware/maintenance.py   # allowlist /oauth/token, /oauth/revoke, /oauth/register
supabase/migrations/224_mcp_oauth_grants.sql
frontend/src/components/connect/…       # per UI-SPEC
```

### Endpoint contract (paths relative to the backend; absolute URLs always built from `mcp_public_base()`, never from `Host`)

| Route | Method | Body / params | Success | Errors |
|---|---|---|---|---|
| `/.well-known/oauth-protected-resource{bp}{MCP_PATH}` and `/.well-known/oauth-protected-resource` | GET | — | 200 PRM JSON, `Cache-Control: public, max-age=300` | — |
| `/.well-known/oauth-authorization-server{bp}` | GET | — | 200 AS metadata JSON | — |
| `/oauth/register` | POST JSON (cap 16 KB) | RFC 7591: `redirect_uris` (1..10), `client_name` (≤ 200 stored, 60 shown), `token_endpoint_auth_method` (absent or `none`), `grant_types` ⊆ {authorization_code, refresh_token}, `response_types` ⊆ {code} | 201 `{client_id, client_id_issued_at, client_name, redirect_uris, grant_types, response_types, token_endpoint_auth_method:"none"}` — no `client_secret` | 400 `invalid_redirect_uri` / `invalid_client_metadata`; 429; 503 |
| `/oauth/authorize` | GET (POST optional) | `response_type=code`, `client_id`, `redirect_uri`, `code_challenge` (43-char base64url), `code_challenge_method=S256` (**missing or `plain` refused**), `state`, `resource`, `scope` (ignored) | 302 → `<primary_frontend_origin()>/app/connect/<uuid>` | bad client / redirect → **stored refused request**, 302 to the same consent route (never the client); after the redirect is proven: 302 to `redirect_uri?error=invalid_request|invalid_target|unsupported_response_type&state&iss`; Redis down → minimal 503 text page, no client data echoed |
| `/oauth/token` | POST form | `grant_type=authorization_code`: `code`, `redirect_uri`, `client_id`, `code_verifier`, `resource` · `grant_type=refresh_token`: `refresh_token`, `client_id`, `resource?` | 200 `{access_token, token_type:"Bearer", expires_in:3600, refresh_token, scope:"mcp"}`, `Cache-Control: no-store`, `Pragma: no-cache` | 400 `invalid_grant` (code/refresh dead, PKCE wrong, redirect/client/resource mismatch), `invalid_request`, `unsupported_grant_type`, `invalid_target`; 401 `invalid_client` (unknown client); 429; 503 |
| `/oauth/revoke` | POST form | `token`, `token_type_hint?`, `client_id` | **200 always** (D-20) | 429/503 only |
| `/oauth/requests/{uuid}` | GET (member JWT) | — | `{status: ready|expired|refused|deployment_off, reason?, host?, client{…}, account{email}, orgs[{id,name,mcp_off,active}], tools}` (UI-SPEC wire) | 401 no session |
| `/oauth/requests/{uuid}/approve` | POST (member JWT) | `{org_id, tools, folder_ids|null, include_external}` | `{redirect_url}` | 409/410 expired or used; 403/422 with a sentence |
| `/oauth/requests/{uuid}/deny` | POST (member JWT) | — | `{redirect_url}` (error=access_denied&state&iss) | 409/410 |

`{bp}` = the path of `mcp_public_base()` (`""` local/cloud, `"/api"` one-box). All `/oauth/*` and `.well-known` routes: `include_in_schema=False` (keeps `scripts/build-public-openapi.cjs` out of it, like `/mcp`).

### Metadata documents per topology (exact)

| | local | cloud | one-box |
|---|---|---|---|
| base / issuer | `http://localhost:8000` | `https://api.superrag.cloud` | `https://<host>/api` |
| MCP URL = PRM `resource` | `http://localhost:8000/mcp` | `https://api.superrag.cloud/mcp` | `https://<host>/api/mcp` |
| 401 `resource_metadata` (RFC 9728 path-inserted) | `http://localhost:8000/.well-known/oauth-protected-resource/mcp` | `https://api.superrag.cloud/.well-known/oauth-protected-resource/mcp` | `https://<host>/.well-known/oauth-protected-resource/api/mcp` |
| backend serves PRM at | `/.well-known/oauth-protected-resource/mcp`, `/.well-known/oauth-protected-resource` | same | `/.well-known/oauth-protected-resource/api/mcp`, `/.well-known/oauth-protected-resource` (nginx passes the path unchanged) |
| AS metadata URL (RFC 8414 path insertion) | `…:8000/.well-known/oauth-authorization-server` | `https://api.superrag.cloud/.well-known/oauth-authorization-server` | `https://<host>/.well-known/oauth-authorization-server/api` |
| endpoints | `{issuer}/oauth/authorize` etc. | same | `https://<host>/api/oauth/authorize` → nginx `/api/` strips → backend `/oauth/authorize` (existing block, no change) |

AS metadata body (one function, all topologies):
```json
{"issuer":"<issuer>","authorization_endpoint":"<issuer>/oauth/authorize","token_endpoint":"<issuer>/oauth/token",
 "registration_endpoint":"<issuer>/oauth/register","revocation_endpoint":"<issuer>/oauth/revoke",
 "scopes_supported":["mcp"],"response_types_supported":["code"],"grant_types_supported":["authorization_code","refresh_token"],
 "token_endpoint_auth_methods_supported":["none"],"revocation_endpoint_auth_methods_supported":["none"],
 "code_challenge_methods_supported":["S256"],"client_id_metadata_document_supported":true,
 "authorization_response_iss_parameter_supported":true}
```
PRM body: `{"resource":"<mcp_url()>","authorization_servers":["<issuer>"],"scopes_supported":["mcp"],"bearer_methods_supported":["header"],"resource_name":"Syrel"}`.

### Routing per topology (D-30)

- **Local:** Claude Code talks to `http://localhost:8000` directly; Vite (`:5173`) is never asked for `.well-known`. Only the consent page is on Vite. Nothing to change except dev anti-framing headers (Vite plugin in `vite.config.ts` reading a pure `devRouting.ts` helper).
- **Cloud:** issuer and PRM are on `api.superrag.cloud` (Coolify/Traefik → uvicorn). Probed: unknown paths there are uvicorn's JSON 404, so new routes need no proxy change. **Nothing on Vercel is requested by Claude** — `app.superrag.cloud/.well-known/oauth-authorization-server` currently returns the SPA HTML (200, measured), and that is fine because no client derives a URL on that origin. `vercel.json` gains **only** a `headers` entry for `/app/connect/(.*)`: `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`. The consent redirect uses `primary_frontend_origin()` (config.py:1795), which already prefers the `app.` origin (BUG-260904-04 handled).
- **One-box nginx** (FIRES ⛔ — invariant 1 "backend sees unprefixed paths" still holds for `/api/`; the root `.well-known` paths are passed **unchanged** and the backend registers them literally):
  ```nginx
  # Phase 307 — OAuth discovery for AI tools. The issuer is https://<host>/api, so RFC 8414 / RFC 9728
  # path insertion puts both documents at the ORIGIN ROOT, where `location /` would serve the SPA.
  location ^~ /.well-known/oauth- {
      proxy_pass $backend_upstream;          # variable upstream, no URI part: path passed as-is
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
  }
  location ^~ /.well-known/openid-configuration { return 404; }   # never the SPA (F-9)
  location ^~ /app/connect/ {
      add_header Content-Security-Policy "frame-ancestors 'none'" always;
      add_header X-Frame-Options "DENY" always;
      add_header Referrer-Policy "no-referrer" always;
      try_files /app.html =404;              # served IN this location, so add_header survives (F-10)
  }
  ```
  Must sit after `set $backend_upstream …` (nginx.conf:52-53) or the variable is undefined in that block — place it beside `location /api/`. `/app/connect/` is more specific than `/app/` (longest prefix wins; `^~` also stops regex search).
- **Phase 297 suite** (`frontend/src/__tests__/routing/appRouteParity.test.ts`, `routingLayers.testutil.ts`): add rows — `/app/connect/<uuid>` → app.html on all three layers **with** the three headers on Vercel and nginx; `/.well-known/oauth-authorization-server/api` and `/.well-known/oauth-protected-resource/api/mcp` → proxied (not `index.html`) on nginx; a negative control removing the location must flip it to SPA.

### Data model — migration 224

```
-- 1. clients
oauth_clients (
  id uuid PK default gen_random_uuid(),
  client_id text NOT NULL UNIQUE CHECK (char_length(client_id) BETWEEN 1 AND 2048),  -- DCR: random opaque; CIMD: the https URL
  kind text NOT NULL CHECK (kind IN ('dcr','cimd')),
  client_name text NULL CHECK (client_name IS NULL OR char_length(client_name) <= 200),
  client_uri text NULL CHECK (… <= 2048),
  redirect_uris jsonb NOT NULL CHECK (jsonb_typeof(redirect_uris)='array' AND jsonb_array_length(redirect_uris) BETWEEN 1 AND 10),
  metadata_fetched_at timestamptz NULL, metadata_expires_at timestamptz NULL,   -- CIMD cache (D-06)
  created_at timestamptz NOT NULL DEFAULT now(), last_grant_at timestamptz NULL )
  -- RLS ON, NO policy; REVOKE ALL FROM PUBLIC, anon, authenticated, service_role; GRANT ALL TO service_role
-- 2. api_keys
ALTER TABLE api_keys ADD COLUMN oauth_client_id uuid NULL REFERENCES oauth_clients(id) ON DELETE RESTRICT;
CHECK (oauth_client_id IS NULL OR kind = 'mcp');
CREATE INDEX api_keys_oauth_org_idx ON api_keys (org_id) WHERE oauth_client_id IS NOT NULL;
DROP INDEX api_keys_owner_label_active_uq; CREATE UNIQUE INDEX api_keys_owner_label_active_uq
  ON api_keys (org_id, user_id, lower(btrim(label))) WHERE revoked_at IS NULL AND oauth_client_id IS NULL;   -- F-5, same NAME
-- the authenticated column grant is NOT widened: oauth_client_id is read only by the backend
-- 3. tokens
oauth_tokens (
  id uuid PK, grant_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('access','refresh')),
  token_hash text NOT NULL UNIQUE, resource text NOT NULL,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz NULL, replaced_by uuid NULL REFERENCES oauth_tokens(id) ON DELETE SET NULL,
  revoked_at timestamptz NULL )
  CREATE INDEX oauth_tokens_grant_idx ON oauth_tokens (grant_id);
  -- RLS ON, NO policy; deny-all to client roles (the mig 222 mcp_usage block, copied)
-- 4. allowlist
ALTER TABLE app_settings ADD COLUMN mcp_oauth_redirect_hosts jsonb NOT NULL
  DEFAULT '[{"host":"claude.ai"},{"host":"claude.com"}]'::jsonb CHECK (jsonb_typeof(mcp_oauth_redirect_hosts)='array');
  -- entries {host, added_by?, added_at?}; seeded entries carry no added_by → "built in"
```
- **No SECURITY DEFINER function** is needed (everything runs on the service-role pool), so there is no EXECUTE surface.
- `scripts/full-schema-supplement.sql` (FIRES) gets the two new tables' REVOKE/GRANT lines (the mig 222 `mcp_usage` precedent at supplement:911-919) because the dump cannot carry them; `app_settings` already has its REVOKEs there (full-schema.sql:11475-11476) and a new column inherits them.
- Run `python scripts/check-greenfield-privileges.py` after regen.

### Redis keys (proposed D-45)

| Key | Value | TTL | Consumed |
|---|---|---|---|
| `oauth:req:{uuid}` | JSON: status (`ready`/`refused`), reason, client row id, `client_id`, kind, name, published host, `redirect_uri` (exact as sent), redirect host + kind, `state`, `code_challenge`, `resource` | **600 s** | read (non-consuming) by the page; **MULTI GET+DEL** by approve/deny |
| `oauth:code:{sha256(code)}` | JSON: grant id, `client_id`, `redirect_uri`, `code_challenge`, `resource` | **60 s** | MULTI GET+DEL at `/token` |
| `oauth:codeused:{sha256(code)}` | grant id | 600 s | a miss on `oauth:code:` that hits this → **revoke the grant** (OAuth 2.1: code reuse SHOULD revoke tokens issued from it) |
| `oauth:cimdfail:{sha256(client_id)}` | reason | 60 s | negative cache so a broken/attacker URL is not re-fetched on every authorize |
| `apikey:rl:oauth_{register,authorize,token,revoke}:{addr}:{minute}` | counter | 120 s | `rate_limit.hit` |

Redis down → authorize shows the 503 text page, approve 503, token 503 (`temporarily_unavailable`) — fail closed (D-33/D-34). Never a plaintext code or token as a key.

### Resolver dispatch (D-21) — one core, one tail

`api_key_auth.authenticate_presented_key` (api_key_auth.py:370-424) is today *lookup* (digest → `get_key_for_auth` → constant-time compare) followed by an *admission tail* (kind check → `principal_still_allowed` → throttled refusal audit via `_refused` → `touch_last_used` → `ResolvedKey`). Split it into those two internal steps and add a second **lookup** for `srl_oat_`:

1. `digest_token(presented)` (prefix, length ≤ 128, urlsafe alphabet — the `digest_key` shape) → `db.oauth.get_access_token_for_auth(digest)` returning the token row **joined to** its grant's `_AUTH_COLUMNS` (one statement, owner-agnostic, documented like `get_key_for_auth`).
2. Token-level checks: constant-time compare, `kind='access'`, `revoked_at IS NULL`, `expires_at > now()`, `resource == canonical(mcp_url())`. Unknown / expired → `KeyRefused("unknown")` **unaudited** (routine; Claude refreshes on it); wrong resource → audited `wrong_resource` through `_refused`.
3. The **same tail** with `expected_kind="mcp"` and a requirement that the grant row **has** `oauth_client_id`; the key path requires it **absent** (else `wrong_kind`, D-15).
4. `resolve_mcp_principal` dispatches on the prefix and builds `McpPrincipal(credential_kind="oauth", key_id=<grant id>, label=<client name>, …)`; the `Literal` widens to `"key" | "oauth"`. Nothing else in the app reads `credential_kind` today (grep: zero consumers outside mcp_principal.py), and `recheck_principal` has no live caller either — per-call liveness holds because the stateless edge resolves on **every** POST.

### Token lifecycle

- **Mint:** `secrets.token_urlsafe(32)` with prefixes `srl_oat_` (access) / `srl_ort_` (refresh); store `sha256` hex only; access `expires_at = now()+1h`; refresh `expires_at = grant.expires_at`.
- **Code exchange** (one transaction after the Redis GET+DEL): verify `client_id`, `redirect_uri` byte-equal to the authorize value, `code_verifier` 43–128 chars of `[A-Za-z0-9-._~]` and `base64url(sha256(verifier)) == challenge` (constant-time), `resource` canonical-equal; check the grant is still alive (revoked/expired/member/banned, F-4); insert the pair; set `oauth_clients.last_grant_at`.
- **Refresh** (proposed D-46 + D-48), in one transaction: `SELECT … FROM api_keys WHERE id=$grant FOR UPDATE` (serialises refreshes per grant), then the refresh row `FOR UPDATE`:
  - live & unused → mark `used_at=now()`, insert new pair, set `replaced_by`, slide `api_keys.expires_at = now()+90d` (and the new refresh row's expiry), respond.
  - used, `used_at > now()-60s`, successor unused and unrevoked → revoke the successor pair, issue a fresh pair from the same parent, respond (grace).
  - used otherwise → `UPDATE api_keys SET revoked_at=now()` (the family), audit `api_key.refused` `refresh_reuse`, `invalid_grant`.
  - grant revoked/expired/not member/banned → `invalid_grant` (switch-off does **not** refuse, F-4).
  - **Why the grace is safe:** at most one live refresh token exists per grant at any time; a thief who races inside 60 s revokes the legitimate successor, so the legitimate client's next refresh presents a revoked successor → that is reuse outside the grace rule → the whole family dies. The thief gains at most the remainder of one access token (≤ 1 h) — the same exposure as a stolen access token.
- **Pruning** (lazy, at refresh, same grant): delete access rows expired > 1 day; delete used refresh rows older than 30 days (reuse detection window; an older replay is "unknown" → `invalid_grant`, no family revoke). [ASSUMED sizing]
- **Revoke** (RFC 7009): digest lookup on either prefix; client mismatch or unknown → still 200, nothing done; refresh → revoke the grant (audit `api_key.revoke` `credential=oauth`); access → `revoked_at` on that row only.

### Redirect matching (D-07) — exact rules

1. Parse both with a strict parser; refuse fragments, userinfo, non-ASCII host, custom schemes.
2. `https` → the full string must equal a registered/published entry **and** the host must be on the allowlist (D-08), checked at registration (DCR) and at every authorize (DCR and CIMD).
3. `http` with host exactly `localhost`, `127.0.0.1` or `[::1]` → match an entry with the same scheme, same host, **any port on either side** (the Claude Code doc lists `http://localhost/callback` with no port), path and query byte-equal. Do **not** treat `localhost` and `127.0.0.1` as equal to each other (the doc lists both explicitly).
4. Any other `http` → refused. Never a prefix or wildcard match.
5. The stored `redirect_uri` for the code is the **presented** one (with its port); `/token` compares byte-for-byte against it.

### Connected-apps routes (D-27, smallest additive shape)

- `GET /api-keys/connected-apps` — the caller's grants across **every** org (A-13), `WHERE user_id=$1 AND oauth_client_id IS NOT NULL`, joined to `oauth_clients` and `organizations`; per-org switch state (one `mcp_switches` read per distinct org).
- Revoke one: the **existing** `POST /api-keys/{key_id}/revoke` with `X-Org-Id: <grant.org_id>` (membership validated by `get_active_org_id`); the route detects `oauth_client_id` and writes `metadata.credential='oauth'` + client name + redirect host.
- `GET /org/api-keys/connected-apps` (admin) — the org's grants with `owner_name`, `owner_is_you`; revoke one via the existing `POST /org/api-keys/{key_id}/revoke`.
- `POST /org/api-keys/connected-apps/revoke-all` (admin) — `UPDATE api_keys SET revoked_at=now(), revoked_by=$admin WHERE org_id=$1 AND oauth_client_id IS NOT NULL AND revoked_at IS NULL RETURNING id, user_id` → `{revoked: N}`; one audit row `api_key.revoke` `{credential:'oauth', scope:'org', count:N, members:M}`. Keys untouched by construction (the predicate).
- `GET /api-keys` `mcp` block gains `oauth: bool` (= `mcp_public_base() is not None`).
- **Exclusions** (`kind == 'mcp'` sweep, backend): `db/api_keys.list_keys_for_owner` and `list_keys_for_org` add `AND oauth_client_id IS NULL` (grants never in a key list, D-25 / UI-SPEC A-15); `_AUTH_COLUMNS` gains `oauth_client_id`; `mcp/audit.py`, `outside_ask.py`, `run_tools.py`, `db/rates.py` need **no** change (they key on `api_key_id` / thread origin — a grant gets per-key buckets, spend and audit by construction). Frontend `spend.ts` / `ExpertSpendCard` show a grant's label (client name) — acceptable; optional "connected app" wording is planner discretion.

### Anti-patterns to avoid

- Building any absolute URL (issuer, PRM, consent redirect) from the request `Host` / `X-Forwarded-*` — always from `mcp_public_base()` / `primary_frontend_origin()`.
- Returning the SDK's JSON 400 for a bad client/redirect from the browser-facing `/authorize`.
- A second liveness predicate, a second principal type, or token checks inside `principal_liveness.py` (it must stay a leaf).
- Comparing redirect URIs through `pydantic.AnyUrl` (it normalises — host case, empty path) — compare raw strings after a strict parse.
- Checking the MCP switches at `/token` refresh (F-4).
- Storing a plaintext code/token anywhere (Redis key or value, logs, audit metadata).

## UI-SPEC open items — answers

| Open item | Answer | Evidence |
|---|---|---|
| Claude connector menu names | **"In Claude.ai or Claude Desktop, open Customize, then Connectors, and choose Add custom connector."** Step 3: **"Click Add, then Connect. Sign in to Syrel and choose what Claude can use. No key is needed."** Optionally: leave the OAuth client settings on their default (Claude's published identity or automatic registration both work here). | add-unlisted page |
| Team/Enterprise note | **Keep it, firmer:** "On a Team or Enterprise plan, an owner adds the connector for the whole Claude organisation first, then you choose Connect." | add-unlisted page: members cannot add custom connectors themselves |
| Claude Code sign-in command | `claude mcp add --transport http syrel {url}` (no header), then run **`/mcp`** in Claude Code and follow the sign-in steps in the browser. | code.claude.com/docs/en/mcp |
| Pending-request TTL | **10 minutes** (600 s), single-use. Covers sign-in incl. SSO; matches RFC 6749's ≤ 10 min guidance for codes; the client restarts after. Copy stays "only for a few minutes" (A-22). | [ASSUMED sizing] |
| Removing a host keeps connected apps working? | **Yes — recommend it, keep the sentence.** The allowlist governs where a *sign-in* may send a browser (registration + authorize); a refresh never redirects, so re-checking there would turn a list edit into a silent mass disconnect without the victim-naming sheet the graded-guards rule requires. Cutting live apps is what the deployment switch and org "Disconnect all" are for. The `/token` handler therefore never reads the allowlist. | design reasoning (RFC 6749 refresh has no redirect) |
| Is the consent request id a UUID? | **Yes — `uuid.uuid4()`, lowercase**, so the 299 strict-UUID arm in `appRoutes.ts` and `returnTo.ts` applies unchanged. 122 random bits; the id alone grants nothing (reading needs the member session, approval is single-use). | appRoutes.ts:144-151 `isStrictUuid` |
| Does the `/app/*` catch-all already cover the route? | **Yes on all three layers** (main.tsx `{path:'*'}`; nginx `location /app/`; vercel `/app/(.*)` + `app.` host rule; devRouting catch-all) → **`main.tsx` is not edited**. `appRoutes.ts` needs only the one arm (for returnTo); nginx/vercel/vite change only for headers. | main.tsx:24, nginx.conf:30-32, vercel.json rewrites |
| Is the Claude.ai client CIMD or DCR here? | With D-04 metadata Claude.ai/Desktop default to **CIMD** (Anthropic-hosted document, host expected `claude.ai`); "Register automatically" in the dialog forces DCR. Claude Code uses CIMD `claude.ai/oauth/claude-code-client-metadata`. So G-4 row 1 shows **"verified" + "Details published at claude.ai" + `localhost` "this computer"**. | authentication + add-unlisted pages; live CIMD fetch |

**Security note for the planner (not a CONTEXT contradiction):** UI-SPEC's `consent.why.dcrSeeded` drops "Only allow it if you just started connecting from {host}" for `claude.ai`. The realistic phishing case for this product is precisely a seeded host: an attacker starts a Claude.ai connector flow from **their** Claude account and sends the victim the authorize link; approving would attach the victim's Syrel grant to the attacker's Claude conversation. Recommend keeping that sentence on **every web** case (DCR seeded, DCR other, CIMD) — it is the only text that addresses this, and the 10-minute TTL is the only other bound. Route through `/gsd:secure-phase`.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| SSRF-safe CIMD fetch | an httpx client | `egress.send_pinned_http("client_metadata", "GET", url, allowed_host=<url host>, timeout=4.0, max_bytes=16_384, headers={"Accept":"application/json","User-Agent":"Syrel-OAuth/1"})` + one capability wired in `ALLOWED_HOST_SUFFIXES` (`()`), `_HOST_MATCH` (`_CALLER`), `_TLS_SCHEMES` (`{"https"}`) | Pinned DNS, public-only, no redirects (`redirected` refusal), wire + decompression caps already proven by `test_190_egress.py`; extra keys are allowed if wholly wired (test_190_egress.py:566-575) |
| Metadata JSON shapes | dict literals | `mcp.shared.auth.OAuthMetadata` / `ProtectedResourceMetadata` / `OAuthToken`, `model_dump(exclude_none=True)` | Spec field names; issuer kept byte-exact (measured) |
| Rate limiting | a new counter | `rate_limit.hit(redis, key_id=addr, kind="oauth_token", limit=…)` with 4 new `Kind` literals | Shared across workers, fail closed |
| Liveness | token-specific checks of membership/ban/switches | `principal_still_allowed` via the shared tail | D-21 |
| Narrowing validation on approve | new folder/tool validators | the 304 create-path helpers (`normalise_tool_selection`, `_FOLDER_NOT_VISIBLE` folder check in `api/api_keys.py`) — factor them into a function both routes call | One sentence vocabulary, one rule |
| Frontend origin for the redirect | `settings.frontend_url` | `config.primary_frontend_origin()` | `FRONTEND_URL` is a list (BUG-260904-04) |
| Refusal audit throttling | per-refusal writes | `api_key_auth._refused` / `refusal_audit_slot` | CR-02 flood cap |
| Access-log secrecy | new filter | extend `mcp/access_log._is_mcp_path` to `/oauth/` | one filter |
| Redirect-param building | string concat | `urllib.parse.urlencode` (or the SDK's `construct_redirect_uri`) preserving an existing query | encodes `state` safely |

**Key insight:** every hard part of this AS already exists in the repo as a proven primitive; the new code is protocol plumbing whose every branch is a locked decision. A framework would add a second copy of liveness, redirect and storage rules.

## Common Pitfalls

1. **Loopback port mismatch** — exact matching rejects Claude Code (`localhost:3118` vs documented `localhost/callback`). Driven case: any port accepted for the three loopback hosts; `https://claude.ai:444/api/mcp/auth_callback` refused.
2. **`.well-known` answering the SPA** on the one-box (and the consent headers lost to nginx's internal redirect, F-10). Detect: routing suite + `curl -s -o /dev/null -w "%{content_type}"` must be `application/json`.
3. **`getaddrinfo` not bounded by the httpx timeout** (egress.py:741-749) — a blackholed DNS stalls authorize past 10 s. Wrap the CIMD fetch in `asyncio.wait_for(…, 5)`.
4. **Per-address limits are door-wide ceilings here**: uvicorn trusts forwarded headers only from 127.0.0.1, so behind Traefik/nginx every caller shares the proxy address (rate_limit.py:84-88), and all Claude.ai traffic comes from Anthropic's ranges anyway. Size buckets as door-wide: register 60/min, authorize 120/min, token 600/min, revoke 120/min [ASSUMED]; never let them share the `mcp_ip` bucket.
5. **Label uniqueness collision** (F-5) — the second "Claude" grant 409s without the index change.
6. **Issuer byte drift** — trailing slash, case, or Host-derived URLs break Claude's issuer check and RFC 9207 comparison. One `issuer()` function; a test asserts PRM `authorization_servers[0]` == AS `issuer` == `iss` param == `mcp_public_base()`.
7. **Refresh without `resource`** (F-1) and **refresh during switch-off** (F-4) — both silently disconnect real users.
8. **Pinned 401 header in 305 tests** — update `test_305_edge_refusals.py:126` and `test_305_refusals_live.py:79` in the same commit as the edge change, or the baseline (71) breaks.
9. **CIMD fetch from the VPS blocked by Cloudflare** — measured fine from this machine (200 JSON, cookies set), unmeasured from Coolify's IP. If it fails, Claude does **not** fall back to DCR (it chose CIMD) → every connect fails as "details unreadable". Add `curl -sS https://claude.ai/oauth/claude-code-client-metadata` from inside the backend container to the deploy parity checklist; set an honest `User-Agent`.
10. **A refused-request record or pending request keyed by anything guessable** — always `uuid4`; never echo raw client input into refusal copy (UI-SPEC already caps hosts at 253 chars, parsed).
11. **PostgREST "refusal" proven by reasoning** — D-18 requires a driven request (§Verification map).
12. **OpenAPI snapshot drift** — new `/api-keys/connected-apps` and `/org/api-keys/connected-apps*` operations land in the public document's `api-keys` group; regenerate with `scripts/build-public-openapi.cjs` in the same commit. All `/oauth/*`, `/.well-known/*`, `/admin/mcp-sign-in-hosts` are `include_in_schema=False` / hidden.
13. **Maintenance mode blocks refresh** — allowlist exactly `/oauth/token`, `/oauth/revoke`, `/oauth/register` (GETs already pass); the consent approve stays blocked under maintenance (it creates a grant).

## Code Examples

```python
# Source: backend/venv mcp/shared/auth.py (measured 2026-11-03) — issuer preserved, no trailing slash
OAuthMetadata(issuer="https://api.superrag.cloud", ...).model_dump_json(exclude_none=True)
# -> {"issuer":"https://api.superrag.cloud", ...}
```

```text
# Source: claude.com/docs/connectors/building/authentication + RFC 9728 §5.1 — the ONE 401 (D-22)
HTTP/1.1 401 Unauthorized
content-type: application/json
www-authenticate: Bearer resource_metadata="https://api.superrag.cloud/.well-known/oauth-protected-resource/mcp"
{"error":"invalid_token","error_description":"This MCP key is not valid. It may have been revoked or have expired."}
```
(Body text may stay as shipped; if reworded to "credential", update the 305 pins together.)

## Security Domain (security_enforcement: true)

### Applicable ASVS categories

| ASVS | Applies | Control |
|---|---|---|
| V2 Authentication | yes | Member session (GoTrue JWT) for consent; PKCE S256 for the client; opaque digest-stored tokens |
| V3 Session management | yes | 1 h access, rotating refresh, 90 d sliding grant, family revoke, revoke endpoint |
| V4 Access control | yes | Grant = `api_keys` row → `principal_still_allowed` + `KeyScope` per call; org picked explicitly; approve validates membership and switches |
| V5 Input validation | yes | Pydantic models for DCR / approve; strict URL parsing; length caps; no HTML rendering of client strings |
| V6 Cryptography | yes | `secrets.token_urlsafe(32)`, SHA-256 digests, `hmac.compare_digest` — no custom crypto |
| V13 API / V14 config | yes | `Cache-Control: no-store` on token responses; anti-framing + no-referrer on consent; routes hidden from OpenAPI |

### Threat model (STRIDE)

| # | Threat | STRIDE | Mitigation (where) | Verified by |
|---|---|---|---|---|
| T-307-01 | Open redirect via `redirect_uri` | Spoofing/Tampering | exact match + allowlist + loopback rule; bad client/redirect → Syrel page only; approve builds the URL from the stored request, never the body; page re-checks host before `location.replace` | unit: unregistered host, port drift, `http://` non-loopback, prefix-extension, fragment → no 302 to client |
| T-307-02 | Authorization-code injection / replay | Tampering | code single-use (GET+DEL), 60 s, bound to client_id + redirect_uri + PKCE + resource + grant; replay hits `codeused` → grant revoked | unit + live: second exchange → `invalid_grant` and the first tokens die |
| T-307-03 | PKCE downgrade | Tampering | missing method or `plain` refused at authorize; challenge must be 43-char base64url; verifier 43–128 chars | unit |
| T-307-04 | Mix-up (attacker AS) | Spoofing | RFC 9207 `iss` on every response (D-49); single issuer string | unit asserts `iss` == metadata `issuer` |
| T-307-05 | Consent clickjacking | Tampering | `frame-ancestors 'none'` + `X-Frame-Options: DENY` on all three layers; page refuses to render Allow when framed | routing suite rows; vitest framed branch |
| T-307-06 | CSRF on approve | Tampering | approve requires the member's Bearer JWT (not a cookie), so a cross-site form cannot attach it; request id single-use | unit: approve without session 401 |
| T-307-07 | Consent phishing / account injection (victim approves an attacker-started request; or request id leaks and attacker approves with their account) | Spoofing/Elevation | host shown as trust anchor; "only allow if you just started" sentence (recommended on all web cases); `Referrer-Policy: no-referrer`; 10 min TTL; `location.replace` keeps it out of history | UI copy review at secure-phase; residual risk recorded |
| T-307-08 | Token leakage via logs / URLs / Referer | Info disclosure | tokens only in headers/bodies; access-log query strip for `/oauth/*`; never in audit metadata; no-store | unit on the log filter; grep fence for `srl_oat_` in log format args |
| T-307-09 | SSRF via CIMD `client_id` | Info disclosure/Tampering | `egress.send_pinned_http` only (public IPs, pinned, no redirect, 16 KB cap, 4 s + `wait_for` 5 s); default port only [recommended]; negative cache | unit: loopback/RFC1918/metadata-IP/redirect/oversize → refused; source fence: no `httpx.AsyncClient` in `backend/app/mcp/oauth_*` |
| T-307-10 | DCR flooding | DoS | own bucket; 24 h deletion of clients with no grant (lazy, at register); field caps; 16 KB body | unit |
| T-307-11 | Refresh-token theft | Elevation | rotation; reuse ⇒ family revoke (bounded 60 s grace, D-46); sliding 90 d; member/admin revoke | live: reuse after grace → next `/mcp` call 401 |
| T-307-12 | Token used against PostgREST / GoTrue | Elevation | opaque non-JWT | **driven** live test (§Verification) |
| T-307-13 | Cross-org mix-up | Elevation | grant org = the page's explicit pick, validated against membership and live switches; `McpPrincipal.org_id` only from the grant row | live: grant in org A cannot read org B |
| T-307-14 | Wrong-audience token | Spoofing | `resource` recorded and checked at the edge; tokens dead if `BACKEND_PUBLIC_URL` changes | unit |
| T-307-15 | Grant secret presented as a key | Elevation | random never-shown digest; `oauth_client_id` set ⇒ `wrong_kind` in the key path | unit |
| T-307-16 | Enumeration via differing 401s | Info disclosure | one import-time 401 for every key/token failure | existing 305 fingerprint test extended with token cases |

## Verification map (Nyquist section skipped — `workflow.nyquist_validation: false`; this maps success criteria to tests)

| SC / must-have | Test | Type | Notes |
|---|---|---|---|
| SC2 / D-37(1) full round trip | `tests/integration/test_307_oauth_roundtrip_live.py`: POST `/mcp` → 401 header → GET PRM → GET AS metadata → POST `/oauth/register` → GET `/oauth/authorize` (302 to consent) → GET `/oauth/requests/{id}` with a real GoTrue member JWT → approve → POST `/oauth/token` → `tools/list` + `search_knowledge_base` → refresh → reuse refused (after grace) → revoke → `/mcp` 401 | live (spawned uvicorn, `_305_live` harness) | Also a CIMD variant with a stubbed `transport` seam on `send_pinned_http` |
| SC1 loopback any port | unit `test_307_redirect_match.py` (table-driven) + live consent with `http://localhost:54001/callback` against the Claude Code CIMD fixture | unit + live | |
| SC2 PKCE plain/missing | unit authorize + token | unit | |
| SC2 `.well-known` JSON | local: live GET returns `application/json`; cloud: post-deploy curl (operator); one-box: routing suite + `docker run nginx:1.27-alpine nginx -t` / container probe where Docker is permitted (Docker is denied in this agent shell — owed or run by operator) | live + vitest | |
| SC2 metadata field set | unit `test_307_metadata.py`: S256, `none`, CIMD flag, iss flag, scopes, issuer byte-equality across PRM/AS/iss, per-topology URLs for bases `http://localhost:8000`, `https://api.example`, `https://h/api` | unit | |
| SC3 removal per case (D-24) | `test_307_removal_live.py`, one test per case, each: mint grant → call OK → apply removal → **next** `/mcp` call refused: membership row deleted; ban (monkeypatch `deps._is_banned` like the 293 suites, or a real ban if the harness supports it); org switch off (403 + sentence); deployment switch off (403 + sentence); member revoke; org revoke-all; grant `expires_at` in the past; refresh reuse | live | Each removal serialized on the local-DB lock |
| SC3 PostgREST refuses token | `test_307_postgrest_refuses_token_live.py`: `GET {SUPABASE_URL}/rest/v1/api_keys?select=id` with `apikey: <anon key>` + `Authorization: Bearer srl_oat_…` → **401** and no rows; same against `{SUPABASE_URL}/auth/v1/user` → 401/403 | live (local Supabase :54321) | |
| SC3 rotation | unit refresh: rotate, grace re-rotate, reuse after grace ⇒ family revoked + audit `refresh_reuse`; refresh during switch-off succeeds (F-4); refresh without `resource` succeeds, with a wrong one fails (F-1) | unit (asyncpg on local PG) | |
| SC4 connected apps | backend route tests (member list across orgs, revoke via existing route + audit metadata, org list, revoke-all count + keys untouched); vitest for `ConnectedAppsSection`, `DisconnectAppSheet`, `OrgConnectedApps`; contract test beside `apiKeysContract.test.ts` | unit + vitest | |
| Mig 224 privileges / anon | `test_307_schema_privileges_live.py` (the 305 pattern): `has_table_privilege` false for anon/authenticated on both new tables (S/I/U/D), true for service_role; RLS on, zero policies; `has_column_privilege('authenticated','public.api_keys','oauth_client_id','SELECT')` false; one transaction-local `SET ROLE anon` SELECT on `oauth_tokens` (policy-less) → permission denied; label index predicate | live | ⛔ no `SET ROLE anon` on `api_keys` (BUG-261031-01) |
| D-05 latency | unit timing assertions per endpoint (< 1 s locally) + CIMD timeout test (stub resolver sleeping 10 s → refused within 5.5 s) | unit | |
| G-4 rows 1–3 | Claude drives with `claude` 2.1.317 (installed) + Chrome MCP at verification | manual-driven | |
| D-39 owed | real Claude.ai + Desktop connect / refresh ≥ 1 h / revoke on cloud; one-box connect | operator | recorded, never claimed |

Commands: backend `cd backend && venv/Scripts/python -m pytest tests/unit -q -k 307` (targeted), phase gate `node scripts/check-backend-unit-baseline.cjs` (≤ 71 failed); frontend `GSD_VITEST_MAX_WORKERS=2 npx vitest run src/__tests__/routing src/components/connect src/components/settings/apiKeys`, then the count gate once per wave.

## Suggested plan cut (G-8: 4 plans, 3 waves; every DB-writing plan serializes)

| Plan | Wave | Scope | Files (FIRING ⛔ = read its `docs/HOT-FILE-LEDGER.md` section first) |
|---|---|---|---|
| **307-01 — AS core + mig 224** | 1 | mig 224; `.well-known` docs; `/oauth/register|authorize|token|revoke`; Redis store; CIMD capability; resolver split + dispatch; 401 header; access-log filter; rate buckets; maintenance allowlist; round-trip + removal + PostgREST + privileges tests (consent approve driven through a test helper that calls the store directly, so 01 is independently verifiable) | `supabase/migrations/224_mcp_oauth_grants.sql`, `supabase/full-schema.sql` (regen), `scripts/full-schema-supplement.sql` (FIRES ⛔), `backend/app/mcp/{__init__,edge,access_log}.py`, NEW `backend/app/mcp/oauth_{metadata,server,store,clients}.py`, NEW `backend/app/db/oauth.py`, `backend/app/security/egress.py` (FIRES), `backend/app/security/mcp_principal.py`, `backend/app/security/api_key_auth.py` (FIRES ⛔), `backend/app/db/api_keys.py` (FIRES ⛔), `backend/app/services/rate_limit.py` (FIRES ⛔), `backend/app/middleware/maintenance.py`, tests incl. the two 305 pin updates |
| **307-02 — Consent** | 2 | `/oauth/requests/{id}` read/approve/deny (member session), shared narrowing validator factored from the key create path; consent page + all states; App.tsx branch; appRoutes arm; returnTo kind; `McpKeyFields variant` | NEW `backend/app/api/oauth_consent.py`, `backend/app/api/api_keys.py` (FIRES ⛔ — only the validator extraction), `frontend/src/App.tsx` (FIRES, one branch), `frontend/src/lib/appRoutes.ts` (FIRES ⛔, one arm), `frontend/src/lib/returnTo.ts`, NEW `frontend/src/components/connect/*`, NEW `frontend/src/lib/api/oauth.ts`, `frontend/src/components/settings/apiKeys/McpKeyFields.tsx` |
| **307-04 — Routing parity** | 2 (parallel with 02: no DB writes, disjoint files) | nginx `.well-known` + consent locations; Vercel headers; dev headers; 297 suite rows (consent rows as literals, like `LEGACY`); OPERATOR/DEPLOYMENT notes (both Anthropic ranges, CIMD reachability probe from the container, no new env var); ledger rows | `frontend/nginx.conf` (FIRES ⛔), `frontend/vercel.json`, `frontend/devRouting.ts`, `frontend/vite.config.ts`, `frontend/src/__tests__/routing/*`, `docs/OPERATOR.md`, `docs/DEPLOYMENT-LESSONS.md` / `DEPLOYMENT-WORKFLOW.md` parity checklist, `docs/HOT-FILE-LEDGER.md` |
| **307-03 — Connected apps, revoke-all, allowlist, copy** | 3 | member + org grant lists, revoke metadata, revoke-all; allowlist operator routes + Control Room card; snippet tab rewrite + bridge retirement; switch-impact copy; audit word reads | `backend/app/api/api_keys.py` (FIRES ⛔), `backend/app/models/api_key.py` (FIRES), `backend/app/db/api_keys.py` (FIRES ⛔), NEW `backend/app/api/oauth_admin.py` (keeps `admin.py` ⛔ untouched; included via `register_mcp`), `frontend/src/components/settings/apiKeys/{ApiKeysTab (FIRES ⛔, one mount), McpConnectSnippets, mcpSnippets, mcpKeyCopy (FIRES)}`, NEW `ConnectedAppsSection/ConnectedAppCard/DisconnectAppSheet`, `frontend/src/components/org/OrgApiKeysTab.tsx` (one mount), NEW `OrgConnectedApps.tsx`, `frontend/src/components/admin/{ControlRoomPage (FIRES, one mount), CapabilityGrid (FIRES ⛔, data only), AuditTab (FIRES)}`, NEW `McpSignInHostsCard.tsx`, `frontend/src/components/org/OrgAuditTab.tsx` (FIRES), `frontend/src/lib/api/apiKeys.ts` (FIRES ⛔), `frontend/src/lib/api/admin.ts` (FIRES ⛔) or a NEW `lib/api/oauth.ts` extension, public OpenAPI snapshot regen |

If wave time matters more than plan count, merge 04 into 03 (D-43 allows). `main.tsx`, `main.py`, `SettingsPage.tsx`, `admin.py`, `user_settings.py` are **not** touched under this cut.

## Runtime State Inventory

Not a rename/refactor phase — omitted. (Additive migration; no existing string renamed.)

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| backend venv Python | all backend | ✓ | 3.12.6 | — |
| Node | frontend, gates | ✓ | 24.19.0 | — |
| Local Supabase API | live tests, PostgREST refusal | ✓ (`:54321` 200) | — | — |
| Local backend | G-4 | ✓ (`:8000/health` 200; `/mcp` 401 with bare `Bearer` — baseline) | — | — |
| Redis | store, limits | assumed ✓ (backend healthy; `redis:7-alpine` compose) | 7 | — |
| Claude Code CLI | G-4 rows | ✓ | 2.1.317 | — |
| Docker CLI in agent shell | nginx container probe | ✗ (denied by permissions) | — | routing suite + operator probe |
| claude.ai CIMD reachable from dev box | local G-4 | ✓ (200 JSON) | — | DCR path |
| Cloud backend reachable | D-39 | ✓ (`api.superrag.cloud/health` 200, 0.56 s) | — | — |

**Missing with no fallback:** none for the build. **Owed:** the one-box container probe and every Claude.ai/Desktop row (D-39).

## State of the Art

| Old | Current | When | Impact |
|---|---|---|---|
| DCR as the primary path | **CIMD SHOULD; DCR deprecated** | MCP spec 2025-11-25 → 2026-07-28 | Advertise both (D-06); Claude prefers CIMD when both flags are present |
| No issuer in authorization response | **RFC 9207 `iss` SHOULD** (to become MUST) | 2026-07-28 | Proposed D-49 |
| `mcp-remote` bridge for Claude Desktop | native custom connector + OAuth | this phase | D-29 retires the bridge |
| Claude Code DCR with real redirect port | Claude Code CIMD with portless loopback entries | Claude Code 2.1.80 (2026-03) | Port-agnostic loopback is mandatory |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | Claude.ai's hosted CIMD `client_id` URL is on `claude.ai` and lists `https://claude.ai/api/mcp/auth_callback` | UI-SPEC answers | Consent page shows a different published host; allowlist still governs the redirect — low |
| A2 | Claude does not serialize refreshes per connection (so a grace window is needed) | F-3 / D-46 | If it does serialize, the grace window is unused but harmless |
| A3 | Rate-limit sizes (60/120/600/120 per minute, door-wide) | Pitfall 4 | Too low → throttles Claude.ai users collectively; too high → weaker flood bound. Constants, easy to tune |
| A4 | Pending TTL 10 min, refresh-row retention 30 d, CIMD cache clamp (below) | D-45 / lifecycle | UX/tuning only |
| A5 | CIMD cache: honour `Cache-Control: max-age`, clamped to [5 min, 24 h], default 1 h when absent; refetch only at authorize, never at `/token` | D-06 | Bounded by D-06 either way |
| A6 | Claude Code accepts an `http://localhost` issuer for the local G-4 drive | Env / G-4 | If not, G-4 runs against a tunnel (cloudflared) instead — operator-visible but not a design change |
| A7 | The CIMD document size cap of 16 KB is generous enough (Claude Code's doc is ~300 bytes) | Don't Hand-Roll | none practical |

## Open Questions

1. **Replace-on-reconnect.** Claude.ai DCR registers a new client on every fresh connection, so disconnect/reconnect cycles leave old grants visible for up to 90 days. Recommendation: on approve, revoke the member's other live grants with the **same `client_id`** in the **same org** (CIMD clients reconnect with one `client_id`); do not merge DCR clients by asserted name. Planner decides; record as a D-NN either way.
2. **Allowlist write audit.** The operator floor writes `request.state.audit_action` strings (admin.py:688-694); confirm the operator ledger accepts e.g. `settings.update` for the host list without a new literal, and add the AuditTab word.
3. **One-box container probe** needs Docker, which this agent shell is denied; the planner should either schedule it for the operator or prove the config with `nginx -t` in CI.

## Sources

### Primary (HIGH)
- MCP authorization spec 2026-07-28: `/specification/latest/basic/authorization`, `/authorization-server-discovery`, `/client-registration`, `/security-considerations` (modelcontextprotocol.io)
- Claude: [Authentication for connectors](https://claude.com/docs/connectors/building/authentication), [Lazy authentication](https://claude.com/docs/connectors/building/lazy-authentication), [Add a connector that isn't in the directory](https://claude.com/docs/connectors/custom/add-unlisted), [Claude Code MCP](https://code.claude.com/docs/en/mcp), [IP addresses](https://platform.claude.com/docs/en/api/ip-addresses)
- Live fetch: `https://claude.ai/oauth/claude-code-client-metadata` (2026-11-03)
- Installed SDK source: `backend/venv/Lib/site-packages/mcp/server/auth/{routes,provider}.py`, `handlers/{authorize,token}.py`, `shared/auth.py`, `client/auth/oauth2.py` (mcp 2.3.0)
- Codebase: edge.py:53-171, mcp/__init__.py:37-75, mcp_principal.py:21-52, principal_liveness.py:56-99, api_key_auth.py:370-432, db/api_keys.py:38-265, api/api_keys.py:102-360, egress.py:176-862, rate_limit.py:28-118, maintenance.py:40-83, mcp_tool_catalogue.py:116-160, config.py:1795-1831, nginx.conf, vercel.json, main.tsx:24, appRoutes.ts:144-163, returnTo.ts:36-62, mig 215:49-101, mig 220, supplement:860-919

### Secondary (MEDIUM)
- [support.claude.com 11503834](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers) — callback may move to claude.com (via search summary)
- [anthropics/claude-code #37747](https://github.com/anthropics/claude-code/issues/37747) — CIMD loopback port breakage

### Tertiary (LOW — pattern evidence only)
- [github/copilot-cli #3456](https://github.com/github/copilot-cli/issues/3456), [anomalyco/opencode #60612](https://github.com/anomalyco/opencode/issues/60612) — concurrent refresh races in MCP clients

## Metadata

**Confidence breakdown:**
- Standard stack / SDK verdict: HIGH — read from installed source
- Provider requirements: HIGH — read from current provider pages; Claude Code CIMD fetched live
- Architecture / routing: HIGH for local and cloud (probed), MEDIUM for one-box (config reasoning; container probe owed)
- Refresh race / grace: MEDIUM — not documented by Anthropic
- Pitfalls: HIGH — most tied to file:line

**Research date:** 2026-11-03
**Valid until:** 2026-12-03 (Claude connector docs and the MCP spec move monthly; re-check the callback URL and CIMD flags before the D-39 UAT)

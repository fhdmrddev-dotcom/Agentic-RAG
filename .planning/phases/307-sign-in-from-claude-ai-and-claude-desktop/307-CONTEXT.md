# Phase 307: Sign In From Claude.ai and Claude Desktop - Context

**Gathered:** 2026-11-03 (auto mode — operator: "continue by yourself, do not ask me end to end")
**Status:** Ready for planning (G-2 sketch first — see D-41)

<domain>
## Phase Boundary

A member adds Syrel as a **custom connector** in Claude.ai or Claude Desktop (and Claude Code through
a loopback redirect), is sent to a **Syrel consent page** that names the client and its redirect host,
picks the org and any folder and tool narrowing, and the client then calls the **same MCP tools under
the same narrowing, limits, liveness checks and kill switches as a personal MCP key** — on local,
cloud and the one-box. Members see and revoke their connected apps; an org admin revokes all of them
in the org (OAUTH-04..07).

Delivered: an own thin OAuth 2.1 authorization server on the backend origin (metadata, protected-
resource metadata, dynamic client registration, client ID metadata documents, authorize, token with
S256 PKCE and rotating refresh, revoke), the 401 challenge pointing at the metadata, the consent page,
the connected-apps list, org-admin revoke-all, `.well-known` routing on every topology, and one
grants migration.

**Not in this phase:** Supabase OAuth, scope step-up, new MCP tools, the Connectors Directory, custom
URI-scheme redirects, webhooks (308).

</domain>

<decisions>
## Implementation Decisions

### Authorization server shape (OAUTH-05; intake D1 / Q9 — already decided, carried forward)
- **D-01:** **Own authorization server.** Tokens are **opaque, random, stored only as SHA-256 digests, and looked up on every call.** Supabase OAuth 2.1 is out of scope (its tokens are user JWTs PostgREST accepts). Research may use the SDK's `mcp.shared.auth` models and, if it fits, the SDK's `OAuthAuthorizationServerProvider` / auth routes as the fast path — **only if** they can be driven by our storage, our consent page, our limits and our single 401; otherwise thin FastAPI routes. Research records the choice as a `D-NN`.
- **D-02:** **Issuer and every OAuth endpoint live on the backend origin, under `mcp_public_base()`** (the one refuse-mount predicate from 305 D-49) — the same base as the MCP URL. Issuer = that base (`http://localhost:8000` local, `https://api.superrag.cloud` cloud, `https://<host>/api` one-box). When `mcp_public_base()` is `None`, no OAuth route or metadata is served either. Only the consent page is a frontend route.
- **D-03:** **Registration rides inside `register_mcp(app)`** (`backend/app/mcp/`), so `backend/app/main.py` gets **zero new lines** (G-5, `100 / 74`). If research proves a lifespan or middleware line is unavoidable, it is one line, recorded.
- **D-04:** Endpoints: protected-resource metadata (RFC 9728, both the root and the path-suffixed `/mcp` form), authorization-server metadata (RFC 8414; plus the OpenID-configuration alias only if research shows Claude needs it), `register` (RFC 7591 DCR), `authorize`, `token`, `revoke` (RFC 7009). Metadata advertises **`code_challenge_methods_supported: ["S256"]`**, `client_id_metadata_document_supported: true`, `grant_types_supported: ["authorization_code","refresh_token"]`, `response_types_supported: ["code"]`, `token_endpoint_auth_methods_supported` including `none` (public clients). Exact field set per the **current MCP authorization spec and Claude's connector docs, read directly** (provider-docs-first).
- **D-05:** **Every endpoint answers in under 10 s** (Claude's limit); the CIMD fetch has a hard timeout well inside that (≤ 5 s). Measured, not assumed.

### Clients: DCR, CIMD and the redirect rule (OAUTH-04, OAUTH-05)
- **D-06:** **Both DCR and CIMD are supported and advertised.** A CIMD `client_id` is an https URL; its document is fetched **only through `backend/app/security/egress.py`** — one new capability beside `validate_mcp_destination` (https only, no private/loopback/link-local addresses, pinned resolution, no redirects followed, size cap, timeout). A fetch that bypasses `egress.py` fails the phase. The fetched document is cached on the client row with a bounded TTL (research sets it; ≤ 24 h) and the `client_id` in the document must equal the URL it was fetched from.
- **D-07:** **Redirect URIs match exactly**, string for string, against the client's registered (DCR) or published (CIMD) list — **except loopback**: `http://localhost`, `http://127.0.0.1` and `http://[::1]` match **on any port** (RFC 8252 §7.3), path and query still exact. No wildcard, no prefix match, no `https` downgrade. A redirect URI that does not match is **never redirected to** — the error is shown on a Syrel page (an open redirect fails the phase).
- **D-08:** **An operator-managed redirect-host allowlist** gates every non-loopback redirect host at registration and at authorize time, for DCR and CIMD alike. It lives in `app_settings` with a Control Room / Settings control (everything-in-the-UI rule), **seeded with `claude.ai` and `claude.com`** (Claude's callback `https://claude.ai/api/mcp/auth_callback` and the `claude.com` form — exact URLs verified in Claude's docs at research). Loopback needs no entry. Custom URI schemes (`cursor://`, `vscode://`) are refused in v1 (deferred).
- **D-09:** **Registered clients are bounded:** DCR is behind its own per-address limit bucket, a client that has never completed a grant is deleted after a bounded time (research sets it; ~24 h), and client-supplied strings (name, logo URI, URLs) are stored as untrusted data — length-capped, never rendered as HTML, the logo **not fetched** in v1.

### Authorize and the consent page (OAUTH-04; G-2, G-4)
- **D-10:** Flow: backend `GET /authorize` validates `client_id`, `redirect_uri` (D-07/D-08), `response_type=code`, **`code_challenge` with `code_challenge_method=S256` — missing or `plain` is refused**, `state`, and `resource` (D-18). Valid → it stores a **pending authorization request** (short-lived, single-use, server-side) and redirects the browser to the consent page with only that request's opaque id. Invalid client or redirect → a Syrel error page, never a redirect; other errors after the redirect is proven → redirect back with the OAuth `error` per spec.
- **D-11:** The consent page is a **frontend route under `/app/`** (exact path set by research; e.g. `/app/connect/authorize`) so the existing three-layer routing (`devRouting.ts`, `vercel.json`, `nginx.conf`) already serves it. A signed-out member goes through sign-in and **returns to the same consent request** via the existing `frontend/src/lib/returnTo.ts` mechanism (Phase 299).
- **D-12:** The page **names the client and its redirect host**, with the host as the trust anchor: a DCR client's name is self-asserted and is shown as such ("calls itself …"), the redirect host is shown plainly beside it; a CIMD client shows its `client_id` host as verified. A loopback redirect says "an app on this computer". The page also says which account is signing in.
- **D-13:** The member picks **the org** (default = active org; orgs where an MCP switch is off are listed disabled with the 304 sentence), **folders** (reuse `KeyFoldersField`; default not narrowed, `[]` refused per 304 D-08) and **tools** (reuse the 304 presets via `McpKeyFields`: **Read only** pre-selected, Read and ask, Read ask and run; 304 D-12). Narrowing is chosen **on the page, not by OAuth scope strings**; the advertised scope set is minimal (research picks the one value Claude needs) and no scope maps to a capability.
- **D-14:** **Approve** creates the grant (D-15), issues a **single-use authorization code** (short-lived, ≤ 60 s, consumed atomically; bound to client, redirect URI, PKCE challenge, resource and grant) and returns the redirect URL for the page to follow. **Deny** redirects with `error=access_denied`. A pending request can be approved once; a second approve or a stale request is refused.
- **D-15:** **The grant is a `api_keys` row** — `kind='mcp'` plus a new nullable `oauth_client_id` (mig 224), with `folder_ids`, `tools`, `include_external`, `org_id`, `user_id`, `expires_at` exactly as a key. Its `key_hash` is the digest of a random secret that is never shown (no one can present it as a key), and `authenticate_presented_key` refuses any row with `oauth_client_id` set as `wrong_kind`. Reason: liveness, narrowing (`KeyScope`), limits (per-key buckets), audit (`api_key_id`), spend (`mcp_usage.api_key_id` FK) and revoke then work **by construction** — "an OAuth grant is a key minted through a consent screen" (research SUMMARY). Research verifies the ~60 `kind == 'mcp'` sites and records any that must exclude grants (the member's key list must).
- **D-16:** Grant expiry: the `kind='mcp'` expiry CHECK holds. A grant gets **90 days, sliding** — each successful refresh moves `expires_at` to now + 90 days, so an app in use stays connected and an idle one lapses. Research confirms against Claude's refresh cadence.

### Tokens (OAUTH-05, OAUTH-06)
- **D-17:** **Access tokens** are opaque with their own prefix (e.g. `srl_oat_`), **1 hour**; **refresh tokens** opaque with their own prefix (e.g. `srl_ort_`). Both stored only as SHA-256 digests in a new token table (mig 224) linked to the grant. Neither is ever logged, put in a URL, or shown in the UI.
- **D-18:** **Tokens are bound to this server:** `resource` (RFC 8707) is required at authorize and token and must equal the canonical MCP URL (`mcp_url()`); the token row records it and the MCP edge refuses a token whose resource is not this server's. An access token presented to the Supabase Data API (PostgREST) is refused — it is not a JWT — **proven by a driven test**, not by reasoning.
- **D-19:** **Refresh rotates on every use**; the used token is marked used in the same transaction that issues the new pair. **Presenting an already-used refresh token is refused and revokes the whole grant** (token family), audited as `api_key.refused` with reason `refresh_reuse`. Research checks whether Claude ever double-refreshes concurrently; if it does, a grace window is a new `D-NN` with its bound written down, never silent.
- **D-20:** `revoke` (RFC 7009) accepts either token, always answers 200, and revoking a refresh token revokes the grant.

### The MCP edge and the ONE resolver (OAUTH-06; 305 D-46, 304 D-17/D-18/D-20)
- **D-21:** The edge (`backend/app/mcp/edge.py`) keeps one shape: Bearer from the header only, then **`mcp_principal.resolve_mcp_principal`**, which dispatches on the prefix — `srl_mcp_` → `authenticate_presented_key` (unchanged), access-token prefix → token digest lookup → the grant's `api_keys` row → **the same `principal_still_allowed`** → `McpPrincipal(credential_kind="oauth", key_id=<grant row id>, …)`. **No second liveness predicate, no second principal type, no second narrowing path.** A second resolver fails review.
- **D-22:** **The 401 gains `resource_metadata`:** `WWW-Authenticate: Bearer resource_metadata="<PRM URL>"` — still **one** response, built once at import (or once per base), identical for every credential failure, key or token (305 D-08/D-50). The two switched-off refusals stay 403 with their sentence. Research confirms a key-holding client (Claude Code with a header) is unaffected.
- **D-23:** Expired access token, revoked grant, used/unknown token, wrong resource → the same identical 401. An app session JWT at `/mcp` stays refused (305 D-09).
- **D-24:** **Removal tests per case** (SC3), driven through `/mcp` with a real OAuth token: membership removed, member banned, org MCP switch off, deployment MCP switch off, grant revoked by the member, all revoked by the org admin, grant expired, refresh reuse. Each is refused **on the next call**, not the next connection.

### Connected apps and revoke (OAUTH-07)
- **D-25:** The member's **Connected apps** list is a new leaf section **mounted once in the existing Settings → API keys tab** (`ApiKeysTab.tsx`, FIRES — one mount line), not a new Settings tab; **`SettingsPage.tsx` is not edited.** Each row: client name (as asserted), redirect host, org, narrowing summary (reuse `mcpKeyFacts` / `KeyFoldersField` summary wording), connected date, last used, and **Revoke** (reuse `RevokeApiKeySheet`'s pattern). Grants **do not appear** in the member's key list.
- **D-26:** The org admin's **existing `OrgApiKeysTab`** lists grants with a "Connected app" chip beside the key kinds and adds **"Revoke all connected apps"** behind a victim-naming confirm sheet (graded action-guards rule) that says how many apps and members it disconnects. Revoke-all affects OAuth grants in that org only, never keys.
- **D-27:** Routes extend the **existing Phase 293/304 key routes** (`backend/app/api/api_keys.py`, FIRES ⛔) — list grants for me, revoke one (existing revoke path), org-admin revoke-all — rather than a parallel route family; research proposes the smallest additive shape.
- **D-28:** **No new audit literal** (304 D-36): grant create/revoke reuse `api_key.create` / `api_key.revoke` with `metadata.kind='mcp'`, `metadata.credential='oauth'`, the client name and redirect host; refusals reuse `api_key.refused` (`refresh_reuse`, `wrong_resource`, …); org revoke-all writes one row naming the count. Every MCP call from a grant is audited exactly as a key's (305 D-26/D-53) — attributable by `api_key_id`.

### Key screen copy (304 D-27/D-29)
- **D-29:** The Claude.ai / Claude Desktop tab of `McpConnectSnippets` changes from the `mcp-remote` bridge to **"Add a custom connector with this URL, then sign in"** (the URL from `mcp_url()`); the labelled bridge workaround is **retired** (its condition, "until sign-in ships", is met). The warning against pasting a personal key into Claude.ai org headers stays. Claude Code gains the "or sign in instead of a key" note. Exact client steps are verified against each client's current docs (provider-docs-first).

### Routing and deploy parity (OAUTH-05; Phase 297 suite)
- **D-30:** Per topology, research proves **every `.well-known` path the spec and Claude request answers JSON from the backend**, never the SPA: local (backend directly), cloud (Coolify API origin directly — research confirms nothing on Vercel's origin is requested; if anything is, `vercel.json` gets a rule), **one-box** (`nginx.conf`, FIRES ⛔ — root `/.well-known/oauth-protected-resource/api/mcp` and `/.well-known/oauth-authorization-server/api` land on nginx's `location /`, so an exact-prefix `location` proxies them to the backend). The **Phase 297 three-layer routing suite** gains these paths and the consent route as pinned rows.
- **D-31:** Maintenance mode: the OAuth endpoints join `middleware/maintenance.py`'s allowlist (same entry style as `/mcp`, 305 D-25) so an existing connection can refresh during maintenance; the canvas gate never applies; `SetupMiddleware` still gates an un-set-up deployment.
- **D-32:** **No new env var expected** (issuer derives from `BACKEND_PUBLIC_URL`, D-02). If research proves one is needed, deployment-artifact parity (`deploy/onebox.env.example`, `docs/OPERATOR.md`, `docker-compose.prod.yml`, `scripts/check-deploy-drift.sh`) lands **in the same commit**. Research also checks WAF / proxy reachability from Anthropic's egress range (`160.79.104.0/21`) on Coolify and records the operator action.

### Data, migration and security
- **D-33:** Migration **224** (next free; 306 used 223): `api_keys.oauth_client_id` (+ its CHECK/index), the OAuth client table, the token table. Research decides whether pending requests and codes live in Redis (single-use via atomic get-and-delete; fail closed when Redis is down) or Postgres, and records it. **New tables: RLS on, no client-role grants** (service role only; the member reads grants through the backend), `key_hash`-style digest columns never granted. **Anon-role test** for every new table and column; new SECURITY DEFINER functions revoke `EXECUTE` from **`PUBLIC`** first. ⛔ No `db push` / `db reset`: local paste + `bash scripts/regenerate-full-schema.sh` (no `--reset`). Cloud paste after 220 → 221 → 222 → 223, per-action approval, then `get_advisors(security)`.
- **D-34:** Per-address limits on `register`, `authorize`, `token` and `revoke` use the shared Redis fixed-window limiter in their **own bucket kind** (cannot starve `mcp_ip` or `/inbound`), fail closed.
- **D-35:** **security_enforcement on**; `/gsd:secure-phase 307` runs before the phase is called done. The threat model covers at least: open redirect, authorization-code injection/replay, PKCE downgrade, CIMD SSRF, DCR flooding, consent-page clickjacking (frame-ancestors / X-Frame-Options on the consent route), CSRF on approve (the approve call carries the member's session and the pending request id; state is the client's), token leakage in logs/URLs, refresh reuse, mix-up across orgs.
- **D-36:** Tier: OAuth grants need **no tier capability** — the 304 D-41 decision extends (any member may connect; the org and deployment switches are the controls).

### Verification and UAT
- **D-37:** **Headline must-haves:** (1) the full spec round-trip driven locally (metadata discovery from the 401 → DCR → authorize → consent → code → token → tool call → refresh → reuse refused → revoke); (2) the per-case removal tests (D-24); (3) PKCE `plain`/missing refused; (4) unregistered redirect host and non-loopback port drift refused, loopback any-port accepted; (5) access token refused by PostgREST; (6) `.well-known` returns JSON on all three topologies (local driven; nginx config proven by the routing suite and a container probe where Docker is available).
- **D-38:** **G-4 rows** (driven by Claude at verification): (1) **Claude Code signs in through the loopback redirect** with no key — consent page opens in Chrome, names the client and `localhost`, the member picks an org and Read only, Claude Code lists the three read tools and runs a search; (2) the member revokes it in Connected apps and Claude Code's next call is refused; (3) an org admin's "Revoke all connected apps" names the count and disconnects a second grant.
- **D-39:** **Owed to the operator, recorded at close, not claimed** (roadmap: "Claude.ai works" is never claimed without it): a real **Claude.ai** connect, refresh (≥ 1 h later) and revoke on cloud, and **Claude Desktop** the same (both broker through Anthropic's servers, so they cannot reach `localhost`); the one-box connect; adding any Claude callback host the docs name beyond the seeded two. These need the 304–307 bundle deployed.
- **D-40:** The **8-provider scoreboard does not apply**: no LLM, streaming or provider-routing path is touched (the 305 D-44 reason). Backend baseline ceiling stays **71**; vitest with `GSD_VITEST_MAX_WORKERS=2`; tsc via `-p tsconfig.app.json` as a set diff; worktree rule 4 (local-DB suites serialize). ⛔ No edits to `threads.py`, `agent_loop.py`, `dispatcher.py`, `frontend/src/lib/api.ts`, `SettingsPage.tsx`.

### Guardrails that fire
- **D-41:** **G-2 fires** (consent page, connected-apps list, revoke-all sheet). **Next step is `/gsd:sketch` then `/gsd:ui-phase 307`, before `/gsd:plan-phase`.** The operator delegated this phase end to end, so Claude builds and self-approves the sketch; that substitution is recorded under `STATE.md → Guardrail overrides`, and the operator's look at the consent page is folded into the owed Claude.ai UAT (D-39). Load `Skill("sketch-findings-agentic-rag")` (Settings, Control Room confirm-sheet and audit-receipt vocabulary) before sketching.
- **D-42:** **G-5 / ledger:** expected FIRING files — `ApiKeysTab.tsx` (one mount), `OrgApiKeysTab.tsx` (chip + one action; check its row), `api/api_keys.py` ⛔, `egress.py` (one capability), `nginx.conf` ⛔ (one location), `mcpSnippets.ts` / `McpConnectSnippets.tsx` (copy), `appRoutes.ts` ⛔ / `main.tsx` ⛔ only if the consent route needs them (research proves whether the `/app/*` catch-all already covers it), `user_settings.py` / `admin.py` / `CapabilityGrid` only if the redirect allowlist control lands there. Every named file without a row gets its row and `docs/HOT-FILE-LEDGER.md` section in the same commit; `node scripts/check-hot-file-ledger.cjs` runs on each PLAN.md.
- **D-43:** **G-8:** target **3–4 plans**. A natural cut: (1) mig 224 + AS core (metadata, PRM, DCR, CIMD + egress capability, authorize/token/revoke, refresh rotation, resolver dispatch, 401 challenge, removal tests); (2) consent page + its backend request/approve routes + returnTo; (3) connected apps + org revoke-all + snippet copy + redirect-allowlist control; (4) routing parity (nginx, suite rows), maintenance allowlist, deploy-artifact check, ledger/bookkeeping — merge 4 into 3 if it fits a wave. Every plan writes the local DB → serialize on the local-DB lock.

### Research amendments (adopted 2026-11-03 at plan-phase, auto — operator: "continue by yourself, do not ask me")
Evidence for each is in `307-RESEARCH.md` §"Findings that refine CONTEXT". Where one narrows an earlier decision, the earlier text stands and this one governs.
- **D-44:** **Hand-rolled thin FastAPI routes, not the SDK's `create_auth_routes`.** The installed `mcp==2.3.0` auth routes fail D-04 (no `none` / CIMD flag in metadata), D-07 (no any-port loopback), D-10 (JSON errors, not a Syrel page) and D-18, have no server-side CIMD, no limits, a non-atomic code exchange and no reuse detection. Reuse only the `mcp.shared.auth` Pydantic models.
- **D-45:** **Pending authorize requests (10 min TTL, lowercase `uuid4` id) and auth codes (60 s) live in Redis**, consumed by an atomic GET+DEL so a code is single-use. Clients, grants and refresh rows live in Postgres (migration 224).
- **D-46:** **Refresh reuse — a bounded 60 s grace (narrows D-19).** A used refresh token presented ≤ 60 s after its rotation, **whose successor is still unused and unrevoked**, re-rotates from the same parent (fresh pair; the unused successor pair is revoked); a stored secret is never returned. Any other reuse revokes the whole grant family, audited.
- **D-47:** **`resource` (narrows D-18):** required on `/authorize` and on the `authorization_code` exchange; on `refresh_token` optional — if present it must equal the grant's recorded resource, if absent the recorded one is used. The edge's per-call audience check is unchanged.
- **D-48:** **Refresh refuses on `revoked / expired / not_member / banned` only.** The org and deployment MCP switches do not block a refresh (the `/mcp` edge still answers 403 per call), so "switching back on restores them" stays true.
- **D-49:** **RFC 9207 `iss=<issuer>`** on every authorization response (success, deny, post-redirect error) and `authorization_response_iss_parameter_supported: true` in metadata; one byte-identical issuer string everywhere.
- **D-50:** **Approve does NOT replace an earlier grant** from a same-named client. Claude's DCR registers a new client per reconnect, but auto-revoking by name could disconnect a live Desktop/claude.ai connection. Stale grants stay visible with their last-used time and lapse at 90 days unused (D-16); the member disconnects them by hand.
- **D-51:** **Removing a host from the redirect allowlist stops NEW sign-ins only;** already-connected apps keep working (refresh never re-checks the host). The UI-SPEC sentence "Apps already connected keep working" is therefore true, and its copy says so. Revoking them is the org/member Disconnect.
- **D-52:** **Anthropic egress for D-32 WAF reachability is two ranges: `160.79.104.0/21` and `153.61.208.0/20`.** Claude connector copy says "Customize → Connectors → Add custom connector", not "Settings"; Team/Enterprise: only an Owner adds it. Claude Code: `claude mcp add --transport http syrel <url>`, then `/mcp`.
- **D-53:** **Migration 224 recreates the `api_keys` unique-label index under the same name, excluding grant rows** (`oauth_client_id IS NULL`), so a second "Claude" grant does not collide. The two tests pinning the bare `Bearer` 401 header (`test_305_edge_refusals.py`, `test_305_refusals_live.py`) are updated in the same plan that adds `resource_metadata`.

### Claude's Discretion
- Module names inside `backend/app/mcp/` (e.g. `oauth_metadata.py`, `oauth_server.py`), token prefixes, table names, the consent route path, exact copy within the decisions above.
- Whether pending requests/codes live in Redis or Postgres (D-33), CIMD cache TTL and unused-client expiry (D-06/D-09) within the stated bounds.
- Where the redirect-host allowlist control sits (Control Room flags area vs Settings → API keys knobs), within the everything-in-the-UI rule.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and intake decisions
- `.planning/ROADMAP.md` §"Phase 307: Sign In From Claude.ai and Claude Desktop" — goal, 4 success criteria, "How we'd know this failed", Flags
- `.planning/REQUIREMENTS.md` — OAUTH-04, OAUTH-05, OAUTH-06, OAUTH-07
- `.planning/research/SUMMARY.md` — D1 (own AS), D2 (position), D5, Q9/Q10/Q16, §"Phase 307", open research items (CIMD, loopback, reuse detection, `.well-known`, WAF range)

### Prior phases this builds on (decisions carried forward)
- `.planning/phases/304-personal-mcp-keys-that-act-as-you/304-CONTEXT.md` — D-04 (api_keys columns), D-06 (prefix cross-use), D-07 (MCP expiry), D-08 (empty narrowing refused), D-12 (presets), D-17/D-18/D-20 (one resolver, one liveness predicate, McpPrincipal swap point), D-21/D-22 (KeyScope), D-27/D-29 (snippets, Claude.ai warning), D-35/D-36 (switch storage, no new audit literal), D-41 (no tier gate)
- `.planning/phases/305-connect-claude-code-and-cursor/305-CONTEXT.md` — D-08/D-50 (one 401, two 403s), D-09 (app JWT refused), D-25 (maintenance allowlist), D-46 (pure-ASGI edge), D-49 (mcp_public_base, URLs per topology), D-53 (audit), D-54 (per-address buckets)
- `.planning/phases/306-ask-the-agent-and-run-workflows/306-CONTEXT.md` — ask/run tools a grant may be narrowed to; outside-run admission

### Code the phase extends
- `backend/app/mcp/edge.py` — the one 401 and the resolver call (D-21/D-22)
- `backend/app/security/mcp_principal.py` — `McpPrincipal`, `resolve_mcp_principal` (credential_kind swap point)
- `backend/app/security/principal_liveness.py` — `principal_still_allowed` (reuse, never copy)
- `backend/app/security/api_key_auth.py` — `authenticate_presented_key` (refuse grant rows as keys)
- `backend/app/security/egress.py` — `validate_mcp_destination` / `send_pinned_http` (model for the CIMD capability)
- `backend/app/services/mcp_tool_catalogue.py` — `MCP_PATH`, `mcp_public_base()`, `mcp_url()`
- `backend/app/api/api_keys.py` — key routes (extend for grants, D-27)
- `supabase/migrations/215_api_keys_and_run_origin.sql`, `220_…`, `222_…` — api_keys column-grant pattern, `mcp_usage.api_key_id` FK
- `frontend/src/components/settings/apiKeys/` — `ApiKeysTab`, `KeyFoldersField`, `McpKeyFields`, `RevokeApiKeySheet`, `McpConnectSnippets`, `mcpSnippets.ts`, `mcpKeyFacts.ts`
- `frontend/src/components/org/OrgApiKeysTab.tsx`, `OrgMcpSwitchCard.tsx`
- `frontend/src/lib/returnTo.ts`, `frontend/src/hooks/useAuth.ts` — sign-in return (D-11)
- `frontend/nginx.conf`, `frontend/vercel.json`, `frontend/devRouting.ts` — three-layer routing (D-30)
- `backend/app/middleware/maintenance.py` — allowlist (D-31)

### Project rules
- `CLAUDE.md` — provider-docs-first, migration discipline, Supabase MCP writes approval-gated, deployment-artifact parity, G-2/G-4/G-5/G-8, hot-file ledger
- `docs/HOT-FILE-LEDGER.md` — sections for every FIRING file named in D-42
- `docs/DEPLOYMENT-WORKFLOW.md`, `docs/DEPLOYMENT-LESSONS.md` — cloud parity checklist (`get_advisors(security)`)

### External specs (research reads these directly — provider-docs-first)
- MCP authorization spec (current revision) — PRM, 401 challenge, DCR, CIMD, PKCE, resource indicators
- Claude's remote-MCP / custom-connector docs — callback URLs, DCR vs CIMD selection, timeouts, egress IP range
- RFC 9728 (protected resource metadata), RFC 8414 (AS metadata), RFC 7591 (DCR), RFC 7636 (PKCE), RFC 8707 (resource indicators), RFC 8252 §7.3 (loopback), RFC 7009 (revocation), RFC 9700 (OAuth security BCP — refresh rotation and reuse)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `principal_liveness.principal_still_allowed(pool, key_row=…)`: the whole liveness chain for a grant row, unchanged.
- `McpPrincipal` already carries `credential_kind` (only `"key"` today) — widening the literal to `"oauth"` is the designed swap point (304 D-20).
- `KeyFoldersField`, `McpKeyFields`, `mcpKeyFacts`, `RevokeApiKeySheet`: consent-page narrowing controls and the connected-apps row/revoke.
- `egress.send_pinned_http` + `validate_mcp_destination`: the pinned, SSRF-safe fetch pattern for CIMD.
- `services/rate_limit.py` fixed-window limiter with per-kind buckets (`mcp_ip` precedent).
- `lib/returnTo.ts`: survives the sign-in round trip (GoTrue Site-URL fallback handled).
- `OrgMcpSwitchCard` / org admin audit pulse: pattern for org-admin actions.

### Established Patterns
- One resolver core, one liveness predicate, one identical refusal (304/305) — a grant is a credential lookup in front of the same chain.
- Column-level grants that never name digest columns (mig 215); new tables service-role only.
- Pure-ASGI edge with responses built once at import (305 D-46/D-50).
- `register_mcp(app)` owns MCP routing so `main.py` stays untouched.

### Integration Points
- `/mcp` 401 → PRM URL; MCP edge → resolver prefix dispatch; consent page ↔ backend pending-request/approve routes (member session via existing `get_current_user`, active org via `X-Org-Id` only for listing — the grant's org is the page's explicit pick).
- Spend and audit join on `api_key_id` — automatic for grants (D-15).

</code_context>

<specifics>
## Specific Ideas

- Roadmap failure list is the acceptance bar's mirror: Supabase JWT as access token; open redirect or loopback-port rejection; `.well-known` returning the SPA; CIMD fetch outside `egress.py`; a second principal resolver; consent page not naming client + redirect host; undetected refresh reuse; local-only success; "Claude.ai works" claimed without a real connect/refresh/revoke; any endpoint over 10 s.
- The consent page treats a DCR client name as a claim and the redirect host as the fact.

</specifics>

<deferred>
## Deferred Ideas

- OAuth scope step-up (research SUMMARY "Defer").
- Custom URI-scheme redirects (`cursor://`, `vscode://`) and fetching/rendering client logos.
- Connectors Directory listing (blocked by SEED-294).
- Supabase OAuth 2.1 as the AS — rejected at intake (D1/Q9); stays out unless a future need appears.
- Expert-scoped grants (an OAuth grant narrowed to an Expert).

### Reviewed Todos / Seeds
- Seeds sweep (`check-seeds-register.cjs --phase 307`): **0 matched** — the phase declares no `files_modified` yet, so the gate reports it as a fact about the phase. Re-run at plan time. No open `surface: Agentic-RAG` reported bug touches MCP/OAuth; no pending todos matched.

</deferred>

---

*Phase: 307-sign-in-from-claude-ai-and-claude-desktop*
*Context gathered: 2026-11-03 (auto mode)*

# Phase 168: SSO — SAML 2.0 (CORE) - Research

**Researched:** 2026-07-22
**Domain:** Enterprise SSO onboarding — Supabase-native SAML 2.0 service-provider (Cloud Management API + self-hosted GoTrue Admin API), identifier-first login routing, domain-gated JIT provisioning
**Confidence:** HIGH (provider contracts verified same-day against official Supabase docs; MEDIUM on the exact JWT `amr` claim shape and Management-API error semantics — both flagged for the one live round-trip)

## Summary

This phase is **composition, not construction**. Supabase Auth *is* the SAML 2.0 service provider, so we register per-org "connections" through a provider-CRUD API and never touch SAML XML. The whole phase is three thin seams over already-shipped substrate: (1) an org-admin creates a per-org SAML connection through a FastAPI proxy that makes **one authenticated call** to Supabase's provider-CRUD API and writes the returned provider UUID into the thin `sso_configs` table (mig 104); (2) an identifier-first login page looks the email domain up in `sso_configs` and either routes to `signInWithSSO({ domain })` or reveals the password box; (3) a domain-gated JIT step — the sibling of the Phase-167 token-gated `accept_invitation` — drops the first-time SSO user into the right org idempotently. Zero new hard runtime dependencies; `supabase-js` already ships `signInWithSSO`.

The single most important architectural finding: the **Cloud and self-hosted provider-CRUD APIs are the same GoTrue handler behind two different front doors**. The request/response *bodies* are identical (`type`/`metadata_url`/`domains`/`attribute_mapping`/`name_id_format` in, `{id, saml, domains[]}` out). Only the **base URL + auth headers** differ (Cloud: `api.supabase.com` + `Authorization: Bearer sbp_…`; self-hosted: `{SUPABASE_URL}/auth/v1/admin` + `Authorization: Bearer <service_role>` **and** `apikey: <service_role>`). This means **one backend service with two thin transport adapters selected by an env-var switch** — honoring the Phase-160 4-tier no-code-fork contract exactly.

Two findings materially shape the plan beyond CONTEXT: (a) **mig 104 did NOT grant `org-admin` the `sso:manage` permission** — only `super-admin` holds it today (mig 104:416-425, with an explicit "168 MAY later additively INSERT an org-admin → sso:manage grant" note at 104:414). Without that grant, no org-admin can self-serve SSO — so a small migration (slot **113**) that adds the grant is **load-bearing, not optional**. (b) The **local Supabase CLI stack cannot run SAML** (Kong doesn't route `/sso` endpoints — supabase/cli#1335), which forces the D-168-06 live-test decision toward cloud staging (or a standalone self-hosted GoTrue), never the default local stack.

**Primary recommendation:** Build one `sso_provider_service.py` with a Cloud adapter and a self-hosted adapter (env-switched), proxied by new `sso:manage`-gated routes in `org.py`; ship migration 113 (org-admin `sso:manage` grant + `sso_configs.status` approval column + lowercased-`email_domain` uniqueness); resolve the post-login org by the **authenticated SSO `provider_id`** (not by re-parsing the email domain) and reuse `invitation_service`'s advisory-lock + `ON CONFLICT DO NOTHING` insert; mock the provider-CRUD call + domain routing + JIT insert in automated tests, and prove **one** live SAML round-trip against **mocksaml.com** on **cloud staging (Pro+)**.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SAML XML parse / assertion validation / SP metadata | Supabase Auth (GoTrue) | — | Supabase IS the SP; we never own the parser (research SUMMARY line 73, D-160 ADR). No `python3-saml`/`xmlsec1`. |
| Per-org SAML connection CRUD | API / Backend (FastAPI proxy) | Supabase provider-CRUD API | The management token (`sbp_`/`service_role`) must never reach the browser — backend-only. Writes `provider_id` to `sso_configs`. |
| Identity-provider → SP redirect + assertion consume | Supabase Auth (GoTrue) | Browser (redirect only) | `signInWithSSO` returns a URL; GoTrue's ACS endpoint consumes the assertion and mints the session. |
| Domain → provider routing decision | API / Backend (`sso_configs` lookup) | Browser (identifier-first form) | Domain→org mapping is org data behind RLS; the browser only sends the typed email and receives "SSO vs password". |
| Domain-gated JIT membership insert | API / Backend (service-role/BYPASSRLS) | Database (UNIQUE + advisory lock) | The SSO user isn't a member yet, so the user-JWT RLS write is denied — the same authorized service-role path as Phase-167 accept. |
| Approval / domain-hygiene gate | API / Backend (`sso_configs.status`) | Operator (Control Room, optional) | Supabase verifies neither domain ownership nor public-domain exclusion — that enforcement is ours (D-168-05). |
| Provider-management secret storage | API / Backend (Phase-150 store or env) | — | One deployment-level secret (not per-org); never client-exposed. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | already installed (`frontend/src/lib/supabase.ts`) | `signInWithSSO({ domain })`, `exchangeCodeForSession` | Built-in SSO client; **no new frontend dep** [CITED: supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml] |
| Supabase Auth (GoTrue) native SAML 2.0 | platform feature (Cloud Pro+ / self-hosted un-gated) | The SAML service provider itself | We do not hand-roll a SP [CITED: same] |
| `httpx` or `requests` (backend) | already present (used across `app/services/*`) | The backend→provider-CRUD HTTP call | Reuse the existing HTTP client; no new dep |
| `asyncpg` + `invitation_service` pattern | already present | Idempotent JIT membership insert | Reuse the Phase-167 advisory-lock + `ON CONFLICT DO NOTHING` seam |
| `secret_cipher.py` (Phase-150 MultiFernet) | already present | Encrypt the Cloud `sbp_` management token at rest | Established encrypted-secrets store (D-168-01) |

### Supporting (test-only — never shipped to prod)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `mocksaml.com` (BoxyHQ, hosted) | hosted service | Free mock SAML IdP for the one live round-trip | UAT only; zero IdP setup — metadata URL usable directly [VERIFIED: mocksaml.com] |
| `boxyhq/mock-saml` (Docker) | Docker image | Self-hosted mock IdP if offline testing is required | Optional fallback to the hosted mocksaml.com |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase-native SAML SP | `python3-saml` + `xmlsec1` (the stale PRD's plan) | REJECTED — redundant; re-introduces the `xmlsec1` CVE surface (research SUMMARY line 217, REQUIREMENTS "Out of Scope"). Supabase owns the parser. |
| Domain-based JIT org resolution | Provider-ID-based JIT org resolution | RECOMMENDED to key on the authenticated `provider_id`, not the email domain (see JIT seam below) — deterministic, immune to look-alike domains. |
| Cloud Management API (default) | Self-hosted GoTrue Admin API | Both ship — same body, env-switched adapter. Self-hosted = the enterprise isolation-via-deployment tier (un-gated/free). |

**Installation:** No `npm install` / `pip install` required — **0 new runtime packages**. The only new "dependency" is a test-time reference to the hosted mocksaml.com IdP.

**Version verification:** N/A for new packages (none). `@supabase/supabase-js` is already a project dependency and already exposes `signInWithSSO` (confirmed in the API surface — `frontend/src/lib/supabase.ts` imports from `@supabase/supabase-js`).

## Package Legitimacy Audit

> This phase installs **no external packages** — the Package Legitimacy Gate is not triggered.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | — | — | — | — | — | No new packages installed |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

`mocksaml.com` is a hosted test service (not an installed package). If an operator opts for the offline Docker fallback, `boxyhq/mock-saml` is a well-known BoxyHQ image [VERIFIED: hub.docker.com/u/boxyhq] — but it is a **test-only** container, never a runtime dependency of the app.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**How Supabase SSO actually works (grounding — verified against current official docs):**
- Supabase Auth IS the SAML SP. We never touch/parse SAML XML. Per org we register ONE "connection" (`type: saml`, an IdP metadata URL, and one or more email `domains`). `supabase.auth.signInWithSSO({ domain })` runs the whole redirect-to-IdP-and-back flow; GoTrue resolves domain→provider server-side. `{ providerId }` (the provider UUID) is the fallback when a provider has no domains.
- There is NO Supabase self-service SSO Dashboard screen and NO hosted admin portal (unlike WorkOS). "Self-service" is something WE build — but the actual integration is ~one API call, so it's cheap.
- **Cloud (our default, Pro+):** provider CRUD via the Management API — `POST/GET/PUT/DELETE /v1/projects/{ref}/config/auth/sso/providers` on `api.supabase.com`, auth = a project management / personal-access token (`sbp_…`) — the `service_role` key does NOT work here. SAML is Pro+ ($0.015/SSO MAU beyond quota).
- **Self-hosted GoTrue:** GoTrue Admin API — `POST /auth/v1/admin/sso/providers` with `service_role` (`Authorization` + `apikey`), gated by env `GOTRUE_SAML_ENABLED=true` + `GOTRUE_SAML_PRIVATE_KEY`. Un-gated (free) here.
- The env-var switch between these two must honor the Phase-160 4-tier deployment-flexibility contract (no code fork; deploy-time decision).

**D-168-01 — Full self-service via metadata URL.** The org-admin pastes their IdP's metadata URL (no XML files) into the SSO tab; our FastAPI backend makes one authenticated call to Supabase's provider-CRUD API to create/update/delete the connection. The provider-management token (cloud `sbp_…` / self-hosted `service_role`) is stored in the Phase-150 encrypted secrets store (`secret_cipher.py`), never env sprawl. Gated behind operator/domain-ownership approval before a connection goes live (see D-168-05).

**D-168-02 — Identifier-first login.** One email field. On submit, look up the domain in `sso_configs`: match → `signInWithSSO({ domain })`; no match → reveal the password field. Keep a small secondary "Sign in with SSO" escape-hatch link. Preserves the retained password fallback.

**D-168-03 — Email + name only; member-only JIT.** Map identity attributes only — email is auto-detected by Supabase; add `first_name`/`last_name` for display. Every JIT-provisioned `org_members` row defaults to `member`. NO IdP-supplied role/group attribute may grant `org-admin`. Admins elevate people in-app afterward. Department mapping added later (Phase 169).

**D-168-04 — SSO JIT seam (domain-gated, NOT token-gated).** SSO first-login has no invitation token. JIT resolves the org by verified email-domain → `sso_configs` → org, then reuses the 167 idempotent membership pattern (`pg_advisory_xact_lock` + `INSERT … org_members … ON CONFLICT DO NOTHING`, the token-authorized service-role/BYPASSRLS path). Critical Supabase gotcha: SSO and password accounts do NOT auto-link — same email via SSO creates a new `auth.users` row (new UUID). JIT must key membership on domain→org, tolerate duplicate-email accounts, never assume one `user_id` per email. Membership is join-additive (D-167-01).

**D-168-05 — Domain hygiene is OURS (anti-hijack; threat-model item).** Supabase does not verify domain ownership and does not exclude public domains. Before a connection goes live we add an operator / domain-ownership approval gate and reject public/personal domains (gmail.com, outlook.com, …). This is the phase's surviving risk (enforcement/hijack, NOT parser hardening).

**D-168-06 — Testability / UAT acceptance bar.** Local Supabase CLI ships SAML disabled + no local IdP. Recommended bar: (a) automated tests mock the provider-create API call + domain-routing decision + the domain-gated JIT membership insert; (b) ONE live end-to-end SAML round-trip against a real test IdP (samltest.id / a mock-saml container) on either a locally-SAML-enabled self-hosted GoTrue or cloud staging. Research confirms the cheapest of the two.

**Carried forward (locked upstream, do NOT re-ask):** Supabase IS the SAML SP; `python3-saml`/`xmlsec1` dropped; 0 new hard deps; frontend uses `supabase-js`'s built-in `signInWithSSO`. Email/password fallback RETAINED; SSO enforcement deferred. SSO tab lives in the shipped Phase-166 org-admin shell (`LockedTab` → LIVE), gated on `sso:manage` (mig-104 policy exists), reusing 166's design system.

### Claude's Discretion
The exact SSO-tab layout (metadata-URL input, connection status chip, SP metadata/ACS-URL display for the admin to paste into their IdP, test-connection affordance), the identifier-first form's transition animation, the approval-gate UX shape, and the precise `sso_configs` shape tweaks (e.g. a `status` column, uniqueness on `email_domain`, `provider_id` holding the real GoTrue provider UUID) — a possible small migration is a plan-time call (mig-104's `sso_configs` was deliberately thin).

### Deferred Ideas (OUT OF SCOPE)
- OIDC enterprise SSO → STRETCH Phase 172 (SSO-02) — Supabase per-org enterprise SSO is SAML-only; never promise "both native".
- SSO enforcement (no password fallback) → a later add-on once the fallback path is proven (never in v3.4).
- SCIM directory provisioning → when a customer requires it.
- Attribute → role elevation (IdP group grants org-admin) → deferred; member-only JIT this phase.
- Department import from SAML attributes → when departments go live (Phase 169); store-nothing this phase.
- Single Logout (SLO) — not supported by Supabase; use session timeboxing.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SSO-01 | An org-admin can register a SAML 2.0 IdP via Supabase's native SAML SP (Cloud Pro+ OR self-hosted GoTrue, un-gated); users route by email domain; attribute→claim mapping feeds JIT; JIT provisioning creates membership on first login; email/password fallback is retained (SSO enforcement deferred). No `python3-saml`. | Provider-CRUD contract (both surfaces) + `signInWithSSO`/callback + domain-gated JIT seam + `sso:manage` grant migration + domain-hygiene gate — all sections below. The **single CORE requirement**; every deliverable maps here. |
</phase_requirements>

## Provider-CRUD API Contract (the #1 gap — CLOSED)

Both surfaces are the **same GoTrue SSO-providers handler**. Cloud's Management API is a thin proxy in front of the project's GoTrue; self-hosted talks to GoTrue directly. The **request and response bodies are identical**; only transport (base URL + auth headers) differs. This is what makes one service + two adapters correct.

### Side-by-side transport table (design ONE service, TWO adapters)

| Concern | Cloud (default, Pro+) | Self-hosted GoTrue (enterprise, un-gated) |
|---------|----------------------|-------------------------------------------|
| Base host | `https://api.supabase.com` | `{SUPABASE_URL}` (the project's own origin) |
| Create path | `POST /v1/projects/{ref}/config/auth/sso/providers` | `POST /auth/v1/admin/sso/providers` |
| List path | `GET /v1/projects/{ref}/config/auth/sso/providers` | `GET /auth/v1/admin/sso/providers` |
| Get path | `GET /v1/projects/{ref}/config/auth/sso/providers/{id}` | `GET /auth/v1/admin/sso/providers/{id}` |
| Update path | `PUT /v1/projects/{ref}/config/auth/sso/providers/{id}` | `PUT /auth/v1/admin/sso/providers/{id}` |
| Delete path | `DELETE /v1/projects/{ref}/config/auth/sso/providers/{id}` | `DELETE /auth/v1/admin/sso/providers/{id}` |
| Auth header(s) | `Authorization: Bearer sbp_<mgmt/PAT token>` | `Authorization: Bearer <service_role>` **AND** `apikey: <service_role>` |
| Extra path var | `{ref}` = project ref (config, not secret) | none |
| Enablement gate | Project plan = Pro+ | env `GOTRUE_SAML_ENABLED=true` + `GOTRUE_SAML_PRIVATE_KEY` |
| Request body | **identical** (below) | **identical** (below) |
| Response body | **identical** (below) | **identical** (below) |

[CITED: supabase.com/docs/reference/api/v1-create-a-sso-provider — request params `type`, `metadata_xml`, `metadata_url`, `domains`, `attribute_mapping`, `name_id_format`; response `domains` = array of `{id, domain, created_at, updated_at}`] [CITED: supabase.com/docs/guides/self-hosting/self-hosted-saml-sso — `/auth/v1/admin/sso/providers`, both `Authorization` + `apikey` headers, identical body]

### Request body (create) — IDENTICAL on both surfaces

```json
{
  "type": "saml",
  "metadata_url": "https://idp.example.com/saml/metadata",
  "domains": ["example.com"],
  "attribute_mapping": {
    "keys": {
      "email":      { "name": "mail" },
      "first_name": { "name": "givenName" },
      "last_name":  { "name": "sn" }
    }
  },
  "name_id_format": "emailAddress"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `type` | yes | must be `"saml"` [CITED] |
| `metadata_url` | one of `metadata_url`/`metadata_xml` | HTTPS URL; GoTrue auto-refreshes it — **this is the D-168-01 path (admin pastes a URL, no XML)** [CITED] |
| `metadata_xml` | one of the two | raw XML string — NOT our path (we never handle XML) |
| `domains` | optional (but needed for `signInWithSSO({ domain })`) | array of **strings** on the request; returned as **objects** [CITED] |
| `attribute_mapping` | optional | `{ "keys": { <claim>: { name / names[] / default / array } } }` — email is auto-detected; add `first_name`/`last_name` only (D-168-03) [CITED] |
| `name_id_format` | optional enum | `persistent` \| `emailAddress` \| `transient` \| `unspecified` [CITED: self-hosted doc] |

Each `attribute_mapping.keys.<claim>` supports: `name` (primary source attribute), `names` (fallback array), `default`, `array` (boolean). **Do NOT map any `role`/`group` claim** (D-168-03 — attribute-driven elevation is the SSO escalation footgun; every JIT row is `member`).

### Response body (create) — IDENTICAL on both surfaces

```json
{
  "id": "d3f5a1b2-....-....",            // the provider UUID → write to sso_configs.provider_id
  "resource_id": null,
  "disabled": false,
  "saml": {
    "entity_id": "https://idp.example.com/saml",
    "metadata_url": "https://idp.example.com/saml/metadata"
  },
  "domains": [ { "id": "...", "domain": "example.com", "created_at": "...", "updated_at": "..." } ],
  "created_at": "...",
  "updated_at": "..."
}
```

- **`id`** — the GoTrue provider UUID. **This is the value written back to `sso_configs.provider_id`.** [VERIFIED: self-hosted doc response example; search-confirmed for Management API]
- The response describes the **IdP side** (their entity_id/metadata). It does **NOT** contain your Service-Provider ACS/entity-id — those are **static per deployment** (next paragraph).

### The SP metadata the admin pastes INTO their IdP (static per project — NOT in the create response)

| SP field | Value | Source |
|----------|-------|--------|
| Entity ID / Metadata URL | `{SUPABASE_URL}/auth/v1/sso/saml/metadata` | [CITED: auth-sso-saml] |
| ACS (Assertion Consumer Service) URL | `{SUPABASE_URL}/auth/v1/sso/saml/acs` | [CITED] |
| NameID format | `emailAddress` or `persistent` | [CITED] |
| Downloadable | append `?download=true` to the metadata URL | [CITED] |
| CLI convenience | `supabase sso info --project-ref <ref>` | [CITED] |

The metadata endpoint needs **no auth** and is fixed per deployment. The SSO tab should **display these three values** (read from `SUPABASE_URL`) for the admin to copy into Okta/Azure/Google — that is the "SP metadata display" in Claude's Discretion. No API call needed to obtain them.

### Error semantics (design defensive handling)

| Case | Expected signal | Handling |
|------|-----------------|----------|
| Invalid / unreachable metadata URL | 4xx from provider-CRUD (GoTrue can't fetch/parse the IdP metadata) | Surface a clean "couldn't reach that metadata URL" to the admin; do NOT write `sso_configs`. |
| Duplicate domain (already claimed by another provider) | 4xx (GoTrue enforces domain uniqueness across providers in the project) | Map to the D-168-05 hijack guard — reject with "domain already configured". |
| Plan/quota gating (Cloud, non-Pro) | 4xx from Management API | Surface "SAML requires Pro plan" (entitlement message — ties to ENT-01 stub). |
| SAML disabled (self-hosted, env unset) | 4xx/404 from GoTrue | Surface "self-hosted SAML not enabled — set `GOTRUE_SAML_ENABLED`". |
| Bad/expired management token | 401 | Fail closed; never leak the token; log by name only (secret-logging discipline, `secret_cipher.py` T-081.1-04). |

**Confidence:** Paths/bodies/headers HIGH (dual-doc verified). Exact 4xx codes + error JSON shape MEDIUM — **verify against the live one round-trip** and treat all non-2xx as "connection not created" (fail closed, don't write `sso_configs`).

### The provider-management secret — a SINGLE deployment-level secret, not per-org

All orgs live in ONE Supabase project, so the provider-CRUD credential is **one deployment secret**, not per-org:
- **Cloud:** a NEW secret — the `sbp_` Management/Personal Access Token + the project `ref` (ref is config, not secret). D-168-01 locks storing it in the Phase-150 store. **Caveat for the planner:** `secret_cipher.SECRET_COLUMNS` is a *fixed 12-column allowlist* of provider API keys in `app_settings` (`secret_cipher.py:47-52`) — storing the `sbp_` token there requires **adding a new `app_settings` column AND extending `SECRET_COLUMNS`**. See Open Questions Q3 for the env-var-vs-encrypted-column tension with CLAUDE.md ("env vars are for secrets and infra only").
- **Self-hosted:** NO new secret — the `service_role` key is **already** in config (`config.py:746`, `supabase_service_role_key`) and already used by `get_service_role_supabase`.

## `signInWithSSO` + Callback + Domain-Gated JIT Seam

### `signInWithSSO` behavior (frontend)

```ts
// Source: supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml
const { data, error } = await supabase.auth.signInWithSSO({ domain: "example.com" })
if (data?.url) window.location.href = data.url   // redirect the browser to the IdP
```

- Returns `{ data: { url }, error }`. **You must redirect** the browser to `data.url` (it does not auto-navigate). [CITED]
- `{ domain }` → GoTrue resolves domain→provider **server-side**. `{ providerId }` is the fallback when a provider has no domains (the escape-hatch link). [CITED]
- After IdP auth, the IdP POSTs the assertion to the SP ACS URL (`/auth/v1/sso/saml/acs`); GoTrue mints the session and redirects back to the app.
- **Callback:** with PKCE (supabase-js default for redirect flows), the app's return route must complete the exchange. `detectSessionInUrl: true` (the createClient default) handles most of this automatically on page load; if a `?code=` lands, call `supabase.auth.exchangeCodeForSession(code)`. The existing `useAuth` `onAuthStateChange` picks up `SIGNED_IN` once the session is established. **Verify the exact return param (code vs hash tokens) during the live round-trip** — it depends on the client's `flowType`. [CITED for exchangeCodeForSession; MEDIUM on which param our client receives — flagged A1]

### Reading SSO identity attributes post-login

| Datum | Where it lands | Reader |
|-------|----------------|--------|
| email | auto-detected; `auth.users.email` + `raw_user_meta_data.email` + `auth.identities.identity_data` | server (service-role) or JWT |
| first_name / last_name | `custom_claims` in the JWT + `auth.identities.identity_data` JSON + `raw_user_meta_data` | same |
| SSO provider identity | `auth.identities` row with `provider = 'sso:<provider_uuid>'`; JWT `amr` array carries the provider | server query is the robust reader |

[CITED: auth-sso-saml — "custom attributes stored in `custom_claims` … accessible via `auth.identities.identity_data`"; email/attrs also in `raw_user_meta_data`]

### The JIT resolution key — use `provider_id`, NOT the raw email domain (KEY FINDING)

D-168-04 says "key membership on domain→org." Refine this at implementation: the login already routed through a **specific provider** (resolved by domain at `signInWithSSO` time), and the returned session carries that provider identity. **Resolve the org from the authenticated `provider_id` → `sso_configs.provider_id → org_id`**, not by re-parsing `email` after login. Why:
- Deterministic and immune to look-alike/duplicate domains — the provider that actually authenticated the user is the source of truth.
- The email domain is only needed for the **login-page routing** decision (which provider to send them to); after login, the provider identity is already established.
- Matches the codebase's own multi-tenant hook note: `auth.jwt() #>> '{amr,0,provider}'` = `sso_provider_id` (168-CONTEXT code_context line 110).

**Robust server-side reader:** on the JIT call, the backend (service-role) looks up the user's SSO identity — `SELECT provider FROM auth.identities WHERE user_id = $1 AND provider LIKE 'sso:%'` → strip the `sso:` prefix → match `sso_configs.provider_id` → get `org_id`. This avoids trusting a client-supplied claim. **Flag A2:** verify the exact `auth.identities.provider` string format (`sso:<uuid>`) and the JWT `amr` shape against the live round-trip before locking the parser.

### The JIT endpoint — the domain-gated sibling of `accept_invitation`

Reuse `invitation_service.accept_invitation`'s exact idempotency skeleton (`backend/app/services/invitation_service.py:100-193`), swapping the token lookup for provider→org resolution:

```
POST /org/sso/provision   (or fold into GET /org/me bootstrap)
  Depends(get_current_user) ONLY — NO X-Org-Id, NO require_* org gate
  (the SSO user is not yet a member; org comes from the authenticated provider, never the client)

  1. Resolve provider_id from the caller's SSO identity (auth.identities, service-role read).
     If the caller has no SSO identity → 200 no-op (a password user hit this by mistake).
  2. org_id = SELECT org_id FROM sso_configs WHERE provider_id = $1 AND status = 'active'.
     If none / not active → 403 "SSO not configured for your organization" (fail closed).
  3. On the singleton pool (BYPASSRLS), inside ONE transaction:
       pg_advisory_xact_lock(hashtext(org_id || user_id))
       INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'member')
         ON CONFLICT (org_id, user_id) DO NOTHING          -- role ALWAYS 'member' (D-168-03)
  4. Return {org_id, role:'member', joined}. Idempotent + re-runnable (safe to call every SIGNED_IN).
```

- **Role is always `'member'`** — never derived from any attribute (D-168-03). This is the mig-104 CR-02 super-admin-floor lesson generalized: attribute→role is an escalation surface.
- **Duplicate-email tolerance is automatic:** the insert keys on `(org_id, new_user_id)`. A pre-existing password account with the same email is a *different* `auth.users` UUID and a *different* membership row — never conflated. [CITED: SSO/password no-auto-link]
- **Join-additive:** if the SSO user somehow already had a personal org, they keep it (the 166 switcher shows both) — the insert only adds the SSO org.
- **Where it fires:** the frontend calls this on `SIGNED_IN` when the session is an SSO session, mirroring how the Phase-167 `/invite` landing calls `accept_invitation`. Because `/org/me` returns empty memberships until JIT runs, provisioning must happen *before* the org switcher can resolve — call `/org/sso/provision` first, then re-probe `/org/me`.

## Domain-Hygiene / Anti-Hijack Gate (D-168-05 → concrete tasks + threat_model)

Supabase verifies **neither** domain ownership **nor** public-domain exclusion. The self-service convenience of D-168-01 is exactly what creates the hijack surface: an org-admin of Org A could register `victim-competitor.com` (or `gmail.com`) and intercept SSO logins. Two controls, both ours:

### Control 1 — Public/personal-domain blocklist (reject at create time)

- Maintain a **small curated blocklist** of public/free email-provider domains: `gmail.com, googlemail.com, outlook.com, hotmail.com, live.com, msn.com, yahoo.com, ymail.com, icloud.com, me.com, aol.com, proton.me, protonmail.com, gmx.com, zoho.com, mail.com, yandex.com, qq.com, 163.com` (extend as needed). A ~25-entry hardcoded set covers >99% of real cases; no runtime dependency needed.
- Optionally cross-reference a **disposable-domain list** (`disposable-email-domains/disposable-email-domains` on GitHub — a well-maintained community list) [VERIFIED: github.com/disposable-email-domains/disposable-email-domains]. **Recommendation:** vendor a static snapshot at build time or hardcode the top public providers — do NOT fetch a remote list at runtime (SSRF/availability risk). For this phase, the ~25-entry hardcoded public-provider set is sufficient; the disposable list is a nice-to-have.
- Enforce **before** calling the provider-CRUD API: normalize to lowercase, reject if the domain is in the blocklist → 422 "public email domains cannot be used for SSO."

### Control 2 — Operator / domain-ownership approval gate (status flow)

- New `sso_configs.status` column: `pending_approval` (default) → `active` → `disabled`.
- A newly-created connection lands `pending_approval`. **Only `status='active'` configs participate in login-page domain routing and JIT org resolution** (both queries filter `status='active'`). So a mis-registered/hijack-attempt domain routes nobody until approved.
- Approval authority: an **operator** (Control Room) or a **domain-ownership proof** step. For this phase's scope, the minimal viable gate is **operator approval** (the operator already governs cross-org concerns — settings-control-room-boundary). A full DNS-TXT domain-verification flow is a reasonable future addition but is NOT required to close the risk (the status gate + operator sign-off does).
- Record `approved_by` / `approved_at` for the audit trail (reuse the `write_audit_entry` seam already used in `org.py`).

### threat_model entry (for the planner + security-auditor)

| Threat | STRIDE | Mitigation (this phase) |
|--------|--------|-------------------------|
| Domain hijack — an org registers a domain it does not own to intercept SSO logins | Spoofing / Elevation | `status='active'` gate + operator approval before routing; public-domain blocklist; domain-uniqueness enforced by GoTrue AND a lowercased-`email_domain` unique index |
| Public-domain SSO (e.g. `gmail.com`) mass-onboarding strangers | Elevation | hardcoded public/free-provider blocklist, rejected at create time |
| Attribute→role elevation (IdP claims `role=org-admin`) | Elevation | JIT role hardcoded `'member'`; no role/group attribute mapped (D-168-03) |
| Management token leakage | Information Disclosure | backend-only; Phase-150 encrypted store or env; log by name only |
| SSO-enforcement lockout (disabling password before SSO proven) | Denial of Service | password fallback RETAINED; enforcement explicitly deferred (SSO-01 / SC#3) |

**Do NOT budget effort hardening a SAML XML parser** — Supabase/GoTrue owns it (research SUMMARY line 217). The surviving risk is enforcement/hijack, addressed above.

## `sso_configs` Shape Call — Migration 113 (RECOMMENDED, load-bearing)

Migration head is **112** (`112_skill_files_storage_org_scope.sql`); this phase's slot is **113**. A small firming-up migration is needed — and one part of it (the `sso:manage` grant) is **not optional**.

### 113 MUST include (load-bearing):

```sql
-- (1) LOAD-BEARING: grant org-admin the sso:manage permission. Mig 104 seeded this to
--     super-admin ONLY (104:416-425) with an explicit "168 MAY later additively INSERT an
--     org-admin -> sso:manage grant" note (104:414). Without this, NO org-admin can self-serve
--     SSO — D-168-01's entire premise fails. The sso_configs RLS write policies already gate on
--     current_user_has_permission(org_id,'sso:manage'), so this grant flips them live.
INSERT INTO public.role_permissions (role, permission_key)
VALUES ('org-admin', 'sso:manage')
ON CONFLICT (role, permission_key) DO NOTHING;
```

### 113 SHOULD include (D-168-05 approval gate + hygiene):

```sql
-- (2) approval-gate status (D-168-05). Only 'active' rows route logins / drive JIT.
ALTER TABLE public.sso_configs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status = ANY (ARRAY['pending_approval'::text, 'active'::text, 'disabled'::text]));

-- (3) one org per domain, case-insensitive (prevents two orgs claiming the same domain;
--     makes domain->provider routing deterministic). Partial: only non-null domains.
CREATE UNIQUE INDEX IF NOT EXISTS sso_configs_email_domain_lower_unique
  ON public.sso_configs (lower(email_domain)) WHERE email_domain IS NOT NULL;

-- (4) approval audit trail (optional but cheap).
ALTER TABLE public.sso_configs ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE public.sso_configs ADD COLUMN IF NOT EXISTS approved_at timestamptz;
```

- **`provider_id` stays `text`** (holds the GoTrue provider UUID string) — no type change, NO FK into `auth` (D-07 preserved).
- Do NOT store `metadata_url`/`metadata_xml` — Supabase owns them; storing the URL is only justified if the admin UI needs to display/re-sync it (nice-to-have; keep thin per D-07).
- **Apply discipline (CLAUDE.md):** idempotent/re-paste-safe (every statement uses `IF NOT EXISTS`/`ON CONFLICT DO NOTHING`); apply by pasting into the LOCAL Supabase SQL editor (never `db push`/`db reset`); then `bash scripts/regenerate-full-schema.sh` (no `--reset`) and commit the migration + regenerated `full-schema.sql` together. Filename digits-only (`113_...`). Cloud parity: 113 joins the pending 099→112 set for the next operator-gated push (also owe the Phase-113/SEED-125 cloud debt noted in memory).
- **Deployment-artifact parity (Phase-158 D-16):** if the Cloud `sbp_` management token becomes a new env var the app reads, update `deploy/onebox.env.example` + `docs/OPERATOR.md` + `docker-compose.prod.yml` in the SAME commit (or register it in `OMITTED_FROM_ONEBOX`).

### Backend/probe wiring that the grant unlocks

- Add `require_sso_manage` in `dependencies.py` — a verbatim mirror of `require_org_manage`/`require_org_invite` with the key swapped to `'sso:manage'` (dependencies.py:725-769 is the template).
- Extend the `/org/me` probe + `OrgProvider` with a `can_manage_sso` (sso:manage) flag; the SSO tab render-gates on it (mirrors `canManage`/`canAuditView`, `OrgProvider.tsx:48-51`). The tab's fetches are independently `sso:manage`-gated server-side — the flag is render-only.

## Architecture Patterns

### System Architecture Diagram

```
CONNECTION SETUP (org-admin, one-time)
  Admin SSO tab ──paste metadata URL──▶ POST /org/sso/providers  (FastAPI, require_sso_manage)
                                              │
                        blocklist + normalize domain (D-168-05 Control 1)
                                              │
                        ┌─────────────────────┴─────────────────────┐
                 env: cloud                                    env: self-hosted
                        │                                             │
       POST api.supabase.com/v1/projects/{ref}/...        POST {SUPABASE_URL}/auth/v1/admin/...
       Authorization: Bearer sbp_…                         Authorization: Bearer service_role
                        │                                    + apikey: service_role
                        └─────────────────────┬─────────────────────┘
                                              ▼
                              Supabase GoTrue (the SAML SP)
                                creates provider → returns { id, saml, domains }
                                              │
                    INSERT/UPDATE sso_configs (org_id, email_domain, provider_id=id,
                                               attribute_mapping, status='pending_approval')
                                              │
                              ── operator approval ──▶ status='active'  (D-168-05 Control 2)

LOGIN (any user, identifier-first)
  email typed ──▶ GET /org/sso/route?domain=x  ──▶ sso_configs WHERE lower(email_domain)=x
                        │                                AND status='active'
             match ─────┴───── no match
              │                     │
   signInWithSSO({domain})    reveal password box (RETAINED fallback)
              │
   redirect to data.url ──▶ IdP auth ──▶ ACS (/auth/v1/sso/saml/acs) ──▶ GoTrue mints session
              │                                                              (NEW auth.users UUID)
   callback ──▶ onAuthStateChange SIGNED_IN

FIRST-LOGIN JIT (SSO session only)
  SIGNED_IN ──▶ POST /org/sso/provision (get_current_user only)
                    resolve provider_id from auth.identities (service-role)
                    org_id = sso_configs WHERE provider_id=? AND status='active'
                    advisory-lock + INSERT org_members(...,'member') ON CONFLICT DO NOTHING
                    ──▶ re-probe /org/me ──▶ org switcher resolves
```

### Recommended Project Structure

```
backend/app/
├── services/
│   └── sso_provider_service.py     # NEW: the one service; two transport adapters (cloud/self-hosted)
│                                   #      env-switched; create/list/update/delete; returns provider id
├── api/
│   └── org.py                      # EXTEND: /org/sso/providers (CRUD, require_sso_manage),
│                                   #         /org/sso/route (domain lookup), /org/sso/provision (JIT)
├── services/
│   └── invitation_service.py       # REUSE: advisory-lock + ON CONFLICT skeleton (do NOT fork the crypto)
├── dependencies.py                 # EXTEND: require_sso_manage (mirror require_org_invite)
└── security/secret_cipher.py       # EXTEND (if D-168-01 UI-editable token): + supabase_management_token col

frontend/src/
├── hooks/useAuth.ts                # EXTEND: signInWithSSO + SSO-session detection
├── components/auth/SignInForm.tsx  # REWORK: identifier-first (email → route → password reveal)
├── components/org/
│   ├── OrgAdminShell.tsx           # FLIP: SSO LockedTab → live <SsoTab/>; render-gate can_manage_sso
│   └── SsoTab.tsx                  # NEW: metadata-URL input, SP-metadata display, status chip
└── providers/OrgProvider.tsx       # EXTEND: can_manage_sso flag from /org/me probe

supabase/migrations/113_sso_configs_firming.sql   # NEW: sso:manage grant + status + domain uniqueness
```

### Pattern 1: One service, two transport adapters (Phase-160 no-code-fork)
**What:** A single `sso_provider_service.create_provider(...)` that builds the request body ONCE, then selects transport (base URL + headers) by an env flag (e.g. `SUPABASE_SELF_HOSTED` / presence of the `sbp_` token vs `service_role`).
**When to use:** every provider-CRUD call.
**Example:**
```python
# Source: derived from the dual-doc contract above (both surfaces share the body)
def _transport() -> tuple[str, dict[str, str]]:
    if settings.supabase_self_hosted:                      # self-hosted GoTrue
        key = settings.supabase_service_role_key
        base = f"{settings.supabase_url}/auth/v1/admin/sso/providers"
        return base, {"Authorization": f"Bearer {key}", "apikey": key}
    # cloud: Management API + sbp_ token (decrypted from the Phase-150 store)
    base = f"https://api.supabase.com/v1/projects/{settings.supabase_project_ref}/config/auth/sso/providers"
    return base, {"Authorization": f"Bearer {get_mgmt_token()}"}

def build_body(metadata_url, domains, attr_map):           # IDENTICAL for both
    return {"type": "saml", "metadata_url": metadata_url,
            "domains": domains, "attribute_mapping": {"keys": attr_map},
            "name_id_format": "emailAddress"}
```

### Pattern 2: Reuse the 167 idempotency skeleton for JIT
**What:** advisory-lock + `INSERT … ON CONFLICT DO NOTHING` on the singleton pool. Copy the *structure* of `invitation_service.accept_invitation`; swap token→provider resolution; hardcode `role='member'`.
**When to use:** the `/org/sso/provision` seam.

### Anti-Patterns to Avoid
- **Parsing SAML XML / adding `python3-saml`:** we do not own the parser (SUMMARY line 217).
- **Keying JIT on the raw email domain after login:** use the authenticated `provider_id` (deterministic, hijack-resistant).
- **Deriving `org_members.role` from a SAML attribute:** always `'member'` (D-168-03) — the escalation footgun.
- **Sending the management token to the browser:** all provider-CRUD is backend-only.
- **Forking the code path per deployment tier:** one service, env-switched transport (D-160 4-tier contract).
- **Routing logins on `pending_approval` configs:** only `status='active'` participates.
- **Assuming SSO email == existing password user:** they are different UUIDs; never merge.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SAML assertion parse/validate, SP metadata, signing | A `python3-saml`/`xmlsec1` SP | Supabase GoTrue native SAML | Owns the CVE-prone XML surface; 0 deps (SUMMARY line 217) |
| Idempotent membership under race | A new lock/dedup scheme | `invitation_service` advisory-lock + `ON CONFLICT DO NOTHING` | Already proven in Phase 167 (D-167-05) |
| Secret at-rest encryption | New Fernet code | `secret_cipher.py` (Phase-150 MultiFernet) | Single source of key material (D-150) |
| Org-scoped write authz | Inline role checks | `current_user_has_permission(org_id,'sso:manage')` SECDEF + `require_sso_manage` | mig-104 policies already gate `sso_configs` on it |
| Mock IdP for testing | A hand-rolled SAML IdP | hosted `mocksaml.com` / `boxyhq/mock-saml` | Zero setup; purpose-built for SAML SSO test |
| Domain routing lookup | Client-side domain map | `GET /org/sso/route` over `sso_configs` (RLS) | Domain→org is org data, server-owned |

**Key insight:** Every hard part of "SSO" is already solved upstream (Supabase) or in-repo (Phase 150/166/167). This phase is wiring, an env-switched adapter, one small migration, and a login-form rework — not new security machinery.

## Runtime State Inventory

> Not a rename phase, but provider registration creates state OUTSIDE git/our DB — worth an explicit inventory so the planner treats it as first-class.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | SAML providers created via the CRUD API live in the **Supabase-owned `auth` schema** (`auth.sso_providers`/`auth.saml_providers`/`auth.sso_domains`), NOT in our `public` schema and NOT in git. Our `sso_configs.provider_id` is the only pointer we hold. | On teardown/delete, the backend must DELETE the provider via the CRUD API AND the `sso_configs` row — deleting only our row orphans the GoTrue provider. |
| Live service config | Cloud: SSO providers are project-level config in the Supabase project (visible to the `sbp_` token, not in git). Self-hosted: `GOTRUE_SAML_ENABLED` + `GOTRUE_SAML_PRIVATE_KEY` are container env, not git. | Cloud parity at operator-gated deploy; self-hosted operators must set the two env vars + Kong routing (see D-168-06). |
| OS-registered state | None — no OS-level registrations. | None — verified (this is an app/auth surface). |
| Secrets/env vars | Cloud: NEW `sbp_` Management token + project `ref`. Self-hosted: `service_role` (already present, `config.py:746`) + `GOTRUE_SAML_PRIVATE_KEY` (operator-generated, base64 PKCS#1 DER RSA 2048+). | Cloud token → Phase-150 store or env (Q3); self-hosted key → operator setup step. |
| Build artifacts / installed packages | None — 0 new packages; nothing compiled. | None — verified. |

**The canonical question — "after every file is updated, what runtime systems still hold state?":** The GoTrue `auth`-schema providers and (cloud) the project's SSO config. These are managed *only* through the CRUD API — our migrations never touch them (D-07: no FK into `auth`). Delete must go through the API.

## Common Pitfalls

### Pitfall 1: org-admin can't manage SSO (missing permission grant)
**What goes wrong:** The SSO tab renders and the routes exist, but every write 403s for an org-admin.
**Why:** mig 104 granted `sso:manage` to `super-admin` ONLY (104:421); org-admin was intentionally left out (104:414 note).
**How to avoid:** Ship the migration-113 grant `('org-admin','sso:manage')`. This is the first task, not a footnote.
**Warning signs:** org-admin gets 403 on `POST /org/sso/providers` while super-admin succeeds.

### Pitfall 2: local live SAML test is impossible on the CLI stack
**What goes wrong:** Attempting `signInWithSSO` against local Supabase returns 404 — Kong doesn't route `/sso`.
**Why:** The Supabase CLI local stack ships SAML disabled and doesn't wire the `/sso` endpoints (supabase/cli#1335). [VERIFIED: github.com/supabase/cli/issues/1335]
**How to avoid:** Mock provider-CRUD + routing + JIT locally; do the ONE live round-trip on cloud staging (or a standalone self-hosted GoTrue with Kong reconfigured). See D-168-06 resolution.
**Warning signs:** `/auth/v1/sso/*` 404 locally.

### Pitfall 3: conflating an SSO user with an existing password user by email
**What goes wrong:** JIT tries to "find or reuse" a user by email and merges/updates the wrong row.
**Why:** SSO and password accounts do NOT auto-link — same email = two distinct `auth.users` UUIDs. [CITED]
**How to avoid:** Key membership on `(org_id, authenticated user_id)`; never dedupe by email. `ON CONFLICT (org_id, user_id)` is the only convergence key.
**Warning signs:** duplicate-email test produces one shared membership instead of two independent memberships.

### Pitfall 4: routing/JIT on an unapproved (or hijacked) domain
**What goes wrong:** A registered-but-unverified domain immediately intercepts logins.
**Why:** Supabase doesn't verify domain ownership.
**How to avoid:** Only `status='active'` configs route/provision; block public domains at create; operator approval flips to active (D-168-05).
**Warning signs:** a `pending_approval` domain routes a login.

### Pitfall 5: management token reaching the browser / logs
**What goes wrong:** The `sbp_`/`service_role` token leaks via a client call or a log line.
**Why:** Naive proxy or verbose logging.
**How to avoid:** All CRUD backend-only; decrypt the token only at call time; log column NAMES/counts only (secret_cipher discipline).
**Warning signs:** any token substring in a response body or log.

### Pitfall 6: deleting `sso_configs` without deleting the GoTrue provider
**What goes wrong:** Orphaned GoTrue provider keeps routing a domain after the org "removed" SSO.
**Why:** No FK/cascade between our table and the `auth` schema (D-07).
**How to avoid:** Delete via the CRUD API first, then the row; treat the API call as the source of truth.

## Code Examples

### Identifier-first login (frontend)
```ts
// Source: supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml + this repo's useAuth.ts
async function onEmailSubmit(email: string) {
  const domain = email.split("@")[1]?.toLowerCase()
  const { sso } = await api.get(`/org/sso/route?domain=${encodeURIComponent(domain)}`)
  if (sso) {
    const { data, error } = await supabase.auth.signInWithSSO({ domain })
    if (error) throw error
    if (data?.url) window.location.href = data.url   // MUST redirect manually
  } else {
    revealPasswordField()                            // RETAINED fallback (D-168-02)
  }
}
```

### Create provider (backend, cloud adapter)
```python
# Source: supabase.com/docs/reference/api/v1-create-a-sso-provider (body) + repo httpx usage
resp = await client.post(
    f"https://api.supabase.com/v1/projects/{ref}/config/auth/sso/providers",
    headers={"Authorization": f"Bearer {sbp_token}"},
    json={"type": "saml", "metadata_url": metadata_url,
          "domains": [domain],
          "attribute_mapping": {"keys": {
              "first_name": {"name": "givenName"},
              "last_name":  {"name": "sn"}}},   # email auto-detected; NO role/group (D-168-03)
          "name_id_format": "emailAddress"},
)
if resp.status_code >= 400:
    raise HTTPException(422, "Could not create SSO connection")   # fail closed, don't write sso_configs
provider_id = resp.json()["id"]     # → sso_configs.provider_id
```

### Self-hosted private key generation (operator setup)
```sh
# Source: supabase.com/docs/guides/self-hosting/self-hosted-saml-sso
openssl genpkey -algorithm RSA -out pk_pkcs8.pem -quiet && \
openssl pkey -in pk_pkcs8.pem -out pk_rsa1.der -outform DER -traditional && \
base64 -w 0 -i pk_rsa1.der          # → GOTRUE_SAML_PRIVATE_KEY (single line, no breaks)
# plus: GOTRUE_SAML_ENABLED=true
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| App owns a SAML SP (`python3-saml` + `xmlsec1`) | Supabase Auth IS the SP; app registers connections via API | v3.4 research (2026-07-18) corrected the stale 2026-05-10 PRD | 0 new deps; no `xmlsec1` CVE surface |
| CLI-only `supabase sso add` per tenant | Self-service backend proxy over the CRUD API | This phase (D-168-01) | Scales to many orgs; no operator bottleneck |
| Password-only login | Identifier-first (SSO-or-password) | This phase (D-168-02) | Enterprise onboarding; password RETAINED |

**Deprecated/outdated:**
- `python3-saml`/`xmlsec1` in the stale PRD — dropped entirely.
- The SUMMARY's "provision via `supabase sso add` CLI" framing (line 161) — superseded by D-168-01's backend-proxy self-service (CLI remains a fallback/dev tool only).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The callback returns a `?code=` (PKCE) that `detectSessionInUrl`/`exchangeCodeForSession` completes; `onAuthStateChange` fires `SIGNED_IN` | signInWithSSO/Callback | If the client uses implicit flow (hash tokens), the callback wiring differs — verify on the live round-trip; low blast radius (both are supported by supabase-js) |
| A2 | `auth.identities.provider` for SSO = `'sso:<provider_uuid>'` and JWT `amr[0].provider` carries the provider UUID | JIT resolution key | If the exact string differs, the provider→org resolver needs a different parse — verify on the live round-trip before locking; mitigated by also having `email` domain as a fallback resolver |
| A3 | Management-API 4xx error JSON shape for invalid-metadata / duplicate-domain / plan-gating | Provider-CRUD error semantics | Only affects the *message* shown to the admin; the fail-closed behavior (don't write `sso_configs` on non-2xx) is robust regardless |
| A4 | Cloud project (`superrag.cloud`) is on Pro+ (SAML available) | D-168-06 test path | If not Pro, the cheapest live path shifts to a standalone self-hosted GoTrue — operator confirms at execution (D-168-06 says don't block on infra) |
| A5 | `mocksaml.com` returns `email`/`firstName`/`lastName` and accepts any email at its login form | Test IdP | Only affects attribute-mapping test values; a different attribute name is a one-line map change |
| A6 | GoTrue enforces email-domain uniqueness across providers within a project | Domain hijack mitigation | If it doesn't, our lowercased-`email_domain` unique index + `status` gate still enforces it app-side |

**These A-items are exactly what the ONE live round-trip must confirm** — they are the reason D-168-06 requires a live test rather than docs-only.

## Open Questions

1. **Where does the Cloud `sbp_` management token live — Phase-150 encrypted `app_settings` column, or an env var?**
   - What we know: D-168-01 says "Phase-150 encrypted secrets store, never env sprawl." CLAUDE.md says "env vars are for secrets and infra only." The token is ONE deployment-level secret. `secret_cipher.SECRET_COLUMNS` is a *fixed 12-column allowlist* — using it means adding an `app_settings` column + extending the allowlist.
   - What's unclear: whether the operator wants to rotate the token via the Control Room UI (→ encrypted column) or set it once at deploy (→ env var, CLAUDE.md-consistent, simpler, but contradicts "never env sprawl").
   - Recommendation: honor D-168-01 — add `supabase_management_token` to `app_settings` + `SECRET_COLUMNS`, operator-editable in the Control Room (one secret, rotatable, encrypted at rest). Confirm with the operator at plan/discuss time; the env-var path is the low-effort fallback.

2. **Should `/org/sso/provision` be an explicit frontend-called endpoint, or folded into the `/org/me` bootstrap?**
   - What we know: `/org/me` returns empty memberships until JIT runs, so provisioning must precede org resolution.
   - Recommendation: an explicit idempotent `POST /org/sso/provision` called on `SIGNED_IN` for SSO sessions (mirrors the 167 `/invite` accept landing), then re-probe `/org/me`. Folding into `/org/me` GET would make a read perform a write (surprising, harder to reason about).

3. **Exact `name_id_format` to request** — `emailAddress` vs `persistent`. `emailAddress` gives a human-readable, email-keyed NameID that most IdPs support and aligns with email-auto-detection. Recommend `emailAddress`; confirm the target IdPs (Okta/Azure/Google) accept it during the live test.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@supabase/supabase-js` (`signInWithSSO`) | Login routing | ✓ | already a project dep | — |
| Supabase local CLI stack | Non-SAML dev/UAT | ✓ | in use | — (SAML NOT supported locally) |
| Local SAML capability | Live SAML round-trip | ✗ | — | Cloud staging (Pro+) OR standalone self-hosted GoTrue |
| Cloud Supabase project (Pro+) | Cloud live round-trip | ? (assume yes, `superrag.cloud`) | — | standalone self-hosted GoTrue + mocksaml.com |
| `mocksaml.com` (hosted mock IdP) | Live round-trip IdP | ✓ (hosted, free) | hosted | `boxyhq/mock-saml` Docker |
| `service_role` key (self-hosted CRUD) | Self-hosted adapter | ✓ | `config.py:746` | — |
| Cloud `sbp_` management token | Cloud adapter | ✗ (NEW secret) | — | operator provisions at execution |

**Missing dependencies with no fallback:** none block *planning*. Live SAML needs a Pro cloud project OR a self-hosted GoTrue — operator confirms at execution (D-168-06 explicitly says don't block the phase on local infra).

**Missing dependencies with fallback:** local SAML → cloud staging or standalone GoTrue; Cloud `sbp_` token → operator provisions.

### D-168-06 resolution — cheapest LIVE end-to-end path

**Confirmed constraint:** the local Supabase CLI stack cannot run SAML (Kong doesn't route `/sso`; supabase/cli#1335). So the two candidates are cloud staging vs standalone self-hosted GoTrue.

| Option | Setup cost | What it proves | Verdict |
|--------|-----------|----------------|---------|
| **(b) Cloud staging on Pro+** (recommended) | Point a provider (via Management API + `sbp_` token) at `mocksaml.com`; log in once. Marginal cost ~$0 if `superrag.cloud` is already Pro (50 SSO MAU quota covers 1 test user). | The EXACT production **cloud adapter** (Management API + `sbp_` + real GoTrue ACS) end-to-end. | **Recommended** — least engineering effort, tests the default tier most users get. |
| (a) Standalone self-hosted GoTrue | Stand up the self-hosting docker-compose (or a GoTrue container), set `GOTRUE_SAML_ENABLED=true` + `GOTRUE_SAML_PRIVATE_KEY` (openssl above), **reconfigure Kong to expose `/sso` endpoints**, point at `mocksaml.com`. | The **self-hosted adapter** end-to-end. More setup (Kong reconfig); a separate Postgres complicates the JIT-into-our-DB assertion. | Fallback / do opportunistically if validating the self-hosted tier specifically. |

**Recommended acceptance bar:**
- **Automated (mock):** provider-CRUD call (mock the HTTP client, assert body + adapter selection + `provider_id` write-back), domain-routing decision (`/org/sso/route` returns sso/no-sso), and the domain-gated JIT insert (real DB, mocked SSO session — the exact `test_167`/`test_v3_4_org_isolation` fixture style). These run every commit.
- **Live (one round-trip):** on cloud staging with `mocksaml.com` — create connection → `signInWithSSO` → assertion consumed → session minted → JIT inserts exactly one `member` row → password fallback still works. Confirms A1/A2/A3/A4/A6. Operator confirms the environment at execution.

Setup steps for the recommended (cloud) path:
1. Ensure the cloud project is Pro+ (SAML gated on plan). Generate a Management/Personal Access Token (`sbp_…`) in the Supabase dashboard; store per Q3.
2. Create a mocksaml namespace: `https://mocksaml.com/namespace/superrag-test`; its metadata URL is `https://mocksaml.com/api/namespace/superrag-test/saml/metadata` (or the default `https://mocksaml.com/api/saml/metadata`). [VERIFIED: mocksaml.com]
3. In the SSO tab, paste that metadata URL + a test domain (a domain NOT on the public blocklist), submit → backend calls the Management API → provider created → `sso_configs` row (`pending_approval`).
4. Operator approves → `status='active'`.
5. Give `mocksaml.com` the SP metadata (`{SUPABASE_URL}/auth/v1/sso/saml/metadata`, ACS `/auth/v1/sso/saml/acs`) — for mocksaml this is auto/permissive.
6. Log in with an email on the test domain → redirected to mocksaml → any-email login → back to app → JIT creates one `member` membership. Then log in with a password account to confirm the fallback.

## Validation Architecture

> `workflow.nyquist_validation` is `true` (`.planning/config.json`) — this section is REQUIRED and feeds VALIDATION.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework (backend) | `pytest` + `pytest-asyncio` (see `backend/tests/integration/test_v3_4_org_isolation.py`, `test_163_rls_*.py`, `test_167*`) |
| Framework (frontend) | `vitest` + Testing Library (`*.test.tsx`, e.g. `OrgAdminShell.test.tsx`, `OrgProvider.test.tsx`) |
| Config file | backend: `backend/pytest.ini`/`pyproject.toml`; frontend: `frontend/vitest.config.*` |
| Quick run command | backend: `cd backend && ./venv/Scripts/python -m pytest tests/ -k sso -x -q`; frontend: `cd frontend && npx vitest run src/components/org` |
| Full suite command | backend: `cd backend && ./venv/Scripts/python -m pytest tests/ -q`; frontend: `cd frontend && npx vitest run` |

### Phase Requirements → Test Map (the 4 success criteria)
| Req / SC | Behavior | Observable signal | Test Type | Automated Command | File Exists? |
|----------|----------|-------------------|-----------|-------------------|-------------|
| SSO-01 / SC1 | Provider registered → live | backend calls provider-CRUD with correct body/adapter; `sso_configs.provider_id` == returned `id`; non-2xx → no row written | unit (mock HTTP) | `pytest tests/unit/test_168_sso_provider_service.py -x` | ❌ Wave 0 |
| SSO-01 / SC1 | org-admin CAN manage SSO after grant; member/other-org cannot | 200 for org-admin; 403 for member; cross-org 403 | integration | `pytest tests/integration/test_168_sso_authz.py -x` | ❌ Wave 0 |
| SSO-01 / SC1 | Domain routing correct | `/org/sso/route` → sso for an active-config domain; no-sso otherwise; `pending_approval`/`disabled` → no-sso; public-domain rejected at create | unit + integration | `pytest tests/integration/test_168_sso_routing.py -x` | ❌ Wave 0 |
| SSO-01 / SC2 | JIT creates EXACTLY ONE membership, idempotent, role=member | one `org_members` row after N concurrent provisions; second call `joined=False`; role always `member`; duplicate-email → two independent memberships (two UUIDs) | integration (real DB, mocked SSO identity) | `pytest tests/integration/test_168_sso_jit.py -x` | ❌ Wave 0 |
| SSO-01 / SC3 | Password fallback RETAINED | `signInWithPassword` path unchanged; identifier-first reveals password on no-match | frontend unit | `npx vitest run src/components/auth` | ❌ Wave 0 |
| SSO-01 / SC1-3 | ONE live SAML round-trip (mocksaml.com, cloud staging) | provider created → SSO login → session minted → one member row → password login still works | manual-only (UAT) | operator-driven; NOT automatable locally (Pitfall 2) | n/a |

### Sampling Rate
- **Per task commit:** `pytest tests/ -k sso -x -q` (mocked provider-CRUD + routing + JIT — sub-30s).
- **Per wave merge:** full backend `pytest tests/ -q` + frontend `vitest run` (guards against RLS/authz regressions in the shared `org.py`/`OrgProvider` surface).
- **Phase gate:** full suite green **plus** the ONE live mocksaml round-trip on cloud staging before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `tests/unit/test_168_sso_provider_service.py` — adapter selection + body shape + `provider_id` write-back + fail-closed on 4xx (covers SC1)
- [ ] `tests/integration/test_168_sso_authz.py` — `sso:manage` grant enforced; member/cross-org denied (covers SC1)
- [ ] `tests/integration/test_168_sso_routing.py` — domain routing + `status` gate + public-domain blocklist (covers SC1)
- [ ] `tests/integration/test_168_sso_jit.py` — idempotent single-membership, concurrent converge, duplicate-email two-UUID, role=member (covers SC2) — model on `test_167` accept tests
- [ ] `frontend/src/components/auth/*.test.tsx` — identifier-first routing + password-reveal fallback (covers SC3)
- [ ] Shared fixture: a seeded org + an active `sso_configs` + a mocked SSO identity (extend the `test_v3_4_org_isolation` two-org fixtures)

*Framework already present — no install needed.*

## Security Domain

> `security_enforcement` is not set in config → treated as **enabled**. SSO is a high-value auth surface; this section is required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase/GoTrue SAML SP + retained password fallback; SSO≠password no-auto-link handled by design |
| V3 Session Management | yes | GoTrue-issued session/JWT; PKCE callback; no SLO (session timeboxing) |
| V4 Access Control | yes | `sso:manage` RLS + `require_sso_manage`; JIT role hardcoded `member`; org-scoped `sso_configs` (mig 104 policies) |
| V5 Input Validation | yes | metadata-URL + domain normalization; public-domain blocklist; `name_id_format` enum; email shape check (reuse `org.py:_EMAIL_RE`) |
| V6 Cryptography | yes | management token via Phase-150 MultiFernet (never hand-rolled); self-hosted private key = operator-generated RSA-2048+ |
| V10 Malicious Code / SSRF | yes | GoTrue fetches the IdP metadata URL server-side — SSRF risk lives in GoTrue, not us; we do NOT fetch remote blocklists at runtime |

### Known Threat Patterns for {Supabase SAML SSO + FastAPI proxy + Postgres RLS}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Domain hijack (register unowned/public domain) | Spoofing/Elevation | `status='active'` gate + operator approval + public-domain blocklist + domain uniqueness (D-168-05) |
| Attribute→role privilege escalation | Elevation | JIT role hardcoded `member`; no role/group attribute mapped (D-168-03) |
| Management-token disclosure | Info Disclosure | backend-only CRUD; Phase-150 encryption; log-by-name-only |
| JIT race → duplicate/rogue membership | Tampering | advisory lock + `ON CONFLICT DO NOTHING` (167 pattern); org resolved from authenticated `provider_id`, never a client claim |
| Cross-org `sso_configs` read/write | Info Disclosure/Tampering | mig-104 RLS (`current_user_org_ids()` + `sso:manage`); `require_sso_manage` server gate |
| SSO-enforcement lockout | Denial of Service | password fallback RETAINED; enforcement deferred |
| SAML XSW / assertion tampering | Tampering | **owned by GoTrue**, not us — do NOT re-implement (SUMMARY line 217) |

## Sources

### Primary (HIGH confidence)
- Supabase Docs — SAML 2.0 SSO for Projects: https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml (signInWithSSO, attribute_mapping, SP metadata, no-auto-link, Pro+ gating) — fetched 2026-07-22
- Supabase Docs — Self-hosted SAML SSO: https://supabase.com/docs/guides/self-hosting/self-hosted-saml-sso (GoTrue Admin API paths, both auth headers, env vars, key gen, request/response body) — fetched 2026-07-22
- Supabase Management API Reference — Create/Update/Get/Delete a SSO provider: https://supabase.com/docs/reference/api/v1-create-a-sso-provider , v1-update-a-sso-provider, v1-get-a-sso-provider (request params `type`/`metadata_url`/`metadata_xml`/`domains`/`attribute_mapping`/`name_id_format`; response `domains[]` objects) — search-confirmed 2026-07-22
- supabase/cli#1335 — SSO/SAML NOT supported on local CLI stack (Kong doesn't route `/sso`): https://github.com/supabase/cli/issues/1335
- In-repo: `supabase/migrations/104_org_dept_role_schema.sql` (sso_configs, sso:manage seed gap, RLS), `backend/app/services/invitation_service.py` (JIT skeleton), `backend/app/api/org.py` (accept pattern, require_* gates), `backend/app/dependencies.py` (require_org_manage template), `backend/app/security/secret_cipher.py` (SECRET_COLUMNS allowlist), `frontend/src/{hooks/useAuth.ts,components/auth/SignInForm.tsx,components/org/OrgAdminShell.tsx,providers/OrgProvider.tsx,lib/supabase.ts}`, `.planning/research/SUMMARY.md`

### Secondary (MEDIUM confidence)
- Mock SAML (BoxyHQ) hosted IdP + Docker: https://mocksaml.com/ , https://github.com/ory/mocksaml , https://hub.docker.com/u/boxyhq
- disposable-email-domains list (public/free-provider hygiene reference): https://github.com/disposable-email-domains/disposable-email-domains
- Supabase SSO setup guides (SP-metadata values, flow): https://supabase.com/docs/guides/platform/sso/azure , /gsuite

### Tertiary (LOW confidence — flagged for the live round-trip)
- Exact JWT `amr`/`auth.identities.provider` string shape (A2), callback param code-vs-hash (A1), Management-API 4xx JSON (A3) — asserted from repo notes + general supabase-js behavior; MUST be confirmed on the one live test.

## Metadata

**Confidence breakdown:**
- Provider-CRUD contract (paths/bodies/headers): HIGH — dual-doc verified (auth-sso-saml + self-hosted + Management API reference), same GoTrue handler both surfaces.
- Architecture / JIT seam: HIGH — reuses proven in-repo Phase-167 pattern; provider-ID keying is a straightforward refinement.
- `sso:manage` grant gap + migration 113: HIGH — read directly from mig 104:414-425.
- Local-SAML impossibility (D-168-06): HIGH — supabase/cli#1335 + docs.
- JWT `amr`/callback/error-JSON specifics: MEDIUM — flagged A1-A3 for the live round-trip (exactly what D-168-06's one live test exists to confirm).
- mocksaml attribute names: MEDIUM — A5.

**Research date:** 2026-07-22
**Valid until:** ~2026-08-21 (30 days — Supabase SSO API is stable; re-verify the Management-API error shapes if planning slips materially)

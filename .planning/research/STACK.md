# Stack Research — v3.4 Multi-Tenancy & Org Access

**Domain:** Org-level multi-tenancy + SSO retrofit onto an existing single-tenant per-user RAG platform (React/Vite + FastAPI + Supabase + Redis)
**Researched:** 2026-07-18
**Confidence:** HIGH (versions + Supabase SAML tier + self-hosted GoTrue + asyncpg RLS pattern verified against official docs; MEDIUM on the per-org-OIDC gap and the exact `set_config` `is_local` flag — both flagged for live verification)

> Scope: ONLY the NEW stack for v3.4 multi-tenancy + SSO. The existing stack (React/Vite, FastAPI, Supabase Postgres+pgvector+Storage+Auth, Redis Streams, raw LLM SDKs, `WORKER_COUNT=2` uvicorn, app-layer Fernet secrets) is unchanged and NOT re-researched. **The headline: the biggest change is a *pattern* (per-request user-JWT DB context), not a pile of new libraries.** The stale v3.4 brief's marquee dependency (`python3-saml`) is explicitly dropped.

---

## Headline finding: v3.4 SSO adds ~zero hard runtime deps

| The stale brief (`PRDs/v3.3-multi-tenancy.md` §5) assumed… | Reality verified 2026-07-18 | Impact |
|---|---|---|
| Add `python3-saml>=1.16` as our SAML SP | **Supabase Auth IS the SAML SP** — native SAML 2.0 (Cloud Pro+ / self-hosted GoTrue), incl. attribute→claim mapping | **Drop `python3-saml` entirely** — avoids the `xmlsec1` system dep + its CVE surface on every Docker/Coolify build |
| Add `authlib>=1.3` for OIDC | Per-org OIDC is **not** a native Supabase feature; needed **only if** per-org OIDC ships in v1 | Add **Authlib 1.7.2** *scope-gated*; else defer |
| Per-request user-JWT client is a new mechanism | The **asyncpg pool already exists** (`get_pg_pool`); RLS context = `SET LOCAL request.jwt.claims` + `SET LOCAL ROLE authenticated` | **No new pool, no new dep** — one per-request transaction wrapper |
| JWT decode needs a new lib | **PyJWT is already transitive** via `gotrue` (`pyjwt>=2.10.1`); Supabase asymmetric **ES256 + JWKS** is GA | Local token verify + claims extraction = **0 new installs** (pin PyJWT explicit) |
| Email provider TBD | `resend` 2.34.0 (async via our httpx) / SES / `none` | One optional dep behind an env switch |

**Net new hard deps: 0–2** (`resend` optional; `authlib` only if OIDC in v1). Everything else is pattern + config.

---

## Answers to the 6 questions (executive)

1. **Supabase SAML SSO:** native, **SAML 2.0 only** for per-org enterprise SSO, gated to **Pro ($25/mo) and above** on Cloud (50 SSO MAUs included on Pro & Team, then $0.015/MAU; Team $599 bundles SOC2/SAML/HIPAA). **Self-hosted GoTrue does SAML SSO with no tier gate** (`GOTRUE_SAML_ENABLED=true` + a signing key) — this carries isolation-via-deployment enterprise. **Per-org OIDC is NOT native** — the one place Authlib may be needed. JIT: Supabase auto-creates `auth.users` on SSO login; **our backend owns the `org_members` insert.**
2. **Python SAML/OIDC libs:** **Drop `python3-saml`** (Supabase is the SP). Add **Authlib 1.7.2** *only if* per-org OIDC lands in v1. Minimal SSO set = **zero new hard deps**.
3. **Per-request user-JWT DB client:** reuse the existing **asyncpg** pool with `SET LOCAL request.jwt.claims` + `SET LOCAL ROLE authenticated` in a per-request transaction — native-async (no `run_in_threadpool`), RLS-enforced, one seam in `dependencies.py`. supabase-py per-request client is the fallback (sync → threadpool + extra PostgREST hop).
4. **Org switcher:** **hybrid** — bake the *membership set* into the JWT via a custom-access-token hook (cheap RLS, no per-request join) + carry the *active org* as a server-validated **`X-Org-Id` header** (instant switch, no token refresh).
5. **Invitation email:** env-driven adapter — **`resend` 2.34.0** default on cloud, **`none`/log-only** default for local dev, **AWS SES (`boto3`)** only for enterprise-on-AWS. Don't add boto3 unless SES is chosen.
6. **SCIM:** correctly **DEFERRED** — SAML + OIDC JIT covers enterprise onboarding for v1; Supabase provides no SCIM server, so it's a full app-layer build not worth it until a customer requires automated offboarding.

---

## Recommended Stack

### Core Technologies (additions / pattern changes)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Supabase Auth native SAML 2.0** | Platform feature (Cloud **Pro+** / self-hosted GoTrue) | Enterprise SSO service-provider — Supabase *is* the SAML SP | We do NOT hand-roll a SAML SP. Multi-tenant per-org connections are configured via the **Supabase CLI** (`supabase sso add/update/list`); each gets a unique `sso_provider_id` exposed in the JWT (`auth.jwt()#>>'{amr,0,provider}'`). Attribute→claim mapping is built-in (`--attribute-mapping-file`), landing mapped attrs in the access token + `auth.identities.identity_data`. Eliminates the `python3-saml`/`xmlsec1` dependency the stale brief assumed. |
| **asyncpg** (per-request user-JWT RLS context) | **already present** `>=0.29` | Run hot-path queries under the user's identity so membership-RLS enforces | The seam that replaces the service-role bypass. Pool already exists (`backend/app/dependencies.py::get_pg_pool`, min 2/max 10, JSONB codec, `command_timeout=30`). Add a `SET LOCAL request.jwt.claims` + `SET LOCAL ROLE authenticated` per-request transaction wrapper — native async, no `run_in_threadpool`, no new dependency, no new pool. |
| **PyJWT** | **2.13.0** (already transitive via `gotrue` `pyjwt>=2.10.1`) | Verify the Supabase JWT locally + extract claims to build `request.jwt.claims` | Supabase **asymmetric JWT signing keys (ES256 + JWKS)** are GA (`/auth/v1/.well-known/jwks.json`). Verify locally (fetch JWKS on startup via `PyJWKClient`, cache, `kid` lookup) → drops the per-request `supabase.auth.get_user()` GoTrue round-trip in `get_current_user`, AND yields the claims dict we must feed to `set_config`. Already installed transitively — **promote to an explicit pin**, don't add a new package. |
| **Authlib** *(scope-gated)* | **1.7.2** (Python ≥3.10; pulls `cryptography`, already a dep) | Per-org **OIDC** client — the one thing Supabase per-org SSO does NOT cover | Pure-Python OAuth2/OIDC client (`authlib.integrations.httpx_client`), no system deps, reuses our existing `httpx`. Add **only if** per-org OIDC connections are v1 scope. If v1 is SAML-only (recommended), **defer Authlib** to the OIDC slice. |
| **resend** *(cloud default)* | **2.34.0** (Python ≥3.7) | Transactional invitation email | Modern DX, `resend.Emails.send()` + `send_async()` (async via our `httpx`), single `RESEND_API_KEY`. Behind an env-driven provider switch so local dev needs no key. |

### Supporting Libraries / Platform Features

| Library / Feature | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Supabase custom-access-token hook** | Platform feature (Cloud + self-hosted; GA) | Inject the user's **org membership set** into JWT `app_metadata` so RLS reads `auth.jwt()` with no per-request join | Postgres function; self-hosted enables via `GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED=true` + `GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI="pg-functions://postgres/public/custom_access_token_hook"`. Bake the *set* of orgs, NOT the active org (active org is session state → header). |
| **boto3 (AWS SES)** | 1.43.51 | Invitation email for enterprise-on-AWS / high volume | ONLY when `INVITATION_EMAIL_PROVIDER=ses`. Sync API → wrap in `run_in_threadpool` (D-v2.5-01). Do not add to `requirements.txt` unless SES is actually selected. |
| **Supabase self-hosted SAML** | GoTrue env config | SAML SSO for dedicated/on-prem enterprise (isolation-via-deployment) | `GOTRUE_SAML_ENABLED=true` + `GOTRUE_SAML_PRIVATE_KEY` (Base64 PKCS#1 DER RSA, 2048-bit min); per-IdP config via the Auth admin API (no restart). Same client `signInWithSSO()` as Cloud — one app codepath serves both postures. |

### Development Tools / System Dependencies

| Tool | Purpose | Notes |
|------|---------|-------|
| **Supabase CLI** | Provision per-org SAML connections + attribute mapping | `supabase sso add --project-ref … --type saml --metadata-url … --domains … --attribute-mapping-file map.json`. The dashboard exposes only ONE SAML field; **multi-tenant requires the CLI** — bake into the org-admin SSO provisioning flow or an operator runbook. |
| **`xmlsec1` / `libxmlsec1-dev`** | ❌ **AVOIDED** | Would be required by `python3-saml`. Using Supabase native SAML skips this system dep + its build-toolchain + CVE-tracking burden on every Coolify/Docker build. Explicit non-goal. |

---

## Installation

```bash
# --- Backend (add to requirements.txt) ---
# Promote the already-transitive JWT lib to an explicit pin (local JWKS verification):
pyjwt>=2.10.1              # already pulled by gotrue; pin explicit for local ES256 verify

# Invitation email (default cloud provider) — optional, provider-switched:
resend>=2.34.0

# Per-org OIDC — ADD ONLY IF OIDC is in v1 scope (else defer to the OIDC slice):
# authlib>=1.7.2

# AWS SES — ADD ONLY IF INVITATION_EMAIL_PROVIDER=ses is chosen:
# boto3>=1.43.0

# --- NO new SAML dependency ---  (Supabase Auth is the SAML SP; python3-saml NOT added)
# --- NO new frontend dependency --- (supabase-js already ships signInWithSSO;
#     org-switcher = existing shadcn/ui <Select>; org-admin shell = existing v3.3 shell pattern)
```

**New env vars to declare** (in `backend/.env.example` + the Phase-157 deploy artifacts — same-commit rule, `scripts/check-deploy-drift.sh`):

```bash
# SSO (SAML handled by Supabase; these support our JIT + local JWT verify)
SUPABASE_JWKS_URL=          # default: <SUPABASE_URL>/auth/v1/.well-known/jwks.json
SUPABASE_JWT_ISSUER=        # <SUPABASE_URL>/auth/v1 — for local ES256 verification
OIDC_DISCOVERY_TIMEOUT_SECONDS=10   # only if per-org OIDC ships (per-org IdP config lives in sso_configs, not env)

# Invitation email
INVITATION_EMAIL_PROVIDER=none      # none | resend | ses   (none = log link to backend log)
INVITATION_EMAIL_FROM=              # From: address
RESEND_API_KEY=                     # only when provider=resend
INVITATION_TOKEN_TTL_HOURS=168      # 7 days
# AWS_* creds only when provider=ses (prefer an instance role over static keys)
```

> Deployment-artifact parity: every var above must also land in `deploy/onebox.env.example`, `docs/OPERATOR.md` Step-3, and `docker-compose.prod.yml` in the SAME commit, or `scripts/check-deploy-drift.sh` fails CI (Phase 158 / D-16).

---

## The load-bearing change: per-request user-JWT DB context (Q3, detailed)

Today `get_supabase()` returns a **service-role singleton** (`dependencies.py:21-25`) — RLS is effectively bypassed and the real boundary is per-callsite `.eq("user_id", …)` filters. Membership-RLS is decorative unless queries run under the user's identity. Two ways:

### Recommended: asyncpg `SET LOCAL` (native-async, RLS-enforced)

The pool already exists (`get_pg_pool`). Add ONE per-request helper beside it:

```python
# Pattern (verify exact set_config flags with a live two-user leak test — see traps)
async with (await get_pg_pool()).acquire() as conn:
    async with conn.transaction():                       # REQUIRED — scopes the SETs
        await conn.execute(
            "SELECT set_config('request.jwt.claims', $1, true)",  # is_local=true → resets at COMMIT
            claims_json,                                  # {"sub": uid, "role": "authenticated", "active_org_id": …}
        )
        await conn.execute("SET LOCAL ROLE authenticated")  # ⚠️ MANDATORY — see trap #1
        rows = await conn.fetch("SELECT … FROM documents WHERE …")  # RLS now enforces
    # transaction ends → SET LOCAL auto-resets → connection safe to return to pool
```

Why this over supabase-py: **native async** (no `run_in_threadpool`, honors D-v2.5-01 for free), **no extra PostgREST/HTTP hop** (direct SQL), and it reuses the JSONB-codec pool. `claims_json` is built from the **locally-verified** JWT (PyJWT + JWKS) so there's no GoTrue round-trip.

**Two traps to verify — this is where multi-tenancy leaks are born:**

1. **`SET LOCAL ROLE authenticated` is mandatory.** The pool connects via `POSTGRES_DSN`, almost certainly as `postgres`/service-role — which **owns the tables / has BYPASSRLS, so RLS does NOT apply no matter what claims you set.** Switching to the non-privileged `authenticated` role is the actual thing that turns RLS on. This is the real meaning of "RLS bypassed" in the community threads — it's the *role*, not the claims.
2. **Reset discipline on a pooled connection.** `is_local=true` inside an explicit transaction auto-resets at COMMIT (exactly how PostgREST does it). A *missing* claim fails **closed** (`auth.uid()` → NULL → zero rows), not open — but a *stale* claim from a prior borrower on a session-level (`is_local=false`) SET would **leak across users**. Keep everything transaction-scoped; never use `is_local=false` without an explicit `RESET`/`DISCARD ALL` before release.

> Confidence note: the transaction-wrapped `is_local=true` + `SET LOCAL ROLE` shape matches PostgREST's reference behavior and the Supabase "direct connection" discussion. One source paraphrased "`set_config` third arg must be `false`" — I judge that lossy (it conflates the role-bypass issue with the flag). **The phase MUST ship a live two-user RLS test** (user A cannot read user B's rows; A→B connection reuse doesn't leak) as the acceptance gate — do not take the flag on faith.

### Fallback: supabase-py per-request client

`create_client(url, ANON_KEY, options=ClientOptions(headers={"Authorization": f"Bearer {jwt}"}))` per request, or `client.postgrest.auth(jwt)`. Downsides for hot paths: supabase-py is **synchronous** → every call needs `run_in_threadpool`; routes through PostgREST (extra network hop); per-request client construction adds overhead. **Keep supabase-py's service-role singleton ONLY for explicit cross-tenant ops** (JIT `org_members` insert during SSO callback, operator/audit writes) behind a hardened wrapper that demands an explicit `org_id`.

### Connection-pool math under `WORKER_COUNT=2`
Pool is min 2 / max 10 **per worker** → effective ceiling ~20 connections (the existing `dependencies.py` comment already sizes for this). The `SET LOCAL` pattern acquires → transaction → set → query → release; it adds **one transaction per request** but **no new connections and no new pool**. Watch: long-lived SSE streaming requests must NOT hold a pooled connection for the whole stream lifetime — acquire per DB operation, not per request, on `runs.py`/`threads.py send_message`. Re-run CONCUR-01 (`test_058_concurrency.py`) on the rewrite branch.

---

## Org switcher / active-org context (Q4)

| Option | Mechanism | Pros | Cons |
|--------|-----------|------|------|
| **A. JWT custom claim** | Custom-access-token hook writes active org into JWT | RLS reads `auth.jwt()` directly, zero per-request join | JWT is minted at login/refresh → **switching active org needs a token refresh** (laggy UX); hook runs on every issuance |
| **B. `X-Org-Id` header** | Client sends header; backend validates vs `org_members` | **Instant switch, no refresh**; active org is honest per-request state | One membership check per request (cheap w/ `org_members(user_id, org_id)` index); MUST be validated server-side + injected into `request.jwt.claims` |
| **✅ Hybrid (recommended)** | Hook bakes the **membership SET** (`app_metadata.org_ids`) into the JWT for cheap RLS; **`X-Org-Id` header** carries the **active org**, validated against that set, then injected as `active_org_id` into the per-request `set_config` claims | Cheap RLS (`org_id = ANY(app_metadata.org_ids)`) **and** instant switch | Slightly more moving parts; the header→claims injection is the same seam as the RLS pattern above, so near-zero extra cost |

The hybrid maps onto the stale brief's "active org in localStorage + JWT custom claim + `X-Org-Id` validated against `org_members`" — it just sharpens *which* half goes where: **membership → JWT (durable), active org → header (session).**

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Supabase native SAML (SP) | `python3-saml` 1.16.0 as our own SP | Only if we abandon Supabase Auth for SSO entirely (we don't). Brings `xmlsec1` system dep + CVE tracking — not worth it. |
| asyncpg `SET LOCAL` RLS context | supabase-py per-request client (`postgrest.auth`) | Endpoints already on supabase-py where an asyncpg rewrite is too costly this milestone — acceptable as a bridge, but wrap in `run_in_threadpool`. |
| Local JWKS verify (PyJWT, ES256) | Keep `supabase.auth.get_user()` per request | Fine short-term; but it's a network hop per request and doesn't hand you the claims dict for `set_config`. Prefer local verify once asymmetric keys are enabled. |
| resend | AWS SES (`boto3`) | Enterprise already on AWS, high volume, or wanting deliverability under their own domain/IAM. |
| resend | Supabase Auth built-in email (`inviteUserByEmail`) | Supabase's built-in invite covers *auth* invites but NOT our org-membership semantics (role, dept, token). Use our own `org_invitations` + a transactional provider. |
| Hybrid (JWT set + header active) | Pure JWT-claim active org | Single-org-per-user installs where users never switch — then the header is unnecessary. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **`python3-saml` / `python-saml`** | The stale brief's headline dep. Drags in `xmlsec1`/`libxmlsec1-dev` system libs + a build toolchain on every Docker/Coolify build, plus an ongoing CVE surface (historic SAML signature-wrapping / XXE classes). Redundant — **Supabase Auth is already the SAML SP**, incl. attribute mapping. | Supabase native SAML + read the mapped claims from the verified JWT to do the `org_members` JIT insert. |
| **A brand-new Postgres pool / pgbouncer layer for tenancy** | The asyncpg pool already exists and is `WORKER_COUNT=2`-sized. A parallel pool multiplies connection pressure and splits the codec/config story. | Reuse `get_pg_pool`; add a per-request `SET LOCAL` wrapper only. |
| **Baking *active org* into the JWT** | Forces a token refresh on every org switch → sluggish UX + hook cost. | Membership SET in JWT (durable) + active org via validated header (session). |
| **Service-role client on hot read/write paths** | It's the current RLS-bypass; leaving it means membership-RLS is decorative and `.eq("user_id")` filters remain the sole boundary. | Per-request user-JWT context (asyncpg `SET LOCAL`); service-role retained ONLY for cross-tenant ops behind an explicit-`org_id` wrapper. |
| **SCIM libs / building a SCIM 2.0 server now** | Supabase provides no SCIM server; it's a full app-layer build. SAML+OIDC JIT already covers onboarding. YAGNI until a customer contractually needs automated offboarding. | Defer (Out of Scope, matches stale brief). Revisit when the first enterprise requires IdP-driven deprovisioning. |
| **A policy engine (Casbin / oso / Permit.io)** | Duplicates + fights the Postgres RLS model the whole tenancy design rests on; complicates the RLS predicates. | Postgres RLS + membership tables + FastAPI deps. |
| **New frontend auth/SSO packages** | supabase-js already exposes `signInWithSSO({ domain })`; the switcher + org-admin shell reuse existing shadcn/ui + the v3.3 admin shell pattern. | Existing `@supabase/supabase-js` + shadcn `<Select>` + existing shell. |

---

## Stack Patterns by Variant

**If deployment = co-tenant SaaS (default, hybrid posture D-PRD-02):**
- Supabase **Cloud Pro+** for SAML (budget the 50-MAU included tier + $0.015/MAU overage into pricing).
- Custom-access-token hook + `X-Org-Id` header + asyncpg `SET LOCAL` RLS — the full membership-RLS machinery is load-bearing.
- `INVITATION_EMAIL_PROVIDER=resend`.

**If deployment = dedicated / on-prem enterprise (isolation-via-deployment):**
- **Self-hosted GoTrue SAML** (`GOTRUE_SAML_ENABLED=true` + `GOTRUE_SAML_PRIVATE_KEY`) — **no Supabase tier gate**, customer owns the IdP trust. Same `signInWithSSO()` app codepath.
- Isolation is largely at the deployment boundary (customer-owned Supabase), but the org/dept/role + RLS model still runs (a single-org install still needs departments).
- `INVITATION_EMAIL_PROVIDER=ses` (customer AWS) or `none`.

**If per-org OIDC is required in v1:**
- Add **Authlib 1.7.2**; store per-org IdP discovery/client config in `sso_configs`; handle the OIDC dance at the app layer (Supabase per-org SSO won't); attach the Supabase session after. Otherwise **defer Authlib**.

**If local dev:**
- `INVITATION_EMAIL_PROVIDER=none` (logs the invite link), no SAML/OIDC IdP, email+password sign-in unchanged. Nothing new to install beyond `pyjwt` (already present).

---

## Version Compatibility

| Package / Feature | Compatible With | Notes |
|-----------|-----------------|-------|
| PyJWT 2.13.0 | `gotrue` 2.12.4 (`pyjwt>=2.10.1,<3`), supabase 2.31.0 | Already transitive — explicit pin won't conflict. Use `PyJWKClient` for JWKS/ES256. |
| Authlib 1.7.2 | Python ≥3.10, our `httpx>=0.28`, `cryptography>=44` | Backend is Python ≥3.10 (uses `X \| None` unions). Pulls `cryptography` — already a direct dep (Phase 150). No system deps. |
| resend 2.34.0 | Python ≥3.7, `httpx` (async extra) | `send_async()` shares our httpx. |
| asyncpg ≥0.29 | Existing pool, Postgres 15 (Supabase) | No change; add the `SET LOCAL` wrapper only. |
| Supabase native SAML | Cloud **Pro+** OR self-hosted GoTrue | Cloud tier gate is the #1 gotcha — flag in pricing + the ADR. Multi-tenant config is **CLI-only**. |
| Supabase asymmetric JWT (ES256/JWKS) | supabase-py, PyJWT `PyJWKClient` | GA; enabling requires migrating the project to signing keys. Cache JWKS ≤10 min; handle `kid` rotation. |
| Custom-access-token hook | Cloud + self-hosted GoTrue | Self-hosted needs the two `GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_*` env vars. |

---

## Gotchas flagged for the ADR / roadmap (with citations)

- **Two different "Supabase SSO" features — do not conflate.** "Enable SSO for Your Organization" (`/docs/guides/platform/sso`) is SSO into the *Supabase dashboard account*; the one we want is "Single Sign-On with SAML 2.0 for Projects" (`/docs/guides/auth/enterprise-sso/auth-sso-saml`) — SSO for *our app's end users*.
- **SAML is Pro+ on Cloud** (50 SSO MAUs included on Pro/Team, then $0.015/MAU) — a real line item for the co-tenant tier. Self-hosted has no such gate.
- **Per-org OIDC is not native.** Supabase per-org enterprise SSO is SAML-only; "generic OIDC/Custom OIDC provider" is a *project-wide* config, not per-tenant. Per-org OIDC = app-layer (Authlib). [MEDIUM confidence — verified via two Supabase docs; confirm against the current `signInWithSSO` reference during Phase 0.]
- **Multi-tenant SAML is CLI-only** — the dashboard shows one field; provisioning N org IdPs needs `supabase sso add`. Wire into org-admin provisioning or an operator runbook.
- **JIT split:** Supabase auto-creates `auth.users` on SSO login; **the `org_members` insert (role from `sso_configs.jit_provisioning_default_role_id`, dept from attribute mapping) is ours** — at the SSO callback / first-authenticated-request seam.
- **RLS ON depends on `SET LOCAL ROLE authenticated`, not just claims** — the service-role/owner connection bypasses RLS; single most likely leak. Gate the phase on a live two-user RLS test.

---

## Sources

- Supabase Docs — *Single Sign-On with SAML 2.0 for Projects* (Pro+, SAML-only, CLI multi-tenant, `--attribute-mapping-file`, `sso_provider_id` in JWT): https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml — HIGH
- Supabase Docs — *Enterprise Single Sign-On* (SAML 2.0 = the enterprise SSO protocol): https://supabase.com/docs/guides/auth/enterprise-sso — HIGH
- Supabase Pricing (SAML Pro+, 50 SSO MAUs, $0.015/MAU overage, Team $599 SOC2/SAML/HIPAA): https://supabase.com/pricing — HIGH
- Supabase Docs — *Configure SAML SSO (self-hosting)* (`GOTRUE_SAML_ENABLED`, `GOTRUE_SAML_PRIVATE_KEY` PKCS#1 DER 2048-bit, per-IdP via admin API, same `signInWithSSO()`): https://supabase.com/docs/guides/self-hosting/self-hosted-saml-sso — HIGH
- Supabase Docs — *Custom Access Token Hook* (GA; self-hosted `GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED` + `_URI`): https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook — HIGH
- Supabase Docs — *JWT Signing Keys* (asymmetric ES256, JWKS at `/auth/v1/.well-known/jwks.json`, local `kid` verify, ≤10-min cache): https://supabase.com/docs/guides/auth/signing-keys — HIGH
- Supabase Discussion #30124 — *Run queries as authenticated user with direct connection* (`set_config('request.jwt.claims', …)` + role, parameterized, in-connection): https://github.com/orgs/supabase/discussions/30124 — HIGH
- PostgREST Docs — *Authentication* (claims via `current_setting('request.jwt.claims', true)::json`; impersonated-role behavior): https://docs.postgrest.org/en/v12/references/auth.html — MEDIUM (excerpt didn't fully quote the `set_config`/transaction internals; transaction-scoped `is_local=true` inferred from PostgREST reference behavior — flagged for live verification)
- PyPI (versions verified 2026-07-18): `python3-saml` **1.16.0**, `resend` **2.34.0**, `Authlib` **1.7.2** (Python ≥3.10), `boto3` **1.43.51**, `PyJWT` **2.13.0**, `gotrue` **2.12.4** (`pyjwt>=2.10.1,<3`), `supabase` **2.31.0** — HIGH
- Context7 `/authlib/authlib` (OAuth/OIDC client capability confirmation) — HIGH
- python3-saml (SAML-Toolkits) — `xmlsec1`/`python-xmlsec` system dependency + CVE history (CVE-2017-11427 fixed 1.4.0; defusedxml XXE since 1.2.6): https://github.com/SAML-Toolkits/python3-saml — MEDIUM (rationale for AVOIDING it)
- Live-code verification (HIGH): `backend/app/dependencies.py` (service-role singleton `get_supabase`; existing asyncpg `get_pg_pool` min2/max10 + JSONB codec; `get_current_user` GoTrue round-trip), `backend/requirements.txt` (asyncpg/supabase/httpx/cryptography present; no authlib/python3-saml/email libs).

---
*Stack research for: v3.4 Multi-Tenancy & Org Access — new-stack-only (SSO + per-request RLS)*
*Researched: 2026-07-18*

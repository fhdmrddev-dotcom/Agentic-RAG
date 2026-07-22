# Phase 168: SSO — SAML 2.0 (CORE) - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

The enterprise-onboarding capstone of v3.4 (last CORE phase; first-to-cut / zero downstream dependents). An org-admin can register a SAML 2.0 IdP through **Supabase's native SAML service-provider**, users route to it by **email domain**, first SSO login **JIT-provisions** their `org_members` row, and **email/password sign-in stays** (SSO enforcement explicitly deferred).

**We build exactly three things** — the rest is Supabase's:
1. A way for an org-admin to **create the per-org SAML connection** (self-service, backend-proxied).
2. A **login page** that knows when to send someone to SSO vs. show the password box (identifier-first).
3. The **domain-gated JIT** step that drops a first-time SSO user into the right org.

**Requirements:** SSO-01 (single CORE requirement). See `.planning/REQUIREMENTS.md`.

**Not this phase:** OIDC (→ STRETCH 172), SSO enforcement / no-password-fallback, SCIM directory provisioning, attribute→role elevation, department import from attributes (departments aren't live until STRETCH 169), single-logout (SLO — Supabase doesn't support it).
</domain>

<decisions>
## Implementation Decisions

### How Supabase SSO actually works (grounding — verified against current official docs)
- **Supabase Auth IS the SAML SP.** We never touch/parse SAML XML. Per org we register ONE "connection" (`type: saml`, an IdP **metadata URL**, and one or more email `domains`). `supabase.auth.signInWithSSO({ domain })` runs the whole redirect-to-IdP-and-back flow; **GoTrue resolves domain→provider server-side.** `{ providerId }` (the provider UUID) is the fallback when a provider has no domains.
- **There is NO Supabase self-service SSO Dashboard screen and NO hosted admin portal** (unlike WorkOS). "Self-service" is something WE build — but the actual integration is ~one API call, so it's cheap.
- **Cloud vs self-hosted are two different secrets/surfaces** (this changes the plan):
  - **Cloud (our default, Pro+):** provider CRUD via the **Management API** — `POST/GET/PUT/DELETE /v1/projects/{ref}/config/auth/sso/providers` on `api.supabase.com`, auth = a **project management / personal-access token (`sbp_…`)** — the `service_role` key does NOT work here. SAML is Pro+ ($0.015/SSO MAU beyond quota).
  - **Self-hosted GoTrue (the enterprise / isolation-via-deployment tier):** **GoTrue Admin API** — `POST /auth/v1/admin/sso/providers` with `service_role` (`Authorization` + `apikey`), gated by env `GOTRUE_SAML_ENABLED=true` + `GOTRUE_SAML_PRIVATE_KEY`. Un-gated (free) here.
  - The env-var switch between these two must honor the Phase-160 4-tier deployment-flexibility contract (no code fork; deploy-time decision).

### SSO setup UX (D-168-01) — Full self-service via metadata URL
- **D-168-01:** The org-admin pastes their IdP's **metadata URL** (a link Okta/Azure/Google Workspace hands them — **no XML files**) into the SSO tab; **our FastAPI backend makes one authenticated call to Supabase's provider-CRUD API** (Management API on cloud / GoTrue Admin API self-hosted) to create/update/delete the connection. This is the only option that scales to many orgs and matches the WorkOS/Okta/Clerk/Stytch self-service norm. (Rejected: operator-runs-CLI and instructions-only — a manual per-tenant operator bottleneck; marginally less code for materially worse UX.)
- The **provider-management token** (cloud `sbp_…` / self-hosted `service_role`) is stored in the **Phase-150 encrypted secrets store** (`secret_cipher.py`), never env sprawl.
- **Gated behind operator/domain-ownership approval** before a connection goes live (see D-168-05).

### Login-page routing (D-168-02) — Identifier-first
- **D-168-02:** One email field. On submit, look up the domain in `sso_configs`: **match → `signInWithSSO({ domain })`** (redirect to IdP); **no match → reveal the password field.** Keep a small secondary **"Sign in with SSO"** escape-hatch link for IdP-initiated / edge cases. The accepted B2B norm (Google/Okta/WorkOS); lowest-friction path that **preserves the retained password fallback** — nobody is locked out if the IdP is down.

### Attribute mapping scope (D-168-03) — Email + name only; member-only JIT
- **D-168-03:** Map **identity attributes only** — email is auto-detected by Supabase (standard SAML attribute names); add `first_name`/`last_name` for display. **Every JIT-provisioned `org_members` row defaults to `member`. NO IdP-supplied role/group attribute may grant `org-admin`** — attribute-driven privilege elevation is a classic SSO escalation footgun (same class as the Phase-167 CR-01 greenlist leak). Admins elevate people in-app afterward. Department mapping is added later, additively, once that surface exists (Phase 169). (Rejected: role-from-IdP and full department import now — privilege-escalation surface + dead code against a department UI that doesn't exist.)

### Locked constraints from research — fold in, do NOT re-decide (landmines for the planner)
- **D-168-04 (SSO JIT seam — domain-gated, NOT token-gated):** SSO first-login has **no invitation token** (unlike the Phase-167 accept path). JIT must resolve the org by **verified email-domain → `sso_configs` → org**, then reuse the **167 idempotent membership pattern** (`pg_advisory_xact_lock` + `INSERT … org_members … ON CONFLICT DO NOTHING`, the token-authorized service-role/BYPASSRLS path since the user isn't a member yet). **Critical Supabase gotcha:** SSO and password accounts **do NOT auto-link** — the same email via SSO creates a **new `auth.users` row (new UUID)** distinct from an existing password account. So the JIT must key membership on **domain→org**, tolerate **duplicate-email accounts**, and never assume one `user_id` per email. Membership is **join-additive** (Phase-167 D-167-01 — an SSO user who already had a personal org keeps it; the 166 org switcher shows both).
- **D-168-05 (domain hygiene is OURS — anti-hijack; threat-model item):** Supabase does **not** verify domain ownership and does **not** exclude public domains. Before a connection goes live we add an **operator / domain-ownership approval gate** and **reject public/personal domains** (gmail.com, outlook.com, …). This is the security cost of choosing self-service (D-168-01) and is an explicit plan task + threat-model entry (the phase's "surviving risk" per the roadmap flags — enforcement/hijack, NOT parser hardening).
- **D-168-06 (testability / UAT acceptance bar — RESEARCH-FLAG, recommended default):** The local Supabase CLI stack ships **SAML disabled** (no `[auth]`/SAML block in `config.toml`) and there is **no local IdP** → live SAML can't be exercised on the default local stack as-is. **Recommended acceptance bar (operator confirms environment at execution time, don't block the phase on local infra):** (a) automated unit/integration tests **mock** the provider-create API call + domain-routing decision + the domain-gated JIT membership insert; (b) **ONE live end-to-end SAML round-trip** proven against a **real test IdP** (e.g. `samltest.id` / a mock-saml container) on **either** a locally-SAML-enabled self-hosted GoTrue (`GOTRUE_SAML_ENABLED=true` + private key) **or** cloud staging. Research should confirm the cheapest of the two for our setup.

### Carried forward — locked upstream, do NOT re-ask
- **Supabase IS the SAML SP; `python3-saml`/`xmlsec1` dropped; 0 new hard deps** (Phase-160 ADR + research SUMMARY; the stale PRD's marquee dependency is retired). Frontend uses `supabase-js`'s built-in `signInWithSSO` — no new frontend SSO packages.
- **Email/password fallback RETAINED; SSO enforcement explicitly deferred** (SSO-01 / SC#3 — never lock out the old path this milestone).
- **SSO tab lives in the shipped Phase-166 org-admin shell** (the currently-`LockedTab` "SSO" tab → LIVE), gated on `sso:manage` (mig-104 policy already exists), reusing 166's design system.

### Claude's Discretion
- The exact SSO-tab layout (metadata-URL input, connection status chip, SP metadata/ACS-URL display for the admin to paste into their IdP, test-connection affordance), the identifier-first form's transition animation, the approval-gate UX shape, and the precise `sso_configs` shape tweaks (e.g. a `status` column, uniqueness on `email_domain`, `provider_id` holding the real GoTrue provider UUID) — a possible small migration is a **plan-time call** (mig-104's `sso_configs` was deliberately thin: "Phase 168 reveals its real shape live — invent nothing now").
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap / requirements
- `.planning/ROADMAP.md` — v3.4 active section, **Phase 168 detail** (goal, SC 1–3, flags: threat model [enforcement-before-fallback, NOT parser hardening] / UI hint [SSO tab] / 0 new hard deps; Depends on 167 JIT seam; LAST in CORE, first-to-cut).
- `.planning/REQUIREMENTS.md` — **SSO-01** definition + traceability (→ Phase 168); the "what NOT to build" table (SSO enforcement, `python3-saml`, SCIM).

### Research (SSO-specific — verified same-day against official Supabase docs)
- `.planning/research/SUMMARY.md` — **SSO note (line 73)** (Supabase SAML-only, domain-routed, Pro+ cloud / un-gated self-hosted); **Phase 8 role (lines 159–164)** (SSO last, JIT reuse, 0 deps); **Pitfalls resolution (line 217)** (do NOT budget effort hardening a SAML XML parser this app no longer owns); STACK headline (Supabase IS the SAML SP).

### Schema already in place (reuse — do NOT recreate)
- `supabase/migrations/104_org_dept_role_schema.sql` — **`sso_configs` table (lines 150–163)**: deliberately thin `org_id / email_domain / provider_id / attribute_mapping jsonb`; D-07 comment: "Phase 168 reveals its real shape live — invent nothing now." NO FK into the Supabase `auth` schema. + the `sso_configs` RLS policies (write = `sso:manage`, lines 370–387).

### The JIT seam this phase reuses (domain-gated variant)
- `backend/app/api/org.py` — **`POST /org/invitations/accept` (lines 589–643)**: the Phase-167 token-gated JIT accept endpoint; the SSO JIT is the **domain-gated** sibling of this.
- `backend/app/services/invitation_service.py` — **`accept_invitation`**: the idempotent `pg_advisory_xact_lock` + `INSERT … org_members … ON CONFLICT DO NOTHING` pattern to reuse.
- `.planning/phases/167-invitations-roles-greenlists-jit-per-user-prefs/167-CONTEXT.md` — **D-167-05** (JIT seam = app-layer accept, NOT the mig-105 trigger — email-match auto-join = account-takeover) + **D-167-01** (join-additive).

### Frontend auth (password-only today → identifier-first here)
- `frontend/src/hooks/useAuth.ts` — current `signInWithPassword` / `signUp` only; add `signInWithSSO({ domain })` + identifier-first routing.
- `frontend/src/components/auth/SignInForm.tsx` + `SignUpForm.tsx` — the login forms to rework into the identifier-first flow.

### 166 org shell + secrets store to extend
- `frontend/src/components/org/OrgAdminShell.tsx` — the 7-tab shell; the **"SSO" LockedTab becomes LIVE** here.
- `frontend/src/providers/OrgProvider.tsx` + the org switcher — where a join-additive SSO user lands (D-168-04).
- `backend/app/security/secret_cipher.py` — Phase-150 MultiFernet encrypted secrets store for the provider-management token (`sbp_…` / `service_role`).
- `.planning/notes/settings-control-room-boundary.md` — the operator↔org↔user boundary (governs where the provider-management token + SSO config live).

### Official Supabase docs (external — the provider-docs-first source of truth)
- SAML 2.0 SSO for Projects — https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml
- Management API — Create an SSO provider — https://supabase.com/docs/reference/api/v1-create-a-sso-provider (cloud path; `sbp_` token)
- Self-hosted SAML SSO (GoTrue Admin API) — https://supabase.com/docs/guides/self-hosting/self-hosted-saml-sso
- CLI `supabase sso` reference — https://supabase.com/docs/reference/cli/supabase-sso
- Custom Access Token Hook (attribute→claim) — https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook

### Decisions ledger
- `.planning/prd-reset/DECISIONS.md` — **D-07** (thin `sso_configs`, no `auth`-schema FK); the secrets-surface decision (v3.2 SSO `idp_metadata` reads/writes through the one encrypted secrets path — the Phase-150 store).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (this phase is composition + one integration call + a login-page rework)
- **`sso_configs` table (mig 104)** — the thin org↔provider↔domain map; SSO config CRUD is app-code over it (possible small shape tweak — plan-time).
- **Phase-167 JIT seam** (`invitation_service.accept_invitation`) — the idempotent advisory-lock + `ON CONFLICT DO NOTHING` membership pattern to reuse **domain-gated** instead of token-gated.
- **Phase-166 org-admin shell SSO `LockedTab` → live** + `OrgProvider` (multi-org, join-additive landing).
- **Phase-150 `secret_cipher.py`** — encrypted store for the provider-management token.
- **`supabase-js` `signInWithSSO`** — built-in; no new frontend dep.

### Established Patterns / constraints
- Every org-scoped route reuses the 166 `get_active_org_id` server-validated `X-Org-Id` + `require_org_manage`/`sso:manage` gates. The `sso:manage` write policy already exists (mig 104).
- Attribute mapping lands as JWT `custom_claims` / `raw_user_meta_data` (`auth.identities.identity_data`) — readable post-login to drive the (member-only) JIT. Multi-tenant RLS hook available: tenant = `auth.jwt() #>> '{amr,0,provider}'` (= `sso_provider_id`).
- **Deep Mode byte-identical (D-14)** — SSO is an auth/onboarding surface, not the provider/agent path; no shared-path fork.

### Integration Points
- New backend SSO-provider endpoints in `org.py` (create/list/update/delete) gated on `sso:manage` → **proxy the Supabase provider-CRUD API** (Management API cloud / GoTrue Admin API self-hosted) using the encrypted management token; write the resulting `provider_id` back to `sso_configs`.
- Frontend **identifier-first login**: email → `sso_configs` domain lookup → `signInWithSSO({ domain })` or reveal password.
- **SSO-callback JIT**: resolve org by verified email domain → `sso_configs` → idempotent `org_members` insert (the domain-gated sibling of the 167 accept path), tolerating duplicate-email accounts.
- **Approval + domain-hygiene gate** before a connection activates (operator/domain-ownership; block public domains).
- Possible **small migration** firming up `sso_configs` (a `status` column, `email_domain` uniqueness, `provider_id` = real GoTrue UUID) — plan-time decision.
</code_context>

<specifics>
## Specific Ideas
- Admin pastes an **IdP metadata URL, not XML** — avoids XML handling entirely.
- **Cloud path:** Management API `POST /v1/projects/{ref}/config/auth/sso/providers` + `sbp_` token (NOT `service_role`). **Self-hosted path:** GoTrue Admin API `POST /auth/v1/admin/sso/providers` + `service_role` + `GOTRUE_SAML_ENABLED=true`.
- `signInWithSSO({ domain })` — GoTrue resolves domain→provider server-side; `{ providerId }` fallback when a provider has no domains.
- **No identity linking** (SSO email ≠ existing password user_id) and **no SLO** are Supabase facts to design around, not bugs to fix.
- SAML = Pro+ on cloud ($0.015/SSO MAU beyond quota); un-gated on self-hosted GoTrue — so the "expensive" enterprise (isolation-via-deployment) tier gets SSO for free.
</specifics>

<deferred>
## Deferred Ideas
- **OIDC enterprise SSO** → STRETCH **Phase 172** (SSO-02) — Supabase per-org enterprise SSO is **SAML-only**; per-org OIDC needs a custom Authlib SP. Never promise "both native."
- **SSO enforcement (no password fallback)** → a later add-on once the fallback path is proven (never in v3.4).
- **SCIM directory provisioning** (directory-driven offboarding) → when a customer requires it.
- **Attribute → role elevation** (IdP group grants org-admin) → deferred; member-only JIT this phase (D-168-03).
- **Department import from SAML attributes** → when departments go live (Phase 169); store-nothing this phase, add additively later.
- **Single Logout (SLO)** — not supported by Supabase; use session timeboxing, don't build IdP-driven logout.

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` — matched at score 0.4 on the keyword "first" only; its domain (NL→workflow authoring) is unrelated to SSO/auth. Reviewed, not folded.

### Reported Bugs cross-check
No open `surface: Agentic-RAG` bug overlaps this phase's domain (SSO / SAML / auth / login / onboarding). All open Agentic-RAG reports are chat / streaming / workflow-surface, explicitly held OUT of v3.4 (post-v3.3 chat-polish phase).
</deferred>

---

*Phase: 168-SSO — SAML 2.0 (CORE)*
*Context gathered: 2026-07-22*

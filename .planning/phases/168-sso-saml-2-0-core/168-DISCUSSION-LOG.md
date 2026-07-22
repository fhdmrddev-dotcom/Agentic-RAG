# Phase 168: SSO — SAML 2.0 (CORE) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 168-SSO — SAML 2.0 (CORE)
**Areas discussed:** SSO setup UX, Login-page routing, Attribute-mapping scope, Research-locked constraints

> **Note:** The user asked to clarify before answering — specifically for a plain-language explanation of each option, a recommendation, whether Supabase has an easier managed SSO path, and how competitors integrate SSO. A focused advisor-research pass (verified against current official Supabase docs + WorkOS/Okta/Clerk/Stytch patterns) was run before re-posing the questions with recommendations marked. All three primary picks were the recommended options.

---

## SSO setup UX

| Option | Description | Selected |
|--------|-------------|----------|
| Full self-service via metadata URL | Admin pastes IdP metadata URL; backend proxies Supabase provider-CRUD API (Management API cloud / GoTrue Admin API self-hosted) to create the connection, behind an approval gate | ✓ |
| Admin submits config → operator provisions | Admin records config; operator runs `supabase sso add` manually | |
| Instructions + config-record only | Tab shows SP metadata/ACS URL + records config; provisioning fully out-of-band | |

**User's choice:** Full self-service via metadata URL (Recommended)
**Notes:** Research confirmed Supabase has NO self-service SSO Dashboard/embedded portal — so "self-service" is one backend API call we build. It's the only option that scales to many orgs and matches the WorkOS/Okta/Clerk/Stytch norm. Cloud uses a `sbp_` management token (NOT `service_role`); self-hosted uses `service_role` + `GOTRUE_SAML_ENABLED`. Metadata URL chosen over pasted XML to avoid XML handling.

---

## Login-page routing

| Option | Description | Selected |
|--------|-------------|----------|
| Identifier-first: email → route | One email box → domain match sends to SSO, else reveal password; small "Sign in with SSO" escape-hatch | ✓ |
| Explicit "Sign in with SSO" button only | Password form unchanged; separate SSO button | |
| Both visible (password form + SSO button) | Most forgiving, busier UI | |

**User's choice:** Identifier-first: email → route (Recommended)
**Notes:** The accepted B2B norm (Google/Okta/WorkOS). Low-effort and naturally preserves the retained password fallback — nobody locked out if the IdP is down.

---

## Attribute-mapping scope

| Option | Description | Selected |
|--------|-------------|----------|
| Email + name only; member-only JIT | Map identity only; every SSO user JIT-provisions as `member`; no IdP attribute grants org-admin | ✓ |
| Email + name + role | IdP attribute/group → role (incl. org-admin) on JIT | |
| Full mapping incl. department import now | Wire role + department→dept_members against mig-104 schema | |

**User's choice:** Email + name only; member-only JIT (Recommended)
**Notes:** Trusting an IdP-supplied role/group to grant admin is a classic privilege-escalation footgun — same class as the Phase-167 CR-01 greenlist leak. Departments aren't live until STRETCH Phase 169, so full attribute/department import now would be dead code. Admins elevate people in-app afterward.

---

## Research-locked constraints (multi-select — all folded in)

| Constraint | Description | Selected |
|--------|-------------|----------|
| JIT resolves org by domain, tolerate dup-email | SSO + password accounts don't auto-link in Supabase (same email via SSO = new user_id) → JIT keys on domain→org, tolerates duplicate-email users | ✓ |
| Operator-approval + block public domains | Supabase doesn't verify domain ownership or block gmail.com → add an approval/domain-ownership gate + reject public domains (anti-hijack); threat-model item | ✓ |
| Discuss local-SAML testability / UAT bar | Local Supabase ships SAML disabled + no IdP → set the acceptance bar (mock automated + one live round-trip via test IdP on self-hosted-local or cloud staging) | ✓ |
| All good — write CONTEXT.md now | Fold constraints, note testability for research, proceed | ✓ |

**User's choice:** All four selected — lock both research constraints (D-168-04, D-168-05), capture the testability bar as a research-flagged recommended default (D-168-06), and proceed to CONTEXT.md.
**Notes:** The user opted to proceed rather than open another Q&A round on testability, so D-168-06 captures a recommended default (automated mocks + one live round-trip via a test IdP on locally-SAML-enabled self-hosted GoTrue or cloud staging; operator confirms environment at execution time) — not a hard blocker.

---

## Claude's Discretion
- Exact SSO-tab layout (metadata-URL input, connection-status chip, SP metadata/ACS-URL display, test-connection affordance).
- Identifier-first form transition; approval-gate UX shape.
- Precise `sso_configs` shape tweaks (`status` column, `email_domain` uniqueness, `provider_id` = real GoTrue UUID) and whether they warrant a small migration — a plan-time call (mig-104's `sso_configs` was deliberately thin).

## Deferred Ideas
- OIDC enterprise SSO → STRETCH Phase 172 (Supabase per-org SSO is SAML-only).
- SSO enforcement (no password fallback) → later add-on once fallback proven.
- SCIM directory provisioning → when a customer needs directory-driven offboarding.
- Attribute→role elevation → deferred (member-only JIT this phase).
- Department import from attributes → when departments go live (Phase 169).
- Single Logout (SLO) → not supported by Supabase; not built.
- `spike-nl-workflow-authoring.md` todo — reviewed (0.4 keyword-only match), not folded (unrelated domain).

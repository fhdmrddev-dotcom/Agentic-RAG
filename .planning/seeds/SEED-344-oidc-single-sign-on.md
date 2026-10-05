---
seed_id: SEED-344
title: OIDC single sign-on — only SAML shipped (v3.4 Phase 168); the OIDC half (STRETCH Phase 172) was deferred and held by no seed
created: 2026-10-04
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "A real or prospective customer's identity provider supports OIDC only and that blocks a deal; OR any phase whose files_modified names sso_provider_service.py or the SSO settings surface."
trigger_paths: ["backend/app/services/sso_provider_service.py", "backend/app/services/sso_domain_blocklist.py"]
trigger_surfaces: ["auth", "admin"]
migration_note:
relates_to: [".planning/v3.4-STRETCH-CARRYFORWARD.md § 172 (SSO-02)", "Phase 168 (SAML)", "SEED-115", "docs/history/v3.4-multi-tenancy-and-org-access.md"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-344: OIDC single sign-on

## The finding

v3.4 Phase 168 shipped org SSO through SAML, which Supabase supports natively
(`backend/app/services/sso_provider_service.py`). OIDC enterprise SSO (SSO-02) was STRETCH Phase 172 and
was deferred. It lives only in `.planning/v3.4-STRETCH-CARRYFORWARD.md`, a file no sweep reads.

The carry-forward's plan: a custom Authlib service provider (Supabase does not offer org-level OIDC), a
new scope-gated dependency, and a threat model centred on discovery-endpoint SSRF.

## Why it matters

Only when a customer needs it. SAML covers most enterprise identity providers. This seed exists so that
the first OIDC-only prospect finds a plan rather than a blank.

## When to surface

A customer's IdP is OIDC-only and blocks a deal, or the SSO service is being changed for another reason.

## Scope estimate

Medium: one phase with a security review. Route the discovery-URL fetch through the existing egress
guard pattern (`app.security.egress`) rather than a new allowlist.

## Breadcrumbs

- `.planning/v3.4-STRETCH-CARRYFORWARD.md` lines 50-55

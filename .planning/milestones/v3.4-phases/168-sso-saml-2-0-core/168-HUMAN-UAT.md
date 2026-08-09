---
status: partial
phase: 168-sso-saml-2-0-core
source: [168-VERIFICATION.md]
started: 2026-07-22T09:45:00Z
updated: 2026-07-22T09:45:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live end-to-end SAML round-trip
expected: On cloud staging (Supabase Pro+) with a real/mock IdP (mocksaml.com per 168-VALIDATION.md) — an org-admin registers a SAML connection via the SSO tab (metadata URL + email domain) → an operator approves it (pending_approval → active) → a user with that email domain types their email on the login page and clicks Continue → is redirected to the IdP → authenticates → is redirected back → JIT inserts exactly ONE org_members row with role='member' → the org switcher resolves the newly-joined org. Then an existing password-account user can still sign in the old way. The full chain completes without manual DB intervention; no duplicate membership on a second login; password fallback still works.
result: [pending]

### 2. Migration 113 live-apply re-confirmation (informational — already re-verified locally)
expected: Re-run the four Task-2 verification queries against the target environment before promoting to any new environment (e.g. before the next cloud push, since 113 is in the pending 099→113 cloud-parity set). Grant=1 row, sso_configs approval columns=3, unique index=1, app_settings.supabase_management_token=1 column.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

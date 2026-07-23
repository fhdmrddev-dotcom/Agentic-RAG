---
status: partial
phase: 177-v3-4-org-surface-polish
source: [177-VERIFICATION.md]
started: 2026-07-23
updated: 2026-07-23
---

## Current Test

[awaiting human testing — operator was away during the autonomous run]

## Tests

### 1. Live family-cohesion sweep — member vs org-admin × solo vs multi-org matrix
expected: OrgBand, ProfileMenu, the rail shield-mirror, the roster, InvitationsTab, and SsoTab all read as one built-together visual system (same chip shape, same role-badge shape, same 4px row rhythm) across all 4 matrix cells; the org-admin shield + "Organization admin" menu entry are absent (not disabled) for a member; the switcher chrome is absent for a solo org and present at 2+ orgs.
result: [pending]

### 2. Recolored recoverable invite dead-ends (missing token / expired / revoked / invalid) at /invite
expected: Each state reads calm (muted tone + Info glyph, no alarming red), not like something broke.
result: [pending]

### 3. SignInForm fail-open degrade in a live route-outage
expected: The password field reveals with a reassuring calm note ("Nothing's wrong with your account…"); the form never locks the user out.
result: [pending]

### 4. Cross-provider org-switch teardown + SAML round-trip (rolled forward from Phases 166/167/168)
expected: Switching active orgs correctly tears down/reprobes state across providers; a real IdP SSO round-trip completes without leaking cross-org state.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

None at the code level — all 16 code-level must-haves verified (177-VERIFICATION.md). These are lived-visual / live-environment items only. Item 4 needs cloud + a real IdP (deferred per CONTEXT D-03, not gated on this phase). Run `/gsd:verify-work 177` (Chrome MCP or operator-driven) to close items 1–3.

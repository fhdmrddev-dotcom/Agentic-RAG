---
seed_id: SEED-113
title: User profile menu — identity-anchored (username/email) entry point for profile + general user settings, designed for future tiers/tenants/user types
status: open
planted: 2026-07-11
phase_origin: "Operator, right after approving Phase 146 UAT: 'we should have general user settings from the menu where we should show the username, the email — then we click on this menu and we should show profile… maybe top-side corner where we will show the profile menu and other things related to user settings, general settings.' Raised together with the observation that a brand-new user currently sees the ENTIRE Settings surface because there is no tenancy/user-profile layer yet."
category: product UX — app-shell identity/profile surface + settings IA, deferred (routing decision pending: v3.3 vs v3.4)
related_seeds:
  - SEED-113 sibling bug report — .planning/reported-bugs/chat-list-too-narrow-nav-panel-crowding.md (BUG-260711-01: both reshape the nav rail; consider in one sketch pass)
related_phases:
  - Phase 146 (Operator Foundation) — established the operator/user split; the profile menu is the USER-side identity anchor counterpart
  - Phase 148 (Governance — users & feature visibility) — natural CORE home for a first slice (VIS-01 already reshapes what normal users see; user list management lands there)
  - v3.4 multi-tenancy milestone — tiers/tenants/user types decide the FULL shape (org switcher, role badge, per-tier settings)
related_memories: [project_org_level_deferred, project_dynamic_settings_direction, project_settings_design_guidance]
priority: medium
---

# SEED-113 — user profile menu + general-settings entry point (identity anchor in the app shell)

## The ask (operator, 2026-07-11)

A standard identity-anchored menu in the app shell (likely top corner, per convention): shows the
signed-in user's name/email; clicking opens profile + general user settings (and later: sign out,
role/tier badge, tenant/org switcher). Today the app has no visible "who am I" anchor — Settings is
reachable but not identity-framed, and a new user sees the entire Settings surface undifferentiated.

## Why it's not just a widget

The menu's contents depend on decisions that are explicitly deferred:
- **Tiering / user types / tenants** — v3.4 one-way-door territory ([[project_org_level_deferred]]).
- **Settings IA split** — personal preferences (stay with user) vs platform controls (migrating to the
  Control Room across 147-150). The profile menu is the natural HOME for the personal half once the
  split completes — i.e., it is the user-side mirror of Phase 146's operator shield.
- **Feature visibility (VIS-01, Phase 148)** — what a normal user's Settings/menu even contains.

## Suggested shape (advice, not decided)

1. **Minimal slice early (candidate: fold into Phase 148 discuss-phase):** avatar/initials + email in
   the shell corner → dropdown with Profile (read-only identity), link to existing Settings, Sign out.
   No new settings surfaces; pure IA anchor. G-2 sketch first.
2. **Full shape at v3.4:** role/tier badge, tenant switcher, per-type settings — after tenancy decisions.

## Re-open triggers

- `/gsd:discuss-phase 148` (user management + feature visibility — surface this seed there), OR
- v3.4 milestone kickoff (tenancy decisions unlock the full design), OR
- any phase that redesigns the nav rail / app shell (must consider jointly with BUG-260711-01).

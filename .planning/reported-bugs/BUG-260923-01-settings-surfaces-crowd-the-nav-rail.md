---
id: BUG-260923-01
title: Settings, Organization admin, Control Room and Spend each take a rail slot — the nav rail is too dense
reported: 2026-09-23
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [frontend/navigation, frontend/layout, frontend/settings, frontend/admin]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: production
  commit: dea7f5539
  date: 2026-09-23
---

# BUG-260923-01: Settings surfaces crowd the nav rail

## What we observed

Reported by the operator right after the v4.3 deploy: *"we have settings, we have control room, we
have organisation settings and all are in the navigation panel, which is making it very dense. We
have to find a smart way to organise all different types of settings in the user menu, similar to
how Claude.ai does."*

Measured in code at `dea7f5539`, an operator who is also an org-admin sees up to **12 rail
affordances**:

- **8 product entries** from `frontend/src/lib/nav-items.ts` — Chat, Workflows, Library,
  Classification, Connections, Skills, Experts, **Settings**.
- **3 admin entries rendered outside `navItems`** in `frontend/src/components/layout/NavPanel.tsx`
  — **Organization admin** (indigo shield, `:330-345`), **Control Room** (operator shield,
  `:353-360`) and **Spend** (`Receipt`, `admin-spend`, `:371-395`, added in Phase 257.1).
- **The ProfileMenu** — which since Phase 166 already holds theme + Sign out (`NavPanel.tsx:327`).

Four of those twelve are *configuration* surfaces (Settings, Organization admin, Control Room,
Spend) sitting beside the eight *work* surfaces, with equal visual weight.

## Why it matters

The rail is the primary navigation and it now mixes "where I work" with "where I configure". Every
new admin surface has been given its own rail slot (Spend was added in 257.1 because it was
otherwise unreachable), so the density grows by one each milestone. A normal member sees fewer
entries, but operators and org-admins — the people evaluating the product for purchase — see the
densest version.

## Hypothesized cause

Not a defect in one component — an **information-architecture gap**. There is no single home for
"settings of any scope", so each scope (personal, org, platform-operator, spend) was placed
wherever it could be reached. The ProfileMenu already exists and already holds account-level
controls (theme, sign out), which makes it the natural consolidation point.

## Proposed direction (to be sketched, not decided)

A Claude.ai-style **account menu** off the profile avatar, grouping configuration by scope:

- **You** — Settings (models, preferences), theme, sign out
- **Organization** — Organization admin (members, Experts, roles, SSO, subscription) — org-admins only
- **Platform** — Control Room, Spend — operators only

…leaving the rail to the eight work surfaces. Open questions for the sketch: whether Settings
itself stays on the rail for members; how an admin shell's tabs are reached from a menu without
an extra click being painful; mobile drawer behaviour (the 262 mobile fix).

⚠ Constraints already recorded in the codebase: the feature-visibility filter in
`visibleNavItems` must still **hide only what is known to be denied** (the 2026-09-09 refresh
bug), and `lib/activeViewReachability.ts` fences that every `ActiveView` stays reachable — moving
an entry into a menu must keep that fence green, not delete the view's door.

## Surface classification

`Agentic-RAG` — this app's own navigation.

## Suggested routing

- **Fold into in-flight phase:** n/a (no milestone active)
- **Defer to future phase / milestone:** next milestone — a UI/IA phase. ⚠ G-2 applies: **sketch
  first** (`/gsd:sketch`), operator-approved mockup is the acceptance bar; G-4 lived UAT on the
  real rail for member / org-admin / operator.
- **Plant as seed:** not needed — this report is the register entry.
- **External — note only:** no

## Workarounds

None needed functionally — every surface is reachable today. The cost is density, not access.

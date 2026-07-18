---
seed_id: SEED-115
title: Org access control — user types/roles, departments/groups, group-based feature greenlists, and permission-aware document access (Glean reference model)
status: open
planted: 2026-07-11
phase_origin: "Operator, while picking the Phase 148 sketch winners (067/068/069 all A): 'for user access and considering the future plans I think this deals with part of the user access control because you might define different types of users or maybe different departments in the organisation… also competitors like Glean and Beam AI — so we should consider.'"
category: access control / org-RBAC — v3.4 one-way-door territory; 148 ships forward-compatible shapes only
re_open_trigger: "/gsd:new-milestone for v3.4 (org-level multi-tenancy / org-RBAC rewrite) — this seed is the access-control requirements input; also re-open if ANY v3.3 phase is tempted to add a role/group concept ad hoc"
related_seeds:
  - SEED-113 (user profile menu — the user-side identity anchor; role/tier badge + org switcher land there)
related_phases:
  - Phase 146 (operator_users — the org-agnostic operator principal, deliberately NOT org-scoped)
  - Phase 148 (Governance) — ships the degenerate two-audience case: user roster + disable/enable + Everyone|Operators-only feature visibility
  - v3.4 org-RBAC milestone — the full shape
related_memories: [project_org_level_deferred, project_v33_milestone_started, project_target_scale]
priority: high
---

# SEED-115 — org access control: roles · departments · greenlists · doc-level permissions

## The ask (operator, 2026-07-11)

Phase 148's Users & Access is *part of* user access control, not all of it. Future plans need
different **types of users** (roles/tiers) and **departments/groups** in an organization —
consider how best-in-class document-management systems and the named competitors (Glean,
Beam AI) manage access, and make sure 148's shapes don't fight that future.

## The reference model (from `.planning/research/FEATURES.md` Part 1c — Glean study, 2026-07)

Glean's admin console is the closest analog and layers access control in three tiers:

1. **Identity & groups from the directory** — users + departments/groups inherited from the
   IdP (SSO/SCIM), never hand-maintained in-app. Adoption states (not-yet-invited / pending /
   active) on the People surface.
2. **Group-based feature greenlists + admin role tiers** — three admin tiers (Setup Admin ·
   Admin · Super Admin), content-moderator grants, and **feature greenlists that gate feature
   access per group** — exactly the generalization of our VIS-01 visibility map.
3. **Permission-aware document access** — per-request permission checks ("returns only what
   the user can access"), source-ACL mirroring per connector, search governance
   (check-user-access, hide-documents).

Beam AI is thinner publicly: workspace/team-based access with human-in-the-loop governance —
confirms the direction, adds little detail. Classic DMS (SharePoint/Box/Egnyte): RBAC +
groups + folder-level permission inheritance.

## What 148 already locks to stay compatible (Running Design Decision 59, sketches 068/069)

- **Audience values are extensible enum-shaped records, never booleans** — v3.4 adds
  roles/groups without re-meaning stored values.
- **`require_visible` resolves audience through one swappable function** — "is operator"
  becomes "is in group X" at one boundary.
- **The roster's role column is a chip-set** (operator/member today) — roles/departments
  render additively; a department column can arrive from IdP/SCIM later.
- **Grant/revoke operator** (if ratified) writes `operator_users.granted_by` — the
  provenance pattern every later role-grant inherits.
- `operator_users` stays org-agnostic (mig 095, D-06) — per-org operators are a v3.4
  re-decision, not a 148 drift.

## The v3.4 shape this seed proposes (advice, not decided)

1. **Roles before departments**: a small role enum (member / power-user / operator …) per
   org membership row — the visibility map's audience picker grows to accept roles.
2. **Departments/groups as directory-sourced objects** (SCIM/SSO import first, manual CRUD
   fallback) — greenlists then key on groups, matching Glean.
3. **Folder-level access as the doc-permission unit** (our KB's container = folder; Glean's
   "containers" precedent) — per-request checks in retrieval so RAG answers only cite what
   the asking user can access. This is the permission-aware-RAG hard part; it touches
   retrieval, citations (CITE-01), and workflows' folder scopes.
4. **Impersonation ("sign in as user")** — deferred from 148 with a named trigger; belongs
   with the roles work (it is a role-scoped capability with heavy audit).

## Why NOT in v3.3

PROJECT.md constraint: multi-tenancy sits at v3.4 (one-way door) — "nothing in v3.3 may make
the RLS rewrite harder; ship `org_id` stub columns where cheap, never schema shapes that
fight it." Inventing an in-app role/group system now, before the org/tenancy architecture
(isolated vs co-tenant, auth/billing) is decided, would be exactly such a shape.

# Phase 166: Org-Admin Shell + Org Switcher + Profile-Menu Anchor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-21
**Phase:** 166-Org-Admin Shell + Org Switcher + Profile-Menu Anchor
**Areas discussed:** G-2 sketch sequencing, Tab depth, Single-org UX, Settings IA split, Org-scoped Audit source/depth

---

## G-2 Sketch Sequencing (guardrail surfaced before deep discussion)

| Option | Description | Selected |
|--------|-------------|----------|
| Discuss now → sketch before planning | Lock scope/behavior gray areas here (no pixels needed), then `/gsd:sketch` before spec/plan; honors G-2 (mockup = acceptance bar) and feeds the sketch real decisions | ✓ |
| Sketch first, pause discussion | Stop and run `/gsd:sketch 166` now (strict G-2 order), resume discuss after | |
| Skip the sketch (override G-2) | Straight discuss → plan with no mockup; override logged | |

**User's choice:** Discuss now → sketch before planning.
**Notes:** No sketch exists for 166 (manifest checked); SEED-113 + ROADMAP flag it G-2 sketch-gated. The visual surfaces (profile menu, org switcher, shell layout) still get a mandatory sketch before spec/plan; this session locks the scope/behavior decisions the sketch needs as input.

---

## Tab depth — live vs locked placeholders (ADMIN-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Audit + Settings + Members(read-only) live; rest locked | 3 tabs with real data (audit_log, org-config home, org_members roster); the other 4 as LockedTab "coming soon" wired to 167/168/170 | ✓ |
| Also Departments/Roles read-only-live (4 live tabs) | Add a read-only dept tree + role list; editing still 167 | |
| Minimal: only Audit + Settings live | Members roster also defers to 167 | |

**User's choice:** Audit + Settings + Members(read-only) live; rest locked.
**Notes:** Scoped + honest; gives 167 (invitations/roles), 168 (SSO), 170 (subscription/retention) clean seams.

---

## Single-org UX — everyone has one personal org today (ADMIN-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Switcher only for 2+ orgs; shell reachable for your personal org | Solo users see just the identity anchor; org:manage on your personal org opens the shell (the 167 invitation bootstrap seam) | ✓ |
| Switcher always visible (static label when solo) | Always render org name; interactive only at 2+ orgs | |
| Switcher for 2+ orgs; shell hidden until org has 2+ members | No org-admin surface for a lone personal org | |

**User's choice:** Switcher only for 2+ orgs; shell reachable for your personal org.
**Notes:** Avoids the chicken-and-egg — you administer your org, then invite people (167). Solo population (100% today) gets zero switcher noise.

---

## Settings IA split — how aggressive now (ADMIN-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Light: personal sliver → profile; org-config home behind org:manage; defer global-knob relocation | Move identity/theme to profile menu, stand up org Settings tab, leave global knobs (already operator-gated) for the v3.5 config pass | ✓ |
| Full: relocate global knobs into the Control Room now | Resolve SEED-116 completely; more churn on a tenancy-identity phase | |
| Minimal: profile menu + org Settings shell only; touch existing Settings nothing | Structure only, relocate nothing | |

**User's choice:** Light split.
**Notes:** Per boundary-note F1, today's global knobs are already correctly operator-gated (not leaking); the per-user preference layer is Phase 167/VIS-02. Establish the three homes now, don't build the split twice. Bulk relocation → v3.5 (SEED-117 §1).

---

## Org-scoped Audit — source + depth (ADMIN-04)

| Option | Description | Selected |
|--------|-------------|----------|
| audit_log only; reuse AuditTab pattern; lighter list + chip filters (CSV deferred) | org:audit_view = cross-member org read; member-sees-own via RLS; excludes harness_audit + operator_audit_log | ✓ |
| audit_log only; full browser (filters + CSV) now | Match the operator AuditTab depth immediately | |
| audit_log + harness_audit merged | Include workflow-run audit rows | |

**User's choice:** audit_log only; reuse AuditTab pattern; lighter list + chip filters (CSV deferred).
**Notes:** Lighter cut fits a tenancy-identity phase; CSV + full-browser depth deferred to a later hardening pass.

---

## Claude's Discretion

- Exact `LockedTab` copy per deferred tab, the precise chip-filter set on the Audit list, and the read-only Members roster columns — implementation latitude within the locked scope.

## Deferred Ideas

- Bulk global-knob relocation (Settings → Control Room) → v3.5 config pass (SEED-117 §1)
- Invitations + adoption states → Phase 167 (INV-01/02)
- Role/dept editing + greenlists → Phase 167 (VIS-01)
- Per-user preference layer (`user_settings.preferences` revival) → Phase 167 (VIS-02)
- SSO (SAML) tab → Phase 168 (SSO-01)
- Subscription + Retention tabs → STRETCH Phase 170 (ENT-01/02)
- Dept-admin shell → STRETCH Phase 169 (ADMIN-06)
- Audit CSV export + full-browser depth → within-phase deferral to later hardening
- Visual composition (profile↔switcher merge, role-badge placement, shell entry point) → `/gsd:sketch 166` (G-2)

---
sketch: 079
name: identity-anchor-and-org-switcher
question: "How does the profile identity anchor compose with the org switcher (renders only at 2+ orgs) and the org-scoped role badge in the rail footer — one merged menu, separate elements, or hybrid — and where does the org-admin entry point live?"
winner: "C"
tags: [phase-166, admin-02, admin-03, org-switcher, profile-menu, role-badge, identity-anchor, nav-rail, rail-footer, tenancy, seed-113, g2-sketch-gate]
---

# Sketch 079: Identity Anchor + Org Switcher + Role Badge

## Winner — C (Hybrid) ★ (operator, 2026-07-21)

Identity + org-scoped **role badge** + the **org switcher** (renders only at 2+ orgs;
solo = quiet name button, D-166-02) live in ONE merged profile-menu popover in the
rail footer. The **org-admin entry point is a separate rail Shield-mirror**, sitting
directly parallel to the Phase-146 operator amber shield — the user-side "who am I /
my controls" mirror SEED-113 names, made spatial (indigo, distinct from operator
amber). Rationale locked: (1) mirrors SEED-113's stated operator-shield parity;
(2) stays calm for the 100%-today solo case; (3) cleanly splits *switch* (identity,
in the menu) from *manage* (a destination door, on the rail). **Role-badge copy =
`◆ Org-admin` / `Member`.** A (one merged button) = the calm runner-up; B (three
separate elements) = rejected as most-chrome + fragments the identity anchor.

## Design Question

The Phase 166 tenancy surface needs a **profile identity anchor** (ADMIN-03), an
**org switcher** that only appears at 2+ orgs (ADMIN-02, D-166-02), an **org-scoped
role badge** (Org-admin / Member), and an **entry point to the org-admin shell**
(gated on `org:manage`). D-166-05 leaves the *composition* undecided — it's the
sketch's job.

Grounded in the **real** shell: `NavPanel.tsx` is a left vertical rail (58px
collapsed / ~210px expanded) whose footer today holds only theme-toggle · the
probe-gated **amber operator shield** · a bare "Sign out." There is **no rich
profile anchor yet** and **no top bar** — so SEED-113's "top-right anchor" lands
as a **rail-footer identity element**. This sketch answers three D-166-05 questions
at once:

- **Q1 — Composition:** merged vs separate vs hybrid
- **Q2 — Role badge:** placement + copy (shown in the menu header in all variants)
- **Q3 — Entry point:** inside the menu vs a rail Shield-mirror (parallel to the
  operator amber shield)

## How to View

open .planning/sketches/079-identity-anchor-and-org-switcher/index.html

**Click the identity anchor** (bottom-left) to open the menu. Use the control strip
to flip **Solo ⇄ Multi org** (switcher appears only at 2+), **Org-admin ⇄ Member**
(role badge + admin-entry visibility), **Also operator** (shows the amber operator
shield so you can see the org entry coexist), and **Rail Expanded ⇄ Collapsed**.
In Multi mode, **pick a different org** to feel the org-switch teardown (D-166-08 —
tear down subscriptions → clear thread buckets → refetch; X-Org-Id revalidated
server-side).

## Variants

- **A: Merged anchor** — one rail-footer identity button opens a popover holding
  everything: identity + role badge, the org-switcher section (only at 2+ orgs),
  the **Organization admin** entry, theme, sign out. Fewest chrome elements; admin
  entry is one click deep. (Path of least resistance — extends the existing footer.)
- **B: Separate elements** — a distinct **org-switcher pill** (only at 2+ orgs) +
  the **identity avatar menu** + the **Organization** entry as its own rail item.
  Most discoverable, most chrome; the switcher is always visible when relevant.
- **C: Hybrid** — A's merged menu (identity + role + switcher section + sign out),
  **but the Organization entry is a rail item parallel to the operator amber
  shield** — the user-side "who am I / my controls" mirror of the operator shield
  (SEED-113's stated intent), made spatial.

## What to Look For

- **Solo is the 100%-today case** (D-166-02): does the resting surface stay quiet
  with zero switcher chrome? Flip to Solo and compare the three.
- **Member vs Org-admin:** the admin entry must *honestly vanish* for a member (no
  `org:manage`), not render disabled. Check each variant.
- **Does the org-admin entry read as "yours" (indigo) and clearly NOT operator
  (amber)?** Turn on "Also operator" — do the two shields fight or coexist?
- **Collapsed rail:** the anchor must still work icon-only (the real rail collapses).
- **Role-badge copy:** is `◆ Org-admin` / `Member` the right wording + weight?
- **Chrome budget vs discoverability:** A is calmest; B surfaces the switcher without
  a click; C keeps the admin entry where the operator brain already looks.

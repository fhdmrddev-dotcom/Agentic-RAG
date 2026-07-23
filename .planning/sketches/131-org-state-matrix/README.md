---
sketch: 131
name: org-state-matrix
question: "Do the identity anchor + org switcher + org-admin shell entry read honestly AND polished across all four cells of the state matrix (member/org-admin × solo/multi-org) — as one built-together set?"
winner: "C"
tags: [phase-177, orgux-01, org-admin-shell, org-switcher, identity-anchor, role-badge, state-matrix, honest-absent, family-cohesion, g2-sketch-gate]
---

# Sketch 131: Org State Matrix (ORGUX-01)

## Winner — C (Switcher + per-org role honesty) ★ (2026-07-23, delegated pick)

C is B's **unified org-identity primitive** (one avatar · org name · org-scoped role badge
reused identically in the rail anchor, menu header, shell band, and roster rows) **plus** the
underexplored honest state: **role is org-scoped.** Switch to Northwind → you're a **Member**
(the indigo shield vanishes); switch to Acme → **Org-admin** (it returns). Chosen because
ORGUX-01's mandate is precisely "polished **and honest across states** (member/org-admin,
1-org/multi-org)" — C is the only variant that makes per-org role legible, and it inherits B's
family-cohesion win. **B (unified primitive without per-org role) is the calm floor** if
per-org role switching proves heavier than the polish scope warrants at build time; A is the
faithful baseline. Amber stays reserved for the operator zone throughout (the "also operator"
foil confirms the two shields read as distinct zones).

## Design Question

Phase 177 is a **polish pass** over the ORGUX-01 surfaces that shipped in Phase 166
(sketched as **079-C** hybrid identity/switcher menu + **080-A** org-indigo 7-tab shell).
The requirement: those surfaces must read *polished **and** honest across states* —
**member vs org-admin** and **1-org (solo) vs multi-org**.

This sketch makes that literal: a **live state-matrix control strip** flips all four
cells (plus rail expanded/collapsed and an "also operator" foil), so you can watch the
honest behaviors hold:

- the **org-admin shield** in the rail footer must **honestly vanish** for a member
  (no `org:manage`) — never render disabled;
- the **org switcher** must appear **only at 2+ orgs** — solo stays a quiet name button
  (D-166-02, the 100%-today case);
- the **role badge** (`◆ Org-admin` / `Member`) must be one consistent element;
- the shell tab set is now **5 live + 2 locked** (Phase 167 unlocked Invitations & Roles,
  168 unlocked SSO — so 080-A's "4 locked" is now down to Subscription · Retention).

The primary lens is **family cohesion**: is the org-identity language one reused system,
or three look-alikes?

## How to View

open .planning/sketches/131-org-state-matrix/index.html

Use the **state-matrix strip** to flip Role · Orgs · Rail · View · Also-operator. Click the
**identity anchor** (rail footer) to open the menu; click the **indigo shield** or the menu's
**Organization admin** entry to enter the shell. In **Multi** mode, pick an org in the switcher.

## Variants

- **A: As-shipped faithful** — the shipped 079-C anchor + 080-A shell rendered across the
  matrix. Baseline: switcher, role badge, and shield-mirror behave exactly as built.
  (Path of least resistance.)
- **B: Unified org-identity primitive** — one reused identity block (avatar · org name ·
  org-scoped role badge) renders **identically** in the rail anchor, the menu header, and the
  shell band. The badge is *one component*, not three look-alikes. **The family-cohesion thesis.**
- **C: Switcher + per-org role honesty** — B's unified block, plus the underexplored multi-org
  truth: **your role is org-scoped.** Switch to Northwind → **Member** (shield vanishes);
  switch to Acme → **Org-admin** (shield returns). Role follows the org you're in.

## What to Look For

- **Member honesty:** flip Role → Member. The indigo shield and the menu's "Organization admin"
  entry must *disappear*, not grey out. (A member forced into the shell can't happen — the entry
  is gone.)
- **Solo calm:** flip Orgs → Solo. Zero switcher chrome — just a quiet name button.
- **One badge, everywhere:** in B/C, is `◆ Org-admin` / `Member` visibly the same element in the
  anchor, menu, band, and roster rows? Does that make the surface feel built-together?
- **Per-org role (C):** in Multi mode, does switching orgs honestly change your role and the
  shield's presence? Is that the right way to teach "role is per-org"?
- **Collapsed rail:** the anchor + shield must still work icon-only.
- **Operator coexistence:** flip Also-operator → On. Do the amber operator shield and the indigo
  org shield read as clearly different zones, or fight?

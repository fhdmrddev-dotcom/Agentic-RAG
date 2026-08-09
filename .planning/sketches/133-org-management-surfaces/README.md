---
sketch: 133
name: org-management-surfaces
question: "Do the invite dialog + invitations tab + SSO tab read as ONE polished family — shared status-chip vocabulary, one spacing rhythm, consistent honest-absent affordances, link-first success, and the victim-naming remove confirm?"
winner: "B"
tags: [phase-177, orgux-02, invite-dialog, invitations-tab, sso-tab, status-chips, honest-absent, victim-naming, family-cohesion, g2-sketch-gate]
---

# Sketch 133: Org Management Surfaces (ORGUX-02, in-app)

## Winner — B (One management language) ★ (2026-07-23, delegated pick)

The invite dialog, invitations tab, and SSO tab become one family: **one row anatomy**
(identity · role/meta · **one** status-chip component · honest-absent actions), **one 4px grid**,
**one chip vocabulary** — retiring `SsoTab`'s documented off-grid UPPERCASE-chip fork and the
duplicated chip maps. Every honest behavior is preserved: **honest-absent** affordances (gone,
not greyed), **link-first** delivery (dialog + resend both surface a copyable link), and the
**victim-naming** remove confirm (names the domain + its consequence). This is the family-cohesion
thesis the operator chose as the primary lens. **C's admin-vs-member side-by-side is really B's
read-only behavior demonstrated** — fold the honest-absent member view into B rather than ship
the split view. A is the faithful baseline that made the inconsistency visible.

## Design Question

The three in-app org-management surfaces shipped in Phases 167/168: the **invite dialog**
(`InviteMemberDialog` — email + role picker → link-first success), the **invitations tab**
(`InvitationsTab` — status chips + resend/revoke), and the **SSO tab** (`SsoTab` — create form,
status chips, victim-naming remove, SP-metadata well). They work — but reading the code, they
each **invented their own rhythm**: `SsoTab` documents an *intentional* off-grid spacing +
UPPERCASE tracked status chips, invitation rows carry avatars while SSO rows don't, and the two
tabs keep **separate copies of the same chip map**.

This is the primary **family-cohesion** sketch: can the three become one management language —
one row anatomy, one status-chip component, one 4px grid — while keeping every honest behavior
(honest-absent affordances, link-first delivery, the victim-naming remove confirm)?

## How to View

open .planning/sketches/133-org-management-surfaces/index.html

Flip **Surface** (Invitations · SSO · Invite dialog), **Viewer** (Org-admin ⇄ Member read-only),
and **Data** (Has items ⇄ Empty). In the dialog, click **Send invite** to reach the link-first
success. On a pending invite, **Resend** surfaces a fresh link; on an SSO row, **Remove** opens
the victim-naming confirm.

## Variants

- **A: As-shipped faithful** — the three surfaces exactly as built. The SSO chips go UPPERCASE +
  tracked on off-grid padding; invitation rows have avatars, SSO rows don't; the chip maps are
  duplicated. Baseline — makes the inconsistency visible.
- **B: One management language** — all three share one row anatomy (identity · role/meta · **one**
  status-chip component · honest-absent actions), one 4px grid, one chip vocabulary. Invite
  dialog, invitation rows, and SSO rows become siblings. **The cohesion thesis. (Recommended.)**
- **C: + honest-absent proof** — B's language, shown as **Org-admin** and **Member** side-by-side
  for the same surface. Every manage control (Send / Resend / Revoke / Add SSO / Remove /
  SP-metadata) is simply **absent** for a member — never a greyed button that lies (T-166-09).

## What to Look For

- **One chip, everywhere:** are Pending / Accepted / Active / Pending-approval / Disabled the same
  chip component across both tabs (B/C), instead of the SSO tab's UPPERCASE fork (A)? Does that
  alone make the surface feel built-together?
- **Honest-absent, not disabled:** flip Viewer → Member (or read C's right pane). The Send / Resend
  / Revoke / Remove / SP-metadata controls must be **gone**, not greyed. Is the member's read-only
  view still legible (empty-state copy adapts: "Invitations your organization sends will appear
  here")?
- **Link-first success:** the invite dialog and the Resend both surface a copyable link, not a
  "sent!" that hides the link. Consistent between the two?
- **Victim-naming remove:** the SSO remove names the domain and its consequence ("members who sign
  in with acme.com fall back to password"). Right weight for a destructive, no-undo action?
- **Row rhythm:** in B/C, do invitation and SSO rows sit on the same grid, or does one feel denser?

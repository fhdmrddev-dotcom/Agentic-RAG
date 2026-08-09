---
sketch: 080
name: org-admin-shell
question: "How does the 7-tab org-admin shell compose from the Control-Room band+tabs — what's the band's identity/warmth (org-indigo vs operator-amber vs a lighter page header), and how do the 3 live tabs (Members · Audit · Settings) + 4 locked placeholders read?"
winner: "A"
tags: [phase-166, admin-01, admin-04, admin-05, org-admin-shell, control-room-reuse, band-tabs, locked-tab, members-roster, org-audit, settings-ia, tenancy, g2-sketch-gate]
---

# Sketch 080: Org-Admin Shell (7 tabs)

## Winner — A (Org-indigo band) ★ (operator, 2026-07-21)

The org-admin console reuses the **061-B Control-Room band+tabs shape**, tinted in the
**org identity indigo** (matching 079-C's rail shield) — **amber stays reserved for the
operator zone** (using it here would misread the user's own org home as a privileged
danger zone). The band carries: org name + `ORG ADMIN` chip + `◆ Org-admin` role badge +
the 062-A **"every action recorded"** marker + plain-first **⌥ Technical-names** (146
LANG-01). **7 tabs: 3 live (Members read-only 068-A roster · Audit lighter-067-A cut ·
Settings light org-config home) + 4 locked** (Invitations & Roles · SSO · Subscription ·
Retention) as honest "coming soon" `LockedTab` placeholders — **no roadmap numbers in
copy** (061-B). Audit honesty is load-bearing: `org:audit_view` unlocks cross-member; its
absence shows an explicit "you see only your own (RLS)" banner, never a silent empty list.
B (amber-mirror) = rejected (misreads as operator); C (lighter header) = rejected (drops
the recording-marker honesty + the felt zone-crossing).

## Design Question

Reached via the **079-C rail Shield-mirror**, the org-admin console is a **7-tab
shell composed from the shipped Control-Room band+tabs** (061-B). This sketch
settles the composition:

- **Band warmth (the main axis):** org-indigo (matching 079-C's shield) vs. a
  literal operator-amber mirror vs. a lighter Settings-style page header.
- **Live tabs:** Members (read-only roster, 068-A instrument table), Audit
  (org-scoped `audit_log`, a lighter 067-A cut — list + chip filters, no CSV),
  Settings (the light org-config home behind `org:manage`).
- **Locked tabs:** Invitations & Roles · SSO · Subscription · Retention render as
  honest "coming soon" placeholders (the `LockedTab` precedent) — **no roadmap
  numbers in copy** (the 061-B rule); the phase wiring stays internal.

Grounded in real decisions: D-166-01 (3 live + 4 locked), D-166-04 (`audit_log`
only; `org:audit_view` unlocks cross-member; member-sees-own via RLS; excludes
`harness_audit`/`operator_audit_log`), D-166-03 (light Settings split — bulk
global-knob relocation deferred to v3.5), and the 069-A/SEED-115 extensible-audience
lineage (this org shell is the user-facing sibling of the operator surfaces).

## How to View

open .planning/sketches/080-org-admin-shell/index.html

**Click the 7 tabs** — 3 live, 4 locked. Toggle **Cross-member audit** (with/without
`org:audit_view`) on the Audit tab to see the honest "you see only your own activity"
degrade (RLS). Toggle **Labels: Plain ⇄ ⌥ Technical** to reveal the table/source
names (the 146 LANG-01 two-audience pattern). Switch the band variant (A/B/C) at top.

## Variants

- **A: Org-indigo band** — the Control-Room band+tabs shape tinted in the org
  identity indigo (matching 079-C's rail shield); amber stays reserved for the
  operator zone. Org name + `ORG ADMIN` chip + role badge + "every action recorded"
  marker + plain-first ⌥ Technical-names. **(Recommended — consistent with 079-C.)**
- **B: Amber-mirror band** — literally the operator band styling, differentiated only
  by glyph + label. Foil: does amber wrongly read as "operator / danger zone" for
  what is really the user's own org home?
- **C: Lighter page header** — no full band, just an org title + role + Back, then
  tabs. Calmer, reads like a Settings page — but loses the recording-marker honesty
  and the "crossing into a governed zone" felt moment.

## What to Look For

- **Does amber (B) misread as operator?** The org shell is the user's *own* home, not
  a privileged operator zone — indigo (A) keeps that distinction the app already uses.
- **Is the audit honesty legible?** Flip `org:audit_view` off — the banner + row
  filtering must make "you only see your own" obviously true, not silently empty.
- **Do the locked tabs feel honest, not broken?** "Coming soon" + a plain sentence of
  what's coming, no phase numbers — a clean seam for 167/168/170 to fill.
- **Members is read-only** — the invite/edit affordances must be *absent*, with the
  banner pointing at the (locked) Invitations tab, not a disabled button that lies.
- **Recording marker + zone-crossing:** A/B carry the 062-A "every action recorded"
  promise; C drops it. Is that honesty worth the extra chrome here?

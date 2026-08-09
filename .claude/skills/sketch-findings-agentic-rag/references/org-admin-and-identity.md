# Org-Admin Shell & Identity (Phase 166)

The human-facing surface of the now-real tenancy model (v3.4 crux 163 + isolation 164 + `is_global` retirement 165 all shipped): a profile identity anchor + org switcher + role badge in the rail footer, and the 7-tab org-admin console reached from it. Reuses the shipped Control-Room shell (061-B band+tabs, `LockedTab`, plain-first + ⌥ Technical-names), the 068-A instrument roster, and a lighter 067-A audit cut. Grounded in the LIVE `NavPanel.tsx` — a left vertical rail (58px collapsed / ~210px expanded) whose footer today holds only theme-toggle · the probe-gated **amber operator shield** · a bare "Sign out"; there is **no rich profile anchor and no top bar**, so SEED-113's "top-right anchor" lands as a **rail-footer element**.

## Design Decisions

### D1 — Identity = merged menu + org-admin as a rail Shield-mirror (079 winner C — hybrid)
Identity + the org-scoped **role badge** + the **org switcher** (renders only at 2+ orgs; solo = a quiet name button, D-166-02) live in ONE merged profile-menu popover in the rail footer. The **org-admin entry point is a separate rail Shield-mirror**, sitting directly **parallel to the Phase-146 operator amber shield** — the user-side "who am I / my controls" mirror SEED-113 names, made spatial in **indigo** (distinct from operator amber). Cleanly splits *switch* (identity, in the menu) from *manage* (a destination door, on the rail).

- **Won over A (one merged button):** the calm runner-up — admin entry one click deep inside the menu.
- **Won over B (three separate elements):** most chrome, fragments the identity anchor.

### D2 — Solo is the 100%-today case → zero switcher chrome (079, D-166-02)
The org switcher **renders only at 2+ orgs**; a solo user sees a quiet name button, no switcher. The resting surface stays calm for everyone today. Role-badge copy = **`◆ Org-admin` / `Member`**.

### D3 — The admin entry HONESTLY VANISHES for a member (079)
Without `org:manage`, the org-admin entry is **absent**, not rendered-disabled. Never show a disabled door that lies about a capability the user doesn't have.

### D4 — Org-switch teardown order is load-bearing (079, D-166-08)
Picking a different org tears down subscriptions → clears thread buckets → refetches (X-Org-Id revalidated server-side). Preserves the 067.5 Branch-D3 clear-guard — `<OrgContext>` stays OUTSIDE the stream path so the switch never corrupts a live stream.

### D5 — Org-admin shell = org-indigo band+tabs; amber stays operator-only (080 winner A)
The 7-tab console reuses the **061-B Control-Room band+tabs shape tinted org-indigo** (matching 079-C's rail shield) — **amber is reserved for the operator zone** (using it here would misread the user's own org home as a privileged danger zone). The band carries: org name + `ORG ADMIN` chip + `◆ Org-admin` role badge + the 062-A **"every action recorded"** marker + plain-first **⌥ Technical-names**.

- **Won over B (amber-mirror band):** rejected — amber wrongly reads as operator/danger for the user's own org home.
- **Won over C (lighter page header):** rejected — drops the recording-marker honesty + the felt zone-crossing.

### D6 — 3 live + 4 honest locked tabs, no roadmap numbers (080, D-166-01)
Live: **Members** (read-only 068-A roster) · **Audit** (a lighter 067-A cut — list + chip filters, no CSV) · **Settings** (light org-config home behind `org:manage`). Locked: **Invitations & Roles · SSO · Subscription · Retention** as honest "coming soon" `LockedTab` placeholders — **no roadmap numbers in copy** (the 061-B rule); a clean seam for 167/168/170 to fill.

### D7 — Audit degrades RLS-honest, never silent-empty (080, D-166-04)
`org:audit_view` unlocks cross-member audit (`audit_log` only — excludes `harness_audit` / `operator_audit_log`); its **absence shows an explicit "you see only your own (RLS)" banner**, never a silently empty list. Members-see-own is enforced by RLS.

### D8 — Members is read-only; affordances absent, not disabled (080)
The invite/edit affordances are **absent** on the read-only roster, with a banner pointing at the (locked) Invitations tab — never a disabled button that lies about a capability.

## What to Avoid

- **Amber for the org zone** — indigo keeps the user's-own-home vs operator-danger distinction the app already uses (D5).
- **A disabled admin door for a member** — it vanishes honestly (D3); same for Members' invite affordances (D8).
- **Switcher chrome for a solo user** — renders only at 2+ orgs (D2).
- **A silently-empty audit list** — degrade RLS-honest with an explicit banner (D7).
- **Roadmap numbers in "coming soon" copy** — plain sentences of what's coming (D6, the 061-B rule).
- **`<OrgContext>` inside the stream path** — keep it outside; preserve the 067.5 Branch-D3 clear-guard on org-switch (D4).

## Origin

Synthesized from sketches **079-identity-anchor-and-org-switcher** (winner C — hybrid: merged identity+switcher menu + org-admin as a rail Shield-mirror) and **080-org-admin-shell** (winner A — org-indigo band+tabs; 3 live + 4 honest locked; RLS-honest audit). Source files: `sources/079-identity-anchor-and-org-switcher/`, `sources/080-org-admin-shell/`. Session 2026-07-21 (Phase 166, ADMIN-01..05). Reuses the 061-B band+tabs + `LockedTab`, the 062-A recording marker, the 068-A roster, a lighter 067-A audit cut, and the 069-A/SEED-115 extensible-audience lineage (this org shell is the user-facing sibling of the operator surfaces). Feeds the v3.5 Phase 177 org-surface polish (ORGUX-01/02).

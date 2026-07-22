# Phase 166: Org-Admin Shell + Org Switcher + Profile-Menu Anchor - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning — **G-2 sketch gate SATISFIED** (sketches [079-C](../../sketches/079-identity-anchor-and-org-switcher/README.md) + [080-A](../../sketches/080-org-admin-shell/README.md), operator-approved 2026-07-21)

<domain>
## Phase Boundary

Ship the **human-facing surface** of the now-real tenancy model (163 crux + 164 isolation + 165 `is_global` retirement all shipped): a profile-menu identity anchor (ADMIN-03), an org switcher that safely swaps active-org context (ADMIN-02), a 7-tab org-admin shell reusing the v3.3 Control-Room shell as composition (ADMIN-01), an org-scoped audit view (ADMIN-04), and the light Settings IA split that establishes the three homes (ADMIN-05).

**This phase is UI + a thin authz-enforcement layer.** It does NOT add invitations, role/dept editing, SSO, entitlements, or the per-user preference layer — those are owned by later phases and appear here only as locked "coming soon" tab placeholders. The org-switch *mechanism* (JWT membership + validated `X-Org-Id`) and the Settings *boundary rule* are already decided upstream; this phase implements the surface, not the policy.
</domain>

<decisions>
## Implementation Decisions

### Tab depth — live vs locked placeholders (ADMIN-01)
- **D-166-01:** The 7-tab org-admin shell ships **3 tabs LIVE** with real data:
  - **Members** — read-only roster over `org_members` (mig 104). No invite/role editing (that's 167).
  - **Audit** — org-scoped audit (see D-166-04).
  - **Settings** — the org-config home behind `org:manage` (see D-166-03).
  The other **4 tabs render as locked "coming soon" placeholders** via the existing `LockedTab` precedent, each wired/labeled to its owning phase: **Invitations/Roles → Phase 167**, **SSO → Phase 168**, **Subscription + Retention → STRETCH Phase 170**. Rationale: keep 166 scoped to tenancy identity + honest about what's real, and give 167/168/170 a clean seam to fill.

### Single-org UX — everyone has exactly one personal org today (ADMIN-02)
- **D-166-02:** The org **switcher renders only when the user belongs to 2+ orgs.** Single-org users (100% of the population post-162 backfill) see just the profile identity anchor — no switcher chrome. The **org-admin shell IS reachable for a user's personal org** when they hold `org:manage` (they are the org-admin of their own personal org by the 162 backfill). This is deliberate: it is the **bootstrap seam** Phase 167 invitations build on — you administer your org, then invite people into it. Avoids a chicken-and-egg where no org can be administered until it already has members.

### Settings IA split — how aggressively (ADMIN-05)
- **D-166-03:** **Light split this phase.** Carve the clearly-personal sliver (identity / theme; the profile menu is the natural home) out to the **profile menu**, and stand up the **org-config home behind `org:manage`** (the Settings tab in the shell). **Defer the bulk relocation** of the existing global config knobs (Settings → Control Room) to the **v3.5 config pass (SEED-117 §1)**. Rationale: per the boundary note's F1 reframe, today's global knobs are already correctly operator-gated (not leaking); the per-user preference layer (`user_settings.preferences` revival) is explicitly **Phase 167 / VIS-02**, not here; a big relocation would add churn/risk on a phase whose center is tenancy identity. The rule is: **establish the three homes now, move the obviously-personal bits, don't build the split twice.**

### Org-scoped Audit — source + depth (ADMIN-04)
- **D-166-04:** Back the member-facing Audit tab with **`public.audit_log` ONLY** (the general per-user action log, now `org_id`-carrying via the 161/162 backfill). Access model: **`org:audit_view` unlocks the cross-member org read** (all rows within the org); a member without it **sees only their own rows** (RLS already enforces the member-sees-own half). **Reuse the operator `AuditTab` component shape but a lighter first cut** — list + chip filters; **CSV export deferred**. **Exclude** `harness_audit` (workflow-internal, noisy) and `operator_audit_log` (Control-Room-only).

### Sketch-resolved visual decisions (G-2 — RESOLVED by sketches 079-C + 080-A, 2026-07-21)
- **D-166-05:** The visual composition is now **operator-approved** (mockups were the acceptance bar). LOCKED:
  - **Profile ↔ org switcher composition → 079-C (Hybrid).** Identity + org-scoped **role badge** + the **org switcher** (renders only at 2+ orgs; solo = a quiet name button, no switcher chrome per D-166-02) live in **ONE merged rail-footer profile-menu popover** (the footer where "Sign out" lives today in `NavPanel.tsx`; there is no top bar — SEED-113's "top-right anchor" lands as a rail-footer element). The org switch preserves the D-166-08 teardown (subscriptions → thread-bucket clear → refetch).
  - **Role-badge placement + copy → in the profile-menu header AND the shell band; copy = `◆ Org-admin` / `Member`** (indigo `admin` chip / muted `member` chip).
  - **Org-admin shell entry point → 079-C: a rail Shield-mirror** rendered OUTSIDE `NAV_ITEMS`, sitting **directly parallel to the Phase-146 operator amber shield**, in **indigo** (distinct from operator amber) — the SEED-113 "user-side mirror" made spatial. Shown only when the caller holds `org:manage`; honestly absent (never disabled) for a Member.
  - **Shell composition → 080-A (Org-indigo band).** The 7-tab shell reuses the 061-B Control-Room band+tabs, tinted **org-indigo** (amber stays reserved for the operator zone); band carries org name + `ORG ADMIN` chip + role badge + the 062-A "every action recorded" marker + plain-first **⌥ Technical-names** (146 LANG-01). **3 live tabs** (Members read-only 068-A roster · Audit lighter-067-A list+chips, no CSV · Settings light org-config home) **+ 4 locked** "coming soon" `LockedTab` placeholders (Invitations & Roles · SSO · Subscription · Retention) with **no roadmap numbers in copy** (061-B). The `org:audit_view` degrade is **RLS-honest** — an explicit "you see only your own" banner + row filtering, never a silent empty list.
  - **Sketch findings (build spec):** [`079-identity-anchor-and-org-switcher/README.md`](../../sketches/079-identity-anchor-and-org-switcher/README.md) + [`080-org-admin-shell/README.md`](../../sketches/080-org-admin-shell/README.md); shared theme tokens mirror `frontend/src/index.css :.dark`.

### Locked upstream — carried forward, do NOT re-decide (landmines for the planner)
- **D-166-06:** Org-switch mechanism is **hybrid**: membership set baked into the JWT for RLS **+ a server-validated `X-Org-Id` header** for the active org. The `X-Org-Id` header **MUST be server-validated against the caller's membership** (threat-model item — never trust the client's claimed active org).
- **D-166-07:** `<OrgContext>` / `<OrgProvider>` **wraps OUTSIDE `<StreamsProvider>`** (today `App.tsx:209` mounts `StreamsProvider` as the outer wrapper — the new org provider goes above it).
- **D-166-08:** An org switch **tears down in-flight subscriptions + refetches**; Realtime is best-effort, **never the isolation boundary**. The teardown **MUST preserve the Phase-067.5 Branch-D3 `clearThreadBucket` guard** in `StreamsProvider.tsx` (G-5 hot file — do not regress the per-thread clear).
- **D-166-09:** Permission enforcement (`org:manage` for the shell, `org:audit_view` for the cross-member audit read) routes through the **`current_user_has_permission()` SQL helper** shipped in mig 104. **No backend route calls this helper yet** — the enforcement layer is **net-new this phase** (mirror the `admin.py` gate shape, but gate on `current_user_has_permission('org:manage')` rather than `require_operator`).

### Claude's Discretion
- Exact `LockedTab` copy per deferred tab, the precise chip-filter set on the Audit list, and the shape of the read-only Members roster columns are implementation latitude (no "you decide" was invoked, but these are unspecified within the locked scope).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap / requirements
- `.planning/ROADMAP.md` — v3.4 active section, **Phase 166 detail** (goal, SC 1–5, flags: SC#10 / G-2 sketch / G-5 StreamsProvider / threat model X-Org-Id + audit authz).
- `.planning/REQUIREMENTS.md` — **ADMIN-01..05** definitions + traceability (all → Phase 166).
- `.planning/PRDs/SEQUENCE.md` — authoritative v3.x version map (why global-knob relocation is v3.5, not here).

### Settings IA — governs ADMIN-05 (MUST read before planning the split)
- `.planning/notes/settings-control-room-boundary.md` — **THE boundary decision**: three surfaces (Control Room / Settings / Profile menu), the one-pattern-per-knob rule, and the **F1 reframe** (today's Settings is already global + operator-gated → Settings shrinks to a personal sliver).
- `.planning/notes/dynamic-control-inventory.md` — the exhaustive per-knob decision table (which knob lives where; scopes the "what's obviously personal vs deferred-global" call).

### Identity anchor — governs ADMIN-03
- `.planning/seeds/SEED-113-user-profile-menu-general-settings.md` — the identity-anchor shape; the **full v3.4 shape** (role/tier badge, org switcher, SSO/SCIM-ready); the G-2 gate.
- `.planning/seeds/SEED-116-control-room-settings-boundary-dynamic-control-inventory.md` — resolved; origin/context of the boundary decision.

### Frontend code (reuse + landmines)
- `frontend/src/App.tsx` — provider tree; **`<OrgProvider>` mounts OUTSIDE `<StreamsProvider>` (line 209)**; the `useOperatorProbe` / `useEffectiveFeatures` per-session probe + identity-threading pattern to mirror for an `org:manage` probe.
- `frontend/src/providers/StreamsProvider.tsx` — **G-5 HOT FILE**; org-switch teardown must preserve the **067.5 Branch-D3 `clearThreadBucket` guard**.
- `frontend/src/components/admin/ControlRoomPage.tsx` + `OperatorBand.tsx` — the shell composition to reuse for the 7-tab org-admin shell + the identity band.
- `frontend/src/components/admin/AuditTab.tsx` — the audit-browser pattern to reuse (lighter) for ADMIN-04.
- `frontend/src/components/admin/UsersAndAccess.tsx` — the roster pattern for the read-only Members tab.
- `frontend/src/components/admin/LockedTab.tsx` — the "coming soon" locked-placeholder precedent for the 4 deferred tabs.
- `frontend/src/hooks/useOperatorProbe.ts` + `frontend/src/hooks/useEffectiveFeatures.ts` — the App-level, per-session, user-id-keyed probe pattern to mirror for `org:manage`.
- `frontend/src/pages/SettingsPage.tsx` — the Settings IA split target (currently whole-page operator-gated per F1).
- `frontend/src/hooks/useAuth.ts` — the identity source (`user.email` / `user.id`) for the profile anchor.

### Backend / DB
- Supabase migration **104** — 8 org tables + **`current_user_has_permission()`** SECDEF helper + the seeded permission catalog (**`org:manage`, `org:audit_view`, `org:invite`, `dept:manage`**). The authz substrate; **no route calls the helper yet** (enforcement is net-new here).
- `public.audit_log` — the per-user action log, **now `org_id`-carrying** (161/162 backfill); the ADMIN-04 source.
- `backend/app/api/admin.py` — the operator router gate shape to mirror (but gate on `current_user_has_permission('org:manage')`, not `require_operator`).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Control-Room shell** (`ControlRoomPage.tsx` + `OperatorBand.tsx` + tab components) — direct composition source for the 7-tab org-admin shell.
- **`AuditTab.tsx`** — the audit list/filter pattern; take a lighter cut for the member-facing org audit.
- **`UsersAndAccess.tsx`** — roster rendering for the read-only Members tab.
- **`LockedTab.tsx`** — the exact "coming soon" locked-placeholder for Invitations/Roles, SSO, Subscription, Retention.
- **`useOperatorProbe` / `useEffectiveFeatures`** — the per-session, user-id-keyed, fail-closed probe pattern to clone for an `org:manage` (and `org:audit_view`) probe.

### Established Patterns
- **Probe-gated render** — the operator amber-shield renders OUTSIDE `NAV_ITEMS`; the org-admin entry likely mirrors this (final placement = sketch).
- **Single probe per authenticated session, keyed to `user?.id`** (`App.tsx:137/144`) — re-probes on SPA sign-in, clears on sign-out; the org probe follows the same lifecycle.
- **Provider nesting in `App.tsx`** — StreamsProvider is the outer wrapper today; the org provider goes ABOVE it (D-166-07).
- **Three-surface Settings boundary** — the decided rule; the light split conforms to it without rebuilding it later.

### Integration Points
- New **`<OrgProvider>`** in `App.tsx` wrapping outside `<StreamsProvider>`; exposes active org + membership set + `switchOrg()`.
- New **`org:manage` probe hook** (mirror `useOperatorProbe`) gating the shell entry + shell mount.
- **`X-Org-Id` header injection** in the `api.ts` client (active org), **server-validated** against membership backend-side.
- New **org-admin router** (mirror `admin.py`'s gate, gate on `current_user_has_permission('org:manage')`); the audit endpoint additionally scopes by `org:audit_view`.
- **Org-switch teardown** hooks into `StreamsProvider` reusing the 067.5 `clearThreadBucket` guard (D-166-08).
</code_context>

<specifics>
## Specific Ideas

- The profile identity anchor is explicitly the **user-side mirror of the Phase-146 operator amber-shield** — same "who am I / my controls" anchoring, tasteful top-right, designed forward for the org switcher + role badge (SEED-113).
- The org-admin shell is a **composition of the shipped Control-Room shell**, not a new shell — reuse `ControlRoomPage`/`OperatorBand`/tab scaffolding.
- The org Audit is intentionally **lighter than the operator `AuditTab`** (list + chip filters, no CSV) — this phase's center is tenancy identity, not an audit console.
</specifics>

<deferred>
## Deferred Ideas

- **Bulk global-knob relocation (Settings → Control Room)** → v3.5 config pass (SEED-117 §1). 166 establishes the three homes but moves only the personal sliver.
- **Invitations (email + link), adoption states on the roster** → Phase 167 (INV-01/INV-02); the Invitations/Roles tab is a locked placeholder here.
- **Role / department management (editing), greenlists** → Phase 167 (VIS-01); read-only dept/role display was considered and cut from 166 (Members is read-only; Departments/Roles is a locked placeholder).
- **Per-user preference layer** (`user_settings.preferences` revival; per-user model default within the org-allowed set) → Phase 167 (VIS-02).
- **SSO tab (SAML 2.0)** → Phase 168 (SSO-01); locked placeholder here.
- **Subscription + Retention tabs** (entitlements + retention/rate-limit data layer) → STRETCH Phase 170 (ENT-01/02); locked placeholders here.
- **Dept-admin shell** → STRETCH Phase 169 (ADMIN-06).
- **Audit CSV export + full-browser depth** → deferred within-phase to a later hardening pass (lighter cut ships now).
- **Visual composition** (profile ↔ switcher merge, role-badge placement, shell entry point) → `/gsd:sketch 166` (G-2, D-166-05).

### Reported Bugs cross-check
No open `surface: Agentic-RAG` bug overlaps this phase's domain. Three keyword-adjacent hits (`BUG-260610-01` workflow-run nav timer, `cancelled-run-stop-indicator-lost-on-navigation`, `setting-up-agent-hides-model-activity`) are chat/streaming-surface bugs already routed to the deferred post-v3.3 chat-polish phase — left there per the roadmap's explicit ruling that the chat-surface backlog stays OUT of v3.4.
</deferred>

---

*Phase: 166-Org-Admin Shell + Org Switcher + Profile-Menu Anchor*
*Context gathered: 2026-07-21*

# Phase 167: Invitations + Roles + Greenlists + JIT + Per-User Prefs - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning (G-2 sketch: light — extends 166's shipped design system; see decision note)

<domain>
## Phase Boundary

The governance + onboarding projection of the now-real tenancy model (163/164/165 shipped, 166 UI shipped). This phase makes the **166 "Invitations & Roles" locked tab LIVE** and delivers four capabilities:

- **INV-01 — Invitations:** an org-admin (with `org:invite`) invites teammates into **their** org by email + link; recipients accept via sign-in or sign-up and **join that org**; adoption states (not-yet-invited / pending / active) render on the roster.
- **INV-02 — JIT provisioning:** the signup / SSO-callback path creates the `org_members` row **idempotently** (`INSERT … ON CONFLICT DO NOTHING` + advisory lock) so concurrent first-logins converge to exactly one membership.
- **VIS-01 — Greenlists:** generalize the shipped binary `{audience: everyone|operators}` feature-visibility map into per-feature **role/group greenlists**, resolved through the SAME one swappable `require_visible` function (v3.3), with a Glean precedence-merge rule (highest role wins for primary tier, union for secondary grants).
- **VIS-02 — Per-user preferences:** revive the dead `user_settings.preferences` column under the SEED-116 two-layer pattern — a user picks a default WITHIN the operator/org-allowed set, honoring operator lock flags.

**This phase is UI + backend app-code — NOT schema.** The `org_invitations` table (mig 104), the `feature_visibility` JSONB map (mig 098), and `user_settings.preferences` (mig 011) all already exist and were built forward-compatibly. NO migration is expected (the ONE possible exception is the INV-02 JIT seam if implemented as a DB trigger change rather than app-layer — a research decision, D-167-05).
</domain>

<decisions>
## Implementation Decisions

### Invited-user behavior — someone who already has their own account/org (D-167-01)
- **D-167-01:** **Join additively — keep both.** When a user who already has their own personal org accepts an invite, they **keep their personal org AND join the inviting org** → they now belong to 2+ orgs and the **166 org switcher** (already shipped) lets them flip between. Non-destructive; nothing they had is lost. This is exactly what the switcher + additive `<OrgProvider>` were built for. (Rejected: absorbing/hiding their personal org — destructive.)

### Invitation delivery (D-167-02)
- **D-167-02:** **Link-first + log/copy, email via env-switch.** Generate a secure invite link (hashed token in `org_invitations.token_hash`, raw token NEVER stored — T-161-04); the app surfaces/logs the link for the inviter to copy and share. **No email service or API keys required by default** (works self-hosted / offline). Real email delivery (`resend` / SES) turns on via the env-switched provider (the `resend`/SES/`none`-log contract already named in INV-01). The `none`-log provider is the default.

### Invite role assignment (D-167-03)
- **D-167-03:** **Member default + optional Org-admin.** The inviter picks the invitee's role at send time: **Member (default)** or optionally **Org-admin**. **Dept-admin is greyed-out** until departments go live (Phase 169; the `org_invitations.role` CHECK already permits it schema-side, but the UI does not offer it this phase). Writes to `org_invitations.role`; gated by `org:invite`.

### VIS-02 first preference instance (D-167-04)
- **D-167-04:** **Default model within the allowed set** is the concrete first preference. A user picks their own default AI model from the operator/org-permitted set; the operator can **lock** it (SEED-116 two-layer pattern: operator governs the allowed-set + lock; user picks within it; visibility privilege-gated). Revives `user_settings.preferences` (dead since mig 011). This is the exact "first instance" the roadmap names — it proves the two-layer pattern end-to-end. (Rejected: shipping a broader preferences bundle now — more surface to get right in one phase.)

### Locked upstream — carried forward, do NOT re-decide (landmines for the planner)
- **D-167-05 (JIT seam — RESEARCH FLAG):** INV-02 idempotent membership creation on signup/SSO-callback = `INSERT … ON CONFLICT DO NOTHING` + a Postgres **advisory lock** so concurrent first-logins converge to one membership. **Whether this lives in a DB trigger (extending mig 105's `handle_new_user`), the app-layer signup/callback handler, or both is a research decision** — the "personal-org / JIT seam boundary" flagged in the roadmap. If a trigger change is chosen, that is the ONE possible small migration this phase; otherwise ZERO migrations. The signup path must also honor a **pending invitation** (join THAT org) instead of always auto-creating a personal org (mig 105 default) — the invited-vs-fresh-signup fork.
- **D-167-06 (VIS-01 zero-migration):** the `feature_visibility` map (mig 098) is a JSONB `app_settings` column deliberately shaped so `{audience: operators|everyone}` extends to `{audience: role, roles:[...]}` (and group grants) with **zero migration**. Generalize the shape + the `require_visible` resolver ONLY — do not add a table. Precedence-merge: highest role wins for the primary tier, union for secondary grants (Glean model).
- **D-167-07 (invitations home = the 166 org shell):** the org-admin manages invitations from the **166 org-admin shell's "Invitations & Roles" tab** (currently a LockedTab placeholder — this phase makes it LIVE) + adoption-state chips on the **166 Members roster** (currently read-only — this phase adds invite affordances + pending/active states). The operator Phase-148 roster is NOT the org-admin's invitation home (that stays operator-scope). The requirement's "Phase-148 roster" phrasing = reuse the roster PATTERN, rendered in the org shell.
- **D-167-08 (security — carry forward from 166/161):** `org:invite` gates invitation writes (mig 104 policy already exists); `token_hash` never leaves `org_invitations` (raw token only in the link, T-161-04); every org-scoped route reuses the 166 `get_active_org_id` server-validated `X-Org-Id` + `require_org_manage`/`org:invite` gates; invitation tokens need expiry + single-use enforcement (threat-model item — token/expiry + the JIT advisory-lock race).
- **D-167-09 (SC#10):** VIS-02 model-default = provider routing → cross-provider mandate applies (the user's chosen default must route correctly across OpenAI/Anthropic/Google/OpenRouter); greenlist changes = UI state. Deep Mode stays byte-identical (D-14).

### Claude's Discretion
- The exact invite-modal layout, the adoption-state chip copy/colors (reuse 166's chip vocabulary), the greenlist admin surface shape, the resend/revoke affordances, and the precise `user_settings.preferences` JSON key for the model default are implementation latitude within the locked scope.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap / requirements
- `.planning/ROADMAP.md` — v3.4 active section, **Phase 167 detail** (goal, SC 1–4, flags: SC#10 / threat model token+JIT-race / G-2 if visual / UI hint; Depends on 161 + 166).
- `.planning/REQUIREMENTS.md` — **INV-01, INV-02, VIS-01, VIS-02** definitions + traceability (all → Phase 167).

### Settings IA / two-layer preference pattern — governs VIS-02
- `.planning/notes/settings-control-room-boundary.md` — the three-surface boundary + the one-pattern-per-knob rule (operator governs allowed-set + lock → user picks preference → visibility privilege-gated). VIS-02's model-default is the "models are the first instance" case this note names.

### Schema already in place (reuse — do NOT recreate)
- `supabase/migrations/104_org_dept_role_schema.sql` — **`org_invitations` is COMPLETE** (id/org_id/email/role-CHECK/token_hash/status['pending','accepted','expired','revoked']/expires_at/invited_by) + the `org:invite` write policy + the `role_permissions` seed (org-admin holds `org:invite`). The invitations substrate is DONE.
- `supabase/migrations/098_feature_visibility.sql` — the `feature_visibility` JSONB `app_settings` map, **designed to extend to `{audience:'role',roles:[...]}` with zero migration** (VIS-01).
- `supabase/migrations/011_cleanup_user_settings.sql` — `user_settings.preferences jsonb DEFAULT '{}'` (VIS-02 revives this — no migration).
- `supabase/migrations/105_personal_org_backfill.sql` — the `handle_new_user` trigger (auto-creates a personal org on signup) — the seam INV-02's JIT must fork on a pending invitation.

### 166 code to extend (the shipped seam this phase fills)
- `frontend/src/components/org/OrgAdminShell.tsx` — the 7-tab shell; the **"Invitations & Roles" LockedTab becomes LIVE** here.
- `frontend/src/components/org/OrgMembersTab.tsx` — the read-only roster; gains invite affordances + adoption-state chips.
- `frontend/src/providers/OrgProvider.tsx` + the org switcher — the additive multi-org mechanism a newly-accepted invitee lands in (D-167-01).
- `backend/app/api/org.py` + `backend/app/dependencies.py` — the org router + `get_active_org_id`/`require_org_manage`; add invitation endpoints gated on `org:invite`.

### VIS-01 resolver to generalize
- `backend/app/dependencies.py::require_visible` (v3.3, Phase 148) + `backend/app/api/features.py` — the ONE swappable feature-visibility function to extend from binary audience → role/group greenlists (do NOT fork it).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (this phase is mostly composition + resolver-extension)
- **`org_invitations` table** — complete; invitation CRUD is pure app-code over it.
- **166 org shell + Members roster** — the Invitations tab + adoption chips extend shipped components.
- **166 `OrgProvider` + org switcher** — an accepted invitee becomes a 2-org user; the switcher already handles it (D-167-01).
- **`require_visible` (VIS-01 v3.3)** — the single resolver to generalize to greenlists (D-167-06).
- **`user_settings.preferences`** — the existing column VIS-02 revives (D-167-04).
- **`handle_new_user` trigger (mig 105)** — the JIT seam to fork on a pending invitation (D-167-05).

### Integration Points
- New invitation endpoints in `org.py` (send/list/resend/revoke/accept) gated on `org:invite`; the accept path threads into the JIT membership create.
- The signup/SSO-callback path checks `org_invitations` for a pending, non-expired token → joins that org idempotently instead of auto-creating a personal org.
- `require_visible` extended shape + the greenlist admin surface (operator/org-admin sets role/group audiences).
- `user_settings.preferences` read/write for the per-user model default, gated by the operator lock flag.
</code_context>

<specifics>
## Specific Ideas
- The invitation link carries the raw token; only its hash is stored (`token_hash`, T-161-04). Links expire (`expires_at`) and are single-use (`status` → accepted).
- Adoption states map directly to `org_invitations.status` + `org_members` presence: **not-yet-invited** (no invite row), **pending** (invite row, status='pending'), **active** (org_members row exists).
- The model-default preference is the visible proof of the SEED-116 two-layer pattern: operator allowed-set + lock → user picks within it.
</specifics>

<deferred>
## Deferred Ideas
- **SSO (SAML 2.0)** → Phase 168 (SSO-01); INV-02's JIT seam is the shared onboarding path SSO reuses, but SSO registration/domain-routing is 168.
- **Departments / dept-admin role** → Phase 169 (ADMIN-06); dept-admin invite role stays greyed this phase.
- **Full group management UI** (creating/editing groups for greenlists) — this phase ships the role/group greenlist RESOLVER + a minimal admin surface; rich group management is later.
- **Entitlements / subscription tiers** gating features → STRETCH Phase 170 (ENT-01/02).
- **Broader per-user preferences bundle** (theme + others beyond the model default) → future config pass (SEED-117); this phase ships the model-default instance only (D-167-04).
- **Email template polish / branded invitations** — link-first ships now; rich email templating is a later hardening pass.

### Reported Bugs cross-check
No open `surface: Agentic-RAG` bug overlaps this phase's domain (invitations / roles / onboarding / preferences / membership). All open Agentic-RAG reports are chat/streaming-surface, explicitly held OUT of v3.4 (post-v3.3 chat-polish phase).

### G-2 sketch note
The invitation surfaces (invite modal, adoption-state chips, role picker, greenlist admin) are visual but **extend 166's shipped design system** (org shell band+tabs, Members roster, chip vocabulary, LockedTab→live pattern). A **light `/gsd:sketch 167`** for the net-new invite-flow interaction + adoption chips is warranted IF the operator wants a mockup acceptance bar; otherwise plan directly reusing 166 patterns. Operator's call before `/gsd:plan-phase 167`.
</deferred>

---

*Phase: 167-Invitations + Roles + Greenlists + JIT + Per-User Prefs*
*Context gathered: 2026-07-21*

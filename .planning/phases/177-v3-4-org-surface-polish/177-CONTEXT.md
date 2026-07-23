# Phase 177: v3.4 Org-Surface Polish - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning
**Mode:** `--auto` (operator-delegated autonomous discuss — decisions picked by Claude, logged below for audit)

<domain>
## Phase Boundary

Polish the human-facing v3.4 org surfaces so they read **polished + error-honest across
every state** — WITHOUT widening the already-secured 166–168 authorization. Two requirement
threads:

- **ORGUX-01** — the org-admin shell (`OrgAdminShell`/`OrgBand` + tabs), the org switcher, and
  the profile-menu identity anchor (`ProfileMenu` + the `NavPanel` rail shield-mirror) read
  honestly across `member` vs `org-admin` and `1-org` (solo) vs `multi-org`.
- **ORGUX-02** — the invitations + SSO + entry surfaces (`InviteMemberDialog`, `InvitationsTab`,
  `SsoTab`, `AcceptInvitePage`, `SignInForm`) are polished + error-honest.

**This is polish over surfaces that already shipped and work** (Phases 166/167/168), not a
re-architecture. The acceptance bar is the three G-2 sketches shipped this session
(131-C / 132-B / 133-B). Primary lens (operator-set): **family cohesion** — the surfaces
should read as one built-together system; failure-honesty is the secondary edge-state bar.

**Out of scope (own phase if wanted):** any change that widens/loosens an authz gate; new
endpoints, packages, or server contracts; the broader chat/nav polish (owned by STRETCH 178);
department/role folder-sharing (v3.4 STRETCH carry-forwards 169–173).
</domain>

<decisions>
## Implementation Decisions

### Scope & Red Lines
- **D-01 (polish-only red line):** Visual/cohesion changes only. The shipped component
  structure and **all** authz + wire behavior stay byte-identical — no new endpoints, no new
  packages, no changed server contracts, **no migration, no threat model** (no authz widening).
  Any change that would touch an authz gate is OUT (belongs in a new phase).
  `[auto] Scope — Q: "How much re-architecture is in-bounds?" → Selected: "Cohesion/extraction refactor with behavior held byte-identical" (recommended default).`
- **D-02 (G-5 light guard — HARD):** The `StreamsProvider` stream path is UNTOUCHED; the org
  context (`OrgProvider`/`<OrgContext>`) stays OUTSIDE the stream path (067.5 Branch-D3 clear
  guard). Org polish touches org/auth/nav components only.
- **D-03 (no SC#10):** Not streamed state — the cross-provider mandate does not apply to 177.
  BUT the deferred 166/167/168 live-UAT status-lag (cross-provider org-switch teardown + the
  SAML round-trip) **rolls forward as `human_needed`** (needs cloud + a real IdP); it is not
  gated on this phase's verification.

### ORGUX-01 — org identity, switcher, shell (sketch 131-C)
- **D-04 (one org-identity primitive):** Extract ONE shared identity element — avatar · org
  name · org-scoped role badge (`◆ Org-admin` / `Member`) — reused *identically* in the
  `ProfileMenu` header, the rail anchor, the `OrgBand`, and roster rows. One component, not
  three look-alikes (the 131-B/C cohesion thesis).
- **D-05 (per-org role honesty):** The role badge + the rail org-admin shield + the shell entry
  reflect the **active org's** role; switching orgs re-derives role (Member here / Org-admin
  there). Display-only wiring over `OrgProvider`'s existing per-org membership. **Verify at plan:**
  whether `OrgProvider` already re-derives role on switch (likely yes — membership is per-org
  RLS); if already correct, D-05 collapses to a display-consistency audit, not new behavior.
- **D-06 (honest-absent across the matrix):** The indigo org shield + the "Organization admin"
  menu entry must VANISH for a member (no `org:manage`), never render disabled; switcher chrome
  renders only at 2+ orgs (solo = quiet name button, D-166-02). Audit every site.
- **D-07 (zone colors):** Amber stays operator-only; the org zone stays indigo. The two shields
  coexist as visibly distinct zones.

### ORGUX-02 — management surfaces (sketch 133-B)
- **D-08 (one status-chip component):** ONE shared org-zone `StatusChip` + one tone vocabulary
  (primary = pending / pending-approval · success = accepted / active · muted =
  expired / revoked / disabled), replacing `SsoTab`'s documented off-grid UPPERCASE fork and the
  duplicated per-file chip maps in `InvitationsTab` + `SsoTab`.
- **D-09 (one row anatomy + 4px grid):** ONE row anatomy + one 4px spacing grid across
  `InviteMemberDialog` / `InvitationsTab` / `SsoTab` (identity · role/meta · status chip ·
  honest-absent actions). Retire `SsoTab`'s intentional off-grid half-steps → snap to grid.
- **D-10 (preserve honest behavior):** Every honest behavior is kept — honest-absent affordances,
  **link-first** delivery (dialog + resend both surface a copyable link), and the **victim-naming**
  remove confirm (names the domain + its consequence). Polish is visual/cohesion; behavior unchanged.

### ORGUX-02 — entry / failure honesty (sketch 132-B)
- **D-11 (one honest-notice vocabulary):** ONE shared severity-keyed notice/callout for the auth
  surfaces (`SignInForm` + `AcceptInvitePage`): calm-muted = recoverable dead-end · indigo =
  in-progress · green = success · weight (danger) = genuine system error ONLY.
- **D-12 (recoverable ≠ error):** Recolor recoverable invite dead-ends (expired / revoked /
  invalid / missing-token) to CALM, not alarming red — they are "ask for a fresh link," the
  user's to fix. Genuine system errors keep weight.
- **D-13 (fail-open made legible):** `SignInForm` fail-open preserved + surfaced honestly — a
  route outage degrades to the password reveal with a reassuring note ("nothing's wrong with your
  account"), never a lockout (T-168-07 / SC#3). Behavior unchanged; copy + notice polish only.
- **D-14 (one entry card shell):** Consolidate any drift between the `SignInForm` and
  `AcceptInvitePage` brand-card shells so both read as one product surface (both already clone
  the `AuthPage` shell).

### Claude's Discretion
- Exact extraction boundaries + naming for the shared primitives (chip / notice / identity block)
  — planner/executor's call, following the shipped `cn()` + shadcn + `lucide-react` patterns.
- Resolving D-05 (per-org role already-correct vs needs-light-wiring) at plan time via an
  `OrgProvider` read.

### Reported-Bugs Cross-Check (MANDATORY touchpoint)
- Swept `.planning/reported-bugs/*.md` for `surface: Agentic-RAG` + status `open`/`deferred`.
  **Zero overlap** with the org-surface domain — all open/deferred reports are chat / agent-loop /
  workspace-panel (owned by phases 174 / 176 / 178 / 180). **Nothing folds into 177.** No report
  frontmatter routed here.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Acceptance bar (this session's sketches — the design contract)
- `.planning/sketches/131-org-state-matrix/README.md` — ORGUX-01 winner **C** (unified
  org-identity primitive + per-org role honesty; honest-absent + solo-calm state matrix).
- `.planning/sketches/131-org-state-matrix/index.html` — the interactive mock.
- `.planning/sketches/132-org-entry-failure-honesty/README.md` — ORGUX-02 pre-auth winner **B**
  (unified entry card + one severity-keyed honest-notice; fail-open legible).
- `.planning/sketches/132-org-entry-failure-honesty/index.html`
- `.planning/sketches/133-org-management-surfaces/README.md` — ORGUX-02 in-app winner **B**
  (one management language: shared chip · row · 4px grid; honest-absent + link-first + victim-naming).
- `.planning/sketches/133-org-management-surfaces/index.html`
- `.planning/sketches/MANIFEST.md` §"Phase 177 session" — the session decision + through-line.
- Prior ORGUX-01 precedent: `.planning/sketches/079-identity-anchor-and-org-switcher/README.md`,
  `.planning/sketches/080-org-admin-shell/README.md` (winners 079-C / 080-A, shipped in 166).

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §ORGUX (ORGUX-01, ORGUX-02).
- `.planning/ROADMAP.md` — Phase 177 row + flags (G-2 done, G-5 light, no SC#10 / threat / migration).

### Sketch design language (shared house style)
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` — the validated Deep-Midnight org-zone
  language (org-indigo vs operator-amber, Control-Room reuse, honest-absent, LockedTab, chip vocab).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (the surfaces being polished)
- `frontend/src/components/org/OrgAdminShell.tsx` — the 7-tab shell (now 5 live: Members ·
  Invitations & Roles · SSO · Settings · Audit + 2 locked: Subscription · Retention).
- `frontend/src/components/org/OrgBand.tsx` — the indigo shell band (role badge + ORG ADMIN chip +
  "every action recorded" marker + ⌥ Technical-names). **Home for the shared identity primitive (D-04).**
- `frontend/src/components/org/OrgMembersTab.tsx` · `OrgAuditTab.tsx` · `OrgSettingsTab.tsx` — live tabs.
- `frontend/src/components/org/InvitationsTab.tsx` + `InviteMemberDialog.tsx` — invitations (167);
  hold the invite-role chips, link-first success, resend/revoke, and a local status-chip map (D-08/D-09).
- `frontend/src/components/org/SsoTab.tsx` — SSO (168); documents its INTENTIONAL off-grid spacing +
  UPPERCASE chip fork (the exact cohesion target for D-08/D-09) + victim-naming remove + SP-metadata well.
- `frontend/src/components/layout/ProfileMenu.tsx` — the 079-C merged identity/switcher menu (ORGUX-01).
- `frontend/src/components/layout/NavPanel.tsx` — the rail: theme toggle · operator amber shield ·
  org indigo shield-mirror · identity anchor (honest-absent shield lives here, D-06).
- `frontend/src/pages/AcceptInvitePage.tsx` — the `/invite` 6-state landing (D-11/D-12/D-14).
- `frontend/src/components/auth/SignInForm.tsx` — identifier-first sign-in + fail-open (D-13).

### Established Patterns (constrain the polish)
- `OrgProvider.tsx` (`providers/`) — active-org + per-org role state + switch teardown (D-05 reads this).
- `hooks/useOrgPermissionsProbe.ts` — `org:manage` / `org:invite` / `sso:manage` render-gates (D-06).
- Chip/tone vocab already exists inline in InvitationsTab + SsoTab (`CHIP_TONE_CLASS`) — D-08 lifts it
  to ONE shared component; `cn()` + shadcn `Dialog`/`Button`/`Input` + `lucide-react` are the toolkit.
- `AuthPage.tsx` brand shell (orbs + sparkles) cloned by AcceptInvitePage — D-14 consolidates drift.

### Integration Points (HARD guards)
- `StreamsProvider.tsx` — **DO NOT TOUCH the stream path;** keep `<OrgContext>` outside it
  (067.5 Branch-D3 / G-5 light). Org polish must not reach the streaming pipeline.
- Server contracts (`/org/*`, `/org/sso/*`, `/invite` accept, `getSsoRoute`) — **unchanged**; the
  render-gates stay courtesy-only, the server gates remain the wall (T-166-09 / T-167-17 / T-168-06).
</code_context>

<specifics>
## Specific Ideas

- The design contract is literal: build to the three sketch winners (131-C / 132-B / 133-B). The
  "one org-identity primitive + one status-chip + one honest-notice, reused everywhere" through-line
  is the whole point — favor extraction over per-surface duplication.
- Recoverable-dead-end honesty (D-12) is the highest-value failure polish: expired/revoked/missing
  invites must feel calm ("get a fresh link"), never like something broke.
- Fail-open (D-13) is a safety property, not a style choice — it must stay a reassuring degrade,
  never a lockout.
</specifics>

<deferred>
## Deferred Ideas

- Broader chat/nav polish, provider-logo consistency, citation footer, run-state todos, workspace
  panel — **STRETCH Phase 178** (SEED-045 umbrella). Not this phase.
- Department/role-scoped folder sharing + permission-aware citations — **v3.4 STRETCH 169–173**
  carry-forwards (`.planning/v3.4-STRETCH-CARRYFORWARD.md`).
- Any authz change (new roles, gate loosening) — a new authz phase with its own threat model.

None of the above came from scope-creep in this discussion; they are pre-existing boundaries noted
so the planner stays inside 177.
</deferred>

---

*Phase: 177-v3-4-org-surface-polish*
*Context gathered: 2026-07-23*

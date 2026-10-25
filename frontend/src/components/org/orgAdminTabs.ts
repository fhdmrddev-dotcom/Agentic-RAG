/**
 * Phase 293-04 (operator decision 2026-10-24, extract FIRST) — the org-admin shell's TAB REGISTRY,
 * MOVED VERBATIM out of `OrgAdminShell.tsx` (the hot-file ledger's named seam for that file).
 *
 * A no-React `.ts` module for the `settingsTabs.ts` reason: exporting non-components from a component
 * file trips `react-refresh/only-export-components` and breaks Fast Refresh for the whole shell.
 *
 * ⚠ `scripts/check-landing-drift.cjs` §7b scrapes `const TABS: readonly TabDef[] = [ … ]` out of THIS
 * file (it moved with the code, on purpose) and compares the labels with `SURFACE_TABS.orgAdmin`.
 */
export type OrgAdminTab =
  | "members"
  | "experts"
  | "audit"
  | "settings"
  | "invitations"
  | "sso"
  | "subscription"
  | "retention"

export interface TabDef {
  id: OrgAdminTab
  label: string
  locked: boolean
  /** Plain, roadmap-number-free "coming soon" copy for the locked body (T-146-10). */
  lockedDescription?: string
}

// The 080-A org-admin band-tab IA (D-166-01): three live tabs, then the four honest
// locks that NAME the arriving capability in plain words (never a roadmap number —
// T-146-10 / T-166-13). The operator zone's warning tint is NOT used anywhere here —
// this is the indigo zone.
export const TABS: readonly TabDef[] = [
  { id: "members", label: "Members", locked: false },
  // Phase 261 (PACK-07): In-App Expert Management & Authoring Tab
  { id: "experts", label: "Experts", locked: false },
  { id: "audit", label: "Audit", locked: false },
  { id: "settings", label: "Settings", locked: false },
  // Phase 167 (D-167-07): the invitations home is LIVE — the org shell owns the
  // invitation fetch + mutations; the leaf is InvitationsTab.
  { id: "invitations", label: "Invitations & Roles", locked: false },
  // Phase 168 (D-168-01 / SSO-01): the SSO home is LIVE — the org shell owns the SSO-config
  // fetch + create/remove mutations; the leaf is SsoTab (render-gated on canManageSso).
  { id: "sso", label: "SSO", locked: false },
  {
    id: "subscription",
    label: "Subscription",
    locked: true,
    lockedDescription: "Plan and billing management is coming soon.",
  },
  // Phase 275 (D-01 / RET-01..04): the Retention home is LIVE — its leaf is self-contained
  // (it owns its fetches, like OrgExpertsTab); the shell gains only this flip, one render branch
  // and the recording pulse.
  { id: "retention", label: "Retention", locked: false },
]

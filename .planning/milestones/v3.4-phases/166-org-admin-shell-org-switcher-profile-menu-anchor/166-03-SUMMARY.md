---
phase: 166-org-admin-shell-org-switcher-profile-menu-anchor
plan: 03
subsystem: ui
tags: [react, org-admin, presentational-leaf, audit, roster, rls-honesty, vitest, tdd, aether-indigo]

# Dependency graph
requires:
  - phase: 166-01-org-admin-backend
    provides: GET /org/members roster + GET /org/audit {entries, total, scope:"all"|"own"} contract
  - phase: 166-02-orgprovider
    provides: OrgMember / OrgAuditPage / OrgAuditFilters types + getOrgMembers/getOrgAudit API fns + useOrg() (role/canManage/canAuditView)
  - phase: 146-operator-control-room
    provides: OperatorBand / UsersAndAccess / AuditTab / LockedTab / TechnicalNamesToggle analogs to clone
provides:
  - OrgBand — org-indigo identity band leaf (org name + ORG ADMIN chip + ◆ Org-admin/Member role badge + 062-A recording marker + ⌥ Technical-names)
  - OrgMembersTab — read-only members roster leaf (identity + role chip + client-side email search; write affordances ABSENT)
  - OrgAuditTab — lighter single-ledger audit list leaf (029-A chip filters, NO CSV, NO ledger switch) with the RLS-honest scope='own' degrade banner
  - OrgSettingsTab — light org-config home leaf (org identity + three-homes seam)
affects: [166-04-org-admin-shell]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Amber → org-indigo re-tint: the operator zone's warning tint stays reserved for /admin; the org home uses the app's normal primary accent (index.css --primary, hue-239 indigo)"
    - "Pure presentational leaves (props in / DOM out): no fetch, no auth, no context reads — the shell (Plan 04) owns the fetch + the useTechnicalNames value and threads showTechnical/onToggleTechnical down (matches the shipped AuditTab prop contract)"
    - "RLS-honest degrade in the client: the tab renders exactly the rows + scope the server returned; scope==='own' shows an explicit banner + own rows, never a silent empty list, and cannot widen visibility (no client-side 'show everyone')"
    - "Vocabulary copied not imported: the 067-A audit_log plain-first map is duplicated into OrgAuditTab (a shared export would touch AuditTab.tsx, outside this plan's file surface)"

key-files:
  created:
    - frontend/src/components/org/OrgBand.tsx
    - frontend/src/components/org/OrgSettingsTab.tsx
    - frontend/src/components/org/OrgMembersTab.tsx
    - frontend/src/components/org/OrgMembersTab.test.tsx
    - frontend/src/components/org/OrgAuditTab.tsx
    - frontend/src/components/org/OrgAuditTab.test.tsx
  modified: []

key-decisions:
  - "Technical-names is PROP-controlled on both OrgBand and OrgAuditTab (showTechnical + onToggleTechnical), not a direct useTechnicalNames context read — this keeps the leaves pure/testable in isolation and matches the shipped AuditTab contract; the shell (Plan 04) wires both to the single useTechnicalNames value so band + audit reveal move ONE value"
  - "Org-indigo = the semantic `primary` token (index.css --primary is hue-239 indigo, reserved as the app's primary accent), not literal Tailwind indigo-* — this honours the app's accent discipline; the ONLY amber kept anywhere is OrgAuditTab's 'at zero' match-count trust cue (a semantic warning color, not zone chrome)"
  - "OrgMembersTab role chip is honest per-member (Org-admin / Dept-admin / Member) rather than the strict binary — dept-admin is a real manager role, so showing 'Member' would be dishonest on a read-only roster; the band stays binary (only org:manage holders reach it)"
  - "OrgAuditTab action chip is SINGLE-select (the backend /org/audit takes one action_type); date chip maps to the backend since presets (7d/30d/90d), no client-side ISO window math (the backend _since_to_dt owns it)"
  - "OrgSettingsTab is a genuine light home (org name read-only + a three-homes seam sentence), NOT a stub — no 'v1/placeholder/static for now' scope-reduction language; bulk global-knob relocation stays deferred to v3.5 (D-166-03)"

patterns-established:
  - "The org leaves mirror the operator leaves 1:1 with writes stripped + amber→indigo: OperatorBand→OrgBand, UsersAndAccess→OrgMembersTab, AuditTab→OrgAuditTab (lighter), SettingsPage→OrgSettingsTab (thin)"

requirements-completed: [ADMIN-01, ADMIN-04, ADMIN-05]

# Metrics
duration: 18min
completed: 2026-07-21
---

# Phase 166 Plan 03: Org-Admin Shell Presentational Leaves Summary

**The four presentational leaves the org-admin shell composes — OrgBand (org-indigo identity band), OrgMembersTab (read-only roster with absent write affordances), OrgAuditTab (lighter single-ledger audit list with the load-bearing RLS-honest scope='own' degrade banner), and OrgSettingsTab (light org-config home) — each cloned from its shipped operator analog with the amber→indigo re-tint and the writes stripped, all pure props-in/DOM-out.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-21T19:48Z (approx)
- **Completed:** 2026-07-21T19:56Z
- **Tasks:** 3 (Tasks 2 + 3 TDD RED→GREEN)
- **Files created:** 6 (4 components + 2 test files)

## Accomplishments

- **OrgBand (D-166-05 / ADMIN-01):** a pure leaf re-tinted from the operator `OperatorBand` to org-indigo (`primary` tokens) — zero amber. Carries the org name headline + an `ORG ADMIN` chip + the `◆ Org-admin` / `Member` role badge + the 062-A "every action recorded" marker (kept verbatim — 080-A rejects variant C for dropping it) + a plain-first `⌥ Technical-names` toggle (prop-controlled).
- **OrgMembersTab (D-166-01 / ADMIN-01):** the `UsersAndAccess` roster with every write path deleted — no `onDisable`/`onGrant`/`onRevoke`, no confirm sheets. Identity block (avatar + email + joined) + an honest per-member role chip + client-side email search over the loaded page. A read-only banner points at the (locked) Invitations & Roles tab with **no roadmap phase number** (T-146-10). Write affordances are ABSENT (not disabled buttons that lie — T-166-09).
- **OrgAuditTab (D-166-04 / ADMIN-04, the landmine):** a lighter single-ledger cut of `AuditTab` — the 067-A plain-first vocabulary + the 029-A chip strip (single-select action chip + since-preset date chip) + the ⌥ raw-code reveal + a server-total pager. **STRIPPED:** the operator/platform ledger switch and the CSV export. **ADDED:** the RLS-honest degrade — when `page.scope === "own"` it renders an explicit "you see only your own activity" banner above the own-only rows, never a silent empty list (T-166-08). It cannot widen visibility (no client-side "show everyone").
- **OrgSettingsTab (D-166-03 / ADMIN-05):** a thin, genuine org-config home — org display name (read-only) + a three-homes seam sentence (org-config here / personal prefs in the profile menu / platform governance with the operator). No scope-reduction language; the v3.5 bulk relocation stays deferred.
- **11/11 vitest green + tsc --noEmit exit 0.**

## Task Commits

Each task committed atomically (Tasks 2 + 3 as TDD RED→GREEN pairs):

1. **Task 1: OrgBand + OrgSettingsTab** — `29e7ec23` (feat)
2. **Task 2 (RED): failing OrgMembersTab tests** — `0780a838` (test)
3. **Task 2 (GREEN): OrgMembersTab read-only roster** — `45f50b45` (feat)
4. **Task 3 (RED): failing OrgAuditTab tests** — `2e32caf4` (test)
5. **Task 3 (GREEN): OrgAuditTab lighter audit + RLS-honest degrade** — `0bb06fd9` (feat)

## Files Created

- `frontend/src/components/org/OrgBand.tsx` — org-indigo identity band leaf.
- `frontend/src/components/org/OrgSettingsTab.tsx` — light org-config home leaf.
- `frontend/src/components/org/OrgMembersTab.tsx` — read-only members roster leaf.
- `frontend/src/components/org/OrgMembersTab.test.tsx` — 5 tests (row render, no write affordances, empty/null states, banner).
- `frontend/src/components/org/OrgAuditTab.tsx` — lighter audit list leaf + RLS-honest degrade.
- `frontend/src/components/org/OrgAuditTab.test.tsx` — 6 tests (scope='own'/'all', chip strip, no CSV/no switch, plain+⌥ reveal).

## Decisions Made

- **Technical-names is prop-controlled, not a direct context read.** The plan interfaces named `useTechnicalNames`; both readings ("one shared value") are satisfiable, but the must_haves demand pure props-in/DOM-out leaves. So OrgBand + OrgAuditTab take `showTechnical` + `onToggleTechnical` props (exactly the shipped `AuditTab` contract) and reuse the existing `TechnicalNamesToggle`. The shell (Plan 04) wires both to the single `useTechnicalNames()` context so the band toggle + the audit raw-code reveal never disagree. This keeps the leaves independently testable without a provider.
- **Org-indigo = the semantic `primary` token.** `index.css --primary` is hue-239 indigo, reserved as the app's primary accent — the natural "the user's own home" tint, distinct from the operator zone's reserved warning color. The only warning-color accent kept anywhere in these leaves is OrgAuditTab's "at zero" match-count cue (a semantic trust signal, per the plan's explicit carve-out).
- **Members role chip is honest per-member.** dept-admin renders as `◆ Dept-admin` (a real manager role) rather than being flattened to "Member"; the strict `◆ Org-admin` / `Member` binary stays on the band (only `org:manage` holders reach the band).
- **Audit filters match the backend exactly:** single `action_type` (single-select chip) + the `since` presets 7d/30d/90d (the backend `_since_to_dt` owns the window math — no client-side ISO computation).

## Deviations from Plan

None that change scope. One design-latitude resolution worth noting: the plan's `<interfaces>` referenced `useTechnicalNames` for the band toggle; I implemented it prop-controlled (shell-wired) rather than a direct context read, because the plan's must_haves explicitly require the leaves to be "pure presentational (props in, DOM out) — no fetch/auth" and this matches the shipped `AuditTab` analog. Same observable behavior (one shared value), stricter leaf purity.

## Issues Encountered

- **`amber` appeared in OrgBand comments** (explaining the re-tint), tripping the `grep -ci "amber" == 0` acceptance. Reworded the two comment lines to "the operator zone's warning tint" — count is now 0; the code was already amber-free.
- **`source` avoided entirely in OrgAuditTab** to keep the "no ledger switch" acceptance (`grep -ci "source"`) unambiguous — comments say "single-ledger" and "the org audit_log" instead of "single-source". Count is 0.

## User Setup Required

None — pure frontend presentational components, no new packages, no env, no migration. Not yet mounted anywhere (that is Plan 04's shell + reachability triad).

## Known Stubs

None. All four leaves are fully wired to their prop contracts. OrgSettingsTab is intentionally light per D-166-03 (a genuine org-config home, not a stub) — the bulk global-knob relocation is explicitly deferred to the v3.5 config pass (SEED-117 §1), documented in the component header and the three-homes seam copy. The four locked shell tabs are Plan 04's concern (LockedTab reused as-is).

## Verification

- `npx vitest run src/components/org/OrgAuditTab.test.tsx src/components/org/OrgMembersTab.test.tsx` → 11/11 passed.
- `npx tsc --noEmit` → exit 0.
- OrgBand: `grep -ci amber` == 0; "every action recorded" present; `◆ Org-admin` / `Member` role-badge copy present.
- OrgMembersTab: no `onDisable/onGrant/onRevoke/confirm` in non-comment lines; read-only banner names the Invitations tab with no digit/phase-number; `queryByRole("button")` is null (affordances absent).
- OrgAuditTab: no `downloadCsv/handleExport/operatorCsv/Export CSV`; no `source` token (single-ledger); scope='own' banner + rows both render (never empty); scope='all' hides the banner.
- Commit range `29e7ec23^..HEAD` touched only the 6 planned org files — no STATE.md / ROADMAP.md writes.

## Next Phase Readiness

- Plan 04 (OrgAdminShell) composes these four leaves + 4 `LockedTab` placeholders behind the 7-tab strip. It owns: the lazy per-tab fetch (`getOrgMembers` / `getOrgAudit`), the `useTechnicalNames()` wiring threaded to OrgBand + OrgAuditTab, the Members search state (`query`/`onQueryChange`), the audit `filters`/`onFiltersChange`/`onPageChange`, and the `recordingPulse` on OrgBand.
- Prop contracts to consume:
  - `OrgBand({ orgName, role, onBack, recordingPulse?, showTechnical, onToggleTechnical })`
  - `OrgMembersTab({ members: OrgMember[] | null, query, onQueryChange })`
  - `OrgAuditTab({ result: OrgAuditPage | null, loading, filters, onFiltersChange, onPageChange, showTechnical, onToggleTechnical })`
  - `OrgSettingsTab({ orgName })`
- No blockers.

## Self-Check: PASSED
- `frontend/src/components/org/OrgBand.tsx` — FOUND
- `frontend/src/components/org/OrgSettingsTab.tsx` — FOUND
- `frontend/src/components/org/OrgMembersTab.tsx` — FOUND
- `frontend/src/components/org/OrgMembersTab.test.tsx` — FOUND
- `frontend/src/components/org/OrgAuditTab.tsx` — FOUND
- `frontend/src/components/org/OrgAuditTab.test.tsx` — FOUND
- Commit `29e7ec23` (Task 1, feat) — FOUND
- Commit `0780a838` (Task 2 RED, test) — FOUND
- Commit `45f50b45` (Task 2 GREEN, feat) — FOUND
- Commit `2e32caf4` (Task 3 RED, test) — FOUND
- Commit `0bb06fd9` (Task 3 GREEN, feat) — FOUND
- vitest 11/11 passed; tsc --noEmit exit 0
- No writes to STATE.md / ROADMAP.md — confirmed

---
*Phase: 166-org-admin-shell-org-switcher-profile-menu-anchor*
*Completed: 2026-07-21*

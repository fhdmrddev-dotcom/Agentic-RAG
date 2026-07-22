---
phase: 166-org-admin-shell-org-switcher-profile-menu-anchor
plan: 04
subsystem: ui
tags: [react, org-admin, band-tabs-shell, shell-owns-fetch, locked-tabs, rls-honesty, vitest, tdd, aether-indigo]

# Dependency graph
requires:
  - phase: 166-02-orgprovider
    provides: useOrg() (activeOrgId/orgs/role/canManage/canAuditView/loading) + getOrgMembers/getOrgAudit typed fetchers
  - phase: 166-03-org-admin-leaves
    provides: OrgBand / OrgMembersTab / OrgAuditTab / OrgSettingsTab pure presentational leaves + their prop contracts
  - phase: 146-operator-control-room
    provides: ControlRoomPage shell-owns-fetch pattern + LockedTab (reused as-is) + TechnicalNamesProvider (useTechnicalNames)
provides:
  - OrgAdminShell — the org-indigo band+tabs shell (fetch owner) composing OrgBand + the 3 live tabs + 4 LockedTab placeholders
  - the lazy per-tab fetch orchestration (alive.current guard + honest-degrade .catch) feeding OrgMembersTab/OrgAuditTab
  - the audit filter/page state + the server `scope` threaded whole into OrgAuditTab (RLS-honest degrade)
  - the single useTechnicalNames() value wired to OrgBand + OrgAuditTab (one reveal, never two toggles that disagree)
affects: [166-05-profile-menu-rail-reachability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shell-owns-fetch / tab-is-pure-leaf (148-PATTERNS): the shell holds the alive.current guard + the lazy per-tab fetch + the honest-degrade .catch (keeps last-known values); the four leaves stay props-in/DOM-out"
    - "Server-truth scope threading: OrgAuditTab receives the whole OrgAuditPage (scope rides ON it), so the RLS-honest degrade renders from the server's flag — the client cannot widen visibility (T-166-11)"
    - "Final LockedTab fallthrough (ControlRoomPage:792 shape): one <LockedTab title description/> at the end of the body switch serves all 4 locked tabs from their phase-number-free lockedDescription (T-146-10 / T-166-13)"
    - "Amber → org-indigo: the active-tab accent rides the semantic `primary` token (hue-239 indigo); the operator zone's reserved warning tint appears zero times (grep-locked)"

key-files:
  created:
    - frontend/src/components/org/OrgAdminShell.tsx
    - frontend/src/components/org/OrgAdminShell.test.tsx
  modified: []

key-decisions:
  - "The shell carries NO recordingPulse: this surface is read-only (Members read-only · Audit read-only · Settings a light home) — there is no write to pulse. OrgBand.recordingPulse is optional (defaults false), so leaving it unwired is honest, not a gap; Plan 05+ (or a future write phase) can pulse it when a write lands."
  - "Honest client canManage guard as an early return AFTER all hooks: a non-manager who force-mounts the shell sees the band + a plain 'ask an org-admin for the manage permission' refusal, never org chrome. This is courtesy, not the boundary (T-166-12) — every fetch is server-gated (Plan 01) and the lazy fetch is additionally short-circuited on !canManage so a non-manager never even hits the wire."
  - "Audit fetch keyed on (activeTab, filters, page): opening the Audit tab OR changing a chip filter/page re-runs the guarded fetch, which threads the fresh server scope back into OrgAuditTab. A filter change resets to page 1 (the scoped total shifts); no client-side ISO/scope math."
  - "TDD RED wrote the body-switch tests against the Task-1 placeholder skeleton (5/7 red — the 2 green were the locked-tab tests the skeleton already wired via LockedTab); GREEN swapped the placeholders for the real leaf composition (7/7)."

patterns-established:
  - "The org-admin shell is the user-side mirror of ControlRoomPage: same band+tabs IA, same shell-owns-fetch split, LockedTab reused as-is, amber→indigo re-tint — the composition invents no new shell structure"

requirements-completed: [ADMIN-01, ADMIN-04, ADMIN-05]

# Metrics
duration: 20min
completed: 2026-07-21
---

# Phase 166 Plan 04: Org-Admin Shell (Band + 7-Tab Composition) Summary

**The fetch-owning org-admin shell — OrgAdminShell — composes the four Plan-03 leaves (OrgBand + OrgMembersTab + OrgAuditTab + OrgSettingsTab) into the 080-A 7-tab shape: 3 LIVE tabs (Members read-only · Audit lighter · Settings org-config home) + 4 LockedTab "coming soon" placeholders (Invitations & Roles · SSO · Subscription · Retention, no roadmap numbers), reusing the shipped Control-Room band+tabs shell re-tinted org-indigo, owning the alive.current-guarded lazy per-tab fetch, and threading the server's audit `scope` flag straight through so the RLS-honest degrade renders from server truth.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 (Task 2 as a TDD RED→GREEN pair)
- **Files created:** 2 (1 component + 1 test)

## Accomplishments

- **OrgAdminShell (ADMIN-01 / D-166-01):** the org-indigo band+tabs shell cloned from the shipped operator `ControlRoomPage`. It renders `<OrgBand/>` then a 7-entry `role="tablist"` (061-B shape, A11Y-01 `<div>` host) — **3 live** (`members`/`audit`/`settings`) + **4 locked** (Invitations & Roles / SSO / Subscription / Retention). The active-tab accent rides the semantic `primary` token (hue-239 indigo); the operator zone's reserved warning tint appears **zero** times (grep-locked).
- **Shell owns the fetch (148-PATTERNS split):** an `alive.current` guard + a lazy per-tab fetch (`getOrgMembers` on the Members tab, `getOrgAudit` on the Audit tab — never on a tab you don't open) + an honest-degrade `.catch` that keeps last-known values (a blip never blanks the surface). The four leaves stay pure props-in/DOM-out.
- **Audit `scope` threaded whole (ADMIN-04 / D-166-04 / T-166-11):** the shell passes the entire `OrgAuditPage` (the load-bearing `scope` flag rides ON it) into OrgAuditTab, so the RLS-honest degrade (`scope==='own'` → "you see only your own activity" banner + own rows) renders from **server truth** — the client cannot widen visibility. Filter/page intent flows back via `onFiltersChange`/`onPageChange` (a filter change resets to page 1).
- **Settings home (ADMIN-05):** the Settings tab mounts `<OrgSettingsTab orgName={…}/>` — the org-config home behind the `org:manage`-gated shell (the org name derived from the `useOrg().orgs` membership set).
- **4 LockedTab fallthrough (T-146-10 / T-166-13):** one `<LockedTab title description/>` at the end of the body switch serves all four locked tabs from their **phase-number-free** `lockedDescription`. A test asserts no description matches `/Phase\s*\d|\b1[0-9]{2}\b/`.
- **One shared reveal:** the shell reads `useTechnicalNames()` once and threads `showTechnical`/`onToggleTechnical` to both OrgBand and OrgAuditTab, so the band toggle and the audit raw-code reveal always move together.
- **7/7 shell vitest + 18/18 org suite + tsc --noEmit exit 0.**

## Task Commits

1. **Task 1: shell skeleton — TABS + band + tablist + lazy fetch** — `dab413c4` (feat)
2. **Task 2 (RED): failing OrgAdminShell body-switch tests** — `e85ac480` (test)
3. **Task 2 (GREEN): body switch — compose live leaves + 4 LockedTab** — `bac69849` (feat)

## Files Created

- `frontend/src/components/org/OrgAdminShell.tsx` — the org-admin band+tabs shell (fetch owner).
- `frontend/src/components/org/OrgAdminShell.test.tsx` — 7 tests (3 live-tab mounts, 4 locked-tab render + phase-number-free copy, audit scope='own' degrade threading + scope='all' banner-hidden).

## Decisions Made

- **No `recordingPulse` wired.** This shell is read-only end-to-end (Members roster + Audit list + a light Settings home) — there is no write to record, so there is nothing to pulse. `OrgBand.recordingPulse` is optional (defaults false); leaving it unwired is honest rather than a gap. A future write-capable phase (or the profile-menu switch in Plan 05) can pulse it.
- **Honest client `canManage` guard.** A non-manager who force-mounts the shell gets the band + a plain refusal ("ask an org-admin for the manage permission"), never org chrome. This is a courtesy render (T-166-12: the client is not the boundary — every fetch is server-gated in Plan 01), and the lazy fetch is additionally short-circuited on `!canManage` so a non-manager never hits the wire. The guard is an early return placed AFTER all hooks (Rules-of-Hooks safe).
- **Audit fetch keyed on (activeTab, filters, page).** Opening the Audit tab or changing a chip filter/page re-runs the single guarded fetch, which threads the fresh server `scope` back into the leaf — no client-side scope or ISO-window math.

## Deviations from Plan

None that change scope. The Task-1 temporary placeholder body (explicitly sanctioned by the plan to "keep it compiling") was replaced by the real leaf composition in Task 2 GREEN. The honest `canManage` guard was directed by the plan's critical-execution note ("gate the shell on `useOrg().canManage` … guard honestly").

## Issues Encountered

- **`amber` appeared twice in explanatory comments** (describing the amber→indigo re-tint), tripping the `grep -ci "amber" == 0` acceptance. Reworded both to "the operator zone's reserved warning tint" — count is now 0; the code was already warning-color-free (the active tab uses the `primary` indigo token).

## User Setup Required

None — pure frontend composition, no new packages, no env, no migration. The shell is not yet mounted anywhere; the reachability triad (ActiveView branch + ChatLayout mount + the NavPanel indigo rail shield + ProfileMenu) is Plan 05's concern.

## Known Stubs

None. The three live tabs are fully wired to their real fetchers (`getOrgMembers`/`getOrgAudit`) and the org context (`useOrg`). The four locked tabs are intentional "coming soon" placeholders per D-166-01 (Invitations & Roles → Phase 167, SSO → Phase 168, Subscription + Retention → STRETCH Phase 170) — honest `LockedTab` refusals, not empty-data stubs. OrgSettingsTab is intentionally the light org-config home per D-166-03 (bulk global-knob relocation deferred to v3.5).

## Threat Flags

None. The shell introduces no new network endpoint, auth path, or schema surface — it consumes the Plan-01 server-gated fetchers via the Plan-02 client. The three threat-register items (T-166-11 scope threading, T-166-12 client-not-a-boundary, T-166-13 locked-copy no-phase-number) are all satisfied and test-locked.

## Verification

- `npx vitest run src/components/org/OrgAdminShell.test.tsx` → 7/7 passed.
- `npx vitest run src/components/org/` → 18/18 passed (11 leaf + 7 shell; no leaf regressions).
- `npx tsc --noEmit` → exit 0.
- `grep -c "locked: true"` == 4; `grep -c "locked: false"` == 3; `grep -ci "amber"` == 0.
- `grep -n "getOrgMembers\|getOrgAudit"` → lazy per-tab fetch calls present.
- `grep -n "LockedTab"` → the final fallthrough wiring (`<LockedTab title={active.label} description={active.lockedDescription}/>`) present.
- `grep -n "scope"` → the audit page (carrying scope) threaded to OrgAuditTab.
- Only the 2 planned org files were touched — no STATE.md / ROADMAP.md writes.

## Next Phase Readiness

- Plan 05 (ProfileMenu + rail reachability) mounts `<OrgAdminShell onBack={…}/>` behind the `ActiveView === "org-admin"` branch in ChatLayout (union already extended in Plan 02), gated on the App-level `canManage` probe, reached via the indigo rail Shield-mirror (079-C). The shell's only prop is `onBack` — it self-sources everything else from `useOrg()` + `useTechnicalNames()`.
- No blockers.

## Self-Check: PASSED
- `frontend/src/components/org/OrgAdminShell.tsx` — FOUND
- `frontend/src/components/org/OrgAdminShell.test.tsx` — FOUND
- Commit `dab413c4` (Task 1, feat) — FOUND
- Commit `e85ac480` (Task 2 RED, test) — FOUND
- Commit `bac69849` (Task 2 GREEN, feat) — FOUND
- vitest 7/7 (shell) + 18/18 (org suite); tsc --noEmit exit 0
- No writes to STATE.md / ROADMAP.md — confirmed

---
*Phase: 166-org-admin-shell-org-switcher-profile-menu-anchor*
*Completed: 2026-07-21*

---
phase: 166-org-admin-shell-org-switcher-profile-menu-anchor
plan: 05
subsystem: ui
tags: [react, org-admin, profile-menu, org-switcher, nav-rail, reachability-triad, dropdown-menu, vitest, tdd, aether-indigo]

# Dependency graph
requires:
  - phase: 166-02-orgprovider
    provides: useOrgOptional() (activeOrgId/orgs/role/canManage/switchOrg) + the ActiveView "org-admin" union + the D-166-08 switchOrg teardown owner
  - phase: 166-04-org-admin-shell
    provides: OrgAdminShell (self-sourcing band+tabs shell; only prop is onBack)
  - phase: 146-operator-control-room
    provides: the NavPanel amber operator shield + ControlRoomPage mount-branch precedent to mirror in indigo
  - phase: 156-nav-rail-refactor
    provides: the RailItem collapsed/expanded dual-render + the stream-free rail footer
provides:
  - ProfileMenu — the 079-C merged rail-footer identity popover (identity + role badge + org switcher + theme + Sign out)
  - the indigo canManage-gated org-admin Shield-mirror in the NavPanel footer (outside NAV_ITEMS) + the mobile-drawer twin
  - the ChatLayout "org-admin" view branch mounting OrgAdminShell (reachability triad closed)
  - the D-166-08 second-half thread-list refetch (ChatLayout effect keyed on activeOrgId)
  - the WARNING-1 fix — the standalone theme RailItem removed; exactly ONE theme control (inside ProfileMenu)
affects: [167-invitations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "079-C merged rail-footer popover: identity + org-scoped role badge + org switcher (2+ orgs only) + theme + Sign out in ONE shipped shadcn DropdownMenu — no new package (T-166-SC)"
    - "Indigo Shield-mirror parallel to the amber operator shield: same lucide Shield glyph, org-indigo tint, canManage-gated, OUTSIDE NAV_ITEMS, absent (never disabled) for a member"
    - "Reachability triad owned in-phase: ActiveView union (Plan 02) + ChatLayout mount branch + NavPanel/mobile entry — the Phase-118 built-but-unreachable lesson"
    - "D-166-08 reconcile-via-fetch: a ref-guarded activeOrgId-keyed effect refetches loadThreads() on a real switch only (skips the mount duplicate); orthogonal to the StreamsProvider bucket teardown"

key-files:
  created:
    - frontend/src/components/layout/ProfileMenu.tsx
    - frontend/src/components/layout/ProfileMenu.test.tsx
    - frontend/src/components/layout/NavPanel.test.tsx
    - frontend/src/components/layout/ChatLayout.orgRefetch.test.tsx
  modified:
    - frontend/src/components/layout/NavPanel.tsx
    - frontend/src/components/layout/ChatLayout.tsx

key-decisions:
  - "ProfileMenu uses the shipped shadcn DropdownMenu (Radix Menu), NOT a new Popover primitive: @radix-ui/react-popover is not installed and a package install is out-of-scope (Rule 3 exclusion + threat T-166-SC 'no new packages'). DropdownMenu IS a shadcn rail-footer popover already in the repo with an established jsdom test pattern (pointer-capture stubs)."
  - "The Task-2 NavPanel tests live in a NEW colocated frontend/src/components/layout/NavPanel.test.tsx (matching the plan's file path + verify command); the shipped Phase-156 rail regression suite stays in __tests__/NavPanel.test.tsx — both run in the full suite and both stay green."
  - "The D-166-08 thread-list refetch got a dedicated ChatLayout.orgRefetch.test.tsx (the plan listed the behavior under Task 2 but assigned only NavPanel.test.tsx as the test file; the effect lives in ChatLayout, so it needs a ChatLayout render). Added coverage, not scope drift."
  - "A ref-guard on the activeOrgId effect skips the initial mount so loadThreads is NOT double-fired on every app load — the original one-shot mount effect already loads the current org; this effect fires ONLY on a real org change."
  - "The org shield is INDIGO literal (indigo-400/indigo-500), mirroring the operator shield's literal amber-400 structure for a true side-by-side 'shield-mirror' (079-C) — amber stays reserved for the operator zone (grep-locked: NavPanel amber line-count unchanged at 5)."

patterns-established:
  - "The user-side identity/manage split (079-C): switch lives in the merged ProfileMenu (identity), manage is a destination door on the rail (the indigo Shield-mirror) — mirroring the operator shield spatially"

requirements-completed: [ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-05]

# Metrics
duration: 45min
completed: 2026-07-21
---

# Phase 166 Plan 05: ProfileMenu Anchor + Indigo Org Shield-mirror + Reachability Triad Summary

**The last mile of the tenancy surface — the 079-C merged rail-footer ProfileMenu popover (identity + ◆ Org-admin / Member role badge + the 2+-orgs-only switcher + theme + Sign out), the indigo canManage-gated org-admin Shield-mirror sitting parallel to the amber operator shield (desktop rail + mobile drawer, honestly absent for a member), the ChatLayout `org-admin` branch that mounts OrgAdminShell to close the reachability triad, and the D-166-08 second-half thread-list refetch keyed on activeOrgId — with the standalone theme RailItem retired so theme lives in exactly one home.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2 (each a TDD RED→GREEN pair)
- **Files:** 6 (4 created, 2 modified)

## Accomplishments

- **ProfileMenu — the 079-C merged anchor (ADMIN-03 / ADMIN-05 / D-166-05):** ONE rail-footer identity button (RailItem collapsed/expanded dual-render → works icon-only at 58px) opens a shipped shadcn DropdownMenu holding, top to bottom: identity (name/email from `useAuth`) → the `◆ Org-admin` (indigo) / `Member` (muted) role badge → the org-switcher section → the theme toggle → Sign out. It reads org data via `useOrgOptional()` (leaf-safe) and is purely presentational.
- **Switcher only at 2+ orgs (ADMIN-02 / D-166-02):** the switcher section renders **only** when `orgs.length >= 2`; a solo user (100% today) sees a quiet name button with no switcher chrome. Picking a non-active org calls `OrgProvider.switchOrg(id)` — which OWNS the D-166-08 teardown — and the menu never wipes buckets itself (grep-locked: no `clearThreadBucket`).
- **Indigo org-admin Shield-mirror (ADMIN-01 / D-166-05):** a canManage-gated indigo `Shield` RailItem in the NavPanel footer, directly parallel to the amber operator shield, rendered **only** when `canManage` (honestly absent, never disabled, for a member), kept **OUTSIDE NAV_ITEMS**, active-highlighting when `activeView === "org-admin"`, firing `onNavigate("org-admin")`. A twin was added to the mobile drawer so the shell is reachable on mobile too.
- **WARNING-1 fix — exactly one theme control:** the standalone theme-toggle RailItem (old `NavPanel:174-178`) is **removed**; theme now lives only inside the ProfileMenu popover. A behavior test asserts exactly one theme control after opening the menu and none at rail level.
- **Reachability triad closed (ADMIN-01):** ChatLayout gains an additive `activeView === "org-admin"` branch mounting `<OrgAdminShell onBack={() => onNavigate("chat")}/>` (the ControlRoomPage precedent), joining the ActiveView union (Plan 02) and the NavPanel/mobile entry — all owned in-phase (the Phase-118 built-but-unreachable lesson).
- **D-166-08 second half — thread-list refetch (ADMIN-02):** an additive `useEffect` keyed on `activeOrgId` (read via `useOrgOptional`) re-invokes `loadThreads()` after a switch so the sidebar reflects the new org. A ref-guard skips the mount duplicate (fires only on a real change); the effect is orthogonal to the StreamsProvider bucket teardown (067.5 state), so no cross-effect ordering coupling. `useThreads.ts` and the `clearThreadBucket` guard were NOT touched.

## Task Commits

1. **Task 1 (RED): failing ProfileMenu popover tests** — `3eb1dd8b` (test)
2. **Task 1 (GREEN): ProfileMenu — 079-C merged rail-footer identity popover** — `8419382c` (feat)
3. **Task 2 (RED): failing indigo-shield + ProfileMenu-anchor + org-refetch tests** — `a324d5e0` (test)
4. **Task 2 (GREEN): NavPanel shield/anchor/theme-removal + ChatLayout mount/drawer/refetch** — `99f1ffe4` (feat)

## Files Created/Modified

- `frontend/src/components/layout/ProfileMenu.tsx` — the 079-C merged popover (identity + role badge + 2+-orgs switcher + theme + Sign out); shadcn DropdownMenu; org data via `useOrgOptional`; delegates the switch to `switchOrg`.
- `frontend/src/components/layout/ProfileMenu.test.tsx` — 7 tests (identity + admin/member badge, switcher-only-at-2-orgs + switchOrg(id) on pick, solo-hides-switcher, theme+Sign-out inside the menu, collapsed icon-only dual-render).
- `frontend/src/components/layout/NavPanel.test.tsx` — 8 Phase-166 footer tests (indigo shield render/absent/outside-NAV_ITEMS/coexists-with-operator, ProfileMenu anchor replaces bare Sign out, exactly-one-theme-control + onToggleTheme forward).
- `frontend/src/components/layout/ChatLayout.orgRefetch.test.tsx` — 2 tests (refetch on activeOrgId change; no refetch on an unrelated rerender).
- `frontend/src/components/layout/NavPanel.tsx` — indigo canManage shield (via `useOrgOptional`) + ProfileMenu anchor replacing the bare Sign out RailItem + removal of the standalone theme RailItem; `LogOut/Moon/Sun` imports dropped (now unused).
- `frontend/src/components/layout/ChatLayout.tsx` — `org-admin` view branch mounting OrgAdminShell + mobile-drawer indigo shield + the activeOrgId-keyed refetch effect; imports `OrgAdminShell` + `useOrgOptional` + `useRef`.

## Decisions Made

- **Primitive = shipped shadcn DropdownMenu, not a new Popover.** `@radix-ui/react-popover` is not installed; a package install is out-of-scope (Rule-3 exclusion) and the threat register (T-166-SC) mandates no new packages. The repo's `dropdown-menu` (Radix Menu) is a genuine shadcn rail-footer popover with an established jsdom test shim (pointer-capture stubs, per `PublishedCardDelete.test.tsx`).
- **Two NavPanel test files.** The Phase-166 footer tests live in a NEW colocated `NavPanel.test.tsx` (the plan's file path + verify command); the shipped Phase-156 rail regression suite stays in `__tests__/NavPanel.test.tsx`. Both run in the full suite and both are green.
- **Ref-guarded refetch effect** skips the initial mount so `loadThreads` is not double-fired on every app load (the one-shot mount effect already loads the current org); it fires only on a real org change.
- **Literal indigo shield** (indigo-400/500) mirrors the operator shield's literal amber-400 structure for a true side-by-side shield-mirror; the operator zone's warning tint stays reserved (NavPanel amber line-count unchanged at 5).

## Deviations from Plan

### Auto-added coverage

**1. [Rule 2 - Missing critical coverage] Added `ChatLayout.orgRefetch.test.tsx`**
- **Found during:** Task 2.
- **Issue:** The plan's Task-2 `<behavior>` list requires a test that "an activeOrgId change re-invokes loadThreads()", but the only test file it assigned to Task 2 was `NavPanel.test.tsx` — the refetch effect lives in ChatLayout, which cannot be exercised from a NavPanel render.
- **Fix:** Added a focused, heavily-stubbed `ChatLayout.orgRefetch.test.tsx` (2 tests) that renders ChatLayout, spies a stable `loadThreads`, flips the mocked `activeOrgId`, and asserts the refetch fires on change (and NOT on an unrelated rerender).
- **Files modified:** `frontend/src/components/layout/ChatLayout.orgRefetch.test.tsx` (new).
- **Commit:** `a324d5e0` (RED) / `99f1ffe4` (GREEN).

Otherwise the plan executed as written. The NavPanel test-file path was honored exactly (colocated), and no plan-designated file was skipped.

## Issues Encountered

- **`grep -ci "amber"` in NavPanel rose to 7.** My indigo-shield comment described it as the mirror of "the amber operator shield," adding two comment lines containing the literal token — tripping the "amber line-count UNCHANGED (baseline 5)" acceptance grep. Reworded the comment to "the operator zone's reserved warning tint" (the same fix Plan 04 applied); count is back to exactly 5 and the org shield is indigo-only in code.
- **ProfileMenu name assertions matched twice.** In expanded mode the identity name is painted in BOTH the anchor row and the opened menu header, so `findByText("Alice Doe")` saw two matches. Scoped the two header assertions to the opened `role="menu"` (`within(menu)`) — the component behavior (identity in both the anchor and the header) is correct and intended.

## User Setup Required

None — pure frontend composition. No new packages (shipped shadcn DropdownMenu + Tooltip + RailItem), no env, no migration.

## Known Stubs

None. ProfileMenu is wired end-to-end to the live `useAuth` + `useOrgOptional`; the indigo shield reads the real `canManage` probe flag; the org-admin branch mounts the real, self-sourcing OrgAdminShell (Plan 04); the refetch effect calls the real `loadThreads`. The 4 locked shell tabs are Plan 04's intentional "coming soon" placeholders, not stubs introduced here.

## Threat Flags

None. This plan introduces no new network endpoint, auth path, or schema surface — the indigo shield + ProfileMenu are render-only over the Plan-02 client, and every org fetch remains server-gated (Plan 01). The three render-only threat items are satisfied: T-166-14 (canManage shield stays OUTSIDE NAV_ITEMS, forged flag reaches no data — server 403s), T-166-15 (identity reads the live keyed useAuth/OrgProvider), T-166-16 (the switch delegates to `switchOrg`; the menu holds no `clearThreadBucket` — grep-locked).

## Verification

- `npx vitest run src/components/layout/ProfileMenu.test.tsx` → 7/7 passed.
- `npx vitest run src/components/layout/NavPanel.test.tsx` → 8/8 passed.
- `npx vitest run src/components/layout/ChatLayout.orgRefetch.test.tsx` → 2/2 passed.
- Regression: `__tests__/NavPanel.test.tsx` 14/14 + `__tests__/ChatLayoutLaunch.test.tsx` 2/2 + `src/components/org/` 18/18 → all green (51 touched-surface tests total).
- `npx tsc --noEmit` → exit 0.
- Acceptance greps: `switchOrg(o.org_id)` present in ProfileMenu; `clearThreadBucket` non-comment count == 0; role-badge copy `Org-admin`/`Member` present; `org-admin` view branch + `OrgAdminShell` import/mount present in ChatLayout; `loadThreads` effect dep array includes `activeOrgId`; NavPanel `amber` line-count == 5 (baseline, unchanged); org shield indigo (5 indigo lines).
- **Full-suite note (pre-existing rot, out of scope):** `npx vitest run` reports 23 failures across 10 files — ALL in domains this plan did not touch (`streamsProvider*`, `useMessages`, `IngestionPage`, `MessageItem`, `Plan04.frontend`, `PublishGauntlet`, `soulData`, `model-info`). None import NavPanel/ChatLayout/ProfileMenu. This is the documented pre-existing frontend vitest rot (SEED-056, baseline AND HEAD) — not a regression from this plan. Every layout/org test on this plan's surface is green.

## Next Phase Readiness

- A manager can now REACH the org-admin shell (desktop rail shield + mobile drawer), and every user has a real identity anchor with the switcher appearing at 2+ orgs. Phase 167 (invitations) can fill the locked Invitations & Roles tab and, once a second org exists per user, the switcher chrome becomes live.
- No blockers.

## Self-Check: PASSED
- `frontend/src/components/layout/ProfileMenu.tsx` — FOUND (created)
- `frontend/src/components/layout/ProfileMenu.test.tsx` — FOUND (created)
- `frontend/src/components/layout/NavPanel.test.tsx` — FOUND (created)
- `frontend/src/components/layout/ChatLayout.orgRefetch.test.tsx` — FOUND (created)
- `frontend/src/components/layout/NavPanel.tsx` / `ChatLayout.tsx` — FOUND (modified)
- Commit `3eb1dd8b` (Task 1 RED, test) — FOUND
- Commit `8419382c` (Task 1 GREEN, feat) — FOUND
- Commit `a324d5e0` (Task 2 RED, test) — FOUND
- Commit `99f1ffe4` (Task 2 GREEN, feat) — FOUND
- ProfileMenu 7/7 + NavPanel 8/8 + ChatLayout.orgRefetch 2/2 + regression 34/34; tsc --noEmit exit 0
- key_link 1 (NavPanel → onNavigate('org-admin') via canManage shield) + key_link 2 (ProfileMenu → switchOrg) — present
- No writes to STATE.md / ROADMAP.md — confirmed

---
*Phase: 166-org-admin-shell-org-switcher-profile-menu-anchor*
*Completed: 2026-07-21*

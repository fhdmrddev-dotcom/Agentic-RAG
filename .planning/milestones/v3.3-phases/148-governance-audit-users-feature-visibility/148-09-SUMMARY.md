---
phase: 148-governance-audit-users-feature-visibility
plan: 09
subsystem: ui
tags: [ADMIN-03, VIS-01, users-roster, feature-visibility, control-room, graded-guards, victim-naming-sheet, enum-not-boolean, no-impersonation, react, tailwind]

# Dependency graph
requires:
  - phase: 148-06
    provides: "GET /admin/users (roster: honest last-active + doc/chat counts + operator role) · POST/…/disable (GoTrue ban + in-flight cancel, self-guard 409) · POST/…/enable · POST|DELETE/…/operator (grant/revoke, self-revoke 409) · PUT /admin/visibility (allowlist-validated enum feature+audience → set_feature_visibility)"
  - phase: 148-08
    provides: "ControlRoomPage shell (five-tab band IA, alive.current fetch-owner pattern, showTechnical two-audience state, recordingPulse band marker) + the api.ts admin-call shape (ApiError, getBackpressure/killRun/setFlag)"
  - phase: 148-07
    provides: "GovernedFeature key union + the require_visible 403 seam (the audience enum this UI writes is the same _VISIBILITY_FEATURES allowlist)"
provides:
  - "api.ts getUsersRoster / disableUser / enableUser / grantOperator / revokeOperator + UserRosterRow/UserRosterPage types"
  - "api.ts setFeatureVisibility(feature, audience) — sends the ENUM audience string (never a boolean) + the FeatureAudience type"
  - "UsersAndAccess.tsx — the 068-A instrument roster: honest last-active, status/role chips, victim-naming disable sheet, direct restorative enable, amber grant/revoke sheets, self-row courtesy guards, ✎ recorded receipts; NO impersonation (D-02)"
  - "FeatureVisibility.tsx — the 069-A audience rows: two-position Everyone | ⛨ Operators-only enum control (never boolean), amber-never-red, consequence line + expandable enforcement details, ✎ visibility.set receipt"
  - "ControlRoomPage: users-access tab UNLOCKED (locked:false), renders UsersAndAccess then FeatureVisibility below it; lazy roster fetch + graded-guard write callbacks + visibility flip callback"
affects: [148-verify-work, 149-model-registry, 150-secrets, 154-plain-language-layer]

# Tech tracking
tech-stack:
  added: []   # zero new packages (reuses the Sheet primitive, lucide icons, the existing api client)
  patterns:
    - "shell-owns-fetch / leaf-owns-guard: ControlRoomPage owns the roster fetch (alive.current honest-degrade) + the server writes; UsersAndAccess + FeatureVisibility are pure presentational leaves that render the graded guards and report the intended action (the ActiveRunsSection/CapabilityGrid precedent)"
    - "graded action guards (066): friction scales with consequence — Disable (has a victim) = the 064-B victim-naming confirm sheet; Enable (restorative) = direct; grant/revoke = amber blast-radius sheet; visibility flip = direct-with-receipt (reversible, no victim)"
    - "no optimistic status flip: after a roster write the shell re-fetches so the status/role chips reflect the SERVER truth; the row only owns a transient ✎ recorded receipt (the server is the source of truth)"
    - "enum-not-boolean audience: the two-position segmented control reads/writes a FeatureAudience enum ('everyone'|'operators'), designed to grow into an audience picker (SEED-115 forward-compat) — never modelled as on/off"
    - "self-guard is courtesy in the UI, wall on the server: self-row Disable/Remove-operator disabled with a tooltip; the real lockout-proof guard is the 148-06 409-before-any-mutation"

key-files:
  created:
    - frontend/src/components/admin/UsersAndAccess.tsx
    - frontend/src/components/admin/FeatureVisibility.tsx
    - .planning/phases/148-governance-audit-users-feature-visibility/148-09-SUMMARY.md
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/components/admin/ControlRoomPage.tsx

key-decisions:
  - "ADMIN-03 + VIS-01 NOT marked complete here — this plan ships the final UI half (users roster + visibility write UI), but the phase's G-4 lived-experience UAT (disabled user is really out; the map is honest + the API is the wall) runs at 148 verify-work. Marking now = a false green (mirrors 148-06/07/08's substrate-not-complete posture). Both close at verify-work when audit + users + visibility are all verified live."
  - "The 069-A visibility rows SEED from the documented day-one polarity (DEFAULT_VISIBILITY == backend _GOVERNED_FEATURES == the mig-098 DB seed) — there is NO read endpoint for the persisted audience map in this frontend-only slice (PUT is the only /admin/visibility route; GET /settings filters feature_visibility out via its response_model). Each flip is a REAL recorded server write; the map reflects it optimistically. A persisted NON-default audience would show stale on a fresh page load — a documented limitation, not a stub (a future GET is the clean fix). Adding a backend read here would violate the plan's frontend-only files_modified contract."
  - "Roster fetch is LAZY (on users-access tab open, re-fetched after each write) rather than on Control Plane mount — keeps the cross-user read OFF the landing path (it only fires when the tab is actually viewed) and leaves the Phase-147 ControlRoomPage.test.tsx untouched (it never opens the tab)."
  - "D-02 impersonation deliberately NOT built — the roster + audit browser + active-runs are the support surface. The only 'impersonation' token in the code is the D-02 comment stating it is not built."

patterns-established:
  - "Victim-naming disable sheet: names the user, states the immediate effect (sign-in refused · API refused · in-flight run cancelled), states what is KEPT (documents/chats/settings, untouched), states reversibility, says it's recorded — the 064-B pattern applied to account disable."
  - "Amber = visibility/role/operator power; red (destructive) reserved for the kill-switches + the Disabled status chip. The feature-visibility surface is amber-warmed and lives BELOW the roster, never adjacent to the kill-switches (the rejected 069-C foil)."

requirements-completed: []  # ADMIN-03 + VIS-01 intentionally NOT marked — the full-feature G-4 UAT closes them at 148 verify-work (see key-decisions)

# Metrics
duration: ~50min
completed: 2026-07-11
---

# Phase 148 Plan 09: Users & Access Roster + Feature Visibility Summary

**One-liner:** The FINAL 148 plan unlocks the Users & Access tab into the 068-A instrument roster — honest last-active (`never signed in` italic, never fabricated), a 064-B victim-naming disable sheet vs. a direct restorative enable, amber grant/revoke blast-radius sheets, and courtesy self-guards — and stacks the 069-A feature-visibility audience rows below it (a two-position Everyone | ⛨ Operators-only control that reads/writes an ENUM, never a boolean — the SEED-115 forward-compat contract — with an "refused server-side, not just hidden" consequence line + expandable enforcement details + a ✎ recorded receipt), all consuming the 148-06 server endpoints as the enforcement floor; impersonation is deliberately absent (D-02).

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-07-11
- **Tasks:** 3 (committed as 4 commits — see the Task-1 split deviation)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- **api.ts client seam:** `getUsersRoster` (roster page), `disableUser`/`enableUser`, `grantOperator`/`revokeOperator`, and `setFeatureVisibility` — the last sends `{feature, audience}` with the ENUM audience string (grep-confirmed: `JSON.stringify({ feature, audience })`, no boolean payload). Added `UserRosterRow`/`UserRosterPage`/`FeatureAudience` types; reused the existing `GovernedFeature` union (it IS the backend `_VISIBILITY_FEATURES` allowlist).
- **UsersAndAccess (068-A):** one dense instrument table — `[avatar] [email / joined · docs · chats] [last-active] [status] [role] [actions]`, email search, server-ordered newest-active-first. Honest last-active: recent = green, stale = dim, NULL = `never signed in` italic (never fabricated). Disable opens the 064-B victim-naming sheet (names the user; effect + KEPT + reversibility + recorded); Enable flips direct (restorative asymmetry); grant/revoke open amber blast-radius sheets. Self-row Disable + Remove-operator are disabled with a courtesy tooltip. Every write flips the row to a ✎ `… · recorded` receipt + a band-marker pulse. NO impersonation control.
- **FeatureVisibility (069-A):** four governed-feature cards (skill_studio · model_management · workflow_authoring · governance_health), each with the two-position `Everyone | ⛨ Operators only` segmented control writing the enum audience. Operators-only is amber-warmed (never kill-switch red); flipping to it reveals the "End users no longer see X — and their API calls to it are refused server-side, not just hidden" consequence line + an expandable `<details>` enforcement grid (UI surface · refused API · who decides; route prefixes behind ⌥). Each flip shows the ✎ `visibility.set` receipt. Lives BELOW the roster, never next to the kill-switches.
- **ControlRoomPage unlock:** flipped the `users-access` tab `locked:false` (retiring the "impersonation coming soon" copy — D-02), rendered `<UsersAndAccess/>` then `<FeatureVisibility/>` below it, added a lazy roster fetch (mirrors `fetchAudit` — `alive.current` + honest-degrade `.catch`) re-fetched after each write, plus the graded-guard write callbacks and the enum visibility-flip callback. `LockedTab` stays for Model Registry (149) / Secrets (150).

## Task Commits

1. **Task 1 (api seam): roster + visibility api client calls** — `8e974a43` (feat)
2. **Task 2: Users & Access roster — instrument table + graded action guards** — `1b480595` (feat)
3. **Task 3: feature-visibility audience rows — enum control + consequence lines** — `7efe89a9` (feat)
4. **Task 1 (shell): unlock the Users & Access tab — render roster + visibility** — `c1110d67` (feat)

**Plan metadata:** (this commit) — docs: complete plan

## Files Created/Modified

- `frontend/src/lib/api.ts` — +`getUsersRoster`/`disableUser`/`enableUser`/`grantOperator`/`revokeOperator`/`setFeatureVisibility` client calls + `UserRosterRow`/`UserRosterPage`/`FeatureAudience` types (reuses the existing `GovernedFeature`). setFeatureVisibility sends the enum audience, never a boolean.
- `frontend/src/components/admin/UsersAndAccess.tsx` (NEW) — the 068-A roster + graded guards (victim-naming disable sheet, direct enable, amber grant/revoke sheets, self-guards, honest last-active, ✎ receipts); no impersonation.
- `frontend/src/components/admin/FeatureVisibility.tsx` (NEW) — the 069-A audience rows (enum segmented control, amber-never-red, consequence line + enforcement `<details>`, ✎ receipt).
- `frontend/src/components/admin/ControlRoomPage.tsx` — unlocked the users-access tab, wired the two leaves + the lazy roster fetch + the graded-guard/visibility write callbacks + band-marker pulse.

## Decisions Made

See frontmatter `key-decisions` — the four load-bearing calls: (1) ADMIN-03/VIS-01 NOT marked complete (the full-feature G-4 UAT closes them at verify-work); (2) the visibility rows seed from the documented day-one polarity (no read endpoint in this frontend-only slice — a documented limitation, not a stub); (3) the roster fetch is lazy on tab-open (keeps the cross-user read off the landing path + leaves the 147 test untouched); (4) D-02 impersonation deliberately absent.

## Deviations from Plan

### Blocking-issue sequencing (build-green per commit)

**1. [Rule 3 - Blocking] Task 1 split into two commits (api seam first, shell wiring last) so every commit builds green**
- **Found during:** Task 1 (api.ts + ControlRoomPage) — the plan groups the api calls and the ControlRoomPage unlock into one task, but they sit at OPPOSITE ends of the dependency chain: api.ts provides the `UserRosterRow`/`FeatureAudience` types the Task-2/3 leaves import, while ControlRoomPage imports those same leaves. A single Task-1 commit could not be independently green (either the leaves don't exist yet, or ControlRoomPage imports uncommitted files).
- **Fix:** committed in dependency order — `8e974a43` (api.ts seam, independently green: pure additive exports), then Task 2 (`1b480595`) + Task 3 (`7efe89a9`) leaves (import the api types), then `c1110d67` (ControlRoomPage wiring, imports both committed leaves). Each of the four commits builds green in isolation.
- **Files modified:** the plan's Task-1 files (`api.ts`, `ControlRoomPage.tsx`) landed in commits 1 and 4 respectively; Tasks 2/3 unchanged.
- **Verification:** `vite build` exit 0; `tsc -b` = 30 (baseline, zero new); `ControlRoomPage.test.tsx` 6/6 green.
- **Committed in:** `8e974a43` / `c1110d67`

**2. [Rule 3 - Blocking] Removed a duplicate `GovernedFeature` type in api.ts**
- **Found during:** Task 1 (first `tsc -b` after adding the api calls) — the type union I added collided with the existing `GovernedFeature` (defined near the top for the `GET /features` effective-map, and it IS the `_VISIBILITY_FEATURES` allowlist). `tsc` reported `TS2300 Duplicate identifier` (count 30 → 32).
- **Fix:** deleted my duplicate; the `setFeatureVisibility` signature reuses the existing union (with a comment pointing to it). Kept only the new `FeatureAudience` type.
- **Verification:** `tsc -b` back to 30 (baseline); zero errors in any touched file.
- **Committed in:** `8e974a43` (Task 1 seam commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - Blocking: build-green commit sequencing + a duplicate-type removal).
**Impact on plan:** No scope creep. The plan's three logical tasks landed as four atomic green commits; the only adjustments were sequencing the coupled edits and reusing the existing feature-key union.

## Issues Encountered

None beyond the two blocking auto-fixes above. The Phase-147 `ControlRoomPage.test.tsx` factory-mocks `@/lib/api` with only 7 functions and never opens the users-access tab, so the lazy roster fetch never fires and the new api calls (`getUsersRoster`, etc.) are never invoked in that test — all 6 tests stay green.

## Build Gate (memory lesson — real numbers)

- **`npx tsc -b` error count:** 30 BEFORE and 30 AFTER (the documented 148-07 baseline — 21 SEED-056 `__tests__` vitest rot + 9 React-19 `@types/react`/zustand `node_modules` drift). A grep of the error list for the four touched files (`api.ts`, `ControlRoomPage.tsx`, `UsersAndAccess.tsx`, `FeatureVisibility.tsx`) is EMPTY — they add ZERO tsc errors above the baseline.
- **`npx vite build`:** SUCCESS (exit 0) — the bundle builds clean.
- Note: `npm run build` (`tsc -b && vite build`) exits non-zero at the `tsc -b` step because of the 30 pre-existing baseline errors — the documented HEAD state (148-07 deferred-items), NOT this plan. The green gate is `vite build` (bundles) + the `tsc -b` count staying ≤ 30.

## Known Stubs / Limitations

- **Feature-visibility read seeds from the day-one default (documented limitation, not a data stub):** there is no GET endpoint for the persisted audience map in this frontend-only slice (PUT `/admin/visibility` is the only visibility route in 148-06; GET `/settings` filters `feature_visibility` out via its `response_model`). The rows seed from `DEFAULT_VISIBILITY`, which is byte-identical to the backend `_GOVERNED_FEATURES` cold-default AND the mig-098 DB seed, so on a fresh deploy the shown audience IS correct. Each flip is a REAL recorded server write (`visibility.set`) and updates the map. The only gap: a previously-persisted NON-default audience would show stale on a fresh page load. A future GET (or adding `feature_visibility` to the settings response) is the clean fix; adding it here would violate the plan's frontend-only `files_modified` contract. No hardcoded/empty data flows to the roster — it renders the live `GET /admin/users` page.

## Threat Flags

None. No new security surface is introduced by the client — every write (disable/enable/grant/revoke/visibility) is server-enforced (148-06) and the sheets/tooltips are UX, not controls. The plan's `<threat_model>` dispositions are all satisfied: T-148-04 (self-guard — UI courtesy tooltip + server 409 = defense in depth), T-148-CONTRACT (audience is an enum, never a boolean), T-148-STYLE (Operators-only amber-warmed, never kill-switch red; visibility below the roster, never adjacent to the kill switches), T-148-D02 (impersonation NOT built), T-148-SC (zero new packages).

## Next Phase Readiness

- **148 verify-work:** ADMIN-03 + VIS-01 are now fully built (audit browser 148-08 + users roster + visibility rows this plan). The phase G-4 lived-experience UAT (148-VALIDATION.md — disabled user is really out; the map is honest + the API is the wall) is buildable end-to-end against the live backend; it closes both requirements.
- **149 (Model Registry) / 150 (Secrets):** the `LockedTab` seam stays intact for those two tabs — the unlock pattern established here (`locked:false` + a render branch, leaves fetched by the shell) is the template they follow.

## Self-Check: PASSED

- Files: FOUND `frontend/src/components/admin/UsersAndAccess.tsx`, `frontend/src/components/admin/FeatureVisibility.tsx`, `frontend/src/lib/api.ts`, `frontend/src/components/admin/ControlRoomPage.tsx`.
- Commits: FOUND `8e974a43` (api seam), `1b480595` (roster), `7efe89a9` (visibility rows), `c1110d67` (tab unlock) in `git log`.
- Build: `vite build` exit 0; `tsc -b` = 30 (baseline, zero new; touched files clean); `ControlRoomPage.test.tsx` 6/6 green.
- Contract greps: `setFeatureVisibility` sends `{ feature, audience }` (enum, no boolean); `never signed in` present in the roster; no impersonation control (only the D-02 comment).

---
*Phase: 148-governance-audit-users-feature-visibility*
*Completed: 2026-07-11*

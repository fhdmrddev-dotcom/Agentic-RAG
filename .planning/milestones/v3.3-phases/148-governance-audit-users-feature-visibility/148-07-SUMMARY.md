---
phase: 148-governance-audit-users-feature-visibility
plan: 07
subsystem: ui
tags: [VIS-01, feature-visibility, react, nav-filtering, effective-features, graceful-403-bounce, render-only]

# Dependency graph
requires:
  - phase: 148-05
    provides: "GET /features authed per-user effective feature->bool map + require_visible 403-not-404 gates on the governed routers"
  - phase: 146
    provides: "useOperatorProbe — the one-shot per-session, userId-keyed, fail-closed probe pattern this hook mirrors"
provides:
  - "useEffectiveFeatures(userId) — one-shot per-session effective-features fetch (mirrors useOperatorProbe), fails CLOSED to {} on error/pre-resolve, exposes refetch()"
  - "getEffectiveFeatures() api client — authed GET /features -> per-user feature->visible map (throws ApiError on non-ok)"
  - "nav vanish — NAV_ITEMS carry a governed-feature key; visibleNavItems(map) DROPS any governed item the caller can't use (never a locked/badged placeholder); wired through App -> ChatLayout(desktop rail + mobile drawer) + NavPanel"
  - "graceful 403 bounce — ApiError(403) dispatches FEATURE_FORBIDDEN_EVENT; App shows a plain refusal matching the server body + setActiveView('chat') + refetches the map"
  - "governance signal reads (getGovBroken/getGovUnclassified/getGovLowConfidence) now throw ApiError(403) so the bounce fires end-to-end for a governance_health tighten"
affects:
  - "148 verify-work (VIS-01 completes here — the frontend hide/bounce half; the phase G-4 UAT in 148-VALIDATION.md validates the lived-experience bounce)"

# Tech tracking
tech-stack:
  added: []   # zero new packages
  patterns:
    - "useEffectiveFeatures mirrors useOperatorProbe VERBATIM (one-shot, userId-keyed WR-01, cancelled guard, fail-closed) — the difference is a features MAP resolving to {} (hide all governed) on error, not a null identity"
    - "ApiError(403) is the single client chokepoint for the graceful bounce — a 403 is uniquely a require_visible refusal in this app (the /admin surface is 404-not-403), so the constructor dispatches one window event and App owns the bounce (render-only)"
    - "nav vanish via a tagged NAV_ITEMS filter (visibleNavItems) — governed items are DROPPED from the list, not disabled/badged; one filter pass feeds both the desktop rail and the mobile drawer"

key-files:
  created:
    - frontend/src/hooks/useEffectiveFeatures.ts
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/lib/nav-items.ts
    - frontend/src/App.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/components/layout/NavPanel.tsx

key-decisions:
  - "Nav filtering required threading a filtered navItems prop through ChatLayout + NavPanel (both consume NAV_ITEMS directly); the plan frontmatter under-listed them. Filtered ONCE in App via visibleNavItems, passed down — both the desktop rail and the mobile drawer hide the same features from one pass."
  - "The bounce mechanism lives at a single client chokepoint: the ApiError constructor dispatches FEATURE_FORBIDDEN_EVENT on status===403 (a 403 is uniquely a require_visible refusal — the /admin surface returns 404). This keeps the bounce render-only and App-owned without instrumenting every governed page or every api fetch."
  - "Rule 2 wiring: the 3 governance signal reads (auto-fetched on GovernancePage mount, and governance_health is the day-one 'everyone'/tightenable feature) were converted from plain Error to ApiError(403) so the bounce actually fires for the realistic mid-session-flip scenario — otherwise the mechanism was correct but unreachable (a stub)."
  - "Fail-CLOSED to {} literal (T-148-FAILCLOSED): the hook starts {} and resolves to {} on error, so the pre-resolve/blip window hides every governed feature rather than flashing an operators-only one. Accepted tradeoff: a brief flicker of the everyone-visible homes (Workflows/Governance) on first load, consistent with how the operator shield already loads."

patterns-established:
  - "Effective-features render gate: a per-session userId-keyed map hides nav + bounces on 403, but the API (require_visible) is the sole authority — the client hide is never a security control (Pitfall 13)."
  - "ApiError-as-bounce-signal: convert a governed read's plain Error to ApiError(status) to opt it into the graceful bounce (one-line, safe — ApiError extends Error, message preserved)."

requirements-completed: []   # VIS-01 completes at phase verify-work (this ships the frontend half; 148-05 shipped the API wall)

# Metrics
duration: 16min
completed: 2026-07-11
---

# Phase 148 Plan 07: VIS-01 Frontend Render Layer (nav vanish + graceful 403 bounce) Summary

**A per-session `useEffectiveFeatures` hook (mirroring `useOperatorProbe`) that hides governed nav items the caller can't use (the sketch 069-A vanish, never a locked badge) and gracefully bounces a mid-session audience tighten home with a plain refusal — render-only, with 148-05's `require_visible` API as the sole security wall.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-07-11T18:42:07Z
- **Completed:** 2026-07-11T18:58:51Z
- **Tasks:** 3 (+ 1 Rule 2 wiring fix)
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- **`useEffectiveFeatures(userId)`** (new `frontend/src/hooks/useEffectiveFeatures.ts`): the direct sibling of `useOperatorProbe` — one-shot per-session fetch keyed to `userId` (WR-01, not App mount), the same `cancelled` late-resolve guard, clears on sign-out / user switch. DIFFERENCE: resolves to a features MAP and **fails CLOSED to `{}`** (hide every governed feature) on error AND pre-resolve — never a `null` identity. Exposes `refetch()` for the bounce re-sync.
- **`getEffectiveFeatures()`** (`api.ts`): authed `GET /features` -> per-user `feature->visible` map; throws `ApiError` on non-ok (every user has a 200 map — NOT the operator-probe's 404->null idiom).
- **Nav vanish** (`nav-items.ts` + `App.tsx` + `ChatLayout.tsx` + `NavPanel.tsx`): `NavItem` carries an optional governed-feature key; `workflows=workflow_authoring`, `governance=governance_health`, `skills=skill_studio`, `settings=model_management`. `visibleNavItems(map)` **drops** any governed item whose key isn't strictly `true` (never a locked/badged placeholder). Filtered once in App, threaded to both the desktop rail and the mobile drawer. Day-one: a non-operator loses **Skills + Settings**; **Workflows + Governance stay** (Everyone audience); an operator's all-true map shows everything.
- **Graceful 403 bounce** (`api.ts` + `App.tsx`): `ApiError(403)` dispatches `FEATURE_FORBIDDEN_EVENT`; App catches it, shows a **plain refusal matching the server body** (`"This feature is available to administrators only."`), `setActiveView("chat")` to route home, and `refetchFeatures()` so the nav re-syncs within the ~30s TTL. Quiet auto-dismissing Deep-Midnight card banner (Lock glyph) — an honest product message, never a crash/blank.
- **Rule 2 wiring:** the 3 governance signal reads now throw `ApiError(403)` so the bounce fires end-to-end for the realistic day-one scenario (a non-operator on the Governance page during a `governance_health` tighten).

## Task Commits

Each task was committed atomically:

1. **Task 1: useEffectiveFeatures hook + getEffectiveFeatures client fn** — `0c8f425e` (feat)
2. **Task 2: nav filtering by the effective-features map (governed items vanish)** — `cbb80db2` (feat)
3. **Task 3: ActiveView 403 graceful bounce (mid-session feature flip)** — `9da46e8d` (feat)
4. **Rule 2 fix: governance signal reads throw ApiError so the 403 bounce fires** — `d435a46a` (fix)

**Plan metadata:** committed separately (SUMMARY + STATE + ROADMAP).

## Files Created/Modified

- `frontend/src/hooks/useEffectiveFeatures.ts` (created) — the one-shot, userId-keyed, fail-closed effective-features hook + `refetch()`.
- `frontend/src/lib/api.ts` — `getEffectiveFeatures()`; `GovernedFeature` + `EffectiveFeatures` types; `FEATURE_FORBIDDEN_EVENT` + the `ApiError(403)` dispatch chokepoint; the 3 governance signal reads converted to `ApiError`.
- `frontend/src/lib/nav-items.ts` — `NavItem.feature?` tag on the 4 governed entries + `visibleNavItems(map)` filter helper (drops, never disables).
- `frontend/src/App.tsx` — `useEffectiveFeatures(user?.id)` alongside the operator probe; `navItems=visibleNavItems(map)` threaded down; the `FEATURE_FORBIDDEN_EVENT` listener (403 -> plain refusal + `setActiveView("chat")` + refetch) + the auto-dismissing refusal banner.
- `frontend/src/components/layout/ChatLayout.tsx` — consume the filtered `navItems` prop (mobile drawer) instead of the raw `NAV_ITEMS` const; pass it to `NavPanel`.
- `frontend/src/components/layout/NavPanel.tsx` — consume the filtered `navItems` prop (desktop rail); operator shield stays outside the list.

## Verification

- **`vite build` (the real bundler): GREEN** (`✓ built in 9.33s`) with all changes — the code genuinely bundles/imports/type-flows.
- **`npm run build` (`tsc -b && vite build`): EXIT 2 — RED, but 100% pre-existing rot.** The tree has **30 pre-existing `tsc -b` errors across 17 files at baseline HEAD (`01188f46`), fingerprinted BEFORE touching anything** (21 in `__tests__/`/`*.test.ts(x)` = the known SEED-056 frontend-vitest rot; 9 in 7 source files = a React-19 `@types/react` `RefObject<T|null>` / zustand-types `node_modules` drift). **The 148-07 changes add ZERO new errors** — verified by diffing the post-change `tsc -b` output against the baseline fingerprint. The only error in any file I touched is the **pre-existing** `NavPanel.tsx(3,1)` unused-`Button` import (out of scope). Logged to `deferred-items.md`. (See the 147 memory lesson: this drift looks introduced by a dependency bump since 147 shipped green.)
- **Acceptance greps (all PASS):** `getEffectiveFeatures()` + `GET /features` present in `api.ts`; the hook's `setFeatures({})` fail-closed fallback; the `ApiError` `status === 403` -> `FEATURE_FORBIDDEN_EVENT` dispatch; `visibleNavItems` filtering `features[item.feature] === true` (drops, not disables); `App.tsx` uses `useEffectiveFeatures` + `visibleNavItems`; the `status !== 403` guard + `setActiveView("chat")` + the exact server refusal copy + `refetchFeatures()`.
- **Bounce scoping confirmed:** the two other `res.status === 403` sites in `api.ts` (folder/skill ownership refusals) throw plain `Error` (NOT `ApiError`), so they correctly do NOT false-trigger the feature-visibility bounce.

## Decisions Made

- **Nav plumbing beyond the frontmatter files:** the plan's `files_modified` listed only `App.tsx` + `nav-items.ts` for the nav filter, but both `NavPanel.tsx` (desktop rail) and `ChatLayout.tsx` (mobile drawer) consume `NAV_ITEMS` directly — the vanish cannot render without them consuming a filtered list. Threaded a single `navItems` prop (filtered once in App) through both. (See Deviations — Rule 3.)
- **Single client chokepoint for the bounce:** dispatch `FEATURE_FORBIDDEN_EVENT` from the `ApiError(403)` constructor rather than instrumenting every governed page or every api fetch. A 403 is uniquely a `require_visible` refusal here (the `/admin` surface is 404-not-403), so the mapping is unambiguous, and App owns the bounce render-only.
- **Literal fail-closed `{}`** (T-148-FAILCLOSED): hide-until-known rather than show-until-known — a blip never flashes an operators-only feature. Accepted the brief first-load flicker of the everyone-visible homes, consistent with the existing operator-shield load.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Threaded the filtered `navItems` through `ChatLayout` + `NavPanel`**
- **Found during:** Task 2 (nav filtering)
- **Issue:** The plan's Task 2 `<files>` listed only `App.tsx` + `nav-items.ts`, but the vanish is unreachable unless the two nav consumers (`NavPanel` desktop rail, `ChatLayout` mobile drawer) render the filtered list — both import `NAV_ITEMS` directly.
- **Fix:** Added a `navItems: readonly NavItem[]` prop to both, swapped their `NAV_ITEMS` map for it, and filter once in App via `visibleNavItems`. Left the raw `NAV_ITEMS` const exported (the 146 non-discoverability regression test still consumes it).
- **Files modified:** `frontend/src/components/layout/ChatLayout.tsx`, `frontend/src/components/layout/NavPanel.tsx`
- **Verification:** `vite build` green; `tsc -b` adds zero new errors vs. the baseline fingerprint.
- **Committed in:** `cbb80db2` (Task 2 commit)

**2. [Rule 2 - Missing Critical] Governance signal reads throw `ApiError(403)` so the bounce actually fires**
- **Found during:** Task 3 (graceful bounce)
- **Issue:** The bounce mechanism (App listener + `ApiError(403)` dispatch) was correct but **could never fire** — every governed page-fetch function (incl. the 3 governance signal reads `GovernancePage` auto-fetches on mount) threw a plain `Error`, dropping `res.status`. A non-firing bounce is a stub.
- **Fix:** Converted `getGovBroken` / `getGovUnclassified` / `getGovLowConfidence` to `throw new ApiError(msg, res.status)`. `governance_health` is the day-one Everyone/tightenable feature, and its page auto-fetches on mount, so this is the realistic mid-session-flip path. `ApiError` extends `Error` + preserves the message, so `GovernancePage`'s per-card message catch is unaffected.
- **Files modified:** `frontend/src/lib/api.ts`
- **Verification:** `vite build` green; `tsc -b` adds zero new errors; bounce greps pass.
- **Committed in:** `d435a46a` (Rule 2 fix commit)

---

**Total deviations:** 2 auto-fixed (1 blocking plumbing, 1 missing-critical wiring)
**Impact on plan:** Both necessary for the plan's goal (a rendered vanish + a firing bounce). No scope creep beyond making the stated features actually work end-to-end; the raw `NAV_ITEMS` export and the 146 non-discoverability contract are untouched.

## Known Stubs

**Partial-coverage bounce (documented, not blocking):** the graceful 403 bounce fires for any `ApiError(403)`, and the realistic day-one path (Governance, via the Rule 2 wiring) is fully functional. The **remaining governed api functions still throw plain `Error`** (workflow-authoring mutations: create/patch/delete/publish/generate/drafts; the `skill_studio` evals/tuner/test-cases reads; the `model_management` settings reads) — each would need the same one-line `Error -> ApiError(res.status)` conversion to opt into the bounce. This is **not blocking the plan goal** because:
- `skill_studio` + `model_management` are **Operators-only day-one** — their nav items vanish for a non-operator, who therefore cannot reach those pages to trigger a bounce (the tighten direction doesn't apply).
- `workflow_authoring` bounce requires an explicit Builder **mutation** (save/publish), a rarer mid-session path than a page-mount read; the nav vanish already prevents the dead-click entry.
The phase **G-4 UAT (148-VALIDATION.md)** validates the lived-experience governance bounce. Converting the remaining governed reads/mutations is a clean, safe follow-up if UAT wants the bounce on every governed surface.

## Threat Flags

None. All security-relevant surface (the `GET /features` consumption, the 403 bounce) was enumerated in the plan's `<threat_model>` (T-148-07 accept, T-148-FAILCLOSED mitigate, T-148-SC accept). The fail-closed `{}` mitigation is implemented (hook resolves `{}` on error/pre-resolve). Zero new packages. No new network endpoint, auth path, or trust-boundary schema change — the frontend is render-only; 148-05's `require_visible` API remains the sole enforcement authority.

## Issues Encountered

**Pre-existing frontend build rot (out of scope).** `npm run build` (`tsc -b`) is RED at baseline with 30 pre-existing type errors in unrelated files (SEED-056 test rot + a React-19 `@types/react`/zustand `node_modules` drift). This blocks a hard-green `npm run build` gate through no fault of this plan. Resolved by: fingerprinting the baseline, verifying the 148-07 changes add zero new errors (diff), confirming the real `vite build` bundles green, and logging the full breakdown + re-open trigger to `.planning/phases/148-.../deferred-items.md`. Reported honestly per the 147 build-gate lesson — the build result is the real one (EXIT 2, all pre-existing).

## User Setup Required

None — no external service configuration. Pure frontend render layer; consumes the already-shipped `GET /features` (148-05).

## Next Phase Readiness

- **148 verify-work:** VIS-01 completes here (the frontend hide/bounce half; 148-05 shipped the API wall). The phase G-4 UAT (148-VALIDATION.md) should exercise: a non-operator's nav (Skills + Settings gone, Workflows + Governance present); an operator's nav (all present); and the mid-session `governance_health` tighten bounce (Governance page -> plain refusal -> routed to Chat -> Run still works).
- **Deferred (non-blocking):** the pre-existing frontend build rot (30 errors) and the partial-coverage bounce (remaining governed api functions) are both logged in `deferred-items.md` with re-open triggers.

## Self-Check: PASSED

- Files: FOUND `frontend/src/hooks/useEffectiveFeatures.ts`, FOUND `frontend/src/lib/api.ts`, FOUND `frontend/src/lib/nav-items.ts`, FOUND `frontend/src/App.tsx`, FOUND `frontend/src/components/layout/ChatLayout.tsx`, FOUND `frontend/src/components/layout/NavPanel.tsx`, FOUND `.planning/phases/148-.../deferred-items.md`.
- Commits: FOUND `0c8f425e` (Task 1), FOUND `cbb80db2` (Task 2), FOUND `9da46e8d` (Task 3), FOUND `d435a46a` (Rule 2 fix).

---
*Phase: 148-governance-audit-users-feature-visibility*
*Completed: 2026-07-11*

---
phase: 156-everyday-ux-polish-stretch
plan: 04
subsystem: ui
tags: [react, vitest, typescript, mobile-drawer, search, thread-grouping, folder-view, xss, threads]

# Dependency graph
requires:
  - phase: 156-01
    provides: "the shared @/lib/threadGroups engine (matchesTitle / groupByDate / bucketFor / folderLabel / XSS-safe HighlightTitle) reused by both tasks; the ChatHistoryColumn.test scaffold Task 2 extends"
  - phase: 156-02
    provides: "the desktop ChatHistoryColumn (inline filter + date grouping) that Task 2 extends with the Folder view; the ChatLayout mobile-drawer structure (flat threads.map + New Chat + folder select + bottom nav + isOperator shield) Task 1 adds search above"
  - phase: 156-03
    provides: "the global ⌘K ThreadCommandPalette — deliberately UNTOUCHED here (no mobile ⌘K, desktop-keyboard-first D-08)"
provides:
  - "frontend/src/components/layout/ChatLayout.tsx — a 'Search chats…' title-search box above the mobile drawer's threads.map, narrowing the flat list via the shared matchesTitle (SC#2 reaches mobile / D-08); row titles via XSS-safe HighlightTitle; honest empty-state; drawer otherwise byte-identical (New Chat / folder select / bottom nav / operator shield); NO mobile ⌘K"
  - "frontend/src/lib/threadGroups.tsx — groupByFolder(threads, folders): folders-array order, unresolved-id 'Folder' then 'Unfiled' LAST, empty-fold, within-group updated_at DESC (reuses folderLabel; drops no thread)"
  - "frontend/src/components/layout/ChatHistoryColumn.tsx — an OPTIONAL Date⇄Folder segmented toggle (aria-pressed) DEFAULTING to date (SC#3 unaffected); folder mode swaps each row's folder chip for its date bucket (reusing bucketFor — no second helper)"
affects: [phase-156-verification (live Chrome-MCP mobile-drawer search + the SC-defining 'rail stops starving history' UAT before POLISH-01 is marked)]

# Tech tracking
tech-stack:
  added: []  # frontend-only, no package, no backend, no migration
  patterns:
    - "The mobile drawer reuses the ONE shared matchesTitle + HighlightTitle engine — the SAME predicate as the desktop column and the ⌘K palette, so the three search surfaces stay behaviorally identical and the XSS control (T-156-01) is proven once (Plan 01)"
    - "Optional Folder view via a single groupByFolder helper (folders-array order, 'Unfiled' last, orphan 'Folder' before it, empty-fold, within-group updated_at DESC) — the row-meta 'redundant folder chip → date bucket' swap reuses the existing tested bucketFor, so folder mode adds NO second helper (stays inside the D-04 cut-line)"
    - "aria-pressed segmented toggle (role=group, two <button>s) — keeps lint:a11y at exit 0, mirroring the app's toggle-button idiom (TechnicalNamesToggle / CapabilityGrid)"

key-files:
  created: []
  modified:
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/lib/threadGroups.tsx
    - frontend/src/lib/__tests__/threadGroups.test.tsx
    - frontend/src/components/layout/ChatHistoryColumn.tsx
    - frontend/src/components/layout/__tests__/ChatHistoryColumn.test.tsx

key-decisions:
  - "Task 2 (the OPTIONAL Date⇄Folder toggle) was SHIPPED, not deferred: it fit the D-04 cut-line exactly — one new groupByFolder helper (reusing folderLabel + the same DESC-sort idiom) + a groupMode state + a small segmented toggle. It reuses existing tested primitives (folderLabel / bucketFor / the sort), adds no dependency, no new state machine beyond a 2-value enum, and does not touch the Wave-1 layout or the Wave-2 palette."
  - "The 'half-measure' risk (a redundant folder-name chip on every row inside its own folder group) was resolved by swapping the folder-mode row meta to the row's date bucket via the EXISTING bucketFor — a clean, non-redundant folder view with NO second (relDate) helper, so the cut-line budget held."
  - "DATE remains the locked default (groupMode initial 'date'), so SC#3 (date grouping) is satisfied by an untouched column — the toggle gates no Success Criterion."
  - "NO ⌘K on mobile (D-08, desktop-keyboard-first): Task 1 added a plain controlled input only; the pre-existing window-level ⌘K keydown (Wave 2) is unchanged, and no drawer-level keydown was added."
  - "POLISH-01 left OPEN (requirements.mark-complete NOT called): the three SCs are now code-complete across Waves 1–3, but the SC-defining 'the rail stops starving history' + the live mobile-drawer search proof need Chrome-MCP UAT (jsdom can't compute layout) — consistent with the Wave-0/1/2 decision and the 148–155 false-green-avoidance convention. Phase status advanced to ready_for_verification (last plan)."

patterns-established:
  - "Reuse-the-one-engine: every thread search/group surface (desktop column, ⌘K palette, mobile drawer) transforms `threads` through the same @/lib/threadGroups predicates — no per-surface reimplementation, one XSS proof"
  - "Cut-line-first optional work: an in-scope-if-cheap enhancement ships only when it reuses existing helpers and stays inside the stated budget; the redundant-chrome escape (bucketFor meta swap) keeps it non-half-measure without a new helper"

requirements-completed: []  # POLISH-01 is phase-spanning — deliberately NOT marked; closes at /gsd:verify-work 156 after the live UAT (Wave-0/1/2 precedent + 148–155 convention)

# Metrics
duration: 15min
completed: 2026-07-16
---

# Phase 156 Plan 04: Wave 3 — Mobile Drawer Search + Optional Date⇄Folder Toggle Summary

**SC#2 reaches mobile — the drawer's flat thread list gains a 'Search chats…' box that narrows it through the SAME shared `matchesTitle` predicate the desktop column and ⌘K palette use (XSS-safe `HighlightTitle` titles, honest empty-state, drawer otherwise byte-identical incl. the probe-gated operator shield, NO mobile ⌘K) — and the OPTIONAL D-04 Date⇄Folder segmented toggle shipped in-budget: a single `groupByFolder` helper (folders-order, 'Unfiled' last, empty-fold, within-group DESC) + a `groupMode` state DEFAULTING to date (SC#3 untouched), folder mode swapping each row's folder chip for its date bucket via the existing `bucketFor`.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-16T21:14:00+04:00
- **Completed:** 2026-07-16T21:29:00+04:00
- **Tasks:** 2 (Task 1 required; Task 2 optional — SHIPPED)
- **Files created:** 0 · **Files modified:** 5

## Accomplishments
- **Task 1 (required) — mobile drawer title search (D-08):** added a controlled `<input>` (placeholder "Search chats…", `mobileQuery` state, a lucide `Search` icon) directly above the mobile drawer's `threads.map`, filtering the list through the shared `matchesTitle(thread, mobileQuery)` — SC#2 now reaches mobile the SAME way the desktop column filters. Row titles render through the XSS-safe `HighlightTitle` (JSX text nodes, never `dangerouslySetInnerHTML`) for parity with the column. The honest empty-state shows **"No chats match your search."** while searching vs **"No recent chats"** at rest. The New Chat button, folder `<select>`, row markup, the bottom nav-icon row, and the `isOperator`-gated operator shield (D-07) stayed byte-identical; **no ⌘K handler was added to the drawer** (desktop-keyboard-first, D-08).
- **Task 2 (optional — SHIPPED in-budget) — Date⇄Folder toggle (D-04):** new `groupByFolder(threads, folders)` in `threadGroups.tsx` (groups by `folderLabel`, folders-array order, unresolved-id "Folder" then "Unfiled" LAST, empty groups dropped, within-group `updated_at` DESC — reuses `folderLabel`, drops no thread) + 4 unit tests. In `ChatHistoryColumn`, a `groupMode: "date" | "folder"` state DEFAULTING to **date** (SC#3 unaffected), a compact `aria-pressed` segmented toggle in the header (sketch `.seg`), and a branched group iteration (`groupByFolder` vs `groupByDate`). Folder mode swaps each row's (now-redundant) folder chip for its **date bucket** via the existing `bucketFor` — a non-redundant folder view with no second helper. +3 toggle tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add a title-search box to the mobile drawer thread list (D-08)** — `bac6d1ee` (feat)
2. **Task 2 (OPTIONAL — shipped): Date⇄Folder segmented toggle + groupByFolder** — `48f9205e` (feat)

**Plan metadata:** `<this commit>` (docs: complete plan)

## Files Created/Modified
- `frontend/src/components/layout/ChatLayout.tsx` (modified) — `mobileQuery` state + `mobileFiltered` derived list + the "Search chats…" input above the drawer's `threads.map` + `HighlightTitle` row titles + honest empty-state; imports `matchesTitle`/`HighlightTitle` + the `Search` icon. Drawer chrome + operator shield byte-identical; no mobile ⌘K.
- `frontend/src/lib/threadGroups.tsx` (modified) — new `groupByFolder(threads, folders)` helper (folders-order, "Unfiled" last, orphan "Folder", empty-fold, within-group DESC; reuses `folderLabel`).
- `frontend/src/lib/__tests__/threadGroups.test.tsx` (modified) — +4 `groupByFolder` unit tests (order/Unfiled-last/empty-fold, within-group DESC, orphan-id "Folder", empty input).
- `frontend/src/components/layout/ChatHistoryColumn.tsx` (modified) — `groupMode` state (default date), the `aria-pressed` Date⇄Folder segmented toggle, branched `groups`, and the folder-mode row-meta swap to `bucketFor`; imports `bucketFor`/`groupByFolder`.
- `frontend/src/components/layout/__tests__/ChatHistoryColumn.test.tsx` (modified) — +3 toggle tests (default is Date + SC#3 intact; switching to Folder groups by folder name with Unfiled last; the inline filter still works in Folder mode).

## Decisions Made
- **Task 2 shipped rather than deferred.** The D-04 cut-line is "a small `groupMode` state + one `groupByFolder` helper." The realized design fits exactly: one new helper (reusing `folderLabel` + the same DESC-sort idiom), a 2-value `groupMode` enum, a small segmented toggle, and — crucially — the folder-mode row meta reuses the EXISTING `bucketFor` rather than introducing a second `relDate` helper. No dependency, no layout/palette changes. It stayed trivial, so it was included per "in-scope-if-cheap."
- **Non-half-measure folder view.** In folder mode the per-row folder chip would be redundant (the group header already names the folder), so it is swapped for the row's date bucket — the clean, sketch-aligned behavior — without any new helper.
- **DATE stays the locked default**, so SC#3 is satisfied by an untouched column; the toggle gates no Success Criterion.
- **No mobile ⌘K** (D-08): a plain controlled input only; the Wave-2 window-level ⌘K keydown is unchanged and no drawer keydown was added.
- **POLISH-01 kept OPEN** — the three SCs are code-complete across Waves 1–3, but the live "rail stops starving history" + mobile-drawer-search proof are Chrome-MCP-only (jsdom can't compute layout); `requirements.mark-complete` deliberately not called (Wave-0/1/2 precedent + 148–155 convention). Phase status advanced to ready_for_verification.

## Deviations from Plan

None — plan executed exactly as written. Task 1 was implemented as specified; Task 2 (explicitly optional/cut-able) was assessed against the D-04 cut-line and SHIPPED because the in-budget design (one `groupByFolder` helper + `groupMode` state + small toggle, folder-mode meta reusing `bucketFor`) qualified as trivial. No auto-fixes (Rules 1–3), no architectural changes (Rule 4), no auth gates, no package installs, no `checkpoint:` tasks.

## Issues Encountered
None. The `HTMLCanvasElement.getContext()` "Not implemented" lines in the vitest output are pre-existing jsdom noise (canvas package absent), unrelated to this plan.

## Threat Surface
No new security surface — pure-client transforms over the caller's own already-loaded, RLS-scoped `threads` (Architectural Responsibility Map: Browser/Client only; no endpoint, query, migration, auth path, or session added). The threat-register mitigations hold verifiably:
- **T-156-01 (stored XSS via mobile drawer title + highlight — mitigate):** the drawer renders titles through `HighlightTitle` JSX text nodes; `grep -c dangerouslySetInnerHTML ChatLayout.tsx` == 0 and `… threadGroups.tsx` == 0.
- **T-156-05 (elevation of privilege via the operator shield — mitigate):** the `isOperator`-gated drawer shield stays OUTSIDE `NAV_ITEMS` and byte-identical; `grep -c "Control Room" ChatLayout.tsx` == 4 (unchanged from baseline).
- **T-156-SC (supply chain — mitigate):** NO package installed; supply-chain surface unchanged.

No `## Threat Flags` — nothing new introduced (no network endpoint, auth path, file access, or schema change at a trust boundary).

## Known Stubs
None. The "No chats match your search." / "No recent chats" strings are honest empty-states (not stubs); both tasks read real ChatLayout-owned `threads` + `folders`, no mock/placeholder data.

## User Setup Required
None — frontend-only, no external service configuration, no migration, no new dependency, no cloud parity.

## Verification Evidence
- `npx vitest run` on the 3 target files → **38 passed / 0 failed** (ChatLayoutLaunch 2 non-regression + threadGroups 18 [14 baseline + 4 new groupByFolder] + ChatHistoryColumn 18 [15 baseline + 3 new toggle]). `ChatHistoryColumn.a11y` → **6/6** (the toggle + folder mode pass vitest-axe AA).
- `npx tsc -b --force` → **29 errors, 0 net-new** vs the documented baseline; ZERO errors reference `ChatLayout.tsx`, `threadGroups.tsx`, or `ChatHistoryColumn.tsx` (the sole touched-file baseline hit remains the pre-existing `ChatLayoutLaunch.test.tsx:126` TS2740 mock rot, untouched).
- `npx vite build` → **exit 0** (the new `groupByFolder` import chain resolves + bundles).
- `npm run lint:a11y` (Phase-155 CI gate) → **exit 0** (the new mobile search input has `aria-label`; the toggle uses `aria-pressed` in a `role=group`).
- Source guards: `grep -c "Control Room" ChatLayout.tsx` == **4** (shield intact); `grep -c dangerouslySetInnerHTML` == **0** (ChatLayout.tsx + threadGroups.tsx); `matchesTitle` present in ChatLayout.tsx; no drawer-level ⌘K keydown added; both task commits contain 0 file deletions.

## Next Phase Readiness
- **All three Success Criteria are code-complete** across Waves 1–3: SC#1 (New Chat always reachable — rail + column, Wave 1), SC#2 (search — inline filter Wave 1 + ⌘K Wave 2 + mobile drawer Wave 3), SC#3 (date grouping Wave 1; optional folder grouping this wave). BUG-260711-01 crowding is structurally relieved (D-10, Wave 1).
- **Live Chrome-MCP UAT (phase gate, required before POLISH-01 is marked):** on a mobile viewport, open the drawer → the "Search chats…" box narrows the list; the bottom nav row + operator shield are unchanged; no ⌘K on mobile. On desktop, the Date⇄Folder toggle defaults to Date and switches cleanly (folder groups with "Unfiled" last). Plus the SC-defining "the thin rail no longer starves the history column" — jsdom can't compute layout, so these close the requirement at `/gsd:verify-work 156`.
- No blockers.

## Self-Check: PASSED
- Files verified present: `156-04-SUMMARY.md` (created); `ChatLayout.tsx`, `threadGroups.tsx`, `threadGroups.test.tsx`, `ChatHistoryColumn.tsx`, `ChatHistoryColumn.test.tsx` (all modified) — all FOUND.
- Commits verified in `git log`: `bac6d1ee` (Task 1), `48f9205e` (Task 2) — both FOUND.
- Gates re-run green: 38/38 vitest across the 3 target files + 6/6 a11y; `tsc -b` 29 (0 net-new); `vite build` + `lint:a11y` exit 0.

---
*Phase: 156-everyday-ux-polish-stretch*
*Completed: 2026-07-16*

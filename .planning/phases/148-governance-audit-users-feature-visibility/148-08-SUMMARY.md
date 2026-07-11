---
phase: 148-governance-audit-users-feature-visibility
plan: 08
subsystem: ui
tags: [ADMIN-03, audit-browser, control-room, chip-filters, csv-export, cross-provider-agnostic, SC4, react, tailwind]

# Dependency graph
requires:
  - phase: 148-06
    provides: "GET /admin/platform-audit (recorded browse) + /admin/platform-audit/export (capped CSV, audit.export names exact count / over-cap 413 records nothing)"
  - phase: 148-07
    provides: "VIS-01 render layer + the api.ts ApiError(403) feature-forbidden seam (unchanged — /admin never returns 403, so the export ApiError never trips the bounce)"
  - phase: 147
    provides: "ControlRoomPage shell (five-tab band IA, fetch-owner/alive.current pattern, showTechnical two-audience state) + AuditTab placeholder + RecentActionsCard receipt vocabulary"
  - phase: 114
    provides: "FilterBar 029-A chip-strip grammar (chip + remove-X + live amber-at-zero count)"
provides:
  - "api.ts getPlatformAudit(filters, page, pageSize) — recorded cross-user browse client call"
  - "api.ts exportPlatformAudit(filters) — capped CSV download; over-cap 413 surfaced as ApiError (never a partial download)"
  - "PlatformAuditFilters / PlatformAuditRow / PlatformAuditPage client types"
  - "ControlRoomPage: audit source state + guarded platform fetcher (queryPlatform) + recorded export handler (handleExportPlatform, re-reads the operator ledger so the ✎ audit.export receipt lands)"
  - "AuditTab upgraded to the 067-A one-browser-two-sources audit browser (source switch + 029-A chip filters + pager + count-naming recorded CSV + view-platform legibility note)"
affects: [148-09, 148-verify-work, 154-plain-language-layer]

# Tech tracking
tech-stack:
  added: []   # zero new packages (reuses the FilterBar chip grammar + existing api client + lucide icons)
  patterns:
    - "one-browser-two-sources: a locked source switch renders BOTH ledgers (operator_audit_log + platform audit_log) through ONE filter/pager/CSV grammar — never a second platform-activity page"
    - "shell-owns-fetch / leaf-owns-filter: ControlRoomPage owns the guarded fetch (alive.current + honest-degrade .catch) + provides the recorded export callback; AuditTab holds the 029-A filter state and calls up on change"
    - "honest counts: operator source counts client-side (exact over the ≤200 loaded rows); platform source is COUNT-free server pagination (page i + has_more Next, no fabricated total — SC#4 no full-tenant leak); export names the exact count when known, else 'all matching' + the server receipt names it"
    - "recorded cross-user read made legible: every platform browse records audit.view_platform server-side; the UI shows the quiet 'Looking at user activity is itself recorded.' note (the SC#4 threat surfaced, never silent)"

key-files:
  created:
    - .planning/phases/148-governance-audit-users-feature-visibility/148-08-SUMMARY.md
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/components/admin/ControlRoomPage.tsx
    - frontend/src/components/admin/AuditTab.tsx

key-decisions:
  - "Skipped requirements.mark-complete for ADMIN-03 — this plan ships the AUDIT half of ADMIN-03 (Governance — Audit, Users); the users roster/disable UI lands in 148-09. Marking now would be a false green (mirrors 148-06's substrate-not-complete posture); ADMIN-03 completes at 148 verify-work when audit + users + visibility all land."
  - "Operator-source export is a client-side CSV of the filtered rows (no operator-log export endpoint exists — these are the operator's OWN already-recorded actions, no cross-user read to record). The PLATFORM export is the recorded server endpoint (audit.export). This honours 'one CSV grammar on both' without inventing a backend receipt for a non-cross-user read."
  - "Platform pager shows 'page i' (no 'of N') — the browse endpoint is COUNT-free by design (has_more only; no full-tenant total leak, SC#4). Operator source (client-paged over the loaded set) shows 'page i of N'. No fabricated total anywhere."
  - "Export button names the LIVE match count ('Export 342 entries'); when the platform total is not fully known (has_more) it honestly reads 'Export all matching entries' and the server receipt names the exact count in the ledger."
  - "The FilterBar '+ condition' arbitrary-condition affordance was adapted to the FIXED audit dimensions (action-type + date + platform per-user) — each is a 029-A chip with a popover editor + remove-X — rather than a free add-any-condition builder, which does not map to a fixed-dimension audit filter."

patterns-established:
  - "Source-aware action vocabulary: platform = the fixed 4-group plain-first map (Documents / Chat & agent / Organizing / Other) over the 19-action audit_log CHECK vocab; operator = options derived from the codes present in the loaded ledger. Raw action_type codes sit behind the shared ⌥ Technical names toggle."
  - "UTC-day custom range: date-preset chips resolve to a half-open [since, until) UTC window; the custom 'To' day resolves to the START of the next day so the picked day is fully included and the <input type=date> round-trips exactly (no TZ off-by-one)."

requirements-completed: []  # ADMIN-03 intentionally NOT marked complete — audit half only; users roster (148-09) + phase verify-work close it (see key-decisions)

# Metrics
duration: ~55min
completed: 2026-07-11
---

# Phase 148 Plan 08: Governance Audit Browser Summary

**The 067-A one-browser-two-sources audit surface — a locked Operator-actions | Platform-activity source switch over BOTH ledgers, driven by one 029-A chip-filter (action-type + date-preset + click-a-user) / pager / count-naming recorded-CSV grammar, with the cross-user read made legible ('Looking at user activity is itself recorded.') and the over-cap export refused, not truncated.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-07-11
- **Tasks:** 3
- **Files modified:** 3 (api.ts, ControlRoomPage.tsx, AuditTab.tsx)

## Accomplishments
- Upgraded the placeholder AuditTab ("search, date filters & export coming soon") into the full 067-A browser: a locked source switch between the operator ledger (`operator_audit_log`) and the cross-user platform ledger (`audit_log`), one filter/pager/CSV grammar on both — never a second platform-activity page.
- Wired the two 148-06 endpoints into a thin client (`getPlatformAudit` recorded browse + `exportPlatformAudit` capped CSV) with the shell owning the guarded fetch (`alive.current` honest-degrade) and the operator source paging client-side — no unbounded client-side fetch.
- Delivered the 029-A chip strip: an action-type chip with a grouped plain-first popover (Documents / Chat & agent / Organizing / Other), a date chip (Today / 7d / 30d / All / custom-range) with a resolved-window readout, a platform per-user chip set by clicking a user in a row, a live amber-at-zero match count, and raw `action_type` codes behind the shared ⌥ Technical names toggle.
- Delivered the count-naming recorded CSV export (the server records `audit.export` naming the exact count → the ✎ receipt lands in the operator ledger on the next read) with the over-cap 413 surfaced as "Too many rows — narrow the filter" (no partial download), plus the quiet "Looking at user activity is itself recorded." note on the Platform source (SC#4 threat made legible).

## Task Commits

Each task was committed atomically:

1. **Task 1: platform-audit api calls + ControlRoomPage source/fetch plumbing** — `c4422b33` (feat)
2. **Task 2: AuditTab 029-A chip filters + plain-first labels + pager + click-user-to-filter** — `0829e891` (feat)
3. **Task 3: count-naming recorded CSV export + view-platform legibility note** — `5879a346` (feat)

**Plan metadata:** (this commit) — docs: complete plan

## Files Created/Modified
- `frontend/src/lib/api.ts` — added `getPlatformAudit` (recorded cross-user browse), `exportPlatformAudit` (capped CSV download; over-cap 413 → ApiError, never a partial download), and the `PlatformAuditFilters` / `PlatformAuditRow` / `PlatformAuditPage` types. Shared `platformAuditParams` builder so the export set is EXACTLY the browsed set.
- `frontend/src/components/admin/ControlRoomPage.tsx` — added the audit `source` state, the guarded `queryPlatform` fetcher (alive.current + honest-degrade `.catch`), and `handleExportPlatform` (re-reads the operator ledger after a success so the ✎ `audit.export` receipt lands); threads `source` / `operatorRows` / `platformResult` / fetch + export callbacks / `showTechnical` down to AuditTab (one browser, two ledgers).
- `frontend/src/components/admin/AuditTab.tsx` — full 067-A rewrite: source switch, 029-A chip filters (action-type grouped plain-first popover + date-preset chip with resolved-window readout + platform per-user chip), live amber-at-zero count, two row shapes, the ‹ Prev · page · Next › pager, the count-naming CSV export button (platform recorded / operator client-side), the over-cap refusal message, and the view-platform legibility note. Keeps the existing ✎ write-mark + `formatWhen`.

## Decisions Made
See frontmatter `key-decisions` — the five load-bearing calls: (1) ADMIN-03 not marked complete (audit half only; users roster is 148-09); (2) operator export is a client-side CSV (no cross-user read to record) while the platform export is the recorded server endpoint; (3) the platform pager shows `page i` with no fabricated `of N` (the browse is COUNT-free by design — SC#4); (4) the export button names the live count, or "all matching" when has_more (the server receipt then names the exact count); (5) the FilterBar `+ condition` affordance adapted to the fixed audit dimensions as removable 029-A chips.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1 also touched AuditTab.tsx; Task 3 also touched ControlRoomPage.tsx (props-seam consistency under `noUnusedLocals`)**
- **Found during:** Task 1 (and again Task 3)
- **Issue:** The plan's per-task file lists put AuditTab solely in Tasks 2–3 and ControlRoomPage solely in Task 1. But `tsconfig.app.json` sets `noUnusedLocals`/`noUnusedParameters` true and TS errors on excess/unknown props — so ControlRoomPage's new state and AuditTab's props interface MUST change in the same commit for the build to stay green. A ControlRoomPage-only Task 1 (state introduced but not consumed) would not compile, and passing the export prop in Task 3 requires ControlRoomPage's export handler in the same commit.
- **Fix:** Task 1 established the full AuditTab props seam + source switch + pager alongside the api.ts calls and shell plumbing; Task 3 added the export callback to ControlRoomPage alongside the AuditTab export button. Each commit builds green (vite exit 0, tsc ≤ 30).
- **Files modified:** frontend/src/components/admin/AuditTab.tsx (Task 1), frontend/src/components/admin/ControlRoomPage.tsx (Task 3)
- **Verification:** `npx tsc -b | grep -c "error TS"` = 30 at every commit (baseline, zero new); `npx vite build` exit 0 at every commit; the Phase-147 `ControlRoomPage.test.tsx` (6 tests) stays green.
- **Committed in:** `c4422b33` / `5879a346` (task commits)

---

**Total deviations:** 1 auto-fixed (1 blocking — build-green props-seam consistency).
**Impact on plan:** No scope creep. The plan's three logical tasks landed as three atomic green commits; the only adjustment was co-locating the coupled file edits so each commit compiles under `noUnusedLocals`.

## Issues Encountered
None beyond the props-seam coupling above. The Phase-147 `ControlRoomPage.test.tsx` factory-mocks `@/lib/api` without the new `getPlatformAudit`/`exportPlatformAudit` — verified harmless: those are only invoked on the platform source / export interaction, which the "View all → Audit" test (operator source) never reaches; all 6 tests pass.

## Build Gate (memory lesson — real numbers)
- **`npx tsc -b` error count:** 30 before AND after (the known pre-existing baseline: 21 SEED-056 `__tests__` vitest rot + 9 React-19 `@types/react`/zustand node_modules drift). The three touched files (`api.ts`, `ControlRoomPage.tsx`, `AuditTab.tsx`) contribute **ZERO** tsc errors (grep of the error list for those files = empty, before and after). No new errors above the baseline.
- **`npx vite build`:** SUCCESS (exit 0) at every task commit and at final.
- Note: `npm run build` (`tsc -b && vite build`) exits non-zero at the `tsc -b` step because of the 30 pre-existing baseline errors — this is the documented HEAD state (148-07 deferred-items), not this plan. The green gate is `vite build` (bundles) + the `tsc -b` count staying ≤ 30.

## Known Stubs
None. Both endpoints are wired to their real 148-06 collaborators; the operator source renders the live operator ledger; the platform source renders live server pages. No hardcoded/empty data flows to the UI.

## Threat Flags
None. The only security-relevant surface (the cross-user platform browse + the CSV export) is exactly the plan's `T-148-01` (Information Disclosure, mitigate) — the UI names the export count, surfaces the over-cap refusal (no partial download), and makes the recorded cross-user read legible; server-side scope/cap/record enforcement lives in 148-04/06. No new trust-boundary surface introduced by the client.

## Next Phase Readiness
- 148-09 (the last plan) delivers the Users & Access roster + Feature Visibility rows (the other half of ADMIN-03 + VIS-01 write UI), unlocking the `users-access` tab. ADMIN-03 + VIS-01 close at 148 verify-work when audit + users + visibility have all landed.
- Lived-experience G-4 UAT (148-VALIDATION.md): "export row count matches the shown count + a ✎ Exported N receipt appears" is now buildable end-to-end against the live backend.

---
*Phase: 148-governance-audit-users-feature-visibility*
*Completed: 2026-07-11*

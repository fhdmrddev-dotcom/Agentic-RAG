---
phase: 146-operator-foundation
plan: 06
subsystem: ui
tags: [frontend, react, tailwind, control-room, operator, admin, navigation, reachability-triad, non-discoverable, vitest, sketch-061, sketch-062]

# Dependency graph
requires:
  - phase: 146-04 (Control Room frontend data layer)
    provides: "getOperatorProbe/getBackpressure/getOperatorAudit + their types + the useOperatorProbe hook — the fetch + probe interface this shell composes"
  - phase: 146-05 (Control Room presentational leaves)
    provides: "OperatorBand / HealthSignals / TechnicalNamesToggle / LockedTab / RecentActionsCard — the five pure leaves this shell threads props into"
provides:
  - "ControlRoomPage — the 061-B shell: OperatorBand over a horizontal role=tablist section-tab bar (Overview + Audit live; System Controls / Users & Access / AI Models / API Keys locked), fetch-on-entry + the manual ↻ Refresh honesty beat (D-04/D-08)"
  - "AuditTab — the honest minimal full-history view (✎ write mark, no filters/CSV)"
  - "The reachability triad: the 'control-room' ActiveView union entry + App-level single probe host, the ChatLayout full-surface mount branch, and the probe-gated amber Shield (NavPanel footer + mobile drawer) — rendered OUTSIDE NAV_ITEMS (D-07 byte-identity)"
  - "nav-items.test.ts — the NAV_ITEMS byte-identity regression lock (no control-room entry ever leaks into the shared array)"
affects: [147, 148, 149, 150]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shell-fetches-and-threads: ControlRoomPage owns a SINGLE audit fetch (generous limit) + backpressure, threading rows to both the Overview preview and the Audit tab (pure leaves) so the two views can never structurally diverge (extends the Plan-05 leaf contract)"
    - "Manual-refresh honesty beat: no auto-poll / no background timer; the only re-fetch reads backpressure FIRST (backend audit-floor records the view) THEN re-reads audit so the operator's own 'Viewed system health' row visibly prepends (D-04/D-08)"
    - "Reachability triad owned in one phase: ActiveView union + mount branch + entry action — never a built-but-unreachable surface (the 118 lesson)"
    - "Non-discoverable nav: the operator entry renders OUTSIDE the shared NAV_ITEMS array (probe-gated, no placeholder when absent), regression-locked so it can never leak (D-07)"
    - "Single App-level probe host: useOperatorProbe() called ONCE at App, threaded down render-only; the backend 404 gate stays the sole authority (Pitfall 13)"

key-files:
  created:
    - frontend/src/components/admin/ControlRoomPage.tsx
    - frontend/src/components/admin/AuditTab.tsx
    - frontend/src/lib/nav-items.test.ts
  modified:
    - frontend/src/App.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/components/layout/NavPanel.tsx

key-decisions:
  - "AuditTab is a PURE presentational leaf receiving rows from ControlRoomPage (not a self-fetcher) — the shell owns the single audit fetch so the count-pill is always correct and the refresh beat stays coherent; the Plan-05 leaf pattern applied consistently"
  - "ControlRoomPage fetches audit with a generous limit (200) as the full history for the Audit tab; the Overview's RecentActionsCard shows a 6-row preview slice of the same feed"
  - "The four locked tabs render LockedTab bodies with plain, roadmap-number-free 'coming soon' copy lifted from sketch 061-B (T-146-10 — no phase-number token in shipped copy OR source comments)"
  - "The recording FLASH is pulsed via a boolean + a window.setTimeout reset (no fetch on that line — the D-04 grep gate for setInterval/setTimeout-with-fetch stays green)"
  - "The probe-gated shield uses the amber lucide Shield (text-amber-400), distinct from Governance's ShieldCheck, in BOTH the NavPanel footer (collapsed-tooltip idiom) and the mobile drawer (separate element after NAV_ITEMS.map) — nothing rendered when non-operator/loading"

patterns-established:
  - "Control Room shell composes Plan-04 fetches + Plan-05 leaves; future operator sections (147-150) fill the locked tabs into this same 061-B frame"
  - "Byte-identity regression test on a shared nav array — assert no privileged entry ever enters the array both surfaces consume"

requirements-completed: [ADMIN-01]

# Metrics
duration: 10min
completed: 2026-07-10
---

# Phase 146 Plan 06: Control Room Assembly + Reachability Triad Summary

**The operator Control Room, assembled and reachable: `ControlRoomPage` composes the Plan-04 fetches + Plan-05 leaves into the 061-B shell (amber operator band over horizontal section tabs — Overview health+ledger, honest minimal Audit history, four honest locked tabs) with fetch-on-entry + the manual ↻ Refresh honesty beat that visibly prepends the operator's own 'Viewed system health' row; plus the reachability triad — the `"control-room"` ActiveView union entry with a single App-level probe host, the ChatLayout full-surface mount branch, and the probe-gated amber Shield (rail footer + mobile drawer) rendered OUTSIDE NAV_ITEMS so a non-operator's nav is byte-identical, regression-locked by `nav-items.test.ts`.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-10T22:28:57Z
- **Completed:** 2026-07-10T22:39:11Z
- **Tasks:** 3/3 (all auto)
- **Files modified:** 6 (3 created + 3 modified)

## Accomplishments

- **The 061-B shell is assembled (D-07):** `ControlRoomPage` renders `OperatorBand` on top, then a horizontal `role="tablist"` section-tab bar in sketch order — Overview (live) · Audit (live, count-pill) · System Controls · Users & Access · AI Models · API Keys (the four honest `LockedTab` refusals). Tab state is local `useState` (no router, the SkillStudioPage precedent). It is a full-surface branch (NOT a second left rail), sitting inside ChatLayout's `<main className="flex-1 overflow-hidden">` like governance/skill-studio.
- **The Overview composes the leaves + the two-audience toggle:** `HealthSignals` (the four plain-labeled `/admin/backpressure` values) + `TechnicalNamesToggle` (this shell owns `showTechnical` and threads it down — LANG-01) + a preview `RecentActionsCard`, with a visible "Only operators can open this page — every visit is checked on the server." reassurance.
- **The honesty beat (D-04 / D-08):** health + audit load ONCE on entry (independent guarded reads — one failure never nukes the other). There is NO auto-poll and NO background timer. The ONLY re-fetch is the visible ↻ Refresh: it re-reads backpressure FIRST (the backend audit-floor records that view as a "Viewed system health" action) and THEN re-reads the audit feed, so the fresh row visibly prepends to the ledger where the operator watches it land — the band's recording marker pulses as it does. The ledger IS the receipt.
- **The Audit tab is honest + minimal:** `AuditTab` renders the full recent history newest-first with the ✎ write mark reads carry no mark — and NO search / date filters / CSV (a calm "coming soon" note names them, phase-number-free). The Audit tab button carries a loaded-rows count-pill.
- **The reachability triad lands complete in one phase:** the `"control-room"` `ActiveView` union entry + a single App-level `useOperatorProbe()` host (Pitfall 4), the ChatLayout `activeView === "control-room"` mount branch (mounting `ControlRoomPage` with `onBack` → chat), and the probe-gated amber `Shield` action — in BOTH the NavPanel rail footer (footer-button + collapsed-tooltip idiom) and the mobile drawer (a separate element after `NAV_ITEMS.map`). No built-but-unreachable surface (the 118 lesson).
- **Non-operator nav is byte-identical + regression-locked (D-07):** the shield renders ONLY when `isOperator`; nothing at all otherwise (no placeholder, no reserved space). `nav-items.ts` is UNTOUCHED, and `nav-items.test.ts` asserts NAV_ITEMS carries no `control-room` view and no "Control Room" label — the array both the rail and the drawer consume can never leak the surface.
- **Verification green:** both target vitest files pass 4/4 (`nav-items.test.ts` + the Plan-04 `useOperatorProbe.test.ts`); all six files type-check clean (`tsc -p tsconfig.json` exit 0; none of the six appear in the `tsc -b` output); `vite build` bundles clean (exit 0); every plan grep gate green (contains-checks, no polling, no phase-number leak, nav-items.ts untouched).

## Task Commits

Each task was committed atomically:

1. **Task 1: ControlRoomPage + AuditTab — the 061-B shell with the refresh honesty beat** — `318865fc` (feat)
2. **Task 2: Reachability triad — App union + probe, ChatLayout branch, NavPanel shield** — `5f57c231` (feat)
3. **Task 3: NAV_ITEMS byte-identity regression test** — `7c29ea69` (test)

**Plan metadata:** committed with SUMMARY + STATE + ROADMAP + REQUIREMENTS + deferred-items (docs).

## Files Created/Modified

- `frontend/src/components/admin/ControlRoomPage.tsx` (new) — the 061-B shell: band + horizontal section tabs + Overview (health + toggle + ledger preview) + Audit + four locked tabs + fetch-on-entry + the manual ↻ Refresh honesty beat. Props `identity` / `onBack`.
- `frontend/src/components/admin/AuditTab.tsx` (new) — the honest minimal full-history audit view; pure leaf, props `rows`.
- `frontend/src/lib/nav-items.test.ts` (new) — the NAV_ITEMS byte-identity regression lock (no control-room entry / label).
- `frontend/src/App.tsx` (modified) — `ActiveView` union + `"control-room"`; single App-level `useOperatorProbe()`; threads `isOperator` + `operatorIdentity` to ChatLayout.
- `frontend/src/components/layout/ChatLayout.tsx` (modified) — accepts the probe props; the `control-room` full-surface mount branch; the probe-gated mobile-drawer shield.
- `frontend/src/components/layout/NavPanel.tsx` (modified) — accepts `isOperator`; the amber `Shield` footer entry (collapsed-tooltip idiom), rendered only when operator.

## Decisions Made

- **AuditTab is a pure presentational leaf, not a self-fetcher** — the plan text suggested AuditTab fetch its own history, but the shell owning the single audit fetch (and threading rows down) keeps the count-pill always-correct, keeps the refresh honesty beat coherent (one fetch updates the Overview card, the Audit tab, and the pill together), and matches the Plan-05 leaf contract exactly. A minor faithful refinement, not a functional change — the plan's verify gates (which grep ControlRoomPage, not AuditTab, for `getOperatorAudit`) stay green. See Deviations.
- **Generous audit limit (200) as full history; 6-row Overview preview** — the Audit tab is the "full history"; the Overview's RecentActionsCard shows a preview slice of the same feed with the fresh row at top after refresh.
- **Locked-tab copy is roadmap-number-free (T-146-10)** — the four locked descriptions are plain "coming soon" sentences lifted from sketch 061-B; neither shipped copy nor source comments carry a `phase 1xx` token (the D-09 #2 grep gate is green).
- **Amber Shield, distinct glyph** — the probe-gated entry uses `text-amber-400` lucide `Shield` (the OperatorBand convention), deliberately distinct from Governance's `ShieldCheck`, in both the rail footer and the mobile drawer.

## Deviations from Plan

### Faithful refinement (no auto-fix rule triggered)

**1. AuditTab composed as a pure presentational leaf (props-in) instead of a self-fetcher**
- **Found during:** Task 1
- **Plan text:** "Create AuditTab.tsx … fetch getOperatorAudit() with a larger limit, render the rows."
- **What shipped:** `ControlRoomPage` owns the single `getOperatorAudit(200)` fetch and threads the rows to both the Overview preview and `<AuditTab rows={…} />`; AuditTab is a pure leaf.
- **Why:** keeps the Audit-tab count-pill always-correct (the shell knows the count without the tab being visited), keeps the ↻ Refresh honesty beat coherent (a single fetch updates the Overview card, the Audit tab, and the pill in lockstep), and matches the Plan-05 "shell fetches + threads props" leaf contract exactly — avoiding a redundant second fetch of the same endpoint and a second loading state.
- **Impact:** none on behavior or the plan's gates — Task 1's verify greps ControlRoomPage (not AuditTab) for `getOperatorAudit`, and the acceptance criteria (renders history rows, no filter/CSV, count-pill on the Audit tab button) are all met. No scope change.

**Total deviations:** 1 faithful design refinement (no Rule 1–4 auto-fix triggered; no scope creep).

## Issues Encountered

**`npm run build` fails at `tsc -b` on pre-existing rot — out of scope (SCOPE BOUNDARY).** The build is `tsc -b && vite build`. `vite build` on its own succeeds (exit 0 — my code bundles), and `tsc -p tsconfig.json` is clean, but the project-references typecheck (`tsc -b` → `tsconfig.app.json`) fails on 7 files this phase never touched (`SettingsPage.tsx`, `streamsStore.ts`, `StreamsProvider.tsx`, `SkillFormDialog.tsx`, `MemorySection.tsx`, `api.test.ts`, `FilePreview.test.tsx` — React-19 ref rot, unused-var, StateCreator type drift, etc.).
- **Proven pre-existing:** `git diff --name-only HEAD~2 HEAD` lists only my 5 source files; none of the error files appear; and none of them reference `ActiveView` (the plan's only cross-file type change), so the added `"control-room"` union member cannot ripple into them. The build was already red at baseline.
- **Disposition:** logged to `.planning/phases/146-operator-foundation/deferred-items.md` (SEED-056 frontend tsc/vitest rot). NOT fixed — SCOPE BOUNDARY forbids touching unrelated pre-existing failures. This plan's own build evidence is green (vite build clean, all six 146-06 files clean, both target vitest files 4/4).

## User Setup Required

None — no external service configuration required. Pure frontend composition + wiring; no env vars, no migrations, no provider keys.

## Known Stubs

None. The four locked tabs are NOT stubs — they are the intentional, sketch-locked honest "coming soon" refusals for the not-yet-built operator sections (System Controls → the control-plane phase, Users & Access → the governance phase, AI Models → the model-registry phase, API Keys → the secrets-at-rest phase). `HealthSignals`' null-loading placeholder and `RecentActionsCard`'s "No actions yet" are deliberate honest empty states, not placeholders. All rendered data flows from the live `getBackpressure` / `getOperatorAudit` calls; no hardcoded mock data reaches the UI.

## Threat Flags

None new. The plan's `<threat_model>` register is satisfied:
- **T-146-06 (client-forged isOperator):** mitigated by construction — the shield/page render off the probe, but every data call (`/admin/backpressure`, `/admin/audit`) is independently 404-gated server-side (Plan 02); a forged flag yields an empty shell that can fetch nothing (Pitfall 13). No new trust boundary introduced.
- **T-146-02 (operator-surface discoverability):** mitigated — the shield renders OUTSIDE NAV_ITEMS, probe-gated, no placeholder when absent; `nav-items.test.ts` regression-locks the shared array (D-07 / D-09 #1).
- **T-146-10 (phase-number leak):** mitigated — the Task-1 grep asserts no `Phase 1xx` token in ControlRoomPage/AuditTab (shipped copy OR comments); green.
- **T-146-11 (refresh bypassing the ledger beat):** mitigated — ↻ Refresh re-fetches audit AFTER backpressure so the floor's own "Viewed system health" row visibly lands (D-04/D-08); the row persists server-side.
- **T-146-SC (npm installs):** N/A — no packages added (reuses lucide-react + existing Tailwind tokens).

No security-relevant surface was introduced beyond the register — no new network endpoint, auth path, or schema change (this plan is pure client composition against the Plan-02 endpoints).

## Next Phase Readiness

- **The operator zone is live and reachable** — Phases 147-150 move INTO this 061-B shell: each fills one of the four locked tabs (System Controls / Users & Access / AI Models / API Keys) by replacing its `LockedTab` body with a real section, reusing the OperatorBand + the ledger-is-receipt honesty beat established here. The manual-refresh / no-auto-poll floor is the baseline (147 owns any auto-poll for active runs).
- **Verification debt (out of scope, tracked):** `npm run build`'s `tsc -b` step is red on pre-existing SEED-056 rot — see `deferred-items.md`. Any phase that makes `npm run build` a hard CI gate must clear those 7 files first.
- No blockers to the operator track.

---
*Phase: 146-operator-foundation*
*Completed: 2026-07-10*

## Self-Check: PASSED

- Files: `ControlRoomPage.tsx`, `AuditTab.tsx`, `nav-items.test.ts`, `146-06-SUMMARY.md`, `deferred-items.md` all present
- Commits: `318865fc`, `5f57c231`, `7c29ea69` all found in git log
- Both target vitest files pass 4/4; all six 146-06 files type-check clean (`tsc -p tsconfig.json` exit 0, none in `tsc -b` errors); `vite build` exit 0; nav-items.ts untouched; grep gates green (no polling, no phase-number leak)

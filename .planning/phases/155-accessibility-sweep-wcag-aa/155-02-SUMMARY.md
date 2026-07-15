---
phase: 155-accessibility-sweep-wcag-aa
plan: 02
subsystem: ui
tags: [wcag, accessibility, contrast, design-tokens, css, tailwind, admin]

# Dependency graph
requires:
  - phase: 088-05
    provides: the operator-approved panel-token contrast math (--panel-muted-foreground-dim 220 16% 70% = 8.42:1) reused as the D-04 lift target
  - phase: 155-01
    provides: the jsx-a11y regression gate + violation inventory establishing the WCAG-AA sweep baseline
provides:
  - AA-passing global dark --muted-foreground-dim token (lifted 220 16% 45% ~3.6:1 → 220 16% 70% ~8:1), fixing the #1 contrast offender class at the token source app-wide
  - the densest SEED-092 opacity cluster (admin/, 40 meaningful-text offenders) swept onto full-opacity AA tokens, with 8 residual WCAG-allowed exemptions documented
  - operator D-07 sign-off on the retuned Deep-Midnight look (approved, no lightness nudge) — the approved value 220 16% 70% is locked for plan 155-07 to sweep the remaining clusters onto
affects: [155-07, 155-06, contrast-sweep, muted-text, deep-midnight-theme]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fix contrast at the TOKEN SOURCE (D-04) — lift the global dim custom property so no consuming page can regress by reading it"
    - "Opacity modifier is the real killer — meaningful muted text uses full-opacity text-muted-foreground / text-muted-foreground-dim, never text-muted-foreground/{40,50,60,70}"
    - "Mid-execution operator eyeball (D-07) as the visual-fidelity approval gate for token retunes, in lieu of a full G-2 sketch"

key-files:
  created:
    - .planning/phases/155-accessibility-sweep-wcag-aa/155-02-SUMMARY.md
  modified:
    - frontend/src/index.css
    - frontend/src/components/admin/AuditTab.tsx
    - frontend/src/components/admin/UsersAndAccess.tsx
    - frontend/src/components/admin/ModelRegistryTab.tsx
    - frontend/src/components/admin/HealthSignals.tsx
    - frontend/src/components/admin/RecentActionsCard.tsx
    - frontend/src/components/admin/FeatureVisibility.tsx
    - frontend/src/components/admin/LockedTab.tsx
    - frontend/src/components/admin/ControlRoomPage.tsx
    - frontend/src/components/admin/CapabilityGrid.tsx
    - frontend/src/components/admin/ActiveRunsSection.tsx

key-decisions:
  - "D-07 APPROVED — operator eyeballed the retuned dark tokens live (Control Room, Deep Midnight theme) and approved with NO lightness nudge; final locked value --muted-foreground-dim: 220 16% 70%"
  - "Base --muted-foreground (220 16% 65%, ~7.7:1) left untouched — only the DIM token + opacity modifiers changed (rewriting the base would wash out the app, G-6 #4)"
  - "8 residual admin opacity offenders retained as WCAG-allowed exemptions (decorative aria-hidden icons, input placeholders, disabled cursor-not-allowed controls) — documented for the D-03 live scan + D-06 remainder list"

patterns-established:
  - "Token-source contrast fix + opacity-modifier sweep is the reusable recipe plan 155-07 applies to the remaining clusters onto the SAME approved value"

requirements-completed: []  # A11Y-01 stays OPEN at the requirement level (false-green avoidance, 148-154 convention) — closes at /gsd:verify-work 155 after the full app-wide sweep + live Chrome contrast scan (D-03). requirements.mark-complete deliberately NOT called.

# Metrics
duration: ~23 min (incl. D-07 operator-eyeball checkpoint)
completed: 2026-07-16
---

# Phase 155 Plan 02: Contrast Token Retune + Admin-Cluster Sweep Summary

**Lifted the global dark `--muted-foreground-dim` token from ~3.6:1 (fails) to ~8:1 (220 16% 70%, AA) at the source, swept 40 admin-cluster opacity offenders onto full-opacity tokens, and got operator D-07 sign-off that Deep Midnight survives — locking the value for the 155-07 remainder sweep.**

## Performance

- **Duration:** ~23 min (Task 1 → finalization, spanning the D-07 operator-eyeball checkpoint)
- **Started:** 2026-07-15T23:56:56+04:00 (Task 1 commit)
- **Completed:** 2026-07-16 (D-07 approval + finalization)
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 11 (index.css + 10 admin/ files)

## Accomplishments
- Fixed the #1 pre-existing offender class — low-contrast muted text — at the token SOURCE (D-04): global dark `--muted-foreground-dim` lifted `220 16% 45%` (#606d85, ~3.6:1 on the dark #060a0f bg — FAILS WCAG 2.1 AA 1.4.3) → `220 16% 70%` (#a6aebf, ~8:1), mirroring the operator-approved Phase 088-05 panel token (8.42:1). The in-file Phase 087 comment was extended with the full AA math and the 088-05 precedent.
- Swept the densest SEED-092 opacity cluster (`frontend/src/components/admin/`, 48 total occurrences across the plan's 11-file target): 40 meaningful-text `text-muted-foreground/{40,50,60,70}` offenders dropped to full-opacity `text-muted-foreground` across 10 files; 8 truly decorative/disabled occurrences retained as WCAG-allowed exemptions (documented below).
- **D-07 operator checkpoint APPROVED:** the operator eyeballed the retuned tokens live in the running dev app (dark / Deep Midnight theme, Control Room) — before/after confirmed the previously-faint helper/meta text is now clearly AA-readable AND the muted Deep-Midnight read is preserved (not washed out). No lightness nudge requested. Final locked value `--muted-foreground-dim: 220 16% 70%`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Lift global dark `--muted-foreground-dim` token to AA + extend contrast-math doc** — `e0cd7760` (feat)
2. **Task 2: Sweep the ADMIN-cluster opacity offenders onto real tokens** — `f617bbff` (fix) — 10 files (ModelDiscoveryPanel.tsx correctly untouched — both its occurrences are exemptions; see below)
3. **Task 3: D-07 operator eyeball (chat / documents / Control Room)** — no commit (verification checkpoint; approved, token value already at the approved 220 16% 70% from Task 1)

**Plan metadata:** committed with this SUMMARY + STATE.md + ROADMAP.md (docs commit)

## Files Created/Modified
- `frontend/src/index.css` — global dark `--muted-foreground-dim` lifted to `220 16% 70%` (line 118) + extended Phase 087/155 AA-math comment (lines 107-117). Base `--muted-foreground` (line ~94) and the panel tokens untouched.
- `frontend/src/components/admin/AuditTab.tsx` — 13 opacity offenders → full-opacity tokens
- `frontend/src/components/admin/UsersAndAccess.tsx` — meaningful-text offenders swept; 3 exemptions retained
- `frontend/src/components/admin/ModelRegistryTab.tsx` — swept; 2 exemptions retained
- `frontend/src/components/admin/HealthSignals.tsx` — 6 offenders swept
- `frontend/src/components/admin/RecentActionsCard.tsx` — 3 offenders swept
- `frontend/src/components/admin/FeatureVisibility.tsx` — 3 offenders swept
- `frontend/src/components/admin/LockedTab.tsx` — swept; 1 decorative-icon exemption retained
- `frontend/src/components/admin/ControlRoomPage.tsx` — 2 offenders swept
- `frontend/src/components/admin/CapabilityGrid.tsx` — 2 offenders swept
- `frontend/src/components/admin/ActiveRunsSection.tsx` — 1 offender swept

## D-07 Approval Outcome (final locked token)

| Field | Value |
|-------|-------|
| Decision | **APPROVED** — no lightness nudge |
| Final locked value | `--muted-foreground-dim: 220 16% 70%` (dark theme, `frontend/src/index.css` line 118) — unchanged from Task 1 |
| Verified surface | Live dev app, dark / Deep Midnight theme, Control Room `/admin` |
| Operator finding | Previously-faint helper/meta text now clearly AA-readable; Deep Midnight muted read preserved (not washed out). Control Plane tab: 22 opacity-offender spots → 1 documented exemption; dim token ~3.6:1 → ~8.4:1. |
| Consequence | Plan 155-07 sweeps the remaining non-admin clusters onto this SAME approved value (D-07: "approve, then the sweep proceeds"). |

## Admin-Cluster Residuals (WCAG-allowed exemptions)

Post-sweep admin-scoped grep (`text-muted-foreground/{40,50,60,70}` under `src/components/admin/`) = **8 occurrences across 4 files, all documented exemptions** (down from 48 offenders). None is meaningful body/label text:

| File:Line | Occurrence | Exemption class |
|-----------|-----------|-----------------|
| `LockedTab.tsx:33` | `<Lock … text-muted-foreground/70` `aria-hidden="true"` | Decorative graphic (WCAG 1.4.3 N/A to decorative content) |
| `ModelDiscoveryPanel.tsx:534` | `placeholder:text-muted-foreground/50` | Input placeholder affordance |
| `ModelDiscoveryPanel.tsx:546` | `cursor-not-allowed text-muted-foreground/60` | Disabled control |
| `ModelRegistryTab.tsx:591` | `placeholder:text-muted-foreground/50` | Input placeholder affordance |
| `ModelRegistryTab.tsx:649` | `cursor-not-allowed … text-muted-foreground/40` | Disabled control |
| `UsersAndAccess.tsx:136` | `pointer-events-none absolute … text-muted-foreground/60` | Decorative search-field affordance icon |
| `UsersAndAccess.tsx:145` | `placeholder:text-muted-foreground/60` | Input placeholder affordance |
| `UsersAndAccess.tsx:249` | disabled-user avatar initial, inside `aria-hidden="true"` avatar | Decorative + disabled-state |

`ModelDiscoveryPanel.tsx` (listed in the plan's 11-file target with 2 occurrences) received NO diff because both of its occurrences are exemptions — hence Task 2's commit touched 10 files, not 11. This is correct behavior, not a miss.

## Light-theme note (for the D-03 live scan)
There is **no global `--muted-foreground-dim` in the light (`:root`) block** — the token exists only inside the `.dark` block (line 118). The light theme relies on the opacity sweeps (this plan for admin, 155-07 for the rest) rather than a token lift. Flagged here so the live Chrome contrast scan (D-03) checks light-theme muted text after 155-07 completes.

## Decisions Made
- **D-07 approved with no nudge** — locked `220 16% 70%`. Recorded for 155-07.
- **Base token untouched** — only the DIM token + opacity modifiers changed (G-6 #4 washed-out guard).
- **Exemptions retained, not forced** — decorative/disabled/placeholder occurrences left at their opacity per WCAG, documented rather than swept.

## Deviations from Plan

None - plan executed exactly as written. (This continuation agent finalized the plan after the D-07 checkpoint cleared; it made no code changes — Tasks 1-2 were already committed by the prior executor and the approved token value was already in place.)

## Out-of-scope note (D-155-01-A)
The CI `npm run lint` gate also fires on ~160 pre-existing NON-a11y errors (`no-explicit-any`/`no-unused-vars`/`react-refresh`/etc.) logged to `deferred-items.md` as D-155-01-A by plan 155-01. That lint-gate-scope decision is **out of scope for this plan** (contrast-only) and is owed at plan 155-03 review / phase verification.

## Issues Encountered
None.

## Threat surface
No new security-relevant surface. The one trust boundary in play (design tokens → all consumers) was mitigated exactly as the threat register prescribed: the global lift mirrors the operator-approved 088-05 value and the D-07 eyeball was the blocking visual-regression gate. G-5 RED LINE honored — `git diff --name-only` for both commits shows ONLY `index.css` + `admin/` files; `MessageItem.tsx` / `StreamsProvider.tsx` untouched.

## Self-Check Gates (this finalization)
- `npx vitest run src/components/admin/__tests__` → **46 passed / 5 files** (targeted non-regression) GREEN
- `npx tsc -b` → exactly **30** SEED-056/049 baseline errors, **0 net-new** GREEN
- `npx vite build` → exit **0** (built in 3.84s) GREEN
- `grep muted-foreground-dim: 220 16% 70%` present; `220 16% 45%` gone; base `muted-foreground: 220 16% 65%` intact
- **Contrast SC (D-03) is proven ONLY by the live Chrome color-contrast scan** (jsdom cannot compute contrast) — recorded in 155-VALIDATION.md after 155-07 completes the remaining clusters; never claimed from the green vitest run.

## Next Phase Readiness
- The approved token (`220 16% 70%`) is locked and in-file — plan 155-07 (same wave, disjoint files) can now sweep the remaining clusters (chat/studio/classification/settings/ingestion/layout/pages/workflows/panel) onto it.
- A11Y-01 stays OPEN at the requirement level until `/gsd:verify-work 155` (full app-wide sweep + live contrast scan).

## Self-Check: PASSED
- Commits verified present: `e0cd7760` (Task 1), `f617bbff` (Task 2), `5e4b7b02` (SUMMARY) — all FOUND in git log.
- SUMMARY file exists at `.planning/phases/155-accessibility-sweep-wcag-aa/155-02-SUMMARY.md`.
- Approved token confirmed unchanged in `frontend/src/index.css` line 118: `--muted-foreground-dim: 220 16% 70%`.
- Gates green: admin `__tests__` 46/46, `tsc -b` 30 baseline (0 net-new), `vite build` exit 0.

---
*Phase: 155-accessibility-sweep-wcag-aa*
*Completed: 2026-07-16*

---
phase: 088-cross-cutting-verification-accessibility
plan: 01
subsystem: testing
tags: [accessibility, a11y, wcag, axe-core, vitest-axe, aria-live, focus-visible, react, panel]

# Dependency graph
requires:
  - phase: 087-panel-ui
    provides: The 8 panel components (WorkspacePanel, TodosSection, FilesSection, FilePreview, CsvTablePreview, PendingAskCard, VersionDiff, Seam renderers) + their test suite + fixtures.ts — this plan verifies and a11y-gates them, does not rebuild
  - phase: 086-streamsprovider-extension-panel-hooks
    provides: The reactive panel hooks (useTodos/useWorkspaceFiles/useAskUserPrompt/useViewingThread) the components consume; also the known ~17-failure StreamsProvider test baseline this plan must not regress past
provides:
  - vitest-axe wired into the Vitest runner (expect.extend in setupTests.ts) — a durable structural-a11y matcher available to every test file
  - ONE global zero-specificity :focus-visible ring in index.css @layer base (the first such ring in the app)
  - Two targeted aria-live=polite regions (TodosSection todo-count, VersionDiff +N/−M line count)
  - FilesSection aria-selected now tracks the active row (was always-false)
  - A structural-a11y regression gate — all 8 panel test files assert no axe violations across their rendered states (89/89 panel tests green)
affects: [088-05 verification capstone, Plan 05 Chrome MCP Lighthouse contrast audit, any future panel component change, v2.8 a11y work]

# Tech tracking
tech-stack:
  added: [vitest-axe@0.1.0 (dev-only), axe-core@4.11.4 (transitive)]
  patterns:
    - "Zero-specificity :where(...) global focus ring as a FLOOR (components with their own focus-visible:ring-* win)"
    - "Visually-hidden sr-only aria-live=polite regions for dynamic-moment SR announcements, rendered as React text children (never dangerouslySetInnerHTML)"
    - "Per-file axe(container) assertion across meaningful rendered STATES using the shared fixtures.ts mocks"

key-files:
  created: []
  modified:
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/src/setupTests.ts
    - frontend/src/index.css
    - frontend/src/components/panel/TodosSection.tsx
    - frontend/src/components/panel/VersionDiff.tsx
    - frontend/src/components/panel/FilesSection.tsx
    - frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx
    - frontend/src/components/panel/__tests__/TodosSection.test.tsx
    - frontend/src/components/panel/__tests__/FilesSection.test.tsx
    - frontend/src/components/panel/__tests__/FilePreview.test.tsx
    - frontend/src/components/panel/__tests__/CsvTablePreview.test.tsx
    - frontend/src/components/panel/__tests__/PendingAskCard.test.tsx
    - frontend/src/components/panel/__tests__/VersionDiff.test.tsx
    - frontend/src/components/panel/__tests__/Seam.test.tsx

key-decisions:
  - "Used vitest-axe (NOT jest-axe) — the project runner is Vitest 4.1.0; D-13's 'jest-axe' is the wrong binding (RESEARCH correction #2 / Pitfall 1)"
  - "Global focus ring uses :where(...) zero-specificity so it is a floor not an override — no double-rings, no regression of components with their own ring"
  - "aria-live politeness = polite for both regions (status flips are informational; assertive would interrupt the SR mid-read during a multi-step run)"
  - "Placed the global :focus-visible rule in the second @layer base block (alongside *, body, #root) — the natural home for global element styling"
  - "No component needed a restructure — all 8 axe assertions passed after the four Task-2 edits, so no D-09 SEED deferral was required"

patterns-established:
  - "Pattern 6 (RESEARCH): zero-specificity global :focus-visible ring via :where(...) + --ring token"
  - "Pattern 7 (RESEARCH): targeted sr-only aria-live=polite regions, text-children only"
  - "D-13a: per-file axe(container) structural-a11y regression gate"

requirements-completed: [A11Y-01, A11Y-02]

# Metrics
duration: 13min
completed: 2026-05-29
---

# Phase 088 Plan 01: A11y Remediation + vitest-axe Gate Summary

**WCAG 2.1 AA structural conformance closed on all 8 Phase 087 panel surfaces: vitest-axe wired as a durable regression gate, one global zero-specificity :focus-visible ring added, two targeted aria-live announcements (todo count + diff +N/−M), and the FilesSection always-false aria-selected fixed — all 89 panel tests green with zero regression past the 17-failure 086 baseline.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-05-29T17:24Z (pre-change baseline run)
- **Completed:** 2026-05-29T17:34Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Installed + wired `vitest-axe@0.1.0` (pulls `axe-core@4.11.4` transitively) into the Vitest runner via `expect.extend(axeMatchers)` in `setupTests.ts` — `toHaveNoViolations` now available in every test file, dev-dependency only, no Jest config.
- Added the app's FIRST global keyboard focus indicator: ONE `:focus-visible` rule in `index.css` `@layer base` using zero-specificity `:where(...)` + `hsl(var(--ring))` — a floor that components with their own `focus-visible:ring-*` utilities still override.
- Closed the two missing dynamic-moment SR announcements: TodosSection now announces "N of M todos complete" and VersionDiff announces "N added, M removed" via visually-hidden `aria-live="polite"` regions (the diff announce carries the words so the color-coded +N/−M counts are not conveyed by color alone).
- Fixed the FilesSection listbox `aria-selected={false}` always-false finding (RESEARCH Pitfall 6) → `aria-selected={isActive}`, so the option state tracks the active row.
- Added a durable structural-a11y regression gate: all 8 panel test files now assert `toHaveNoViolations` across their meaningful rendered states (89/89 panel tests green; +17 new axe assertions).

## Task Commits

Each task was committed atomically (with hooks, on the main working tree):

1. **Task 1: Install + wire vitest-axe** — `172c697e` (chore)
2. **Task 2: Global :focus-visible ring + targeted aria-live + FilesSection aria-selected fix** — `9d540e14` (feat)
3. **Task 3: Add axe assertion to all 8 panel test files** — `2d76a557` (test)

**Plan metadata:** (this SUMMARY + STATE.md + ROADMAP.md) committed separately as the final docs commit.

## Files Created/Modified

- `frontend/package.json` / `frontend/package-lock.json` — `vitest-axe@^0.1.0` dev-dependency
- `frontend/src/setupTests.ts` — `expect.extend(axeMatchers)` wiring (D-13a)
- `frontend/src/index.css` — global `:where(...):focus-visible` ring in `@layer base` (A11Y-01)
- `frontend/src/components/panel/TodosSection.tsx` — `sr-only aria-live=polite` todo-count region; `doneCount`/`total` computed from todos via `normalizeStatus`
- `frontend/src/components/panel/VersionDiff.tsx` — `sr-only aria-live=polite` "N added, M removed" announce at the +N/−M summary
- `frontend/src/components/panel/FilesSection.tsx` — `aria-selected={isActive}` (was `{false}`)
- `frontend/src/components/panel/__tests__/{WorkspacePanel,TodosSection,FilesSection,FilePreview,CsvTablePreview,PendingAskCard,VersionDiff,Seam}.test.tsx` — `axe(container)` assertions across rendered states

## Decisions Made

- **vitest-axe, not jest-axe** — the runner is Vitest 4.1.0 (`"test": "vitest run"`, no Jest config); jest-axe would need a manual Jest-expect adapter. (RESEARCH correction #2 / Pitfall 1, honored.)
- **`:where(...)` zero-specificity** for the global ring so it never overrides a component's own focus utility — avoids double-rings/regression.
- **polite** politeness for both aria-live regions — status flips are informational; assertive would interrupt a screen reader mid-read on every todo change during a multi-step run.
- **No D-09 SEED deferral needed** — the panel was genuinely ~80% conformant; all 8 axe assertions passed after the four Task-2 edits with no restructure required.

## Deviations from Plan

None — plan executed exactly as written. The four Task-2 edits and the per-file axe assertions matched the plan's verified interfaces (line numbers, field names, isActive availability) exactly; no auto-fixes (Rules 1-3) were triggered and no architectural decision (Rule 4) arose. The `stats.deletions` field name the plan asked me to confirm was verified against the live `WorkspaceDiff` type and the fixture (`{ additions, deletions }`).

## Issues Encountered

- **Pre-existing `tsc -b` type errors (out of scope).** A sanity `npx tsc -b` surfaced ~30 TypeScript errors — ALL in files this plan never touched (`FolderNode.test.tsx`, `FolderTree.test.tsx`, `IngestionPage.test.tsx`, `useDocuments`/`useFolders`/`useMessages` tests, `MessageSkeleton.tsx`, `DocumentList.tsx`). Zero errors in any file I edited. Per the SCOPE BOUNDARY rule, I did NOT fix them — logged to `.planning/phases/088-cross-cutting-verification-accessibility/deferred-items.md` and routed as a candidate v2.8 test/type-hygiene sweep. Vitest transpiles with esbuild (not tsc), so these do not block the test suite (the actual plan gate).
- **Harmless jsdom canvas warning.** axe-core probes `HTMLCanvasElement.getContext()` which jsdom does not implement; this prints a warning but does not fail — and confirms Pitfall 5 (axe under jsdom does NOT measure color-contrast; the green run proves STRUCTURE only). Real-contrast 4.5:1 verification remains Plan 05's Chrome MCP Lighthouse job.

## Verification Evidence

- `cd frontend && npx vitest run src/components/panel` → exit 0, **89/89 panel tests pass** (8/8 files), all 17 new axe assertions green.
- `cd frontend && npx vitest run` (full suite) → **17 failed | 408 passed (425)**. Pre-change baseline was **17 failed | 391 passed (408)** — failure count IDENTICAL (no regression), passing count +17 (exactly the new axe tests).
- Confirmed via vitest JSON report: **zero failing files overlap any file this plan changed**; all 8 panel files pass. The 7 failing files are the documented pre-existing 086-era baseline (3× StreamsProvider + model-info + useMessages + MessageItem + Plan04).
- Content assertions: `index.css` contains `:focus-visible` + `:where(` + `hsl(var(--ring))`; TodosSection + VersionDiff contain `aria-live="polite"` + `sr-only`; VersionDiff contains `added` + `removed`; FilesSection contains `aria-selected={isActive}` and NO `aria-selected={false}`; **zero `dangerouslySetInnerHTML` JSX** in the three component files (the only matches are documentary comments). All 8 test files contain `toHaveNoViolations` + import `axe` from `vitest-axe`.

## Known Stubs

None. No hardcoded empty values, placeholders, or unwired components were introduced. The two aria-live regions are wired to live data (`todos` via `normalizeStatus`; `stats.additions`/`stats.deletions` from the fetched diff).

## Scope Note (Pitfall 5 — structural only)

These vitest-axe assertions prove STRUCTURE (roles / names / labels / ARIA states) under jsdom. They do NOT prove 4.5:1 contrast or real rendered focus rings — axe-core under jsdom has no CSSOM color resolution. Real-contrast AA verification (both Deep Midnight dark + light themes) and the lived focus-ring/keyboard walk are explicitly Plan 05's Chrome MCP Lighthouse + operator lived-experience job (D-13b / D-14).

## Next Phase Readiness

- A11Y-01 / A11Y-02 structural conformance is GREEN and gated; the regression guard fails `npx vitest run src/components/panel` if any future change reintroduces a structural a11y violation.
- Ready for the rest of Phase 088 (Plans 02-05: cross-provider eval script, deep E2E scenario-13, SEED-034 fold-gate, verification capstone). This plan has no dependents within 088 except the verification capstone, which will roll up the axe-gate result alongside the live Chrome MCP Lighthouse contrast audit.
- No blockers introduced. The pre-existing tsc drift (logged in deferred-items.md) is unrelated to this milestone-close gate.

## Self-Check: PASSED

- `088-01-SUMMARY.md` — FOUND
- `deferred-items.md` — FOUND
- Commit `172c697e` (Task 1) — FOUND
- Commit `9d540e14` (Task 2) — FOUND
- Commit `2d76a557` (Task 3) — FOUND

---
*Phase: 088-cross-cutting-verification-accessibility*
*Completed: 2026-05-29*
